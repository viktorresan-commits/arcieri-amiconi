import { useEffect } from "react";
import { listGadgets, refreshPrizes } from "./club.api";
import { staleLoad, useLoad } from "./use-load";

/** quando è partito l'ultimo ricalcolo per ogni arciere, in questa sessione */
const asked = new Map<string, number>();
const AGAIN_MS = 5 * 60_000;

/**
 * I premi: subito quelli già salvati; poi, a pagina ferma e telefono libero, il ricalcolo in sottofondo
 * (chi apre, l'arciere guardato e un pezzo del giro di tutti). Se arrivano medaglie nuove si rileggono.
 */
export function usePrizes(key: string, target: { userId?: string; memberId?: number } = {}) {
  const res = useLoad(key, () => listGadgets({ data: target }));
  const who = `${target.userId ?? ""}|${target.memberId ?? ""}`;
  useEffect(() => {
    if (Date.now() - (asked.get(who) ?? 0) < AGAIN_MS) return;
    let alive = true;
    let idle = 0;
    const go = () => {
      if (!alive) return;
      asked.set(who, Date.now());
      refreshPrizes({ data: target })
        .then((r) => {
          if (r?.changed) staleLoad(key);
        })
        .catch(() => undefined);
    };
    const wait = window.setTimeout(() => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) idle = ric(go, { timeout: 5000 });
      else go();
    }, 2500);
    return () => {
      alive = false;
      window.clearTimeout(wait);
      const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (idle && cic) cic(idle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who, key]);
  return res;
}
