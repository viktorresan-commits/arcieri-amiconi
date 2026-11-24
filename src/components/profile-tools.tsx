import { useState, type CSSProperties } from "react";
import { IconLabel, IconTitle } from "./icons";
import { deleteMyAccount, removeTeamMember, resetMyData, setShareCoach, teamList } from "@/lib/arcieri/account.api";
import { claimRoster, resetMemberPassword, updateMember } from "@/lib/arcieri/members.api";
import { APK_URL, SITE_URL, inviteText, openExternal, whatsappLink } from "@/lib/arcieri/native";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, Chips, ErrorNote, Field, Select, TextInput } from "./kit";

/* ---------------- invito e app ---------------- */

export function InviteCard() {
  const [copied, setCopied] = useState(false);
  return (
    <Card className="grid gap-2">
      <IconTitle icon="share" color="#2c8a57">Invita e scarica l'app</IconTitle>
      <p className="text-xs text-muted">Manda l'invito su WhatsApp con il link del sito e dell'app Android.</p>
      <Button onClick={() => void openExternal(whatsappLink(inviteText()))} className="!bg-[#25d366] !text-[#0b1f12]">
        <WaIcon /> Invita su WhatsApp
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => void openExternal(APK_URL)}><IconLabel icon="download">Scarica APK</IconLabel></Button>
        <Button
          variant="ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(SITE_URL).then(() => setCopied(true)).catch(() => undefined);
          }}
        >
          {copied ? <IconLabel icon="check">Copiato</IconLabel> : <IconLabel icon="link">Copia link</IconLabel>}
        </Button>
      </div>
    </Card>
  );
}

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z" />
    </svg>
  );
}

/* ---------------- codice d'invito ---------------- */

export function ClaimCard({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <Card className="grid gap-2">
      <IconTitle icon="ticket" color="#c39320">Hai un codice d'invito?</IconTitle>
      <p className="text-xs text-muted">Se il presidente o il fondatore ti ha già messo in squadra, il codice collega il tuo account a quel posto (con i dati già inseriti).</p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <TextInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="AMXXXXXX" />
        <Button
          variant="ghost"
          onClick={() => claimRoster({ data: { code } }).then(() => { setMsg("Fatto: sei collegato al tuo posto in squadra."); onDone(); }).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Codice non valido"))}
        >
          Usa
        </Button>
      </div>
      {msg ? <p className="text-xs text-muted">{msg}</p> : null}
    </Card>
  );
}

/* ---------------- azzera i miei dati ---------------- */

type Scope = "allenamenti" | "gare" | "attrezzatura" | "tutto";
const SCOPES: { id: Scope; label: string; text: string }[] = [
  { id: "allenamenti", label: "Allenamenti", text: "tutti gli allenamenti con le frecce e le analisi del gesto" },
  { id: "gare", label: "Gare", text: "i tuoi risultati di gara e le piazzole (le gare della squadra restano)" },
  { id: "attrezzatura", label: "Attrezzatura", text: "archi, frecce, assetti e lista acquisti" },
  { id: "tutto", label: "Tutto", text: "tutto quanto sopra più obiettivi, medaglie, notifiche, sfide e partite. Restano solo account e profilo" },
];

export function ResetCard({ onDone }: { onDone: () => void }) {
  const [scope, setScope] = useState<Scope>("allenamenti");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const pick = SCOPES.find((s) => s.id === scope);
  async function go() {
    setBusy(true);
    setMsg("");
    try {
      const res = await resetMyData({ data: { scope, confirm } });
      setMsg(res.removed.length ? `Cancellato: ${res.removed.map((r) => `${r.n} ${r.label}`).join(", ")}.` : "Non c'era niente da cancellare.");
      setConfirm("");
      onDone();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Non riuscito");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="grid gap-2 border-rose-500/30">
      <IconTitle icon="broom" color="#c4475a">Azzera i miei dati</IconTitle>
      <Chips value={scope} onChange={setScope} options={SCOPES.map(({ id, label }) => ({ id, label }))} />
      <p className="text-xs text-muted">Cancella {pick?.text}. Non si può annullare: prima, se vuoi, scarica il JSON qui sopra.</p>
      <Field label="Per confermare scrivi AZZERA">
        <TextInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="AZZERA" autoCapitalize="characters" />
      </Field>
      <Button disabled={busy || confirm.trim().toUpperCase() !== "AZZERA"} onClick={() => void go()} className="!bg-rose-600 !text-white">
        {busy ? "Cancello…" : `Azzera ${pick?.label.toLowerCase()}`}
      </Button>
      {msg ? <p className="text-xs text-muted">{msg}</p> : null}
    </Card>
  );
}

/* ---------------- privacy, condivisione con gli allenatori, eliminazione dell'account ---------------- */

export function PrivacyCard({ share, onDone }: { share: boolean; onDone: () => void }) {
  const [on, setOn] = useState(share);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function flip(next: boolean) {
    setBusy(true);
    setMsg("");
    try {
      await setShareCoach({ data: { share: next } });
      setOn(next);
      onDone();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Non salvato");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="grid gap-2">
      <IconTitle icon="lock" color="#3f8a76" sub="Chi vede cosa, e come togliere tutto">Privacy</IconTitle>
      <label className="flex min-h-12 items-center gap-3 rounded-xl bg-white/[0.04] px-3 text-sm">
        <input type="checkbox" checked={on} disabled={busy} onChange={(e) => void flip(e.target.checked)} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Gli allenatori vedono i miei allenamenti</span>
          <span className="block text-xs text-muted">Media, andamento, analisi del gesto e foto delle volée, solo nella tua compagnia.</span>
        </span>
      </label>
      <a href="/privacy" className="flex min-h-11 items-center justify-between rounded-xl bg-white/[0.04] px-3 text-sm font-semibold">
        Leggi l'informativa sulla privacy
        <span aria-hidden className="text-muted">›</span>
      </a>
      {msg ? <ErrorNote text={msg} /> : null}
    </Card>
  );
}

export function DeleteAccountCard({ founder }: { founder: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function go() {
    setBusy(true);
    setMsg("");
    try {
      await deleteMyAccount({ data: { confirm } });
      try {
        localStorage.clear();
      } catch {
        /* niente */
      }
      window.location.href = "/login";
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Non riuscito");
      setBusy(false);
    }
  }
  return (
    <Card className="grid gap-2 border-rose-500/30">
      <IconTitle icon="trash" color="#c4475a">Elimina il mio account</IconTitle>
      <p className="text-xs text-muted">Cancella l'account, il profilo, gli allenamenti, le gare, l'attrezzatura, l'arciere e tutto il resto. Non si può annullare: prima, se vuoi, scarica il JSON qui sopra.</p>
      {founder ? <p className="text-xs text-amber-300">Sei il fondatore dell'app: l'account del fondatore non si può eliminare da qui.</p> : null}
      {!open ? (
        <Button variant="ghost" onClick={() => setOpen(true)} disabled={founder}>Voglio eliminare l'account</Button>
      ) : (
        <>
          <Field label="Per confermare scrivi ELIMINA">
            <TextInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="ELIMINA" autoCapitalize="characters" />
          </Field>
          <Button disabled={busy || confirm.trim().toUpperCase() !== "ELIMINA"} onClick={() => void go()} className="!bg-rose-600 !text-white">
            {busy ? "Elimino…" : "Elimina definitivamente"}
          </Button>
        </>
      )}
      {msg ? <p className="text-xs text-muted">{msg}</p> : null}
    </Card>
  );
}

/* ---------------- gestione squadra (fondatore) ---------------- */

const ROLE_LABEL: Record<string, string> = { archer: "Arciere", viewer: "Solo lettura" };

export function TeamAdmin() {
  const [nonce, setNonce] = useState(0);
  const team = useLoad(`team-admin-${nonce}`, () => teamList());
  const [sure, setSure] = useState<number | null>(null);
  const [pw, setPw] = useState<{ id: number; value: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  if (!team.data?.admin) return null;
  const people = team.data.people.filter((p) => !q || `${p.name} ${p.nickname} ${p.email}`.toLowerCase().includes(q.toLowerCase()));
  const act = (p: Promise<unknown>, ok: string) =>
    p.then(() => { setMsg(ok); setNonce((n) => n + 1); }).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Non riuscito"));
  return (
    <Card className="grid gap-2">
      <IconTitle icon="shield" color="#4568d6">Gestione squadra</IconTitle>
      <p className="text-xs text-muted">Ruoli, password, inviti su WhatsApp e rimozione. Togliere una persona cancella il suo account e tutti i suoi dati.</p>
      <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per nome o email" />
      {msg ? <ErrorNote text={msg} /> : null}
      <ul className="grid gap-2">
        {people.map((p) => (
          <li key={p.id} className="aa-kpi grid gap-2" style={{ "--kpi": p.color } as CSSProperties}>
            <div className="flex items-center gap-2">
              {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold" style={{ background: p.color }}>{p.name.slice(0, 1)}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}{p.id === team.data?.meId ? " (tu)" : ""}</p>
                <p className="truncate text-[0.7rem] text-muted">{p.email || (p.linked ? "account senza email" : `non ancora registrato · codice ${p.code}`)} · {p.sessions} allenamenti</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {p.role === "admin" ? (
                <span className="grid min-h-11 place-items-center rounded-2xl bg-[#ffd27a]/15 text-sm font-semibold text-[#ffd27a]">Fondatore</span>
              ) : (
                <Select value={p.role} onChange={(e) => void act(updateMember({ data: { memberId: p.id, role: e.target.value } }), `${p.name}: ${ROLE_LABEL[e.target.value] ?? e.target.value}.`)}>
                  {Object.entries(ROLE_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </Select>
              )}
              <Button variant="ghost" onClick={() => void openExternal(whatsappLink(inviteText(p.name.split(" ")[0], p.linked ? "" : p.code)))}>WhatsApp</Button>
              {p.email && p.id !== team.data?.meId ? (
                pw?.id === p.id ? (
                  <div className="col-span-2 grid grid-cols-[1fr_auto] gap-1.5">
                    <TextInput value={pw.value} onChange={(e) => setPw({ id: p.id, value: e.target.value })} placeholder="Nuova password (min 8)" />
                    <Button onClick={() => void act(resetMemberPassword({ data: { email: p.email, password: pw.value } }), `Password di ${p.name} cambiata: comunicagliela.`).then(() => setPw(null))}>Salva</Button>
                  </div>
                ) : (
                  <Button variant="ghost" onClick={() => setPw({ id: p.id, value: "" })}><IconLabel icon="key">Password</IconLabel></Button>
                )
              ) : null}
              {p.id !== team.data?.meId ? (
                <Button
                  variant="ghost"
                  className={sure === p.id ? "!border-rose-500 !bg-rose-600 !text-white" : "!text-rose-300"}
                  onClick={() => {
                    if (sure !== p.id) {
                      setSure(p.id);
                      return;
                    }
                    setSure(null);
                    void act(removeTeamMember({ data: { id: p.id } }), `${p.name} tolto dalla squadra.`);
                  }}
                >
                  {sure === p.id ? "Tocca ancora: elimina" : <IconLabel icon="trash">Togli</IconLabel>}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
