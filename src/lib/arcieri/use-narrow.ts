import { useEffect, useState } from "react";

/** Vero su schermi stretti (telefono in verticale): le viste si allungano in altezza. */
export function useNarrow(max = 640) {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < max);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${max - 1}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [max]);
  return narrow;
}
