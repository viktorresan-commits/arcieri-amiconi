import { useEffect, useState } from "react";

/**
 * Tutte le azioni dell'app raggiungibili in un tocco: Home, pulsante ＋ e Menu usano questo elenco,
 * così ogni percorso è lo stesso ovunque e l'utente sceglie quali tenere in vista.
 */
export type Shortcut = {
  id: string;
  label: string;
  hint: string;
  emoji: string;
  color: string;
  to: string;
  search?: Record<string, string>;
  hash?: string;
};

export const SHORTCUTS: Shortcut[] = [
  { id: "rapido", label: "Tiro rapido", hint: "Riparte come l'ultima volta", emoji: "⚡", color: "#e0b15a", to: "/allenamento", search: { avvia: "rapido" } },
  { id: "foto", label: "Volée da foto", hint: "Fotografa il bersaglio", emoji: "📷", color: "#5aa6e8", to: "/allenamento", search: { avvia: "foto" } },
  { id: "nuovo", label: "Allenamento", hint: "Scegli obiettivo e frecce", emoji: "🏹", color: "#3d8f5f", to: "/allenamento" },
  { id: "gesto", label: "Analisi gesto", hint: "Video con scheletro", emoji: "🎥", color: "#c4a2f2", to: "/allenamento", search: { avvia: "gesto" } },
  { id: "fatto", label: "Già fatto", hint: "Segna un tiro passato", emoji: "📝", color: "#9dbea4", to: "/allenamento", search: { avvia: "fatto" } },
  { id: "storico", label: "Storico", hint: "Tutti i tuoi allenamenti", emoji: "🗂️", color: "#8fa3b8", to: "/allenamento", search: { vista: "storico" } },
  { id: "gare", label: "Gare", hint: "Iscrizioni e risultati", emoji: "🏆", color: "#f2c94c", to: "/gare" },
  { id: "statistiche", label: "Statistiche", hint: "Grafici e progressi", emoji: "📈", color: "#5ad1c8", to: "/statistiche" },
  { id: "balistica", label: "Balistica", hint: "Simulatore di volo", emoji: "🎯", color: "#e07a72", to: "/balistica" },
  { id: "attrezzatura", label: "Attrezzatura", hint: "Archi, frecce, assetti", emoji: "🧰", color: "#b08a5a", to: "/attrezzatura" },
  { id: "squadra", label: "Squadra", hint: "Compagni e podi", emoji: "👥", color: "#7aa452", to: "/squadra" },
  { id: "calendario", label: "Calendario", hint: "Uscite in programma", emoji: "📅", color: "#6c8cff", to: "/calendario" },
  { id: "classifiche", label: "Classifiche", hint: "Chi è davanti", emoji: "🥇", color: "#ffb84d", to: "/classifiche" },
  { id: "sfide", label: "Sfide", hint: "Sfida i compagni", emoji: "⚔️", color: "#ff7a7a", to: "/sfide" },
  { id: "obiettivi", label: "Obiettivi", hint: "I tuoi traguardi", emoji: "🚩", color: "#7cf0a8", to: "/obiettivi" },
  { id: "bacheca", label: "Bacheca", hint: "News del gruppo", emoji: "📣", color: "#ff9fd0", to: "/bacheca" },
  { id: "confronta", label: "Confronta", hint: "Tu contro un compagno", emoji: "⚖️", color: "#a3b8ff", to: "/confronta" },
  { id: "gioco", label: "Giochiamo", hint: "Mini giochi di tiro", emoji: "🎮", color: "#ffd166", to: "/gioco" },
  { id: "acquisti", label: "Acquisti", hint: "Lista della spesa", emoji: "🛒", color: "#c9a46a", to: "/acquisti" },
  { id: "profilo", label: "Profilo", hint: "Dati, import, impostazioni", emoji: "🙂", color: "#d6d0c4", to: "/profilo" },
];

export const DEFAULT_PINNED = ["rapido", "foto", "gesto", "statistiche", "balistica", "gare", "attrezzatura", "squadra"];
export const QUICK_ACTIONS = ["rapido", "foto", "nuovo", "gesto", "fatto", "gare"];

const KEY = "aa-shortcuts-v1";
const EVENT = "aa-shortcuts";

export function shortcutById(id: string) {
  return SHORTCUTS.find((s) => s.id === id);
}

function readPinned(): string[] {
  if (typeof localStorage === "undefined") return DEFAULT_PINNED;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as unknown;
    if (Array.isArray(raw)) {
      const ids = raw.filter((x): x is string => typeof x === "string" && !!shortcutById(x));
      if (ids.length) return ids;
    }
  } catch {
    /* valore rovinato: si torna ai predefiniti */
  }
  return DEFAULT_PINNED;
}

/** Scorciatoie scelte dall'utente, salvate sul telefono e condivise fra le schermate aperte. */
export function usePinned() {
  const [pinned, setPinned] = useState<string[]>(DEFAULT_PINNED);
  useEffect(() => {
    setPinned(readPinned());
    const sync = () => setPinned(readPinned());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const save = (next: string[]) => {
    setPinned(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* memoria non disponibile */
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return {
    pinned,
    toggle: (id: string) => save(pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id]),
    move: (id: string, dir: -1 | 1) => {
      const i = pinned.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= pinned.length) return;
      const next = [...pinned];
      [next[i], next[j]] = [next[j], next[i]];
      save(next);
    },
    reset: () => save(DEFAULT_PINNED),
  };
}

/** Piccoli consigli di tiro e trucchi dell'app, a rotazione. */
export const TIPS = [
  { emoji: "⚡", text: "«Tiro rapido» riparte con gli stessi bersaglio, distanza e frecce dell'ultima volta: un tocco e sei in linea." },
  { emoji: "📷", text: "Fotografa il bersaglio dopo ogni volée: con «Più foto insieme» le volée si contano da sole." },
  { emoji: "✋", text: "Sulla foto, due dita spostano e ingrandiscono il padiglione; tieni premuto su una freccia per cambiarle numero." },
  { emoji: "🎯", text: "In Balistica, il mirino verde «MIRA QUI» ti dice dove puntare per portare il gruppo sull'oro." },
  { emoji: "🫁", text: "Respira prima di aprire: espira a metà trazione e trattieni in ancoraggio, senza forzare." },
  { emoji: "🦴", text: "Spalla dell'arco bassa e scapole che si chiudono: è la schiena che tira, non il braccio." },
  { emoji: "⏱️", text: "Un ancoraggio costante dura 2–4 secondi: oltre, il gesto si scompone. L'analisi del gesto lo misura." },
  { emoji: "🎨", text: "In Attrezzatura personalizzi colore asta, penne, indice e punta: le frecce in Home cambiano con te." },
  { emoji: "📌", text: "Tocca ✎ in Home per scegliere le tue scorciatoie: solo quelle che usi davvero." },
  { emoji: "🌬️", text: "Col vento laterale mira contro vento, non correggere il mirino a ogni raffica: aspetta la calma." },
  { emoji: "🧘", text: "Dopo il rilascio resta fermo e guarda la freccia arrivare: il «follow-through» stabilizza il gruppo." },
  { emoji: "📈", text: "In Statistiche il calendario a quadretti mostra la tua costanza: meglio poco ma spesso." },
];
