/**
 * Tornare indietro esattamente dove si era.
 *
 * - La posizione di scorrimento di ogni pagina si ricorda per ogni passo della cronologia.
 *   Tornando indietro si rimette, anche se la pagina finisce di caricare dopo (si riprova finché
 *   il contenuto è abbastanza lungo, e ci si ferma appena la persona tocca lo schermo).
 * - Le schede scelte dentro una pagina (useEntryState) si ritrovano uguali tornando indietro,
 *   mentre aprendo la pagina da capo ripartono dall'inizio.
 */
import { useLayoutEffect, useRef, useState } from "react";

const SCROLL_KEY = "aa-back-scroll";
const STATE_KEY = "aa-back-state";
const MAX = 120;

function read<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "{}") as Record<string, T>;
  } catch {
    return {};
  }
}

function write(key: string, map: Record<string, unknown>) {
  try {
    const keys = Object.keys(map);
    // si tengono solo i passi più recenti
    if (keys.length > MAX) for (const k of keys.slice(0, keys.length - MAX)) delete map[k];
    sessionStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* archivio pieno o non disponibile */
  }
}

/** identificativo del passo attuale nella cronologia */
export function entryKey() {
  if (typeof window === "undefined") return "";
  try {
    const s = window.history.state as Record<string, unknown> | null;
    const k = s?.__TSR_key ?? s?.key;
    if (typeof k === "string" && k) return k;
  } catch {
    /* niente */
  }
  return window.location.pathname + window.location.search;
}

let popped = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    popped = true;
  });
}

/** scorrimento ricordato per ogni passo, e ripristinato tornando indietro (o avanti) */
export function useBackRestore(href: string, onPop?: (key: string) => void) {
  const current = useRef("");
  const until = useRef(0);
  const positions = useRef<Record<string, number> | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const onPopRef = useRef(onPop);
  onPopRef.current = onPop;

  useLayoutEffect(() => {
    positions.current = read<number>(SCROLL_KEY);
    const save = () => {
      if (!current.current || Date.now() < until.current) return;
      positions.current![current.current] = Math.round(window.scrollY);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => write(SCROLL_KEY, positions.current!), 180);
    };
    const stop = () => {
      until.current = 0;
    };
    window.addEventListener("scroll", save, { passive: true });
    for (const ev of ["touchstart", "wheel", "pointerdown", "keydown"]) window.addEventListener(ev, stop, { passive: true });
    return () => {
      window.removeEventListener("scroll", save);
      for (const ev of ["touchstart", "wheel", "pointerdown", "keydown"]) window.removeEventListener(ev, stop);
    };
  }, []);

  useLayoutEffect(() => {
    const key = entryKey();
    const wasPop = popped;
    popped = false;
    current.current = key;
    if (!wasPop) return;
    onPopRef.current?.(key);
    const target = positions.current?.[key] ?? 0;
    if (target <= 0) return;
    // la pagina può essere ancora corta (sta caricando): si riprova finché c'è spazio per arrivarci
    until.current = Date.now() + 4000;
    const step = () => {
      if (current.current !== key || Date.now() > until.current) {
        until.current = 0;
        return;
      }
      const room = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.min(target, Math.max(0, room)));
      if (room >= target - 2 && Math.abs(window.scrollY - target) < 3) {
        // ci siamo: un ultimo controllo al fotogramma dopo, poi si torna a ricordare
        requestAnimationFrame(() => {
          if (current.current === key && until.current) window.scrollTo(0, target);
          until.current = 0;
        });
        return;
      }
      window.setTimeout(step, 50);
    };
    step();
  }, [href]);
}

/** come useState, ma il valore resta legato al passo della cronologia: tornando indietro si ritrova */
export function useEntryState<T>(name: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  // si legge prima del disegno (niente lampo) ma dopo l'idratazione, così server e browser partono uguali
  useLayoutEffect(() => {
    const saved = read<T>(STATE_KEY)[`${entryKey()}|${name}`];
    if (saved !== undefined) setValue(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (next: T | ((v: T) => T)) => {
    setValue((prev) => {
      const v = typeof next === "function" ? (next as (v: T) => T)(prev) : next;
      const map = read<unknown>(STATE_KEY);
      map[`${entryKey()}|${name}`] = v;
      write(STATE_KEY, map);
      return v;
    });
  };
  return [value, set] as const;
}

/** il menu da cui si è partiti: tornando indietro si riapre com'era */
export function rememberMenu(top: number, search: boolean) {
  try {
    sessionStorage.setItem("aa-back-menu", JSON.stringify({ key: entryKey(), top, search }));
  } catch {
    /* niente */
  }
}

export function takeMenu(key: string): { top: number; search: boolean } | null {
  try {
    const raw = sessionStorage.getItem("aa-back-menu");
    if (!raw) return null;
    const m = JSON.parse(raw) as { key: string; top: number; search: boolean };
    if (m.key !== key) return null;
    sessionStorage.removeItem("aa-back-menu");
    return { top: m.top, search: m.search };
  } catch {
    return null;
  }
}
