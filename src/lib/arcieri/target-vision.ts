/**
 * Lettura del bersaglio da foto e video, tutta nel telefono.
 *
 * Idee prese da Target-Score-Detector (Niv-Kor) e Miraglio (oraziog), riscritte per il browser:
 * 1. trovo la faccia dai colori (oro + rosso + blu) e ne misuro l'ellisse: la prospettiva di una
 *    foto storta diventa un'ellisse, che raddrizzo in un cerchio (oppure 4 tocchi = omografia);
 * 2. nel bersaglio raddrizzato ogni anello ha un suo colore: quello che si discosta dal colore
 *    del suo anello è una freccia, un buco o un'ombra;
 * 3. le aste sono macchie allungate: le loro rette convergono nel punto della faccia davanti
 *    alla fotocamera, quindi l'estremo più vicino a quel punto è dove la freccia è entrata;
 * 4. il gruppo si misura con il diametro (i due colpi più lontani) e l'inviluppo convesso;
 * 5. con la dimensione nota della faccia, il modello a foro stenopeico stima la distanza.
 */

import { scoreAtRadius, type Face } from "./scoring";

export type Mat2 = [number, number, number, number];
export type Homography = number[]; // 3x3 per righe

export type Calib =
  | { kind: "ellisse"; cx: number; cy: number; m: Mat2; inv: Mat2; ax: number; bx: number; angle: number }
  | { kind: "omografia"; h: Homography; hinv: Homography }
  /** affine + centro che scivola con il raggio: gli anelli concentrici in prospettiva hanno centri diversi */
  | { kind: "anelli"; c0x: number; c0y: number; kx: number; ky: number; M: Mat2; Minv: Mat2 };

export type VisionHit = {
  nx: number;
  ny: number;
  score: number;
  isX: boolean;
  miss: boolean;
  /** posizione nella foto, 0..1 */
  px: number;
  py: number;
  kind: "asta" | "foro";
  /** se asta: l'altro capo (cocca) nella foto */
  tailPx?: number;
  tailPy?: number;
  confidence: number;
};

export type Group = {
  n: number;
  cx: number;
  cy: number;
  diameter: number;
  hull: { x: number; y: number }[];
  meanRadius: number;
  sigma: number;
};

export type Vision = {
  calib: Calib | null;
  found: boolean;
  hits: VisionHit[];
  /** punto di convergenza delle aste in coordinate faccia (dove guardava la fotocamera) */
  focus: { x: number; y: number } | null;
  /** diametro della faccia in pixel della foto originale (asse maggiore) */
  facePx: number;
  imageW: number;
  imageH: number;
  note: string;
};

const RECT = 260; // lato dell'immagine raddrizzata
const SPAN = 1.12; // la raddrizzata copre -SPAN..SPAN in unità faccia

/* ---------------- colori ---------------- */

function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max / 255 };
}

/** 0 nulla, 1 oro, 2 rosso, 3 blu */
function ringColor(r: number, g: number, b: number) {
  const { h, s, v } = hsv(r, g, b);
  if (s < 0.45 || v < 0.22) return 0;
  if (h >= 40 && h <= 70 && v > 0.45) return 1;
  if ((h <= 18 || h >= 340) && v > 0.28) return 2;
  if (h >= 185 && h <= 250) return 3;
  return 0;
}

/* ---------------- geometria ---------------- */

function eig2(sxx: number, sxy: number, syy: number) {
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc;
  const l2 = tr / 2 - disc;
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { l1, l2, angle };
}

function invert2(m: Mat2): Mat2 {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-9;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det];
}

export function toFace(calib: Calib, x: number, y: number) {
  if (calib.kind === "anelli") {
    let n = { x: 0, y: 0 };
    for (let k = 0; k < 8; k += 1) {
      const r2 = n.x * n.x + n.y * n.y;
      const dx = x - calib.c0x - calib.kx * r2;
      const dy = y - calib.c0y - calib.ky * r2;
      n = { x: calib.Minv[0] * dx + calib.Minv[1] * dy, y: calib.Minv[2] * dx + calib.Minv[3] * dy };
    }
    return n;
  }
  if (calib.kind === "ellisse") {
    const dx = x - calib.cx;
    const dy = y - calib.cy;
    return { x: calib.m[0] * dx + calib.m[1] * dy, y: calib.m[2] * dx + calib.m[3] * dy };
  }
  return applyH(calib.h, x, y);
}

export function toImage(calib: Calib, nx: number, ny: number) {
  if (calib.kind === "anelli") {
    const r2 = nx * nx + ny * ny;
    return { x: calib.c0x + calib.kx * r2 + calib.M[0] * nx + calib.M[1] * ny, y: calib.c0y + calib.ky * r2 + calib.M[2] * nx + calib.M[3] * ny };
  }
  if (calib.kind === "ellisse") {
    return { x: calib.cx + calib.inv[0] * nx + calib.inv[1] * ny, y: calib.cy + calib.inv[2] * nx + calib.inv[3] * ny };
  }
  return applyH(calib.hinv, nx, ny);
}

function applyH(h: Homography, x: number, y: number) {
  const w = h[6] * x + h[7] * y + h[8] || 1e-9;
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}

/** Omografia da 4 coppie di punti (DLT, h33 = 1). */
export function homography(src: { x: number; y: number }[], dst: { x: number; y: number }[]): Homography | null {
  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    B.push(v);
  }
  const sol = solve(A, B);
  return sol ? [...sol, 1] : null;
}

function solve(A: number[][], B: number[]) {
  const n = B.length;
  const M = A.map((row, i) => [...row, B[i]]);
  for (let c = 0; c < n; c += 1) {
    let p = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r += 1) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k += 1) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Calibrazione a mano: 4 tocchi sul bordo esterno, in alto, a destra, in basso, a sinistra. */
export function calibFromTaps(taps: { x: number; y: number }[]): Calib | null {
  if (taps.length !== 4) return null;
  const dst = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
  const h = homography(taps, dst);
  const hinv = homography(dst, taps);
  return h && hinv ? { kind: "omografia", h, hinv } : null;
}

/* ---------------- immagine ---------------- */

export type Pix = { w: number; h: number; data: Uint8ClampedArray };

export function pixelsOf(source: CanvasImageSource, srcW: number, srcH: number, maxSide = 420): Pix | null {
  const k = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(16, Math.round(srcW * k));
  const h = Math.max(16, Math.round(srcH * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  return { w, h, data: ctx.getImageData(0, 0, w, h).data };
}

/** Ellisse della zona colorata (oro+rosso, poi +blu) dai momenti dei pixel. */
export function findFace(pix: Pix): Calib | null {
  const { w, h, data } = pix;
  const classes = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) classes[i] = ringColor(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  // provo prima oro+rosso (raggio 0,4), poi oro+rosso+blu (0,6)
  const tries: { set: number[]; radius: number }[] = [
    { set: [1, 2], radius: 0.4 },
    { set: [1, 2, 3], radius: 0.6 },
    { set: [1], radius: 0.2 },
  ];
  for (const { set, radius } of tries) {
    let cx = 0;
    let cy = 0;
    let n = 0;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (set.includes(classes[y * w + x])) { cx += x; cy += y; n += 1; }
    if (n < 60) continue;
    cx /= n;
    cy /= n;
    // due giri: tolgo i pixel lontani (altri oggetti dello stesso colore)
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    let limit = Infinity;
    for (let pass = 0; pass < 3; pass += 1) {
      let ax = 0;
      let ay = 0;
      let m = 0;
      sxx = 0; sxy = 0; syy = 0;
      for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
        if (!set.includes(classes[y * w + x])) continue;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > limit) continue;
        ax += x; ay += y; m += 1;
      }
      if (m < 40) break;
      ax /= m; ay /= m;
      for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
        if (!set.includes(classes[y * w + x])) continue;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > limit) continue;
        sxx += (x - ax) ** 2; sxy += (x - ax) * (y - ay); syy += (y - ay) ** 2;
      }
      sxx /= m; sxy /= m; syy /= m;
      cx = ax; cy = ay;
      const { l1 } = eig2(sxx, sxy, syy);
      limit = (2 * Math.sqrt(l1) * 1.25) ** 2;
      n = m;
    }
    if (n < 40) continue;
    const { l1, l2, angle } = eig2(sxx, sxy, syy);
    // disco pieno uniforme: varianza lungo un asse = semiasse² / 4
    const A = (2 * Math.sqrt(Math.max(l1, 1e-6))) / radius;
    const B = (2 * Math.sqrt(Math.max(l2, 1e-6))) / radius;
    if (A < 8 || B < 5 || A / B > 4) continue;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // immagine → faccia: ruoto sugli assi, divido per i semiassi, ruoto indietro
    const r1 = [c / A, s / A];
    const r2 = [-s / B, c / B];
    const m: Mat2 = [c * r1[0] - s * r2[0], c * r1[1] - s * r2[1], s * r1[0] + c * r2[0], s * r1[1] + c * r2[1]];
    return { kind: "ellisse", cx, cy, m, inv: invert2(m), ax: A, bx: B, angle };
  }
  return null;
}

function lumaAt(pix: Pix, x: number, y: number) {
  if (x < 0 || y < 0 || x > pix.w - 1 || y > pix.h - 1) return -1;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(pix.w - 1, x0 + 1);
  const y1 = Math.min(pix.h - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const L = (i: number, j: number) => {
    const o = (j * pix.w + i) * 4;
    return 0.3 * pix.data[o] + 0.55 * pix.data[o + 1] + 0.15 * pix.data[o + 2];
  };
  return L(x0, y0) * (1 - fx) * (1 - fy) + L(x1, y0) * fx * (1 - fy) + L(x0, y1) * (1 - fx) * fy + L(x1, y1) * fx * fy;
}

/** Ellisse ai minimi quadrati: a x² + b xy + c y² + d x + e y = 1 (origine dentro). */
function fitEllipse(pts: { x: number; y: number }[], ox: number, oy: number) {
  if (pts.length < 8) return null;
  const AtA = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
  const Atb = [0, 0, 0, 0, 0];
  for (const p of pts) {
    const x = p.x - ox;
    const y = p.y - oy;
    const row = [x * x, x * y, y * y, x, y];
    for (let i = 0; i < 5; i += 1) {
      Atb[i] += row[i];
      for (let j = 0; j < 5; j += 1) AtA[i][j] += row[i] * row[j];
    }
  }
  const q = solve(AtA, Atb);
  if (!q) return null;
  const [a, b, c, d, e] = q;
  const det = 4 * a * c - b * b;
  if (det <= 0) return null;
  const cx = (b * e - 2 * c * d) / det;
  const cy = (b * d - 2 * a * e) / det;
  // valore della forma nel centro → semiassi
  const f0 = 1 - (a * cx * cx + b * cx * cy + c * cy * cy + d * cx + e * cy);
  const { l1, l2, angle } = eig2(a, b / 2, c);
  if (l1 <= 0 || l2 <= 0 || f0 <= 0) return null;
  // eig2 dà l'autovalore più grande per primo: asse corto
  return { cx: cx + ox, cy: cy + oy, minor: Math.sqrt(f0 / l1), major: Math.sqrt(f0 / l2), angle: angle + Math.PI / 2 };
}

/**
 * Affina la calibrazione cercando i bordi veri di tre anelli (oro→rosso a 0,2, blu→nero a 0,6,
 * nero→bianco a 0,8) lungo 36 raggi, poi adatta ellisse per ellisse e lascia scivolare il centro.
 */
export function refineCalib(pix: Pix, calib: Calib, face: Face): Calib {
  if (face.id !== "wa10") return calib;
  const targets = [
    { r: 0.2, lo: 0.13, hi: 0.28, sign: -1 },
    { r: 0.6, lo: 0.5, hi: 0.7, sign: -1 },
    { r: 0.8, lo: 0.7, hi: 0.9, sign: 1 },
  ];
  let current = calib;
  for (let pass = 0; pass < 2; pass += 1) {
    const rings: { r: number; e: NonNullable<ReturnType<typeof fitEllipse>> }[] = [];
    const o = toImage(current, 0, 0);
    for (const t of targets) {
      const pts: { x: number; y: number }[] = [];
      for (let k = 0; k < 36; k += 1) {
        const th = (k / 36) * Math.PI * 2;
        let best = 0;
        let bestT = -1;
        for (let u = t.lo; u <= t.hi; u += 0.004) {
          const a = toImage(current, (u - 0.02) * Math.cos(th), (u - 0.02) * Math.sin(th));
          const b = toImage(current, (u + 0.02) * Math.cos(th), (u + 0.02) * Math.sin(th));
          const la = lumaAt(pix, a.x, a.y);
          const lb = lumaAt(pix, b.x, b.y);
          if (la < 0 || lb < 0) continue;
          const g = (lb - la) * t.sign;
          if (g > best) { best = g; bestT = u; }
        }
        if (best > 28 && bestT > 0) pts.push(toImage(current, bestT * Math.cos(th), bestT * Math.sin(th)));
      }
      let e = fitEllipse(pts, o.x, o.y);
      if (e) {
        // tolgo i punti fuori (frecce sopra il bordo) e rifaccio
        const resid = pts.map((p) => ellipseResidual(e!, p));
        const med = [...resid].sort((x, y) => x - y)[resid.length >> 1] || 1;
        const keep = pts.filter((_, i) => resid[i] <= Math.max(1.5, med * 2.5));
        e = fitEllipse(keep, o.x, o.y) ?? e;
        rings.push({ r: t.r, e });
      }
    }
    if (rings.length < 2) return current;
    // forma comune: assi proporzionali al raggio
    let maj = 0;
    let min = 0;
    let sx = 0;
    let sy = 0;
    let wsum = 0;
    for (const { r, e } of rings) {
      const w = r * r;
      maj += (e.major / r) * w;
      min += (e.minor / r) * w;
      sx += Math.cos(2 * e.angle) * w * (e.major - e.minor);
      sy += Math.sin(2 * e.angle) * w * (e.major - e.minor);
      wsum += w;
    }
    maj /= wsum;
    min /= wsum;
    const angle = 0.5 * Math.atan2(sy, sx);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const M: Mat2 = [c * c * maj + s * s * min, c * s * (maj - min), c * s * (maj - min), s * s * maj + c * c * min];
    // centro(r) = c0 + k r²
    let n = 0;
    let sr2 = 0;
    let sr4 = 0;
    let scx = 0;
    let scy = 0;
    let scxr = 0;
    let scyr = 0;
    for (const { r, e } of rings) {
      const r2 = r * r;
      n += 1; sr2 += r2; sr4 += r2 * r2; scx += e.cx; scy += e.cy; scxr += e.cx * r2; scyr += e.cy * r2;
    }
    const det = n * sr4 - sr2 * sr2;
    const kx = det ? (n * scxr - sr2 * scx) / det : 0;
    const ky = det ? (n * scyr - sr2 * scy) / det : 0;
    const c0x = (scx - kx * sr2) / n;
    const c0y = (scy - ky * sr2) / n;
    if (!Number.isFinite(c0x) || maj < 4 || min < 3) return current;
    current = { kind: "anelli", c0x, c0y, kx, ky, M, Minv: invert2(M) };
  }
  return current;
}

function ellipseResidual(e: { cx: number; cy: number; major: number; minor: number; angle: number }, p: { x: number; y: number }) {
  const c = Math.cos(e.angle);
  const s = Math.sin(e.angle);
  const dx = p.x - e.cx;
  const dy = p.y - e.cy;
  const u = (c * dx + s * dy) / e.major;
  const v = (-s * dx + c * dy) / e.minor;
  return Math.abs(Math.hypot(u, v) - 1) * Math.min(e.major, e.minor);
}

/** Raddrizza la faccia in un quadrato RECT×RECT (coordinate faccia -SPAN..SPAN). */
export function rectify(pix: Pix, calib: Calib) {
  const out = new Uint8ClampedArray(RECT * RECT * 4);
  for (let j = 0; j < RECT; j += 1) {
    for (let i = 0; i < RECT; i += 1) {
      const nx = (i / (RECT - 1)) * 2 * SPAN - SPAN;
      const ny = (j / (RECT - 1)) * 2 * SPAN - SPAN;
      const p = toImage(calib, nx, ny);
      const o = (j * RECT + i) * 4;
      if (p.x < 0 || p.y < 0 || p.x > pix.w - 1 || p.y > pix.h - 1) {
        out[o + 3] = 0;
        continue;
      }
      const x0 = Math.floor(p.x);
      const y0 = Math.floor(p.y);
      const fx = p.x - x0;
      const fy = p.y - y0;
      const x1 = Math.min(pix.w - 1, x0 + 1);
      const y1 = Math.min(pix.h - 1, y0 + 1);
      for (let k = 0; k < 3; k += 1) {
        const a = pix.data[(y0 * pix.w + x0) * 4 + k];
        const b = pix.data[(y0 * pix.w + x1) * 4 + k];
        const c = pix.data[(y1 * pix.w + x0) * 4 + k];
        const d = pix.data[(y1 * pix.w + x1) * 4 + k];
        out[o + k] = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
      }
      out[o + 3] = 255;
    }
  }
  return { w: RECT, h: RECT, data: out } as Pix;
}

export const rectToFace = (i: number, j: number) => ({ x: (i / (RECT - 1)) * 2 * SPAN - SPAN, y: (j / (RECT - 1)) * 2 * SPAN - SPAN });
export const faceToRect = (x: number, y: number) => ({ i: ((x + SPAN) / (2 * SPAN)) * (RECT - 1), j: ((y + SPAN) / (2 * SPAN)) * (RECT - 1) });
export const RECT_SIZE = RECT;

/** Maschera di ciò che non è del colore del suo anello (frecce, buchi). */
export function anomalies(rect: Pix, face: Face, reference?: Pix | null) {
  return anomalyMap(rect, face, reference).mask;
}

function anomalyMap(rect: Pix, face: Face, reference?: Pix | null) {
  const N = RECT * RECT;
  const mask = new Uint8Array(N);
  // zone ad anello prese dalla faccia scelta, più una fascia di paglia fuori
  const edges = [...new Set(face.rings.flatMap((r) => [r.outer, r.inner]).filter((r) => r > 0.001).map((r) => Number(r.toFixed(4))))].sort((x, y) => x - y);
  edges.push(1.1);
  const zoneOf = (r: number) => {
    let z = 0;
    while (z < edges.length && r > edges[z]) z += 1;
    return z;
  };
  const Z = edges.length + 1;
  const lists: number[][][] = Array.from({ length: Z }, () => [[], [], []]);
  const rOf = new Float32Array(N).fill(-1);
  for (let j = 0; j < RECT; j += 1) for (let i = 0; i < RECT; i += 1) {
    const idx = j * RECT + i;
    if (rect.data[idx * 4 + 3] === 0) continue;
    const p = rectToFace(i, j);
    const r = Math.hypot(p.x, p.y);
    if (r > 1.1) continue;
    rOf[idx] = r;
    // per i colori di zona uso solo i pixel lontani dai bordi
    const z = zoneOf(r);
    const near = edges.some((e) => Math.abs(r - e) < 0.03);
    if (near) continue;
    for (let k = 0; k < 3; k += 1) lists[z][k].push(rect.data[idx * 4 + k]);
  }
  const med = lists.map((ch) => ch.map((list) => median(list)));
  const dist = (idx: number, c: number[]) => {
    const r = rect.data[idx * 4];
    const g = rect.data[idx * 4 + 1];
    const b = rect.data[idx * 4 + 2];
    let d = Math.hypot(r - c[0], g - c[1], b - c[2]);
    const luma = 0.3 * r + 0.55 * g + 0.15 * b;
    const ml = 0.3 * c[0] + 0.55 * c[1] + 0.15 * c[2];
    // un'asta di carbonio è più scura dell'anello: lo scuro pesa di più
    if (luma < ml) d += (ml - luma) * 0.6;
    return d;
  };
  for (let idx = 0; idx < N; idx += 1) {
    const r = rOf[idx];
    if (r < 0 || r > 0.985) continue;
    const z = zoneOf(r);
    let d = dist(idx, med[z]);
    // vicino al bordo fra due anelli vanno bene tutti e due i colori (l'ellisse non è mai perfetta)
    for (const [k, e] of edges.entries()) {
      if (Math.abs(r - e) < 0.04) {
        d = Math.min(d, dist(idx, med[k]), dist(idx, med[k + 1]));
      }
    }
    if (reference) {
      const q = reference.data;
      const dr = Math.hypot(rect.data[idx * 4] - q[idx * 4], rect.data[idx * 4 + 1] - q[idx * 4 + 1], rect.data[idx * 4 + 2] - q[idx * 4 + 2]);
      d = Math.min(d, dr * 1.4);
    }
    // sulle righe stampate fra gli anelli serve un segnale molto più forte
    const onLine = edges.some((e) => Math.abs(r - e) < 0.022);
    if (d > (onLine ? 160 : 75)) mask[idx] = 1;
  }
  // zone scure (nero) dove un'asta di carbonio non si vede
  const dark: [number, number][] = [];
  for (let z = 0; z < Math.min(Z, edges.length); z += 1) {
    const [r, g, b] = med[z];
    if (lists[z][0].length > 20 && 0.3 * r + 0.55 * g + 0.15 * b < 80) dark.push([z ? edges[z - 1] : 0, edges[z]]);
  }
  return { mask: open3(mask), dark, edges };
}

function median(list: number[]) {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  return s[s.length >> 1];
}

/** Tolgo i puntini isolati ma lascio le linee sottili (le aste sono larghe 1-2 pixel). */
function open3(mask: Uint8Array) {
  const out = new Uint8Array(mask.length);
  for (let j = 1; j < RECT - 1; j += 1) for (let i = 1; i < RECT - 1; i += 1) {
    const k = j * RECT + i;
    if (!mask[k]) continue;
    let n = 0;
    for (let dj = -1; dj <= 1; dj += 1) for (let di = -1; di <= 1; di += 1) if ((di || dj) && mask[k + dj * RECT + di]) n += 1;
    if (n >= 2) out[k] = 1;
  }
  return out;
}

type Blob = { n: number; cx: number; cy: number; l1: number; l2: number; angle: number; a: { x: number; y: number }; b: { x: number; y: number } };

function blobs(mask: Uint8Array): Blob[] {
  const seen = new Uint8Array(mask.length);
  const out: Blob[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    const pts: number[] = [];
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const k = stack.pop()!;
      pts.push(k);
      const i = k % RECT;
      const j = (k / RECT) | 0;
      for (let dj = -1; dj <= 1; dj += 1) for (let di = -1; di <= 1; di += 1) {
        if (!di && !dj) continue;
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= RECT || jj >= RECT) continue;
        const q = jj * RECT + ii;
        if (mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    if (pts.length < 10 || pts.length > RECT * RECT * 0.08) continue;
    let mx = 0;
    let my = 0;
    for (const k of pts) { mx += k % RECT; my += (k / RECT) | 0; }
    mx /= pts.length;
    my /= pts.length;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (const k of pts) {
      const dx = (k % RECT) - mx;
      const dy = ((k / RECT) | 0) - my;
      sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
    }
    sxx /= pts.length; sxy /= pts.length; syy /= pts.length;
    const { l1, l2, angle } = eig2(sxx, sxy, syy);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    let lo = Infinity;
    let hi = -Infinity;
    for (const k of pts) {
      const t = ((k % RECT) - mx) * ux + (((k / RECT) | 0) - my) * uy;
      if (t < lo) lo = t;
      if (t > hi) hi = t;
    }
    out.push({ n: pts.length, cx: mx, cy: my, l1, l2, angle, a: { x: mx + ux * lo, y: my + uy * lo }, b: { x: mx + ux * hi, y: my + uy * hi } });
  }
  return out;
}

/** Punto più vicino (minimi quadrati) a tutte le rette delle aste. */
function convergence(lines: { p: { x: number; y: number }; u: { x: number; y: number }; w: number }[]) {
  if (lines.length < 2) return null;
  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;
  let e = 0;
  for (const { p, u, w } of lines) {
    // proiettore sulla normale: I - u uᵀ
    const nxx = 1 - u.x * u.x;
    const nxy = -u.x * u.y;
    const nyy = 1 - u.y * u.y;
    a += w * nxx; b += w * nxy; c += w * nyy;
    d += w * (nxx * p.x + nxy * p.y);
    e += w * (nxy * p.x + nyy * p.y);
  }
  const det = a * c - b * b;
  if (Math.abs(det) < 1e-3 * lines.length) return null; // aste quasi parallele
  return { x: (c * d - b * e) / det, y: (a * e - b * d) / det };
}

/** Legge le frecce nella faccia raddrizzata. */
export function readHits(rect: Pix, face: Face, opts: { reference?: Pix | null; known?: { x: number; y: number }[]; max?: number } = {}) {
  const { mask, dark, edges } = anomalyMap(rect, face, opts.reference);
  const found = blobs(mask);
  const px = (2 * SPAN) / (RECT - 1); // unità faccia per pixel raddrizzato
  // pezzi allungati (asta, alette) in coordinate faccia
  type Piece = { blob: Blob; c: { x: number; y: number }; u: { x: number; y: number }; ends: { x: number; y: number }[]; w: number };
  const pieces: Piece[] = [];
  for (const blob of found) {
    const elong = Math.sqrt(blob.l1 / Math.max(blob.l2, 0.25));
    if (elong < 2.2 || Math.sqrt(blob.l1) * 4 * px < 0.035) continue;
    const c = rectToFace(blob.cx, blob.cy);
    const A = rectToFace(blob.a.x, blob.a.y);
    const B = rectToFace(blob.b.x, blob.b.y);
    const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    // le righe stampate fra gli anelli: pezzi tangenti che stanno tutti su un bordo
    const rc = Math.hypot(c.x, c.y) || 1e-6;
    const radial = Math.abs(((B.x - A.x) / len) * (c.x / rc) + ((B.y - A.y) / len) * (c.y / rc));
    const onEdge = edges.some((e) => [A, B, c].every((q) => Math.abs(Math.hypot(q.x, q.y) - e) < 0.03));
    if (onEdge && radial < 0.45) continue;
    pieces.push({ blob, c, u: { x: (B.x - A.x) / len, y: (B.y - A.y) / len }, ends: [A, B], w: Math.sqrt(blob.n) * Math.min(4, elong) });
  }
  // unisco i pezzi della stessa freccia: stessa direzione, sulla stessa retta, vicini
  const parent = pieces.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (let i = 0; i < pieces.length; i += 1) for (let k = i + 1; k < pieces.length; k += 1) {
    const P = pieces[i];
    const Q = pieces[k];
    const cos = Math.abs(P.u.x * Q.u.x + P.u.y * Q.u.y);
    if (cos < Math.cos((12 * Math.PI) / 180)) continue;
    const off = Math.abs((Q.c.x - P.c.x) * -P.u.y + (Q.c.y - P.c.y) * P.u.x);
    const gap = Math.min(...P.ends.flatMap((e) => Q.ends.map((f) => Math.hypot(e.x - f.x, e.y - f.y))));
    if (off < 0.035 && gap < 0.45) parent[root(k)] = root(i);
  }
  const clusters = new Map<number, Piece[]>();
  pieces.forEach((p, i) => clusters.set(root(i), [...(clusters.get(root(i)) ?? []), p]));
  const arrows = [...clusters.values()].map((list) => {
    // direzione media (segno coerente) e punti estremi lungo di essa
    const ref = list[0].u;
    let ux = 0;
    let uy = 0;
    let wx = 0;
    let wy = 0;
    let wt = 0;
    for (const p of list) {
      const sgn = p.u.x * ref.x + p.u.y * ref.y >= 0 ? 1 : -1;
      ux += p.u.x * sgn * p.w;
      uy += p.u.y * sgn * p.w;
      wx += p.c.x * p.w;
      wy += p.c.y * p.w;
      wt += p.w;
    }
    const ul = Math.hypot(ux, uy) || 1;
    const u = { x: ux / ul, y: uy / ul };
    const c = { x: wx / wt, y: wy / wt };
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of list) for (const e of p.ends) {
      const t = (e.x - c.x) * u.x + (e.y - c.y) * u.y;
      lo = Math.min(lo, t);
      hi = Math.max(hi, t);
    }
    return { c, u, a: { x: c.x + u.x * lo, y: c.y + u.y * lo }, b: { x: c.x + u.x * hi, y: c.y + u.y * hi }, w: wt, blobs: list.map((p) => p.blob), length: hi - lo };
  });
  let focus = convergence(arrows.map((a) => ({ p: a.c, u: a.u, w: a.w })));
  if (!focus || Math.hypot(focus.x, focus.y) > 6) focus = null;
  // da che parte è la cocca? Le alette sono la parte larga e pesante del pezzo.
  const sided = arrows.map((arrow) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const b of arrow.blobs) for (const e of [b.a, b.b]) {
      const f = rectToFace(e.x, e.y);
      const t = (f.x - arrow.c.x) * arrow.u.x + (f.y - arrow.c.y) * arrow.u.y;
      lo = Math.min(lo, t);
      hi = Math.max(hi, t);
    }
    let heavy = 0;
    let wsum = 0;
    for (const b of arrow.blobs) {
      const f = rectToFace(b.cx, b.cy);
      const t = (f.x - arrow.c.x) * arrow.u.x + (f.y - arrow.c.y) * arrow.u.y;
      const wgt = b.n * Math.sqrt(Math.max(b.l2, 0.25));
      heavy += t * wgt;
      wsum += wgt;
    }
    const mean = wsum ? heavy / wsum : 0;
    const mid = (lo + hi) / 2;
    const lean = hi > lo ? (mean - mid) / (hi - lo) : 0; // >0: alette verso b
    return { ...arrow, lean };
  });
  // direzione comune delle code (tutte le frecce sono quasi parallele)
  let tx = 0;
  let ty = 0;
  for (const a of sided) {
    if (Math.abs(a.lean) < 0.06) continue;
    const sgn = a.lean > 0 ? 1 : -1;
    tx += a.u.x * sgn * Math.abs(a.lean) * a.w;
    ty += a.u.y * sgn * Math.abs(a.lean) * a.w;
  }
  const consensus = Math.hypot(tx, ty) > 1e-6 ? { x: tx / Math.hypot(tx, ty), y: ty / Math.hypot(tx, ty) } : null;
  const oriented = sided.map((a) => {
    let tailAtB: boolean;
    if (Math.abs(a.lean) >= 0.12) tailAtB = a.lean > 0;
    else if (consensus) tailAtB = a.u.x * consensus.x + a.u.y * consensus.y >= 0;
    else if (focus) tailAtB = Math.hypot(a.b.x - focus.x, a.b.y - focus.y) > Math.hypot(a.a.x - focus.x, a.a.y - focus.y);
    else tailAtB = Math.hypot(a.b.x, a.b.y) > Math.hypot(a.a.x, a.a.y);
    return { ...a, tip: tailAtB ? a.a : a.b, tail: tailAtB ? a.b : a.a };
  });
  // lunghezza tipica di una freccia ben visibile: serve ad allungare le aste nascoste sul nero
  const inDark = (p: { x: number; y: number }) => {
    const r = Math.hypot(p.x, p.y);
    return dark.some(([lo, hi]) => r > lo - 0.03 && r < hi + 0.03);
  };
  const lengths = oriented.map((a) => a.length).sort((x, y) => x - y);
  const clean = oriented.filter((a) => !inDark(a.tip) && a.length > 0.1).map((a) => a.length).sort((x, y) => x - y);
  // le aste ben visibili danno la lunghezza tipica; se non ce ne sono uso la più lunga trovata
  const typical = clean.length >= 2 ? clean[clean.length >> 1] : lengths.length ? lengths[lengths.length - 1] * 0.95 : 0;
  if (!focus) focus = { x: 0, y: 0 };
  const used = new Set(arrows.flatMap((a) => a.blobs));
  const shaftR = 0.012;
  const hits: { x: number; y: number; tail?: { x: number; y: number }; kind: "asta" | "foro"; confidence: number }[] = [];
  for (const arrow of oriented) {
    let tip = arrow.tip;
    const back = { x: arrow.tip.x - arrow.tail.x, y: arrow.tip.y - arrow.tail.y };
    const bl = Math.hypot(back.x, back.y) || 1;
    if (typical && inDark(tip) && arrow.length < typical * 0.92) {
      // l'asta continua sotto il nero: la allungo finché resto sul nero, al massimo fino alla lunghezza tipica
      const step = 0.01;
      let extra = 0;
      while (extra + step < typical - arrow.length) {
        const next = { x: tip.x + (back.x / bl) * step, y: tip.y + (back.y / bl) * step };
        if (!inDark(next)) break;
        tip = next;
        extra += step;
      }
    }
    if (Math.hypot(tip.x, tip.y) > 1.02) continue;
    hits.push({ x: tip.x, y: tip.y, tail: arrow.tail, kind: "asta", confidence: Math.min(1, 0.35 + arrow.length * 1.5) });
  }
  for (const blob of found) {
    if (used.has(blob)) continue;
    const C = rectToFace(blob.cx, blob.cy);
    if (Math.hypot(C.x, C.y) > 1.0) continue;
    const size = Math.sqrt(blob.n) * px;
    const elong = Math.sqrt(blob.l1 / Math.max(blob.l2, 0.25));
    // un foro o una freccia vista di punta: piccolo e compatto, e non sulla retta di un'asta
    if (size > 0.07 || elong > 2.2) continue;
    if (blob.n < 14 && edges.some((e) => Math.abs(Math.hypot(C.x, C.y) - e) < 0.02)) continue;
    if (arrows.some((a) => Math.abs((C.x - a.c.x) * -a.u.y + (C.y - a.c.y) * a.u.x) < 0.03)) continue;
    hits.push({ x: C.x, y: C.y, kind: "foro", confidence: Math.min(0.7, 0.2 + blob.n / 150) });
  }
  // fori vicini a una punta d'asta sono la stessa freccia
  const merged = hits.filter((h, i) => h.kind === "asta" || !hits.some((o, k) => k !== i && o.kind === "asta" && Math.hypot(o.x - h.x, o.y - h.y) < 0.06));
  const known = opts.known ?? [];
  const fresh = merged.filter((h) => !known.some((k) => Math.hypot(k.x - h.x, k.y - h.y) < 0.05));
  fresh.sort((a, b) => b.confidence - a.confidence);
  const top = fresh.slice(0, opts.max ?? 12);
  return {
    hits: top.map((h) => {
      const r = Math.max(0, Math.hypot(h.x, h.y) - shaftR);
      const s = scoreAtRadius(face, r);
      return { ...h, score: s.score, isX: s.isX, miss: s.miss };
    }),
    focus,
    mask,
  };
}

/* ---------------- faccia di carta e aste con le alette ---------------- */

/** Calibrazione a ellisse da centro, semiassi (pixel) e direzione dell'asse maggiore. */
export function ellipseCalib(cx: number, cy: number, A: number, B: number, angle: number): Calib {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const r1 = [c / A, s / A];
  const r2 = [-s / B, c / B];
  const m: Mat2 = [c * r1[0] - s * r2[0], c * r1[1] - s * r2[1], s * r1[0] + c * r2[0], s * r1[1] + c * r2[1]];
  return { kind: "ellisse", cx, cy, m, inv: invert2(m), ax: A, bx: B, angle };
}

/** Ellisse del bordo esterno (raggio 1) di una calibrazione qualsiasi, per regolarla a mano. */
export function calibEllipse(calib: Calib) {
  if (calib.kind === "ellisse") return { cx: calib.cx, cy: calib.cy, A: calib.ax, B: calib.bx, angle: calib.angle };
  const pts: { x: number; y: number }[] = [];
  for (let k = 0; k < 36; k += 1) pts.push(toImage(calib, Math.cos((k / 36) * Math.PI * 2), Math.sin((k / 36) * Math.PI * 2)));
  const o = toImage(calib, 0, 0);
  const e = fitEllipse(pts, o.x, o.y);
  if (!e) {
    const r = pts.reduce((acc, p) => acc + Math.hypot(p.x - o.x, p.y - o.y), 0) / pts.length;
    return { cx: o.x, cy: o.y, A: r, B: r, angle: 0 };
  }
  return { cx: e.cx, cy: e.cy, A: e.major, B: e.minor, angle: e.angle };
}

function otsu(hist: Uint32Array) {
  let total = 0;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) { total += hist[i]; sum += i * hist[i]; }
  let wB = 0;
  let sB = 0;
  let best = 0;
  let t = 128;
  for (let i = 0; i < 256; i += 1) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sB += i * hist[i];
    const mB = sB / wB;
    const mF = (sum - sB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; t = i; }
  }
  return t;
}

function integral(mask: Uint8Array, w: number, h: number) {
  const I = new Uint32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y += 1) {
    let row = 0;
    for (let x = 0; x < w; x += 1) {
      row += mask[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
    }
  }
  return (x0: number, y0: number, x1: number, y1: number) => {
    // somma nel rettangolo [x0,x1) × [y0,y1), già dentro l'immagine
    const W = w + 1;
    return I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0];
  };
}

/**
 * Faccia di carta chiara, anche senza colori (bianca con righe sottili, come le facce da campagna
 * o le stampe di allenamento): la zona chiara e poco colorata più "tonda" e grande della foto.
 * 1) chiaro = minimo dei canali meno la saturazione, soglia di Otsu;
 * 2) il quadrato più grande quasi tutto chiaro dà il centro (le strisce di nastro sono strette);
 * 3) 72 raggi dal centro trovano il bordo; ellisse robusta (via le frecce e il nastro che toccano).
 */
export function findPaperFace(pix: Pix): Calib | null {
  // 1) voto per cerchi su un'immagine piccola: lungo il cerchio giusto dentro è chiaro e fuori scuro
  //    quasi dappertutto (i buchi nella carta e la trama del paglione no, il nastro è dritto)
  const k = Math.min(1, 200 / Math.max(pix.w, pix.h));
  const sw = Math.max(16, Math.round(pix.w * k));
  const sh = Math.max(16, Math.round(pix.h * k));
  const small = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y += 1) for (let x = 0; x < sw; x += 1) {
    let acc = 0;
    let n = 0;
    const x0 = Math.floor(x / k);
    const y0 = Math.floor(y / k);
    const x1 = Math.min(pix.w, Math.floor((x + 1) / k));
    const y1 = Math.min(pix.h, Math.floor((y + 1) / k));
    for (let yy = y0; yy < Math.max(y1, y0 + 1); yy += 1) for (let xx = x0; xx < Math.max(x1, x0 + 1); xx += 1) {
      const o = (Math.min(pix.h - 1, yy) * pix.w + Math.min(pix.w - 1, xx)) * 4;
      acc += Math.max(pix.data[o], pix.data[o + 1], pix.data[o + 2]);
      n += 1;
    }
    small[y * sw + x] = acc / n;
  }
  const L = (x: number, y: number) => {
    if (x < 0 || y < 0 || x > sw - 1 || y > sh - 1) return -1;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(sw - 1, x0 + 1);
    const y1 = Math.min(sh - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;
    return small[y0 * sw + x0] * (1 - fx) * (1 - fy) + small[y0 * sw + x1] * fx * (1 - fy) + small[y1 * sw + x0] * (1 - fx) * fy + small[y1 * sw + x1] * fx * fy;
  };
  const NA = 36;
  const cs = Array.from({ length: NA }, (_, i) => Math.cos((i / NA) * Math.PI * 2));
  const sn = Array.from({ length: NA }, (_, i) => Math.sin((i / NA) * Math.PI * 2));
  const ring = (cx: number, cy: number, r: number) => {
    const d = Math.max(1.2, r * 0.07);
    let sum = 0;
    let pos = 0;
    let n = 0;
    let inside = 0;
    for (let i = 0; i < NA; i += 1) {
      const a = L(cx + cs[i] * (r - d), cy + sn[i] * (r - d));
      const b = L(cx + cs[i] * (r + d), cy + sn[i] * (r + d));
      if (a < 0 || b < 0) continue;
      const diff = a - b;
      sum += Math.max(-60, Math.min(60, diff));
      if (diff > 14) pos += 1;
      inside += a;
      n += 1;
    }
    if (n < NA * 0.7) return 0;
    const frac = pos / n;
    return (sum / n) * frac * frac * (inside / n > 120 ? 1 : 0.4);
  };
  // candidati: i cerchi migliori, poi scelgo tenendo conto di grandezza e posizione
  // (un bersaglio è grande e verso il centro della foto; la cocca sfocata vicino all'obiettivo no)
  type Cand = { score: number; cx: number; cy: number; r: number };
  const cands: Cand[] = [];
  const rMin = Math.max(5, Math.min(sw, sh) * 0.05);
  const rMax = Math.max(sw, sh) * 0.42;
  for (let r = rMin; r <= rMax; r *= 1.06) {
    const step = Math.max(1, r * 0.12);
    for (let cy = r * 0.5; cy < sh - r * 0.5; cy += step) for (let cx = r * 0.5; cx < sw - r * 0.5; cx += step) {
      const sc = ring(cx, cy, r);
      if (sc < 8) continue;
      const near = cands.findIndex((c) => Math.hypot(c.cx - cx, c.cy - cy) < Math.max(c.r, r) * 0.6);
      if (near >= 0) {
        if (sc > cands[near].score) cands[near] = { score: sc, cx, cy, r };
      } else cands.push({ score: sc, cx, cy, r });
    }
  }
  if (!cands.length) return null;
  const diag = Math.hypot(sw, sh);
  const top = Math.max(...cands.map((c) => c.score));
  const rank = (c: Cand) => {
    const central = 1 - Math.min(1, Math.hypot(c.cx - sw / 2, c.cy - sh / 2) / (diag / 2));
    const big = Math.min(1, c.r / (Math.min(sw, sh) * 0.18));
    const edge = Math.min(c.cx - c.r, c.cy - c.r, sw - c.cx - c.r, sh - c.cy - c.r) < 0 ? 0.6 : 1;
    return c.score * (0.55 + 0.45 * central) * (0.6 + 0.4 * big) * edge;
  };
  let best = cands.filter((c) => c.score > top * 0.35).sort((a, b) => rank(b) - rank(a))[0];
  // affino centro e raggio
  for (let pass = 0; pass < 3; pass += 1) {
    const st = Math.max(0.5, best.r * 0.04) / (pass + 1);
    for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) for (const f of [0.96, 0.98, 1, 1.02, 1.04]) {
      const sc = ring(best.cx + dx * st, best.cy + dy * st, best.r * f);
      if (sc > best.score) best = { score: sc, cx: best.cx + dx * st, cy: best.cy + dy * st, r: best.r * f };
    }
  }
  // 2) ellisse (la foto è di sbieco) dai bordi veri lungo 72 raggi, a piena risoluzione
  const cx = best.cx / k;
  const cy = best.cy / k;
  const r0 = best.r / k;
  const d = Math.max(1.5, r0 * 0.04);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 72; i += 1) {
    const ux = Math.cos((i / 72) * Math.PI * 2);
    const uy = Math.sin((i / 72) * Math.PI * 2);
    let top = 22;
    let at = -1;
    for (let r = r0 * 0.7; r < r0 * 1.45; r += 0.5) {
      const a = lumaAt(pix, cx + ux * (r - d), cy + uy * (r - d));
      const b = lumaAt(pix, cx + ux * (r + d), cy + uy * (r + d));
      if (a < 0 || b < 0) break;
      if (a - b > top) { top = a - b; at = r; }
    }
    if (at > 0) pts.push({ x: cx + ux * at, y: cy + uy * at });
  }
  let e = pts.length >= 20 ? fitEllipse(pts, cx, cy) : null;
  for (let it = 0; it < 3 && e; it += 1) {
    const resid = pts.map((p) => ellipseResidual(e!, p));
    const med = [...resid].sort((a, b) => a - b)[resid.length >> 1] || 1;
    const keep = pts.filter((_, i) => resid[i] <= Math.max(1.2, med * 2.2));
    if (keep.length < 16) break;
    e = fitEllipse(keep, cx, cy) ?? e;
  }
  const ok = e && e.minor > 6 && e.major / e.minor < 2.6 && Math.hypot(e.cx - cx, e.cy - cy) < r0 * 0.3 && Math.abs(Math.sqrt(e.major * e.minor) / r0 - 1) < 0.3;
  return ok && e ? ellipseCalib(e.cx, e.cy, e.major, e.minor, e.angle) : ellipseCalib(cx, cy, r0, r0, 0);
}

/** Quanto la calibrazione a colori sembra davvero una faccia: oro al centro, rosso intorno. */
function colorEvidence(pix: Pix, calib: Calib) {
  let gold = 0;
  let gn = 0;
  let red = 0;
  let rn = 0;
  for (let k = 0; k < 300; k += 1) {
    const a = k * 2.399963;
    const inner = Math.sqrt((k + 0.5) / 300) * 0.17;
    const p = toImage(calib, inner * Math.cos(a), inner * Math.sin(a));
    const q = toImage(calib, (0.24 + 0.12 * ((k * 7) % 10) / 10) * Math.cos(a), (0.24 + 0.12 * ((k * 7) % 10) / 10) * Math.sin(a));
    for (const [pt, isGold] of [[p, true], [q, false]] as const) {
      const xi = Math.round(pt.x);
      const yi = Math.round(pt.y);
      if (xi < 0 || yi < 0 || xi >= pix.w || yi >= pix.h) continue;
      const o = (yi * pix.w + xi) * 4;
      const c = ringColor(pix.data[o], pix.data[o + 1], pix.data[o + 2]);
      if (isGold) { gn += 1; if (c === 1) gold += 1; } else { rn += 1; if (c === 2) red += 1; }
    }
  }
  return gn && rn ? Math.min(gold / gn, red / rn) : 0;
}

function rgbAt(pix: Pix, x: number, y: number, out: number[]) {
  if (x < 0 || y < 0 || x > pix.w - 1 || y > pix.h - 1) return false;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(pix.w - 1, x0 + 1);
  const y1 = Math.min(pix.h - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  for (let k = 0; k < 3; k += 1) {
    const a = pix.data[(y0 * pix.w + x0) * 4 + k];
    const b = pix.data[(y0 * pix.w + x1) * 4 + k];
    const c = pix.data[(y1 * pix.w + x0) * 4 + k];
    const d = pix.data[(y1 * pix.w + x1) * 4 + k];
    out[k] = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  }
  return true;
}

export type Shaft = { tip: { x: number; y: number }; tail: { x: number; y: number }; strength: number; img?: { x: number; y: number; ux: number; uy: number } };

/**
 * Aste viste da dietro o di sbieco (foto dalla linea di tiro): le alette colorate sono fuori dalla
 * faccia, l'asta va da loro verso il bersaglio. Per ogni macchia di alette provo le rette verso la
 * faccia e tengo quelle lungo cui c'è una "striscia" dello stesso colore (l'asta) diversa da
 * entrambi i lati; la punta è dove la striscia finisce, cioè dove la freccia entra.
 * Restituisce punta e cocca in coordinate faccia.
 */
export function findShafts(pix: Pix, calib: Calib): Shaft[] {
  const { w, h, data } = pix;
  const o = toImage(calib, 0, 0);
  let R = 0;
  for (let k = 0; k < 8; k += 1) {
    const p = toImage(calib, Math.cos((k / 8) * Math.PI * 2), Math.sin((k / 8) * Math.PI * 2));
    R += Math.hypot(p.x - o.x, p.y - o.y) / 8;
  }
  if (!(R > 4)) return [];
  // alette: colori vivi fuori dalla faccia
  const vivid = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const i = y * w + x;
    const { s, v } = hsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    if (s < 0.5 || v < 0.3) continue;
    const f = toFace(calib, x, y);
    if (Math.hypot(f.x, f.y) < 1.08) continue;
    vivid[i] = 1;
  }
  const label = new Int32Array(w * h).fill(-1);
  const fletch: { cx: number; cy: number; n: number; size: number; id: number }[] = [];
  const minArea = Math.max(25, 0.012 * Math.PI * R * R);
  const stack: number[] = [];
  for (let start = 0; start < w * h; start += 1) {
    if (!vivid[start] || label[start] >= 0) continue;
    const id = start; // id unico della macchia
    let n = 0;
    let sx = 0;
    let sy = 0;
    let far = 0;
    stack.push(start);
    label[start] = id;
    const members: number[] = [];
    while (stack.length) {
      const k = stack.pop()!;
      members.push(k);
      const x = k % w;
      const y = (k / w) | 0;
      n += 1; sx += x; sy += y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx;
        if (vivid[q] && label[q] < 0) { label[q] = id; stack.push(q); }
      }
    }
    if (n < minArea) continue;
    const cx = sx / n;
    const cy = sy / n;
    for (const k of members) far = Math.max(far, Math.hypot((k % w) - cx, ((k / w) | 0) - cy));
    const d = Math.hypot(cx - o.x, cy - o.y);
    if (d < R * 1.1 || d > R * 12) continue;
    fletch.push({ cx, cy, n, size: far, id });
  }
  fletch.sort((a, b) => b.n - a.n);
  const shafts: Shaft[] = [];
  const sides = [2, 5, 9];
  // legno chiaro: "giallo" = (R+G)/2 − B alto e luminoso; carta, nastro e paglia scura no
  const Y = new Float32Array(w * h);
  const Lu = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    const rr = data[i * 4];
    const gg = data[i * 4 + 1];
    const bb = data[i * 4 + 2];
    Y[i] = (rr + gg) / 2 - bb;
    Lu[i] = 0.3 * rr + 0.55 * gg + 0.15 * bb;
  }
  const idx = (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    return xi < 0 || yi < 0 || xi >= w || yi >= h ? -1 : yi * w + xi;
  };
  // quanto è "gialla" la carta (luce calda): il legno deve esserlo di più
  const faceY: number[] = [];
  for (let k = 0; k < 200; k += 1) {
    const rr = Math.sqrt((k + 0.5) / 200) * 0.95;
    const q = toImage(calib, rr * Math.cos(k * 2.4), rr * Math.sin(k * 2.4));
    const xi = Math.round(q.x);
    const yi = Math.round(q.y);
    if (xi >= 0 && yi >= 0 && xi < w && yi < h) faceY.push((data[(yi * w + xi) * 4] + data[(yi * w + xi) * 4 + 1]) / 2 - data[(yi * w + xi) * 4 + 2]);
  }
  faceY.sort((p, q) => p - q);
  const yBase = Math.max(0, faceY.length ? faceY[faceY.length >> 1] : 0);
  type Line = { th: number; run: number; tip: { x: number; y: number }; ox: number; oy: number; ux: number; uy: number; cover: number };
  for (const f of fletch.slice(0, 6)) {
    const toC = Math.atan2(o.y - f.cy, o.x - f.cx);
    const L = Math.hypot(o.x - f.cx, o.y - f.cy);
    const cone = Math.atan((1.3 * R) / L) + (4 * Math.PI) / 180;
    const stepA = (0.7 * Math.PI) / 180;
    const span = Math.min(f.size, R * 0.8);
    const lines: Line[] = [];
    for (let th = toC - cone; th <= toC + cone; th += stepA) {
      const ux = Math.cos(th);
      const uy = Math.sin(th);
      for (let off = -span; off <= span; off += 3) {
        const ox = f.cx - uy * off;
        const oy = f.cy + ux * off;
        const along = (o.x - ox) * ux + (o.y - oy) * uy;
        const miss = Math.abs((o.x - ox) * -uy + (o.y - oy) * ux);
        if (along < R * 0.5 || miss > 1.3 * R) continue;
        let t0 = 0;
        while (t0 < f.size * 1.6) {
          const q = idx(ox + ux * t0, oy + uy * t0);
          if (q < 0 || label[q] !== f.id) break;
          t0 += 1;
        }
        const marks: number[] = [];
        const end = Math.min(along + 1.25 * R, L * 3);
        for (let t = t0; t < end; t += 1) {
          const px = ox + ux * t;
          const py = oy + uy * t;
          const q = idx(px, py);
          if (q < 0) break;
          let mark = 0;
          if (Y[q] > yBase + 14 && Lu[q] > 105) {
            for (const d of sides) {
              const ql = idx(px - uy * d, py + ux * d);
              const qr = idx(px + uy * d, py - ux * d);
              if (ql < 0 || qr < 0) continue;
              const dy = Math.min(Y[q] - Y[ql], Y[q] - Y[qr]);
              const dl = Math.min(Lu[q] - Lu[ql], Lu[q] - Lu[qr]);
              if (dy > 10 || dl > 35) { mark = 1; break; }
              mark = 0.4; // legno, ma uguale ai lati (nastro o asta larga)
            }
          }
          marks.push(mark);
        }
        // punta: l'ultimo punto pieno dove la finestra precedente è ancora "asta"
        const W = Math.max(6, Math.round(L * 0.12));
        let acc = 0;
        let tipAt = -1;
        for (let i = 0; i < marks.length; i += 1) {
          acc += marks[i];
          if (i >= W) acc -= marks[i - W];
          if (marks[i] === 1 && acc / Math.min(W, i + 1) >= 0.5) tipAt = i;
        }
        if (tipAt < 0) continue;
        let covered = 0;
        for (let i = 0; i <= tipAt; i += 1) covered += marks[i];
        const cover = covered / (tipAt + 1);
        if (cover < 0.55) continue;
        const t = t0 + tipAt;
        lines.push({ th, run: tipAt * cover, tip: { x: ox + ux * t, y: oy + uy * t }, ox, oy, ux, uy, cover });
      }
    }
    // le aste vere: le rette migliori, una per asta (rette quasi uguali = stessa asta)
    const need = Math.max(R * 0.6, (L - R) * 0.4);
    lines.sort((p, q) => q.run - p.run);
    const kept: Line[] = [];
    for (const p of lines) {
      if (p.run < need) break;
      // stessa asta: ognuna delle due punte sta sulla retta dell'altra
      const same = kept.some((q) => {
        const g1 = Math.abs((p.tip.x - q.ox) * -q.uy + (p.tip.y - q.oy) * q.ux);
        const g2 = Math.abs((q.tip.x - p.ox) * -p.uy + (q.tip.y - p.oy) * p.ux);
        return (g1 < R * 0.11 && g2 < R * 0.11) || Math.hypot(p.tip.x - q.tip.x, p.tip.y - q.tip.y) < R * 0.08;
      });
      if (same) continue;
      // una retta molto più debole della migliore è rumore
      if (kept.length && p.run < kept[0].run * 0.45) break;
      kept.push(p);
      if (kept.length >= 4) break;
    }
    for (const p of kept) {
      const tip = toFace(calib, p.tip.x, p.tip.y);
      if (Math.hypot(tip.x, tip.y) > 1.25) continue;
      const back = Math.min(L, p.run + R * 0.5);
      shafts.push({ tip, tail: toFace(calib, p.tip.x - p.ux * back, p.tip.y - p.uy * back), strength: Math.min(1, (p.run / L) * p.cover), img: { x: p.tip.x, y: p.tip.y, ux: p.ux, uy: p.uy } });
    }
  }
  // stessa asta trovata più volte (da macchie o rette vicine): resta quella che arriva più avanti,
  // perché la punta vera è dove l'asta finisce dentro il bersaglio
  const reach = (a: Shaft) => (a.img ? a.img.x * a.img.ux + a.img.y * a.img.uy : 0);
  // la punta più corta sta sulla retta di quella più lunga: è un pezzo della stessa asta
  const sameShaft = (a: Shaft, b: Shaft) => {
    if (!a.img || !b.img) return Math.hypot(a.tip.x - b.tip.x, a.tip.y - b.tip.y) < 0.1;
    const cos = a.img.ux * b.img.ux + a.img.uy * b.img.uy;
    if (cos < Math.cos((10 * Math.PI) / 180)) return Math.hypot(a.tip.x - b.tip.x, a.tip.y - b.tip.y) < 0.1;
    const [long, short] = reach(a) >= reach(b) ? [a.img, b.img] : [b.img, a.img];
    const g = Math.abs((short.x - long.x) * -long.uy + (short.y - long.y) * long.ux);
    return g < R * 0.09;
  };
  const out: Shaft[] = [];
  for (const sh of shafts.sort((a, b) => b.strength - a.strength)) {
    const k = out.findIndex((q) => sameShaft(q, sh));
    if (k < 0) out.push(sh);
    else if (reach(sh) > reach(out[k]) && sh.strength > out[k].strength * 0.6) out[k] = { ...sh, strength: Math.max(sh.strength, out[k].strength) };
  }
  return out;
}

/** Lettura completa di una foto. */
export function readPhoto(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  face: Face,
  opts: { calib?: Calib | null; known?: { x: number; y: number }[]; max?: number; keepHoles?: boolean } = {},
): Vision & { rect: Pix | null; pix: Pix | null; paper: boolean; shafts: number } {
  const pix = pixelsOf(source, srcW, srcH, 560);
  const empty = { found: false, hits: [], focus: null, facePx: 0, imageW: srcW, imageH: srcH, rect: null, paper: false, shafts: 0 };
  if (!pix) return { ...empty, calib: null, pix: null, note: "Foto non leggibile." };
  // 1) faccia a colori (oro, rosso, blu) se c'è davvero; 2) altrimenti la faccia di carta chiara
  let calib = opts.calib ?? null;
  let paper = false;
  if (!calib) {
    const rough = findFace(pix);
    const colored = rough ? refineCalib(pix, rough, face) : null;
    if (colored && colorEvidence(pix, colored) > 0.3) calib = colored;
    else {
      const sheet = findPaperFace(pix);
      if (sheet) {
        calib = sheet;
        paper = true;
      } else calib = colored;
    }
  }
  if (!calib) {
    return { ...empty, calib: null, pix, note: "Non trovo la faccia. Calibra a mano: 4 tocchi sul bordo esterno, poi regola il padiglione." };
  }
  const rect = rectify(pix, calib);
  const read = readHits(rect, face, { known: opts.known, max: 24 });
  // aste con le alette fuori dalla faccia: sono le frecce di questa volée, i fori sono vecchi
  const shafts = findShafts(pix, calib);
  type Raw = { x: number; y: number; tail?: { x: number; y: number }; kind: "asta" | "foro"; confidence: number; score: number; isX: boolean; miss: boolean };
  let list: Raw[] = read.hits;
  if (shafts.length) {
    const fromShafts: Raw[] = shafts.map((sh) => {
      const s = scoreAtRadius(face, Math.max(0, Math.hypot(sh.tip.x, sh.tip.y) - 0.012));
      return { x: sh.tip.x, y: sh.tip.y, tail: sh.tail, kind: "asta", confidence: 0.6 + 0.4 * sh.strength, score: s.score, isX: s.isX, miss: s.miss };
    });
    const others = read.hits.filter((hh) => (opts.keepHoles || (hh.kind === "asta" && fromShafts.length < 2)) && !fromShafts.some((q) => Math.hypot(q.x - hh.x, q.y - hh.y) < 0.1));
    list = [...fromShafts, ...others.map((hh) => ({ ...hh, confidence: hh.confidence * 0.7 }))];
  }
  const known = opts.known ?? [];
  list = list.filter((hh) => !known.some((k) => Math.hypot(k.x - hh.x, k.y - hh.y) < 0.05));
  list.sort((a, b) => b.confidence - a.confidence);
  list = list.slice(0, opts.max ?? 12);
  const hits: VisionHit[] = list.map((hh) => {
    const p = toImage(calib!, hh.x, hh.y);
    const t = hh.tail ? toImage(calib!, hh.tail.x, hh.tail.y) : null;
    return {
      nx: hh.x,
      ny: hh.y,
      score: hh.score,
      isX: hh.isX,
      miss: hh.miss,
      px: p.x / pix.w,
      py: p.y / pix.h,
      kind: hh.kind,
      tailPx: t ? t.x / pix.w : undefined,
      tailPy: t ? t.y / pix.h : undefined,
      confidence: hh.confidence,
    };
  });
  // diametro della faccia in pixel originali (asse maggiore)
  const scale = srcW / pix.w;
  let facePx = 0;
  for (let a = 0; a < Math.PI; a += Math.PI / 18) {
    const p = toImage(calib, Math.cos(a), Math.sin(a));
    const q = toImage(calib, -Math.cos(a), -Math.sin(a));
    facePx = Math.max(facePx, Math.hypot(p.x - q.x, p.y - q.y) * scale);
  }
  return { calib, found: true, hits, focus: read.focus, facePx, imageW: srcW, imageH: srcH, rect, pix, note: "", paper, shafts: shafts.length };
}

/** Distanza stimata con il foro stenopeico (Miraglio): focale da un angolo di campo diagonale di 67°. */
export function estimateDistance(facePx: number, faceCm: number, imageW: number, imageH: number, fovDeg = 67) {
  if (!(facePx > 0)) return null;
  const diag = Math.hypot(imageW, imageH);
  const focal = diag / 2 / Math.tan(((fovDeg * Math.PI) / 180) / 2);
  const d = ((faceCm / 100) * focal) / facePx;
  return d > 0.5 && d < 150 ? d : null;
}

/** Diametro del gruppo, centro, inviluppo convesso (come GroupingMetre). */
export function groupOf(points: { x: number; y: number }[]): Group | null {
  if (!points.length) return null;
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  let diameter = 0;
  for (const a of points) for (const b of points) diameter = Math.max(diameter, Math.hypot(a.x - b.x, a.y - b.y));
  const sigma = Math.sqrt(points.reduce((s, p) => s + (p.x - cx) ** 2 + (p.y - cy) ** 2, 0) / points.length);
  const meanRadius = points.reduce((s, p) => s + Math.hypot(p.x, p.y), 0) / points.length;
  return { n: points.length, cx, cy, diameter, hull: hull(points), meanRadius, sigma };
}

function hull(points: { x: number; y: number }[]) {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof p = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: typeof p = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export type Arrival = { t: number; hit: VisionHit };

/**
 * Video del bersaglio con il telefono fermo (Target-Score-Detector): confronto ogni fotogramma con
 * l'ultimo "pulito"; ciò che compare e resta fermo per due campioni è una freccia nuova.
 */
export async function readVideoArrivals(
  video: HTMLVideoElement,
  face: Face,
  opts: { step?: number; onProgress?: (k: number, found: number) => void; cancelled?: () => boolean; calib?: Calib | null } = {},
): Promise<{ arrivals: Arrival[]; calib: Calib | null; first: Pix | null }> {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return { arrivals: [], calib: null, first: null };
  const step = opts.step ?? Math.max(0.2, duration / 240);
  await seekVideo(video, 0.05);
  const w = video.videoWidth;
  const h = video.videoHeight;
  const first = pixelsOf(video, w, h);
  if (!first) return { arrivals: [], calib: null, first: null };
  const rough = opts.calib ?? findFace(first);
  const calib = opts.calib ?? (rough ? refineCalib(first, rough, face) : null);
  if (!calib) return { arrivals: [], calib: null, first };
  let reference = rectify(first, calib);
  const arrivals: Arrival[] = [];
  let pending: { t: number; key: string; hits: ReturnType<typeof readHits>["hits"] } | null = null;
  for (let t = step; t < duration; t += step) {
    if (opts.cancelled?.()) break;
    await seekVideo(video, t);
    const pix = pixelsOf(video, w, h);
    if (!pix) continue;
    const rect = rectify(pix, calib);
    const read = readHits(rect, face, { reference, known: arrivals.map((a) => ({ x: a.hit.nx, y: a.hit.ny })), max: 6 });
    const strong = read.hits.filter((hit) => hit.confidence >= 0.45);
    if (strong.length) {
      const key = strong.map((hit) => `${Math.round(hit.x * 20)}:${Math.round(hit.y * 20)}`).sort().join("|");
      if (pending && pending.key === key) {
        // stabile per due campioni: la freccia è arrivata e si è fermata
        for (const hit of pending.hits.filter((x) => x.confidence >= 0.45)) {
          const p = toImage(calib, hit.x, hit.y);
          arrivals.push({ t: pending.t, hit: { nx: hit.x, ny: hit.y, score: hit.score, isX: hit.isX, miss: hit.miss, px: p.x / pix.w, py: p.y / pix.h, kind: hit.kind, confidence: hit.confidence } });
        }
        reference = rect;
        pending = null;
      } else {
        pending = { t, key, hits: read.hits };
      }
    } else {
      pending = null;
    }
    opts.onProgress?.(Math.min(1, t / duration), arrivals.length);
  }
  return { arrivals, calib, first };
}

export function seekVideo(video: HTMLVideoElement, t: number) {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", finish);
      resolve();
    };
    video.addEventListener("seeked", finish);
    window.setTimeout(finish, 1500);
    video.currentTime = Math.min(Math.max(0, t), Math.max(0, video.duration - 0.03));
  });
}
