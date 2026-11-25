import { useEffect, useId, useMemo, useState, type PointerEvent as RPointerEvent } from "react";
import type { FlightHit } from "@/lib/arcieri/flight";

type Mode = "velocita" | "energia" | "deriva" | "quota";
const MODES: { id: Mode; label: string; unit: string; color: string; note: string }[] = [
  { id: "velocita", label: "Velocità", unit: "m/s", color: "#7cc4ff", note: "La resistenza dell'aria frena la freccia: più è leggera e grossa, più perde lungo il volo." },
  { id: "energia", label: "Energia", unit: "J", color: "#ffb35c", note: "L'energia all'impatto decide quanto entra nel paglione o nella sagoma." },
  { id: "deriva", label: "Deriva", unit: "cm", color: "#7cf0a8", note: "Lo spostamento di lato dovuto al vento cresce più che in proporzione alla distanza." },
  { id: "quota", label: "Caduta", unit: "cm", color: "#f08ab4", note: "Quanto la freccia scende sotto la linea di partenza: è la parabola vista dal lato." },
];

/**
 * Grafici del volo lungo la distanza: velocità, energia, deriva da vento e caduta, con il tracciato
 * che si disegna e un cursore da trascinare per leggere i valori a ogni metro.
 */
export function FlightCurves({ hit, distance, replay = 0 }: { hit: FlightHit; distance: number; replay?: number }) {
  const uid = (useId().replace(/[^a-zA-Z0-9]/g, "") + "_");
  const [mode, setMode] = useState<Mode>("velocita");
  const [cursor, setCursor] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      setDrawn(k);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    setDrawn(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [mode, replay, distance]);

  const mass = (2 * hit.energy) / Math.max(1e-6, hit.v0 * hit.v0);
  const z0 = hit.path[0]?.z ?? 0;
  const pts = useMemo(
    () =>
      hit.path.map((p) => {
        const v = p.v ?? hit.v0;
        const value = mode === "velocita" ? v : mode === "energia" ? 0.5 * mass * v * v : mode === "deriva" ? (p.y ?? 0) * 100 : (p.z - z0 - Math.tan(hit.theta) * p.x) * 100;
        return { x: p.x, value, t: p.t ?? 0, v };
      }),
    [hit, mode, mass, z0],
  );
  const meta = MODES.find((m) => m.id === mode)!;
  const W = 360;
  const H = 210;
  const pad = { l: 40, r: 14, t: 16, b: 28 };
  const vals = pts.map((p) => p.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (mode === "velocita" || mode === "energia") lo = Math.min(lo, hi * 0.8);
  if (mode === "deriva" || mode === "quota") {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (hi - lo < 2) {
    const mid = (hi + lo) / 2;
    lo = mid - 1;
    hi = mid + 1;
  }
  const span = hi - lo;
  lo -= span * 0.08;
  hi += span * 0.12;
  const X = (x: number) => pad.l + (x / Math.max(1, distance)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.value).toFixed(1)}`).join(" ");
  const area = `${path} L${X(pts[pts.length - 1]?.x ?? 0).toFixed(1)} ${Y(lo).toFixed(1)} L${X(pts[0]?.x ?? 0).toFixed(1)} ${Y(lo).toFixed(1)} Z`;
  const ticks = niceTicks(lo, hi, 4);
  const xStep = distance > 60 ? 10 : distance > 25 ? 5 : 2;
  const xTicks: number[] = [];
  for (let x = 0; x <= distance + 1e-6; x += xStep) xTicks.push(x);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const at = cursor == null ? null : pts.reduce((b, p) => (Math.abs(p.x - cursor) < Math.abs(b.x - cursor) ? p : b), pts[0]);
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(".", ",");
  const loss = first && last && (mode === "velocita" || mode === "energia") ? Math.round((1 - last.value / Math.max(1e-6, first.value)) * 100) : null;

  const pick = (e: RPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setCursor(Math.max(0, Math.min(distance, ((px - pad.l) / (W - pad.l - pad.r)) * distance)));
  };

  return (
    <div className="grid gap-2 rounded-2xl border border-line bg-[#0f1a14] p-2.5">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
        {MODES.map((m) => (
          <button key={m.id} type="button" onClick={() => setMode(m.id)} className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold ${mode === m.id ? "text-[#0f1a14]" : "border border-line text-white/80"}`} style={mode === m.id ? { background: m.color } : undefined}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <Kpi k="Alla partenza" v={first ? `${fmt(first.value)} ${meta.unit}` : "–"} />
        <Kpi k={`A ${distance} m`} v={last ? `${fmt(last.value)} ${meta.unit}` : "–"} color={meta.color} />
        <Kpi k={loss != null ? "Persa" : "Tempo"} v={loss != null ? `${loss}%` : `${(last?.t ?? 0).toFixed(2).replace(".", ",")} s`} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full touch-none select-none" role="img" aria-label={`${meta.label} lungo il volo`} onPointerDown={pick} onPointerMove={(e) => e.buttons && pick(e)} onPointerLeave={() => setCursor(null)}>
        <defs>
          <linearGradient id={`${uid}a`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={meta.color} stopOpacity="0.35" />
            <stop offset="1" stopColor={meta.color} stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${uid}c`}>
            <rect x="0" y="0" width={pad.l + (W - pad.l - pad.r) * drawn} height={H} />
          </clipPath>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="rgba(244,241,234,0.08)" />
            <text x={pad.l - 6} y={Y(v) + 3} textAnchor="end" fontSize="9" fill="rgba(244,241,234,0.55)">{fmt(v)}</text>
          </g>
        ))}
        {(mode === "deriva" || mode === "quota") && lo < 0 && hi > 0 ? <line x1={pad.l} x2={W - pad.r} y1={Y(0)} y2={Y(0)} stroke="rgba(244,241,234,0.3)" strokeDasharray="3 3" /> : null}
        {xTicks.map((x) => (
          <text key={x} x={X(x)} y={H - 10} textAnchor="middle" fontSize="9" fill="rgba(244,241,234,0.55)">{x}</text>
        ))}
        <text x={W - pad.r} y={H - 1} textAnchor="end" fontSize="8.5" fill="rgba(244,241,234,0.4)">metri</text>
        <text x={pad.l} y={10} fontSize="8.5" fill="rgba(244,241,234,0.4)">{meta.unit}</text>
        <g clipPath={`url(#${uid}c)`}>
          <path d={area} fill={`url(#${uid}a)`} />
          <path d={path} fill="none" stroke={meta.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        </g>
        {drawn < 1 && pts.length ? (() => {
          const p = pts[Math.min(pts.length - 1, Math.floor(drawn * (pts.length - 1)))];
          return (
            <g transform={`translate(${X(p.x)} ${Y(p.value)})`}>
              <circle r="5" fill={meta.color} opacity="0.25" />
              <circle r="2.6" fill="#fff" />
            </g>
          );
        })() : null}
        {at ? (
          <g>
            <line x1={X(at.x)} x2={X(at.x)} y1={pad.t} y2={H - pad.b} stroke="#fff" strokeOpacity="0.5" />
            <circle cx={X(at.x)} cy={Y(at.value)} r="3.5" fill={meta.color} stroke="#fff" strokeWidth="1.2" />
            <g transform={`translate(${Math.min(W - pad.r - 96, Math.max(pad.l, X(at.x) - 48))} ${pad.t})`}>
              <rect width="96" height="34" rx="6" fill="rgba(10,16,14,0.88)" stroke="rgba(255,255,255,0.15)" />
              <text x="8" y="14" fontSize="10" fill="#fff" fontWeight="700">{fmt(at.value)} {meta.unit}</text>
              <text x="8" y="27" fontSize="9" fill="rgba(244,241,234,0.7)">a {at.x.toFixed(1).replace(".", ",")} m · {at.t.toFixed(2).replace(".", ",")} s</text>
            </g>
          </g>
        ) : null}
      </svg>
      <p className="text-[0.72rem] leading-snug text-muted">{meta.note} Tocca o trascina sul grafico per leggere i valori.</p>
    </div>
  );
}

function Kpi({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.05] px-1.5 py-1.5">
      <p className="text-[0.62rem] uppercase tracking-wider text-muted">{k}</p>
      <p className="text-sm font-bold tabular-nums" style={color ? { color } : undefined}>{v}</p>
    </div>
  );
}

function niceTicks(lo: number, hi: number, n: number) {
  const raw = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(Math.max(1e-9, raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}
