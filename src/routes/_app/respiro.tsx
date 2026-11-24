import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Chips, PageHead } from "@/components/kit";
import { useLocalState, useWakeLock } from "@/lib/arcieri/local-store";
import { award } from "@/lib/arcieri/xp";

export const Route = createFileRoute("/_app/respiro")({ component: Page });

/** Respirazione guidata: il cerchio si gonfia e si sgonfia con il tempo giusto. */
const MODES: Record<string, { name: string; hint: string; steps: [string, number, number][] }> = {
  volee: { name: "Prima della volée", hint: "Inspira 4, tieni 2, espira 6", steps: [["Inspira", 4, 1], ["Tieni", 2, 1], ["Espira", 6, 0]] },
  box: { name: "Quadrato", hint: "4 · 4 · 4 · 4: calma e attenzione", steps: [["Inspira", 4, 1], ["Tieni", 4, 1], ["Espira", 4, 0], ["Tieni", 4, 0]] },
  ansia: { name: "Gara, agitazione", hint: "Inspira 4, tieni 7, espira 8", steps: [["Inspira", 4, 1], ["Tieni", 7, 1], ["Espira", 8, 0]] },
};

/** il contenuto della pagina, anche dentro un'altra pagina (senza intestazione) */
export function RespiroBody({ embedded = false }: { embedded?: boolean }) {
  const [st, setSt] = useLocalState<{ mode: string; cycles: number }>("aa-respiro-v1", { mode: "volee", cycles: 0 });
  const m = MODES[st.mode] ?? MODES.volee;
  const [run, setRun] = useState(false);
  const [k, setK] = useState(0);
  const [left, setLeft] = useState(m.steps[0][1]);
  const [round, setRound] = useState(0);
  useWakeLock(run);
  useEffect(() => {
    setK(0);
    setLeft(m.steps[0][1]);
    setRun(false);
    setRound(0);
  }, [st.mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!run) return;
    const t = window.setTimeout(() => {
      if (left > 1) setLeft(left - 1);
      else {
        const nk = (k + 1) % m.steps.length;
        if (nk === 0) {
          setRound((r) => r + 1);
          setSt((s) => ({ ...s, cycles: s.cycles + 1 }));
          logBreath(st.mode);
          if (round + 1 === 5) award(5, "Cinque respiri guidati");
        }
        setK(nk);
        setLeft(m.steps[nk][1]);
        if (navigator.vibrate) navigator.vibrate(15);
      }
    }, 1000);
    return () => window.clearTimeout(t);
  }, [run, left, k, m, round, setSt]);
  const [label, dur, full] = m.steps[k];
  return (
    <div className="grid gap-3">
      {embedded ? null : <PageHead kicker="Allenati" title="Respiro" lede="Pochi respiri lenti abbassano il battito e fermano la mira." />}
      <Chips value={st.mode} onChange={(mode) => setSt({ ...st, mode })} options={Object.entries(MODES).map(([id, x]) => ({ id, label: x.name }))} />
      <Card className="grid justify-items-center gap-4 py-8">
        <div className="relative grid h-64 w-64 place-items-center">
          <span className="absolute inset-0 rounded-full bg-sky-400/10" />
          <span
            className="absolute rounded-full"
            style={{
              inset: 0,
              background: "radial-gradient(circle at 40% 35%, rgba(159,233,255,0.9), rgba(58,143,196,0.55) 60%, rgba(58,143,196,0.15))",
              transform: `scale(${run ? (full ? 1 : 0.45) : 0.55})`,
              transition: `transform ${run ? dur : 0.6}s ${label === "Tieni" ? "linear" : "cubic-bezier(.45,0,.55,1)"}`,
              boxShadow: "0 0 60px rgba(124,200,255,0.35)",
            }}
          />
          <div className="relative text-center">
            <p className="font-display text-3xl">{run ? label : "Pronto"}</p>
            <p className="font-display text-5xl tabular-nums">{run ? left : ""}</p>
          </div>
        </div>
        <p className="text-sm text-muted">{m.hint}</p>
        <button type="button" className="aa-press min-h-12 rounded-2xl bg-primary px-8 font-semibold text-primary-fg" onClick={() => setRun(!run)}>{run ? "Pausa" : "Inizia"}</button>
        <p className="text-xs text-muted">Giri oggi: {round} · in tutto: {st.cycles}</p>
      </Card>
    </div>
  );
}

/** Diario dei respiri guidati per giorno (per le statistiche): { "2026-11-20": { volee: 3, ... } }. */
function logBreath(mode: string) {
  try {
    const day = new Date().toLocaleDateString("sv-SE");
    const all = JSON.parse(localStorage.getItem("aa-respiro-days") || "{}") as Record<string, Record<string, number>>;
    all[day] = { ...(all[day] ?? {}), [mode]: ((all[day] ?? {})[mode] ?? 0) + 1 };
    localStorage.setItem("aa-respiro-days", JSON.stringify(all));
  } catch {
    /* memoria non disponibile */
  }
}

function Page() {
  return <RespiroBody />;
}
