import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Face } from "@/lib/arcieri/scoring";

/**
 * Bersaglio in 3D con le frecce che arrivano e restano piantate.
 * Un dito: giri il bersaglio. Due dita: zoom. Doppio tocco: vista iniziale.
 * Tutto lo stato della camera vive in ref: niente render React a ogni movimento.
 */

type Shot = { x: number; y: number; end?: number; score?: number; miss?: boolean; color?: string; look?: ArrowLook };
/** Aspetto delle frecce dell'utente (dalla scheda dell'attrezzatura). */
export type ArrowLook = { shaft?: string; fletch?: string; cock?: string; nock?: string };
const DEFAULT_LOOK: Required<ArrowLook> = { shaft: "#1d1f22", fletch: "#d63a2f", cock: "#e6b325", nock: "#f4f1ea" };
const SHAFT_BY_MATERIAL: Record<string, string> = { legno: "#c99a5e", carbonio: "#1d1f22", alluminio: "#9aa7b2", "carbo-alluminio": "#5b6670", bambu: "#c9b46a" };
/** Dalla scheda JSON della freccia ai colori da disegnare. */
export function lookOf(specs: string | null | undefined): ArrowLook | undefined {
  if (!specs) return undefined;
  try {
    const sp = JSON.parse(specs) as Record<string, string>;
    return { shaft: sp.shaft || SHAFT_BY_MATERIAL[sp.material ?? ""] || undefined, fletch: sp.fletch || undefined, cock: sp.cock || undefined, nock: sp.nock || undefined };
  } catch {
    return undefined;
  }
}
/** Immagine da mettere sulla faccia (sagoma 3D): mezza larghezza e mezza altezza in unità faccia. */
export type Picture = { img: HTMLImageElement; halfW: number; halfH: number };
type V3 = [number, number, number];
type Cam = { yaw: number; pitch: number; dist: number };

const HOME: Cam = { yaw: 0.55, pitch: 0.16, dist: 3.4 };
const PRESETS: { id: string; label: string; cam: Cam }[] = [
  { id: "fronte", label: "Di fronte", cam: { yaw: 0, pitch: 0.04, dist: 3.1 } },
  { id: "tre", label: "Tre quarti", cam: HOME },
  { id: "lato", label: "Di lato", cam: { yaw: 1.45, pitch: 0.1, dist: 3.6 } },
  { id: "alto", label: "Dall'alto", cam: { yaw: 0.3, pitch: 1.2, dist: 3.8 } },
];

const GROUND = -1.86;
const CENTER: V3 = [0, -0.1, 0.35];
const FLY = 0.62;
const ARROW = 1.3;

export function Target3D({ face, shots, picture, look }: { face: Face; shots: Shot[]; picture?: Picture | null; look?: ArrowLook }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cam = useRef<Cam>({ ...HOME });
  const goal = useRef<Cam | null>(null);
  const spin = useRef({ yaw: 0, pitch: 0 });
  const dirty = useRef(true);
  const startedAt = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const auto = useRef(false);
  const [autoOn, setAutoOn] = useState(false);
  const [flying, setFlying] = useState(false);
  const flyingRef = useRef(false);
  const [end, setEnd] = useState<number | "tutte">("tutte");

  const ends = useMemo(() => [...new Set(shots.map((s) => s.end ?? 0))].sort((a, b) => a - b), [shots]);
  const shown = useMemo(() => (end === "tutte" ? shots : shots.filter((s) => (s.end ?? 0) === end)), [shots, end]);
  const arrows = useMemo(() => shown.map((shot, index) => arrowOf(shot, index, look)), [shown, look]);
  const sceneRef = useRef({ face, arrows, picture });
  sceneRef.current = { face, arrows, picture };
  useEffect(() => {
    dirty.current = true;
  }, [picture]);

  function replay() {
    startedAt.current = performance.now();
    flyingRef.current = true;
    setFlying(true);
    dirty.current = true;
  }

  useEffect(() => {
    replay();
  }, [arrows.length, end]);

  useEffect(() => {
    dirty.current = true;
  }, [face, arrows]);

  useEffect(() => {
    auto.current = autoOn;
    dirty.current = true;
  }, [autoOn]);

  // Misura: canvas nitido alla densità del telefono.
  useEffect(() => {
    const box = wrap.current;
    const el = canvas.current;
    if (!box || !el) return;
    const fit = () => {
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      const w = box.clientWidth;
      const h = Math.round(Math.min(520, Math.max(260, w * 0.78)));
      el.style.height = `${h}px`;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      dirty.current = true;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // Rotella del mouse: zoom (listener non passivo per fermare lo scroll).
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      goal.current = null;
      cam.current.dist = clamp(cam.current.dist * Math.exp(event.deltaY * 0.0012), 2.2, 14);
      dirty.current = true;
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  // Ciclo di disegno: gira sempre, disegna solo quando serve.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const c = cam.current;
      let moving = false;
      if (pointers.current.size === 0 && (Math.abs(spin.current.yaw) > 0.0004 || Math.abs(spin.current.pitch) > 0.0004)) {
        c.yaw += spin.current.yaw;
        c.pitch = clamp(c.pitch + spin.current.pitch, 0, 1.42);
        spin.current.yaw *= 0.92;
        spin.current.pitch *= 0.92;
        moving = true;
      }
      if (goal.current) {
        const g = goal.current;
        const k = 1 - Math.pow(0.0015, dt);
        c.yaw += shortAngle(c.yaw, g.yaw) * k;
        c.pitch += (g.pitch - c.pitch) * k;
        c.dist += (g.dist - c.dist) * k;
        if (Math.abs(shortAngle(c.yaw, g.yaw)) < 0.002 && Math.abs(g.pitch - c.pitch) < 0.002 && Math.abs(g.dist - c.dist) < 0.005) goal.current = null;
        moving = true;
      }
      if (auto.current && pointers.current.size === 0) {
        c.yaw += dt * 0.35;
        moving = true;
      }
      const { arrows: list } = sceneRef.current;
      const t = (now - startedAt.current) / 1000;
      const total = flightEnd(list.length);
      const animating = t < total;
      if (moving || animating || dirty.current) {
        dirty.current = false;
        draw(canvas.current, sceneRef.current.face, list, c, t, sceneRef.current.picture ?? null);
      }
      if (!animating && flyingRef.current) {
        flyingRef.current = false;
        setFlying(false);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function down(event: RPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    goal.current = null;
    spin.current = { yaw: 0, pitch: 0 };
    if (autoOn) setAutoOn(false);
    if (pointers.current.size === 2) pinch.current = spread();
    if (pointers.current.size === 1) {
      const now = performance.now();
      const tap = lastTap.current;
      if (now - tap.t < 320 && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) < 30) {
        goal.current = { ...HOME };
        lastTap.current = { t: 0, x: 0, y: 0 };
      } else {
        lastTap.current = { t: now, x: event.clientX, y: event.clientY };
      }
    }
  }

  function move(event: RPointerEvent<HTMLCanvasElement>) {
    const prev = pointers.current.get(event.pointerId);
    if (!prev) return;
    const next = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, next);
    const c = cam.current;
    if (pointers.current.size === 1) {
      const width = canvas.current?.clientWidth || 360;
      const k = 5.2 / width;
      const dy = -(next.x - prev.x) * k;
      const dp = (next.y - prev.y) * k * 0.8;
      c.yaw += dy;
      c.pitch = clamp(c.pitch + dp, 0, 1.42);
      spin.current = { yaw: dy, pitch: dp };
      dirty.current = true;
    } else if (pointers.current.size === 2 && pinch.current) {
      const now = spread();
      if (now > 0) {
        c.dist = clamp(c.dist * (pinch.current / now), 2.2, 14);
        pinch.current = now;
        dirty.current = true;
      }
    }
  }

  function up(event: RPointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1) spin.current = { yaw: 0, pitch: 0 };
  }

  function spread() {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  return (
    <div className="grid gap-2">
      {ends.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => setEnd("tutte")} className={`min-h-10 shrink-0 rounded-full px-3 text-sm ${end === "tutte" ? "bg-accent text-accent-fg" : "border border-line"}`}>Tutte</button>
          {ends.map((value) => (
            <button key={value} type="button" onClick={() => setEnd(value)} className={`min-h-10 shrink-0 rounded-full px-3 text-sm ${end === value ? "bg-accent text-accent-fg" : "border border-line"}`}>Volée {value + 1}</button>
          ))}
        </div>
      ) : null}
      <div ref={wrap} className="relative w-full overflow-hidden rounded-2xl">
        <canvas
          ref={canvas}
          className="block w-full cursor-grab touch-none select-none active:cursor-grabbing"
          style={{ touchAction: "none", WebkitUserSelect: "none" }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") up(event); }}
          onContextMenu={(event) => event.preventDefault()}
        />
        <div className="pointer-events-none absolute left-2 top-2 flex gap-2">
          <button type="button" onClick={replay} className="pointer-events-auto min-h-10 rounded-full bg-[#14181c]/80 px-3 text-sm font-semibold text-[#f4f1ea] backdrop-blur">
            {flying ? "In volo…" : "↻ Rivedi i tiri"}
          </button>
          <button type="button" onClick={() => setAutoOn((v) => !v)} className={`pointer-events-auto min-h-10 rounded-full px-3 text-sm font-semibold backdrop-blur ${autoOn ? "bg-[#e6b325] text-[#14181c]" : "bg-[#14181c]/80 text-[#f4f1ea]"}`}>
            {autoOn ? "■ Ferma" : "⟳ Giro"}
          </button>
        </div>
        <p className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-[#14181c]/70 px-2 py-0.5 text-[11px] text-[#f4f1ea]">
          {shown.length} frecce · un dito gira · due dita zoom · doppio tocco ripristina
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PRESETS.map((preset) => (
          <button key={preset.id} type="button" onClick={() => { setAutoOn(false); spin.current = { yaw: 0, pitch: 0 }; goal.current = { ...preset.cam }; }} className="min-h-10 shrink-0 rounded-full border border-line px-3 text-sm">
            {preset.label}
          </button>
        ))}
        <button type="button" onClick={() => { cam.current.dist = clamp(cam.current.dist * 0.8, 2.2, 14); dirty.current = true; }} className="min-h-10 w-10 shrink-0 rounded-full border border-line text-lg" aria-label="Avvicina">+</button>
        <button type="button" onClick={() => { cam.current.dist = clamp(cam.current.dist * 1.25, 2.2, 14); dirty.current = true; }} className="min-h-10 w-10 shrink-0 rounded-full border border-line text-lg" aria-label="Allontana">−</button>
      </div>
    </div>
  );
}

/* ---------- scena ---------- */

type Arrow = { hit: V3; dir: V3; color: string; hen: string; shaft: string; nockColor: string; roll: number; start: V3; arc: number; index: number };

/** Le frecce hanno i colori dell'attrezzatura dell'utente; un colore per persona solo nella vista di squadra. */
function arrowOf(shot: Shot, index: number, look?: ArrowLook): Arrow {
  // ogni freccia con i colori della sua serie, se nota; altrimenti quelli dell'assetto
  const L = { ...DEFAULT_LOOK, ...Object.fromEntries(Object.entries(shot.look ?? look ?? {}).filter(([, v]) => v)) } as Required<ArrowLook>;
  const r1 = hash(index * 7 + 1);
  const r2 = hash(index * 13 + 5);
  const r3 = hash(index * 3 + 11);
  // la freccia entra quasi dritta: un filo inclinata verso il basso e di lato
  const dir = norm([(r1 - 0.5) * 0.12 + shot.x * 0.03, (r2 - 0.5) * 0.08 + 0.05, 1]);
  return {
    hit: [shot.x, -shot.y, 0],
    dir,
    color: shot.color ?? L.cock,
    hen: shot.color ? "#f4f1ea" : L.fletch,
    shaft: L.shaft,
    nockColor: shot.color ?? L.nock,
    roll: r3 * Math.PI * 2,
    start: [shot.x * 0.15 + (r1 - 0.5) * 0.6, 0.5 + r2 * 0.4, 26],
    arc: 1.1 + r3 * 0.5,
    index,
  };
}

function stagger(n: number) {
  return n <= 1 ? 0 : Math.min(0.2, 2.4 / n);
}

function flightEnd(n: number) {
  return (Math.max(0, n - 1)) * stagger(n) + FLY + 0.6;
}

type Prim = { depth: number; paint: (ctx: CanvasRenderingContext2D) => void };

function draw(el: HTMLCanvasElement | null, face: Face, arrows: Arrow[], c: Cam, t: number, picture: Picture | null = null) {
  if (!el) return;
  const ctx = el.getContext("2d");
  if (!ctx) return;
  const w = el.width;
  const h = el.height;
  const eye: V3 = [
    CENTER[0] + c.dist * Math.cos(c.pitch) * Math.sin(c.yaw),
    CENTER[1] + c.dist * Math.sin(c.pitch),
    CENTER[2] + c.dist * Math.cos(c.pitch) * Math.cos(c.yaw),
  ];
  const f = norm(sub(CENTER, eye));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const F = h * 1.05;
  const NEAR = 0.08;
  const view = (p: V3): V3 => {
    const d = sub(p, eye);
    return [dot(d, r), dot(d, u), dot(d, f)];
  };
  const screen = (v: V3) => ({ x: w / 2 + (v[0] * F) / v[2], y: h / 2 - (v[1] * F) / v[2] });
  const poly = (pts: V3[]) => {
    const clipped = clipNear(pts.map(view), NEAR);
    return clipped.map(screen);
  };
  const fillPoly = (pts: { x: number; y: number }[], fill: string | CanvasGradient, stroke?: string, lw = 1) => {
    if (pts.length < 3) return;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  };
  const depthOf = (p: V3) => view(p)[2];
  /** L'immagine della sagoma sul piano z, a tasselli (ognuno con la sua trasformazione affine). */
  const paintPicture = (g: CanvasRenderingContext2D, pic: Picture, z: number, filter: string) => {
    const N = 8;
    const { img, halfW, halfH } = pic;
    if (!img.complete || !img.naturalWidth) return;
    const P = (u: number, v: number) => screen(view([-halfW + 2 * halfW * u, halfH - 2 * halfH * v, z]));
    if (![P(0, 0), P(1, 0), P(0, 1), P(1, 1)].every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))) return;
    const sw = img.naturalWidth / N;
    const sh = img.naturalHeight / N;
    for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) {
      const a = P(i / N, j / N);
      const b = P((i + 1) / N, j / N);
      const c2 = P(i / N, (j + 1) / N);
      const d = P((i + 1) / N, (j + 1) / N);
      g.save();
      if (filter) g.filter = filter;
      g.beginPath();
      // un pelo più grande per non vedere le cuciture
      const cx = (a.x + b.x + c2.x + d.x) / 4;
      const cy = (a.y + b.y + c2.y + d.y) / 4;
      const grow = (q: { x: number; y: number }) => {
        const l = Math.hypot(q.x - cx, q.y - cy) || 1;
        return { x: q.x + ((q.x - cx) / l) * 1.6, y: q.y + ((q.y - cy) / l) * 1.6 };
      };
      [grow(a), grow(b), grow(d), grow(c2)].forEach((q, k) => (k ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
      g.closePath();
      g.clip();
      g.setTransform((b.x - a.x) / sw, (b.y - a.y) / sw, (c2.x - a.x) / sh, (c2.y - a.y) / sh, a.x, a.y);
      // il tassello sorgente sborda di 1 px per coprire le cuciture
      const sx0 = Math.max(0, i * sw - 1);
      const sy0 = Math.max(0, j * sh - 1);
      g.drawImage(img, sx0, sy0, Math.min(img.naturalWidth - sx0, sw + 2), Math.min(img.naturalHeight - sy0, sh + 2), sx0 - i * sw, sy0 - j * sh, Math.min(img.naturalWidth - sx0, sw + 2), Math.min(img.naturalHeight - sy0, sh + 2));
      g.restore();
    }
  };

  // cielo
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#7fb6dc");
  sky.addColorStop(0.55, "#cfe6f3");
  sky.addColorStop(1, "#e9f1e4");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // con una sagoma il terreno è ai suoi piedi (niente paglione né cavalletto)
  const G = picture ? -picture.halfH - 0.015 : GROUND;
  // prato a strisce
  for (let i = -6; i < 16; i += 1) {
    const z0 = i * 2;
    const z1 = z0 + 2;
    fillPoly(poly([[-30, G, z0], [30, G, z0], [30, G, z1], [-30, G, z1]]), i % 2 ? "#7aa452" : "#71994b");
  }
  // linea di tiro
  fillPoly(poly([[-6, G + 0.002, 18], [6, G + 0.002, 18], [6, G + 0.002, 18.12], [-6, G + 0.002, 18.12]]), "#f4f1ea");
  // ombra del paglione
  const shadow: V3[] = [];
  for (let i = 0; i < 28; i += 1) {
    const a = (i / 28) * Math.PI * 2;
    shadow.push(picture ? [Math.cos(a) * picture.halfW * 0.95, G + 0.003, -0.05 + Math.sin(a) * 0.35] : [Math.cos(a) * 1.5, G + 0.003, -0.25 + Math.sin(a) * 0.75]);
  }
  fillPoly(poly(shadow), "rgba(20,30,15,0.28)");

  const prims: Prim[] = [];

  // cavalletto: due gambe davanti, una dietro
  const legs: [V3, V3][] = picture ? [] : [
    [[-0.95, -1.05, -0.2], [-1.15, GROUND, 0.25]],
    [[0.95, -1.05, -0.2], [1.15, GROUND, 0.25]],
    [[0, 0.9, -0.48], [0, GROUND, -1.55]],
  ];
  for (const [a, b] of legs) {
    for (let k = 0; k < 3; k += 1) {
      const p = lerp3(a, b, k / 3);
      const q = lerp3(a, b, (k + 1) / 3);
      const mid = lerp3(p, q, 0.5);
      prims.push({ depth: depthOf(mid), paint: (g) => line(g, view(p), view(q), "#6b4a2b", 0.07, F, NEAR, w, h) });
    }
  }

  // paglione (scatola) con facce visibili
  const B = 1.2;
  const Z0 = -0.46;
  const Z1 = -0.004;
  const box: { n: V3; pts: V3[]; color: string }[] = [
    { n: [0, 0, -1], pts: [[-B, -B, Z0], [B, -B, Z0], [B, B, Z0], [-B, B, Z0]], color: "#a8834e" },
    { n: [1, 0, 0], pts: [[B, -B, Z0], [B, -B, Z1], [B, B, Z1], [B, B, Z0]], color: "#b8925a" },
    { n: [-1, 0, 0], pts: [[-B, -B, Z0], [-B, B, Z0], [-B, B, Z1], [-B, -B, Z1]], color: "#b8925a" },
    { n: [0, 1, 0], pts: [[-B, B, Z0], [B, B, Z0], [B, B, Z1], [-B, B, Z1]], color: "#d4b27a" },
    { n: [0, -1, 0], pts: [[-B, -B, Z0], [-B, -B, Z1], [B, -B, Z1], [B, -B, Z0]], color: "#8a6a3c" },
    { n: [0, 0, 1], pts: [[-B, -B, Z1], [B, -B, Z1], [B, B, Z1], [-B, B, Z1]], color: "#cdb07e" },
  ];
  for (const side of picture ? [] : box) {
    const mid = avg3(side.pts);
    if (dot(side.n, sub(eye, mid)) <= 0) continue;
    prims.push({
      depth: depthOf(mid),
      paint: (g) => {
        const pts = poly(side.pts);
        fillPoly(pts, side.color, "rgba(60,40,15,0.35)", 1);
        // fili di paglia
        g.save();
        g.globalAlpha = 0.18;
        for (let k = 1; k < 8; k += 1) {
          const s = k / 8;
          const a = lerp3(side.pts[0], side.pts[3], s);
          const b = lerp3(side.pts[1], side.pts[2], s);
          line(g, view(a), view(b), "#5a3e1c", 0.006, F, NEAR, w, h);
        }
        g.restore();
      },
    });
  }

  // faccia del bersaglio (la sagoma si vede anche da dietro, scura)
  const facing = eye[2] > 0.01;
  if (picture && !facing) {
    prims.push({
      depth: depthOf([0, 0, -0.03]),
      paint: (g) => {
        for (const z of [0.003, -0.02, -0.04]) paintPicture(g, picture, z, "brightness(0.12)");
      },
    });
  }
  if (facing) {
    const center: V3 = [0, 0, 0.002];
    prims.push({
      depth: depthOf(center) - 0.001,
      paint: (g) => {
        if (picture) {
          // sagoma ritagliata in piedi sul prato: spessore (3 strati scuri dietro) e poi la faccia
          for (const z of [-0.06, -0.04, -0.02]) paintPicture(g, picture, z, "brightness(0.22)");
          paintPicture(g, picture, 0.003, "");
        } else {
        const rings = [...face.rings].sort((a, b) => b.outer - a.outer);
        for (const ring of rings) {
          const pts: V3[] = [];
          for (let i = 0; i < 64; i += 1) {
            const a = (i / 64) * Math.PI * 2;
            pts.push([Math.cos(a) * ring.outer, Math.sin(a) * ring.outer, 0.002]);
          }
          fillPoly(poly(pts), ring.fill, ring.fill === "#1a1c1e" ? "rgba(244,241,234,0.55)" : "rgba(20,24,28,0.45)", Math.max(0.6, w / 900));
        }
        // croce centrale
        line(g, view([-0.03, 0, 0.003]), view([0.03, 0, 0.003]), "#14181c", 0.004, F, NEAR, w, h);
        line(g, view([0, -0.03, 0.003]), view([0, 0.03, 0.003]), "#14181c", 0.004, F, NEAR, w, h);
        }
        // lampi d'impatto
        for (const arrow of arrows) {
          const s0 = arrow.index * stagger(arrows.length);
          const since = t - s0 - FLY;
          if (since < 0 || since > 0.45) continue;
          const k = since / 0.45;
          const pts: V3[] = [];
          for (let i = 0; i < 24; i += 1) {
            const a = (i / 24) * Math.PI * 2;
            pts.push([arrow.hit[0] + Math.cos(a) * (0.04 + k * 0.22), arrow.hit[1] + Math.sin(a) * (0.04 + k * 0.22), 0.004]);
          }
          const s = poly(pts);
          if (s.length < 3) continue;
          g.beginPath();
          s.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
          g.closePath();
          g.strokeStyle = `rgba(255,248,220,${(1 - k) * 0.95})`;
          g.lineWidth = Math.max(1.5, w / 260) * (1 - k * 0.5);
          g.stroke();
        }
      },
    });
  }

  // frecce
  const n = arrows.length;
  for (const arrow of arrows) {
    const s0 = arrow.index * stagger(n);
    const local = t - s0;
    if (local < 0) continue;
    let tip: V3;
    let dir: V3;
    let wobble = 0;
    if (local < FLY) {
      const k = local / FLY;
      const end: V3 = add(arrow.hit, scale(arrow.dir, -0.12));
      const base = lerp3(arrow.start, end, k);
      tip = [base[0], base[1] + arrow.arc * 4 * k * (1 - k), base[2]];
      const k2 = Math.min(1, k + 0.02);
      const b2 = lerp3(arrow.start, end, k2);
      const ahead: V3 = [b2[0], b2[1] + arrow.arc * 4 * k2 * (1 - k2), b2[2]];
      dir = norm(sub(tip, ahead));
      if (dot(dir, dir) < 0.5) dir = arrow.dir;
      // scia
      const from = lerp3(arrow.start, end, Math.max(0, k - 0.35));
      const trailFrom: V3 = [from[0], from[1] + arrow.arc * 4 * Math.max(0, k - 0.35) * (1 - Math.max(0, k - 0.35)), from[2]];
      prims.push({ depth: depthOf(tip) + 0.5, paint: (g) => line(g, view(trailFrom), view(tip), "rgba(255,240,190,0.55)", 0.012, F, NEAR, w, h) });
    } else {
      tip = add(arrow.hit, scale(arrow.dir, -0.12));
      dir = arrow.dir;
      const since = local - FLY;
      wobble = since < 0.6 ? Math.sin(since * 70) * 0.035 * (1 - since / 0.6) : 0;
    }
    const nock = add(tip, scale(dir, ARROW));
    const side = norm(cross(dir, [0, 1, 0]));
    const nockW = add(nock, scale(side, wobble));
    // asta in 5 pezzi per l'ordine di profondità
    for (let k = 0; k < 5; k += 1) {
      const p = lerp3(tip, nockW, k / 5);
      const q = lerp3(tip, nockW, (k + 1) / 5);
      const mid = lerp3(p, q, 0.5);
      prims.push({ depth: depthOf(mid), paint: (g) => {
        line(g, view(p), view(q), arrow.shaft, 0.016, F, NEAR, w, h);
        line(g, view(p), view(q), "rgba(255,255,255,0.18)", 0.005, F, NEAR, w, h);
      } });
    }
    // cocca
    const nockEnd = add(nockW, scale(dir, 0.05));
    prims.push({ depth: depthOf(nockEnd), paint: (g) => line(g, view(nockW), view(nockEnd), arrow.nockColor, 0.02, F, NEAR, w, h) });
    // tre alette
    const shaftDir = norm(sub(nockW, tip));
    const a1 = norm(cross(shaftDir, [0, 1, 0]));
    const a2 = cross(shaftDir, a1);
    for (let v = 0; v < 3; v += 1) {
      const ang = arrow.roll + (v * Math.PI * 2) / 3;
      const out = add(scale(a1, Math.cos(ang)), scale(a2, Math.sin(ang)));
      const b0 = add(tip, scale(shaftDir, ARROW - 0.34));
      const b1 = add(tip, scale(shaftDir, ARROW - 0.06));
      const pts: V3[] = [b0, b1, add(b1, scale(out, 0.075)), add(add(b0, scale(shaftDir, 0.12)), scale(out, 0.075))];
      const color = v === 0 ? arrow.color : arrow.hen;
      prims.push({ depth: depthOf(avg3(pts)), paint: () => fillPoly(poly(pts), color, "rgba(20,24,28,0.5)", 1) });
    }
  }

  prims.sort((a, b) => b.depth - a.depth);
  for (const prim of prims) prim.paint(ctx);
}

function line(ctx: CanvasRenderingContext2D, a: V3, b: V3, color: string, width: number, F: number, near: number, w: number, h: number) {
  let p = a;
  let q = b;
  if (p[2] < near && q[2] < near) return;
  if (p[2] < near) p = lerp3(p, q, (near - p[2]) / (q[2] - p[2]));
  if (q[2] < near) q = lerp3(q, p, (near - q[2]) / (p[2] - q[2]));
  const sp = { x: w / 2 + (p[0] * F) / p[2], y: h / 2 - (p[1] * F) / p[2] };
  const sq = { x: w / 2 + (q[0] * F) / q[2], y: h / 2 - (q[1] * F) / q[2] };
  const z = (p[2] + q[2]) / 2;
  ctx.beginPath();
  ctx.moveTo(sp.x, sp.y);
  ctx.lineTo(sq.x, sq.y);
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1, (width * F) / z);
  ctx.stroke();
}

function clipNear(pts: V3[], near: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ain = a[2] >= near;
    const bin = b[2] >= near;
    if (ain) out.push(a);
    if (ain !== bin) out.push(lerp3(a, b, (near - a[2]) / (b[2] - a[2])));
  }
  return out;
}

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function shortAngle(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const avg3 = (pts: V3[]): V3 => scale(pts.reduce((s, p) => add(s, p), [0, 0, 0] as V3), 1 / pts.length);

/** Disegna una "foto" del bersaglio con le frecce già piantate (usata anche per provare la lettura delle foto). */
export function renderTargetPhoto(el: HTMLCanvasElement, face: Face, shots: Shot[], cam: { yaw: number; pitch: number; dist: number }) {
  draw(el, face, shots.map((shot, index) => arrowOf(shot, index)), cam, 999);
}
