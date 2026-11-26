import { useEffect, useState } from "react";

export function messageOf(e: unknown) {
  if (e instanceof Error) {
    if (e.message === "Unauthorized") return "Sessione scaduta. Entra di nuovo.";
    return e.message;
  }
  return "Qualcosa non ha funzionato.";
}

/**
 * Dati già caricati, per pagina e chiave. Tornando su una pagina già vista i dati compaiono subito.
 * Se sono freschi (arrivati da poco) e nel frattempo non si è salvato niente, non si richiedono affatto:
 * niente attese e niente ridisegni inutili. Altrimenti si mostrano e intanto si aggiornano in sottofondo.
 * Restano anche sul telefono (per persona), così all'apertura dell'app le pagine sono già piene.
 * La pagina fa parte della chiave perché pagine diverse usano a volte la stessa chiave per dati diversi.
 */
const cache = new Map<string, unknown>();
/** quando sono arrivati i dati di ogni voce, e a quante scritture verso il server eravamo */
const stamps = new Map<string, { at: number; w: number }>();
const MAX = 80;
/** per quanto i dati valgono senza richiederli, se nel frattempo non si è salvato niente */
const FRESH_MS = 10 * 60_000;
/** sul telefono: niente voci enormi (foto), e in tutto non oltre questo */
const ENTRY_MAX = 160_000;
const STORE_MAX = 1_400_000;
const STORE = "aa-load:";

function slot(key: string) {
  const page = typeof window === "undefined" ? "" : window.location.pathname;
  return `${page}|${key}`;
}

/**
 * Quante scritture sono partite verso il server da quando l'app è aperta: le conta uno script nella testata
 * della pagina (ogni richiesta che non è una lettura). Dopo una scrittura i dati in memoria si riguardano.
 */
function writes() {
  return typeof window === "undefined" ? 0 : Number((window as unknown as { __aaWrites?: number }).__aaWrites) || 0;
}

function same(a: unknown, b: unknown) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function fresh(id: string) {
  const s = stamps.get(id);
  return Boolean(s && s.w === writes() && Date.now() - s.at < FRESH_MS);
}

/* ---------- copia sul telefono ---------- */

let owner = "";
let saveTimer = 0;

function storeKey(who: string) {
  return `${STORE}${who}`;
}

/** dati che tornano identici da JSON (niente date, mappe, insiemi): solo questi si conservano sul telefono */
function plainJson(value: unknown): string | null {
  try {
    return JSON.stringify(value, function (this: Record<string, unknown>, k: string, v: unknown) {
      const raw = k === "" ? value : this[k];
      if (raw instanceof Date || raw instanceof Map || raw instanceof Set || typeof raw === "bigint" || typeof raw === "function") throw new Error("non semplice");
      return v;
    });
  } catch {
    return null;
  }
}

function saveSoon() {
  if (typeof window === "undefined" || !owner) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const run = () => {
      const who = owner;
      if (!who) return;
      const rows: string[] = [];
      let total = 0;
      // dalle più recenti alle più vecchie, finché c'è posto
      for (const id of [...cache.keys()].reverse()) {
        const json = plainJson(cache.get(id));
        if (json == null || json.length > ENTRY_MAX) continue;
        const row = `[${JSON.stringify(id)},${stamps.get(id)?.at ?? Date.now()},${json}]`;
        if (total + row.length > STORE_MAX) break;
        rows.push(row);
        total += row.length;
      }
      try {
        localStorage.setItem(storeKey(who), `[${rows.reverse().join(",")}]`);
      } catch {
        /* telefono pieno o archivio non disponibile: restano solo in memoria */
      }
    };
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(run, { timeout: 3000 });
    else run();
  }, 1500);
}

/**
 * Di chi sono i dati: lo dice la cornice dell'app appena sa chi è entrato (anche dal profilo ricordato,
 * prima che il server risponda). Cambiando persona si svuota tutto e si riprende la sua copia.
 */
export function setLoadOwner(who: string) {
  if (!who || who === owner || typeof window === "undefined") return;
  cache.clear();
  stamps.clear();
  owner = who;
  try {
    const raw = localStorage.getItem(storeKey(who));
    if (!raw) return;
    const rows = JSON.parse(raw) as [string, number, unknown][];
    for (const [id, at, value] of rows) {
      cache.set(id, value);
      // copia del telefono: si mostra subito ma si riguarda sempre alla prima apertura
      stamps.set(id, { at, w: -1 });
    }
  } catch {
    /* copia rovinata: si ricarica tutto dal server */
  }
}

/** Da chiamare quando cambia di chi sono i dati (per esempio quando un allenatore inserisce per un allievo). */
export function clearLoadCache() {
  cache.clear();
  stamps.clear();
  if (owner && typeof window !== "undefined") {
    try {
      localStorage.removeItem(storeKey(owner));
    } catch {
      /* niente */
    }
  }
}

/** Uscendo dall'app: via tutte le copie sul telefono. */
export function forgetLoadCache() {
  cache.clear();
  stamps.clear();
  owner = "";
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(STORE)) localStorage.removeItem(k);
  } catch {
    /* niente */
  }
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
    // già qui, arrivati da poco e nessun salvataggio nel frattempo: non si richiedono
    if (known && fresh(id)) return;
    fn()
      .then((got) => {
        // dati uguali a quelli già mostrati: si tiene lo stesso oggetto, così la pagina non si ridisegna
        // tutta (tornando sulla Home l'arciere andava a scatti per un ridisegno inutile)
        const old = cache.get(id);
        const value = old !== undefined && same(old, got) ? (old as T) : got;
        cache.delete(id);
        cache.set(id, value);
        stamps.set(id, { at: Date.now(), w: writes() });
        if (cache.size > MAX) {
          const drop = cache.keys().next().value as string;
          cache.delete(drop);
          stamps.delete(drop);
        }
        saveSoon();
        if (!cancel && value !== old) setData(value);
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
