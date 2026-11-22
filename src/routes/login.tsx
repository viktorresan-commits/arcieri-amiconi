import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useOauthProviders } from "@/lib/auth/use-oauth-providers";
import { loginOptions } from "@/lib/auth/login-options";
import { googleViaBrowser, isNativeApp } from "@/lib/arcieri/native";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { rememberAccount } from "@/lib/arcieri/accounts";
import { Button, ErrorNote, Field, Mark, TextInput } from "@/components/kit";

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

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    utente: typeof search.utente === "string" ? search.utente : "",
    modo: search.modo === "up" ? "up" as const : "in" as const,
    error: typeof search.error === "string" ? search.error : "",
  }),
  component: Login,
});

function Login() {
  const { utente, modo, error: oauthError } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">(modo);
  const [name, setName] = useState("");
  const providers = useOauthProviders();
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    loginOptions().then((o) => setGoogle(o.google)).catch(() => setGoogle(false));
  }, []);
  async function withGoogle() {
    setError("");
    // nell'app Android Google non accetta l'accesso dentro l'app: si passa dal browser del telefono
    if (isNativeApp()) {
      const ok = await googleViaBrowser();
      if (!ok) setError("Non riesco ad aprire il browser per Google.");
      return;
    }
    const res = await authClient.signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL: "/login" });
    if (res?.error) setError(res.error.message || "Accesso con Google non riuscito");
  }
  const [email, setEmail] = useState(utente);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    oauthError ? googleErrorText(oauthError) : "",
  );
  const [busy, setBusy] = useState(false);

  if (isPending) return <main className="grid min-h-dvh place-items-center text-sm text-muted">Caricamento…</main>;
  if (user) return <Navigate to="/" />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "up") {
        const emailValue = accountEmail(email);
        const res = await authClient.signUp.email({ email: emailValue, password, name: name.trim() || email.trim() });
        if (res.error) throw new Error(res.error.message || "Registrazione non riuscita");
        rememberAccount({ email: emailValue, name: name.trim() || email.trim() });
      } else {
        const emailValue = accountEmail(email);
        const res = await authClient.signIn.email({ email: emailValue, password });
        if (res.error) throw new Error(res.error.message || "Accesso non riuscito");
        rememberAccount({ email: emailValue, name: email.trim() });
      }
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accesso non riuscito");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <Mark className="h-12 w-12" />
          <div>
            <p className="font-display text-4xl leading-none">ARCIERI AMICONI</p>
            <p className="text-sm text-muted">Il quaderno del gruppo</p>
          </div>
        </div>
        <form onSubmit={(e) => void submit(e)} className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <div className="grid grid-cols-2 gap-2">
            {(["in", "up"] as const).map((key) => (
              <button key={key} type="button" onClick={() => setMode(key)} className={`min-h-11 rounded-xl text-sm font-semibold ${mode === key ? "bg-primary text-primary-fg" : "border border-line"}`}>
                {key === "in" ? "Entra" : "Registrati"}
              </button>
            ))}
          </div>
          {mode === "up" ? (
            <Field label="Nome">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </Field>
          ) : null}
          <Field label="Utente">
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" placeholder="Il tuo nome" />
          </Field>
          <Field label="Password">
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "up" ? "new-password" : "current-password"} />
          </Field>
          <p className="text-xs text-muted">Utente e password bastano, anche dall'app installata. Appena entri sei in squadra e nelle statistiche. Se hai già un'email, puoi usarla al posto del nome.</p>
          {mode === "up" ? <p className="text-xs text-muted">Creando l'account accetti l'<a href="/privacy" className="font-semibold underline">informativa sulla privacy</a>. Sotto i 14 anni serve un genitore.</p> : null}
          {error ? <ErrorNote text={error} /> : null}
          <Button disabled={busy || !authEnabled}>{busy ? "Attendi" : mode === "up" ? "Crea account" : "Entra"}</Button>
          {authEnabled ? (
            <div className="grid gap-2">
              {google ? (
                <Button type="button" variant="ghost" onClick={() => void withGoogle()}>
                  <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-white text-sm font-bold text-[#4285f4]">G</span>
                  Continua con Google
                </Button>
              ) : null}
              {providers.map((p) => (
                <Button key={p.providerId} type="button" variant="ghost" onClick={() => signIn(p.providerId, { callbackURL: "/" })}>
                  Continua con {p.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Accesso disattivato.</p>
          )}
        </form>
        <a href="/privacy" className="text-center text-xs text-muted underline">Informativa sulla privacy</a>
      </div>
    </main>
  );
}

/** Spiega il codice d'errore che torna da Google o dal server di accesso. */
function googleErrorText(code: string) {
  const c = code.toLowerCase();
  const tail = ` (codice: ${code}). Intanto entra con utente e password.`;
  if (c.includes("account_not_linked")) return `Esiste già un account con la stessa email: entra con utente e password e collega Google dal Profilo${tail}`;
  if (c.includes("state") || c.includes("please_restart")) return `L'accesso è scaduto o è partito da un altro indirizzo del sito: riprova da arcieri-amiconi.vercel.app${tail}`;
  if (c.includes("access_denied")) return `Hai annullato la scelta dell'account Google${tail}`;
  if (c.includes("invalid_code") || c.includes("invalid_client") || c.includes("unable_to_get")) return `Google ha rifiutato le chiavi del sito: controlla che GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET su Vercel siano dello stesso client e che dopo la modifica ci sia stata una nuova pubblicazione${tail}`;
  return `Google non ha completato l'accesso${tail}`;
}
