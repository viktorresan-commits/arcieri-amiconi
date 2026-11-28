/**
 * Sullo schermo o no: i disegni a ogni fotogramma (3D, tela) si fermano quando l'elemento esce dalla vista
 * scorrendo la pagina, e ripartono da dove erano quando torna. `margin`: un po' prima che entri, così non si
 * vede il fotogramma vecchio.
 */
export type OnScreen = { on: boolean; /** è appena tornato in vista: va ridisegnato */ back: boolean; stop: () => void };

export function watchOnScreen(el: Element | null, margin = "160px"): OnScreen {
  const st: OnScreen = { on: true, back: false, stop: () => {} };
  if (!el || typeof IntersectionObserver === "undefined") return st;
  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[entries.length - 1];
      if (!e) return;
      if (e.isIntersecting && !st.on) st.back = true;
      st.on = e.isIntersecting;
    },
    { rootMargin: margin },
  );
  io.observe(el);
  st.stop = () => io.disconnect();
  return st;
}
