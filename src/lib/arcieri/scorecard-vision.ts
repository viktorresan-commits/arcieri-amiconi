/**
 * Lettura nel telefono del cartellino di gara 3D scritto a mano (modulo FITAST: per ogni arciere le colonne
 * P, T1, T2, T3, TOT, PROG, S e 20 righe). Niente servizi esterni: l'arciere mette i quattro angoli sulla
 * sua colonna, la foto si raddrizza, le righe del modulo si ritrovano, e ogni casella T1..T3 diventa
 * 8 (vitale), 5 (corpo) o 0 («/», «0» o vuota), con quanto se ne è sicuri.
 * Poi il totale del portale FITAST, se c'è, fa scegliere la lettura più probabile che lo rispetta.
 */
export type V2 = [number, number];
/** angoli nell'ordine: in alto a sinistra, in alto a destra, in basso a destra, in basso a sinistra */
export type Quad = [V2, V2, V2, V2];
/** scuro 0..1 (1 = inchiostro) */
export type Gray = { w: number; h: number; d: Float32Array };
export type ArrowValue = 0 | 5 | 8;
export const VALUES: ArrowValue[] = [0, 5, 8];
export type CellRead = { v: ArrowValue; p: [number, number, number]; ink: number };
export type BlockRead = { rows: CellRead[][]; xs: number[]; ys: number[]; rect: Gray };

/** confini delle colonne P | T1 | T2 | T3 | TOT | PROG | S del modulo (frazioni della larghezza) */
export const COLS = [0, 0.107, 0.235, 0.363, 0.494, 0.662, 0.896, 1];
export const ROWS = 20;

export function toGray(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Gray {
  const d = new Float32Array(w * h);
  for (let i = 0, j = 0; i < d.length; i++, j += 4) {
    // l'inchiostro blu è scuro quanto il nero se si guarda il canale più scuro (rosso e verde)
    const lum = 0.36 * rgba[j] + 0.5 * rgba[j + 1] + 0.14 * rgba[j + 2];
    d[i] = 1 - lum / 255;
  }
  return { w, h, d };
}

/** matrice 3x3 che porta il quadrato unitario (0,0)(1,0)(1,1)(0,1) sul quadrilatero */
function squareToQuad(q: Quad): number[] {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
  }
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

/** punto del quadrilatero per le coordinate (u, v) 0..1 della colonna raddrizzata */
export function quadPoint(q: Quad, u: number, v: number): V2 {
  const m = squareToQuad(q);
  const z = m[6] * u + m[7] * v + m[8];
  return [(m[0] * u + m[1] * v + m[2]) / z, (m[3] * u + m[4] * v + m[5]) / z];
}

/** la colonna dell'arciere raddrizzata (W x H), con lo sfondo pareggiato (ombre e carta non uniformi) */
export function warp(g: Gray, q: Quad, W: number, H: number): Gray {
  const m = squareToQuad(q);
  const d = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const z = m[6] * u + m[7] * v + m[8];
      const px = (m[0] * u + m[1] * v + m[2]) / z - 0.5;
      const py = (m[3] * u + m[4] * v + m[5]) / z - 0.5;
      const ix = Math.floor(px), iy = Math.floor(py);
      if (ix < 0 || iy < 0 || ix >= g.w - 1 || iy >= g.h - 1) continue;
      const fx = px - ix, fy = py - iy;
      const o = iy * g.w + ix;
      d[y * W + x] = (g.d[o] * (1 - fx) + g.d[o + 1] * fx) * (1 - fy) + (g.d[o + g.w] * (1 - fx) + g.d[o + g.w + 1] * fx) * fy;
    }
  }
  return flatten({ w: W, h: H, d });
}

/** toglie il fondo: ogni punto meno il fondo carta del suo intorno (il 30° percentile dei più chiari) */
function flatten(g: Gray): Gray {
  const { w, h, d } = g;
  const R = Math.max(6, Math.round(Math.min(w, h) / 40));
  // fondo: minimo dello scuro su finestre grandi, poi sfocato (veloce: per blocchi)
  const bw = Math.ceil(w / R), bh = Math.ceil(h / R);
  const bg = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      const vals: number[] = [];
      for (let y = by * R; y < Math.min(h, (by + 1) * R); y += 2) for (let x = bx * R; x < Math.min(w, (bx + 1) * R); x += 2) vals.push(d[y * w + x]);
      vals.sort((a, b) => a - b);
      bg[by * bw + bx] = vals.length ? vals[Math.floor(vals.length * 0.3)] : 0;
    }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const fx = Math.min(bw - 1.001, Math.max(0, x / R - 0.5)), fy = Math.min(bh - 1.001, Math.max(0, y / R - 0.5));
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const ax = fx - ix, ay = fy - iy;
      const b = (bg[iy * bw + ix] * (1 - ax) + bg[iy * bw + Math.min(bw - 1, ix + 1)] * ax) * (1 - ay) + (bg[Math.min(bh - 1, iy + 1) * bw + ix] * (1 - ax) + bg[Math.min(bh - 1, iy + 1) * bw + Math.min(bw - 1, ix + 1)] * ax) * ay;
      out[y * w + x] = Math.max(0, Math.min(1, (d[y * w + x] - b) / Math.max(0.25, 1 - b)));
    }
  return { w, h, d: out };
}

/** righe e colonne del modulo nella foto raddrizzata: le linee stampate attraversano tutte le righe */
export function gridLines(r: Gray): { xs: number[]; ys: number[] } {
  const { w, h, d } = r;
  const colP = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = 0; y < h; y++) s += d[y * w + x] > 0.35 ? 1 : 0;
    colP[x] = s / h;
  }
  const near = (prof: Float32Array, at: number, rad: number) => {
    let best = at, bv = -1;
    for (let x = Math.max(0, Math.round(at - rad)); x <= Math.min(prof.length - 1, Math.round(at + rad)); x++) {
      // vicino a dove se l'aspetta, a parità di forza
      const v = prof[x] - Math.abs(x - at) / (rad * 8);
      if (v > bv) { bv = v; best = x; }
    }
    return best;
  };
  const xs = COLS.map((f, i) => (i === 0 || i === COLS.length - 1 ? f * w : near(colP, f * w, w * 0.035)));
  // righe: profilo solo sulle colonne T1..T3 e TOT (P e PROG hanno numeri più lunghi)
  const x0 = Math.round(xs[1]), x1 = Math.round(xs[5]);
  const rowP = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = x0; x < x1; x++) s += d[y * w + x] > 0.35 ? 1 : 0;
    rowP[y] = s / Math.max(1, x1 - x0);
  }
  const step = h / ROWS;
  const ys: number[] = [0];
  for (let i = 1; i < ROWS; i++) ys.push(near(rowP, i * step, step * 0.28));
  ys.push(h);
  return { xs, ys };
}

type Mask = { w: number; h: number; m: Uint8Array };

/**
 * Inchiostro della casella. Le cifre scritte grandi escono dalla casella: si guarda una finestra più larga,
 * si tolgono le linee del modulo sui bordi e si tengono solo i tratti che stanno soprattutto dentro la casella
 * (quelli delle caselle vicine restano fuori).
 */
function cellInk(r: Gray, x0: number, y0: number, x1: number, y1: number): Mask & { cx0: number; cy0: number; cx1: number; cy1: number } {
  const cw = x1 - x0, ch = y1 - y0;
  const ax = Math.max(0, Math.round(x0 - cw * 0.22)), bx = Math.min(r.w, Math.round(x1 + cw * 0.22));
  const ay = Math.max(0, Math.round(y0 - ch * 0.3)), by = Math.min(r.h, Math.round(y1 + ch * 0.3));
  const w = Math.max(1, bx - ax), h = Math.max(1, by - ay);
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = r.d[(ay + y) * r.w + ax + x] > 0.33 ? 1 : 0;
  // linee del modulo: bande sottili sui bordi della casella, dove quasi tutta la riga (o colonna) è scura
  const band = Math.max(2, Math.round(Math.min(cw, ch) * 0.07));
  for (const ly of [y0, y1]) {
    for (let y = Math.round(ly - band - ay); y <= Math.round(ly + band - ay); y++) {
      if (y < 0 || y >= h) continue;
      let sum = 0;
      for (let x = 0; x < w; x++) sum += m[y * w + x];
      if (sum > w * 0.55) for (let x = 0; x < w; x++) m[y * w + x] = 0;
    }
  }
  for (const lx of [x0, x1]) {
    for (let x = Math.round(lx - band - ax); x <= Math.round(lx + band - ax); x++) {
      if (x < 0 || x >= w) continue;
      let sum = 0;
      for (let y = 0; y < h; y++) sum += m[y * w + x];
      if (sum > h * 0.55) for (let y = 0; y < h; y++) m[y * w + x] = 0;
    }
  }
  const cx0 = x0 - ax, cy0 = y0 - ay, cx1 = x1 - ax, cy1 = y1 - ay;
  // componenti: si tengono quelle con la maggior parte dei punti dentro la casella
  const lab = new Int32Array(w * h).fill(-1);
  const keep: boolean[] = [];
  const stack: number[] = [];
  let big = 0;
  const sizes: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || lab[i] >= 0) continue;
    const id = keep.length;
    let n = 0, inside = 0;
    stack.push(i);
    lab[i] = id;
    while (stack.length) {
      const p = stack.pop()!;
      const px = p % w, py = (p - px) / w;
      n++;
      if (px >= cx0 && px <= cx1 && py >= cy0 && py <= cy1) inside++;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const qx = px + dx, qy = py + dy;
          if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
          const q = qy * w + qx;
          if (m[q] && lab[q] < 0) { lab[q] = id; stack.push(q); }
        }
    }
    keep.push(inside / n > 0.5);
    sizes.push(inside);
    if (inside / n > 0.5) big = Math.max(big, n);
  }
  for (let i = 0; i < w * h; i++) if (m[i] && (!keep[lab[i]] || sizes[lab[i]] < Math.max(6, big * 0.1))) m[i] = 0;
  return { w, h, m, cx0, cy0, cx1, cy1 };
}

/** buchi chiusi dall'inchiostro (anelli dell'8 e dello 0): area e altezza, rispetto all'ingombro */
function holes(k: Mask, bb: { x0: number; y0: number; x1: number; y1: number }) {
  const { w, m } = k;
  const W = bb.x1 - bb.x0 + 3, H = bb.y1 - bb.y0 + 3;
  const bgm = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = bb.x0 + x - 1, sy = bb.y0 + y - 1;
      const inside = sx >= bb.x0 && sx <= bb.x1 && sy >= bb.y0 && sy <= bb.y1;
      bgm[y * W + x] = inside && m[sy * w + sx] ? 0 : 1;
    }
  const lab = new Int32Array(W * H).fill(-1);
  const out: { area: number; cy: number }[] = [];
  const stack: number[] = [];
  let id = 0;
  for (let i = 0; i < W * H; i++) {
    if (!bgm[i] || lab[i] >= 0) continue;
    let n = 0, sy = 0, touches = false;
    stack.push(i);
    lab[i] = id;
    while (stack.length) {
      const p = stack.pop()!;
      const px = p % W, py = (p - px) / W;
      n++;
      sy += py;
      if (px === 0 || py === 0 || px === W - 1 || py === H - 1) touches = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const qx = px + dx, qy = py + dy;
        if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
        const q = qy * W + qx;
        if (bgm[q] && lab[q] < 0) { lab[q] = id; stack.push(q); }
      }
    }
    if (!touches) out.push({ area: n / ((W - 2) * (H - 2)), cy: (sy / n - 1) / Math.max(1, H - 3) });
    id++;
  }
  return out.filter((x) => x.area > 0.015);
}

/** misure di una casella per il classificatore (null = vuota) */
export function cellFeatures(r: Gray, x0: number, y0: number, x1: number, y1: number): { ink: number; f: number[] | null } {
  const k = cellInk(r, x0, y0, x1, y1);
  const { w, h, m } = k;
  let n = 0, sx = 0, sy = 0;
  let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (m[y * w + x]) {
        n++; sx += x; sy += y;
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
      }
  const cellW = k.cx1 - k.cx0, cellH = k.cy1 - k.cy0;
  const ink = n / Math.max(1, cellW * cellH);
  if (ink < 0.015 || bx1 < 0) return { ink, f: null };
  const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
  const mx = sx / n, my = sy / n;
  let cxx = 0, cyy = 0, cxy = 0;
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (m[y * w + x]) { cxx += (x - mx) ** 2; cyy += (y - my) ** 2; cxy += (x - mx) * (y - my); }
  cxx /= n; cyy /= n; cxy /= n;
  const tr = cxx + cyy, det = cxx * cyy - cxy * cxy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det)), l2 = Math.max(1e-6, tr / 2 - Math.sqrt(Math.max(0, (tr * tr) / 4 - det)));
  const elong = Math.min(8, Math.sqrt(l1 / l2));
  // inclinazione dell'asse principale: «/» sale verso destra
  const slant = l1 > l2 * 1.5 ? (cxy < 0 ? 1 : -1) * Math.min(1, Math.abs(cxy) / Math.sqrt(cxx * cyy + 1e-9)) : 0;
  const fill = n / (bw * bh);
  const band = (t0: number, t1: number) => {
    let rows = 0, runs = 0, both = 0;
    for (let y = by0; y <= by1; y++) {
      const t = (y - by0) / bh;
      if (t < t0 || t > t1) continue;
      let c = 0, prev = 0, left = 0, right = 0;
      for (let x = bx0; x <= bx1; x++) {
        const v = m[y * w + x];
        if (v && !prev) c++;
        prev = v;
        if (v && x < bx0 + bw * 0.36) left = 1;
        if (v && x > bx1 - bw * 0.36) right = 1;
      }
      if (!c) continue;
      rows++;
      runs += c;
      both += left && right && c >= 2 ? 1 : 0;
    }
    return [Math.min(3, runs / Math.max(1, rows)) / 2, both / Math.max(1, rows)];
  };
  const hs = holes(k, { x0: bx0, y0: by0, x1: bx1, y1: by1 });
  const hMax = hs.reduce((a, x) => (x.area > a.area ? x : a), { area: 0, cy: 0.5 });
  // immagine 10x10 della cifra, nel suo quadrato (proporzioni tenute)
  const G = 10;
  const side = Math.max(bw, bh);
  const ox = bx0 - (side - bw) / 2, oy = by0 - (side - bh) / 2;
  const img = new Array(G * G).fill(0);
  for (let y = by0; y <= by1; y++)
    for (let x = bx0; x <= bx1; x++)
      if (m[y * w + x]) {
        const gx = Math.min(G - 1, Math.floor(((x - ox) / side) * G)), gy = Math.min(G - 1, Math.floor(((y - oy) / side) * G));
        img[gy * G + gx] += 1;
      }
  const cellPx = (side / G) ** 2;
  for (let i = 0; i < img.length; i++) img[i] = Math.min(1, img[i] / cellPx);
  const f = [
    ...img,
    elong / 4, slant, fill, Math.min(2, hs.length) / 2, hMax.area, hMax.cy,
    ...band(0.16, 0.42), ...band(0.43, 0.57), ...band(0.58, 0.84),
    Math.min(3, bw / bh) / 2, Math.min(1, bh / cellH), Math.min(1, bw / cellW), Math.min(0.6, ink) * 2,
  ];
  return { ink, f };
}

/** una casella: 8, 5 o 0, con le probabilità (somma 1) */
export function readCell(r: Gray, x0: number, y0: number, x1: number, y1: number): CellRead {
  const { ink, f } = cellFeatures(r, x0, y0, x1, y1);
  if (!f) return { v: 0, p: [0.96, 0.02, 0.02], ink };
  const p = classify(f);
  const best = p[0] >= p[1] && p[0] >= p[2] ? 0 : p[1] >= p[2] ? 1 : 2;
  return { v: VALUES[best], p, ink };
}

/** regressione logistica a tre classi (0, 5, 8) addestrata su cartellini veri */
export function classify(f: number[], W: number[][] = WEIGHTS): [number, number, number] {
  const z = W.map((row) => row.reduce((s, wv, i) => s + wv * (i < f.length ? f[i] : 1), 0));
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const t = e[0] + e[1] + e[2];
  return [e[0] / t, e[1] / t, e[2] / t];
}

// pesi (classe 0, 5, 8; l'ultimo è il termine costante), da 5 colonne di cartellini veri trascritti a mano
// (due scritture diverse, «/» e «0» per le frecce fuori): vedi scripts/cartellini/addestra.ts
export let WEIGHTS: number[][] = [[0.0939,0.054,-0.0344,-0.1193,-0.1653,-0.1626,-0.2376,-0.1628,0.0477,0.0287,-0.01,-0.0905,-0.1887,-0.2367,-0.2067,-0.272,-0.1729,-0.1549,-0.0686,-0.1414,-0.0202,-0.172,-0.3008,-0.2406,-0.2628,-0.2404,-0.1556,-0.0661,-0.0054,-0.1026,-0.1973,-0.2648,-0.2302,-0.266,-0.2109,-0.2038,-0.098,-0.0137,0.2362,0.2149,-0.1339,-0.1971,-0.1873,-0.2916,-0.1891,-0.1065,-0.0873,-0.0983,0.066,0.2151,0.1528,0.0042,-0.1586,-0.1316,-0.1474,-0.1915,-0.2031,-0.2448,-0.043,-0.0587,0.4084,0.2392,0.0177,0.0085,-0.2551,-0.096,-0.1942,-0.1857,-0.1295,-0.2203,0.064,0.3033,0.0728,-0.1093,-0.1907,-0.2897,-0.2629,-0.1494,-0.1642,-0.2303,-0.0427,0.1119,-0.0053,-0.003,-0.185,-0.355,-0.2008,-0.1677,-0.1454,-0.099,0.0872,0.0675,-0.0793,-0.1083,-0.1854,-0.1605,-0.0869,-0.0757,-0.0447,-0.0258,0.4622,0.3232,-0.1606,-0.467,-0.0408,-0.0682,-0.262,-0.1722,-0.0372,0.0612,-0.3269,-0.0747,-0.0025,-0.1744,-0.1129,-0.3234,2.5009],[-0.0647,-0.0444,-0.004,0.1346,0.1505,0.1424,0.0744,0.0178,0.1135,0.1217,-0.0944,-0.1189,0.0477,0.148,0.1453,0.2844,0.1163,-0.1107,0.0655,0.2348,0.1232,0.1331,0.3415,0.2359,0.1194,0.2132,-0.0065,-0.121,-0.0586,0.2235,0.1871,0.3274,0.3529,0.2075,0.2213,0.0986,-0.0552,-0.1801,-0.3352,-0.0997,0.2096,0.2312,0.1658,0.2653,0.0909,-0.0781,-0.1158,-0.1317,-0.2119,-0.117,-0.1746,-0.1582,0.042,-0.0065,0.0097,0.0013,0.0384,0.2798,0.0872,0.0776,-0.4633,-0.4285,-0.3421,-0.2521,0.0569,0.0453,0.2242,0.3382,0.2156,0.1794,-0.0361,-0.1513,-0.1437,0.0451,0.0639,0.3598,0.3551,0.3014,0.1656,0.2635,0.1616,-0.0056,-0.0806,-0.0421,-0.0401,0.1458,0.1019,0.1176,0.0294,0.0644,0.012,-0.0005,0.0051,-0.0041,-0.048,-0.1371,-0.1036,-0.01,-0.0265,-0.019,-0.2913,-0.2624,0.0475,-0.772,-0.0676,-0.1802,-0.3491,0.0575,-0.2416,-0.0718,-0.2191,-0.1313,0.1443,0.0366,0.1958,0.1728,0.2598],[-0.0292,-0.0096,0.0385,-0.0154,0.0148,0.0202,0.1632,0.145,-0.1611,-0.1504,0.1044,0.2094,0.141,0.0888,0.0613,-0.0124,0.0566,0.2655,0.0031,-0.0933,-0.1029,0.0389,-0.0407,0.0047,0.1434,0.0273,0.1621,0.1871,0.064,-0.1209,0.0101,-0.0626,-0.1227,0.0585,-0.0104,0.1053,0.1532,0.1938,0.0991,-0.1152,-0.0757,-0.0341,0.0214,0.0262,0.0982,0.1846,0.2031,0.23,0.1459,-0.0981,0.0218,0.154,0.1165,0.1381,0.1378,0.1902,0.1647,-0.035,-0.0442,-0.0189,0.0548,0.1893,0.3244,0.2436,0.1982,0.0507,-0.0299,-0.1525,-0.086,0.0409,-0.0279,-0.152,0.071,0.0642,0.1268,-0.0701,-0.0922,-0.152,-0.0014,-0.0332,-0.1189,-0.1063,0.0858,0.045,0.225,0.2093,0.0989,0.0501,0.116,0.0345,-0.0992,-0.0669,0.0742,0.1124,0.2334,0.2975,0.1905,0.0858,0.0712,0.0448,-0.1709,-0.0608,0.1131,1.2389,0.1084,0.2484,0.6111,0.1147,0.2788,0.0106,0.546,0.206,-0.1418,0.1378,-0.0829,0.1507,-2.7606]];
export function setWeights(w: number[][]) {
  WEIGHTS = w;
}

/** legge la colonna di un arciere: 20 righe x T1..T3 */
export function readBlock(g: Gray, q: Quad): BlockRead {
  // risoluzione della colonna raddrizzata: circa 60 punti per casella T
  const W = 480, H = 20 * 46;
  const rect = warp(g, q, W, H);
  const { xs, ys } = gridLines(rect);
  const rows: CellRead[][] = [];
  for (let i = 0; i < ROWS; i++) {
    const cells: CellRead[] = [];
    for (let c = 1; c <= 3; c++) cells.push(readCell(rect, xs[c], ys[i], xs[c + 1], ys[i + 1]));
    rows.push(cells);
  }
  return { rows, xs, ys, rect };
}

/**
 * La lettura più probabile che dà proprio quel totale (dal portale FITAST): si sceglie una casella alla
 * volta tenendo la somma, e vince la combinazione con la probabilità più alta. null se impossibile.
 */
export function fitTotal(rows: CellRead[][], total: number): ArrowValue[][] | null {
  const cells = rows.flat();
  const maxT = cells.length * 8;
  if (total < 0 || total > maxT || total % 1) return null;
  const NEG = -1e9;
  // best[s] = log-probabilità migliore per somma s; scelte per ricostruire
  let best = new Float64Array(maxT + 1).fill(NEG);
  best[0] = 0;
  const choice: Int8Array[] = [];
  for (const c of cells) {
    const next = new Float64Array(maxT + 1).fill(NEG);
    const ch = new Int8Array(maxT + 1).fill(-1);
    for (let s = 0; s <= maxT; s++) {
      if (best[s] <= NEG / 2) continue;
      for (let k = 0; k < 3; k++) {
        const t = s + VALUES[k];
        if (t > maxT) continue;
        const v = best[s] + Math.log(Math.max(1e-4, c.p[k]));
        if (v > next[t]) { next[t] = v; ch[t] = k; }
      }
    }
    choice.push(ch);
    best = next;
  }
  if (best[total] <= NEG / 2) return null;
  const vals: ArrowValue[] = new Array(cells.length);
  let s = total;
  for (let i = cells.length - 1; i >= 0; i--) {
    const k = choice[i][s];
    if (k < 0) return null;
    vals[i] = VALUES[k];
    s -= VALUES[k];
  }
  const out: ArrowValue[][] = [];
  for (let i = 0; i < rows.length; i++) out.push(vals.slice(i * 3, i * 3 + 3));
  return out;
}

/** ordine delle piazzole partendo da quella del gruppo: 11, 12, … 20, 1, … 10 */
export function laneOrder(start: number, n = ROWS) {
  const s = Math.max(1, Math.min(n, Math.round(start) || 1));
  return Array.from({ length: n }, (_, i) => ((s - 1 + i) % n) + 1);
}
