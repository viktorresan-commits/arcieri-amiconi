import { useEffect, useRef, useState } from "react";

/**
 * Bersaglio in pseudo-3D che si inclina col dito / col mouse / col giroscopio.
 * Le ultime frecce (punteggi 0..10) sono piantate sul visuale con un'angolazione fissa
 * per ogni indice, così restano stabili tra un render e l'altro.
 */
export function HeroTarget({ scores, size = 132 }: { scores: number[]; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: -14, y: 18 });
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    let t0 = performance.now();
    let user = 0;
    const idle = (now: number) => {
      if (now - user > 2500) {
        const t = (now - t0) / 1000;
        setTilt({ x: -12 + Math.sin(t * 0.7) * 6, y: 16 + Math.cos(t * 0.5) * 12 });
      }
      raf = requestAnimationFrame(idle);
    };
    raf = requestAnimationFrame(idle);
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      user = performance.now();
      setTilt({ x: Math.max(-28, Math.min(28, -(e.beta - 45) * 0.6)), y: Math.max(-30, Math.min(30, e.gamma * 0.8)) });
    };
    window.addEventListener("deviceorientation", onOrient);
    const el = ref.current;
    const onMove = (e: PointerEvent) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      user = performance.now();
      t0 = performance.now();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      setTilt({ x: -ny * 50, y: nx * 50 });
    };
    el?.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("deviceorientation", onOrient);
      el?.removeEventListener("pointermove", onMove);
    };
  }, []);

  const rings = [
    { r: 50, c: "#f1f3f5" },
    { r: 45, c: "#e9edf1" },
    { r: 40, c: "#24292f" },
    { r: 35, c: "#2c3238" },
    { r: 30, c: "#2f7fd1" },
    { r: 25, c: "#3b8ce0" },
    { r: 20, c: "#d8343a" },
    { r: 15, c: "#e5484d" },
    { r: 10, c: "#f0b429" },
    { r: 5, c: "#f6c945" },
  ];
  const shown = scores.slice(-6);
  return (
    <div ref={ref} className="relative touch-none select-none" style={{ width: size, height: size, perspective: 520 }} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* spessore del paglione */}
        {[6, 4, 2].map((z) => (
          <div key={z} className="absolute inset-0 rounded-full" style={{ transform: `translateZ(${-z}px)`, background: "#3a2f22", boxShadow: "0 0 0 1px rgba(0,0,0,.3)" }} />
        ))}
        <svg viewBox="-52 -52 104 104" className="absolute inset-0 h-full w-full drop-shadow-[0_8px_18px_rgba(0,0,0,.45)]">
          <defs>
            <radialGradient id="hero-sheen" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
              <stop offset="60%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
          {rings.map((ring) => (
            <circle key={ring.r} r={ring.r} fill={ring.c} stroke="rgba(0,0,0,.25)" strokeWidth={0.3} />
          ))}
          <path d="M-1.4 0H1.4M0 -1.4V1.4" stroke="#222" strokeWidth={0.5} />
          <circle r={50} fill="url(#hero-sheen)" />
        </svg>
        {shown.map((score, i) => {
          const a = i * 2.39996 + 0.6;
          const rad = Math.max(1.5, (10.5 - Math.max(0, Math.min(10, score))) * 4.6);
          const x = 50 + Math.cos(a) * rad;
          const y = 50 + Math.sin(a) * rad;
          const fl = ["#e5484d", "#2f7fd1", "#f0b429", "#3d8f5f", "#c4a2f2", "#f4f1ea"][i % 6];
          return (
            <div
              key={i}
              className="absolute"
              style={{ left: `${x}%`, top: `${y}%`, transformStyle: "preserve-3d", transform: "translate(-50%,-50%)" }}
            >
              {/* asta che esce dal bersaglio verso chi guarda */}
              <div
                className="aa-in absolute left-0 top-0"
                style={{
                  width: 2,
                  height: 46,
                  marginLeft: -1,
                  transformOrigin: "50% 0%",
                  transform: "rotateX(90deg)",
                  background: "linear-gradient(#1b1f24, #3b4148 70%, #e8e4da 70%, #e8e4da 74%, #1b1f24 74%)",
                  animationDelay: `${300 + i * 140}ms`,
                }}
              >
                <div className="absolute bottom-0 left-1/2 h-4 w-3 -translate-x-1/2 rounded-sm" style={{ background: fl, clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />
              </div>
              <div className="absolute -left-[3px] -top-[3px] h-1.5 w-1.5 rounded-full bg-black/70" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
