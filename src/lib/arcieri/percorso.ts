/**
 * Percorso del primo accesso: chi entra da ora sceglie come tira e vede prima le funzioni
 * che gli servono. Chi c'era già ("esistente") non è toccato da queste regole.
 */
export type Percorso = "principiante" | "compagnia" | "istruttore";

export const PERCORSI: { id: Percorso; title: string; text: string; color: string; focus: string[] }[] = [
  {
    id: "principiante",
    title: "Ho appena iniziato",
    text: "Lezioni brevi, il primo arco, il tiro guidato",
    color: "#e0b23a",
    focus: ["lezioni", "rapido", "foto", "storico", "sfida-giorno", "avatar"],
  },
  {
    id: "compagnia",
    title: "Tiro in compagnia",
    text: "Allenamenti, gare, sfide con il gruppo",
    color: "#7cf0a8",
    focus: ["rapido", "foto", "storico", "gare", "classifiche", "avatar"],
  },
  {
    id: "istruttore",
    title: "Seguo altri arcieri",
    text: "Istruttore: atleti e presenze, quando ti nominano",
    color: "#8cc3f0",
    focus: ["istruttore", "segnapunti", "lezioni", "statistiche", "gare", "calendario"],
  },
];

export function percorsoOf(id: string | null | undefined) {
  return PERCORSI.find((p) => p.id === id) ?? null;
}

const ALL_KEY = "aa-menu-tutto";

/** il Menu completo l'ha già aperto a mano? */
export function menuAllOpen() {
  try {
    return localStorage.getItem(ALL_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMenuAllOpen(on: boolean) {
  try {
    if (on) localStorage.setItem(ALL_KEY, "1");
    else localStorage.removeItem(ALL_KEY);
  } catch {
    /* memoria non disponibile */
  }
}
