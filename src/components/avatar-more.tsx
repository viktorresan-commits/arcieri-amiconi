/**
 * Disegni delle scelte nuove dell'avatar (dati in lib/arcieri/avatar-more.ts): tessuti, stemmi, pitture,
 * segni e tatuaggi sul viso (di fronte e di profilo), orecchini, ornamenti, cornici, piccoli gioielli,
 * ciondoli, bende e faretre. Tratto definito: contorno scuro e luce sul metallo.
 */
import type { ReactNode } from "react";
import { BROWSHAPES, EARRINGS2, EMBLEMS2, EYEPATCHES, FRAMES2, HAIRACC2, MARKS2, PAINTS2, PATTERNS2, PENDANTS, QUIVERS2, TATTOO2, type Medal, type MarkSpec } from "@/lib/arcieri/avatar-more";
import { PaintStroke } from "./avatar-extras";
import { METALS } from "./avatar-ink";

const f = (n: number) => (Math.round(n * 100) / 100).toString();
const MET = (m: string) => METALS[m] ?? (m === "osso" ? (["#fffaf0", "#eadfc8", "#8a7a5a"] as [string, string, string]) : METALS.oro);

/* ---------------- tessuti ---------------- */
export function Pattern2Tile({ kind, id, trim, dark, light }: { kind: string; id: string; trim: string; dark: string; light: string }) {
  const p = PATTERNS2.find((x) => x[0] === kind);
  if (!p) return null;
  const html = p[4].replace(/="T"/g, `="${trim}"`).replace(/="D"/g, `="${dark}"`).replace(/="L"/g, `="${light}"`);
  return <pattern id={id} width={p[2]} height={p[3]} patternUnits="userSpaceOnUse" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ---------------- stemmi ---------------- */
export function Emblem2({ kind, color }: { kind: string; color: string }) {
  const e = EMBLEMS2.find((x) => x[0] === kind);
  if (!e) return null;
  return (
    <g>
      {e[2] ? <path d={e[2]} fill={color} fillRule="evenodd" /> : null}
      {e[3] ? <path d={e[3]} stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </g>
  );
}
export const hasEmblem2 = (kind: string) => EMBLEMS2.some((x) => x[0] === kind);

/* ---------------- pitture sul viso ---------------- */
function Dab2({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return <g><circle cx={f(x)} cy={f(y)} r={f(r)} fill={color} opacity="0.86" /><circle cx={f(x - r * 0.3)} cy={f(y - r * 0.3)} r={f(r * 0.35)} fill="#fff" opacity="0.18" /></g>;
}
export function paint2Color(kind: string) {
  return PAINTS2.find((p) => p.id === kind)?.color ?? "#2a3a5a";
}
export function Paint2Front({ kind, ey, rx }: { kind: string; ey: number; rx: number }) {
  const p = PAINTS2.find((x) => x.id === kind);
  if (!p) return null;
  const c = p.color ?? "#2a3a5a";
  const k = rx / 19;
  const draw = (sd: 1 | -1) =>
    p.f.map((q, i) => {
      const X = (u: number) => 50 + sd * u * k;
      if (q[0] === "d") return <Dab2 key={`${sd}${i}`} x={X(Number(q[1]))} y={ey + Number(q[2])} r={Number(q[3])} color={c} />;
      return <PaintStroke key={`${sd}${i}`} a={[X(Number(q[1])), ey + Number(q[2])]} b={[X(Number(q[3])), ey + Number(q[4])]} bend={sd * Number(q[5])} w={Number(q[6])} color={c} />;
    });
  return <g>{draw(1)}{p.m ? draw(-1) : null}</g>;
}
export function Paint2Profile({ kind }: { kind: string }) {
  const p = PAINTS2.find((x) => x.id === kind);
  if (!p) return null;
  const c = p.color ?? "#2a3a5a";
  return (
    <g>
      {p.p.map((q, i) => (q[0] === "d" ? <Dab2 key={i} x={Number(q[1])} y={Number(q[2])} r={Number(q[3])} color={c} /> : <PaintStroke key={i} a={[Number(q[1]), Number(q[2])]} b={[Number(q[3]), Number(q[4])]} bend={Number(q[5])} w={Number(q[6])} color={c} />))}
    </g>
  );
}

/* ---------------- segni e tatuaggi ---------------- */
function prims(list: (string | number)[][], X: (u: number) => number, Y: (v: number) => number, skin: string, sd: number, dark: (c: string, k: number) => string) {
  const scar = dark(skin, -0.42);
  const scarLt = dark(skin, 0.25);
  const ink = "#24324a";
  return list.map((q, i) => {
    const n = (j: number) => Number(q[j]);
    switch (q[0]) {
      case "l":
        return (
          <g key={i}>
            <path d={`M${f(X(n(1)))} ${f(Y(n(2)))} L${f(X(n(3)))} ${f(Y(n(4)))}`} stroke={scar} strokeWidth={n(5)} strokeLinecap="round" />
            <path d={`M${f(X(n(1)) + 0.35)} ${f(Y(n(2)) - 0.2)} L${f(X(n(3)) + 0.35)} ${f(Y(n(4)) - 0.2)}`} stroke={scarLt} strokeOpacity="0.6" strokeWidth={n(5) * 0.4} strokeLinecap="round" />
          </g>
        );
      case "t":
        return <path key={i} d={`M${f(X(n(1)) - 1.2 * sd)} ${f(Y(n(2)) - 0.8)} l${f(2.4 * sd)} 1.6`} stroke={scar} strokeWidth="0.6" strokeLinecap="round" />;
      case "m":
        return <circle key={i} cx={f(X(n(1)))} cy={f(Y(n(2)))} r={n(3)} fill="#3a2414" opacity="0.85" />;
      case "o":
        return <ellipse key={i} cx={f(X(n(1)))} cy={f(Y(n(2)))} rx={n(3)} ry={n(4)} fill={dark(skin, -0.35)} opacity="0.35" />;
      case "i":
        return <path key={i} d={`M${f(X(n(1)))} ${f(Y(n(2)))} L${f(X(n(3)))} ${f(Y(n(4)))}`} stroke={ink} strokeOpacity="0.88" strokeWidth={n(5)} strokeLinecap="round" />;
      case "k":
        return <circle key={i} cx={f(X(n(1)))} cy={f(Y(n(2)))} r={n(3)} fill={ink} opacity="0.88" />;
      default:
        return null;
    }
  });
}
function specOf(kind: string): MarkSpec | undefined {
  return MARKS2.find((x) => x.id === kind) ?? TATTOO2.find((x) => x.id === kind);
}
export function Marks2Front({ kinds, ey, rx, skin, shade }: { kinds: string[]; ey: number; rx: number; skin: string; shade: (c: string, k: number) => string }) {
  const k = rx / 19;
  return (
    <g pointerEvents="none">
      {kinds.map((kind) => {
        const s = specOf(kind);
        if (!s) return null;
        return (
          <g key={kind}>
            {prims(s.f, (u) => 50 + u * k, (v) => ey + v, skin, 1, shade)}
            {s.m ? prims(s.f, (u) => 50 - u * k, (v) => ey + v, skin, -1, shade) : null}
          </g>
        );
      })}
    </g>
  );
}
export function Marks2Profile({ kinds, skin, shade }: { kinds: string[]; skin: string; shade: (c: string, k: number) => string }) {
  return <g pointerEvents="none">{kinds.map((kind) => { const s = specOf(kind); return s ? <g key={kind}>{prims(s.p, (x) => x, (y) => y, skin, 1, shade)}</g> : null; })}</g>;
}

/* ---------------- orecchini ---------------- */
export function Earring2({ kind, x, y }: { kind: string; x: number; y: number }) {
  const e = EARRINGS2.find((q) => q[0] === kind);
  if (!e) return null;
  const [hi, mid, lo] = MET(e[3]);
  const gem = e[4];
  const at = (n: ReactNode) => <g transform={`translate(${f(x)} ${f(y)})`}>{n}</g>;
  switch (e[2]) {
    case "anello":
      return at(<g fill="none"><circle r="1.9" stroke={lo} strokeWidth="1.5" /><circle r="1.9" stroke={mid} strokeWidth="0.9" /><path d="M-1.4 -1.2 a1.9 1.9 0 0 1 1.6 -0.7" stroke={hi} strokeWidth="0.5" /></g>);
    case "anello-grande":
      return at(<g fill="none"><circle cy="1.6" r="3.2" stroke={lo} strokeWidth="1.5" /><circle cy="1.6" r="3.2" stroke={mid} strokeWidth="0.9" /><path d="M-2.4 -0.2 a3.2 3.2 0 0 1 2.4 -1.4" stroke={hi} strokeWidth="0.5" /></g>);
    case "borchia":
      return at(<g><circle r="1.5" fill={gem || mid} stroke={lo} strokeWidth="0.5" />{gem ? <circle r="1.9" fill="none" stroke={mid} strokeWidth="0.5" /> : null}<circle cx="-0.5" cy="-0.5" r="0.45" fill="#fff" opacity="0.9" /></g>);
    case "goccia":
      return at(<g><path d="M0 -0.8 V2" stroke={mid} strokeWidth="0.6" /><path d="M0 2 C2 4.6 1.8 7 0 7 C-1.8 7 -2 4.6 0 2 Z" fill={gem || mid} stroke={lo} strokeWidth="0.5" /><circle cx="-0.6" cy="5" r="0.45" fill="#fff" opacity="0.8" /></g>);
    case "catena":
      return at(<g><path d="M0 -0.5 V7" stroke={lo} strokeWidth="1" strokeDasharray="0.9 0.5" /><path d="M0 -0.5 V7" stroke={mid} strokeWidth="0.55" strokeDasharray="0.9 0.5" /><circle cy="7.6" r="0.9" fill={mid} stroke={lo} strokeWidth="0.4" /></g>);
    case "foglia":
      return at(<g><path d="M0 0 V1" stroke={mid} strokeWidth="0.6" /><path d="M0 1 C2.4 3 2 6 0 8 C-2 6 -2.4 3 0 1 Z" fill={mid} stroke={lo} strokeWidth="0.5" /><path d="M0 1.6 V7.2" stroke={lo} strokeWidth="0.35" /></g>);
    case "freccia":
      return at(<g><path d="M0 -0.5 V2" stroke={mid} strokeWidth="0.6" /><path d="M0 8 L-1.8 3.6 L0 2 L1.8 3.6 Z" fill={mid} stroke={lo} strokeWidth="0.5" strokeLinejoin="round" /><path d="M0 2.4 V7" stroke={hi} strokeWidth="0.35" /></g>);
    case "osso":
      return at(<g><path d="M0 -0.5 V1.4" stroke="#6b4224" strokeWidth="0.7" /><rect x="-0.9" y="1.4" width="1.8" height="5.4" rx="0.8" fill="#f2ead8" stroke="#8a7a5a" strokeWidth="0.45" /><circle cx="-0.7" cy="1.6" r="0.75" fill="#f2ead8" stroke="#8a7a5a" strokeWidth="0.35" /><circle cx="0.7" cy="1.6" r="0.75" fill="#f2ead8" stroke="#8a7a5a" strokeWidth="0.35" /></g>);
    case "conchiglia":
      return at(<g><path d="M0 -0.5 V1.4" stroke={mid} strokeWidth="0.6" /><path d="M-2.4 3.6 C-2.4 1 2.4 1 2.4 3.6 L0.8 5.6 H-0.8 Z" fill="#f4ead8" stroke="#a08a6a" strokeWidth="0.45" /><path d="M0 2 V5.6 M-1.2 2.4 L-0.6 5.6 M1.2 2.4 L0.6 5.6" stroke="#a08a6a" strokeWidth="0.3" /></g>);
    case "piuma":
      return at(<g><path d="M0 -0.5 V2" stroke={mid} strokeWidth="0.6" /><path d="M0 2 C2.4 5 1.6 10 0 12 C-1.6 10 -2.4 5 0 2 Z" fill={gem || "#2f6fbe"} stroke={lo} strokeWidth="0.4" /><path d="M0 2.6 V11.4" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.3" /></g>);
    default:
      return null;
  }
}
export const hasEarring2 = (kind: string) => EARRINGS2.some((q) => q[0] === kind);

/* ---------------- ornamenti dei capelli (coordinate locali, ~-5..5) ---------------- */
export function HairAcc2({ kind, color }: { kind: string; color: string }) {
  if (!HAIRACC2.some((q) => q[0] === kind)) return null;
  switch (kind) {
    case "fermaglio-argento":
      return <g><rect x="-4.8" y="-1.6" width="9.6" height="3.2" rx="1.4" fill="#d7dbe1" stroke="#5a6068" strokeWidth="0.6" /><path d="M-3.6 -0.6 H2" stroke="#fff" strokeOpacity="0.8" strokeWidth="0.5" /></g>;
    case "piuma-blu":
    case "piuma-rossa": {
      const c = kind === "piuma-blu" ? "#2f6fbe" : "#c4473d";
      return <g transform="rotate(-20)"><path d="M0 4 C3 -1 3 -8 0 -12 C-3 -8 -3 -1 0 4 Z" fill={c} stroke="#1a120c" strokeWidth="0.5" /><path d="M0 3.6 V-11" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.35" /><path d="M0 -4 l2 -1.4 M0 -7 l-2 -1.4" stroke="#1a120c" strokeOpacity="0.4" strokeWidth="0.3" /></g>;
    }
    case "nastro-verde":
      return <g fill="#3f8a4e" stroke="#14301f" strokeWidth="0.5"><path d="M0 0 L-5 -3.4 L-5 3.4 Z M0 0 L5 -3.4 L5 3.4 Z" /><path d="M-1 0.6 L-3 8 L-1.6 7.4 Z M1 0.6 L3 8 L1.6 7.4 Z" /><circle r="1.4" /></g>;
    case "perla":
      return <g><circle r="2.2" fill="#f6f2ea" stroke="#a8a090" strokeWidth="0.5" /><circle cx="-0.7" cy="-0.7" r="0.7" fill="#fff" /></g>;
    case "foglia-verde":
      return <g transform="rotate(-30)"><path d="M0 4 C4 1 4 -5 0 -8 C-4 -5 -4 1 0 4 Z" fill="#4f7a2a" stroke="#1f3a12" strokeWidth="0.5" /><path d="M0 3.4 V-7" stroke="#a8d080" strokeWidth="0.4" /></g>;
    case "stella-oro":
      return <path d="M0 -4 L1.2 -1.2 L4 -1 L1.8 0.8 L2.6 3.6 L0 2 L-2.6 3.6 L-1.8 0.8 L-4 -1 L-1.2 -1.2 Z" fill="#e8c870" stroke="#7a5a1a" strokeWidth="0.5" strokeLinejoin="round" />;
    case "luna-argento":
      return <path d="M1.4 -3.8 A4 4 0 1 0 1.4 3.8 A3 3 0 1 1 1.4 -3.8 Z" fill="#d7dbe1" stroke="#5a6068" strokeWidth="0.5" />;
    case "rametto":
      return <g stroke="#3a2412" strokeWidth="0.6" fill="#5f8a3a"><path d="M-5 3 L5 -3" fill="none" /><ellipse cx="-2" cy="0.2" rx="1.6" ry="0.8" transform="rotate(-60 -2 0.2)" /><ellipse cx="1" cy="-1.6" rx="1.6" ry="0.8" transform="rotate(-60 1 -1.6)" /><ellipse cx="0" cy="1.4" rx="1.6" ry="0.8" transform="rotate(30 0 1.4)" /><ellipse cx="3" cy="-0.4" rx="1.6" ry="0.8" transform="rotate(30 3 -0.4)" /></g>;
    case "spiga":
      return <g transform="rotate(-25)"><path d="M0 6 V-6" stroke="#8a6a20" strokeWidth="0.6" />{[-4, -1.6, 0.8, 3.2].map((y) => <g key={y} fill="#e0b84a" stroke="#8a6a20" strokeWidth="0.35"><ellipse cx="-1" cy={y} rx="1" ry="1.6" transform={`rotate(-25 -1 ${y})`} /><ellipse cx="1" cy={y} rx="1" ry="1.6" transform={`rotate(25 1 ${y})`} /></g>)}</g>;
    default:
      return <circle r="2" fill={color} />;
  }
}

/* ---------------- cornici ---------------- */
export function Frame2({ kind }: { kind: string }) {
  const q = FRAMES2.find((x) => x[0] === kind);
  if (!q) return null;
  const [id, , [a, b, c], motif, mc] = q;
  const gid = `aa-fr2-${id}`;
  const around = (n: number, r: number, node: (x: number, y: number, ang: number, i: number) => ReactNode) =>
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2 - Math.PI / 2;
      return node(50 + Math.cos(t) * r, 50 + Math.sin(t) * r, (t * 180) / Math.PI, i);
    });
  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="0.5" stopColor={b} /><stop offset="1" stopColor={c} /></linearGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="none" stroke={c} strokeWidth="7" opacity="0.9" />
      <circle cx="50" cy="50" r="47" fill="none" stroke={`url(#${gid})`} strokeWidth="5.4" />
      <circle cx="50" cy="50" r="44.2" fill="none" stroke={c} strokeWidth="0.6" opacity="0.8" />
      {motif === "perle" ? around(24, 47, (x, y, _a, i) => <circle key={i} cx={f(x)} cy={f(y)} r="1.3" fill={mc} opacity="0.95" />) : null}
      {motif === "rombi" ? around(12, 47, (x, y, ang, i) => <path key={i} d="M0 -2.4 L1.6 0 L0 2.4 L-1.6 0 Z" fill={mc} stroke={c} strokeWidth="0.4" transform={`translate(${f(x)} ${f(y)}) rotate(${f(ang + 90)})`} />) : null}
      {motif === "stelle" ? around(10, 47, (x, y, _a, i) => <path key={i} d="M0 -2.2 L0.6 -0.6 L2.2 -0.6 L0.9 0.4 L1.4 2 L0 1 L-1.4 2 L-0.9 0.4 L-2.2 -0.6 L-0.6 -0.6 Z" fill={mc} transform={`translate(${f(x)} ${f(y)})`} />) : null}
      {motif === "foglie" ? around(16, 47, (x, y, ang, i) => <ellipse key={i} cx="0" cy="0" rx="1.4" ry="3" fill={mc} stroke={c} strokeWidth="0.3" transform={`translate(${f(x)} ${f(y)}) rotate(${f(ang + (i % 2 ? 60 : 120))})`} />) : null}
      {motif === "rivetti" ? around(16, 47, (x, y, _a, i) => <g key={i}><circle cx={f(x)} cy={f(y)} r="1.1" fill={mc} stroke={c} strokeWidth="0.4" /></g>) : null}
      {motif === "onde" ? around(14, 47, (x, y, ang, i) => <path key={i} d="M-2.4 0 q1.2 -1.6 2.4 0 t2.4 0" stroke={mc} strokeWidth="0.8" fill="none" transform={`translate(${f(x)} ${f(y)}) rotate(${f(ang + 90)})`} />) : null}
      {motif === "croci" ? around(8, 47, (x, y, _a, i) => <path key={i} d={`M${f(x - 2)} ${f(y)} H${f(x + 2)} M${f(x)} ${f(y - 2)} V${f(y + 2)}`} stroke={mc} strokeWidth="1.2" />) : null}
      {motif === "frecce" ? around(8, 47, (x, y, ang, i) => <path key={i} d="M-3 0 H3 M3 0 l-1.4 -1.2 M3 0 l-1.4 1.2" stroke={mc} strokeWidth="0.9" fill="none" transform={`translate(${f(x)} ${f(y)}) rotate(${f(ang + 90)})`} />) : null}
      {motif === "rune" ? around(10, 47, (x, y, ang, i) => <path key={i} d={["M0 -2 V2 M0 -1 l1.4 -1", "M-1 -2 L1 0 L-1 2", "M0 -2 V2 M-1.2 0 H1.2", "M-1 2 V-2 L1 0"][i % 4]} stroke={mc} strokeWidth="0.7" fill="none" transform={`translate(${f(x)} ${f(y)}) rotate(${f(ang + 90)})`} />) : null}
      {motif === "bersaglio" ? <>{["#f4f1ea", "#14181c", "#2f7fd0", mc, "#f2c84b"].map((cc, i) => <circle key={cc + i} cx="50" cy="50" r={f(49.4 - i * 0.9)} fill="none" stroke={cc} strokeWidth="0.8" />)}</> : null}
    </g>
  );
}

/* ---------------- piccoli gioielli: fibbie, fermagli, ciondoli (raggio ~5) ---------------- */
export function Medallion({ m, s = 1, glyphColor }: { m: Medal; s?: number; glyphColor?: string }) {
  const [, , shape, metal, gem, glyph] = m;
  const [hi, mid, lo] = MET(metal || "oro");
  const fill = metal ? mid : gem || mid;
  const d = (() => {
    switch (shape) {
      case "scudo": return "M-4.6 -5 H4.6 V0 C4.6 3.6 2 5.4 0 6.2 C-2 5.4 -4.6 3.6 -4.6 0 Z";
      case "rombo": return "M0 -6 L4.4 0 L0 6 L-4.4 0 Z";
      case "goccia": return "M0 -6 C3 -2 4.6 1 4.6 3 C4.6 5.6 2.4 6.6 0 6.6 C-2.4 6.6 -4.6 5.6 -4.6 3 C-4.6 1 -3 -2 0 -6 Z";
      case "ovale": return "M0 -6 C3.6 -6 4.4 -2.6 4.4 0 C4.4 2.6 3.6 6 0 6 C-3.6 6 -4.4 2.6 -4.4 0 C-4.4 -2.6 -3.6 -6 0 -6 Z";
      case "stella": return "M0 -6 L1.6 -2.2 L5.6 -1.8 L2.6 0.8 L3.6 4.8 L0 2.8 L-3.6 4.8 L-2.6 0.8 L-5.6 -1.8 L-1.6 -2.2 Z";
      case "esagono": return "M-2.8 -5 H2.8 L5.4 0 L2.8 5 H-2.8 L-5.4 0 Z";
      case "croce": return "M-1.6 -6 H1.6 V-1.6 H5 V1.6 H1.6 V6.4 H-1.6 V1.6 H-5 V-1.6 H-1.6 Z";
      case "mezzaluna": return "M2 -5.6 A5.6 5.6 0 1 0 2 5.6 A4.2 4.2 0 1 1 2 -5.6 Z";
      case "foglia": return "M0 -6.4 C4.4 -3 4.4 3 0 6.4 C-4.4 3 -4.4 -3 0 -6.4 Z";
      case "quadro": return "M-5 -4.2 H5 V4.2 H-5 Z";
      case "freccia": return "M0 7 L-3.4 -1.6 L0 -6 L3.4 -1.6 Z";
      case "dente": return "M-2.4 -6 H2.4 C2.6 0 1 4.4 -0.8 7 C0 2 -1 -2 -2.4 -6 Z";
      case "chiave": return "M-0.8 -2 H0.8 V5 H2.6 V6.2 H0.8 V7.2 H2 V8.4 H-0.8 Z M0 -6.6 A2.6 2.6 0 1 1 -0.01 -6.6 Z";
      case "pietra": return "M-2 -5.6 C2 -6.4 5 -3 4.4 1 C3.8 5 0 6.6 -2.6 5 C-5 3.4 -5 -4.8 -2 -5.6 Z";
      default: return "M0 -5.4 A5.4 5.4 0 1 1 -0.01 -5.4 Z";
    }
  })();
  return (
    <g transform={s !== 1 ? `scale(${f(s)})` : undefined}>
      <path d={d} fill={lo} transform="translate(0.5 0.7)" opacity="0.45" />
      <path d={d} fill={fill} stroke={lo} strokeWidth="0.8" strokeLinejoin="round" fillRule="evenodd" />
      {metal ? <path d={d} fill="none" stroke={hi} strokeWidth="0.5" strokeOpacity="0.7" transform="translate(-0.25 -0.3) scale(0.82)" /> : null}
      {gem ? <g><circle r={shape === "quadro" ? 2.2 : 2.5} fill={gem} stroke={lo} strokeWidth="0.5" /><circle cx="-0.8" cy="-0.8" r="0.7" fill="#fff" opacity="0.85" /></g> : null}
      {glyph ? <g transform="scale(0.34)"><EmblemAny kind={glyph} color={glyphColor ?? lo} /></g> : null}
      {shape === "chiave" ? <circle cy="-4" r="1.2" fill={lo} /> : null}
    </g>
  );
}
/** uno stemma, nuovo o di prima: lo disegna avatar-extras (iniettato per non creare un giro di import) */
let emblemOld: ((p: { kind: string; color: string }) => ReactNode) | null = null;
export function registerEmblem(fn: (p: { kind: string; color: string }) => ReactNode) {
  emblemOld = fn;
}
function EmblemAny({ kind, color }: { kind: string; color: string }) {
  if (hasEmblem2(kind)) return <Emblem2 kind={kind} color={color} />;
  return <>{emblemOld ? emblemOld({ kind, color }) : null}</>;
}

/** ciondolo appeso a una catenella: la catena va da (x-w, y0) a (x+w, y0) e scende fino a (x, y) */
export function Pendant({ kind, x, y, w, y0, s = 1 }: { kind: string; x: number; y: number; w: number; y0: number; s?: number }) {
  const m = PENDANTS.find((q) => q[0] === kind);
  if (!m || kind === "nessuno") return null;
  const [, mid, lo] = MET(m[3] || "oro");
  const cord = m[3] === "osso" || m[2] === "pietra" || m[2] === "dente";
  const chain = `M${f(x - w)} ${f(y0)} Q${f(x)} ${f(y + (y - y0) * 0.25)} ${f(x + w)} ${f(y0)}`;
  return (
    <g pointerEvents="none">
      <path d={chain} stroke={cord ? "#2a1a10" : lo} strokeWidth={cord ? 1.1 : 1.5} fill="none" />
      {cord ? null : <path d={chain} stroke={mid} strokeWidth="0.9" fill="none" strokeDasharray="1.2 0.5" />}
      <g transform={`translate(${f(x)} ${f(y + 5 * s)})`}>
        <Medallion m={m} s={s} />
      </g>
    </g>
  );
}

/* ---------------- benda sull'occhio ---------------- */
export function EyepatchFront({ kind, ey, rx, ex = 59 }: { kind: string; ey: number; rx: number; ex?: number }) {
  const e = EYEPATCHES.find((q) => q[0] === kind);
  if (!e || kind === "nessuna") return null;
  const [, , shape, color, trim] = e;
  if (shape === "monocolo") {
    return (
      <g pointerEvents="none">
        <path d={`M${ex + 5} ${ey + 4} C${ex + 8} ${ey + 14} ${ex + 4} ${ey + 22} ${ex + 9} ${ey + 30}`} stroke="#b08a3a" strokeWidth="0.6" fill="none" strokeDasharray="1 0.5" />
        <circle cx={ex} cy={ey} r="6" fill="#d8f0ff" fillOpacity="0.18" stroke="#5a3e10" strokeWidth="2" />
        <circle cx={ex} cy={ey} r="6" fill="none" stroke={color} strokeWidth="1.2" />
        <path d={`M${ex - 3.6} ${ey - 2.4} q1.6 -2.4 4 -2.8`} stroke="#fff" strokeOpacity="0.6" strokeWidth="0.7" fill="none" />
      </g>
    );
  }
  if (shape === "garza") {
    return (
      <g pointerEvents="none">
        <path d={`M${50 - rx - 1} ${ey - 9} L${50 + rx + 1} ${ey + 1} L${50 + rx + 1} ${ey + 8} L${50 - rx - 1} ${ey - 2} Z`} fill={color} stroke="#a8a090" strokeWidth="0.6" />
        <path d={`M${50 - rx} ${ey - 6} L${50 + rx} ${ey + 4} M${50 - rx} ${ey - 4} L${50 + rx} ${ey + 6}`} stroke="#c9bfae" strokeWidth="0.4" />
        <path d={`M${ex - 3} ${ey + 2} l3 -2 M${ex - 1} ${ey + 3} l3 -2`} stroke="#c4473d" strokeOpacity="0.4" strokeWidth="0.8" />
      </g>
    );
  }
  const d = shape === "rombo" ? `M${ex} ${ey - 7} L${ex + 7} ${ey} L${ex} ${ey + 7} L${ex - 7} ${ey} Z` : `M${ex - 6.6} ${ey - 3} C${ex - 6} ${ey - 7} ${ex + 6} ${ey - 7} ${ex + 6.8} ${ey - 3} C${ex + 7.4} ${ey + 3} ${ex + 3} ${ey + 7} ${ex} ${ey + 7} C${ex - 3} ${ey + 7} ${ex - 7.2} ${ey + 3} ${ex - 6.6} ${ey - 3} Z`;
  return (
    <g pointerEvents="none">
      <path d={`M${ex - 6} ${ey - 3.4} L${50 - rx - 1} ${ey - 12} M${ex + 6} ${ey - 2.6} L${50 + rx + 1} ${ey - 1}`} stroke="#0e0a08" strokeWidth="1.6" strokeLinecap="round" />
      <path d={`M${ex - 6} ${ey - 3.4} L${50 - rx - 1} ${ey - 12} M${ex + 6} ${ey - 2.6} L${50 + rx + 1} ${ey - 1}`} stroke={trim === "oro" ? "#5a3e10" : "#2a2420"} strokeWidth="1" strokeLinecap="round" />
      <path d={d} fill={color} stroke="#0e0a08" strokeWidth="0.9" strokeLinejoin="round" />
      <path d={`M${ex - 4} ${ey - 4} q3 -1.6 6 -0.6`} stroke="#fff" strokeOpacity="0.18" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      {trim === "cuciture" ? <path d={d} fill="none" stroke="#d9b98a" strokeWidth="0.45" strokeDasharray="1 0.8" transform={`translate(${ex} ${ey}) scale(0.8) translate(${-ex} ${-ey})`} /> : null}
      {trim === "oro" ? <path d={d} fill="none" stroke="#e8c870" strokeWidth="0.7" transform={`translate(${ex} ${ey}) scale(0.82) translate(${-ex} ${-ey})`} /> : null}
      {trim === "borchie" ? [[-3.4, -2.4], [3.4, -2.4], [0, 3.4], [-3.4, 2], [3.4, 2]].map(([dx, dy]) => <circle key={`${dx}${dy}`} cx={ex + dx} cy={ey + dy} r="0.75" fill="#c7ccd2" stroke="#3a3f45" strokeWidth="0.3" />) : null}
    </g>
  );
}
export function EyepatchProfile({ kind }: { kind: string }) {
  const e = EYEPATCHES.find((q) => q[0] === kind);
  if (!e || kind === "nessuna") return null;
  const [, , shape, color, trim] = e;
  if (shape === "monocolo") {
    return <g pointerEvents="none"><circle cx="164" cy="82" r="5" fill="#d8f0ff" fillOpacity="0.18" stroke="#5a3e10" strokeWidth="1.8" /><circle cx="164" cy="82" r="5" fill="none" stroke={color} strokeWidth="1" /><path d="M160 86 C156 94 150 98 146 106" stroke="#b08a3a" strokeWidth="0.6" fill="none" strokeDasharray="1 0.5" /></g>;
  }
  if (shape === "garza") {
    return <g pointerEvents="none"><path d="M134 70 L172 78 L171 88 L133 80 Z" fill={color} stroke="#a8a090" strokeWidth="0.6" /><path d="M134 74 L172 82 M134 77 L171 85" stroke="#c9bfae" strokeWidth="0.4" /></g>;
  }
  const d = shape === "rombo" ? "M163 75 L170 82 L163 89 L157.6 82 Z" : "M157.6 80 C158 76 166 75 169.6 78.4 C170.6 83 168 88 163.6 88.4 C159.6 88.6 157.4 85 157.6 80 Z";
  return (
    <g pointerEvents="none">
      <path d="M158 79 L131 74" stroke="#0e0a08" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M158 79 L131 74" stroke={trim === "oro" ? "#5a3e10" : "#2a2420"} strokeWidth="1.1" strokeLinecap="round" />
      <path d={d} fill={color} stroke="#0e0a08" strokeWidth="0.9" strokeLinejoin="round" />
      {trim === "cuciture" ? <path d={d} fill="none" stroke="#d9b98a" strokeWidth="0.45" strokeDasharray="1 0.8" transform="translate(163.6 82) scale(0.78) translate(-163.6 -82)" /> : null}
      {trim === "oro" ? <path d={d} fill="none" stroke="#e8c870" strokeWidth="0.7" transform="translate(163.6 82) scale(0.8) translate(-163.6 -82)" /> : null}
      {trim === "borchie" ? [[161, 79], [166, 79], [163.6, 85.6]].map(([cx, cy]) => <circle key={cx + cy} cx={cx} cy={cy} r="0.75" fill="#c7ccd2" stroke="#3a3f45" strokeWidth="0.3" />) : null}
    </g>
  );
}

/* ---------------- sopracciglia ---------------- */
export function browShape(kind: string) {
  const b = BROWSHAPES.find((q) => q[0] === kind) ?? BROWSHAPES[0];
  return { arch: b[2], tilt: b[3], thick: b[4] };
}

/* ---------------- faretre nuove: bande, borchie e stemma sopra il corpo di cuoio ---------------- */
export const hasQuiver2 = (kind: string) => QUIVERS2.some((q) => q[0] === kind);
export function Quiver2Overlay({ kind, w, h, top }: { kind: string; w: number; h: number; top: number }) {
  const q = QUIVERS2.find((x) => x[0] === kind);
  if (!q) return null;
  const [, , band, metal, glyph] = q;
  const x = -w / 2;
  const [hi, mid, lo] = MET(metal || "bronzo");
  return (
    <g pointerEvents="none">
      {band ? [0.14, 0.86].map((u) => <g key={u}><rect x={x - 0.6} y={top + h * u - 3} width={w + 1.2} height="6" rx="1.4" fill={band} stroke="#140e0a" strokeWidth="0.7" /><path d={`M${x + 1} ${top + h * u - 1.6} H${x + w - 1}`} stroke="#fff" strokeOpacity="0.25" strokeWidth="0.6" /></g>) : null}
      {metal ? [0.14, 0.86].flatMap((u) => [0.22, 0.5, 0.78].map((k) => <g key={`${u}${k}`}><circle cx={x + w * k} cy={top + h * u} r="1.3" fill={mid} stroke={lo} strokeWidth="0.4" /><circle cx={x + w * k - 0.4} cy={top + h * u - 0.4} r="0.4" fill={hi} /></g>)) : null}
      {glyph ? (
        <g transform={`translate(0 ${top + h * 0.48})`}>
          <path d="M-6.6 -7 H6.6 V2 C6.6 6 3 8 0 9.4 C-3 8 -6.6 6 -6.6 2 Z" fill="#00000033" stroke={metal ? mid : "#c9a46a"} strokeWidth="0.9" />
          <g transform="scale(0.52)"><EmblemAny kind={glyph} color={metal ? hi : "#e8c870"} /></g>
        </g>
      ) : null}
    </g>
  );
}
