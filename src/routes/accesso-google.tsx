import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";

/**
 * Passaggio per l'app Android: si apre nel browser del telefono, fa l'accesso con Google
 * e rimanda all'app con un gettone monouso (valido pochi minuti) che l'app scambia con la sessione.
 */
export const Route = createFileRoute("/accesso-google")({ component: Page });

const APP_LINK = "arcieriamiconi://accesso";

function Page() {
  const [link, setLink] = useState("");
  const [note, setNote] = useState("Un momento…");

  useEffect(() => {
    let dead = false;
    (async () => {
      if (new URLSearchParams(window.location.search).get("error")) {
        setNote("Google non ha completato l'accesso. Torna all'app ed entra con utente e password.");
        setLink(APP_LINK);
        return;
      }
      const session = await authClient.getSession().catch(() => null);
      if (dead) return;
      if (!session?.data?.user) {
        setNote("Apro Google…");
        const res = await authClient.signIn.social({ provider: "google", callbackURL: "/accesso-google", errorCallbackURL: "/accesso-google" });
        if (res?.error) setNote(res.error.message || "Accesso con Google non riuscito.");
        return;
      }
      const res = await fetch("/api/auth/one-time-token/generate", { credentials: "include" });
      const body = (await res.json().catch(() => null)) as { token?: string } | null;
      if (!res.ok || !body?.token) {
        setNote("Non riesco a preparare il ritorno all'app. Riprova.");
        return;
      }
      const target = `${APP_LINK}?ott=${encodeURIComponent(body.token)}`;
      setLink(target);
      setNote("Fatto. Torno all'app…");
      window.location.href = target;
    })();
    return () => {
      dead = true;
    };
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-[#0c1210] px-6 text-center text-[#f3f0e8]">
      <div className="grid gap-4">
        <p className="text-2xl font-semibold">Arcieri Amiconi</p>
        <p>{note}</p>
        {link ? (
          <a href={link} className="rounded-full border border-[#c6a15a] px-5 py-3">Torna all'app</a>
        ) : null}
      </div>
    </main>
  );
}
