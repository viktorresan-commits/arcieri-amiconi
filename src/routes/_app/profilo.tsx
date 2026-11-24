import { useEntryState } from "@/lib/arcieri/back-restore";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { forgetAccount, rememberAccount, savedAccounts, type SavedAccount } from "@/lib/arcieri/accounts";
import { exportMine, listRoster, updateMember } from "@/lib/arcieri/members.api";
import { AvatarPhotoButton } from "@/components/avatar-photo";
import { useAvatar } from "@/components/avatar-hero";
import { listCompetitions, listGadgets } from "@/lib/arcieri/club.api";
import { useLoad } from "@/lib/arcieri/use-load";
import { simplePdf } from "@/lib/arcieri/pdf";
import { BOWS } from "@/lib/arcieri/labels";
import { useMember } from "@/components/shell";
import { Button, Card, ErrorNote, Field, PageHead, Select, TextArea, TextInput } from "@/components/kit";
import { saveFile } from "@/lib/arcieri/native";
import { Trasloco } from "@/components/trasloco";
import { GestureGallery } from "@/components/gesture-gallery";
import { Migrazione } from "@/components/migrazione";
import { PersonalizePanel } from "@/components/personalize";
import { Glyph, IconTitle } from "@/components/icons";
import { unlockAdmin } from "@/lib/arcieri/account.api";
import { ClaimCard, DeleteAccountCard, InviteCard, PrivacyCard, ResetCard, TeamAdmin } from "@/components/profile-tools";

export const Route = createFileRoute("/_app/profilo")({ component: Page });

function Page() {
  const { me, reload } = useMember();
  const avatar = useAvatar();
  const [given, setGiven] = useState(me.givenName);
  const [family, setFamily] = useState(me.familyName);
  const [nick, setNick] = useState(me.nickname);
  const [bow, setBow] = useState(me.bowType);
  const [bio, setBio] = useState(me.bio);
  const [tab, setTab] = useEntryState<string>("profilo-tab", "io");
  useEffect(() => {
    try {
      const t = localStorage.getItem("aa-profilo-tab");
      if (t) setTab(t);
    } catch {
      /* niente */
    }
  }, []);
  const pickTab = (t: string) => {
    setTab(t);
    try {
      localStorage.setItem("aa-profilo-tab", t);
    } catch {
      /* niente */
    }
  };
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

  const prizes = gadgets.data?.prizes ?? [];
  const myPrizes = prizes.filter((p) => p.holders.some((h) => h.userId === me.userId));
  const TABS = [
    { id: "io", label: "Io" },
    { id: "aspetto", label: "Aspetto" },
    { id: "gesti", label: "Gesti" },
    { id: "account", label: "Account" },
    { id: "squadra", label: "Squadra" },
  ] as const;

  return (
    <div className="grid gap-3">
      <section className="aa-hero grid gap-3 p-4">
        <div className="flex items-center gap-3">
          <label className="relative shrink-0 cursor-pointer">
            {me.photoUrl ? <img src={me.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-white/20" /> : <span className="grid h-20 w-20 place-items-center rounded-full bg-white/10 font-display text-3xl">{(me.givenName || "?").slice(0, 1)}</span>}
            <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-fg"><Glyph name="camera" size={14} /></span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void photo(f).catch((err: unknown) => setMsg(err instanceof Error ? err.message : "Foto non salvata")); }} />
          </label>
          <div className="min-w-0">
            <p className="truncate font-display text-3xl leading-none">{[me.givenName, me.familyName].filter(Boolean).join(" ") || me.nickname || "Arciere"}</p>
            <p className="mt-1 truncate text-xs text-white/70">{me.email ?? ""}</p>
            <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${me.role === "admin" ? "bg-amber-400 text-black" : "bg-white/10"}`}>{me.role === "admin" ? "Amministratore" : me.role === "archer" ? "Arciere" : "Ospite"}</span>
          </div>
        </div>
        <AvatarPhotoButton look={avatar.shown} onDone={reload} />
        <div className="grid grid-cols-2 gap-2">
          <span className="rounded-xl bg-black/25 px-3 py-2">
            <span className="block text-[0.6rem] uppercase tracking-wider text-white/60">Punti campionato</span>
            <b className="font-display text-2xl tabular-nums">{comps.loading ? "…" : season}</b>
          </span>
          <a href="/obiettivi" className="rounded-xl bg-black/25 px-3 py-2">
            <span className="block text-[0.6rem] uppercase tracking-wider text-white/60">Premi</span>
            <b className="font-display text-2xl tabular-nums">{myPrizes.length}<span className="text-sm text-white/60"> / {prizes.length}</span></b>
          </a>
        </div>
      </section>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => pickTab(t.id)} className="aa-chip shrink-0">{t.label}</button>
        ))}
      </div>

      <div key={tab} className="aa-rise grid gap-3">
        {tab === "io" ? (
          <Card className="grid gap-3">
            <IconTitle icon="user" color="#5a7bd1" sub="Si salva da solo mentre scrivi.">I tuoi dati</IconTitle>
            <div className="grid gap-3" onChangeCapture={() => { touched.current = true; }}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Nome"><TextInput value={given} onChange={(e) => setGiven(e.target.value)} /></Field>
                <Field label="Cognome"><TextInput value={family} onChange={(e) => setFamily(e.target.value)} /></Field>
              </div>
              <Field label="Soprannome"><TextInput value={nick} onChange={(e) => setNick(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Arco abituale">
                  <Select value={bow} onChange={(e) => setBow(e.target.value)}><option value="">Non indicato</option>{BOWS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
                </Field>
                <Field label="Nel gruppo dal"><TextInput type="date" value={joined} onChange={(e) => setJoined(e.target.value)} /></Field>
              </div>
              <Field label="Note"><TextArea value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
              <p className="text-sm font-semibold">Avvisami per</p>
              <div className="grid grid-cols-2 gap-2">
                {(["notifyBoard", "notifyChallenges", "notifyGoals", "notifyComps"] as const).map((key) => (
                  <label key={key} className="flex min-h-11 items-center gap-2 rounded-xl bg-white/[0.04] px-3 text-sm">
                    <input type="checkbox" checked={flags[key]} onChange={(e) => setFlags({ ...flags, [key]: e.target.checked })} />
                    {key === "notifyBoard" ? "Bacheca" : key === "notifyChallenges" ? "Sfide" : key === "notifyGoals" ? "Medaglie e obiettivi" : "Gare"}
                  </label>
                ))}
              </div>
              {msg ? <ErrorNote text={msg} /> : null}
            </div>
            <p className="text-[0.7rem] text-muted">{autoState === "busy" ? "Salvo…" : autoState === "err" ? "Non salvato: controlla la rete." : ""}</p>
          </Card>
        ) : null}

        {tab === "aspetto" ? (
          <>
          <Link to="/avatar" className="block">
            <Card className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#c46b2b]/20"><Glyph name="archer" size={26} /></span>
              <span className="min-w-0 flex-1">
                <b className="block">Il tuo arciere</b>
                <span className="text-xs text-muted">Viso, capelli, barba, abiti, arco e frecce dell'avatar in Home</span>
              </span>
              <Glyph name="chevron" size={16} />
            </Card>
          </Link>
          <Card className="grid gap-1">
            <IconTitle icon="palette" color="#7652d1" sub="Ogni scelta si salva da sola.">Personalizza</IconTitle>
            <PersonalizePanel />
          </Card>
          </>
        ) : null}

        {tab === "gesti" ? <GestureGallery /> : null}

        {tab === "account" ? (
          <>
            <Card className="grid gap-2">
              <IconTitle icon="user" color="#3f8a76" sub="Più persone sullo stesso telefono">Cambia account</IconTitle>
              {accounts.map((account) => {
                const here = account.email === (me.email ?? "").toLowerCase();
                return (
                  <div key={account.email} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 ${here ? "border-accent" : "border-line"}`}>
                    <button type="button" disabled={here} onClick={() => void switchTo(account.email).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Cambio non riuscito"))} className="min-w-0 flex-1 py-2 text-left disabled:opacity-100">
                      <span className="block font-semibold">{account.name}</span>
                      <span className="block truncate text-xs text-muted">{account.email}</span>
                    </button>
                    <span className="text-sm font-semibold text-accent">{here ? "Dentro" : "Entra"}</span>
                    {here ? null : <button type="button" onClick={() => dropAccount(account.email)} className="text-sm text-muted">Togli</button>}
                  </div>
                );
              })}
              <details className="rounded-xl bg-white/[0.04] p-3">
                <summary className="cursor-pointer text-sm font-semibold">Entra con un altro account</summary>
                <form onSubmit={(event) => void enterAccount(event)} className="mt-2 grid gap-2">
                  <Field label="Email o utente"><TextInput value={enterUser} onChange={(e) => setEnterUser(e.target.value)} required autoComplete="username" placeholder="nome oppure email" /></Field>
                  <Field label="Password"><TextInput type="password" value={enterPass} onChange={(e) => setEnterPass(e.target.value)} required minLength={8} autoComplete="current-password" /></Field>
                  <Button variant="ghost" disabled={entering}>{entering ? "Attendi" : "Entra"}</Button>
                </form>
              </details>
              <details className="rounded-xl bg-white/[0.04] p-3">
                <summary className="cursor-pointer text-sm font-semibold">Crea un nuovo profilo</summary>
                <p className="mt-1 text-xs text-muted">Un profilo creato entra in squadra. Toglierlo da qui lo leva solo da questo telefono: l'account resta.</p>
                <form onSubmit={(event) => void createProfile(event)} className="mt-2 grid gap-2">
                  <Field label="Nome"><TextInput value={newName} onChange={(e) => setNewName(e.target.value)} required autoComplete="name" /></Field>
                  <Field label="Utente"><TextInput value={newUser} onChange={(e) => setNewUser(e.target.value)} required autoComplete="off" placeholder="nome oppure email" /></Field>
                  <Field label="Password"><TextInput type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required minLength={8} autoComplete="new-password" /></Field>
                  <Button disabled={creating}>{creating ? "Attendi" : "Crea profilo"}</Button>
                </form>
              </details>
              {msg ? <p className="text-sm text-muted">{msg}</p> : null}
            </Card>
            <Card className="grid gap-2">
              <IconTitle icon="lock" color="#6c7684">Password</IconTitle>
              <Field label="Password attuale"><TextInput type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
              <Field label="Nuova"><TextInput type="password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
              <Button variant="ghost" onClick={() => authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: false }).then((res) => setMsg(res.error ? res.error.message || "Non cambiata" : "Password cambiata.")).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Errore"))}>Cambia password</Button>
            </Card>
            <Card className="grid gap-2">
              <IconTitle icon="download" color="#2f6fd1" sub="Una copia di tutto quello che hai segnato">I tuoi dati</IconTitle>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => void downloadJson()}>Scarica JSON</Button>
                <Button variant="ghost" onClick={() => void downloadPdf()}>Report PDF</Button>
              </div>
            </Card>
            <Migrazione myEmail={me.email} />
            <PrivacyCard share={me.shareCoach} onDone={reload} />
            <ResetCard onDone={reload} />
            {me.canStaff ? null : (
              <Link to="/staff" className="aa-glow-panel flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-hair p-3.5">
                <span>
                  <b className="block font-display text-xl leading-tight">Codici e incarichi</b>
                  <span className="text-xs text-muted">Hai un codice dello staff o vuoi guidare una compagnia?</span>
                </span>
                <span aria-hidden className="text-muted">›</span>
              </Link>
            )}
            <DeleteAccountCard founder={me.isSuper} />
            <div className="flex justify-center pt-1"><UserButton /></div>
          </>
        ) : null}

        {tab === "squadra" ? (
          <>
            <InviteCard />
            <ClaimCard onDone={reload} />
            <AdminUnlock isAdmin={me.role === "admin"} onDone={reload} />
            <TeamAdmin />
            {me.role === "admin" ? (
              <details className="rounded-2xl border border-hair p-3">
                <summary className="cursor-pointer text-sm font-semibold text-muted">Avanzate: trasloco dell'intero database</summary>
                <div className="mt-2"><Trasloco /></div>
              </details>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Accesso del fondatore con ID e password: gestisce tutte le compagnie e ne nomina i presidenti. */
function AdminUnlock({ isAdmin, onDone }: { isAdmin: boolean; onDone: () => void }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [state, setState] = useState("");
  if (isAdmin) {
    return (
      <Card className="grid gap-1">
        <IconTitle icon="lock" color="#c39320">Fondatore</IconTitle>
        <p className="text-sm text-muted">Sei il fondatore: in Gestione compagnia nomini i presidenti e gestisci tutte le compagnie.</p>
      </Card>
    );
  }
  return (
    <Card className="grid gap-2">
      <IconTitle icon="lock" color="#c39320" sub="Con ID e password del fondatore">Accesso del fondatore</IconTitle>
      <Field label="ID"><TextInput value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" autoCapitalize="none" /></Field>
      <Field label="Password"><TextInput type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></Field>
      <Button
        disabled={state === "busy" || !id || !pw}
        onClick={() => {
          setState("busy");
          unlockAdmin({ data: { id, password: pw } })
            .then(() => { setState("ok"); setPw(""); onDone(); })
            .catch((e: unknown) => setState(e instanceof Error ? e.message : "Non riuscito"));
        }}
      >
        {state === "busy" ? "Controllo…" : "Sblocca"}
      </Button>
      {state && state !== "busy" ? <p className={`text-sm ${state === "ok" ? "text-emerald-300" : "text-danger"}`}>{state === "ok" ? "Fatto: accesso del fondatore attivo." : state}</p> : null}
    </Card>
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
