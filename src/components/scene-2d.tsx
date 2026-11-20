import type { Sky } from "@/lib/arcieri/sky3d";

/**
 * Sfondo illustrato del campo di tiro (stile gioco): cielo dell'ora scelta con sole o luna, raggi,
 * nuvole che scorrono, stelle di notte, pioggia, montagne, bosco e prato. Riempie il contenitore.
 */
const PAL: Record<Sky["tod"], { top: string; mid: string; low: string; far: string; near: string; hill: string; grass: string; grass2: string; tree: [string, string]; sun: string }> = {
  mattina: { top: "#5b8fd6", mid: "#a9cdea", low: "#ffe2b8", far: "#9db3c6", near: "#6e8f86", hill: "#58784c", grass: "#5d8a45", grass2: "#4c7639", tree: ["#3b6a3e", "#2f5a35"], sun: "#fff1c9" },
  pomeriggio: { top: "#2f6db8", mid: "#7fb2e0", low: "#d8ecf6", far: "#8aa6bd", near: "#5f7d8f", hill: "#4f7a45", grass: "#5b8a40", grass2: "#4a7535", tree: ["#36583a", "#2f4d33"], sun: "#fffbe8" },
  tramonto: { top: "#2a2e63", mid: "#c9617a", low: "#ffb065", far: "#7d5a78", near: "#5a4560", hill: "#3f4a35", grass: "#4b5f33", grass2: "#3c4f2a", tree: ["#2c3a2a", "#232f22"], sun: "#ffd27a" },
  notte: { top: "#050a1a", mid: "#0f1e3d", low: "#22355c", far: "#1c2a44", near: "#141f33", hill: "#13202a", grass: "#1d3326", grass2: "#172a1f", tree: ["#10201a", "#0c1914"], sun: "#e8eeff" },
};

export function SceneBackdrop({ sky, id = "bk" }: { sky: Sky; id?: string }) {
  const p = PAL[sky.tod];
  const rain = sky.weather === "pioggia";
  const cloudy = sky.weather !== "sereno";
  const night = sky.tod === "notte";
  const sunX = sky.tod === "mattina" ? 70 : sky.tod === "tramonto" ? 330 : sky.tod === "notte" ? 300 : 300;
  const sunY = sky.tod === "pomeriggio" ? 46 : sky.tod === "tramonto" ? 150 : sky.tod === "mattina" ? 110 : 60;
  const grey = rain ? 0.55 : cloudy ? 0.25 : 0;
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.top} />
          <stop offset="0.55" stopColor={p.mid} />
          <stop offset="0.78" stopColor={p.low} />
        </linearGradient>
        <radialGradient id={`${id}sun`} cx={sunX / 400} cy={sunY / 300} r="0.45">
          <stop offset="0" stopColor={p.sun} stopOpacity={night ? 0.5 : 0.95} />
          <stop offset="0.2" stopColor={p.sun} stopOpacity={night ? 0.15 : 0.45} />
          <stop offset="1" stopColor={p.sun} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}mist`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor={night ? "#9fb4d8" : "#fff"} stopOpacity={night ? 0.08 : 0.22} />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}sky)`} />
      {night ? (
        <g fill="#fff">
          {Array.from({ length: 70 }, (_, i) => {
            const x = (i * 97.3) % 400;
            const y = (i * 41.7) % 150;
            return <circle key={i} cx={x} cy={y} r={i % 9 === 0 ? 1.1 : 0.6} opacity={0.4 + ((i * 13) % 7) / 12} className={i % 5 === 0 ? "aa-twinkle" : undefined} style={{ animationDelay: `${(i % 7) * 0.5}s` }} />;
          })}
        </g>
      ) : null}
      {!rain ? <rect width="400" height="300" fill={`url(#${id}sun)`} className="aa-sun-pulse" /> : null}
      {!rain ? (
        night ? (
          <g>
            <circle cx={sunX} cy={sunY} r="13" fill="#eef2ff" />
            <circle cx={sunX + 5} cy={sunY - 3} r="11" fill={p.mid} />
          </g>
        ) : (
          <circle cx={sunX} cy={sunY} r={sky.tod === "tramonto" ? 20 : 15} fill={p.sun} opacity={cloudy ? 0.6 : 1} />
        )
      ) : null}
      {!night && !rain ? (
        <g className="aa-ray" fill={p.sun}>
          {[-30, -12, 6, 24].map((a, i) => (
            <path key={a} d={`M${sunX} ${sunY} L${sunX + Math.cos(((90 + a) * Math.PI) / 180) * 420 - 26} ${sunY + 420} L${sunX + Math.cos(((90 + a) * Math.PI) / 180) * 420 + 26} ${sunY + 420} Z`} opacity={0.06 + (i % 2) * 0.03} />
          ))}
        </g>
      ) : null}
      <g className="aa-clouds" fill={night ? "#2a3550" : rain ? "#7d8792" : sky.tod === "tramonto" ? "#ffc9a8" : "#fff"} opacity={rain ? 0.95 : cloudy ? 0.8 : 0.55}>
        {(cloudy ? [[20, 40, 1.2], [120, 22, 1], [210, 50, 1.3], [310, 30, 1.1], [420, 44, 1.2], [520, 26, 1], [620, 46, 1.2]] : [[40, 40, 1], [170, 26, 0.8], [290, 54, 1.1], [420, 34, 0.9], [540, 48, 1]]).map(([x, y, k]) => (
          <g key={x} transform={`translate(${x} ${y}) scale(${k})`}>
            <ellipse cx="0" cy="0" rx="36" ry="9" />
            <ellipse cx="13" cy="-7" rx="17" ry="10" />
            <ellipse cx="-12" cy="-4" rx="15" ry="8" />
            <ellipse cx="-2" cy="2" rx="30" ry="5" opacity="0.5" fill="#000" fillOpacity={0.06} />
          </g>
        ))}
      </g>
      {!night && !rain ? (
        <g className="aa-birds" stroke="#2a3a46" strokeWidth="1.3" fill="none" strokeLinecap="round">
          <path d="M60 70 q4 -4 8 0 q4 -4 8 0" />
          <path d="M84 62 q3 -3 6 0 q3 -3 6 0" />
        </g>
      ) : null}
      {/* montagne e colline */}
      <path d="M0 176 L40 140 L70 160 L110 120 L150 156 L190 130 L240 166 L290 128 L340 158 L400 136 V220 H0 Z" fill={p.far} opacity="0.8" />
      <path d="M108 122 L116 132 L102 132 Z M288 130 L297 140 L281 140 Z" fill="#fff" opacity={night ? 0.15 : 0.6} />
      <path d="M0 196 C40 170 80 176 120 186 C170 160 220 168 260 182 C300 164 350 166 400 184 V230 H0 Z" fill={p.near} opacity="0.85" />
      <rect y="150" width="400" height="80" fill={`url(#${id}mist)`} />
      <path d="M0 210 C50 194 110 200 160 208 C220 192 290 196 400 206 V232 H0 Z" fill={p.hill} />
      {Array.from({ length: 18 }, (_, i) => (
        <g key={i} transform={`translate(${i * 24 + (i % 2) * 6} ${207 - (i % 3) * 2})`}>
          <rect x="-1.2" y="0" width="2.4" height="8" fill="#3a2a1e" />
          {i % 3 === 0 ? (
            <path d={`M0 ${-22 - (i % 2) * 4} L${9} 2 L${-9} 2 Z`} fill={p.tree[1]} className="aa-tree" style={{ animationDelay: `${(i % 5) * 0.4}s` }} />
          ) : (
            <ellipse cx="0" cy="-3" rx={7 + (i % 3)} ry={9 + (i % 2) * 2} fill={i % 2 ? p.tree[0] : p.tree[1]} className="aa-tree" style={{ animationDelay: `${(i % 5) * 0.4}s` }} />
          )}
        </g>
      ))}
      <rect y="216" width="400" height="84" fill={p.grass} />
      {[0, 1, 2, 3].map((i) => <rect key={i} y={222 + i * 20} width="400" height="10" fill={p.grass2} opacity="0.55" />)}
      <path d="M0 236 H400" stroke="#fff" strokeOpacity="0.05" strokeWidth="6" />
      <g className="aa-grass" stroke={night ? "#2f5a3e" : "#86ab5e"} strokeWidth="1.4" strokeLinecap="round">
        {Array.from({ length: 50 }, (_, i) => <path key={i} d={`M${i * 8 + 3} 300 l${(i % 3) - 1} -${6 + (i % 4) * 2}`} />)}
      </g>
      {/* fiori */}
      {!night ? (
        <g>
          {Array.from({ length: 14 }, (_, i) => <circle key={i} cx={(i * 53) % 400} cy={262 + ((i * 17) % 34)} r="1.6" fill={["#ffd166", "#f4f1ea", "#c084fc", "#ff8fa3"][i % 4]} />)}
        </g>
      ) : null}
      {grey ? <rect width="400" height="300" fill="#3a4450" opacity={grey * 0.35} /> : null}
      {rain ? (
        <g className="aa-rain" stroke="#dce8f2" strokeOpacity="0.5" strokeWidth="0.8">
          {Array.from({ length: 90 }, (_, i) => {
            const x = (i * 37.7) % 420;
            const y = (i * 23.3) % 300;
            return <path key={i} d={`M${x} ${y} l-3 11`} />;
          })}
        </g>
      ) : null}
    </svg>
  );
}
