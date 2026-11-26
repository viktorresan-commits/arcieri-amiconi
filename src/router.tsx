import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { previewPathRewrite } from "@/lib/preview-path-prefix";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    rewrite: previewPathRewrite(),
    defaultErrorComponent: AppErrorComponent,
    // niente "View Transitions": la foto dell'intero schermo a ogni cambio di pagina faceva scattare i telefoni
    // e muoveva anche le barre fisse; l'ingresso della pagina è già animato dal suo contenuto
    defaultViewTransition: false,
    scrollRestoration: true,
  });
}
