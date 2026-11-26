import { createFileRoute, redirect } from "@tanstack/react-router";

/** Le storie ora stanno dentro «Il mio mese»: il vecchio indirizzo porta lì, con la stessa scelta. */
export const Route = createFileRoute("/_app/storia")({
  validateSearch: (search: Record<string, unknown>): { con?: string; modo?: "foto" | "video" } => ({
    ...(typeof search.con === "string" && search.con ? { con: search.con } : {}),
    ...(search.modo === "video" || search.modo === "foto" ? { modo: search.modo } : {}),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/riepilogo", search: { vista: search.modo ?? "foto", ...(search.con ? { con: search.con } : {}) } });
  },
});
