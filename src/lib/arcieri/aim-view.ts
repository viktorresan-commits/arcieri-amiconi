// Visuale dell'arciere: dall'occhio di mira, con il paglione alla distanza scelta.
//
// L'arciere guarda l'oro; la freccia però non punta all'oro: parte con l'angolo che serve perché, con il suo
// arco e le sue frecce, la traiettoria (gravità e aria) finisca proprio lì. Quanto la punta della freccia
// appare sotto (o sopra) l'oro è il «gap» del tiro istintivo. Qui si ricava l'angolo con il simulatore di volo
// dell'app (lib/arcieri/flight), poi si gira il corpo ricostruito attorno alla cocca di quel poco che serve
// e si costruiscono il paglione, il prato e la traiettoria.
import { fly, solveAngle, type FlightInput } from "./flight";
import { v3, type Model, type Part, type V3 } from "./anatomy-model";

/** arco e frecce dell'arciere (attrezzatura principale), con valori tipici dove mancano */
export type AimSetup = { drawLb: number; drawIn: number; grains: number; lengthIn: number; bowType: string; diameterMm?: number; known: boolean };

export type AimInfo = {
  /** angolo di partenza della freccia sopra l'orizzonte (gradi) */
  thetaDeg: number;
  /** angolo della freccia nel fotogramma del video (gradi) */
  videoDeg: number;
  v0: number;
  tof: number;
  /** quanto scende la freccia rispetto alla linea di partenza, all'arrivo (cm) */
  dropCm: number;
  /** dove la punta della freccia «copre» il bersaglio visto dall'occhio, rispetto all'oro (cm, + sopra) */
  gapCm: number;
  distanceM: number;
  faceCm: number;
  eye: V3;
  gold: V3;
  /** sfera da non disegnare (la testa, che dall'occhio non si vede): centro e raggio */
  cut: [number, number, number, number];
  /** traiettoria nel mondo, da poco oltre la punta della freccia al paglione (per disegnarla sopra il 3D) */
  path: V3[];
  /** dove l'occhio vede la punta della freccia sul piano del bersaglio */
  aimPt: V3;
};

const { add, sub, mul, dot, cross, len, norm } = v3;

/** visuale regolamentare per distanza (cm): 40 a 18 m, 60 a 25 m, 80 fino a 50 m, 122 oltre */
export function faceFor(distanceM: number) {
  return distanceM <= 20 ? 40 : distanceM <= 28 ? 60 : distanceM <= 55 ? 80 : 122;
}

const BOW_EFF: Record<string, { eta: number; k: number; brace: number; sighted: boolean }> = {
  tradizionale: { eta: 0.72, k: 0.5, brace: 20, sighted: false },
  longbow: { eta: 0.68, k: 0.48, brace: 17, sighted: false },
  nudo: { eta: 0.74, k: 0.55, brace: 21, sighted: false },
  olimpico: { eta: 0.78, k: 0.55, brace: 22, sighted: true },
  compound: { eta: 0.84, k: 0.7, brace: 18, sighted: true },
};
const effOf = (t: string) => BOW_EFF[t === "longbow" || t === "flatbow" ? "longbow" : t === "nudo" || t === "olimpico" || t === "compound" ? t : "tradizionale"];

/** matrice di un pezzo: assi (già con la scala) e posizione */
function placeM(c: V3, ax: V3, ay: V3, az: V3, sx: number, sy: number, sz: number) {
  const m = new Float32Array([ax[0] * sx, ax[1] * sx, ax[2] * sx, 0, ay[0] * sy, ay[1] * sy, ay[2] * sy, 0, az[0] * sz, az[1] * sz, az[2] * sz, 0, c[0], c[1], c[2], 1]);
  const nm = new Float32Array([ax[0] / sx, ax[1] / sx, ax[2] / sx, ay[0] / sy, ay[1] / sy, ay[2] / sy, az[0] / sz, az[1] / sz, az[2] / sz]);
  return { m, nm };
}
/** ruota tutto il modello (corpo, arco, freccia, punti) di R attorno a `pivot` */
function turnModel(model: Model, pivot: V3, axis: V3, ang: number): Model {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const k = norm(axis);
  const rv = (v: V3): V3 => add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
  const rp = (p: V3): V3 => add(pivot, rv(sub(p, pivot)));
  const mulM = (m: Float32Array) => {
    const o = new Float32Array(16);
    for (let col = 0; col < 3; col++) {
      const v: V3 = [m[col * 4], m[col * 4 + 1], m[col * 4 + 2]];
      const r = rv(v);
      o[col * 4] = r[0];
      o[col * 4 + 1] = r[1];
      o[col * 4 + 2] = r[2];
    }
    const t = rp([m[12], m[13], m[14]]);
    o[12] = t[0];
    o[13] = t[1];
    o[14] = t[2];
    o[15] = 1;
    return o;
  };
  const mulN = (n: Float32Array) => {
    const o = new Float32Array(9);
    for (let col = 0; col < 3; col++) {
      const r = rv([n[col * 3], n[col * 3 + 1], n[col * 3 + 2]]);
      o[col * 3] = r[0];
      o[col * 3 + 1] = r[1];
      o[col * 3 + 2] = r[2];
    }
    return o;
  };
  const J: Record<number, V3> = {};
  for (const [k_, p] of Object.entries(model.J ?? {})) J[Number(k_)] = rp(p);
  const pts: Record<string, V3> = {};
  for (const [k_, p] of Object.entries(model.hud.pts)) pts[k_] = rp(p);
  return {
    ...model,
    parts: model.parts.map((p) => ({ ...p, m: mulM(p.m), nm: mulN(p.nm) })),
    hud: { ...model.hud, pts, labels: [], arcs: [], dims: [] },
    J,
    headF: model.headF ? rv(model.headF) : undefined,
    bowAxis: model.bowAxis ? rv(model.bowAxis) : undefined,
    palms: model.palms ? { L: model.palms.L ? rv(model.palms.L) : undefined, R: model.palms.R ? rv(model.palms.R) : undefined } : undefined,
    arrow: model.arrow ? { nock: rp(model.arrow.nock), dir: rv(model.arrow.dir), len: model.arrow.len } : undefined,
    center: rp(model.center),
  };
}

/**
 * La scena della mira: il modello girato perché la freccia abbia l'angolo balistico, il paglione a
 * `distanceM` metri lungo la linea di tiro con la visuale regolamentare e l'oro a 1,30 m, il prato e la
 * traiettoria. Restituisce anche l'occhio (per la camera) e i numeri del tiro.
 */
export function aimScene(model: Model, setup: AimSetup, distanceM: number, hand: "destro" | "mancino"): { model: Model; info: AimInfo } | null {
  const J = model.J;
  const ar = model.arrow;
  if (!J || !ar || !J[27] || !J[28]) return null;
  const up: V3 = [0, 1, 0];
  let a: V3 = [ar.dir[0], 0, ar.dir[2]];
  if (len(a) < 0.2) return null;
  a = norm(a);
  const nock = ar.nock;
  const videoRad = Math.asin(Math.max(-1, Math.min(1, ar.dir[1])));
  // occhio di mira: quello sopra la freccia (destro per un destro), dai punti del viso
  const eyeI = hand === "destro" ? 5 : 2;
  const eye0 = J[eyeI] ?? J[0];
  if (!eye0) return null;
  const feet = v3.lerp(J[27], J[28], 0.5);
  // l'occhio sta sopra la freccia, all'altezza data dal viso dell'arciere (occhio-cocca) e poco dietro la
  // cocca: è la mira dell'arco nudo e tradizionale. Dal video l'occhio e la cocca escono con qualche
  // centimetro di errore di profondità, che qui spostava tutta la vista di lato
  const eyeH = Math.max(0.04, Math.min(0.14, dot(sub(eye0, nock), up)));
  const eyeBack = Math.max(0.01, Math.min(0.04, dot(sub(nock, eye0), a)));
  // il paglione sulla linea della freccia, a distanceM dalla linea di tiro (i piedi)
  const along = distanceM + dot(sub(feet, nock), a);
  const goldH = 1.3;
  const faceCm = faceFor(distanceM);
  const eff = effOf(setup.bowType);
  const eyeCm = eyeH * 100;
  const dMm = setup.diameterMm ?? (setup.bowType === "compound" || setup.bowType === "olimpico" ? 5.5 : 8);
  const input: FlightInput = {
    drawLb: setup.drawLb,
    drawCm: setup.drawIn * 2.54,
    braceCm: eff.brace,
    eta: eff.eta,
    k: eff.k,
    grains: setup.grains,
    diameterMm: dMm,
    lengthCm: setup.lengthIn * 2.54,
    fletch: setup.bowType === "compound" || setup.bowType === "olimpico" ? "vane3" : "feather3",
    distanceM: along,
    // l'altezza da cui parte la freccia è quella della cocca ricostruita
    heightCm: ((nock[1] + eyeCm / 100 + dMm / 2000) / 0.936) * 100,
    eyeCm,
    eyeBackCm: eyeBack * 100,
    wind: 0,
    sighted: eff.sighted,
    faceCm,
    zones: 10,
    goldM: goldH,
    lbAt28: setup.bowType !== "compound",
  };
  const theta = solveAngle(input);
  const hit = fly(input, theta, 0);
  // il corpo girato attorno alla cocca: la freccia prende l'angolo balistico
  const axis = cross(a, up);
  const turned = turnModel(model, nock, axis, theta - videoRad);
  const eye = add(add(nock, mul(up, eyeH)), mul(a, -eyeBack));
  // la testa ricostruita non si disegna (la camera è nell'occhio): sfera attorno al centro della testa
  const TJ = turned.J ?? J;
  const headC = TJ[7] && TJ[8] ? v3.lerp(TJ[7], TJ[8], 0.5) : add(TJ[0] ?? eye, mul(a, -0.08));
  const cut: [number, number, number, number] = [headC[0], headC[1], headC[2], Math.max(0.12, len(sub(eye, headC)) + 0.035)];
  const gold: V3 = [nock[0] + a[0] * along, goldH, nock[2] + a[2] * along];
  const side = norm(cross(a, up));
  const parts: Part[] = [];
  // paglione (il file guarda verso -x: -x verso l'arciere), alzato perché l'oro sia a 1,30 m
  const bossC: V3 = [gold[0], goldH - 1.202, gold[2]];
  const boss = placeM(bossC, a, up, side, 1, 1, 1);
  for (const mesh of ["tgStraw", "tgWood", "tgMetal", "tgFlag"] as const) parts.push({ mesh, m: boss.m, nm: boss.nm, color: mesh === "tgFlag" ? [0.55, 0.06, 0.05] : [0.8, 0.8, 0.8], mode: 3, alpha: 1, act: 0, layer: "arco", alt: "real" });
  // visuale di carta sul paglione, inclinata come il paglione (normale verso l'arciere e un po' in su)
  const fn = norm(add(mul(a, -0.991), mul(up, 0.136)));
  const faceUp = norm(cross(fn, side));
  const faceC = add(add(bossC, mul(up, 1.202)), mul(fn, 0.012 + distanceM * 0.0003));
  const fr = faceCm / 200;
  const face = placeM(faceC, fn, faceUp, cross(fn, faceUp), 1, fr, fr);
  parts.push({ mesh: "tgFace", m: face.m, nm: face.nm, color: [1, 1, 1], mode: 3, alpha: 1, act: 0, layer: "arco", alt: "real" });
  // prato in metri dalla linea di tiro (i piedi): le strisce falciate ogni 5 m danno la distanza
  const ground = placeM([feet[0], 0, feet[2]], a, up, side, 1, 1, 1);
  parts.push({ mesh: "ground", m: ground.m, nm: ground.nm, color: [0.2, 0.32, 0.14], mode: 3, alpha: 1, act: 0, layer: "arco", alt: "real" });
  // traiettoria: dalla punta della freccia in poi (vicino all'occhio coprirebbe la freccia)
  const arLen = turned.arrow?.len ?? 0.74;
  const path = hit.path.filter((q) => q.x > arLen + 0.4).map((q): V3 => [nock[0] + a[0] * q.x, q.z, nock[2] + a[2] * q.x]);
  // dove l'occhio vede la punta della freccia sul piano del bersaglio
  const dir = turned.arrow?.dir ?? norm(add(mul(a, Math.cos(theta)), mul(up, Math.sin(theta))));
  const tip = add(nock, mul(dir, turned.arrow?.len ?? 0.74));
  const ray = sub(tip, eye);
  const tHit = (along - dot(sub(eye, nock), a)) / Math.max(1e-4, dot(ray, a));
  const aimPt = add(eye, mul(ray, tHit));
  const gapCm = (aimPt[1] - goldH) * 100;
  const dropCm = (nock[1] + Math.tan(theta) * along - hit.z) * 100;
  // la corda passa a pochi centimetri dall'occhio: l'occhio la vede sfocata, quasi trasparente
  const own = turned.parts.map((p) => (p.id === "corda" ? { ...p, alpha: 0.12 } : p));
  return {
    model: { ...turned, parts: [...own, ...parts] },
    info: { thetaDeg: (theta * 180) / Math.PI, videoDeg: (videoRad * 180) / Math.PI, v0: hit.v0, tof: hit.t, dropCm, gapCm, distanceM, faceCm, eye, gold, cut, path, aimPt },
  };
}
