import { useEffect, useRef, useState } from "react";

/** Stato salvato sul telefono: si legge all'apertura e si scrive a ogni modifica, senza pulsanti. */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValue({ ...(initial as object), ...(JSON.parse(raw) as object) } as T);
    } catch {
      /* dato rovinato: si riparte dai valori iniziali */
    }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* memoria piena o privata */
    }
  }, [key, value]);
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
