/**
 * Corpo anatomico vero per il 3D dell'analisi del gesto: pelle, ossa e muscoli da BodyParts3D
 * (© The Database Center for Life Science, CC BY 4.0), semplificati e divisi in 17 segmenti.
 * Il modello è in posizione anatomica; ogni frame si calcola, per ogni segmento, la trasformazione
 * che lo porta dalla posa di riposo alla posa del video (osso per osso, con la torsione presa dalla
 * mano, dal gomito e dai piedi). La deformazione la fa la scheda grafica.
 */
import { v3, type V3 } from "./anatomy-model";
import type { Hand } from "./pose-analysis";
import { sides } from "./pose-analysis";

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

export const BODY_CREDIT = "Anatomia: BodyParts3D, © The Database Center for Life Science, CC BY 4.0";

let loading: Promise<BodyData | null> | null = null;
let loaded: BodyData | null = null;

/** scarica il corpo una volta sola (circa 2 MB compressi); null se non si riesce */
export function loadBody(): Promise<BodyData | null> {
  if (loaded) return Promise.resolve(loaded);
  if (!loading) {
    loading = (async () => {
      try {
        const [m, b] = await Promise.all([fetch("/anatomia/corpo.json"), fetch("/anatomia/corpo.bin")]);
        if (!m.ok || !b.ok) return null;
        const meta = (await m.json()) as BodyMeta;
        const buf = await b.arrayBuffer();
        if (buf.byteLength < meta.bytes) return null;
        loaded = { meta, buf };
        return loaded;
      } catch {
        loading = null;
        return null;
      }
    })();
  }
  return loading;
}
export function bodyIfLoaded() {
  return loaded;
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
function segMatrix(r: Frame, c: Frame, thick: number, out: Float32Array, at: number) {
  const s1 = c.L / r.L;
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
  const out = new Float32Array(meta.segments.length * 16);
  meta.segments.forEach((name, i) => {
    const r = Fr[name];
    const c = Fc[name];
    if (!r || !c) {
      out.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16);
      return;
    }
    segMatrix(r, c, 1, out, i * 16);
  });
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
