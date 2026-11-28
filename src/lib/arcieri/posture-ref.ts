/**
 * Postura di riferimento dell'arciere (arco nudo, pinza mediterranea, ancoraggio all'angolo della bocca), dalle
 * tavole biomeccaniche date dall'istruttore (ARC-TD-007, ARC-TD-008, BB-SET-001):
 *
 * - busto verticale (90° con il terreno, 0° di inclinazione), bacino quasi neutro (retroversione 0–5°);
 * - spalla dell'arco bassa e incassata, spalle in piano;
 * - testa dritta, girata di 80–90° verso il bersaglio;
 * - braccio dell'arco disteso, a circa 80–90° dal busto, gomito ruotato all'esterno;
 * - gomito della corda sulla linea di forza (in pianta 0° con mano dell'arco e bocca) e 15–20° sopra l'asse della
 *   freccia (circa 17°);
 * - piedi larghi come le spalle (40–45 cm), aperti di 15–20° (open stance), ginocchia distese e allineate, peso
 *   50/50 tra i piedi;
 * - presa mediterranea (un dito sopra la cocca, due sotto), indice all'angolo della bocca, corda che sfiora naso e
 *   labbro; mano dell'arco rilassata, spinta sull'eminenza tenar, nocche a circa 45°.
 *
 * Qui: le misure sulla sagoma 3D (punti in metri, y in su) e la sagoma corretta (stessi punti portati dentro le
 * fasce di riferimento, solo dove servono). Le stesse fasce entrano nell'analisi del gesto (pose-pro).
 */
import { HAND_L, HAND_R, FACE0, sides, type Hand } from "./pose-analysis";

type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const flat = (a: V3): V3 => norm([a[0], 0, a[2]]);
const DEG = 180 / Math.PI;
const UP: V3 = [0, 1, 0];
/** rotazione di p attorno all'asse (unitario) che passa per c */
function rot(p: V3, c: V3, ax: V3, ang: number): V3 {
  const v = sub(p, c);
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  const r = add(add(mul(v, cs), mul(cross(ax, v), sn)), mul(ax, dot(ax, v) * (1 - cs)));
  return add(c, r);
}

/** fasce di riferimento delle tavole */
export const POSTURE_REF = {
  trunkMax: 5, // gradi dalla verticale
  shoulderDropMax: 0.012, // spalla dell'arco più alta di quella della corda, metri
  headRollMax: 5, // gradi
  bowArmMin: 168, // gomito dell'arco, gradi (disteso)
  bowArmTrunk: [80, 95] as const, // braccio dell'arco rispetto al busto, gradi
  elbowRise: [15, 20] as const, // gomito della corda sopra l'asse della freccia, gradi
  forceLineMax: 8, // gomito fuori dalla linea di forza in pianta, gradi
  stanceWidth: [0.9, 1.25] as const, // piedi, in larghezze di spalle (40–45 cm)
  stanceOpen: [15, 20] as const, // apertura dei piedi, gradi
} as const;

export type PostureId = "busto" | "spallaArco" | "testa" | "braccioArco" | "altezzaBraccio" | "gomitoAlto" | "lineaForza" | "piediLarghezza" | "piediApertura";
export type PostureCheck = { id: PostureId; label: string; value: number; unit: string; ref: string; ok: boolean; /** dove scriverlo sulla sagoma */ at: V3; fix: string };

/** misure della postura sulla sagoma (punti del modello in metri) */
export function postureChecks(J: Record<number, V3>, hand: Hand): PostureCheck[] {
  const S = sides(hand);
  const out: PostureCheck[] = [];
  const bS = J[S.bow[0]], bE = J[S.bow[1]], bW = J[S.bow[2]];
  const dS = J[S.draw[0]], dE = J[S.draw[1]], dW = J[S.draw[2]];
  const hipL = J[23], hipR = J[24];
  if (!bS || !bE || !bW || !dS || !dE || !dW) return out;
  const shM = lerp(J[11], J[12], 0.5);
  const hipM = hipL && hipR ? lerp(hipL, hipR, 0.5) : null;
  const R = POSTURE_REF;
  if (hipM) {
    const a = norm(sub(shM, hipM));
    const tr = Math.acos(Math.max(-1, Math.min(1, dot(a, UP)))) * DEG;
    out.push({ id: "busto", label: "Busto verticale", value: tr, unit: "°", ref: `0–${R.trunkMax}°`, ok: tr <= R.trunkMax, at: lerp(shM, hipM, 0.45), fix: "raddrizza il busto sopra il bacino" });
  }
  const drop = bS[1] - dS[1];
  out.push({ id: "spallaArco", label: "Spalla dell'arco bassa", value: drop * 100, unit: " cm", ref: "non più alta dell'altra", ok: drop <= R.shoulderDropMax, at: bS, fix: "abbassa e incassa la spalla dell'arco" });
  if (J[7] && J[8]) {
    const e = norm(sub(J[8], J[7]));
    const roll = Math.abs(Math.asin(Math.max(-1, Math.min(1, dot(e, UP))))) * DEG;
    out.push({ id: "testa", label: "Testa dritta", value: roll, unit: "°", ref: `0–${R.headRollMax}°`, ok: roll <= R.headRollMax, at: lerp(J[7], J[8], 0.5), fix: "testa dritta, è la corda che viene al viso" });
  }
  const bowAng = angle(bS, bE, bW);
  out.push({ id: "braccioArco", label: "Braccio dell'arco disteso", value: bowAng, unit: "°", ref: `${R.bowArmMin}–180°`, ok: bowAng >= R.bowArmMin, at: bE, fix: "distendi il braccio, gomito ruotato all'esterno" });
  if (hipM) {
    const down = norm(sub(hipM, shM));
    const at = Math.acos(Math.max(-1, Math.min(1, dot(norm(sub(bW, bS)), down)))) * DEG;
    out.push({ id: "altezzaBraccio", label: "Braccio dell'arco a 80–90° dal busto", value: at, unit: "°", ref: `${R.bowArmTrunk[0]}–${R.bowArmTrunk[1]}°`, ok: at >= R.bowArmTrunk[0] - 2 && at <= R.bowArmTrunk[1] + 2, at: lerp(bS, bE, 0.5), fix: "braccio all'altezza della spalla" });
  }
  // gomito della corda: sopra l'asse della freccia e sulla linea di forza (in pianta)
  const back = norm(sub(dW, bW));
  const fe = norm(sub(dE, dW));
  const riseArrow = Math.asin(Math.max(-1, Math.min(1, back[1]))) * DEG;
  const riseElbow = Math.asin(Math.max(-1, Math.min(1, fe[1]))) * DEG;
  const rise = riseElbow - riseArrow;
  out.push({ id: "gomitoAlto", label: "Gomito 15–20° sopra la freccia", value: rise, unit: "°", ref: `${R.elbowRise[0]}–${R.elbowRise[1]}°`, ok: rise >= R.elbowRise[0] - 4 && rise <= R.elbowRise[1] + 5, at: dE, fix: rise < R.elbowRise[0] ? "alza il gomito della corda" : "abbassa il gomito della corda" });
  const bh = flat(back);
  const eh = flat(fe);
  const plan = Math.acos(Math.max(-1, Math.min(1, dot(bh, eh)))) * DEG;
  out.push({ id: "lineaForza", label: "Gomito sulla linea di forza", value: plan, unit: "°", ref: `0–${R.forceLineMax}°`, ok: plan <= R.forceLineMax, at: dE, fix: "porta il gomito dietro la freccia, scapola verso la colonna" });
  // piedi
  const aB = J[hand === "destro" ? 27 : 28];
  const aD = J[hand === "destro" ? 28 : 27];
  if (aB && aD && J[11] && J[12]) {
    const w = len(sub(J[11], J[12]));
    const f = sub(aB, aD);
    const width = len([f[0], 0, f[2]]) / Math.max(1e-3, w);
    out.push({ id: "piediLarghezza", label: "Piedi larghi come le spalle", value: width, unit: "×", ref: `${R.stanceWidth[0].toFixed(1).replace(".", ",")}–${R.stanceWidth[1].toFixed(2).replace(".", ",")} spalle (40–45 cm)`, ok: width >= R.stanceWidth[0] && width <= R.stanceWidth[1], at: lerp(aB, aD, 0.5), fix: "piedi alla larghezza delle spalle" });
    const open = stanceOpenOf(J, hand);
    if (open != null) out.push({ id: "piediApertura", label: "Piedi aperti 15–20° (open stance)", value: open, unit: "°", ref: `${R.stanceOpen[0]}–${R.stanceOpen[1]}°`, ok: open >= R.stanceOpen[0] - 5 && open <= R.stanceOpen[1] + 5, at: lerp(aB, aD, 0.5), fix: "piede dell'arco un poco indietro: busto aperto verso il bersaglio" });
  }
  return out;
}

function angle(a: V3, o: V3, b: V3) {
  return Math.acos(Math.max(-1, Math.min(1, dot(norm(sub(a, o)), norm(sub(b, o)))))) * DEG;
}

/** verso il bersaglio (orizzontale) e davanti al petto */
function frame(J: Record<number, V3>, hand: Hand) {
  const S = sides(hand);
  const toT = flat(sub(J[S.bow[2]], J[S.draw[0]]));
  let fwd = norm(cross(UP, toT));
  // il davanti è dove guarda il petto: dalla parte del naso rispetto alle spalle
  const shM = lerp(J[11], J[12], 0.5);
  if (J[0] && dot(sub(J[0], shM), fwd) < 0) fwd = mul(fwd, -1);
  return { toT, fwd };
}

/** apertura dei piedi: + = piede dell'arco indietro rispetto al petto (busto aperto verso il bersaglio) */
function stanceOpenOf(J: Record<number, V3>, hand: Hand): number | null {
  const aB = J[hand === "destro" ? 27 : 28];
  const aD = J[hand === "destro" ? 28 : 27];
  if (!aB || !aD) return null;
  const { toT, fwd } = frame(J, hand);
  const f = sub(aB, aD);
  const fh: V3 = [f[0], 0, f[2]];
  if (len(fh) < 0.05) return null;
  const n = norm(fh);
  return Math.atan2(-dot(n, fwd), dot(n, toT)) * DEG;
}

/** chiavi dei punti della testa (viso compreso) */
function headKeys(J: Record<number, V3>) {
  return Object.keys(J)
    .map(Number)
    .filter((k) => k <= 10 || k >= FACE0);
}
/** chiavi del braccio da un polso in giù (dita del corpo e 21 punti della mano) */
function handKeys(wr: number) {
  const base = wr === 15 ? HAND_L : HAND_R;
  const f = wr === 15 ? [17, 19, 21] : [18, 20, 22];
  return [...f, ...Array.from({ length: 21 }, (_, k) => base + k)];
}

/**
 * La sagoma con la postura delle tavole: si corregge solo quello che è fuori dalla fascia, il resto resta come nel
 * video. Ordine: busto, spalla dell'arco, testa, braccio dell'arco, gomito della corda, piedi.
 */
export function correctPosture(J0: Record<number, V3>, hand: Hand): { J: Record<number, V3>; fixed: PostureId[] } {
  const J: Record<number, V3> = {};
  for (const k of Object.keys(J0)) J[Number(k)] = [...J0[Number(k)]] as V3;
  const fixed: PostureId[] = [];
  const S = sides(hand);
  const R = POSTURE_REF;
  const have = (...ks: number[]) => ks.every((k) => J[k]);
  if (!have(11, 12, 13, 14, 15, 16)) return { J, fixed };
  const legs = new Set([23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);
  const move = (keys: number[], d: V3) => {
    for (const k of keys) if (J[k]) J[k] = add(J[k], d);
  };
  // 1. busto verticale: tutto quello che sta sopra il bacino ruota attorno al bacino
  if (have(23, 24)) {
    const hipM = lerp(J[23], J[24], 0.5);
    const shM = lerp(J[11], J[12], 0.5);
    const a = norm(sub(shM, hipM));
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(a, UP))));
    if (ang * DEG > R.trunkMax) {
      const ax = norm(cross(a, UP));
      for (const k of Object.keys(J).map(Number)) if (!legs.has(k)) J[k] = rot(J[k], hipM, ax, ang);
      fixed.push("busto");
    }
  }
  // 2. spalla dell'arco bassa: alla stessa altezza dell'altra, con il suo braccio
  const bowChain = [S.bow[0], S.bow[1], S.bow[2], ...handKeys(S.bow[2])];
  const drop = J[S.bow[0]][1] - J[S.draw[0]][1];
  if (drop > R.shoulderDropMax) {
    move(bowChain, [0, -drop, 0]);
    fixed.push("spallaArco");
  }
  // 3. testa dritta: orecchie in piano, rotazione attorno alla base del collo
  if (have(7, 8)) {
    const e = norm(sub(J[8], J[7]));
    const et = flat(e);
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(e, et))));
    if (ang * DEG > R.headRollMax) {
      const ax = norm(cross(e, et));
      const pivot = add(lerp(J[7], J[8], 0.5), [0, -0.11, 0]);
      for (const k of headKeys(J)) J[k] = rot(J[k], pivot, ax, ang);
      fixed.push("testa");
    }
  }
  // 4. braccio dell'arco: disteso e a 80–95° dal busto (stessa direzione verso il bersaglio)
  {
    const bS = J[S.bow[0]], bE = J[S.bow[1]], bW = J[S.bow[2]];
    const L1 = len(sub(bE, bS));
    const L2 = len(sub(bW, bE));
    let d = norm(sub(bW, bS));
    let changed = false;
    if (have(23, 24)) {
      const down = norm(sub(lerp(J[23], J[24], 0.5), lerp(J[11], J[12], 0.5)));
      const th = Math.acos(Math.max(-1, Math.min(1, dot(d, down)))) * DEG;
      const tgt = Math.max(R.bowArmTrunk[0], Math.min(R.bowArmTrunk[1], th));
      if (Math.abs(tgt - th) > 2) {
        const ax = norm(cross(down, d));
        d = norm(rot(d, [0, 0, 0], ax, ((tgt - th) * Math.PI) / 180));
        changed = true;
        fixed.push("altezzaBraccio");
      }
    }
    const straight = angle(bS, bE, bW) < R.bowArmMin;
    if (straight) fixed.push("braccioArco");
    if (changed || straight) {
      const reach = straight ? (L1 + L2) * 0.995 : len(sub(bW, bS));
      const W2 = add(bS, mul(d, reach));
      move(handKeys(S.bow[2]), sub(W2, bW));
      J[S.bow[2]] = W2;
      // gomito sulla linea spalla-polso, appena fuori (ruotato all'esterno, lontano dalla corda)
      const { fwd } = frame(J, hand);
      J[S.bow[1]] = straight ? add(add(bS, mul(d, L1 * (reach / (L1 + L2)))), mul(fwd, -0.004)) : add(bS, mul(norm(sub(bE, bS)), L1));
      if (!straight) {
        // stessa piega del gomito, ruotata con il braccio
        const old = norm(sub(bW, bS));
        const ax = cross(old, d);
        const s = len(ax);
        if (s > 1e-6) J[S.bow[1]] = rot(bE, bS, mul(ax, 1 / s), Math.asin(Math.min(1, s)));
      }
    }
  }
  // 5. gomito della corda: 15–20° sopra l'asse della freccia e dietro la freccia in pianta; il polso (ancoraggio)
  //    resta fermo. Il gomito può stare solo sul cerchio permesso da spalla e polso: si cerca sul cerchio il punto
  //    che rispetta meglio le due regole. La spalla della corda può chiudersi verso la schiena (chiusura scapolare)
  //    di pochi centimetri, solo in orizzontale: non si alza. Nessuna delle due misure deve peggiorare.
  {
    const dS0 = J[S.draw[0]], dE0 = J[S.draw[1]], dW = J[S.draw[2]], bW = J[S.bow[2]];
    const L1 = len(sub(dE0, dS0));
    const L2 = len(sub(dW, dE0));
    const back = norm(sub(dW, bW));
    const bh = flat(back);
    const beta = Math.asin(Math.max(-1, Math.min(1, back[1])));
    const measure = (E: V3) => {
      const fe = norm(sub(E, dW));
      return {
        rise: (Math.asin(Math.max(-1, Math.min(1, fe[1]))) - beta) * DEG,
        plan: Math.acos(Math.max(-1, Math.min(1, dot(bh, flat(fe))))) * DEG,
      };
    };
    const m0 = measure(dE0);
    const badRise = m0.rise < R.elbowRise[0] - 4 || m0.rise > R.elbowRise[1] + 5;
    const badPlan = m0.plan > R.forceLineMax;
    if ((badRise || badPlan) && L1 > 0.05 && L2 > 0.05) {
      const riseMid = (R.elbowRise[0] + R.elbowRise[1]) / 2;
      const riseOut = (r: number) => Math.max(0, Math.abs(r - riseMid) - 2.5);
      const planOut = (q: number) => Math.max(0, q - R.forceLineMax * 0.5);
      const { fwd } = frame(J, hand);
      const side = norm(cross(UP, bh));
      let best: { cost: number; S: V3; E: V3; rise: number; plan: number } | null = null;
      for (const sb of [0, 0.015, 0.03, 0.04]) {
        for (const ss of [-0.03, -0.015, 0, 0.015, 0.03]) {
          const shift = add(mul(bh, sb), mul(side, ss));
          const sl = len(shift);
          if (sl > 0.041 || dot(shift, fwd) > 0.005) continue; // la spalla non va avanti verso il petto
          const dS = add(dS0, shift);
          const sw = sub(dW, dS);
          const dd = len(sw);
          if (dd >= L1 + L2 - 1e-4 || dd <= Math.abs(L1 - L2) + 1e-4) continue;
          const n = mul(sw, 1 / dd);
          const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd);
          const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
          const c = add(dS, mul(n, a));
          let u = sub(dE0, c);
          u = sub(u, mul(n, dot(u, n)));
          u = len(u) < 1e-6 ? norm(cross(n, UP)) : norm(u);
          const v = cross(n, u);
          for (let k = 0; k < 120; k++) {
            const phi = (k / 120) * Math.PI * 2;
            const E = add(c, add(mul(u, h * Math.cos(phi)), mul(v, h * Math.sin(phi))));
            const m = measure(E);
            // nessuna misura peggiora rispetto al video
            if (riseOut(m.rise) > riseOut(m0.rise) + 0.01 || planOut(m.plan) > planOut(m0.plan) + 0.01) continue;
            const cost = riseOut(m.rise) ** 2 + planOut(m.plan) ** 2 + 400 * len(sub(E, dE0)) ** 2 + 2000 * sl * sl;
            if (!best || cost < best.cost) best = { cost, S: dS, E, rise: m.rise, plan: m.plan };
          }
        }
      }
      if (best && (riseOut(best.rise) < riseOut(m0.rise) - 0.5 || planOut(best.plan) < planOut(m0.plan) - 0.5)) {
        J[S.draw[0]] = best.S;
        J[S.draw[1]] = best.E;
        if (badRise && riseOut(best.rise) < riseOut(m0.rise) - 0.5) fixed.push("gomitoAlto");
        if (badPlan && planOut(best.plan) < planOut(m0.plan) - 0.5) fixed.push("lineaForza");
      }
    }
  }
  // 6. piedi: larghi come le spalle e aperti di 17°, gambe distese dal bacino
  const kB = hand === "destro" ? 27 : 28;
  const kD = hand === "destro" ? 28 : 27;
  if (have(kB, kD, 23, 24, 25, 26)) {
    const w = len(sub(J[11], J[12]));
    const aB = J[kB], aD = J[kD];
    const f0: V3 = [aB[0] - aD[0], 0, aB[2] - aD[2]];
    const width = len(f0) / Math.max(1e-3, w);
    const open = stanceOpenOf(J, hand);
    const badW = width < R.stanceWidth[0] || width > R.stanceWidth[1];
    const badO = open != null && (open < R.stanceOpen[0] - 5 || open > R.stanceOpen[1] + 5);
    if (badW || badO) {
      const { toT, fwd } = frame(J, hand);
      const o = (17.5 * Math.PI) / 180;
      const f = norm(sub(mul(toT, Math.cos(o)), mul(fwd, Math.sin(o))));
      // dentro la fascia, non sul bordo: circa una larghezza di spalle
      const W = (width < R.stanceWidth[0] ? 1.0 : width > R.stanceWidth[1] ? 1.15 : width) * w;
      const G = lerp(aB, aD, 0.5);
      const tB: V3 = [G[0] + (f[0] * W) / 2, aB[1], G[2] + (f[2] * W) / 2];
      const tD: V3 = [G[0] - (f[0] * W) / 2, aD[1], G[2] - (f[2] * W) / 2];
      const yaw = Math.atan2(f0[0], f0[2]) - Math.atan2(f[0], f[2]);
      // bacino allineato ai piedi (coscia e ginocchio sopra il piede): le anche girano sulla nuova linea dei piedi,
      // al massimo 45°; spalle e busto restano sulla linea della freccia
      {
        const hB = kB - 4, hD = kD - 4;
        const hd = flat(sub(J[hB], J[hD]));
        let a = Math.atan2(hd[0], hd[2]) - Math.atan2(f[0], f[2]);
        while (a > Math.PI) a -= 2 * Math.PI;
        while (a < -Math.PI) a += 2 * Math.PI;
        a = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, a));
        if (Math.abs(a) > 0.02) {
          const hm = lerp(J[hB], J[hD], 0.5);
          J[hB] = rot(J[hB], hm, UP, -a);
          J[hD] = rot(J[hD], hm, UP, -a);
        }
      }
      for (const [ank, tgt, hip, knee, heel, toe] of [[kB, tB, kB - 4, kB - 2, kB + 2, kB + 4], [kD, tD, kD - 4, kD - 2, kD + 2, kD + 4]] as const) {
        const old = J[ank];
        // tallone e punta seguono la caviglia e girano con la linea dei piedi
        for (const p of [heel, toe]) if (J[p]) J[p] = add(rot(J[p], old, UP, -yaw), sub(tgt, old));
        J[ank] = tgt;
        // ginocchio sulla gamba distesa, alla stessa proporzione
        const th = len(sub(J[knee], J[hip]));
        const sh = len(sub(old, J[knee]));
        J[knee] = lerp(J[hip], tgt, th / Math.max(1e-6, th + sh));
      }
      if (badW) fixed.push("piediLarghezza");
      if (badO) fixed.push("piediApertura");
    }
  }
  return { J, fixed };
}

/** sagoma: come nel video o con la postura delle tavole (lo legge buildModel) */
export const postureMode = { fix: false };

/** costruisce con la sagoma corretta (o no) solo per questa chiamata: le analisi restano sul gesto vero */
export function withPosture<T>(fix: boolean, f: () => T): T {
  const prev = postureMode.fix;
  postureMode.fix = fix;
  try {
    return f();
  } finally {
    postureMode.fix = prev;
  }
}
