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
type BodyJson = { stride: number; meshes: { corpo: MeshJson; occhi: MeshJson }; joints: { name: string; parent: number; rest: number[] }[] };
export type SkinMesh = { n: number; pos: Float32Array; nrm: Float32Array; uv: Float32Array; jo: Uint8Array; wt: Float32Array; idx: Uint16Array };
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
        }
        return { n, pos, nrm, uv, jo, wt, idx: new Uint16Array(bin.slice(m.iOffset, m.iOffset + m.indices * 2)) };
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

/** pelle in posa: posizioni e normali nel mondo */
export function skinMesh(m: SkinMesh, bones: Aff[], outP: Float32Array, outN: Float32Array) {
  for (let i = 0; i < m.n; i++) {
    const x = m.pos[i * 3];
    const y = m.pos[i * 3 + 1];
    const z = m.pos[i * 3 + 2];
    const nx = m.nrm[i * 3];
    const ny = m.nrm[i * 3 + 1];
    const nz = m.nrm[i * 3 + 2];
    let px = 0;
    let py = 0;
    let pz = 0;
    let qx = 0;
    let qy = 0;
    let qz = 0;
    for (let k = 0; k < 4; k++) {
      const w = m.wt[i * 4 + k];
      if (w <= 0) continue;
      const B = bones[m.jo[i * 4 + k]];
      const r = B.r;
      px += (r[0] * x + r[1] * y + r[2] * z + B.t[0]) * w;
      py += (r[3] * x + r[4] * y + r[5] * z + B.t[1]) * w;
      pz += (r[6] * x + r[7] * y + r[8] * z + B.t[2]) * w;
      qx += (r[0] * nx + r[1] * ny + r[2] * nz) * w;
      qy += (r[3] * nx + r[4] * ny + r[5] * nz) * w;
      qz += (r[6] * nx + r[7] * ny + r[8] * nz) * w;
    }
    outP[i * 3] = px;
    outP[i * 3 + 1] = py;
    outP[i * 3 + 2] = pz;
    const l = Math.hypot(qx, qy, qz) || 1;
    outN[i * 3] = qx / l;
    outN[i * 3 + 1] = qy / l;
    outN[i * 3 + 2] = qz / l;
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
