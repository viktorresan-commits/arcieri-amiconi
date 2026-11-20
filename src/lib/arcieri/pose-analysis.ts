/**
 * Analisi del gesto: dai punti del corpo (MediaPipe Pose, coordinate 0..1) alle misure del tiro.
 *
 * Tutte le distanze e gli angoli si calcolano in pixel veri (x moltiplicata per larghezza/altezza):
 * un video verticale altrimenti allunga gli angoli. Funziona anche a mezzo busto: anche, ginocchia
 * e piedi servono solo per busto e piedi, che restano vuoti se non si vedono.
 *
 * Fasi di un tiro (idee da archery-posture-ai, rese più esplicite):
 * alzata → trazione → ancoraggio (mano al viso, ferma) → rilascio (scatto del polso) → accompagnamento.
 */

export type Landmark = { x: number; y: number; visibility?: number };
export type Hand = "destro" | "mancino";

export type Metrics = {
  /** angolo al gomito della corda (spalla-gomito-polso) */
  draw: number;
  /** angolo al gomito dell'arco */
  bow: number;
  /** inclinazione della linea delle spalle, gradi (+ = spalla dell'arco più alta) */
  shoulder: number;
  /** inclinazione del busto rispetto alla verticale; null se le anche non si vedono */
  trunk: number | null;
  /** allineamento gomito della corda con la freccia: 180 = in linea */
  line: number;
  /** spalla dell'arco: braccio in linea con le spalle = 180 */
  bowSh: number;
  /** spalla della corda: gomito in linea con le spalle = 180 */
  drawSh: number;
  /** larghezza dei piedi in "spalle"; null se i piedi non si vedono */
  stance: number | null;
  /** inclinazione della linea mano-mano (la freccia), + = punta in su */
  arrowTilt: number;
  /** distanza mano della corda – bocca, in larghezze di spalle */
  handFace: number;
  /** distanza tra le mani, in larghezze di spalle */
  spread: number;
  /** braccio dell'arco all'altezza della spalla */
  bowUp: boolean;
  /** larghezza delle spalle in pixel */
  shoulderPx: number;
  /** polsi in pixel del fotogramma */
  drawPx: { x: number; y: number };
  bowPx: { x: number; y: number };
};

export type Sample = { t: number; lm: Landmark[] | null; m: Metrics | null };

export type PhaseName = "alzata" | "trazione" | "ancoraggio" | "accompagnamento";
export type Phase = { name: PhaseName; from: number; to: number };
export type Check = { ok: boolean; warn?: boolean; text: string };
export type Part = { label: string; value: number };

export type Shot = {
  phases: Phase[];
  anchorFrom: number;
  anchorTo: number;
  release: number | null;
  drawTime: number | null;
  anchorTime: number;
  at: Metrics;
  jitter: number;
  creep: number;
  follow: number | null;
  score: number;
  parts: Part[];
  checks: Check[];
  notes: string[];
  anchored: boolean;
};

export type Analysis = { shots: Shot[]; spread: { draw: number; anchor: number; line: number } | null };

export const PHASE_COLORS: Record<PhaseName, string> = {
  alzata: "#7ec8e3",
  trazione: "#c084fc",
  ancoraggio: "#e6b325",
  accompagnamento: "#3d9b74",
};

export const PHASE_LABEL: Record<PhaseName, string> = {
  alzata: "Alzata",
  trazione: "Trazione",
  ancoraggio: "Ancoraggio",
  accompagnamento: "Accompagnamento",
};

export function sides(hand: Hand) {
  // MediaPipe: 11/13/15 = lato sinistro della persona. Il destro tiene l'arco con la sinistra.
  return hand === "destro"
    ? { bow: [11, 13, 15], draw: [12, 14, 16], hipBow: 23, hipDraw: 24, drawFinger: 20 }
    : { bow: [12, 14, 16], draw: [11, 13, 15], hipBow: 24, hipDraw: 23, drawFinger: 19 };
}

const vis = (p: Landmark | undefined) => (p ? (p.visibility ?? 1) : 0);

/** Misure di un fotogramma. aspect = larghezza/altezza del video; widthPx per la larghezza spalle in pixel. */
export function metricsOf(lm: Landmark[], hand: Hand, aspect: number, heightPx = 1000): Metrics | null {
  if (lm.length < 25) return null;
  const s = sides(hand);
  const P = (i: number) => ({ x: lm[i].x * aspect, y: lm[i].y });
  if (![11, 12, 13, 14, 15, 16].every((i) => vis(lm[i]) > 0.3)) return null;
  const w = Math.hypot(P(11).x - P(12).x, P(11).y - P(12).y) || 1e-3;
  const drawAngle = joint(P(s.draw[0]), P(s.draw[1]), P(s.draw[2]));
  const bowAngle = joint(P(s.bow[0]), P(s.bow[1]), P(s.bow[2]));
  // spalle: + quando la spalla dell'arco è più alta
  const bs = P(s.bow[0]);
  const ds = P(s.draw[0]);
  let sh = (Math.atan2(ds.y - bs.y, Math.abs(ds.x - bs.x)) * 180) / Math.PI;
  if (!Number.isFinite(sh)) sh = 0;
  const hipsSeen = vis(lm[23]) > 0.5 && vis(lm[24]) > 0.5 && lm[23].y < 1.02 && lm[24].y < 1.02;
  let trunk: number | null = null;
  if (hipsSeen) {
    const ms = { x: (P(11).x + P(12).x) / 2, y: (P(11).y + P(12).y) / 2 };
    const mh = { x: (P(23).x + P(24).x) / 2, y: (P(23).y + P(24).y) / 2 };
    trunk = (Math.atan2(ms.x - mh.x, mh.y - ms.y) * 180) / Math.PI;
  }
  const line = joint(P(s.bow[2]), P(s.draw[2]), P(s.draw[1]));
  const bowSh = joint(ds, bs, P(s.bow[1]));
  const drawSh = joint(bs, ds, P(s.draw[1]));
  const feetSeen = vis(lm[27]) > 0.5 && vis(lm[28]) > 0.5 && lm[27].y < 1.02 && lm[28].y < 1.02;
  const stance = feetSeen ? Math.hypot(P(27).x - P(28).x, P(27).y - P(28).y) / w : null;
  const bw = P(s.bow[2]);
  const dw = P(s.draw[2]);
  const tilt = (Math.atan2(dw.y - bw.y, Math.abs(bw.x - dw.x)) * 180) / Math.PI;
  const finger = vis(lm[s.drawFinger]) > 0.4 ? P(s.drawFinger) : dw;
  const mouth = vis(lm[9]) > 0.3 && vis(lm[10]) > 0.3 ? { x: (P(9).x + P(10).x) / 2, y: (P(9).y + P(10).y) / 2 } : P(0);
  const handFace = Math.min(Math.hypot(finger.x - mouth.x, finger.y - mouth.y), Math.hypot(dw.x - mouth.x, dw.y - mouth.y)) / w;
  const spread = Math.hypot(bw.x - dw.x, bw.y - dw.y) / w;
  const bowUp = Math.abs(bw.y - bs.y) < 0.75 * w && bowAngle > 120;
  return {
    draw: drawAngle,
    bow: bowAngle,
    shoulder: sh,
    trunk,
    line,
    bowSh,
    drawSh,
    stance,
    arrowTilt: tilt,
    handFace,
    spread,
    bowUp,
    shoulderPx: w * heightPx,
    drawPx: { x: dw.x * heightPx, y: dw.y * heightPx },
    bowPx: { x: bw.x * heightPx, y: bw.y * heightPx },
  };
}

export function notesFor(m: Metrics): string[] {
  const out: string[] = [];
  out.push(m.bow < 160 ? "Il braccio dell'arco è piegato: distendilo senza alzare la spalla." : "Braccio dell'arco disteso.");
  out.push(
    m.line < 160
      ? `Il gomito della corda esce di ${(180 - m.line).toFixed(0)}° dalla linea della freccia: portalo dietro, in linea.`
      : "Gomito della corda in linea con la freccia.",
  );
  if (Math.abs(m.shoulder) > 8) out.push(`Spalle non in piano (${Math.abs(m.shoulder).toFixed(0)}°): ${m.shoulder > 0 ? "la spalla dell'arco sale" : "la spalla della corda sale"}.`);
  if (m.bowSh < 160) out.push("La spalla dell'arco si alza o si chiude: tienila bassa e il braccio in linea con le spalle.");
  if (m.trunk != null && Math.abs(m.trunk) > 8) out.push(`Il busto pende di ${Math.abs(m.trunk).toFixed(0)}°: resta più verticale.`);
  return out;
}

const ramp = (v: number, bad: number, good: number) => Math.max(0, Math.min(1, (v - bad) / (good - bad)));

/**
 * Trova i tiri. L'ancoraggio è la mano della corda vicina alla bocca, mani lontane, braccio
 * dell'arco su, mano quasi ferma. Il rilascio è lo scatto della mano subito dopo; prima si
 * cercano l'alzata e la trazione, dopo l'accompagnamento.
 */
export function analyzeShots(samples: Sample[], hand: Hand): Analysis {
  const valid = samples.filter((s): s is Sample & { m: Metrics; lm: Landmark[] } => Boolean(s.m && s.lm));
  if (valid.length < 6) return { shots: [], spread: null };
  const n = valid.length;
  // una sola scala per tutto il video (larghezza spalle mediana): più stabile se l'arciere ruota
  const scale = median(valid.map((v) => v.m.shoulderPx)) || 1;
  // velocità della mano della corda, in spalle al secondo
  const speed: number[] = [0];
  for (let i = 1; i < n; i += 1) {
    const a = valid[i - 1].m.drawPx;
    const b = valid[i].m.drawPx;
    const dt = Math.max(1e-3, valid[i].t - valid[i - 1].t);
    speed.push(Math.hypot(b.x - a.x, b.y - a.y) / scale / dt);
  }
  const anchorOk = (i: number) => {
    const m = valid[i].m;
    return m.handFace < 0.85 && m.spread > 1.1 && m.bowUp && speed[i] < 1.2;
  };
  const runs: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= n; i += 1) {
    const ok = i < n && (anchorOk(i) || (start >= 0 && i + 1 < n && anchorOk(i + 1)));
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      if (valid[i - 1].t - valid[start].t >= 0.3) runs.push([start, i - 1]);
      start = -1;
    }
  }
  // ripiego (viso coperto o di schiena): tenuta = mani lontane, braccio su, mano ferma
  let anchored = true;
  if (!runs.length) {
    anchored = false;
    start = -1;
    const holdOk = (i: number) => valid[i].m.spread > 1.3 && valid[i].m.bowUp && speed[i] < 0.9;
    for (let i = 0; i <= n; i += 1) {
      const ok = i < n && holdOk(i);
      if (ok && start < 0) start = i;
      if (!ok && start >= 0) {
        if (valid[i - 1].t - valid[start].t >= 0.4) runs.push([start, i - 1]);
        start = -1;
      }
    }
  }
  // una tenuta subito dopo un'altra (meno di 1,5 s) è l'accompagnamento, non un nuovo tiro
  const kept: [number, number][] = [];
  for (const r of runs) {
    const prev = kept[kept.length - 1];
    if (prev && valid[r[0]].t - valid[prev[1]].t < 1.5) continue;
    kept.push(r);
  }

  const shots: Shot[] = [];
  let floor = 0; // le fasi di un tiro non tornano dentro il tiro precedente
  for (const [a, b] of kept) {
    const endT = valid[b].t;
    // rilascio: primo scatto veloce entro mezzo secondo, con la mano che si allontana dall'arco
    let rel: number | null = null;
    for (let i = b; i < n && valid[i].t <= endT + 0.6; i += 1) {
      if (speed[i] > 1.6 && i > 0 && valid[i].m.spread >= valid[i - 1].m.spread - 0.05) {
        rel = i;
        break;
      }
    }
    const letDown = rel == null && valid.some((v) => v.t > endT && v.t < endT + 1.2 && v.m.spread < valid[b].m.spread - 0.5);
    // indietro: trazione (mani che si allontanano) e alzata (braccio su)
    let drawFrom = a;
    while (drawFrom > floor && valid[a].t - valid[drawFrom - 1].t < 4 && valid[drawFrom - 1].m.spread < valid[drawFrom].m.spread + 0.05 && valid[drawFrom - 1].m.spread > 0.25) drawFrom -= 1;
    let liftFrom = drawFrom;
    while (liftFrom > floor && valid[drawFrom].t - valid[liftFrom - 1].t < 5 && valid[liftFrom - 1].m.bowUp) liftFrom -= 1;
    // avanti: accompagnamento finché il braccio dell'arco resta su (max 2 s)
    let followTo = rel ?? b;
    if (rel != null) while (followTo + 1 < n && valid[followTo + 1].t - valid[rel].t < 2 && valid[followTo + 1].m.bowUp) followTo += 1;
    floor = followTo + 1;

    const hold = valid.slice(a, b + 1);
    const mean = (pick: (m: Metrics) => number) => hold.reduce((acc, v) => acc + pick(v.m), 0) / hold.length;
    const meanN = (pick: (m: Metrics) => number | null) => {
      const list = hold.map((v) => pick(v.m)).filter((x): x is number => x != null);
      return list.length ? list.reduce((p, q) => p + q, 0) / list.length : null;
    };
    const at: Metrics = {
      draw: mean((m) => m.draw),
      bow: mean((m) => m.bow),
      shoulder: mean((m) => m.shoulder),
      trunk: meanN((m) => m.trunk),
      line: mean((m) => m.line),
      bowSh: mean((m) => m.bowSh),
      drawSh: mean((m) => m.drawSh),
      stance: meanN((m) => m.stance),
      arrowTilt: mean((m) => m.arrowTilt),
      handFace: mean((m) => m.handFace),
      spread: mean((m) => m.spread),
      bowUp: true,
      shoulderPx: mean((m) => m.shoulderPx),
      drawPx: hold[hold.length - 1].m.drawPx,
      bowPx: hold[hold.length - 1].m.bowPx,
    };
    // stabilità della mano dell'arco in tenuta, in % della larghezza spalle
    const bx = hold.map((v) => v.m.bowPx.x / scale);
    const by = hold.map((v) => v.m.bowPx.y / scale);
    const jitter = Math.sqrt(variance(bx) + variance(by)) * 100;
    // "creeping": la mano torna avanti prima di sganciare
    const maxSpread = Math.max(...hold.map((v) => v.m.spread));
    const creep = Math.max(0, maxSpread - valid[b].m.spread);
    let follow: number | null = null;
    if (rel != null) {
      const r0 = valid[rel];
      const after = valid.filter((v) => v.t > r0.t && v.t <= r0.t + 0.6);
      if (after.length) follow = Math.max(...after.map((v) => (v.m.bowPx.y - r0.m.bowPx.y) / scale));
    }
    const anchorTime = (rel != null ? valid[rel].t : endT) - valid[a].t;
    const drawTime = drawFrom < a ? valid[a].t - valid[drawFrom].t : null;
    const phases: Phase[] = [];
    if (liftFrom < drawFrom) phases.push({ name: "alzata", from: valid[liftFrom].t, to: valid[drawFrom].t });
    if (drawFrom < a) phases.push({ name: "trazione", from: valid[drawFrom].t, to: valid[a].t });
    phases.push({ name: "ancoraggio", from: valid[a].t, to: rel != null ? valid[rel].t : endT });
    if (rel != null && followTo > rel) phases.push({ name: "accompagnamento", from: valid[rel].t, to: valid[followTo].t });

    const checks: Check[] = [
      { ok: liftFrom < drawFrom, text: "Braccio dell'arco su prima di tirare la corda" },
      { ok: anchored, text: anchored ? "Ancoraggio al viso raggiunto" : "Ancoraggio al viso non visto (il viso si vede?)" },
      { ok: anchorTime >= 1 && anchorTime <= 6, warn: anchorTime < 1 || anchorTime > 6, text: `Tempo di ancoraggio ${anchorTime.toFixed(1)} s ${anchorTime < 1 ? "(corto)" : anchorTime > 6 ? "(lungo)" : "(buono, 1–6 s)"}` },
      { ok: creep < 0.12, warn: creep >= 0.12, text: creep < 0.12 ? "Nessun ritorno in avanti prima del rilascio" : "La mano torna avanti prima del rilascio (creeping)" },
      { ok: rel != null, text: rel != null ? "Rilascio subito dopo l'ancoraggio" : letDown ? "Tiro abbandonato: la corda torna avanti senza rilascio" : "Rilascio non visto" },
      { ok: follow == null ? false : follow < 0.2, warn: follow != null && follow >= 0.2, text: follow == null ? "Accompagnamento non visto" : follow < 0.2 ? "Arco su dopo il rilascio (accompagnamento)" : "L'arco cade subito dopo il rilascio" },
    ];
    const parts: Part[] = [
      { label: "Braccio dell'arco disteso", value: ramp(at.bow, 150, 170) },
      { label: "Gomito della corda in linea", value: ramp(at.line, 150, 172) },
      { label: "Spalle in piano", value: 1 - ramp(Math.abs(at.shoulder), 3, 12) },
      { label: "Spalla dell'arco bassa", value: ramp(at.bowSh, 150, 172) },
      { label: "Mira ferma", value: 1 - ramp(jitter, 2, 8) },
      { label: "Tempo di ancoraggio", value: anchorTime < 1.5 ? ramp(anchorTime, 0.4, 1.5) : 1 - ramp(anchorTime, 5, 9) },
      { label: "Sequenza", value: checks.filter((c) => c.ok).length / checks.length },
    ];
    if (at.trunk != null) parts.push({ label: "Busto verticale", value: 1 - ramp(Math.abs(at.trunk), 3, 12) });
    const score = Math.round((parts.reduce((acc, p) => acc + p.value, 0) / parts.length) * 100);
    const notes = notesFor(at);
    if (drawTime != null) notes.push(`Trazione in ${drawTime.toFixed(1)} s.`);
    notes.push(jitter > 6 ? "La mano dell'arco si muove in tenuta: spinta costante verso il bersaglio." : "Mano dell'arco ferma in tenuta.");
    if (at.stance != null && (at.stance < 0.8 || at.stance > 2.2)) notes.push(`Piedi ${at.stance < 0.8 ? "stretti" : "molto larghi"} (${at.stance.toFixed(1)} volte le spalle).`);
    shots.push({
      phases,
      anchorFrom: valid[a].t,
      anchorTo: endT,
      release: rel != null ? valid[rel].t : null,
      drawTime,
      anchorTime,
      at,
      jitter,
      creep,
      follow,
      score,
      parts,
      checks,
      notes,
      anchored,
    });
  }
  const dev = (list: number[]) => Math.sqrt(variance(list));
  const spread = shots.length >= 2
    ? { draw: dev(shots.map((x) => x.at.draw)), anchor: dev(shots.map((x) => x.anchorTime)), line: dev(shots.map((x) => x.at.line)) }
    : null;
  return { shots, spread };
}

/**
 * Distanza della fotocamera (modello a foro stenopeico, come Miraglio): spalle di un adulto ≈ 38 cm,
 * focale da un angolo di campo diagonale di 67°. Uso la spalla più larga vista (quando si è di fronte).
 */
export function cameraDistance(samples: Sample[], videoW: number, videoH: number, fovDeg = 67) {
  const widths = samples.map((s) => s.m?.shoulderPx ?? 0).filter((w) => w > 4).sort((a, b) => b - a);
  if (!widths.length) return null;
  const px = widths[Math.min(widths.length - 1, Math.floor(widths.length * 0.1))];
  const f = Math.hypot(videoW, videoH) / 2 / Math.tan((fovDeg * Math.PI) / 360);
  const d = (0.38 * f) / px;
  return d > 0.5 && d < 60 ? d : null;
}

/* ---------------- arco e freccia nell'immagine ---------------- */

export type Gear = {
  /** measured: gli estremi sono dove la linea finisce davvero nell'immagine (non una lunghezza fissa). */
  arrow: { x1: number; y1: number; x2: number; y2: number; tilt: number; measured?: boolean } | null;
  bow: { x1: number; y1: number; x2: number; y2: number; cant: number; measured?: boolean } | null;
};

/**
 * Cerco freccia e arco come linee sottili vicino alle mani (filtro "a cresta": la linea è diversa
 * da entrambi i lati, il braccio largo no). Freccia: quasi parallela alla linea mano-mano.
 * Arco: passa per la mano dell'arco, quasi perpendicolare alla freccia; la sua inclinazione è il "cant".
 * Coordinate restituite 0..1 del fotogramma.
 */
export function detectGear(source: CanvasImageSource, W: number, H: number, lm: Landmark[], hand: Hand): Gear {
  const s = sides(hand);
  const bw = { x: lm[s.bow[2]].x * W, y: lm[s.bow[2]].y * H };
  const dw = { x: lm[s.draw[2]].x * W, y: lm[s.draw[2]].y * H };
  const sw = Math.hypot((lm[11].x - lm[12].x) * W, (lm[11].y - lm[12].y) * H) || 40;
  const x0 = Math.max(0, Math.min(bw.x, dw.x) - 1.2 * sw);
  const x1 = Math.min(W, Math.max(bw.x, dw.x) + 1.2 * sw);
  const y0 = Math.max(0, Math.min(bw.y, dw.y) - 2.7 * sw);
  const y1 = Math.min(H, Math.max(bw.y, dw.y) + 2.7 * sw);
  const k = Math.min(1, 420 / Math.max(x1 - x0, y1 - y0));
  const cw = Math.max(16, Math.round((x1 - x0) * k));
  const ch = Math.max(16, Math.round((y1 - y0) * k));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { arrow: null, bow: null };
  ctx.drawImage(source, x0, y0, x1 - x0, y1 - y0, 0, 0, cw, ch);
  const data = ctx.getImageData(0, 0, cw, ch).data;
  const L = new Float32Array(cw * ch);
  for (let i = 0; i < cw * ch; i += 1) L[i] = 0.3 * data[i * 4] + 0.55 * data[i * 4 + 1] + 0.15 * data[i * 4 + 2];
  const at = (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= cw || yi >= ch) return NaN;
    return L[yi * cw + xi];
  };
  const toC = (p: { x: number; y: number }) => ({ x: (p.x - x0) * k, y: (p.y - y0) * k });
  const B = toC(bw);
  const D = toC(dw);
  const swc = sw * k;
  // punteggio di una retta: media della "cresta" lungo il segmento
  const ridge = (cx: number, cy: number, ux: number, uy: number, from: number, to: number, r: number) => {
    const nx = -uy;
    const ny = ux;
    let sum = 0;
    let cnt = 0;
    for (let t = from; t <= to; t += 1) {
      const px = cx + ux * t;
      const py = cy + uy * t;
      const c = at(px, py);
      const a = at(px + nx * r, py + ny * r);
      const b = at(px - nx * r, py - ny * r);
      if (Number.isNaN(c) || Number.isNaN(a) || Number.isNaN(b)) continue;
      const da = c - a;
      const db = c - b;
      // stessa direzione da entrambi i lati: linea più chiara o più scura dello sfondo
      if (da * db > 0) sum += Math.min(Math.abs(da), Math.abs(db));
      cnt += 1;
    }
    return cnt > 8 ? sum / cnt : 0;
  };
  const r = Math.max(2, Math.round(swc * 0.05));
  // fin dove continua la linea: si avanza a tratti finché la cresta resta forte (tollera piccoli buchi)
  const reach = (cx: number, cy: number, ux: number, uy: number, start: number, end: number, rr: number, ref: number) => {
    const seg = Math.max(10, swc * 0.12);
    const dirn = Math.sign(end - start) || 1;
    let far: number | null = null;
    let gap = 0;
    let shift = 0;
    for (let t = start; (end - t) * dirn > 0; t += (dirn * seg) / 2) {
      const a = dirn > 0 ? t : t - seg;
      // segue la linea anche se curva (flettenti) o leggermente storta: prova piccoli spostamenti di lato
      let sc = 0;
      let bestD = 0;
      for (const d of [0, -1, 1, -2, 2, -3, 3]) {
        const o = shift + d;
        const v = ridge(cx - uy * o, cy + ux * o, ux, uy, a, a + seg, rr);
        if (v > sc) {
          sc = v;
          bestD = d;
        }
      }
      if (sc > ref * 0.45) {
        shift = Math.max(-swc * 0.4, Math.min(swc * 0.4, shift + bestD));
        far = t + dirn * seg;
        gap = 0;
      } else {
        gap += seg / 2;
        if (far == null ? gap > swc * 0.6 : gap > seg * 1.6) break;
      }
    }
    return far;
  };
  // --- freccia
  const base = Math.atan2(B.y - D.y, B.x - D.x);
  const len = Math.hypot(B.x - D.x, B.y - D.y);
  let best = { s: 0, a: 0, o: 0 };
  const scores: number[] = [];
  for (let da = -10; da <= 10; da += 1) {
    const ang = base + (da * Math.PI) / 180;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    for (let o = -0.35 * swc; o <= 0.35 * swc; o += 1) {
      const cx = D.x - uy * o;
      const cy = D.y + ux * o;
      const sc = ridge(cx, cy, ux, uy, len * 0.2, len * 1.25, r);
      scores.push(sc);
      if (sc > best.s) best = { s: sc, a: ang, o };
    }
  }
  const med = median(scores);
  let arrow: Gear["arrow"] = null;
  if (best.s > Math.max(6, med * 2.2)) {
    const ux = Math.cos(best.a);
    const uy = Math.sin(best.a);
    const cx = D.x - uy * best.o;
    const cy = D.y + ux * best.o;
    // la punta: dove finisce la linea oltre la mano dell'arco; la cocca è sotto le dita della corda
    const tip = reach(cx, cy, ux, uy, len * 0.6, len * 1.9, r, best.s);
    const measured = tip != null && tip > len * 0.95 && tip < len * 1.85;
    const t2 = measured ? (tip as number) : len * 1.25;
    const t1 = measured ? -0.02 * len : len * 0.05;
    const p1 = { x: (cx + ux * t1) / k + x0, y: (cy + uy * t1) / k + y0 };
    const p2 = { x: (cx + ux * t2) / k + x0, y: (cy + uy * t2) / k + y0 };
    const tilt = (Math.atan2(p1.y - p2.y, Math.abs(p2.x - p1.x)) * 180) / Math.PI;
    arrow = { x1: p1.x / W, y1: p1.y / H, x2: p2.x / W, y2: p2.y / H, tilt, measured };
  }
  // --- arco: perpendicolare alla freccia, passa vicino alla mano dell'arco
  const perp = base + Math.PI / 2;
  let bb = { s: 0, a: 0, o: 0 };
  const bscores: number[] = [];
  const rb = Math.max(2, Math.round(swc * 0.07));
  for (let da = -30; da <= 30; da += 1) {
    const ang = perp + (da * Math.PI) / 180;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    for (let o = -0.3 * swc; o <= 0.3 * swc; o += 1) {
      const cx = B.x + Math.cos(base) * o;
      const cy = B.y + Math.sin(base) * o;
      const sc = ridge(cx, cy, ux, uy, -1.6 * swc, 1.6 * swc, rb);
      bscores.push(sc);
      if (sc > bb.s) bb = { s: sc, a: ang, o };
    }
  }
  const bmed = median(bscores);
  let bow: Gear["bow"] = null;
  if (bb.s > Math.max(6, bmed * 2)) {
    const ux = Math.cos(bb.a);
    const uy = Math.sin(bb.a);
    const cx = B.x + Math.cos(base) * bb.o;
    const cy = B.y + Math.sin(base) * bb.o;
    // flettenti: dalla mano verso le due punte, finché la linea continua
    const up = reach(cx, cy, ux, uy, 0.3 * swc, 3.2 * swc, rb, bb.s);
    const down = reach(cx, cy, ux, uy, -0.3 * swc, -3.2 * swc, rb, bb.s);
    const measured = up != null && down != null && up > 1.1 * swc && down < -1.1 * swc;
    const ta = measured ? (down as number) : -1.6 * swc;
    const tb = measured ? (up as number) : 1.6 * swc;
    const p1 = { x: (cx + ux * ta) / k + x0, y: (cy + uy * ta) / k + y0 };
    const p2 = { x: (cx + ux * tb) / k + x0, y: (cy + uy * tb) / k + y0 };
    const top = p1.y < p2.y ? p1 : p2;
    const bot = p1.y < p2.y ? p2 : p1;
    // cant: + quando la cima dell'arco pende verso la mano della corda
    const towardDraw = Math.sign(dw.x - bw.x) || 1;
    const cant = (Math.atan2((top.x - bot.x) * towardDraw, bot.y - top.y) * 180) / Math.PI;
    bow = { x1: top.x / W, y1: top.y / H, x2: bot.x / W, y2: bot.y / H, cant, measured };
  }
  return { arrow, bow };
}

/** Riquadro attorno alla persona (0..1), allargato, per lo zoom automatico. */
export function personBox(lm: Landmark[], margin = 0.5): { x: number; y: number; w: number; h: number } | null {
  const pts = lm.filter((p) => (p.visibility ?? 1) > 0.4 && p.x > -0.2 && p.x < 1.2 && p.y > -0.2 && p.y < 1.2);
  if (pts.length < 6) return null;
  let x0 = Math.min(...pts.map((p) => p.x));
  let x1 = Math.max(...pts.map((p) => p.x));
  let y0 = Math.min(...pts.map((p) => p.y));
  let y1 = Math.max(...pts.map((p) => p.y));
  const mw = (x1 - x0) * margin + 0.04;
  const mh = (y1 - y0) * margin * 0.6 + 0.04;
  x0 = Math.max(0, x0 - mw);
  x1 = Math.min(1, x1 + mw);
  y0 = Math.max(0, y0 - mh);
  y1 = Math.min(1, y1 + mh);
  return { x: x0, y: y0, w: Math.max(0.2, x1 - x0), h: Math.max(0.2, y1 - y0) };
}

export function joint(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  const ab = Math.hypot(a.x - b.x, a.y - b.y);
  const cb = Math.hypot(c.x - b.x, c.y - b.y);
  if (ab < 1e-9 || cb < 1e-9) return 0;
  const cos = ((a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y)) / (ab * cb);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

export function variance(list: number[]) {
  if (!list.length) return 0;
  const m = list.reduce((a, b) => a + b, 0) / list.length;
  return list.reduce((a, b) => a + (b - m) ** 2, 0) / list.length;
}

function median(list: number[]) {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  return s[s.length >> 1];
}

export function smoothLm(prev: Landmark[] | null, next: Landmark[], alpha = 0.6): Landmark[] {
  if (!prev || prev.length !== next.length) return next;
  return next.map((p, i) => ({ x: alpha * p.x + (1 - alpha) * prev[i].x, y: alpha * p.y + (1 - alpha) * prev[i].y, visibility: p.visibility }));
}
