import { useId, type ReactNode } from "react";

/**
 * Icone illustrate "realistiche": oggetti a colori pieni con luci, ombre e materiali
 * (legno, metallo, carbonio, carta). Disegnate su 64×64; ogni istanza ha i suoi id di gradiente.
 */
type Draw = (u: string) => ReactNode;

const lin = (id: string, stops: [number, string, number?][], x1 = 0, y1 = 0, x2 = 0, y2 = 1) => (
  <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
    {stops.map(([o, c, op], i) => <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />)}
  </linearGradient>
);
const rad = (id: string, stops: [number, string, number?][], cx = 0.5, cy = 0.5, r = 0.5, fx?: number, fy?: number) => (
  <radialGradient id={id} cx={cx} cy={cy} r={r} fx={fx ?? cx} fy={fy ?? cy}>
    {stops.map(([o, c, op], i) => <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />)}
  </radialGradient>
);
const shadow = (cx = 32, cy = 57, rx = 19) => <ellipse cx={cx} cy={cy} rx={rx} ry={2.6} fill="#000" opacity={0.28} />;

/** Bersaglio a colori (bianco, nero, blu, rosso, oro) con luce. */
function target(u: string, cx: number, cy: number, r: number, k = "t") {
  const rings: [number, string][] = [
    [1, "#f4f1ea"], [0.8, "#1d2126"], [0.6, "#2f7fd1"], [0.4, "#d63a2f"], [0.2, "#f2c94c"],
  ];
  return (
    <g>
      <defs>{rad(`${u}${k}sh`, [[0, "#fff", 0.35], [0.6, "#fff", 0], [1, "#000", 0.25]], 0.38, 0.32, 0.75)}</defs>
      <circle cx={cx + 0.8} cy={cy + 1.4} r={r} fill="#000" opacity={0.3} />
      {rings.map(([f, c]) => <circle key={f} cx={cx} cy={cy} r={r * f} fill={c} />)}
      <circle cx={cx} cy={cy} r={r * 0.08} fill="#fff7d1" opacity={0.8} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${u}${k}sh)`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#000" strokeOpacity={0.25} strokeWidth={0.6} />
    </g>
  );
}

/** Freccia in carbonio con penne e cocca. */
function arrow(u: string, x1: number, y1: number, x2: number, y2: number, fletch = "#d63a2f", k = "a", tip = true) {
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const len = Math.hypot(x2 - x1, y2 - y1);
  return (
    <g transform={`translate(${x1} ${y1}) rotate(${ang})`}>
      <defs>
        {lin(`${u}${k}sh`, [[0, "#6b737d"], [0.45, "#22272d"], [1, "#0d1013"]])}
        {lin(`${u}${k}fl`, [[0, fletch], [1, fletch, 0.75]])}
        {lin(`${u}${k}pt`, [[0, "#f1f3f5"], [0.5, "#9aa3ad"], [1, "#5a626b"]])}
      </defs>
      <rect x={2} y={-1.1} width={len - 2} height={2.2} rx={1.1} fill={`url(#${u}${k}sh)`} />
      <path d={`M3 -1 L9 -5.2 L12.5 -5.2 L10 -1 Z`} fill={`url(#${u}${k}fl)`} />
      <path d={`M3 1 L9 5.2 L12.5 5.2 L10 1 Z`} fill={`url(#${u}${k}fl)`} opacity={0.85} />
      <path d={`M3.5 -0.5 L9 -3 L11 -3 L9.5 -0.5Z`} fill="#fff" opacity={0.25} />
      <rect x={0} y={-1.6} width={3} height={3.2} rx={1} fill="#f2c94c" />
      {tip ? <path d={`M${len - 1} -1.5 L${len + 4} 0 L${len - 1} 1.5 Z`} fill={`url(#${u}${k}pt)`} /> : null}
    </g>
  );
}

const DRAW: Record<string, Draw> = {
  bolt: (u) => (
    <>
      {target(u, 42, 30, 16)}
      <g opacity={0.7} stroke="#fff" strokeLinecap="round">
        <path d="M5 38 L17 34" strokeWidth={1.4} opacity={0.6} />
        <path d="M3 44 L14 40.5" strokeWidth={1.1} opacity={0.45} />
        <path d="M8 31 L18 28" strokeWidth={1} opacity={0.4} />
      </g>
      {arrow(u, 8, 40, 38, 31)}
      <path d="M36 27.5 l3 1.8 M36.5 33.5 l3 -1" stroke="#fff7d1" strokeWidth={1.2} strokeLinecap="round" opacity={0.9} />
    </>
  ),
  camera: (u) => (
    <>
      <defs>
        {lin(`${u}b`, [[0, "#4b525c"], [0.5, "#2a2f36"], [1, "#16191d"]])}
        {lin(`${u}r`, [[0, "#e7ebf0"], [0.5, "#8d949d"], [1, "#4a5058"]], 0, 0, 1, 1)}
        {rad(`${u}g`, [[0, "#6fb3ff"], [0.45, "#1d4f97"], [1, "#07152b"]], 0.4, 0.35, 0.6)}
        {lin(`${u}t`, [[0, "#5a626c"], [1, "#2a2f36"]])}
      </defs>
      {shadow(32, 55, 22)}
      <path d="M21 16 Q22 12 26 12 H38 Q42 12 43 16 Z" fill={`url(#${u}t)`} />
      <rect x={8} y={16} width={48} height={35} rx={7} fill={`url(#${u}b)`} />
      <rect x={8} y={16} width={48} height={7} rx={4} fill="#fff" opacity={0.08} />
      <rect x={8} y={36} width={48} height={8} fill="#000" opacity={0.18} />
      <circle cx={32} cy={34} r={13.5} fill={`url(#${u}r)`} />
      <circle cx={32} cy={34} r={10.5} fill="#0b0d10" />
      <circle cx={32} cy={34} r={8.6} fill={`url(#${u}g)`} />
      <circle cx={32} cy={34} r={3.6} fill="#020509" opacity={0.85} />
      <ellipse cx={28.6} cy={30.4} rx={3} ry={1.9} fill="#fff" opacity={0.75} transform="rotate(-35 28.6 30.4)" />
      <circle cx={35.5} cy={37.6} r={1} fill="#fff" opacity={0.4} />
      <rect x={45} y={20} width={7} height={4} rx={1.3} fill="#f6f2e4" />
      <circle cx={14.5} cy={21.5} r={2} fill="#d63a2f" />
    </>
  ),
  bow: (u) => (
    <>
      <defs>
        {lin(`${u}l`, [[0, "#3c2414"], [0.35, "#8a5a2e"], [0.6, "#d79b58"], [1, "#5b3618"]], 0, 0, 1, 0)}
        {lin(`${u}r`, [[0, "#bfc6cf"], [0.45, "#5c646d"], [1, "#2a2f35"]], 0, 0, 1, 0)}
        {lin(`${u}g`, [[0, "#2b1a10"], [1, "#6e4424"]], 0, 0, 1, 0)}
      </defs>
      {shadow(32, 59, 16)}
      <path d="M30 25 C22 18 18 11 23 5.5 C24.2 4.4 26.2 4.8 26.4 6.6" fill="none" stroke={`url(#${u}l)`} strokeWidth={4.2} strokeLinecap="round" />
      <path d="M30 39 C22 46 18 53 23 58.5 C24.2 59.6 26.2 59.2 26.4 57.4" fill="none" stroke={`url(#${u}l)`} strokeWidth={4.2} strokeLinecap="round" />
      <path d="M29 25.5 C24 19.5 21.5 13 24 8" fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={0.9} strokeLinecap="round" />
      <line x1={25.6} y1={6.8} x2={25.6} y2={57.2} stroke="#f4f1ea" strokeWidth={0.9} />
      <rect x={28} y={22} width={6.5} height={20} rx={2.6} fill={`url(#${u}r)`} />
      <rect x={28.6} y={29} width={5} height={7.5} rx={2} fill={`url(#${u}g)`} />
      <path d="M34.5 27 h7 v2 h-7z" fill="#2a2f35" />
      <circle cx={42.5} cy={28} r={1.6} fill="#f2c94c" />
      {arrow(u, 25.4, 32, 56, 32, "#d63a2f", "a")}
    </>
  ),
  archer: (u) => (
    <>
      <defs>
        {rad(`${u}j`, [[0, "#ffffff"], [0.45, "#7cf0ff"], [1, "#22b6e8", 0]])}
        {lin(`${u}s`, [[0, "#9fe9ff"], [1, "#3aa7d6"]])}
      </defs>
      {shadow(32, 59, 15)}
      <g stroke={`url(#${u}s)`} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M30 22 L30 40 L24 57 M30 40 L36 57" />
        <path d="M30 25 L42 25 L52 25" />
        <path d="M30 25 L22 22 L17 25" />
      </g>
      <path d="M53 10 C59 18 59 32 53 40" fill="none" stroke="#d79b58" strokeWidth={2.4} strokeLinecap="round" />
      <line x1={53} y1={10} x2={18} y2={25} stroke="#f4f1ea" strokeWidth={0.7} opacity={0.8} />
      <line x1={53} y1={40} x2={18} y2={25} stroke="#f4f1ea" strokeWidth={0.7} opacity={0.8} />
      <circle cx={30} cy={15} r={5.2} fill="#9fe9ff" opacity={0.9} />
      {[[30, 22], [30, 40], [24, 57], [36, 57], [42, 25], [52, 25], [22, 22], [17, 25], [30, 15]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={4.2} fill={`url(#${u}j)`} opacity={0.75} />
          <circle cx={x} cy={y} r={1.5} fill="#fff" />
        </g>
      ))}
    </>
  ),
  notebook: (u) => (
    <>
      <defs>
        {lin(`${u}c`, [[0, "#9a6235"], [0.55, "#6e4222"], [1, "#3f2412"]], 0, 0, 1, 1)}
        {lin(`${u}p`, [[0, "#fffdf6"], [1, "#e1dccd"]], 0, 0, 1, 0)}
        {lin(`${u}n`, [[0, "#2f7fd1"], [1, "#163f73"]], 0, 0, 1, 0)}
      </defs>
      {shadow(32, 58, 18)}
      <rect x={15} y={8} width={34} height={47} rx={4} fill={`url(#${u}p)`} transform="translate(2 1)" />
      <rect x={14} y={7} width={34} height={47} rx={4} fill={`url(#${u}c)`} />
      <rect x={14} y={7} width={6} height={47} rx={3} fill="#000" opacity={0.22} />
      <rect x={38} y={7} width={3.4} height={47} fill="#2b1a10" opacity={0.75} />
      <rect x={24} y={17} width={14} height={9} rx={1.5} fill="#f4e7c8" opacity={0.92} />
      <path d="M26 21h10M26 23.5h7" stroke="#8a6a3a" strokeWidth={0.8} />
      <rect x={14} y={7} width={34} height={6} rx={4} fill="#fff" opacity={0.1} />
      <g transform="rotate(38 44 40)">
        <rect x={40} y={20} width={5} height={30} rx={2.2} fill={`url(#${u}n)`} />
        <rect x={40} y={20} width={5} height={5} rx={2} fill="#d6dbe1" />
        <path d="M40 50 L42.5 56 L45 50 Z" fill="#f1d7a8" />
        <path d="M41.8 54 L42.5 56 L43.2 54 Z" fill="#2a2f35" />
        <rect x={41} y={21} width={1.2} height={27} fill="#fff" opacity={0.35} />
      </g>
    </>
  ),
  history: (u) => (
    <>
      <defs>
        {lin(`${u}m`, [[0, "#eef1f4"], [0.5, "#9aa3ad"], [1, "#4c535b"]], 0, 0, 1, 1)}
        {rad(`${u}f`, [[0, "#ffffff"], [0.85, "#e9eef2"], [1, "#c5ccd3"]], 0.4, 0.35, 0.7)}
      </defs>
      {shadow(32, 58, 17)}
      <path d="M11 30 A21 21 0 1 1 17 46" fill="none" stroke="#7cf0a8" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
      <path d="M7 25.5 L11 31.5 L16 26.5" fill="none" stroke="#7cf0a8" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={32} cy={32} r={16.5} fill={`url(#${u}m)`} />
      <circle cx={32} cy={32} r={13.5} fill={`url(#${u}f)`} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const r1 = i % 3 ? 11.6 : 10.4;
        return <line key={i} x1={32 + Math.sin(a) * r1} y1={32 - Math.cos(a) * r1} x2={32 + Math.sin(a) * 12.8} y2={32 - Math.cos(a) * 12.8} stroke="#39404a" strokeWidth={i % 3 ? 0.8 : 1.5} />;
      })}
      <path d="M32 32 L32 23.5" stroke="#1d2126" strokeWidth={2} strokeLinecap="round" />
      <path d="M32 32 L38.5 35" stroke="#1d2126" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M32 32 L27 41" stroke="#d63a2f" strokeWidth={0.8} strokeLinecap="round" />
      <circle cx={32} cy={32} r={1.6} fill="#d63a2f" />
      <ellipse cx={27} cy={24} rx={6} ry={3} fill="#fff" opacity={0.5} transform="rotate(-30 27 24)" />
    </>
  ),
  trophy: (u) => (
    <>
      <defs>
        {lin(`${u}g`, [[0, "#fff4b8"], [0.3, "#f6d24f"], [0.65, "#d49a1e"], [1, "#8a5a0e"]], 0, 0, 1, 0)}
        {lin(`${u}h`, [[0, "#f6d24f"], [1, "#9c6812"]])}
        {lin(`${u}w`, [[0, "#5a3a20"], [1, "#2a1a0e"]])}
      </defs>
      {shadow(32, 58, 15)}
      <path d="M18 14 C8 14 8 30 21 31" fill="none" stroke={`url(#${u}h)`} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M46 14 C56 14 56 30 43 31" fill="none" stroke={`url(#${u}h)`} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M17 9 H47 V18 C47 30 40 37 32 37 C24 37 17 30 17 18 Z" fill={`url(#${u}g)`} />
      <ellipse cx={32} cy={9} rx={15} ry={2.4} fill="#fff6c6" />
      <ellipse cx={32} cy={9.4} rx={12.5} ry={1.4} fill="#b07a14" opacity={0.6} />
      <path d="M22 13 C22 24 24 30 27 33" fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" />
      <path d="M32 18.5 l1.9 3.9 4.3 0.6 -3.1 3 0.7 4.3 -3.8-2 -3.8 2 0.7-4.3 -3.1-3 4.3-0.6z" fill="#fff5c0" opacity={0.85} />
      <path d="M29 37 H35 L36 44 H28 Z" fill={`url(#${u}g)`} />
      <rect x={22} y={44} width={20} height={4} rx={1.2} fill={`url(#${u}g)`} />
      <rect x={19} y={48} width={26} height={8} rx={1.8} fill={`url(#${u}w)`} />
      <rect x={26} y={50.5} width={12} height={3} rx={0.6} fill="#e6c25a" opacity={0.9} />
    </>
  ),
  chart: (u) => (
    <>
      <defs>
        {lin(`${u}p`, [[0, "#ffffff"], [1, "#e4e9ee"]])}
        {lin(`${u}a`, [[0, "#5fe1c8"], [1, "#138a7a"]])}
        {lin(`${u}b`, [[0, "#78b6ff"], [1, "#2459b5"]])}
        {lin(`${u}c`, [[0, "#ffc06a"], [1, "#d36f1a"]])}
      </defs>
      {shadow(32, 58, 21)}
      <rect x={9} y={10} width={46} height={44} rx={6} fill={`url(#${u}p)`} />
      <path d="M15 47 H49" stroke="#9aa3ad" strokeWidth={0.8} />
      {[22, 32, 42].map((y) => <path key={y} d={`M15 ${y} H49`} stroke="#c9d1d9" strokeWidth={0.5} strokeDasharray="1.5 1.5" />)}
      <rect x={17} y={33} width={7} height={14} rx={1.4} fill={`url(#${u}a)`} />
      <rect x={28.5} y={25} width={7} height={22} rx={1.4} fill={`url(#${u}b)`} />
      <rect x={40} y={18} width={7} height={29} rx={1.4} fill={`url(#${u}c)`} />
      {[17, 28.5, 40].map((x) => <rect key={x} x={x + 0.8} y={x === 17 ? 34 : x === 28.5 ? 26 : 19} width={1.6} height={x === 17 ? 12 : x === 28.5 ? 20 : 27} rx={0.8} fill="#fff" opacity={0.35} />)}
      <path d="M17 30 L30 22 L37 26 L49 13" fill="none" stroke="#1d2126" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      {[[17, 30], [30, 22], [37, 26], [49, 13]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={1.9} fill="#fff" stroke="#1d2126" strokeWidth={1.1} />)}
    </>
  ),
  ballistics: (u) => (
    <>
      {target(u, 47, 36, 12)}
      <path d="M6 50 C16 18 30 14 44 32" fill="none" stroke="#fff" strokeOpacity={0.75} strokeWidth={1.4} strokeDasharray="2.4 2.2" strokeLinecap="round" />
      {[[10, 39], [16, 28], [24, 21], [33, 20]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.9 + i * 0.25} fill="#fff" opacity={0.45 + i * 0.12} />)}
      {arrow(u, 33, 23, 45, 34, "#f2c94c", "a")}
      <path d="M6 54 H24" stroke="#fff" strokeOpacity={0.35} strokeWidth={1} />
      <path d="M8 54 A8 8 0 0 1 12.8 47.6" fill="none" stroke="#f2c94c" strokeWidth={1.2} />
    </>
  ),
  quiver: (u) => (
    <>
      <defs>
        {lin(`${u}q`, [[0, "#4a2b16"], [0.35, "#9b6334"], [0.6, "#c88a4f"], [1, "#5b3518"]], 0, 0, 1, 0)}
        {lin(`${u}s`, [[0, "#2b1a10"], [1, "#4a2b16"]])}
      </defs>
      {shadow(33, 59, 14)}
      <g transform="rotate(-14 32 36)">
        {[[24, "#d63a2f"], [31, "#f2c94c"], [38, "#2f7fd1"]].map(([x, c], i) => (
          <g key={i}>
            <rect x={(x as number) + 1.1} y={6} width={1.8} height={14} fill="#1d2126" />
            <path d={`M${x} ${7 + i} l-2.6 8 h2.6 z`} fill={c as string} />
            <path d={`M${(x as number) + 4} ${7 + i} l2.6 8 h-2.6 z`} fill={c as string} opacity={0.8} />
            <rect x={(x as number) + 0.8} y={4 + i} width={2.4} height={3} rx={1} fill="#f4f1ea" />
          </g>
        ))}
        <path d="M20 17 H45 L42.5 57 Q32.5 60 22.5 57 Z" fill={`url(#${u}q)`} />
        <ellipse cx={32.5} cy={17.4} rx={12.5} ry={2.4} fill="#2b1a10" />
        <path d="M21 26 H44.3" stroke={`url(#${u}s)`} strokeWidth={2.4} />
        <path d="M22 46 H43" stroke={`url(#${u}s)`} strokeWidth={2.4} />
        <path d="M25 20 V54" stroke="#fff" strokeOpacity={0.22} strokeWidth={1.6} />
        <path d="M21 26 h23.3 M22 46 h21" stroke="#e6c25a" strokeDasharray="1 1.4" strokeWidth={0.5} />
      </g>
    </>
  ),
  team: (u) => (
    <>
      <defs>
        {rad(`${u}s1`, [[0, "#ffe0c4"], [1, "#c98e62"]], 0.4, 0.35, 0.7)}
        {rad(`${u}s2`, [[0, "#f3c9a1"], [1, "#a8704a"]], 0.4, 0.35, 0.7)}
        {lin(`${u}b1`, [[0, "#5b8ff0"], [1, "#2a4ea6"]])}
        {lin(`${u}b2`, [[0, "#4fcf8a"], [1, "#1f7a4c"]])}
      </defs>
      {shadow(32, 59, 22)}
      <path d="M30 56 C30 44 35 38 43 38 C51 38 56 44 56 56 Z" fill={`url(#${u}b1)`} />
      <circle cx={43} cy={27} r={8} fill={`url(#${u}s2)`} />
      <path d="M35 25 C35 18 40 16 44 16 C49 16 52 20 51 26 C49 22 44 21 40 23 Z" fill="#3b2617" />
      <path d="M8 57 C8 43 14 36 24 36 C34 36 40 43 40 57 Z" fill={`url(#${u}b2)`} />
      <path d="M20 37 L24 44 L28 37" fill="#e9f8ef" opacity={0.9} />
      <circle cx={24} cy={24} r={9.4} fill={`url(#${u}s1)`} />
      <path d="M14.6 23 C14 14 20 12 25 12 C31 12 34.5 16 33.6 23 C31 18.5 25 18 20 20 Z" fill="#6b4226" />
      <ellipse cx={20.5} cy={21} rx={2.6} ry={1.6} fill="#fff" opacity={0.35} />
    </>
  ),
  calendar: (u) => (
    <>
      <defs>
        {lin(`${u}p`, [[0, "#ffffff"], [1, "#e3e8ee"]])}
        {lin(`${u}h`, [[0, "#ff6a5c"], [1, "#c62f24"]])}
        {lin(`${u}m`, [[0, "#f1f3f5"], [1, "#7d858f"]], 0, 0, 1, 0)}
      </defs>
      {shadow(32, 58, 21)}
      <rect x={9} y={12} width={46} height={43} rx={6} fill={`url(#${u}p)`} />
      <path d="M9 18 Q9 12 15 12 H49 Q55 12 55 18 V24 H9 Z" fill={`url(#${u}h)`} />
      <rect x={9} y={12} width={46} height={4} rx={3} fill="#fff" opacity={0.25} />
      {[20, 44].map((x) => <rect key={x} x={x - 1.6} y={7} width={3.2} height={10} rx={1.6} fill={`url(#${u}m)`} />)}
      {Array.from({ length: 12 }, (_, i) => {
        const x = 16 + (i % 4) * 10.5;
        const y = 31 + Math.floor(i / 4) * 8;
        return <rect key={i} x={x - 2.6} y={y - 2.2} width={5.2} height={4.4} rx={1} fill={i === 6 ? "#d63a2f" : "#cbd3db"} opacity={i === 6 ? 1 : 0.9} />;
      })}
      <circle cx={37} cy={39} r={5.2} fill="none" stroke="#d63a2f" strokeWidth={1.2} />
    </>
  ),
  podium: (u) => (
    <>
      <defs>
        {lin(`${u}g`, [[0, "#fff1a8"], [0.5, "#f2c94c"], [1, "#b8860b"]])}
        {lin(`${u}s`, [[0, "#ffffff"], [0.5, "#c9d0d8"], [1, "#7d868f"]])}
        {lin(`${u}b`, [[0, "#ffd0a0"], [0.5, "#d0864a"], [1, "#8a4f22"]])}
      </defs>
      {shadow(32, 58, 25)}
      <rect x={6} y={32} width={18} height={24} rx={1.6} fill={`url(#${u}s)`} />
      <rect x={23} y={21} width={18} height={35} rx={1.6} fill={`url(#${u}g)`} />
      <rect x={40} y={38} width={18} height={18} rx={1.6} fill={`url(#${u}b)`} />
      <path d="M6 32 l3 -3 h18 l-3 3z" fill="#eef1f4" />
      <path d="M23 21 l3 -3 h18 l-3 3z" fill="#fff4b8" />
      <path d="M40 38 l3 -3 h18 l-3 3z" fill="#ffd9b0" />
      <text x={15} y={47} textAnchor="middle" fontSize={11} fontWeight={800} fill="#5b636c" fontFamily="system-ui">2</text>
      <text x={32} y={38} textAnchor="middle" fontSize={13} fontWeight={800} fill="#8a5a0e" fontFamily="system-ui">1</text>
      <text x={49} y={51} textAnchor="middle" fontSize={10} fontWeight={800} fill="#6e3a14" fontFamily="system-ui">3</text>
      <path d="M32 6 l1.7 3.5 3.9 0.6 -2.8 2.7 0.7 3.9 -3.5-1.8 -3.5 1.8 0.7-3.9 -2.8-2.7 3.9-0.6z" fill="#f6d24f" />
    </>
  ),
  duel: (u) => (
    <>
      {shadow(32, 58, 18)}
      {arrow(u, 8, 52, 55, 9, "#d63a2f", "a")}
      {arrow(u, 56, 52, 9, 9, "#2f7fd1", "b")}
      <g transform="translate(32 31)">
        <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" fill="#fff7d1" />
        <circle r={2.6} fill="#fff" />
      </g>
    </>
  ),
  flag: (u) => (
    <>
      <defs>
        {lin(`${u}f`, [[0, "#ff6a5c"], [0.5, "#d63a2f"], [1, "#8f1d16"]], 0, 0, 1, 0)}
        {lin(`${u}p`, [[0, "#f1f3f5"], [0.5, "#9aa3ad"], [1, "#4c535b"]], 0, 0, 1, 0)}
        {rad(`${u}h`, [[0, "#6fbf73"], [1, "#2e6b34"]], 0.5, 0.3, 0.7)}
      </defs>
      <ellipse cx={32} cy={55} rx={22} ry={5.5} fill={`url(#${u}h)`} />
      <ellipse cx={32} cy={53.6} rx={18} ry={3} fill="#fff" opacity={0.12} />
      <rect x={19} y={7} width={3} height={48} rx={1.5} fill={`url(#${u}p)`} />
      <circle cx={20.5} cy={6.5} r={2.6} fill="#f2c94c" />
      <path d="M22 10 C30 7 36 14 44 11 C48 9.5 51 9 54 10 L54 30 C50 29 47 29.5 43 31 C35 34 29 27 22 30 Z" fill={`url(#${u}f)`} />
      <path d="M22 10 C30 7 36 14 44 11 C48 9.5 51 9 54 10 L54 14 C49 13 46 14 43 15 C35 18 29 12 22 14 Z" fill="#fff" opacity={0.18} />
      <circle cx={38} cy={20} r={5} fill="#f4f1ea" opacity={0.95} />
      <circle cx={38} cy={20} r={3} fill="#d63a2f" />
      <circle cx={38} cy={20} r={1.2} fill="#f2c94c" />
    </>
  ),
  megaphone: (u) => (
    <>
      <defs>
        {lin(`${u}c`, [[0, "#ffffff"], [0.6, "#e1e6eb"], [1, "#9aa3ad"]])}
        {lin(`${u}r`, [[0, "#ff7a6e"], [1, "#b8281e"]])}
      </defs>
      {shadow(30, 58, 18)}
      <path d="M12 26 L40 12 V50 L12 38 Z" fill={`url(#${u}c)`} />
      <ellipse cx={40} cy={31} rx={4.5} ry={19} fill={`url(#${u}r)`} />
      <ellipse cx={40.5} cy={31} rx={2.6} ry={15} fill="#5a120d" opacity={0.7} />
      <rect x={6} y={25} width={8} height={14} rx={3} fill={`url(#${u}r)`} />
      <path d="M18 38 L20 50 H26 L24.5 40.5" fill="#2a2f35" />
      <path d="M14 27 L38 15" stroke="#fff" strokeWidth={1.4} opacity={0.7} strokeLinecap="round" />
      <g fill="none" stroke="#f2c94c" strokeWidth={2} strokeLinecap="round">
        <path d="M49 24 C52 28 52 34 49 38" />
        <path d="M54 19 C59 26 59 36 54 43" opacity={0.7} />
      </g>
    </>
  ),
  compare: (u) => (
    <>
      <defs>
        {lin(`${u}g`, [[0, "#fff1a8"], [0.5, "#e2b23a"], [1, "#9a6a12"]], 0, 0, 1, 0)}
        {lin(`${u}p`, [[0, "#ffe68a"], [1, "#a8741a"]])}
      </defs>
      {shadow(32, 58, 16)}
      <rect x={30.4} y={11} width={3.2} height={40} rx={1.4} fill={`url(#${u}g)`} />
      <path d="M22 51 H42 L44 56 H20 Z" fill={`url(#${u}p)`} />
      <rect x={8} y={14.4} width={48} height={2.6} rx={1.3} fill={`url(#${u}g)`} transform="rotate(-6 32 15.7)" />
      <circle cx={32} cy={11} r={3.4} fill={`url(#${u}p)`} />
      <g stroke="#b88a2a" strokeWidth={0.8}>
        <path d="M11 18 L5 34 M11 18 L17 34" />
        <path d="M53 13 L47 29 M53 13 L59 29" />
      </g>
      <path d="M3 34 H19 C18 40 14 42 11 42 C8 42 4 40 3 34 Z" fill={`url(#${u}p)`} />
      <path d="M45 29 H61 C60 35 56 37 53 37 C50 37 46 35 45 29 Z" fill={`url(#${u}p)`} />
      <ellipse cx={11} cy={34} rx={8} ry={1.4} fill="#fff3b8" />
      <ellipse cx={53} cy={29} rx={8} ry={1.4} fill="#fff3b8" />
    </>
  ),
  game: (u) => (
    <>
      <defs>
        {lin(`${u}b`, [[0, "#4b525c"], [0.5, "#2a2f36"], [1, "#15181c"]])}
      </defs>
      {shadow(32, 57, 23)}
      <path d="M17 18 H47 C55 18 59 26 60 36 C61 46 56 51 51 49 C47 47.5 45 42 41 42 H23 C19 42 17 47.5 13 49 C8 51 3 46 4 36 C5 26 9 18 17 18 Z" fill={`url(#${u}b)`} />
      <path d="M17 19 H47 C52 19 55 22 57 27 C50 23 14 23 7 27 C9 22 12 19 17 19 Z" fill="#fff" opacity={0.12} />
      <rect x={14} y={27.5} width={4} height={12} rx={1} fill="#c9d0d8" />
      <rect x={10} y={31.5} width={12} height={4} rx={1} fill="#c9d0d8" />
      <circle cx={46} cy={28} r={2.6} fill="#f2c94c" />
      <circle cx={51.5} cy={33.5} r={2.6} fill="#d63a2f" />
      <circle cx={40.5} cy={33.5} r={2.6} fill="#2f7fd1" />
      <circle cx={46} cy={39} r={2.6} fill="#3fbf6a" />
      <rect x={28} y={29} width={3.5} height={1.8} rx={0.9} fill="#7d858f" />
      <rect x={33} y={29} width={3.5} height={1.8} rx={0.9} fill="#7d858f" />
    </>
  ),
  bag: (u) => (
    <>
      <defs>
        {lin(`${u}k`, [[0, "#e2b583"], [0.6, "#c48c55"], [1, "#8a5a2e"]], 0, 0, 1, 0)}
      </defs>
      {shadow(32, 58, 19)}
      <path d="M24 22 C24 10 40 10 40 22" fill="none" stroke="#5b3518" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M12 20 H52 L55 56 H9 Z" fill={`url(#${u}k)`} />
      <path d="M12 20 H52 L51 26 H13 Z" fill="#000" opacity={0.12} />
      <path d="M9 56 L12 20 L17 23 L15 56 Z" fill="#000" opacity={0.12} />
      <circle cx={24} cy={25} r={1.6} fill="#3f2412" />
      <circle cx={40} cy={25} r={1.6} fill="#3f2412" />
      {target(u, 32, 41, 8)}
    </>
  ),
  user: (u) => (
    <>
      <defs>
        {rad(`${u}s`, [[0, "#ffe0c4"], [1, "#c48a5c"]], 0.4, 0.35, 0.7)}
        {lin(`${u}b`, [[0, "#6f7a88"], [1, "#363d47"]])}
      </defs>
      {shadow(32, 59, 21)}
      <path d="M10 58 C10 44 19 37 32 37 C45 37 54 44 54 58 Z" fill={`url(#${u}b)`} />
      <path d="M26 38 L32 47 L38 38" fill="#eef1f4" />
      <path d="M31 46 L32 52 L33 46 Z" fill="#d63a2f" />
      <circle cx={32} cy={23} r={11} fill={`url(#${u}s)`} />
      <path d="M21 22 C20 12 27 9.5 32 9.5 C39 9.5 44 13 43 22 C40 16.5 33 15.5 26 18.5 Z" fill="#4a2e1b" />
      <ellipse cx={27.5} cy={20} rx={3} ry={1.8} fill="#fff" opacity={0.35} />
    </>
  ),
  stopwatch: (u) => (
    <>
      <defs>
        {lin(`${u}m`, [[0, "#f5f7f9"], [0.5, "#a3abb4"], [1, "#4c535b"]], 0, 0, 1, 1)}
        {rad(`${u}f`, [[0, "#ffffff"], [0.85, "#eef1f4"], [1, "#c5ccd3"]], 0.4, 0.35, 0.7)}
      </defs>
      {shadow(32, 59, 16)}
      <rect x={28.5} y={5} width={7} height={6} rx={1.6} fill={`url(#${u}m)`} />
      <rect x={26.5} y={4} width={11} height={3} rx={1.4} fill="#d63a2f" />
      <rect x={44} y={11} width={5} height={5} rx={1.2} fill={`url(#${u}m)`} transform="rotate(42 46.5 13.5)" />
      <circle cx={32} cy={35} r={20} fill={`url(#${u}m)`} />
      <circle cx={32} cy={35} r={16.5} fill={`url(#${u}f)`} />
      <path d="M32 35 L32 18.5 A16.5 16.5 0 0 1 47.3 29 Z" fill="#d63a2f" opacity={0.18} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return <line key={i} x1={32 + Math.sin(a) * 13.4} y1={35 - Math.cos(a) * 13.4} x2={32 + Math.sin(a) * 15.4} y2={35 - Math.cos(a) * 15.4} stroke="#39404a" strokeWidth={i % 3 ? 0.8 : 1.6} />;
      })}
      <path d="M32 35 L44 28" stroke="#d63a2f" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={32} cy={35} r={2} fill="#1d2126" />
      <ellipse cx={26} cy={26} rx={6.5} ry={3.2} fill="#fff" opacity={0.55} transform="rotate(-30 26 26)" />
    </>
  ),
  checklist: (u) => (
    <>
      <defs>
        {lin(`${u}b`, [[0, "#b07a45"], [1, "#6e4222"]], 0, 0, 1, 1)}
        {lin(`${u}c`, [[0, "#f5f7f9"], [0.5, "#a3abb4"], [1, "#5a626b"]])}
      </defs>
      {shadow(32, 59, 19)}
      <rect x={12} y={9} width={40} height={49} rx={4} fill={`url(#${u}b)`} />
      <rect x={16} y={15} width={32} height={39} rx={1.6} fill="#fffdf6" />
      <rect x={16} y={15} width={32} height={39} rx={1.6} fill="#000" opacity={0.04} />
      <path d="M24 5 H40 V12 Q40 16 36 16 H28 Q24 16 24 12 Z" fill={`url(#${u}c)`} />
      <circle cx={32} cy={8} r={1.8} fill="#4c535b" />
      {[24, 33, 42].map((y, i) => (
        <g key={y}>
          <rect x={20} y={y - 3} width={6} height={6} rx={1.4} fill={i < 2 ? "#2fbf71" : "#fff"} stroke={i < 2 ? "#1f8a50" : "#9aa3ad"} strokeWidth={0.9} />
          {i < 2 ? <path d={`M21.4 ${y} l1.6 1.6 l3 -3.2`} fill="none" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" /> : null}
          <rect x={29} y={y - 1.1} width={i === 1 ? 12 : 15} height={2.2} rx={1.1} fill="#9aa3ad" opacity={i < 2 ? 0.55 : 0.9} />
        </g>
      ))}
    </>
  ),
  foc: (u) => (
    <>
      <defs>
        {lin(`${u}f`, [[0, "#f5f7f9"], [0.5, "#a3abb4"], [1, "#4c535b"]], 0, 0, 1, 0)}
      </defs>
      {shadow(32, 58, 18)}
      <path d="M32 33 L24 52 H40 Z" fill={`url(#${u}f)`} />
      <rect x={20} y={51} width={24} height={4} rx={1.4} fill="#4c535b" />
      {arrow(u, 4, 31.5, 58, 31.5, "#2f7fd1", "a")}
      <circle cx={32} cy={31.5} r={2.6} fill="#f2c94c" stroke="#8a5a0e" strokeWidth={0.6} />
      <path d="M38 22 V27 M26 22 V27" stroke="#7cf0a8" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M26 24.5 H38" stroke="#7cf0a8" strokeWidth={1} strokeDasharray="1.4 1.2" />
      <text x={32} y={19} textAnchor="middle" fontSize={7} fontWeight={800} fill="#7cf0a8" fontFamily="system-ui">%</text>
    </>
  ),
  wrench: (u) => (
    <>
      <defs>
        {lin(`${u}w`, [[0, "#f5f7f9"], [0.45, "#a3abb4"], [1, "#4c535b"]], 0, 0, 1, 1)}
        {lin(`${u}s`, [[0, "#f4f1ea"], [1, "#c9c2ae"]])}
      </defs>
      {shadow(32, 58, 19)}
      <g fill="none" stroke={`url(#${u}s)`} strokeWidth={1.4}>
        <ellipse cx={22} cy={40} rx={13} ry={9} />
        <ellipse cx={22} cy={40} rx={10} ry={6.6} />
        <ellipse cx={22} cy={40} rx={7} ry={4.4} />
      </g>
      <g transform="rotate(45 38 26)">
        <rect x={35} y={20} width={6.5} height={34} rx={3} fill={`url(#${u}w)`} />
        <path d="M30.5 12 A8.5 8.5 0 1 0 46 12 L42.5 15 L38.2 13 L34 15 Z" fill={`url(#${u}w)`} />
        <rect x={36.5} y={24} width={1.4} height={26} rx={0.7} fill="#fff" opacity={0.45} />
        <circle cx={38.2} cy={48} r={1.6} fill="#4c535b" />
      </g>
    </>
  ),
  hold: (u) => (
    <>
      <defs>
        {lin(`${u}e`, [[0, "#ff7a6e"], [1, "#b8281e"]])}
        {lin(`${u}h`, [[0, "#4b525c"], [1, "#16191d"]])}
      </defs>
      {shadow(32, 58, 21)}
      <path d="M14 30 C22 40 42 40 50 30" fill="none" stroke={`url(#${u}e)`} strokeWidth={4.2} strokeLinecap="round" />
      <path d="M14 30 C22 22 42 22 50 30" fill="none" stroke={`url(#${u}e)`} strokeWidth={4.2} strokeLinecap="round" opacity={0.85} />
      <path d="M17 29 C24 24 40 24 47 29" fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={1} strokeLinecap="round" />
      <rect x={6} y={23} width={9} height={14} rx={3.2} fill={`url(#${u}h)`} />
      <rect x={49} y={23} width={9} height={14} rx={3.2} fill={`url(#${u}h)`} />
      <rect x={7.5} y={25} width={1.6} height={10} rx={0.8} fill="#fff" opacity={0.25} />
      <rect x={50.5} y={25} width={1.6} height={10} rx={0.8} fill="#fff" opacity={0.25} />
      <g transform="translate(32 49)">
        <circle r={7} fill="#f4f1ea" stroke="#4c535b" strokeWidth={1.4} />
        <path d="M0 0 V-4.6 M0 0 L3.4 2" stroke="#1d2126" strokeWidth={1.3} strokeLinecap="round" />
      </g>
    </>
  ),
  steps: (u) => (
    <>
      <defs>{lin(`${u}p`, [[0, "#ffffff"], [1, "#e3e8ee"]])}</defs>
      {shadow(32, 58, 19)}
      <rect x={11} y={8} width={42} height={48} rx={6} fill={`url(#${u}p)`} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx={20} cy={18 + i * 10.5} r={4.2} fill={["#2fbf71", "#2fbf71", "#f2c94c", "#cbd3db"][i]} />
          <text x={20} y={20.6 + i * 10.5} textAnchor="middle" fontSize={6} fontWeight={800} fill="#fff" fontFamily="system-ui">{i + 1}</text>
          <rect x={28} y={16.5 + i * 10.5} width={i === 2 ? 18 : 20} height={3} rx={1.5} fill="#9aa3ad" opacity={i < 2 ? 0.5 : 0.9} />
        </g>
      ))}
      <path d="M20 22.5v1.5M20 33v1.5M20 43.5v1.5" stroke="#cbd3db" strokeWidth={1.4} />
    </>
  ),
  lungs: (u) => (
    <>
      <defs>
        {rad(`${u}l`, [[0, "#ffb3c1"], [0.7, "#e05a78"], [1, "#a8304d"]], 0.4, 0.35, 0.8)}
        {lin(`${u}t`, [[0, "#f4f1ea"], [1, "#c9c2ae"]])}
      </defs>
      {shadow(32, 58, 19)}
      <circle cx={32} cy={32} r={27} fill="#7cc8ff" opacity={0.14} />
      <circle cx={32} cy={32} r={21} fill="#7cc8ff" opacity={0.12} />
      <path d="M29 17 C20 18 13 28 13 41 C13 49 18 51 23 49 C27 47 29 44 29 40 Z" fill={`url(#${u}l)`} />
      <path d="M35 17 C44 18 51 28 51 41 C51 49 46 51 41 49 C37 47 35 44 35 40 Z" fill={`url(#${u}l)`} />
      <path d="M32 7 V30 M32 26 L26 31 M32 26 L38 31" stroke={`url(#${u}t)`} strokeWidth={3.4} strokeLinecap="round" fill="none" />
      <ellipse cx={20} cy={30} rx={3} ry={6} fill="#fff" opacity={0.3} transform="rotate(20 20 30)" />
    </>
  ),
  scorecard: (u) => (
    <>
      <defs>{lin(`${u}p`, [[0, "#fffdf6"], [1, "#e9e3d2"]])}</defs>
      {shadow(32, 58, 19)}
      <rect x={10} y={7} width={40} height={50} rx={4} fill={`url(#${u}p)`} transform="rotate(-5 30 32)" />
      <g transform="rotate(-5 30 32)">
        <rect x={10} y={7} width={40} height={9} rx={4} fill="#b8508a" />
        {[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => (
          <text key={`${r}${c}`} x={19 + c * 11} y={26 + r * 8} textAnchor="middle" fontSize={6.5} fontWeight={700} fill={c === 0 && r === 0 ? "#d6912a" : "#39404a"} fontFamily="system-ui">{[[10, 9, 9], [8, 10, 7], [9, 9, 8], [10, 8, 9]][r][c]}</text>
        )))}
        <path d="M24.5 19 V52 M35.5 19 V52" stroke="#cbd3db" strokeWidth={0.7} />
      </g>
      <g transform="rotate(30 50 44)">
        <rect x={47} y={22} width={5} height={28} rx={2} fill="#2f7fd1" />
        <path d="M47 50 L49.5 56 L52 50 Z" fill="#f1d7a8" />
      </g>
    </>
  ),
  spine: (u) => (
    <>
      <defs>{lin(`${u}w`, [[0, "#f5f7f9"], [1, "#6d757e"]])}</defs>
      {shadow(32, 58, 22)}
      <rect x={6} y={44} width={10} height={10} rx={2} fill={`url(#${u}w)`} />
      <rect x={48} y={44} width={10} height={10} rx={2} fill={`url(#${u}w)`} />
      <path d="M11 44 Q32 54 53 44" fill="none" stroke="#1d2126" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M11 44 Q32 54 53 44" fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={0.8} />
      <rect x={29} y={12} width={6} height={20} rx={1} fill={`url(#${u}w)`} />
      <path d="M26 32 h12 l-6 9 z" fill="#f2c94c" />
      <text x={32} y={10} textAnchor="middle" fontSize={8} fontWeight={800} fill="#7cf0a8" fontFamily="system-ui">500</text>
    </>
  ),
  windsock: (u) => (
    <>
      <defs>
        {lin(`${u}p`, [[0, "#f1f3f5"], [1, "#6d757e"]], 0, 0, 1, 0)}
        {lin(`${u}s`, [[0, "#ff7a3a"], [1, "#d14a1a"]])}
      </defs>
      {shadow(18, 58, 10)}
      <rect x={14} y={8} width={3.2} height={50} rx={1.6} fill={`url(#${u}p)`} />
      <path d="M17 12 L52 17 L52 29 L17 32 Z" fill={`url(#${u}s)`} />
      <path d="M26 13.3 L26 30.6 M35 14.6 L35 29.8 M44 15.9 L44 29.2" stroke="#fff" strokeWidth={4} opacity={0.92} />
      <path d="M17 12 L52 17 L52 20 L17 17 Z" fill="#fff" opacity={0.22} />
      <g stroke="#9fe9ff" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.85}>
        <path d="M24 42 H44 C48 42 49 38 46 37" />
        <path d="M20 49 H50 C55 49 56 54 52 55" />
      </g>
    </>
  ),
  energy: (u) => (
    <>
      <defs>{lin(`${u}b`, [[0, "#fff1a8"], [0.5, "#f6c43a"], [1, "#c97a0e"]])}</defs>
      {shadow(32, 59, 15)}
      <circle cx={32} cy={32} r={24} fill="#f6c43a" opacity={0.14} />
      <path d="M36 4 L14 36 H29 L25 60 L50 26 H34 Z" fill={`url(#${u}b)`} stroke="#8a5a0e" strokeWidth={1} strokeLinejoin="round" />
      <path d="M34 8 L18 34 H22 Z" fill="#fff" opacity={0.45} />
    </>
  ),
  span: (u) => (
    <>
      <defs>
        {rad(`${u}s`, [[0, "#ffe0c4"], [1, "#c48a5c"]], 0.4, 0.35, 0.7)}
        {lin(`${u}b`, [[0, "#8f6ef0"], [1, "#4a2fa6"]])}
      </defs>
      {shadow(32, 59, 12)}
      <path d="M6 22 H58" stroke={`url(#${u}b)`} strokeWidth={5} strokeLinecap="round" />
      <path d="M26 22 H38 V40 H26 Z" fill={`url(#${u}b)`} />
      <path d="M27 40 L24 58 M37 40 L40 58" stroke="#2a2f36" strokeWidth={4.5} strokeLinecap="round" />
      <circle cx={32} cy={13} r={6.5} fill={`url(#${u}s)`} />
      <circle cx={6} cy={22} r={2.6} fill={`url(#${u}s)`} />
      <circle cx={58} cy={22} r={2.6} fill={`url(#${u}s)`} />
      <path d="M6 30 H58" stroke="#7cf0a8" strokeWidth={1.2} strokeDasharray="2 2" />
      <path d="M6 27 V33 M58 27 V33" stroke="#7cf0a8" strokeWidth={1.4} />
    </>
  ),
  bareshaft: (u) => (
    <>
      <defs>{lin(`${u}f`, [[0, "#e8d9b5"], [1, "#b49a62"]])}</defs>
      {shadow(32, 59, 21)}
      <rect x={8} y={8} width={48} height={48} rx={5} fill={`url(#${u}f)`} />
      <path d="M8 18 H56 M8 30 H56 M8 42 H56" stroke="#8a6a3a" strokeWidth={0.6} opacity={0.4} />
      {target(u, 32, 32, 17)}
      {[[27, 29], [29, 34], [25, 33]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.8} fill="#1d2126" stroke="#f2c94c" strokeWidth={0.8} />)}
      <circle cx={40} cy={24} r={2.1} fill="#1d2126" stroke="#fff" strokeWidth={1} />
      <path d="M40 24 L46 18" stroke="#7cf0a8" strokeWidth={1.4} strokeLinecap="round" />
    </>
  ),
  caliper: (u) => (
    <>
      <defs>{lin(`${u}m`, [[0, "#f5f7f9"], [0.5, "#a3abb4"], [1, "#4c535b"]], 0, 0, 1, 1)}</defs>
      {shadow(32, 58, 21)}
      <rect x={8} y={14} width={50} height={9} rx={1.5} fill={`url(#${u}m)`} />
      {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${14 + i * 2.6} 14 v${i % 5 ? 3 : 5}`} stroke="#39404a" strokeWidth={0.7} />)}
      <path d="M8 14 H15 V52 L11 56 L8 52 Z" fill={`url(#${u}m)`} />
      <path d="M33 10 H42 V23 H40 V48 L37 52 L34 48 V23 H33 Z" fill={`url(#${u}m)`} />
      <rect x={34.5} y={16} width={6} height={4} rx={0.8} fill="#2a2f35" />
      <path d="M15 34 H34" stroke="#7cf0a8" strokeWidth={1.2} strokeDasharray="1.6 1.4" />
    </>
  ),
  ruler: (u) => (
    <>
      <defs>{lin(`${u}r`, [[0, "#ffe68a"], [1, "#d29a1e"]])}</defs>
      {shadow(32, 56, 22)}
      <g transform="rotate(-18 32 32)">
        <rect x={4} y={24} width={56} height={16} rx={2} fill={`url(#${u}r)`} />
        {Array.from({ length: 13 }, (_, i) => <path key={i} d={`M${8 + i * 4} 24 v${i % 2 ? 4 : 7}`} stroke="#6e4a0c" strokeWidth={0.9} />)}
        <rect x={4} y={24} width={56} height={3} rx={1.5} fill="#fff" opacity={0.3} />
        <text x={14} y={37} fontSize={5.5} fontWeight={800} fill="#6e4a0c" fontFamily="system-ui">cm</text>
        <text x={44} y={37} fontSize={5.5} fontWeight={800} fill="#6e4a0c" fontFamily="system-ui">in</text>
      </g>
      <path d="M22 12 H42 M38 8 L42 12 L38 16 M26 52 H46 M30 48 L26 52 L30 56" stroke="#9fe9ff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  daily: (u) => (
    <>
      <defs>
        {lin(`${u}p`, [[0, "#ffffff"], [1, "#e3e8ee"]])}
        {lin(`${u}h`, [[0, "#ff9a5c"], [1, "#d14a1a"]])}
        {lin(`${u}g`, [[0, "#fff1a8"], [1, "#e0a21a"]])}
      </defs>
      {shadow(32, 58, 20)}
      <rect x={10} y={12} width={44} height={43} rx={6} fill={`url(#${u}p)`} />
      <path d="M10 18 Q10 12 16 12 H48 Q54 12 54 18 V23 H10 Z" fill={`url(#${u}h)`} />
      <rect x={20} y={8} width={3.2} height={9} rx={1.6} fill="#7d858f" />
      <rect x={41} y={8} width={3.2} height={9} rx={1.6} fill="#7d858f" />
      <path d="M32 27 l3.6 7.3 8 1.2 -5.8 5.6 1.4 8 -7.2-3.8 -7.2 3.8 1.4-8 -5.8-5.6 8-1.2z" fill={`url(#${u}g)`} stroke="#b07a14" strokeWidth={0.8} />
    </>
  ),
  quiz: (u) => (
    <>
      <defs>{lin(`${u}b`, [[0, "#8fa2ff"], [1, "#3b4fb8"]])}</defs>
      {shadow(32, 58, 18)}
      <path d="M10 12 H54 Q58 12 58 16 V40 Q58 44 54 44 H28 L16 54 V44 H10 Q6 44 6 40 V16 Q6 12 10 12 Z" fill={`url(#${u}b)`} />
      <path d="M10 13 H54 Q57 13 57 16 V20 H7 V16 Q7 13 10 13 Z" fill="#fff" opacity={0.15} />
      <text x={32} y={37} textAnchor="middle" fontSize={22} fontWeight={900} fill="#fff" fontFamily="system-ui">?</text>
      <circle cx={52} cy={12} r={6} fill="#2fbf71" stroke="#fff" strokeWidth={1.4} />
      <path d="M49.5 12 l1.8 1.8 3.2-3.4" stroke="#fff" strokeWidth={1.5} fill="none" strokeLinecap="round" />
    </>
  ),
  binoculars: (u) => (
    <>
      <defs>
        {lin(`${u}b`, [[0, "#4b525c"], [1, "#16191d"]])}
        {rad(`${u}g`, [[0, "#9fd0ff"], [0.6, "#2459b5"], [1, "#07152b"]], 0.4, 0.35, 0.6)}
      </defs>
      {shadow(32, 58, 22)}
      <rect x={10} y={16} width={16} height={24} rx={5} fill={`url(#${u}b)`} />
      <rect x={38} y={16} width={16} height={24} rx={5} fill={`url(#${u}b)`} />
      <rect x={26} y={22} width={12} height={9} rx={2} fill="#2a2f35" />
      <circle cx={18} cy={44} r={10} fill={`url(#${u}b)`} />
      <circle cx={46} cy={44} r={10} fill={`url(#${u}b)`} />
      <circle cx={18} cy={44} r={7} fill={`url(#${u}g)`} />
      <circle cx={46} cy={44} r={7} fill={`url(#${u}g)`} />
      <ellipse cx={15.5} cy={41.5} rx={2.4} ry={1.5} fill="#fff" opacity={0.7} />
      <ellipse cx={43.5} cy={41.5} rx={2.4} ry={1.5} fill="#fff" opacity={0.7} />
    </>
  ),
  book: (u) => (
    <>
      <defs>
        {lin(`${u}c`, [[0, "#b07a45"], [1, "#5b3518"]])}
        {lin(`${u}p`, [[0, "#fffdf6"], [1, "#e6dfcc"]], 0, 0, 1, 0)}
      </defs>
      {shadow(32, 58, 22)}
      <path d="M6 14 Q18 10 31 15 V54 Q18 49 6 53 Z" fill={`url(#${u}p)`} />
      <path d="M58 14 Q46 10 33 15 V54 Q46 49 58 53 Z" fill={`url(#${u}p)`} />
      <path d="M6 53 Q18 49 31 54 L32 56 L33 54 Q46 49 58 53 V56 Q46 52 33 57 H31 Q18 52 6 56 Z" fill={`url(#${u}c)`} />
      {[22, 28, 34, 40].map((y) => <path key={y} d={`M11 ${y} Q19 ${y - 2} 27 ${y + 1} M37 ${y + 1} Q45 ${y - 2} 53 ${y}`} stroke="#9aa3ad" strokeWidth={0.9} fill="none" />)}
      <path d="M44 8 V22 L47 19 L50 22 V8 Z" fill="#d63a2f" />
    </>
  ),
  target: (u) => (
    <>
      {shadow(32, 59, 18)}
      {target(u, 32, 31, 25)}
      {arrow(u, 52, 12, 34, 29, "#2f7fd1", "a", false)}
    </>
  ),
  sight3: (u) => (
    <>
      <defs>
        {lin(`${u}m`, [[0, "#f5f7f9"], [0.5, "#a3abb4"], [1, "#4c535b"]], 0, 0, 1, 1)}
        {rad(`${u}g`, [[0, "#d9f0ff", 0.5], [1, "#2459b5", 0.25]], 0.4, 0.35, 0.6)}
      </defs>
      {shadow(32, 58, 18)}
      <rect x={6} y={30} width={34} height={5} rx={2} fill="#1d2126" />
      <rect x={8} y={18} width={5} height={30} rx={2} fill={`url(#${u}m)`} />
      {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M13 ${21 + i * 3.6} h2`} stroke="#2a2f35" strokeWidth={0.8} />)}
      <circle cx={46} cy={32} r={13} fill={`url(#${u}m)`} />
      <circle cx={46} cy={32} r={10} fill="#0b0d10" />
      <circle cx={46} cy={32} r={9} fill={`url(#${u}g)`} />
      <circle cx={46} cy={32} r={1.8} fill="#e3a21a" />
      <path d="M46 23 v5 M46 36 v5" stroke="#e3a21a" strokeWidth={0.8} />
      <ellipse cx={42} cy={27.5} rx={3} ry={1.6} fill="#fff" opacity={0.55} transform="rotate(-35 42 27.5)" />
    </>
  ),
  rules: (u) => (
    <>
      {shadow(32, 58, 18)}
      {target(u, 32, 30, 22)}
      <g fontFamily="system-ui" fontWeight={800} textAnchor="middle">
        <rect x={20} y={46} width={24} height={11} rx={3} fill="#1d2126" stroke="#f2c94c" strokeWidth={1} />
        <text x={32} y={54.5} fontSize={7.5} fill="#f2c94c">70 m</text>
      </g>
    </>
  ),
};

export function hasRealIcon(name: string) {
  return name in DRAW;
}

export function RealIcon({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  const draw = DRAW[name];
  if (!draw) return null;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      {draw(u)}
    </svg>
  );
}
