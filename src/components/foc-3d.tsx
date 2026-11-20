import { useEffect, type RefObject } from "react";
import { useOrbitGestures, type OrbitView } from "@/lib/arcieri/gestures";

/**
 * Due animazioni 3D per il FOC, disegnate su canvas con una piccola proiezione prospettica.
 * - Equilibrio: la freccia sul fulcro a metà pende in avanti, il fulcro scivola fino al punto
 *   di equilibrio e la freccia si raddrizza oscillando. La camera gira piano intorno.
 * - Gittata: la freccia vola sul campo fino al bersaglio; la curva e l'oscillazione in volo
 *   dipendono da peso, libbre e FOC.
 */
type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

function camera(eye: V, target: V, fovDeg: number, w: number, h: number) {
  const f = norm(sub(target, eye));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const focal = h / 2 / Math.tan((fovDeg * Math.PI) / 360);
  return (p: V) => {
    const d = sub(p, eye);
    const z = Math.max(0.05, dot(d, f));
    return { x: w / 2 + (dot(d, r) / z) * focal, y: h / 2 - (dot(d, u) / z) * focal, z, k: focal / z };
  };
}

/** Applica alla camera la vista scelta con le dita: giro attorno al centro, inclinazione, zoom, spostamento. */
function orbit(eye: V, target: V, view: OrbitView): { eye: V; target: V } {
  const d = sub(eye, target);
  const c = Math.cos(view.yaw);
  const s = Math.sin(view.yaw);
  const rx = d[0] * c - d[2] * s;
  const rz = d[0] * s + d[2] * c;
  const flat = Math.hypot(rx, rz) || 1e-6;
  const len = Math.hypot(d[0], d[1], d[2]) / view.zoom;
  const elev = Math.max(-0.15, Math.min(1.45, Math.atan2(d[1], flat) + view.pitch));
  const nd: V = [(rx / flat) * Math.cos(elev) * len, Math.sin(elev) * len, (rz / flat) * Math.cos(elev) * len];
  const f = norm([-nd[0], -nd[1], -nd[2]]);
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const k = len * 0.0022;
  const shift: V = [(-view.px * r[0] + view.py * u[0]) * k, (-view.px * r[1] + view.py * u[1]) * k, (-view.px * r[2] + view.py * u[2]) * k];
  const t2: V = [target[0] + shift[0], target[1] + shift[1], target[2] + shift[2]];
  return { eye: [t2[0] + nd[0], t2[1] + nd[1], t2[2] + nd[2]], target: t2 };
}

function useCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, view: OrbitView) => void, deps: unknown[]) {
  const { ref, view } = useOrbitGestures<HTMLCanvasElement>();
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduce = typeof matchMedia !== "undefined" && (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "ridotta");
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      draw(ctx, w, h, reduce ? 4.5 : (now - t0) / 1000, view.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

const FLETCH = "#d63a2f";

/** Freccia 3D: asta lungo una direzione, tre penne che girano attorno all'asta, punta e cocca. */
function drawArrow(ctx: CanvasRenderingContext2D, P: ReturnType<typeof camera>, nock: V, dir: V, len: number, spin: number, radius = 0.022) {
  const d = norm(dir);
  // due vettori perpendicolari all'asta per le penne
  const a = norm(Math.abs(d[1]) < 0.9 ? cross(d, [0, 1, 0]) : cross(d, [1, 0, 0]));
  const b = cross(d, a);
  const at = (s: number, rad = 0, ang = 0): V => [
    nock[0] + d[0] * s + (a[0] * Math.cos(ang) + b[0] * Math.sin(ang)) * rad,
    nock[1] + d[1] * s + (a[1] * Math.cos(ang) + b[1] * Math.sin(ang)) * rad,
    nock[2] + d[2] * s + (a[2] * Math.cos(ang) + b[2] * Math.sin(ang)) * rad,
  ];
  const n0 = P(at(0));
  const n1 = P(at(len));
  const vanes = [0, 1, 2].map((i) => {
    const ang = spin + (i * 2 * Math.PI) / 3;
    const quad = [at(len * 0.04), at(len * 0.16), at(len * 0.13, len * 0.055, ang), at(len * 0.06, len * 0.05, ang)].map(P);
    const depth = P(at(len * 0.1, len * 0.04, ang)).z;
    return { quad, depth, lit: 0.6 + 0.4 * Math.cos(ang - 0.8) };
  });
  const mid = P(at(len * 0.1)).z;
  const back = vanes.filter((v) => v.depth >= mid);
  const front = vanes.filter((v) => v.depth < mid);
  const paintVane = (v: (typeof vanes)[number]) => {
    ctx.beginPath();
    v.quad.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = FLETCH;
    ctx.globalAlpha = 0.55 + 0.45 * v.lit;
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  back.forEach(paintVane);
  const wpx = Math.max(1.5, radius * 2 * ((n0.k + n1.k) / 2));
  ctx.lineCap = "round";
  ctx.strokeStyle = "#15191d";
  ctx.lineWidth = wpx;
  ctx.beginPath();
  ctx.moveTo(n0.x, n0.y);
  ctx.lineTo(n1.x, n1.y);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(0.6, wpx * 0.3);
  ctx.beginPath();
  ctx.moveTo(n0.x, n0.y - wpx * 0.25);
  ctx.lineTo(n1.x, n1.y - wpx * 0.25);
  ctx.stroke();
  // punta
  const t1 = P(at(len + len * 0.05));
  ctx.strokeStyle = "#c9d0d8";
  ctx.lineWidth = wpx * 1.1;
  ctx.beginPath();
  ctx.moveTo(n1.x, n1.y);
  ctx.lineTo(t1.x, t1.y);
  ctx.stroke();
  // cocca
  const c1 = P(at(len * 0.035));
  ctx.strokeStyle = "#f2c94c";
  ctx.lineWidth = wpx * 1.25;
  ctx.beginPath();
  ctx.moveTo(n0.x, n0.y);
  ctx.lineTo(c1.x, c1.y);
  ctx.stroke();
  front.forEach(paintVane);
}

const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));

/** Equilibrio: L = lunghezza, B = punto di equilibrio dalla cocca (stesse unità). */
export function FocBalance3D({ L, B, foc }: { L: number; B: number; foc: number }) {
  const ref = useCanvas(
    (ctx, w, h, time, view) => {
      const cycle = 6.5;
      const t = time % cycle;
      const yaw = -0.55 + (view.touched ? 0 : Math.sin(time * 0.35) * 0.35);
      const cam = orbit([Math.sin(yaw) * 3.1, 1.05, -Math.cos(yaw) * 3.1], [0.05, -0.15, 0], view);
      const P = camera(cam.eye, cam.target, 38, w, h);
      const toX = (cm: number) => (cm / L) * 2 - 1; // cocca a -1, fine asta a +1
      const xb = toX(B);
      // fase 1: sul fulcro a metà la freccia pende in avanti; fase 2: il fulcro va al punto giusto
      const slide = ease((t - 1.1) / 1.2);
      const fx = slide * xb;
      const lean = -Math.min(0.32, Math.max(0.05, Math.abs(xb) * 2.2)) * Math.sign(xb || 1);
      let ang: number;
      if (t < 1.1) ang = lean * ease(t / 0.9);
      else {
        const s = Math.max(0, t - 1.6);
        ang = t < 1.6 ? lean * (1 - ease((t - 1.1) / 0.5) * 0.6) : lean * 0.4 * Math.exp(-2.6 * s) * Math.cos(7 * s);
      }
      // pavimento: ombra e piano
      const floorY = -0.62;
      ctx.save();
      const g0 = P([0, floorY, 0]);
      const grd = ctx.createRadialGradient(g0.x, g0.y, 4, g0.x, g0.y, w * 0.55);
      grd.addColorStop(0, "rgba(124,240,168,0.10)");
      grd.addColorStop(1, "rgba(124,240,168,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let i = -6; i <= 6; i++) {
        const a1 = P([i * 0.25, floorY, -1.2]);
        const a2 = P([i * 0.25, floorY, 1.2]);
        const b1 = P([-1.5, floorY, i * 0.2]);
        const b2 = P([1.5, floorY, i * 0.2]);
        ctx.beginPath();
        ctx.moveTo(a1.x, a1.y);
        ctx.lineTo(a2.x, a2.y);
        ctx.moveTo(b1.x, b1.y);
        ctx.lineTo(b2.x, b2.y);
        ctx.stroke();
      }
      ctx.restore();
      // ombra della freccia
      const s1 = P([-1, floorY, 0]);
      const s2 = P([1, floorY, 0]);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
      // fulcro: prisma triangolare metallico
      const top = 0;
      const half = 0.16;
      const base = floorY;
      const wide = 0.2;
      const faces: { pts: V[]; shade: number }[] = [
        { pts: [[fx, top, -half], [fx, top, half], [fx - wide, base, half], [fx - wide, base, -half]], shade: 0.55 },
        { pts: [[fx, top, -half], [fx, top, half], [fx + wide, base, half], [fx + wide, base, -half]], shade: 0.85 },
        { pts: [[fx, top, -half], [fx - wide, base, -half], [fx + wide, base, -half]], shade: 0.7 },
      ];
      faces
        .map((f) => ({ ...f, z: f.pts.reduce((a, p) => a + P(p).z, 0) / f.pts.length }))
        .sort((a, b) => b.z - a.z)
        .forEach((f) => {
          ctx.beginPath();
          f.pts.map(P).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
          const c = Math.round(120 + 110 * f.shade);
          ctx.fillStyle = `rgb(${c},${c + 6},${c + 12})`;
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.25)";
          ctx.lineWidth = 0.8;
          ctx.stroke();
        });
      // freccia ruotata attorno al fulcro
      const r = 0.03;
      const rot = (x: number): V => [fx + (x - fx) * Math.cos(ang), r + (x - fx) * Math.sin(ang), 0];
      const nock = rot(-1);
      const tip = rot(1);
      drawArrow(ctx, P, nock, sub(tip, nock), 2, time * 0.6, 0.026);
      // segni: metà e punto di equilibrio
      const mark = (x: number, color: string, label: string, up: number) => {
        const p = rot(x);
        const a = P([p[0], p[1] + 0.06, 0]);
        const b = P([p[0], p[1] + up, 0]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, b.x, b.y - 5);
      };
      mark(0, "rgba(255,255,255,0.6)", "metà", 0.42);
      mark(xb, "#7cf0a8", "equilibrio", 0.62);
      if (slide > 0.9) {
        const a = P(rot(0));
        const b = P(rot(xb));
        ctx.globalAlpha = Math.min(1, (slide - 0.9) * 10);
        ctx.strokeStyle = "#7cf0a8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - 16);
        ctx.lineTo(b.x, b.y - 16);
        ctx.stroke();
        ctx.fillStyle = "#7cf0a8";
        ctx.font = "800 13px system-ui, sans-serif";
        ctx.fillText(`${foc.toFixed(1).replace(".", ",")}%`, (a.x + b.x) / 2, Math.min(a.y, b.y) - 22);
        ctx.globalAlpha = 1;
      }
    },
    [L, B, foc],
  );
  return <Stage3D canvasRef={ref} className="h-56" label="Animazione 3D del punto di equilibrio" />;
}

/** Gittata: distanza in metri, velocità in m/s, FOC in %. */
export function FocFlight3D({ distance, speed, foc }: { distance: number; speed: number; foc: number }) {
  const ref = useCanvas(
    (ctx, w, h, time, view) => {
      const g = 9.81;
      const D = distance;
      const v = Math.max(20, speed);
      const s2 = Math.min(1, (g * D) / (v * v));
      const theta = 0.5 * Math.asin(s2);
      const tf = D / (v * Math.cos(theta));
      // riproduzione: il volo dura 1,6–2,6 s sullo schermo, poi una pausa
      const play = Math.min(2.6, Math.max(1.6, tf * 2.2));
      const cycle = play + 1.4;
      const t = time % cycle;
      const k = Math.min(1, t / play);
      const zAt = (u: number) => D * u;
      const peak = (v * v * Math.sin(theta) ** 2) / (2 * g);
      // altezza ingrandita: su 70 m la freccia sale di 1–2 m, invisibile senza esagerare
      const ex = Math.max(1, Math.min(8, (D * 0.07) / Math.max(0.05, peak)));
      const yAt = (u: number) => 1.5 * Math.max(1, D / 22) + ex * (Math.tan(theta) * D * u - (g * (D * u) ** 2) / (2 * v * v * Math.cos(theta) ** 2));
      const swing = view.touched ? 0 : Math.sin(time * 0.3) * 0.12;
      const cam = orbit([D * 0.8 * Math.cos(swing), 2.5 + D * 0.13, D * 0.45 + Math.sin(swing) * D * 0.3], [0, Math.max(1, D / 22) * 1.5 + peak * ex * 0.7, D * 0.5], view);
      const P = camera(cam.eye, cam.target, 54, w, h);
      // freccia e bersaglio più grandi del vero, per vederli anche a 70–90 m
      const big = Math.max(1, D / 22);
      // cielo e prato
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "rgba(91,143,240,0.22)");
      sky.addColorStop(0.55, "rgba(91,143,240,0.04)");
      sky.addColorStop(0.56, "rgba(63,138,78,0.20)");
      sky.addColorStop(1, "rgba(46,107,52,0.35)");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      // corsia e linee delle distanze
      ctx.lineWidth = 1;
      for (let z = 0; z <= D + 0.01; z += D > 40 ? 10 : 5) {
        const a = P([-4, 0, z]);
        const b = P([4, 0, z]);
        ctx.strokeStyle = z === 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.18)";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        if (z > 0) {
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.font = "10px system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(`${z} m`, b.x + 4, b.y + 3);
        }
      }
      for (const x of [-4, 4]) {
        const a = P([x, 0, 0]);
        const b = P([x, 0, D + 2]);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      // bersaglio sul cavalletto
      const legs: [V, V][] = [
        [[-0.5 * big, 0, D + 0.4 * big], [-0.25 * big, 1.9 * big, D]],
        [[0.5 * big, 0, D + 0.4 * big], [0.25 * big, 1.9 * big, D]],
      ];
      ctx.strokeStyle = "#8a5a2e";
      ctx.lineWidth = 3;
      legs.forEach(([a, b]) => {
        const pa = P(a);
        const pb = P(b);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      });
      const rings = ["#f4f1ea", "#1d2126", "#2f7fd1", "#d63a2f", "#f2c94c"];
      rings.forEach((c, i) => {
        const r = 0.61 * big * (1 - i * 0.2);
        ctx.beginPath();
        for (let j = 0; j <= 28; j++) {
          const an = (j / 28) * Math.PI * 2;
          const p = P([Math.cos(an) * r, 1.5 * big + Math.sin(an) * r, D]);
          if (j) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        }
        ctx.fillStyle = c;
        ctx.fill();
      });
      // arciere stilizzato sulla linea
      const arch = (p: V) => P([p[0] * big, p[1] * big, p[2] * big]);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2.4;
      const body: [V, V][] = [
        [[0.6, 0, -0.4], [0.6, 1.0, -0.4]],
        [[0.6, 1.0, -0.4], [0.6, 1.55, -0.4]],
        [[0.6, 1.45, -0.4], [0.15, 1.5, 0.05]],
      ];
      body.forEach(([a, b]) => {
        const pa = arch(a);
        const pb = arch(b);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      });
      const head = arch([0.6, 1.72, -0.4]);
      ctx.beginPath();
      ctx.arc(head.x, head.y, Math.max(2.5, 0.13 * head.k), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fill();
      // traiettoria: tratteggio completo e scia percorsa
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        const p = P([0, yAt(u), zAt(u)]);
        if (i) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const trail = ctx.createLinearGradient(P([0, yAt(0), 0]).x, 0, P([0, yAt(k), zAt(k)]).x, 0);
      trail.addColorStop(0, "rgba(124,240,168,0)");
      trail.addColorStop(1, "rgba(124,240,168,0.85)");
      ctx.strokeStyle = trail;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const u = (i / 40) * k;
        const p = P([0, yAt(u), zAt(u)]);
        if (i) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
      // freccia: segue la tangente, con un'oscillazione che si spegne prima se il FOC è alto
      const u = k;
      const dy = (yAt(Math.min(1, u + 0.01)) - yAt(Math.max(0, u - 0.01))) / 0.02;
      const dir: V = [0, dy, D];
      const damp = 2 + Math.max(0, foc) * 0.45;
      const amp = Math.max(0.02, 0.22 - foc * 0.011);
      const wob = amp * Math.exp(-damp * u) * Math.sin(u * 38);
      const dWob: V = norm([wob * D * 0.2, dir[1], dir[2]]);
      const len = 0.9 * big;
      const tipPos: V = [0, yAt(u), zAt(u)];
      const nock: V = [tipPos[0] - dWob[0] * len, tipPos[1] - dWob[1] * len, tipPos[2] - dWob[2] * len];
      drawArrow(ctx, P, nock, dWob, len, time * 9, 0.03 * big);
      if (ex > 1.05) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`altezza ×${ex.toFixed(0)}`, w - 8, 14);
      }
      if (k >= 1) {
        const hit = P([0, 1.5 * big, D]);
        const pulse = (t - play) / 1.4;
        ctx.strokeStyle = `rgba(124,240,168,${1 - pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, 6 + pulse * 26, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    [distance, speed, foc],
  );
  return <Stage3D canvasRef={ref} className="h-60" label="Animazione 3D del volo della freccia" />;
}

/** Velocità stimata (m/s) da libbre e peso della freccia: arco tradizionale/ricurvo, resa ~75%. */
export function estimateSpeed(lb: number, grains: number) {
  if (!(lb > 0 && grains > 0)) return 0;
  const force = lb * 4.448;
  const stored = 0.5 * force * 0.5 * 1.1;
  const mass = grains * 6.48e-5;
  return Math.sqrt((2 * 0.75 * stored) / mass);
}

/** Tela 3D con l'aiuto dei gesti: un dito gira, due dita ingrandiscono e spostano, doppio tocco ripristina. */
function Stage3D({ canvasRef, className, label }: { canvasRef: RefObject<HTMLCanvasElement | null>; className: string; label: string }) {
  return (
    <div className="aa-3d-wrap">
      <canvas ref={canvasRef} className={`aa-3d block w-full rounded-2xl ${className}`} style={{ touchAction: "none" }} aria-label={`${label}: trascina per ruotare, due dita per ingrandire e spostare, doppio tocco per ripristinare`} />
      <span className="pointer-events-none absolute bottom-1.5 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[0.62rem] text-white/80">Trascina per girare · due dita zoom · doppio tocco ripristina</span>
    </div>
  );
}
