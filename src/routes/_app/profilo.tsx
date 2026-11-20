import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { forgetAccount, rememberAccount, savedAccounts, type SavedAccount } from "@/lib/arcieri/accounts";
import { exportMine, listRoster, updateMember } from "@/lib/arcieri/members.api";
import { listCompetitions, listGadgets } from "@/lib/arcieri/club.api";
import { useLoad } from "@/lib/arcieri/use-load";
import { simplePdf } from "@/lib/arcieri/pdf";
import { BOWS } from "@/lib/arcieri/labels";
import { useMember } from "@/components/shell";
import { Button, Card, ErrorNote, Field, PageHead, Select, TextArea, TextInput } from "@/components/kit";
import { PrizeMark, prizeTier } from "@/components/prize-mark";
import { saveFile } from "@/lib/arcieri/native";
import { Trasloco } from "@/components/trasloco";
import { GestureGallery } from "@/components/gesture-gallery";
import { Migrazione } from "@/components/migrazione";
import { PersonalizePanel } from "@/components/personalize";
import { IconTitle } from "@/components/icons";
import { ClaimCard, InviteCard, ResetCard, TeamAdmin } from "@/components/profile-tools";

export const Route = createFileRoute("/_app/profilo")({ component: Page });

function Page() {
  const { me, reload } = useMember();
  const [given, setGiven] = useState(me.givenName);
  const [family, setFamily] = useState(me.familyName);
  const [nick, setNick] = useState(me.nickname);
  const [bow, setBow] = useState(me.bowType);
  const [bio, setBio] = useState(me.bio);
  const [joined, setJoined] = useState(me.joinedOn);
  const [msg, setMsg] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [flags, setFlags] = useState({
    notifyBoard: me.notifyBoard,
    notifyChallenges: me.notifyChallenges,
    notifyGoals: me.notifyGoals,
    notifyComps: me.notifyComps,
  });
  const comps = useLoad("profile-comps", () => listCompetitions());
  const gadgets = useLoad("profile-gadgets", () => listGadgets());
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [newName, setNewName] = useState("");
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [creating, setCreating] = useState(false);
  const [enterUser, setEnterUser] = useState("");
  const [enterPass, setEnterPass] = useState("");
  const [entering, setEntering] = useState(false);
  const season = (comps.data?.competitions ?? []).reduce((sum, comp) => {
    const mine = comp.entries.find((entry) => entry.userId === me.userId);
    return sum + (mine?.championshipPoints ?? 0);
  }, 0);

  useEffect(() => {
    setGiven(me.givenName);
    setFamily(me.familyName);
    setNick(me.nickname);
    if (me.email) rememberAccount({ email: me.email, name: me.nickname || me.givenName || me.familyName || me.email });
    setAccounts(savedAccounts());
  }, [me.email, me.nickname, me.familyName, me.givenName]);

  async function switchTo(email: string) {
    const { signOut } = await import("@/lib/auth/client");
    await signOut(`/login?utente=${encodeURIComponent(email)}`);
  }

  // salvataggio automatico: poco dopo l'ultima modifica, senza pulsanti né messaggi
  const touched = useRef(false);
  const [autoState, setAutoState] = useState<"" | "busy" | "err">("");
  useEffect(() => {
    if (!touched.current) return;
    const t = window.setTimeout(() => {
      setAutoState("busy");
      saveProfile()
        .then(() => setAutoState(""))
        .catch(() => setAutoState("err"));
    }, 900);
    return () => window.clearTimeout(t);
  }, [given, family, nick, bow, bio, joined, flags]);

  async function saveProfile() {
    await updateMember({ data: { givenName: given, familyName: family, nickname: nick, bowType: bow, bio, joinedOn: joined, ...flags } });
    const shown = nick.trim() || given.trim() || family.trim() || me.email || "";
    if (me.email) rememberAccount({ email: me.email, name: shown });
    await authClient.updateUser({ name: given.trim() || shown }).catch(() => undefined);
    setAccounts(savedAccounts());
    touched.current = false;
    reload();
  }

  async function createProfile(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setMsg("");
    try {
      const emailValue = accountEmail(newUser);
      const res = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: emailValue, password: newPass, name: newName.trim() || newUser.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message || "Profilo non creato");
      rememberAccount({ email: emailValue, name: newName.trim() || newUser.trim() });
      await listRoster();
      setAccounts(savedAccounts());
      setNewName("");
      setNewUser("");
      setNewPass("");
      setMsg("Profilo creato. È in squadra. Da un altro dispositivo entra con lo stesso utente e la stessa password.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Profilo non creato");
    } finally {
      setCreating(false);
    }
  }

  function dropAccount(email: string) {
    forgetAccount(email);
    setAccounts(savedAccounts());
    setMsg("Tolto da questo telefono. L'account resta: si può entrare da un altro dispositivo.");
  }

  async function enterAccount(event: FormEvent) {
    event.preventDefault();
    setEntering(true);
    setMsg("");
    try {
      const emailValue = accountEmail(enterUser);
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: emailValue, password: enterPass }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string; user?: { name?: string; email?: string } };
      if (!res.ok) throw new Error(body.message || "Email o password non valide");
      rememberAccount({ email: emailValue, name: body.user?.name?.trim() || enterUser.trim() });
      await listRoster();
      setAccounts(savedAccounts());
      setEnterUser("");
      setEnterPass("");
      setMsg("Account aggiunto. Resta quello di adesso: per cambiare usa Entra nella lista.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Accesso non riuscito");
    } finally {
      setEntering(false);
    }
  }

  async function photo(file: File) {
    const data = await compress(file);
    await updateMember({ data: { photoUrl: data } });
    reload();
  }

  return (
    <div className="grid gap-3">
      <PageHead title="Profilo" lede={me.email ?? ""} />
      <Card>
        <p className="text-xs uppercase tracking-wide text-muted">Punti campionato</p>
        <p className="font-display text-5xl tabular-nums leading-none">{comps.loading ? "…" : season}</p>
        <p className="mt-2 text-sm text-muted">Somma dei punti campionato segnati sulle gare. Non è il punteggio di una singola giornata.</p>
      </Card>
      <Card>
        <h2 className="mb-1 font-display text-2xl">Premi</h2>
        <p className="mb-3 text-sm text-muted">Stesso simbolo, poi il metallo. Una stella, due, tre: alla quarta si passa ad argento, poi oro, poi platino.</p>
        <div className="grid grid-cols-2 gap-2">
          {(gadgets.data?.prizes ?? []).map((prize) => {
            const mine = prize.holders.some((holder) => holder.userId === me.userId);
            return (
              <div key={prize.code} className={`flex items-center gap-2 rounded-xl border p-2 ${mine ? "border-accent" : "border-line opacity-60"}`}>
                <PrizeMark code={prize.code} locked={!mine} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{prize.title}</p>
                  <p className="text-[11px] text-muted">{[prizeTier(prize.code).label, mine ? "sbloccato" : prize.hint].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="grid gap-3">
        <div className="grid gap-3" onChangeCapture={() => { touched.current = true; }}>
        {me.photoUrl ? <img src={me.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover" /> : null}
        <Field label="Foto"><TextInput type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void photo(f).catch((err: unknown) => setMsg(err instanceof Error ? err.message : "Foto non salvata")); }} /></Field>
        <Field label="Nome"><TextInput value={given} onChange={(e) => setGiven(e.target.value)} /></Field>
        <Field label="Cognome"><TextInput value={family} onChange={(e) => setFamily(e.target.value)} /></Field>
        <Field label="Soprannome"><TextInput value={nick} onChange={(e) => setNick(e.target.value)} /></Field>
        <Field label="Arco abituale">
          <Select value={bow} onChange={(e) => setBow(e.target.value)}><option value="">Non indicato</option>{BOWS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
        </Field>
        <Field label="Nel gruppo dal"><TextInput type="date" value={joined} onChange={(e) => setJoined(e.target.value)} /></Field>
        <Field label="Note"><TextArea value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
        {(["notifyBoard", "notifyChallenges", "notifyGoals", "notifyComps"] as const).map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flags[key]} onChange={(e) => setFlags({ ...flags, [key]: e.target.checked })} />
            {key === "notifyBoard" ? "Bacheca" : key === "notifyChallenges" ? "Sfide" : key === "notifyGoals" ? "Medaglie e obiettivi" : "Gare"}
          </label>
        ))}
        {msg ? <ErrorNote text={msg} /> : null}
        </div>
        <p className="text-[0.7rem] text-muted">{autoState === "busy" ? "…" : autoState === "err" ? "Non salvato: controlla la rete." : ""}</p>
      </Card>
      <Card className="grid gap-2">
        <h2 className="font-display text-2xl">Password</h2>
        <Field label="Password attuale"><TextInput type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        <Field label="Nuova"><TextInput type="password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <Button variant="ghost" onClick={() => authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: false }).then((res) => setMsg(res.error ? res.error.message || "Non cambiata" : "Password cambiata.")).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Errore"))}>Cambia password</Button>
      </Card>
      <Card className="grid gap-2">
        <h2 className="font-display text-2xl">I tuoi dati</h2>
        <Button variant="ghost" onClick={() => void downloadJson()}>Scarica JSON</Button>
        <Button variant="ghost" onClick={() => void downloadPdf()}>Scarica report PDF</Button>
        <div className="pt-2"><UserButton /></div>
      </Card>
      <Card className="grid gap-1">
        <IconTitle icon="palette" color="#7652d1" sub="Ogni scelta si salva da sola.">Personalizza</IconTitle>
        <PersonalizePanel />
      </Card>
      <Migrazione myEmail={me.email} />
      <InviteCard />
      <ClaimCard onDone={reload} />
      <GestureGallery />
      <TeamAdmin />
      <ResetCard onDone={reload} />
      {me.role === "admin" ? (
        <details className="rounded-2xl border border-hair p-3">
          <summary className="cursor-pointer text-sm font-semibold text-muted">Avanzate: trasloco dell'intero database (amministratore)</summary>
          <div className="mt-2"><Trasloco /></div>
        </details>
      ) : null}
      <Card className="grid gap-2">
        <h2 className="font-display text-2xl">Profili</h2>
        <p className="text-sm text-muted">Un profilo creato entra in squadra. Toglierlo da qui lo leva solo da questo telefono: l'account resta.</p>
        <form onSubmit={(event) => void createProfile(event)} className="grid gap-2">
          <Field label="Nome"><TextInput value={newName} onChange={(e) => setNewName(e.target.value)} required autoComplete="name" /></Field>
          <Field label="Utente"><TextInput value={newUser} onChange={(e) => setNewUser(e.target.value)} required autoComplete="off" placeholder="nome oppure email" /></Field>
          <Field label="Password"><TextInput type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required minLength={8} autoComplete="new-password" /></Field>
          <Button disabled={creating}>{creating ? "Attendi" : "Crea profilo"}</Button>
        </form>
        {accounts.map((account) => {
          const here = account.email === (me.email ?? "").toLowerCase();
          return (
            <div key={account.email} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 ${here ? "border-accent" : "border-line"}`}>
              <button type="button" disabled={here} onClick={() => void switchTo(account.email).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Cambio non riuscito"))} className="min-w-0 flex-1 py-2 text-left disabled:opacity-100">
                <span className="block font-semibold">{account.name}</span>
                <span className="block truncate text-xs text-muted">{account.email}</span>
              </button>
              <span className="text-sm font-semibold text-accent">{here ? "Dentro" : "Entra"}</span>
              {here ? null : (
                <button type="button" onClick={() => dropAccount(account.email)} className="text-sm text-muted">Togli</button>
              )}
            </div>
          );
        })}
        <form onSubmit={(event) => void enterAccount(event)} className="mt-2 grid gap-2 border-t border-line pt-3">
          <p className="text-sm text-muted">Entra con un account già esistente e aggiungilo a questo telefono.</p>
          <Field label="Email o utente"><TextInput value={enterUser} onChange={(e) => setEnterUser(e.target.value)} required autoComplete="username" placeholder="nome oppure email" /></Field>
          <Field label="Password"><TextInput type="password" value={enterPass} onChange={(e) => setEnterPass(e.target.value)} required minLength={8} autoComplete="current-password" /></Field>
          <Button variant="ghost" disabled={entering}>{entering ? "Attendi" : "Entra"}</Button>
        </form>
        {msg ? <p className="text-sm text-muted">{msg}</p> : null}
      </Card>
    </div>
  );
}

function accountEmail(user: string) {
  const raw = user.trim();
  if (raw.includes("@")) return raw.toLowerCase();
  const slug = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/^\.|\.$/g, "");
  if (slug.length < 3) throw new Error("Il nome utente deve avere almeno 3 lettere o numeri.");
  return `${slug}@squadra.amiconi.it`;
}

async function downloadJson() {
  const packed = await exportMine();
  await saveFile(new Blob([packed.json], { type: "application/json" }), "arcieri-amiconi.json");
}

async function downloadPdf() {
  const packed = await exportMine();
  const data = JSON.parse(packed.json) as {
    profile: { givenName: string; familyName: string };
    sessions: Array<Record<string, unknown>>;
  };
  const sessions = data.sessions ?? [];
  const lines = ["Report personale Arcieri Amiconi", `Profilo: ${data.profile.givenName} ${data.profile.familyName}`, ""];
  for (const s of sessions) {
    lines.push(`${String(s.started_at ?? "").slice(0, 16)}  ${s.distance_m} m  ${s.bow_type}  ${s.place ?? ""}`);
  }
  if (!sessions.length) lines.push("Nessun allenamento esportato.");
  const bytes = simplePdf("Arcieri Amiconi", lines);
  await saveFile(new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }), "arcieri-amiconi.pdf");
}

function compress(file: File) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 480 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas non disponibile"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => reject(new Error("Immagine non letta"));
    img.src = URL.createObjectURL(file);
  });
}
