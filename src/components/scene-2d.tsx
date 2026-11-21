import type { ReactNode } from "react";
import type { Sky } from "@/lib/arcieri/sky3d";
import { sceneById, type SceneId } from "@/lib/arcieri/scenes";

/**
 * Sfondi illustrati (stile gioco) per la Home, il profilo e le lezioni: cielo dell'ora scelta con sole
 * o luna, raggi, nuvole che scorrono, stelle, pioggia o neve; poi l'ambientazione (campo, foresta,
 * castello, palazzo reale, montagna, lago, deserto, villaggio, bosco innevato, colline, torneo, rovine,
 * spiaggia, bosco d'autunno). Coordinate 400×300, orizzonte intorno a y = 216.
 */
const SKY: Record<Sky["tod"], { top: string; mid: string; low: string; sun: string; shade: string; shadeA: number }> = {
  mattina: { top: "#5b8fd6", mid: "#a9cdea", low: "#ffe2b8", sun: "#fff1c9", shade: "#ffd9a0", shadeA: 0.06 },
  pomeriggio: { top: "#2f6db8", mid: "#7fb2e0", low: "#d8ecf6", sun: "#fffbe8", shade: "#ffffff", shadeA: 0 },
  tramonto: { top: "#2a2e63", mid: "#c9617a", low: "#ffb065", sun: "#ffd27a", shade: "#ff8a4a", shadeA: 0.16 },
  notte: { top: "#050a1a", mid: "#0f1e3d", low: "#22355c", sun: "#e8eeff", shade: "#0a1430", shadeA: 0.5 },
};

const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function SceneBackdrop({ sky, id = "bk", scene = "campo" }: { sky: Sky; id?: string; scene?: string }) {
  const p = SKY[sky.tod];
  const sc = sceneById(scene);
  const rain = sky.weather === "pioggia";
  const cloudy = sky.weather !== "sereno";
  const night = sky.tod === "notte";
  const snow = sc.id === "neve";
  const sunX = sky.tod === "mattina" ? 70 : sky.tod === "tramonto" ? 330 : 300;
  const sunY = sky.tod === "pomeriggio" ? 46 : sky.tod === "tramonto" ? 150 : sky.tod === "mattina" ? 110 : 60;
  const desert = sc.id === "deserto" || sc.id === "spiaggia";
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.top} />
          <stop offset="0.55" stopColor={desert && !night ? (sky.tod === "tramonto" ? "#e08a5a" : "#a8d0ea") : p.mid} />
          <stop offset="0.78" stopColor={desert && !night && sky.tod !== "tramonto" ? "#f6e6c4" : p.low} />
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
        <linearGradient id={`${id}ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sc.ground[0]} />
          <stop offset="1" stopColor={sc.ground[1]} />
        </linearGradient>
        <linearGradient id={`${id}water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? "#1a2a48" : "#6aa8d8"} />
          <stop offset="1" stopColor={night ? "#0e1a30" : "#2f6a9a"} />
        </linearGradient>
        <linearGradient id={`${id}stone`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a8f96" />
          <stop offset="0.6" stopColor="#b2b6bb" />
          <stop offset="1" stopColor="#7a7f86" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}sky)`} />
      {night ? (
        <g fill="#fff">
          {Array.from({ length: 70 }, (_, i) => (
            <circle key={i} cx={(i * 97.3) % 400} cy={(i * 41.7) % 150} r={i % 9 === 0 ? 1.1 : 0.6} opacity={0.4 + ((i * 13) % 7) / 12} className={i % 5 === 0 ? "aa-twinkle" : undefined} style={{ animationDelay: `${(i % 7) * 0.5}s` }} />
          ))}
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
      <g className="aa-clouds" fill={night ? "#2a3550" : rain ? "#7d8792" : sky.tod === "tramonto" ? "#ffc9a8" : "#fff"} opacity={rain ? 0.95 : cloudy ? 0.8 : desert ? 0.3 : 0.55}>
        {(cloudy ? [[20, 40, 1.2], [120, 22, 1], [210, 50, 1.3], [310, 30, 1.1], [420, 44, 1.2], [520, 26, 1], [620, 46, 1.2]] : [[40, 40, 1], [170, 26, 0.8], [290, 54, 1.1], [420, 34, 0.9], [540, 48, 1]]).map(([x, y, k]) => (
          <g key={x} transform={`translate(${x} ${y}) scale(${k})`}>
            <ellipse cx="0" cy="0" rx="36" ry="9" />
            <ellipse cx="13" cy="-7" rx="17" ry="10" />
            <ellipse cx="-12" cy="-4" rx="15" ry="8" />
          </g>
        ))}
      </g>
      {!night && !rain ? (
        <g className="aa-birds" stroke="#2a3a46" strokeWidth="1.3" fill="none" strokeLinecap="round">
          <path d="M60 70 q4 -4 8 0 q4 -4 8 0" />
          <path d="M84 62 q3 -3 6 0 q3 -3 6 0" />
        </g>
      ) : null}
      {LAYERS[sc.id]?.(id, night) ?? LAYERS.campo(id, night)}
      {/* velo dell'ora: la stessa luce su tutto */}
      {p.shadeA ? <rect width="400" height="300" fill={p.shade} opacity={p.shadeA} style={{ mixBlendMode: night ? "multiply" : "soft-light" }} /> : null}
      {rain ? <rect width="400" height="300" fill="#3a4450" opacity={0.2} /> : cloudy ? <rect width="400" height="300" fill="#3a4450" opacity={0.08} /> : null}
      {rain ? (
        <g className="aa-rain" stroke="#dce8f2" strokeOpacity="0.5" strokeWidth="0.8">
          {Array.from({ length: 90 }, (_, i) => <path key={i} d={`M${(i * 37.7) % 420} ${(i * 23.3) % 300} l-3 11`} />)}
        </g>
      ) : null}
      {snow || (sky.weather === "pioggia" && sc.id === "montagna") ? (
        <g className="aa-snow" fill="#fff" opacity="0.85">
          {Array.from({ length: 60 }, (_, i) => <circle key={i} cx={(i * 67.3) % 400} cy={(i * 29.1) % 300} r={0.8 + rnd(i) * 1.4} />)}
        </g>
      ) : null}
    </svg>
  );
}

/* ---------- elementi comuni ---------- */

function Hills({ far, near, night }: { far: string; near: string; night: boolean }) {
  return (
    <g>
      <path d="M0 176 L40 140 L70 160 L110 120 L150 156 L190 130 L240 166 L290 128 L340 158 L400 136 V220 H0 Z" fill={far} opacity="0.8" />
      <path d="M108 122 L116 132 L102 132 Z M288 130 L297 140 L281 140 Z" fill="#fff" opacity={night ? 0.15 : 0.6} />
      <path d="M0 196 C40 170 80 176 120 186 C170 160 220 168 260 182 C300 164 350 166 400 184 V230 H0 Z" fill={near} opacity="0.85" />
    </g>
  );
}

function TreeLine({ y = 207, colors, n = 18, pines = 3 }: { y?: number; colors: [string, string]; n?: number; pines?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${i * (400 / (n - 1)) + (i % 2) * 6} ${y - (i % 3) * 2})`}>
          <rect x="-1.2" y="0" width="2.4" height="8" fill="#3a2a1e" />
          {i % pines === 0 ? (
            <path d={`M0 ${-22 - (i % 2) * 4} L9 2 L-9 2 Z`} fill={colors[1]} className="aa-tree" style={{ animationDelay: `${(i % 5) * 0.4}s` }} />
          ) : (
            <ellipse cx="0" cy="-3" rx={7 + (i % 3)} ry={9 + (i % 2) * 2} fill={i % 2 ? colors[0] : colors[1]} className="aa-tree" style={{ animationDelay: `${(i % 5) * 0.4}s` }} />
          )}
        </g>
      ))}
    </g>
  );
}

function Ground({ id, night, grass = "#86ab5e", flowers = true, y = 216 }: { id: string; night: boolean; grass?: string; flowers?: boolean; y?: number }) {
  return (
    <g>
      <rect y={y} width="400" height={300 - y} fill={`url(#${id}ground)`} />
      {[0, 1, 2, 3].map((i) => <rect key={i} y={y + 6 + i * 20} width="400" height="10" fill="#000" opacity="0.06" />)}
      <g className="aa-grass" stroke={night ? "#2f5a3e" : grass} strokeWidth="1.4" strokeLinecap="round">
        {Array.from({ length: 50 }, (_, i) => <path key={i} d={`M${i * 8 + 3} 300 l${(i % 3) - 1} -${6 + (i % 4) * 2}`} />)}
      </g>
      {flowers && !night ? (
        <g>{Array.from({ length: 14 }, (_, i) => <circle key={i} cx={(i * 53) % 400} cy={262 + ((i * 17) % 34)} r="1.6" fill={["#ffd166", "#f4f1ea", "#c084fc", "#ff8fa3"][i % 4]} />)}</g>
      ) : null}
    </g>
  );
}

function Pine({ x, y, h, c, snow }: { x: number; y: number; h: number; c: string; snow?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="aa-tree">
      <rect x={-h * 0.04} y={-h * 0.12} width={h * 0.08} height={h * 0.14} fill="#3a2a1e" />
      {[0, 1, 2].map((k) => (
        <g key={k}>
          <path d={`M0 ${-h + k * h * 0.26} L${h * (0.2 + k * 0.08)} ${-h * 0.42 + k * h * 0.26} L${-h * (0.2 + k * 0.08)} ${-h * 0.42 + k * h * 0.26} Z`} fill={c} />
          {snow ? <path d={`M0 ${-h + k * h * 0.26} L${h * (0.1 + k * 0.04)} ${-h * 0.72 + k * h * 0.26} L${-h * (0.1 + k * 0.04)} ${-h * 0.72 + k * h * 0.26} Z`} fill="#f4f8fb" /> : null}
        </g>
      ))}
      </g>
    </g>
  );
}

function Banner({ x, y, c, h = 14 }: { x: number; y: number; c: string; h?: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y - h} stroke="#3a2a1e" strokeWidth="0.8" />
      <path d={`M${x} ${y - h} l9 2 l-3 2.5 l3 2.5 l-9 1 Z`} fill={c} className="aa-flag" />
    </g>
  );
}

/* ---------- ambientazioni ---------- */

const LAYERS: Record<SceneId, (id: string, night: boolean) => ReactNode> = {
  campo: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#9db3c6"} near={night ? "#141f33" : "#6e8f86"} night={night} />
      <rect y="150" width="400" height="80" fill={`url(#${id}mist)`} />
      <path d="M0 210 C50 194 110 200 160 208 C220 192 290 196 400 206 V232 H0 Z" fill={night ? "#13202a" : "#58784c"} />
      <TreeLine colors={night ? ["#10201a", "#0c1914"] : ["#3b6a3e", "#2f5a35"]} />
      <Ground id={id} night={night} />
      {/* paglioni lontani e linea di tiro */}
      {[60, 110, 330].map((x) => (
        <g key={x} transform={`translate(${x} 214)`}>
          <path d="M-4 0 L-6 8 M4 0 L6 8" stroke="#5b3d22" strokeWidth="1" />
          <rect x="-6" y="-11" width="12" height="12" rx="1" fill="#c9a46a" />
          <circle cx="0" cy="-5" r="3.6" fill="#e6b325" stroke="#c4473d" strokeWidth="1.2" />
        </g>
      ))}
    </g>
  ),
  foresta: (id, night) => (
    <g>
      <path d="M0 180 C60 160 120 170 200 164 C280 158 340 170 400 160 V230 H0 Z" fill={night ? "#0e1a16" : "#4f6f5a"} opacity="0.8" />
      {Array.from({ length: 16 }, (_, i) => <Pine key={`f${i}`} x={i * 27 + 6} y={214} h={60 + rnd(i) * 30} c={night ? "#0c1914" : i % 2 ? "#2f5a35" : "#3b6a3e"} />)}
      {!night ? <g fill="#fff6c8" opacity="0.18">{[70, 160, 260, 340].map((x) => <path key={x} d={`M${x} 40 L${x + 30} 40 L${x + 70} 300 L${x + 20} 300 Z`} />)}</g> : null}
      <Ground id={id} night={night} grass="#6a9a4a" flowers={false} />
      {/* tronchi grandi in primo piano ai lati */}
      {[[-6, 1.2], [392, 1.1]].map(([x, k]) => (
        <g key={x} transform={`translate(${x} 0) scale(${k} 1)`}>
          <rect x="-10" y="40" width="22" height="260" fill={night ? "#1a120c" : "#4a3322"} />
          <path d="M-10 60 q11 6 22 0 M-10 120 q11 6 22 0 M-10 190 q11 6 22 0" stroke="#2a1d14" strokeWidth="1.4" fill="none" />
        </g>
      ))}
      <g fill={night ? "#10201a" : "#2f5a35"}>
        <ellipse cx="10" cy="40" rx="60" ry="40" />
        <ellipse cx="390" cy="30" rx="60" ry="42" />
      </g>
      {/* felci */}
      {[30, 90, 300, 370].map((x) => (
        <g key={x} transform={`translate(${x} 290)`} stroke={night ? "#1f3a2a" : "#4f8a3a"} strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M0 0 q-12 -14 -22 -12 M0 0 q12 -16 22 -14 M0 0 q-4 -20 -2 -26 M0 0 q6 -18 10 -22" />
        </g>
      ))}
    </g>
  ),
  castello: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#9db3c6"} near={night ? "#141f33" : "#6e8f86"} night={night} />
      {/* castello sulla collina */}
      <path d="M190 200 C220 170 300 166 340 196 Z" fill={night ? "#1a2a22" : "#5f7d52"} />
      <g transform="translate(232 150)">
        <rect x="0" y="10" width="76" height="40" fill={`url(#${id}stone)`} />
        {[0, 8, 16, 24, 32, 40, 48, 56, 64, 72].map((x) => <rect key={x} x={x} y="6" width="5" height="5" fill="#9aa0a6" />)}
        {[[-8, 30], [32, 44], [72, 30]].map(([x, h]) => (
          <g key={x}>
            <rect x={x} y={10 - h} width="14" height={h + 40} fill={`url(#${id}stone)`} />
            <path d={`M${x - 2} ${10 - h} L${x + 7} ${-4 - h} L${x + 16} ${10 - h} Z`} fill="#7a3a3a" />
            <Banner x={x + 7} y={-4 - h} c="#c4473d" h={10} />
            <rect x={x + 5} y={20 - h} width="4" height="7" rx="2" fill={night ? "#ffd27a" : "#2a2f35"} />
          </g>
        ))}
        <path d="M32 50 v-14 a6 6 0 0 1 12 0 v14 Z" fill="#3a2a1e" />
        {[12, 56].map((x) => <rect key={x} x={x} y="22" width="4" height="7" rx="2" fill={night ? "#ffd27a" : "#2a2f35"} />)}
      </g>
      <TreeLine colors={night ? ["#10201a", "#0c1914"] : ["#3b6a3e", "#2f5a35"]} />
      <Ground id={id} night={night} />
      {/* mura in primo piano a destra */}
      <g transform="translate(330 196)">
        <rect x="0" y="0" width="80" height="34" fill={`url(#${id}stone)`} opacity="0.9" />
        {[0, 10, 20, 30, 40, 50, 60, 70].map((x) => <rect key={x} x={x} y="-5" width="6" height="6" fill="#9aa0a6" />)}
        <path d="M0 12 H80 M0 24 H80 M10 0 V12 M30 12 V24 M50 0 V12 M70 12 V24" stroke="#6a6f76" strokeWidth="0.7" />
      </g>
    </g>
  ),
  palazzo: (id, night) => (
    <g>
      <path d="M0 196 C80 186 160 190 400 188 V230 H0 Z" fill={night ? "#141f33" : "#7a9a8a"} opacity="0.8" />
      {/* facciata del palazzo con cupole */}
      <g transform="translate(110 132)">
        <rect x="0" y="20" width="180" height="62" fill={night ? "#5a5248" : "#efe3c8"} stroke="#b9a57a" strokeWidth="0.8" />
        <path d="M-6 20 H186 L180 12 H0 Z" fill={night ? "#4a4238" : "#d9c9a2"} />
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i}>
            <rect x={10 + i * 19} y="30" width="8" height="14" rx="4" fill={night ? "#ffd27a" : "#5a7a9a"} opacity={night ? 0.8 : 1} />
            <rect x={10 + i * 19} y="54" width="8" height="16" rx="4" fill={night ? "#ffd27a" : "#5a7a9a"} opacity={night ? 0.7 : 1} />
          </g>
        ))}
        <path d="M70 20 C70 -6 110 -6 110 20 Z" fill={night ? "#3a5a5a" : "#5aa08a"} />
        <path d="M90 -6 V-16" stroke="#d9b45a" strokeWidth="1.4" />
        <circle cx="90" cy="-17" r="2" fill="#d9b45a" />
        {[0, 180].map((x) => (
          <g key={x}>
            <rect x={x - 12} y="0" width="24" height="82" fill={night ? "#5a5248" : "#e6d6b2"} stroke="#b9a57a" strokeWidth="0.8" />
            <path d={`M${x - 14} 0 C${x - 14} -18 ${x + 14} -18 ${x + 14} 0 Z`} fill={night ? "#3a5a5a" : "#5aa08a"} />
            <Banner x={x} y={-16} c="#2a5d8a" h={10} />
          </g>
        ))}
        <path d="M76 82 v-20 a14 14 0 0 1 28 0 v20 Z" fill="#6a4a2a" />
      </g>
      <Ground id={id} night={night} grass="#9ac46a" />
      {/* siepi, viale e fontana */}
      <path d="M150 216 L250 216 L330 300 L70 300 Z" fill={night ? "#3a3428" : "#e2d2a8"} opacity="0.85" />
      {[[20, 218], [300, 218]].map(([x, y]) => <rect key={x} x={x} y={y} width="80" height="12" rx="6" fill={night ? "#16301e" : "#3f7a3a"} />)}
      {[[40, 240], [290, 240]].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <path d="M0 0 C-6 -10 -2 -26 6 -34 C14 -26 18 -10 12 0 Z" fill={night ? "#16301e" : "#2f6a32"} />
          <rect x="3" y="0" width="6" height="8" fill="#a07a4a" />
        </g>
      ))}
      <g transform="translate(200 246)">
        <ellipse cx="0" cy="6" rx="26" ry="6" fill={night ? "#3a4450" : "#cfc3a6"} />
        <ellipse cx="0" cy="5" rx="22" ry="4" fill={`url(#${id}water)`} />
        <rect x="-3" y="-12" width="6" height="16" fill="#cfc3a6" />
        <path className="aa-fountain" d="M0 -14 q-8 -10 -14 4 M0 -14 q8 -10 14 4" stroke="#bfe3ff" strokeWidth="1.4" fill="none" opacity="0.8" />
      </g>
    </g>
  ),
  montagna: (id, night) => (
    <g>
      <path d="M0 190 L60 90 L100 140 L160 60 L220 150 L270 80 L330 140 L400 70 V230 H0 Z" fill={night ? "#1c2a44" : "#7d93b0"} />
      <path d="M160 60 L176 86 L168 84 L160 92 L152 82 L146 84 Z M270 80 L284 104 L270 98 L258 104 Z M60 90 L72 110 L60 106 L50 112 Z M400 70 L400 100 L388 92 Z" fill="#f4f8fb" opacity={night ? 0.5 : 0.95} />
      <path d="M0 200 L80 150 L140 186 L210 140 L280 184 L340 150 L400 176 V232 H0 Z" fill={night ? "#141f33" : "#5a7488"} opacity="0.9" />
      <rect y="150" width="400" height="80" fill={`url(#${id}mist)`} />
      {Array.from({ length: 14 }, (_, i) => <Pine key={i} x={i * 30 + 4} y={216} h={34 + rnd(i) * 18} c={night ? "#0c1914" : "#2f5038"} />)}
      <Ground id={id} night={night} />
      {[[30, 266, 18], [350, 274, 24], [300, 290, 12]].map(([x, y, r]) => <path key={x} d={`M${x - r} ${y} Q${x - r * 0.6} ${y - r} ${x} ${y - r * 0.9} Q${x + r * 0.8} ${y - r * 0.7} ${x + r} ${y} Z`} fill={night ? "#3a4450" : "#8a8f96"} />)}
    </g>
  ),
  lago: (id, night) => (
    <g>
      <path d="M0 196 L50 140 L90 170 L150 120 L210 176 L260 132 L320 168 L400 130 V206 H0 Z" fill={night ? "#1c2a44" : "#8aa6bd"} />
      <TreeLine y={200} colors={night ? ["#10201a", "#0c1914"] : ["#3b6a3e", "#2f5a35"]} n={22} />
      <rect y="206" width="400" height="34" fill={`url(#${id}water)`} />
      {/* riflessi delle montagne e scintille */}
      <path d="M0 206 L50 236 L90 220 L150 240 L210 214 L260 236 L320 218 L400 238 V206 Z" fill={night ? "#1c2a44" : "#8aa6bd"} opacity="0.25" />
      <g className="aa-shimmer" stroke="#fff" strokeOpacity="0.5" strokeWidth="1">
        {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${(i * 53) % 400} ${210 + (i % 5) * 6} h${6 + (i % 3) * 4}`} />)}
      </g>
      <Ground id={id} night={night} y={238} />
      {/* pontile e canne */}
      <g transform="translate(300 230)">
        <path d="M0 0 L60 0 L60 5 L0 5 Z" fill="#7a5a3a" />
        {[6, 22, 38, 54].map((x) => <rect key={x} x={x} y="5" width="2.6" height="10" fill="#4a3322" />)}
      </g>
      {[20, 34, 48, 220, 236].map((x, i) => <path key={x} d={`M${x} 244 q${i % 2 ? 3 : -3} -18 ${i % 2 ? 1 : -2} -30`} stroke={night ? "#2f4a3a" : "#6a8a3a"} strokeWidth="1.6" fill="none" className="aa-tree" />)}
    </g>
  ),
  deserto: (id, night) => (
    <g>
      <path d="M220 200 L240 150 L300 150 L318 200 Z M40 200 L52 166 L92 166 L100 200 Z" fill={night ? "#3a2a2a" : "#c27a4a"} />
      <path d="M240 150 L300 150 L298 158 L242 158 Z" fill={night ? "#4a3434" : "#d99060"} />
      <path d="M0 210 C60 186 120 196 180 206 C240 188 320 186 400 204 V232 H0 Z" fill={night ? "#4a3c2a" : "#e8c48a"} />
      <path d="M0 222 C80 204 160 214 220 220 C290 206 350 210 400 218 V240 H0 Z" fill={night ? "#3e3222" : "#dcb27a"} />
      <Ground id={id} night={night} grass="#c9a066" flowers={false} />
      {[[70, 230, 1], [350, 224, 0.8]].map(([x, y, k]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${k})`}>
          <g className="aa-tree">
          <path d="M0 0 C2 -20 -2 -40 2 -60" stroke="#6a4a2a" strokeWidth="4" fill="none" />
          {[-60, -30, 0, 30, 60, 90].map((a) => <path key={a} d={`M2 -60 q${Math.cos((a * Math.PI) / 180) * 14} ${-8 + Math.sin((a * Math.PI) / 180) * 6} ${Math.cos((a * Math.PI) / 180) * 26} ${8 + Math.abs(Math.sin((a * Math.PI) / 180)) * 6}`} stroke={night ? "#1f3a2a" : "#3f7a3a"} strokeWidth="4" fill="none" strokeLinecap="round" />)}
          </g>
        </g>
      ))}
      <path d="M0 270 q60 -8 120 0 t120 0 t160 0" stroke="#fff" strokeOpacity="0.15" strokeWidth="2" fill="none" />
    </g>
  ),
  villaggio: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#9db3c6"} near={night ? "#141f33" : "#6e8f86"} night={night} />
      <TreeLine y={204} colors={night ? ["#10201a", "#0c1914"] : ["#3b6a3e", "#2f5a35"]} />
      {/* case e campanile */}
      {[[30, 184, 34, "#e9dcc0", "#8a3a2a"], [80, 190, 28, "#d9c9a8", "#6a4a2a"], [250, 186, 32, "#efe3c8", "#9a4a32"], [300, 182, 40, "#e2d2b0", "#7a3a2a"], [352, 190, 26, "#d9c9a8", "#8a3a2a"]].map(([x, y, w, wall, roof]) => (
        <g key={x as number}>
          <rect x={x as number} y={y as number} width={w as number} height={34} fill={night ? "#4a4238" : (wall as string)} stroke="#6a5a42" strokeWidth="0.6" />
          <path d={`M${(x as number) - 4} ${y} L${(x as number) + (w as number) / 2} ${(y as number) - 16} L${(x as number) + (w as number) + 4} ${y} Z`} fill={roof as string} />
          <path d={`M${(x as number) + 4} ${(y as number) + 4} V${(y as number) + 30} M${(x as number) + (w as number) - 4} ${(y as number) + 4} V${(y as number) + 30} M${x} ${(y as number) + 14} H${(x as number) + (w as number)}`} stroke="#5a3a22" strokeWidth="1" opacity="0.6" />
          <rect x={(x as number) + (w as number) / 2 - 3} y={(y as number) + 18} width="6" height="9" fill={night ? "#ffd27a" : "#3a2a1e"} />
        </g>
      ))}
      <g transform="translate(150 150)">
        <rect x="0" y="0" width="22" height="70" fill={night ? "#4a4238" : "#d9c9a8"} stroke="#8a7a5a" strokeWidth="0.6" />
        <path d="M-3 0 L11 -24 L25 0 Z" fill="#7a3a2a" />
        <rect x="7" y="10" width="8" height="12" rx="4" fill="#3a2a1e" />
        <circle cx="11" cy="34" r="5" fill="#f4f1ea" stroke="#3a2a1e" strokeWidth="0.8" />
      </g>
      {!night ? <path className="aa-smoke" d="M320 162 q-6 -10 2 -20 q8 -10 0 -22" stroke="#e8e8e8" strokeOpacity="0.5" strokeWidth="4" fill="none" strokeLinecap="round" /> : null}
      <Ground id={id} night={night} />
      <g stroke="#7a5a3a" strokeWidth="2">
        <path d="M0 240 H150 M0 252 H150" />
        {[10, 40, 70, 100, 130].map((x) => <path key={x} d={`M${x} 232 V258`} />)}
      </g>
    </g>
  ),
  neve: (id, night) => (
    <g>
      <path d="M0 176 L40 140 L70 160 L110 120 L150 156 L190 130 L240 166 L290 128 L340 158 L400 136 V220 H0 Z" fill={night ? "#2a3a54" : "#c9d6e2"} />
      <path d="M0 196 C40 176 80 180 120 188 C170 168 220 174 260 186 C300 170 350 172 400 188 V230 H0 Z" fill={night ? "#3a4a64" : "#e2eaf1"} />
      {Array.from({ length: 16 }, (_, i) => <Pine key={i} x={i * 27 + 4} y={214} h={40 + rnd(i + 3) * 26} c={night ? "#16302a" : "#2f5038"} snow />)}
      <Ground id={id} night={night} grass="#c9d6e2" flowers={false} />
      <path d="M0 250 q80 -10 160 0 t240 0" stroke="#fff" strokeOpacity="0.6" strokeWidth="3" fill="none" />
    </g>
  ),
  campagna: (id, night) => (
    <g>
      <path d="M0 190 C70 150 140 160 200 176 C260 150 330 150 400 172 V230 H0 Z" fill={night ? "#1a2a22" : "#8aaa5a"} />
      <path d="M0 206 C80 180 170 186 240 198 C300 186 360 186 400 196 V232 H0 Z" fill={night ? "#16241c" : "#a8b85a"} />
      {/* filari di vite sulla collina */}
      <g stroke={night ? "#1f3a2a" : "#4f7a2a"} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="3 3">
        {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${20 + i * 8} ${196 - i * 6} Q120 ${170 - i * 6} 190 ${188 - i * 4}`} fill="none" />)}
      </g>
      {/* casale e cipressi */}
      <g transform="translate(270 160)">
        <rect x="0" y="0" width="44" height="24" fill={night ? "#4a4238" : "#e8c89a"} />
        <path d="M-3 0 L22 -10 L47 0 Z" fill="#a0503a" />
        <rect x="30" y="-14" width="10" height="18" fill={night ? "#4a4238" : "#e0bc8a"} />
        <rect x="8" y="8" width="6" height="8" fill={night ? "#ffd27a" : "#5a3a22"} />
      </g>
      {[240, 252, 330, 342, 356].map((x, i) => <path key={x} d={`M${x} 186 C${x - 5} 170 ${x - 3} 150 ${x} ${136 + (i % 2) * 8} C${x + 3} 150 ${x + 5} 170 ${x} 186 Z`} fill={night ? "#10201a" : "#2f4a2a"} className="aa-tree" />)}
      <Ground id={id} night={night} />
    </g>
  ),
  torneo: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#9db3c6"} near={night ? "#141f33" : "#6e8f86"} night={night} />
      <TreeLine y={202} colors={night ? ["#10201a", "#0c1914"] : ["#3b6a3e", "#2f5a35"]} />
      {/* tribune e tende a righe */}
      <g transform="translate(20 180)">
        <path d="M0 30 L110 30 L104 0 L6 0 Z" fill={night ? "#3a2a1e" : "#8a6a42"} />
        {[6, 14, 22].map((y) => <path key={y} d={`M${4 + y * 0.2} ${y} H${106 - y * 0.2}`} stroke="#5a3a22" strokeWidth="1" />)}
        {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={10 + i * 8} cy={4 + (i % 3) * 8} r="2.4" fill={["#c4473d", "#2a5d8a", "#e6b325", "#f4f1ea"][i % 4]} />)}
        <path d="M-2 0 L112 0 L106 -8 L4 -8 Z" fill="#c4473d" />
        {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${4 + i * 13} 0 l6.5 6 l6.5 -6`} fill={i % 2 ? "#f4f1ea" : "#c4473d"} />)}
      </g>
      {[[260, "#2a5d8a"], [320, "#c4473d"], [372, "#e6b325"]].map(([x, c]) => (
        <g key={x as number} transform={`translate(${x} 204)`}>
          <path d="M-18 14 L0 -18 L18 14 Z" fill={c as string} />
          <path d="M-9 14 L0 -18 L9 14 Z" fill="#f4f1ea" opacity="0.85" />
          <path d="M-4 14 L0 2 L4 14 Z" fill="#3a2a1e" />
          <Banner x={0} y={-18} c={c as string} h={10} />
        </g>
      ))}
      <Ground id={id} night={night} />
      {/* staccionata della lizza */}
      <g stroke="#e9dcc0" strokeWidth="2">
        <path d="M0 236 H400" />
        {Array.from({ length: 11 }, (_, i) => <path key={i} d={`M${i * 40} 228 V244`} />)}
      </g>
    </g>
  ),
  rovine: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#b3bfc6"} near={night ? "#141f33" : "#8a9a86"} night={night} />
      {/* colonnato e arco */}
      <g transform="translate(160 140)" fill={night ? "#5a5650" : "#d8cfbd"} stroke={night ? "#3a3632" : "#a89a7a"} strokeWidth="0.8">
        <rect x="0" y="0" width="140" height="8" />
        {[6, 36, 66, 96, 126].map((x, i) => <rect key={x} x={x} y="8" width="10" height={i === 3 ? 40 : 72} />)}
        <path d="M100 48 L106 40 L112 46 Z" />
      </g>
      <g transform="translate(40 150)" fill={night ? "#5a5650" : "#cfc5b0"} stroke={night ? "#3a3632" : "#a89a7a"} strokeWidth="0.8">
        <path d="M0 64 V10 H14 V64 Z M46 64 V10 H60 V64 Z" />
        <path d="M0 10 C0 -14 60 -14 60 10 L46 10 C46 -2 14 -2 14 10 Z" />
      </g>
      <TreeLine y={210} colors={night ? ["#10201a", "#0c1914"] : ["#5a7a4a", "#4a6a3a"]} n={10} pines={2} />
      <Ground id={id} night={night} />
      {[[120, 252, 10], [330, 262, 14], [250, 244, 8]].map(([x, y, s]) => <rect key={x} x={x} y={y} width={s * 2} height={s} rx="1" fill={night ? "#5a5650" : "#cfc5b0"} transform={`rotate(${(x % 7) - 3} ${x} ${y})`} />)}
      {[[150, 224], [320, 230]].map(([x, y]) => <path key={x} d={`M${x} ${y} q4 -10 10 -12 q-2 8 4 12`} stroke={night ? "#1f3a2a" : "#5a8a3a"} strokeWidth="1.6" fill="none" />)}
    </g>
  ),
  spiaggia: (id, night) => (
    <g>
      <rect y="180" width="400" height="40" fill={`url(#${id}water)`} />
      <path d="M300 180 L330 168 L370 172 L400 160 V180 Z" fill={night ? "#1c2a44" : "#7a9a8a"} />
      <g className="aa-shimmer" stroke="#fff" strokeOpacity="0.55" strokeWidth="1">
        {Array.from({ length: 18 }, (_, i) => <path key={i} d={`M${(i * 47) % 400} ${186 + (i % 5) * 6} h${8 + (i % 3) * 4}`} />)}
      </g>
      <path className="aa-wave" d="M0 218 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V224 H0 Z" fill="#fff" opacity="0.6" />
      <Ground id={id} night={night} y={220} grass="#d9bf86" flowers={false} />
      {[[60, 236, 1], [96, 248, 0.8]].map(([x, y, k]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${k})`}>
          <g className="aa-tree">
          <path d="M0 0 C4 -20 0 -40 8 -64" stroke="#7a5a3a" strokeWidth="4" fill="none" />
          {[-50, -20, 10, 40, 70, 100].map((a) => <path key={a} d={`M8 -64 q${Math.cos((a * Math.PI) / 180) * 14} -8 ${Math.cos((a * Math.PI) / 180) * 28} 10`} stroke={night ? "#1f3a2a" : "#3f8a3a"} strokeWidth="4" fill="none" strokeLinecap="round" />)}
          </g>
        </g>
      ))}
      {[[300, 270], [330, 282]].map(([x, y]) => <path key={x} d={`M${x} ${y} q4 -6 8 0 q-4 3 -8 0`} fill="#f4c6a8" />)}
    </g>
  ),
  autunno: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#b3a48a"} near={night ? "#141f33" : "#9a7a5a"} night={night} />
      {Array.from({ length: 18 }, (_, i) => (
        <g key={i} transform={`translate(${i * 23 + (i % 2) * 6} ${210 - (i % 3) * 3})`}>
          <rect x="-1.5" y="-2" width="3" height="10" fill="#4a3322" />
          <ellipse cx="0" cy="-8" rx={9 + (i % 3)} ry={11 + (i % 2) * 2} fill={night ? "#2a1a10" : ["#d9822a", "#c4473d", "#e6b325", "#b0602a"][i % 4]} className="aa-tree" style={{ animationDelay: `${(i % 5) * 0.4}s` }} />
        </g>
      ))}
      <Ground id={id} night={night} grass="#c9a04a" flowers={false} />
      <g className="aa-leaves">
        {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${(i * 61) % 400} ${(i * 37) % 260} q3 -3 6 0 q-3 3 -6 0`} fill={["#d9822a", "#c4473d", "#e6b325"][i % 3]} style={{ animationDelay: `${(i % 8) * 0.6}s` }} />)}
      </g>
      {Array.from({ length: 20 }, (_, i) => <circle key={i} cx={(i * 43) % 400} cy={250 + (i * 13) % 46} r="2" fill={["#d9822a", "#c4473d", "#e6b325"][i % 3]} opacity="0.8" />)}
    </g>
  ),
};

/** Miniatura di un'ambientazione per la scelta nelle impostazioni. */
export function SceneThumb({ scene, sky, className = "h-16 w-24" }: { scene: string; sky: Sky; className?: string }) {
  return (
    <span className={`relative block overflow-hidden rounded-xl ${className}`}>
      <SceneBackdrop sky={sky} scene={scene} id={`th${scene}`} />
    </span>
  );
}
