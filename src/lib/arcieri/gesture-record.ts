/**
 * Il dato completo di un'analisi del gesto salvata: punti del corpo (fotogramma dell'ancoraggio e
 * sequenza del tiro, per rivederla in 3D), angoli, misure in cm, tempi, tenuta e postura per zone.
 * Le statistiche del corpo leggono da qui, partendo dall'ultima analisi.
 */
import { metricsOf, type Gear, type Hand, type Landmark, type Metrics, type Sample, type Shot } from "./pose-analysis";
import { archeryKit, type KitNums } from "./pose-kit";
import { evaluate, proMedian, proMetrics, proSteadiness, type ProMetrics, type ProSetup } from "./pose-pro";

export type PackedLm = number[]; // x, y, z, visibilità per ognuno dei 33 punti

export type GestureRecord = {
  v: 2;
  hand: Hand;
  /** larghezza / altezza del fotogramma */
  aspect: number;
  /** punti del fotogramma salvato (ancoraggio, se trovato) */
  lm: PackedLm | null;
  /** sequenza del tiro: alzata → accompagnamento, al massimo 24 fotogrammi */
  seq: { t: number; lm: PackedLm }[];
  /** angoli del fotogramma salvato (gradi) */
  angles: Partial<Omit<Metrics, "drawPx" | "bowPx" | "bowUp">> & { bowUp?: boolean };
  /** misure in cm (allungo, ancoraggio, occhio–freccia, corda–naso) */
  kit: KitNums | null;
  /** tempi e tenuta del tiro */
  shot: { drawS: number | null; anchorS: number | null; releaseAt: number | null; followS: number | null; jitter: number | null; creep: number | null; score: number | null; parts: { label: string; value: number }[]; notes: string[] } | null;
  /** postura per zone del corpo (sempre, anche senza analisi pro) */
  posture: { total: number; areas: Record<string, number | null>; issues: string[]; m: Partial<ProMetrics> } | null;
  heightCm: number;
  /** dati del vecchio formato, se presenti */
  pro?: { total?: number; areas?: Record<string, number | null>; issues?: string[]; m?: Partial<ProMetrics> };
  checks?: string[];
  spread?: unknown;
};

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function packLm(lm: Landmark[] | null | undefined): PackedLm | null {
  if (!lm || lm.length < 25) return null;
  const out: number[] = [];
  for (let i = 0; i < 33; i++) {
    const p = lm[i] ?? { x: 0, y: 0, z: 0, visibility: 0 };
    out.push(r3(p.x), r3(p.y), r3(p.z ?? 0), Math.round((p.visibility ?? 1) * 100) / 100);
  }
  return out;
}

export function unpackLm(a: PackedLm | null | undefined): Landmark[] | null {
  if (!Array.isArray(a) || a.length < 33 * 4) return null;
  const out: Landmark[] = [];
  for (let i = 0; i < 33; i++) out.push({ x: a[i * 4], y: a[i * 4 + 1], z: a[i * 4 + 2], visibility: a[i * 4 + 3] });
  return out;
}

/** impostazioni dell'analisi pro (tipo d'arco, freccia, altezza) salvate sul telefono */
export function readProSetup(): ProSetup {
  try {
    const raw = JSON.parse(localStorage.getItem("aa-pose-pro-setup") || "null") as Partial<ProSetup> | null;
    return { bowType: raw?.bowType || "olimpico", arrowIn: Number(raw?.arrowIn) || 29, heightCm: Number(raw?.heightCm) || 0 };
  } catch {
    return { bowType: "olimpico", arrowIn: 29, heightCm: 0 };
  }
}

const roundObj = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, typeof v === "number" ? Math.round(v * 100) / 100 : v])) as Partial<T>;

/** costruisce il dato completo da salvare */
export function buildRecord(input: { lm: Landmark[] | null; samples: Sample[]; shot: Shot | null; hand: Hand; aspect: number; w: number; h: number; gear: Gear | null; setup?: ProSetup }): GestureRecord {
  const { lm, samples, shot, hand, aspect, w, h, gear } = input;
  const setup = input.setup ?? readProSetup();
  const m = lm ? metricsOf(lm, hand, aspect, h) : null;
  const kit = lm ? archeryKit(lm, w, h, hand, gear)?.nums ?? null : null;
  // sequenza: dal primo campione dell'alzata alla fine dell'accompagnamento, al massimo 24 fotogrammi
  let seq: { t: number; lm: PackedLm }[] = [];
  const withLm = samples.filter((s) => s.lm);
  if (withLm.length > 1) {
    const from = shot?.phases[0]?.from ?? withLm[0].t;
    const to = shot?.phases[shot.phases.length - 1]?.to ?? withLm[withLm.length - 1].t;
    const span = withLm.filter((s) => s.t >= from - 0.2 && s.t <= to + 0.2);
    const pick = span.length > 24 ? Array.from({ length: 24 }, (_, i) => span[Math.round((i / 23) * (span.length - 1))]) : span;
    seq = pick.map((s) => ({ t: Math.round((s.t - pick[0].t) * 100) / 100, lm: packLm(s.lm)! })).filter((x) => x.lm);
  }
  // postura per zone: mediana dell'ancoraggio se c'è un tiro, altrimenti il fotogramma
  let posture: GestureRecord["posture"] = null;
  const frames = shot && samples.length
    ? samples.filter((s) => s.lm && s.t >= shot.anchorFrom && s.t <= (shot.release ?? shot.anchorTo)).map((s) => proMetrics(s.lm!, hand, aspect, setup)).filter((x): x is ProMetrics => Boolean(x))
    : lm ? [proMetrics(lm, hand, aspect, setup)].filter((x): x is ProMetrics => Boolean(x)) : [];
  const pm = proMedian(frames);
  if (pm) {
    const ev = evaluate(pm, setup, frames.length >= 3 ? proSteadiness(frames) : null);
    posture = {
      total: ev.total,
      areas: Object.fromEntries(ev.areas.map((a) => [a.id, a.score == null ? null : Math.round(a.score)])),
      issues: ev.issues.slice(0, 6).map((x) => x.title),
      m: roundObj(pm as unknown as Record<string, unknown>) as Partial<ProMetrics>,
    };
  }
  const angles = m ? (roundObj({ draw: m.draw, bow: m.bow, shoulder: m.shoulder, trunk: m.trunk, line: m.line, bowSh: m.bowSh, drawSh: m.drawSh, stance: m.stance, arrowTilt: m.arrowTilt, handFace: m.handFace, spread: m.spread }) as GestureRecord["angles"]) : {};
  if (m) angles.bowUp = m.bowUp;
  return {
    v: 2,
    hand,
    aspect: Math.round(aspect * 10000) / 10000,
    lm: packLm(lm),
    seq,
    angles,
    kit: kit ? (roundObj(kit as unknown as Record<string, unknown>) as unknown as KitNums) : null,
    shot: shot
      ? {
          drawS: shot.drawTime,
          anchorS: shot.anchorTime,
          releaseAt: shot.release,
          followS: shot.follow,
          jitter: shot.jitter,
          creep: shot.creep,
          score: shot.score,
          parts: shot.parts.map((p) => ({ label: p.label, value: Math.round(p.value) })),
          notes: shot.notes.slice(0, 8),
        }
      : null,
    posture,
    heightCm: setup.heightCm,
  };
}

/** legge il dato salvato (nuovo o vecchio formato) */
export function readRecord(json: string): Partial<GestureRecord> {
  try {
    const d = JSON.parse(json || "{}") as Partial<GestureRecord>;
    return d && typeof d === "object" ? d : {};
  } catch {
    return {};
  }
}

/** allungo in cm: quello dell'analisi pro (con l'altezza) se c'è, altrimenti la stima dal corpo */
export function drawCmOf(d: Partial<GestureRecord>): number | null {
  const v = d.pro?.m?.drawLenCm ?? d.posture?.m?.drawLenCm ?? d.kit?.drawCm ?? null;
  return typeof v === "number" && v > 40 && v < 95 ? v : null;
}

/** punteggio di postura su 100: analisi pro, altrimenti la postura per zone calcolata al salvataggio */
export function postureOf(d: Partial<GestureRecord>): { total: number; areas: Record<string, number | null> } | null {
  if (typeof d.pro?.total === "number") return { total: d.pro.total, areas: d.pro.areas ?? {} };
  if (d.posture) return { total: d.posture.total, areas: d.posture.areas };
  return null;
}
