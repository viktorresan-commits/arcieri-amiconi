/**
 * Modello anatomico 3D dai 33 punti della posa: pelle traslucida, scheletro e muscoli al lavoro,
 * più arco, corda e freccia ricostruiti dalle mani. Tutto in metri, piedi a terra (y = 0),
 * x verso destra dell'immagine, z verso la fotocamera. Le parti sono ellissoidi e anelli: il
 * renderer (anatomy-3d) disegna ogni parte con una matrice.
 */
import { FACE0, FACE_IDS, metricsOf, sides, type Gear, type Hand, type Landmark } from "./pose-analysis";
import { archeryKit } from "./pose-kit";

export type V3 = [number, number, number];
export type Mode = 0 | 1 | 2 | 3; // 0 pelle (bordo luminoso), 1 osso, 2 muscolo, 3 materiale semplice
export type Part = { mesh: "sphere" | "torus" | "spindle" | "tube"; m: Float32Array; nm: Float32Array; color: V3; mode: Mode; alpha: number; act: number; layer: "pelle" | "osso" | "muscolo" | "arco"; deep?: boolean; id?: string };
export type Hud = {
  pts: Record<string, V3>;
  labels: { at: V3; text: string; tone: "cyan" | "gold" | "warn" }[];
  arcs: { at: V3; a: V3; b: V3; deg: number }[];
  dims: { a: V3; b: V3; text: string }[];
  feet: V3;
};
/** J e hand servono al corpo anatomico vero (anatomy-body): ogni segmento segue questi punti */
export type Model = { parts: Part[]; hud: Hud; center: V3; height: number; J?: Record<number, V3>; hand?: Hand };

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
  // unità d'immagine per metro: la misura che cambia meno quando l'arciere gira il busto.
  // Corpo intero (spalle-caviglie) se si vede, poi il busto; la larghezza delle spalle (che si
  // accorcia girandosi e faceva "saltare" la grandezza del corpo) solo se non c'è altro
  const torsoS = hipsOk ? d2(shM, { x: (P(23).x + P(24).x) / 2, y: (P(23).y + P(24).y) / 2 }) / 0.5 : 0;
  const fullS = hipsOk && anklesOk ? (Math.max(P(27).y, P(28).y) - shM.y) / 1.36 : 0;
  const s = (fullS > 0 && torsoS > 0 ? fullS * 0.7 + torsoS * 0.3 : torsoS || fullS || d2(P(11), P(12)) / 0.36) || 1;
  const hipY = hipsOk ? (P(23).y + P(24).y) / 2 : shM.y + 0.5 * s;
  const floorY = anklesOk ? Math.max(P(27).y, P(28).y) + 0.075 * s : hipY + 0.93 * s;
  const cx = shM.x;
  // Profondità ricostruita dalle lunghezze delle ossa: dal video si conoscono x e y; ogni osso ha
  // una lunghezza reale, quindi |dz| = √(L² − l²) dove l è la lunghezza vista nell'immagine.
  // Il segno (avanti o dietro) arriva dal modello di posa. Busto e gambe restano in piedi:
  // niente più corpo piegato in avanti.
  const zSign = (child: number, parent: number) => {
    const a = lm[child]?.zw;
    const b = lm[parent]?.zw;
    if (typeof a === "number" && typeof b === "number" && Number.isFinite(a) && Number.isFinite(b)) return a < b ? 1 : -1; // più vicino alla camera = z positivo
    return (P(child).z ?? 0) < (P(parent).z ?? 0) ? 1 : -1;
  };
  const XY = (i: number): V3 => [(P(i).x - cx) / s, (floorY - P(i).y) / s, 0];
  const out: Record<number, V3> = {};
  for (let i = 0; i < Math.min(33, lm.length); i++) out[i] = XY(i);
  const dzFor = (a: V3, b: V3, L: number) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return l >= L ? 0 : Math.sqrt(L * L - l * l);
  };
  // spalle e anche: se nel video sono più strette del vero, il busto è girato
  const turn = (l: number, r: number, L: number) => {
    const dz = dzFor(out[l], out[r], L) * 0.5;
    const sg = zSign(r, l);
    out[l][2] = -sg * dz;
    out[r][2] = sg * dz;
  };
  turn(11, 12, 0.36);
  if (hipsOk) turn(23, 24, 0.27);
  // braccia: gomito e polso con la lunghezza vera di omero e avambraccio
  for (const [sh, el, wr] of [[11, 13, 15], [12, 14, 16]] as const) {
    out[el][2] = out[sh][2] + zSign(el, sh) * dzFor(out[sh], out[el], 0.3) * 0.9;
    out[wr][2] = out[el][2] + zSign(wr, el) * dzFor(out[el], out[wr], 0.26) * 0.9;
    for (const f of wr === 15 ? [17, 19, 21] : [18, 20, 22]) if (out[f]) out[f][2] = out[wr][2];
  }
  // gambe nel piano del bacino (si stanno dritti per tirare), con un filo di profondità se il video la mostra
  for (const [hip, knee, ank] of [[23, 25, 27], [24, 26, 28]] as const) {
    out[knee][2] = out[hip][2] + zSign(knee, hip) * Math.min(0.12, dzFor(out[hip], out[knee], 0.44) * 0.5);
    out[ank][2] = out[knee][2] + zSign(ank, knee) * Math.min(0.12, dzFor(out[knee], out[ank], 0.42) * 0.5);
  }
  for (const [ank, heel, toe] of [[27, 29, 31], [28, 30, 32]] as const) {
    if (out[heel]) out[heel][2] = out[ank][2] - 0.05;
    if (out[toe]) out[toe][2] = out[ank][2] + 0.15;
  }
  // testa: il viso guarda dove è girato il naso rispetto alle orecchie
  const shZ = (out[11][2] + out[12][2]) / 2;
  const earsZ = shZ - 0.01;
  const faceTurn = Math.max(-1, Math.min(1, (out[0][0] - (out[7][0] + out[8][0]) / 2) / 0.09));
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) if (out[i]) out[i][2] = earsZ;
  out[0][2] = earsZ + 0.09 * Math.sqrt(Math.max(0, 1 - faceTurn * faceTurn * 0.6));
  for (const i of [1, 2, 3, 4, 5, 6, 9, 10]) if (out[i]) out[i][2] = earsZ + 0.07 * Math.sqrt(Math.max(0, 1 - faceTurn * faceTurn * 0.6));
  // mani (21 punti per mano, se rilevate): profondità relativa al polso
  if (lm.length >= 133) {
    for (const [base, wr] of [[33, 15], [54, 16]] as const) {
      if (vis(lm[base]) < 0.5) continue;
      const w0 = lm[base];
      const h0 = XY(base);
      // il polso della mano coincide con quello del corpo
      const off: V3 = [out[wr][0] - h0[0], out[wr][1] - h0[1], 0];
      for (let k = 0; k < 21; k++) {
        const p = lm[base + k];
        const q = XY(base + k);
        // profondità relativa al polso, limitata: la stima delle dita è rumorosa
        q[2] = out[wr][2] + Math.max(-0.1, Math.min(0.1, (-(((p.z ?? 0) - (w0.z ?? 0)) * aspect) / s) * 0.6));
        out[base + k] = add(q, off);
      }
    }
  }
  // viso (58 punti): servono a girare la testa come nel video (mento, fronte, occhi)
  if (lm.length >= FACE0 + FACE_IDS.length && vis(lm[FACE0]) >= 0.5) {
    const earZ = (out[7][2] + out[8][2]) / 2;
    let zm = 0;
    for (let k = 0; k < FACE_IDS.length; k++) zm += lm[FACE0 + k].z ?? 0;
    zm /= FACE_IDS.length;
    for (let k = 0; k < FACE_IDS.length; k++) {
      const q = XY(FACE0 + k);
      q[2] = earZ + 0.07 + Math.max(-0.12, Math.min(0.12, -(((lm[FACE0 + k].z ?? 0) - zm) * aspect) / s));
      out[FACE0 + k] = q;
    }
  }
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

/** muscolo: rosso naturale a riposo, verso il giallo quando lavora */
const muscleCol = (a: number): V3 => {
  const t = Math.max(0, Math.min(1, (a - 0.3) / 0.6));
  return [0.72 + 0.28 * t, 0.27 + 0.55 * t, 0.22 + 0.06 * t];
};

export function buildModel(lm: Landmark[], aspect: number, hand: Hand, gear: Gear | null = null): Model | null {
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
    parts[parts.length - 1].deep = true;
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
    parts[parts.length - 1].deep = true;
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
  // mani: con i 21 punti per mano, falangi e dita vere (si vedono presa dell'arco e dita sulla corda);
  // altrimenti tre ossa verso indice, mignolo e pollice
  const handBase = (wr: number) => (wr === 15 ? 33 : 54);
  const fingerLinks: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20]];
  for (const [wrI, fingers] of [[15, [19, 17, 21]], [16, [20, 18, 22]]] as const) {
    const base = handBase(wrI);
    if (J[base]) {
      for (const [a, b] of fingerLinks) {
        const long = a === 0; // metacarpi
        push("sphere", seg(J[base + a], J[base + b], long ? 0.0055 : 0.0048, long ? 0.0045 : 0.0048, 1.02), BONE, 1, 0.95, "osso");
      }
      for (const k of [2, 3, 6, 7, 10, 11, 14, 15, 18, 19]) push("sphere", ell(J[base + k], 0.0062, 0.0062, 0.0062), BONE, 1, 0.95, "osso");
    } else for (const f of fingers) if (J[f]) push("sphere", seg(J[wrI], J[f], 0.006), BONE, 1, 0.9, "osso");
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

  // ---------- muscoli: da origine a inserzione, si accorciano e si allungano con il gesto ----------
  // a volume costante: quando un muscolo si accorcia diventa più spesso (il bicipite si gonfia)
  let tag = "";
  const M = (a: V3, b: V3, r: number, rz: number, act: number, rest = 0, hint: V3 = fwd, alpha = 0.94) => {
    const L = len(sub(b, a)) || 0.01;
    const k = rest > 0 ? Math.max(0.75, Math.min(1.45, Math.sqrt(rest / L))) : 1;
    push("spindle", seg(a, b, r * k * 1.25, rz * k * 1.25, 1.1, hint), muscleCol(act), 2, alpha, "muscolo", act);
    parts[parts.length - 1].id = tag;
  };
  const flat = (a: V3, b: V3, w: number, t: number, act: number, normal: V3, alpha = 0.9) => {
    // muscolo piatto (trapezio, dorsale, pettorale): largo w, spesso t, steso sulla superficie
    const ay = norm(sub(b, a));
    const az = perp(ay, normal);
    const ax = norm(cross(ay, az));
    push("spindle", place(lerp(a, b, 0.5), ax, ay, az, w * 1.2, (len(sub(b, a)) / 2) * 1.1, t), muscleCol(act), 2, alpha, "muscolo", act);
    parts[parts.length - 1].id = tag;
  };
  const back = mul(fwd, -1);
  const spineAt = (t: number) => add(lerp(add(hipM, mul(up, 0.04)), shM, t), mul(fwd, -0.07)); // 0 bacino, 1 spalle
  const sternumTop = add(shM, add(mul(fwd, 0.075), mul(up, -0.03)));
  const sternumMid = add(lerp(hipM, shM, 0.72), mul(fwd, 0.095));
  for (const a of [bow, drw]) {
    const isDraw = a === drw;
    const sd = isDraw ? "corda" : "arco";
    const out_ = norm(sub(a.sh, shM));
    const L1 = len(sub(a.el, a.sh));
    const ua = norm(sub(a.el, a.sh));
    const fa = norm(sub(a.wr, a.el));
    // lato verso cui si piega il gomito (il bicipite); col braccio disteso si usa il davanti del busto
    const bend = sub(fa, mul(ua, dot(fa, ua)));
    const fU = len(bend) > 0.15 ? norm(bend) : perp(ua, fwd);
    const acromion = add(a.sh, add(mul(up, 0.025), mul(out_, 0.01)));
    const tuberosity = add(lerp(a.sh, a.el, 0.45), mul(perp(ua, out_), 0.012));
    const shoulderAct = isDraw ? 0.3 + 0.65 * pull : 0.35 + 0.6 * push_;
    // deltoide: tre capi (anteriore, medio, posteriore) che vanno alla tuberosità dell'omero
    tag = `${sd}-deltoide-ant`;
    M(add(acromion, mul(fwd, 0.035)), tuberosity, 0.024, 0.02, isDraw ? 0.25 + 0.3 * pull : 0.4 + 0.5 * push_, L1 * 0.5, fwd);
    tag = `${sd}-deltoide-med`;
    M(add(acromion, mul(out_, 0.015)), tuberosity, 0.026, 0.022, shoulderAct, L1 * 0.5, out_);
    tag = `${sd}-deltoide-post`;
    M(add(acromion, mul(back, 0.04)), tuberosity, 0.024, 0.02, isDraw ? 0.35 + 0.65 * pull : 0.3 + 0.3 * push_, L1 * 0.5, back);
    // bicipite: dalla spalla (davanti) al radio appena sotto il gomito
    const bicIns = add(add(a.el, mul(fa, 0.04)), mul(fU, 0.012));
    tag = `${sd}-bicipite`;
    M(add(a.sh, add(mul(fU, 0.022), mul(ua, 0.04))), bicIns, 0.024, 0.022, isDraw ? 0.35 + 0.35 * pull : 0.25, L1 * 0.95);
    // brachiale, sotto il bicipite
    tag = `${sd}-brachiale`;
    M(add(lerp(a.sh, a.el, 0.5), mul(fU, 0.012)), add(a.el, mul(fa, 0.03)), 0.017, 0.015, isDraw ? 0.3 + 0.3 * pull : 0.2, L1 * 0.55);
    // tricipite: dietro la spalla fino all'olecrano (si allunga quando il gomito si piega)
    const olecranon = sub(sub(a.el, mul(fa, 0.022)), mul(fU, 0.02));
    tag = `${sd}-tricipite`;
    M(add(add(a.sh, mul(fU, -0.022)), mul(ua, 0.03)), olecranon, 0.027, 0.024, isDraw ? 0.25 : 0.4 + 0.55 * push_, L1 * 0.95);
    // avambraccio: flessori (dita che agganciano la corda), estensori e brachioradiale
    const fF = perp(fa, fU);
    tag = `${sd}-flessori`;
    M(add(a.el, mul(fF, 0.018)), add(a.wr, mul(fF, 0.008)), 0.019, 0.016, isDraw ? 0.35 + 0.5 * pull : 0.35, len(sub(a.wr, a.el)), fF);
    tag = `${sd}-estensori`;
    M(add(a.el, mul(fF, -0.018)), add(a.wr, mul(fF, -0.008)), 0.017, 0.015, isDraw ? 0.3 : 0.3 + 0.25 * push_, len(sub(a.wr, a.el)), fF);
    tag = `${sd}-brachioradiale`;
    M(add(lerp(a.sh, a.el, 0.78), mul(fU, 0.015)), add(lerp(a.el, a.wr, 0.85), mul(fU, 0.01)), 0.017, 0.014, isDraw ? 0.35 + 0.3 * pull : 0.25, L1 * 0.22 + len(sub(a.wr, a.el)) * 0.85);
    // gran pettorale: dallo sterno e dalla clavicola all'omero
    const pecIns = add(lerp(a.sh, a.el, 0.14), mul(fwd, 0.015));
    tag = `${sd}-pettorale`;
    flat(add(lerp(sternumTop, a.sh, 0.3), mul(up, 0.0)), pecIns, 0.045, 0.014, isDraw ? 0.2 : 0.25, fwd);
    tag = `${sd}-pettorale`;
    flat(sternumMid, pecIns, 0.05, 0.016, isDraw ? 0.2 : 0.3, fwd);
    // scapola: quella della corda si avvicina alla colonna in trazione
    const scap = add(lerp(a.sh, spineAt(0.85), isDraw ? 0.42 + 0.12 * pull : 0.45), add(mul(up, -0.09), mul(back, 0.015)));
    // trapezio: superiore (collo → acromion), medio (colonna → spina della scapola), inferiore
    tag = `${sd}-trapezio-sup`;
    flat(add(neckTop, mul(back, 0.035)), acromion, 0.032, 0.012, isDraw ? 0.3 + 0.4 * pull : 0.2 + 0.2 * push_, back);
    tag = `${sd}-trapezio-med`;
    flat(add(spineAt(0.9), mul(back, 0.01)), add(scap, mul(up, 0.05)), 0.035, 0.012, isDraw ? 0.3 + 0.7 * pull : 0.3, back);
    tag = `${sd}-trapezio-inf`;
    flat(add(spineAt(0.45), mul(back, 0.01)), add(scap, mul(up, 0.03)), 0.03, 0.011, isDraw ? 0.25 + 0.5 * pull : 0.3 + 0.5 * push_, back);
    // romboidi: dalla colonna al bordo interno della scapola
    tag = `${sd}-romboidi`;
    flat(add(spineAt(0.78), mul(back, 0.012)), add(scap, mul(out_, -0.035)), 0.028, 0.012, isDraw ? 0.3 + 0.7 * pull : 0.25, back);
    // sottospinato e grande rotondo: dalla scapola all'omero (dietro)
    tag = `${sd}-sottospinato`;
    M(add(scap, mul(back, 0.012)), add(lerp(a.sh, a.el, 0.08), mul(back, 0.025)), 0.025, 0.012, isDraw ? 0.3 + 0.6 * pull : 0.3 + 0.3 * push_, 0, back);
    // gran dorsale: dalla schiena bassa all'omero, si allunga quando il braccio sale
    const latIns = add(lerp(a.sh, a.el, 0.12), mul(back, 0.01));
    tag = `${sd}-dorsale`;
    flat(add(lerp(spineAt(0.15), add(hipM, mul(out_, 0.08)), 0.6), mul(back, 0.03)), latIns, 0.042, 0.013, isDraw ? 0.3 + 0.45 * pull : 0.3 + 0.35 * push_, add(back, mul(out_, 0.6)), 0.85);
    // dentato anteriore: costole → scapola, tiene la spalla dell'arco bassa e avanti
    tag = `${sd}-dentato`;
    flat(add(lerp(sternumMid, a.sh, 0.75), mul(up, -0.08)), add(scap, mul(fwd, 0.04)), 0.03, 0.012, isDraw ? 0.2 : 0.3 + 0.5 * push_, out_, 0.85);
    // sternocleidomastoideo
    const ear = J[(isDraw ? S.draw[0] : S.bow[0]) === 11 ? 7 : 8];
    tag = `${sd}-scm`;
    M(add(ear, mul(up, -0.02)), add(sternumTop, mul(out_, 0.015)), 0.011, 0.01, 0.2, 0, out_);
  }
  // addome e schiena
  for (let i = 0; i < 4; i++) {
    const t0 = 0.08 + i * 0.16;
    for (const sg of [-1, 1]) {
      const c0 = add(add(lerp(hipM, shM, t0), mul(fwd, 0.1)), mul(right, sg * 0.032));
      const c1 = add(add(lerp(hipM, shM, t0 + 0.14), mul(fwd, 0.105)), mul(right, sg * 0.032));
      // retto dell'addome: riquadri piatti divisi dai tendini
      tag = `addome`;
      push("sphere", ell(lerp(c0, c1, 0.5), 0.03, len(sub(c1, c0)) * 0.55, 0.012), muscleCol(0.3), 2, 0.92, "muscolo", 0.3);
      parts[parts.length - 1].id = tag;
    }
  }
  for (const sg of [-1, 1]) {
    tag = `obliqui`;
    flat(add(add(lerp(hipM, shM, 0.15), mul(fwd, 0.05)), mul(right, sg * 0.11)), add(add(lerp(hipM, shM, 0.6), mul(fwd, 0.07)), mul(right, sg * 0.1)), 0.045, 0.014, 0.25, add(fwd, mul(right, sg)), 0.8); // obliqui
    tag = `erettori`;
    flat(add(spineAt(0.02), mul(right, sg * 0.03)), add(spineAt(0.85), mul(right, sg * 0.028)), 0.022, 0.018, 0.35, back, 0.9); // erettori della colonna
  }
  // gambe: glutei, quadricipite, femorali, polpacci, tibiale
  for (const [hip, knee, ank] of [[23, 25, 27], [24, 26, 28]] as const) {
    const lg = norm(sub(J[knee], J[hip]));
    const side = norm(sub(J[hip], hipM));
    tag = `glutei`;
    flat(add(add(J[hip], mul(back, 0.07)), mul(up, 0.07)), add(add(lerp(J[hip], J[knee], 0.25), mul(back, 0.05)), mul(side, 0.03)), 0.065, 0.035, 0.2, back, 0.9);
    tag = `quadricipite`;
    M(add(J[hip], mul(fwd, 0.045)), add(J[knee], mul(fwd, 0.045)), 0.04, 0.034, 0.2, 0, fwd);
    tag = `quadricipite`;
    M(add(add(lerp(J[hip], J[knee], 0.15), mul(side, 0.05)), mul(fwd, 0.015)), add(add(J[knee], mul(side, 0.03)), mul(fwd, 0.02)), 0.038, 0.032, 0.18, 0, side);
    tag = `quadricipite`;
    M(add(add(lerp(J[hip], J[knee], 0.4), mul(side, -0.04)), mul(fwd, 0.02)), add(add(J[knee], mul(side, -0.03)), mul(fwd, 0.02)), 0.035, 0.032, 0.18, 0, side);
    tag = `femorali`;
    M(add(J[hip], mul(back, 0.055)), add(J[knee], mul(back, 0.04)), 0.042, 0.036, 0.18, 0, back);
    tag = `polpacci`;
    for (const sg of [-1, 1]) M(add(add(J[knee], mul(back, 0.035)), mul(side, sg * 0.02)), add(lerp(J[knee], J[ank], 0.62), mul(back, 0.03)), 0.03, 0.03, 0.15, 0, back);
    tag = `tibiale`;
    M(add(lerp(J[knee], J[ank], 0.1), mul(fwd, 0.025)), add(lerp(J[knee], J[ank], 0.85), mul(fwd, 0.02)), 0.016, 0.014, 0.12, 0, fwd);
    void lg;
  }

  let tagHand = "";
  const handMuscle = (a: V3, b: V3, id: string) => {
    push("spindle", seg(a, b, 0.014, 0.01, 1.05), muscleCol(0.45), 2, 0.92, "muscolo", 0.45);
    parts[parts.length - 1].id = id;
  };
  void tagHand;
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
  for (const [wrI, idxI] of [[15, 19], [16, 20]] as const) {
    const base = handBase(wrI);
    if (J[base]) {
      // palmo e dita con la loro pelle
      K(seg(J[base], lerp(J[base + 5], J[base + 17], 0.5), 0.035, 0.016, 1.15));
      for (const [a, b] of fingerLinks) if (a !== 0) K(seg(J[base + a], J[base + b], 0.0095, 0.0095, 1.25));
      // muscoli del pollice (eminenza tenare): lavorano nella presa
      tagHand = `${wrI === S.bow[2] ? "arco" : "corda"}-mano`;
      handMuscle(J[base], J[base + 2], tagHand);
    } else if (J[idxI]) K(seg(J[wrI], add(J[idxI], mul(norm(sub(J[idxI], J[wrI])), 0.03)), 0.03, 0.045));
  }
  for (const [hip, knee, ank, heel, toe] of [[23, 25, 27, 29, 31], [24, 26, 28, 30, 32]] as const) {
    K(seg(J[hip], J[knee], 0.082, 0.08));
    K(seg(J[knee], J[ank], 0.058, 0.055));
    K(seg(J[heel], J[toe], 0.04, 0.03, 1.08, up));
  }

  // ---------- arco, corda, freccia ----------
  // presa: il palmo della mano dell'arco (con i punti della mano), altrimenti tra polso e indice
  const bowBase = handBase(S.bow[2]);
  const drwBase = handBase(S.draw[2]);
  const grip = J[bowBase] ? lerp(lerp(J[bowBase], J[bowBase + 5], 0.5), J[bowBase + 9], 0.5) : lerp(bow.wr, bowIdx, 0.55);
  // dita sulla corda: le seconde falangi di indice e medio
  // la corda sta nella piega della prima falange di indice e medio (la cocca tra le due dita)
  const fingers = J[drwBase] ? lerp(J[drwBase + 7], J[drwBase + 11], 0.5) : lerp(drw.wr, drwIdx, 0.75);
  // verso il bersaglio: dalla spalla della corda a quella dell'arco, in orizzontale
  let toT = sub(bow.sh, drw.sh);
  toT = norm([toT[0], 0, toT[2]]);
  // punto del fotogramma (0..1) -> metri, alla profondità di un punto del corpo vicino
  const bowWrI = S.bow[2];
  const drwWrI = S.draw[2];
  const sImg = Math.abs(lm[23].y - lm[11].y) / Math.max(1e-6, Math.abs(J[11][1] - J[23][1]));
  const fromImage = (x: number, y: number, ref: V3, refI: number): V3 => [ref[0] + ((x - lm[refI].x) * aspect) / sImg, ref[1] - (y - lm[refI].y) / sImg, ref[2]];
  // trazione: si decide sul fotogramma (2D), non sulla profondità stimata, che sbaglia spesso:
  // braccio dell'arco su e mano della corda verso il viso (o gomito della corda piegato)
  const mm = metricsOf(lm, hand, aspect, 1000);
  const drawn = Boolean(mm && mm.bowUp && (mm.handFace < 1.0 || drawAng < 115));
  // all'ancoraggio le dita sono al viso: stessa profondità della bocca, mai dietro la linea delle spalle
  const toFace = (p: V3): V3 => {
    let q: V3 = [p[0], p[1], p[2]];
    if (drawn) {
      const mouthJ = J[9] && J[10] ? lerp(J[9], J[10], 0.5) : J[0];
      const k = Math.max(0, Math.min(1, 1 - ((mm?.handFace ?? 1) - 0.35) / 0.65));
      q[2] += (mouthJ[2] - q[2]) * k;
      const ahead = dot(sub(q, shM), fwd);
      if (ahead < 0.03) q = add(q, mul(fwd, 0.03 - ahead));
    }
    return q;
  };
  // la freccia vista nel fotogramma comanda: la cocca è la sua estremità dalla parte della mano della corda
  let arrowSeen: { nock: V3; tip: V3 } | null = null;
  if (gear?.arrow && sImg > 0) {
    const g = gear.arrow;
    const dw = lm[drwWrI];
    const d1 = Math.hypot((g.x1 - dw.x) * aspect, g.y1 - dw.y);
    const d2 = Math.hypot((g.x2 - dw.x) * aspect, g.y2 - dw.y);
    const [nx, ny, tx, ty] = d1 < d2 ? [g.x1, g.y1, g.x2, g.y2] : [g.x2, g.y2, g.x1, g.y1];
    // la cocca deve stare vicino alla mano della corda (entro 25 cm), altrimenti la linea trovata non è la freccia
    if (Math.min(d1, d2) / sImg < 0.25) {
      const nk = toFace(fromImage(nx, ny, fingers, drwWrI));
      const tp = fromImage(tx, ty, grip, bowWrI);
      if (len(sub(tp, nk)) > 0.3) arrowSeen = { nock: nk, tip: tp };
    }
  }
  // dita sulla corda: in trazione, oppure con la mano vicina all'arco (incocco e preparazione)
  const onString = drawn || len(sub(fingers, grip)) < 0.35;
  let nock: V3;
  if (arrowSeen) nock = arrowSeen.nock;
  else if (onString) nock = toFace(fingers);
  else nock = sub(grip, mul(toT, 0.22)); // arco a riposo: la cocca sta sulla corda a 22 cm dalla presa
  // se la mano sta proprio sulla presa la freccia non ha direzione: si usa il verso del bersaglio
  let u = len(sub(grip, nock)) > 0.08 ? norm(sub(grip, nock)) : toT;
  if (len(sub(grip, nock)) <= 0.08) nock = sub(grip, mul(toT, 0.22));
  if (arrowSeen) {
    const ua = norm(sub(arrowSeen.tip, arrowSeen.nock));
    if (dot(ua, u) > Math.cos((25 * Math.PI) / 180)) u = ua;
  }
  let n = perp(u, [0, 1, 0]);
  let half = 0.8;
  // arco trovato nel video: inclinazione e lunghezza vere
  if (gear?.bow && sImg > 0) {
    const a = fromImage(gear.bow.x1, gear.bow.y1, bow.wr, bowWrI);
    const b = fromImage(gear.bow.x2, gear.bow.y2, bow.wr, bowWrI);
    let d = sub(a, b);
    if (d[1] < 0) d = mul(d, -1);
    const k = perp(u, norm(d));
    if (len(k) > 0.5) n = k;
    if (gear.bow.measured) half = Math.max(0.55, Math.min(0.9, len(sub(a, b)) / 2));
  }
  if (n[1] < 0) n = mul(n, -1);
  // flettenti curvati verso il bersaglio (davanti alla presa), corda dietro
  const curve = (s: number): V3 => add(add(grip, mul(n, half * s)), mul(u, 0.02 - 0.13 * s * s));
  const steps = 44;
  for (let i = 0; i < steps; i++) {
    const s0 = -1 + (2 * i) / steps;
    const s1 = -1 + (2 * (i + 1)) / steps;
    const mid = (s0 + s1) / 2;
    const r = Math.abs(mid) < 0.28 ? 0.018 : 0.011 - Math.abs(mid) * 0.004;
    push("tube", seg(curve(s0), curve(s1), r, r * 0.7, 1.04, u), WOOD, 3, 1, "arco");
  }
  const tipU = curve(1);
  const tipD = curve(-1);
  push("tube", seg(tipU, nock, 0.0022, 0.0022, 1.0), [0.95, 0.95, 0.9], 3, 0.9, "arco");
  push("tube", seg(tipD, nock, 0.0022, 0.0022, 1.0), [0.95, 0.95, 0.9], 3, 0.9, "arco");
  // freccia: incoccata quando le dita sono sulla corda (in trazione o pronte a tirare)
  const nocked = Boolean(arrowSeen) || onString;
  if (nocked) {
    // la freccia appoggia sul rest: sopra la mano dell'arco e accanto al legno, a sinistra
    // dell'arco per un destro (a destra per un mancino), non in mezzo alla presa
    const leftOfBow = norm(cross(n, u));
    const restPt = add(add(grip, mul(n, 0.035)), mul(leftOfBow, hand === "destro" ? 0.022 : -0.022));
    const ua = len(sub(restPt, nock)) > 0.1 ? norm(sub(restPt, nock)) : u;
    const gn = len(sub(restPt, nock));
    // la freccia sporge sempre oltre la presa; se il video la mostra, finisce dove finisce davvero
    let arrowTip = add(nock, mul(ua, Math.max(0.72, gn + 0.06)));
    if (arrowSeen && gear?.arrow?.measured) {
      const along = dot(sub(arrowSeen.tip, nock), ua);
      if (along > gn * 0.8 && along < gn + 0.45) arrowTip = add(nock, mul(ua, along));
    }
    push("tube", seg(nock, arrowTip, 0.004, 0.004, 1.0), [0.98, 0.82, 0.35], 3, 1, "arco");
    push("sphere", seg(nock, add(nock, mul(ua, 0.09)), 0.012, 0.003, 1.0, n), [0.95, 0.35, 0.3], 3, 0.9, "arco"); // alette
  }

  // ---------- quote ----------
  const m = metricsOf(lm, hand, aspect, 1000);
  const kit = archeryKit(lm, aspect * 1000, 1000, hand, gear)?.nums ?? null;
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
  if (drawn && kit?.anchorCm != null) labels.push({ at: nock, text: `Ancoraggio ${kit.anchorCm.toFixed(0)} cm dalla bocca`, tone: "gold" });
  const dims: Hud["dims"] = kit && drawn ? [{ a: nock, b: grip, text: `Allungo ${kit.drawCm.toFixed(0)} cm (${(kit.drawCm / 2.54).toFixed(1)}″)` }] : [];
  const arcs: Hud["arcs"] = [
    { at: drw.el, a: drw.sh, b: drw.wr, deg: drawAng },
    { at: bow.el, a: bow.sh, b: bow.wr, deg: bowAng },
  ];
  const feet = lerp(J[27], J[28], 0.5);
  feet[1] = 0;
  const top = Math.max(headC[1] + 0.12, tipU[1] + 0.04);
  return {
    parts,
    hud: { pts: { nock, grip, headC, shM, hipM, bowEl: bow.el, drawEl: drw.el, bowWr: bow.wr, drawWr: drw.wr, bowSh: bow.sh, drawSh: drw.sh, knees: lerp(J[25], J[26], 0.5) }, labels, arcs, dims, feet },
    center: [shM[0] * 0.5 + hipM[0] * 0.5, top * 0.52, shM[2] * 0.5 + hipM[2] * 0.5],
    height: top,
    J,
    hand,
  };
}
