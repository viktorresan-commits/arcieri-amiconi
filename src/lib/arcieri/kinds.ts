/**
 * Le tre tipologie di tiro dell'app, sempre distinte: minigioco (il gioco della Home), allenamento
 * (le sessioni registrate) e gara di campionato (le gare del calendario e del portale FITAST).
 * I punti del minigioco non entrano mai nelle medie, nelle statistiche e nei record veri.
 */
import type { InsEnamel, InsMetal, InsShape, InsSymbol } from "@/components/insignia";

export type ActivityKind = "minigioco" | "allenamento" | "campionato";

export type KindInfo = {
  id: ActivityKind;
  /** nome breve (chip, titoli) */
  label: string;
  /** nome lungo */
  long: string;
  /** a cosa serve, in una riga */
  hint: string;
  /** colore del testo e dei bordi */
  color: string;
  /** colore di fondo tenue */
  tint: string;
  /** conta nelle medie e nelle statistiche */
  counts: boolean;
  emblem: { symbol: InsSymbol; metal: InsMetal; enamel: InsEnamel; shape: InsShape; crown?: boolean; laurel?: boolean };
};

export const KINDS: Record<ActivityKind, KindInfo> = {
  campionato: {
    id: "campionato",
    label: "Gara",
    long: "Gara di campionato",
    hint: "Gare del calendario e del portale FITAST: punteggio, posizione, punti campionato.",
    color: "#f1c75a",
    tint: "rgb(196 29 58 / 0.14)",
    counts: true,
    emblem: { symbol: "target", metal: "gold", enamel: "ruby", shape: "shield", crown: true, laurel: true },
  },
  allenamento: {
    id: "allenamento",
    label: "Allenamento",
    long: "Allenamento",
    hint: "Le sessioni registrate: frecce, medie, gruppo, progressi.",
    color: "#6be8a8",
    tint: "rgb(20 144 92 / 0.14)",
    counts: true,
    emblem: { symbol: "quiver", metal: "bronze", enamel: "emerald", shape: "round" },
  },
  minigioco: {
    id: "minigioco",
    label: "Minigioco",
    long: "Minigioco della Home",
    hint: "Il gioco della Home: record e giri, solo per divertimento. Non entra nelle medie vere.",
    color: "#c9a2ff",
    tint: "rgb(125 72 216 / 0.16)",
    counts: false,
    emblem: { symbol: "dice", metal: "silver", enamel: "amethyst", shape: "hex" },
  },
};

export const KIND_ORDER: ActivityKind[] = ["campionato", "allenamento", "minigioco"];

export const kindOf = (v: unknown): ActivityKind => (v === "minigioco" || v === "campionato" ? v : "allenamento");
