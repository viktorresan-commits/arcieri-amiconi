/**
 * Albo d'oro dal 2019: le stagioni passate del campionato FITAST salvate dalla scansione dello storico.
 * Per ogni stagione il podio delle compagnie, i podi degli arcieri per categoria e quelli di ogni gara.
 * Lo staff avvia la scansione da qui: va avanti anche cambiando pagina dell'app, tiene acceso lo schermo
 * e, se si ferma, riprende da dove era.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Glyph } from "@/components/icons";
import { Card, ErrorNote, Loading, cx } from "@/components/kit";
import { CrestPodium } from "@/components/podium";
import { useMemberMaybe } from "@/components/shell";
import { Chips, RankList, useSplit, type Crest } from "@/components/fitast-league";
import { crestOf as drawCrest, titleName } from "@/lib/arcieri/fitast-league";
import { fitastArchive, fitastArchiveSeason, type ArchiveBoard, type ArchiveGara } from "@/lib/arcieri/fitast-history.api";
import { syncHistory, type HistoryProgress } from "@/lib/arcieri/fitast-history";
import type { Standing, StandingRow } from "@/lib/arcieri/fitast-league.api";
import { useLoad } from "@/lib/arcieri/use-load";

// ——— la scansione: una sola per volta, fuori dai componenti (resta viva cambiando pagina) ———

type WakeLock = { release: () => Promise<void> };
let scan: HistoryProgress | null = null;
let stopFlag = false;
let lock: WakeLock | null = null;
const subs = new Set<() => void>();
const emit = (p: HistoryProgress | null) => {
  scan = p;
  for (const f of subs) f();
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
const running = () => Boolean(scan && !scan.done);

/** lo schermo resta acceso finché la scansione va avanti (dove il telefono lo permette) */
async function keepAwake() {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } }).wakeLock;
    if (wl && !lock && document.visibilityState === "visible") lock = await wl.request("screen");
  } catch {
    lock = null;
  }
}
function letSleep() {
  void lock?.release().catch(() => undefined);
  lock = null;
}
if (typeof document !== "undefined") {
  // tornando nell'app il blocco dello schermo va richiesto di nuovo
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && running()) {
      lock = null;
      void keepAwake();
    }
  });
}

async function startScan() {
  if (running()) return;
  stopFlag = false;
  emit({ step: "Apro il portale", pages: 0, saved: 0, pct: 0, seasons: 0, seasonsDone: 0, gare: 0, startedAt: Date.now() });
  await keepAwake();
  try {
    await syncHistory({ onProgress: (p) => emit({ ...p }), stop: () => stopFlag });
  } catch (e) {
    emit({ ...(scan ?? { step: "", pages: 0, saved: 0, pct: 0, seasons: 0, seasonsDone: 0, gare: 0, startedAt: Date.now() }), done: true, error: e instanceof Error ? e.message : "Scansione non riuscita." });
  } finally {
    letSleep();
    if (scan && !scan.done) emit({ ...scan, done: true });
  }
}

function useScan() {
  return useSyncExternalStore(subscribe, () => scan, () => null);
}

// ——— l'albo ———

const fmtDay = (d: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
const num = (n: number | null) => (n == null ? "—" : n.toLocaleString("it-IT"));
const toStanding = (b: ArchiveBoard, kind: Standing["kind"], g?: ArchiveGara): Standing => ({ kind, season: "", seasonName: "", garaId: g?.id ?? "", garaTitle: g?.title ?? "", day: g?.day ?? "", category: b.category, rows: b.rows, total: b.total, updatedAt: "" });
const onPodium = (r: StandingRow) => r.place != null && r.place >= 1 && r.place <= 3;

/** tempo che manca, dal ritmo tenuto finora */
function eta(p: HistoryProgress) {
  const spent = Date.now() - p.startedAt;
  if (p.pct < 0.02 || spent < 60_000) return "";
  const min = Math.round((spent * (1 - p.pct)) / p.pct / 60_000);
  return min <= 1 ? "manca circa un minuto" : min < 90 ? `mancano circa ${min} minuti` : `mancano circa ${Math.round(min / 60)} ore`;
}

export function FitastArchiveCard({ crestOf, isOurs, ourName }: { crestOf: (t: string) => Crest | null; /** la nostra compagnia, nel nome del portale */ isOurs: (team: string) => boolean; ourName: string }) {
  const who = useMemberMaybe()?.me;
  const staff = Boolean(who && (who.canStaff || who.isSuper));
  const p = useScan();
  const busy = Boolean(p && !p.done);
  const [nonce, setNonce] = useState(0);
  // le stagioni nuove compaiono mentre la scansione va avanti
  const doneNow = p?.seasonsDone ?? 0;
  const finished = Boolean(p?.done);
  useEffect(() => {
    if (doneNow || finished) setNonce((n) => n + 1);
  }, [doneNow, finished]);
  const { data, error } = useLoad(`albo-${nonce}`, () => fitastArchive());
  const seasons = useMemo(() => data?.seasons ?? [], [data]);
  const [pick, setPick] = useState("");
  const season = seasons.find((s) => s.season === pick) ?? seasons[0];
  // tutto letto: lo dice l'ultima scansione di questa sessione o il segno salvato alla fine di una scansione intera
  const complete = p?.done ? p.pct >= 1 : Boolean(data?.complete);

  return (
    <Card className="relative grid scroll-mt-[calc(env(safe-area-inset-top)+8.5rem)] gap-3 overflow-hidden">
      <span id="albo" className="absolute -top-28" aria-hidden />
      <span aria-hidden className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-[#e0b15a] opacity-[0.12] blur-3xl" />
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e0b15a]/20"><Glyph name="trophy" size={26} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight">Albo d'oro dal 2019</h2>
          <p className="text-xs text-muted">
            {seasons.length
              ? `${seasons.length} ${seasons.length === 1 ? "stagione" : "stagioni"} · ${num(data?.gare ?? 0)} gare · ${num(data?.archers ?? 0)} piazzamenti di arcieri salvati`
              : "Le stagioni passate del campionato FITAST, con i podi di compagnie e arcieri."}
          </p>
        </div>
      </div>

      {staff ? <ScanPanel p={p} busy={busy} complete={complete} started={seasons.length > 0 || Boolean(p?.done)} /> : !seasons.length ? <p className="text-sm text-muted">L'albo si riempie quando lo staff avvia la scansione dello storico dal portale FITAST.</p> : null}

      {error ? <ErrorNote text={error} /> : null}
      {seasons.length ? (
        <>
          <Chips value={season?.seasonName || season?.season || ""} options={seasons.map((s) => s.seasonName || s.season)} onChange={(v) => setPick(seasons.find((s) => (s.seasonName || s.season) === v)?.season ?? "")} />
          {season ? <SeasonView key={season.season} nonce={nonce} season={season.season} partial={!season.done} crestOf={crestOf} isOurs={isOurs} ourName={ourName} /> : null}
        </>
      ) : null}
    </Card>
  );
}

function ScanPanel({ p, busy, complete, started }: { p: HistoryProgress | null; busy: boolean; complete: boolean; started: boolean }) {
  if (busy && p) {
    const pct = Math.round(p.pct * 100);
    const left = eta(p);
    return (
      <div className="grid gap-2 rounded-2xl border border-[#e0b15a]/30 bg-[#e0b15a]/[0.06] p-3">
        <div className="flex items-baseline justify-between gap-2">
          <b className="text-sm">Scansione in corso</b>
          <span className="font-display text-xl tabular-nums text-[#f1cf8a]">{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Avanzamento della scansione">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#b8891c,#f1cf8a)] transition-[width] duration-500" style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
        <p className="truncate text-xs">{p.step}</p>
        <p className="text-xs text-muted">
          {p.seasons ? `Stagioni complete ${p.seasonsDone} su ${p.seasons}` : "Cerco le stagioni"} · {num(p.gare)} gare · {num(p.pages)} pagine lette · {num(p.saved)} classifiche salvate{left ? ` · ${left}` : ""}
        </p>
        <p className="text-[0.7rem] leading-snug text-muted">Lo schermo resta acceso. Puoi usare il resto dell'app: la scansione continua. Se chiudi l'app si ferma e la riprendi da qui, da dove era.</p>
        <button type="button" className="aa-chip justify-self-start" onClick={() => { stopFlag = true; }}>Ferma</button>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {p?.done && (p.error || p.note) ? <p className={cx("text-xs", p.error ? "text-[#f0a08a]" : "text-muted")}>{p.error || p.note}</p> : null}
      {p?.done && p.diag?.length ? (
        <details className="rounded-2xl bg-white/[0.03] p-3 text-xs text-muted">
          <summary className="cursor-pointer">Dettagli tecnici della scansione</summary>
          <ul className="mt-1.5 grid gap-1 break-words text-[0.7rem] leading-snug">{p.diag.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </details>
      ) : null}
      {complete ? (
        <button type="button" className="justify-self-start text-xs text-muted underline underline-offset-2" onClick={() => void startScan()}>Cerca stagioni nuove sul portale</button>
      ) : (
        <>
          <button type="button" className="aa-press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(180deg,#f1cf8a,#c99a35)] px-4 text-sm font-semibold text-[#2a1c05] shadow-[0_10px_24px_-12px_rgba(224,177,90,0.9)]" onClick={() => void startScan()}>
            <Glyph name="history" size={18} />
            {started ? "Riprendi la scansione" : "Scansiona tutto dal 2019"}
          </button>
          <p className="text-[0.7rem] leading-snug text-muted">
            Legge dal portale FITAST ogni stagione finita: classifiche generali di compagnie e arcieri, e di ogni gara tutti gli arcieri per categoria e le compagnie. Ci vuole tempo (anche un'ora): una volta fatto, i dati restano salvati per tutti e non si rileggono più.
          </p>
        </>
      )}
    </div>
  );
}

type View = "compagnie" | "arcieri" | "gare";

function SeasonView({ season, nonce, partial, crestOf, isOurs, ourName }: { season: string; nonce: number; partial: boolean; crestOf: (t: string) => Crest | null; isOurs: (team: string) => boolean; ourName: string }) {
  const { data, error, loading } = useLoad(`albo-stagione-${season}-${nonce}`, () => fitastArchiveSeason({ data: { season } }));
  const [view, setView] = useState<View>("compagnie");
  const genSq = useMemo(() => (data?.genSq ?? []).map((b) => toStanding(b, "generale-squadre")), [data]);
  const genAr = useMemo(() => (data?.genAr ?? []).map((b) => toStanding(b, "generale-arcieri")), [data]);
  const gare = data?.gare ?? [];
  // i nostri podi della stagione: generale arcieri, gare (arcieri e compagnie), generale compagnie
  const ours = useMemo(() => {
    if (!data) return 0;
    const ar = (bs: ArchiveBoard[]) => bs.reduce((t, b) => t + b.rows.filter((r) => onPodium(r) && isOurs(r.team)).length, 0);
    const sq = (bs: ArchiveBoard[]) => bs.reduce((t, b) => t + b.rows.filter((r) => onPodium(r) && isOurs(r.name)).length, 0);
    return ar(data.genAr) + sq(data.genSq) + data.gare.reduce((t, g) => t + ar(g.arcieri) + sq(g.squadre), 0);
  }, [data, isOurs]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;
  const markTeam = (r: StandingRow) => (isOurs(r.name) ? ("nostro" as const) : null);
  const markArcher = (r: StandingRow) => (isOurs(r.team) ? ("nostro" as const) : null);
  const tabs: [View, string, number][] = [["compagnie", "Compagnie", genSq.length], ["arcieri", "Arcieri", genAr.length], ["gare", "Gare", gare.length]];
  return (
    <div className="grid gap-2.5">
      {partial ? <p className="text-[0.7rem] text-muted">Stagione non ancora letta per intero: la scansione la completa.</p> : null}
      {ours && ourName ? (
        <p className="flex items-center gap-2 rounded-xl border border-[#e0b15a]/35 bg-[#e0b15a]/[0.08] px-3 py-2 text-sm">
          <Glyph name="podium" size={18} />
          <span><b>{ours} {ours === 1 ? "podio" : "podi"}</b> di {ourName} in questa stagione</span>
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/[0.05] p-1">
        {tabs.map(([id, label, n]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={cx("min-h-10 rounded-xl text-[0.78rem] font-semibold", view === id ? "bg-primary text-primary-fg shadow" : "text-muted")}>
            {label} <span className="tabular-nums opacity-70">{n}</span>
          </button>
        ))}
      </div>
      {view === "compagnie" ? (
        genSq.length ? <TeamsBoard items={genSq} crestOf={crestOf} mark={markTeam} /> : <p className="text-sm text-muted">Classifica generale delle compagnie non ancora salvata.</p>
      ) : view === "arcieri" ? (
        genAr.length ? <ArchersBoard items={genAr} crestOf={crestOf} mark={markArcher} note="Classifica generale della stagione: i primi tre di ogni categoria." /> : <p className="text-sm text-muted">Classifica generale degli arcieri non ancora salvata.</p>
      ) : gare.length ? (
        <ul className="grid gap-1.5">
          {gare.map((g) => <GaraRow key={g.id} g={g} crestOf={crestOf} isOurs={isOurs} markTeam={markTeam} markArcher={markArcher} />)}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nessuna gara salvata per questa stagione.</p>
      )}
    </div>
  );
}

/** la generale delle compagnie: categoria, podio con gli stemmi e il resto della classifica */
function TeamsBoard({ items, crestOf, mark }: { items: Standing[]; crestOf: (t: string) => Crest | null; mark: (r: StandingRow) => "nostro" | null }) {
  const { groups, order } = useSplit(items);
  const [g, setG] = useState("");
  const group = order.includes(g) ? g : order[0] ?? "";
  const tips = [...(groups.get(group)?.keys() ?? [])];
  const [t, setT] = useState("");
  const tip = tips.includes(t) ? t : tips[0] ?? "";
  const it = groups.get(group)?.get(tip);
  const [all, setAll] = useState(false);
  const rows = it?.rows ?? [];
  const top = rows.slice(0, 3).map((r) => {
    const c = crestOf(r.name);
    const drawn = c?.logoUrl ? null : drawCrest(r.name);
    return { key: r.name, name: titleName(r.name), mark: `${num(r.camp ?? r.score)} ${r.camp != null ? "pt camp." : "punti"}`, logo: c?.logoUrl ?? drawn?.logo ?? null, color: c?.color ?? drawn?.color ?? "#1f7a46" };
  });
  const rest = rows.slice(3);
  const ourFar = rest.findIndex((r) => mark(r));
  return (
    <div className="grid gap-2">
      <Chips value={group} options={order} onChange={setG} />
      <Chips value={tip} options={tips} onChange={setT} />
      {top.length >= 2 ? <CrestPodium rows={top} /> : null}
      <RankList rows={top.length >= 2 ? rest : rows} crestOf={crestOf} team limit={all ? rows.length : 5} mark={mark} />
      {!all && ourFar >= 5 ? <RankList rows={[rest[ourFar]]} crestOf={crestOf} team limit={1} mark={mark} /> : null}
      {rest.length > 5 ? (
        <button type="button" className="aa-chip justify-self-center px-4 py-2 text-sm" onClick={() => setAll((v) => !v)}>{all ? "Mostra meno" : `Tutte le compagnie (${rows.length})`}</button>
      ) : null}
    </div>
  );
}

/** i podi degli arcieri di una classifica, categoria per categoria */
function ArchersBoard({ items, crestOf, mark, note }: { items: Standing[]; crestOf: (t: string) => Crest | null; mark: (r: StandingRow) => "nostro" | null; note?: string }) {
  const { groups, order } = useSplit(items);
  const [g, setG] = useState("");
  const group = order.includes(g) ? g : order[0] ?? "";
  const tips = [...(groups.get(group)?.keys() ?? [])];
  const [t, setT] = useState("");
  const tip = tips.includes(t) ? t : tips[0] ?? "";
  const it = groups.get(group)?.get(tip);
  return (
    <div className="grid gap-2">
      <Chips value={group} options={order} onChange={setG} />
      <Chips value={tip} options={tips} onChange={setT} />
      {it ? <RankList rows={it.rows.slice(0, 3)} crestOf={crestOf} limit={3} mark={mark} /> : null}
      {note ? <p className="px-1 text-[0.7rem] text-muted">{note}{it && it.total > 3 ? ` In archivio tutti i ${it.total} arcieri di questa categoria.` : ""}</p> : null}
    </div>
  );
}

/** una gara della stagione: si apre sui podi */
function GaraRow({ g, crestOf, isOurs, markTeam, markArcher }: { g: ArchiveGara; crestOf: (t: string) => Crest | null; isOurs: (team: string) => boolean; markTeam: (r: StandingRow) => "nostro" | null; markArcher: (r: StandingRow) => "nostro" | null }) {
  const [open, setOpen] = useState(false);
  const arcieri = useMemo(() => g.arcieri.map((b) => toStanding(b, "gara-arcieri", g)), [g]);
  const ours = g.arcieri.reduce((t, b) => t + b.rows.filter((r) => onPodium(r) && isOurs(r.team)).length, 0) + g.squadre.reduce((t, b) => t + b.rows.filter((r) => onPodium(r) && isOurs(r.name)).length, 0);
  const [c, setC] = useState("");
  const sqOpts = g.squadre.map((b) => titleName(b.category) || "Tutte");
  const sq = g.squadre[Math.max(0, sqOpts.indexOf(c))];
  return (
    <li className="rounded-2xl bg-white/[0.035]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="aa-press flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <span className="grid w-11 shrink-0 text-center leading-none">
          <b className="font-display text-lg tabular-nums">{g.day.slice(8, 10) || "—"}</b>
          <span className="text-[0.6rem] uppercase text-muted">{g.day ? new Date(`${g.day}T12:00:00`).toLocaleDateString("it-IT", { month: "short" }) : ""}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{titleName(g.title) || `Gara ${g.id}`}</span>
          <span className="block text-xs text-muted">{[fmtDay(g.day), `${g.arcieri.length} categorie`].filter(Boolean).join(" · ")}</span>
        </span>
        {ours ? <span className="shrink-0 rounded-full bg-[#e0b15a]/20 px-2 py-0.5 text-[0.68rem] font-semibold text-[#f1cf8a]">{ours} {ours === 1 ? "podio" : "podi"} nostri</span> : null}
        <Glyph name="chevron" size={15} className={cx("shrink-0 text-muted transition-transform", open && "rotate-90")} />
      </button>
      {open ? (
        <div className="grid gap-3 px-3 pb-3">
          {arcieri.length ? <ArchersBoard items={arcieri} crestOf={crestOf} mark={markArcher} /> : <p className="text-sm text-muted">Classifica arcieri non salvata.</p>}
          {g.squadre.length ? (
            <div className="grid gap-1.5">
              <p className="text-sm font-semibold">Compagnie</p>
              <Chips value={sqOpts[Math.max(0, sqOpts.indexOf(c))] ?? ""} options={sqOpts} onChange={setC} />
              {sq ? <RankList rows={sq.rows.slice(0, 3)} crestOf={crestOf} team limit={3} mark={markTeam} /> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
