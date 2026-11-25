import { createFileRoute } from "@tanstack/react-router";
import { CompagniaPage } from "./squadra";

export const Route = createFileRoute("/_app/gare")({ component: Page });

/** le gare stanno dentro la Compagnia: questa pagina apre la Compagnia sulla scheda Gare (anche dai link a una gara) */
function Page() {
  return <CompagniaPage initial="gare" />;
}
