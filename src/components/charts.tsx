import { useEffect, useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TipItem = { name?: string; value?: number | string; color?: string; dataKey?: string | number; payload?: { fill?: string } };

function NiceTip({ active, payload, label, unit }: { active?: boolean; payload?: TipItem[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="aa-tip">
      {label ? <p className="mb-0.5 font-semibold text-muted">{label}</p> : null}
      {payload.map((item) => (
        <p key={`${String(item.dataKey)}-${item.name}`} className="flex items-center gap-1.5 tabular-nums">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: item.color ?? item.payload?.fill ?? "currentColor" }} />
          {item.name ? <span className="text-muted">{item.name}</span> : null}
          <b className="ml-auto pl-2">{typeof item.value === "number" ? +item.value.toFixed(2) : item.value}{unit ?? ""}</b>
        </p>
      ))}
    </div>
  );
}

const tip = (unit?: string) => ({
  cursor: { fill: "rgba(255,255,255,0.05)", stroke: "rgba(255,255,255,0.15)" },
  content: <NiceTip unit={unit} />,
  wrapperStyle: { background: "transparent", border: "none", boxShadow: "none", outline: "none" },
});

export type Ink = { primary: string; accent: string; soft: string; muted: string; line: string; fg: string; danger: string };

function useInk(): Ink {
  const [ink, setInk] = useState<Ink>({ primary: "#3d8f5f", accent: "#e0b15a", soft: "#9dbea4", muted: "#c9c0ae", line: "#c6a15a", fg: "#f3f0e8", danger: "#d15c56" });
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const v = (k: string, d: string) => s.getPropertyValue(k).trim() || d;
      setInk({
        primary: v("--primary", "#3d8f5f"),
        accent: v("--accent", "#e0b15a"),
        soft: v("--soft", "#9dbea4"),
        muted: v("--muted", "#c9c0ae"),
        line: v("--line-strong", "#c6a15a"),
        fg: v("--fg", "#f3f0e8"),
        danger: v("--danger", "#d15c56"),
      });
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ink"] });
    return () => obs.disconnect();
  }, []);
  return ink;
}

export function useThemeInk() {
  return useInk();
}

const box = "w-full min-w-0 select-none [-webkit-tap-highlight-color:transparent]";
const axis = (ink: Ink) => ({ tick: { fill: ink.muted, fontSize: 10 }, axisLine: false, tickLine: false });
const grid = (ink: Ink) => <CartesianGrid stroke={ink.fg} strokeOpacity={0.07} vertical={false} />;

/** Colori dei cerchi del bersaglio FITARCO/World Archery. */
export function ringColor(score: number, isX = false) {
  if (isX || score >= 9) return "#f2c94c";
  if (score >= 7) return "#e5484d";
  if (score >= 5) return "#3b82f6";
  if (score >= 3) return "#2a2f36";
  if (score >= 1) return "#e9edf1";
  return "#5b6470";
}

export function AvgLine({ data, height = 200 }: { data: { name: string; avg: number }[]; height?: number }) {
  const ink = useInk();
  const id = useId().replace(/:/g, "");
  if (data.length < 2) return <p className="text-xs text-muted">Servono almeno due allenamenti per la curva.</p>;
  return (
    <div className={box} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -6, bottom: 0 }} style={{ outline: "none" }}>
          <defs>
            <linearGradient id={`avg-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ink.accent} stopOpacity={0.45} />
              <stop offset="100%" stopColor={ink.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          {grid(ink)}
          <XAxis dataKey="name" {...axis(ink)} minTickGap={12} />
          <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} {...axis(ink)} width={34} tickFormatter={(v: number) => v.toFixed(1)} />
          <Tooltip {...tip()} />
          <Area type="monotone" dataKey="avg" name="Media" stroke={ink.accent} strokeWidth={2.2} fill={`url(#avg-${id})`} dot={false} activeDot={{ r: 4, fill: ink.accent, stroke: ink.fg, strokeWidth: 1.5 }} animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreLine({ data, label = "score", empty, height = 190 }: { data: { name: string; score: number }[]; label?: string; empty?: string; height?: number }) {
  const ink = useInk();
  const id = useId().replace(/:/g, "");
  if (data.length < 2) return <p className="text-xs text-muted">{empty ?? "Servono almeno due gare con punteggio per vedere se sali."}</p>;
  return (
    <div className={box} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -6, bottom: 0 }} style={{ outline: "none" }}>
          <defs>
            <linearGradient id={`sc-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ink.primary} stopOpacity={0.5} />
              <stop offset="100%" stopColor={ink.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          {grid(ink)}
          <XAxis dataKey="name" {...axis(ink)} minTickGap={12} />
          <YAxis domain={["dataMin - 4", "dataMax + 4"]} {...axis(ink)} width={36} allowDecimals={false} />
          <Tooltip {...tip()} />
          <Area type="monotone" dataKey="score" name={label} stroke={ink.primary} strokeWidth={2.4} fill={`url(#sc-${id})`} dot={{ r: 2.5, fill: ink.accent, strokeWidth: 0 }} activeDot={{ r: 4.5, fill: ink.accent, stroke: ink.fg, strokeWidth: 1.5 }} animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Distribuzione dei punti con i colori dei cerchi del bersaglio. */
export function DistBars({ data, height = 190 }: { data: { name: string; n: number }[]; height?: number }) {
  const ink = useInk();
  if (!data.length) return <p className="text-xs text-muted">Nessuna freccia in questo filtro.</p>;
  const total = data.reduce((a, d) => a + d.n, 0) || 1;
  return (
    <div className={box} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.map((d) => ({ ...d, pct: (d.n / total) * 100 }))} margin={{ top: 8, right: 4, left: -10, bottom: 0 }} barCategoryGap="38%" style={{ outline: "none" }}>
          {grid(ink)}
          <XAxis dataKey="name" {...axis(ink)} interval={0} />
          <YAxis {...axis(ink)} width={30} allowDecimals={false} />
          <Tooltip {...tip()} />
          <Bar dataKey="n" name="Frecce" radius={[4, 4, 1, 1]} activeBar={false} animationDuration={800} maxBarSize={14}>
            {data.map((d) => {
              const isX = /X$/.test(d.name);
              const score = Number.parseInt(d.name, 10) || 0;
              const c = ringColor(score, isX);
              return <Cell key={d.name} fill={c} stroke={c === "#2a2f36" ? "rgba(255,255,255,0.35)" : "none"} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MultiBars({ data, keys, height = 200 }: { data: { name: string; [key: string]: string | number }[]; keys: { key: string; color: string; name: string }[]; height?: number }) {
  const ink = useInk();
  if (!data.length || !keys.length) return <p className="text-xs text-muted">Scegli almeno due arcieri.</p>;
  return (
    <div className={box} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} style={{ outline: "none" }}>
          {grid(ink)}
          <XAxis dataKey="name" {...axis(ink)} />
          <YAxis {...axis(ink)} width={32} />
          <Tooltip {...tip()} />
          {keys.map((series) => (
            <Bar key={series.key} dataKey={series.key} name={series.name} fill={series.color} radius={[3, 3, 1, 1]} activeBar={false} maxBarSize={10} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Barre impilate (frecce per periodo, divise per serie) + linea della media
 * sull'asse di destra: come il grafico "Media delle frecce" dei riferimenti.
 */
export function ComboBars({
  data,
  stacks,
  line,
  height = 220,
}: {
  data: Array<Record<string, string | number | null>>;
  stacks: { key: string; name: string; color: string }[];
  line?: { key: string; name: string; color?: string };
  height?: number;
}) {
  const ink = useInk();
  if (!data.length) return <p className="text-xs text-muted">Nessun dato nel periodo scelto.</p>;
  return (
    <div className={box} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 0, left: -10, bottom: 0 }} barCategoryGap="40%" style={{ outline: "none" }}>
          {grid(ink)}
          <XAxis dataKey="name" {...axis(ink)} minTickGap={8} />
          <YAxis yAxisId="n" {...axis(ink)} width={32} allowDecimals={false} />
          {line ? <YAxis yAxisId="avg" orientation="right" {...axis(ink)} width={30} domain={[0, "dataMax + 1"]} tickFormatter={(v: number) => v.toFixed(0)} /> : null}
          <Tooltip {...tip()} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: ink.muted, paddingTop: 4 }} />
          {stacks.map((s, i) => (
            <Bar key={s.key} yAxisId="n" dataKey={s.key} name={s.name} stackId="a" fill={s.color} radius={i === stacks.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} maxBarSize={11} animationDuration={800} />
          ))}
          {line ? (
            <Line yAxisId="avg" type="monotone" dataKey={line.key} name={line.name} stroke={line.color ?? ink.fg} strokeWidth={2} dot={{ r: 2.5, fill: line.color ?? ink.fg, strokeWidth: 0 }} connectNulls animationDuration={900} />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Calendario a quadretti delle ultime settimane (intensità = frecce). */
export function ActivityHeat({ days, weeks = 18 }: { days: Record<string, number>; weeks?: number }) {
  const ink = useInk();
  const cell = 11;
  const gap = 3;
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // lunedì = 0
  const start = new Date(today);
  start.setDate(today.getDate() - dow - (weeks - 1) * 7);
  const max = Math.max(1, ...Object.values(days));
  const cells: { x: number; y: number; key: string; n: number }[] = [];
  const months: { x: number; label: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      if (day > today) continue;
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      cells.push({ x: w * (cell + gap), y: d * (cell + gap) + 12, key, n: days[key] ?? 0 });
      if (d === 0 && day.getDate() <= 7) months.push({ x: w * (cell + gap), label: day.toLocaleDateString("it-IT", { month: "short" }) });
    }
  }
  const W = weeks * (cell + gap);
  const H = 7 * (cell + gap) + 12;
  const active = Object.values(days).filter((n) => n > 0).length;
  return (
    <div className="overflow-x-auto [scrollbar-width:none]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[260px]" role="img" aria-label={`${active} giorni di tiro`}>
        {months.map((m) => (
          <text key={`${m.x}-${m.label}`} x={m.x} y={8} fontSize={8} fill={ink.muted}>{m.label}</text>
        ))}
        {cells.map((c, i) => {
          const t = c.n / max;
          return (
            <rect
              key={c.key}
              x={c.x}
              y={c.y}
              width={cell}
              height={cell}
              rx={3}
              fill={c.n ? ink.primary : ink.fg}
              fillOpacity={c.n ? 0.25 + 0.75 * t : 0.06}
              className="aa-rise"
              style={{ animationDelay: `${Math.min(i * 4, 600)}ms` }}
            >
              <title>{`${c.key}: ${c.n} frecce`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

/** Anello di avanzamento animato (0..1). */
export function Ring({ value, label, sub, color, size = 92 }: { value: number; label: string; sub?: string; color?: string; size?: number }) {
  const ink = useInk();
  const r = 40;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke={ink.fg} strokeOpacity={0.08} strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color ?? ink.accent}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="text-center leading-none">
        <p className="font-display text-xl tabular-nums">{label}</p>
        {sub ? <p className="mt-0.5 text-[0.6rem] uppercase tracking-wider text-muted">{sub}</p> : null}
      </div>
    </div>
  );
}
