import { createFileRoute, redirect } from "@tanstack/react-router";

/** Il calcolo FOC ora sta dentro Balistica: il vecchio indirizzo porta lì. */
export const Route = createFileRoute("/_app/foc")({
  beforeLoad: () => {
    throw redirect({ to: "/balistica", hash: "foc" });
  },
});
