import { createFileRoute } from "@tanstack/react-router";
import { LiveTraining } from "@/components/live-training";

export const Route = createFileRoute("/_app/allenamento/")({
  validateSearch: (search: Record<string, unknown>): { id?: number; vista?: "storico" } => {
    const raw = search.id;
    const id = typeof raw === "number" ? raw : typeof raw === "string" && raw !== "" ? Number(raw) : undefined;
    return {
      ...(id != null && Number.isFinite(id) ? { id } : {}),
      ...(search.vista === "storico" ? { vista: "storico" as const } : {}),
    };
  },
  component: Page,
});

function Page() {
  const { id, vista } = Route.useSearch();
  return <LiveTraining sessionId={id} openHistory={vista === "storico"} />;
}
