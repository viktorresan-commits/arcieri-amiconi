import { createFileRoute } from "@tanstack/react-router";
import { ToolArt } from "@/components/tool-art";
import { PageHead } from "@/components/kit";
import { AllUnits } from "@/components/unit-converter";

export const Route = createFileRoute("/_app/unita")({ component: Page });

/** il contenuto della pagina, anche dentro un'altra pagina (senza intestazione) */
export function ConvertitoreBody({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className="grid gap-3">
      {embedded ? null : <PageHead kicker="Impara" title="Convertitore" lede="Scrivi in una delle due caselle." />}
      <ToolArt id="unita" />
      <AllUnits />
    </div>
  );
}

function Page() {
  return <ConvertitoreBody />;
}
