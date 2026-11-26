import type React from "react";

/**
 * L'Arpa di Montelago, di notte: la grande scultura di legno del Montelago Celtic Festival illuminata da sotto,
 * le funi tese come corde, le tende bianche accese, i fili di lampadine, la folla e i giocolieri di fuoco
 * con le poi che girano dentro il cerchio di fiamme. Animata con poco (fiamme, scintille, poi, lampadine).
 * Coordinate della scena: 400 × 300, prato da 216 in giù.
 */
const f = (n: number) => n.toFixed(1);
const r = (i: number) => {
  const x = Math.sin(i * 91.7 + 13.1) * 43758.5453;
  return x - Math.floor(x);
};

/** la scultura: alta, appoggiata a sinistra, il dorso che scende in diagonale fino a terra */
const ARPA = "M40 226 C37 170 33 100 30 38 C30 33 33 29 38 28 L48 26 C51 26 53 28 54 31 C68 84 98 150 140 226 Z";

function Flame({ x, y, s, i }: { x: number; y: number; s: number; i: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <path className="aa-flame" style={{ animationDelay: `${-r(i) * 0.9}s`, animationDuration: `${0.6 + r(i + 3) * 0.5}s` }} d="M0 -14 C4 -9 5 -4 3 0 H-3 C-5 -4 -4 -9 0 -14 Z" fill="#ff7a1a" />
      <path className="aa-flame" style={{ animationDelay: `${-r(i + 7) * 0.9}s` }} d="M0 -9 C2.4 -6 3 -2.6 1.6 0 H-1.6 C-3 -2.6 -2.4 -6 0 -9 Z" fill="#ffd56a" />
    </g>
  );
}

/** un giocoliere: sagoma scura controluce, braccia aperte, due poi accese che girano */
function Dancer({ x, y, s, dress, i }: { x: number; y: number; s: number; dress: string; i: number }) {
  const arms = [
    { hx: -10, hy: -30 },
    { hx: 10, hy: -34 },
  ];
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <path d="M-3 -40 C-3 -46 3 -46 3 -40 C3 -36 -3 -36 -3 -40 Z" fill="#1a0c08" />
      <path d="M-2.6 -36 L2.6 -36 L4 -24 C8 -14 9 -6 8 0 L-8 0 C-9 -6 -8 -14 -4 -24 Z" fill={dress} />
      <path d="M-2.6 -36 L2.6 -36 L4 -24 C8 -14 9 -6 8 0 L-8 0" fill="none" stroke="#ff9a4a" strokeOpacity="0.5" strokeWidth="0.6" />
      {arms.map((a, k) => (
        <g key={k}>
          <path d={`M${k ? 2.4 : -2.4} -33 L${a.hx} ${a.hy}`} stroke="#1a0c08" strokeWidth="1.6" strokeLinecap="round" />
          {/* la poi: la catenella e la palla di fuoco con la sua scia, che girano attorno alla mano */}
          <g className="aa-poi" style={{ transformOrigin: `${a.hx}px ${a.hy}px`, animationDuration: `${0.9 + k * 0.25}s`, animationDirection: k ? "reverse" : "normal", animationDelay: `${-r(i + k) * 1.2}s` }}>
            <path d={`M${a.hx} ${a.hy} L${a.hx} ${a.hy - 11}`} stroke="#c9c2b8" strokeWidth="0.4" />
            <path d={`M${a.hx} ${a.hy - 11} A11 11 0 0 1 ${f(a.hx + 9.5)} ${f(a.hy - 5.5)}`} stroke="#ffb040" strokeOpacity="0.55" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <circle cx={a.hx} cy={a.hy - 11} r="2.4" fill="#ffd56a" />
            <circle cx={a.hx} cy={a.hy - 11} r="4.4" fill="#ff7a1a" opacity="0.35" />
          </g>
        </g>
      ))}
    </g>
  );
}

function MontelagoNight({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}msky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#060818" />
          <stop offset="0.45" stopColor="#12183a" />
          <stop offset="0.66" stopColor="#2e2442" />
          <stop offset="0.74" stopColor="#6a3030" />
        </linearGradient>
        <linearGradient id={`${id}marpa`} x1="0" y1="1" x2="0.2" y2="0">
          <stop offset="0" stopColor="#ffe2a8" />
          <stop offset="0.25" stopColor="#d89a5a" />
          <stop offset="0.6" stopColor="#7a5236" />
          <stop offset="1" stopColor="#2a1c14" />
        </linearGradient>
        <radialGradient id={`${id}mspot`} cx="0.5" cy="1" r="0.9">
          <stop offset="0" stopColor="#fff4d8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff4d8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}mfire`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb040" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#ff6a1a" stopOpacity="0.2" />
          <stop offset="1" stopColor="#ff6a1a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}mground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2e2618" />
          <stop offset="1" stopColor="#0c0a06" />
        </linearGradient>
        <radialGradient id={`${id}mtent`} cx="0.5" cy="0.8" r="0.7">
          <stop offset="0" stopColor="#ffe6b0" />
          <stop offset="1" stopColor="#c9a87a" />
        </radialGradient>
        <clipPath id={`${id}marpac`}><path d={ARPA} /></clipPath>
        <filter id={`${id}mblur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}msky)`} />
      {/* stelle e luna */}
      <g fill="#fff">
        {Array.from({ length: 60 }, (_, i) => (
          <circle key={i} cx={f(r(i) * 400)} cy={f(r(i + 50) * 140)} r={r(i + 9) > 0.88 ? 1 : 0.55} opacity={0.35 + r(i + 3) * 0.5} className={i % 4 === 0 ? "aa-twinkle" : undefined} style={i % 4 === 0 ? { animationDelay: `${-r(i) * 4}s` } : undefined} />
        ))}
      </g>
      <circle cx="334" cy="44" r="20" fill="#dfe6ff" opacity="0.08" />
      <path d="M334 32 A12 12 0 1 0 344 52 A10 10 0 1 1 334 32 Z" fill="#eef1ff" />
      {/* colline dell'altopiano */}
      <path d="M0 200 C40 176 80 170 120 178 C170 188 200 168 250 166 C300 164 340 180 400 172 L400 224 L0 224 Z" fill="#0e1426" />
      <path d="M0 212 C60 196 120 202 180 196 C240 190 300 200 400 192 L400 226 L0 226 Z" fill="#0a0e1a" />
      {/* torre delle luci del palco, lontana */}
      <g transform="translate(370 140)">
        <path d="M0 0 L8 0 L8 84 L0 84 Z" fill="none" stroke="#5a6070" strokeWidth="0.8" />
        {[0, 12, 24, 36, 48, 60, 72].map((y) => <path key={y} d={`M0 ${y} L8 ${y + 12} M8 ${y} L0 ${y + 12}`} stroke="#4a5060" strokeWidth="0.5" />)}
        {[6, 30, 54].map((y, k) => <circle key={y} cx="4" cy={y} r="2" fill={k === 1 ? "#5aff9a" : "#8ad0ff"} className="aa-twinkle" style={{ animationDelay: `${-k * 0.7}s` }} />)}
      </g>
      {/* fumo e bagliore del fuoco sul cielo basso */}
      <ellipse cx="290" cy="220" rx="140" ry="44" fill={`url(#${id}mfire)`} />
      <ellipse className="aa-smoke" cx="250" cy="176" rx="90" ry="18" fill="#c8b8c8" opacity="0.12" filter={`url(#${id}mblur)`} />
      {/* l'Arpa: luce dei fari da sotto, le celle intagliate, le funi */}
      <ellipse cx="80" cy="150" rx="70" ry="110" fill={`url(#${id}mspot)`} />
      {[0, 1, 2, 3].map((k) => <path key={k} d={`M${36 + k * 2} ${44 + k * 12} L${f(-30 - k * 18)} ${226}`} stroke="#d8c8a8" strokeOpacity="0.45" strokeWidth="0.5" />)}
      <path d={ARPA} fill={`url(#${id}marpa)`} stroke="#1a120c" strokeWidth="0.8" />
      <g clipPath={`url(#${id}marpac)`}>
        {/* il legno intagliato a celle, come un mosaico: righe di tasselli irregolari separati da solchi scuri */}
        {(() => {
          const cols = 14;
          const rows = 28;
          const vx = (c: number, rr: number) => 26 + c * 8.4 + (c > 0 && c < cols ? (r(c * 31 + rr * 7) - 0.5) * 4.2 : 0) + (rr % 2) * 2;
          const vy = (c: number, rr: number) => 24 + rr * 7.4 + (rr > 0 && rr < rows ? (r(c * 13 + rr * 17) - 0.5) * 3.6 : 0);
          const cells: React.ReactNode[] = [];
          for (let rr = 0; rr < rows; rr++) {
            for (let c = 0; c < cols; c++) {
              const d = `M${f(vx(c, rr))} ${f(vy(c, rr))} L${f(vx(c + 1, rr))} ${f(vy(c + 1, rr))} L${f(vx(c + 1, rr + 1))} ${f(vy(c + 1, rr + 1))} L${f(vx(c, rr + 1))} ${f(vy(c, rr + 1))} Z`;
              const t = r(c * 7 + rr * 29);
              cells.push(<path key={`${rr}-${c}`} d={d} fill={t > 0.66 ? "#f0c88a" : t > 0.33 ? "#c89058" : "#a06a3a"} fillOpacity="0.35" stroke="#1a100a" strokeWidth="1.2" strokeLinejoin="round" />);
            }
          }
          return <g>{cells}</g>;
        })()}
        {/* luce che sale e ombra sul dorso */}
        <rect x="20" y="150" width="140" height="80" fill="#ffd08a" opacity="0.18" />
        <path d="M54 31 C68 84 98 150 140 226 L120 226 C90 160 62 90 50 32 Z" fill="#000" opacity="0.25" />
      </g>
      {/* fari a terra puntati sull'Arpa */}
      {[46, 92].map((x) => <path key={x} d={`M${x} 226 L${x - 14} 60 L${x + 6} 60 Z`} fill="#fff4d8" opacity="0.07" />)}
      {/* tende bianche accese */}
      {[[214, 214, 1], [250, 210, 1.2], [298, 212, 0.9], [340, 208, 1.3], [384, 212, 1]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M-16 8 L0 -18 L16 8 Z" fill={`url(#${id}mtent)`} stroke="#5a4a3a" strokeWidth="0.5" />
          <path d="M0 -18 L0 -22" stroke="#5a4a3a" strokeWidth="0.8" />
          <path d="M-3 8 L0 -2 L3 8 Z" fill="#ff9a3a" opacity="0.8" />
        </g>
      ))}
      {/* fili di lampadine tra i pali */}
      {[[150, 120, 260, 104], [260, 104, 400, 118]].map(([x1, y1, x2, y2], k) => (
        <g key={k}>
          <path d={`M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.max(y1, y2) + 18} ${x2} ${y2}`} stroke="#3a3430" strokeWidth="0.5" fill="none" />
          {Array.from({ length: 9 }, (_, i) => {
            const t = (i + 1) / 10;
            const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * ((x1 + x2) / 2) + t * t * x2;
            const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * (Math.max(y1, y2) + 18) + t * t * y2;
            return (
              <g key={i}>
                <circle cx={f(x)} cy={f(y + 1.4)} r="2.6" fill="#ffd27a" opacity="0.25" />
                <circle cx={f(x)} cy={f(y + 1.4)} r="1.1" fill="#fff0b8" className={i % 3 === 0 ? "aa-twinkle" : undefined} style={i % 3 === 0 ? { animationDelay: `${-r(i + k) * 3}s` } : undefined} />
              </g>
            );
          })}
        </g>
      ))}
      {[150, 260].map((x) => <path key={x} d={`M${x} ${x === 150 ? 120 : 104} L${x} 222`} stroke="#3a2a1e" strokeWidth="1.4" />)}
      {/* prato e la folla in cerchio, controluce */}
      <rect y="218" width="400" height="82" fill={`url(#${id}mground)`} />
      <ellipse cx="300" cy="256" rx="96" ry="22" fill="#ff8a2a" opacity="0.08" />
      <g fill="#0c0806">
        {Array.from({ length: 26 }, (_, i) => {
          const x = 190 + i * 8.2 + r(i) * 4;
          const y = 228 + (r(i + 30) - 0.5) * 3;
          const h = 14 + r(i + 60) * 6;
          return <path key={i} d={`M${f(x - 3)} ${f(y)} C${f(x - 3.4)} ${f(y - h * 0.6)} ${f(x - 2)} ${f(y - h * 0.8)} ${f(x)} ${f(y - h * 0.8)} C${f(x + 2)} ${f(y - h * 0.8)} ${f(x + 3.4)} ${f(y - h * 0.6)} ${f(x + 3)} ${f(y)} Z M${f(x)} ${f(y - h)} m-2.2 0 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0`} />;
        })}
      </g>
      {/* cerchio di fuoco e i giocolieri */}
      <ellipse cx="300" cy="258" rx="46" ry="9" fill="none" stroke="#ff6a1a" strokeOpacity="0.35" strokeWidth="3" />
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        const x = 300 + Math.cos(a) * 46;
        const y = 258 + Math.sin(a) * 9;
        return <Flame key={i} x={x} y={y} s={0.7 + r(i) * 0.5 + (Math.sin(a) > 0 ? 0.2 : 0)} i={i} />;
      })}
      <Dancer x={290} y={258} s={1.15} dress="#3a4a2a" i={1} />
      <Dancer x={236} y={248} s={0.9} dress="#2a1a14" i={5} />
      {/* bracieri a sinistra */}
      {[[170, 236], [24, 244]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y - 8} r="16" fill={`url(#${id}mfire)`} />
          <path d={`M${x - 6} ${y} L${x + 6} ${y} L${x + 4} ${y - 4} L${x - 4} ${y - 4} Z M${x} ${y} L${x} ${y + 12}`} stroke="#2a1a10" strokeWidth="1.4" fill="#2a1a10" />
          <Flame x={x} y={y - 4} s={1.2} i={40 + i} />
        </g>
      ))}
      {/* scintille che salgono */}
      {Array.from({ length: 18 }, (_, i) => (
        <circle key={i} className="aa-ember" style={{ animationDelay: `${-r(i * 5) * 6}s`, animationDuration: `${3 + r(i * 2) * 3}s` }} cx={f(250 + r(i) * 110)} cy={f(250 + r(i * 3) * 10)} r={r(i * 7) > 0.7 ? 1.1 : 0.7} fill={r(i * 11) > 0.5 ? "#ffc06a" : "#ff6a1a"} />
      ))}
    </g>
  );
}

export const MONTELAGO_LAYER = (id: string) => <MontelagoNight id={id} />;
