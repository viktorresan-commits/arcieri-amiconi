/**
 * Anatomia della figura di fronte: braccia e gambe come sagome piene che seguono i muscoli
 * (deltoide, bicipite, gomito, avambraccio, polso; coscia, ginocchio, polpaccio, caviglia),
 * al posto dei tubi dritti. Ogni arto è un asse con due larghezze per punto, esterna e interna,
 * unite da una curva morbida.
 */

export type P = { x: number; y: number };

function f(n: number) {
  return n.toFixed(1);
}

export function lerpP(a: P, b: P, t: number): P {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** curva morbida che passa per tutti i punti (Catmull-Rom); senza M iniziale se `cont` */
export function curveThrough(pts: P[], cont = false) {
  let d = cont ? "" : `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

/** i due bordi di un arto: `wl` a sinistra di chi guarda l'asse che scende, `wr` a destra */
export function limbSides(axis: P[], wl: number[], wr: number[]) {
  const L: P[] = [];
  const R: P[] = [];
  axis.forEach((p, i) => {
    const a = axis[Math.max(0, i - 1)];
    const b = axis[Math.min(axis.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    L.push({ x: p.x + nx * wl[i], y: p.y + ny * wl[i] });
    R.push({ x: p.x - nx * wr[i], y: p.y - ny * wr[i] });
  });
  return { L, R };
}

/**
 * Sagoma chiusa dell'arto. `top` = quanto sporge la cupola in alto (spalla), `bottom` = la curva in fondo
 * (orlo, polso, caviglia). Restituisce anche i due bordi da soli, per i contorni.
 */
export function limb(axis: P[], wl: number[], wr: number[], top = 0.6, bottom = 0.4) {
  const { L, R } = limbSides(axis, wl, wr);
  const n = axis.length - 1;
  const dirAt = (i: number, j: number) => {
    const len = Math.hypot(axis[j].x - axis[i].x, axis[j].y - axis[i].y) || 1;
    return { x: (axis[j].x - axis[i].x) / len, y: (axis[j].y - axis[i].y) / len };
  };
  const dEnd = dirAt(n - 1, n);
  const dTop = dirAt(0, 1);
  const wEnd = (wl[n] + wr[n]) / 2;
  const wTop = (wl[0] + wr[0]) / 2;
  const endCap = `C${f(L[n].x + dEnd.x * wEnd * bottom * 1.3)} ${f(L[n].y + dEnd.y * wEnd * bottom * 1.3)} ${f(R[n].x + dEnd.x * wEnd * bottom * 1.3)} ${f(R[n].y + dEnd.y * wEnd * bottom * 1.3)} ${f(R[n].x)} ${f(R[n].y)}`;
  const topCap = `C${f(R[0].x - dTop.x * wTop * top * 1.3)} ${f(R[0].y - dTop.y * wTop * top * 1.3)} ${f(L[0].x - dTop.x * wTop * top * 1.3)} ${f(L[0].y - dTop.y * wTop * top * 1.3)} ${f(L[0].x)} ${f(L[0].y)}`;
  const left = curveThrough(L);
  const right = curveThrough([...R].reverse());
  const d = `${left} ${endCap}${curveThrough([...R].reverse(), true)} ${topCap} Z`;
  return { d, left, right, L, R };
}

/**
 * Braccio attaccato alla spalla: la cupola del deltoide parte da `peak`, sulla linea del trapezio,
 * e scende arrotondata sul lato esterno; il lato interno resta senza contorno sopra l'ascella
 * (lì il braccio si fonde col petto). `stroke` = il solo contorno da tracciare.
 */
export function armLimb(axis: P[], wl: number[], wr: number[], side: -1 | 1, peak: P, bottom = 0.3) {
  const { L, R } = limbSides(axis, wl, wr);
  const outer = side < 0 ? L : R;
  const inner = side < 0 ? R : L;
  const n = axis.length - 1;
  const o0 = outer[1];
  const i0 = inner[0];
  // la spalla continua la pendenza del trapezio e si arrotonda sul deltoide fino al suo punto più largo
  const dx = o0.x - peak.x;
  const dy = o0.y - peak.y;
  // quarto d'ellisse che parte già in discesa: la spalla è tonda, non un angolo
  const shoulder = `M${f(peak.x)} ${f(peak.y)} C${f(peak.x + dx * 0.5)} ${f(peak.y + dy * 0.16)} ${f(o0.x + dx * 0.02)} ${f(o0.y - dy * 0.55)} ${f(o0.x)} ${f(o0.y)}`;
  const len = Math.hypot(axis[n].x - axis[n - 1].x, axis[n].y - axis[n - 1].y) || 1;
  const d = { x: (axis[n].x - axis[n - 1].x) / len, y: (axis[n].y - axis[n - 1].y) / len };
  const w = ((wl[n] + wr[n]) / 2) * bottom * 1.3;
  const cap = `C${f(outer[n].x + d.x * w)} ${f(outer[n].y + d.y * w)} ${f(inner[n].x + d.x * w)} ${f(inner[n].y + d.y * w)} ${f(inner[n].x)} ${f(inner[n].y)}`;
  const down = curveThrough(outer.slice(1), true);
  const upAll = curveThrough([...inner].reverse(), true);
  const upToPit = curveThrough([...inner].reverse().slice(0, n - 1), true);
  const back = `C${f(i0.x)} ${f(i0.y - (i0.y - peak.y) * 0.5)} ${f(peak.x + (i0.x - peak.x) * 0.5)} ${f(peak.y)} ${f(peak.x)} ${f(peak.y)}`;
  return {
    d: `${shoulder}${down} ${cap}${upAll} ${back} Z`,
    stroke: `${shoulder}${down} ${cap}${upToPit}`,
    L,
    R,
    outer,
    inner,
  };
}

/** punti lungo un tratto a, b alle frazioni date */
export function along(a: P, b: P, ts: number[]) {
  return ts.map((t) => lerpP(a, b, t));
}

/* ---------------- braccia ---------------- */

// frazioni del braccio (spalla → gomito) e dell'avambraccio (gomito → polso)
export const UPPER_T = [0, 0.16, 0.38, 0.6, 0.82, 1];
export const FORE_T = [0.14, 0.32, 0.56, 0.8, 1];

/**
 * Mezze larghezze del braccio nudo, lato esterno e lato interno, per ogni punto (prima il braccio, poi l'avambraccio):
 * cupola del deltoide, il suo attacco, il bicipite, il gomito stretto, il brachioradiale gonfio sotto il gomito, il polso sottile.
 */
export function armWidths(woman: boolean, k: number) {
  const o = woman ? [8.3, 8.7, 7.5, 6.9, 6.1, 5.6, 6.3, 6.3, 5.3, 4.4, 3.9] : [10, 10.8, 9.2, 8.2, 7.2, 6.4, 7.4, 7.5, 6.3, 5, 4.4];
  const i = woman ? [6.4, 6.8, 7, 7, 6, 5.3, 5.8, 5.8, 5, 4.2, 3.8] : [7, 7.6, 8.1, 8.3, 7, 6, 6.7, 6.7, 5.7, 4.7, 4.2];
  // braccia piene, da arciere allenato (lui un poco più muscoloso)
  const m = k * (woman ? 1.04 : 1.12);
  return { o: o.map((v) => v * m), i: i.map((v) => v * m) };
}

/** asse del braccio: spalla, gomito, polso */
export function armAxis(s0: P, elbow: P, wrist: P) {
  return [...along(s0, elbow, UPPER_T), ...along(elbow, wrist, FORE_T)];
}

/* ---------------- gambe ---------------- */

// quote lungo la gamba, dall'inguine alla caviglia
export const LEG_Y = [206, 224, 244, 260, 270, 282, 294, 310, 324, 334];

/**
 * Mezze larghezze della gamba nuda (o in calzamaglia): coscia piena, ginocchio, polpaccio (più alto fuori,
 * più basso e pieno dentro), caviglia sottile con i malleoli.
 */
export function legWidths(woman: boolean, k: number) {
  const o = woman ? [13.8, 13, 11.4, 9, 7.8, 8.6, 8.6, 6.8, 4.9, 5.1] : [13.2, 12.8, 11.6, 9.6, 8.2, 9.6, 9.4, 7.2, 5.2, 5.4];
  const i = woman ? [12.6, 11.2, 9.6, 7.8, 7.3, 7.6, 8.6, 6.6, 4.7, 5.1] : [12, 11, 9.8, 8.2, 7.6, 8, 9.4, 7, 5, 5.4];
  return { o: o.map((v) => v * k), i: i.map((v) => v * k) };
}

/** pantaloni: sulla coscia seguono la gamba, dal ginocchio in giù la stoffa scende dritta (non segue il polpaccio); larghi = più ampi in fondo */
export function pantWidths(woman: boolean, k: number, wide: boolean) {
  const base = legWidths(woman, k);
  const fallO = wide ? [14.6, 14, 13.4, 13, 12.8, 12.8, 12.8, 12.8, 13, 13.2] : [13.6, 13, 11.8, 10.4, 9.8, 9.7, 9.6, 9.5, 9.5, 9.7];
  const fallI = wide ? [12.8, 12.2, 11.8, 11.4, 11.2, 11.2, 11.2, 11.2, 11.4, 11.6] : [12.4, 11.4, 10.4, 9.2, 8.8, 8.7, 8.7, 8.6, 8.6, 8.8];
  const o = base.o.map((v, n) => (n <= 3 ? Math.max(v + 0.8, fallO[n] * k) : fallO[n] * k));
  const i = base.i.map((v, n) => (n <= 3 ? Math.max(v + 0.8, fallI[n] * k) : fallI[n] * k));
  return { o, i };
}
