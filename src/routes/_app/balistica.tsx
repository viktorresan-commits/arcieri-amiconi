import { createFileRoute } from "@tanstack/react-router";
import { FlightSim } from "@/components/flight-sim";
import { PageHead } from "@/components/kit";

export const Route = createFileRoute("/_app/balistica")({
  component: Page,
});

function Page() {
  return (
    <div className="grid gap-3">
      <PageHead kicker="Simulatore di volo" title="Balistica" lede="Imposta arco e freccia, guarda la parabola e scopri dove mirare. Salva le impostazioni da gara o da allenamento." />
      <FlightSim />
    </div>
  );
}
