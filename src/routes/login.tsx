import { useState, type FormEvent } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useOauthProviders } from "@/lib/auth/use-oauth-providers";
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
  }),
  component: Login,
});

function Login() {
  const { utente, modo } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">(modo);
  const [name, setName] = useState("");
  const providers = useOauthProviders();
  const [email, setEmail] = useState(utente);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
          {error ? <ErrorNote text={error} /> : null}
          <Button disabled={busy || !authEnabled}>{busy ? "Attendi" : mode === "up" ? "Crea account" : "Entra"}</Button>
          {authEnabled ? (
            <div className="grid gap-2">
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
      </div>
    </main>
  );
}
