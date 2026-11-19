const LADDERS = {
  arrow: ["arrows_100", "arrows_500", "arrows_1000", "arrows_5000"],
  bow: ["first_session", "sessions_5", "sessions_10", "sessions_50", "sessions_100"],
  target: ["first_comp", "gare_5", "gare_10"],
  medal: ["champ_10", "champ_50", "champ_100"],
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

/** Colori del metallo: chiaro, medio, scuro (per il bordo lucido a gradiente). */
const METAL: Record<string, [string, string, string]> = {
  base: ["#b9c9bf", "#7f9487", "#4c5c53"],
  bronze: ["#f0b27a", "#c4844a", "#7a4a22"],
  silver: ["#ffffff", "#c9d2db", "#7d8894"],
  gold: ["#fff1b0", "#e2b340", "#8a6216"],
  platinum: ["#ffffff", "#dcd6f2", "#8c84b3"],
};

/** Simbolo inciso al centro della medaglia. */
function Glyph({ symbol, color }: { symbol: string; color: string }) {
  const s = { fill: "none", stroke: color, strokeWidth: 3.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (symbol) {
    case "arrow":
      return <g><path d="M28 72 L66 34" {...s} /><path d="M74 26 L60 32 L68 40 Z" fill={color} /><path d="M38 62 L33 52 M38 62 L48 67 M32 68 L27 58 M32 68 L42 73" {...s} strokeWidth={2.6} /></g>;
    case "bow":
      return <g><path d="M40 22 C64 34 64 66 40 78" {...s} /><path d="M40 22 L40 78" {...s} strokeWidth={1.8} /><path d="M40 50 L72 50" {...s} strokeWidth={2.4} /><path d="M72 50 L65 46 M72 50 L65 54" {...s} strokeWidth={2.4} /></g>;
    case "target":
      return <g><circle cx="50" cy="50" r="20" {...s} /><circle cx="50" cy="50" r="11" {...s} /><circle cx="50" cy="50" r="3.5" fill={color} /></g>;
    case "medal":
      return <g><path d="M36 64 C26 54 28 40 36 32 M64 64 C74 54 72 40 64 32" {...s} strokeWidth={2.6} /><path d="M50 36 L54 46 L65 46 L56 53 L59 64 L50 57 L41 64 L44 53 L35 46 L46 46 Z" fill={color} /></g>;
    case "flame":
      return <g><path d="M50 26 C60 40 68 46 64 60 C61 70 54 74 50 74 C42 74 35 68 35 59 C35 50 42 46 44 38 C48 46 50 48 52 46 C52 40 50 32 50 26 Z" fill={color} /></g>;
    case "rise":
      return <g><path d="M30 68 L44 54 L54 62 L70 40" {...s} /><path d="M70 40 L60 40 M70 40 L70 50" {...s} /></g>;
    default:
      return <circle cx="50" cy="50" r="10" fill={color} />;
  }
}

export function PrizeMark({ code, locked = false, size = "md" }: { code: string; locked?: boolean; size?: "md" | "lg" }) {
  const tier = prizeTier(code);
  const ring = RING[tier.metal];
  const [hi, mid, lo] = METAL[tier.metal] ?? METAL.base;
  const dim = size === "lg" ? "h-20 w-20" : "h-14 w-14";
  const id = `m-${tier.symbol}-${tier.metal}`;
  return (
    <span className={`inline-flex w-16 shrink-0 flex-col items-center ${size === "lg" ? "w-20" : ""} ${locked ? "opacity-40 grayscale" : ""}`}>
      <span className={`aa-medal relative ${dim}`}>
        <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)]" aria-hidden>
          <defs>
            <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={hi} />
              <stop offset="0.45" stopColor={mid} />
              <stop offset="1" stopColor={lo} />
            </linearGradient>
            <radialGradient id={`${id}-face`} cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#24382d" />
              <stop offset="1" stopColor="#0a120e" />
            </radialGradient>
          </defs>
          {/* bordo dentellato */}
          <path
            d={Array.from({ length: 24 }, (_, i) => {
              const a = (i / 24) * Math.PI * 2;
              const r = i % 2 ? 46 : 49;
              return `${i ? "L" : "M"}${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`;
            }).join(" ") + " Z"}
            fill={`url(#${id}-rim)`}
          />
          <circle cx="50" cy="50" r="39" fill={`url(#${id}-face)`} stroke={lo} strokeWidth="1.5" />
          <circle cx="50" cy="50" r="34" fill="none" stroke={mid} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2 3" />
          <Glyph symbol={tier.symbol} color={hi} />
          {/* riflesso */}
          <path d="M18 36 A34 34 0 0 1 52 12" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
        </svg>
        {!locked && tier.metal !== "base" ? <span className="aa-medal-shine" aria-hidden /> : null}
      </span>
      <span className="mt-1 flex h-3 items-center justify-center gap-px">
        {Array.from({ length: tier.stars }, (_, index) => (
          <Star key={index} color={ring.color} />
        ))}
      </span>
    </span>
  );
}
