import { useState } from "react";
import { Avatar, Button, Card, Empty, ErrorNote, Field, Loading, SectionHead, Select, TextArea, TextInput, cx } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLoad } from "@/lib/arcieri/use-load";
import { SITE_URL, openExternal, whatsappLink } from "@/lib/arcieri/native";
import { DAYS, REQUEST_KINDS, askClass, classInvite, deleteClass, deleteRequest, joinClassAsCoach, listClasses, saveClass, setClassMember } from "@/lib/arcieri/classi.api";

type Data = Awaited<ReturnType<typeof listClasses>>;
type Klass = Data["classes"][number];

const dayName = (id: string) => DAYS.find((d) => d.id === id)?.label ?? id;
export function when(c: { days: string[]; time: string; place?: string }) {
  const d = c.days.map((x) => dayName(x).toLowerCase());
  const days = d.length > 1 ? `${d.slice(0, -1).join(", ")} e ${d[d.length - 1]}` : d[0] ?? "";
  return [days ? days[0].toUpperCase() + days.slice(1) : "", c.time ? `ore ${c.time}` : "", c.place].filter(Boolean).join(" · ");
}

/** «lunedì e mercoledì alle 18:00, palestra comunale»: per i messaggi */
function meet(c: { days: string[]; time: string; place?: string }) {
  const d = c.days.map((x) => dayName(x).toLowerCase());
  const days = d.length > 1 ? `${d.slice(0, -1).join(", ")} e ${d[d.length - 1]}` : d[0] ?? "";
  return [days, c.time ? `alle ${c.time}` : ""].filter(Boolean).join(" ") + (c.place ? `, ${c.place.toLowerCase()}` : "");
}

/** testo pronto e gruppo WhatsApp: copia il messaggio e apre il gruppo, dove basta incollarlo */
async function toGroup(url: string, text: string) {
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    /* niente appunti: il testo resta da scrivere */
  }
  void openExternal(url);
}

/** Classi dell'allenatore: orari, allievi, gruppo WhatsApp, inviti e richieste alla classe. */
export function ClassesTab({ companyId }: { companyId: number }) {
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`classes-${companyId}-${nonce}`, () => listClasses({ data: { companyId } }));
  const [editing, setEditing] = useState<Klass | "nuova" | null>(null);
  const reload = () => setNonce((n) => n + 1);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote text={error || "Errore"} />;
  if (editing) return <ClassEditor klass={editing === "nuova" ? null : editing} onDone={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />;
  const mine = data.classes.filter((c) => c.mine);
  const others = data.classes.filter((c) => !c.mine);
  return (
    <div className="grid gap-3">
      <Button onClick={() => setEditing("nuova")}><Glyph name="calendar" size={16} /> Nuova classe</Button>
      {!data.classes.length ? <Empty title="Nessuna classe" text="Crea una classe (per esempio «Corso A, lunedì e mercoledì alle 18»), collega il gruppo WhatsApp e aggiungi gli allievi." /> : null}
      {mine.length ? <SectionHead title="Le tue classi" /> : null}
      {mine.map((c) => <ClassCard key={c.id} c={c} people={data.people} onEdit={() => setEditing(c)} onChange={reload} />)}
      {others.length ? <SectionHead title="Classi degli altri allenatori" sub="Puoi vederle e aggiungerti come allenatore." /> : null}
      {others.map((c) => <ClassCard key={c.id} c={c} people={data.people} onEdit={() => setEditing(c)} onChange={reload} />)}
    </div>
  );
}

function ClassEditor({ klass, onDone, onCancel }: { klass: Klass | null; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(klass?.name ?? "");
  const [days, setDays] = useState<string[]>(klass?.days ?? []);
  const [time, setTime] = useState(klass?.time ?? "18:00");
  const [place, setPlace] = useState(klass?.place ?? "");
  const [wa, setWa] = useState(klass?.whatsappUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Card className="grid gap-3">
      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted">{klass ? "Modifica la classe" : "Nuova classe"}</p>
      <Field label="Nome"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Corso A" maxLength={60} /></Field>
      <div className="grid gap-1.5">
        <span className="text-xs text-muted">Giorni</span>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <button key={d.id} type="button" aria-pressed={days.includes(d.id)} onClick={() => setDays((x) => (x.includes(d.id) ? x.filter((y) => y !== d.id) : DAYS.map((z) => z.id).filter((z) => z === d.id || x.includes(z))))} className="aa-chip">{d.label.slice(0, 3)}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ora"><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <Field label="Luogo (facoltativo)"><TextInput value={place} onChange={(e) => setPlace(e.target.value)} placeholder="es. palestra" maxLength={80} /></Field>
      </div>
      <Field label="Link del gruppo WhatsApp (facoltativo)"><TextInput value={wa} onChange={(e) => setWa(e.target.value)} placeholder="https://chat.whatsapp.com/…" inputMode="url" /></Field>
      <p className="-mt-1.5 text-xs text-muted">In WhatsApp apri il gruppo già esistente › Info gruppo › Invita tramite link › Copia link, e incollalo qui.</p>
      {err ? <ErrorNote text={err} /> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Annulla</Button>
        <Button disabled={busy} onClick={() => { setBusy(true); setErr(""); saveClass({ data: { id: klass?.id ?? null, name, days, time, place, whatsappUrl: wa } }).then(onDone).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non salvata.")).finally(() => setBusy(false)); }}>{klass ? "Salva" : "Crea la classe"}</Button>
      </div>
      {klass ? <DeleteClass id={klass.id} onDone={onDone} /> : null}
    </Card>
  );
}

function DeleteClass({ id, onDone }: { id: number; onDone: () => void }) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <button type="button" className="min-h-10 rounded-xl bg-danger text-sm font-bold text-danger-fg" onClick={() => void deleteClass({ data: { id } }).then(onDone)}>Conferma: elimina la classe</button>
  ) : (
    <button type="button" className="text-xs text-rose-300 underline-offset-2 hover:underline" onClick={() => setArmed(true)}>Elimina la classe</button>
  );
}

function ClassCard({ c, people, onEdit, onChange }: { c: Klass; people: Data["people"]; onEdit: () => void; onChange: () => void }) {
  const [open, setOpen] = useState(c.mine);
  const [panel, setPanel] = useState<"" | "allievi" | "chiedi" | "scrivi">("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const run = (p: Promise<unknown>, ok?: string) => {
    setErr("");
    p.then(() => { if (ok) setNote(ok); onChange(); }).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non riuscito."));
  };
  const invite = () =>
    classInvite({ data: { id: c.id } })
      .then(({ code }) => openExternal(whatsappLink(`Ciao! Ti aspetto nella classe «${c.name}»${meet(c) ? ` (${meet(c)})` : ""} su Arcieri Amiconi: ${SITE_URL}/?invito=${code}\nSe hai già l'app, in Gestione compagnia usa il codice ${code}.`)))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Invito non creato."));
  return (
    <Card className="grid gap-2.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-start gap-3 text-left">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#2f6fd1]/25 font-display text-lg">{c.name.replace(/^corso\s+/i, "").slice(0, 2).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl leading-tight">{c.name}</span>
          <span className="block text-xs text-muted">{when(c) || "Senza orario"}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1 text-[0.68rem]">
            <span className="rounded-full bg-white/[0.07] px-1.5 py-px">{c.members.length} {c.members.length === 1 ? "allievo" : "allievi"}</span>
            <span className="rounded-full bg-[#8cc3f0]/15 px-1.5 py-px text-[#8cc3f0]">{c.coaches.map((x) => x.name.split(" ")[0]).join(", ") || "nessun allenatore"}</span>
            {c.whatsappUrl ? <span className="rounded-full bg-[#25d366]/15 px-1.5 py-px text-[#5fe39a]">gruppo WhatsApp</span> : null}
          </span>
        </span>
        <Glyph name="chevron" size={14} className={cx("mt-1 text-muted transition-transform", open ? "rotate-90" : "")} />
      </button>
      {open ? (
        <div className="grid gap-2.5">
          {!c.mine ? (
            <button type="button" onClick={() => run(joinClassAsCoach({ data: { id: c.id, join: true } }), `Ora alleni anche «${c.name}».`)} className="aa-press min-h-11 rounded-2xl bg-[#8cc3f0] text-sm font-bold text-[#0b1a26]">Aggiungiti come allenatore</button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {c.whatsappUrl ? (
              <button type="button" onClick={() => setPanel(panel === "scrivi" ? "" : "scrivi")} className="aa-press flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-[#25d366] text-sm font-bold text-[#06210f]"><Glyph name="share" size={16} /> Scrivi al gruppo</button>
            ) : (
              <button type="button" onClick={onEdit} className="aa-press min-h-11 rounded-2xl bg-white/[0.08] text-sm font-semibold">Collega il gruppo</button>
            )}
            <button type="button" onClick={() => void invite()} className="aa-press min-h-11 rounded-2xl bg-white/[0.08] text-sm font-semibold">Invita su WhatsApp</button>
            <button type="button" onClick={() => setPanel(panel === "chiedi" ? "" : "chiedi")} className="aa-press min-h-11 rounded-2xl bg-white/[0.08] text-sm font-semibold">Chiedi alla classe</button>
            <button type="button" onClick={() => setPanel(panel === "allievi" ? "" : "allievi")} className="aa-press min-h-11 rounded-2xl bg-white/[0.08] text-sm font-semibold">Allievi ({c.members.length})</button>
          </div>
          {panel === "scrivi" ? <GroupMessage c={c} /> : null}
          {panel === "chiedi" ? <AskForm c={c} onSent={(n) => { setPanel(""); run(Promise.resolve(), `Richiesta inviata a ${n} ${n === 1 ? "allievo" : "allievi"}.`); }} /> : null}
          {panel === "allievi" ? <Members c={c} people={people} onChange={onChange} /> : null}
          {c.requests.length ? (
            <div className="grid gap-1.5">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted">Richieste alla classe</p>
              {c.requests.map((r) => {
                const k = REQUEST_KINDS.find((x) => x.id === r.kind);
                const total = Math.max(1, c.members.length);
                return (
                  <div key={r.id} className="grid gap-1 rounded-xl bg-white/[0.04] px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <b>{k?.label ?? "Richiesta"}</b>
                      <span className="text-xs tabular-nums text-muted">{r.done}/{c.members.length} fatto</span>
                    </div>
                    {r.message ? <p className="text-xs text-muted">{r.message}</p> : null}
                    <span className="h-1 overflow-hidden rounded-full bg-white/[0.08]"><span className="block h-full rounded-full bg-[#7cf0a8]" style={{ width: `${Math.min(100, (r.done / total) * 100)}%` }} /></span>
                    <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-muted">
                      <span>{r.by}{r.dueOn ? ` · entro il ${r.dueOn.split("-").reverse().slice(0, 2).join("/")}` : ""}</span>
                      {c.whatsappUrl && r.done < c.members.length ? <button type="button" className="font-semibold text-[#5fe39a]" onClick={() => void toGroup(c.whatsappUrl, `Promemoria per ${c.name}: ${(k?.label ?? "richiesta").toLowerCase()}${r.message ? ` – ${r.message}` : ""}. Lo trovate in Arcieri Amiconi, in «Le mie schede». ${SITE_URL}/schede`)}>Sollecita nel gruppo</button> : null}
                      {c.mine ? <button type="button" className="ml-auto text-rose-300" onClick={() => run(deleteRequest({ data: { id: r.id } }))}>Togli</button> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {c.mine ? <button type="button" className="aa-chip" onClick={onEdit}>Modifica</button> : null}
            {c.mine && c.coaches.length > 1 ? <button type="button" className="aa-chip" onClick={() => run(joinClassAsCoach({ data: { id: c.id, join: false } }))}>Lascia la classe</button> : null}
          </div>
          {note ? <p className="text-xs text-emerald-300">{note}</p> : null}
          {err ? <ErrorNote text={err} /> : null}
        </div>
      ) : null}
    </Card>
  );
}

/** messaggio al gruppo WhatsApp: si sceglie un testo, si copia e si apre il gruppo */
function GroupMessage({ c }: { c: Klass }) {
  const ready = [
    `Ciao a tutti! Ci vediamo ${meet(c) || "al prossimo allenamento"}. Portate arco, frecce e protezioni.`,
    `Promemoria: segnate su Arcieri Amiconi i tiri dell'ultimo allenamento, così vedo come state andando. ${SITE_URL}`,
    `Oggi l'allenamento di ${c.name} salta. Vi aggiorno qui per il prossimo.`,
  ];
  const [text, setText] = useState(ready[0]);
  const [done, setDone] = useState(false);
  return (
    <div className="grid gap-2 rounded-2xl border border-[#25d366]/30 bg-[#25d366]/[0.06] p-3">
      <div className="flex flex-wrap gap-1.5">
        {["Ritrovo", "Segnate i tiri", "Annullato"].map((l, i) => <button key={l} type="button" className="aa-chip" aria-pressed={text === ready[i]} onClick={() => setText(ready[i])}>{l}</button>)}
      </div>
      <TextArea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={600} />
      <button type="button" onClick={() => { void toGroup(c.whatsappUrl, text); setDone(true); }} className="aa-press min-h-11 rounded-2xl bg-[#25d366] text-sm font-bold text-[#06210f]">Copia e apri il gruppo</button>
      <p className="text-[0.7rem] text-muted">{done ? "Messaggio copiato: nel gruppo tieni premuto e scegli Incolla." : "WhatsApp non permette di scrivere direttamente in un gruppo: il messaggio si copia e lo incolli tu."}</p>
    </div>
  );
}

function AskForm({ c, onSent }: { c: Klass; onSent: (n: number) => void }) {
  const [kind, setKind] = useState<string>("punteggi");
  const [message, setMessage] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-sm font-semibold">Cosa chiedi agli allievi di {c.name}?</p>
      <div className="flex flex-wrap gap-1.5">
        {REQUEST_KINDS.map((k) => <button key={k.id} type="button" aria-pressed={kind === k.id} className="aa-chip" onClick={() => setKind(k.id)}>{k.label}</button>)}
      </div>
      <TextArea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Due righe di spiegazione (facoltative), es. «6 volée a 18 m»" maxLength={400} />
      <Field label="Entro il (facoltativo)"><TextInput type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} /></Field>
      {err ? <ErrorNote text={err} /> : null}
      <Button disabled={busy || !c.members.length} onClick={() => { setBusy(true); setErr(""); askClass({ data: { classId: c.id, kind, message, dueOn } }).then((r) => onSent(r.sent)).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non inviata.")).finally(() => setBusy(false)); }}>{c.members.length ? `Invia a ${c.members.length} ${c.members.length === 1 ? "allievo" : "allievi"}` : "Aggiungi prima gli allievi"}</Button>
      <p className="text-[0.7rem] text-muted">Ognuno riceve un avviso che lo porta dove farlo, e lo spunta in «Le mie schede». Qui vedi quanti l'hanno fatto.</p>
    </div>
  );
}

function Members({ c, people, onChange }: { c: Klass; people: Data["people"]; onChange: () => void }) {
  const [pick, setPick] = useState("");
  const [err, setErr] = useState("");
  const inside = new Set(c.members.map((m) => m.userId));
  const free = people.filter((p) => !inside.has(p.userId));
  const act = (p: Promise<unknown>) => p.then(onChange).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non riuscito."));
  return (
    <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      {c.members.length ? (
        <ul className="grid gap-1">
          {c.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2.5 py-1">
              <Avatar label={m.name.slice(0, 2).toUpperCase()} color={m.color} photo={m.photoUrl} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{m.name}</span>
              {c.mine ? <button type="button" className="text-xs text-rose-300" onClick={() => void act(setClassMember({ data: { classId: c.id, userId: m.userId, add: false } }))}>Togli</button> : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">Nessun allievo, per ora.</p>}
      {c.mine ? (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Allievo da aggiungere">
            <option value="">Aggiungi dalla compagnia…</option>
            {free.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
          </Select>
          <Button disabled={!pick} onClick={() => { void act(setClassMember({ data: { classId: c.id, userId: pick, add: true } })); setPick(""); }}>Aggiungi</Button>
        </div>
      ) : null}
      <p className="text-[0.7rem] text-muted">Chi non ha ancora l'app lo inviti con «Invita su WhatsApp»: aprendo il link entra nella compagnia e nella classe.</p>
      {err ? <ErrorNote text={err} /> : null}
    </div>
  );
}
