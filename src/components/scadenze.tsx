import { useState } from "react";
import { Button, Card, ErrorNote, Field, Select, TextInput, cx } from "@/components/kit";
import { Glyph, IconTitle, type IconName } from "@/components/icons";
import { useLoad, messageOf } from "@/lib/arcieri/use-load";
import { myDeadlines, setMyDeadlines } from "@/lib/arcieri/scadenze.api";

const itDate = (d: string) => (d ? d.split("-").reverse().join("/") : "");

/** stato di una scadenza, a parole e con un'icona (non solo con il colore) */
function stateOf(days: number | null, female: boolean): { text: string; tone: string; icon: IconName } {
  if (days == null) return { text: "da inserire", tone: "bg-white/[0.07] text-muted", icon: "edit" };
  if (days < 0) return { text: female ? "scaduta" : "scaduto", tone: "bg-rose-500/20 text-rose-300", icon: "close" };
  if (days <= 15) return { text: days === 0 ? "scade oggi" : "rinnova ora", tone: "bg-[#e07a2f]/25 text-[#f3a46a]", icon: "timer" };
  if (days <= 30) return { text: "scade presto", tone: "bg-[#e0b15a]/20 text-[#f0cf7a]", icon: "timer" };
  return { text: female ? "valida" : "valido", tone: "bg-[#3f8a76]/25 text-[#7cf0a8]", icon: "check" };
}

/** una scadenza: i giorni che mancano in grande, sotto la data e lo stato */
function Tile({ icon, color, label, female, until, days, sub, state }: { icon: IconName; color: string; label: string; female: boolean; until: string; days: number | null; sub: string; state: ReturnType<typeof stateOf> }) {
  const n = days == null ? null : Math.abs(days);
  const tone = days == null ? "" : days < 0 ? "text-rose-300" : days <= 15 ? "text-[#f3a46a]" : "";
  return (
    <div className="grid content-start gap-1.5 rounded-2xl border border-hair bg-white/[0.04] p-3">
      <span className="flex items-center gap-2 text-[0.72rem] font-semibold text-muted">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: `${color}33`, color }}><Glyph name={icon} size={15} /></span>
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <b className={cx("font-display text-4xl leading-none tabular-nums", tone)}>{n == null ? "—" : n}</b>
        <span className="text-[0.7rem] leading-tight text-muted">{n == null ? "data da inserire" : days! < 0 ? `${n === 1 ? "giorno" : "giorni"} fa` : `${n === 1 ? "giorno" : "giorni"} alla scadenza`}</span>
      </span>
      <span className="text-[0.72rem]">{until ? `${days != null && days < 0 ? (female ? "scaduta" : "scaduto") : "scade"} il ${itDate(until)}` : "—"}</span>
      <span className={cx("flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[0.66rem] font-bold", state.tone)}>
        <Glyph name={state.icon} size={11} />
        {state.text}
      </span>
      {sub ? <span className="text-[0.66rem] text-muted">{sub}</span> : null}
    </div>
  );
}

/**
 * Le proprie scadenze sul profilo: tessera della stagione e certificato medico. Le vede solo l'arciere
 * (e la segreteria della sua compagnia, che può segnarle); si possono scrivere anche da qui.
 */
export function MyDeadlines() {
  const [nonce, setNonce] = useState(0);
  const { data, error } = useLoad(`scadenze-${nonce}`, () => myDeadlines());
  const [edit, setEdit] = useState(false);
  const [card, setCard] = useState("");
  const [cert, setCert] = useState("");
  const [kind, setKind] = useState("agonistico");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  function open() {
    setCard(data?.card.written ? data.card.until : "");
    setCert(data?.cert.until ?? "");
    setKind(data?.cert.kind ?? "agonistico");
    setNote("");
    setEdit(true);
  }
  async function save() {
    setBusy(true);
    setNote("");
    try {
      await setMyDeadlines({ data: { cardUntil: card, certUntil: cert, certKind: kind } });
      setEdit(false);
      setNonce((n) => n + 1);
    } catch (e) {
      setNote(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  const cardState = stateOf(data?.card.days ?? null, true);
  const certState = stateOf(data?.cert.days ?? null, false);
  return (
    <Card className="grid gap-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <IconTitle icon="calendar" color="#e0b15a" sub="Le vedi solo tu e la segreteria. 15 giorni prima ti avvisiamo in Bacheca.">Le tue scadenze</IconTitle>
        </div>
        {data && !edit ? (
          <button type="button" onClick={open} className="aa-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06]" aria-label="Scrivi le date">
            <Glyph name="edit" size={17} />
          </button>
        ) : null}
      </div>
      {error && !data ? <ErrorNote text={error} /> : null}
      {!data && !error ? <div className="grid h-28 grid-cols-2 gap-2" aria-hidden><div className="aa-skel rounded-2xl" /><div className="aa-skel rounded-2xl" /></div> : null}
      {data && !edit ? (
        <div className="grid grid-cols-2 gap-2">
          <Tile icon="ticket" color="#5a9be0" label="Tessera" female until={data.card.until} days={data.card.days} sub={data.card.season ? `stagione ${data.card.season}${data.card.written ? "" : ", fino a fine anno"}` : "chiedi alla segreteria o scrivila tu"} state={cardState} />
          <Tile icon="shield" color="#d1576a" label="Certificato medico" female={false} until={data.cert.until} days={data.cert.days} sub={data.cert.until ? data.cert.kind : "senza certificato valido non si tira in campo"} state={certState} />
        </div>
      ) : null}
      {data && edit ? (
        <div className="grid gap-2">
          <Field label="La tessera scade il">
            <TextInput type="date" value={card} onChange={(e) => setCard(e.target.value)} />
          </Field>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Il certificato medico scade il">
              <TextInput type="date" value={cert} onChange={(e) => setCert(e.target.value)} />
            </Field>
            <Field label="Tipo">
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="agonistico">agonistico</option>
                <option value="non agonistico">non agonistico</option>
              </Select>
            </Field>
          </div>
          {note ? <ErrorNote text={note} /> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setEdit(false)} disabled={busy}>Annulla</Button>
            <Button onClick={() => void save()} disabled={busy}>{busy ? "Salvo…" : "Salva le date"}</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
