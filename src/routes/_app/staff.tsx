import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar, Button, Card, Empty, ErrorNote, Loading, PageHead, SectionHead, Segmented, Select, TextArea, TextInput, cx } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLoad } from "@/lib/arcieri/use-load";
import { SITE_URL } from "@/lib/arcieri/native";
import { refreshCrests } from "@/lib/arcieri/crest";
import { companyInvite, createRoleCode, decideRequest, redeemCode, removeFromCompany, requestLeader, setRole, staffOverview } from "@/lib/arcieri/staff.api";
import { removeTeamMember } from "@/lib/arcieri/account.api";
import { useEntryState } from "@/lib/arcieri/back-restore";
import { SegreteriaBody } from "./segreteria";

export const Route = createFileRoute("/_app/staff")({ component: Page });

type Overview = Awaited<ReturnType<typeof staffOverview>>;
type Person = Overview["people"][number];

const LEVEL: Record<string, { label: string; color: string }> = {
  super: { label: "Fondatore", color: "#ffd27a" },
};

function since(iso: string | null) {
  if (!iso) return "mai";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "oggi";
  if (days === 1) return "ieri";
  if (days < 60) return `${days} giorni fa`;
  return `${Math.round(days / 30)} mesi fa`;
}

function share(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Gestione compagnia: incarichi, codici, richieste, inviti e assenti. Ognuno vede solo quello che può fare. */
function Page() {
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`staff-${nonce}`, () => staffOverview());
  const [view, setView] = useEntryState<"persone" | "segreteria">("staff-vista", "persone");
  const reload = () => setNonce((n) => n + 1);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote text={error || "Errore"} />;
  const lvl = data.me.level;
  const leader = data.me.leader;
  const coach = data.me.coach;
  const manager = Boolean(lvl) || leader || coach;
  const title = lvl ? "Fondatore" : leader ? "Presidente" : coach ? "Allenatore" : "Arciere";
  const lede = lvl
    ? "Nomini i presidenti delle compagnie, rispondi alle richieste e tieni d'occhio chi non si vede da tempo."
    : leader
      ? `Guidi ${data.me.companyName}: aggiungi e togli persone, nomini gli allenatori.`
      : coach
        ? `Alleni in ${data.me.companyName}: puoi aggiungere e togliere persone della tua compagnia.`
        : "Hai ricevuto un codice? Usalo qui. Puoi anche chiedere di diventare presidente della tua compagnia.";
  return (
    <div className="grid gap-4">
      <PageHead kicker={`Il tuo incarico · ${title}`} title="Gestione compagnia" lede={manager && view === "segreteria" ? "Quote, certificati medici e presenze ai corsi. La vedono il fondatore, il presidente e gli allenatori." : lede} />
      {manager ? <Segmented value={view} onChange={setView} options={[{ id: "persone", label: "Persone e incarichi" }, { id: "segreteria", label: "Segreteria" }]} /> : null}
      {manager && view === "segreteria" ? <SegreteriaBody embedded /> : <>
      <RoleMap level={lvl} leader={leader} coach={coach} />
      <RedeemCard onDone={reload} />
      {!lvl && !leader ? <LeaderRequest data={data} onDone={reload} /> : null}
      {manager ? <InviteCard data={data} /> : null}
      {lvl ? <Requests data={data} onDone={reload} /> : null}
      {lvl ? <CodeMaker data={data} onDone={reload} /> : null}
      {manager ? <People data={data} onDone={reload} /> : null}
      {manager ? <Absent data={data} onDone={reload} /> : null}
      </>}
    </div>
  );
}

/** chi può fare cosa: tre incarichi, con quello attuale in evidenza */
function RoleMap({ level, leader, coach }: { level: string | null; leader: boolean; coach?: boolean }) {
  const steps = [
    { id: "super", label: "Fondatore", text: "Tutte le compagnie: nomina i presidenti. Nessuno lo può togliere." },
    { id: "leader", label: "Presidente della compagnia", text: "Aggiunge e toglie persone della sua compagnia e ne nomina gli allenatori." },
    { id: "coach", label: "Allenatore", text: "Aggiunge e toglie persone della sua compagnia, segue gli allievi con schede e analisi." },
  ];
  const mine = level ?? (leader ? "leader" : coach ? "coach" : "");
  return (
    <Card className="grid gap-2">
      <SectionHead title="Chi può fare cosa" />
      <ol className="grid gap-1.5">
        {steps.map((s, i) => (
          <li key={s.id} className={cx("aa-staff-step flex items-start gap-3 rounded-2xl p-2.5", s.id === mine ? "is-mine" : "")} style={{ animationDelay: `${i * 60}ms` }}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-sm text-[#1a1408]" style={{ background: s.id === "leader" ? "#7cf0a8" : s.id === "coach" ? "#8cc3f0" : LEVEL[s.id].color }}>{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{s.label}{s.id === mine ? " · sei tu" : ""}</span>
              <span className="block text-xs text-muted">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function RedeemCard({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card className="grid gap-2">
      <SectionHead title="Hai un codice?" sub="Nomina a presidente o invito in una compagnia." />
      <div className="flex gap-2">
        <TextInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="es. PRE-AB12-CD34" autoCapitalize="characters" className="font-mono" />
        <Button
          disabled={busy || code.trim().length < 6}
          onClick={() => {
            setBusy(true);
            setErr("");
            setMsg("");
            redeemCode({ data: { code } })
              .then((r) => {
                setMsg(r.message);
                setCode("");
                refreshCrests();
                onDone();
              })
              .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Codice non valido."))
              .finally(() => setBusy(false));
          }}
        >
          Usa
        </Button>
      </div>
      {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}
      {err ? <ErrorNote text={err} /> : null}
    </Card>
  );
}

function LeaderRequest({ data, onDone }: { data: Overview; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const open = data.myRequests.find((r) => r.status === "attesa");
  const last = data.myRequests[0];
  return (
    <Card className="grid gap-2">
      <SectionHead title="Diventa presidente" sub={`Chiedi al fondatore di guidare ${data.me.companyName}.`} />
      {open ? (
        <p className="rounded-2xl bg-white/[0.05] p-3 text-sm">Richiesta inviata {since(open.createdAt)}: il fondatore ti risponderà con una notifica.</p>
      ) : (
        <>
          {last && last.status === "no" ? <p className="text-xs text-muted">L'ultima richiesta non è stata accettata. Puoi riprovare.</p> : null}
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Due righe per il fondatore (facoltativo)" />
          <Button onClick={() => requestLeader({ data: { note } }).then(onDone).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non inviata."))}>Invia la richiesta</Button>
        </>
      )}
      {err ? <ErrorNote text={err} /> : null}
    </Card>
  );
}

function InviteCard({ data }: { data: Overview }) {
  const [companyId, setCompanyId] = useState(data.me.companyId);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const name = data.companies.find((c) => c.id === companyId)?.name ?? data.me.companyName;
  const link = code ? `${SITE_URL}/?invito=${code}` : "";
  const text = `Entra nella ${name} su Arcieri Amiconi: ${link}\nSe hai già l'app, in Gestione compagnia usa il codice ${code}.`;
  return (
    <Card className="grid gap-2">
      <SectionHead title="Invita nella compagnia" sub="Un link da mandare su WhatsApp: chi lo apre entra nella compagnia." />
      {data.me.level && data.companies.length > 1 ? (
        <Select value={companyId} onChange={(e) => { setCompanyId(Number(e.target.value)); setCode(""); }}>
          {data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      ) : null}
      {code ? (
        <div className="grid gap-2">
          <p className="rounded-2xl bg-white/[0.05] p-3 font-mono text-sm">{code}</p>
          <div className="grid grid-cols-2 gap-2">
            <a href={share(text)} target="_blank" rel="noreferrer" className="aa-press flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#25d366] text-sm font-bold text-[#06210f]">
              WhatsApp
            </a>
            <button type="button" className="aa-press min-h-11 rounded-2xl bg-white/[0.08] text-sm font-semibold" onClick={() => void navigator.clipboard?.writeText(link)}>
              Copia il link
            </button>
          </div>
        </div>
      ) : (
        <Button onClick={() => companyInvite({ data: { companyId } }).then((r) => setCode(r.code)).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Invito non creato."))}>Crea l'invito</Button>
      )}
      {err ? <ErrorNote text={err} /> : null}
    </Card>
  );
}

function Requests({ data, onDone }: { data: Overview; onDone: () => void }) {
  return (
    <Card className="grid gap-2">
      <SectionHead title="Richieste" sub={data.requests.length ? `${data.requests.length} in attesa` : "Nessuna richiesta in attesa."} />
      {data.requests.map((r) => (
        <div key={r.id} className="grid gap-2 rounded-2xl bg-white/[0.04] p-3">
          <p className="text-sm"><b>{r.name}</b> vuole diventare presidente di <b>{r.companyName}</b></p>
          {r.note ? <p className="text-xs text-muted">«{r.note}»</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => decideRequest({ data: { id: r.id, ok: true } }).then(onDone)}>Accetta</Button>
            <Button variant="ghost" onClick={() => decideRequest({ data: { id: r.id, ok: false } }).then(onDone)}>Rifiuta</Button>
          </div>
        </div>
      ))}
    </Card>
  );
}

function CodeMaker({ data, onDone }: { data: Overview; onDone: () => void }) {
  const [companyId, setCompanyId] = useState(data.me.companyId);
  const [made, setMade] = useState("");
  const [err, setErr] = useState("");
  const what = `presidente di ${data.companies.find((c) => c.id === companyId)?.name ?? "una compagnia"}`;
  return (
    <Card className="grid gap-2">
      <SectionHead title="Nomina un presidente" sub="Il codice vale una volta sola, per 7 giorni." />
      <Select value={companyId} onChange={(e) => { setCompanyId(Number(e.target.value)); setMade(""); }}>
        {data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      {made ? (
        <div className="grid gap-2">
          <p className="rounded-2xl bg-white/[0.05] p-3 text-center font-mono text-lg tracking-wider">{made}</p>
          <a href={share(`Su Arcieri Amiconi sei stato nominato ${what}. Apri Gestione compagnia e usa il codice ${made} (vale 7 giorni): ${SITE_URL}/staff`)} target="_blank" rel="noreferrer" className="aa-press flex min-h-11 items-center justify-center rounded-2xl bg-[#25d366] text-sm font-bold text-[#06210f]">
            Manda su WhatsApp
          </a>
        </div>
      ) : (
        <Button onClick={() => createRoleCode({ data: { kind: "capogruppo", companyId } }).then((r) => { setMade(r.code); onDone(); }).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Codice non creato."))}>Crea il codice</Button>
      )}
      {err ? <ErrorNote text={err} /> : null}
      {data.codes.length ? (
        <ul className="grid gap-1 text-xs text-muted">
          {data.codes.map((c) => (
            <li key={c.code} className="flex items-center justify-between gap-2">
              <span className="font-mono">{c.code}</span>
              <span>{c.used ? "usato" : c.kind === "capogruppo" ? `presidente · ${c.companyName}` : "non più valido"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function Badge({ p }: { p: Person }) {
  const items = [
    ...(p.level ? [LEVEL[p.level]] : []),
    ...(p.leader ? [{ label: "Presidente", color: "#7cf0a8" }] : []),
    ...(p.coach ? [{ label: "Allenatore", color: "#8cc3f0" }] : []),
  ];
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((b) => <span key={b.label} className="rounded-full px-1.5 py-px text-[0.6rem] font-bold text-[#1a1408]" style={{ background: b.color }}>{b.label}</span>)}
    </span>
  );
}

function People({ data, onDone }: { data: Overview; onDone: () => void }) {
  const lvl = data.me.level;
  const leader = data.me.leader;
  const [filter, setFilter] = useState<number | "tutte">(lvl ? "tutte" : data.me.companyId);
  const [open, setOpen] = useState<number | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const list = data.people.filter((p) => filter === "tutte" || p.companyId === filter);
  const act = (fn: () => Promise<unknown>) => {
    setErr("");
    fn().then(() => { setOpen(null); setArmed(null); onDone(); }).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non riuscito."));
  };
  return (
    <Card className="grid gap-2">
      <SectionHead title={lvl ? "Persone e incarichi" : "La tua compagnia"} sub={lvl ? "Tocca una persona per le azioni." : "Tocca una persona per le azioni. Per aggiungere qualcuno usa l'invito qui sopra."} />
      {lvl ? (
        <Select value={String(filter)} onChange={(e) => setFilter(e.target.value === "tutte" ? "tutte" : Number(e.target.value))}>
          <option value="tutte">Tutte le compagnie</option>
          {data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      ) : null}
      {err ? <ErrorNote text={err} /> : null}
      <ul className="grid gap-1">
        {list.map((p) => {
          const me = p.memberId === data.me.memberId;
          const founder = p.level === "super";
          const sameCompany = p.companyId === data.me.companyId;
          // il presidente lo nomina solo il fondatore; gli allenatori il fondatore o il presidente della compagnia
          const canLeader = Boolean(lvl) && !founder;
          const canCoach = !founder && (Boolean(lvl) || (leader && sameCompany));
          // togliere: il fondatore ovunque, presidente e allenatori nella loro compagnia; l'allenatore non toglie il presidente
          const canRemove = !me && !founder && (Boolean(lvl) || (sameCompany && (leader || !p.leader)));
          return (
            <li key={p.memberId} className="rounded-2xl bg-white/[0.03]">
              <button type="button" className="flex w-full items-center gap-3 p-2 text-left" onClick={() => { setOpen(open === p.memberId ? null : p.memberId); setArmed(null); }}>
                <Avatar label={p.name} color={p.color} photo={p.photoUrl} admin={founder} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name}{me ? " (tu)" : ""}</span>
                  <span className="block truncate text-[0.7rem] text-muted">{lvl ? `${p.companyName} · ` : ""}visto {since(p.lastSeen)}</span>
                  <Badge p={p} />
                </span>
                <Glyph name="chevron" size={14} className={cx("text-muted transition-transform", open === p.memberId ? "rotate-90" : "")} />
              </button>
              {open === p.memberId ? (
                <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
                  <Link to="/arciere/$id" params={{ id: String(p.memberId) }} className="aa-chip">Profilo</Link>
                  {canLeader ? <button type="button" className="aa-chip" onClick={() => act(() => setRole({ data: { memberId: p.memberId, leader: !p.leader } }))}>{p.leader ? "Togli presidente" : "Fai presidente"}</button> : null}
                  {canCoach ? <button type="button" className="aa-chip" onClick={() => act(() => setRole({ data: { memberId: p.memberId, coach: !p.coach } }))}>{p.coach ? "Togli allenatore" : "Fai allenatore"}</button> : null}
                  {canRemove ? (
                    armed === p.memberId ? (
                      <button type="button" className="rounded-full bg-danger px-3 py-1.5 text-xs font-bold text-danger-fg" onClick={() => act(() => removeFromCompany({ data: { memberId: p.memberId } }))}>Conferma: togli</button>
                    ) : (
                      <button type="button" className="aa-chip" onClick={() => setArmed(p.memberId)}>Togli dalla compagnia</button>
                    )
                  ) : null}
                  {founder && !me ? <span className="text-xs text-muted">Il fondatore non si può modificare.</span> : null}
                  {!founder && !me && !canRemove && sameCompany && p.leader ? <span className="text-xs text-muted">Il presidente lo toglie solo il fondatore.</span> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Absent({ data, onDone }: { data: Overview; onDone: () => void }) {
  const lvl = data.me.level;
  const [armed, setArmed] = useState<number | null>(null);
  const [err, setErr] = useState("");
  if (!data.absent.length) return <Empty title={`Assenti da più di ${Math.round(data.absentDays / 30)} mesi`} text="Nessuno: tutti si sono fatti vivi di recente." />;
  return (
    <Card className="grid gap-2">
      <SectionHead title={`Assenti da più di ${Math.round(data.absentDays / 30)} mesi`} sub="Nessun accesso e nessun allenamento in questo periodo." />
      {err ? <ErrorNote text={err} /> : null}
      <ul className="grid gap-1">
        {data.absent.map((p) => {
          const locked = p.level === "super";
          return (
            <li key={p.memberId} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-2">
              <Avatar label={p.name} color={p.color} photo={p.photoUrl} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{p.name}</span>
                <span className="block text-[0.7rem] text-muted">{p.companyName} · visto {since(p.lastSeen)}</span>
              </span>
              {lvl === "super" && !locked ? (
                armed === p.memberId ? (
                  <button type="button" className="rounded-full bg-danger px-3 py-1.5 text-xs font-bold text-danger-fg" onClick={() => removeTeamMember({ data: { id: p.memberId } }).then(() => { setArmed(null); onDone(); }).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non tolto."))}>Conferma</button>
                ) : (
                  <button type="button" className="rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-semibold" onClick={() => setArmed(p.memberId)}>Togli dall'app</button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
