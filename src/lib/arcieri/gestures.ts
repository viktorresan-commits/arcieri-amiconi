import { useEffect, useRef } from "react";

/**
 * Gesti con le dita su un elemento: un dito trascina, due dita pizzicano (zoom), girano e spostano.
 * Il doppio tocco chiama `double`. Con il mouse: rotella + Ctrl (o pizzico del trackpad) fa lo zoom.
 * I callback arrivano in pixel dello schermo; `one` restituisce true se ha usato il trascinamento.
 */
export type GestureHandlers = {
  one?: (dx: number, dy: number) => boolean;
  two?: (scale: number, turn: number, cx: number, cy: number, dx: number, dy: number) => void;
  double?: () => void;
  wheel?: boolean;
};

export function useGestures<T extends HTMLElement>(handlers: GestureHandlers) {
  const ref = useRef<T>(null);
  const cb = useRef(handlers);
  cb.current = handlers;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let moved = false;
    let lastTap = 0;
    const local = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      return { x: x - r.left, y: y - r.top };
    };
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) moved = false;
      if (pts.size === 2) {
        moved = true;
        for (const id of pts.keys()) {
          try {
            el.setPointerCapture(id);
          } catch {
            /* puntatore già rilasciato */
          }
        }
      }
    };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      if (pts.size === 1) {
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        const used = cb.current.one?.(dx, dy) ?? false;
        if (used && !moved) {
          try {
            el.setPointerCapture(e.pointerId);
          } catch {
            /* niente */
          }
        }
        moved = true;
        p.x = e.clientX;
        p.y = e.clientY;
        return;
      }
      if (pts.size !== 2) return;
      const [a, b] = [...pts.values()];
      const before = { d: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      p.x = e.clientX;
      p.y = e.clientY;
      const [a2, b2] = [...pts.values()];
      const after = { d: Math.hypot(b2.x - a2.x, b2.y - a2.y), ang: Math.atan2(b2.y - a2.y, b2.x - a2.x), mx: (a2.x + b2.x) / 2, my: (a2.y + b2.y) / 2 };
      let turn = after.ang - before.ang;
      if (turn > Math.PI) turn -= 2 * Math.PI;
      if (turn < -Math.PI) turn += 2 * Math.PI;
      const c = local(after.mx, after.my);
      cb.current.two?.(before.d > 4 ? after.d / before.d : 1, turn, c.x, c.y, after.mx - before.mx, after.my - before.my);
    };
    const up = (e: PointerEvent) => {
      const had = pts.delete(e.pointerId);
      if (!had) return;
      if (e.type === "pointerup" && pts.size === 0 && !moved) {
        const now = performance.now();
        if (now - lastTap < 320) {
          cb.current.double?.();
          lastTap = 0;
        } else lastTap = now;
      }
    };
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !cb.current.wheel) return;
      e.preventDefault();
      const c = local(e.clientX, e.clientY);
      cb.current.two?.(Math.exp(-e.deltaY * 0.0025), 0, c.x, c.y, 0, 0);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, []);
  return ref;
}

/** Vista 3D comandata con le dita: rotazione, inclinazione, zoom e spostamento. */
export type OrbitView = { yaw: number; pitch: number; zoom: number; px: number; py: number; touched: boolean };

export const freshOrbit = (): OrbitView => ({ yaw: 0, pitch: 0, zoom: 1, px: 0, py: 0, touched: false });

export function useOrbitGestures<T extends HTMLElement>() {
  const view = useRef<OrbitView>(freshOrbit());
  const ref = useGestures<T>({
    one: (dx, dy) => {
      const v = view.current;
      v.yaw += dx * 0.011;
      v.pitch = Math.max(-0.5, Math.min(1.1, v.pitch + dy * 0.008));
      v.touched = true;
      return true;
    },
    two: (scale, turn, _cx, _cy, dx, dy) => {
      const v = view.current;
      v.zoom = Math.max(0.35, Math.min(5, v.zoom * scale));
      v.yaw += turn;
      v.px += dx;
      v.py += dy;
      v.touched = true;
    },
    double: () => {
      view.current = freshOrbit();
    },
    wheel: true,
  });
  return { ref, view };
}
