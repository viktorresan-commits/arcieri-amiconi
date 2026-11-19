import { createServerFn } from "@tanstack/react-start";

/** Cosa mostrare nella pagina di accesso (senza dati personali). */
export const loginOptions = createServerFn({ method: "GET" }).handler(async () => {
  const { googleLogin } = await import("./server");
  return { google: googleLogin };
});
