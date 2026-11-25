import { useEffect, useState } from "react";
import { memberLevels } from "./xp.api";

/**
 * I punti di tutti gli arcieri, letti una volta per visita e condivisi fra i ritratti:
 * ogni ritratto mostra l'alone del colore del livello del suo arciere.
 */
let cache: Record<string, number> | null = null;
let pending: Promise<void> | null = null;
const subs = new Set<() => void>();

function load() {
  if (cache || pending) return;
  pending = memberLevels()
    .then((m) => {
      cache = m;
      subs.forEach((f) => f());
    })
    .catch(() => {
      pending = null;
    });
}

export function useLevels(): Record<string, number> {
  const [, tick] = useState(0);
  useEffect(() => {
    if (cache) return;
    const sub = () => tick((n) => n + 1);
    subs.add(sub);
    load();
    return () => {
      subs.delete(sub);
    };
  }, []);
  return cache ?? {};
}

/** dopo un allenamento o una gara: alla prossima lettura i punti sono di nuovo quelli del server */
export function refreshLevels() {
  cache = null;
  pending = null;
}
