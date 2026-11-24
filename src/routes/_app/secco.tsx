import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Chips, PageHead, Segmented } from "@/components/kit";
import { useEntryState } from "@/lib/arcieri/back-restore";
import { RoutineBody } from "./routine";
import { RespiroBody } from "./respiro";
import { Glyph } from "@/components/icons";
import { useLocalState, useWakeLock, whistle } from "@/lib/arcieri/local-store";
import { award } from "@/lib/arcieri/xp";

export const Route = createFileRoute("/_app/secco")({ component: Page });

/**
 * Allenamento a secco (SPT): tenute in ancoraggio con l'arco o con l'elastico.
 * Serie × ripetizioni, tenuta e recupero a tempo; un fischio a ogni cambio.
 */
type Plan = { sets: number; reps: number; hold: number; rest: number; pause: number };
const PRESETS: Record<string, { name: string; plan: Plan }> = {
  base: { name: "Base", plan: { sets: 3, reps: 5, hold: 7, rest: 3, pause: 60 } },
  forza: { name: "Forza", plan: { sets: 4, reps: 6, hold: 10, rest: 5, pause: 75 } },
  resist: { name: "Resistenza", plan: { sets: 3, reps: 10, hold: 5, rest: 5, pause: 60 } },
};
type Phase = "pronto" | "tieni" | "rilascia" | "pausa" | "fine";
type Store = { preset: string; done: number; seconds: number; last?: string };

const COLORS: Record<Phase, string> = { pronto: "#7c8aa5", tieni: "#e5484d", rilascia: "#2fbf71", pausa: "#e3a21a", fine: "#7cf0a8" };
const LABEL: Record<Phase, string> = { pronto: "Pronto", tieni: "Tieni", rilascia: "Rilascia", pausa: "Pausa", fine: "Finito" };

/** il contenuto della pagina, anche dentro un'altra pagina (senza intestazione) */
export function SeccoBody({ embedded = false }: { embedded?: boolean }) {
  const [store, setStore] = useLocalState<Store>("aa-secco-v1", { preset: "base", done: 0, seconds: 0 });
  const plan = (PRESETS[store.preset] ?? PRESETS.base).plan;
  const [phase, setPhase] = useState<Phase>("pronto");
  const [set, setSet] = useState(0);
  const [rep, setRep] = useState(0);
  const [left, setLeft] = useState(3);
  const [run, setRun] = useState(false);
  const held = useRef(0);
  useWakeLock(run);

  const reset = () => {
    setRun(false);
    setPhase("pronto");
    setSet(0);
    setRep(0);
    setLeft(3);
    held.current = 0;
  };
  useEffect(reset, [store.preset]);

  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => {
      setLeft((s) => s - 1);
      if (phase === "tieni") held.current += 1;
    }, 1000);
    return () => clearInterval(t);
  }, [run, phase]);

  useEffect(() => {
    if (!run || left > 0) return;
    if (phase === "pronto" || phase === "pausa" || phase === "rilascia") {
      if (phase === "rilascia" && rep + 1 >= plan.reps) {
        // fine della serie
        if (set + 1 >= plan.sets) {
          whistle(3);
          setPhase("fine");
          setRun(false);
          setStore({ ...store, done: store.done + 1, seconds: store.seconds + held.current, last: new Date().toISOString() });
          award(10, "Tenute a secco", `secco-${new Date().toLocaleDateString("sv-SE")}`);
          return;
        }
        whistle(2, 1500);
        setPhase("pausa");
        setLeft(plan.pause);
        setSet(set + 1);
        setRep(0);
        return;
      }
      if (phase === "rilascia") setRep(rep + 1);
      whistle(1);
      setPhase("tieni");
      setLeft(plan.hold);
      return;
    }
    if (phase === "tieni") {
      whistle(2, 1500);
      setPhase("rilascia");
      setLeft(plan.rest);
    }
  }, [left, run, phase, rep, set, plan, store, setStore]);

  const total = phase === "tieni" ? plan.hold : phase === "rilascia" ? plan.rest : phase === "pausa" ? plan.pause : 3;
  const frac = phase === "fine" ? 1 : 1 - left / total;
  const R = 80;
  const C = 2 * Math.PI * R;
  const color = COLORS[phase];
  const doneReps = set * plan.reps + rep + (phase === "rilascia" ? 1 : 0);
  const allReps = plan.sets * plan.reps;

  return (
    <div className="grid gap-3">
      {embedded ? null : <PageHead kicker="Allenamento a secco" title="Tenute" lede="Arco o elastico in ancoraggio: tieni quando fischia una volta, rilascia piano con due." />}
      <Chips value={store.preset} onChange={(preset) => setStore({ ...store, preset })} options={Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.name }))} />
      <Card className="grid justify-items-center gap-3 py-5">
        <div className="relative">
          <svg viewBox="0 0 190 190" className="h-52 w-52 -rotate-90">
            <circle cx="95" cy="95" r={R} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth="12" />
            <circle cx="95" cy="95" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }} />
          </svg>
          <div className={`absolute inset-6 grid place-items-center rounded-full text-center transition-colors ${phase === "tieni" ? "aa-breathe" : ""}`} style={{ background: `radial-gradient(circle, color-mix(in srgb, ${color} 22%, transparent), transparent 70%)` }}>
            <div>
              <p className="font-display text-6xl tabular-nums">{phase === "fine" ? <Glyph name="check" size={48} strokeWidth={2.4} className="mx-auto" /> : left}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color }}>{LABEL[phase]}</p>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted">Serie {Math.min(set + 1, plan.sets)} di {plan.sets} · ripetizione {Math.min(rep + 1, plan.reps)} di {plan.reps}</p>
        <div className="flex gap-1">
          {Array.from({ length: allReps }, (_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i < doneReps ? "w-3 bg-primary" : "w-1.5 bg-white/15"} ${i > 0 && i % plan.reps === 0 ? "ml-1.5" : ""}`} />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="min-h-12 rounded-2xl bg-primary px-7 font-semibold text-primary-fg"
            onClick={() => {
              if (phase === "fine") {
                reset();
                setRun(true);
              } else setRun(!run);
            }}
          >
            {phase === "fine" ? "Ancora" : run ? "Pausa" : phase === "pronto" && set === 0 && rep === 0 ? "Inizia" : "Riprendi"}
          </button>
          <button type="button" className="min-h-12 rounded-2xl bg-white/5 px-4" onClick={reset}>Da capo</button>
        </div>
      </Card>
      <Card className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Tenuta" value={`${plan.hold} s`} />
        <Stat label="Recupero" value={`${plan.rest} s`} />
        <Stat label="Tra le serie" value={`${plan.pause} s`} />
      </Card>
      <Card className="grid grid-cols-2 gap-2 text-center">
        <Stat label="Sedute fatte" value={String(store.done)} />
        <Stat label="Tempo in tenuta" value={`${Math.floor(store.seconds / 60)} min`} />
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-xl tabular-nums">{value}</p>
      <p className="text-[0.65rem] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

/** A secco, routine di tiro e respiro: un'unica sezione con tre schede */
function Page() {
  const [view, setView] = useEntryState<"secco" | "routine" | "respiro">("secco-vista", "secco");
  const lede = view === "routine" ? "Sempre gli stessi passi, nello stesso ordine: è così che il tiro diventa ripetibile." : view === "respiro" ? "Pochi respiri lenti abbassano il battito e fermano la mira." : "Arco o elastico in ancoraggio: tieni quando fischia una volta, rilascia piano con due.";
  return (
    <div className="grid gap-3">
      <PageHead kicker="Allenati" title="A secco, routine e respiro" lede={lede} />
      <Segmented value={view} onChange={setView} options={[{ id: "secco", label: "A secco" }, { id: "routine", label: "Routine" }, { id: "respiro", label: "Respiro" }]} />
      {view === "routine" ? <RoutineBody embedded /> : view === "respiro" ? <RespiroBody embedded /> : <SeccoBody embedded />}
    </div>
  );
}
