import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { calendarMonth, deleteSession } from "@/lib/arcieri/training.api";
import { listEvents, saveEvent } from "@/lib/arcieri/club.api";
import { listGestures, type GestureRow } from "@/lib/arcieri/gesture.api";
import { RealIcon } from "@/components/real-icons";
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
  // analisi del gesto salvate: fotogramma della postura nel giorno in cui è stata fatta
  const gestures = useLoad(`gesti-${nonce}`, () => listGestures());
  const dayOf = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  const byDay = new Map<string, GestureRow[]>();
  for (const g of gestures.data ?? []) {
    const k = dayOf(g.createdAt);
    byDay.set(k, [...(byDay.get(k) ?? []), g]);
  }
  const daysGestures = byDay.get(day) ?? [];
  const [open, setOpen] = useState<GestureRow | null>(null);

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
          const pose = byDay.get(cell.key)?.[0];
          return (
            <button key={cell.key} type="button" onClick={() => setDay(cell.key)} className={`relative min-h-14 overflow-hidden rounded-lg border text-sm ${day === cell.key ? "border-accent" : "border-transparent"} ${cell.inMonth ? "" : "opacity-40"}`}>
              {pose?.thumb ? <img src={pose.thumb} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" /> : null}
              <span className="relative">{cell.d}</span>
              <span className="relative mt-1 flex justify-center gap-0.5">
                {pose ? <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> : null}
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
      {daysGestures.length ? (
        <Card className="grid gap-2">
          <p className="flex items-center gap-2 font-semibold"><RealIcon name="archer" size={26} />Postura e tiro del {day}</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {daysGestures.map((g) => (
              <button key={g.id} type="button" onClick={() => setOpen(g)} className="aa-thumb relative w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 text-left">
                {g.thumb ? <img src={g.thumb} alt="" className="aspect-[3/4] w-full object-cover" /> : <span className="grid aspect-[3/4] place-items-center bg-white/5"><RealIcon name="archer" size={40} /></span>}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-4 text-[0.65rem] font-semibold text-white">
                  {g.score != null ? `${Math.round(g.score)}/100 · ` : ""}{new Date(g.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}
                </span>
              </button>
            ))}
          </div>
        </Card>
      ) : null}
      {open ? <GestureSheet g={open} onClose={() => setOpen(null)} /> : null}
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

/** Fotogramma salvato a tutto schermo, con il riassunto dell'analisi pro se c'è. */
function GestureSheet({ g, onClose }: { g: GestureRow; onClose: () => void }) {
  type ProSummary = { total?: number; areas?: Record<string, number | null>; issues?: string[] };
  let pro: ProSummary | null = null;
  try {
    pro = (JSON.parse(g.data || "{}") as { pro?: ProSummary }).pro ?? null;
  } catch {
    pro = null;
  }
  const LABEL: Record<string, string> = { testa: "Testa", spalle: "Spalle", braccioArco: "Braccio arco", polsoArco: "Polso arco", gomito: "Gomito corda", polsoCorda: "Polso corda", ancoraggio: "Ancoraggio", busto: "Busto", gambe: "Gambe", attrezzatura: "Allungo" };
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center" onClick={onClose}>
      <div className="aa-sheet max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-elev p-4 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="font-display text-xl">{g.title || "Analisi del gesto"}</p>
          <button type="button" onClick={onClose} className="min-h-10 rounded-full bg-white/10 px-3 text-sm">Chiudi</button>
        </div>
        {g.thumb ? <img src={g.thumb} alt="Fotogramma salvato" className="w-full rounded-2xl" /> : null}
        <p className="mt-2 text-xs text-muted">{new Date(g.createdAt).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Rome" })}{g.score != null ? ` · ${Math.round(g.score)}/100` : ""}</p>
        {pro?.areas ? (
          <div className="mt-3 grid gap-1.5">
            {Object.entries(pro.areas).filter((e): e is [string, number] => e[1] != null).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2 text-xs">
                <span className="text-muted">{LABEL[k] ?? k}</span>
                <span className="h-2 overflow-hidden rounded-full bg-white/[0.07]"><span className="aa-grow block h-full rounded-full" style={{ width: `${v}%`, background: v >= 80 ? "#2fbf71" : v >= 60 ? "#e3a21a" : "#e5484d" }} /></span>
                <b className="text-right tabular-nums">{v}</b>
              </div>
            ))}
          </div>
        ) : null}
        {pro?.issues?.length ? (
          <div className="mt-3 grid gap-1">
            <p className="text-sm font-semibold">Da migliorare</p>
            {pro.issues.map((t, i) => <p key={t} className="text-sm"><b className="text-amber-300">{i + 1}.</b> {t}</p>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
