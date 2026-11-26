import { ink, cubicPts, Tufts, Clumps, fanStrokes, MetalDefs } from "./avatar-ink";
import { PATTERN2_IDS } from "@/lib/arcieri/avatar-more";
import { EyepatchFront, EyepatchProfile, Marks2Front, Marks2Profile, Pendant, browShape } from "./avatar-more";
import { SpecialSideTorso } from "./special-details";
import { cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { tune, type AvatarLook, type Pose, nearSide, sideOf } from "@/lib/arcieri/avatar";
import { zigQ, BowDeco, Buckle, ChestEmblem, Clasp, ClothPattern, Earring, FaceFrame, FacePaintFront, FacePaintProfile, Fletching, HairOrnament, PaintStroke, Pouch, QuiverBody } from "./avatar-extras";
import { sceneById } from "@/lib/arcieri/scenes";
import { SideShoe } from "./avatar-shoes";
import { SideHand } from "./avatar-hands";
import { FaceHat, MailCoif, SideHat } from "./avatar-hats";
import { RimLightDefs } from "./avatar-light";
import { seamOf, BracerLacing, ClothButton, BeardTexture, BeltDetail, BrowHairs, ClothDetail, DetailDefs, EyeDetail, FaceShade, HairFineStrands, LeatherBand, LipDetail, SleeveDetail } from "./avatar-detail";

/**
 * L'arciere disegnato, in stile gioco: busto rivolto a chi guarda, testa girata verso il bersaglio
 * (a destra). Le braccia hanno uno scheletro con cinematica inversa, così si muovono fra le pose
 * (riposo, incocco, alzata, allungo, rilascio, accompagnamento, vittoria, fiero) in modo continuo.
 */

export function shade(hex: string, k: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, "0")}`;
}

/** mescola due colori (#rrggbb): t=0 il primo, t=1 il secondo */
export function blend(a: string, b: string, t: number) {
  const ma = /^#?([0-9a-f]{6})$/i.exec((a || "").trim());
  const mb = /^#?([0-9a-f]{6})$/i.exec((b || "").trim());
  if (!ma || !mb) return a;
  const na = Number.parseInt(ma[1], 16);
  const nb = Number.parseInt(mb[1], 16);
  const ch = (sh: number) => Math.round(((na >> sh) & 255) * (1 - t) + ((nb >> sh) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

type P = { x: number; y: number };
const p = (x: number, y: number): P => ({ x, y });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpP = (a: P, b: P, t: number) => p(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const f = (n: number) => n.toFixed(1);

/** Posa: dove stanno le mani, com'è inclinato l'arco e quanto è tesa la corda. */
type PoseDef = {
  grip: P;
  bowAngle: number;
  hand: P | null; // null = mano sulla corda (calcolata dall'arco)
  pull: number; // 0 corda a riposo, 1 ancoraggio
  hooked: boolean;
  arrow: boolean;
  fore: number; // lunghezza apparente dell'avambraccio della corda
  face?: AvatarLook["expression"] | "felice";
  /** quanto la mano sta sulla corda (0–1) durante i passaggi */
  hookW?: number;
  /** da che parte piega il gomito del braccio della corda (1 = in fuori, verso l'esterno) */
  /** da che parte sta il gomito: 1 in basso, -1 in alto; i valori in mezzo servono a passare da una posa all'altra senza scatti */
  bend?: number;
  /** la mano tiene una freccia appena presa dalla faretra */
  holding?: boolean;
};

const ANCHOR = p(166, 106);
const POSES: Record<string, PoseDef> = {
  riposo: { grip: p(194, 210), bowAngle: 6, hand: p(108, 204), pull: 0, hooked: false, arrow: false, fore: 44, bend: 1 },
  // incocco: arco basso e quasi orizzontale, la mano porta la freccia sul rest e la incastra
  incocco: { grip: p(206, 192), bowAngle: -66, hand: p(192, 184), pull: 0, hooked: false, arrow: true, fore: 48, bend: 1 },
  // aggancio e presa: tre dita sulla corda, mano dell'arco rilassata sull'impugnatura
  aggancio: { grip: p(214, 172), bowAngle: -40, hand: null, pull: 0, hooked: true, arrow: true, fore: 52, bend: 0.6 },
  predraw: { grip: p(244, 132), bowAngle: -3, hand: null, pull: 0.1, hooked: true, arrow: true, fore: 64, face: "concentrato" },
  trazione: { grip: p(249, 125), bowAngle: 0, hand: null, pull: 0.62, hooked: true, arrow: true, fore: 74, face: "concentrato" },
  allungo: { grip: p(250, 124), bowAngle: 0, hand: null, pull: 1, hooked: true, arrow: true, fore: 82, face: "concentrato" },
  mira: { grip: p(250, 124), bowAngle: 0, hand: null, pull: 1.03, hooked: true, arrow: true, fore: 83, face: "concentrato" },
  rilascio: { grip: p(250, 124), bowAngle: 2, hand: p(132, 104), pull: 0, hooked: false, arrow: false, fore: 82, face: "concentrato" },
  accompagna: { grip: p(251, 127), bowAngle: 9, hand: p(126, 106), pull: 0, hooked: false, arrow: false, fore: 80 },
  rilassa: { grip: p(214, 186), bowAngle: 22, hand: p(114, 198), pull: 0, hooked: false, arrow: false, fore: 46, bend: 1 },
  // pesca: la mano della corda va a prendere la freccia nella faretra, dietro la spalla o al fianco
  "pesca-schiena": { grip: p(204, 196), bowAngle: 10, hand: p(116, 70), pull: 0, hooked: false, arrow: false, fore: 46, bend: 1, holding: true },
  "pesca-fianco": { grip: p(204, 196), bowAngle: 10, hand: p(110, 192), pull: 0, hooked: false, arrow: false, fore: 42, bend: 1, holding: true },
  // vittoria: l'arco alzato in alto davanti, il pugno chiuso accanto al viso (non più dietro la testa)
  vittoria: { grip: p(236, 50), bowAngle: -26, hand: p(150, 114), pull: 0, hooked: false, arrow: false, fore: 40, face: "felice", bend: 1 },
  // esulta: l'arco giù lungo il fianco, il pugno che si chiude all'altezza del petto
  esulta: { grip: p(200, 212), bowAngle: 8, hand: p(104, 98), pull: 0, hooked: false, arrow: false, fore: 38, face: "felice", bend: -1 },
  // pensa: la mano al mento, l'arco a riposo
  pensa: { grip: p(196, 208), bowAngle: 5, hand: p(150, 112), pull: 0, hooked: false, arrow: false, fore: 40, face: "concentrato", bend: 1 },
  // mostra l'arco: tenuto di traverso davanti, la mano libera sul flettente
  mostra: { grip: p(214, 160), bowAngle: -78, hand: p(176, 150), pull: 0, hooked: false, arrow: false, fore: 44, face: "sorriso", bend: 1 },
  // arco in spalla: la mano dell'arco alta, il legno appoggiato alla spalla
  spalla: { grip: p(190, 118), bowAngle: 52, hand: p(110, 196), pull: 0, hooked: false, arrow: false, fore: 42, face: "sereno", bend: 1 },
  // fiero: mano sul fianco, gomito in fuori
  fiero: { grip: p(194, 206), bowAngle: 2, hand: p(122, 190), pull: 0, hooked: false, arrow: false, fore: 40, face: "sorriso", bend: 1 },
  // saluto: la mano libera si alza aperta accanto alla testa
  saluto: { grip: p(194, 208), bowAngle: 4, hand: p(92, 60), pull: 0, hooked: false, arrow: false, fore: 40, face: "sorriso", bend: 1 },
};

/** da fermo: la mano va a toccare la corda per controllarla */
const CHECK_STRING: PoseDef = { grip: p(208, 184), bowAngle: -24, hand: p(198, 168), pull: 0, hooked: false, arrow: false, fore: 48, bend: 1 };

export const PHASE_NAMES: Record<string, string> = {
  riposo: "Posizione",
  incocco: "Incocco",
  aggancio: "Aggancio e presa",
  predraw: "Pre-trazione",
  trazione: "Trazione",
  allungo: "Ancoraggio",
  mira: "Trasferimento e mira",
  rilascio: "Rilascio",
  accompagna: "Accompagnamento",
  rilassa: "Rilassamento",
  "pesca-schiena": "Prendo la freccia",
  "pesca-fianco": "Prendo la freccia",
};

type Step = [string, number];
type Plan = { steps: Step[]; cycle: number; releases: number[] };

/**
 * Sequenza di tiro dell'avatar: completa (11 tempi), rapida o da gara (mira lunga), con le frecce
 * della volée in fila e il rilassamento alla fine.
 */
export function routinePlan(look: Pick<AvatarLook, "routine" | "hold" | "volley"> & { quiverPlace?: string }): Plan {
  const pesca = look.quiverPlace === "schiena" ? "pesca-schiena" : "pesca-fianco";
  const hold = Math.max(0.6, Math.min(6, Number(look.hold) || 2));
  const n = Math.max(1, Math.min(6, Number(look.volley) || 1));
  const kind = look.routine ?? "completa";
  const one: Step[] =
    kind === "rapida"
      ? [[pesca, 0.55], ["aggancio", 0.5], ["predraw", 0.45], ["allungo", 0.75], ["mira", hold * 0.6], ["rilascio", 0.12], ["accompagna", 0.7]]
      : [[pesca, 0.8], ["incocco", 0.9], ["aggancio", 0.7], ["predraw", 0.8], ["trazione", 0.7], ["allungo", 0.5], ["mira", kind === "gara" ? hold + 1.2 : hold], ["rilascio", 0.12], ["accompagna", kind === "gara" ? 1.4 : 1.1]];
  const steps: Step[] = [["riposo", kind === "rapida" ? 0.7 : 1.3]];
  for (let i = 0; i < n; i += 1) {
    if (i > 0) steps.push(["rilassa", 0.6]);
    steps.push(...one);
  }
  steps.push(["rilassa", 0.8], ["riposo", 0.6]);
  const releases: number[] = [];
  let acc = 0;
  for (const [name, d] of steps) {
    if (name === "rilascio") releases.push(acc);
    acc += d;
  }
  return { steps, cycle: acc, releases };
}

const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function poseAt(plan: Plan, t: number): { def: PoseDef; release: number | null; phase: string } {
  const { steps, releases } = plan;
  let acc = 0;
  let release: number | null = null;
  for (const r of releases) if (t >= r && t - r < 1.2) release = t - r;
  for (let i = 0; i < steps.length; i += 1) {
    const [name, d] = steps[i];
    if (t < acc + d) {
      const raw = (t - acc) / d;
      const prev = POSES[steps[(i + steps.length - 1) % steps.length][0]];
      const cur = POSES[name];
      // il rilascio è uno scatto; il resto scorre morbido; nella mira resta un filo di espansione
      const k = name === "rilascio" ? Math.min(1, raw * 1.6) : easeIO(raw);
      return { def: mix(prev, cur, k), release, phase: PHASE_NAMES[name] ?? name };
    }
    acc += d;
  }
  return { def: POSES.riposo, release, phase: PHASE_NAMES.riposo };
}

/** avvicina la posa mostrata a quella voluta: posizioni morbide, stati (freccia, mano sulla corda) subito */
function smoothTo(a: PoseDef, b: PoseDef, t: number): PoseDef {
  return {
    ...b,
    grip: lerpP(a.grip, b.grip, t),
    bowAngle: lerp(a.bowAngle, b.bowAngle, t),
    // la mano libera che va sulla corda ci scivola (resta il suo punto finché l'aggancio non è quasi completo),
    // invece di comparire di colpo sulla corda
    hand: a.hand && b.hand ? lerpP(a.hand, b.hand, t) : a.hand && !b.hand && (a.hookW ?? (a.hooked ? 1 : 0)) < 0.97 ? a.hand : b.hand,
    pull: lerp(a.pull, b.pull, t),
    fore: lerp(a.fore, b.fore, t),
    hookW: lerp(a.hookW ?? (a.hooked ? 1 : 0), b.hookW ?? (b.hooked ? 1 : 0), t),
    bend: lerp(a.bend ?? -1, b.bend ?? -1, t),
  };
}

/** spalla del braccio della corda (corporatura media): i tragitti della mano le girano attorno */
const DRAW_SHOULDER = p(124, 128);

/**
 * Tragitto della mano libera fra due pose. Se la linea dritta passa sulla spalla (dalla nuca al fianco
 * dopo il tiro) il gomito non sa più da che parte stare e il braccio si ribalta in un fotogramma:
 * lì il tragitto si incurva dietro la spalla, restando uguale alle due estremità.
 */
function handPath(a: P, b: P, t: number): P {
  const q = lerpP(a, b, t);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy);
  if (L < 1) return q;
  const u = Math.max(0, Math.min(1, ((DRAW_SHOULDER.x - a.x) * dx + (DRAW_SHOULDER.y - a.y) * dy) / (L * L)));
  const cx = a.x + dx * u;
  const cy = a.y + dy * u;
  const dist = Math.hypot(DRAW_SHOULDER.x - cx, DRAW_SHOULDER.y - cy);
  const R = 30;
  if (dist >= R || u <= 0 || u >= 1) return q;
  // dalla parte opposta alla spalla; se ci passa proprio sopra, dietro (verso la schiena)
  let nx = -dy / L;
  let ny = dx / L;
  const side = (cx - DRAW_SHOULDER.x) * nx + (cy - DRAW_SHOULDER.y) * ny;
  if (side < -1e-6 || (Math.abs(side) <= 1e-6 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  // la spinta è massima dove il tragitto passa più vicino e svanisce alle estremità
  const w = t <= u ? Math.sin((Math.PI / 2) * (t / u)) : Math.sin((Math.PI / 2) * ((1 - t) / (1 - u)));
  const push = (R - dist) * w * w;
  return p(q.x + nx * push, q.y + ny * push);
}

function mix(a: PoseDef, b: PoseDef, t: number): PoseDef {
  return {
    grip: lerpP(a.grip, b.grip, t),
    bowAngle: lerp(a.bowAngle, b.bowAngle, t),
    hand: a.hand && b.hand ? handPath(a.hand, b.hand, t) : (a.hand ?? b.hand),
    pull: lerp(a.pull, b.pull, t),
    hooked: t < 0.5 ? a.hooked : b.hooked,
    hookW: lerp(a.hookW ?? (a.hooked ? 1 : 0), b.hookW ?? (b.hooked ? 1 : 0), t),
    arrow: t < 0.5 ? a.arrow : b.arrow,
    fore: lerp(a.fore, b.fore, t),
    face: t < 0.5 ? a.face : b.face,
    // il gomito gira con continuità: niente braccio che si ribalta a metà del movimento
    bend: lerp(a.bend ?? -1, b.bend ?? -1, t),
    holding: t < 0.5 ? a.holding : b.holding,
  };
}

/** Due ossa: dalla spalla verso la mano, con il gomito dalla parte giusta. */
function ik(s: P, target: P, l1: number, l2: number, bend: number) {
  const dx = target.x - s.x;
  const dy = target.y - s.y;
  const d = Math.max(1, Math.min(l1 + l2 - 0.01, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  // il gomito ruota attorno all'asse spalla-mano (come un braccio vero visto di lato):
  // con bend fra -1 e 1 passa per il centro in scorcio, invece di ribaltarsi di colpo
  const along = Math.cos(a) * l1;
  const side = Math.sin(a) * l1 * Math.max(-1, Math.min(1, bend));
  const e = p(
    s.x + Math.cos(base) * along - Math.sin(base) * side,
    s.y + Math.sin(base) * along + Math.cos(base) * side,
  );
  const hand = p(s.x + Math.cos(base) * d, s.y + Math.sin(base) * d);
  return { elbow: e, hand };
}

/** Forma dell'arco nelle coordinate dell'impugnatura (y verso l'alto negativo). */
function bowGeom(type: string, pull: number) {
  const back = (n: number) => n * pull;
  switch (type) {
    case "longbow":
      return { riser: 0, tipX: -12 - back(14), tipY: 116 - back(6), wood: true, recurve: false, siyah: false, cams: false, width: 5.6 };
    case "flatbow":
      return { riser: 0, tipX: -10 - back(14), tipY: 104 - back(6), wood: true, recurve: false, siyah: false, cams: false, width: 8 };
    case "storico":
    case "asiatico":
      return { riser: 14, tipX: -2 - back(10), tipY: 78 - back(4), wood: true, recurve: false, siyah: true, cams: false, width: 6 };
    case "compound":
      return { riser: 42, tipX: -14 - back(4), tipY: 62, wood: false, recurve: false, siyah: false, cams: true, width: 7 };
    case "ricurvo":
      return { riser: 30, tipX: -12 - back(14), tipY: 94 - back(6), wood: true, recurve: true, siyah: false, cams: false, width: 5.2 };
    default:
      return { riser: 36, tipX: -14 - back(14), tipY: 102 - back(6), wood: false, recurve: true, siyah: false, cams: false, width: 5 };
  }
}

function rot(pt: P, deg: number, origin: P): P {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return p(origin.x + pt.x * c - pt.y * s, origin.y + pt.x * s + pt.y * c);
}

/** Il disegno dell'arciere in una posa data (calcolata dall'animazione o fissa). */
function Figure({ look, def, t, flying, blink, uid, wind = -1.4, cssBlink = false }: { look: AvatarLook; def: PoseDef; t: number; flying: number | null; blink: boolean; uid: string; wind?: number; cssBlink?: boolean }) {
  const woman = look.body === "donna" || look.body === "ragazza";
  const kid = look.body === "ragazzo" || look.body === "ragazza";
  const W = bodyWidth(look);
  const skin = look.skin;
  const skinD = shade(skin, -0.2);
  const breath = look.idle === "fermo" ? 0 : Math.sin(t * 1.7) * 0.9;
  const longSleeves = ["felpa", "giacca", "camicia", "tunica", "tunica-lunga", "farsetto", "ranger", "incrociata", "cappotto", "giubba", "cappotto-lungo", "cotta", "giubbetto"].includes(look.top);
  const medievalTop = ["tunica", "tunica-lunga", "farsetto", "ranger", "incrociata", "cappotto", "giubba", "cappotto-lungo", "cotta"].includes(look.top);
  const shirt = look.shirt;
  // il vento fa ondeggiare il mantello a raffiche: a favore lo spinge sotto il corpo, contro lo fa
  // svolazzare indietro e lo solleva; senza vento oscilla appena
  const gust = 0.65 + 0.25 * Math.sin(t * 0.9) + 0.15 * Math.sin(t * 2.3 + 1);
  const capeSway = Math.sin(t * 1.3) * 2.5 + Math.max(-30, Math.min(12, wind * 5.2 * gust));

  // scheletro
  const SD = p(124 - 4 * (W - 1) * 10, 128 + breath * 0.3);
  const SB = p(170 + 4 * (W - 1) * 10, 129 + breath * 0.3);
  const neck = p(148, 118);
  const H = p(150, 86 + breath * 0.25);
  const g = bowGeom(look.bowType, def.pull);
  // corda: punto d'incocco a riposo e all'ancoraggio
  const restLocal = p(g.cams ? -16 : g.tipX + 4 + (g.recurve ? 0 : -2), -3);
  const bowArm = ik(SB, def.grip, 42, 41, 1);
  const grip = bowArm.hand;
  const restW = rot(restLocal, def.bowAngle, grip);
  const tremble = def.pull > 0.95 ? Math.sin(t * 23) * 0.35 : 0;
  const stringHand = lerpP(restW, p(ANCHOR.x, ANCHOR.y + tremble), def.pull);
  const hookW = def.hookW ?? (def.hooked ? 1 : 0);
  const handTarget = def.hand ? lerpP(def.hand, stringHand, hookW) : stringHand;
  const drawArm = ik(SD, handTarget, 40, def.fore, def.bend ?? -1);
  const drawHand = drawArm.hand;
  const tipTop = rot(p(g.tipX, -g.tipY), def.bowAngle, grip);
  const tipBot = rot(p(g.tipX, g.tipY), def.bowAngle, grip);
  const nockPt = hookW > 0.5 ? drawHand : null;

  const face = def.face ?? look.expression;
  const torsoW = (woman ? 0.9 : 1) * W;
  const cx = 147;
  const shoulderL = cx - 26 * torsoW;
  const shoulderR = cx + 26 * torsoW;
  const waistL = cx - (woman ? 17 : 21) * W;
  const waistR = cx + (woman ? 17 : 21) * W;
  const hipL = cx - (woman ? 23 : 21) * W;
  const hipR = cx + (woman ? 23 : 21) * W;
  const torso = `M${f(shoulderL)} 124 C${f(shoulderL + 6)} 116 ${f(shoulderR - 6)} 116 ${f(shoulderR)} 124 C${f(shoulderR + 2)} 150 ${f(waistR + 2)} 172 ${f(waistR)} 186 C${f(hipR)} 196 ${f(hipR)} 204 ${f(hipR)} 210 L${f(hipL)} 210 C${f(hipL)} 204 ${f(hipL)} 196 ${f(waistL)} 186 C${f(waistL - 2)} 172 ${f(shoulderL - 2)} 150 ${f(shoulderL)} 124 Z`;
  const TUNIC: Record<string, number> = { tunica: 252, "tunica-lunga": 266, ranger: 262, incrociata: 250, cappotto: 258, "cappotto-lungo": 292, giubba: 230, cotta: 240, giubbetto: 234 };
  // la barra "lunghezza" allunga o accorcia la veste; anche una maglia può scendere sui fianchi
  const stretch = (tune(look.topLength, 50, 0, 100) - 50) * 1.3;
  const tunicLen = Math.round(Math.max(206, Math.min(312, (TUNIC[look.top] ?? 200) + stretch)));
  const tunicD = `M${f(hipL + 1)} 200 L${f(hipR - 1)} 200 C${f(hipR + 4)} 224 ${f(hipR + 10)} ${tunicLen - 18} ${f(hipR + 12)} ${tunicLen} Q${f(cx)} ${tunicLen + 5} ${f(hipL - 12)} ${tunicLen} C${f(hipL - 10)} ${tunicLen - 18} ${f(hipL - 4)} 224 ${f(hipL + 1)} 200 Z`;
  const longTunic = tunicLen > 216;

  // gambe
  const kneeB = 2 + Math.sin(t * 1.7) * 0.6;
  const legs = {
    back: { hip: p(cx - 12 * W, 208), knee: p(cx - 18 * W, 270 - kneeB), ankle: p(cx - 24, 328) },
    front: { hip: p(cx + 12 * W, 208), knee: p(cx + 19 * W, 270 - kneeB), ankle: p(cx + 26, 328) },
  };
  const legW = 19 * W;

  // contorno scuro e lume chiaro: il tratto da illustrazione dei giochi
  const OUT = "#2a1d14";
  const limb = (a: P, b: P, w: number, color: string, outline = true, tex?: string) => (
    <g>
      {outline ? <line x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} stroke={OUT} strokeOpacity="0.9" strokeWidth={w + 2.4} strokeLinecap="round" /> : null}
      <line x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} stroke={color} strokeWidth={w} strokeLinecap="round" />
      {tex ? <line x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} stroke={`url(#${tex})`} strokeWidth={w} strokeLinecap="round" /> : null}
      {outline && w > 8 ? <line x1={f(a.x - w * 0.18)} y1={f(a.y - w * 0.1)} x2={f(b.x - w * 0.18)} y2={f(b.y - w * 0.1)} stroke="#fff" strokeOpacity="0.13" strokeWidth={w * 0.28} strokeLinecap="round" /> : null}
    </g>
  );

  const shoe = (ankle: P) => <SideShoe look={look} a={ankle} uid={uid} skin={skin} />;

  const leg = (L: typeof legs.back, key: string) => {
    const tight = look.bottom === "calzamaglia";
    const shorts = look.bottom === "pantaloncini" || look.bottom === "gonna";
    const brache = look.bottom === "brache";
    const larghi = look.bottom === "larghi";
    const w = tight ? legW * 0.82 : brache ? legW * 1.1 : larghi ? legW * 1.32 : legW;
    return (
      <g key={key}>
        {shorts ? (
          <>
            {limb(L.knee, L.ankle, w * 0.72, skin)}
            {limb(lerpP(L.hip, L.knee, 0.6), L.knee, w * 0.78, skin)}
            {limb(L.hip, lerpP(L.hip, L.knee, 0.72), w, `url(#${uid}pants)`)}
          </>
        ) : (
          <>
            {limb(L.hip, L.knee, w, `url(#${uid}pants)`)}
            {larghi ? (
              <>
                {limb(L.knee, lerpP(L.knee, L.ankle, 0.82), w * 0.95, `url(#${uid}pants)`)}
                {limb(lerpP(L.knee, L.ankle, 0.8), L.ankle, w * 0.62, shade(look.pants, -0.2))}
                <path d={`M${f(L.knee.x - 8)} ${f(L.knee.y + 6)} q6 7 15 1 M${f(L.knee.x - 7)} ${f(L.knee.y + 24)} q6 6 14 0 M${f(L.hip.x - 6)} ${f(L.hip.y + 20)} q6 7 13 1 M${f(L.ankle.x - 7)} ${f(L.ankle.y - 16)} q6 4 13 0`} stroke={shade(look.pants, -0.38)} strokeWidth="1.1" fill="none" />
              </>
            ) : limb(L.knee, L.ankle, w * 0.86, `url(#${uid}pants)`)}
            {brache ? <path d={`M${f(L.knee.x - 6)} ${f(L.knee.y + 8)} q5 5 12 0 M${f(L.hip.x - 4)} ${f(L.hip.y + 22)} q4 6 10 1`} stroke={shade(look.pants, -0.35)} strokeWidth="1" fill="none" /> : null}
            {look.special === "simone-inverno" && look.bottom === "cargo" && !shorts ? (
              <g>
                {limb(lerpP(L.hip, L.knee, 0.22), L.knee, w * 0.4, "#3a3d42")}
                {limb(L.knee, lerpP(L.knee, L.ankle, 0.8), w * 0.36, "#3a3d42")}
              </g>
            ) : null}
            {look.bottom === "cargo" ? (() => {
              const c = lerpP(L.hip, L.knee, 0.58);
              return (
                <g>
                  <rect x={f(c.x - 7)} y={f(c.y - 8)} width="14" height="15" rx="2" fill={shade(look.pants, -0.12)} stroke={shade(look.pants, -0.45)} strokeWidth="0.9" />
                  <path d={`M${f(c.x - 7)} ${f(c.y - 3)} h14`} stroke={shade(look.pants, -0.45)} strokeWidth="0.9" />
                  <circle cx={f(c.x)} cy={f(c.y - 5.6)} r="0.9" fill={shade(look.pants, 0.4)} />
                </g>
              );
            })() : null}
            {look.bottom === "jeans" ? <line x1={f(L.hip.x + 4)} y1={f(L.hip.y + 6)} x2={f(L.ankle.x + 3)} y2={f(L.ankle.y - 4)} stroke={shade(look.pants, 0.35)} strokeWidth="0.8" strokeDasharray="3 2" /> : null}
          </>
        )}
        {shoe(L.ankle)}
        {look.wraps ? (
          <g>
            {limb(lerpP(L.knee, L.ankle, 0.1), lerpP(L.knee, L.ankle, 0.92), w * 0.78, look.wrapsColor)}
            {[0.18, 0.32, 0.46, 0.6, 0.74, 0.86].map((k) => {
              const c = lerpP(L.knee, L.ankle, k);
              return <path key={k} d={`M${f(c.x - w * 0.4)} ${f(c.y - 4)} L${f(c.x + w * 0.4)} ${f(c.y + 4)} M${f(c.x + w * 0.4)} ${f(c.y - 4)} L${f(c.x - w * 0.4)} ${f(c.y + 4)}`} stroke={shade(look.wrapsColor, -0.45)} strokeWidth="1.6" strokeLinecap="round" />;
            })}
          </g>
        ) : null}
      </g>
    );
  };

  // braccio: manica corta o lunga, avambraccio, mano
  const hook = hookW;
  const arm = (s: P, e: P, h: P, which: "bow" | "draw") => {
    const sleeveLong = longSleeves || look.top === "corpetto" || look.top === "gilet";
    const sleeveless = look.top === "canotta";
    const sleeve = sleeveless ? skin : look.top === "gilet" || look.top === "corpetto" ? look.sleeves || look.trim : look.top === "giubba" ? look.sleeves || "#c9b48a" : look.top === "giubbetto" ? look.sleeves || "#f1ece0" : look.top === "cotta" ? look.sleeves || "#8d949b" : look.sleeves || shirt;
    const upW = 15 * W;
    const foreW = 11 * W;
    return (
      <g>
        {limb(s, e, upW, sleeve, true, sleeveless ? undefined : `${uid}linen`)}
        {sleeveLong ? limb(e, lerpP(e, h, 0.86), foreW + 1.5, sleeve, true, `${uid}linen`) : limb(e, h, foreW, skin)}
        {sleeveLong ? limb(lerpP(e, h, 0.86), h, foreW - 1, skin) : null}
        {sleeveless ? null : <SleeveDetail s={s} e={e} h={h} w={upW} color={seamOf(sleeve)} long={sleeveLong} />}
        {medievalTop ? <circle cx={f(lerp(e.x, h.x, 0.84))} cy={f(lerp(e.y, h.y, 0.84))} r={6.5 * W} fill={look.trim} /> : null}
        {!sleeveLong && !sleeveless ? <circle cx={f(lerp(s.x, e.x, 0.6))} cy={f(lerp(s.y, e.y, 0.6))} r={upW / 2 + 0.4} fill={shade(sleeve, -0.15)} /> : null}
        {look.armband && which === "draw" ? (() => {
          const a1 = lerpP(s, e, 0.36);
          const a2 = lerpP(s, e, 0.5);
          return <line x1={f(a1.x)} y1={f(a1.y)} x2={f(a2.x)} y2={f(a2.y)} stroke={look.trim} strokeWidth={upW + 1.4} strokeLinecap="butt" />;
        })() : null}
        {look.watch && which === "draw" ? (() => {
          const w0 = lerpP(e, h, 0.8);
          return (
            <g>
              <circle cx={f(w0.x)} cy={f(w0.y)} r={foreW / 2 + 1.2} fill="#1d2126" />
              <circle cx={f(w0.x)} cy={f(w0.y)} r="3" fill="#dfe6ee" stroke="#9aa3ad" strokeWidth="0.6" />
              <path d={`M${f(w0.x)} ${f(w0.y)} l0 -2 M${f(w0.x)} ${f(w0.y)} l1.6 0.6`} stroke="#14181c" strokeWidth="0.6" />
            </g>
          );
        })() : null}
        {!sleeveLong ? limb(lerpP(s, e, 0.62), e, foreW + 1, skin) : null}
        {which === "bow" && ["rune", "onde", "freccia", "drago", "luna", "foglia", "bersaglio", "spine"].includes(look.tattoo) ? (() => {
          // il tatuaggio sta sull'avambraccio, dove la manica non arriva (o sul braccio, se senza maniche)
          const a = sleeveLong ? null : sleeveless ? lerpP(s, e, 0.5) : lerpP(e, h, 0.2);
          if (!a) return null;
          const ink = "#24324a";
          const ang = (Math.atan2((sleeveless ? e.y - s.y : h.y - e.y), (sleeveless ? e.x - s.x : h.x - e.x)) * 180) / Math.PI;
          return (
            <g transform={`translate(${f(a.x)} ${f(a.y)}) rotate(${f(ang)})`} opacity="0.8">
              {look.tattoo === "rune" ? <path d="M-6 -2 l2 4 l2 -4 M0 -2 v4 M2 -2 l2 2 l-2 2" stroke={ink} strokeWidth="0.9" fill="none" /> : null}
              {look.tattoo === "onde" ? <path d="M-7 0 q2 -3 4 0 t4 0 t4 0" stroke={ink} strokeWidth="1" fill="none" /> : null}
              {look.tattoo === "freccia" ? <path d="M-7 0 H6 M6 0 l-3 -2 M6 0 l-3 2 M-7 0 l-2 -2 M-7 0 l-2 2" stroke={ink} strokeWidth="0.9" fill="none" /> : null}
              {look.tattoo === "drago" ? <path d="M-7 1 C-4 -3 -1 3 2 -1 C4 -3 6 -1 7 -2 M5 -2 l2 -1" stroke={ink} strokeWidth="1.1" fill="none" /> : null}
              {look.tattoo === "luna" ? <path d="M1.5 -3.4 A3.6 3.6 0 1 0 1.5 3.4 A2.8 2.8 0 1 1 1.5 -3.4 Z" fill={ink} /> : null}
              {look.tattoo === "foglia" ? <g><path d="M-6 1 C-3 -3.4 3 -3.4 6 0 C3 3 -3 3.4 -6 1 Z" fill="none" stroke={ink} strokeWidth="0.9" /><path d="M-6 1 L5 0" stroke={ink} strokeWidth="0.6" /></g> : null}
              {look.tattoo === "bersaglio" ? <g fill="none" stroke={ink}><circle r="3.6" strokeWidth="0.8" /><circle r="1.8" strokeWidth="0.8" /><circle r="0.6" fill={ink} /></g> : null}
              {look.tattoo === "spine" ? <path d="M-7 0 H7 M-5 0 l-1 -2 M-2 0 l-1 -2 M1 0 l-1 -2 M4 0 l-1 -2 M-5 0 l-1 2 M-2 0 l-1 2 M1 0 l-1 2 M4 0 l-1 2" stroke={ink} strokeWidth="0.8" fill="none" /> : null}
            </g>
          );
        })() : null}
        {which === "bow" && look.tattoo === "punti" ? <g fill="#24324a" opacity="0.75">{[-2.4, 0, 2.4].map((d) => <circle key={d} cx={f(h.x - 2 + d)} cy={f(h.y - 3)} r="0.8" />)}</g> : null}
        {which === "bow" ? (
          <>
            <line x1={f(lerp(e.x, h.x, 0.18))} y1={f(lerp(e.y, h.y, 0.18))} x2={f(lerp(e.x, h.x, 0.78))} y2={f(lerp(e.y, h.y, 0.78))} stroke={look.armguard} strokeWidth={foreW + 3} strokeLinecap="round" />
            <line x1={f(lerp(e.x, h.x, 0.3))} y1={f(lerp(e.y, h.y, 0.3) - 6)} x2={f(lerp(e.x, h.x, 0.3))} y2={f(lerp(e.y, h.y, 0.3) + 6)} stroke={shade(look.armguard, 0.45)} strokeWidth="1" />
            <line x1={f(lerp(e.x, h.x, 0.6))} y1={f(lerp(e.y, h.y, 0.6) - 6)} x2={f(lerp(e.x, h.x, 0.6))} y2={f(lerp(e.y, h.y, 0.6) + 6)} stroke={shade(look.armguard, 0.45)} strokeWidth="1" />
          </>
        ) : null}
        {look.bracers ? (
          <g>
            <line x1={f(lerp(e.x, h.x, 0.32))} y1={f(lerp(e.y, h.y, 0.32))} x2={f(lerp(e.x, h.x, 0.86))} y2={f(lerp(e.y, h.y, 0.86))} stroke={OUT} strokeOpacity="0.8" strokeWidth={foreW + 5} strokeLinecap="round" />
            <line x1={f(lerp(e.x, h.x, 0.32))} y1={f(lerp(e.y, h.y, 0.32))} x2={f(lerp(e.x, h.x, 0.86))} y2={f(lerp(e.y, h.y, 0.86))} stroke={look.bracers} strokeWidth={foreW + 4} strokeLinecap="round" />
            <LeatherBand uid={uid} a={lerpP(e, h, 0.34)} b={lerpP(e, h, 0.84)} w={foreW + 4} color={shade(look.bracers, 0.6)} />
            <BracerLacing a={lerpP(e, h, 0.42)} b={lerpP(e, h, 0.74)} w={foreW + 4} color={shade(look.bracers, 0.6)} />
          </g>
        ) : null}
        <SideHand h={h} e={e} r={7.4 * W} skin={skin} gloves={Boolean(look.gloves)} kind={which === "bow" ? "bow" : hook > 0.5 ? "draw" : "free"} />
        {which === "draw" ? (
          <g>
            <rect x={f(h.x + 1)} y={f(h.y - 6.5)} width="8" height="13" rx="2.5" fill={look.tab} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.4" />
            <path d={`M${f(h.x + 3)} ${f(h.y - 3)} h5 M${f(h.x + 3)} ${f(h.y + 1)} h5 M${f(h.x + 3)} ${f(h.y + 5)} h5`} stroke={shade(look.tab, 0.4)} strokeWidth="0.35" />
          </g>
        ) : null}
      </g>
    );
  };

  // arco
  const limbPath = (sign: 1 | -1) => {
    const r = g.riser;
    const start = `M2 ${f(-r * sign)}`;
    if (g.siyah) {
      return `${start} C8 ${f(-(r + (g.tipY - r) * 0.35) * sign)} 6 ${f(-(g.tipY - 22) * sign)} -4 ${f(-(g.tipY - 14) * sign)} L${f(g.tipX + 6)} ${f(-g.tipY * sign)}`;
    }
    const c1 = `4 ${f(-(r + (g.tipY - r) * 0.4) * sign)}`;
    const c2 = `${f(g.tipX * 0.45)} ${f(-(g.tipY - 14) * sign)}`;
    let d = `${start} C${c1} ${c2} ${f(g.tipX)} ${f(-g.tipY * sign)}`;
    if (g.recurve) d += ` C${f(g.tipX - 3)} ${f(-(g.tipY + 5) * sign)} ${f(g.tipX + 2)} ${f(-(g.tipY + 10) * sign)} ${f(g.tipX + 8)} ${f(-(g.tipY + 9) * sign)}`;
    return d;
  };
  const riserFill = g.wood ? `url(#${uid}wood)` : `url(#${uid}riser)`;
  const limbStroke = look.limbs ? look.limbs : g.wood ? `url(#${uid}wood)` : "#15191d";
  const limbBase = look.limbs || (g.wood ? "#9b6334" : "#15191d");
  const metal = !g.wood && !g.cams;
  // punta di ogni flettente: dove si aggancia la corda
  const tipAt = (sign: 1 | -1) => (g.recurve ? p(g.tipX + 8, -(g.tipY + 9) * sign) : g.siyah ? p(g.tipX + 6, -g.tipY * sign) : p(g.tipX, -g.tipY * sign));
  const longWood = look.bowType === "longbow" || look.bowType === "flatbow";
  const bow = (
    <g transform={`translate(${f(grip.x)} ${f(grip.y)}) rotate(${f(def.bowAngle)})`}>
      {/* flettenti: contorno, corpo, più spessi vicino al riser, lamina del ventre e luce */}
      {[1, -1].map((s) => (
        <g key={s}>
          <path d={limbPath(s as 1 | -1)} stroke={OUTLINE} strokeOpacity="0.85" strokeWidth={g.width + 2.2} strokeLinecap="round" fill="none" />
          <path d={limbPath(s as 1 | -1)} stroke={limbStroke} strokeWidth={g.width} strokeLinecap="round" fill="none" />
          <path d={limbPath(s as 1 | -1)} pathLength={100} strokeDasharray="42 100" stroke={limbStroke} strokeWidth={g.width + 1.6} strokeLinecap="round" fill="none" />
          <path d={limbPath(s as 1 | -1)} stroke={g.wood ? shade(limbBase, 0.35) : shade(limbBase, 0.5)} strokeOpacity={g.wood ? 0.4 : 0.12} strokeWidth={Math.max(0.6, g.width * 0.18)} strokeLinecap="round" fill="none" />
          {/* riflesso al centro del flettente, sottile: nessun filo chiaro sui bordi */}
          <path d={limbPath(s as 1 | -1)} stroke="#fff" strokeOpacity="0.08" strokeWidth={0.35} strokeLinecap="round" fill="none" />
          {!g.cams ? (() => {
            const tp = tipAt(s as 1 | -1);
            return (
              <g>
                <circle cx={f(tp.x)} cy={f(tp.y)} r={longWood ? 2.6 : 2.1} fill={longWood || g.siyah ? "#efe3c4" : "#2a2f35"} stroke={OUTLINE} strokeOpacity="0.8" strokeWidth="0.7" />
                <circle cx={f(tp.x)} cy={f(tp.y)} r="0.8" fill={look.string || "#f4f1ea"} />
              </g>
            );
          })() : null}
          {/* tasche dei flettenti e bulloni sui riser moderni */}
          {g.recurve && g.riser > 0 ? (
            <g>
              <rect x="-5" y={f(s > 0 ? -g.riser - 3 : g.riser - 4)} width="11" height="7" rx="2" fill={metal ? "#2a2f35" : "#3a2414"} stroke={OUTLINE} strokeOpacity="0.75" strokeWidth="0.6" />
              <circle cx="0.5" cy={f(s > 0 ? -g.riser + 0.5 : g.riser - 0.5)} r="1.5" fill="#c9d0d8" />
            </g>
          ) : null}
          {g.siyah ? <path d={`M-1 ${f(-(g.tipY - 22) * s)} l4 ${f(-4 * s)}`} stroke="#e8d6a8" strokeWidth="2.2" strokeLinecap="round" /> : null}
        </g>
      ))}
      <BowDeco kind={look.bowDeco} up={[g.tipX, -g.tipY]} down={[g.tipX, g.tipY]} color={look.trim} />
      {g.siyah ? (
        <>
          <rect x="-3" y={f(-g.tipY * 0.62)} width="9" height="5" rx="1" fill="#c9a46a" transform="rotate(-8)" />
          <rect x="-3" y={f(g.tipY * 0.62 - 5)} width="9" height="5" rx="1" fill="#c9a46a" transform="rotate(8)" />
          {[-1, 1].map((k) => <path key={k} d={`M0 ${f(k * 20)} q3 ${f(k * 6)} 0 ${f(k * 12)}`} stroke="#8a2f2f" strokeWidth="1.4" fill="none" />)}
        </>
      ) : null}
      {g.cams ? (
        <g>
          {/* cavi incrociati, guidacavi e camme eccentriche con fori */}
          <path d={`M${f(g.tipX + 4)} ${f(-g.tipY + 5)} L${f(g.tipX + 3)} ${f(g.tipY - 4)} M${f(g.tipX - 2)} ${f(-g.tipY + 3)} L${f(g.tipX + 6)} ${f(g.tipY - 6)}`} stroke="#3a3f45" strokeWidth="1" />
          <path d="M-2 -6 L-20 -6" stroke="#9aa3ad" strokeWidth="2" strokeLinecap="round" />
          <rect x="-24" y="-9" width="6" height="6" rx="1.5" fill="#2a2f35" />
          {[-1, 1].map((k) => (
            <g key={k} transform={`translate(${f(g.tipX)} ${f(k * g.tipY)})`}>
              <ellipse cx="0" cy="0" rx="8.4" ry="7.2" fill="#b7c0c8" stroke="#2a2f35" strokeWidth="1.2" />
              <ellipse cx="1.2" cy={f(-k * 0.8)} rx="4.6" ry="4" fill="#8a939c" />
              {[0, 1, 2].map((h) => <circle key={h} cx={f(Math.cos(h * 2.1) * 5.4)} cy={f(Math.sin(h * 2.1) * 4.6)} r="1" fill="#2a2f35" />)}
              <circle cx="0" cy="0" r="1.3" fill="#e3a21a" />
            </g>
          ))}
        </g>
      ) : null}
      {/* riser: sagoma con finestra, impugnatura e appoggio della freccia */}
      {g.riser > 0 ? (
        <g>
          <path d={`M-4 ${f(-g.riser)} L6 ${f(-g.riser)} C7 ${f(-g.riser * 0.5)} 7.5 -12 6 -7 L6 ${f(g.riser)} L-4 ${f(g.riser)} C-5 ${f(g.riser * 0.6)} -5 16 -8 9 C-9 4 -8 -6 -5 -11 C-4 ${f(-g.riser * 0.5)} -4 ${f(-g.riser * 0.8)} -4 ${f(-g.riser)} Z`} fill={riserFill} stroke={OUTLINE} strokeOpacity="0.85" strokeWidth="1" />
          {metal || g.cams ? <path d={`M1 ${f(-g.riser + 6)} L5 ${f(-g.riser + 6)} L5 -9 L1.5 -9 Z`} fill="#000" opacity="0.32" /> : null}
          {metal || g.cams ? <path d={`M-1 ${f(g.riser - 6)} L4 ${f(g.riser - 6)} L4 14 Z`} fill="#000" opacity="0.25" /> : null}
          <path d="M-7.6 -6 C-8.6 0 -8 8 -5 12 L1 12 L1 -6 Z" fill={g.wood ? "#3a2414" : "#1d2126"} opacity="0.85" />
          {[0, 1, 2, 3].map((k) => <path key={k} d={`M-7 ${-3 + k * 3.6} L0 ${-4.5 + k * 3.6}`} stroke="#fff" strokeOpacity="0.12" strokeWidth="0.8" />)}
          <path d="M6 -5 l4 0 l0 2.4" stroke="#c9d0d8" strokeWidth="1.2" fill="none" />
          {metal ? <rect x="6" y="-8.6" width="4.4" height="2.8" rx="1" fill="#d9b45a" /> : null}
        </g>
      ) : (
        <g>
          {/* arco di legno intero: impugnatura fasciata di cuoio con cucitura */}
          <rect x="-4" y="-13" width="9" height="26" rx="3.2" fill="#4a2c16" stroke={OUTLINE} strokeOpacity="0.8" strokeWidth="0.8" />
          {[0, 1, 2, 3, 4, 5].map((k) => <path key={k} d={`M-4 ${-11 + k * 4.2} L5 ${-9 + k * 4.2}`} stroke="#c9a46a" strokeWidth="0.7" opacity="0.8" />)}
          <path d="M5 -13 l3.6 -1.6 l0 3.2 Z" fill="#c9a46a" />
        </g>
      )}
      {look.bowType === "olimpico" ? (
        <g>
          {/* stabilizzatore lungo con smorzatore, V-bar con pesi, mirino con prolunga e clicker */}
          <path d="M6 22 L60 24" stroke="#1d2126" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M6 22 L60 24" stroke="#fff" strokeOpacity="0.2" strokeWidth="0.8" />
          <rect x="56" y="19" width="9" height="10" rx="2.2" fill="#2a2f35" />
          <rect x="52" y="20.5" width="4" height="7" rx="1" fill="#e07a2f" />
          <path d="M4 24 L-20 34" stroke="#1d2126" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="-26" y="31" width="8" height="7" rx="2" fill="#2a2f35" transform="rotate(-22 -22 34)" />
          <circle cx="4" cy="24" r="2.6" fill="#9aa3ad" stroke="#2a2f35" strokeWidth="0.6" />
          <path d="M6 -24 L28 -30" stroke="#9aa3ad" strokeWidth="2" strokeLinecap="round" />
          <path d="M28 -30 L28 -48" stroke="#9aa3ad" strokeWidth="1.4" />
          <rect x="25.5" y="-50" width="5" height="6" rx="1" fill="#2a2f35" />
          <circle cx="28" cy="-54" r="3.2" fill="#a8d8ff" fillOpacity="0.35" stroke="#e3a21a" strokeWidth="1.4" />
          <circle cx="28" cy="-54" r="0.8" fill="#e3a21a" />
          <path d="M7 -15 L11 -4" stroke="#c9d0d8" strokeWidth="0.9" />
        </g>
      ) : null}
      {look.bowType === "compound" ? (
        <g>
          <path d="M6 18 L54 20" stroke="#1d2126" strokeWidth="3.4" strokeLinecap="round" />
          <rect x="50" y="15" width="8" height="10" rx="2" fill="#2a2f35" />
          <path d="M6 -18 L24 -24" stroke="#9aa3ad" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="26" cy="-25" r="6.4" fill="#a8d8ff" fillOpacity="0.25" stroke="#2a2f35" strokeWidth="2" />
          <circle cx="26" cy="-25" r="1" fill="#3fae6a" />
          <rect x="22" y="-33.5" width="8" height="2.4" rx="1" fill="#3fae6a" opacity="0.8" />
        </g>
      ) : null}
      {look.bowType === "nudo" ? (
        <g>
          <rect x="2" y="26" width="7" height="6" rx="1.5" fill="#9aa3ad" />
          <rect x="1" y="32" width="9" height="4" rx="1.2" fill="#6b737c" />
        </g>
      ) : null}
      {look.bowType === "ricurvo" ? [1, -1].map((k) => <path key={k} d={`M1 ${f(k * 8)} L5 ${f(k * 8)}`} stroke="#d9b45a" strokeWidth="1.2" />) : null}
    </g>
  );

  // freccia (dalla cocca verso la finestra dell'arco)
  const arrowNode = (from: P, toward: P, len: number) => {
    const ang = (Math.atan2(toward.y - from.y, toward.x - from.x) * 180) / Math.PI;
    return (
      <g transform={`translate(${f(from.x)} ${f(from.y)}) rotate(${f(ang)})`}>
        <line x1="0" y1="0" x2={f(len)} y2="0" stroke={look.shaft || "#1d1f22"} strokeWidth="2.4" strokeLinecap="round" />
        <path d={`M${f(len - 1)} -2.4 L${f(len + 9)} 0 L${f(len - 1)} 2.6 Z`} fill="#c9d0d8" />
        <Fletching kind={look.fletchStyle} cock={look.cock} fletch={look.fletch} />
        <rect x="-4" y="-1.8" width="6" height="3.6" rx="1" fill={look.nock} />
      </g>
    );
  };

  const quiver = (place: "fianco" | "schiena") => {
    const spin = tune(look.quiverRot, 0, -180, 180);
    const qy = tune(look.quiverY, 0, -40, 40);
    const tr = place === "schiena" ? `translate(118 ${140 + qy}) rotate(${24 + spin})` : `translate(116 ${214 + qy}) rotate(${-14 + spin})`;
    return (
      <g transform={tr}>
        {[-5, 0, 5].map((dx, i) => (
          <g key={dx}>
            <line x1={dx} y1={-40} x2={dx} y2={-60} stroke={look.shaft || "#1d1f22"} strokeWidth="2" />
            <path d={`M${dx} -60 l-4 -10 l4 3 l4 -3 z`} fill={i === 1 ? look.cock : look.fletch} />
          </g>
        ))}
        <QuiverBody kind={look.quiverStyle} color={look.quiver} />
      </g>
    );
  };

  const relGrip = ik(SB, POSES.allungo.grip, 42, 41, 1).hand;
  // fantasia del mantello: righe, scacchi, bordo, stelle o stemma grande
  const capeDecor = (d: string, box: [number, number, number, number]) => {
    const cp = look.capePattern;
    if (!cp || cp === "liscio") return null;
    const ck = CAPE_CLOTH[cp] ?? (PATTERN2_IDS.has(cp) ? cp : "");
    if (ck) return <ClothPattern kind={ck} shapes={[d]} base={look.capeColor} trim={look.trim} uid={`${uid}cp`} box={box} />;
    if (cp === "stelle") {
      return (
        <g>
          <defs><clipPath id={`${uid}cps`}><path d={d} /></clipPath></defs>
          <g clipPath={`url(#${uid}cps)`} fill="#f4e7c2" opacity="0.75">
            {Array.from({ length: 22 }, (_, i) => <circle key={i} cx={box[0] + ((i * 37) % 100) / 100 * (box[2] - box[0])} cy={box[1] + ((i * 61) % 100) / 100 * (box[3] - box[1])} r={i % 4 ? 0.9 : 1.6} />)}
          </g>
        </g>
      );
    }
    return <g opacity="0.85"><ChestEmblem kind={look.emblem !== "nessuno" ? look.emblem : "compagnia"} crest={look.crest} x={box[0] + 17} y={box[1] + (box[3] - box[1]) * 0.62} s={1.05} base={look.capeColor} trim={look.trim} /></g>;
  };

  return (
    <g>
      {/* mantello dietro */}
      {look.cape ? (() => {
        const short = look.capeStyle === "corto";
        const w = Math.max(-8, Math.min(8, wind));
        const strength = Math.abs(w) * gust;
        // spostamento laterale a una certa altezza (u: 0 alle spalle, 1 all'orlo) e sollevamento dell'orlo
        const push = Math.max(-34, Math.min(12, w * 5.4 * gust)) + Math.sin(t * 1.3) * 2.2;
        const dx = (u: number) => push * Math.pow(u, 1.35) + Math.sin(t * 2.1 + u * 3) * (1 + strength * 0.35) * u;
        const lift = Math.min(26, strength * 3.4);
        const bottom = (short ? 222 : 298) - lift;
        const k = short ? 0.5 : 1;
        const top = 120;
        const yAt = (u: number) => top + (bottom - top) * u;
        // bordo dietro (sinistra) che si apre verso il basso, bordo davanti che resta vicino al corpo
        const back = (u: number) => shoulderL + 2 - (16 + 30 * k) * Math.pow(u, 0.8) + dx(u) * 1.15;
        const front = (u: number) => shoulderR - 2 + 6 * u + dx(u) * 0.55;
        const hemPts = Array.from({ length: 9 }, (_, i) => {
          const v = i / 8;
          const x = lerp(front(1), back(1), v);
          const wave = Math.sin(t * (3.2 + strength * 0.5) + i * 1.25) * (1.6 + strength * 0.9) * (0.4 + v * 0.8);
          const frayed = look.capeStyle === "frastagliato" ? (i % 2 ? -12 : 5) : 0;
          return { x, y: bottom + wave + frayed - v * (lift * 0.6) };
        });
        const hem = hemPts.map((q, i) => (i === 0 ? `L${f(q.x)} ${f(q.y)}` : `Q${f((hemPts[i - 1].x + q.x) / 2 + (i % 2 ? 2 : -2))} ${f((hemPts[i - 1].y + q.y) / 2 + (i % 2 ? 3 : -2))} ${f(q.x)} ${f(q.y)}`)).join(" ");
        const backEdge = [0.92, 0.7, 0.45, 0.2, 0].map((u) => `${f(back(u))} ${f(yAt(u))}`);
        const d = `M${f(front(0))} ${top} C${f(front(0.35))} ${f(yAt(0.35))} ${f(front(0.7))} ${f(yAt(0.7))} ${f(front(0.98))} ${f(yAt(0.98))} ${hem} C${backEdge[0]} ${backEdge[1]} ${backEdge[2]} S${backEdge[3]} ${backEdge[4]} Z`;
        // fodera: la parte interna, più scura, si vede dove il mantello si gonfia all'indietro
        const lining = `M${f(back(0.25) + 2)} ${f(yAt(0.25))} C${f(back(0.55) - 3)} ${f(yAt(0.55))} ${f(back(0.85) - 4)} ${f(yAt(0.85))} ${f(hemPts[8].x - 3)} ${f(hemPts[8].y + 1)} L${f(hemPts[6].x)} ${f(hemPts[6].y + 2)} C${f(back(0.8) + 8)} ${f(yAt(0.8))} ${f(back(0.5) + 6)} ${f(yAt(0.5))} ${f(back(0.25) + 2)} ${f(yAt(0.25))} Z`;
        const folds = [0.14, 0.3, 0.46, 0.62, 0.78, 0.92];
        return (
          <g>
            <path d={d} fill={shade(look.capeColor, -0.55)} transform="translate(-2.4 1.6)" opacity="0.9" />
            <path d={d} fill={`url(#${uid}cape)`} stroke={OUT} strokeOpacity="0.7" strokeWidth="1.6" />
            {capeDecor(d, [Math.min(back(1), back(0.6)) - 8, 116, front(1) + 12, bottom + 16])}
            {/* pieghe: solchi in ombra con il bordo in luce, che seguono il vento */}
            {folds.map((v, i) => {
              const x0 = lerp(front(0), back(0), v * 0.8 + 0.1);
              const x1 = lerp(front(0.55), back(0.55), v);
              const x2 = lerp(hemPts[0].x, hemPts[8].x, v);
              const y2 = hemPts[Math.round(v * 8)].y - 2;
              const fd = `M${f(x0)} ${top + 6} Q${f(x1)} ${f(yAt(0.55))} ${f(x2)} ${f(y2)}`;
              return (
                <g key={i}>
                  <path d={fd} stroke={shade(look.capeColor, -0.6)} strokeOpacity="0.55" strokeWidth={1.6 + (i % 2) * 1.2} fill="none" strokeLinecap="round" />
                  <path d={fd} stroke={shade(look.capeColor, 0.55)} strokeOpacity="0.42" strokeWidth={1.4 + (i % 2) * 1.4} fill="none" strokeLinecap="round" transform="translate(2.4 0)" />
                </g>
              );
            })}
            <path d={lining} fill={shade(look.capeColor, -0.65)} opacity={Math.min(0.9, 0.35 + strength * 0.12)} />
            {/* orlo: bordo appena più chiaro e ombra sotto */}
            <path d={`M${f(hemPts[0].x)} ${f(hemPts[0].y)} ${hem.replace(/^L[^QL]*/, "")}`} stroke={shade(look.capeColor, 0.25)} strokeOpacity="0.45" strokeWidth="1.2" fill="none" />
            {/* collo del mantello raccolto sulle spalle */}
            <path d={`M${f(shoulderL - 2)} 124 C${f(shoulderL + 8)} 114 ${f(shoulderR - 8)} 114 ${f(shoulderR + 2)} 124 C${f(shoulderR - 6)} 128 ${f(shoulderL + 6)} 130 ${f(shoulderL - 2)} 124 Z`} fill={shade(look.capeColor, -0.2)} stroke={OUT} strokeOpacity="0.65" strokeWidth="1" />
          </g>
        );
      })() : null}
      {look.hat === "cappuccio" ? <path d={`M${f(shoulderL)} 126 C${f(shoulderL + 8)} 112 ${f(shoulderR - 8)} 112 ${f(shoulderR)} 126 C${f(cx + 10)} 132 ${f(cx - 10)} 132 ${f(shoulderL)} 126 Z`} fill={shade(look.hatColor, -0.2)} /> : null}

      <HairBack look={look} uid={uid} t={t} />
      {look.quiverPlace === "schiena" ? quiver("schiena") : null}

      {leg(legs.back, "lb")}
      {leg(legs.front, "lf")}
      {look.bottom === "gonna" ? (
        <g>
          <path d={`M${f(hipL - 2)} 200 L${f(hipR + 2)} 200 L${f(hipR + 12)} 258 Q${f(cx)} 263 ${f(hipL - 12)} 258 Z`} fill={`url(#${uid}pants)`} stroke={OUT} strokeOpacity="0.8" strokeWidth="1.6" />
          {[-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].map((k) => <path key={k} d={`M${f(cx + k * 22)} 204 L${f(cx + k * 30)} 258`} stroke={shade(look.pants, -0.35)} strokeWidth="1" />)}
          <path d={`M${f(hipL - 11)} 252 Q${f(cx)} 257 ${f(hipR + 11)} 252`} stroke={look.trim} strokeWidth="1.6" fill="none" />
        </g>
      ) : null}

      {/* collo: disegnato prima del busto, così la scollatura lo chiude in modo naturale.
          Nuca che scende morbida nel trapezio, gola leggermente inclinata in avanti,
          pomo d'Adamo appena accennato negli uomini adulti, ombra sotto la mandibola */}
      {(() => {
        const nx = neck.x;
        const adam = woman || kid ? 0 : 1.3;
        const shape = `M${f(nx - 8)} 95 C${f(nx - 8.6)} 104 ${f(nx - 10)} 111 ${f(nx - 13)} 116 C${f(nx - 15)} 119.5 ${f(nx - 18)} 122 ${f(nx - 22)} 125 L${f(nx + 12.5)} 125 C${f(nx + 9.6)} 120 ${f(nx + 7.8)} 116 ${f(nx + 7.4)} 112.5 C${f(nx + 7.2 + adam)} 110 ${f(nx + 6.4)} 106 ${f(nx + 6)} 100 Z`;
        return (
          <g>
            <path d={shape} fill={skinD} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.8" strokeLinejoin="round" />
            {/* lato in ombra verso la nuca e trapezio */}
            <path d={`M${f(nx - 8)} 95 C${f(nx - 8.6)} 104 ${f(nx - 10)} 111 ${f(nx - 13)} 116 C${f(nx - 15)} 119.5 ${f(nx - 18)} 122 ${f(nx - 22)} 125 L${f(nx - 10)} 125 C${f(nx - 6)} 119 ${f(nx - 4.6)} 110 ${f(nx - 4)} 99 Z`} fill={shade(skin, -0.32)} opacity="0.45" />
            {/* ombra portata dalla mandibola */}
            <path d={`M${f(nx - 5)} 99 C${f(nx - 1)} 104 ${f(nx + 3)} 106 ${f(nx + 6.6)} 105 L${f(nx + 6)} 100 Z`} fill={shade(skin, -0.42)} opacity="0.5" />
            {/* muscolo che scende da dietro l'orecchio alla fossetta della gola */}
            <path d={`M${f(nx - 4)} 101 C${f(nx - 1)} 109 ${f(nx + 3)} 116 ${f(nx + 8)} 122`} stroke={shade(skin, -0.36)} strokeOpacity="0.32" strokeWidth="1.1" fill="none" strokeLinecap="round" />
            <path d={`M${f(nx - 2.6)} 101 C${f(nx)} 108 ${f(nx + 4)} 115 ${f(nx + 9)} 121`} stroke={shade(skin, 0.25)} strokeOpacity="0.25" strokeWidth="0.9" fill="none" strokeLinecap="round" />
            {adam ? <path d={`M${f(nx + 7.4)} 109.4 q${f(0.9)} 1.6 0 3.2`} stroke={shade(skin, -0.4)} strokeOpacity="0.5" strokeWidth="0.8" fill="none" strokeLinecap="round" /> : null}
            {/* clavicola appena sopra la scollatura */}
            <path d={`M${f(nx - 2)} 121.5 Q${f(nx + 4)} 120 ${f(nx + 10)} 122.5`} stroke={shade(skin, -0.3)} strokeOpacity="0.3" strokeWidth="0.8" fill="none" />
          </g>
        );
      })()}
      {longTunic ? <path d={tunicD} fill={`url(#${uid}shirt)`} stroke={OUT} strokeOpacity="0.8" strokeWidth="2.2" /> : null}
      {/* borsello sull'altro fianco: dietro al busto, se ne vede solo il davanti */}
      {look.pouch && sideOf(look.pouchSide, nearSide(look)) !== nearSide(look) ? <g opacity="0.9"><Pouch kind={look.pouchType} x={hipR - 1} y={205} /></g> : null}
      <path d={torso} fill={`url(#${uid}shirt)`} stroke={OUT} strokeOpacity="0.8" strokeWidth="2.2" />
      <ClothPattern kind={look.pattern} shapes={longTunic ? [torso, tunicD] : [torso]} base={look.shirt} trim={look.trim} uid={uid} box={[shoulderL - 16, 112, shoulderR + 16, (longTunic ? tunicLen : 210) + 6]} />
      <ClothDetail uid={uid} shapes={longTunic ? [torso, tunicD] : [torso]} cx={cx} shoulderL={shoulderL} shoulderR={shoulderR} hipL={hipL} hipR={hipR} tunicLen={tunicLen} longTunic={longTunic} seam={seamOf(look.shirt)} />
      <Outfit look={look} cx={cx} shoulderL={shoulderL} shoulderR={shoulderR} hipL={hipL} hipR={hipR} tunicLen={tunicLen} W={W} woman={woman} uid={uid} />
      {/* volume dipinto della veste: luce sul petto verso il bersaglio, schiena in ombra, ombra sotto la cintura */}
      <g pointerEvents="none">
        <clipPath id={`${uid}tv`}>
          <path d={torso} />
          {longTunic ? <path d={tunicD} /> : null}
        </clipPath>
        <g clipPath={`url(#${uid}tv)`}>
          <rect x={f(shoulderL - 18)} y="112" width={f(shoulderR - shoulderL + 36)} height={f((longTunic ? tunicLen : 212) - 108)} fill={`url(#${uid}tvol)`} />
          <rect x={f(shoulderL - 18)} y="208" width={f(shoulderR - shoulderL + 36)} height="16" fill={`url(#${uid}tao)`} />
        </g>
        <defs>
          <linearGradient id={`${uid}tvol`} x1="0" x2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.3" />
            <stop offset="0.45" stopColor="#000" stopOpacity="0" />
            <stop offset="0.8" stopColor="#fff" stopOpacity="0.05" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.14" />
          </linearGradient>
          <linearGradient id={`${uid}tao`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.32" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </linearGradient>
        </defs>
      </g>
      <ChestEmblem kind={look.emblem} crest={look.crest} x={cx + 9} y={look.top === "giubbetto" ? 160 : 150} s={look.emblem === "compagnia" ? 0.95 : 0.72} base={look.shirt} trim={look.trim} />
      {/* bottoni sulla chiusura davanti: metallo sul giubbetto, legno sulle giubbe, osso sulle camicie */}
      {BUTTON_TOPS[look.top] && !(look.special === "simone-inverno" && look.top === "giacca") ? (look.emblem !== "nessuno" ? (tunicLen > 222 ? [217, 227] : []) : [136, 148, 160, 172, 184, ...(tunicLen > 222 ? [217, 227] : [])]).map((y) => <ClothButton key={y} x={cx + 1} y={y} r={1.9} color={BUTTON_TOPS[look.top]} metal={look.top === "giubbetto" || look.top === "divisa" || look.top === "cappotto-lungo"} />) : null}
      {look.tattoo === "sole" && look.top === "canotta" ? <g transform={`translate(${f(shoulderR - 7)} 130) scale(0.4)`} opacity="0.8"><circle r="5" fill="none" stroke="#24324a" strokeWidth="2" />{[0, 1, 2, 3, 4, 5, 6, 7].map((k) => <path key={k} d={`M${f(Math.cos(k * 0.785) * 7)} ${f(Math.sin(k * 0.785) * 7)} L${f(Math.cos(k * 0.785) * 10)} ${f(Math.sin(k * 0.785) * 10)}`} stroke="#24324a" strokeWidth="2" />)}</g> : null}
      {look.cape ? (() => {
        // il mantello si vede anche sopra le spalle: un lembo di stoffa che parte dal fermaglio sul davanti,
        // passa sopra la spalla e scende sulla schiena, con la piega e il bordo in luce
        const kx = cx + 12, ky = 121;
        const drape = `M${f(kx)} ${ky - 3} C${f(cx + 2)} 117 ${f(cx - 10)} 115.5 ${f(cx - 16)} 115.5 C${f(shoulderL + 6)} 115.5 ${f(shoulderL - 1)} 116 ${f(shoulderL - 3)} 119 C${f(shoulderL - 6)} 132 ${f(shoulderL - 5)} 146 ${f(shoulderL - 2)} 158 C${f(shoulderL + 6)} 150 ${f(shoulderL + 12)} 136 ${f(cx - 4)} 128 C${f(cx + 2)} 125 ${f(kx - 4)} ${ky + 3} ${f(kx)} ${ky + 3} Z`;
        return (
          <g>
            <path d={drape} fill={`url(#${uid}cape)`} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.4" />
            <path d={`M${f(shoulderL + 2)} 122 C${f(shoulderL + 2)} 134 ${f(shoulderL + 4)} 144 ${f(shoulderL + 2)} 152`} stroke={shade(look.capeColor, -0.55)} strokeOpacity="0.7" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d={`M${f(cx - 10)} 117.5 C${f(cx - 16)} 117 ${f(shoulderL + 4)} 117.5 ${f(shoulderL - 1)} 121.5`} stroke={shade(look.capeColor, 0.55)} strokeOpacity="0.55" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            <path d={`M${f(shoulderL - 2)} 158 C${f(shoulderL + 6)} 150 ${f(shoulderL + 12)} 136 ${f(cx - 4)} 128 C${f(cx + 2)} 125 ${f(kx - 4)} ${ky + 3} ${f(kx)} ${ky + 3}`} stroke={look.trim} strokeOpacity="0.85" strokeWidth="1.5" fill="none" />
            {look.clasp !== "nessuno" ? (
              <g>
                <path d={`M${f(kx)} ${ky} Q${f(shoulderR - 4)} ${ky + 4} ${f(shoulderR - 1)} ${ky + 10}`} stroke={shade(look.capeColor, -0.4)} strokeWidth="2.4" fill="none" strokeLinecap="round" />
              </g>
            ) : null}
          </g>
        );
      })() : null}
      {look.special ? <SpecialSideTorso look={look} cx={cx} shoulderL={shoulderL} shoulderR={shoulderR} hipL={hipL} hipR={hipR} /> : null}
      {look.pendant && look.pendant !== "nessuno" ? <Pendant kind={look.pendant} x={cx + 3} y={look.amulet ? 126 : 132} w={10} y0={116} s={1.05} /> : null}
      {look.amulet ? (
        <g>
          <path d={`M${f(cx - 11)} 116 Q${f(cx - 2)} 140 ${f(cx + 4)} 142 Q${f(cx + 10)} 138 ${f(cx + 12)} 116`} stroke="#c9a46a" strokeWidth="1" fill="none" />
          <path d={`M${f(cx + 4)} 140 l5 7 l-5 7 l-5 -7 Z`} fill="#d9b45a" stroke="#7a5a1a" strokeWidth="0.8" />
          <circle cx={f(cx + 4)} cy="147" r="2" fill="#2f9e7a" />
        </g>
      ) : null}
      {look.straps ? (
        <g>
          {[[shoulderL + 6, 124, hipR - 4, 198], [shoulderR - 6, 124, hipL + 6, 194]].map(([x1, y1, x2, y2], i) => (
            <g key={i}>
              <path d={`M${f(x1)} ${y1} L${f(x2)} ${y2}`} stroke={OUT} strokeOpacity="0.8" strokeWidth="7.5" strokeLinecap="round" />
              <path d={`M${f(x1)} ${y1} L${f(x2)} ${y2}`} stroke="#3a2416" strokeWidth="5.4" strokeLinecap="round" />
              <path d={`M${f(x1)} ${y1} L${f(x2)} ${y2}`} stroke="#fff" strokeOpacity="0.12" strokeWidth="1" />
              <rect x={f(lerp(x1, x2, 0.38) - 4)} y={f(lerp(y1, y2, 0.38) - 4)} width="8" height="8" rx="1.4" fill="none" stroke="#c9a46a" strokeWidth="1.4" />
            </g>
          ))}
          <circle cx={f(cx)} cy="158" r="4" fill="#3a2416" stroke="#c9a46a" strokeWidth="1.2" />
        </g>
      ) : null}
      {look.sash ? (
        <g>
          <path d={`M${f(hipL - 3)} 188 C${f(cx)} 184 ${f(cx)} 184 ${f(hipR + 3)} 188 L${f(hipR + 3)} 206 C${f(cx)} 202 ${f(cx)} 202 ${f(hipL - 3)} 206 Z`} fill={look.sashColor} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.2" />
          {[192, 197, 202].map((y) => <path key={y} d={`M${f(hipL)} ${y} Q${f(cx)} ${y - 3} ${f(hipR)} ${y}`} stroke={shade(look.sashColor, -0.3)} strokeWidth="0.8" fill="none" />)}
          <path d={`M${f(cx + 8)} 204 C${f(cx + 12 + capeSway * 0.4)} 222 ${f(cx + 10 + capeSway * 0.6)} 238 ${f(cx + 14 + capeSway * 0.8)} 252 L${f(cx + 24 + capeSway * 0.8)} 250 C${f(cx + 20)} 236 ${f(cx + 20)} 220 ${f(cx + 17)} 204 Z`} fill={shade(look.sashColor, -0.1)} stroke={OUT} strokeOpacity="0.7" strokeWidth="1" />
          <path d={`M${f(cx + 14 + capeSway * 0.8)} 252 l1.5 5 M${f(cx + 18 + capeSway * 0.8)} 251 l1.5 5 M${f(cx + 22 + capeSway * 0.8)} 250 l1.5 5`} stroke={shade(look.sashColor, -0.2)} strokeWidth="1.2" />
        </g>
      ) : null}
      {look.quiverPlace !== "schiena" ? quiver("fianco") : (
        <g>
          <path d={`M${f(shoulderL + 4)} 122 L${f(hipR - 2)} 204`} stroke={OUT} strokeOpacity="0.8" strokeWidth="9" strokeLinecap="round" />
          <path d={`M${f(shoulderL + 4)} 122 L${f(hipR - 2)} 204`} stroke={shade(look.quiver, -0.15)} strokeWidth="6.5" strokeLinecap="round" />
          <path d={`M${f(shoulderL + 4)} 122 L${f(hipR - 2)} 204`} stroke={shade(look.quiver, 0.35)} strokeWidth="0.8" strokeDasharray="2.5 2" />
          <rect x={f(lerp(shoulderL + 4, hipR - 2, 0.45) - 4)} y={f(lerp(122, 204, 0.45) - 4)} width="8" height="8" rx="1.5" fill="none" stroke="#c9a46a" strokeWidth="1.4" />
        </g>
      )}
      {look.chestguard ? (
        <g>
          <path d={`M${f(cx + 2)} 128 C${f(cx + 14)} 124 ${f(shoulderR - 2)} 128 ${f(shoulderR - 1)} 136 L${f(shoulderR - 4)} 162 C${f(cx + 16)} 166 ${f(cx + 6)} 164 ${f(cx + 1)} 158 Z`} fill={look.chestColor} />
          <path d={`M${f(cx + 2)} 140 L${f(shoulderL + 4)} 132 M${f(cx + 2)} 156 L${f(shoulderL + 2)} 164`} stroke={shade(look.chestColor, -0.3)} strokeWidth="2.4" strokeLinecap="round" />
        </g>
      ) : null}
      {look.necklace ? (
        look.top === "giubbetto" ? (
          // catena d'argento a maglie, come sulla divisa della compagnia
          <g>
            <path d={`M${f(cx - 11)} 118 Q${f(cx)} 142 ${f(cx + 11)} 118`} stroke="#5d6168" strokeWidth="2.6" fill="none" />
            <path d={`M${f(cx - 11)} 118 Q${f(cx)} 142 ${f(cx + 11)} 118`} stroke="#d7dbe1" strokeWidth="1.8" strokeDasharray="1.6 1.1" fill="none" />
          </g>
        ) : (
          <g>
            <path d={`M${f(cx - 9)} 120 Q${f(cx)} 140 ${f(cx + 9)} 120`} stroke="#d9b45a" strokeWidth="1.3" fill="none" />
            <path d={`M${f(cx)} 137 l3 4 l-3 4 l-3 -4 z`} fill="#3fae6a" stroke="#d9b45a" strokeWidth="0.8" />
          </g>
        )
      ) : null}
      {/* il fermaglio del mantello sopra collane, ciondoli e amuleti */}
      {look.cape && look.clasp !== "nessuno" ? <Clasp kind={look.clasp} x={cx + 12} y={121} s={1.15} /> : null}

      {look.scarf ? (
        <g>
          <path d={`M${f(neck.x - 13)} 114 C${f(neck.x - 6)} 122 ${f(neck.x + 8)} 122 ${f(neck.x + 13)} 114 L${f(neck.x + 13)} 124 C${f(neck.x + 6)} 130 ${f(neck.x - 6)} 130 ${f(neck.x - 13)} 124 Z`} fill={look.scarfColor} />
          <path d={`M${f(neck.x - 8)} 124 L${f(neck.x - 14 + capeSway)} 156 L${f(neck.x - 4 + capeSway)} 156 L${f(neck.x - 1)} 126 Z`} fill={shade(look.scarfColor, -0.15)} />
        </g>
      ) : null}
      {look.fur ? (
        <g>
          {Array.from({ length: 11 }, (_, i) => {
            const u = i / 10;
            const x = lerp(shoulderL - 6, shoulderR + 4, u);
            const y = 120 - Math.sin(u * Math.PI) * 8 + (i % 2) * 3;
            return <ellipse key={i} cx={f(x)} cy={f(y)} rx="9" ry="7.5" fill={shade(look.furColor, (i % 3) * 0.08 - 0.08)} stroke={OUT} strokeOpacity="0.55" strokeWidth="0.8" />;
          })}
          {Array.from({ length: 14 }, (_, i) => {
            const x = lerp(shoulderL - 10, shoulderR + 8, i / 13);
            return <path key={i} d={`M${f(x)} ${f(126 + (i % 3))} l${(i % 2) * 2 - 1} 6`} stroke={shade(look.furColor, -0.4)} strokeWidth="1" strokeLinecap="round" />;
          })}
        </g>
      ) : null}
      {look.cowl ? (
        <g>
          <path d={`M${f(cx - 24)} 128 C${f(cx - 26)} 112 ${f(cx - 12)} 100 ${f(cx + 2)} 100 C${f(cx + 16)} 100 ${f(cx + 26)} 112 ${f(cx + 24)} 128 C${f(cx + 16)} 142 ${f(cx - 16)} 142 ${f(cx - 24)} 128 Z`} fill={look.cowlColor} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.4" />
          {[0, 1, 2].map((i) => <path key={i} d={`M${f(cx - 20 + i * 2)} ${118 + i * 6} Q${f(cx)} ${124 + i * 6} ${f(cx + 20 - i * 2)} ${116 + i * 6}`} stroke={shade(look.cowlColor, -0.35)} strokeWidth="1.1" fill="none" />)}
          <path d={`M${f(cx - 14)} 136 C${f(cx - 18 + capeSway)} 156 ${f(cx - 10 + capeSway)} 170 ${f(cx - 2 + capeSway)} 176 L${f(cx + 8)} 138 Z`} fill={shade(look.cowlColor, -0.12)} stroke={OUT} strokeOpacity="0.65" strokeWidth="1" />
        </g>
      ) : null}
      {/* testa in proporzione con il corpo, come nella vista di fronte (un po' più piccola che nel vecchio stile) */}
      <g transform={`translate(${f(H.x)} ${f(H.y)}) scale(${kid ? 1.06 : 0.92}) translate(${f(-H.x)} ${f(-H.y)})`}>
        <Head look={look} H={H} face={face} blink={blink} uid={uid} t={t} cssBlink={cssBlink} />
      </g>

      {bow}
      {def.arrow ? arrowNode(nockPt ?? drawHand, restW, 124) : null}
      {flying != null && flying < 0.9 ? <g transform={`translate(${f(flying * 900)} ${f(-flying * 20)})`}>{arrowNode(ANCHOR, rot(restLocal, 0, relGrip), 124)}</g> : null}
      <path d={nockPt ? `M${f(tipTop.x)} ${f(tipTop.y)} L${f(nockPt.x)} ${f(nockPt.y)} L${f(tipBot.x)} ${f(tipBot.y)}` : `M${f(tipTop.x)} ${f(tipTop.y)} L${f(tipBot.x)} ${f(tipBot.y)}`} stroke={look.string || "#f4f1ea"} strokeWidth="1.1" fill="none" opacity="0.9" />
      {(() => {
        // serving centrale più spesso e scuro, con il punto d'incocco in ottone
        const mid = nockPt ?? lerpP(tipTop, tipBot, 0.5);
        const a1 = lerpP(mid, tipTop, nockPt ? 0.12 : 0.16);
        const a2 = lerpP(mid, tipBot, nockPt ? 0.16 : 0.2);
        const serve = shade(look.string || "#f4f1ea", -0.55);
        return (
          <g>
            <path d={`M${f(a1.x)} ${f(a1.y)} L${f(mid.x)} ${f(mid.y)} L${f(a2.x)} ${f(a2.y)}`} stroke={serve} strokeWidth="2" fill="none" strokeLinecap="round" />
            <circle cx={f(lerp(mid.x, a1.x, 0.18))} cy={f(lerp(mid.y, a1.y, 0.18))} r="1.4" fill="#d9b45a" />
          </g>
        );
      })()}
      {arm(SB, bowArm.elbow, grip, "bow")}
      {def.holding && !def.arrow ? (() => {
        // freccia appena presa: la tiene a metà asta, nella direzione del braccio
        const dx = drawHand.x - drawArm.elbow.x;
        const dy = drawHand.y - drawArm.elbow.y;
        const L = Math.hypot(dx, dy) || 1;
        const ux = dx / L;
        const uy = dy / L;
        return arrowNode(p(drawHand.x - ux * 34, drawHand.y - uy * 34), p(drawHand.x + ux, drawHand.y + uy), 72);
      })() : null}
      {arm(SD, drawArm.elbow, drawHand, "draw")}
    </g>
  );
}

/** colore di una pittura sul viso */
const paintColor = (kind: string) => (kind === "volpe" ? "#d9822a" : kind === "guance" ? "#c4473d" : "#2a3a5a");

// contorno dipinto: bruno scuro morbido, non più nero a china
const OUTLINE = "#2a1d14";

/** quali vesti hanno bottoni davanti, e di che colore */
export const BUTTON_TOPS: Partial<Record<string, string>> = { giubbetto: "#cfd5db", giubba: "#8a5a2e", farsetto: "#d9b45a", cappotto: "#6b4224", "cappotto-lungo": "#cfd5db", giacca: "#2a2a2a", divisa: "#d9b45a", camicia: "#efe6d2", polo: "#efe6d2", gilet: "#d9b45a" };

function Outfit({ look, cx, shoulderL, shoulderR, hipL, hipR, tunicLen, W, woman, uid }: { look: AvatarLook; cx: number; shoulderL: number; shoulderR: number; hipL: number; hipR: number; tunicLen: number; W: number; woman: boolean; uid: string }) {
  const sh = look.shirt;
  const tr = look.trim;
  const dark = shade(sh, -0.3);
  const wide = look.belt === "larga";
  const bc = look.beltColor || (look.style === "medievale" ? "#5b3a1e" : shade(look.pants, -0.45));
  // il borsello sul fianco che si vede; sull'altro sta dietro al busto (lo disegna la figura prima del busto)
  const pouchNear = look.pouch && sideOf(look.pouchSide, nearSide(look)) === nearSide(look);
  const belt = look.belt === "nessuna" ? (pouchNear ? <Pouch kind={look.pouchType} x={hipR - 8} y={206} /> : null) : (
    <g>
      <rect x={f(hipL - 2)} y={wide ? 196 : 200} width={f(hipR - hipL + 4)} height={wide ? 13 : 8} rx="2" fill={bc} stroke="#1b130d" strokeOpacity="0.8" strokeWidth="1.2" />
      <BeltDetail uid={uid} x={hipL - 2} y={wide ? 196 : 200} w={hipR - hipL + 4} h={wide ? 13 : 8} cx={cx} />
      <rect x={f(hipL - 2)} y={wide ? 197 : 200.6} width={f(hipR - hipL + 4)} height="1.6" fill="#fff" opacity="0.15" />
      {wide ? [hipL + 6, hipR - 6].map((x) => <circle key={x} cx={f(x)} cy="202.5" r="1.3" fill="#d9b45a" />) : null}
      {look.buckle && look.buckle !== "semplice" ? <Buckle kind={look.buckle} x={cx} y={wide ? 202.5 : 204} s={wide ? 1 : 0.75} /> : <rect x={f(cx - (wide ? 6 : 3.5))} y={wide ? 196.5 : 200.5} width={wide ? 12 : 7} height={wide ? 12 : 7} rx="1.6" fill="none" stroke="#d9b45a" strokeWidth={wide ? 2 : 1.2} />}
      {wide ? <path d={`M${f(cx + 2)} 209 l4 10 l3 -1 l-4 -9 z`} fill={bc} /> : null}
      {pouchNear ? <Pouch kind={look.pouchType} x={hipR - 8} y={206} /> : null}
    </g>
  );
  switch (look.top) {
    case "polo":
      return (
        <g>
          <path d={`M${f(cx - 10)} 117 L${f(cx)} 130 L${f(cx + 10)} 117 L${f(cx + 6)} 116 L${f(cx)} 124 L${f(cx - 6)} 116 Z`} fill={tr} />
          <path d={`M${f(cx)} 124 v12`} stroke={dark} strokeWidth="1" />
          <circle cx={f(cx)} cy="129" r="1" fill={tr} />
          <circle cx={f(cx)} cy="134" r="1" fill={tr} />
          {belt}
        </g>
      );
    case "felpa":
      return (
        <g>
          <path d={`M${f(cx - 16)} 118 C${f(cx - 12)} 112 ${f(cx + 12)} 112 ${f(cx + 16)} 118 C${f(cx + 8)} 126 ${f(cx - 8)} 126 ${f(cx - 16)} 118 Z`} fill={dark} />
          <path d={`M${f(cx - 4)} 124 v16 M${f(cx + 4)} 124 v14`} stroke={tr} strokeWidth="1.2" strokeLinecap="round" />
          <path d={`M${f(cx - 16)} 176 L${f(cx + 16)} 176 L${f(cx + 20)} 196 L${f(cx - 20)} 196 Z`} fill={shade(sh, -0.12)} />
          <rect x={f(hipL)} y="200" width={f(hipR - hipL)} height="10" rx="3" fill={dark} />
        </g>
      );
    case "gilet":
      return (
        <g>
          <path d={`M${f(shoulderL + 4)} 122 L${f(cx - 4)} 122 L${f(cx - 3)} 206 L${f(hipL + 2)} 206 Z`} fill={sh} />
          <path d={`M${f(shoulderR - 4)} 122 L${f(cx + 4)} 122 L${f(cx + 3)} 206 L${f(hipR - 2)} 206 Z`} fill={sh} />
          <path d={`M${f(cx)} 122 v84`} stroke={shade(sh, 0.4)} strokeWidth="1.2" strokeDasharray="2 1.5" />
          <path d={`M${f(shoulderL + 8)} 150 h14 M${f(shoulderR - 22)} 150 h14`} stroke={shade(sh, -0.35)} strokeWidth="2" />
          <path d={`M${f(cx - 8)} 116 L${f(cx)} 124 L${f(cx + 8)} 116`} stroke={tr} strokeWidth="4" fill="none" />
          {belt}
        </g>
      );
    case "giacca":
      return (
        <g>
          <path d={`M${f(cx)} 120 v88`} stroke={shade(sh, 0.45)} strokeWidth="1.4" />
          <path d={`M${f(cx - 14)} 114 L${f(cx)} 124 L${f(cx + 14)} 114 L${f(cx + 14)} 120 L${f(cx)} 130 L${f(cx - 14)} 120 Z`} fill={dark} />
          <path d={`M${f(cx - 18)} 160 h12 M${f(cx + 6)} 160 h12`} stroke={dark} strokeWidth="1.6" />
          {belt}
        </g>
      );
    case "tunica":
      return (
        <g>
          <path d={`M${f(cx - 12)} 116 Q${f(cx)} 132 ${f(cx + 12)} 116`} stroke={tr} strokeWidth="3.5" fill="none" />
          <path d={`M${f(cx)} 126 v14`} stroke={shade(sh, -0.35)} strokeWidth="1.2" />
          <path d={`M${f(hipL - 6)} ${tunicLen - 2} L${f(hipR + 6)} ${tunicLen - 2}`} stroke={tr} strokeWidth="4" />
          <path d={`M${f(cx)} 210 L${f(cx)} ${tunicLen}`} stroke={shade(sh, -0.25)} strokeWidth="1.2" />
          {belt}
        </g>
      );
    case "tunica-lunga":
      return (
        <g>
          <path d={`M${f(cx - 12)} 115 Q${f(cx)} 126 ${f(cx + 12)} 115`} stroke={shade(sh, -0.3)} strokeWidth="2.4" fill="none" />
          <path d={`M${f(cx + 1)} 120 L${f(cx + 1)} 196`} stroke={shade(sh, -0.25)} strokeWidth="1.4" />
          {[128, 141, 154, 167, 180, 192].map((y) => (
            <g key={y}>
              <circle cx={f(cx + 3.5)} cy={y} r="2" fill={tr} stroke={shade(tr, -0.4)} strokeWidth="0.6" />
              <circle cx={f(cx + 3)} cy={y - 0.6} r="0.6" fill="#fff" opacity="0.6" />
            </g>
          ))}
          {[[-14, 214, -18, 258], [-4, 216, -6, 262], [8, 216, 10, 262], [16, 214, 20, 258]].map(([x1, y1, x2, y2]) => (
            <path key={x1} d={`M${f(cx + x1)} ${y1} Q${f(cx + (x1 + x2) / 2 + 2)} ${(y1 + y2) / 2} ${f(cx + x2)} ${y2}`} stroke={shade(sh, -0.22)} strokeWidth="1" fill="none" />
          ))}
          <path d={`M${f(hipR + 10)} ${tunicLen - 30} L${f(hipR + 12)} ${tunicLen}`} stroke={shade(sh, -0.4)} strokeWidth="1.3" />
          <path d={`M${f(hipL - 10)} ${tunicLen - 30} L${f(hipL - 12)} ${tunicLen}`} stroke={shade(sh, -0.4)} strokeWidth="1.3" />
          <path d={`M${f(shoulderL + 8)} 150 q8 4 16 0 M${f(shoulderR - 24)} 154 q8 4 16 0`} stroke={shade(sh, -0.2)} strokeWidth="1" fill="none" />
          {belt}
        </g>
      );
    case "farsetto":
      return (
        <g>
          {[-14, -7, 0, 7, 14].map((dx) => <path key={dx} d={`M${f(cx + dx * W)} 126 L${f(cx + dx * W * 1.1)} 204`} stroke={shade(sh, -0.25)} strokeWidth="1" />)}
          {[146, 166, 186].map((y) => <path key={y} d={`M${f(shoulderL + 4)} ${y} H${f(shoulderR - 4)}`} stroke={shade(sh, -0.2)} strokeWidth="0.8" />)}
          <path d={`M${f(cx - 12)} 112 h24 v8 h-24 z`} fill={tr} />
          {belt}
        </g>
      );
    case "giubbetto": {
      // giubbetto nero senza maniche della compagnia: scollo tondo sulla camicia, bordi a zig-zag d'argento
      const shirtC = look.sleeves || "#f1ece0";
      const neck = zigQ([cx - 13, 114], [cx, 138], [cx + 13, 114], 12, 1.8);
      const hem = zigQ([hipL - 11, tunicLen - 3], [cx, tunicLen + 2], [hipR + 11, tunicLen - 3], 18, 1.8);
      return (
        <g>
          <path d={`M${f(cx - 13)} 114 Q${f(cx)} 138 ${f(cx + 13)} 114 Z`} fill={shirtC} />
          <path d={`M${f(cx - 9)} 113 Q${f(cx)} 121 ${f(cx + 9)} 113`} stroke={shade(shirtC, -0.25)} strokeWidth="1" fill="none" />
          <path d={`M${f(cx - 4)} 118 L${f(cx)} 126 L${f(cx + 4)} 118`} stroke={shade(shirtC, -0.3)} strokeWidth="0.9" fill="none" />
          <path d={neck} stroke={tr} strokeWidth="1.3" fill="none" strokeLinejoin="round" />
          <path d={`M${f(cx - 15)} 112 Q${f(cx)} 141 ${f(cx + 15)} 112`} stroke={tr} strokeWidth="0.8" fill="none" opacity="0.7" />
          <path d={`M${f(shoulderL + 3)} 124 C${f(shoulderL + 6)} 140 ${f(shoulderL + 6)} 152 ${f(shoulderL + 3)} 162 M${f(shoulderR - 3)} 124 C${f(shoulderR - 6)} 140 ${f(shoulderR - 6)} 152 ${f(shoulderR - 3)} 162`} stroke={tr} strokeWidth="1" strokeDasharray="2 1.6" fill="none" opacity="0.85" />
          <path d={`M${f(cx + 1)} 140 L${f(cx + 1)} 196 M${f(cx + 1)} 210 L${f(cx + 2)} ${tunicLen - 4}`} stroke={shade(sh, 0.18)} strokeWidth="0.8" />
          <path d={hem} stroke={tr} strokeWidth="1.3" fill="none" strokeLinejoin="round" />
          <path d={`M${f(hipL - 11)} ${tunicLen - 7} Q${f(cx)} ${tunicLen - 2} ${f(hipR + 11)} ${tunicLen - 7}`} stroke={tr} strokeWidth="0.7" fill="none" opacity="0.6" />
          {belt}
        </g>
      );
    }
    case "corpetto":
      return (
        <g>
          <path d={`M${f(shoulderL + 6)} 132 C${f(cx - 10)} 126 ${f(cx + 10)} 126 ${f(shoulderR - 6)} 132 L${f(hipR - 2)} 206 L${f(hipL + 2)} 206 Z`} fill="#6b4224" />
          {[140, 152, 164, 176, 188].map((y) => <path key={y} d={`M${f(cx - 4)} ${y} L${f(cx + 4)} ${y + 6} M${f(cx + 4)} ${y} L${f(cx - 4)} ${y + 6}`} stroke="#e8d9b0" strokeWidth="0.9" />)}
          <path d={`M${f(cx - 10)} 116 Q${f(cx)} 126 ${f(cx + 10)} 116`} stroke={tr} strokeWidth="3" fill="none" />
          {belt}
        </g>
      );
    case "ranger":
      // veste incrociata: il lembo davanti scende in diagonale dalla spalla al fianco e oltre
      return (
        <g>
          <path d={`M${f(cx - 14)} 116 C${f(cx - 4)} 140 ${f(cx + 10)} 176 ${f(hipR + 2)} 210 L${f(hipR + 12)} ${tunicLen} L${f(hipR + 2)} ${tunicLen + 2} C${f(cx + 6)} 232 ${f(cx - 6)} 190 ${f(cx - 20)} 130 Z`} fill={shade(sh, -0.12)} opacity="0.55" />
          <path d={`M${f(cx - 14)} 116 C${f(cx - 4)} 140 ${f(cx + 10)} 176 ${f(hipR + 2)} 210 L${f(hipR + 12)} ${tunicLen}`} stroke={tr} strokeWidth="3" fill="none" />
          <path d={`M${f(cx - 14)} 116 C${f(cx - 4)} 140 ${f(cx + 10)} 176 ${f(hipR + 2)} 210`} stroke={OUTLINE} strokeOpacity="0.65" strokeWidth="1" fill="none" transform="translate(-2 1)" />
          <path d={`M${f(cx + 12)} 116 Q${f(cx + 2)} 124 ${f(cx - 6)} 128`} stroke={shade(sh, -0.3)} strokeWidth="1.4" fill="none" />
          <path d={`M${f(hipL - 10)} ${tunicLen - 4} L${f(hipL - 4)} ${tunicLen + 10} L${f(cx - 4)} ${tunicLen - 2} M${f(cx - 2)} 220 L${f(cx - 6)} ${tunicLen - 4}`} stroke={shade(sh, -0.3)} strokeWidth="1.1" fill="none" />
          {belt}
        </g>
      );
    case "incrociata":
      // tunica a portafoglio con collo a V incrociato e balza sovrapposta
      return (
        <g>
          <path d={`M${f(cx - 14)} 114 L${f(cx + 8)} 170 M${f(cx + 14)} 114 L${f(cx - 4)} 152`} stroke={tr} strokeWidth="5" strokeLinecap="round" />
          <path d={`M${f(cx - 14)} 114 L${f(cx + 8)} 170`} stroke={shade(tr, -0.35)} strokeWidth="1" transform="translate(2 0)" />
          <path d={`M${f(hipL - 6)} 232 Q${f(cx)} 238 ${f(hipR + 8)} 230`} stroke={shade(sh, -0.3)} strokeWidth="1.4" fill="none" />
          <path d={`M${f(hipL - 8)} 232 L${f(hipL - 12)} ${tunicLen} M${f(hipR + 8)} 230 L${f(hipR + 12)} ${tunicLen}`} stroke={shade(sh, -0.25)} strokeWidth="1" />
          {[[-16, 212, -20, 248], [0, 214, 0, 250], [14, 212, 18, 248]].map(([x1, y1, x2, y2]) => <path key={x1} d={`M${f(cx + x1)} ${y1} Q${f(cx + (x1 + x2) / 2 + 2)} ${(y1 + y2) / 2} ${f(cx + x2)} ${y2}`} stroke={shade(sh, -0.22)} strokeWidth="1" fill="none" />)}
          {look.sash ? null : <rect x={f(hipL - 3)} y="186" width={f(hipR - hipL + 6)} height="20" rx="3" fill={shade(tr, -0.1)} stroke={OUTLINE} strokeOpacity="0.7" strokeWidth="1.2" />}
          {belt}
        </g>
      );
    case "giubba":
      // giubba di cuoio senza maniche sopra la camicia, chiusa da alamari
      return (
        <g>
          <path d={`M${f(cx - 10)} 114 Q${f(cx)} 120 ${f(cx + 10)} 114 L${f(cx + 12)} 122 Q${f(cx)} 128 ${f(cx - 12)} 122 Z`} fill={look.sleeves || "#c9b48a"} />
          <path d={`M${f(cx + 1)} 122 L${f(cx + 1)} 228`} stroke={shade(sh, -0.45)} strokeWidth="1.4" />
          {[136, 150, 164, 178].map((y) => (
            <g key={y}>
              <rect x={f(cx - 5)} y={y - 1.6} width="12" height="3.2" rx="1.6" fill={tr} stroke={shade(tr, -0.45)} strokeWidth="0.6" />
              <path d={`M${f(cx - 8)} ${y} h3 M${f(cx + 7)} ${y} h3`} stroke={shade(sh, -0.5)} strokeWidth="1.2" />
            </g>
          ))}
          <path d={`M${f(shoulderL + 2)} 126 C${f(shoulderL + 4)} 150 ${f(shoulderL + 2)} 176 ${f(hipL)} 200 M${f(shoulderR - 2)} 126 C${f(shoulderR - 4)} 150 ${f(shoulderR - 2)} 176 ${f(hipR)} 200`} stroke={shade(sh, 0.25)} strokeWidth="1" strokeDasharray="2.5 2" fill="none" />
          <path d={`M${f(cx + 1)} 212 L${f(cx + 1)} ${tunicLen}`} stroke={shade(sh, -0.5)} strokeWidth="2" />
          {belt}
        </g>
      );
    case "cappotto":
    case "cappotto-lungo": {
      // cappotto lungo con collo alto, bordi e, nel modello lungo, spacchi a pannelli
      const long = look.top === "cappotto-lungo";
      return (
        <g>
          <path d={`M${f(cx - 12)} 108 L${f(cx + 12)} 108 L${f(cx + 14)} 122 L${f(cx - 14)} 122 Z`} fill={shade(sh, -0.15)} stroke={tr} strokeWidth="1.2" />
          <path d={`M${f(cx + 2)} 122 L${f(cx + 6)} ${tunicLen}`} stroke={tr} strokeWidth="2.2" />
          <path d={`M${f(cx + 2)} 122 L${f(cx + 6)} ${tunicLen}`} stroke={OUTLINE} strokeOpacity="0.7" strokeWidth="0.8" transform="translate(-2 0)" />
          {[132, 146, 160, 174].map((y) => <circle key={y} cx={f(cx + 8)} cy={y} r="1.5" fill={tr} />)}
          <path d={`M${f(shoulderL + 4)} 140 L${f(cx - 6)} 140 M${f(shoulderR - 4)} 140 L${f(cx + 12)} 140`} stroke={shade(sh, -0.4)} strokeWidth="1.2" />
          <path d={`M${f(hipL - 10)} ${tunicLen} L${f(hipR + 12)} ${tunicLen}`} stroke={tr} strokeWidth="2" />
          {long ? (
            <g>
              {[-16, 18].map((dx) => <path key={dx} d={`M${f(cx + dx)} 214 L${f(cx + dx * 1.25)} ${tunicLen}`} stroke={shade(sh, -0.5)} strokeWidth="1.6" />)}
              {[-16, 18].map((dx) => <path key={`t${dx}`} d={`M${f(cx + dx + 2)} 214 L${f(cx + dx * 1.25 + 2)} ${tunicLen}`} stroke={tr} strokeWidth="1" opacity="0.7" />)}
              <path d={`M${f(cx - 22)} ${tunicLen - 2} l6 8 l6 -8 M${f(cx + 20)} ${tunicLen - 2} l6 8 l6 -8`} fill={shade(sh, -0.15)} stroke={tr} strokeWidth="1" />
            </g>
          ) : (
            [[-14, 214, -18, 254], [16, 214, 20, 254]].map(([x1, y1, x2, y2]) => <path key={x1} d={`M${f(cx + x1)} ${y1} Q${f(cx + (x1 + x2) / 2 + 2)} ${(y1 + y2) / 2} ${f(cx + x2)} ${y2}`} stroke={shade(sh, -0.25)} strokeWidth="1" fill="none" />)
          )}
          {belt}
        </g>
      );
    }
    case "canotta":
      return (
        <g>
          <path d={`M${f(cx - 14)} 116 Q${f(cx)} 138 ${f(cx + 14)} 116 L${f(cx + 10)} 114 Q${f(cx)} 130 ${f(cx - 10)} 114 Z`} fill={look.skin} />
          <path d={`M${f(cx - 14)} 116 Q${f(cx)} 138 ${f(cx + 14)} 116`} stroke={tr} strokeWidth="2.4" fill="none" />
          <path d={`M${f(shoulderL + 4)} 126 Q${f(shoulderL + 10)} 150 ${f(shoulderL + 4)} 170 M${f(shoulderR - 4)} 126 Q${f(shoulderR - 10)} 150 ${f(shoulderR - 4)} 170`} stroke={tr} strokeWidth="2" fill="none" />
          {belt}
        </g>
      );
    case "camicia":
      return (
        <g>
          <path d={`M${f(cx - 12)} 112 L${f(cx)} 122 L${f(cx - 4)} 130 L${f(cx - 14)} 120 Z M${f(cx + 12)} 112 L${f(cx)} 122 L${f(cx + 4)} 130 L${f(cx + 14)} 120 Z`} fill={shade(sh, 0.18)} stroke={shade(sh, -0.4)} strokeWidth="0.8" />
          <path d={`M${f(cx)} 122 L${f(cx)} 206`} stroke={shade(sh, -0.3)} strokeWidth="1.2" />
          {[134, 148, 162, 176, 190].map((y) => <circle key={y} cx={f(cx + 2)} cy={y} r="1.3" fill={tr} />)}
          <rect x={f(cx + 6)} y="138" width="12" height="11" rx="1.5" fill="none" stroke={shade(sh, -0.35)} strokeWidth="1" />
          {belt}
        </g>
      );
    case "divisa":
      return (
        <g>
          <path d={`M${f(cx - 10)} 116 Q${f(cx)} 126 ${f(cx + 10)} 116`} stroke={tr} strokeWidth="3.2" fill="none" />
          <path d={`M${f(shoulderL + 2)} 150 L${f(shoulderR - 2)} 136 L${f(shoulderR - 2)} 146 L${f(shoulderL + 2)} 160 Z`} fill={tr} opacity="0.9" />
          <path d={`M${f(shoulderL + 2)} 164 L${f(shoulderR - 2)} 150`} stroke={tr} strokeWidth="1.6" opacity="0.7" />
          <circle cx={f(cx + 10)} cy="128" r="4.2" fill={shade(sh, 0.3)} stroke={tr} strokeWidth="1" />
          <path d={`M${f(cx + 7.6)} 129.6 l2.4 -4 l2.4 4`} stroke={tr} strokeWidth="0.9" fill="none" />
          {belt}
        </g>
      );
    case "cotta":
      return (
        <g>
          <path d={`M${f(shoulderL + 2)} 124 L${f(shoulderR - 2)} 124 L${f(hipR + 10)} ${tunicLen} L${f(hipL - 10)} ${tunicLen} Z`} fill="#8d949b" opacity="0.92" />
          {Array.from({ length: Math.max(1, Math.floor((tunicLen - 126) / 5)) }, (_, r) => (
            <path key={r} d={`M${f(shoulderL)} ${128 + r * 5} ${Array.from({ length: 14 }, () => "q1.8 2.6 3.6 0").join(" ")}`} stroke="#5d646b" strokeWidth="0.7" fill="none" opacity="0.75" />
          ))}
          <path d={`M${f(cx - 14)} 116 Q${f(cx)} 128 ${f(cx + 14)} 116`} stroke={sh} strokeWidth="5" fill="none" />
          <path d={`M${f(hipL - 10)} ${tunicLen - 1} L${f(hipR + 10)} ${tunicLen - 1}`} stroke={tr} strokeWidth="2" />
          {belt}
        </g>
      );
    default:
      return (
        <g>
          <path d={`M${f(cx - 10)} 116 Q${f(cx)} ${woman ? 130 : 126} ${f(cx + 10)} 116`} stroke={shade(sh, -0.35)} strokeWidth="2.5" fill="none" />
          <path d={`M${f(cx - 13)} 150 h26`} stroke={tr} strokeWidth="5" opacity="0.85" />
          {belt}
        </g>
      );
  }
}

/** Capelli dietro la testa e sulle spalle. */
// ---- capelli di profilo dipinti, leggeri per il gioco: le ciocche si calcolano una volta sola
// (stessi capelli, stesso disegno) e si ritagliano sulla forma dei capelli; niente maschere né filtri ----
const strandCache = new Map<string, { dk: string; lt: string }>();
const hashP = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
type ProfileWeave = "down" | "sweep" | "curl" | "braid" | "beard" | "stubble" | "stache" | "felt" | "knit" | "metal";
function profileStrands(kind: ProfileWeave, box: [number, number, number, number], seed: number) {
  const key = `${kind}|${box.join(",")}|${seed}`;
  const hit = strandCache.get(key);
  if (hit) return hit;
  const [bx, by, bw, bh] = box;
  const R = (k: number) => hashP(seed * 1000 + k);
  let dk = "";
  let lt = "";
  const push = (seg: string, i: number) => {
    if (i % 3 === 0) lt += seg;
    else dk += seg;
  };
  if (kind === "felt") {
    // feltro e panno: granelli fitti chiari e scuri
    const n = Math.round((bw * bh) / 1.3);
    for (let i = 0; i < n; i++) push(`M${f(bx + R(i) * bw)} ${f(by + R(i + 500) * bh)} l0.25 0.2`, i);
  } else if (kind === "knit") {
    // maglia: file di "v"
    let row = 0;
    for (let y = by; y < by + bh; y += 2, row++) for (let x = bx + (row % 2) * 1.2; x < bx + bw; x += 2.4) push(`M${f(x)} ${f(y)} l0.9 1.3 l0.9 -1.3`, row % 3 === 0 ? 0 : 1);
  } else if (kind === "metal") {
    // metallo: bande di riflesso orizzontali che seguono la cupola
    // tre bande larghe: luce in alto, ombra al centro, riflesso del terreno in basso
    [[0.2, 0], [0.48, 1], [0.78, 0]].forEach(([k, isDark]) => {
      const y = by + bh * k;
      push(`M${f(bx)} ${f(y + 2)} Q${f(bx + bw / 2)} ${f(y - 2)} ${f(bx + bw)} ${f(y + 2)}`, isDark ? 1 : 0);
    });
  } else if (kind === "beard" || kind === "stubble") {
    // peli corti che scendono verso il mento (in avanti, verso il viso); l'accenno è solo puntini
    const n = Math.round((bw * bh) / (kind === "stubble" ? 1.5 : 3.2));
    for (let i = 0; i < n; i++) {
      const x = bx + R(i) * bw;
      const y = by + R(i + 500) * bh;
      const len = kind === "stubble" ? 0.55 + R(i + 900) * 0.35 : 1.6 + R(i + 900) * 1.4;
      push(`M${f(x)} ${f(y)} l${f(len * 0.35)} ${f(len)}`, kind === "stubble" ? 1 : i);
    }
  } else if (kind === "stache") {
    const n = Math.round((bw * bh) / 1.4);
    for (let i = 0; i < n; i++) {
      const x = bx + R(i) * bw;
      const y = by + R(i + 500) * bh;
      const len = 1.2 + R(i + 900) * 1;
      push(`M${f(x)} ${f(y)} l${f(len * 0.6)} ${f(len * 0.8)}`, i);
    }
  } else if (kind === "curl") {
    const n = Math.round((bw * bh) / 9);
    for (let i = 0; i < n; i++) {
      const x = bx + R(i) * bw;
      const y = by + R(i + 500) * bh;
      const r = 1.4 + R(i + 900) * 1.6;
      push(`M${f(x - r)} ${f(y)} a${f(r)} ${f(r)} 0 1 1 ${f(r * 1.7)} ${f(r * 0.7)}`, i);
    }
  } else if (kind === "braid") {
    let row = 0;
    for (let y = by; y < by + bh; y += 2.6, row++) {
      for (let x = bx; x < bx + bw; x += 3) push(`M${f(x)} ${f(y)} l${row % 2 ? 2 : -2} 1.8`, row % 2 ? 1 : 0);
    }
  } else if (kind === "sweep") {
    // pettinati all'indietro: archi che seguono la curva del cranio, dalla fronte verso la nuca
    const cx = bx + bw * 0.52;
    const cy = by + bh * 0.72;
    const n = 80;
    const pt = (r: number, deg: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy - r * Math.sin((deg * Math.PI) / 180)];
    for (let i = 0; i < n; i++) {
      const r = 10 + R(i) * 24;
      const a1 = 15 + R(i + 300) * 120;
      const a2 = a1 + 25 + R(i + 600) * 45;
      const [x1, y1] = pt(r, a1);
      const [x2, y2] = pt(r * (0.96 + R(i + 700) * 0.08), a2);
      const [mx, my] = pt(r * 1.04, (a1 + a2) / 2);
      const qx = 2 * mx - (x1 + x2) / 2;
      const qy = 2 * my - (y1 + y2) / 2;
      push(`M${f(x1)} ${f(y1)} Q${f(qx)} ${f(qy)} ${f(x2)} ${f(y2)}`, i);
    }
  } else {
    const n = Math.round(bw * 1.1);
    for (let i = 0; i < n; i++) {
      const x = bx + R(i) * bw;
      const y0 = by + R(i + 300) * bh * 0.2;
      const len = bh * (0.5 + R(i + 600) * 0.5);
      const w1 = (R(i + 800) - 0.5) * 3;
      push(`M${f(x)} ${f(y0)} c${f(w1)} ${f(len / 3)} ${f(-w1)} ${f((len * 2) / 3)} ${f(w1 * 0.4)} ${f(len)}`, i);
    }
  }
  const out = { dk, lt };
  strandCache.set(key, out);
  return out;
}
function ProfileHairPaint({ uid, id, clip, kind, box, color, seed = 1 }: { uid: string; id: string; clip: ReactNode; kind: ProfileWeave; box: [number, number, number, number]; color: string; seed?: number }) {
  const { dk, lt } = profileStrands(kind, box, seed);
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id={`${uid}${id}`}>{clip}</clipPath>
        <linearGradient id={`${uid}${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.34" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${uid}${id})`} fill="none" strokeLinecap="round">
        <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} fill={`url(#${uid}${id}g)`} />
        <path d={dk} stroke={kind === "metal" ? "#000" : shade(color, -0.52)} strokeOpacity={kind === "stubble" ? 0.4 : kind === "metal" ? 0.12 : kind === "felt" ? 0.35 : 0.55} strokeWidth={kind === "braid" ? 0.5 : kind === "stubble" ? 0.2 : kind === "metal" ? 3.2 : kind === "felt" ? 0.35 : 0.36} />
        <path d={lt} stroke={kind === "metal" ? "#fff" : shade(color, 0.48)} strokeOpacity={kind === "metal" ? 0.26 : kind === "felt" ? 0.3 : 0.45} strokeWidth={kind === "braid" ? 0.4 : kind === "metal" ? 2.4 : kind === "felt" ? 0.3 : 0.3} />
        {/* lume morbido in alto a sinistra */}
        {kind === "felt" || kind === "knit" || kind === "metal" ? <ellipse cx={box[0] + box[2] * 0.38} cy={box[1] + box[3] * 0.3} rx={box[2] * 0.26} ry={box[3] * 0.16} fill="#fff" opacity={kind === "metal" ? 0.22 : 0.1} /> : null}
      </g>
    </g>
  );
}

function HairBack({ look, uid, t }: { look: AvatarLook; uid: string; t: number }) {
  const sway = Math.sin(t * 1.6) * 2;
  const kid = look.body === "ragazzo" || look.body === "ragazza";
  const tr = kid ? "translate(150 86) scale(1.14) translate(-150 -86)" : undefined;
  const fill = `url(#${uid}hair)`;
  if (look.hat === "cappuccio" || look.hat === "elmo") return null;
  let node: ReactNode = null;
  // forme per ritagliare le ciocche dipinte (stesse forme dei capelli, senza colore)
  let clip: ReactNode = null;
  let kind: ProfileWeave = "down";
  const one = (d: string) => {
    node = <path d={d} fill={fill} />;
    clip = <path d={d} />;
  };
  switch (look.hair) {
    case "lunghi":
      one(`M134 70 C120 92 118 132 ${f(126 + sway)} 160 L150 156 C142 128 140 104 144 86 Z`);
      break;
    case "coda":
      one(`M131 78 C118 88 ${f(112 + sway)} 112 ${f(118 + sway * 1.5)} 140 C123 136 126 122 126 110 C128 98 134 90 138 84 Z`);
      break;
    case "treccia":
      node = (
        <g fill={fill}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ellipse key={i} cx={f(132 - i * 1.6 + sway * (i / 5))} cy={98 + i * 11} rx={6 - i * 0.4} ry="7" stroke={shade(look.hairColor, -0.4)} strokeWidth="0.8" />
          ))}
        </g>
      );
      clip = [0, 1, 2, 3, 4, 5].map((i) => <ellipse key={i} cx={f(132 - i * 1.6 + sway * (i / 5))} cy={98 + i * 11} rx={6 - i * 0.4} ry="7" />);
      kind = "braid";
      break;
    case "codini":
      node = (
        <g fill={fill}>
          <path d={`M130 86 C118 92 ${f(116 + sway)} 112 ${f(120 + sway)} 128 C126 124 130 110 134 96 Z`} />
          <path d={`M160 66 C170 58 ${f(176 + sway)} 64 ${f(178 + sway)} 74 C172 72 166 70 162 72 Z`} opacity="0.85" />
        </g>
      );
      clip = <path d={`M130 86 C118 92 ${f(116 + sway)} 112 ${f(120 + sway)} 128 C126 124 130 110 134 96 Z`} />;
      break;
    case "caschetto":
      one("M128 76 C124 90 126 104 132 110 L146 108 C140 98 140 88 144 80 Z");
      break;
    case "lunghi-mossi":
      one(`M134 68 C116 86 ${f(118 + sway)} 112 ${f(112 + sway)} 128 C${f(120 + sway)} 136 ${f(110 + sway * 1.3)} 148 ${f(120 + sway * 1.5)} 166 C130 160 138 162 148 156 C140 140 146 128 140 116 C146 102 142 90 146 82 Z`);
      break;
    case "trecce":
      node = (
        <g fill={fill}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <ellipse key={`a${i}`} cx={f(134 - i * 1.4 + sway * (i / 6))} cy={96 + i * 10} rx={5.4 - i * 0.35} ry="6.4" stroke={shade(look.hairColor, -0.4)} strokeWidth="0.8" />)}
          {[0, 1, 2, 3, 4].map((i) => <ellipse key={`b${i}`} cx={f(142 + i * 0.6 + sway * 0.5 * (i / 4))} cy={104 + i * 10} rx={4.6 - i * 0.3} ry="5.6" stroke={shade(look.hairColor, -0.4)} strokeWidth="0.8" opacity="0.9" />)}
        </g>
      );
      clip = [0, 1, 2, 3, 4, 5, 6].map((i) => <ellipse key={`a${i}`} cx={f(134 - i * 1.4 + sway * (i / 6))} cy={96 + i * 10} rx={5.4 - i * 0.35} ry="6.4" />);
      kind = "braid";
      break;
    case "afro":
      node = <circle cx="146" cy="72" r="27" fill={fill} />;
      clip = <circle cx="146" cy="72" r="27" />;
      kind = "curl";
      break;
    case "dread":
      node = (
        <g fill="none" stroke={fill} strokeLinecap="round">
          {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${136 - i * 1.5} ${70 + i * 3} C${f(128 - i * 2 + sway * 0.4)} ${100 + i * 3} ${f(126 - i + sway)} ${124 + i * 2} ${f(128 - i * 2 + sway * 1.3)} ${148 + i * 2}`} strokeWidth="5.2" />)}
          {[0, 1, 2, 3, 4, 5].map((i) => <path key={`l${i}`} d={`M${f(128 - i * 2 + sway * 1.3)} ${146 + i * 2} l0 3`} stroke={shade(look.hairColor, -0.45)} strokeWidth="5.4" />)}
          {/* filo di luce lungo ogni ciocca */}
          {[0, 1, 2, 3, 4, 5].map((i) => <path key={`h${i}`} d={`M${136 - i * 1.5 - 1} ${70 + i * 3} C${f(128 - i * 2 + sway * 0.4 - 1)} ${100 + i * 3} ${f(126 - i + sway - 1)} ${124 + i * 2} ${f(128 - i * 2 + sway * 1.3 - 1)} ${146 + i * 2}`} stroke={shade(look.hairColor, 0.4)} strokeOpacity="0.45" strokeWidth="1.1" />)}
        </g>
      );
      break;
    case "vichinga":
      node = (
        <g fill={fill}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <ellipse key={i} cx={f(134 - i * 1.8 + sway * (i / 6))} cy={70 + i * 9.5} rx={5.4 - i * 0.35} ry="6" stroke={shade(look.hairColor, -0.4)} strokeWidth="0.8" />)}
        </g>
      );
      clip = [0, 1, 2, 3, 4, 5, 6].map((i) => <ellipse key={i} cx={f(134 - i * 1.8 + sway * (i / 6))} cy={70 + i * 9.5} rx={5.4 - i * 0.35} ry="6" />);
      kind = "braid";
      break;
    case "coda-alta": {
      const d = `M140 60 C126 50 ${f(110 + sway)} 66 ${f(114 + sway * 1.4)} 112 C118 106 121 92 126 82 C129 74 134 68 142 66 Z`;
      node = <path d={d} fill={fill} stroke={shade(look.hairColor, -0.4)} strokeWidth="0.6" />;
      clip = <path d={d} />;
      break;
    }
    case "raccolti":
      node = (
        <g>
          <circle cx="136" cy="62" r="8.5" fill={fill} stroke={shade(look.hairColor, -0.4)} strokeWidth="0.8" />
          <path d="M131 58 q5 4 10 0" stroke={shade(look.hairColor, -0.45)} strokeWidth="0.7" fill="none" />
        </g>
      );
      break;
    default:
      node = null;
  }
  // barra della lunghezza: i capelli lunghi scendono o salgono partendo dalla nuca
  const sy = 0.5 + (tune(look.hairLength, 50, 0, 100) / 100) * 1.0;
  const len = `translate(0 74) scale(1 ${sy.toFixed(3)}) translate(0 -74)`;
  return node ? (
    <g transform={tr}>
      <g transform={len}>
        {node}
        {clip ? <ProfileHairPaint uid={uid} id="hbp" clip={clip} kind={kind} box={[104, 46, 74, 124]} color={look.hairColor} seed={look.hair.length} /> : null}
      </g>
    </g>
  ) : null;
}

/**
 * Base dei capelli sulla testa: copre nuca, tempia e basetta davanti all'orecchio, così
 * tra capelli e pelle non resta mai uno spazio scoperto. Sopra vanno le pettinature.
 */
function HairCap({ look, uid }: { look: AvatarLook; uid: string }) {
  if (["calvo", "rasati", "cresta", "undercut", "vichinga"].includes(look.hair) || look.hat === "cappuccio" || look.hat === "elmo") return null;
  const nape = 96 + (tune(look.hairLength, 50, 0, 100) - 50) * 0.12;
  const d = `M127.6 90 C126.2 70 137 58.6 151 57.6 C163 57.6 170.6 64 171.6 74.5 C166.2 70.8 159.2 69.8 153.2 71.8 C148.6 70.4 144.8 73.2 144.2 79 C145.2 84 146 88.6 146.6 93 C144.4 95 142 95.6 139.8 95.2 C137.4 ${f(nape + 1)} 133.4 ${f(nape + 3.5)} 130.4 ${f(nape + 2.5)} C128.6 ${f(nape - 1)} 127.6 94 127.6 90 Z`;
  return (
    <g>
      <path d={d} fill={`url(#${uid}hair)`} stroke={blend(shade(look.hairColor, -0.6), "#1b130d", 0.4)} strokeOpacity="0.7" strokeWidth="0.6" />
      <ProfileHairPaint uid={uid} id="hcp" clip={<path d={d} />} kind={look.hair === "ricci" ? "curl" : "sweep"} box={[124, 56, 50, 42]} color={look.hairColor} seed={5} />
      <path d="M146.4 80 C147 86 147.4 90 147 93.4" stroke={shade(look.hairColor, -0.35)} strokeWidth="0.9" fill="none" opacity="0.7" />
    </g>
  );
}

/** punti di controllo del naso di profilo, a partire dalla radice (173, 83) */
const NOSES: Record<string, number[]> = {
  dritto: [175, 86, 177, 90, 178.5, 94, 177, 95.6, 175, 96, 173, 96],
  aquilino: [176, 84, 178, 88, 180, 94, 178, 96, 176, 96.5, 173, 96.5],
  largo: [175, 86, 178, 90, 179.5, 94, 178.5, 97, 175, 97.5, 172.5, 97],
  piccolo: [174, 87, 175.5, 90, 176.5, 93.5, 175.5, 95, 174, 95.5, 172.5, 95.5],
  insu: [174.5, 86, 176, 90.5, 178.4, 92.4, 178, 94.8, 175.4, 96, 173, 96],
  patata: [175, 86, 176, 88.6, 179.2, 92, 181.4, 95.4, 177, 97.8, 173, 96.8],
};

/** Testa di profilo verso il bersaglio, con espressione. */
function Head({ look, H, face, blink, uid, t, cssBlink = false }: { look: AvatarLook; H: P; face: string; blink: boolean; uid: string; t: number; cssBlink?: boolean }) {
  const skin = look.skin;
  const skinD = shade(skin, -0.22);
  const hair = look.hairColor;
  const woman = look.body === "donna" || look.body === "ragazza";
  const dy = H.y - 86;
  const chinY = look.face === "allungato" ? 114 : look.face === "tondo" ? 108 : 111;
  const jaw = look.face === "squadrato" ? `C171 ${chinY - 2} 168 ${chinY + 1} 160 ${chinY + 1} L148 ${chinY - 2}` : look.face === "tondo" ? `C172 ${chinY} 166 ${chinY + 3} 158 ${chinY + 2} C152 ${chinY + 1} 148 ${chinY - 2} 146 ${chinY - 4}` : `C171 ${chinY} 168 ${chinY + 2} 162 ${chinY + 2} C156 ${chinY + 2} 150 ${chinY - 1} 146 ${chinY - 4}`;
  const NP = NOSES[look.nose] ?? NOSES.dritto;
  const nk = 0.44 + (tune(look.noseSize, 50, 0, 100) / 100) * 0.6;
  const nx = (x: number) => f(173 + (x - 173) * nk);
  const nose = `C${nx(NP[0])} ${NP[1]} ${nx(NP[2])} ${NP[3]} ${nx(NP[4])} ${NP[5]} C${nx(NP[6])} ${NP[7]} ${nx(NP[8])} ${NP[9]} ${nx(NP[10])} ${NP[11]}`;
  const headPath = `M149 62 C162 62 171 70 172 80 L173 83 ${nose} C173.5 98 173.5 99.5 172.6 100.2 C173.2 101.6 172.6 103 171.3 103.5 ${jaw} C138 104 128 97 127 86 C127 71 136 62 149 62 Z`;
  const lid = face === "concentrato" ? 2.2 : face === "deciso" ? 1.4 : 0;
  const browD = face === "deciso" ? "M156.5 75.8 Q162 73.2 168.4 75.6" : face === "concentrato" ? "M156.5 75 Q162 72.6 168.2 74.6" : face === "felice" ? "M156.5 74 Q162 70.6 168 73" : "M156.5 74.6 Q162 71.4 168.2 73.6";
  const browW = look.brows === "folte" ? 3.2 : look.brows === "sottili" ? 1.3 : 2.1;
  const lip = shade(skin, -0.5);
  const mouth =
    face === "felice" ? <path d="M164.5 99 Q168.5 104.5 172.6 100 Q168.6 101.4 164.5 99 Z" fill="#7a2f2a" stroke={lip} strokeWidth="0.9" /> :
    face === "sorriso" ? <><path d="M164 99.4 Q168 102.4 172.4 99.8 Q168.4 100.8 164 99.4 Z" fill="#6e2a25" stroke={lip} strokeWidth="0.9" strokeLinejoin="round" /><path d="M163.4 98.6 q-0.6 0.8 0.2 1.6" stroke={shade(skin, -0.4)} strokeWidth="0.6" fill="none" strokeLinecap="round" opacity="0.7" /></> :
    face === "deciso" ? <path d="M164.5 101 Q168.4 100 172.4 101.2" stroke={lip} strokeWidth="1.3" fill="none" strokeLinecap="round" /> :
    face === "concentrato" ? <path d="M165 100.6 L172.4 100.4" stroke={lip} strokeWidth="1.2" strokeLinecap="round" /> :
    <path d="M164.6 100 Q168.4 101.8 172.4 100" stroke={lip} strokeWidth="1.2" fill="none" strokeLinecap="round" />;
  const capOn = look.hat === "cappuccio" || look.hat === "elmo";
  const lips =
    look.mouth === "sottile" ? <path d="M165 100.6 Q168.6 101.2 172.4 100.6" stroke={lip} strokeWidth="0.8" fill="none" strokeLinecap="round" /> :
    look.mouth === "piena" ? <path d="M164.4 99.8 Q168.4 98.4 172.8 100 Q168.4 103.6 164.4 99.8 Z" fill={shade(skin, -0.28)} stroke={lip} strokeWidth="0.7" /> :
    look.mouth === "ghigno" ? <path d="M164.6 101.4 Q168 101.2 172.6 98.8" stroke={lip} strokeWidth="1.2" fill="none" strokeLinecap="round" /> :
    look.mouth === "aperta" ? <path d="M165 99.6 Q168.6 104 172.4 100 Q168.6 101.4 165 99.6 Z" fill="#5a1f1a" stroke={lip} strokeWidth="0.8" /> :
    look.mouth === "broncio" ? <path d="M164.8 100.4 Q168.6 98.6 172.4 101" stroke={lip} strokeWidth="1.3" fill="none" strokeLinecap="round" /> : null;
  return (
    <g transform={`translate(0 ${f(dy)})`}>
      {look.hair !== "calvo" && look.hair !== "rasati" && look.hair !== "cresta" && !capOn ? <path d="M131 84 C127 66 138 57 150 57 C140 64 136 76 138 92 Z" fill={`url(#${uid}hair)`} /> : null}
      {/* volto di profilo dipinto: contorno nel tono scuro della pelle, non più a china nera */}
      <path d={headPath} fill={`url(#${uid}face)`} stroke={shade(skin, -0.55)} strokeOpacity="0.62" strokeWidth="0.7" />
      <g transform={`translate(151 74) scale(${Math.max(1, hairScale(look)).toFixed(3)}) translate(-151 -74)`}>
        <HairCap look={look} uid={uid} />
      </g>
      {look.ears === "punta" ? (
        <path d="M137.4 94 C136 88 136.4 82 139 78 C140 74 141 70 141.4 66 C143 71 145.4 78 145.4 86 C145.4 91 143.6 95 141 95.6 C139.6 95.8 138.2 95.2 137.4 94 Z" fill={`url(#${uid}pear)`} stroke={shade(skin, -0.5)} strokeOpacity="0.6" strokeWidth="0.6" strokeLinejoin="round" />
      ) : (
        <ellipse cx="141" cy="88" rx={look.ears === "grandi" ? 5.4 : look.ears === "piccole" ? 3.6 : 4.4} ry={look.ears === "grandi" ? 8 : look.ears === "piccole" ? 5.4 : 6.6} fill={`url(#${uid}pear)`} stroke={shade(skin, -0.5)} strokeOpacity="0.6" strokeWidth="0.6" />
      )}
      <radialGradient id={`${uid}pear`} cx="55%" cy="45%" r="65%">
        <stop offset="0" stopColor={blend(skin, "#c8564c", 0.22)} />
        <stop offset="0.6" stopColor={blend(shade(skin, -0.1), "#b5483e", 0.12)} />
        <stop offset="1" stopColor={shade(skin, -0.3)} />
      </radialGradient>
      <path d="M141 84 Q138 88 141 92" stroke={shade(skin, -0.38)} strokeWidth="0.6" strokeOpacity="0.7" fill="none" />
      <FaceShade uid={uid} headPath={headPath} skin={skin} skinDeep={shade(skin, -0.42)} chinY={chinY} ear={look.ears !== "punta"} earRx={look.ears === "grandi" ? 5.4 : look.ears === "piccole" ? 3.6 : 4.4} earRy={look.ears === "grandi" ? 8 : look.ears === "piccole" ? 5.4 : 6.6} nk={nk} />
      {/* di profilo si vede l'orecchio dal lato della mano della corda: un orecchino solo sull'altro non si vede */}
      {look.earring && (look.earrings !== "1" || sideOf(look.earringSide, nearSide(look)) === nearSide(look)) ? <Earring kind={look.earringType} x={141.5} y={96} /> : null}
      <radialGradient id={`${uid}blp`}>
        <stop offset="0" stopColor={look.blush === "abbronzato" ? "#b8643a" : "#e0726b"} />
        <stop offset="1" stopColor={look.blush === "abbronzato" ? "#b8643a" : "#e0726b"} stopOpacity="0" />
      </radialGradient>
      <ellipse cx="161" cy="92" rx="8" ry="5" fill={`url(#${uid}blp)`} opacity={look.blush === "nessuno" ? 0 : look.blush === "rosato" ? 0.34 : look.blush === "abbronzato" ? 0.26 : 0.16} />
      {look.age === "maturo" || look.age === "anziano" ? (
        <g stroke={shade(skin, -0.38)} strokeWidth="0.7" fill="none" opacity={look.age === "anziano" ? 0.8 : 0.5}>
          <path d="M154 70 q6 -1.4 12 0 M155 73 q5 -1 10 0" />
          <path d="M168.6 82 l3 -1.4 M168.4 84 l3 0.6" />
          {look.age === "anziano" ? <path d="M166 94 q2 4 1 7 M156 96 q2 3 1 6" /> : null}
        </g>
      ) : null}
      {look.mark === "neo" ? <circle cx="160" cy="92" r="0.9" fill="#3a2414" /> : null}
      {look.mark === "neo-labbro" ? <circle cx="170.6" cy="97.6" r="0.8" fill="#3a2414" /> : null}
      {look.mark === "mento" ? <path d="M166 104 l3 3" stroke={shade(skin, -0.42)} strokeWidth="1" strokeLinecap="round" /> : null}
      {look.mark === "neo-fronte" ? <circle cx="164" cy="70.5" r="0.85" fill="#3a2414" /> : null}
      {look.mark === "guancia" ? <path d="M155 89 l5 6" stroke={shade(skin, -0.42)} strokeWidth="1" strokeLinecap="round" /> : null}
      {look.mark === "fossette" ? <path d="M167.2 98.2 q0.8 1.2 0 2.2" stroke={shade(skin, -0.38)} strokeWidth="0.8" fill="none" strokeLinecap="round" /> : null}
      {look.tattoo === "lacrima" ? <path d="M165.4 88 q-1.2 2 0 3 q1.2 -1 0 -3 Z" fill="#24324a" /> : null}
      {look.tattoo === "stelle" ? <g fill="#24324a">{[[146, 104], [149, 108], [145, 109]].map(([x, y]) => <path key={x + y} d={`M${x} ${y - 1.4} l0.5 1 l1.1 0.1 l-0.8 0.7 l0.3 1.1 l-1.1 -0.6 l-1.1 0.6 l0.3 -1.1 l-0.8 -0.7 l1.1 -0.1 Z`} />)}</g> : null}
      <Marks2Profile kinds={[look.mark, look.tattoo]} skin={skin} shade={shade} />
      {/* di profilo si vede la metà dal lato della mano della corda: con due pitture, quella di quel lato */}
      {(() => {
        const kind = look.paint2 && look.paint2 !== "nessuna" && nearSide(look) === "sinistra" ? look.paint2 : look.paint;
        return <FacePaintProfile kind={kind} color={paintColor(kind)} />;
      })()}
      <path d={`M${nx(174.2)} ${f(NP[5] + 0.6)} q${f(1.6 * nk)} 1.3 ${f(3 * nk)} 0.3`} stroke={shade(skin, -0.42)} strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* lume sul dorso del naso: dentro il contorno, mai sopra la linea */}
      <path d={`M${f(Number(nx(173.4)) - 1.6)} 86.5 Q${f(Number(nx(NP[2] - 1.4)) - 1.8)} ${f(NP[3])} ${f(Number(nx(NP[4] - 2)) - 1.4)} ${f(NP[5] - 1.6)}`} stroke="#fff" strokeOpacity="0.22" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      {look.freckles ? (
        <g fill={shade(skin, -0.42)} opacity="0.6">
          {[[160, 90], [164, 92], [168, 90], [158, 93], [166, 88], [162, 88]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="0.8" />)}
        </g>
      ) : null}
      {!blink ? (
        <g transform={`translate(163 82) scale(${(eyeShapeK(look)[0] * (0.8 + (tune(look.eyeSize, 50, 0, 100) / 100) * 0.4)).toFixed(3)} ${(eyeShapeK(look)[1] * (0.8 + (tune(look.eyeSize, 50, 0, 100) / 100) * 0.4)).toFixed(3)}) translate(-163 -82)`}>
          <clipPath id={`${uid}pe`}><path d="M157.4 83 C159.6 79.6 164.6 78.2 168.4 81.4 C165.6 84.6 160.8 85.2 157.4 83 Z" /></clipPath>
          <path d="M157.4 83 C159.6 79.6 164.6 78.2 168.4 81.4 C165.6 84.6 160.8 85.2 157.4 83 Z" fill="#f3ece2" />
          <g clipPath={`url(#${uid}pe)`}>
            <ellipse cx="164.6" cy="82" rx="2.4" ry="3.1" fill={look.eyes} />
            <ellipse cx="165" cy="82" rx="1.1" ry="1.5" fill="#120c08" />
          </g>
          <EyeDetail uid={uid} eyes={look.eyes} skinDeep={shade(skin, -0.45)} lid={lid} />
          <circle cx="165.6" cy="80.9" r="0.75" fill="#fff" />
          {lid ? <path d={`M156.8 82.5 Q162.5 ${f(77.2 + lid)} 168.6 81.4 L168.6 79 L156.8 79 Z`} fill={skin} /> : null}
          <path d={`M157.2 83 C159.6 ${f(79.4 + lid * 0.6)} 164.6 ${f(78 + lid * 0.7)} 168.6 81.4`} stroke="#1a110b" strokeWidth={woman ? 1.3 : 1} fill="none" strokeLinecap="round" />
          {woman ? <path d="M167.6 80.6 l2.4 -1.6 M166.2 79.6 l1.6 -2.2 M164.6 79.2 l0.8 -2.4" stroke="#2a1d14" strokeWidth="0.75" strokeLinecap="round" /> : null}
        </g>
      ) : (
        <path d="M157 82.6 Q162.6 85 168.4 81.8" stroke="#2a1d14" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      )}
      {cssBlink && !blink ? (
        // battito delle palpebre a riposo: una palpebra che compare per un attimo (animazione CSS),
        // così l'arciere fermo non va ridisegnato di continuo
        <g className="aa-av-blink">
          <path d="M156.6 83.2 C159.4 78.6 164.8 77.4 168.8 81.2 C165.8 85 160.6 85.6 156.6 83.2 Z" fill={skin} />
          <path d="M157 82.6 Q162.6 85 168.4 81.8" stroke="#2a1d14" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      ) : null}
      <g transform={`rotate(${(browShape(look.browShape).tilt * 5).toFixed(1)} 162 74) translate(162 75) scale(1 ${(1 + browShape(look.browShape).arch * 0.22).toFixed(3)}) translate(-162 -75)`}>
        <path d={browD} stroke={ink(hair, 0.35)} strokeOpacity="0.3" strokeWidth={browW * (0.6 + (tune(look.browSize, 50, 0, 100) / 100) * 0.8) * browShape(look.browShape).thick + 0.3} strokeLinecap="round" fill="none" />
        <path d={browD} stroke={shade(hair, -0.2)} strokeOpacity="0.7" strokeWidth={browW * (0.6 + (tune(look.browSize, 50, 0, 100) / 100) * 0.8) * browShape(look.browShape).thick} strokeLinecap="round" fill="none" />
        <BrowHairs d={browD} color={shade(hair, -0.45)} width={browW * (0.6 + (tune(look.browSize, 50, 0, 100) / 100) * 0.8) * browShape(look.browShape).thick} />
      </g>
      {look.eyepatch && look.eyepatch !== "nessuna" ? <EyepatchProfile kind={look.eyepatch} /> : null}
      {look.mask ? null : face === "felice" || face === "sorriso" || !lips ? mouth : lips}
      {look.mask || face === "felice" || face === "sorriso" || look.mouth === "aperta" ? null : <LipDetail lip={lip} skinDeep={shade(skin, -0.42)} />}
      <path d="M152 95 Q158 98 163 96" stroke={shade(skin, -0.12)} strokeWidth="2" fill="none" opacity="0.4" />
      {look.mask ? null : <Beard look={look} uid={uid} />}
      {look.warpaint ? (
        <g>
          <PaintStroke a={[150, 86]} b={[167, 88.4]} bend={-1} w={2.5} color="#2a3a5a" />
          <PaintStroke a={[151, 91.2]} b={[165.5, 93.6]} bend={-0.8} w={2.2} color="#2a3a5a" />
        </g>
      ) : null}
      {look.scar ? <path d="M158 72 L162 80 M157 85 L161 92 M159.5 76 l2 -1 M159 88 l2 -1" stroke={shade(skin, -0.42)} strokeWidth="1.1" strokeLinecap="round" /> : null}
      {look.mask ? (
        <g>
          <path d="M146 90 C152 88 166 88 174 89 C179 91 181 95 179 98 C177 104 172 110 164 114 C156 117 147 112 142 102 C141 97 142 92 146 90 Z" fill={look.cowlColor} stroke="#1b130d" strokeOpacity="0.75" strokeWidth="1.2" />
          <path d="M150 99 Q162 102 176 97 M149 106 Q160 109 170 106" stroke={shade(look.cowlColor, -0.35)} strokeWidth="1" fill="none" />
        </g>
      ) : null}
      <g transform={`translate(151 70) scale(${hairScale(look).toFixed(3)}) translate(-151 -70)`}>
        <g stroke={shade(look.hairColor, -0.55)} strokeOpacity="0.6" strokeWidth="0.5" strokeLinejoin="round"><HairFront look={look} uid={uid} t={t} /></g>
        <HairStrands look={look} />
      </g>
      {look.hairAcc && look.hairAcc !== "nessuno" && !capOn && look.hair !== "calvo" ? <HairOrnament kind={look.hairAcc} x={134} y={76} tilt={-18} color={look.hatColor} /> : null}
      {look.mark === "sopracciglio" ? <path d="M161.6 72.4 l1.6 2.4" stroke={skin} strokeWidth="1.4" /> : null}
      {look.hairFeather && !capOn ? (
        <g transform="translate(132 76) rotate(-128)">
          <path d="M0 0 C4 -6 6 -18 2 -30 C-3 -20 -4 -8 0 0 Z" fill="#f4f1ea" stroke="#b9ae98" strokeWidth="0.6" />
          <path d="M1 -2 L1.6 -28" stroke="#8a7a5a" strokeWidth="0.6" />
          <path d="M2 -30 c1 -3 3 -4 3 -4" stroke="#c4473d" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ) : null}
      <g transform={capOn ? undefined : turnHat(look, 151)}>
        <Hat look={look} uid={uid} />
      </g>
      {look.sunglasses ? (
        <g>
          <path d="M157.4 80.4 L143 83" stroke="#0e1114" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M157 79.6 C160 78.6 168 78.4 170.6 79.4 C170.6 83.6 168.6 86.2 164 86.2 C159.6 86.2 157.4 83.4 157 79.6 Z" fill={`url(#${uid}lens)`} stroke="#07090b" strokeWidth="0.9" strokeLinejoin="round" />
          <path d="M159.4 80.6 L163.4 80.2 M159.6 83.6 l2.4 -2.6" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.8" strokeLinecap="round" />
        </g>
      ) : null}
      {look.glasses && !look.sunglasses ? (
        <g>
          <path d="M158 82.4 L143 84" stroke="#1d2126" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="163.6" cy="82.4" r="5.6" fill={`url(#${uid}glass)`} stroke="#0f1215" strokeWidth="1.4" />
          <path d="M160.2 80.4 q1.4 -2 3.6 -2.4" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.7" fill="none" strokeLinecap="round" />
        </g>
      ) : null}
    </g>
  );
}

/** proporzioni degli occhi per forma: [larghezza, altezza] */
function eyeShapeK(look: AvatarLook): [number, number] {
  switch (look.eyeShape) {
    case "mandorla":
      return [1.1, 0.82];
    case "tondi":
      return [0.95, 1.15];
    case "allungati":
      return [1.2, 0.76];
    case "socchiusi":
      return [1, 0.62];
    case "grandi":
      return [1.14, 1.18];
    default:
      return [1, 1];
  }
}

/**
 * Il copricapo gira sulla testa attorno all'asse verticale, come quando si ruota un
 * berretto: resta calzato e a 180° la visiera guarda dietro.
 */
function turnHat(look: AvatarLook, cx: number) {
  const a = (tune(look.hatRot, 0, -180, 180) * Math.PI) / 180;
  const c = Math.cos(a);
  const sx = Math.sign(c || 1) * Math.max(0.55, Math.abs(c));
  if (Math.abs(sx - 1) < 0.001) return undefined;
  return `translate(${cx} 0) scale(${sx.toFixed(3)} 1) translate(${-cx} 0)`;
}

/** larghezza del corpo: dalla barra continua, o dalla scelta snello/normale/robusto */
export function bodyWidth(look: AvatarLook) {
  if (look.buildW !== "" && look.buildW != null) return 0.84 + (tune(look.buildW, 50, 0, 100) / 100) * 0.36;
  return look.build === "robusto" ? 1.14 : look.build === "snello" ? 0.9 : 1;
}

/** colore di barba e baffi */
function beardTone(look: AvatarLook) {
  return look.beardColor || shade(look.hairColor, -0.08);
}

/** baffi effettivi: quelli scelti, o quelli che vanno con la barba */
export function stacheOf(look: AvatarLook): AvatarLook["stache"] {
  if (look.stache && look.stache !== "auto") return look.stache;
  return look.beard === "corta" || look.beard === "baffi" ? "classici" : look.beard === "piena" || look.beard === "lunga" ? "folti" : "nessuno";
}

function hairScale(look: AvatarLook) {
  return 0.88 + (tune(look.hairVolume, 50, 0, 100) / 100) * 0.24;
}

function Beard({ look, uid }: { look: AvatarLook; uid: string }) {
  const c = beardTone(look);
  const lo = shade(c, -0.35);
  const k = 0.7 + (tune(look.beardLength, 50, 0, 100) / 100) * 0.6;
  // la barba si allunga verso il basso partendo dal mento
  const grow = `translate(0 100) scale(1 ${k.toFixed(3)}) translate(0 -100)`;
  let body: ReactNode = null;
  let bd = "";
  switch (look.beard) {
    case "piena":
    case "accenno":
      bd = "M138 93 C140 105 148 115 158 115 C166 115 172 108 173 99 C169 101.5 164 102.5 160 101.5 L153 98.5 C148 98.5 143 96 138 93 Z";
      body = <path d={bd} fill={c} opacity={look.beard === "accenno" ? 0.32 : 1} />;
      break;
    case "lunga":
      bd = "M138 93 C139 108 146 122 152 132 C156 138 160 140 164 136 C168 128 172 112 173 99 C169 101.5 164 102.5 160 101.5 L153 98.5 C148 98.5 143 96 138 93 Z";
      body = <path d={bd} fill={c} />;
      break;
    case "corta":
      bd = "M143 97 C145 107 151 112 158 112 C164.5 112 170 107 171.3 101 C167 102.6 163 103.4 159 102.6 C153 101.6 148 100 143 97 Z";
      body = <path d={bd} fill={c} />;
      break;
    case "pizzetto":
      body = <path d="M160 103 C161 109 164 112 168 111 C171 109 171 105 170.2 102 C167 104 163 104 160 103 Z" fill={c} />;
      break;
    case "barbetta":
      body = <path d="M145.5 86 C145 96 148 106 156 110.6 C162 113 168 111 171 104" stroke={c} strokeWidth="3.6" fill="none" strokeLinecap="round" />;
      break;
    case "basette":
      body = <path d="M144.4 80 L148.6 80 L149.6 99 C148 101 145.6 101 145 99 Z" fill={c} />;
      break;
    case "mosca":
      body = <path d="M166.2 102.6 C166.4 105.4 168 106.6 169.6 105.8 C170 104.4 169.6 103 169.2 102.4 Z" fill={c} />;
      break;
    default:
      body = null;
  }
  const st = stacheOf(look);
  const stache =
    st === "sottili" ? <path d="M163 96.8 C166 95.6 170 95.6 173 96.8 C170 97.6 166 97.6 163 96.8 Z" fill={c} /> :
    st === "classici" ? <path d="M160.5 96.4 C164 94.2 169.5 94.4 173.4 96.6 C170 99 164.6 98.8 160.5 96.4 Z" fill={c} /> :
    st === "folti" ? <path d="M159 96.2 C163 92.4 170.5 92.6 175 96.4 C172.6 100.8 164 101 159 96.2 Z" fill={c} /> :
    st === "manubrio" ? (
      <g>
        <path d="M160.5 96.4 C164 94.2 169.5 94.4 173.4 96.6 C170 99 164.6 98.8 160.5 96.4 Z" fill={c} />
        <path d="M172.6 97 C176 98.4 178.6 96.6 178 93.4 C177.6 91.8 176 91.6 175.6 92.8" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </g>
    ) :
    st === "ferro" ? (
      <g>
        <path d="M160.5 96.2 C164 93.8 169.5 94 173.4 96.4 C170 99 164.6 98.8 160.5 96.2 Z" fill={c} />
        <path d="M172.2 97.2 L171 109" stroke={c} strokeWidth="2.8" strokeLinecap="round" />
      </g>
    ) : null;
  const T = (pts: [number, number][], cc: [number, number], len: number) => <Tufts pts={pts} c={cc} len={len * 0.8} fill={c} stroke={shade(c, -0.45)} w={0.3} seed={2} />;
  const sideTufts =
    look.beard === "piena" ? <>{T(cubicPts([138, 93], [140, 105], [148, 115], [158, 115], 0.35, 1, 6), [156, 100], 2.4)}{T(cubicPts([158, 115], [166, 115], [172, 108], [173, 99], 0, 0.75, 6), [156, 100], 2.4)}</> :
    look.beard === "corta" ? <>{T(cubicPts([143, 97], [145, 107], [151, 112], [158, 112], 0.4, 1, 5), [158, 102], 1.7)}{T(cubicPts([158, 112], [164.5, 112], [170, 107], [171.3, 101], 0, 0.7, 5), [158, 102], 1.7)}</> :
    look.beard === "lunga" ? <>{T(cubicPts([138, 93], [139, 108], [146, 122], [152, 132], 0.45, 1, 5), [158, 108], 2.8)}{T(cubicPts([152, 132], [156, 138], [160, 140], [164, 136], 0, 1, 4), [158, 108], 2.8)}{T(cubicPts([164, 136], [168, 128], [172, 112], [173, 99], 0, 0.45, 4), [158, 108], 2.6)}</> :
    look.beard === "pizzetto" ? T(cubicPts([160, 103], [161, 109], [164, 112], [168, 111], 0.2, 1, 4), [166, 104], 1.3) : null;
  const sideClumps = bd && look.beard !== "accenno" ? (
    <Clumps id={`${uid}scb`} clip={<path d={bd} />} dark={shade(c, -0.5)} light={shade(c, 0.42)} w={0.45}
      strokes={[...fanStrokes(139, 172, 96, look.beard === "lunga" ? 20 : look.beard === "corta" ? 11 : 15, 158, 14, 5), ...(look.beard === "lunga" ? fanStrokes(142, 170, 112, 22, 157, 10, 7) : [])]} />
  ) : null;
  return (
    <g>
      {body ? (
        <g transform={look.beard === "basette" || look.beard === "barbetta" ? undefined : grow}>
          {look.beard === "accenno" ? null : <g stroke={shade(c, -0.5)} strokeOpacity="0.55" strokeWidth="0.4" strokeLinejoin="round">{body}</g>}
          {sideClumps}
          {sideTufts}
          {bd && look.beard !== "accenno" ? <BeardTexture uid={uid} d={bd} color={c} light={shade(c, 0.35)} dark={lo} /> : null}
          {/* peli dipinti ritagliati sulla barba; per l'accenno un velo leggero e i puntini */}
          {look.beard === "accenno" ? <path d={bd} fill={blend(c, "#3a4a5a", 0.35)} opacity="0.2" /> : null}
          {look.beard !== "barbetta" ? <ProfileHairPaint uid={uid} id="bdp" clip={hairClipOf(body, c) ?? <path d={bd} />} kind={look.beard === "accenno" ? "stubble" : "beard"} box={[136, 78, 40, 64]} color={c} seed={13} /> : <path d="M145 86 C144.6 96 147.6 106 155.6 110.4 C161.6 112.8 167.6 110.8 170.6 103.8" stroke={shade(c, 0.4)} strokeOpacity="0.45" strokeWidth="1" fill="none" strokeLinecap="round" />}
        </g>
      ) : null}
      {body && look.beard !== "accenno" && look.beard !== "basette" && look.beard !== "mosca" ? <path d="M150 104 q3 3 6 3.4 M157 108 q3 1.6 6 0.4" stroke={lo} strokeWidth="0.4" fill="none" opacity="0.55" /> : null}
      <g stroke={shade(c, -0.5)} strokeOpacity="0.55" strokeWidth="0.35" strokeLinejoin="round">{stache}</g>
      {st === "classici" || st === "folti" || st === "sottili" ? <Clumps id={`${uid}ssc`} clip={<path d={(stache as { props: { d: string } }).props.d} />} dark={shade(c, -0.5)} light={shade(c, 0.45)} w={0.35} strokes={[0, 1, 2, 3, 4, 5, 6].map((k) => `M${(161 + k * 2).toFixed(1)} 94.6 Q${(162 + k * 2.1).toFixed(1)} 96.4 ${(162.4 + k * 2.2).toFixed(1)} 98.6`)} /> : null}
      {stache ? <ProfileHairPaint uid={uid} id="stp" clip={hairClipOf(stache, c)} kind="stache" box={[158, 90, 22, 12]} color={c} seed={17} /> : null}
    </g>
  );
}

/** Ciocche e riflessi sopra i capelli: danno volume e verso alla pettinatura. */
function HairStrands({ look }: { look: AvatarLook }) {
  if (["calvo", "rasati", "cresta", "undercut", "vichinga", "dread"].includes(look.hair) || ["cappuccio", "elmo", "bandana", "tesa", "robin", "cuffia"].includes(look.hat)) return null;
  const hi = shade(look.hairColor, 0.38);
  const lo = shade(look.hairColor, -0.42);
  const curly = look.hair === "ricci" || look.hair === "afro";
  return (
    <g fill="none" strokeLinecap="round" pointerEvents="none">
      {curly ? (
        <g stroke={lo} strokeOpacity="0.55" strokeWidth="0.55">
          {[[138, 62], [148, 58], [158, 60], [166, 66], [134, 72], [144, 66]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y} q3 -3 6 0 q-3 3 -6 0`} />)}
        </g>
      ) : (
        <>
          <path d="M136 66 Q148 56 164 62" stroke={hi} strokeOpacity="0.45" strokeWidth="0.6" />
          <path d="M140 61 Q152 54 166 60" stroke={hi} strokeOpacity="0.35" strokeWidth="0.45" />
          <path d="M133 74 Q144 64 158 66 M146 60 Q156 58 168 68 M131 82 Q136 72 146 70" stroke={lo} strokeOpacity="0.45" strokeWidth="0.45" />
        </>
      )}
      <HairFineStrands color={look.hairColor} light={hi} dark={lo} curly={curly} />
    </g>
  );
}

/** Dalle forme dei capelli (quelle col colore dei capelli) ricava le stesse forme senza colore, per ritagliarci le ciocche. */
function hairClipOf(node: ReactNode, fill: string, inherited = false): ReactNode {
  if (Array.isArray(node)) return node.map((n) => hairClipOf(n, fill, inherited));
  if (!isValidElement(node)) return null;
  const el = node as ReactElement<{ fill?: string; children?: ReactNode; opacity?: string | number }>;
  const own = el.props.fill;
  const isHair = own === fill || (own == null && inherited);
  // dentro un clipPath i gruppi non contano: si restituiscono le forme in fila
  if (el.type === "g") return hairClipOf(el.props.children, fill, isHair);
  if ((el.type === "path" || el.type === "circle" || el.type === "ellipse") && isHair && el.props.opacity == null) return cloneElement(el, { fill: undefined, stroke: undefined, key: el.key ?? undefined } as never);
  return null;
}

/** Tutte le forme piene (senza colore) di un disegno, per ritagliarci una trama di materiale. */
function solidClipOf(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map((n) => solidClipOf(n));
  if (!isValidElement(node)) return null;
  const el = node as ReactElement<{ fill?: string; children?: ReactNode }>;
  if (el.type === "g") return solidClipOf(el.props.children);
  if ((el.type === "path" || el.type === "circle" || el.type === "ellipse" || el.type === "rect") && el.props.fill && el.props.fill !== "none") return cloneElement(el, { fill: undefined, stroke: undefined, opacity: undefined, key: el.key ?? undefined } as never);
  return null;
}

function HairFront({ look, uid, t }: { look: AvatarLook; uid: string; t: number }) {
  const node = HairFrontShape({ look, uid, t });
  if (!node) return null;
  const fill = `url(#${uid}hair)`;
  const clip = hairClipOf(node, fill);
  const kind: ProfileWeave = look.hair === "ricci" || look.hair === "afro" ? "curl" : look.hair === "vichinga" ? "braid" : "sweep";
  return (
    <g>
      {node}
      {clip ? <ProfileHairPaint uid={uid} id="hfp" clip={clip} kind={kind} box={[124, 40, 60, 58]} color={look.hairColor} seed={9} /> : null}
    </g>
  );
}

function HairFrontShape({ look, uid, t }: { look: AvatarLook; uid: string; t: number }): ReactNode {
  const fill = `url(#${uid}hair)`;
  const h = look.hairColor;
  if (look.hat === "cappuccio" || look.hat === "elmo") return null;
  const sway = Math.sin(t * 1.6) * 0.6;
  switch (look.hair) {
    case "calvo":
      return <ellipse cx="150" cy="66" rx="10" ry="3" fill="#fff" opacity="0.12" />;
    case "rasati":
      return <path d="M131 84 C129 67 139 59 151 59 C163 59 171 66 170 76 C164 71 157 70 151 72 C146 69 141 73 141 82 C138 84 135 87 133 91 Z" fill={h} opacity="0.55" />;
    case "cresta":
      return (
        <g>
          <path d="M131 84 C129 67 139 59 151 59 C163 59 171 66 170 76 C164 71 157 70 151 72 C146 69 141 73 141 82 Z" fill={h} opacity="0.35" />
          <path d="M136 66 L138 48 L144 62 L148 44 L153 60 L159 46 L161 62 L168 54 L167 70 C158 64 146 62 136 66 Z" fill={fill} stroke="#1b130d" strokeOpacity="0.8" strokeWidth="0.6" strokeLinejoin="round" />
          <path d="M140 60 L139 52 M148.6 58 L148.4 49 M157.6 59 L158.6 51" stroke={shade(h, 0.35)} strokeOpacity="0.5" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        </g>
      );
    case "ricci":
      return (
        <g fill={fill}>
          {[[136, 70, 8], [144, 61, 8], [155, 58, 8], [165, 63, 7], [170, 72, 5.5], [134, 82, 7], [138, 92, 5.5], [148, 66, 6]].map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}
        </g>
      );
    case "mossi":
      return <path d={`M130 87 C125 64 138 53 152 54 C167 55 ${f(176 + sway)} 64 ${f(172 + sway)} 79 C170 73 166 71 162 73 C160 69 155 68 151 72 C147 68 141 72 142 81 C138 83 136 89 134 96 C131 93 130 90 130 87 Z`} fill={fill} />;
    case "caschetto":
      return <path d="M128 90 C124 66 138 54 152 55 C166 56 175 66 172 80 L160 78 C158 72 152 70 146 72 C142 76 141 84 142 96 C136 98 131 96 128 90 Z" fill={fill} />;
    case "spettinati":
      return <path d={`M130 86 C126 70 132 60 140 57 L138 50 L146 55 L148 46 L154 54 L160 47 L162 56 L170 52 L168 62 C${f(174 + sway)} 64 175 70 172 78 C168 72 162 70 156 72 L158 66 L150 72 C146 70 141 74 141 82 C138 84 135 88 133 94 Z`} fill={fill} />;
    case "lunghi-mossi":
      return <path d={`M129 90 C124 64 138 53 152 54 C167 55 ${f(176 + sway)} 64 ${f(173 + sway)} 80 C170 74 165 72 160 74 C157 69 151 69 147 73 C142 74 140 82 141 92 C137 96 134 104 132 110 C129 104 129 96 129 90 Z`} fill={fill} />;
    case "raccolti":
      return <path d="M131 84 C129 66 139 58 151 58 C163 58 171 65 170 75 C164 70 157 69 151 71 C146 68 141 72 141 82 C138 84 135 87 133 91 Z" fill={fill} />;
    case "afro":
      return (
        <g fill={fill}>
          {[[150, 52, 10], [162, 56, 9], [170, 66, 7], [140, 56, 9], [133, 66, 8]].map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} />)}
        </g>
      );
    case "ciuffo":
      return (
        <g>
          <path d={`M130 86 C126 66 134 54 150 49 C162 45 ${f(178 + sway)} 48 ${f(181 + sway)} 58 C176 60 172 63 170 70 C164 68 157 68 152 71 C147 69 142 73 142 81 C138 84 135 88 133 94 Z`} fill={fill} />
          <path d={`M146 56 C156 50 168 50 ${f(178 + sway)} 56`} stroke={shade(h, 0.35)} strokeWidth="0.6" fill="none" opacity="0.7" />
        </g>
      );
    case "undercut":
      return (
        <g>
          <path d="M131 84 C129 67 139 59 151 59 C163 59 171 66 170 76 C164 71 157 70 151 72 C146 69 141 73 141 82 C138 84 135 87 133 91 Z" fill={h} opacity="0.4" />
          <path d={`M132 70 C134 57 148 50 161 52 C171 54 ${f(177 + sway)} 61 ${f(175 + sway)} 72 C168 66 156 63 140 68 C137 69 134 70 132 70 Z`} fill={fill} />
        </g>
      );
    case "vichinga":
      return (
        <g>
          <path d="M131 84 C129 67 139 59 151 59 C163 59 171 66 170 76 C164 71 157 70 151 72 C146 69 141 73 141 82 C138 84 135 87 133 91 Z" fill={h} opacity="0.35" />
          <path d="M136 62 C146 54 162 54 171 64 L169 70 C160 62 148 62 139 69 Z" fill={fill} />
          {[0, 1, 2].map((i) => <ellipse key={i} cx={162 - i * 8} cy={60 - (i === 1 ? 2 : 0)} rx="4.6" ry="3.4" fill={fill} stroke={shade(h, -0.4)} strokeWidth="0.7" />)}
        </g>
      );
    case "dread":
      return (
        <g>
          <path d="M130 85 C127 66 138 56 151 56 C164 56 173 64 171 77 C166 71 158 69 151 72 C146 69 140 73 141 82 C138 84 135 88 133 94 C131 91 130 88 130 85 Z" fill={fill} />
          {[[150, 60], [158, 61], [165, 66], [142, 64]].map(([x, y]) => <path key={x} d={`M${x} ${y} q2 6 0 12`} stroke={shade(h, -0.4)} strokeWidth="0.55" fill="none" />)}
        </g>
      );
    case "coda-alta":
      return (
        <g>
          <path d="M131 84 C129 66 139 58 151 58 C163 58 171 65 170 75 C164 70 157 69 151 71 C146 68 141 72 141 82 C138 84 135 87 133 91 Z" fill={fill} />
          <path d="M136 64 Q150 58 166 64" stroke={shade(h, -0.35)} strokeWidth="0.5" fill="none" />
        </g>
      );
    case "frangia":
      return (
        <g>
          <path d="M130 86 C127 66 138 56 151 56 C164 56 173 64 172 80 L168 82 C166 76 164 74 160 76 L158 82 C156 76 152 74 148 77 L145 84 C142 84 138 86 134 94 C131 91 130 88 130 86 Z" fill={fill} />
          <path d="M150 62 l-2 14 M158 62 l0 13 M165 66 l1 10" stroke={shade(h, -0.3)} strokeWidth="0.5" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M130 85 C127 66 138 56 151 56 C164 56 173 64 171 77 C166 71 158 69 151 72 C146 69 140 73 141 82 C138 84 135 88 133 94 C131 91 130 88 130 85 Z" fill={fill} />
          {look.hair === "corti" ? <path d="M160 63 l4 -4 l1 6 M166 66 l4 -3 l0 6" stroke={shade(h, -0.3)} strokeWidth="0.5" fill="none" /> : null}
          {look.hair === "chignon" ? <circle cx="134" cy="65" r="9" fill={fill} stroke={shade(h, -0.35)} strokeWidth="0.8" /> : null}
        </g>
      );
  }
}

/** Copricapo di profilo con il suo materiale: panno, maglia o metallo, con luce e profondità. */
function Hat({ look, uid }: { look: AvatarLook; uid: string }) {
  // cappuccio e cuffia su misura di Simone restano qui; gli altri copricapi sono in avatar-hats
  const node = look.hat === "cappuccio" || (look.hat === "cuffia" && look.special === "simone-inverno") ? HatShape({ look }) : SideHat({ look, uid });
  if (!node) return null;
  const kind: ProfileWeave = look.hat === "cuffia" && look.special !== "simone-inverno" ? "knit" : look.hat === "elmo" || look.hat === "corona" || look.hat === "cerchietto" ? "metal" : "felt";
  return (
    <g>
      {node}
      <ProfileHairPaint uid={uid} id="hatp" clip={solidClipOf(node)} kind={kind} box={[118, 30, 76, 56]} color={look.hatColor} seed={29} />
    </g>
  );
}

function HatShape({ look }: { look: AvatarLook }): ReactNode {
  const c = look.hatColor;
  switch (look.hat) {
    case "berretto":
      return (
        <g>
          <path d="M130 78 C129 61 141 54 153 55 C165 56 172 64 172 73 L131 79 Z" fill={c} />
          <path d="M168 72 C176 71 185 72 190 75 C186 78 178 78 170 77 Z" fill={shade(c, -0.3)} />
          <circle cx="151" cy="56" r="1.8" fill={shade(c, -0.3)} />
        </g>
      );
    case "fascia":
      return <path d="M130 76 C142 71 160 70 171 73 L171 79 C160 76 142 77 131 82 Z" fill={c} />;
    case "piuma":
      return (
        <g>
          <path d="M126 78 C128 60 142 52 156 54 C166 56 172 64 174 74 C162 72 146 74 126 78 Z" fill={c} />
          <path d="M122 80 C140 74 162 72 182 76" stroke={shade(c, -0.35)} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M136 62 C126 46 114 38 100 36 C112 44 120 54 132 64 Z" fill="#f4f1ea" stroke="#c9c0ae" strokeWidth="0.6" />
        </g>
      );
    case "cappuccio": {
      // di profilo: il bordo passa sulla fronte sopra il sopracciglio, davanti all'orecchio e lungo la mascella;
      // copre capelli e orecchio, con la fodera rivoltata sul bordo
      const lining = look.special === "simone-medievale" ? "#b8892e" : shade(c, 0.22);
      const edge = "M174 79.5 C172 71 164 67.4 156.4 67.6 C149 68 144.6 75 145.4 86 C146 96 149.6 104.4 156 111";
      return (
        <g>
          <path d={`M174 79.5 C178.4 71 176 57 164 51 C151 45 131 49 124.6 66 C119 81 121 99 128 111 L134 121 L157 117 L156 111 C149.6 104.4 146 96 145.4 86 C144.6 75 149 68 156.4 67.6 C164 67.4 172 71 174 79.5 Z`} fill={shade(c, -0.06)} stroke={ink(c)} strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M131 70 Q127 88 132 108 M138 60 Q134 84 140 112" stroke={shade(c, -0.4)} strokeOpacity="0.55" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M134 56 Q150 47 166 53" stroke={shade(c, 0.28)} strokeOpacity="0.5" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d={edge} stroke={ink(lining)} strokeWidth="4.4" fill="none" strokeLinecap="round" />
          <path d={edge} stroke={lining} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d={edge} stroke="#fff" strokeOpacity="0.2" strokeWidth="0.7" fill="none" transform="translate(-0.8 -0.6)" />
        </g>
      );
    }
    case "bandana":
      return (
        <g>
          <path d="M129 82 C128 64 139 56 152 56 C165 56 173 64 172 76 C160 73 146 74 129 82 Z" fill={c} stroke="#1b130d" strokeOpacity="0.7" strokeWidth="1" />
          {[[134, 64], [146, 60], [158, 62], [164, 68]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.3" fill="#f4f1ea" opacity="0.7" />)}
          <path d="M130 80 l-10 6 l4 2 l8 -4 M130 80 l-8 12 l4 0 l6 -9" fill={shade(c, -0.15)} />
        </g>
      );
    case "robin":
      return (
        <g>
          <path d="M128 78 C134 70 160 66 176 72 C170 60 150 50 132 54 C120 56 112 50 104 46 C112 56 118 66 128 78 Z" fill={c} stroke="#1b130d" strokeOpacity="0.75" strokeWidth="1.2" />
          <path d="M128 78 C140 74 160 72 176 72" stroke={shade(c, -0.35)} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M140 64 C130 48 122 38 116 30 C126 36 134 48 144 62 Z" fill="#c4473d" stroke="#7a2a22" strokeWidth="0.6" />
        </g>
      );
    case "tesa":
      return (
        <g>
          <ellipse cx="152" cy="72" rx="34" ry="6.5" fill={shade(c, -0.15)} stroke="#1b130d" strokeOpacity="0.75" strokeWidth="1.2" />
          <path d="M132 72 C132 56 140 48 152 48 C164 48 172 56 172 72 Z" fill={c} stroke="#1b130d" strokeOpacity="0.75" strokeWidth="1.2" />
          <path d="M132 66 H172" stroke={shade(c, -0.45)} strokeWidth="3.4" />
        </g>
      );
    case "cerchietto":
      return (
        <g>
          <path d="M130 76 C142 70 160 69 172 72" stroke={c} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M168 71 l3 -4 l3 4 l-3 3 z" fill="#3fae6a" stroke={c} strokeWidth="0.8" />
        </g>
      );
    case "corona": {
      // corona d'oro a cinque punte con le perle e le gemme sulla fascia
      const yAt = (x: number) => 66 - (x - 133) * (4 / 38);
      const tips = [134, 143, 152, 161, 170];
      const hs = [9, 11.5, 14, 11.5, 9];
      const pts = tips.flatMap((x, i) => {
        const tip = `L${x} ${(yAt(x) - hs[i]).toFixed(1)}`;
        const nx = tips[i + 1];
        return nx ? [tip, `L${((x + nx) / 2).toFixed(1)} ${(yAt((x + nx) / 2) - 2.5).toFixed(1)}`] : [tip];
      });
      return (
        <g>
          <path d={`M133 ${yAt(133) + 1} ${pts.join(" ")} L171 ${yAt(171) + 1} Z`} fill={c} stroke={shade(c, -0.5)} strokeWidth="0.8" />
          <path d={`M133 ${yAt(133) + 1} ${pts.join(" ")}`} stroke={shade(c, 0.45)} strokeWidth="0.7" fill="none" opacity="0.8" />
          {tips.map((x, i) => <circle key={x} cx={x} cy={yAt(x) - hs[i]} r="1.7" fill="#fff6dc" stroke={shade(c, -0.35)} strokeWidth="0.5" />)}
          <path d="M132 66 L172 61.6 L172 69 L132 73.6 Z" fill={shade(c, -0.18)} stroke={shade(c, -0.5)} strokeWidth="0.8" />
          <path d="M132 66 L172 61.6" stroke={shade(c, 0.45)} strokeWidth="0.8" />
          <ellipse cx="152" cy="66" rx="2.6" ry="2" fill="#c41d3a" stroke="#fff0b0" strokeWidth="0.5" />
          <circle cx="141" cy="67.4" r="1.5" fill="#2063c8" />
          <circle cx="163" cy="65" r="1.5" fill="#14905c" />
        </g>
      );
    }
    case "cuffia":
      if (look.special === "simone-inverno")
        return (
          <g>
            {/* berretto di pile liscio col risvolto e la toppa del marchio */}
            <path d="M127 82 C125 60 138 50 152 50 C166 50 175 59 174 76 Z" fill={c} stroke="#1b130d" strokeOpacity="0.8" strokeWidth="1.2" />
            <path d="M136 60 C142 54 152 52 160 54" stroke={shade(c, 0.3)} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.6" />
            <path d="M126 79 C140 73 160 71 175 74 L175 82 C160 79 140 81 127 87 Z" fill={shade(c, -0.12)} stroke="#1b130d" strokeOpacity="0.7" strokeWidth="1" />
            <rect x="160" y="74.6" width="5" height="4.4" rx="0.8" fill="#1b2f4a" stroke="#0e1722" strokeWidth="0.4" />
            <path d="M161.2 75.8 l2.6 2 M163.8 75.8 l-2.6 2" stroke="#e8e8e8" strokeWidth="0.6" />
          </g>
        );
      return (
        <g>
          <path d="M127 82 C125 60 138 49 152 49 C166 49 175 59 174 76 Z" fill={c} stroke="#1b130d" strokeOpacity="0.75" strokeWidth="1.2" />
          {[134, 140, 146, 152, 158, 164, 170].map((x) => <path key={x} d={`M${x} ${x < 150 ? 58 + (150 - x) * 0.6 : 54 + (x - 150) * 0.5} L${x - 1} 76`} stroke={shade(c, -0.3)} strokeWidth="0.8" />)}
          <path d="M126 80 C140 74 160 72 175 75 L175 82 C160 79 140 81 127 87 Z" fill={shade(c, -0.18)} stroke="#1b130d" strokeOpacity="0.7" strokeWidth="1" />
          <circle cx="150" cy="46" r="6" fill={look.trim} />
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={147 + (i % 2) * 5} cy={43 + Math.floor(i / 2) * 5} r="1.3" fill={shade(look.trim, 0.3)} />)}
        </g>
      );
    case "alloro":
      return (
        <g>
          <path d="M129 76 C142 70 160 69 172 72" stroke="#5a7a2e" strokeWidth="1.4" fill="none" />
          {Array.from({ length: 9 }, (_, i) => {
            const x = 131 + i * 4.8;
            const y = 75 - Math.sin((i / 8) * Math.PI) * 4;
            return (
              <g key={i}>
                <ellipse cx={x} cy={y - 3} rx="1.7" ry="3.6" fill={i % 2 ? "#6f9a3a" : "#4f7a2a"} transform={`rotate(-30 ${x} ${y - 3})`} />
                <ellipse cx={x + 1.5} cy={y + 2.6} rx="1.6" ry="3.2" fill={i % 2 ? "#4f7a2a" : "#6f9a3a"} transform={`rotate(35 ${x + 1.5} ${y + 2.6})`} />
              </g>
            );
          })}
        </g>
      );
    case "elmo":
      return (
        <g>
          <path d="M128 84 C126 62 138 52 152 52 C166 52 176 62 175 80 L128 84 Z" fill="#9aa3ad" />
          <path d="M128 84 L175 80" stroke="#5c646d" strokeWidth="3" />
          <path d="M168 80 L170 98 L174 98 L173 80 Z" fill="#7d8690" />
          <path d="M150 52 C152 60 152 70 151 80" stroke="#c9d0d8" strokeWidth="1.2" fill="none" />
        </g>
      );
    default:
      return null;
  }
}

function Defs({ look, uid }: { look: AvatarLook; uid: string }) {
  const woodBase = look.riser && look.riser !== "#2f6fbe" ? look.riser : "#9b6334";
  return (
    <defs>
      <MetalDefs uid={uid} />
      <linearGradient id={`${uid}riser`} x1="0" x2="1">
        <stop offset="0" stopColor={shade(look.riser || "#2f6fbe", -0.45)} />
        <stop offset="0.45" stopColor={shade(look.riser || "#2f6fbe", 0.25)} />
        <stop offset="1" stopColor={shade(look.riser || "#2f6fbe", -0.55)} />
      </linearGradient>
      <linearGradient id={`${uid}wood`} x1="0" x2="1">
        <stop offset="0" stopColor={shade(woodBase, -0.5)} />
        <stop offset="0.5" stopColor={shade(woodBase, 0.15)} />
        <stop offset="1" stopColor={shade(woodBase, -0.55)} />
      </linearGradient>
      <linearGradient id={`${uid}shirt`} x1="0" x2="1">
        <stop offset="0" stopColor={shade(look.shirt, -0.32)} />
        <stop offset="0.55" stopColor={look.shirt} />
        <stop offset="1" stopColor={shade(look.shirt, 0.12)} />
      </linearGradient>
      <linearGradient id={`${uid}boot`} x1="0" x2="1">
        <stop offset="0" stopColor={shade(look.shoes, -0.35)} />
        <stop offset="0.45" stopColor={shade(look.shoes, 0.12)} />
        <stop offset="1" stopColor={shade(look.shoes, -0.25)} />
      </linearGradient>
      <linearGradient id={`${uid}pants`} x1="0" x2="1">
        <stop offset="0" stopColor={shade(look.pants, -0.3)} />
        <stop offset="1" stopColor={shade(look.pants, 0.1)} />
      </linearGradient>
      <linearGradient id={`${uid}cape`} x1="0" x2="1">
        <stop offset="0" stopColor={shade(look.capeColor, -0.45)} />
        <stop offset="1" stopColor={shade(look.capeColor, 0.05)} />
      </linearGradient>
      <radialGradient id={`${uid}face`} cx="68%" cy="40%" r="72%">
        <stop offset="0" stopColor={shade(look.skin, 0.14)} />
        <stop offset="1" stopColor={shade(look.skin, -0.18)} />
      </radialGradient>
      <linearGradient id={`${uid}hair`} x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor={shade(look.hairColor, 0.2)} />
        <stop offset="1" stopColor={shade(look.hairColor, -0.38)} />
      </linearGradient>
      <DetailDefs uid={uid} />
    </defs>
  );
}

/** fantasie del mantello che sono fantasie di stoffa */
export const CAPE_CLOTH: Record<string, string> = { righe: "righe-verticali", scacchi: "quadri", bordato: "bordure", zigzag: "zigzag", onde: "onde", diagonali: "diagonali", gigli: "gigli", foglie: "foglie", scaglie: "scaglie", fenice: "fenice" };

/** gesti da fermo: ogni quanti secondi, quanto dura, verso quale posa e quanto */
const IDLE_MOVES: Record<string, [number, number, PoseDef, number]> = {
  guarda: [7, 1.8, POSES.fiero, 0.7],
  corda: [6, 1.6, CHECK_STRING, 1],
  stretching: [8, 2, POSES.vittoria, 0.55],
  saluta: [9, 1.6, POSES.saluto, 1],
  esulta: [10, 1.4, POSES.esulta, 1],
  pensa: [11, 2.4, POSES.pensa, 0.9],
};

/** Comando esterno (gioco): quanto è tesa la corda (0–1) e alzo in gradi (positivo = più in alto). */
export type AvatarDrive = {
  pull: number;
  aim: number;
  released?: number | null;
  /** prima di tendere (0–1): prende la freccia, incocca, aggancia e va in pre-trazione; assente = già pronto */
  ready?: number | null;
};

/**
 * L'arciere. `pose` = "animata" ripete la sequenza di tiro scelta (completa, rapida o da gara, con le
 * frecce della volée); le altre sono pose ferme con respiro e battito delle palpebre. Toccandolo, in
 * una posa ferma, scocca una freccia. Con `drive` lo muove il giocatore (tendere, mirare, rilasciare).
 */
export function ArcherAvatar({ look, className = "h-72 w-auto", interactive = true, pose, onShot, hideFlight = false, still = false, drive, onPhase, wind = -1.4, light }: { look: AvatarLook; className?: string; interactive?: boolean; pose?: Pose; onShot?: () => void; hideFlight?: boolean; still?: boolean; drive?: AvatarDrive | null; onPhase?: (name: string) => void; /** vento in m/s, positivo verso dove guarda l'arciere: muove il mantello */ wind?: number; /** id di un filtro di luce ambiente (scene-2d), applicato dentro l'SVG così resta nitido */ light?: string }) {
  const uid = (useId().replace(/[^a-zA-Z0-9]/g, "") + "_");
  const mode = drive ? "guidata" : pose ?? look.pose ?? "animata";
  const plan = useMemo(() => routinePlan(look), [look.routine, look.hold, look.volley, look.quiverPlace]);
  const [tState, setT] = useState(0);
  const [tapShot, setTapShot] = useState<number | null>(null);
  const shotRef = useRef(onShot);
  shotRef.current = onShot;
  const phaseRef = useRef(onPhase);
  phaseRef.current = onPhase;
  const lastPhase = useRef("");
  const lastRelease = useRef("");
  const smoothDef = useRef<PoseDef | null>(null);
  const smoothMode = useRef<string>("");
  const smoothUntil = useRef(0);
  const host = useRef<SVGSVGElement>(null);
  const visible = useRef(true);
  // fuori dallo schermo l'arciere si ferma: meno lavoro per il telefono
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // posa ferma senza movimenti da fermo: l'arciere si disegna una volta sola, respiro e palpebre
  // sono animazioni CSS (il telefono non ridisegna di continuo tutto il corpo)
  const idleCfg = mode !== "animata" && mode !== "guidata" && (mode === "riposo" || !(mode in POSES)) && !still && look.idle && look.idle !== "respiro" && look.idle !== "fermo" ? IDLE_MOVES[look.idle] ?? null : null;
  const frozen = mode !== "animata" && mode !== "guidata" && tapShot == null;
  const t0Ref = useRef(typeof performance !== "undefined" ? performance.now() : 0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "ridotta";
    // guidata: la muove il gioco (che ridisegna a ogni suo passo), niente secondo orologio
    if (mode === "guidata") return;
    if ((reduce || still) && mode !== "animata" && tapShot == null) {
      setT(0.5);
      return;
    }
    if (reduce && mode === "animata") {
      setT(plan.releases[0] - 0.4);
      return;
    }
    // ferma e senza gesti da fare: nessun orologio
    if (frozen && !idleCfg) return;
    let raf = 0;
    let last = 0;
    const t0 = t0Ref.current;
    const step = 19;
    const frame = (now: number) => {
      const tt = (now - t0) / 1000;
      // gesti da fermo: si ridisegna solo mentre il gesto è in corso
      const inMove = !frozen || !idleCfg || tt % idleCfg[0] < idleCfg[1] + 0.08;
      if (inMove && now - last > step && !document.hidden && visible.current) {
        last = now;
        setT(tt);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mode, still, plan, frozen, idleCfg]);
  // il gioco guida l'arciere: il tempo è quello di adesso, a ogni ridisegno chiesto dal gioco
  const t = mode === "guidata" && typeof performance !== "undefined" ? (performance.now() - t0Ref.current) / 1000 : tState;
  // a riposo senza orologio le palpebre sono quelle CSS
  const cssBlink = frozen && !idleCfg && !still;

  let def: PoseDef;
  let flying: number | null = null;
  let phase = "";
  if (mode === "guidata" && drive) {
    // il giocatore tende e mira: da pre-trazione ad ancoraggio, l'arco sale o scende con l'alzo
    const k = Math.max(0, Math.min(1, drive.pull));
    const ready = drive.ready == null ? 1 : Math.max(0, Math.min(1, drive.ready));
    const lift = Math.max(-14, Math.min(18, drive.aim)) * 1.5;
    let base: PoseDef;
    let liftK = 1;
    if (ready < 1) {
      // prima di tendere: dalla posizione prende la freccia, la incocca, aggancia la corda e va in
      // pre-trazione, come nella sequenza completa (prima saltava dalla posizione alla corda in un colpo)
      const pesca = POSES[look.quiverPlace === "schiena" ? "pesca-schiena" : "pesca-fianco"];
      const r = ready;
      base =
        r < 0.3 ? { ...mix(POSES.riposo, pesca, easeIO(r / 0.3)), holding: r > 0.26 }
        : r < 0.58 ? mix(pesca, POSES.incocco, easeIO((r - 0.3) / 0.28))
        : r < 0.8 ? mix(POSES.incocco, POSES.aggancio, easeIO((r - 0.58) / 0.22))
        : mix(POSES.aggancio, POSES.predraw, easeIO((r - 0.8) / 0.2));
      // l'arco sale verso la mira solo nell'ultimo tratto, insieme alla pre-trazione
      liftK = r < 0.8 ? 0 : easeIO((r - 0.8) / 0.2);
      phase = r < 0.3 ? PHASE_NAMES["pesca-fianco"] : r < 0.58 ? PHASE_NAMES.incocco : r < 0.8 ? PHASE_NAMES.aggancio : PHASE_NAMES.predraw;
    } else {
      base = k <= 0.02 ? POSES.predraw : mix(POSES.predraw, POSES.allungo, easeIO(k));
    }
    def = { ...base, grip: p(base.grip.x, base.grip.y - lift * liftK) };
    if (drive.released != null) {
      const dt = drive.released;
      // dopo il rilascio: accompagnamento e ritorno in posizione; la freccia nuova si prende prima del tiro dopo
      def =
        dt < 0.12 ? mix(POSES.allungo, POSES.rilascio, dt / 0.12)
        : dt < 1.0 ? mix(POSES.rilascio, POSES.accompagna, Math.min(1, (dt - 0.12) / 0.6))
        : mix(POSES.accompagna, POSES.riposo, easeIO(Math.min(1, (dt - 1.0) / 0.9)));
      const fade = dt > 1.0 ? 1 - easeIO(Math.min(1, (dt - 1.0) / 0.9)) : 1;
      def = { ...def, grip: p(def.grip.x, def.grip.y - lift * fade) };
    }
    if (!phase) phase = drive.released != null ? (drive.released > 1.1 ? PHASE_NAMES.riposo : PHASE_NAMES.accompagna) : k > 0.9 ? PHASE_NAMES.mira : k > 0.05 ? PHASE_NAMES.trazione : PHASE_NAMES.predraw;
  } else if (mode === "animata") {
    const tc = t % plan.cycle;
    const at = poseAt(plan, tc);
    def = at.def;
    phase = at.phase;
    if (at.release != null && at.release < 1) flying = at.release;
    const cycleN = Math.floor(t / plan.cycle);
    plan.releases.forEach((r, i) => {
      const key = `${cycleN}-${i}`;
      if (tc >= r && tc - r < 0.3 && lastRelease.current !== key) {
        lastRelease.current = key;
        queueMicrotask(() => shotRef.current?.());
      }
    });
  } else {
    const name = mode in POSES ? mode : "riposo";
    def = POSES[name];
    // movimenti da fermo: ogni tanto controlla la corda, si sgranchisce, saluta o cambia appoggio
    if (name === "riposo" && tapShot == null && !still && look.idle && look.idle !== "respiro" && look.idle !== "fermo") {
      const c = IDLE_MOVES[look.idle];
      if (c) {
        const ph = t % c[0];
        if (ph < c[1]) def = mix(def, c[2], Math.sin((ph / c[1]) * Math.PI) * c[3]);
      }
    }
    if (tapShot != null) {
      const dt = t - tapShot;
      if (dt < 1.3) {
        def = dt < 0.25 ? mix(POSES[name], POSES.predraw, easeIO(dt / 0.25)) : dt < 0.6 ? mix(POSES.predraw, POSES.allungo, easeIO((dt - 0.25) / 0.35)) : dt < 0.72 ? mix(POSES.allungo, POSES.rilascio, (dt - 0.6) / 0.12) : mix(POSES.accompagna, POSES[name], easeIO((dt - 0.72) / 0.58));
        if (dt >= 0.6) flying = dt - 0.6;
      }
    }
  }
  // passaggi morbidi: quando il giocatore inizia a tendere, rilascia o torna a riposo
  // la posa scivola verso la nuova invece di saltare da un fotogramma all'altro
  if (mode !== smoothMode.current) {
    smoothMode.current = mode;
    smoothUntil.current = t + 0.9;
  }
  if (!still && !cssBlink && (mode === "guidata" || t < smoothUntil.current) && smoothDef.current) {
    def = smoothTo(smoothDef.current, def, mode === "guidata" ? 0.4 : 0.22);
  }
  smoothDef.current = def;
  if (phase && phase !== lastPhase.current) {
    lastPhase.current = phase;
    queueMicrotask(() => phaseRef.current?.(phase));
  }
  const blink = !cssBlink && !still && t % 3.7 < 0.12;
  const kid = look.body === "ragazzo" || look.body === "ragazza";
  const tap = () => {
    if (!interactive || mode === "animata" || mode === "guidata") return;
    setTapShot((performance.now() - t0Ref.current) / 1000);
    window.setTimeout(() => shotRef.current?.(), 600);
    // finito il tiro l'arciere torna fermo (e senza orologio)
    window.setTimeout(() => setTapShot(null), 1450);
  };
  return (
    <svg ref={host} viewBox="40 0 300 350" className={`${className}${cssBlink ? " aa-av-breathe" : ""}`} role="img" aria-label="Il tuo arciere" onClick={tap} shapeRendering="geometricPrecision" style={{ cursor: interactive && mode !== "animata" ? "pointer" : undefined, overflow: "visible" }}>
      <Defs look={look} uid={uid} />
      <defs><RimLightDefs id={`${uid}rim`} /></defs>
      <g transform={look.lefty ? "translate(380 0) scale(-1 1)" : undefined} filter={light ? `url(#${light})` : undefined}>
        <ellipse cx="150" cy="340" rx="86" ry="8.5" fill={`url(#${uid}rimg)`} />
        <ellipse cx="150" cy="339.5" rx="40" ry="3.6" fill="#000" opacity="0.26" />
        {/* luce di contorno (calda davanti, fredda dietro); nel gioco no, la figura si muove di continuo */}
        <g filter={drive ? undefined : `url(#${uid}rim)`} transform={`translate(150 342) scale(${((kid ? 0.8 : 1) * (0.9 + (tune(look.stature, 50, 0, 100) / 100) * 0.2)).toFixed(3)}) translate(-150 -342)`}>
          <Figure look={look} def={def} t={t} flying={hideFlight ? null : flying} blink={blink} uid={uid} wind={wind} cssBlink={cssBlink} />
        </g>
      </g>
    </svg>
  );
}

/** Volto di fronte (per l'intestazione, il podio e le classifiche). */
/** curva morbida che passa per tutti i punti (Catmull-Rom → Bézier) */
function smoothLoop(p: [number, number][]) {
  const n = p.length;
  const at = (i: number) => p[(i + n) % n];
  let d = `M${p[0][0].toFixed(2)} ${p[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(2)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(2)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(2)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return `${d} Z`;
}

/**
 * Contorno del volto di fronte con l'anatomia vera: tempie, zigomi (il punto più largo), angolo della
 * mascella e mento. La forma scelta (ovale, tondo, allungato, squadrato) sposta questi punti;
 * gli uomini hanno la mascella più larga, le donne il mento più fine.
 */
export function faceContour(kind: string, rx: number, ry: number, fy: number, woman: boolean, kid: boolean) {
  const S: Record<string, [number, number, number, number, number]> = {
    // tempia, zigomo, mascella, mento (frazioni di rx) e altezza dell'angolo della mascella (frazione di ry)
    ovale: [0.9, 1, 0.74, 0.3, 0.5],
    tondo: [0.93, 1.03, 0.86, 0.44, 0.46],
    allungato: [0.86, 0.95, 0.72, 0.3, 0.56],
    squadrato: [0.96, 1, 0.9, 0.52, 0.6],
  };
  const [T, C, J0, K0, jy] = S[kind] ?? S.ovale;
  const J = J0 + (woman ? -0.08 : kid ? 0.03 : 0.03);
  const K = K0 + (woman ? -0.05 : kid ? 0.04 : 0);
  const half: [number, number][] = [[0, -1], [0.58, -0.95], [T, -0.55], [C, -0.02], [J, kid ? jy - 0.06 : jy], [(J + K) / 2 + 0.04, 0.82], [K, 0.97], [0, 1]];
  const right = half.map(([x, y]) => [50 + x * rx, fy + y * ry] as [number, number]);
  const left = right.slice(1, -1).reverse().map(([x, y]) => [100 - x, y] as [number, number]);
  return smoothLoop([...right, ...left]);
}

/**
 * Pelle dipinta del volto di fronte, sopra il tono di base: piani d'ombra sfumati (orbite, incavo sotto
 * lo zigomo, lati del naso, sotto il labbro, mascella), il rosso sotto la pelle (naso, guance, mento)
 * e una grana finissima di pori. Tutto dentro il contorno.
 */
function SkinPaint({ uid, faceD, skin, rx, ry, fy, eyeY, woman, kid }: { uid: string; faceD: string; skin: string; rx: number; ry: number; fy: number; eyeY: number; woman: boolean; kid: boolean }) {
  const deep = blend(shade(skin, -0.45), "#4a1c12", 0.25);
  const red = blend(skin, "#c4473f", 0.5);
  const soft = woman || kid ? 0.7 : 1;
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id={`${uid}spc`}><path d={faceD} /></clipPath>
        <filter id={`${uid}spb`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.15" /></filter>
        <filter id={`${uid}spg`} x={50 - rx - 2} y={fy - ry - 2} width={rx * 2 + 4} height={ry * 2 + 4} filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency="2.1" numOctaves="2" seed="5" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.14  0 0 0 0 0.09  0 0 0 1.5 -0.66" />
        </filter>
      </defs>
      <g clipPath={`url(#${uid}spc)`}>
        <g filter={`url(#${uid}spb)`}>
          {/* orbite: l'angolo interno verso il naso e la piega sotto l'arcata */}
          {[-1, 1].map((sd) => <ellipse key={`oi${sd}`} cx={50 + sd * 5} cy={eyeY - 0.8} rx="2.2" ry="2.6" fill={deep} opacity={0.4 * soft} />)}
          {[-1, 1].map((sd) => <path key={`oa${sd}`} d={`M${50 + sd * 4} ${eyeY - 4.4} Q${50 + sd * 9} ${eyeY - 6.4} ${50 + sd * 14.5} ${eyeY - 3}`} stroke={deep} strokeWidth="1.6" fill="none" opacity={0.32 * soft} />)}
          {/* occhiaie leggere */}
          {[-1, 1].map((sd) => <path key={`oc${sd}`} d={`M${50 + sd * 5.5} ${eyeY + 3.2} Q${50 + sd * 9} ${eyeY + 4.8} ${50 + sd * 13} ${eyeY + 3}`} stroke={deep} strokeWidth="1.2" fill="none" opacity={0.2 * soft} />)}
          {/* incavo sotto lo zigomo, verso l'angolo della bocca */}
          {[-1, 1].map((sd) => <path key={`zi${sd}`} d={`M${50 + sd * (rx - 1.5)} ${fy + 2} Q${50 + sd * (rx - 4)} ${fy + 9} ${50 + sd * 7.5} ${fy + 13}`} stroke={deep} strokeWidth={kid ? 1.6 : 2.6} fill="none" opacity={(sd > 0 ? 0.36 : 0.26) * soft} />)}
          {/* luce sullo zigomo, sopra l'incavo */}
          {[-1, 1].map((sd) => <ellipse key={`zl${sd}`} cx={50 + sd * (rx - 6)} cy={fy - 0.5} rx="4.2" ry="1.9" fill="#fff" opacity={sd < 0 ? 0.16 : 0.07} transform={`rotate(${sd * -12} ${50 + sd * (rx - 6)} ${fy - 0.5})`} />)}
          {/* fianchi del naso, filtro e fossetta del mento */}
          <path d={`M47.4 ${eyeY + 1.5} Q46.6 ${fy + 1} 46.4 ${fy + 4.6}`} stroke={deep} strokeWidth="1.3" fill="none" opacity="0.18" />
          <path d={`M52.6 ${eyeY + 1.5} Q53.6 ${fy + 1} 53.8 ${fy + 4.6}`} stroke={deep} strokeWidth="1.5" fill="none" opacity="0.3" />
          <ellipse cx="50" cy={fy + 9.2} rx="1.3" ry="1.6" fill={deep} opacity="0.16" />
          <ellipse cx="50" cy={fy + ry - 5.4} rx="3" ry="1.4" fill="#fff" opacity="0.14" />
          {/* mascella: ombra lungo il bordo basso, più forte dal lato in ombra */}
          <path d={`M${50 - rx * 0.86} ${fy + ry * 0.45} Q${50 - rx * 0.6} ${fy + ry * 0.95} 50 ${fy + ry + 0.5} Q${50 + rx * 0.6} ${fy + ry * 0.95} ${50 + rx * 0.86} ${fy + ry * 0.45}`} stroke={deep} strokeWidth="3.2" fill="none" opacity={0.3 * soft} />
          {/* il rosso sotto la pelle: punta del naso, guance, mento, labbra */}
          <ellipse cx="50" cy={fy + 3.6} rx="2.6" ry="2" fill={red} opacity="0.22" />
          {[-1, 1].map((sd) => <ellipse key={`rg${sd}`} cx={50 + sd * (rx - 7)} cy={fy + 5} rx="5" ry="3.4" fill={red} opacity={woman ? 0.16 : 0.11} />)}
          <ellipse cx="50" cy={fy + ry - 3.6} rx="3.6" ry="2.2" fill={red} opacity="0.1" />
        </g>
        {/* pori e piccole macchie: una grana appena visibile */}
        <rect x={50 - rx - 2} y={fy - ry - 2} width={rx * 2 + 4} height={ry * 2 + 4} filter={`url(#${uid}spg)`} opacity={kid ? 0.08 : 0.13} />
      </g>
    </g>
  );
}

export function AvatarFace({ look, className = "h-10 w-10", bare = false, part }: { look: AvatarLook; className?: string; /** solo la testa, senza sfondo né spalle: per il ritratto a figura intera */ bare?: boolean; /** figura intera: "back" disegna solo capelli lunghi e cappuccio (dietro il corpo), "front" tutto il resto */ part?: "back" | "front" }) {
  const uid = (useId().replace(/[^a-zA-Z0-9]/g, "") + "_");
  const skin = look.skin;
  const skinD = shade(skin, -0.2);
  const hair = look.hairColor;
  const woman = look.body === "donna" || look.body === "ragazza";
  const kid = look.body === "ragazzo" || look.body === "ragazza";
  const bgBase = look.faceBg || look.shirt;
  const sc = sceneById(look.scene);
  const sceneTone = sc.tone;
  const sceneGround = sc.ground[0];
  const rx = look.face === "tondo" ? 21 : look.face === "allungato" ? 17.5 : 19;
  const ry = (look.face === "tondo" ? 22 : look.face === "allungato" ? 25.5 : 23.5) + (kid ? 0 : 1.2);
  const fy = kid ? 52 : 50;
  // contorno vero: tempie, zigomi (il punto più largo), angolo della mascella e mento
  const faceD = faceContour(look.face, rx, ry, fy, woman, kid);
  const e = look.expression;
  const eyeY = fy - 2;
  const lip = shade(skin, -0.5);
  const mouth =
    e === "sorriso" ? <path d={`M42 ${fy + 12} Q50 ${fy + 19} 58 ${fy + 12} Q50 ${fy + 15} 42 ${fy + 12} Z`} fill="#7a2f2a" /> :
    e === "deciso" ? <path d={`M43 ${fy + 14} Q50 ${fy + 12} 57 ${fy + 14}`} stroke={lip} strokeWidth="1.6" fill="none" strokeLinecap="round" /> :
    e === "concentrato" ? <path d={`M44 ${fy + 13.5} H56`} stroke={lip} strokeWidth="1.5" strokeLinecap="round" /> :
    <path d={`M43 ${fy + 12.5} Q50 ${fy + 16.5} 57 ${fy + 12.5}`} stroke={lip} strokeWidth="1.6" fill="none" strokeLinecap="round" />;
  const lipsF =
    look.mouth === "sottile" ? <path d={`M44 ${fy + 13.4} Q50 ${fy + 14.4} 56 ${fy + 13.4}`} stroke={lip} strokeWidth="0.9" fill="none" strokeLinecap="round" /> :
    look.mouth === "piena" ? <path d={`M43 ${fy + 13} Q46.5 ${fy + 10.6} 50 ${fy + 12} Q53.5 ${fy + 10.6} 57 ${fy + 13} Q50 ${fy + 18} 43 ${fy + 13} Z`} fill={shade(skin, -0.28)} stroke={lip} strokeWidth="0.7" /> :
    look.mouth === "ghigno" ? <path d={`M43 ${fy + 14} Q50 ${fy + 15} 57 ${fy + 11.6}`} stroke={lip} strokeWidth="1.5" fill="none" strokeLinecap="round" /> :
    look.mouth === "aperta" ? <ellipse cx="50" cy={fy + 13.8} rx="4.4" ry="2.6" fill="#5a1f1a" stroke={lip} strokeWidth="0.8" /> :
    look.mouth === "broncio" ? <path d={`M43 ${fy + 14.6} Q50 ${fy + 11.6} 57 ${fy + 14.6}`} stroke={lip} strokeWidth="1.6" fill="none" strokeLinecap="round" /> : null;
  // labbra dipinte: arco del labbro superiore più scuro, inferiore pieno con il suo riflesso,
  // rima e angoli; il sorriso mostra i denti. Le forme (sottile, piena, ghigno, aperta, broncio) e le
  // espressioni restano quelle scelte nell'editor
  const lipC = blend(skin, woman ? "#b03c47" : "#9c4a3c", woman ? 0.5 : kid ? 0.34 : 0.3);
  const realLips = (() => {
    void mouth;
    void lipsF;
    const my = fy + 13;
    const w = look.mouth === "sottile" ? 4.9 : look.mouth === "piena" ? 5.8 : woman ? 5.4 : 5.2;
    const th = look.mouth === "piena" ? 1.3 : look.mouth === "sottile" ? 0.6 : woman ? 1.1 : 0.85;
    if (e === "sorriso" && look.mouth === "aperta") {
      return (
        <g>
          <path d={`M${50 - w - 1} ${my - 1} Q50 ${my + 6.4} ${50 + w + 1} ${my - 1} Q50 ${my + 1.6} ${50 - w - 1} ${my - 1} Z`} fill="#5a1f1a" />
          <path d={`M${50 - w + 0.2} ${my - 0.4} Q50 ${my + 2.8} ${50 + w - 0.2} ${my - 0.4} Q50 ${my + 0.9} ${50 - w + 0.2} ${my - 0.4} Z`} fill="#f2ece2" />
          <path d={`M${50 - w - 1} ${my - 1} C${50 - w * 0.4} ${my - 2.6} ${50 + w * 0.4} ${my - 2.6} ${50 + w + 1} ${my - 1} C${50 + w * 0.4} ${my - 1.2} ${50 - w * 0.4} ${my - 1.2} ${50 - w - 1} ${my - 1} Z`} fill={shade(lipC, -0.15)} />
          <path d={`M${50 - w + 0.6} ${my + 3.4} Q50 ${my + 6.8} ${50 + w - 0.6} ${my + 3.4}`} stroke={lipC} strokeWidth={1.2 * th + 0.4} fill="none" strokeLinecap="round" />
          <path d={`M${50 - w - 2} ${my - 1.8} q-0.6 1.2 0.2 2.4 M${50 + w + 2} ${my - 1.8} q0.6 1.2 -0.2 2.4`} stroke={shade(skin, -0.42)} strokeWidth="0.55" fill="none" strokeLinecap="round" opacity="0.55" />
        </g>
      );
    }
    // angoli: giù col broncio, un lato su col ghigno, tesi se deciso o concentrato
    // sorriso a labbra chiuse: angoli in su e piccole pieghe sulle guance
    const smile = e === "sorriso";
    const cl = smile ? -1.1 : look.mouth === "broncio" ? 1.3 : look.mouth === "ghigno" ? 0.4 : e === "deciso" ? 0.5 : e === "concentrato" ? 0.25 : 0;
    const cr = smile ? (look.mouth === "ghigno" ? -1.8 : -1.1) : look.mouth === "broncio" ? 1.3 : look.mouth === "ghigno" ? -1.4 : e === "deciso" ? 0.5 : e === "concentrato" ? 0.25 : 0;
    const open = look.mouth === "aperta" ? 1.6 : 0;
    const L = `${50 - w} ${my + cl}`;
    const Rr = `${50 + w} ${my + cr}`;
    const upper = `M${L} C${50 - w * 0.6} ${my - 1.5 * th - 0.2} ${50 - w * 0.22} ${my - 2.5 * th - 0.2} 50 ${my - 1.5 * th} C${50 + w * 0.22} ${my - 2.5 * th - 0.2} ${50 + w * 0.6} ${my - 1.5 * th - 0.2} ${Rr} C${50 + w * 0.5} ${my + 0.5} ${50 - w * 0.5} ${my + 0.5} ${L} Z`;
    const lower = `M${L} C${50 - w * 0.5} ${my + 0.6 + open} ${50 + w * 0.5} ${my + 0.6 + open} ${Rr} C${50 + w * 0.6} ${my + 3.3 * th + open} ${50 - w * 0.6} ${my + 3.3 * th + open} ${L} Z`;
    return (
      <g>
        {open ? <ellipse cx="50" cy={my + 1} rx={w * 0.7} ry="1.4" fill="#4a1714" /> : null}
        <path d={lower} fill={lipC} />
        <path d={upper} fill={shade(lipC, -0.16)} />
        <ellipse cx="50.7" cy={my + 1.7 * th + open} rx={w * 0.34} ry="0.55" fill="#fff" opacity="0.26" />
        <path d={`M${L} C${50 - w * 0.5} ${my + 0.5} ${50 + w * 0.5} ${my + 0.5} ${Rr}`} stroke={shade(lipC, -0.58)} strokeWidth="0.6" fill="none" strokeLinecap="round" opacity="0.85" />
        {smile ? <path d={`M${50 - w - 1.2} ${my + cl - 1.4} q-0.7 1.3 0.1 2.6 M${50 + w + 1.2} ${my + cr - 1.4} q0.7 1.3 -0.1 2.6`} stroke={shade(skin, -0.42)} strokeWidth="0.5" fill="none" strokeLinecap="round" opacity="0.5" /> : null}
        <circle cx={50 - w - 0.2} cy={my + cl + 0.1} r="0.45" fill={shade(skin, -0.5)} opacity="0.45" />
        <circle cx={50 + w + 0.2} cy={my + cr + 0.1} r="0.45" fill={shade(skin, -0.5)} opacity="0.45" />
      </g>
    );
  })();
  const brow = (x: number, dir: 1 | -1) => {
    const BS = browShape(look.browShape);
    const tilt = (e === "deciso" ? 2 : e === "concentrato" ? 1 : 0) + BS.tilt;
    const inner = dir === 1 ? x + 6 : x - 6;
    const outer = dir === 1 ? x - 6 : x + 6;
    const bw = (look.brows === "folte" ? 3 : look.brows === "sottili" ? 1.2 : 2) * (0.6 + (tune(look.browSize, 50, 0, 100) / 100) * 0.8) * BS.thick;
    const bd = `M${outer} ${eyeY - 8} Q${x} ${eyeY - 11 - BS.arch} ${inner} ${eyeY - 8 + tilt}`;
    // sopracciglio affusolato: testa piena verso il naso, coda sottile verso la tempia
    const tw = bw * 0.55;
    const shape = `M${outer} ${eyeY - 8} Q${x} ${eyeY - 11 - BS.arch - tw * 0.5} ${inner} ${eyeY - 8 + tilt - bw * 0.55} L${inner + (dir === 1 ? 0.3 : -0.3)} ${eyeY - 8 + tilt + bw * 0.55} Q${x} ${eyeY - 11 - BS.arch + bw * 0.9} ${outer} ${eyeY - 8 + 0.2} Z`;
    return (
      <g key={`b${x}`}>
        {/* sopracciglio a peli: base velata e due passate di peli, scuri e del colore dei capelli */}
        <path d={shape} fill={shade(hair, -0.25)} fillOpacity="0.6" stroke={shade(hair, -0.4)} strokeOpacity="0.25" strokeWidth={Math.min(0.4, tw)} strokeLinejoin="round" />
        <BrowHairs d={bd} color={shade(hair, -0.5)} width={bw * 0.85} />
        <BrowHairs d={`M${outer} ${eyeY - 7.4} Q${x} ${eyeY - 10.4 - BS.arch} ${inner} ${eyeY - 7.4 + tilt}`} color={shade(hair, 0.05)} width={bw * 0.7} />
      </g>
    );
  };
  // occhi in proporzione reale (prima erano da fumetto): un po' più piccoli, la taglia scelta resta
  const es = (0.8 + (tune(look.eyeSize, 50, 0, 100) / 100) * 0.4) * 0.76;
  const eye = (x: number) => {
    // occhio a mandorla: angolo interno più basso, esterno leggermente sollevato, palpebra superiore piena
    const o = x < 50 ? -1 : 1;
    const up = e === "concentrato" ? 2.7 : 3.5;
    const lo = e === "concentrato" ? 1.4 : 1.9;
    const ix = x - o * 5.6, ox = x + o * 5.8;
    const iy = eyeY + 0.8, oy = eyeY - 0.5;
    const alm = `M${ix} ${iy} C${x - o * 3} ${eyeY - up} ${x + o * 2.6} ${eyeY - up - 0.2} ${ox} ${oy} C${x + o * 3} ${eyeY + lo} ${x - o * 2.4} ${eyeY + lo + 0.4} ${ix} ${iy} Z`;
    const cid = `${uid}al${x < 50 ? "l" : "r"}`;
    return (
      <g key={x} transform={`translate(${x} ${eyeY}) scale(${(es * eyeShapeK(look)[0]).toFixed(3)} ${(es * eyeShapeK(look)[1]).toFixed(3)}) translate(${-x} ${-eyeY})`}>
        <clipPath id={cid}><path d={alm} /></clipPath>
        <path d={alm} fill="#f1e9df" />
        <path d={alm} fill={`url(#${uid}scl)`} />
        <g clipPath={`url(#${cid})`}>
          <circle cx={x + 0.3} cy={eyeY + 0.1} r="3.1" fill={look.eyes} />
          <circle cx={x + 0.3} cy={eyeY + 0.1} r="3.1" fill={`url(#${uid}ir)`} />
          {/* trama dell'iride: raggi sottili e anello chiaro attorno alla pupilla */}
          <g stroke={shade(look.eyes, -0.5)} strokeWidth="0.16" opacity="0.6">
            {Array.from({ length: 14 }, (_, k) => {
              const a = (k / 14) * Math.PI * 2;
              return <path key={k} d={`M${(x + 0.3 + Math.cos(a) * 1.55).toFixed(2)} ${(eyeY + 0.1 + Math.sin(a) * 1.55).toFixed(2)} L${(x + 0.3 + Math.cos(a) * 2.9).toFixed(2)} ${(eyeY + 0.1 + Math.sin(a) * 2.9).toFixed(2)}`} />;
            })}
          </g>
          <circle cx={x + 0.3} cy={eyeY + 0.1} r="1.95" fill="none" stroke={shade(look.eyes, 0.5)} strokeWidth="0.5" opacity="0.45" />
          <circle cx={x + 0.3} cy={eyeY + 0.1} r="1.35" fill="#120c08" />
          <circle cx={x + 0.3} cy={eyeY + 0.1} r="3.1" fill="none" stroke="#120c08" strokeOpacity="0.55" strokeWidth="0.45" />
          {/* ombra della palpebra sul bulbo */}
          <path d={`M${ix - 1} ${eyeY - up - 1} H${ox + 1} V${eyeY - 1.2} Q${x} ${eyeY - 2.4} ${ix - 1} ${eyeY - 1.2} Z`} fill="#3a2418" opacity="0.3" />
        </g>
        <circle cx={x + 1.2} cy={eyeY - 0.9} r="0.62" fill="#fff" opacity="0.9" />
        {/* rima inferiore umida */}
        <path d={`M${ix + o * 1.2} ${iy + 0.5} Q${x} ${eyeY + lo + 0.8} ${ox - o * 0.8} ${oy + 0.4}`} stroke="#e0a49a" strokeWidth="0.35" opacity="0.55" fill="none" />
        <circle cx={x - 0.7} cy={eyeY + 1.1} r="0.35" fill="#fff" opacity="0.7" />
        {/* piega della palpebra e occhiaia leggera */}
        <path d={`M${ix + o * 0.6} ${eyeY - 2} C${x - o * 2.6} ${eyeY - up - 2.8} ${x + o * 2.6} ${eyeY - up - 2.8} ${ox - o * 0.2} ${oy - 1.4}`} stroke={shade(skin, -0.45)} strokeOpacity="0.55" strokeWidth="0.6" fill="none" strokeLinecap="round" />
        <path d={`M${ix + o * 1} ${iy + 1.2} Q${x} ${eyeY + lo + 2.2} ${ox - o * 1} ${oy + 1.6}`} stroke={shade(skin, -0.4)} strokeOpacity="0.35" strokeWidth="0.5" fill="none" strokeLinecap="round" />
        {/* rima ciliare superiore, più spessa verso l'esterno */}
        <path d={`M${ix} ${iy} C${x - o * 3} ${eyeY - up} ${x + o * 2.6} ${eyeY - up - 0.2} ${ox} ${oy}`} stroke="#1a110b" strokeWidth={woman ? 1.2 : 0.9} fill="none" strokeLinecap="round" />
        <path d={`M${x + o * 1.6} ${eyeY - up + 0.4} Q${x + o * 4.6} ${eyeY - up + 1.2} ${ox + o * (woman ? 0.4 : -0.2)} ${oy - (woman ? 0.3 : 0)}`} stroke="#1a110b" strokeWidth={woman ? 1 : 0.6} strokeOpacity={woman ? 1 : 0.85} fill="none" strokeLinecap="round" />
        {woman ? <path d={`M${ox} ${oy} l${o * 1.6} -1.2 M${x + o * 3.6} ${eyeY - up + 0.6} l${o * 1.1} -1.5 M${x + o * 1.4} ${eyeY - up - 0.1} l${o * 0.7} -1.4`} stroke="#22170f" strokeWidth="0.6" strokeLinecap="round" /> : <path d={`M${ox} ${oy} l${o * 1} -0.7 M${x + o * 3.4} ${eyeY - up + 0.7} l${o * 0.6} -0.9`} stroke="#22170f" strokeWidth="0.4" strokeLinecap="round" opacity="0.7" />}
        <path d={`M${ix + o * 0.4} ${iy + 0.1} C${x - o * 2.4} ${eyeY + lo + 0.4} ${x + o * 3} ${eyeY + lo} ${ox} ${oy}`} stroke="#5a3a28" strokeOpacity="0.5" strokeWidth="0.45" fill="none" />
        <circle cx={ix + o * 0.5} cy={iy} r="0.5" fill="#d98c86" opacity="0.6" />
      </g>
    );
  };
  const fillH = `url(#${uid}h)`;
  const hairBack: Partial<Record<string, ReactNode>> = {
    lunghi: <path d={`M26 ${fy - 6} C22 ${fy + 20} 24 ${fy + 40} 30 96 L70 96 C76 ${fy + 40} 78 ${fy + 20} 74 ${fy - 6} Z`} fill={fillH} />,
    caschetto: <path d={`M27 ${fy - 8} C25 ${fy + 8} 27 ${fy + 20} 32 ${fy + 24} L68 ${fy + 24} C73 ${fy + 20} 75 ${fy + 8} 73 ${fy - 8} Z`} fill={fillH} />,
    coda: <path d={`M70 ${fy - 14} C82 ${fy - 8} 84 ${fy + 12} 78 ${fy + 26} C76 ${fy + 12} 74 ${fy} 68 ${fy - 6} Z`} fill={fillH} />,
    treccia: <path d={`M68 ${fy + 2} C74 ${fy + 16} 74 ${fy + 30} 70 ${fy + 44} L64 ${fy + 42} C67 ${fy + 30} 66 ${fy + 16} 62 ${fy + 6} Z`} fill={fillH} />,
    codini: (
      <g fill={fillH}>
        <path d={`M28 ${fy - 8} C16 ${fy - 2} 14 ${fy + 16} 18 ${fy + 26} C22 ${fy + 16} 26 ${fy + 4} 32 ${fy - 2} Z`} />
        <path d={`M72 ${fy - 8} C84 ${fy - 2} 86 ${fy + 16} 82 ${fy + 26} C78 ${fy + 16} 74 ${fy + 4} 68 ${fy - 2} Z`} />
      </g>
    ),
  };
  const capOn = look.hat === "cappuccio" || look.hat === "elmo";
  hairBack["lunghi-mossi"] = <path d={`M24 ${fy - 8} C18 ${fy + 16} 28 ${fy + 30} 22 ${fy + 46} L78 ${fy + 46} C72 ${fy + 30} 82 ${fy + 16} 76 ${fy - 8} Z`} fill={fillH} />;
  hairBack.afro = <circle cx="50" cy={fy - 6} r="38" fill={fillH} />;
  hairBack.dread = (
    <g stroke={fillH} strokeWidth="4.6" strokeLinecap="round" fill="none">
      {[-1, 1].flatMap((side) => [0, 1, 2, 3].map((i) => <path key={`${side}${i}`} d={`M${50 + side * (rx - 2 + i * 2)} ${fy - ry + 6 + i * 3} C${50 + side * (rx + 4 + i * 2)} ${fy + 4} ${50 + side * (rx + 2 + i * 3)} ${fy + 22} ${50 + side * (rx + 4 + i * 2)} ${fy + 40}`} />))}
    </g>
  );
  const hairBackDreadLight = (
    <g stroke={shade(hair, 0.4)} strokeWidth="1.1" strokeLinecap="round" fill="none">
      {[-1, 1].flatMap((side) => [0, 1, 2, 3].map((i) => <path key={`${side}${i}`} d={`M${50 + side * (rx - 2 + i * 2)} ${fy - ry + 6 + i * 3} C${50 + side * (rx + 4 + i * 2)} ${fy + 4} ${50 + side * (rx + 2 + i * 3)} ${fy + 22} ${50 + side * (rx + 4 + i * 2)} ${fy + 40}`} />))}
    </g>
  );
  hairBack["coda-alta"] = <path d={`M52 ${fy - ry - 6} C70 ${fy - ry - 18} 84 ${fy - ry} 78 ${fy + 8} C74 ${fy - 6} 66 ${fy - ry - 4} 52 ${fy - ry - 2} Z`} fill={fillH} />;
  hairBack.trecce = (
    <g fill={fillH}>
      {[0, 1, 2, 3, 4].map((i) => <ellipse key={`l${i}`} cx={50 - rx - 2} cy={fy + 4 + i * 8} rx={4.6 - i * 0.3} ry="5" stroke={shade(hair, -0.4)} strokeWidth="0.6" />)}
      {[0, 1, 2, 3, 4].map((i) => <ellipse key={`r${i}`} cx={50 + rx + 2} cy={fy + 4 + i * 8} rx={4.6 - i * 0.3} ry="5" stroke={shade(hair, -0.4)} strokeWidth="0.6" />)}
    </g>
  );
  const strands = ["calvo", "rasati", "cresta", "afro", "ricci", "undercut", "vichinga", "dread"].includes(look.hair) || capOn || ["bandana", "tesa", "robin", "cuffia"].includes(look.hat) ? null : (
    <g fill="none" strokeLinecap="round">
      <path d={`M${50 - rx + 5} ${fy - ry + 4} Q50 ${fy - ry - 4} ${50 + rx - 5} ${fy - ry + 4}`} stroke={shade(hair, 0.4)} strokeOpacity="0.45" strokeWidth="0.7" />
      <path d={`M${50 - rx + 2} ${fy - 6} Q${50 - rx / 2 + 1} ${fy - ry + 3} 46 ${fy - ry + 1} M54 ${fy - ry + 1} Q${50 + rx / 2 - 1} ${fy - ry + 3} ${50 + rx - 2} ${fy - 6}`} stroke={shade(hair, -0.4)} strokeOpacity="0.45" strokeWidth="0.8" />
      {[-9, -4, 4, 9].map((dx) => <path key={dx} d={`M${50 + dx * 0.6} ${fy - ry + 1} Q${50 + dx * 1.2} ${fy - ry + 4} ${50 + dx * 1.7} ${fy - ry + 9}`} stroke={dx % 2 ? shade(hair, 0.35) : shade(hair, -0.4)} strokeOpacity="0.35" strokeWidth="0.5" />)}
    </g>
  );
  const top = (() => {
    switch (look.hair) {
      case "calvo":
        return null;
      case "rasati":
        return <path d={`M${50 - rx} ${fy - 6} C${50 - rx} ${fy - ry - 6} ${50 + rx} ${fy - ry - 6} ${50 + rx} ${fy - 6} C${50 + rx - 6} ${fy - ry + 4} ${50 - rx + 6} ${fy - ry + 4} ${50 - rx} ${fy - 6} Z`} fill={hair} opacity="0.55" />;
      case "cresta": {
        // come di profilo: lati rasati e cresta alta di ciuffi a punta, vista di fronte più stretta
        const t = fy - ry;
        return (
          <g>
            <path d={`M${50 - rx} ${fy - 6} C${50 - rx} ${t - 6} ${50 + rx} ${t - 6} ${50 + rx} ${fy - 6} C${50 + rx - 6} ${t + 4} ${50 - rx + 6} ${t + 4} ${50 - rx} ${fy - 6} Z`} fill={hair} opacity="0.35" />
            <path d={`M42.6 ${t + 6} L41.4 ${t - 10} L45.4 ${t - 4} L46.6 ${t - 20} L49.4 ${t - 7} L51.4 ${t - 22} L53.6 ${t - 7} L56.6 ${t - 18} L57 ${t - 3} L60 ${t - 11} L57.6 ${t + 6} C54 ${t + 3} 46 ${t + 3} 42.6 ${t + 6} Z`} fill={fillH} stroke="#1b130d" strokeOpacity="0.8" strokeWidth="0.8" strokeLinejoin="round" />
            <path d={`M46.6 ${t - 16} L48 ${t + 2} M51.4 ${t - 18} L50.6 ${t + 2} M56 ${t - 14} L54 ${t + 2}`} stroke={shade(hair, 0.35)} strokeOpacity="0.5" strokeWidth="0.6" fill="none" strokeLinecap="round" />
          </g>
        );
      }
      case "ricci":
        return (
          <g fill={fillH}>
            {[-16, -8, 0, 8, 16, -20, 20].map((dx, i) => <circle key={dx} cx={50 + dx} cy={fy - ry + (i > 4 ? 12 : 2) + Math.abs(dx) * 0.2} r={i > 4 ? 6.5 : 8} />)}
          </g>
        );
      case "mossi":
        return <path d={`M${50 - rx - 3} ${fy + 2} C${50 - rx - 6} ${fy - ry - 10} ${50 + rx + 6} ${fy - ry - 10} ${50 + rx + 3} ${fy + 2} C${50 + rx - 2} ${fy - 10} 60 ${fy - ry + 4} 50 ${fy - ry + 8} C42 ${fy - ry + 2} 36 ${fy - ry + 10} 34 ${fy - 4} C31 ${fy - 2} ${50 - rx} ${fy} ${50 - rx - 3} ${fy + 2} Z`} fill={fillH} />;
      case "caschetto":
        return <path d={`M${50 - rx - 4} ${fy + 8} C${50 - rx - 6} ${fy - ry - 10} ${50 + rx + 6} ${fy - ry - 10} ${50 + rx + 4} ${fy + 8} L${50 + rx} ${fy - 6} L${50 - rx} ${fy - 6} Z`} fill={fillH} />;
      case "spettinati":
        return <path d={`M${50 - rx - 2} ${fy - 2} L${50 - rx - 6} ${fy - ry - 2} L${50 - rx + 4} ${fy - ry - 4} L${42} ${fy - ry - 14} L${48} ${fy - ry - 4} L${54} ${fy - ry - 16} L${58} ${fy - ry - 4} L${50 + rx - 2} ${fy - ry - 10} L${50 + rx} ${fy - ry} L${50 + rx + 6} ${fy - ry - 2} L${50 + rx + 2} ${fy - 2} C${50 + rx - 4} ${fy - ry + 6} 40 ${fy - ry + 8} ${50 - rx - 2} ${fy - 2} Z`} fill={fillH} />;
      case "frangia":
        return <path d={`M${50 - rx - 2} ${fy} C${50 - rx - 4} ${fy - ry - 10} ${50 + rx + 4} ${fy - ry - 10} ${50 + rx + 2} ${fy} L${50 + rx - 2} ${fy - 10} L60 ${fy - 8} L55 ${fy - 12} L50 ${fy - 8} L45 ${fy - 12} L40 ${fy - 8} L${50 - rx + 2} ${fy - 10} Z`} fill={fillH} />;
      case "afro":
        return null;
      case "ciuffo":
        return <path d={`M${50 - rx - 2} ${fy - 2} C${50 - rx - 5} ${fy - ry - 20} ${50 + rx + 6} ${fy - ry - 22} ${50 + rx + 2} ${fy - 2} C${50 + rx - 2} ${fy - ry + 2} 56 ${fy - ry + 4} 48 ${fy - ry + 5} C40 ${fy - ry + 6} ${50 - rx + 2} ${fy - ry + 4} ${50 - rx - 2} ${fy - 2} Z`} fill={fillH} />;
      case "undercut":
        return (
          <g>
            <path d={`M${50 - rx} ${fy - 6} C${50 - rx} ${fy - ry - 6} ${50 + rx} ${fy - ry - 6} ${50 + rx} ${fy - 6} C${50 + rx - 6} ${fy - ry + 4} ${50 - rx + 6} ${fy - ry + 4} ${50 - rx} ${fy - 6} Z`} fill={hair} opacity="0.45" />
            <path d={`M${50 - rx + 3} ${fy - ry + 6} C${50 - rx + 2} ${fy - ry - 12} ${50 + rx - 2} ${fy - ry - 12} ${50 + rx - 3} ${fy - ry + 6} C${50 + rx - 8} ${fy - ry + 1} ${50 - rx + 8} ${fy - ry + 1} ${50 - rx + 3} ${fy - ry + 6} Z`} fill={fillH} />
          </g>
        );
      case "vichinga":
        return (
          <g>
            <path d={`M${50 - rx} ${fy - 6} C${50 - rx} ${fy - ry - 6} ${50 + rx} ${fy - ry - 6} ${50 + rx} ${fy - 6} C${50 + rx - 6} ${fy - ry + 4} ${50 - rx + 6} ${fy - ry + 4} ${50 - rx} ${fy - 6} Z`} fill={hair} opacity="0.4" />
            {[0, 1, 2, 3].map((i) => <ellipse key={i} cx="50" cy={fy - ry - 4 + i * 5} rx={5 - i * 0.6} ry="3.4" fill={fillH} stroke={shade(hair, -0.4)} strokeWidth="0.6" />)}
          </g>
        );
      case "dread":
        return (
          <g>
            <path d={`M${50 - rx - 2} ${fy - 2} C${50 - rx - 4} ${fy - ry - 10} ${50 + rx + 4} ${fy - ry - 10} ${50 + rx + 2} ${fy - 2} C${50 + rx - 2} ${fy - ry + 2} 56 ${fy - ry + 6} 48 ${fy - ry + 6} C40 ${fy - ry + 8} ${50 - rx + 2} ${fy - ry + 6} ${50 - rx - 2} ${fy - 2} Z`} fill={fillH} />
            {[-12, -4, 4, 12].map((dx) => <path key={dx} d={`M${50 + dx} ${fy - ry - 2} l${dx > 0 ? 1 : -1} 9`} stroke={shade(hair, -0.4)} strokeWidth="0.8" strokeLinecap="round" />)}
          </g>
        );
      case "coda-alta":
        return <path d={`M${50 - rx - 1} ${fy - 4} C${50 - rx - 3} ${fy - ry - 8} ${50 + rx + 3} ${fy - ry - 8} ${50 + rx + 1} ${fy - 4} C${50 + rx - 4} ${fy - ry + 2} ${50 - rx + 4} ${fy - ry + 2} ${50 - rx - 1} ${fy - 4} Z`} fill={fillH} />;
      case "raccolti":
        return (
          <g>
            <path d={`M${50 - rx - 1} ${fy - 4} C${50 - rx - 3} ${fy - ry - 8} ${50 + rx + 3} ${fy - ry - 8} ${50 + rx + 1} ${fy - 4} C${50 + rx - 4} ${fy - ry + 2} ${50 - rx + 4} ${fy - ry + 2} ${50 - rx - 1} ${fy - 4} Z`} fill={fillH} />
            <circle cx="50" cy={fy - ry - 8} r="7" fill={fillH} />
          </g>
        );
      default:
        return (
          <g>
            <path d={`M${50 - rx - 2} ${fy - 2} C${50 - rx - 4} ${fy - ry - 10} ${50 + rx + 4} ${fy - ry - 10} ${50 + rx + 2} ${fy - 2} C${50 + rx - 2} ${fy - ry + 2} 56 ${fy - ry + 6} 48 ${fy - ry + 6} C40 ${fy - ry + 8} ${50 - rx + 2} ${fy - ry + 6} ${50 - rx - 2} ${fy - 2} Z`} fill={fillH} />
            {look.hair === "chignon" ? <circle cx="50" cy={fy - ry - 6} r="8" fill={fillH} /> : null}
          </g>
        );
    }
  })();
  const beardC = look.beardColor || shade(hair, -0.08);
  const bk = 0.7 + (tune(look.beardLength, 50, 0, 100) / 100) * 0.6;
  const chin = fy + ry;
  const beardShape =
    look.beard === "piena" || look.beard === "accenno" ? <path d={`M${50 - rx + 1} ${fy + 2} C${50 - rx + 2} ${fy + ry + 8} ${50 + rx - 2} ${fy + ry + 8} ${50 + rx - 1} ${fy + 2} C${50 + rx - 6} ${fy + 12} 58 ${fy + 9} 50 ${fy + 10} C42 ${fy + 9} ${50 - rx + 6} ${fy + 12} ${50 - rx + 1} ${fy + 2} Z`} fill={beardC} opacity={look.beard === "accenno" ? 0.32 : 1} /> :
    look.beard === "lunga" ? <path d={`M${50 - rx + 1} ${fy + 2} C${50 - rx + 1} ${fy + ry + 10} 44 ${fy + ry + 22} 50 ${fy + ry + 26} C56 ${fy + ry + 22} ${50 + rx - 1} ${fy + ry + 10} ${50 + rx - 1} ${fy + 2} C${50 + rx - 6} ${fy + 12} 58 ${fy + 9} 50 ${fy + 10} C42 ${fy + 9} ${50 - rx + 6} ${fy + 12} ${50 - rx + 1} ${fy + 2} Z`} fill={beardC} /> :
    look.beard === "corta" ? <path d={`M${50 - rx + 4} ${fy + 8} C${50 - rx + 6} ${fy + ry + 4} ${50 + rx - 6} ${fy + ry + 4} ${50 + rx - 4} ${fy + 8} C${50 + rx - 8} ${fy + 14} 58 ${fy + 11} 50 ${fy + 11} C42 ${fy + 11} ${50 - rx + 8} ${fy + 14} ${50 - rx + 4} ${fy + 8} Z`} fill={beardC} /> :
    look.beard === "pizzetto" ? <path d={`M45 ${fy + 17} C46 ${fy + 25} 54 ${fy + 25} 55 ${fy + 17} C52 ${fy + 19} 48 ${fy + 19} 45 ${fy + 17} Z`} fill={beardC} /> :
    look.beard === "barbetta" ? <path d={`M${50 - rx} ${fy - 4} C${50 - rx} ${fy + 14} 42 ${chin} 50 ${chin} C58 ${chin} ${50 + rx} ${fy + 14} ${50 + rx} ${fy - 4}`} stroke={beardC} strokeWidth="3.2" fill="none" strokeLinecap="round" /> :
    look.beard === "basette" ? <g fill={beardC}><path d={`M${50 - rx - 0.5} ${fy - 10} h4 l1 ${16} h-4 Z`} /><path d={`M${50 + rx + 0.5} ${fy - 10} h-4 l-1 ${16} h4 Z`} /></g> :
    look.beard === "mosca" ? <path d={`M48.4 ${fy + 16.4} C48.6 ${fy + 19.6} 51.4 ${fy + 19.6} 51.6 ${fy + 16.4} Z`} fill={beardC} /> : null;
  // la barbetta è un tratto (non una forma piena): niente trama a riempimento, che coprirebbe tutto il viso
  const beardD = look.beard !== "accenno" && look.beard !== "barbetta" && beardShape && (beardShape as { props?: { d?: string } }).props?.d;
  const beardAll = look.beard !== "barbetta" && look.beard !== "basette" && beardShape && (beardShape as { props?: { d?: string } }).props?.d;
  // peli dipinti: tanti tratti brevi che scendono verso il mento, scuri e chiari; per l'accenno solo puntini
  // sparsi a caso ma sempre uguali (niente righe regolari)
  const hash = (n: number) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const beardHairs = beardAll
    ? Array.from({ length: look.beard === "accenno" ? 220 : 180 }, (_, i) => {
        const x = 50 - rx + hash(i) * rx * 2;
        const y = fy + hash(i + 999) * (ry + 24);
        const lean = (50 - x) * 0.06;
        const len = look.beard === "accenno" ? 0.55 : 1.4 + ((i * 7) % 5) * 0.25;
        return `M${x.toFixed(1)} ${y.toFixed(1)} l${lean.toFixed(2)} ${len.toFixed(2)}`;
      })
    : null;
  // punte sul bordo della barba: lungo la curva del mento, verso l'esterno
  const beardTufts = (() => {
    const T = (pts: [number, number][], c: [number, number], len: number) => <Tufts pts={pts} c={c} len={len * 0.8} fill={beardC} stroke={shade(beardC, -0.45)} w={0.3} />;
    if (look.beard === "piena") return T(cubicPts([50 - rx + 1, fy + 2], [50 - rx + 2, fy + ry + 8], [50 + rx - 2, fy + ry + 8], [50 + rx - 1, fy + 2], 0.12, 0.88, 12), [50, fy + 4], 2.4);
    if (look.beard === "corta") return T(cubicPts([50 - rx + 4, fy + 8], [50 - rx + 6, fy + ry + 4], [50 + rx - 6, fy + ry + 4], [50 + rx - 4, fy + 8], 0.14, 0.86, 10), [50, fy + 8], 1.7);
    if (look.beard === "lunga")
      return (
        <>
          {T(cubicPts([50 - rx + 1, fy + 2], [50 - rx + 1, fy + ry + 10], [44, fy + ry + 22], [50, fy + ry + 26], 0.3, 1, 7), [50, fy + 10], 2.8)}
          {T(cubicPts([50, fy + ry + 26], [56, fy + ry + 22], [50 + rx - 1, fy + ry + 10], [50 + rx - 1, fy + 2], 0, 0.7, 7), [50, fy + 10], 2.8)}
        </>
      );
    if (look.beard === "pizzetto") return T(cubicPts([45, fy + 17], [46, fy + 25], [54, fy + 25], [55, fy + 17], 0.15, 0.85, 5), [50, fy + 18], 1.4);
    return null;
  })();
  const beardClumps = beardAll && look.beard !== "accenno" ? (
    <Clumps id={`${uid}bcl`} clip={<path d={beardAll} />} strokes={fanStrokes(50 - rx + 3, 50 + rx - 3, fy + 9, look.beard === "lunga" ? ry + 20 : look.beard === "corta" ? ry * 0.7 : look.beard === "pizzetto" ? 8 : ry * 0.95 + 4, 50, look.beard === "pizzetto" ? 6 : 18, 3)} dark={shade(beardC, -0.5)} light={shade(beardC, 0.42)} w={0.45} />
  ) : null;
  const beard = beardShape ? (
    <g transform={look.beard === "barbetta" || look.beard === "basette" ? undefined : `translate(0 ${fy + 6}) scale(1 ${bk.toFixed(3)}) translate(0 ${-(fy + 6)})`}>
      {look.beard === "accenno" ? null : <g stroke={shade(beardC, -0.5)} strokeOpacity="0.55" strokeWidth="0.4" strokeLinejoin="round">{beardShape}</g>}
      {beardClumps}
      {beardTufts}
      {beardAll && beardHairs ? (
        <g>
          <clipPath id={`${uid}bdc`}><path d={beardAll} /></clipPath>
          {/* l'ombra della barba rasata sfuma nella pelle: niente bordo netto sulle guance */}
          <filter id={`${uid}bdf`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter>
          <mask id={`${uid}bdm`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="130"><path d={beardAll} fill="#fff" filter={`url(#${uid}bdf)`} /></mask>
          <g clipPath={look.beard === "accenno" ? `url(#${uid}fc)` : `url(#${uid}bdc)`} mask={look.beard === "accenno" ? `url(#${uid}bdm)` : undefined} fill="none" strokeLinecap="round">
            {look.beard === "accenno" ? (
              <>
                <rect x="0" y={fy} width="100" height={ry + 30} fill={`url(#${uid}stb)`} />
                <path d={beardHairs.join("")} stroke={shade(beardC, -0.25)} strokeOpacity="0.32" strokeWidth="0.2" />
              </>
            ) : (
              <>
                <rect x="0" y={fy} width="100" height={ry + 30} fill={`url(#${uid}bdg)`} />
                <path d={beardHairs.filter((_, k) => k % 3).join("")} stroke={shade(beardC, -0.45)} strokeOpacity="0.6" strokeWidth="0.32" />
                <path d={beardHairs.filter((_, k) => k % 3 === 0).join("")} stroke={shade(beardC, 0.35)} strokeOpacity="0.45" strokeWidth="0.28" />
              </>
            )}
          </g>
        </g>
      ) : null}
      {beardD ? <BeardTexture uid={uid} id="fbc" d={beardD} color={beardC} light={shade(beardC, 0.35)} dark={shade(beardC, -0.38)} box={[50 - rx - 2, fy - 2, rx * 2 + 4, ry + 30]} k={0.6} band={`M${50 - rx + 2} ${fy + 9} Q50 ${fy + 18} ${50 + rx - 2} ${fy + 9}`} /> : null}
    </g>
  ) : null;
  const st = stacheOf(look);
  const stache =
    st === "sottili" ? <path d={`M44 ${fy + 10.6} C47 ${fy + 9} 53 ${fy + 9} 56 ${fy + 10.6} C53 ${fy + 10.2} 47 ${fy + 10.2} 44 ${fy + 10.6} Z`} fill={beardC} /> :
    st === "classici" ? <path d={`M42 ${fy + 10.5} C46 ${fy + 7} 54 ${fy + 7} 58 ${fy + 10.5} C54 ${fy + 9.6} 46 ${fy + 9.6} 42 ${fy + 10.5} Z`} fill={beardC} /> :
    st === "folti" ? <path d={`M40 ${fy + 11.5} C44 ${fy + 5.6} 56 ${fy + 5.6} 60 ${fy + 11.5} C56 ${fy + 12.4} 52 ${fy + 10.6} 50 ${fy + 10.6} C48 ${fy + 10.6} 44 ${fy + 12.4} 40 ${fy + 11.5} Z`} fill={beardC} /> :
    st === "manubrio" ? <g fill="none" stroke={beardC} strokeLinecap="round"><path d={`M50 ${fy + 8.6} C46 ${fy + 8} 42 ${fy + 10} 40 ${fy + 8.6} C38.6 ${fy + 7.6} 38.8 ${fy + 5.6} 40.4 ${fy + 5.6} M50 ${fy + 8.6} C54 ${fy + 8} 58 ${fy + 10} 60 ${fy + 8.6} C61.4 ${fy + 7.6} 61.2 ${fy + 5.6} 59.6 ${fy + 5.6}`} strokeWidth="2.2" /></g> :
    st === "ferro" ? <g fill="none" stroke={beardC} strokeLinecap="round"><path d={`M43 ${fy + 9.6} Q50 ${fy + 6.4} 57 ${fy + 9.6}`} strokeWidth="2.6" /><path d={`M43 ${fy + 9.6} L42.6 ${fy + 22} M57 ${fy + 9.6} L57.4 ${fy + 22}`} strokeWidth="2.6" /></g> : null;
  const nk2 = 0.5 + (tune(look.noseSize, 50, 0, 100) / 100) * 0.64;
  const nw = (look.nose === "largo" || look.nose === "patata" ? 5.4 : look.nose === "piccolo" ? 3.2 : 4.2) * nk2;
  const ny = eyeY + 3 + 8.4 * nk2;
  const noseNode = (
    <g>
      <path d={`M51.2 ${eyeY + 2} Q${50 + nw * 0.7} ${ny - 4} ${50 + nw * 0.8} ${ny - 0.6}`} stroke={shade(skin, -0.28)} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.7" />
      {look.nose === "aquilino" ? <path d={`M50.2 ${eyeY + 4} q1.4 ${3 * nk2} 0 ${5 * nk2}`} stroke={shade(skin, -0.3)} strokeWidth="0.8" fill="none" /> : null}
      <ellipse cx="50" cy={ny - 1.2} rx={nw * (look.nose === "patata" ? 0.62 : 0.45)} ry={look.nose === "patata" ? 2.6 : 1.9} fill={shade(skin, 0.1)} />
      <ellipse cx="50.4" cy={ny - 2} rx={nw * 0.18} ry="0.8" fill="#fff" opacity="0.4" />
      <ellipse cx={50 - nw * 0.4} cy={ny + 0.5} rx={0.7 * nk2 + 0.25} ry="0.55" fill={shade(skin, -0.55)} opacity="0.5" transform={`rotate(18 ${50 - nw * 0.4} ${ny + 0.5})`} />
      <ellipse cx={50 + nw * 0.4} cy={ny + 0.5} rx={0.7 * nk2 + 0.25} ry="0.55" fill={shade(skin, -0.55)} opacity="0.5" transform={`rotate(-18 ${50 + nw * 0.4} ${ny + 0.5})`} />
      {/* ombra portata sotto la punta e ali del naso modellate */}
      <ellipse cx="50" cy={ny + 2.4} rx={nw * 0.9} ry="1.2" fill={shade(skin, -0.3)} opacity="0.28" />
      <path d={`M${50 - nw * 0.62} ${ny - 2.4} C${50 - nw * 1.12} ${ny - 1.8} ${50 - nw * 1.1} ${ny + 0.9} ${50 - nw * 0.6} ${ny + 1.1}`} stroke={shade(skin, -0.4)} strokeWidth="0.55" fill="none" strokeLinecap="round" opacity="0.5" />
      <path d={`M${50 + nw * 0.62} ${ny - 2.4} C${50 + nw * 1.12} ${ny - 1.8} ${50 + nw * 1.1} ${ny + 0.9} ${50 + nw * 0.6} ${ny + 1.1}`} stroke={shade(skin, -0.4)} strokeWidth="0.55" fill="none" strokeLinecap="round" opacity="0.5" />
      <path d={`M${50 - nw * 0.6} ${ny + 1.1} Q50 ${ny + 2} ${50 + nw * 0.6} ${ny + 1.1}`} stroke={shade(skin, -0.32)} strokeWidth="0.45" fill="none" strokeLinecap="round" opacity="0.4" />
      <path d={`M48.8 ${eyeY + 2} Q${50 - nw * 0.5} ${ny - 5} ${50 - nw * 0.62} ${ny - 2.4}`} stroke={shade(skin, -0.2)} strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.35" />
    </g>
  );
  const hv = 0.88 + (tune(look.hairVolume, 50, 0, 100) / 100) * 0.24;
  // ciocche dipinte: tante linee sottili dalla scriminatura verso tempie e fronte, scure e chiare
  const flowHair = !["calvo", "rasati", "ricci", "afro", "dread", "vichinga", "cresta"].includes(look.hair);
  const hairFlow = flowHair
    ? Array.from({ length: 56 }, (_, i) => {
        const t = (i % 28) / 27;
        const j = ((i * 37) % 11) / 11;
        const sx = 50 + (t - 0.5) * 8 + (j - 0.5) * 2;
        const ex = 50 + (t - 0.5) * (rx * 2 + 8) + (j - 0.5) * 3;
        // al centro le ciocche finiscono sull'attaccatura, ai lati scendono sulle tempie
        const ey = fy - ry + 5 + Math.abs(t - 0.5) * 2 * (ry - 6) + j * 2;
        const cxq = 50 + (t - 0.5) * (rx * 2 - 4);
        const cyq = fy - ry - 4 + j * 2;
        const lightK = i % 3 === 0;
        return <path key={i} d={`M${sx.toFixed(1)} ${(fy - ry - 6 + j * 2).toFixed(1)} Q${cxq.toFixed(1)} ${cyq.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`} stroke={lightK ? shade(hair, 0.45) : shade(hair, -0.5)} strokeOpacity={lightK ? 0.32 : 0.5} strokeWidth={i % 5 === 0 ? 0.5 : 0.28} />;
      })
    : null;
  // ---- capelli dipinti: sopra la forma piatta, dentro una maschera della stessa forma, si stendono
  // profondità (più scuro in basso), un lume morbido e la trama giusta per il tipo di capelli ----
  const hairLt = shade(hair, 0.45);
  const hairDk = shade(hair, -0.52);
  type Weave = "down" | "curl" | "stubble" | "braid" | "beard" | "stache" | "felt" | "knit" | "metal";
  const weave = (kind: Weave, box: [number, number, number, number], seed: number) => {
    const [bx, by, bw, bh] = box;
    const R = (k: number) => hash(seed * 1000 + k);
    if (kind === "curl") {
      const n = Math.round((bw * bh) / 7);
      let dk = "";
      let lt = "";
      for (let i = 0; i < n; i++) {
        const x = bx + R(i) * bw;
        const y = by + R(i + 500) * bh;
        const r = 1.1 + R(i + 900) * 1.3;
        const seg = `M${(x - r).toFixed(1)} ${y.toFixed(1)} a${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ${(r * 1.7).toFixed(2)} ${(r * 0.7).toFixed(2)}`;
        if (i % 3 === 0) lt += seg;
        else dk += seg;
      }
      return (
        <>
          <path d={dk} stroke={hairDk} strokeOpacity="0.55" strokeWidth="0.45" />
          <path d={lt} stroke={hairLt} strokeOpacity="0.45" strokeWidth="0.38" />
        </>
      );
    }
    if (kind === "felt" || kind === "knit" || kind === "metal") {
      // materiali dei copricapi: granelli del panno, file di maglia, bande di riflesso del metallo
      let dk = "";
      let lt = "";
      if (kind === "felt") {
        const n = Math.round((bw * bh) / 0.7);
        for (let i = 0; i < n; i++) {
          const seg = `M${(bx + R(i) * bw).toFixed(1)} ${(by + R(i + 500) * bh).toFixed(1)} l0.18 0.14`;
          if (i % 3 === 0) lt += seg;
          else dk += seg;
        }
      } else if (kind === "knit") {
        let row = 0;
        for (let y = by; y < by + bh; y += 1.6, row++) {
          for (let x = bx + (row % 2) * 0.9; x < bx + bw; x += 1.8) {
            const seg = `M${x.toFixed(1)} ${y.toFixed(1)} l0.7 1 l0.7 -1`;
            if (row % 3 === 0) lt += seg;
            else dk += seg;
          }
        }
      } else {
        // tre bande larghe: luce in alto, ombra al centro, riflesso in basso
        [[0.45, 0], [0.66, 1], [0.86, 0]].forEach(([k, isDark]) => {
          const y = by + bh * k;
          const seg = `M${bx.toFixed(1)} ${(y + 1.6).toFixed(1)} Q${(bx + bw / 2).toFixed(1)} ${(y - 1.6).toFixed(1)} ${(bx + bw).toFixed(1)} ${(y + 1.6).toFixed(1)}`;
          if (isDark) dk += seg;
          else lt += seg;
        });
      }
      return kind === "metal" ? (
        <>
          <path d={dk} stroke="#000" strokeOpacity="0.16" strokeWidth="2.6" />
          <path d={lt} stroke="#fff" strokeOpacity="0.26" strokeWidth="1.8" />
        </>
      ) : (
        <>
          <path d={dk} stroke="#000" strokeOpacity={kind === "knit" ? 0.35 : 0.22} strokeWidth={kind === "knit" ? 0.32 : 0.3} />
          <path d={lt} stroke="#fff" strokeOpacity={kind === "knit" ? 0.22 : 0.16} strokeWidth="0.28" />
        </>
      );
    }
    if (kind === "beard" || kind === "stache") {
      // peli corti: la barba scende verso il mento, i baffi si aprono dal centro verso gli angoli
      const n = Math.round((bw * bh) / (kind === "stache" ? 0.9 : 1.6));
      let dk = "";
      let lt = "";
      for (let i = 0; i < n; i++) {
        const x = bx + R(i) * bw;
        const y = by + R(i + 500) * bh;
        const out = x < 50 ? -1 : 1;
        const len = kind === "stache" ? 1 + R(i + 900) * 0.8 : 1.3 + R(i + 900) * 1.2;
        const seg = kind === "stache" ? `M${x.toFixed(1)} ${y.toFixed(1)} l${(out * len * 0.7).toFixed(2)} ${(len * 0.6).toFixed(2)}` : `M${x.toFixed(1)} ${y.toFixed(1)} l${((50 - x) * 0.05).toFixed(2)} ${len.toFixed(2)}`;
        if (i % 3 === 0) lt += seg;
        else dk += seg;
      }
      return (
        <>
          <path d={dk} stroke={shade(beardC, -0.5)} strokeOpacity="0.6" strokeWidth="0.32" />
          <path d={lt} stroke={shade(beardC, 0.4)} strokeOpacity="0.42" strokeWidth="0.28" />
        </>
      );
    }
    if (kind === "stubble") {
      let d = "";
      const n = Math.round((bw * bh) / 2.2);
      for (let i = 0; i < n; i++) d += `M${(bx + R(i) * bw).toFixed(1)} ${(by + R(i + 700) * bh).toFixed(1)} l0.15 0.32`;
      return <path d={d} stroke={hairDk} strokeOpacity="0.6" strokeWidth="0.42" />;
    }
    if (kind === "braid") {
      // intreccio: tratti obliqui alternati, a file
      let a = "";
      let b2 = "";
      for (let y = by; y < by + bh; y += 2.1) {
        for (let x = bx; x < bx + bw; x += 2.4) {
          const odd = Math.round((y - by) / 2.1) % 2 === 1;
          const seg = `M${x.toFixed(1)} ${y.toFixed(1)} l${odd ? 1.6 : -1.6} 1.4`;
          if (odd) a += seg;
          else b2 += seg;
        }
      }
      return (
        <>
          <path d={a} stroke={hairDk} strokeOpacity="0.55" strokeWidth="0.5" />
          <path d={b2} stroke={hairLt} strokeOpacity="0.35" strokeWidth="0.4" />
        </>
      );
    }
    // ciocche che scendono, appena ondulate
    const n = Math.round(bw * 1.3);
    let dk = "";
    let lt = "";
    for (let i = 0; i < n; i++) {
      const x = bx + R(i) * bw;
      const y0 = by + R(i + 300) * bh * 0.25;
      const len = bh * (0.45 + R(i + 600) * 0.55);
      const w1 = (R(i + 800) - 0.5) * 2.4;
      const seg = `M${x.toFixed(1)} ${y0.toFixed(1)} c${w1.toFixed(2)} ${(len / 3).toFixed(1)} ${(-w1).toFixed(2)} ${((len * 2) / 3).toFixed(1)} ${(w1 * 0.4).toFixed(2)} ${len.toFixed(1)}`;
      if (i % 3 === 0) lt += seg;
      else dk += seg;
    }
    return (
      <>
        <path d={dk} stroke={hairDk} strokeOpacity="0.5" strokeWidth="0.34" />
        <path d={lt} stroke={hairLt} strokeOpacity="0.38" strokeWidth="0.3" />
      </>
    );
  };
  const paintOver = (shape: ReactNode, id: string, kind: Weave, box: [number, number, number, number], seed: number, sheen = true) => (
    <>
      <mask id={`${uid}${id}`} maskUnits="userSpaceOnUse" x="-40" y="-80" width="180" height="240"><g filter={`url(#${uid}wh)`}>{shape}</g></mask>
      <g mask={`url(#${uid}${id})`} fill="none" strokeLinecap="round" pointerEvents="none">
        <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} fill={`url(#${uid}hdp)`} />
        {weave(kind, box, seed)}
        {sheen ? <ellipse cx={box[0] + box[2] * 0.36} cy={box[1] + box[3] * 0.2} rx={box[2] * 0.26} ry={Math.min(5, box[3] * 0.1)} fill={`url(#${uid}sl)`} opacity="0.4" /> : null}
      </g>
    </>
  );
  const backKind: Weave = look.hair === "afro" ? "curl" : look.hair === "trecce" || look.hair === "treccia" ? "braid" : "down";
  const hairDefs = (
    <>
      <filter id={`${uid}wh`} x="-20%" y="-20%" width="140%" height="140%">
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
      </filter>
      <linearGradient id={`${uid}hdp`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0" />
        <stop offset="0.55" stopColor="#000" stopOpacity="0.08" />
        <stop offset="1" stopColor="#000" stopOpacity="0.4" />
      </linearGradient>
      <radialGradient id={`${uid}sl`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
    </>
  );
  // nella figura intera il cappuccio di stoffa sta tutto davanti (capNode): dietro non serve una seconda sagoma
  const hoodNode = capOn && !(bare && look.hat === "cappuccio") ? (look.hat === "elmo" ? <MailCoif uid={uid} /> : <path d={`M14 100 C10 58 22 ${fy - ry - 14} 50 ${fy - ry - 16} C78 ${fy - ry - 14} 90 58 86 100 Z`} fill={shade(look.hatColor, -0.35)} />) : null;
  const backNode = !capOn && hairBack[look.hair] ? (
    <g transform={`translate(0 ${fy - 6}) scale(1 ${(0.5 + tune(look.hairLength, 50, 0, 100) / 100).toFixed(3)}) translate(0 ${-(fy - 6)})`}>
      {hairBack[look.hair]}
      {look.hair === "dread" ? (
        // ciocche di dread: un filo di luce lungo ognuna
        <g transform="translate(-0.5 -0.3)" opacity="0.5">{hairBackDreadLight}</g>
      ) : null}
      {paintOver(hairBack[look.hair], "hbm", backKind, [8, fy - ry - 30, 84, 120], 3)}
    </g>
  ) : null;
  if (part === "back") {
    // capelli lunghi e cappuccio stanno dietro il corpo, non sopra il petto
    return (
      <svg viewBox="0 0 100 100" className={className} overflow="visible" aria-hidden>
        <defs>
          <linearGradient id={`${uid}h`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor={shade(hair, 0.2)} />
            <stop offset="1" stopColor={shade(hair, -0.38)} />
          </linearGradient>
          {hairDefs}
        </defs>
        {hoodNode}
        {backNode}
      </svg>
    );
  }
  // copricapi: si disegnano qui una volta e si usano anche come forma per la trama del materiale e per l'ombra sulla fronte
  // cappuccio di stoffa: incornicia il viso dalla fronte (sopra le sopracciglia) al mento e copre orecchie e capelli;
  // il bordo dell'apertura è la fodera rivoltata, una fascia unica con il contorno a china
  const capNode = look.hat === "cappuccio" ? (() => {
    const hc = look.hatColor;
    const lining = look.special === "simone-medievale" ? "#b8892e" : shade(hc, 0.22);
    // apertura aperta in basso: i due lembi scendono ai lati della barba fino alle spalle
    const w = rx + 0.8;
    const T = eyeY - 13.5;
    const side = (k: number) => `M${50 - w - k} 118 L${50 - w - k} ${fy + 3} C${50 - w - k} ${T - k + (fy - T) * 0.45} ${50 - (w + k) * 0.82} ${T - k} 50 ${T - k} C${50 + (w + k) * 0.82} ${T - k} ${50 + w + k} ${T - k + (fy - T) * 0.45} ${50 + w + k} ${fy + 3} L${50 + w + k} 118`;
    // nella figura intera il cappuccio si posa sulla pellegrina (orlo morbido sotto il mento); nel ritratto scende fino in fondo
    const outer = bare
      ? `M${50 - rx - 13} ${fy + ry + 12} C${50 - rx - 17} ${fy - ry - 26} ${50 + rx + 17} ${fy - ry - 26} ${50 + rx + 13} ${fy + ry + 12} Q50 ${fy + ry + 22} ${50 - rx - 13} ${fy + ry + 12} Z`
      : `M14 101 C10 58 22 ${fy - ry - 14} 50 ${fy - ry - 16} C78 ${fy - ry - 14} 90 58 86 101 Z`;
    const rim = `M${50 - w - 1.6} ${fy + ry + 14} L${50 - w - 1.6} ${fy + 3} C${50 - w - 1.6} ${T - 1.6 + (fy - T) * 0.45} ${50 - (w + 1.6) * 0.82} ${T - 1.6} 50 ${T - 1.6} C${50 + (w + 1.6) * 0.82} ${T - 1.6} ${50 + w + 1.6} ${T - 1.6 + (fy - T) * 0.45} ${50 + w + 1.6} ${fy + 3} L${50 + w + 1.6} ${fy + ry + 14}`;
    return (
      <g>
        <clipPath id={`${uid}hoodc`}><path d={outer} /></clipPath>
        <path d={`${outer} ${side(3.2)} Z`} fill={shade(hc, -0.06)} fillRule="evenodd" clipPath={`url(#${uid}hoodc)`} />
        <path d={outer} fill="none" stroke={ink(hc)} strokeWidth="1" strokeLinejoin="round" />
        {/* pieghe della stoffa ai lati e cucitura in cima (dentro la sagoma del cappuccio) */}
        <g clipPath={`url(#${uid}hoodc)`}>
        <path d={`M${50 - w - 9} ${fy + 26} Q${50 - w - 11} ${fy} ${50 - w - 5} ${fy - ry - 6} M${50 + w + 9} ${fy + 26} Q${50 + w + 11} ${fy} ${50 + w + 5} ${fy - ry - 6} M${50 - w - 6} 100 Q${50 - w - 7} ${fy + 30} ${50 - w - 3} ${fy + ry} M${50 + w + 6} 100 Q${50 + w + 7} ${fy + 30} ${50 + w + 3} ${fy + ry}`} stroke={shade(hc, -0.4)} strokeOpacity="0.55" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d={`M50 ${fy - ry - 15} Q51.5 ${T - 8} 50 ${T - 3.4}`} stroke={shade(hc, -0.35)} strokeWidth="0.8" fill="none" strokeDasharray="1.4 1" />
        </g>
        {/* fodera rivoltata lungo tutto il bordo, fino sul petto */}
        <g clipPath={`url(#${uid}hoodc)`}>
          <path d={rim} stroke={ink(lining)} strokeWidth="4.8" fill="none" strokeLinejoin="round" />
          <path d={rim} stroke={lining} strokeWidth="3.4" fill="none" strokeLinejoin="round" />
          <path d={rim} stroke="#fff" strokeOpacity="0.2" strokeWidth="0.7" fill="none" transform="translate(-0.5 -0.6)" />
        </g>
        {/* ombra del cappuccio sulla fronte e sulle tempie */}
        <path d={`M${50 - w + 0.6} ${fy + 2} C${50 - w + 0.6} ${T + 4} ${50 + w - 0.6} ${T + 4} ${50 + w - 0.6} ${fy + 2}`} stroke="#000" strokeOpacity="0.22" strokeWidth="2.4" fill="none" />
      </g>
    );
  })() : null;
  const hatGroup = (
<g transform={turnHat(look, 50)}>
        {look.hat === "cuffia" && look.special === "simone-inverno" ? null : <FaceHat look={look} uid={uid} rx={rx} ry={ry} fy={fy} />}
        {look.hat === "cuffia" && look.special === "simone-inverno" ? (
          <g>
            <path d={`M${50 - rx - 3} ${fy - 6} C${50 - rx - 3} ${fy - ry - 16} ${50 + rx + 3} ${fy - ry - 16} ${50 + rx + 3} ${fy - 6} Z`} fill={look.hatColor} stroke="#1b130d" strokeOpacity="0.8" strokeWidth="0.9" />
            <path d={`M${50 - rx + 2} ${fy - ry - 2} Q50 ${fy - ry - 10} ${50 + rx - 4} ${fy - ry - 3}`} stroke={shade(look.hatColor, 0.3)} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.55" />
            <rect x={50 - rx - 4} y={fy - 12} width={rx * 2 + 8} height="7" rx="2.5" fill={shade(look.hatColor, -0.14)} stroke="#1b130d" strokeOpacity="0.7" strokeWidth="0.8" />
            <rect x={50 + 5} y={fy - 11.2} width="5.4" height="5" rx="0.9" fill="#1b2f4a" />
            <path d={`M${56.2} ${fy - 10} l3 2.6 M${59.2} ${fy - 10} l-3 2.6`} stroke="#e8e8e8" strokeWidth="0.6" />
          </g>
        ) : null}
        </g>
  );
  const hatMat = look.hat === "cuffia" && look.special !== "simone-inverno" ? "knit" : look.hat === "elmo" || look.hat === "corona" || look.hat === "cerchietto" ? "metal" : "felt";
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Volto dell'arciere" overflow={bare ? "visible" : undefined}>
      <defs>
        <radialGradient id={`${uid}bg`} cx="50%" cy="35%" r="75%">
          <stop offset="0" stopColor={shade(bgBase, 0.35)} />
          <stop offset="1" stopColor={shade(bgBase, -0.45)} />
        </radialGradient>
        <linearGradient id={`${uid}sc`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(sceneTone, 0.45)} />
          <stop offset="0.62" stopColor={shade(sceneTone, 0.1)} />
          <stop offset="0.63" stopColor={sceneGround} />
          <stop offset="1" stopColor={shade(sceneGround, -0.3)} />
        </linearGradient>
        {/* pelle dipinta: luce in alto a sinistra, tono pieno, ombra calda verso i bordi */}
        <radialGradient id={`${uid}f`} cx="43%" cy="36%" r="74%">
          <stop offset="0" stopColor={shade(skin, 0.16)} />
          <stop offset="0.45" stopColor={skin} />
          <stop offset="0.8" stopColor={blend(shade(skin, -0.16), "#7a3a26", 0.12)} />
          <stop offset="1" stopColor={blend(shade(skin, -0.3), "#5a2618", 0.15)} />
        </radialGradient>
        <radialGradient id={`${uid}scl`} cx="50%" cy="42%" r="62%">
          <stop offset="0.55" stopColor="#8a6a5a" stopOpacity="0" />
          <stop offset="1" stopColor="#8a6a5a" stopOpacity="0.45" />
        </radialGradient>
        {/* ombra della barba rasata: sfuma verso gli zigomi, piena su mento e mascella */}
        <linearGradient id={`${uid}stb`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={beardC} stopOpacity="0" />
          <stop offset="0.3" stopColor={blend(beardC, "#3a4a5a", 0.35)} stopOpacity="0.16" />
          <stop offset="1" stopColor={blend(beardC, "#3a4a5a", 0.35)} stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={`${uid}bdg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={`${uid}nk`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(skin, -0.48)} />
          <stop offset="0.45" stopColor={shade(skin, -0.24)} />
          <stop offset="1" stopColor={shade(skin, -0.12)} />
        </linearGradient>
        <radialGradient id={`${uid}warm`}>
          <stop offset="0" stopColor="#d4574a" stopOpacity="0.5" />
          <stop offset="1" stopColor="#d4574a" stopOpacity="0" />
        </radialGradient>
        {/* maschera "tutto bianco", profondità e lume dei capelli (anche il lume "sl" sta qui) */}
        <filter id={`${uid}wh`} x="-20%" y="-20%" width="140%" height="140%">
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
        </filter>
        <linearGradient id={`${uid}hdp`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0.08" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </linearGradient>
        {/* ombra che i capelli fanno sulla fronte */}
        <filter id={`${uid}hsh`} x="-20%" y="-20%" width="140%" height="140%">
          <feColorMatrix type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.05  0 0 0 0 0.02  0 0 0 0.5 0" />
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
        <linearGradient id={`${uid}h`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={shade(hair, 0.2)} />
          <stop offset="1" stopColor={shade(hair, -0.38)} />
        </linearGradient>
        <clipPath id={`${uid}c`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
        <clipPath id={`${uid}fc`}>
          <path d={faceD} />
        </clipPath>
        <radialGradient id={`${uid}ir`} cx="45%" cy="55%" r="55%">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.85" stopColor="#000" stopOpacity="0.15" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
        <DetailDefs uid={uid} />
        <MetalDefs uid={uid} />
        <radialGradient id={`${uid}ear`} cx="55%" cy="45%" r="65%">
          <stop offset="0" stopColor={blend(skin, "#c8564c", 0.22)} />
          <stop offset="0.6" stopColor={blend(shade(skin, -0.1), "#b5483e", 0.12)} />
          <stop offset="1" stopColor={shade(skin, -0.3)} />
        </radialGradient>
        <radialGradient id={`${uid}blf`}>
          <stop offset="0" stopColor={look.blush === "abbronzato" ? "#b8643a" : "#e0726b"} />
          <stop offset="1" stopColor={look.blush === "abbronzato" ? "#b8643a" : "#e0726b"} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath={bare ? undefined : `url(#${uid}c)`}>
        {bare ? null : look.faceBgStyle === "tinta" ? <rect width="100" height="100" fill={bgBase} /> : look.faceBgStyle === "scena" ? <rect width="100" height="100" fill={`url(#${uid}sc)`} /> : <rect width="100" height="100" fill={`url(#${uid}bg)`} />}
        {!bare && look.faceBgStyle === "bersaglio" ? (
          <g opacity="0.55">
            {["#f4f1ea", "#1d2126", "#2f7fd1", "#d63a2f", "#f2c94c"].map((c, i) => <circle key={c} cx="50" cy="50" r={50 - i * 10} fill={c} />)}
          </g>
        ) : null}
        {look.cape && !bare ? <path d="M10 100 C14 82 30 74 50 74 C70 74 86 82 90 100 Z" fill={shade(look.capeColor, -0.1)} /> : null}
        {part === "front" ? null : hoodNode}
        {part === "front" ? null : backNode}
        {bare ? null : <path d="M22 100 C24 84 36 78 50 78 C64 78 76 84 78 100 Z" fill={look.shirt} />}
        {bare ? null : <path d="M42 78 L50 88 L58 78" stroke={look.trim} strokeWidth="3" fill="none" />}
        {/* nel ritratto a figura intera il collo lo disegna il corpo, dietro la veste */}
        {bare ? null : <rect x="43" y={fy + 14} width="14" height="16" fill={`url(#${uid}nk)`} />}
        {bare ? null : <path d={`M43.4 ${fy + 14} V${fy + 30} M56.6 ${fy + 14} V${fy + 30}`} stroke={shade(skin, -0.55)} strokeOpacity="0.35" strokeWidth="0.7" />}
        {capOn ? null : look.ears === "punta" ? (
          <g fill={`url(#${uid}ear)`} stroke={shade(skin, -0.5)} strokeOpacity="0.55" strokeWidth="0.5" strokeLinejoin="round">
            <path d={`M${50 - rx + 1} ${eyeY - 1} Q${50 - rx - 5} ${eyeY - 4} ${50 - rx - 9} ${eyeY - 10} Q${50 - rx - 6} ${eyeY + 2} ${50 - rx - 3} ${eyeY + 9} Z`} />
            <path d={`M${50 + rx - 1} ${eyeY - 1} Q${50 + rx + 5} ${eyeY - 4} ${50 + rx + 9} ${eyeY - 10} Q${50 + rx + 6} ${eyeY + 2} ${50 + rx + 3} ${eyeY + 9} Z`} />
            <path d={`M${50 - rx - 2} ${eyeY + 4} Q${50 - rx - 5} ${eyeY - 2} ${50 - rx - 7} ${eyeY - 7} M${50 + rx + 2} ${eyeY + 4} Q${50 + rx + 5} ${eyeY - 2} ${50 + rx + 7} ${eyeY - 7}`} fill="none" stroke={shade(skin, -0.45)} strokeOpacity="0.6" strokeWidth="0.6" />
          </g>
        ) : (
          <g>
            {[-1, 1].map((sd) => {
              const erx = look.ears === "grandi" ? 4.6 : look.ears === "piccole" ? 2.8 : 3.5;
              const ery = look.ears === "grandi" ? 6.4 : look.ears === "piccole" ? 4 : 5;
              const cx = 50 + sd * (rx + 1);
              const cy = eyeY + 4;
              return (
                <g key={sd}>
                  {/* padiglione: più largo in alto, lobo morbido in basso */}
                  <path d={`M${cx - sd * erx * 0.6} ${cy - ery} C${cx + sd * erx * 1.1} ${cy - ery * 1.15} ${cx + sd * erx * 1.2} ${cy + ery * 0.2} ${cx + sd * erx * 0.5} ${cy + ery * 0.75} C${cx + sd * erx * 0.1} ${cy + ery * 1.05} ${cx - sd * erx * 0.5} ${cy + ery} ${cx - sd * erx * 0.6} ${cy + ery * 0.6} Z`} fill={`url(#${uid}ear)`} stroke={shade(skin, -0.5)} strokeOpacity="0.55" strokeWidth="0.5" strokeLinejoin="round" />
                  <path d={`M${cx - sd * erx * 0.1} ${cy - ery * 0.55} C${cx + sd * erx * 0.75} ${cy - ery * 0.6} ${cx + sd * erx * 0.7} ${cy + ery * 0.2} ${cx + sd * erx * 0.15} ${cy + ery * 0.45}`} stroke={shade(skin, -0.45)} strokeOpacity="0.65" strokeWidth="0.6" fill="none" strokeLinecap="round" />
                  <path d={`M${cx} ${cy - ery * 0.1} q${sd * erx * 0.3} ${ery * 0.15} 0 ${ery * 0.35}`} stroke={shade(skin, -0.5)} strokeOpacity="0.5" strokeWidth="0.5" fill="none" strokeLinecap="round" />
                </g>
              );
            })}
          </g>
        )}
        {/* orecchini: due, o uno solo dal lato scelto (il destro dell'arciere è a sinistra di chi guarda) */}
        {look.earring && !capOn ? (
          <>
            {look.earrings !== "1" || sideOf(look.earringSide, nearSide(look)) === "destra" ? <Earring kind={look.earringType} x={50 - rx - 1} y={eyeY + 10} /> : null}
            {look.earrings !== "1" || sideOf(look.earringSide, nearSide(look)) === "sinistra" ? <Earring kind={look.earringType} x={50 + rx + 1} y={eyeY + 10} /> : null}
          </>
        ) : null}
        <path d={faceD} fill={`url(#${uid}f)`} stroke={shade(skin, -0.55)} strokeOpacity="0.6" strokeWidth="0.55" />
        <SkinPaint uid={uid} faceD={faceD} skin={skin} rx={rx} ry={ry} fy={fy} eyeY={eyeY} woman={woman} kid={kid} />
        {/* volume del volto: guance e mascella in ombra ai lati, sotto il mento, fronte e zigomi in luce */}
        {/* modellato dipinto: tempie, orbite, incavo delle guance, mascella e mento in ombra;
            fronte, dorso del naso, zigomi e mento in luce; luce di contorno da sinistra */}
        <g clipPath={`url(#${uid}fc)`} pointerEvents="none">
          <ellipse cx={50 - rx + 1} cy={fy + 6} rx="6" ry={ry * 0.8} fill={`url(#${uid}sd)`} opacity="0.42" />
          <ellipse cx={50 + rx - 1} cy={fy + 6} rx="6.6" ry={ry * 0.82} fill={`url(#${uid}sd)`} opacity="0.5" />
          {/* ombra netta a cel sul lato in ombra (come nelle tavole): tempia, zigomo e mascella */}
          <path d={`M${50 + rx * 0.62} ${fy - ry - 2} C${50 + rx * 0.98} ${fy - 8} ${50 + rx * 0.82} ${fy + ry * 0.45} ${50 + rx * 0.32} ${fy + ry + 2} L${50 + rx + 6} ${fy + ry + 6} L${50 + rx + 6} ${fy - ry - 2} Z`} fill={shade(skin, -0.2)} opacity="0.34" />
          <path d={`M${50 - rx * 0.9} ${fy + ry * 0.35} C${50 - rx * 0.7} ${fy + ry * 0.85} ${50 - rx * 0.3} ${fy + ry + 1} 50 ${fy + ry + 1.5} L50 ${fy + ry + 6} L${50 - rx - 4} ${fy + ry + 6} Z`} fill={shade(skin, -0.2)} opacity="0.2" />
          {[-1, 1].map((sd) => <ellipse key={`t${sd}`} cx={50 + sd * (rx - 1.5)} cy={fy - 9} rx="5" ry="8" fill={`url(#${uid}sd)`} opacity={sd > 0 ? 0.38 : 0.28} />)}
          {[-1, 1].map((sd) => <ellipse key={`h${sd}`} cx={50 + sd * (rx - 5.5)} cy={fy + 9} rx="4.4" ry="6" fill={`url(#${uid}sd)`} opacity={(woman || kid ? 0.16 : 0.3) * (sd > 0 ? 1.2 : 0.9)} />)}
          <ellipse cx="50" cy={fy + ry + 2} rx={rx * 0.8} ry="5" fill={`url(#${uid}sd)`} opacity="0.55" />
          <ellipse cx="47" cy={fy - ry + 8} rx={rx * 0.62} ry="6" fill={`url(#${uid}sl)`} opacity="0.45" />
          <ellipse cx="38.5" cy={fy + 1.6} rx="5.2" ry="2.6" fill={`url(#${uid}sl)`} opacity="0.42" />
          <ellipse cx="61.5" cy={fy + 1.6} rx="4.8" ry="2.4" fill={`url(#${uid}sl)`} opacity="0.22" />
          {[41, 59].map((x) => <ellipse key={`o${x}`} cx={x} cy={eyeY - 1.6} rx="6.6" ry="4.2" fill={`url(#${uid}sd)`} opacity={x > 50 ? 0.4 : 0.32} />)}
          {/* luce sull'osso delle sopracciglia */}
          {[41, 59].map((x) => <ellipse key={`bb${x}`} cx={x - 0.5} cy={eyeY - 6.4} rx="5" ry="1.4" fill={`url(#${uid}sl)`} opacity={x > 50 ? 0.12 : 0.22} />)}
          {/* dorso del naso in luce, fianco destro in ombra */}
          <ellipse cx="49.1" cy={eyeY + 4.6} rx="1.1" ry="5" fill={`url(#${uid}sl)`} opacity="0.5" />
          <ellipse cx="52.8" cy={eyeY + 6} rx="2" ry="5.6" fill={`url(#${uid}sd)`} opacity="0.26" />
          <ellipse cx="50" cy={fy + 5.4} rx="2.8" ry="2.2" fill={`url(#${uid}warm)`} opacity="0.35" />
          {/* filtro (sopra il labbro) e ombra sotto il labbro inferiore */}
          <path d={`M49 ${fy + 8.4} L49.3 ${fy + 11.2} M51 ${fy + 8.4} L50.7 ${fy + 11.2}`} stroke={shade(skin, -0.32)} strokeWidth="0.5" strokeOpacity="0.3" strokeLinecap="round" />
          <ellipse cx="50" cy={fy + 17.6} rx="4.2" ry="1.3" fill={`url(#${uid}sd)`} opacity="0.32" />
          <ellipse cx="49" cy={fy + ry - 4} rx="3.8" ry="2" fill={`url(#${uid}sl)`} opacity="0.34" />
          {/* pieghe naso-labbro, più segnate con l'età */}
          <path d={`M44.2 ${fy + 7.2} C42.8 ${fy + 9.6} 42.6 ${fy + 12} 43.4 ${fy + 14.2} M55.8 ${fy + 7.2} C57.2 ${fy + 9.6} 57.4 ${fy + 12} 56.6 ${fy + 14.2}`} stroke={shade(skin, -0.42)} strokeWidth="0.6" fill="none" strokeLinecap="round" opacity={look.age === "anziano" ? 0.55 : look.age === "maturo" ? 0.4 : woman || kid ? 0.12 : 0.24} />
          <path d={`M${50 - rx + 1.4} ${fy - 12} Q${50 - rx - 0.6} ${fy + 4} ${50 - rx + 5} ${fy + ry - 5}`} stroke={shade(skin, 0.5)} strokeWidth="1" fill="none" opacity="0.28" strokeLinecap="round" />
          {/* ombra dei capelli sulla fronte e sulle tempie */}
          {!capOn && top && look.hair !== "rasati" ? (
            <g transform={`translate(0 1.5) translate(50 ${fy - ry + 4}) scale(${hv.toFixed(3)}) translate(-50 ${-(fy - ry + 4)})`} filter={`url(#${uid}hsh)`}>{top}</g>
          ) : null}
          {look.hat !== "nessuno" && look.hat !== "cappuccio" ? <g transform="translate(0 1.8)" filter={`url(#${uid}hsh)`}>{hatGroup}</g> : null}
        </g>
        {[38, 62].map((cxb) => <ellipse key={cxb} cx={cxb} cy={fy + 5.6} rx="7.4" ry="4.6" fill={`url(#${uid}blf)`} opacity={look.blush === "nessuno" ? 0 : look.blush === "rosato" ? 0.34 : look.blush === "abbronzato" ? 0.26 : 0.16} />)}
        {look.age === "maturo" || look.age === "anziano" ? (
          <g stroke={shade(skin, -0.38)} strokeWidth="0.7" fill="none" opacity={look.age === "anziano" ? 0.85 : 0.5}>
            <path d={`M42 ${eyeY - 14} q8 -1.6 16 0 M44 ${eyeY - 11.6} q6 -1 12 0`} />
            <path d={`M31 ${eyeY - 1} l-2.4 -1.4 M31 ${eyeY + 1.4} l-2.4 0.6 M69 ${eyeY - 1} l2.4 -1.4 M69 ${eyeY + 1.4} l2.4 0.6`} />
            {look.age === "anziano" ? <path d={`M43 ${fy + 6} q-2 4 -1 7 M57 ${fy + 6} q2 4 1 7`} /> : null}
          </g>
        ) : null}
        {look.mark === "neo" ? <circle cx="62" cy={fy + 4} r="0.9" fill="#3a2414" /> : null}
        {look.mark === "neo-labbro" ? <circle cx="56" cy={fy + 11} r="0.8" fill="#3a2414" /> : null}
        {look.mark === "mento" ? <path d={`M47 ${fy + ry - 4} l3 3`} stroke={shade(skin, -0.42)} strokeWidth="1" strokeLinecap="round" /> : null}
        {look.mark === "neo-fronte" ? <circle cx="55" cy={fy - 14} r="0.9" fill="#3a2414" /> : null}
        {look.mark === "guancia" ? <path d={`M35.5 ${fy + 2} l4 7`} stroke={shade(skin, -0.42)} strokeWidth="1" strokeLinecap="round" /> : null}
        {look.mark === "fossette" ? <g stroke={shade(skin, -0.38)} strokeWidth="0.8" fill="none" strokeLinecap="round"><path d={`M40.5 ${fy + 11} q-0.8 1.2 0 2.2`} /><path d={`M59.5 ${fy + 11} q0.8 1.2 0 2.2`} /></g> : null}
        {look.tattoo === "lacrima" ? <path d={`M61 ${eyeY + 5} q-1.2 2 0 3 q1.2 -1 0 -3 Z`} fill="#24324a" /> : null}
        <Marks2Front kinds={[look.mark, look.tattoo]} ey={eyeY} rx={rx} skin={skin} shade={shade} />
        {/* due pitture: quella principale sulla metà destra dell'arciere (a sinistra di chi guarda), la seconda sull'altra */}
        {look.paint2 && look.paint2 !== "nessuna" ? (
          <>
            <defs>
              <clipPath id={`${uid}pR`}><rect x="0" y="0" width="50" height="100" /></clipPath>
              <clipPath id={`${uid}pL`}><rect x="50" y="0" width="50" height="100" /></clipPath>
            </defs>
            <g clipPath={`url(#${uid}pR)`}><FacePaintFront kind={look.paint} ey={eyeY} fy={fy} rx={rx} color={paintColor(look.paint)} /></g>
            <g clipPath={`url(#${uid}pL)`}><FacePaintFront kind={look.paint2} ey={eyeY} fy={fy} rx={rx} color={paintColor(look.paint2)} /></g>
          </>
        ) : (
          <FacePaintFront kind={look.paint} ey={eyeY} fy={fy} rx={rx} color={paintColor(look.paint)} />
        )}
        {look.freckles ? <g fill={shade(skin, -0.42)} opacity="0.6">{[[36, 54], [39, 56], [42, 53], [58, 53], [61, 56], [64, 54]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y + (fy - 50)} r="0.8" />)}</g> : null}
        {eye(41)}
        {eye(59)}
        {brow(41, 1)}
        {brow(59, -1)}
        {noseNode}
        {look.mask ? null : beard}
        {look.mask ? null : <g stroke={shade(beardC, -0.5)} strokeOpacity="0.55" strokeWidth="0.4" strokeLinejoin="round">{stache}</g>}
        {look.mask || !stache ? null : paintOver(stache, "stx", "stache", [36, fy + 4, 28, 20], 21, false)}
        {look.mask || !(st === "sottili" || st === "classici" || st === "folti") ? null : (
          <Clumps id={`${uid}scl`} clip={<path d={(stache as { props: { d: string } }).props.d} />} dark={shade(beardC, -0.5)} light={shade(beardC, 0.45)} w={0.38}
            strokes={[-1, 1].flatMap((sd) => [0, 1, 2, 3, 4, 5].map((k) => `M${(50 + sd * (0.8 + k * 1.5)).toFixed(2)} ${fy + 7.6} Q${(50 + sd * (1.6 + k * 1.7)).toFixed(2)} ${fy + 9.6} ${(50 + sd * (2.2 + k * 1.75)).toFixed(2)} ${fy + 12.2}`))} />
        )}
        {look.mask || !(look.beard === "barbetta" || look.beard === "basette") || !beardShape ? null : paintOver(beardShape, "bbx", "beard", [50 - rx - 3, fy - 12, rx * 2 + 6, ry + 18], 23, false)}
        {look.mask ? null : realLips}
        {look.mark === "sopracciglio" ? <path d={`M57 ${eyeY - 10.6} l1.6 2.4`} stroke={skin} strokeWidth="1.6" /> : null}
        {look.eyepatch && look.eyepatch !== "nessuna" ? <EyepatchFront kind={look.eyepatch} ey={eyeY} rx={rx} /> : null}
        <g transform={`translate(50 ${fy - ry + 4}) scale(${hv.toFixed(3)}) translate(-50 ${-(fy - ry + 4)})`}>
          {!capOn ? <g stroke={shade(hair, -0.55)} strokeOpacity="0.6" strokeWidth="0.5" strokeLinejoin="round">{top}</g> : null}
          {!capOn && top && flowHair ? (
            <>
              <mask id={`${uid}hm`} maskUnits="userSpaceOnUse" x="-20" y="-40" width="140" height="180"><g filter={`url(#${uid}wh)`}>{top}</g></mask>
              <g mask={`url(#${uid}hm)`} fill="none" strokeLinecap="round" pointerEvents="none">
                {/* profondità in basso, riflesso lucido largo e ciocche fini dalla scriminatura verso i lati */}
                <rect x={50 - rx - 8} y={fy - ry - 14} width={rx * 2 + 16} height={ry + 14} fill={`url(#${uid}hdp)`} />
                <path d={`M${50 - rx + 2} ${fy - ry + 5} Q50 ${fy - ry - 4} ${50 + rx - 2} ${fy - ry + 5}`} stroke={shade(hair, 0.45)} strokeWidth="2.6" strokeOpacity="0.22" />
                {hairFlow}
              </g>
            </>
          ) : null}
          {!capOn && top && look.hair === "spettinati" ? paintOver(top, "hsp", "down", [50 - rx - 10, fy - ry - 18, rx * 2 + 20, ry + 18], 11, false) : null}
          {!capOn && (look.hair === "chignon" || look.hair === "raccolti") ? (() => {
            // crocchia: ciocche avvolte a spirale, luce in alto e ombra sotto
            const by = look.hair === "chignon" ? fy - ry - 6 : fy - ry - 8;
            const br = look.hair === "chignon" ? 8 : 7;
            return (
              <g pointerEvents="none" fill="none" strokeLinecap="round">
                <clipPath id={`${uid}bun`}><circle cx="50" cy={by} r={br} /></clipPath>
                <g clipPath={`url(#${uid}bun)`}>
                  <circle cx="50" cy={by + br * 0.5} r={br} fill="#000" opacity="0.22" />
                  {[0.85, 0.65, 0.45, 0.25].map((k, i) => <path key={k} d={`M${50 - br * k} ${by + 0.6} A${br * k} ${br * k * 0.8} 0 1 1 ${50 + br * k * 0.7} ${by + br * k * 0.6}`} stroke={i % 2 ? hairLt : hairDk} strokeOpacity={i % 2 ? 0.4 : 0.55} strokeWidth="0.5" />)}
                  <ellipse cx={50 - br * 0.3} cy={by - br * 0.45} rx={br * 0.45} ry={br * 0.22} fill={`url(#${uid}sl)`} opacity="0.55" />
                </g>
              </g>
            );
          })() : null}
          {!capOn && top && (look.hair === "ricci" || look.hair === "rasati" || look.hair === "cresta" || look.hair === "vichinga") ? paintOver(top, "htx", look.hair === "ricci" ? "curl" : look.hair === "vichinga" ? "braid" : "stubble", [50 - rx - 10, fy - ry - 26, rx * 2 + 20, ry + 26], 7, look.hair === "ricci") : null}
          {flowHair ? null : strands}
        </g>
        {look.hairFeather && !capOn ? <g transform={sideOf(look.featherSide, "sinistra") === "sinistra" ? `translate(${50 + rx + 2} ${fy - 4}) rotate(18)` : `translate(${50 - rx - 2} ${fy - 4}) scale(-1 1) rotate(18)`}><path d="M0 0 C3 -5 4 -14 1 -22 C-2 -15 -3 -6 0 0 Z" fill="#f4f1ea" stroke="#b9ae98" strokeWidth="0.5" /><path d="M1 -22 l1 -3" stroke="#c4473d" strokeWidth="1.4" strokeLinecap="round" /></g> : null}
        {capNode}
        {capNode ? paintOver(capNode, "capx", "felt", [8, fy - ry - 32, 84, 104 - (fy - ry - 32)], 31) : null}
        {hatGroup}
        {look.hat !== "nessuno" && look.hat !== "cappuccio" ? paintOver(hatGroup, "hatx", hatMat, [4, fy - ry - 42, 92, ry + 38], 33) : null}
        {look.warpaint ? <g>{[0, 5].map((d) => <g key={d}><PaintStroke a={[41, fy + 3.5 + d]} b={[32.5, fy + 1.5 + d]} bend={0.8} w={2.3 - d * 0.05} color="#2a3a5a" /><PaintStroke a={[59, fy + 3.5 + d]} b={[67.5, fy + 1.5 + d]} bend={-0.8} w={2.3 - d * 0.05} color="#2a3a5a" /></g>)}</g> : null}
        {look.scar ? <path d={`M56 ${eyeY - 12} L62 ${eyeY + 10} M57 ${eyeY - 6} l3 -1 M59 ${eyeY + 3} l3 -1`} stroke={shade(skin, -0.42)} strokeWidth="1.2" strokeLinecap="round" /> : null}
        {look.mask ? <path d={`M${50 - rx} ${fy + 3} Q50 ${fy} ${50 + rx} ${fy + 3} C${50 + rx} ${fy + ry} ${50 - rx} ${fy + ry} ${50 - rx} ${fy + 3} Z`} fill={look.cowlColor} /> : null}
        {look.cowl && !bare ? <path d={`M18 100 C18 84 28 ${fy + 22} 50 ${fy + 24} C72 ${fy + 22} 82 84 82 100 Z`} fill={look.cowlColor} stroke={shade(look.cowlColor, -0.35)} strokeWidth="1" /> : null}
        {look.fur && !bare ? <g fill={look.furColor}>{[14, 24, 34, 66, 76, 86].map((x, i) => <circle key={x} cx={x} cy={90 + (i % 2) * 3} r="8" />)}</g> : null}
        {look.sunglasses ? (
          <g>
            <path d={`M48 ${eyeY - 2.8} Q50 ${eyeY - 4} 52 ${eyeY - 2.8} M33 ${eyeY - 3.2} H${50 - rx - 1} M67 ${eyeY - 3.2} H${50 + rx + 1}`} stroke="#0e1114" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d={`M33 ${eyeY - 4} H48 C48 ${eyeY + 4} 45 ${eyeY + 6} 40.5 ${eyeY + 6} C36 ${eyeY + 6} 33 ${eyeY + 4} 33 ${eyeY - 4} Z M52 ${eyeY - 4} H67 C67 ${eyeY + 4} 64 ${eyeY + 6} 59.5 ${eyeY + 6} C55 ${eyeY + 6} 52 ${eyeY + 4} 52 ${eyeY - 4} Z`} fill={`url(#${uid}lens)`} stroke="#07090b" strokeWidth="0.9" strokeLinejoin="round" />
            <path d={`M34.6 ${eyeY - 2.6} l5.2 0 M35.2 ${eyeY + 1.2} l2.4 -3.2 M53.6 ${eyeY - 2.6} l5.2 0 M54.2 ${eyeY + 1.2} l2.4 -3.2`} stroke="#fff" strokeOpacity="0.5" strokeWidth="0.8" strokeLinecap="round" />
            <path d={`M33.4 ${eyeY - 3.6} H47.6 M52.4 ${eyeY - 3.6} H66.6`} stroke="#5a6672" strokeWidth="0.5" />
          </g>
        ) : null}
        {look.glasses && !look.sunglasses ? (
          <g>
            <path d={`M47.6 ${eyeY - 0.6} Q50 ${eyeY - 2} 52.4 ${eyeY - 0.6} M34.4 ${eyeY - 1.4} L${50 - rx - 1} ${eyeY - 2.4} M65.6 ${eyeY - 1.4} L${50 + rx + 1} ${eyeY - 2.4}`} stroke="#1d2126" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            {[41, 59].map((gx) => (
              <g key={gx}>
                <circle cx={gx} cy={eyeY} r="6.6" fill={`url(#${uid}glass)`} stroke="#0f1215" strokeWidth="1.5" />
                <circle cx={gx} cy={eyeY} r="6.6" fill="none" stroke="#6a737c" strokeWidth="0.45" strokeDasharray="5 9" />
                <path d={`M${gx - 4.2} ${eyeY - 2.4} q1.6 -2.4 4 -2.8`} stroke="#fff" strokeOpacity="0.55" strokeWidth="0.7" fill="none" strokeLinecap="round" />
              </g>
            ))}
          </g>
        ) : null}
        {look.necklace && !bare ? (
          <g>
            <path d="M40 84 Q50 94 60 84" stroke="#5a3e10" strokeWidth="1.9" fill="none" />
            <path d="M40 84 Q50 94 60 84" stroke={`url(#${uid}mtoro)`} strokeWidth="1.2" fill="none" strokeDasharray="1.3 0.5" />
          </g>
        ) : null}
        {look.amulet && !bare ? (
          <g>
            <path d="M41 82 Q50 96 59 82" stroke="#3a2a12" strokeWidth="1.3" fill="none" />
            <path d="M41 82 Q50 96 59 82" stroke="#c9a46a" strokeWidth="0.7" fill="none" strokeDasharray="1.1 0.5" />
            <path d="M50 90.4 l3.8 4.9 l-3.8 4.9 l-3.8 -4.9 Z" fill={`url(#${uid}mtoro)`} stroke="#5a3e10" strokeWidth="0.7" strokeLinejoin="round" />
            <circle cx="50" cy="95.3" r="1.5" fill="#2f9e7a" stroke="#0f3a2a" strokeWidth="0.4" />
            <circle cx="49.5" cy="94.8" r="0.45" fill="#fff" opacity="0.8" />
          </g>
        ) : null}
        {look.pendant && look.pendant !== "nessuno" && !bare ? <Pendant kind={look.pendant} x={50} y={look.amulet ? 87 : 89} w={9} y0={81} s={0.72} /> : null}
        {look.emblem && look.emblem !== "nessuno" && !bare ? <ChestEmblem kind={look.emblem} crest={look.crest} x={62} y={93} s={0.42} base={look.shirt} trim={look.trim} /> : null}
        {look.hairAcc && look.hairAcc !== "nessuno" && !capOn && look.hair !== "calvo" ? <HairOrnament kind={look.hairAcc} x={50 - rx + 3} y={fy - ry + 10} tilt={-24} s={0.9} color={look.hatColor} /> : null}
      </g>
      {bare ? null : <FaceFrame kind={look.frame} />}
    </svg>
  );
}
