import { memo, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Sky } from "@/lib/arcieri/sky3d";
import { sceneById, type SceneId } from "@/lib/arcieri/scenes";
import { SKY, rnd } from "./scene-2d";

/**
 * Il gioco della Home si allunga verso il basso: sotto la scena continua il terreno più vicino a chi guarda
 * (erba, selciato, sabbia, neve, pavimento della palestra...), con i dettagli di ogni ambientazione e
 * qualche piccola animazione (farfalle, piccioni, foglie che cadono, lucciole, fiamme). I pulsanti della Home
 * stanno sopra questo terreno.
 *
 * Coordinate: le stesse della scena (400×300). Sul telefono la scena mostra le x da 87,5 a 312,5; qui si
 * prosegue sotto y = 300. La parte da y = 270 a 300 sta sotto il fondo della scena, che sfuma: così il
 * passaggio non si vede.
 */
export const APRON_Y0 = 270;
const X0 = 87.5;
const VW = 225;

const f = (v: number) => v.toFixed(1);
const hx = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const toHex = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: string, b: string, t: number) => {
  const A = hx(a);
  const B = hx(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
};
const dark = (a: string, t: number) => mix(a, "#000000", t);
const lite = (a: string, t: number) => mix(a, "#ffffff", t);
/** più vicino a chi guarda, più grande */
const sz = (y: number) => Math.min(1.7, Math.max(0.6, 1 + (y - 300) * 0.016));
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x + r)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`;

type K = {
  id: string;
  night: boolean;
  N: <T>(day: T, night: T) => T;
  /** inizio e fine del terreno disegnato */
  y0: number;
  y1: number;
  /** dove cominciano e finiscono i pulsanti: le cose da vedere stanno sopra e sotto */
  top: number;
  bottom: number;
  rain: boolean;
  /** riga su cui poggiano le cose sotto i pulsanti, e la loro scala */
  yb: number;
  sb: number;
};

/* ---------- mattoni del disegno ---------- */

function GrassField({ k, base, hues, tall = 1, seed = 1, stripes = false }: { k: K; base: string; hues: string[]; tall?: number; seed?: number; stripes?: boolean }) {
  const rows: ReactNode[] = [];
  let y = k.y0 + 1;
  let r = 0;
  while (y < k.y1 + 8 && r < 48) {
    const s = sz(y);
    const step = 2.5 * s;
    const n = Math.max(12, Math.round(300 / (4.4 * s)));
    let d = "";
    let hi = "";
    for (let i = 0; i < n; i++) {
      const j = r * 131 + i * 7 + seed * 1000;
      const x = 50 + (i + rnd(j) * 0.8) * (300 / n);
      const by = y + rnd(j + 1) * step * 0.6;
      for (let b = 0; b < 3; b++) {
        const h = (4.2 + rnd(j + b * 3 + 2) * 5.2) * s * tall;
        const w = (0.65 + rnd(j + b + 5) * 0.5) * s;
        const lean = (rnd(j + b * 5 + 9) - 0.5) * h * 0.8;
        const bx = x + (b - 1) * w * 1.5;
        const p = `M${f(bx - w)} ${f(by)}Q${f(bx - w * 0.2 + lean * 0.35)} ${f(by - h * 0.6)} ${f(bx + lean)} ${f(by - h)}Q${f(bx + w * 0.3 + lean * 0.4)} ${f(by - h * 0.55)} ${f(bx + w)} ${f(by)}Z`;
        if (b === 1 && rnd(j + 11) > 0.55) hi += p;
        else d += p;
      }
    }
    const c = hues[r % hues.length];
    rows.push(
      <g key={r}>
        <path d={d} fill={c} />
        <path d={hi} fill={lite(c, k.night ? 0.08 : 0.2)} />
      </g>,
    );
    y += step;
    r++;
  }
  return (
    <g>
      <defs>
        <linearGradient id={`${k.id}gb`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={base} />
          <stop offset="1" stopColor={dark(base, 0.35)} />
        </linearGradient>
      </defs>
      <rect x="0" y={k.y0} width="400" height={k.y1 - k.y0 + 10} fill={`url(#${k.id}gb)`} />
      {stripes ? Array.from({ length: 8 }, (_, i) => <rect key={i} x="0" y={k.y0 + i * 18} width="400" height="9" fill="#fff" opacity="0.035" />) : null}
      {/* terra che si vede tra i ciuffi */}
      <g fill={dark(base, 0.45)} opacity="0.35">
        {Array.from({ length: 40 }, (_, i) => <ellipse key={i} cx={60 + rnd(i * 3 + seed) * 280} cy={k.y0 + rnd(i * 5 + seed) * (k.y1 - k.y0)} rx={1.5 + rnd(i) * 3} ry={0.6 + rnd(i + 2)} />)}
      </g>
      {rows}
    </g>
  );
}

function Daisy({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <path d="M0 0 q0.6 -3 0 -6" stroke="#4f7f36" strokeWidth="0.6" fill="none" />
      <g transform="translate(0 -6)">
        {Array.from({ length: 10 }, (_, i) => <ellipse key={i} cx="0" cy="-1.9" rx="0.55" ry="1.6" fill="#fbfaf4" transform={`rotate(${i * 36})`} />)}
        <circle r="0.95" fill="#f2c84b" />
        <circle r="0.95" fill="#c9901a" opacity="0.3" transform="translate(0.3 0.3)" />
      </g>
    </g>
  );
}

function Poppy({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <path d="M0 0 q-1 -5 0.5 -10" stroke="#5a8a3a" strokeWidth="0.6" fill="none" />
      <g transform="translate(0.5 -10)">
        <path d="M0 0 C-3.6 -0.6 -3.4 -3.6 -0.6 -3 C-0.2 -4.4 2.6 -4.2 2.4 -2 C4.2 -1.4 3.4 1.6 1 1.2 C0.6 2.8 -2.6 2.4 -2.2 0.6 Z" fill="#d8302a" />
        <path d="M-1.6 -1.6 C-0.6 -2.6 1.6 -2.4 1.6 -0.6" stroke="#f26a5a" strokeWidth="0.5" fill="none" />
        <circle r="0.8" fill="#1c1410" />
      </g>
    </g>
  );
}

function Bell({ x, y, s = 1, c = "#3f5fd0" }: { x: number; y: number; s?: number; c?: string }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <path d="M0 0 q0.4 -4 0 -7" stroke="#4f7f36" strokeWidth="0.6" fill="none" />
      <path d="M-1.8 -7 C-2 -10 -1 -11.6 0 -11.6 C1 -11.6 2 -10 1.8 -7 L1 -7.6 L0 -6.8 L-1 -7.6 Z" fill={c} />
      <path d="M-0.6 -10.8 C-0.8 -9.6 -0.6 -8.4 -0.2 -7.6" stroke="#fff" strokeOpacity="0.4" strokeWidth="0.4" fill="none" />
    </g>
  );
}

function Edelweiss({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <path d="M0 0 v-5" stroke="#7a8a6a" strokeWidth="0.6" />
      <g transform="translate(0 -5)">
        {Array.from({ length: 7 }, (_, i) => <path key={i} d="M0 0 L-0.8 -1.2 L0 -3.4 L0.8 -1.2 Z" fill="#eef0ea" transform={`rotate(${i * 51})`} />)}
        <circle r="0.9" fill="#d9d2a0" />
      </g>
    </g>
  );
}

function Clover({ x, y, s = 1, c }: { x: number; y: number; s?: number; c: string }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`} fill={c}>
      <circle cx="-1" cy="-0.4" r="1" />
      <circle cx="1" cy="-0.4" r="1" />
      <circle cx="0" cy="-1.9" r="1" />
      <path d="M0 0 v1.6" stroke={c} strokeWidth="0.4" />
    </g>
  );
}

function Pebble({ x, y, w, h, c }: { x: number; y: number; w: number; h: number; c: string }) {
  return (
    <g>
      <ellipse cx={f(x + 0.6)} cy={f(y + h * 0.35)} rx={f(w)} ry={f(h * 0.7)} fill="#000" opacity="0.25" />
      <ellipse cx={f(x)} cy={f(y)} rx={f(w)} ry={f(h)} fill={c} />
      <ellipse cx={f(x - w * 0.3)} cy={f(y - h * 0.35)} rx={f(w * 0.45)} ry={f(h * 0.35)} fill="#fff" opacity="0.22" />
    </g>
  );
}

function Rock({ x, y, w, h, c, lichen }: { x: number; y: number; w: number; h: number; c: string; lichen?: string }) {
  const d = `M${f(x - w)} ${f(y)} Q${f(x - w * 0.95)} ${f(y - h * 0.8)} ${f(x - w * 0.3)} ${f(y - h)} Q${f(x + w * 0.4)} ${f(y - h * 1.05)} ${f(x + w * 0.85)} ${f(y - h * 0.5)} Q${f(x + w * 1.05)} ${f(y - h * 0.1)} ${f(x + w)} ${f(y)} Z`;
  return (
    <g>
      <ellipse cx={f(x + w * 0.1)} cy={f(y)} rx={f(w * 1.1)} ry={f(h * 0.18)} fill="#000" opacity="0.28" />
      <path d={d} fill={c} />
      <path d={`M${f(x - w * 0.8)} ${f(y - h * 0.5)} Q${f(x - w * 0.4)} ${f(y - h * 0.95)} ${f(x + w * 0.2)} ${f(y - h * 0.9)}`} stroke={lite(c, 0.3)} strokeWidth={f(h * 0.12)} fill="none" strokeLinecap="round" />
      <path d={`M${f(x + w * 0.2)} ${f(y)} Q${f(x + w * 0.7)} ${f(y - h * 0.3)} ${f(x + w * 0.9)} ${f(y - h * 0.15)}`} stroke={dark(c, 0.35)} strokeWidth={f(h * 0.1)} fill="none" />
      {lichen ? Array.from({ length: 5 }, (_, i) => <circle key={i} cx={f(x - w * 0.5 + rnd(x + i) * w)} cy={f(y - h * 0.3 - rnd(y + i) * h * 0.5)} r={f(h * 0.06 + rnd(i) * h * 0.05)} fill={lichen} opacity="0.8" />) : null}
    </g>
  );
}

function Leaf({ x, y, s, rot, c }: { x: number; y: number; s: number; rot: number; c: string }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})`}>
      <path d="M0 0 C1.4 -1.6 3.6 -1.8 5.4 0 C3.6 1.8 1.4 1.6 0 0 Z" fill={c} />
      <path d="M0 0 L5.4 0" stroke={dark(c, 0.3)} strokeWidth="0.25" />
    </g>
  );
}

function Maple({ x, y, s, rot, c }: { x: number; y: number; s: number; rot: number; c: string }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})`}>
      <path d="M0 2 L0.4 0.4 L2.8 1 L2 -0.4 L3.4 -1.6 L1.6 -1.8 L1.6 -3.6 L0.4 -2.4 L0 -4 L-0.4 -2.4 L-1.6 -3.6 L-1.6 -1.8 L-3.4 -1.6 L-2 -0.4 L-2.8 1 L-0.4 0.4 Z" fill={c} />
      <path d="M0 2 V-3 M0 0 L2.4 -1.2 M0 0 L-2.4 -1.2" stroke={dark(c, 0.3)} strokeWidth="0.2" />
    </g>
  );
}

function Mushroom({ x, y, s = 1, cap = "#c4302a", dots = true }: { x: number; y: number; s?: number; cap?: string; dots?: boolean }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <ellipse cx="0" cy="0.2" rx="3" ry="0.7" fill="#000" opacity="0.3" />
      <path d="M-0.9 0 C-1.1 -2 -0.8 -3.4 -0.7 -4 H0.7 C0.8 -3.4 1.1 -2 0.9 0 Z" fill="#efe8d8" />
      <path d="M-1.1 -2.6 H1.1" stroke="#d9cfb8" strokeWidth="0.5" />
      <path d="M-3.4 -3.6 C-3.2 -6.6 3.2 -6.6 3.4 -3.6 C2 -3.2 -2 -3.2 -3.4 -3.6 Z" fill={cap} />
      <path d="M-2.4 -5 C-1.4 -6 0.6 -6.2 1.6 -5.6" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.5" fill="none" />
      {dots ? [[-1.6, -4.6], [0.4, -5.4], [1.8, -4.4], [-0.4, -4.2]].map(([a, b]) => <circle key={`${a}${b}`} cx={a} cy={b} r="0.38" fill="#fbf6ea" />) : null}
    </g>
  );
}

function Fern({ x, y, s = 1, flip = false, c }: { x: number; y: number; s?: number; flip?: boolean; c: string }) {
  const lobes = Array.from({ length: 9 }, (_, i) => {
    const t = i / 9;
    const px = t * 16;
    const py = -t * 10 + t * t * 6;
    const l = (1 - t) * 3.6 + 0.6;
    return `M${f(px)} ${f(py)} q${f(l * 0.4)} ${f(-l)} ${f(l * 0.2)} ${f(-l * 1.4)} M${f(px)} ${f(py)} q${f(l * 0.6)} ${f(l * 0.6)} ${f(l * 0.9)} ${f(l * 0.9)}`;
  }).join(" ");
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(flip ? -s : s)} ${f(s)})`} fill="none" strokeLinecap="round">
      <path d="M0 0 Q8 -9 16 -4" stroke={dark(c, 0.2)} strokeWidth="0.7" />
      <path d={lobes} stroke={c} strokeWidth="1.1" />
    </g>
  );
}

function Shell({ x, y, s = 1, c = "#f2c6b0" }: { x: number; y: number; s?: number; c?: string }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <path d="M0 0 L-3 -2.4 C-2.6 -4.6 2.6 -4.6 3 -2.4 Z" fill={c} />
      {[-2, -1, 0, 1, 2].map((a) => <path key={a} d={`M0 0 L${a * 1.2} -4`} stroke={dark(c, 0.25)} strokeWidth="0.3" />)}
      <path d="M-0.8 0 h1.6 v0.8 h-1.6 Z" fill={dark(c, 0.15)} />
    </g>
  );
}

function Starfish({ x, y, s = 1, rot = 0 }: { x: number; y: number; s?: number; rot?: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 ? 1.2 : 3.4;
    return `${f(Math.cos(a) * r)} ${f(Math.sin(a) * r)}`;
  }).join(" L");
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${rot}) scale(${f(s)} ${f(s * 0.6)})`}>
      <path d={`M${pts} Z`} fill="#e8772e" stroke="#b4511a" strokeWidth="0.3" strokeLinejoin="round" />
      {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={f(Math.cos((i * 2 * Math.PI) / 5 - Math.PI / 2) * 1.6)} cy={f(Math.sin((i * 2 * Math.PI) / 5 - Math.PI / 2) * 1.6)} r="0.3" fill="#ffd0a0" />)}
    </g>
  );
}

function Arrow({ x, y, len, rot, c }: { x: number; y: number; len: number; rot: number; c: string }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${rot})`}>
      <path d={`M0 0 H${f(len)}`} stroke="#2a2a2a" strokeWidth="0.7" />
      <path d={`M${f(len)} -0.9 L${f(len + 2.4)} 0 L${f(len)} 0.9 Z`} fill="#b9bec4" />
      <path d="M0.6 0 L3.6 -1.6 L5.4 -1.6 L3 0 Z M0.6 0 L3.6 1.6 L5.4 1.6 L3 0 Z" fill={c} />
      <rect x="-0.8" y="-0.5" width="1.4" height="1" fill="#f4f1ea" />
    </g>
  );
}

/** faretra da terra: un picchetto con il tubo e le frecce */
function GroundQuiver({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <ellipse cx="0" cy="0" rx="4" ry="0.9" fill="#000" opacity="0.3" />
      <path d="M0 0 V-4" stroke="#6a6f76" strokeWidth="0.8" />
      <path d="M-1.6 -4 L-2 -14 H2 L1.6 -4 Z" fill="#3a3f46" />
      <path d="M-2 -14 H2" stroke="#c9a15a" strokeWidth="0.7" />
      {[["#d8302a", -1.2, -8], ["#f2c84b", 0, 6], ["#2f7fd0", 1.2, 14]].map(([c, dx, r]) => (
        <g key={c as string} transform={`translate(${dx} -14) rotate(${(r as number) - 90})`}>
          <path d="M0 0 H5" stroke="#2a2a2a" strokeWidth="0.5" />
          <path d="M3 0 L5.6 -1.2 L6.4 -1.2 L5.2 0 Z M3 0 L5.6 1.2 L6.4 1.2 L5.2 0 Z" fill={c as string} />
        </g>
      ))}
    </g>
  );
}

/* ---------- animali e cose che si muovono ---------- */

function Butterfly({ x, y, s = 1, c = "#f2a13a", delay = 0 }: { x: number; y: number; s?: number; c?: string; delay?: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <g className="aa-bfly" style={{ animationDelay: `${delay}s` }}>
        <g className="aa-wing" style={{ animationDelay: `${delay}s` }}>
          <path d="M0 0 C-3 -4 -6 -3 -5 -0.6 C-6 1.2 -3 2.6 0 0.4 Z" fill={c} />
          <path d="M0 0 C3 -4 6 -3 5 -0.6 C6 1.2 3 2.6 0 0.4 Z" fill={c} />
          <circle cx="-3.4" cy="-1.6" r="0.6" fill="#1c1410" />
          <circle cx="3.4" cy="-1.6" r="0.6" fill="#1c1410" />
          <path d="M-5 -0.6 C-4 -1 -2 -1 0 0 M5 -0.6 C4 -1 2 -1 0 0" stroke="#1c1410" strokeWidth="0.35" fill="none" />
        </g>
        <path d="M0 -1.6 V1.6" stroke="#1c1410" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M0 -1.6 l-0.8 -1.2 M0 -1.6 l0.8 -1.2" stroke="#1c1410" strokeWidth="0.25" />
      </g>
    </g>
  );
}

function Bee({ x, y, delay = 0 }: { x: number; y: number; delay?: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)})`}>
      <g className="aa-bee" style={{ animationDelay: `${delay}s` }}>
        <ellipse cx="0" cy="0" rx="1.6" ry="1.1" fill="#f2c84b" />
        <path d="M-0.4 -1 V1 M0.6 -1 V1" stroke="#1c1410" strokeWidth="0.45" />
        <ellipse className="aa-wing" cx="0" cy="-1.3" rx="1.1" ry="0.7" fill="#fff" opacity="0.7" />
      </g>
    </g>
  );
}

function Dragonfly({ x, y, delay = 0 }: { x: number; y: number; delay?: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)})`}>
      <g className="aa-dart" style={{ animationDelay: `${delay}s` }}>
        <path d="M-6 0 H3" stroke="#1f7a8a" strokeWidth="0.8" strokeLinecap="round" />
        <circle cx="3.6" cy="0" r="0.9" fill="#2a9aa8" />
        <g className="aa-wing-fast" fill="#dff4ff" opacity="0.7">
          <ellipse cx="0.6" cy="-1.8" rx="0.8" ry="2.4" transform="rotate(-20 0.6 -1.8)" />
          <ellipse cx="0.6" cy="1.8" rx="0.8" ry="2.4" transform="rotate(20 0.6 1.8)" />
          <ellipse cx="-0.8" cy="-1.6" rx="0.7" ry="2" transform="rotate(25 -0.8 -1.6)" />
          <ellipse cx="-0.8" cy="1.6" rx="0.7" ry="2" transform="rotate(-25 -0.8 1.6)" />
        </g>
      </g>
    </g>
  );
}

function Pigeon({ x, y, s = 1, flip = false, delay = 0, walk = false, night }: { x: number; y: number; s?: number; flip?: boolean; delay?: number; walk?: boolean; night: boolean }) {
  const body = night ? "#5a5f68" : "#9aa0a8";
  return (
    <g transform={`translate(${f(x)} ${f(y)})`}>
      <g className={walk ? "aa-strut" : undefined} style={{ animationDelay: `${delay}s` }}>
        <g transform={`scale(${f(flip ? -s : s)} ${f(s)})`}>
          <ellipse cx="0" cy="0.4" rx="7" ry="1.2" fill="#000" opacity="0.28" />
          <path d="M-1.2 -1.4 L-1.6 0.3 M1.8 -1.4 L2.2 0.3" stroke="#d07272" strokeWidth="0.6" strokeLinecap="round" />
          <path d="M-7 -5.2 L-12 -3.8 L-11.6 -6.2 Z" fill={dark(body, 0.4)} />
          <ellipse cx="0" cy="-4.6" rx="6.6" ry="3.6" fill={body} />
          <path d="M-5.4 -5.4 Q0 -8.6 4.6 -5.6 Q0.6 -2.6 -5.4 -4 Z" fill={dark(body, 0.15)} />
          <path d="M-3 -5.6 L0.6 -4.6 M-2.4 -4.6 L1.2 -3.8" stroke={dark(body, 0.5)} strokeWidth="0.6" />
          <g className="aa-peck" style={{ animationDelay: `${delay + 0.7}s` }}>
            <ellipse cx="4.6" cy="-7" rx="2.4" ry="2.6" fill={night ? "#3a5a4a" : "#5d8a74"} />
            <ellipse cx="4.2" cy="-6.2" rx="1.6" ry="1.4" fill={night ? "#4a3a5a" : "#7a5a8a"} opacity="0.7" />
            <circle cx="5.8" cy="-9.4" r="2.2" fill={dark(body, 0.08)} />
            <circle cx="6.6" cy="-9.8" r="0.55" fill="#e08a2a" />
            <circle cx="6.7" cy="-9.9" r="0.2" fill="#111" />
            <path d="M7.8 -9.4 L10 -8.9 L7.8 -8.5 Z" fill="#2a2a2a" />
            <circle cx="7.9" cy="-9.4" r="0.4" fill="#eee" />
          </g>
        </g>
      </g>
    </g>
  );
}

function Chicken({ x, y, s = 1, flip = false, delay = 0, hen = "#f4efe4" }: { x: number; y: number; s?: number; flip?: boolean; delay?: number; hen?: string }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(flip ? -s : s)} ${f(s)})`}>
      <ellipse cx="0" cy="0.4" rx="6.6" ry="1.2" fill="#000" opacity="0.28" />
      <path d="M-1 -2 L-1.4 0.3 M1.6 -2 L2 0.3" stroke="#e0a83a" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M-6 -6 C-9 -11 -8 -12 -5.6 -10 C-6 -12 -4 -12 -3.6 -8 Z" fill={dark(hen, 0.2)} />
      <path d="M-6 -5 C-6 -9 2 -10 4 -6 C5 -3 2 -1.6 -1 -1.8 C-4 -2 -6 -3 -6 -5 Z" fill={hen} />
      <path d="M-3.6 -5.6 C-1 -7 1.4 -6.2 2 -4.6 C0 -3.4 -2.6 -3.6 -3.6 -5.6 Z" fill={dark(hen, 0.12)} />
      <g className="aa-peck" style={{ animationDelay: `${delay}s` }}>
        <path d="M2.4 -6 C2.4 -9 3 -10.6 4.4 -10.6 C6 -10.6 6.4 -8.6 5.4 -6.4 Z" fill={hen} />
        <path d="M3.6 -10.4 c0 -1.4 0.8 -1.6 1 -0.6 c0.4 -1 1.2 -0.8 1 0.4 Z" fill="#d6302a" />
        <path d="M5.6 -9.4 L7.2 -8.9 L5.6 -8.4 Z" fill="#e0a83a" />
        <path d="M5.4 -8.2 c0.4 0.8 0 1.4 -0.4 1.4 c-0.2 -0.6 0 -1 0.4 -1.4 Z" fill="#d6302a" />
        <circle cx="4.9" cy="-9.4" r="0.35" fill="#111" />
      </g>
    </g>
  );
}

function Crab({ x, y, s = 1, delay = 0 }: { x: number; y: number; s?: number; delay?: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <g className="aa-crab" style={{ animationDelay: `${delay}s` }}>
        <ellipse cx="0" cy="0.6" rx="4.6" ry="0.9" fill="#000" opacity="0.25" />
        <g stroke="#b4401e" strokeWidth="0.55" strokeLinecap="round" fill="none">
          <path d="M-2.4 -0.6 l-2 0.8 l-0.6 1 M-2.6 -1.2 l-2.4 0 l-0.8 0.8 M2.4 -0.6 l2 0.8 l0.6 1 M2.6 -1.2 l2.4 0 l0.8 0.8" />
          <path d="M-1 -2.8 v-1.4 M1 -2.8 v-1.4" />
        </g>
        <ellipse cx="0" cy="-1.6" rx="3" ry="1.8" fill="#d9502f" />
        <ellipse cx="-0.6" cy="-2.2" rx="1.4" ry="0.6" fill="#f08a5a" opacity="0.6" />
        <circle cx="-1" cy="-4.3" r="0.45" fill="#111" />
        <circle cx="1" cy="-4.3" r="0.45" fill="#111" />
        <path d="M-2.8 -2 C-4.6 -3.6 -5.8 -3 -5.6 -4.4 C-4.4 -5 -3.4 -4.2 -3 -3.2 M2.8 -2 C4.6 -3.6 5.8 -3 5.6 -4.4 C4.4 -5 3.4 -4.2 3 -3.2" fill="#d9502f" stroke="#b4401e" strokeWidth="0.3" />
      </g>
    </g>
  );
}

function Tumbleweed({ y, s = 1, delay = 0 }: { y: number; s?: number; delay?: number }) {
  const d = Array.from({ length: 14 }, (_, i) => {
    const a = rnd(i * 3) * Math.PI * 2;
    const b = a + 1.5 + rnd(i) * 2;
    const r1 = 2 + rnd(i + 5) * 3;
    return `M${f(Math.cos(a) * r1)} ${f(Math.sin(a) * r1)} Q${f(Math.cos((a + b) / 2) * 6)} ${f(Math.sin((a + b) / 2) * 6)} ${f(Math.cos(b) * 4.6)} ${f(Math.sin(b) * 4.6)}`;
  }).join(" ");
  return (
    <g transform={`translate(0 ${f(y)}) scale(${f(s)})`}>
      <g className="aa-tumble" style={{ animationDelay: `${delay}s` }}>
        <g className="aa-spin">
          <circle r="5.4" fill="#a8864a" opacity="0.18" />
          <path d={d} stroke="#9a7a42" strokeWidth="0.5" fill="none" />
          <circle r="5.4" fill="none" stroke="#b8965a" strokeWidth="0.4" strokeDasharray="2 1.4" />
        </g>
      </g>
    </g>
  );
}

function Lizard({ x, y, s = 1, c = "#6a8a3a" }: { x: number; y: number; s?: number; c?: string }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <path d="M0 0 C2 -0.8 5 -0.8 7 0 C5 0.8 2 0.8 0 0 Z" fill={c} />
      <circle cx="7.4" cy="0" r="1" fill={c} />
      <circle cx="7.8" cy="-0.3" r="0.22" fill="#111" />
      <path d="M2 0 l-0.8 -1.6 M2 0 l-0.8 1.6 M5.4 0 l0.8 -1.6 M5.4 0 l0.8 1.6" stroke={c} strokeWidth="0.45" strokeLinecap="round" />
      <path className="aa-tail" d="M0 0 C-3 0.4 -5 -1.6 -7 -0.6" stroke={c} strokeWidth="0.7" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Robin({ x, y, s = 1, delay = 0 }: { x: number; y: number; s?: number; delay?: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <g className="aa-hop" style={{ animationDelay: `${delay}s` }}>
        <ellipse cx="0" cy="0.5" rx="3.6" ry="0.7" fill="#000" opacity="0.2" />
        <path d="M-0.6 -1.4 v1.6 M0.8 -1.4 v1.6" stroke="#6a4a3a" strokeWidth="0.4" />
        <path d="M-4 -4 L-6.4 -3 L-6.2 -4.6 Z" fill="#6a5040" />
        <ellipse cx="-0.4" cy="-3.6" rx="3.6" ry="2.4" fill="#7a5a44" />
        <path d="M0.6 -5 C2.6 -5 2.8 -2.4 1 -1.6 C0 -2 -0.2 -3.6 0.6 -5 Z" fill="#e06a2a" />
        <circle cx="1.6" cy="-5.6" r="1.6" fill="#7a5a44" />
        <path d="M2.4 -6 C3 -5.4 2.8 -4.6 2 -4.6" fill="#e06a2a" />
        <circle cx="2" cy="-6" r="0.3" fill="#111" />
        <path d="M3 -5.8 L4 -5.5 L3 -5.2 Z" fill="#3a2a1a" />
      </g>
    </g>
  );
}

function Fireflies({ k, n = 9 }: { k: K; n?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${f(95 + rnd(i * 7) * 210)} ${f(k.y0 + 30 + rnd(i * 11) * (k.y1 - k.y0 - 30))})`}>
          <g className="aa-firefly" style={{ animationDelay: `${(i % 6) * 0.7}s`, animationDuration: `${4 + (i % 4)}s` }}>
            <circle r="3.4" fill="#e8ff9a" opacity="0.22" />
            <circle r="0.9" fill="#f4ffc8" />
          </g>
        </g>
      ))}
    </g>
  );
}

function Motes({ k, c = "#fff6c8", n = 10 }: { k: K; c?: string; n?: number }) {
  return (
    <g fill={c}>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} className="aa-mote" cx={f(95 + rnd(i * 13 + 4) * 210)} cy={f(k.y0 + 26 + rnd(i * 17) * (k.y1 - k.y0 - 30))} r={f(0.4 + rnd(i) * 0.6)} style={{ animationDelay: `${(i % 7) * 0.9}s`, animationDuration: `${6 + (i % 5)}s` }} />
      ))}
    </g>
  );
}

function Sparkles({ k, n = 10 }: { k: K; n?: number }) {
  return (
    <g fill="#fff">
      {Array.from({ length: n }, (_, i) => {
        const x = 95 + rnd(i * 19 + 2) * 210;
        const y = k.y0 + 34 + rnd(i * 23 + 1) * (k.y1 - k.y0 - 36);
        const r = 0.9 + rnd(i) * 1.2;
        return <path key={i} className="aa-twinkle" style={{ animationDelay: `${(i % 6) * 0.45}s` }} d={`M${f(x)} ${f(y - r)} L${f(x + r * 0.25)} ${f(y - r * 0.25)} L${f(x + r)} ${f(y)} L${f(x + r * 0.25)} ${f(y + r * 0.25)} L${f(x)} ${f(y + r)} L${f(x - r * 0.25)} ${f(y + r * 0.25)} L${f(x - r)} ${f(y)} L${f(x - r * 0.25)} ${f(y - r * 0.25)} Z`} />;
      })}
    </g>
  );
}

function FallingLeaves({ k, colors }: { k: K; colors: string[] }) {
  return (
    <g>
      {Array.from({ length: 7 }, (_, i) => (
        <g key={i} transform={`translate(${f(100 + rnd(i * 5 + 1) * 200)} ${f(k.y0 + 10)})`}>
          <g className="aa-fall" style={{ animationDelay: `${i * 1.3}s`, animationDuration: `${8 + (i % 3) * 2}s` }}>
            <Maple x={0} y={0} s={0.9 + rnd(i) * 0.5} rot={rnd(i + 3) * 360} c={colors[i % colors.length]} />
          </g>
        </g>
      ))}
    </g>
  );
}

function Flame({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`}>
      <circle cx="0" cy="-2.4" r="9" fill="#ffb04a" opacity="0.12" className="aa-glow-pulse" />
      <path d="M0 -6 C2.2 -3.6 2 -0.8 0 0 C-2 -0.8 -2.2 -3.6 0 -6 Z" fill="#ffb04a" className="aa-flame" />
      <path d="M0 -3.6 C1 -2.4 0.9 -0.6 0 -0.2 C-0.9 -0.6 -1 -2.4 0 -3.6 Z" fill="#fff1a8" className="aa-flame" />
    </g>
  );
}

function Sway({ x, y, delay = 0, children }: { x: number; y: number; delay?: number; children: ReactNode }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)})`}>
      <g className="aa-sway" style={{ animationDelay: `${delay}s` }}>{children}</g>
    </g>
  );
}

function Grass3({ h, c, w = 1 }: { h: number; c: string; w?: number }) {
  return (
    <g fill={c}>
      <path d={`M${-1.4 * w} 0 Q${-1 * w} ${f(-h * 0.6)} ${f(-3 * w)} ${f(-h)} Q${0} ${f(-h * 0.6)} ${0.2 * w} 0 Z`} />
      <path d={`M${-0.6 * w} 0 Q${0.2 * w} ${f(-h * 0.7)} ${0.6 * w} ${f(-h * 1.15)} Q${1 * w} ${f(-h * 0.6)} ${0.9 * w} 0 Z`} />
      <path d={`M${0.4 * w} 0 Q${1.6 * w} ${f(-h * 0.5)} ${3.4 * w} ${f(-h * 0.85)} Q${1.8 * w} ${f(-h * 0.4)} ${1.6 * w} 0 Z`} />
    </g>
  );
}

/** pavimento a tavole in prospettiva, che prosegue quello della scena (fuga al centro, y = 214) */
function Planks({ k, c1, c2, lines }: { k: K; c1: string; c2: string; lines: string }) {
  const at = (xb: number, y: number) => {
    const xt = 200 + (xb - 200) * 0.28;
    return xt + ((xb - xt) * (y - 214)) / 86;
  };
  const xs = Array.from({ length: 30 }, (_, i) => -160 + i * 25);
  const yb = k.y1 + 10;
  return (
    <g>
      <rect x="0" y={k.y0} width="400" height={yb - k.y0} fill={mix(c1, c2, 0.6)} />
      {xs.slice(0, -1).map((xb, i) => {
        const a1 = at(xb, k.y0);
        const b1 = at(xs[i + 1], k.y0);
        const a2 = at(xb, yb);
        const b2 = at(xs[i + 1], yb);
        const tint = [0, 0.06, -0.05, 0.03, -0.08][i % 5];
        const c = tint > 0 ? lite(mix(c1, c2, 0.6), tint) : dark(mix(c1, c2, 0.6), -tint);
        // giunti sfalsati e venature
        const j1 = k.y0 + 8 + rnd(i * 3) * 30;
        const j2 = j1 + 36 + rnd(i * 5) * 30;
        const grain = [0.3, 0.55, 0.75].map((t) => {
          const xa = at(xb + 25 * t, k.y0);
          const xz = at(xb + 25 * t, yb);
          return `M${f(xa)} ${k.y0} Q${f((xa + xz) / 2 + (rnd(i + t * 10) - 0.5) * 3)} ${f((k.y0 + yb) / 2)} ${f(xz)} ${f(yb)}`;
        }).join(" ");
        return (
          <g key={xb}>
            <path d={`M${f(a1)} ${k.y0} L${f(b1)} ${k.y0} L${f(b2)} ${f(yb)} L${f(a2)} ${f(yb)} Z`} fill={c} />
            <path d={grain} stroke={lines} strokeOpacity="0.08" strokeWidth="0.5" fill="none" />
            {[j1, j2].map((jy) => (
              <g key={jy}>
                <path d={`M${f(at(xb, jy))} ${f(jy)} L${f(at(xs[i + 1], jy))} ${f(jy)}`} stroke={lines} strokeOpacity="0.3" strokeWidth={f(0.5 * sz(jy))} />
                <circle cx={f(at(xb + 4, jy) + 0.6)} cy={f(jy - 1.2 * sz(jy))} r={f(0.35 * sz(jy))} fill={lines} opacity="0.4" />
                <circle cx={f(at(xs[i + 1] - 4, jy) - 0.6)} cy={f(jy - 1.2 * sz(jy))} r={f(0.35 * sz(jy))} fill={lines} opacity="0.4" />
              </g>
            ))}
            <path d={`M${f(a1)} ${k.y0} L${f(a2)} ${f(yb)}`} stroke={lines} strokeOpacity="0.28" strokeWidth="0.7" />
          </g>
        );
      })}
    </g>
  );
}

/** sampietrini in file, più grandi verso chi guarda, con le fughe scure e un po' di muschio */
function Cobbles({ k }: { k: K }) {
  const gap = k.N("#4a4743", "#1f1e1c");
  const cols = k.N(["#7d7972", "#736f69", "#88837b", "#6b6761", "#918b82"], ["#3e3c39", "#383633", "#45423e", "#33312e", "#4a4743"]);
  const rows: ReactNode[] = [];
  let y = k.y0 - 2;
  let r = 0;
  while (y < k.y1 + 6 && r < 40) {
    const s = sz(y);
    const h = 5 * s;
    const wAvg = 7.4 * s;
    const byCol: string[] = cols.map(() => "");
    let hi = "";
    let sh = "";
    let moss = "";
    let x = 40 - rnd(r * 3) * wAvg;
    let i = 0;
    while (x < 360) {
      const j = r * 97 + i * 13;
      const w = wAvg * (0.75 + rnd(j) * 0.5);
      const pad = 0.45 * s;
      byCol[i % 5 === 0 ? 4 : Math.floor(rnd(j + 1) * 4)] += rr(x + pad, y + pad, w - pad * 2, h - pad * 2, h * 0.38);
      hi += `M${f(x + pad + h * 0.3)} ${f(y + pad + 0.7 * s)} Q${f(x + w / 2)} ${f(y + pad + 0.1 * s)} ${f(x + w - pad - h * 0.3)} ${f(y + pad + 0.7 * s)}`;
      sh += `M${f(x + pad + h * 0.25)} ${f(y + h - pad - 0.6 * s)} Q${f(x + w / 2)} ${f(y + h - pad + 0.2 * s)} ${f(x + w - pad - h * 0.25)} ${f(y + h - pad - 0.6 * s)}`;
      if (rnd(j + 7) > 0.82) moss += `M${f(x + w - 0.6 * s)} ${f(y + h * 0.2)} q${f(0.6 * s)} ${f(h * 0.3)} 0 ${f(h * 0.6)} `;
      x += w;
      i++;
    }
    rows.push(
      <g key={r}>
        {byCol.map((d, ci) => <path key={ci} d={d} fill={cols[ci]} />)}
        <path d={hi} stroke="#fff" strokeOpacity={k.night ? 0.08 : 0.2} strokeWidth={f(0.6 * s)} fill="none" strokeLinecap="round" />
        <path d={sh} stroke="#000" strokeOpacity="0.28" strokeWidth={f(0.7 * s)} fill="none" strokeLinecap="round" />
        {moss ? <path d={moss} stroke={k.N("#6a8a3a", "#2a3a20")} strokeWidth={f(0.9 * s)} fill="none" strokeLinecap="round" opacity="0.8" /> : null}
      </g>,
    );
    y += h;
    r++;
  }
  return (
    <g>
      <rect x="0" y={k.y0 - 2} width="400" height={k.y1 - k.y0 + 12} fill={gap} />
      {rows}
    </g>
  );
}

function Puddle({ k, x, y, rx, ry }: { k: K; x: number; y: number; rx: number; ry: number }) {
  const p = k.N({ a: "#a9cdea", b: "#5b8fd6" }, { a: "#22355c", b: "#0f1e3d" });
  return (
    <g>
      <defs>
        <linearGradient id={`${k.id}pd`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.b} />
          <stop offset="1" stopColor={p.a} />
        </linearGradient>
      </defs>
      <ellipse cx={x} cy={y} rx={rx + 1.2} ry={ry + 0.6} fill="#000" opacity="0.25" />
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={`url(#${k.id}pd)`} opacity="0.85" />
      <path d={`M${f(x - rx * 0.6)} ${f(y - ry * 0.2)} h${f(rx * 0.5)} M${f(x - rx * 0.1)} ${f(y + ry * 0.25)} h${f(rx * 0.6)}`} stroke="#fff" strokeOpacity="0.5" strokeWidth="0.5" className="aa-shimmer" />
      {[0, 1, 2].map((i) => (
        <ellipse key={i} className="aa-ripple" style={{ animationDelay: `${i * (k.rain ? 0.6 : 1.6)}s`, animationDuration: k.rain ? "1.4s" : "3.6s" }} cx={f(x - rx * 0.4 + i * rx * 0.4)} cy={f(y + (i - 1) * ry * 0.2)} rx={f(rx * 0.3)} ry={f(ry * 0.3)} fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.4" />
      ))}
    </g>
  );
}

/* ---------- le ambientazioni ---------- */

type Part = { base: ReactNode; life: ReactNode };

const greens = (k: K, day: string[]) => k.N(day, ["#13241a", "#17291d", "#1b2f21", "#112016"]);

function meadow(k: K, base: string, hues: string[], opts: { flowers?: "prato" | "papaveri" | "alpini" | "none"; stripes?: boolean; seed?: number } = {}): ReactNode {
  const fl = opts.flowers ?? "prato";
  const topBand = (i: number) => k.y0 + 32 + rnd(i * 7) * Math.max(4, k.top - k.y0 - 34);
  const botBand = (i: number) => k.bottom + 4 + rnd(i * 9) * Math.max(4, k.y1 - k.bottom - 6);
  const xs = (i: number) => 92 + rnd(i * 13 + 5) * 216;
  return (
    <g>
      <GrassField k={k} base={base} hues={greens(k, hues)} stripes={opts.stripes} seed={opts.seed ?? 1} />
      {Array.from({ length: 10 }, (_, i) => <Clover key={`c${i}`} x={xs(i + 40)} y={i % 2 ? topBand(i + 3) : botBand(i + 3)} s={1.1} c={k.N("#5f9a44", "#1c3424")} />)}
      {!k.night && fl === "prato" ? Array.from({ length: 12 }, (_, i) => {
        const y = i % 2 ? topBand(i) : botBand(i);
        return i % 4 === 3 ? <Bell key={i} x={xs(i)} y={y} s={Math.min(1.25, sz(y) * 0.9)} c={i % 8 === 3 ? "#7a5ad0" : "#3f6fd0"} /> : <Daisy key={i} x={xs(i)} y={y} s={Math.min(1.15, sz(y) * 0.85)} />;
      }) : null}
      {!k.night && fl === "papaveri" ? Array.from({ length: 14 }, (_, i) => {
        const y = i % 2 ? topBand(i) : botBand(i);
        return i % 3 === 2 ? <Bell key={i} x={xs(i)} y={y} s={Math.min(1.25, sz(y) * 0.9)} c="#4a6ad8" /> : <Poppy key={i} x={xs(i)} y={y} s={Math.min(1.25, sz(y) * 0.9)} />;
      }) : null}
      {fl === "alpini" ? Array.from({ length: 12 }, (_, i) => {
        const y = i % 2 ? topBand(i) : botBand(i);
        return i % 2 ? <Edelweiss key={i} x={xs(i)} y={y} s={Math.min(1.3, sz(y))} /> : <Bell key={i} x={xs(i)} y={y} s={Math.min(1.3, sz(y))} c={k.night ? "#2a3a7a" : "#2f4fd8"} />;
      }) : null}
    </g>
  );
}

function swayers(k: K, c: string, flower?: (i: number) => ReactNode): ReactNode {
  const spots = [
    [92, k.yb - 0.3],
    [104, k.yb + 0.5],
    [300, k.yb],
    [311, k.yb - 0.6],
    [96, k.top + 2],
    [308, k.top + 3],
  ];
  return spots.map(([x, y], i) => (
    <Sway key={i} x={x} y={y} delay={i * 0.6}>
      <Grass3 h={12 + (i % 3) * 3} c={i % 2 ? c : lite(c, 0.12)} w={1.2} />
      {flower ? <g transform="translate(0 -1)">{flower(i)}</g> : null}
    </Sway>
  ));
}

function scenePart(scene: SceneId, k: K): Part {
  const sc = sceneById(scene);
  const g1 = sc.ground[1];
  const nearY = k.y0 + 34;
  const leftBot = { x: 100, y: k.yb - 0.9 };
  switch (scene) {
    case "fabriano":
      return {
        base: (
          <g>
            <Cobbles k={k} />
            <Puddle k={k} x={286} y={k.bottom + (k.y1 - k.bottom) * 0.55} rx={16} ry={3.6} />
            {[[120, nearY + 2, 20], [262, k.yb - 1.5, 140], [200, k.top - 2, 75]].map(([x, y, r], i) => <Leaf key={i} x={x} y={y} s={sz(y) * 1.1} rot={r} c={k.N(["#b0602a", "#c9902a", "#8a5a2a"][i], "#3a2a1a")} />)}
            {/* tombino in ghisa */}
            <g transform={`translate(132 ${f(k.yb - 1.8)})`}>
              <ellipse cx="0" cy="0" rx="11" ry="3.4" fill={k.N("#3a3a3a", "#1a1a1a")} stroke={k.N("#55524e", "#2a2928")} strokeWidth="0.8" />
              {[-6, -3, 0, 3, 6].map((x) => <path key={x} d={`M${x} -2.6 V2.6`} stroke="#111" strokeWidth="0.7" />)}
            </g>
          </g>
        ),
        life: (
          <g>
            <Pigeon x={250} y={nearY + 4} s={sz(nearY) * 0.95} night={k.night} delay={0.2} />
            <Pigeon x={150} y={k.yb - 0.6} s={k.sb * 0.8} flip night={k.night} walk delay={1.1} />
          </g>
        ),
      };
    case "campo":
    case "lago":
    case "castello":
    case "torneo":
    case "villaggio":
    case "campagna":
    case "rovine": {
      const hues = scene === "campagna" ? ["#5f8a38", "#6e9840", "#7aa446", "#567f32"] : scene === "rovine" ? ["#6a7a42", "#7a8a4a", "#86965a", "#5e6e3a"] : ["#3f6a30", "#4f7e3a", "#5d8c42", "#46743a"];
      const extra: ReactNode[] = [];
      const life: ReactNode[] = [];
      if (scene === "campo") {
        // linea di tiro: nastro bianco teso tra due picchetti
        const ly = k.y0 + 36;
        extra.push(
          <g key="line">
            <path d={`M70 ${f(ly)} Q200 ${f(ly + 1.2)} 330 ${f(ly)}`} stroke="#000" strokeOpacity="0.25" strokeWidth="2.4" fill="none" transform="translate(0 1)" />
            <path d={`M70 ${f(ly)} Q200 ${f(ly + 1.2)} 330 ${f(ly)}`} stroke={k.N("#f6f4ee", "#9aa0a6")} strokeWidth="1.6" fill="none" />
            {[94, 306].map((x) => <path key={x} d={`M${x} ${f(ly - 2)} v5`} stroke="#c9a15a" strokeWidth="1.2" />)}
          </g>,
        );
        extra.push(<GroundQuiver key="q" x={leftBot.x + 6} y={k.yb - 0.3} s={k.sb * 0.9} />);
        extra.push(<Arrow key="a1" x={262} y={k.yb - 1.2} len={22} rot={-4} c="#d8302a" />);
      }
      if (scene === "lago") {
        extra.push(...[[94, 0], [306, 1]].map(([x, flip]) => (
          <g key={`reed${x}`} transform={`translate(${x} ${f(k.yb)}) scale(${flip ? -1 : 1} 1)`}>
            {[0, 3, 6].map((dx, i) => <g key={dx}><path d={`M${dx} 0 q1 -14 ${-1 + i} -${26 + i * 4}`} stroke={k.N("#5a7a3a", "#1f3022")} strokeWidth="1" fill="none" /><rect x={dx - 1.4 + i * 0.6} y={-(24 + i * 4)} width="2.4" height="7" rx="1.2" fill={k.N("#6a4a2a", "#2a1e14")} /></g>)}
          </g>
        )));
        extra.push(...[[150, k.yb - 0.9, 3.6, 2], [176, k.yb - 0.3, 2.4, 1.4], [244, nearY + 2, 2.6, 1.4], [228, k.yb - 1.2, 3, 1.8]].map(([x, y, w, h], i) => <Pebble key={`pb${i}`} x={x} y={y} w={w * Math.min(1.3, sz(y))} h={h * Math.min(1.3, sz(y))} c={k.N(["#9a958c", "#b2aca0", "#8a857c"][i % 3], "#3a3a40")} />));
        life.push(<Dragonfly key="df" x={220} y={nearY - 4} />);
      }
      if (scene === "castello") {
        // lastre di pietra del sentiero che porta al castello
        const slabs: ReactNode[] = [];
        let y = k.y0 + 4;
        let r = 0;
        while (y < k.y1 + 4) {
          const s = Math.min(1.35, sz(y));
          const w = 14 * s;
          const xc = 200 + Math.sin(r * 1.7) * 4;
          slabs.push(<path key={r} d={rr(xc - w - rnd(r) * 3, y, w * 2 * (0.8 + rnd(r + 3) * 0.3), 6 * s, 2 * s)} fill={k.N(["#9a9a94", "#a8a69e", "#8e8c86"][r % 3], "#3e3e42")} stroke={k.N("#6a6a66", "#222")} strokeWidth="0.4" />);
          y += 7.2 * s;
          r++;
        }
        extra.push(<g key="slabs">{slabs}</g>);
        extra.push(<Rock key="r1" x={110} y={k.yb - 0.3} w={9} h={6} c={k.N("#8a8e94", "#34363c")} lichen={k.N("#c9b84a", "#4a4a2a")} />);
        life.push(<g key="pen" transform={`translate(296 ${f(nearY + 6)})`}><path d="M0 0 V-16" stroke="#5a3a22" strokeWidth="0.9" /><path d="M0 -16 l9 2 l-3 2.5 l3 2.5 l-9 1 Z" fill="#c4473d" className="aa-flag" /></g>);
      }
      if (scene === "torneo") {
        extra.push(
          <g key="bale" transform={`translate(296 ${f(k.yb)})`}>
            <path d={rr(-14, -10, 28, 11, 2)} fill={k.N("#d8b25a", "#5a4a24")} stroke="#8a6a2a" strokeWidth="0.6" />
            {[0, 1, 2].map((i) => <path key={i} d={`M-12 ${-7.6 + i * 3} h24`} stroke="#a87e34" strokeWidth="0.5" />)}
            <path d="M-6 -10 v11 M6 -10 v11" stroke="#7a5a2a" strokeWidth="0.6" />
          </g>,
          <g key="shield" transform={`translate(112 ${f(k.yb - 0.3)}) rotate(-12)`}>
            <path d="M-6 -12 H6 V-5 C6 -1 2 1 0 2 C-2 1 -6 -1 -6 -5 Z" fill={k.N("#2a5d8a", "#1a2a3a")} stroke="#d9b45a" strokeWidth="0.7" />
            <path d="M0 -12 V2 M-6 -6 H6" stroke="#f4f1ea" strokeWidth="1.2" opacity="0.9" />
          </g>,
          <path key="lance" d={`M150 ${f(nearY + 3)} L232 ${f(nearY - 1)}`} stroke={k.N("#c9a46a", "#4a3a28")} strokeWidth="1.3" strokeLinecap="round" />,
        );
        life.push(<g key="pen" transform={`translate(260 ${f(nearY + 4)})`}><path d="M0 0 V-14" stroke="#5a3a22" strokeWidth="0.8" /><path d="M0 -14 l9 2 l-3 2.5 l3 2.5 l-9 1 Z" fill="#e6b325" className="aa-flag" /></g>);
      }
      if (scene === "villaggio") {
        // strada di terra battuta con i solchi dei carri
        const road = `M150 ${k.y0} L250 ${k.y0} L${f(250 + (k.y1 - k.y0) * 0.55)} ${f(k.y1 + 6)} L${f(150 - (k.y1 - k.y0) * 0.55)} ${f(k.y1 + 6)} Z`;
        extra.push(
          <g key="road">
            <path d={road} fill={k.N("#9a7a52", "#3a2e22")} />
            <path d={road} fill="none" stroke={k.N("#7a5a3a", "#2a2018")} strokeWidth="0.6" />
            {[178, 222].map((x) => <path key={x} d={`M${x} ${k.y0} L${f(x + (x - 200) * 1.6)} ${f(k.y1 + 6)}`} stroke={k.N("#6e5234", "#241a12")} strokeWidth="2.4" opacity="0.7" />)}
            {Array.from({ length: 20 }, (_, i) => <Pebble key={i} x={170 + rnd(i * 3) * 60} y={k.y0 + 30 + rnd(i * 7) * (k.y1 - k.y0 - 30)} w={0.8 + rnd(i) * 1.2} h={0.5 + rnd(i + 1) * 0.6} c={k.N("#b29a7a", "#4a3e30")} />)}
            <Puddle k={k} x={214} y={k.yb - 1.8} rx={12} ry={2.8} />
          </g>,
          <g key="bucket" transform={`translate(110 ${f(k.yb - 0.3)})`}>
            <path d="M-5 -9 L-4 0 H4 L5 -9 Z" fill={k.N("#8a5a32", "#3a2618")} />
            <path d="M-5 -6.4 H5 M-4.6 -2.4 H4.6" stroke="#4a4a4a" strokeWidth="0.8" />
            <ellipse cx="0" cy="-9" rx="5" ry="1.2" fill={k.N("#5a3a22", "#2a1a10")} />
          </g>,
        );
        life.push(<Chicken key="h1" x={262} y={nearY + 4} s={sz(nearY) * 0.9} delay={0.3} hen={k.N("#f4efe4", "#6a665e")} />, <Chicken key="h2" x={134} y={k.yb - 0.6} s={k.sb * 0.8} flip delay={1.4} hen={k.N("#b86a2a", "#4a2a14")} />);
      }
      if (scene === "campagna") {
        extra.push(
          <g key="basket" transform={`translate(296 ${f(k.yb - 0.3)})`}>
            <path d="M-9 -7 C-9 -1 -6 0 0 0 C6 0 9 -1 9 -7 Z" fill={k.N("#b08a4a", "#4a3a20")} />
            {[-6, -2, 2, 6].map((x) => <path key={x} d={`M${x} -7 v6`} stroke="#7a5a2a" strokeWidth="0.5" />)}
            <path d="M-9 -4 H9" stroke="#7a5a2a" strokeWidth="0.5" />
            {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={-6 + (i % 5) * 3} cy={-8 - Math.floor(i / 5) * 2.4} r="1.4" fill={k.N(i % 2 ? "#5a2a6a" : "#6a3a7a", "#2a1a30")} />)}
            <path d="M2 -12 q3 -2 5 0" stroke="#4f7f36" strokeWidth="0.8" fill="none" />
          </g>,
        );
        life.push(<Bee key="bee" x={180} y={nearY - 4} />);
      }
      if (scene === "rovine") {
        extra.push(
          <g key="mosaic" transform={`translate(176 ${f(nearY - 2)})`}>
            {Array.from({ length: 40 }, (_, i) => {
              const cx = (i % 10) * 3.2 - 14;
              const cy = Math.floor(i / 10) * 1.6;
              return rnd(i * 3) > 0.25 ? <rect key={i} x={cx} y={cy} width="2.8" height="1.4" fill={k.N(["#c9b48a", "#8a3a2a", "#2a4a6a", "#e6dcc4", "#c9b48a"][(i + Math.floor(i / 10)) % 5], "#3a3630")} /> : null;
            })}
          </g>,
          <g key="drum" transform={`translate(292 ${f(k.yb)})`}>
            <path d="M-12 -8 H8 V0 H-12 Z" fill={k.N("#d8cfbd", "#4a4640")} />
            {[-9, -6, -3, 0, 3, 6].map((x) => <path key={x} d={`M${x} -8 v8`} stroke={k.N("#b2a68a", "#33302c")} strokeWidth="0.5" />)}
            <ellipse cx="8" cy="-4" rx="2.4" ry="4" fill={k.N("#e6dccb", "#55504a")} />
            <path d="M-12 -8 q4 -2 6 1 q2 -3 5 -1" stroke={k.N("#4f7f36", "#1f3022")} strokeWidth="0.8" fill="none" />
          </g>,
        );
        life.push(<Lizard key="liz" x={240} y={nearY + 2} s={sz(nearY) * 0.9} c={k.N("#7a8a3a", "#2a3020")} />);
      }
      const flowers = scene === "campagna" ? "papaveri" : scene === "villaggio" || scene === "lago" ? "prato" : "prato";
      return {
        base: (
          <g>
            {meadow(k, g1, hues, { flowers: flowers as "prato" | "papaveri", stripes: scene === "campo", seed: scene.length })}
            {extra}
          </g>
        ),
        life: (
          <g>
            {swayers(k, k.N(hues[2], "#1f3a26"), scene === "campagna" && !k.night ? (i) => (i % 2 ? <Poppy x={0} y={-10} s={1.2} /> : <g transform="translate(0 -12)"><path d="M0 0 v-6" stroke="#c9a04a" strokeWidth="0.6" /><ellipse cx="0" cy="-8" rx="1" ry="2.6" fill="#d9b45a" /></g>) : undefined)}
            {!k.night ? <Butterfly x={240} y={nearY - 8} c={scene === "campagna" ? "#f4f1ea" : "#f2a13a"} /> : null}
            {!k.night && scene !== "lago" ? <Butterfly x={140} y={k.yb - 3} s={0.8} c="#7ab8ee" delay={2.4} /> : null}
            {k.night ? <Fireflies k={k} n={7} /> : null}
            {life}
          </g>
        ),
      };
    }
    case "palazzo": {
      const gravel: ReactNode[] = [];
      for (let i = 0; i < 260; i++) {
        const y = k.y0 + rnd(i * 7 + 1) * (k.y1 - k.y0 + 6);
        const s = sz(y);
        gravel.push(<ellipse key={i} cx={f(80 + rnd(i * 13) * 240)} cy={f(y)} rx={f((0.5 + rnd(i) * 0.9) * s)} ry={f((0.3 + rnd(i + 2) * 0.5) * s)} fill={k.N(["#efe4c6", "#b8a888", "#f8f2e2", "#a89878", "#d8c8a4"][i % 5], ["#4a4438", "#3a3428", "#55503f", "#2e2a22", "#454033"][i % 5])} />);
      }
      return {
        base: (
          <g>
            <rect x="0" y={k.y0} width="400" height={k.y1 - k.y0 + 10} fill={k.N("#d6c79c", "#3a3428")} />
            {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M60 ${f(k.y0 + 10 + i * 16)} Q200 ${f(k.y0 + 6 + i * 16)} 340 ${f(k.y0 + 10 + i * 16)}`} stroke={k.N("#b8a880", "#2a2620")} strokeWidth="0.8" fill="none" opacity="0.6" />)}
            {gravel}
            {/* bordure di bosso potate, con le rose */}
            {[[60, 100], [300, 340]].map(([a, b], j) => (
              <g key={a}>
                <path d={`M${a} ${f(k.y0)} L${b} ${f(k.y0)} L${b + (j ? 30 : -30) * 0} ${f(k.y1 + 8)} L${a} ${f(k.y1 + 8)} Z`} fill={k.N("#2f5a2a", "#10200f")} transform={j ? `translate(${f(16)} 0)` : `translate(${f(-14)} 0)`} />
                {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={f((j ? 316 : 84) + (rnd(i * 3 + j) - 0.5) * 12)} cy={f(k.y0 + 6 + i * ((k.y1 - k.y0) / 12))} r={f(1.6 * sz(k.y0 + i * 9))} fill={k.N(["#d6304a", "#f27a8a", "#fbe6ea"][i % 3], "#3a1a20")} />)}
              </g>
            ))}
          </g>
        ),
        life: (
          <g>
            {!k.night ? <Butterfly x={230} y={nearY - 6} c="#f4f1ea" /> : <Fireflies k={k} n={6} />}
            {!k.night ? <Butterfly x={130} y={k.yb - 2.4} s={0.8} c="#f2c84b" delay={1.8} /> : null}
          </g>
        ),
      };
    }
    case "montagna":
      return {
        base: (
          <g>
            {meadow(k, g1, ["#4f7a36", "#5d8a40", "#6a9648", "#46703a"], { flowers: "alpini", seed: 7 })}
            <Rock x={112} y={k.yb} w={12} h={9} c={k.N("#8a8f96", "#34363c")} lichen={k.N("#d9c84a", "#4a4a2a")} />
            <Rock x={286} y={nearY + 6} w={10} h={7} c={k.N("#9a9ea4", "#3a3c42")} lichen={k.N("#e0a83a", "#4a3a2a")} />
            <Rock x={222} y={k.yb - 0.6} w={6} h={4} c={k.N("#7a7f86", "#2e3036")} />
          </g>
        ),
        life: (
          <g>
            {swayers(k, k.N("#6a9648", "#1f3a26"), (i) => (i % 2 ? <Edelweiss x={0} y={-10} s={1.1} /> : <Bell x={0} y={-10} s={1.1} c="#2f4fd8" />))}
            {!k.night ? <Butterfly x={200} y={nearY - 6} c="#5aa6e8" /> : null}
          </g>
        ),
      };
    case "foresta": {
      const floor = k.N(["#2f4a24", "#3a5a2a", "#456630", "#33502a"], ["#0f1c13", "#13221a", "#16281c", "#0c170f"]);
      return {
        base: (
          <g>
            <GrassField k={k} base={g1} hues={floor} tall={0.7} seed={3} />
            {/* aghi, rametti e radici */}
            <g stroke={k.N("#8a6a3a", "#2a2014")} strokeWidth="0.5" opacity="0.8">
              {Array.from({ length: 60 }, (_, i) => {
                const x = 90 + rnd(i * 3) * 220;
                const y = k.y0 + 20 + rnd(i * 5) * (k.y1 - k.y0 - 20);
                const a = rnd(i) * Math.PI;
                const l = 2 * sz(y);
                return <path key={i} d={`M${f(x)} ${f(y)} l${f(Math.cos(a) * l)} ${f(Math.sin(a) * l * 0.4)}`} />;
              })}
            </g>
            {[[88, 1], [312, -1]].map(([x, d]) => <path key={x} d={`M${x} ${f(k.y0 + 30)} C${x + d * 20} ${f(k.y0 + 50)} ${x + d * 6} ${f(k.yb - 6)} ${x + d * 30} ${f(k.y1 + 6)}`} stroke={k.N("#4a3322", "#1a120c")} strokeWidth="5" fill="none" strokeLinecap="round" />)}
            <Rock x={262} y={k.yb - 0.3} w={11} h={7} c={k.N("#6a7066", "#2a2e2a")} lichen={k.N("#7aa046", "#2a3a22")} />
            {[[276, k.yb - 0.6, 1.3], [286, k.yb - 0.3, 0.9], [118, nearY + 4, 1], [126, nearY + 6, 0.7]].map(([x, y, s], i) => <Mushroom key={i} x={x} y={y} s={s * sz(y)} cap={i < 2 ? "#c4302a" : "#8a5a2a"} dots={i < 2} />)}
            <Fern x={92} y={k.y1 + 2} s={1.3} c={k.N("#4f8a3a", "#1f3a2a")} />
            <Fern x={308} y={k.y1 + 2} s={1.3} flip c={k.N("#4f8a3a", "#1f3a2a")} />
          </g>
        ),
        life: (
          <g>
            <Sway x={300} y={k.top + 4}><Fern x={0} y={0} s={1} flip c={k.N("#5a9a44", "#1f3a2a")} /></Sway>
            <Sway x={100} y={k.top + 4} delay={1}><Fern x={0} y={0} s={1} c={k.N("#5a9a44", "#1f3a2a")} /></Sway>
            {k.night ? <Fireflies k={k} n={10} /> : <Motes k={k} />}
          </g>
        ),
      };
    }
    case "autunno": {
      const reds = k.N(["#d9822a", "#c4473d", "#e6b325", "#b0602a", "#8a3a22"], ["#3a2414", "#3a1a14", "#3a3014", "#2e1c10", "#241210"]);
      const leaves: ReactNode[] = [];
      for (let i = 0; i < 130; i++) {
        const y = k.y0 + 6 + rnd(i * 5) * (k.y1 - k.y0);
        leaves.push(i % 3 ? <Maple key={i} x={80 + rnd(i * 11) * 240} y={y} s={sz(y) * 0.95} rot={rnd(i * 3) * 360} c={reds[i % reds.length]} /> : <Leaf key={i} x={80 + rnd(i * 11) * 240} y={y} s={sz(y)} rot={rnd(i * 3) * 360} c={reds[i % reds.length]} />);
      }
      return {
        base: (
          <g>
            <GrassField k={k} base={g1} hues={k.N(["#8a7a3a", "#9a8a42", "#a89848", "#7a6a30"], ["#1f1a10", "#241e12", "#2a2414", "#1a160c"])} tall={0.8} seed={5} />
            {leaves}
            {[[120, k.yb - 0.6], [128, k.yb - 0.3], [276, nearY + 4]].map(([x, y], i) => (
              <g key={i} transform={`translate(${x} ${f(y)}) scale(${f(sz(y))})`}>
                <ellipse cx="0" cy="-1.4" rx="1.3" ry="1.7" fill={k.N("#8a5a2a", "#2a1a10")} />
                <path d="M-1.5 -2.6 C-1.4 -4 1.4 -4 1.5 -2.6 Z" fill={k.N("#5a3a1e", "#1a120a")} />
              </g>
            ))}
            <Mushroom x={290} y={k.yb - 0.3} s={k.sb * 1.1} cap={k.N("#a8642a", "#2a1a10")} dots={false} />
          </g>
        ),
        life: <g>{k.night ? <Fireflies k={k} n={5} /> : null}<FallingLeaves k={k} colors={reds} /></g>,
      };
    }
    case "deserto":
    case "spiaggia": {
      const beach = scene === "spiaggia";
      const sand = k.N(beach ? "#dcc38c" : "#c9a066", beach ? "#4a4230" : "#4a3a26");
      const ripple = k.N(beach ? "#c4aa72" : "#b08a52", "#2e2618");
      const shine = k.N(beach ? "#f2e2b8" : "#e2c48a", "#5a5038");
      const rip: ReactNode[] = [];
      let y = k.y0 + 4;
      let r = 0;
      while (y < k.y1 + 4) {
        const s = sz(y);
        const d = `M60 ${f(y)} ${Array.from({ length: 12 }, (_, i) => `Q${f(72 + i * 24)} ${f(y - 1.6 * s * (0.6 + rnd(r * 12 + i)))} ${f(84 + i * 24)} ${f(y)}`).join(" ")}`;
        rip.push(<g key={r}><path d={d} stroke={shine} strokeWidth={f(0.7 * s)} fill="none" opacity="0.7" /><path d={d} stroke={ripple} strokeWidth={f(0.6 * s)} fill="none" transform={`translate(0 ${f(0.9 * s)})`} /></g>);
        y += 6.2 * s;
        r++;
      }
      return {
        base: (
          <g>
            <rect x="0" y={k.y0} width="400" height={k.y1 - k.y0 + 10} fill={sand} />
            {rip}
            <g fill={ripple} opacity="0.6">{Array.from({ length: 120 }, (_, i) => <circle key={i} cx={f(80 + rnd(i * 3) * 240)} cy={f(k.y0 + rnd(i * 7) * (k.y1 - k.y0))} r={f(0.25 + rnd(i) * 0.35)} />)}</g>
            {beach ? (
              <g>
                {/* impronte che vanno verso il mare */}
                {Array.from({ length: 6 }, (_, i) => {
                  const yy = k.yb - i * 9;
                  const s = Math.min(1.3, sz(yy));
                  return <ellipse key={i} cx={f(226 + (i % 2 ? 3 : -3) * s - i * 3)} cy={f(yy)} rx={f(1.6 * s)} ry={f(2.6 * s)} fill={ripple} opacity="0.7" />;
                })}
                <Shell x={118} y={k.yb - 0.9} s={k.sb * 1.1} />
                <Shell x={270} y={nearY + 3} s={sz(nearY)} c="#f4e6d4" />
                <Starfish x={290} y={k.yb - 1.2} s={k.sb * 1.2} rot={18} />
                <path d={`M140 ${f(nearY + 4)} q4 -2 8 0 q4 2 8 0`} stroke={k.N("#4a6a3a", "#1f2a1a")} strokeWidth="1.2" fill="none" />
              </g>
            ) : (
              <g>
                <Rock x={286} y={k.yb - 0.3} w={11} h={7} c={k.N("#b07a4a", "#3a2a1e")} />
                <Rock x={120} y={nearY + 5} w={6} h={4} c={k.N("#a8764a", "#3a2a1e")} />
                {/* cactus a botte col fiore */}
                <g transform={`translate(112 ${f(k.yb - 0.3)}) scale(${f(k.sb)})`}>
                  <ellipse cx="0" cy="0" rx="6" ry="1.2" fill="#000" opacity="0.25" />
                  <path d="M-5 0 C-6 -8 6 -8 5 0 Z" fill={k.N("#4f8a4a", "#1f3a22")} />
                  {[-3, -1, 1, 3].map((x) => <path key={x} d={`M${x} -0.4 Q${x * 0.8} -5 ${x * 0.3} -6.4`} stroke={k.N("#3a6a36", "#14281a")} strokeWidth="0.5" fill="none" />)}
                  <circle cx="0" cy="-6.6" r="1.3" fill={k.N("#f27a9a", "#4a2a30")} />
                </g>
                <g transform={`translate(248 ${f(k.yb - 0.6)})`} stroke={k.N("#8a6a3a", "#2a2014")} strokeWidth="0.6" fill="none">
                  <path d="M0 0 l-4 -6 M0 0 l1 -7 M0 0 l5 -5 M-2 -3 l-2 -1 M1 -4 l2 -2" />
                </g>
              </g>
            )}
          </g>
        ),
        life: beach ? (
          <g>
            <Crab x={200} y={k.yb - 1.2} s={k.sb} />
            <Crab x={258} y={nearY + 4} s={sz(nearY) * 0.8} delay={2.2} />
            <Sparkles k={k} n={6} />
          </g>
        ) : (
          <g>
            <Tumbleweed y={k.yb - 1.8} s={k.sb * 1.1} />
            <Lizard x={278} y={k.yb - 2.4} s={k.sb * 0.9} c={k.N("#b08a4a", "#3a2a1a")} />
          </g>
        ),
      };
    }
    case "neve": {
      const snow = k.N("#dfe7ef", "#3a4a64");
      const shade = k.N("#b9c8d8", "#2a3850");
      return {
        base: (
          <g>
            <rect x="0" y={k.y0} width="400" height={k.y1 - k.y0 + 10} fill={snow} />
            {/* cumuli soffici */}
            {Array.from({ length: 7 }, (_, i) => {
              const y = k.y0 + 12 + i * 15;
              const s = sz(y);
              const d = `M40 ${f(y)} ${Array.from({ length: 8 }, (_, j) => `Q${f(60 + j * 40)} ${f(y - (3 + rnd(i * 8 + j) * 4) * s)} ${f(80 + j * 40)} ${f(y)}`).join(" ")} V${f(y + 8 * s)} H40 Z`;
              return <g key={i}><path d={d} fill={lite(snow, 0.25)} /><path d={d} fill={shade} opacity="0.35" transform={`translate(0 ${f(2.4 * s)})`} /></g>;
            })}
            {/* impronte di passi */}
            {Array.from({ length: 7 }, (_, i) => {
              const yy = k.yb - i * 10;
              const s = Math.min(1.3, sz(yy));
              return <ellipse key={i} cx={f(150 + (i % 2 ? 4 : -4) * s + i * 6)} cy={f(yy)} rx={f(1.6 * s)} ry={f(2.8 * s)} fill={shade} />;
            })}
            {/* rametto d'abete caduto, con la neve sopra */}
            <g transform={`translate(272 ${f(k.yb - 0.9)}) rotate(-8)`}>
              <path d="M0 0 H30" stroke={k.N("#5a3a22", "#1f140c")} strokeWidth="1.2" />
              {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${2 + i * 2.4} 0 l2 ${i % 2 ? 3 : -3}`} stroke={k.N("#2f5a3a", "#122218")} strokeWidth="0.9" />)}
              <path d="M2 -1.4 Q15 -4 28 -1.4" stroke="#fff" strokeWidth="1.4" fill="none" opacity="0.9" />
            </g>
            <g transform={`translate(112 ${f(nearY + 4)})`} stroke={k.N("#4a3322", "#1a120c")} strokeWidth="0.6" fill="none"><path d="M0 0 l8 -3 M3 -1 l2 -3 M6 -2 l3 1" /></g>
          </g>
        ),
        life: (
          <g>
            <Sparkles k={k} n={12} />
            {!k.night ? <Robin x={240} y={nearY + 4} s={sz(nearY)} /> : null}
          </g>
        ),
      };
    }
    case "palestra":
      return {
        base: (
          <g>
            <Planks k={k} c1="#c49a62" c2="#a87d48" lines="#3a2410" />
            {/* righe del campo e linea d'attesa */}
            <path d={`M60 ${f(k.y0 + 44)} H340`} stroke="#2f6fbe" strokeOpacity="0.7" strokeWidth="2.2" />
            <path d={`M60 ${f(k.yb - 3)} H340`} stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" strokeDasharray="10 6" />
            <GroundQuiver x={110} y={k.yb - 0.3} s={k.sb} />
            <g transform={`translate(290 ${f(k.yb - 0.3)})`}>
              <ellipse cx="0" cy="0" rx="13" ry="1.6" fill="#000" opacity="0.3" />
              <path d={rr(-12, -9, 24, 9, 3)} fill="#1f3a5f" />
              <path d="M-12 -5 H12" stroke="#e6c84a" strokeWidth="0.8" />
              <path d="M-5 -9 Q0 -14 5 -9" stroke="#111" strokeWidth="1" fill="none" />
            </g>
          </g>
        ),
        life: <Motes k={k} />,
      };
    case "palazzetto": {
      const at = (i: number, y: number) => {
        const xt = 105 + i * 49;
        const xb = -40 + i * 96;
        return xt + ((xb - xt) * (y - 214)) / 86;
      };
      const yb = k.y1 + 8;
      return {
        base: (
          <g>
            <rect x="0" y={k.y0} width="400" height={yb - k.y0} fill="#2a5680" />
            {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${f(at(i - 1, k.y0))} ${k.y0} L${f(at(i - 1, yb))} ${f(yb)}`} stroke="#fff" strokeOpacity="0.4" strokeWidth="1.1" />)}
            {Array.from({ length: 7 }, (_, i) => {
              const y = k.y0 + 42;
              const x = (at(i - 1, y) + at(i, y)) / 2;
              return <text key={i} x={f(x)} y={f(y)} textAnchor="middle" fontSize={f(6 * sz(y))} fontWeight="700" fill="#fff" opacity="0.55">{i}</text>;
            })}
            <path d={`M0 ${f(k.yb - 3.6)} H400`} stroke="#f4f1ea" strokeOpacity="0.8" strokeWidth="2.6" strokeDasharray="12 6" />
            <ellipse cx="200" cy={f(k.y0 + 30)} rx="120" ry="12" fill="#fff" opacity="0.05" />
            {[110, 290].map((x) => (
              <g key={x} transform={`translate(${x} ${f(k.yb - 0.6)})`}>
                <path d="M0 -14 L-4 0 M0 -14 L4 0 M0 -14 L0 0" stroke="#9aa3ad" strokeWidth="0.8" />
                <path d="M-1.6 -14 L-2 -26 H2 L1.6 -14 Z" fill="#c4473d" />
                {["#f2c84b", "#2f7fd0"].map((c, i) => <path key={c} d={`M${-1 + i * 2} -26 l${-1 + i * 2} -4`} stroke={c} strokeWidth="1.2" />)}
              </g>
            ))}
          </g>
        ),
        life: <Motes k={k} n={6} />,
      };
    }
    case "capannone":
      return {
        base: (
          <g>
            <rect x="0" y={k.y0} width="400" height={k.y1 - k.y0 + 10} fill="#7a5c3a" />
            <g stroke="#d8b25a" strokeLinecap="round">
              {Array.from({ length: 160 }, (_, i) => {
                const y = k.y0 + rnd(i * 7) * (k.y1 - k.y0 + 4);
                const s = sz(y);
                const a = (rnd(i * 3) - 0.5) * 1.6;
                return <path key={i} d={`M${f(70 + rnd(i * 13) * 260)} ${f(y)} l${f(Math.cos(a) * 5 * s)} ${f(Math.sin(a) * 2 * s)}`} strokeWidth={f(0.5 * s)} opacity={0.4 + rnd(i) * 0.5} />;
              })}
            </g>
            {[[88, 1], [312, -1]].map(([x, d]) => (
              <g key={x} transform={`translate(${x} ${f(k.y1 + 2)})`}>
                <path d={rr(d > 0 ? -24 : -6, -16, 30, 17, 3)} fill="#d0a64e" stroke="#8a6a2a" strokeWidth="0.7" />
                {[0, 1, 2, 3].map((i) => <path key={i} d={`M${d > 0 ? -22 : -4} ${-12.6 + i * 3.6} h26`} stroke="#a87e34" strokeWidth="0.5" />)}
              </g>
            ))}
            <g transform={`translate(${f(276)} ${f(k.top + 2)})`}>
              <path d="M-4 0 H4 L3 -8 H-3 Z" fill="#2a2a2a" />
              <rect x="-2.6" y="-7.4" width="5.2" height="6.4" fill="#ffd27a" opacity="0.5" />
              <path d="M-3 -8 Q0 -12 3 -8" stroke="#2a2a2a" strokeWidth="0.7" fill="none" />
            </g>
          </g>
        ),
        life: (
          <g>
            <Flame x={276} y={k.top - 0.6} s={0.6} />
            <Motes k={k} c="#ffd98a" />
          </g>
        ),
      };
    case "salone":
    default: {
      const edge = (side: -1 | 1, y: number) => (side < 0 ? 120 - ((y - 300) * 50) / 86 : 280 + ((y - 300) * 50) / 86);
      const yb = k.y1 + 8;
      return {
        base: (
          <g>
            <Planks k={k} c1="#6a4a30" c2="#573c26" lines="#1a0e06" />
            <path d={`M${f(edge(-1, k.y0))} ${k.y0} L${f(edge(1, k.y0))} ${k.y0} L${f(edge(1, yb))} ${f(yb)} L${f(edge(-1, yb))} ${f(yb)} Z`} fill="#7a1f24" opacity="0.92" />
            {[-1, 1].map((sd) => (
              <path key={sd} d={`M${f(edge(sd as -1 | 1, k.y0) - sd * 8)} ${k.y0} L${f(edge(sd as -1 | 1, yb) - sd * 12)} ${f(yb)}`} stroke="#d9b45a" strokeWidth="1.2" opacity="0.85" />
            ))}
            {/* motivo ricamato sul tappeto */}
            {Array.from({ length: 4 }, (_, i) => {
              const y = k.y0 + 26 + i * 24;
              const s = sz(y);
              return <path key={i} d={`M200 ${f(y - 4 * s)} L${f(200 + 6 * s)} ${f(y)} L200 ${f(y + 4 * s)} L${f(200 - 6 * s)} ${f(y)} Z`} fill="none" stroke="#d9b45a" strokeWidth={f(0.6 * s)} opacity="0.7" />;
            })}
            {/* candelabri ai lati */}
            {[96, 304].map((x) => (
              <g key={x} transform={`translate(${x} ${f(k.top + 2)})`}>
                <path d="M-3 0 H3 L1 -2 V-12 H-1 V-2 Z" fill="#8a6a3a" />
                <path d="M-5 -12 H5" stroke="#8a6a3a" strokeWidth="1.2" />
                {[-4, 0, 4].map((dx) => <rect key={dx} x={dx - 0.8} y="-16" width="1.6" height="4" fill="#f4ecd8" />)}
              </g>
            ))}
            <g transform={`translate(290 ${f(k.yb - 0.3)})`}>
              <path d={rr(-12, -11, 24, 11, 1.4)} fill="#5a3a22" />
              <path d="M-12 -7 H12 M-6 -11 V0 M6 -11 V0" stroke="#3a3a3a" strokeWidth="1" />
              <circle cx="0" cy="-5" r="1" fill="#d9b45a" />
            </g>
          </g>
        ),
        life: (
          <g>
            {[96, 304].map((x) => [-4, 0, 4].map((dx) => <Flame key={`${x}${dx}`} x={x + dx} y={k.top - 14} s={0.5} />))}
            <Motes k={k} c="#ffd98a" n={6} />
          </g>
        ),
      };
    }
  }
}

/** Il terreno disegnato, con la luce dell'ora, la pioggia o la neve. */
export const SceneApron = memo(function SceneApron({ sky, scene, V, top, bottom }: { sky: Sky; scene: string; V: number; top: number; bottom: number }) {
  const sc = sceneById(scene);
  const p = SKY[sky.tod];
  const indoor = Boolean(sc.indoor);
  const night = !indoor && sky.tod === "notte";
  const rain = !indoor && sky.weather === "pioggia";
  const snowing = !indoor && (sc.id === "neve" || (rain && sc.id === "montagna"));
  const y0 = APRON_Y0;
  const y1 = y0 + V;
  const yb = bottom + (y1 - bottom) * 0.62;
  const k: K = { id: `ap${sc.id}`, night, N: (d, n) => (night ? n : d), y0, y1, top, bottom, rain, yb, sb: Math.min(1.45, sz(yb)) };
  const part = scenePart(sc.id, k);
  const vb = `${X0} ${y0} ${VW} ${f(V)}`;
  return (
    <>
      <svg viewBox={vb} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={`${k.id}fore`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity={indoor ? 0.1 : night ? 0.22 : 0.13} />
            <stop offset="0.35" stopColor="#000" stopOpacity={indoor ? 0.16 : night ? 0.36 : 0.24} />
            <stop offset="1" stopColor="#000" stopOpacity={indoor ? 0.34 : night ? 0.55 : 0.4} />
          </linearGradient>
          <linearGradient id={`${k.id}side`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity="0.28" />
            <stop offset="0.18" stopColor="#000" stopOpacity="0" />
            <stop offset="0.82" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.28" />
          </linearGradient>
        </defs>
        {part.base}
        <rect x={X0} y={y0} width={VW} height={f(V + 2)} fill={`url(#${k.id}fore)`} />
        <rect x={X0} y={y0} width={VW} height={f(V + 2)} fill={`url(#${k.id}side)`} />
        {!indoor && p.shadeA ? <rect x={X0} y={y0} width={VW} height={f(V + 2)} fill={p.shade} opacity={p.shadeA} style={{ mixBlendMode: night ? "multiply" : "soft-light" }} /> : null}
        {rain ? <rect x={X0} y={y0} width={VW} height={f(V + 2)} fill="#3a4450" opacity="0.2" /> : null}
      </svg>
      {/* le cose che si muovono stanno in un disegno a parte: il terreno sotto non si ridisegna */}
      <svg viewBox={vb} preserveAspectRatio="none" className="aa-apron-life absolute inset-0 h-full w-full" aria-hidden>
        <g opacity={night ? 0.85 : 1}>{part.life}</g>
        {rain ? (
          <g className="aa-rain" stroke="#dce8f2" strokeOpacity="0.45" strokeWidth="0.7">
            {Array.from({ length: 40 }, (_, i) => <path key={i} d={`M${f(X0 + ((i * 37.7) % (VW + 20)))} ${f(y0 + ((i * 23.3) % V))} l-3 10`} />)}
          </g>
        ) : null}
        {snowing ? (
          <g className="aa-snow" fill="#fff" opacity="0.85">
            {Array.from({ length: 26 }, (_, i) => <circle key={i} cx={f(X0 + rnd(i * 5) * VW)} cy={f(y0 + rnd(i * 9) * V)} r={f(0.8 + rnd(i) * 1.2)} />)}
          </g>
        ) : null}
      </svg>
    </>
  );
});

/**
 * Il prolungamento del gioco con i pulsanti sopra. Sta sotto il gioco e ne riprende il terreno;
 * misura sé stesso e i pulsanti, così il disegno ha la stessa scala della scena e gli animali stanno
 * dove si vedono (sopra e sotto i pulsanti).
 */
export function GameApron({ sky, scene, lefty, children }: { sky: Sky; scene: string; lefty: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ w: 390, h: 250, t: 76, c: 140 });
  useLayoutEffect(() => {
    const el = box.current;
    const ci = inner.current;
    if (!el || !ci) return;
    const read = () => setM({ w: el.clientWidth, h: el.clientHeight, t: ci.offsetTop, c: ci.offsetHeight });
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    ro.observe(ci);
    return () => ro.disconnect();
  }, []);
  const u = VW / Math.max(1, m.w);
  return (
    <div ref={box} className="aa-apron relative z-0 -mt-[13.33%] overflow-hidden md:rounded-b-[1.75rem]">
      <div key={scene} className={`aa-apron-scene aa-scene-swap pointer-events-none absolute inset-0 ${lefty ? "aa-mirror" : ""}`}>
        <SceneApron sky={sky} scene={scene} V={m.h * u} top={APRON_Y0 + m.t * u} bottom={APRON_Y0 + (m.t + m.c) * u} />
      </div>
      <div ref={inner} className="relative z-[1] mx-3 mb-[3.75rem] mt-[calc(13.33%_+_2.4rem)] grid gap-2.5">
        {children}
      </div>
    </div>
  );
}
