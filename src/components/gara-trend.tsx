import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/components/kit";

export type GaraPoint = {
  id: string;
  day: string;
  name: string;
  laneCount: number | null;
  score: number | null;
  spot: number | null;
  championshipPoints: number | null;
};

/** le misure che si possono seguire gara dopo gara (una alla volta: un solo asse, niente scale mescolate) */
const METRICS = [
  { id: "score", label: "Punti", unit: "punti", get: (g: GaraPoint) => g.score },
  { id: "avg", label: "Media a piazzola", unit: "a piazzola", get: (g: GaraPoint) => (g.score != null && g.laneCount ? Math.round((g.score / g.laneCount) * 10) / 10 : null) },
  { id: "spot", label: "Spot", unit: "spot", get: (g: GaraPoint) => g.spot },
  { id: "champ", label: "Campionato", unit: "pt campionato", get: (g: GaraPoint) => g.championshipPoints },
] as const;
type MetricId = (typeof METRICS)[number]["id"];

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const MONTHS_LONG = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
/** «15 nov», o «15 nov 24» quando le gare coprono più anni */
const dayShort = (d: string, years = false) => {
  const [y, m, g] = d.split("-").map(Number);
  return m ? `${g} ${MONTHS[m - 1]}${years ? ` ${String(y).slice(2)}` : ""}` : d;
};
const dayLong = (d: string) => {
  const [y, m, g] = d.split("-").map(Number);
  return m ? `${g} ${MONTHS_LONG[m - 1]} ${y}` : d;
};
const fmt = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 1 });

function sign(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${fmt(Math.abs(n))}`;
}

function line(g: GaraPoint) {
  return [
    g.laneCount != null ? `${g.laneCount} piazzole` : null,
    g.score != null ? `${g.score} punti` : null,
    g.spot != null ? `${g.spot} spot` : null,
    g.championshipPoints != null ? `${g.championshipPoints} pt campionato` : null,
  ].filter(Boolean).join(" · ") || "Senza numeri";
}

function deltaText(curr: GaraPoint, prev: GaraPoint) {
  const bits = [
    curr.score != null && prev.score != null ? `${sign(curr.score - prev.score)} punti` : null,
    curr.spot != null && prev.spot != null ? `${sign(curr.spot - prev.spot)} spot` : null,
    curr.championshipPoints != null && prev.championshipPoints != null ? `${sign(curr.championshipPoints - prev.championshipPoints)} campionato` : null,
    curr.laneCount != null && prev.laneCount != null ? `${sign(curr.laneCount - prev.laneCount)} piazzole` : null,
  ].filter(Boolean);
  return bits.length ? `Rispetto alla precedente: ${bits.join(" · ")}` : "La precedente non ha gli stessi numeri da confrontare.";
}

/** tacche "tonde" dell'asse: 1, 2, 2.5, 5 per potenze di dieci */
function niceTicks(lo: number, hi: number, want = 4) {
  if (lo === hi) {
    const pad = Math.max(1, Math.abs(lo) * 0.1);
    lo -= pad;
    hi += pad;
  }
  const raw = (hi - lo) / want;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? 10 * p;
  const a = Math.floor(lo / step) * step;
  const b = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let v = a; v <= b + step / 2; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/** curva morbida che non va mai oltre i punti (Fritsch–Carlson): niente picchi inventati tra una gara e l'altra */
function monotone(pts: { x: number; y: number }[]) {
  const n = pts.length;
  if (n < 2) return "";
  if (n === 2) return `M${pts[0].x} ${pts[0].y} L${pts[1].x} ${pts[1].y}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push((pts[i + 1].y - pts[i].y) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]));
  t.push(m[n - 2]);
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(pts[i].x + h).toFixed(1)} ${(pts[i].y + t[i] * h).toFixed(1)} ${(pts[i + 1].x - h).toFixed(1)} ${(pts[i + 1].y - t[i + 1] * h).toFixed(1)} ${pts[i + 1].x.toFixed(1)} ${pts[i + 1].y.toFixed(1)}`;
  }
  return d;
}

/**
 * Tra gara e gara: una linea per la misura scelta (punti, media a piazzola, spot, punti campionato),
 * un punto per gara. Si tocca un punto per vedere la gara e lo scarto dalla precedente; l'elenco
 * completo resta a un tocco.
 */
export function GaraTrend({ points, activeId }: { points: GaraPoint[]; activeId?: string }) {
  const available = METRICS.filter((mt) => points.some((g) => mt.get(g) != null));
  const [metric, setMetric] = useState<MetricId>(available[0]?.id ?? "score");
  const mt = METRICS.find((x) => x.id === metric) ?? METRICS[0];
  const start = Math.max(0, activeId ? points.findIndex((g) => g.id === activeId) : points.length - 1);
  const [sel, setSel] = useState(start);
  const [list, setList] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setSel(start), [points.length, start]);

  const chart = useMemo(() => {
    const H = 188;
    const pad = { l: 40, r: 18, t: 30, b: 30 };
    const vals = points.map((g) => mt.get(g));
    const known = vals.filter((v): v is number => v != null);
    const ticks = known.length ? niceTicks(Math.min(...known), Math.max(...known)) : [0, 1];
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const iw = w - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const xAt = (i: number) => pad.l + (points.length === 1 ? iw / 2 : (iw * i) / (points.length - 1));
    const yAt = (v: number) => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
    const pts = vals.map((v, i) => (v == null ? null : { x: xAt(i), y: yAt(v), v, i }));
    // la linea si interrompe dove manca il numero
    const runs: { x: number; y: number }[][] = [];
    let cur: { x: number; y: number }[] = [];
    for (const p of pts) {
      if (p) cur.push(p);
      else if (cur.length) {
        runs.push(cur);
        cur = [];
      }
    }
    if (cur.length) runs.push(cur);
    // etichette dei giorni: tutte se ci stanno, altrimenti una ogni tanto (sempre prima e ultima)
    const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 58))));
    return { H, pad, ticks, xAt, yAt, pts, runs, iw, ih, every, lo };
  }, [points, mt, w]);

  if (!points.length) return <p className="text-sm text-muted">Nessun punteggio da confrontare.</p>;
  const g = points[Math.min(sel, points.length - 1)];
  const prev = sel > 0 ? points[sel - 1] : null;
  const v = mt.get(g);
  const pv = prev ? mt.get(prev) : null;
  const best = Math.max(...points.map((x) => mt.get(x) ?? -Infinity));
  const { H, pad, ticks, xAt, yAt, pts, runs, iw, every } = chart;
  const sp = pts[sel];

  return (
    <div className="grid gap-3">
      {available.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Cosa seguire">
          {available.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === metric} onClick={() => setMetric(x.id)} className={cx("rounded-full border px-3 py-1.5 text-xs font-semibold", x.id === metric ? "border-transparent bg-[var(--sec,#c4475a)] text-white" : "border-line text-muted")}>
              {x.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* la gara scelta: il numero grande e lo scarto dalla precedente */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted">{dayLong(g.day)}{g.name ? ` · ${g.name}` : ""}</p>
          <p className="font-display text-4xl leading-none tabular-nums">
            {v != null ? fmt(v) : "—"} <span className="font-sans text-sm font-semibold text-muted">{mt.unit}</span>
          </p>
        </div>
        {v != null && pv != null ? (
          <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums", v - pv > 0 ? "bg-[#2f9e6a]/20 text-[#7fd6a8]" : v - pv < 0 ? "bg-[#d6402f]/20 text-[#f0a093]" : "bg-white/10 text-muted")}>
            {sign(v - pv)} sulla precedente
          </span>
        ) : v != null && v === best && points.length > 1 ? <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-muted">Il migliore</span> : null}
      </div>

      <div ref={box} className="relative -mx-1">
        <svg viewBox={`0 0 ${w} ${H}`} width="100%" height={H} role="img" aria-label={`${mt.label}, gara dopo gara`} className="block select-none overflow-visible">
          <defs>
            <linearGradient id={`gt-area-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--sec, #c4475a)" stopOpacity="0.32" />
              <stop offset="1" stopColor="var(--sec, #c4475a)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* griglia leggera e valori dell'asse */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={pad.l + iw} y1={yAt(t)} y2={yAt(t)} stroke="#fff" strokeOpacity="0.07" strokeDasharray="3 4" />
              <text x={pad.l - 8} y={yAt(t) + 3.5} textAnchor="end" fontSize="10.5" fill="currentColor" className="text-muted" opacity="0.8">{fmt(t)}</text>
            </g>
          ))}
          <line x1={pad.l} x2={pad.l + iw} y1={pad.t + chart.ih} y2={pad.t + chart.ih} stroke="#fff" strokeOpacity="0.16" />
          {/* area e linea */}
          {runs.map((r, i) => (
            <g key={i}>
              {r.length > 1 ? <path d={`${monotone(r)} L${r[r.length - 1].x.toFixed(1)} ${pad.t + chart.ih} L${r[0].x.toFixed(1)} ${pad.t + chart.ih} Z`} fill={`url(#gt-area-${metric})`} /> : null}
              {r.length > 1 ? <path d={monotone(r)} fill="none" stroke="var(--sec, #c4475a)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
            </g>
          ))}
          {/* guida verticale sulla gara scelta */}
          {sp ? <line x1={sp.x} x2={sp.x} y1={pad.t - 6} y2={pad.t + chart.ih} stroke="#fff" strokeOpacity="0.22" strokeDasharray="2 3" /> : null}
          {pts.map((p) =>
            p ? (
              <circle key={p.i} cx={p.x} cy={p.y} r={p.i === sel ? 6 : 4.5} fill={p.i === sel ? "var(--sec, #c4475a)" : "var(--surface, #161a1f)"} stroke={p.i === sel ? "#fff" : "var(--sec, #c4475a)"} strokeWidth={p.i === sel ? 2.5 : 2} />
            ) : null,
          )}
          {/* valore sopra la gara scelta */}
          {sp ? (
            <g transform={`translate(${Math.min(Math.max(sp.x, pad.l + 18), pad.l + iw - 18)} ${sp.y - 14})`}>
              <rect x="-20" y="-13" width="40" height="18" rx="9" fill="#0d1013" fillOpacity="0.85" stroke="#fff" strokeOpacity="0.15" />
              <text y="0" textAnchor="middle" fontSize="11" fontWeight="700" fill="#f3f0e8">{fmt(sp.v)}</text>
            </g>
          ) : null}
          {/* giorni */}
          {points.map((x, i) =>
            i % every === 0 || i === points.length - 1 ? (
              <text key={x.id} x={xAt(i)} y={H - 8} textAnchor={points.length === 1 ? "middle" : i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="10.5" fill="currentColor" className={i === sel ? "" : "text-muted"} fontWeight={i === sel ? 700 : 400}>
                {dayShort(x.day, points[0].day.slice(0, 4) !== points[points.length - 1].day.slice(0, 4))}
              </text>
            ) : null,
          )}
          {/* zone da toccare, più larghe dei punti */}
          {points.map((x, i) => {
            const half = points.length === 1 ? iw / 2 : iw / (points.length - 1) / 2;
            return <rect key={`h${x.id}`} x={xAt(i) - half} y={0} width={half * 2} height={H} fill="transparent" onClick={() => setSel(i)} style={{ cursor: "pointer" }} aria-label={`${dayLong(x.day)} ${x.name}`} />;
          })}
        </svg>
        {points.length === 1 ? <p className="absolute inset-x-0 bottom-9 text-center text-xs text-muted">Con la prossima gara compare la linea.</p> : null}
      </div>

      <div className="rounded-xl border border-line px-3 py-2">
        <p className="text-sm font-semibold">{line(g)}</p>
        <p className="text-xs text-muted">{prev ? deltaText(g, prev) : "Prima gara segnata. Il confronto arriva con la successiva."}</p>
      </div>

      <button type="button" onClick={() => setList((x) => !x)} className="justify-self-start text-xs font-semibold text-muted underline-offset-2 hover:underline">
        {list ? "Nascondi l'elenco" : `Elenco delle ${points.length} gare`}
      </button>
      {list ? (
        <ol className="grid gap-2">
          {points.map((x, i) => (
            <li key={x.id}>
              <button type="button" onClick={() => setSel(i)} className={cx("w-full rounded-xl border px-3 py-2 text-left", i === sel || x.id === activeId ? "border-accent" : "border-line")}>
                <p className="text-xs text-muted">{dayLong(x.day)}{x.name ? ` · ${x.name}` : ""}</p>
                <p className="text-sm font-semibold">{line(x)}</p>
                <p className="text-xs text-muted">{i > 0 ? deltaText(x, points[i - 1]) : "Prima gara segnata."}</p>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
