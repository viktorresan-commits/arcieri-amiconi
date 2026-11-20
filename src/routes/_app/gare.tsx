import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { deleteEntry, listCompetitions, saveCompetition, saveEntry, setPresence } from "@/lib/arcieri/club.api";
import { memberLabel, DIVISIONS, divisionOf } from "@/lib/arcieri/labels";
import { romeDayKey } from "@/lib/arcieri/time";
import { PADIGLIONE_SCORES, faceById, scoreAtRadius } from "@/lib/arcieri/scoring";
import { ANIMALS, animalByLabel } from "@/lib/arcieri/sagome";
import { BoarTarget } from "@/components/boar-target";
import { SagomaLab } from "@/components/sagoma-lab";
import { TargetFace } from "@/components/target-face";
import { ShotLab } from "@/components/shot-lab";
import { useLoad } from "@/lib/arcieri/use-load";
import { useMember } from "@/components/shell";
import { MainGearCard } from "@/components/main-gear";
import { Avatar, Button, Card, Empty, ErrorNote, Field, HoldDelete, Loading, PageHead, TextArea, TextInput } from "@/components/kit";
import { GaraTrend, type GaraPoint } from "@/components/gara-trend";
import { GaraResult } from "@/components/gara-result";

export const Route = createFileRoute("/_app/gare")({ component: Page });

const FITAST = "http://89.46.73.21/FITAST_WEB/IT/pagView-GARE.awp";

type Lane = { n: number; score: number; arrows: number[]; label: string; distanceM: number | null; note: string; aimAngle: string };
type Slot = { score: number; arrows: number[]; label: string; distanceM: number | null; note: string; aimAngle: string };
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
  attended: boolean | null;
  roster: { userId: string; attended: boolean; givenName: string; familyName: string; nickname: string; slug: string; photoUrl: string | null; avatarColor: string }[];
  entries: Entry[];
};

function hasResult(entry: Entry) {
  return entry.score != null || entry.spot != null || entry.championshipPoints != null || entry.laneCount != null || entry.piazzole.length > 0;
}

function knownAnimal(label: string) {
  const face = animalByLabel(label);
  return label.trim() && face.label.toLowerCase() === label.trim().toLowerCase() ? face : null;
}

function Page() {
  const { me } = useMember();
  const today = romeDayKey(new Date().toISOString());
  const [nonce, setNonce] = useState(0);
  const [tab, setTab] = useState<"past" | "next">("past");
  const [scope, setScope] = useState<"mine" | "rest">("mine");
  const [open, setOpen] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
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
        <Card>
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
      <a className="text-sm font-semibold text-accent" href={FITAST} target="_blank" rel="noreferrer">Calendario FITAST, solo da leggere</a>
      {me.role === "viewer" ? null : adding ? (
        <AddGara onDone={() => { setAdding(false); setNonce((n) => n + 1); }} onClose={() => setAdding(false)} />
      ) : (
        <Button variant="ghost" onClick={() => setAdding(true)}>Aggiungi una gara</Button>
      )}
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
  return (
    <div className="flex items-center gap-2">
      <p className="w-24 shrink-0 text-xs text-muted">{label}</p>
      {people.length ? (
        <div className="flex flex-wrap gap-1">
          {people.map((person) => (
            <Avatar key={person.userId} size="sm" label={memberLabel(person, people)} color={person.avatarColor} photo={person.photoUrl} />
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

function LaneEditor({ compId, mine, onDone, onSaved }: { compId: number; mine: Entry | null; onDone: () => void; onSaved: () => void }) {
  const initial = useMemo(() => Array.from({ length: 20 }, (_, i) => {
    const found = mine?.piazzole.find((p) => p.n === i + 1);
    return found ? { score: found.score, arrows: found.arrows ?? [], label: found.label ?? "", distanceM: found.distanceM ?? null, note: found.note ?? "", aimAngle: found.aimAngle ?? "" } : null;
  }), [mine]);
  const [slots, setSlots] = useState<(Slot | null)[]>(initial);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const [active, setActive] = useState(0);
  const cursor = useRef(0);
  const [rank, setRank] = useState(mine?.rank ? String(mine.rank) : "");
  const [division, setDivision] = useState(divisionOf(mine?.category ?? ""));
  const [total, setTotal] = useState(mine && !mine.piazzole.length && mine.score != null ? String(mine.score) : "");
  const [laneCount, setLaneCount] = useState(mine?.laneCount != null ? String(mine.laneCount) : mine?.piazzole.length ? String(mine.piazzole.length) : "");
  const [spot, setSpot] = useState(mine?.spot != null ? String(mine.spot) : "");
  const [champ, setChamp] = useState(mine?.championshipPoints != null ? String(mine.championshipPoints) : "");
  const [lanesOn, setLanesOn] = useState((mine?.piazzole.length ?? 0) > 0);
  const [startAt, setStartAt] = useState(1);
  const [kind, setKind] = useState<"padiglione" | "sagoma">(mine?.targetKind === "sagoma" ? "sagoma" : mine?.targetKind === "padiglione" ? "padiglione" : "padiglione");
  const [laneName, setLaneName] = useState(initial[0]?.label ?? "");
  const [laneNote, setLaneNote] = useState(initial[0]?.note ?? "");
  const [laneMeters, setLaneMeters] = useState(initial[0]?.distanceM != null ? String(initial[0].distanceM) : "");
  const [laneSide, setLaneSide] = useState(initial[0]?.aimAngle ?? "");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [marks, setMarks] = useState<({ nx: number; ny: number } | null)[][]>(() => {
    try {
      const raw = sessionStorage.getItem(`aa-gara-dots-${compId}`);
      const saved = raw ? JSON.parse(raw) as ({ nx: number; ny: number } | null)[][] : null;
      if (Array.isArray(saved) && saved.length === 20) return saved;
    } catch {
      /* la memoria del telefono può essere piena */
    }
    return initial.map((slot) => (slot?.arrows ?? []).map(() => null));
  });
  useEffect(() => {
    sessionStorage.setItem(`aa-gara-dots-${compId}`, JSON.stringify(marks));
  }, [marks, compId]);
  const queue = useRef(Promise.resolve());
  const legal = kind === "padiglione" ? PADIGLIONE_SCORES : [8, 5, 0];
  const filled = slots.flatMap((slot, i) => (slot == null ? [] : [{ n: i + 1, score: slot.score, arrows: slot.arrows, label: slot.label, distanceM: slot.distanceM, note: slot.note, aimAngle: slot.aimAngle }]));
  const sum = filled.reduce((totalScore, lane) => totalScore + lane.score, 0);
  const frecce = filled.reduce((totalArrows, lane) => totalArrows + lane.arrows.length, 0);
  const spotsFromArrows = filled.reduce((totalSpots, lane) => totalSpots + lane.arrows.filter((shot) => shot >= 8).length, 0);
  const spotsFollowArrows = kind === "sagoma" && filled.some((lane) => lane.arrows.length > 0);
  const usingLanes = lanesOn && filled.length > 0;
  const activeSlot = slots[active];
  const previewScores = activeSlot?.arrows.length
    ? activeSlot.arrows
    : activeSlot && (activeSlot.score === 8 || activeSlot.score === 5 || activeSlot.score === 0)
      ? [activeSlot.score]
      : [];
  const previewShots = previewScores.slice(0, 8).map((score, index) => {
    const mark = marks[active]?.[index];
    return { score, nx: mark?.nx ?? null, ny: mark?.ny ?? null };
  });

  function pick(index: number) {
    cursor.current = index;
    setActive(index);
    const slot = slots[index];
    setLaneName(slot?.label ?? "");
    setLaneNote(slot?.note ?? "");
    setLaneMeters(slot?.distanceM != null ? String(slot.distanceM) : "");
    setLaneSide(slot?.aimAngle ?? "");
  }

  function metaNow() {
    const text = laneMeters.trim().replace(",", ".");
    const distance = text === "" ? null : Number(text);
    return { label: laneName.trim(), distanceM: distance != null && Number.isFinite(distance) ? distance : null, note: laneNote.trim(), aimAngle: laneSide };
  }

  function rowsOf(next: (Slot | null)[]) {
    return next.flatMap((slot, i) => (slot == null ? [] : [{ n: i + 1, score: slot.score, arrows: slot.arrows, label: slot.label, distanceM: slot.distanceM, note: slot.note, aimAngle: slot.aimAngle }]));
  }

  function persist(next: (Slot | null)[]) {
    const rows = rowsOf(next);
    if (!rows.length) return;
    const laneN = rows.length;
    const punti = rows.reduce((totalScore, lane) => totalScore + lane.score, 0);
    const counted = rows.reduce((totalSpots, lane) => totalSpots + lane.arrows.filter((shot) => shot >= 8).length, 0);
    const spotN = kind === "sagoma" && rows.some((lane) => lane.arrows.length > 0) ? counted : num(spot);
    const champN = num(champ);
    if ([spotN, champN].some((n) => Number.isNaN(n))) {
      setErr("Scrivi solo numeri.");
      return;
    }
    if (rank.trim() && !division) {
      setErr("Per il posto scegli Madonne, Messeri, Pueri o Juniores.");
      return;
    }
    setErr("");
    setSaved(false);
    queue.current = queue.current.then(() => saveEntry({
      data: {
        competitionId: compId,
        score: punti,
        rank: rank === "" ? null : Number(rank),
        category: division,
        notes: "",
        laneCount: laneN,
        spot: spotN,
        championshipPoints: champN,
        targetKind: kind,
        sagomaMax: kind === "sagoma" ? 8 : null,
        piazzole: rows,
      },
    })).then(() => {
      setSaved(true);
      onSaved();
    }).catch((e: unknown) => {
      setSaved(false);
      setErr(e instanceof Error ? e.message : "Errore");
    });
  }

  function writeSlot(index: number, slot: Slot | null) {
    setSlots((current) => current.map((value, i) => (i === index ? slot : value)));
  }

  function moveArrow(arrowIndex: number, score: number, nx: number, ny: number, done: boolean) {
    const index = cursor.current;
    const current = slotsRef.current[index];
    if (!current || arrowIndex < 0 || arrowIndex >= current.arrows.length) return;
    const arrows = current.arrows.map((value, i) => (i === arrowIndex ? score : value));
    const next = slotsRef.current.map((value, i) => (i === index ? { score: arrows.reduce((totalScore, shot) => totalScore + shot, 0), arrows, ...metaNow() } : value));
    slotsRef.current = next;
    setSlots(next);
    setMarks((rows) => rows.map((row, i) => {
      if (i !== index) return row;
      const copy = [...row];
      while (copy.length < arrows.length) copy.push(null);
      copy[arrowIndex] = { nx, ny };
      return copy;
    }));
    if (done) persist(next);
  }

  function placeArrow(score: number, nx: number | null, ny: number | null) {
    const index = cursor.current;
    const current = slotsRef.current[index];
    const arrows = [...(current?.arrows ?? []), score].slice(0, 8);
    const next = slotsRef.current.map((value, i) => (i === index ? { score: arrows.reduce((totalScore, shot) => totalScore + shot, 0), arrows, ...metaNow() } : value));
    slotsRef.current = next;
    setSlots(next);
    setMarks((rows) => rows.map((row, i) => (i === index ? [...row, nx == null || ny == null ? null : { nx, ny }].slice(0, 8) : row)));
    setErr("");
    persist(next);
  }

  function placeMany(hits: { score: number; nx: number; ny: number; miss: boolean }[]) {
    const index = cursor.current;
    const current = slotsRef.current[index];
    const arrows = [...(current?.arrows ?? [])];
    const extra: { nx: number; ny: number }[] = [];
    for (const hit of hits) {
      if (arrows.length >= 8) break;
      arrows.push(hit.miss ? 0 : hit.score);
      extra.push({ nx: hit.nx, ny: hit.ny });
    }
    const next = slotsRef.current.map((value, i) => (i === index ? { score: arrows.reduce((totalScore, shot) => totalScore + shot, 0), arrows, ...metaNow() } : value));
    slotsRef.current = next;
    setSlots(next);
    setMarks((rows) => rows.map((row, i) => (i === index ? [...row, ...extra].slice(0, 8) : row)));
    setErr("");
    persist(next);
  }

  function rememberPlace(distanceText: string, side: string) {
    setLaneMeters(distanceText);
    setLaneSide(side);
    const index = cursor.current;
    const current = slotsRef.current[index];
    if (!current?.arrows.length) return;
    const text = distanceText.trim().replace(",", ".");
    const distance = text === "" ? null : Number(text);
    const next = slotsRef.current.map((value, i) => (i === index && value ? { ...value, label: laneName.trim(), note: laneNote.trim(), aimAngle: side, distanceM: distance != null && Number.isFinite(distance) ? distance : null } : value));
    slotsRef.current = next;
    setSlots(next);
    persist(next);
  }

  function num(raw: string) {
    const text = raw.trim().replace(",", ".");
    if (!text) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : Number.NaN;
  }

  function wipeAll() {
    const empty = Array.from({ length: 20 }, () => null);
    slotsRef.current = empty;
    setSlots(empty);
    setMarks(empty.map(() => []));
    setLaneName("");
    setLaneNote("");
    setLaneMeters("");
    setLaneSide("");
    setSpot("");
    setTotal("");
    setSaved(false);
    const champN = num(champ);
    queue.current = queue.current.then(() => saveEntry({
      data: {
        competitionId: compId,
        score: 0,
        rank: rank.trim() && division ? Number(rank) : null,
        category: division,
        notes: "",
        laneCount: 0,
        spot: 0,
        championshipPoints: champN == null || Number.isNaN(champN) ? null : champN,
        targetKind: kind,
        sagomaMax: kind === "sagoma" ? 8 : null,
        piazzole: [],
      },
    })).then(() => {
      setErr("");
      setSaved(true);
      onSaved();
    }).catch((e: unknown) => {
      setSaved(false);
      setErr(e instanceof Error ? e.message : "Errore");
    });
  }

  function save() {
    setErr("");
    const laneN = usingLanes ? filled.length : num(laneCount);
    const punti = usingLanes ? sum : num(total);
    const spotN = spotsFollowArrows ? spotsFromArrows : num(spot);
    const champN = num(champ);
    if (rank.trim() && !division) {
      setErr("Per il posto scegli Madonne, Messeri, Pueri o Juniores.");
      return;
    }
    if (lanesOn && filled.some((lane) => lane.arrows.some((shot) => !legal.includes(shot)))) {
      setErr("C'è una freccia che non vale su questo bersaglio.");
      return;
    }
    if ([laneN, punti, spotN, champN].some((n) => Number.isNaN(n))) {
      setErr("Scrivi solo numeri.");
      return;
    }
    saveEntry({
      data: {
        competitionId: compId,
        score: punti,
        rank: rank === "" ? null : Number(rank),
        category: division,
        notes: "",
        laneCount: laneN,
        spot: spotN,
        championshipPoints: champN,
        targetKind: kind,
        sagomaMax: kind === "sagoma" ? 8 : null,
        piazzole: lanesOn ? filled : [],
      },
    })
      .then(onDone)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"));
  }

  return (
    <div className="grid min-w-0 gap-3 border-t border-line pt-3">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setKind("padiglione")} className={`min-h-12 rounded-xl text-sm font-semibold ${kind === "padiglione" ? "bg-primary text-primary-fg" : "border border-line"}`}>Padiglione</button>
        <button type="button" onClick={() => setKind("sagoma")} className={`min-h-12 rounded-xl text-sm font-semibold ${kind === "sagoma" ? "bg-primary text-primary-fg" : "border border-line"}`}>Sagoma 3D</button>
      </div>
      <p className="text-sm text-muted">{kind === "sagoma" ? "Sulla sagoma lo spot vale 8, anche il centro che prima era 11 o 10. Il corpo vale 5. Fuori è 0. Ogni freccia da 8 è uno spot: tre sulla stessa piazzola fanno tre spot." : "Padiglione: dal centro, giallo 10-9, rosso 8-7, blu 6-5, nero 4-3, bianco 2-1."}</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Numero piazzole">
          <TextInput inputMode="numeric" value={usingLanes ? String(filled.length) : laneCount} onChange={(e) => setLaneCount(e.target.value)} disabled={usingLanes} placeholder="20" />
        </Field>
        <Field label="Punti">
          <TextInput inputMode="numeric" value={usingLanes ? String(sum) : total} onChange={(e) => setTotal(e.target.value)} disabled={usingLanes} placeholder="186" />
        </Field>
        <Field label="Spot">
          <TextInput inputMode="numeric" value={spotsFollowArrows ? String(spotsFromArrows) : spot} onChange={(e) => setSpot(e.target.value)} disabled={spotsFollowArrows} placeholder="7" />
        </Field>
        <Field label="Punti campionato">
          <TextInput inputMode="numeric" value={champ} onChange={(e) => setChamp(e.target.value)} placeholder="12" />
        </Field>
      </div>
      <Field label="Posto">
        <TextInput inputMode="numeric" value={rank} onChange={(e) => setRank(e.target.value)} placeholder="3" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        {DIVISIONS.map((name) => (
          <button key={name} type="button" onClick={() => setDivision(name)} className={`min-h-12 rounded-xl px-3 text-sm font-semibold ${division === name ? "bg-primary text-primary-fg" : "border border-line"}`}>{name}</button>
        ))}
      </div>
      {err ? <ErrorNote text={err} /> : null}
      <Button className="w-full" onClick={save}>Salva punteggio</Button>
      <button type="button" className="text-left text-sm font-semibold text-accent" onClick={() => setLanesOn((v) => !v)}>
        {lanesOn ? "Nascondi le piazzole" : "Aggiungi le piazzole"}
      </button>
      {lanesOn ? (
        <>
          <p className="text-sm text-muted">Tocca il bersaglio: ogni tocco è una freccia.</p>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Parto dalla piazzola</span>
            <select
              value={startAt}
              onChange={(event) => {
                const next = Number(event.target.value);
                setStartAt(next);
                pick(next - 1);
              }}
              className="min-h-11 rounded-xl border border-line bg-transparent px-3"
            >
              {Array.from({ length: 20 }, (_, index) => (
                <option key={index + 1} value={index + 1}>{index + 1}</option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted">Il giro va dalla {startAt} alla {startAt === 1 ? 20 : startAt - 1}.</p>
          {usingLanes ? <p className="text-sm font-semibold">{frecce ? `${frecce} frecce · ` : ""}{sum} punti</p> : null}
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 20 }, (_, step) => (startAt - 1 + step) % 20).map((i) => {
              const slot = slots[i];
              return (
              <button key={i} type="button" onClick={() => pick(i)} className={`min-h-11 min-w-0 rounded-lg border px-0.5 font-display text-sm tabular-nums ${active === i ? "border-accent bg-accent text-accent-fg" : "border-line"}`}>
                <span className="block truncate text-[10px] font-sans leading-none">{slot?.label || i + 1}</span>
                <span className="block truncate">{slot == null ? "·" : slot.arrows.length ? `${slot.arrows.length}` : "·"}</span>
              </button>
              );
            })}
          </div>
          <Button variant="ghost" className="w-full" onClick={() => pick(((startAt - 1) + ((active - (startAt - 1) + 20) % 20 + 1)) % 20)}>Piazzola successiva</Button>
          {kind === "sagoma" ? (
            <div className="grid gap-1.5">
              <p className="text-sm font-medium text-muted">Animale piazzola {active + 1}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {ANIMALS.map((animal) => {
                  const on = laneName === animal.label;
                  return (
                    <button
                      key={animal.id}
                      type="button"
                      onClick={() => {
                        setLaneName(animal.label);
                        setSlots((current) => current.map((slot, i) => (i === active && slot ? { ...slot, label: animal.label } : slot)));
                      }}
                      className={`rounded-xl border px-1 py-1 ${on ? "border-accent bg-accent/15" : "border-line bg-transparent"}`}
                    >
                      <img src={animal.src} alt="" className="mx-auto h-12 w-full bg-transparent object-contain" />
                      <span className="block truncate text-[10px] font-semibold">{animal.label}</span>
                    </button>
                  );
                })}
              </div>
              {knownAnimal(laneName) ? (
                <div className="rounded-xl border border-line p-2">
                  <p className="mb-1 text-sm font-semibold">Piazzola {active + 1} · {knownAnimal(laneName)?.label}</p>
                  <BoarTarget
                    animal={knownAnimal(laneName)?.id}
                    shots={previewShots}
                    onScore={(score, _miss, nx, ny) => placeArrow(score, nx, ny)}
                    onMove={(index, score, _miss, nx, ny, done) => moveArrow(index, score, nx, ny, done)}
                  />
                  <Field label="Nota di questa piazzola">
                    <TextArea value={laneNote} placeholder="Cosa correggere, cosa è andato male" onChange={(e) => {
                      const note = e.target.value;
                      setLaneNote(note);
                      setSlots((current) => current.map((slot, i) => (i === active && slot ? { ...slot, note } : slot)));
                    }} />
                  </Field>
                </div>
              ) : null}
            </div>
          ) : (
            <Field label={`Nome piazzola ${active + 1}`}>
              <TextInput value={laneName} placeholder="Volée, sigla..." onChange={(e) => {
                const label = e.target.value;
                setLaneName(label);
                setSlots((current) => current.map((slot, i) => (i === active && slot ? { ...slot, label } : slot)));
              }} />
            </Field>
          )}
          {kind === "padiglione" ? (
            <TargetFace
              face={faceById("wa10")}
              shots={previewShots}
              onHit={(nx, ny) => {
                const hit = scoreAtRadius(faceById("wa10"), Math.hypot(nx, ny));
                placeArrow(hit.miss ? 0 : hit.score, nx, ny);
              }}
              onMove={(index, nx, ny, done) => {
                const hit = scoreAtRadius(faceById("wa10"), Math.hypot(nx, ny));
                moveArrow(index, hit.miss ? 0 : hit.score, nx, ny, done);
              }}
            />
          ) : null}
          {kind === "padiglione" ? (
            <ShotLab
              face={faceById("wa10")}
              shots={previewShots.map((shot, index) => ({
                score: shot.score,
                nx: shot.nx,
                ny: shot.ny,
                arrow: index,
                end: active,
                miss: shot.score === 0,
              }))}
              onPhoto={(hits) => placeMany(hits)}
            />
          ) : (
            <SagomaLab animal={knownAnimal(laneName)?.id ?? "sagome-3d"} shots={previewShots} initial="tre" />
          )}
          <Field label="Distanza stimata (m)">
            <TextInput inputMode="decimal" value={laneMeters} placeholder="15" onChange={(e) => rememberPlace(e.target.value, laneSide)} />
          </Field>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ["frontale", "Frontale"],
              ["destra", "A destra"],
              ["sinistra", "A sinistra"],
              ["alto", "Alto"],
              ["basso", "Basso"],
            ] as const).map(([side, label]) => (
              <button key={side} type="button" onClick={() => rememberPlace(laneMeters, side)} className={`min-h-11 rounded-xl text-sm font-semibold ${laneSide === side ? "bg-accent text-accent-fg" : "border border-line"}`}>{label}</button>
            ))}
          </div>
          {saved ? <p className="text-sm font-semibold text-accent">Salvato</p> : null}
          <Button variant="ghost" className="w-full" onClick={() => { writeSlot(cursor.current, null); slotsRef.current = slotsRef.current.map((value, i) => (i === cursor.current ? null : value)); setMarks((rows) => rows.map((row, i) => (i === cursor.current ? [] : row))); setLaneNote(""); setLaneSide(""); setLaneMeters(""); }}>Svuota la piazzola scelta</Button>
          <Button variant="ghost" className="w-full" onClick={wipeAll}>Svuota tutte le piazzole</Button>
        </>
      ) : null}
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
