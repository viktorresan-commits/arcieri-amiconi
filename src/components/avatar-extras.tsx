/**
 * Dettagli in più dell'avatar: fantasie degli abiti, stemmi, pitture e tatuaggi,
 * orecchini, ornamenti dei capelli, decorazioni dell'arco, penne, faretre, occhi, labbra,
 * orecchie, età, segni particolari, fibbie, borselli, fermagli e fantasie del mantello,
 * cornici della foto profilo. Tutto disegnato in SVG, in coordinate locali.
 */
import { useId, type ReactNode } from "react";
import { useCrest } from "@/lib/arcieri/crest";
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
    case "zigzag":
      tile = <pattern id={id} width="10" height="7" patternUnits="userSpaceOnUse"><path d="M0 5 L2.5 1.5 L5 5 L7.5 1.5 L10 5" stroke={trim} strokeWidth="1.3" fill="none" opacity="0.7" /></pattern>;
      break;
    case "stelline":
      tile = <pattern id={id} width="11" height="11" patternUnits="userSpaceOnUse"><path d="M3 1 L3.7 2.6 L5.4 2.7 L4.1 3.8 L4.5 5.4 L3 4.5 L1.5 5.4 L1.9 3.8 L0.6 2.7 L2.3 2.6 Z" fill={trim} opacity="0.8" /><circle cx="8.5" cy="8" r="0.7" fill={trim} opacity="0.7" /></pattern>;
      break;
    case "foglie":
      tile = <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse"><path d="M2 9 C2 5 5 3 8 3 C8 6 6 9 2 9 Z" fill={trim} opacity="0.55" /><path d="M2 9 L7 4" stroke={dark} strokeWidth="0.5" opacity="0.6" /><path d="M8 11.5 C8 9.5 9.5 8.5 11 8.5 C11 10 10 11.5 8 11.5 Z" fill={trim} opacity="0.45" /></pattern>;
      break;
    case "onde":
      tile = <pattern id={id} width="12" height="8" patternUnits="userSpaceOnUse"><path d="M0 4 Q3 0.5 6 4 T12 4" stroke={trim} strokeWidth="1.2" fill="none" opacity="0.65" /></pattern>;
      break;
    case "diagonali":
      tile = <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="3" height="8" fill={trim} opacity="0.45" /></pattern>;
      break;
    case "nido":
      tile = <pattern id={id} width="10" height="17.3" patternUnits="userSpaceOnUse"><path d="M5 0 L10 2.9 L10 8.7 L5 11.5 L0 8.7 L0 2.9 Z M5 11.5 V17.3" stroke={dark} strokeWidth="0.8" fill="none" opacity="0.6" /></pattern>;
      break;
    case "gigli":
      tile = <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse"><g transform="translate(7 7) scale(0.42)" fill={trim} opacity="0.75"><path d="M0 -9 C3 -5 3 -1 0 3 C-3 -1 -3 -5 0 -9 Z M0 3 C-2 -2 -8 -3 -8 2 C-6 0 -3 1 -1 4 Z M0 3 C2 -2 8 -3 8 2 C6 0 3 1 1 4 Z" /><rect x="-5" y="3.5" width="10" height="2.2" /></g></pattern>;
      break;
    case "croci":
      tile = <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse"><path d="M4.2 2 h1.6 v2.2 h2.2 v1.6 h-2.2 v2.2 h-1.6 v-2.2 h-2.2 v-1.6 h2.2 Z" fill={trim} opacity="0.6" /></pattern>;
      break;
    case "losanghe":
      tile = <pattern id={id} width="12" height="16" patternUnits="userSpaceOnUse"><path d="M6 0 L12 8 L6 16 L0 8 Z" fill={dark} opacity="0.35" /><path d="M0 0 L12 16 M12 0 L0 16" stroke={trim} strokeWidth="0.5" opacity="0.7" /></pattern>;
      break;
    case "puntini":
      tile = <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="0.7" fill={trim} opacity="0.75" /></pattern>;
      break;
    case "tartan":
      tile = (
        <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="8" fill={dark} opacity="0.4" /><rect width="8" height="20" fill={dark} opacity="0.4" />
          <rect y="13" width="20" height="2" fill={trim} opacity="0.7" /><rect x="13" width="2" height="20" fill={trim} opacity="0.7" />
          <rect y="4" width="20" height="0.8" fill={light} opacity="0.6" /><rect x="4" width="0.8" height="20" fill={light} opacity="0.6" />
        </pattern>
      );
      break;
    case "fiamme":
      fill = <g>{Array.from({ length: Math.ceil(w / 10) + 1 }, (_, i) => <path key={i} d={`M${x0 + i * 10 - 5} ${y1} C${x0 + i * 10 - 6} ${y1 - 10} ${x0 + i * 10 + 2} ${y1 - 14} ${x0 + i * 10} ${y1 - 24} C${x0 + i * 10 + 6} ${y1 - 14} ${x0 + i * 10 + 6} ${y1 - 8} ${x0 + i * 10 + 5} ${y1} Z`} fill={i % 2 ? "#ffb02e" : trim} opacity="0.8" />)}</g>;
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
    case "orso":
      g = <g><circle cx="-5.6" cy="-6" r="2.6" {...s} /><circle cx="5.6" cy="-6" r="2.6" {...s} /><path d="M-7.5 -2 C-7.5 -7 7.5 -7 7.5 -2 C7.5 4 4 8.5 0 8.5 C-4 8.5 -7.5 4 -7.5 -2 Z" {...s} /><ellipse cx="0" cy="3.6" rx="3" ry="2.2" fill={bg ?? "#000"} opacity="0.35" /></g>;
      break;
    case "cinghiale":
      g = <g><path d="M-9 2 C-9 -5 -2 -8 4 -6 L9 -8 L7 -3 C9 -1 9 3 7 5 L-6 6 Z" {...s} /><path d="M6 1 C8 1 9 -1 9.6 -3" stroke={bg ?? "#000"} strokeWidth="0.9" fill="none" opacity="0.6" /><path d="M-6 6 V9 M-2 6 V9 M2 6 V9 M5 5.5 V9" {...st} strokeWidth={1.4} /></g>;
      break;
    case "volpe":
      g = <path d="M-9 -8 L-3.5 -3 L3.5 -3 L9 -8 L8 -1 C7 3 3 7 0 9 C-3 7 -7 3 -8 -1 Z M-3 1 L0 4 L3 1" {...s} />;
      break;
    case "civetta":
      g = <g><path d="M-7 -8 L-4 -4 H4 L7 -8 V3 C7 7 3 9.5 0 9.5 C-3 9.5 -7 7 -7 3 Z" {...s} /><circle cx="-3" cy="-1" r="2.2" fill={bg ?? "#000"} opacity="0.45" /><circle cx="3" cy="-1" r="2.2" fill={bg ?? "#000"} opacity="0.45" /><path d="M-1 2 L0 4 L1 2 Z" fill={bg ?? "#000"} opacity="0.45" /></g>;
      break;
    case "spade":
      g = <g>{[45, -45].map((r) => <g key={r} transform={`rotate(${r})`}><path d="M0 -10 L1.4 -7 V4 H-1.4 V-7 Z" {...s} /><path d="M-4 4 H4" {...st} strokeWidth={1.6} /><path d="M0 4.5 V8.5" {...st} strokeWidth={1.6} /></g>)}</g>;
      break;
    case "torre":
      g = <path d="M-6 9 V-3 L-7.5 -3 V-9 H-4.5 V-6.5 H-1.5 V-9 H1.5 V-6.5 H4.5 V-9 H7.5 V-3 L6 -3 V9 Z M-1.6 9 V4 A1.6 1.6 0 0 1 1.6 4 V9" {...s} fillRule="evenodd" />;
      break;
    case "chiave":
      g = <g><circle cx="0" cy="-5" r="4.4" {...st} strokeWidth={2} /><path d="M0 -0.6 V9 M0 5 H3.6 M0 8 H2.6" {...st} strokeWidth={2} /></g>;
      break;
    case "ancora":
      g = <g><circle cx="0" cy="-7" r="1.8" {...st} strokeWidth={1.4} /><path d="M0 -5 V8 M-4 -2 H4 M-8 2 C-7 7 -3 9 0 9 C3 9 7 7 8 2" {...st} strokeWidth={1.7} /><path d="M-8 2 L-9.4 4.4 M-8 2 L-5.6 3 M8 2 L9.4 4.4 M8 2 L5.6 3" {...st} strokeWidth={1.3} /></g>;
      break;
    case "fiore":
      g = <g>{Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return <ellipse key={i} cx={f(Math.cos(a) * 5)} cy={f(Math.sin(a) * 5)} rx="3.4" ry="2.2" transform={`rotate(${f((a * 180) / Math.PI)} ${f(Math.cos(a) * 5)} ${f(Math.sin(a) * 5)})`} {...s} />; })}<circle r="2.6" fill={bg ?? "#000"} opacity="0.4" /></g>;
      break;
    case "trifoglio":
      g = <g><circle cx="0" cy="-4.6" r="3.8" {...s} /><circle cx="-4.4" cy="1" r="3.8" {...s} /><circle cx="4.4" cy="1" r="3.8" {...s} /><path d="M0 1 C0 5 1 7.5 3 9.5" {...st} strokeWidth={1.4} /></g>;
      break;
    case "fiamma":
      g = <path d="M0 9.5 C-6 9.5 -8 4 -6 -1 C-5 2 -3 2.6 -3 1 C-3 -3 0 -6 1 -10 C3 -6 7 -3 7 2.6 C7 7 4 9.5 0 9.5 Z" {...s} />;
      break;
    case "cuore":
      g = <path d="M0 8.6 C-6 4 -9.4 0.6 -9.4 -3.4 C-9.4 -6.8 -6.8 -8.8 -4.4 -8.8 C-2.4 -8.8 -0.8 -7.6 0 -6 C0.8 -7.6 2.4 -8.8 4.4 -8.8 C6.8 -8.8 9.4 -6.8 9.4 -3.4 C9.4 0.6 6 4 0 8.6 Z" {...s} />;
      break;
    case "spiga":
      g = <g><path d="M0 9.5 V-9" {...st} strokeWidth={1.2} />{[-6, -2.4, 1.2].map((y) => <g key={y}><ellipse cx="-2.4" cy={y} rx="2" ry="3.4" transform={`rotate(-30 -2.4 ${y})`} {...s} /><ellipse cx="2.4" cy={y} rx="2" ry="3.4" transform={`rotate(30 2.4 ${y})`} {...s} /></g>)}<ellipse cx="0" cy="-8.6" rx="1.6" ry="2.6" {...s} /></g>;
      break;
    case "ascia":
      g = <g><path d="M-6 9 L5 -6" {...st} strokeWidth={2} /><path d="M2 -9 C9 -9 10 -1 6 2 L1 -3 Z" {...s} /></g>;
      break;
    case "cavallo":
      g = <path d="M-6 9 L-5 2 C-8 0 -8 -5 -4 -7 L-1 -9 L0 -6 C4 -7 8 -4 8 0 L5 1 L3 -1 L1 2 L2 9 Z" {...s} />;
      break;
    case "pesce":
      g = <g><path d="M-8 0 C-4 -6 4 -6 6 0 C4 6 -4 6 -8 0 Z M6 0 L10 -5 L10 5 Z" {...s} /><circle cx="-4" cy="-1" r="1" fill={bg ?? "#000"} opacity="0.5" /></g>;
      break;
    case "gatto":
      g = <g><path d="M-7 -8 L-4 -3 H4 L7 -8 L7 2 C7 6 3 9 0 9 C-3 9 -7 6 -7 2 Z" {...s} /><path d="M-3 0 h1.4 M1.6 0 h1.4 M-1 3 L0 4 L1 3 M-8 3 h4 M4 3 h4" stroke={bg ?? "#000"} strokeWidth="0.8" opacity="0.55" /></g>;
      break;
    case "albero":
      g = <g><circle cx="0" cy="-3" r="6.6" {...s} /><circle cx="-5" cy="0" r="4" {...s} /><circle cx="5" cy="0" r="4" {...s} /><path d="M0 2 V9.5 M-3 9.5 H3" {...st} strokeWidth={1.8} /></g>;
      break;
    default:
      return null;
  }
  return g;
}

/** bordo a zig-zag lungo una curva quadratica (ricamo d'argento della divisa) */
export function zigQ(a: [number, number], c: [number, number], b: [number, number], n: number, amp: number) {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0];
    const y = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1];
    const dx = 2 * u * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
    const dy = 2 * u * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
    const len = Math.hypot(dx, dy) || 1;
    const k = i % 2 ? amp : -amp;
    pts.push(`${f(x - (dy / len) * k)} ${f(y + (dx / len) * k)}`);
  }
  return `M${pts.join(" L")}`;
}

/** stemma cucito sulla veste, su una toppa */
export function ChestEmblem({ kind, x, y, s = 1, base, trim, crest }: { kind: string; x: number; y: number; s?: number; base: string; trim: string; crest?: string }) {
  if (!kind || kind === "nessuno") return null;
  if (kind === "compagnia") return <CompanyCrest id={crest} x={x} y={y} s={s} />;
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${s})`}>
      <path d="M-11 -11 H11 V2 C11 8 5 11 0 13 C-5 11 -11 8 -11 2 Z" fill={shadeHex(base, -0.3)} stroke={trim} strokeWidth="1.4" />
      <g transform="scale(0.82)">
        <EmblemGlyph kind={kind} color={trim} bg={shadeHex(base, -0.3)} />
      </g>
    </g>
  );
}

const SHIELD = "M-11 -12 H11 V2 C11 8.5 5 11.5 0 14 C-5 11.5 -11 8.5 -11 2 Z";

/**
 * Stemma della compagnia cucito sulla veste: il logo vero, ritagliato a scudo su fondo chiaro.
 * Finché il logo non è pronto (o se la compagnia non ne ha uno) uno scudo col capo merlato nel suo colore.
 */
export function CompanyCrest({ id, x, y, s = 1 }: { id?: string; x: number; y: number; s?: number }) {
  const crest = useCrest(id);
  const clip = `cc${(useId().replace(/[^a-zA-Z0-9]/g, "") + "_")}`;
  const chief = crest?.color || "#b3262a";
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${s})`}>
      <defs>
        <clipPath id={clip}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      {crest?.logo ? (
        // il logo ha già la sua forma (di solito uno scudo): si cuce così com'è
        <image href={crest.logo} x="-15" y="-13" width="30" height="28" preserveAspectRatio="xMidYMid meet" />
      ) : (
        <g clipPath={`url(#${clip})`}>
          <path d={SHIELD} fill="#f3ecda" />
          <path d="M-12 -13 H12 V-4 H-12 Z" fill={chief} />
          <path d="M-7.5 -9.5 h3 v-2 h3 v2 h3 v-2 h3 v2 h3 v3 h-15 Z" fill="#f3ecda" opacity="0.9" />
          <g transform="translate(0 4) scale(0.55)">
            <EmblemGlyph kind="drago" color="#2f6b3a" />
          </g>
        </g>
      )}
      {crest?.logo ? null : <path d={SHIELD} fill="none" stroke="#c9a24a" strokeWidth="0.9" />}
    </g>
  );
}

/* ---------------- viso di fronte (foto profilo e figura di fronte) ---------------- */

/** pitture sul viso di fronte: occhi in (41, ey) e (59, ey), viso centrato su 50 */
/* ---------------- pitture sul viso: pennellate dipinte ----------------
   Ogni segno è una pennellata vera: parte piena, si assottiglia, finisce con le setole aperte;
   il colore ha un cuore più denso e qualche striatura asciutta, come pigmento steso sulla pelle. */

type Pt = [number, number];
const qp = (a: Pt, c: Pt, b: Pt, t: number): Pt => [
  (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
  (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
];
const fx = (n: number) => n.toFixed(2);

/** contorno di una pennellata lungo una curva da a a b (c = controllo), larga w */
function brushPath(a: Pt, c: Pt, b: Pt, w: number, taperStart = 0.35) {
  const N = 12;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= N; i += 1) {
    const t = i / N;
    const p = qp(a, c, b, t);
    const q = qp(a, c, b, Math.min(1, t + 0.01));
    const r = qp(a, c, b, Math.max(0, t - 0.01));
    const dx = q[0] - r[0];
    const dy = q[1] - r[1];
    const len = Math.hypot(dx, dy) || 1;
    // profilo: attacco arrotondato, pancia piena, coda che si stringe
    const prof = t < 0.16 ? taperStart + (1 - taperStart) * Math.sin((t / 0.16) * (Math.PI / 2)) : Math.pow(1 - (t - 0.16) / 0.84, 0.7) * 0.72 + 0.28;
    const h = (w / 2) * prof;
    left.push([p[0] - (dy / len) * h, p[1] + (dx / len) * h]);
    right.push([p[0] + (dy / len) * h, p[1] - (dx / len) * h]);
  }
  const pts = [...left, ...right.reverse()];
  return `M${pts.map((pt) => `${fx(pt[0])} ${fx(pt[1])}`).join(" L")} Z`;
}

export function PaintStroke({ a, b, bend = 0, w, color, op = 0.86 }: { a: Pt; b: Pt; bend?: number; w: number; color: string; op?: number }) {
  w *= 1.45;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const c: Pt = [mx - (dy / len) * bend, my + (dx / len) * bend];
  // setole alla fine: due fili sottili che escono dalla coda
  const tail = qp(a, c, b, 0.86);
  const nx = -dy / len;
  const ny = dx / len;
  return (
    <g>
      <path d={brushPath(a, c, b, w)} fill={color} opacity={op} />
      {/* cuore più denso del pigmento */}
      <path d={brushPath(a, c, b, w * 0.55, 0.6)} fill={color} opacity={op * 0.55} />
      {/* striature asciutte della pennellata */}
      <path d={`M${fx(a[0] + nx * w * 0.16)} ${fx(a[1] + ny * w * 0.16)} Q${fx(c[0] + nx * w * 0.16)} ${fx(c[1] + ny * w * 0.16)} ${fx(tail[0] + nx * w * 0.06)} ${fx(tail[1] + ny * w * 0.06)}`} stroke="#fff" strokeOpacity="0.16" strokeWidth={Math.max(0.25, w * 0.09)} fill="none" strokeLinecap="round" />
      <path d={`M${fx(a[0] - nx * w * 0.22)} ${fx(a[1] - ny * w * 0.22)} Q${fx(c[0] - nx * w * 0.22)} ${fx(c[1] - ny * w * 0.22)} ${fx(tail[0] - nx * w * 0.1)} ${fx(tail[1] - ny * w * 0.1)}`} stroke="#000" strokeOpacity="0.14" strokeWidth={Math.max(0.2, w * 0.07)} fill="none" strokeLinecap="round" />
      <path d={`M${fx(tail[0] + nx * w * 0.12)} ${fx(tail[1] + ny * w * 0.12)} l${fx(dx / len * w * 1.1 + nx * w * 0.2)} ${fx(dy / len * w * 1.1 + ny * w * 0.2)} M${fx(tail[0] - nx * w * 0.1)} ${fx(tail[1] - ny * w * 0.1)} l${fx(dx / len * w * 0.8 - nx * w * 0.16)} ${fx(dy / len * w * 0.8 - ny * w * 0.16)}`} stroke={color} strokeOpacity={op * 0.6} strokeWidth={Math.max(0.2, w * 0.1)} strokeLinecap="round" fill="none" />
    </g>
  );
}

/** macchia dipinta (tamponata col dito): bordo irregolare e centro più scuro */
function Dab({ x, y, r, color, op = 0.8 }: { x: number; y: number; r: number; color: string; op?: number }) {
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    const k = 1 + ((i * 37) % 7) / 28 - 0.1;
    return `${fx(x + Math.cos(a) * r * k)} ${fx(y + Math.sin(a) * r * k * 0.92)}`;
  });
  return (
    <g>
      <path d={`M${pts.join(" L")} Z`} fill={color} opacity={op} strokeLinejoin="round" stroke={color} strokeOpacity={op * 0.5} strokeWidth={r * 0.25} />
      <circle cx={x - r * 0.1} cy={y} r={r * 0.5} fill={color} opacity={op * 0.5} />
    </g>
  );
}

/** pitture di fronte: occhi alla quota ey, viso al centro (50, fy), semilarghezza rx */
export function FacePaintFront({ kind, ey, fy, rx, color }: { kind: string; ey: number; fy: number; rx: number; color: string }) {
  const L = 50 - rx;
  const R = 50 + rx;
  const pair = (f: (side: 1 | -1) => ReactNode) => <g>{f(-1)}{f(1)}</g>;
  switch (kind) {
    case "strisce":
      // tre pennellate per guancia, che seguono lo zigomo e si aprono verso l'esterno
      return pair((sd) => [0, 3.6, 7.2].map((d) => <PaintStroke key={d} a={[50 + sd * 9, ey + 5 + d]} b={[50 + sd * (rx - 4), ey + 6.5 + d * 1.1]} bend={sd * -1.2} w={2.3 - d * 0.08} color={color} />));
    case "maschera":
      return (
        <g>
          <path d={`M${L + 1.5} ${ey - 3} C${L + 5} ${ey - 8} 45 ${ey - 7} 50 ${ey - 5} C55 ${ey - 7} ${R - 5} ${ey - 8} ${R - 1.5} ${ey - 3} C${R - 1} ${ey + 2} ${R - 3} ${ey + 6} ${R - 6} ${ey + 6} C56 ${ey + 6} 53 ${ey + 3} 50 ${ey + 4.5} C47 ${ey + 3} 44 ${ey + 6} ${L + 6} ${ey + 6} C${L + 3} ${ey + 6} ${L + 1} ${ey + 2} ${L + 1.5} ${ey - 3} Z`} fill={color} opacity="0.78" />
          <path d={`M${L + 3} ${ey - 3.5} C${L + 7} ${ey - 7} 45 ${ey - 6} 49 ${ey - 4.6}`} stroke="#fff" strokeOpacity="0.18" strokeWidth="0.8" fill="none" strokeLinecap="round" />
          {pair((sd) => <PaintStroke a={[50 + sd * (rx - 3), ey + 5]} b={[50 + sd * (rx + 1.5), ey + 10]} bend={sd * 1} w={1.8} color={color} op={0.7} />)}
        </g>
      );
    case "punti":
      return <g>{[[35, 6, 1.4], [38.5, 9, 1.2], [42, 6.5, 1.1], [58, 6.5, 1.1], [61.5, 9, 1.2], [65, 6, 1.4], [50, -12, 1.3], [47, -9.5, 1], [53, -9.5, 1]].map(([x, d, r]) => <Dab key={`${x}${d}`} x={x} y={ey + d} r={r} color={color} op={0.85} />)}</g>;
    case "tribale":
      return (
        <g>
          <PaintStroke a={[50, ey - 15]} b={[50, ey - 5]} w={2} color={color} />
          {pair((sd) => <PaintStroke a={[50 + sd * 0.5, ey - 9]} b={[50 + sd * 6, ey - 13]} bend={sd * 0.6} w={1.6} color={color} />)}
          {pair((sd) => (
            <g>
              <PaintStroke a={[50 + sd * (rx - 2), ey + 5]} b={[50 + sd * 8, ey + 8]} bend={sd * -2.4} w={2.2} color={color} />
              <PaintStroke a={[50 + sd * (rx - 3), ey + 10]} b={[50 + sd * 10, ey + 12]} bend={sd * -1.6} w={1.6} color={color} />
              <Dab x={50 + sd * (rx - 6)} y={ey + 14.5} r={0.9} color={color} />
            </g>
          ))}
        </g>
      );
    case "fulmine":
      return (
        <g>
          <path d={`M56.5 ${ey - 15} L51.5 ${ey - 3} L57.2 ${ey - 3.4} L50.5 ${ey + 13} L53.2 ${ey + 1.2} L47.6 ${ey + 1.6} Z`} fill={color} opacity="0.9" stroke={color} strokeOpacity="0.5" strokeWidth="0.6" strokeLinejoin="round" />
          <path d={`M55.5 ${ey - 13} L52.2 ${ey - 4}`} stroke="#fff" strokeOpacity="0.25" strokeWidth="0.7" strokeLinecap="round" />
        </g>
      );
    case "mezza":
      return (
        <g>
          <path d={`M50 ${fy - 23} C${R + 4} ${fy - 24} ${R + 3} ${fy + 20} 50 ${fy + 23} C51.5 ${fy + 8} 50.5 ${fy - 8} 50 ${fy - 23} Z`} fill={color} opacity="0.5" />
          {[-14, -6, 2, 10].map((d) => <PaintStroke key={d} a={[50.5, fy + d]} b={[R - 1, fy + d + 2]} bend={-1.5} w={1.3} color={color} op={0.25} />)}
        </g>
      );
    case "naso":
      return <PaintStroke a={[50, ey - 13]} b={[50, ey + 11]} w={3} color={color} />;
    case "guance":
      return pair((sd) => (
        <g>
          <ellipse cx={50 + sd * 14} cy={ey + 8} rx="4.6" ry="3.4" fill={color} opacity="0.32" />
          <Dab x={50 + sd * 14} y={ey + 8} r={2.4} color={color} op={0.55} />
        </g>
      ));
    case "volpe":
      return (
        <g>
          {pair((sd) => <path d={`M${50 + sd * rx} ${ey + 1} C${50 + sd * (rx - 4)} ${ey + 1} ${50 + sd * 9} ${ey + 3} ${50 + sd * 7.5} ${ey + 4.5} C${50 + sd * 10} ${ey + 8} ${50 + sd * (rx - 2)} ${ey + 13} ${50 + sd * (rx - 2.5)} ${ey + 15} C${50 + sd * (rx + 0.5)} ${ey + 11} ${50 + sd * (rx + 0.5)} ${ey + 5} ${50 + sd * rx} ${ey + 1} Z`} fill={color} opacity="0.72" />)}
          {pair((sd) => <PaintStroke a={[50 + sd * (rx - 1), ey + 4]} b={[50 + sd * (rx + 2), ey + 1]} w={1.2} color="#f4ead8" op={0.7} />)}
          <path d={`M47 ${ey + 9} Q50 ${ey + 8} 53 ${ey + 9} L50 ${ey + 13} Z`} fill="#1b130d" opacity="0.9" />
        </g>
      );
    case "lupo":
      return (
        <g>
          {pair((sd) => <PaintStroke a={[50 + sd * (rx - 1), ey - 10]} b={[50 + sd * 9.5, ey - 4]} bend={sd * 0.8} w={2.2} color={color} />)}
          {pair((sd) => [0, 4, 8].map((d) => <PaintStroke key={d} a={[50 + sd * (rx - 3), ey + 6 + d]} b={[50 + sd * 9, ey + 6 + d * 0.8]} bend={sd * (d - 4) * 0.3} w={1.8 - d * 0.08} color={color} />))}
        </g>
      );
    case "occhi":
      return pair((sd) => <ellipse cx={50 + sd * 9.5} cy={ey} rx="6.2" ry="4.6" fill={color} opacity="0.55" />);
    case "zigzag":
      return pair((sd) => <path d={`M${50 + sd * 8} ${ey + 6} l${sd * 2.6} 3 l${sd * 2.6} -3 l${sd * 2.6} 3 l${sd * 2.6} -3`} stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round" strokeLinecap="round" opacity="0.88" />);
    case "croce":
      return <g><PaintStroke a={[50, ey - 15]} b={[50, ey - 5]} w={2.2} color={color} /><PaintStroke a={[45.5, ey - 11]} b={[54.5, ey - 11]} w={2} color={color} /></g>;
    case "spirale":
      return pair((sd) => <path d={`M${50 + sd * 14} ${ey + 8} m${sd * 0.8} 0 a0.8 0.8 0 1 0 ${sd * -1.6} 0 a1.8 1.8 0 1 0 ${sd * 3.6} 0 a2.8 2.8 0 1 0 ${sd * -5.6} 0`} stroke={color} strokeWidth="1.1" fill="none" opacity="0.85" />);
    default:
      return null;
  }
}

/** pitture sul viso di profilo: occhio intorno a (163, 82), guancia (161, 93); il viso guarda a destra */
export function FacePaintProfile({ kind, color }: { kind: string; color: string }) {
  switch (kind) {
    case "strisce":
      return <g>{[0, 3.8, 7.6].map((d) => <PaintStroke key={d} a={[151 + d * 0.3, 87.5 + d]} b={[167 - d * 0.4, 89.5 + d * 1.05]} bend={-1} w={2.3 - d * 0.08} color={color} />)}</g>;
    case "maschera":
      return (
        <g>
          <path d="M149 78.5 C153 74.5 160 73.5 166 74.5 C169.5 75 171.5 76.5 172.5 78 L172 85 C170 87.5 166 88.5 162 87.6 C158 87 154 88.4 150.5 87.4 C148.6 85 148.2 81.5 149 78.5 Z" fill={color} opacity="0.78" />
          <path d="M151 78 C155 75.5 160 75 165 75.6" stroke="#fff" strokeOpacity="0.18" strokeWidth="0.8" fill="none" strokeLinecap="round" />
          <PaintStroke a={[152, 87]} b={[147, 92]} bend={1} w={1.8} color={color} op={0.7} />
        </g>
      );
    case "punti":
      return <g>{[[154.5, 90, 1.3], [158.5, 92.4, 1.15], [162.5, 90.4, 1.05], [160, 69.5, 1.1], [164, 70.8, 0.95]].map(([x, y, r]) => <Dab key={`${x}${y}`} x={x} y={y} r={r} color={color} op={0.85} />)}</g>;
    case "tribale":
      return (
        <g>
          <PaintStroke a={[155, 65.5]} b={[167, 72]} bend={-1} w={1.8} color={color} />
          <PaintStroke a={[152, 89]} b={[165, 91]} bend={-2.6} w={2.2} color={color} />
          <PaintStroke a={[153, 94]} b={[162, 95.5]} bend={-1.6} w={1.6} color={color} />
          <Dab x={157} y={99} r={0.9} color={color} />
        </g>
      );
    case "fulmine":
      return (
        <g>
          <path d="M166.5 65.5 L161.6 76.2 L167.2 75.8 L160.6 92.5 L163.4 80.2 L157.8 80.6 Z" fill={color} opacity="0.9" stroke={color} strokeOpacity="0.5" strokeWidth="0.6" strokeLinejoin="round" />
          <path d="M165.6 67.5 L162.4 75" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.7" strokeLinecap="round" />
        </g>
      );
    case "mezza":
      return (
        <g>
          <path d="M150 63.5 C162 61.5 172.5 69.5 173.6 81.5 L176.4 95.5 C172.4 102.5 160.5 104.5 150 100.5 C148 88 148 76 150 63.5 Z" fill={color} opacity="0.46" />
          {[68, 76, 84, 92].map((y) => <PaintStroke key={y} a={[151, y]} b={[171, y + 2]} bend={-1.5} w={1.3} color={color} op={0.22} />)}
        </g>
      );
    case "naso":
      return <PaintStroke a={[171.5, 77]} b={[177.5, 93.5]} bend={0.8} w={2.6} color={color} />;
    case "guance":
      return (
        <g>
          <ellipse cx="160.5" cy="93" rx="5" ry="3.6" fill={color} opacity="0.3" />
          <Dab x={160.5} y={93} r={2.5} color={color} op={0.55} />
        </g>
      );
    case "volpe":
      return (
        <g>
          <path d="M149.5 83.5 C154 84 159 86 161.5 87.6 C158 89.5 154.5 94 152.5 99.5 C150.5 95 149.2 89 149.5 83.5 Z" fill={color} opacity="0.72" />
          <PaintStroke a={[151, 86]} b={[148, 83]} w={1.2} color="#f4ead8" op={0.7} />
        </g>
      );
    case "lupo":
      return (
        <g>
          <PaintStroke a={[151, 71]} b={[161, 76.5]} bend={-0.6} w={2} color={color} />
          {[0, 4, 8].map((d) => <PaintStroke key={d} a={[151, 89 + d]} b={[163, 88.5 + d * 0.8]} bend={(d - 4) * 0.25} w={1.8 - d * 0.08} color={color} />)}
        </g>
      );
    case "occhi":
      return <ellipse cx="163" cy="82" rx="7" ry="5" fill={color} opacity="0.55" />;
    case "zigzag":
      return <path d="M151 90 l2.6 3 l2.6 -3 l2.6 3 l2.6 -3 l2.6 3" stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round" strokeLinecap="round" opacity="0.88" />;
    case "croce":
      return <g><PaintStroke a={[159, 64]} b={[160.5, 73]} w={2} color={color} /><PaintStroke a={[155.5, 68]} b={[164.5, 68.6]} w={1.8} color={color} /></g>;
    case "spirale":
      return <path d="M160.5 93 m0.8 0 a0.8 0.8 0 1 0 -1.6 0 a1.8 1.8 0 1 0 3.6 0 a2.8 2.8 0 1 0 -5.6 0" stroke={color} strokeWidth="1.1" fill="none" opacity="0.85" />;
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
    case "stella":
      return <path d={`M${x} ${y - 2} L${x + 0.6} ${y - 0.6} L${x + 2} ${y - 0.5} L${x + 0.9} ${y + 0.4} L${x + 1.3} ${y + 1.9} L${x} ${y + 1.1} L${x - 1.3} ${y + 1.9} L${x - 0.9} ${y + 0.4} L${x - 2} ${y - 0.5} L${x - 0.6} ${y - 0.6} Z`} fill="#d9b45a" />;
    case "freccia":
      return <g><path d={`M${x} ${y - 1} V${y + 7}`} stroke="#d9b45a" strokeWidth="0.7" /><path d={`M${x - 1.3} ${y + 5.4} L${x} ${y + 8.2} L${x + 1.3} ${y + 5.4}`} fill="#d9b45a" /><path d={`M${x} ${y - 1} l-1.2 -1.6 M${x} ${y - 1} l1.2 -1.6`} stroke="#c4473d" strokeWidth="0.7" /></g>;
    case "luna":
      return <path d={`M${x + 1} ${y - 2.4} A2.6 2.6 0 1 0 ${x + 1} ${y + 2.4} A2 2 0 1 1 ${x + 1} ${y - 2.4} Z`} fill="#e8e3d8" stroke="#b9ae98" strokeWidth="0.3" />;
    case "goccia":
      return <g><path d={`M${x} ${y - 1} V${y + 2}`} stroke="#d9b45a" strokeWidth="0.6" /><path d={`M${x} ${y + 2} C${x + 2.2} ${y + 5} ${x + 1.6} ${y + 7.4} ${x} ${y + 7.4} C${x - 1.6} ${y + 7.4} ${x - 2.2} ${y + 5} ${x} ${y + 2} Z`} fill="#3b6ea8" stroke="#d9b45a" strokeWidth="0.4" /></g>;
    case "triplo":
      return <g fill="none" stroke="#d9b45a" strokeWidth="0.8"><circle cx={x} cy={y} r="1.5" /><circle cx={x - 0.5} cy={y - 3.2} r="1" /><circle cx={x - 0.9} cy={y - 5.8} r="0.8" /></g>;
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
      case "corona-fiori":
        return <g>{[-6, -3, 0, 3, 6].map((dx, i) => <g key={dx}>{[0, 1, 2, 3, 4].map((k) => <circle key={k} cx={dx + Math.cos((k / 5) * 6.28) * 1.1} cy={-Math.abs(dx) * 0.2 + Math.sin((k / 5) * 6.28) * 1.1} r="0.9" fill={["#ff8fa3", "#ffd166", "#f4f1ea", "#b8a1ff", "#ff8fa3"][i]} />)}<circle cx={dx} cy={-Math.abs(dx) * 0.2} r="0.55" fill="#e6b325" /></g>)}</g>;
      case "gemma":
        return <g><path d="M0 -3 L2.6 0 L0 3 L-2.6 0 Z" fill="#2f9e7a" stroke="#d9b45a" strokeWidth="0.7" /><path d="M-0.8 -1.2 L0 -2.2" stroke="#fff" strokeOpacity="0.7" strokeWidth="0.5" /></g>;
      case "osso":
        return <g><path d="M-5 0 H5" stroke="#efe6d2" strokeWidth="1.8" strokeLinecap="round" /><circle cx="-5.4" cy="-0.9" r="1.1" fill="#efe6d2" /><circle cx="-5.4" cy="0.9" r="1.1" fill="#efe6d2" /><circle cx="5.4" cy="-0.9" r="1.1" fill="#efe6d2" /><circle cx="5.4" cy="0.9" r="1.1" fill="#efe6d2" /></g>;
      case "farfalla":
        return <g><path d="M0 0 C-3 -4 -6 -3 -5 0 C-6 3 -3 4 0 0 Z" fill="#2f6fbe" /><path d="M0 0 C3 -4 6 -3 5 0 C6 3 3 4 0 0 Z" fill="#2f6fbe" /><circle cx="-3" cy="-0.8" r="0.7" fill="#ffd166" /><circle cx="3" cy="-0.8" r="0.7" fill="#ffd166" /><path d="M0 -2 V2" stroke="#1d1f22" strokeWidth="0.8" /></g>;
      case "corona":
        return <g><path d="M-7 2 L-7 -3 L-3.5 0 L0 -5 L3.5 0 L7 -3 L7 2 Z" fill="#e8c870" stroke="#8a6a20" strokeWidth="0.5" /><circle cx="0" cy="-1" r="0.9" fill="#c4473d" /></g>;
      case "spilloni":
        return <g>{[-3, 3].map((dx) => <g key={dx} transform={`rotate(${dx * 6})`}><path d={`M${dx} 4 V-8`} stroke="#c9a46a" strokeWidth="0.9" /><circle cx={dx} cy="-8.6" r="1.5" fill={dx < 0 ? "#c4473d" : "#2f9e7a"} /></g>)}</g>;
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
          {kind === "nastri" ? <g>{[0.2, 0.45, 0.7].map((u, i) => <path key={u} d={`M${x - 0.5} ${top + h * u} l${w + 1} 6 v3 l${-(w + 1)} -6 Z`} fill={["#c4473d", "#e6c84a", "#2f6fbe"][i]} opacity="0.9" />)}</g> : null}
          {kind === "scaglie" ? <g fill="none" stroke={dark} strokeWidth="0.8" opacity="0.75">{Array.from({ length: Math.floor((h - 16) / 6) }, (_, r) => [0, 1, 2].map((c) => <path key={`${r}${c}`} d={`M${x + 2 + c * (w - 4) / 3 + (r % 2 ? 2.5 : 0)} ${top + 10 + r * 6} a3 3 0 0 0 5 0`} />))}</g> : null}
          {kind === "dipinta" ? <g><path d={`M0 ${top + h * 0.22} C${w * 0.35} ${top + h * 0.32} ${-w * 0.35} ${top + h * 0.42} 0 ${top + h * 0.52} C${w * 0.35} ${top + h * 0.62} ${-w * 0.35} ${top + h * 0.72} 0 ${top + h * 0.82}`} stroke="#f4f1ea" strokeWidth="1.4" fill="none" opacity="0.85" />{[0.3, 0.5, 0.7].map((u) => <circle key={u} cx="0" cy={top + h * u} r="1.3" fill="#c4473d" />)}</g> : null}
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
    case "spirale":
      return <g stroke={color} strokeWidth="0.9" fill="none">{[up, down].flatMap((pt, i) => [0.28, 0.36, 0.44, 0.52, 0.6].map((u) => { const [x, y] = at(pt, u); return <path key={`${i}${u}`} d={`M${f(x - 2.4)} ${f(y - 1)} l4.8 2`} />; }))}</g>;
    case "oro":
      return <g>{[up, down].flatMap((pt, i) => [0.94].map((u) => { const [x, y] = at(pt, u); return <circle key={`${i}${u}`} cx={f(x)} cy={f(y)} r="2" fill="#e8c870" stroke="#8a6a20" strokeWidth="0.5" />; }))}</g>;
    case "stelle":
      return <g fill="#f4f1ea">{[up, down].flatMap((pt, i) => [0.4, 0.62].map((u) => { const [x, y] = at(pt, u); return <path key={`${i}${u}`} d={`M${f(x)} ${f(y - 1.8)} l0.5 1.3 l1.3 0.1 l-1 0.8 l0.4 1.3 l-1.2 -0.7 l-1.2 0.7 l0.4 -1.3 l-1 -0.8 l1.3 -0.1 Z`} />; }))}</g>;
    case "nappe": {
      const [x, y] = at(down, 0.5);
      return <g transform={`translate(${f(x)} ${f(y)})`}><path d="M0 0 V6" stroke="#c4473d" strokeWidth="0.8" /><path d="M-2 6 H2 L2.6 14 H-2.6 Z" fill="#c4473d" /><path d="M-1.6 8 V14 M0 8 V14 M1.6 8 V14" stroke="#7a1f1a" strokeWidth="0.4" /></g>;
    }
    case "cuoio":
      return <g>{[up, down].map((pt, i) => { const [x, y] = at(pt, 0.16); return <rect key={i} x={f(x - 3.4)} y={f(y - 5)} width="6.8" height="10" rx="1.6" fill="#7a4a26" stroke="#4a2c16" strokeWidth="0.5" />; })}</g>;
    case "serpente":
      return <g fill="none" stroke="#5a6a3a" strokeWidth="1.1" opacity="0.85">{[up, down].flatMap((pt, i) => [0.3, 0.45, 0.6, 0.75].map((u) => { const [x, y] = at(pt, u); return <path key={`${i}${u}`} d={`M${f(x - 2.4)} ${f(y)} q1.2 -2 2.4 0 t2.4 0`} />; }))}</g>;
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
      case "bronzo":
        return <g><rect x="-6" y="-5" width="12" height="10" rx="2.6" fill="#b06a3a" stroke="#5a2e12" strokeWidth="0.8" /><circle r="2" fill="none" stroke="#5a2e12" strokeWidth="0.8" /></g>;
      case "rombo":
        return <g><path d="M0 -6 L7 0 L0 6 L-7 0 Z" fill="#d9b45a" stroke="#8a6a20" strokeWidth="0.8" /><path d="M0 -3 L3.5 0 L0 3 L-3.5 0 Z" fill="none" stroke="#8a6a20" strokeWidth="0.7" /></g>;
      case "leone":
        return <g><circle r="5.8" fill="#e8c870" stroke="#8a6a20" strokeWidth="0.8" /><circle r="3.4" fill="#c9a44a" /><path d="M-1.4 -0.6 h0.8 M0.6 -0.6 h0.8 M-1 1.4 Q0 2.2 1 1.4" stroke="#6b4a10" strokeWidth="0.6" /></g>;
      case "freccia":
        return <g><rect x="-6.4" y="-4.6" width="12.8" height="9.2" rx="1.8" fill="#9aa3ad" stroke="#4d555d" strokeWidth="0.8" /><path d="M-4 2 L4 -2 M4 -2 L1.6 -2.2 M4 -2 L3.2 0" stroke="#4d555d" strokeWidth="0.9" /></g>;
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
      case "bisaccia":
        return <g><path d="M-9 0 H9 V11 Q9 15 5 15 H-5 Q-9 15 -9 11 Z" fill="#6b5a48" stroke="#3a2a1e" strokeWidth="0.8" /><path d="M-9 0 Q0 7 9 0" fill="#5a4a38" stroke="#3a2a1e" strokeWidth="0.6" /><path d="M-5 8 H5" stroke="#c9a46a" strokeWidth="0.8" /></g>;
      case "astuccio":
        return <g><rect x="-3.6" y="0" width="7.2" height="17" rx="2" fill="#3a3d42" stroke="#1d1f22" strokeWidth="0.8" /><rect x="-3.6" y="3" width="7.2" height="1.6" fill="#c4473d" /></g>;
      default:
        return <path d="M-6 0 h12 v14 a3 3 0 0 1 -3 3 h-6 a3 3 0 0 1 -3 -3 z" fill="#7a4a26" stroke="#4a2c16" strokeWidth="0.8" />;
    }
  })();
  return <g transform={`translate(${f(x)} ${f(y)}) scale(${s})`}>{g}</g>;
}

export function Clasp({ kind, x, y, s = 1 }: { kind: string; x: number; y: number; s?: number }) {
  // fermagli come piccoli gioielli: ombra portata, metallo con luce in alto a sinistra, spillo dietro
  const metal = (hi: string, mid: string, lo: string, r = 4.6) => (
    <g>
      <path d={`M${-r - 2.6} 1.6 L${r + 2.6} -1.6`} stroke={lo} strokeWidth="1.1" strokeLinecap="round" />
      <circle r={r} fill={mid} stroke={lo} strokeWidth="0.8" />
      <path d={`M${-r * 0.78} ${-r * 0.2} A${r * 0.8} ${r * 0.8} 0 0 1 ${r * 0.35} ${-r * 0.72}`} stroke={hi} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d={`M${r * 0.75} ${r * 0.25} A${r * 0.8} ${r * 0.8} 0 0 1 ${-r * 0.3} ${r * 0.75}`} stroke={lo} strokeOpacity="0.7" strokeWidth="1" fill="none" strokeLinecap="round" />
    </g>
  );
  const g = (() => {
    switch (kind) {
      case "oro":
        return (
          <g>
            {metal("#fff3c4", "#e2bd5c", "#7a5614")}
            <circle r="2.6" fill="none" stroke="#9a7420" strokeWidth="0.7" />
            {Array.from({ length: 8 }, (_, i) => <circle key={i} cx={Math.cos(i * 0.785) * 3.6} cy={Math.sin(i * 0.785) * 3.6} r="0.45" fill="#7a5614" />)}
            <circle r="1.3" fill="#b8323a" stroke="#6a1418" strokeWidth="0.4" />
            <circle cx="-0.45" cy="-0.45" r="0.4" fill="#fff" opacity="0.8" />
          </g>
        );
      case "argento":
        return (
          <g>
            {metal("#ffffff", "#cdd3da", "#59616b")}
            <path d="M-2.6 0 H2.6 M0 -2.6 V2.6" stroke="#59616b" strokeWidth="1" strokeLinecap="round" />
            <path d="M-1.8 -1.8 L1.8 1.8 M1.8 -1.8 L-1.8 1.8" stroke="#8a929c" strokeWidth="0.5" />
            <circle r="0.9" fill="#3f6fa8" />
          </g>
        );
      case "foglia":
        return (
          <g>
            <path d="M-6.4 2.2 C-5 -4.6 2 -6.8 6.6 -5.6 C5.6 0.4 -0.4 5.6 -6.4 2.2 Z" fill="#5f8a30" stroke="#3a5a1a" strokeWidth="0.8" />
            <path d="M-6 2 C-2 -0.6 2 -3 6.2 -5.2" stroke="#d9b45a" strokeWidth="0.9" fill="none" />
            {[-3, -0.6, 1.8].map((k) => <path key={k} d={`M${k} ${-0.2 - (k + 3) * 0.5} l1.6 2.6 M${k} ${-0.2 - (k + 3) * 0.5} l-1.2 -2.6`} stroke="#d9b45a" strokeWidth="0.5" />)}
            <path d="M-4.6 0.6 C-3.4 -3.4 1 -5 4.6 -4.8" stroke="#a6c86a" strokeOpacity="0.6" strokeWidth="0.7" fill="none" />
          </g>
        );
      case "drago":
        return (
          <g>
            {metal("#f6e0a8", "#c49a58", "#5a3a12", 5)}
            <path d="M-3 2.4 C-2 -1.6 1 -0.4 0.6 -3 C3.2 -2.4 3.4 1.6 0.4 3 C-0.8 3.4 -2 3.2 -3 2.4 Z" fill="#5a3a12" />
            <circle cx="1.4" cy="-1.6" r="0.5" fill="#e04a2a" />
            <path d="M-3 2.4 l-1.2 0.6 M0.6 -3 l0.2 -1.2" stroke="#5a3a12" strokeWidth="0.7" strokeLinecap="round" />
          </g>
        );
      case "gemma":
        return (
          <g>
            <path d="M0 -6 L5.4 0 L0 6 L-5.4 0 Z" fill="#c9a24e" stroke="#6b4e14" strokeWidth="0.8" />
            <path d="M0 -4 L3.4 0 L0 4 L-3.4 0 Z" fill="#23a07a" stroke="#0e5a40" strokeWidth="0.5" />
            <path d="M0 -4 L-3.4 0 L0 0 Z" fill="#6ee0b6" opacity="0.6" />
            <path d="M0 4 L3.4 0 L0 0 Z" fill="#0e5a40" opacity="0.5" />
            <circle cx="-1.2" cy="-1.4" r="0.5" fill="#fff" opacity="0.9" />
          </g>
        );
      case "bronzo":
        return (
          <g>
            {metal("#f6caa0", "#b5713e", "#5a2e12")}
            <path d="M-2.4 -2.4 L2.4 2.4 M2.4 -2.4 L-2.4 2.4" stroke="#5a2e12" strokeWidth="0.9" strokeLinecap="round" />
          </g>
        );
      case "luna":
        return (
          <g>
            {metal("#ffffff", "#d6dbe1", "#5d646b")}
            <path d="M1 -3 A3.2 3.2 0 1 0 1 3 A2.4 2.4 0 1 1 1 -3 Z" fill="#5d646b" />
          </g>
        );
      case "freccia":
        return (
          <g>
            <path d="M-7 3.6 L5.4 -3.6" stroke="#c9a24e" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M5.4 -3.6 L1.6 -3.4 L4 -0.4 Z" fill="#e2bd5c" stroke="#7a5614" strokeWidth="0.5" />
            <path d="M-7 3.6 l-1 -2.2 M-7 3.6 l2.4 0.6" stroke="#b8323a" strokeWidth="1" strokeLinecap="round" />
          </g>
        );
      case "nodo":
        return (
          <g>
            <path d="M-5 -2 C-2 -6 2 2 5 -2 M-5 2 C-2 6 2 -2 5 2" stroke="#d9b45a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <circle r="1.4" fill="#d9b45a" />
          </g>
        );
      default:
        return null;
    }
  })();
  if (!g) return null;
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${s})`}>
      <ellipse cx="0.9" cy="1.4" rx="5.4" ry="4.6" fill="#000" opacity="0.28" />
      {g}
    </g>
  );
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
    case "smeraldo":
      return ring("url(#aa-fr-sm)", 6, <defs><linearGradient id="aa-fr-sm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c9ffe6" /><stop offset="0.5" stopColor="#1f9e6a" /><stop offset="1" stopColor="#0b4a32" /></linearGradient></defs>);
    case "rubino":
      return ring("url(#aa-fr-ru)", 6, <defs><linearGradient id="aa-fr-ru" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd0d6" /><stop offset="0.5" stopColor="#c4243a" /><stop offset="1" stopColor="#5a0a16" /></linearGradient></defs>);
    case "zaffiro":
      return ring("url(#aa-fr-za)", 6, <defs><linearGradient id="aa-fr-za" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d6e6ff" /><stop offset="0.5" stopColor="#2a5bd1" /><stop offset="1" stopColor="#0d2260" /></linearGradient></defs>);
    case "corda":
      return <g>{ring("#c9a46a", 4)}{Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * Math.PI * 2; return <path key={i} d={`M${f(50 + Math.cos(a) * 46)} ${f(50 + Math.sin(a) * 46)} l${f(Math.cos(a + 0.9) * 3)} ${f(Math.sin(a + 0.9) * 3)}`} stroke="#7a5a2a" strokeWidth="0.9" />; })}</g>;
    case "stelle":
      return <g>{ring("#2b2d42", 5)}{Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 - Math.PI / 2; const x = 50 + Math.cos(a) * 47.5; const y = 50 + Math.sin(a) * 47.5; return <path key={i} d={`M${f(x)} ${f(y - 3)} l0.9 2 l2.1 0.2 l-1.6 1.4 l0.5 2.1 l-1.9 -1.1 l-1.9 1.1 l0.5 -2.1 l-1.6 -1.4 l2.1 -0.2 Z`} fill="#ffd166" />; })}</g>;
    case "alloro":
      return <g>{[-1, 1].map((sd) => Array.from({ length: 9 }, (_, i) => { const a = Math.PI / 2 + sd * (0.35 + i * 0.27); const x = 50 + Math.cos(a) * 46; const y = 50 + Math.sin(a) * 46; return <ellipse key={`${sd}${i}`} cx={f(x)} cy={f(y)} rx="2.2" ry="4.6" fill={i % 2 ? "#c9a44a" : "#e8c870"} transform={`rotate(${f((a * 180) / Math.PI + 90 + sd * 30)} ${f(x)} ${f(y)})`} />; }))}</g>;
    case "pietra":
      return ring("#7d8085", 7, <g>{Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return <path key={i} d={`M${f(50 + Math.cos(a) * 43)} ${f(50 + Math.sin(a) * 43)} L${f(50 + Math.cos(a) * 50)} ${f(50 + Math.sin(a) * 50)}`} stroke="#4d5054" strokeWidth="0.9" />; })}</g>);
    case "tramonto":
      return ring("url(#aa-fr-tr)", 6, <defs><linearGradient id="aa-fr-tr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffb86b" /><stop offset="0.5" stopColor="#e5566b" /><stop offset="1" stopColor="#5b3a8a" /></linearGradient></defs>);
    case "perle":
      return <g>{Array.from({ length: 30 }, (_, i) => { const a = (i / 30) * Math.PI * 2; return <circle key={i} cx={f(50 + Math.cos(a) * 47)} cy={f(50 + Math.sin(a) * 47)} r="2.6" fill="#f6f2ea" stroke="#c9bfae" strokeWidth="0.4" />; })}</g>;
    case "ferro":
      return <g>{ring("#55585a", 6)}{Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return <circle key={i} cx={f(50 + Math.cos(a) * 47)} cy={f(50 + Math.sin(a) * 47)} r="1.5" fill="#9aa3ad" />; })}</g>;
    case "nastro":
      return <g>{ring("#c4473d", 5)}<path d="M30 92 L50 84 L70 92 L66 99 L50 93 L34 99 Z" fill="#a0302a" /></g>;
    case "fiori":
      return <g>{Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; const x = 50 + Math.cos(a) * 46; const y = 50 + Math.sin(a) * 46; return <g key={i}>{[0, 1, 2, 3, 4].map((k) => <circle key={k} cx={f(x + Math.cos(k * 1.256) * 2.4)} cy={f(y + Math.sin(k * 1.256) * 2.4)} r="1.8" fill={["#ff8fa3", "#ffd166", "#f4f1ea", "#b8a1ff"][i % 4]} />)}<circle cx={f(x)} cy={f(y)} r="1.2" fill="#e6b325" /></g>; })}</g>;
    default:
      return null;
  }
}
