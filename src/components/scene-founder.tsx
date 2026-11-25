/**
 * Le tre ambientazioni del Fondatore: Sala del Trono, Picco del Drago e Cittadella Celeste.
 * Stessa tela delle altre scene (400×300, il terreno da y 214; sul profilo si vede la fascia 100–300):
 * gli elementi forti stanno ai lati e dietro la testa dell'arciere (vetrata, cratere, sole come aureola).
 * Hanno un cielo e una luce loro, uguali a ogni ora: sono scene da cerimonia.
 */
import type { ReactNode } from "react";

const r = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const f = (n: number) => n.toFixed(1);

/* ------------------------------------------------------------------ Sala del Trono */

function RoseWindow({ id, cx, cy, R }: { id: string; cx: number; cy: number; R: number }) {
  const glass = ["#c41d3a", "#2063c8", "#e8b93e", "#14905c", "#7d48d8", "#2063c8"];
  const petals = 12;
  return (
    <g>
      <circle cx={cx} cy={cy} r={R * 2.1} fill={`url(#${id}rg)`} className="aa-rose-glow" />
      <circle cx={cx} cy={cy} r={R + 7} fill="#2a2030" stroke="#8a6a2a" strokeWidth="1.6" />
      <circle cx={cx} cy={cy} r={R + 3} fill="#120c14" />
      {Array.from({ length: petals }, (_, i) => {
        const a0 = (i / petals) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1) / petals) * Math.PI * 2 - Math.PI / 2;
        const p = (a: number, rr: number) => `${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`;
        const outer = `M${p(a0, R * 0.42)} L${p(a0, R)} A${R} ${R} 0 0 1 ${p(a1, R)} L${p(a1, R * 0.42)} A${R * 0.42} ${R * 0.42} 0 0 0 ${p(a0, R * 0.42)} Z`;
        const am = (a0 + a1) / 2;
        return (
          <g key={i}>
            <path d={outer} fill={glass[i % glass.length]} opacity="0.92" />
            <path d={outer} fill={`url(#${id}gl)`} opacity="0.55" />
            <circle cx={cx + Math.cos(am) * R * 0.72} cy={cy + Math.sin(am) * R * 0.72} r={R * 0.12} fill={glass[(i + 2) % glass.length]} stroke="#1a1218" strokeWidth="0.9" />
            <path d={`M${p(a0, R * 0.42)} L${p(a0, R)}`} stroke="#1a1218" strokeWidth="1.3" />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={R * 0.42} fill="none" stroke="#1a1218" strokeWidth="1.4" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1a1218" strokeWidth="1.6" />
      <circle cx={cx} cy={cy} r={R * 0.4} fill="#e8b93e" />
      <circle cx={cx} cy={cy} r={R * 0.4} fill={`url(#${id}gl)`} opacity="0.6" />
      <path d={`M${cx} ${cy - R * 0.3} L${cx + R * 0.09} ${cy - R * 0.09} L${cx + R * 0.3} ${cy - R * 0.08} L${cx + R * 0.13} ${cy + R * 0.06} L${cx + R * 0.19} ${cy + R * 0.28} L${cx} ${cy + R * 0.15} L${cx - R * 0.19} ${cy + R * 0.28} L${cx - R * 0.13} ${cy + R * 0.06} L${cx - R * 0.3} ${cy - R * 0.08} L${cx - R * 0.09} ${cy - R * 0.09} Z`} fill="#fff4c2" />
    </g>
  );
}

function Column({ x, w = 22, id }: { x: number; w?: number; id: string }) {
  return (
    <g>
      <rect x={x - w / 2} y="0" width={w} height="214" fill={`url(#${id}col)`} />
      {[0.25, 0.5, 0.75].map((k) => <path key={k} d={`M${f(x - w / 2 + w * k)} 26 V196`} stroke="#000" strokeOpacity="0.18" strokeWidth="1.2" />)}
      <rect x={x - w / 2 - 5} y="14" width={w + 10} height="12" rx="2" fill="#d9a62e" />
      <rect x={x - w / 2 - 5} y="14" width={w + 10} height="4" rx="2" fill="#fff0b0" opacity="0.6" />
      <path d={`M${x - w / 2 - 5} 26 Q${x} 34 ${x + w / 2 + 5} 26`} fill="#a8771a" />
      <rect x={x - w / 2 - 6} y="196" width={w + 12} height="18" rx="2" fill="#2a2228" />
      <rect x={x - w / 2 - 6} y="196" width={w + 12} height="3" fill="#d9a62e" />
    </g>
  );
}

function RoyalBanner({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g>
      <path d={`M${x - 16} ${y} H${x + 16}`} stroke="#d9a62e" strokeWidth="2.6" strokeLinecap="round" />
      <path d={`M${x - 14} ${y} H${x + 14} V${y + h} L${x} ${y + h - 12} L${x - 14} ${y + h} Z`} fill="#8a1424" />
      <path d={`M${x - 14} ${y} H${x + 14} V${y + h} L${x} ${y + h - 12} L${x - 14} ${y + h} Z`} fill="none" stroke="#e8b93e" strokeWidth="1.3" />
      <path d={`M${x - 10} ${y + 3} V${y + h - 6} M${x + 10} ${y + 3} V${y + h - 6}`} stroke="#e8b93e" strokeOpacity="0.5" strokeWidth="0.7" strokeDasharray="1 2" />
      {/* corona ricamata */}
      <g transform={`translate(${x} ${y + h * 0.38})`}>
        <path d="M-8 4 L-9 -5 L-4 -1 L0 -8 L4 -1 L9 -5 L8 4 Z" fill="#e8b93e" />
        <rect x="-8" y="4" width="16" height="3" fill="#c48f22" />
        <circle cx="0" cy="-8.5" r="1.4" fill="#fff4c2" />
      </g>
      <path d={`M${x - 10} ${y + h * 0.62} H${x + 10}`} stroke="#e8b93e" strokeWidth="0.8" />
    </g>
  );
}

function Brazier({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="-16" r="30" fill="#ffb04a" opacity="0.16" />
      <path d="M-8 0 L-12 22 M8 0 L12 22 M0 2 V22" stroke="#7a5a1a" strokeWidth="2.2" />
      <path d="M-15 -6 H15 L10 4 H-10 Z" fill="#d9a62e" />
      <path d="M-15 -6 H15" stroke="#fff0b0" strokeWidth="1" />
      <path className="aa-flame" d="M0 -34 C9 -22 10 -12 4 -6 H-4 C-10 -12 -9 -22 0 -34 Z" fill="#ff8a2a" />
      <path className="aa-flame" style={{ animationDelay: "-0.3s" }} d="M0 -26 C5 -18 6 -11 2 -6 H-2 C-6 -11 -5 -18 0 -26 Z" fill="#ffe08a" />
    </g>
  );
}

function ThroneHall({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1220" />
          <stop offset="1" stopColor="#2e2230" />
        </linearGradient>
        <radialGradient id={`${id}rg`}>
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.75" />
          <stop offset="0.45" stopColor="#ff9a3a" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ff9a3a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}gl`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}col`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a3038" />
          <stop offset="0.45" stopColor="#8a7c84" />
          <stop offset="1" stopColor="#2a2228" />
        </linearGradient>
        <linearGradient id={`${id}shaft`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe6a8" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ffe6a8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0b0" />
          <stop offset="0.4" stopColor="#e8b93e" />
          <stop offset="1" stopColor="#8a5a0c" />
        </linearGradient>
        <linearGradient id={`${id}mar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2c34" />
          <stop offset="1" stopColor="#140d12" />
        </linearGradient>
      </defs>
      <rect width="400" height="214" fill={`url(#${id}wall)`} />
      {/* blocchi di pietra appena visibili */}
      {Array.from({ length: 12 }, (_, row) => (
        <path key={row} d={`M0 ${row * 18} H400`} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
      ))}
      {/* finestre a sesto acuto ai lati, vetri blu e rossi */}
      {[150, 250].map((x, i) => (
        <g key={x}>
          <path d={`M${x - 9} 150 V96 Q${x} 76 ${x + 9} 96 V150 Z`} fill={i ? "#2a4ea8" : "#9a1a30"} opacity="0.85" />
          <path d={`M${x} 82 V150 M${x - 9} 118 H${x + 9}`} stroke="#120c14" strokeWidth="1.2" />
          <path d={`M${x - 9} 150 V96 Q${x} 76 ${x + 9} 96 V150 Z`} fill="none" stroke="#8a6a2a" strokeWidth="1.4" />
        </g>
      ))}
      {/* fasci di luce dalla vetrata */}
      <g className="aa-ray">
        <path d="M184 94 L150 214 H200 Z" fill={`url(#${id}shaft)`} />
        <path d="M216 94 L250 214 H200 Z" fill={`url(#${id}shaft)`} />
        <path d="M196 100 L122 214 H160 Z" fill={`url(#${id}shaft)`} opacity="0.6" />
        <path d="M204 100 L278 214 H240 Z" fill={`url(#${id}shaft)`} opacity="0.6" />
      </g>
      {/* la vetrata a rosa: dietro la testa dell'arciere, come un'aureola */}
      <RoseWindow id={id} cx={200} cy={62} R={40} />
      {/* il trono d'oro sulla pedana */}
      <g>
        <path d="M164 214 V134 L172 116 L180 134 V124 L192 106 L200 84 L208 106 L220 124 V134 L228 116 L236 134 V214 Z" fill={`url(#${id}gold)`} stroke="#6a4408" strokeWidth="1" />
        <path d="M176 210 V140 Q200 124 224 140 V210 Z" fill="#8a1424" />
        <path d="M176 140 Q200 124 224 140" stroke="#e8b93e" strokeWidth="1.2" fill="none" />
        {[172, 200, 228].map((x, i) => <circle key={x} cx={x} cy={i === 1 ? 84 : 116} r="3.2" fill={i === 1 ? "#c41d3a" : "#2063c8"} stroke="#fff0b0" strokeWidth="0.8" />)}
        <rect x="154" y="176" width="20" height="10" rx="3" fill={`url(#${id}gold)`} />
        <rect x="226" y="176" width="20" height="10" rx="3" fill={`url(#${id}gold)`} />
      </g>
      <rect x="120" y="198" width="160" height="8" fill="#2a2228" />
      <rect x="132" y="190" width="136" height="8" fill="#3a3038" />
      <path d="M120 198 H280 M132 190 H268" stroke="#d9a62e" strokeWidth="1.2" />
      {/* colonne e stendardi */}
      <Column x={20} id={id} />
      <Column x={104} id={id} />
      <Column x={296} id={id} />
      <Column x={380} id={id} />
      <RoyalBanner x={62} y={34} h={110} />
      <RoyalBanner x={338} y={34} h={110} />
      <RoyalBanner x={124} y={40} h={74} />
      <RoyalBanner x={276} y={40} h={74} />
      {/* pavimento di marmo lucido in prospettiva */}
      <rect y="214" width="400" height="86" fill={`url(#${id}mar)`} />
      {Array.from({ length: 21 }, (_, i) => {
        const xb = -100 + i * 30;
        return <path key={i} d={`M${f(200 + (xb - 200) * 0.3)} 214 L${xb} 300`} stroke="#d9a62e" strokeOpacity="0.16" strokeWidth="0.7" />;
      })}
      {[222, 234, 250, 272].map((y) => <path key={y} d={`M0 ${y} H400`} stroke="#d9a62e" strokeOpacity="0.14" strokeWidth="0.7" />)}
      <ellipse cx="200" cy="236" rx="120" ry="10" fill="#ffd98a" opacity="0.1" />
      {/* tappeto rosso con bordo d'oro */}
      <path d="M180 214 H220 L262 300 H138 Z" fill="#7a1220" />
      <path d="M182 214 L142 300 M218 214 L258 300" stroke="#e8b93e" strokeWidth="1.6" />
      <path d="M186 214 L150 300 M214 214 L250 300" stroke="#e8b93e" strokeWidth="0.6" strokeDasharray="2 3" />
      <Brazier x={140} y={238} s={0.9} />
      <Brazier x={260} y={238} s={0.9} />
      {/* pulviscolo dorato nei fasci di luce */}
      <g fill="#fff0b0">
        {Array.from({ length: 30 }, (_, i) => (
          <circle key={i} className="aa-twinkle" style={{ animationDelay: `${(i % 9) * 0.4}s` }} cx={f(120 + r(i) * 160)} cy={f(90 + r(i * 3 + 1) * 120)} r={r(i * 7) > 0.8 ? 1.1 : 0.6} opacity="0.8" />
        ))}
      </g>
      <rect width="400" height="300" fill={`url(#${id}vigT)`} />
      <defs>
        <radialGradient id={`${id}vigT`} cx="0.5" cy="0.4" r="0.85">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </radialGradient>
      </defs>
    </g>
  );
}

/* ------------------------------------------------------------------ Picco del Drago */

function Dragon() {
  // drago in volo, controluce: corpo a esse, ali da pipistrello, coda lunga
  return (
    <g className="aa-dragon">
      <g transform="translate(150 44) scale(0.9)">
        <path d="M-46 -2 C-30 -30 -8 -40 6 -22 C10 -34 26 -44 44 -40 C34 -30 30 -20 34 -8 C20 -14 12 -10 6 -4 C0 -10 -20 -14 -46 -2 Z" fill="#0c0406" />
        <path d="M-46 -2 C-30 -30 -8 -40 6 -22" stroke="#ff5a1f" strokeOpacity="0.45" strokeWidth="1" fill="none" />
        <path d="M-30 -12 L-26 -24 M-16 -18 L-14 -30 M24 -30 L26 -40" stroke="#0c0406" strokeWidth="1.4" />
        <path d="M-56 4 C-40 0 -20 -2 6 -2 C22 -2 30 2 38 0 C44 -2 50 -6 56 -4 C52 0 48 4 40 6 C30 10 18 6 4 6 C-14 6 -36 10 -56 4 Z" fill="#0c0406" />
        <path d="M56 -4 L62 -8 L60 -2 L66 -2 L58 2 Z" fill="#0c0406" />
        <circle cx="58" cy="-3" r="0.9" fill="#ff8a2a" />
        <path d="M-56 4 C-70 6 -80 14 -92 12 C-84 18 -72 16 -62 10" stroke="#0c0406" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M-92 12 L-99 9 L-96 15 Z" fill="#0c0406" />
      </g>
    </g>
  );
}

function DragonPeak({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}dsky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0408" />
          <stop offset="0.45" stopColor="#3a0a0c" />
          <stop offset="0.72" stopColor="#9a2a0c" />
          <stop offset="0.8" stopColor="#e0601a" />
        </linearGradient>
        <radialGradient id={`${id}crater`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff1a8" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#ff9a2a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ff4a1a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}rock`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1416" />
          <stop offset="1" stopColor="#0c0608" />
        </linearGradient>
        <linearGradient id={`${id}lava`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.4" stopColor="#ffa02a" />
          <stop offset="1" stopColor="#e0301a" />
        </linearGradient>
        <filter id={`${id}blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}dsky)`} />
      {/* stelle velate dal fumo */}
      <g fill="#ffd0b0">{Array.from({ length: 26 }, (_, i) => <circle key={i} cx={f(r(i) * 400)} cy={f(r(i + 40) * 90)} r={r(i + 9) > 0.85 ? 0.9 : 0.5} opacity="0.5" />)}</g>
      {/* il vulcano dietro l'arciere: il cratere acceso dietro la testa */}
      <circle cx="200" cy="74" r="90" fill={`url(#${id}crater)`} className="aa-rose-glow" />
      <path d="M70 214 L150 92 L176 80 L224 80 L250 92 L330 214 Z" fill={`url(#${id}rock)`} />
      <path d="M176 80 Q200 72 224 80 Q200 88 176 80 Z" fill="#ffcf6a" />
      {/* colate di lava */}
      {["M190 84 C186 110 196 130 182 160 C174 178 186 196 176 214", "M212 84 C222 112 210 138 226 166 C234 182 222 200 232 214", "M200 86 C204 120 196 150 204 190"].map((d, i) => (
        <g key={i}>
          <path d={d} stroke="#ff6a1a" strokeWidth={i === 2 ? 5 : 7} fill="none" filter={`url(#${id}blur)`} opacity="0.8" />
          <path d={d} stroke={`url(#${id}lava)`} strokeWidth={i === 2 ? 1.8 : 2.6} fill="none" strokeLinecap="round" />
        </g>
      ))}
      {/* fumo che sale dal cratere */}
      <g fill="#1a0c0e" opacity="0.75" className="aa-smoke">
        <ellipse cx="190" cy="52" rx="26" ry="12" />
        <ellipse cx="212" cy="38" rx="30" ry="13" />
        <ellipse cx="236" cy="22" rx="36" ry="12" />
        <ellipse cx="268" cy="10" rx="40" ry="10" />
      </g>
      <Dragon />
      {/* picchi neri ai lati, accesi di rosso sui bordi */}
      <path d="M0 214 V70 L24 40 L40 76 L64 30 L84 90 L110 60 L136 214 Z" fill="#100607" />
      <path d="M24 40 L40 76 L64 30 L84 90 L110 60" stroke="#ff5a1f" strokeOpacity="0.55" strokeWidth="1.2" fill="none" />
      <path d="M400 214 V60 L378 36 L360 80 L334 24 L312 96 L290 64 L264 214 Z" fill="#100607" />
      <path d="M378 36 L360 80 L334 24 L312 96 L290 64" stroke="#ff5a1f" strokeOpacity="0.55" strokeWidth="1.2" fill="none" />
      {/* fiume di lava alle spalle dell'arciere */}
      <path d="M0 226 C60 214 120 232 200 220 C280 208 340 230 400 218 V234 C340 246 280 224 200 236 C120 248 60 230 0 242 Z" fill="#ff6a1a" filter={`url(#${id}blur)`} opacity="0.7" />
      <path d="M0 226 C60 214 120 232 200 220 C280 208 340 230 400 218 V230 C340 242 280 220 200 232 C120 244 60 226 0 238 Z" fill={`url(#${id}lava)`} />
      {/* terreno di ossidiana con crepe incandescenti */}
      <path d="M0 236 C80 226 140 244 200 236 C270 228 330 244 400 232 V300 H0 Z" fill="#120a0b" />
      {["M30 258 L60 266 L76 262 L96 274", "M300 262 L326 256 L344 268 L372 262", "M150 286 L176 280 L196 290", "M236 280 L258 288 L282 282"].map((d) => (
        <g key={d}>
          <path d={d} stroke="#ff6a1a" strokeWidth="4" fill="none" filter={`url(#${id}blur)`} opacity="0.7" />
          <path d={d} stroke="#ffc06a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </g>
      ))}
      {/* guglie di roccia ai lati dell'arciere */}
      <path d="M96 300 L104 238 L112 210 L122 236 L130 300 Z" fill="#0c0506" />
      <path d="M112 210 L122 236" stroke="#ff5a1f" strokeOpacity="0.6" strokeWidth="1" />
      <path d="M272 300 L280 244 L290 216 L298 246 L306 300 Z" fill="#0c0506" />
      <path d="M290 216 L280 244" stroke="#ff5a1f" strokeOpacity="0.6" strokeWidth="1" />
      {/* braci che salgono */}
      <g>
        {Array.from({ length: 34 }, (_, i) => (
          <circle key={i} className="aa-ember" style={{ animationDelay: `${-r(i * 5) * 6}s`, animationDuration: `${4 + r(i * 2) * 4}s` }} cx={f(r(i) * 400)} cy={f(200 + r(i * 3) * 90)} r={r(i * 7) > 0.7 ? 1.3 : 0.8} fill={r(i * 11) > 0.5 ? "#ffc06a" : "#ff6a1a"} />
        ))}
      </g>
      <rect width="400" height="300" fill={`url(#${id}vigD)`} />
      <defs>
        <radialGradient id={`${id}vigD`} cx="0.5" cy="0.45" r="0.8">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#1a0000" stopOpacity="0.55" />
        </radialGradient>
      </defs>
    </g>
  );
}

/* ------------------------------------------------------------------ Cittadella Celeste */

function PhoenixWings({ id }: { id: string }) {
  // ali di fuoco aperte dietro l'arciere: piume a strati dal centro verso i lati
  const side = (s: 1 | -1) => (
    <g transform={s < 0 ? "translate(400 0) scale(-1 1)" : undefined}>
      {Array.from({ length: 9 }, (_, i) => {
        const a = -0.25 + i * 0.13;
        const len = 64 + i * 7 - Math.max(0, i - 6) * 10;
        const x0 = 214;
        const y0 = 104 + i * 2;
        const x1 = x0 + Math.cos(a) * len;
        const y1 = y0 - Math.sin(-a + 0.6) * len * 0.75;
        return (
          <path key={i} d={`M${x0} ${y0} Q${f((x0 + x1) / 2)} ${f(Math.min(y0, y1) - 14)} ${f(x1)} ${f(y1)} Q${f((x0 + x1) / 2 + 6)} ${f((y0 + y1) / 2 + 10)} ${x0} ${y0 + 8} Z`} fill={`url(#${id}fe)`} opacity={0.55 + i * 0.04} />
        );
      })}
    </g>
  );
  return (
    <g className="aa-wingbeat">
      {side(1)}
      {side(-1)}
    </g>
  );
}

function SkyTower({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      {/* isola di roccia sospesa con le cascate */}
      <path d="M-34 20 C-30 34 -12 54 0 62 C10 52 28 36 34 20 Z" fill="#7a6a8a" />
      <path d="M-34 20 C-30 34 -12 54 0 62" stroke="#c9b8e0" strokeWidth="1" fill="none" opacity="0.6" />
      <path d="M-14 22 V70 M18 22 V60" stroke="#e6f4ff" strokeWidth="1.6" opacity="0.75" className="aa-fall" />
      <path d="M-36 20 H36 V14 H-36 Z" fill="#f2ead8" />
      {/* torri bianche con cupole d'oro */}
      <rect x="-24" y="-30" width="14" height="44" fill="#f6f0e2" />
      <rect x="-4" y="-56" width="16" height="70" fill="#fbf6ea" />
      <rect x="18" y="-24" width="12" height="38" fill="#efe6d2" />
      <path d="M-26 -30 Q-17 -48 -8 -30 Z M-6 -56 Q4 -82 14 -56 Z M16 -24 Q24 -40 32 -24 Z" fill="#e8b93e" />
      <path d="M4 -78 V-92" stroke="#e8b93e" strokeWidth="1.2" />
      <path d="M4 -92 l8 2.4 l-8 2.4 Z" fill="#c41d3a" />
      {[[-17, -18], [4, -40], [4, -22], [24, -12]].map(([cx, cy]) => <rect key={`${cx}${cy}`} x={cx - 2} y={cy} width="4" height="7" rx="2" fill="#ffcf6a" />)}
    </g>
  );
}

function CelestialCitadel({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}csky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141a44" />
          <stop offset="0.35" stopColor="#5a3c86" />
          <stop offset="0.6" stopColor="#e08a6a" />
          <stop offset="0.72" stopColor="#ffd08a" />
        </linearGradient>
        <radialGradient id={`${id}sun`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffbe8" />
          <stop offset="0.3" stopColor="#ffe6a0" stopOpacity="0.9" />
          <stop offset="0.6" stopColor="#ffb85a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ff9a3a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}fe`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.45" stopColor="#ffa02a" />
          <stop offset="1" stopColor="#d2361a" />
        </linearGradient>
        <linearGradient id={`${id}cloud`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff4e0" />
          <stop offset="1" stopColor="#e6b0a0" />
        </linearGradient>
        <linearGradient id={`${id}terr`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4ecdc" />
          <stop offset="1" stopColor="#c9b89a" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}csky)`} />
      <g fill="#fff">{Array.from({ length: 30 }, (_, i) => <circle key={i} className={i % 4 ? undefined : "aa-twinkle"} cx={f(r(i) * 400)} cy={f(r(i + 7) * 70)} r={r(i + 3) > 0.85 ? 1 : 0.55} opacity="0.75" />)}</g>
      {/* raggi del sole dietro l'arciere */}
      <g className="aa-ray" fill="#ffe6a0">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <path key={i} d={`M200 70 L${f(200 + Math.cos(a - 0.08) * 260)} ${f(70 + Math.sin(a - 0.08) * 260)} L${f(200 + Math.cos(a + 0.08) * 260)} ${f(70 + Math.sin(a + 0.08) * 260)} Z`} opacity="0.5" />;
        })}
      </g>
      <PhoenixWings id={id} />
      {/* il sole: aureola dietro la testa */}
      <circle cx="200" cy="66" r="78" fill={`url(#${id}sun)`} className="aa-rose-glow" />
      <circle cx="200" cy="66" r="30" fill="#fff6d8" opacity="0.9" />
      {/* mare di nuvole al tramonto */}
      {[0, 1, 2].map((k) => (
        <g key={k} opacity={0.75 + k * 0.1}>
          {Array.from({ length: 9 }, (_, i) => (
            <ellipse key={i} cx={f(-20 + i * 52 + (k % 2) * 26)} cy={160 + k * 16} rx={f(40 + r(i + k * 10) * 18)} ry={f(12 + r(i * 2 + k) * 6)} fill={`url(#${id}cloud)`} />
          ))}
        </g>
      ))}
      <SkyTower x={70} y={132} s={1} />
      <SkyTower x={336} y={126} s={0.9} flip />
      {/* lanterne che salgono */}
      <g>
        {Array.from({ length: 14 }, (_, i) => (
          <g key={i} className="aa-lantern" style={{ animationDelay: `${-r(i * 3) * 10}s`, animationDuration: `${9 + r(i) * 6}s` }}>
            <rect x={f(30 + r(i * 5) * 340)} y={f(120 + r(i * 9) * 70)} width="3.2" height="4.2" rx="1" fill="#ffb04a" />
            <circle cx={f(31.6 + r(i * 5) * 340)} cy={f(122 + r(i * 9) * 70)} r="5" fill="#ffb04a" opacity="0.25" />
          </g>
        ))}
      </g>
      {/* terrazza di marmo bianco con la balaustra */}
      <rect y="196" width="400" height="6" fill="#f4ecdc" />
      {Array.from({ length: 27 }, (_, i) => <path key={i} d={`M${6 + i * 15} 202 c-2 4 -2 8 0 12 c2 -4 2 -8 0 -12 Z M${2 + i * 15} 202 h8`} fill="#e6dcc6" stroke="#c9b89a" strokeWidth="0.6" />)}
      <rect y="212" width="400" height="4" fill="#d9a62e" />
      <rect y="216" width="400" height="84" fill={`url(#${id}terr)`} />
      {Array.from({ length: 21 }, (_, i) => {
        const xb = -100 + i * 30;
        return <path key={i} d={`M${f(200 + (xb - 200) * 0.3)} 216 L${xb} 300`} stroke="#b08a3a" strokeOpacity="0.35" strokeWidth="0.7" />;
      })}
      {[226, 240, 260, 286].map((y) => <path key={y} d={`M0 ${y} H400`} stroke="#b08a3a" strokeOpacity="0.3" strokeWidth="0.7" />)}
      {/* rosa dei venti d'oro sul pavimento, sotto i piedi */}
      <g transform="translate(200 262) scale(1 0.32)">
        <circle r="44" fill="none" stroke="#d9a62e" strokeWidth="2.4" />
        <circle r="34" fill="none" stroke="#d9a62e" strokeWidth="1" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const l = i % 2 ? 26 : 42;
          return <path key={i} d={`M0 0 L${f(Math.cos(a - 0.2) * 8)} ${f(Math.sin(a - 0.2) * 8)} L${f(Math.cos(a) * l)} ${f(Math.sin(a) * l)} L${f(Math.cos(a + 0.2) * 8)} ${f(Math.sin(a + 0.2) * 8)} Z`} fill={i % 2 ? "#c48f22" : "#e8b93e"} />;
        })}
      </g>
      <rect width="400" height="300" fill={`url(#${id}vigC)`} />
      <defs>
        <radialGradient id={`${id}vigC`} cx="0.5" cy="0.4" r="0.85">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#140a2a" stopOpacity="0.4" />
        </radialGradient>
      </defs>
    </g>
  );
}

export const FOUNDER_LAYERS: Record<"trono" | "drago" | "cielo", (id: string) => ReactNode> = {
  trono: (id) => <ThroneHall id={id} />,
  drago: (id) => <DragonPeak id={id} />,
  cielo: (id) => <CelestialCitadel id={id} />,
};
