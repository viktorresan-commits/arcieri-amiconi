import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Card, ErrorNote, Field, Select, TextArea, TextInput, cx } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { deletePlan, savePlan, type Plan, type PlanItem } from "@/lib/arcieri/istruttore.api";

/** esercizi pronti da aggiungere con un tocco; l'allenatore poi li corregge */
const READY: PlanItem[] = [
  { title: "Riscaldamento", detail: "Spalle, braccia e schiena con l'elastico, 10 minuti.", distance: null, arrows: null },
  { title: "Tiro al bianco", detail: "Paglione vicino senza visuale: solo il gesto, occhi anche chiusi.", distance: 5, arrows: 30 },
  { title: "Volée di controllo", detail: "Serie da 6 frecce, segna tutte le volée nell'app.", distance: 18, arrows: 36 },
  { title: "Ancoraggio e trazione", detail: "Stessa altezza di ancoraggio a ogni freccia, trazione con la schiena.", distance: 10, arrows: 24 },
  { title: "Routine e respiro", detail: "Prima di ogni freccia: respiro, mira, rilascio. Una frase guida.", distance: null, arrows: null },
  { title: "Analisi del gesto", detail: "Un video di profilo dall'app, da rivedere insieme.", distance: null, arrows: 6 },
];

const blank = (): PlanItem => ({ title: "", detail: "", distance: null, arrows: null });

export function planProgress(p: Plan) {
  const total = p.items.length;
  const done = p.done.length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

function fmtDay(d: string) {
  if (!d) return "";
  const [y, m, g] = d.split("-");
  return `${Number(g)}/${Number(m)}/${y.slice(2)}`;
}

export function planWhen(p: Pick<Plan, "startsOn" | "endsOn">) {
  if (p.startsOn && p.endsOn) return `dal ${fmtDay(p.startsOn)} al ${fmtDay(p.endsOn)}`;
  if (p.startsOn) return `dal ${fmtDay(p.startsOn)}`;
  if (p.endsOn) return `entro il ${fmtDay(p.endsOn)}`;
  return "";
}

/** riepilogo di un esercizio: distanza e frecce, se ci sono */
export function itemMeta(x: PlanItem) {
  return [x.distance ? `${x.distance} m` : "", x.arrows ? `${x.arrows} frecce` : ""].filter(Boolean).join(" · ");
}

/** scrivere o correggere una scheda: titolo, obiettivo, periodo, esercizi, note */
export function PlanEditor({ memberId, athleteName, plan, onSaved, onCancel }: { memberId: number; athleteName: string; plan?: Plan | null; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(plan?.title ?? "");
  const [goal, setGoal] = useState(plan?.goal ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [startsOn, setStartsOn] = useState(plan?.startsOn ?? new Date().toISOString().slice(0, 10));
  const [endsOn, setEndsOn] = useState(plan?.endsOn ?? "");
  const [items, setItems] = useState<PlanItem[]>(plan?.items.length ? plan.items : [blank()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (i: number, patch: Partial<PlanItem>) => setItems((list) => list.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => setItems((list) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v)) || 0) || null);
  const save = () => {
    setBusy(true);
    setErr("");
    savePlan({ data: { id: plan?.id ?? null, memberId, title, goal, notes, items: items.filter((x) => x.title.trim()), startsOn: startsOn || null, endsOn: endsOn || null, status: plan?.status ?? "attiva" } })
      .then(onSaved)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Scheda non salvata."))
      .finally(() => setBusy(false));
  };
  return (
    <Card className="grid gap-3">
      <div>
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted">{plan ? "Modifica la scheda" : "Nuova scheda"} · {athleteName}</p>
        <p className="mt-0.5 text-xs text-muted">L'allievo la trova nel Menu in «Le mie schede» e spunta gli esercizi man mano.</p>
      </div>
      <Field label="Titolo"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="es. Settimana 1 · ancoraggio stabile" maxLength={90} /></Field>
      <Field label="Obiettivo"><TextInput value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="es. media sopra 7 a 18 m" maxLength={300} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Dal"><TextInput type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></Field>
        <Field label="Al (facoltativo)"><TextInput type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} /></Field>
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-semibold">Esercizi</p>
        {items.map((x, i) => (
          <div key={i} className="grid gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-2.5">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.08] font-display text-sm">{i + 1}</span>
              <TextInput value={x.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Esercizio" maxLength={90} />
            </div>
            <TextArea value={x.detail} onChange={(e) => set(i, { detail: e.target.value })} rows={2} placeholder="Come farlo, a cosa fare attenzione" maxLength={400} />
            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <Field label="Distanza (m)"><TextInput inputMode="numeric" value={x.distance ?? ""} onChange={(e) => set(i, { distance: num(e.target.value) })} placeholder="—" /></Field>
              <Field label="Frecce"><TextInput inputMode="numeric" value={x.arrows ?? ""} onChange={(e) => set(i, { arrows: num(e.target.value) })} placeholder="—" /></Field>
              <div className="flex gap-1 pb-0.5">
                <button type="button" aria-label="Sposta su" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-10 w-9 place-items-center rounded-xl bg-white/[0.06] disabled:opacity-30"><Glyph name="chevron" size={14} className="-rotate-90" /></button>
                <button type="button" aria-label="Sposta giù" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="grid h-10 w-9 place-items-center rounded-xl bg-white/[0.06] disabled:opacity-30"><Glyph name="chevron" size={14} className="rotate-90" /></button>
                <button type="button" aria-label="Togli l'esercizio" onClick={() => setItems((list) => (list.length > 1 ? list.filter((_, k) => k !== i) : [blank()]))} className="grid h-10 w-9 place-items-center rounded-xl bg-white/[0.06] text-lg leading-none text-rose-300">×</button>
              </div>
            </div>
          </div>
        ))}
        <Button variant="ghost" onClick={() => setItems((list) => [...list, blank()])} disabled={items.length >= 24}>Aggiungi un esercizio</Button>
        <div className="grid gap-1.5">
          <p className="text-xs text-muted">Esercizi pronti: tocca per aggiungere, poi correggi</p>
          <div className="flex flex-wrap gap-1.5">
            {READY.map((r) => (
              <button key={r.title} type="button" className="aa-chip" onClick={() => setItems((list) => [...list.filter((x) => x.title.trim()), { ...r }].slice(0, 24))}>+ {r.title}</button>
            ))}
          </div>
        </div>
      </div>
      <Field label="Note per l'allievo"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Consigli, cosa guardare, quando ci rivediamo" maxLength={1200} /></Field>
      {err ? <ErrorNote text={err} /> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Annulla</Button>
        <Button onClick={save} disabled={busy}>{busy ? "Salvo…" : plan ? "Salva le modifiche" : "Crea la scheda"}</Button>
      </div>
    </Card>
  );
}

/** una scheda vista dall'allenatore: avanzamento, esercizi, nota dell'allievo e azioni */
export function CoachPlanCard({ plan, memberId, onEdit, onChanged, showAthlete = false }: { plan: Plan; memberId: number; onEdit?: () => void; onChanged: () => void; showAthlete?: boolean }) {
  const [open, setOpen] = useState(plan.status === "attiva");
  const [armed, setArmed] = useState(false);
  const [err, setErr] = useState("");
  const pr = planProgress(plan);
  const when = planWhen(plan);
  const flip = () =>
    savePlan({ data: { ...plan, id: plan.id, memberId, status: plan.status === "attiva" ? "conclusa" : "attiva" } })
      .then(onChanged)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non riuscito."));
  return (
    <Card className={cx("grid gap-2", plan.status === "conclusa" && "opacity-75")}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-start gap-3 text-left">
        <span className="relative grid h-12 w-12 shrink-0 place-items-center">
          <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
            <circle cx="24" cy="24" r="20" fill="none" stroke={pr.pct === 100 ? "#7cf0a8" : "#8cc3f0"} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(pr.pct / 100) * 125.7} 125.7`} />
          </svg>
          <span className="font-display text-sm tabular-nums">{pr.done}/{pr.total}</span>
        </span>
        <span className="min-w-0 flex-1">
          {showAthlete ? <span className="block text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#8cc3f0]">{plan.athleteName}</span> : null}
          <span className="block font-semibold leading-tight">{plan.title}</span>
          <span className="block text-xs text-muted">{[plan.status === "conclusa" ? "Conclusa" : pr.pct === 100 ? "Completata dall'allievo" : "In corso", when, plan.mine ? "" : `di ${plan.coachName}`].filter(Boolean).join(" · ")}</span>
        </span>
        <Glyph name="chevron" size={14} className={cx("mt-1 text-muted transition-transform", open ? "rotate-90" : "")} />
      </button>
      {open ? (
        <div className="grid gap-2">
          {plan.goal ? <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm"><span className="text-muted">Obiettivo: </span>{plan.goal}</p> : null}
          <ol className="grid gap-1">
            {plan.items.map((x, i) => {
              const ok = plan.done.includes(i);
              return (
                <li key={i} className="flex items-start gap-2.5 rounded-xl px-1 py-1.5">
                  <span className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.65rem] font-black", ok ? "bg-[#7cf0a8] text-[#0b2416]" : "border border-white/20 text-muted")}>{ok ? "✓" : i + 1}</span>
                  <span className="min-w-0">
                    <span className={cx("block text-sm font-semibold", ok && "text-white/70 line-through decoration-white/30")}>{x.title}</span>
                    {x.detail ? <span className="block text-xs text-muted">{x.detail}</span> : null}
                    {itemMeta(x) ? <span className="mt-0.5 block text-[0.7rem] font-semibold text-[#8cc3f0]">{itemMeta(x)}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
          {plan.notes ? <p className="whitespace-pre-line text-xs text-muted">{plan.notes}</p> : null}
          {plan.athleteNote ? <p className="rounded-xl border border-[#7cf0a8]/25 bg-[#7cf0a8]/[0.07] px-3 py-2 text-sm"><span className="text-[#7cf0a8]">Dall'allievo: </span>{plan.athleteNote}</p> : null}
          {err ? <ErrorNote text={err} /> : null}
          <div className="flex flex-wrap gap-1.5">
            {onEdit ? <button type="button" className="aa-chip" onClick={onEdit}>Modifica</button> : null}
            {showAthlete && plan.athleteMemberId ? <Link to="/istruttore/$id" params={{ id: String(plan.athleteMemberId) }} className="aa-chip">Apri l'allievo</Link> : null}
            <button type="button" className="aa-chip" onClick={() => void flip()}>{plan.status === "attiva" ? "Segna conclusa" : "Riapri"}</button>
            {armed ? (
              <button type="button" className="rounded-full bg-danger px-3 py-1.5 text-xs font-bold text-danger-fg" onClick={() => deletePlan({ data: { id: plan.id } }).then(onChanged).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non tolta."))}>Conferma: elimina</button>
            ) : (
              <button type="button" className="aa-chip" onClick={() => setArmed(true)}>Elimina</button>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

/** scegliere un allievo per una nuova scheda */
export function AthletePick({ athletes, value, onChange }: { athletes: { memberId: number; name: string }[]; value: number; onChange: (id: number) => void }) {
  return (
    <Select value={String(value || "")} onChange={(e) => onChange(Number(e.target.value))} aria-label="Allievo">
      <option value="">Scegli l'allievo</option>
      {athletes.map((a) => <option key={a.memberId} value={a.memberId}>{a.name}</option>)}
    </Select>
  );
}
