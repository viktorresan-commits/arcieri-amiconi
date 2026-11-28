/**
 * Pelle vera della sagoma: il corpo intero del personaggio Quaternius (Universal Base Characters, CC0),
 * chiuso e con le sue ossa, mosso dagli stessi segmenti del corpo anatomico (bacino, torace, testa,
 * clavicole, braccia, gambe) e con le mani vere di hand-rig. La pelle dell'atlante anatomico ha buchi
 * sotto le ascelle e si strappa sulle spalle quando le braccia si alzano: questa no.
 * File: public/anatomia/pelle.{json,bin,jpg} e pelle-occhi.jpg (dal personaggio della prova 3D).
 */
import { v3, type V3 } from "./anatomy-model";
import type { BodyMeta } from "./anatomy-body";

type MeshJson = { n: number; vOffset: number; iOffset: number; indices: number; /** dove cominciano gli indici della testa (con uv e immagine loro) */ headStart?: number };
type BodyJson = { stride: number; meshes: { corpo: MeshJson; occhi: MeshJson }; joints: { name: string; parent: number; rest: number[] }[]; /** byte in più per vertice (scripts/anatomia/wrap_skin.py) */ extra?: { group: number; bulge: number; ao: number; paint: number; bulgeScale: number; delta?: number; zone?: number; nrm0?: number; face?: number; /** quanto è stoffa (pantaloncini), levigato sulla superficie: vedi cloth_mask.py */ cloth?: number }; /** occhi del personaggio nascosti (occhi dalla foto del viso) */ hideEyes?: boolean; /** "atlante": pelle a riposo nello spazio dell'atlante, mossa dai suoi segmenti (indici 0..20) e dalle ossa delle mani (21 + osso) */ rig?: string; segments?: string[]; /** per ogni osso del personaggio: dal riposo dell'atlante al suo spazio (3x3 a righe, poi traslazione) */ restInv?: number[][]; /** pelle della foto del viso, colore lineare */ faceSkin?: number[]; headUvScale?: number; relief?: boolean };
export type SkinMesh = {
  n: number;
  pos: Float32Array;
  nrm: Float32Array;
  uv: Float32Array;
  jo: Uint8Array | Uint16Array;
  wt: Float32Array;
  idx: Uint16Array;
  /** muscolo sotto la pelle (gruppo dell'atlante) e quanto la pelle si gonfia con lui (metri per metro) */
  grp: Uint8Array | null;
  bulge: Float32Array | null;
  /** a terne: occlusione (0..1, 1 = all'aperto), quanto conta il chiaroscuro dipinto, quanto conta la foto del viso */
  k: Float32Array;
  /** braccio piegato: quanto della forma dell'atlante si toglie (a gomito chiuso) e da che lato (1 sinistro, 2 destro) */
  delta: Float32Array | null;
  zone: Float32Array | null;
  zside: Uint8Array | null;
  /** normali della forma del personaggio (braccio piegato) */
  nrm0: Float32Array | null;
  /** indici della testa nuova (dopo quelli del corpo): uv sferiche (× uvScale) e immagine pelle-testa.jpg */
  headStart: number | null;
  /**
   * per il gonfiore levigato, fatto una volta: punti saldati (stessa posizione) e, per ogni punto, quanto lo
   * alza ogni gruppo muscolare dopo la levigatura (la levigatura è lineare: a ogni fotogramma basta una somma)
   */
  weld?: { of: Int32Array; n: number; start: Int32Array; grp: Uint16Array; val: Float32Array; acc: Float32Array };
};

/**
 * Punti saldati e vicini per levigare il gonfiore: ogni vertice si gonfia con il muscolo sotto di lui (un gruppo
 * per vertice), e due vertici vicini su muscoli diversi si gonfiavano di quantità diverse: il bordo dell'avambraccio
 * diventava a dente di sega. Le copie dello stesso punto (cuciture delle uv) contano come uno solo.
 * La levigatura (media sui saldati, poi due passate sui vicini) è lineare nel gonfiore dei gruppi: si calcola qui,
 * gruppo per gruppo, quanto ognuno alza ogni punto; a ogni fotogramma resta una somma di 1-3 termini per punto
 * (prima erano due passate su tutti i vicini a ogni fotogramma: sul telefono qualche millisecondo ogni volta).
 */
function weldOf(m: SkinMesh, grp: Uint8Array, bg: Float32Array) {
  const of = new Int32Array(m.n);
  // chiave numerica (niente stringhe: 40 mila punti)
  const map = new Map<number, number>();
  let n = 0;
  for (let i = 0; i < m.n; i++) {
    const k = ((Math.round(m.pos[i * 3] * 4000) + 16384) * 32768 + (Math.round(m.pos[i * 3 + 1] * 4000) + 16384)) * 32768 + (Math.round(m.pos[i * 3 + 2] * 4000) + 16384);
    let g = map.get(k);
    if (g == null) {
      g = n++;
      map.set(k, g);
    }
    of[i] = g;
  }
  // vicini: lati dei triangoli del corpo, contati per punto e messi in fila (senza doppioni)
  const end = m.headStart ?? m.idx.length;
  const deg = new Int32Array(n + 1);
  const ea: number[] = [];
  for (let t = 0; t + 2 < end; t += 3) {
    const a = of[m.idx[t]], b = of[m.idx[t + 1]], c = of[m.idx[t + 2]];
    if (a !== b) ea.push(a, b, b, a);
    if (b !== c) ea.push(b, c, c, b);
    if (a !== c) ea.push(a, c, c, a);
  }
  for (let e = 0; e < ea.length; e += 2) deg[ea[e] + 1]++;
  for (let g = 0; g < n; g++) deg[g + 1] += deg[g];
  const fill = deg.slice(0, n);
  const raw = new Int32Array(ea.length / 2);
  for (let e = 0; e < ea.length; e += 2) raw[fill[ea[e]]++] = ea[e + 1];
  const start = new Int32Array(n + 1);
  const nbr = new Int32Array(raw.length);
  let o = 0;
  for (let g = 0; g < n; g++) {
    start[g] = o;
    const row = raw.subarray(deg[g], deg[g + 1]).sort();
    for (let q = 0; q < row.length; q++) if (q === 0 || row[q] !== row[q - 1]) nbr[o++] = row[q];
  }
  start[n] = o;
  // gruppo per gruppo: media sui saldati, due passate sui vicini. Solo attorno al gruppo (il gruppo e due giri di
  // vicini, dove la levigatura arriva): in tutto come una levigatura sola, non una per gruppo su tutta la pelle
  let G = 0;
  for (let i = 0; i < m.n; i++) if (grp[i] + 1 > G) G = grp[i] + 1;
  const cnt = new Float32Array(n);
  for (let i = 0; i < m.n; i++) cnt[of[i]] += 1;
  const gs0 = new Int32Array(G + 1);
  for (let i = 0; i < m.n; i++) if (bg[i] !== 0) gs0[grp[i] + 1]++;
  for (let gi = 0; gi < G; gi++) gs0[gi + 1] += gs0[gi];
  const gat = gs0.slice(0, G);
  const gv = new Int32Array(gs0[G]);
  for (let i = 0; i < m.n; i++) if (bg[i] !== 0) gv[gat[grp[i]]++] = i;
  const a0 = new Float32Array(n), t1 = new Float32Array(n), t2 = new Float32Array(n);
  const seen = new Int32Array(n);
  const list = new Int32Array(n);
  const ks: number[] = [], gs: number[] = [], vs: number[] = [];
  const pass = (src: Float32Array, dst: Float32Array, upto: number) => {
    for (let j = 0; j < upto; j++) {
      const k = list[j];
      const s0 = start[k], s1 = start[k + 1];
      if (s1 === s0) {
        dst[k] = src[k];
        continue;
      }
      let sum = 0;
      for (let q = s0; q < s1; q++) sum += src[nbr[q]];
      dst[k] = 0.5 * src[k] + (0.5 * sum) / (s1 - s0);
    }
  };
  for (let gi = 0; gi < G; gi++) {
    if (gs0[gi + 1] === gs0[gi]) continue;
    const stamp = gi + 1;
    let len = 0;
    for (let q = gs0[gi]; q < gs0[gi + 1]; q++) {
      const i = gv[q];
      const k = of[i];
      if (seen[k] !== stamp) {
        seen[k] = stamp;
        list[len++] = k;
      }
      a0[k] += bg[i];
    }
    const L0 = len;
    for (let j = 0; j < L0; j++) a0[list[j]] /= cnt[list[j]];
    for (let ring = 0; ring < 2; ring++) {
      const upto = len;
      for (let j = 0; j < upto; j++) {
        const k = list[j];
        for (let q = start[k]; q < start[k + 1]; q++) {
          const x = nbr[q];
          if (seen[x] !== stamp) {
            seen[x] = stamp;
            list[len++] = x;
          }
        }
      }
      if (ring === 0) {
        // primo giro: dove arriva la prima passata
        pass(a0, t1, len);
      }
    }
    pass(t1, t2, len);
    for (let j = 0; j < len; j++) {
      const k = list[j];
      const v = t2[k];
      if (v > 1e-7 || v < -1e-7) {
        ks.push(k);
        gs.push(gi);
        vs.push(v);
      }
      a0[k] = 0;
      t1[k] = 0;
      t2[k] = 0;
    }
  }
  // in fila per punto
  const rs = new Int32Array(n + 1);
  for (const k of ks) rs[k + 1]++;
  for (let k = 0; k < n; k++) rs[k + 1] += rs[k];
  const at = rs.slice(0, n);
  const lg = new Uint16Array(ks.length), lv = new Float32Array(ks.length);
  for (let e = 0; e < ks.length; e++) {
    const q = at[ks[e]]++;
    lg[q] = gs[e];
    lv[q] = vs[e];
  }
  return { of, n, start: rs, grp: lg, val: lv, acc: new Float32Array(n) };
}

export type SkinBody = { /** pelle mossa dai segmenti dell'atlante, come muscoli e ossa (vedi atlasSkinBones) */ atlasRig: boolean; restInv: Aff[] | null; body: SkinMesh; eyes: SkinMesh; names: string[]; heads: V3[]; parent: number[]; image: HTMLImageElement | null; eyeImage: HTMLImageElement | null; meanLuma: number; hideEyes: boolean; faceSkin: [number, number, number]; /** testa nuova (foto del viso) */ headImage: HTMLImageElement | null; headUvScale: number; /** rilievo del corpo dalle tavole (normal map nello spazio delle uv) */ reliefImage: HTMLImageElement | null; /** la stoffa è nei vertici (k.z negativo): bordo liscio dei pantaloncini */ clothV: boolean };

let bodyP: Promise<SkinBody | null> | null = null;
const img = (src: string) =>
  typeof Image === "undefined"
    ? Promise.resolve(null)
    : new Promise<HTMLImageElement | null>((res) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => res(null);
        im.src = src;
      });

export function loadSkinBody(base = "/anatomia/pelle"): Promise<SkinBody | null> {
  bodyP ??= (async () => {
    try {
      const [js, bin] = await Promise.all([fetch(`${base}.json`).then((r) => (r.ok ? (r.json() as Promise<BodyJson>) : null)), fetch(`${base}.bin`).then((r) => (r.ok ? r.arrayBuffer() : null))]);
      if (!js || !bin) return null;
      const [image, eyeImage, headImage, reliefImage] = await Promise.all([img(`${base}.jpg`), img(`${base}-occhi.jpg`), js.meshes.corpo.headStart != null ? img(`${base}-testa.jpg`) : Promise.resolve(null), js.relief ? img(`${base}-rilievo.jpg`) : Promise.resolve(null)]);
      const dec = (m: MeshJson): SkinMesh => {
        const dv = new DataView(bin);
        const st = js.stride;
        const n = m.n;
        const pos = new Float32Array(n * 3);
        const nrm = new Float32Array(n * 3);
        const uv = new Float32Array(n * 2);
        const jo = new Uint8Array(n * 4);
        const wt = new Float32Array(n * 4);
        const ex = js.extra;
        const grp = ex ? new Uint8Array(n) : null;
        const bulge = ex ? new Float32Array(n) : null;
        const k = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          k[i * 3] = 1;
          k[i * 3 + 1] = 1;
        }
        const hasD = ex?.delta != null && ex?.zone != null;
        const delta = hasD ? new Float32Array(n * 3) : null;
        const zone = hasD ? new Float32Array(n) : null;
        const zside = hasD ? new Uint8Array(n) : null;
        const nrm0 = hasD && ex?.nrm0 != null ? new Float32Array(n * 3) : null;
        for (let i = 0; i < n; i++) {
          const o = m.vOffset + i * st;
          for (let k = 0; k < 3; k++) pos[i * 3 + k] = dv.getFloat32(o + k * 4, true);
          for (let k = 0; k < 3; k++) nrm[i * 3 + k] = dv.getInt8(o + 12 + k) / 127;
          uv[i * 2] = dv.getUint16(o + 15, true) / 65535;
          uv[i * 2 + 1] = dv.getUint16(o + 17, true) / 65535;
          for (let k = 0; k < 4; k++) {
            jo[i * 4 + k] = dv.getUint8(o + 19 + k);
            wt[i * 4 + k] = dv.getUint8(o + 23 + k) / 255;
          }
          if (ex && grp && bulge) {
            grp[i] = dv.getUint8(o + ex.group);
            bulge[i] = (dv.getUint8(o + ex.bulge) / 255) * ex.bulgeScale;
            k[i * 3] = dv.getUint8(o + ex.ao) / 255;
            k[i * 3 + 1] = dv.getUint8(o + ex.paint) / 255;
            if (ex.face != null) k[i * 3 + 2] = dv.getUint8(o + ex.face) / 255;
            // stoffa nello stesso numero, in negativo (il viso è solo sulla testa, la stoffa solo sul corpo)
            if (ex.cloth != null && k[i * 3 + 2] <= 0) k[i * 3 + 2] = -dv.getUint8(o + ex.cloth) / 255;
          }
          if (ex && delta && zone && zside && ex.delta != null && ex.zone != null) {
            for (let c = 0; c < 3; c++) delta[i * 3 + c] = dv.getInt16(o + ex.delta + c * 2, true) / 1e4;
            const z = dv.getUint8(o + ex.zone);
            zside[i] = z === 0 ? 0 : z < 128 ? 1 : 2;
            zone[i] = (z & 127) / 127;
            if (nrm0 && ex.nrm0 != null) for (let c = 0; c < 3; c++) nrm0[i * 3 + c] = dv.getInt8(o + ex.nrm0 + c) / 127;
          }
        }
        return { n, pos, nrm, uv, jo, wt, grp, bulge, k, delta, zone, zside, nrm0, headStart: m.headStart ?? null, idx: new Uint16Array(bin.slice(m.iOffset, m.iOffset + m.indices * 2)) };
      };
      // luminanza media della pelle (per tenere solo luci e ombre dipinte)
      let meanLuma = 0.45;
      if (image && typeof document !== "undefined") {
        const c = document.createElement("canvas");
        c.width = 64;
        c.height = 64;
        const g = c.getContext("2d");
        if (g) {
          g.drawImage(image, 0, 0, 64, 64);
          const d = g.getImageData(0, 0, 64, 64).data;
          let s = 0;
          for (let i = 0; i < d.length; i += 4) s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
          meanLuma = s / (d.length / 4);
        }
      }
      const body = dec(js.meshes.corpo);
      const atlasRig = js.rig === "atlante" && Array.isArray(js.restInv);
      if (atlasRig) neckWaist(body, js.segments ?? []);
      return {
        atlasRig,
        restInv: atlasRig ? js.restInv!.map((a) => ({ r: a.slice(0, 9), t: [a[9], a[10], a[11]] as V3 })) : null,
        body,
        eyes: dec(js.meshes.occhi),
        names: js.joints.map((j) => j.name),
        heads: js.joints.map((j) => [j.rest[12], j.rest[13], j.rest[14]] as V3),
        parent: js.joints.map((j) => j.parent),
        image,
        eyeImage,
        meanLuma,
        hideEyes: Boolean(js.hideEyes),
        clothV: js.extra?.cloth != null,
        headImage,
        headUvScale: js.headUvScale ?? 1,
        reliefImage,
        faceSkin: (js.faceSkin?.length === 3 ? js.faceSkin : [0.41, 0.23, 0.14]) as [number, number, number],
      };
    } catch {
      return null;
    }
  })();
  return bodyP;
}

/** affine 3x4 a righe: p -> R p + t (R può avere scala) */
export type Aff = { r: number[]; t: V3 };
const affApply = (a: Aff, p: V3): V3 => [a.r[0] * p[0] + a.r[1] * p[1] + a.r[2] * p[2] + a.t[0], a.r[3] * p[0] + a.r[4] * p[1] + a.r[5] * p[2] + a.t[1], a.r[6] * p[0] + a.r[7] * p[1] + a.r[8] * p[2] + a.t[2]];
function affComp(a: Aff, b: Aff): Aff {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a.r[i * 3 + k] * b.r[k * 3 + j];
  return { r, t: affApply(a, b.t) };
}
/** matrice di segmento (colonne, come WebGL) -> affine */
function segAff(m: Float32Array, at: number): Aff {
  const o = at * 16;
  return { r: [m[o], m[o + 4], m[o + 8], m[o + 1], m[o + 5], m[o + 9], m[o + 2], m[o + 6], m[o + 10]], t: [m[o + 12], m[o + 13], m[o + 14]] };
}
function affLerp(a: Aff, b: Aff, t: number): Aff {
  return { r: a.r.map((x, i) => x * (1 - t) + b.r[i] * t), t: v3.lerp(a.t, b.t, t) };
}
/** parte di rotazione di una 3x3 (decomposizione polare, poche iterazioni: le matrici sono quasi rotazioni) */
function polarRot(m: number[]): number[] {
  let r = m.slice();
  for (let it = 0; it < 6; it++) {
    const [a, b, c, d, e, f, g, h, i] = r;
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (Math.abs(det) < 1e-12) break;
    // inversa trasposta
    const it_ = [(e * i - f * h) / det, -(d * i - f * g) / det, (d * h - e * g) / det, -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det, (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det];
    r = r.map((x, k) => 0.5 * (x + it_[k]));
  }
  return r;
}
function quatOf(r: number[]): [number, number, number, number] {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = r;
  const tr = m00 + m11 + m22;
  let q: [number, number, number, number];
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  const l = Math.hypot(...q) || 1;
  return q.map((x) => x / l) as [number, number, number, number];
}
function matOf(q: [number, number, number, number]): number[] {
  const [x, y, z, w] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}
const mul3 = (a: number[], b: number[]) => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]));
const tr3 = (a: number[]) => [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
/**
 * fra due segmenti (collo tra torace e testa, vertebre tra bacino e torace): rotazione interpolata davvero
 * (slerp) attorno al giunto. La media delle matrici, con la testa girata di 90° verso il bersaglio, rimpiccioliva
 * il collo di un terzo: sotto la testa restava una strozzatura (testa "a fungo")
 */
function affBlend(a: Aff, b: Aff, t: number, c: V3): Aff {
  const Ra = polarRot(a.r);
  const Rb = polarRot(b.r);
  const Sa = mul3(tr3(Ra), a.r);
  const Sb = mul3(tr3(Rb), b.r);
  const qa = quatOf(Ra);
  let qb = quatOf(Rb);
  let d = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3];
  if (d < 0) {
    qb = qb.map((x) => -x) as [number, number, number, number];
    d = -d;
  }
  let q: [number, number, number, number];
  if (d > 0.9995) q = qa.map((x, k) => x + (qb[k] - x) * t) as [number, number, number, number];
  else {
    const th = Math.acos(Math.min(1, d));
    const s0 = Math.sin((1 - t) * th) / Math.sin(th);
    const s1 = Math.sin(t * th) / Math.sin(th);
    q = qa.map((x, k) => x * s0 + qb[k] * s1) as [number, number, number, number];
  }
  const l = Math.hypot(...q) || 1;
  const R = matOf(q.map((x) => x / l) as [number, number, number, number]);
  const S = Sa.map((x, k) => x + (Sb[k] - x) * t);
  const r = mul3(R, S);
  const cc = v3.lerp(affApply(a, c), affApply(b, c), t);
  const rc: V3 = [r[0] * c[0] + r[1] * c[1] + r[2] * c[2], r[3] * c[0] + r[4] * c[1] + r[5] * c[2], r[6] * c[0] + r[7] * c[1] + r[8] * c[2]];
  return { r, t: v3.sub(cc, rc) };
}
function minRot(a: V3, b: V3): number[] {
  const v = v3.cross(a, b);
  const c = v3.dot(a, b);
  if (c < -0.9999) return [1, 0, 0, 0, -1, 0, 0, 0, -1];
  const k = 1 / (1 + c);
  return [v[0] * v[0] * k + c, v[0] * v[1] * k - v[2], v[0] * v[2] * k + v[1], v[1] * v[0] * k + v[2], v[1] * v[1] * k + c, v[1] * v[2] * k - v[0], v[2] * v[0] * k - v[1], v[2] * v[1] * k + v[0], v[2] * v[2] * k + c];
}

/** per ogni osso del personaggio: segmenti dell'atlante che lo muovono e messa dal riposo del personaggio a quello dell'atlante */
type Bind = { a: number; b: number; t: number; A: Aff; /** giunto tra i due segmenti (riposo dell'atlante) */ pivot?: V3 } | { hand: "L" | "R"; bone: number };
const cache = new WeakMap<BodyMeta, Bind[]>();

const FINGERS = ["thumb", "index", "middle", "ring", "pinky"];
/** indice dell'osso della mano vera (hand-rig: mano, pollice 1-3, indice 1-3, medio, anulare, mignolo) */
function rigBone(name: string): { side: "L" | "R"; bone: number } | null {
  const m = /^(hand|thumb|index|middle|ring|pinky)(?:_0(\d)(?:_leaf)?)?_([lr])$/.exec(name);
  if (!m) return null;
  const side = m[3] === "l" ? "L" : "R";
  if (m[1] === "hand") return { side, bone: 0 };
  const f = FINGERS.indexOf(m[1]);
  const k = Math.min(3, Number(m[2]));
  return { side, bone: 1 + f * 3 + (k - 1) };
}

function binds(meta: BodyMeta, sb: SkinBody): Bind[] {
  const hit = cache.get(meta);
  if (hit) return hit;
  const seg = (n: string) => meta.segments.indexOf(n);
  const r = (k: string) => meta.rest[k] as V3;
  const J = (n: string) => sb.heads[sb.names.indexOf(n)];
  // dal personaggio all'atlante: scala dall'altezza delle anche alle spalle, anche sulle anche
  const qHip = v3.lerp(J("thigh_l"), J("thigh_r"), 0.5);
  const aHip = v3.lerp(r("23"), r("24"), 0.5);
  const qSh = v3.lerp(J("upperarm_l"), J("upperarm_r"), 0.5);
  const aSh = v3.lerp(r("11"), r("12"), 0.5);
  const s = (aSh[1] - aHip[1]) / (qSh[1] - qHip[1]);
  const G: Aff = { r: [s, 0, 0, 0, s, 0, 0, 0, s], t: v3.sub(aHip, v3.mul(qHip, s)) };
  // la testa: il naso del personaggio sul naso dell'atlante
  const limb = (qh: V3, qt: V3, ah: V3, at: V3, stretch = true): Aff => {
    const gh = affApply(G, qh);
    const gt = affApply(G, qt);
    const dg = v3.norm(v3.sub(gt, gh));
    const da = v3.norm(v3.sub(at, ah));
    const k = stretch ? v3.len(v3.sub(at, ah)) / Math.max(1e-6, v3.len(v3.sub(gt, gh))) : 1;
    // allunga lungo l'osso, poi gira, con la testa dell'osso sul giunto dell'atlante
    const S = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) + (k - 1) * dg[i] * dg[j]));
    const R = minRot(dg, da);
    const RS: Aff = { r: new Array(9).fill(0), t: [0, 0, 0] };
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let q = 0; q < 3; q++) RS.r[i * 3 + j] += R[i * 3 + q] * S[q * 3 + j];
    const toH: Aff = { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: v3.mul(gh, -1) };
    const back: Aff = { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: ah };
    return affComp(back, affComp(RS, affComp(toH, G)));
  };
  const out: Bind[] = sb.names.map((name): Bind => {
    const rb = rigBone(name);
    if (rb) return { hand: rb.side, bone: rb.bone };
    const sd = name.endsWith("_l") ? "L" : name.endsWith("_r") ? "R" : "";
    const lm = sd === "L" ? { sh: "11", el: "13", wr: "15", hip: "23", kn: "25", an: "27", toe: "31" } : { sh: "12", el: "14", wr: "16", hip: "24", kn: "26", an: "28", toe: "32" };
    const one = (sgn: string, A: Aff): Bind => ({ a: seg(sgn), b: seg(sgn), t: 0, A });
    switch (name.replace(/_[lr]$/, "")) {
      case "root":
      case "pelvis":
        return one("bacino", G);
      case "spine_01":
        return { a: seg("bacino"), b: seg("torace"), t: 0.35, A: G, pivot: affApply(G, J(name)) };
      case "spine_02":
        return { a: seg("bacino"), b: seg("torace"), t: 0.8, A: G, pivot: affApply(G, J(name)) };
      case "spine_03":
        return one("torace", G);
      case "neck_01":
        return { a: seg("torace"), b: seg("testa"), t: 0.5, A: G, pivot: affApply(G, J(name)) };
      case "Head":
        return one("testa", G);
      case "clavicle":
        return one(`clav_${sd}`, limb(J(`clavicle_${sd.toLowerCase()}`), J(`upperarm_${sd.toLowerCase()}`), affApply(G, J(`clavicle_${sd.toLowerCase()}`)), r(lm.sh)));
      case "upperarm":
        return one(`omero_${sd}`, limb(J(`upperarm_${sd.toLowerCase()}`), J(`lowerarm_${sd.toLowerCase()}`), r(lm.sh), r(lm.el)));
      case "lowerarm":
        return one(`avambr_${sd}`, limb(J(`lowerarm_${sd.toLowerCase()}`), J(`hand_${sd.toLowerCase()}`), r(lm.el), r(lm.wr)));
      case "thigh":
        return one(`coscia_${sd}`, limb(J(`thigh_${sd.toLowerCase()}`), J(`calf_${sd.toLowerCase()}`), r(lm.hip), r(lm.kn)));
      case "calf":
        return one(`gamba_${sd}`, limb(J(`calf_${sd.toLowerCase()}`), J(`foot_${sd.toLowerCase()}`), r(lm.kn), r(lm.an)));
      case "foot":
      case "ball":
      case "ball_leaf": {
        const l = sd.toLowerCase();
        return one(`piede_${sd}`, limb(J(`foot_${l}`), J(`ball_${l}`), r(lm.an), v3.add(r(lm.an), v3.mul(v3.norm(v3.sub(r(lm.toe), r(lm.an))), v3.len(v3.sub(J(`ball_${l}`), J(`foot_${l}`))) * s)), false));
      }
      default:
        return one("torace", G);
    }
  });
  cache.set(meta, out);
  return out;
}

export type HandPose = { side: "L" | "R"; pl: { m: number[]; t: V3 }; bones: { r: number[]; t: V3 }[] };
/** le matrici del mondo di ogni osso del personaggio (dal suo riposo) */
export function bodyBones(meta: BodyMeta, sb: SkinBody, skinMats: Float32Array, hands: HandPose[]): Aff[] {
  const bs = binds(meta, sb);
  return bs.map((b): Aff => {
    if ("hand" in b) {
      const h = hands.find((x) => x.side === b.hand);
      if (!h) return { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
      const pl: Aff = { r: h.pl.m, t: h.pl.t };
      return b.bone === 0 ? pl : affComp(pl, h.bones[b.bone]);
    }
    const M = b.a === b.b || b.t <= 0 ? segAff(skinMats, b.a) : b.pivot ? affBlend(segAff(skinMats, b.a), segAff(skinMats, b.b), b.t, b.pivot) : affLerp(segAff(skinMats, b.a), segAff(skinMats, b.b), b.t);
    return affComp(M, b.A);
  });
}

/**
 * pelle in posa: posizioni e normali nel mondo. bul: il gonfiore di ogni gruppo muscolare (come per l'atlante):
 * la pelle sopra un muscolo che si accorcia si alza lungo la normale, quanto gli sta vicina.
 */
let flatB = new Float32Array(0);
export function skinMesh(m: SkinMesh, bones: Aff[], outP: Float32Array, outN: Float32Array, bul?: Float32Array | null, /** braccio piegato, sinistro e destro: 0 disteso, 1 gomito chiuso */ flex?: [number, number] | null) {
  // ossa in fila (3 righe da 4): sul telefono la pelle densa si muove ogni fotogramma, conta ogni accesso
  if (flatB.length < bones.length * 12) flatB = new Float32Array(bones.length * 12);
  const F = flatB;
  for (let b = 0; b < bones.length; b++) {
    const r = bones[b].r;
    const t = bones[b].t;
    const o = b * 12;
    F[o] = r[0];
    F[o + 1] = r[1];
    F[o + 2] = r[2];
    F[o + 3] = t[0];
    F[o + 4] = r[3];
    F[o + 5] = r[4];
    F[o + 6] = r[5];
    F[o + 7] = t[1];
    F[o + 8] = r[6];
    F[o + 9] = r[7];
    F[o + 10] = r[8];
    F[o + 11] = t[2];
  }
  const g = bul && m.grp && m.bulge ? m.grp : null;
  const bg = m.bulge;
  const fx = flex && m.delta && m.zone && m.zside && (flex[0] > 0 || flex[1] > 0) ? flex : null;
  const { pos, nrm, wt, jo, delta, zone, zside, nrm0 } = m;
  // gonfiore dei muscoli, già levigato: per ogni punto saldato la somma dei suoi gruppi (vedi weldOf)
  let bSmooth: Float32Array | null = null;
  let wOf: Int32Array | null = null;
  if (g) {
    const W = (m.weld ??= weldOf(m, g, bg!));
    const { acc, start, grp: lg, val } = W;
    const B = bul!;
    for (let k = 0; k < W.n; k++) {
      let sum = 0;
      for (let q = start[k], q1 = start[k + 1]; q < q1; q++) sum += B[lg[q]] * val[q];
      acc[k] = sum;
    }
    bSmooth = acc;
    wOf = W.of;
  }
  for (let i = 0; i < m.n; i++) {
    const i3 = i * 3;
    let nx = nrm[i3];
    let ny = nrm[i3 + 1];
    let nz = nrm[i3 + 2];
    const b = bSmooth && wOf ? bSmooth[wOf[i]] : 0;
    let x = pos[i3] + nx * b;
    let y = pos[i3 + 1] + ny * b;
    let z = pos[i3 + 2] + nz * b;
    if (fx && zside![i]) {
      const f = fx[zside![i] - 1] * zone![i];
      x -= delta![i3] * f;
      y -= delta![i3 + 1] * f;
      z -= delta![i3 + 2] * f;
      if (nrm0) {
        nx += (nrm0[i3] - nx) * f;
        ny += (nrm0[i3 + 1] - ny) * f;
        nz += (nrm0[i3 + 2] - nz) * f;
      }
    }
    let px = 0;
    let py = 0;
    let pz = 0;
    let qx = 0;
    let qy = 0;
    let qz = 0;
    const i4 = i * 4;
    for (let k = 0; k < 4; k++) {
      const w = wt[i4 + k];
      if (w <= 0) continue;
      const o = jo[i4 + k] * 12;
      const a0 = F[o], a1 = F[o + 1], a2 = F[o + 2];
      const b0 = F[o + 4], b1 = F[o + 5], b2 = F[o + 6];
      const c0 = F[o + 8], c1 = F[o + 9], c2 = F[o + 10];
      px += (a0 * x + a1 * y + a2 * z + F[o + 3]) * w;
      py += (b0 * x + b1 * y + b2 * z + F[o + 7]) * w;
      pz += (c0 * x + c1 * y + c2 * z + F[o + 11]) * w;
      qx += (a0 * nx + a1 * ny + a2 * nz) * w;
      qy += (b0 * nx + b1 * ny + b2 * nz) * w;
      qz += (c0 * nx + c1 * ny + c2 * nz) * w;
    }
    outP[i3] = px;
    outP[i3 + 1] = py;
    outP[i3 + 2] = pz;
    const l = 1 / (Math.sqrt(qx * qx + qy * qy + qz * qz) || 1);
    outN[i3] = qx * l;
    outN[i3 + 1] = qy * l;
    outN[i3 + 2] = qz * l;
  }
}

/**
 * Tra due segmenti la pelle gira attorno al loro giunto invece di seguire la media delle due matrici: con la
 * media, il collo si stringeva con la testa girata verso il bersaglio e, a braccio alzato in trazione, dietro il
 * braccio restava un lembo teso fino al fianco. I due pesi di una coppia diventano due ossa vicine tra le NQ
 * rotazioni interpolate davvero attorno al giunto (vedi atlasSkinBones): la pelle si piega ad arco.
 */
const NQ = 16;
/** coppie di segmenti e giunto (punto del riposo dell'atlante, o come trovarlo) */
const PAIRS: [string, string, (r: (k: string) => V3) => V3][] = [
  ["torace", "testa", (r) => v3.lerp(r("11"), r("12"), 0.5)],
  ["bacino", "torace", (r) => v3.lerp(v3.lerp(r("23"), r("24"), 0.5), v3.lerp(r("11"), r("12"), 0.5), 0.25)],
  ...(["L", "R"] as const).flatMap((sd): [string, string, (r: (k: string) => V3) => V3][] => {
    const [sh, el, hip, kn, an] = sd === "L" ? ["11", "13", "23", "25", "27"] : ["12", "14", "24", "26", "28"];
    return [
      ["torace", `clav_${sd}`, (r) => v3.lerp(r("notch"), r(sh), 0.15)],
      [`clav_${sd}`, `omero_${sd}`, (r) => r(sh)],
      [`omero_${sd}`, `avambr_${sd}`, (r) => r(el)],
      ["bacino", `coscia_${sd}`, (r) => r(hip)],
      [`coscia_${sd}`, `gamba_${sd}`, (r) => r(kn)],
      [`gamba_${sd}`, `piede_${sd}`, (r) => r(an)],
    ];
  }),
];
let pairIdx: [number, number][] = [];
function neckWaist(m: SkinMesh, segs: string[]) {
  pairIdx = PAIRS.map(([a, b]) => [segs.indexOf(a), segs.indexOf(b)]);
  const NJ = 21 + 65;
  const jo = new Uint16Array(m.jo.length);
  jo.set(m.jo);
  for (let i = 0; i < m.n; i++) {
    const o = i * 4;
    for (let p = 0; p < pairIdx.length; p++) {
      const [a, b] = pairIdx[p];
      if (a < 0 || b < 0) continue;
      let ka = -1;
      let kb = -1;
      for (let k = 0; k < 4; k++) {
        if (m.wt[o + k] <= 0) continue;
        if (jo[o + k] === a) ka = k;
        else if (jo[o + k] === b) kb = k;
      }
      if (ka < 0 || kb < 0) continue;
      const wa = m.wt[o + ka];
      const wb = m.wt[o + kb];
      const f = (wb / (wa + wb)) * NQ;
      const q = Math.min(NQ - 1, Math.floor(f));
      const u = f - q;
      // ossa q e q + 1 della coppia (0 = tutto a, NQ = tutto b)
      const bone = (k: number) => (k <= 0 ? a : k >= NQ ? b : NJ + p * (NQ - 1) + (k - 1));
      jo[o + ka] = bone(q);
      m.wt[o + ka] = (wa + wb) * (1 - u);
      jo[o + kb] = bone(q + 1);
      m.wt[o + kb] = (wa + wb) * u;
    }
  }
  m.jo = jo;
}

/**
 * Ossa della pelle vera mossa dall'atlante: i 21 segmenti con le stesse matrici di muscoli e ossa (la pelle resta
 * sopra di loro in ogni posa), le ossa del personaggio portate al riposo dell'atlante (servono solo le mani vere)
 * e le rotazioni interpolate attorno ai giunti (collo, vita, spalle, gomiti, anche, ginocchia, caviglie). Tra busto e
 * omero resta la media (la pelle dell'ascella si tende come una piega, non fa un arco).
 */
export function atlasSkinBones(meta: BodyMeta, sb: SkinBody, mats: Float32Array, hands: HandPose[]): Aff[] {
  const nSeg = 21;
  const out: Aff[] = [];
  for (let s = 0; s < nSeg; s++) out.push(s < meta.segments.length ? segAff(mats, s) : { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] });
  const qb = bodyBones(meta, sb, mats, hands);
  for (let k = 0; k < 65; k++) out.push(k < qb.length && sb.restInv?.[k] ? affComp(qb[k], sb.restInv[k]) : { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] });
  const rest = (k: string) => (meta.rest[k] ?? [0, 0, 0]) as V3;
  pairIdx.forEach(([a, b], p) => {
    const c = PAIRS[p][2](rest);
    for (let q = 1; q < NQ; q++) out.push(a >= 0 && b >= 0 ? affBlend(out[a], out[b], q / NQ, c) : out[Math.max(0, a)]);
  });
  return out;
}

let detailP: Promise<{ det: HTMLImageElement; nrm: HTMLImageElement } | null> | null = null;
/**
 * Grana della pelle (dal pacchetto pelle dell'avatar, vedi scripts/anatomia/skin_detail.py):
 * pelle-dettaglio.jpg (r luce, g ruvidità, b rossore) e pelle-normali.jpg, si ripetono sulla pelle.
 */
export function loadSkinDetail(base = "/anatomia/pelle"): Promise<{ det: HTMLImageElement; nrm: HTMLImageElement } | null> {
  detailP ??= Promise.all([img(`${base}-dettaglio.jpg`), img(`${base}-normali.jpg`)]).then(([det, nrm]) => (det && nrm ? { det, nrm } : null));
  return detailP;
}
