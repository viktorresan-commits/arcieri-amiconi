/**
 * Stemmi scontornati: lo sfondo pieno attorno al logo (bianco, colorato, a volte con la grana del JPEG) diventa
 * trasparente, partendo dai bordi dell'immagine e allargandosi sui punti dello stesso colore. Il bordo del logo
 * resta morbido (trasparenza parziale e colore ripulito dallo sfondo), poi si taglia il margine vuoto.
 * Uno sfondo non uniforme (una foto) non si tocca.
 */

type RGB = [number, number, number];

type Bg = { c: RGB; tol: number };

/**
 * I colori dello sfondo, presi dal bordo dell'immagine: fino a tre (lo sfondo a scacchi grigio e bianco delle
 * finte trasparenze, due toni, una sfumatura leggera), ognuno con la sua tolleranza. Servono almeno metà del
 * bordo pieno di questi colori; un bordo quasi tutto trasparente vuol dire stemma già scontornato.
 */
function borderPalette(d: Uint8ClampedArray, w: number, h: number): Bg[] | null {
  const idx: number[] = [];
  for (let x = 0; x < w; x++) idx.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) idx.push(y * w, y * w + w - 1);
  let transparent = 0;
  const buckets = new Map<number, number[]>();
  for (const i of idx) {
    const o = i * 4;
    if (d[o + 3] < 40) {
      transparent++;
      continue;
    }
    const key = ((d[o] >> 4) << 8) | ((d[o + 1] >> 4) << 4) | (d[o + 2] >> 4);
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }
  const opaque = idx.length - transparent;
  if (transparent > idx.length * 0.6 || opaque < 8) return null;
  const near = (a: number, b: number) => Math.abs((a >> 8) - (b >> 8)) <= 1 && Math.abs(((a >> 4) & 15) - ((b >> 4) & 15)) <= 1 && Math.abs((a & 15) - (b & 15)) <= 1;
  const left = new Map(buckets);
  const out: Bg[] = [];
  let covered = 0;
  while (out.length < 3 && left.size) {
    // il gruppo più numeroso con i suoi vicini (la grana del JPEG sparge un colore su più gruppi)
    let bestKey = -1;
    let bestN = 0;
    for (const [key] of left) {
      let n = 0;
      for (const [k2, l2] of left) if (k2 === key || near(k2, key)) n += l2.length;
      if (n > bestN) {
        bestN = n;
        bestKey = key;
      }
    }
    if (bestKey < 0 || bestN < opaque * 0.1) break;
    const members: number[] = [];
    for (const [k2, l2] of [...left]) {
      if (k2 === bestKey || near(k2, bestKey)) {
        members.push(...l2);
        left.delete(k2);
      }
    }
    let sr = 0, sg = 0, sb = 0;
    for (const i of members) {
      sr += d[i * 4];
      sg += d[i * 4 + 1];
      sb += d[i * 4 + 2];
    }
    const c: RGB = [sr / members.length, sg / members.length, sb / members.length];
    let v = 0;
    for (const i of members) v += dist(d, i, c) ** 2;
    const std = Math.sqrt(v / members.length);
    out.push({ c, tol: Math.max(26, Math.min(60, std * 3 + 14)) });
    covered += members.length;
  }
  return out.length && covered >= opaque * 0.5 ? out : null;
}

function dist(d: Uint8ClampedArray, i: number, c: RGB) {
  const o = i * 4;
  return Math.hypot(d[o] - c[0], d[o + 1] - c[1], d[o + 2] - c[2]);
}

/** il colore dello sfondo più vicino a un punto e quanto è lontano (rispetto alla sua tolleranza) */
function nearestBg(d: Uint8ClampedArray, i: number, pal: Bg[]) {
  let best = pal[0];
  let bd = Infinity;
  for (const p of pal) {
    const dd = dist(d, i, p.c) / p.tol;
    if (dd < bd) {
      bd = dd;
      best = p;
    }
  }
  return { bg: best, r: bd };
}

/**
 * Scontorna il disegno sulla tela (in place) e torna i margini del logo rimasto, o null se lo sfondo non
 * era pieno (niente da fare).
 */
export function cutoutCanvas(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number; removed: number } | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width: w, height: h } = canvas;
  if (w < 8 || h < 8) return null;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const pal = borderPalette(d, w, h);
  if (!pal) return null;
  // riempimento dai bordi: 1 = sfondo
  const mask = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qh = 0, qt = 0;
  const seed = (i: number) => {
    if (mask[i]) return;
    // già trasparente o del colore dello sfondo: è sfondo
    if (d[i * 4 + 3] < 40 || nearestBg(d, i, pal).r <= 1) {
      mask[i] = 1;
      queue[qt++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (y > 0) seed(i - w);
    if (y < h - 1) seed(i + w);
  }
  let removed = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    d[i * 4 + 3] = 0;
    removed++;
  }
  if (removed < w * h * 0.03) return null;
  // bordo morbido: i punti del logo accanto allo sfondo, quasi del suo colore, diventano in parte trasparenti
  // e perdono l'alone dello sfondo
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i]) continue;
      const nb = (x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w]);
      if (!nb) continue;
      const { bg, r } = nearestBg(d, i, pal);
      if (r >= 1.7) continue;
      const a = Math.max(0.15, Math.min(1, (r - 0.5) / 1.2));
      const o = i * 4;
      for (let c = 0; c < 3; c++) d[o + c] = Math.max(0, Math.min(255, (d[o + c] - bg.c[c] * (1 - a)) / a));
      d[o + 3] = Math.round(d[o + 3] * a);
    }
  }
  ctx.putImageData(img, 0, 0);
  // margini del logo rimasto
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const pad = 2;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, removed: removed / (w * h) };
}

/**
 * Un'immagine (file, data URL o indirizzo dello stesso sito) pronta da salvare come stemma: scontornata se
 * lo sfondo era pieno, tagliata ai margini, al massimo `max` punti di lato. PNG (con la trasparenza); se
 * pesa troppo WebP, che la tiene anche lui.
 */
export async function logoDataUrl(src: Blob | string, max = 320): Promise<{ dataUrl: string; cut: boolean }> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Immagine non letta"));
      im.src = url;
    });
    // si scontorna a una misura media (bordi più precisi), poi si rimpicciolisce
    const work = Math.min(1, 640 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * work));
    c.height = Math.max(1, Math.round(img.height * work));
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas non disponibile");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const box = cutoutCanvas(c) ?? { x: 0, y: 0, w: c.width, h: c.height, removed: 0 };
    const scale = Math.min(1, max / Math.max(box.w, box.h));
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(box.w * scale));
    out.height = Math.max(1, Math.round(box.h * scale));
    const octx = out.getContext("2d");
    if (!octx) throw new Error("Canvas non disponibile");
    octx.imageSmoothingQuality = "high";
    octx.drawImage(c, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
    const png = out.toDataURL("image/png");
    if (png.length < 170_000) return { dataUrl: png, cut: box.removed > 0 };
    const webp = out.toDataURL("image/webp", 0.9);
    if (webp.startsWith("data:image/webp") && webp.length < 170_000) return { dataUrl: webp, cut: box.removed > 0 };
    return { dataUrl: out.toDataURL("image/jpeg", 0.85), cut: false };
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}
