import { ConvertButton } from "./unit-converter";
import type { ReactNode } from "react";

/** Pezzi comuni delle pagine strumento: campo numerico con unità, riquadro risultato. */
export function Num({ label, unit, value, onChange, hint }: { label: string; unit?: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted">
        {label}
        {hint ? <span className="opacity-70"> · {hint}</span> : null}
      </span>
      <span className="flex items-center gap-1 rounded-xl border border-hair bg-black/20 px-3 focus-within:border-primary/70">
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 w-full min-w-0 bg-transparent text-base tabular-nums outline-none" />
        {unit ? <span className="text-xs text-muted">{unit}</span> : null}
        {unit ? <ConvertButton unit={unit} value={value} onUse={onChange} className="ml-1.5" /> : null}
      </span>
    </label>
  );
}

export function Mini({ k, v, tone }: { k: string; v: ReactNode; tone?: "ok" | "warn" | "bad" }) {
  const c = tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-rose-300" : "";
  return (
    <span className="rounded-xl bg-white/[0.05] px-2 py-1.5 text-center">
      <span className="block text-[0.6rem] uppercase tracking-wider text-muted">{k}</span>
      <b key={String(v)} className={`aa-pop block font-display text-lg tabular-nums ${c}`}>{v}</b>
    </span>
  );
}

export const num = (s: string) => Number(String(s).replace(",", "."));
export const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d).replace(".", ",") : "—");
