/**
 * Motore 3D leggero in WebGL (nessuna libreria): mesh con normali e coordinate di texture,
 * luce del sole + cielo/terra (emisferica), riflesso, nebbia di distanza, ombre a macchia.
 * Serve alle viste 3D del tiro, al corpo dell'arciere e alla freccia di legno (modello CC0).
 */

export type Vec3 = [number, number, number];
export type Mat4 = Float32Array;

// ── matematica ────────────────────────────────────────────────────────────────
export const v3 = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a: Vec3) => Math.hypot(a[0], a[1], a[2]),
  norm: (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

export function mat4(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function mul(a: Mat4, b: Mat4): Mat4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

export function perspective(fovDeg: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function lookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Mat4 {
  const z = v3.norm(v3.sub(eye, target));
  const x = v3.norm(v3.cross(up, z));
  const y = v3.cross(z, x);
  const m = new Float32Array(16);
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
  m[12] = -v3.dot(x, eye);
  m[13] = -v3.dot(y, eye);
  m[14] = -v3.dot(z, eye);
  m[15] = 1;
  return m;
}

/** Matrice da origine, tre assi (già scalati) — comoda per orientare segmenti. */
export function basis(origin: Vec3, x: Vec3, y: Vec3, z: Vec3): Mat4 {
  const m = new Float32Array(16);
  m[0] = x[0]; m[1] = x[1]; m[2] = x[2];
  m[4] = y[0]; m[5] = y[1]; m[6] = y[2];
  m[8] = z[0]; m[9] = z[1]; m[10] = z[2];
  m[12] = origin[0]; m[13] = origin[1]; m[14] = origin[2]; m[15] = 1;
  return m;
}

export function trs(pos: Vec3, rotY = 0, scale: Vec3 = [1, 1, 1], rotX = 0, rotZ = 0): Mat4 {
  const cy = Math.cos(rotY), sy = Math.sin(rotY);
  const cx = Math.cos(rotX), sx = Math.sin(rotX);
  const cz = Math.cos(rotZ), sz = Math.sin(rotZ);
  // R = Ry * Rx * Rz
  const r00 = cy * cz + sy * sx * sz, r01 = -cy * sz + sy * sx * cz, r02 = sy * cx;
  const r10 = cx * sz, r11 = cx * cz, r12 = -sx;
  const r20 = -sy * cz + cy * sx * sz, r21 = sy * sz + cy * sx * cz, r22 = cy * cx;
  return basis(pos, [r00 * scale[0], r10 * scale[0], r20 * scale[0]], [r01 * scale[1], r11 * scale[1], r21 * scale[1]], [r02 * scale[2], r12 * scale[2], r22 * scale[2]]);
}

/** Segmento da a a b (asse Y della mesh), raggio r: per cilindri e capsule. */
export function segment(a: Vec3, b: Vec3, r: number, r2 = r): Mat4 {
  const d = v3.sub(b, a);
  const L = v3.len(d) || 1e-6;
  const y = v3.scale(d, 1 / L);
  const ref: Vec3 = Math.abs(y[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const x = v3.norm(v3.cross(ref, y));
  const z = v3.cross(x, y);
  return basis(a, v3.scale(x, r), v3.scale(y, L), v3.scale(z, r2));
}

/** Punto proiettato sullo schermo (per le scritte sopra il 3D). */
export function project(vp: Mat4, p: Vec3, w: number, h: number) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const ww = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (ww <= 0.01) return null;
  return { x: (x / ww * 0.5 + 0.5) * w, y: (1 - (y / ww * 0.5 + 0.5)) * h, depth: ww };
}

// ── geometrie ─────────────────────────────────────────────────────────────────
export type Geo = { pos: Float32Array; nor: Float32Array; uv: Float32Array; idx: Uint16Array };

function geo(pos: number[], nor: number[], uv: number[], idx: number[]): Geo {
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
}

export function boxGeo(): Geo {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const faces: [Vec3, Vec3, Vec3][] = [
    [[1, 0, 0], [0, 1, 0], [0, 0, -1]], [[-1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[0, 1, 0], [0, 0, -1], [1, 0, 0]], [[0, -1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, 0, 1], [0, 1, 0], [1, 0, 0]], [[0, 0, -1], [0, 1, 0], [-1, 0, 0]],
  ];
  for (const [n, u, v] of faces) {
    const base = pos.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(0.5 * (n[0] + a * v[0] + b * u[0]), 0.5 * (n[1] + a * v[1] + b * u[1]), 0.5 * (n[2] + a * v[2] + b * u[2]));
      nor.push(...n);
      uv.push((a + 1) / 2, (b + 1) / 2);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return geo(pos, nor, uv, idx);
}

export function sphereGeo(seg = 18, rings = 12): Geo {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= rings; r += 1) {
    const th = (r / rings) * Math.PI;
    for (let s = 0; s <= seg; s += 1) {
      const ph = (s / seg) * Math.PI * 2;
      const x = Math.sin(th) * Math.cos(ph);
      const y = Math.cos(th);
      const z = Math.sin(th) * Math.sin(ph);
      pos.push(x, y, z);
      nor.push(x, y, z);
      uv.push(s / seg, r / rings);
    }
  }
  for (let r = 0; r < rings; r += 1) {
    for (let s = 0; s < seg; s += 1) {
      const a = r * (seg + 1) + s;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return geo(pos, nor, uv, idx);
}

/** Cilindro lungo Y da 0 a 1, raggio 1 (tappi opzionali). */
export function cylinderGeo(seg = 16, caps = true): Geo {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let s = 0; s <= seg; s += 1) {
    const a = (s / seg) * Math.PI * 2;
    const x = Math.cos(a);
    const z = Math.sin(a);
    pos.push(x, 0, z, x, 1, z);
    nor.push(x, 0, z, x, 0, z);
    uv.push(s / seg, 0, s / seg, 1);
  }
  for (let s = 0; s < seg; s += 1) {
    const a = s * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  if (caps) {
    for (const [y, ny] of [[0, -1], [1, 1]] as const) {
      const c = pos.length / 3;
      pos.push(0, y, 0);
      nor.push(0, ny, 0);
      uv.push(0.5, 0.5);
      for (let s = 0; s <= seg; s += 1) {
        const a = (s / seg) * Math.PI * 2;
        pos.push(Math.cos(a), y, Math.sin(a));
        nor.push(0, ny, 0);
        uv.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
      }
      for (let s = 0; s < seg; s += 1) idx.push(...(ny > 0 ? [c, c + s + 2, c + s + 1] : [c, c + s + 1, c + s + 2]));
    }
  }
  return geo(pos, nor, uv, idx);
}

/** Cono lungo Y da 0 (base) a 1 (punta), raggio 1. */
export function coneGeo(seg = 14): Geo {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let s = 0; s <= seg; s += 1) {
    const a = (s / seg) * Math.PI * 2;
    const n = v3.norm([Math.cos(a), 0.5, Math.sin(a)]);
    pos.push(Math.cos(a), 0, Math.sin(a), 0, 1, 0);
    nor.push(...n, ...n);
    uv.push(s / seg, 0, s / seg, 1);
  }
  for (let s = 0; s < seg; s += 1) idx.push(s * 2, s * 2 + 1, s * 2 + 2);
  return geo(pos, nor, uv, idx);
}

/** Quadrato nel piano XZ (normale +Y), da -0.5 a 0.5. */
export function planeGeo(repeat = 1): Geo {
  return geo([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [0, 0, repeat, 0, repeat, repeat, 0, repeat], [0, 2, 1, 0, 3, 2]);
}

/** Disco nel piano XY (normale −Z, verso chi tira), raggio 1, uv centrate. */
export function discGeo(seg = 48): Geo {
  const pos = [0, 0, 0];
  const nor = [0, 0, -1];
  const uv = [0.5, 0.5];
  const idx: number[] = [];
  for (let s = 0; s <= seg; s += 1) {
    const a = (s / seg) * Math.PI * 2;
    pos.push(Math.cos(a), Math.sin(a), 0);
    nor.push(0, 0, -1);
    uv.push(0.5 + Math.cos(a) * 0.5, 0.5 - Math.sin(a) * 0.5);
  }
  for (let s = 0; s < seg; s += 1) idx.push(0, s + 1, s + 2);
  return geo(pos, nor, uv, idx);
}

/** Penna/aletta: triangolo sottile nel piano YZ (lunghezza lungo Z). */
export function vaneGeo(): Geo {
  const p = [0, 0, 0, 0, 1, 0.35, 0, 0.55, 1, 0, 0, 1];
  return geo([...p, ...p], [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0], [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0], [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
}

// ── motore ────────────────────────────────────────────────────────────────────
export type Mesh = { vao: { pos: WebGLBuffer; nor: WebGLBuffer; uv: WebGLBuffer; idx: WebGLBuffer }; count: number };
export type DrawOpts = { tex?: WebGLTexture | null; shine?: number; emissive?: number; alpha?: number; unlit?: boolean; noFog?: boolean; noDepth?: boolean };

const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUv;
uniform mat4 uModel; uniform mat4 uVP;
varying vec3 vNor; varying vec3 vWorld; varying vec2 vUv;
void main(){
  vec4 w = uModel * vec4(aPos,1.0);
  vWorld = w.xyz;
  vNor = mat3(uModel) * aNor;
  vUv = aUv;
  gl_Position = uVP * w;
}`;

const FS = `
precision mediump float;
varying vec3 vNor; varying vec3 vWorld; varying vec2 vUv;
uniform vec3 uColor; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uGround;
uniform vec3 uEye; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar;
uniform float uShine; uniform float uEmissive; uniform float uAlpha; uniform float uUnlit; uniform float uFogK;
uniform sampler2D uTex; uniform float uUseTex;
void main(){
  vec3 base = uColor;
  if (uUseTex > 0.5) base *= texture2D(uTex, vUv).rgb;
  vec3 n = normalize(vNor);
  if (!gl_FrontFacing) n = -n;
  vec3 col;
  if (uUnlit > 0.5) { col = base; }
  else {
    float hemi = n.y * 0.5 + 0.5;
    vec3 amb = mix(uGround, uSky, hemi) * base;
    float dif = max(dot(n, uSun), 0.0);
    vec3 v = normalize(uEye - vWorld);
    vec3 h = normalize(uSun + v);
    float spec = pow(max(dot(n, h), 0.0), 8.0 + uShine * 56.0) * uShine;
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.18;
    col = amb + base * uSunCol * dif + uSunCol * spec + rim * uSky + base * uEmissive;
  }
  float d = distance(uEye, vWorld);
  float f = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  col = mix(col, uFog, f * f * uFogK);
  gl_FragColor = vec4(pow(col, vec3(1.0/1.12)), uAlpha);
}`;

export type Env = { sun: Vec3; sunCol: Vec3; sky: Vec3; ground: Vec3; fog: Vec3; fogNear: number; fogFar: number };

export const DAY: Env = { sun: v3.norm([0.45, 0.8, -0.35]), sunCol: [1.0, 0.94, 0.82], sky: [0.42, 0.52, 0.62], ground: [0.22, 0.25, 0.16], fog: [0.72, 0.8, 0.84], fogNear: 40, fogFar: 180 };

export class GL3D {
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null> = {};
  attr: { pos: number; nor: number; uv: number };
  vp: Mat4 = mat4();
  eye: Vec3 = [0, 0, 0];
  far = 200;
  white: WebGLTexture;
  meshes: Record<string, Mesh> = {};
  cache = new Map<string, unknown>();

  /** Risorse create una volta sola per questa tela (texture, mesh caricate). */
  once<T>(key: string, make: () => T): T {
    if (!this.cache.has(key)) this.cache.set(key, make());
    return this.cache.get(key) as T;
  }

  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", { antialias: true, alpha: false, premultipliedAlpha: false }) as WebGLRenderingContext | null;
    if (!gl) throw new Error("WebGL non disponibile");
    this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type) as WebGLShader;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
      return s;
    };
    const prog = gl.createProgram() as WebGLProgram;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
    this.prog = prog;
    gl.useProgram(prog);
    for (const u of ["uModel", "uVP", "uColor", "uSun", "uSunCol", "uSky", "uGround", "uEye", "uFog", "uFogNear", "uFogFar", "uShine", "uEmissive", "uAlpha", "uUnlit", "uTex", "uUseTex", "uFogK"]) this.loc[u] = gl.getUniformLocation(prog, u);
    this.attr = { pos: gl.getAttribLocation(prog, "aPos"), nor: gl.getAttribLocation(prog, "aNor"), uv: gl.getAttribLocation(prog, "aUv") };
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.white = this.textureFrom(Object.assign(document.createElement("canvas"), { width: 2, height: 2 }), false);
    this.meshes.box = this.mesh(boxGeo());
    this.meshes.sphere = this.mesh(sphereGeo(26, 18));
    this.meshes.cyl = this.mesh(cylinderGeo());
    this.meshes.tube = this.mesh(cylinderGeo(10, false));
    this.meshes.cone = this.mesh(coneGeo());
    this.meshes.plane = this.mesh(planeGeo(1));
    this.meshes.disc = this.mesh(discGeo());
    this.meshes.vane = this.mesh(vaneGeo());
  }

  mesh(g: Geo): Mesh {
    const gl = this.gl;
    const buf = (data: ArrayBufferView, target: number) => {
      const b = gl.createBuffer() as WebGLBuffer;
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      return b;
    };
    return { vao: { pos: buf(g.pos, gl.ARRAY_BUFFER), nor: buf(g.nor, gl.ARRAY_BUFFER), uv: buf(g.uv, gl.ARRAY_BUFFER), idx: buf(g.idx, gl.ELEMENT_ARRAY_BUFFER) }, count: g.idx.length };
  }

  textureFrom(src: TexImageSource, mip = true, repeat = false): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture() as WebGLTexture;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const pow2 = (n: number) => (n & (n - 1)) === 0;
    const w = (src as { width: number }).width;
    const h = (src as { height: number }).height;
    if (mip && pow2(w) && pow2(h)) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    return { w, h, cssW: this.canvas.clientWidth, cssH: this.canvas.clientHeight };
  }

  begin(eye: Vec3, target: Vec3, fov: number, env: Env = DAY, clear: Vec3 = env.fog) {
    const gl = this.gl;
    const { w, h } = this.resize();
    gl.clearColor(clear[0], clear[1], clear[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const dist = v3.len(v3.sub(eye, target));
    this.far = Math.max(260, dist * 8);
    this.vp = mul(perspective(fov, w / h, Math.max(0.02, dist * 0.01), this.far), lookAt(eye, target));
    this.eye = eye;
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.loc.uVP, false, this.vp);
    gl.uniform3fv(this.loc.uSun, env.sun);
    gl.uniform3fv(this.loc.uSunCol, env.sunCol);
    gl.uniform3fv(this.loc.uSky, env.sky);
    gl.uniform3fv(this.loc.uGround, env.ground);
    gl.uniform3fv(this.loc.uEye, eye);
    gl.uniform3fv(this.loc.uFog, env.fog);
    gl.uniform1f(this.loc.uFogNear, env.fogNear);
    gl.uniform1f(this.loc.uFogFar, env.fogFar);
    return { w, h };
  }

  draw(mesh: Mesh | string, model: Mat4, color: Vec3 | string, o: DrawOpts = {}) {
    const gl = this.gl;
    const m = typeof mesh === "string" ? this.meshes[mesh] : mesh;
    if (!m) return;
    const c = typeof color === "string" ? hexRgb(color) : color;
    gl.uniformMatrix4fv(this.loc.uModel, false, model);
    gl.uniform3fv(this.loc.uColor, c);
    gl.uniform1f(this.loc.uShine, o.shine ?? 0.15);
    gl.uniform1f(this.loc.uEmissive, o.emissive ?? 0);
    gl.uniform1f(this.loc.uAlpha, o.alpha ?? 1);
    gl.uniform1f(this.loc.uUnlit, o.unlit ? 1 : 0);
    gl.uniform1f(this.loc.uFogK, o.noFog ? 0 : 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, o.tex ?? this.white);
    gl.uniform1i(this.loc.uTex, 0);
    gl.uniform1f(this.loc.uUseTex, o.tex ? 1 : 0);
    const bind = (b: WebGLBuffer, loc: number, n: number) => {
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
    };
    bind(m.vao.pos, this.attr.pos, 3);
    bind(m.vao.nor, this.attr.nor, 3);
    bind(m.vao.uv, this.attr.uv, 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.vao.idx);
    const soft = (o.alpha ?? 1) < 1 || o.noDepth;
    if (soft) gl.depthMask(false);
    if (o.noDepth) gl.disable(gl.DEPTH_TEST);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
    if (o.noDepth) gl.enable(gl.DEPTH_TEST);
    if (soft) gl.depthMask(true);
  }

  /** Ombra morbida a macchia sul terreno (y = 0.002). */
  shadow(at: Vec3, rx: number, rz: number, alpha = 0.35) {
    this.draw("disc", basis([at[0], 0.003, at[2]], [rx, 0, 0], [0, 0, rz], [0, -1, 0]), [0, 0, 0], { alpha, unlit: true });
  }

  /** Capsula fra due punti. */
  capsule(a: Vec3, b: Vec3, r: number, color: Vec3 | string, o: DrawOpts = {}) {
    this.draw("tube", segment(a, b, r), color, o);
    this.draw("sphere", trs(a, 0, [r, r, r]), color, o);
    this.draw("sphere", trs(b, 0, [r, r, r]), color, o);
  }
}

export function hexRgb(hex: string): Vec3 {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return [0.6, 0.6, 0.6];
  const n = Number.parseInt(m[1], 16);
  const lin = (v: number) => (v / 255) ** 1.12;
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}

/** Texture disegnata su una tela 2D (anelli del bersaglio, paglia, erba). */
export function canvasTexture(size: number, paint: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  paint(ctx, size);
  return c;
}

// ── freccia di legno (modello CC0) ────────────────────────────────────────────
let arrowGeoPromise: Promise<Geo> | null = null;
let arrowImgPromise: Promise<HTMLImageElement> | null = null;

function b64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** Geometria della freccia di legno: cocca a z=0, punta a z=1. */
export function loadWoodenArrow() {
  arrowGeoPromise ??= fetch("/models/wooden-arrow.json")
    .then((r) => r.json() as Promise<{ pos: string; nor: string; uv: string; idx: string }>)
    .then((j) => ({ pos: new Float32Array(b64(j.pos)), nor: new Float32Array(b64(j.nor)), uv: new Float32Array(b64(j.uv)), idx: new Uint16Array(b64(j.idx)) }));
  arrowImgPromise ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = "/models/wooden-arrow.jpg";
  });
  return Promise.all([arrowGeoPromise, arrowImgPromise]);
}
