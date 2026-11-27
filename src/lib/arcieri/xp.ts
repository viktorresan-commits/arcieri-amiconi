import { useEffect, useState } from "react";

/**
 * Punti esperienza dell'arciere (sul telefono): si guadagnano con sfide, quiz, giochi ed esercizi.
 * Ogni guadagno mostra un piccolo "+N" animato; il livello cresce ogni 100 punti, sempre un po' di più.
 */
const KEY = "aa-xp-v1";
const EVENT = "aa-xp";
export type XpState = { xp: number; log: { at: string; n: number; why: string }[]; days: string[] };

export function readXp(): XpState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<XpState> | null;
    return { xp: Number(raw?.xp) || 0, log: Array.isArray(raw?.log) ? raw.log.slice(0, 40) : [], days: Array.isArray(raw?.days) ? raw.days.slice(-60) : [] };
  } catch {
    return { xp: 0, log: [], days: [] };
  }
}

export const today = () => new Date().toLocaleDateString("sv-SE");

/** Aggiunge punti (una volta sola per `once`, se dato: es. "quiz-2026-11-20"). */
export function award(n: number, why: string, once?: string) {
  if (typeof localStorage === "undefined") return;
  const st = readXp();
  if (once && st.log.some((l) => l.why === once)) return;
  const day = today();
  const next: XpState = {
    xp: st.xp + n,
    log: [{ at: new Date().toISOString(), n, why: once ?? why }, ...st.log].slice(0, 40),
    days: st.days.includes(day) ? st.days : [...st.days, day].slice(-60),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* memoria piena */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { n, why } }));
}

/** Punti arrivati dal server (altro telefono): se sono di più, diventano quelli di questo telefono. */
export function adoptXp(serverXp: number) {
  if (typeof localStorage === "undefined") return;
  const st = readXp();
  if (!(serverXp > st.xp)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...st, xp: serverXp }));
  } catch {
    /* memoria piena */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
}

const ACT_KEY = "aa-xp-attivita";
const REFRESH = "aa-xp-refresh";

/** punti di allenamenti e gare registrati, calcolati dal server (ultimo valore ricevuto) */
export function readActivity(): number | null {
  try {
    const raw = localStorage.getItem(ACT_KEY);
    return raw == null ? null : Number(raw) || 0;
  } catch {
    return null;
  }
}

const PARTS_KEY = "aa-xp-voci";

/** i punti delle attività voce per voce (ultimo valore ricevuto dal server) */
export function readActivityParts(): XpParts | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PARTS_KEY) || "null") as XpParts | null;
    return raw && typeof raw === "object" ? raw : null;
  } catch {
    return null;
  }
}

/** nuovo valore dal server: se cresce si vede il "+N", come per gli altri punti */
export function setActivity(n: number, parts?: XpParts) {
  if (typeof localStorage === "undefined" || !Number.isFinite(n)) return;
  const prev = readActivity();
  try {
    if (parts) localStorage.setItem(PARTS_KEY, JSON.stringify(parts));
  } catch {
    /* memoria piena */
  }
  if (prev === n) {
    if (parts) window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
    return;
  }
  try {
    localStorage.setItem(ACT_KEY, String(n));
  } catch {
    /* memoria piena */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: prev != null && n > prev ? { n: n - prev, why: "Allenamenti, gare e podi" } : null }));
}

/** dopo aver salvato un allenamento o una gara: si richiedono i punti al server */
export function refreshActivity() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(REFRESH));
}

export function onActivityRefresh(fn: () => void) {
  window.addEventListener(REFRESH, fn);
  return () => window.removeEventListener(REFRESH, fn);
}

/**
 * Quanto vale ogni attività registrata (allenamenti, gare, podi, classifiche, analisi del gesto, corsi).
 * Il server ricalcola sempre tutto dai dati: vale anche per il passato e per le gare importate dal portale FITAST.
 */
export const XP_RULES = {
  training: 8,
  trainingPer10Arrows: 1,
  trainingArrowsMax: 12,
  gara: 25,
  garaFitast: 10,
  podium: { 1: 40, 2: 30, 3: 20 } as Record<number, number>,
  season: { 1: 150, 2: 100, 3: 75 } as Record<number, number>,
  seasonTop10: 30,
  gesture: 5,
  gesturesPerDay: 2,
  course: 5,
};

/** i punti delle attività, voce per voce */
export type XpParts = { allenamenti: number; gare: number; podi: number; classifiche: number; gesti: number; corsi: number };
export const xpTotal = (p: XpParts) => p.allenamenti + p.gare + p.podi + p.classifiche + p.gesti + p.corsi;

/** Livello: 1 → 100 punti, poi ogni livello chiede 25 punti in più. */
export function levelOf(xp: number) {
  let level = 1;
  let need = 100;
  let left = xp;
  while (left >= need) {
    left -= need;
    level += 1;
    need += 25;
  }
  return { level, into: left, need };
}

/**
 * Punti dell'arciere: `xp` è il totale (telefono + allenamenti e gare registrati) e fa il livello;
 * `own` sono solo quelli del telefono, che si mandano al server.
 */
export function useXp() {
  const [st, setSt] = useState<XpState & { own: number; activity: number; parts: XpParts | null }>({ xp: 0, own: 0, activity: 0, parts: null, log: [], days: [] });
  useEffect(() => {
    const sync = () => {
      const local = readXp();
      const activity = readActivity() ?? 0;
      setSt({ ...local, own: local.xp, activity, parts: readActivityParts(), xp: local.xp + activity });
    };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return st;
}

/** "+N" che sale e sparisce: montato una volta nella cornice dell'app. */
export function useXpToasts() {
  const [list, setList] = useState<{ id: number; n: number; why: string }[]>([]);
  useEffect(() => {
    let id = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ n: number; why: string }>).detail;
      if (!d) return;
      const me = ++id;
      setList((l) => [...l, { id: me, n: d.n, why: d.why }]);
      if (navigator.vibrate) navigator.vibrate([8, 30, 8]);
      window.setTimeout(() => setList((l) => l.filter((x) => x.id !== me)), 2200);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return list;
}
