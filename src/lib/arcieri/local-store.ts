import { useEffect, useId, useRef, useState } from "react";

/**
 * Stato salvato sul telefono: si legge all'apertura e si scrive a ogni modifica, senza pulsanti.
 * Più componenti con la stessa chiave restano allineati (evento "aa-local").
 */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  const first = useRef(true);
  const external = useRef(false);
  const id = useId();
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValue({ ...(initial as object), ...(JSON.parse(raw) as object) } as T);
    } catch {
      /* dato rovinato: si riparte dai valori iniziali */
    }
    loaded.current = true;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ key: string; value: T; src: string }>).detail;
      if (!d || d.key !== key || d.src === id) return;
      setValue((cur) => {
        if (JSON.stringify(cur) === JSON.stringify(d.value)) return cur;
        external.current = true;
        return d.value;
      });
    };
    window.addEventListener("aa-local", on);
    return () => window.removeEventListener("aa-local", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!loaded.current) return;
    // al primo giro il valore è ancora quello iniziale: non sovrascrive quello salvato
    if (first.current) {
      first.current = false;
      return;
    }
    // valore arrivato da un altro componente: è già salvato, non lo rimando indietro
    if (external.current) {
      external.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* memoria piena o privata */
    }
    window.dispatchEvent(new CustomEvent("aa-local", { detail: { key, value, src: id } }));
  }, [key, value, id]);
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
