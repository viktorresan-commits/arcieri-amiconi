/**
 * Insegne: emblemi d'effetto per gare, premi, obiettivi e per le tre tipologie (minigioco, allenamento,
 * gara di campionato). Ogni insegna è coniata: bordo di metallo con smusso e perline, campo di smalto
 * con guilloché, simbolo in rilievo (ombra, luce, metallo), riflesso lucido, raggi e scintille per le
 * più preziose. Al tocco si piega e un lampo di luce la attraversa. Tutto SVG, niente filtri pesanti.
 */
import { useId, useState, type ReactNode } from "react";

export type InsMetal = "gold" | "silver" | "bronze" | "platinum" | "iron";
export type InsEnamel = "ruby" | "emerald" | "sapphire" | "amethyst" | "night" | "ivory" | "teal" | "amber";
export type InsShape = "round" | "shield" | "hex" | "rosette";
export type InsSymbol =
  | "target"
  | "quiver"
  | "dice"
  | "trophy"
  | "peak"
  | "star"
  | "bow"
  | "arrow"
  | "flame"
  | "rise"
  | "calendar"
  | "duel"
  | "podium"
  | "laurel"
  | "check";

/** metallo: luce, chiaro, medio, scuro, ombra profonda */
const METAL: Record<InsMetal, [string, string, string, string, string]> = {
  gold: ["#fff8d6", "#f7d774", "#dca733", "#9a6a12", "#4f3406"],
  silver: ["#ffffff", "#eef2f6", "#c3ccd5", "#7f8a96", "#3b434c"],
  bronze: ["#ffe3c4", "#eaa86b", "#bb773d", "#7c471d", "#40230d"],
  platinum: ["#ffffff", "#f1eefb", "#d3cdee", "#918abb", "#433d66"],
  iron: ["#e9eef2", "#aeb8c1", "#7c8893", "#4c5761", "#262d33"],
};
/** smalto: chiaro, pieno, profondo */
const ENAMEL: Record<InsEnamel, [string, string, string]> = {
  ruby: ["#ff7a8a", "#c41d3a", "#4e0614"],
  emerald: ["#6be8a8", "#14905c", "#05331f"],
  sapphire: ["#7cc0ff", "#2063c8", "#091f4d"],
  amethyst: ["#d2b0ff", "#7d48d8", "#2a1158"],
  night: ["#5a6f99", "#1e2b48", "#090f1e"],
  ivory: ["#fffdf6", "#efe2c4", "#a89169"],
  teal: ["#72f0e0", "#139a8e", "#043b37"],
  amber: ["#ffd88a", "#d98a14", "#5a3104"],
};
const RIBBON: Record<InsEnamel, [string, string]> = {
  ruby: ["#8a1426", "#f7d774"],
  emerald: ["#0f5c3a", "#f7d774"],
  sapphire: ["#173f86", "#eef2f6"],
  amethyst: ["#4b2591", "#f1eefb"],
  night: ["#1e2b48", "#c3ccd5"],
  ivory: ["#7a2e22", "#f7d774"],
  teal: ["#0b5a54", "#eef2f6"],
  amber: ["#7a3f06", "#fff8d6"],
};

/** smalto da un colore qualsiasi (#rrggbb): più chiaro in luce, più scuro in fondo */
function enamelFromHex(hex: string): [string, string, string] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return ENAMEL.night;
  const n = parseInt(m[1], 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const mix = (t: number, to: number) => `#${rgb.map((v) => Math.round(v + (to - v) * t).toString(16).padStart(2, "0")).join("")}`;
  return [mix(0.42, 255), mix(0.08, 0), mix(0.72, 0)];
}

const C = 60;
const scaleAt = (k: number) => `translate(${C} ${C}) scale(${k}) translate(${-C} ${-C})`;

function shapePath(shape: InsShape): string {
  if (shape === "shield") return "M60 7 C74 13 92 13 105 9 L105 50 C105 81 87 101 60 114 C33 101 15 81 15 50 L15 9 C28 13 46 13 60 7 Z";
  if (shape === "hex") {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = ((-90 + i * 60) * Math.PI) / 180;
      return `${(C + Math.cos(a) * 55).toFixed(2)} ${(C + Math.sin(a) * 55).toFixed(2)}`;
    });
    return `M${pts.join(" L")} Z`;
  }
  if (shape === "rosette") {
    const n = 16;
    const pts = Array.from({ length: n * 2 }, (_, i) => {
      const a = ((i * 180) / n - 90) * (Math.PI / 180);
      const r = i % 2 ? 48.5 : 55;
      return `${(C + Math.cos(a) * r).toFixed(2)} ${(C + Math.sin(a) * r).toFixed(2)}`;
    });
    return `M${pts.join(" L")} Z`;
  }
  return "M60 9 A51 51 0 1 1 59.99 9 Z";
}

/** il simbolo, su una griglia 100×100: c = metallo, d = intagli (colore del fondo) */
function symbolArt(symbol: InsSymbol, c: string, d: string): ReactNode {
  const ln = { fill: "none", stroke: c, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (symbol) {
    case "target":
      return (
        <g>
          <circle cx="44" cy="56" r="33" {...ln} strokeWidth="7" />
          <circle cx="44" cy="56" r="20" {...ln} strokeWidth="7" />
          <circle cx="44" cy="56" r="7.5" fill={c} />
          <path d="M48 52 L86 14" {...ln} strokeWidth="5" />
          <path d="M95.2 13.3 L86 14 L86.7 4.8 M91 17.5 L81.8 18.2 L82.5 9 M86.7 21.8 L77.5 22.5 L78.2 13.3" {...ln} strokeWidth="3.4" />
          <path d="M44 56 L52 48" stroke={d} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case "quiver":
      return (
        <g transform="rotate(14 50 56)">
          {[-16, -2, 12].map((a, i) => (
            <g key={i} transform={`rotate(${a} 50 34)`}>
              <path d="M50 34 L50 12" {...ln} strokeWidth="4" />
              <path d="M50 0 C42 5 41.5 15 50 22 C58.5 15 58 5 50 0 Z" fill={c} />
              <path d="M50 3 L50 20" stroke={d} strokeWidth="1.5" strokeLinecap="round" />
            </g>
          ))}
          <rect x="27" y="28" width="46" height="13" rx="5" fill={c} />
          <path d="M31 41 H69 L65 92 C65 97 61 100 57 100 H43 C39 100 35 97 35 92 Z" fill={c} />
          <path d="M32.5 52 H67.5 M34.6 84 H65.4" stroke={d} strokeWidth="3" strokeLinecap="round" />
          <path d="M42 59 L50 66 L58 59 M42 70 L50 77 L58 70" fill="none" stroke={d} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="32" cy="34.5" r="2.2" fill={d} />
          <circle cx="68" cy="34.5" r="2.2" fill={d} />
          <path d="M69 44 C86 56 86 80 66 92" {...ln} strokeWidth="4" />
        </g>
      );
    case "dice":
      return (
        <g>
          <path d="M50 18 L82 34 L50 50 L18 34 Z" fill={c} />
          <path d="M18 34 L50 50 L50 88 L18 72 Z" fill={c} />
          <path d="M82 34 L50 50 L50 88 L82 72 Z" fill={c} />
          <path d="M50 18 L82 34 L82 72 L50 88 L18 72 L18 34 Z M18 34 L50 50 L82 34 M50 50 L50 88" fill="none" stroke={d} strokeWidth="1.8" strokeLinejoin="round" />
          <ellipse cx="50" cy="34" rx="5.4" ry="2.9" fill={d} />
          <ellipse cx="27" cy="47.5" rx="2.9" ry="3.8" transform="rotate(-28 27 47.5)" fill={d} />
          <ellipse cx="41" cy="73" rx="2.9" ry="3.8" transform="rotate(-28 41 73)" fill={d} />
          <ellipse cx="59" cy="74.5" rx="2.9" ry="3.8" transform="rotate(28 59 74.5)" fill={d} />
          <ellipse cx="66" cy="61.5" rx="2.9" ry="3.8" transform="rotate(28 66 61.5)" fill={d} />
          <ellipse cx="73" cy="48.5" rx="2.9" ry="3.8" transform="rotate(28 73 48.5)" fill={d} />
          <path d="M86 6 L88 13 L95 15 L88 17 L86 24 L84 17 L77 15 L84 13 Z" fill={c} />
        </g>
      );
    case "trophy":
      return (
        <g>
          <path d="M26 16 H74 V36 C74 54 63 64 50 64 C37 64 26 54 26 36 Z" fill={c} />
          <path d="M27 22 H15 C13 38 20 47 31 49 M73 22 H85 C87 38 80 47 69 49" {...ln} strokeWidth="5" />
          <path d="M45 64 H55 V75 H45 Z" fill={c} />
          <path d="M34 75 H66 L70 85 H30 Z" fill={c} />
          <rect x="24" y="85" width="52" height="8" rx="2" fill={c} />
          <path d="M50 25 L53.4 32.6 L61.6 33.2 L55.2 38.4 L57.3 46.4 L50 41.9 L42.7 46.4 L44.8 38.4 L38.4 33.2 L46.6 32.6 Z" fill={d} />
          <path d="M28 20 H72" stroke={d} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M30 89 H70" stroke={d} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
    case "peak":
      return (
        <g>
          <path d="M8 90 L42 34 L57 56 L68 42 L94 90 Z" fill={c} />
          <path d="M42 34 L50 47 L45 45 L40 51 L36 44 Z M68 42 L74 51 L70 50 L66 54 L63 49 Z" fill={d} />
          <path d="M42 34 V8" {...ln} strokeWidth="3.4" />
          <path d="M43 8 C52 6 58 12 68 9 L66 20 C57 23 51 17 43 20 Z" fill={c} />
          <path d="M20 90 L32 72 M80 90 L72 78" stroke={d} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case "star":
      return (
        <g>
          <path d="M50 8 L61.2 36.4 L91.6 38.2 L68 57.6 L75.6 87.2 L50 70.8 L24.4 87.2 L32 57.6 L8.4 38.2 L38.8 36.4 Z" fill={c} />
          <path d="M50 8 L50 70.8 M91.6 38.2 L50 52 L8.4 38.2 M75.6 87.2 L50 52 L24.4 87.2" fill="none" stroke={d} strokeWidth="1.5" strokeOpacity="0.75" strokeLinejoin="round" />
        </g>
      );
    case "bow":
      return (
        <g>
          <path d="M34 10 C74 26 74 74 34 90" {...ln} strokeWidth="7.5" />
          <path d="M34 10 L34 90" {...ln} strokeWidth="1.8" />
          <path d="M18 50 H84" {...ln} strokeWidth="4" />
          <path d="M96 50 L82 43 L82 57 Z" fill={c} />
          <path d="M14 42 L24 50 L14 58 M20 42 L30 50 L20 58" {...ln} strokeWidth="3.2" />
          <path d="M61 38 C63 44 63 56 61 62" stroke={d} strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      );
    case "arrow":
      return (
        <g>
          <path d="M16 84 L76 24" {...ln} strokeWidth="7" />
          <path d="M94 6 L68 14 L86 32 Z" fill={c} />
          <path d="M8 74 C10 80 14 86 22 90 L30 82 L18 70 Z M20 62 C22 68 26 74 34 78 L40 72 L28 58 Z" fill={c} />
          <path d="M82 14 L86 10" stroke={d} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M14 78 L22 86 M26 66 L34 74" stroke={d} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
    case "flame":
      return (
        <g>
          <path d="M50 6 C64 24 78 34 74 58 C71 78 60 92 50 92 C36 92 24 81 24 64 C24 50 33 43 36 30 C42 40 46 43 50 40 C51 30 49 18 50 6 Z" fill={c} />
          <path d="M50 52 C58 60 62 66 60 76 C58 84 54 86 50 86 C44 86 40 81 40 75 C40 68 45 64 46 58 C48 62 50 62 51 60 Z" fill={d} />
        </g>
      );
    case "rise":
      return (
        <g>
          <rect x="16" y="66" width="13" height="24" rx="2" fill={c} />
          <rect x="35" y="56" width="13" height="34" rx="2" fill={c} />
          <rect x="54" y="44" width="13" height="46" rx="2" fill={c} />
          <path d="M12 58 L36 38 L52 46 L80 18" {...ln} strokeWidth="5" />
          <path d="M90 8 L72 12 L86 26 Z" fill={c} />
          <path d="M19 70 H26 M38 60 H45 M57 48 H64" stroke={d} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case "calendar":
      return (
        <g>
          <rect x="14" y="20" width="72" height="70" rx="9" fill={c} />
          <path d="M14 38 H86" stroke={d} strokeWidth="3" />
          <path d="M32 12 V28 M68 12 V28" {...ln} strokeWidth="6" />
          {[0, 1, 2].map((r) => [0, 1, 2, 3].map((k) => <rect key={`${r}${k}`} x={22 + k * 15} y={46 + r * 13} width="10" height="8" rx="1.6" fill={d} opacity={r === 1 && k === 2 ? 0 : 0.85} />))}
          <path d="M52 64 L57 70 L68 57" fill="none" stroke={d} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "duel":
      return (
        <g>
          <path d="M16 86 L76 20" {...ln} strokeWidth="5" />
          <path d="M86 10 L70 14 L80 26 Z" fill={c} />
          <path d="M84 86 L24 20" {...ln} strokeWidth="5" />
          <path d="M14 10 L30 14 L20 26 Z" fill={c} />
          <path d="M12 74 L20 82 L12 90 M18 70 L26 78 M88 74 L80 82 L88 90 M82 70 L74 78" {...ln} strokeWidth="3.2" />
          <path d="M50 38 L64 44 V56 C64 66 57 72 50 75 C43 72 36 66 36 56 V44 Z" fill={c} />
          <path d="M50 45 L57 48.5 V56 C57 61 54 64.5 50 66.5 C46 64.5 43 61 43 56 V48.5 Z" fill={d} />
        </g>
      );
    case "podium":
      return (
        <g>
          <rect x="36" y="40" width="28" height="50" rx="2" fill={c} />
          <rect x="8" y="56" width="28" height="34" rx="2" fill={c} />
          <rect x="64" y="66" width="28" height="24" rx="2" fill={c} />
          <path d="M50 12 L53.5 20 L62 20.6 L55.6 26 L57.6 34.3 L50 29.6 L42.4 34.3 L44.4 26 L38 20.6 L46.5 20 Z" fill={c} />
          <path d="M47 52 L50 49 V64 M21 66 C21 62 27 62 27 66 C27 70 21 72 21 76 H27 M76 74 H82 L78 79 C82 79 83 85 78 86 C76 86 75 85 75 84" fill="none" stroke={d} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "laurel":
      return (
        <g>
          {[1, -1].map((s) => (
            <g key={s} transform={s < 0 ? "translate(100 0) scale(-1 1)" : undefined}>
              <path d="M48 90 C26 82 16 62 20 38 C22 28 27 20 32 14" {...ln} strokeWidth="3" />
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const t = i / 5;
                const x = 46 - t * 24 - Math.sin(t * 3) * 4;
                const y = 86 - t * 70;
                return <ellipse key={i} cx={x} cy={y} rx="4.6" ry="9" transform={`rotate(${-50 + t * 30} ${x} ${y})`} fill={c} />;
              })}
            </g>
          ))}
          <path d="M50 30 L54 40 L64 40.6 L56.4 47 L58.8 57 L50 51.4 L41.2 57 L43.6 47 L36 40.6 L46 40 Z" fill={c} />
        </g>
      );
    case "check":
      return (
        <g>
          <path d="M18 52 L40 74 L84 26" {...ln} strokeWidth="11" />
          <path d="M18 52 L40 74 L84 26" fill="none" stroke={d} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        </g>
      );
    default:
      return <circle cx="50" cy="50" r="12" fill={c} />;
  }
}

/** ramo d'alloro dietro l'insegna, dal basso verso l'alto lungo il bordo */
function laurelBranch(side: 1 | -1, fill: string) {
  // due file di foglie (esterna e interna) lungo un arco, dal basso verso l'alto
  return Array.from({ length: 20 }, (_, i) => {
    const k = Math.floor(i / 2);
    const outer = i % 2 === 0;
    const deg = 90 + side * (24 + k * 13.5 + (outer ? 0 : 6));
    const a = (deg * Math.PI) / 180;
    const r = outer ? 60 : 55.5;
    const x = C + Math.cos(a) * r;
    const y = C + Math.sin(a) * r;
    const rot = deg - side * (outer ? 58 : 118);
    const len = 7.4 - k * 0.35;
    return <ellipse key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} rx={(len * 0.42).toFixed(2)} ry={len.toFixed(2)} transform={`rotate(${rot.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})`} fill={fill} />;
  });
}

export type InsigniaProps = {
  symbol?: InsSymbol;
  /** al posto del simbolo: un disegno a linee 24×24 (le icone dell'app), coniato in rilievo */
  art?: ReactNode;
  metal?: InsMetal;
  /** uno smalto con nome o un colore #rrggbb */
  enamel?: InsEnamel | string;
  shape?: InsShape;
  size?: number;
  /** nastro sotto (premi) */
  ribbon?: boolean;
  /** corona in cima (campionato, primi posti) */
  crown?: boolean;
  /** alloro ai lati */
  laurel?: boolean;
  /** raggi di luce e scintille dietro (insegne preziose) */
  glow?: boolean;
  /** ancora da conquistare: spenta e in grigio */
  locked?: boolean;
  /** entra con un piccolo salto */
  pop?: boolean;
  /** numero nel cartiglio sotto (posto, livello) */
  badge?: string;
  className?: string;
  title?: string;
};

/** Insegna coniata: bordo di metallo, smalto, simbolo in rilievo, riflessi; si anima al tocco. */
export function Insignia({ symbol = "star", art, metal = "gold", enamel = "night", shape = "round", size = 64, ribbon = false, crown = false, laurel = false, glow = false, locked = false, pop = false, badge, className, title }: InsigniaProps) {
  const id = `in${useId().replace(/[^a-zA-Z0-9]/g, "")}_`;
  const [tap, setTap] = useState(0);
  const [lux, hi, mid, lo, deep] = METAL[metal];
  const named = (enamel in ENAMEL ? enamel : "") as InsEnamel | "";
  const [el, em, ed] = named ? ENAMEL[named] : enamelFromHex(enamel);
  const [rib, ribStripe] = named ? RIBBON[named] : [ed, hi];
  const d = shapePath(shape);
  const fine = size >= 44;
  const top = crown ? -16 : glow ? -6 : 0;
  const bottom = ribbon ? 138 : badge ? 128 : glow ? 126 : 120;
  const side = laurel || glow ? 8 : 0;
  const vb = { x: -side, y: top, w: 120 + side * 2, h: bottom - top };
  const h = (size * vb.h) / vb.w;
  const field = shape === "shield" ? 0.8 : shape === "rosette" ? 0.76 : 0.82;
  const symBox = shape === "shield" ? { x: 31, y: 26, s: 58 } : shape === "rosette" ? { x: 33, y: 33, s: 54 } : { x: 31, y: 31, s: 58 };
  const symbolAt = (c: string, dd: string, dx = 0, dy = 0, op = 1) =>
    art ? (
      // disegno a linee: colori pieni (currentColor), il metallo del rilievo è il tono chiaro
      <svg x={symBox.x - 1 + dx} y={symBox.y - 1 + dy} width={symBox.s + 2} height={symBox.s + 2} viewBox="0 0 24 24" overflow="visible" opacity={op} fill="none" stroke="currentColor" strokeWidth={size >= 44 ? 1.9 : 2.3} strokeLinecap="round" strokeLinejoin="round" style={{ color: c.startsWith("url(") ? hi : c }}>
        {art}
      </svg>
    ) : (
      <svg x={symBox.x + dx} y={symBox.y + dy} width={symBox.s} height={symBox.s} viewBox="0 0 100 100" overflow="visible" opacity={op}>
        {symbolArt(symbol, c, dd)}
      </svg>
    );
  const beads = shape === "round" ? 28 : shape === "hex" ? 18 : 0;
  return (
    <span
      className={["aa-ins inline-block shrink-0 align-middle", locked ? "aa-ins-locked" : "", pop ? "aa-ins-pop" : "", className].filter(Boolean).join(" ")}
      data-tap={tap ? "1" : undefined}
      onPointerDown={() => {
        setTap((n) => n + 1);
        window.setTimeout(() => setTap(0), 900);
      }}
      style={{ width: size, height: h }}
      title={title}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} width={size} height={h} overflow="visible" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}rim`} x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor={lux} />
            <stop offset="0.25" stopColor={hi} />
            <stop offset="0.5" stopColor={mid} />
            <stop offset="0.72" stopColor={lo} />
            <stop offset="0.9" stopColor={mid} />
            <stop offset="1" stopColor={hi} />
          </linearGradient>
          <linearGradient id={`${id}bev`} x1="0.9" y1="1" x2="0.1" y2="0">
            <stop offset="0" stopColor={lux} />
            <stop offset="0.45" stopColor={mid} />
            <stop offset="1" stopColor={deep} />
          </linearGradient>
          <radialGradient id={`${id}en`} cx="0.38" cy="0.3" r="0.9">
            <stop offset="0" stopColor={el} />
            <stop offset="0.45" stopColor={em} />
            <stop offset="1" stopColor={ed} />
          </radialGradient>
          <linearGradient id={`${id}sym`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor={lux} />
            <stop offset="0.35" stopColor={hi} />
            <stop offset="0.7" stopColor={mid} />
            <stop offset="1" stopColor={lo} />
          </linearGradient>
          <linearGradient id={`${id}gl`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${id}ray`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.3" stopColor={lux} stopOpacity="0.95" />
            <stop offset="0.6" stopColor={hi} stopOpacity="0.5" />
            <stop offset="1" stopColor={hi} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}sh`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}out`}>
            <path d={d} />
          </clipPath>
          <clipPath id={`${id}fld`}>
            <path d={d} transform={scaleAt(field)} />
          </clipPath>
        </defs>

        {/* raggi di luce dietro */}
        {glow && !locked ? (
          <g className="aa-ins-rays" style={{ transformOrigin: "60px 60px" }}>
            {Array.from({ length: 16 }, (_, i) => {
              const a0 = ((i * 22.5 - 4) * Math.PI) / 180;
              const a1 = ((i * 22.5 + 4) * Math.PI) / 180;
              const r = i % 2 ? 66 : 76;
              return <path key={i} d={`M60 60 L${(60 + Math.cos(a0) * r).toFixed(1)} ${(60 + Math.sin(a0) * r).toFixed(1)} L${(60 + Math.cos(a1) * r).toFixed(1)} ${(60 + Math.sin(a1) * r).toFixed(1)} Z`} fill={`url(#${id}ray)`} opacity={i % 2 ? 0.7 : 1} />;
            })}
          </g>
        ) : null}

        {/* nastro */}
        {ribbon ? (
          <g>
            <path d="M38 92 L27 136 L38 128 L45 137 L53 98 Z" fill={rib} />
            <path d="M82 92 L93 136 L82 128 L75 137 L67 98 Z" fill={rib} />
            <path d="M41.5 96 L32.5 132 M78.5 96 L87.5 132" stroke={ribStripe} strokeWidth="2.6" strokeOpacity="0.9" />
            <path d="M38 92 L27 136 L38 128 L45 137 L53 98 Z M82 92 L93 136 L82 128 L75 137 L67 98 Z" fill="#000" opacity="0.2" />
          </g>
        ) : null}

        {/* alloro */}
        {laurel ? (
          <g>
            <g fill={deep} transform="translate(0.8 1)">{laurelBranch(1, deep)}{laurelBranch(-1, deep)}</g>
            <g>{laurelBranch(1, `url(#${id}rim)`)}{laurelBranch(-1, `url(#${id}rim)`)}</g>
          </g>
        ) : null}

        {/* ombra a terra e spessore */}
        <ellipse cx="60" cy="116" rx="36" ry="4.5" fill="#000" opacity={locked ? 0.15 : 0.32} />
        <path d={d} transform="translate(0 3.2)" fill={deep} />
        {/* bordo di metallo e smusso */}
        <path d={d} fill={`url(#${id}rim)`} stroke={deep} strokeWidth="0.8" strokeOpacity="0.7" />
        <path d={d} transform={scaleAt(0.93)} fill={`url(#${id}bev)`} />
        <path d={d} transform={scaleAt(0.895)} fill={`url(#${id}rim)`} />
        <path d={d} transform={scaleAt(field + 0.035)} fill={`url(#${id}bev)`} />
        {/* perline sul bordo */}
        {fine && beads ? (
          <g fill={lux} opacity="0.85">
            {Array.from({ length: beads }, (_, i) => {
              const a = (i / beads) * Math.PI * 2 + (shape === "hex" ? Math.PI / 6 : 0);
              const r = shape === "hex" ? 44 : 46.2;
              return <circle key={i} cx={(60 + Math.cos(a) * r).toFixed(2)} cy={(60 + Math.sin(a) * r).toFixed(2)} r="1.15" />;
            })}
          </g>
        ) : null}
        {shape === "shield" && fine ? (
          <g fill={lux} opacity="0.9">
            <circle cx="24" cy="17" r="1.8" />
            <circle cx="96" cy="17" r="1.8" />
            <circle cx="60" cy="104" r="1.8" />
          </g>
        ) : null}
        {/* campo di smalto */}
        <path d={d} transform={scaleAt(field)} fill={`url(#${id}en)`} />
        <g clipPath={`url(#${id}fld)`}>
          {fine
            ? shape === "round" || shape === "rosette"
              ? Array.from({ length: 9 }, (_, i) => <circle key={i} cx="60" cy="60" r={6 + i * 5} fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth="1" />)
              : Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${i * 9 - 10} 0 L${i * 9 + 30} 120`} stroke="#fff" strokeOpacity="0.06" strokeWidth="1.2" />)
            : null}
          {/* luce dall'alto sullo smalto */}
          <ellipse cx="60" cy="30" rx="52" ry="30" fill={`url(#${id}gl)`} opacity="0.55" />
        </g>
        {/* simbolo coniato: ombra, luce, metallo */}
        {symbolAt(deep, deep, 1.3, 1.8, 0.85)}
        {symbolAt(lux, lux, -0.8, -0.9, 0.75)}
        {symbolAt(`url(#${id}sym)`, ed)}

        {/* corona */}
        {crown ? (
          <g>
            <path d="M38 6 L42 -12 L51 -2 L60 -15 L69 -2 L78 -12 L82 6 Z" transform="translate(0 2.6)" fill={deep} />
            <path d="M38 6 L42 -12 L51 -2 L60 -15 L69 -2 L78 -12 L82 6 Z" fill={`url(#${id}rim)`} stroke={deep} strokeWidth="0.8" />
            <rect x="37" y="2" width="46" height="7" rx="2" fill={`url(#${id}bev)`} stroke={deep} strokeWidth="0.6" />
            <circle cx="42" cy="-12" r="2.6" fill={lux} />
            <circle cx="60" cy="-15" r="3" fill={lux} />
            <circle cx="78" cy="-12" r="2.6" fill={lux} />
            <circle cx="60" cy="5.5" r="2.4" fill={em} stroke={lux} strokeWidth="0.6" />
            <circle cx="49" cy="5.5" r="1.6" fill={el} />
            <circle cx="71" cy="5.5" r="1.6" fill={el} />
          </g>
        ) : null}

        {/* cartiglio con il numero */}
        {badge ? (
          <g>
            <path d="M34 106 H86 L82 124 H38 Z" fill={deep} transform="translate(0 2)" />
            <path d="M34 106 H86 L82 124 H38 Z" fill={`url(#${id}rim)`} stroke={deep} strokeWidth="0.8" />
            <text x="60" y="120" textAnchor="middle" fontSize="14" fontWeight="800" fill={deep} style={{ fontFamily: "inherit" }}>
              {badge}
            </text>
          </g>
        ) : null}

        {/* riflessi e lampo al tocco */}
        <g clipPath={`url(#${id}out)`}>
          <path d="M18 46 C22 26 38 13 58 11" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="2.6" strokeLinecap="round" />
          <g className="aa-ins-shine">
            <rect x="-40" y="-20" width="26" height="170" fill={`url(#${id}sh)`} transform="rotate(18 -27 65)" />
          </g>
        </g>
        <circle cx="31" cy="24" r="1.8" fill="#fff" opacity="0.9" />
        {glow && !locked && fine ? (
          <g fill="#fff">
            <path className="aa-ins-twinkle" d="M101 20 L103 27 L110 29 L103 31 L101 38 L99 31 L92 29 L99 27 Z" />
            <path className="aa-ins-twinkle" style={{ animationDelay: "1.2s" }} d="M14 82 L15.4 87 L20.4 88.4 L15.4 89.8 L14 94.8 L12.6 89.8 L7.6 88.4 L12.6 87 Z" />
          </g>
        ) : null}
      </svg>
    </span>
  );
}
