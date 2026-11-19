import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { calendarMonth, deleteSession } from "@/lib/arcieri/training.api";
import { listEvents, saveEvent } from "@/lib/arcieri/club.api";
import { monthGrid, romeYmd } from "@/lib/arcieri/time";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, ErrorNote, Field, HoldDelete, Loading, PageHead, TextInput } from "@/components/kit";

export const Route = createFileRoute("/_app/calendario")({ component: Page });

const DOT: Record<string, string> = {
  training: "bg-primary",
  comp: "bg-accent",
  challenge: "border border-accent",
  event: "bg-muted",
  badge: "bg-fg",
};

function Page() {
  const today = romeYmd();
  const [cursor, setCursor] = useState({ y: today.y, m: today.m });
  const [day, setDay] = useState(`${today.y}-${String(today.m).padStart(2, "0")}-${String(today.d).padStart(2, "0")}`);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [nonce, setNonce] = useState(0);
  const grid = monthGrid(cursor.y, cursor.m);
  const from = grid[0].key;
  const to = grid[grid.length - 1].key;
  const { data, error, loading } = useLoad(`${cursor.y}-${cursor.m}-${nonce}`, () => calendarMonth({ data: cursor }));
  const events = useLoad(`${from}-${to}`, () => listEvents({ data: { from, to } }));
  const items = data?.items ?? [];
  const selected = items.filter((i) => i.day === day);

  function shift(n: number) {
    const date = new Date(Date.UTC(cursor.y, cursor.m - 1 + n, 1));
    setCursor({ y: date.getUTCFullYear(), m: date.getUTCMonth() + 1 });
  }

  return (
    <div className="grid gap-3">
      <PageHead title="Calendario" lede="I tuoi allenamenti, le tue gare e gli appuntamenti comuni. Quello degli altri non compare." />
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => shift(-1)}>Prima</Button>
        <p className="font-display text-3xl capitalize">{new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(cursor.y, cursor.m - 1, 1)))}</p>
        <Button variant="ghost" onClick={() => shift(1)}>Dopo</Button>
      </div>
      {loading ? <Loading /> : null}
      {error ? <ErrorNote text={error} /> : null}
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => <span key={`${d}${i}`}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const dots = items.filter((i) => i.day === cell.key);
          return (
            <button key={cell.key} type="button" onClick={() => setDay(cell.key)} className={`min-h-14 rounded-lg border text-sm ${day === cell.key ? "border-accent" : "border-transparent"} ${cell.inMonth ? "" : "opacity-40"}`}>
              {cell.d}
              <span className="mt-1 flex justify-center gap-0.5">
                {dots.slice(0, 3).map((d, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${DOT[d.kind] ?? "bg-muted"}`} />)}
              </span>
            </button>
          );
        })}
      </div>
      <Card>
        <p className="font-display text-3xl">{day}</p>
        {selected.length === 0 ? <p className="mt-1 text-sm text-muted">Niente in questa data.</p> : null}
        <ul className="mt-3 grid gap-2">
          {selected.map((item, i) => {
            const trainingId = item.kind === "training" ? Number(item.href.split("/").pop()) : 0;
            const row = (
              <Link to={item.href} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-line px-3 py-3">
                <span className="min-w-0 break-words font-semibold">{item.title}</span>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[item.kind] ?? "bg-muted"}`} />
              </Link>
            );
            if (!trainingId) return <li key={`${item.kind}-${item.title}-${i}`}>{row}</li>;
            return (
              <li key={`${item.kind}-${item.title}-${i}`}>
                <HoldDelete
                  label="Eliminare questo allenamento?"
                  onDelete={() => deleteSession({ data: { id: trainingId } }).then(() => setNonce((n) => n + 1))}
                >
                  {row}
                </HoldDelete>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card className="grid gap-2">
        <Field label="Nota o evento">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Raduno, manutenzione..." />
        </Field>
        {err ? <ErrorNote text={err} /> : null}
        <Button
          onClick={() => {
            saveEvent({ data: { title, startsOn: day, notes: "", group: false } })
              .then(() => { setTitle(""); setErr("Salvato. Riapri il mese se non lo vedi subito."); })
              .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"));
          }}
        >
          Segna il {day}
        </Button>
        {events.data?.length ? <p className="text-xs text-muted">{events.data.length} note nel periodo visibile.</p> : null}
      </Card>
    </div>
  );
}
