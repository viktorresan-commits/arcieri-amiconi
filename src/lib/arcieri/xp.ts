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

export function useXp() {
  const [st, setSt] = useState<XpState>({ xp: 0, log: [], days: [] });
  useEffect(() => {
    const sync = () => setSt(readXp());
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
