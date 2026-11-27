/**
 * Aura dell'arciere: la sua silhouette nel video (la maschera della persona del modello di posa),
 * tenuta in forma compatta. Non si disegna: serve ai calcoli. La sagoma 3D ha la sua aura (la
 * silhouette del corpo vista come il video) e le due si confrontano a fette, come si misura un corpo
 * dalle foto (larghezza a petto, vita, cosce, braccia, testa): così la sagoma prende la corporatura
 * dell'arciere, vestiti compresi, e si sa quanto le due coincidono.
 */
import type { Build } from "./anatomy-model";
import { sides, type Hand, type Landmark } from "./pose-analysis";

/** silhouette in un riquadro del fotogramma intero (coordinate 0..1), rows×cols celle (1 = persona) */
export type Aura = { x: number; y: number; w: number; h: number; cols: number; rows: number; bits: Uint8Array };
type Rect = { x: number; y: number; w: number; h: number };

/** dalla maschera della persona (valori 0..1, mw×mh, letta nel riquadro region del fotogramma) all'aura compatta */
export function auraFromMask(mask: Float32Array | Uint8Array, mw: number, mh: number, region: Rect, rows = 96): Aura | null {
  const on = mask instanceof Uint8Array ? (i: number) => mask[i] > 127 : (i: number) => mask[i] > 0.5;
  let x0 = mw;
  let y0 = mh;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < mh; y += 2) {
    const o = y * mw;
    for (let x = 0; x < mw; x += 2) {
      if (!on(o + x)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0 || y1 - y0 < 8) return null;
  x0 = Math.max(0, x0 - 2);
  y0 = Math.max(0, y0 - 2);
  x1 = Math.min(mw - 1, x1 + 2);
  y1 = Math.min(mh - 1, y1 + 2);
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const cell = bh / rows;
  const cols = Math.max(4, Math.min(256, Math.round(bw / cell)));
  const bits = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const my = Math.min(mh - 1, Math.floor(y0 + (r + 0.5) * cell));
    for (let c = 0; c < cols; c++) {
      const mx = Math.min(mw - 1, Math.floor(x0 + ((c + 0.5) * bw) / cols));
      bits[r * cols + c] = on(my * mw + mx) ? 1 : 0;
    }
  }
  return { x: region.x + (x0 / mw) * region.w, y: region.y + (y0 / mh) * region.h, w: (bw / mw) * region.w, h: (bh / mh) * region.h, cols, rows, bits };
}

/** l'aura su una griglia W×H che copre il fotogramma intero (dall'alto in basso) */
export function rasterAura(a: Aura, W: number, H: number): Uint8Array {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    const r = Math.floor(((v - a.y) / a.h) * a.rows);
    if (r < 0 || r >= a.rows) continue;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const c = Math.floor(((u - a.x) / a.w) * a.cols);
      if (c >= 0 && c < a.cols && a.bits[r * a.cols + c]) out[y * W + x] = 1;
    }
  }
  return out;
}

/** quanto due silhouette coincidono: area comune / area totale (0..1) */
export function overlap(a: Uint8Array, b: Uint8Array): number {
  let both = 0;
  let any = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) both++;
    if (a[i] || b[i]) any++;
  }
  return any ? both / any : 0;
}

type Group = "torso" | "arm" | "leg" | "head";
/** una fetta del corpo: dove (pixel della griglia), in che direzione si misura la larghezza, di quale parte */
export type Slice = { g: Group; p: [number, number]; d: [number, number] };

/**
 * Le fette dove si misura la larghezza, dai punti del corpo: busto (petto, vita, bacino), testa,
 * braccio dell'arco (omero e avambraccio), cosce e polpacci. Di traverso all'osso.
 */
export function bodySlices(lm: Landmark[], hand: Hand, W: number, H: number): Slice[] {
  const ok = (i: number) => (lm[i]?.visibility ?? 0) > 0.5;
  const P = (i: number): [number, number] => [lm[i].x * W, lm[i].y * H];
  const mid = (a: [number, number], b: [number, number], t = 0.5): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const across = (a: [number, number], b: [number, number]): [number, number] => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  };
  const out: Slice[] = [];
  if (![11, 12, 23, 24].every(ok)) return out;
  const shM = mid(P(11), P(12));
  const hipM = mid(P(23), P(24));
  const dT = across(shM, hipM);
  for (const t of [0.35, 0.6, 0.85]) out.push({ g: "torso", p: mid(shM, hipM, t), d: dT });
  if (ok(7) && ok(8)) {
    const ears = mid(P(7), P(8));
    out.push({ g: "head", p: ears, d: across(shM, ears) });
  }
  const { bow } = sides(hand);
  if (ok(bow[0]) && ok(bow[1])) out.push({ g: "arm", p: mid(P(bow[0]), P(bow[1])), d: across(P(bow[0]), P(bow[1])) });
  if (ok(bow[1]) && ok(bow[2])) out.push({ g: "arm", p: mid(P(bow[1]), P(bow[2])), d: across(P(bow[1]), P(bow[2])) });
  for (const [h, k, a] of [[23, 25, 27], [24, 26, 28]] as const) {
    if (ok(h) && ok(k)) out.push({ g: "leg", p: mid(P(h), P(k), 0.4), d: across(P(h), P(k)) });
    if (ok(k) && ok(a)) out.push({ g: "leg", p: mid(P(k), P(a), 0.35), d: across(P(k), P(a)) });
  }
  return out;
}

/**
 * Larghezza della silhouette lungo una fetta: dal punto si va da una parte e dall'altra finché si esce
 * dalla persona (un buco di un pixel non ferma). 0 se il punto non sta dentro.
 */
export function sliceWidth(m: Uint8Array, W: number, H: number, s: Slice): number {
  const at = (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    return xi >= 0 && yi >= 0 && xi < W && yi < H && m[yi * W + xi] === 1;
  };
  const [px, py] = s.p;
  if (!at(px, py) && !at(px + s.d[0], py + s.d[1]) && !at(px - s.d[0], py - s.d[1])) return 0;
  const run = (sg: number) => {
    let n = 0;
    let miss = 0;
    for (let k = 1; k < W + H; k++) {
      if (at(px + s.d[0] * k * sg, py + s.d[1] * k * sg)) {
        n = k;
        miss = 0;
      } else if (++miss > 1) break;
    }
    return n;
  };
  return run(1) + run(-1) + 1;
}

const LIM: Record<Group, [number, number]> = { torso: [0.75, 1.4], arm: [0.7, 1.45], leg: [0.7, 1.4], head: [0.9, 1.25] };

/**
 * Corporatura dal confronto delle fette: per ogni parte il rapporto mediano tra la larghezza
 * dell'arciere e quella della sagoma, entro limiti credibili (i vestiti larghi contano, poco).
 */
export function buildFrom(ratios: Record<Group, number[]>, base?: Build | null): Build {
  const med = (v: number[]) => {
    if (v.length < 3) return 1;
    const s = [...v].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const b0 = base ?? { torso: 1, arm: 1, leg: 1, head: 1 };
  const out = { ...b0 };
  for (const g of Object.keys(LIM) as (keyof typeof LIM)[]) {
    const [lo, hi] = LIM[g];
    out[g] = Math.max(lo, Math.min(hi, b0[g] * med(ratios[g])));
  }
  return out;
}
