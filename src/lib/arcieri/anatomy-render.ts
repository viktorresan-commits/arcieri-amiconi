/**
 * Disegno WebGL del modello anatomico (pelle di vetro, ossa, muscoli con fibre e tendini).
 * Usato dalla vista 3D dell'analisi e dalle immagini dei muscoli per le zone del corpo.
 */
import { v3, type Model, type Part, type V3 } from "./anatomy-model";

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
  vec3 L = normalize(vec3(0.4, 0.9, 0.6));
  float dif = max(dot(N, L), 0.0);
  vec3 col; float a;
  if (uMode < 0.5) {
    // pelle: vetro con il bordo che si accende, linee di scansione leggere
    float scan = 0.85 + 0.15 * sin(vW.y * 140.0 - uTime * 2.0);
    col = uColor * (0.28 + rim * 2.1) * scan;
    a = uAlpha * (0.15 + rim * 1.1);
  } else if (uMode < 1.5) {
    // osso: avorio freddo, luce morbida e bordo azzurro
    col = uColor * (0.35 + dif * 0.55) + vec3(0.45, 0.75, 1.0) * rim * 0.55;
    a = uAlpha;
  } else if (uMode < 2.5) {
    // muscolo: fibre lungo il muscolo, tendini chiari alle estremità, lucido come nelle tavole
    float ang = atan(vO.z, vO.x);
    float fib = 0.84 + 0.1 * sin(ang * 26.0 + vO.y * 2.0) + 0.06 * sin(ang * 61.0);
    float tend = smoothstep(0.68, 0.96, abs(vO.y));
    vec3 base = mix(uColor, vec3(0.94, 0.9, 0.82), tend * 0.85);
    vec3 R = reflect(-L, N);
    float spec = pow(max(dot(R, V), 0.0), 22.0) * 0.28;
    col = base * (0.3 + dif * 0.64) * mix(fib, 1.0, tend) + uColor * uAct * 0.3 * (1.0 - tend) + vec3(1.0, 0.86, 0.72) * (rim * 0.2 + spec);
    a = uAlpha;
  } else {
    col = uColor * (0.4 + dif * 0.6) + rim * 0.15;
    a = uAlpha;
  }
  gl_FragColor = vec4(col, a);
}`;

function sphereMesh(lat = 30, lon = 48) {
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
function spindleMesh(rings = 40, lon = 36) {
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

function torusMesh(R = 1, r = 0.07, seg = 44, tube = 8) {
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
  return {
    clear(W: number, H: number) {
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    /** focus: id dei muscoli da mettere in evidenza (gli altri si spengono) */
    draw(model: Model, VP: Float32Array, eye: V3, time: number, L: Layers, focus?: Set<string> | null) {
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
