import { useEntryState } from "@/lib/arcieri/back-restore";
import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { deleteCompetition, deleteEntry, listCompetitions, saveCompetition, setPresence } from "@/lib/arcieri/club.api";
import { memberLabel, divisionOf } from "@/lib/arcieri/labels";
import { romeDayKey } from "@/lib/arcieri/time";
import { useLoad } from "@/lib/arcieri/use-load";
import { useMember } from "@/components/shell";
import { Avatar, Button, Card, Empty, ErrorNote, Field, HoldDelete, Loading, PageHead, TextInput } from "@/components/kit";
import { GaraTrend, type GaraPoint } from "@/components/gara-trend";
import { GaraResult } from "@/components/gara-result";
import { LaneEditor } from "@/components/lane-editor";
import { Glyph } from "@/components/icons";
import { useTeamAvatars } from "@/components/avatar-hero";
import { FitastPanel } from "@/components/fitast-panel";
import { Medal, teamResultText } from "@/components/palmares";
import { KindEmblem } from "@/components/kind-emblem";
import type { TeamResult } from "@/lib/arcieri/palmares.api";
import { CrestMark, GaraBoard, type Crest, type FitastLeagueState, type OurArcher } from "@/components/fitast-league";
import { FitastLinkCard } from "@/components/fitast-link";
import { ScorecardImport } from "@/components/scorecard-import";
import { categoryGroup } from "@/lib/arcieri/fitast-league";



type Lane = { n: number; score: number; arrows: number[]; label: string; distanceM: number | null; note: string; aimAngle: string };
type Entry = {
  id: number;
  userId: string;
  score: number | null;
  rank: number | null;
  laneCount: number | null;
  spot: number | null;
  championshipPoints: number | null;
  targetKind: "" | "padiglione" | "sagoma";
  sagomaMax: 11 | 10 | 8 | null;
  category: string;
  givenName: string;
  familyName: string;
  nickname: string;
  slug: string;
  photoUrl: string | null;
  avatarColor: string;
  piazzole: Lane[];
  /** dal portale FITAST: "solo" (nessun punteggio segnato nell'app) o "anche" */
  portal?: "" | "solo" | "anche";
  categorySize?: number | null;
};
type Comp = {
  id: number;
  name: string;
  startsOn: string;
  place: string;
  organizer: string;
  signupDeadline: string | null;
  /** piazzole della gara, se si sanno (scritte nella gara o lette da un cartellino); nel 3D di solito 20 */
  lanes?: number | null;
  notes?: string;
  canDelete?: boolean;
  attended: boolean | null;
  roster: { userId: string; attended: boolean; givenName: string; familyName: string; nickname: string; slug: string; photoUrl: string | null; avatarColor: string }[];
  entries: Entry[];
  teamResults?: TeamResult[];
  /** gara del campionato FITAST: tappa, campionato, arcieri in classifica e i nostri come li scrive il portale */
  fitast?: { garaId: string; step: number; champ: string; total: number; read: boolean; ours: OurArcher[] } | null;
  /** solo dal portale: nell'app la gara non c'è (niente presenza né punteggio da segnare) */
  virtual?: boolean;
  /** con chi si era in piazzola: dai cartellini letti dalla foto e dall'elenco delle piazzole del portale */
  group?: { piazzola: number; mates: Mate[] } | null;
};
type Mate = { name: string; team: string; lanes: { p: number; arrows: number[] }[] | null; total: number | null; spots: number | null; place: number | null; category: string; camp: number | null; size: number };

function hasResult(entry: Entry) {
  return entry.score != null || entry.spot != null || entry.championshipPoints != null || entry.laneCount != null || entry.piazzole.length > 0;
}


/** Le gare: dentro la Compagnia (scheda Gare) e alla pagina /gare, che apre la Compagnia su questa scheda. */
export function GareBody({ embedded = false, league }: { embedded?: boolean; /** classifiche FITAST (stemmi e aggiornamento dal portale) */ league?: FitastLeagueState } = {}) {
  const { me } = useMember();
  const crestOf = league?.crestOf ?? noCrest;
  const [board, setBoard] = useState<number | null>(null);
  const [photoFor, setPhotoFor] = useState<number | null>(null);
  const [openGare, setOpenGare] = useState<Record<number, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("aa-gare-aperte") ?? "{}") as Record<number, boolean>;
    } catch {
      return {};
    }
  });
  const toggleOpen = (id: number, was: boolean) =>
    setOpenGare((cur) => {
      const next = { ...cur, [id]: !was };
      try {
        localStorage.setItem("aa-gare-aperte", JSON.stringify(next));
      } catch {
        /* niente */
      }
      return next;
    });
  const today = romeDayKey(new Date().toISOString());
  const [nonce, setNonce] = useState(0);
  const [tab, setTab] = useEntryState<"past" | "next">("gare-tab", "past");
  const [scope, setScope] = useEntryState<"mine" | "rest">("gare-scope", "mine");
  const [open, setOpen] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [portal, setPortal] = useState<{ code: string } | null>(null);
  const myName = [me.familyName, me.givenName].filter(Boolean).join(" ").trim() || me.nickname || "";
  const hash = useRouterState({ select: (state) => state.location.hash });
  // quando le classifiche del portale si aggiornano, le gare si rileggono (posti e punti nuovi)
  const { data, error, loading } = useLoad(`gare-${nonce}-${league?.data?.updatedAt ?? ""}`, () => listCompetitions());
  const comps = (data?.competitions ?? []) as Comp[];
  const pool = comps.filter((comp) => (tab === "past" ? comp.startsOn < today : comp.startsOn >= today));
  const tookPart = (comp: Comp) => comp.attended === true || comp.entries.some((entry) => entry.userId === me.userId && hasResult(entry));
  const shown = pool
    .filter((comp) => (scope === "mine" ? tookPart(comp) : !tookPart(comp)))
    .slice()
    .sort((a, b) => (tab === "next" ? a.startsOn.localeCompare(b.startsOn) : b.startsOn.localeCompare(a.startsOn)) || a.id - b.id);
  const minePoints = useMemo(() => pointsOf(comps, me.userId ?? ""), [comps, me.userId]);
  const totals = useMemo(() => totalsOf(comps, me.userId ?? ""), [comps, me.userId]);

  useEffect(() => {
    const id = Number(String(hash).replace(/^#gara-/, ""));
    if (!id || !comps.length) return;
    const comp = comps.find((item) => item.id === id);
    if (!comp) return;
    setTab(comp.startsOn >= today ? "next" : "past");
    const mine = comp.attended === true || comp.entries.some((entry) => entry.userId === me.userId && hasResult(entry));
    setScope(mine ? "mine" : "rest");
    const timer = window.setTimeout(() => {
      document.getElementById(`gara-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [hash, comps, today, me.userId]);

  function reload(id?: number) {
    setNonce((n) => n + 1);
    if (id != null) setOpen(id);
  }

  function mark(id: number, attended: boolean) {
    setPresence({ data: { competitionId: id, attended } })
      .then(() => {
        if (attended) setScope("mine");
        setNonce((n) => n + 1);
      })
      .catch(() => setNonce((n) => n + 1));
  }

  return (
    <div className="grid min-w-0 gap-4">
      {embedded ? null : <PageHead title="Gare" lede="Segni solo quelle a cui hai partecipato. Il punteggio degli altri si vede, ma si cambia solo il tuo." />}
      {totals.gare > 0 ? (
        <Card className="relative">
          <span className="absolute right-3 top-3"><KindEmblem kind="campionato" size={54} glow /></span>
          <p className="text-xs uppercase tracking-wide text-muted">Tutte le gare</p>
          <p className="font-display text-4xl tabular-nums leading-none">{totals.points}</p>
          <p className="mt-1 text-sm text-muted">punti in {totals.gare} gare{totals.avg != null ? ` · media ${totals.avg.toFixed(1).replace(".", ",")}` : ""}{totals.perArrow != null ? ` · ${totals.perArrow.toFixed(2).replace(".", ",")} a freccia` : ""}</p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <MiniStat k="Piazzole" v={String(totals.lanes)} />
            <MiniStat k="Frecce" v={String(totals.arrows)} />
            <MiniStat k="Spot" v={String(totals.spots)} />
            <MiniStat k="Campionato" v={String(totals.champ)} />
          </div>
          {totals.distances.length ? (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wide text-muted">Distanze</p>
              <p className="mt-1 text-sm text-muted">Migliore {totals.bestDistance} m · media {totals.avgDistance?.toFixed(1)} m</p>
              <ul className="mt-2 grid gap-1 text-sm">
                {totals.distances.map((row) => (
                  <li key={row.distance} className="flex justify-between gap-3">
                    <span>{row.distance} m</span>
                    <span className="tabular-nums text-muted">{row.lanes} piazzole · {row.arrows} frecce</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}
      <FitastLinkCard crestOf={crestOf} onChanged={() => setNonce((n) => n + 1)} />
      {league?.running ? <p className="px-1 text-xs text-muted">Aggiorno le classifiche dal portale FITAST…</p> : null}
      <div className="grid grid-cols-2 gap-2">
        {([["past", "Passate"], ["next", "In arrivo"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`min-h-11 rounded-xl text-sm font-semibold ${tab === id ? "bg-primary text-primary-fg" : "border border-line"}`}>{label}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {([["mine", "Le mie"], ["rest", "Le altre"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setScope(id)} className={`min-h-11 rounded-xl text-sm font-semibold ${scope === id ? "bg-accent text-accent-fg" : "border border-line"}`}>{label}</button>
        ))}
      </div>
      {loading ? <Loading /> : null}
      {error ? <ErrorNote text={error} /> : null}
      {!loading && !shown.length ? <Empty title={scope === "mine" ? "Nessuna tua gara" : "Nessuna altra gara"} text={scope === "mine" ? "Segna quelle a cui hai partecipato. Le altre restano nel calendario, senza chiedere il punteggio." : "Qui ci sono le gare che non hai segnato."} /> : null}
      <div className="grid gap-3">
        {shown.map((comp, index) => {
          // le prime due gare aperte, le altre chiuse; ognuna si apre e si chiude con un tocco (e resta così)
          const isOpen = openGare[comp.id] ?? index < 2;
          const mine = comp.entries.find((entry) => entry.userId === me.userId) ?? null;
          const ownScore = mine ? hasResult(mine) && mine.portal !== "solo" : false;
          const ask = scope === "mine" && comp.attended !== false && !comp.virtual;
          const scored = comp.entries.filter((entry) => hasResult(entry)).sort((a, b) => Number(b.userId === me.userId) - Number(a.userId === me.userId) || (b.championshipPoints ?? -1) - (a.championshipPoints ?? -1) || (b.score ?? -1) - (a.score ?? -1));
          const fromPortal = scored.some((entry) => entry.portal);
          const f = comp.fitast ?? null;
          const portalCode = f?.garaId ?? "";
          const others = (comp.roster ?? []).filter((person) => !scored.some((entry) => entry.userId === person.userId));
          return (
            <div key={comp.id} id={`gara-${comp.id}`} className="scroll-mt-4">
            <Card className="grid min-w-0 gap-3">
              <button type="button" onClick={() => toggleOpen(comp.id, isOpen)} aria-expanded={isOpen} className="flex w-full min-w-0 items-start gap-2 text-left">
                <span className="min-w-0 flex-1"><GaraHead comp={comp} crestOf={crestOf} tab={tab} /></span>
                <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06]" aria-hidden>
                  <Glyph name="chevron" size={14} className={`text-muted transition-transform ${isOpen ? "-rotate-90" : "rotate-90"}`} />
                </span>
              </button>
              {isOpen ? (
                <>
              {scored.length ? (
                <div className="grid min-w-0 gap-1.5">
                  <p className="flex items-baseline justify-between gap-2 text-sm font-semibold">
                    <span>I nostri</span>
                    {fromPortal ? <span className="text-[0.7rem] font-normal text-muted">dal portale FITAST</span> : null}
                  </p>
                  <ul className="grid min-w-0 gap-1.5">
                    {scored.map((entry) => {
                      const own = entry.userId === me.userId;
                      const key = `${comp.id}:${entry.userId}`;
                      const row = (
                        <button type="button" className="w-full min-w-0 text-left" onClick={() => setFocus(focus === key ? null : key)}>
                          <ScoreRow entry={entry} peers={comp.entries} own={own} />
                        </button>
                      );
                      return (
                        <li key={entry.id} className="grid min-w-0 gap-2">
                          {own && entry.id > 0 ? (
                            <HoldDelete label="Eliminare questo punteggio?" onDelete={() => deleteEntry({ data: { competitionId: comp.id, userId: entry.userId } }).then(() => setNonce((n) => n + 1))}>
                              {row}
                            </HoldDelete>
                          ) : row}
                          {focus === key ? (
                            <div className="grid min-w-0 gap-3">
                              <GaraResult title={comp.name} entry={entry} peers={comp.entries.filter((person) => hasResult(person))} />
                              <GaraTrend points={pointsOf(comps, entry.userId)} activeId={key} />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {comp.teamResults?.length ? <TeamLine results={comp.teamResults} /> : null}
              {comp.group?.mates.length ? <PiazzolaMates group={comp.group} past={tab === "past"} /> : null}
              <Roster tab={tab} people={tab === "past" ? others : comp.roster ?? []} also={scored.length > 0} />
              {f?.read && tab === "past" ? (
                board === comp.id ? (
                  <div className="grid gap-2 rounded-2xl border border-line p-2.5">
                    <button type="button" onClick={() => setBoard(null)} className="flex items-center justify-between gap-2 text-left text-sm font-semibold">
                      <span>Classifica della gara</span>
                      <Glyph name="chevron" size={16} className="-rotate-90 text-muted" />
                    </button>
                    <GaraBoard garaId={f.garaId} ours={f.ours} me={me.userId ?? ""} crestOf={crestOf} myTeam={comp.teamResults?.[0]?.team ?? ""} />
                  </div>
                ) : (
                  <button type="button" onClick={() => setBoard(comp.id)} className="aa-press flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5 text-left">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06]"><Glyph name="podium" size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-sm">Classifica della gara</b>
                      <span className="block text-xs text-muted">tutte le categorie{f.total ? ` · ${f.total} arcieri` : ""}</span>
                    </span>
                    <Glyph name="chevron" size={16} className="rotate-90 text-muted" />
                  </button>
                )
              ) : null}
              {portalCode || ask ? (
                <div className={portalCode && ask && open !== comp.id ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
                  {ask ? (
                    open === comp.id ? (
                      <LaneEditor compId={comp.id} mine={mine && mine.id > 0 ? mine : null} onSaved={() => setNonce((n) => n + 1)} onDone={() => { setOpen(null); setFocus(`${comp.id}:${me.userId}`); reload(); }} />
                    ) : (
                      <Button className="w-full text-sm" variant="ghost" onClick={() => setOpen(comp.id)}>{ownScore ? "Le tue piazzole" : mine?.portal === "solo" ? "Aggiungi le piazzole" : "Metti il punteggio"}</Button>
                    )
                  ) : null}
                  {portalCode && open !== comp.id ? (
                    <Button className="w-full text-sm" variant="ghost" onClick={() => { setPortal({ code: portalCode }); window.setTimeout(() => document.getElementById("fitast")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }}>
                      {tab === "next" ? "Piazzole e iscritti" : "Cerca sul portale"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {tab === "past" && !comp.virtual && me.role !== "viewer" ? (
                photoFor === comp.id ? (
                  <ScorecardImport compId={comp.id} onClose={() => setPhotoFor(null)} onSaved={() => setNonce((n) => n + 1)} />
                ) : (
                  <button type="button" onClick={() => setPhotoFor(comp.id)} className="aa-press flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5 text-left">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06]"><Glyph name="camera" size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-sm">Cartellino dalla foto</b>
                      <span className="block text-xs text-muted">le tue piazzole e quelle dei compagni di piazzola</span>
                    </span>
                  </button>
                )
              ) : null}
              {scope === "rest" && !comp.virtual ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button className="w-full text-sm" onClick={() => mark(comp.id, true)}>{tab === "past" ? "Ho partecipato" : "Ci vado"}</Button>
                  <Button className="w-full text-sm" variant="ghost" onClick={() => mark(comp.id, false)}>{tab === "past" ? "Non ho partecipato" : "Non ci vado"}</Button>
                </div>
              ) : null}
              {!comp.virtual && ((scope === "mine" && !mine?.portal) || comp.canDelete) ? (
                <div className="grid gap-1.5 border-t border-white/[0.06] pt-2">
                  {scope === "mine" && !mine?.portal ? (
                    <HoldDelete hint={false} label="Togliere questa gara dalle tue?" onDelete={() => deleteCompetition({ data: { id: comp.id, scope: "mine" } }).then(() => setNonce((n) => n + 1))}>
                      <span className="block text-center text-xs text-muted">Tieni premuto per togliere la gara dalle tue (punteggio compreso)</span>
                    </HoldDelete>
                  ) : null}
                  {comp.canDelete ? (
                    <HoldDelete hint={false} label="Eliminare la gara per tutti?" onDelete={() => deleteCompetition({ data: { id: comp.id, scope: "all" } }).then(() => setNonce((n) => n + 1))}>
                      <span className="block text-center text-xs text-muted">Tieni premuto per eliminare la gara per tutti</span>
                    </HoldDelete>
                  ) : null}
                </div>
              ) : null}
                </>
              ) : (
                <p className="-mt-1 text-xs text-muted">{closedLine(comp, mine, scored.length)}</p>
              )}
            </Card>
            </div>
          );
        })}
      </div>
      {minePoints.length ? (
        <Card>
          <h2 className="mb-2 font-display text-2xl">Tra gara e gara</h2>
          <GaraTrend points={minePoints} />
        </Card>
      ) : null}
      <div id="fitast" className="scroll-mt-4">
        {portal ? (
          <FitastPanel
            key={portal.code}
            comps={comps}
            myName={myName}
            userId={me.userId ?? ""}
            startCode={portal.code}
            onSaved={() => setNonce((n) => n + 1)}
            onClose={() => setPortal(null)}
            onEditLanes={(id) => {
              // dal punteggio salvato alle piazzole: la gara tra le mie, con l'editor aperto
              const comp = comps.find((c) => c.id === id);
              if (comp) setTab(comp.startsOn < today ? "past" : "next");
              setScope("mine");
              setOpen(id);
              window.setTimeout(() => document.getElementById(`gara-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
            }}
          />
        ) : (
          <button type="button" onClick={() => setPortal({ code: "" })} className="aa-press flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-[#e0b15a]/30 bg-[#e0b15a]/[0.07] p-3 text-left">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e0b15a]/25"><Glyph name="trophy" size={22} /></span>
            <span className="min-w-0 flex-1">
              <b className="block">Portale FITAST</b>
              <span className="block text-xs text-muted">Cerca il tuo nome: punteggi, punti campionato, compagni di piazzola, classifiche di arcieri e squadre</span>
            </span>
            <Glyph name="chevron" size={16} className="text-muted" />
          </button>
        )}
      </div>
      {me.role === "viewer" ? null : adding ? (
        <AddGara onDone={() => { setAdding(false); setNonce((n) => n + 1); }} onClose={() => setAdding(false)} />
      ) : (
        <Button variant="ghost" onClick={() => setAdding(true)}>Aggiungi una gara</Button>
      )}
    </div>
  );
}

/** la compagnia in questa gara (classifica squadre del portale FITAST), uguale per tutti */
function TeamLine({ results }: { results: TeamResult[] }) {
  const rows = [...results].sort((a, b) => (a.place ?? 999) - (b.place ?? 999));
  return (
    <div className="mt-2 grid gap-1.5 rounded-2xl bg-white/[0.04] p-2.5">
      {rows.slice(0, 4).map((r) => (
        <div key={r.id} className="flex items-center gap-2.5">
          {r.place && r.place <= 3 ? <Medal place={r.place} size={26} /> : <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-white/[0.07] text-[0.7rem] font-semibold tabular-nums">{r.place ?? "—"}</span>}
          <p className="min-w-0 text-sm leading-snug">
            <b>Compagnia</b> {teamResultText(r)}
            <span className="block text-xs text-muted">{[r.team, r.category].filter(Boolean).join(" · ")}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

/** nel 3D FITAST: 3 frecce a piazzola, di solito 20 piazzole a gara */
const ARROWS_PER_LANE = 3;
const LANES_DEFAULT = 20;

/**
 * Piazzole e frecce di una gara per un arciere: quelle inserite (a mano o dal cartellino) se coprono la gara,
 * altrimenti le piazzole della gara (o 20) × 3 frecce. Lo stesso conto del profilo.
 */
function loadOf(entry: Entry, comp: Comp) {
  const garaLanes = entry.laneCount ?? comp.lanes ?? LANES_DEFAULT;
  const rows = entry.piazzole;
  const rowArrows = rows.reduce((sum, lane) => sum + (lane.arrows.length || ARROWS_PER_LANE), 0);
  const rowPts = rows.reduce((sum, lane) => sum + lane.score, 0);
  if (!rows.length) return { lanes: garaLanes, arrows: garaLanes * ARROWS_PER_LANE };
  const complete = entry.score == null || rowPts >= entry.score || rows.length >= garaLanes;
  const lanes = complete ? rows.length : Math.max(rows.length, garaLanes);
  return { lanes, arrows: rowArrows + (lanes - rows.length) * ARROWS_PER_LANE };
}

function totalsOf(comps: Comp[], userId: string) {
  const pairs = comps.flatMap((comp) => comp.entries.filter((entry) => entry.userId === userId && hasResult(entry)).map((entry) => ({ entry, comp })));
  const rows = pairs.map((p) => p.entry);
  const scored = rows.filter((entry) => entry.score != null);
  const points = scored.reduce((sum, entry) => sum + (entry.score ?? 0), 0);
  const loads = pairs.map(({ entry, comp }) => ({ entry, ...loadOf(entry, comp) }));
  const scoredArrows = loads.filter((l) => l.entry.score != null).reduce((sum, l) => sum + l.arrows, 0);
  return {
    gare: rows.length,
    points,
    avg: scored.length ? points / scored.length : null,
    lanes: loads.reduce((sum, l) => sum + l.lanes, 0),
    arrows: loads.reduce((sum, l) => sum + l.arrows, 0),
    perArrow: scoredArrows ? points / scoredArrows : null,
    spots: rows.reduce((sum, entry) => sum + (entry.spot ?? 0), 0),
    champ: rows.reduce((sum, entry) => sum + (entry.championshipPoints ?? 0), 0),
    ...distanceOf(rows),
  };
}

function distanceOf(rows: Entry[]) {
  const bag = new Map<number, { lanes: number; arrows: number }>();
  for (const entry of rows) {
    for (const lane of entry.piazzole) {
      if (lane.distanceM == null || lane.distanceM <= 0) continue;
      const cur = bag.get(lane.distanceM) ?? { lanes: 0, arrows: 0 };
      cur.lanes += 1;
      cur.arrows += lane.arrows.length;
      bag.set(lane.distanceM, cur);
    }
  }
  const distances = [...bag.entries()].sort((a, b) => a[0] - b[0]).map(([distance, row]) => ({ distance, ...row }));
  const lanes = distances.reduce((sum, row) => sum + row.lanes, 0);
  const weighted = distances.reduce((sum, row) => sum + row.distance * row.lanes, 0);
  return {
    distances,
    bestDistance: distances.length ? distances[distances.length - 1].distance : null,
    avgDistance: lanes ? weighted / lanes : null,
  };
}

function Roster({ tab, people, also = false }: { tab: "past" | "next"; people: Comp["roster"]; /** sopra ci sono già i risultati: qui solo gli altri */ also?: boolean }) {
  const going = people.filter((person) => person.attended);
  const out = people.filter((person) => !person.attended);
  if (!people.length) return null;
  if (also && tab === "past") {
    return going.length ? <FaceRow label="C'erano anche" people={going} /> : null;
  }
  return (
    <div className="grid gap-2">
      <FaceRow label={tab === "next" ? "Ci vanno" : "C'erano"} people={going} />
      <FaceRow label={tab === "next" ? "Non ci vanno" : "Non c'erano"} people={out} />
    </div>
  );
}

const noCrest = (): Crest | null => null;

/** con chi si era in piazzola: il loro risultato e, se c'è il cartellino, le piazzole una per una */
function PiazzolaMates({ group, past }: { group: { piazzola: number; mates: Mate[] }; past: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="grid gap-1.5">
      <p className="flex items-baseline justify-between gap-2 text-sm font-semibold">
        <span>{past ? "In piazzola con te" : "Tirerai con"}</span>
        {group.piazzola ? <span className="text-[0.7rem] font-normal text-muted">piazzola {group.piazzola}</span> : null}
      </p>
      <ul className="grid gap-1.5">
        {group.mates.map((m) => {
          const cat = categoryText(m.category);
          const lanes = m.lanes ?? [];
          return (
            <li key={m.name} className="grid gap-2 rounded-2xl bg-white/[0.035] px-2.5 py-2">
              <button type="button" disabled={!lanes.length} onClick={() => setOpen(open === m.name ? null : m.name)} className="flex min-w-0 items-center gap-2.5 text-left">
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{m.name}</b>
                  <span className="block truncate text-xs text-muted">{[m.team, m.place ? `${m.place}° ${cat}`.trim() : cat].filter(Boolean).join(" · ")}</span>
                </span>
                {m.place && m.place <= 3 ? <Medal place={m.place} size={24} /> : null}
                {m.total != null ? (
                  <span className="shrink-0 text-right">
                    <b className="block font-display text-xl leading-none tabular-nums">{m.total}</b>
                    <span className="text-[0.56rem] uppercase tracking-wider text-muted">{m.camp != null ? `${m.camp} pt camp.` : m.spots != null ? `${m.spots} spot` : "punti"}</span>
                  </span>
                ) : null}
                {lanes.length ? <Glyph name="chevron" size={14} className={`shrink-0 text-muted ${open === m.name ? "-rotate-90" : "rotate-90"}`} /> : null}
              </button>
              {open === m.name && lanes.length ? (
                <div className="grid grid-cols-10 gap-1">
                  {lanes.map((l) => {
                    const v = l.arrows.reduce((a, b) => a + b, 0);
                    return (
                      <span key={l.p} className="grid place-items-center rounded-md py-1 text-[0.62rem] leading-tight tabular-nums" style={{ background: v >= 18 ? "#a8323a" : v >= 13 ? "#2a6294" : v > 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)" }}>
                        <span className="text-white/60">{l.p}</span>
                        <b className="text-[0.78rem]">{v}</b>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** giorno della gara per esteso: «domenica 15 novembre» */
function longDay(day: string) {
  const d = new Date(`${day}T12:00:00`);
  return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Testata della gara. Per le gare del campionato FITAST il nome è la compagnia che la organizza, con sotto
 * la tappa del campionato: sul portale si chiamano tutte uguali («Gara di Campionato Invernale 3D»).
 */
/** la gara chiusa in una riga: il proprio risultato, quanti dei nostri, chi era in piazzola */
function closedLine(comp: Comp, mine: Entry | null, ours: number) {
  const parts = [
    mine && mine.score != null ? `Tu: ${mine.score} punti${mine.rank ? ` · ${mine.rank}°` : ""}${mine.championshipPoints != null ? ` · ${mine.championshipPoints} pt camp.` : ""}` : "",
    ours ? `${ours} dei nostri` : "",
    comp.group?.mates.length ? `${comp.group.mates.length} in piazzola con te` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Tocca per aprire";
}

function GaraHead({ comp, crestOf, tab }: { comp: Comp; crestOf: (t: string) => Crest | null; tab: "past" | "next" }) {
  const f = comp.fitast ?? null;
  const host = comp.organizer.trim();
  if (!f) {
    return (
      <div>
        <p className="text-xs text-muted">{longDay(comp.startsOn)}{comp.place ? ` · ${comp.place}` : ""}</p>
        <h2 className="break-words font-display text-2xl leading-tight">{comp.name}</h2>
        {host ? <p className="mt-1 break-words text-sm text-muted">{host}</p> : null}
        {comp.attended === false ? <p className="mt-1 text-sm text-muted">{tab === "past" ? "Non hai partecipato." : "Non ci vai."}</p> : null}
      </div>
    );
  }
  const step = [f.step > 0 ? `${f.step}ª tappa` : "", f.champ].filter(Boolean).join(" · ");
  return (
    <div className="flex min-w-0 items-start gap-3">
      {host ? <CrestMark crest={crestOf(host)} team={host} size={52} /> : null}
      <div className="min-w-0 flex-1">
        <h2 className="break-words font-display text-[1.65rem] leading-tight">{host || comp.name}</h2>
        {step ? <p className="text-sm text-[#f1cf8a]">{step}</p> : null}
        <p className="text-xs text-muted">{[longDay(comp.startsOn), comp.place].filter(Boolean).join(" · ")}</p>
        {comp.attended === false ? <p className="mt-1 text-sm text-muted">{tab === "past" ? "Non hai partecipato." : "Non ci vai."}</p> : null}
      </div>
    </div>
  );
}

function FaceRow({ label, people }: { label: string; people: Comp["roster"] }) {
  const looks = useTeamAvatars();
  return (
    <div className="flex items-center gap-2">
      <p className="w-24 shrink-0 text-xs text-muted">{label}</p>
      {people.length ? (
        <div className="flex flex-wrap gap-1">
          {people.map((person) => (
            <Avatar key={person.userId} size="sm" label={memberLabel(person, people)} color={person.avatarColor} photo={person.photoUrl} look={looks[person.userId]} userId={person.userId} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">nessuno</p>
      )}
    </div>
  );
}

function MiniStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-line px-2 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{k}</p>
      <p className="font-display text-2xl tabular-nums leading-none">{v}</p>
    </div>
  );
}

function pointsOf(comps: Comp[], userId: string): GaraPoint[] {
  return comps
    .flatMap((comp) => comp.entries.filter((entry) => entry.userId === userId && hasResult(entry)).map((entry) => ({
      id: `${comp.id}:${entry.userId}`,
      day: comp.startsOn,
      name: comp.name,
      laneCount: entry.laneCount ?? (entry.piazzole.length || null),
      score: entry.score,
      spot: entry.spot,
      championshipPoints: entry.championshipPoints,
    })))
    .sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
}

/** la categoria da leggere: «Messeri · Tradizionale» dal portale, «Messeri» da quella segnata a mano */
function categoryText(category: string) {
  const { group, tipologia } = categoryGroup(category);
  return [group, tipologia].filter(Boolean).join(" · ") || divisionOf(category) || "";
}

function ScoreRow({ entry, peers, own = false }: { entry: Entry; peers: Entry[]; own?: boolean }) {
  const looks = useTeamAvatars();
  const cat = categoryText(entry.category);
  const lanes = entry.laneCount ?? (entry.piazzole.length || null);
  const detail = [
    entry.score != null ? `${entry.score} punti` : null,
    lanes != null ? `${lanes} piazzole` : null,
    entry.spot != null ? `${entry.spot} spot` : null,
    entry.targetKind === "sagoma" ? "sagoma" : entry.targetKind === "padiglione" ? "padiglione" : null,
  ].filter(Boolean).join(" · ");
  const camp = entry.championshipPoints;
  return (
    <div className={`flex min-w-0 items-center gap-2.5 rounded-2xl px-2.5 py-2 ${own ? "border border-[#e0b15a]/45 bg-[#e0b15a]/[0.08]" : "bg-white/[0.035]"}`}>
      <Avatar size="sm" label={memberLabel(entry, peers)} color={entry.avatarColor} photo={entry.photoUrl} look={looks[entry.userId]} userId={entry.userId} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <b className="truncate">{memberLabel(entry, peers)}</b>
          {own ? <span className="shrink-0 rounded-full bg-[#e0b15a] px-1.5 py-px text-[0.58rem] font-bold uppercase tracking-wide text-black">tu</span> : null}
        </p>
        {entry.rank || cat ? <p className="truncate text-xs">{[entry.rank ? `${entry.rank}°` : "", cat].filter(Boolean).join(" ")}{entry.rank && entry.categorySize ? <span className="text-muted"> su {entry.categorySize}</span> : null}</p> : null}
        {detail ? <p className="truncate text-[0.72rem] text-muted">{detail}</p> : null}
      </div>
      {entry.rank && entry.rank <= 3 ? <Medal place={entry.rank} size={26} /> : null}
      <div className="shrink-0 text-right">
        <p className="font-display text-2xl leading-none tabular-nums">{camp ?? entry.score ?? "—"}</p>
        <p className="text-[0.56rem] uppercase tracking-wider text-muted">{camp != null ? "pt camp." : "punti"}</p>
      </div>
    </div>
  );
}

function AddGara({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [place, setPlace] = useState("");
  const [err, setErr] = useState("");
  return (
    <Card className="grid gap-3">
      <Field label="Nome"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Data"><TextInput type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></Field>
      <Field label="Luogo"><TextInput value={place} onChange={(e) => setPlace(e.target.value)} /></Field>
      {err ? <ErrorNote text={err} /> : null}
      <Button onClick={() => {
        saveCompetition({ data: { name, startsOn, place, organizer: "", kind: "", distanceM: null, category: "", signupDeadline: "", externalUrl: "", notes: "" } })
          .then(onDone)
          .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"));
      }}>Salva gara</Button>
      <Button variant="ghost" onClick={onClose}>Chiudi</Button>
    </Card>
  );
}
