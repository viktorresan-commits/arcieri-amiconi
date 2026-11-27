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

/**
 * zw: profondità in metri dai punti "del mondo" del modello (più affidabile di z per il 3D).
 * xw, yw, zw insieme: il punto in metri, con l'origine tra le anche (x a destra, y in giù, z lontano
 * dalla camera): con questi la sagoma 3D ha le braccia con l'inclinazione e la profondità vere.
 */
export type Landmark = { x: number; y: number; z?: number; visibility?: number; xw?: number; yw?: number; zw?: number };

/** punto a metà strada (k da 0 a 1) tra due letture dello stesso punto, profondità comprese */
export function mixLm(p: Landmark, q: Landmark, k: number, visibility = Math.min(p.visibility ?? 1, q.visibility ?? 1)): Landmark {
  const m = (a: number | undefined, b: number | undefined) => (a != null && b != null && Number.isFinite(a) && Number.isFinite(b) ? a + (b - a) * k : b ?? a);
  return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, z: m(p.z, q.z), visibility, xw: m(p.xw, q.xw), yw: m(p.yw, q.yw), zw: m(p.zw, q.zw) };
}
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

/** g: arco e freccia trovati in quel fotogramma (durante l'analisi completa) */
export type Sample = { t: number; lm: Landmark[] | null; m: Metrics | null; g?: Gear | null };

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
  // spalle viste; gomiti e polsi anche coperti (mano della corda dietro la testa, arciere di spalle):
  // il modello li mette comunque dove sono, con visibilità bassa
  if (![11, 12].every((i) => vis(lm[i]) > 0.3) || ![13, 14].every((i) => vis(lm[i]) > 0.08) || ![15, 16].every((i) => vis(lm[i]) > 0.01)) return null;
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
  // micropunti (se mani e viso sono stati rilevati): presa nel palmo, corda tra indice e medio, bocca
  const Q = (p: Landmark) => ({ x: p.x * aspect, y: p.y });
  const bowWr = s.bow[2] as 15 | 16;
  const drwWr = s.draw[2] as 15 | 16;
  const hb0 = handPoint(lm, bowWr, 0), hb5 = handPoint(lm, bowWr, 5), hb9 = handPoint(lm, bowWr, 9);
  const hd6 = handPoint(lm, drwWr, 6), hd10 = handPoint(lm, drwWr, 10);
  const gripP = hb0 && hb5 && hb9 ? { x: (Q(hb0).x + Q(hb5).x + Q(hb9).x) / 3, y: (Q(hb0).y + Q(hb5).y + Q(hb9).y) / 3 } : null;
  const nockP = hd6 && hd10 ? { x: (Q(hd6).x + Q(hd10).x) / 2, y: (Q(hd6).y + Q(hd10).y) / 2 } : null;
  const line = nockP && gripP ? joint(gripP, nockP, P(s.draw[1])) : joint(P(s.bow[2]), P(s.draw[2]), P(s.draw[1]));
  const bowSh = joint(ds, bs, P(s.bow[1]));
  const drawSh = joint(bs, ds, P(s.draw[1]));
  const feetSeen = vis(lm[27]) > 0.5 && vis(lm[28]) > 0.5 && lm[27].y < 1.02 && lm[28].y < 1.02;
  const stance = feetSeen ? Math.hypot(P(27).x - P(28).x, P(27).y - P(28).y) / w : null;
  const bw = P(s.bow[2]);
  const dw = P(s.draw[2]);
  const aT = nockP ?? dw;
  const bT = gripP ?? bw;
  const tilt = (Math.atan2(aT.y - bT.y, Math.abs(bT.x - aT.x)) * 180) / Math.PI;
  const finger = nockP ?? (vis(lm[s.drawFinger]) > 0.4 ? P(s.drawFinger) : dw);
  const lip = facePoint(lm, hand === "destro" ? 61 : 291);
  const mouth = lip ? Q(lip) : vis(lm[9]) > 0.3 && vis(lm[10]) > 0.3 ? { x: (P(9).x + P(10).x) / 2, y: (P(9).y + P(10).y) / 2 } : P(0);
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

/** altri segnali del video oltre ai punti del corpo: i colpi di suono (lo schiocco della corda) */
export type Cues = { audio?: { t: number; z: number }[] | null; /** per le prove: i segnali di ogni campione */ debug?: (t: number, parts: Record<string, number>) => void };

/**
 * Trova i tiri. L'ancoraggio è la mano della corda vicina alla bocca, mani lontane, braccio
 * dell'arco su, mano quasi ferma. Il rilascio si cerca dentro tutta la tenuta (anche quando la
 * mano resta al viso dopo il rilascio, come con l'arco storico): è il momento in cui più segnali
 * insieme cambiano di colpo. Prima si cercano l'alzata e la trazione, dopo l'accompagnamento.
 */
export function analyzeShots(samples: Sample[], hand: Hand, cues: Cues = {}): Analysis {
  let valid = samples.filter((s): s is Sample & { m: Metrics; lm: Landmark[] } => Boolean(s.m && s.lm));
  // fotogrammi in cui il modello ha preso un'altra persona (più piccola, sullo sfondo): il busto (spalle-anche)
  // cambia poco anche se l'arciere ruota, quindi un busto molto diverso dal solito non è l'arciere
  {
    const torso = (lm: Landmark[]) => (vis(lm[23]) > 0.3 && vis(lm[24]) > 0.3 ? Math.abs((lm[11].y + lm[12].y) / 2 - (lm[23].y + lm[24].y) / 2) : null);
    const list = valid.map((v) => torso(v.lm)).filter((x): x is number => x != null);
    if (list.length >= 10) {
      const mt = median(list);
      valid = valid.filter((v) => {
        const t = torso(v.lm);
        return t == null || (t > mt * 0.6 && t < mt * 1.7);
      });
    }
  }
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
  // tenute vicine (meno di 1,5 s) sono lo stesso tiro: assestamento all'ancoraggio, oppure il rilascio
  // con la mano che resta al viso (accompagnamento). Il rilascio si cerca in tutto il tratto.
  const kept: [number, number][] = [];
  for (const r of runs) {
    const prev = kept[kept.length - 1];
    if (prev && valid[r[0]].t - valid[prev[1]].t < 1.5) prev[1] = r[1];
    else kept.push([r[0], r[1]]);
  }

  /* ---------- segnali del rilascio ---------- */
  const idxAt = (t: number) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (valid[mid].t < t) lo = mid + 1;
      else hi = mid;
    }
    return Math.min(n - 1, lo);
  };
  const dist = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y) / scale;
  // posizione media di pochi campioni attorno a un tempo (toglie il tremolio dei punti)
  const avgPx = (pick: (m: Metrics) => { x: number; y: number }, t0: number, t1: number) => {
    const a = idxAt(t0);
    const b = Math.max(a, idxAt(t1) - (valid[idxAt(t1)].t > t1 ? 1 : 0));
    let x = 0;
    let y = 0;
    for (let k = a; k <= b; k++) {
      const p = pick(valid[k].m);
      x += p.x;
      y += p.y;
    }
    const c = b - a + 1;
    return { x: x / c, y: y / c };
  };
  const drawAt = (t0: number, t1: number) => avgPx((m) => m.drawPx, t0, t1);
  const bowAt = (t0: number, t1: number) => avgPx((m) => m.bowPx, t0, t1);
  const spreadAt = (t0: number, t1: number) => {
    const a = idxAt(t0);
    const b = Math.max(a, idxAt(t1));
    let s = 0;
    for (let k = a; k <= b; k++) s += valid[k].m.spread;
    return s / (b - a + 1);
  };
  // dita della mano della corda: piegate sulla corda (aggancio) o aperte dopo il rilascio
  const drawWrist = sides(hand).draw[2] as 15 | 16;
  const curlOf = (lm: Landmark[]) => {
    const w = handPoint(lm, drawWrist, 0);
    const m9 = handPoint(lm, drawWrist, 9);
    if (!w || !m9) return null;
    const L = Math.hypot(m9.x - w.x, m9.y - w.y);
    if (L < 1e-4) return null;
    let s = 0;
    let c = 0;
    for (const [mcp, tip] of [[5, 8], [9, 12], [13, 16]] as const) {
      const a = handPoint(lm, drawWrist, mcp);
      const b = handPoint(lm, drawWrist, tip);
      if (!a || !b) continue;
      s += Math.hypot(b.x - a.x, b.y - a.y) / L;
      c++;
    }
    return c ? s / c : null;
  };
  const curlAt = (t0: number, t1: number) => {
    const list: number[] = [];
    for (let k = idxAt(t0); k < n && valid[k].t <= t1; k++) {
      const v = curlOf(valid[k].lm);
      if (v != null) list.push(v);
    }
    return list.length >= 2 ? median(list) : null;
  };
  // freccia vista nel fotogramma (dove arco e freccia sono stati cercati)
  const anyGear = valid.some((v) => v.g !== undefined);
  const arrowShare = (t0: number, t1: number) => {
    let seen = 0;
    let c = 0;
    for (let k = idxAt(t0); k < n && valid[k].t <= t1; k++) {
      c++;
      if (valid[k].g?.arrow) seen++;
    }
    return c ? seen / c : 0;
  };
  // un rilascio nel suono sono due colpi: lo schiocco della corda e, circa un terzo di secondo dopo,
  // la freccia che colpisce il paglione. Il secondo non è un rilascio: conta poco
  const sounds = cues.audio
    ? cues.audio.map((o) => ({ t: o.t, z: cues.audio!.some((p) => o.t - p.t >= 0.22 && o.t - p.t <= 0.5 && p.z >= 0.45 * o.z) ? o.z * 0.3 : o.z }))
    : null;
  const hfAt = (t0: number, t1: number) => {
    const list: number[] = [];
    for (let k = idxAt(t0); k < n && valid[k].t <= t1; k++) list.push(valid[k].m.handFace);
    return list.length ? median(list) : valid[idxAt(t0)].m.handFace;
  };
  // mano al viso nella tenuta in corso (si misura per ogni tiro)
  let anchorHf = 0;
  let faceSeen = anchored;
  let loudest = 0;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  /**
   * Quanto il campione i sembra il rilascio. Insieme, nell'istante: la mano della corda era ferma e
   * scatta via (lontano dall'arco); la mano dell'arco, ferma in mira, reagisce subito dopo (l'arco
   * cade o va avanti); le dita si aprono; la freccia non si vede più; lo schiocco della corda nel suono.
   * Una trazione che continua non è un rilascio: la mano si muoveva già prima e l'arco resta fermo.
   */
  const evidence = (i: number) => {
    const t = valid[i].t;
    const pre = drawAt(t - 0.25, t - 0.05);
    const pre2 = drawAt(t - 0.5, t - 0.3);
    const post = drawAt(t + 0.12, t + 0.28);
    const jump = dist(pre, post);
    const before = dist(pre2, pre);
    const away = spreadAt(t + 0.15, t + 0.35) - spreadAt(t - 0.25, t - 0.05);
    const b0 = bowAt(t - 0.2, t - 0.02);
    const bowAfter = Math.max(dist(b0, bowAt(t + 0.15, t + 0.3)), dist(b0, bowAt(t + 0.35, t + 0.55)));
    const bowBefore = dist(bowAt(t - 0.6, t - 0.4), b0);
    const bowEarly = dist(b0, bowAt(t + 0.08, t + 0.25));
    let score = 1.1 * clamp((jump - 0.8 * before) / 0.18, 0, 1.5) + 0.5 * clamp(away / 0.12, -1, 1) + 0.6 * clamp((Math.max(bowEarly, bowAfter * 0.5) - bowBefore) / 0.1, 0, 1);
    // la mano della corda si muoveva già (trazione che continua dopo una pausa al mento): meno probabile.
    // Prima del rilascio la mano sta ferma all'ancoraggio per quasi un secondo
    const longBefore = dist(drawAt(t - 0.85, t - 0.6), pre);
    score -= 1.2 * clamp(before / 0.1 - 0.3, 0, 1) + 1.0 * clamp((longBefore - 0.12) / 0.15, 0, 1);
    // la mano lascia il viso: prima era all'ancoraggio, subito dopo se ne va (una trazione che continua
    // fino all'orecchio resta al viso; un arciere che abbassa l'arco dopo l'accompagnamento era già lontano)
    if (faceSeen) {
      const h0 = hfAt(t - 0.25, t - 0.05);
      const h1 = hfAt(t + 0.2, t + 0.4);
      score += 1.5 * clamp((h1 - h0 - 0.06) / 0.2, -0.3, 1);
      score -= 1.5 * clamp((h0 - anchorHf - 0.08) / 0.12, 0, 1);
    }
    // braccio dell'arco giù quasi subito: l'arciere abbassa l'arco
    let up = 0;
    let cnt = 0;
    for (let k = idxAt(t + 0.05); k < n && valid[k].t <= t + 0.3; k++) {
      cnt++;
      if (valid[k].m.bowUp) up++;
    }
    if (cnt && up / cnt < 0.5) score -= 1.0;
    const c0 = curlAt(t - 0.3, t - 0.02);
    const c1 = curlAt(t + 0.1, t + 0.4);
    if (c0 != null && c1 != null) score += 0.4 * clamp((c1 - c0) / 0.2, -0.5, 1);
    if (anyGear) {
      const sb = arrowShare(t - 0.5, t - 0.02);
      const sa = arrowShare(t + 0.1, t + 0.6);
      if (sb >= 0.4 && sa <= 0.15) score += 1.2;
      else if (sa >= 0.5) score -= 0.7;
    }
    let z = 0;
    if (sounds) for (const o of sounds) if (Math.abs(o.t - t) <= 0.14) z = Math.max(z, o.z);
    score += 1.6 * clamp((z - 5) / 10, 0, 1.2);
    // nel suono c'è uno schiocco netto in questa tenuta: un momento senza suono non è il rilascio
    if (loudest >= 10 && z < 0.6 * loudest) score -= 1.5;
    if (cues.debug) {
      let vmax = 0;
      for (let k = idxAt(t - 0.05); k < n && valid[k].t <= t + 0.25; k++) vmax = Math.max(vmax, speed[k]);
      cues.debug(t, { score, jump, before, away, bowAfter, bowEarly, z, c0: c0 ?? -1, c1: c1 ?? -1, vmax, hf0: valid[idxAt(t - 0.1)].m.handFace, hf1: valid[idxAt(t + 0.3)].m.handFace });
    }
    return score;
  };
  // il campione in cui la mano parte davvero, vicino al rilascio trovato (o lo schiocco, se c'è)
  const refine = (i: number) => {
    const t = valid[i].t;
    if (sounds) {
      let best: { t: number; z: number } | null = null;
      for (const o of sounds) if (Math.abs(o.t - t) <= 0.14 && o.z >= 6 && (!best || o.z > best.z)) best = o;
      if (best) return idxAt(best.t - 0.02);
    }
    const ref = drawAt(t - 0.3, t - 0.08);
    let k = idxAt(t - 0.15);
    const end = idxAt(t + 0.15);
    while (k < end && dist(valid[k].m.drawPx, ref) < 0.05) k++;
    return k;
  };

  const shots: Shot[] = [];
  let floor = 0; // le fasi di un tiro non tornano dentro il tiro precedente
  for (const [a0, b0] of kept) {
    if (a0 < floor) continue;
    // rilascio: il campione con più segnali insieme, dentro la tenuta o subito dopo
    let rel: number | null = null;
    let bestScore = 1.0;
    {
      // mano al viso nei tratti fermi della tenuta (pausa al mento, ancoraggio, accompagnamento fermo)
      const hs = valid.slice(a0, b0 + 1).filter((_, k) => speed[a0 + k] < 0.4).map((v) => v.m.handFace);
      anchorHf = hs.length ? median(hs) : median(valid.slice(a0, b0 + 1).map((v) => v.m.handFace));
      faceSeen = anchored && anchorHf < 0.6;
    }
    // la tenuta comincia almeno 0,4 s prima del rilascio; se però lo schiocco della corda arriva appena
    // prima (arciere perso per qualche fotogramma, di spalle o coperto), si guarda anche lì
    let fromT = valid[a0].t + 0.4;
    if (sounds) {
      for (const o of sounds) {
        if (o.z < 9 || o.t < valid[a0].t - 1 || o.t >= fromT) continue;
        const k = idxAt(o.t);
        if (Math.abs(valid[k].t - o.t) < 0.3 && valid[k].m.bowUp && valid[k].m.spread > 1) fromT = Math.min(fromT, o.t - 0.1);
      }
    }
    const from = idxAt(Math.max(floor > 0 ? valid[Math.min(n - 1, floor)].t : 0, fromT));
    loudest = 0;
    if (sounds) for (const o of sounds) if (o.t >= valid[from].t - 0.1 && o.t <= valid[b0].t + 1) loudest = Math.max(loudest, o.z);
    const to = idxAt(valid[b0].t + 0.9);
    // più eventi forti nella stessa tenuta: la trazione che finisce (dal mento all'ancoraggio) viene prima e
    // l'arciere poi resta fermo in mira; il rilascio è l'ultimo evento forte con la mano ancora al viso
    // (quelli dopo, con la mano già lontana, sono accompagnamento e arco che si abbassa)
    const scores: number[] = [];
    for (let i = from; i <= to; i++) {
      const sc = evidence(i);
      // la mano era già lontana dal viso: dopo il rilascio, non il rilascio
      const away0 = faceSeen && hfAt(valid[i].t - 0.25, valid[i].t - 0.05) > anchorHf + 0.2;
      scores.push(away0 ? Math.min(sc, 0) : sc);
    }
    const top = Math.max(...scores, -Infinity);
    if (top > bestScore) {
      for (let j = scores.length - 1; j >= 0; j--) {
        if (scores[j] < 0.75 * top) continue;
        let peak = true;
        for (let q = Math.max(0, j - 3); q <= Math.min(scores.length - 1, j + 3); q++) if (scores[q] > scores[j]) peak = false;
        if (!peak) continue;
        rel = from + j;
        bestScore = scores[j];
        break;
      }
    }
    if (rel != null) rel = Math.max(a0 + 1, refine(rel));
    // la tenuta finisce al rilascio; l'ancoraggio comincia quando la mano si ferma al suo posto
    const b = rel != null ? Math.max(a0, rel - 1) : b0;
    const endT = valid[b].t;
    let a = a0;
    if (rel != null) {
      const ref = drawAt(valid[rel].t - 0.45, valid[rel].t - 0.1);
      let k = rel - 1;
      while (k > a0 && dist(valid[k - 1].m.drawPx, ref) < 0.16) k--;
      if (valid[rel].t - valid[k].t >= 0.3) a = k;
    }
    const letDown = rel == null && valid.some((v) => v.t > endT && v.t < endT + 1.2 && v.m.spread < valid[b].m.spread - 0.5);
    // indietro: trazione (mani che si allontanano) e alzata (braccio su)
    let drawFrom = a0;
    while (drawFrom > floor && valid[a0].t - valid[drawFrom - 1].t < 4 && valid[drawFrom - 1].m.spread < valid[drawFrom].m.spread + 0.05 && valid[drawFrom - 1].m.spread > 0.25) drawFrom -= 1;
    let liftFrom = drawFrom;
    while (liftFrom > floor && valid[drawFrom].t - valid[liftFrom - 1].t < 5 && valid[liftFrom - 1].m.bowUp) liftFrom -= 1;
    // avanti: accompagnamento finché il braccio dell'arco resta su (max 2 s)
    let followTo = rel ?? b;
    if (rel != null) while (followTo + 1 < n && valid[followTo + 1].t - valid[rel].t < 2 && valid[followTo + 1].m.bowUp) followTo += 1;
    floor = Math.max(followTo + 1, b0 + 1);

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
  /** freccia partita: secondi dal rilascio (la corda è tornata avanti, la mano è aperta) */
  loose?: number;
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
  // salto improvviso di un solo punto (il corpo è fermo): è un errore di lettura, il punto resta dov'era
  const sw = Math.hypot(prev[11].x - prev[12].x, prev[11].y - prev[12].y) || 0.05;
  const bodyMove = Math.hypot((next[11].x + next[12].x - prev[11].x - prev[12].x) / 2, (next[11].y + next[12].y - prev[11].y - prev[12].y) / 2);
  return next.map((p, i) => {
    if (i >= 33 && ((prev[i].visibility ?? 1) < 0.5 || (p.visibility ?? 1) < 0.5)) return p;
    const jump = Math.hypot(p.x - prev[i].x, p.y - prev[i].y);
    const a = jump > 0.6 * sw && bodyMove < 0.15 * sw && (prev[i].visibility ?? 1) > 0.3 ? 0.15 : alpha;
    return mixLm(prev[i], p, a, p.visibility);
  });
}

/* ---------- 100 punti in più: mani (21 + 21) e viso (58) ---------- */

/** dopo i 33 del corpo: mano sinistra della persona (polso 15), mano destra (polso 16), viso */
export const HAND_L = 33;
export const HAND_R = 54;
export const FACE0 = 75;
export const LM_TOTAL = 133;
/** punti del viso scelti fra i 478 di MediaPipe: labbra (20), naso (6), occhi (12), sopracciglia (6), mento e mandibola (14) */
export const FACE_IDS = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
  1, 4, 5, 195, 98, 327,
  33, 160, 158, 133, 153, 144, 362, 385, 387, 263, 373, 380,
  70, 105, 107, 336, 334, 300,
  152, 148, 176, 149, 150, 136, 172, 377, 400, 378, 379, 365, 397, 10,
];
/** collegamenti delle dita (indici 0–20 della mano) */
export const HAND_LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

/** un punto della mano (k = 0–20) del lato indicato dal polso del corpo (15 o 16), se rilevato */
export function handPoint(lm: Landmark[], wrist: 15 | 16, k: number): Landmark | null {
  if (lm.length < LM_TOTAL) return null;
  const p = lm[(wrist === 15 ? HAND_L : HAND_R) + k];
  return p && (p.visibility ?? 0) > 0.5 ? p : null;
}

/** un punto del viso per indice MediaPipe (es. 61 e 291 angoli della bocca, 1 punta del naso, 152 mento) */
export function facePoint(lm: Landmark[], meshId: number): Landmark | null {
  if (lm.length < LM_TOTAL) return null;
  const i = FACE_IDS.indexOf(meshId);
  if (i < 0) return null;
  const p = lm[FACE0 + i];
  return p && (p.visibility ?? 0) > 0.5 ? p : null;
}

/** aggiunge mani e viso ai 33 punti (assenti = visibilità 0, sul polso o sul naso) */
/** coppie sinistra/destra della posa (viso, braccia, mani, gambe, piedi) */
const SIDE_PAIRS: [number, number][] = [[1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32]];

/** scambia le etichette sinistra/destra (video specchiato o arciere ripreso da dietro) */
export function swapSides(lm: Landmark[]): Landmark[] {
  const out = lm.slice();
  for (const [a, b] of SIDE_PAIRS) {
    if (lm[a] && lm[b]) {
      out[a] = lm[b];
      out[b] = lm[a];
    }
  }
  if (lm.length >= HAND_R + 21) {
    for (let k = 0; k < 21; k++) {
      out[HAND_L + k] = lm[HAND_R + k];
      out[HAND_R + k] = lm[HAND_L + k];
    }
  }
  return out;
}

/**
 * Le etichette del braccio sono giuste per questo arciere? Si guarda il gesto, non le etichette:
 * in trazione la mano della corda sta vicino al viso e il braccio dell'arco è disteso lontano.
 * +1 giuste, -1 scambiate, 0 non si capisce (per esempio a braccia basse).
 */
export function sideEvidence(lm: Landmark[], hand: Hand, aspect: number): number {
  const S = sides(hand);
  const P = (i: number) => lm[i];
  const ok = (i: number) => (P(i)?.visibility ?? 1) > 0.45;
  if (![0, 11, 12, 13, 14, 15, 16, 23, 24].every((i) => P(i))) return 0;
  if (!ok(15) || !ok(16)) return 0;
  const d = (a: number, b: number) => Math.hypot((P(a).x - P(b).x) * aspect, P(a).y - P(b).y);
  const shM = { x: (P(11).x + P(12).x) / 2, y: (P(11).y + P(12).y) / 2 };
  const hipM = { x: (P(23).x + P(24).x) / 2, y: (P(23).y + P(24).y) / 2 };
  const torso = Math.hypot((shM.x - hipM.x) * aspect, shM.y - hipM.y);
  if (torso < 0.02) return 0;
  const straight = (sh: number, el: number, wr: number) => d(sh, wr) / Math.max(1e-6, d(sh, el) + d(el, wr));
  const near = (wr: number) => d(wr, 0) / torso;
  const [bs, be, bw] = S.bow;
  const [ds, de, dw] = S.draw;
  // mano della corda al viso, braccio dell'arco teso e lontano
  if (near(dw) < 0.5 && near(bw) > 1.0 && straight(bs, be, bw) > 0.88) return 1;
  if (near(bw) < 0.5 && near(dw) > 1.0 && straight(ds, de, dw) > 0.88) return -1;
  return 0;
}

/**
 * Lati letti al contrario. Una persona con il viso verso la camera ha la spalla sinistra (11) a destra
 * nell'immagine. Si contano i fotogrammi con il viso ben visibile e le spalle ben separate: se di solito
 * è il contrario, il modello legge l'arciere come se fosse di spalle (mirror = true: il 3D va raddrizzato).
 * I pochi fotogrammi in cui i lati si invertono rispetto agli altri si raddrizzano qui (flip).
 */
export function sideConsistency(samples: { lm: Landmark[] | null }[], aspect: number): { mirror: boolean; flip: boolean[] } {
  const dx = samples.map((s) => (s.lm && s.lm[11] && s.lm[12] ? (s.lm[11].x - s.lm[12].x) * aspect : 0));
  const widths = dx.map(Math.abs).filter((v) => v > 0).sort((a, b) => a - b);
  const big = widths[Math.floor(widths.length * 0.9)] ?? 0;
  const faceOn = (lm: Landmark[]) => vis(lm[0]) > 0.8 && vis(lm[2]) > 0.8 && vis(lm[5]) > 0.8;
  let ok = 0;
  let bad = 0;
  samples.forEach((s, i) => {
    if (!s.lm || !faceOn(s.lm) || Math.abs(dx[i]) < 0.35 * big) return;
    if (dx[i] > 0) ok++;
    else bad++;
  });
  const mirror = bad > ok * 1.5 && bad >= 5;
  const usual = mirror ? -1 : 1;
  const flip = samples.map((s, i) => Boolean(s.lm && faceOn(s.lm) && Math.abs(dx[i]) >= 0.35 * big && Math.sign(dx[i]) === -usual && ok + bad >= 8));
  return { mirror, flip };
}

export function withExtras(body: Landmark[], left: Landmark[] | null, right: Landmark[] | null, face: Landmark[] | null): Landmark[] {
  const out = body.slice(0, 33);
  const fill = (src: Landmark[] | null, n: number, anchor: Landmark) => {
    for (let k = 0; k < n; k++) out.push(src?.[k] ? { ...src[k], visibility: src[k].visibility ?? 0.9 } : { x: anchor.x, y: anchor.y, z: anchor.z, visibility: 0 });
  };
  fill(left, 21, body[15]);
  fill(right, 21, body[16]);
  fill(face, FACE_IDS.length, body[0]);
  return out;
}

/* ---------- pulizia: niente arco e freccia inventati, niente punti che saltano ---------- */

type Pt = { x: number; y: number };
function distToSegment(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** l'arciere è in trazione (o ci sta arrivando): braccio dell'arco su e mano della corda verso il viso */
export function isDrawing(m: Metrics | null) {
  return Boolean(m && m.bowUp && (m.handFace < 1.1 || m.draw < 120));
}

/**
 * Tiene solo arco e freccia credibili: l'arco deve passare per la mano dell'arco (non l'arco di
 * un altro arciere sullo sfondo), la freccia esiste solo in trazione e passa per tutte e due le mani.
 */
export function validateGear(g: Gear | null, lm: Landmark[], hand: Hand, aspect: number): Gear | null {
  if (!g) return null;
  const s = sides(hand);
  const Q = (p: { x: number; y: number }) => ({ x: p.x * aspect, y: p.y });
  const sw = Math.hypot((lm[11].x - lm[12].x) * aspect, lm[11].y - lm[12].y) || 0.05;
  const bowWr = s.bow[2] as 15 | 16;
  const drwWr = s.draw[2] as 15 | 16;
  const palm = handPoint(lm, bowWr, 9) ?? lm[bowWr];
  const grip = Q(palm);
  const fingers = Q(handPoint(lm, drwWr, 6) ?? lm[s.drawFinger] ?? lm[drwWr]);
  let bow = g.bow;
  if (bow && distToSegment(grip, Q({ x: bow.x1, y: bow.y1 }), Q({ x: bow.x2, y: bow.y2 })) > 0.4 * sw) bow = null;
  let arrow = g.arrow;
  const m = metricsOf(lm, hand, aspect, 1000);
  if (arrow) {
    const a = Q({ x: arrow.x1, y: arrow.y1 });
    const b = Q({ x: arrow.x2, y: arrow.y2 });
    if (!isDrawing(m) || distToSegment(grip, a, b) > 0.35 * sw || distToSegment(fingers, a, b) > 0.35 * sw) arrow = null;
  }
  return bow || arrow ? { bow, arrow } : null;
}

/**
 * Dopo l'analisi completa: ogni punto viene ripulito lungo il tempo. Prima si tolgono i salti
 * (un punto che in un fotogramma scappa lontano dalla mediana dei vicini torna al suo posto), poi
 * una media pesata in avanti e indietro (nessun ritardo). Mani e viso solo dove sono stati visti.
 * Arco e freccia: si tengono quelli coerenti con i fotogrammi vicini.
 */
export function cleanSequence(samples: Sample[], hand: Hand, aspect: number, H: number): Sample[] {
  const n = samples.length;
  if (n < 3) return samples;
  const L = samples.find((s) => s.lm)?.lm?.length ?? 0;
  if (!L) return samples;
  // larghezza delle spalle tipica: misura dei salti
  const sws = samples.filter((s) => s.lm).map((s) => Math.hypot((s.lm![11].x - s.lm![12].x) * aspect, s.lm![11].y - s.lm![12].y)).sort((a, b) => a - b);
  const sw = sws[Math.floor(sws.length / 2)] || 0.1;
  const R = 3;
  const sigma = 1.3;
  const out: (Landmark[] | null)[] = samples.map((s) => (s.lm ? s.lm.map((p) => ({ ...p })) : null));
  const seen = (s: Sample, i: number) => Boolean(s.lm && s.lm[i] && (i < 33 ? (s.lm[i].visibility ?? 1) > 0.2 : (s.lm[i].visibility ?? 0) >= 0.5));
  const median = (v: number[]) => {
    const a = [...v].sort((p, q) => p - q);
    return a[Math.floor(a.length / 2)];
  };
  for (let i = 0; i < L; i++) {
    // 1. salti: confronto con la mediana dei vicini
    const fixed: (Pt | null)[] = samples.map(() => null);
    for (let t = 0; t < n; t++) {
      if (!seen(samples[t], i)) continue;
      const xs: number[] = [];
      const ys: number[] = [];
      for (let k = Math.max(0, t - R); k <= Math.min(n - 1, t + R); k++) {
        if (k === t || !seen(samples[k], i)) continue;
        xs.push(samples[k].lm![i].x);
        ys.push(samples[k].lm![i].y);
      }
      const p = samples[t].lm![i];
      if (xs.length >= 2) {
        const mx = median(xs);
        const my = median(ys);
        const d = Math.hypot((p.x - mx) * aspect, p.y - my);
        // oltre mezza spalla dalla mediana dei vicini (che invece stanno fermi tra loro): è un salto
        fixed[t] = d > (i < 33 ? 0.5 : 0.35) * sw ? { x: mx, y: my } : { x: p.x, y: p.y };
      } else fixed[t] = { x: p.x, y: p.y };
    }
    // 2. media gaussiana avanti e indietro, pesata con la visibilità
    for (let t = 0; t < n; t++) {
      const f = fixed[t];
      if (!f || !out[t]) continue;
      let sx = 0;
      let sy = 0;
      let sz = 0;
      let szw = 0;
      let wz = 0;
      let wzw = 0;
      let sxw = 0;
      let syw = 0;
      let wxw = 0;
      let ws = 0;
      for (let k = Math.max(0, t - R); k <= Math.min(n - 1, t + R); k++) {
        const g = fixed[k];
        if (!g) continue;
        const p = samples[k].lm![i];
        const w = Math.exp(-((k - t) * (k - t)) / (2 * sigma * sigma)) * Math.max(0.2, p.visibility ?? 1);
        sx += g.x * w;
        sy += g.y * w;
        ws += w;
        if (typeof p.z === "number") {
          sz += p.z * w;
          wz += w;
        }
        if (typeof p.zw === "number" && Number.isFinite(p.zw)) {
          szw += p.zw * w;
          wzw += w;
          if (typeof p.xw === "number" && typeof p.yw === "number") {
            sxw += p.xw * w;
            syw += p.yw * w;
            wxw += w;
          }
        }
      }
      const q = out[t]![i];
      q.x = sx / ws;
      q.y = sy / ws;
      if (wz) q.z = sz / wz;
      if (wzw) q.zw = szw / wzw;
      if (wxw) {
        q.xw = sxw / wxw;
        q.yw = syw / wxw;
      }
    }
  }
  // arco e freccia: validi solo se ci sono anche in almeno uno dei due fotogrammi vicini
  const gears = samples.map((s, t) => (s.lm && out[t] ? validateGear(s.g ?? null, out[t]!, hand, aspect) : null));
  const near = (t: number, key: "bow" | "arrow") => [t - 1, t + 1].some((k) => k >= 0 && k < n && gears[k]?.[key]);
  return samples.map((s, t) => {
    const lm = out[t];
    if (!lm) return { ...s, g: null };
    const g0 = gears[t];
    const g = g0 ? { bow: g0.bow && near(t, "bow") ? g0.bow : null, arrow: g0.arrow && near(t, "arrow") ? g0.arrow : null } : null;
    return { t: s.t, lm, m: metricsOf(lm, hand, aspect, H), g: g && (g.bow || g.arrow) ? g : null };
  });
}
