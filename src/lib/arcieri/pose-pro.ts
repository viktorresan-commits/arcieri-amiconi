/**
 * Analisi del gesto "pro": oltre a braccia e spalle guarda testa (occhi, orecchie, bocca, naso),
 * polsi (con indice, mignolo e pollice), postura, gambe, ancoraggio rispetto al tipo d'arco
 * e stima l'allungo per confrontarlo con la lunghezza della freccia.
 *
 * Punti MediaPipe Pose (33): 0 naso, 1–6 occhi, 7–8 orecchie, 9–10 bocca, 11–16 spalle/gomiti/polsi,
 * 17–22 mignolo/indice/pollice, 23–28 anche/ginocchia/caviglie, 29–32 talloni e punte.
 * Le distanze sono in "spalle" (larghezza tra le spalle) o in cm se conosciamo l'altezza.
 * Inquadratura attesa: di fronte all'arciere, con la freccia di traverso.
 */
import { handPoint, joint, sides, type Hand, type Landmark } from "./pose-analysis";

export type ProSetup = {
  bowType: string; // olimpico | compound | nudo | longbow | ricurvo | storico
  arrowIn: number; // lunghezza freccia in pollici (0 = non nota)
  heightCm: number; // altezza dell'arciere (0 = non nota)
};

export type ProMetrics = {
  headTilt: number | null; // rollio della testa, gradi (+ = verso l'arco)
  headTurn: number | null; // naso avanti rispetto alle orecchie, in spalle (+ = verso il bersaglio)
  headLean: number | null; // testa avanti/indietro rispetto alle spalle, in spalle (+ = verso il bersaglio)
  shrug: number | null; // spalla dell'arco alzata: collo lato arco / collo lato corda (1 = uguali)
  shoulderLevel: number; // gradi, + = spalla dell'arco più alta
  bowArm: number; // gomito dell'arco, gradi (180 = disteso)
  bowArmHeight: number; // polso dell'arco rispetto alla spalla, in spalle (+ = sopra)
  bowWrist: number | null; // deviazione del polso dell'arco dalla linea dell'avambraccio, gradi
  bowWristDir: "alto" | "basso" | null;
  drawWrist: number | null; // deviazione del polso della corda, gradi
  elbowLine: number; // allineamento gomito della corda con la freccia (180 = in linea)
  elbowHeight: number; // gomito della corda rispetto alla linea della freccia, in spalle (+ = sopra)
  anchorV: number | null; // posizione verticale dell'indice: 0 = bocca, 1 = mento
  anchorH: number | null; // distanza orizzontale dall'asse del viso, in spalle
  anchorDist: number | null; // mano della corda – viso, in spalle
  trunk: number | null; // busto rispetto alla verticale (+ = verso il bersaglio)
  sideLean: number | null; // spalle rispetto alle anche, in spalle (+ = verso il bersaglio)
  kneeBow: number | null; // gradi
  kneeDraw: number | null;
  stance: number | null; // piedi, in spalle
  weight: number | null; // centro spalle rispetto al centro piedi, in spalle (+ = verso il bersaglio)
  drawLenCm: number | null; // allungo stimato
  scaleFrom: "piedi" | "spalle" | null;
  /** centimetri per unità d'immagine (altezza del fotogramma = 1), se conosco la statura */
  cmPerUnit: number | null;
  // ---- piedi (dai punti tallone e punta, con la profondità stimata) ----
  /** piedi rispetto alla linea di tiro, gradi: + = posizione aperta (verso il bersaglio), − = chiusa */
  stanceOpen: number | null;
  /** punta del piede dell'arco / della corda: 0 = dritta in avanti, + = girata verso il bersaglio */
  footBow: number | null;
  footDraw: number | null;
  // ---- tronco ----
  /** spalle rispetto alla linea di tiro, gradi (rotazione del busto) */
  shoulderRot: number | null;
  /** spalle girate rispetto alle anche, gradi (torsione del tronco) */
  trunkTwist: number | null;
  /** busto in avanti (+) o indietro (−), gradi */
  trunkForward: number | null;
  // ---- braccia ----
  /** braccio dell'arco (spalla-polso) rispetto all'orizzontale, + = in su */
  bowArmTilt: number;
  /** avambraccio della corda rispetto all'orizzontale */
  drawForearmTilt: number;
  /** omero della corda rispetto all'orizzontale (gomito alto = +) */
  drawUpperTilt: number;
  /** rotazione della mano dell'arco: linea delle nocche rispetto alla verticale, gradi */
  bowKnuckles: number | null;
  /** rotazione della mano della corda: linea delle nocche rispetto alla verticale */
  drawKnuckles: number | null;
  // ---- dita ----
  /** piega media di indice, medio e anulare della corda (gradi alla seconda falange) */
  drawHook: number | null;
  /** dita sulla corda (piegate oltre 25°) */
  fingersOnString: number | null;
  /** chiusura delle dita della mano dell'arco (0 = aperte, 90+ = pugno) */
  bowGrip: number | null;
};

const vis = (p: Landmark | undefined) => (p ? (p.visibility ?? 1) : 0);
const deg = (r: number) => (r * 180) / Math.PI;
const med = (xs: number[]) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

export function proMetrics(lm: Landmark[], hand: Hand, aspect: number, setup: ProSetup): ProMetrics | null {
  if (lm.length < 33) return null;
  const s = sides(hand);
  const P = (i: number) => ({ x: lm[i].x * aspect, y: lm[i].y });
  const ok = (i: number, v = 0.4) => vis(lm[i]) > v;
  if (![11, 12, 13, 14, 15, 16].every((i) => ok(i, 0.3))) return null;
  const bowSide = hand === "destro" ? 1 : 0; // 1 = punti dispari (lato sinistro della persona)
  const pick = (odd: number, even: number) => (bowSide ? odd : even);
  const bS = P(s.bow[0]);
  const dS = P(s.draw[0]);
  const bE = P(s.bow[1]);
  const dE = P(s.draw[1]);
  const bW = P(s.bow[2]);
  const dW = P(s.draw[2]);
  const w = Math.hypot(bS.x - dS.x, bS.y - dS.y) || 1e-3;
  // direzione "verso il bersaglio" sullo schermo: dalla mano della corda alla mano dell'arco
  const dir = Math.sign(bW.x - dW.x) || 1;
  const sMid = { x: (bS.x + dS.x) / 2, y: (bS.y + dS.y) / 2 };

  // testa
  const eyeB = pick(2, 5);
  const eyeD = pick(5, 2);
  const earB = pick(7, 8);
  const earD = pick(8, 7);
  let headTilt: number | null = null;
  if (ok(2) && ok(5)) {
    const a = P(eyeB);
    const b = P(eyeD);
    headTilt = deg(Math.atan2(b.y - a.y, Math.abs(a.x - b.x) || 1e-3));
  } else if (ok(7) && ok(8)) {
    const a = P(earB);
    const b = P(earD);
    headTilt = deg(Math.atan2(b.y - a.y, Math.abs(a.x - b.x) || 1e-3));
  }
  const ears = [7, 8].filter((i) => ok(i, 0.3)).map(P);
  const earMid = ears.length ? { x: ears.reduce((a, p) => a + p.x, 0) / ears.length, y: ears.reduce((a, p) => a + p.y, 0) / ears.length } : null;
  const nose = ok(0, 0.3) ? P(0) : null;
  const headTurn = nose && earMid ? ((nose.x - earMid.x) * dir) / w : null;
  const headLean = earMid ? ((earMid.x - sMid.x) * dir) / w : null;

  // spalle: collo dal lato dell'arco e della corda
  let shrug: number | null = null;
  if (ok(earB, 0.3) && ok(earD, 0.3)) {
    const nb = bS.y - P(earB).y;
    const nd = dS.y - P(earD).y;
    if (nd > 1e-3) shrug = nb / nd;
  } else if (nose) {
    // una sola orecchia: confronto le spalle con il naso
    const nb = bS.y - nose.y;
    const nd = dS.y - nose.y;
    if (nd > 1e-3) shrug = nb / nd;
  }
  const shoulderLevel = deg(Math.atan2(dS.y - bS.y, Math.abs(dS.x - bS.x) || 1e-3));

  // braccio e polso dell'arco
  const bowArm = joint(bS, bE, bW);
  const bowArmHeight = (bS.y - bW.y) / w;
  const bIdx = pick(19, 20);
  const dIdx = pick(20, 19);
  let bowWrist: number | null = null;
  let bowWristDir: "alto" | "basso" | null = null;
  if (ok(bIdx, 0.35)) {
    const ix = P(bIdx);
    bowWrist = 180 - joint(bE, bW, ix);
    // indice sopra o sotto il prolungamento dell'avambraccio
    const fx = bW.x - bE.x;
    const fy = bW.y - bE.y;
    const cross = fx * (ix.y - bW.y) - fy * (ix.x - bW.x);
    bowWristDir = cross * dir > 0 ? "basso" : "alto";
  }
  let drawWrist: number | null = null;
  if (ok(dIdx, 0.35)) drawWrist = 180 - joint(dE, dW, P(dIdx));

  // gomito della corda
  const elbowLine = joint(bW, dW, dE);
  const t = (dE.x - dW.x) / ((bW.x - dW.x) || 1e-3);
  const arrowYAtElbow = dW.y + (bW.y - dW.y) * t;
  const elbowHeight = (arrowYAtElbow - dE.y) / w;

  // ancoraggio: dove sta l'indice della mano della corda rispetto a bocca e mento
  let anchorV: number | null = null;
  let anchorH: number | null = null;
  let anchorDist: number | null = null;
  const finger = ok(dIdx, 0.35) ? P(dIdx) : dW;
  if (ok(9, 0.3) && ok(10, 0.3) && nose) {
    const mouth = { x: (P(9).x + P(10).x) / 2, y: (P(9).y + P(10).y) / 2 };
    const chinY = mouth.y + Math.max(0.02, mouth.y - nose.y) * 1.15;
    anchorV = (finger.y - mouth.y) / Math.max(1e-3, chinY - mouth.y);
    anchorH = Math.abs(finger.x - nose.x) / w;
    anchorDist = Math.min(Math.hypot(finger.x - mouth.x, finger.y - mouth.y), Math.hypot(dW.x - mouth.x, dW.y - mouth.y)) / w;
  }

  // busto e gambe
  const hips = ok(23, 0.5) && ok(24, 0.5) && lm[23].y < 1.02 && lm[24].y < 1.02;
  const hMid = hips ? { x: (P(23).x + P(24).x) / 2, y: (P(23).y + P(24).y) / 2 } : null;
  const trunk = hMid ? deg(Math.atan2((sMid.x - hMid.x) * dir, hMid.y - sMid.y)) : null;
  const sideLean = hMid ? ((sMid.x - hMid.x) * dir) / w : null;
  const knee = (h: number, k: number, a: number) => (ok(h, 0.5) && ok(k, 0.5) && ok(a, 0.5) && lm[a].y < 1.02 ? joint(P(h), P(k), P(a)) : null);
  const kneeBow = knee(pick(23, 24), pick(25, 26), pick(27, 28));
  const kneeDraw = knee(pick(24, 23), pick(26, 25), pick(28, 27));
  const feet = ok(27, 0.5) && ok(28, 0.5) && lm[27].y < 1.02 && lm[28].y < 1.02;
  const stance = feet ? Math.hypot(P(27).x - P(28).x, P(27).y - P(28).y) / w : null;
  const fMid = feet ? { x: (P(27).x + P(28).x) / 2, y: (P(27).y + P(28).y) / 2 } : null;
  const weight = fMid ? ((sMid.x - fMid.x) * dir) / w : null;

  // allungo: distanza indice della corda – polso dell'arco, in cm se conosco l'altezza
  let drawLenCm: number | null = null;
  let scaleFrom: ProMetrics["scaleFrom"] = null;
  let cmPerUnit: number | null = null;
  if (setup.heightCm > 100) {
    if (feet && nose) {
      const ankleY = (P(27).y + P(28).y) / 2;
      cmPerUnit = (setup.heightCm * 0.89) / Math.max(1e-3, ankleY - nose.y);
      scaleFrom = "piedi";
    } else {
      cmPerUnit = (setup.heightCm * 0.205) / w;
      scaleFrom = "spalle";
    }
    // dall'indice (dove passa la corda) al punto di appoggio nell'impugnatura (~6 cm oltre il polso) + 4,4 cm (norma AMO)
    const span = Math.hypot(finger.x - bW.x, finger.y - bW.y) * cmPerUnit;
    drawLenCm = span - 6 + 4.4;
    if (!(drawLenCm > 40 && drawLenCm < 95)) {
      drawLenCm = null;
      scaleFrom = null;
      cmPerUnit = null;
    }
  }

  // ---- profondità: rotazioni sul piano orizzontale (x in metri dalle spalle, z dal modello di posa) ----
  const mPerUnit = 0.36 / w;
  const zw = (i: number) => {
    const v = lm[i]?.zw;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  // la camera vede il petto (si vede il viso) o la schiena
  const chestToCam = vis(lm[0]) > 0.5 ? 1 : -1;
  /** angolo sul piano orizzontale della linea a→b rispetto alla linea di tiro (verso il bersaglio) */
  const rotOf = (a: number, b: number, need = 0.4) => {
    const za = zw(a);
    const zb = zw(b);
    if (za == null || zb == null || !ok(a, need) || !ok(b, need)) return null;
    const dx = (P(b).x - P(a).x) * mPerUnit * dir;
    const dz = zb - za;
    if (Math.hypot(dx, dz) < 0.05) return null;
    // + = l'estremo b più lontano dalla camera
    return deg(Math.atan2(dz, Math.abs(dx)));
  };
  // linea dei piedi: dal piede della corda a quello dell'arco; aperta = piede dell'arco indietro (lontano dal petto)
  const ankB = pick(27, 28);
  const ankD = pick(28, 27);
  const feetLine = feet ? rotOf(ankD, ankB, 0.5) : null;
  const stanceOpen = feetLine == null ? null : feetLine * chestToCam;
  const footDir = (heel: number, toe: number) => {
    const zh = zw(heel);
    const zt = zw(toe);
    if (zh == null || zt == null || !ok(heel, 0.5) || !ok(toe, 0.5)) return null;
    const along = (P(toe).x - P(heel).x) * mPerUnit * dir; // verso il bersaglio
    const fwdc = -(zt - zh) * chestToCam; // in avanti = verso il petto
    if (Math.hypot(along, fwdc) < 0.05) return null;
    return deg(Math.atan2(along, Math.abs(fwdc)));
  };
  const footBow = footDir(pick(29, 30), pick(31, 32));
  const footDraw = footDir(pick(30, 29), pick(32, 31));
  const shLine = rotOf(s.draw[0], s.bow[0], 0.4);
  const hipLine = hips ? rotOf(pick(24, 23), pick(23, 24), 0.5) : null;
  const shoulderRot = shLine == null ? null : shLine * chestToCam;
  const trunkTwist = shLine != null && hipLine != null ? (shLine - hipLine) * chestToCam : null;
  let trunkForward: number | null = null;
  if (hMid) {
    const zs = [zw(11), zw(12)];
    const zh = [zw(23), zw(24)];
    if (zs.every((v) => v != null) && zh.every((v) => v != null)) {
      const dz = (zs[0]! + zs[1]!) / 2 - (zh[0]! + zh[1]!) / 2;
      const dy = (hMid.y - sMid.y) * mPerUnit;
      // spalle più vicine alla camera del bacino: in avanti se la camera guarda il petto
      trunkForward = deg(Math.atan2(-dz * chestToCam, Math.max(0.05, dy)));
    }
  }
  const tiltOf = (a: { x: number; y: number }, b: { x: number; y: number }) => deg(Math.atan2(a.y - b.y, Math.abs(b.x - a.x) || 1e-3));
  const bowArmTilt = tiltOf(bS, bW);
  const drawForearmTilt = tiltOf(dW, dE);
  const drawUpperTilt = tiltOf(dS, dE);
  // mani (21 punti): nocche, dita
  const H = (wr: number, k: number) => {
    const p = handPoint(lm, wr as 15 | 16, k);
    return p ? { x: p.x * aspect, y: p.y } : null;
  };
  const knuckles = (wr: number) => {
    const a = H(wr, 5);
    const b = H(wr, 17);
    if (!a || !b) return null;
    // 0 = nocche in verticale, 90 = in orizzontale
    return deg(Math.atan2(Math.abs(b.x - a.x), Math.abs(b.y - a.y) || 1e-6));
  };
  const flex = (wr: number, f: number) => {
    const a = H(wr, f);
    const b = H(wr, f + 1);
    const c = H(wr, f + 2);
    return a && b && c ? 180 - joint(a, b, c) : null;
  };
  const bowWr = s.bow[2];
  const drwWr = s.draw[2];
  const bowKnuckles = knuckles(bowWr);
  const drawKnuckles = knuckles(drwWr);
  const hooks = [5, 9, 13].map((f) => flex(drwWr, f)).filter((v): v is number => v != null);
  const drawHook = hooks.length ? hooks.reduce((a, b) => a + b, 0) / hooks.length : null;
  const fingersOnString = hooks.length ? hooks.filter((v) => v > 25).length : null;
  const grips = [5, 9, 13, 17].map((f) => flex(bowWr, f)).filter((v): v is number => v != null);
  const bowGrip = grips.length ? grips.reduce((a, b) => a + b, 0) / grips.length : null;

  return {
    headTilt, headTurn, headLean, shrug, shoulderLevel, bowArm, bowArmHeight, bowWrist, bowWristDir, drawWrist, elbowLine, elbowHeight, anchorV, anchorH, anchorDist, trunk, sideLean, kneeBow, kneeDraw, stance, weight, drawLenCm, scaleFrom, cmPerUnit,
    stanceOpen, footBow, footDraw, shoulderRot, trunkTwist, trunkForward, bowArmTilt, drawForearmTilt, drawUpperTilt, bowKnuckles, drawKnuckles, drawHook, fingersOnString, bowGrip,
  };
}

/** Mediana di più fotogrammi (es. tutta la fase di ancoraggio): più stabile di un fotogramma solo. */
export function proMedian(list: ProMetrics[]): ProMetrics | null {
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  const keys = Object.keys(list[0]) as (keyof ProMetrics)[];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const vals = list.map((m) => m[k]);
    if (typeof list[0][k] === "number" || vals.some((v) => typeof v === "number")) {
      const nums = vals.filter((v): v is number => typeof v === "number");
      out[k] = nums.length >= Math.ceil(list.length / 3) ? med(nums) : null;
    } else {
      // testo: il valore più frequente
      const counts = new Map<unknown, number>();
      vals.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
      out[k] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    }
  }
  return out as ProMetrics;
}

/** Variabilità (deviazione standard) di alcune misure lungo l'ancoraggio: quanto stai fermo. */
export function proSteadiness(list: ProMetrics[]) {
  const sd = (xs: number[]) => {
    const v = xs.filter(Number.isFinite);
    if (v.length < 3) return null;
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
  };
  return {
    head: sd(list.map((m) => m.headTilt ?? NaN)),
    elbow: sd(list.map((m) => m.elbowLine)),
    bowArm: sd(list.map((m) => m.bowArm)),
    bowWrist: sd(list.map((m) => m.bowWrist ?? NaN)),
  };
}

/* ---------- valutazione ---------- */

export type AreaId = "testa" | "spalle" | "braccioArco" | "polsoArco" | "gomito" | "polsoCorda" | "ancoraggio" | "busto" | "gambe" | "attrezzatura";
export type Area = { id: AreaId; label: string; score: number | null };
export type Gauge = { area: AreaId; label: string; value: number | null; unit: string; lo: number; hi: number; min: number; max: number; digits?: number };
export type Issue = { area: AreaId; weight: number; title: string; why: string; fix: string; drill?: { label: string; to: string } };

export const AREA_LABEL: Record<AreaId, string> = {
  testa: "Testa",
  spalle: "Spalle",
  braccioArco: "Braccio arco",
  polsoArco: "Polso arco",
  gomito: "Gomito corda",
  polsoCorda: "Polso corda",
  ancoraggio: "Ancoraggio",
  busto: "Busto",
  gambe: "Gambe e piedi",
  attrezzatura: "Allungo e freccia",
};

/** Punteggio 0–100 di una misura dentro/fuori la fascia ideale [lo, hi], con tolleranza `soft`. */
function band(v: number | null, lo: number, hi: number, soft: number) {
  if (v == null || !Number.isFinite(v)) return null;
  if (v >= lo && v <= hi) return 100;
  const d = v < lo ? lo - v : v - hi;
  return Math.max(0, Math.round(100 - (d / soft) * 100));
}
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

/** Dove ci si aspetta l'ancoraggio per tipo d'arco: [min, max] di anchorV (0 = bocca, 1 = mento). */
export function anchorTarget(bowType: string): { lo: number; hi: number; text: string } {
  if (bowType === "olimpico") return { lo: 0.7, hi: 1.5, text: "sotto il mento, corda sul mento e sul naso" };
  if (bowType === "compound") return { lo: 0.3, hi: 1.4, text: "lungo la mandibola, con lo sgancio" };
  return { lo: -0.6, hi: 0.5, text: "all'angolo della bocca o allo zigomo" };
}

export function evaluate(m: ProMetrics, setup: ProSetup, steady?: ReturnType<typeof proSteadiness> | null) {
  const at = anchorTarget(setup.bowType);
  const gauges: Gauge[] = [
    { area: "testa", label: "Testa inclinata", value: m.headTilt == null ? null : Math.abs(m.headTilt), unit: "°", lo: 0, hi: 5, min: 0, max: 25 },
    { area: "testa", label: "Testa girata al bersaglio", value: m.headTurn, unit: " sp", lo: 0.12, hi: 0.6, min: -0.3, max: 0.8, digits: 2 },
    { area: "spalle", label: "Spalle in piano", value: Math.abs(m.shoulderLevel), unit: "°", lo: 0, hi: 4, min: 0, max: 20 },
    { area: "spalle", label: "Spalla dell'arco bassa", value: m.shrug, unit: "×", lo: 0.85, hi: 1.25, min: 0.3, max: 1.6, digits: 2 },
    { area: "braccioArco", label: "Braccio dell'arco disteso", value: m.bowArm, unit: "°", lo: 165, hi: 182, min: 120, max: 182 },
    { area: "braccioArco", label: "Braccio all'altezza della spalla", value: m.bowArmHeight, unit: " sp", lo: -0.15, hi: 0.2, min: -0.8, max: 0.8, digits: 2 },
    { area: "polsoArco", label: "Polso dell'arco dritto", value: m.bowWrist, unit: "°", lo: 0, hi: 18, min: 0, max: 60 },
    { area: "gomito", label: "Gomito in linea con la freccia", value: m.elbowLine, unit: "°", lo: 168, hi: 182, min: 130, max: 182 },
    { area: "gomito", label: "Gomito all'altezza della freccia", value: m.elbowHeight, unit: " sp", lo: -0.05, hi: 0.3, min: -0.5, max: 0.6, digits: 2 },
    { area: "polsoCorda", label: "Polso della corda rilassato", value: m.drawWrist, unit: "°", lo: 0, hi: 20, min: 0, max: 60 },
    { area: "ancoraggio", label: "Altezza dell'ancoraggio", value: m.anchorV, unit: "", lo: at.lo, hi: at.hi, min: -1.5, max: 2.5, digits: 2 },
    { area: "ancoraggio", label: "Mano vicina al viso", value: m.anchorDist, unit: " sp", lo: 0, hi: 0.45, min: 0, max: 1.5, digits: 2 },
    { area: "busto", label: "Busto verticale", value: m.trunk == null ? null : Math.abs(m.trunk), unit: "°", lo: 0, hi: 5, min: 0, max: 20 },
    { area: "busto", label: "Spalle sopra le anche", value: m.sideLean == null ? null : Math.abs(m.sideLean), unit: " sp", lo: 0, hi: 0.12, min: 0, max: 0.6, digits: 2 },
    { area: "gambe", label: "Piedi larghi come le spalle", value: m.stance, unit: " sp", lo: 0.85, hi: 1.4, min: 0.3, max: 2.2, digits: 2 },
    { area: "gambe", label: "Peso al centro", value: m.weight == null ? null : Math.abs(m.weight), unit: " sp", lo: 0, hi: 0.15, min: 0, max: 0.6, digits: 2 },
    { area: "gambe", label: "Ginocchia distese", value: m.kneeBow != null && m.kneeDraw != null ? Math.min(m.kneeBow, m.kneeDraw) : (m.kneeBow ?? m.kneeDraw), unit: "°", lo: 165, hi: 182, min: 120, max: 182 },
  ];
  const arrowCm = setup.arrowIn > 0 ? setup.arrowIn * 2.54 : 0;
  if (m.drawLenCm != null) gauges.push({ area: "attrezzatura", label: "Allungo stimato", value: m.drawLenCm, unit: " cm", lo: arrowCm ? arrowCm - 7 : 55, hi: arrowCm ? arrowCm - 1 : 80, min: 45, max: 90 });

  const scoreOf = (g: Gauge) => band(g.value, g.lo, g.hi, Math.max(1e-3, (g.max - g.min) * 0.35));
  const areas: Area[] = (Object.keys(AREA_LABEL) as AreaId[]).map((id) => ({ id, label: AREA_LABEL[id], score: avg(gauges.filter((g) => g.area === id).map(scoreOf)) }));
  // stabilità all'ancoraggio: abbassa testa e gomito se tremano
  if (steady) {
    const a = areas.find((x) => x.id === "testa");
    if (a?.score != null && steady.head != null && steady.head > 2.5) a.score = Math.max(0, a.score - Math.round((steady.head - 2.5) * 8));
    const g = areas.find((x) => x.id === "gomito");
    if (g?.score != null && steady.elbow != null && steady.elbow > 3) g.score = Math.max(0, g.score - Math.round((steady.elbow - 3) * 6));
  }
  const measured = areas.filter((a) => a.score != null) as { id: AreaId; label: string; score: number }[];
  const total = measured.length ? Math.round(measured.reduce((x, a) => x + a.score, 0) / measured.length) : 0;

  const issues: Issue[] = [];
  const add = (cond: boolean, i: Issue) => cond && issues.push(i);
  add(m.headTilt != null && Math.abs(m.headTilt) > 6, {
    area: "testa", weight: Math.abs(m.headTilt ?? 0) / 6,
    title: `Testa inclinata di ${Math.abs(m.headTilt ?? 0).toFixed(0)}°`,
    why: "Se la testa si piega, cambia il punto d'ancoraggio e l'occhio guarda da un'altra altezza: la freccia va su e giù.",
    fix: "Testa dritta e alta, come se un filo la tirasse dal centro: porta la corda al viso, non il viso alla corda.",
    drill: { label: "Routine di tiro", to: "/routine" },
  });
  add(m.headTurn != null && m.headTurn < 0.1, {
    area: "testa", weight: 1.2,
    title: "Testa poco girata verso il bersaglio",
    why: "Con la testa poco ruotata la corda incontra il naso o la guancia storta e l'occhio non è sulla linea.",
    fix: "Prima di alzare l'arco gira bene la testa verso il bersaglio, mento parallelo alla spalla dell'arco, e tienila lì.",
  });
  add(m.headLean != null && m.headLean < -0.18, {
    area: "testa", weight: 1,
    title: "Testa indietro, lontana dal bersaglio",
    why: "Inclinare la testa all'indietro allontana la mano dal viso e fa variare l'ancoraggio.",
    fix: "Resta con la testa sopra le spalle: è la mano che arriva al viso.",
  });
  add(m.shrug != null && m.shrug < 0.8, {
    area: "spalle", weight: (0.8 - (m.shrug ?? 0.8)) * 6 + 1,
    title: "Spalla dell'arco alzata",
    why: "La spalla alta accorcia il braccio dell'arco, rende l'allungo instabile e affatica il collo.",
    fix: "Spingi la spalla dell'arco verso il basso e indietro prima della trazione; braccio lungo dalla scapola.",
    drill: { label: "Tenute a secco", to: "/secco" },
  });
  add(Math.abs(m.shoulderLevel) > 6, {
    area: "spalle", weight: Math.abs(m.shoulderLevel) / 6,
    title: `Spalle non in piano (${Math.abs(m.shoulderLevel).toFixed(0)}°)`,
    why: "Spalle storte spostano la linea della freccia e la forza non passa diritta nella schiena.",
    fix: "Linea delle spalle orizzontale, parallela alla freccia; abbassa quella che sale.",
  });
  add(m.bowArm < 160, {
    area: "braccioArco", weight: (165 - m.bowArm) / 8,
    title: `Braccio dell'arco piegato (${m.bowArm.toFixed(0)}°)`,
    why: "Il gomito piegato cede durante la mira: la freccia esce corta o di lato.",
    fix: "Distendi il braccio senza bloccare il gomito: ruota l'interno del gomito verso il basso.",
  });
  add(Math.abs(m.bowArmHeight) > 0.3, {
    area: "braccioArco", weight: 1,
    title: m.bowArmHeight > 0 ? "Braccio dell'arco troppo alto" : "Braccio dell'arco troppo basso",
    why: "Il braccio deve stare all'altezza della spalla per lavorare con le ossa e non con i muscoli.",
    fix: "Regola l'altezza del braccio con il busto e le gambe, non alzando o abbassando la spalla.",
  });
  add(m.bowWrist != null && m.bowWrist > 22, {
    area: "polsoArco", weight: ((m.bowWrist ?? 0) - 18) / 8 + 0.6,
    title: `Polso dell'arco ${m.bowWristDir === "alto" ? "alto" : m.bowWristDir === "basso" ? "basso, a gomito" : "piegato"} (${(m.bowWrist ?? 0).toFixed(0)}°)`,
    why: "Il polso piegato fa torcere l'arco al rilascio (coppia sull'impugnatura): frecce a destra e sinistra.",
    fix: "Mano rilassata, spinta sul cuscinetto del pollice, nocche a 45°. Dita morbide sull'impugnatura.",
  });
  add(m.elbowLine < 165, {
    area: "gomito", weight: (168 - m.elbowLine) / 5,
    title: `Gomito della corda fuori linea (${(180 - m.elbowLine).toFixed(0)}°)`,
    why: "Se il gomito non sta dietro la freccia, tiri con il braccio e non con la schiena: rilascio meno pulito.",
    fix: "Porta il gomito dietro, sul prolungamento della freccia, chiudendo la scapola verso la colonna.",
    drill: { label: "Tenute a secco", to: "/secco" },
  });
  add(m.elbowHeight < -0.08, {
    area: "gomito", weight: 1,
    title: "Gomito della corda basso",
    why: "Un gomito sotto la freccia fa lavorare il bicipite e il rilascio diventa una spinta in avanti.",
    fix: "Alza il gomito all'altezza della freccia o appena sopra.",
  });
  add(m.drawWrist != null && m.drawWrist > 24, {
    area: "polsoCorda", weight: ((m.drawWrist ?? 0) - 20) / 8 + 0.6,
    title: `Polso della corda agganciato (${(m.drawWrist ?? 0).toFixed(0)}°)`,
    why: "Il polso piegato vuol dire mano e avambraccio contratti: il rilascio strappa.",
    fix: "Dorso della mano piatto e rilassato: le dita sono solo ganci, la forza è nella schiena.",
  });
  add(m.anchorV != null && (m.anchorV < at.lo - 0.25 || m.anchorV > at.hi + 0.25), {
    area: "ancoraggio", weight: 1.4,
    title: `Ancoraggio ${(m.anchorV ?? 0) < at.lo ? "troppo alto" : "troppo basso"} per l'arco ${setup.bowType}`,
    why: `Per questo tipo d'arco l'ancoraggio di solito sta ${at.text}. Un punto diverso cambia l'altezza della freccia.`,
    fix: "Trova un punto fisso del viso e ritrovalo ogni volta: allenalo a occhi chiusi a 3 m.",
    drill: { label: "Routine di tiro", to: "/routine" },
  });
  add(m.anchorDist != null && m.anchorDist > 0.6, {
    area: "ancoraggio", weight: 1.3,
    title: "Mano lontana dal viso",
    why: "Senza contatto con il viso non c'è un riferimento fisso: l'allungo cambia da freccia a freccia.",
    fix: "Porta la mano a contatto col viso (mento o angolo della bocca) a ogni tiro.",
  });
  add(m.trunk != null && Math.abs(m.trunk) > 6, {
    area: "busto", weight: Math.abs(m.trunk ?? 0) / 6,
    title: `Busto inclinato ${(m.trunk ?? 0) > 0 ? "verso il bersaglio" : "all'indietro"} (${Math.abs(m.trunk ?? 0).toFixed(0)}°)`,
    why: "Il busto inclinato sposta il peso e cambia l'altezza del tiro da una freccia all'altra.",
    fix: "Bacino in avanti e sotto, busto verticale: immagina di essere tra due vetri.",
  });
  add(m.stance != null && (m.stance < 0.75 || m.stance > 1.6), {
    area: "gambe", weight: 0.9,
    title: m.stance != null && m.stance < 0.75 ? "Piedi troppo stretti" : "Piedi troppo larghi",
    why: "La base dei piedi decide quanto oscilli in mira, soprattutto col vento.",
    fix: "Piedi alla larghezza delle spalle, peso distribuito sulle piante.",
  });
  add(m.weight != null && Math.abs(m.weight) > 0.2, {
    area: "gambe", weight: 0.9,
    title: `Peso spostato ${(m.weight ?? 0) > 0 ? "verso il bersaglio" : "all'indietro"}`,
    why: "Con il peso fuori centro il corpo ondeggia in mira.",
    fix: "Peso al 50/50 tra i piedi, leggermente sulle punte.",
    drill: { label: "Respiro", to: "/respiro" },
  });
  add((m.kneeBow != null && m.kneeBow < 160) || (m.kneeDraw != null && m.kneeDraw < 160), {
    area: "gambe", weight: 0.8,
    title: "Ginocchia piegate",
    why: "Ginocchia piegate tolgono stabilità e abbassano il tiro senza che te ne accorga.",
    fix: "Gambe distese ma non bloccate.",
  });
  if (m.drawLenCm != null && arrowCm) {
    const room = arrowCm - m.drawLenCm;
    add(room < 0, {
      area: "attrezzatura", weight: 3,
      title: `Freccia forse corta: allungo ~${m.drawLenCm.toFixed(0)} cm, freccia ${arrowCm.toFixed(0)} cm`,
      why: "Se la punta supera il rest durante la trazione la freccia può cadere o rompersi: pericoloso.",
      fix: "Fai misurare l'allungo all'istruttore con una freccia graduata prima di continuare con queste frecce.",
      drill: { label: "Allungo", to: "/allungo" },
    });
    add(room > 9, {
      area: "attrezzatura", weight: 0.8,
      title: `Freccia lunga: ~${room.toFixed(0)} cm oltre l'allungo`,
      why: "Troppa freccia oltre il rest la rende più pesante e più morbida di spine del necessario.",
      fix: "Valuta di tagliarla (con l'istruttore) a circa 2–3 cm oltre l'allungo, poi ricontrolla lo spine.",
      drill: { label: "Spine e libbre", to: "/spine" },
    });
  }
  if (steady?.head != null && steady.head > 3) {
    issues.push({ area: "testa", weight: 1, title: "La testa si muove in ancoraggio", why: `Varia di ±${steady.head.toFixed(1)}° mentre miri.`, fix: "Ancora, poi blocca la testa: in mira si muovono solo la schiena e l'occhio.", drill: { label: "Respiro", to: "/respiro" } });
  }
  issues.sort((a, b) => b.weight - a.weight);
  return { total, areas, gauges, issues, scoreOf };
}

/** Lunghezza d'arco consigliata (AMO) dall'allungo in pollici, per archi ricurvi. */
export function bowLengthFor(drawIn: number) {
  return drawIn < 24 ? "62–64″" : drawIn < 26 ? "64–66″" : drawIn < 28 ? "66–68″" : drawIn < 29.5 ? "68–70″" : "70–72″";
}

/** Misure dell'attrezzatura dal fotogramma: freccia, arco (corda tesa da punta a punta) e corda, in cm. */
export function gearSizes(gear: { arrow: { x1: number; y1: number; x2: number; y2: number; measured?: boolean } | null; bow: { x1: number; y1: number; x2: number; y2: number; measured?: boolean } | null } | null, aspect: number, cmPerUnit: number | null, bowType: string) {
  if (!gear || !cmPerUnit) return null;
  const seg = (g: { x1: number; y1: number; x2: number; y2: number }) => Math.hypot((g.x2 - g.x1) * aspect, g.y2 - g.y1) * cmPerUnit;
  const arrowCm = gear.arrow?.measured ? seg(gear.arrow) : null;
  const chordCm = gear.bow?.measured ? seg(gear.bow) : null;
  const ok = (v: number | null, lo: number, hi: number) => (v != null && v > lo && v < hi ? v : null);
  const arrow = ok(arrowCm, 50, 100);
  const chord = ok(chordCm, 80, 200);
  // arco teso: la corda va quasi dritta da punta a punta. Corda ≈ distanza fra le punte,
  // lunghezza AMO ≈ corda + 3″ (archi ricurvi e longbow); il compound si misura asse-asse.
  const compound = bowType === "compound";
  const amoIn = chord != null && !compound ? chord / 2.54 + 3 : null;
  const stringIn = chord != null ? chord / 2.54 - (compound ? 0 : 0.3) : null;
  return { arrowCm: arrow, chordCm: chord, amoIn, stringIn, compound };
}
