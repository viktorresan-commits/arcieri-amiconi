import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Card, Empty, ErrorNote, Loading, PageHead, SectionHead, TextArea, cx } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { itemMeta, planProgress, planWhen } from "@/components/coach-plans";
import { useLoad } from "@/lib/arcieri/use-load";
import { myPlans, tickPlan, type Plan } from "@/lib/arcieri/istruttore.api";

export const Route = createFileRoute("/_app/schede")({ component: Page });

/** Le schede di allenamento che l'allenatore ha preparato per me: spunto gli esercizi man mano. */
function Page() {
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`my-plans-${nonce}`, () => myPlans());
  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote text={error || "Errore"} />;
  const active = data.filter((p) => p.status === "attiva");
  const closed = data.filter((p) => p.status === "conclusa");
  return (
    <div className="grid gap-3">
      <PageHead title="Le mie schede" lede="Gli esercizi preparati dal tuo allenatore. Spunta quelli fatti: l'allenatore vede a che punto sei." />
      {!data.length ? <Empty title="Nessuna scheda" text="Quando il tuo allenatore ti prepara una scheda, la trovi qui e ricevi un avviso." /> : null}
      {active.map((p) => <MyPlan key={p.id} plan={p} onChange={() => setNonce((n) => n + 1)} />)}
      {closed.length ? <SectionHead title="Concluse" /> : null}
      {closed.map((p) => <MyPlan key={p.id} plan={p} onChange={() => setNonce((n) => n + 1)} />)}
    </div>
  );
}

function MyPlan({ plan, onChange }: { plan: Plan; onChange: () => void }) {
  const [done, setDone] = useState<number[]>(plan.done);
  const [open, setOpen] = useState(plan.status === "attiva");
  const [note, setNote] = useState(plan.athleteNote);
  const [saved, setSaved] = useState("");
  const [err, setErr] = useState("");
  const pr = planProgress({ ...plan, done });
  const tick = (i: number) => {
    const on = !done.includes(i);
    setDone((d) => (on ? [...d, i] : d.filter((x) => x !== i)));
    setErr("");
    tickPlan({ data: { id: plan.id, index: i, done: on } }).catch((e: unknown) => {
      setDone((d) => (on ? d.filter((x) => x !== i) : [...d, i]));
      setErr(e instanceof Error ? e.message : "Non salvato.");
    });
  };
  return (
    <Card className={cx("grid gap-2", plan.status === "conclusa" && "opacity-75")}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-start gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#8cc3f0]">Da {plan.coachName}{planWhen(plan) ? ` · ${planWhen(plan)}` : ""}</span>
          <span className="block font-display text-xl leading-tight">{plan.title}</span>
        </span>
        <span className="shrink-0 text-right">
          <b className="block font-display text-xl tabular-nums leading-none">{pr.done}/{pr.total}</b>
          <span className="text-[0.66rem] text-muted">fatti</span>
        </span>
        <Glyph name="chevron" size={14} className={cx("mt-1 text-muted transition-transform", open ? "rotate-90" : "")} />
      </button>
      <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><span className="block h-full rounded-full bg-[#7cf0a8] transition-[width] duration-500" style={{ width: `${pr.pct}%` }} /></span>
      {open ? (
        <div className="grid gap-2">
          {plan.goal ? <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm"><span className="text-muted">Obiettivo: </span>{plan.goal}</p> : null}
          <ul className="grid gap-1.5">
            {plan.items.map((x, i) => {
              const ok = done.includes(i);
              return (
                <li key={i}>
                  <button type="button" disabled={plan.status === "conclusa"} onClick={() => tick(i)} aria-pressed={ok} className={cx("flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition", ok ? "border-[#7cf0a8]/40 bg-[#7cf0a8]/[0.08]" : "border-white/[0.08] bg-white/[0.03]")}>
                    <span className={cx("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black", ok ? "bg-[#7cf0a8] text-[#0b2416]" : "border-2 border-white/25")}>{ok ? "✓" : ""}</span>
                    <span className="min-w-0">
                      <span className={cx("block text-sm font-semibold", ok && "text-white/70")}>{x.title}</span>
                      {x.detail ? <span className="block text-xs text-muted">{x.detail}</span> : null}
                      {itemMeta(x) ? <span className="mt-0.5 block text-[0.72rem] font-semibold text-[#8cc3f0]">{itemMeta(x)}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {plan.notes ? <p className="whitespace-pre-line rounded-xl bg-white/[0.04] px-3 py-2 text-sm"><span className="text-muted">Note: </span>{plan.notes}</p> : null}
          <TextArea value={note} onChange={(e) => { setNote(e.target.value); setSaved(""); }} rows={2} placeholder="Un messaggio per l'allenatore: com'è andata, dubbi" maxLength={600} />
          <Button variant="ghost" disabled={note === plan.athleteNote && !saved} onClick={() => tickPlan({ data: { id: plan.id, note } }).then(() => { setSaved("Nota inviata."); onChange(); }).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non inviata."))}>Invia la nota</Button>
          {saved ? <p className="text-xs text-emerald-300">{saved}</p> : null}
          {err ? <ErrorNote text={err} /> : null}
        </div>
      ) : null}
    </Card>
  );
}
