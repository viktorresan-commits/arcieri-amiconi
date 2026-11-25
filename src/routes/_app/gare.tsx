import { useEntryState } from "@/lib/arcieri/back-restore";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { deleteCompetition, deleteEntry, listCompetitions, saveCompetition, setPresence } from "@/lib/arcieri/club.api";
import { memberLabel, divisionOf } from "@/lib/arcieri/labels";
import { romeDayKey } from "@/lib/arcieri/time";
import { useLoad } from "@/lib/arcieri/use-load";
import { useMember } from "@/components/shell";
import { MainGearCard } from "@/components/main-gear";
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

export const Route = createFileRoute("/_app/gare")({ component: Page });


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
};
type Comp = {
  id: number;
  name: string;
  startsOn: string;
  place: string;
  organizer: string;
  signupDeadline: string | null;
  notes?: string;
  canDelete?: boolean;
  attended: boolean | null;
  roster: { userId: string; attended: boolean; givenName: string; familyName: string; nickname: string; slug: string; photoUrl: string | null; avatarColor: string }[];
  entries: Entry[];
  teamResults?: TeamResult[];
};

function hasResult(entry: Entry) {
  return entry.score != null || entry.spot != null || entry.championshipPoints != null || entry.laneCount != null || entry.piazzole.length > 0;
}


function Page() {
  const { me } = useMember();
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
  const { data, error, loading } = useLoad(`gare-${nonce}`, () => listCompetitions());
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
      <PageHead title="Gare" lede="Segni solo quelle a cui hai partecipato. Il punteggio degli altri si vede, ma si cambia solo il tuo." />
      <MainGearCard compact />
      {totals.gare > 0 ? (
        <Card className="relative">
          <span className="absolute right-3 top-3"><KindEmblem kind="campionato" size={54} glow /></span>
          <p className="text-xs uppercase tracking-wide text-muted">Tutte le gare</p>
          <p className="font-display text-4xl tabular-nums leading-none">{totals.points}</p>
          <p className="mt-1 text-sm text-muted">punti in {totals.gare} gare{totals.avg != null ? ` · media ${totals.avg.toFixed(1)}` : ""}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat k="Piazzole" v={String(totals.lanes)} />
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
        {shown.map((comp) => {
          const mine = comp.entries.find((entry) => entry.userId === me.userId) ?? null;
          const ownScore = mine ? hasResult(mine) : false;
          const ask = scope === "mine" && comp.attended !== false;
          return (
            <div key={comp.id} id={`gara-${comp.id}`} className="scroll-mt-4">
            <Card className="grid min-w-0 gap-3">
              <div>
                <p className="text-xs text-muted">{comp.startsOn}{comp.place ? ` · ${comp.place}` : ""}</p>
                <h2 className="break-words font-display text-2xl leading-tight">{comp.name}</h2>
                {comp.organizer ? <p className="mt-1 break-words text-sm text-muted">{comp.organizer}</p> : null}
                {comp.attended === false ? <p className="mt-1 text-sm text-muted">{tab === "past" ? "Non hai partecipato." : "Non ci vai."}</p> : null}
                {/^fitast:\d+/.test(comp.notes ?? "") ? (
                  <button type="button" className="aa-chip mt-2" onClick={() => { setPortal({ code: (comp.notes ?? "").replace(/^fitast:(\d+).*/, "$1") }); window.setTimeout(() => document.getElementById("fitast")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }}>
                    {tab === "next" ? "Piazzole e iscritti su FITAST" : "Risultati su FITAST"}
                  </button>
                ) : null}
                {comp.teamResults?.length ? <TeamLine results={comp.teamResults} /> : null}
                <Roster tab={tab} people={comp.roster ?? []} />
              </div>
              <ul className="grid min-w-0 gap-2">
                {comp.entries.filter((entry) => hasResult(entry)).map((entry) => {
                  const own = entry.userId === me.userId;
                  const key = `${comp.id}:${entry.userId}`;
                  const row = (
                    <button type="button" className="w-full min-w-0 text-left" onClick={() => setFocus(focus === key ? null : key)}>
                      <ScoreRow entry={entry} peers={comp.entries} />
                    </button>
                  );
                  return (
                    <li key={entry.id} className="grid min-w-0 gap-2">
                      {own ? (
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
              {ask ? (
                open === comp.id ? (
                  <LaneEditor compId={comp.id} mine={mine} onSaved={() => setNonce((n) => n + 1)} onDone={() => { setOpen(null); setFocus(`${comp.id}:${me.userId}`); reload(); }} />
                ) : (
                  <Button className="w-full" variant="ghost" onClick={() => setOpen(comp.id)}>{ownScore ? "Modifica il punteggio" : "Metti il punteggio"}</Button>
                )
              ) : scope === "rest" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button className="w-full text-sm" onClick={() => mark(comp.id, true)}>{tab === "past" ? "Ho partecipato" : "Ci vado"}</Button>
                  <Button className="w-full text-sm" variant="ghost" onClick={() => mark(comp.id, false)}>{tab === "past" ? "Non ho partecipato" : "Non ci vado"}</Button>
                </div>
              ) : null}
              {scope === "mine" || comp.canDelete ? (
                <div className="grid gap-1.5 border-t border-white/[0.06] pt-2">
                  {scope === "mine" ? (
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
          <FitastPanel key={portal.code} comps={comps} myName={myName} userId={me.userId ?? ""} startCode={portal.code} onSaved={() => setNonce((n) => n + 1)} onClose={() => setPortal(null)} />
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

function totalsOf(comps: Comp[], userId: string) {
  const rows = comps.flatMap((comp) => comp.entries.filter((entry) => entry.userId === userId && hasResult(entry)));
  const scored = rows.filter((entry) => entry.score != null);
  const points = scored.reduce((sum, entry) => sum + (entry.score ?? 0), 0);
  return {
    gare: rows.length,
    points,
    avg: scored.length ? points / scored.length : null,
    lanes: rows.reduce((sum, entry) => sum + (entry.laneCount ?? entry.piazzole.length), 0),
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

function Roster({ tab, people }: { tab: "past" | "next"; people: Comp["roster"] }) {
  const going = people.filter((person) => person.attended);
  const out = people.filter((person) => !person.attended);
  if (!people.length) return null;
  return (
    <div className="mt-3 grid gap-2">
      <FaceRow label={tab === "next" ? "Ci vanno" : "C'erano"} people={going} />
      <FaceRow label={tab === "next" ? "Non ci vanno" : "Non c'erano"} people={out} />
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
            <Avatar key={person.userId} size="sm" label={memberLabel(person, people)} color={person.avatarColor} photo={person.photoUrl} look={looks[person.userId]} />
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

function ScoreRow({ entry, peers }: { entry: Entry; peers: Entry[] }) {
  const division = divisionOf(entry.category);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
      <div className="min-w-0">
        <p className="truncate font-semibold">{memberLabel(entry, peers)}</p>
        <p className="text-sm text-muted">{[
          (entry.laneCount ?? (entry.piazzole.length || null)) != null ? `${entry.laneCount ?? entry.piazzole.length} piazzole` : null,
          entry.score != null ? `${entry.score} punti` : null,
          entry.spot != null ? `${entry.spot} spot` : null,
          entry.championshipPoints != null ? `${entry.championshipPoints} pt campionato` : null,
          entry.rank ? `${entry.rank}°${division ? ` ${division}` : ""}` : null,
          entry.targetKind === "sagoma" ? "sagoma" : entry.targetKind === "padiglione" ? "padiglione" : null,
        ].filter(Boolean).join(" · ")}</p>
      </div>
      <p className="font-display text-3xl tabular-nums">{entry.score}</p>
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
