// Ricostruzione del movimento sull'intero video, una volta sola quando il video è caricato.
//
// Fotogramma per fotogramma la posa letta dal video è rumorosa: un punto incerto salta, la profondità
// (la parte più difficile da stimare) va avanti e indietro, un osso sembra più corto e il braccio si
// schiaccia, i lati a volte si scambiano. Qui la sequenza intera viene trattata come un corpo che si
// muove davvero:
//  - lati scambiati dal rilevatore (braccio sinistro letto come destro) rimessi a posto per continuità;
//  - punti fuori posto scartati (filtro robusto) e ricuciti dai vicini, non riscritti di colpo;
//  - traiettorie lisce in avanti e indietro nel tempo (nessun ritardo), più lisce in profondità;
//  - omero e avambraccio con la loro lunghezza vera in ogni fotogramma (mai schiacciati), con il verso
//    (verso la camera o via) scelto sull'intera sequenza, senza salti;
//  - braccia e mani fuori da busto e testa;
//  - arco come corpo rigido: asse, direzione e lunghezza filtrati, freccia incoccata senza sfarfallio.
import { boneLen, bodyPoints, buildModel, imageFrame, keepArmsOut, planarScale, torsoSpan, v3, type BoneCal, type BowPose, type PlanarFix, type PrePose, type V3 } from "./anatomy-model";
import type { Gear, Hand, Landmark } from "./pose-analysis";

export type SolveFrame = { t: number; lm: Landmark[] | null; gear: Gear | null; /** dentro un tiro (dall'alzata al rilascio): la freccia è sulla corda */ armed?: boolean };


/** λ del filtro di Whittaker (differenze seconde) per una frequenza di taglio fc a fs fotogrammi al secondo */
const lamFor = (fc: number, fs: number) => {
  const s = Math.sin(Math.PI * Math.min(0.45, fc / fs));
  return 1 / (16 * s ** 4);
};

/** filtro di Whittaker pesato: liscio, a fase zero, e i pesi nulli si riempiono dai vicini */
function whittaker(y: Float64Array, w: Float64Array, lam: number): Float64Array {
  const n = y.length;
  if (n < 4) return y.slice();
  const a0 = new Float64Array(n);
  const a1 = new Float64Array(n);
  const a2 = new Float64Array(n);
  for (let i = 0; i < n; i++) a0[i] = Math.max(1e-6, w[i]);
  for (let k = 0; k + 2 < n; k++) {
    a0[k] += lam;
    a0[k + 1] += 4 * lam;
    a0[k + 2] += lam;
    a1[k] -= 2 * lam;
    a1[k + 1] -= 2 * lam;
    a2[k] += lam;
  }
  const d = new Float64Array(n);
  const l1 = new Float64Array(n);
  const l2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let di = a0[i];
    if (i >= 1) di -= l1[i - 1] * l1[i - 1] * d[i - 1];
    if (i >= 2) di -= l2[i - 2] * l2[i - 2] * d[i - 2];
    d[i] = di;
    if (i + 1 < n) l1[i] = (a1[i] - (i >= 1 ? l2[i - 1] * l1[i - 1] * d[i - 1] : 0)) / di;
    if (i + 2 < n) l2[i] = a2[i] / di;
  }
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let v = Math.max(1e-6, w[i]) * y[i];
    if (i >= 1) v -= l1[i - 1] * z[i - 1];
    if (i >= 2) v -= l2[i - 2] * z[i - 2];
    z[i] = v;
  }
  for (let i = 0; i < n; i++) z[i] /= d[i];
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let v = z[i];
    if (i + 1 < n) v -= l1[i] * x[i + 1];
    if (i + 2 < n) v -= l2[i] * x[i + 2];
    x[i] = v;
  }
  return x;
}

/** filtro robusto: due passate in cui i punti lontani dalla curva (salti del rilevatore) contano quasi nulla */
function robustSmooth(y: Float64Array, w0: Float64Array, lam: number, floor: number): Float64Array {
  let w = w0.slice();
  let x = whittaker(y, w, lam);
  for (let it = 0; it < 2; it++) {
    const res: number[] = [];
    for (let i = 0; i < y.length; i++) if (w0[i] > 0.05) res.push(Math.abs(y[i] - x[i]));
    if (res.length < 4) break;
    res.sort((a, b) => a - b);
    const sig = 1.4826 * res[Math.floor(res.length / 2)];
    const c = 4 * sig + floor;
    w = w0.map((wi, i) => {
      const u = (y[i] - x[i]) / c;
      return Math.abs(u) >= 1 ? wi * 0.01 : wi * (1 - u * u) ** 2;
    });
    x = whittaker(y, w, lam);
  }
  return x;
}

const visW = (lm: Landmark[] | null, i: number) => {
  const v = lm?.[i]?.visibility ?? 0;
  return Math.max(0.02, Math.min(1, (v - 0.2) / 0.6));
};

/**
 * Lati scambiati dal rilevatore (destra presa per sinistra). Per ogni gruppo di punti si sceglie, sull'intero
 * video, in quali fotogrammi rimetterli a posto: la scelta che rende il movimento più continuo, con un
 * piccolo costo per ogni scambio (di solito il rilevatore ha ragione) e, per le gambe, la regola che il
 * ginocchio e il piede stanno dal lato della loro anca. Prima si confrontava solo con il fotogramma
 * prima: un primo fotogramma sbagliato si portava dietro tutti gli altri (gambe incrociate per tutto il video).
 */
function fixSwaps(lms: (Landmark[] | null)[], aspect: number): (Landmark[] | null)[] {
  const out = lms.slice();
  const P = (lm: Landmark[], i: number) => (lm[i] ? [lm[i].x * aspect, lm[i].y] : null);
  const dist = (a: number[] | null, b: number[] | null) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0);
  const scale = (lm: Landmark[]) => Math.max(0.05, dist(P(lm, 11), P(lm, 12)));
  const swapPairs = (lm: Landmark[], pairs: [number, number][], hands: boolean) => {
    const o = lm.slice();
    for (const [a, b] of pairs) {
      o[a] = lm[b];
      o[b] = lm[a];
    }
    if (hands && lm.length >= 75) for (let k = 0; k < 21; k++) {
      o[33 + k] = lm[54 + k];
      o[54 + k] = lm[33 + k];
    }
    return o;
  };
  /** un gruppo: coppie da scambiare insieme, mani comprese o no, e (per le gambe) le anche di riferimento */
  const fix = (pairs: [number, number][], hands: boolean, side: boolean) => {
    const idx: number[] = [];
    out.forEach((lm, i) => {
      if (lm && lm.length >= 29) idx.push(i);
    });
    if (idx.length < 2) return;
    const lab = (lm: Landmark[], st: number) => (st ? swapPairs(lm, pairs, false) : lm);
    // costo di un fotogramma: scambiare costa poco; per le gambe, ginocchia e piedi dal lato sbagliato costano
    const unary = (lm: Landmark[], st: number) => {
      const s = scale(lm);
      let c = st ? 0.12 : 0;
      if (side && lm[23] && lm[24]) {
        const L = lab(lm, st);
        const hs = Math.sign((L[23].x - L[24].x) * aspect) || 1;
        for (const [a, b] of pairs) {
          if (!L[a] || !L[b]) continue;
          const d = ((L[a].x - L[b].x) * aspect * hs) / s;
          // incrociati (oltre un quinto di spalla): improbabile in piedi
          if (d < -0.2) c += Math.min(2, (-d - 0.2) * 3);
        }
      }
      return c;
    };
    const trans = (a: Landmark[], sa: number, b: Landmark[], sb: number) => {
      const A = lab(a, sa);
      const B = lab(b, sb);
      let d = 0;
      for (const [x, y] of pairs) d += dist(P(A, x), P(B, x)) + dist(P(A, y), P(B, y));
      return d / scale(b);
    };
    const m = idx.length;
    const cost: [number, number][] = [];
    const from: [number, number][] = [];
    const first = out[idx[0]]!;
    cost.push([unary(first, 0), unary(first, 1)]);
    from.push([0, 0]);
    for (let k = 1; k < m; k++) {
      const a = out[idx[k - 1]]!;
      const b = out[idx[k]]!;
      const row: [number, number] = [0, 0];
      const arg: [number, number] = [0, 0];
      for (const sb of [0, 1]) {
        const c0 = cost[k - 1][0] + trans(a, 0, b, sb);
        const c1 = cost[k - 1][1] + trans(a, 1, b, sb);
        row[sb] = Math.min(c0, c1) + unary(b, sb);
        arg[sb] = c0 <= c1 ? 0 : 1;
      }
      cost.push(row);
      from.push(arg);
    }
    let st = cost[m - 1][0] <= cost[m - 1][1] ? 0 : 1;
    for (let k = m - 1; k >= 0; k--) {
      if (st) out[idx[k]] = swapPairs(out[idx[k]]!, pairs, hands);
      st = from[k][st];
    }
  };
  fix([[13, 14], [15, 16], [17, 18], [19, 20], [21, 22]], true, false);
  fix([[25, 26]], false, true);
  fix([[27, 28], [29, 30], [31, 32]], false, true);
  return out;
}

/** riempie i buchi (peso 0) con il valore più vicino, così il filtro parte da qualcosa di sensato */
function fillGaps(y: Float64Array, w: Float64Array) {
  let last = -1;
  for (let i = 0; i < y.length; i++) {
    if (w[i] <= 0) continue;
    if (last < 0) for (let k = 0; k < i; k++) y[k] = y[i];
    else for (let k = last + 1; k < i; k++) y[k] = y[last] + ((y[i] - y[last]) * (k - last)) / (i - last);
    last = i;
  }
  if (last >= 0) for (let k = last + 1; k < y.length; k++) y[k] = y[last];
}

/**
 * Scala (unità d'immagine per metro) e pavimento sull'intero video. In un fotogramma in cui caviglie o anche
 * non si vedono bene la scala si ricava da un'altra misura e il pavimento si indovina: la sagoma
 * cambiava grandezza e saltava su e giù (fino a «volare»). L'arciere sta fermo davanti alla camera:
 * scala e pavimento cambiano piano, e contano soprattutto i fotogrammi con il corpo intero.
 */
function sequenceScale(info: (ReturnType<typeof planarScale> | null)[], fs: number): (PlanarFix | null)[] {
  const n = info.length;
  const s = new Float64Array(n);
  const f = new Float64Array(n);
  const ws = new Float64Array(n);
  const wf = new Float64Array(n);
  let seen = 0;
  for (let i = 0; i < n; i++) {
    const p = info[i];
    if (!p || !(p.s > 0) || !Number.isFinite(p.floorY)) continue;
    s[i] = p.s;
    f[i] = p.floorY;
    ws[i] = p.full ? 1 : 0.2;
    wf[i] = p.anklesOk ? 1 : 0.03;
    seen++;
  }
  if (seen < 3) return info.map((p) => (p ? { s: p.s, floorY: p.floorY } : null));
  fillGaps(s, ws);
  fillGaps(f, wf);
  const S = robustSmooth(s, ws, lamFor(0.5, fs), 0.004);
  const F = robustSmooth(f, wf, lamFor(0.5, fs), 0.004);
  return info.map((p, i) => (p ? { s: S[i] > 0.05 ? S[i] : p.s, floorY: Number.isFinite(F[i]) ? F[i] : p.floorY } : null));
}

/**
 * Gambe e busto di chi tira: i piedi restano dove sono, le gambe quasi dritte sotto il bacino e il busto
 * al massimo un po' inclinato. Le gambe vengono spesso male dal video (pantaloni scuri, ombre, punti
 * scambiati tra destra e sinistra): dove non sono credibili si prende la posizione dei fotogrammi buoni.
 */
function standUpright(J: Record<number, V3>[], lms: (Landmark[] | null)[], fs: number): number[] {
  const n = J.length;
  const shifts = new Array<number>(n).fill(0);
  const hipM = (Jf: Record<number, V3>) => (Jf[23] && Jf[24] ? v3.lerp(Jf[23], Jf[24], 0.5) : null);
  const lenOf = (Jf: Record<number, V3>, a: number, b: number) => (Jf[a] && Jf[b] ? v3.len(v3.sub(Jf[a], Jf[b])) : 0);
  const med = (v: number[]) => {
    const a = v.filter((x) => x > 0.05).sort((x, y) => x - y);
    return a.length ? a[Math.floor(a.length / 2)] : 0;
  };
  const thigh = med(J.flatMap((Jf) => [lenOf(Jf, 23, 25), lenOf(Jf, 24, 26)]));
  const shin = med(J.flatMap((Jf) => [lenOf(Jf, 25, 27), lenOf(Jf, 26, 28)]));
  const angleAt = (a: V3, b: V3, c: V3) => {
    const u = v3.norm(v3.sub(a, b));
    const w = v3.norm(v3.sub(c, b));
    return (Math.acos(Math.max(-1, Math.min(1, v3.dot(u, w)))) * 180) / Math.PI;
  };
  const good = J.map((Jf, i) => {
    const lm = lms[i];
    if (!lm || !hipM(Jf)) return 0;
    let g = 1;
    for (const k of [25, 26, 27, 28]) g = Math.min(g, visW(lm, k));
    for (const [h, k, a] of [[23, 25, 27], [24, 26, 28]] as const) {
      if (!Jf[k] || !Jf[a]) return 0;
      // in piedi: caviglia sotto il ginocchio, ginocchio sotto l'anca
      if (!(Jf[a][1] < Jf[k][1] - 0.12 && Jf[k][1] < Jf[h][1] - 0.12)) return 0.002;
      if (angleAt(Jf[h], Jf[k], Jf[a]) < 145) g *= 0.05;
      if (thigh && Math.abs(lenOf(Jf, h, k) / thigh - 1) > 0.3) g *= 0.05;
      if (shin && Math.abs(lenOf(Jf, k, a) / shin - 1) > 0.3) g *= 0.05;
    }
    return Math.max(0.002, g);
  });
  // le gambe rispetto al bacino: cambiano piano (si sposta un piede ogni tanto, non a ogni fotogramma)
  const w = Float64Array.from(good);
  const lam = lamFor(0.35, fs);
  for (const id of [25, 26, 27, 28, 29, 30, 31, 32]) {
    const cx = new Float64Array(n);
    const cy = new Float64Array(n);
    const cz = new Float64Array(n);
    const wi = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const h = hipM(J[i]);
      const p = J[i][id];
      if (!h || !p) continue;
      cx[i] = p[0] - h[0];
      cy[i] = p[1] - h[1];
      cz[i] = p[2] - h[2];
      wi[i] = w[i];
    }
    if (!wi.some((x) => x > 0)) continue;
    fillGaps(cx, wi);
    fillGaps(cy, wi);
    fillGaps(cz, wi);
    const sx = robustSmooth(cx, wi, lam, 0.01);
    const sy = robustSmooth(cy, wi, lam, 0.01);
    const sz = robustSmooth(cz, wi, lam, 0.01);
    for (let i = 0; i < n; i++) {
      const h = hipM(J[i]);
      if (!h || !J[i][id]) continue;
      J[i][id] = [h[0] + sx[i], h[1] + sy[i], h[2] + sz[i]];
    }
  }
  // busto: al massimo 15° dalla verticale; se è di più si porta il bacino (con le gambe) sotto le spalle
  const MAX = Math.tan((15 * Math.PI) / 180);
  for (let i = 0; i < n; i++) {
    const Jf = J[i];
    const h = hipM(Jf);
    if (!h || !Jf[11] || !Jf[12]) continue;
    const sh = v3.lerp(Jf[11], Jf[12], 0.5);
    const up = sh[1] - h[1];
    const dx = sh[0] - h[0];
    const dz = sh[2] - h[2];
    const side = Math.hypot(dx, dz);
    const lim = Math.max(0.05, up) * MAX;
    if (side <= lim || side < 1e-6) continue;
    const k = 1 - lim / side;
    const d: V3 = [dx * k, 0, dz * k];
    for (const id of [23, 24, 25, 26, 27, 28, 29, 30, 31, 32]) if (Jf[id]) Jf[id] = v3.add(Jf[id], d);
  }
  // piedi a terra: la caviglia più bassa all'altezza della caviglia (6,4 cm, come nel piede dell'anatomia), mai
  // sotto il pavimento né in aria
  for (let i = 0; i < n; i++) {
    const Jf = J[i];
    if (!Jf[27] || !Jf[28]) continue;
    const low = Math.min(Jf[27][1], Jf[28][1]);
    const dy = 0.064 - low;
    if (Math.abs(dy) < 0.01) continue;
    for (const k of Object.keys(Jf)) {
      const p = Jf[Number(k)];
      Jf[Number(k)] = [p[0], p[1] + dy, p[2]];
    }
    shifts[i] = dy;
  }
  return shifts;
}

/** omero e avambraccio del corpo anatomico (BodyParts3D) rispetto al busto (spalle-anche) */
const MESH_UA = 0.535;
const MESH_FA = 0.469;

/** gruppi di punti con il loro filtro: [indici, rispetto a quale punto, taglio x/y Hz, taglio profondità Hz] */
type Group = { ids: number[]; rel?: number; fxy: number; fz: number; floor: number };

export function solveMotion(frames: SolveFrame[], aspect: number, hand: Hand, cal: BoneCal | null, dbg?: (stage: string, J: Record<number, V3>[]) => void): (PrePose | null)[] {
  const n = frames.length;
  if (n < 4) return frames.map(() => null);
  const dur = frames[n - 1].t - frames[0].t;
  const fs = dur > 0 ? (n - 1) / dur : 30;
  const lms = fixSwaps(
    frames.map((f) => f.lm),
    aspect,
  );
  // scala e pavimento uguali per tutto il video (filtrati): la sagoma non cambia grandezza né salta
  const fixes = sequenceScale(lms.map((lm) => (lm ? planarScale(lm, aspect) : null)), fs);
  const raw = lms.map((lm, i) => (lm ? bodyPoints(lm, aspect, cal, null, undefined, fixes[i]) : null));
  const valid = raw.map(Boolean);
  // fotogrammi senza arciere: si ricuciono solo i buchi brevi (fino a 0,4 s), altrimenti restano vuoti
  const keep = valid.slice();
  {
    let i = 0;
    while (i < n) {
      if (valid[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < n && !valid[j]) j++;
      const inside = i > 0 && j < n;
      if (inside && frames[j].t - frames[i - 1].t <= 0.45) for (let k = i; k < j; k++) keep[k] = true;
      i = j;
    }
  }
  if (!keep.some(Boolean)) return frames.map(() => null);

  const groups: Group[] = [
    { ids: [11, 12, 23, 24], fxy: 3, fz: 0.8, floor: 0.01 },
    { ids: [13, 14, 15, 16], fxy: 5, fz: 1.5, floor: 0.012 },
    { ids: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], fxy: 3, fz: 0.8, floor: 0.01 },
    { ids: [25, 26, 27, 28, 29, 30, 31, 32], fxy: 3, fz: 0.8, floor: 0.012 },
    { ids: [17, 19, 21], rel: 15, fxy: 4, fz: 1.5, floor: 0.008 },
    { ids: [18, 20, 22], rel: 16, fxy: 4, fz: 1.5, floor: 0.008 },
    { ids: Array.from({ length: 21 }, (_, k) => 33 + k), rel: 15, fxy: 5, fz: 2, floor: 0.006 },
    { ids: Array.from({ length: 21 }, (_, k) => 54 + k), rel: 16, fxy: 5, fz: 2, floor: 0.006 },
  ];
  const maxId = raw.reduce((m, J) => (J ? Math.max(m, ...Object.keys(J).map(Number)) : m), 0);
  if (maxId > 75) groups.push({ ids: Array.from({ length: maxId - 74 }, (_, k) => 75 + k), rel: 0, fxy: 3, fz: 0.8, floor: 0.006 });

  const J: Record<number, V3>[] = frames.map(() => ({}));
  const present: Record<number, boolean[]> = {};
  // prima i punti assoluti, poi quelli relativi (mani e viso) attaccati ai loro punti già filtrati
  const ordered = [...groups.filter((g) => g.rel == null), ...groups.filter((g) => g.rel != null)];
  for (const g of ordered) {
    for (const id of g.ids) {
      const xs = new Float64Array(n);
      const ys = new Float64Array(n);
      const zs = new Float64Array(n);
      const w = new Float64Array(n);
      let seen = 0;
      for (let i = 0; i < n; i++) {
        const p = raw[i]?.[id];
        const r = g.rel != null ? raw[i]?.[g.rel] : ([0, 0, 0] as V3);
        if (!p || !r) continue;
        xs[i] = p[0] - r[0];
        ys[i] = p[1] - r[1];
        zs[i] = p[2] - r[2];
        // mani e viso: visibilità del loro primo punto; i punti del corpo la loro
        const vi = id >= 33 && id < 54 ? visW(lms[i], 33) : id >= 54 && id < 75 ? visW(lms[i], 54) : id >= 75 ? visW(lms[i], 75) : visW(lms[i], id);
        w[i] = vi;
        seen++;
      }
      if (seen < 3) continue;
      // i buchi si riempiono dal valore più vicino prima del filtro (il filtro li lega poi ai vicini)
      let last = -1;
      for (let i = 0; i < n; i++) {
        if (w[i] > 0) {
          if (last < 0) for (let k = 0; k < i; k++) [xs[k], ys[k], zs[k]] = [xs[i], ys[i], zs[i]];
          else for (let k = last + 1; k < i; k++) {
            const t = (k - last) / (i - last);
            xs[k] = xs[last] + (xs[i] - xs[last]) * t;
            ys[k] = ys[last] + (ys[i] - ys[last]) * t;
            zs[k] = zs[last] + (zs[i] - zs[last]) * t;
          }
          last = i;
        }
      }
      if (last >= 0) for (let k = last + 1; k < n; k++) [xs[k], ys[k], zs[k]] = [xs[last], ys[last], zs[last]];
      const lxy = lamFor(g.fxy, fs);
      const lz = lamFor(g.fz, fs);
      const sx = robustSmooth(xs, w, lxy, g.floor);
      const sy = robustSmooth(ys, w, lxy, g.floor);
      const sz = robustSmooth(zs, w, lz, g.floor * 3);
      // un punto esiste dove è stato visto, o a meno di mezzo secondo da dove è stato visto
      const pres = new Array<boolean>(n).fill(false);
      let lastSeen = -Infinity;
      for (let i = 0; i < n; i++) {
        if (w[i] > 0) lastSeen = frames[i].t;
        pres[i] = frames[i].t - lastSeen <= 0.5;
      }
      let nextSeen = Infinity;
      for (let i = n - 1; i >= 0; i--) {
        if (w[i] > 0) nextSeen = frames[i].t;
        pres[i] = pres[i] || nextSeen - frames[i].t <= 0.5;
      }
      present[id] = pres;
      for (let i = 0; i < n; i++) {
        if (!keep[i] || !pres[i]) continue;
        const r = g.rel != null ? J[i][g.rel] : ([0, 0, 0] as V3);
        if (!r) continue;
        J[i][id] = [sx[i] + r[0], sy[i] + r[1], sz[i] + r[2]];
      }
    }
  }
  // le mani a 21 punti: o tutte o niente in un fotogramma
  for (const base of [33, 54]) for (let i = 0; i < n; i++) {
    let ok = true;
    for (let k = 0; k < 21; k++) if (!J[i][base + k]) ok = false;
    if (!ok) for (let k = 0; k < 21; k++) delete J[i][base + k];
  }

  // gambe credibili, busto in piedi, piedi a terra
  const shiftOf = standUpright(J, lms, fs);
  dbg?.("smooth", J);
  // ---- braccia con la lunghezza vera: profondità di gomito e polso con il verso scelto sull'intera sequenza ----
  // Omero e avambraccio con le proporzioni del corpo anatomico disegnato, scalate sul busto dell'arciere:
  // con lunghezze diverse da quelle del modello le braccia venivano stirate (e i muscoli assottigliati)
  const torsoL = (() => {
    const v: number[] = [];
    for (const Jf of J) {
      if (!Jf[11] || !Jf[12] || !Jf[23] || !Jf[24]) continue;
      v.push(v3.len(v3.sub(v3.lerp(Jf[11], Jf[12], 0.5), v3.lerp(Jf[23], Jf[24], 0.5))));
    }
    v.sort((x, y) => x - y);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  })();
  const UA = torsoL > 0.25 ? torsoL * MESH_UA : boneLen(cal, "omeroS");
  const FA = torsoL > 0.25 ? torsoL * MESH_FA : boneLen(cal, "avambraccioS");
  const arms = [
    { sh: 11, el: 13, wr: 15, ua: UA, fa: FA, hand: [17, 19, 21], hb: 33 },
    { sh: 12, el: 14, wr: 16, ua: UA, fa: FA, hand: [18, 20, 22], hb: 54 },
  ];
  const moveHand = (Jf: Record<number, V3>, a: (typeof arms)[number], dz: number) => {
    for (const f of a.hand) if (Jf[f]) Jf[f] = [Jf[f][0], Jf[f][1], Jf[f][2] + dz];
    for (let k = 0; k < 21; k++) if (Jf[a.hb + k]) Jf[a.hb + k] = [Jf[a.hb + k][0], Jf[a.hb + k][1], Jf[a.hb + k][2] + dz];
  };
  /** profondità del figlio con l'osso lungo L: le due soluzioni (verso la camera e via) */
  const roots = (p: V3, c: V3, L: number): [number, number] => {
    const dxy = Math.hypot(c[0] - p[0], c[1] - p[1]);
    const h = Math.sqrt(Math.max(0, L * L - dxy * dxy));
    return [p[2] + h, p[2] - h];
  };
  /** quanti fotogrammi (a 30 al secondo) tra due istanti: il salto consentito cresce con il tempo */
  const gapF = (i0: number, i1: number) => Math.max(1, (frames[i1].t - frames[i0].t) * 30);
  /** i punti del gruppo del gomito (gomito e omero) o del polso (avambraccio, polso e mano), con lo spessore, per profondità date */
  const probesOf = (Jf: Record<number, V3>, a: (typeof arms)[number], id: number, elZ?: number, wrZ?: number): [V3, number][] => {
    if (!Jf[a.sh] || !Jf[a.el] || !Jf[a.wr]) return [];
    const el: V3 = [Jf[a.el][0], Jf[a.el][1], elZ ?? Jf[a.el][2]];
    if (id === a.el) return [[el, 0.05], [v3.lerp(Jf[a.sh], el, 0.6), 0.055], [v3.lerp(Jf[a.sh], el, 0.8), 0.055]];
    const dz = wrZ == null ? 0 : wrZ - Jf[a.wr][2];
    const wr: V3 = [Jf[a.wr][0], Jf[a.wr][1], Jf[a.wr][2] + dz];
    const pr: [V3, number][] = [[wr, 0.04], ...[0.25, 0.5, 0.75].map((f): [V3, number] => [v3.lerp(el, wr, f), 0.045])];
    for (const [q, r] of [[Jf[a.hb + 9], 0.03], [Jf[a.hb + 12], 0.012], [Jf[a.hand[1]], 0.025]] as const) if (q) pr.push([[q[0], q[1], q[2] + dz], r]);
    return pr;
  };
  /** quanto il gruppo sta dalla parte sbagliata o dentro il busto, con il lato deciso (0 = a posto) */
  const violation = (Jf: Record<number, V3>, a: (typeof arms)[number], id: number, elZ: number, wrZ: number | undefined, sd: number | undefined) => {
    const span = torsoSpan(Jf, cal);
    if (!span) return 0;
    let v = 0;
    for (const [q, r] of probesOf(Jf, a, id, elZ, wrZ)) {
      const sp = span(q, r);
      if (!sp || !Number.isFinite(sp[0])) continue;
      const side = sd ?? (q[2] >= (sp[0] + sp[1]) / 2 ? 1 : -1);
      v = Math.max(v, side > 0 ? Math.max(0, sp[1] - q[2]) : Math.max(0, q[2] - sp[0]));
    }
    return v;
  };
  // le ossa filtrate (il bersaglio), prima di toccarle: conta il loro verso (quanto va verso la camera
  // rispetto alla lunghezza vista), non la profondità assoluta, che dal video esce sempre troppo piatta
  // profondità assolute filtrate (servono dove la mano tocca il viso o il collo: lì conta dove sta, non il verso)
  const absZ: Record<number, (number | null)[]> = {};
  for (const a of arms) for (const id of [a.el, a.wr]) absZ[id] = J.map((Jf) => Jf[id]?.[2] ?? null);
  /** la mano tocca viso o collo (all'ancoraggio): 0..1, come nella posa del singolo fotogramma */
  const contact = arms.map((a) =>
    J.map((Jf) => {
      if (!Jf[9] || !Jf[10] || !Jf[11] || !Jf[12] || !Jf[a.wr]) return 0;
      const mouth = v3.lerp(Jf[9], Jf[10], 0.5);
      const neck = v3.lerp(Jf[11], Jf[12], 0.5);
      const pts = [Jf[a.wr], Jf[a.hb + 9], Jf[a.hb + 5], Jf[a.hb + 12], Jf[a.hand[1]]].filter(Boolean) as V3[];
      let d = 9;
      for (const p of pts) {
        d = Math.min(d, Math.hypot(p[0] - mouth[0], p[1] - mouth[1]));
        // sul segmento bocca-collo
        const ax = neck[0] - mouth[0];
        const ay = neck[1] - mouth[1];
        const t = Math.max(0, Math.min(1, ((p[0] - mouth[0]) * ax + (p[1] - mouth[1]) * ay) / (ax * ax + ay * ay || 1)));
        d = Math.min(d, Math.hypot(p[0] - mouth[0] - ax * t, p[1] - mouth[1] - ay * t) + 0.02);
      }
      return Math.max(0, Math.min(1, (0.15 - d) / 0.06));
    }),
  );
  const rawBone: Record<number, (V3 | null)[]> = {};
  for (const a of arms) {
    rawBone[a.el] = J.map((Jf) => (Jf[a.sh] && Jf[a.el] ? v3.sub(Jf[a.el], Jf[a.sh]) : null));
    rawBone[a.wr] = J.map((Jf) => (Jf[a.el] && Jf[a.wr] ? v3.sub(Jf[a.wr], Jf[a.el]) : null));
  }
  /** profondità dell'osso lungo L che ha il verso di quello filtrato */
  const boneDz = (v: V3 | null, L: number) => {
    if (!v) return null;
    const l = v3.len(v);
    return l > 1e-4 ? (v[2] * L) / l : 0;
  };
  /**
   * Gomito e polso insieme (quattro stati: ciascuno verso la camera o via), sull'intera sequenza: vicini
   * alla profondità filtrata, fuori dal busto dalla parte decisa, e senza salti (una mano non si sposta in
   * profondità di decine di centimetri in un trentesimo di secondo: si cambia verso dove le due
   * soluzioni coincidono, con l'osso nel piano dell'immagine)
   */
  const solveArm = (a: (typeof arms)[number], sides_: Record<number, number>[]) => {
    type St = { e: number; w: number } | null;
    const states: St[][] = J.map((Jf) => {
      if (!Jf[a.sh] || !Jf[a.el] || !Jf[a.wr]) return [];
      const ec = roots(Jf[a.sh], Jf[a.el], a.ua);
      const out: St[] = [];
      for (const ez of ec) {
        const wc = roots([Jf[a.el][0], Jf[a.el][1], ez], Jf[a.wr], a.fa);
        for (const wz of wc) out.push({ e: ez, w: wz });
      }
      return out;
    });
    const dataCost = (i: number, st: { e: number; w: number }) => {
      const Jf = J[i];
      const de = boneDz(rawBone[a.el][i], a.ua);
      const dw = boneDz(rawBone[a.wr][i], a.fa);
      let c = (de == null ? 0 : (st.e - Jf[a.sh][2] - de) ** 2) + (dw == null ? 0 : (st.w - st.e - dw) ** 2);
      // mano al viso: deve restare lì
      const ct = contact[arms.indexOf(a)][i];
      const zw = absZ[a.wr][i];
      if (ct > 0 && zw != null) c += 40 * ct * (st.w - zw) ** 2;
      // a parità di video, il gomito meno piegato: un braccio che nel video è dritto non si piega in profondità
      const u: V3 = [Jf[a.el][0] - Jf[a.sh][0], Jf[a.el][1] - Jf[a.sh][1], st.e - Jf[a.sh][2]];
      const f: V3 = [Jf[a.wr][0] - Jf[a.el][0], Jf[a.wr][1] - Jf[a.el][1], st.w - st.e];
      const lu = v3.len(u);
      const lf = v3.len(f);
      if (lu > 1e-4 && lf > 1e-4) {
        const cos3 = v3.dot(u, f) / (lu * lf);
        const u2 = Math.hypot(u[0], u[1]);
        const f2 = Math.hypot(f[0], f[1]);
        const cos2 = u2 > 1e-4 && f2 > 1e-4 ? (u[0] * f[0] + u[1] * f[1]) / (u2 * f2) : cos3;
        // più piegato in 3D che nel video: costa (un braccio dritto nel video resta dritto).
        // u e f vanno lungo il braccio: dritto = coseno 1
        c += (cos2 > 0.9 ? 0.3 : 0.03) * Math.max(0, cos2 - cos3) ** 2;
      }
      const ve = violation(J[i], a, a.el, st.e, undefined, sides_[i][a.el]);
      const vw = violation(J[i], a, a.wr, st.e, st.w, sides_[i][a.wr]);
      c += 400 * (ve * ve + vw * vw);
      return c;
    };
    const jump = (i0: number, i1: number, p: { e: number; w: number }, q: { e: number; w: number }) => {
      const g = 0.06 * gapF(i0, i1);
      let c = 0;
      // il salto costa, ma non tanto da tenere per secondi la soluzione che il video smentisce
      for (const dz of [Math.abs(p.e - q.e), Math.abs(p.w - q.w)]) c += 5 * dz * dz + 20 * Math.max(0, dz - g) ** 2;
      return c;
    };
    const cost: number[][] = [];
    const from: number[][] = [];
    let prevI = -1;
    for (let i = 0; i < n; i++) {
      const S = states[i];
      if (!S.length) {
        cost.push([]);
        from.push([]);
        continue;
      }
      const ci: number[] = [];
      const fi: number[] = [];
      for (let k = 0; k < S.length; k++) {
        const d = dataCost(i, S[k]!);
        if (prevI < 0) {
          ci.push(d);
          fi.push(-1);
          continue;
        }
        let best = Infinity;
        let bq = 0;
        const P = states[prevI];
        for (let q = 0; q < P.length; q++) {
          const v = cost[prevI][q] + jump(prevI, i, P[q]!, S[k]!);
          if (v < best) {
            best = v;
            bq = q;
          }
        }
        ci.push(best + d);
        fi.push(bq);
      }
      cost.push(ci);
      from.push(fi);
      prevI = i;
    }
    const pick = new Array<number>(n).fill(-1);
    let i = n - 1;
    while (i >= 0 && !states[i].length) i--;
    if (i < 0) return pick;
    let k = cost[i].indexOf(Math.min(...cost[i]));
    while (i >= 0) {
      if (states[i].length) {
        pick[i] = k;
        k = from[i][k];
        if (k < 0) break;
        let j = i - 1;
        while (j >= 0 && !states[j].length) j--;
        i = j;
      } else i--;
    }
    // profondità scelte; dove il verso cambia con un salto (il video dice l'altra soluzione) il passaggio
    // si distribuisce su qualche fotogramma invece di avvenire in uno solo
    const zE = new Array<number | null>(n).fill(null);
    const zW = new Array<number | null>(n).fill(null);
    for (let f = 0; f < n; f++) {
      const st = pick[f] >= 0 ? states[f][pick[f]] : null;
      if (st) {
        zE[f] = st.e;
        zW[f] = st.w;
      }
    }
    const Wd = Math.max(2, Math.round(fs * 0.18));
    for (let f = 1; f < n; f++) {
      const k0 = pick[f - 1];
      const k1 = pick[f];
      if (k0 < 0 || k1 < 0 || k0 === k1) continue;
      const a0 = states[f - 1][k0]!;
      const b0 = states[f][k1]!;
      if (Math.abs(a0.e - b0.e) < 0.08 && Math.abs(a0.w - b0.w) < 0.08) continue;
      for (let g = Math.max(0, f - Wd); g < Math.min(n, f + Wd); g++) {
        const S = states[g];
        if (!S.length || !S[k0] || !S[k1]) continue;
        const t = (g - (f - Wd) + 0.5) / (2 * Wd);
        const sm = t * t * (3 - 2 * t);
        zE[g] = S[k0]!.e + (S[k1]!.e - S[k0]!.e) * sm;
        zW[g] = S[k0]!.w + (S[k1]!.w - S[k0]!.w) * sm;
      }
    }
    for (let f = 0; f < n; f++) {
      if (zE[f] == null || zW[f] == null) continue;
      const Jf = J[f];
      Jf[a.el] = [Jf[a.el][0], Jf[a.el][1], zE[f]!];
      const dz = zW[f]! - Jf[a.wr][2];
      Jf[a.wr] = [Jf[a.wr][0], Jf[a.wr][1], zW[f]!];
      moveHand(Jf, a, dz);
    }
    return pick;
  };
  // Davanti o dietro al busto: finché un punto del braccio sta, nel video, sopra la sagoma del busto non
  // può passare dall'altra parte (dovrebbe attraversare il corpo). Per ogni tratto così si sceglie un
  // lato solo: quello da cui il gruppo è arrivato (o da cui se ne va, o dove è stato di più). Due giri:
  // il primo sceglie il verso delle ossa, il secondo lo rifà rispettando i lati decisi
  let sides: Record<number, number>[] = frames.map(() => ({}));
  for (let iter = 0; iter < 2; iter++) {
    for (const a of arms) solveArm(a, sides);
    if (iter === 1) break;
    sides = frames.map(() => ({}));
    for (const a of arms) {
      for (const id of [a.el, a.wr]) {
        /** quanto il gruppo sta davanti (+) o dietro (-) al centro del busto, se lo copre nel video */
        const rel: (number | null)[] = J.map((Jf) => {
          const span = torsoSpan(Jf, cal);
          if (!span) return null;
          let acc = 0;
          let hit = false;
          for (const [q, r] of probesOf(Jf, a, id)) {
            const sp = span(q, r);
            if (!sp || !Number.isFinite(sp[0])) continue;
            hit = true;
            acc += q[2] - (sp[0] + sp[1]) / 2;
          }
          return hit ? acc : null;
        });
        const sideOf = (i: number) => {
          const span = torsoSpan(J[i], cal);
          let acc = 0;
          for (const [q, r] of probesOf(J[i], a, id)) {
            const sp = span?.(q, r);
            acc += q[2] - (sp && Number.isFinite(sp[0]) ? (sp[0] + sp[1]) / 2 : (J[i][11][2] + J[i][12][2]) / 2);
          }
          return acc >= 0 ? 1 : -1;
        };
        let i = 0;
        let lastSide = 0;
        let lastEnd = -99;
        while (i < n) {
          if (rel[i] == null) {
            i++;
            continue;
          }
          let j = i;
          while (j < n && rel[j] != null) j++;
          let sd = 0;
          if (i - lastEnd <= 4 && lastSide) sd = lastSide;
          else if (i > 0 && J[i - 1][id] && J[i - 1][11]) sd = sideOf(i - 1);
          else if (j < n && J[j][id] && J[j][11]) sd = sideOf(j);
          else {
            let sc = 0;
            for (let k = i; k < j; k++) sc += rel[k]!;
            sd = sc >= 0 ? 1 : -1;
          }
          for (let k = i; k < j; k++) sides[k][id] = sd;
          lastSide = sd;
          lastEnd = j;
          i = j;
        }
      }
      // gomito e polso dalla stessa parte del busto dove lo coprono tutti e due: l'avambraccio non lo attraversa
      for (let k = 0; k < n; k++) {
        const se = sides[k][a.el];
        if (se != null && sides[k][a.wr] != null && sides[k][a.wr] !== se) sides[k][a.wr] = se;
      }
    }
  }
  // All'ancoraggio la mano tocca il viso (o il collo): la profondità della mano è quella del contatto e il
  // gomito si mette dietro, con l'avambraccio intero (l'omero si adatta di quel poco che serve)
  for (const [ai, a] of arms.entries()) {
    for (let i = 0; i < n; i++) {
      const ct = contact[ai][i];
      const zw = absZ[a.wr][i];
      const Jf = J[i];
      if (ct <= 0 || zw == null || !Jf[a.el] || !Jf[a.wr]) continue;
      const wz = Jf[a.wr][2] + (zw - Jf[a.wr][2]) * ct;
      const dzw = wz - Jf[a.wr][2];
      Jf[a.wr] = [Jf[a.wr][0], Jf[a.wr][1], wz];
      moveHand(Jf, a, dzw);
      const r = roots(Jf[a.wr], Jf[a.el], a.fa);
      const ez = Math.abs(r[0] - Jf[a.el][2]) < Math.abs(r[1] - Jf[a.el][2]) ? r[0] : r[1];
      Jf[a.el] = [Jf[a.el][0], Jf[a.el][1], Jf[a.el][2] + (ez - Jf[a.el][2]) * ct];
    }
  }
  // Ancoraggio alla bocca con la pinza mediterranea (indice sopra la cocca, medio e anulare sotto): la punta
  // dell'indice tocca l'angolo della bocca dal lato della corda, la corda sta appena fuori dal viso. Se nel
  // video la mano è vicina alla bocca (entro 9 cm) la si porta lì; se è lontana resta dov'è (è un errore
  // vero dell'arciere, che la valutazione deve vedere)
  {
    const ai = hand === "destro" ? 1 : 0;
    const a = arms[ai];
    const cornerId = hand === "destro" ? 10 : 9;
    const otherId = hand === "destro" ? 9 : 10;
    for (let i = 0; i < n; i++) {
      const ct = contact[ai][i];
      const Jf = J[i];
      const tip = Jf[a.hb + 8] ?? Jf[a.hand[1]];
      const mc = Jf[cornerId];
      const mo = Jf[otherId];
      if (ct <= 0 || !tip || !mc || !mo || !Jf[a.wr] || !Jf[a.el]) continue;
      // di lato verso la corda: perpendicolare alla linea di tiro (dalla mano della corda a quella dell'arco)
      const bw = arms[1 - ai];
      const aim = Jf[bw.wr] ? v3.sub(Jf[bw.wr], Jf[a.wr]) : v3.sub(mc, mo);
      const aimH = v3.norm([aim[0], 0, aim[2]]);
      let latN = v3.norm(v3.cross(aimH, [0, 1, 0]));
      if (hand !== "destro") latN = v3.mul(latN, -1);
      // l'angolo della bocca: dal centro della bocca 2,5 cm verso la corda, la punta dell'indice appena fuori
      const mouthC = v3.lerp(mc, mo, 0.5);
      const target = v3.add(mouthC, v3.mul(latN, 0.031));
      const d = v3.sub(target, tip);
      const dist = v3.len(d);
      const near = Math.max(0, Math.min(1, (0.14 - dist) / 0.06));
      const w = ct * near;
      if (w <= 0) continue;
      const mv = v3.mul(d, w);
      Jf[a.wr] = v3.add(Jf[a.wr], mv);
      for (const f of a.hand) if (Jf[f]) Jf[f] = v3.add(Jf[f], mv);
      for (let k = 0; k < 21; k++) if (Jf[a.hb + k]) Jf[a.hb + k] = v3.add(Jf[a.hb + k], mv);
      // il gomito tiene l'avambraccio intero: si sposta in profondità quanto serve
      const r = roots(Jf[a.wr], Jf[a.el], a.fa);
      const ez = Math.abs(r[0] - Jf[a.el][2]) < Math.abs(r[1] - Jf[a.el][2]) ? r[0] : r[1];
      Jf[a.el] = [Jf[a.el][0], Jf[a.el][1], ez];
    }
  }
  dbg?.("viterbi", J);
  // fuori da busto e testa; poi la profondità si liscia di nuovo (niente scatti) e si ricontrolla
  {
    // fuori da busto e testa. La spinta non arriva di colpo: comincia qualche fotogramma prima e finisce
    // qualche fotogramma dopo (sempre almeno quanto serve), così un braccio che passa davanti al busto
    // scivola fuori invece di scattare
    const before = J.map((Jf) => arms.map((a) => [Jf[a.el]?.[2] ?? 0, Jf[a.wr]?.[2] ?? 0]));
    for (let i = 0; i < n; i++) if (Object.keys(J[i]).length) keepArmsOut(J[i], cal, sides[i]);
    const R = Math.max(2, Math.round(fs * 0.2));
    for (const [ai, a] of arms.entries()) {
      for (const [slot, id] of [[0, a.el], [1, a.wr]] as const) {
        const d = J.map((Jf, i) => (Jf[id] ? Jf[id][2] - before[i][ai][slot] : 0));
        const pos = d.map((_, i) => {
          let m = 0;
          for (let k = Math.max(0, i - R); k <= Math.min(n - 1, i + R); k++) m = Math.max(m, d[k]);
          return m;
        });
        const neg = d.map((_, i) => {
          let m = 0;
          for (let k = Math.max(0, i - R); k <= Math.min(n - 1, i + R); k++) m = Math.min(m, d[k]);
          return m;
        });
        // media triangolare larga quanto la dilatazione: mai meno della spinta necessaria
        const tri = (v: number[], i: number) => {
          let acc = 0;
          let wsum = 0;
          for (let k = -R; k <= R; k++) {
            const j = i + k;
            if (j < 0 || j >= n) continue;
            const w = R + 1 - Math.abs(k);
            acc += v[j] * w;
            wsum += w;
          }
          return wsum ? acc / wsum : 0;
        };
        for (let i = 0; i < n; i++) {
          const Jf = J[i];
          if (!Jf[id]) continue;
          const D = tri(pos, i) + tri(neg, i);
          const z = before[i][ai][slot] + D;
          const dz = z - Jf[id][2];
          Jf[id] = [Jf[id][0], Jf[id][1], z];
          if (id === a.wr) moveHand(Jf, a, dz);
        }
      }
    }
    dbg?.("collide", J);
  }
  dbg?.("final", J);
  // ---- verso del palmo: continuo (una mano non si ribalta in un trentesimo di secondo) e liscio ----
  const palms: { L?: V3; R?: V3 }[] = frames.map(() => ({}));
  for (const [side, wr, ix, pk, hb] of [["L", 15, 19, 17, 33], ["R", 16, 20, 18, 54]] as const) {
    const raw_: (V3 | null)[] = J.map((Jf) => {
      const h = Jf[hb] && Jf[hb + 5] && Jf[hb + 17];
      const W = h ? Jf[hb] : Jf[wr];
      const IX = h ? Jf[hb + 5] : Jf[ix];
      const PK = h ? Jf[hb + 17] : Jf[pk];
      if (!W || !IX || !PK) return null;
      const c = v3.cross(v3.sub(IX, W), v3.sub(PK, W));
      const l = v3.len(c);
      return l > 1e-7 ? v3.mul(c, 1 / l) : null;
    });
    // segno scelto sull'intera sequenza: tenere quello letto costa poco, ribaltarsi da un fotogramma
    // all'altro costa moltissimo
    const cost: [number, number][] = [];
    const from: [number, number][] = [];
    let prevI = -1;
    for (let i = 0; i < n; i++) {
      const v = raw_[i];
      if (!v) {
        cost.push([0, 0]);
        from.push([0, 1]);
        continue;
      }
      if (prevI < 0) {
        cost.push([0, 1]);
        from.push([0, 1]);
      } else {
        const pv = raw_[prevI]!;
        const nc: [number, number] = [0, 0];
        const nf: [number, number] = [0, 1];
        for (let s_ = 0; s_ < 2; s_++) {
          let best = Infinity;
          for (let q = 0; q < 2; q++) {
            const d = v3.dot(v, pv) * (s_ === q ? 1 : -1);
            const val = cost[prevI][q] + (d < 0 ? 30 : 0) + 3 * (1 - d);
            if (val < best) {
              best = val;
              nf[s_] = q;
            }
          }
          nc[s_] = best + (s_ === 1 ? 1 : 0);
        }
        cost.push(nc);
        from.push(nf);
      }
      prevI = i;
    }
    const sign = new Array<number>(n).fill(1);
    {
      let i = n - 1;
      while (i >= 0 && !raw_[i]) i--;
      if (i >= 0) {
        let st = cost[i][0] <= cost[i][1] ? 0 : 1;
        while (i >= 0) {
          if (raw_[i]) {
            sign[i] = st === 0 ? 1 : -1;
            const q = from[i][st];
            st = q;
          }
          i--;
        }
      }
    }
    const cx = new Float64Array(n);
    const cy = new Float64Array(n);
    const cz = new Float64Array(n);
    const w = new Float64Array(n);
    let last: V3 = [0, 0, 1];
    for (let i = 0; i < n; i++) {
      const v = raw_[i];
      if (v) {
        last = v3.mul(v, sign[i]);
        w[i] = 1;
      }
      [cx[i], cy[i], cz[i]] = last;
    }
    const lam = lamFor(2.5, fs);
    const sx = robustSmooth(cx, w, lam, 0.05);
    const sy = robustSmooth(cy, w, lam, 0.05);
    const sz = robustSmooth(cz, w, lam, 0.05);
    for (let i = 0; i < n; i++) {
      if (!raw_[i]) continue;
      const v: V3 = [sx[i], sy[i], sz[i]];
      if (v3.len(v) > 1e-4) palms[i][side] = v3.norm(v);
    }
  }

  // ---- arco: corpo rigido filtrato ----
  const bows: (BowPose | null)[] = frames.map((f, i) => {
    const lm = lms[i];
    if (!lm || !keep[i] || !Object.keys(J[i]).length) return null;
    try {
      return buildModel(lm, aspect, hand, f.gear, cal, null, f.t, { J: J[i] })?.bowPose ?? null;
    } catch {
      return null;
    }
  });
  const bowOk = bows.map(Boolean);
  const comp = (get: (b: BowPose) => number, fc: number) => {
    const y = new Float64Array(n);
    const w = new Float64Array(n);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const b = bows[i];
      if (b) {
        y[i] = get(b);
        w[i] = 1;
        last = y[i];
      } else y[i] = last;
    }
    return robustSmooth(y, w, lamFor(fc, fs), 0.02);
  };
  const nx = comp((b) => b.n[0], 1.5);
  const ny = comp((b) => b.n[1], 1.5);
  const nz = comp((b) => b.n[2], 1.5);
  const ux = comp((b) => b.u[0], 2);
  const uy = comp((b) => b.u[1], 2);
  const uz = comp((b) => b.u[2], 2);
  // un arco non cambia lunghezza: la mediana sull'intero video
  const halves = bows.filter((b): b is BowPose => Boolean(b)).map((b) => b.half).sort((a, b) => a - b);
  const half = halves.length ? halves[Math.floor(halves.length / 2)] : 0.8;
  // freccia sulla corda: dentro un tiro sempre; fuori solo se lo stato dura (niente sfarfallio)
  const nockRaw = bows.map((b, i) => Boolean(frames[i].armed) || Boolean(b?.nocked));
  const nocked = nockRaw.slice();
  {
    let i = 0;
    while (i < n) {
      let j = i;
      while (j < n && nockRaw[j] === nockRaw[i]) j++;
      // un tratto breve (meno di 0,4 s) prende lo stato dei vicini
      if (frames[Math.min(n - 1, j)].t - frames[i].t < 0.4 && i > 0 && !frames[i].armed) for (let k = i; k < j; k++) nocked[k] = nocked[i - 1];
      i = j;
    }
  }
  return frames.map((_, i) => {
    if (!keep[i] || !Object.keys(J[i]).length || !J[i][11] || !J[i][12]) return null;
    let bow: BowPose | null = null;
    if (bowOk.some(Boolean)) {
      let u = v3.norm([ux[i], uy[i], uz[i]]);
      let nn: V3 = [nx[i], ny[i], nz[i]];
      // asse perpendicolare alla freccia, verso l'alto
      nn = v3.norm(v3.sub(nn, v3.mul(u, v3.dot(nn, u))));
      if (nn[1] < 0) nn = v3.mul(nn, -1);
      if (!Number.isFinite(u[0]) || !Number.isFinite(nn[0])) u = [1, 0, 0];
      bow = { n: nn, u, half, nocked: nocked[i] };
    }
    const lm = lms[i];
    const fr = lm ? imageFrame(lm, aspect, fixes[i]) : null;
    // il fotogramma segue lo spostamento dei piedi a terra: "come il video" resta allineato
    const frame = fr ? { ...fr, yTop: fr.yTop + shiftOf[i], yBot: fr.yBot + shiftOf[i] } : undefined;
    return { J: J[i], bow, palms: palms[i], frame };
  });
}
