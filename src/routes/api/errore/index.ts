import { createFileRoute } from "@tanstack/react-router";

/**
 * Segnalazioni dall'app quando non parte: errori del codice nel telefono e stato (profilo ricordato sì/no).
 * Niente dati personali: finisce nei registri del server per capire cosa non va.
 */
export const Route = createFileRoute("/api/errore/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const text = (await request.text().catch(() => "")).slice(0, 4000);
        console.error(`[errore-app] ${text}`);
        return new Response("ok", { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
