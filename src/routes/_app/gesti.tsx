import { createFileRoute } from "@tanstack/react-router";
import { GestureHub } from "@/components/gesture-hub";

export const Route = createFileRoute("/_app/gesti")({ component: Page });

/** Storico del gesto: ora è una scheda dell'analisi del gesto (qui si apre già sullo storico). */
function Page() {
  return <GestureHub initial="storico" />;
}
