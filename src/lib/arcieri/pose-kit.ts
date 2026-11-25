import { facePoint, handPoint, sides, type Gear, type Hand, type Landmark } from "./pose-analysis";

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
  // con le mani rilevate (21 punti ciascuna) presa e cocca sono molto più precise:
  // impugnatura tra polso e nocca del medio, corda nella prima falange di indice e medio
  const px2 = (p: Landmark) => ({ x: p.x * w, y: p.y * h });
  const bowWristId = sd.bow[2] as 15 | 16;
  const drawWristId = sd.draw[2] as 15 | 16;
  const hb0 = handPoint(lm, bowWristId, 0);
  const hb9 = handPoint(lm, bowWristId, 9);
  const hd6 = handPoint(lm, drawWristId, 6);
  const hd10 = handPoint(lm, drawWristId, 10);
  const grip = hb0 && hb9
    ? { x: (px2(hb0).x + px2(hb9).x * 2) / 3, y: (px2(hb0).y + px2(hb9).y * 2) / 3 }
    : ok(bowFinger) ? { x: (P(sd.bow[2]).x * 2 + P(bowFinger).x) / 3, y: (P(sd.bow[2]).y * 2 + P(bowFinger).y) / 3 } : P(sd.bow[2]);
  const nock = hd6 && hd10
    ? { x: (px2(hd6).x + px2(hd10).x) / 2, y: (px2(hd6).y + px2(hd10).y) / 2 }
    : ok(sd.drawFinger) ? { x: (P(sd.draw[2]).x + P(sd.drawFinger).x * 2) / 3, y: (P(sd.draw[2]).y + P(sd.drawFinger).y * 2) / 3 } : P(sd.draw[2]);
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
  // bocca: angolo della bocca dal lato della corda (viso rilevato), altrimenti il centro della bocca
  // un punto del viso vale solo se sta sulla testa (entro 20 cm dal naso): un viso letto male
  // dava ancoraggi di chilometri
  const onHead = (p: { x: number; y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y) && (!ok(0) || Math.hypot(p.x - P(0).x, p.y - P(0).y) < 0.2 * px);
  const lipRaw = facePoint(lm, hand === "destro" ? 61 : 291);
  const lipD = lipRaw && onHead(px2(lipRaw)) ? lipRaw : null;
  const mouthAt = lipD ? px2(lipD) : ok(9, 10) ? { x: (P(9).x + P(10).x) / 2, y: (P(9).y + P(10).y) / 2 } : null;
  const anchorD = mouthAt ? cm(Math.hypot(nock.x - mouthAt.x, nock.y - mouthAt.y)) : Infinity;
  // oltre mezzo metro la mano non è al viso: niente misura dell'ancoraggio
  if (mouthAt && anchorD < 50) {
    const mouth = mouthAt;
    const d = anchorD;
    const below = cm(nock.y - mouth.y);
    nums.anchorCm = d;
    nums.anchorBelowCm = below;
    measures.push(`Ancoraggio: dita a ${d.toFixed(0)} cm dalla bocca${Math.abs(below) > 1 ? ` (${below > 0 ? "sotto" : "sopra"} ${Math.abs(below).toFixed(0)})` : ""}`);
  }
  const eyeId = hand === "destro" ? 5 : 2; // occhio dal lato della corda
  const eyeF = facePoint(lm, hand === "destro" ? 468 : 473) ?? (() => {
    const a = facePoint(lm, hand === "destro" ? 33 : 362);
    const b = facePoint(lm, hand === "destro" ? 133 : 263);
    return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
  })();
  const eyeOk = eyeF && onHead(px2(eyeF)) ? eyeF : null;
  const eyeOff = eyeOk || ok(eyeId) ? cm(Math.abs(((eyeOk ? px2(eyeOk) : P(eyeId)).x - nock.x) * -u.y + ((eyeOk ? px2(eyeOk) : P(eyeId)).y - nock.y) * u.x)) : Infinity;
  if (eyeOff < 40) {
    const off = eyeOff;
    nums.eyeArrowCm = off;
    measures.push(`Occhio–freccia ${off.toFixed(1)} cm`);
  }
  const noseRaw = facePoint(lm, 1);
  const noseF = noseRaw && onHead(px2(noseRaw)) ? noseRaw : null;
  if ((noseF || ok(0)) && drawn) {
    const nose = noseF ? px2(noseF) : P(0);
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

