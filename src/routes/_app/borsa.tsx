import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Chips, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLocalState, whistle, useWakeLock } from "@/lib/arcieri/local-store";

export const Route = createFileRoute("/_app/borsa")({ component: Page });

/**
 * Prima di partire: la borsa da controllare (voci base + tue) e un riscaldamento guidato a tempo.
 * Tutto si salva da solo sul telefono.
 */
type Item = { id: string; label: string; group: string };
const BASE: Item[] = [
  { id: "arco", label: "Arco e flettenti", group: "Arco" },
  { id: "corda", label: "Corda di ricambio", group: "Arco" },
  { id: "mirino", label: "Mirino e diottra", group: "Arco" },
  { id: "stab", label: "Stabilizzatori", group: "Arco" },
  { id: "frecce", label: "Frecce (più una di scorta)", group: "Frecce" },
  { id: "punte", label: "Punte e cocche di ricambio", group: "Frecce" },
  { id: "faretra", label: "Faretra", group: "Frecce" },
  { id: "patella", label: "Patella o sgancio", group: "Arciere" },
  { id: "parabraccio", label: "Parabraccio e pettorale", group: "Arciere" },
  { id: "elastico", label: "Elastico per il riscaldamento", group: "Arciere" },
  { id: "chiavi", label: "Brugole e attrezzi", group: "Kit" },
  { id: "cera", label: "Cera per corda", group: "Kit" },
  { id: "tessera", label: "Tessera federale", group: "Kit" },
  { id: "acqua", label: "Acqua e cappellino", group: "Kit" },
];
type Bag = { done: string[]; extra: Item[]; hidden: string[]; last?: string };

type Step = { label: string; sec: number; hint: string };
const ROUTINES: Record<string, { name: string; steps: Step[] }> = {
  breve: {
    name: "Breve 5 min",
    steps: [
      { label: "Spalle", sec: 45, hint: "Cerchi lenti avanti e indietro" },
      { label: "Braccia incrociate", sec: 40, hint: "Tira il braccio sul petto, poi cambia" },
      { label: "Collo", sec: 30, hint: "Inclina piano, senza scatti" },
      { label: "Elastico: trazioni", sec: 60, hint: "Apri come in trazione, scapole indietro" },
      { label: "Elastico: tenute", sec: 60, hint: "Tieni 5 secondi in ancoraggio, rilascia piano" },
      { label: "Respiro", sec: 45, hint: "Inspira 4, espira 6: entra nel ritmo" },
    ],
  },
  gara: {
    name: "Gara 10 min",
    steps: [
      { label: "Attivazione", sec: 60, hint: "Cammina, scuoti le braccia" },
      { label: "Spalle", sec: 60, hint: "Cerchi ampi, poi piccoli" },
      { label: "Rotatori", sec: 60, hint: "Gomito a 90°, ruota fuori con l'elastico" },
      { label: "Dorsali", sec: 60, hint: "Elastico sopra la testa, apri verso il basso" },
      { label: "Trazioni", sec: 90, hint: "Dieci aperture complete, lente" },
      { label: "Tenute", sec: 90, hint: "Tieni in ancoraggio 7 secondi" },
      { label: "Polsi e dita", sec: 45, hint: "Apri e chiudi, stendi le dita" },
      { label: "Visualizza", sec: 60, hint: "Occhi chiusi: tre tiri perfetti in sequenza" },
    ],
  },
};

const ringPath = (r: number) => 2 * Math.PI * r;

function Page() {
  const [tab, setTab] = useState<"borsa" | "riscaldamento">("borsa");
  return (
    <div className="grid gap-3">
      <PageHead kicker="Prima di partire" title={tab === "borsa" ? "La borsa" : "Riscaldamento"} lede={tab === "borsa" ? "Spunta mentre prepari. Si salva da solo." : "Segui il tempo: un fischio a ogni cambio."} />
      <Chips value={tab} onChange={setTab} options={[{ id: "borsa", label: "Borsa" }, { id: "riscaldamento", label: "Riscaldamento" }]} />
      <div key={tab} className="aa-rise">{tab === "borsa" ? <BagList /> : <WarmUp />}</div>
    </div>
  );
}

function BagList() {
  const [bag, setBag] = useLocalState<Bag>("aa-borsa-v1", { done: [], extra: [], hidden: [] });
  const [text, setText] = useState("");
  const [edit, setEdit] = useState(false);
  const items = [...BASE.filter((i) => !bag.hidden.includes(i.id)), ...bag.extra];
  const done = items.filter((i) => bag.done.includes(i.id)).length;
  const pct = items.length ? done / items.length : 0;
  const groups = [...new Set(items.map((i) => i.group))];
  const toggle = (id: string) => setBag({ ...bag, done: bag.done.includes(id) ? bag.done.filter((d) => d !== id) : [...bag.done, id] });
  const add = () => {
    const label = text.trim();
    if (!label) return;
    setBag({ ...bag, extra: [...bag.extra, { id: `x${Date.now()}`, label, group: "Mie" }] });
    setText("");
  };
  const remove = (id: string) =>
    setBag(id.startsWith("x") ? { ...bag, extra: bag.extra.filter((i) => i.id !== id), done: bag.done.filter((d) => d !== id) } : { ...bag, hidden: [...bag.hidden, id], done: bag.done.filter((d) => d !== id) });
  const R = 30;
  const C = ringPath(R);

  return (
    <div className="grid gap-3">
      <Card className="flex items-center gap-4">
        <svg viewBox="0 0 76 76" className="h-20 w-20 shrink-0 -rotate-90">
          <circle cx="38" cy="38" r={R} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth="7" />
          <circle cx="38" cy="38" r={R} fill="none" stroke={pct === 1 ? "#7cf0a8" : "var(--primary)"} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: "stroke-dashoffset .5s cubic-bezier(.22,1,.36,1), stroke .3s" }} />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl tabular-nums">{done}/{items.length}</p>
          <p className="text-sm text-muted">{pct === 1 ? "Borsa pronta. Buon tiro." : `Mancano ${items.length - done} cose`}</p>
          {bag.last ? <p className="text-[0.68rem] text-muted">Ultima uscita: {bag.last}</p> : null}
        </div>
        <button type="button" className="aa-chip" onClick={() => setBag({ ...bag, done: [], last: new Date().toLocaleDateString("it-IT", { day: "numeric", month: "short" }) })}>
          <Glyph name="broom" size={14} /> Nuova uscita
        </button>
      </Card>
      {groups.map((g) => (
        <Card key={g} className="grid gap-1">
          <p className="aa-section-title mb-1">{g}</p>
          {items.filter((i) => i.group === g).map((i) => {
            const on = bag.done.includes(i.id);
            return (
              <div key={i.id} className="flex items-center gap-2">
                <button type="button" onClick={() => toggle(i.id)} className={`aa-check flex min-h-11 flex-1 items-center gap-3 rounded-xl px-2 text-left ${on ? "is-on" : ""}`} aria-pressed={on}>
                  <span className="aa-check-box grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-hair">{on ? <Glyph name="check" size={14} strokeWidth={2.4} /> : null}</span>
                  <span className={`text-sm transition ${on ? "text-muted line-through" : ""}`}>{i.label}</span>
                </button>
                {edit ? (
                  <button type="button" className="grid h-9 w-9 place-items-center rounded-lg bg-white/5" onClick={() => remove(i.id)} aria-label={`Togli ${i.label}`}>
                    <Glyph name="trash" size={14} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </Card>
      ))}
      <Card className="grid gap-2">
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Aggiungi una cosa da portare" className="min-h-11 flex-1 rounded-xl border border-hair bg-black/20 px-3 text-sm outline-none" />
          <button type="button" className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-fg" onClick={add} aria-label="Aggiungi">
            <Glyph name="plus" size={18} />
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" className="aa-chip" aria-pressed={edit} onClick={() => setEdit(!edit)}>{edit ? "Fatto" : "Modifica lista"}</button>
          {bag.hidden.length ? <button type="button" className="aa-chip" onClick={() => setBag({ ...bag, hidden: [] })}>Ripristina voci base</button> : null}
        </div>
      </Card>
    </div>
  );
}

function WarmUp() {
  const [which, setWhich] = useLocalState<{ id: string }>("aa-warmup-v1", { id: "breve" });
  const routine = ROUTINES[which.id] ?? ROUTINES.breve;
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(routine.steps[0].sec);
  const [run, setRun] = useState(false);
  const finished = idx >= routine.steps.length;
  const step = routine.steps[Math.min(idx, routine.steps.length - 1)];
  useWakeLock(run);

  useEffect(() => {
    setIdx(0);
    setLeft(routine.steps[0].sec);
    setRun(false);
  }, [routine]);

  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [run]);

  useEffect(() => {
    if (!run || left > 0) return;
    const next = idx + 1;
    if (next >= routine.steps.length) {
      whistle(3);
      setRun(false);
      setIdx(next);
    } else {
      whistle(1);
      setIdx(next);
      setLeft(routine.steps[next].sec);
    }
  }, [left, run, idx, routine]);

  const total = routine.steps.reduce((a, s) => a + s.sec, 0);
  const elapsed = routine.steps.slice(0, idx).reduce((a, s) => a + s.sec, 0) + (finished ? 0 : step.sec - left);
  const R = 78;
  const C = ringPath(R);
  const frac = finished ? 1 : 1 - left / step.sec;

  return (
    <div className="grid gap-3">
      <Chips value={which.id} onChange={(id) => setWhich({ id })} options={Object.entries(ROUTINES).map(([id, r]) => ({ id, label: r.name }))} />
      <Card className="grid justify-items-center gap-3 py-5">
        <div className="relative">
          <svg viewBox="0 0 180 180" className="h-48 w-48 -rotate-90">
            <circle cx="90" cy="90" r={R} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth="10" />
            <circle cx="90" cy="90" r={R} fill="none" stroke={finished ? "#7cf0a8" : "var(--accent)"} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-display text-5xl tabular-nums">{finished ? "Fatto" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</p>
              <p className="text-xs text-muted">{finished ? "Sei pronto" : `${idx + 1} di ${routine.steps.length}`}</p>
            </div>
          </div>
        </div>
        {!finished ? (
          <div key={idx} className="aa-rise text-center">
            <p className="font-display text-xl">{step.label}</p>
            <p className="text-sm text-muted">{step.hint}</p>
          </div>
        ) : null}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${(elapsed / total) * 100}%` }} />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="min-h-12 rounded-2xl bg-primary px-6 font-semibold text-primary-fg"
            onClick={() => {
              if (finished) {
                setIdx(0);
                setLeft(routine.steps[0].sec);
                setRun(true);
              } else setRun(!run);
            }}
          >
            {finished ? "Ripeti" : run ? "Pausa" : elapsed > 0 ? "Riprendi" : "Inizia"}
          </button>
          {!finished ? (
            <button type="button" className="min-h-12 rounded-2xl bg-white/5 px-4" onClick={() => setLeft(0)} aria-label="Salta">
              Salta
            </button>
          ) : null}
        </div>
      </Card>
      <Card className="grid gap-1">
        {routine.steps.map((s, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 transition ${i === idx ? "bg-primary/15" : ""} ${i < idx ? "opacity-50" : ""}`}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/5 text-[0.65rem] tabular-nums">{i < idx ? <Glyph name="check" size={12} /> : i + 1}</span>
            <span className="flex-1 text-sm">{s.label}</span>
            <span className="text-xs tabular-nums text-muted">{s.sec}s</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
