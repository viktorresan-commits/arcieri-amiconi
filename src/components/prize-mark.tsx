import { useId, type ReactNode } from "react";
import { glyphArt, type IconName } from "./icons";
import { Insignia, type InsEnamel, type InsMetal, type InsShape, type InsSymbol } from "./insignia";

const LADDERS = {
  arrow: ["arrows_100", "arrows_500", "arrows_1000", "arrows_5000"],
  bow: ["first_session", "sessions_5", "sessions_10", "sessions_50", "sessions_100"],
  target: ["first_comp", "gare_5", "gare_10"],
  medal: ["champ_10", "champ_50", "champ_100", "champ_150", "champ_200", "champ_300", "champ_400", "champ_500", "champ_750", "champ_1000"],
  flame: ["streak_7", "days_30"],
  rise: ["first_record", "improve_5"],
} as const;

const METALS = ["bronze", "silver", "gold", "platinum"] as const;

const RING: Record<string, { label: string; color: string }> = {
  base: { label: "", color: "#8ea396" },
  bronze: { label: "Bronzo", color: "#c4844a" },
  silver: { label: "Argento", color: "#d7dee6" },
  gold: { label: "Oro", color: "#e2b340" },
  platinum: { label: "Platino", color: "#efeaf8" },
};

const FAMILY = ["arrow", "target", "medal", "bow", "rise", "flame"];

export type PrizeTier = {
  symbol: keyof typeof LADDERS;
  metal: "base" | (typeof METALS)[number];
  stars: number;
  rank: number;
  label: string;
};

export function prizeTier(code: string): PrizeTier {
  for (const [symbol, codes] of Object.entries(LADDERS) as Array<[keyof typeof LADDERS, readonly string[]]>) {
    const index = codes.indexOf(code);
    if (index < 0) continue;
    if (index === 0) {
      return { symbol, metal: "base", stars: 0, rank: 6 - FAMILY.indexOf(symbol), label: "" };
    }
    const step = index - 1;
    const band = Math.min(METALS.length - 1, Math.floor(step / 4));
    const stars = Math.floor(step / 4) >= METALS.length ? 3 : step % 4;
    const metal = METALS[band];
    const starLabel = stars === 0 ? "" : stars === 1 ? " · 1 stella" : ` · ${stars} stelle`;
    const rank = (band + 1) * 100 + stars * 10 + (6 - FAMILY.indexOf(symbol));
    return { symbol, metal, stars, rank, label: `${RING[metal].label}${starLabel}` };
  }
  return { symbol: "arrow", metal: "base", stars: 0, rank: 0, label: "" };
}

export function topPrizes<T extends { code: string }>(prizes: T[], limit = 3) {
  return [...prizes].sort((a, b) => prizeTier(b.code).rank - prizeTier(a.code).rank).slice(0, limit);
}

function Star({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 drop-shadow" aria-hidden>
      <path d="M6 0.8 L7.4 4.4 H11.2 L8.1 6.6 L9.4 10.4 L6 8.2 L2.6 10.4 L3.9 6.6 L0.8 4.4 H4.6 Z" fill={color} />
    </svg>
  );
}

export type Metal = "base" | "bronze" | "silver" | "gold" | "platinum";

/** Colori del metallo: luce, chiaro, medio, scuro, ombra profonda. */
const METAL: Record<Metal, [string, string, string, string, string]> = {
  base: ["#f2f5f7", "#b8c2ca", "#87939d", "#56616b", "#2c3339"],
  bronze: ["#ffe0bd", "#e7a56a", "#b8743c", "#7a461c", "#3f220c"],
  silver: ["#ffffff", "#e8edf2", "#bcc6d0", "#7d8894", "#3c444d"],
  gold: ["#fff7cf", "#f5d36b", "#d9a22e", "#94650f", "#4a3105"],
  platinum: ["#ffffff", "#eeeaf9", "#cfc8ea", "#8f87b8", "#423c63"],
};
const RIBBON: Record<Metal, [string, string]> = {
  base: ["#3f5a4a", "#a9b8ae"],
  bronze: ["#7a2e22", "#e7a56a"],
  silver: ["#20406e", "#e8edf2"],
  gold: ["#8a1f2b", "#f5d36b"],
  platinum: ["#3b2a6e", "#eeeaf9"],
};

/** Simboli dei premi, disegnati su una griglia 100×100 come silhouette piene da coniare in rilievo. */
function symbolArt(symbol: string, sw = 4): ReactNode {
  const s = { fill: "none", strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (symbol) {
    case "arrow":
      return <g><path d="M30 70 L64 36" {...s} /><path d="M72 28 L57 33 L67 43 Z" stroke="none" /><path d="M39 61 L33 50 M39 61 L50 67 M33 67 L27 56 M33 67 L44 73" {...s} strokeWidth={sw * 0.7} /></g>;
    case "bow":
      return <g><path d="M41 24 C64 35 64 65 41 76" {...s} strokeWidth={sw * 1.25} /><path d="M41 24 L41 76" {...s} strokeWidth={sw * 0.45} /><path d="M33 50 L70 50" {...s} strokeWidth={sw * 0.7} /><path d="M73 50 L64 45 L64 55 Z" stroke="none" /></g>;
    case "target":
      return <g><circle cx="50" cy="50" r="22" {...s} /><circle cx="50" cy="50" r="13" {...s} /><circle cx="50" cy="50" r="5" stroke="none" /><path d="M62 38 L74 26 M70 26 L74 26 L74 30" {...s} strokeWidth={sw * 0.7} /></g>;
    case "medal":
      return <g><path d="M50 30 L55.5 43 L69.5 43.5 L58.5 52 L62.5 66 L50 58 L37.5 66 L41.5 52 L30.5 43.5 L44.5 43 Z" stroke="none" /><path d="M50 30 L55.5 43 L69.5 43.5 L58.5 52 L62.5 66 L50 58 L37.5 66 L41.5 52 L30.5 43.5 L44.5 43 Z" {...s} strokeWidth={sw * 0.4} /></g>;
    case "flame":
      return <g><path d="M50 25 C61 39 69 46 65 61 C62 71 55 75 50 75 C41 75 34 68 34 59 C34 50 41 46 43 37 C47 45 50 47 52 45 C52 39 50 31 50 25 Z" stroke="none" /></g>;
    case "rise":
      return <g><path d="M29 68 L43 53 L53 61 L69 40" {...s} /><path d="M71 37 L59 38 L70 49 Z" stroke="none" /><path d="M28 74 H72" {...s} strokeWidth={sw * 0.5} /></g>;
    default:
      return <circle cx="50" cy="50" r="10" stroke="none" />;
  }
}

/**
 * Moneta di metallo coniata: nastro, bordo zigrinato con smusso, alloro (oro e platino),
 * campo lucido e simbolo in rilievo con ombra e luce. Usata per premi e obiettivi.
 */
export function MetalCoin({ metal, symbol, icon, size = 56, ribbon = true, locked = false }: { metal: Metal; symbol?: string; icon?: IconName; size?: number; ribbon?: boolean; locked?: boolean }) {
  const raw = (useId().replace(/[^a-zA-Z0-9]/g, "") + "_");
  const id = `mc${raw}`;
  const [lux, hi, mid, lo, deep] = METAL[metal];
  const [rib, ribStripe] = RIBBON[metal];
  const teeth = 60;
  const reeded = Array.from({ length: teeth }, (_, i) => {
    const a = (i / teeth) * Math.PI * 2;
    const r = i % 2 ? 44.6 : 46.2;
    return `${i ? "L" : "M"}${(50 + Math.cos(a) * r).toFixed(2)} ${(50 + Math.sin(a) * r).toFixed(2)}`;
  }).join(" ") + " Z";
  const laurel = metal === "gold" || metal === "platinum";
  // alloro: due rami che salgono dal basso lungo il bordo del campo, foglie tangenti e un po' aperte
  const leaves = (side: 1 | -1) =>
    Array.from({ length: 7 }, (_, i) => {
      const phi = ((90 + side * (16 + i * 17)) * Math.PI) / 180;
      const x = 50 + Math.cos(phi) * 30.5;
      const y = 50 + Math.sin(phi) * 30.5;
      const rot = (phi * 180) / Math.PI - side * 28;
      return <ellipse key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} rx="1.9" ry="4.2" transform={`rotate(${rot.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})`} />;
    });
  const emboss = (color: string, dx: number, dy: number, op = 1) =>
    icon ? (
      <svg x={27 + dx} y={27 + dy} width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color }} opacity={op} overflow="visible">
        {glyphArt(icon)}
      </svg>
    ) : (
      <g transform={`translate(${dx} ${dy})`} fill={color} stroke={color} opacity={op}>{symbolArt(symbol ?? "")}</g>
    );
  return (
    <svg viewBox={ribbon ? "0 0 100 112" : "0 0 100 100"} width={size} height={ribbon ? size * 1.12 : size} className={locked ? "opacity-45 grayscale" : ""} aria-hidden>
      <defs>
        <linearGradient id={`${id}r`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={lux} />
          <stop offset="0.3" stopColor={hi} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="0.8" stopColor={lo} />
          <stop offset="1" stopColor={hi} />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0.85" y1="1" x2="0.15" y2="0">
          <stop offset="0" stopColor={lux} />
          <stop offset="0.4" stopColor={mid} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <radialGradient id={`${id}f`} cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor={hi} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={lo} />
        </radialGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={lux} />
          <stop offset="1" stopColor={hi} />
        </linearGradient>
        <clipPath id={`${id}c`}><circle cx="50" cy="50" r="34" /></clipPath>
      </defs>
      {ribbon ? (
        <g>
          <path d="M33 76 L24 110 L33 104 L39 111 L45 80 Z" fill={rib} />
          <path d="M67 76 L76 110 L67 104 L61 111 L55 80 Z" fill={rib} />
          <path d="M36 78 L29 106 M64 78 L71 106" stroke={ribStripe} strokeWidth="2.4" strokeOpacity="0.85" />
          <path d="M33 76 L24 110 L33 104 L39 111 L45 80 Z M67 76 L76 110 L67 104 L61 111 L55 80 Z" fill="#000" opacity="0.18" />
        </g>
      ) : null}
      {/* ombra a terra e spessore della moneta */}
      <circle cx="51" cy="52.5" r="46.5" fill="#000" opacity="0.35" />
      <circle cx="50" cy="51.4" r="46.2" fill={deep} />
      {/* bordo zigrinato */}
      <path d={reeded} fill={`url(#${id}r)`} stroke={deep} strokeWidth="0.5" strokeOpacity="0.6" />
      {/* smusso: anello in luce e anello in ombra */}
      <circle cx="50" cy="50" r="41.6" fill={`url(#${id}b)`} />
      <circle cx="50" cy="50" r="39.4" fill={`url(#${id}r)`} />
      <circle cx="50" cy="50" r="36.4" fill={`url(#${id}b)`} />
      {/* campo */}
      <circle cx="50" cy="50" r="34.6" fill={`url(#${id}f)`} />
      <g clipPath={`url(#${id}c)`}>
        {/* satinatura a raggi */}
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2;
          return <path key={i} d={`M50 50 L${(50 + Math.cos(a) * 36).toFixed(1)} ${(50 + Math.sin(a) * 36).toFixed(1)}`} stroke={i % 2 ? lux : lo} strokeOpacity="0.07" strokeWidth="1.4" />;
        })}
        <circle cx="50" cy="50" r="30.4" fill="none" stroke={lo} strokeOpacity="0.5" strokeWidth="0.7" strokeDasharray="1.2 2" />
      </g>
      {laurel ? (
        <g>
          <g fill={lo} opacity="0.9" transform="translate(0.6 0.8)">{leaves(1)}{leaves(-1)}</g>
          <g fill={`url(#${id}s)`}>{leaves(1)}{leaves(-1)}</g>
        </g>
      ) : null}
      {/* simbolo coniato: ombra in basso a destra, luce in alto a sinistra, metallo sopra */}
      {emboss(deep, 1.1, 1.3, 0.75)}
      {emboss(lux, -0.6, -0.7, 0.8)}
      {emboss(lo, 0, 0)}
      {metal === "platinum" ? (
        <g>
          <path d="M50 3.5 L55 8.5 L50 14 L45 8.5 Z" fill="#9fd8ff" stroke={lo} strokeWidth="0.8" />
          <path d="M50 3.5 L45 8.5 L50 8.5 Z" fill="#fff" opacity="0.8" />
        </g>
      ) : null}
      {/* riflessi */}
      <path d="M17 40 A34 34 0 0 1 44 15" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M80 64 A34 34 0 0 1 66 80" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="28" cy="25" r="1.6" fill="#fff" opacity="0.9" />
    </svg>
  );
}

/** ogni famiglia di premi: simbolo e smalto (le gare in rubino, gli allenamenti in smeraldo…) */
const FAMILY_ART: Record<PrizeTier["symbol"], { symbol: InsSymbol; enamel: InsEnamel }> = {
  arrow: { symbol: "arrow", enamel: "emerald" },
  bow: { symbol: "bow", enamel: "teal" },
  target: { symbol: "target", enamel: "ruby" },
  medal: { symbol: "laurel", enamel: "ruby" },
  flame: { symbol: "flame", enamel: "amber" },
  rise: { symbol: "rise", enamel: "sapphire" },
};
/** i traguardi dei punti campionato oltre i 100 hanno un'insegna tutta loro: coppa, corona, stendardo */
const CODE_ART: Record<string, { symbol: InsSymbol; enamel: InsEnamel; shape: InsShape }> = {
  champ_150: { symbol: "trophy", enamel: "ruby", shape: "shield" },
  champ_200: { symbol: "trophy", enamel: "ruby", shape: "shield" },
  champ_300: { symbol: "crown", enamel: "amethyst", shape: "hex" },
  champ_400: { symbol: "crown", enamel: "amethyst", shape: "hex" },
  champ_500: { symbol: "crown", enamel: "amethyst", shape: "hex" },
  champ_750: { symbol: "gonfalon", enamel: "sapphire", shape: "rosette" },
  champ_1000: { symbol: "gonfalon", enamel: "night", shape: "rosette" },
};
const TIER_METAL: Record<PrizeTier["metal"], InsMetal> = { base: "iron", bronze: "bronze", silver: "silver", gold: "gold", platinum: "platinum" };
const TIER_SHAPE: Record<PrizeTier["metal"], InsShape> = { base: "round", bronze: "round", silver: "round", gold: "rosette", platinum: "rosette" };

/** premio coniato: metallo del livello, smalto della famiglia, nastro, raggi per oro e platino, stelle sotto */
export function PrizeMark({ code, locked = false, size = "md" }: { code: string; locked?: boolean; size?: "md" | "lg" }) {
  const tier = prizeTier(code);
  const ring = RING[tier.metal];
  const px = size === "lg" ? 80 : 60;
  const own = CODE_ART[code];
  const art = own ?? FAMILY_ART[tier.symbol];
  const precious = tier.metal === "gold" || tier.metal === "platinum";
  return (
    <span className={`inline-flex w-16 shrink-0 flex-col items-center ${size === "lg" ? "w-20" : ""}`}>
      <Insignia symbol={art.symbol} enamel={art.enamel} metal={TIER_METAL[tier.metal]} shape={own?.shape ?? TIER_SHAPE[tier.metal]} ribbon laurel={tier.metal === "platinum" || code === "champ_1000"} glow={precious && !locked} locked={locked} size={px} />
      <span className="mt-1 flex h-3 items-center justify-center gap-px">
        {Array.from({ length: tier.stars }, (_, index) => (
          <Star key={index} color={ring.color} />
        ))}
      </span>
    </span>
  );
}
