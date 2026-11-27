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

/** una scadenza su una riga: a sinistra cosa e quando, a destra i giorni che mancano in grande */
function Row({ icon, color, label, female, until, days, sub }: { icon: IconName; color: string; label: string; female: boolean; until: string; days: number | null; sub: string }) {
  const st = stateOf(days, female);
  const n = days == null ? null : Math.abs(days);
  const tone = days == null ? "text-muted" : days < 0 ? "text-rose-300" : days <= 15 ? "text-[#f3a46a]" : "";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-hair bg-white/[0.04] px-3 py-2.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: `${color}33`, color }}><Glyph name={icon} size={19} /></span>
      <span className="grid min-w-0 flex-1 gap-1">
        <b className="truncate text-sm">{label}</b>
        <span className="truncate text-[0.72rem] text-muted">
          {until ? `${days != null && days < 0 ? (female ? "scaduta" : "scaduto") : "scade"} il ${itDate(until)}` : "data da inserire"}
          {sub ? ` · ${sub}` : ""}
        </span>
        <span className={cx("flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[0.64rem] font-bold", st.tone)}>
          <Glyph name={st.icon} size={11} />
          {st.text}
        </span>
      </span>
      <span className="grid shrink-0 justify-items-end">
        <b className={cx("font-display text-4xl leading-none tabular-nums", tone)}>{n == null ? "—" : n}</b>
        <span className="text-[0.62rem] leading-tight text-muted">{n == null ? "" : days! < 0 ? `${n === 1 ? "giorno" : "giorni"} fa` : n === 1 ? "giorno" : "giorni"}</span>
      </span>
    </div>
  );
}

/**
 * Le proprie scadenze nel profilo: certificato medico, tessera FITAST e tessera della compagnia. Le vede solo
 * l'arciere (e la segreteria della sua compagnia, che può segnarle); si possono scrivere anche da qui.
 * Quindici giorni prima arriva un avviso in Bacheca.
 */
export function MyDeadlines() {
  const [nonce, setNonce] = useState(0);
  const { data, error } = useLoad(`scadenze-${nonce}`, () => myDeadlines());
  const [edit, setEdit] = useState(false);
  const [card, setCard] = useState("");
  const [fitast, setFitast] = useState("");
  const [cert, setCert] = useState("");
  const [kind, setKind] = useState("agonistico");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  function open() {
    setCard(data?.card.written ? data.card.until : "");
    setFitast(data?.fitast?.until ?? "");
    setCert(data?.cert.until ?? "");
    setKind(data?.cert.kind ?? "agonistico");
    setNote("");
    setEdit(true);
  }
  async function save() {
    setBusy(true);
    setNote("");
    try {
      await setMyDeadlines({ data: { cardUntil: card, fitastUntil: fitast, certUntil: cert, certKind: kind } });
      setEdit(false);
      setNonce((n) => n + 1);
    } catch (e) {
      setNote(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="grid gap-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <IconTitle icon="calendar" color="#e0b15a" sub="Le vedi solo tu e la segreteria. 15 giorni prima ti avvisiamo in Bacheca.">Tesseramento e certificato</IconTitle>
        </div>
        {data && !edit ? (
          <button type="button" onClick={open} className="aa-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06]" aria-label="Scrivi le date">
            <Glyph name="edit" size={17} />
          </button>
        ) : null}
      </div>
      {error && !data ? <ErrorNote text={error} /> : null}
      {!data && !error ? <div className="grid gap-2" aria-hidden>{[0, 1, 2].map((k) => <div key={k} className="aa-skel h-[4.5rem] rounded-2xl" />)}</div> : null}
      {data && !edit ? (
        <div className="grid gap-2">
          <Row icon="shield" color="#d1576a" label="Certificato medico" female={false} until={data.cert.until} days={data.cert.days} sub={data.cert.until ? data.cert.kind : ""} />
          <Row icon="trophy" color="#c9962f" label="Tessera FITAST" female until={data.fitast?.until ?? ""} days={data.fitast?.days ?? null} sub="" />
          <Row icon="ticket" color="#5a9be0" label="Tessera della compagnia" female until={data.card.until} days={data.card.days} sub={data.card.season && !data.card.written ? `stagione ${data.card.season}` : ""} />
        </div>
      ) : null}
      {data && edit ? (
        <div className="grid gap-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Certificato medico: scade il">
              <TextInput type="date" value={cert} onChange={(e) => setCert(e.target.value)} />
            </Field>
            <Field label="Tipo">
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="agonistico">agonistico</option>
                <option value="non agonistico">non agonistico</option>
              </Select>
            </Field>
          </div>
          <Field label="Tessera FITAST: scade il">
            <TextInput type="date" value={fitast} onChange={(e) => setFitast(e.target.value)} />
          </Field>
          <Field label="Tessera della compagnia: scade il">
            <TextInput type="date" value={card} onChange={(e) => setCard(e.target.value)} />
          </Field>
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
