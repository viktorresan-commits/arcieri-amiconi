/**
 * Corpo anatomico vero per il 3D dell'analisi del gesto: pelle, ossa e muscoli da BodyParts3D
 * (© The Database Center for Life Science, CC BY 4.0); gran dorsale, retto dell'addome e obliquo esterno
 * da Z-Anatomy (CC BY-SA 4.0). Il file del corpo (public/anatomia) è distribuito con CC BY-SA 4.0.
 * Il modello è in posizione anatomica; ogni frame si calcola, per ogni segmento, la trasformazione
 * che lo porta dalla posa di riposo alla posa del video (osso per osso, con la torsione presa dalla
 * mano, dal gomito e dai piedi). La deformazione la fa la scheda grafica.
 */
import { v3, type Build, type V3 } from "./anatomy-model";
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

export const BODY_CREDIT = "Anatomia: BodyParts3D © DBCLS (CC BY 4.0) · Z-Anatomy (CC BY-SA 4.0) · Arco Samik Sage: signguy (CC BY 3.0)";

/** leggero: in movimento; pieno: fermo; hd: piena definizione dell'atlante, solo per foto e video in alta definizione */
export type BodyLevel = "leggero" | "pieno" | "hd";
const FILES: Record<BodyLevel, string> = { leggero: "corpo-leggero", pieno: "corpo", hd: "corpo-hd" };
const loading: Partial<Record<BodyLevel, Promise<BodyData | null>>> = {};
const loaded: Partial<Record<BodyLevel, BodyData>> = {};

/** il file compresso pesa un terzo in meno: si apre nel telefono; senza questa funzione si scarica quello intero */
/**
 * Il corpo scaricato resta sul telefono (memoria della pagina): la seconda volta si apre subito, senza
 * scaricare di nuovo diversi MB. La versione è l'impronta della sua descrizione: un corpo nuovo si riscarica.
 */
async function cachedBody(name: string, ver: string, get: () => Promise<ArrayBuffer>): Promise<ArrayBuffer> {
  const key = `/anatomia/${name}.bin?v=${ver}`;
  let store: Cache | null = null;
  try {
    store = typeof caches !== "undefined" ? await caches.open("anatomia") : null;
    const hit = await store?.match(key);
    if (hit) return await hit.arrayBuffer();
  } catch {
    store = null;
  }
  const buf = await get();
  if (store) {
    try {
      // le versioni vecchie dello stesso corpo si tolgono
      for (const req of await store.keys()) if (req.url.includes(`/anatomia/${name}.bin?v=`) && !req.url.endsWith(`v=${ver}`)) await store.delete(req);
      await store.put(key, new Response(buf.slice(0)));
    } catch {
      /* memoria piena o non permessa: va bene lo stesso */
    }
  }
  return buf;
}

async function fetchBody(name: string, gzOnly = false): Promise<ArrayBuffer> {
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
  // il corpo in alta definizione c'è solo compresso
  if (gzOnly) throw new Error("corpo");
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
        const text = await m.text();
        const meta = JSON.parse(text) as BodyMeta;
        let h = 0;
        for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
        const buf = await cachedBody(FILES[level], `${meta.bytes}-${(h >>> 0).toString(36)}`, () => fetchBody(FILES[level], level === "hd"));
        if (buf.byteLength < meta.bytes) return null;
        rigFingers(meta, buf);
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
/**
 * Tendini delle dita. Nel file i tendini che corrono sul dorso e sul palmo delle dita (estensori e
 * flessori) seguono solo la mano: con le dita piegate restavano dritti e uscivano come fili. Qui,
 * una volta sola all'apertura, i vertici dei muscoli che stanno sulle dita passano piano piano alle
 * dita (e al pollice), dalle nocche in avanti.
 */
export function rigFingers(meta: BodyMeta, buf: ArrayBuffer) {
  const st = meta.stride;
  const lo = meta.lo;
  const hi = meta.hi;
  const segs = meta.segments;
  const parts: { seg: number; hand: number; a: V3; ax: V3; L: number; lat: number }[] = [];
  for (const s of ["L", "R"] as const) {
    const hand = segs.indexOf(`mano_${s}`);
    for (const [name, p0, p1, lat] of [[`dita_${s}`, `dita0_${s}`, `dita1_${s}`, 0.05], [`pollice_${s}`, `pol0_${s}`, `pol1_${s}`, 0.025]] as const) {
      const seg = segs.indexOf(name);
      const a = meta.rest[p0];
      const b = meta.rest[p1];
      if (seg < 0 || hand < 0 || !a || !b) continue;
      const d = sub(b, a);
      const L = len(d);
      if (L < 1e-3) continue;
      parts.push({ seg, hand, a, ax: mul(d, 1 / L), L, lat });
    }
  }
  if (!parts.length) return;
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  for (const b of meta.batches) {
    if (b.layer !== "muscle") continue;
    for (let i = 0; i < b.vertices; i++) {
      const o = b.vOffset + i * st;
      const ja = u8[o + 9];
      const jb = u8[o + 10];
      const w = u8[o + 11];
      for (const f of parts) {
        // solo i vertici che seguono soltanto la mano
        const onlyHand = (ja === f.hand && (w === 255 || jb === f.hand)) || (jb === f.hand && w === 0 && ja !== f.seg);
        if (!onlyHand) continue;
        const p: V3 = [0, 1, 2].map((k) => lo[k] + (dv.getUint16(o + k * 2, true) / 65535) * (hi[k] - lo[k])) as V3;
        const rel = sub(p, f.a);
        const t = dot(rel, f.ax) / f.L;
        if (t <= 0 || t > 1.3) continue;
        if (len(sub(rel, mul(f.ax, dot(rel, f.ax)))) > f.lat) continue;
        const k = Math.max(0, Math.min(1, t / 0.3));
        u8[o + 9] = f.seg;
        u8[o + 10] = f.hand;
        u8[o + 11] = Math.round(k * 255);
        break;
      }
    }
  }
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
function frames(P: Pts, hands: { L: [number, number, number] | null; R: [number, number, number] | null }, look?: V3, palms?: { L?: V3; R?: V3 } | null) {
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
  // testa: segue il collo; se lo sguardo va in giù (o in su) il collo si piega in avanti (o indietro)
  let headTop = earM;
  let lookH = look;
  if (look) {
    const lv = dot(look, up);
    if (Math.abs(lv) > 0.01 && Math.abs(lv) < 0.99) {
      lookH = norm(sub(look, mul(up, lv)));
      const tilt = -Math.asin(Math.max(-1, Math.min(1, lv))) * 0.7;
      const ax = sub(earM, shM);
      headTop = add(shM, mul(norm(add(mul(norm(ax), Math.cos(tilt)), mul(lookH, Math.sin(tilt)))), len(ax)));
    }
  }
  F.testa = frame(shM, headTop, lookH ?? sub(get(0), earM), fwd);
  const notch = P("notch") ?? add(shM, mul(fwd, 0.04));
  for (const s of ["L", "R"] as const) {
    const [sh, el, wr, pk, ix, hip, kn, an, he, to] = s === "L" ? [11, 13, 15, 17, 19, 23, 25, 27, 29, 31] : [12, 14, 16, 18, 20, 24, 26, 28, 30, 32];
    const h = hands[s];
    const W = h ? get(h[0]) : get(wr);
    const IX = h ? get(h[1]) : get(ix);
    const PK = h ? get(h[2]) : get(pk);
    // verso del palmo: quello filtrato sull'intero video (continuo, senza ribaltoni) se c'è
    const palm = palms?.[s] ?? cross(sub(IX, W), sub(PK, W));
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
/** presa delle dita: «hook» la mano della corda aggancia la corda, «wrap» quella dell'arco stringe l'impugnatura */
export type Grips = {
  /** lato (sinistro/destro della persona) e quanto è in presa, 0..1 */
  hook?: { side: "L" | "R"; k: number; toward: V3 };
  wrap?: { side: "L" | "R"; k: number; toward: V3; /** asse dell'arco all'impugnatura (verso il flettente alto) */ axis?: V3; /** verso il bersaglio */ dir?: V3 };
};

export function bodyMatrices(meta: BodyMeta, J: Record<number, V3>, look?: V3, grips?: Grips, /** 32 numeri: la piega delle dita in presa per la scheda grafica (mano S, poi D) */ curl?: Float32Array, /** 16 numeri: piega di ogni dito dai punti della mano (nocca e falangi; mano S, poi D) */ fing?: Float32Array, /** corporatura dall'aura dell'arciere: spessore di busto, braccia, gambe e testa */ build?: Build, /** verso del palmo per mano, filtrato sull'intero video */ palms?: { L?: V3; R?: V3 } | null): Float32Array {
  const rest = (i: number | string) => meta.rest[String(i)];
  const hasHand = (base: number) => Boolean(J[base] && J[base + 5] && J[base + 17]);
  // le mani da 21 punti hanno nocche vere: con quelle si usano le teste dei metacarpi del modello
  const handsCur = { L: hasHand(33) ? ([33, 38, 50] as [number, number, number]) : null, R: hasHand(54) ? ([54, 59, 71] as [number, number, number]) : null };
  const Fr = frames(rest, { L: null, R: null });
  const Fc = frames((i) => (typeof i === "number" ? J[i] : undefined), handsCur, look, palms);
  // vita: il bacino gira con le anche e il busto con le spalle; oltre 25° di torsione tra i due
  // la pelle e i muscoli della vita si strozzavano (due segmenti che girano in versi diversi).
  // Il bacino segue il busto per la parte che avanza
  {
    const b = Fc.bacino;
    const t = Fc.torace;
    const ax = b.e1;
    const flat = (v: V3) => norm(sub(v, mul(ax, dot(v, ax))));
    const pb = flat(b.e2);
    const pt = flat(t.e2);
    const ang = Math.atan2(dot(cross(pb, pt), ax), dot(pb, pt));
    // il modello del corpo mette quasi sempre anche ad arciere fermo 15-20° tra anche e spalle (profondità
    // delle anche sbagliata): l'addome storto. Si tiene al massimo una torsione leggera
    const lim = (8 * Math.PI) / 180;
    if (Math.abs(ang) > lim) {
      const turn = ang - Math.sign(ang) * lim;
      const c = Math.cos(turn);
      const sn = Math.sin(turn);
      const rot = (v: V3): V3 => add(add(mul(v, c), mul(cross(ax, v), sn)), mul(ax, dot(ax, v) * (1 - c)));
      Fc.bacino = { ...b, e2: rot(b.e2), e3: rot(b.e3) };
    }
  }
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
  // testa: segue collo, orecchie e naso (stabile). I punti del viso non la girano più: la loro
  // profondità stimata la piegava in avanti o all'indietro in modo innaturale
  // dita (quattro insieme) e pollice: con i 21 punti della mano si piegano; senza, seguono la mano
  const perFinger: Record<"L" | "R", number[][] | null> = { L: null, R: null };
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
    Fc[`pollice_${s}`] = fingers(J[base + 2], J[base + 4], Fr[`pollice_${s}`]);
    // ogni dito con la sua piega (indice alzato e le altre chiuse, mano aperta, pugno): le dita partono
    // dritte dal palmo e la scheda grafica le piega una per una. Senza i quattro diti letti bene, come prima
    const W0 = J[base];
    const hAxis = norm(sub(J[base + 9], W0));
    let pn = cross(sub(J[base + 5], W0), sub(J[base + 17], W0));
    // per la mano destra questo prodotto guarda il palmo, per la sinistra il dorso
    if (s === "L") pn = mul(pn, -1);
    const palmN = perpTo(hAxis, pn, [0, 0, 1]);
    const per: number[][] = [];
    for (const [m, p, tp] of [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]] as const) {
      const a = J[base + m];
      const b = J[base + p];
      const c = J[base + tp];
      if (!a || !b || !c) break;
      // falangi troppo corte: punti della mano schiacciati o mancanti, non si usano
      if (len(sub(b, a)) < 0.012 || len(sub(c, b)) < 0.015) break;
      const v1 = norm(sub(b, a));
      const v2 = norm(sub(c, b));
      const k1 = Math.atan2(dot(v1, palmN), dot(v1, hAxis));
      const k2 = Math.acos(Math.max(-1, Math.min(1, dot(v1, v2))));
      if (!Number.isFinite(k1) || !Number.isFinite(k2)) break;
      per.push([Math.max(-0.3, Math.min(1.6, k1)), Math.max(0, Math.min(1.9, k2)) / 1.55]);
    }
    if (per.length === 4) perFinger[s] = per;
    else Fc[`dita_${s}`] = fingers(avg([5, 9, 13, 17]), avg([8, 12, 16, 20]), Fr[`dita_${s}`]);
  }
  // Dita in presa: si piegano davvero (nocca, seconda e terza falange) nella scheda grafica, con la
  // mano che le porta. Mano della corda: presa mediterranea, l'indice sopra la freccia, medio e anulare
  // sotto, agganciati alla corda con la piega delle dita; il palmo verso il viso. Mano dell'arco: chiusa
  // attorno all'impugnatura. Qui: l'orientamento della mano della corda e quanto piegare (curl).
  const curlK: Record<"L" | "R", { k: number; a1: number; a2: number; spread: number } | null> = { L: null, R: null };
  const torsoUp = norm(sub(lerp(J[11], J[12], 0.5), lerp(J[23], J[24], 0.5)));
  for (const [g, wrap] of [[grips?.hook, false], [grips?.wrap, true]] as const) {
    if (!g || g.k <= 0.05) continue;
    const s = g.side;
    const k = Math.min(1, g.k);
    curlK[s] = wrap
      ? // mano dell'arco rilassata (come si insegna: l'arco non si stringe): le dita girano attorno al davanti
        // del riser senza entrarci. Angoli trovati misurando la mano del modello contro il riser vero
        { k: Math.min(1, k / 0.85), a1: WRAP_GRIP.a1, a2: WRAP_GRIP.a2, spread: 0 }
      : { k, a1: (14 * Math.PI) / 180, a2: (100 * Math.PI) / 180, spread: (9 * Math.PI) / 180 };
    if (wrap) {
      // mano dell'arco: le nocche in fila lungo l'impugnatura (indice in alto, sotto la freccia, mignolo in
      // basso) e la mano verso il bersaglio: così le dita, piegandosi, girano attorno all'impugnatura invece
      // di attraversarla. L'orientamento letto dal video conta solo quando la presa è leggera
      const axIn = grips?.wrap?.axis;
      const base = s === "L" ? 33 : 54;
      const hasH = hasHand(base);
      const W = hasH ? J[base] : J[s === "L" ? 15 : 16];
      const IX = hasH ? J[base + 5] : J[s === "L" ? 19 : 20];
      const PK = hasH ? J[base + 17] : J[s === "L" ? 17 : 18];
      if (!W || !IX || !PK || !axIn) continue;
      const ax = norm(axIn);
      const mid = lerp(IX, PK, 0.5);
      const hLen = Math.max(0.07, Math.min(0.11, len(sub(mid, W)) || 0.09));
      const wid = Math.max(0.06, Math.min(0.09, len(sub(IX, PK)) || 0.075));
      const flat = (v: V3) => sub(v, mul(ax, dot(v, ax)));
      const e1v = flat(sub(mid, W));
      // verso il bersaglio, non verso il punto della presa: spostando la mano sull'impugnatura la direzione
      // non deve cambiare (altrimenti il buco delle dita si sposta di nuovo)
      const dirIn = grips?.wrap?.dir;
      const e1d = flat(dirIn ?? sub(g.toward, W));
      const e1 = norm(len(e1d) > 0.01 ? add(mul(len(e1v) > 1e-4 ? norm(e1v) : norm(e1d), 1 - k), mul(norm(e1d), k)) : e1v);
      const X = perpTo(e1, ax, ax);
      const IXn = add(add(W, mul(e1, hLen)), mul(X, wid / 2));
      const PKn = add(add(W, mul(e1, hLen)), mul(X, -wid / 2));
      const fwd = norm(cross(norm(sub(J[11], J[12])), torsoUp));
      const fm = frame(W, lerp(IXn, PKn, 0.5), cross(sub(IXn, W), sub(PKn, W)), fwd);
      // Presa vera: la mano a riposo si gira tutta insieme in modo che le dita (F) vadano verso il bersaglio e
      // la fila delle nocche (dall'indice al mignolo) scenda lungo l'arco. È l'orientamento con cui la presa è
      // stata misurata contro il riser (WRAP_GRIP): le dita girano attorno all'impugnatura, non di traverso
      const fr = Fr[`mano_${s}`];
      const cf = curlFrame(meta, s);
      const uP = flat(dirIn ?? sub(g.toward, W));
      if (fr && cf && len(uP) > 1e-4) {
        const Sp = dot(cf.S, cf.X) >= 0 ? cf.S : mul(cf.S, -1);
        const r3 = cross(cf.F, Sp);
        const c1 = norm(uP);
        const c3 = cross(c1, ax);
        const R = (v: V3) => add(add(mul(c1, dot(v, cf.F)), mul(ax, dot(v, Sp))), mul(c3, dot(v, r3)));
        const e1 = norm(R(fr.e1));
        const e2 = norm(R(fr.e2));
        // la mano resta della sua misura (la presa è misurata su questa mano contro il riser vero)
        Fc[`mano_${s}`] = { o: W, e1, e2, e3: cross(e1, e2), L: fr.L };
        continue;
      }
      Fc[`mano_${s}`] = fm;
      continue;
    }
    // mano della corda: dal polso verso la cocca, indice in alto (sopra la freccia)
    const base = s === "L" ? 33 : 54;
    const hasH = hasHand(base);
    const W = hasH ? J[base] : J[s === "L" ? 15 : 16];
    const IX = hasH ? J[base + 5] : J[s === "L" ? 19 : 20];
    const PK = hasH ? J[base + 17] : J[s === "L" ? 17 : 18];
    const el = J[s === "L" ? 13 : 14];
    if (!W || !IX || !PK || !el) continue;
    const mid = lerp(IX, PK, 0.5);
    const hLen = len(sub(mid, W)) || 0.08;
    const wid = len(sub(IX, PK)) || 0.07;
    const e1v = norm(sub(mid, W));
    const Xv = norm(sub(IX, PK));
    const toNock = sub(g.toward, W);
    const e1d = len(toNock) > 0.01 ? norm(toNock) : e1v;
    const e1 = norm(add(mul(e1v, 1 - k), mul(e1d, k)));
    const Xd = perpTo(e1, torsoUp, Xv);
    // il lato dell'indice letto dal video a volte si ribalta (mano vista di taglio, punti scambiati):
    // si prende sempre dalla stessa parte di quello voluto, e in presa piena conta solo quello voluto,
    // così la mano non gira di colpo su se stessa
    const Xs = dot(Xv, Xd) < 0 ? mul(Xv, -1) : Xv;
    const kx = Math.min(1, k * 1.6);
    const X = perpTo(e1, add(mul(Xs, 1 - kx), mul(Xd, kx)), Xd);
    const IXn = add(add(W, mul(e1, hLen)), mul(X, wid / 2));
    const PKn = add(add(W, mul(e1, hLen)), mul(X, -wid / 2));
    const palm = cross(sub(IXn, W), sub(PKn, W));
    const fwd = norm(cross(norm(sub(J[11], J[12])), torsoUp));
    Fc[`mano_${s}`] = frame(W, lerp(IXn, PKn, 0.5), palm, fwd);
    // l'avambraccio gira con la mano (niente polso attorcigliato)
    Fc[`avambr_${s}`] = frame(el, W, palm, fwd);
  }
  // Rotazione dell'avambraccio (pronazione e supinazione): nel corpo vero il gomito non gira, gira il radio
  // attorno all'ulna e la torsione si vede verso il polso. Con un avambraccio rigido che seguiva tutto il
  // palmo i muscoli del gomito si attorcigliavano. Qui l'avambraccio prende solo una parte della rotazione
  // rispetto alla cerniera del gomito, entro i gradi anatomici; il resto lo fa la mano
  for (const s of ["L", "R"] as const) {
    const fr = Fr[`avambr_${s}`];
    const fc = Fc[`avambr_${s}`];
    const orR = Fr[`omero_${s}`];
    const orC = Fc[`omero_${s}`];
    if (!fr || !fc || !orR || !orC) continue;
    const twist = (f: Frame, om: Frame) => {
      const h = perpTo(f.e1, om.e2, om.e3);
      return { h, th: Math.atan2(dot(cross(h, f.e2), f.e1), dot(h, f.e2)) };
    };
    const r = twist(fr, orR);
    const c = twist(fc, orC);
    let d = c.th - r.th;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    d = Math.max(-1.75, Math.min(1.75, d));
    const ang = r.th + 0.4 * d;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const ax = c.h;
    const e2 = norm(add(add(mul(ax, ca), mul(cross(fc.e1, ax), sa)), mul(fc.e1, dot(fc.e1, ax) * (1 - ca))));
    Fc[`avambr_${s}`] = { o: fc.o, e1: fc.e1, e2, e3: cross(fc.e1, e2), L: fc.L };
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
    // le dita in presa si accorciano (piegate), le altre parti no
    const lo = name === "torace" || name === "bacino" ? 0 : name.startsWith("dita") ? kT * 0.35 : kT * 0.8;
    const hi = name === "torace" || name === "bacino" ? 99 : kT * 1.22;
    // spessore di traverso: la corporatura che copre la silhouette dell'arciere (aura); mani e piedi restano
    const th = !build ? 1 : name === "torace" || name === "bacino" ? build.torso : name.startsWith("omero") || name.startsWith("avambr") ? build.arm : name.startsWith("coscia") || name.startsWith("gamba") ? build.leg : name === "testa" ? build.head : 1;
    segMatrix(r, c, th, out, i * 16, lo, hi);
  });
  // dita senza punti della mano: stessa trasformazione della mano
  for (const s of ["L", "R"] as const) {
    const m = idx(`mano_${s}`);
    for (const f of [`dita_${s}`, `pollice_${s}`]) {
      const k = idx(f);
      if (k >= 0 && m >= 0 && !Fc[f]) out.copyWithin(k * 16, m * 16, m * 16 + 16);
    }
  }
  // dita in presa: seguono la mano (la piega la fa la scheda grafica con curl)
  const cv = curl ?? null;
  if (cv) cv.fill(0);
  if (fing) fing.fill(0);
  for (const s of ["L", "R"] as const) {
    const c0 = curlK[s];
    const pf = perFinger[s];
    const m = idx(`mano_${s}`);
    const d = idx(`dita_${s}`);
    const pl = idx(`pollice_${s}`);
    if ((!c0 && !pf) || m < 0 || d < 0) continue;
    const c = c0 ?? { k: 0, a1: 0, a2: 0, spread: 0 };
    for (const f of [d, pl]) {
      if (f < 0) continue;
      // il pollice della mano dell'arco resta com'è nella mano (lungo il riser, verso il bersaglio)
      const kk = f === pl ? c.k * (s === grips?.wrap?.side ? 1 : 0.6) : c.k;
      for (let i = 0; i < 16; i++) out[f * 16 + i] = out[f * 16 + i] * (1 - kk) + out[m * 16 + i] * kk;
    }
    // piega di ogni dito: conta tanto meno quanto più la mano è in presa (lì i punti sono coperti)
    if (fing && pf) {
      const w = 1 - c.k;
      const o = s === "L" ? 0 : 8;
      for (let i = 0; i < 4; i++) {
        fing[o + i] = pf[i][0] * w;
        fing[o + 4 + i] = pf[i][1] * w;
      }
    }
    if (!cv) continue;
    const cf = curlFrame(meta, s);
    if (!cf) continue;
    const { K: k0, L, F, S, X } = cf;
    const o = s === "L" ? 0 : 16;
    cv.set([k0[0], k0[1], k0[2], L, F[0], F[1], F[2], c.a1 * c.k, S[0], S[1], S[2], c.a2 * c.k, X[0], X[1], X[2], c.spread * c.k * (dot(X, S) > 0 ? -1 : 1)], o);
  }
  return out;
}

/**
 * Come si piegano le dita a riposo: nocche K, direzione delle dita F (lunghe L), verso il palmo P (dove
 * vanno piegandosi), asse della piega S (lungo la fila delle nocche) e fila delle nocche X (indice→mignolo).
 * Il verso del palmo viene dai punti della mano a riposo (prima si usava +z, ma nel modello le mani a
 * riposo non hanno il palmo in avanti: le dita si piegavano di lato e attraversavano l'impugnatura).
 */
export function curlFrame(meta: BodyMeta, s: "L" | "R") {
  const r = (k: string) => meta.rest[k] as V3 | undefined;
  const k0 = r(`dita0_${s}`);
  const k1 = r(`dita1_${s}`);
  const ix = r(s === "L" ? "19" : "20");
  const pk = r(s === "L" ? "17" : "18");
  const W = r(s === "L" ? "15" : "16");
  if (!k0 || !k1 || !ix || !pk || !W) return null;
  const L = len(sub(k1, k0));
  const F = norm(sub(k1, k0));
  // per la mano destra questo prodotto guarda il palmo, per la sinistra il dorso
  let palm = cross(sub(ix, W), sub(pk, W));
  if (s === "L") palm = mul(palm, -1);
  const X = norm(sub(ix, pk));
  // verso il palmo, perpendicolare alle dita e alla fila delle nocche
  const P = perpTo(F, sub(palm, mul(X, dot(palm, X))), [0, 0, 1]);
  const S = norm(cross(F, P));
  return { K: k0, L, F, P, S, X };
}

/**
 * Presa della mano dell'arco, misurata sulla mano del modello contro il riser vero del Samik: nocca e
 * seconda falange appena piegate; il centro dell'impugnatura sta davanti al palmo (F avanti, P verso il
 * palmo) e 2,5 cm verso il mignolo, così indice e pollice stanno sotto la mensola e il pollice passa
 * accanto alla finestra. Nessun vertice della mano entra nel riser (margine 2 mm).
 */
export const WRAP_GRIP = { a1: (15 * Math.PI) / 180, a2: (30 * Math.PI) / 180, F: 0.0225, P: 0.06, S: 0.025 };
/** dove sta, nella mano a riposo, il centro dell'impugnatura dell'arco */
export function gripHole(meta: BodyMeta, s: "L" | "R"): V3 | null {
  const cf = curlFrame(meta, s);
  if (!cf) return null;
  // verso il mignolo: per le due mani l'asse di piega S ha verso opposto rispetto alla fila delle nocche
  const toPinky = dot(cf.S, cf.X) >= 0 ? mul(cf.S, -1) : cf.S;
  return add(add(add(cf.K, mul(cf.F, WRAP_GRIP.F)), mul(cf.P, WRAP_GRIP.P)), mul(toPinky, WRAP_GRIP.S));
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
