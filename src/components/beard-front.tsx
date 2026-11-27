/**
 * Barba e baffi dipinti, di fronte: una base dai bordi sfumati (sulle guance la barba si dirada nella pelle)
 * e tante ciocche sottili che scendono verso il mento, in tre toni (ombra, colore, riflesso dal lato della luce),
 * con qualche pelo che esce dal bordo. Al posto della sagoma piena con le punte a sega.
 */

type XY = [number, number];

const f = (n: number) => n.toFixed(2);

function mixHex(a: string, b: string, t: number) {
  const ma = /^#?([0-9a-f]{6})$/i.exec((a || "").trim());
  const mb = /^#?([0-9a-f]{6})$/i.exec((b || "").trim());
  if (!ma || !mb) return a;
  const na = Number.parseInt(ma[1], 16);
  const nb = Number.parseInt(mb[1], 16);
  const ch = (sh: number) => Math.round(((na >> sh) & 255) * (1 - t) + ((nb >> sh) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

function hash(n: number) {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function strands(opts: { box: [number, number, number, number]; n: number; seed: number; chinX: number; len: number; converge: number; lit: number }) {
  const [bx, by, bw, bh] = opts.box;
  const dark: string[] = [];
  const mid: string[] = [];
  const light: string[] = [];
  for (let i = 0; i < opts.n; i++) {
    const x = bx + hash(i * 3.1 + opts.seed) * bw;
    const y = by + hash(i * 7.3 + opts.seed * 11) * bh;
    const L = (3.2 + hash(i * 17.7 + opts.seed) * 2.8) * opts.len;
    // la barba scende e converge piano verso il mento; un filo di ondulazione per ogni ciocca
    const tx = (opts.chinX - x) * opts.converge + (hash(i * 13.3) - 0.5) * 0.5;
    const ex = x + tx * L * 0.4;
    const ey = y + L;
    const wob = (hash(i * 19.9 + opts.seed) - 0.5) * 1.1;
    const path = `M${f(x)} ${f(y)} Q${f((x + ex) / 2 + wob)} ${f((y + ey) / 2)} ${f(ex)} ${f(ey)}`;
    const h = hash(i * 23.1 + opts.seed * 3);
    // i riflessi stanno soprattutto dal lato della luce (sinistra di chi guarda) e in alto
    const litSide = x < opts.chinX ? opts.lit : opts.lit * 0.35;
    if (h < litSide) light.push(path);
    else if (h < 0.55) dark.push(path);
    else mid.push(path);
  }
  return { dark: dark.join(""), mid: mid.join(""), light: light.join("") };
}

/** peli che escono dal bordo, verso l'esterno rispetto al centro `c` e un poco in giù */
function wisps(edge: XY[], c: XY, len: number, seed: number) {
  const out: string[] = [];
  edge.forEach(([x, y], i) => {
    for (let k = 0; k < 1; k++) {
      const j = i * 2 + k;
      let dx = x - c[0];
      let dy = y - c[1];
      const m = Math.hypot(dx, dy) || 1;
      dx /= m;
      dy = dy / m + 0.35;
      const L = len * (0.7 + hash(j * 5.7 + seed) * 0.8);
      const sx = x - dx * 1.4 + (hash(j * 3.3) - 0.5) * 1.2;
      const sy = y - dy * 1.4;
      const ex = sx + dx * L;
      const ey = sy + dy * L;
      const bend = (hash(j * 9.1 + seed) - 0.5) * 1.4;
      out.push(`M${f(sx)} ${f(sy)} Q${f((sx + ex) / 2 + bend)} ${f((sy + ey) / 2)} ${f(ex)} ${f(ey)}`);
    }
  });
  return out;
}

export function PaintedBeard({ uid, id, d, color, dark, light, box, edge, c, chinX = 50, len = 1, feather = 1.1, lipY }: {
  uid: string;
  id: string;
  /** sagoma della barba */
  d: string;
  color: string;
  dark: string;
  light: string;
  /** area dei peli: x, y, larghezza, altezza */
  box: [number, number, number, number];
  /** punti del bordo basso (mento, mascella) da cui escono i peli */
  edge: XY[];
  /** centro verso cui si allarga il bordo */
  c: XY;
  chinX?: number;
  len?: number;
  feather?: number;
  /** sotto il labbro: ombra morbida */
  lipY?: number;
}) {
  const [bx, by, bw, bh] = box;
  const n = Math.max(40, Math.min(460, Math.round(bw * bh * 0.16)));
  const big = strands({ box, n, seed: 3, chinX, len, converge: 0.08, lit: 0.16 });
  const fine = strands({ box, n: Math.round(n * 0.8), seed: 29, chinX, len: len * 0.8, converge: 0.07, lit: 0.12 });
  const tips = wisps(edge, c, 1.6 * len, 7);
  const mid = color;
  const midHi = mixHex(color, light, 0.25);
  return (
    <g pointerEvents="none">
      <defs>
        <filter id={`${uid}${id}fb`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={feather} /></filter>
        <filter id={`${uid}${id}fs`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={feather * 0.45} /></filter>
        <mask id={`${uid}${id}m`} maskUnits="userSpaceOnUse" x={bx - 12} y={by - 12} width={bw + 24} height={bh + 24}><path d={d} fill="#fff" filter={`url(#${uid}${id}fb)`} /></mask>
        <mask id={`${uid}${id}ms`} maskUnits="userSpaceOnUse" x={bx - 12} y={by - 12} width={bw + 24} height={bh + 24}><path d={d} fill="#fff" filter={`url(#${uid}${id}fs)`} /></mask>
        <linearGradient id={`${uid}${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.38" />
        </linearGradient>
        <linearGradient id={`${uid}${id}l`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.07" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      {/* base morbida: sulle guance sfuma nella pelle, sotto il mento resta piena */}
      <g mask={`url(#${uid}${id}m)`}>
        <path d={d} fill={mid} />
        <rect x={bx - 4} y={by - 4} width={bw + 8} height={bh + 8} fill={`url(#${uid}${id}g)`} />
        <rect x={bx - 4} y={by - 4} width={bw + 8} height={bh + 8} fill={`url(#${uid}${id}l)`} />
        {lipY != null ? <ellipse cx={chinX} cy={lipY + 2.5} rx={bw * 0.16} ry="2.4" fill="#000" opacity="0.3" filter={`url(#${uid}${id}fb)`} /> : null}
      </g>
      {/* ciocche: prima le grandi, poi le fini; ombra, colore e riflessi */}
      <g mask={`url(#${uid}${id}ms)`} fill="none" strokeLinecap="round">
        <path d={big.dark} stroke={dark} strokeWidth="0.5" strokeOpacity="0.5" />
        <path d={big.mid} stroke={midHi} strokeWidth="0.42" strokeOpacity="0.7" />
        <path d={big.light} stroke={light} strokeWidth="0.3" strokeOpacity="0.42" />
        <path d={fine.dark} stroke={dark} strokeWidth="0.26" strokeOpacity="0.45" />
        <path d={fine.mid} stroke={midHi} strokeWidth="0.22" strokeOpacity="0.6" />
        <path d={fine.light} stroke={light} strokeWidth="0.18" strokeOpacity="0.4" />
      </g>
      {/* i peli che escono dal bordo, al posto delle punte a sega */}
      <g fill="none" strokeLinecap="round">
        <path d={tips.filter((_, k) => k % 2).join("")} stroke={dark} strokeWidth="0.34" strokeOpacity="0.7" />
        <path d={tips.filter((_, k) => k % 2 === 0).join("")} stroke={mid} strokeWidth="0.3" strokeOpacity="0.75" />
      </g>
    </g>
  );
}

/** baffi dipinti: base sfumata e peli che partono dal centro del labbro e scendono verso i lati */
export function PaintedStache({ uid, id, d, color, dark, light, fy, spread = 1 }: { uid: string; id: string; d: string; color: string; dark: string; light: string; fy: number; spread?: number }) {
  const rows: { d: string; tone: 0 | 1 | 2 }[] = [];
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 26; k++) {
      const t = k / 25;
      const h = hash(k * 7.1 + (sd > 0 ? 50 : 0));
      const sx = 50 + sd * (0.4 + t * 9.6 * spread);
      const sy = fy + 7 + t * 1.4 + (h - 0.5) * 1.2;
      const ex = sx + sd * (1 + h * 1.6);
      const ey = sy + 3.2 + h * 1.2;
      const tone: 0 | 1 | 2 = h < (sd < 0 ? 0.3 : 0.12) ? 2 : h < 0.62 ? 0 : 1;
      rows.push({ d: `M${f(sx)} ${f(sy)} Q${f(sx + sd * 0.4)} ${f((sy + ey) / 2)} ${f(ex)} ${f(ey)}`, tone });
    }
  }
  const join = (tone: number) => rows.filter((r) => r.tone === tone).map((r) => r.d).join("");
  return (
    <g pointerEvents="none">
      <defs>
        <filter id={`${uid}${id}fb`} x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="0.45" /></filter>
        <mask id={`${uid}${id}m`} maskUnits="userSpaceOnUse" x="30" y={fy} width="40" height="22"><path d={d} fill="#fff" filter={`url(#${uid}${id}fb)`} /></mask>
        <linearGradient id={`${uid}${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.3" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <g mask={`url(#${uid}${id}m)`}>
        <path d={d} fill={color} />
        <rect x="30" y={fy + 3} width="40" height="14" fill={`url(#${uid}${id}g)`} />
        <g fill="none" strokeLinecap="round">
          <path d={join(0)} stroke={dark} strokeWidth="0.32" strokeOpacity="0.8" />
          <path d={join(1)} stroke={color} strokeWidth="0.3" strokeOpacity="0.9" />
          <path d={join(2)} stroke={light} strokeWidth="0.24" strokeOpacity="0.65" />
        </g>
      </g>
    </g>
  );
}
