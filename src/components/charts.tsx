import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function QuietTip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number | string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pointer-events-none text-xs font-semibold text-white">
      {payload.map((item) => (
        <p key={`${item.name}-${item.value}`}>{label ? `${label} · ` : ""}{item.name ? `${item.name} ` : ""}{item.value}</p>
      ))}
    </div>
  );
}

const tip = { cursor: false as const, content: <QuietTip />, wrapperStyle: { background: "transparent", border: "none", boxShadow: "none", outline: "none" } };

function useInk() {
  const [ink, setInk] = useState({ primary: "#3d8f5f", accent: "#e0b15a", soft: "#9dbea4", muted: "#c9c0ae", line: "#c6a15a" });
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      setInk({
        primary: s.getPropertyValue("--primary").trim() || "#3d8f5f",
        accent: s.getPropertyValue("--accent").trim() || "#e0b15a",
        soft: s.getPropertyValue("--soft").trim() || "#9dbea4",
        muted: s.getPropertyValue("--muted").trim() || "#c9c0ae",
        line: s.getPropertyValue("--line").trim() || "#c6a15a",
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

export function AvgLine({ data }: { data: { name: string; avg: number }[] }) {
  const ink = useInk();
  if (data.length < 2) return <p className="text-sm text-muted">Servono almeno due allenamenti per la curva.</p>;
  return (
    <div className="h-56 w-full min-w-0 select-none [-webkit-tap-highlight-color:transparent]" style={{ WebkitTapHighlightColor: "transparent" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} style={{ outline: "none" }}>
          <CartesianGrid stroke={ink.line} strokeOpacity={0.35} vertical={false} />
          <XAxis dataKey="name" tick={{ fill: ink.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} tick={{ fill: ink.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip {...tip} />
          <Line type="monotone" dataKey="avg" stroke={ink.accent} strokeWidth={2} dot={false} activeDot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreLine({ data, label = "score", empty }: { data: { name: string; score: number }[]; label?: string; empty?: string }) {
  const ink = useInk();
  if (data.length < 2) return <p className="text-sm text-muted">{empty ?? "Servono almeno due gare con punteggio per vedere se sali."}</p>;
  return (
    <div className="h-56 w-full min-w-0 select-none [-webkit-tap-highlight-color:transparent]" style={{ WebkitTapHighlightColor: "transparent" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} style={{ outline: "none" }}>
          <CartesianGrid stroke={ink.line} strokeOpacity={0.35} vertical={false} />
          <XAxis dataKey="name" tick={{ fill: ink.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={["dataMin - 4", "dataMax + 4"]} tick={{ fill: ink.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip {...tip} />
          <Line type="monotone" dataKey="score" name={label} stroke={ink.primary} strokeWidth={2.5} dot={{ r: 3, fill: ink.accent }} activeDot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistBars({ data }: { data: { name: string; n: number }[] }) {
  const ink = useInk();
  if (!data.length) return <p className="text-sm text-muted">Nessuna freccia in questo filtro.</p>;
  return (
    <div className="h-56 w-full min-w-0 select-none [-webkit-tap-highlight-color:transparent]" style={{ WebkitTapHighlightColor: "transparent" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} style={{ outline: "none" }}>
          <CartesianGrid stroke={ink.line} strokeOpacity={0.35} vertical={false} />
          <XAxis dataKey="name" tick={{ fill: ink.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: ink.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip {...tip} />
          <Bar dataKey="n" fill={ink.primary} radius={6} activeBar={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MultiBars({ data, keys }: { data: { name: string; [key: string]: string | number }[]; keys: { key: string; color: string; name: string }[] }) {
  const ink = useInk();
  if (!data.length || !keys.length) return <p className="text-sm text-muted">Scegli almeno due arcieri.</p>;
  return (
    <div className="h-56 w-full min-w-0 select-none [-webkit-tap-highlight-color:transparent]" style={{ WebkitTapHighlightColor: "transparent" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} style={{ outline: "none" }}>
          <CartesianGrid stroke={ink.line} strokeOpacity={0.35} vertical={false} />
          <XAxis dataKey="name" tick={{ fill: ink.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: ink.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip {...tip} />
          {keys.map((series) => (
            <Bar key={series.key} dataKey={series.key} name={series.name} fill={series.color} radius={6} activeBar={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
