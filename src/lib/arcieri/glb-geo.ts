import type { Geo } from "./gl3d";

/**
 * Modelli 3D veri (file .glb) per le scene disegnate con gl3d: per ogni pezzo la geometria, il colore
 * del materiale e l'eventuale immagine. Basta per oggetti semplici come il paglione e le frecce
 * (niente ossa, niente animazioni). Le coordinate restano quelle del file.
 */
export type GlbPart = { name: string; material: string; geo: Geo; color: [number, number, number]; image: ImageBitmap | HTMLImageElement | null };

type Json = {
  accessors: { bufferView: number; byteOffset?: number; count: number; componentType: number; type: string }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  meshes: { name?: string; primitives: { attributes: Record<string, number>; indices?: number; material?: number }[] }[];
  materials?: { name?: string; pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: { index: number } } }[];
  textures?: { source?: number }[];
  images?: { bufferView?: number; mimeType?: string }[];
};

const COMPS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

async function decodeImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* si prova con un'immagine */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function loadGlb(url: string): Promise<GlbPart[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`glb ${res.status}`);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("non è un glb");
  let off = 12;
  let json: Json | null = null;
  let bin: ArrayBuffer | null = null;
  while (off + 8 <= buf.byteLength) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, start, len))) as Json;
    else if (type === 0x004e4942) bin = buf.slice(start, start + len);
    off = start + len;
  }
  if (!json || !bin) throw new Error("glb vuoto");
  const J = json;
  const B = bin;
  const floats = (i: number) => {
    const a = J.accessors[i];
    const bv = J.bufferViews[a.bufferView];
    const n = COMPS[a.type] ?? 1;
    const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const stride = bv.byteStride ?? n * 4;
    if (stride === n * 4 && base % 4 === 0) return new Float32Array(B.slice(base, base + a.count * n * 4));
    const out = new Float32Array(a.count * n);
    const v = new DataView(B);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = v.getFloat32(base + k * stride + c * 4, true);
    return out;
  };
  const indices = (i: number): Uint16Array | null => {
    const a = J.accessors[i];
    const bv = J.bufferViews[a.bufferView];
    const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    if (a.componentType === 5123) return new Uint16Array(B.slice(base, base + a.count * 2));
    if (a.componentType === 5121) return Uint16Array.from(new Uint8Array(B, base, a.count));
    if (a.componentType === 5125) {
      const big = new Uint32Array(B.slice(base, base + a.count * 4));
      let max = 0;
      for (const x of big) max = Math.max(max, x);
      return max < 65536 ? Uint16Array.from(big) : null;
    }
    return null;
  };
  const images = await Promise.all(
    (J.images ?? []).map((im) => {
      if (im.bufferView == null) return Promise.resolve(null);
      const bv = J.bufferViews[im.bufferView];
      const start = bv.byteOffset ?? 0;
      return decodeImage(new Blob([B.slice(start, start + bv.byteLength)], { type: im.mimeType ?? "image/png" }));
    }),
  );
  const parts: GlbPart[] = [];
  for (const m of J.meshes) {
    for (const p of m.primitives) {
      const posI = p.attributes.POSITION;
      if (posI == null || p.indices == null) continue;
      const idx = indices(p.indices);
      if (!idx) continue;
      const pos = floats(posI);
      const nor = p.attributes.NORMAL != null ? floats(p.attributes.NORMAL) : new Float32Array(pos.length);
      const uv = p.attributes.TEXCOORD_0 != null ? floats(p.attributes.TEXCOORD_0) : new Float32Array((pos.length / 3) * 2);
      const mat = p.material != null ? J.materials?.[p.material] : undefined;
      const f = mat?.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1];
      const ti = mat?.pbrMetallicRoughness?.baseColorTexture?.index;
      const src = ti != null ? J.textures?.[ti]?.source : undefined;
      parts.push({ name: m.name ?? "", material: mat?.name ?? "", geo: { pos, nor, uv, idx }, color: [f[0], f[1], f[2]], image: src != null ? images[src] ?? null : null });
    }
  }
  return parts;
}
