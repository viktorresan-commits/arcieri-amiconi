import { useEffect, useState } from "react";
import { WEEK_GOALS, usePrefs } from "@/lib/arcieri/prefs";
import { AppIcon, Glyph } from "./icons";

/**
 * "Il tuo percorso": livello dalle frecce tirate, serie di giorni e obiettivo della settimana.
 * L'obiettivo si sceglie toccando l'anello e resta sul telefono.
 */

const LEVELS = ["Novizio", "Apprendista", "Arciere", "Tiratore", "Esperto", "Veterano", "Maestro", "Campione", "Leggenda"];

/** Frecce necessarie per raggiungere il livello n (0 = Novizio): crescono a gradini. */
const need = (n: number) => 150 * n * (n + 1);

function levelOf(arrows: number) {
  let n = 0;
  while (n < LEVELS.length - 1 && arrows >= need(n + 1)) n += 1;
  const from = need(n);
  const to = n < LEVELS.length - 1 ? need(n + 1) : from;
  return { n, name: LEVELS[n], pct: to > from ? (arrows - from) / (to - from) : 1, left: Math.max(0, to - arrows) };
}

export function JourneyCard({ totalArrows, weekArrows, streak }: { totalArrows: number; weekArrows: number; streak: number }) {
  const { prefs, update } = usePrefs();
  const goal = prefs.weekGoal;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(1), 120);
    return () => window.clearTimeout(t);
  }, []);
  const lv = levelOf(totalArrows);
  const week = Math.min(1, weekArrows / goal);
  const r = 30;
  const c = 2 * Math.PI * r;
  const nextGoal = () => update({ weekGoal: WEEK_GOALS[(WEEK_GOALS.indexOf(goal) + 1) % WEEK_GOALS.length] });
  return (
    <section className="aa-journey relative overflow-hidden rounded-[var(--radius-card)] border border-hair p-3.5">
      <div className="flex items-center justify-between">
        <h2 className="aa-section-title">Il tuo percorso</h2>
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">Livello {lv.n + 1}</span>
      </div>
      <div className="mt-2.5 grid grid-cols-[auto_1fr] items-center gap-3.5">
        <button type="button" onClick={nextGoal} className="relative grid h-[84px] w-[84px] place-items-center" aria-label={`Obiettivo settimanale ${goal} frecce: tocca per cambiarlo`}>
          <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
            <defs>
              <linearGradient id="aa-week-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f2c94c" />
                <stop offset="100%" stopColor="#e07a2f" />
              </linearGradient>
            </defs>
            <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth="8" />
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              stroke="url(#aa-week-grad)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${c * week * shown} ${c}`}
              style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.22,1,0.36,1)" }}
            />
          </svg>
          <span className="text-center leading-none">
            <span className="block font-display text-[1.5rem] tabular-nums">{weekArrows}</span>
            <span className="mt-0.5 block text-[0.58rem] uppercase tracking-wider text-muted">di {goal}</span>
          </span>
        </button>
        <div className="grid min-w-0 gap-2.5">
          <div className="flex items-center gap-2.5">
            <AppIcon name="level" color="#c39320" size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-semibold">{lv.name}</p>
                <p className="shrink-0 text-[0.65rem] tabular-nums text-muted">{lv.left ? `${lv.left.toLocaleString("it-IT")} frecce al prossimo` : "livello massimo"}</p>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[#f2c94c] to-[#e07a2f]" style={{ width: `${Math.round(lv.pct * 100 * shown)}%`, transition: "width 1.1s cubic-bezier(0.22,1,0.36,1)" }} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <AppIcon name="flame" color={streak ? "#d6582a" : "#55647b"} size={36} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{streak ? `${streak} ${streak === 1 ? "giorno" : "giorni"} di fila` : "Nessuna serie aperta"}</p>
              <p className="text-[0.68rem] text-muted">{streak ? "Tira anche domani per allungarla." : "Una volée oggi e la serie riparte."}</p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[0.66rem] text-muted">
        <Glyph name="edit" size={12} /> Tocca l'anello per cambiare l'obiettivo della settimana.
      </p>
    </section>
  );
}
