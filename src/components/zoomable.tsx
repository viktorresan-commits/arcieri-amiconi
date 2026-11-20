import { useRef, useState, type ReactNode } from "react";
import { useGestures } from "@/lib/arcieri/gestures";

/**
 * Contenitore per grafici: con due dita si ingrandisce, si gira e si sposta; con un dito si sposta
 * quando è ingrandito (altrimenti la pagina scorre normalmente). Doppio tocco: torna com'era.
 */
export function Zoomable({ children, className = "", label = "grafico" }: { children: ReactNode; className?: string; label?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const view = useRef({ s: 1, r: 0, x: 0, y: 0 });
  const [zoomed, setZoomed] = useState(false);
  const zoomedRef = useRef(false);
  const apply = () => {
    const t = view.current;
    if (inner.current) inner.current.style.transform = `translate(${t.x}px, ${t.y}px) rotate(${t.r}rad) scale(${t.s})`;
    const z = t.s > 1.02 || Math.abs(t.r) > 0.02 || Math.hypot(t.x, t.y) > 2;
    if (z !== zoomedRef.current) {
      zoomedRef.current = z;
      setZoomed(z);
    }
  };
  const reset = () => {
    view.current = { s: 1, r: 0, x: 0, y: 0 };
    apply();
  };
  const ref = useGestures<HTMLDivElement>({
    one: (dx, dy) => {
      if (!zoomedRef.current) return false;
      view.current.x += dx;
      view.current.y += dy;
      apply();
      return true;
    },
    two: (scale, turn, cx, cy, dx, dy) => {
      const el = ref.current;
      if (!el) return;
      const t = view.current;
      const s = Math.max(1, Math.min(8, t.s * scale));
      const k = s / t.s;
      // punto fermo sotto le dita, rispetto al centro del contenitore (origine della trasformazione)
      const px = cx - el.clientWidth / 2;
      const py = cy - el.clientHeight / 2;
      const ox = t.x - px;
      const oy = t.y - py;
      const c = Math.cos(turn);
      const sn = Math.sin(turn);
      t.x = px + k * (c * ox - sn * oy) + dx;
      t.y = py + k * (sn * ox + c * oy) + dy;
      t.s = s;
      t.r += turn;
      apply();
    },
    double: reset,
  });
  return (
    <div
      ref={ref}
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{ touchAction: zoomed ? "none" : "pan-y" }}
      aria-label={`${label}: due dita per ingrandire e ruotare, doppio tocco per tornare com'era`}
    >
      <div ref={inner} style={{ transformOrigin: "50% 50%", willChange: "transform" }}>
        {children}
      </div>
      {zoomed ? (
        <button type="button" onClick={reset} className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[0.68rem] font-semibold text-white backdrop-blur">
          Ripristina vista
        </button>
      ) : null}
    </div>
  );
}
