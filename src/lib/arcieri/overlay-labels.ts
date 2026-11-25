/**
 * Etichette sul video che non si sovrappongono: ogni etichetta prende il primo posto libero vicino
 * al punto che descrive (sotto, sopra, di lato). Si azzera a ogni fotogramma disegnato.
 */
type Box = { x: number; y: number; w: number; h: number };
let placed: Box[] = [];

export function resetLabels() {
  placed = [];
}

const hit = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** x, y: angolo in alto a sinistra desiderato; ritorna dove disegnarla davvero */
export function placeLabel(x: number, y: number, w: number, h: number, W: number, H: number): { x: number; y: number } {
  const gap = h * 0.25;
  const tries: [number, number][] = [[0, 0], [0, h + gap], [0, -(h + gap)], [0, 2 * (h + gap)], [0, -2 * (h + gap)], [-(w * 0.6), 0], [w * 0.6, 0], [0, 3 * (h + gap)]];
  let best: Box | null = null;
  for (const [dx, dy] of tries) {
    const b: Box = { x: Math.min(W - w - 2, Math.max(2, x + dx)), y: Math.min(H - h - 2, Math.max(2, y + dy)), w, h };
    if (!placed.some((p) => hit(p, b))) {
      best = b;
      break;
    }
  }
  const b = best ?? { x: Math.min(W - w - 2, Math.max(2, x)), y: Math.min(H - h - 2, Math.max(2, y)), w, h };
  placed.push(b);
  return { x: b.x, y: b.y };
}
