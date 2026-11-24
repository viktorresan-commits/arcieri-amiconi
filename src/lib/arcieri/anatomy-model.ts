/**
 * Modello anatomico 3D dai 33 punti della posa: pelle traslucida, scheletro e muscoli al lavoro,
 * più arco, corda e freccia ricostruiti dalle mani. Tutto in metri, piedi a terra (y = 0),
 * x verso destra dell'immagine, z verso la fotocamera. Le parti sono ellissoidi e anelli: il
 * renderer (anatomy-3d) disegna ogni parte con una matrice.
 */
import { metricsOf, sides, type Hand, type Landmark } from "./pose-analysis";
import { archeryKit } from "./pose-kit";

export type V3 = [number, number, number];
export type Mode = 0 | 1 | 2 | 3; // 0 pelle (bordo luminoso), 1 osso, 2 muscolo, 3 materiale semplice
export type Part = { mesh: "sphere" | "torus"; m: Float32Array; nm: Float32Array; color: V3; mode: Mode; alpha: number; act: number; layer: "pelle" | "osso" | "muscolo" | "arco" };
export type Hud = {
  pts: Record<string, V3>;
  labels: { at: V3; text: string; tone: "cyan" | "gold" | "warn" }[];
  arcs: { at: V3; a: V3; b: V3; deg: number }[];
  dims: { a: V3; b: V3; text: string }[];
  feet: V3;
};
export type Model = { parts: Part[]; hud: Hud; center: V3; height: number };

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const angleAt = (a: V3, o: V3, b: V3) => {
  const u = norm(sub(a, o));
  const v = norm(sub(b, o));
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI;
};
export const v3 = { add, sub, mul, dot, cross, len, norm, lerp };

/** matrice da centro e tre assi ortonormali con i rispettivi raggi; normale = assi / raggi */
function place(c: V3, ax: V3, ay: V3, az: V3, rx: number, ry: number, rz: number) {
  const m = new Float32Array([ax[0] * rx, ax[1] * rx, ax[2] * rx, 0, ay[0] * ry, ay[1] * ry, ay[2] * ry, 0, az[0] * rz, az[1] * rz, az[2] * rz, 0, c[0], c[1], c[2], 1]);
  const nm = new Float32Array([ax[0] / rx, ax[1] / rx, ax[2] / rx, ay[0] / ry, ay[1] / ry, ay[2] / ry, az[0] / rz, az[1] / rz, az[2] / rz]);
  return { m, nm };
}

/** asse perpendicolare a `ay` il più vicino possibile a `hint` */
function perp(ay: V3, hint: V3): V3 {
  let x = sub(hint, mul(ay, dot(hint, ay)));
  if (len(x) < 1e-4) x = sub([0, 0, 1], mul(ay, ay[2]));
  if (len(x) < 1e-4) x = [1, 0, 0];
  return norm(x);
}

const vis = (p: Landmark | undefined) => (p ? (p.visibility ?? 1) : 0);

/** punti della posa in metri; gambe e anche ricostruite se fuori dall'inquadratura */
export function bodyPoints(lm: Landmark[], aspect: number): Record<number, V3> | null {
  if (!lm || lm.length < 25) return null;
  if (![11, 12, 13, 14, 15, 16].every((i) => vis(lm[i]) > 0.2)) return null;
  const P = (i: number) => ({ x: lm[i].x * aspect, y: lm[i].y, z: (lm[i].z ?? 0) * aspect });
  const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const shM = { x: (P(11).x + P(12).x) / 2, y: (P(11).y + P(12).y) / 2 };
  const hipsOk = vis(lm[23]) > 0.35 && vis(lm[24]) > 0.35 && lm[23].y < 1.05 && lm[24].y < 1.05;
  const anklesOk = lm.length > 28 && vis(lm[27]) > 0.45 && vis(lm[28]) > 0.45 && lm[27].y < 1.0 && lm[28].y < 1.0;
  // unità d'immagine per metro: spalle, busto e corpo intero, la mediana
  const est: number[] = [d2(P(11), P(12)) / 0.36];
  if (hipsOk) est.push(d2(shM, { x: (P(23).x + P(24).x) / 2, y: (P(23).y + P(24).y) / 2 }) / 0.5);
  if (hipsOk && anklesOk) est.push((Math.max(P(27).y, P(28).y) - shM.y) / 1.36);
  est.sort((a, b) => a - b);
  const s = est[Math.floor(est.length / 2)] || 1;
  const hipY = hipsOk ? (P(23).y + P(24).y) / 2 : shM.y + 0.5 * s;
  const floorY = anklesOk ? Math.max(P(27).y, P(28).y) + 0.075 * s : hipY + 0.93 * s;
  const cx = shM.x;
  const cz = (P(11).z + P(12).z) / 2;
  const W = (i: number): V3 => [(P(i).x - cx) / s, (floorY - P(i).y) / s, (-(P(i).z - cz) / s) * 0.6];
  const out: Record<number, V3> = {};
  for (let i = 0; i < Math.min(33, lm.length); i++) out[i] = W(i);
  if (!hipsOk) {
    out[23] = add(out[11], [0.02, -0.5, 0]);
    out[24] = add(out[12], [-0.02, -0.5, 0]);
    out[23][0] = out[11][0] * 0.6;
    out[24][0] = out[12][0] * 0.6;
  }
  if (!anklesOk) {
    // in piedi, piedi alla larghezza delle spalle
    for (const [hip, knee, ank, heel, toe] of [[23, 25, 27, 29, 31], [24, 26, 28, 30, 32]] as const) {
      const h = out[hip];
      out[knee] = [h[0] * 1.15, 0.5, h[2] + 0.02];
      out[ank] = [h[0] * 1.3, 0.08, h[2]];
      out[heel] = [h[0] * 1.3, 0.03, h[2] - 0.06];
      out[toe] = [h[0] * 1.3, 0.02, h[2] + 0.16];
    }
  }
  for (const i of [29, 30, 31, 32]) if (!out[i] || vis(lm[i]) < 0.3) out[i] = i < 31 ? add(out[i - 2], [0, -0.05, -0.05]) : add(out[i - 4], [0, -0.06, 0.15]);
  return out;
}

const SKIN: V3 = [0.33, 0.74, 1.0];
const BONE: V3 = [0.86, 0.95, 1.0];
const WOOD: V3 = [0.62, 0.36, 0.17];

/** muscolo: dal rosso scuro a riposo all'arancio acceso quando lavora */
const muscleCol = (a: number): V3 => [0.62 + 0.38 * a, 0.2 + 0.26 * a, 0.17 + 0.08 * a];

export function buildModel(lm: Landmark[], aspect: number, hand: Hand): Model | null {
  const J = bodyPoints(lm, aspect);
  if (!J) return null;
  const S = sides(hand);
  const parts: Part[] = [];
  const push = (mesh: Part["mesh"], pl: { m: Float32Array; nm: Float32Array }, color: V3, mode: Mode, alpha: number, layer: Part["layer"], act = 0) =>
    parts.push({ mesh, m: pl.m, nm: pl.nm, color, mode, alpha, act, layer });

  const shL = J[11], shR = J[12], hipL = J[23], hipR = J[24];
  const shM = lerp(shL, shR, 0.5);
  const hipM = lerp(hipL, hipR, 0.5);
  const up = norm(sub(shM, hipM));
  const right = perp(up, sub(shR, shL));
  let fwd = norm(cross(right, up));
  // il davanti è dove guarda il naso
  if (dot(sub(J[0], lerp(J[7], J[8], 0.5)), fwd) < 0) fwd = mul(fwd, -1);
  const shW = len(sub(shR, shL));
  const hipW = len(sub(hipR, hipL));

  const seg = (a: V3, b: V3, r: number, rz = r, ext = 1.08, hint: V3 = fwd) => {
    const ay = norm(sub(b, a));
    const ax = perp(ay, hint);
    const az = norm(cross(ax, ay));
    return place(lerp(a, b, 0.5), ax, ay, az, r, (len(sub(b, a)) / 2) * ext, rz);
  };
  const ell = (c: V3, rx: number, ry: number, rz: number, ax: V3 = right, ay: V3 = up) => {
    const az = norm(cross(ax, ay));
    return place(c, ax, ay, az, rx, ry, rz);
  };

  // testa: centro tra le orecchie, orientata col naso
  const earM = lerp(J[7], J[8], 0.5);
  const headC = add(earM, mul(up, 0.025));
  const headF = perp(up, sub(J[0], earM));
  const headR = norm(cross(up, headF));
  const neckTop = add(headC, mul(up, -0.085));
  const bow = { sh: J[S.bow[0]], el: J[S.bow[1]], wr: J[S.bow[2]] };
  const drw = { sh: J[S.draw[0]], el: J[S.draw[1]], wr: J[S.draw[2]] };
  const bowIdx = J[hand === "destro" ? 19 : 20] ?? bow.wr;
  const drwIdx = J[S.drawFinger] ?? drw.wr;

  // quanto lavorano i muscoli: gomito della corda piegato = schiena e spalla della corda attive
  const drawAng = angleAt(drw.sh, drw.el, drw.wr);
  const bowAng = angleAt(bow.sh, bow.el, bow.wr);
  const armUp = Math.max(0, Math.min(1, 1 - Math.abs(bow.wr[1] - bow.sh[1]) / 0.35));
  const pull = Math.max(0, Math.min(1, (165 - drawAng) / 95)) * armUp;
  const push_ = Math.max(0, Math.min(1, (bowAng - 135) / 40)) * armUp;

  // ---------- scheletro ----------
  push("sphere", ell(headC, 0.072, 0.088, 0.082, headR, up), BONE, 1, 0.95, "osso");
  push("sphere", ell(add(add(headC, mul(up, -0.07)), mul(headF, 0.035)), 0.05, 0.03, 0.045, headR, up), BONE, 1, 0.95, "osso"); // mandibola
  // colonna: dal bacino alla testa, leggermente dietro
  const spineA = add(hipM, add(mul(up, 0.04), mul(fwd, -0.05)));
  const spineB = add(shM, add(mul(up, 0.0), mul(fwd, -0.06)));
  const nV = 22;
  for (let i = 0; i <= nV; i++) {
    const t = i / nV;
    const p = t < 0.8 ? lerp(spineA, spineB, t / 0.8) : lerp(spineB, neckTop, (t - 0.8) / 0.2);
    const bend = Math.sin(t * Math.PI * 2) * 0.012; // curve della colonna
    const r = 0.017 - t * 0.007;
    push("sphere", ell(add(p, mul(fwd, bend)), r * 1.25, r * 0.75, r), BONE, 1, 0.95, "osso");
  }
  // gabbia toracica: anelli inclinati
  const chestTop = add(shM, mul(up, -0.05));
  const ribTilt = norm(add(fwd, mul(up, -0.35)));
  const ribAx = norm(cross(up, ribTilt));
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const c = add(add(chestTop, mul(up, -0.29 * t)), mul(fwd, -0.005));
    const w = shW * (0.24 + 0.16 * Math.sin(Math.PI * (0.2 + t * 0.75)));
    const d = 0.065 + 0.03 * Math.sin(Math.PI * (0.2 + t * 0.7));
    // anello nel piano ribAx × ribTilt
    const ay = norm(cross(ribTilt, ribAx));
    push("torus", place(c, ribAx, ay, ribTilt, w, 0.085, d), BONE, 1, 0.8, "osso");
  }
  push("sphere", seg(add(chestTop, mul(fwd, 0.08)), add(chestTop, add(mul(fwd, 0.09), mul(up, -0.2))), 0.014, 0.008), BONE, 1, 0.95, "osso"); // sterno
  // clavicole e scapole
  const notch = add(chestTop, add(mul(fwd, 0.07), mul(up, 0.03)));
  for (const sh of [shL, shR]) {
    push("sphere", seg(notch, add(sh, mul(fwd, 0.02)), 0.009), BONE, 1, 0.95, "osso");
    const sc = add(lerp(sh, shM, 0.42), add(mul(up, -0.09), mul(fwd, -0.075)));
    push("sphere", ell(sc, 0.055, 0.075, 0.012), BONE, 1, 0.8, "osso");
  }
  // braccia
  for (const a of [bow, drw]) {
    push("sphere", seg(a.sh, a.el, 0.014), BONE, 1, 0.95, "osso");
    push("sphere", ell(a.el, 0.024, 0.024, 0.024), BONE, 1, 0.95, "osso");
    const ay = norm(sub(a.wr, a.el));
    const off = mul(perp(ay, up), 0.009);
    push("sphere", seg(add(a.el, off), add(a.wr, off), 0.008), BONE, 1, 0.95, "osso"); // radio
    push("sphere", seg(sub(a.el, off), sub(a.wr, off), 0.008), BONE, 1, 0.95, "osso"); // ulna
  }
  // mani: ossa verso indice, mignolo, pollice
  for (const [wr, fingers] of [[J[15], [19, 17, 21]], [J[16], [20, 18, 22]]] as const) {
    for (const f of fingers) if (J[f]) push("sphere", seg(wr, J[f], 0.006), BONE, 1, 0.9, "osso");
  }
  // bacino
  const pelC = add(hipM, mul(up, 0.06));
  push("torus", place(add(pelC, mul(up, -0.02)), right, norm(cross(fwd, right)), fwd, hipW * 0.62 + 0.03, 0.4, 0.07), BONE, 1, 0.85, "osso");
  for (const sgn of [-1, 1]) push("sphere", ell(add(pelC, add(mul(right, sgn * (hipW * 0.5 + 0.03)), mul(up, 0.04))), 0.055, 0.06, 0.02, right, up), BONE, 1, 0.8, "osso");
  // gambe
  for (const [hip, knee, ank, heel, toe] of [[23, 25, 27, 29, 31], [24, 26, 28, 30, 32]] as const) {
    push("sphere", seg(J[hip], J[knee], 0.017), BONE, 1, 0.95, "osso");
    push("sphere", ell(add(J[knee], mul(fwd, 0.02)), 0.025, 0.025, 0.02), BONE, 1, 0.95, "osso");
    push("sphere", seg(J[knee], J[ank], 0.014), BONE, 1, 0.95, "osso");
    push("sphere", seg(add(J[knee], mul(right, 0.02)), add(J[ank], mul(right, 0.02)), 0.007), BONE, 1, 0.9, "osso");
    push("sphere", seg(J[heel], J[toe], 0.016, 0.01, 1.05, up), BONE, 1, 0.9, "osso");
  }

  // ---------- muscoli ----------
  // a riposo il muscolo è appena accennato, quando lavora si accende (come nelle tavole anatomiche)
  const M = (pl: { m: Float32Array; nm: Float32Array }, act: number, alpha = 0.78) => push("sphere", pl, muscleCol(act), 2, Math.min(alpha, 0.22 + 0.7 * act), "muscolo", act);
  for (const a of [bow, drw]) {
    const isDraw = a === drw;
    M(seg(add(a.sh, mul(up, 0.02)), lerp(a.sh, a.el, 0.42), 0.05, 0.048), isDraw ? 0.35 + 0.6 * pull : 0.35 + 0.6 * push_); // deltoide
    M(seg(lerp(a.sh, a.el, 0.2), lerp(a.sh, a.el, 0.9), 0.03, 0.028, 1, fwd), isDraw ? 0.3 + 0.5 * pull : 0.2); // bicipite
    const back = mul(fwd, -0.025);
    M(seg(add(lerp(a.sh, a.el, 0.2), back), add(lerp(a.sh, a.el, 0.95), back), 0.03, 0.028), isDraw ? 0.25 : 0.3 + 0.6 * push_); // tricipite
    M(seg(lerp(a.el, a.wr, 0.05), lerp(a.el, a.wr, 0.85), 0.03, 0.025), isDraw ? 0.45 + 0.3 * pull : 0.4); // avambraccio
  }
  // trapezio, romboidi (lato corda), dorsali, pettorali, addome, glutei e gambe
  M(ell(add(add(shM, mul(up, 0.02)), mul(fwd, -0.05)), shW * 0.42, 0.11, 0.03), 0.3 + 0.6 * pull);
  M(ell(add(lerp(shM, drw.sh, 0.4), add(mul(up, -0.11), mul(fwd, -0.085))), 0.06, 0.075, 0.02), 0.25 + 0.75 * pull);
  M(ell(add(lerp(shM, bow.sh, 0.4), add(mul(up, -0.11), mul(fwd, -0.085))), 0.06, 0.075, 0.02), 0.2 + 0.3 * push_);
  for (const [sh, act] of [[drw.sh, 0.3 + 0.4 * pull], [bow.sh, 0.25 + 0.45 * push_]] as const) {
    const a = add(lerp(sh, shM, 0.15), add(mul(up, -0.08), mul(fwd, -0.04)));
    const b = add(lerp(hipM, sh, 0.25), mul(fwd, -0.03));
    M(seg(a, b, 0.07, 0.025, 1, fwd), act, 0.6); // gran dorsale
    M(ell(add(lerp(sh, shM, 0.45), add(mul(up, -0.08), mul(fwd, 0.07))), 0.075, 0.06, 0.02), 0.25, 0.65); // pettorale
  }
  M(ell(add(lerp(hipM, shM, 0.33), mul(fwd, 0.085)), 0.07, 0.15, 0.02), 0.35, 0.55); // retto addominale
  for (const [hip, knee, ank] of [[23, 25, 27], [24, 26, 28]] as const) {
    M(seg(add(J[hip], mul(fwd, 0.02)), add(J[knee], mul(fwd, 0.03)), 0.065, 0.06), 0.15, 0.6);
    M(seg(add(J[knee], mul(fwd, -0.03)), add(lerp(J[knee], J[ank], 0.7), mul(fwd, -0.03)), 0.05, 0.05), 0.12, 0.6);
    M(ell(add(J[hip], add(mul(fwd, -0.07), mul(up, 0.02))), 0.07, 0.08, 0.05), 0.2, 0.55);
  }

  // ---------- pelle (bordo luminoso) ----------
  const K = (pl: { m: Float32Array; nm: Float32Array }) => push("sphere", pl, SKIN, 0, 0.8, "pelle");
  K(ell(headC, 0.088, 0.115, 0.1, headR, up));
  K(seg(add(shM, mul(up, -0.02)), neckTop, 0.05, 0.05));
  K(ell(add(lerp(hipM, shM, 0.72), mul(up, -0.02)), shW * 0.62, 0.2, 0.12));
  K(ell(lerp(hipM, shM, 0.36), shW * 0.43, 0.17, 0.11));
  K(ell(add(hipM, mul(up, 0.03)), hipW * 0.75 + 0.07, 0.12, 0.115));
  for (const a of [bow, drw]) {
    K(ell(a.sh, 0.065, 0.065, 0.065));
    K(seg(a.sh, a.el, 0.052, 0.05));
    K(seg(a.el, a.wr, 0.042, 0.038));
  }
  for (const [wr, idx] of [[J[15], J[19]], [J[16], J[20]]] as const) if (idx) K(seg(wr, add(idx, mul(norm(sub(idx, wr)), 0.03)), 0.03, 0.045));
  for (const [hip, knee, ank, heel, toe] of [[23, 25, 27, 29, 31], [24, 26, 28, 30, 32]] as const) {
    K(seg(J[hip], J[knee], 0.082, 0.08));
    K(seg(J[knee], J[ank], 0.058, 0.055));
    K(seg(J[heel], J[toe], 0.04, 0.03, 1.08, up));
  }

  // ---------- arco, corda, freccia ----------
  const grip = lerp(bow.wr, bowIdx, 0.55);
  const nock = lerp(drw.wr, drwIdx, 0.6);
  const u = norm(sub(grip, nock));
  const n = perp(u, [0, 1, 0]);
  const half = 0.8;
  const curve = (s: number): V3 => add(add(grip, mul(n, half * s)), mul(u, -0.11 * s * s));
  const steps = 26;
  for (let i = 0; i < steps; i++) {
    const s0 = -1 + (2 * i) / steps;
    const s1 = -1 + (2 * (i + 1)) / steps;
    const mid = (s0 + s1) / 2;
    const r = Math.abs(mid) < 0.28 ? 0.018 : 0.011 - Math.abs(mid) * 0.004;
    push("sphere", seg(curve(s0), curve(s1), r, r * 0.7, 1.35, u), WOOD, 3, 1, "arco");
  }
  const tipU = curve(1);
  const tipD = curve(-1);
  push("sphere", seg(tipU, nock, 0.0028, 0.0028, 1.0), [0.95, 0.95, 0.9], 3, 0.9, "arco");
  push("sphere", seg(tipD, nock, 0.0028, 0.0028, 1.0), [0.95, 0.95, 0.9], 3, 0.9, "arco");
  const arrowTip = add(grip, mul(u, 0.08));
  push("sphere", seg(nock, arrowTip, 0.0045, 0.0045, 1.0), [0.98, 0.82, 0.35], 3, 1, "arco");
  push("sphere", seg(nock, add(nock, mul(u, 0.09)), 0.012, 0.003, 1.0, n), [0.95, 0.35, 0.3], 3, 0.9, "arco"); // alette

  // ---------- quote ----------
  const m = metricsOf(lm, hand, aspect, 1000);
  const kit = archeryKit(lm, aspect * 1000, 1000, hand, null)?.nums ?? null;
  const kneeM = lerp(J[25], J[26], 0.5);
  const eyeL = J[2], eyeR = J[5];
  const headTilt = eyeL && eyeR ? Math.abs((Math.atan2(eyeR[1] - eyeL[1], Math.hypot(eyeR[0] - eyeL[0], eyeR[2] - eyeL[2])) * 180) / Math.PI) : null;
  const labels: Hud["labels"] = [];
  const ok = (good: boolean): "cyan" | "warn" => (good ? "cyan" : "warn");
  labels.push({ at: drw.el, text: `Gomito corda ${Math.round(drawAng)}°`, tone: "cyan" });
  labels.push({ at: bow.el, text: `Gomito arco ${Math.round(bowAng)}°`, tone: ok(bowAng >= 160) });
  if (m) labels.push({ at: shM, text: `Spalle ${Math.abs(m.shoulder).toFixed(0)}°`, tone: ok(Math.abs(m.shoulder) <= 5) });
  if (headTilt != null) labels.push({ at: headC, text: `Testa ${headTilt.toFixed(0)}°`, tone: ok(headTilt <= 8) });
  labels.push({ at: hipM, text: `Anca ${Math.round(angleAt(shM, hipM, kneeM))}°`, tone: "cyan" });
  if (m) labels.push({ at: drw.el, text: `Linea gomito ${Math.round(m.line)}°`, tone: ok(m.line >= 165) });
  if (kit?.anchorCm != null) labels.push({ at: nock, text: `Ancoraggio ${kit.anchorCm.toFixed(0)} cm dalla bocca`, tone: "gold" });
  const dims: Hud["dims"] = kit ? [{ a: nock, b: grip, text: `Allungo ${kit.drawCm.toFixed(0)} cm (${(kit.drawCm / 2.54).toFixed(1)}″)` }] : [];
  const arcs: Hud["arcs"] = [
    { at: drw.el, a: drw.sh, b: drw.wr, deg: drawAng },
    { at: bow.el, a: bow.sh, b: bow.wr, deg: bowAng },
  ];
  const feet = lerp(J[27], J[28], 0.5);
  feet[1] = 0;
  const top = Math.max(headC[1] + 0.12, tipU[1] + 0.04);
  return {
    parts,
    hud: { pts: { nock, grip, headC, shM, hipM }, labels, arcs, dims, feet },
    center: [shM[0] * 0.5 + hipM[0] * 0.5, top * 0.52, shM[2] * 0.5 + hipM[2] * 0.5],
    height: top,
  };
}
