/**
 * Disegno WebGL del modello anatomico (pelle di vetro, ossa, muscoli con fibre e tendini).
 * Usato dalla vista 3D dell'analisi e dalle immagini dei muscoli per le zone del corpo.
 */
import { v3, type GearMesh, type Model, type Part, type V3 } from "./anatomy-model";
import { bodyMatrices, groupValues, type BodyBatch, type BodyData, type BodyLevel, type BodyMeta } from "./anatomy-body";
import { flexInfo, flexValues, skinWithMuscles, type FlexInfo } from "./anatomy-flex";
import { sides } from "./pose-analysis";

export type Layers = { pelle: boolean; muscolo: boolean; osso: boolean };

const VS = `
attribute vec3 aP; attribute vec3 aN;
uniform mat4 uVP; uniform mat4 uM; uniform mat3 uNM;
varying vec3 vW; varying vec3 vN; varying vec3 vO;
void main(){ vec4 w = uM * vec4(aP, 1.0); vW = w.xyz; vN = normalize(uNM * aN); vO = aP; gl_Position = uVP * w; }`;
const PREC = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
const FS = `${PREC}
varying vec3 vW; varying vec3 vN; varying vec3 vO;
uniform vec3 uEye; uniform vec3 uColor; uniform float uMode; uniform float uAlpha; uniform float uAct; uniform float uTime;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uEye - vW);
  float ndv = abs(dot(N, V));
  float rim = pow(1.0 - ndv, 2.2);
  // luce principale, luce di riempimento e ambiente dal cielo: volumi come in studio
  vec3 L = normalize(vec3(0.4, 0.9, 0.6));
  vec3 L2 = normalize(vec3(-0.7, 0.2, -0.4));
  float dif = max(dot(N, L), 0.0) * 0.78 + max(dot(N, L2), 0.0) * 0.22;
  float hemi = 0.5 + 0.5 * N.y;
  vec3 col; float a;
  if (uMode < 0.5) {
    // pelle: vetro con il bordo che si accende, linee di scansione leggere
    float scan = 0.88 + 0.12 * sin(vW.y * 140.0);
    col = uColor * (0.28 + rim * 2.1) * scan;
    a = uAlpha * (0.15 + rim * 1.1);
  } else if (uMode < 1.5) {
    // osso: avorio freddo, luce morbida e bordo azzurro
    col = uColor * (0.28 + 0.1 * hemi + dif * 0.55) + vec3(0.45, 0.75, 1.0) * rim * 0.5;
    a = uAlpha;
  } else if (uMode < 2.5) {
    // muscolo: fibre lungo il muscolo, tendini chiari alle estremità, lucido come nelle tavole
    float ang = atan(vO.z, vO.x);
    float fib = 0.84 + 0.1 * sin(ang * 26.0 + vO.y * 2.0) + 0.06 * sin(ang * 61.0);
    float tend = smoothstep(0.68, 0.96, abs(vO.y));
    vec3 base = mix(uColor, vec3(0.94, 0.9, 0.82), tend * 0.85);
    vec3 R = reflect(-L, N);
    float spec = pow(max(dot(R, V), 0.0), 22.0) * 0.28;
    // bordo del muscolo più scuro: separa un muscolo dall'altro come nelle tavole anatomiche
    float edge = mix(1.0, 0.55, pow(1.0 - ndv, 2.6));
    float striae = 0.92 + 0.08 * sin(vO.y * 38.0 + ang * 3.0);
    col = base * (0.22 + 0.12 * hemi + dif * 0.66) * mix(fib * striae, 1.0, tend) * edge + uColor * uAct * 0.28 * (1.0 - tend) + vec3(1.0, 0.88, 0.76) * spec;
    a = uAlpha;
  } else {
    col = uColor * (0.4 + dif * 0.6) + rim * 0.15;
    a = uAlpha;
  }
  gl_FragColor = vec4(col, a);
}`;

/* corpo anatomico vero: ogni vertice segue due segmenti (deformazione sulla scheda grafica) */
const BVS = `
attribute vec3 aP; attribute vec3 aN; attribute vec2 aJ; attribute vec4 aM; attribute float aT;
uniform mat4 uVP; uniform vec4 uSeg[63]; uniform vec3 uLo; uniform vec3 uHi;
uniform vec4 uAct[16]; uniform vec4 uBul[16]; uniform float uLayerV;
uniform vec4 uCurl[8]; uniform vec2 uDita;
varying vec3 vW; varying vec3 vN; varying vec2 vF; varying float vAct; varying float vFoc; varying float vTend; varying float vStr;
float pick(vec4 v, int k){ return k == 0 ? v.x : k == 1 ? v.y : k == 2 ? v.z : v.w; }
vec3 rotA(vec3 v, vec3 ax, float a){ float c = cos(a); float s = sin(a); return v * c + cross(ax, v) * s + ax * dot(ax, v) * (1.0 - c); }
// dita piegate in presa (prima di seguire i segmenti): terza falange, seconda, allargamento dell'indice, nocca
void curl(int h, inout vec3 p, inout vec3 n){
  vec4 c0 = uCurl[h * 4]; vec4 c1 = uCurl[h * 4 + 1]; vec4 c2 = uCurl[h * 4 + 2]; vec4 c3 = uCurl[h * 4 + 3];
  if (c1.w == 0.0 && c2.w == 0.0) return;
  vec3 K = c0.xyz; float L = c0.w; vec3 F = c1.xyz; vec3 S = c2.xyz; vec3 X = c3.xyz;
  vec3 d = p - K; float t = dot(d, F) / L; float u = dot(d, X);
  float little = smoothstep(-0.012, -0.022, u);
  float index = smoothstep(0.012, 0.02, u);
  float a2 = c2.w * (1.0 + 0.3 * little); float a3 = c2.w * 0.55 * (1.0 + 0.3 * little);
  vec3 J2 = K + F * (L * 0.47); vec3 J3 = K + F * (L * 0.76);
  float s1 = smoothstep(-0.05, 0.08, t); float s2 = smoothstep(0.40, 0.54, t); float s3 = smoothstep(0.70, 0.82, t);
  p = J3 + rotA(p - J3, S, a3 * s3); n = rotA(n, S, a3 * s3);
  p = J2 + rotA(p - J2, S, a2 * s2); n = rotA(n, S, a2 * s2);
  vec3 Pn = cross(S, F); float sp = c3.w * index * s1;
  p = K + rotA(p - K, Pn, sp); n = rotA(n, Pn, sp);
  p = K + rotA(p - K, S, c1.w * s1 * (1.0 + 0.25 * little)); n = rotA(n, S, c1.w * s1 * (1.0 + 0.25 * little));
}
void main(){
  int g = int(aM.y + 0.5); int gi = g / 4; int gk = g - gi * 4;
  // il ventre del muscolo si gonfia quando si accorcia e si assottiglia quando si allunga (tendini fermi);
  // la pelle sopra lo segue quanto gli è vicina
  float tt = aM.z / 255.0;
  float belly = pow(max(sin(3.14159 * tt), 0.0), 0.75);
  float follow = uLayerV < 0.5 ? aM.w / 255.0 : (uLayerV > 1.5 ? 1.0 - aT : 0.0);
  vec3 p = uLo + aP * (uHi - uLo) + aN * (pick(uBul[gi], gk) * belly * follow);
  vec3 n0 = aN;
  if (abs(aJ.x - uDita.x) < 0.5 || abs(aJ.y - uDita.x) < 0.5) curl(0, p, n0);
  else if (abs(aJ.x - uDita.y) < 0.5 || abs(aJ.y - uDita.y) < 0.5) curl(1, p, n0);
  float w = aM.x / 255.0;
  // segmenti come tre righe (meno uniformi: ci sta anche la piega delle dita sui telefoni più semplici)
  int ia = int(aJ.x + 0.5) * 3; int ib = int(aJ.y + 0.5) * 3;
  vec4 A0 = uSeg[ia]; vec4 A1 = uSeg[ia + 1]; vec4 A2 = uSeg[ia + 2];
  vec4 B0 = uSeg[ib]; vec4 B1 = uSeg[ib + 1]; vec4 B2 = uSeg[ib + 2];
  vec4 R0 = A0 * w + B0 * (1.0 - w); vec4 R1 = A1 * w + B1 * (1.0 - w); vec4 R2 = A2 * w + B2 * (1.0 - w);
  vec4 hp = vec4(p, 1.0);
  vec4 wp = vec4(dot(R0, hp), dot(R1, hp), dot(R2, hp), 1.0);
  // quanto è stirata la superficie qui: i due segmenti la tirano in punti lontani
  float gap = length(vec3(dot(A0 - B0, hp), dot(A1 - B1, hp), dot(A2 - B2, hp))) * 4.0 * w * (1.0 - w);
  vStr = smoothstep(0.02, 0.09, gap);
  vN = normalize(vec3(dot(R0.xyz, n0), dot(R1.xyz, n0), dot(R2.xyz, n0)));
  // lavoro e messa in evidenza nello stesso numero (meno uniformi: alcuni telefoni ne hanno poche)
  float pv = pick(uAct[gi], gk); float fc = floor(pv / 2.0) - 1.0;
  vAct = pv - (fc + 1.0) * 2.0; vFoc = fc;
  vF = vec2(aM.z, aM.w) / 255.0; vTend = aT;
  vW = wp.xyz; gl_Position = uVP * wp;
}`;
const BFS = `${PREC}
varying vec3 vW; varying vec3 vN; varying vec2 vF; varying float vAct; varying float vFoc; varying float vTend; varying float vStr;
uniform vec3 uEye; uniform float uLayer; uniform float uAlpha; uniform float uDim; uniform float uTime;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uEye - vW);
  // si disegnano solo le facce verso chi guarda: ai bordi la normale può sfiorare il lato opposto
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float rim = pow(1.0 - ndv, 2.0);
  vec3 L = normalize(vec3(0.35, 0.8, 0.55)); vec3 L2 = normalize(vec3(-0.6, 0.25, 0.3));
  float dif = max(dot(N, L), 0.0) * 0.75 + max(dot(N, L2), 0.0) * 0.3;
  float hemi = 0.55 + 0.45 * N.y;
  vec3 R = reflect(-L, N);
  vec3 col; float a = uAlpha;
  if (uLayer < 0.5) {
    // pelle: vetro azzurro, il bordo si accende come nelle tavole mediche
    col = vec3(0.4, 0.72, 1.0) * (0.36 + rim * 1.5) + vec3(0.85, 0.95, 1.0) * pow(rim, 3.0) * 0.6;
    // vetro sottile: i muscoli sotto si leggono bene anche su gambe e busto
    a = uAlpha * (0.08 + rim * 0.55) * (1.0 - 0.85 * vStr);
  } else if (uLayer < 1.5) {
    // ossa: bianco azzurro, morbide
    // con i muscoli accesi le ossa tra un muscolo e l'altro restano azzurrine, non bianche
    vec3 boneCol = mix(vec3(0.88, 0.93, 0.98), vec3(0.6, 0.72, 0.86), uDim);
    // iride degli occhi (segnata nel canale dei tendini)
    if (vTend > 0.5) boneCol = vec3(0.24, 0.36, 0.48);
    col = boneCol * (0.32 + 0.12 * hemi + dif * 0.55) + vec3(0.55, 0.8, 1.0) * rim * 0.35;
  } else {
    // muscoli: rosso bruno con le fibre lungo il muscolo, tendini chiari, lucidi.
    // Le fibre sono fasci (circa 4-5 mm, il passo è già in millimetri veri nel modello) separati da solchi,
    // ognuno con il suo tono e il suo spessore; dentro ogni fascio le fibrille fini, visibili solo da vicino.
    // Tutto si attenua dove sullo schermo sarebbe più fitto di un paio di pixel (niente puntinato).
    float fy = vF.y * 34.0 + 0.18 * sin(vF.x * 9.0) + 0.22 * sin(vF.x * 2.7 + vF.y * 4.1);
    float id = floor(fy);
    float h = fract(id * 0.618034 + 0.27);
    float h2 = fract(h * h * 7.13 + h * 3.71);
#ifdef HAS_DERIV
    float fw = fwidth(fy);
    float amp = 1.0 - smoothstep(0.16, 0.45, fw);
    float ampF = 1.0 - smoothstep(0.03, 0.09, fw);
#else
    float fw = 0.08;
    float amp = 0.5;
    float ampF = 0.0;
#endif
    float fr = fract(fy);
    // il solco non sta sempre a metà: fasci un po' più larghi o più stretti
    float dl = min(fr, 1.0 - fr) * (0.8 + 0.4 * h2);
    // lungo il muscolo ogni fascio cambia piano tono e i solchi a tratti si chiudono (fasci che si uniscono):
    // niente righe tutte uguali da un capo all'altro
    float x5 = vF.x * 5.0 + h * 7.0;
    float fx = floor(x5); float tx = fract(x5); tx = tx * tx * (3.0 - 2.0 * tx);
    float n = mix(fract(sin(id * 12.9898 + fx * 78.233) * 43758.5453), fract(sin(id * 12.9898 + (fx + 1.0) * 78.233) * 43758.5453), tx);
    float groove = (1.0 - smoothstep(0.02, 0.09 + fw * 1.2, dl)) * (0.4 + 0.6 * n) * (0.7 + 0.3 * h);
    // ventre del fascio un po' in rilievo (luce sopra, ombra nel solco)
    float crown = sin(fr * 3.14159);
    float fibril = 0.5 + 0.5 * cos(fy * 6.2832 * 6.0 + h * 6.0);
    float tone = (n - 0.5) * 0.16 + (h2 - 0.5) * 0.08;
    float fib = 1.0 - amp * (0.3 * groove - 0.06 * crown) - amp * tone - ampF * 0.06 * fibril;
    vec3 rest = vec3(0.74, 0.35, 0.31);
    vec3 work = vec3(1.0, 0.36, 0.2);
    float act = clamp(vAct, 0.0, 1.0);
    float on = smoothstep(0.32, 0.8, act);
    vec3 base = mix(rest, work, on);
    if (vFoc > 0.5) { base = work; on = 1.0; }
    else if (vFoc < -0.5) { base = mix(rest, vec3(0.5, 0.42, 0.42), 0.35); on = 0.0; }
    base = mix(base, vec3(0.93, 0.9, 0.86), vTend * 0.85);
    float spec = pow(max(dot(R, V), 0.0), 40.0) * (0.1 + 0.18 * on);
    // lucido lungo le fibre (come la seta): la riga di luce corre di traverso al fascio
    float silk = 0.0;
#ifdef HAS_DERIV
    // scalati: sui telefoni con poca precisione numeri così piccoli diventerebbero zero
    vec3 dp1 = dFdx(vW) * 1000.0; vec3 dp2 = dFdy(vW) * 1000.0;
    vec3 T = cross(dp2, N) * (dFdx(vF.x) * 100.0) + cross(N, dp1) * (dFdy(vF.x) * 100.0);
    float tl = length(T);
    if (tl > 1e-4) {
      T /= tl;
      float th = dot(T, normalize(L + V));
      silk = pow(sqrt(max(0.0, 1.0 - th * th)), 24.0) * 0.14 * amp * (1.0 - groove) * (0.6 + 0.4 * crown);
    }
#endif
    float edge = mix(1.0, 0.62, pow(1.0 - ndv, 2.4));
    // il muscolo che lavora si accende dall'interno (arancio che va verso il giallo al centro del ventre)
    // e pulsa piano, come nelle animazioni anatomiche
    float pulse = 0.82 + 0.18 * sin(uTime * 4.4);
    vec3 glow = mix(vec3(1.0, 0.42, 0.16), vec3(1.0, 0.78, 0.32), pow(ndv, 3.0) * on);
    col = base * (0.3 + 0.16 * hemi + dif * 0.72) * mix(fib, 1.0, vTend) * edge
        + glow * on * (0.3 + 0.55 * rim) * (1.0 - vTend) * pulse
        + vec3(1.0, 0.92, 0.85) * spec
        + vec3(1.0, 0.86, 0.8) * silk * (1.0 - vTend);
  }
  gl_FragColor = vec4(col, a);
}`;

function sphereMesh(lat = 16, lon = 24) {
  const p: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= lat; i++) {
    const th = (i / lat) * Math.PI;
    for (let j = 0; j <= lon; j++) {
      const ph = (j / lon) * Math.PI * 2;
      p.push(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
    }
  }
  for (let i = 0; i < lat; i++)
    for (let j = 0; j < lon; j++) {
      const a = i * (lon + 1) + j;
      const b = a + lon + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  return { pos: new Float32Array(p), nor: new Float32Array(p), idx: new Uint16Array(idx) };
}

/** fuso del muscolo: largo al centro, sottile ai tendini (superficie di rotazione lungo y) */
function spindleMesh(rings = 18, lon = 16) {
  const p: number[] = [];
  const n: number[] = [];
  const idx: number[] = [];
  const r = (y: number) => Math.pow(Math.max(0, 1 - y * y), 0.62) * (1 - 0.12 * y); // un po' più pieno verso l'origine
  for (let i = 0; i <= rings; i++) {
    const y = -1 + (2 * i) / rings;
    const rr = r(y);
    const d = (r(Math.min(1, y + 0.01)) - r(Math.max(-1, y - 0.01))) / 0.02;
    for (let j = 0; j <= lon; j++) {
      const a = (j / lon) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      p.push(rr * c, y, rr * sn);
      const nl = Math.hypot(1, d) || 1;
      n.push(c / nl, -d / nl, sn / nl);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < lon; j++) {
      const a = i * (lon + 1) + j;
      const b = a + lon + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  return { pos: new Float32Array(p), nor: new Float32Array(n), idx: new Uint16Array(idx) };
}

/** tubo (cilindro aperto lungo y da -1 a 1): arco, corda e freccia senza "perline" */
function tubeMesh(lon = 14) {
  const p: number[] = [];
  const n: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= 1; i++)
    for (let j = 0; j <= lon; j++) {
      const a = (j / lon) * Math.PI * 2;
      p.push(Math.cos(a), i * 2 - 1, Math.sin(a));
      n.push(Math.cos(a), 0, Math.sin(a));
    }
  for (let j = 0; j < lon; j++) {
    const a = j;
    const b = j + lon + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return { pos: new Float32Array(p), nor: new Float32Array(n), idx: new Uint16Array(idx) };
}

function torusMesh(R = 1, r = 0.07, seg = 32, tube = 6) {
  const p: number[] = [];
  const n: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const u = (i / seg) * Math.PI * 2; // anello
    for (let j = 0; j <= tube; j++) {
      const v = (j / tube) * Math.PI * 2;
      const cx_ = Math.cos(u), sz = Math.sin(u);
      p.push((R + r * Math.cos(v)) * cx_, r * Math.sin(v), (R + r * Math.cos(v)) * sz);
      n.push(Math.cos(v) * cx_, Math.sin(v), Math.cos(v) * sz);
    }
  }
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < tube; j++) {
      const a = i * (tube + 1) + j;
      const b = a + tube + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  return { pos: new Float32Array(p), nor: new Float32Array(n), idx: new Uint16Array(idx) };
}

export function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
export function lookAt(eye: V3, at: V3) {
  const z = v3.norm(v3.sub(eye, at));
  const x = v3.norm(v3.cross([0, 1, 0], z));
  const y = v3.cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -v3.dot(x, eye), -v3.dot(y, eye), -v3.dot(z, eye), 1]);
}
export function mul4(a: Float32Array, b: Float32Array) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}


/** attacchi e spessori dei muscoli: si calcolano una volta per corpo */
const flexCache = new WeakMap<ArrayBuffer, FlexInfo>();
function flexOf(data: BodyData) {
  let f = flexCache.get(data.buf);
  if (!f) {
    f = flexInfo(data);
    flexCache.set(data.buf, f);
  }
  return f;
}

/**
 * Arco lungo e freccia di legno (dal pacchetto CC0 «Pyramid bow and natural fletch arrows» di signguy):
 * un file solo, letto una volta e condiviso da tutte le viste. Posizioni quantizzate, normali int8, indici uint16.
 */
type GearGeo = { name: GearMesh; pos: Float32Array; nor: Float32Array; idx: Uint16Array };
let gearPromise: Promise<GearGeo[] | null> | null = null;
function loadGear() {
  gearPromise ??= fetch("/models/arco-legno.bin")
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((buf) => {
      if (!buf) return null;
      const dv = new DataView(buf);
      const hl = dv.getUint32(0, true);
      const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))) as { meshes: { name: GearMesh; count: number; indices: number; lo: number[]; hi: number[] }[] };
      let off = 4 + hl;
      const pad = () => {
        off += (4 - (off % 4)) % 4;
      };
      return head.meshes.map((m) => {
        const q = new Uint16Array(buf, off, m.count * 3);
        off += m.count * 6;
        pad();
        const nq = new Int8Array(buf, off, m.count * 4);
        off += m.count * 4;
        const idx = new Uint16Array(buf.slice(off, off + m.indices * 2));
        off += m.indices * 2;
        pad();
        const pos = new Float32Array(m.count * 3);
        const nor = new Float32Array(m.count * 3);
        for (let i = 0; i < m.count; i++) {
          for (let c = 0; c < 3; c++) {
            pos[i * 3 + c] = m.lo[c] + (q[i * 3 + c] / 65535) * (m.hi[c] - m.lo[c]);
            nor[i * 3 + c] = nq[i * 4 + c] / 127;
          }
        }
        return { name: m.name, pos, nor, idx };
      });
    })
    .catch(() => {
      gearPromise = null;
      return null;
    });
  return gearPromise;
}

export function createAnatomyRenderer(canvas: HTMLCanvasElement, keep = false) {
  const gl = canvas.getContext("webgl", { antialias: true, premultipliedAlpha: false, alpha: true, preserveDrawingBuffer: keep });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const loc = {
    aP: gl.getAttribLocation(prog, "aP"),
    aN: gl.getAttribLocation(prog, "aN"),
    uVP: gl.getUniformLocation(prog, "uVP"),
    uM: gl.getUniformLocation(prog, "uM"),
    uNM: gl.getUniformLocation(prog, "uNM"),
    uEye: gl.getUniformLocation(prog, "uEye"),
    uColor: gl.getUniformLocation(prog, "uColor"),
    uMode: gl.getUniformLocation(prog, "uMode"),
    uAlpha: gl.getUniformLocation(prog, "uAlpha"),
    uAct: gl.getUniformLocation(prog, "uAct"),
    uTime: gl.getUniformLocation(prog, "uTime"),
  };
  const upload = (mesh: { pos: Float32Array; nor: Float32Array; idx: Uint16Array }) => {
    const p = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, p);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.STATIC_DRAW);
    const n = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, n);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.nor, gl.STATIC_DRAW);
    const i = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, i);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
    return { p, n, i, count: mesh.idx.length };
  };
  const meshes: Partial<Record<Part["mesh"], ReturnType<typeof upload>>> = { sphere: upload(sphereMesh()), torus: upload(torusMesh()), spindle: upload(spindleMesh()), tube: upload(tubeMesh()) };
  // arco lungo e freccia di legno veri: finché il file non arriva restano quelli a tubi
  let gearReady = false;
  let disposed = false;
  void loadGear()
    .then((list) => {
      if (disposed || !list) return;
      for (const g of list) meshes[g.name] = upload(g);
      gearReady = true;
    })
    .catch(() => {});
  // ---- corpo anatomico vero ----
  const bprog = gl.createProgram()!;
  gl.attachShader(bprog, sh(gl.VERTEX_SHADER, BVS));
  const deriv = gl.getExtension("OES_standard_derivatives");
  gl.attachShader(bprog, sh(gl.FRAGMENT_SHADER, deriv ? "#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n" + BFS : BFS));
  gl.linkProgram(bprog);
  const bodyOk = Boolean(gl.getProgramParameter(bprog, gl.LINK_STATUS));
  const bl = {
    aP: gl.getAttribLocation(bprog, "aP"),
    aN: gl.getAttribLocation(bprog, "aN"),
    aJ: gl.getAttribLocation(bprog, "aJ"),
    aM: gl.getAttribLocation(bprog, "aM"),
    aT: gl.getAttribLocation(bprog, "aT"),
    uVP: gl.getUniformLocation(bprog, "uVP"),
    uSeg: gl.getUniformLocation(bprog, "uSeg"),
    uLo: gl.getUniformLocation(bprog, "uLo"),
    uHi: gl.getUniformLocation(bprog, "uHi"),
    uAct: gl.getUniformLocation(bprog, "uAct"),
    uEye: gl.getUniformLocation(bprog, "uEye"),
    uLayer: gl.getUniformLocation(bprog, "uLayer"),
    uAlpha: gl.getUniformLocation(bprog, "uAlpha"),
    uDim: gl.getUniformLocation(bprog, "uDim"),
    uBul: gl.getUniformLocation(bprog, "uBul"),
    uLayerV: gl.getUniformLocation(bprog, "uLayerV"),
    uTime: gl.getUniformLocation(bprog, "uTime"),
    uCurl: gl.getUniformLocation(bprog, "uCurl"),
    uDita: gl.getUniformLocation(bprog, "uDita"),
  };
  type GpuBody = { meta: BodyMeta; flex: FlexInfo; batches: { layer: BodyBatch["layer"]; vb: WebGLBuffer; ib: WebGLBuffer; count: number }[] };
  const bodies: Partial<Record<BodyLevel, GpuBody>> = {};
  /** il corpo usato per il disegno in corso */
  let body: GpuBody | null = null;
  const bodyAttribs = [bl.aP, bl.aN, bl.aJ, bl.aM, bl.aT];
  const drawBodyLayer = (layer: BodyBatch["layer"], code: number, alpha: number) => {
    if (!body) return;
    gl.uniform1f(bl.uLayer, code);
    gl.uniform1f(bl.uLayerV, code);
    gl.uniform1f(bl.uAlpha, alpha);
    const st = body.meta.stride;
    for (const b of body.batches) {
      if (b.layer !== layer) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, b.vb);
      gl.vertexAttribPointer(bl.aP, 3, gl.UNSIGNED_SHORT, true, st, 0);
      gl.vertexAttribPointer(bl.aN, 3, gl.BYTE, true, st, 6);
      gl.vertexAttribPointer(bl.aJ, 2, gl.UNSIGNED_BYTE, false, st, 9);
      gl.vertexAttribPointer(bl.aM, 4, gl.UNSIGNED_BYTE, false, st, 11);
      gl.vertexAttribPointer(bl.aT, 1, gl.UNSIGNED_BYTE, true, st, 15);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.ib);
      gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
    }
  };
  let bound = "";
  const bind = (name: Part["mesh"]) => {
    if (bound === name) return;
    const m = meshes[name]!;
    gl.bindBuffer(gl.ARRAY_BUFFER, m.p);
    gl.enableVertexAttribArray(loc.aP);
    gl.vertexAttribPointer(loc.aP, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.n);
    gl.enableVertexAttribArray(loc.aN);
    gl.vertexAttribPointer(loc.aN, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i);
    bound = name;
  };
  const one = (p: Part) => {
    if (p.alt && (p.alt === "real") !== gearReady) return;
    if (!meshes[p.mesh]) return;
    bind(p.mesh);
    gl.uniformMatrix4fv(loc.uM, false, p.m);
    gl.uniformMatrix3fv(loc.uNM, false, p.nm);
    gl.uniform3fv(loc.uColor, p.color);
    gl.uniform1f(loc.uMode, p.mode);
    gl.uniform1f(loc.uAlpha, p.alpha);
    gl.uniform1f(loc.uAct, p.act);
    gl.drawElements(gl.TRIANGLES, meshes[p.mesh]!.count, gl.UNSIGNED_SHORT, 0);
  };
  const drawProcedural = (parts: Part[], VP: Float32Array, eye: V3, time: number) => {
    gl.useProgram(prog);
    for (const a of bodyAttribs) if (a >= 0) gl.disableVertexAttribArray(a);
    gl.uniformMatrix4fv(loc.uVP, false, VP);
    gl.uniform3fv(loc.uEye, eye);
    gl.uniform1f(loc.uTime, time);
    bound = "";
    for (const p of parts) one(p);
  };
  const bul = new Float32Array(64);
  const segRows = new Float32Array(63 * 4);
  const curlBuf = new Float32Array(32);
  const drawBody = (model: Model, VP: Float32Array, eye: V3, L: Layers, focus: Set<string> | null | undefined, time: number) => {
    if (!body || !model.J || !model.hand) return;
    const meta = body.meta;
    const sd = sides(model.hand);
    const side = (i: number): "L" | "R" => (i === 15 ? "L" : "R");
    const pts = model.hud.pts;
    const aim = v3.sub(pts.bowWr, pts.drawWr);
    const grips = model.grip ? {
      hook: { side: side(sd.draw[2]), k: model.grip.draw, toward: pts.nock },
      wrap: { side: side(sd.bow[2]), k: model.grip.bow, toward: v3.add(pts.grip, v3.mul(v3.norm(aim), 0.05)) },
    } : undefined;
    // le mani in presa si mettono sull'attrezzo: il pugno chiuso attorno all'impugnatura dell'arco e la piega
    // delle dita sulla corda alla cocca. Prima si guarda dove cade il «buco» delle dita piegate, poi si sposta
    // la mano (solo lei: l'avambraccio si allunga di pochi centimetri) perché cada proprio lì
    let J = model.J;
    if (grips) {
      const first = bodyMatrices(meta, J, model.headF, grips, curlBuf);
      J = seatHands(meta, J, first, [
        grips.wrap.k > 0.3 ? { side: grips.wrap.side, base: grips.wrap.side === "L" ? 33 : 54, at: pts.grip, hole: "wrap" as const } : null,
        grips.hook.k > 0.3 ? { side: grips.hook.side, base: grips.hook.side === "L" ? 33 : 54, at: pts.nock, hole: "hook" as const } : null,
      ]);
    }
    const mats = bodyMatrices(meta, J, model.headF, grips, curlBuf);
    // matrici dei segmenti come tre righe ciascuna (la quarta è sempre 0 0 0 1)
    const nSeg = Math.min(21, meta.segments.length);
    for (let i = 0; i < nSeg; i++) for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) segRows[(i * 3 + r) * 4 + c] = mats[i * 16 + c * 4 + r];
    const acts = new Map<string, number>();
    for (const p of model.parts) if (p.layer === "muscolo" && p.id) acts.set(p.id, Math.max(acts.get(p.id) ?? 0, p.act));
    const g = groupValues(meta, model.hand, acts, focus);
    flexValues(body.flex, J, g.act, bul);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(true);
    // arco, corda e freccia: dal modello semplice (senza scartare facce)
    drawProcedural(model.parts.filter((p) => p.layer === "arco" && !focus), VP, eye, 0);
    gl.disableVertexAttribArray(loc.aP);
    gl.disableVertexAttribArray(loc.aN);
    gl.useProgram(bprog);
    for (const a of bodyAttribs) if (a >= 0) gl.enableVertexAttribArray(a);
    gl.uniformMatrix4fv(bl.uVP, false, VP);
    gl.uniform4fv(bl.uSeg, segRows);
    gl.uniform4fv(bl.uCurl, curlBuf);
    gl.uniform2f(bl.uDita, meta.segments.indexOf("dita_L"), meta.segments.indexOf("dita_R"));
    gl.uniform3fv(bl.uLo, meta.lo);
    gl.uniform3fv(bl.uHi, meta.hi);
    const a16 = new Float32Array(64);
    for (let k = 0; k < 64; k++) a16[k] = Math.max(0, Math.min(1, g.act[k] ?? 0)) + ((g.foc[k] ?? 0) + 1) * 2;
    gl.uniform4fv(bl.uAct, a16);
    gl.uniform4fv(bl.uBul, bul);
    gl.uniform1f(bl.uTime, time);
    gl.uniform3fv(bl.uEye, eye);
    gl.uniform1f(bl.uDim, L.muscolo ? 1 : 0);
    // le superfici del corpo sono chiuse e orientate verso l'esterno: le facce interne non si disegnano
    // (niente pieghe luccicanti dentro la pelle)
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    if (L.osso) drawBodyLayer("bone", 1, 1);
    if (L.muscolo) drawBodyLayer("muscle", 2, 1);
    if (L.pelle) {
      // pelle in due passate: solo profondità, poi il colore sulla superficie più esterna, sommato come vetro
      gl.colorMask(false, false, false, false);
      drawBodyLayer("skin", 0, 1);
      gl.colorMask(true, true, true, true);
      gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      drawBodyLayer("skin", 0, L.osso || L.muscolo ? 1 : 1.6);
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.disable(gl.CULL_FACE);
    for (const a of bodyAttribs) if (a >= 0) gl.disableVertexAttribArray(a);
    gl.useProgram(prog);
    bound = "";
  };
  return {
    /** carica il corpo vero nella scheda grafica; da quel momento sostituisce la sagoma semplice */
    setBody(data: BodyData, level: BodyLevel = "pieno") {
      if (!bodyOk || bodies[level]) return;
      const batches = data.meta.batches.map((b) => {
        const vb = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, vb);
        // la pelle sa quale muscolo ha sotto: si gonfia con lui
        gl.bufferData(gl.ARRAY_BUFFER, b.layer === "skin" ? skinWithMuscles(data, b) : new Uint8Array(data.buf, b.vOffset, b.vertices * data.meta.stride), gl.STATIC_DRAW);
        const ib = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.buf, b.iOffset, b.indices), gl.STATIC_DRAW);
        return { layer: b.layer, vb, ib, count: b.indices };
      });
      bodies[level] = { meta: data.meta, flex: flexOf(data), batches };
      bound = "";
    },
    /** aspetta l'arco e la freccia veri (per le foto: un disegno solo, deve già averli) */
    async gearLoaded() {
      await loadGear();
      return gearReady;
    },
    hasBody() {
      return Boolean(bodies.pieno || bodies.leggero);
    },
    clear(W: number, H: number) {
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    /** focus: id dei muscoli da mettere in evidenza (gli altri si spengono) */
    draw(model: Model, VP: Float32Array, eye: V3, time: number, L: Layers, focus?: Set<string> | null, fast = false) {
      // in movimento il corpo leggero (scorre senza scatti), fermo quello pieno
      body = (fast ? (bodies.leggero ?? bodies.pieno) : (bodies.pieno ?? bodies.leggero)) ?? null;
      if (body && model.J && model.hand) {
        drawBody(model, VP, eye, L, focus, time);
        return;
      }
      gl.useProgram(prog);
      gl.uniformMatrix4fv(loc.uVP, false, VP);
      gl.uniform3fv(loc.uEye, eye);
      gl.uniform1f(loc.uTime, time);
      bound = "";
      const show = (p: Part) => (p.layer === "arco" ? !focus : p.layer === "osso" ? L.osso : p.layer === "muscolo" ? L.muscolo : L.pelle);
      const look = (p: Part): Part => {
        if (!focus || p.layer !== "muscolo") return p;
        return focus.has(p.id ?? "") ? { ...p, color: [1, 0.78, 0.26], act: 0.55, alpha: 1 } : { ...p, color: [0.55, 0.3, 0.27], act: 0, alpha: 0.32 };
      };
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      // ossa, arco e muscoli scrivono la profondità; la pelle si somma sopra come vetro
      gl.depthMask(true);
      gl.disable(gl.CULL_FACE);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      // con i muscoli accesi colonna e costole restano in trasparenza, come nelle tavole
      for (const p of model.parts) if ((p.layer === "osso" || p.layer === "arco") && show(p)) one(p.deep && L.muscolo ? { ...p, alpha: p.alpha * 0.35 } : p);
      // prima i muscoli in evidenza, poi gli altri in trasparenza
      for (const p of model.parts) if (p.layer === "muscolo" && show(p) && (!focus || focus.has(p.id ?? ""))) one(look(p));
      if (focus) {
        gl.depthMask(false);
        for (const p of model.parts) if (p.layer === "muscolo" && show(p) && !focus.has(p.id ?? "")) one(look(p));
        gl.depthMask(true);
      }
      // pelle in due passate: prima la sola profondità, poi il colore solo sulla superficie più esterna,
      // così le parti che si sovrappongono (busto, collo, braccia) sembrano un corpo unico
      gl.colorMask(false, false, false, false);
      for (const p of model.parts) if (p.layer === "pelle" && show(p)) one(p);
      gl.colorMask(true, true, true, true);
      gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      // senza muscoli e ossa la pelle è l'unica cosa: un po' più presente
      for (const p of model.parts) if (p.layer === "pelle" && show(p)) one({ ...p, alpha: L.osso || L.muscolo ? p.alpha : 1 });
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
    },
    dispose() {
      disposed = true;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

/** camera che guarda un punto da una direzione (yaw, pitch) a una distanza */
export function viewFrom(target: V3, yaw: number, pitch: number, dist: number, aspect: number, fovDeg = 34, near = 0.05) {
  const eye: V3 = [target[0] + Math.sin(yaw) * Math.cos(pitch) * dist, target[1] + Math.sin(pitch) * dist, target[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
  return { eye, VP: mul4(perspective((fovDeg * Math.PI) / 180, aspect, near, 30), lookAt(eye, target)) };
}


/** un punto di riposo portato dove lo mette la matrice del segmento (colonne, come WebGL) */
function xf(m: Float32Array, at: number, p: V3): V3 {
  const o = at * 16;
  return [m[o] * p[0] + m[o + 4] * p[1] + m[o + 8] * p[2] + m[o + 12], m[o + 1] * p[0] + m[o + 5] * p[1] + m[o + 9] * p[2] + m[o + 13], m[o + 2] * p[0] + m[o + 6] * p[1] + m[o + 10] * p[2] + m[o + 14]];
}

/**
 * Sposta le mani in presa sull'attrezzo. Il «buco» delle dita piegate, a riposo: per la mano dell'arco
 * davanti al palmo all'altezza delle nocche (dove passa l'impugnatura), per quella della corda nella
 * piega della prima falange. Si calcola dove cade con la posa attuale e si trasla tutta la mano (polso,
 * dita e i suoi 21 punti) perché cada sull'impugnatura o sulla cocca; mai più di 7 cm.
 */
function seatHands(meta: BodyMeta, J: Record<number, V3>, mats: Float32Array, hands: ({ side: "L" | "R"; base: number; at: V3; hole: "wrap" | "hook" } | null)[]): Record<number, V3> {
  let out: Record<number, V3> | null = null;
  for (const h of hands) {
    if (!h) continue;
    const m = meta.segments.indexOf(`mano_${h.side}`);
    const k0 = meta.rest[`dita0_${h.side}`];
    const k1 = meta.rest[`dita1_${h.side}`];
    if (m < 0 || !k0 || !k1) continue;
    const F = v3.norm(v3.sub(k1, k0));
    const L = v3.len(v3.sub(k1, k0));
    // a riposo i palmi guardano avanti (+z): le dita si piegano da quella parte
    const holeRest: V3 = h.hole === "wrap" ? v3.add(v3.add(k0, [0, 0, 0.024]), v3.mul(F, 0.012)) : v3.add(v3.add(k0, v3.mul(F, L * 0.42)), [0, 0, 0.012]);
    const hole = xf(mats, m, holeRest);
    let d = v3.sub(h.at, hole);
    const dl = v3.len(d);
    if (dl < 0.002) continue;
    if (dl > 0.07) d = v3.mul(d, 0.07 / dl);
    out ??= { ...J };
    const wr = h.side === "L" ? [15, 17, 19, 21] : [16, 18, 20, 22];
    for (const i of [...wr, ...Array.from({ length: 21 }, (_, k) => h.base + k)]) if (J[i]) out[i] = v3.add(J[i], d);
  }
  return out ?? J;
}
