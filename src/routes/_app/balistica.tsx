import { createFileRoute } from "@tanstack/react-router";
import { FlightSim } from "@/components/flight-sim";
import { FocTool } from "@/components/foc-tool";
import { PageHead } from "@/components/kit";

export const Route = createFileRoute("/_app/balistica")({
  component: Page,
});

function Page() {
  return (
    <div className="grid gap-3">
      <PageHead kicker="Simulatore di volo e FOC" title="Balistica" lede="Imposta arco e freccia, guarda la parabola in tempo reale e scopri dove mirare, anche su un bersaglio in movimento. Sotto, il calcolo del FOC." />
      <FlightSim />
      <FocTool />
    </div>
  );
}
