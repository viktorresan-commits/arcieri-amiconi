import { sides, type Gear, type Hand, type Landmark } from "./pose-analysis";

/** Misure dell'arciere in centimetri (stime da una ripresa 2D, ±3 cm). */
export type KitNums = { drawCm: number; anchorCm: number | null; anchorBelowCm: number | null; eyeArrowCm: number | null; stringNoseCm: number | null };

/**
 * Arco, corda e freccia ricostruiti dal corpo: impugnatura alla mano dell'arco, cocca alle dita della
 * corda, scala in pixel per metro da spalle, busto e altezza, arco da 1,70 m.
 * Dà anche le misure in cm: allungo, ancoraggio (dita–bocca), occhio–freccia, corda–naso.
 */
export function archeryKit(lm: Landmark[], w: number, h: number, hand: Hand, gear: Gear | null, bowM = 1.7) {
  const ok = (...ids: number[]) => ids.every((i) => lm[i] && (lm[i].visibility ?? 1) > 0.3);
  const P = (i: number) => ({ x: lm[i].x * w, y: lm[i].y * h });
  const sd = sides(hand);
  if (!ok(sd.bow[2], sd.draw[2], 11, 12)) return null;
  // pixel per metro: mediana delle stime disponibili (spalle, busto, spalla–caviglia), perché
  // ognuna sbaglia quando quella parte è di scorcio
  const mid2 = (a: number, b: number, c: number, d: number) => ({ x: (P(a).x + P(b).x) / 2 - (P(c).x + P(d).x) / 2, y: (P(a).y + P(b).y) / 2 - (P(c).y + P(d).y) / 2 });
  const est: number[] = [Math.hypot(P(11).x - P(12).x, P(11).y - P(12).y) / 0.36];
  if (ok(23, 24)) {
    const t = mid2(11, 12, 23, 24);
    est.push(Math.hypot(t.x, t.y) / 0.5);
  }
  if (ok(23, 24, 27, 28)) {
    const t = mid2(11, 12, 27, 28);
    est.push(Math.hypot(t.x, t.y) / 1.38);
  }
  est.sort((a, b) => a - b);
  const px = Math.max(1, est.length === 2 ? Math.max(...est) : est[est.length >> 1]);
  const bowFinger = sd.bow[2] + 4; // 15 → 19, 16 → 20
  const grip = ok(bowFinger) ? { x: (P(sd.bow[2]).x * 2 + P(bowFinger).x) / 3, y: (P(sd.bow[2]).y * 2 + P(bowFinger).y) / 3 } : P(sd.bow[2]);
  const nock = ok(sd.drawFinger) ? { x: (P(sd.draw[2]).x + P(sd.drawFinger).x * 2) / 3, y: (P(sd.draw[2]).y + P(sd.drawFinger).y * 2) / 3 } : P(sd.draw[2]);
  const span = Math.hypot(grip.x - nock.x, grip.y - nock.y);
  if (span < 4) return null;
  const u = { x: (grip.x - nock.x) / span, y: (grip.y - nock.y) / span };
  let n = { x: -u.y, y: u.x };
  if (n.y > 0) n = { x: -n.x, y: -n.y }; // verso l'alto
  // inclinazione dell'arco vista nella foto (se trovata), altrimenti perpendicolare alla freccia
  if (gear?.bow) {
    const a = (gear.bow.cant * Math.PI) / 180;
    n = { x: n.x * Math.cos(a) - n.y * Math.sin(a), y: n.x * Math.sin(a) + n.y * Math.cos(a) };
  }
  const drawLenM = span / px + 0.044;
  const drawn = drawLenM > 0.45;
  const half = (bowM / 2) * px;
  const depth = (drawn ? 0.17 : 0.09) * bowM * px; // le punte vanno verso l'arciere quando l'arco è aperto
  const at = (along: number, back: number) => ({ x: grip.x + n.x * along - u.x * back, y: grip.y + n.y * along - u.y * back });
  const tipUp = at(half * 0.9, depth);
  const tipDown = at(-half * 0.9, depth);
  const recUp = at(half, depth * 0.72);
  const recDown = at(-half, depth * 0.72);
  const ctrlUp = at(half * 0.55, depth * 0.05);
  const ctrlDown = at(-half * 0.55, depth * 0.05);
  const arrowTip = { x: grip.x + u.x * 0.05 * px, y: grip.y + u.y * 0.05 * px };
  const cm = (d: number) => (d / px) * 100;
  const measures = [`Allungo ≈ ${(drawLenM * 100).toFixed(0)} cm (${(drawLenM / 0.0254).toFixed(1)}″)`];
  // le stesse misure come numeri, per salvarle e per le statistiche
  const nums: KitNums = { drawCm: drawLenM * 100, anchorCm: null, anchorBelowCm: null, eyeArrowCm: null, stringNoseCm: null };
  if (ok(9, 10)) {
    const mouth = { x: (P(9).x + P(10).x) / 2, y: (P(9).y + P(10).y) / 2 };
    const d = cm(Math.hypot(nock.x - mouth.x, nock.y - mouth.y));
    const below = cm(nock.y - mouth.y);
    nums.anchorCm = d;
    nums.anchorBelowCm = below;
    measures.push(`Ancoraggio: dita a ${d.toFixed(0)} cm dalla bocca${Math.abs(below) > 1 ? ` (${below > 0 ? "sotto" : "sopra"} ${Math.abs(below).toFixed(0)})` : ""}`);
  }
  const eyeId = hand === "destro" ? 5 : 2; // occhio dal lato della corda
  if (ok(eyeId)) {
    const e = P(eyeId);
    const off = cm(Math.abs((e.x - nock.x) * -u.y + (e.y - nock.y) * u.x));
    nums.eyeArrowCm = off;
    measures.push(`Occhio–freccia ${off.toFixed(1)} cm`);
  }
  if (ok(0) && drawn) {
    const nose = P(0);
    // distanza del naso dal tratto di corda fra cocca e punta alta
    const sx = tipUp.x - nock.x;
    const sy = tipUp.y - nock.y;
    const t = Math.max(0, Math.min(1, ((nose.x - nock.x) * sx + (nose.y - nock.y) * sy) / (sx * sx + sy * sy || 1)));
    const d = cm(Math.hypot(nose.x - (nock.x + sx * t), nose.y - (nock.y + sy * t)));
    nums.stringNoseCm = d;
    measures.push(`Corda–naso ${d.toFixed(1)} cm${d < 1.5 ? " (tocca)" : ""}`);
  }
  return { grip, nock, u, n, tipUp, tipDown, recUp, recDown, ctrlUp, ctrlDown, arrowTip, drawn, px, drawLenM, measures, nums };
}

