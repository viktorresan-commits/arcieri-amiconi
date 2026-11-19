export const GAME_MODES = ["infinite", "time", "perfect", "training", "daily", "duel", "gara"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export type Face = "tondo" | "sagoma";

export type ShotPlan = {
  index: number;
  distance: number;
  wind: number;
  size: number;
  sway: number;
  swayHz: number;
  phase: number;
  face: Face;
  animal: string;
  place: number;
  lift: number;
};

export type Aim = { yaw: number; pitch: number };

export type BowStyle = "ricurvo" | "longbow" | "takedown";

export type Gear = {
  draw: number;
  pound: number;
  grain: number;
  shaft: number;
  vane: string;
  cock: string;
  shaftColor: string;
  limb: string;
  glove: string;
  bow: BowStyle;
};

const BOW_STYLES: BowStyle[] = ["ricurvo", "longbow", "takedown"];

export const STANDARD_GEAR: Gear = {
  draw: 1,
  pound: 36,
  grain: 100,
  shaft: 28,
  vane: "#c73535",
  cock: "#f4f1ea",
  shaftColor: "#e4d2a8",
  limb: "#8a5a32",
  glove: "#6b4226",
  bow: "ricurvo",
};

function hexColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

export function gearOf(raw?: Partial<Gear> | null): Gear {
  const draw = Number(raw?.draw ?? 1);
  const pound = Number(raw?.pound ?? 36);
  const grain = Number(raw?.grain ?? 100);
  const shaft = Number(raw?.shaft ?? 28);
  const bow = BOW_STYLES.includes(raw?.bow as BowStyle) ? (raw?.bow as BowStyle) : STANDARD_GEAR.bow;
  return {
    draw: clamp(Number.isFinite(draw) ? draw : 1, 0.35, 1.15),
    pound: clamp(Number.isFinite(pound) ? pound : 36, 20, 50),
    grain: clamp(Number.isFinite(grain) ? grain : 100, 70, 160),
    shaft: clamp(Number.isFinite(shaft) ? shaft : 28, 24, 34),
    vane: hexColor(raw?.vane, STANDARD_GEAR.vane),
    cock: hexColor(raw?.cock, STANDARD_GEAR.cock),
    shaftColor: hexColor(raw?.shaftColor, STANDARD_GEAR.shaftColor),
    limb: hexColor(raw?.limb, STANDARD_GEAR.limb),
    glove: hexColor(raw?.glove, STANDARD_GEAR.glove),
    bow,
  };
}

export function arrowSpeed(gear: Gear) {
  const pound = gear.pound / 36;
  const mass = Math.sqrt(100 / gear.grain);
  const shaft = 0.94 + 0.06 * (28 / gear.shaft);
  return WORLD.speed * gear.draw * pound * mass * shaft;
}

export type Hit = {
  points: number;
  perfect: boolean;
  dx: number;
  dy: number;
  unit: number;
};

export const WORLD = {
  g: 9.81,
  speed: 68,
  releaseY: 1.55,
  targetY: 1.25,
  faceR: 0.4,
};

const ANIMALS = ["cinghiale", "cervo", "orso", "volpe", "lupo", "capriolo", "tasso", "stambecco", "lince", "pantera"];

export const RANKS = [
  { id: "principiante", title: "Principiante", xp: 0, scene: "bosco" },
  { id: "arciere", title: "Arciere", xp: 200, scene: "montagna" },
  { id: "esperto", title: "Esperto", xp: 800, scene: "prateria" },
  { id: "maestro", title: "Maestro", xp: 2000, scene: "medievale" },
  { id: "leggenda", title: "Leggenda", xp: 5000, scene: "fantasy" },
] as const;

export type SceneId = (typeof RANKS)[number]["scene"];

export const REWARDS: { code: string; title: string; hint: string }[] = [
  { code: "prima_partita", title: "Prima freccia", hint: "Chiudi una partita" },
  { code: "cento", title: "Cento punti", hint: "100 punti in una partita" },
  { code: "duecentocinquanta", title: "Duecentocinquanta", hint: "250 punti in una partita" },
  { code: "tre_centri", title: "Tre centri", hint: "3 centri nella stessa partita" },
  { code: "serie_cinque", title: "Serie da cinque", hint: "5 bersagli di fila" },
  { code: "controvento", title: "Controvento", hint: "Un centro con vento forte" },
  { code: "lunga_distanza", title: "Lunga distanza", hint: "Colpisci oltre i 45 metri" },
  { code: "sfida_del_giorno", title: "Sfida del giorno", hint: "Gioca la sfida collettiva" },
  { code: "duello_vinto", title: "Duello vinto", hint: "Batti un Amiconi" },
  { code: "leggenda", title: "Leggenda", hint: "Raggiungi il grado Leggenda" },
];

export const GROUP_GOALS = [
  { code: "centri_500", title: "500 centri in settimana", target: 500, key: "perfects" as const },
  { code: "frecce_1000", title: "1000 frecce in settimana", target: 1000, key: "arrows" as const },
  { code: "precisione_70", title: "Precisione media del 70%", target: 70, key: "accuracy" as const },
  { code: "partite_100", title: "100 partite in settimana", target: 100, key: "matches" as const },
];

export function modeLabel(mode: string) {
  if (mode === "infinite") return "Corsa infinita";
  if (mode === "time") return "Time Attack";
  if (mode === "perfect") return "Perfect 10";
  if (mode === "training") return "Allenamento";
  if (mode === "daily") return "Sfida del giorno";
  if (mode === "duel") return "Duello";
  if (mode === "gara") return "Gara";
  return mode;
}

export function arrowCap(mode: GameMode) {
  if (mode === "perfect") return 10;
  if (mode === "daily" || mode === "duel") return 8;
  if (mode === "training") return 20;
  if (mode === "time") return 40;
  if (mode === "gara") return 60;
  return 80;
}

export function rankFor(xp: number) {
  let current: (typeof RANKS)[number] = RANKS[0];
  for (const rank of RANKS) {
    if (xp >= rank.xp) current = rank;
  }
  const next = RANKS.find((rank) => rank.xp > xp) ?? null;
  return { current, next };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function hashSeed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function planFor(mode: GameMode, seed: string, index: number): ShotPlan {
  const station = mode === "gara" ? Math.floor(index / 3) : index;
  const rng = mulberry32(hashSeed(`${seed}:${station}`));
  const hard = mode === "infinite" ? index : mode === "time" ? index * 0.65 : mode === "perfect" || mode === "training" ? index * 0.2 : mode === "gara" ? station * 0.35 : index * 0.5;
  const garaDistances = [18, 18, 25, 18, 30, 20, 18, 40];
  const distance = mode === "perfect" ? 18 + (index % 3) * 8 : mode === "training" ? 18 + (index % 4) * 4 : mode === "gara" ? garaDistances[station % garaDistances.length] ?? 18 : Math.min(58, 18 + hard * 1.25);
  const windSpan = mode === "training" || mode === "perfect" ? 1.1 : mode === "gara" ? 1.4 + (station % 4) * 0.45 : Math.min(7.2, 1.1 + hard * 0.28);
  const wind = (rng() - 0.5) * windSpan;
  const size = mode === "gara" ? 0.52 + rng() * 0.72 : Math.max(0.55, 1 - hard * 0.016);
  const moving = mode === "gara" ? station >= 14 : hard > 6 && mode !== "perfect" && mode !== "training";
  const sway = moving ? Math.min(0.65, mode === "gara" ? 0.16 : (hard - 6) * 0.04) : 0;
  const swayHz = 0.22 + rng() * 0.28;
  const face: Face = mode === "perfect" || mode === "training" || mode === "gara" ? "tondo" : hard >= 4 && rng() > 0.42 ? "sagoma" : "tondo";
  const place = mode === "gara" ? (rng() - 0.5) * 0.85 : 0;
  const hang = mode === "gara" ? rng() > 0.58 : mode === "infinite" && rng() > 0.7;
  const lift = hang ? 0.85 : 0;
  return {
    index,
    distance,
    wind,
    size,
    sway,
    swayHz,
    phase: rng() * Math.PI * 2,
    face,
    animal: ANIMALS[Math.floor(rng() * ANIMALS.length)] ?? "cervo",
    place,
    lift,
  };
}

export function flight(plan: ShotPlan, aim: Aim, releaseSec: number, gear: Gear = STANDARD_GEAR) {
  const tuned = gearOf(gear);
  const speed = arrowSpeed(tuned);
  const yaw = clamp(aim.yaw, -0.18, 0.18);
  const pitch = clamp(aim.pitch, -0.12, 0.22);
  const vz = Math.max(8, Math.cos(yaw) * Math.cos(pitch) * speed);
  const t = plan.distance / vz;
  const drift = (100 / tuned.grain) * (36 / tuned.pound);
  const x = Math.sin(yaw) * speed * t + plan.wind * t * drift;
  const y = WORLD.releaseY + Math.sin(pitch) * speed * t - 0.5 * WORLD.g * t * t;
  const centerX = Math.sin(plan.phase + (releaseSec + t) * plan.swayHz * Math.PI * 2) * plan.sway + plan.place;
  const centerY = WORLD.targetY + plan.lift;
  return { x, y, t, centerX, centerY, dx: x - centerX, dy: y - centerY, speed };
}

export function idealAim(plan: ShotPlan, releaseSec: number, gear: Gear = STANDARD_GEAR): Aim {
  const tuned = gearOf(gear);
  const speed = arrowSpeed(tuned);
  const drift = (100 / tuned.grain) * (36 / tuned.pound);
  let yaw = 0;
  let pitch = 0.04;
  for (let i = 0; i < 6; i += 1) {
    const probed = flight(plan, { yaw, pitch }, releaseSec, tuned);
    const needVx = probed.centerX / probed.t - plan.wind * drift;
    yaw = Math.asin(clamp(needVx / speed, -0.12, 0.12));
    const needVy = (probed.centerY - WORLD.releaseY + 0.5 * WORLD.g * probed.t * probed.t) / probed.t;
    pitch = Math.asin(clamp(needVy / speed, -0.05, 0.16));
  }
  return { yaw, pitch };
}

export function calmAim(plan: ShotPlan): Aim {
  return idealAim({ ...plan, wind: 0, sway: 0 }, 0);
}

export function impact(plan: ShotPlan, aim: Aim, releaseSec: number, gear: Gear = STANDARD_GEAR): Hit {
  const shot = flight(plan, aim, releaseSec, gear);
  const radius = WORLD.faceR * plan.size;
  const unit = Math.hypot(shot.dx, shot.dy) / radius;
  if (plan.face === "sagoma") {
    if (unit <= 0.16) return { points: 10, perfect: true, dx: shot.dx, dy: shot.dy, unit };
    if (unit <= 0.34) return { points: 8, perfect: false, dx: shot.dx, dy: shot.dy, unit };
    if (unit <= 1) return { points: 5, perfect: false, dx: shot.dx, dy: shot.dy, unit };
    return { points: 0, perfect: false, dx: shot.dx, dy: shot.dy, unit };
  }
  if (unit > 1) return { points: 0, perfect: false, dx: shot.dx, dy: shot.dy, unit };
  const points = Math.max(1, 10 - Math.floor(unit * 9));
  return { points, perfect: unit < 0.16, dx: shot.dx, dy: shot.dy, unit };
}

export function computerAim(plan: ShotPlan, releaseSec: number, salt: string): Aim {
  const ideal = idealAim(plan, releaseSec);
  const rng = mulberry32(hashSeed(`${salt}:cpu:${plan.index}`));
  const wobble = 0.0075;
  return {
    yaw: ideal.yaw + (rng() - 0.5) * wobble * 2,
    pitch: ideal.pitch + (rng() - 0.5) * wobble * 2,
  };
}

export type ScoredShot = Hit & { distance: number; wind: number; face: Face; at: number };

export function scoreShots(mode: GameMode, seed: string, shots: { yaw: number; pitch: number; at: number; draw?: number; pound?: number; grain?: number; shaft?: number; vane?: string }[]) {
  let score = 0;
  let hits = 0;
  let perfects = 0;
  let combo = 0;
  let bestCombo = 0;
  let misses = 0;
  const detail: ScoredShot[] = [];
  for (let i = 0; i < shots.length; i += 1) {
    if (mode === "infinite" && misses >= 3) break;
    const plan = planFor(mode, seed, i);
    const gear = gearOf(shots[i]);
    const hit = impact(plan, shots[i], shots[i].at / 1000, gear);
    score += hit.points;
    if (hit.points > 0) {
      hits += 1;
      combo += 1;
      bestCombo = Math.max(bestCombo, combo);
    } else {
      misses += 1;
      combo = 0;
    }
    if (hit.perfect) perfects += 1;
    detail.push({ ...hit, distance: plan.distance, wind: plan.wind, face: plan.face, at: shots[i].at });
  }
  const xp = mode === "training" ? Math.min(40, perfects * 4) : score + perfects * 6;
  return { score, hits, perfects, bestCombo, arrows: detail.length, misses, xp, detail };
}

export function rewardsFor(input: {
  matchesBefore: number;
  score: number;
  perfects: number;
  bestCombo: number;
  mode: GameMode;
  detail: ScoredShot[];
  xpAfter: number;
  duelWon: boolean;
}) {
  const codes: string[] = [];
  if (input.matchesBefore === 0) codes.push("prima_partita");
  if (input.score >= 100) codes.push("cento");
  if (input.score >= 250) codes.push("duecentocinquanta");
  if (input.perfects >= 3) codes.push("tre_centri");
  if (input.bestCombo >= 5) codes.push("serie_cinque");
  if (input.mode === "daily") codes.push("sfida_del_giorno");
  if (input.duelWon) codes.push("duello_vinto");
  if (input.detail.some((shot) => shot.perfect && Math.abs(shot.wind) >= 2.2)) codes.push("controvento");
  if (input.detail.some((shot) => shot.points > 0 && shot.distance >= 45)) codes.push("lunga_distanza");
  if (input.xpAfter >= RANKS[RANKS.length - 1].xp) codes.push("leggenda");
  return codes;
}

export function weekStartKey(parts: { y: number; m: number; d: number }) {
  const utc = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - (day - 1));
  return utc.toISOString().slice(0, 10);
}

export function dayKey(parts: { y: number; m: number; d: number }) {
  return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}
