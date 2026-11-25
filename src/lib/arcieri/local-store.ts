import { useCallback, useEffect, useRef, useSyncExternalStore, type SetStateAction } from "react";

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Valore salvato con i campi nuovi presi dall'iniziale; numeri, testi, liste e vero/falso restano come sono. */
function restore<T>(initial: T, saved: unknown): T {
  if (isPlain(initial)) return (isPlain(saved) ? { ...initial, ...saved } : initial) as T;
  if (Array.isArray(initial)) return (Array.isArray(saved) ? saved : initial) as T;
  return (typeof saved === typeof initial ? saved : initial) as T;
}

type Entry = { raw: string | null; value: unknown };
// ultimo valore letto per chiave, legato al testo salvato: finché il testo non cambia, lo stesso oggetto
const cache = new Map<string, Entry>();
// valori che il telefono non è riuscito a salvare (memoria piena o navigazione privata): valgono finché la pagina resta aperta
const unsaved = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function currentValue<T>(key: string, initial: T): T {
  if (unsaved.has(key)) return unsaved.get(key) as T;
  const raw = readRaw(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value = initial;
  if (raw != null) {
    try {
      value = restore(initial, JSON.parse(raw));
    } catch {
      /* dato rovinato: si riparte dai valori iniziali */
    }
  }
  cache.set(key, { raw, value });
  return value;
}

function emit(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

let storageHooked = false;
function subscribeKey(key: string, fn: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(fn);
  // modifiche fatte da un'altra finestra dell'app
  if (!storageHooked && typeof window !== "undefined") {
    storageHooked = true;
    window.addEventListener("storage", (e) => {
      if (e.key == null) listeners.forEach((_, k) => emit(k));
      else emit(e.key);
    });
  }
  return () => {
    set.delete(fn);
  };
}

/**
 * Stato salvato sul telefono: si legge subito (anche al ritorno su una scheda, senza mostrare prima i valori
 * iniziali) e si scrive a ogni modifica, senza pulsanti. Tutti i componenti con la stessa chiave vedono lo stesso valore.
 * Durante l'idratazione si parte dai valori iniziali, come la pagina arrivata dal server.
 */
export function useLocalState<T>(key: string, initial: T) {
  const init = useRef(initial);
  const subscribe = useCallback((fn: () => void) => subscribeKey(key, fn), [key]);
  const value = useSyncExternalStore(
    subscribe,
    () => currentValue(key, init.current),
    () => init.current,
  );
  const setValue = useCallback(
    (next: SetStateAction<T>) => {
      const prev = currentValue(key, init.current);
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      if (Object.is(v, prev)) return;
      try {
        const raw = JSON.stringify(v);
        localStorage.setItem(key, raw);
        unsaved.delete(key);
        cache.set(key, { raw, value: v });
      } catch {
        unsaved.set(key, v);
      }
      emit(key);
    },
    [key],
  );
  return [value, setValue] as const;
}

/** Suoni brevi (fischi del direttore di tiro) con WebAudio. */
let audio: AudioContext | null = null;
export function whistle(times: number, freq = 2100) {
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = audio;
    void ctx.resume();
    for (let i = 0; i < times; i++) {
      const t = ctx.currentTime + i * 0.42;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.linearRampToValueAtTime(freq * 0.92, t + 0.3);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    }
  } catch {
    /* audio non disponibile */
  }
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(Array.from({ length: times * 2 - 1 }, (_, i) => (i % 2 ? 140 : 220)));
}

/** Tiene lo schermo acceso mentre serve (timer, riscaldamento). */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => undefined);
    return () => {
      void lock?.release().catch(() => undefined);
    };
  }, [on]);
}
