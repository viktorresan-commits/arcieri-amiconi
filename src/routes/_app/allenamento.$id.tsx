import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { deleteSession, getSession, saveSession } from "@/lib/arcieri/training.api";
import { faceById, fmtAvg, summarize, aimAngleLabel, aimTargetLabel, sagomaMaxOf, keypad, ringPoint, scoreAtRadius, type AimAngle, type AimTarget, type Face } from "@/lib/arcieri/scoring";
import { fmtClock, fmtWhen } from "@/lib/arcieri/time";
import { BOWS, DISCIPLINES, DISTANCES, bowLabel, disciplineLabel } from "@/lib/arcieri/labels";
import { BODIES, PROGRAMS, programById } from "@/lib/arcieri/program";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, ErrorNote, Field, Loading, PageHead, Select, TextArea, TextInput } from "@/components/kit";
import { TargetFace } from "@/components/target-face";
import { ShotLab } from "@/components/shot-lab";
import { BoarTarget } from "@/components/boar-target";
import { AimPick } from "@/components/aim-pick";

export const Route = createFileRoute("/_app/allenamento/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const numeric = Number(id);
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`session-${id}-${nonce}`, () => getSession({ data: { id: numeric } }));
  const [gone, setGone] = useState("");
  const [editing, setEditing] = useState(false);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;
  const face = faceById(data.session.face);
  const tally = summarize(data.shots, face.max);
  const plan = programById(data.session.program);
  const prior = data.prior;
  return (
    <div className="grid gap-3">
      <PageHead title={fmtWhen(data.session.startedAt)} lede={`${plan ? plan.title + " · " : ""}${data.session.distanceM} m · ${bowLabel(data.session.bowType, data.session.bowCustom)} · ${disciplineLabel(data.session.discipline)}${data.session.aimTarget ? ` · ${aimTargetLabel(data.session.aimTarget)} · ${aimAngleLabel(data.session.aimAngle)}` : ""}`} />
      <div className="grid grid-cols-3 gap-2 text-center">
        <Card className="p-3"><p className="text-xs text-muted">Media</p><p className="font-display text-3xl tabular-nums">{fmtAvg(tally.avg)}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted">Punti</p><p className="font-display text-3xl tabular-nums">{tally.points}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted">Tempo</p><p className="font-display text-3xl tabular-nums">{fmtClock(data.session.durationMs)}</p></Card>
      </div>
      {editing ? (
        <Editor
          session={data.session}
          shots={data.shots}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setNonce((n) => n + 1);
          }}
        />
      ) : (
        <Volleys
          session={data.session}
          initial={data.shots}
          face={face}
          sagoma={data.session.face.startsWith("sagoma")}
          onSaved={() => setNonce((n) => n + 1)}
        />
      )}
      {plan && !editing ? (
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Rispetto alle sessioni precedenti</p>
          {prior && prior.arrows ? (
            <p className="mt-1 text-sm">
              Media {fmtAvg(tally.avg)} contro {fmtAvg(prior.avg)} del {prior.startedAt.slice(0, 10)}
              {tally.arrows === prior.arrows ? ", stesso numero di frecce." : ` (${tally.arrows} frecce contro ${prior.arrows}).`}
              {" "}Il volume non è stato alzato dal programma.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">Prima sessione di questo tipo. La prossima parte da qui, non da un carico più alto.</p>
          )}
          {data.session.body ? <p className="mt-2 text-sm text-muted">Stato: {data.session.body}.</p> : null}
        </Card>
      ) : null}
      {data.session.targetPhoto && !editing ? <img src={data.session.targetPhoto} alt="Rosata della sessione" className="w-full rounded-2xl border border-line object-cover" /> : null}
      <Link to="/allenamento" search={{ vista: "storico" }}><Button variant="ghost" className="w-full">Storico</Button></Link>
      {!editing ? <Button onClick={() => setEditing(true)}>Modifica dati</Button> : null}
      <Link to="/allenamento" search={{ id: numeric }}><Button variant="ghost" className="w-full">Correggi frecce</Button></Link>
      <Button
        variant="danger"
        onClick={() => {
          if (!confirm("Eliminare questo allenamento?")) return;
          deleteSession({ data: { id: numeric } })
            .then(() => setGone("Eliminato."))
            .catch((e: unknown) => setGone(e instanceof Error ? e.message : "Errore"));
        }}
      >
        Elimina
      </Button>
      {gone ? <p className="text-sm">{gone}</p> : null}
    </div>
  );
}

type Session = Awaited<ReturnType<typeof getSession>>["session"];
type Shot = Awaited<ReturnType<typeof getSession>>["shots"][number];

function Volleys({
  session,
  initial,
  face,
  sagoma,
  onSaved,
}: {
  session: Session;
  initial: Shot[];
  face: Face;
  sagoma: boolean;
  onSaved: () => void;
}) {
  const keys = keypad(face);
  const [shots, setShots] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const groups = new Map<string, Shot[]>();
  for (let block = 0; block < Math.max(1, session.blocksPlanned); block += 1) {
    for (let end = 0; end < Math.max(1, session.endsPlanned); end += 1) groups.set(`${block}-${end}`, []);
  }
  for (const shot of shots) {
    const key = `${shot.block}-${shot.end}`;
    groups.set(key, [...(groups.get(key) ?? []), shot]);
  }

  async function commit(next: Shot[]) {
    if (busy) return;
    const previous = shots;
    setShots(next);
    setBusy(true);
    setErr("");
    try {
      await saveSession({
        data: {
          clientKey: session.clientKey,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          place: session.place,
          distanceM: session.distanceM,
          discipline: session.discipline,
          bowType: session.bowType,
          bowCustom: session.bowCustom,
          face: session.face,
          setupId: session.setupId,
          arrowsPerEnd: session.arrowsPerEnd,
          endsPlanned: session.endsPlanned,
          blocksPlanned: session.blocksPlanned,
          weather: session.weather,
          feeling: session.feeling,
          rating: session.rating,
          notes: session.notes,
          durationMs: session.durationMs,
          timerLimitMs: session.timerLimitMs,
          endLimitMs: session.endLimitMs,
          gearSnapshot: session.gearSnapshot,
          stringNote: session.stringNote,
          program: session.program,
          body: session.body,
          dispersion: session.dispersion,
          errors: session.errors,
          targetPhoto: session.targetPhoto,
          aimTarget: session.aimTarget || "padiglione",
          aimAngle: session.aimAngle || "frontale",
          shots: next,
        },
      });
      onSaved();
      setBusy(false);
    } catch (e) {
      setShots(previous);
      setErr(e instanceof Error ? e.message : "Volée non salvata.");
      setBusy(false);
    }
  }

  function paint(index: number, score: number, isX: boolean, miss: boolean, nx: number, ny: number, done: boolean) {
    const next = shots.map((item, i) => (i === index ? { ...item, score: miss ? 0 : score, isX: miss ? false : isX, miss, nx, ny } : item));
    setShots(next);
    if (done) void commit(next);
  }

  function relocate(index: number, nx: number, ny: number, done: boolean) {
    const hit = scoreAtRadius(face, Math.hypot(nx, ny));
    paint(index, hit.score, hit.isX, hit.miss, nx, ny, done);
  }

  function setArrow(shot: Shot, score: number, isX: boolean, miss: boolean) {
    const spot = ringPoint(face, score, isX, miss, shot.block * 100 + shot.end * 10 + shot.arrow);
    const index = shots.findIndex((item) => item.block === shot.block && item.end === shot.end && item.arrow === shot.arrow);
    if (index < 0) return;
    paint(index, score, isX, miss, spot.nx, spot.ny, true);
  }

  function addArrow(block: number, end: number) {
    const used = new Set(shots.filter((shot) => shot.block === block && shot.end === end).map((shot) => shot.arrow));
    let arrow = 0;
    while (used.has(arrow)) arrow += 1;
    if (arrow >= 24) return;
    void commit([...shots, { block, end, arrow, score: 0, isX: false, miss: true, nx: null, ny: null }]);
  }

  function dropArrow(shot: Shot) {
    void commit(shots.filter((item) => !(item.block === shot.block && item.end === shot.end && item.arrow === shot.arrow)));
  }

  return (
    <>
      <p className="text-sm text-muted">Tieni un punto e spostalo. Il punteggio segue la zona.</p>
      {sagoma ? (
        <BoarTarget
          max={sagomaMaxOf(session.face)}
          shots={shots}
          onMove={(index, score, miss, nx, ny, done) => paint(index, score, false, miss, nx, ny, done)}
        />
      ) : (
        <TargetFace face={face} shots={shots} onMove={relocate} color="#e07a2f" numbers />
      )}
      <ShotLab
        face={face}
        shots={shots}
        onPhoto={sagoma ? undefined : (hits) => {
          const end = shots.reduce((max, shot) => Math.max(max, shot.end), -1) + 1;
          const added = hits.map((hit, index) => ({
            block: 0,
            end,
            arrow: index,
            score: hit.miss ? 0 : hit.score,
            isX: hit.isX,
            miss: hit.miss,
            nx: hit.nx,
            ny: hit.ny,
          }));
          void commit([...shots, ...added]);
        }}
      />
      <Card>
        <div data-hold-actions="">
          <p className="mb-2 text-sm text-muted">Tocca una volée per correggere le frecce. Il punteggio e le statistiche si aggiornano subito.</p>
          <ul className="grid gap-2 text-sm">
            {[...groups.entries()].map(([key, rows]) => {
              const [block, end] = key.split("-").map(Number);
              const on = open === key;
              const total = rows.reduce((sum, shot) => sum + shot.score, 0);
              return (
                <li key={key} className="grid gap-2">
                  <button type="button" onClick={() => setOpen(on ? null : key)} className="flex min-h-11 items-center justify-between gap-2 text-left">
                    <span>Volée {end + 1}{session.blocksPlanned > 1 ? ` · bersaglio ${block + 1}` : ""}</span>
                    <span className="tabular-nums">{rows.length ? `${rows.map((shot) => (shot.miss ? "M" : shot.isX ? "X" : shot.score)).join(" ")} = ${total}` : "vuota"}</span>
                  </button>
                  {on ? (
                    <div className="grid gap-2 pb-1">
                      {rows.sort((a, b) => a.arrow - b.arrow).map((shot) => (
                        <div key={shot.arrow} className="flex flex-wrap gap-1">
                          {keys.map((item) => {
                            const chosen = shot.miss ? item.miss : item.isX ? shot.isX : !shot.isX && !shot.miss && shot.score === item.score;
                            return (
                              <button key={item.label} type="button" disabled={busy} onClick={() => setArrow(shot, item.score, item.isX, item.miss)} className={`h-10 min-w-10 rounded-lg border text-sm font-semibold ${chosen ? "border-accent bg-accent text-accent-fg" : "border-line"}`}>{item.label}</button>
                            );
                          })}
                          <button type="button" disabled={busy} onClick={() => dropArrow(shot)} className="h-10 rounded-lg border border-line px-2 text-sm">Togli</button>
                        </div>
                      ))}
                      <button type="button" disabled={busy} onClick={() => addArrow(block, end)} className="h-10 rounded-lg border border-dashed border-line text-sm">Aggiungi freccia</button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {err ? <ErrorNote text={err} /> : null}
          {session.notes ? <p className="mt-3 text-sm text-muted">{session.notes}</p> : null}
          {session.feeling ? <p className="mt-2 text-sm">Sensazioni: {session.feeling}</p> : null}
          {session.dispersion ? <p className="mt-2 text-sm">Dispersione: {session.dispersion}</p> : null}
          {session.errors ? <p className="mt-2 text-sm">Errori: {session.errors}</p> : null}
          {session.gearSnapshot ? <p className="mt-2 text-xs text-muted">{session.gearSnapshot}</p> : null}
        </div>
      </Card>
    </>
  );
}

function clockParts(iso: string | null) {
  if (!iso) return { day: "", time: "" };
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function stamp(day: string, time: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const clock = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !clock) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(clock[1]), Number(clock[2]), 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function countOf(raw: string, fallback: number, max: number) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(max, n);
}

function Editor({
  session,
  shots,
  onClose,
  onSaved,
}: {
  session: Session;
  shots: Shot[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const start = clockParts(session.startedAt);
  const end = clockParts(session.endedAt);
  const [day, setDay] = useState(start.day);
  const [from, setFrom] = useState(start.time);
  const [to, setTo] = useState(end.time);
  const [place, setPlace] = useState(session.place);
  const [distance, setDistance] = useState(String(session.distanceM));
  const [bow, setBow] = useState(session.bowType);
  const [bowCustom, setBowCustom] = useState(session.bowCustom);
  const [discipline, setDiscipline] = useState(session.discipline);
  const [aimTarget, setAimTarget] = useState<AimTarget>(session.aimTarget === "sagoma" || session.aimTarget === "piattello" || session.aimTarget === "altro" ? session.aimTarget : "padiglione");
  const [aimAngle, setAimAngle] = useState<AimAngle>(session.aimAngle === "alto" || session.aimAngle === "basso" || session.aimAngle === "destra" || session.aimAngle === "sinistra" || session.aimAngle === "lato" ? session.aimAngle : "frontale");
  const [face, setFace] = useState(session.face || "wa10");
  const [arrowsPerEnd, setArrowsPerEnd] = useState(String(session.arrowsPerEnd));
  const [endsPlanned, setEndsPlanned] = useState(String(session.endsPlanned));
  const [blocksPlanned, setBlocksPlanned] = useState(String(session.blocksPlanned));
  const [weather, setWeather] = useState(session.weather);
  const [feeling, setFeeling] = useState(session.feeling);
  const [rating, setRating] = useState(session.rating == null ? "" : String(session.rating));
  const [notes, setNotes] = useState(session.notes);
  const [program, setProgram] = useState(session.program);
  const [body, setBody] = useState(session.body);
  const [dispersion, setDispersion] = useState(session.dispersion);
  const [errors, setErrors] = useState(session.errors);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setErr("");
    const started = stamp(day, from);
    const ended = to ? stamp(day, to) : null;
    const meters = Number(distance.replace(",", "."));
    if (!started) {
      setErr("Data e ora di inizio non valgono.");
      return;
    }
    if (to && !ended) {
      setErr("Ora di fine non valida.");
      return;
    }
    if (ended && ended.getTime() <= started.getTime()) {
      setErr("La fine deve essere dopo l'inizio.");
      return;
    }
    if (!Number.isFinite(meters) || meters < 5 || meters > 200) {
      setErr("La distanza va da 5 a 200 metri.");
      return;
    }
    const durationMs = ended ? ended.getTime() - started.getTime() : session.durationMs;
    if (durationMs > 86_400_000) {
      setErr("Un allenamento può durare al massimo 24 ore.");
      return;
    }
    setBusy(true);
    try {
      await saveSession({
        data: {
          clientKey: session.clientKey,
          startedAt: started.toISOString(),
          endedAt: ended ? ended.toISOString() : session.endedAt,
          place,
          distanceM: meters,
          discipline,
          bowType: bow,
          bowCustom,
          face,
          setupId: session.setupId,
          arrowsPerEnd: countOf(arrowsPerEnd, session.arrowsPerEnd, 24),
          endsPlanned: countOf(endsPlanned, session.endsPlanned, 60),
          blocksPlanned: countOf(blocksPlanned, session.blocksPlanned, 40),
          weather,
          feeling,
          rating: rating === "" ? null : Number(rating),
          notes,
          durationMs,
          timerLimitMs: session.timerLimitMs,
          endLimitMs: session.endLimitMs,
          gearSnapshot: session.gearSnapshot,
          stringNote: session.stringNote,
          program,
          body,
          dispersion,
          errors,
          targetPhoto: session.targetPhoto,
          aimTarget,
          aimAngle,
          shots,
        },
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Salvataggio non riuscito.");
      setBusy(false);
    }
  }

  return (
    <Card className="grid gap-3">
      <p className="text-sm text-muted">Questi dati sono quelli letti da classifiche, statistiche, calendario e squadra.</p>
      <Field label="Data"><TextInput type="date" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Dalle"><TextInput type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Alle"><TextInput type="time" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <Field label="Luogo"><TextInput value={place} onChange={(e) => setPlace(e.target.value)} /></Field>
      <Field label="Distanza (m)">
        <div className="flex flex-wrap gap-2">
          {DISTANCES.map((d) => (
            <button key={d} type="button" className={`min-h-11 rounded-full border px-3 ${Number(distance) === d ? "border-accent bg-accent text-accent-fg" : "border-line"}`} onClick={() => setDistance(String(d))}>{d}</button>
          ))}
        </div>
        <TextInput className="mt-2" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} />
      </Field>
      <Field label="Arco">
        <Select value={bow} onChange={(e) => setBow(e.target.value)}>{BOWS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
      </Field>
      {bow === "altro" ? <Field label="Che arco"><TextInput value={bowCustom} onChange={(e) => setBowCustom(e.target.value)} /></Field> : null}
      <Field label="Disciplina">
        <Select value={discipline} onChange={(e) => setDiscipline(e.target.value)}>{DISCIPLINES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
      </Field>
      <AimPick target={aimTarget} angle={aimAngle} face={face} onChange={(next) => { setAimTarget(next.aimTarget); setAimAngle(next.aimAngle); setFace(next.face); }} />
      {aimTarget === "altro" ? (
        <Field label="Che bersaglio">
          <Select value={face} onChange={(e) => setFace(e.target.value)}>
            <option value="field6">Field 6 zone</option>
            <option value="eq-5">5 zone uguali</option>
            <option value="eq-10">10 zone senza X</option>
            <option value="wa10">10 zone</option>
          </Select>
        </Field>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <Field label="Frecce per volée"><TextInput inputMode="numeric" value={arrowsPerEnd} onChange={(e) => setArrowsPerEnd(e.target.value)} /></Field>
        <Field label="Volée"><TextInput inputMode="numeric" value={endsPlanned} onChange={(e) => setEndsPlanned(e.target.value)} /></Field>
        <Field label="Bersagli"><TextInput inputMode="numeric" value={blocksPlanned} onChange={(e) => setBlocksPlanned(e.target.value)} /></Field>
      </div>
      <p className="text-sm text-muted">Totale previsto: {countOf(arrowsPerEnd, session.arrowsPerEnd, 24) * countOf(endsPlanned, session.endsPlanned, 60) * countOf(blocksPlanned, session.blocksPlanned, 40)} frecce. Quelle già segnate restano; se aumenti i numeri, aggiungile da Correggi frecce.</p>
      <Field label="Obiettivo">
        <Select value={program} onChange={(e) => setProgram(e.target.value)}>
          <option value="">Nessuno</option>
          {PROGRAMS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </Select>
      </Field>
      <Field label="Stato">
        <Select value={body} onChange={(e) => setBody(e.target.value)}>
          <option value="">Non indicato</option>
          {BODIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </Select>
      </Field>
      <Field label="Meteo">
        <div className="flex flex-wrap gap-2">
          {["Indoor", "Sereno", "Nuvoloso", "Vento", "Pioggia"].map((item) => (
            <button key={item} type="button" className={`min-h-11 rounded-full border px-3 ${weather === item ? "border-accent bg-accent text-accent-fg" : "border-line"}`} onClick={() => setWeather(item)}>{item}</button>
          ))}
        </div>
      </Field>
      <Field label="Valutazione">
        <Select value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="">Nessuna</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
      </Field>
      <Field label="Sensazioni"><TextArea value={feeling} onChange={(e) => setFeeling(e.target.value)} /></Field>
      <Field label="Note"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <Field label="Dispersione"><TextInput value={dispersion} onChange={(e) => setDispersion(e.target.value)} /></Field>
      <Field label="Errori"><TextInput value={errors} onChange={(e) => setErrors(e.target.value)} /></Field>
      {err ? <ErrorNote text={err} /> : null}
      <Button disabled={busy} onClick={() => void save()}>Salva e aggiorna le statistiche</Button>
      <Button variant="ghost" onClick={onClose}>Annulla</Button>
    </Card>
  );
}
