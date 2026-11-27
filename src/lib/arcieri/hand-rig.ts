/**
 * Mani vere per la sagoma: la mesh delle mani del personaggio Quaternius (Universal Base Characters, CC0)
 * con le sue ossa (pollice e quattro dita a tre falangi), piegate qui una per una e messe sull'attrezzo
 * come insegna il Manuale FITA del principiante:
 * - mano dell'arco: la «V» tra pollice e indice al centro dell'impugnatura, la spinta sul cuscinetto del
 *   pollice, dita rilassate e appena piegate attorno all'impugnatura, pollice morbido in avanti;
 * - mano della corda (pinza mediterranea): indice sopra la cocca, medio e anulare sotto, corda nella piega
 *   della prima falange, dorso della mano piatto e verticale nel piano della freccia.
 * Tutto in metri. File: public/anatomia/mani.{json,bin,jpg} (estratti dal personaggio della prova 3D).
 */
import { v3, type V3 } from "./anatomy-model";

const { add, sub, mul, dot, cross, len, norm } = v3;

export type HandSide = "L" | "R";
type RigJson = {
  stride: number;
  texture: { w: number; h: number; meanLuma: number };
  sides: Record<HandSide, { bones: string[]; tips: string[]; parent: number[]; rest: number[][]; n: number; vOffset: number; iOffset: number; indices: number }>;
};
export type RigHand = {
  side: HandSide;
  n: number;
  pos: Float32Array;
  nrm: Float32Array;
  uv: Float32Array;
  jo: Uint8Array;
  wt: Float32Array;
  idx: Uint16Array;
  /** teste delle 16 ossa (mano, pollice 1-3, indice 1-3, medio 1-3, anulare 1-3, mignolo 1-3) e 5 punte */
  heads: V3[];
  tips: V3[];
  /** a riposo: polso, nocca del medio, verso delle dita, verso dell'indice, verso del palmo */
  W: V3;
  K: V3;
  F: V3;
  X: V3;
  N: V3;
  /** assi di piega: quattro dita (indice..mignolo), pollice; verso dell'allargamento (verso l'indice) */
  flexAx: V3[];
  spreadAx: V3;
  thumbAx: V3;
  thumbOpp: V3;
};
export type HandRig = { L: RigHand; R: RigHand; image: HTMLImageElement | null; meanLuma: number };

let rigP: Promise<HandRig | null> | null = null;
/** carica le mani (una volta sola) */
export function loadHandRig(base = "/anatomia/mani"): Promise<HandRig | null> {
  rigP ??= (async () => {
    try {
      const [js, bin] = await Promise.all([fetch(`${base}.json`).then((r) => (r.ok ? (r.json() as Promise<RigJson>) : null)), fetch(`${base}.bin`).then((r) => (r.ok ? r.arrayBuffer() : null))]);
      if (!js || !bin) return null;
      const image = typeof Image === "undefined" ? null : await new Promise<HTMLImageElement | null>((res) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => res(null);
        im.src = `${base}.jpg`;
      });
      return { L: decode(js, bin, "L"), R: decode(js, bin, "R"), image, meanLuma: js.texture.meanLuma };
    } catch {
      return null;
    }
  })();
  return rigP;
}

function decode(js: RigJson, buf: ArrayBuffer, side: HandSide): RigHand {
  const s = js.sides[side];
  const dv = new DataView(buf);
  const st = js.stride;
  const n = s.n;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const jo = new Uint8Array(n * 4);
  const wt = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const o = s.vOffset + i * st;
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = dv.getFloat32(o + k * 4, true);
    for (let k = 0; k < 3; k++) nrm[i * 3 + k] = dv.getInt8(o + 12 + k) / 127;
    uv[i * 2] = dv.getUint16(o + 15, true) / 65535;
    uv[i * 2 + 1] = dv.getUint16(o + 17, true) / 65535;
    for (let k = 0; k < 4; k++) {
      jo[i * 4 + k] = dv.getUint8(o + 19 + k);
      wt[i * 4 + k] = dv.getUint8(o + 23 + k) / 255;
    }
  }
  const idx = new Uint16Array(buf.slice(s.iOffset, s.iOffset + s.indices * 2));
  const head = (m: number[]): V3 => [m[12], m[13], m[14]];
  const heads = s.rest.slice(0, 16).map(head);
  const tips = s.rest.slice(16, 21).map(head);
  const W = heads[0];
  const K = heads[7];
  const F = norm(sub(K, W));
  const xr = sub(heads[4], heads[13]);
  const X = norm(sub(xr, mul(F, dot(xr, F))));
  // verso il palmo: il pollice sta dalla parte del palmo
  let N = norm(cross(F, X));
  if (dot(sub(tips[0], W), N) < 0) N = mul(N, -1);
  const flexAx = [4, 7, 10, 13].map((b) => norm(cross(norm(sub(heads[b + 1], heads[b])), N)));
  const sgn = dot(cross(N, F), X) >= 0 ? 1 : -1;
  const spreadAx = mul(N, sgn);
  const td = norm(sub(heads[2], heads[1]));
  const thumbAx = norm(cross(td, N));
  // opposizione: girare il pollice attorno all'asse della mano verso il palmo
  const t0 = sub(tips[0], heads[1]);
  const tryRot = rotAbout(t0, F, 0.3);
  const thumbOpp = dot(tryRot, N) > dot(t0, N) ? F : mul(F, -1);
  return { side, n, pos, nrm, uv, jo, wt, idx, heads, tips, W, K, F, X, N, flexAx, spreadAx, thumbAx, thumbOpp };
}

function rotAbout(v: V3, ax: V3, a: number): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return add(add(mul(v, c), mul(cross(ax, v), s)), mul(ax, dot(ax, v) * (1 - c)));
}

/** trasformazione rigida 3x4 (righe di rotazione + traslazione), applicata come p -> R p + t */
type Xf = { r: number[]; t: V3 };
const IDT: Xf = { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
function rotXf(at: V3, ax: V3, a: number): Xf {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const [x, y, z] = ax;
  const C = 1 - c;
  const r = [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
  const p = at;
  const rp: V3 = [r[0] * p[0] + r[1] * p[1] + r[2] * p[2], r[3] * p[0] + r[4] * p[1] + r[5] * p[2], r[6] * p[0] + r[7] * p[1] + r[8] * p[2]];
  return { r, t: sub(p, rp) };
}
/** a ∘ b: prima b, poi a */
function comp(a: Xf, b: Xf): Xf {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a.r[i * 3] * b.r[j] + a.r[i * 3 + 1] * b.r[3 + j] + a.r[i * 3 + 2] * b.r[6 + j];
  return { r, t: app(a, b.t) };
}
function app(x: Xf, p: V3): V3 {
  return [x.r[0] * p[0] + x.r[1] * p[1] + x.r[2] * p[2] + x.t[0], x.r[3] * p[0] + x.r[4] * p[1] + x.r[5] * p[2] + x.t[1], x.r[6] * p[0] + x.r[7] * p[1] + x.r[8] * p[2] + x.t[2]];
}
function appR(x: Xf, p: V3): V3 {
  return [x.r[0] * p[0] + x.r[1] * p[1] + x.r[2] * p[2], x.r[3] * p[0] + x.r[4] * p[1] + x.r[5] * p[2], x.r[6] * p[0] + x.r[7] * p[1] + x.r[8] * p[2]];
}

/**
 * Piega delle dita in gradi: per indice, medio, anulare, mignolo [nocca, seconda, terza falange, apertura
 * verso l'indice]; pollice [opposizione, base, seconda, terza].
 */
export type FingerPose = { fingers: [number, number, number, number][]; thumb: [number, number, number, number] };
const D = Math.PI / 180;

/** le 16 trasformazioni delle ossa (nello spazio della mano a riposo) per una posa */
export function poseBones(h: RigHand, pose: FingerPose): Xf[] {
  const out: Xf[] = new Array(16).fill(IDT);
  const H = h.heads;
  pose.fingers.forEach(([a1, a2, a3, sp], f) => {
    const b = 4 + f * 3;
    const ax = h.flexAx[f];
    const s1 = comp(rotXf(H[b], ax, a1 * D), rotXf(H[b], h.spreadAx, sp * D));
    const s2 = comp(s1, rotXf(H[b + 1], ax, a2 * D));
    const s3 = comp(s2, rotXf(H[b + 2], ax, a3 * D));
    out[b] = s1;
    out[b + 1] = s2;
    out[b + 2] = s3;
  });
  const [o, t1, t2, t3] = pose.thumb;
  const s1 = comp(rotXf(H[1], h.thumbOpp, o * D), rotXf(H[1], h.thumbAx, t1 * D));
  const s2 = comp(s1, rotXf(H[2], h.thumbAx, t2 * D));
  const s3 = comp(s2, rotXf(H[3], h.thumbAx, t3 * D));
  out[1] = s1;
  out[2] = s2;
  out[3] = s3;
  return out;
}

/** punti della mano in posa (spazio a riposo): punte, articolazioni e pieghe delle dita */
export function posedPoints(h: RigHand, bones: Xf[]) {
  const tip = (f: number) => app(bones[f === 0 ? 3 : 3 + f * 3], h.tips[f]);
  const joint = (b: number) => app(bones[b], h.heads[b]);
  // piega della prima falange (palmo, sopra l'articolazione distale): metà dello spessore del dito
  const crease = (f: number) => {
    const b = 3 + f * 3;
    return app(bones[b], add(h.heads[b], mul(h.N, 0.0075)));
  };
  return { tip, joint, crease };
}

export type Placement = { m: number[]; t: V3 };
/** pelle della mano in posa e messa nel mondo: posizioni e normali (Float32Array da n*3) */
export function skinHand(h: RigHand, bones: Xf[], pl: Placement, outP: Float32Array, outN: Float32Array) {
  const { m, t } = pl;
  for (let i = 0; i < h.n; i++) {
    const p: V3 = [h.pos[i * 3], h.pos[i * 3 + 1], h.pos[i * 3 + 2]];
    const nn: V3 = [h.nrm[i * 3], h.nrm[i * 3 + 1], h.nrm[i * 3 + 2]];
    let q: V3 = [0, 0, 0];
    let qn: V3 = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const w = h.wt[i * 4 + k];
      if (w <= 0) continue;
      const b = bones[h.jo[i * 4 + k]];
      q = add(q, mul(app(b, p), w));
      qn = add(qn, mul(appR(b, nn), w));
    }
    for (let k = 0; k < 3; k++) {
      outP[i * 3 + k] = m[k * 3] * q[0] + m[k * 3 + 1] * q[1] + m[k * 3 + 2] * q[2] + t[k];
      outN[i * 3 + k] = m[k * 3] * qn[0] + m[k * 3 + 1] * qn[1] + m[k * 3 + 2] * qn[2];
    }
  }
}

/**
 * Dal riposo alla posa voluta: Ft verso delle dita (polso -> nocca del medio), Nt verso del palmo, scala s;
 * il punto a (spazio a riposo, già in posa) va in A. L'indice sta dalla sua parte: mano destra e sinistra
 * sono una lo specchio dell'altra, la terna lo rispetta da sé.
 */
export function placeBy(h: RigHand, Ft: V3, Nt: V3, s: number, a: V3, A: V3): Placement {
  const F = norm(Ft);
  const N = norm(sub(Nt, mul(F, dot(Nt, F))));
  const handed = dot(cross(h.F, h.X), h.N) >= 0 ? 1 : -1;
  const X = mul(cross(N, F), handed);
  // R = T Q^T con Q = [F X N] a riposo
  const Q = [h.F, h.X, h.N];
  const T = [F, X, N];
  const m = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) m[i * 3 + j] += T[k][i] * Q[k][j] * s;
  const ra: V3 = [m[0] * a[0] + m[1] * a[1] + m[2] * a[2], m[3] * a[0] + m[4] * a[1] + m[5] * a[2], m[6] * a[0] + m[7] * a[1] + m[8] * a[2]];
  return { m, t: sub(A, ra) };
}
/**
 * Rotazione (con scala s) che porta il verso a (spazio a riposo) su A e il verso b, per la parte
 * perpendicolare, su B; il punto p (a riposo, in posa) va in P.
 */
export function placeAlign(a: V3, b: V3, A: V3, B: V3, s: number, p: V3, P: V3): Placement {
  const r1 = norm(a);
  const r3 = norm(sub(b, mul(r1, dot(b, r1))));
  const r2 = cross(r3, r1);
  const t1 = norm(A);
  const t3 = norm(sub(B, mul(t1, dot(B, t1))));
  const t2 = cross(t3, t1);
  const Q = [r1, r2, r3];
  const T = [t1, t2, t3];
  const m = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) m[i * 3 + j] += T[k][i] * Q[k][j] * s;
  const rp: V3 = [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];
  return { m, t: sub(P, rp) };
}

export function placeApply(pl: Placement, p: V3): V3 {
  const m = pl.m;
  return [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + pl.t[0], m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + pl.t[1], m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + pl.t[2]];
}

/** terna ortonormale da un verso principale e uno secondario */
export function triad(f: V3, x: V3): [V3, V3] {
  const F = norm(f);
  const X = norm(sub(x, mul(F, dot(x, F))));
  return [F, X];
}

/** lunghezza a riposo dal polso alla nocca del medio (per la scala) */
export function handLength(h: RigHand) {
  return len(sub(h.K, h.W));
}

export { rotAbout };

/** pose delle dita (gradi) */
export const POSES = {
  /** mano dell'arco: dita rilassate attorno all'impugnatura, pollice morbido in avanti */
  bow: { fingers: [[40, 55, 25, 2], [48, 60, 28, 0], [54, 62, 28, -2], [60, 62, 28, -4]], thumb: [25, 5, 10, 8] } as FingerPose,
  /** pinza mediterranea: tre dita agganciate alla prima falange, mignolo raccolto, pollice rilassato */
  hook: { fingers: [[14, 82, 48, 7], [14, 86, 48, -2], [18, 86, 48, -5], [55, 95, 60, -8]], thumb: [30, 18, 22, 20] } as FingerPose,
  /** mano libera, rilassata */
  free: { fingers: [[14, 22, 12, 2], [16, 26, 12, 0], [18, 28, 12, -2], [22, 30, 14, -4]], thumb: [10, 6, 8, 8] } as FingerPose,
};

/**
 * Messa a punto delle prese. Mano dell'arco nel sistema del riser (x lato mensola, y su, z verso il
 * bersaglio), cercata contro il riser vero del Samik (harness gripfit): nessun punto della mano dentro il
 * legno, dita che scendono davanti all'impugnatura, «V» nella gola dietro, pollice avanti dal lato interno.
 */
export const GRIP_TUNE = {
  /** piega delle dita dell'arco rispetto alla posa (1 = POSES.bow) */
  bowCurl: 0.7,
  /** dita girate dal bersaglio verso il lato della mensola */
  bowAlpha: 40,
  /** nocche: la mano gira nel suo piano */
  bowRoll: 15,
  /** polso: attorno alla fila delle nocche */
  bowPitch: -20,
  /** dove sta la «V» tra pollice e indice (metri, sistema del riser) */
  bowV: [0.01, 0.045, -0.012] as V3,
  drawRoll: 0,
  drawPitch: 0,
  /** di quanto stanno sotto la cocca le pieghe delle tre dita in media (indice sopra, medio e anulare sotto) */
  drawCrease: -0.009,
};
function tune() {
  const g = (globalThis as unknown as { __gripTune?: Partial<typeof GRIP_TUNE> }).__gripTune;
  return g ? { ...GRIP_TUNE, ...g } : GRIP_TUNE;
}
const DEG = Math.PI / 180;

export type RiserFrame = { o: V3; x: V3; y: V3; z: V3 };
/** posa e messa della mano sinistra nel sistema del riser (la destra è il suo specchio) */
function bowPose(): FingerPose {
  const T = tune();
  return { fingers: POSES.bow.fingers.map(([a, b, c, d]) => [a * T.bowCurl, b * T.bowCurl, c * T.bowCurl, d] as [number, number, number, number]), thumb: POSES.bow.thumb };
}
function bowLocal(h: RigHand) {
  const T = tune();
  const bones = poseBones(h, bowPose());
  const pts = posedPoints(h, bones);
  const V = mul(add(pts.joint(2), pts.joint(4)), 0.5);
  const a = T.bowAlpha * DEG;
  const fwd: V3 = [0, 0, 1];
  const side: V3 = [1, 0, 0];
  let F = add(mul(fwd, Math.cos(a)), mul(side, Math.sin(a)));
  let N = sub(mul(fwd, Math.sin(a)), mul(side, Math.cos(a)));
  F = rotAbout(F, N, T.bowRoll * DEG);
  const X = norm(cross(N, F));
  F = rotAbout(F, X, T.bowPitch * DEG);
  N = rotAbout(N, X, T.bowPitch * DEG);
  return { bones, pl: placeBy(h, F, N, 1, V, T.bowV) };
}

/**
 * Mano dell'arco sull'impugnatura, come nel manuale: la «V» tra pollice e indice nella gola
 * dell'impugnatura, la spinta sul cuscinetto del pollice, dita rilassate e appena piegate davanti
 * all'impugnatura, pollice morbido in avanti. r: frame del riser (x lato mensola, già a specchio per i
 * mancini; y con la scala dell'arco).
 */
export function bowGrip(rig: { L: RigHand; R: RigHand }, side: HandSide, r: RiserFrame, s: number) {
  // la mano destra si piega come la sinistra: si calcola la sinistra e si specchia (x della mano a riposo)
  const T = tune();
  const loc = bowLocal(rig.L);
  const h = rig[side];
  const bones = side === "L" ? loc.bones : poseBones(h, bowPose());
  const mq = side === "L" ? [1, 1, 1] : [-1, 1, 1];
  const cols = [norm(r.x), norm(r.y), norm(r.z)];
  const m = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let v = 0;
      for (let k = 0; k < 3; k++) v += cols[k][i] * loc.pl.m[k * 3 + j];
      m[i * 3 + j] = v * mq[j] * s;
    }
  // la «V» nella gola dell'impugnatura (con la scala dell'arco in altezza)
  const pts = posedPoints(h, bones);
  const V = mul(add(pts.joint(2), pts.joint(4)), 0.5);
  const At = add(r.o, add(mul(r.x, T.bowV[0]), add(mul(r.y, T.bowV[1]), mul(r.z, T.bowV[2]))));
  const mv: V3 = [m[0] * V[0] + m[1] * V[1] + m[2] * V[2], m[3] * V[0] + m[4] * V[1] + m[5] * V[2], m[6] * V[0] + m[7] * V[1] + m[8] * V[2]];
  return { bones, pl: { m, t: sub(At, mv) } as Placement };
}

export type NockFrame = { o: V3; fwd: V3; up: V3; out: V3 };
/**
 * Mano della corda alla cocca, pinza mediterranea: dita avanti lungo l'avambraccio (dal gomito alla
 * cocca), palmo verso il viso, dorso piatto e verticale; le pieghe delle tre dita sulla corda.
 */
export function drawHook(h: RigHand, f: NockFrame, s: number, mir: 1 | -1, elbow: V3) {
  const T = tune();
  const bones = poseBones(h, POSES.hook);
  const pts = posedPoints(h, bones);
  let F = norm(sub(f.o, elbow));
  if (dot(F, f.fwd) < 0.3) F = f.fwd;
  F = rotAbout(F, f.out, T.drawPitch * DEG);
  let N = mul(f.out, -1);
  N = norm(sub(N, mul(F, dot(N, F))));
  N = rotAbout(N, F, T.drawRoll * mir * DEG);
  const c = mul(add(add(pts.crease(1), pts.crease(2)), pts.crease(3)), 1 / 3);
  return { bones, pl: placeBy(h, F, N, s, c, add(f.o, mul(f.up, T.drawCrease))), pts };
}

/** mano libera: dove la mette la sagoma (polso, verso delle dita e del palmo) */
export function freeHand(h: RigHand, W: V3, F: V3, N: V3, s: number, pose: keyof typeof POSES = "free") {
  const bones = poseBones(h, POSES[pose]);
  return { bones, pl: placeBy(h, F, N, s, h.W, W) };
}
