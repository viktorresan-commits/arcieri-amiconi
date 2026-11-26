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

/** Stile della decorazione delle penne: tinta unita o con un secondo colore. */
export const FLETCH_STYLES = [
  { id: "pieno", label: "Tinta unita" },
  { id: "striato", label: "Striate (barrate)" },
  { id: "spirale", label: "A spirale" },
  { id: "bicolore", label: "Bicolore" },
  { id: "punta", label: "Punta colorata" },
  { id: "maculato", label: "Maculate" },
  { id: "elicoidale", label: "Montate elicoidali" },
] as const;

/** Modelli pronti: un tocco imposta materiale, impennaggio, punta e colori tipici. */
export const ARROW_MODELS: { id: string; label: string; note: string; specs: Record<string, string> }[] = [
  { id: "gara-indoor", label: "Gara indoor", note: "Carbonio grosso, alette, ogiva", specs: { material: "carbonio", fletchType: "alette", pointType: "ogiva", fletch: "#e6b325", cock: "#d63a2f", nock: "#14181c", fletchStyle: "pieno", use: "gara" } },
  { id: "gara-outdoor", label: "Gara outdoor", note: "Carbonio sottile, spin wing", specs: { material: "carbo-alluminio", fletchType: "spin", pointType: "ogiva", fletch: "#ff5fa2", cock: "#f4f1ea", nock: "#f4f1ea", fletchStyle: "pieno", use: "gara" } },
  { id: "campagna", label: "Campagna e 3D", note: "Carbonio, alette corte, punta 3D", specs: { material: "carbonio", fletchType: "blazer", pointType: "3d", fletch: "#3d9b74", cock: "#e6b325", nock: "#e6b325", fletchStyle: "bicolore", fletch2: "#14181c" } },
  { id: "legno", label: "Legno tradizionale", note: "Cedro, penne naturali barrate", specs: { material: "legno", fletchType: "penne", pointType: "field", fletch: "#c9a46a", cock: "#d63a2f", nock: "#14181c", fletchStyle: "striato", fletch2: "#3a2a1e", wrap: "#d63a2f" } },
  { id: "storico", label: "Storico", note: "Bambù o legno, penne a scudo", specs: { material: "bambu", fletchType: "scudo", pointType: "field", fletch: "#f4f1ea", cock: "#14181c", nock: "#e6b325", fletchStyle: "punta", fletch2: "#14181c" } },
  { id: "alluminio", label: "Alluminio da scuola", note: "Plastifletch, field", specs: { material: "alluminio", fletchType: "plastifletch", pointType: "field", fletch: "#2f7fd1", cock: "#e6b325", nock: "#f4f1ea", fletchStyle: "pieno" } },
  { id: "caccia", label: "Caccia (solo sagome)", note: "Penne a spirale, lama", specs: { material: "carbonio", fletchType: "penne", pointType: "caccia", fletch: "#e07a2f", cock: "#f4f1ea", nock: "#e07a2f", fletchStyle: "spirale", fletch2: "#f4f1ea" } },
];

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

/** numeri ripetibili: le venature e le barbe vengono uguali a ogni disegno della stessa freccia */
function rng(seed: number) {
  let v = seed >>> 0 || 7;
  return () => {
    v = (v * 1664525 + 1013904223) >>> 0;
    return v / 4294967296;
  };
}
const hash = (t: string) => {
  let h = 2166136261;
  for (const ch of t) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};
const r1 = (v: number) => Math.round(v * 100) / 100;

/** penne vere: piuma di tacchino o d'oca, con la costa, le barbe e qualche spaccatura */
const NATURAL = new Set(["penne", "scudo"]);

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
  fletchStyle = "pieno",
  fletch2 = "",
  stretch = false,
  ground = true,
}: {
  /** ombra a terra sotto la freccia (da togliere quando la freccia è disegnata dentro una scena) */
  ground?: boolean;
  /** riempie il riquadro anche in altezza (freccia più grossa nelle liste) */
  stretch?: boolean;
  /** decorazione delle penne (FLETCH_STYLES) e secondo colore */
  fletchStyle?: string;
  fletch2?: string;
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
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const wooden = material === "legno" || material === "bambu";
  const sh = shaft ? { a: shade(shaft, 0.4), c: shaft, b: shade(shaft, -0.5) } : (SHAFTS[material] ?? SHAFTS.carbonio);
  const y = 18;
  const r = wooden ? 2.5 : material === "carbonio" ? 2.2 : 2.35; // mezzo spessore dell'asta
  const x0 = 16; // fine della cocca
  const x1 = 290; // inizio della punta
  const natural = NATURAL.has(fletchType);
  const vane = VANES[fletchType] ?? VANES.alette;
  const fx = x0 + (wooden ? 14 : 10); // le penne partono poco dopo la cocca
  const seed = hash(`${material}${fletch}${fletchType}${number ?? ""}`);
  const rnd = rng(seed);
  const deco =
    fletchStyle === "striato" ? `url(#fs-${id})` :
    fletchStyle === "spirale" ? `url(#fp-${id})` :
    fletchStyle === "maculato" ? `url(#fm-${id})` :
    fletchStyle === "bicolore" ? `url(#fb-${id})` :
    fletchStyle === "punta" ? `url(#ft-${id})` : "";
  const second = fletch2 || shade(fletch, -0.55);
  // venature del legno: linee lunghe e leggermente ondulate dentro lo spessore dell'asta
  const grain = wooden
    ? Array.from({ length: 7 }, (_, i) => {
        const yy = y - r + 0.55 + ((2 * r - 1.1) * (i + 0.5)) / 7 + (rnd() - 0.5) * 0.35;
        const a0 = x0 + 4 + rnd() * 40;
        const a1 = x1 - 4 - rnd() * 40;
        const amp = 0.18 + rnd() * 0.22;
        const ph = rnd() * 6;
        const pts: string[] = [];
        for (let x = a0; x <= a1; x += 6) pts.push(`${r1(x)} ${r1(Math.max(y - r + 0.3, Math.min(y + r - 0.3, yy + Math.sin(x / 23 + ph) * amp)))}`);
        return { d: `M${pts.join(" L")}`, o: 0.16 + rnd() * 0.3, w: 0.18 + rnd() * 0.22 };
      })
    : [];
  // barbe della piuma: inclinate all'indietro (verso la cocca) e verso l'esterno
  const barbs = (y0: number, dir: 1 | -1, step: number, off: number) => {
    const out: string[] = [];
    for (let x = fx - 8 + off; x < fx + vane.len + 6; x += step) out.push(`M${r1(x)} ${r1(y0)} Q${r1(x - 4)} ${r1(y0 + dir * 8)} ${r1(x - 11)} ${r1(y0 + dir * 16)}`);
    return out.join(" ");
  };
  // spaccature: le barbe si separano in qualche punto e si vede attraverso la penna
  const splits = (y0: number, dir: 1 | -1) =>
    [0.22, 0.47, 0.71, 0.86].map((f) => {
      const x = fx + vane.len * f + (rnd() - 0.5) * 5;
      const depth = 5 + rnd() * 5;
      return `M${r1(x + 1.5)} ${r1(y0 + dir * 2.2)} Q${r1(x - 1.4)} ${r1(y0 + dir * (2.2 + depth * 0.55))} ${r1(x - 5.2)} ${r1(y0 + dir * (2.2 + depth))}`;
    });
  const featherFill = (d: string, y0: number, dir: 1 | -1, base: string, lit: boolean, key: string) => (
    <g key={key}>
      <clipPath id={`cl-${key}-${id}`}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={base} />
      <g clipPath={`url(#cl-${key}-${id})`}>
        {/* più scura vicino alla costa e verso la punta della penna, più chiara sul bordo */}
        <path d={d} fill={`url(#fg${dir > 0 ? "d" : "u"}-${id})`} />
        <path d={d} fill={`url(#fl-${id})`} />
        {deco ? <path d={d} fill={deco} /> : null}
        {/* barbe: fitte, leggermente curve, chiare e scure alternate */}
        <path d={barbs(y0, dir, 1.15, 0)} stroke={shade(base, -0.6)} strokeOpacity="0.5" strokeWidth="0.34" fill="none" />
        <path d={barbs(y0, dir, 1.15, 0.55)} stroke="#fff" strokeOpacity="0.2" strokeWidth="0.3" fill="none" />
        {splits(y0, dir).map((sd, i) => (
          <g key={i}>
            <path d={sd} stroke="#0d1013" strokeOpacity="0.75" strokeWidth="0.75" fill="none" />
            <path d={sd} stroke="#fff" strokeOpacity="0.28" strokeWidth="0.3" fill="none" transform="translate(0.7 0)" />
          </g>
        ))}
        {!lit ? <path d={d} fill="#000" opacity="0.24" /> : null}
      </g>
      {/* bordo sfrangiato: le punte delle barbe non fanno un contorno netto */}
      <path d={d} fill="none" stroke={shade(base, 0.25)} strokeOpacity="0.7" strokeWidth="0.8" strokeDasharray="0.3 0.7" />
      {/* la costa (rachide) incollata sull'asta */}
      <path d={`M${fx - 1} ${r1(y0 + dir * 0.4)} L${fx + vane.len - 2} ${r1(y0 + dir * 0.25)}`} stroke="#f6eedb" strokeOpacity="0.9" strokeWidth="0.75" />
      <path d={`M${fx - 1} ${r1(y0 + dir * 0.95)} L${fx + vane.len - 4} ${r1(y0 + dir * 0.6)}`} stroke="#000" strokeOpacity="0.25" strokeWidth="0.35" />
    </g>
  );
  const vaneFill = (d: string, dir: 1 | -1, base: string, lit: boolean, key: string) => (
    <g key={key}>
      <path d={d} fill={base} />
      {deco ? <path d={d} fill={deco} /> : null}
      <path d={d} fill={`url(#vn${dir > 0 ? "d" : "u"}-${id})`} />
      {!lit ? <path d={d} fill="#000" opacity="0.2" /> : null}
      {/* bordo lucido della plastica */}
      <path d={d} fill="none" stroke="#fff" strokeOpacity={lit ? 0.38 : 0.16} strokeWidth="0.45" />
    </g>
  );
  const topY = y - r + 0.3;
  const botY = y + r - 0.3;
  const dTop = vane.path(fx, topY, -1);
  const dBot = vane.path(fx, botY, 1);
  const metal = `url(#mt-${id})`;
  const numColor = material === "alluminio" || wooden ? "#14181c" : "#f4f1ea";
  const crownEnd = fx + vane.len + 10;
  return (
    <svg viewBox="0 0 320 36" className={className} aria-hidden preserveAspectRatio={stretch ? "none" : "xMidYMid meet"}>
      <defs>
        <linearGradient id={`sh-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(sh.a, 0.15)} />
          <stop offset="28%" stopColor={sh.a} />
          <stop offset="55%" stopColor={sh.c} />
          <stop offset="100%" stopColor={sh.b} />
        </linearGradient>
        <linearGradient id={`mt-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#d7dde2" />
          <stop offset="62%" stopColor="#8b959e" />
          <stop offset="100%" stopColor="#4a535b" />
        </linearGradient>
        <linearGradient id={`nk-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(nock, 0.55)} />
          <stop offset="45%" stopColor={nock} />
          <stop offset="100%" stopColor={shade(nock, -0.45)} />
        </linearGradient>
        <linearGradient id={`vnu-${id}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#000" stopOpacity="0.28" />
          <stop offset="35%" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id={`vnd-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={`fgu-${id}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#000" stopOpacity="0.3" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={`fgd-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={`fl-${id}`} x1="0" x2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
        {/* decorazioni delle penne con il secondo colore: le barre seguono l'inclinazione delle barbe */}
        <pattern id={`fs-${id}`} width="6.2" height="40" patternUnits="userSpaceOnUse" patternTransform="skewX(32)">
          <rect width="2.4" height="40" fill={second} opacity="0.92" />
          <rect x="2.4" width="0.5" height="40" fill={second} opacity="0.4" />
        </pattern>
        <pattern id={`fp-${id}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="4" height="8" fill={fletch2 || shade(fletch, 0.6)} />
        </pattern>
        <pattern id={`fm-${id}`} width="9" height="7" patternUnits="userSpaceOnUse">
          <ellipse cx="3" cy="2.5" rx="1.9" ry="1.3" fill={second} />
          <ellipse cx="7.5" cy="5.5" rx="1.3" ry="0.9" fill={second} />
        </pattern>
        <linearGradient id={`fb-${id}`} x1="0" x2="1">
          <stop offset="0.5" stopColor={fletch} stopOpacity="0" />
          <stop offset="0.5" stopColor={fletch2 || shade(fletch, -0.45)} />
        </linearGradient>
        <linearGradient id={`ft-${id}`} x1="0" x2="1">
          <stop offset="0.72" stopColor={fletch} stopOpacity="0" />
          <stop offset="0.72" stopColor={fletch2 || "#14181c"} />
        </linearGradient>
        <pattern id={`cf-${id}`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="1.5" height="3" fill="#fff" opacity="0.07" />
        </pattern>
        <pattern id={`br-${id}`} width="9" height="0.9" patternUnits="userSpaceOnUse">
          <rect width="9" height="0.3" fill="#fff" opacity="0.18" />
        </pattern>
      </defs>
      {/* ombra a terra */}
      {ground ? <ellipse cx="160" cy="32" rx="138" ry="1.3" fill="#000" opacity="0.14" /> : null}

      {/* asta */}
      <rect x={x0} y={y - r} width={x1 - x0} height={r * 2} rx={r} fill={`url(#sh-${id})`} />
      {material === "carbonio" || material === "carbo-alluminio" ? <rect x={x0} y={y - r} width={x1 - x0} height={r * 2} rx={r} fill={`url(#cf-${id})`} /> : null}
      {material === "alluminio" ? <rect x={x0} y={y - r} width={x1 - x0} height={r * 2} rx={r} fill={`url(#br-${id})`} /> : null}
      {grain.map((g, i) => (
        <path key={i} d={g.d} fill="none" stroke={material === "bambu" ? "#7d6424" : "#6a3d16"} strokeOpacity={g.o} strokeWidth={g.w} strokeLinecap="round" />
      ))}
      {material === "legno" ? (
        // venatura scura più marcata e un piccolo nodo, come nel cedro
        <g>
          <path d={`M${x0 + 120} ${y + 0.4} C${x0 + 150} ${y - 0.4} ${x0 + 175} ${y + 1.2} ${x0 + 210} ${y + 0.2}`} fill="none" stroke="#5a3010" strokeOpacity="0.35" strokeWidth="0.55" />
          <ellipse cx={x0 + 196} cy={y - 0.7} rx="1.6" ry="0.6" fill="#5a3010" opacity="0.4" />
        </g>
      ) : null}
      {material === "bambu"
        ? [96, 168, 236].map((x) => (
            <g key={x}>
              <rect x={x - 1.4} y={y - r - 0.35} width="2.8" height={r * 2 + 0.7} rx="1.1" fill="#9b7f34" />
              <rect x={x - 1.4} y={y - r - 0.35} width="2.8" height="0.9" rx="0.4" fill="#f3e3a8" opacity="0.6" />
              <rect x={x + 0.2} y={y - r} width="0.5" height={r * 2} fill="#5c4a18" opacity="0.5" />
            </g>
          ))
        : null}
      {shine ? <rect x={x0 + 3} y={y - r + 0.45} width={x1 - x0 - 6} height="0.8" rx="0.4" fill="#fff" opacity={material === "carbonio" ? 0.32 : 0.42} /> : null}
      <rect x={x0 + 3} y={y + r - 0.9} width={x1 - x0 - 6} height="0.5" rx="0.25" fill="#000" opacity="0.18" />

      {/* frecce di legno: la parte dietro è verniciata sotto le penne (crown dip) */}
      {wrap && wooden ? <rect x={x0} y={y - r - 0.05} width={crownEnd - x0} height={r * 2 + 0.1} rx={r} fill={wrap} /> : null}
      {wrap && wooden ? <rect x={x0} y={y - r + 0.4} width={crownEnd - x0} height="0.7" fill="#fff" opacity="0.3" /> : null}
      {/* fascia (cresting): banda e filetti di contrasto */}
      {wrap ? (
        <g>
          {!wooden ? <rect x={x0 + 2} y={y - r - 0.15} width={vane.len + 20} height={r * 2 + 0.3} fill={wrap} /> : null}
          {!wooden ? <rect x={x0 + 2} y={y - r + 0.35} width={vane.len + 20} height="0.6" fill="#fff" opacity="0.3" /> : null}
          {[
            [crownEnd + 2, 1.4, "#14181c"],
            [crownEnd + 4.4, 3.2, wrap],
            [crownEnd + 8.6, 0.7, "#f4f1ea"],
            [crownEnd + 10.4, 0.7, "#14181c"],
            [crownEnd + 12.2, 1.6, wrap],
          ].map(([x, w, c], i) => (
            <rect key={i} x={x as number} y={y - r - 0.15} width={w as number} height={r * 2 + 0.3} fill={c as string} />
          ))}
        </g>
      ) : null}
      {/* numero stampato sull'asta */}
      {number != null && number !== "" ? (
        <text x={crownEnd + (wrap ? 20 : 8)} y={y + 1.75} fontSize="5" fontWeight="700" fill={numColor} fontFamily="system-ui, sans-serif" opacity="0.92">
          {number}
        </text>
      ) : null}

      {/* impennaggio */}
      {fletchType === "fob" ? (
        <g>
          <rect x={fx + 2} y={y - 8} width="14" height="16" rx="3.5" fill={fletch} />
          <rect x={fx + 2} y={y - 8} width="14" height="16" rx="3.5" fill={`url(#vnu-${id})`} />
          <ellipse cx={fx + 16} cy={y} rx="2.2" ry="8" fill={fletch} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
          <ellipse cx={fx + 16} cy={y} rx="1" ry="4.2" fill="#000" opacity="0.25" />
        </g>
      ) : (
        <g>
          <g transform={fletchStyle === "elicoidale" ? `skewX(-8) translate(${y * 0.14} 0)` : undefined}>
            {natural ? featherFill(dTop, topY, -1, fletch, true, "t") : vaneFill(dTop, -1, fletch, true, "t")}
            {natural ? featherFill(dBot, botY, 1, fletch, false, "b") : vaneFill(dBot, 1, fletch, false, "b")}
          </g>
          {/* penna guida, vista di sbieco sopra l'asta */}
          <g transform={`translate(0 ${r1(y * 0.45)}) scale(1 0.55)`}>
            {natural ? featherFill(vane.path(fx + 2, y - 0.2, -1), y - 0.2, -1, cock, true, "c") : vaneFill(vane.path(fx + 2, y - 0.2, -1), -1, cock, true, "c")}
          </g>
          {fletchType === "quickspin" ? <path d={`M${fx + 4} ${y - 6} Q${fx + 20} ${y - 9} ${fx + 34} ${y - 3}`} stroke="#fff" strokeOpacity="0.45" strokeWidth="0.8" fill="none" /> : null}
          {/* legature in filo alle estremità delle penne (frecce tradizionali) */}
          {natural && wooden ? (
            <g>
              <rect x={fx - 2.4} y={y - r - 0.25} width="2.6" height={r * 2 + 0.5} rx="0.6" fill="#2a1d14" />
              <rect x={fx + vane.len - 1} y={y - r - 0.25} width="2.6" height={r * 2 + 0.5} rx="0.6" fill="#2a1d14" />
              <rect x={fx - 2.4} y={y - r} width="2.6" height="0.6" fill="#fff" opacity="0.25" />
            </g>
          ) : null}
        </g>
      )}

      {/* cocca: plastica lucida, collare e gola per la corda */}
      <g>
        <path d={`M${x0 + 1} ${y - r - 0.5} L${x0 - 7} ${y - r - 0.8} L${x0 - 12} ${y - 3.7} L${x0 - 12.4} ${y - 1.1} L${x0 - 6.6} ${y - 0.9} L${x0 - 6.6} ${y + 0.9} L${x0 - 12.4} ${y + 1.1} L${x0 - 12} ${y + 3.7} L${x0 - 7} ${y + r + 0.8} L${x0 + 1} ${y + r + 0.5} Z`} fill={`url(#nk-${id})`} stroke="rgba(0,0,0,0.4)" strokeWidth="0.4" />
        <path d={`M${x0 - 6.6} ${y - 0.9} L${x0 - 12.4} ${y - 1.1} L${x0 - 12.4} ${y + 1.1} L${x0 - 6.6} ${y + 0.9} Z`} fill="#000" opacity="0.35" />
        <rect x={x0 - 1.2} y={y - r - 0.7} width="1.4" height={r * 2 + 1.4} rx="0.4" fill={shade(nock, -0.3)} />
        <rect x={x0 - 7} y={y - r - 0.2} width="6" height="0.8" rx="0.4" fill="#fff" opacity="0.45" />
      </g>

      {/* punta in acciaio */}
      {point === "field" ? (
        <g>
          <path d={`M${x1 - 1} ${y - r - 0.35} L${x1 + 14} ${y - r - 0.35} L${x1 + 17} ${y - r + 0.3} L${x1 + 26} ${y} L${x1 + 17} ${y + r - 0.3} L${x1 + 14} ${y + r + 0.35} L${x1 - 1} ${y + r + 0.35} Z`} fill={metal} />
          <path d={`M${x1 + 14} ${y - r - 0.35} L${x1 + 17} ${y - r + 0.3} L${x1 + 17} ${y + r - 0.3} L${x1 + 14} ${y + r + 0.35} Z`} fill="#000" opacity="0.18" />
          <rect x={x1} y={y - r + 0.2} width="15" height="0.7" rx="0.35" fill="#fff" opacity="0.7" />
        </g>
      ) : point === "caccia" ? (
        <g>
          <rect x={x1 - 1} y={y - r - 0.2} width="10" height={r * 2 + 0.4} fill={metal} />
          <path d={`M${x1 + 8} ${y - 9} L${x1 + 28} ${y} L${x1 + 8} ${y + 9} L${x1 + 12} ${y} Z`} fill={metal} stroke="#3b444c" strokeWidth="0.5" />
          <path d={`M${x1 + 9} ${y - 7.6} L${x1 + 26} ${y - 0.4}`} stroke="#fff" strokeOpacity="0.7" strokeWidth="0.45" />
        </g>
      ) : point === "gommino" ? (
        <g>
          <rect x={x1 - 1} y={y - 3.4} width="14" height="6.8" rx="1.5" fill="#1d1f22" />
          <circle cx={x1 + 14} cy={y} r="4.2" fill="#26292d" />
          <rect x={x1} y={y - 2.6} width="12" height="1" fill="#fff" opacity="0.15" />
        </g>
      ) : point === "3d" ? (
        <g>
          <path d={`M${x1 - 1} ${y - r - 0.3} L${x1 + 12} ${y - r - 0.3} L${x1 + 14} ${y - r - 1.2} L${x1 + 28} ${y} L${x1 + 14} ${y + r + 1.2} L${x1 + 12} ${y + r + 0.3} L${x1 - 1} ${y + r + 0.3} Z`} fill={metal} />
          <rect x={x1} y={y - r + 0.2} width="13" height="0.6" rx="0.3" fill="#fff" opacity="0.7" />
        </g>
      ) : (
        <g>
          <path d={`M${x1 - 1} ${y - r - 0.3} L${x1 + 13} ${y - r - 0.3} Q${x1 + 28} ${y} ${x1 + 13} ${y + r + 0.3} L${x1 - 1} ${y + r + 0.3} Z`} fill={metal} />
          <path d={`M${x1} ${y - r + 0.3} L${x1 + 13} ${y - r + 0.3} Q${x1 + 20} ${y - r + 0.9} ${x1 + 23} ${y - 0.6}`} fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="0.6" />
        </g>
      )}
    </svg>
  );
}
