import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { AvatarLook, Pose } from "@/lib/arcieri/avatar";

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
};

const ANCHOR = p(166, 106);
const POSES: Record<string, PoseDef> = {
  riposo: { grip: p(186, 214), bowAngle: 6, hand: p(118, 210), pull: 0, hooked: false, arrow: false, fore: 46 },
  incocco: { grip: p(206, 176), bowAngle: -48, hand: null, pull: 0, hooked: true, arrow: true, fore: 52 },
  alzata: { grip: p(244, 128), bowAngle: 0, hand: null, pull: 0.12, hooked: true, arrow: true, fore: 66, face: "concentrato" },
  allungo: { grip: p(250, 124), bowAngle: 0, hand: null, pull: 1, hooked: true, arrow: true, fore: 82, face: "concentrato" },
  rilascio: { grip: p(250, 124), bowAngle: 2, hand: p(132, 104), pull: 0, hooked: false, arrow: false, fore: 82, face: "concentrato" },
  accompagna: { grip: p(250, 127), bowAngle: 9, hand: p(128, 106), pull: 0, hooked: false, arrow: false, fore: 80 },
  vittoria: { grip: p(206, 34), bowAngle: -12, hand: p(104, 52), pull: 0, hooked: false, arrow: false, fore: 46, face: "felice" },
  fiero: { grip: p(192, 204), bowAngle: 2, hand: p(116, 186), pull: 0, hooked: false, arrow: false, fore: 40, face: "sorriso" },
};

/** Sequenza del tiro animato in Home (secondi). */
const SEQUENCE: [string, number][] = [
  ["riposo", 1.8],
  ["incocco", 0.9],
  ["alzata", 0.9],
  ["allungo", 1.1],
  ["allungo", 1.3],
  ["rilascio", 0.14],
  ["accompagna", 1.2],
  ["riposo", 1.0],
];
const CYCLE = SEQUENCE.reduce((a, [, d]) => a + d, 0);
const RELEASE_AT = SEQUENCE.slice(0, 5).reduce((a, [, x]) => a + x, 0);

function poseAt(t: number): { def: PoseDef; release: number | null } {
  let acc = 0;
  for (let i = 0; i < SEQUENCE.length; i += 1) {
    const [name, d] = SEQUENCE[i];
    if (t < acc + d) {
      const raw = (t - acc) / d;
      const prev = POSES[SEQUENCE[(i + SEQUENCE.length - 1) % SEQUENCE.length][0]];
      const cur = POSES[name];
      return { def: mix(prev, cur, name === "rilascio" ? raw : ease(raw)), release: t >= RELEASE_AT ? t - RELEASE_AT : null };
    }
    acc += d;
  }
  return { def: POSES.riposo, release: null };
}

function mix(a: PoseDef, b: PoseDef, t: number): PoseDef {
  return {
    grip: lerpP(a.grip, b.grip, t),
    bowAngle: lerp(a.bowAngle, b.bowAngle, t),
    hand: a.hand && b.hand ? lerpP(a.hand, b.hand, t) : t < 0.5 ? a.hand : b.hand,
    pull: lerp(a.pull, b.pull, t),
    hooked: t < 0.5 ? a.hooked : b.hooked,
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
  const longSleeves = ["felpa", "giacca", "tunica", "farsetto"].includes(look.top);
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
  const handTarget = def.hooked ? stringHand : (def.hand ?? restW);
  const drawArm = ik(SD, handTarget, 40, def.fore, -1);
  const drawHand = drawArm.hand;
  const tipTop = rot(p(g.tipX, -g.tipY), def.bowAngle, grip);
  const tipBot = rot(p(g.tipX, g.tipY), def.bowAngle, grip);
  const nockPt = def.hooked ? drawHand : null;

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
  const tunicLen = look.top === "tunica" ? 252 : 214;

  // gambe
  const kneeB = 2 + Math.sin(t * 1.7) * 0.6;
  const legs = {
    back: { hip: p(cx - 12 * W, 208), knee: p(cx - 18 * W, 270 - kneeB), ankle: p(cx - 24, 328) },
    front: { hip: p(cx + 12 * W, 208), knee: p(cx + 19 * W, 270 - kneeB), ankle: p(cx + 26, 328) },
  };
  const legW = 19 * W;

  const limb = (a: P, b: P, w: number, color: string) => (
    <line x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} stroke={color} strokeWidth={w} strokeLinecap="round" />
  );

  const shoe = (ankle: P) => {
    if (look.footwear === "stivali") {
      return (
        <g>
          <path d={`M${f(ankle.x - 9)} ${f(ankle.y - 46)} L${f(ankle.x + 9)} ${f(ankle.y - 46)} L${f(ankle.x + 9)} ${f(ankle.y + 2)} C${f(ankle.x + 14)} ${f(ankle.y + 4)} ${f(ankle.x + 22)} ${f(ankle.y + 6)} ${f(ankle.x + 22)} ${f(ankle.y + 10)} L${f(ankle.x - 11)} ${f(ankle.y + 10)} Z`} fill={look.shoes} />
          <path d={`M${f(ankle.x - 10)} ${f(ankle.y - 46)} h20 v6 h-20 z`} fill={shade(look.shoes, -0.3)} />
          <path d={`M${f(ankle.x - 11)} ${f(ankle.y + 8)} h33`} stroke="#000" strokeOpacity="0.35" strokeWidth="2.5" />
        </g>
      );
    }
    const high = look.footwear === "stivaletti" ? 12 : 4;
    return (
      <g>
        <path d={`M${f(ankle.x - 9)} ${f(ankle.y - high)} L${f(ankle.x + 8)} ${f(ankle.y - high)} C${f(ankle.x + 10)} ${f(ankle.y - 1)} ${f(ankle.x + 20)} ${f(ankle.y + 1)} ${f(ankle.x + 22)} ${f(ankle.y + 7)} L${f(ankle.x + 22)} ${f(ankle.y + 10)} L${f(ankle.x - 11)} ${f(ankle.y + 10)} Z`} fill={look.shoes} />
        {look.footwear === "sportive" ? <path d={`M${f(ankle.x - 11)} ${f(ankle.y + 7)} h33 v3.5 h-33 z`} fill="#f2efe8" /> : <path d={`M${f(ankle.x - 11)} ${f(ankle.y + 8)} h33`} stroke="#000" strokeOpacity="0.35" strokeWidth="2.5" />}
        {look.footwear === "sportive" ? <path d={`M${f(ankle.x - 2)} ${f(ankle.y - 2)} l8 4 M${f(ankle.x + 1)} ${f(ankle.y - 3)} l8 4`} stroke={shade(look.shoes, 0.5)} strokeWidth="1" /> : null}
      </g>
    );
  };

  const leg = (L: typeof legs.back, key: string) => {
    const tight = look.bottom === "calzamaglia";
    const shorts = look.bottom === "pantaloncini";
    const w = tight ? legW * 0.82 : legW;
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
            {limb(L.knee, L.ankle, w * 0.86, `url(#${uid}pants)`)}
            {look.bottom === "jeans" ? <line x1={f(L.hip.x + 4)} y1={f(L.hip.y + 6)} x2={f(L.ankle.x + 3)} y2={f(L.ankle.y - 4)} stroke={shade(look.pants, 0.35)} strokeWidth="0.8" strokeDasharray="3 2" /> : null}
          </>
        )}
        {shoe(L.ankle)}
      </g>
    );
  };

  // braccio: manica corta o lunga, avambraccio, mano
  const arm = (s: P, e: P, h: P, which: "bow" | "draw") => {
    const sleeveLong = longSleeves || look.top === "corpetto" || look.top === "gilet";
    const sleeve = look.top === "gilet" || look.top === "corpetto" ? look.trim : shirt;
    const upW = 15 * W;
    const foreW = 11 * W;
    return (
      <g>
        {limb(s, e, upW, sleeve)}
        {sleeveLong ? limb(e, lerpP(e, h, 0.86), foreW + 1.5, sleeve) : limb(e, h, foreW, skin)}
        {sleeveLong ? limb(lerpP(e, h, 0.86), h, foreW - 1, skin) : null}
        {look.top === "tunica" || look.top === "farsetto" ? <circle cx={f(lerp(e.x, h.x, 0.84))} cy={f(lerp(e.y, h.y, 0.84))} r={6.5 * W} fill={look.trim} /> : null}
        {!sleeveLong ? <circle cx={f(lerp(s.x, e.x, 0.6))} cy={f(lerp(s.y, e.y, 0.6))} r={upW / 2 + 0.4} fill={shade(sleeve, -0.15)} /> : null}
        {!sleeveLong ? limb(lerpP(s, e, 0.62), e, foreW + 1, skin) : null}
        {which === "bow" ? (
          <>
            <line x1={f(lerp(e.x, h.x, 0.18))} y1={f(lerp(e.y, h.y, 0.18))} x2={f(lerp(e.x, h.x, 0.78))} y2={f(lerp(e.y, h.y, 0.78))} stroke={look.armguard} strokeWidth={foreW + 3} strokeLinecap="round" />
            <line x1={f(lerp(e.x, h.x, 0.3))} y1={f(lerp(e.y, h.y, 0.3) - 6)} x2={f(lerp(e.x, h.x, 0.3))} y2={f(lerp(e.y, h.y, 0.3) + 6)} stroke={shade(look.armguard, 0.45)} strokeWidth="1" />
            <line x1={f(lerp(e.x, h.x, 0.6))} y1={f(lerp(e.y, h.y, 0.6) - 6)} x2={f(lerp(e.x, h.x, 0.6))} y2={f(lerp(e.y, h.y, 0.6) + 6)} stroke={shade(look.armguard, 0.45)} strokeWidth="1" />
          </>
        ) : null}
        <circle cx={f(h.x)} cy={f(h.y)} r={7.4 * W} fill={skin} />
        <circle cx={f(h.x - 1.5)} cy={f(h.y + 1.5)} r={7.4 * W} fill={skinD} opacity="0.25" />
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
      {look.cape ? (
        <path d={`M${f(shoulderL + 2)} 122 C${f(shoulderL - 18 + capeSway)} 180 ${f(shoulderL - 30 + capeSway * 1.6)} 250 ${f(shoulderL - 26 + capeSway * 2)} 296 L${f(shoulderR + 4 + capeSway)} 290 C${f(shoulderR + 8)} 240 ${f(shoulderR + 6)} 170 ${f(shoulderR - 2)} 122 Z`} fill={`url(#${uid}cape)`} />
      ) : null}
      {look.hat === "cappuccio" ? <path d={`M${f(shoulderL)} 126 C${f(shoulderL + 8)} 112 ${f(shoulderR - 8)} 112 ${f(shoulderR)} 126 C${f(cx + 10)} 132 ${f(cx - 10)} 132 ${f(shoulderL)} 126 Z`} fill={shade(look.hatColor, -0.2)} /> : null}

      <HairBack look={look} uid={uid} t={t} />
      {look.quiverPlace === "schiena" ? quiver("schiena") : null}

      {leg(legs.back, "lb")}
      {leg(legs.front, "lf")}

      <path d={look.top === "tunica" ? `${torso.replace(" Z", "")} L${f(hipR + 6)} ${tunicLen} L${f(hipL - 6)} ${tunicLen} Z` : torso} fill={`url(#${uid}shirt)`} />
      <Outfit look={look} cx={cx} shoulderL={shoulderL} shoulderR={shoulderR} hipL={hipL} hipR={hipR} tunicLen={tunicLen} W={W} woman={woman} />
      {look.quiverPlace !== "schiena" ? quiver("fianco") : null}
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
      <g transform={kid ? `translate(${f(H.x)} ${f(H.y)}) scale(1.14) translate(${f(-H.x)} ${f(-H.y)})` : undefined}>
        <Head look={look} H={H} face={face} blink={blink} uid={uid} t={t} />
      </g>

      {bow}
      {def.arrow && nockPt ? arrowNode(nockPt, restW, 124) : null}
      {flying != null && flying < 0.9 ? <g transform={`translate(${f(flying * 900)} ${f(-flying * 20)})`}>{arrowNode(ANCHOR, rot(restLocal, 0, relGrip), 124)}</g> : null}
      <path d={nockPt ? `M${f(tipTop.x)} ${f(tipTop.y)} L${f(nockPt.x)} ${f(nockPt.y)} L${f(tipBot.x)} ${f(tipBot.y)}` : `M${f(tipTop.x)} ${f(tipTop.y)} L${f(tipBot.x)} ${f(tipBot.y)}`} stroke={look.string || "#f4f1ea"} strokeWidth="1.1" fill="none" opacity="0.9" />
      {arm(SB, bowArm.elbow, grip, "bow")}
      {arm(SD, drawArm.elbow, drawHand, "draw")}
    </g>
  );
}

function Outfit({ look, cx, shoulderL, shoulderR, hipL, hipR, tunicLen, W, woman }: { look: AvatarLook; cx: number; shoulderL: number; shoulderR: number; hipL: number; hipR: number; tunicLen: number; W: number; woman: boolean }) {
  const sh = look.shirt;
  const tr = look.trim;
  const dark = shade(sh, -0.3);
  const belt = (
    <g>
      <rect x={f(hipL - 1)} y="200" width={f(hipR - hipL + 2)} height="8" rx="2" fill={look.style === "medievale" ? "#5b3a1e" : shade(look.pants, -0.45)} />
      <rect x={f(cx - 3.5)} y="200.5" width="7" height="7" rx="1.2" fill="none" stroke="#c9a46a" strokeWidth="1.2" />
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
      <path d={headPath} fill={`url(#${uid}face)`} />
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
      {mouth}
      <path d="M152 95 Q158 98 163 96" stroke={shade(skin, -0.12)} strokeWidth="2" fill="none" opacity="0.4" />
      <Beard look={look} />
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

/**
 * L'arciere. `pose` = "animata" ripete il tiro completo; le altre sono pose ferme (con respiro e
 * battito delle palpebre). Toccandolo, in una posa ferma, scocca una freccia.
 */
export function ArcherAvatar({ look, className = "h-72 w-auto", interactive = true, pose, onShot, hideFlight = false, still = false }: { look: AvatarLook; className?: string; interactive?: boolean; pose?: Pose; onShot?: () => void; hideFlight?: boolean; still?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const mode = pose ?? look.pose ?? "animata";
  const [t, setT] = useState(0);
  const [tapShot, setTapShot] = useState<number | null>(null);
  const shotRef = useRef(onShot);
  shotRef.current = onShot;
  const lastRelease = useRef(-1);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || still) {
      setT(mode === "animata" ? 4.6 : 0.5);
      return;
    }
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      if (now - last > 33 && !document.hidden) {
        last = now;
        setT((now - t0) / 1000);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mode, still]);

  let def: PoseDef;
  let flying: number | null = null;
  if (mode === "animata") {
    const at = poseAt(t % CYCLE);
    def = at.def;
    if (at.release != null && at.release < 1) flying = at.release;
    const n = Math.floor(t / CYCLE);
    if (at.release != null && lastRelease.current !== n) {
      lastRelease.current = n;
      queueMicrotask(() => shotRef.current?.());
    }
  } else {
    const name = mode === "allungo" ? "allungo" : mode === "vittoria" ? "vittoria" : mode === "fiero" ? "fiero" : "riposo";
    def = POSES[name];
    if (tapShot != null) {
      const dt = t - tapShot;
      if (dt < 0.95) {
        def = dt < 0.5 ? mix(POSES[name], POSES.allungo, ease(Math.min(1, dt / 0.35))) : mix(POSES.rilascio, POSES[name], ease((dt - 0.5) / 0.45));
        if (dt >= 0.5) flying = dt - 0.5;
      }
    }
  }
  const blink = t % 3.7 < 0.12;
  const kid = look.body === "ragazzo" || look.body === "ragazza";
  const tap = () => {
    if (!interactive || mode === "animata") return;
    setTapShot(t);
    window.setTimeout(() => shotRef.current?.(), 500);
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
          <stop offset="0" stopColor={shade(look.shirt, 0.35)} />
          <stop offset="1" stopColor={shade(look.shirt, -0.45)} />
        </radialGradient>
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
        <rect width="100" height="100" fill={`url(#${uid}bg)`} />
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
        {beard}
        {stache}
        {mouth}
        {!capOn ? top : null}
        {look.hat === "berretto" ? <g><path d={`M${50 - rx - 3} ${fy - 8} C${50 - rx - 3} ${fy - ry - 14} ${50 + rx + 3} ${fy - ry - 14} ${50 + rx + 3} ${fy - 8} Z`} fill={look.hatColor} /><path d={`M30 ${fy - 8} Q50 ${fy - 2} 74 ${fy - 8} L76 ${fy - 4} Q50 ${fy + 2} 28 ${fy - 4} Z`} fill={shade(look.hatColor, -0.3)} /></g> : null}
        {look.hat === "fascia" ? <path d={`M${50 - rx - 1} ${fy - 13} Q50 ${fy - 19} ${50 + rx + 1} ${fy - 13} L${50 + rx + 1} ${fy - 8} Q50 ${fy - 14} ${50 - rx - 1} ${fy - 8} Z`} fill={look.hatColor} /> : null}
        {look.hat === "piuma" ? <g><path d={`M${50 - rx - 6} ${fy - 10} C${50 - rx} ${fy - ry - 16} ${50 + rx} ${fy - ry - 16} ${50 + rx + 6} ${fy - 10} Z`} fill={look.hatColor} /><path d={`M${50 + rx - 2} ${fy - 16} C${50 + rx + 8} ${fy - 30} ${50 + rx + 16} ${fy - 34} 92 ${fy - 36} C${50 + rx + 12} ${fy - 26} ${50 + rx + 6} ${fy - 18} ${50 + rx} ${fy - 12} Z`} fill="#f4f1ea" /></g> : null}
        {look.hat === "cappuccio" ? <path d={`M${50 - rx - 6} ${fy + 20} C${50 - rx - 8} ${fy - ry - 4} ${50 + rx + 8} ${fy - ry - 4} ${50 + rx + 6} ${fy + 20} C${50 + rx + 2} ${fy - ry + 10} ${50 - rx - 2} ${fy - ry + 10} ${50 - rx - 6} ${fy + 20} Z`} fill={shade(look.hatColor, -0.15)} /> : null}
        {look.hat === "elmo" ? <g><path d={`M${50 - rx - 3} ${fy - 6} C${50 - rx - 3} ${fy - ry - 12} ${50 + rx + 3} ${fy - ry - 12} ${50 + rx + 3} ${fy - 6} Z`} fill="#9aa3ad" /><rect x="48" y={fy - 8} width="4" height="16" fill="#7d8690" /></g> : null}
        {look.glasses ? <g fill="#a8d8ff" fillOpacity="0.15" stroke="#1d2126" strokeWidth="1.4"><circle cx="41" cy={eyeY} r="6.6" /><circle cx="59" cy={eyeY} r="6.6" /><path d={`M47.6 ${eyeY} H52.4`} /></g> : null}
        {look.necklace ? <path d="M40 84 Q50 94 60 84" stroke="#d9b45a" strokeWidth="1.2" fill="none" /> : null}
      </g>
    </svg>
  );
}
