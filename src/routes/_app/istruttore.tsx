import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar, Button, Card, Empty, ErrorNote, Loading, PageHead, SectionHead, Segmented, Select, cx } from "@/components/kit";
import { AthletePick, CoachPlanCard, PlanEditor } from "@/components/coach-plans";
import { ClassesTab } from "@/components/coach-classes";
import { ProgramsTab } from "@/components/program-maker";
import { useMemberMaybe } from "@/components/shell";
import { Glyph } from "@/components/icons";
import { useLoad } from "@/lib/arcieri/use-load";
import { useEntryState } from "@/lib/arcieri/back-restore";
import { SITE_URL, whatsappLink } from "@/lib/arcieri/native";
import { coachBoard, companyPlans, type Athlete } from "@/lib/arcieri/istruttore.api";

export const Route = createFileRoute("/_app/istruttore")({ component: Page });

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

function since(a: Athlete) {
  if (!a.shares) return a.lastInfo;
  if (a.daysAway == null) return "Nessun allenamento";
  const when = a.daysAway <= 0 ? "oggi" : a.daysAway === 1 ? "ieri" : `${a.daysAway} giorni fa`;
  return [when, a.lastInfo].filter(Boolean).join(" · ");
}

function Spark({ values, down }: { values: number[]; down: boolean }) {
  if (values.length < 2) return <span className="h-6 w-16" />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(0.4, hi - lo);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 64},${22 - ((v - lo) / span) * 18}`).join(" ");
  return (
    <svg width="64" height="24" viewBox="0 0 64 24" aria-hidden className="shrink-0">
      <polyline points={pts} fill="none" stroke={down ? "#f3a46a" : "#7cf0a8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Scheda Allenatore: gli allievi (chi seguire, chi cresce, chi non si vede) e le schede di allenamento. */
function Page() {
  const [companyId, setCompanyId] = useEntryState("istr-company", 0);
  const [tab, setTab] = useEntryState<"allievi" | "classi" | "schede" | "programmi">("istr-tab", "allievi");
  const ctx = useMemberMaybe();
  const meName = ctx ? [ctx.me.givenName, ctx.me.familyName].filter(Boolean).join(" ") || ctx.me.nickname : "";
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`coach-${companyId}-${nonce}`, () => coachBoard({ data: { companyId } }));
  const [filter, setFilter] = useState<"tutti" | "seguire">("tutti");
  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote text={error || "Errore"} />;
  const head = (
    <>
      <PageHead kicker={data.company.name} title="Allenatore" lede="I tuoi allievi e le tue classi: progressi, analisi del gesto, foto delle volée, schede su misura, programmi di esercizi in PDF e richieste alla classe." />
      {data.companies.length > 1 ? (
        <Select value={String(data.company.id)} onChange={(e) => setCompanyId(Number(e.target.value))} aria-label="Compagnia">
          {data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      ) : null}
      <Segmented value={tab} onChange={setTab} options={[{ id: "allievi", label: `Allievi (${data.athletes.length})` }, { id: "classi", label: "Classi" }, { id: "schede", label: "Schede" }, { id: "programmi", label: "Esercizi" }]} />
    </>
  );
  if (tab === "classi") {
    return (
      <div className="grid gap-3">
        {head}
        <ClassesTab companyId={data.company.id} />
      </div>
    );
  }
  if (tab === "programmi") {
    return (
      <div className="grid gap-3">
        {head}
        <ProgramsTab companyId={data.company.id} companyName={data.company.name} coachName={meName} />
      </div>
    );
  }
  if (tab === "schede") {
    return (
      <div className="grid gap-3">
        {head}
        <PlansTab companyId={data.company.id} athletes={data.athletes} onChange={() => setNonce((n) => n + 1)} />
      </div>
    );
  }
  const follow = data.athletes.filter((a) => a.alerts.some((x) => x.kind !== "nuovo"));
  const list = filter === "seguire" ? follow : data.athletes;
  const groupText = `Ciao a tutti! Questa settimana ci vediamo in campo? Segnate i tiri su Arcieri Amiconi, così vedo come state andando: ${SITE_URL}`;
  return (
    <div className="grid gap-3">
      {head}
      <div className="grid grid-cols-3 gap-2">
        <Card className="grid gap-0.5 !p-3"><b className="font-display text-3xl leading-none">{data.summary.total}</b><span className="text-xs text-muted">allievi</span></Card>
        <Card className="grid gap-0.5 !p-3"><b className="font-display text-3xl leading-none text-[#7cf0a8]">{data.summary.active7}</b><span className="text-xs text-muted">attivi in settimana</span></Card>
        <Card className="grid gap-0.5 !p-3"><b className="font-display text-3xl leading-none text-[#f3a46a]">{data.summary.follow}</b><span className="text-xs text-muted">da seguire</span></Card>
      </div>
      {follow.length ? (
        <Card className="grid gap-2 border-[#e07a2f]/40 bg-[#e07a2f]/[0.08]">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#f3a46a]">Da seguire</p>
          {follow.slice(0, 6).map((a) => (
            <Link key={a.memberId} to="/istruttore/$id" params={{ id: String(a.memberId) }} className="flex items-start gap-2 text-sm">
              <span className={cx("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-bold", a.alerts[0]?.kind === "calo" ? "bg-[#e07a2f]/25 text-[#f3a46a]" : "bg-rose-500/20 text-rose-300")}>{a.alerts[0]?.kind === "calo" ? "media" : "assente"}</span>
              <span><b>{a.name}</b>: {a.alerts.filter((x) => x.kind !== "nuovo").map((x) => x.text).join(", ")}</span>
            </Link>
          ))}
        </Card>
      ) : null}
      <div className="flex gap-1.5">
        {(["tutti", "seguire"] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className="aa-chip">{f === "tutti" ? `Tutti (${data.athletes.length})` : `Da seguire (${follow.length})`}</button>
        ))}
      </div>
      {list.length ? (
        <Card className="grid gap-0 !py-1">
          {list.map((a, i) => {
            const down = (a.delta ?? 0) < 0;
            return (
              <Link key={a.memberId} to="/istruttore/$id" params={{ id: String(a.memberId) }} className={cx("flex items-center gap-3 py-2.5", i ? "border-t border-white/[0.06]" : "")}>
                <Avatar label={a.name.slice(0, 2).toUpperCase()} color={a.color} photo={a.photoUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{a.name}</span>
                  <span className="block truncate text-xs text-muted">{since(a)}</span>
                  {data.planCount?.[a.memberId] ? <span className="mt-0.5 inline-block rounded-full bg-[#8cc3f0]/15 px-1.5 py-px text-[0.62rem] font-semibold text-[#8cc3f0]">{data.planCount[a.memberId] === 1 ? "1 scheda attiva" : `${data.planCount[a.memberId]} schede attive`}</span> : null}
                </span>
                {a.shares ? <Spark values={a.spark} down={down} /> : <Glyph name="lock" size={16} className="text-muted" />}
                <span className="w-14 shrink-0 text-right">
                  <span className="block text-sm font-bold tabular-nums">{a.avg != null ? fmt(a.avg) : "—"}</span>
                  <span className={cx("block text-[0.68rem] tabular-nums", a.delta == null ? "text-muted" : down ? "text-[#f3a46a]" : "text-[#7cf0a8]")}>{a.delta == null ? (a.sessions30 ? `${a.sessions30} uscite` : "") : `${down ? "▼" : "▲"} ${fmt(Math.abs(a.delta))}`}</span>
                </span>
              </Link>
            );
          })}
        </Card>
      ) : (
        <Empty title={filter === "seguire" ? "Nessuno da seguire" : "Nessun allievo"} text={filter === "seguire" ? "Tutti si allenano con regolarità e senza cali." : "Quando altri arcieri entrano nella compagnia, li trovi qui. Per aggiungerli usa l'invito in Gestione compagnia."} />
      )}
      <SectionHead title="Il gruppo" sub="Medie in decimi del bersaglio, sulle ultime 3 sedute da almeno 6 frecce." />
      <a href={whatsappLink(groupText)} target="_blank" rel="noreferrer" className="aa-press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#25d366] text-sm font-bold text-[#06210f]">
        <Glyph name="share" size={18} /> Scrivi al gruppo su WhatsApp
      </a>
    </div>
  );
}

/** le schede di allenamento della compagnia: nuova scheda per un allievo, in corso, concluse */
function PlansTab({ companyId, athletes, onChange }: { companyId: number; athletes: Athlete[]; onChange: () => void }) {
  const [nonce, setNonce] = useState(0);
  const plans = useLoad(`plans-${companyId}-${nonce}`, () => companyPlans({ data: { companyId } }));
  const [pick, setPick] = useState(0);
  const [writing, setWriting] = useState(false);
  const reload = () => {
    setNonce((n) => n + 1);
    onChange();
  };
  const who = athletes.find((a) => a.memberId === pick);
  const list = plans.data ?? [];
  const active = list.filter((p) => p.status === "attiva");
  const closed = list.filter((p) => p.status === "conclusa");
  return (
    <div className="grid gap-3">
      {writing && who ? (
        <PlanEditor memberId={who.memberId} athleteName={who.name} onCancel={() => setWriting(false)} onSaved={() => { setWriting(false); reload(); }} />
      ) : (
        <Card className="grid gap-2">
          <SectionHead title="Nuova scheda" sub="Esercizi, distanze e frecce su misura per un allievo." />
          <AthletePick athletes={athletes} value={pick} onChange={setPick} />
          <Button disabled={!who} onClick={() => setWriting(true)}>Scrivi la scheda</Button>
        </Card>
      )}
      {plans.loading ? <Loading /> : plans.error ? <ErrorNote text={plans.error} /> : null}
      {!plans.loading && !list.length ? <Empty title="Ancora nessuna scheda" text="Scegli un allievo e prepara la sua prima scheda: la trova nel suo Menu." /> : null}
      {active.length ? <SectionHead title="In corso" sub={`${active.length} ${active.length === 1 ? "scheda" : "schede"}`} /> : null}
      {active.map((p) => <CoachPlanCard key={p.id} plan={p} memberId={p.athleteMemberId} showAthlete onChanged={reload} />)}
      {closed.length ? <SectionHead title="Concluse" /> : null}
      {closed.map((p) => <CoachPlanCard key={p.id} plan={p} memberId={p.athleteMemberId} showAthlete onChanged={reload} />)}
      <Link to="/staff" className="text-center text-xs text-muted underline-offset-2 hover:underline">Aggiungere o togliere persone: Gestione compagnia</Link>
    </div>
  );
}
