import { useEffect, useState, type AnimationEvent } from "react";
import { sectionOf, type StationId } from "@/lib/arcieri/shortcuts";

/**
 * Sfondo della sezione: un dipinto dello stesso mondo del campo di tiro in Casa, uno per sezione e nel suo colore
 * (bottega dell'arco, radura di allenamento, banco degli strumenti, studio sul lago, torneo, biblioteca, cortile della compagnia).
 * Le immagini sono già piccole e ammorbidite: il telefono non deve sfocarle mentre apre la pagina.
 * Cambiando sezione il nuovo dipinto compare sopra il vecchio; si muove piano a ciclo (fermo con «movimento ridotto»).
 */
export type SceneId = "home" | StationId;

const FILE: Record<SceneId, string> = {
  home: "casa",
  prepara: "prepara",
  allena: "allena",
  strumenti: "strumenti",
  analizza: "analizza",
  gareggia: "gareggia",
  impara: "impara",
  squadra: "squadra",
};
const url = (id: SceneId) => `/sfondi/${FILE[id]}.webp`;

export function sceneOf(path: string, search?: unknown): SceneId {
  if (path === "/") return "home";
  return sectionOf(path, search) ?? "allena";
}

let preloaded = false;

export function Scene({ path, search }: { path: string; search?: unknown }) {
  const id = sceneOf(path, search);
  const [layers, setLayers] = useState<{ id: SceneId; n: number }[]>(() => [{ id, n: 0 }]);
  useEffect(() => {
    setLayers((cur) => {
      const last = cur[cur.length - 1];
      return last?.id === id ? cur : [last, { id, n: last.n + 1 }];
    });
  }, [id]);
  // gli altri dipinti si scaricano con calma, così il cambio di sezione non resta mai vuoto
  useEffect(() => {
    if (preloaded) return;
    preloaded = true;
    const t = window.setTimeout(() => {
      for (const k of Object.keys(FILE) as SceneId[]) new Image().src = url(k);
    }, 2500);
    return () => window.clearTimeout(t);
  }, []);
  // a dissolvenza finita resta solo il dipinto nuovo
  const done = (e: AnimationEvent<HTMLSpanElement>) => {
    if (e.animationName === "aa-scene-fade") setLayers((cur) => cur.slice(-1));
  };
  return (
    <div aria-hidden className="aa-scene" data-scene={id}>
      {layers.map((l, i) => (
        <span key={l.n} className={i > 0 ? "aa-scene-layer is-new" : "aa-scene-layer"} onAnimationEnd={i > 0 ? done : undefined}>
          <span className="aa-scene-img" style={{ backgroundImage: `url(${url(l.id)})` }} />
        </span>
      ))}
      <span className="aa-scene-motes" />
      <span className="aa-scene-veil" />
    </div>
  );
}
