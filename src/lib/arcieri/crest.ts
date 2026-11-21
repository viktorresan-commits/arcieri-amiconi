import { useEffect, useSyncExternalStore } from "react";
import { companyCrests } from "./compagnie.api";

/**
 * Stemmi delle compagnie per gli avatar. Si caricano una volta sola; le immagini dei file
 * dell'app diventano "data URL", così restano anche nella foto profilo generata dall'avatar.
 */
export type Crest = { id: number; name: string; logo: string | null; color: string };
type State = { mine: number | null; byId: Record<string, Crest> };

let state: State | null = null;
let loading = false;
const subs = new Set<() => void>();

const emit = () => subs.forEach((f) => f());

async function toDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : url);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

function load() {
  if (loading || state || typeof window === "undefined") return;
  loading = true;
  companyCrests()
    .then(async (r) => {
      const byId: Record<string, Crest> = {};
      for (const c of r.crests) {
        const logo = c.logoUrl ? (c.logoUrl.startsWith("data:") ? c.logoUrl : await toDataUrl(c.logoUrl)) : null;
        byId[String(c.id)] = { id: c.id, name: c.name, logo, color: c.color };
      }
      state = { mine: r.mine ?? null, byId };
    })
    .catch(() => {
      state = { mine: null, byId: {} };
    })
    .finally(() => {
      loading = false;
      emit();
    });
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

/** Tutti gli stemmi e la compagnia dell'utente (null finché non sono pronti). */
export function useCrests() {
  const s = useSyncExternalStore(subscribe, () => state, () => null);
  useEffect(() => load(), []);
  return s;
}

/** Lo stemma di una compagnia; senza numero, quello della propria. */
export function useCrest(id?: string) {
  const s = useCrests();
  if (!s) return null;
  const key = id && id !== "0" ? id : s.mine != null ? String(s.mine) : "";
  return s.byId[key] ?? null;
}

/** Dopo aver cambiato compagnia o stemma: ricarica alla prossima richiesta. */
export function refreshCrests() {
  state = null;
  load();
}
