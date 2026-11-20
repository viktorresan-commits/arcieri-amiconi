import { useEffect, useId, useState, type PointerEvent as RPointerEvent } from "react";

export type ChartSeries = { name: string; color: string; points: { x: number; y: number }[]; unit?: string; dashed?: boolean };

/**
 * Grafico a linee degli strumenti: le curve si disegnano entrando, il punto attuale pulsa,
 * e toccando o trascinando si leggono i valori di tutte le serie in quel punto.
 */
export function ToolChart({ title, series, xLabel, yLabel, marker, fmtX = (x) => String(Math.round(x)), fmtY = (y) => (Math.abs(y) >= 100 ? y.toFixed(0) : y.toFixed(1)).replace(".", ","), band }: {
  title: string;
  series: ChartSeries[];
  xLabel: string;
  yLabel?: string;
  marker?: { x: number; label?: string };
  fmtX?: (x: number) => string;
  fmtY?: (y: number) => string;
  band?: { from: number; to: number; label: string };
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [cursor, setCursor] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(0);
  const sig = series.map((s) => `${s.name}:${s.points.length}:${s.points[0]?.y.toFixed(2)}:${s.points[s.points.length - 1]?.y.toFixed(2)}`).join("|");
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 800);
      setDrawn(1 - (1 - k) ** 3);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [sig]);

  const all = series.flatMap((s) => s.points);
  if (!all.length) return null;
  const W = 340;
  const H = 220;
  const pad = { l: 38, r: 12, t: 14, b: 30 };
  const x0 = Math.min(...all.map((p) => p.x));
  const x1 = Math.max(...all.map((p) => p.x));
  let lo = Math.min(...all.map((p) => p.y), 0);
  let hi = Math.max(...all.map((p) => p.y));
  if (hi - lo < 1e-6) hi = lo + 1;
  hi += (hi - lo) * 0.1;
  lo -= lo < 0 ? (hi - lo) * 0.05 : 0;
  const X = (x: number) => pad.l + ((x - x0) / Math.max(1e-6, x1 - x0)) * (W - pad.l - pad.r);
  const Y = (y: number) => pad.t + ((hi - y) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = nice(lo, hi, 4);
  const xticks = nice(x0, x1, 5).filter((x) => x >= x0 - 1e-9 && x <= x1 + 1e-9);
  const valueAt = (s: ChartSeries, x: number) => {
    const pts = s.points;
    if (x <= pts[0].x) return pts[0].y;
    for (let i = 1; i < pts.length; i += 1) {
      if (x <= pts[i].x) {
        const f = (x - pts[i - 1].x) / Math.max(1e-9, pts[i].x - pts[i - 1].x);
        return pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f;
      }
    }
    return pts[pts.length - 1].y;
  };
  const pick = (e: RPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setCursor(Math.max(x0, Math.min(x1, x0 + ((px - pad.l) / (W - pad.l - pad.r)) * (x1 - x0))));
  };
  const at = cursor ?? marker?.x ?? null;

  return (
    <div className="grid gap-2 rounded-2xl border border-line bg-[#0f1a14] p-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="mr-auto text-sm font-semibold">{title}</p>
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1 text-[0.7rem] text-muted">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color, opacity: s.dashed ? 0.6 : 1 }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full touch-none select-none" role="img" aria-label={title} onPointerDown={pick} onPointerMove={(e) => e.buttons && pick(e)} onPointerLeave={() => setCursor(null)}>
        <defs>
          <clipPath id={`${uid}c`}>
            <rect x="0" y="0" width={pad.l + (W - pad.l - pad.r) * drawn} height={H} />
          </clipPath>
          {series.map((s, i) => (
            <linearGradient key={s.name} id={`${uid}g${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {band ? (
          <g>
            <rect x={X(Math.max(x0, band.from))} y={pad.t} width={Math.max(0, X(Math.min(x1, band.to)) - X(Math.max(x0, band.from)))} height={H - pad.t - pad.b} fill="#7cf0a8" opacity="0.08" />
            <text x={(X(Math.max(x0, band.from)) + X(Math.min(x1, band.to))) / 2} y={pad.t + 10} textAnchor="middle" fontSize="8.5" fill="#7cf0a8" opacity="0.85">{band.label}</text>
          </g>
        ) : null}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="rgba(244,241,234,0.07)" />
            <text x={pad.l - 5} y={Y(v) + 3} textAnchor="end" fontSize="9" fill="rgba(244,241,234,0.55)">{fmtY(v)}</text>
          </g>
        ))}
        {xticks.map((x) => (
          <text key={x} x={X(x)} y={H - 12} textAnchor="middle" fontSize="9" fill="rgba(244,241,234,0.55)">{fmtX(x)}</text>
        ))}
        <text x={W - pad.r} y={H - 1} textAnchor="end" fontSize="8.5" fill="rgba(244,241,234,0.4)">{xLabel}</text>
        {yLabel ? <text x={4} y={9} fontSize="8.5" fill="rgba(244,241,234,0.4)">{yLabel}</text> : null}
        <g clipPath={`url(#${uid}c)`}>
          {series.map((s, i) => {
            const d = s.points.map((p, k) => `${k ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(" ");
            return (
              <g key={s.name}>
                {!s.dashed && i === 0 ? <path d={`${d} L${X(s.points[s.points.length - 1].x)} ${Y(Math.max(lo, 0))} L${X(s.points[0].x)} ${Y(Math.max(lo, 0))} Z`} fill={`url(#${uid}g${i})`} /> : null}
                <path d={d} fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.6 : 2.4} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" opacity={s.dashed ? 0.75 : 1} />
              </g>
            );
          })}
        </g>
        {at != null && drawn >= 1 ? (
          <g>
            <line x1={X(at)} x2={X(at)} y1={pad.t} y2={H - pad.b} stroke="#fff" strokeOpacity={cursor != null ? 0.55 : 0.3} strokeDasharray={cursor != null ? undefined : "3 3"} />
            {series.map((s) => (
              <g key={s.name}>
                {cursor == null ? <circle cx={X(at)} cy={Y(valueAt(s, at))} r="7" fill={s.color} opacity="0.25" className="aa-pulse-dot" /> : null}
                <circle cx={X(at)} cy={Y(valueAt(s, at))} r="3.4" fill={s.color} stroke="#0f1a14" strokeWidth="1.2" />
              </g>
            ))}
            <g transform={`translate(${Math.min(W - pad.r - 116, Math.max(pad.l, X(at) - 58))} ${pad.t + (band ? 14 : 0)})`}>
              <rect width="116" height={16 + series.length * 12} rx="6" fill="rgba(10,16,14,0.9)" stroke="rgba(255,255,255,0.14)" />
              <text x="7" y="12" fontSize="9" fill="rgba(244,241,234,0.75)">{cursor == null && marker?.label ? marker.label : `${xLabel} ${fmtX(at)}`}</text>
              {series.map((s, i) => (
                <text key={s.name} x="7" y={25 + i * 12} fontSize="9.5" fontWeight="700" fill={s.color}>{s.name}: {fmtY(valueAt(s, at))}{s.unit ? ` ${s.unit}` : ""}</text>
              ))}
            </g>
          </g>
        ) : null}
      </svg>
      <p className="text-[0.68rem] text-muted">Tocca o trascina sul grafico per leggere i valori.</p>
    </div>
  );
}

function nice(lo: number, hi: number, n: number) {
  const raw = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(Math.max(1e-9, raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}
