export type Ring = {
  label: string;
  score: number;
  outer: number;
  inner: number;
  fill: string;
  ink: string;
  x?: boolean;
};

export type Face = {
  id: string;
  label: string;
  max: number;
  rings: Ring[];
};

export type TallyShot = {
  block: number;
  end: number;
  arrow: number;
  score: number;
  isX: boolean;
  miss: boolean;
};

export type Hit = { score: number; isX: boolean; miss: boolean };

const GOLD = "#e6b325";
const PAPER = "#f4f1ea";
const INK = "#14181c";
const BLUE = "#2a6294";
const RED = "#c4473d";
const BLACK = "#1a1c1e";

function band(score: number, outer: number, inner: number, fill: string, ink: string, x = false): Ring {
  return { label: x ? "X" : String(score), score, outer, inner, fill, ink, x };
}

/** Ten equal WA rings. X is the inner half of the 10 (radius ≤ 0.05). */
function waFace(): Face {
  const colors: Array<[string, string]> = [
    [PAPER, INK],
    [PAPER, INK],
    [BLACK, PAPER],
    [BLACK, PAPER],
    [BLUE, PAPER],
    [BLUE, PAPER],
    [RED, PAPER],
    [RED, PAPER],
    [GOLD, INK],
    [GOLD, INK],
  ];
  const rings: Ring[] = [];
  for (let score = 1; score <= 10; score += 1) {
    const outer = (11 - score) / 10;
    const inner = score === 10 ? 0.05 : outer - 0.1;
    const [fill, ink] = colors[score - 1];
    rings.push(band(score, outer, inner, fill, ink));
  }
  rings.push(band(10, 0.05, 0, GOLD, INK, true));
  return { id: "wa10", label: "WA 10 zone", max: 10, rings: rings.sort((a, b) => b.outer - a.outer) };
}

function fieldFace(): Face {
  const colors: Array<[string, string]> = [
    [PAPER, INK],
    [PAPER, INK],
    [BLACK, PAPER],
    [BLACK, PAPER],
    [GOLD, INK],
    [GOLD, INK],
  ];
  const rings: Ring[] = [];
  for (let score = 1; score <= 6; score += 1) {
    const outer = (7 - score) / 6;
    const inner = score === 6 ? 0 : outer - 1 / 6;
    const [fill, ink] = colors[score - 1];
    rings.push(band(score, outer, inner, fill, ink));
  }
  return { id: "field6", label: "Field 6 zone", max: 6, rings: rings.sort((a, b) => b.outer - a.outer) };
}

/** Concentric 11 / 10 / 8 / 5. Not an animal face — the archer confirms the zone. */
function threeDFace(): Face {
  const rings = [
    band(5, 1, 0.62, "#8a6a45", PAPER),
    band(8, 0.62, 0.34, "#c4473d", PAPER),
    band(10, 0.34, 0.16, PAPER, INK),
    band(11, 0.16, 0, GOLD, INK),
  ];
  return { id: "threed", label: "3D schematico 11-10-8-5", max: 11, rings };
}

function sagomaFace(max: 11 | 10 | 8): Face {
  const rings: Ring[] = [band(5, 1, max === 8 ? 0.62 : 0.62, "#1a1c1e", PAPER)];
  if (max >= 8) rings.push(band(8, 0.62, max === 8 ? 0 : 0.36, BLUE, PAPER));
  if (max >= 10) rings.push(band(10, 0.36, max === 10 ? 0 : 0.16, GOLD, INK));
  if (max >= 11) rings.push(band(11, 0.16, 0, RED, PAPER));
  return { id: `sagoma${max}`, label: `Sagoma 3D da ${max}`, max, rings };
}

function clayFace(): Face {
  return {
    id: "clay",
    label: "Piattello",
    max: 1,
    rings: [{ label: "Colpito", score: 1, outer: 0.55, inner: 0, fill: "#e07a2f", ink: "#1c1008" }],
  };
}

function equalFace(n: number): Face {
  const count = Math.min(12, Math.max(2, Math.round(n)));
  const rings: Ring[] = [];
  for (let score = 1; score <= count; score += 1) {
    const outer = (count + 1 - score) / count;
    const inner = score === count ? 0 : outer - 1 / count;
    const hot = score >= count - 1;
    rings.push(band(score, outer, inner, hot ? GOLD : score % 2 ? "#1f5c38" : PAPER, hot || score % 2 === 0 ? INK : PAPER));
  }
  return { id: `eq-${count}`, label: `${count} zone uguali`, max: count, rings: rings.sort((a, b) => b.outer - a.outer) };
}

const WA = waFace();
const FIELD = fieldFace();
const THREED = threeDFace();

export function faceById(id: string): Face {
  if (id === "field6") return FIELD;
  if (id === "threed") return THREED;
  if (id === "sagoma11") return sagomaFace(11);
  if (id === "sagoma10") return sagomaFace(10);
  if (id === "sagoma8") return sagomaFace(8);
  if (id === "clay") return clayFace();
  const eq = /^eq-(\d+)$/.exec(id);
  if (eq) return equalFace(Number(eq[1]));
  return WA;
}

export type AimTarget = "padiglione" | "sagoma" | "piattello" | "altro";
export type AimAngle = "alto" | "basso" | "destra" | "sinistra" | "frontale" | "lato";
export type SagomaMax = 11 | 10 | 8;

export function asAimTarget(value: unknown): AimTarget {
  return value === "sagoma" || value === "piattello" || value === "altro" ? value : "padiglione";
}

export function asAimAngle(value: unknown): AimAngle {
  return value === "alto" || value === "basso" || value === "destra" || value === "sinistra" || value === "lato" ? value : "frontale";
}

export function aimSpot(score: number, angle: string, distance: number | null, index: number, kind: "padiglione" | "sagoma") {
  const near = distance == null ? 0.5 : Math.max(0, Math.min(1, (36 - distance) / 32));
  const dirX = angle === "destra" || angle === "lato" ? 1 : angle === "sinistra" ? -1 : 0;
  const dirY = angle === "basso" ? 1 : angle === "alto" ? -1 : 0;
  const aimed = dirX !== 0 || dirY !== 0;
  const spin = ((index * 137.508) * Math.PI) / 180;
  const radius = kind === "padiglione"
    ? (score >= 10 ? 0.05 : score >= 8 ? 0.18 : score >= 5 ? 0.4 : score > 0 ? 0.64 : 1.02)
    : (score >= 8 ? 0.07 : score >= 5 ? 0.32 : score > 0 ? 0.48 : 0.82);
  const shift = aimed ? 0.12 + near * 0.2 : 0;
  const spread = aimed ? radius * 0.28 : radius;
  let nx = Math.cos(spin) * spread + dirX * (radius * 0.72 + shift);
  let ny = Math.sin(spin) * spread + dirY * (radius * 0.72 + shift);
  if (kind === "sagoma") ny -= 0.14;
  const limit = kind === "sagoma" ? 0.94 : 1.08;
  nx = Math.max(-limit, Math.min(limit, nx));
  ny = Math.max(-limit, Math.min(limit, ny));
  return { nx, ny };
}

export function sagomaMaxOf(face: string): SagomaMax {
  if (face === "sagoma8") return 8;
  if (face === "sagoma10") return 10;
  return 11;
}

export function sagomaScores(max: SagomaMax): number[] {
  if (max === 8) return [8, 5, 0];
  if (max === 10) return [10, 8, 5, 0];
  return [11, 10, 8, 5, 0];
}

export const PADIGLIONE_SCORES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

export function faceForAim(target: AimTarget, max: SagomaMax, altroFace = "field6"): string {
  if (target === "padiglione") return "wa10";
  if (target === "sagoma") return "sagoma8";
  if (target === "piattello") return "clay";
  return altroFace;
}

export function aimTargetLabel(id: string) {
  if (id === "sagoma") return "Sagoma 3D";
  if (id === "piattello") return "Piattello";
  if (id === "altro") return "Altro";
  if (id === "padiglione") return "Padiglione";
  return "Non indicato";
}

export function aimAngleLabel(id: string) {
  if (id === "alto") return "Alto";
  if (id === "basso") return "Basso";
  if (id === "destra") return "A destra";
  if (id === "sinistra") return "A sinistra";
  if (id === "lato") return "Di lato";
  if (id === "frontale") return "Frontale";
  return "Non indicato";
}

export function scoreAtRadius(face: Face, radius: number): Hit {
  if (!Number.isFinite(radius) || radius < 0) return { score: 0, isX: false, miss: true };
  const ordered = [...face.rings].sort((a, b) => a.outer - b.outer);
  const limit = ordered[ordered.length - 1]?.outer ?? 1;
  if (radius > limit + 1e-9) return { score: 0, isX: false, miss: true };
  for (const ring of ordered) {
    if (radius <= ring.outer + 1e-9) return { score: ring.score, isX: Boolean(ring.x), miss: false };
  }
  return { score: 0, isX: false, miss: true };
}

/** A point that sits in the ring of this score, so the face matches the number. */
export function ringPoint(face: Face, score: number, isX: boolean, miss: boolean, index: number) {
  const spin = ((index * 137.508) * Math.PI) / 180;
  if (miss || score <= 0) return { nx: Math.cos(spin) * 1.05, ny: Math.sin(spin) * 1.05 };
  const ring = face.rings.find((item) => Boolean(item.x) === isX && item.score === score)
    ?? face.rings.find((item) => !item.x && item.score === score);
  if (!ring) return { nx: 0, ny: 0 };
  const span = Math.max(0.012, ring.outer - ring.inner);
  const radius = ring.inner + span * (0.42 + ((index * 17) % 5) * 0.1);
  return { nx: Math.cos(spin) * radius, ny: Math.sin(spin) * radius };
}

export function scoreAllowed(face: Face, score: number, isX: boolean, miss: boolean) {
  if (miss) return score === 0 && !isX;
  if (!Number.isInteger(score)) return false;
  if (isX) {
    const center = face.rings.find((ring) => ring.x);
    return Boolean(center) && score === center?.score;
  }
  return face.rings.some((ring) => !ring.x && ring.score === score);
}

export function summarize(shots: TallyShot[], maxArrow: number) {
  const arrows = shots.length;
  const points = shots.reduce((sum, shot) => sum + shot.score, 0);
  const xs = shots.filter((shot) => shot.isX).length;
  const tops = shots.filter((shot) => !shot.miss && shot.score === maxArrow).length;
  const best = shots.reduce((max, shot) => Math.max(max, shot.score), 0);
  return {
    points,
    arrows,
    avg: arrows ? points / arrows : 0,
    centers: xs || tops,
    tops,
    best,
    xs,
    tens: tops,
  };
}

export function endPoints(shots: { block: number; end: number; score: number }[], block: number, end: number) {
  return shots.filter((shot) => shot.block === block && shot.end === end).reduce((sum, shot) => sum + shot.score, 0);
}

export function cursor(
  shots: { block: number; end: number; arrow: number }[],
  arrowsPerEnd: number,
  endsPlanned: number,
  blocksPlanned: number,
) {
  const filled = new Set(shots.map((shot) => `${shot.block}:${shot.end}:${shot.arrow}`));
  for (let block = 0; block < blocksPlanned; block += 1) {
    for (let end = 0; end < endsPlanned; end += 1) {
      for (let arrow = 0; arrow < arrowsPerEnd; arrow += 1) {
        if (!filled.has(`${block}:${end}:${arrow}`)) return { block, end, arrow, done: false };
      }
    }
  }
  return {
    block: Math.max(0, blocksPlanned - 1),
    end: Math.max(0, endsPlanned - 1),
    arrow: Math.max(0, arrowsPerEnd - 1),
    done: true,
  };
}

export function fmtAvg(n: number) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function fmtPct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)}%`;
}

export function keypad(face: Face) {
  const keys: { label: string; score: number; isX: boolean; miss: boolean }[] = [];
  const center = face.rings.find((ring) => ring.x);
  if (center) keys.push({ label: center.label, score: center.score, isX: true, miss: false });
  const scores = [...new Set(face.rings.filter((ring) => !ring.x).map((ring) => ring.score))].sort((a, b) => b - a);
  for (const score of scores) keys.push({ label: String(score), score, isX: false, miss: false });
  keys.push({ label: "M", score: 0, isX: false, miss: true });
  return keys;
}
