import { useEffect, useRef, type ReactNode } from "react";
import { SHORTCUTS } from "@/lib/arcieri/shortcuts";

/**
 * Sfondo della categoria: una scena disegnata e molto sfocata dietro le pagine.
 * Non disturba la lettura (velo scuro sopra) e scorre appena con la pagina: un po' più lenta, e si avvicina leggermente.
 */
export type SceneId = "home" | "prepara" | "allena" | "analizza" | "gareggia" | "squadra";

export function sceneOf(path: string): SceneId {
  if (path === "/") return "home";
  if (path.startsWith("/arciere") || path.startsWith("/profilo")) return "squadra";
  const hit = [...SHORTCUTS].sort((a, b) => b.to.length - a.to.length).find((s) => s.to !== "/" && path.startsWith(s.to));
  return (hit?.group as SceneId) ?? "allena";
}

const T = (cx: number, cy: number, r: number) => (
  <g>
    {[["#f4f1ea", 1], ["#1d2126", 0.8], ["#2f7fd1", 0.6], ["#d63a2f", 0.4], ["#f2c94c", 0.2]].map(([c, f]) => (
      <circle key={c as string} cx={cx} cy={cy} r={r * (f as number)} fill={c as string} />
    ))}
  </g>
);
const A = (x1: number, y1: number, x2: number, y2: number, c: string, w = 7) => (
  <g>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1d2126" strokeWidth={w} strokeLinecap="round" />
    <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * 0.14} y2={y1 + (y2 - y1) * 0.14} stroke={c} strokeWidth={w * 4} strokeLinecap="round" />
  </g>
);

const ART: Record<SceneId, ReactNode> = {
  home: (
    <>
      <rect width="400" height="900" fill="#0f1a14" />
      <circle cx="80" cy="140" r="170" fill="#2c8a57" opacity="0.55" />
      {T(320, 250, 150)}
      {A(-20, 520, 250, 300, "#d63a2f")}
      {A(10, 600, 290, 330, "#f2c94c")}
      <circle cx="120" cy="760" r="200" fill="#c39320" opacity="0.35" />
    </>
  ),
  prepara: (
    <>
      <rect width="400" height="900" fill="#1b130c" />
      <rect y="520" width="400" height="380" fill="#6e4222" opacity="0.65" />
      <path d="M90 60 C300 250 300 600 90 820" fill="none" stroke="#c88a4f" strokeWidth="26" strokeLinecap="round" />
      <line x1="90" y1="60" x2="90" y2="820" stroke="#f4f1ea" strokeWidth="5" />
      {A(40, 300, 380, 180, "#d63a2f")}
      {A(30, 380, 390, 300, "#2f7fd1")}
      {A(50, 460, 380, 420, "#f2c94c")}
      <circle cx="330" cy="700" r="140" fill="#cc4f3b" opacity="0.35" />
    </>
  ),
  allena: (
    <>
      <rect width="400" height="900" fill="#13202a" />
      <rect width="400" height="420" fill="#2b5a86" opacity="0.6" />
      <rect y="560" width="400" height="340" fill="#2e6b34" />
      <path d="M0 560 Q200 500 400 560" fill="#3d8a4e" />
      <rect x="250" y="420" width="12" height="220" fill="#6e4222" transform="rotate(10 256 520)" />
      <rect x="320" y="420" width="12" height="220" fill="#6e4222" transform="rotate(-10 326 520)" />
      {T(290, 420, 120)}
      {A(-30, 470, 180, 430, "#d63a2f", 6)}
      <circle cx="60" cy="120" r="120" fill="#f2c94c" opacity="0.35" />
    </>
  ),
  analizza: (
    <>
      <rect width="400" height="900" fill="#0d1a1f" />
      {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1="0" x2="400" y1={200 + i * 100} y2={200 + i * 100} stroke="#1b9097" strokeWidth="3" opacity="0.5" />)}
      <rect x="40" y="520" width="60" height="260" rx="10" fill="#1b9097" />
      <rect x="140" y="420" width="60" height="360" rx="10" fill="#4568d6" />
      <rect x="240" y="330" width="60" height="450" rx="10" fill="#e07a2f" />
      <path d="M20 600 L130 470 L210 520 L380 240" fill="none" stroke="#7cf0e0" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="330" cy="140" r="130" fill="#5568c2" opacity="0.45" />
    </>
  ),
  gareggia: (
    <>
      <rect width="400" height="900" fill="#1d160a" />
      {[-40, -15, 10, 35, 60].map((a, i) => (
        <path key={i} d="M200 -40 L170 900 L230 900 Z" fill="#f6d24f" opacity="0.13" transform={`rotate(${a} 200 -40)`} />
      ))}
      <rect x="40" y="560" width="110" height="340" fill="#c9d0d8" />
      <rect x="145" y="440" width="110" height="460" fill="#f2c94c" />
      <rect x="250" y="620" width="110" height="280" fill="#d0864a" />
      <path d="M0 120 Q100 180 200 120 T400 120" fill="none" stroke="#c4475a" strokeWidth="8" />
      {[30, 90, 150, 210, 270, 330].map((x, i) => <path key={x} d={`M${x} ${130 + (i % 2) * 12} l20 0 l-10 40z`} fill={["#d63a2f", "#2f7fd1", "#f2c94c", "#2fbf71"][i % 4]} />)}
    </>
  ),
  squadra: (
    <>
      <rect width="400" height="900" fill="#14121c" />
      {[
        [70, 160, 90, "#4568d6"], [300, 230, 110, "#b8508a"], [160, 420, 130, "#3d8a4e"], [330, 560, 90, "#c39320"], [80, 700, 120, "#e07a2f"], [280, 820, 100, "#5568c2"],
      ].map(([x, y, r, c], i) => <circle key={i} cx={x as number} cy={y as number} r={r as number} fill={c as string} opacity="0.55" />)}
      <circle cx="150" cy="520" r="44" fill="#f3c9a1" opacity="0.6" />
      <path d="M80 700 C80 610 220 610 220 700" fill="#3d8a4e" opacity="0.7" />
      <circle cx="270" cy="480" r="38" fill="#e0b08a" opacity="0.55" />
      <path d="M210 640 C210 560 330 560 330 640" fill="#4568d6" opacity="0.65" />
    </>
  ),
};

export function Scene({ path }: { path: string }) {
  const id = sceneOf(path);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const y = window.scrollY;
      // scorre a un decimo della pagina e si avvicina appena: profondità, senza distrarre
      el.style.setProperty("--sy", String(Math.min(y, 4000)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} aria-hidden className="aa-scene">
      <svg key={id} viewBox="0 0 400 900" preserveAspectRatio="xMidYMid slice">
        {ART[id]}
      </svg>
      <span className="aa-scene-veil" />
    </div>
  );
}
