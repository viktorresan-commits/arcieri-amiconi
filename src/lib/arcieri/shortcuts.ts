import { useEffect, useState } from "react";
import type { IconName } from "@/components/icons";

/**
 * Tutte le azioni dell'app raggiungibili in un tocco: Home, pulsante ＋ e Menu usano questo elenco,
 * così ogni percorso è lo stesso ovunque e l'utente sceglie quali tenere in vista.
 */
export type StationId = "prepara" | "allena" | "strumenti" | "analizza" | "gareggia" | "impara" | "squadra";

export type Shortcut = {
  id: string;
  group: StationId;
  label: string;
  hint: string;
  icon: IconName;
  color: string;
  to: string;
  search?: Record<string, string>;
  hash?: string;
};

export const SHORTCUTS: Shortcut[] = [
  { id: "rapido", group: "allena", label: "Tiro rapido", hint: "Riparte come l'ultima volta", icon: "bolt", color: "#d6912a", to: "/allenamento", search: { avvia: "rapido" } },
  { id: "foto", group: "allena", label: "Volée da foto", hint: "Fotografa il bersaglio", icon: "camera", color: "#2b74c9", to: "/allenamento", search: { avvia: "foto" } },
  { id: "nuovo", group: "allena", label: "Allenamento", hint: "Scegli obiettivo e frecce", icon: "bow", color: "#2c8a57", to: "/allenamento" },
  { id: "gesto", group: "allena", label: "Analisi gesto", hint: "Video con scheletro", icon: "archer", color: "#7652d1", to: "/allenamento", search: { avvia: "gesto" } },
  { id: "fatto", group: "allena", label: "Già fatto", hint: "Segna un tiro passato", icon: "notebook", color: "#3f8a76", to: "/allenamento", search: { avvia: "fatto" } },
  { id: "storico", group: "analizza", label: "Storico", hint: "Tutti i tuoi allenamenti", icon: "history", color: "#55647b", to: "/allenamento", search: { vista: "storico" } },
  { id: "gare", group: "gareggia", label: "Gare", hint: "Iscrizioni e risultati", icon: "trophy", color: "#c39320", to: "/gare" },
  { id: "storico-gesto", group: "analizza", label: "Storico del gesto", hint: "Le analisi salvate, per le statistiche del corpo", icon: "archer", color: "#7652d1", to: "/gesti" },
  { id: "statistiche", group: "analizza", label: "Statistiche", hint: "Grafici e progressi", icon: "chart", color: "#1b9097", to: "/statistiche" },
  { id: "balistica", group: "prepara", label: "Balistica", hint: "Simulatore di volo e FOC", icon: "ballistics", color: "#cc4f3b", to: "/balistica" },
  { id: "attrezzatura", group: "prepara", label: "Attrezzatura", hint: "Archi, frecce, assetti", icon: "quiver", color: "#8b6a3e", to: "/attrezzatura" },
  { id: "squadra", group: "squadra", label: "Compagnia", hint: "Arcieri, contatti e classifiche", icon: "team", color: "#3d8a4e", to: "/squadra" },
  { id: "calendario", group: "gareggia", label: "Calendario", hint: "Uscite in programma", icon: "calendar", color: "#4568d6", to: "/calendario" },
  { id: "classifiche", group: "gareggia", label: "Classifiche", hint: "Chi è davanti", icon: "podium", color: "#c27d1c", to: "/classifiche" },
  { id: "sfide", group: "gareggia", label: "Sfide", hint: "Sfida i compagni", icon: "duel", color: "#c4475a", to: "/sfide" },
  { id: "obiettivi", group: "analizza", label: "Obiettivi", hint: "I tuoi traguardi", icon: "flag", color: "#2a9c66", to: "/obiettivi" },
  { id: "bacheca", group: "squadra", label: "Bacheca", hint: "News del gruppo", icon: "megaphone", color: "#b8508a", to: "/bacheca" },
  { id: "confronta", group: "analizza", label: "Confronta", hint: "Tu contro un compagno", icon: "compare", color: "#5568c2", to: "/confronta" },
  { id: "acquisti", group: "prepara", label: "Acquisti", hint: "Lista della spesa", icon: "bag", color: "#946f42", to: "/acquisti" },
  { id: "profilo", group: "squadra", label: "Profilo", hint: "Dati, import, impostazioni", icon: "user", color: "#646c7a", to: "/profilo" },
  { id: "colori", group: "squadra", label: "Colori dell'app", hint: "La tinta di tutta l'app", icon: "palette", color: "#7652d1", to: "/profilo", search: { tab: "colori" } },
  { id: "schede", group: "allena", label: "Le mie schede", hint: "Esercizi, classi e richieste dell'allenatore", icon: "notebook", color: "#2f6fd1", to: "/schede" },
  { id: "istruttore", group: "squadra", label: "Allenatore", hint: "Allievi, schede e progressi", icon: "team", color: "#2f6fd1", to: "/istruttore" },
  { id: "segreteria", group: "squadra", label: "Segreteria", hint: "Quote, certificati e presenze", icon: "checklist", color: "#3f8a76", to: "/segreteria" },
  { id: "riepilogo", group: "analizza", label: "Il mio mese", hint: "Riepilogo da condividere", icon: "share", color: "#c46b2b", to: "/riepilogo" },
  { id: "staff", group: "squadra", label: "Gestione compagnia", hint: "Inviti, iscritti e incarichi", icon: "shield", color: "#8a5bd1", to: "/staff" },
  { id: "avatar", group: "squadra", label: "Il tuo arciere", hint: "Aspetto, abiti e attrezzatura", icon: "archer", color: "#c46b2b", to: "/avatar" },
  { id: "timer", group: "allena", label: "Timer di tiro", hint: "Semaforo e tempi da gara", icon: "stopwatch", color: "#d6582a", to: "/timer" },
  { id: "borsa", group: "prepara", label: "Prima di partire", hint: "Borsa e riscaldamento", icon: "checklist", color: "#3f8a76", to: "/borsa" },
  { id: "manutenzione", group: "prepara", label: "Manutenzione", hint: "Corda, cocche, penne", icon: "wrench", color: "#6c7684", to: "/manutenzione" },
  { id: "secco", group: "allena", label: "A secco, routine e respiro", hint: "Tenute, passi del tiro e respiro", icon: "hold", color: "#c4475a", to: "/secco" },
  { id: "tempi", group: "allena", label: "Tempo di allungo", hint: "Cronometra la trazione, o dai video", icon: "stopwatch", color: "#8a5bd1", to: "/tempi" },
  { id: "routine", group: "allena", label: "Routine di tiro", hint: "I tuoi passi, uno alla volta", icon: "steps", color: "#2a9c66", to: "/routine" },
  { id: "respiro", group: "allena", label: "Respiro", hint: "Calma prima della volée", icon: "lungs", color: "#3a8fc4", to: "/respiro" },
  { id: "segnapunti", group: "gareggia", label: "Segnapunti", hint: "Punti con gli amici", icon: "scorecard", color: "#b8508a", to: "/segnapunti" },
  { id: "spine", group: "strumenti", label: "Spine e libbre", hint: "Libbre reali e spine giusto", icon: "spine", color: "#2f6fd1", to: "/spine" },
  { id: "vento", group: "strumenti", label: "Vento", hint: "Di quanto ti sposta", icon: "windsock", color: "#3aa7c4", to: "/vento" },
  { id: "energia", group: "strumenti", label: "Velocità ed energia", hint: "m/s, joule, quantità di moto", icon: "energy", color: "#d6912a", to: "/energia" },
  { id: "allungo", group: "strumenti", label: "Allungo", hint: "Dall'apertura delle braccia", icon: "span", color: "#7652d1", to: "/allungo" },
  { id: "tuning", group: "strumenti", label: "Bare shaft", hint: "Messa a punto con l'asta nuda", icon: "bareshaft", color: "#cc4f3b", to: "/tuning" },
  { id: "assetto", group: "strumenti", label: "Assetto arco", hint: "Brace, tiller, punto d'incocco", icon: "caliper", color: "#6c7684", to: "/assetto" },
  { id: "unita", group: "strumenti", label: "Convertitore", hint: "lb, grani, pollici, iarde", icon: "ruler", color: "#8b6a3e", to: "/unita" },
  { id: "lezioni", group: "impara", label: "Lezioni", hint: "3 livelli, dal primo tiro alla gara", icon: "steps", color: "#2f8f6a", to: "/lezioni" },
  { id: "sfida-giorno", group: "impara", label: "Sfida del giorno", hint: "Un esercizio nuovo ogni giorno", icon: "daily", color: "#d6582a", to: "/sfida-giorno" },
  { id: "quiz", group: "impara", label: "Quiz", hint: "Regole, tecnica, attrezzatura", icon: "quiz", color: "#5568c2", to: "/quiz" },
  { id: "stima", group: "impara", label: "Stima distanze", hint: "Gioco per occhio da 3D", icon: "binoculars", color: "#3d8a4e", to: "/stima" },
  { id: "glossario", group: "impara", label: "Glossario", hint: "Le parole dell'arciere", icon: "book", color: "#946f42", to: "/glossario" },
  { id: "regole", group: "impara", label: "Distanze e bersagli", hint: "Gare indoor, targa, campagna", icon: "rules", color: "#c39320", to: "/regole" },
];

/** Le tappe della mappa: il percorso naturale di un arciere, dalla preparazione alla squadra. */
export const STATIONS: { id: StationId; title: string; sub: string; icon: IconName; color: string }[] = [
  { id: "prepara", title: "Preparati", sub: "Arco, frecce e simulatore di volo", icon: "quiver", color: "#c08a52" },
  { id: "allena", title: "Allenati", sub: "Tira, fotografa, riprendi il gesto", icon: "bow", color: "#4fb37a" },
  { id: "strumenti", title: "Strumenti", sub: "Calcoli e messa a punto", icon: "caliper", color: "#5b93d6" },
  { id: "analizza", title: "Analizza", sub: "Numeri, storico e traguardi", icon: "chart", color: "#3bb3b0" },
  { id: "gareggia", title: "Gareggia", sub: "Gare, calendario e classifiche", icon: "trophy", color: "#d9ad3c" },
  { id: "impara", title: "Impara", sub: "Sfide, quiz e giochi per crescere", icon: "daily", color: "#e57f45" },
  { id: "squadra", title: "Compagnia", sub: "Arcieri, news e profilo", icon: "team", color: "#9a7be0" },
];

export const DEFAULT_PINNED = ["rapido", "foto", "gesto", "statistiche", "balistica", "gare", "attrezzatura", "squadra"];
export const QUICK_ACTIONS = ["rapido", "foto", "timer", "gesto", "fatto", "gare"];

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
export const TIPS: { icon: IconName; text: string }[] = [
  { icon: "bolt", text: "«Tiro rapido» riparte con gli stessi bersaglio, distanza e frecce dell'ultima volta: un tocco e sei in linea." },
  { icon: "camera", text: "Fotografa il bersaglio dopo ogni volée: con «Più foto insieme» le volée si contano da sole." },
  { icon: "hand", text: "Sulla foto, due dita spostano e ingrandiscono il padiglione; tieni premuto su una freccia per cambiarle numero." },
  { icon: "ballistics", text: "In Balistica, il mirino verde «MIRA QUI» ti dice dove puntare per portare il gruppo sull'oro." },
  { icon: "breath", text: "Respira prima di aprire: espira a metà trazione e trattieni in ancoraggio, senza forzare." },
  { icon: "posture", text: "Spalla dell'arco bassa e scapole che si chiudono: è la schiena che tira, non il braccio." },
  { icon: "timer", text: "Un ancoraggio costante dura 2–4 secondi: oltre, il gesto si scompone. L'analisi del gesto lo misura." },
  { icon: "palette", text: "In Attrezzatura personalizzi colore asta, penne, indice e punta: le frecce in Home cambiano con te." },
  { icon: "pin", text: "Tocca «Personalizza» in Home per scegliere le tue scorciatoie: solo quelle che usi davvero." },
  { icon: "wind", text: "Col vento laterale mira contro vento, non correggere il mirino a ogni raffica: aspetta la calma." },
  { icon: "follow", text: "Dopo il rilascio resta fermo e guarda la freccia arrivare: il «follow-through» stabilizza il gruppo." },
  { icon: "chart", text: "In Statistiche il calendario a quadretti mostra la tua costanza: meglio poco ma spesso." },
];

/** Scheda "dopo" per ogni pagina: il passo che di solito viene subito dopo. */
const NEXT: Record<string, string> = {
  rapido: "statistiche", foto: "statistiche", nuovo: "statistiche", fatto: "statistiche", storico: "statistiche",
  gesto: "routine", statistiche: "obiettivi", obiettivi: "sfida-giorno", attrezzatura: "balistica", balistica: "spine",
  spine: "tuning", tuning: "assetto", assetto: "manutenzione", manutenzione: "borsa", borsa: "timer", timer: "respiro",
  respiro: "routine", routine: "tempi", tempi: "secco", secco: "gesto", allungo: "spine", vento: "balistica", energia: "balistica",
  unita: "spine", gare: "segnapunti", segnapunti: "classifiche", classifiche: "confronta", confronta: "squadra",
  calendario: "gare", sfide: "classifiche", squadra: "bacheca", bacheca: "calendario", stima: "regole",
  regole: "glossario", glossario: "lezioni", lezioni: "quiz", quiz: "sfida-giorno", avatar: "attrezzatura", "sfida-giorno": "rapido", acquisti: "attrezzatura", profilo: "obiettivi",
  riepilogo: "statistiche", istruttore: "segreteria", segreteria: "staff",
};

export function currentShortcut(path: string) {
  // a parità di indirizzo vince la voce "pulita" (senza parametri): su /allenamento è "Allenamento"
  const plain = (s: Shortcut) => (s.search || s.hash ? 1 : 0);
  return [...SHORTCUTS].sort((a, b) => b.to.length - a.to.length || plain(a) - plain(b)).find((s) => s.to !== "/" && path.startsWith(s.to)) ?? null;
}

export function nextShortcut(path: string) {
  const here = currentShortcut(path);
  if (!here) return null;
  const id = NEXT[here.id];
  const byMap = id ? SHORTCUTS.find((s) => s.id === id) : null;
  if (byMap) return byMap;
  const same = SHORTCUTS.filter((s) => s.group === here.group);
  const i = same.findIndex((s) => s.id === here.id);
  return same[(i + 1) % same.length] ?? null;
}
