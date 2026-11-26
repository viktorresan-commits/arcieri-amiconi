/**
 * Lo stendardo del campionato, appeso accanto all'arciere: il posto in categoria in grande (come lo pubblica
 * il portale FITAST), sotto la generale di tutti gli arcieri, la divisione e la compagnia. Il bordo è d'oro,
 * d'argento o di bronzo per chi è sul podio della sua categoria; il drappo ondeggia piano.
 */
import { useId } from "react";
import type { FitastRank } from "@/lib/arcieri/fitast-rank";
import { titleName } from "@/lib/arcieri/fitast-league";

type Trim = { name: string; light: string; mid: string; dark: string };
const TRIMS: Record<"gold" | "silver" | "bronze" | "steel", Trim> = {
  gold: { name: "oro", light: "#fff4c2", mid: "#e8b93e", dark: "#8a5a0c" },
  silver: { name: "argento", light: "#ffffff", mid: "#cfd8e2", dark: "#6f7b88" },
  bronze: { name: "bronzo", light: "#ffd9b0", mid: "#c98446", dark: "#6e3c15" },
  steel: { name: "acciaio", light: "#f1e7cf", mid: "#c9b68a", dark: "#6d5b36" },
};

/** la divisione al plurale, come la si dice in gara */
function divisionName(raw: string) {
  const t = raw.toLowerCase();
  if (/madonn|madam/.test(t)) return "Madonne";
  if (/messer/.test(t)) return "Messeri";
  if (/puer/.test(t)) return "Pueri";
  if (/junior/.test(t)) return "Juniores";
  return titleName(raw);
}

export function RankBanner({ r, className = "" }: { r: FitastRank; className?: string }) {
  const id = `rb${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const trim = TRIMS[r.place === 1 ? "gold" : r.place === 2 ? "silver" : r.place === 3 ? "bronze" : "steel"];
  const metalText = { backgroundImage: `linear-gradient(180deg, ${trim.light} 10%, ${trim.mid} 55%, ${trim.dark} 100%)` };
  const cat = titleName(r.category);
  const division = divisionName(r.division);
  // la divisione si mostra solo se la categoria dice anche l'arco (altrimenti è lo stesso posto)
  const showDivision = r.divisionPlace != null && r.divisionSize > 0 && r.category.includes("·");
  const lines: Array<{ n: number; label: string; of: number }> = [];
  if (r.overall != null) lines.push({ n: r.overall, label: "generale", of: r.overallSize });
  if (showDivision && r.divisionPlace != null) lines.push({ n: r.divisionPlace, label: division, of: r.divisionSize });
  if (r.teamPlace != null && r.teamSize > 1) lines.push({ n: r.teamPlace, label: "compagnia", of: r.teamSize });
  const title = [
    r.place ? `${r.place}° in categoria ${cat}${r.size ? ` su ${r.size}` : ""}` : `In classifica nella categoria ${cat}`,
    ...lines.map((l) => `${l.n}° ${l.label === "generale" ? "nella generale" : l.label === "compagnia" ? "in compagnia" : `tra ${l.label}`} su ${l.of}`),
    r.points != null ? `${r.points} punti campionato` : "",
  ].filter(Boolean).join(", ");
  return (
    <figure className={`aa-banner-sway relative ${className}`} aria-label={title} title={title}>
      {/* l'asta con i pomoli e il cordino */}
      <div aria-hidden className="relative mx-[-8%] h-[0.45rem] rounded-full" style={{ background: `linear-gradient(180deg, ${trim.light}, ${trim.mid} 45%, ${trim.dark})`, boxShadow: "0 2px 4px rgb(0 0 0 / 0.45)" }}>
        <span className="absolute -left-1 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${trim.light}, ${trim.mid} 50%, ${trim.dark})` }} />
        <span className="absolute -right-1 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${trim.light}, ${trim.mid} 50%, ${trim.dark})` }} />
        <svg viewBox="0 0 40 14" className="absolute bottom-full left-1/2 h-3.5 w-10 -translate-x-1/2" aria-hidden>
          <path d="M3 14 L20 2 L37 14" fill="none" stroke={trim.mid} strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="20" cy="2.4" r="2" fill={trim.light} />
        </svg>
      </div>
      <div className="aa-banner-cloth relative -mt-0.5">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full drop-shadow-[0_10px_14px_rgba(0,0,0,0.5)]" aria-hidden>
          <defs>
            <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9c1e31" />
              <stop offset="0.55" stopColor="#72121f" />
              <stop offset="1" stopColor="#420912" />
            </linearGradient>
            {/* pieghe del drappo */}
            <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#000" stopOpacity="0.32" />
              <stop offset="0.16" stopColor="#fff" stopOpacity="0.06" />
              <stop offset="0.3" stopColor="#000" stopOpacity="0.14" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.1" />
              <stop offset="0.7" stopColor="#000" stopOpacity="0.16" />
              <stop offset="0.85" stopColor="#fff" stopOpacity="0.05" />
              <stop offset="1" stopColor="#000" stopOpacity="0.36" />
              {/* le pieghe scorrono come col vento */}
              <animateTransform attributeName="gradientTransform" type="translate" values="-0.12 0; 0.12 0; -0.12 0" dur="4.2s" repeatCount="indefinite" />
            </linearGradient>
            <linearGradient id={`${id}sh`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.22" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${id}clip`}><path d="M2 0 H98 V100 L50 87 L2 100 Z" /></clipPath>
          </defs>
          <path d="M2 0 H98 V100 L50 87 L2 100 Z" fill={`url(#${id}c)`} />
          <path d="M2 0 H98 V100 L50 87 L2 100 Z" fill={`url(#${id}f)`} />
          {/* riflesso che attraversa il drappo */}
          <g clipPath={`url(#${id}clip)`}><rect className="aa-banner-shine" x="-60" y="-10" width="40" height="120" fill={`url(#${id}sh)`} transform="skewX(-18)" /></g>
          <path d="M2 0 H98 V100 L50 87 L2 100 Z" fill="none" stroke={trim.mid} strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <path d="M8 2.5 H92 V91 L50 79.5 L8 91 Z" fill="none" stroke={trim.light} strokeOpacity="0.75" strokeWidth="1.2" strokeDasharray="1.5 3" vectorEffect="non-scaling-stroke" />
        </svg>
        <figcaption className="relative grid justify-items-center px-[9%] pb-[38%] pt-2.5 text-center text-[#fff3dc]">
          <span className="text-[0.56rem] font-semibold leading-none tracking-wide text-[#fff3dc]/80">Campionato</span>
          {r.place ? (
            <span className="mt-1 bg-clip-text font-display text-[2.55rem] leading-[0.95] text-transparent drop-shadow-[0_2px_1px_rgba(0,0,0,0.55)]" style={metalText}>
              {r.place}°
            </span>
          ) : (
            <span className="mt-1 font-display text-2xl leading-none text-[#fff3dc]">—</span>
          )}
          <span className="text-[0.56rem] leading-tight text-[#fff3dc]/80">in categoria</span>
          <span className="mt-0.5 line-clamp-2 text-[0.64rem] font-semibold leading-tight">{cat || "—"}</span>
          {r.size ? <span className="text-[0.54rem] leading-tight text-[#fff3dc]/65">su {r.size}</span> : null}
          {lines.length ? (
            <span aria-hidden className="my-1.5 flex w-full items-center gap-1">
              <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${trim.mid})` }} />
              <span className="h-1.5 w-1.5 rotate-45" style={{ background: trim.mid }} />
              <span className="h-px flex-1" style={{ background: `linear-gradient(270deg, transparent, ${trim.mid})` }} />
            </span>
          ) : null}
          {lines.map((l) => (
            <span key={l.label} className="grid w-full grid-cols-[auto_1fr] items-baseline gap-x-1 text-left leading-tight">
              <span className="font-display text-[1.05rem] leading-none tabular-nums" style={{ color: trim.light }}>{l.n}°</span>
              <span className="min-w-0 truncate text-[0.58rem] font-semibold">{l.label}</span>
              <span className="col-start-2 -mt-0.5 text-[0.5rem] text-[#fff3dc]/60">su {l.of}</span>
            </span>
          ))}
          {r.points != null ? (
            <span className="mt-1.5 rounded-full px-1.5 py-0.5 text-[0.56rem] font-bold tabular-nums text-[#2a1606]" style={{ background: `linear-gradient(180deg, ${trim.light}, ${trim.mid})` }}>
              {r.points} pt
            </span>
          ) : null}
        </figcaption>
        {/* nappe d'oro alle due punte */}
        {[["left-[1%]", "0s"], ["right-[1%]", "-1.1s"]].map(([pos, delay]) => (
          <span key={pos} aria-hidden className={`aa-tassel absolute -bottom-[1.05rem] ${pos} grid w-2.5 justify-items-center`} style={{ animationDelay: delay }}>
            <span className="h-1.5 w-px" style={{ background: trim.mid }} />
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: trim.light }} />
            <span className="h-2.5 w-2 rounded-b-[3px]" style={{ background: `repeating-linear-gradient(90deg, ${trim.mid} 0 1px, ${trim.dark} 1px 2px)` }} />
          </span>
        ))}
      </div>
    </figure>
  );
}
