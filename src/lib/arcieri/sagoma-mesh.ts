import type { Geo } from "./gl3d";

/**
 * Sagoma in volume dalla foto ritagliata: dal contorno (canale alfa) calcolo la distanza dal bordo,
 * poi "gonfio" la figura con un profilo circolare proporzionato allo spessore locale (zampe sottili,
 * corpo pieno), come le sagome in schiuma vere. Fronte e retro si chiudono sul bordo.
 *
 * Coordinate: x = (0,5 − u)·2·hw (destra dell'immagine verso −x, come i tiri), y = (1 − v)·2·hh dal
 * suolo, z negativo verso chi tira. `depthAt` dà lo spessore anteriore in un punto (per piantare le
 * frecce sulla superficie).
 */
export type SagomaVolume = { geo: Geo; depthAt: (x: number, y: number) => number; skin: HTMLCanvasElement };

export function buildSagomaVolume(img: HTMLImageElement | HTMLCanvasElement, hw: number, hh: number, thickness = 0.62): SagomaVolume | null {
  if (typeof document === "undefined") return null;
  const nx = 128;
  const ny = Math.max(32, Math.min(150, Math.round((nx * hh) / hw)));
  const cols = nx + 1;
  const rows = ny + 1;
  // maschera a bassa risoluzione
  const mc = document.createElement("canvas");
  mc.width = cols;
  mc.height = rows;
  const mx = mc.getContext("2d", { willReadFrequently: true });
  if (!mx) return null;
  mx.drawImage(img, 0, 0, cols, rows);
  const alpha = mx.getImageData(0, 0, cols, rows).data;
  const inside = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i += 1) inside[i] = alpha[i * 4 + 3] > 110 ? 1 : 0;

  // distanza dal bordo (chamfer 3-4, due passate)
  const INF = 1e6;
  const d = new Float32Array(cols * rows);
  for (let i = 0; i < d.length; i += 1) d[i] = inside[i] ? INF : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= cols || y >= rows ? 0 : d[y * cols + x]);
  for (let y = 0; y < rows; y += 1)
    for (let x = 0; x < cols; x += 1) {
      const i = y * cols + x;
      if (!inside[i]) continue;
      d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
    }
  for (let y = rows - 1; y >= 0; y -= 1)
    for (let x = cols - 1; x >= 0; x -= 1) {
      const i = y * cols + x;
      if (!inside[i]) continue;
      d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
    }
  let dmax = 1;
  for (let i = 0; i < d.length; i += 1) if (d[i] > dmax) dmax = d[i];

  // spessore locale: il valore della cresta raggiunta salendo lungo la distanza
  const w = Float32Array.from(d);
  const iters = Math.ceil(dmax) + 2;
  for (let it = 0; it < iters; it += 1) {
    let changed = false;
    for (let y = 0; y < rows; y += 1)
      for (let x = 0; x < cols; x += 1) {
        const i = y * cols + x;
        if (!inside[i]) continue;
        let best = w[i];
        for (let dy = -1; dy <= 1; dy += 1)
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue;
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
            const j = yy * cols + xx;
            if (inside[j] && d[j] > d[i] && w[j] > best) best = w[j];
          }
        if (best > w[i]) {
          w[i] = best;
          changed = true;
        }
      }
    if (!changed) break;
  }

  const cellX = (2 * hw) / nx;
  const cellY = (2 * hh) / ny;
  const cell = (cellX + cellY) / 2;
  const h = new Float32Array(cols * rows);
  for (let i = 0; i < h.length; i += 1) {
    if (!inside[i]) continue;
    const di = Math.max(0, d[i] - 0.7);
    const wi = Math.max(1, w[i] - 0.7);
    h[i] = cell * thickness * Math.sqrt(Math.max(0, 2 * wi * di - di * di));
  }
  // una passata di media sui vicini: niente gradini della distanza a scacchi sul dorso
  {
    const src = Float32Array.from(h);
    for (let y = 1; y < rows - 1; y += 1)
      for (let x = 1; x < cols - 1; x += 1) {
        const i = y * cols + x;
        if (!inside[i]) continue;
        let sum = src[i] * 4;
        let wsum = 4;
        for (const j of [i - 1, i + 1, i - cols, i + cols]) {
          if (!inside[j]) continue;
          sum += src[j] * 2;
          wsum += 2;
        }
        for (const j of [i - cols - 1, i - cols + 1, i + cols - 1, i + cols + 1]) {
          if (!inside[j]) continue;
          sum += src[j];
          wsum += 1;
        }
        h[i] = sum / wsum;
      }
  }
  // bordo chiuso: dove manca un vicino lo spessore è zero
  for (let y = 0; y < rows; y += 1)
    for (let x = 0; x < cols; x += 1) {
      const i = y * cols + x;
      if (!inside[i]) continue;
      if (!inside[(y * cols + Math.max(0, x - 1))] || !inside[y * cols + Math.min(cols - 1, x + 1)] || !inside[Math.max(0, y - 1) * cols + x] || !inside[Math.min(rows - 1, y + 1) * cols + x]) h[i] = 0;
    }

  // vertici: fronte (z = −h) e retro (z = +0,85·h)
  const pos: number[] = [];
  const uv: number[] = [];
  const front = new Int32Array(cols * rows).fill(-1);
  const back = new Int32Array(cols * rows).fill(-1);
  let n = 0;
  for (const side of [front, back]) {
    for (let y = 0; y < rows; y += 1)
      for (let x = 0; x < cols; x += 1) {
        const i = y * cols + x;
        if (!inside[i]) continue;
        const u = x / nx;
        const v = y / ny;
        pos.push((0.5 - u) * 2 * hw, (1 - v) * 2 * hh, side === front ? -h[i] : h[i] * 0.85);
        uv.push(u, v);
        side[i] = n;
        n += 1;
      }
  }
  if (n > 65000 || n === 0) return null;
  const idx: number[] = [];
  for (let y = 0; y < ny; y += 1)
    for (let x = 0; x < nx; x += 1) {
      const a = y * cols + x;
      const b = a + 1;
      const c = a + cols;
      const e = c + 1;
      for (const [side, flip] of [[front, false], [back, true]] as const) {
        const tri = (p: number, q: number, r: number) => {
          if (side[p] < 0 || side[q] < 0 || side[r] < 0) return;
          if (flip) idx.push(side[p], side[r], side[q]);
          else idx.push(side[p], side[q], side[r]);
        };
        tri(a, c, b);
        tri(b, c, e);
      }
    }
  // normali dai triangoli
  const nor = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const i0 = idx[t] * 3;
    const i1 = idx[t + 1] * 3;
    const i2 = idx[t + 2] * 3;
    const ux = pos[i1] - pos[i0];
    const uy = pos[i1 + 1] - pos[i0 + 1];
    const uz = pos[i1 + 2] - pos[i0 + 2];
    const vx = pos[i2] - pos[i0];
    const vy = pos[i2 + 1] - pos[i0 + 1];
    const vz = pos[i2 + 2] - pos[i0 + 2];
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    for (const k of [i0, i1, i2]) {
      nor[k] += cx;
      nor[k + 1] += cy;
      nor[k + 2] += cz;
    }
  }
  // orientamento: il fronte guarda verso chi tira (−z); il retro, con l'ordine invertito, il contrario
  const frontCount = n / 2;
  let sumF = 0;
  for (let k = 0; k < frontCount; k += 1) sumF += nor[k * 3 + 2];
  const sF = sumF > 0 ? -1 : 1;
  for (let k = 0; k < n; k += 1) {
    const s = sF;
    const len = Math.hypot(nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]) || 1;
    nor[k * 3] = (nor[k * 3] / len) * s;
    nor[k * 3 + 1] = (nor[k * 3 + 1] / len) * s;
    nor[k * 3 + 2] = (nor[k * 3 + 2] / len) * s;
  }
  if (sF < 0) {
    // l'ordine dei vertici segue le normali
    for (let t = 0; t < idx.length; t += 3) {
      const tmp = idx[t + 1];
      idx[t + 1] = idx[t + 2];
      idx[t + 2] = tmp;
    }
  }

  const depthAt = (xw: number, yw: number) => {
    const u = 0.5 - xw / (2 * hw);
    const v = 1 - yw / (2 * hh);
    const fx = Math.max(0, Math.min(nx, u * nx));
    const fy = Math.max(0, Math.min(ny, v * ny));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(nx, x0 + 1);
    const y1 = Math.min(ny, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const H = (x: number, y: number) => h[y * cols + x];
    return (H(x0, y0) * (1 - tx) + H(x1, y0) * tx) * (1 - ty) + (H(x0, y1) * (1 - tx) + H(x1, y1) * tx) * ty;
  };

  return { geo: { pos: new Float32Array(pos), nor, uv: new Float32Array(uv), idx: new Uint16Array(idx) }, depthAt, skin: bleed(img) };
}

/** Copia dell'immagine con i colori del bordo allargati: niente frange scure sui contorni del volume. */
export function bleed(img: HTMLImageElement | HTMLCanvasElement) {
  const w = (img as HTMLImageElement).naturalWidth || img.width;
  const h = (img as HTMLImageElement).naturalHeight || img.height;
  const scale = Math.min(1, 1024 / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const x = c.getContext("2d");
  if (!x) return c;
  for (const r of [6, 3]) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) x.drawImage(img, dx, dy, c.width, c.height);
  x.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

type Ellipse = { cx: number; cy: number; rx: number; ry: number };

/** rumore a valori con interpolazione morbida (deterministico): la grana della schiuma */
function noise2(seed: number) {
  const hash = (x: number, y: number) => {
    let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * sx;
    const b = hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

/**
 * La pelle della sagoma come una vera in schiuma dipinta: colore dell'animale con grana e pelo,
 * i tratti chiari del disegno diventano solchi scuri, ventre in ombra, e le zone di punteggio
 * appena incise (come sulle sagome da gara).
 */
export function foamSkin(img: HTMLImageElement | HTMLCanvasElement, tone: string, zones: Ellipse[] = [], width = 1024): HTMLCanvasElement {
  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;
  const W = width;
  const H = Math.max(1, Math.round((W * ih) / Math.max(1, iw)));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true });
  if (!x) return c;
  x.drawImage(img, 0, 0, W, H);
  const data = x.getImageData(0, 0, W, H);
  const px = data.data;
  const base = [parseInt(tone.slice(1, 3), 16), parseInt(tone.slice(3, 5), 16), parseInt(tone.slice(5, 7), 16)];
  const n1 = noise2(7);
  const n2 = noise2(19);
  for (let y = 0; y < H; y += 1) {
    const belly = 1.08 - 0.3 * (y / H);
    for (let xx = 0; xx < W; xx += 1) {
      const i = (y * W + xx) * 4;
      if (px[i + 3] < 8) continue;
      // le zone colorate del disegno (blu, giallo, rosso) non sono solchi: diventano pelle, le zone le incido dopo
      const sat = Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]);
      const lum = sat > 60 ? 0 : (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255;
      // grana: macchie larghe e puntinato fine
      const grain = 0.86 + 0.2 * n1(xx / 38, y / 38) + 0.1 * n2(xx / 3.2, y / 3.2);
      // pelo: striature orizzontali leggere
      const fur = 0.94 + 0.12 * n2(xx / 14, y / 2.2);
      const k = grain * fur * belly;
      const groove = Math.min(1, Math.max(0, (lum - 0.25) / 0.5));
      const shade = k * (1 - groove * 0.62);
      px[i] = Math.min(255, base[0] * shade);
      px[i + 1] = Math.min(255, base[1] * shade);
      px[i + 2] = Math.min(255, base[2] * shade);
    }
  }
  x.putImageData(data, 0, 0);
  // zone di punteggio incise appena
  x.globalCompositeOperation = "source-atop";
  x.lineWidth = Math.max(1.5, W / 420);
  for (const z of zones) {
    x.strokeStyle = "rgba(18,12,8,0.42)";
    x.beginPath();
    x.ellipse(z.cx * W, z.cy * H, z.rx * W, z.ry * H, 0, 0, Math.PI * 2);
    x.stroke();
    x.strokeStyle = "rgba(255,240,220,0.12)";
    x.beginPath();
    x.ellipse(z.cx * W + 1, z.cy * H + 1.5, z.rx * W, z.ry * H, 0, 0, Math.PI * 2);
    x.stroke();
  }
  x.globalCompositeOperation = "source-over";
  return c;
}
