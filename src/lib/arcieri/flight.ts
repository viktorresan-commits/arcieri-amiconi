/** Volo della freccia. Unità SI dentro, libbre e centimetri fuori. */

export type Fletch = "spin" | "vane3" | "feather3" | "feather4";

export type FlightInput = {
  drawLb: number;
  drawCm: number;
  braceCm: number;
  eta: number;
  k: number;
  grains: number;
  diameterMm: number;
  lengthCm: number;
  fletch: Fletch;
  distanceM: number;
  heightCm: number;
  eyeCm: number;
  eyeBackCm: number;
  wind: number;
  sighted: boolean;
  faceCm: number;
  zones: 5 | 10;
  /** Pendenza della linea di tiro in gradi: + in salita, − in discesa. */
  slopeDeg?: number;
  /** Altezza del centro (oro) da terra in metri: 1,30 m da regolamento. */
  goldM?: number;
};

export type FlightHit = {
  y: number;
  z: number;
  t: number;
  v0: number;
  energy: number;
  theta: number;
  path: { x: number; z: number }[];
};

const AF: Record<Fletch, number> = {
  spin: 1.62e-5,
  vane3: 3.2e-5,
  feather3: 4e-5,
  feather4: 5.3e-5,
};

const RHO = 1.2;
const G = 9.81;
const GOLD = 1.3;

export function launchSpeed(input: FlightInput) {
  const force = input.drawLb * 4.448221615;
  const stroke = Math.max(0.05, (input.drawCm - input.braceCm) / 100);
  const energy = input.eta * input.k * force * stroke;
  const mass = input.grains * 6.479891e-5;
  const speed = Math.sqrt((2 * energy) / Math.max(mass, 1e-6));
  return { force, stroke, energy, mass, speed };
}

export const GOLD_HEIGHT = GOLD;

/** Altezza dell'oro di questo bersaglio (regolabile: campagna, 3D, paglioni bassi). */
export function goldOf(input: FlightInput) {
  const g = input.goldM;
  return typeof g === "number" && Number.isFinite(g) && g > 0.2 && g < 4 ? g : GOLD;
}

/** Distanza "compensata" da usare sul mirino in pendenza (LoS × cos θ). */
export function compensatedDistance(input: FlightInput) {
  return input.distanceM * Math.cos(((input.slopeDeg ?? 0) * Math.PI) / 180);
}

/** Dimensione angolare della faccia vista dalla linea: MOA e pollici a 20 iarde (come i mirini). */
export function angularSize(faceCm: number, distanceM: number) {
  if (!(faceCm > 0) || !(distanceM > 0)) return null;
  const rad = 2 * Math.atan(faceCm / 100 / (2 * distanceM));
  const moa = (rad * 180 * 60) / Math.PI;
  return { moa, inchesAt20yd: moa / 4.7746483 };
}

export function eyePoint(input: FlightInput) {
  return { x: -input.eyeBackCm / 100, z: releaseHeight(input) + input.eyeCm / 100 };
}

export function releasePoint(input: FlightInput) {
  return { x: 0, z: releaseHeight(input) };
}

function releaseHeight(input: FlightInput) {
  const height = input.heightCm / 100;
  const diameter = input.diameterMm / 1000;
  return 0.936 * height - input.eyeCm / 100 - diameter / 2;
}

function dragArea(input: FlightInput) {
  const diameter = input.diameterMm / 1000;
  const length = input.lengthCm / 100;
  return 0.0125 * diameter * length + AF[input.fletch];
}

export function fly(input: FlightInput, theta: number, psi: number, speedScale = 1): FlightHit {
  const { stroke, energy, mass, speed } = launchSpeed(input);
  const v0 = speed * speedScale;
  const area = dragArea(input);
  const drag = (RHO * area) / (2 * mass);
  let x = stroke * Math.cos(theta);
  let y = 0;
  let z = releaseHeight(input) + stroke * Math.sin(theta);
  let vx = v0 * Math.cos(theta) * Math.cos(psi);
  let vy = v0 * Math.cos(theta) * Math.sin(psi);
  let vz = v0 * Math.sin(theta);
  const dt = 0.002;
  // In pendenza la gravità si divide: una parte frena (o spinge) lungo la linea di tiro,
  // l'altra fa cadere la freccia. Le quote restano misurate dalla linea di tiro.
  const slope = ((input.slopeDeg ?? 0) * Math.PI) / 180;
  const gAlong = G * Math.sin(slope);
  const gDown = G * Math.cos(slope);
  const path: { x: number; z: number }[] = [{ x, z }];
  const plane = input.distanceM;
  let t = 0;
  for (let step = 0; step < 8000; step += 1) {
    const rx = vx;
    const ry = vy - input.wind;
    const rz = vz;
    const rel = Math.hypot(rx, ry, rz);
    const px = x;
    const py = y;
    const pz = z;
    vx += (-drag * rel * rx - gAlong) * dt;
    vy += -drag * rel * ry * dt;
    vz += (-drag * rel * rz - gDown) * dt;
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;
    t += dt;
    if (step % 8 === 0) path.push({ x, z });
    if (x >= plane) {
      const span = x - px || 1e-6;
      const f = (plane - px) / span;
      const end = { x: plane, y: py + (y - py) * f, z: pz + (z - pz) * f };
      path.push({ x: end.x, z: end.z });
      return { y: end.y, z: end.z, t, v0, energy, theta, path };
    }
    if (z < -1) break;
  }
  return { y, z, t, v0, energy, theta, path };
}

export function solveAngle(input: FlightInput) {
  let lo = -0.05;
  let hi = 0.6;
  const still = { ...input, wind: 0 };
  for (let i = 0; i < 26; i += 1) {
    const mid = (lo + hi) / 2;
    const hit = fly(still, mid, 0);
    if (hit.z > goldOf(input)) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export function aimGap(input: FlightInput, theta: number) {
  if (input.sighted) return 0;
  const length = input.lengthCm / 100;
  const diameter = input.diameterMm / 1000;
  const eye = input.eyeCm / 100;
  const back = input.eyeBackCm / 100;
  const slope = (length * Math.tan(theta) - (eye + diameter / 2)) / (length + back);
  const aim = releaseHeight(input) + length * Math.tan(theta) + slope * (input.distanceM - length);
  return aim - goldOf(input);
}

export function scoreImpact(input: FlightInput, y: number, z: number) {
  const radius = Math.hypot(y, z - goldOf(input));
  const shaft = input.diameterMm / 2000;
  const inner = Math.max(0, radius - shaft);
  const face = input.faceCm / 100;
  const limit = face / 2;
  if (inner > limit) return { score: 0, miss: true, zone: "M" };
  if (input.zones === 5) {
    const width = face / 10;
    const zone = Math.max(0, Math.ceil(inner / width) - 1);
    const score = Math.max(1, 9 - 2 * zone);
    return { score, miss: false, zone: String(score) };
  }
  const width = face / 20;
  const zone = Math.max(0, Math.ceil(inner / width) - 1);
  const score = Math.max(1, 10 - zone);
  return { score, miss: false, zone: score === 10 && inner <= width / 2 ? "X" : String(score) };
}

export function shootGroup(input: FlightInput, count: number, scatterMrad: number, speedFrac: number, seed = 1) {
  const theta = solveAngle(input);
  const hits = [];
  for (let i = 0; i < count; i += 1) {
    const a = gaussian(seed + i * 3);
    const b = gaussian(seed + i * 3 + 1);
    const c = gaussian(seed + i * 3 + 2);
    const hit = fly(
      input,
      theta + a * scatterMrad * 0.001,
      b * scatterMrad * 0.001,
      1 + c * speedFrac,
    );
    hits.push({ ...hit, ...scoreImpact(input, hit.y, hit.z) });
  }
  return { theta, hits };
}

export function describeRound(input: FlightInput, count: number, scatterMrad: number, speedFrac: number, consistency: number, seed: number) {
  const theta = solveAngle(input);
  const clean = fly(input, theta, 0);
  const scored = scoreImpact(input, clean.y, clean.z);
  const gap = aimGap(input, theta);
  const { hits } = shootGroup(input, count, scatterMrad, speedFrac, seed);
  const my = hits.reduce((sum, hit) => sum + hit.y, 0) / hits.length;
  const mz = hits.reduce((sum, hit) => sum + hit.z, 0) / hits.length;
  const rms = Math.sqrt(hits.reduce((sum, hit) => sum + (hit.y - my) ** 2 + (hit.z - mz) ** 2, 0) / hits.length);
  const total = hits.reduce((sum, hit) => sum + hit.score, 0);
  const c = Math.min(0.9, Math.max(0, consistency));
  const tight = shootGroup(input, count, scatterMrad * Math.sqrt(1 - c), speedFrac * Math.sqrt(1 - c), seed + 100);
  const loose = shootGroup(input, count, scatterMrad * Math.sqrt(1 + c), speedFrac * Math.sqrt(1 + c), seed + 200);
  const avg = (list: { score: number }[]) => list.reduce((sum, hit) => sum + hit.score, 0) / list.length;
  return { theta, clean, scored, gap, hits, my, mz, rms, total, expected: 0.5 * (avg(tight.hits) + avg(loose.hits)) };
}

function gaussian(seed: number) {
  const u = mulberry(seed);
  const v = mulberry(seed + 17);
  return Math.sqrt(-2 * Math.log(Math.max(u, 1e-6))) * Math.cos(2 * Math.PI * v);
}

function mulberry(seed: number) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
