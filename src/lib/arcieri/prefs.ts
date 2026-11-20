import { useEffect, useState } from "react";

/**
 * Preferenze dell'app sul telefono. Ogni scelta si salva da sola, subito:
 * nessun pulsante "Salva", nessun messaggio.
 */
export type Prefs = {
  ink: "verde" | "blu" | "rosso" | "giallo" | "viola";
  icons: "tema" | "colori" | "sobrie";
  motion: "piena" | "ridotta";
  scenes: "si" | "no";
  weekGoal: number;
  home: { journey: boolean; tips: boolean; numbers: boolean; arrows: boolean; shortcuts: boolean };
};

export const INKS: { id: Prefs["ink"]; color: string; label: string }[] = [
  { id: "verde", color: "#1f5c38", label: "Bosco" },
  { id: "blu", color: "#2f6fbe", label: "Lago" },
  { id: "rosso", color: "#c4473d", label: "Brace" },
  { id: "giallo", color: "#d7b56a", label: "Oro" },
  { id: "viola", color: "#7a4bb5", label: "Vespro" },
];

export const WEEK_GOALS = [60, 120, 200, 300, 450];

const DEFAULTS: Prefs = {
  ink: "verde",
  icons: "tema",
  motion: "piena",
  scenes: "si",
  weekGoal: 120,
  home: { journey: true, tips: true, numbers: true, arrows: true, shortcuts: true },
};

const KEY = "aa-prefs-v1";
const EVENT = "aa-prefs";

export function readPrefs(): Prefs {
  if (typeof localStorage === "undefined") return DEFAULTS;
  try {
    const raw = (JSON.parse(localStorage.getItem(KEY) || "null") ?? {}) as Partial<Prefs>;
    const ink = (localStorage.getItem("aa-ink") as Prefs["ink"] | null) ?? raw.ink ?? DEFAULTS.ink;
    const goal = Number(localStorage.getItem("aa-week-goal")) || raw.weekGoal || DEFAULTS.weekGoal;
    return {
      ...DEFAULTS,
      ...raw,
      ink: INKS.some((i) => i.id === ink) ? ink : DEFAULTS.ink,
      weekGoal: WEEK_GOALS.includes(goal) ? goal : DEFAULTS.weekGoal,
      home: { ...DEFAULTS.home, ...(raw.home ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

/** Applica al documento le scelte che cambiano l'aspetto (colori, icone, animazioni). */
export function applyPrefs(p: Prefs) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.dataset.ink = p.ink;
  el.dataset.icons = p.icons;
  el.dataset.motion = p.motion;
  el.dataset.scenes = p.scenes;
}

export function writePrefs(next: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    localStorage.setItem("aa-ink", next.ink);
    localStorage.setItem("aa-week-goal", String(next.weekGoal));
  } catch {
    /* memoria piena o bloccata: resta valido per questa sessione */
  }
  applyPrefs(next);
  window.dispatchEvent(new Event(EVENT));
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  useEffect(() => {
    const sync = () => setPrefs(readPrefs());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = (patch: Partial<Prefs>) => {
    const next = { ...readPrefs(), ...patch };
    setPrefs(next);
    writePrefs(next);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(6);
  };
  return { prefs, update };
}
