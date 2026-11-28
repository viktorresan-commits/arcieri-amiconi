/**
 * Disegno WebGL del modello anatomico (pelle di vetro, ossa, muscoli con fibre e tendini).
 * Usato dalla vista 3D dell'analisi e dalle immagini dei muscoli per le zone del corpo.
 */
import { v3, type GearMesh, type Model, type Part, type V3 } from "./anatomy-model";
import { bodyMatrices, curlFrame, gripHole, groupValues, type BodyBatch, type BodyData, type BodyLevel, type BodyMeta } from "./anatomy-body";
import { flexInfo, flexValues, skinWithMuscles, type FlexInfo } from "./anatomy-flex";
import { loadGlb } from "./glb-geo";
import { sides } from "./pose-analysis";
import { bowGrip, drawHook, freeHand, handLength, loadHandRig, placeApply, skinHand, type HandRig, type Placement, type RigHand } from "./hand-rig";
import { atlasSkinBones, bodyBones, loadSkinBody, loadSkinDetail, skinMesh, type SkinBody, type SkinMesh } from "./skin-body";
/** la grana della pelle si ripete 11 volte sul lato dell'immagine del corpo (circa 12 cm di pelle) */
const SKIN_DETAIL_K = 11;
/** sulle mani vere: la loro immagine è un ritaglio di 0,64 lati di quella del corpo, la stessa grana */
const HAND_DETAIL_K = 7;

export type Layers = { pelle: boolean; muscolo: boolean; osso: boolean; nervo?: boolean };

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
// mani vere al posto di quelle dell'atlante: segmenti del braccio (avambraccio, mano, dita, pollice; -9 = nessuno)
uniform vec4 uArmL; uniform vec4 uArmR;
varying vec3 vW; varying vec3 vN; varying vec2 vF; varying float vAct; varying float vFoc; varying float vTend; varying float vStr; varying float vGrp; varying vec3 vR; varying float vHide;
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
  float sg = w >= 0.5 ? aJ.x : aJ.y;
  vec4 dl = abs(vec4(sg) - uArmL); vec4 dr = abs(vec4(sg) - uArmR);
  vHide = min(min(dl.x, dl.y), min(dl.z, dl.w)) < 0.5 ? 1.0 : (min(min(dr.x, dr.y), min(dr.z, dr.w)) < 0.5 ? 2.0 : 0.0);
  vW = wp.xyz; vR = p; gl_Position = uVP * wp;
}`;
const BFS = `${PREC}
varying vec3 vW; varying vec3 vN; varying vec2 vF; varying float vAct; varying float vFoc; varying float vTend; varying float vStr; varying float vGrp; varying vec3 vR; varying float vHide;
uniform vec3 uEye; uniform float uLayer; uniform float uAlpha; uniform float uDim; uniform float uTime; uniform float uStyle;
// occhi (a riposo): centro dell'iride e raggio, asse dello sguardo; uOnlyEyes: delle ossa solo gli occhi
uniform vec4 uIrisL; uniform vec4 uIrisR; uniform vec3 uIrisAx; uniform float uOnlyEyes;
// tono della pelle vera (lineare): quello del personaggio della prova 3D o quello scelto nell'avatar
uniform vec3 uSkin;
// dettaglio del muscolo (immagine ripetuta lungo le fibre): R rilievo dei fasci, G chiaroscuro del tessuto, B fasce connettivali
uniform sampler2D uFib; uniform float uFibOn;
// taglio del braccio al polso della mano vera (normale verso la mano, distanza; normale nulla = niente)
uniform vec4 uClipL; uniform vec4 uClipR;
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
  if (vHide > 0.5 && vHide < 1.5 && dot(uClipL.xyz, uClipL.xyz) > 0.5 && dot(vW, uClipL.xyz) > uClipL.w) discard;
  if (vHide > 1.5 && dot(uClipR.xyz, uClipR.xyz) > 0.5 && dot(vW, uClipR.xyz) > uClipR.w) discard;
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
  if (uLayer > 3.5) {
    // nervi: cordoni giallo crema, lucidi, con le fibre in lungo appena accennate (come nelle tavole)
    float st = 0.92 + 0.08 * sin(vF.y * 6.2832 * 3.0) * sin(vF.x * 900.0);
    vec3 albN = vec3(0.80, 0.56, 0.09) * st;
    vec3 lightN = C1 * wrapL(N, L1, 0.4) + C2 * wrapL(N, L2, 0.5) + amb;
    col = albN * lightN * mix(1.0, 0.55, pow(1.0 - ndv, 1.5));
    col += C1 * (pow(max(dot(N, H), 0.0), 40.0) * 0.22) + C3 * pow(1.0 - ndv, 3.0) * max(0.0, dot(N, L3) + 0.2) * 0.2;
    gl_FragColor = vec4(tone(col), 1.0);
    return;
  }
  if (uLayer > 2.5) {
    // fondo sotto i muscoli: la parete interna del guscio della pelle (segnata nei dati, canale "tendine"), solo
    // quella lontana (le facce girate si scartano). Sta dietro i muscoli: si vede solo dove tra un muscolo e
    // l'altro resta uno spiraglio, carne in ombra invece del fondo dello studio
    // solo la parete vista di fronte: di taglio (lungo il contorno del corpo, fuori dai muscoli) faceva
    // macchie scure attorno alla sagoma
    if (vTend < 0.5 || vStr > 0.5 || abs(dot(N, V)) < 0.45) discard;
    col = vec3(0.075, 0.012, 0.012) * (C1 * max(dot(N, L1), 0.0) * 0.35 + amb);
    gl_FragColor = vec4(tone(col), 1.0);
    return;
  }
  if (uLayer < 0.5) {
    // pelle: un velo appena accennato che disegna il contorno del corpo, neutro (non più azzurro)
    float rim = pow(1.0 - ndv, 2.4);
    if (uStyle > 1.5) {
      // pelle vera, opaca: il tono della pelle del personaggio (prova 3D), con le sue piccole variazioni
      // (più calda e rosata a chiazze, appena più scura nelle pieghe) e la luce che passa sotto la pelle:
      // nelle ombre il rosso si spinge più avanti del verde e del blu, il bordo controluce si scalda
      // anche le facce girate (pieghe del gomito e della spalla, il taglio attorno all'occhio) sono pelle
      if (!gl_FrontFacing) { N = -N; ndv = clamp(dot(N, V), 0.0, 1.0); }
      vec3 q = vR * 100.0;
      float n1 = vnoise(q * 0.22) * 0.6 + vnoise(q * 0.65) * 0.4;
      float n2 = vnoise(q * 0.09 + 3.1);
      // un poco meno satura del colore puro: la curva della pellicola spegne il blu e la pelle virerebbe all'arancio
      vec3 alb = mix(vec3(dot(uSkin, vec3(0.2126, 0.7152, 0.0722))), uSkin, 0.85) * mix(0.9, 1.07, n1);
      alb = mix(alb, alb * vec3(1.1, 0.86, 0.82), smoothstep(0.5, 0.85, n2) * 0.4);
      float d1 = dot(N, L1);
      vec3 w = vec3(0.6, 0.32, 0.24);
      vec3 dif = max(vec3(0.0), (vec3(d1) + w) / (1.0 + w));
      vec3 light = C1 * dif * 0.82 + C2 * wrapL(N, L2, 0.35) + amb * 1.15;
      light += C3 * vec3(1.0, 0.55, 0.42) * pow(1.0 - ndv, 3.0) * wrapL(N, L3, 0.3) * 0.5;
      float nh = max(dot(N, H), 0.0);
      float F = 0.028 + 0.972 * pow(1.0 - ndv, 5.0);
      float sp = (pow(nh, 28.0) * 0.5 + pow(nh, 110.0) * 0.7) * F * step(0.0, d1);
      col = alb * light + C1 * sp;
      gl_FragColor = vec4(tone(col), 1.0);
      return;
    } else if (uStyle > 0.5) {
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
    // occhi: bianco della sclera (0,5 nel canale dei tendini) e iride (1) con pupilla, umidi e lucidi
    float eyeK = 0.0;
    if (vTend > 0.3) {
      eyeK = 1.0;
      vec4 ir = vR.x > 0.0 ? uIrisL : uIrisR;
      vec3 d = vR - ir.xyz;
      float rr = length(d - uIrisAx * dot(d, uIrisAx)) / max(ir.w, 1e-4);
      if (vTend > 0.8) {
        float ang = atan(d.y, d.x * sign(vR.x + 1e-5));
        float fibre = 0.5 + 0.5 * sin(ang * 46.0 + 3.0 * sin(ang * 7.0)) * (0.6 + 0.4 * sin(rr * 18.0));
        vec3 iris = mix(vec3(0.16, 0.085, 0.035), vec3(0.32, 0.20, 0.09), fibre * smoothstep(0.35, 0.75, rr));
        iris = mix(iris, vec3(0.05, 0.035, 0.025), smoothstep(0.82, 1.0, rr));
        alb = mix(vec3(0.012, 0.01, 0.01), iris, smoothstep(0.30, 0.38, rr));
      } else {
        alb = vec3(0.86, 0.83, 0.80) * mix(1.0, 0.93, smoothstep(0.012, 0.02, length(vR.yz - ir.yz)));
      }
    } else if (uOnlyEyes > 0.5) discard;
    float dif = wrapL(N, L1, 0.25);
    vec3 light = C1 * dif + C2 * wrapL(N, L2, 0.3) + amb;
    // luce che passa nell'osso sottile: un tepore nelle ombre
    vec3 sss = vec3(0.16, 0.08, 0.04) * (1.0 - dif) * (0.6 + 0.4 * blot);
    float spec = pow(max(dot(N, H), 0.0), 28.0) * 0.09 * (1.0 - poreA);
    float fres = pow(1.0 - ndv, 4.0) * 0.12;
    float rimL = pow(1.0 - ndv, 2.0) * max(0.0, dot(N, L3) + 0.3) * 0.35;
    col = alb * (light + sss) * mix(1.0, 0.62, pow(1.0 - ndv, 1.6)) + C1 * (spec + fres * dif) + C3 * rimL * 0.45;
    // superficie bagnata dell'occhio: riflesso stretto e brillante della luce
    col += C1 * eyeK * (pow(max(dot(N, H), 0.0), 90.0) * 0.9 + pow(1.0 - ndv, 3.0) * 0.08);
  } else {
    // muscoli: rosso carne con piccole differenze da un muscolo all'altro, il ventre un po' più chiaro;
    // fasci appena accennati e la lucentezza a seta lungo le fibre (come nei preparati anatomici),
    // tendini e aponeurosi bianco perla e lucidi
    float h = hash(vGrp);
    // rosso cremisi delle animazioni anatomiche (misurato sui video di riferimento: rosso con un filo di blu,
    // mai arancio), appena diverso da un gruppo all'altro
    vec3 alb = vec3(0.22, 0.024, 0.035) * (0.93 + 0.14 * h) * vec3(1.0, 1.0 + (hash(vGrp + 3.0) - 0.5) * 0.2, 1.0 + (hash(vGrp + 7.0) - 0.5) * 0.2);
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
    float fib = 1.0 - amp * (0.04 * groove - 0.025 * crown + (hh - 0.5) * 0.05);
    // righe chiare sottili lungo le fibre (come nelle animazioni: la luce che corre sui fasci)
    float streak = groove * amp * (0.55 + 0.45 * hh);
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
    vec3 work = vec3(0.48, 0.03, 0.04);
    alb = mix(alb, work, on * 0.85);
    if (vFoc > 0.5) { alb = vec3(0.46, 0.04, 0.05); on = 1.0; }
    else if (vFoc < -0.5) { alb = mix(alb, vec3(0.12, 0.09, 0.09), 0.5); on = 0.0; }
    // tendini e fasce: bianco avorio caldo (come nei preparati), lucidi
    vec3 tend = vec3(0.56, 0.50, 0.50);
    alb = mix(alb * fib, vec3(0.50, 0.24, 0.27), clamp(fascia * 2.6 + streak * 0.16, 0.0, 1.0));
    alb = mix(alb, tend, vTend * 0.9);
    // luce morbida (la carne lascia passare un po' di luce), bordi che si scuriscono tra un muscolo e l'altro
    ndv = clamp(dot(N, V), 0.0, 1.0);
    vec3 light = C1 * wrapL(N, L1, 0.45) + C2 * wrapL(N, L2, 0.5) + amb;
    float edge = mix(1.0, 0.5, pow(1.0 - ndv, 1.6));
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
    // riflessi della carne rossi (bianchi sembravano una patina rosata sul muscolo); bianchi solo sui tendini
    vec3 sheen = mix(vec3(1.0, 0.56, 0.62), vec3(1.0), vTend);
    col += C1 * sheen * (silk * (1.0 - 0.5 * vTend) + wet + vTend * pow(max(dot(N, H), 0.0), 24.0) * 0.12);
    // controluce: stacca il corpo dallo sfondo
    col += C3 * mix(vec3(1.0, 0.56, 0.62), vec3(1.0), vTend) * pow(1.0 - ndv, 3.0) * max(0.0, dot(N, L3) + 0.2) * 0.22;
    // muscolo che lavora: si accende dall'interno, piano
    float pulse = 0.85 + 0.15 * sin(uTime * 4.4);
    col += vec3(0.55, 0.04, 0.06) * on * (0.04 + 0.12 * pow(ndv, 2.0)) * pulse * (1.0 - vTend);
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

/* mani vere (personaggio Quaternius): già piegate e messe nel mondo dalla CPU, pelle come quella vera del corpo */
/** velo: quanto la pelle si allarga e quanto si avvicina all'occhio per la profondità (metri) */
const VEIL_INFLATE = 0.002;
const VEIL_BIAS = 0.02;
const HVS = `
attribute vec3 aP; attribute vec3 aN; attribute vec2 aUV; attribute vec3 aK;
uniform mat4 uVP; uniform float uUvScale;
// velo sopra i muscoli: la pelle un poco più fuori (uInflate) e, solo per la profondità, più vicina all'occhio
// lungo il suo raggio (uBias): sullo schermo resta dov'è e copre i muscoli che la passano di poco
uniform vec3 uEyeV; uniform float uBias; uniform float uInflate;
varying vec3 vW; varying vec3 vN; varying vec2 vUV; varying vec3 vK;
void main(){
  vW = aP; vN = aN; vUV = aUV * uUvScale; vK = aK;
  vec3 p = aP + aN * uInflate;
  if (uBias > 0.0) p += normalize(uEyeV - p) * uBias;
  gl_Position = uVP * vec4(p, 1.0);
}`;
const HFS = `${PREC}
varying vec3 vW; varying vec3 vN; varying vec2 vUV;
// x: occlusione (pieghe, solchi tra i muscoli; 1 = all'aperto), y: quanto conta il chiaroscuro dipinto,
// z: quanto conta la foto del viso (testa nuova: colori veri, portati al tono di pelle scelto)
varying vec3 vK;
uniform vec3 uFaceSkin;
// 1 = quanto è stoffa viene dai vertici (k.z negativo, levigato): bordo dei pantaloncini liscio
uniform float uClothV;
uniform vec3 uEye; uniform vec3 uSkin; uniform sampler2D uTex; uniform float uMeanL; uniform float uTexOn; uniform vec4 uCut;
// 1 = colore dell'immagine così com'è (occhi); 0 = tono della pelle scelta con le luci dell'immagine
uniform float uRaw;
// il pezzo d'avambraccio della mano vera finisce dentro quello della sagoma (niente bordo frastagliato)
uniform vec4 uBack;
// grana della pelle (dal pacchetto pelle): r = luce, g = ruvidità, b = rossore (0,5 neutri) e normal map,
// ripetute sulla pelle ogni uDetK lati dell'immagine
uniform sampler2D uDet; uniform sampler2D uDnm; uniform float uDetOn; uniform float uDetK;
// rilievo del corpo dalle tavole (addominali, dorsali, vene): normal map nello spazio delle uv del corpo
uniform sampler2D uRil; uniform float uRilOn;
// pelle vera sopra muscoli e ossa: trasparente al centro, piena sul contorno (si vede dove finisce il corpo)
uniform float uVeil;
vec3 tone(vec3 c){ c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0); return pow(c, vec3(1.0 / 2.2)); }
float wrapL(vec3 N, vec3 L, float w){ return max(0.0, (dot(N, L) + w) / (1.0 + w)); }
void main(){
  if (uCut.w > 0.0 && distance(vW, uCut.xyz) < uCut.w) discard;
  if (dot(uBack.xyz, uBack.xyz) > 0.5 && dot(vW, uBack.xyz) < uBack.w) discard;
  vec3 N = normalize(vN); vec3 V = normalize(uEye - vW);
  if (!gl_FrontFacing) N = -N;
  float dL = 0.0; float dR = 0.0; float dS = 0.0;
#ifdef HAS_DERIV
  if (uDetOn > 0.5 && uRaw < 0.5) {
    vec2 uv = vUV * uDetK;
    vec2 du = dFdx(uv); vec2 dv = dFdy(uv);
    // da vicino i pori e il rilievo fine; da lontano spariscono piano (niente sfarfallio)
    float far = max(length(du), length(dv)) * 512.0;
    float near = 1.0 - smoothstep(1.5, 9.0, far);
    vec3 dt = texture2D(uDet, uv).rgb - 0.5;
    vec3 nm = texture2D(uDnm, uv).rgb * 2.0 - 1.0;
    // base tangente dalla superficie stessa (niente tangenti nei vertici)
    vec3 p = vW * 100.0;
    vec3 dp1 = dFdx(p); vec3 dp2 = dFdy(p);
    vec3 dp2p = cross(dp2, N); vec3 dp1p = cross(N, dp1);
    vec3 T = dp2p * du.x + dp1p * dv.x;
    vec3 B = dp2p * du.y + dp1p * dv.y;
    float im = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-20));
    N = normalize(N + (T * nm.x + B * nm.y) * im * 1.3 * near);
    if (uRilOn > 0.5) {
      vec2 rn = texture2D(uRil, vUV).rg * 2.0 - 1.0;
      N = normalize(N + (T * rn.x + B * rn.y) * im * 0.85);
    }
    // la stessa grana più larga (circa 3,5 volte): macchie e rossori che si vedono anche da lontano
    vec3 dc = texture2D(uDet, vUV * uDetK * 0.29 + vec2(0.37, 0.61)).rgb - 0.5;
    dL = dt.r * 0.9 + dc.r * 0.55; dR = dt.b * 0.9 + dc.b * 0.8; dS = dt.g;
  }
#endif
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec3 Rt = normalize(cross(vec3(0.0, 1.0, 0.0), V) + vec3(1e-4, 0.0, 0.0)); vec3 Up = cross(V, Rt);
  vec3 L1 = normalize(-0.5 * Rt + 0.75 * Up + 0.55 * V); vec3 C1 = vec3(1.0, 0.95, 0.88) * 1.9;
  vec3 L2 = normalize(0.8 * Rt + 0.1 * Up + 0.45 * V); vec3 C2 = vec3(0.70, 0.80, 1.0) * 0.45;
  vec3 L3 = normalize(0.3 * Rt + 0.45 * Up - 0.85 * V); vec3 C3 = vec3(0.95, 0.97, 1.0);
  vec3 amb = mix(vec3(0.12, 0.10, 0.09), vec3(0.24, 0.26, 0.30), 0.5 + 0.5 * N.y);
  vec3 H = normalize(L1 + V);
  // il colore è quello della pelle scelta; dall'immagine della pelle del personaggio solo luci e ombre
  // dipinte (nocche, unghie, pieghe)
  vec3 alb = mix(vec3(dot(uSkin, vec3(0.2126, 0.7152, 0.0722))), uSkin, 0.85);
  if (uTexOn > 0.5) {
    vec3 tx = texture2D(uTex, vUV).rgb;
    if (uRaw > 0.5) {
      alb = pow(tx, vec3(2.2)) * 0.9;
    } else {
      float lt = dot(tx, vec3(0.2126, 0.7152, 0.0722));
      float l = lt / uMeanL;
      // dove la forma viene dall'atlante (muscoli veri) il chiaroscuro dipinto del personaggio conta poco
      alb *= mix(1.0, clamp(l, 0.55, 1.35), 0.75 * vK.y);
      // un poco del colore dipinto (labbra, guance) sul tono scelto
      vec3 hue = tx / max(lt, 0.05);
      // dove la forma viene dall'atlante il colore dipinto del personaggio conta meno (attacco con la testa nuova)
      alb = mix(alb, alb * clamp(hue, 0.6, 1.6), 0.35 * (0.35 + 0.65 * vK.y));
      // la grana della pelle vera: pori, lentiggini, macchioline appena più rosse
      alb *= (1.0 + dL) * vec3(1.0 + dR * 0.5, 1.0 - dR * 0.12, 1.0 - dR * 0.25);
      // i pantaloncini del personaggio (grigi, senza colore) restano stoffa: grigio scuro
      float mx = max(tx.r, max(tx.g, tx.b));
      float sat = (mx - min(tx.r, min(tx.g, tx.b))) / max(mx, 1e-3);
      float face = max(vK.z, 0.0);
      float cloth = (1.0 - smoothstep(0.07, 0.15, sat)) * (1.0 - face);
      if (uClothV > 0.5) {
        // bordo dove la stoffa vale metà, sottile quanto un punto dello schermo
        float cv = max(-vK.z, 0.0);
        float aa = 0.06;
#ifdef HAS_DERIV
        aa = clamp(fwidth(cv) * 1.5, 0.01, 0.2);
#endif
        cloth = smoothstep(0.5 - aa, 0.5 + aa, cv);
      }
      // stoffa quasi uniforme: le chiazze dell'immagine del personaggio sui pantaloncini si vedevano come toppe
      alb = mix(alb, vec3(0.06, 0.065, 0.075) * (uClothV > 0.5 ? 0.82 + 0.36 * lt : 0.6 + 0.8 * lt) * (1.0 + dL * 0.6), cloth);
      // viso: i colori della foto; la pelle (colorata) prende il tono scelto, bianco degli occhi e capelli restano
      if (face > 0.001) {
        vec3 fl = pow(tx, vec3(2.2));
        float fm = max(fl.r, max(fl.g, fl.b));
        float fs = (fm - min(fl.r, min(fl.g, fl.b))) / max(fm, 1e-3);
        vec3 fa = fl * mix(vec3(1.0), uSkin / max(uFaceSkin, vec3(1e-3)), smoothstep(0.2, 0.4, fs));
        // stessa saturazione del corpo (che parte dal tono scelto appena desaturato)
        fa = mix(vec3(dot(fa, vec3(0.2126, 0.7152, 0.0722))), fa, 0.85);
        alb = mix(alb, fa * (1.0 + dL * 0.5), face);
      }
    }
  }
  float d1 = dot(N, L1);
  vec3 w = vec3(0.6, 0.32, 0.24);
  vec3 dif = max(vec3(0.0), (vec3(d1) + w) / (1.0 + w));
  // occlusione: piena sulla luce diffusa del cielo, a metà su quella diretta (le pieghe restano morbide)
  float ao = vK.x;
  vec3 light = C1 * dif * 0.82 * mix(1.0, ao, 0.45) + C2 * wrapL(N, L2, 0.35) * ao + amb * 1.15 * ao;
  light += C3 * vec3(1.0, 0.55, 0.42) * pow(1.0 - ndv, 3.0) * wrapL(N, L3, 0.3) * 0.5;
  float nh = max(dot(N, H), 0.0);
  float F = 0.028 + 0.972 * pow(1.0 - ndv, 5.0);
  float sp = (pow(nh, 28.0) * 0.5 + pow(nh, 110.0) * 0.7) * F * step(0.0, d1);
  // dove la pelle è più ruvida il lucido si spegne, dove è liscia brilla un poco di più
  sp *= clamp(1.0 - dS * 1.5, 0.4, 1.7) * ao;
  float va = uVeil > 0.0 ? clamp(uVeil + (1.0 - uVeil) * pow(1.0 - ndv, 2.4), 0.0, 1.0) : 1.0;
  vec3 oc = alb * light + C1 * sp;
  if (uVeil > 0.0) {
    // sopra muscoli e ossa la pelle diventa vetro grigio chiaro, come nelle animazioni anatomiche: disegna la
    // forma del corpo senza tingere di arancio il rosso dei muscoli
    float lum = dot(light, vec3(0.3, 0.5, 0.2));
    oc = mix(oc, vec3(0.40, 0.43, 0.48) * (0.35 + 0.45 * lum) + C3 * pow(1.0 - ndv, 3.0) * 0.4 + C1 * sp, 0.85);
  }
  gl_FragColor = vec4(tone(oc), va);
}`;

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


/** occhi dell'atlante a riposo: centro e raggio dell'iride (canale dei tendini delle ossa = 1) e asse dello sguardo */
function irisInfo(data: BodyData) {
  const { meta } = data;
  const dv = new DataView(data.buf);
  const acc = { L: [0, 0, 0, 0], R: [0, 0, 0, 0] };
  const pts: { L: number[][]; R: number[][] } = { L: [], R: [] };
  const ax = [0, 0, 0];
  for (const b of meta.batches) {
    if (b.layer !== "bone") continue;
    for (let v = 0; v < b.vertices; v++) {
      const o = b.vOffset + v * meta.stride;
      if (dv.getUint8(o + 15) < 200) continue;
      const p = [0, 1, 2].map((k) => meta.lo[k] + (dv.getUint16(o + k * 2, true) / 65535) * (meta.hi[k] - meta.lo[k]));
      const s = p[0] > 0 ? "L" : "R";
      for (let k = 0; k < 3; k++) acc[s][k] += p[k];
      acc[s][3]++;
      pts[s].push(p);
      for (let k = 0; k < 3; k++) ax[k] += dv.getInt8(o + 6 + k) / 127;
    }
  }
  const out = (s: "L" | "R") => {
    const n = Math.max(1, acc[s][3]);
    const c = [acc[s][0] / n, acc[s][1] / n, acc[s][2] / n];
    let r = 0;
    for (const p of pts[s]) r = Math.max(r, Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]));
    return new Float32Array([c[0], c[1], c[2], acc[s][3] ? r * 0.95 : 0]);
  };
  const al = Math.hypot(ax[0], ax[1], ax[2]) || 1;
  return { L: out("L"), R: out("R"), ax: new Float32Array(al > 1e-6 ? [ax[0] / al, ax[1] / al, ax[2] / al] : [0, 0, 1]) };
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
  const gl = canvas.getContext("webgl", { antialias: true, premultipliedAlpha: false, alpha: true, preserveDrawingBuffer: keep, stencil: true });
  if (!gl) return null;
  // stencil per il velo della pelle (dove non c'è, il velo resta com'era)
  const hasStencil = Boolean(gl.getContextAttributes()?.stencil);
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
    uSkin: gl.getUniformLocation(bprog, "uSkin"),
    uBul: gl.getUniformLocation(bprog, "uBul"),
    uLayerV: gl.getUniformLocation(bprog, "uLayerV"),
    uIrisL: gl.getUniformLocation(bprog, "uIrisL"),
    uIrisR: gl.getUniformLocation(bprog, "uIrisR"),
    uIrisAx: gl.getUniformLocation(bprog, "uIrisAx"),
    uOnlyEyes: gl.getUniformLocation(bprog, "uOnlyEyes"),
    uTime: gl.getUniformLocation(bprog, "uTime"),
    uCurl: gl.getUniformLocation(bprog, "uCurl"),
    uFa: gl.getUniformLocation(bprog, "uFa"),
    uDita: gl.getUniformLocation(bprog, "uDita"),
    uArmL: gl.getUniformLocation(bprog, "uArmL"),
    uArmR: gl.getUniformLocation(bprog, "uArmR"),
    uClipL: gl.getUniformLocation(bprog, "uClipL"),
    uClipR: gl.getUniformLocation(bprog, "uClipR"),
    uFib: gl.getUniformLocation(bprog, "uFib"),
    uCut: gl.getUniformLocation(bprog, "uCut"),
    uFibOn: gl.getUniformLocation(bprog, "uFibOn"),
  };
  // ---- mani vere (pelle opaca) ----
  const hprog = gl.createProgram()!;
  gl.attachShader(hprog, sh(gl.VERTEX_SHADER, HVS));
  gl.attachShader(hprog, sh(gl.FRAGMENT_SHADER, deriv ? "#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n" + HFS : HFS));
  gl.linkProgram(hprog);
  const handOk = Boolean(gl.getProgramParameter(hprog, gl.LINK_STATUS));
  const hl = {
    aP: gl.getAttribLocation(hprog, "aP"),
    aN: gl.getAttribLocation(hprog, "aN"),
    aUV: gl.getAttribLocation(hprog, "aUV"),
    aK: gl.getAttribLocation(hprog, "aK"),
    uFaceSkin: gl.getUniformLocation(hprog, "uFaceSkin"),
    uClothV: gl.getUniformLocation(hprog, "uClothV"),
    uUvScale: gl.getUniformLocation(hprog, "uUvScale"),
    uRil: gl.getUniformLocation(hprog, "uRil"),
    uRilOn: gl.getUniformLocation(hprog, "uRilOn"),
    uVP: gl.getUniformLocation(hprog, "uVP"),
    uEye: gl.getUniformLocation(hprog, "uEye"),
    uSkin: gl.getUniformLocation(hprog, "uSkin"),
    uTex: gl.getUniformLocation(hprog, "uTex"),
    uMeanL: gl.getUniformLocation(hprog, "uMeanL"),
    uTexOn: gl.getUniformLocation(hprog, "uTexOn"),
    uCut: gl.getUniformLocation(hprog, "uCut"),
    uBack: gl.getUniformLocation(hprog, "uBack"),
    uRaw: gl.getUniformLocation(hprog, "uRaw"),
    uDet: gl.getUniformLocation(hprog, "uDet"),
    uDnm: gl.getUniformLocation(hprog, "uDnm"),
    uDetOn: gl.getUniformLocation(hprog, "uDetOn"),
    uDetK: gl.getUniformLocation(hprog, "uDetK"),
    uVeil: gl.getUniformLocation(hprog, "uVeil"),
    uEyeV: gl.getUniformLocation(hprog, "uEyeV"),
    uBias: gl.getUniformLocation(hprog, "uBias"),
    uInflate: gl.getUniformLocation(hprog, "uInflate"),
  };
  // grana della pelle (pacchetto pelle): due immagini piccole che si ripetono, con le mipmap
  const detTex = gl.createTexture();
  const dnmTex = gl.createTexture();
  let detOn = false;
  const upRepeat = (t: WebGLTexture | null, im: HTMLImageElement) => {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
  };
  const detLoaded: Promise<unknown> = !(handOk && deriv)
    ? Promise.resolve()
    : loadSkinDetail().then((d) => {
      if (!d || disposed) return;
      upRepeat(detTex, d.det);
      upRepeat(dnmTex, d.nrm);
      detOn = true;
    });
  /** la grana sulla pelle: k = quante volte si ripete sul lato dell'immagine della pelle */
  const bindDetail = (k: number) => {
    gl.uniform1f(hl.uDetOn, detOn ? 1 : 0);
    gl.uniform1f(hl.uDetK, k);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, detTex);
    gl.uniform1i(hl.uDet, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, dnmTex);
    gl.uniform1i(hl.uDnm, 3);
    gl.activeTexture(gl.TEXTURE0);
  };
  // corpo intero del personaggio (pelle chiusa) e i suoi occhi
  let skinBody: SkinBody | null = null;
  const bodyTex = gl.createTexture();
  const eyeTex = gl.createTexture();
  const headTex = gl.createTexture();
  const reliefTex = gl.createTexture();
  let reliefOn = false;
  type MeshGpu = { pos: WebGLBuffer; nrm: WebGLBuffer; uv: WebGLBuffer; k: WebGLBuffer; ib: WebGLBuffer; count: number; p: Float32Array; n: Float32Array; m: SkinMesh; /** senza la testa (visuale dall'occhio) */ ibNoHead?: WebGLBuffer; countNoHead?: number };
  let bodyGpu: { body: MeshGpu; eyes: MeshGpu } | null = null;
  const upTex = (t: WebGLTexture | null, im: HTMLImageElement) => {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
    // immagine grande (viso dalla foto) vista da lontano: con le mipmap niente sfarfallio di occhi e sopracciglia
    const pot = (v: number) => v > 0 && (v & (v - 1)) === 0;
    if (pot(im.width) && pot(im.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  let rig: HandRig | null = null;
  const handTex = gl.createTexture();
  type HandGpu = { pos: WebGLBuffer; nrm: WebGLBuffer; uv: WebGLBuffer; ib: WebGLBuffer; count: number; p: Float32Array; n: Float32Array };
  const handGpu: Partial<Record<"L" | "R", HandGpu>> = {};
  const meshGpu = (m: SkinMesh): MeshGpu => {
    const mk = (data: ArrayBufferView, target: number, usage: number) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, usage);
      return b;
    };
    return { pos: mk(new Float32Array(m.n * 3), gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW), nrm: mk(new Float32Array(m.n * 3), gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW), uv: mk(m.uv, gl.ARRAY_BUFFER, gl.STATIC_DRAW), k: mk(m.k, gl.ARRAY_BUFFER, gl.STATIC_DRAW), ib: mk(m.idx, gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW), count: m.idx.length, p: new Float32Array(m.n * 3), n: new Float32Array(m.n * 3), m };
  };
  const skinLoaded: Promise<unknown> = !handOk
    ? Promise.resolve()
    : loadSkinBody().then((b) => {
      if (!b || disposed) return;
      skinBody = b;
      bodyGpu = { body: meshGpu(b.body), eyes: meshGpu(b.eyes) };
      poseN = 0;
      // dall'occhio dell'arciere la testa non si disegna: i triangoli della testa (osso Head) si tolgono
      const hi = b.names.indexOf("Head");
      const m = b.body;
      const headW = (v: number) => {
        let w = 0;
        for (let k = 0; k < 4; k++) if (m.jo[v * 4 + k] === hi) w += m.wt[v * 4 + k];
        return w;
      };
      const keep: number[] = [];
      const end = m.headStart ?? m.idx.length;
      for (let t = 0; t < end; t += 3) if (headW(m.idx[t]) < 0.5 && headW(m.idx[t + 1]) < 0.5 && headW(m.idx[t + 2]) < 0.5) keep.push(m.idx[t], m.idx[t + 1], m.idx[t + 2]);
      const ib = gl.createBuffer()!;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(keep), gl.STATIC_DRAW);
      bodyGpu.body.ibNoHead = ib;
      bodyGpu.body.countNoHead = keep.length;
      if (b.image) upTex(bodyTex, b.image);
      if (b.eyeImage) upTex(eyeTex, b.eyeImage);
      if (b.reliefImage) {
        upTex(reliefTex, b.reliefImage);
        reliefOn = true;
      }
      if (b.headImage) {
        upTex(headTex, b.headImage);
        // la giunta delle uv della testa è dietro: l'immagine si ripete in orizzontale
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      }
    });
  const rigLoaded: Promise<unknown> = !handOk
    ? Promise.resolve()
    : loadHandRig().then((r) => {
      if (!r || disposed) return;
      rig = r;
      for (const s of ["L", "R"] as const) {
        const h = r[s];
        const mk = (data: ArrayBufferView, target: number, usage: number) => {
          const b = gl.createBuffer()!;
          gl.bindBuffer(target, b);
          gl.bufferData(target, data, usage);
          return b;
        };
        handGpu[s] = { pos: mk(new Float32Array(h.n * 3), gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW), nrm: mk(new Float32Array(h.n * 3), gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW), uv: mk(h.uv, gl.ARRAY_BUFFER, gl.STATIC_DRAW), ib: mk(h.idx, gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW), count: h.idx.length, p: new Float32Array(h.n * 3), n: new Float32Array(h.n * 3) };
      }
      if (r.image) {
        gl.bindTexture(gl.TEXTURE_2D, handTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, r.image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
    });
  /** la pelle in posa si carica solo quando è cambiata (una volta anche se si disegna in più passate) */
  const dirty = new Set<MeshGpu>();
  /**
   * la posa dell'ultima pelle calcolata (segmenti, mani, gonfiore, gomiti): se non cambia (video fermo e si gira
   * attorno, o la stessa immagine del video per più fotogrammi dello schermo) la pelle non si ricalcola né si
   * ricarica. Prima si ricalcolava e si ricaricava (quasi 800 kB) a ogni fotogramma.
   */
  let poseSig = new Float32Array(0);
  let poseN = 0;
  let poseScratch = new Float32Array(2048);
  let samePose = false;
  let poseMeta: BodyMeta | null = null;
  const drawMesh = (g: MeshGpu, tex: WebGLTexture | null, texOn: boolean, raw: boolean, meanL: number, noHead = false, /** solo questi indici (inizio, quanti) e uv × scala */ range?: [number, number, number], relief = false) => {
    gl.uniform1f(hl.uUvScale, range ? range[2] : 1);
    gl.uniform1f(hl.uRilOn, relief && reliefOn ? 1 : 0);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, reliefTex);
    gl.uniform1i(hl.uRil, 4);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(hl.uMeanL, meanL);
    gl.uniform1f(hl.uTexOn, texOn ? 1 : 0);
    gl.uniform1f(hl.uRaw, raw ? 1 : 0);
    gl.uniform4fv(hl.uBack, [0, 0, 0, 0]);
    bindDetail(SKIN_DETAIL_K);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(hl.uTex, 0);
    const up = dirty.delete(g);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.pos);
    if (up) gl.bufferSubData(gl.ARRAY_BUFFER, 0, g.p);
    gl.enableVertexAttribArray(hl.aP);
    gl.vertexAttribPointer(hl.aP, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.nrm);
    if (up) gl.bufferSubData(gl.ARRAY_BUFFER, 0, g.n);
    gl.enableVertexAttribArray(hl.aN);
    gl.vertexAttribPointer(hl.aN, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.uv);
    if (hl.aUV >= 0) {
      gl.enableVertexAttribArray(hl.aUV);
      gl.vertexAttribPointer(hl.aUV, 2, gl.FLOAT, false, 0, 0);
    }
    if (hl.aK >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, g.k);
      gl.enableVertexAttribArray(hl.aK);
      gl.vertexAttribPointer(hl.aK, 3, gl.FLOAT, false, 0, 0);
    }
    const useNo = noHead && g.ibNoHead && g.countNoHead;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, useNo ? g.ibNoHead! : g.ib);
    if (useNo) gl.drawElements(gl.TRIANGLES, g.countNoHead!, gl.UNSIGNED_SHORT, 0);
    else if (range) gl.drawElements(gl.TRIANGLES, range[1], gl.UNSIGNED_SHORT, range[0] * 2);
    else gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_SHORT, 0);
  };
  /** pelle vera chiusa: il corpo del personaggio mosso dai segmenti e dalle mani vere */
  const flexBuf: [number, number] = [0, 0];
  const drawSkinBody = (meta: BodyMeta, skinMats: Float32Array, hands: RigPose[], VP: Float32Array, eye: V3, J: Record<number, V3>, /** sopra muscoli e ossa: trasparenza al centro (0 = pelle piena) */ veil = 0, /** muscoli e ossa segnati nello stencil (1) */ masked = false) => {
    if (!skinBody || !bodyGpu) return false;
    // gomito chiuso (la mano della corda alla bocca): quel braccio torna alla forma del personaggio, che si piega bene
    for (const [k, [a, b, c]] of [[0, [11, 13, 15]], [1, [12, 14, 16]]] as const) {
      const sh = J[a];
      const el = J[b];
      const wr = J[c];
      if (!sh || !el || !wr) {
        flexBuf[k] = 0;
        continue;
      }
      const cos = v3.dot(v3.norm(v3.sub(el, sh)), v3.norm(v3.sub(wr, el)));
      const deg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
      const t = Math.max(0, Math.min(1, (deg - 55) / 60));
      flexBuf[k] = t * t * (3 - 2 * t);
    }
    const hp = hands.map((h) => ({ side: h.side, pl: h.pl, bones: h.bones }));
    // la posa in fila, per vedere se è cambiata
    let n = 0;
    const put = (v: number) => {
      if (n >= poseScratch.length) {
        const g = new Float32Array(poseScratch.length * 2);
        g.set(poseScratch);
        poseScratch = g;
      }
      poseScratch[n++] = v;
    };
    for (let i = 0; i < skinMats.length; i++) put(skinMats[i]);
    for (let i = 0; i < bul.length; i++) put(bul[i]);
    put(flexBuf[0]);
    put(flexBuf[1]);
    for (const h of hp) {
      put(h.side === "L" ? 1 : 2);
      for (const v of h.pl.m) put(v);
      for (const v of h.pl.t) put(v);
      for (const b of h.bones) {
        for (const v of b.r) put(v);
        for (const v of b.t) put(v);
      }
    }
    samePose = n === poseN && poseSig.length >= n && meta === poseMeta;
    for (let i = 0; samePose && i < n; i++) if (poseSig[i] !== poseScratch[i]) samePose = false;
    if (!samePose) {
      if (poseSig.length < n) poseSig = new Float32Array(poseScratch.length);
      poseSig.set(poseScratch.subarray(0, n));
      poseN = n;
      poseMeta = meta;
      dirty.add(bodyGpu.body);
      dirty.add(bodyGpu.eyes);
      // pelle mossa dall'atlante: gli stessi segmenti (e matrici) di muscoli e ossa, così resta sopra di loro
      const bones = skinBody.atlasRig ? atlasSkinBones(meta, skinBody, skinMats, hp) : bodyBones(meta, skinBody, skinMats, hp);
      // la pelle si gonfia con i muscoli che lavorano (gli stessi valori del corpo dell'atlante)
      skinMesh(bodyGpu.body.m, bones, bodyGpu.body.p, bodyGpu.body.n, bul, skinBody.atlasRig ? null : flexBuf);
      if (!skinBody.hideEyes) skinMesh(bodyGpu.eyes.m, skinBody.atlasRig ? bodyBones(meta, skinBody, skinMats, hp) : bones, bodyGpu.eyes.p, bodyGpu.eyes.n);
    }
    gl.useProgram(hprog);
    gl.uniformMatrix4fv(hl.uVP, false, VP);
    gl.uniform3fv(hl.uEye, eye);
    gl.uniform3fv(hl.uEyeV, eye);
    gl.uniform1f(hl.uBias, 0);
    gl.uniform1f(hl.uInflate, 0);
    gl.uniform3fv(hl.uSkin, skinLin);
    gl.uniform4fv(hl.uCut, cutNow);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(true);
    const fromEye = cutNow[3] > 0;
    gl.uniform3fv(hl.uFaceSkin, skinBody.faceSkin);
    gl.uniform1f(hl.uClothV, skinBody.clothV ? 1 : 0);
    const hs = bodyGpu.body.m.headStart;
    const skinPass = () => {
      if (hs != null && skinBody!.headImage) {
        // corpo con la sua immagine, testa nuova con la foto del viso (dall'occhio dell'arciere la testa non c'è)
        drawMesh(bodyGpu!.body, bodyTex, Boolean(skinBody!.image), false, skinBody!.meanLuma, fromEye, [0, hs, 1], true);
        if (!fromEye) drawMesh(bodyGpu!.body, headTex, true, false, skinBody!.meanLuma, false, [hs, bodyGpu!.body.count - hs, skinBody!.headUvScale]);
      } else drawMesh(bodyGpu!.body, bodyTex, Boolean(skinBody!.image), false, skinBody!.meanLuma, fromEye, undefined, true);
    };
    gl.uniform1f(hl.uVeil, 0);
    if (veil > 0) {
      // velo: prima solo la profondità della pelle, poi il colore della superficie più vicina sopra muscoli e ossa
      // (una sola pelle, niente strati sovrapposti)
      gl.colorMask(false, false, false, false);
      skinPass();
      gl.colorMask(true, true, true, true);
      gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(hl.uVeil, veil);
      // la pelle segue i muscoli a meno di qualche millimetro: dove un muscolo la passa (spalla in trazione,
      // gomito chiuso) il velo lo copre lo stesso. Solo sopra muscoli e ossa (stencil 1): arco, freccia e corda
      // vicini alla pelle restano davanti
      gl.uniform1f(hl.uInflate, VEIL_INFLATE);
      if (masked) {
        gl.enable(gl.STENCIL_TEST);
        gl.stencilMask(0);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        gl.stencilFunc(gl.EQUAL, 1, 0xff);
        gl.uniform1f(hl.uBias, VEIL_BIAS);
        skinPass();
        gl.uniform1f(hl.uBias, 0);
        gl.stencilFunc(gl.NOTEQUAL, 1, 0xff);
        skinPass();
        gl.disable(gl.STENCIL_TEST);
        gl.stencilMask(0xff);
      } else skinPass();
      gl.uniform1f(hl.uInflate, 0);
      gl.uniform1f(hl.uVeil, 0);
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    } else skinPass();
    gl.uniform1f(hl.uClothV, 0);
    // occhi del personaggio solo se la testa non ha la foto del viso
    if (!fromEye && !skinBody.hideEyes) drawMesh(bodyGpu.eyes, eyeTex, Boolean(skinBody.eyeImage), true, 0.5);
    gl.disableVertexAttribArray(hl.aP);
    gl.disableVertexAttribArray(hl.aN);
    if (hl.aUV >= 0) gl.disableVertexAttribArray(hl.aUV);
    if (hl.aK >= 0) gl.disableVertexAttribArray(hl.aK);
    gl.enable(gl.BLEND);
    gl.useProgram(prog);
    bound = "";
    return true;
  };
  const drawHands = (hands: RigPose[], VP: Float32Array, eye: V3, back: Partial<Record<"L" | "R", number[]>>) => {
    if (!rig || !hands.length) return;
    gl.useProgram(hprog);
    gl.uniformMatrix4fv(hl.uVP, false, VP);
    gl.uniform3fv(hl.uEye, eye);
    gl.uniform3fv(hl.uSkin, skinLin);
    gl.uniform1f(hl.uMeanL, rig.meanLuma);
    gl.uniform1f(hl.uTexOn, rig.image ? 1 : 0);
    gl.uniform1f(hl.uRaw, 0);
    bindDetail(HAND_DETAIL_K);
    gl.uniform1f(hl.uUvScale, 1);
    gl.uniform1f(hl.uRilOn, 0);
    gl.uniform1f(hl.uVeil, 0);
    // le mani vere da sole: niente occlusione cotta, chiaroscuro dipinto pieno
    if (hl.aK >= 0) {
      gl.disableVertexAttribArray(hl.aK);
      gl.vertexAttrib3f(hl.aK, 1, 1, 0);
    }
    gl.uniform4fv(hl.uCut, cutNow);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, handTex);
    gl.uniform1i(hl.uTex, 0);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(true);
    for (const hp of hands) {
      const g = handGpu[hp.side];
      const h = rig[hp.side];
      if (!g) continue;
      skinHand(h, hp.bones, hp.pl, g.p, g.n);
      gl.uniform4fv(hl.uBack, back[hp.side] ?? [0, 0, 0, 0]);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.pos);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, g.p);
      gl.enableVertexAttribArray(hl.aP);
      gl.vertexAttribPointer(hl.aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.nrm);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, g.n);
      gl.enableVertexAttribArray(hl.aN);
      gl.vertexAttribPointer(hl.aN, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.uv);
      if (hl.aUV >= 0) {
        gl.enableVertexAttribArray(hl.aUV);
        gl.vertexAttribPointer(hl.aUV, 2, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ib);
      gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.disableVertexAttribArray(hl.aP);
    gl.disableVertexAttribArray(hl.aN);
    if (hl.aUV >= 0) gl.disableVertexAttribArray(hl.aUV);
    gl.enable(gl.BLEND);
    gl.useProgram(prog);
    bound = "";
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
  type GpuBody = { meta: BodyMeta; flex: FlexInfo; sample: SkinSample; batches: { layer: BodyBatch["layer"]; vb: WebGLBuffer; ib: WebGLBuffer; count: number }[]; eyes: ReturnType<typeof irisInfo> };
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
  let style: 0 | 1 | 2 = 0;
  /** pelle vera: il tono medio della pelle del personaggio Quaternius della prova 3D (sRGB 169,118,82) */
  const skinLin = new Float32Array([0.405, 0.184, 0.082]);
  const bul = new Float32Array(64);
  const segRows = new Float32Array(63 * 4);
  const curlBuf = new Float32Array(32);
  const fingBuf = new Float32Array(16);
  const drawBody = (model: Model, VP: Float32Array, eye: V3, L: Layers, focus: Set<string> | null | undefined, time: number, sil = false) => {
    if (!body || !model.J || !model.hand) return;
    const meta = body.meta;
    // le mani vere (dita piegate sull'arco e sulla corda) danno la posa anche a ossa e muscoli delle mani
    const useRig = !sil && Boolean(rig);
    const { J, mats, skinMats, hands } = poseBody(meta, model, curlBuf, fingBuf, body.sample, useRig ? rig : null)!;
    if (useRig && rig && hands.length) atlasHandsFromRig(meta, mats, hands, rig, curlBuf, fingBuf);
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
    // le mani vere sostituiscono quelle dell'atlante: il braccio si taglia 1 cm prima del loro polso,
    // il loro pezzo d'avambraccio 1,8 cm prima (si sovrappongono di poco, senza bordi)
    const back: Partial<Record<"L" | "R", number[]>> = {};
    for (const s of ["L", "R"] as const) {
      const h = rig && hands.find((x) => x.side === s);
      const el = J[s === "L" ? 13 : 14];
      let clip = [0, 0, 0, 0];
      if (h && rig && el) {
        const w = placeApply(h.pl, rig[s].W);
        const n = v3.norm(v3.sub(w, el));
        back[s] = [n[0], n[1], n[2], v3.dot(n, w) - 0.018];
        // la mano dell'atlante si taglia solo dove si disegnano insieme la sua pelle e la mano vera (senza la pelle
        // vera del corpo): ora ossa e muscoli delle mani seguono la mano vera e restano visibili
        if (L.pelle && style === 2 && !(skinBody && bodyGpu)) clip = [n[0], n[1], n[2], v3.dot(n, w) - 0.01];
      }
      gl.uniform4fv(s === "L" ? bl.uArmL : bl.uArmR, [`avambr_${s}`, `mano_${s}`, `dita_${s}`, `pollice_${s}`].map((n) => meta.segments.indexOf(n)));
      gl.uniform4fv(s === "L" ? bl.uClipL : bl.uClipR, clip);
    }
    gl.uniform3fv(bl.uLo, meta.lo);
    gl.uniform3fv(bl.uHi, meta.hi);
    gl.uniform4fv(bl.uIrisL, body.eyes.L);
    gl.uniform4fv(bl.uIrisR, body.eyes.R);
    gl.uniform3fv(bl.uIrisAx, body.eyes.ax);
    gl.uniform1f(bl.uOnlyEyes, 0);
    const a16 = new Float32Array(64);
    for (let k = 0; k < 64; k++) a16[k] = Math.max(0, Math.min(1, g.act[k] ?? 0)) + ((g.foc[k] ?? 0) + 1) * 2;
    gl.uniform4fv(bl.uAct, a16);
    gl.uniform4fv(bl.uBul, bul);
    gl.uniform1f(bl.uTime, time);
    gl.uniform3fv(bl.uEye, eye);
    gl.uniform1f(bl.uDim, L.muscolo ? 1 : 0);
    gl.uniform1f(bl.uStyle, style);
    gl.uniform3fv(bl.uSkin, skinLin);
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
    // con la pelle a velo: dove si vedono muscoli e ossa si segna lo stencil (lì il velo li copre anche se la passano)
    const masked = hasStencil && L.pelle && style === 2 && (L.muscolo || L.osso || Boolean(L.nervo));
    // fondo sotto i muscoli: solo dove né muscoli né ossa coprono il punto (stencil)
    const fill = hasStencil && L.muscolo;
    if (masked || fill) {
      gl.enable(gl.STENCIL_TEST);
      gl.stencilMask(0xff);
      gl.stencilFunc(gl.ALWAYS, 1, 0xff);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    }
    if (L.osso) drawBodyLayer("bone", 1, 1);
    else if (L.muscolo) {
      // senza scheletro gli occhi restano: dentro le orbite, tra i muscoli del viso
      gl.uniform1f(bl.uOnlyEyes, 1);
      drawBodyLayer("bone", 1, 1);
      gl.uniform1f(bl.uOnlyEyes, 0);
    }
    if (L.muscolo) drawBodyLayer("muscle", 2, 1);
    if (L.nervo) drawBodyLayer("nerve", 4, 1);
    if (fill) {
      // carne in ombra negli spiragli tra un muscolo e l'altro (parete interna lontana della pelle dell'atlante),
      // invece del fondo dello studio: solo dove muscoli e ossa non ci sono, poi segnata anch'essa (il velo la copre)
      gl.stencilFunc(gl.NOTEQUAL, 1, 0xff);
      skinRows();
      gl.disable(gl.BLEND);
      drawBodyLayer("skin", 3, 1);
      gl.enable(gl.BLEND);
      if (skinMats !== mats) {
        rows(mats);
        gl.uniform4fv(bl.uSeg, segRows);
      }
      gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    }
    if (masked || fill) gl.disable(gl.STENCIL_TEST);
    if (L.pelle && style === 2 && hands.length && skinBody && bodyGpu) {
      // pelle vera chiusa: il corpo intero del personaggio con le sue mani
      for (const a of bodyAttribs) if (a >= 0) gl.disableVertexAttribArray(a);
      // con muscoli o scheletro accesi la pelle vera diventa un velo sopra di loro: si vede che li riveste.
      // Sopra i muscoli quasi trasparente al centro (il rosso della carne resta rosso), più presente sui bordi
      drawSkinBody(meta, skinMats, hands, VP, eye, J, L.muscolo ? 0.1 : L.osso || L.nervo ? 0.24 : 0, masked);
      gl.useProgram(bprog);
      for (const a of bodyAttribs) if (a >= 0) gl.enableVertexAttribArray(a);
    } else if (L.pelle && style === 2) {
      // pelle vera: opaca, scrive la profondità come un corpo pieno
      // senza scartare le facce girate: dove il corpo si piega non restano buchi
      skinRows();
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      drawBodyLayer("skin", 0, 1);
      gl.enable(gl.BLEND);
      if (hands.length) {
        for (const a of bodyAttribs) if (a >= 0) gl.disableVertexAttribArray(a);
        drawHands(hands, VP, eye, back);
        gl.useProgram(bprog);
        for (const a of bodyAttribs) if (a >= 0) gl.enableVertexAttribArray(a);
      }
    } else if (L.pelle) {
      skinRows();
      // pelle in due passate: solo profondità, poi il colore sulla superficie più esterna, sommato come vetro
      gl.colorMask(false, false, false, false);
      drawBodyLayer("skin", 0, 1);
      gl.colorMask(true, true, true, true);
      gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL);
      // su fondo scuro il velo della pelle si somma come vetro; su fondo chiaro si posa come un'ombra leggera
      gl.blendFunc(gl.SRC_ALPHA, style ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);
      drawBodyLayer("skin", 0, L.osso || L.muscolo || L.nervo ? 1 : 1.6);
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
    /** stile della tavola: 0 = studio scuro, 1 = tavola chiara (cambia il velo della pelle), 2 = pelle vera opaca */
    setStyle(v: 0 | 1 | 2) {
      style = v;
    },
    /** tono della pelle vera, "#rrggbb" (sRGB); senza colore torna quello del personaggio della prova 3D */
    setSkin(hex?: string | null) {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
      const v = m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255) : [169 / 255, 118 / 255, 82 / 255];
      for (let i = 0; i < 3; i++) skinLin[i] = v[i] <= 0.04045 ? v[i] / 12.92 : Math.pow((v[i] + 0.055) / 1.055, 2.4);
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
      bodies[level] = { meta: data.meta, flex: flexOf(data), sample: skinSample(data), batches, eyes: irisInfo(data) };
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
      // per le foto e i video in alta definizione: anche le mani vere e la pelle vera chiusa (con la sua
      // grana), se no il primo disegno usa la pelle dell'atlante
      const skin = Promise.all([rigLoaded, skinLoaded, detLoaded]).catch(() => undefined);
      await Promise.all([loadGear(), Promise.race([Promise.all([fibLoaded, skin]), new Promise((r) => setTimeout(r, 6000))])]);
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
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
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
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
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
/**
 * La posa del corpo anatomico per un modello: le mani messe sull'attrezzo, le matrici dei segmenti (ossa e
 * muscoli) e quelle della pelle (con la corporatura). curl e fing ricevono la piega delle dita.
 */
/** un vertice su quattro della pelle di petto, spalle, base del collo e bacino (riposo): per tenere la corda lontana dal petto */
export type SkinSample = { p: Float32Array; a: Uint8Array; b: Uint8Array; w: Float32Array; n: number };
export function skinSample(data: BodyData, every = 4): SkinSample {
  const meta = data.meta;
  // le braccia no: l'avambraccio e il gomito dell'arco sfiorano la corda (il paracolpi è lì per quello)
  const keep = new Set(["bacino", "torace", "clav_L", "clav_R"].map((n) => meta.segments.indexOf(n)));
  // anche la base del collo (pelle tra busto e testa: sotto la mandibola la corda non tocca) e la cima
  // della spalla (pelle tra clavicola e braccio)
  const head = meta.segments.indexOf("testa");
  const arm = new Set(["omero_L", "omero_R"].map((n) => meta.segments.indexOf(n)));
  const dv = new DataView(data.buf);
  const st = meta.stride;
  const lo = meta.lo;
  const hi = meta.hi;
  const P: number[] = [];
  const A: number[] = [];
  const B: number[] = [];
  const W: number[] = [];
  for (const b of meta.batches) {
    if (b.layer !== "skin") continue;
    for (let v = 0; v < b.vertices; v += every) {
      const off = b.vOffset + v * st;
      const ja = dv.getUint8(off + 9);
      const jb = dv.getUint8(off + 10);
      const w0 = dv.getUint8(off + 11) / 255;
      const okA = keep.has(ja) && (keep.has(jb) || (jb === head && w0 > 0.6));
      const okB = keep.has(jb) && ja === head && w0 < 0.4;
      const okC = (keep.has(ja) && arm.has(jb) && w0 >= 0.5) || (keep.has(jb) && arm.has(ja) && w0 < 0.5);
      if (!okA && !okB && !okC) continue;
      for (let k = 0; k < 3; k++) P.push(lo[k] + (dv.getUint16(off + k * 2, true) / 65535) * (hi[k] - lo[k]));
      A.push(ja);
      B.push(jb);
      W.push(dv.getUint8(off + 11) / 255);
    }
  }
  return { p: new Float32Array(P), a: new Uint8Array(A), b: new Uint8Array(B), w: new Float32Array(W), n: A.length };
}

/** la corda (puntali -> cocca) più vicina alla pelle del campione: distanza, punto della pelle e della corda */
function stringGap(sample: SkinSample, mats: Float32Array, ends: [V3, V3][]) {
  let bd = Infinity;
  const P = sample.p;
  const segs = ends.map(([e0, e1]) => {
    const ab = v3.sub(e1, e0);
    return { e0, ab, l2: Math.max(1e-9, v3.dot(ab, ab)) };
  });
  for (let i = 0; i < sample.n; i++) {
    const x = P[i * 3];
    const y = P[i * 3 + 1];
    const z = P[i * 3 + 2];
    const oa = sample.a[i] * 16;
    const ob = sample.b[i] * 16;
    const w = sample.w[i];
    const w1 = 1 - w;
    const px = (mats[oa] * x + mats[oa + 4] * y + mats[oa + 8] * z + mats[oa + 12]) * w + (mats[ob] * x + mats[ob + 4] * y + mats[ob + 8] * z + mats[ob + 12]) * w1;
    const py = (mats[oa + 1] * x + mats[oa + 5] * y + mats[oa + 9] * z + mats[oa + 13]) * w + (mats[ob + 1] * x + mats[ob + 5] * y + mats[ob + 9] * z + mats[ob + 13]) * w1;
    const pz = (mats[oa + 2] * x + mats[oa + 6] * y + mats[oa + 10] * z + mats[oa + 14]) * w + (mats[ob + 2] * x + mats[ob + 6] * y + mats[ob + 10] * z + mats[ob + 14]) * w1;
    for (const sg of segs) {
      const dx = px - sg.e0[0];
      const dy = py - sg.e0[1];
      const dz = pz - sg.e0[2];
      let t = (dx * sg.ab[0] + dy * sg.ab[1] + dz * sg.ab[2]) / sg.l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = dx - sg.ab[0] * t;
      const qy = dy - sg.ab[1] * t;
      const qz = dz - sg.ab[2] * t;
      const d = qx * qx + qy * qy + qz * qz;
      if (d < bd) bd = d;
    }
  }
  return { d: Math.sqrt(bd) };
}

/** la corda non tocca mai il petto né le spalle: al massimo bocca e mandibola (3 cm d'aria, misurati su un vertice ogni quattro) */
const STRING_GAP = 0.03;

/** una mano vera in posa: ossa piegate e messa nel mondo */
export type RigPose = { side: "L" | "R"; bones: ReturnType<typeof bowGrip>["bones"]; pl: Placement; kind: "arco" | "corda" | "libera" };

function xfm(m: Float32Array, at: number, p: V3): V3 {
  const o = at * 16;
  return [m[o] * p[0] + m[o + 4] * p[1] + m[o + 8] * p[2] + m[o + 12], m[o + 1] * p[0] + m[o + 5] * p[1] + m[o + 9] * p[2] + m[o + 13], m[o + 2] * p[0] + m[o + 6] * p[1] + m[o + 10] * p[2] + m[o + 14]];
}
function xfv(m: Float32Array, at: number, v: V3): V3 {
  const o = at * 16;
  return [m[o] * v[0] + m[o + 4] * v[1] + m[o + 8] * v[2], m[o + 1] * v[0] + m[o + 5] * v[1] + m[o + 9] * v[2], m[o + 2] * v[0] + m[o + 6] * v[1] + m[o + 10] * v[2]];
}

/**
 * Le mani vere sull'attrezzo: la mano dell'arco sull'impugnatura e quella della corda alla cocca come
 * nel Manuale FITA; quando non tengono nulla seguono la mano della sagoma, rilassate. Il polso della
 * sagoma va dove sta il polso della mano vera (l'avambraccio si allunga di poco).
 */
function rigHands(meta: BodyMeta, model: Model, mats: Float32Array, rig: HandRig) {
  const sd = sides(model.hand!);
  const side = (i: number): "L" | "R" => (i === 15 ? "L" : "R");
  const mir: 1 | -1 = model.hand === "destro" ? 1 : -1;
  const out: (RigPose & { wrist: number })[] = [];
  const anat = (s: "L" | "R") => {
    const mI = meta.segments.indexOf(`mano_${s}`);
    const cf = curlFrame(meta, s);
    const Wr = meta.rest[s === "L" ? "15" : "16"] as V3 | undefined;
    if (mI < 0 || !cf || !Wr) return null;
    const W = xfm(mats, mI, Wr);
    const K = xfm(mats, mI, cf.K);
    return { W, K, F: v3.norm(xfv(mats, mI, cf.F)), N: v3.norm(xfv(mats, mI, cf.P)) };
  };
  const scaleOf = (h: RigHand, a: { W: V3; K: V3 }) => Math.max(0.75, Math.min(1.3, v3.len(v3.sub(a.K, a.W)) / handLength(h)));
  // mano dell'arco
  {
    const s = side(sd.bow[2]);
    const h = rig[s];
    const a = anat(s);
    const riser = model.parts.find((p) => p.mesh === "sbRiser");
    if (a && model.J?.[sd.bow[1]]) {
      const k = scaleOf(h, a);
      if (riser && (model.grip?.bow ?? 0) > 0.3) {
        const m = riser.m;
        const g = bowGrip(rig, s, { o: [m[12], m[13], m[14]], x: [m[0], m[1], m[2]], y: [m[4], m[5], m[6]], z: [m[8], m[9], m[10]] }, k);
        out.push({ side: s, bones: g.bones, pl: g.pl, kind: "arco", wrist: sd.bow[2] });
      } else {
        const g = freeHand(h, a.W, a.F, a.N, k);
        out.push({ side: s, bones: g.bones, pl: g.pl, kind: "libera", wrist: -1 });
      }
    }
  }
  // mano della corda
  {
    const s = side(sd.draw[2]);
    const h = rig[s];
    const a = anat(s);
    const str = model.parts.filter((p) => p.id === "corda" && p.alt === "real");
    if (a && model.J?.[sd.draw[1]]) {
      const k = scaleOf(h, a);
      if (model.arrow && str.length === 2 && (model.grip?.draw ?? 0) > 0.3) {
        const nock = model.arrow.nock;
        const far = str.map((p) => {
          const c: V3 = [p.m[12], p.m[13], p.m[14]];
          const ax: V3 = [p.m[4], p.m[5], p.m[6]];
          const e0 = v3.sub(c, ax);
          const e1 = v3.add(c, ax);
          return v3.len(v3.sub(e0, nock)) > v3.len(v3.sub(e1, nock)) ? e0 : e1;
        });
        const top = far[0][1] > far[1][1] ? far[0] : far[1];
        const bot = far[0][1] > far[1][1] ? far[1] : far[0];
        const up = v3.norm(v3.sub(v3.norm(v3.sub(top, nock)), v3.norm(v3.sub(bot, nock))));
        const fwd = v3.norm(v3.sub(model.arrow.dir, v3.mul(up, v3.dot(model.arrow.dir, up))));
        const outV = v3.mul(v3.norm(v3.cross(fwd, up)), mir);
        const g = drawHook(h, { o: nock, fwd, up, out: outV }, k, mir, model.J![sd.draw[1]]);
        out.push({ side: s, bones: g.bones, pl: g.pl, kind: "corda", wrist: sd.draw[2] });
      } else {
        const g = freeHand(h, a.W, a.F, a.N, k);
        out.push({ side: s, bones: g.bones, pl: g.pl, kind: "libera", wrist: -1 });
      }
    }
  }
  return out;
}

export function poseBody(meta: BodyMeta, model: Model, curl: Float32Array = new Float32Array(32), fing: Float32Array = new Float32Array(16), sample?: SkinSample | null, rig?: HandRig | null) {
  if (!model.J || !model.hand) return null;
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
    const first = bodyMatrices(meta, J, look, grips, curl, fing, undefined, model.palms);
    J = seatHands(meta, J, first, [
      grips.wrap.k > 0.3 ? { side: grips.wrap.side, base: grips.wrap.side === "L" ? 33 : 54, at: pts.grip, hole: "wrap" as const } : null,
      grips.hook.k > 0.3 ? { side: grips.hook.side, base: grips.hook.side === "L" ? 33 : 54, at: pts.nock, hole: "hook" as const } : null,
    ]);
  }
  // la pelle segue ossa e muscoli: stesse matrici (la corporatura stimata dall'aura non gonfia più la sola pelle,
  // che si staccava dai muscoli: collo e spalle grossi, testa piccola)
  let mats = bodyMatrices(meta, J, look, grips, curl, fing, undefined, model.palms);
  let skinMats = mats;
  // mani vere: il polso della sagoma va al polso della mano che tiene arco o corda
  let hands: RigPose[] = [];
  if (rig) {
    const rh = rigHands(meta, model, mats, rig);
    hands = rh;
    let moved = false;
    for (const r of rh) {
      if (r.wrist < 0 || !J[r.wrist]) continue;
      const w = placeApply(r.pl, rig[r.side].W);
      const d = v3.sub(w, J[r.wrist]);
      if (v3.len(d) > 0.12) continue;
      // tutta la mano con il polso: anche i suoi 21 punti, da cui l'avambraccio prende il polso (prima restava
      // dov'era e tra avambraccio e mano vera i muscoli si stiravano in fili dritti fino alle dita)
      J = { ...J };
      const base = r.side === "L" ? 33 : 54;
      for (const i of [r.wrist, ...(r.side === "L" ? [17, 19, 21] : [18, 20, 22]), ...Array.from({ length: 21 }, (_, k) => base + k)]) if (J[i]) J[i] = v3.add(J[i], d);
      moved = true;
    }
    if (moved) {
      mats = bodyMatrices(meta, J, look, grips, curl, fing, undefined, model.palms);
      skinMats = mats;
    }
  }
  // in trazione la corda passa davanti al petto e sfiora al più bocca e mandibola: se il corpo ricostruito
  // (la profondità è la misura più incerta del video) la porta sul petto o sulla spalla dell'arco, il corpo
  // si sposta un poco indietro, lontano dalla corda; testa (ancoraggio) e mani (arco e corda) restano dove
  // sono, collo e braccia si adattano di qualche centimetro
  if (sample && sample.n && model.arrow && (model.grip?.draw ?? 0) > 0.3) {
    const real = model.parts.filter((p) => p.id === "corda" && p.alt === "real");
    const ends = (real.length ? real : model.parts.filter((p) => p.id === "corda")).map((p): [V3, V3] => {
      const c: V3 = [p.m[12], p.m[13], p.m[14]];
      const ax: V3 = [p.m[4], p.m[5], p.m[6]];
      return [v3.sub(c, ax), v3.add(c, ax)];
    });
    const body = [11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
    const half = [13, 14];
    const J0 = J;
    // al più 7 cm: oltre, la ricostruzione è troppo lontana dal vero per correggerla così
    const cap = 0.07;
    let moved = 0;
    let shift: V3 = [0, 0, 0];
    for (let it = 0; it < 6 && ends.length && J[11] && J[12]; it++) {
      const g = stringGap(sample, skinMats, ends);
      if (g.d >= STRING_GAP || moved >= cap) break;
      // via dalla corda, in orizzontale: dal punto della corda più vicino alle spalle verso le spalle
      const sh = v3.lerp(J[11], J[12], 0.5);
      let q = ends[0][0];
      let dq = Infinity;
      for (const [e0, e1] of ends) {
        const ab = v3.sub(e1, e0);
        const t = Math.max(0, Math.min(1, v3.dot(v3.sub(sh, e0), ab) / Math.max(1e-9, v3.dot(ab, ab))));
        const c = v3.add(e0, v3.mul(ab, t));
        const d = v3.len(v3.sub(sh, c));
        if (d < dq) {
          dq = d;
          q = c;
        }
      }
      const a = v3.sub(sh, q);
      const away = v3.norm([a[0], 0, a[2]]);
      const push = Math.min(cap - moved, STRING_GAP - g.d + 0.004);
      shift = v3.add(shift, v3.mul(away, push));
      moved += push;
      J = { ...J0 };
      for (const i of body) if (J0[i]) J[i] = v3.add(J0[i], shift);
      for (const i of half) if (J0[i]) J[i] = v3.add(J0[i], v3.mul(shift, 0.5));
      mats = bodyMatrices(meta, J, look, grips, curl, fing, undefined, model.palms);
      skinMats = mats;
    }
    // entrando e uscendo dalla trazione lo spostamento cresce e cala piano (niente corpo che salta)
    const k = Math.min(1, Math.max(0, ((model.grip?.draw ?? 0) - 0.3) / 0.25));
    if (moved > 0 && k < 1) {
      const kk = k * k * (3 - 2 * k);
      J = { ...J0 };
      for (const i of body) if (J0[i]) J[i] = v3.add(J0[i], v3.mul(shift, kk));
      for (const i of half) if (J0[i]) J[i] = v3.add(J0[i], v3.mul(shift, 0.5 * kk));
      mats = bodyMatrices(meta, J, look, grips, curl, fing, undefined, model.palms);
      skinMats = mats;
    }
  }
  return { J, mats, skinMats, grips, look, hands };
}

export function viewFrom(target: V3, yaw: number, pitch: number, dist: number, aspect: number, fovDeg = 34, near = 0.05) {
  const eye: V3 = [target[0] + Math.sin(yaw) * Math.cos(pitch) * dist, target[1] + Math.sin(pitch) * dist, target[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
  return { eye, VP: mul4(perspective((fovDeg * Math.PI) / 180, aspect, near, 30), lookAt(eye, target)) };
}


/**
 * Ossa e muscoli delle mani dell'atlante come le mani vere. La pelle ha le mani del personaggio (dita a tre
 * falangi piegate una per una sull'arco e sulla corda), l'atlante le sue, piegate a parte: con lo scheletro o i
 * muscoli accesi le dita delle ossa restavano dritte o aperte fuori dalla mano. Qui la mano dell'atlante si
 * porta sulla mano vera (polso, nocche, verso dell'indice e scala), le quattro dita si piegano con gli angoli
 * della mano vera (nocca e seconda falange, dito per dito) e il pollice segue il primo osso del pollice vero.
 */
function quatTwist(r: number[], ax: V3): number {
  // rotazione (3x3 a righe, normalizzata per colonne) -> quaternione -> angolo attorno all'asse
  const c0 = v3.norm([r[0], r[3], r[6]]);
  const c1 = v3.norm([r[1], r[4], r[7]]);
  const c2 = v3.norm([r[2], r[5], r[8]]);
  const m00 = c0[0], m10 = c0[1], m20 = c0[2], m01 = c1[0], m11 = c1[1], m21 = c1[2], m02 = c2[0], m12 = c2[1], m22 = c2[2];
  const tr = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;
  if (tr > 0) {
    const k = Math.sqrt(tr + 1) * 2;
    w = 0.25 * k;
    x = (m21 - m12) / k;
    y = (m02 - m20) / k;
    z = (m10 - m01) / k;
  } else if (m00 > m11 && m00 > m22) {
    const k = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / k;
    x = 0.25 * k;
    y = (m01 + m10) / k;
    z = (m02 + m20) / k;
  } else if (m11 > m22) {
    const k = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / k;
    x = (m01 + m10) / k;
    y = 0.25 * k;
    z = (m12 + m21) / k;
  } else {
    const k = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / k;
    x = (m02 + m20) / k;
    y = (m12 + m21) / k;
    z = 0.25 * k;
  }
  let a = 2 * Math.atan2(x * ax[0] + y * ax[1] + z * ax[2], w);
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
const mulR = (a: number[], b: number[]) => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]));
const trR = (a: number[]) => [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
function atlasHandsFromRig(meta: BodyMeta, mats: Float32Array, hands: RigPose[], rig: HandRig, curl: Float32Array, fing: Float32Array) {
  for (const hp of hands) {
    const s = hp.side;
    const h = rig[s];
    const cf = curlFrame(meta, s);
    const Wa = meta.rest[s === "L" ? "15" : "16"] as V3 | undefined;
    const mI = meta.segments.indexOf(`mano_${s}`);
    const dI = meta.segments.indexOf(`dita_${s}`);
    const pI = meta.segments.indexOf(`pollice_${s}`);
    if (!cf || !Wa || mI < 0) continue;
    // dalla mano a riposo dell'atlante a quella della mano vera: polso su polso, nocche, verso dell'indice, scala
    const e1a = v3.norm(v3.sub(cf.K, Wa));
    const e2a = v3.norm(v3.sub(cf.X, v3.mul(e1a, v3.dot(cf.X, e1a))));
    const e3a = v3.cross(e1a, e2a);
    const e1r = v3.norm(v3.sub(h.K, h.W));
    const e2r = v3.norm(v3.sub(h.X, v3.mul(e1r, v3.dot(h.X, e1r))));
    const e3r = v3.cross(e1r, e2r);
    const sc = v3.len(v3.sub(h.K, h.W)) / Math.max(1e-6, v3.len(v3.sub(cf.K, Wa)));
    const T = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => sc * (e1r[i] * e1a[j] + e2r[i] * e2a[j] + e3r[i] * e3a[j])));
    const Tt = v3.sub(h.W, [T[0] * Wa[0] + T[1] * Wa[1] + T[2] * Wa[2], T[3] * Wa[0] + T[4] * Wa[1] + T[5] * Wa[2], T[6] * Wa[0] + T[7] * Wa[1] + T[8] * Wa[2]]);
    const mv = (r: number[], p: V3): V3 => [r[0] * p[0] + r[1] * p[1] + r[2] * p[2], r[3] * p[0] + r[4] * p[1] + r[5] * p[2], r[6] * p[0] + r[7] * p[1] + r[8] * p[2]];
    const sR = (r: number[], k: number) => r.map((x) => x * k);
    /** segmento dell'atlante: x (riposo dell'atlante) -> pl(Rr x + tr), con Rr e tr nello spazio della mano vera */
    const putRT = (seg: number, Rr: number[], tr: V3) => {
      if (seg < 0) return;
      const R = mulR(hp.pl.m, Rr);
      const t = placeApply(hp.pl, tr);
      const o = seg * 16;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) mats[o + j * 4 + i] = R[i * 3 + j];
      mats[o + 3] = mats[o + 7] = mats[o + 11] = 0;
      mats[o + 12] = t[0];
      mats[o + 13] = t[1];
      mats[o + 14] = t[2];
      mats[o + 15] = 1;
    };
    const ID = { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] as V3 };
    const b0 = hp.bones[0] ?? ID;
    // palmo: posa (pl) ∘ palmo ∘ T
    putRT(mI, mulR(b0.r, T), v3.add(mv(b0.r, Tt), b0.t));
    // quattro dita: come il palmo, ma lunghe quanto quelle della mano vera (la mano dell'atlante ha il palmo più
    // corto e le dita più lunghe: scalate col palmo, le ossa uscivano dalla punta delle dita), scala attorno
    // alle nocche
    const rigLen = [1, 2, 3, 4].reduce((a, f) => a + v3.len(v3.sub(h.tips[f], h.heads[1 + f * 3])), 0) / 4;
    const fr = Math.max(0.75, Math.min(1.1, rigLen / Math.max(1e-6, cf.L * sc)));
    const kIn = v3.add(mv(T, v3.mul(cf.K, 1 - fr)), Tt);
    putRT(dI, sR(mulR(b0.r, T), fr), v3.add(mv(b0.r, kIn), b0.t));
    // pollice: dall'articolazione alla base della prima falange fino alla punta, come quello della mano vera
    // (prima seguiva solo il metacarpo: restava dritto e puntava fuori dalla mano)
    const p0 = meta.rest[`pol0_${s}`] as V3 | undefined;
    const p1 = meta.rest[`pol1_${s}`] as V3 | undefined;
    const b2 = hp.bones[2];
    const b3 = hp.bones[3];
    if (pI >= 0 && p0 && p1 && b2 && b3) {
      const A0 = v3.add(mv(T, p0), Tt);
      const A1 = v3.add(mv(T, p1), Tt);
      const M = v3.add(mv(b2.r, h.heads[2]), b2.t);
      const tip = v3.add(mv(b3.r, h.tips[0]), b3.t);
      const want = v3.sub(tip, M);
      const have = mv(b2.r, v3.sub(A1, A0));
      const st = Math.max(0.8, Math.min(1.25, v3.len(want) / Math.max(1e-6, v3.len(have))));
      // rotazione minima che porta la direzione del pollice (girata con la prima falange) sulla punta vera
      const a = v3.norm(have);
      const b = v3.norm(want);
      const ax = v3.cross(a, b);
      const sn = v3.len(ax);
      const cs = v3.dot(a, b);
      let Q = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      if (sn > 1e-6) {
        const [x, y, z] = v3.mul(ax, 1 / sn);
        const C = 1 - cs;
        Q = [cs + x * x * C, x * y * C - z * sn, x * z * C + y * sn, y * x * C + z * sn, cs + y * y * C, y * z * C - x * sn, z * x * C - y * sn, z * y * C + x * sn, cs + z * z * C];
      }
      const QR = sR(mulR(Q, b2.r), st);
      putRT(pI, mulR(QR, T), v3.add(M, mv(QR, v3.sub(Tt, A0))));
    } else {
      const b1 = hp.bones[1] ?? ID;
      putRT(pI, mulR(b1.r, T), v3.add(mv(b1.r, Tt), b1.t));
    }
    // dita: la piega della mano vera, dito per dito (indice..mignolo), nella scheda grafica. La piega media va
    // nella piega comune (vale per tutta la mano: anche le punte, più larghe della fila delle nocche, che
    // altrimenti non ricevevano la piega del loro dito e restavano dritte come lame); ogni dito aggiunge la sua
    // differenza (il mignolo riceve già un quarto in più dalla piega comune)
    const m1: number[] = [];
    const m2: number[] = [];
    for (let f = 0; f < 4; f++) {
      const b = 4 + f * 3;
      const r1 = hp.bones[b]?.r;
      const r2 = hp.bones[b + 1]?.r;
      m1.push(r1 ? quatTwist(r1, h.flexAx[f]) : 0);
      m2.push(r1 && r2 ? quatTwist(mulR(trR(r1), r2), h.flexAx[f]) : 0);
    }
    const c1 = (m1[0] + m1[1] + m1[2] + m1[3]) / 4;
    const c2 = (m2[0] + m2[1] + m2[2] + m2[3]) / 4;
    const o = s === "L" ? 0 : 16;
    curl.set([cf.K[0], cf.K[1], cf.K[2], cf.L, cf.F[0], cf.F[1], cf.F[2], c1, cf.S[0], cf.S[1], cf.S[2], c2, cf.X[0], cf.X[1], cf.X[2], 0], o);
    const fo = s === "L" ? 0 : 8;
    for (let f = 0; f < 4; f++) {
      fing[fo + f] = m1[f] - c1 * (f === 3 ? 1.25 : 1);
      fing[fo + 4 + f] = m2[f] - c2 * (f === 3 ? 1.3 : 1);
    }
  }
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
