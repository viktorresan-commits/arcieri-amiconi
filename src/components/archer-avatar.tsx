import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { tune, type AvatarLook, type Pose } from "@/lib/arcieri/avatar";
import { sceneById } from "@/lib/arcieri/scenes";

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
  bend?: 1 | -1;
};

const ANCHOR = p(166, 106);
const POSES: Record<string, PoseDef> = {
  riposo: { grip: p(194, 210), bowAngle: 6, hand: p(108, 204), pull: 0, hooked: false, arrow: false, fore: 44, bend: 1 },
  // incocco: arco basso e quasi orizzontale, la mano porta la freccia sul rest e la incastra
  incocco: { grip: p(206, 192), bowAngle: -66, hand: p(192, 184), pull: 0, hooked: false, arrow: true, fore: 48 },
  // aggancio e presa: tre dita sulla corda, mano dell'arco rilassata sull'impugnatura
  aggancio: { grip: p(214, 172), bowAngle: -40, hand: null, pull: 0, hooked: true, arrow: true, fore: 52 },
  predraw: { grip: p(244, 132), bowAngle: -3, hand: null, pull: 0.1, hooked: true, arrow: true, fore: 64, face: "concentrato" },
  trazione: { grip: p(249, 125), bowAngle: 0, hand: null, pull: 0.62, hooked: true, arrow: true, fore: 74, face: "concentrato" },
  allungo: { grip: p(250, 124), bowAngle: 0, hand: null, pull: 1, hooked: true, arrow: true, fore: 82, face: "concentrato" },
  mira: { grip: p(250, 124), bowAngle: 0, hand: null, pull: 1.03, hooked: true, arrow: true, fore: 83, face: "concentrato" },
  rilascio: { grip: p(250, 124), bowAngle: 2, hand: p(132, 104), pull: 0, hooked: false, arrow: false, fore: 82, face: "concentrato" },
  accompagna: { grip: p(251, 127), bowAngle: 9, hand: p(126, 106), pull: 0, hooked: false, arrow: false, fore: 80 },
  rilassa: { grip: p(214, 186), bowAngle: 22, hand: p(114, 198), pull: 0, hooked: false, arrow: false, fore: 46, bend: 1 },
  vittoria: { grip: p(206, 34), bowAngle: -12, hand: p(100, 56), pull: 0, hooked: false, arrow: false, fore: 44, face: "felice", bend: 1 },
  // fiero: mano sul fianco, gomito in fuori
  fiero: { grip: p(194, 206), bowAngle: 2, hand: p(122, 190), pull: 0, hooked: false, arrow: false, fore: 40, face: "sorriso", bend: 1 },
  // saluto: la mano libera si alza aperta accanto alla testa
  saluto: { grip: p(194, 208), bowAngle: 4, hand: p(92, 60), pull: 0, hooked: false, arrow: false, fore: 40, face: "sorriso", bend: 1 },
};

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
};

type Step = [string, number];
type Plan = { steps: Step[]; cycle: number; releases: number[] };

/**
 * Sequenza di tiro dell'avatar: completa (11 tempi), rapida o da gara (mira lunga), con le frecce
 * della volée in fila e il rilassamento alla fine.
 */
export function routinePlan(look: Pick<AvatarLook, "routine" | "hold" | "volley">): Plan {
  const hold = Math.max(0.6, Math.min(6, Number(look.hold) || 2));
  const n = Math.max(1, Math.min(6, Number(look.volley) || 1));
  const kind = look.routine ?? "completa";
  const one: Step[] =
    kind === "rapida"
      ? [["aggancio", 0.5], ["predraw", 0.45], ["allungo", 0.75], ["mira", hold * 0.6], ["rilascio", 0.12], ["accompagna", 0.7]]
      : [["incocco", 0.9], ["aggancio", 0.7], ["predraw", 0.8], ["trazione", 0.7], ["allungo", 0.5], ["mira", kind === "gara" ? hold + 1.2 : hold], ["rilascio", 0.12], ["accompagna", kind === "gara" ? 1.4 : 1.1]];
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

function mix(a: PoseDef, b: PoseDef, t: number): PoseDef {
  return {
    grip: lerpP(a.grip, b.grip, t),
    bowAngle: lerp(a.bowAngle, b.bowAngle, t),
    hand: a.hand && b.hand ? lerpP(a.hand, b.hand, t) : (a.hand ?? b.hand),
    pull: lerp(a.pull, b.pull, t),
    hooked: t < 0.5 ? a.hooked : b.hooked,
    hookW: lerp(a.hookW ?? (a.hooked ? 1 : 0), b.hookW ?? (b.hooked ? 1 : 0), t),
    arrow: t < 0.5 ? a.arrow : b.arrow,
    fore: lerp(a.fore, b.fore, t),
    face: t < 0.5 ? a.face : b.face,
    bend: t < 0.5 ? a.bend : b.bend,
  };
}

/** Due ossa: dalla spalla verso la mano, con il gomito dalla parte giusta. */
function ik(s: P, target: P, l1: number, l2: number, bend: 1 | -1) {
  const dx = target.x - s.x;
  const dy = target.y - s.y;
  const d = Math.max(1, Math.min(l1 + l2 - 0.01, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const e = p(s.x + Math.cos(base + bend * a) * l1, s.y + Math.sin(base + bend * a) * l1);
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
function Figure({ look, def, t, flying, blink, uid }: { look: AvatarLook; def: PoseDef; t: number; flying: number | null; blink: boolean; uid: string }) {
  const woman = look.body === "donna" || look.body === "ragazza";
  const kid = look.body === "ragazzo" || look.body === "ragazza";
  const W = look.build === "robusto" ? 1.14 : look.build === "snello" ? 0.9 : 1;
  const skin = look.skin;
  const skinD = shade(skin, -0.2);
  const breath = Math.sin(t * 1.7) * 0.9;
  const longSleeves = ["felpa", "giacca", "camicia", "tunica", "tunica-lunga", "farsetto", "ranger", "incrociata", "cappotto", "giubba", "cappotto-lungo", "cotta"].includes(look.top);
  const medievalTop = ["tunica", "tunica-lunga", "farsetto", "ranger", "incrociata", "cappotto", "giubba", "cappotto-lungo", "cotta"].includes(look.top);
  const shirt = look.shirt;
  const capeSway = Math.sin(t * 1.3) * 2.5;

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
  const TUNIC: Record<string, number> = { tunica: 252, "tunica-lunga": 266, ranger: 262, incrociata: 250, cappotto: 258, "cappotto-lungo": 292, giubba: 230, cotta: 240 };
  // la barra "lunghezza" allunga o accorcia la veste; anche una maglia può scendere sui fianchi
  const stretch = (tune(look.topLength, 50, 0, 100) - 50) * 1.3;
  const tunicLen = Math.round(Math.max(206, Math.min(312, (TUNIC[look.top] ?? 200) + stretch)));
  const longTunic = tunicLen > 216;

  // gambe
  const kneeB = 2 + Math.sin(t * 1.7) * 0.6;
  const legs = {
    back: { hip: p(cx - 12 * W, 208), knee: p(cx - 18 * W, 270 - kneeB), ankle: p(cx - 24, 328) },
    front: { hip: p(cx + 12 * W, 208), knee: p(cx + 19 * W, 270 - kneeB), ankle: p(cx + 26, 328) },
  };
  const legW = 19 * W;

  // contorno scuro e lume chiaro: il tratto da illustrazione dei giochi
  const OUT = "#1b130d";
  const limb = (a: P, b: P, w: number, color: string, outline = true) => (
    <g>
      {outline ? <line x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} stroke={OUT} strokeOpacity="0.55" strokeWidth={w + 2.6} strokeLinecap="round" /> : null}
      <line x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} stroke={color} strokeWidth={w} strokeLinecap="round" />
      {outline && w > 8 ? <line x1={f(a.x - w * 0.18)} y1={f(a.y - w * 0.1)} x2={f(b.x - w * 0.18)} y2={f(b.y - w * 0.1)} stroke="#fff" strokeOpacity="0.13" strokeWidth={w * 0.28} strokeLinecap="round" /> : null}
    </g>
  );

  const shoe = (ankle: P) => {
    const sc = look.shoes;
    if (look.footwear === "scarponi") {
      return (
        <g>
          <path d={`M${f(ankle.x - 11)} ${f(ankle.y - 24)} L${f(ankle.x + 10)} ${f(ankle.y - 24)} L${f(ankle.x + 10)} ${f(ankle.y - 2)} C${f(ankle.x + 16)} ${f(ankle.y)} ${f(ankle.x + 24)} ${f(ankle.y + 2)} ${f(ankle.x + 25)} ${f(ankle.y + 8)} L${f(ankle.x - 12)} ${f(ankle.y + 8)} Z`} fill={`url(#${uid}boot)`} stroke={OUT} strokeOpacity="0.55" strokeWidth="1.5" />
          <path d={`M${f(ankle.x - 13)} ${f(ankle.y + 7)} h39 v5 h-39 z`} fill="#2a2622" />
          {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${f(ankle.x - 11 + i * 6.4)} ${f(ankle.y + 12)} v-3`} stroke="#14110e" strokeWidth="2" />)}
          {[0, 1, 2, 3].map((i) => <path key={`l${i}`} d={`M${f(ankle.x + 2)} ${f(ankle.y - 20 + i * 5)} l6 2`} stroke="#e8d9b0" strokeWidth="1.1" />)}
          <path d={`M${f(ankle.x - 12)} ${f(ankle.y - 25)} h23 v4 h-23 z`} fill={shade(sc, -0.3)} />
        </g>
      );
    }
    if (look.footwear === "mocassini") {
      return (
        <g>
          <path d={`M${f(ankle.x - 9)} ${f(ankle.y - 8)} C${f(ankle.x + 4)} ${f(ankle.y - 10)} ${f(ankle.x + 18)} ${f(ankle.y - 1)} ${f(ankle.x + 22)} ${f(ankle.y + 6)} C${f(ankle.x + 20)} ${f(ankle.y + 10)} ${f(ankle.x - 8)} ${f(ankle.y + 10)} ${f(ankle.x - 11)} ${f(ankle.y + 7)} Z`} fill={`url(#${uid}boot)`} stroke={OUT} strokeOpacity="0.5" strokeWidth="1.3" />
          <path d={`M${f(ankle.x + 4)} ${f(ankle.y - 3)} q5 -2 10 4`} stroke={shade(sc, 0.35)} strokeWidth="0.9" fill="none" strokeDasharray="1.6 1.4" />
          <path d={`M${f(ankle.x - 8)} ${f(ankle.y - 18)} L${f(ankle.x + 6)} ${f(ankle.y - 8)} M${f(ankle.x + 6)} ${f(ankle.y - 18)} L${f(ankle.x - 8)} ${f(ankle.y - 8)}`} stroke={shade(sc, -0.2)} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    }
    if (look.footwear === "stivali" || look.footwear === "stivali-risvolto" || look.footwear === "stivali-alti" || look.footwear === "stivali-pelliccia") {
      const top = look.footwear === "stivali-risvolto" ? 54 : look.footwear === "stivali-alti" ? 64 : look.footwear === "stivali-pelliccia" ? 50 : 46;
      return (
        <g>
          <path d={`M${f(ankle.x - 10)} ${f(ankle.y - top)} L${f(ankle.x + 10)} ${f(ankle.y - top)} L${f(ankle.x + 9)} ${f(ankle.y + 2)} C${f(ankle.x + 14)} ${f(ankle.y + 4)} ${f(ankle.x + 22)} ${f(ankle.y + 5)} ${f(ankle.x + 23)} ${f(ankle.y + 10)} L${f(ankle.x - 11)} ${f(ankle.y + 10)} Z`} fill={`url(#${uid}boot)`} stroke={OUT} strokeOpacity="0.55" strokeWidth="1.6" />
          <path d={`M${f(ankle.x - 6)} ${f(ankle.y - top + 8)} L${f(ankle.x - 5)} ${f(ankle.y - 4)}`} stroke="#fff" strokeOpacity="0.18" strokeWidth="2.4" strokeLinecap="round" />
          <path d={`M${f(ankle.x - 11)} ${f(ankle.y + 8)} h34`} stroke="#000" strokeOpacity="0.45" strokeWidth="2.6" />
          {look.footwear === "stivali-risvolto" ? (
            <g>
              <path d={`M${f(ankle.x - 13)} ${f(ankle.y - top - 2)} ${[0, 1, 2, 3, 4, 5].map((i) => `q2 ${i % 2 ? 4 : -3} 4.6 0`).join(" ")} l0 9 ${[0, 1, 2, 3, 4, 5].map((i) => `q-2 ${i % 2 ? 3 : -2} -4.6 0`).join(" ")} Z`} fill="#eee2c8" stroke={OUT} strokeOpacity="0.4" strokeWidth="1" />
              <path d={`M${f(ankle.x - 10)} ${f(ankle.y - top + 4)} l3 -2 M${f(ankle.x - 3)} ${f(ankle.y - top + 5)} l3 -2 M${f(ankle.x + 4)} ${f(ankle.y - top + 4)} l3 -2`} stroke="#c9b894" strokeWidth="0.9" />
            </g>
          ) : look.footwear === "stivali-pelliccia" ? (
            <g>
              {[-11, -6, -1, 4, 9].map((dx, i) => <circle key={dx} cx={f(ankle.x + dx)} cy={f(ankle.y - top + (i % 2) * 2)} r="4.6" fill={i % 2 ? "#e8dcc6" : "#d8c9ae"} stroke={OUT} strokeOpacity="0.25" strokeWidth="0.6" />)}
            </g>
          ) : look.footwear === "stivali-alti" ? (
            <g>
              <path d={`M${f(ankle.x - 12)} ${f(ankle.y - top - 3)} L${f(ankle.x + 12)} ${f(ankle.y - top - 5)} L${f(ankle.x + 11)} ${f(ankle.y - top + 7)} L${f(ankle.x - 11)} ${f(ankle.y - top + 8)} Z`} fill={shade(sc, -0.15)} stroke={OUT} strokeOpacity="0.45" strokeWidth="1.2" />
              <path d={`M${f(ankle.x - 10)} ${f(ankle.y - top + 22)} h20 M${f(ankle.x - 10)} ${f(ankle.y - top + 26)} h20`} stroke={shade(sc, -0.45)} strokeWidth="1" />
              <rect x={f(ankle.x + 4)} y={f(ankle.y - top + 20)} width="5" height="8" rx="1" fill="none" stroke="#c9a46a" strokeWidth="1" />
            </g>
          ) : <path d={`M${f(ankle.x - 10)} ${f(ankle.y - top)} h20 v6 h-20 z`} fill={shade(sc, -0.3)} />}
          <path d={`M${f(ankle.x - 9)} ${f(ankle.y - 12)} h18`} stroke={shade(sc, -0.4)} strokeWidth="1.2" />
        </g>
      );
    }
    if (look.footwear === "sandali") {
      return (
        <g>
          <path d={`M${f(ankle.x - 8)} ${f(ankle.y - 4)} C${f(ankle.x + 6)} ${f(ankle.y - 4)} ${f(ankle.x + 18)} ${f(ankle.y + 2)} ${f(ankle.x + 21)} ${f(ankle.y + 7)} L${f(ankle.x - 10)} ${f(ankle.y + 7)} Z`} fill={skin} stroke={OUT} strokeOpacity="0.4" strokeWidth="1.2" />
          <path d={`M${f(ankle.x - 11)} ${f(ankle.y + 7)} h33 v3 h-33 z`} fill={shade(sc, -0.2)} />
          <path d={`M${f(ankle.x - 8)} ${f(ankle.y - 14)} L${f(ankle.x + 4)} ${f(ankle.y - 2)} M${f(ankle.x + 6)} ${f(ankle.y - 14)} L${f(ankle.x - 6)} ${f(ankle.y - 2)} M${f(ankle.x + 4)} ${f(ankle.y + 1)} L${f(ankle.x + 14)} ${f(ankle.y + 4)}`} stroke={sc} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      );
    }
    const high = look.footwear === "stivaletti" ? 12 : 4;
    return (
      <g>
        <path d={`M${f(ankle.x - 9)} ${f(ankle.y - high)} L${f(ankle.x + 8)} ${f(ankle.y - high)} C${f(ankle.x + 10)} ${f(ankle.y - 1)} ${f(ankle.x + 20)} ${f(ankle.y + 1)} ${f(ankle.x + 22)} ${f(ankle.y + 7)} L${f(ankle.x + 22)} ${f(ankle.y + 10)} L${f(ankle.x - 11)} ${f(ankle.y + 10)} Z`} fill={`url(#${uid}boot)`} stroke={OUT} strokeOpacity="0.55" strokeWidth="1.4" />
        {look.footwear === "sportive" ? <path d={`M${f(ankle.x - 11)} ${f(ankle.y + 7)} h33 v3.5 h-33 z`} fill="#f2efe8" /> : <path d={`M${f(ankle.x - 11)} ${f(ankle.y + 8)} h33`} stroke="#000" strokeOpacity="0.35" strokeWidth="2.5" />}
        {look.footwear === "sportive" ? <path d={`M${f(ankle.x - 2)} ${f(ankle.y - 2)} l8 4 M${f(ankle.x + 1)} ${f(ankle.y - 3)} l8 4`} stroke={shade(sc, 0.5)} strokeWidth="1" /> : null}
      </g>
    );
  };

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
    const sleeve = sleeveless ? skin : look.top === "gilet" || look.top === "corpetto" ? look.sleeves || look.trim : look.top === "giubba" ? look.sleeves || "#c9b48a" : look.top === "cotta" ? look.sleeves || "#8d949b" : look.sleeves || shirt;
    const upW = 15 * W;
    const foreW = 11 * W;
    return (
      <g>
        {limb(s, e, upW, sleeve)}
        {sleeveLong ? limb(e, lerpP(e, h, 0.86), foreW + 1.5, sleeve) : limb(e, h, foreW, skin)}
        {sleeveLong ? limb(lerpP(e, h, 0.86), h, foreW - 1, skin) : null}
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
        {which === "bow" ? (
          <>
            <line x1={f(lerp(e.x, h.x, 0.18))} y1={f(lerp(e.y, h.y, 0.18))} x2={f(lerp(e.x, h.x, 0.78))} y2={f(lerp(e.y, h.y, 0.78))} stroke={look.armguard} strokeWidth={foreW + 3} strokeLinecap="round" />
            <line x1={f(lerp(e.x, h.x, 0.3))} y1={f(lerp(e.y, h.y, 0.3) - 6)} x2={f(lerp(e.x, h.x, 0.3))} y2={f(lerp(e.y, h.y, 0.3) + 6)} stroke={shade(look.armguard, 0.45)} strokeWidth="1" />
            <line x1={f(lerp(e.x, h.x, 0.6))} y1={f(lerp(e.y, h.y, 0.6) - 6)} x2={f(lerp(e.x, h.x, 0.6))} y2={f(lerp(e.y, h.y, 0.6) + 6)} stroke={shade(look.armguard, 0.45)} strokeWidth="1" />
          </>
        ) : null}
        {look.bracers ? (
          <g>
            <line x1={f(lerp(e.x, h.x, 0.32))} y1={f(lerp(e.y, h.y, 0.32))} x2={f(lerp(e.x, h.x, 0.86))} y2={f(lerp(e.y, h.y, 0.86))} stroke={OUT} strokeOpacity="0.5" strokeWidth={foreW + 6} strokeLinecap="round" />
            <line x1={f(lerp(e.x, h.x, 0.32))} y1={f(lerp(e.y, h.y, 0.32))} x2={f(lerp(e.x, h.x, 0.86))} y2={f(lerp(e.y, h.y, 0.86))} stroke={look.bracers} strokeWidth={foreW + 4} strokeLinecap="round" />
            {[0.42, 0.56, 0.7].map((k) => {
              const c = lerpP(e, h, k);
              return <path key={k} d={`M${f(c.x - 3)} ${f(c.y - 4)} l6 8 M${f(c.x + 3)} ${f(c.y - 4)} l-6 8`} stroke={shade(look.bracers, 0.5)} strokeWidth="0.9" />;
            })}
            <line x1={f(lerp(e.x, h.x, 0.33))} y1={f(lerp(e.y, h.y, 0.33) - 1)} x2={f(lerp(e.x, h.x, 0.85))} y2={f(lerp(e.y, h.y, 0.85) - 1)} stroke="#fff" strokeOpacity="0.15" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        ) : null}
        <circle cx={f(h.x)} cy={f(h.y)} r={7.4 * W + 1.3} fill={OUT} opacity="0.5" />
        <circle cx={f(h.x)} cy={f(h.y)} r={7.4 * W} fill={look.gloves ? "#4a2c16" : skin} />
        <circle cx={f(h.x - 1.5)} cy={f(h.y + 1.5)} r={7.4 * W} fill={look.gloves ? "#2a180c" : skinD} opacity="0.25" />
        {which === "draw" && hook > 0.5 ? <path d={`M${f(h.x + 2)} ${f(h.y - 5)} q4 1 4 4 M${f(h.x + 2)} ${f(h.y - 1)} q4 1 4 4 M${f(h.x + 2)} ${f(h.y + 3)} q4 1 4 4`} stroke={look.gloves ? "#1a0e06" : skinD} strokeWidth="1.1" fill="none" /> : null}
        {which === "draw" ? (
          <g>
            <rect x={f(h.x + 1)} y={f(h.y - 6.5)} width="8" height="13" rx="2.5" fill={look.tab} />
            <path d={`M${f(h.x + 3)} ${f(h.y - 3)} h5 M${f(h.x + 3)} ${f(h.y + 1)} h5 M${f(h.x + 3)} ${f(h.y + 5)} h5`} stroke={shade(look.tab, 0.4)} strokeWidth="0.7" />
          </g>
        ) : (
          <path d={`M${f(h.x + 1)} ${f(h.y - 6)} q5 2 5 6 M${f(h.x + 1)} ${f(h.y)} q5 2 5 6`} stroke={skinD} strokeWidth="1" fill="none" />
        )}
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
          <path d={limbPath(s as 1 | -1)} stroke={OUTLINE} strokeOpacity="0.55" strokeWidth={g.width + 2.2} strokeLinecap="round" fill="none" />
          <path d={limbPath(s as 1 | -1)} stroke={limbStroke} strokeWidth={g.width} strokeLinecap="round" fill="none" />
          <path d={limbPath(s as 1 | -1)} pathLength={100} strokeDasharray="42 100" stroke={limbStroke} strokeWidth={g.width + 1.6} strokeLinecap="round" fill="none" />
          <path d={limbPath(s as 1 | -1)} stroke={g.wood ? shade(limbBase, 0.35) : shade(limbBase, 0.5)} strokeOpacity={g.wood ? 0.55 : 0.35} strokeWidth={Math.max(1, g.width * 0.32)} strokeLinecap="round" fill="none" transform="translate(-1.4 0)" />
          <path d={limbPath(s as 1 | -1)} stroke="#fff" strokeOpacity="0.22" strokeWidth={0.9} strokeLinecap="round" fill="none" transform="translate(1.3 0)" />
          {!g.cams ? (() => {
            const tp = tipAt(s as 1 | -1);
            return (
              <g>
                <circle cx={f(tp.x)} cy={f(tp.y)} r={longWood ? 2.6 : 2.1} fill={longWood || g.siyah ? "#efe3c4" : "#2a2f35"} stroke={OUTLINE} strokeOpacity="0.5" strokeWidth="0.7" />
                <circle cx={f(tp.x)} cy={f(tp.y)} r="0.8" fill={look.string || "#f4f1ea"} />
              </g>
            );
          })() : null}
          {/* tasche dei flettenti e bulloni sui riser moderni */}
          {g.recurve && g.riser > 0 ? (
            <g>
              <rect x="-5" y={f(s > 0 ? -g.riser - 3 : g.riser - 4)} width="11" height="7" rx="2" fill={metal ? "#2a2f35" : "#3a2414"} stroke={OUTLINE} strokeOpacity="0.45" strokeWidth="0.6" />
              <circle cx="0.5" cy={f(s > 0 ? -g.riser + 0.5 : g.riser - 0.5)} r="1.5" fill="#c9d0d8" />
            </g>
          ) : null}
          {g.siyah ? <path d={`M-1 ${f(-(g.tipY - 22) * s)} l4 ${f(-4 * s)}`} stroke="#e8d6a8" strokeWidth="2.2" strokeLinecap="round" /> : null}
        </g>
      ))}
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
          <path d={`M-4 ${f(-g.riser)} L6 ${f(-g.riser)} C7 ${f(-g.riser * 0.5)} 7.5 -12 6 -7 L6 ${f(g.riser)} L-4 ${f(g.riser)} C-5 ${f(g.riser * 0.6)} -5 16 -8 9 C-9 4 -8 -6 -5 -11 C-4 ${f(-g.riser * 0.5)} -4 ${f(-g.riser * 0.8)} -4 ${f(-g.riser)} Z`} fill={riserFill} stroke={OUTLINE} strokeOpacity="0.55" strokeWidth="1" />
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
          <rect x="-4" y="-13" width="9" height="26" rx="3.2" fill="#4a2c16" stroke={OUTLINE} strokeOpacity="0.5" strokeWidth="0.8" />
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
        <path d="M4 0.5 L10 -7 L28 -5 L30 1 Z" fill={look.cock} />
        <path d="M4 0.5 L9 8 L27 9 L30 1 Z" fill={look.fletch} />
        <rect x="-4" y="-1.8" width="6" height="3.6" rx="1" fill={look.nock} />
      </g>
    );
  };

  const quiver = (place: "fianco" | "schiena") => {
    const spin = tune(look.quiverRot, 0, -180, 180);
    const tr = place === "schiena" ? `translate(118 140) rotate(${24 + spin})` : `translate(116 214) rotate(${-14 + spin})`;
    return (
      <g transform={tr}>
        {[-5, 0, 5].map((dx, i) => (
          <g key={dx}>
            <line x1={dx} y1={-40} x2={dx} y2={-60} stroke={look.shaft || "#1d1f22"} strokeWidth="2" />
            <path d={`M${dx} -60 l-4 -10 l4 3 l4 -3 z`} fill={i === 1 ? look.cock : look.fletch} />
          </g>
        ))}
        <rect x="-10" y="-42" width="20" height="82" rx="6" fill={look.quiver} />
        <rect x="-10" y="-42" width="20" height="82" rx="6" fill="none" stroke={shade(look.quiver, -0.4)} strokeWidth="1.2" />
        <rect x="-11" y="-44" width="22" height="7" rx="2.5" fill={shade(look.quiver, -0.3)} />
        <path d="M-6 -30 v60 M6 -30 v60" stroke={shade(look.quiver, 0.3)} strokeWidth="0.8" strokeDasharray="3 3" />
      </g>
    );
  };

  const relGrip = ik(SB, POSES.allungo.grip, 42, 41, 1).hand;

  return (
    <g>
      {/* mantello dietro */}
      {look.cape ? (() => {
        const bottom = look.capeStyle === "corto" ? 222 : 296;
        const k = look.capeStyle === "corto" ? 0.45 : 1;
        const xl = shoulderL - 26 * k + capeSway * 2;
        const xr = shoulderR + 4 + capeSway;
        // orlo: dritto, oppure a punte strappate
        const hem = look.capeStyle === "frastagliato"
          ? Array.from({ length: 7 }, (_, i) => {
              const u = (i + 1) / 7;
              const x = xr + (xl - xr) * u;
              const y = bottom - 6 * u + (i % 2 ? -14 : 6);
              return `L${f(x)} ${f(y)}`;
            }).join(" ")
          : `L${f(xl)} ${bottom}`;
        return (
          <g>
            <path d={`M${f(shoulderR - 2)} 122 C${f(shoulderR + 6)} 170 ${f(shoulderR + 8)} ${bottom - 50} ${f(xr)} ${bottom - 6} ${hem} C${f(shoulderL - 30 * k + capeSway * 1.6)} ${bottom - 46} ${f(shoulderL - 18 * k + capeSway)} 180 ${f(shoulderL + 2)} 122 Z`} fill={`url(#${uid}cape)`} stroke={OUT} strokeOpacity="0.4" strokeWidth="1.6" />
            {[0.3, 0.55, 0.78].map((u) => <path key={u} d={`M${f(lerp(shoulderL, shoulderR, u))} 128 Q${f(lerp(xl, xr, u) + capeSway)} ${(128 + bottom) / 2} ${f(lerp(xl, xr, u) + capeSway * 1.4)} ${bottom - 14}`} stroke={shade(look.capeColor, -0.45)} strokeOpacity="0.55" strokeWidth="1.2" fill="none" />)}
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
          <path d={`M${f(hipL - 2)} 200 L${f(hipR + 2)} 200 L${f(hipR + 12)} 258 Q${f(cx)} 263 ${f(hipL - 12)} 258 Z`} fill={`url(#${uid}pants)`} stroke={OUT} strokeOpacity="0.5" strokeWidth="1.6" />
          {[-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].map((k) => <path key={k} d={`M${f(cx + k * 22)} 204 L${f(cx + k * 30)} 258`} stroke={shade(look.pants, -0.35)} strokeWidth="1" />)}
          <path d={`M${f(hipL - 11)} 252 Q${f(cx)} 257 ${f(hipR + 11)} 252`} stroke={look.trim} strokeWidth="1.6" fill="none" />
        </g>
      ) : null}

      {longTunic ? <path d={`M${f(hipL + 1)} 200 L${f(hipR - 1)} 200 C${f(hipR + 4)} 224 ${f(hipR + 10)} ${tunicLen - 18} ${f(hipR + 12)} ${tunicLen} Q${f(cx)} ${tunicLen + 5} ${f(hipL - 12)} ${tunicLen} C${f(hipL - 10)} ${tunicLen - 18} ${f(hipL - 4)} 224 ${f(hipL + 1)} 200 Z`} fill={`url(#${uid}shirt)`} stroke={OUT} strokeOpacity="0.5" strokeWidth="2.2" /> : null}
      <path d={torso} fill={`url(#${uid}shirt)`} stroke={OUT} strokeOpacity="0.5" strokeWidth="2.2" />
      <Outfit look={look} cx={cx} shoulderL={shoulderL} shoulderR={shoulderR} hipL={hipL} hipR={hipR} tunicLen={tunicLen} W={W} woman={woman} />
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
              <path d={`M${f(x1)} ${y1} L${f(x2)} ${y2}`} stroke={OUT} strokeOpacity="0.5" strokeWidth="7.5" strokeLinecap="round" />
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
          <path d={`M${f(hipL - 3)} 188 C${f(cx)} 184 ${f(cx)} 184 ${f(hipR + 3)} 188 L${f(hipR + 3)} 206 C${f(cx)} 202 ${f(cx)} 202 ${f(hipL - 3)} 206 Z`} fill={look.sashColor} stroke={OUT} strokeOpacity="0.45" strokeWidth="1.2" />
          {[192, 197, 202].map((y) => <path key={y} d={`M${f(hipL)} ${y} Q${f(cx)} ${y - 3} ${f(hipR)} ${y}`} stroke={shade(look.sashColor, -0.3)} strokeWidth="0.8" fill="none" />)}
          <path d={`M${f(cx + 8)} 204 C${f(cx + 12 + capeSway * 0.4)} 222 ${f(cx + 10 + capeSway * 0.6)} 238 ${f(cx + 14 + capeSway * 0.8)} 252 L${f(cx + 24 + capeSway * 0.8)} 250 C${f(cx + 20)} 236 ${f(cx + 20)} 220 ${f(cx + 17)} 204 Z`} fill={shade(look.sashColor, -0.1)} stroke={OUT} strokeOpacity="0.4" strokeWidth="1" />
          <path d={`M${f(cx + 14 + capeSway * 0.8)} 252 l1.5 5 M${f(cx + 18 + capeSway * 0.8)} 251 l1.5 5 M${f(cx + 22 + capeSway * 0.8)} 250 l1.5 5`} stroke={shade(look.sashColor, -0.2)} strokeWidth="1.2" />
        </g>
      ) : null}
      {look.quiverPlace !== "schiena" ? quiver("fianco") : (
        <g>
          <path d={`M${f(shoulderL + 4)} 122 L${f(hipR - 2)} 204`} stroke={OUT} strokeOpacity="0.5" strokeWidth="9" strokeLinecap="round" />
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
        <g>
          <path d={`M${f(cx - 9)} 120 Q${f(cx)} 140 ${f(cx + 9)} 120`} stroke="#d9b45a" strokeWidth="1.3" fill="none" />
          <path d={`M${f(cx)} 137 l3 4 l-3 4 l-3 -4 z`} fill="#3fae6a" stroke="#d9b45a" strokeWidth="0.8" />
        </g>
      ) : null}

      <path d={`M${f(neck.x - 8)} 100 L${f(neck.x + 8)} 100 L${f(neck.x + 9)} 124 L${f(neck.x - 9)} 124 Z`} fill={skinD} />
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
            return <ellipse key={i} cx={f(x)} cy={f(y)} rx="9" ry="7.5" fill={shade(look.furColor, (i % 3) * 0.08 - 0.08)} stroke={OUT} strokeOpacity="0.25" strokeWidth="0.8" />;
          })}
          {Array.from({ length: 14 }, (_, i) => {
            const x = lerp(shoulderL - 10, shoulderR + 8, i / 13);
            return <path key={i} d={`M${f(x)} ${f(126 + (i % 3))} l${(i % 2) * 2 - 1} 6`} stroke={shade(look.furColor, -0.4)} strokeWidth="1" strokeLinecap="round" />;
          })}
        </g>
      ) : null}
      {look.cowl ? (
        <g>
          <path d={`M${f(cx - 24)} 128 C${f(cx - 26)} 112 ${f(cx - 12)} 100 ${f(cx + 2)} 100 C${f(cx + 16)} 100 ${f(cx + 26)} 112 ${f(cx + 24)} 128 C${f(cx + 16)} 142 ${f(cx - 16)} 142 ${f(cx - 24)} 128 Z`} fill={look.cowlColor} stroke={OUT} strokeOpacity="0.45" strokeWidth="1.4" />
          {[0, 1, 2].map((i) => <path key={i} d={`M${f(cx - 20 + i * 2)} ${118 + i * 6} Q${f(cx)} ${124 + i * 6} ${f(cx + 20 - i * 2)} ${116 + i * 6}`} stroke={shade(look.cowlColor, -0.35)} strokeWidth="1.1" fill="none" />)}
          <path d={`M${f(cx - 14)} 136 C${f(cx - 18 + capeSway)} 156 ${f(cx - 10 + capeSway)} 170 ${f(cx - 2 + capeSway)} 176 L${f(cx + 8)} 138 Z`} fill={shade(look.cowlColor, -0.12)} stroke={OUT} strokeOpacity="0.35" strokeWidth="1" />
        </g>
      ) : null}
      <g transform={kid ? `translate(${f(H.x)} ${f(H.y)}) scale(1.14) translate(${f(-H.x)} ${f(-H.y)})` : undefined}>
        <Head look={look} H={H} face={face} blink={blink} uid={uid} t={t} />
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
      {arm(SD, drawArm.elbow, drawHand, "draw")}
    </g>
  );
}

const OUTLINE = "#1b130d";

function Outfit({ look, cx, shoulderL, shoulderR, hipL, hipR, tunicLen, W, woman }: { look: AvatarLook; cx: number; shoulderL: number; shoulderR: number; hipL: number; hipR: number; tunicLen: number; W: number; woman: boolean }) {
  const sh = look.shirt;
  const tr = look.trim;
  const dark = shade(sh, -0.3);
  const wide = look.belt === "larga";
  const bc = look.beltColor || (look.style === "medievale" ? "#5b3a1e" : shade(look.pants, -0.45));
  const belt = look.belt === "nessuna" ? (look.pouch ? <path d={`M${f(hipR - 14)} 206 h12 v14 a3 3 0 0 1 -3 3 h-6 a3 3 0 0 1 -3 -3 z`} fill="#7a4a26" stroke="#4a2c16" strokeWidth="0.8" /> : null) : (
    <g>
      <rect x={f(hipL - 2)} y={wide ? 196 : 200} width={f(hipR - hipL + 4)} height={wide ? 13 : 8} rx="2" fill={bc} stroke="#1b130d" strokeOpacity="0.5" strokeWidth="1.2" />
      <rect x={f(hipL - 2)} y={wide ? 197 : 200.6} width={f(hipR - hipL + 4)} height="1.6" fill="#fff" opacity="0.15" />
      {wide ? [hipL + 6, hipR - 6].map((x) => <circle key={x} cx={f(x)} cy="202.5" r="1.3" fill="#d9b45a" />) : null}
      <rect x={f(cx - (wide ? 6 : 3.5))} y={wide ? 196.5 : 200.5} width={wide ? 12 : 7} height={wide ? 12 : 7} rx="1.6" fill="none" stroke="#d9b45a" strokeWidth={wide ? 2 : 1.2} />
      {wide ? <path d={`M${f(cx + 2)} 209 l4 10 l3 -1 l-4 -9 z`} fill={bc} /> : null}
      {look.pouch ? <path d={`M${f(hipR - 14)} 206 h12 v14 a3 3 0 0 1 -3 3 h-6 a3 3 0 0 1 -3 -3 z`} fill="#7a4a26" stroke="#4a2c16" strokeWidth="0.8" /> : null}
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
          <path d={`M${f(cx - 14)} 116 C${f(cx - 4)} 140 ${f(cx + 10)} 176 ${f(hipR + 2)} 210`} stroke={OUTLINE} strokeOpacity="0.35" strokeWidth="1" fill="none" transform="translate(-2 1)" />
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
          {look.sash ? null : <rect x={f(hipL - 3)} y="186" width={f(hipR - hipL + 6)} height="20" rx="3" fill={shade(tr, -0.1)} stroke={OUTLINE} strokeOpacity="0.4" strokeWidth="1.2" />}
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
          <path d={`M${f(cx + 2)} 122 L${f(cx + 6)} ${tunicLen}`} stroke={OUTLINE} strokeOpacity="0.4" strokeWidth="0.8" transform="translate(-2 0)" />
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
function HairBack({ look, uid, t }: { look: AvatarLook; uid: string; t: number }) {
  const sway = Math.sin(t * 1.6) * 2;
  const kid = look.body === "ragazzo" || look.body === "ragazza";
  const tr = kid ? "translate(150 86) scale(1.14) translate(-150 -86)" : undefined;
  const fill = `url(#${uid}hair)`;
  if (look.hat === "cappuccio" || look.hat === "elmo") return null;
  let node: ReactNode = null;
  switch (look.hair) {
    case "lunghi":
      node = <path d={`M134 70 C120 92 118 132 ${f(126 + sway)} 160 L150 156 C142 128 140 104 144 86 Z`} fill={fill} />;
      break;
    case "coda":
      node = <path d={`M131 78 C118 88 ${f(112 + sway)} 112 ${f(118 + sway * 1.5)} 140 C123 136 126 122 126 110 C128 98 134 90 138 84 Z`} fill={fill} />;
      break;
    case "treccia":
      node = (
        <g fill={fill}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ellipse key={i} cx={f(132 - i * 1.6 + sway * (i / 5))} cy={98 + i * 11} rx={6 - i * 0.4} ry="7" stroke={shade(look.hairColor, -0.4)} strokeWidth="0.8" />
          ))}
        </g>
      );
      break;
    case "codini":
      node = (
        <g fill={fill}>
          <path d={`M130 86 C118 92 ${f(116 + sway)} 112 ${f(120 + sway)} 128 C126 124 130 110 134 96 Z`} />
          <path d={`M160 66 C170 58 ${f(176 + sway)} 64 ${f(178 + sway)} 74 C172 72 166 70 162 72 Z`} opacity="0.85" />
        </g>
      );
      break;
    case "caschetto":
      node = <path d="M128 76 C124 90 126 104 132 110 L146 108 C140 98 140 88 144 80 Z" fill={fill} />;
      break;
    case "lunghi-mossi":
      node = <path d={`M134 68 C116 86 ${f(118 + sway)} 112 ${f(112 + sway)} 128 C${f(120 + sway)} 136 ${f(110 + sway * 1.3)} 148 ${f(120 + sway * 1.5)} 166 C130 160 138 162 148 156 C140 140 146 128 140 116 C146 102 142 90 146 82 Z`} fill={fill} />;
      break;
    case "trecce":
      node = (
        <g fill={fill}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <ellipse key={`a${i}`} cx={f(134 - i * 1.4 + sway * (i / 6))} cy={96 + i * 10} rx={5.4 - i * 0.35} ry="6.4" stroke={shade(look.hairColor, -0.4)} strokeWidth="0.8" />)}
          {[0, 1, 2, 3, 4].map((i) => <ellipse key={`b${i}`} cx={f(142 + i * 0.6 + sway * 0.5 * (i / 4))} cy={104 + i * 10} rx={4.6 - i * 0.3} ry="5.6" stroke={shade(look.hairColor, -0.4)} strokeWidth="0.8" opacity="0.9" />)}
        </g>
      );
      break;
    case "afro":
      node = <circle cx="146" cy="72" r="27" fill={fill} />;
      break;
    case "dread":
      node = (
        <g fill="none" stroke={fill} strokeLinecap="round">
          {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${136 - i * 1.5} ${70 + i * 3} C${f(128 - i * 2 + sway * 0.4)} ${100 + i * 3} ${f(126 - i + sway)} ${124 + i * 2} ${f(128 - i * 2 + sway * 1.3)} ${148 + i * 2}`} strokeWidth="5.2" />)}
          {[0, 1, 2, 3, 4, 5].map((i) => <path key={`l${i}`} d={`M${f(128 - i * 2 + sway * 1.3)} ${146 + i * 2} l0 3`} stroke={shade(look.hairColor, -0.45)} strokeWidth="5.4" />)}
        </g>
      );
      break;
    case "vichinga":
      node = (
        <g fill={fill}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <ellipse key={i} cx={f(134 - i * 1.8 + sway * (i / 6))} cy={70 + i * 9.5} rx={5.4 - i * 0.35} ry="6" stroke={shade(look.hairColor, -0.4)} strokeWidth="0.8" />)}
        </g>
      );
      break;
    case "coda-alta":
      node = <path d={`M140 60 C126 50 ${f(110 + sway)} 66 ${f(114 + sway * 1.4)} 112 C118 106 121 92 126 82 C129 74 134 68 142 66 Z`} fill={fill} stroke={shade(look.hairColor, -0.4)} strokeWidth="0.6" />;
      break;
    case "raccolti":
      node = (
        <g>
          <circle cx="136" cy="62" r="8.5" fill={fill} stroke={shade(look.hairColor, -0.4)} strokeWidth="0.8" />
          <path d="M131 58 q5 4 10 0" stroke={shade(look.hairColor, -0.45)} strokeWidth="1.6" fill="none" />
        </g>
      );
      break;
    default:
      node = null;
  }
  // barra della lunghezza: i capelli lunghi scendono o salgono partendo dalla nuca
  const sy = 0.5 + (tune(look.hairLength, 50, 0, 100) / 100) * 1.0;
  const len = `translate(0 74) scale(1 ${sy.toFixed(3)}) translate(0 -74)`;
  return node ? <g transform={tr}><g transform={len}>{node}</g></g> : null;
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
      <path d={d} fill={`url(#${uid}hair)`} stroke="#1b130d" strokeOpacity="0.35" strokeWidth="1.2" />
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
function Head({ look, H, face, blink, uid, t }: { look: AvatarLook; H: P; face: string; blink: boolean; uid: string; t: number }) {
  const skin = look.skin;
  const skinD = shade(skin, -0.22);
  const hair = look.hairColor;
  const woman = look.body === "donna" || look.body === "ragazza";
  const dy = H.y - 86;
  const chinY = look.face === "allungato" ? 114 : look.face === "tondo" ? 108 : 111;
  const jaw = look.face === "squadrato" ? `C171 ${chinY - 2} 168 ${chinY + 1} 160 ${chinY + 1} L148 ${chinY - 2}` : look.face === "tondo" ? `C172 ${chinY} 166 ${chinY + 3} 158 ${chinY + 2} C152 ${chinY + 1} 148 ${chinY - 2} 146 ${chinY - 4}` : `C171 ${chinY} 168 ${chinY + 2} 162 ${chinY + 2} C156 ${chinY + 2} 150 ${chinY - 1} 146 ${chinY - 4}`;
  const NP = NOSES[look.nose] ?? NOSES.dritto;
  const nk = 0.62 + (tune(look.noseSize, 50, 0, 100) / 100) * 0.76;
  const nx = (x: number) => f(173 + (x - 173) * nk);
  const nose = `C${nx(NP[0])} ${NP[1]} ${nx(NP[2])} ${NP[3]} ${nx(NP[4])} ${NP[5]} C${nx(NP[6])} ${NP[7]} ${nx(NP[8])} ${NP[9]} ${nx(NP[10])} ${NP[11]}`;
  const headPath = `M149 62 C162 62 171 70 172 80 L173 83 ${nose} C173.5 98 173.5 99.5 172.6 100.2 C173.2 101.6 172.6 103 171.3 103.5 ${jaw} C138 104 128 97 127 86 C127 71 136 62 149 62 Z`;
  const lid = face === "concentrato" ? 2.2 : face === "deciso" ? 1.4 : 0;
  const browD = face === "deciso" ? "M156.5 75.8 Q162 73.2 168.4 75.6" : face === "concentrato" ? "M156.5 75 Q162 72.6 168.2 74.6" : face === "felice" ? "M156.5 74 Q162 70.6 168 73" : "M156.5 74.6 Q162 71.4 168.2 73.6";
  const browW = look.brows === "folte" ? 3.2 : look.brows === "sottili" ? 1.3 : 2.1;
  const lip = shade(skin, -0.5);
  const mouth =
    face === "felice" ? <path d="M164.5 99 Q168.5 104.5 172.6 100 Q168.6 101.4 164.5 99 Z" fill="#7a2f2a" stroke={lip} strokeWidth="0.9" /> :
    face === "sorriso" ? <><path d="M163.8 99.6 Q168 102.6 172.4 99.6" stroke={lip} strokeWidth="1.3" fill="none" strokeLinecap="round" /><path d="M165.5 100.4 Q168 101.4 171 100.4" stroke="#fff" strokeWidth="0.9" fill="none" /></> :
    face === "deciso" ? <path d="M164.5 101 Q168.4 100 172.4 101.2" stroke={lip} strokeWidth="1.3" fill="none" strokeLinecap="round" /> :
    face === "concentrato" ? <path d="M165 100.6 L172.4 100.4" stroke={lip} strokeWidth="1.2" strokeLinecap="round" /> :
    <path d="M164.6 100 Q168.4 101.8 172.4 100" stroke={lip} strokeWidth="1.2" fill="none" strokeLinecap="round" />;
  const capOn = look.hat === "cappuccio" || look.hat === "elmo";
  return (
    <g transform={`translate(0 ${f(dy)})`}>
      {look.hair !== "calvo" && look.hair !== "rasati" && look.hair !== "cresta" && !capOn ? <path d="M131 84 C127 66 138 57 150 57 C140 64 136 76 138 92 Z" fill={`url(#${uid}hair)`} /> : null}
      <path d={headPath} fill={`url(#${uid}face)`} stroke="#1b130d" strokeOpacity="0.45" strokeWidth="1.6" />
      <g transform={`translate(151 74) scale(${Math.max(1, hairScale(look)).toFixed(3)}) translate(-151 -74)`}>
        <HairCap look={look} uid={uid} />
      </g>
      <ellipse cx="141" cy="88" rx="4.4" ry="6.6" fill={skinD} />
      <path d="M141 84 Q138 88 141 92" stroke={shade(skin, -0.38)} strokeWidth="0.9" fill="none" />
      {look.earring ? <circle cx="141.5" cy="96" r="1.8" fill="#d9b45a" stroke="#8a6a20" strokeWidth="0.5" /> : null}
      <ellipse cx="163" cy="93" rx="5" ry="3" fill="#e0726b" opacity="0.22" />
      <path d={`M${nx(174.2)} ${f(NP[5] + 0.6)} q${f(1.6 * nk)} 1.3 ${f(3 * nk)} 0.3`} stroke={shade(skin, -0.42)} strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d={`M${nx(174.6)} 85.5 Q${nx(NP[2] - 0.6)} ${f(NP[3])} ${nx(NP[4] - 1.2)} ${f(NP[5] - 1)}`} stroke="#fff" strokeOpacity="0.28" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      {look.freckles ? (
        <g fill={shade(skin, -0.42)} opacity="0.6">
          {[[160, 90], [164, 92], [168, 90], [158, 93], [166, 88], [162, 88]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="0.8" />)}
        </g>
      ) : null}
      {!blink ? (
        <g>
          <path d="M157 83 Q162.5 77.4 168.4 81.6 Q163 86.4 157 83 Z" fill="#fbf7f2" />
          <circle cx="164" cy="82.2" r="3.2" fill={look.eyes} />
          <circle cx="164.4" cy="82.2" r="1.5" fill="#120c08" />
          <circle cx="165.3" cy="81" r="0.9" fill="#fff" />
          {lid ? <path d={`M156.8 82.5 Q162.5 ${f(77.2 + lid)} 168.6 81.4 L168.6 79 L156.8 79 Z`} fill={skin} /> : null}
          <path d={`M156.8 82.8 Q162.5 ${f(77.2 + lid)} 168.6 81.4`} stroke="#2a1d14" strokeWidth={woman ? 1.6 : 1.1} fill="none" strokeLinecap="round" />
          {woman ? <path d="M167.6 80.6 l2.4 -1.6 M166.2 79.6 l1.6 -2.2 M164.6 79.2 l0.8 -2.4" stroke="#2a1d14" strokeWidth="0.75" strokeLinecap="round" /> : null}
        </g>
      ) : (
        <path d="M157 82.6 Q162.6 85 168.4 81.8" stroke="#2a1d14" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      )}
      <path d={browD} stroke={shade(hair, -0.15)} strokeWidth={browW} strokeLinecap="round" fill="none" />
      {look.mask ? null : mouth}
      <path d="M152 95 Q158 98 163 96" stroke={shade(skin, -0.12)} strokeWidth="2" fill="none" opacity="0.4" />
      {look.mask ? null : <Beard look={look} />}
      {look.warpaint ? (
        <g stroke="#2a3a5a" strokeOpacity="0.75" strokeWidth="2.2" strokeLinecap="round">
          <path d="M150 86 L166 88" />
          <path d="M151 91 L165 93" />
        </g>
      ) : null}
      {look.scar ? <path d="M158 72 L162 80 M157 85 L161 92 M159.5 76 l2 -1 M159 88 l2 -1" stroke={shade(skin, -0.42)} strokeWidth="1.1" strokeLinecap="round" /> : null}
      {look.mask ? (
        <g>
          <path d="M146 90 C152 88 166 88 174 89 C179 91 181 95 179 98 C177 104 172 110 164 114 C156 117 147 112 142 102 C141 97 142 92 146 90 Z" fill={look.cowlColor} stroke="#1b130d" strokeOpacity="0.45" strokeWidth="1.2" />
          <path d="M150 99 Q162 102 176 97 M149 106 Q160 109 170 106" stroke={shade(look.cowlColor, -0.35)} strokeWidth="1" fill="none" />
        </g>
      ) : null}
      <g transform={`translate(151 70) scale(${hairScale(look).toFixed(3)}) translate(-151 -70)`}>
        <HairFront look={look} uid={uid} t={t} />
        <HairStrands look={look} />
      </g>
      {look.hairFeather && !capOn ? (
        <g transform="translate(132 76) rotate(-128)">
          <path d="M0 0 C4 -6 6 -18 2 -30 C-3 -20 -4 -8 0 0 Z" fill="#f4f1ea" stroke="#b9ae98" strokeWidth="0.6" />
          <path d="M1 -2 L1.6 -28" stroke="#8a7a5a" strokeWidth="0.6" />
          <path d="M2 -30 c1 -3 3 -4 3 -4" stroke="#c4473d" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ) : null}
      <g transform={capOn ? undefined : `rotate(${tune(look.hatRot, 0, -180, 180)} 151 66)`}>
        <Hat look={look} />
      </g>
      {look.sunglasses ? (
        <g>
          <path d="M157 79.6 C160 78.6 168 78.4 170.6 79.4 C170.6 83.6 168.6 86.2 164 86.2 C159.6 86.2 157.4 83.4 157 79.6 Z" fill="#14181c" stroke="#3a3f45" strokeWidth="0.8" />
          <path d="M159.4 80.6 L163 80.2" stroke="#fff" strokeOpacity="0.45" strokeWidth="1" strokeLinecap="round" />
          <path d="M157.4 80.4 L143 83" stroke="#1d2126" strokeWidth="1.5" />
        </g>
      ) : null}
      {look.glasses && !look.sunglasses ? (
        <g fill="none" stroke="#1d2126" strokeWidth="1.3">
          <circle cx="163.6" cy="82.4" r="5.6" fill="#a8d8ff" fillOpacity="0.16" />
          <path d="M158 82.4 L143 84" />
        </g>
      ) : null}
    </g>
  );
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

function Beard({ look }: { look: AvatarLook }) {
  const c = beardTone(look);
  const lo = shade(c, -0.35);
  const k = 0.7 + (tune(look.beardLength, 50, 0, 100) / 100) * 0.6;
  // la barba si allunga verso il basso partendo dal mento
  const grow = `translate(0 100) scale(1 ${k.toFixed(3)}) translate(0 -100)`;
  let body: ReactNode = null;
  switch (look.beard) {
    case "piena":
    case "accenno":
      body = <path d="M138 93 C140 105 148 115 158 115 C166 115 172 108 173 99 C169 101.5 164 102.5 160 101.5 L153 98.5 C148 98.5 143 96 138 93 Z" fill={c} opacity={look.beard === "accenno" ? 0.32 : 1} />;
      break;
    case "lunga":
      body = <path d="M138 93 C139 108 146 122 152 132 C156 138 160 140 164 136 C168 128 172 112 173 99 C169 101.5 164 102.5 160 101.5 L153 98.5 C148 98.5 143 96 138 93 Z" fill={c} />;
      break;
    case "corta":
      body = <path d="M143 97 C145 107 151 112 158 112 C164.5 112 170 107 171.3 101 C167 102.6 163 103.4 159 102.6 C153 101.6 148 100 143 97 Z" fill={c} />;
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
  return (
    <g>
      {body ? <g transform={look.beard === "basette" || look.beard === "barbetta" ? undefined : grow}>{body}</g> : null}
      {body && look.beard !== "accenno" && look.beard !== "basette" && look.beard !== "mosca" ? <path d="M150 104 q3 3 6 3.4 M157 108 q3 1.6 6 0.4" stroke={lo} strokeWidth="0.7" fill="none" opacity="0.55" /> : null}
      {stache}
    </g>
  );
}

/** Ciocche e riflessi sopra i capelli: danno volume e verso alla pettinatura. */
function HairStrands({ look }: { look: AvatarLook }) {
  if (["calvo", "rasati", "undercut", "vichinga", "dread"].includes(look.hair) || ["cappuccio", "elmo", "bandana", "tesa", "robin", "cuffia"].includes(look.hat)) return null;
  const hi = shade(look.hairColor, 0.38);
  const lo = shade(look.hairColor, -0.42);
  const curly = look.hair === "ricci" || look.hair === "afro";
  return (
    <g fill="none" strokeLinecap="round" pointerEvents="none">
      {curly ? (
        <g stroke={lo} strokeOpacity="0.55" strokeWidth="1">
          {[[138, 62], [148, 58], [158, 60], [166, 66], [134, 72], [144, 66]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y} q3 -3 6 0 q-3 3 -6 0`} />)}
        </g>
      ) : (
        <>
          <path d="M136 66 Q148 56 164 62" stroke={hi} strokeOpacity="0.55" strokeWidth="1.6" />
          <path d="M140 61 Q152 54 166 60" stroke={hi} strokeOpacity="0.35" strokeWidth="1" />
          <path d="M133 74 Q144 64 158 66 M146 60 Q156 58 168 68 M131 82 Q136 72 146 70" stroke={lo} strokeOpacity="0.45" strokeWidth="0.9" />
        </>
      )}
    </g>
  );
}

function HairFront({ look, uid, t }: { look: AvatarLook; uid: string; t: number }) {
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
          <path d="M136 66 L138 48 L144 62 L148 44 L153 60 L159 46 L161 62 L168 54 L167 70 C158 64 146 62 136 66 Z" fill={fill} />
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
          <path d={`M146 56 C156 50 168 50 ${f(178 + sway)} 56`} stroke={shade(h, 0.35)} strokeWidth="1.4" fill="none" opacity="0.7" />
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
          {[[150, 60], [158, 61], [165, 66], [142, 64]].map(([x, y]) => <path key={x} d={`M${x} ${y} q2 6 0 12`} stroke={shade(h, -0.4)} strokeWidth="1.2" fill="none" />)}
        </g>
      );
    case "coda-alta":
      return (
        <g>
          <path d="M131 84 C129 66 139 58 151 58 C163 58 171 65 170 75 C164 70 157 69 151 71 C146 68 141 72 141 82 C138 84 135 87 133 91 Z" fill={fill} />
          <path d="M136 64 Q150 58 166 64" stroke={shade(h, -0.35)} strokeWidth="0.9" fill="none" />
        </g>
      );
    case "frangia":
      return (
        <g>
          <path d="M130 86 C127 66 138 56 151 56 C164 56 173 64 172 80 L168 82 C166 76 164 74 160 76 L158 82 C156 76 152 74 148 77 L145 84 C142 84 138 86 134 94 C131 91 130 88 130 86 Z" fill={fill} />
          <path d="M150 62 l-2 14 M158 62 l0 13 M165 66 l1 10" stroke={shade(h, -0.3)} strokeWidth="0.9" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M130 85 C127 66 138 56 151 56 C164 56 173 64 171 77 C166 71 158 69 151 72 C146 69 140 73 141 82 C138 84 135 88 133 94 C131 91 130 88 130 85 Z" fill={fill} />
          {look.hair === "corti" ? <path d="M160 63 l4 -4 l1 6 M166 66 l4 -3 l0 6" stroke={shade(h, -0.3)} strokeWidth="1" fill="none" /> : null}
          {look.hair === "chignon" ? <circle cx="134" cy="65" r="9" fill={fill} stroke={shade(h, -0.35)} strokeWidth="0.8" /> : null}
        </g>
      );
  }
}

function Hat({ look }: { look: AvatarLook }) {
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
    case "cappuccio":
      return (
        <g>
          <path d="M124 92 C120 64 136 50 154 52 C170 54 178 66 176 82 L172 80 C170 70 162 64 152 64 C142 64 136 72 136 86 C136 96 140 104 146 110 L132 114 C126 108 124 100 124 92 Z" fill={c} />
          <path d="M172 80 C170 70 162 64 152 64 C142 64 136 72 136 86" stroke={shade(c, -0.35)} strokeWidth="2" fill="none" />
        </g>
      );
    case "bandana":
      return (
        <g>
          <path d="M129 82 C128 64 139 56 152 56 C165 56 173 64 172 76 C160 73 146 74 129 82 Z" fill={c} stroke="#1b130d" strokeOpacity="0.4" strokeWidth="1" />
          {[[134, 64], [146, 60], [158, 62], [164, 68]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.3" fill="#f4f1ea" opacity="0.7" />)}
          <path d="M130 80 l-10 6 l4 2 l8 -4 M130 80 l-8 12 l4 0 l6 -9" fill={shade(c, -0.15)} />
        </g>
      );
    case "robin":
      return (
        <g>
          <path d="M128 78 C134 70 160 66 176 72 C170 60 150 50 132 54 C120 56 112 50 104 46 C112 56 118 66 128 78 Z" fill={c} stroke="#1b130d" strokeOpacity="0.45" strokeWidth="1.2" />
          <path d="M128 78 C140 74 160 72 176 72" stroke={shade(c, -0.35)} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M140 64 C130 48 122 38 116 30 C126 36 134 48 144 62 Z" fill="#c4473d" stroke="#7a2a22" strokeWidth="0.6" />
        </g>
      );
    case "tesa":
      return (
        <g>
          <ellipse cx="152" cy="72" rx="34" ry="6.5" fill={shade(c, -0.15)} stroke="#1b130d" strokeOpacity="0.45" strokeWidth="1.2" />
          <path d="M132 72 C132 56 140 48 152 48 C164 48 172 56 172 72 Z" fill={c} stroke="#1b130d" strokeOpacity="0.45" strokeWidth="1.2" />
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
    case "cuffia":
      return (
        <g>
          <path d="M127 82 C125 60 138 49 152 49 C166 49 175 59 174 76 Z" fill={c} stroke="#1b130d" strokeOpacity="0.45" strokeWidth="1.2" />
          {[134, 140, 146, 152, 158, 164, 170].map((x) => <path key={x} d={`M${x} ${x < 150 ? 58 + (150 - x) * 0.6 : 54 + (x - 150) * 0.5} L${x - 1} 76`} stroke={shade(c, -0.3)} strokeWidth="0.8" />)}
          <path d="M126 80 C140 74 160 72 175 75 L175 82 C160 79 140 81 127 87 Z" fill={shade(c, -0.18)} stroke="#1b130d" strokeOpacity="0.4" strokeWidth="1" />
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
    </defs>
  );
}

/** Comando esterno (gioco): quanto è tesa la corda (0–1) e alzo in gradi (positivo = più in alto). */
export type AvatarDrive = { pull: number; aim: number; released?: number | null };

/**
 * L'arciere. `pose` = "animata" ripete la sequenza di tiro scelta (completa, rapida o da gara, con le
 * frecce della volée); le altre sono pose ferme con respiro e battito delle palpebre. Toccandolo, in
 * una posa ferma, scocca una freccia. Con `drive` lo muove il giocatore (tendere, mirare, rilasciare).
 */
export function ArcherAvatar({ look, className = "h-72 w-auto", interactive = true, pose, onShot, hideFlight = false, still = false, drive, onPhase }: { look: AvatarLook; className?: string; interactive?: boolean; pose?: Pose; onShot?: () => void; hideFlight?: boolean; still?: boolean; drive?: AvatarDrive | null; onPhase?: (name: string) => void }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const mode = drive ? "guidata" : pose ?? look.pose ?? "animata";
  const plan = useMemo(() => routinePlan(look), [look.routine, look.hold, look.volley]);
  const [t, setT] = useState(0);
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
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "ridotta";
    if ((reduce || still) && mode !== "guidata") {
      setT(mode === "animata" ? plan.releases[0] - 0.4 : 0.5);
      return;
    }
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    // ~50 fotogrammi al secondo mentre tira, ~30 nelle pose ferme (basta per il respiro)
    const step = mode === "animata" || mode === "guidata" ? 19 : 33;
    const frame = (now: number) => {
      if (now - last > step && !document.hidden && visible.current) {
        last = now;
        setT((now - t0) / 1000);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mode, still, plan]);

  let def: PoseDef;
  let flying: number | null = null;
  let phase = "";
  if (mode === "guidata" && drive) {
    // il giocatore tende e mira: da pre-trazione ad ancoraggio, l'arco sale o scende con l'alzo
    const k = Math.max(0, Math.min(1, drive.pull));
    const base = k <= 0.02 ? POSES.predraw : mix(POSES.predraw, POSES.allungo, easeIO(k));
    const lift = Math.max(-14, Math.min(18, drive.aim)) * 1.5;
    def = { ...base, grip: p(base.grip.x, base.grip.y - lift) };
    if (drive.released != null) {
      const dt = drive.released;
      def = dt < 0.12 ? mix(POSES.allungo, POSES.rilascio, dt / 0.12) : dt < 1.2 ? mix(POSES.rilascio, POSES.accompagna, Math.min(1, (dt - 0.12) / 0.6)) : mix(POSES.accompagna, POSES.riposo, easeIO(Math.min(1, (dt - 1.2) / 0.8)));
      const fade = dt > 1.2 ? 1 - Math.min(1, (dt - 1.2) / 0.8) : 1;
      def = { ...def, grip: p(def.grip.x, def.grip.y - lift * fade) };
    }
    phase = drive.released != null ? PHASE_NAMES.accompagna : k > 0.9 ? PHASE_NAMES.mira : k > 0.05 ? PHASE_NAMES.trazione : PHASE_NAMES.predraw;
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
  if (!still && (mode === "guidata" || t < smoothUntil.current) && smoothDef.current) {
    def = mix(smoothDef.current, def, mode === "guidata" ? 0.4 : 0.22);
  }
  smoothDef.current = def;
  if (phase && phase !== lastPhase.current) {
    lastPhase.current = phase;
    queueMicrotask(() => phaseRef.current?.(phase));
  }
  const blink = t % 3.7 < 0.12;
  const kid = look.body === "ragazzo" || look.body === "ragazza";
  const tap = () => {
    if (!interactive || mode === "animata" || mode === "guidata") return;
    setTapShot(t);
    window.setTimeout(() => shotRef.current?.(), 600);
  };
  return (
    <svg ref={host} viewBox="40 0 300 350" className={className} role="img" aria-label="Il tuo arciere" onClick={tap} style={{ cursor: interactive && mode !== "animata" ? "pointer" : undefined, overflow: "visible" }}>
      <Defs look={look} uid={uid} />
      <g transform={look.lefty ? "translate(380 0) scale(-1 1)" : undefined}>
        <ellipse cx="150" cy="340" rx="80" ry="7" fill="#000" opacity="0.28" />
        <g transform={kid ? "translate(150 342) scale(0.8) translate(-150 -342)" : undefined}>
          <Figure look={look} def={def} t={t} flying={hideFlight ? null : flying} blink={blink} uid={uid} />
        </g>
      </g>
    </svg>
  );
}

/** Volto di fronte (per l'intestazione, il podio e le classifiche). */
export function AvatarFace({ look, className = "h-10 w-10", bare = false }: { look: AvatarLook; className?: string; /** solo la testa, senza sfondo né spalle: per il ritratto a figura intera */ bare?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
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
  const ry = look.face === "tondo" ? 22 : look.face === "allungato" ? 25.5 : 23.5;
  const fy = kid ? 52 : 50;
  const faceD = look.face === "squadrato"
    ? `M${50 - rx} ${fy - 6} C${50 - rx} ${fy - ry - 4} ${50 + rx} ${fy - ry - 4} ${50 + rx} ${fy - 6} L${50 + rx - 2} ${fy + 10} C${50 + rx - 6} ${fy + ry - 2} ${50 - rx + 6} ${fy + ry - 2} ${50 - rx + 2} ${fy + 10} Z`
    : `M50 ${fy - ry} C${50 + rx * 1.3} ${fy - ry} ${50 + rx * 1.1} ${fy + ry * 0.95} 50 ${fy + ry} C${50 - rx * 1.1} ${fy + ry * 0.95} ${50 - rx * 1.3} ${fy - ry} 50 ${fy - ry} Z`;
  const e = look.expression;
  const eyeY = fy - 2;
  const lip = shade(skin, -0.5);
  const mouth =
    e === "sorriso" ? <path d={`M42 ${fy + 12} Q50 ${fy + 19} 58 ${fy + 12} Q50 ${fy + 15} 42 ${fy + 12} Z`} fill="#7a2f2a" /> :
    e === "deciso" ? <path d={`M43 ${fy + 14} Q50 ${fy + 12} 57 ${fy + 14}`} stroke={lip} strokeWidth="1.6" fill="none" strokeLinecap="round" /> :
    e === "concentrato" ? <path d={`M44 ${fy + 13.5} H56`} stroke={lip} strokeWidth="1.5" strokeLinecap="round" /> :
    <path d={`M43 ${fy + 12.5} Q50 ${fy + 16.5} 57 ${fy + 12.5}`} stroke={lip} strokeWidth="1.6" fill="none" strokeLinecap="round" />;
  const brow = (x: number, dir: 1 | -1) => {
    const tilt = e === "deciso" ? 2 : e === "concentrato" ? 1 : 0;
    const inner = dir === 1 ? x + 6 : x - 6;
    const outer = dir === 1 ? x - 6 : x + 6;
    return <path key={`b${x}`} d={`M${outer} ${eyeY - 8} Q${x} ${eyeY - 11} ${inner} ${eyeY - 8 + tilt}`} stroke={shade(hair, -0.15)} strokeWidth={look.brows === "folte" ? 3 : look.brows === "sottili" ? 1.2 : 2} strokeLinecap="round" fill="none" />;
  };
  const eye = (x: number) => (
    <g key={x}>
      <ellipse cx={x} cy={eyeY} rx="5.4" ry={e === "concentrato" ? 3.2 : 4.4} fill="#fbf7f2" />
      <circle cx={x + 0.3} cy={eyeY + 0.2} r="3.2" fill={look.eyes} />
      <circle cx={x + 0.3} cy={eyeY + 0.2} r="1.5" fill="#120c08" />
      <circle cx={x + 1.4} cy={eyeY - 1} r="1" fill="#fff" />
      <path d={`M${x - 5.6} ${eyeY - 0.6} Q${x} ${eyeY - (e === "concentrato" ? 4 : 5.4)} ${x + 5.6} ${eyeY - 0.6}`} stroke="#2a1d14" strokeWidth={woman ? 1.6 : 1.1} fill="none" />
    </g>
  );
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
  hairBack["coda-alta"] = <path d={`M52 ${fy - ry - 6} C70 ${fy - ry - 18} 84 ${fy - ry} 78 ${fy + 8} C74 ${fy - 6} 66 ${fy - ry - 4} 52 ${fy - ry - 2} Z`} fill={fillH} />;
  hairBack.trecce = (
    <g fill={fillH}>
      {[0, 1, 2, 3, 4].map((i) => <ellipse key={`l${i}`} cx={50 - rx - 2} cy={fy + 4 + i * 8} rx={4.6 - i * 0.3} ry="5" stroke={shade(hair, -0.4)} strokeWidth="0.6" />)}
      {[0, 1, 2, 3, 4].map((i) => <ellipse key={`r${i}`} cx={50 + rx + 2} cy={fy + 4 + i * 8} rx={4.6 - i * 0.3} ry="5" stroke={shade(hair, -0.4)} strokeWidth="0.6" />)}
    </g>
  );
  const strands = ["calvo", "rasati", "afro", "ricci", "undercut", "vichinga", "dread"].includes(look.hair) || capOn || ["bandana", "tesa", "robin", "cuffia"].includes(look.hat) ? null : (
    <g fill="none" strokeLinecap="round">
      <path d={`M${50 - rx + 4} ${fy - ry + 2} Q50 ${fy - ry - 8} ${50 + rx - 4} ${fy - ry + 2}`} stroke={shade(hair, 0.4)} strokeOpacity="0.55" strokeWidth="1.6" />
      <path d={`M${50 - rx + 2} ${fy - 6} Q${50 - rx / 2} ${fy - ry} 46 ${fy - ry - 4} M54 ${fy - ry - 4} Q${50 + rx / 2} ${fy - ry} ${50 + rx - 2} ${fy - 6}`} stroke={shade(hair, -0.4)} strokeOpacity="0.5" strokeWidth="0.9" />
    </g>
  );
  const top = (() => {
    switch (look.hair) {
      case "calvo":
        return null;
      case "rasati":
        return <path d={`M${50 - rx} ${fy - 6} C${50 - rx} ${fy - ry - 6} ${50 + rx} ${fy - ry - 6} ${50 + rx} ${fy - 6} C${50 + rx - 6} ${fy - ry + 4} ${50 - rx + 6} ${fy - ry + 4} ${50 - rx} ${fy - 6} Z`} fill={hair} opacity="0.55" />;
      case "cresta":
        return <path d={`M42 ${fy - ry + 4} L44 ${fy - ry - 14} L48 ${fy - ry - 4} L50 ${fy - ry - 18} L53 ${fy - ry - 4} L56 ${fy - ry - 14} L58 ${fy - ry + 4} Z`} fill={fillH} />;
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
            {[-12, -4, 4, 12].map((dx) => <path key={dx} d={`M${50 + dx} ${fy - ry - 2} l${dx > 0 ? 1 : -1} 9`} stroke={shade(hair, -0.4)} strokeWidth="1.6" strokeLinecap="round" />)}
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
  const beard = beardShape ? <g transform={look.beard === "barbetta" || look.beard === "basette" ? undefined : `translate(0 ${fy + 6}) scale(1 ${bk.toFixed(3)}) translate(0 ${-(fy + 6)})`}>{beardShape}</g> : null;
  const st = stacheOf(look);
  const stache =
    st === "sottili" ? <path d={`M44 ${fy + 10.6} C47 ${fy + 9} 53 ${fy + 9} 56 ${fy + 10.6} C53 ${fy + 10.2} 47 ${fy + 10.2} 44 ${fy + 10.6} Z`} fill={beardC} /> :
    st === "classici" ? <path d={`M42 ${fy + 10.5} C46 ${fy + 7} 54 ${fy + 7} 58 ${fy + 10.5} C54 ${fy + 9.6} 46 ${fy + 9.6} 42 ${fy + 10.5} Z`} fill={beardC} /> :
    st === "folti" ? <path d={`M40 ${fy + 11.5} C44 ${fy + 5.6} 56 ${fy + 5.6} 60 ${fy + 11.5} C56 ${fy + 12.4} 52 ${fy + 10.6} 50 ${fy + 10.6} C48 ${fy + 10.6} 44 ${fy + 12.4} 40 ${fy + 11.5} Z`} fill={beardC} /> :
    st === "manubrio" ? <g fill="none" stroke={beardC} strokeLinecap="round"><path d={`M50 ${fy + 8.6} C46 ${fy + 8} 42 ${fy + 10} 40 ${fy + 8.6} C38.6 ${fy + 7.6} 38.8 ${fy + 5.6} 40.4 ${fy + 5.6} M50 ${fy + 8.6} C54 ${fy + 8} 58 ${fy + 10} 60 ${fy + 8.6} C61.4 ${fy + 7.6} 61.2 ${fy + 5.6} 59.6 ${fy + 5.6}`} strokeWidth="2.2" /></g> :
    st === "ferro" ? <g fill="none" stroke={beardC} strokeLinecap="round"><path d={`M43 ${fy + 9.6} Q50 ${fy + 6.4} 57 ${fy + 9.6}`} strokeWidth="2.6" /><path d={`M43 ${fy + 9.6} L42.6 ${fy + 22} M57 ${fy + 9.6} L57.4 ${fy + 22}`} strokeWidth="2.6" /></g> : null;
  const nk2 = 0.62 + (tune(look.noseSize, 50, 0, 100) / 100) * 0.76;
  const nw = (look.nose === "largo" || look.nose === "patata" ? 5.4 : look.nose === "piccolo" ? 3.2 : 4.2) * nk2;
  const ny = eyeY + 3 + 8.4 * nk2;
  const noseNode = (
    <g>
      <path d={`M51.2 ${eyeY + 2} Q${50 + nw * 0.7} ${ny - 4} ${50 + nw * 0.8} ${ny - 0.6}`} stroke={shade(skin, -0.28)} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.7" />
      {look.nose === "aquilino" ? <path d={`M50.2 ${eyeY + 4} q1.4 ${3 * nk2} 0 ${5 * nk2}`} stroke={shade(skin, -0.3)} strokeWidth="0.8" fill="none" /> : null}
      <ellipse cx="50" cy={ny - 1.2} rx={nw * (look.nose === "patata" ? 0.62 : 0.45)} ry={look.nose === "patata" ? 2.6 : 1.9} fill={shade(skin, 0.1)} />
      <ellipse cx="50.4" cy={ny - 2} rx={nw * 0.18} ry="0.8" fill="#fff" opacity="0.4" />
      <ellipse cx={50 - nw * 0.42} cy={ny + 0.4} rx={0.9 * nk2 + 0.3} ry="0.8" fill={shade(skin, -0.5)} opacity="0.7" />
      <ellipse cx={50 + nw * 0.42} cy={ny + 0.4} rx={0.9 * nk2 + 0.3} ry="0.8" fill={shade(skin, -0.5)} opacity="0.7" />
      <path d={`M${50 - nw} ${ny - 0.6} Q${50 - nw * 0.6} ${ny + 1.6} 50 ${ny + 1.2} Q${50 + nw * 0.6} ${ny + 1.6} ${50 + nw} ${ny - 0.6}`} stroke={shade(skin, -0.32)} strokeWidth="1" fill="none" strokeLinecap="round" />
    </g>
  );
  const hv = 0.88 + (tune(look.hairVolume, 50, 0, 100) / 100) * 0.24;
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
        <radialGradient id={`${uid}f`} cx="45%" cy="38%" r="70%">
          <stop offset="0" stopColor={shade(skin, 0.12)} />
          <stop offset="1" stopColor={shade(skin, -0.16)} />
        </radialGradient>
        <linearGradient id={`${uid}h`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={shade(hair, 0.2)} />
          <stop offset="1" stopColor={shade(hair, -0.38)} />
        </linearGradient>
        <clipPath id={`${uid}c`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={bare ? undefined : `url(#${uid}c)`}>
        {bare ? null : look.faceBgStyle === "tinta" ? <rect width="100" height="100" fill={bgBase} /> : look.faceBgStyle === "scena" ? <rect width="100" height="100" fill={`url(#${uid}sc)`} /> : <rect width="100" height="100" fill={`url(#${uid}bg)`} />}
        {!bare && look.faceBgStyle === "bersaglio" ? (
          <g opacity="0.55">
            {["#f4f1ea", "#1d2126", "#2f7fd1", "#d63a2f", "#f2c94c"].map((c, i) => <circle key={c} cx="50" cy="50" r={50 - i * 10} fill={c} />)}
          </g>
        ) : null}
        {look.cape && !bare ? <path d="M10 100 C14 82 30 74 50 74 C70 74 86 82 90 100 Z" fill={shade(look.capeColor, -0.1)} /> : null}
        {capOn ? <path d={look.hat === "elmo" ? "M18 100 C16 60 26 22 50 20 C74 22 84 60 82 100 Z" : `M14 100 C10 58 22 ${fy - ry - 14} 50 ${fy - ry - 16} C78 ${fy - ry - 14} 90 58 86 100 Z`} fill={look.hat === "elmo" ? "#9aa3ad" : shade(look.hatColor, -0.35)} /> : null}
        {!capOn && hairBack[look.hair] ? <g transform={`translate(0 ${fy - 6}) scale(1 ${(0.5 + tune(look.hairLength, 50, 0, 100) / 100).toFixed(3)}) translate(0 ${-(fy - 6)})`}>{hairBack[look.hair]}</g> : null}
        {bare ? null : <path d="M22 100 C24 84 36 78 50 78 C64 78 76 84 78 100 Z" fill={look.shirt} />}
        {bare ? null : <path d="M42 78 L50 88 L58 78" stroke={look.trim} strokeWidth="3" fill="none" />}
        <rect x="43" y={fy + 14} width="14" height="16" fill={skinD} />
        {capOn ? null : <ellipse cx={50 - rx - 1} cy={eyeY + 4} rx="3.5" ry="5" fill={skinD} />}
        {capOn ? null : <ellipse cx={50 + rx + 1} cy={eyeY + 4} rx="3.5" ry="5" fill={skinD} />}
        {look.earring ? <circle cx={50 - rx - 1} cy={eyeY + 10} r="1.6" fill="#d9b45a" /> : null}
        <path d={faceD} fill={`url(#${uid}f)`} />
        <ellipse cx="38" cy={fy + 7} rx="4.5" ry="2.6" fill="#e0726b" opacity="0.22" />
        <ellipse cx="62" cy={fy + 7} rx="4.5" ry="2.6" fill="#e0726b" opacity="0.22" />
        {look.freckles ? <g fill={shade(skin, -0.42)} opacity="0.6">{[[36, 54], [39, 56], [42, 53], [58, 53], [61, 56], [64, 54]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y + (fy - 50)} r="0.8" />)}</g> : null}
        {eye(41)}
        {eye(59)}
        {brow(41, 1)}
        {brow(59, -1)}
        {noseNode}
        {look.mask ? null : beard}
        {look.mask ? null : stache}
        {look.mask ? null : mouth}
        <g transform={`translate(50 ${fy - ry + 4}) scale(${hv.toFixed(3)}) translate(-50 ${-(fy - ry + 4)})`}>
          {!capOn ? top : null}
          {strands}
        </g>
        {look.hairFeather && !capOn ? <g transform={`translate(${50 + rx + 2} ${fy - 4}) rotate(18)`}><path d="M0 0 C3 -5 4 -14 1 -22 C-2 -15 -3 -6 0 0 Z" fill="#f4f1ea" stroke="#b9ae98" strokeWidth="0.5" /><path d="M1 -22 l1 -3" stroke="#c4473d" strokeWidth="1.4" strokeLinecap="round" /></g> : null}
        {look.hat === "cappuccio" ? (
          <g>
            {/* il cappuccio avvolge tutta la testa: sopra e ai lati non si vede più il cranio */}
            <path d={`M${50 - rx - 9} ${fy + 26} C${50 - rx - 13} ${fy - ry - 30} ${50 + rx + 13} ${fy - ry - 30} ${50 + rx + 9} ${fy + 26} C${50 + rx + 3} ${fy + 2} ${50 + rx + 2} ${fy - ry + 2} 50 ${fy - ry + 1} C${50 - rx - 2} ${fy - ry + 2} ${50 - rx - 3} ${fy + 2} ${50 - rx - 9} ${fy + 26} Z`} fill={shade(look.hatColor, -0.1)} stroke="#1b130d" strokeOpacity="0.35" strokeWidth="1" />
            <path d={`M${50 + rx + 3} ${fy + 6} C${50 + rx + 2} ${fy - ry + 2} ${50 - rx - 2} ${fy - ry + 2} ${50 - rx - 3} ${fy + 6}`} stroke={shade(look.hatColor, -0.5)} strokeWidth="3" fill="none" opacity="0.55" />
            <path d={`M50 ${fy - ry - 16} C54 ${fy - ry - 6} 54 ${fy - ry - 2} 52 ${fy - ry + 1}`} stroke={shade(look.hatColor, 0.25)} strokeWidth="1" fill="none" opacity="0.6" />
          </g>
        ) : null}
        <g transform={`rotate(${tune(look.hatRot, 0, -180, 180)} 50 ${fy - ry})`}>
        {look.hat === "berretto" ? <g><path d={`M${50 - rx - 3} ${fy - 8} C${50 - rx - 3} ${fy - ry - 14} ${50 + rx + 3} ${fy - ry - 14} ${50 + rx + 3} ${fy - 8} Z`} fill={look.hatColor} /><path d={`M30 ${fy - 8} Q50 ${fy - 2} 74 ${fy - 8} L76 ${fy - 4} Q50 ${fy + 2} 28 ${fy - 4} Z`} fill={shade(look.hatColor, -0.3)} /></g> : null}
        {look.hat === "fascia" ? <path d={`M${50 - rx - 1} ${fy - 13} Q50 ${fy - 19} ${50 + rx + 1} ${fy - 13} L${50 + rx + 1} ${fy - 8} Q50 ${fy - 14} ${50 - rx - 1} ${fy - 8} Z`} fill={look.hatColor} /> : null}
        {look.hat === "piuma" ? <g><path d={`M${50 - rx - 6} ${fy - 10} C${50 - rx} ${fy - ry - 16} ${50 + rx} ${fy - ry - 16} ${50 + rx + 6} ${fy - 10} Z`} fill={look.hatColor} /><path d={`M${50 + rx - 2} ${fy - 16} C${50 + rx + 8} ${fy - 30} ${50 + rx + 16} ${fy - 34} 92 ${fy - 36} C${50 + rx + 12} ${fy - 26} ${50 + rx + 6} ${fy - 18} ${50 + rx} ${fy - 12} Z`} fill="#f4f1ea" /></g> : null}
        {look.hat === "elmo" ? <g><path d={`M${50 - rx - 3} ${fy - 6} C${50 - rx - 3} ${fy - ry - 12} ${50 + rx + 3} ${fy - ry - 12} ${50 + rx + 3} ${fy - 6} Z`} fill="#9aa3ad" /><rect x="48" y={fy - 8} width="4" height="16" fill="#7d8690" /></g> : null}
        {look.hat === "bandana" ? <g><path d={`M${50 - rx - 2} ${fy - 8} C${50 - rx - 3} ${fy - ry - 12} ${50 + rx + 3} ${fy - ry - 12} ${50 + rx + 2} ${fy - 8} Q50 ${fy - 14} ${50 - rx - 2} ${fy - 8} Z`} fill={look.hatColor} />{[38, 50, 62].map((x) => <circle key={x} cx={x} cy={fy - ry - 2} r="1.4" fill="#f4f1ea" opacity="0.7" />)}</g> : null}
        {look.hat === "robin" ? <g><path d={`M${50 - rx - 6} ${fy - 8} C${50 - rx} ${fy - ry - 10} 60 ${fy - ry - 22} 86 ${fy - ry - 26} C74 ${fy - ry - 10} ${50 + rx + 4} ${fy - ry - 2} ${50 + rx + 6} ${fy - 8} Z`} fill={look.hatColor} /><path d={`M60 ${fy - ry - 6} C70 ${fy - ry - 22} 80 ${fy - ry - 30} 90 ${fy - ry - 34} C82 ${fy - ry - 22} 72 ${fy - ry - 12} 64 ${fy - ry - 2} Z`} fill="#c4473d" /></g> : null}
        {look.hat === "tesa" ? <g><ellipse cx="50" cy={fy - 10} rx="44" ry="8" fill={shade(look.hatColor, -0.15)} /><path d={`M${50 - rx} ${fy - 10} C${50 - rx} ${fy - ry - 16} ${50 + rx} ${fy - ry - 16} ${50 + rx} ${fy - 10} Z`} fill={look.hatColor} /><path d={`M${50 - rx} ${fy - 15} H${50 + rx}`} stroke={shade(look.hatColor, -0.45)} strokeWidth="3" /></g> : null}
        {look.hat === "cuffia" ? <g><path d={`M${50 - rx - 3} ${fy - 6} C${50 - rx - 3} ${fy - ry - 18} ${50 + rx + 3} ${fy - ry - 18} ${50 + rx + 3} ${fy - 6} Z`} fill={look.hatColor} />{[-12, -6, 0, 6, 12].map((dx) => <path key={dx} d={`M${50 + dx} ${fy - ry - 8} L${50 + dx * 1.2} ${fy - 8}`} stroke={shade(look.hatColor, -0.3)} strokeWidth="0.8" />)}<rect x={50 - rx - 4} y={fy - 12} width={rx * 2 + 8} height="7" rx="2.5" fill={shade(look.hatColor, -0.18)} /><circle cx="50" cy={fy - ry - 16} r="5.5" fill={look.trim} /></g> : null}
        {look.hat === "alloro" ? <g>{Array.from({ length: 10 }, (_, i) => { const a = Math.PI * (0.15 + (i / 9) * 0.7); const x = 50 - Math.cos(a) * (rx + 1); const y = fy - 10 - Math.sin(a) * 9; return <ellipse key={i} cx={x} cy={y} rx="1.8" ry="3.6" fill={i % 2 ? "#6f9a3a" : "#4f7a2a"} transform={`rotate(${(i - 4.5) * 14} ${x} ${y})`} />; })}</g> : null}
        {look.hat === "cerchietto" ? <g><path d={`M${50 - rx} ${fy - 14} Q50 ${fy - 20} ${50 + rx} ${fy - 14}`} stroke={look.hatColor} strokeWidth="2.2" fill="none" /><path d={`M50 ${fy - 22} l3 3 l-3 3 l-3 -3 z`} fill="#3fae6a" stroke={look.hatColor} strokeWidth="0.8" /></g> : null}
        </g>
        {look.warpaint ? <g stroke="#2a3a5a" strokeOpacity="0.75" strokeWidth="2.2" strokeLinecap="round"><path d={`M30 ${fy + 2} L40 ${fy + 4} M60 ${fy + 4} L70 ${fy + 2} M31 ${fy + 7} L39 ${fy + 9} M61 ${fy + 9} L69 ${fy + 7}`} /></g> : null}
        {look.scar ? <path d={`M56 ${eyeY - 12} L62 ${eyeY + 10} M57 ${eyeY - 6} l3 -1 M59 ${eyeY + 3} l3 -1`} stroke={shade(skin, -0.42)} strokeWidth="1.2" strokeLinecap="round" /> : null}
        {look.mask ? <path d={`M${50 - rx} ${fy + 3} Q50 ${fy} ${50 + rx} ${fy + 3} C${50 + rx} ${fy + ry} ${50 - rx} ${fy + ry} ${50 - rx} ${fy + 3} Z`} fill={look.cowlColor} /> : null}
        {look.cowl && !bare ? <path d={`M18 100 C18 84 28 ${fy + 22} 50 ${fy + 24} C72 ${fy + 22} 82 84 82 100 Z`} fill={look.cowlColor} stroke={shade(look.cowlColor, -0.35)} strokeWidth="1" /> : null}
        {look.fur && !bare ? <g fill={look.furColor}>{[14, 24, 34, 66, 76, 86].map((x, i) => <circle key={x} cx={x} cy={90 + (i % 2) * 3} r="8" />)}</g> : null}
        {look.sunglasses ? <g><path d={`M33 ${eyeY - 4} H48 C48 ${eyeY + 4} 45 ${eyeY + 6} 40.5 ${eyeY + 6} C36 ${eyeY + 6} 33 ${eyeY + 4} 33 ${eyeY - 4} Z M52 ${eyeY - 4} H67 C67 ${eyeY + 4} 64 ${eyeY + 6} 59.5 ${eyeY + 6} C55 ${eyeY + 6} 52 ${eyeY + 4} 52 ${eyeY - 4} Z`} fill="#14181c" /><path d={`M48 ${eyeY - 2.6} H52 M33 ${eyeY - 3} H28 M67 ${eyeY - 3} H72`} stroke="#14181c" strokeWidth="1.4" /><path d={`M35.5 ${eyeY - 2} l4 0 M54.5 ${eyeY - 2} l4 0`} stroke="#fff" strokeOpacity="0.4" strokeWidth="1" /></g> : null}
        {look.glasses && !look.sunglasses ? <g fill="#a8d8ff" fillOpacity="0.15" stroke="#1d2126" strokeWidth="1.4"><circle cx="41" cy={eyeY} r="6.6" /><circle cx="59" cy={eyeY} r="6.6" /><path d={`M47.6 ${eyeY} H52.4`} /></g> : null}
        {look.necklace && !bare ? <path d="M40 84 Q50 94 60 84" stroke="#d9b45a" strokeWidth="1.2" fill="none" /> : null}
        {look.amulet && !bare ? <g><path d="M41 82 Q50 96 59 82" stroke="#c9a46a" strokeWidth="0.9" fill="none" /><path d="M50 91 l3.4 4.4 l-3.4 4.4 l-3.4 -4.4 Z" fill="#d9b45a" /><circle cx="50" cy="95.4" r="1.3" fill="#2f9e7a" /></g> : null}
      </g>
    </svg>
  );
}
