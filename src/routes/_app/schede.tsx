import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Card, Empty, ErrorNote, Loading, PageHead, SectionHead, TextArea, cx } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { itemMeta, planProgress, planWhen } from "@/components/coach-plans";
import { useLoad } from "@/lib/arcieri/use-load";
import { myPlans, tickPlan, type Plan } from "@/lib/arcieri/istruttore.api";
import { myPrograms, type ProgramRow } from "@/lib/arcieri/programmi.api";
import { LEVEL_NAME } from "@/lib/arcieri/exercise-catalog";
import { LevelDots, sendProgram } from "@/components/program-maker";
import { REQUEST_KINDS, doneRequest, myClasses } from "@/lib/arcieri/classi.api";
import { when } from "@/components/coach-classes";
import { Link } from "@tanstack/react-router";
import { openExternal } from "@/lib/arcieri/native";

export const Route = createFileRoute("/_app/schede")({ component: Page });

/** Le schede di allenamento che l'allenatore ha preparato per me: spunto gli esercizi man mano. */
function Page() {
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`my-plans-${nonce}`, () => myPlans());
  const classes = useLoad(`my-classes-${nonce}`, () => myClasses());
  const progs = useLoad(`my-progs-${nonce}`, () => myPrograms());
  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote text={error || "Errore"} />;
  const active = data.filter((p) => p.status === "attiva");
  const closed = data.filter((p) => p.status === "conclusa");
  return (
    <div className="grid gap-3">
      <PageHead title="Le mie schede" lede="Esercizi, classi e richieste del tuo allenatore. Spunta quello che hai fatto: l'allenatore vede a che punto sei." />
      {(classes.data ?? []).map((c) => <MyClass key={c.id} c={c} onChange={() => setNonce((n) => n + 1)} />)}
      {(progs.data ?? []).map((r) => <MyProgram key={r.id} row={r} />)}
      {!data.length && !(progs.data ?? []).length ? <Empty title="Nessuna scheda" text="Quando il tuo allenatore ti prepara una scheda, la trovi qui e ricevi un avviso." /> : null}
      {active.map((p) => <MyPlan key={p.id} plan={p} onChange={() => setNonce((n) => n + 1)} />)}
      {closed.length ? <SectionHead title="Concluse" /> : null}
      {closed.map((p) => <MyPlan key={p.id} plan={p} onChange={() => setNonce((n) => n + 1)} />)}
    </div>
  );
}

/** programma di esercizi dell'allenatore: categorie, esercizi, quanto e difficoltà, più il PDF da stampare */
function MyProgram({ row }: { row: ProgramRow }) {
  const [open, setOpen] = useState(false);
  const p = row.program;
  return (
    <Card className="grid gap-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-start justify-between gap-2 text-left">
        <span className="min-w-0">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#e0b15a]">Programma di esercizi</span>
          <b className="block font-display text-xl leading-tight">{LEVEL_NAME[p.level]} · {p.sections.reduce((n, s) => n + s.items.length, 0)} esercizi</b>
          <span className="block text-xs text-muted">di {row.coachName}{p.header.days ? ` · ${p.header.days}` : ""}</span>
        </span>
        <Glyph name="chevron" size={16} className={cx("mt-1 shrink-0 text-muted transition-transform", open && "rotate-90")} />
      </button>
      {p.header.goal ? <p className="text-sm">Obiettivo: {p.header.goal}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="aa-chip" onClick={() => void sendProgram(p, "scarica")}><Glyph name="download" size={13} /> Scarica il PDF</button>
        <button type="button" className="aa-chip" onClick={() => void sendProgram(p, "whatsapp")}><Glyph name="share" size={13} /> Invia</button>
      </div>
      {open
        ? p.sections.map((s, si) => (
            <div key={s.id} className="grid gap-1 rounded-xl bg-white/[0.04] p-2.5">
              <p className="text-sm font-semibold">{si + 1}. {s.title} <span className="text-xs font-normal text-muted">· {s.hint}</span></p>
              {s.items.map((it) => (
                <div key={it.code + it.name} className="flex items-start gap-2 border-t border-white/[0.05] pt-1.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <b className="block leading-tight">{it.name}</b>
                    <span className="block text-xs text-muted">{it.how}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    <b className="block">{it.dose}</b>
                    <span className="text-[#e0b15a]"><LevelDots level={it.level} size={7} /></span>
                  </span>
                </div>
              ))}
            </div>
          ))
        : null}
    </Card>
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

type MyKlass = Awaited<ReturnType<typeof myClasses>>[number];

/** una mia classe: orario, gruppo WhatsApp e le richieste dell'allenatore da spuntare */
function MyClass({ c, onChange }: { c: MyKlass; onChange: () => void }) {
  const [done, setDone] = useState<Record<number, boolean>>(() => Object.fromEntries(c.requests.map((r) => [r.id, r.done])));
  const [err, setErr] = useState("");
  const open = c.requests.filter((r) => !done[r.id]).length;
  return (
    <Card className="grid gap-2">
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#8cc3f0]">La tua classe{open ? ` · ${open} da fare` : ""}</span>
          <span className="block font-display text-xl leading-tight">{c.name}</span>
          <span className="block text-xs text-muted">{when(c) || "Orario da definire"}</span>
        </span>
        {c.whatsappUrl ? <button type="button" onClick={() => void openExternal(c.whatsappUrl)} className="shrink-0 rounded-full bg-[#25d366] px-3 py-1.5 text-xs font-bold text-[#06210f]">Gruppo</button> : null}
      </div>
      {c.requests.map((r) => {
        const k = REQUEST_KINDS.find((x) => x.id === r.kind);
        const ok = Boolean(done[r.id]);
        const [path, query] = (k?.href ?? "/schede").split("?");
        return (
          <div key={r.id} className={cx("flex items-start gap-3 rounded-2xl border p-3", ok ? "border-[#7cf0a8]/40 bg-[#7cf0a8]/[0.08]" : "border-white/[0.08] bg-white/[0.03]")}>
            <button type="button" aria-pressed={ok} aria-label={ok ? "Segna da fare" : "Segna fatto"} onClick={() => { const next = !ok; setDone((d) => ({ ...d, [r.id]: next })); doneRequest({ data: { id: r.id, done: next } }).then(onChange).catch((e: unknown) => { setDone((d) => ({ ...d, [r.id]: ok })); setErr(e instanceof Error ? e.message : "Non salvato."); }); }} className={cx("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black", ok ? "bg-[#7cf0a8] text-[#0b2416]" : "border-2 border-white/25")}>{ok ? "✓" : ""}</button>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{k?.label ?? "Richiesta"}</span>
              {r.message ? <span className="block text-xs text-muted">{r.message}</span> : null}
              {r.dueOn ? <span className="block text-[0.7rem] font-semibold text-[#f3a46a]">entro il {r.dueOn.split("-").reverse().slice(0, 2).join("/")}</span> : null}
            </span>
            {!ok && k && k.id !== "altro" ? <Link to={path as "/"} search={(query ? Object.fromEntries(new URLSearchParams(query)) : {}) as never} className="aa-chip shrink-0">Fallo ora</Link> : null}
          </div>
        );
      })}
      {!c.requests.length ? <p className="text-xs text-muted">Nessuna richiesta dall'allenatore, per ora.</p> : null}
      {err ? <ErrorNote text={err} /> : null}
    </Card>
  );
}
