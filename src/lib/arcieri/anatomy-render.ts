/**
 * Disegno WebGL del modello anatomico (pelle di vetro, ossa, muscoli con fibre e tendini).
 * Usato dalla vista 3D dell'analisi e dalle immagini dei muscoli per le zone del corpo.
 */
import { v3, type Model, type Part, type V3 } from "./anatomy-model";
import { bodyMatrices, groupValues, type BodyBatch, type BodyData, type BodyMeta } from "./anatomy-body";

export type Layers = { pelle: boolean; muscolo: boolean; osso: boolean };

const VS = `
attribute vec3 aP; attribute vec3 aN;
uniform mat4 uVP; uniform mat4 uM; uniform mat3 uNM;
varying vec3 vW; varying vec3 vN; varying vec3 vO;
void main(){ vec4 w = uM * vec4(aP, 1.0); vW = w.xyz; vN = normalize(uNM * aN); vO = aP; gl_Position = uVP * w; }`;
const FS = `
precision mediump float;
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
uniform mat4 uVP; uniform mat4 uSeg[17]; uniform vec3 uLo; uniform vec3 uHi;
uniform vec4 uAct[16]; uniform vec4 uFoc[16];
varying vec3 vW; varying vec3 vN; varying vec2 vF; varying float vAct; varying float vFoc; varying float vTend;
float pick(vec4 v, int k){ return k == 0 ? v.x : k == 1 ? v.y : k == 2 ? v.z : v.w; }
void main(){
  vec3 p = uLo + aP * (uHi - uLo);
  float w = aM.x / 255.0;
  mat4 M = uSeg[int(aJ.x + 0.5)] * w + uSeg[int(aJ.y + 0.5)] * (1.0 - w);
  vec4 wp = M * vec4(p, 1.0);
  vN = normalize(mat3(M[0].xyz, M[1].xyz, M[2].xyz) * aN);
  int g = int(aM.y + 0.5); int gi = g / 4; int gk = g - gi * 4;
  vAct = pick(uAct[gi], gk); vFoc = pick(uFoc[gi], gk);
  vF = vec2(aM.z, aM.w) / 255.0; vTend = aT;
  vW = wp.xyz; gl_Position = uVP * wp;
}`;
const BFS = `
precision mediump float;
varying vec3 vW; varying vec3 vN; varying vec2 vF; varying float vAct; varying float vFoc; varying float vTend;
uniform vec3 uEye; uniform float uLayer; uniform float uAlpha; uniform float uDim;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uEye - vW);
  if (dot(N, V) < 0.0) N = -N;
  float ndv = max(dot(N, V), 0.0);
  float rim = pow(1.0 - ndv, 2.0);
  vec3 L = normalize(vec3(0.35, 0.8, 0.55)); vec3 L2 = normalize(vec3(-0.6, 0.25, 0.3));
  float dif = max(dot(N, L), 0.0) * 0.75 + max(dot(N, L2), 0.0) * 0.3;
  float hemi = 0.55 + 0.45 * N.y;
  vec3 R = reflect(-L, N);
  vec3 col; float a = uAlpha;
  if (uLayer < 0.5) {
    // pelle: vetro azzurro, il bordo si accende come nelle tavole mediche
    col = vec3(0.4, 0.72, 1.0) * (0.36 + rim * 1.5) + vec3(0.85, 0.95, 1.0) * pow(rim, 3.0) * 0.6;
    a = uAlpha * (0.16 + rim * 0.7);
  } else if (uLayer < 1.5) {
    // ossa: bianco azzurro, morbide
    // con i muscoli accesi le ossa tra un muscolo e l'altro restano azzurrine, non bianche
    vec3 boneCol = mix(vec3(0.88, 0.93, 0.98), vec3(0.6, 0.72, 0.86), uDim);
    col = boneCol * (0.32 + 0.12 * hemi + dif * 0.55) + vec3(0.55, 0.8, 1.0) * rim * 0.35;
  } else {
    // muscoli: rosso bruno con le fibre lungo il muscolo, tendini chiari, lucidi
    float fib = 0.82 + 0.1 * sin(vF.y * 6.2832 * 34.0 + sin(vF.x * 9.0) * 1.4) + 0.08 * sin(vF.y * 6.2832 * 83.0);
    vec3 rest = vec3(0.74, 0.35, 0.31);
    vec3 work = vec3(1.0, 0.36, 0.2);
    float act = clamp(vAct, 0.0, 1.0);
    float on = smoothstep(0.32, 0.8, act);
    vec3 base = mix(rest, work, on);
    if (vFoc > 0.5) { base = work; on = 1.0; }
    else if (vFoc < -0.5) { base = mix(rest, vec3(0.5, 0.42, 0.42), 0.35); on = 0.0; }
    base = mix(base, vec3(0.93, 0.9, 0.86), vTend * 0.85);
    float spec = pow(max(dot(R, V), 0.0), 40.0) * (0.1 + 0.18 * on);
    float edge = mix(1.0, 0.62, pow(1.0 - ndv, 2.4));
    col = base * (0.3 + 0.16 * hemi + dif * 0.72) * mix(fib, 1.0, vTend) * edge
        + work * on * (0.32 + 0.5 * rim) * (1.0 - vTend)
        + vec3(1.0, 0.92, 0.85) * spec;
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
  const meshes = { sphere: upload(sphereMesh()), torus: upload(torusMesh()), spindle: upload(spindleMesh()) };
  // ---- corpo anatomico vero ----
  const bprog = gl.createProgram()!;
  gl.attachShader(bprog, sh(gl.VERTEX_SHADER, BVS));
  gl.attachShader(bprog, sh(gl.FRAGMENT_SHADER, BFS));
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
    uFoc: gl.getUniformLocation(bprog, "uFoc"),
    uEye: gl.getUniformLocation(bprog, "uEye"),
    uLayer: gl.getUniformLocation(bprog, "uLayer"),
    uAlpha: gl.getUniformLocation(bprog, "uAlpha"),
    uDim: gl.getUniformLocation(bprog, "uDim"),
  };
  let body: { meta: BodyMeta; batches: { layer: BodyBatch["layer"]; vb: WebGLBuffer; ib: WebGLBuffer; count: number }[] } | null = null;
  const bodyAttribs = [bl.aP, bl.aN, bl.aJ, bl.aM, bl.aT];
  const drawBodyLayer = (layer: BodyBatch["layer"], code: number, alpha: number) => {
    if (!body) return;
    gl.uniform1f(bl.uLayer, code);
    gl.uniform1f(bl.uAlpha, alpha);
    const st = body.meta.stride;
    for (const b of body.batches) {
      if (b.layer !== layer) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, b.vb);
      gl.vertexAttribPointer(bl.aP, 3, gl.UNSIGNED_SHORT, true, st, 0);
      gl.vertexAttribPointer(bl.aN, 3, gl.BYTE, true, st, 6);
      gl.vertexAttribPointer(bl.aJ, 2, gl.UNSIGNED_BYTE, false, st, 10);
      gl.vertexAttribPointer(bl.aM, 4, gl.UNSIGNED_BYTE, false, st, 12);
      gl.vertexAttribPointer(bl.aT, 1, gl.UNSIGNED_BYTE, true, st, 16);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.ib);
      gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
    }
  };
  let bound = "";
  const bind = (name: Part["mesh"]) => {
    if (bound === name) return;
    const m = meshes[name];
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
    bind(p.mesh);
    gl.uniformMatrix4fv(loc.uM, false, p.m);
    gl.uniformMatrix3fv(loc.uNM, false, p.nm);
    gl.uniform3fv(loc.uColor, p.color);
    gl.uniform1f(loc.uMode, p.mode);
    gl.uniform1f(loc.uAlpha, p.alpha);
    gl.uniform1f(loc.uAct, p.act);
    gl.drawElements(gl.TRIANGLES, meshes[p.mesh].count, gl.UNSIGNED_SHORT, 0);
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
  const drawBody = (model: Model, VP: Float32Array, eye: V3, L: Layers, focus?: Set<string> | null) => {
    if (!body || !model.J || !model.hand) return;
    const meta = body.meta;
    const mats = bodyMatrices(meta, model.J);
    const acts = new Map<string, number>();
    for (const p of model.parts) if (p.layer === "muscolo" && p.id) acts.set(p.id, Math.max(acts.get(p.id) ?? 0, p.act));
    const g = groupValues(meta, model.hand, acts, focus);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(true);
    // arco, corda e freccia: dal modello semplice
    drawProcedural(model.parts.filter((p) => p.layer === "arco" && !focus), VP, eye, 0);
    gl.disableVertexAttribArray(loc.aP);
    gl.disableVertexAttribArray(loc.aN);
    gl.useProgram(bprog);
    for (const a of bodyAttribs) if (a >= 0) gl.enableVertexAttribArray(a);
    gl.uniformMatrix4fv(bl.uVP, false, VP);
    gl.uniformMatrix4fv(bl.uSeg, false, mats);
    gl.uniform3fv(bl.uLo, meta.lo);
    gl.uniform3fv(bl.uHi, meta.hi);
    const a16 = new Float32Array(64);
    a16.set(g.act.subarray(0, 64));
    const f16 = new Float32Array(64);
    f16.set(g.foc.subarray(0, 64));
    gl.uniform4fv(bl.uAct, a16);
    gl.uniform4fv(bl.uFoc, f16);
    gl.uniform3fv(bl.uEye, eye);
    gl.uniform1f(bl.uDim, L.muscolo ? 1 : 0);
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
    for (const a of bodyAttribs) if (a >= 0) gl.disableVertexAttribArray(a);
    gl.useProgram(prog);
    bound = "";
  };
  return {
    /** carica il corpo vero nella scheda grafica; da quel momento sostituisce la sagoma semplice */
    setBody(data: BodyData) {
      if (!bodyOk || body) return;
      const batches = data.meta.batches.map((b) => {
        const vb = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, vb);
        gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(data.buf, b.vOffset, b.vertices * data.meta.stride), gl.STATIC_DRAW);
        const ib = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.buf, b.iOffset, b.indices), gl.STATIC_DRAW);
        return { layer: b.layer, vb, ib, count: b.indices };
      });
      body = { meta: data.meta, batches };
      bound = "";
    },
    hasBody() {
      return Boolean(body);
    },
    clear(W: number, H: number) {
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    /** focus: id dei muscoli da mettere in evidenza (gli altri si spengono) */
    draw(model: Model, VP: Float32Array, eye: V3, time: number, L: Layers, focus?: Set<string> | null) {
      if (body && model.J && model.hand) {
        drawBody(model, VP, eye, L, focus);
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
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

/** camera che guarda un punto da una direzione (yaw, pitch) a una distanza */
export function viewFrom(target: V3, yaw: number, pitch: number, dist: number, aspect: number, fovDeg = 34) {
  const eye: V3 = [target[0] + Math.sin(yaw) * Math.cos(pitch) * dist, target[1] + Math.sin(pitch) * dist, target[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
  return { eye, VP: mul4(perspective((fovDeg * Math.PI) / 180, aspect, 0.05, 30), lookAt(eye, target)) };
}
