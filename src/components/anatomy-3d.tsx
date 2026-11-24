import { useEffect, useRef, useState } from "react";
import { buildModel, v3, type Model, type Part, type V3 } from "@/lib/arcieri/anatomy-model";
import type { Hand, Landmark } from "@/lib/arcieri/pose-analysis";
import { unpackLm, type PackedLm } from "@/lib/arcieri/gesture-record";
import { cx } from "./kit";

/**
 * Analisi del gesto in 3D: corpo traslucido con scheletro e muscoli al lavoro, arco e freccia,
 * quote come in un laboratorio (angoli dei gomiti, spalle, testa, anca, allungo, ancoraggio).
 * Segue i punti registrati: dal vivo, dal video o dalla sequenza salvata nello storico.
 * Le profondità arrivano da una ripresa 2D: sono stime.
 */

type Layer = "pelle" | "muscolo" | "osso" | "quote";
type Seq = { t: number; lm: PackedLm }[];

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
    // muscolo: fibre lungo l'asse e luce che cresce con lo sforzo
    float fib = 0.82 + 0.18 * sin(vO.y * 55.0 + vO.x * 9.0);
    col = uColor * (0.3 + dif * 0.6) * fib + uColor * uAct * 0.55 + vec3(1.0, 0.75, 0.55) * rim * 0.3;
    a = uAlpha;
  } else {
    col = uColor * (0.4 + dif * 0.6) + rim * 0.15;
    a = uAlpha;
  }
  gl_FragColor = vec4(col, a);
}`;

function sphereMesh(lat = 18, lon = 28) {
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

function torusMesh(R = 1, r = 0.07, seg = 44, tube = 8) {
  const p: number[] = [];
  const n: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const u = (i / seg) * Math.PI * 2;
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

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function lookAt(eye: V3, at: V3) {
  const z = v3.norm(v3.sub(eye, at));
  const x = v3.norm(v3.cross([0, 1, 0], z));
  const y = v3.cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -v3.dot(x, eye), -v3.dot(y, eye), -v3.dot(z, eye), 1]);
}
function mul4(a: Float32Array, b: Float32Array) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}

/** punti al tempo t della sequenza salvata, interpolati */
function seqAt(seq: Seq, t: number): Landmark[] | null {
  if (!seq.length) return null;
  if (seq.length === 1 || t <= seq[0].t) return unpackLm(seq[0].lm);
  for (let i = 1; i < seq.length; i++) {
    if (t <= seq[i].t) {
      const a = seq[i - 1], b = seq[i];
      const k = (t - a.t) / Math.max(1e-3, b.t - a.t);
      const out = a.lm.map((v, j) => v + (b.lm[j] - v) * k);
      return unpackLm(out);
    }
  }
  return unpackLm(seq[seq.length - 1].lm);
}

const VIEWS = [
  { id: "fronte", label: "Fronte", yaw: 0.35, pitch: 0.1 },
  { id: "lato", label: "Lato", yaw: Math.PI / 2, pitch: 0.08 },
  { id: "dietro", label: "Dietro", yaw: Math.PI - 0.35, pitch: 0.12 },
  { id: "alto", label: "Dall'alto", yaw: 0.5, pitch: 1.05 },
] as const;

export function Anatomy3D({
  lm = null,
  lmRef,
  seq,
  aspect,
  hand,
  className = "h-[26rem]",
}: {
  lm?: Landmark[] | null;
  lmRef?: { current: Landmark[] | null };
  seq?: Seq | null;
  aspect: number;
  hand: Hand;
  className?: string;
}) {
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const hudCanvas = useRef<HTMLCanvasElement>(null);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ pelle: true, muscolo: true, osso: true, quote: true });
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const cam = useRef({ yaw: 0.35, pitch: 0.1, zoom: 1, auto: true });
  const [auto, setAuto] = useState(true);
  const [failed, setFailed] = useState(false);
  const [empty, setEmpty] = useState(false);
  const emptyRef = useRef(false);
  const input = useRef({ lm, lmRef, seq, aspect, hand });
  input.current = { lm, lmRef, seq, aspect, hand };

  useEffect(() => {
    const canvas = glCanvas.current;
    const hud = hudCanvas.current;
    if (!canvas || !hud) return;
    const gl = canvas.getContext("webgl", { antialias: true, premultipliedAlpha: false, alpha: true });
    const ctx = hud.getContext("2d");
    if (!gl || !ctx) {
      setFailed(true);
      return;
    }
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
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
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
    const meshes = { sphere: upload(sphereMesh()), torus: upload(torusMesh()) };
    let bound = "";
    const bind = (name: "sphere" | "torus") => {
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

    let raf = 0;
    let smooth: Landmark[] | null = null;
    let model: Model | null = null;
    let last = performance.now();
    const t0 = last;
    const draw = (p: Part) => {
      bind(p.mesh);
      gl.uniformMatrix4fv(loc.uM, false, p.m);
      gl.uniformMatrix3fv(loc.uNM, false, p.nm);
      gl.uniform3fv(loc.uColor, p.color);
      gl.uniform1f(loc.uMode, p.mode);
      gl.uniform1f(loc.uAlpha, p.alpha);
      gl.uniform1f(loc.uAct, p.act);
      gl.drawElements(gl.TRIANGLES, meshes[p.mesh].count, gl.UNSIGNED_SHORT, 0);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const time = (now - t0) / 1000;
      const { lm: still, lmRef: ref, seq: sq, aspect: asp, hand: hd } = input.current;
      // punti da mostrare: sequenza salvata (in ciclo), poi quelli dal vivo, poi quelli fissi
      let target: Landmark[] | null = null;
      if (sq && sq.length > 1) {
        const end = sq[sq.length - 1].t + 0.9;
        target = seqAt(sq, time % end);
      } else target = ref?.current ?? still;
      if (target) {
        smooth = !smooth || smooth.length !== target.length ? target.map((p) => ({ ...p })) : smooth.map((p, i) => ({ x: p.x + (target![i].x - p.x) * 0.35, y: p.y + (target![i].y - p.y) * 0.35, z: (p.z ?? 0) + ((target![i].z ?? 0) - (p.z ?? 0)) * 0.35, visibility: target![i].visibility }));
        model = buildModel(smooth, asp, hd) ?? model;
      }
      if (emptyRef.current !== !model) {
        emptyRef.current = !model;
        setEmpty(!model);
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const H = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      if (hud.width !== W || hud.height !== H) {
        hud.width = W;
        hud.height = H;
      }
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!model) return;

      const c = cam.current;
      if (c.auto) c.yaw += dt * 0.35;
      const target3: V3 = [model.center[0], model.height * 0.5, model.center[2]];
      const fov = (34 * Math.PI) / 180;
      const fit = (model.height * 0.62) / Math.tan(fov / 2) / Math.min(1, W / H + 0.15);
      const dist = Math.max(1.6, fit) / c.zoom;
      const eye: V3 = [target3[0] + Math.sin(c.yaw) * Math.cos(c.pitch) * dist, target3[1] + Math.sin(c.pitch) * dist, target3[2] + Math.cos(c.yaw) * Math.cos(c.pitch) * dist];
      const VP = mul4(perspective(fov, W / H, 0.05, 30), lookAt(eye, target3));
      gl.uniformMatrix4fv(loc.uVP, false, VP);
      gl.uniform3fv(loc.uEye, eye);
      gl.uniform1f(loc.uTime, time);
      bound = "";

      const L = layersRef.current;
      const show = (p: Part) => (p.layer === "arco" ? true : p.layer === "osso" ? L.osso : p.layer === "muscolo" ? L.muscolo : L.pelle);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      // ossa, arco e muscoli scrivono la profondità; la pelle si somma sopra come vetro
      gl.depthMask(true);
      gl.disable(gl.CULL_FACE);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      for (const p of model.parts) if ((p.layer === "osso" || p.layer === "arco") && show(p)) draw(p);
      for (const p of model.parts) if (p.layer === "muscolo" && show(p)) draw(p);
      // pelle in due passate: prima la sola profondità, poi il colore solo sulla superficie più esterna,
      // così le parti che si sovrappongono (busto, collo, braccia) sembrano un corpo unico
      gl.disable(gl.CULL_FACE);
      gl.colorMask(false, false, false, false);
      for (const p of model.parts) if (p.layer === "pelle" && show(p)) draw(p);
      gl.colorMask(true, true, true, true);
      gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      // senza muscoli e ossa la pelle è l'unica cosa: un po' più presente
      for (const p of model.parts) if (p.layer === "pelle" && show(p)) draw({ ...p, alpha: L.osso || L.muscolo ? p.alpha : 1 });
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);

      // ---------- quote (2D sopra la scena) ----------
      const proj = (p: V3): [number, number, number] => {
        const x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12];
        const y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13];
        const w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
        return [((x / w) * 0.5 + 0.5) * W, (1 - ((y / w) * 0.5 + 0.5)) * H, w];
      };
      const hudD = model.hud;
      ctx.lineWidth = 1.2 * dpr;
      // anelli a terra
      for (const [r, a] of [[0.45, 0.55], [0.62, 0.3], [0.8, 0.16]] as const) {
        ctx.strokeStyle = `rgba(95,212,255,${a})`;
        ctx.setLineDash(r > 0.5 ? [4 * dpr, 5 * dpr] : []);
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const an = (i / 64) * Math.PI * 2;
          const q = proj([hudD.feet[0] + Math.cos(an) * r, 0.002, hudD.feet[2] + Math.sin(an) * r]);
          if (i) ctx.lineTo(q[0], q[1]);
          else ctx.moveTo(q[0], q[1]);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (let i = 0; i < 24; i++) {
        const an = (i / 24) * Math.PI * 2 + time * 0.2;
        const a = proj([hudD.feet[0] + Math.cos(an) * 0.45, 0.002, hudD.feet[2] + Math.sin(an) * 0.45]);
        const b = proj([hudD.feet[0] + Math.cos(an) * 0.5, 0.002, hudD.feet[2] + Math.sin(an) * 0.5]);
        ctx.strokeStyle = "rgba(95,212,255,0.55)";
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      if (!L.quote) return;
      // archi degli angoli ai gomiti
      for (const a of hudD.arcs) {
        const o = proj(a.at);
        const p1 = proj(a.a);
        const p2 = proj(a.b);
        const a1 = Math.atan2(p1[1] - o[1], p1[0] - o[0]);
        let a2 = Math.atan2(p2[1] - o[1], p2[0] - o[0]);
        let d = a2 - a1;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        a2 = a1 + d;
        ctx.strokeStyle = "rgba(255,214,120,0.9)";
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.arc(o[0], o[1], 16 * dpr, Math.min(a1, a2), Math.max(a1, a2));
        ctx.stroke();
      }
      // quota dell'allungo
      ctx.font = `600 ${11 * dpr}px system-ui, sans-serif`;
      for (const d of hudD.dims) {
        const a = proj(d.a);
        const b = proj(d.b);
        const nx = -(b[1] - a[1]);
        const ny = b[0] - a[0];
        const nl = Math.hypot(nx, ny) || 1;
        const off = 18 * dpr;
        const ox = (nx / nl) * off * (ny / nl > 0 ? -1 : 1);
        const oy = (ny / nl) * off * (ny / nl > 0 ? -1 : 1);
        ctx.strokeStyle = "rgba(255,214,120,0.95)";
        ctx.lineWidth = 1.2 * dpr;
        ctx.setLineDash([5 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(a[0] + ox, a[1] + oy);
        ctx.lineTo(b[0] + ox, b[1] + oy);
        ctx.stroke();
        ctx.setLineDash([]);
        for (const q of [a, b]) {
          ctx.beginPath();
          ctx.moveTo(q[0], q[1]);
          ctx.lineTo(q[0] + ox * 1.3, q[1] + oy * 1.3);
          ctx.stroke();
        }
      }
      // etichette con linea guida: a sinistra o a destra della figura, senza sovrapporsi
      const mid = proj(model.center)[0];
      const items = [...hudD.labels, ...hudD.dims.map((d) => ({ at: v3.lerp(d.a, d.b, 0.55), text: d.text, tone: "gold" as const }))].map((l) => {
        const p = proj(l.at);
        return { ...l, p, side: p[0] < mid ? -1 : 1 };
      });
      for (const side of [-1, 1]) {
        const col = items.filter((i) => i.side === side).sort((a, b) => a.p[1] - b.p[1]);
        let y = -1e9;
        for (const it of col) {
          const ty = Math.max(it.p[1] - 14 * dpr, y + 24 * dpr);
          y = ty;
          ctx.font = `600 ${11 * dpr}px system-ui, sans-serif`;
          const tw = ctx.measureText(it.text).width + 12 * dpr;
          // la casella resta dentro il riquadro: la linea guida arriva al suo bordo
          const tx = side < 0 ? Math.max(4 * dpr + tw, it.p[0] - 70 * dpr) : Math.min(W - 4 * dpr - tw, it.p[0] + 70 * dpr);
          ctx.strokeStyle = it.tone === "warn" ? "rgba(255,160,110,0.9)" : it.tone === "gold" ? "rgba(255,214,120,0.9)" : "rgba(95,212,255,0.85)";
          ctx.lineWidth = 1 * dpr;
          ctx.beginPath();
          ctx.moveTo(it.p[0], it.p[1]);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.fillStyle = ctx.strokeStyle;
          ctx.beginPath();
          ctx.arc(it.p[0], it.p[1], 2.5 * dpr, 0, Math.PI * 2);
          ctx.fill();
          tag(ctx, it.text, tx, ty, it.tone, dpr, false, side);
        }
      }
    };
    raf = requestAnimationFrame(frame);

    // gira con un dito, avvicina con due
    const ptrs = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      cam.current.auto = false;
      setAuto(false);
    };
    const move = (e: PointerEvent) => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) cam.current.zoom = Math.max(0.7, Math.min(2.6, cam.current.zoom * (d / pinch)));
        pinch = d;
        return;
      }
      cam.current.yaw -= (e.clientX - prev.x) * 0.01;
      cam.current.pitch = Math.max(-0.2, Math.min(1.3, cam.current.pitch + (e.clientY - prev.y) * 0.006));
    };
    const up = (e: PointerEvent) => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = 0;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.current.zoom = Math.max(0.7, Math.min(2.6, cam.current.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  if (failed) return <p className="rounded-2xl bg-white/[0.04] p-3 text-sm text-muted">Il 3D non parte su questo telefono: le misure restano nell'analisi qui sopra.</p>;
  const toggle = (k: Layer) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  return (
    <div className={cx("relative w-full overflow-hidden rounded-2xl", className)} style={{ background: "radial-gradient(ellipse at 50% 38%, #12405e 0%, #082032 45%, #03090f 100%)" }}>
      <canvas ref={glCanvas} className="absolute inset-0 h-full w-full touch-none" aria-label="Analisi del gesto in 3D: corpo, scheletro e muscoli, da girare con il dito" />
      <canvas ref={hudCanvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      {empty ? <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-white/80">In attesa della posa: avvia il video o scegli un fotogramma.</p> : null}
      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
        {([["pelle", "Corpo"], ["muscolo", "Muscoli"], ["osso", "Scheletro"], ["quote", "Misure"]] as const).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={layers[k]} onClick={() => toggle(k)} className={cx("min-h-8 rounded-full px-2.5 text-[0.7rem] font-semibold backdrop-blur", layers[k] ? "bg-[#5fd4ff]/25 text-white ring-1 ring-[#5fd4ff]/60" : "bg-black/40 text-white/60")}>
            {label}
          </button>
        ))}
      </div>
      <div className="absolute inset-x-2 bottom-2 flex flex-wrap justify-center gap-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              cam.current = { ...cam.current, yaw: v.yaw, pitch: v.pitch, auto: false };
              setAuto(false);
            }}
            className="min-h-8 rounded-full bg-black/45 px-2.5 text-[0.7rem] font-semibold text-white backdrop-blur"
          >
            {v.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={auto}
          onClick={() => {
            cam.current.auto = !cam.current.auto;
            setAuto(cam.current.auto);
          }}
          className={cx("min-h-8 rounded-full px-2.5 text-[0.7rem] font-semibold backdrop-blur", auto ? "bg-[#5fd4ff]/30 text-white" : "bg-black/45 text-white")}
        >
          Gira
        </button>
      </div>
      <div className="pointer-events-none absolute right-2 top-2 grid gap-0.5 rounded-lg bg-black/40 px-2 py-1 text-[0.6rem] text-white/75 backdrop-blur">
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-[#ff7a45]" /> muscolo al lavoro</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-[#7a2a22]" /> a riposo</span>
      </div>
    </div>
  );
}

/** etichetta con fondo scuro e bordo del colore della misura */
function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tone: "cyan" | "gold" | "warn", dpr: number, center: boolean, side = 1) {
  ctx.font = `600 ${11 * dpr}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 12 * dpr;
  const h = 19 * dpr;
  const W = ctx.canvas.width;
  const bx = Math.max(4 * dpr, Math.min(W - w - 4 * dpr, center ? x - w / 2 : side < 0 ? x - w : x));
  const by = y - h / 2;
  ctx.fillStyle = "rgba(3,16,26,0.78)";
  ctx.fillRect(bx, by, w, h);
  ctx.strokeStyle = tone === "warn" ? "rgba(255,160,110,0.95)" : tone === "gold" ? "rgba(255,214,120,0.95)" : "rgba(95,212,255,0.9)";
  ctx.lineWidth = 1 * dpr;
  ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, bx + 6 * dpr, y + 0.5 * dpr);
}
