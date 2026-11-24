import { useEffect, useState } from "react";

export function messageOf(e: unknown) {
  if (e instanceof Error) {
    if (e.message === "Unauthorized") return "Sessione scaduta. Entra di nuovo.";
    return e.message;
  }
  return "Qualcosa non ha funzionato.";
}

/**
 * Ultimi dati ricevuti, per pagina e chiave. Tornando su una pagina già vista i dati compaiono subito
 * e intanto si aggiornano in sottofondo: niente schermata di caricamento a ogni cambio di pagina.
 * La pagina fa parte della chiave perché pagine diverse usano a volte la stessa chiave per dati diversi.
 */
const cache = new Map<string, unknown>();
const MAX = 80;

function slot(key: string) {
  const page = typeof window === "undefined" ? "" : window.location.pathname;
  return `${page}|${key}`;
}

/** Da chiamare quando cambia di chi sono i dati (per esempio quando un allenatore inserisce per un allievo). */
export function clearLoadCache() {
  cache.clear();
}

export function useLoad<T>(key: string, fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(() => (cache.get(slot(key)) as T | undefined) ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => !cache.has(slot(key)));
  useEffect(() => {
    let cancel = false;
    const id = slot(key);
    const known = cache.has(id);
    if (known) {
      setData(cache.get(id) as T);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError("");
    fn()
      .then((value) => {
        cache.delete(id);
        cache.set(id, value);
        if (cache.size > MAX) cache.delete(cache.keys().next().value as string);
        if (!cancel) setData(value);
      })
      .catch((err: unknown) => {
        // con dati già mostrati, un aggiornamento fallito in sottofondo non li sostituisce con un errore
        if (!cancel && !known) setError(messageOf(err));
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
    // The key is the contract: callers change it to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, error, loading };
}
