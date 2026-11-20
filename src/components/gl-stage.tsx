import { useEffect, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from "react";
import { useOrbitGestures, type OrbitView } from "@/lib/arcieri/gestures";
import { GL3D } from "@/lib/arcieri/gl3d";

export type GLDraw = (g: GL3D, o: CanvasRenderingContext2D, w: number, h: number, t: number, view: OrbitView) => void;

/**
 * Scena WebGL con una tela di scritte sopra. Il contesto si crea una volta; la funzione di disegno
 * più recente viene usata a ogni fotogramma. Se WebGL non c'è, `failed` diventa vero e chi chiama
 * mostra la versione semplice.
 */
export function useGLScene(draw: GLDraw, opts: { autoYaw?: boolean } = {}) {
  const autoYaw = opts.autoYaw !== false;
  const { ref, view } = useOrbitGestures<HTMLCanvasElement>();
  const glRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const cv = glRef.current;
    const ov = ref.current;
    if (!cv || !ov) return;
    let g: GL3D;
    try {
      g = new GL3D(cv);
    } catch {
      setFailed(true);
      return;
    }
    const ctx = ov.getContext("2d");
    if (!ctx) return;
    const reduce = typeof matchMedia !== "undefined" && (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "ridotta");
    let raf = 0;
    let lost = false;
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      setFailed(true);
    };
    cv.addEventListener("webglcontextlost", onLost);
    const t0 = performance.now();
    let last = t0;
    let visible = true;
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }) : null;
    io?.observe(cv);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (lost || !visible) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (view.current.auto) {
        if (autoYaw) {
          view.current.yaw += dt * 0.45;
          view.current.spin += dt * 9;
          view.current.touched = true;
        } else {
          // «Gira» fa ruotare solo la freccia sul suo asse, veloce
          view.current.spin += dt * 26;
        }
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = ov.clientWidth;
      const h = ov.clientHeight;
      if (ov.width !== Math.round(w * dpr) || ov.height !== Math.round(h * dpr)) {
        ov.width = Math.round(w * dpr);
        ov.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      try {
        drawRef.current(g, ctx, w, h, reduce ? 4.5 : (now - t0) / 1000, view.current);
      } catch (err) {
        console.error(err);
        lost = true;
        setFailed(true);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      cv.removeEventListener("webglcontextlost", onLost);
      g.gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ref, glRef, view, failed };
}

/** Tela 3D a due strati (WebGL + scritte) con il pulsante «Gira» e l'aiuto dei gesti. */
export function GLStage({ glRef, overlayRef, view, className, label, children, hint = true, touch = "none" }: { glRef: RefObject<HTMLCanvasElement | null>; overlayRef: RefObject<HTMLCanvasElement | null>; view: MutableRefObject<OrbitView>; className: string; label: string; children?: ReactNode; hint?: boolean; touch?: "none" | "pan-y" }) {
  const [spinning, setSpinning] = useState(false);
  return (
    <div className={`aa-3d-wrap overflow-hidden rounded-2xl bg-[#9fb6c2] ${className}`}>
      <canvas ref={glRef} className="aa-3d absolute inset-0 block h-full w-full" aria-hidden />
      <canvas ref={overlayRef} className="absolute inset-0 block h-full w-full" style={{ touchAction: touch }} role="img" aria-label={`${label}: trascina per ruotare, due dita per ingrandire e spostare, doppio tocco per ripristinare`} />
      {children}
      <button
        type="button"
        aria-pressed={spinning}
        onClick={() => {
          const next = !spinning;
          view.current.auto = next;
          setSpinning(next);
        }}
        className={`absolute bottom-1.5 right-2 flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold backdrop-blur ${spinning ? "bg-[#7cf0a8] text-[#0b120e]" : "bg-black/55 text-white"}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden className={spinning ? "aa-spin-fast" : undefined}><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4h-4" /></svg>
        {spinning ? "Ferma" : "Gira"}
      </button>
      {hint && <span className="pointer-events-none absolute bottom-2 left-2 max-w-[62%] rounded-full bg-black/45 px-2 py-0.5 text-[0.6rem] leading-tight text-white/80">Trascina: gira · due dita: zoom · doppio tocco: ripristina</span>}
    </div>
  );
}
