/**
 * Corpo anatomico vero per il 3D dell'analisi del gesto: pelle, ossa e muscoli da BodyParts3D
 * (© The Database Center for Life Science, CC BY 4.0); gran dorsale, retto dell'addome e obliquo esterno
 * da Z-Anatomy (CC BY-SA 4.0). Il file del corpo (public/anatomia) è distribuito con CC BY-SA 4.0.
 * Il modello è in posizione anatomica; ogni frame si calcola, per ogni segmento, la trasformazione
 * che lo porta dalla posa di riposo alla posa del video (osso per osso, con la torsione presa dalla
 * mano, dal gomito e dai piedi). La deformazione la fa la scheda grafica.
 */
import { v3, type V3 } from "./anatomy-model";
import type { Hand } from "./pose-analysis";
import { FACE0, FACE_IDS, sides } from "./pose-analysis";

export type BodyBatch = { layer: "skin" | "bone" | "muscle"; vertices: number; indices: number; vOffset: number; iOffset: number };
export type BodyMeta = {
  version: number;
  source: string;
  lo: V3;
  hi: V3;
  stride: number;
  segments: string[];
  groups: string[];
  rest: Record<string, V3>;
  batches: BodyBatch[];
  bytes: number;
};
export type BodyData = { meta: BodyMeta; buf: ArrayBuffer };

export const BODY_CREDIT = "Anatomia: BodyParts3D © DBCLS (CC BY 4.0) · Z-Anatomy (CC BY-SA 4.0)";

export type BodyLevel = "leggero" | "pieno";
const FILES: Record<BodyLevel, string> = { leggero: "corpo-leggero", pieno: "corpo" };
const loading: Partial<Record<BodyLevel, Promise<BodyData | null>>> = {};
const loaded: Partial<Record<BodyLevel, BodyData>> = {};

/** il file compresso pesa un terzo in meno: si apre nel telefono; senza questa funzione si scarica quello intero */
async function fetchBody(name: string): Promise<ArrayBuffer> {
  const DS = (globalThis as { DecompressionStream?: new (f: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
  if (DS) {
    try {
      const r = await fetch(`/anatomia/${name}.bin.gz`);
      if (r.ok) {
        const raw = await r.arrayBuffer();
        const b = new Uint8Array(raw, 0, 2);
        // se il server l'ha già aperto (intestazione gzip assente) si usa così com'è
        if (b[0] !== 0x1f || b[1] !== 0x8b) return raw;
        return await new Response(new Blob([raw]).stream().pipeThrough(new DS("gzip"))).arrayBuffer();
      }
    } catch {
      /* si prova con quello intero */
    }
  }
  const r = await fetch(`/anatomia/${name}.bin`);
  if (!r.ok) throw new Error("corpo");
  return r.arrayBuffer();
}

/**
 * Scarica il corpo una volta sola. "leggero" (circa 1,5 MB) si usa mentre il corpo si muove,
 * "pieno" (circa 4,7 MB) quando è fermo. null se non si riesce.
 */
export function loadBody(level: BodyLevel = "pieno"): Promise<BodyData | null> {
  const done = loaded[level];
  if (done) return Promise.resolve(done);
  if (!loading[level]) {
    loading[level] = (async () => {
      try {
        const m = await fetch(`/anatomia/${FILES[level]}.json`);
        if (!m.ok) return null;
        const meta = (await m.json()) as BodyMeta;
        const buf = await fetchBody(FILES[level]);
        if (buf.byteLength < meta.bytes) return null;
        loaded[level] = { meta, buf };
        return loaded[level] ?? null;
      } catch {
        delete loading[level];
        return null;
      }
    })();
  }
  return loading[level] ?? Promise.resolve(null);
}
export function bodyIfLoaded(level: BodyLevel = "pieno") {
  return loaded[level] ?? null;
}

const { add, sub, mul, dot, cross, len, norm, lerp } = v3;

function perpTo(e1: V3, ref: V3, fallback: V3): V3 {
  let r = sub(ref, mul(e1, dot(ref, e1)));
  if (len(r) < 1e-5) r = sub(fallback, mul(e1, dot(fallback, e1)));
  if (len(r) < 1e-5) r = Math.abs(e1[0]) < 0.9 ? sub([1, 0, 0], mul(e1, e1[0])) : sub([0, 0, 1], mul(e1, e1[2]));
  return norm(r);
}

type Frame = { o: V3; e1: V3; e2: V3; e3: V3; L: number };
function frame(a: V3, b: V3, ref: V3, fallback: V3): Frame {
  const d = sub(b, a);
  const L = len(d) || 1e-4;
  const e1 = mul(d, 1 / L);
  const e2 = perpTo(e1, ref, fallback);
  return { o: a, e1, e2, e3: cross(e1, e2), L };
}

/** matrice (colonne, come WebGL) che porta il segmento di riposo su quello attuale */
function segMatrix(r: Frame, c: Frame, thick: number, out: Float32Array, at: number, lo = 0, hi = 99) {
  const s1 = Math.max(lo, Math.min(hi, c.L / r.L));
  // M = Tc * Bc * S * Br^T * T(-ro)
  const Bc = [c.e1, c.e2, c.e3];
  const Br = [r.e1, r.e2, r.e3];
  const sc = [s1, thick, thick];
  const m3 = (i: number, j: number) => {
    // riga i, colonna j del blocco 3x3: sum_k Bc[k][i] * sc[k] * Br[k][j]
    let v = 0;
    for (let k = 0; k < 3; k++) v += Bc[k][i] * sc[k] * Br[k][j];
    return v;
  };
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) out[at + j * 4 + i] = m3(i, j);
  out[at + 3] = out[at + 7] = out[at + 11] = 0;
  for (let i = 0; i < 3; i++) {
    let t = c.o[i];
    for (let j = 0; j < 3; j++) t -= m3(i, j) * r.o[j];
    out[at + 12 + i] = t;
  }
  out[at + 15] = 1;
}

type Pts = (i: number | string) => V3 | undefined;

/** i 17 segmenti (stesso ordine del file) costruiti con gli stessi gesti per riposo e video */
function frames(P: Pts, hands: { L: [number, number, number] | null; R: [number, number, number] | null }) {
  const get = (i: number | string) => P(i) ?? [0, 0, 0];
  const shL = get(11), shR = get(12), hipL = get(23), hipR = get(24);
  const shM = lerp(shL, shR, 0.5), hipM = lerp(hipL, hipR, 0.5);
  const up = norm(sub(shM, hipM));
  const lrS = sub(shL, shR), lrH = sub(hipL, hipR);
  const fwd = norm(cross(norm(lrS), up));
  const fwdH = norm(cross(norm(lrH), up));
  const earM = lerp(get(7), get(8), 0.5);
  const F: Record<string, Frame> = {};
  F.bacino = frame(hipM, shM, lrH, lrS);
  F.torace = frame(hipM, shM, lrS, lrH);
  F.testa = frame(shM, earM, sub(get(0), earM), fwd);
  const notch = P("notch") ?? add(shM, mul(fwd, 0.04));
  for (const s of ["L", "R"] as const) {
    const [sh, el, wr, pk, ix, hip, kn, an, he, to] = s === "L" ? [11, 13, 15, 17, 19, 23, 25, 27, 29, 31] : [12, 14, 16, 18, 20, 24, 26, 28, 30, 32];
    const h = hands[s];
    const W = h ? get(h[0]) : get(wr);
    const IX = h ? get(h[1]) : get(ix);
    const PK = h ? get(h[2]) : get(pk);
    const palm = cross(sub(IX, W), sub(PK, W));
    F[`clav_${s}`] = frame(notch, get(sh), up, fwd);
    // braccio: la torsione viene dal piano del gomito quando è piegato, altrimenti dal davanti del busto
    const ua = norm(sub(get(el), get(sh)));
    const fa = sub(get(wr), get(el));
    const bend = sub(fa, mul(ua, dot(fa, ua)));
    const bl = len(bend) / (len(fa) || 1);
    const w = Math.max(0, Math.min(1, (bl - 0.18) / 0.3));
    const fwdP = perpTo(ua, fwd, up);
    const ref = w > 0 ? norm(add(mul(fwdP, 1 - w), mul(norm(bend), w))) : fwdP;
    F[`omero_${s}`] = frame(get(sh), get(el), ref, fwd);
    F[`avambr_${s}`] = frame(get(el), W, palm, fwd);
    F[`mano_${s}`] = frame(W, lerp(IX, PK, 0.5), palm, fwd);
    F[`coscia_${s}`] = frame(get(hip), get(kn), fwdH, fwd);
    F[`gamba_${s}`] = frame(get(kn), get(an), sub(get(to), get(he)), fwdH);
    F[`piede_${s}`] = frame(get(he), get(to), sub(get(kn), get(an)), up);
  }
  return F;
}

/**
 * Matrici dei 17 segmenti per la posa attuale. J: punti in metri come in anatomy-model
 * (indici della posa, mani da 33 e 54 se rilevate).
 */
export function bodyMatrices(meta: BodyMeta, J: Record<number, V3>): Float32Array {
  const rest = (i: number | string) => meta.rest[String(i)];
  const hasHand = (base: number) => Boolean(J[base] && J[base + 5] && J[base + 17]);
  // le mani da 21 punti hanno nocche vere: con quelle si usano le teste dei metacarpi del modello
  const handsCur = { L: hasHand(33) ? ([33, 38, 50] as [number, number, number]) : null, R: hasHand(54) ? ([54, 59, 71] as [number, number, number]) : null };
  const Fr = frames(rest, { L: null, R: null });
  const Fc = frames((i) => (typeof i === "number" ? J[i] : undefined), handsCur);
  // il punto di attacco delle clavicole segue il busto
  const tor = Fr.torace;
  const torC = Fc.torace;
  const n0 = rest("notch");
  if (n0) {
    const d = sub(n0, tor.o);
    const k = torC.L / tor.L;
    const nCur = add(torC.o, add(add(mul(torC.e1, dot(d, tor.e1) * k), mul(torC.e2, dot(d, tor.e2))), mul(torC.e3, dot(d, tor.e3))));
    for (const s of ["L", "R"] as const) {
      const sh = J[s === "L" ? 11 : 12];
      const up = norm(sub(lerp(J[11], J[12], 0.5), lerp(J[23], J[24], 0.5)));
      Fc[`clav_${s}`] = frame(nCur, sh, up, [0, 0, 1]);
    }
  }
  // scala del corpo nel video: dal busto, che è la misura più stabile
  const kT = Math.max(0.5, Math.min(2, Fc.torace.L / Fr.torace.L));
  // testa: con i punti del viso si gira come nel video (mento -> fronte, linea degli occhi);
  // dal viso si prende solo la direzione: posizione e grandezza restano quelle del collo,
  // così un viso letto male non stira la testa fuori dal corpo
  const fi = (id: number) => FACE0 + FACE_IDS.indexOf(id);
  const chin = J[fi(152)], brow = J[fi(10)], eyeL = J[fi(263)], eyeR = J[fi(33)];
  const r0 = rest("mento"), r1 = rest("fronte");
  if (chin && brow && eyeL && eyeR && r0 && r1) {
    const def = Fc.testa;
    const defR = Fr.testa;
    const dir = norm(sub(brow, chin));
    // il viso deve essere girato in modo credibile rispetto al collo (meno di 60 gradi)
    if (len(sub(brow, chin)) > 1e-4 && dot(dir, def.e1) > 0.5) {
      // mento attuale: il mento di riposo portato con la testa che segue il collo
      const d = sub(r0, defR.o);
      const k = def.L / defR.L;
      const chinNow = add(def.o, add(add(mul(def.e1, dot(d, defR.e1) * k), mul(def.e2, dot(d, defR.e2))), mul(def.e3, dot(d, defR.e3))));
      const Lr = len(sub(r1, r0));
      Fr.testa = frame(r0, r1, [1, 0, 0], [0, 0, 1]);
      Fc.testa = frame(chinNow, add(chinNow, mul(dir, Lr * kT)), sub(eyeL, eyeR), [0, 0, 1]);
    }
  }
  // dita (quattro insieme) e pollice: con i 21 punti della mano si piegano; senza, seguono la mano
  for (const s of ["L", "R"] as const) {
    const base = s === "L" ? 33 : 54;
    const has = hasHand(base) && J[base + 8] && J[base + 20] && J[base + 2] && J[base + 4];
    const d0 = rest(`dita0_${s}`), d1 = rest(`dita1_${s}`), p0 = rest(`pol0_${s}`), p1 = rest(`pol1_${s}`);
    if (!has || !d0 || !d1 || !p0 || !p1) continue;
    const avg = (ks: number[]) => mul(ks.reduce((acc, k) => add(acc, J[base + k]), [0, 0, 0] as V3), 1 / ks.length);
    const palmR = cross(sub(rest(s === "L" ? 19 : 20) ?? d0, rest(s === "L" ? 15 : 16) ?? d0), sub(rest(s === "L" ? 17 : 18) ?? d0, rest(s === "L" ? 15 : 16) ?? d0));
    const palmC = cross(sub(J[base + 5], J[base]), sub(J[base + 17], J[base]));
    Fr[`dita_${s}`] = frame(d0, d1, palmR, [0, 0, 1]);
    Fr[`pollice_${s}`] = frame(p0, p1, palmR, [0, 0, 1]);
    // dita e pollice: direzione dai punti della mano, lunghezza vera (mai stirate)
    const fingers = (a: V3, b: V3, r: Frame) => {
      const v = sub(b, a);
      const l = len(v);
      const Lk = r.L * kT;
      return frame(a, l > 1e-5 ? add(a, mul(v, Math.min(1.15, Math.max(0.35, l / Lk)) * (Lk / l))) : add(a, mul(r.e1, Lk)), palmC, [0, 0, 1]);
    };
    Fc[`dita_${s}`] = fingers(avg([5, 9, 13, 17]), avg([8, 12, 16, 20]), Fr[`dita_${s}`]);
    Fc[`pollice_${s}`] = fingers(J[base + 2], J[base + 4], Fr[`pollice_${s}`]);
  }
  const out = new Float32Array(meta.segments.length * 16);
  const idx = (name: string) => meta.segments.indexOf(name);
  meta.segments.forEach((name, i) => {
    const r = Fr[name];
    const c = Fc[name];
    if (!r || !c) {
      out.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16);
      return;
    }
    // nessun pezzo si allunga o si accorcia oltre il credibile rispetto al busto:
    // gli errori di profondità del video non stirano più braccia, gambe e testa
    const lo = name === "torace" || name === "bacino" ? 0 : kT * 0.8;
    const hi = name === "torace" || name === "bacino" ? 99 : kT * 1.22;
    segMatrix(r, c, 1, out, i * 16, lo, hi);
  });
  // dita senza punti della mano: stessa trasformazione della mano
  for (const s of ["L", "R"] as const) {
    const m = idx(`mano_${s}`);
    for (const f of [`dita_${s}`, `pollice_${s}`]) {
      const k = idx(f);
      if (k >= 0 && m >= 0 && !Fc[f]) out.copyWithin(k * 16, m * 16, m * 16 + 16);
    }
  }
  return out;
}

/**
 * Quanto lavora ogni gruppo del file (0..1), dagli stessi muscoli del modello semplice
 * (id "arco-deltoide-med", "corda-dorsale", "addome", ...). focus: gruppi da mettere in evidenza.
 */
export function groupValues(meta: BodyMeta, hand: Hand, acts: Map<string, number>, focus?: Set<string> | null) {
  const S = sides(hand);
  const leftIs = S.bow[0] === 11 ? "arco" : "corda";
  const rightIs = leftIs === "arco" ? "corda" : "arco";
  const n = meta.groups.length;
  const act = new Float32Array(Math.ceil(n / 4) * 4);
  const foc = new Float32Array(Math.ceil(n / 4) * 4);
  meta.groups.forEach((g, i) => {
    if (!g) return;
    const [side, name] = g.includes(":") ? (g.split(":") as [string, string]) : ["C", g];
    const ids = side === "L" ? [`${leftIs}-${name}`, name] : side === "R" ? [`${rightIs}-${name}`, name] : [name, `arco-${name}`, `corda-${name}`];
    let a = 0;
    let f = 0;
    for (const id of ids) {
      a = Math.max(a, acts.get(id) ?? 0);
      if (focus?.has(id)) f = 1;
    }
    act[i] = a;
    foc[i] = focus ? (f ? 1 : -1) : 0;
  });
  return { act, foc };
}

export function bodyCenter(meta: BodyMeta) {
  return lerp(meta.lo, meta.hi, 0.5);
}
