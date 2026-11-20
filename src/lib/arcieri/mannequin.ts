/**
 * Corpo 3D dell'arciere (manichino a capsule ed ellissoidi) con cinematica inversa a due ossa.
 * Lo stesso corpo serve per animare il tiro nelle viste 3D e come sagoma nell'analisi del gesto,
 * dove le articolazioni arrivano dai punti rilevati dalla fotocamera.
 */
import { basis, hexRgb, segment, trs, v3, type GL3D, type Vec3 } from "./gl3d";
import { drawArrow3D, type ArrowLook } from "./scene3d";
import { bodyRes, drawRealBody, solveBody } from "./body-mesh";
import type { AvatarLook } from "./avatar";

export type ManLook = Partial<AvatarLook>;

export type Joints = {
  head: Vec3;
  neck: Vec3;
  chest: Vec3;
  pelvis: Vec3;
  lSh: Vec3;
  rSh: Vec3;
  lEl: Vec3;
  rEl: Vec3;
  lHand: Vec3;
  rHand: Vec3;
  lHip: Vec3;
  rHip: Vec3;
  lKnee: Vec3;
  rKnee: Vec3;
  lFoot: Vec3;
  rFoot: Vec3;
  /** dove guarda il viso */
  face: Vec3;
};

/** Gomito o ginocchio: due ossa da `s` verso `t`, piegate verso `pole`. */
export function ik(s: Vec3, t: Vec3, l1: number, l2: number, pole: Vec3) {
  const d = v3.sub(t, s);
  const dist = Math.max(0.001, Math.min(l1 + l2 - 1e-4, v3.len(d)));
  const dir = v3.norm(d);
  const end = v3.add(s, v3.scale(dir, dist));
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let perp = v3.sub(pole, v3.scale(dir, v3.dot(pole, dir)));
  if (v3.len(perp) < 1e-5) perp = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  perp = v3.norm(perp);
  return { mid: v3.add(v3.add(s, v3.scale(dir, a)), v3.scale(perp, h)), end };
}

// ── pose del tiro (coordinate locali: f avanti/petto, u su, l verso il bersaglio) ──────────────────
export type ArcherPose = { bow: Vec3; draw: Vec3; head: number; onString: number; arrow: number; drawAmt: number; bowLift: number };

type Key = "riposo" | "incocco" | "aggancio" | "predraw" | "trazione" | "ancoraggio" | "mira" | "rilascio" | "accompagna";
const P: Record<Key, ArcherPose> = {
  riposo: { bow: [0.1, 0.9, 0.2], draw: [0.06, 0.86, -0.17], head: 0.35, onString: 0, arrow: 0, drawAmt: 0, bowLift: 0 },
  incocco: { bow: [0.24, 1.0, 0.3], draw: [0.26, 1.03, 0.0], head: 0.15, onString: 0, arrow: 1, drawAmt: 0, bowLift: 0.35 },
  aggancio: { bow: [0.2, 1.03, 0.32], draw: [0.17, 1.06, 0.1], head: 0.45, onString: 1, arrow: 1, drawAmt: 0.02, bowLift: 0.45 },
  predraw: { bow: [0.04, 1.34, 0.52], draw: [0.05, 1.36, 0.22], head: 1.4, onString: 1, arrow: 1, drawAmt: 0.08, bowLift: 1 },
  trazione: { bow: [0.0, 1.43, 0.62], draw: [0.06, 1.47, 0.12], head: 1.45, onString: 1, arrow: 1, drawAmt: 0.55, bowLift: 1 },
  ancoraggio: { bow: [0.0, 1.44, 0.63], draw: [0.07, 1.53, -0.03], head: 1.45, onString: 1, arrow: 1, drawAmt: 1, bowLift: 1 },
  mira: { bow: [0.0, 1.44, 0.63], draw: [0.07, 1.53, -0.045], head: 1.45, onString: 1, arrow: 1, drawAmt: 1, bowLift: 1 },
  rilascio: { bow: [0.0, 1.43, 0.645], draw: [0.04, 1.56, -0.2], head: 1.45, onString: 0, arrow: 0, drawAmt: 0, bowLift: 1 },
  accompagna: { bow: [0.02, 1.39, 0.63], draw: [0.03, 1.5, -0.24], head: 1.4, onString: 0, arrow: 0, drawAmt: 0, bowLift: 1 },
};

/**
 * Sequenza di tiro in 11 tempi (posizione, incocco, aggancio e presa, pre-trazione, trazione,
 * ancoraggio, trasferimento e mira, rilascio, accompagnamento, rilassamento), come nei programmi
 * federali e "11 Steps to Archery Success". Il tempo 0 è il rilascio.
 */
const KEYS: [number, ArcherPose][] = [
  [-6.4, P.riposo],
  [-5.6, P.incocco],
  [-4.9, P.aggancio],
  [-4.2, P.predraw],
  [-3.7, P.predraw],
  [-2.9, P.trazione],
  [-2.3, P.ancoraggio],
  [-1.3, P.mira],
  [0, { ...P.mira, draw: [0.07, 1.53, -0.055] }],
  [0.07, P.rilascio],
  [0.8, P.accompagna],
  [1.9, P.accompagna],
  [2.9, P.riposo],
];

export const ROUTINE_START = -6.4;
export const ROUTINE_END = 2.9;

export const ROUTINE: { t: number; name: string }[] = [
  { t: -6.4, name: "Posizione" },
  { t: -5.6, name: "Incocco" },
  { t: -4.9, name: "Aggancio e presa" },
  { t: -4.2, name: "Pre-trazione" },
  { t: -3.7, name: "Trazione" },
  { t: -2.3, name: "Ancoraggio" },
  { t: -1.3, name: "Trasferimento e mira" },
  { t: 0, name: "Rilascio" },
  { t: 0.25, name: "Accompagnamento" },
  { t: 1.9, name: "Rilassamento" },
];

export function phaseAt(tt: number) {
  let name = ROUTINE[0].name;
  for (const r of ROUTINE) if (tt >= r.t) name = r.name;
  return name;
}

const smooth = (x: number) => x * x * (3 - 2 * x);

/** Posa al tempo `tt` (secondi, 0 = rilascio). */
export function poseAt(tt: number): ArcherPose {
  if (tt <= KEYS[0][0]) return KEYS[0][1];
  for (let i = 1; i < KEYS.length; i += 1) {
    const [t1, b] = KEYS[i];
    const [t0, a] = KEYS[i - 1];
    if (tt <= t1) {
      const f = smooth((tt - t0) / (t1 - t0));
      const step = (x: number, y: number) => (f < 0.5 ? x : y);
      return {
        bow: v3.lerp(a.bow, b.bow, f),
        draw: v3.lerp(a.draw, b.draw, f),
        head: a.head + (b.head - a.head) * f,
        onString: b.onString < a.onString ? b.onString : step(a.onString, b.onString),
        arrow: b.arrow < a.arrow ? b.arrow : step(a.arrow, b.arrow),
        drawAmt: a.drawAmt + (b.drawAmt - a.drawAmt) * f,
        bowLift: a.bowLift + (b.bowLift - a.bowLift) * f,
      };
    }
  }
  return KEYS[KEYS.length - 1][1];
}

// ── arco ─────────────────────────────────────────────────────────────────────
type BowShape = { len: number; brace: number; recurve: number; thick: number; riser: number; cams?: boolean; oneColor?: boolean; flat?: boolean };
const BOWS: Record<string, BowShape> = {
  olimpico: { len: 1.68, brace: 0.22, recurve: 0.09, thick: 0.016, riser: 0.32 },
  ricurvo: { len: 1.62, brace: 0.21, recurve: 0.08, thick: 0.017, riser: 0.28 },
  nudo: { len: 1.62, brace: 0.21, recurve: 0.07, thick: 0.017, riser: 0.3 },
  compound: { len: 1.0, brace: 0.18, recurve: 0, thick: 0.022, riser: 0.4, cams: true },
  longbow: { len: 1.8, brace: 0.17, recurve: 0, thick: 0.015, riser: 0.1, oneColor: true },
  tradizionale: { len: 1.6, brace: 0.19, recurve: 0.04, thick: 0.017, riser: 0.2 },
  storico: { len: 1.3, brace: 0.17, recurve: 0.12, thick: 0.016, riser: 0.1, oneColor: true },
  asiatico: { len: 1.25, brace: 0.17, recurve: 0.14, thick: 0.016, riser: 0.1, oneColor: true },
  flatbow: { len: 1.68, brace: 0.17, recurve: 0, thick: 0.02, riser: 0.12, oneColor: true, flat: true },
};

function bowPoints(shape: BowShape, drawAmt: number) {
  const half = shape.len / 2;
  const bend = 0.06 + drawAmt * (shape.cams ? 0.05 : 0.17);
  const pts: { u: number; l: number; s: number }[] = [];
  const N = 14;
  for (let i = 0; i <= N; i += 1) {
    const s = -1 + (2 * i) / N;
    const as = Math.abs(s);
    let l = -bend * Math.max(0, as - shape.riser / shape.len) ** 2 * 1.6;
    let u = s * half * (1 - 0.06 * drawAmt * as * as);
    if (shape.recurve && as > 0.78) {
      const k = (as - 0.78) / 0.22;
      l += shape.recurve * k * k;
      u -= Math.sign(s) * shape.recurve * 0.35 * k * k;
    }
    pts.push({ u, l, s });
  }
  return pts;
}

export function drawBow(g: GL3D, grip: Vec3, U: Vec3, L: Vec3, F: Vec3, k: number, look: ManLook, drawAmt: number, nock: Vec3 | null) {
  const shape = BOWS[look.bowType ?? ""] ?? BOWS.olimpico;
  const pts = bowPoints(shape, drawAmt).map((p) => ({ ...p, w: v3.add(grip, v3.add(v3.scale(U, p.u * k), v3.scale(L, p.l * k))) }));
  const riser = look.riser || "#2f6fbe";
  const limbs = shape.oneColor ? look.limbs || "#8a5a2e" : look.limbs || "#15191d";
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const mid = Math.abs((a.s + b.s) / 2);
    const inRiser = mid < shape.riser / shape.len;
    const taper = inRiser ? 1.6 : 1.15 - 0.55 * mid;
    const r = shape.thick * k * taper;
    g.draw("tube", segment(a.w, b.w, r, shape.flat ? r * 2.2 : r), inRiser && !shape.oneColor ? riser : limbs, { shine: 0.55 });
    g.draw("sphere", trs(b.w, 0, [r, r, r]), inRiser && !shape.oneColor ? riser : limbs, { shine: 0.55 });
  }
  // impugnatura
  g.draw("tube", segment(v3.add(grip, v3.scale(U, -0.06 * k)), v3.add(grip, v3.scale(U, 0.06 * k)), shape.thick * k * 2), shape.oneColor ? "#5b3a1e" : riser, { shine: 0.3 });
  const top = pts[pts.length - 1].w;
  const bot = pts[0].w;
  if (shape.cams) {
    for (const p of [top, bot]) g.draw("cyl", segment(v3.add(p, v3.scale(F, -0.012 * k)), v3.add(p, v3.scale(F, 0.012 * k)), 0.035 * k), "#9aa3ab", { shine: 0.8 });
  }
  // stabilizzatore per l'olimpico
  if ((look.bowType ?? "olimpico") === "olimpico") {
    g.draw("tube", segment(v3.add(grip, v3.scale(U, -0.08 * k)), v3.add(v3.add(grip, v3.scale(U, -0.16 * k)), v3.scale(L, 0.7 * k)), 0.007 * k), "#1d2126", { shine: 0.7 });
    g.draw("sphere", trs(v3.add(v3.add(grip, v3.scale(U, -0.16 * k)), v3.scale(L, 0.7 * k)), 0, [0.016 * k, 0.016 * k, 0.016 * k]), "#1d2126", { shine: 0.7 });
    // mirino
    g.draw("tube", segment(v3.add(grip, v3.scale(U, 0.1 * k)), v3.add(v3.add(grip, v3.scale(U, 0.13 * k)), v3.scale(L, 0.2 * k)), 0.004 * k), "#c9c9c9", { shine: 0.7 });
  }
  const restPt = v3.add(grip, v3.scale(L, -shape.brace * k));
  const n = nock ?? restPt;
  const sr = 0.0035 * k;
  const sc = look.string || "#f4f1ea";
  g.draw("tube", segment(top, n, sr), sc, { emissive: 0.2 });
  g.draw("tube", segment(n, bot, sr), sc, { emissive: 0.2 });
  return { top, bot };
}

// ── corpo ────────────────────────────────────────────────────────────────────
const sleeveLong = (look: ManLook) => look.style === "medievale" || look.top === "felpa" || look.top === "giacca";

/** Disegna un corpo da articolazioni già in coordinate del mondo. `k` = scala (1 = 1,75 m). */
export function drawBody(g: GL3D, J: Joints, k: number, look: ManLook = {}, opts: { ghost?: number; tint?: string } = {}) {
  const ghost = opts.ghost;
  const o = ghost ? { alpha: ghost, shine: 0.3 } : { shine: 0.18 };
  const col = (c: string | undefined, d: string) => (opts.tint ? opts.tint : c || d);
  const skin = col(look.skin, "#eec5a4");
  const shirt = col(look.shirt, "#2f6f62");
  const pants = col(look.pants, "#2b3440");
  const shoes = col(look.shoes, "#3a2a1e");
  const hair = col(look.hairColor, "#3b2a1d");
  const U: Vec3 = [0, 1, 0];
  const side = v3.norm(v3.sub(J.lSh, J.rSh));
  const F = v3.norm(v3.cross(side, U));
  const slim = look.build === "snello" ? 0.9 : look.build === "robusto" ? 1.15 : 1;
  const kid = look.body === "ragazzo" || look.body === "ragazza";
  const fem = look.body === "donna" || look.body === "ragazza";
  // gambe
  const legC = look.bottom === "pantaloncini" ? skin : pants;
  g.capsule(J.lHip, J.lKnee, 0.075 * k * slim, pants, o);
  g.capsule(J.rHip, J.rKnee, 0.075 * k * slim, pants, o);
  g.capsule(J.lKnee, J.lFoot, 0.055 * k * slim, legC, o);
  g.capsule(J.rKnee, J.rFoot, 0.055 * k * slim, legC, o);
  const footF = v3.norm([F[0], 0, F[2]]);
  for (const f of [J.lFoot, J.rFoot]) {
    const c: Vec3 = [f[0] + footF[0] * 0.05 * k, Math.max(0.035 * k, f[1] - 0.03 * k), f[2] + footF[2] * 0.05 * k];
    g.draw("sphere", basis(c, v3.scale(footF, 0.13 * k), [0, 0.05 * k, 0], v3.scale(v3.norm(v3.cross(footF, U)), 0.055 * k)), shoes, o);
  }
  // bacino e busto
  g.draw("sphere", basis(J.pelvis, v3.scale(side, (fem ? 0.18 : 0.16) * k * slim), v3.scale(U, 0.12 * k), v3.scale(F, 0.12 * k * slim)), pants, o);
  g.capsule(J.pelvis, J.chest, 0.125 * k * slim, shirt, o);
  g.draw("sphere", basis(J.chest, v3.scale(side, 0.2 * k * slim), v3.scale(U, 0.2 * k), v3.scale(F, 0.13 * k * slim)), shirt, o);
  if (look.style === "medievale" && !ghost) {
    // tunica che scende sulle cosce
    g.draw("cyl", segment(v3.add(J.pelvis, [0, -0.2 * k, 0]), v3.add(J.pelvis, [0, 0.05 * k, 0]), 0.19 * k * slim, 0.15 * k * slim), shirt, o);
    g.draw("tube", segment(v3.add(J.pelvis, [0, 0.02 * k, 0]), v3.add(J.pelvis, [0, 0.06 * k, 0]), 0.165 * k * slim, 0.135 * k * slim), look.trim || "#c7a03a", o);
  }
  if (look.chestguard && !ghost) {
    g.draw("sphere", basis(v3.add(J.chest, v3.add(v3.scale(F, 0.02 * k), v3.scale(side, 0.05 * k))), v3.scale(side, 0.13 * k), v3.scale(U, 0.16 * k), v3.scale(F, 0.125 * k * slim)), look.chestColor || "#1d2126", o);
  }
  // collo e testa
  g.capsule(J.neck, v3.add(J.neck, [0, 0.07 * k, 0]), 0.048 * k, skin, o);
  const hr = (kid ? 0.115 : 0.105) * k;
  const face = v3.norm(J.face);
  const hs = v3.norm(v3.cross(face, U));
  g.draw("sphere", basis(J.head, v3.scale(hs, hr * 0.92), v3.scale(U, hr * 1.12), v3.scale(face, hr)), skin, o);
  if (!ghost) {
    const eyeC = look.eyes || "#2f2116";
    for (const sgn of [-1, 1]) g.draw("sphere", trs(v3.add(J.head, v3.add(v3.add(v3.scale(face, hr * 0.9), v3.scale(U, hr * 0.12)), v3.scale(hs, sgn * hr * 0.34))), 0, [hr * 0.11, hr * 0.13, hr * 0.11]), eyeC, { shine: 0.9 });
    g.draw("sphere", trs(v3.add(J.head, v3.add(v3.scale(face, hr * 1.0), v3.scale(U, -hr * 0.12))), 0, [hr * 0.15, hr * 0.17, hr * 0.15]), skin, o);
    for (const sgn of [-1, 1]) g.draw("sphere", trs(v3.add(J.head, v3.scale(hs, sgn * hr * 0.95)), 0, [hr * 0.12, hr * 0.2, hr * 0.12]), skin, o);
    // capelli: calotta spostata indietro, coda se lunghi
    if (look.hair !== "calvo") {
      const hc = v3.add(J.head, v3.add(v3.scale(U, hr * 0.28), v3.scale(face, -hr * 0.22)));
      g.draw("sphere", basis(hc, v3.scale(hs, hr * 1.0), v3.scale(U, hr * 0.92), v3.scale(face, hr * 1.02)), hair, { shine: 0.35 });
      const long = ["lunghi", "coda", "treccia", "codini"].includes(look.hair ?? "");
      if (long) g.capsule(v3.add(J.head, v3.scale(face, -hr * 0.9)), v3.add(v3.add(J.head, v3.scale(face, -hr * 1.1)), [0, -hr * 2.0, 0]), hr * 0.32, hair, { shine: 0.35 });
    }
    if (look.beard && look.beard !== "nessuna") {
      if (look.beard === "baffi" || look.beard === "pizzetto") {
        g.draw("sphere", basis(v3.add(J.head, v3.add(v3.scale(face, hr * 0.92), v3.scale(U, -hr * 0.3))), v3.scale(hs, hr * 0.32), v3.scale(U, hr * 0.08), v3.scale(face, hr * 0.12)), hair, { shine: 0.1 });
      }
      if (look.beard !== "baffi") {
        const full = look.beard === "piena";
        const chin = look.beard === "pizzetto";
        g.draw("sphere", basis(v3.add(J.head, v3.add(v3.scale(face, hr * (chin ? 0.75 : 0.42)), v3.scale(U, -hr * 0.66))), v3.scale(hs, hr * (chin ? 0.25 : 0.78)), v3.scale(U, hr * (full ? 0.5 : chin ? 0.22 : 0.32)), v3.scale(face, hr * (chin ? 0.25 : 0.6))), hair, { shine: 0.1 });
      }
    }
    if (look.hat === "berretto") {
      g.draw("sphere", basis(v3.add(J.head, v3.scale(U, hr * 0.35)), v3.scale(hs, hr * 1.05), v3.scale(U, hr * 0.75), v3.scale(face, hr * 1.05)), look.hatColor || "#1f3a5f", o);
      g.draw("sphere", basis(v3.add(J.head, v3.add(v3.scale(U, hr * 0.42), v3.scale(face, hr * 0.85))), v3.scale(hs, hr * 0.8), v3.scale(U, hr * 0.08), v3.scale(face, hr * 0.6)), look.hatColor || "#1f3a5f", o);
    } else if (look.hat === "cappuccio" || look.hat === "elmo") {
      g.draw("sphere", basis(v3.add(J.head, v3.add(v3.scale(U, hr * 0.2), v3.scale(face, -hr * 0.12))), v3.scale(hs, hr * 1.18), v3.scale(U, hr * 1.12), v3.scale(face, hr * 1.12)), look.hat === "elmo" ? "#9aa3ab" : look.hatColor || "#4b6b2e", { shine: look.hat === "elmo" ? 0.9 : 0.15 });
    } else if (look.hat === "piuma") {
      g.draw("sphere", basis(v3.add(J.head, v3.scale(U, hr * 0.5)), v3.scale(hs, hr * 1.25), v3.scale(U, hr * 0.5), v3.scale(face, hr * 1.25)), look.hatColor || "#4b6b2e", o);
      g.draw("vane", basis(v3.add(J.head, v3.add(v3.scale(U, hr * 0.7), v3.scale(face, -hr * 0.4))), hs, v3.scale(U, hr * 1.2), v3.scale(face, -hr * 1.6)), "#c4473d", o);
    } else if (look.hat === "fascia") {
      g.draw("tube", segment(v3.add(J.head, v3.scale(U, hr * 0.38)), v3.add(J.head, v3.scale(U, hr * 0.6)), hr * 1.0), look.hatColor || "#c4473d", o);
    }
  } else {
    g.draw("sphere", basis(v3.add(J.head, v3.scale(U, hr * 0.3)), v3.scale(hs, hr), v3.scale(U, hr * 0.9), v3.scale(face, hr)), hair, o);
  }
  // braccia
  const long = sleeveLong(look);
  const ar = 0.048 * k * slim;
  g.capsule(J.lSh, J.lEl, ar, shirt, o);
  g.capsule(J.rSh, J.rEl, ar, shirt, o);
  g.capsule(J.lEl, J.lHand, ar * 0.82, long ? shirt : skin, o);
  g.capsule(J.rEl, J.rHand, ar * 0.82, long ? shirt : skin, o);
  if (look.armguard && !ghost) g.draw("tube", segment(v3.lerp(J.lEl, J.lHand, 0.2), v3.lerp(J.lEl, J.lHand, 0.75), ar * 0.98), look.armguard, { shine: 0.3 });
  g.draw("sphere", trs(J.lHand, 0, [0.045 * k, 0.05 * k, 0.045 * k]), skin, o);
  g.draw("sphere", trs(J.rHand, 0, [0.045 * k, 0.05 * k, 0.045 * k]), look.tab && !ghost ? look.tab : skin, o);
  if (!ghost) g.shadow(v3.lerp(J.lFoot, J.rFoot, 0.5), 0.42 * k, 0.32 * k, 0.32);
}

/**
 * Arciere completo nel campo: piedi in `origin`, `toward` = direzione del bersaglio (orizzontale).
 * Restituisce cocca e direzione della freccia incoccata (se c'è).
 */
export function drawArcher(g: GL3D, origin: Vec3, toward: Vec3, k: number, pose: ArcherPose, look: ManLook = {}, arrow: ArrowLook = {}, arrowLen = 0.75) {
  const L = v3.norm([toward[0], 0, toward[2]]);
  const U: Vec3 = [0, 1, 0];
  const F = v3.norm(v3.cross(L, U)); // petto: la spalla sinistra guarda il bersaglio
  const s = k * (look.body === "ragazzo" || look.body === "ragazza" ? 0.82 : 1);
  const at = (f: number, u: number, l: number): Vec3 => v3.add(origin, v3.add(v3.scale(F, f * s), v3.add(v3.scale(U, u * s), v3.scale(L, l * s))));
  const lSh = at(0, 1.44, 0.19);
  const rSh = at(0, 1.44, -0.19);
  const bowArm = ik(lSh, at(pose.bow[0], pose.bow[1], pose.bow[2]), 0.3 * s, 0.29 * s, v3.add(v3.scale(F, -1), [0, -0.6, 0]));
  const drawArm = ik(rSh, at(pose.draw[0], pose.draw[1], pose.draw[2]), 0.3 * s, 0.29 * s, v3.add(v3.scale(L, -1), [0, 0.35, 0]));
  const lHip = at(0, 0.94, 0.09);
  const rHip = at(0, 0.94, -0.09);
  const lFootT = at(0.02, 0.08, 0.2);
  const rFootT = at(0.02, 0.08, -0.2);
  const lLeg = ik(lHip, lFootT, 0.45 * s, 0.44 * s, F);
  const rLeg = ik(rHip, rFootT, 0.45 * s, 0.44 * s, F);
  const yaw = pose.head;
  const face = v3.add(v3.scale(F, Math.cos(yaw)), v3.scale(L, Math.sin(yaw)));
  let J: Joints = {
    head: at(0.01, 1.64, 0.01),
    neck: at(0, 1.5, 0),
    chest: at(0, 1.3, 0),
    pelvis: at(0, 0.98, 0),
    lSh,
    rSh,
    lEl: bowArm.mid,
    rEl: drawArm.mid,
    lHand: bowArm.end,
    rHand: drawArm.end,
    lHip,
    rHip,
    lKnee: lLeg.mid,
    rKnee: rLeg.mid,
    lFoot: lLeg.end,
    rFoot: rLeg.end,
    face,
  };
  // corpo realistico (maschile) quando il modello è pronto; altrimenti il manichino
  const res = realistic(look) ? bodyRes(g) : null;
  if (res?.ready && res.asset) {
    const bones = new Float32Array(256);
    const R = solveBody(res.asset.header, {
      origin,
      F,
      L,
      s,
      lHand: at(pose.bow[0], pose.bow[1], pose.bow[2]),
      rHand: at(pose.draw[0], pose.draw[1], pose.draw[2]),
      lPole: v3.add(v3.scale(F, -1), [0, -0.6, 0]),
      rPole: v3.add(v3.scale(L, -1), [0, 0.35, 0]),
      face,
      twist: 0.08 * pose.bowLift,
    }, bones);
    drawRealBody(g, res, bones, look);
    J = { ...J, head: R.head, neck: R.neck, chest: R.chest, pelvis: R.pelvis, lSh: R.lSh, rSh: R.rSh, lEl: R.lEl, rEl: R.rEl, lHand: R.lHand, rHand: R.rHand, lHip: R.lHip, rHip: R.rHip, lKnee: R.lKnee, rKnee: R.rKnee, lFoot: R.lAnk, rFoot: R.rAnk };
    drawGearOnBody(g, J, s, look, R.lWr, R.rWr);
    g.shadow(origin, 0.42 * s, 0.32 * s, 0.34);
  } else {
    drawBody(g, J, s, look);
  }
  // faretra al fianco destro o sulla schiena
  if (look.quiver !== "") {
    const qc = look.quiver || "#7a4a26";
    const back = look.quiverPlace === "schiena";
    const a = back ? at(-0.16, 1.05, -0.05) : at(0.02, 0.62, -0.22);
    const b = back ? at(-0.2, 1.62, -0.2) : at(0.06, 1.05, -0.3);
    g.draw("cyl", segment(a, b, 0.05 * s), qc, { shine: 0.25 });
    for (let i = 0; i < 4; i += 1) {
      const off = v3.add(v3.scale(F, (i % 2 ? 0.02 : -0.02) * s), v3.scale(L, (i < 2 ? 0.02 : -0.02) * s));
      const base = v3.add(b, off);
      const dir = v3.norm(v3.sub(b, a));
      g.draw("vane", basis(base, v3.norm(v3.cross(dir, F)), v3.scale(F, 0.025 * s), v3.scale(dir, 0.1 * s)), i === 0 ? arrow.cock || look.cock || "#e6b325" : arrow.fletch || look.fletch || "#d63a2f");
    }
  }
  // arco nella mano sinistra: in riposo pende verso il basso e in avanti
  const lift = pose.bowLift;
  const bowU = v3.norm(v3.lerp(v3.add(v3.scale(U, 0.95), v3.scale(L, 0.32)), v3.add(U, v3.scale(L, -0.04)), lift));
  const bowL = v3.norm(v3.sub(L, v3.scale(bowU, v3.dot(L, bowU))));
  const grip = v3.add(J.lHand, v3.scale(bowL, 0.01 * s));
  const nock = pose.onString > 0.5 ? J.rHand : null;
  drawBow(g, grip, bowU, bowL, F, s, look, pose.drawAmt, nock);
  if (pose.arrow > 0.5) {
    const n = nock ?? J.rHand;
    const restP = v3.add(grip, v3.add(v3.scale(bowU, 0.03 * s), v3.scale(F, 0.012 * s)));
    const dir = v3.norm(v3.sub(restP, n));
    drawArrow3D(g, n, dir, arrowLen * s, 0, 0.0045 * s, arrow);
    return { nock: n, dir, grip };
  }
  return { nock: null, dir: L, grip };
}

/** Colore di contrasto per la sagoma fantasma. */
export const GHOST = hexRgb("#7cf0a8");

/** Il corpo realistico vale per arciere uomo e ragazzo (il modello è maschile). */
export function realistic(look: ManLook) {
  return look.body !== "donna" && look.body !== "ragazza";
}

/** Attrezzatura e accessori sopra il corpo realistico: parabraccio, guantino, pettorina, cappelli, capelli lunghi, mantello. */
function drawGearOnBody(g: GL3D, J: Joints, s: number, look: ManLook, lWr: Vec3, rWr: Vec3) {
  const U: Vec3 = [0, 1, 0];
  const side = v3.norm(v3.sub(J.lSh, J.rSh));
  const F = v3.norm(v3.cross(side, U));
  if (look.armguard) g.draw("tube", segment(v3.lerp(J.lEl, lWr, 0.25), v3.lerp(J.lEl, lWr, 0.92), 0.04 * s), look.armguard, { shine: 0.35 });
  if (look.tab) g.draw("sphere", trs(v3.lerp(rWr, J.rHand, 1.15), 0, [0.035 * s, 0.05 * s, 0.035 * s]), look.tab, { shine: 0.3 });
  if (look.chestguard) {
    g.draw("tube", segment(v3.add(J.lSh, v3.add(v3.scale(F, 0.03 * s), v3.scale(U, 0.03 * s))), v3.add(v3.lerp(J.chest, J.rSh, 0.6), v3.scale(F, 0.09 * s)), 0.008 * s), look.chestColor || "#1d2126");
  }
  const head = v3.add(J.neck, v3.scale(U, 0.16 * s));
  const hr = 0.11 * s;
  if (look.hat === "berretto") g.draw("sphere", basis(v3.add(head, v3.scale(U, hr * 0.45)), v3.scale(side, hr * 1.02), v3.scale(U, hr * 0.7), v3.scale(F, hr * 1.06)), look.hatColor || "#1f3a5f", { shine: 0.15 });
  else if (look.hat === "cappuccio") g.draw("sphere", basis(v3.add(head, v3.add(v3.scale(U, hr * 0.15), v3.scale(F, -hr * 0.2))), v3.scale(side, hr * 1.2), v3.scale(U, hr * 1.18), v3.scale(F, hr * 1.12)), look.hatColor || "#4b6b2e", { shine: 0.12 });
  else if (look.hat === "elmo") g.draw("sphere", basis(v3.add(head, v3.scale(U, hr * 0.35)), v3.scale(side, hr * 1.12), v3.scale(U, hr * 0.95), v3.scale(F, hr * 1.12)), "#9aa3ab", { shine: 0.9 });
  else if (look.hat === "fascia") g.draw("tube", segment(v3.add(head, v3.scale(U, hr * 0.45)), v3.add(head, v3.scale(U, hr * 0.7)), hr * 1.0), look.hatColor || "#c4473d");
  else if (look.hat === "piuma") {
    g.draw("sphere", basis(v3.add(head, v3.scale(U, hr * 0.62)), v3.scale(side, hr * 1.3), v3.scale(U, hr * 0.45), v3.scale(F, hr * 1.3)), look.hatColor || "#4b6b2e", { shine: 0.12 });
    g.draw("vane", basis(v3.add(head, v3.add(v3.scale(U, hr * 0.8), v3.scale(F, -hr * 0.5))), side, v3.scale(U, hr * 1.2), v3.scale(F, -hr * 1.6)), "#c4473d");
  }
  if (["lunghi", "coda", "treccia", "codini"].includes(look.hair ?? "") && look.hat !== "cappuccio" && look.hat !== "elmo") {
    g.capsule(v3.add(head, v3.add(v3.scale(F, -hr * 0.85), v3.scale(U, hr * 0.2))), v3.add(head, v3.add(v3.scale(F, -hr * 1.1), v3.scale(U, -hr * 1.9))), hr * 0.3, look.hairColor || "#3b2a1d", { shine: 0.35 });
  }
  if (look.cape) {
    const a = v3.add(J.neck, v3.scale(F, -0.1 * s));
    g.draw("cyl", segment(v3.add(a, v3.scale(U, -0.95 * s)), a, 0.2 * s, 0.06 * s), look.capeColor || "#5b2b6e", { shine: 0.1 });
  }
  if (look.style === "medievale") {
    g.draw("cyl", segment(v3.add(J.pelvis, [0, -0.22 * s, 0]), v3.add(J.pelvis, [0, 0.12 * s, 0]), 0.2 * s, 0.15 * s), look.shirt || "#4b6b2e", { shine: 0.1 });
    g.draw("tube", segment(v3.add(J.pelvis, [0, 0.06 * s, 0]), v3.add(J.pelvis, [0, 0.1 * s, 0]), 0.165 * s, 0.14 * s), look.trim || "#c7a03a");
  }
}
