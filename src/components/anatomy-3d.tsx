import { useEffect, useMemo, useRef, useState } from "react";
import { buildModel, v3, type Model, type V3 } from "@/lib/arcieri/anatomy-model";
import { createAnatomyRenderer, lookAt, mul4, perspective } from "@/lib/arcieri/anatomy-render";
import { BODY_CREDIT, loadBody } from "@/lib/arcieri/anatomy-body";
import { sideEvidence, type Gear, type Hand, type Landmark } from "@/lib/arcieri/pose-analysis";
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
  { id: "fronte", label: "Come il video", yaw: 0, pitch: 0.06 },
  { id: "lato", label: "Lato", yaw: Math.PI / 2, pitch: 0.08 },
  { id: "dietro", label: "Dietro", yaw: Math.PI - 0.35, pitch: 0.12 },
  { id: "alto", label: "Dall'alto", yaw: 0.5, pitch: 1.05 },
] as const;

export function Anatomy3D({
  lm = null,
  lmRef,
  gearRef,
  seq,
  aspect,
  hand,
  className = "h-[26rem]",
  inBox = false,
}: {
  /** arco e freccia trovati nel video (quando è fermo): il 3D li usa al posto di quelli stimati */
  gearRef?: { current: Gear | null };
  /** dentro il riquadro del video: i comandi vanno in basso, in alto a destra c'è la scelta della vista */
  inBox?: boolean;
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
  // si parte come la ripresa del video (di fronte), fermi: si gira con il dito
  const cam = useRef({ yaw: 0, pitch: 0.06, zoom: 1, auto: false });
  /** si sta girando o avvicinando con le dita: si usa il corpo leggero */
  const dragging = useRef(false);
  const [auto, setAuto] = useState(false);
  const [failed, setFailed] = useState(false);
  const [empty, setEmpty] = useState(false);
  const emptyRef = useRef(false);
  // analisi salvate prima della correzione: se il gesto dice che sinistra e destra sono scambiate
  // (video specchiato o arciere di spalle), si raddrizzano qui
  const swap = useMemo(() => {
    if (lmRef) return false;
    const frames = seq && seq.length ? seq.map((f) => unpackLm(f.lm)) : [lm];
    let score = 0;
    for (const f of frames) if (f) score += sideEvidence(f, hand, aspect);
    return score < 0;
  }, [seq, lm, lmRef, hand, aspect]);
  // i punti restano come nel video; cambia solo quale braccio tiene l'arco
  const effHand: Hand = swap ? (hand === "destro" ? "mancino" : "destro") : hand;
  const input = useRef({ lm, lmRef, seq, aspect, hand: effHand, gearRef });
  input.current = { lm, lmRef, seq, aspect, hand: effHand, gearRef };

  useEffect(() => {
    const canvas = glCanvas.current;
    const hud = hudCanvas.current;
    if (!canvas || !hud) return;
    const R = createAnatomyRenderer(canvas);
    const ctx = hud.getContext("2d");
    if (!R || !ctx) {
      setFailed(true);
      return;
    }
    let raf = 0;
    // corpo anatomico vero (muscoli e ossa da atlante): si scarica la prima volta, poi resta in memoria
    let bodyTick = 0;
    let alive = true;
    void loadBody("leggero").then((b) => {
      if (!alive || !b) return;
      R.setBody(b, "leggero");
      bodyTick += 1;
      return loadBody("pieno").then((f) => {
        if (!alive || !f) return;
        R.setBody(f, "pieno");
        bodyTick += 1;
      });
    });
    let smooth: Landmark[] | null = null;
    let model: Model | null = null;
    let last = performance.now();
    const t0 = last;

    // si ridisegna solo quando cambia qualcosa (posa, camera, livelli, dimensioni): niente scatti
    // e niente batteria consumata a vuoto
    let lastTarget: Landmark[] | null = null;
    let lastKey = "";
    let moving = false;
    let lastChange = -1e9;
    let lastFast = false;
    let camSm: { c: V3; h: number } | null = null;
    let scale = 1; // risoluzione adattiva: scende se il telefono non sta al passo
    let slow = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const time = (now - t0) / 1000;
      // nascosto (vista non attiva o fuori schermo): non lavora
      if (!canvas.clientWidth || !canvas.clientHeight) return;
      const { lm: still, lmRef: ref, seq: sq, aspect: asp, hand: hd, gearRef: gr } = input.current;
      // punti da mostrare: sequenza salvata (in ciclo), poi quelli dal vivo, poi quelli fissi
      let target: Landmark[] | null = null;
      const playing = Boolean(sq && sq.length > 1);
      if (playing && sq) {
        const end = sq[sq.length - 1].t + 0.9;
        target = seqAt(sq, time % end);
      } else target = ref?.current ?? still;
      if (target && target !== lastTarget) {
        lastTarget = target;
        moving = true;
        lastChange = now;
      }
      const c = cam.current;
      if (c.auto) c.yaw += dt * 0.35;
      const L0 = layersRef.current;
      const dprBase = Math.min(2, window.devicePixelRatio || 1);
      const key = `${c.yaw.toFixed(4)}|${c.pitch.toFixed(4)}|${c.zoom.toFixed(3)}|${L0.pelle}${L0.muscolo}${L0.osso}${L0.quote}|${canvas.clientWidth}x${canvas.clientHeight}|${scale}|${bodyTick}`;
      // dopo un movimento si disegna ancora un attimo con il corpo leggero, poi una volta con quello pieno
      const fast = now - lastChange < 450 || dragging.current;
      if (!moving && key === lastKey && !playing && fast === lastFast) return;
      lastKey = key;
      lastFast = fast;
      if (target && moving) {
        // inseguimento continuo nel tempo: tra un rilevamento e l'altro il corpo scorre, non salta
        const t = target;
        const a = playing ? 1 : 1 - Math.exp(-dt / 0.075);
        const mix = (x: number | undefined, y: number | undefined) => (x != null && y != null ? x + (y - x) * a : y);
        let far = 0;
        if (!smooth || smooth.length !== t.length) smooth = t.map((p) => ({ ...p }));
        else
          smooth = smooth.map((p, i) => {
            far = Math.max(far, Math.abs(t[i].x - p.x), Math.abs(t[i].y - p.y));
            return { x: p.x + (t[i].x - p.x) * a, y: p.y + (t[i].y - p.y) * a, z: mix(p.z, t[i].z), zw: mix(p.zw, t[i].zw), visibility: t[i].visibility };
          });
        if (far < 0.0006 && !playing) moving = false;
        model = buildModel(smooth, asp, hd, gr?.current ?? null) ?? model;
      }
      if (emptyRef.current !== !model) {
        emptyRef.current = !model;
        setEmpty(!model);
      }
      const t1 = performance.now();

      const dpr = dprBase * scale;
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
      R.clear(W, H);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!model) return;
      // se un disegno costa troppo, la volta dopo si disegna a risoluzione più bassa
      queueMicrotask(() => {
        const cost = performance.now() - t1;
        slow = cost > 28 ? slow + 1 : Math.max(0, slow - 1);
        if (slow > 3 && scale > 0.6) {
          scale = Math.round((scale - 0.15) * 100) / 100;
          slow = 0;
        }
      });

      // inquadratura morbida: centro e altezza del corpo cambiano un poco a ogni rilevamento
      const kc = camSm ? 1 - Math.exp(-dt / 0.35) : 1;
      camSm = camSm
        ? { c: [camSm.c[0] + (model.center[0] - camSm.c[0]) * kc, camSm.c[1] + (model.height * 0.5 - camSm.c[1]) * kc, camSm.c[2] + (model.center[2] - camSm.c[2]) * kc], h: camSm.h + (model.height - camSm.h) * kc }
        : { c: [model.center[0], model.height * 0.5, model.center[2]], h: model.height };
      if (Math.abs(camSm.h - model.height) > 0.002) lastChange = now;
      const target3: V3 = camSm.c;
      const fov = (34 * Math.PI) / 180;
      const fit = (camSm.h * 0.62) / Math.tan(fov / 2) / Math.min(1, W / H + 0.15);
      const dist = Math.max(1.6, fit) / c.zoom;
      const eye: V3 = [target3[0] + Math.sin(c.yaw) * Math.cos(c.pitch) * dist, target3[1] + Math.sin(c.pitch) * dist, target3[2] + Math.cos(c.yaw) * Math.cos(c.pitch) * dist];
      const VP = mul4(perspective(fov, W / H, 0.05, 30), lookAt(eye, target3));
      const L = layersRef.current;
      R.draw(model, VP, eye, time, L, null, fast);

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
      dragging.current = true;
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
        if (pinch) cam.current.zoom = Math.max(0.7, Math.min(4, cam.current.zoom * (d / pinch)));
        pinch = d;
        return;
      }
      cam.current.yaw -= (e.clientX - prev.x) * 0.01;
      cam.current.pitch = Math.max(-0.2, Math.min(1.3, cam.current.pitch + (e.clientY - prev.y) * 0.006));
    };
    const up = (e: PointerEvent) => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = 0;
      if (!ptrs.size) dragging.current = false;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.current.zoom = Math.max(0.7, Math.min(4, cam.current.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      R.dispose();
    };
  }, []);

  if (failed) return <p className="rounded-2xl bg-white/[0.04] p-3 text-sm text-muted">Il 3D non parte su questo telefono: le misure restano nell'analisi qui sopra.</p>;
  const toggle = (k: Layer) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  return (
    <div className={cx("relative w-full overflow-hidden", inBox ? "" : "rounded-2xl", className)} style={{ background: "radial-gradient(ellipse at 45% 35%, #3f9fe6 0%, #1c6fc2 42%, #0b3f82 78%, #072a5c 100%)" }}>
      <canvas ref={glCanvas} className="absolute inset-0 h-full w-full touch-none" aria-label="Analisi del gesto in 3D: corpo, scheletro e muscoli, da girare con il dito" />
      <canvas ref={hudCanvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      <p className="pointer-events-none absolute inset-x-0 bottom-0 truncate px-2 text-center text-[0.45rem] leading-[0.7rem] text-white/50">{BODY_CREDIT}</p>
      {empty ? <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-white/80">In attesa della posa: avvia il video o scegli un fotogramma.</p> : null}
      <div className={inBox ? "absolute inset-x-2 bottom-11 flex flex-wrap justify-center gap-1" : "absolute left-2 top-2 flex flex-wrap gap-1"}>
        {([["pelle", "Corpo"], ["muscolo", "Muscoli"], ["osso", "Scheletro"], ["quote", "Misure"]] as const).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={layers[k]} onClick={() => toggle(k)} className={cx("min-h-8 rounded-full px-2.5 text-[0.7rem] font-semibold backdrop-blur", layers[k] ? "bg-[#5fd4ff]/25 text-white ring-1 ring-[#5fd4ff]/60" : "bg-black/40 text-white/60")}>
            {label}
          </button>
        ))}
      </div>
      <div className="absolute inset-x-2 bottom-3 flex flex-wrap justify-center gap-1">
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
