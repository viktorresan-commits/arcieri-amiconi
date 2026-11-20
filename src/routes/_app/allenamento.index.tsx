import { createFileRoute } from "@tanstack/react-router";
import { LiveTraining } from "@/components/live-training";

export const Route = createFileRoute("/_app/allenamento/")({
  validateSearch: (search: Record<string, unknown>): { id?: number; vista?: "storico"; avvia?: "rapido" | "foto" | "gesto" | "fatto" } => {
    const raw = search.id;
    const id = typeof raw === "number" ? raw : typeof raw === "string" && raw !== "" ? Number(raw) : undefined;
    return {
      ...(id != null && Number.isFinite(id) ? { id } : {}),
      ...(search.vista === "storico" ? { vista: "storico" as const } : {}),
      ...(search.avvia === "rapido" || search.avvia === "foto" || search.avvia === "gesto" || search.avvia === "fatto" ? { avvia: search.avvia } : {}),
    };
  },
  component: Page,
});

function Page() {
  const { id, vista, avvia } = Route.useSearch();
  return <LiveTraining key={`${id ?? ""}-${vista ?? ""}-${avvia ?? ""}`} sessionId={id} openHistory={vista === "storico"} start={avvia} />;
}
