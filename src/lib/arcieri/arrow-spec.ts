/**
 * Spine e pesi delle frecce, come li conosce chi tira con l'arco tradizionale:
 * spine in libbre (aste di legno) e peso in grammi, anche diverso freccia per freccia.
 *
 * Spine in libbre (metodo AMO/ATA del legno): peso di 2 lb al centro di un'asta appoggiata su 26″,
 * libbre = 26 / flessione in pollici.
 * Aste di carbonio e alluminio (metodo ATA/ASTM): 1,94 lb al centro su 28″, lo spine è la flessione
 * in millesimi di pollice (500 = 0,500″). La flessione a 28″ vale 0,825 volte quella a 26″, quindi
 * libbre = 26 / (0,825 × flessione) ≈ 31,5 / flessione. Esempio: un 500 è circa 63 lb.
 */

export const GRAINS_PER_G = 15.4324;

export type SpineUnit = "lb" | "defl";

const num = (s: string | number | undefined | null) => {
  const v = Number(String(s ?? "").replace(",", ".").replace(/[#\s]/g, ""));
  return Number.isFinite(v) ? v : NaN;
};

/** "45-50", "45/50", "45#" → 47,5; un numero solo → quel numero */
function parseLbRange(raw: string): number {
  const parts = String(raw).replace(/#/g, "").split(/[-–/]/).map((x) => num(x)).filter((x) => x > 0);
  if (!parts.length) return NaN;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/** unità dello spine scritto: quella scelta, altrimenti dal numero (oltre 150 è una flessione in millesimi) */
export function spineUnitOf(raw: string, unit?: string | null): SpineUnit {
  if (unit === "lb" || unit === "defl") return unit;
  const v = parseLbRange(raw);
  if (/[-–/#]/.test(raw)) return "lb";
  return v >= 150 || (v > 0 && v < 2) ? "defl" : "lb";
}

/** flessione in pollici da quanto scritto: 600 → 0,600; 0,6 → 0,6 */
export function deflectionIn(raw: string): number {
  const v = num(raw);
  if (!(v > 0)) return NaN;
  return v >= 2 ? v / 1000 : v;
}

/**
 * Spine in libbre da quanto scritto. Per il legno la flessione è misurata su 26″ (26 / flessione),
 * per carbonio e alluminio su 28″ (31,5 / flessione).
 */
export function spineLb(raw: string | undefined | null, unit?: string | null, material?: string | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const u = spineUnitOf(s, unit);
  if (u === "lb") {
    const v = parseLbRange(s);
    return v > 5 && v < 200 ? v : null;
  }
  const d = deflectionIn(s);
  if (!(d > 0.1 && d < 3)) return null;
  const lb = (material === "legno" ? 26 : 31.5) / d;
  return lb > 5 && lb < 250 ? lb : null;
}

/** flessione di un'asta di carbonio (millesimi, metodo 28″) con lo stesso spine in libbre */
export function carbonSpineFor(lb: number): number | null {
  if (!(lb > 5)) return null;
  return (31.5 / lb) * 1000;
}

/** spine in carbonio arrotondato come nei cataloghi (multipli di 50, di 100 sopra i 1000) */
export function catalogSpine(defl: number) {
  const step = defl > 1000 ? 100 : 50;
  return Math.round(defl / step) * step;
}

/** fascia di spine del legno (gruppi di 5 libbre, come le venditrici: 40-45, 45-50…) */
export function woodSpineBand(lb: number) {
  const lo = Math.floor(lb / 5) * 5;
  return `${lo}-${lo + 5}`;
}

/* ---------- pesi: in grammi, uno per freccia se diversi ---------- */

/** pesi delle singole frecce salvati come "26.1|27.3|…" (vuoto = non pesata) */
export function parseArrowWeights(raw: string | undefined | null): (number | null)[] {
  if (!raw) return [];
  return String(raw).split("|").map((x) => {
    const v = num(x);
    return v > 0 ? v : null;
  });
}

export function packArrowWeights(list: (number | null)[]): string {
  // tolgo i vuoti in fondo
  const a = [...list];
  while (a.length && a[a.length - 1] == null) a.pop();
  return a.map((v) => (v == null ? "" : String(Math.round(v * 100) / 100))).join("|");
}

/** numeri delle frecce da gara salvati come "2,5,9" */
export function parseRace(raw: string | undefined | null): number[] {
  return String(raw ?? "").split(/[,\s]+/).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0);
}

/** le k frecce con il peso più simile (scarto minimo): quelle da tenere per la gara */
export function pickRace(weights: { tag: number; g: number }[], k: number): number[] {
  const w = weights.filter((x) => x.g > 0).sort((a, b) => a.g - b.g);
  if (w.length < k || k < 1) return w.map((x) => x.tag);
  let best = 0;
  let bestSpan = Infinity;
  for (let i = 0; i + k <= w.length; i++) {
    const span = w[i + k - 1].g - w[i].g;
    if (span < bestSpan - 1e-9) {
      bestSpan = span;
      best = i;
    }
  }
  return w.slice(best, best + k).map((x) => x.tag).sort((a, b) => a - b);
}

export type WeightInfo = {
  /** peso medio in grammi */
  avgG: number;
  minG: number;
  maxG: number;
  /** pesate una per una */
  each: boolean;
  /** frecce da gara e il loro scarto */
  race: number[];
  raceMinG: number | null;
  raceMaxG: number | null;
};

/** peso della serie in grammi: dalle frecce pesate una per una, dalla fascia, dal peso medio o dai grani */
export function weightInfo(specs: Record<string, string | undefined>): WeightInfo | null {
  const from = Math.max(1, Number(specs.numFrom) || 1);
  const each = parseArrowWeights(specs.arrowsG);
  const race = parseRace(specs.race);
  const tagged = each.map((g, i) => ({ tag: from + i, g: g ?? 0 })).filter((x) => x.g > 0);
  if (tagged.length) {
    const gs = tagged.map((x) => x.g);
    const r = tagged.filter((x) => race.includes(x.tag)).map((x) => x.g);
    return {
      avgG: gs.reduce((a, b) => a + b, 0) / gs.length,
      minG: Math.min(...gs),
      maxG: Math.max(...gs),
      each: true,
      race,
      raceMinG: r.length ? Math.min(...r) : null,
      raceMaxG: r.length ? Math.max(...r) : null,
    };
  }
  const lo = num(specs.weightMinG);
  const hi = num(specs.weightMaxG);
  const avg = num(specs.weightG);
  const grains = num(specs.weight);
  const mid = avg > 0 ? avg : lo > 0 && hi > 0 ? (lo + hi) / 2 : grains > 0 ? grains / GRAINS_PER_G : NaN;
  if (!(mid > 0)) return null;
  return { avgG: mid, minG: lo > 0 ? lo : mid, maxG: hi > 0 ? hi : mid, each: false, race, raceMinG: null, raceMaxG: null };
}

const g1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");

/** "26,4 g (25,9–27,1)" */
export function weightLabel(w: WeightInfo | null): string {
  if (!w) return "";
  if (w.maxG - w.minG >= 0.05) return `${g1(w.avgG)} g (${g1(w.minG)}–${g1(w.maxG)})`;
  return `${g1(w.avgG)} g`;
}

/** "45 lb" o "600 (≈ 53 lb)" */
export function spineLabel(specs: Record<string, string | undefined>): string {
  const raw = String(specs.spine ?? "").trim();
  if (!raw) return "";
  const lb = spineLb(raw, specs.spineUnit, specs.material);
  const u = spineUnitOf(raw, specs.spineUnit);
  if (u === "lb") return `${raw.replace(/\s*#\s*$/, "")} lb`;
  return lb ? `${raw} (≈ ${Math.round(lb)} lb)` : raw;
}

/**
 * Spine consigliato in libbre per aste di legno con sgancio a dita (regola dei tradizionalisti):
 * libbre sulle dita al tuo allungo, +5 lb per ogni pollice di freccia oltre i 28″,
 * +5 lb ogni 25 grani di punta oltre i 125.
 */
export function woodSpineIdeal(lbOnFingers: number, arrowIn: number, pointGr: number): number | null {
  if (!(lbOnFingers > 10 && arrowIn > 20)) return null;
  const lb = lbOnFingers + 5 * (arrowIn - 28) + 5 * ((pointGr - 125) / 25);
  return lb > 10 ? lb : null;
}
