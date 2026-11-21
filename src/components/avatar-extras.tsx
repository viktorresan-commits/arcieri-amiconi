/**
 * Dettagli in più dell'avatar: fantasie degli abiti, stemmi, pitture e tatuaggi,
 * orecchini, ornamenti dei capelli, decorazioni dell'arco, penne, faretre, occhi, labbra,
 * orecchie, età, segni particolari, fibbie, borselli, fermagli e fantasie del mantello,
 * cornici della foto profilo. Tutto disegnato in SVG, in coordinate locali.
 */
import type { ReactNode } from "react";
import type { AvatarLook } from "@/lib/arcieri/avatar";

const f = (n: number) => n.toFixed(1);

export function shadeHex(hex: string, amt: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = Number.parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* ---------------- fantasie degli abiti ---------------- */

/** fantasia della veste, ritagliata sulla sagoma degli abiti (uno o più tracciati) */
export function ClothPattern({ kind, shapes, base, trim, uid, box }: { kind: string; shapes: string[]; base: string; trim: string; uid: string; box: [number, number, number, number] }) {
  if (!kind || kind === "nessuno") return null;
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0;
  const h = y1 - y0;
  const id = `${uid}pt${kind}`;
  const dark = shadeHex(base, -0.35);
  const light = shadeHex(base, 0.3);
  let fill: ReactNode = null;
  let tile: ReactNode = null;
  switch (kind) {
    case "righe":
      tile = <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="3" fill={trim} opacity="0.55" /></pattern>;
      break;
    case "righe-verticali":
      tile = <pattern id={id} width="7" height="8" patternUnits="userSpaceOnUse"><rect width="2.4" height="8" fill={trim} opacity="0.5" /></pattern>;
      break;
    case "quadri":
      tile = <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse"><rect width="5" height="10" fill={dark} opacity="0.35" /><rect width="10" height="5" fill={dark} opacity="0.35" /></pattern>;
      break;
    case "scozzese":
      tile = (
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="6" fill={dark} opacity="0.45" />
          <rect width="6" height="16" fill={dark} opacity="0.45" />
          <rect y="10" width="16" height="1.2" fill={trim} opacity="0.85" />
          <rect x="10" width="1.2" height="16" fill={trim} opacity="0.85" />
        </pattern>
      );
      break;
    case "pois":
      tile = <pattern id={id} width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.4" fill={trim} opacity="0.8" /><circle cx="7" cy="7" r="1.4" fill={trim} opacity="0.8" /></pattern>;
      break;
    case "rombi":
      tile = <pattern id={id} width="12" height="14" patternUnits="userSpaceOnUse"><path d="M6 0 L12 7 L6 14 L0 7 Z" fill={trim} opacity="0.4" /></pattern>;
      break;
    case "chevron":
      tile = <pattern id={id} width="10" height="8" patternUnits="userSpaceOnUse"><path d="M0 6 L5 2 L10 6" stroke={dark} strokeWidth="1.6" fill="none" opacity="0.6" /></pattern>;
      break;
    case "mimetico":
      fill = (
        <g>
          {Array.from({ length: 18 }, (_, i) => {
            const rx = 5 + ((i * 7) % 6);
            return <ellipse key={i} cx={x0 + ((i * 37) % 100) / 100 * w} cy={y0 + ((i * 53) % 100) / 100 * h} rx={rx} ry={rx * 0.6} transform={`rotate(${(i * 41) % 180} ${x0 + ((i * 37) % 100) / 100 * w} ${y0 + ((i * 53) % 100) / 100 * h})`} fill={[dark, light, "#3a3a2a"][i % 3]} opacity="0.55" />;
          })}
        </g>
      );
      break;
    case "ricamo":
      fill = (
        <g>
          {[y0 + 8, y1 - 6].map((y) => (
            <g key={y}>
              <path d={`M${x0} ${y} H${x1}`} stroke={trim} strokeWidth="2.4" />
              {Array.from({ length: Math.ceil(w / 7) }, (_, i) => <circle key={i} cx={x0 + 3.5 + i * 7} cy={y + 3.6} r="1.3" fill={trim} />)}
              {Array.from({ length: Math.ceil(w / 7) }, (_, i) => <path key={`l${i}`} d={`M${x0 + 3.5 + i * 7} ${y - 1.5} l-2 -3 m2 3 l2 -3`} stroke={trim} strokeWidth="0.8" />)}
            </g>
          ))}
        </g>
      );
      break;
    case "bordure":
      fill = <g><rect x={x0} y={y1 - 10} width={w} height="5" fill={trim} /><rect x={x0} y={y1 - 3.6} width={w} height="1.6" fill={trim} /><rect x={x0} y={y0} width={w} height="4" fill={trim} opacity="0.8" /></g>;
      break;
    case "fasce":
      fill = <g><rect x={x0} y={y0 + h * 0.32} width={w} height={h * 0.12} fill={trim} opacity="0.85" /><rect x={x0} y={y0 + h * 0.5} width={w} height={h * 0.05} fill={trim} opacity="0.85" /></g>;
      break;
    case "sfumata":
      tile = (
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} stopOpacity="0.55" />
          <stop offset="1" stopColor={dark} stopOpacity="0.7" />
        </linearGradient>
      );
      break;
    default:
      return null;
  }
  return (
    <g>
      <defs>
        <clipPath id={`${id}c`}>{shapes.map((d, i) => <path key={i} d={d} />)}</clipPath>
        {tile}
      </defs>
      <g clipPath={`url(#${id}c)`}>{tile ? <rect x={x0} y={y0} width={w} height={h} fill={`url(#${id})`} /> : fill}</g>
    </g>
  );
}

/* ---------------- stemmi ---------------- */

/** stemma ricamato: forma nel riquadro -10..10 */
export function EmblemGlyph({ kind, color, bg }: { kind: string; color: string; bg?: string }) {
  const s = { fill: color };
  const st = { stroke: color, strokeWidth: 1.6, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let g: ReactNode = null;
  switch (kind) {
    case "cervo":
      g = <g><path d="M-3 -2 C-3 4 -1 8 0 9 C1 8 3 4 3 -2 C2 -4 -2 -4 -3 -2 Z" {...s} /><path d="M-3 -3 L-7 -9 M-5 -6 L-9 -6 M3 -3 L7 -9 M5 -6 L9 -6 M-6 -8 L-6 -11 M6 -8 L6 -11" {...st} /></g>;
      break;
    case "lupo":
      g = <path d="M-8 -8 L-4 -3 L4 -3 L8 -8 L7 1 L3 6 L0 9 L-3 6 L-7 1 Z" {...s} />;
      break;
    case "drago":
      g = <g><path d="M-8 6 C-4 8 2 4 0 0 C-2 -4 4 -8 8 -6 C5 -4 4 -1 6 2 C8 6 2 10 -4 9 Z" {...s} /><path d="M-2 -1 L-8 -8 L-1 -5 Z" {...s} /></g>;
      break;
    case "freccia":
      g = <g><path d="M-8 8 L8 -8" {...st} /><path d="M8 -8 L2 -7 L7 -2 Z" {...s} /><path d="M-8 8 L-9 3 M-8 8 L-3 9 M-6 6 L-7 1 M-6 6 L-1 7" {...st} strokeWidth={1.2} /></g>;
      break;
    case "bersaglio":
      g = <g><circle r="9" {...st} /><circle r="5.6" {...st} /><circle r="2.2" {...s} /></g>;
      break;
    case "giglio":
      g = <g><path d="M0 -9 C3 -5 3 -1 0 3 C-3 -1 -3 -5 0 -9 Z M0 3 C-2 -2 -8 -3 -8 2 C-6 0 -3 1 -1 4 Z M0 3 C2 -2 8 -3 8 2 C6 0 3 1 1 4 Z" {...s} /><rect x="-5" y="3.5" width="10" height="2.2" {...s} /><path d="M-1 6 L0 9 L1 6 Z" {...s} /></g>;
      break;
    case "stella":
      g = <path d="M0 -9 L2.6 -3 L9 -2.8 L4 1.4 L5.6 8 L0 4.4 L-5.6 8 L-4 1.4 L-9 -2.8 L-2.6 -3 Z" {...s} />;
      break;
    case "scudo":
      g = <g><path d="M-8 -8 H8 V0 C8 5 4 8 0 9.5 C-4 8 -8 5 -8 0 Z" {...s} /><path d="M0 -8 V9 M-8 -1 H8" stroke={bg ?? "#000"} strokeWidth="1.4" opacity="0.5" /></g>;
      break;
    case "quercia":
      g = <g><path d="M0 9 C-1 4 -6 4 -7 0 C-4 0 -7 -4 -4 -5 C-3 -3 -1 -9 0 -9 C1 -9 3 -3 4 -5 C7 -4 4 0 7 0 C6 4 1 4 0 9 Z" {...s} /><path d="M0 9 V-7" stroke={bg ?? "#000"} strokeWidth="0.8" opacity="0.5" /></g>;
      break;
    case "aquila":
      g = <path d="M0 -6 C2 -6 3 -4 2 -2 L9 -6 L7 -1 L10 0 L5 2 L3 7 L0 9 L-3 7 L-5 2 L-10 0 L-7 -1 L-9 -6 L-2 -2 C-3 -4 -2 -6 0 -6 Z" {...s} />;
      break;
    case "falco":
      g = <path d="M-9 -2 C-4 -6 2 -4 4 -2 L9 -4 L6 0 L8 3 L3 2 C2 6 -2 9 -6 8 C-2 5 -2 2 -4 0 Z" {...s} />;
      break;
    case "leone":
      g = <g><circle r="8.5" {...s} /><circle r="5.2" fill={bg ?? "#000"} opacity="0.35" /><path d="M-2 -1 h1 M1 -1 h1 M-1.5 2 Q0 3.4 1.5 2" stroke={bg ?? "#000"} strokeWidth="1" /></g>;
      break;
    case "croce":
      g = <path d="M-2.2 -9 H2.2 V-2.2 H9 V2.2 H2.2 V9 H-2.2 V2.2 H-9 V-2.2 H-2.2 Z" {...s} />;
      break;
    case "sole":
      g = <g><circle r="4.6" {...s} />{Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return <path key={i} d={`M${f(Math.cos(a) * 6)} ${f(Math.sin(a) * 6)} L${f(Math.cos(a) * 9.4)} ${f(Math.sin(a) * 9.4)}`} {...st} strokeWidth={1.3} />; })}</g>;
      break;
    case "luna":
      g = <path d="M3 -8.6 A9 9 0 1 0 3 8.6 A7 7 0 1 1 3 -8.6 Z" {...s} />;
      break;
    case "corona":
      g = <g><path d="M-9 5 L-9 -5 L-4.5 0 L0 -7 L4.5 0 L9 -5 L9 5 Z" {...s} /><rect x="-9" y="5" width="18" height="2.6" {...s} /></g>;
      break;
    default:
      return null;
  }
  return g;
}

/** stemma cucito sulla veste, su una toppa */
export function ChestEmblem({ kind, x, y, s = 1, base, trim }: { kind: string; x: number; y: number; s?: number; base: string; trim: string }) {
  if (!kind || kind === "nessuno") return null;
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${s})`}>
      <path d="M-11 -11 H11 V2 C11 8 5 11 0 13 C-5 11 -11 8 -11 2 Z" fill={shadeHex(base, -0.3)} stroke={trim} strokeWidth="1.4" />
      <g transform="scale(0.82)">
        <EmblemGlyph kind={kind} color={trim} bg={shadeHex(base, -0.3)} />
      </g>
    </g>
  );
}

/* ---------------- viso di fronte (foto profilo e figura di fronte) ---------------- */

/** pitture sul viso di fronte: occhi in (41, ey) e (59, ey), viso centrato su 50 */
export function FacePaintFront({ kind, ey, fy, rx, color }: { kind: string; ey: number; fy: number; rx: number; color: string }) {
  const st = { stroke: color, strokeLinecap: "round" as const, fill: "none" };
  switch (kind) {
    case "strisce":
      return <g {...st} strokeWidth="2.2" opacity="0.85">{[0, 4, 8].map((d) => <path key={d} d={`M${32 - d * 0.3} ${ey + 5 + d} L${42} ${ey + 6 + d} M${68 + d * 0.3} ${ey + 5 + d} L${58} ${ey + 6 + d}`} />)}</g>;
    case "maschera":
      return <path d={`M${50 - rx + 2} ${ey - 4} C40 ${ey - 8} 60 ${ey - 8} ${50 + rx - 2} ${ey - 4} L${50 + rx - 3} ${ey + 5} C58 ${ey + 7} 52 ${ey + 3} 50 ${ey + 5} C48 ${ey + 3} 42 ${ey + 7} ${50 - rx + 3} ${ey + 5} Z`} fill={color} opacity="0.75" />;
    case "punti":
      return <g fill={color} opacity="0.9">{[[35, 6], [38, 9], [41, 6], [59, 6], [62, 9], [65, 6], [50, -12], [47, -10], [53, -10]].map(([x, d]) => <circle key={`${x}${d}`} cx={x} cy={ey + d} r="1.2" />)}</g>;
    case "tribale":
      return <g {...st} strokeWidth="1.6" opacity="0.9"><path d={`M50 ${ey - 14} L50 ${ey - 6} M44 ${ey - 12} L50 ${ey - 8} L56 ${ey - 12}`} /><path d={`M33 ${ey + 6} q4 4 8 0 q-4 6 -8 4 M67 ${ey + 6} q-4 4 -8 0 q4 6 8 4`} /></g>;
    case "fulmine":
      return <path d={`M56 ${ey - 14} L52 ${ey - 3} L57 ${ey - 3} L51 ${ey + 12} L53 ${ey + 1} L48 ${ey + 1} Z`} fill={color} opacity="0.9" />;
    case "mezza":
      return <path d={`M50 ${fy - 22} C${50 + rx * 1.2} ${fy - 22} ${50 + rx * 1.1} ${fy + 20} 50 ${fy + 22} Z`} fill={color} opacity="0.45" />;
    case "naso":
      return <path d={`M50 ${ey - 12} V${ey + 10}`} {...st} strokeWidth="2.6" opacity="0.85" />;
    case "guance":
      return <g fill={color} opacity="0.7"><circle cx="36" cy={ey + 8} r="3.4" /><circle cx="64" cy={ey + 8} r="3.4" /></g>;
    case "volpe":
      return <g fill={color} opacity="0.65"><path d={`M${50 - rx} ${ey + 2} L42 ${ey + 4} L${50 - rx + 3} ${ey + 14} Z M${50 + rx} ${ey + 2} L58 ${ey + 4} L${50 + rx - 3} ${ey + 14} Z`} /><path d={`M47 ${ey + 9} L50 ${ey + 13} L53 ${ey + 9} Z`} fill="#1b130d" /></g>;
    case "lupo":
      return <g {...st} strokeWidth="1.8" opacity="0.85"><path d={`M33 ${ey - 9} L40 ${ey - 4} M67 ${ey - 9} L60 ${ey - 4} M34 ${ey + 8} L42 ${ey + 7} M34 ${ey + 12} L42 ${ey + 10} M66 ${ey + 8} L58 ${ey + 7} M66 ${ey + 12} L58 ${ey + 10}`} /></g>;
    default:
      return null;
  }
}

/** pitture sul viso di profilo: occhio intorno a (163, 82), guancia (163, 93) */
export function FacePaintProfile({ kind, color }: { kind: string; color: string }) {
  const st = { stroke: color, strokeLinecap: "round" as const, fill: "none" };
  switch (kind) {
    case "strisce":
      return <g {...st} strokeWidth="1.8" opacity="0.85">{[0, 3.6, 7.2].map((d) => <path key={d} d={`M152 ${88 + d} L166 ${90 + d}`} />)}</g>;
    case "maschera":
      return <path d="M150 78 C156 74 166 74 171 78 L171 86 C165 88 157 88 150 86 Z" fill={color} opacity="0.7" />;
    case "punti":
      return <g fill={color} opacity="0.9">{[[155, 90], [159, 92], [163, 90], [160, 70], [164, 71]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.1" />)}</g>;
    case "tribale":
      return <g {...st} strokeWidth="1.4" opacity="0.9"><path d="M156 66 L166 72 M154 90 q5 4 10 0 q-5 6 -10 4" /></g>;
    case "fulmine":
      return <path d="M166 66 L162 76 L167 76 L161 92 L163 80 L158 80 Z" fill={color} opacity="0.9" />;
    case "mezza":
      return <path d="M150 64 C162 62 172 70 173 82 L176 96 C172 102 160 104 150 100 Z" fill={color} opacity="0.4" />;
    case "naso":
      return <path d="M172 78 L177 93" {...st} strokeWidth="2.2" opacity="0.85" />;
    case "guance":
      return <circle cx="161" cy="93" r="3.6" fill={color} opacity="0.65" />;
    case "volpe":
      return <path d="M150 84 L160 88 L152 98 Z" fill={color} opacity="0.6" />;
    case "lupo":
      return <g {...st} strokeWidth="1.5" opacity="0.85"><path d="M152 72 L160 76 M152 90 L162 89 M152 94 L162 92" /></g>;
    default:
      return null;
  }
}

/* ---------------- orecchini ---------------- */

export function Earring({ kind, x, y }: { kind: string; x: number; y: number }) {
  const gold = "#d9b45a";
  switch (kind) {
    case "perla":
      return <g><circle cx={x} cy={y} r="1.9" fill="#f6f2ea" stroke="#c9bfae" strokeWidth="0.4" /><circle cx={x - 0.6} cy={y - 0.6} r="0.6" fill="#fff" /></g>;
    case "pendente":
      return <g><path d={`M${x} ${y - 1} V${y + 4}`} stroke={gold} strokeWidth="0.7" /><path d={`M${x} ${y + 3.6} l2.2 3 l-2.2 3 l-2.2 -3 Z`} fill="#2f9e7a" stroke={gold} strokeWidth="0.6" /></g>;
    case "piuma":
      return <g><path d={`M${x} ${y} V${y + 2}`} stroke={gold} strokeWidth="0.6" /><path d={`M${x} ${y + 2} C${x + 2.4} ${y + 5} ${x + 1.6} ${y + 10} ${x} ${y + 12} C${x - 1.6} ${y + 10} ${x - 2.4} ${y + 5} ${x} ${y + 2} Z`} fill="#f4f1ea" stroke="#b9ae98" strokeWidth="0.4" /></g>;
    case "doppio":
      return <g fill="none" stroke={gold} strokeWidth="0.9"><circle cx={x} cy={y} r="1.6" /><circle cx={x - 0.8} cy={y - 3.6} r="1.1" /></g>;
    case "croce":
      return <path d={`M${x - 0.6} ${y} h1.2 v1.6 h1.6 v1.2 h-1.6 v3 h-1.2 v-3 h-1.6 v-1.2 h1.6 Z`} fill={gold} />;
    case "zanna":
      return <g><path d={`M${x} ${y} V${y + 1.4}`} stroke="#6b4224" strokeWidth="0.8" /><path d={`M${x - 1.2} ${y + 1.4} Q${x} ${y + 8} ${x + 1.6} ${y + 1.4} Z`} fill="#f2ead8" stroke="#b9ae98" strokeWidth="0.4" /></g>;
    default:
      return <circle cx={x} cy={y} r="1.8" fill="none" stroke={gold} strokeWidth="1" />;
  }
}

/* ---------------- ornamenti dei capelli ---------------- */

export function HairOrnament({ kind, x, y, s = 1, tilt = 0, color }: { kind: string; x: number; y: number; s?: number; tilt?: number; color: string }) {
  const body = (() => {
    switch (kind) {
      case "perline":
        return <g>{[0, 1, 2, 3].map((i) => <circle key={i} cx={0} cy={i * 3.2} r="1.4" fill={["#d9b45a", "#2f9e7a", "#c4473d", "#2f6fbe"][i]} />)}<path d="M0 -2 V10" stroke="#3a2a1e" strokeWidth="0.4" /></g>;
      case "fermaglio":
        return <g><rect x="-4.5" y="-1.8" width="9" height="3.6" rx="1.4" fill="#d9b45a" /><circle cx="0" cy="0" r="1.1" fill="#c4473d" /></g>;
      case "nastro":
        return <g fill={color}><path d="M0 0 L-5 -3.4 L-5 3.4 Z M0 0 L5 -3.4 L5 3.4 Z" /><path d="M-1 0 L-3 8 M1 0 L3 8" stroke={color} strokeWidth="1.4" /><circle r="1.3" /></g>;
      case "fiori":
        return <g>{[[-3, 0, "#ff8fa3"], [2.6, -2, "#ffd166"], [2, 3, "#f4f1ea"]].map(([fx, fy, c]) => <g key={`${fx}`}>{[0, 1, 2, 3, 4].map((k) => <circle key={k} cx={Number(fx) + Math.cos((k / 5) * 6.28) * 1.4} cy={Number(fy) + Math.sin((k / 5) * 6.28) * 1.4} r="1.1" fill={String(c)} />)}<circle cx={Number(fx)} cy={Number(fy)} r="0.7" fill="#e6b325" /></g>)}</g>;
      case "piume":
        return <g>{[-14, 12].map((r) => <g key={r} transform={`rotate(${r})`}><path d="M0 0 C2.4 -4 2.4 -10 0 -14 C-2.4 -10 -2.4 -4 0 0 Z" fill={r < 0 ? "#f4f1ea" : "#8a5a2a"} stroke="#6b5a48" strokeWidth="0.4" /><path d="M0 0 V-13" stroke="#6b5a48" strokeWidth="0.4" /></g>)}</g>;
      case "anelli":
        return <g fill="none" stroke="#d9b45a" strokeWidth="1.1">{[0, 3.4, 6.8].map((d) => <ellipse key={d} cx="0" cy={d} rx="2.4" ry="1.1" />)}</g>;
      case "filo":
        return <path d="M-6 -2 Q-2 2 0 -1 Q2 -4 6 0 Q2 4 -1 3" stroke="#e8c870" strokeWidth="0.9" fill="none" />;
      case "pettine":
        return <g><path d="M-6 -2 Q0 -5 6 -2 L6 0 L-6 0 Z" fill="#c9a46a" />{[-5, -3, -1, 1, 3, 5].map((dx) => <path key={dx} d={`M${dx} 0 V3.4`} stroke="#a3824e" strokeWidth="0.9" />)}</g>;
      default:
        return null;
    }
  })();
  if (!body) return null;
  return <g transform={`translate(${f(x)} ${f(y)}) rotate(${tilt}) scale(${s})`}>{body}</g>;
}

/* ---------------- faretre ---------------- */

/** corpo della faretra (centro 0, da y -42 a 40) */
export function QuiverBody({ kind, color, w = 20, h = 82, top = -42 }: { kind: string; color: string; w?: number; h?: number; top?: number }) {
  const x = -w / 2;
  const dark = shadeHex(color, -0.4);
  const light = shadeHex(color, 0.3);
  switch (kind) {
    case "tubo":
      return (
        <g>
          <rect x={x} y={top} width={w} height={h} rx={w / 2.6} fill="#1d2126" />
          <rect x={x + 2} y={top} width={3} height={h} rx="1.5" fill="#fff" opacity="0.12" />
          <rect x={x - 1} y={top - 2} width={w + 2} height="8" rx="3" fill={color} />
          <rect x={x - 1} y={top + h - 10} width={w + 2} height="10" rx="4" fill={color} />
          <rect x={x + w - 4} y={top + h * 0.4} width="5" height="12" rx="1.5" fill="#9aa3ad" />
        </g>
      );
    case "cestino":
      return (
        <g>
          <rect x={x} y={top} width={w} height={h} rx="6" fill={light} stroke={dark} strokeWidth="1.2" />
          {Array.from({ length: Math.floor(h / 6) }, (_, i) => <path key={i} d={`M${x} ${top + 3 + i * 6} q${w / 4} 3 ${w / 2} 0 q${w / 4} -3 ${w / 2} 0`} stroke={dark} strokeWidth="0.9" fill="none" opacity="0.8" />)}
          {[-w / 4, 0, w / 4].map((dx) => <path key={dx} d={`M${dx} ${top} V${top + h}`} stroke={dark} strokeWidth="0.7" opacity="0.6" />)}
        </g>
      );
    case "legno":
      return (
        <g>
          <rect x={x} y={top} width={w} height={h} rx="4" fill={color} stroke={dark} strokeWidth="1.2" />
          {[-5, -1, 3, 6].map((dx, i) => <path key={dx} d={`M${dx} ${top + 4} C${dx + 2} ${top + h * 0.3} ${dx - 2} ${top + h * 0.6} ${dx + (i % 2 ? 1 : -1)} ${top + h - 4}`} stroke={dark} strokeWidth="0.7" fill="none" opacity="0.7" />)}
          <rect x={x - 1} y={top + h * 0.3} width={w + 2} height="3" fill="#6b737c" />
          <rect x={x - 1} y={top + h * 0.7} width={w + 2} height="3" fill="#6b737c" />
        </g>
      );
    case "stoffa":
      return (
        <g>
          <path d={`M${x} ${top} H${x + w} C${x + w + 2} ${top + h * 0.5} ${x + w - 1} ${top + h * 0.8} ${x + w - 3} ${top + h} H${x + 3} C${x + 1} ${top + h * 0.8} ${x - 2} ${top + h * 0.5} ${x} ${top} Z`} fill={color} stroke={dark} strokeWidth="1.1" />
          {[0.25, 0.5, 0.75].map((u) => <path key={u} d={`M${x + w * u} ${top + 4} Q${x + w * u + 2} ${top + h / 2} ${x + w * u} ${top + h - 4}`} stroke={dark} strokeWidth="0.8" fill="none" opacity="0.6" />)}
          <path d={`M${x - 1} ${top + 6} H${x + w + 1}`} stroke="#c9a46a" strokeWidth="1.6" />
        </g>
      );
    default:
      return (
        <g>
          <rect x={x} y={top} width={w} height={h} rx="6" fill={color} />
          <rect x={x} y={top} width={w} height={h} rx="6" fill="none" stroke={dark} strokeWidth="1.2" />
          <rect x={x - 1} y={top - 2} width={w + 2} height="7" rx="2.5" fill={shadeHex(color, -0.3)} />
          <path d={`M${x + 4} ${top + 12} v${h - 24} M${x + w - 4} ${top + 12} v${h - 24}`} stroke={light} strokeWidth="0.8" strokeDasharray="3 3" />
          {kind === "decorata" ? (
            <g>
              {[0.28, 0.62].map((u) => <rect key={u} x={x - 0.5} y={top + h * u} width={w + 1} height="3.2" fill="#d9b45a" />)}
              <path d={`M0 ${top + h * 0.4} l4 5 l-4 5 l-4 -5 Z`} fill="#d9b45a" />
              <circle cx="0" cy={top + h * 0.45} r="1.4" fill="#c4473d" />
            </g>
          ) : null}
          {kind === "pelliccia" ? <g>{[-7, -3.5, 0, 3.5, 7].map((dx, i) => <circle key={dx} cx={dx} cy={top + 3 + (i % 2) * 1.6} r="3.8" fill={i % 2 ? "#e3d6be" : "#cdbb9c"} />)}</g> : null}
          {kind === "borchie" ? <g fill="#d9dde2">{Array.from({ length: 10 }, (_, i) => <circle key={i} cx={i % 2 ? x + w - 4 : x + 4} cy={top + 10 + i * (h - 20) / 9} r="1.2" />)}</g> : null}
        </g>
      );
  }
}

/* ---------------- arco ---------------- */

/** decorazioni sull'arco: punti lungo i flettenti (coordinate locali dell'arco) */
export function BowDeco({ kind, up, down, color }: { kind: string; up: [number, number]; down: [number, number]; color: string }) {
  const at = (pt: [number, number], u: number) => [pt[0] * u, pt[1] * u] as const;
  switch (kind) {
    case "nastrini":
      return <g>{[up, down].map((pt, i) => { const [x, y] = at(pt, 0.55); return <g key={i}><path d={`M${f(x)} ${f(y)} c-3 4 -1 8 -4 12 M${f(x)} ${f(y)} c1 4 4 7 2 12`} stroke={i ? "#c4473d" : "#2f6fbe"} strokeWidth="1.4" fill="none" strokeLinecap="round" /></g>; })}</g>;
    case "intagli":
      return <g stroke="#2a1a0e" strokeWidth="0.7" opacity="0.8">{[up, down].flatMap((pt, i) => [0.3, 0.42, 0.54, 0.66].map((u) => { const [x, y] = at(pt, u); return <path key={`${i}${u}`} d={`M${f(x - 2)} ${f(y)} l4 ${i ? 1 : -1}`} />; }))}</g>;
    case "pelliccia":
      return <g>{[-1, 1].map((k) => <g key={k}>{[0, 1, 2].map((i) => <circle key={i} cx={-2 + i * 2} cy={k * (16 + i * 1.5)} r="3" fill={i % 2 ? "#d8cdb6" : "#b9a78a"} />)}</g>)}</g>;
    case "dipinto":
      return <g>{[up, down].flatMap((pt, i) => [0.38, 0.5, 0.62].map((u, k) => { const [x, y] = at(pt, u); return <circle key={`${i}${k}`} cx={f(x)} cy={f(y)} r="1.6" fill={["#c4473d", "#e6c84a", "#2f6fbe"][k]} />; }))}</g>;
    case "rune":
      return <g stroke="#e8c870" strokeWidth="0.8" fill="none">{[up, down].flatMap((pt, i) => [0.35, 0.55, 0.75].map((u) => { const [x, y] = at(pt, u); return <path key={`${i}${u}`} d={`M${f(x - 1.4)} ${f(y - 2)} l1.4 4 l1.4 -4 M${f(x)} ${f(y - 2)} v4`} />; }))}</g>;
    case "piume": {
      const [x, y] = at(up, 0.5);
      return <g transform={`translate(${f(x)} ${f(y)})`}><path d="M0 0 C-2 4 -1 12 -4 16" stroke="#6b4224" strokeWidth="0.7" fill="none" /><path d="M-4 16 C-1 18 0 24 -3 28 C-6 24 -7 18 -4 16 Z" fill="#f4f1ea" stroke="#b9ae98" strokeWidth="0.4" /><path d="M-1 10 C2 12 3 18 0 21 C-3 18 -3 12 -1 10 Z" fill="#8a5a2a" /></g>;
    }
    case "perline": {
      const [x, y] = at(down, 0.4);
      return <g transform={`translate(${f(x)} ${f(y)})`}>{[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={-1 - i * 0.6} cy={2 + i * 3} r="1.3" fill={["#d9b45a", "#2f9e7a", "#c4473d", "#2f6fbe", "#f4f1ea"][i]} />)}</g>;
    }
    case "fasce":
      return <g>{[up, down].flatMap((pt, i) => [0.3, 0.7].map((u) => { const [x, y] = at(pt, u); return <rect key={`${i}${u}`} x={f(x - 3)} y={f(y - 1.4)} width="6" height="2.8" rx="0.8" fill={color} />; }))}</g>;
    default:
      return null;
  }
}

/** penne della freccia in diverse forme: coda in x da 4 a 30 */
export function Fletching({ kind, cock, fletch }: { kind: string; cock: string; fletch: string }) {
  switch (kind) {
    case "scudo":
      return <g><path d="M4 0.5 L6 -6 C14 -8 22 -8 26 -4 L30 1 Z" fill={cock} /><path d="M4 0.5 L6 7 C14 9 22 9 26 5 L30 1 Z" fill={fletch} /></g>;
    case "parabolica":
      return <g><path d="M4 0.5 C8 -8 22 -8 30 1 Z" fill={cock} /><path d="M4 0.5 C8 9 22 9 30 1 Z" fill={fletch} /></g>;
    case "vela":
      return <g><path d="M6 0.5 L8 -10 L24 -3 L28 1 Z" fill={cock} /><path d="M6 0.5 L8 11 L24 4 L28 1 Z" fill={fletch} /></g>;
    case "lunga":
      return <g><path d="M2 0.5 L6 -6 L36 -4 L38 1 Z" fill={cock} /><path d="M2 0.5 L6 7 L36 5 L38 1 Z" fill={fletch} /></g>;
    case "spirale":
      return <g><path d="M4 0.5 C10 -7 18 -2 22 -6 L30 1 Z" fill={cock} /><path d="M4 0.5 C10 8 18 3 22 7 L30 1 Z" fill={fletch} /><path d="M8 -2 L26 2" stroke="#fff" strokeOpacity="0.3" strokeWidth="0.6" /></g>;
    default:
      return <g><path d="M4 0.5 L10 -7 L28 -5 L30 1 Z" fill={cock} /><path d="M4 0.5 L9 8 L27 9 L30 1 Z" fill={fletch} /></g>;
  }
}

/* ---------------- cintura, borsello, mantello ---------------- */

export function Buckle({ kind, x, y, s = 1 }: { kind: string; x: number; y: number; s?: number }) {
  const g = (() => {
    switch (kind) {
      case "oro":
        return <g><rect x="-6" y="-5" width="12" height="10" rx="2" fill="#e8c870" stroke="#8a6a20" strokeWidth="0.8" /><rect x="-3.4" y="-2.6" width="6.8" height="5.2" rx="1" fill="none" stroke="#8a6a20" strokeWidth="0.8" /></g>;
      case "argento":
        return <g><rect x="-6" y="-5" width="12" height="10" rx="2" fill="#d9dde2" stroke="#6b737c" strokeWidth="0.8" /><path d="M-3 0 H3" stroke="#6b737c" strokeWidth="1" /></g>;
      case "celtica":
        return <g><circle r="5.6" fill="#c9a46a" stroke="#6b4a1a" strokeWidth="0.8" /><path d="M-3 -3 Q0 0 3 -3 Q0 0 3 3 Q0 0 -3 3 Q0 0 -3 -3 Z" fill="none" stroke="#6b4a1a" strokeWidth="0.8" /></g>;
      case "ovale":
        return <g><ellipse rx="7" ry="5" fill="none" stroke="#d9b45a" strokeWidth="1.8" /><path d="M-2 0 H5" stroke="#d9b45a" strokeWidth="1.2" /></g>;
      case "quadrata":
        return <g><rect x="-5.4" y="-5.4" width="10.8" height="10.8" fill="none" stroke="#9aa3ad" strokeWidth="2" /><path d="M0 -5 V5" stroke="#9aa3ad" strokeWidth="1.2" /></g>;
      default:
        return null;
    }
  })();
  if (!g) return null;
  return <g transform={`translate(${f(x)} ${f(y)}) scale(${s})`}>{g}</g>;
}

export function Pouch({ kind, x, y, s = 1 }: { kind: string; x: number; y: number; s?: number }) {
  const g = (() => {
    switch (kind) {
      case "tascapane":
        return <g><path d="M-8 0 H8 V13 Q8 17 4 17 H-4 Q-8 17 -8 13 Z" fill="#8a6a42" stroke="#4a2c16" strokeWidth="0.8" /><path d="M-8 0 H8 V6 Q0 10 -8 6 Z" fill="#74583a" /><circle cx="0" cy="7" r="1.2" fill="#c9a46a" /></g>;
      case "sacchetto":
        return <g><path d="M-3 0 H3 L6 4 C10 10 6 16 0 16 C-6 16 -10 10 -6 4 Z" fill="#b8956a" stroke="#6b4a2a" strokeWidth="0.8" /><path d="M-4 3 H4" stroke="#6b4a2a" strokeWidth="1.2" /></g>;
      case "cofanetto":
        return <g><rect x="-6" y="0" width="12" height="12" rx="1.5" fill="#5b3a1e" stroke="#2a1a0e" strokeWidth="0.8" /><rect x="-6" y="3" width="12" height="2" fill="#c9a46a" /><circle cx="0" cy="8" r="1.1" fill="#c9a46a" /></g>;
      case "corno":
        return <g><path d="M-2 0 C6 2 10 8 4 16 C3 12 0 6 -4 4 Z" fill="#efe3c4" stroke="#8a7a5a" strokeWidth="0.8" /><path d="M-3 1 L-4 4" stroke="#6b4224" strokeWidth="2" /></g>;
      case "borraccia":
        return <g><ellipse cx="0" cy="9" rx="7" ry="8" fill="#6b5a48" stroke="#3a2a1e" strokeWidth="0.8" /><rect x="-2" y="-1" width="4" height="4" fill="#3a2a1e" /><path d="M-6 6 Q0 4 6 6" stroke="#c9a46a" strokeWidth="1" fill="none" /></g>;
      default:
        return <path d="M-6 0 h12 v14 a3 3 0 0 1 -3 3 h-6 a3 3 0 0 1 -3 -3 z" fill="#7a4a26" stroke="#4a2c16" strokeWidth="0.8" />;
    }
  })();
  return <g transform={`translate(${f(x)} ${f(y)}) scale(${s})`}>{g}</g>;
}

export function Clasp({ kind, x, y, s = 1 }: { kind: string; x: number; y: number; s?: number }) {
  const g = (() => {
    switch (kind) {
      case "oro":
        return <g><circle r="4.4" fill="#e8c870" stroke="#8a6a20" strokeWidth="0.8" /><circle r="1.6" fill="#8a6a20" /></g>;
      case "argento":
        return <g><circle r="4.4" fill="#d9dde2" stroke="#6b737c" strokeWidth="0.8" /><path d="M-2.4 0 H2.4 M0 -2.4 V2.4" stroke="#6b737c" strokeWidth="0.9" /></g>;
      case "foglia":
        return <path d="M-5 2 C-4 -4 2 -6 6 -5 C5 0 0 5 -5 2 Z M-5 2 L5 -4" fill="#6f9a3a" stroke="#d9b45a" strokeWidth="0.8" />;
      case "drago":
        return <g><circle r="4.8" fill="#c9a46a" stroke="#6b4a1a" strokeWidth="0.8" /><path d="M-2.6 2 C-1 -2 2 -1 1 -3 C3 -2 3 2 0 3 Z" fill="#6b4a1a" /></g>;
      case "gemma":
        return <g><path d="M0 -5 L4.4 0 L0 5 L-4.4 0 Z" fill="#2f9e7a" stroke="#d9b45a" strokeWidth="1.1" /><path d="M-1.4 -1.4 L0 -3" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.8" /></g>;
      default:
        return null;
    }
  })();
  if (!g) return null;
  return <g transform={`translate(${f(x)} ${f(y)}) scale(${s})`}>{g}</g>;
}

/* ---------------- cornice della foto profilo ---------------- */

export function FaceFrame({ kind }: { kind: string }) {
  if (!kind || kind === "nessuna") return null;
  const ring = (stroke: string, w = 5, extra?: ReactNode) => (
    <g>
      <circle cx="50" cy="50" r={50 - w / 2} fill="none" stroke={stroke} strokeWidth={w} />
      {extra}
    </g>
  );
  switch (kind) {
    case "oro":
      return ring("url(#aa-fr-oro)", 6, <defs><linearGradient id="aa-fr-oro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff2b8" /><stop offset="0.5" stopColor="#d9a83a" /><stop offset="1" stopColor="#8a5a10" /></linearGradient></defs>);
    case "argento":
      return ring("url(#aa-fr-arg)", 6, <defs><linearGradient id="aa-fr-arg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="0.5" stopColor="#aab2bb" /><stop offset="1" stopColor="#5d646b" /></linearGradient></defs>);
    case "bronzo":
      return ring("url(#aa-fr-br)", 6, <defs><linearGradient id="aa-fr-br" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f2c49a" /><stop offset="0.5" stopColor="#b06a3a" /><stop offset="1" stopColor="#5a2e12" /></linearGradient></defs>);
    case "foglie":
      return <g>{Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * Math.PI * 2; const x = 50 + Math.cos(a) * 46; const y = 50 + Math.sin(a) * 46; return <ellipse key={i} cx={f(x)} cy={f(y)} rx="2.6" ry="5" fill={i % 2 ? "#6f9a3a" : "#4f7a2a"} transform={`rotate(${f((a * 180) / Math.PI + 90)} ${f(x)} ${f(y)})`} />; })}</g>;
    case "frecce":
      return <g>{ring("#c9a46a", 3)}{Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; const x = 50 + Math.cos(a) * 47; const y = 50 + Math.sin(a) * 47; return <path key={i} d={`M${f(x)} ${f(y)} l${f(Math.cos(a + 1.6) * 6)} ${f(Math.sin(a + 1.6) * 6)}`} stroke="#c4473d" strokeWidth="2.4" strokeLinecap="round" />; })}</g>;
    case "fuoco":
      return ring("url(#aa-fr-fu)", 6, <defs><linearGradient id="aa-fr-fu" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ff3d00" /><stop offset="0.6" stopColor="#ff9a1a" /><stop offset="1" stopColor="#ffe08a" /></linearGradient></defs>);
    case "ghiaccio":
      return ring("url(#aa-fr-gh)", 6, <defs><linearGradient id="aa-fr-gh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="0.5" stopColor="#9fd8ff" /><stop offset="1" stopColor="#2f6fbe" /></linearGradient></defs>);
    case "notte":
      return <g>{ring("#14213d", 6)}{Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return <circle key={i} cx={f(50 + Math.cos(a) * 47)} cy={f(50 + Math.sin(a) * 47)} r="1" fill="#fff" />; })}</g>;
    case "arcobaleno":
      return <g>{["#ef233c", "#fca311", "#ffd166", "#06d6a0", "#118ab2", "#6d597a"].map((c, i) => <circle key={c} cx="50" cy="50" r={49 - i * 1.2} fill="none" stroke={c} strokeWidth="1.3" />)}</g>;
    case "legno":
      return ring("#7a4a26", 6, <circle cx="50" cy="50" r="44.6" fill="none" stroke="#4a2c16" strokeWidth="0.8" />);
    case "bersaglio":
      return <g>{["#f4f1ea", "#14181c", "#2f7fd0", "#d0302a", "#f2c84b"].map((c, i) => <circle key={c} cx="50" cy="50" r={49 - i * 1.6} fill="none" stroke={c} strokeWidth="1.6" />)}</g>;
    default:
      return null;
  }
}
