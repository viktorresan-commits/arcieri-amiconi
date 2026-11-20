import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Chips, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLocalState, whistle } from "@/lib/arcieri/local-store";
import { award } from "@/lib/arcieri/xp";

export const Route = createFileRoute("/_app/routine")({ component: Page });

/** La tua sequenza di tiro: passi modificabili e una prova guidata che li mostra uno alla volta. */
const BASE = ["Posizione dei piedi", "Incocco", "Presa della corda e dell'impugnatura", "Pre-trazione e testa girata", "Trazione con la schiena", "Ancoraggio", "Trasferimento", "Mira", "Rilascio", "Follow-through"];

function Page() {
  const [st, setSt] = useLocalState<{ steps: string[]; sec: number; done: number }>("aa-routine-v1", { steps: BASE, sec: 3, done: 0 });
  const [mode, setMode] = useState<"lista" | "prova">("lista");
  const [i, setI] = useState(-1);
  const [text, setText] = useState("");
  useEffect(() => {
    if (mode !== "prova" || i < 0) return;
    if (i >= st.steps.length) {
      whistle(2);
      setSt({ ...st, done: st.done + 1 });
      award(5, "Routine di tiro ripassata");
      return;
    }
    const t = window.setTimeout(() => setI(i + 1), st.sec * 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, mode]);
  const move = (k: number, d: number) => {
    const next = [...st.steps];
    const j = k + d;
    if (j < 0 || j >= next.length) return;
    [next[k], next[j]] = [next[j], next[k]];
    setSt({ ...st, steps: next });
  };
  return (
    <div className="grid gap-3">
      <PageHead kicker="Allenati" title="Routine di tiro" lede="Sempre gli stessi passi, nello stesso ordine: è così che il tiro diventa ripetibile." />
      <Chips value={mode} onChange={(m) => { setMode(m); setI(-1); }} options={[{ id: "lista", label: "I miei passi" }, { id: "prova", label: "Prova guidata" }]} />
      {mode === "lista" ? (
        <Card className="grid gap-1">
          {st.steps.map((s, k) => (
            <div key={`${s}-${k}`} className="aa-menu-row flex items-center gap-2 rounded-xl px-1 py-1" style={{ animationDelay: `${k * 25}ms` }}>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-bold tabular-nums">{k + 1}</span>
              <span className="min-w-0 flex-1 text-sm">{s}</span>
              <button type="button" aria-label="Su" className="grid h-8 w-8 place-items-center rounded-lg bg-white/5" onClick={() => move(k, -1)}><Glyph name="chevron" size={14} className="-rotate-90" /></button>
              <button type="button" aria-label="Giù" className="grid h-8 w-8 place-items-center rounded-lg bg-white/5" onClick={() => move(k, 1)}><Glyph name="chevron" size={14} className="rotate-90" /></button>
              <button type="button" aria-label="Togli" className="grid h-8 w-8 place-items-center rounded-lg bg-white/5" onClick={() => setSt({ ...st, steps: st.steps.filter((_, j) => j !== k) })}><Glyph name="trash" size={13} /></button>
            </div>
          ))}
          <div className="mt-1 flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Aggiungi un passo" className="min-h-11 flex-1 rounded-xl border border-hair bg-black/20 px-3 text-sm outline-none" />
            <button type="button" className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-fg" onClick={() => { if (text.trim()) { setSt({ ...st, steps: [...st.steps, text.trim()] }); setText(""); } }} aria-label="Aggiungi"><Glyph name="plus" size={18} /></button>
          </div>
          <button type="button" className="mt-1 justify-self-start text-xs text-muted underline" onClick={() => setSt({ ...st, steps: BASE })}>Torna ai passi base</button>
        </Card>
      ) : (
        <Card className="grid justify-items-center gap-4 py-6 text-center">
          {i < 0 ? (
            <>
              <p className="text-sm text-muted">Fai il gesto a vuoto (o con l'elastico) mentre leggi ogni passo.</p>
              <Chips value={String(st.sec)} onChange={(v) => setSt({ ...st, sec: Number(v) })} options={[2, 3, 5].map((x) => ({ id: String(x), label: `${x} s per passo` }))} />
              <button type="button" className="aa-press min-h-12 rounded-2xl bg-primary px-8 font-semibold text-primary-fg" onClick={() => setI(0)}>Inizia</button>
            </>
          ) : i < st.steps.length ? (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Passo {i + 1} di {st.steps.length}</p>
              <p key={i} className="aa-pop font-display text-4xl leading-tight">{st.steps[i]}</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div key={i} className="aa-fill h-full rounded-full bg-primary" style={{ animationDuration: `${st.sec}s` }} />
              </div>
              <button type="button" className="text-sm text-muted" onClick={() => setI(i + 1)}>Avanti</button>
            </>
          ) : (
            <>
              <Glyph name="check" size={48} strokeWidth={2.4} className="text-emerald-300" />
              <p className="font-display text-2xl">Routine completa</p>
              <p className="text-sm text-muted">Ripassata {st.done} {st.done === 1 ? "volta" : "volte"}.</p>
              <button type="button" className="aa-chip" onClick={() => setI(0)}>Ancora</button>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
