/**
 * I due costumi «Demone di Montelago» (abiti su misura, special-looks): disegnati dalle foto del festival.
 *
 * - «rosso» (Simone): maschera rossa da demone con occhi gialli e lingua di fuori, corna nere lucide (una sale
 *   dritta, l'altra si arriccia in dentro), capelli e barba grigi lunghi con la treccia, tunica cremisi,
 *   mantello bordeaux, mani rosse con artigli d'oro e bastone nodoso con il teschio di cavallo.
 * - «teschio» (Victor): teschio d'osso con zanna gialla, corna lunghe ad anelli, capelli rosso acceso,
 *   stola di pelliccia rossa, kilt nero con il pannello scozzese rosso, corno per bere, gambali neri sfrangiati
 *   e bastone scuro con il teschio di capra e la nappa rossa.
 *
 * La testa di fronte sta nelle coordinate del volto (100 × 100, come AvatarFace); quella di profilo nelle
 * coordinate della figura di profilo (testa in 150, 86); il resto nelle coordinate della figura intera.
 */
import type { ReactNode } from "react";
import type { AvatarLook } from "@/lib/arcieri/avatar";

export type DemonKind = "rosso" | "teschio";
const KINDS: Record<string, DemonKind> = { "demone-simone": "rosso", "demone-victor": "teschio" };
export const demonOf = (look: Pick<AvatarLook, "special">): DemonKind | null => KINDS[look.special] ?? null;
/** le corna sono alte: la figura di fronte si rimpicciolisce un poco perché stiano nel riquadro */
export const demonScale = (look: Pick<AvatarLook, "special">) => (demonOf(look) === "teschio" ? 0.8 : demonOf(look) === "rosso" ? 0.84 : 1);
/** mani del costume: rosse con gli artigli (Simone), altrimenti le sue */
export const demonHand = (look: Pick<AvatarLook, "special">) => (demonOf(look) === "rosso" ? "#a3201a" : null);

const f = (n: number) => n.toFixed(1);
const OUT = "#1a0d08";
const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* ---------- geometria ---------- */

type Pt = [number, number];
/** curva morbida che passa per i punti (Catmull-Rom), campionata */
function smooth(pts: Pt[], n = 28): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (pts.length - 1);
    const k = Math.min(pts.length - 2, Math.floor(t));
    const u = t - k;
    const p0 = pts[Math.max(0, k - 1)];
    const p1 = pts[k];
    const p2 = pts[k + 1];
    const p3 = pts[Math.min(pts.length - 1, k + 2)];
    const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u * u + (-a + 3 * b - 3 * cc + d) * u * u * u);
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}
/** un corno (o una ciocca) che si assottiglia: contorno, e le coppie di punti dei due bordi per gli anelli */
function taper(pts: Pt[], w0: number, w1: number, n = 30) {
  const c = smooth(pts, n);
  const L: Pt[] = [];
  const R: Pt[] = [];
  c.forEach((p, i) => {
    const a = c[Math.max(0, i - 1)];
    const b = c[Math.min(c.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * Math.pow(i / (c.length - 1), 0.9)) / 2;
    L.push([p[0] - (dy / len) * w, p[1] + (dx / len) * w]);
    R.push([p[0] + (dy / len) * w, p[1] - (dx / len) * w]);
  });
  const d = `M${L.map((p) => `${f(p[0])} ${f(p[1])}`).join(" L")} L${R.reverse().map((p) => `${f(p[0])} ${f(p[1])}`).join(" L")} Z`;
  R.reverse();
  return { d, L, R, c };
}

/** un corno: forma, lume lungo il dorso, anelli (fitti per quelli ad anelli, radi per quelli lisci) */
function Horn({ pts, w0, w1, uid, id, ringed, base, light }: { pts: Pt[]; w0: number; w1: number; uid: string; id: string; ringed: boolean; base: string; light: string }) {
  const h = taper(pts, w0, w1, 34);
  const step = ringed ? 2 : 5;
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shadeHex(base, -0.45)} />
          <stop offset="0.38" stopColor={base} />
          <stop offset="0.55" stopColor={light} />
          <stop offset="1" stopColor={shadeHex(base, -0.55)} />
        </linearGradient>
      </defs>
      <path d={h.d} fill={`url(#${uid}${id})`} stroke={OUT} strokeOpacity="0.75" strokeWidth="0.55" strokeLinejoin="round" />
      {/* anelli: una piega scura e il bordo chiaro sopra */}
      {h.L.map((p, i) =>
        i % step === 1 && i < h.L.length - 3 ? (
          <g key={i}>
            <path d={`M${f(p[0])} ${f(p[1])} Q${f((p[0] + h.R[i][0]) / 2 + (h.c[i + 1][0] - h.c[i][0]) * 0.6)} ${f((p[1] + h.R[i][1]) / 2 + (h.c[i + 1][1] - h.c[i][1]) * 0.6)} ${f(h.R[i][0])} ${f(h.R[i][1])}`} stroke={shadeHex(base, -0.6)} strokeOpacity={ringed ? 0.85 : 0.5} strokeWidth={ringed ? 0.7 : 0.45} fill="none" />
            {ringed ? <path d={`M${f(p[0])} ${f(p[1] - 0.5)} Q${f((p[0] + h.R[i][0]) / 2)} ${f((p[1] + h.R[i][1]) / 2 - 0.9)} ${f(h.R[i][0])} ${f(h.R[i][1] - 0.5)}`} stroke={light} strokeOpacity="0.45" strokeWidth="0.4" fill="none" /> : null}
          </g>
        ) : null,
      )}
      {/* lume lungo il dorso */}
      <path d={`M${h.c.slice(1, -3).map((p, i) => `${f(p[0] + (h.L[i + 1][0] - p[0]) * 0.45)} ${f(p[1] + (h.L[i + 1][1] - p[1]) * 0.45)}`).join(" L")}`} stroke="#fff" strokeOpacity={ringed ? 0.18 : 0.32} strokeWidth="0.7" fill="none" strokeLinecap="round" />
    </g>
  );
}

function shadeHex(hex: string, k: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k));
  return `#${ch.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")}`;
}

/** ciocche di capelli o di pelliccia: tratti morbidi in tre toni dentro una sagoma */
function Strands({ from, to, n, color, seed, w = 1, sway = 3 }: { from: [Pt, Pt]; to: [Pt, Pt]; n: number; color: string; seed: number; w?: number; sway?: number }) {
  const dark = shadeHex(color, -0.45);
  const light = shadeHex(color, 0.4);
  return (
    <g fill="none" strokeLinecap="round">
      {Array.from({ length: n }, (_, i) => {
        const u = (i + rnd(seed + i) * 0.6) / n;
        const a: Pt = [from[0][0] + (from[1][0] - from[0][0]) * u, from[0][1] + (from[1][1] - from[0][1]) * u];
        const b: Pt = [to[0][0] + (to[1][0] - to[0][0]) * u, to[0][1] + (to[1][1] - to[0][1]) * u];
        const s = (rnd(seed * 3 + i) - 0.5) * sway * 2;
        const d = `M${f(a[0])} ${f(a[1])} C${f(a[0] + s)} ${f(a[1] + (b[1] - a[1]) * 0.35)} ${f(b[0] - s)} ${f(a[1] + (b[1] - a[1]) * 0.7)} ${f(b[0] + s * 0.4)} ${f(b[1] - rnd(seed + i * 7) * 3)}`;
        const tone = i % 3 === 0 ? dark : i % 3 === 1 ? light : color;
        return <path key={i} d={d} stroke={tone} strokeOpacity={i % 3 === 1 ? 0.5 : 0.75} strokeWidth={w * (0.5 + rnd(seed + i * 5) * 0.6)} />;
      })}
    </g>
  );
}

/** trama a crepe della maschera dipinta (stucco screpolato) */
function Crackle({ box, seed, n, color, w = 0.3 }: { box: [number, number, number, number]; seed: number; n: number; color: string; w?: number }) {
  return (
    <g stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {Array.from({ length: n }, (_, i) => {
        const x = box[0] + rnd(seed + i) * box[2];
        const y = box[1] + rnd(seed + i * 3) * box[3];
        const a = rnd(seed + i * 5) * Math.PI * 2;
        const l = 1.5 + rnd(seed + i * 7) * 3;
        const x2 = x + Math.cos(a) * l;
        const y2 = y + Math.sin(a) * l;
        return <path key={i} d={`M${f(x)} ${f(y)} L${f(x2)} ${f(y2)} L${f(x2 + Math.cos(a + 1) * l * 0.6)} ${f(y2 + Math.sin(a + 1) * l * 0.6)}`} />;
      })}
    </g>
  );
}

/** pelliccia folta: la sagoma piena, ciuffi corti dentro e ciuffi che escono dal bordo */
function FurMass({ pts, color, seed, k = 1 }: { pts: Pt[]; color: string; seed: number; /** grandezza dei ciuffi */ k?: number }) {
  const d = `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join(" L")} Z`;
  const dark = shadeHex(color, -0.42);
  const light = shadeHex(color, 0.35);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const inside = (x: number, y: number) => {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0;
  const h = Math.max(...ys) - y0;
  const tufts: ReactNode[] = [];
  const n = Math.round((w * h) / (9 * k * k));
  for (let i = 0; tufts.length < n && i < n * 3; i++) {
    const x = x0 + rnd(seed + i) * w;
    const y = y0 + rnd(seed + i * 7 + 1) * h;
    if (!inside(x, y)) continue;
    const a = Math.PI / 2 + (rnd(seed + i * 3) - 0.5) * 1.4;
    const l = (3 + rnd(seed + i * 5) * 4) * k;
    const c = (rnd(seed + i * 11) - 0.5) * 3 * k;
    const tone = i % 4 === 0 ? light : i % 3 === 0 ? dark : color;
    tufts.push(<path key={i} d={`M${f(x)} ${f(y)} q${f(Math.cos(a) * l * 0.5 + c)} ${f(Math.sin(a) * l * 0.5)} ${f(Math.cos(a) * l)} ${f(Math.sin(a) * l)}`} stroke={tone} strokeOpacity={tone === light ? 0.7 : 0.85} strokeWidth={f((1 + rnd(seed + i) * 0.8) * k)} />);
  }
  // ciuffi lungo il bordo, verso fuori
  const edge: ReactNode[] = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const steps = Math.max(1, Math.round(len / (2.6 * k)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const x = p[0] + (q[0] - p[0]) * t;
      const y = p[1] + (q[1] - p[1]) * t;
      const nx = (q[1] - p[1]) / (len || 1);
      const ny = -(q[0] - p[0]) / (len || 1);
      const l = (2 + rnd(seed + i * 31 + s) * 3.4) * k;
      const sg = inside(x + nx * 2, y + ny * 2) ? -1 : 1;
      edge.push(<path key={`${i}-${s}`} d={`M${f(x - nx * sg * 1.6)} ${f(y - ny * sg * 1.6)} q${f(nx * sg * l * 0.6 + (rnd(seed + s) - 0.5) * 2)} ${f(ny * sg * l * 0.6)} ${f(nx * sg * l)} ${f(ny * sg * l + 1.2 * k)}`} stroke={s % 3 ? color : dark} strokeWidth={f(1.5 * k)} />);
    }
  });
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} fill={dark} transform="translate(0 2)" opacity="0.5" />
      <g>{edge}</g>
      <path d={d} fill={color} />
      <g>{tufts}</g>
    </g>
  );
}

/* ---------- DI FRONTE: testa nelle coordinate del volto (100 × 100) ---------- */

const GREY = "#9a9894";
const REDHAIR = "#d2183e";

function RossoBack() {
  return (
    <g>
      {/* capelli grigi lunghi dietro la maschera, fino al petto */}
      <path d="M31 30 C22 44 20 70 22 98 C30 104 40 104 44 100 C40 80 40 56 44 36 Z M69 30 C78 44 80 70 78 98 C70 104 60 104 56 100 C60 80 60 56 56 36 Z" fill={shadeHex(GREY, -0.2)} />
      <Strands from={[[30, 32], [44, 34]]} to={[[22, 98], [44, 100]]} n={16} color={GREY} seed={3} w={1.1} />
      <Strands from={[[56, 34], [70, 32]]} to={[[56, 100], [78, 98]]} n={16} color={GREY} seed={9} w={1.1} />
    </g>
  );
}

function RossoFront({ uid }: { uid: string }) {
  const mask = "M50 22 C62 22 71 30 72 42 C73 50 71 56 68 62 C66 70 60 77 50 79 C40 77 34 70 32 62 C29 56 27 50 28 42 C29 30 38 22 50 22 Z";
  return (
    <g>
      <defs>
        <radialGradient id={`${uid}rm`} cx="48%" cy="40%" r="62%">
          <stop offset="0" stopColor="#d2402a" />
          <stop offset="0.45" stopColor="#9a1c16" />
          <stop offset="0.85" stopColor="#5a0c0a" />
          <stop offset="1" stopColor="#2e0605" />
        </radialGradient>
        <radialGradient id={`${uid}re`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff6a8" />
          <stop offset="0.55" stopColor="#f2c21e" />
          <stop offset="1" stopColor="#b07a0a" />
        </radialGradient>
        <linearGradient id={`${uid}rt`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a0c12" />
          <stop offset="0.4" stopColor="#d4222e" />
          <stop offset="1" stopColor="#a8121e" />
        </linearGradient>
        <linearGradient id={`${uid}rb`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a7874" />
          <stop offset="0.5" stopColor={GREY} />
          <stop offset="1" stopColor="#c8c6c2" />
        </linearGradient>
        <clipPath id={`${uid}rmc`}><path d={mask} /></clipPath>
      </defs>
      {/* corna nere lucide: la sinistra sale dritta, la destra si apre e si arriccia in dentro */}
      <Horn pts={[[38, 31], [29, 19], [22, 5], [19, -9], [21, -23]]} w0={13} w1={0.9} uid={uid} id="rh1" ringed={false} base="#1c1614" light="#7a6a62" />
      <Horn pts={[[62, 31], [73, 21], [83, 10], [88, -4], [85, -16], [75, -21]]} w0={13} w1={0.9} uid={uid} id="rh2" ringed={false} base="#1c1614" light="#7a6a62" />
      {/* capelli grigi che escono ai lati */}
      <Strands from={[[30, 34], [34, 30]]} to={[[22, 84], [30, 92]]} n={12} color={GREY} seed={21} w={1.2} sway={2} />
      <Strands from={[[66, 30], [70, 34]]} to={[[70, 92], [78, 84]]} n={12} color={GREY} seed={27} w={1.2} sway={2} />
      {/* orecchie a punta */}
      <path d="M31 45 C25 42 19 37 15 31 C18 40 22 49 30 54 Z" fill="#8a1814" stroke={OUT} strokeWidth="0.5" />
      <path d="M69 45 C75 42 81 37 85 31 C82 40 78 49 70 54 Z" fill="#8a1814" stroke={OUT} strokeWidth="0.5" />
      <path d="M29 47 C24 44 20 40 18 36 M71 47 C76 44 80 40 82 36" stroke="#3a0605" strokeWidth="0.7" fill="none" />
      {/* barba grigia lunga con la treccia: sotto la lingua */}
      <path d="M36 66 C33 86 38 108 45 124 C47 132 49 138 50 146 C51 138 53 132 55 124 C62 108 67 86 64 66 C58 74 42 74 36 66 Z" fill={`url(#${uid}rb)`} stroke="#4a4846" strokeWidth="0.4" />
      <Strands from={[[37, 70], [63, 70]]} to={[[44, 124], [56, 124]]} n={22} color={GREY} seed={41} w={0.9} sway={2.5} />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <path key={k} d={`M${f(46.5 + (k % 2) * 0.6)} ${f(116 + k * 4.4)} Q50 ${f(119 + k * 4.4)} ${f(53.5 - (k % 2) * 0.6)} ${f(116 + k * 4.4)}`} stroke="#5a5856" strokeWidth="0.9" fill="none" />
      ))}
      <rect x="47.6" y="140" width="4.8" height="2.6" rx="0.8" fill="#5a3418" stroke={OUT} strokeWidth="0.3" />
      {/* la maschera */}
      <path d={mask} fill={`url(#${uid}rm)`} stroke={OUT} strokeWidth="0.7" />
      <g clipPath={`url(#${uid}rmc)`}>
        <Crackle box={[28, 22, 44, 56]} seed={7} n={60} color="#2a0604" w={0.28} />
        <Crackle box={[30, 24, 40, 50]} seed={77} n={26} color="#ff8a5a" w={0.18} />
        {/* rughe sulla fronte */}
        <path d="M38 30 Q50 26 62 30 M37 33.5 Q50 29.5 63 33.5 M42 27 Q50 24.5 58 27" stroke="#3a0605" strokeWidth="0.7" fill="none" />
        <path d="M38 30.6 Q50 26.6 62 30.6" stroke="#ff7a4a" strokeOpacity="0.35" strokeWidth="0.4" fill="none" />
        {/* zigomi in luce */}
        <ellipse cx="38" cy="55" rx="5.5" ry="3.6" fill="#e2603a" opacity="0.35" />
        <ellipse cx="62" cy="55" rx="5.5" ry="3.6" fill="#e2603a" opacity="0.28" />
      </g>
      {/* arcate sopraccigliari pesanti, aggrottate */}
      <path d="M33 41 C38 35 45 36 49.5 42 C45 40.6 39 41 33.5 45 Z" fill="#6a0e0c" stroke={OUT} strokeWidth="0.5" />
      <path d="M67 41 C62 35 55 36 50.5 42 C55 40.6 61 41 66.5 45 Z" fill="#6a0e0c" stroke={OUT} strokeWidth="0.5" />
      <path d="M34 41.6 C39 36.6 45 37.4 48.6 41.4 M66 41.6 C61 36.6 55 37.4 51.4 41.4" stroke="#e86a44" strokeOpacity="0.5" strokeWidth="0.5" fill="none" />
      {/* occhi gialli dentro le orbite scure, pupilla a fessura */}
      {([[41, -12], [59, 12]] as const).map(([x, r]) => (
        <g key={x} transform={`rotate(${r} ${x} 46)`}>
          <ellipse cx={x} cy="46" rx="5.4" ry="3.6" fill="#1a0403" />
          <ellipse cx={x} cy="46" rx="3.9" ry="2.3" fill={`url(#${uid}re)`} />
          <ellipse cx={x} cy="46" rx="0.65" ry="2.1" fill="#1a0a02" />
          <circle cx={x - 1.2} cy="45.2" r="0.5" fill="#fff" opacity="0.9" />
        </g>
      ))}
      {/* naso largo con le narici */}
      <path d="M47 45 C46 51 43.4 55 42.6 58.6 C45 61 55 61 57.4 58.6 C56.6 55 54 51 53 45 Z" fill="#a8241c" stroke={OUT} strokeWidth="0.5" />
      <path d="M48.4 46 C48 51 46.4 54.6 46 57" stroke="#e06a44" strokeOpacity="0.55" strokeWidth="0.7" fill="none" />
      <ellipse cx="46.4" cy="58.4" rx="1.7" ry="1" fill="#2a0403" />
      <ellipse cx="53.6" cy="58.4" rx="1.7" ry="1" fill="#2a0403" />
      {/* pieghe dal naso alla bocca */}
      <path d="M42.6 57 C39 60 38 64 39 67 M57.4 57 C61 60 62 64 61 67" stroke="#3a0605" strokeWidth="0.8" fill="none" />
      {/* bocca aperta con le zanne */}
      <path d="M39.6 64 C44 60.6 56 60.6 60.4 64 C58 70.6 42 70.6 39.6 64 Z" fill="#200404" stroke={OUT} strokeWidth="0.5" />
      {[[42, 63.2, 1], [58, 63.2, 1], [45, 62.3, 0], [55, 62.3, 0]].map(([x, y, big], i) => <path key={i} d={`M${x - 1} ${y} L${x} ${y + (big ? 3.4 : 2)} L${x + 1} ${y} Z`} fill="#f2e6c0" />)}
      {[[43.4, 68.6], [56.6, 68.6]].map(([x, y], i) => <path key={i} d={`M${x - 1} ${y} L${x} ${y - 2.8} L${x + 1} ${y} Z`} fill="#efe2bc" />)}
      {/* lingua lunga, lucida, fuori fino sotto il mento */}
      <path d="M45 64.6 C43.6 72 44.4 80 50 85.6 C55.6 80 56.4 72 55 64.6 C53 66 47 66 45 64.6 Z" fill={`url(#${uid}rt)`} stroke="#4a0408" strokeWidth="0.5" />
      <path d="M50 67 V83" stroke="#6a0610" strokeWidth="0.6" />
      <path d="M46.6 68 C46 74 47 79 49 82" stroke="#ff9a9a" strokeOpacity="0.55" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </g>
  );
}

function TeschioBack() {
  return (
    <g>
      {/* capelli rossi lunghi dietro, fino al petto */}
      <path d="M32 28 C22 44 20 72 23 100 C32 106 42 104 46 98 C40 78 40 54 45 34 Z M68 28 C78 44 80 72 77 100 C68 106 58 104 54 98 C60 78 60 54 55 34 Z" fill={shadeHex(REDHAIR, -0.3)} />
      <Strands from={[[31, 30], [45, 34]]} to={[[23, 100], [46, 98]]} n={18} color={REDHAIR} seed={13} w={1.2} />
      <Strands from={[[55, 34], [69, 30]]} to={[[54, 98], [77, 100]]} n={18} color={REDHAIR} seed={19} w={1.2} />
    </g>
  );
}

function TeschioFront({ uid }: { uid: string }) {
  const skull = "M50 20 C63 20 71 29 71 41 C71 49 68.4 54 66.4 58 C65.4 64 62.4 69.6 58.4 71.6 L58.4 78.4 C55 81.6 45 81.6 41.6 78.4 L41.6 71.6 C37.6 69.6 34.6 64 33.6 58 C31.6 54 29 49 29 41 C29 29 37 20 50 20 Z";
  return (
    <g>
      <defs>
        <radialGradient id={`${uid}tb`} cx="46%" cy="34%" r="70%">
          <stop offset="0" stopColor="#f6eed8" />
          <stop offset="0.5" stopColor="#ddd0ae" />
          <stop offset="0.85" stopColor="#a8956e" />
          <stop offset="1" stopColor="#6e5c40" />
        </radialGradient>
        <radialGradient id={`${uid}tg`} cx="50%" cy="55%" r="50%">
          <stop offset="0" stopColor="#ff4a2a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff4a2a" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}tbc`}><path d={skull} /></clipPath>
      </defs>
      {/* corna lunghe ad anelli, quasi dritte, che si aprono appena */}
      <Horn pts={[[42.4, 27], [38.6, 10], [35, -8], [32, -26], [30.4, -44]]} w0={8} w1={1.4} uid={uid} id="th1" ringed base="#8a6a44" light="#d8bc8a" />
      <Horn pts={[[57.6, 27], [61.4, 10], [65, -8], [68, -26], [69.6, -44]]} w0={8} w1={1.4} uid={uid} id="th2" ringed base="#8a6a44" light="#d8bc8a" />
      {/* il teschio */}
      <path d={skull} fill={`url(#${uid}tb)`} stroke={OUT} strokeWidth="0.7" />
      <g clipPath={`url(#${uid}tbc)`}>
        {/* macchie di marcio e sangue secco */}
        <path d="M33 47 C36 44 40 48 38 53 C36 57 32 55 33 47 Z M62 31 C66 30 69 35 66 38 C63 40 60 36 62 31 Z M44 64 C47 66 53 66 56 64 L56 70 C52 72 48 72 44 70 Z" fill="#6a2a1a" opacity="0.6" />
        <path d="M35 58 C37 62 39 66 40 72 M64 57 C63 62 61 66 60 70" stroke="#5a1a10" strokeOpacity="0.55" strokeWidth="1.2" fill="none" />
        <Crackle box={[30, 21, 40, 30]} seed={51} n={16} color="#5a4430" w={0.3} />
        <path d="M50 21 C49 26 51 30 50 35 M41 24 C43 27 42 30 44 32" stroke="#5a4430" strokeWidth="0.45" fill="none" />
        {/* zigomi */}
        <path d="M33 56 C37 53 42 54 44 57 M67 56 C63 53 58 54 56 57" stroke="#8a7656" strokeWidth="1" fill="none" />
      </g>
      {/* orbite grandi e scure con un brace in fondo */}
      <path d="M35.6 42 C37.4 35.6 46 35.6 47.2 43 C47.6 49 41.6 51.6 38.4 49.6 C36.2 48 35.2 45 35.6 42 Z" fill="#140806" stroke={OUT} strokeWidth="0.5" />
      <path d="M64.4 42 C62.6 35.6 54 35.6 52.8 43 C52.4 49 58.4 51.6 61.6 49.6 C63.8 48 64.8 45 64.4 42 Z" fill="#140806" stroke={OUT} strokeWidth="0.5" />
      <ellipse cx="41.6" cy="44.4" rx="3.6" ry="3" fill={`url(#${uid}tg)`} className="aa-pulse" />
      <ellipse cx="58.4" cy="44.4" rx="3.6" ry="3" fill={`url(#${uid}tg)`} className="aa-pulse" style={{ animationDelay: "-0.8s" }} />
      {/* foro del naso a cuore rovesciato */}
      <path d="M50 51 C48 53 46.6 56 47.4 58.4 C48.4 59.4 49.4 58.6 50 57.4 C50.6 58.6 51.6 59.4 52.6 58.4 C53.4 56 52 53 50 51 Z" fill="#160806" />
      {/* bocca: gengive scure, denti di sopra, zanna gialla, mascella sotto */}
      <path d="M40 66.6 C44 70.6 56 70.6 60 66.6 L59 73 C55 77 45 77 41 73 Z" fill="#1a0806" />
      <path d="M40.4 63.6 C44 62 56 62 59.6 63.6 L59.6 66.6 C56 67.4 44 67.4 40.4 66.6 Z" fill="#5a1c14" />
      {Array.from({ length: 9 }, (_, i) => {
        const x = 41.4 + i * 2.15;
        const lo = 67.2 + (i % 2) * 0.6 + (i === 4 ? 0.8 : 0);
        return <path key={i} d={`M${f(x)} 65.2 L${f(x + 1.9)} 65.2 L${f(x + 1.7)} ${f(lo)} Q${f(x + 0.95)} ${f(lo + 0.6)} ${f(x + 0.2)} ${f(lo)} Z`} fill="#efe6cc" stroke="#6a5a3a" strokeWidth="0.25" />;
      })}
      <path d="M41.6 65 L43.6 65 L43.2 72.6 Q42.6 73.6 42 72.6 Z" fill="#e8b830" stroke="#7a5a10" strokeWidth="0.3" />
      {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${f(43.4 + i * 2.2)} 74.6 L${f(45.2 + i * 2.2)} 74.6 L${f(45 + i * 2.2)} ${f(72 - (i % 2) * 0.5)} L${f(43.6 + i * 2.2)} ${f(72 - (i % 2) * 0.5)} Z`} fill="#e2d6b4" stroke="#6a5a3a" strokeWidth="0.25" />)}
      {/* capelli rossi: la frangia che scende sulla fronte tra le corna e ciocche ai lati */}
      <path d="M38 22 C42 19 58 19 62 22 C61 28 58 34 55 38 C53 33 51 30 50 30 C49 30 47 33 45 38 C42 34 39 28 38 22 Z" fill={shadeHex(REDHAIR, -0.15)} />
      <Strands from={[[39, 21], [61, 21]]} to={[[44, 40], [56, 40]]} n={18} color={REDHAIR} seed={33} w={1} sway={2} />
      <Strands from={[[31, 30], [36, 24]]} to={[[25, 88], [33, 92]]} n={12} color={REDHAIR} seed={37} w={1.2} sway={2} />
      <Strands from={[[64, 24], [69, 30]]} to={[[67, 92], [75, 88]]} n={12} color={REDHAIR} seed={39} w={1.2} sway={2} />
      {/* perline e anelli d'oro tra i capelli, orecchino a cerchio */}
      <circle cx="41.6" cy="31" r="1.2" fill="none" stroke="#e8c24a" strokeWidth="0.6" />
      <circle cx="57.4" cy="28.6" r="1" fill="#e8c24a" />
      <circle cx="54" cy="34" r="0.9" fill="#3a8ad1" />
      <circle cx="71.4" cy="55" r="2.4" fill="none" stroke="#e8c24a" strokeWidth="0.7" />
    </g>
  );
}

/** la testa del demone di fronte, nelle coordinate del volto: "back" dietro il corpo, "front" il resto */
export function DemonHeadFront({ kind, uid, part }: { kind: DemonKind; uid: string; part?: "back" | "front" }) {
  const back = kind === "rosso" ? <RossoBack /> : <TeschioBack />;
  const front = kind === "rosso" ? <RossoFront uid={uid} /> : <TeschioFront uid={uid} />;
  if (part === "back") return back;
  if (part === "front") return front;
  return (
    <g>
      {back}
      {front}
    </g>
  );
}

/** foto profilo con il costume: sfondo, spalle del costume e la testa intera (rimpicciolita perché entrino le corna) */
export function DemonFaceSvg({ look, kind, uid, className, bare, part, frame }: { look: AvatarLook; kind: DemonKind; uid: string; className: string; bare: boolean; part?: "back" | "front"; frame?: ReactNode }) {
  if (bare) {
    return (
      <svg viewBox="0 0 100 100" className={className} overflow="visible" role="img" aria-label="Il demone di Montelago">
        <DemonHeadFront kind={kind} uid={uid} part={part} />
      </svg>
    );
  }
  const bg = look.faceBg || (kind === "rosso" ? "#5a0c12" : "#2a0a14");
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Il demone di Montelago">
      <defs>
        <radialGradient id={`${uid}dbg`} cx="50%" cy="38%" r="75%">
          <stop offset="0" stopColor={shadeHex(bg, 0.3)} />
          <stop offset="0.6" stopColor={bg} />
          <stop offset="1" stopColor={shadeHex(bg, -0.6)} />
        </radialGradient>
        <clipPath id={`${uid}dc`}><circle cx="50" cy="50" r="50" /></clipPath>
      </defs>
      <g clipPath={`url(#${uid}dc)`}>
        <rect width="100" height="100" fill={`url(#${uid}dbg)`} />
        {/* bagliore di fuoco dal basso */}
        <ellipse cx="50" cy="104" rx="60" ry="26" fill="#ff7a2a" opacity="0.22" />
        <g transform="translate(50 74) scale(0.7) translate(-50 -64)">
          <DemonHeadFront kind={kind} uid={uid} part="back" />
          {kind === "rosso" ? (
            <g>
              {/* mantello bordeaux e tunica cremisi */}
              <path d="M2 134 C6 108 24 96 50 96 C76 96 94 108 98 134 Z" fill={look.capeColor || "#4a2320"} />
              <path d="M24 134 C26 112 36 102 50 102 C64 102 74 112 76 134 Z" fill={look.shirt || "#8e1b26"} />
            </g>
          ) : (
            <g>
              {/* tunica nera e stola di pelliccia rossa */}
              <path d="M10 134 C14 110 30 100 50 100 C70 100 86 110 90 134 Z" fill="#161414" />
              <FurMass pts={[[4, 122], [10, 102], [30, 93], [50, 95], [70, 93], [90, 102], [96, 122], [80, 130], [62, 128], [50, 136], [38, 128], [20, 130]]} color="#cc1a2c" seed={61} k={1.4} />
            </g>
          )}
          <DemonHeadFront kind={kind} uid={uid} part="front" />
        </g>
      </g>
      {frame}
    </svg>
  );
}

/* ---------- DI PROFILO: testa nelle coordinate della figura (testa in 150, 86, guarda a destra) ---------- */

/** capelli lunghi dietro (dietro il corpo), al posto dei capelli di sempre */
export function DemonSideBack({ kind, dy }: { kind: DemonKind; dy: number }) {
  const c = kind === "rosso" ? GREY : REDHAIR;
  return (
    <g transform={`translate(0 ${f(dy)})`}>
      <path d="M136 68 C124 82 121 112 125 144 C132 148 142 148 148 144 C141 118 141 92 148 74 Z" fill={shadeHex(c, -0.3)} />
      <Strands from={[[134, 70], [148, 74]]} to={[[125, 144], [148, 144]]} n={18} color={c} seed={kind === "rosso" ? 5 : 15} w={1.3} />
    </g>
  );
}

export function DemonSideHead({ kind, uid, dy }: { kind: DemonKind; uid: string; dy: number }) {
  if (kind === "rosso") {
    const head = "M147 60 C158 60 166 66 168 74 C170 76 171 78 169 80 C172 83 176 86 177.4 90 C178 93 175.6 95 172.4 95 C172.4 97 171.4 98 170 98 L164 100 L170 104 C169 108 166 112 160 113 C152 114 144 110 138 104 C130 96 128 84 130 74 C133 65 140 60 147 60 Z";
    return (
      <g transform={`translate(0 ${f(dy)})`}>
        <defs>
          <radialGradient id={`${uid}srm`} cx="62%" cy="40%" r="70%">
            <stop offset="0" stopColor="#d2402a" />
            <stop offset="0.5" stopColor="#9a1c16" />
            <stop offset="1" stopColor="#3a0605" />
          </radialGradient>
          <linearGradient id={`${uid}srt`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7a0c12" />
            <stop offset="0.4" stopColor="#d4222e" />
            <stop offset="1" stopColor="#a8121e" />
          </linearGradient>
          <clipPath id={`${uid}srmc`}><path d={head} /></clipPath>
        </defs>
        {/* corno lontano, più scuro */}
        <g opacity="0.75"><Horn pts={[[154, 64], [149, 48], [147, 32], [151, 18], [159, 10]]} w0={9} w1={0.8} uid={uid} id="srh0" ringed={false} base="#100c0a" light="#4a3e38" /></g>
        {/* barba grigia lunga con la treccia */}
        <path d="M144 104 C142 120 146 142 154 158 L159 166 C161 152 166 132 165 110 C158 114 150 112 144 104 Z" fill={GREY} stroke="#4a4846" strokeWidth="0.4" />
        <Strands from={[[145, 106], [164, 112]]} to={[[153, 156], [160, 160]]} n={16} color={GREY} seed={45} w={1} sway={2} />
        {[0, 1, 2, 3].map((k) => <path key={k} d={`M${f(153.6 + k * 0.6)} ${f(146 + k * 4.4)} q3 2.4 5.6 -0.2`} stroke="#5a5856" strokeWidth="0.9" fill="none" />)}
        {/* la maschera di profilo */}
        <path d={head} fill={`url(#${uid}srm)`} stroke={OUT} strokeWidth="0.7" />
        <g clipPath={`url(#${uid}srmc)`}>
          <Crackle box={[128, 60, 50, 54]} seed={17} n={56} color="#2a0604" w={0.3} />
          <path d="M150 64 Q158 63 164 68 M148 68 Q157 67 163 72" stroke="#3a0605" strokeWidth="0.7" fill="none" />
          <ellipse cx="160" cy="92" rx="6" ry="4" fill="#e2603a" opacity="0.3" />
        </g>
        {/* arcata sopraccigliare e occhio giallo */}
        <path d="M156 74 C161 71 167 72 169 75 C166 76 161 77 157 79 Z" fill="#6a0e0c" stroke={OUT} strokeWidth="0.5" />
        <ellipse cx="162" cy="80.4" rx="4.4" ry="3" fill="#1a0403" />
        <ellipse cx="163" cy="80.4" rx="3" ry="1.9" fill="#f2c21e" />
        <ellipse cx="163.4" cy="80.4" rx="0.55" ry="1.7" fill="#1a0a02" />
        <circle cx="162.4" cy="79.8" r="0.45" fill="#fff" />
        <ellipse cx="172.4" cy="91.6" rx="1.4" ry="0.9" fill="#2a0403" />
        <path d="M160 88 C164 92 166 96 165 100" stroke="#3a0605" strokeWidth="0.8" fill="none" />
        {/* bocca, zanne e lingua di fuori */}
        <path d="M164 99.4 L171 98.4 L170.4 104 Z" fill="#200404" />
        <path d="M168.6 98.6 l0.8 2.6 l0.8 -2.8 Z M166 103.6 l0.8 -2.4 l0.8 2.4 Z" fill="#f2e6c0" />
        <path d="M166 101 C171 104 173.6 112 171 121 C169.6 125.6 164.6 125 165 120.4 C166 113 165 107 163.6 102.4 Z" fill={`url(#${uid}srt)`} stroke="#4a0408" strokeWidth="0.5" />
        <path d="M167.6 105 C169.6 110 170 115 169 119" stroke="#ff9a9a" strokeOpacity="0.55" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        {/* orecchio a punta verso dietro */}
        <path d="M143 78 C136 72 128 66 121 62 C126 72 133 85 141 90 Z" fill="#8a1814" stroke={OUT} strokeWidth="0.5" />
        <path d="M140 80 C134 75 129 70 125 66" stroke="#3a0605" strokeWidth="0.7" fill="none" />
        {/* capelli grigi sotto il corno */}
        <Strands from={[[136, 66], [146, 62]]} to={[[130, 104], [138, 108]]} n={10} color={GREY} seed={55} w={1.1} sway={2} />
        {/* corno vicino: sale indietro e si arriccia in avanti */}
        <Horn pts={[[146, 64], [138, 50], [134, 34], [137, 19], [146, 10], [153, 9]]} w0={10.5} w1={0.8} uid={uid} id="srh1" ringed={false} base="#1c1614" light="#7a6a62" />
      </g>
    );
  }
  const skull = "M146 58 C160 58 170 66 171 78 C172 82 170.6 84.6 168.6 86 L172.4 92 C173.4 95 171.4 97 168.4 97 L169 102 C168 106 164 110 158 111 C154 114 148 114 144 110 C134 104 128 94 128 80 C128 66 136 58 146 58 Z";
  return (
    <g transform={`translate(0 ${f(dy)})`}>
      <defs>
        <radialGradient id={`${uid}stb`} cx="58%" cy="32%" r="72%">
          <stop offset="0" stopColor="#f6eed8" />
          <stop offset="0.55" stopColor="#d8caa6" />
          <stop offset="1" stopColor="#7a6646" />
        </radialGradient>
        <clipPath id={`${uid}stc`}><path d={skull} /></clipPath>
      </defs>
      <g opacity="0.75"><Horn pts={[[152, 62], [149, 44], [144, 26], [137, 10], [129, -6]]} w0={7.6} w1={1.4} uid={uid} id="sth0" ringed base="#6a5034" light="#b89a6a" /></g>
      {/* stola di pelliccia rossa sotto la mascella (il resto è sul busto) */}
      <path d={skull} fill={`url(#${uid}stb)`} stroke={OUT} strokeWidth="0.7" />
      <g clipPath={`url(#${uid}stc)`}>
        <path d="M134 76 C138 72 142 76 140 82 C138 86 133 84 134 76 Z M150 60 C155 59 158 64 155 67 C152 69 149 65 150 60 Z" fill="#6a2a1a" opacity="0.55" />
        <Crackle box={[130, 58, 30, 26]} seed={81} n={14} color="#5a4430" w={0.3} />
        <path d="M150 94 C156 92 162 93 166 96" stroke="#8a7656" strokeWidth="1" fill="none" />
      </g>
      {/* orbita, naso, denti, zanna */}
      <path d="M154 76 C156 71 164 71 166 77 C167 82 162 85 158 84 C155 83 153 80 154 76 Z" fill="#140806" stroke={OUT} strokeWidth="0.5" />
      <ellipse cx="160" cy="78.4" rx="3" ry="2.6" fill="#ff4a2a" opacity="0.4" className="aa-pulse" />
      <path d="M168 86 L171.4 92 L167 92.6 Z" fill="#160806" />
      <path d="M158 96 L168.6 96.6 L168.8 99.6 L158 99.6 Z" fill="#5a1c14" />
      {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${f(158.4 + i * 2.1)} 98.4 l1.9 0 l-0.2 ${f(2.6 + (i % 2) * 0.5)} q-0.75 0.6 -1.5 0 Z`} fill="#efe6cc" stroke="#6a5a3a" strokeWidth="0.25" />)}
      <path d="M159.6 98.6 l1.6 0 l-0.5 6.6 q-0.4 0.8 -0.8 0 Z" fill="#e8b830" stroke="#7a5a10" strokeWidth="0.3" />
      <path d="M156 103 L168 102.6 L167 106 C163 108.6 159 108.6 156 107 Z" fill="#1a0806" />
      {Array.from({ length: 4 }, (_, i) => <path key={i} d={`M${f(158 + i * 2.2)} 106 l1.8 0 l-0.1 -2.4 l-1.6 0 Z`} fill="#e2d6b4" />)}
      {/* capelli rossi: dalla calotta indietro fino alle spalle e una frangia sulla fronte */}
      <path d="M134 62 C142 54 156 54 164 62 C166 68 166 72 164 76 C160 70 154 66 148 66 C142 68 138 74 136 82 C132 76 131 68 134 62 Z" fill={shadeHex(REDHAIR, -0.15)} />
      <Strands from={[[136, 60], [162, 60]]} to={[[134, 84], [165, 76]]} n={16} color={REDHAIR} seed={71} w={1.1} sway={2} />
      <Strands from={[[132, 66], [140, 62]]} to={[[126, 120], [136, 124]]} n={12} color={REDHAIR} seed={73} w={1.3} sway={2} />
      <circle cx="141.6" cy="92" r="2.6" fill="none" stroke="#e8c24a" strokeWidth="0.8" />
      <circle cx="152" cy="64" r="1" fill="#e8c24a" />
      <Horn pts={[[147, 62], [143, 44], [137, 26], [129, 10], [121, -6]]} w0={8} w1={1.4} uid={uid} id="sth1" ringed base="#8a6a44" light="#d8bc8a" />
    </g>
  );
}

/* ---------- BASTONI ---------- */

/** bastone nella mano libera, di fronte: da terra fino sopra la testa */
export function DemonStaffFront({ kind, x, uid, lean = 0 }: { kind: DemonKind; x: number; uid: string; /** inclinazione in gradi attorno alla mano (la cima lontana dal corpo) */ lean?: number }) {
  if (lean) return <g transform={`rotate(${lean} ${f(x)} 214)`}><DemonStaffFront kind={kind} x={x} uid={uid} /></g>;
  if (kind === "rosso") {
    // bastone nodoso, legno rossiccio con strisce rosse, teschio di cavallo in cima
    const d = `M${f(x + 1)} 352 C${f(x - 3)} 300 ${f(x + 4)} 250 ${f(x)} 200 C${f(x - 4)} 150 ${f(x + 3)} 110 ${f(x - 2)} 64`;
    return (
      <g>
        <path d={d} stroke={OUT} strokeWidth="7.2" fill="none" strokeLinecap="round" />
        <path d={d} stroke="#7a3a22" strokeWidth="5.6" fill="none" strokeLinecap="round" />
        <path d={d} stroke="#b0603a" strokeOpacity="0.5" strokeWidth="1.4" fill="none" transform="translate(-1.4 0)" />
        {[96, 140, 176, 236, 270, 318].map((y, i) => <path key={y} d={`M${f(x - 3)} ${y} q3 ${i % 2 ? 6 : -4} 6 ${i % 2 ? 2 : -1}`} stroke="#d0201a" strokeWidth="1.6" fill="none" strokeLinecap="round" />)}
        {[120, 228, 300].map((y) => <ellipse key={y} cx={f(x + 0.6)} cy={y} rx="3.8" ry="2.4" fill="#5a2a16" stroke={OUT} strokeWidth="0.5" />)}
        {/* borsello di cuoio legato sotto il teschio */}
        <path d={`M${f(x - 4)} 78 L${f(x - 12)} 104 L${f(x - 2)} 108 L${f(x + 2)} 82 Z`} fill="#8a5a32" stroke={OUT} strokeWidth="0.6" />
        <path d={`M${f(x - 10)} 100 l-2 10 M${f(x - 7)} 102 l-1 9 M${f(x - 4)} 104 l0 8`} stroke="#6a4224" strokeWidth="0.9" />
        {/* teschio di cavallo, lungo, con il muso in su */}
        <g transform={`translate(${f(x - 2)} 66) rotate(-28)`}>
          <path d="M-7 4 C-8 -6 -6 -18 -3 -30 C-2 -36 2 -36 3 -30 C6 -18 8 -6 7 4 C5 8 -5 8 -7 4 Z" fill="#ece2c8" stroke={OUT} strokeWidth="0.6" />
          <ellipse cx="-3.4" cy="-2" rx="2.2" ry="2.6" fill="#2a1a10" />
          <ellipse cx="3.4" cy="-2" rx="2.2" ry="2.6" fill="#2a1a10" />
          <path d="M-1.2 -26 L1.2 -26 L0.8 -16 L-0.8 -16 Z" fill="#5a4a36" />
          <path d="M-3 -32 h6 M-3.4 -29 h6.8" stroke="#8a7a5a" strokeWidth="0.5" />
          <path d="M-6 6 C-10 10 -14 10 -16 8 M6 6 C10 10 14 10 16 8" stroke="#5a3a20" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </g>
      </g>
    );
  }
  // bastone scuro e dritto con il teschio di capra, la nappa rossa, strisce verdi, il cartiglio e il cristallo
  const d = `M${f(x + 0.6)} 352 L${f(x - 0.4)} 40`;
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}tas`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a0a1a" />
          <stop offset="0.3" stopColor="#c8182e" />
          <stop offset="1" stopColor="#e83a4a" />
        </linearGradient>
      </defs>
      <path d={d} stroke={OUT} strokeWidth="6.4" strokeLinecap="round" />
      <path d={d} stroke="#2a2018" strokeWidth="4.8" strokeLinecap="round" />
      <path d={d} stroke="#5a4a3a" strokeOpacity="0.6" strokeWidth="1" transform="translate(-1.2 0)" />
      {/* fasce: rossa sopra la mano, verde, bianca */}
      <path d={`M${f(x - 3)} 192 L${f(x + 3)} 196 M${f(x - 3)} 198 L${f(x + 3)} 202 M${f(x - 3)} 204 L${f(x + 3)} 208`} stroke="#b01a2a" strokeWidth="2.4" />
      <path d={`M${f(x - 3)} 268 L${f(x + 3)} 272 M${f(x - 3)} 274 L${f(x + 3)} 278`} stroke="#6a9a4a" strokeWidth="2.2" />
      <path d={`M${f(x + 1)} 276 q4 10 1 22`} stroke="#8ab06a" strokeWidth="1.6" fill="none" />
      {/* cristallo appeso */}
      <path d={`M${f(x + 2)} 228 l3 8`} stroke="#c9c9c9" strokeWidth="0.5" />
      <path d={`M${f(x + 5)} 236 l2 3 l-2 5 l-2 -5 Z`} fill="#e6f2ff" stroke="#8aa0b8" strokeWidth="0.4" />
      {/* cartiglio a rombo con il sigillo */}
      <g transform={`translate(${f(x + 12)} 112) rotate(8)`}>
        <path d="M0 -9 L7 0 L0 9 L-7 0 Z" fill="#efe6d0" stroke="#3a2a1a" strokeWidth="0.5" />
        <path d="M0 -5 L4 0 L0 5 L-4 0 Z M-2 -2 L2 2 M2 -2 L-2 2" stroke="#6a1a1a" strokeWidth="0.5" fill="none" />
      </g>
      <path d={`M${f(x + 1)} 90 L${f(x + 12)} 103`} stroke="#3a2a1a" strokeWidth="0.5" />
      {/* nappa rossa lunga che pende dal teschio */}
      <path d={`M${f(x - 8)} 62 C${f(x - 12)} 80 ${f(x - 13)} 104 ${f(x - 10)} 126 L${f(x + 4)} 126 C${f(x + 5)} 104 ${f(x + 4)} 80 ${f(x + 2)} 62 Z`} fill={`url(#${uid}tas)`} />
      <Strands from={[[x - 9, 66], [x + 2, 66]]} to={[[x - 10, 126], [x + 4, 126]]} n={14} color="#d8203a" seed={91} w={0.8} sway={0.8} />
      <rect x={f(x - 9)} y="60" width="11" height="5" rx="1.4" fill="#8a1424" stroke={OUT} strokeWidth="0.4" />
      {/* strisce di stoffa verde e piume bianche */}
      <path d={`M${f(x + 2)} 58 C${f(x + 10)} 66 ${f(x + 14)} 78 ${f(x + 12)} 92 M${f(x + 1)} 60 C${f(x + 6)} 70 ${f(x + 8)} 82 ${f(x + 6)} 96`} stroke="#5a8a3a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d={`M${f(x - 2)} 58 C${f(x - 6)} 52 ${f(x - 8)} 46 ${f(x - 14)} 44`} stroke="#f4f1ea" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* teschio di capra con le piccole corna */}
      <g transform={`translate(${f(x)} 42)`}>
        <path d="M-5 -6 C-10 -10 -14 -16 -13 -22 M5 -6 C10 -10 14 -16 13 -22" stroke="#3a2a1e" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M-7 -6 C-8 -12 -4 -15 0 -15 C4 -15 8 -12 7 -6 C7 2 4 12 0 16 C-4 12 -7 2 -7 -6 Z" fill="#ece2c8" stroke={OUT} strokeWidth="0.6" />
        <ellipse cx="-3.4" cy="-6" rx="2" ry="2.4" fill="#2a1a10" />
        <ellipse cx="3.4" cy="-6" rx="2" ry="2.4" fill="#2a1a10" />
        <path d="M-1 4 L1 4 L0.6 9 L-0.6 9 Z" fill="#5a4a36" />
        <path d="M-6 -12 h12" stroke="#c8a8a8" strokeWidth="0.6" />
      </g>
    </g>
  );
}

/** bastone piantato a terra dietro l'arciere, di profilo */
export function DemonStaffSide({ kind, uid }: { kind: DemonKind; uid: string }) {
  return (
    <g transform="translate(-6 -12) rotate(-3 100 340)">
      <DemonStaffFront kind={kind} x={100} uid={`${uid}sd`} />
    </g>
  );
}

/* ---------- BUSTO E GAMBE, DI FRONTE (coordinate della figura intera) ---------- */

export function DemonFrontTorso({ look, cx, sh, hip, layer }: { look: AvatarLook; cx: number; sh: { l: number; r: number }; hip: { l: number; r: number }; layer: "under" | "over" }) {
  const kind = demonOf(look);
  if (!kind) return null;
  if (kind === "rosso") {
    if (layer !== "under") return null;
    return (
      <g pointerEvents="none">
        {/* borsa di cuoio nero davanti alla cintura e coltello con il manico di corno */}
        <path d={`M${f(cx - 22)} 192 L${f(cx - 4)} 192 L${f(cx - 5)} 218 C${f(cx - 10)} 224 ${f(cx - 17)} 224 ${f(cx - 21)} 218 Z`} fill="#1a1614" stroke={OUT} strokeWidth="0.7" />
        <path d={`M${f(cx - 21)} 198 C${f(cx - 14)} 202 ${f(cx - 10)} 202 ${f(cx - 5)} 198`} stroke="#3a3430" strokeWidth="1.2" fill="none" />
        <circle cx={f(cx - 13)} cy="206" r="1.4" fill="#8a8078" />
        <g transform={`translate(${f(cx + 12)} 190) rotate(-14)`}>
          <path d="M-3 0 L3 0 L2.4 26 L0 32 L-2.4 26 Z" fill="#2a1a12" stroke={OUT} strokeWidth="0.5" />
          <path d="M-2.6 0 C-3.4 -6 -2 -12 0 -16 C2 -12 3.4 -6 2.6 0 Z" fill="#d8c8a2" stroke={OUT} strokeWidth="0.5" />
          <path d="M-1.6 -4 h3.2 M-1.8 -8 h3.6" stroke="#8a7a5a" strokeWidth="0.5" />
        </g>
      </g>
    );
  }
  if (layer === "over") {
    // stola di pelliccia rossa: copre spalle e petto, più lunga a sinistra di chi guarda
    const L = sh.l - 16;
    const R = sh.r + 16;
    const pts: Pt[] = [[L, 112], [L - 3, 140], [L + 4, 186], [L + 14, 178], [L + 21, 194], [cx - 16, 158], [cx - 6, 170], [cx + 4, 154], [cx + 14, 164], [R - 16, 144], [R - 9, 154], [R + 3, 128], [R, 110], [R - 9, 97], [sh.r - 6, 90], [cx + 10, 91], [cx, 98], [cx - 10, 91], [sh.l + 6, 90], [L + 9, 97]];
    return (
      <g pointerEvents="none">
        <FurMass pts={pts} color="#cc1a2c" seed={101} />
        <path d={`M${f(cx - 10)} 94 Q${f(cx)} 102 ${f(cx + 10)} 94`} stroke="#4a0610" strokeWidth="1" fill="none" />
      </g>
    );
  }
  return (
    <g pointerEvents="none">
      {/* pannello scozzese rosso sul kilt, a destra di chi guarda */}
      <defs>
        <pattern id="aa-tartan" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#b8142a" />
          <path d="M0 2 H8 M0 6 H8" stroke="#1a1a1a" strokeOpacity="0.55" strokeWidth="1.2" />
          <path d="M2 0 V8 M6 0 V8" stroke="#1a1a1a" strokeOpacity="0.45" strokeWidth="1.2" />
          <path d="M0 4 H8 M4 0 V8" stroke="#e8c84a" strokeOpacity="0.4" strokeWidth="0.4" />
        </pattern>
      </defs>
      <path d={`M${f(cx + 8)} 206 L${f(hip.r + 2)} 206 L${f(hip.r + 11)} 260 L${f(cx + 13)} 262 Z`} fill="url(#aa-tartan)" stroke={OUT} strokeOpacity="0.6" strokeWidth="0.6" />
      {[0.33, 0.66].map((k) => <path key={k} d={`M${f(cx + 8 + (hip.r - cx - 6) * k)} 206 L${f(cx + 13 + (hip.r - cx - 2) * k)} 262`} stroke="#000" strokeOpacity="0.25" strokeWidth="1" />)}
      {/* corno per bere appeso alla cintura */}
      <path d={`M${f(cx - 16)} 192 l-2 16 M${f(cx - 26)} 192 l-1 12`} stroke="#2a1a10" strokeWidth="1.2" />
      <path d={`M${f(cx - 30)} 204 C${f(cx - 30)} 222 ${f(cx - 24)} 238 ${f(cx - 14)} 246 C${f(cx - 18)} 236 ${f(cx - 20)} 222 ${f(cx - 16)} 206 Z`} fill="#e8dcc0" stroke={OUT} strokeWidth="0.6" />
      <path d={`M${f(cx - 30)} 204 L${f(cx - 16)} 206`} stroke="#5a3a1a" strokeWidth="2.4" />
      <path d={`M${f(cx - 24)} 232 C${f(cx - 20)} 238 ${f(cx - 17)} 242 ${f(cx - 14)} 246 C${f(cx - 18)} 242 ${f(cx - 22)} 236 ${f(cx - 24)} 232 Z`} fill="#5a3a1a" />
      <path d={`M${f(cx - 27)} 210 C${f(cx - 26)} 222 ${f(cx - 22)} 232 ${f(cx - 18)} 238`} stroke="#fff" strokeOpacity="0.4" strokeWidth="0.8" fill="none" />
    </g>
  );
}

/** gambali neri sfrangiati sotto il kilt (Victor) */
export function DemonFrontLeg({ look, L, legW }: { look: AvatarLook; L: (y: number, d: number) => string; legW: number }) {
  if (demonOf(look) !== "teschio") return null;
  const top = 266;
  const bottom = 332;
  const d = `M${L(top, -legW / 2 - 3)} ${top} L${L(top, legW / 2 + 3)} ${top} L${L(bottom, legW / 2 + 2)} ${bottom} L${L(bottom, -legW / 2 - 2)} ${bottom} Z`;
  return (
    <g pointerEvents="none">
      <path d={d} fill="#141212" stroke={OUT} strokeWidth="0.6" />
      {Array.from({ length: 22 }, (_, k) => {
        const y = top + (k % 11) * 6;
        const side = k < 11 ? -1 : 1;
        return <path key={k} d={`M${L(y, side * (legW / 2 + 2))} ${y} l${f(side * (2 + rnd(k) * 2.4))} ${f(3 + rnd(k + 9) * 3)}`} stroke="#2a2626" strokeWidth="1.3" strokeLinecap="round" />;
      })}
      {Array.from({ length: 10 }, (_, k) => <path key={k} d={`M${L(bottom - 2, -legW / 2 + k * (legW / 9))} ${bottom - 2} l${f(rnd(k + 3) * 2 - 1)} 5`} stroke="#2a2626" strokeWidth="1.2" strokeLinecap="round" />)}
      <path d={`M${L(top + 8, -legW / 2)} ${top + 8} L${L(bottom - 6, -legW / 2 + 2)} ${bottom - 6}`} stroke="#4a4444" strokeOpacity="0.5" strokeWidth="1" />
    </g>
  );
}

/** di profilo, sul busto: stola di pelliccia (Victor) o borsa e coltello (Simone) */
export function DemonSideTorso({ look, cx, shoulderL, shoulderR }: { look: AvatarLook; cx: number; shoulderL: number; shoulderR: number }) {
  const kind = demonOf(look);
  if (kind === "teschio") {
    const pts: Pt[] = [[shoulderL - 12, 126], [shoulderL - 13, 112], [cx - 8, 104], [cx + 6, 106], [shoulderR + 9, 110], [shoulderR + 13, 128], [shoulderR + 6, 152], [shoulderR - 2, 146], [cx + 4, 160], [cx - 6, 150], [shoulderL - 4, 162], [shoulderL - 11, 146]];
    return (
      <g pointerEvents="none">
        <FurMass pts={pts} color="#cc1a2c" seed={151} />
      </g>
    );
  }
  if (kind === "rosso") {
    return (
      <g pointerEvents="none">
        <path d={`M${f(cx + 6)} 192 L${f(cx + 20)} 192 L${f(cx + 19)} 214 C${f(cx + 15)} 219 ${f(cx + 10)} 219 ${f(cx + 7)} 214 Z`} fill="#1a1614" stroke={OUT} strokeWidth="0.7" />
        <g transform={`translate(${f(cx - 6)} 190) rotate(18)`}>
          <path d="M-2.4 0 L2.4 0 L2 22 L0 27 L-2 22 Z" fill="#2a1a12" stroke={OUT} strokeWidth="0.5" />
          <path d="M-2 0 C-2.8 -5 -1.6 -10 0 -13 C1.6 -10 2.8 -5 2 0 Z" fill="#d8c8a2" stroke={OUT} strokeWidth="0.5" />
        </g>
      </g>
    );
  }
  return null;
}

/** gambali di profilo tra ginocchio e caviglia (Victor) */
export function DemonSideLeg({ look, knee, ankle, w }: { look: AvatarLook; knee: { x: number; y: number }; ankle: { x: number; y: number }; w: number }) {
  if (demonOf(look) !== "teschio") return null;
  const a = { x: knee.x + (ankle.x - knee.x) * 0.12, y: knee.y + (ankle.y - knee.y) * 0.12 };
  const b = { x: ankle.x, y: ankle.y - 2 };
  return (
    <g pointerEvents="none">
      <path d={`M${f(a.x)} ${f(a.y)} L${f(b.x)} ${f(b.y)}`} stroke="#141212" strokeWidth={f(w + 3)} strokeLinecap="round" />
      {Array.from({ length: 12 }, (_, k) => {
        const t = k / 11;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        return <path key={k} d={`M${f(x + (k % 2 ? w / 2 : -w / 2))} ${f(y)} l${f((k % 2 ? 1 : -1) * (2 + rnd(k) * 2))} ${f(3 + rnd(k + 4) * 2)}`} stroke="#2a2626" strokeWidth="1.2" strokeLinecap="round" />;
      })}
    </g>
  );
}

/** artigli d'oro sulle dita del pugno (mani del costume rosso) */
export function Claws({ r }: { r: number }) {
  return (
    <g fill="#e8c24a" stroke="#6a4a10" strokeWidth={f(0.04 * r)}>
      {[0, 1, 2, 3].map((k) => {
        const y = -0.74 * r + k * 0.49 * r;
        const x = 0.94 * r - (k === 3 ? 0.12 * r : k === 0 ? 0.04 * r : 0);
        return <path key={k} d={`M${f(x - 0.06 * r)} ${f(y + 0.05 * r)} C${f(x + 0.34 * r)} ${f(y + 0.1 * r)} ${f(x + 0.44 * r)} ${f(y + 0.36 * r)} ${f(x + 0.36 * r)} ${f(y + 0.62 * r)} C${f(x + 0.26 * r)} ${f(y + 0.4 * r)} ${f(x + 0.12 * r)} ${f(y + 0.3 * r)} ${f(x - 0.04 * r)} ${f(y + 0.28 * r)} Z`} />;
      })}
    </g>
  );
}
