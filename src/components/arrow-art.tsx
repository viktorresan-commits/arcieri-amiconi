import { useId } from "react";

/**
 * Freccia vista di fianco, disegnata come una foto: asta (carbonio, legno, alluminio…), cocca,
 * fascia, impennaggio di forme diverse (come nei cataloghi) e punta.
 * Cocca a sinistra, punta a destra.
 */

export const FLETCH_SHAPES = [
  { id: "alette", label: "Alette classiche" },
  { id: "penne", label: "Penne naturali" },
  { id: "scudo", label: "Penne a scudo (FF 418)" },
  { id: "plastifletch", label: "Plastifletch" },
  { id: "blazer", label: "Blazer" },
  { id: "fusion", label: "Fusion" },
  { id: "quickspin", label: "Quickspin" },
  { id: "spin", label: "Spin wing" },
  { id: "fob", label: "FOB (anello)" },
] as const;

export const POINT_TYPES = [
  { id: "ogiva", label: "Ogiva (bullet)" },
  { id: "field", label: "Field" },
  { id: "3d", label: "Punta 3D" },
  { id: "caccia", label: "Lama da caccia" },
  { id: "gommino", label: "Gommino" },
] as const;

const SHAFTS: Record<string, { a: string; b: string; c: string }> = {
  carbonio: { a: "#3a3f45", b: "#15181c", c: "#2a2e33" },
  legno: { a: "#ecc48c", b: "#b07a3c", c: "#d6a466" },
  alluminio: { a: "#e3e8ec", b: "#7d8a95", c: "#b3bec7" },
  "carbo-alluminio": { a: "#8a949e", b: "#2b3036", c: "#565f68" },
  bambu: { a: "#e3d08a", b: "#a48a3e", c: "#cdb86a" },
};

function shade(hex: string, k: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  const out = (ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255);
  return `#${out.toString(16).padStart(6, "0")}`;
}

type Vane = (x: number, y: number, dir: 1 | -1) => string;

const VANES: Record<string, { len: number; path: Vane }> = {
  alette: { len: 46, path: (x, y, d) => `M${x} ${y} L${x + 4} ${y + d * 9} L${x + 30} ${y + d * 9} L${x + 46} ${y} Z` },
  penne: { len: 74, path: (x, y, d) => `M${x} ${y} C${x - 1} ${y + d * 14} ${x + 30} ${y + d * 13} ${x + 74} ${y} Z` },
  scudo: { len: 72, path: (x, y, d) => `M${x} ${y} L${x + 1} ${y + d * 10} Q${x + 6} ${y + d * 12.5} ${x + 26} ${y + d * 12} Q${x + 52} ${y + d * 9} ${x + 72} ${y} Z` },
  plastifletch: { len: 52, path: (x, y, d) => `M${x} ${y} L${x + 3} ${y + d * 9.5} C${x + 22} ${y + d * 10} ${x + 42} ${y + d * 5} ${x + 52} ${y} Z` },
  blazer: { len: 34, path: (x, y, d) => `M${x} ${y} C${x} ${y + d * 12} ${x + 12} ${y + d * 13} ${x + 34} ${y} Z` },
  fusion: { len: 48, path: (x, y, d) => `M${x} ${y} L${x + 2} ${y + d * 8} C${x + 14} ${y + d * 11.5} ${x + 32} ${y + d * 7} ${x + 48} ${y} Z` },
  quickspin: { len: 40, path: (x, y, d) => `M${x} ${y} Q${x} ${y + d * 10.5} ${x + 14} ${y + d * 10.5} Q${x + 32} ${y + d * 9} ${x + 40} ${y} Z` },
  spin: { len: 40, path: (x, y, d) => `M${x} ${y} C${x + 2} ${y + d * 14} ${x + 30} ${y + d * 13} ${x + 40} ${y} Z` },
};

export function ArrowArt({
  material = "carbonio",
  shaft = "",
  fletch = "#d63a2f",
  cock = "#e6b325",
  nock = "#f4f1ea",
  wrap = "",
  fletchType = "alette",
  point = "ogiva",
  number,
  className = "h-9 w-full",
  shine = true,
}: {
  material?: string;
  /** colore dell'asta: se vuoto vale quello del materiale */
  shaft?: string;
  fletch?: string;
  cock?: string;
  nock?: string;
  wrap?: string;
  fletchType?: string;
  point?: string;
  number?: string | number;
  className?: string;
  shine?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const sh = shaft ? { a: shade(shaft, 0.35), c: shaft, b: shade(shaft, -0.45) } : (SHAFTS[material] ?? SHAFTS.carbonio);
  const y = 18;
  const r = 2.4; // mezzo spessore dell'asta
  const x0 = 16; // fine della cocca
  const x1 = 290; // inizio della punta
  const vane = VANES[fletchType] ?? VANES.alette;
  const fx = x0 + 10; // le alette partono poco dopo la cocca
  return (
    <svg viewBox="0 0 320 36" className={className} aria-hidden preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`sh-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sh.a} />
          <stop offset="45%" stopColor={sh.c} />
          <stop offset="100%" stopColor={sh.b} />
        </linearGradient>
        <linearGradient id={`mt-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1f4f6" />
          <stop offset="50%" stopColor="#9ea9b2" />
          <stop offset="100%" stopColor="#5d6770" />
        </linearGradient>
        <linearGradient id={`vn-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" stopOpacity="0.22" />
          <stop offset="40%" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.08" />
        </linearGradient>
        <pattern id={`cf-${id}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="transparent" />
          <rect width="2" height="4" fill="#fff" opacity="0.05" />
        </pattern>
      </defs>
      {/* ombra a terra */}
      <ellipse cx="160" cy="31" rx="135" ry="1.2" fill="#000" opacity="0.12" />
      {/* asta */}
      <rect x={x0} y={y - r} width={x1 - x0} height={r * 2} rx={r} fill={`url(#sh-${id})`} />
      {material === "carbonio" ? <rect x={x0} y={y - r} width={x1 - x0} height={r * 2} fill={`url(#cf-${id})`} /> : null}
      {material === "legno" ? (
        <path d={`M${x0 + 20} ${y - 0.6} L${x1 - 10} ${y - 0.9} M${x0 + 60} ${y + 0.9} L${x1 - 40} ${y + 0.6}`} stroke="#7a4f22" strokeOpacity="0.35" strokeWidth="0.5" />
      ) : null}
      {material === "bambu" ? [90, 160, 230].map((x) => <rect key={x} x={x} y={y - r - 0.3} width="2" height={r * 2 + 0.6} rx="0.8" fill="#8a7330" />) : null}
      {shine ? <rect x={x0 + 2} y={y - r + 0.5} width={x1 - x0 - 4} height="0.9" rx="0.45" fill="#fff" opacity="0.28" /> : null}
      {/* fascia (cresting) */}
      {wrap ? (
        <>
          <rect x={x0 + 2} y={y - r - 0.2} width={vane.len + 22} height={r * 2 + 0.4} fill={wrap} />
          <rect x={x0 + vane.len + 26} y={y - r - 0.2} width="3" height={r * 2 + 0.4} fill={wrap} />
          <rect x={x0 + vane.len + 32} y={y - r - 0.2} width="1.6" height={r * 2 + 0.4} fill={wrap} />
        </>
      ) : null}
      {/* numero stampato sull'asta */}
      {number != null && number !== "" ? (
        <text x={x0 + vane.len + 52} y={y + 1.9} fontSize="5.4" fontWeight="700" fill={material === "alluminio" || material === "legno" || material === "bambu" ? "#14181c" : "#f4f1ea"} fontFamily="system-ui, sans-serif">
          {number}
        </text>
      ) : null}
      {/* impennaggio */}
      {fletchType === "fob" ? (
        <g>
          <rect x={fx + 2} y={y - 8} width="14" height="16" rx="3.5" fill={fletch} />
          <rect x={fx + 2} y={y - 8} width="14" height="16" rx="3.5" fill={`url(#vn-${id})`} />
          <ellipse cx={fx + 16} cy={y} rx="2.2" ry="8" fill={fletch} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
          <ellipse cx={fx + 16} cy={y} rx="1" ry="4.2" fill="#000" opacity="0.25" />
        </g>
      ) : (
        <g>
          <path d={vane.path(fx, y - r + 0.3, -1)} fill={fletch} />
          <path d={vane.path(fx, y - r + 0.3, -1)} fill={`url(#vn-${id})`} />
          <path d={vane.path(fx, y + r - 0.3, 1)} fill={fletch} />
          <path d={vane.path(fx, y + r - 0.3, 1)} fill="#000" opacity="0.18" />
          {/* penna guida, vista di sbieco sopra l'asta */}
          <path d={vane.path(fx + 2, y - 0.2, -1)} transform={`translate(0 ${y * 0.45}) scale(1 0.55)`} fill={cock} opacity="0.95" />
          {fletchType === "penne" || fletchType === "scudo" ? (
            <path d={`M${fx + 2} ${y - r} L${fx + vane.len - 4} ${y - r - 0.2}`} stroke="#fff" strokeOpacity="0.35" strokeWidth="0.5" />
          ) : null}
          {fletchType === "quickspin" ? <path d={`M${fx + 4} ${y - 6} Q${fx + 20} ${y - 9} ${fx + 34} ${y - 3}`} stroke="#fff" strokeOpacity="0.45" strokeWidth="0.8" fill="none" /> : null}
        </g>
      )}
      {/* cocca */}
      <g>
        <path d={`M${x0 + 1} ${y - r - 0.6} L${x0 - 8} ${y - r - 0.9} L${x0 - 12} ${y - 3.6} L${x0 - 12} ${y - 1.1} L${x0 - 7} ${y - 1.1} L${x0 - 7} ${y + 1.1} L${x0 - 12} ${y + 1.1} L${x0 - 12} ${y + 3.6} L${x0 - 8} ${y + r + 0.9} L${x0 + 1} ${y + r + 0.6} Z`} fill={nock} stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
        <rect x={x0 - 8} y={y - r} width="7" height="1" fill="#fff" opacity="0.35" />
      </g>
      {/* punta */}
      {point === "field" ? (
        <path d={`M${x1 - 1} ${y - r - 0.3} L${x1 + 16} ${y - r - 0.3} L${x1 + 26} ${y} L${x1 + 16} ${y + r + 0.3} L${x1 - 1} ${y + r + 0.3} Z`} fill={`url(#mt-${id})`} />
      ) : point === "caccia" ? (
        <g>
          <rect x={x1 - 1} y={y - r - 0.2} width="10" height={r * 2 + 0.4} fill={`url(#mt-${id})`} />
          <path d={`M${x1 + 8} ${y - 9} L${x1 + 28} ${y} L${x1 + 8} ${y + 9} L${x1 + 12} ${y} Z`} fill={`url(#mt-${id})`} stroke="#3b444c" strokeWidth="0.5" />
        </g>
      ) : point === "gommino" ? (
        <g>
          <rect x={x1 - 1} y={y - 3.4} width="14" height="6.8" rx="1.5" fill="#1d1f22" />
          <circle cx={x1 + 14} cy={y} r="4.2" fill="#26292d" />
          <rect x={x1} y={y - 2.6} width="12" height="1" fill="#fff" opacity="0.15" />
        </g>
      ) : point === "3d" ? (
        <path d={`M${x1 - 1} ${y - r - 0.3} L${x1 + 12} ${y - r - 0.3} L${x1 + 14} ${y - r - 1.2} L${x1 + 28} ${y} L${x1 + 14} ${y + r + 1.2} L${x1 + 12} ${y + r + 0.3} L${x1 - 1} ${y + r + 0.3} Z`} fill={`url(#mt-${id})`} />
      ) : (
        <path d={`M${x1 - 1} ${y - r - 0.3} L${x1 + 14} ${y - r - 0.3} Q${x1 + 28} ${y} ${x1 + 14} ${y + r + 0.3} L${x1 - 1} ${y + r + 0.3} Z`} fill={`url(#mt-${id})`} />
      )}
    </svg>
  );
}
