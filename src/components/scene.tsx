import type { ReactNode } from "react";
import { SHORTCUTS } from "@/lib/arcieri/shortcuts";

/**
 * Sfondo della categoria: una scena disegnata e molto sfocata dietro le pagine.
 * Non disturba la lettura (velo scuro sopra) e resta ferma mentre la pagina scorre.
 */
export type SceneId = "home" | "prepara" | "allena" | "strumenti" | "analizza" | "gareggia" | "impara" | "squadra";

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
/** Arciere in trazione, di profilo (guarda a destra). x,y = piedi; s = scala (alto ~ 220·s). */
const Archer = (x: number, y: number, s: number, c = "#0b0f0c", flip = false) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill={c} stroke={c} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="0" cy="-196" r="17" stroke="none" />
    <path d="M-10 -178 L10 -178 L16 -110 L-14 -110 Z" stroke="none" />
    <path d="M-12 -112 L-26 0 M12 -112 L24 0" strokeWidth="15" fill="none" />
    <path d="M6 -168 L96 -170" strokeWidth="11" fill="none" />
    <path d="M-4 -166 L-30 -186 L4 -190" strokeWidth="10" fill="none" />
    <path d="M96 -262 C130 -220 130 -120 96 -78" strokeWidth="7" fill="none" />
    <path d="M96 -262 L2 -190 L96 -78" strokeWidth="1.6" fill="none" opacity="0.8" />
    <path d="M2 -190 L130 -190" strokeWidth="3" fill="none" />
  </g>
);

const ART: Record<SceneId, ReactNode> = {
  home: (
    <>
      <rect width="400" height="900" fill="#14120f" />
      <rect width="400" height="520" fill="#e07a2f" opacity="0.38" />
      <circle cx="300" cy="300" r="110" fill="#f6c43a" opacity="0.55" />
      <rect y="560" width="400" height="340" fill="#1f3d1f" />
      {T(320, 520, 70)}
      {Archer(80, 700, 1.1)}
      <circle cx="60" cy="140" r="150" fill="#2c8a57" opacity="0.4" />
    </>
  ),
  prepara: (
    <>
      <rect width="400" height="900" fill="#1b130c" />
      <rect y="560" width="400" height="340" fill="#6e4222" opacity="0.7" />
      <path d="M110 80 C300 260 300 560 110 760" fill="none" stroke="#c88a4f" strokeWidth="26" strokeLinecap="round" />
      <line x1="110" y1="80" x2="110" y2="760" stroke="#f4f1ea" strokeWidth="5" />
      <rect x="250" y="380" width="70" height="300" rx="16" fill="#8a5a2e" transform="rotate(8 285 530)" />
      {A(270, 390, 250, 120, "#d63a2f")}
      {A(295, 392, 300, 110, "#2f7fd1")}
      {A(315, 396, 345, 130, "#f2c94c")}
      <circle cx="80" cy="820" r="120" fill="#cc4f3b" opacity="0.3" />
    </>
  ),
  allena: (
    <>
      <rect width="400" height="900" fill="#13202a" />
      <rect width="400" height="430" fill="#3b6f9e" opacity="0.6" />
      <rect y="430" width="400" height="470" fill="#2e6b34" />
      <path d="M0 430 Q200 400 400 430" fill="#3d8a4e" />
      {[[70, 450, 26], [180, 446, 30], [300, 452, 26]].map(([x, y, r]) => <g key={x}>{T(x, y, r)}</g>)}
      {[60, 180, 300].map((x) => <rect key={x} x={x - 4} y="470" width="8" height="70" fill="#6e4222" />)}
      {Archer(110, 860, 1.6, "#0a120c")}
      <circle cx="320" cy="110" r="90" fill="#f2c94c" opacity="0.4" />
    </>
  ),
  strumenti: (
    <>
      <rect width="400" height="900" fill="#0d1726" />
      {Array.from({ length: 12 }, (_, i) => <line key={`v${i}`} x1={i * 36} x2={i * 36} y1="0" y2="900" stroke="#2f6fd1" strokeOpacity="0.35" strokeWidth="2" />)}
      {Array.from({ length: 26 }, (_, i) => <line key={`h${i}`} x1="0" x2="400" y1={i * 36} y2={i * 36} stroke="#2f6fd1" strokeOpacity="0.35" strokeWidth="2" />)}
      {A(30, 420, 380, 300, "#d63a2f", 9)}
      <path d="M200 380 l-40 120 h80 z" fill="#9aa3ad" />
      <path d="M40 620 Q200 500 360 620" fill="none" stroke="#7cf0e0" strokeWidth="10" strokeDasharray="20 16" />
      <circle cx="320" cy="150" r="110" fill="#2f6fd1" opacity="0.5" />
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
      {T(320, 140, 90)}
    </>
  ),
  gareggia: (
    <>
      <rect width="400" height="900" fill="#1d160a" />
      {[-40, -15, 10, 35, 60].map((a, i) => (
        <path key={i} d="M200 -40 L170 900 L230 900 Z" fill="#f6d24f" opacity="0.13" transform={`rotate(${a} 200 -40)`} />
      ))}
      <rect x="40" y="620" width="110" height="280" fill="#c9d0d8" />
      <rect x="145" y="540" width="110" height="360" fill="#f2c94c" />
      <rect x="250" y="680" width="110" height="220" fill="#d0864a" />
      {Archer(185, 540, 1.1, "#f6d24f")}
      <path d="M0 120 Q100 180 200 120 T400 120" fill="none" stroke="#c4475a" strokeWidth="8" />
      {[30, 90, 150, 210, 270, 330].map((x, i) => <path key={x} d={`M${x} ${130 + (i % 2) * 12} l20 0 l-10 40z`} fill={["#d63a2f", "#2f7fd1", "#f2c94c", "#2fbf71"][i % 4]} />)}
    </>
  ),
  impara: (
    <>
      <rect width="400" height="900" fill="#1a1410" />
      <rect y="520" width="400" height="380" fill="#2e4a24" />
      {[30, 120, 330, 380].map((x, i) => <path key={x} d={`M${x} 540 l-50 0 l50 -${220 + i * 30} l50 ${220 + i * 30}z`} fill="#1f3a1d" />)}
      <path d="M200 640 q20 -90 110 -86 q60 0 70 50 l0 60 l-20 20 l-150 0 z" fill="#7a5230" />
      <circle cx="300" cy="600" r="16" fill="#f4f1ea" />
      <circle cx="300" cy="600" r="7" fill="#d63a2f" />
      <rect x="40" y="120" width="160" height="110" rx="24" fill="#5568c2" />
      <path d="M80 230 l-20 40 l50 -40z" fill="#5568c2" />
      <circle cx="320" cy="150" r="80" fill="#d6582a" opacity="0.55" />
      {Archer(70, 860, 1.25, "#e8b47a")}
    </>
  ),
  squadra: (
    <>
      <rect width="400" height="900" fill="#14121c" />
      {[
        [70, 160, 90, "#4568d6"], [300, 230, 110, "#b8508a"], [330, 560, 90, "#c39320"], [280, 820, 100, "#5568c2"],
      ].map(([x, y, r, c], i) => <circle key={i} cx={x as number} cy={y as number} r={r as number} fill={c as string} opacity="0.55" />)}
      {Archer(70, 760, 1.05, "#4fcf8a")}
      {Archer(190, 800, 1.2, "#7d9cff")}
      {Archer(320, 760, 1.05, "#e07ab8", true)}
    </>
  ),
};

export function Scene({ path }: { path: string }) {
  const id = sceneOf(path);
  return (
    <div aria-hidden className="aa-scene">
      <svg key={id} viewBox="0 0 400 900" preserveAspectRatio="xMidYMid slice">
        {ART[id]}
      </svg>
      <span className="aa-scene-veil" />
    </div>
  );
}
