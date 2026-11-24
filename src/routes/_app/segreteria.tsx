import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Avatar, Button, Card, Empty, ErrorNote, HoldDelete, Loading, PageHead, Segmented, Select, TextInput, cx } from "@/components/kit";
import { useLoad, messageOf } from "@/lib/arcieri/use-load";
import { useEntryState } from "@/lib/arcieri/back-restore";
import { saveFile, whatsappLink } from "@/lib/arcieri/native";
import { addCourseDay, deleteCourseDay, secretaryBoard, setCert, setDue, setPresence } from "@/lib/arcieri/segreteria.api";

export const Route = createFileRoute("/_app/segreteria")({ component: Page });

type Board = Awaited<ReturnType<typeof secretaryBoard>>;
type Person = Board["people"][number];
type Tab = "quote" | "certificati" | "presenze";

/** da novembre si raccolgono le quote dell'anno dopo (come sul server) */
const currentSeason = (now = new Date()) => (now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear());
const today = () => new Date().toISOString().slice(0, 10);
const itDate = (d: string) => (d ? d.split("-").reverse().join("/") : "");

function certState(p: Person): { text: string; tone: string } {
  if (!p.certUntil || p.certDays == null) return { text: "manca", tone: "bg-rose-500/20 text-rose-300" };
  if (p.certDays < 0) return { text: "scaduto", tone: "bg-rose-500/20 text-rose-300" };
  if (p.certDays <= 30) return { text: `scade fra ${p.certDays} g`, tone: "bg-[#e07a2f]/25 text-[#f3a46a]" };
  return { text: "valido", tone: "bg-[#3f8a76]/25 text-[#7cf0a8]" };
}

function csvCell(v: unknown) {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Segreteria della compagnia: quote dell'anno, certificati medici e presenze ai corsi. */
function Page() {
  const [companyId, setCompanyId] = useEntryState("segr-company", 0);
  const [season, setSeason] = useEntryState("segr-season", currentSeason());
  const [tab, setTab] = useEntryState<Tab>("segr-tab", "quote");
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`segr-${companyId}-${season}-${nonce}`, () => secretaryBoard({ data: { companyId, season } }));
  const [board, setBoard] = useState<Board | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => setBoard(data), [data]);

  if (loading && !board) return <Loading />;
  if (error && !board) return <ErrorNote text={error} />;
  if (!board) return <ErrorNote text="Errore" />;
  const b = board;
  const cid = b.company.id;

  function patch(userId: string, change: Partial<Person>) {
    setBoard((cur) => (cur ? { ...cur, people: cur.people.map((p) => (p.userId === userId ? { ...p, ...change } : p)) } : cur));
  }
  async function run(work: () => Promise<unknown>, reload = false) {
    setNote("");
    try {
      await work();
      if (reload) setNonce((n) => n + 1);
    } catch (e) {
      setNote(messageOf(e));
      setNonce((n) => n + 1);
    }
  }

  function exportCsv() {
    const head = ["Nome", `Quota ${b.season}`, "Pagata il", "Importo", "Certificato fino al", "Tipo", "Presenze"];
    const lines = b.people.map((p) => [p.name, p.paid ? "pagata" : "da pagare", itDate(p.paidOn), p.amount != null ? p.amount.toFixed(2).replace(".", ",") : "", itDate(p.certUntil), p.certUntil ? p.certKind : "", p.attended]);
    const text = [head, ...lines].map((r) => r.map(csvCell).join(";")).join("\n");
    void saveFile(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }), `segreteria-${b.company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${b.season}.csv`);
  }

  const unpaid = b.people.length - b.stats.paid;
  const reminder = tab === "certificati"
    ? `Ciao a tutti! Controllate la scadenza del certificato medico: senza certificato valido non si può tirare in campo. Chi lo ha rinnovato mi mandi la nuova data. Grazie!`
    : `Ciao a tutti! Ricordo a chi non l'ha ancora fatto di versare la quota ${b.season} della compagnia. Grazie!`;

  return (
    <div className="grid gap-3">
      <PageHead kicker={b.company.name} title="Segreteria" lede="Quote, certificati medici e presenze ai corsi. Lo vedono solo il presidente e lo staff." />
      {b.companies.length > 1 ? (
        <Select value={String(cid)} onChange={(e) => setCompanyId(Number(e.target.value))} aria-label="Compagnia">
          {b.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="grid gap-0.5 !p-3"><b className="font-display text-3xl leading-none">{b.stats.members}</b><span className="text-xs text-muted">iscritti</span></Card>
        <Card className="grid gap-0.5 !p-3"><b className="font-display text-3xl leading-none text-[#7cf0a8]">{b.stats.paid}</b><span className="text-xs text-muted">quote {b.season} pagate</span></Card>
        <Card className="grid gap-0.5 !p-3"><b className={cx("font-display text-3xl leading-none", b.stats.certAlert ? "text-[#f3a46a]" : "")}>{b.stats.certAlert}</b><span className="text-xs text-muted">certificati da sistemare</span></Card>
        <Card className="grid gap-0.5 !p-3"><b className="font-display text-3xl leading-none">{b.stats.attendance != null ? `${b.stats.attendance}%` : "–"}</b><span className="text-xs text-muted">presenze ultimi corsi</span></Card>
      </div>
      <Segmented<Tab> value={tab} onChange={setTab} options={[{ id: "quote", label: "Quote" }, { id: "certificati", label: "Certificati" }, { id: "presenze", label: "Presenze" }]} />
      {note ? <ErrorNote text={note} /> : null}

      {!b.people.length ? <Empty title="Nessun iscritto" text="Quando qualcuno entra nella compagnia dall'app, compare qui." /> : null}

      {tab === "quote" && b.people.length ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" className="!min-h-9 !px-3" onClick={() => setSeason(season - 1)} aria-label="Stagione precedente">‹</Button>
            <span className="text-sm font-semibold">Stagione {b.season} · {unpaid ? `${unpaid} da pagare` : "tutte pagate"}</span>
            <Button variant="ghost" className="!min-h-9 !px-3" onClick={() => setSeason(season + 1)} aria-label="Stagione successiva">›</Button>
          </div>
          <Card className="grid gap-0 !py-1">
            {b.people.map((p, i) => (
              <div key={p.userId} className={cx("flex items-center gap-3 py-2.5", i ? "border-t border-white/[0.06]" : "")}>
                <Avatar label={p.name.slice(0, 2).toUpperCase()} color={p.color} photo={p.photoUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{p.name}</b>
                  <span className="text-xs text-muted">{p.paid ? `pagata${p.paidOn ? ` il ${itDate(p.paidOn)}` : ""}${p.amount != null ? ` · ${p.amount.toFixed(2).replace(".", ",")} €` : ""}` : "da pagare"}</span>
                </span>
                <TextInput
                  inputMode="decimal"
                  placeholder="€"
                  aria-label={`Importo di ${p.name}`}
                  defaultValue={p.amount != null ? String(p.amount).replace(".", ",") : ""}
                  className="!min-h-9 !w-16 !px-2 text-right"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const now = p.amount != null ? String(p.amount).replace(".", ",") : "";
                    if (v === now || v === "") return;
                    patch(p.userId, { amount: Number(v.replace(",", ".")) });
                    void run(() => setDue({ data: { companyId: cid, userId: p.userId, season: b.season, paid: p.paid, amount: v } }));
                  }}
                />
                <button
                  type="button"
                  aria-pressed={p.paid}
                  onClick={() => {
                    patch(p.userId, { paid: !p.paid, paidOn: !p.paid ? today() : "" });
                    void run(() => setDue({ data: { companyId: cid, userId: p.userId, season: b.season, paid: !p.paid } }));
                  }}
                  className={cx("min-h-9 shrink-0 rounded-full px-3 text-xs font-bold", p.paid ? "bg-[#3f8a76]/30 text-[#7cf0a8]" : "border border-hair bg-white/5 text-muted")}
                >
                  {p.paid ? "Pagata" : "Segna pagata"}
                </button>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      {tab === "certificati" && b.people.length ? (
        <Card className="grid gap-0 !py-1">
          {b.people.map((p, i) => {
            const st = certState(p);
            return (
              <div key={p.userId} className={cx("grid gap-2 py-2.5", i ? "border-t border-white/[0.06]" : "")}>
                <div className="flex items-center gap-3">
                  <Avatar label={p.name.slice(0, 2).toUpperCase()} color={p.color} photo={p.photoUrl} size="sm" />
                  <b className="min-w-0 flex-1 truncate text-sm">{p.name}</b>
                  <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-bold", st.tone)}>{st.text}</span>
                </div>
                <div className="flex gap-2 pl-11">
                  <TextInput
                    type="date"
                    aria-label={`Scadenza certificato di ${p.name}`}
                    value={p.certUntil}
                    className="!min-h-9 flex-1"
                    onChange={(e) => {
                      const v = e.target.value;
                      const left = v ? Math.round((new Date(v).getTime() - new Date(today()).getTime()) / 86_400_000) : null;
                      patch(p.userId, { certUntil: v, certDays: left });
                      void run(() => setCert({ data: { companyId: cid, userId: p.userId, validUntil: v, kind: p.certKind } }));
                    }}
                  />
                  <Select
                    aria-label={`Tipo di certificato di ${p.name}`}
                    value={p.certKind}
                    className="!min-h-9 !w-40"
                    onChange={(e) => {
                      const kind = e.target.value;
                      patch(p.userId, { certKind: kind });
                      void run(() => setCert({ data: { companyId: cid, userId: p.userId, validUntil: p.certUntil, kind } }));
                    }}
                  >
                    <option value="agonistico">agonistico</option>
                    <option value="non agonistico">non agonistico</option>
                  </Select>
                </div>
              </div>
            );
          })}
        </Card>
      ) : null}

      {tab === "presenze" && b.people.length ? <Presence board={b} onChange={setBoard} run={run} /> : null}

      {b.people.length ? (
        <div className="grid grid-cols-2 gap-2">
          {tab !== "presenze" ? (
            <a href={whatsappLink(reminder)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-hair bg-white/5 px-3 text-sm font-semibold">
              Promemoria sul gruppo
            </a>
          ) : <span />}
          <Button variant="ghost" onClick={exportCsv}>Esporta tabella (CSV)</Button>
        </div>
      ) : null}
      <p className="text-xs text-muted">Del certificato si salvano solo tipo e data di scadenza, mai il documento o la diagnosi.</p>
    </div>
  );
}

function Presence({ board, onChange, run }: { board: Board; onChange: (b: Board) => void; run: (w: () => Promise<unknown>, reload?: boolean) => Promise<void> }) {
  const [dayId, setDayId] = useState<number>(board.days[0]?.id ?? 0);
  const [day, setDay] = useState(today());
  const [title, setTitle] = useState("Corso");
  const cid = board.company.id;
  const current = board.days.find((d) => d.id === dayId) ?? board.days[0];
  useEffect(() => {
    if (!board.days.some((d) => d.id === dayId)) setDayId(board.days[0]?.id ?? 0);
  }, [board.days, dayId]);

  function toggle(userId: string) {
    if (!current) return;
    const present = !current.present.includes(userId);
    const days = board.days.map((d) => (d.id === current.id ? { ...d, present: present ? [...d.present, userId] : d.present.filter((u) => u !== userId) } : d));
    const people = board.people.map((p) => (p.userId === userId ? { ...p, attended: p.attended + (present ? 1 : -1) } : p));
    onChange({ ...board, days, people });
    void run(() => setPresence({ data: { companyId: cid, dayId: current.id, userId, present } }));
  }

  return (
    <>
      <Card className="grid gap-2">
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted">Nuova giornata</p>
        <div className="flex gap-2">
          <TextInput type="date" value={day} onChange={(e) => setDay(e.target.value)} className="!min-h-10 flex-1" aria-label="Giorno" />
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} className="!min-h-10 flex-1" aria-label="Titolo" />
        </div>
        <Button onClick={() => void run(async () => {
          const made = await addCourseDay({ data: { companyId: cid, day, title } });
          setDayId(made.id);
        }, true)}>Aggiungi giornata</Button>
      </Card>
      {board.days.length && current ? (
        <>
          <Select value={String(current.id)} onChange={(e) => setDayId(Number(e.target.value))} aria-label="Giornata">
            {board.days.map((d) => <option key={d.id} value={d.id}>{itDate(d.day)} · {d.title} ({d.present.length})</option>)}
          </Select>
          <Card className="grid gap-0 !py-1">
            {board.people.map((p, i) => {
              const on = current.present.includes(p.userId);
              return (
                <button key={p.userId} type="button" aria-pressed={on} onClick={() => toggle(p.userId)} className={cx("flex items-center gap-3 py-2.5 text-left", i ? "border-t border-white/[0.06]" : "")}>
                  <Avatar label={p.name.slice(0, 2).toUpperCase()} color={p.color} photo={p.photoUrl} size="sm" />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{p.name}</b>
                    <span className="text-xs text-muted">{p.attended} presenze in totale</span>
                  </span>
                  <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full border text-sm font-bold", on ? "border-[#7cf0a8] bg-[#3f8a76]/40 text-[#7cf0a8]" : "border-hair text-transparent")}>✓</span>
                </button>
              );
            })}
          </Card>
          <HoldDelete hint={false} label="Tieni premuto per eliminare la giornata" onDelete={() => run(() => deleteCourseDay({ data: { companyId: cid, id: current.id } }), true)}>
            <span className="block text-center text-xs text-muted">Tieni premuto qui per eliminare questa giornata</span>
          </HoldDelete>
        </>
      ) : (
        <Empty title="Nessuna giornata" text="Aggiungi il primo giorno di corso e segna chi c'era con un tocco." />
      )}
    </>
  );
}
