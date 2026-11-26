import { createFileRoute, redirect } from "@tanstack/react-router";

/** Confronta ora sta dentro Sfide: il vecchio indirizzo porta lì. */
export const Route = createFileRoute("/_app/confronta")({
  beforeLoad: () => {
    throw redirect({ to: "/sfide", hash: "confronta" });
  },
});
