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
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path d="M6 0.8 L7.4 4.4 H11.2 L8.1 6.6 L9.4 10.4 L6 8.2 L2.6 10.4 L3.9 6.6 L0.8 4.4 H4.6 Z" fill={color} />
    </svg>
  );
}

export function PrizeMark({ code, locked = false, size = "md" }: { code: string; locked?: boolean; size?: "md" | "lg" }) {
  const tier = prizeTier(code);
  const ring = RING[tier.metal];
  const dim = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  return (
    <span className={`inline-flex w-16 shrink-0 flex-col items-center ${locked ? "opacity-40 grayscale" : ""}`}>
      <span
        className={`relative ${dim} overflow-hidden rounded-full bg-[#0c1210]`}
        style={{ boxShadow: `0 0 0 2px #0c1210, 0 0 0 4px ${ring.color}` }}
      >
        <img src={`/premi/${tier.symbol}.jpg`} alt="" className="h-full w-full object-cover" />
      </span>
      <span className="mt-1 flex h-3 items-center justify-center gap-px">
        {Array.from({ length: tier.stars }, (_, index) => (
          <Star key={index} color={ring.color} />
        ))}
      </span>
    </span>
  );
}
