/**
 * Come si comportano i muscoli: un muscolo che si accorcia si gonfia, uno che si allunga si assottiglia
 * (il volume resta lo stesso), e quello che lavora si indurisce un poco. Per ogni gruppo muscolare i due
 * attacchi (origine e inserzione) sono punti anatomici presi dallo scheletro; a ogni posa si misura di
 * quanto si è accorciato tra i due attacchi rispetto al corpo a riposo e lo si passa alla scheda grafica,
 * che spinge la superficie del ventre muscolare (e la pelle sopra) verso l'esterno o verso l'interno.
 */
import type { BodyBatch, BodyData } from "./anatomy-body";

const STRIDE = 16;

function vertexReader(data: BodyData) {
  const { lo, hi } = data.meta;
  const dv = new DataView(data.buf);
  const sx = (hi[0] - lo[0]) / 65535;
  const sy = (hi[1] - lo[1]) / 65535;
  const sz = (hi[2] - lo[2]) / 65535;
  const u8 = new Uint8Array(data.buf);
  return {
    u8,
    pos(at: number, out: Float32Array, k = 0) {
      out[k] = lo[0] + dv.getUint16(at, true) * sx;
      out[k + 1] = lo[1] + dv.getUint16(at + 2, true) * sy;
      out[k + 2] = lo[2] + dv.getUint16(at + 4, true) * sz;
    },
  };
}

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sum = (...v: V3[]): V3 => v.reduce((acc, x) => add(acc, x), [0, 0, 0] as V3);

/** punti dello scheletro di un lato (indici dei 33 punti della posa) e assi del busto e del bacino */
type Ctx = {
  sh: V3; el: V3; wr: V3; ix: V3; hip: V3; kn: V3; an: V3; he: V3; to: V3; ear: V3; osh: V3;
  shM: V3; hipM: V3; up: V3; fwd: V3; lat: V3; upP: V3; fwdP: V3; latP: V3;
};

function ctxOf(P: (i: number) => V3 | undefined, side: "L" | "R" | "C"): Ctx | null {
  const need = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  for (const i of need) if (!P(i)) return null;
  const g = (i: number) => P(i) as V3;
  const L = side !== "R";
  const shM = lerp(g(11), g(12), 0.5);
  const hipM = lerp(g(23), g(24), 0.5);
  const up = norm(sub(shM, hipM));
  // destra dell'arciere (dalla spalla sinistra alla destra), davanti dove guarda il naso
  const right = norm(sub(g(12), g(11)));
  let fwd = norm(cross(up, right));
  if (dot(sub(g(0), lerp(g(7), g(8), 0.5)), fwd) < 0) fwd = mul(fwd, -1);
  const rightP = norm(sub(g(24), g(23)));
  const upP: V3 = [0, 1, 0];
  let fwdP = norm(cross(upP, rightP));
  if (dot(fwdP, fwd) < 0) fwdP = mul(fwdP, -1);
  const lat = L ? mul(right, -1) : right;
  const latP = L ? mul(rightP, -1) : rightP;
  const pick = (l: number, r: number) => g(L ? l : r);
  const opt = (l: number, r: number, fb: V3) => P(L ? l : r) ?? fb;
  const wr = pick(15, 16);
  const an = pick(27, 28);
  return {
    sh: pick(11, 12), el: pick(13, 14), wr, ix: opt(19, 20, wr), hip: pick(23, 24), kn: pick(25, 26), an,
    he: opt(29, 30, an), to: opt(31, 32, an), ear: pick(7, 8), osh: pick(12, 11),
    shM, hipM, up, fwd, lat, upP, fwdP, latP,
  };
}

type Def = { a: (c: Ctx) => V3; b: (c: Ctx) => V3; ref: (c: Ctx) => number; r: number };
const hum = (c: Ctx) => len(sub(c.el, c.sh));
const fore = (c: Ctx) => len(sub(c.wr, c.el));
const thigh = (c: Ctx) => len(sub(c.kn, c.hip));
const shin = (c: Ctx) => len(sub(c.an, c.kn));
const torso = (c: Ctx) => len(sub(c.shM, c.hipM));
const shw = (c: Ctx) => len(sub(c.osh, c.sh));
const dir = (a: V3, b: V3) => norm(sub(b, a));
const scapula = (c: Ctx) => sum(lerp(c.shM, c.sh, 0.45), mul(c.fwd, -0.07), mul(c.up, -0.09));
const spineAt = (c: Ctx, t: number) => sum(lerp(c.hipM, c.shM, t), mul(c.fwd, -0.08));

/**
 * Origine e inserzione di ogni gruppo (punti anatomici approssimati, presi dallo scheletro) e spessore del
 * ventre in metri. Serve solo di quanto cambia la distanza tra i due attacchi rispetto al corpo a riposo.
 */
const DEFS: Record<string, Def> = {
  bicipite: { a: (c) => add(c.sh, mul(c.up, 0.02)), b: (c) => add(c.el, mul(sub(c.wr, c.el), 0.14)), ref: hum, r: 0.022 },
  brachiale: { a: (c) => lerp(c.sh, c.el, 0.5), b: (c) => add(c.el, mul(sub(c.wr, c.el), 0.1)), ref: hum, r: 0.016 },
  brachioradiale: { a: (c) => lerp(c.sh, c.el, 0.72), b: (c) => c.wr, ref: (c) => hum(c) + fore(c), r: 0.014 },
  tricipite: { a: (c) => add(c.sh, mul(c.up, -0.03)), b: (c) => add(c.el, mul(dir(c.wr, c.el), 0.03)), ref: hum, r: 0.022 },
  flessori: { a: (c) => c.el, b: (c) => lerp(c.wr, c.ix, 0.6), ref: fore, r: 0.014 },
  estensori: { a: (c) => c.el, b: (c) => lerp(c.wr, c.ix, 0.6), ref: fore, r: 0.013 },
  mano: { a: (c) => c.wr, b: (c) => c.ix, ref: (c) => len(sub(c.ix, c.wr)) || 1, r: 0.006 },
  "deltoide-ant": { a: (c) => sum(lerp(c.shM, c.sh, 0.78), mul(c.fwd, 0.03)), b: (c) => lerp(c.sh, c.el, 0.42), ref: hum, r: 0.018 },
  "deltoide-med": { a: (c) => sum(c.sh, mul(c.up, 0.035), mul(c.lat, 0.02)), b: (c) => lerp(c.sh, c.el, 0.42), ref: hum, r: 0.02 },
  "deltoide-post": { a: (c) => sum(c.sh, mul(c.up, 0.02), mul(c.fwd, -0.06), mul(c.lat, -0.02)), b: (c) => lerp(c.sh, c.el, 0.42), ref: hum, r: 0.018 },
  pettorale: { a: (c) => sum(lerp(c.shM, c.hipM, 0.25), mul(c.fwd, 0.09)), b: (c) => sum(lerp(c.sh, c.el, 0.18), mul(c.fwd, 0.02)), ref: shw, r: 0.02 },
  dorsale: { a: (c) => spineAt(c, 0.25), b: (c) => lerp(c.sh, c.el, 0.15), ref: torso, r: 0.014 },
  "trapezio-sup": { a: (c) => sum(c.shM, mul(c.up, 0.12), mul(c.fwd, -0.05)), b: (c) => add(c.sh, mul(c.up, 0.02)), ref: shw, r: 0.014 },
  "trapezio-med": { a: (c) => sum(c.shM, mul(c.fwd, -0.07), mul(c.up, -0.04)), b: (c) => sum(c.sh, mul(c.fwd, -0.04), mul(c.up, 0.02)), ref: shw, r: 0.01 },
  "trapezio-inf": { a: (c) => spineAt(c, 0.45), b: (c) => sum(lerp(c.shM, c.sh, 0.45), mul(c.fwd, -0.07), mul(c.up, -0.03)), ref: torso, r: 0.01 },
  romboidi: { a: (c) => spineAt(c, 0.8), b: scapula, ref: shw, r: 0.01 },
  sottospinato: { a: (c) => sum(lerp(c.shM, c.sh, 0.55), mul(c.fwd, -0.08), mul(c.up, -0.09)), b: (c) => add(c.sh, mul(c.lat, 0.01)), ref: shw, r: 0.014 },
  dentato: { a: (c) => sum(lerp(c.hipM, c.shM, 0.7), mul(c.lat, 0.12), mul(c.fwd, 0.04)), b: scapula, ref: shw, r: 0.01 },
  scm: { a: (c) => add(c.ear, mul(c.up, -0.02)), b: (c) => sum(c.shM, mul(c.up, 0.01), mul(c.fwd, 0.05), mul(c.lat, 0.02)), ref: (c) => len(sub(c.ear, c.shM)), r: 0.011 },
  addome: { a: (c) => sum(c.hipM, mul(c.fwdP, 0.07), mul(c.upP, -0.03)), b: (c) => sum(lerp(c.hipM, c.shM, 0.72), mul(c.fwd, 0.1)), ref: torso, r: 0.012 },
  obliqui: { a: (c) => sum(c.hip, mul(c.upP, 0.1), mul(c.latP, 0.02)), b: (c) => sum(lerp(c.hip, c.sh, 0.62), mul(c.fwd, 0.06), mul(c.lat, 0.04)), ref: torso, r: 0.01 },
  erettori: { a: (c) => sum(c.hipM, mul(c.fwdP, -0.08), mul(c.upP, 0.08)), b: (c) => spineAt(c, 0.85), ref: torso, r: 0.02 },
  glutei: { a: (c) => sum(c.hip, mul(c.upP, 0.08), mul(c.fwdP, -0.09), mul(c.latP, -0.03)), b: (c) => sum(lerp(c.hip, c.kn, 0.12), mul(c.latP, 0.05)), ref: thigh, r: 0.03 },
  quadricipite: { a: (c) => sum(c.hip, mul(c.fwdP, 0.04), mul(c.upP, 0.04)), b: (c) => sum(c.kn, mul(sub(c.an, c.kn), 0.12), mul(c.fwdP, 0.03)), ref: thigh, r: 0.03 },
  femorali: { a: (c) => sum(c.hip, mul(c.fwdP, -0.06), mul(c.upP, -0.06)), b: (c) => sum(c.kn, mul(sub(c.an, c.kn), 0.1), mul(c.fwdP, -0.03)), ref: thigh, r: 0.026 },
  polpacci: { a: (c) => sum(c.kn, mul(sub(c.kn, c.an), 0.06), mul(c.fwdP, -0.02)), b: (c) => c.he, ref: shin, r: 0.026 },
  tibiale: { a: (c) => sum(c.kn, mul(sub(c.an, c.kn), 0.12), mul(c.lat, 0.015), mul(c.fwdP, 0.02)), b: (c) => lerp(c.he, c.to, 0.45), ref: shin, r: 0.012 },
};

export type FlexInfo = { groups: { side: "L" | "R" | "C"; def: Def; L0: number }[] };

/** lunghezze di riposo di ogni gruppo, dal corpo in posizione anatomica */
export function flexInfo(data: BodyData): FlexInfo {
  const rest = data.meta.rest;
  const P = (i: number) => rest[String(i)] as V3 | undefined;
  const groups = data.meta.groups.map((name) => {
    const [side, base] = name.includes(":") ? (name.split(":") as ["L" | "R", string]) : (["C", name] as const);
    const def = DEFS[base];
    const c = def ? ctxOf(P, side) : null;
    const L0 = def && c ? len(sub(def.b(c), def.a(c))) / Math.max(1e-4, def.ref(c)) : 0;
    return { side, def, L0 };
  });
  return { groups: groups.map((g) => ({ side: g.side, def: g.def as Def, L0: g.def ? g.L0 : 0 })) };
}

/**
 * Copia dei vertici della pelle con, per ogni vertice, il gruppo muscolare che le sta sotto (byte 12),
 * la posizione lungo quel muscolo (byte 13) e quanto la pelle lo segue (byte 14, 0 = per niente):
 * così anche il profilo del corpo si gonfia dove il muscolo si gonfia.
 */
export function skinWithMuscles(data: BodyData, skin: BodyBatch): Uint8Array {
  const out = new Uint8Array(data.buf.slice(skin.vOffset, skin.vOffset + skin.vertices * STRIDE));
  const rd = vertexReader(data);
  const CELL = 0.03;
  const cells = new Map<number, number[]>();
  const key = (x: number, y: number, z: number) => ((Math.floor(x / CELL) + 64) * 256 + (Math.floor(y / CELL) + 16)) * 128 + (Math.floor(z / CELL) + 64);
  const mp: number[] = [];
  const meta: number[] = [];
  const p = new Float32Array(3);
  for (const b of data.meta.batches) {
    if (b.layer !== "muscle") continue;
    for (let v = 0; v < b.vertices; v++) {
      const at = b.vOffset + v * STRIDE;
      const g = rd.u8[at + 12];
      if (!g) continue;
      // un vertice su due basta: la pelle cerca solo il muscolo più vicino
      if (v & 1) continue;
      rd.pos(at, p);
      const id = mp.length / 3;
      mp.push(p[0], p[1], p[2]);
      meta.push(g, rd.u8[at + 13], rd.u8[at + 15]);
      const k = key(p[0], p[1], p[2]);
      const list = cells.get(k);
      if (list) list.push(id);
      else cells.set(k, [id]);
    }
  }
  const dvOut = new DataView(out.buffer);
  const { lo, hi } = data.meta;
  for (let v = 0; v < skin.vertices; v++) {
    const at = v * STRIDE;
    const x = lo[0] + (dvOut.getUint16(at, true) * (hi[0] - lo[0])) / 65535;
    const y = lo[1] + (dvOut.getUint16(at + 2, true) * (hi[1] - lo[1])) / 65535;
    const z = lo[2] + (dvOut.getUint16(at + 4, true) * (hi[2] - lo[2])) / 65535;
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
    let best = -1;
    let bd = 1e9;
    for (let ix = -1; ix <= 1; ix++)
      for (let iy = -1; iy <= 1; iy++)
        for (let iz = -1; iz <= 1; iz++) {
          const list = cells.get(((cx + ix + 64) * 256 + (cy + iy + 16)) * 128 + (cz + iz + 64));
          if (!list) continue;
          for (const id of list) {
            const dx = mp[id * 3] - x, dy = mp[id * 3 + 1] - y, dz = mp[id * 3 + 2] - z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < bd) {
              bd = d;
              best = id;
            }
          }
        }
    if (best < 0) continue;
    const d = Math.sqrt(bd);
    // la pelle segue il muscolo che ha appena sotto (entro 2-3 cm), non quelli più profondi
    const follow = Math.max(0, Math.min(1, 1 - (d - 0.006) / 0.022));
    if (follow <= 0 || meta[best * 3 + 2] > 160) continue;
    out[at + 12] = meta[best * 3];
    out[at + 13] = meta[best * 3 + 1];
    out[at + 14] = Math.round(follow * 255);
  }
  return out;
}

/**
 * Spinta di ogni gruppo muscolare (in metri, positiva = si gonfia) per la posa J: si accorcia tra i suoi
 * attacchi → più spesso (volume costante), si allunga → più sottile; se lavora un poco più gonfio.
 * act: quanto lavora ogni gruppo (0..1, per indice di gruppo).
 */
/** massa in più nel ventre di ogni muscolo, in frazioni del suo spessore */
const MASS = 0.3;

export function flexValues(info: FlexInfo, J: Record<number, V3>, act: Float32Array, out: Float32Array) {
  out.fill(0);
  const P = (i: number) => J[i];
  const ctx: Partial<Record<"L" | "R" | "C", Ctx | null>> = {};
  for (let g = 1; g < info.groups.length && g < out.length; g++) {
    const { side, def, L0 } = info.groups[g];
    if (!def || !L0) continue;
    if (!(side in ctx)) ctx[side] = ctxOf(P, side);
    const c = ctx[side];
    if (!c) continue;
    const L = len(sub(def.b(c), def.a(c))) / Math.max(1e-4, def.ref(c));
    const squash = Math.max(0.65, Math.min(1.6, L0 / Math.max(1e-4, L)));
    // raggio a volume costante, un po' esagerato perché si legga come nelle animazioni anatomiche
    const k = Math.sqrt(squash);
    const a = Math.max(0, Math.min(1, act[g] ?? 0));
    // allungato si assottiglia di poco (i muscoli piatti come pettorale e dorsale sono sottili: oltre
    // si rovescerebbero), accorciato si gonfia di più
    const d = k >= 1 ? (k - 1) * def.r * 1.9 : (k - 1) * def.r * 0.85;
    // più massa nel ventre di ogni muscolo (come il corpo atletico delle animazioni anatomiche); la pelle che
    // gli sta sopra lo segue con la stessa spinta
    out[g] = Math.max(-0.18 * def.r, Math.min(0.7 * def.r, d + a * 0.12 * def.r)) + MASS * def.r;
  }
}
