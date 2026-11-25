import { levelOf } from "@/lib/arcieri/xp";

/** metallo dello stemma: sale con il livello */
function metalOf(level: number) {
  if (level >= 20) return { rim: ["#fff3c4", "#e2b54a", "#9a6b12"], field: ["#1f5a3c", "#0c2a1c"], text: "#ffe9a8", name: "Oro reale" };
  if (level >= 10) return { rim: ["#fff0b8", "#d9a93c", "#8a5c10"], field: ["#5a1f24", "#2a0c10"], text: "#ffe2a0", name: "Oro" };
  if (level >= 5) return { rim: ["#ffffff", "#c9d3dc", "#7b8894"], field: ["#1d3d63", "#0b1c33"], text: "#eef4fb", name: "Argento" };
  return { rim: ["#ffd9b0", "#c98a4b", "#7a4a1e"], field: ["#3b2a1c", "#1c120a"], text: "#ffe0bd", name: "Bronzo" };
}

/**
 * Colori dell'alone attorno al ritratto, quelli dello stemma del livello: bronzo e cuoio, argento e
 * azzurro, oro e rubino, oro reale e smeraldo. a = metallo, b = smalto, c = luce.
 */
export function levelHalo(level: number) {
  if (level >= 20) return { a: "#f5c94a", b: "#2fbf71", c: "#fff3c4", name: "Oro reale" };
  if (level >= 10) return { a: "#e8b93e", b: "#e0435a", c: "#fff0b8", name: "Oro" };
  if (level >= 5) return { a: "#c9d3dc", b: "#5aa8ff", c: "#ffffff", name: "Argento" };
  return { a: "#d9925a", b: "#a8562a", c: "#ffd9b0", name: "Bronzo" };
}

/** lo stesso alone a partire dai punti */
export const haloOfXp = (xp: number) => levelHalo(levelOf(Math.max(0, xp)).level);

/**
 * Stemma del livello dell'arciere: scudo araldico con il numero, nastro e barra dei punti verso il
 * livello successivo. compact: solo lo scudo piccolo, da appoggiare sul ritratto.
 */
export function LevelCrest({ xp, compact = false, className = "" }: { xp: number; compact?: boolean; className?: string }) {
  const lv = levelOf(Math.max(0, xp));
  const m = metalOf(lv.level);
  const pct = Math.round((lv.into / Math.max(1, lv.need)) * 100);
  const id = `lc${lv.level}${compact ? "c" : ""}`;
  const shield = (
    <svg viewBox="0 0 64 74" className={compact ? "h-full w-full" : "h-full w-full drop-shadow-[0_8px_12px_rgba(0,0,0,0.55)]"} aria-hidden>
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.rim[0]} />
          <stop offset="0.45" stopColor={m.rim[1]} />
          <stop offset="1" stopColor={m.rim[2]} />
        </linearGradient>
        <radialGradient id={`${id}f`} cx="0.35" cy="0.25" r="0.9">
          <stop offset="0" stopColor={m.field[0]} />
          <stop offset="1" stopColor={m.field[1]} />
        </radialGradient>
      </defs>
      {/* scudo: bordo di metallo, campo smaltato, riflesso in alto */}
      <path d="M32 2 L60 10 V34 C60 52 47 64 32 72 C17 64 4 52 4 34 V10 Z" fill={`url(#${id}r)`} />
      <path d="M32 7 L55 13.5 V34 C55 49 44.5 59 32 66 C19.5 59 9 49 9 34 V13.5 Z" fill={`url(#${id}f)`} />
      <path d="M32 7 L55 13.5 V22 C44 18 20 18 9 22 V13.5 Z" fill="#fff" opacity="0.1" />
      {/* due frecce incrociate dietro il numero */}
      <g stroke={m.rim[1]} strokeWidth="1.6" strokeLinecap="round" opacity="0.55">
        <path d="M17 54 L47 19" />
        <path d="M47 54 L17 19" />
        <path d="M47 19 l-5 1 M47 19 l-1 5 M17 19 l5 1 M17 19 l1 5" />
      </g>
      <text x="32" y={lv.level >= 10 ? 46 : 47} textAnchor="middle" fontFamily="var(--font-display, inherit)" fontWeight="700" fontSize={lv.level >= 100 ? 20 : lv.level >= 10 ? 25 : 29} fill={m.text} stroke={m.field[1]} strokeWidth="0.8" paintOrder="stroke">
        {lv.level}
      </text>
    </svg>
  );
  if (compact) {
    return (
      <span className={`inline-block ${className}`} title={`Livello ${lv.level}`} aria-label={`Livello ${lv.level}`}>
        {shield}
      </span>
    );
  }
  return (
    <div className={`aa-crest grid justify-items-center ${className}`} aria-label={`Livello ${lv.level}, ${lv.into} punti su ${lv.need}`}>
      <div className="aa-crest-shield h-[4.6rem] w-[4rem]">{shield}</div>
      {/* nastro con il nome del livello */}
      <div className="aa-crest-ribbon -mt-2 rounded-md px-2.5 py-0.5 text-center" style={{ background: `linear-gradient(180deg, ${m.rim[1]}, ${m.rim[2]})` }}>
        <span className="block font-display text-[0.8rem] leading-tight text-[#1a1408]">Livello {lv.level}</span>
      </div>
      {/* punti verso il livello successivo */}
      <div className="mt-1.5 w-[4.6rem]">
        <div className="h-1.5 overflow-hidden rounded-full bg-black/45 ring-1 ring-white/15">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${m.rim[2]}, ${m.rim[0]})` }} />
        </div>
        <p className="mt-0.5 text-center text-[0.6rem] font-semibold leading-tight text-white drop-shadow">{lv.need - lv.into} punti al {lv.level + 1}</p>
      </div>
    </div>
  );
}
