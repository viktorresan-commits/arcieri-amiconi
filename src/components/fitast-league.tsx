import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Glyph } from "@/components/icons";
import { Card, ErrorNote, Loading, cx } from "@/components/kit";
import { Medal } from "@/components/palmares";
import { CrestPodium } from "@/components/podium";
import { Insignia } from "@/components/insignia";
import { useLoad } from "@/lib/arcieri/use-load";
import { fitastStandings, fitastTeamArchers, fitastTeamStats, type Standing, type StandingRow, type TeamArcher, type TeamStat } from "@/lib/arcieri/fitast-league.api";
import { categoryGroup, crestOf as drawCrest, teamKey, titleName } from "@/lib/arcieri/fitast-league";
import { syncStandings, type SyncProgress } from "@/lib/arcieri/fitast-sync";

type Crest = { name: string; logoUrl: string | null; color: string; fitastName?: string };

const GROUPS = ["Messeri", "Madonne", "Juniores", "Pueri"];
const STALE_MS = 12 * 3_600_000;
const fmtDay = (d: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
const pts = (r: StandingRow) => r.camp ?? r.score;
const num = (n: number | null) => (n == null ? "—" : n.toLocaleString("it-IT"));

/** stemma della compagnia scritta nella classifica, se è nell'app */
function useCrests(companies: Crest[]) {
  return useMemo(() => {
    const map = new Map<string, Crest>();
    for (const c of companies) {
      for (const k of [teamKey(c.fitastName ?? ""), teamKey(c.name)]) if (k && !map.has(k)) map.set(k, c);
    }
    return (team: string) => map.get(teamKey(team)) ?? null;
  }, [companies]);
}

const drawn = new Map<string, string>();
/** stemma della compagnia; se non è nell'app, quello disegnato dal suo nome (sempre lo stesso) */
function CrestMark({ crest, team, size = 30 }: { crest: Crest | null; team: string; size?: number }) {
  let src = crest?.logoUrl ?? "";
  if (!src && team) {
    src = drawn.get(team) ?? drawCrest(team).logo;
    drawn.set(team, src);
  }
  if (src) return <img src={src} alt="" className="shrink-0 object-contain" style={{ width: size * 0.86, height: size }} />;
  return <span className="grid shrink-0 place-items-center rounded-full bg-white/[0.07]" style={{ width: size, height: size }} aria-hidden />;
}

function Place({ place, size = 30 }: { place: number | null; size?: number }) {
  if (place && place <= 3) return <Medal place={place} size={size} />;
  return <span className="grid shrink-0 place-items-center rounded-full bg-white/[0.07] text-xs font-semibold tabular-nums" style={{ width: size, height: size }}>{place ?? "—"}</span>;
}

/** scelta a pastiglie (categorie, tipologie) */
function Chips({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  if (options.length < 2) return null;
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)} className={cx("aa-chip shrink-0", value === o && "border-[#e0b15a]/60 bg-[#e0b15a]/15 text-[#f1cf8a]")}>
          {o}
        </button>
      ))}
    </div>
  );
}

/** le categorie di un gruppo di classifiche, divise in gruppo (Messeri…) e tipologia d'arco */
function useSplit(items: Standing[]) {
  return useMemo(() => {
    const groups = new Map<string, Map<string, Standing>>();
    for (const it of items) {
      const { group, tipologia } = categoryGroup(it.category);
      const g = group || "Tutti";
      if (!groups.has(g)) groups.set(g, new Map());
      groups.get(g)!.set(tipologia || "Tutte", it);
    }
    const order = [...groups.keys()].sort((a, b) => (GROUPS.indexOf(a) + 1 || 99) - (GROUPS.indexOf(b) + 1 || 99) || a.localeCompare(b, "it"));
    return { groups, order };
  }, [items]);
}

function RankList({ rows, crestOf, team, limit, onTeam }: { rows: StandingRow[]; crestOf: (t: string) => Crest | null; team?: boolean; limit: number; /** tocca una compagnia: i suoi arcieri */ onTeam?: (name: string) => void }) {
  return (
    <ol className="grid gap-1.5">
      {rows.slice(0, limit).map((r, i) => (
        <li
          key={`${r.name}-${i}`}
          className={cx("flex items-center gap-2.5 rounded-xl bg-white/[0.035] px-2.5 py-2", onTeam && "aa-press cursor-pointer active:bg-white/[0.07]")}
          {...(onTeam ? { role: "button", tabIndex: 0, onClick: () => onTeam(team ? r.name : r.team), onKeyDown: (e: { key: string }) => { if (e.key === "Enter") onTeam(team ? r.name : r.team); } } : {})}
        >
          <Place place={r.place} />
          <CrestMark crest={crestOf(team ? r.name : r.team)} team={team ? r.name : r.team} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{titleName(r.name)}</span>
            {!team && r.team ? <span className="block truncate text-xs text-muted">{titleName(r.team)}</span> : null}
          </span>
          <span className="shrink-0 text-right">
            <b className="block font-display text-lg leading-none tabular-nums">{num(pts(r))}</b>
            <span className="text-[0.58rem] uppercase tracking-wider text-muted">{r.camp != null ? "pt camp." : "punti"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** una classifica divisa per categoria (e tipologia): pastiglie e la lista */
/** i primi tre della classifica sul podio, con gli stemmi delle compagnie */
function TeamPodium({ rows, crestOf, onTeam }: { rows: StandingRow[]; crestOf: (t: string) => Crest | null; onTeam?: (name: string) => void }) {
  const top = rows.slice(0, 3).map((r) => {
    const c = crestOf(r.name);
    const drawnCrest = c?.logoUrl ? null : drawCrest(r.name);
    return { key: r.name, name: titleName(r.name), mark: `${num(pts(r))} ${r.camp != null ? "pt camp." : "punti"}`, logo: c?.logoUrl ?? drawnCrest?.logo ?? null, color: c?.color ?? drawnCrest?.color ?? "#1f7a46" };
  });
  return <CrestPodium rows={top} onPick={onTeam ? (key) => onTeam(key) : undefined} />;
}

function SplitBoard({ items, crestOf, team, limit, empty }: { items: Standing[]; crestOf: (t: string) => Crest | null; team?: boolean; limit: number; empty: string }) {
  const [shown, setShown] = useState<string | null>(null);
  const { groups, order } = useSplit(items);
  const [g, setG] = useState("");
  const group = order.includes(g) ? g : order[0] ?? "";
  const tips = [...(groups.get(group)?.keys() ?? [])];
  const [t, setT] = useState("");
  const tip = tips.includes(t) ? t : tips[0] ?? "";
  const it = groups.get(group)?.get(tip);
  if (!items.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="grid gap-2">
      <Chips value={group} options={order} onChange={setG} />
      <Chips value={tip} options={tips} onChange={setT} />
      {it && team && it.rows.length >= 3 ? (
        <>
          <TeamPodium rows={it.rows} crestOf={crestOf} onTeam={setShown} />
          <RankList rows={it.rows.slice(3)} crestOf={crestOf} team={team} limit={limit - 3} onTeam={setShown} />
        </>
      ) : it ? <RankList rows={it.rows} crestOf={crestOf} team={team} limit={limit} onTeam={setShown} /> : null}
      {team ? <p className="px-1 text-[0.7rem] text-muted">Tocca una compagnia per vedere tutti i suoi arcieri.</p> : null}
      {shown ? <TeamArchersSheet team={shown} crest={crestOf(shown)} onClose={() => setShown(null)} /> : null}
    </div>
  );
}

/** Tutti gli arcieri di una compagnia nel campionato (classifica generale arcieri), dal migliore. */
export function TeamArchersSheet({ team, crest, onClose }: { team: string; crest: Crest | null; onClose: () => void }) {
  const { data, error, loading } = useLoad(`fitast-team-${team}`, () => fitastTeamArchers({ data: { team } }));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  const list: TeamArcher[] = data?.archers ?? [];
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 backdrop-blur-[3px] md:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Arcieri di ${titleName(team)}`}>
      <div className="aa-sheet grid max-h-[88dvh] w-full max-w-lg grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-t-3xl border-t border-hair bg-elev p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:rounded-3xl md:border" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-3">
          <CrestMark crest={crest} team={team} size={46} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-2xl leading-tight">{crest?.name ?? titleName(team)}</h2>
            <p className="text-xs text-muted">{loading ? "Leggo la classifica…" : `${list.length} ${list.length === 1 ? "arciere" : "arcieri"} nel campionato${data?.season ? ` · ${data.season}` : ""}`}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06]">
            <Glyph name="close" size={18} />
          </button>
        </header>
        <div className="-mx-1 overflow-y-auto px-1">
          {error ? <ErrorNote text={error} /> : loading ? <Loading /> : !list.length ? (
            <p className="py-6 text-center text-sm text-muted">Nessun arciere di questa compagnia nella classifica generale. Tocca «Aggiorna dal portale» per leggerla intera.</p>
          ) : (
            <ol className="grid gap-1.5">
              {list.map((a, i) => (
                <li key={`${a.name}-${i}`} className="flex items-center gap-2.5 rounded-xl bg-white/[0.035] px-2.5 py-2">
                  <span className="w-6 shrink-0 text-center font-display text-base tabular-nums text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{titleName(a.name)}</span>
                    <span className="block truncate text-xs text-muted">{titleName(a.category)}{a.place ? ` · ${a.place}° in categoria` : ""}</span>
                  </span>
                  {a.place && a.place <= 3 ? <Medal place={a.place} size={26} /> : null}
                  <span className="shrink-0 text-right">
                    <b className="block font-display text-lg leading-none tabular-nums">{num(a.points)}</b>
                    <span className="text-[0.58rem] uppercase tracking-wider text-muted">pt camp.</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** classifiche FITAST salvate e il loro aggiornamento dal portale (uno per scheda) */
export function useFitastLeague(companies: Crest[]) {
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`fitast-standings-${nonce}`, () => fitastStandings());
  const crestOf = useCrests(companies);
  const [sync, setSync] = useState<SyncProgress | null>(null);
  const stop = useRef(false);
  const running = Boolean(sync && !sync.done);

  async function refresh() {
    stop.current = false;
    setSync({ step: "Apro il portale", pages: 0, saved: 0 });
    try {
      await syncStandings({
        onProgress: (p) => setSync({ ...p }),
        stop: () => stop.current,
      });
    } catch (e) {
      setSync((s) => ({ ...(s ?? { step: "", pages: 0, saved: 0 }), done: true, error: e instanceof Error ? e.message : "Aggiornamento non riuscito." }));
    }
    setNonce((n) => n + 1);
  }
  // si aggiorna da solo quando le classifiche salvate sono vecchie (una volta per apertura dell'app)
  useEffect(() => {
    if (!data) return;
    const old = !data.updatedAt || Date.now() - new Date(data.updatedAt).getTime() > STALE_MS;
    let asked = false;
    try {
      asked = sessionStorage.getItem("aa-fitast-league") === "1";
      if (old && !asked) sessionStorage.setItem("aa-fitast-league", "1");
    } catch {
      asked = false;
    }
    if (old && !asked) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const genSq = useMemo(() => items.filter((x) => x.kind === "generale-squadre"), [items]);
  const genAr = useMemo(() => items.filter((x) => x.kind === "generale-arcieri"), [items]);
  const gare = useMemo(() => {
    const byId = new Map<string, { id: string; title: string; day: string; arcieri: Standing[]; squadre: Standing[] }>();
    for (const x of items) {
      if (x.kind !== "gara-arcieri" && x.kind !== "gara-squadre") continue;
      const g = byId.get(x.garaId) ?? { id: x.garaId, title: x.garaTitle, day: x.day, arcieri: [], squadre: [] };
      (x.kind === "gara-arcieri" ? g.arcieri : g.squadre).push(x);
      g.title ||= x.garaTitle;
      g.day ||= x.day;
      byId.set(x.garaId, g);
    }
    return [...byId.values()].sort((a, b) => b.day.localeCompare(a.day));
  }, [items]);
  return { data, error, loading, crestOf, sync, running, refresh, stop: () => { stop.current = true; }, genSq, genAr, gare };
}
export type FitastLeagueState = ReturnType<typeof useFitastLeague>;

/** in cima: il campionato, quando è stato letto e il pulsante per rileggerlo dal portale */
export function FitastHeader({ league }: { league: FitastLeagueState }) {
  const { data, sync, running, error } = league;
  return (
    <Card className="grid gap-3 overflow-hidden">
      <div className="flex items-start gap-3">
        <Insignia symbol="laurel" metal="gold" enamel="sapphire" shape="rosette" size={58} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight">Campionato FITAST</h2>
          <p className="text-sm text-muted">{data?.seasonName || "Campionato in corso"} · classifiche lette dal portale FITAST e salvate per tutti.</p>
          {data?.updatedAt ? <p className="mt-0.5 text-xs text-muted">Aggiornate il {new Date(data.updatedAt).toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <button type="button" className="aa-chip" onClick={league.stop}>Ferma</button>
        ) : (
          <button type="button" className="aa-chip border-[#e0b15a]/50 text-[#f1cf8a]" onClick={() => void league.refresh()}>Aggiorna dal portale</button>
        )}
        {sync ? <span className="text-xs text-muted">{running ? `${sync.step} · ${sync.pages} pagine lette` : sync.error ? sync.error : `Aggiornate ${sync.saved} classifiche in ${sync.pages} pagine.`}</span> : null}
      </div>
      {sync?.done && sync.diag?.length && !sync.saved ? (
        <details className="rounded-2xl bg-white/[0.03] p-3 text-xs text-muted">
          <summary className="cursor-pointer">Dettagli tecnici (classifiche senza righe)</summary>
          <p className="mt-1 break-all font-mono text-[0.62rem] leading-snug">{sync.diag.join(" | ")}</p>
        </details>
      ) : null}
      {error ? <ErrorNote text={error} /> : null}
    </Card>
  );
}

/** classifica generale compagnie del campionato (punti per tipologia, con stemmi e medaglie) */
export function FitastCompanyBoard({ league }: { league: FitastLeagueState }) {
  return <SplitBoard items={league.genSq} crestOf={league.crestOf} team limit={40} empty={league.running ? "In lettura dal portale…" : "Ancora non letta: tocca Aggiorna dal portale."} />;
}

export type TeamMetric = "avg" | "members" | "gare";

/**
 * Classifica delle compagnie con i numeri veri del campionato FITAST (non quelli dell'app): media dei punti
 * per arciere, arcieri in gara, gare disputate. Podio con gli stemmi; tocca una compagnia per i suoi arcieri.
 */
export function FitastTeamsBoard({ league, metric }: { league: FitastLeagueState; metric: TeamMetric }) {
  const { data, error, loading } = useLoad(`fitast-teams-${league.data?.updatedAt ?? ""}`, () => fitastTeamStats());
  const [shown, setShown] = useState<string | null>(null);
  if (error) return <ErrorNote text={error} />;
  if (loading && !data) return <Loading />;
  const value = (t: TeamStat) => (metric === "avg" ? t.avg ?? 0 : metric === "members" ? t.archers : t.gare);
  const teams = (data?.teams ?? []).filter((t) => (metric === "avg" ? t.avg != null : value(t) > 0)).sort((a, b) => value(b) - value(a) || a.team.localeCompare(b.team, "it"));
  if (!teams.length) return <p className="text-sm text-muted">{league.running ? "In lettura dal portale…" : "Ancora nessun dato: tocca «Aggiorna dal portale»."}</p>;
  const fmt = (t: TeamStat) => (metric === "avg" ? (t.avg ?? 0).toFixed(1).replace(".", ",") : String(value(t)));
  const unit = metric === "avg" ? "pt per arciere" : metric === "members" ? "arcieri" : "gare";
  const max = Math.max(...teams.map(value), 1);
  const top = teams.slice(0, 3).map((t) => {
    const c = league.crestOf(t.team);
    const d = c?.logoUrl ? null : drawCrest(t.team);
    return { key: t.team, name: c?.name ?? titleName(t.team), mark: `${fmt(t)} ${unit}`, logo: c?.logoUrl ?? d?.logo ?? null, color: c?.color ?? d?.color ?? "#1f7a46" };
  });
  return (
    <div className="grid gap-2">
      {teams.length >= 2 ? <CrestPodium rows={top} onPick={setShown} /> : null}
      <ol className="grid gap-1.5">
        {teams.slice(teams.length >= 2 ? 3 : 0, 40).map((t, i) => {
          const c = league.crestOf(t.team);
          return (
            <li key={t.team}>
              <button type="button" onClick={() => setShown(t.team)} className="aa-press flex w-full items-center gap-2.5 rounded-xl bg-white/[0.035] px-2.5 py-2 text-left active:bg-white/[0.07]">
                <Place place={(teams.length >= 2 ? 4 : 1) + i} />
                <CrestMark crest={c} team={t.team} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{c?.name ?? titleName(t.team)}</span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (value(t) / max) * 100)}%` }} /></span>
                  <span className="mt-0.5 block truncate text-[0.68rem] text-muted">{[`${t.archers} arcieri`, `${t.gare} ${t.gare === 1 ? "gara" : "gare"}`, t.avg != null ? `media ${t.avg.toFixed(1).replace(".", ",")}` : ""].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="shrink-0 text-right">
                  <b className="block font-display text-lg leading-none tabular-nums">{fmt(t)}</b>
                  <span className="text-[0.58rem] uppercase tracking-wider text-muted">{metric === "avg" ? "media" : unit}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="px-1 text-[0.7rem] text-muted">Dati del campionato FITAST{data?.season ? ` (${data.season})` : ""}. Tocca una compagnia per vedere tutti i suoi arcieri.</p>
      {shown ? <TeamArchersSheet team={shown} crest={league.crestOf(shown)} onClose={() => setShown(null)} /> : null}
    </div>
  );
}

/** primi dieci arcieri del campionato per categoria */
export function FitastArchersCard({ league }: { league: FitastLeagueState }) {
  return (
    <Card className="grid gap-3">
      <div>
        <h3 className="font-display text-xl">Classifica generale arcieri</h3>
        <p className="text-xs text-muted">I primi dieci di ogni categoria del campionato: Messeri, Madonne, Juniores e Pueri.</p>
      </div>
      <SplitBoard items={league.genAr} crestOf={league.crestOf} limit={10} empty={league.running ? "In lettura dal portale…" : "Ancora non letta: tocca Aggiorna dal portale."} />
    </Card>
  );
}

/** ogni gara del campionato: primi tre arcieri per categoria e squadre */
export function FitastGare({ league }: { league: FitastLeagueState }) {
  const { gare, crestOf, running } = league;
  return (
    <div className="grid gap-2">
      <h3 className="px-1 font-display text-xl">Gare del campionato</h3>
      {!gare.length ? (
        <Card>
          <p className="text-sm text-muted">{running ? "In lettura dal portale…" : "Nessuna gara ancora letta. Le gare si riconoscono dopo una ricerca del proprio nome in Gare (Portale FITAST): poi Aggiorna dal portale."}</p>
        </Card>
      ) : null}
      {gare.map((g) => (
        <Card key={g.id} className="grid gap-3">
          <div className="flex items-start gap-3">
            <Insignia symbol="target" metal="gold" enamel="ruby" shape="shield" size={44} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg leading-tight">{titleName(g.title) || `Gara ${g.id}`}</p>
              <p className="text-xs text-muted">{[fmtDay(g.day), `gara ${g.id}`].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="grid gap-1.5">
            <p className="text-sm font-semibold">Primi tre arcieri</p>
            <SplitBoard items={g.arcieri} crestOf={crestOf} limit={3} empty="Classifica arcieri non ancora letta." />
          </div>
          <div className="grid gap-1.5">
            <p className="text-sm font-semibold">Squadre</p>
            <SplitBoard items={g.squadre} crestOf={crestOf} team limit={3} empty="Classifica squadre non ancora letta." />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** tutta la parte FITAST insieme (campionato, compagnie, arcieri, gare) */
export function FitastLeague({ companies }: { companies: Crest[] }) {
  const league = useFitastLeague(companies);
  if (league.loading && !league.data) return <Loading />;
  return (
    <div className="grid gap-4">
      <FitastHeader league={league} />
      <Card className="grid gap-3">
        <div>
          <h3 className="font-display text-xl">Classifica generale compagnie</h3>
          <p className="text-xs text-muted">I punti del campionato di ogni compagnia.</p>
        </div>
        <FitastCompanyBoard league={league} />
      </Card>
      <FitastArchersCard league={league} />
      <FitastGare league={league} />
    </div>
  );
}
