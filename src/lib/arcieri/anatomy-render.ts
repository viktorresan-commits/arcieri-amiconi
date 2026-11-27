/**
 * Disegno WebGL del modello anatomico (pelle di vetro, ossa, muscoli con fibre e tendini).
 * Usato dalla vista 3D dell'analisi e dalle immagini dei muscoli per le zone del corpo.
 */
import { v3, type GearMesh, type Model, type Part, type V3 } from "./anatomy-model";
import { bodyMatrices, curlFrame, gripHole, groupValues, type BodyBatch, type BodyData, type BodyLevel, type BodyMeta } from "./anatomy-body";
import { flexInfo, flexValues, skinWithMuscles, type FlexInfo } from "./anatomy-flex";
import { loadGlb } from "./glb-geo";
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
uniform vec4 uCurl[8]; uniform vec2 uDita; uniform vec4 uFa[4];
varying vec3 vW; varying vec3 vN; varying vec2 vF; varying float vAct; varying float vFoc; varying float vTend; varying float vStr; varying float vGrp; varying vec3 vR;
float pick(vec4 v, int k){ return k == 0 ? v.x : k == 1 ? v.y : k == 2 ? v.z : v.w; }
vec3 rotA(vec3 v, vec3 ax, float a){ float c = cos(a); float s = sin(a); return v * c + cross(ax, v) * s + ax * dot(ax, v) * (1.0 - c); }
// dita piegate in presa (prima di seguire i segmenti): terza falange, seconda, allargamento dell'indice, nocca
void curl(int h, inout vec3 p, inout vec3 n){
  vec4 c0 = uCurl[h * 4]; vec4 c1 = uCurl[h * 4 + 1]; vec4 c2 = uCurl[h * 4 + 2]; vec4 c3 = uCurl[h * 4 + 3];
  vec4 f1 = uFa[h * 2]; vec4 f2 = uFa[h * 2 + 1];
  if (c0.w == 0.0) return;
  vec3 K = c0.xyz; float L = c0.w; vec3 F = c1.xyz; vec3 S = c2.xyz; vec3 X = c3.xyz;
  vec3 d = p - K; float t = dot(d, F) / L; float u = dot(d, X);
  float little = smoothstep(-0.012, -0.022, u);
  float index = smoothstep(0.012, 0.02, u);
  // ogni dito con la sua piega (dai 21 punti della mano): indice, medio, anulare, mignolo da un lato all'altro
  vec4 wf = exp(-pow((vec4(u) - vec4(0.026, 0.009, -0.009, -0.026)) / 0.009, vec4(2.0)));
  wf /= max(1e-4, wf.x + wf.y + wf.z + wf.w);
  float g1 = dot(wf, f1); float g2 = dot(wf, f2);
  float a2 = c2.w * (1.0 + 0.3 * little) + g2; float a3 = c2.w * 0.55 * (1.0 + 0.3 * little) + g2 * 0.55;
  vec3 J2 = K + F * (L * 0.47); vec3 J3 = K + F * (L * 0.76);
  float s1 = smoothstep(-0.05, 0.08, t); float s2 = smoothstep(0.40, 0.54, t); float s3 = smoothstep(0.70, 0.82, t);
  p = J3 + rotA(p - J3, S, a3 * s3); n = rotA(n, S, a3 * s3);
  p = J2 + rotA(p - J2, S, a2 * s2); n = rotA(n, S, a2 * s2);
  vec3 Pn = cross(S, F); float sp = c3.w * index * s1;
  p = K + rotA(p - K, Pn, sp); n = rotA(n, Pn, sp);
  float a1 = c1.w * (1.0 + 0.25 * little) + g1;
  p = K + rotA(p - K, S, a1 * s1); n = rotA(n, S, a1 * s1);
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
  vF = vec2(aM.z, aM.w) / 255.0; vTend = aT; vGrp = float(g);
  vW = wp.xyz; vR = p; gl_Position = uVP * wp;
}`;
const BFS = `${PREC}
varying vec3 vW; varying vec3 vN; varying vec2 vF; varying float vAct; varying float vFoc; varying float vTend; varying float vStr; varying float vGrp; varying vec3 vR;
uniform vec3 uEye; uniform float uLayer; uniform float uAlpha; uniform float uDim; uniform float uTime; uniform float uStyle;
// dettaglio del muscolo (immagine ripetuta lungo le fibre): R rilievo dei fasci, G chiaroscuro del tessuto, B fasce connettivali
uniform sampler2D uFib; uniform float uFibOn;
// visuale dall'occhio: la testa attorno alla camera non si disegna
uniform vec4 uCut;
// luce calcolata come in fotografia (valori lineari), poi la curva "da pellicola" e lo schermo (sRGB):
// volumi morbidi e colori veri come nelle tavole anatomiche fotografiche, niente rosso piatto
vec3 tone(vec3 c){ c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0); return pow(c, vec3(1.0 / 2.2)); }
float hash(float n){ return fract(sin(n * 12.9898 + 4.1) * 43758.5453); }
float wrapL(vec3 N, vec3 L, float w){ return max(0.0, (dot(N, L) + w) / (1.0 + w)); }
// rumore 3D sulla posizione a riposo (resta attaccato all'osso mentre il corpo si muove)
float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
void main(){
  if (uCut.w > 0.0 && distance(vW, uCut.xyz) < uCut.w) discard;
  vec3 N = normalize(vN); vec3 V = normalize(uEye - vW);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  // le luci girano con chi guarda (studio fotografico): da ogni lato il corpo è illuminato allo stesso modo.
  // Principale calda in alto a sinistra, riempimento freddo a destra, controluce che stacca il bordo
  vec3 Rt = normalize(cross(vec3(0.0, 1.0, 0.0), V) + vec3(1e-4, 0.0, 0.0)); vec3 Up = cross(V, Rt);
  vec3 L1 = normalize(-0.5 * Rt + 0.75 * Up + 0.55 * V); vec3 C1 = vec3(1.0, 0.95, 0.88) * 1.9;
  vec3 L2 = normalize(0.8 * Rt + 0.1 * Up + 0.45 * V); vec3 C2 = vec3(0.70, 0.80, 1.0) * 0.45;
  vec3 L3 = normalize(0.3 * Rt + 0.45 * Up - 0.85 * V); vec3 C3 = vec3(0.95, 0.97, 1.0);
  vec3 amb = mix(vec3(0.12, 0.10, 0.09), vec3(0.24, 0.26, 0.30), 0.5 + 0.5 * N.y);
  vec3 H = normalize(L1 + V);
  vec3 col; float a = uAlpha;
  if (uLayer < 0.5) {
    // pelle: un velo appena accennato che disegna il contorno del corpo, neutro (non più azzurro)
    float rim = pow(1.0 - ndv, 2.4);
    if (uStyle > 0.5) {
      col = vec3(0.34, 0.37, 0.41);
      a = uAlpha * rim * 0.4 * (1.0 - vStr);
    } else {
      col = vec3(0.62, 0.68, 0.76) * (0.08 + rim * 1.3);
      a = uAlpha * (0.02 + rim * 0.48) * (1.0 - 0.85 * vStr);
    }
    gl_FragColor = vec4(tone(col), a);
    return;
  } else if (uLayer < 1.5) {
    // ossa come nei preparati: avorio con macchie appena più calde, la grana fine dell'osso compatto e i
    // pori, un rilievo leggerissimo; opache con una lucentezza morbida e un po' di luce che passa
    // (sub-superficie) nelle parti in ombra
    vec3 q = vR * 100.0;
    float blot = vnoise(q * 0.35) * 0.6 + vnoise(q * 0.9) * 0.4;
    vec3 alb = mix(vec3(0.70, 0.63, 0.50), vec3(0.55, 0.47, 0.35), smoothstep(0.35, 0.8, blot));
    float poreA = 0.0;
#ifdef HAS_DERIV
    vec3 qp = q * 4.0;
    float pf = length(fwidth(qp));
    float nearB = 1.0 - smoothstep(0.6, 2.5, pf);
    float grain = vnoise(qp) * 0.65 + vnoise(qp * 2.3) * 0.35;
    poreA = smoothstep(0.66, 0.82, grain) * nearB;
    // rilievo: la grana fa da piccola mappa di altezza
    vec3 spB = vW * 100.0;
    vec3 sxB = dFdx(spB); vec3 syB = dFdy(spB);
    float hxB = dFdx(grain); float hyB = dFdy(grain);
    vec3 r1B = cross(syB, N); vec3 r2B = cross(N, sxB);
    float detB = dot(sxB, r1B);
    N = normalize(abs(detB) * N - sign(detB) * (hxB * r1B + hyB * r2B) * 0.05 * nearB);
    ndv = clamp(dot(N, V), 0.0, 1.0);
#endif
    alb *= 1.0 - 0.32 * poreA;
    alb = mix(alb, alb * vec3(0.78, 0.74, 0.70), uDim * 0.6);
    if (vTend > 0.5) alb = vec3(0.03, 0.035, 0.04);
    float dif = wrapL(N, L1, 0.25);
    vec3 light = C1 * dif + C2 * wrapL(N, L2, 0.3) + amb;
    // luce che passa nell'osso sottile: un tepore nelle ombre
    vec3 sss = vec3(0.16, 0.08, 0.04) * (1.0 - dif) * (0.6 + 0.4 * blot);
    float spec = pow(max(dot(N, H), 0.0), 28.0) * 0.09 * (1.0 - poreA);
    float fres = pow(1.0 - ndv, 4.0) * 0.12;
    float rimL = pow(1.0 - ndv, 2.0) * max(0.0, dot(N, L3) + 0.3) * 0.35;
    col = alb * (light + sss) * mix(1.0, 0.62, pow(1.0 - ndv, 1.6)) + C1 * (spec + fres * dif) + C3 * rimL * 0.45;
  } else {
    // muscoli: rosso carne con piccole differenze da un muscolo all'altro, il ventre un po' più chiaro;
    // fasci appena accennati e la lucentezza a seta lungo le fibre (come nei preparati anatomici),
    // tendini e aponeurosi bianco perla e lucidi
    float h = hash(vGrp);
    // rosso del muscolo dei preparati e delle tavole anatomiche (rosa mattone, non cremisi saturo),
    // appena diverso da un gruppo all'altro
    vec3 alb = vec3(0.17, 0.053, 0.044) * (0.93 + 0.14 * h) * vec3(1.0, 1.0 + (hash(vGrp + 3.0) - 0.5) * 0.2, 1.0 + (hash(vGrp + 7.0) - 0.5) * 0.2);
    alb *= 0.88 + 0.14 * sin(3.14159 * vF.x);
    float fy = vF.y * 34.0 + 0.18 * sin(vF.x * 9.0) + 0.22 * sin(vF.x * 2.7 + vF.y * 4.1);
    float id = floor(fy);
    float hh = fract(id * 0.618034 + 0.27);
#ifdef HAS_DERIV
    float fw = fwidth(fy);
    float amp = 1.0 - smoothstep(0.12, 0.35, fw);
#else
    float fw = 0.08;
    float amp = 0.4;
#endif
    float fr = fract(fy);
    float dl = min(fr, 1.0 - fr);
    float groove = 1.0 - smoothstep(0.03, 0.12 + fw, dl);
    float crown = sin(fr * 3.14159);
    // solchi appena accennati: la grana del muscolo, non righe di legno
    float fib = 1.0 - amp * (0.07 * groove - 0.025 * crown + (hh - 0.5) * 0.05);
    // con l'immagine dei fasci: rilievo vero dei fasci lungo le fibre (luce che scorre sui fasci) e il
    // chiaroscuro del tessuto; le fasce connettivali tra i fasci appena più chiare
    float fascia = 0.0;
#ifdef HAS_DERIV
    if (uFibOn > 0.5 && vTend < 0.95) {
      vec2 uv = vec2(vF.x * 1.6 + hash(vGrp + 11.0) * 7.0, vF.y * 2.0 + hash(vGrp + 5.0));
      vec2 du = dFdx(uv); vec2 dv = dFdy(uv);
      // vicino molti dettagli, lontano spariscono piano (niente sfarfallio)
      float far = max(length(du), length(dv)) * 1024.0;
      float near = 1.0 - smoothstep(3.0, 14.0, far);
      vec3 tx = texture2D(uFib, uv).rgb;
      float hx = texture2D(uFib, uv + du).r - tx.r;
      float hy = texture2D(uFib, uv + dv).r - tx.r;
      vec3 sp = vW * 100.0;
      vec3 sx = dFdx(sp); vec3 sy = dFdy(sp);
      vec3 r1 = cross(sy, N); vec3 r2 = cross(N, sx);
      float det = dot(sx, r1);
      vec3 grad = sign(det) * (hx * r1 + hy * r2) * (0.09 * near * (1.0 - vTend));
      N = normalize(abs(det) * N - grad);
      // il chiaroscuro del tessuto appena accennato (la trama a celle, forte, sembrava una rete);
      // restano le righe sottili delle fibre e il rilievo dei fasci
      fib *= mix(1.0, 0.9 + 0.2 * tx.g, 0.35 * near) * (1.0 - 0.06 * near * (0.5 - tx.r));
      fascia = tx.b * 0.05 * near * (1.0 - vTend);
    }
#endif
    float act = clamp(vAct, 0.0, 1.0);
    float on = smoothstep(0.32, 0.8, act);
    // muscolo che lavora: rosso acceso tendente all'arancio, ben distinto ma non giallo
    // muscolo che lavora: rosso vivo (stessa famiglia di colore, solo più acceso), non arancio
    vec3 work = vec3(0.40, 0.038, 0.022);
    alb = mix(alb, work, on * 0.85);
    if (vFoc > 0.5) { alb = vec3(0.44, 0.06, 0.02); on = 1.0; }
    else if (vFoc < -0.5) { alb = mix(alb, vec3(0.12, 0.09, 0.09), 0.5); on = 0.0; }
    // tendini e fasce: bianco avorio caldo (come nei preparati), lucidi
    vec3 tend = vec3(0.47, 0.39, 0.35);
    alb = mix(alb * fib, vec3(0.42, 0.24, 0.21), fascia);
    alb = mix(alb, tend, vTend * 0.9);
    // luce morbida (la carne lascia passare un po' di luce), bordi che si scuriscono tra un muscolo e l'altro
    ndv = clamp(dot(N, V), 0.0, 1.0);
    vec3 light = C1 * wrapL(N, L1, 0.45) + C2 * wrapL(N, L2, 0.5) + amb;
    float edge = mix(1.0, 0.32, pow(1.0 - ndv, 1.6));
    col = alb * light * edge;
    // lucentezza a seta lungo le fibre: la riga di luce corre di traverso al fascio
    float silk = 0.0;
#ifdef HAS_DERIV
    vec3 dp1 = dFdx(vW) * 1000.0; vec3 dp2 = dFdy(vW) * 1000.0;
    vec3 T = cross(dp2, N) * (dFdx(vF.x) * 100.0) + cross(N, dp1) * (dFdy(vF.x) * 100.0);
    float tl = length(T);
    if (tl > 1e-4) {
      T /= tl;
      float th = dot(T, H);
      float kk = sqrt(max(0.0, 1.0 - th * th));
      // lobo largo: la direzione delle fibre cambia a scatti tra un triangolo e l'altro, un riflesso stretto
      // diventava una pioggia di puntini bianchi
      silk = pow(kk, 8.0) * 0.05 * (1.0 - 0.6 * groove);
    }
#endif
    float wet = pow(max(dot(N, H), 0.0), 64.0) * 0.12;
    vec3 sheen = mix(vec3(1.0, 0.8, 0.72), vec3(1.0), vTend);
    col += C1 * sheen * (silk * (1.0 - 0.5 * vTend) + wet + vTend * pow(max(dot(N, H), 0.0), 24.0) * 0.12);
    // controluce: stacca il corpo dallo sfondo
    col += C3 * pow(1.0 - ndv, 3.0) * max(0.0, dot(N, L3) + 0.2) * 0.22;
    // muscolo che lavora: si accende dall'interno, piano
    float pulse = 0.85 + 0.15 * sin(uTime * 4.4);
    col += vec3(0.55, 0.05, 0.02) * on * (0.04 + 0.12 * pow(ndv, 2.0)) * pulse * (1.0 - vTend);
    // superficie stirata dove due segmenti tirano: più scura e senza luce (niente schegge luccicanti)
    col *= 1.0 - 0.4 * vStr;
  }
  gl_FragColor = vec4(tone(col), a);
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
type GearGeo = { name: GearMesh; pos: Float32Array; nor: Float32Array; idx: Uint16Array; uv?: Float32Array; image?: ImageBitmap | HTMLImageElement | null };
let gearPromise: Promise<GearGeo[] | null> | null = null;
/**
 * Arco ricurvo tradizionale Samik Sage («Bow and Arrows» di signguy, CC BY 3.0): riser di legno vero
 * (dalla foto del file), flettenti con laminato chiaro e vernice nera, pomelli. I pezzi con lo stesso
 * materiale si uniscono in un solo blocco da disegnare.
 */
async function loadSamik(): Promise<GearGeo[]> {
  const parts = await loadGlb("/prova3d/assets/archery/bow.glb");
  const groups: Record<"sbRiser" | "sbDark" | "sbLight", { pos: number[]; nor: number[]; uv: number[]; idx: number[]; image: ImageBitmap | HTMLImageElement | null }> = {
    sbRiser: { pos: [], nor: [], uv: [], idx: [], image: null },
    sbDark: { pos: [], nor: [], uv: [], idx: [], image: null },
    sbLight: { pos: [], nor: [], uv: [], idx: [], image: null },
  };
  for (const p of parts) {
    const key = p.image ? "sbRiser" : /brown/i.test(p.material) ? "sbLight" : "sbDark";
    const g = groups[key];
    const base = g.pos.length / 3;
    g.pos.push(...p.geo.pos);
    g.nor.push(...p.geo.nor);
    g.uv.push(...(p.geo.uv ?? new Float32Array((p.geo.pos.length / 3) * 2)));
    for (const i of p.geo.idx) g.idx.push(i + base);
    if (p.image) g.image = p.image;
  }
  return (Object.keys(groups) as (keyof typeof groups)[])
    .filter((k) => groups[k].idx.length && groups[k].pos.length / 3 < 65536)
    .map((k) => ({ name: k, pos: new Float32Array(groups[k].pos), nor: new Float32Array(groups[k].nor), uv: new Float32Array(groups[k].uv), idx: new Uint16Array(groups[k].idx), image: groups[k].image }));
}
function loadGear() {
  gearPromise ??= Promise.all([loadGearBin(), loadSamik().catch(() => [] as GearGeo[])]).then(([a, b]) => (a ? [...a, ...b] : b.length ? b : null));
  return gearPromise;
}
function loadGearBin(): Promise<GearGeo[] | null> {
  return fetch("/models/arco-legno.bin")
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
    .catch(() => null);
}

/* attrezzatura vera (arco, freccia): materiali propri, con la stessa luce da studio del corpo */
const GVS = `
attribute vec3 aP; attribute vec3 aN; attribute vec2 aUV;
uniform mat4 uVP; uniform mat4 uM; uniform mat3 uNM;
varying vec3 vW; varying vec3 vN; varying vec3 vO; varying vec2 vUV;
void main(){ vec4 w = uM * vec4(aP, 1.0); vW = w.xyz; vN = normalize(uNM * aN); vO = aP; vUV = aUV; gl_Position = uVP * w; }`;
const GFS = `${PREC}
varying vec3 vW; varying vec3 vN; varying vec3 vO; varying vec2 vUV;
uniform vec3 uEye; uniform vec3 uColor; uniform float uKind; uniform sampler2D uTex;
vec3 tone(vec3 c){ c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0); return pow(c, vec3(1.0 / 2.2)); }
float wrapL(vec3 N, vec3 L, float w){ return max(0.0, (dot(N, L) + w) / (1.0 + w)); }
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uEye - vW);
  if (dot(N, V) < 0.0) N = -N;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec3 Rt = normalize(cross(vec3(0.0, 1.0, 0.0), V) + vec3(1e-4, 0.0, 0.0)); vec3 Up = cross(V, Rt);
  vec3 L1 = normalize(-0.5 * Rt + 0.75 * Up + 0.55 * V); vec3 C1 = vec3(1.0, 0.95, 0.88) * 1.9;
  vec3 L2 = normalize(0.8 * Rt + 0.1 * Up + 0.45 * V); vec3 C2 = vec3(0.70, 0.80, 1.0) * 0.45;
  vec3 L3 = normalize(0.3 * Rt + 0.45 * Up - 0.85 * V);
  vec3 amb = mix(vec3(0.12, 0.10, 0.09), vec3(0.24, 0.26, 0.30), 0.5 + 0.5 * N.y);
  vec3 H = normalize(L1 + V);
  vec3 alb = uColor; float spec = 0.08; float gloss = 24.0;
  // foschia dell'aria aperta: il prato lontano e il paglione a 70 m sbiadiscono un poco
  float dEye = distance(vW, uEye);
  float fog = smoothstep(25.0, 150.0, dEye) * 0.4;
  float rimK = 1.0;
  if (uKind < 0.5) {
    // tinta unita (impugnatura di cuoio)
    spec = 0.05;
  } else if (uKind < 1.5) {
    // legno del riser dalla foto: verniciato, lucido
    alb = pow(texture2D(uTex, vUV).rgb, vec3(2.2));
    spec = 0.28; gloss = 60.0;
  } else if (uKind < 2.5) {
    // legno con la venatura lungo il pezzo (asta della freccia, laminato dei flettenti)
    float g = sin(vO.y * 260.0 + sin(vO.x * 900.0 + vO.z * 700.0) * 2.2 + sin(vO.y * 37.0) * 3.0);
    alb = uColor * (0.84 + 0.16 * g);
    spec = 0.14; gloss = 36.0;
  } else if (uKind < 3.5) {
    // penne naturali barrate (tacchino): fasce chiare e scure, opache con un velo di lucido
    float bar = smoothstep(0.3, 0.7, fract(vO.y * 42.0 + vO.x * 9.0 + vO.z * 9.0));
    alb = mix(vec3(0.46, 0.37, 0.27), vec3(0.09, 0.07, 0.055), bar * 0.85);
    spec = 0.06; gloss = 10.0;
  } else if (uKind < 4.5) {
    // punta d'acciaio
    alb = vec3(0.40, 0.41, 0.43); spec = 0.75; gloss = 90.0;
  } else if (uKind > 6.5 && uKind < 7.5) {
    // prato: verde d'erba con chiazze, falciato a strisce ogni 5 m (danno la distanza)
    float st = step(0.5, fract(vO.x * 0.1));
    float nz = sin(vO.x * 3.1 + sin(vO.z * 2.3) * 1.7) * sin(vO.z * 2.9 + vO.x * 0.7);
    float fine = sin(vO.x * 41.0 + sin(vO.z * 37.0) * 2.0) * sin(vO.z * 43.0 - vO.x * 13.0);
    alb = mix(vec3(0.038, 0.085, 0.018), vec3(0.062, 0.125, 0.026), st) * (0.88 + 0.14 * nz + 0.06 * fine);
    spec = 0.0; rimK = 0.0;
    fog = smoothstep(18.0, 140.0, dEye) * 0.85;
  } else if (uKind > 7.5) {
    // carta della visuale: opaca, colori pieni
    alb = pow(texture2D(uTex, vUV).rgb, vec3(2.2));
    spec = 0.03; gloss = 8.0;
  } else if (uKind < 5.5) {
    // legature di filo rosso
    alb = vec3(0.42, 0.025, 0.03) * (0.78 + 0.22 * sin(vO.y * 2400.0));
    spec = 0.12; gloss = 22.0;
  } else {
    // vernice nera lucida (flettenti, pomelli)
    alb = vec3(0.012, 0.012, 0.013); spec = 0.55; gloss = 110.0;
  }
  vec3 light = C1 * wrapL(N, L1, 0.15) + C2 * wrapL(N, L2, 0.25) + amb;
  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  vec3 col = alb * light + C1 * (pow(max(dot(N, H), 0.0), gloss) * spec + fres * spec * 0.25) + rimK * vec3(0.95, 0.97, 1.0) * pow(1.0 - ndv, 3.0) * max(0.0, dot(N, L3) + 0.2) * 0.25;
  gl_FragColor = vec4(mix(tone(col), vec3(0.70, 0.76, 0.78), fog), 1.0);
}`;
/** materiale di ogni pezzo dell'attrezzatura vera: 0 tinta, 1 foto, 2 legno, 3 penne, 4 acciaio, 5 filo, 6 vernice nera */
const GEAR_KIND: Partial<Record<GearMesh, number>> = { sbRiser: 1, sbDark: 6, sbLight: 2, lbWood: 2, lbGrip: 0, arTrim: 2, arShaft: 5, arFletch: 3, arPoint: 4, tgStraw: 8, tgWood: 8, tgMetal: 8, tgFlag: 0, tgFace: 8, ground: 7 };

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
  // attrezzatura vera: un programma suo, con le coordinate della foto del legno
  const gprog = gl.createProgram()!;
  gl.attachShader(gprog, sh(gl.VERTEX_SHADER, GVS));
  gl.attachShader(gprog, sh(gl.FRAGMENT_SHADER, GFS));
  gl.linkProgram(gprog);
  const gearOk = Boolean(gl.getProgramParameter(gprog, gl.LINK_STATUS));
  const gloc = {
    aP: gl.getAttribLocation(gprog, "aP"),
    aN: gl.getAttribLocation(gprog, "aN"),
    aUV: gl.getAttribLocation(gprog, "aUV"),
    uVP: gl.getUniformLocation(gprog, "uVP"),
    uM: gl.getUniformLocation(gprog, "uM"),
    uNM: gl.getUniformLocation(gprog, "uNM"),
    uEye: gl.getUniformLocation(gprog, "uEye"),
    uColor: gl.getUniformLocation(gprog, "uColor"),
    uKind: gl.getUniformLocation(gprog, "uKind"),
    uTex: gl.getUniformLocation(gprog, "uTex"),
  };
  const gmeshes: Partial<Record<GearMesh, { p: WebGLBuffer; n: WebGLBuffer; t: WebGLBuffer; i: WebGLBuffer; count: number; tex: WebGLTexture | null }>> = {};
  const texOf = (img: ImageBitmap | HTMLImageElement | HTMLCanvasElement, w = 1024, h = 256) => {
    // la foto si porta a misure potenza di due (1024×256): così si può filtrare bene anche da lontano
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const c2 = cv.getContext("2d");
    if (!c2) return null;
    c2.drawImage(img, 0, 0, cv.width, cv.height);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, cv);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  void loadGear()
    .then((list) => {
      if (disposed || !list) return;
      for (const g of list) {
        meshes[g.name] = upload(g);
        if (!gearOk) continue;
        const t = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, t);
        gl.bufferData(gl.ARRAY_BUFFER, g.uv ?? new Float32Array((g.pos.length / 3) * 2), gl.STATIC_DRAW);
        const m = meshes[g.name]!;
        gmeshes[g.name] = { p: m.p, n: m.n, t, i: m.i, count: m.count, tex: g.image ? texOf(g.image) : null };
      }
      gearReady = true;
    })
    .catch(() => {});
  // ---- paglione, visuale di carta e prato per la visuale dell'arciere (si caricano solo se servono) ----
  let targetJob: Promise<boolean> | null = null;
  const loadTarget = () =>
    (targetJob ??= (async () => {
      if (!gearOk) return false;
      const parts = await loadGlb("/prova3d/assets/archery/target.glb");
      const groups: Partial<Record<GearMesh, { pos: number[]; nor: number[]; uv: number[]; idx: number[]; image: ImageBitmap | HTMLImageElement | null }>> = {};
      for (const p of parts) {
        const key: GearMesh = /straw/i.test(p.material) ? "tgStraw" : /wood/i.test(p.material) ? "tgWood" : /metal/i.test(p.material) ? "tgMetal" : "tgFlag";
        const g = (groups[key] ??= { pos: [], nor: [], uv: [], idx: [], image: null });
        const base = g.pos.length / 3;
        if (base + p.geo.pos.length / 3 >= 65536) continue;
        g.pos.push(...p.geo.pos);
        g.nor.push(...p.geo.nor);
        g.uv.push(...(p.geo.uv ?? new Float32Array((p.geo.pos.length / 3) * 2)));
        for (const i of p.geo.idx) g.idx.push(i + base);
        if (p.image) g.image = p.image;
      }
      const put = (name: GearMesh, pos: Float32Array, nor: Float32Array, uv: Float32Array, idx: Uint16Array, tex: WebGLTexture | null) => {
        const m = upload({ pos, nor, idx });
        const t = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, t);
        gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
        gmeshes[name] = { p: m.p, n: m.n, t, i: m.i, count: m.count, tex };
      };
      for (const [name, g] of Object.entries(groups) as [GearMesh, NonNullable<(typeof groups)[GearMesh]>][]) {
        if (!g.idx.length) continue;
        put(name, new Float32Array(g.pos), new Float32Array(g.nor), new Float32Array(g.uv), new Uint16Array(g.idx), g.image ? texOf(g.image, 1024, 1024) : null);
      }
      // visuale FITA a dieci zone: due bianche, due nere, due blu, due rosse, due gialle (oro), con la crocetta
      const cv = document.createElement("canvas");
      cv.width = cv.height = 512;
      const g2 = cv.getContext("2d");
      if (g2) {
        g2.fillStyle = "#cfc6ae";
        g2.fillRect(0, 0, 512, 512);
        const cols = ["#f4f1ea", "#f4f1ea", "#1b1b1d", "#1b1b1d", "#2a7bc4", "#2a7bc4", "#d63a2f", "#d63a2f", "#f2c42c", "#f2c42c"];
        for (let i = 0; i < 10; i++) {
          g2.beginPath();
          g2.arc(256, 256, 254 - i * 25.4, 0, Math.PI * 2);
          g2.fillStyle = cols[i];
          g2.fill();
          g2.lineWidth = 1.6;
          g2.strokeStyle = i === 2 || i === 3 ? "#e9e6de" : "#1b1b1d";
          g2.stroke();
        }
        g2.beginPath();
        g2.arc(256, 256, 12.7, 0, Math.PI * 2);
        g2.lineWidth = 1;
        g2.strokeStyle = "#1b1b1d";
        g2.stroke();
        g2.beginPath();
        g2.moveTo(250, 256);
        g2.lineTo(262, 256);
        g2.moveTo(256, 250);
        g2.lineTo(256, 262);
        g2.stroke();
      }
      // disco: normale +x, raggio 1 nel piano y-z
      const N = 64;
      const pos: number[] = [0, 0, 0];
      const nor: number[] = [1, 0, 0];
      const uv: number[] = [0.5, 0.5];
      const idx: number[] = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * Math.PI * 2;
        const y = Math.cos(t);
        const z = Math.sin(t);
        pos.push(0, y, z);
        nor.push(1, 0, 0);
        uv.push(0.5 + 0.5 * z, 0.5 - 0.5 * y);
        if (i > 0) idx.push(0, i, i + 1);
      }
      put("tgFace", new Float32Array(pos), new Float32Array(nor), new Float32Array(uv), new Uint16Array(idx), texOf(cv, 512, 512));
      // prato in metri: x lungo la linea di tiro (0 = linea dei piedi), z di lato; le strisce vengono da x
      const gp = new Float32Array([-15, 0, -45, 190, 0, -45, 190, 0, 45, -15, 0, 45]);
      put("ground", gp, new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), new Float32Array(8), new Uint16Array([0, 2, 1, 0, 3, 2]), null);
      return true;
    })().catch(() => false));
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
    uStyle: gl.getUniformLocation(bprog, "uStyle"),
    uBul: gl.getUniformLocation(bprog, "uBul"),
    uLayerV: gl.getUniformLocation(bprog, "uLayerV"),
    uTime: gl.getUniformLocation(bprog, "uTime"),
    uCurl: gl.getUniformLocation(bprog, "uCurl"),
    uFa: gl.getUniformLocation(bprog, "uFa"),
    uDita: gl.getUniformLocation(bprog, "uDita"),
    uFib: gl.getUniformLocation(bprog, "uFib"),
    uCut: gl.getUniformLocation(bprog, "uCut"),
    uFibOn: gl.getUniformLocation(bprog, "uFibOn"),
  };
  // dettaglio dei fasci muscolari: un'immagine ripetuta lungo le fibre (arriva dopo il corpo, non lo blocca)
  const cutNow = new Float32Array(4);
  const fibTex = gl.createTexture();
  let fibReady = false;
  let disposedFib = false;
  let fibDone: () => void = () => {};
  /** l'immagine dei fasci è arrivata (o non arriverà): le foto e il play preparato la aspettano */
  const fibLoaded = new Promise<void>((res) => {
    fibDone = res;
  });
  if (typeof Image === "undefined") fibDone();
  else {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => {
      if (disposedFib) return;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, fibTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.activeTexture(gl.TEXTURE0);
      fibReady = true;
      fibDone();
    };
    im.onerror = () => fibDone();
    im.src = "/anatomia/fibre.jpg";
  }
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
  /** arco e freccia veri con i loro materiali (dopo il resto, con la stessa camera) */
  const drawGear = (parts: Part[], VP: Float32Array, eye: V3) => {
    if (!gearOk || !gearReady) return;
    const list = parts.filter((p) => p.alt === "real" && gmeshes[p.mesh as GearMesh]);
    if (!list.length) return;
    gl.useProgram(gprog);
    for (const a of bodyAttribs) if (a >= 0) gl.disableVertexAttribArray(a);
    gl.uniformMatrix4fv(gloc.uVP, false, VP);
    gl.uniform3fv(gloc.uEye, eye);
    gl.uniform1i(gloc.uTex, 0);
    gl.disable(gl.CULL_FACE);
    for (const p of list) {
      const m = gmeshes[p.mesh as GearMesh]!;
      gl.bindBuffer(gl.ARRAY_BUFFER, m.p);
      gl.enableVertexAttribArray(gloc.aP);
      gl.vertexAttribPointer(gloc.aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.n);
      gl.enableVertexAttribArray(gloc.aN);
      gl.vertexAttribPointer(gloc.aN, 3, gl.FLOAT, false, 0, 0);
      if (gloc.aUV >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, m.t);
        gl.enableVertexAttribArray(gloc.aUV);
        gl.vertexAttribPointer(gloc.aUV, 2, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, m.tex);
      gl.uniformMatrix4fv(gloc.uM, false, p.m);
      gl.uniformMatrix3fv(gloc.uNM, false, p.nm);
      gl.uniform3fv(gloc.uColor, p.color);
      gl.uniform1f(gloc.uKind, GEAR_KIND[p.mesh as GearMesh] ?? 0);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
    }
    if (gloc.aUV >= 0) gl.disableVertexAttribArray(gloc.aUV);
    gl.useProgram(prog);
    bound = "";
  };
  const drawProcedural = (parts: Part[], VP: Float32Array, eye: V3, time: number) => {
    gl.useProgram(prog);
    for (const a of bodyAttribs) if (a >= 0) gl.disableVertexAttribArray(a);
    gl.uniformMatrix4fv(loc.uVP, false, VP);
    gl.uniform3fv(loc.uEye, eye);
    gl.uniform1f(loc.uTime, time);
    bound = "";
    // i pezzi quasi trasparenti (la corda davanti all'occhio nella visuale dell'arciere) dopo, senza
    // scrivere la profondità: non devono nascondere quello che c'è dietro
    const late: Part[] = [];
    for (const p of parts) {
      if (p.alt === "real" && gearOk && gmeshes[p.mesh as GearMesh]) continue;
      if (p.alpha < 0.5) late.push(p);
      else one(p);
    }
    drawGear(parts, VP, eye);
    if (late.length) {
      gl.depthMask(false);
      for (const p of late) one(p);
      gl.depthMask(true);
    }
  };
  let style: 0 | 1 = 0;
  const bul = new Float32Array(64);
  const segRows = new Float32Array(63 * 4);
  const curlBuf = new Float32Array(32);
  const fingBuf = new Float32Array(16);
  const drawBody = (model: Model, VP: Float32Array, eye: V3, L: Layers, focus: Set<string> | null | undefined, time: number, sil = false) => {
    if (!body || !model.J || !model.hand) return;
    const meta = body.meta;
    const sd = sides(model.hand);
    const side = (i: number): "L" | "R" => (i === 15 ? "L" : "R");
    const pts = model.hud.pts;
    const aim = v3.sub(pts.bowWr, pts.drawWr);
    const grips = model.grip ? {
      hook: { side: side(sd.draw[2]), k: model.grip.draw, toward: pts.nock },
      wrap: { side: side(sd.bow[2]), k: model.grip.bow, toward: v3.add(pts.grip, v3.mul(v3.norm(aim), 0.05)), axis: model.bowAxis, dir: v3.norm(aim) },
    } : undefined;
    // le mani in presa si mettono sull'attrezzo: il pugno chiuso attorno all'impugnatura dell'arco e la piega
    // delle dita sulla corda alla cocca. Prima si guarda dove cade il «buco» delle dita piegate, poi si sposta
    // la mano (solo lei: l'avambraccio si allunga di pochi centimetri) perché cada proprio lì
    // dove guarda la testa, con l'inclinazione in su o in giù
    const pitch = model.headPitch ?? 0;
    const look: V3 | undefined = model.headF ? [model.headF[0] * Math.cos(pitch), -Math.sin(pitch), model.headF[2] * Math.cos(pitch)] : undefined;
    let J = model.J;
    if (grips) {
      const first = bodyMatrices(meta, J, look, grips, curlBuf, fingBuf, undefined, model.palms);
      J = seatHands(meta, J, first, [
        grips.wrap.k > 0.3 ? { side: grips.wrap.side, base: grips.wrap.side === "L" ? 33 : 54, at: pts.grip, hole: "wrap" as const } : null,
        grips.hook.k > 0.3 ? { side: grips.hook.side, base: grips.hook.side === "L" ? 33 : 54, at: pts.nock, hole: "hook" as const } : null,
      ]);
    }
    // ossa e muscoli restano quelli dell'atlante; la corporatura dell'arciere (aura: grasso, vestiti) è nella pelle
    const mats = bodyMatrices(meta, J, look, grips, curlBuf, fingBuf, undefined, model.palms);
    const skinMats = model.build ? bodyMatrices(meta, J, look, grips, undefined, undefined, model.build, model.palms) : mats;
    // matrici dei segmenti come tre righe ciascuna (la quarta è sempre 0 0 0 1)
    const nSeg = Math.min(21, meta.segments.length);
    const rows = (m: Float32Array) => {
      for (let i = 0; i < nSeg; i++) for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) segRows[(i * 3 + r) * 4 + c] = m[i * 16 + c * 4 + r];
    };
    rows(mats);
    const acts = new Map<string, number>();
    for (const p of model.parts) if (p.layer === "muscolo" && p.id) acts.set(p.id, Math.max(acts.get(p.id) ?? 0, p.act));
    const g = groupValues(meta, model.hand, acts, focus);
    flexValues(body.flex, J, g.act, bul);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(true);
    // arco, corda e freccia: dal modello semplice (senza scartare facce); non nella silhouette del corpo
    if (!sil) drawProcedural(model.parts.filter((p) => p.layer === "arco" && !focus), VP, eye, 0);
    gl.disableVertexAttribArray(loc.aP);
    gl.disableVertexAttribArray(loc.aN);
    gl.useProgram(bprog);
    for (const a of bodyAttribs) if (a >= 0) gl.enableVertexAttribArray(a);
    gl.uniformMatrix4fv(bl.uVP, false, VP);
    gl.uniform4fv(bl.uSeg, segRows);
    gl.uniform4fv(bl.uCurl, curlBuf);
    gl.uniform4fv(bl.uFa, fingBuf);
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
    gl.uniform1f(bl.uStyle, style);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fibTex);
    gl.uniform1i(bl.uFib, 1);
    gl.uniform1f(bl.uFibOn, fibReady && deriv ? 1 : 0);
    gl.uniform4fv(bl.uCut, cutNow);
    gl.activeTexture(gl.TEXTURE0);
    // le superfici del corpo sono chiuse e orientate verso l'esterno: le facce interne non si disegnano
    // (niente pieghe luccicanti dentro la pelle)
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    const skinRows = () => {
      if (skinMats === mats) return;
      rows(skinMats);
      gl.uniform4fv(bl.uSeg, segRows);
    };
    if (sil) {
      // aura della sagoma: solo la pelle, piena (alfa saturo), senza fusione: la silhouette per i calcoli
      skinRows();
      gl.disable(gl.BLEND);
      gl.colorMask(false, false, false, true);
      drawBodyLayer("skin", 0, 40);
      gl.colorMask(true, true, true, true);
      gl.enable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      for (const a of bodyAttribs) if (a >= 0) gl.disableVertexAttribArray(a);
      gl.useProgram(prog);
      bound = "";
      return;
    }
    if (L.osso) drawBodyLayer("bone", 1, 1);
    if (L.muscolo) drawBodyLayer("muscle", 2, 1);
    if (L.pelle) {
      skinRows();
      // pelle in due passate: solo profondità, poi il colore sulla superficie più esterna, sommato come vetro
      gl.colorMask(false, false, false, false);
      drawBodyLayer("skin", 0, 1);
      gl.colorMask(true, true, true, true);
      gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL);
      // su fondo scuro il velo della pelle si somma come vetro; su fondo chiaro si posa come un'ombra leggera
      gl.blendFunc(gl.SRC_ALPHA, style ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);
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
    /** stile della tavola: 0 = studio scuro, 1 = tavola chiara (cambia il velo della pelle) */
    setStyle(v: 0 | 1) {
      style = v;
    },
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
    /** l'arco e la freccia veri sono pronti (la vista ferma si ridisegna quando arrivano) */
    gearReady() {
      return gearReady && fibReady;
    },
    /** paglione, visuale e prato per la visuale dell'arciere */
    loadTarget,
    targetReady() {
      return Boolean(gmeshes.tgStraw && gmeshes.tgFace && gmeshes.ground);
    },
    /** aspetta l'arco e la freccia veri e il dettaglio dei muscoli (per le foto: un disegno solo, deve già averli) */
    async gearLoaded() {
      await Promise.all([loadGear(), Promise.race([fibLoaded, new Promise((r) => setTimeout(r, 4000))])]);
      return gearReady;
    },
    hasBody() {
      return Boolean(bodies.pieno || bodies.leggero);
    },
    /**
     * Aura della sagoma: la silhouette del corpo (solo pelle) vista con VP, W×H celle dall'alto in basso
     * (1 = corpo). Non si vede: serve a confrontarla con la silhouette dell'arciere nel video.
     */
    silhouette(model: Model, VP: Float32Array, eye: V3, W: number, H: number): Uint8Array | null {
      body = bodies.leggero ?? bodies.pieno ?? null;
      if (!body || !model.J || !model.hand) return null;
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      drawBody(model, VP, eye, { pelle: true, muscolo: false, osso: false }, null, 0, true);
      const px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const out = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) {
        const row = (H - 1 - y) * W;
        for (let x = 0; x < W; x++) out[y * W + x] = px[(row + x) * 4 + 3] > 60 ? 1 : 0;
      }
      return out;
    },
    clear(W: number, H: number) {
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    /** focus: id dei muscoli da mettere in evidenza (gli altri si spengono) */
    draw(model: Model, VP: Float32Array, eye: V3, time: number, L: Layers, focus?: Set<string> | null, fast = false, /** sfera attorno all'occhio da non disegnare (visuale dell'arciere) */ cut?: [number, number, number, number] | null) {
      cutNow[0] = cut?.[0] ?? 0;
      cutNow[1] = cut?.[1] ?? 0;
      cutNow[2] = cut?.[2] ?? 0;
      cutNow[3] = cut?.[3] ?? 0;
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
      disposedFib = true;
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
    const cf = curlFrame(meta, h.side);
    if (m < 0 || !cf) continue;
    const { K: k0, F, L, P } = cf;
    // a riposo i palmi guardano avanti (+z): le dita si piegano da quella parte
    // presa mediterranea: la cocca tra indice e medio, cioè un quarto della mano verso l'indice
    const ixR = meta.rest[h.side === "L" ? "19" : "20"];
    const pkR = meta.rest[h.side === "L" ? "17" : "18"];
    const toIndex: V3 = ixR && pkR ? v3.mul(v3.sub(ixR, pkR), 0.25) : [0, 0, 0];
    // mano dell'arco: il centro dell'impugnatura nella mano a riposo (vedi WRAP_GRIP in anatomy-body)
    const holeRest: V3 = h.hole === "wrap" ? (gripHole(meta, h.side) ?? k0) : v3.add(v3.add(v3.add(k0, v3.mul(F, L * 0.42)), v3.mul(P, 0.012)), toIndex);
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
