import { useState } from "react";
import { BowOptions } from "@/components/bow-options";
import { compareSessions, listSessions, rankings } from "@/lib/arcieri/training.api";
import { DISCIPLINES, memberLabel } from "@/lib/arcieri/labels";
import { fmtAvg, fmtPct } from "@/lib/arcieri/scoring";
import { fmtWhen } from "@/lib/arcieri/time";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, Empty, ErrorNote, Select } from "@/components/kit";

/**
 * Confronta, dentro Sfide: prima tutti gli arcieri (con i filtri per restringere), poi due tuoi allenamenti
 * messi a fianco per vedere se sei migliorato a parità di condizioni.
 */
export function ComparePanel() {
  const sessions = useLoad("mine-sessions", () => listSessions());
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [res, setRes] = useState<Awaited<ReturnType<typeof compareSessions>> | null>(null);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [bow, setBow] = useState("");
  const [distance, setDistance] = useState("");
  const [face, setFace] = useState("");
  const [discipline, setDiscipline] = useState("");
  const ranks = useLoad(`archers-${bow}-${distance}-${face}-${discipline}`, () =>
    rankings({ data: { period: "all", metric: "points", bow, distanceM: distance, face, discipline } }),
  );
  const list = sessions.data?.sessions ?? [];
  const people = ranks.data?.rows ?? [];
  const shown = people.filter((person) => memberLabel(person, people).toLowerCase().includes(name.trim().toLowerCase()));
  return (
    <div className="grid gap-3">
      <div className="mt-2">
        <h2 className="font-display text-3xl leading-none">Confronta</h2>
        <p className="mt-1 text-sm text-muted">Prima vedi tutti. Il filtro serve dopo, se vuoi restringere.</p>
      </div>
      <Card className="grid gap-2">
        <h2 className="font-display text-2xl">Arcieri</h2>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Filtra un nome" className="min-h-12 rounded-xl border border-line bg-bg px-3" />
        <div className="grid grid-cols-2 gap-2">
          <Select value={bow} onChange={(event) => setBow(event.target.value)}><option value="">Tutti gli archi</option><BowOptions /></Select>
          <input value={distance} onChange={(event) => setDistance(event.target.value)} placeholder="Distanza m" className="min-h-12 rounded-xl border border-line bg-bg px-3" />
          <Select value={face} onChange={(event) => setFace(event.target.value)}>
            <option value="">Tutti i bersagli</option>
            <option value="wa10">WA 10</option>
            <option value="field6">Field</option>
            <option value="threed">3D</option>
            <option value="sagoma8">Sagoma</option>
          </Select>
          <Select value={discipline} onChange={(event) => setDiscipline(event.target.value)}><option value="">Tutte le discipline</option>{DISCIPLINES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
        </div>
        {ranks.error ? <ErrorNote text={ranks.error} /> : null}
        {shown.map((person) => (
          <div key={person.userId} className="rounded-xl border border-line px-3 py-2 text-sm">
            <p className="font-semibold">{person.position}. {memberLabel(person, people)}</p>
            <p className="text-muted">
              {person.points} punti · {person.arrows} frecce · media {person.avg == null ? "—" : fmtAvg(person.avg)} · precisione {person.precisePct == null ? "—" : fmtPct(person.precisePct)} · {person.sessions} uscite
            </p>
          </div>
        ))}
        {!ranks.loading && !shown.length ? <Empty title="Nessun arciere" text="Nessuno corrisponde a questo filtro." /> : null}
      </Card>
      <Card className="grid gap-2">
        <h2 className="font-display text-2xl">Due tuoi allenamenti</h2>
        {list.length < 2 ? <Empty title="Ti servono due sessioni" text="Prima registra, poi confronta." /> : null}
        <Select value={a} onChange={(event) => setA(Number(event.target.value))}><option value={0}>Prima sessione</option>{list.map((session) => <option key={session.id} value={session.id}>{fmtWhen(session.startedAt)} · {session.distanceM} m</option>)}</Select>
        <Select value={b} onChange={(event) => setB(Number(event.target.value))}><option value={0}>Seconda sessione</option>{list.map((session) => <option key={session.id} value={session.id}>{fmtWhen(session.startedAt)} · {session.distanceM} m</option>)}</Select>
        <Button onClick={() => compareSessions({ data: { a, b } }).then(setRes).catch((error: unknown) => setErr(error instanceof Error ? error.message : "Errore"))}>Confronta i due tiri</Button>
        {err ? <ErrorNote text={err} /> : null}
        {res ? (
          <div>
            <p className="text-sm">{res.fair ? "Condizioni uguali: il confronto regge." : "Attenzione: distanza, arco, bersaglio o disciplina non coincidono."}</p>
            <p className="font-display text-3xl tabular-nums">{fmtAvg(res.left.tally.avg)} → {fmtAvg(res.right.tally.avg)} {res.delta != null ? `(${res.delta >= 0 ? "+" : ""}${fmtPct(res.delta)})` : ""}</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}