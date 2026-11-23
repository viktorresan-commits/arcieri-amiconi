/** Bersagli e livelli del gioco della Home: usati dal gioco, dal record sul server e dal profilo. */

export type GameMode = "fita" | "field" | "sagome";
export type GameLevel = "facile" | "normale" | "esperto";

export const GAME_STATIONS = 20;

export const GAME_MODES: { id: GameMode; label: string; hint: string; perArrow: number }[] = [
  { id: "fita", label: "Bersaglio", hint: "10 anelli, X al centro", perArrow: 10 },
  { id: "field", label: "Field", hint: "giallo e nero, da 6 a 1", perArrow: 6 },
  { id: "sagome", label: "Sagome", hint: "animali: 8 vitale, 5 corpo, 0 fuori", perArrow: 8 },
];

export const GAME_LEVELS: {
  id: GameLevel;
  label: string;
  hint: string;
  distances: number[];
  /** vento massimo in m/s */
  wind: number;
  /** quanto si muove il bersaglio (0 = fermo) */
  motion: number;
  /** quanto trema la mira */
  sway: number;
}[] = [
  { id: "facile", label: "Facile", hint: "da 18 a 30 m, bersaglio fermo, poco vento", distances: [18, 25, 30], wind: 1.2, motion: 0, sway: 0.7 },
  { id: "normale", label: "Normale", hint: "da 18 a 70 m, bersaglio che scorre", distances: [18, 25, 30, 40, 50, 60, 70], wind: 3, motion: 1, sway: 1 },
  { id: "esperto", label: "Esperto", hint: "da 40 a 90 m, vento forte, carrello veloce", distances: [40, 50, 60, 70, 90], wind: 4.5, motion: 1.45, sway: 1.35 },
];

export const modeOf = (id: string) => GAME_MODES.find((m) => m.id === id) ?? GAME_MODES[0];
export const levelOf = (id: string) => GAME_LEVELS.find((l) => l.id === id) ?? GAME_LEVELS[1];
export const maxRound = (mode: string) => modeOf(mode).perArrow * 3 * GAME_STATIONS;
