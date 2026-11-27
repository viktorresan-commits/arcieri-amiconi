import { nextStep, LADDERS } from "@/lib/arcieri/prize-ladders";

/** metallo del picchetto: sale con le piazzole fatte (come i premi delle piazzole) */
function metalOf(n: number) {
  const steps = LADDERS.find((l) => l.id === "piazzole")?.steps ?? [];
  const reached = steps.filter((s) => n >= s.at).length;
  if (reached >= 7) return { rim: ["#ffffff", "#ddd6f3", "#7f76a8"], plate: ["#3d2a6e", "#150c2c"], name: "Platino" };
  if (reached >= 5) return { rim: ["#fff0b8", "#d9a93c", "#8a5c10"], plate: ["#5a1f24", "#2a0c10"], name: "Oro" };
  if (reached >= 3) return { rim: ["#ffffff", "#c9d3dc", "#7b8894"], plate: ["#1d3d63", "#0b1c33"], name: "Argento" };
  if (reached >= 1) return { rim: ["#ffd9b0", "#c98a4b", "#7a4a1e"], plate: ["#1f4a33", "#0b2016"], name: "Bronzo" };
  return { rim: ["#e9eef2", "#aeb8c1", "#4c5761"], plate: ["#2a3138", "#111518"], name: "" };
}

/**
 * Le piazzole fatte, come il picchetto numerato di una piazzola del percorso 3D: palo di legno, targa di
 * metallo con il bersaglio e la freccia piantata, il numero sul cartiglio e quanto manca al prossimo traguardo.
 */
export function PiazzoleMark({ n, id = "pz" }: { n: number; id?: string }) {
  const m = metalOf(n);
  const next = nextStep("piazzole", n);
  const prev = LADDERS.find((l) => l.id === "piazzole")?.steps.filter((s) => s.at <= n).at(-1)?.at ?? 0;
  const pct = next ? Math.round(((n - prev) / Math.max(1, next.at - prev)) * 100) : 100;
  const label = n.toLocaleString("it-IT");
  return (
    <div className="aa-crest grid justify-items-center" aria-label={`${label} piazzole fatte`}>
      <div className="h-[4.6rem] w-[4rem]">
        <svg viewBox="0 0 64 74" className="h-full w-full drop-shadow-[0_8px_12px_rgba(0,0,0,0.55)]" aria-hidden>
          <defs>
            <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#4a2e17" />
              <stop offset="0.35" stopColor="#8a5a30" />
              <stop offset="0.7" stopColor="#6b4322" />
              <stop offset="1" stopColor="#3a2310" />
            </linearGradient>
            <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={m.rim[0]} />
              <stop offset="0.45" stopColor={m.rim[1]} />
              <stop offset="1" stopColor={m.rim[2]} />
            </linearGradient>
            <radialGradient id={`${id}p`} cx="0.35" cy="0.3" r="0.9">
              <stop offset="0" stopColor={m.plate[0]} />
              <stop offset="1" stopColor={m.plate[1]} />
            </radialGradient>
          </defs>
          {/* palo di legno piantato nel terreno, con le venature */}
          <path d="M26.5 34 H37.5 V60 H26.5 Z" fill={`url(#${id}w)`} stroke="#2a180a" strokeWidth="0.8" />
          <path d="M29 38 C30 44 28.5 50 30 58 M34.5 37 C33.5 45 35.5 51 34 58" stroke="#2a180a" strokeWidth="0.7" fill="none" opacity="0.55" />
          {/* targa di metallo con il bersaglio */}
          <circle cx="32" cy="24" r="21" fill={`url(#${id}r)`} stroke={m.rim[2]} strokeWidth="0.8" />
          <circle cx="32" cy="24" r="17.2" fill={`url(#${id}p)`} />
          <circle cx="32" cy="24" r="12.4" fill="none" stroke={m.rim[1]} strokeWidth="1.6" opacity="0.9" />
          <circle cx="32" cy="24" r="7.6" fill="none" stroke={m.rim[1]} strokeWidth="1.6" opacity="0.9" />
          <circle cx="32" cy="24" r="3" fill={m.rim[1]} />
          {/* la freccia piantata nel centro */}
          <path d="M33 23 L49 9" stroke="#2a180a" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M33 23 L49 9" stroke="#e8dcc0" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M46.5 8 L52 3.5 M49.5 11 L55 6.5 M48 9.5 L53.5 5" stroke="#d64b3a" strokeWidth="1.6" strokeLinecap="round" />
          {/* riflesso */}
          <path d="M15 18 A17 17 0 0 1 26 8" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      {/* cartiglio con il numero */}
      <div className="-mt-2 rounded-md px-2.5 py-0.5 text-center" style={{ background: `linear-gradient(180deg, ${m.rim[1]}, ${m.rim[2]})` }}>
        <span className="block whitespace-nowrap font-display text-[0.8rem] leading-tight text-[#1a1408] tabular-nums">{label} {n === 1 ? "piazzola" : "piazzole"}</span>
      </div>
      {/* verso il prossimo traguardo */}
      <div className="mt-1.5 w-[4.6rem]">
        <div className="h-1.5 overflow-hidden rounded-full bg-black/45 ring-1 ring-white/15">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${m.rim[2]}, ${m.rim[0]})` }} />
        </div>
        <p className="mt-0.5 text-center text-[0.6rem] font-semibold leading-tight text-white drop-shadow">{next ? `${(next.at - n).toLocaleString("it-IT")} alle ${next.at.toLocaleString("it-IT")}` : "Traguardo massimo"}</p>
      </div>
    </div>
  );
}
