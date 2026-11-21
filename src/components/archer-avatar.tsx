import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { AvatarLook, Pose } from "@/lib/arcieri/avatar";
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
};

const ANCHOR = p(166, 106);
const POSES: Record<string, PoseDef> = {
  riposo: { grip: p(186, 214), bowAngle: 6, hand: p(118, 210), pull: 0, hooked: false, arrow: false, fore: 46 },
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
  rilassa: { grip: p(214, 186), bowAngle: 22, hand: p(122, 196), pull: 0, hooked: false, arrow: false, fore: 50 },
  vittoria: { grip: p(206, 34), bowAngle: -12, hand: p(104, 52), pull: 0, hooked: false, arrow: false, fore: 46, face: "felice" },
  fiero: { grip: p(192, 204), bowAngle: 2, hand: p(116, 186), pull: 0, hooked: false, arrow: false, fore: 40, face: "sorriso" },
  saluto: { grip: p(194, 208), bowAngle: 4, hand: p(150, 150), pull: 0, hooked: false, arrow: false, fore: 40, face: "sorriso" },
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
  const longSleeves = ["felpa", "giacca", "tunica", "tunica-lunga", "farsetto", "ranger", "incrociata", "cappotto", "giubba", "cappotto-lungo"].includes(look.top);
  const medievalTop = ["tunica", "tunica-lunga", "farsetto", "ranger", "incrociata", "cappotto", "giubba", "cappotto-lungo"].includes(look.top);
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
  const drawArm = ik(SD, handTarget, 40, def.fore, -1);
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
  const TUNIC: Record<string, number> = { tunica: 252, "tunica-lunga": 266, ranger: 262, incrociata: 250, cappotto: 258, "cappotto-lungo": 292, giubba: 230 };
  const tunicLen = TUNIC[look.top] ?? 214;
  const longTunic = look.top in TUNIC;

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
    if (look.footwear === "stivali" || look.footwear === "stivali-risvolto" || look.footwear === "stivali-alti") {
      const top = look.footwear === "stivali-risvolto" ? 54 : look.footwear === "stivali-alti" ? 64 : 46;
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
    const shorts = look.bottom === "pantaloncini";
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
    const sleeve = look.top === "gilet" || look.top === "corpetto" ? look.sleeves || look.trim : look.top === "giubba" ? look.sleeves || "#c9b48a" : look.sleeves || shirt;
    const upW = 15 * W;
    const foreW = 11 * W;
    return (
      <g>
        {limb(s, e, upW, sleeve)}
        {sleeveLong ? limb(e, lerpP(e, h, 0.86), foreW + 1.5, sleeve) : limb(e, h, foreW, skin)}
        {sleeveLong ? limb(lerpP(e, h, 0.86), h, foreW - 1, skin) : null}
        {medievalTop ? <circle cx={f(lerp(e.x, h.x, 0.84))} cy={f(lerp(e.y, h.y, 0.84))} r={6.5 * W} fill={look.trim} /> : null}
        {!sleeveLong ? <circle cx={f(lerp(s.x, e.x, 0.6))} cy={f(lerp(s.y, e.y, 0.6))} r={upW / 2 + 0.4} fill={shade(sleeve, -0.15)} /> : null}
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
  const bow = (
    <g transform={`translate(${f(grip.x)} ${f(grip.y)}) rotate(${f(def.bowAngle)})`}>
      {[1, -1].map((s) => (
        <path key={s} d={limbPath(s as 1 | -1)} stroke={limbStroke} strokeWidth={g.width} strokeLinecap="round" fill="none" />
      ))}
      {[1, -1].map((s) => (
        <path key={`h${s}`} d={limbPath(s as 1 | -1)} stroke="#fff" strokeOpacity="0.18" strokeWidth={1.2} strokeLinecap="round" fill="none" transform="translate(1 0)" />
      ))}
      {g.siyah ? (
        <>
          <rect x="-3" y={f(-g.tipY * 0.62)} width="9" height="5" rx="1" fill="#c9a46a" transform="rotate(-8)" />
          <rect x="-3" y={f(g.tipY * 0.62 - 5)} width="9" height="5" rx="1" fill="#c9a46a" transform="rotate(8)" />
        </>
      ) : null}
      {g.cams ? (
        <g>
          <circle cx={f(g.tipX)} cy={f(-g.tipY)} r="7.5" fill="#b7c0c8" stroke="#2a2f35" />
          <circle cx={f(g.tipX)} cy={f(g.tipY)} r="7.5" fill="#b7c0c8" stroke="#2a2f35" />
          <path d={`M${f(g.tipX + 3)} ${f(-g.tipY)} L${f(g.tipX + 5)} ${f(g.tipY)}`} stroke="#9aa3ad" strokeWidth="0.8" />
        </g>
      ) : null}
      {g.riser > 0 ? <rect x="-4" y={f(-g.riser)} width="10" height={f(g.riser * 2)} rx="4" fill={riserFill} /> : <rect x="-3" y="-11" width="8" height="22" rx="3" fill="#3a2a1e" />}
      {g.riser > 0 && g.wood ? <rect x="-4" y="-9" width="10" height="18" rx="3" fill="#3a2414" opacity="0.6" /> : null}
      {look.bowType === "olimpico" ? (
        <g>
          <path d="M6 22 L58 24" stroke="#1d2126" strokeWidth="3" strokeLinecap="round" />
          <rect x="54" y="19" width="9" height="10" rx="2" fill="#2a2f35" />
          <path d="M6 -24 L22 -36 L22 -50" stroke="#9aa3ad" strokeWidth="1.6" fill="none" />
          <circle cx="22" cy="-52" r="3" fill="none" stroke="#e3a21a" strokeWidth="1.6" />
        </g>
      ) : null}
      {look.bowType === "compound" ? (
        <g>
          <path d="M6 18 L52 20" stroke="#1d2126" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="20" cy="-22" r="6" fill="none" stroke="#e3a21a" strokeWidth="2" />
        </g>
      ) : null}
      {look.bowType === "nudo" ? <rect x="2" y="26" width="7" height="6" rx="1.5" fill="#9aa3ad" /> : null}
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
    const tr = place === "schiena" ? "translate(118 140) rotate(24)" : "translate(116 214) rotate(-14)";
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

      {longTunic ? <path d={`M${f(hipL + 1)} 200 L${f(hipR - 1)} 200 C${f(hipR + 4)} 224 ${f(hipR + 10)} ${tunicLen - 18} ${f(hipR + 12)} ${tunicLen} Q${f(cx)} ${tunicLen + 5} ${f(hipL - 12)} ${tunicLen} C${f(hipL - 10)} ${tunicLen - 18} ${f(hipL - 4)} 224 ${f(hipL + 1)} 200 Z`} fill={`url(#${uid}shirt)`} stroke={OUT} strokeOpacity="0.5" strokeWidth="2.2" /> : null}
      <path d={torso} fill={`url(#${uid}shirt)`} stroke={OUT} strokeOpacity="0.5" strokeWidth="2.2" />
      <Outfit look={look} cx={cx} shoulderL={shoulderL} shoulderR={shoulderR} hipL={hipL} hipR={hipR} tunicLen={tunicLen} W={W} woman={woman} />
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
  return node ? <g transform={tr}>{node}</g> : null;
}

/** Testa di profilo verso il bersaglio, con espressione. */
function Head({ look, H, face, blink, uid, t }: { look: AvatarLook; H: P; face: string; blink: boolean; uid: string; t: number }) {
  const skin = look.skin;
  const skinD = shade(skin, -0.22);
  const hair = look.hairColor;
  const woman = look.body === "donna" || look.body === "ragazza";
  const dy = H.y - 86;
  const chinY = look.face === "allungato" ? 114 : look.face === "tondo" ? 108 : 111;
  const jaw = look.face === "squadrato" ? `C171 ${chinY - 2} 168 ${chinY + 1} 160 ${chinY + 1} L148 ${chinY - 2}` : look.face === "tondo" ? `C172 ${chinY} 166 ${chinY + 3} 158 ${chinY + 2} C152 ${chinY + 1} 148 ${chinY - 2} 146 ${chinY - 4}` : `C171 ${chinY} 168 ${chinY + 2} 162 ${chinY + 2} C156 ${chinY + 2} 150 ${chinY - 1} 146 ${chinY - 4}`;
  const nose = look.nose === "aquilino" ? "C176 84 178 88 180 94 C178 96 176 96.5 173 96.5" : look.nose === "largo" ? "C175 86 178 90 179.5 94 C178.5 97 175 97.5 172.5 97" : look.nose === "piccolo" ? "C174 87 175.5 90 176.5 93.5 C175.5 95 174 95.5 172.5 95.5" : "C175 86 177 90 178.5 94 C177 95.6 175 96 173 96";
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
      <ellipse cx="141" cy="88" rx="4.4" ry="6.6" fill={skinD} />
      <path d="M141 84 Q138 88 141 92" stroke={shade(skin, -0.38)} strokeWidth="0.9" fill="none" />
      {look.earring ? <circle cx="141.5" cy="96" r="1.8" fill="#d9b45a" stroke="#8a6a20" strokeWidth="0.5" /> : null}
      <ellipse cx="163" cy="93" rx="5" ry="3" fill="#e0726b" opacity="0.22" />
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
      <HairFront look={look} uid={uid} t={t} />
      <Hat look={look} />
      {look.glasses ? (
        <g fill="none" stroke="#1d2126" strokeWidth="1.3">
          <circle cx="163.6" cy="82.4" r="5.6" fill="#a8d8ff" fillOpacity="0.16" />
          <path d="M158 82.4 L143 84" />
        </g>
      ) : null}
    </g>
  );
}

function Beard({ look }: { look: AvatarLook }) {
  const c = shade(look.hairColor, -0.08);
  switch (look.beard) {
    case "piena":
    case "accenno":
      return <path d="M138 93 C140 105 148 115 158 115 C166 115 172 108 173 99 C169 101.5 164 102.5 160 101.5 L153 98.5 C148 98.5 143 96 138 93 Z" fill={c} opacity={look.beard === "accenno" ? 0.32 : 1} />;
    case "corta":
      return (
        <g>
          <path d="M143 97 C145 107 151 112 158 112 C164.5 112 170 107 171.3 101 C167 102.6 163 103.4 159 102.6 C153 101.6 148 100 143 97 Z" fill={c} />
          <path d="M161 96.6 C164 94.8 169 94.8 173 96.6 C170 98.6 165 98.6 161 96.6 Z" fill={c} />
        </g>
      );
    case "pizzetto":
      return <path d="M160 103 C161 109 164 112 168 111 C171 109 171 105 170.2 102 C167 104 163 104 160 103 Z" fill={c} />;
    case "baffi":
      return <path d="M160.5 96.4 C164 94.2 169.5 94.4 173.4 96.6 C170 99 164.6 98.8 160.5 96.4 Z" fill={c} />;
    default:
      return null;
  }
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
          {look.hair === "coda" || look.hair === "treccia" || look.hair === "codini" ? <circle cx="133" cy="82" r="3.2" fill={look.hatColor} /> : null}
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
    const frame = (now: number) => {
      // ~50 fotogrammi al secondo: movimento fluido senza pesare sul telefono
      if (now - last > 19 && !document.hidden) {
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
      def = dt < 0.12 ? mix(POSES.mira, POSES.rilascio, dt / 0.12) : mix(POSES.rilascio, POSES.accompagna, Math.min(1, (dt - 0.12) / 0.6));
      def = { ...def, grip: p(def.grip.x, def.grip.y - lift) };
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
    <svg viewBox="40 0 300 350" className={className} role="img" aria-label="Il tuo arciere" onClick={tap} style={{ cursor: interactive && mode !== "animata" ? "pointer" : undefined, overflow: "visible" }}>
      <Defs look={look} uid={uid} />
      <ellipse cx="150" cy="340" rx="80" ry="7" fill="#000" opacity="0.28" />
      <g transform={kid ? "translate(150 342) scale(0.8) translate(-150 -342)" : undefined}>
        <Figure look={look} def={def} t={t} flying={hideFlight ? null : flying} blink={blink} uid={uid} />
      </g>
    </svg>
  );
}

/** Volto di fronte (per l'intestazione, il podio e le classifiche). */
export function AvatarFace({ look, className = "h-10 w-10" }: { look: AvatarLook; className?: string }) {
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
  hairBack.trecce = (
    <g fill={fillH}>
      {[0, 1, 2, 3, 4].map((i) => <ellipse key={`l${i}`} cx={50 - rx - 2} cy={fy + 4 + i * 8} rx={4.6 - i * 0.3} ry="5" stroke={shade(hair, -0.4)} strokeWidth="0.6" />)}
      {[0, 1, 2, 3, 4].map((i) => <ellipse key={`r${i}`} cx={50 + rx + 2} cy={fy + 4 + i * 8} rx={4.6 - i * 0.3} ry="5" stroke={shade(hair, -0.4)} strokeWidth="0.6" />)}
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
  const beardC = shade(hair, -0.08);
  const beard =
    look.beard === "piena" || look.beard === "accenno" ? <path d={`M${50 - rx + 1} ${fy + 2} C${50 - rx + 2} ${fy + ry + 8} ${50 + rx - 2} ${fy + ry + 8} ${50 + rx - 1} ${fy + 2} C${50 + rx - 6} ${fy + 12} 58 ${fy + 9} 50 ${fy + 10} C42 ${fy + 9} ${50 - rx + 6} ${fy + 12} ${50 - rx + 1} ${fy + 2} Z`} fill={beardC} opacity={look.beard === "accenno" ? 0.32 : 1} /> :
    look.beard === "corta" ? <path d={`M${50 - rx + 4} ${fy + 8} C${50 - rx + 6} ${fy + ry + 4} ${50 + rx - 6} ${fy + ry + 4} ${50 + rx - 4} ${fy + 8} C${50 + rx - 8} ${fy + 14} 58 ${fy + 11} 50 ${fy + 11} C42 ${fy + 11} ${50 - rx + 8} ${fy + 14} ${50 - rx + 4} ${fy + 8} Z`} fill={beardC} /> :
    look.beard === "pizzetto" ? <path d={`M45 ${fy + 17} C46 ${fy + 25} 54 ${fy + 25} 55 ${fy + 17} C52 ${fy + 19} 48 ${fy + 19} 45 ${fy + 17} Z`} fill={beardC} /> : null;
  const stache = look.beard === "piena" || look.beard === "corta" || look.beard === "baffi" ? <path d={`M42 ${fy + 10.5} C46 ${fy + 7} 54 ${fy + 7} 58 ${fy + 10.5} C54 ${fy + 9.6} 46 ${fy + 9.6} 42 ${fy + 10.5} Z`} fill={beardC} /> : null;
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Volto dell'arciere">
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
      <g clipPath={`url(#${uid}c)`}>
        {look.faceBgStyle === "tinta" ? <rect width="100" height="100" fill={bgBase} /> : look.faceBgStyle === "scena" ? <rect width="100" height="100" fill={`url(#${uid}sc)`} /> : <rect width="100" height="100" fill={`url(#${uid}bg)`} />}
        {look.faceBgStyle === "bersaglio" ? (
          <g opacity="0.55">
            {["#f4f1ea", "#1d2126", "#2f7fd1", "#d63a2f", "#f2c94c"].map((c, i) => <circle key={c} cx="50" cy="50" r={50 - i * 10} fill={c} />)}
          </g>
        ) : null}
        {look.cape ? <path d="M10 100 C14 82 30 74 50 74 C70 74 86 82 90 100 Z" fill={shade(look.capeColor, -0.1)} /> : null}
        {capOn ? <path d="M18 100 C16 60 26 22 50 20 C74 22 84 60 82 100 Z" fill={look.hat === "elmo" ? "#9aa3ad" : look.hatColor} /> : null}
        {!capOn ? hairBack[look.hair] ?? null : null}
        <path d="M22 100 C24 84 36 78 50 78 C64 78 76 84 78 100 Z" fill={look.shirt} />
        <path d="M42 78 L50 88 L58 78" stroke={look.trim} strokeWidth="3" fill="none" />
        <rect x="43" y={fy + 14} width="14" height="16" fill={skinD} />
        <ellipse cx={50 - rx - 1} cy={eyeY + 4} rx="3.5" ry="5" fill={skinD} />
        <ellipse cx={50 + rx + 1} cy={eyeY + 4} rx="3.5" ry="5" fill={skinD} />
        {look.earring ? <circle cx={50 - rx - 1} cy={eyeY + 10} r="1.6" fill="#d9b45a" /> : null}
        <path d={faceD} fill={`url(#${uid}f)`} />
        <ellipse cx="38" cy={fy + 7} rx="4.5" ry="2.6" fill="#e0726b" opacity="0.22" />
        <ellipse cx="62" cy={fy + 7} rx="4.5" ry="2.6" fill="#e0726b" opacity="0.22" />
        {look.freckles ? <g fill={shade(skin, -0.42)} opacity="0.6">{[[36, 54], [39, 56], [42, 53], [58, 53], [61, 56], [64, 54]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y + (fy - 50)} r="0.8" />)}</g> : null}
        {eye(41)}
        {eye(59)}
        {brow(41, 1)}
        {brow(59, -1)}
        <path d={`M50 ${eyeY + 3} L${look.nose === "largo" ? 46 : 47.5} ${eyeY + 11} Q50 ${eyeY + 12.5} ${look.nose === "largo" ? 54 : 52.5} ${eyeY + 11}`} stroke={shade(skin, -0.3)} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {look.mask ? null : beard}
        {look.mask ? null : stache}
        {look.mask ? null : mouth}
        {!capOn ? top : null}
        {look.hat === "berretto" ? <g><path d={`M${50 - rx - 3} ${fy - 8} C${50 - rx - 3} ${fy - ry - 14} ${50 + rx + 3} ${fy - ry - 14} ${50 + rx + 3} ${fy - 8} Z`} fill={look.hatColor} /><path d={`M30 ${fy - 8} Q50 ${fy - 2} 74 ${fy - 8} L76 ${fy - 4} Q50 ${fy + 2} 28 ${fy - 4} Z`} fill={shade(look.hatColor, -0.3)} /></g> : null}
        {look.hat === "fascia" ? <path d={`M${50 - rx - 1} ${fy - 13} Q50 ${fy - 19} ${50 + rx + 1} ${fy - 13} L${50 + rx + 1} ${fy - 8} Q50 ${fy - 14} ${50 - rx - 1} ${fy - 8} Z`} fill={look.hatColor} /> : null}
        {look.hat === "piuma" ? <g><path d={`M${50 - rx - 6} ${fy - 10} C${50 - rx} ${fy - ry - 16} ${50 + rx} ${fy - ry - 16} ${50 + rx + 6} ${fy - 10} Z`} fill={look.hatColor} /><path d={`M${50 + rx - 2} ${fy - 16} C${50 + rx + 8} ${fy - 30} ${50 + rx + 16} ${fy - 34} 92 ${fy - 36} C${50 + rx + 12} ${fy - 26} ${50 + rx + 6} ${fy - 18} ${50 + rx} ${fy - 12} Z`} fill="#f4f1ea" /></g> : null}
        {look.hat === "cappuccio" ? <path d={`M${50 - rx - 6} ${fy + 20} C${50 - rx - 8} ${fy - ry - 4} ${50 + rx + 8} ${fy - ry - 4} ${50 + rx + 6} ${fy + 20} C${50 + rx + 2} ${fy - ry + 10} ${50 - rx - 2} ${fy - ry + 10} ${50 - rx - 6} ${fy + 20} Z`} fill={shade(look.hatColor, -0.15)} /> : null}
        {look.hat === "elmo" ? <g><path d={`M${50 - rx - 3} ${fy - 6} C${50 - rx - 3} ${fy - ry - 12} ${50 + rx + 3} ${fy - ry - 12} ${50 + rx + 3} ${fy - 6} Z`} fill="#9aa3ad" /><rect x="48" y={fy - 8} width="4" height="16" fill="#7d8690" /></g> : null}
        {look.hat === "bandana" ? <g><path d={`M${50 - rx - 2} ${fy - 8} C${50 - rx - 3} ${fy - ry - 12} ${50 + rx + 3} ${fy - ry - 12} ${50 + rx + 2} ${fy - 8} Q50 ${fy - 14} ${50 - rx - 2} ${fy - 8} Z`} fill={look.hatColor} />{[38, 50, 62].map((x) => <circle key={x} cx={x} cy={fy - ry - 2} r="1.4" fill="#f4f1ea" opacity="0.7" />)}</g> : null}
        {look.hat === "robin" ? <g><path d={`M${50 - rx - 6} ${fy - 8} C${50 - rx} ${fy - ry - 10} 60 ${fy - ry - 22} 86 ${fy - ry - 26} C74 ${fy - ry - 10} ${50 + rx + 4} ${fy - ry - 2} ${50 + rx + 6} ${fy - 8} Z`} fill={look.hatColor} /><path d={`M60 ${fy - ry - 6} C70 ${fy - ry - 22} 80 ${fy - ry - 30} 90 ${fy - ry - 34} C82 ${fy - ry - 22} 72 ${fy - ry - 12} 64 ${fy - ry - 2} Z`} fill="#c4473d" /></g> : null}
        {look.hat === "tesa" ? <g><ellipse cx="50" cy={fy - 10} rx="44" ry="8" fill={shade(look.hatColor, -0.15)} /><path d={`M${50 - rx} ${fy - 10} C${50 - rx} ${fy - ry - 16} ${50 + rx} ${fy - ry - 16} ${50 + rx} ${fy - 10} Z`} fill={look.hatColor} /><path d={`M${50 - rx} ${fy - 15} H${50 + rx}`} stroke={shade(look.hatColor, -0.45)} strokeWidth="3" /></g> : null}
        {look.hat === "cerchietto" ? <g><path d={`M${50 - rx} ${fy - 14} Q50 ${fy - 20} ${50 + rx} ${fy - 14}`} stroke={look.hatColor} strokeWidth="2.2" fill="none" /><path d={`M50 ${fy - 22} l3 3 l-3 3 l-3 -3 z`} fill="#3fae6a" stroke={look.hatColor} strokeWidth="0.8" /></g> : null}
        {look.warpaint ? <g stroke="#2a3a5a" strokeOpacity="0.75" strokeWidth="2.2" strokeLinecap="round"><path d={`M30 ${fy + 2} L40 ${fy + 4} M60 ${fy + 4} L70 ${fy + 2} M31 ${fy + 7} L39 ${fy + 9} M61 ${fy + 9} L69 ${fy + 7}`} /></g> : null}
        {look.scar ? <path d={`M56 ${eyeY - 12} L62 ${eyeY + 10} M57 ${eyeY - 6} l3 -1 M59 ${eyeY + 3} l3 -1`} stroke={shade(skin, -0.42)} strokeWidth="1.2" strokeLinecap="round" /> : null}
        {look.mask ? <path d={`M${50 - rx} ${fy + 3} Q50 ${fy} ${50 + rx} ${fy + 3} C${50 + rx} ${fy + ry} ${50 - rx} ${fy + ry} ${50 - rx} ${fy + 3} Z`} fill={look.cowlColor} /> : null}
        {look.cowl ? <path d={`M18 100 C18 84 28 ${fy + 22} 50 ${fy + 24} C72 ${fy + 22} 82 84 82 100 Z`} fill={look.cowlColor} stroke={shade(look.cowlColor, -0.35)} strokeWidth="1" /> : null}
        {look.fur ? <g fill={look.furColor}>{[14, 24, 34, 66, 76, 86].map((x, i) => <circle key={x} cx={x} cy={90 + (i % 2) * 3} r="8" />)}</g> : null}
        {look.glasses ? <g fill="#a8d8ff" fillOpacity="0.15" stroke="#1d2126" strokeWidth="1.4"><circle cx="41" cy={eyeY} r="6.6" /><circle cx="59" cy={eyeY} r="6.6" /><path d={`M47.6 ${eyeY} H52.4`} /></g> : null}
        {look.necklace ? <path d="M40 84 Q50 94 60 84" stroke="#d9b45a" strokeWidth="1.2" fill="none" /> : null}
      </g>
    </svg>
  );
}
