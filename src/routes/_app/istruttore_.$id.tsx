import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar, Button, Card, Empty, ErrorNote, Loading, SectionHead, Segmented, cx } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { AvgLine } from "@/components/charts";
import { CoachPlanCard, PlanEditor } from "@/components/coach-plans";
import { useLoad } from "@/lib/arcieri/use-load";
import { useEntryState } from "@/lib/arcieri/back-restore";
import { athleteBoard, type Plan } from "@/lib/arcieri/istruttore.api";

export const Route = createFileRoute("/_app/istruttore_/$id")({ component: Page });

type Board = Awaited<ReturnType<typeof athleteBoard>>;
type Session = Board["sessions"][number];

const fmt = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(d).replace(".", ","));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const DAY = 86_400_000;

function shortDay(d: string) {
  const [, m, g] = d.split("-");
  return `${Number(g)}/${Number(m)}`;
}

function longDay(d: string) {
  return new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

/** Un allievo visto dall'allenatore: miglioramenti, analisi del gesto, foto delle volée, schede. */
function Page() {
  const { id } = Route.useParams();
  const memberId = Number(id);
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`athlete-${id}-${nonce}`, () => athleteBoard({ data: { memberId } }));
  const [tab, setTab] = useEntryState<"progressi" | "gesto" | "volee" | "schede">(`allievo-tab-${id}`, "progressi");
  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote text={error || "Errore"} />;
  const a = data.athlete;
  const active = data.plans.filter((p) => p.status === "attiva").length;
  return (
    <div className="grid gap-3">
      <Card className="flex items-center gap-3">
        <Avatar label={a.name.slice(0, 2).toUpperCase()} color={a.color} photo={a.photoUrl} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#8cc3f0]">Allievo</span>
          <span className="block truncate font-display text-2xl leading-tight">{a.name}</span>
          <span className="block truncate text-xs text-muted">{[a.bowType, `${data.sessions.length} allenamenti in un anno`, active ? `${active} ${active === 1 ? "scheda attiva" : "schede attive"}` : ""].filter(Boolean).join(" · ")}</span>
        </span>
        <Link to="/arciere/$id" params={{ id: String(a.memberId) }} className="aa-chip shrink-0">Profilo</Link>
      </Card>
      {!a.shares ? (
        <Card className="flex items-start gap-3 border-[#e07a2f]/40 bg-[#e07a2f]/[0.08]">
          <Glyph name="lock" size={18} className="mt-0.5 shrink-0 text-[#f3a46a]" />
          <p className="text-sm">{a.name.split(" ")[0]} non condivide i suoi allenamenti con gli allenatori: progressi, gesto e foto restano privati. Puoi comunque preparargli una scheda.</p>
        </Card>
      ) : null}
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: "progressi", label: "Progressi" },
          { id: "gesto", label: `Gesto${data.gestures.length ? ` ${data.gestures.length}` : ""}` },
          { id: "volee", label: `Volée${data.photos.length ? ` ${data.photos.length}` : ""}` },
          { id: "schede", label: `Schede${data.plans.length ? ` ${data.plans.length}` : ""}` },
        ]}
      />
      {tab === "progressi" ? <Progress sessions={data.sessions} shares={a.shares} /> : null}
      {tab === "gesto" ? <Gestures items={data.gestures} shares={a.shares} /> : null}
      {tab === "volee" ? <Photos items={data.photos} shares={a.shares} /> : null}
      {tab === "schede" ? <Plans memberId={a.memberId} name={a.name} plans={data.plans} onChange={() => setNonce((n) => n + 1)} /> : null}
    </div>
  );
}

/** miglioramenti: ultime sedute contro le prime, curva della media, mese per mese, per distanza */
function Progress({ sessions, shares }: { sessions: Session[]; shares: boolean }) {
  const stats = useMemo(() => {
    const now = Date.now();
    const t = sessions.map((s) => s.tenths);
    const first = mean(t.slice(0, 5));
    const last = mean(t.slice(-5));
    const best = sessions.reduce<Session | null>((b, s) => (!b || s.tenths > b.tenths ? s : b), null);
    const in30 = sessions.filter((s) => now - new Date(`${s.day}T12:00:00`).getTime() < 30 * DAY);
    const prev30 = sessions.filter((s) => {
      const d = now - new Date(`${s.day}T12:00:00`).getTime();
      return d >= 30 * DAY && d < 60 * DAY;
    });
    const months = new Map<string, Session[]>();
    for (const s of sessions) months.set(s.day.slice(0, 7), [...(months.get(s.day.slice(0, 7)) ?? []), s]);
    const byMonth = [...months.entries()].slice(-6).map(([m, list]) => ({
      month: new Date(`${m}-15T12:00:00`).toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
      avg: mean(list.map((s) => s.tenths)),
      sessions: list.length,
      arrows: list.reduce((n, s) => n + s.arrows, 0),
    }));
    const dist = new Map<number, Session[]>();
    for (const s of sessions) dist.set(s.distance, [...(dist.get(s.distance) ?? []), s]);
    const byDistance = [...dist.entries()].sort((a, b) => a[0] - b[0]).map(([d, list]) => {
      const half = Math.ceil(list.length / 2);
      return { distance: d, n: list.length, avg: mean(list.map((s) => s.avg)), start: mean(list.slice(0, half).map((s) => s.avg)), end: mean(list.slice(half).map((s) => s.avg)) };
    });
    return {
      first,
      last,
      delta: first != null && last != null && sessions.length >= 6 ? last - first : null,
      best,
      arrows30: in30.reduce((n, s) => n + s.arrows, 0),
      arrowsPrev: prev30.reduce((n, s) => n + s.arrows, 0),
      sessions30: in30.length,
      byMonth,
      byDistance,
    };
  }, [sessions]);
  if (!shares) return <Empty title="Progressi non condivisi" text="L'allievo può attivare la condivisione dal suo Profilo, in Privacy." />;
  if (!sessions.length) return <Empty title="Nessun allenamento nell'ultimo anno" text="Quando segna i tiri nell'app, qui vedi come migliora." />;
  const up = (stats.delta ?? 0) >= 0;
  const chart = sessions.slice(-24).map((s) => ({ name: shortDay(s.day), avg: Number(s.tenths.toFixed(2)) }));
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Card className="grid gap-0.5 !p-3">
          <span className="text-xs text-muted">Media ultime 5 sedute</span>
          <b className="font-display text-3xl leading-none tabular-nums">{fmt(stats.last)}</b>
          <span className={cx("text-[0.72rem] font-semibold tabular-nums", stats.delta == null ? "text-muted" : up ? "text-[#7cf0a8]" : "text-[#f3a46a]")}>{stats.delta == null ? "servono almeno 6 sedute" : `${up ? "▲" : "▼"} ${fmt(Math.abs(stats.delta))} dalle prime 5`}</span>
        </Card>
        <Card className="grid gap-0.5 !p-3">
          <span className="text-xs text-muted">Seduta migliore</span>
          <b className="font-display text-3xl leading-none tabular-nums">{fmt(stats.best?.tenths ?? null)}</b>
          <span className="text-[0.72rem] text-muted">{stats.best ? `${longDay(stats.best.day)} · ${stats.best.distance} m` : ""}</span>
        </Card>
        <Card className="grid gap-0.5 !p-3">
          <span className="text-xs text-muted">Frecce in 30 giorni</span>
          <b className="font-display text-3xl leading-none tabular-nums">{stats.arrows30.toLocaleString("it-IT")}</b>
          <span className="text-[0.72rem] text-muted">{stats.sessions30} sedute · {stats.arrowsPrev ? `${stats.arrowsPrev.toLocaleString("it-IT")} il mese prima` : "nessuna il mese prima"}</span>
        </Card>
        <Card className="grid gap-0.5 !p-3">
          <span className="text-xs text-muted">Sedute nell'anno</span>
          <b className="font-display text-3xl leading-none tabular-nums">{sessions.length}</b>
          <span className="text-[0.72rem] text-muted">{sessions.reduce((n, s) => n + s.arrows, 0).toLocaleString("it-IT")} frecce</span>
        </Card>
      </div>
      <Card className="grid gap-2">
        <SectionHead title="Media per seduta" sub="In decimi del bersaglio, così bersagli diversi si confrontano. Ultime 24 sedute." />
        <AvgLine data={chart} height={190} />
      </Card>
      <Card className="grid gap-1">
        <SectionHead title="Mese per mese" />
        {stats.byMonth.map((m, i) => {
          const prev = i ? stats.byMonth[i - 1].avg : null;
          const d = m.avg != null && prev != null ? m.avg - prev : null;
          return (
            <div key={m.month} className={cx("grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 py-1.5 text-sm", i ? "border-t border-white/[0.06]" : "")}>
              <span className="font-semibold capitalize">{m.month}</span>
              <span className="relative h-2 overflow-hidden rounded-full bg-white/[0.07]"><span className="absolute inset-y-0 left-0 rounded-full bg-[#8cc3f0]" style={{ width: `${Math.max(4, ((m.avg ?? 0) / 10) * 100)}%` }} /></span>
              <span className="w-28 text-right tabular-nums">
                <b>{fmt(m.avg)}</b>
                <span className={cx("ml-1.5 text-[0.7rem]", d == null ? "text-muted" : d >= -0.005 ? "text-[#7cf0a8]" : "text-[#f3a46a]")}>{d == null ? `${m.sessions} sed.` : `${d >= -0.005 ? "+" : "−"}${fmt(Math.abs(d))}`}</span>
              </span>
            </div>
          );
        })}
      </Card>
      {stats.byDistance.length ? (
        <Card className="grid gap-1">
          <SectionHead title="Per distanza" sub="Media in punti: prima metà delle sedute e seconda metà." />
          {stats.byDistance.map((d, i) => {
            const delta = d.start != null && d.end != null && d.n >= 4 ? d.end - d.start : null;
            return (
              <div key={d.distance} className={cx("flex items-center justify-between gap-3 py-1.5 text-sm", i ? "border-t border-white/[0.06]" : "")}>
                <span><b>{d.distance} m</b> <span className="text-xs text-muted">· {d.n} sedute</span></span>
                <span className="tabular-nums">
                  {fmt(d.avg)}
                  {delta != null ? <span className={cx("ml-2 text-[0.72rem] font-semibold", delta >= 0 ? "text-[#7cf0a8]" : "text-[#f3a46a]")}>{delta >= 0 ? "▲" : "▼"} {fmt(Math.abs(delta))}</span> : null}
                </span>
              </div>
            );
          })}
        </Card>
      ) : null}
    </div>
  );
}

const GEST_ROWS: { key: "anchorS" | "drawS" | "lineDeg" | "bowDeg" | "shoulderDeg" | "jitter"; label: string; unit: string; d: number }[] = [
  { key: "drawS", label: "Trazione", unit: "s", d: 1 },
  { key: "anchorS", label: "Tempo all'ancoraggio", unit: "s", d: 1 },
  { key: "lineDeg", label: "Linea della freccia", unit: "°", d: 0 },
  { key: "bowDeg", label: "Braccio dell'arco", unit: "°", d: 0 },
  { key: "shoulderDeg", label: "Spalle", unit: "°", d: 0 },
  { key: "jitter", label: "Tremolio in mira", unit: "", d: 2 },
];

/** analisi del gesto salvate dall'allievo: punteggio nel tempo e i numeri di ognuna */
function Gestures({ items, shares }: { items: Board["gestures"]; shares: boolean }) {
  const [open, setOpen] = useState<number | null>(items[0]?.id ?? null);
  if (!shares) return <Empty title="Analisi non condivise" text="L'allievo può attivare la condivisione dal suo Profilo, in Privacy." />;
  if (!items.length) return <Empty title="Nessuna analisi del gesto" text="Chiedi all'allievo di registrare un video di profilo con «Analisi gesto»: qui vedi punteggio, tempi e angoli." />;
  const scored = items.filter((g) => g.score != null).slice().reverse();
  return (
    <div className="grid gap-3">
      {scored.length >= 2 ? (
        <Card className="grid gap-2">
          <SectionHead title="Punteggio del gesto" sub="Da 0 a 100, analisi dopo analisi." />
          <AvgLine data={scored.map((g) => ({ name: shortDay(g.createdAt.slice(0, 10)), avg: g.score ?? 0 }))} height={150} />
        </Card>
      ) : null}
      {items.map((g) => {
        const isOpen = open === g.id;
        return (
          <Card key={g.id} className="grid gap-2 !p-3">
            <button type="button" onClick={() => setOpen(isOpen ? null : g.id)} className="flex items-center gap-3 text-left">
              {g.thumb ? <img src={g.thumb} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/[0.06]"><Glyph name="archer" size={22} className="text-muted" /></span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{g.title || (g.kind === "foto" ? "Analisi da foto" : "Analisi video")}</span>
                <span className="block text-xs text-muted">{[longDay(g.createdAt), g.shots ? (g.shots === 1 ? "1 tiro" : `${g.shots} tiri`) : "", g.distanceM ? `${g.distanceM} m` : ""].filter(Boolean).join(" · ")}</span>
              </span>
              {g.score != null ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-lg" style={{ background: g.score >= 75 ? "#2c8a57" : g.score >= 55 ? "#c39320" : "#b2473a" }}>{g.score}</span> : null}
            </button>
            {isOpen ? (
              <div className="grid grid-cols-2 gap-1.5">
                {GEST_ROWS.filter((r) => g[r.key] != null).map((r) => (
                  <div key={r.key} className="rounded-xl bg-white/[0.04] px-2.5 py-1.5">
                    <span className="block text-[0.66rem] text-muted">{r.label}</span>
                    <b className="tabular-nums">{fmt(g[r.key], r.d)}{r.unit}</b>
                  </div>
                ))}
                {g.thumb ? <img src={g.thumb} alt="Fotogramma dell'analisi" className="col-span-2 w-full rounded-xl object-cover" /> : null}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

/** foto del bersaglio salvate con le sedute: le volée come le ha tirate */
function Photos({ items, shares }: { items: Board["photos"]; shares: boolean }) {
  const [big, setBig] = useState<Board["photos"][number] | null>(null);
  if (!shares) return <Empty title="Foto non condivise" text="L'allievo può attivare la condivisione dal suo Profilo, in Privacy." />;
  if (!items.length) return <Empty title="Nessuna foto delle volée" text="Le foto arrivano quando l'allievo usa «Volée da foto» o aggiunge la foto del bersaglio alla seduta." />;
  return (
    <div className="grid gap-3">
      {big ? (
        <Card className="grid gap-2 !p-2">
          <img src={big.photo} alt={`Bersaglio del ${longDay(big.day)}`} className="w-full rounded-xl object-contain" />
          <div className="flex items-center justify-between gap-2 px-1 text-sm">
            <span>{longDay(big.day)} · {big.distance} m{big.avg != null ? ` · media ${fmt(big.avg)}` : ""}{big.arrows ? ` · ${big.arrows} frecce` : ""}</span>
            <button type="button" className="aa-chip" onClick={() => setBig(null)}>Chiudi</button>
          </div>
        </Card>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        {items.map((p) => (
          <button key={p.sessionId} type="button" onClick={() => setBig(p)} className={cx("relative aspect-square overflow-hidden rounded-xl border", big?.sessionId === p.sessionId ? "border-[#8cc3f0]" : "border-white/10")}>
            <img src={p.photo} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4 text-left text-[0.66rem] font-semibold leading-tight text-white">
              {shortDay(p.day)} · {p.distance} m{p.avg != null ? <><br />media {fmt(p.avg)}</> : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** le schede dell'allievo: nuova, in corso, concluse */
function Plans({ memberId, name, plans, onChange }: { memberId: number; name: string; plans: Plan[]; onChange: () => void }) {
  const [editing, setEditing] = useState<Plan | "nuova" | null>(plans.length ? null : "nuova");
  if (editing) {
    return <PlanEditor memberId={memberId} athleteName={name} plan={editing === "nuova" ? null : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onChange(); }} />;
  }
  const active = plans.filter((p) => p.status === "attiva");
  const closed = plans.filter((p) => p.status === "conclusa");
  return (
    <div className="grid gap-3">
      <Button onClick={() => setEditing("nuova")}>Nuova scheda per {name.split(" ")[0]}</Button>
      {active.map((p) => <CoachPlanCard key={p.id} plan={p} memberId={memberId} onEdit={() => setEditing(p)} onChanged={onChange} />)}
      {closed.length ? <SectionHead title="Concluse" /> : null}
      {closed.map((p) => <CoachPlanCard key={p.id} plan={p} memberId={memberId} onEdit={() => setEditing(p)} onChanged={onChange} />)}
    </div>
  );
}
