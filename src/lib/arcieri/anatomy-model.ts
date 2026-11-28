/**
 * Modello anatomico 3D dai 33 punti della posa: pelle traslucida, scheletro e muscoli al lavoro,
 * più arco, corda e freccia ricostruiti dalle mani. Tutto in metri, piedi a terra (y = 0),
 * x verso destra dell'immagine, z verso la fotocamera. Le parti sono ellissoidi e anelli: il
 * renderer (anatomy-3d) disegna ogni parte con una matrice.
 */
import { FACE0, FACE_IDS, metricsOf, sides, type Gear, type Hand, type Landmark } from "./pose-analysis";
import { correctPosture, postureChecks, postureMode, type PostureCheck, type PostureId } from "./posture-ref";
import { archeryKit } from "./pose-kit";

export type V3 = [number, number, number];
export type Mode = 0 | 1 | 2 | 3; // 0 pelle (bordo luminoso), 1 osso, 2 muscolo, 3 materiale semplice
/** mesh vere dell'arco lungo e della freccia di legno (public/models/arco-legno.bin) */
export type GearMesh = "lbWood" | "lbGrip" | "arFletch" | "arShaft" | "arPoint" | "arTrim" | "sbRiser" | "sbDark" | "sbLight" | "tgStraw" | "tgWood" | "tgMetal" | "tgFlag" | "tgFace" | "ground";
export type Part = {
  mesh: "sphere" | "torus" | "spindle" | "tube" | GearMesh;
  m: Float32Array;
  nm: Float32Array;
  color: V3;
  mode: Mode;
  alpha: number;
  act: number;
  layer: "pelle" | "osso" | "muscolo" | "arco";
  deep?: boolean;
  id?: string;
  /** arco e freccia: «real» = il modello vero (quando è caricato), «proc» = quello disegnato a tubi (finché no) */
  alt?: "real" | "proc";
};

/**
 * Ricurvo tradizionale Samik Sage (file dell'arco, in metri): mezza lunghezza tra i puntali, punto della
 * presa (il centro del pugno, sotto la mensola), puntali della corda e appoggio della freccia sulla mensola,
 * dal lato della finestra (+x per un destro).
 */
const SAMIK = { half: 0.776, grip: [0, 0.012, 0] as V3, tipA: [-0.001, 0.825, -0.128] as V3, tipB: [0, -0.727, -0.128] as V3, rest: [0.005, 0.072, 0.0] as V3 };
/** freccia di legno vera: lunghezza dalla cocca alla punta */
const WOOD_ARROW_LEN = 0.742;
export type Hud = {
  pts: Record<string, V3>;
  labels: { at: V3; text: string; tone: "cyan" | "gold" | "warn" }[];
  arcs: { at: V3; a: V3; b: V3; deg: number }[];
  dims: { a: V3; b: V3; text: string }[];
  feet: V3;
};
/** J e hand servono al corpo anatomico vero (anatomy-body): ogni segmento segue questi punti */
/** posa dell'arco in un fotogramma: asse (verso il flettente alto), verso della freccia, mezza lunghezza, freccia incoccata */
export type BowPose = { n: V3; u: V3; half: number; nocked: boolean };
/**
 * Posa già risolta sull'intero video (motion-solve): punti del corpo con ossa di lunghezza costante,
 * niente scatti né compenetrazioni, e arco rigido filtrato. Se c'è, il fotogramma non si ricalcola da solo.
 */
export type PrePose = { J: Record<number, V3>; bow?: BowPose | null; /** verso del palmo per mano (sinistra, destra della persona), continuo nel tempo */ palms?: { L?: V3; R?: V3 }; /** il fotogramma nello spazio della sagoma con la scala e il pavimento dell'intero video */ frame?: ImageFrame };
/** scala (unità d'immagine per metro) e pavimento decisi sull'intero video: valgono per ogni fotogramma */
export type PlanarFix = { s: number; floorY: number };
export type Model = { parts: Part[]; /** posa dell'arco usata (per il filtro sull'intero video) */ bowPose?: BowPose; hud: Hud; center: V3; height: number; J?: Record<number, V3>; hand?: Hand; /** dove guarda il viso (orizzontale): segue il bersaglio durante il tiro */ headF?: V3; /** testa in giù (+) o in su (-), radianti: dal naso rispetto alle orecchie nel fotogramma */ headPitch?: number; /** quanto la mano della corda è in presa sulla corda (0..1) e quanto quella dell'arco stringe l'impugnatura */ grip?: { draw: number; bow: number }; /** il fotogramma del video nel piano del corpo (z = 0), in metri: sinistra, destra, sopra, sotto */ frame?: ImageFrame; /** corporatura trovata con l'aura (silhouette) dell'arciere */ build?: Build; /** asse dell'arco all'impugnatura (verso il flettente alto): la mano dell'arco ci si chiude attorno */ bowAxis?: V3; /** verso del palmo filtrato sull'intero video (vedi PrePose) */ palms?: { L?: V3; R?: V3 }; /** la freccia incoccata: cocca, direzione e lunghezza (per la visuale dell'arciere) */ arrow?: { nock: V3; dir: V3; len: number }; /** postura rispetto alle tavole: misure sul gesto del video e parti corrette (se la sagoma è corretta) */ posture?: { checks: PostureCheck[]; fixed: PostureId[] } };
/** dove sta il fotogramma del video nello spazio della sagoma: serve a guardarla "come il video", punto su punto */
export type ImageFrame = { x0: number; x1: number; yTop: number; yBot: number };

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
const angleAt = (a: V3, o: V3, b: V3) => {
  const u = norm(sub(a, o));
  const v = norm(sub(b, o));
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI;
};
export const v3 = { add, sub, mul, dot, cross, len, norm, lerp };

/** matrice da centro e tre assi ortonormali con i rispettivi raggi; normale = assi / raggi */
function place(c: V3, ax: V3, ay: V3, az: V3, rx: number, ry: number, rz: number) {
  const m = new Float32Array([ax[0] * rx, ax[1] * rx, ax[2] * rx, 0, ay[0] * ry, ay[1] * ry, ay[2] * ry, 0, az[0] * rz, az[1] * rz, az[2] * rz, 0, c[0], c[1], c[2], 1]);
  const nm = new Float32Array([ax[0] / rx, ax[1] / rx, ax[2] / rx, ay[0] / ry, ay[1] / ry, ay[2] / ry, az[0] / rz, az[1] / rz, az[2] / rz]);
  return { m, nm };
}

/** asse perpendicolare a `ay` il più vicino possibile a `hint` */
function perp(ay: V3, hint: V3): V3 {
  let x = sub(hint, mul(ay, dot(hint, ay)));
  if (len(x) < 1e-4) x = sub([0, 0, 1], mul(ay, ay[2]));
  if (len(x) < 1e-4) x = [1, 0, 0];
  return norm(x);
}

const vis = (p: Landmark | undefined) => (p ? (p.visibility ?? 1) : 0);

/**
 * Ossa di cui si conosce la lunghezza vera: [punto, punto, lunghezza tipica in metri, limiti].
 * Con l'analisi di un video la lunghezza vera è quella dell'arciere (la più lunga vista nel video,
 * quando l'osso è di piatto rispetto alla camera), non quella di un corpo medio.
 */
const BONES = {
  spalle: [11, 12, 0.36, 0.9, 1.25],
  anche: [23, 24, 0.27, 0.9, 1.3],
  omeroS: [11, 13, 0.3, 0.85, 1.25],
  omeroD: [12, 14, 0.3, 0.85, 1.25],
  avambraccioS: [13, 15, 0.26, 0.85, 1.25],
  avambraccioD: [14, 16, 0.26, 0.85, 1.25],
  femoreS: [23, 25, 0.44, 0.85, 1.2],
  femoreD: [24, 26, 0.44, 0.85, 1.2],
  tibiaS: [25, 27, 0.42, 0.85, 1.2],
  tibiaD: [26, 28, 0.42, 0.85, 1.2],
} as const;
type BoneName = keyof typeof BONES;
/** lunghezza vera di un osso dell'arciere (calibrata sul video, altrimenti quella tipica) */
export function boneLen(cal: BoneCal | null | undefined, name: BoneName): number {
  return cal?.[name] ?? BONES[name][2];
}
/** lunghezze delle ossa dell'arciere, nelle stesse unità della sagoma */
/**
 * Corporatura dall'aura: quanto la sagoma va ingrossata (o assottigliata) di traverso per coprire la
 * silhouette dell'arciere nel video (vestiti compresi). 1 = il corpo dell'atlante.
 */
export type Build = { torso: number; arm: number; leg: number; head: number; /** quanto credere alla girata di spalle e anche stimata dal video (0..1): la sceglie l'aura */ turn?: number };
export type BoneCal = Partial<Record<BoneName, number>> & { build?: Build };
const PAIRS: [BoneName, BoneName][] = [["omeroS", "omeroD"], ["avambraccioS", "avambraccioD"], ["femoreS", "femoreD"], ["tibiaS", "tibiaD"]];

/** posizione nel piano dell'immagine, in metri, piedi a terra: è il video, senza stime */
function planar(lm: Landmark[], aspect: number, fix?: PlanarFix | null) {
  if (!lm || lm.length < 25) return null;
  if (![11, 12, 13, 14, 15, 16].every((i) => vis(lm[i]) > 0.2)) return null;
  const P = (i: number) => ({ x: lm[i].x * aspect, y: lm[i].y, z: (lm[i].z ?? 0) * aspect });
  const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const shM = { x: (P(11).x + P(12).x) / 2, y: (P(11).y + P(12).y) / 2 };
  const hipsOk = vis(lm[23]) > 0.35 && vis(lm[24]) > 0.35 && lm[23].y < 1.05 && lm[24].y < 1.05;
  const anklesOk = lm.length > 28 && vis(lm[27]) > 0.45 && vis(lm[28]) > 0.45 && lm[27].y < 1.0 && lm[28].y < 1.0;
  // unità d'immagine per metro: la misura che cambia meno quando l'arciere gira il busto.
  // Corpo intero (spalle-caviglie) se si vede, poi il busto; la larghezza delle spalle (che si
  // accorcia girandosi e faceva "saltare" la grandezza del corpo) solo se non c'è altro
  const torsoS = hipsOk ? d2(shM, { x: (P(23).x + P(24).x) / 2, y: (P(23).y + P(24).y) / 2 }) / 0.5 : 0;
  const fullS = hipsOk && anklesOk ? (Math.max(P(27).y, P(28).y) - shM.y) / 1.36 : 0;
  const s0 = (fullS > 0 && torsoS > 0 ? fullS * 0.7 + torsoS * 0.3 : torsoS || fullS || d2(P(11), P(12)) / 0.36) || 1;
  const hipY = hipsOk ? (P(23).y + P(24).y) / 2 : shM.y + 0.5 * s0;
  const floor0 = anklesOk ? Math.max(P(27).y, P(28).y) + 0.075 * s0 : hipY + 0.93 * s0;
  const s = fix && fix.s > 0 ? fix.s : s0;
  const floorY = fix ? fix.floorY : floor0;
  const cx = shM.x;
  const XY = (i: number): V3 => [(P(i).x - cx) / s, (floorY - P(i).y) / s, 0];
  const frame: ImageFrame = { x0: -cx / s, x1: (aspect - cx) / s, yTop: floorY / s, yBot: (floorY - 1) / s };
  return { P, s, XY, hipsOk, anklesOk, frame, s0, floor0, full: fullS > 0 };
}

/** scala e pavimento di un fotogramma (con quanto ci si può fidare): l'intero video li filtra insieme */
export function planarScale(lm: Landmark[], aspect: number) {
  const pl = planar(lm, aspect);
  return pl ? { s: pl.s0, floorY: pl.floor0, anklesOk: pl.anklesOk, hipsOk: pl.hipsOk, full: pl.full } : null;
}

/** il fotogramma intero nello spazio della sagoma (vedi planar) */
export function imageFrame(lm: Landmark[], aspect: number, fix?: PlanarFix | null): ImageFrame | null {
  return planar(lm, aspect, fix)?.frame ?? null;
}

/**
 * Lunghezze vere delle ossa dell'arciere da tutti i fotogrammi del video: per ogni osso la lunghezza
 * vista più lunga (90° percentile, così un punto sbagliato non conta), uguale a destra e a sinistra.
 */
export function boneCal(frames: (Landmark[] | null | undefined)[], aspect: number): BoneCal {
  const seen: Partial<Record<BoneName, number[]>> = {};
  for (const lm of frames) {
    if (!lm) continue;
    const pl = planar(lm, aspect);
    if (!pl) continue;
    for (const name of Object.keys(BONES) as BoneName[]) {
      const [a, b] = BONES[name];
      if (vis(lm[a]) < 0.5 || vis(lm[b]) < 0.5) continue;
      if (a >= 23 && !pl.hipsOk) continue;
      if (b >= 25 && !pl.anklesOk) continue;
      const pa = pl.XY(a);
      const pb = pl.XY(b);
      (seen[name] ??= []).push(Math.hypot(pb[0] - pa[0], pb[1] - pa[1]));
    }
  }
  const p90 = (v: number[] | undefined) => {
    if (!v || v.length < 8) return 0;
    const s = [...v].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))];
  };
  const raw: Partial<Record<BoneName, number>> = {};
  for (const name of Object.keys(BONES) as BoneName[]) raw[name] = p90(seen[name]);
  for (const [l, r] of PAIRS) {
    const m = Math.max(raw[l] ?? 0, raw[r] ?? 0);
    raw[l] = m;
    raw[r] = m;
  }
  const cal: BoneCal = {};
  for (const name of Object.keys(BONES) as BoneName[]) {
    const [, , def, lo, hi] = BONES[name];
    const v = raw[name] ?? 0;
    if (v > 0) cal[name] = Math.max(def * lo, Math.min(def * hi, v));
  }
  return cal;
}

/**
 * Punti della posa in metri; gambe e anche ricostruite se fuori dall'inquadratura.
 * Larghezza e altezza vengono dal video così come sono (la sagoma vista "come il video" combacia
 * con l'arciere). La profondità viene dalle ossa: un osso che nel video sembra più corto del vero
 * va verso la camera o si allontana, di quanto basta a ridargli la sua lunghezza.
 */
/**
 * Memoria della profondità tra un fotogramma e l'altro: la profondità stimata da un video è la
 * parte più incerta e, lasciata libera, faceva scattare braccia e mani avanti e indietro.
 * Larghezza e altezza restano quelle del video (esatte); la profondità le insegue in un decimo di secondo.
 */
export type DepthMemo = { z: Map<number, number>; t: number };
export const depthMemo = (): DepthMemo => ({ z: new Map(), t: -1 });

export function bodyPoints(lm: Landmark[], aspect: number, cal: BoneCal | null = null, memo?: DepthMemo | null, time?: number, fix?: PlanarFix | null): Record<number, V3> | null {
  const out = bodyPointsRaw(lm, aspect, cal, fix);
  if (!out || !memo || time == null) return out;
  const dt = memo.t < 0 ? -1 : time - memo.t;
  memo.t = time;
  // salto indietro nel tempo o pausa lunga: si riparte dal fotogramma com'è
  if (dt < 0 || dt > 0.5) {
    memo.z.clear();
    for (const k of Object.keys(out)) memo.z.set(Number(k), out[Number(k)][2]);
    return out;
  }
  const a = 1 - Math.exp(-dt / 0.1);
  for (const k of Object.keys(out)) {
    const i = Number(k);
    const prev = memo.z.get(i);
    const z = prev == null ? out[i][2] : prev + (out[i][2] - prev) * a;
    memo.z.set(i, z);
    out[i] = [out[i][0], out[i][1], z];
  }
  // la profondità che insegue piano può riportare per un attimo il braccio dentro il busto: si ricontrolla
  keepArmsOut(out, cal);
  return out;
}

/**
 * Braccia fuori dal corpo: un braccio non può passare dentro il busto. Larghezza e altezza vengono dal
 * video (esatte), quindi se il braccio nel video copre il busto sta davanti o dietro: si sposta solo in
 * profondità, dalla parte più vicina, quanto basta a stare fuori (con lo spessore del braccio). Il busto
 * è un cilindro ellittico tra anche e spalle, largo come le spalle e profondo come un torace.
 */
/**
 * Il busto visto lungo la profondità: per un punto (con il suo spessore r) l'intervallo di profondità
 * [z davanti, z dietro] che il busto occupa sulla sua linea di vista, o null se la linea non lo tocca.
 * Il busto è un cilindro ellittico tra anche e spalle, largo come le spalle e profondo come un torace.
 */
export function torsoSpan(out: Record<number, V3>, cal: BoneCal | null): ((p: V3, r: number) => [number, number] | null) | null {
  const shL = out[11];
  const shR = out[12];
  if (!shL || !shR) return null;
  const hipL = out[23] ?? add(shL, [0, -0.5, 0]);
  const hipR = out[24] ?? add(shR, [0, -0.5, 0]);
  const shM = lerp(shL, shR, 0.5);
  const hipM = lerp(hipL, hipR, 0.5);
  const axis = sub(shM, hipM);
  const hgt = len(axis);
  if (hgt < 0.2) return null;
  const up = mul(axis, 1 / hgt);
  const rgt = norm(sub(sub(shR, shL), mul(up, dot(sub(shR, shL), up))));
  const fwd = norm(cross(rgt, up));
  const shW = len(sub(shR, shL));
  const hipW = len(sub(hipR, hipL));
  const g = cal?.build?.torso ?? 1;
  return (p: V3, r: number) => {
    const v = sub(p, hipM);
    const h = dot(v, up) / hgt;
    // sopra le spalle c'è il collo, sotto le anche le gambe: lì il busto non c'è
    if (h < -0.05 || h > 0.97) return null;
    const t = Math.max(0, Math.min(1, h));
    const A = (hipW * 0.62 + (shW * 0.4 - hipW * 0.62) * t) * Math.max(1, g * 0.95) + r;
    const B = (0.1 + 0.025 * Math.sin(Math.PI * Math.min(1, t * 1.1))) * g + r;
    const u = dot(v, rgt);
    const w = dot(v, fwd);
    // ellisse lungo la direzione di profondità (0,0,1): ((u + k du)/A)^2 + ((w + k dw)/B)^2 = 1
    const du = rgt[2];
    const dw = fwd[2];
    const qa = (du / A) ** 2 + (dw / B) ** 2;
    if (qa < 1e-6) return (u / A) ** 2 + (w / B) ** 2 < 1 ? [-Infinity, Infinity] : null;
    const qb = 2 * ((u * du) / (A * A) + (w * dw) / (B * B));
    const qc = (u / A) ** 2 + (w / B) ** 2 - 1;
    const disc = qb * qb - 4 * qa * qc;
    if (disc <= 0) return null;
    const sq = Math.sqrt(disc);
    const k1 = (-qb - sq) / (2 * qa);
    const k2 = (-qb + sq) / (2 * qa);
    return [p[2] + k1, p[2] + k2];
  };
}

/**
 * Braccia fuori dal corpo: un braccio non può passare dentro il busto. Larghezza e altezza vengono dal
 * video (esatte), quindi se il braccio nel video copre il busto sta davanti o dietro: si sposta solo in
 * profondità, dalla parte più vicina (o da quella decisa sull'intero video, «side»), quanto basta a stare
 * fuori (con lo spessore del braccio).
 */
export function keepArmsOut(out: Record<number, V3>, cal: BoneCal | null, /** lato fisso per gomito e polso (+1 verso la camera, -1 via) */ side?: Record<number, number>) {
  const span = torsoSpan(out, cal);
  if (!span) return;
  /** quanto spostare in profondità p perché stia fuori dal busto (0 se è già fuori) */
  const push = (p: V3, r: number, forced?: number): number => {
    const sp = span(p, r);
    if (!sp) return 0;
    const [z0, z1] = sp;
    const mid = (z0 + z1) / 2;
    const sd = forced ?? (p[2] >= mid ? 1 : -1);
    // dalla parte dove il punto già sta (o quella decisa): niente salti da un lato all'altro
    if (sd > 0) return p[2] >= z1 ? 0 : z1 - p[2] + 0.005;
    return p[2] <= z0 ? 0 : z0 - p[2] - 0.005;
  };
  for (const [sh, el, wr, fingers, hb] of [[11, 13, 15, [17, 19, 21], 33], [12, 14, 16, [18, 20, 22], 54]] as const) {
    if (!out[el] || !out[wr]) continue;
    for (let it = 0; it < 3; it++) {
      let dEl = 0;
      let dWr = 0;
      // gomito e polso, e i punti lungo omero e avambraccio
      const pe = push(out[el], 0.05, side?.[el]);
      if (Math.abs(pe) > Math.abs(dEl)) dEl = pe;
      const pw = push(out[wr], 0.04, side?.[wr]);
      if (Math.abs(pw) > Math.abs(dWr)) dWr = pw;
      // la mano (palmo e punta del medio, o l'indice della posa) non entra nel busto: va con il polso
      const probes: [V3, number][] = out[hb + 9] ? [[out[hb + 9], 0.03], [out[hb + 12] ?? out[hb + 9], 0.012]] : out[fingers[1]] ? [[out[fingers[1]], 0.025]] : [];
      for (const [q, r] of probes) {
        const ph = push(q, r, side?.[wr]);
        if (Math.abs(ph) > Math.abs(dWr)) dWr = ph;
      }
      for (const f of [0.6, 0.8]) {
        const q = push(lerp(out[sh], out[el], f), 0.055, side?.[el]);
        if (Math.abs(q / f) > Math.abs(dEl)) dEl = q / f;
      }
      for (const f of [0.25, 0.5, 0.75]) {
        const q = push(lerp(out[el], out[wr], f), 0.045, side?.[wr] ?? side?.[el]);
        if (q && Math.abs(q) > Math.abs(dEl) * (1 - f) && Math.abs(q) > Math.abs(dWr) * f) {
          dEl = Math.abs(q) > Math.abs(dEl) ? q : dEl;
          dWr = Math.abs(q) > Math.abs(dWr) ? q : dWr;
        }
      }
      if (!dEl && !dWr) break;
      dEl = Math.max(-0.6, Math.min(0.6, dEl));
      dWr = Math.max(-0.6, Math.min(0.6, dWr));
      // il polso segue il gomito (l'avambraccio resta intero), la mano segue il polso
      const wShift = Math.abs(dWr) > Math.abs(dEl) ? dWr : dEl;
      out[el] = [out[el][0], out[el][1], out[el][2] + dEl];
      out[wr] = [out[wr][0], out[wr][1], out[wr][2] + wShift];
      for (const f of fingers) if (out[f]) out[f] = [out[f][0], out[f][1], out[f][2] + wShift];
      for (let k = 0; k < 21; k++) if (out[hb + k]) out[hb + k] = [out[hb + k][0], out[hb + k][1], out[hb + k][2] + wShift];
    }
    // né dentro la testa: gomito, polso e mano stanno davanti o dietro al cranio (sfera tra le orecchie)
    if (out[7] && out[8]) {
      const hc = add(lerp(out[7], out[8], 0.5), [0, 0.025, 0]);
      const RH = 0.088;
      const pushHead = (p: V3, r: number) => {
        const dx = p[0] - hc[0];
        const dy = p[1] - hc[1];
        const dz = p[2] - hc[2];
        const R = RH + r;
        if (dx * dx + dy * dy + dz * dz >= R * R) return 0;
        const h = Math.sqrt(Math.max(0, R * R - dx * dx - dy * dy));
        return (dz >= 0 ? h : -h) - dz + (dz >= 0 ? 0.004 : -0.004);
      };
      const pe = pushHead(out[el], 0.04);
      if (pe) out[el] = [out[el][0], out[el][1], out[el][2] + pe];
      let dh = pushHead(out[wr], 0.03);
      for (const q of out[hb + 9] ? [out[hb + 9]] : []) {
        const v = pushHead(q, 0.02);
        if (Math.abs(v) > Math.abs(dh)) dh = v;
      }
      if (dh) {
        out[wr] = [out[wr][0], out[wr][1], out[wr][2] + dh];
        for (const f of fingers) if (out[f]) out[f] = [out[f][0], out[f][1], out[f][2] + dh];
        for (let k = 0; k < 21; k++) if (out[hb + k]) out[hb + k] = [out[hb + k][0], out[hb + k][1], out[hb + k][2] + dh];
      }
    }
  }
}

function bodyPointsRaw(lm: Landmark[], aspect: number, cal: BoneCal | null = null, fix?: PlanarFix | null): Record<number, V3> | null {
  const pl = planar(lm, aspect, fix);
  if (!pl) return null;
  const { P, s, XY, hipsOk, anklesOk } = pl;
  const L = (name: BoneName) => cal?.[name] ?? BONES[name][2];
  // avanti o dietro: dai punti in metri del modello di posa quando la differenza è netta,
  // altrimenti dalla profondità relativa dell'immagine
  const zSign = (child: number, parent: number) => {
    const a = lm[child]?.zw;
    const b = lm[parent]?.zw;
    if (typeof a === "number" && typeof b === "number" && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 0.02) return a < b ? 1 : -1; // più vicino alla camera = z positivo
    return (P(child).z ?? 0) < (P(parent).z ?? 0) ? 1 : -1;
  };
  const out: Record<number, V3> = {};
  for (let i = 0; i < Math.min(33, lm.length); i++) out[i] = XY(i);
  // quanto l'osso esce dal piano dell'immagine. Sotto i 14° è rumore dei punti (un osso di piatto
  // sembra più corto di un 5-10% da un fotogramma all'altro): resta nel piano, niente braccia che
  // ondeggiano avanti e indietro
  const DEAD = 0.24;
  const dzFor = (a: V3, b: V3, len_: number) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const phi = Math.acos(Math.min(1, l / len_));
    if (phi <= DEAD) return 0;
    return len_ * Math.sin(((phi - DEAD) * (Math.PI / 2)) / (Math.PI / 2 - DEAD));
  };
  // Inclinazione di ogni osso rispetto al piano dell'immagine, dai punti in metri del modello di posa:
  // per un osso solo la sua direzione (quanto va verso la camera rispetto a quanto si vede nel video)
  // è affidabile, la sua lunghezza no (la spalla "sale" alzando il braccio e l'omero misurato si
  // accorcia). La sporgenza è quindi la lunghezza vista nel video per quella pendenza.
  const W = (i: number) => {
    const p = lm[i];
    return p && typeof p.xw === "number" && typeof p.yw === "number" && typeof p.zw === "number" && Number.isFinite(p.xw + p.yw + p.zw) && vis(p) > 0.2 ? p : null;
  };
  const depth = (a: number, b: number, len_: number) => {
    const pa = W(a);
    const pb = W(b);
    if (!pa || !pb) return zSign(b, a) * dzFor(out[a], out[b], len_);
    const l = Math.hypot(out[b][0] - out[a][0], out[b][1] - out[a][1]);
    const dxy = Math.hypot((pb.xw as number) - (pa.xw as number), (pb.yw as number) - (pa.yw as number));
    const dzw = -((pb.zw as number) - (pa.zw as number)); // verso la camera = positivo
    const slope = Math.max(-4, Math.min(4, dzw / Math.max(0.02, dxy)));
    // un osso che punta alla camera si vede corto: la sporgenza arriva dalla sua lunghezza vera
    // passaggio graduale (non a gradino) quando l'osso comincia a puntare alla camera: la mano
    // saltava di 20 cm avanti e indietro da un fotogramma all'altro
    const flatDz = l * Math.abs(slope);
    const steepDz = Math.max(l * Math.abs(slope) * 0.85, Math.sqrt(Math.max(0, len_ * len_ - l * l)) * 0.9);
    const tSteep = Math.max(0, Math.min(1, (Math.abs(slope) - 0.7) / 0.6));
    const dz = flatDz + (steepDz - flatDz) * tSteep;
    // un osso non è più lungo di quanto è: se nel video si vede già quasi intero (di piatto, come il braccio
    // dell'arco con l'arciere di fronte e il bersaglio di lato) la profondità stimata, rumorosa, non può
    // piegarlo. Prima il braccio dritto nella foto (166°) risultava piegato nella sagoma (149°)
    const maxDz = Math.sqrt(Math.max(0, (len_ * 1.04) ** 2 - l * l));
    return Math.sign(slope) * Math.min(len_ * 1.1, dz, maxDz);
  };
  // spalle e anche: il busto girato rispetto alla camera
  const turnGain = cal?.build?.turn ?? 1;
  const turn = (l: number, r: number, len_: number) => {
    const dz = depth(l, r, len_) * 0.5 * turnGain;
    out[l][2] = -dz;
    out[r][2] = dz;
  };
  turn(11, 12, L("spalle"));
  if (hipsOk) turn(23, 24, L("anche"));
  // braccia: gomito e polso con la lunghezza vera di omero e avambraccio dell'arciere
  for (const [sh, el, wr, ua, fa] of [[11, 13, 15, "omeroS", "avambraccioS"], [12, 14, 16, "omeroD", "avambraccioD"]] as const) {
    out[el][2] = out[sh][2] + depth(sh, el, L(ua));
    out[wr][2] = out[el][2] + depth(el, wr, L(fa));
    for (const f of wr === 15 ? [17, 19, 21] : [18, 20, 22]) if (out[f]) out[f][2] = out[wr][2];
  }
  // gambe nel piano del bacino (si stanno dritti per tirare), con un filo di profondità se il video la mostra
  for (const [hip, knee, ank, th, tb] of [[23, 25, 27, "femoreS", "tibiaS"], [24, 26, 28, "femoreD", "tibiaD"]] as const) {
    // in piedi per tirare le gambe sono dritte: la profondità stimata dal video (rumorosa sulle
    // gambe, spesso in ombra) le piegava avanti e indietro, la sagoma sembrava storta
    const cap = (v: number) => Math.max(-0.05, Math.min(0.05, v * 0.3));
    out[knee][2] = out[hip][2] + cap(depth(hip, knee, L(th)));
    out[ank][2] = out[knee][2] + cap(depth(knee, ank, L(tb)));
  }
  for (const [ank, heel, toe] of [[27, 29, 31], [28, 30, 32]] as const) {
    if (out[heel]) out[heel][2] = out[ank][2] - 0.05;
    if (out[toe]) out[toe][2] = out[ank][2] + 0.15;
  }
  // testa: il viso guarda dove è girato il naso rispetto alle orecchie
  const shZ = (out[11][2] + out[12][2]) / 2;
  const earsZ = shZ - 0.01;
  // quanto è girata la testa rispetto alla camera, da due misure del video: il naso spostato di lato
  // rispetto alle orecchie (sin) e le orecchie che si avvicinano tra loro (cos, a 15 cm di fronte)
  const earMx = (out[7][0] + out[8][0]) / 2;
  const off = out[0][0] - earMx;
  const yawN = Math.asin(Math.min(1, Math.abs(off) / 0.095));
  const earsSeen = vis(lm[7]) > 0.5 && vis(lm[8]) > 0.5;
  const yawE = Math.acos(Math.min(1, Math.abs(out[7][0] - out[8][0]) / 0.15));
  const yaw = earsSeen ? (yawN + yawE) / 2 : yawN;
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) if (out[i]) out[i][2] = earsZ;
  out[0][2] = earsZ + 0.095 * Math.cos(yaw);
  if (Math.abs(off) < 0.095 * Math.sin(yaw)) out[0][0] = earMx + Math.sign(off || 1) * 0.095 * Math.sin(yaw);
  for (const i of [1, 2, 3, 4, 5, 6, 9, 10]) if (out[i]) out[i][2] = earsZ + 0.07 * Math.cos(yaw);
  // Mano al viso o al collo (in trazione, all'ancoraggio, nell'accompagnamento dopo il rilascio): la
  // mano tocca il corpo, quindi ha la profondità del viso o del collo, non quella stimata (che la
  // portava mezzo metro davanti). Il gomito tiene l'avambraccio della sua lunghezza: in trazione sulla
  // linea della freccia, dietro la mano, come fa ogni arciere ancorato; altrimenti dove lo stima il video.
  const mouth: V3 = out[9] && out[10] ? lerp(out[9], out[10], 0.5) : out[0];
  const neck: V3 = lerp(out[11], out[12], 0.5);
  const d2v = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // davanti del busto (verso dove guarda il petto), solo in orizzontale: la mano all'ancoraggio sta
  // sotto la mandibola dal lato del petto, quindi l'avambraccio passa davanti al collo, non dentro
  const rx = out[12][0] - out[11][0];
  const rz = out[12][2] - out[11][2];
  const rl = Math.hypot(rx, rz) || 1;
  const fwdZ = -rx / rl;
  const headZ = earsZ;
  for (const [sh, el, wr, fa, osh, owr] of [[12, 14, 16, "avambraccioD", 11, 15], [11, 13, 15, "avambraccioS", 12, 16]] as const) {
    // punto del corpo più vicino al polso: viso e collo, spalla dello stesso lato, petto.
    // La mano tocca la superficie: al viso sotto la mandibola, su collo, spalla e petto davanti
    const sternum: V3 = [neck[0], neck[1] - 0.25, neck[2]];
    const faceTop: V3 = [mouth[0], mouth[1], headZ];
    const neckC: V3 = [neck[0], neck[1], neck[2]];
    const segs: [V3, V3, number, number][] = [
      [faceTop, neckC, 0.085, 0.17],
      [neckC, out[sh], 0.06, 0.13],
      [neckC, sternum, 0.1, 0.13],
    ];
    // a toccare il viso sono le dita (all'ancoraggio il polso sta qualche centimetro più in là, dietro la mano):
    // conta il punto della mano più vicino, polso, dita del corpo e, se ci sono, i 21 punti della mano
    const hand: V3[] = [out[wr]];
    for (const f of wr === 15 ? [17, 19, 21] : [18, 20, 22]) if (out[f] && vis(lm[f]) > 0.3) hand.push(out[f]);
    const hb = wr === 15 ? 33 : 54;
    if (lm.length >= 133 && vis(lm[hb]) >= 0.5) {
      const h0 = XY(hb);
      for (const k of [4, 5, 8, 9, 12, 13, 16, 17]) {
        const q = XY(hb + k);
        hand.push([q[0] - h0[0] + out[wr][0], q[1] - h0[1] + out[wr][1], 0]);
      }
    }
    let best: { d: number; z: number; w: number } | null = null;
    for (const [p, q, dz, lim] of segs) {
      const ax = q[0] - p[0];
      const ay = q[1] - p[1];
      for (const hp of hand) {
        const t = Math.max(0, Math.min(1, ((hp[0] - p[0]) * ax + (hp[1] - p[1]) * ay) / (ax * ax + ay * ay || 1)));
        const c = lerp(p, q, t);
        const d = d2v(hp, c);
        // vicino al corpo la mano lo tocca; avvicinandosi ci arriva piano (prima saltava di colpo)
        if (d <= lim && (!best || d < best.d)) best = { d, z: c[2] + fwdZ * dz, w: Math.max(0, Math.min(1, (lim - d) / (lim * 0.4))) };
      }
    }
    if (!best) continue;
    const toMouth = Math.min(...hand.map((hp) => d2v(hp, mouth)));
    const drawing = toMouth < 0.16 && d2v(out[owr], out[osh]) > 0.4 && Math.abs(out[owr][1] - out[osh][1]) < 0.25 && Math.abs(out[el][1] - out[sh][1]) < 0.22;
    // in trazione con la mano al viso il contatto è pieno: la mano non resta a mezz'aria davanti
    if (drawing) best.w = Math.max(best.w, Math.max(0, Math.min(1, (0.16 - toMouth) / 0.06)));
    const wz = best.z;
    const lfa = d2v(out[el], out[wr]);
    const Lfa = Math.max(lfa, L(fa));
    const h = Math.sqrt(Math.max(0, Lfa * Lfa - lfa * lfa));
    const pick = (target: number) => (Math.abs(wz + h - target) < Math.abs(wz - h - target) ? wz + h : wz - h);
    let ez: number;
    if (drawing) {
      // linea della freccia: dalla mano dell'arco alla mano della corda, prolungata fino al gomito
      const bow = out[owr];
      const dx = out[wr][0] - bow[0];
      const lineZ = Math.abs(dx) > 0.05 ? wz + ((wz - bow[2]) / dx) * (out[el][0] - out[wr][0]) : wz;
      ez = (pick(lineZ) + lineZ) / 2;
    } else ez = pick(out[el][2]);
    const wNew = out[wr][2] + (wz - out[wr][2]) * best.w;
    const dWr = wNew - out[wr][2];
    out[el][2] = out[el][2] + (ez - out[el][2]) * best.w;
    out[wr][2] = wNew;
    for (const f of wr === 15 ? [17, 19, 21] : [18, 20, 22]) if (out[f]) out[f][2] += dWr;
  }
  // un braccio non passa dentro il busto (prima delle mani, che seguono il polso)
  keepArmsOut(out, cal);
  // (i punti in metri del modello di posa non danno più la forma del corpo: con l'arciere di fronte
  // alla camera la loro profondità piegava il busto all'indietro e portava il gomito dietro la testa.
  // Servono solo a dire se un osso va avanti o indietro)
  // mani (21 punti per mano, se rilevate): profondità relativa al polso
  if (lm.length >= 133) {
    for (const [base, wr] of [[33, 15], [54, 16]] as const) {
      if (vis(lm[base]) < 0.5) continue;
      const w0 = lm[base];
      const h0 = XY(base);
      // il polso della mano coincide con quello del corpo
      const off: V3 = [out[wr][0] - h0[0], out[wr][1] - h0[1], 0];
      for (let k = 0; k < 21; k++) {
        const p = lm[base + k];
        const q = XY(base + k);
        // profondità relativa al polso, limitata: la stima delle dita è rumorosa
        q[2] = out[wr][2] + Math.max(-0.1, Math.min(0.1, (-(((p.z ?? 0) - (w0.z ?? 0)) * aspect) / s) * 0.6));
        out[base + k] = add(q, off);
      }
    }
  }
  // viso (58 punti): servono a girare la testa come nel video (mento, fronte, occhi)
  if (lm.length >= FACE0 + FACE_IDS.length && vis(lm[FACE0]) >= 0.5) {
    const earZ = (out[7][2] + out[8][2]) / 2;
    let zm = 0;
    for (let k = 0; k < FACE_IDS.length; k++) zm += lm[FACE0 + k].z ?? 0;
    zm /= FACE_IDS.length;
    // posizione rispetto al naso: il viso resta sulla testa anche quando il corpo viene dai punti in metri
    const n0 = XY(0);
    for (let k = 0; k < FACE_IDS.length; k++) {
      const q = XY(FACE0 + k);
      out[FACE0 + k] = [out[0][0] + q[0] - n0[0], out[0][1] + q[1] - n0[1], earZ + 0.07 + Math.max(-0.12, Math.min(0.12, -(((lm[FACE0 + k].z ?? 0) - zm) * aspect) / s))];
    }
  }
  if (!hipsOk) {
    out[23] = add(out[11], [0.02, -0.5, 0]);
    out[24] = add(out[12], [-0.02, -0.5, 0]);
    out[23][0] = out[11][0] * 0.6;
    out[24][0] = out[12][0] * 0.6;
  }
  if (!anklesOk) {
    // in piedi, piedi alla larghezza delle spalle
    for (const [hip, knee, ank, heel, toe] of [[23, 25, 27, 29, 31], [24, 26, 28, 30, 32]] as const) {
      const h = out[hip];
      out[knee] = [h[0] * 1.15, 0.5, h[2] + 0.02];
      out[ank] = [h[0] * 1.3, 0.08, h[2]];
      out[heel] = [h[0] * 1.3, 0.03, h[2] - 0.06];
      out[toe] = [h[0] * 1.3, 0.02, h[2] + 0.16];
    }
  }
  for (const i of [29, 30, 31, 32]) if (!out[i] || vis(lm[i]) < 0.3) out[i] = i < 31 ? add(out[i - 2], [0, -0.05, -0.05]) : add(out[i - 4], [0, -0.06, 0.15]);
  if (anklesOk) {
    // in piedi per tirare i piedi sono piatti a terra. Nel video la camera sta più in alto dei piedi e le punte
    // sembrano più in basso delle caviglie: il piede si inclinava e le dita entravano nel pavimento di 5-9 cm.
    // Caviglie alla loro altezza, tallone e punta a terra; la direzione del piede resta quella del video
    for (const [ank, heel, toe] of [[27, 29, 31], [28, 30, 32]] as const) {
      const a = out[ank];
      a[1] = 0.08;
      const tx = (out[toe]?.[0] ?? a[0]) - a[0];
      const h = Math.hypot(tx, 0.15);
      const v: V3 = [(tx / h) * 0.17, 0, (0.15 / h) * 0.17];
      out[toe] = [a[0] + v[0], 0.02, a[2] + v[2]];
      out[heel] = [a[0] - v[0] * 0.35, 0.03, a[2] - v[2] * 0.35];
    }
  }
  return out;
}

const SKIN: V3 = [0.33, 0.74, 1.0];
const BONE: V3 = [0.86, 0.95, 1.0];
const WOOD: V3 = [0.62, 0.36, 0.17];

/** muscolo: rosso naturale a riposo, verso il giallo quando lavora */
const muscleCol = (a: number): V3 => {
  const t = Math.max(0, Math.min(1, (a - 0.3) / 0.6));
  return [0.72 + 0.28 * t, 0.27 + 0.55 * t, 0.22 + 0.06 * t];
};

export function buildModel(lm: Landmark[], aspect: number, hand: Hand, gear: Gear | null = null, cal: BoneCal | null = null, memo?: DepthMemo | null, time?: number, pre?: PrePose | null): Model | null {
  const J0 = pre?.J ?? bodyPoints(lm, aspect, cal, memo, time);
  if (!J0) return null;
  // postura delle tavole: si misura sul gesto del video; a richiesta la sagoma si corregge dove serve
  const pChecks = postureChecks(J0, hand);
  const pFix = postureMode.fix ? correctPosture(J0, hand) : null;
  const J = pFix ? pFix.J : J0;
  const S = sides(hand);
  const parts: Part[] = [];
  const push = (mesh: Part["mesh"], pl: { m: Float32Array; nm: Float32Array }, color: V3, mode: Mode, alpha: number, layer: Part["layer"], act = 0) =>
    parts.push({ mesh, m: pl.m, nm: pl.nm, color, mode, alpha, act, layer });

  const shL = J[11], shR = J[12], hipL = J[23], hipR = J[24];
  const shM = lerp(shL, shR, 0.5);
  const hipM = lerp(hipL, hipR, 0.5);
  const up = norm(sub(shM, hipM));
  const right = perp(up, sub(shR, shL));
  let fwd = norm(cross(right, up));
  // il davanti è dove guarda il naso
  if (dot(sub(J[0], lerp(J[7], J[8], 0.5)), fwd) < 0) fwd = mul(fwd, -1);
  const shW = len(sub(shR, shL));
  const hipW = len(sub(hipR, hipL));

  const seg = (a: V3, b: V3, r: number, rz = r, ext = 1.08, hint: V3 = fwd) => {
    const ay = norm(sub(b, a));
    const ax = perp(ay, hint);
    const az = norm(cross(ax, ay));
    return place(lerp(a, b, 0.5), ax, ay, az, r, (len(sub(b, a)) / 2) * ext, rz);
  };
  const ell = (c: V3, rx: number, ry: number, rz: number, ax: V3 = right, ay: V3 = up) => {
    const az = norm(cross(ax, ay));
    return place(c, ax, ay, az, rx, ry, rz);
  };

  const bow = { sh: J[S.bow[0]], el: J[S.bow[1]], wr: J[S.bow[2]] };
  const drw = { sh: J[S.draw[0]], el: J[S.draw[1]], wr: J[S.draw[2]] };
  // testa: centro tra le orecchie, orientata col naso; durante il tiro guarda il bersaglio
  const earM = lerp(J[7], J[8], 0.5);
  const headC = add(earM, mul(up, 0.025));
  const aimed = headAim(J, bow, drw, up, fwd);
  const headF = aimed.f;
  const headPitch = aimed.pitch;
  const headR = norm(cross(up, headF));
  const neckTop = add(headC, mul(up, -0.085));
  const bowIdx = J[hand === "destro" ? 19 : 20] ?? bow.wr;
  const drwIdx = J[S.drawFinger] ?? drw.wr;

  // quanto lavorano i muscoli: gomito della corda piegato = schiena e spalla della corda attive
  const drawAng = angleAt(drw.sh, drw.el, drw.wr);
  const bowAng = angleAt(bow.sh, bow.el, bow.wr);
  const armUp = Math.max(0, Math.min(1, 1 - Math.abs(bow.wr[1] - bow.sh[1]) / 0.35));
  const pull = Math.max(0, Math.min(1, (165 - drawAng) / 95)) * armUp;
  const push_ = Math.max(0, Math.min(1, (bowAng - 135) / 40)) * armUp;

  // ---------- scheletro ----------
  push("sphere", ell(headC, 0.072, 0.088, 0.082, headR, up), BONE, 1, 0.95, "osso");
  push("sphere", ell(add(add(headC, mul(up, -0.07)), mul(headF, 0.035)), 0.05, 0.03, 0.045, headR, up), BONE, 1, 0.95, "osso"); // mandibola
  // colonna: dal bacino alla testa, leggermente dietro
  const spineA = add(hipM, add(mul(up, 0.04), mul(fwd, -0.05)));
  const spineB = add(shM, add(mul(up, 0.0), mul(fwd, -0.06)));
  const nV = 22;
  for (let i = 0; i <= nV; i++) {
    const t = i / nV;
    const p = t < 0.8 ? lerp(spineA, spineB, t / 0.8) : lerp(spineB, neckTop, (t - 0.8) / 0.2);
    const bend = Math.sin(t * Math.PI * 2) * 0.012; // curve della colonna
    const r = 0.017 - t * 0.007;
    push("sphere", ell(add(p, mul(fwd, bend)), r * 1.25, r * 0.75, r), BONE, 1, 0.95, "osso");
    parts[parts.length - 1].deep = true;
  }
  // gabbia toracica: anelli inclinati
  const chestTop = add(shM, mul(up, -0.05));
  const ribTilt = norm(add(fwd, mul(up, -0.35)));
  const ribAx = norm(cross(up, ribTilt));
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const c = add(add(chestTop, mul(up, -0.29 * t)), mul(fwd, -0.005));
    const w = shW * (0.24 + 0.16 * Math.sin(Math.PI * (0.2 + t * 0.75)));
    const d = 0.065 + 0.03 * Math.sin(Math.PI * (0.2 + t * 0.7));
    // anello nel piano ribAx × ribTilt
    const ay = norm(cross(ribTilt, ribAx));
    push("torus", place(c, ribAx, ay, ribTilt, w, 0.085, d), BONE, 1, 0.8, "osso");
    parts[parts.length - 1].deep = true;
  }
  push("sphere", seg(add(chestTop, mul(fwd, 0.08)), add(chestTop, add(mul(fwd, 0.09), mul(up, -0.2))), 0.014, 0.008), BONE, 1, 0.95, "osso"); // sterno
  // clavicole e scapole
  const notch = add(chestTop, add(mul(fwd, 0.07), mul(up, 0.03)));
  for (const sh of [shL, shR]) {
    push("sphere", seg(notch, add(sh, mul(fwd, 0.02)), 0.009), BONE, 1, 0.95, "osso");
    const sc = add(lerp(sh, shM, 0.42), add(mul(up, -0.09), mul(fwd, -0.075)));
    push("sphere", ell(sc, 0.055, 0.075, 0.012), BONE, 1, 0.8, "osso");
  }
  // braccia
  for (const a of [bow, drw]) {
    push("sphere", seg(a.sh, a.el, 0.014), BONE, 1, 0.95, "osso");
    push("sphere", ell(a.el, 0.024, 0.024, 0.024), BONE, 1, 0.95, "osso");
    const ay = norm(sub(a.wr, a.el));
    const off = mul(perp(ay, up), 0.009);
    push("sphere", seg(add(a.el, off), add(a.wr, off), 0.008), BONE, 1, 0.95, "osso"); // radio
    push("sphere", seg(sub(a.el, off), sub(a.wr, off), 0.008), BONE, 1, 0.95, "osso"); // ulna
  }
  // mani: con i 21 punti per mano, falangi e dita vere (si vedono presa dell'arco e dita sulla corda);
  // altrimenti tre ossa verso indice, mignolo e pollice
  const handBase = (wr: number) => (wr === 15 ? 33 : 54);
  const fingerLinks: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20]];
  for (const [wrI, fingers] of [[15, [19, 17, 21]], [16, [20, 18, 22]]] as const) {
    const base = handBase(wrI);
    if (J[base]) {
      for (const [a, b] of fingerLinks) {
        const long = a === 0; // metacarpi
        push("sphere", seg(J[base + a], J[base + b], long ? 0.0055 : 0.0048, long ? 0.0045 : 0.0048, 1.02), BONE, 1, 0.95, "osso");
      }
      for (const k of [2, 3, 6, 7, 10, 11, 14, 15, 18, 19]) push("sphere", ell(J[base + k], 0.0062, 0.0062, 0.0062), BONE, 1, 0.95, "osso");
    } else for (const f of fingers) if (J[f]) push("sphere", seg(J[wrI], J[f], 0.006), BONE, 1, 0.9, "osso");
  }
  // bacino
  const pelC = add(hipM, mul(up, 0.06));
  push("torus", place(add(pelC, mul(up, -0.02)), right, norm(cross(fwd, right)), fwd, hipW * 0.62 + 0.03, 0.4, 0.07), BONE, 1, 0.85, "osso");
  for (const sgn of [-1, 1]) push("sphere", ell(add(pelC, add(mul(right, sgn * (hipW * 0.5 + 0.03)), mul(up, 0.04))), 0.055, 0.06, 0.02, right, up), BONE, 1, 0.8, "osso");
  // gambe
  for (const [hip, knee, ank, heel, toe] of [[23, 25, 27, 29, 31], [24, 26, 28, 30, 32]] as const) {
    push("sphere", seg(J[hip], J[knee], 0.017), BONE, 1, 0.95, "osso");
    push("sphere", ell(add(J[knee], mul(fwd, 0.02)), 0.025, 0.025, 0.02), BONE, 1, 0.95, "osso");
    push("sphere", seg(J[knee], J[ank], 0.014), BONE, 1, 0.95, "osso");
    push("sphere", seg(add(J[knee], mul(right, 0.02)), add(J[ank], mul(right, 0.02)), 0.007), BONE, 1, 0.9, "osso");
    push("sphere", seg(J[heel], J[toe], 0.016, 0.01, 1.05, up), BONE, 1, 0.9, "osso");
  }

  // ---------- muscoli: da origine a inserzione, si accorciano e si allungano con il gesto ----------
  // a volume costante: quando un muscolo si accorcia diventa più spesso (il bicipite si gonfia)
  let tag = "";
  const M = (a: V3, b: V3, r: number, rz: number, act: number, rest = 0, hint: V3 = fwd, alpha = 0.94) => {
    const L = len(sub(b, a)) || 0.01;
    const k = rest > 0 ? Math.max(0.75, Math.min(1.45, Math.sqrt(rest / L))) : 1;
    push("spindle", seg(a, b, r * k * 1.25, rz * k * 1.25, 1.1, hint), muscleCol(act), 2, alpha, "muscolo", act);
    parts[parts.length - 1].id = tag;
  };
  const flat = (a: V3, b: V3, w: number, t: number, act: number, normal: V3, alpha = 0.9) => {
    // muscolo piatto (trapezio, dorsale, pettorale): largo w, spesso t, steso sulla superficie
    const ay = norm(sub(b, a));
    const az = perp(ay, normal);
    const ax = norm(cross(ay, az));
    push("spindle", place(lerp(a, b, 0.5), ax, ay, az, w * 1.2, (len(sub(b, a)) / 2) * 1.1, t), muscleCol(act), 2, alpha, "muscolo", act);
    parts[parts.length - 1].id = tag;
  };
  const back = mul(fwd, -1);
  const spineAt = (t: number) => add(lerp(add(hipM, mul(up, 0.04)), shM, t), mul(fwd, -0.07)); // 0 bacino, 1 spalle
  const sternumTop = add(shM, add(mul(fwd, 0.075), mul(up, -0.03)));
  const sternumMid = add(lerp(hipM, shM, 0.72), mul(fwd, 0.095));
  for (const a of [bow, drw]) {
    const isDraw = a === drw;
    const sd = isDraw ? "corda" : "arco";
    const out_ = norm(sub(a.sh, shM));
    const L1 = len(sub(a.el, a.sh));
    const ua = norm(sub(a.el, a.sh));
    const fa = norm(sub(a.wr, a.el));
    // lato verso cui si piega il gomito (il bicipite); col braccio disteso si usa il davanti del busto
    const bend = sub(fa, mul(ua, dot(fa, ua)));
    const fU = len(bend) > 0.15 ? norm(bend) : perp(ua, fwd);
    const acromion = add(a.sh, add(mul(up, 0.025), mul(out_, 0.01)));
    const tuberosity = add(lerp(a.sh, a.el, 0.45), mul(perp(ua, out_), 0.012));
    const shoulderAct = isDraw ? 0.3 + 0.65 * pull : 0.35 + 0.6 * push_;
    // deltoide: tre capi (anteriore, medio, posteriore) che vanno alla tuberosità dell'omero
    tag = `${sd}-deltoide-ant`;
    M(add(acromion, mul(fwd, 0.035)), tuberosity, 0.024, 0.02, isDraw ? 0.25 + 0.3 * pull : 0.4 + 0.5 * push_, L1 * 0.5, fwd);
    tag = `${sd}-deltoide-med`;
    M(add(acromion, mul(out_, 0.015)), tuberosity, 0.026, 0.022, shoulderAct, L1 * 0.5, out_);
    tag = `${sd}-deltoide-post`;
    M(add(acromion, mul(back, 0.04)), tuberosity, 0.024, 0.02, isDraw ? 0.35 + 0.65 * pull : 0.3 + 0.3 * push_, L1 * 0.5, back);
    // bicipite: dalla spalla (davanti) al radio appena sotto il gomito
    const bicIns = add(add(a.el, mul(fa, 0.04)), mul(fU, 0.012));
    tag = `${sd}-bicipite`;
    M(add(a.sh, add(mul(fU, 0.022), mul(ua, 0.04))), bicIns, 0.024, 0.022, isDraw ? 0.35 + 0.35 * pull : 0.25, L1 * 0.95);
    // brachiale, sotto il bicipite
    tag = `${sd}-brachiale`;
    M(add(lerp(a.sh, a.el, 0.5), mul(fU, 0.012)), add(a.el, mul(fa, 0.03)), 0.017, 0.015, isDraw ? 0.3 + 0.3 * pull : 0.2, L1 * 0.55);
    // tricipite: dietro la spalla fino all'olecrano (si allunga quando il gomito si piega)
    const olecranon = sub(sub(a.el, mul(fa, 0.022)), mul(fU, 0.02));
    tag = `${sd}-tricipite`;
    M(add(add(a.sh, mul(fU, -0.022)), mul(ua, 0.03)), olecranon, 0.027, 0.024, isDraw ? 0.25 : 0.4 + 0.55 * push_, L1 * 0.95);
    // avambraccio: flessori (dita che agganciano la corda), estensori e brachioradiale
    const fF = perp(fa, fU);
    tag = `${sd}-flessori`;
    M(add(a.el, mul(fF, 0.018)), add(a.wr, mul(fF, 0.008)), 0.019, 0.016, isDraw ? 0.35 + 0.5 * pull : 0.35, len(sub(a.wr, a.el)), fF);
    tag = `${sd}-estensori`;
    M(add(a.el, mul(fF, -0.018)), add(a.wr, mul(fF, -0.008)), 0.017, 0.015, isDraw ? 0.3 : 0.3 + 0.25 * push_, len(sub(a.wr, a.el)), fF);
    tag = `${sd}-brachioradiale`;
    M(add(lerp(a.sh, a.el, 0.78), mul(fU, 0.015)), add(lerp(a.el, a.wr, 0.85), mul(fU, 0.01)), 0.017, 0.014, isDraw ? 0.35 + 0.3 * pull : 0.25, L1 * 0.22 + len(sub(a.wr, a.el)) * 0.85);
    // gran pettorale: dallo sterno e dalla clavicola all'omero
    const pecIns = add(lerp(a.sh, a.el, 0.14), mul(fwd, 0.015));
    tag = `${sd}-pettorale`;
    flat(add(lerp(sternumTop, a.sh, 0.3), mul(up, 0.0)), pecIns, 0.045, 0.014, isDraw ? 0.2 : 0.25, fwd);
    tag = `${sd}-pettorale`;
    flat(sternumMid, pecIns, 0.05, 0.016, isDraw ? 0.2 : 0.3, fwd);
    // scapola: quella della corda si avvicina alla colonna in trazione
    const scap = add(lerp(a.sh, spineAt(0.85), isDraw ? 0.42 + 0.12 * pull : 0.45), add(mul(up, -0.09), mul(back, 0.015)));
    // trapezio: superiore (collo → acromion), medio (colonna → spina della scapola), inferiore
    tag = `${sd}-trapezio-sup`;
    flat(add(neckTop, mul(back, 0.035)), acromion, 0.032, 0.012, isDraw ? 0.3 + 0.4 * pull : 0.2 + 0.2 * push_, back);
    tag = `${sd}-trapezio-med`;
    flat(add(spineAt(0.9), mul(back, 0.01)), add(scap, mul(up, 0.05)), 0.035, 0.012, isDraw ? 0.3 + 0.7 * pull : 0.3, back);
    tag = `${sd}-trapezio-inf`;
    flat(add(spineAt(0.45), mul(back, 0.01)), add(scap, mul(up, 0.03)), 0.03, 0.011, isDraw ? 0.25 + 0.5 * pull : 0.3 + 0.5 * push_, back);
    // romboidi: dalla colonna al bordo interno della scapola
    tag = `${sd}-romboidi`;
    flat(add(spineAt(0.78), mul(back, 0.012)), add(scap, mul(out_, -0.035)), 0.028, 0.012, isDraw ? 0.3 + 0.7 * pull : 0.25, back);
    // sottospinato e grande rotondo: dalla scapola all'omero (dietro)
    tag = `${sd}-sottospinato`;
    M(add(scap, mul(back, 0.012)), add(lerp(a.sh, a.el, 0.08), mul(back, 0.025)), 0.025, 0.012, isDraw ? 0.3 + 0.6 * pull : 0.3 + 0.3 * push_, 0, back);
    // gran dorsale: dalla schiena bassa all'omero, si allunga quando il braccio sale
    const latIns = add(lerp(a.sh, a.el, 0.12), mul(back, 0.01));
    tag = `${sd}-dorsale`;
    flat(add(lerp(spineAt(0.15), add(hipM, mul(out_, 0.08)), 0.6), mul(back, 0.03)), latIns, 0.042, 0.013, isDraw ? 0.3 + 0.45 * pull : 0.3 + 0.35 * push_, add(back, mul(out_, 0.6)), 0.85);
    // dentato anteriore: costole → scapola, tiene la spalla dell'arco bassa e avanti
    tag = `${sd}-dentato`;
    flat(add(lerp(sternumMid, a.sh, 0.75), mul(up, -0.08)), add(scap, mul(fwd, 0.04)), 0.03, 0.012, isDraw ? 0.2 : 0.3 + 0.5 * push_, out_, 0.85);
    // sternocleidomastoideo
    const ear = J[(isDraw ? S.draw[0] : S.bow[0]) === 11 ? 7 : 8];
    tag = `${sd}-scm`;
    M(add(ear, mul(up, -0.02)), add(sternumTop, mul(out_, 0.015)), 0.011, 0.01, 0.2, 0, out_);
  }
  // addome e schiena
  for (let i = 0; i < 4; i++) {
    const t0 = 0.08 + i * 0.16;
    for (const sg of [-1, 1]) {
      const c0 = add(add(lerp(hipM, shM, t0), mul(fwd, 0.1)), mul(right, sg * 0.032));
      const c1 = add(add(lerp(hipM, shM, t0 + 0.14), mul(fwd, 0.105)), mul(right, sg * 0.032));
      // retto dell'addome: riquadri piatti divisi dai tendini
      tag = `addome`;
      push("sphere", ell(lerp(c0, c1, 0.5), 0.03, len(sub(c1, c0)) * 0.55, 0.012), muscleCol(0.3), 2, 0.92, "muscolo", 0.3);
      parts[parts.length - 1].id = tag;
    }
  }
  for (const sg of [-1, 1]) {
    tag = `obliqui`;
    flat(add(add(lerp(hipM, shM, 0.15), mul(fwd, 0.05)), mul(right, sg * 0.11)), add(add(lerp(hipM, shM, 0.6), mul(fwd, 0.07)), mul(right, sg * 0.1)), 0.045, 0.014, 0.25, add(fwd, mul(right, sg)), 0.8); // obliqui
    tag = `erettori`;
    flat(add(spineAt(0.02), mul(right, sg * 0.03)), add(spineAt(0.85), mul(right, sg * 0.028)), 0.022, 0.018, 0.35, back, 0.9); // erettori della colonna
  }
  // gambe: glutei, quadricipite, femorali, polpacci, tibiale
  for (const [hip, knee, ank] of [[23, 25, 27], [24, 26, 28]] as const) {
    const lg = norm(sub(J[knee], J[hip]));
    const side = norm(sub(J[hip], hipM));
    tag = `glutei`;
    flat(add(add(J[hip], mul(back, 0.07)), mul(up, 0.07)), add(add(lerp(J[hip], J[knee], 0.25), mul(back, 0.05)), mul(side, 0.03)), 0.065, 0.035, 0.2, back, 0.9);
    tag = `quadricipite`;
    M(add(J[hip], mul(fwd, 0.045)), add(J[knee], mul(fwd, 0.045)), 0.04, 0.034, 0.2, 0, fwd);
    tag = `quadricipite`;
    M(add(add(lerp(J[hip], J[knee], 0.15), mul(side, 0.05)), mul(fwd, 0.015)), add(add(J[knee], mul(side, 0.03)), mul(fwd, 0.02)), 0.038, 0.032, 0.18, 0, side);
    tag = `quadricipite`;
    M(add(add(lerp(J[hip], J[knee], 0.4), mul(side, -0.04)), mul(fwd, 0.02)), add(add(J[knee], mul(side, -0.03)), mul(fwd, 0.02)), 0.035, 0.032, 0.18, 0, side);
    tag = `femorali`;
    M(add(J[hip], mul(back, 0.055)), add(J[knee], mul(back, 0.04)), 0.042, 0.036, 0.18, 0, back);
    tag = `polpacci`;
    for (const sg of [-1, 1]) M(add(add(J[knee], mul(back, 0.035)), mul(side, sg * 0.02)), add(lerp(J[knee], J[ank], 0.62), mul(back, 0.03)), 0.03, 0.03, 0.15, 0, back);
    tag = `tibiale`;
    M(add(lerp(J[knee], J[ank], 0.1), mul(fwd, 0.025)), add(lerp(J[knee], J[ank], 0.85), mul(fwd, 0.02)), 0.016, 0.014, 0.12, 0, fwd);
    void lg;
  }

  let tagHand = "";
  const handMuscle = (a: V3, b: V3, id: string) => {
    push("spindle", seg(a, b, 0.014, 0.01, 1.05), muscleCol(0.45), 2, 0.92, "muscolo", 0.45);
    parts[parts.length - 1].id = id;
  };
  void tagHand;
  // ---------- pelle (bordo luminoso) ----------
  const K = (pl: { m: Float32Array; nm: Float32Array }) => push("sphere", pl, SKIN, 0, 0.8, "pelle");
  K(ell(headC, 0.088, 0.115, 0.1, headR, up));
  K(seg(add(shM, mul(up, -0.02)), neckTop, 0.05, 0.05));
  K(ell(add(lerp(hipM, shM, 0.72), mul(up, -0.02)), shW * 0.62, 0.2, 0.12));
  K(ell(lerp(hipM, shM, 0.36), shW * 0.43, 0.17, 0.11));
  K(ell(add(hipM, mul(up, 0.03)), hipW * 0.75 + 0.07, 0.12, 0.115));
  for (const a of [bow, drw]) {
    K(ell(a.sh, 0.065, 0.065, 0.065));
    K(seg(a.sh, a.el, 0.052, 0.05));
    K(seg(a.el, a.wr, 0.042, 0.038));
  }
  for (const [wrI, idxI] of [[15, 19], [16, 20]] as const) {
    const base = handBase(wrI);
    if (J[base]) {
      // palmo e dita con la loro pelle
      K(seg(J[base], lerp(J[base + 5], J[base + 17], 0.5), 0.035, 0.016, 1.15));
      for (const [a, b] of fingerLinks) if (a !== 0) K(seg(J[base + a], J[base + b], 0.0095, 0.0095, 1.25));
      // muscoli del pollice (eminenza tenare): lavorano nella presa
      tagHand = `${wrI === S.bow[2] ? "arco" : "corda"}-mano`;
      handMuscle(J[base], J[base + 2], tagHand);
    } else if (J[idxI]) K(seg(J[wrI], add(J[idxI], mul(norm(sub(J[idxI], J[wrI])), 0.03)), 0.03, 0.045));
  }
  for (const [hip, knee, ank, heel, toe] of [[23, 25, 27, 29, 31], [24, 26, 28, 30, 32]] as const) {
    K(seg(J[hip], J[knee], 0.082, 0.08));
    K(seg(J[knee], J[ank], 0.058, 0.055));
    K(seg(J[heel], J[toe], 0.04, 0.03, 1.08, up));
  }

  // ---------- arco, corda, freccia ----------
  // presa: il palmo della mano dell'arco (con i punti della mano), altrimenti tra polso e indice
  const bowBase = handBase(S.bow[2]);
  const drwBase = handBase(S.draw[2]);
  let grip = J[bowBase] ? lerp(lerp(J[bowBase], J[bowBase + 5], 0.5), J[bowBase + 9], 0.5) : lerp(bow.wr, bowIdx, 0.55);
  // dita sulla corda: le seconde falangi di indice e medio
  // la corda sta nella piega della prima falange di indice e medio (la cocca tra le due dita)
  const fingers = J[drwBase] ? lerp(J[drwBase + 7], J[drwBase + 11], 0.5) : lerp(drw.wr, drwIdx, 0.75);
  // verso il bersaglio: dalla spalla della corda a quella dell'arco, in orizzontale
  let toT = sub(bow.sh, drw.sh);
  toT = norm([toT[0], 0, toT[2]]);
  // punto del fotogramma (0..1) -> metri, alla profondità di un punto del corpo vicino
  const bowWrI = S.bow[2];
  const drwWrI = S.draw[2];
  const sImg = Math.abs(lm[23].y - lm[11].y) / Math.max(1e-6, Math.abs(J[11][1] - J[23][1]));
  const fromImage = (x: number, y: number, ref: V3, refI: number): V3 => [ref[0] + ((x - lm[refI].x) * aspect) / sImg, ref[1] - (y - lm[refI].y) / sImg, ref[2]];
  // trazione: si decide sul fotogramma (2D), non sulla profondità stimata, che sbaglia spesso:
  // braccio dell'arco su e mano della corda verso il viso (o gomito della corda piegato)
  const mm = metricsOf(lm, hand, aspect, 1000);
  const drawn = Boolean(mm && mm.bowUp && (mm.handFace < 1.0 || drawAng < 115));
  // all'ancoraggio le dita sono al viso, alla profondità della mano (appoggiata sotto la mandibola,
  // dal lato del petto), mai dietro la linea delle spalle
  const toFace = (p: V3): V3 => {
    let q: V3 = [p[0], p[1], p[2]];
    if (drawn) {
      const handZ = J[drwWrI]?.[2] ?? q[2];
      const k = Math.max(0, Math.min(1, 1 - ((mm?.handFace ?? 1) - 0.35) / 0.65));
      q[2] += (handZ - q[2]) * k;
      const ahead = dot(sub(q, shM), fwd);
      if (ahead < 0.03) q = add(q, mul(fwd, 0.03 - ahead));
    }
    return q;
  };
  // la freccia vista nel fotogramma comanda: la cocca è la sua estremità dalla parte della mano della corda
  let arrowSeen: { nock: V3; tip: V3 } | null = null;
  if (gear?.arrow && sImg > 0) {
    const g = gear.arrow;
    const dw = lm[drwWrI];
    const d1 = Math.hypot((g.x1 - dw.x) * aspect, g.y1 - dw.y);
    const d2 = Math.hypot((g.x2 - dw.x) * aspect, g.y2 - dw.y);
    const [nx, ny, tx, ty] = d1 < d2 ? [g.x1, g.y1, g.x2, g.y2] : [g.x2, g.y2, g.x1, g.y1];
    // la cocca deve stare vicino alla mano della corda (entro 25 cm), altrimenti la linea trovata non è la freccia
    if (Math.min(d1, d2) / sImg < 0.25) {
      const nk = toFace(fromImage(nx, ny, fingers, drwWrI));
      const tp = fromImage(tx, ty, grip, bowWrI);
      if (len(sub(tp, nk)) > 0.3) arrowSeen = { nock: nk, tip: tp };
    }
  }
  // freccia partita (dopo il rilascio trovato nell'analisi): la corda è tornata avanti, niente freccia
  const loose = gear?.loose != null;
  // dita sulla corda: in trazione, oppure con la mano vicina all'arco (incocco e preparazione)
  const onString = !loose && (drawn || len(sub(fingers, grip)) < 0.35);
  let nock: V3;
  if (arrowSeen) nock = arrowSeen.nock;
  else if (onString) nock = toFace(fingers);
  else nock = sub(grip, mul(toT, 0.22)); // arco a riposo: la cocca sta sulla corda a 22 cm dalla presa
  // ancoraggio alla bocca (pinza mediterranea, Manuale FITA): in trazione, con la mano vicina al viso, la
  // punta dell'indice tocca l'angolo della bocca dal lato della corda e la cocca sta subito sotto. Con la
  // mano vera (hand-rig) la punta dell'indice sta 1,4 cm fuori, 1,4 cm sopra e 0,9 cm dietro la cocca:
  // la cocca va lì. Se nel video la mano è lontana dalla bocca resta dov'è (errore vero dell'arciere)
  {
    const corner = J[hand === "destro" ? 10 : 9];
    if (drawn && onString && corner && len(sub(grip, nock)) > 0.2) {
      const u0 = norm(sub(grip, nock));
      const upH: V3 = [0, 1, 0];
      const out = mul(norm(cross(u0, upH)), hand === "destro" ? 1 : -1);
      const target = add(corner, add(mul(out, 0.014), add(mul(upH, -0.014), mul(u0, 0.009))));
      const w = Math.max(0, Math.min(1, (0.13 - len(sub(nock, target))) / 0.06));
      if (w > 0) nock = lerp(nock, target, w);
    }
  }
  // se la mano sta proprio sulla presa la freccia non ha direzione: si usa il verso del bersaglio
  let u = len(sub(grip, nock)) > 0.08 ? norm(sub(grip, nock)) : toT;
  if (len(sub(grip, nock)) <= 0.08) nock = sub(grip, mul(toT, 0.22));
  if (arrowSeen) {
    const ua = norm(sub(arrowSeen.tip, arrowSeen.nock));
    if (dot(ua, u) > Math.cos((25 * Math.PI) / 180)) u = ua;
  }
  let n = perp(u, [0, 1, 0]);
  let half = 0.8;
  /**
   * Il centro dell'impugnatura dove lo tiene la mano dell'arco (WRAP_GRIP in anatomy-body): dal polso, con
   * le dita verso il bersaglio e la fila delle nocche lungo l'arco. Misurato sulla mano del modello: avanti
   * 10,2 cm, 2,6 cm verso il mignolo, 2,2 cm verso il palmo (di lato). Così l'arco va nella mano invece di
   * tirare la mano fino all'arco
   */
  const holeAt = (axis: V3, dir: V3): V3 => {
    const ax = norm(axis);
    const c1 = norm(sub(dir, mul(ax, dot(dir, ax))));
    const c3 = cross(c1, ax);
    const lat = S.bow[2] === 15 ? 0.0215 : -0.0221;
    return add(add(add(bow.wr, mul(c1, 0.102)), mul(ax, 0.0173)), mul(c3, lat));
  };
  // arco trovato nel video: inclinazione e lunghezza vere
  if (gear?.bow && sImg > 0) {
    const a = fromImage(gear.bow.x1, gear.bow.y1, bow.wr, bowWrI);
    const b = fromImage(gear.bow.x2, gear.bow.y2, bow.wr, bowWrI);
    let d = sub(a, b);
    if (d[1] < 0) d = mul(d, -1);
    const k = perp(u, norm(d));
    if (len(k) > 0.5) n = k;
    if (gear.bow.measured) half = Math.max(0.55, Math.min(0.9, len(sub(a, b)) / 2));
  }
  if (n[1] < 0) n = mul(n, -1);
  // posa dell'arco filtrata sull'intero video: un corpo rigido che non trema
  const bowPre = pre?.bow ?? null;
  const rawBow: BowPose = { n, u, half, nocked: !loose && (Boolean(arrowSeen) || onString) };
  if (bowPre) {
    n = bowPre.n;
    u = bowPre.u;
    half = bowPre.half;
  }
  // l'arco nel pugno: il centro dell'impugnatura dove la mano lo tiene davvero
  if (len(sub(bow.wr, drw.wr)) > 0.05) grip = holeAt(n, sub(bow.wr, drw.wr));
  // flettenti curvati verso il bersaglio (davanti alla presa), corda dietro
  const curve = (s: number): V3 => add(add(grip, mul(n, half * s)), mul(u, 0.02 - 0.13 * s * s));
  const steps = 44;
  for (let i = 0; i < steps; i++) {
    const s0 = -1 + (2 * i) / steps;
    const s1 = -1 + (2 * (i + 1)) / steps;
    const mid = (s0 + s1) / 2;
    const r = Math.abs(mid) < 0.28 ? 0.018 : 0.011 - Math.abs(mid) * 0.004;
    push("tube", seg(curve(s0), curve(s1), r, r * 0.7, 1.04, u), WOOD, 3, 1, "arco");
    parts[parts.length - 1].alt = "proc";
  }
  const tipU = curve(1);
  const tipD = curve(-1);
  push("tube", seg(tipU, nock, 0.0022, 0.0022, 1.0), [0.95, 0.95, 0.9], 3, 0.9, "arco");
  parts[parts.length - 1].alt = "proc";
  parts[parts.length - 1].id = "corda";
  push("tube", seg(tipD, nock, 0.0022, 0.0022, 1.0), [0.95, 0.95, 0.9], 3, 0.9, "arco");
  parts[parts.length - 1].alt = "proc";
  parts[parts.length - 1].id = "corda";
  // arco vero: il ricurvo tradizionale Samik Sage (riser di legno, flettenti laminati), con la presa nel
  // pugno della mano dell'arco e la corda dai suoi puntali. Per un mancino è lo stesso arco a specchio
  const bowX = norm(cross(n, u));
  const sBow = half / SAMIK.half;
  const mir = hand === "destro" ? 1 : -1;
  const bowXm = mul(bowX, mir);
  // l'arco si allunga solo in lunghezza: lo spessore del riser (l'impugnatura nella mano) resta quello vero
  const bowO = sub(grip, add(mul(bowXm, SAMIK.grip[0]), add(mul(n, SAMIK.grip[1] * sBow), mul(u, SAMIK.grip[2]))));
  const bowPl = place(bowO, bowXm, n, u, 1, sBow, 1);
  const realPart = (mesh: GearMesh, pl: { m: Float32Array; nm: Float32Array }, color: V3) => parts.push({ mesh, m: pl.m, nm: pl.nm, color, mode: 3, alpha: 1, act: 0, layer: "arco", alt: "real" });
  realPart("sbRiser", bowPl, [0.4, 0.25, 0.12]);
  realPart("sbLight", bowPl, [0.33, 0.19, 0.09]);
  realPart("sbDark", bowPl, [0.02, 0.02, 0.02]);
  const onBow = (q: V3): V3 => add(bowO, add(mul(bowXm, q[0]), add(mul(n, q[1] * sBow), mul(u, q[2]))));
  for (const tq of [SAMIK.tipA, SAMIK.tipB]) {
    parts.push({ ...seg(onBow(tq), nock, 0.0022, 0.0022, 1.0), mesh: "tube", color: [0.95, 0.95, 0.9], mode: 3, alpha: 0.9, act: 0, layer: "arco", alt: "real", id: "corda" });
  }
  // freccia: incoccata quando le dita sono sulla corda (in trazione o pronte a tirare)
  const nocked = bowPre ? !loose && bowPre.nocked : rawBow.nocked;
  let arrowOut: Model["arrow"];
  // appena scoccata: per un istante la freccia vola via davanti all'arco (55 m/s), poi non c'è più
  if (loose && (gear?.loose ?? 1) < 0.2) {
    const fly = 55 * (gear?.loose ?? 0) + 0.05;
    const tail = add(grip, mul(u, fly - 0.2));
    const head = add(grip, mul(u, fly + 0.55));
    push("tube", seg(tail, head, 0.004, 0.004, 1.0), [0.78, 0.6, 0.38], 3, 1, "arco");
  }
  if (nocked) {
    // la freccia appoggia sul rest: sopra la mano dell'arco e accanto al legno, a sinistra
    // dell'arco per un destro (a destra per un mancino), non in mezzo alla presa
    const leftOfBow = norm(cross(n, u));
    // sulla mensola del riser, contro la finestra
    const restPt = onBow(SAMIK.rest);
    const ua = len(sub(restPt, nock)) > 0.1 ? norm(sub(restPt, nock)) : u;
    const gn = len(sub(restPt, nock));
    // la freccia sporge sempre oltre la presa; se il video la mostra, finisce dove finisce davvero
    let arrowTip = add(nock, mul(ua, Math.max(0.72, gn + 0.06)));
    if (arrowSeen && gear?.arrow?.measured) {
      const along = dot(sub(arrowSeen.tip, nock), ua);
      if (along > gn * 0.8 && along < gn + 0.45) arrowTip = add(nock, mul(ua, along));
    }
    arrowOut = { nock, dir: ua, len: len(sub(arrowTip, nock)) };
    push("tube", seg(nock, arrowTip, 0.004, 0.004, 1.0), [0.98, 0.82, 0.35], 3, 1, "arco");
    parts[parts.length - 1].alt = "proc";
    push("sphere", seg(nock, add(nock, mul(ua, 0.09)), 0.012, 0.003, 1.0, n), [0.95, 0.35, 0.3], 3, 0.9, "arco"); // alette
    parts[parts.length - 1].alt = "proc";
    // freccia di legno vera con le penne naturali: lunga come quella stimata, una penna (la guida) lontana dall'arco
    const aLen = len(sub(arrowTip, nock));
    const ax = perp(ua, leftOfBow);
    const az = norm(cross(ax, ua));
    const arPl = place(nock, ax, ua, az, 1, aLen / WOOD_ARROW_LEN, 1);
    // nel modello l'asta di legno è «arTrim» e le legature di filo rosso sono «arShaft»
    parts.push({ mesh: "arShaft", m: arPl.m, nm: arPl.nm, color: [0.55, 0.12, 0.1], mode: 3, alpha: 1, act: 0, layer: "arco", alt: "real" });
    parts.push({ mesh: "arFletch", m: arPl.m, nm: arPl.nm, color: [0.62, 0.55, 0.47], mode: 3, alpha: 1, act: 0, layer: "arco", alt: "real" });
    parts.push({ mesh: "arPoint", m: arPl.m, nm: arPl.nm, color: [0.3, 0.3, 0.32], mode: 3, alpha: 1, act: 0, layer: "arco", alt: "real" });
    parts.push({ mesh: "arTrim", m: arPl.m, nm: arPl.nm, color: [0.78, 0.6, 0.38], mode: 3, alpha: 1, act: 0, layer: "arco", alt: "real" });
  }

  // ---------- quote ----------
  const kit = archeryKit(lm, aspect * 1000, 1000, hand, gear)?.nums ?? null;
  const kneeM = lerp(J[25], J[26], 0.5);
  const labels: Hud["labels"] = [];
  labels.push({ at: drw.el, text: `Gomito corda ${Math.round(drawAng)}°`, tone: "cyan" });
  labels.push({ at: hipM, text: `Anca ${Math.round(angleAt(shM, hipM, kneeM))}°`, tone: "cyan" });
  // parti da sistemare secondo le tavole: misurate sul gesto del video; con la sagoma corretta, dove si è corretto
  const fmt = (c: PostureCheck) => `${c.value.toFixed(c.unit === "×" ? 2 : 0).replace(".", ",")}${c.unit}`;
  const now = pFix ? new Map(postureChecks(J, hand).map((c) => [c.id, c])) : null;
  for (const c of pChecks) {
    if (c.ok) continue;
    const n = now?.get(c.id);
    if (pFix && pFix.fixed.includes(c.id) && n) {
      // corretto del tutto, o solo avvicinato (con spalla e polso fermi non sempre si arriva alla fascia)
      labels.push({ at: n.at, text: n.ok ? `Corretto: ${c.label.toLowerCase()} (${fmt(c)} → ${fmt(n)})` : `Avvicinato: ${c.label.toLowerCase()} ${fmt(c)} → ${fmt(n)} (rif. ${c.ref})`, tone: "gold" });
    } else labels.push({ at: n?.at ?? c.at, text: `${c.label}: ${fmt(c)} (rif. ${c.ref})`, tone: "warn" });
  }
  if (!pChecks.some((c) => !c.ok) && pChecks.length >= 5) labels.push({ at: shM, text: "Postura come nelle tavole", tone: "cyan" });
  if (drawn && !loose && kit?.anchorCm != null) labels.push({ at: nock, text: `Ancoraggio ${kit.anchorCm.toFixed(0)} cm dalla bocca`, tone: "gold" });
  const dims: Hud["dims"] = kit && drawn && !loose ? [{ a: nock, b: grip, text: `Allungo ${kit.drawCm.toFixed(0)} cm (${(kit.drawCm / 2.54).toFixed(1)}″)` }] : [];
  const arcs: Hud["arcs"] = [
    { at: drw.el, a: drw.sh, b: drw.wr, deg: drawAng },
    { at: bow.el, a: bow.sh, b: bow.wr, deg: bowAng },
  ];
  const feet = lerp(J[27], J[28], 0.5);
  feet[1] = 0;
  const top = Math.max(headC[1] + 0.12, tipU[1] + 0.04);
  return {
    parts,
    hud: { pts: { nock, grip, headC, shM, hipM, bowEl: bow.el, drawEl: drw.el, bowWr: bow.wr, drawWr: drw.wr, bowSh: bow.sh, drawSh: drw.sh, knees: lerp(J[25], J[26], 0.5) }, labels, arcs, dims, feet },
    center: [shM[0] * 0.5 + hipM[0] * 0.5, top * 0.52, shM[2] * 0.5 + hipM[2] * 0.5],
    height: top,
    J,
    hand,
    headF,
    posture: { checks: pChecks, fixed: pFix?.fixed ?? [] },
    headPitch,
    // la mano dell'arco lo tiene sempre (anche con il braccio giù); la mano della corda si apre al rilascio
    grip: { draw: loose ? 0 : aimed.drawing, bow: Math.max(0.85, aimed.raised) },
    frame: pre?.frame ?? imageFrame(lm, aspect) ?? undefined,
    build: cal?.build,
    bowAxis: n,
    bowPose: rawBow,
    palms: pre?.palms,
    arrow: arrowOut ?? { nock, dir: u, len: WOOD_ARROW_LEN },
  };
}

/**
 * Dove guarda la testa. Il naso rispetto alle orecchie dice quanto è girata, ma di scorcio (arciere
 * di fronte alla camera, bersaglio di lato) la girata si vede sempre più piccola del vero: la sagoma
 * guardava la camera invece del bersaglio. Durante il tiro l'arciere guarda il bersaglio lungo la
 * freccia, quindi con il braccio dell'arco alzato la testa si gira verso la mano dell'arco
 * (del tutto all'ancoraggio), al massimo di 85° rispetto al petto.
 */
function headAim(J: Record<number, V3>, bow: { sh: V3; el: V3; wr: V3 }, drw: { sh: V3; el: V3; wr: V3 }, up: V3, fwd: V3) {
  const earM = lerp(J[7], J[8], 0.5);
  const look = perp(up, sub(J[0], earM));
  const mouth: V3 = J[9] && J[10] ? lerp(J[9], J[10], 0.5) : J[0];
  const flat = (v: V3) => {
    const h = sub(v, mul(up, dot(v, up)));
    return len(h) > 1e-4 ? norm(h) : null;
  };
  // braccio dell'arco alzato e disteso verso il bersaglio
  const armLen = len(sub(bow.wr, bow.sh));
  const level = 1 - Math.min(1, Math.abs(bow.wr[1] - bow.sh[1]) / 0.3);
  const raised = Math.max(0, Math.min(1, level * Math.min(1, Math.max(0, (armLen - 0.3) / 0.15))));
  // mano della corda al viso: si guarda lungo la freccia
  const toFace = len(sub(drw.wr, mouth));
  const drawing = raised * Math.max(0, Math.min(1, (0.24 - toFace) / 0.1));
  // testa in giù (incocco, sguardo alle mani) o in su: il naso scende rispetto alle orecchie. A testa
  // dritta la punta del naso sta poco sotto le orecchie; chinando la testa scende in fretta.
  // In mira la testa resta dritta: lì conta poco (il tremolio dei punti non deve farla annuire)
  const drop = earM[1] - J[0][1];
  // (provato sui video: a testa dritta circa 2,2 cm, guardando le mani nell'incocco 5 cm e oltre)
  const pitch = Math.asin(Math.max(-0.4, Math.min(0.8, (drop - 0.022) / 0.05))) * (1 - 0.7 * drawing);
  const aim = flat(sub(bow.wr, drawing > 0.2 ? drw.wr : bow.sh));
  if (!aim || raised < 0.05) return { f: look, raised, drawing, pitch };
  // il viso segue il video (naso e orecchie) finché la mano della corda non arriva al viso; all'ancoraggio
  // l'arciere guarda il bersaglio lungo la freccia: testa e occhi si girano lì (di scorcio i punti del viso
  // la davano girata a metà, verso la camera)
  const w = Math.min(0.9, 0.12 * raised + 0.85 * drawing);
  let f = add(mul(look, 1 - w), mul(aim, w));
  if (len(f) < 1e-3) f = aim;
  f = perp(up, f);
  // collo: al massimo 85° dal petto
  const fw = flat(fwd);
  if (fw) {
    const c = dot(f, fw);
    const lim = Math.cos((85 * Math.PI) / 180);
    if (c < lim) {
      const side = norm(sub(f, mul(fw, c)));
      f = norm(add(mul(fw, lim), mul(side, Math.sqrt(1 - lim * lim))));
    }
  }
  return { f, raised, drawing, pitch };
}
