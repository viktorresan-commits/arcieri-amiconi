/**
 * Pelle vera della sagoma: il corpo intero del personaggio Quaternius (Universal Base Characters, CC0),
 * chiuso e con le sue ossa, mosso dagli stessi segmenti del corpo anatomico (bacino, torace, testa,
 * clavicole, braccia, gambe) e con le mani vere di hand-rig. La pelle dell'atlante anatomico ha buchi
 * sotto le ascelle e si strappa sulle spalle quando le braccia si alzano: questa no.
 * File: public/anatomia/pelle.{json,bin,jpg} e pelle-occhi.jpg (dal personaggio della prova 3D).
 */
import { v3, type V3 } from "./anatomy-model";
import type { BodyMeta } from "./anatomy-body";

type MeshJson = { n: number; vOffset: number; iOffset: number; indices: number };
type BodyJson = { stride: number; meshes: { corpo: MeshJson; occhi: MeshJson }; joints: { name: string; parent: number; rest: number[] }[]; /** byte in più per vertice (scripts/anatomia/wrap_skin.py) */ extra?: { group: number; bulge: number; ao: number; paint: number; bulgeScale: number; delta?: number; zone?: number; nrm0?: number } };
export type SkinMesh = {
  n: number;
  pos: Float32Array;
  nrm: Float32Array;
  uv: Float32Array;
  jo: Uint8Array;
  wt: Float32Array;
  idx: Uint16Array;
  /** muscolo sotto la pelle (gruppo dell'atlante) e quanto la pelle si gonfia con lui (metri per metro) */
  grp: Uint8Array | null;
  bulge: Float32Array | null;
  /** occlusione (0..1, 1 = all'aperto) e quanto conta il chiaroscuro dipinto, a coppie */
  k: Float32Array;
  /** braccio piegato: quanto della forma dell'atlante si toglie (a gomito chiuso) e da che lato (1 sinistro, 2 destro) */
  delta: Float32Array | null;
  zone: Float32Array | null;
  zside: Uint8Array | null;
  /** normali della forma del personaggio (braccio piegato) */
  nrm0: Float32Array | null;
};
export type SkinBody = { body: SkinMesh; eyes: SkinMesh; names: string[]; heads: V3[]; parent: number[]; image: HTMLImageElement | null; eyeImage: HTMLImageElement | null; meanLuma: number };

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
      const [image, eyeImage] = await Promise.all([img(`${base}.jpg`), img(`${base}-occhi.jpg`)]);
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
        const k = new Float32Array(n * 2).fill(1);
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
            k[i * 2] = dv.getUint8(o + ex.ao) / 255;
            k[i * 2 + 1] = dv.getUint8(o + ex.paint) / 255;
          }
          if (ex && delta && zone && zside && ex.delta != null && ex.zone != null) {
            for (let c = 0; c < 3; c++) delta[i * 3 + c] = dv.getInt16(o + ex.delta + c * 2, true) / 1e4;
            const z = dv.getUint8(o + ex.zone);
            zside[i] = z === 0 ? 0 : z < 128 ? 1 : 2;
            zone[i] = (z & 127) / 127;
            if (nrm0 && ex.nrm0 != null) for (let c = 0; c < 3; c++) nrm0[i * 3 + c] = dv.getInt8(o + ex.nrm0 + c) / 127;
          }
        }
        return { n, pos, nrm, uv, jo, wt, grp, bulge, k, delta, zone, zside, nrm0, idx: new Uint16Array(bin.slice(m.iOffset, m.iOffset + m.indices * 2)) };
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
      return {
        body: dec(js.meshes.corpo),
        eyes: dec(js.meshes.occhi),
        names: js.joints.map((j) => j.name),
        heads: js.joints.map((j) => [j.rest[12], j.rest[13], j.rest[14]] as V3),
        parent: js.joints.map((j) => j.parent),
        image,
        eyeImage,
        meanLuma,
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
function minRot(a: V3, b: V3): number[] {
  const v = v3.cross(a, b);
  const c = v3.dot(a, b);
  if (c < -0.9999) return [1, 0, 0, 0, -1, 0, 0, 0, -1];
  const k = 1 / (1 + c);
  return [v[0] * v[0] * k + c, v[0] * v[1] * k - v[2], v[0] * v[2] * k + v[1], v[1] * v[0] * k + v[2], v[1] * v[1] * k + c, v[1] * v[2] * k - v[0], v[2] * v[0] * k - v[1], v[2] * v[1] * k + v[0], v[2] * v[2] * k + c];
}

/** per ogni osso del personaggio: segmenti dell'atlante che lo muovono e messa dal riposo del personaggio a quello dell'atlante */
type Bind = { a: number; b: number; t: number; A: Aff } | { hand: "L" | "R"; bone: number };
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
        return { a: seg("bacino"), b: seg("torace"), t: 0.35, A: G };
      case "spine_02":
        return { a: seg("bacino"), b: seg("torace"), t: 0.8, A: G };
      case "spine_03":
        return one("torace", G);
      case "neck_01":
        return { a: seg("torace"), b: seg("testa"), t: 0.5, A: G };
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
    const M = b.a === b.b || b.t <= 0 ? segAff(skinMats, b.a) : affLerp(segAff(skinMats, b.a), segAff(skinMats, b.b), b.t);
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
  for (let i = 0; i < m.n; i++) {
    const i3 = i * 3;
    let nx = nrm[i3];
    let ny = nrm[i3 + 1];
    let nz = nrm[i3 + 2];
    const b = g ? bul![g[i]] * bg![i] : 0;
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

let detailP: Promise<{ det: HTMLImageElement; nrm: HTMLImageElement } | null> | null = null;
/**
 * Grana della pelle (dal pacchetto pelle dell'avatar, vedi scripts/anatomia/skin_detail.py):
 * pelle-dettaglio.jpg (r luce, g ruvidità, b rossore) e pelle-normali.jpg, si ripetono sulla pelle.
 */
export function loadSkinDetail(base = "/anatomia/pelle"): Promise<{ det: HTMLImageElement; nrm: HTMLImageElement } | null> {
  detailP ??= Promise.all([img(`${base}-dettaglio.jpg`), img(`${base}-normali.jpg`)]).then(([det, nrm]) => (det && nrm ? { det, nrm } : null));
  return detailP;
}
