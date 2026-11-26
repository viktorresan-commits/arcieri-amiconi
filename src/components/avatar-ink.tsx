/**
 * Tratto definito dell'avatar, come nelle tavole di riferimento: contorno scuro "a china" del colore
 * dell'oggetto, punte di barba e baffi sul bordo e ciocche spesse leggibili anche in piccolo.
 */
import type { ReactNode } from "react";

type XY = [number, number];

function hexOf(c: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec((c || "").trim());
  return m ? Number.parseInt(m[1], 16) : null;
}

/** contorno a china: il colore dell'oggetto molto scurito, verso un bruno quasi nero */
export function ink(c: string, k = 0.55) {
  const n = hexOf(c);
  if (n == null) return "#1a120c";
  const t = [0x16, 0x0f, 0x0a];
  const ch = (sh: number, i: number) => Math.round(((n >> sh) & 255) * 0.36 * (1 - k) + t[i] * k);
  return `#${((ch(16, 0) << 16) | (ch(8, 1) << 8) | ch(0, 2)).toString(16).padStart(6, "0")}`;
}

/** punti lungo una curva di Bézier cubica, da t0 a t1 */
export function cubicPts(p0: XY, p1: XY, p2: XY, p3: XY, t0: number, t1: number, n: number): XY[] {
  const out: XY[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

const f = (n: number) => n.toFixed(2);

/**
 * Punte di peli sul bordo: tra due punti della curva una punta verso l'esterno (lontano dal centro),
 * lunghezze alterne. Riempite del colore della barba e contornate a china.
 */
export function Tufts({ pts, c, len, fill, stroke, w = 0.7, seed = 1 }: { pts: XY[]; c: XY; len: number; fill: string; stroke: string; w?: number; seed?: number }) {
  if (pts.length < 2) return null;
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    let nx = mx - c[0];
    let ny = my - c[1];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const r = Math.abs(Math.sin((i + 1) * 12.9898 * seed)) % 1;
    const k = len * (0.55 + r * 0.7);
    // la punta piega un po' verso il basso, come i peli che cadono
    const tx = mx + nx * k + (i % 2 ? 0.25 : -0.25);
    const ty = my + ny * k + k * 0.25;
    // base leggermente dentro la forma, così non resta una riga tra barba e punta
    const ix = (p: number, q: number) => [p - nx * 0.6, q - ny * 0.6];
    const [a1, a2] = ix(ax, ay);
    const [b1, b2] = ix(bx, by);
    // aperto: il tratto segue solo i due fianchi della punta, la base resta dentro la barba
    d += `M${f(a1)} ${f(a2)} Q${f((ax + tx) / 2)} ${f((ay + ty) / 2 + 0.2)} ${f(tx)} ${f(ty)} Q${f((bx + tx) / 2)} ${f((by + ty) / 2 + 0.2)} ${f(b1)} ${f(b2)}`;
  }
  return <path d={d} fill={fill} stroke={stroke} strokeWidth={w} strokeLinejoin="round" />;
}

/** ciocche spesse dentro una forma (ritagliate): scure e chiare, leggibili anche nella foto profilo */
export function Clumps({ id, clip, strokes, dark, light, w = 0.75 }: { id: string; clip: ReactNode; strokes: string[]; dark: string; light: string; w?: number }) {
  const dk = strokes.filter((_, i) => i % 3 !== 2).join("");
  const lt = strokes.filter((_, i) => i % 3 === 2).join("");
  return (
    <g pointerEvents="none">
      <clipPath id={id}>{clip}</clipPath>
      <g clipPath={`url(#${id})`} fill="none" strokeLinecap="round">
        <path d={dk} stroke={dark} strokeOpacity="0.7" strokeWidth={w} />
        <path d={lt} stroke={light} strokeOpacity="0.55" strokeWidth={w * 0.8} />
      </g>
    </g>
  );
}

/** ciocche che scendono a ventaglio da una linea (da x0 a x1, a quota y), lunghe "len", verso il centro cx */
export function fanStrokes(x0: number, x1: number, y: number, len: number, cx: number, n: number, seed = 1): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.abs(Math.sin((i + 3) * 78.233 * seed)) % 1;
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n + (r - 0.5) * 1.2;
    const off = (x - cx) / Math.max(1, Math.abs(x1 - x0) / 2);
    const L = len * (1 - off * off * 0.45) * (0.7 + r * 0.45);
    const sy = y + r * 2.4;
    const ex = x - off * 1.6;
    out.push(`M${f(x)} ${f(sy)} Q${f(x + off * 1.4)} ${f(sy + L * 0.55)} ${f(ex)} ${f(sy + L)}`);
  }
  return out;
}

/** metallo lucido per piccoli gioielli: gradiente oro/argento/bronzo */
export const METALS: Record<string, [string, string, string]> = {
  oro: ["#fff1b8", "#d9b45a", "#7a5a1a"],
  argento: ["#ffffff", "#c7ccd2", "#5a6068"],
  bronzo: ["#f1c58a", "#b5793a", "#5a3412"],
  ferro: ["#d7dbe0", "#7d848c", "#2d3238"],
  rame: ["#ffd0b0", "#c46b3a", "#5a2a12"],
};

export function MetalDefs({ uid }: { uid: string }) {
  return (
    <>
      {Object.entries(METALS).map(([k, [a, b, c]]) => (
        <linearGradient key={k} id={`${uid}mt${k}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="0.45" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      ))}
      <linearGradient id={`${uid}lens`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor="#3a4654" />
        <stop offset="0.55" stopColor="#11161c" />
        <stop offset="1" stopColor="#24303c" />
      </linearGradient>
      <linearGradient id={`${uid}glass`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor="#d8f0ff" stopOpacity="0.35" />
        <stop offset="1" stopColor="#a8d8ff" stopOpacity="0.08" />
      </linearGradient>
    </>
  );
}
