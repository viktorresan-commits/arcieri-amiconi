import { useEffect, useMemo, useRef, useState } from "react";
import { boneCal, buildModel, depthMemo, v3, type BoneCal, type Model, type V3 } from "@/lib/arcieri/anatomy-model";
import { createAnatomyRenderer, lookAt, mul4, perspective } from "@/lib/arcieri/anatomy-render";
import { BODY_CREDIT, loadBody } from "@/lib/arcieri/anatomy-body";
import { mixLm, sideEvidence, type Gear, type Hand, type Landmark } from "@/lib/arcieri/pose-analysis";
import { unpackLm, type PackedLm } from "@/lib/arcieri/gesture-record";
import { saveFile } from "@/lib/arcieri/native";
import { cx } from "./kit";

/**
 * Analisi del gesto in 3D: corpo traslucido con scheletro e muscoli al lavoro, arco e freccia,
 * quote come in un laboratorio (angoli dei gomiti, spalle, testa, anca, allungo, ancoraggio).
 * Segue i punti registrati: dal vivo, dal video o dalla sequenza salvata nello storico.
 * Le profondità arrivano da una ripresa 2D: sono stime.
 */

type Layer = "pelle" | "muscolo" | "osso" | "punti" | "quote";
type Seq = { t: number; lm: PackedLm }[];

/** punti al tempo t della sequenza salvata, interpolati */
function seqAt(seq: Seq, t: number): Landmark[] | null {
  if (!seq.length) return null;
  if (seq.length === 1 || t <= seq[0].t) return unpackLm(seq[0].lm);
  for (let i = 1; i < seq.length; i++) {
    if (t <= seq[i].t) {
      const a = seq[i - 1], b = seq[i];
      const k = (t - a.t) / Math.max(1e-3, b.t - a.t);
      const la = unpackLm(a.lm);
      const lb = unpackLm(b.lm);
      if (!la || !lb || la.length !== lb.length) return la ?? lb;
      return la.map((p, j) => mixLm(p, lb[j], k));
    }
  }
  return unpackLm(seq[seq.length - 1].lm);
}

/** camera che inquadra il corpo da un angolo (yaw, pitch) con lo zoom scelto */
function sceneCamera(camSm: { c: V3; h: number }, c: { yaw: number; pitch: number; zoom: number }, W: number, H: number) {
  const target3: V3 = camSm.c;
  const fov = (34 * Math.PI) / 180;
  const fit = (camSm.h * 0.62) / Math.tan(fov / 2) / Math.min(1, W / H + 0.15);
  const dist = Math.max(1.6, fit) / c.zoom;
  const eye: V3 = [target3[0] + Math.sin(c.yaw) * Math.cos(c.pitch) * dist, target3[1] + Math.sin(c.pitch) * dist, target3[2] + Math.cos(c.yaw) * Math.cos(c.pitch) * dist];
  return { eye, VP: mul4(perspective(fov, W / H, 0.05, 30), lookAt(eye, target3)) };
}

/** la vista scelta nella sagoma 3D: la usano anche foto e video in alta definizione */
export const sagomaView: { yaw: number; pitch: number; zoom: number; layers: Record<Layer, boolean> } = {
  yaw: 0,
  pitch: 0.06,
  zoom: 1,
  layers: { pelle: true, muscolo: true, osso: true, punti: true, quote: true },
};

const BG_STOPS: [number, string][] = [
  [0, "#3f9fe6"],
  [0.42, "#1c6fc2"],
  [0.78, "#0b3f82"],
  [1, "#072a5c"],
];

/**
 * Pittore della sagoma 3D fuori schermo, in alta definizione (foto 4K, video 1080p): stesso corpo,
 * stessa luce, stessa vista dello schermo, con lo sfondo e i crediti dell'atlante anatomico.
 */
export async function sagomaPainter(W: number, H: number) {
  const gl = document.createElement("canvas");
  gl.width = W;
  gl.height = H;
  const R = createAnatomyRenderer(gl, true);
  if (!R) return null;
  // il corpo in piena definizione dell'atlante (si scarica la prima volta), altrimenti quello dello schermo
  const body = (await loadBody("hd")) ?? (await loadBody("pieno")) ?? (await loadBody("leggero"));
  if (body) R.setBody(body, "pieno");
  await R.gearLoaded();
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  // il testo e le linee come sullo schermo di un telefono largo 400 punti
  const dpr = Math.min(W, H) / 400;
  let camSm: { c: V3; h: number } | null = null;
  let lastT = 0;
  const memo = depthMemo();
  return {
    canvas: out,
    /** disegna la posa; smooth: inquadratura che segue piano (video), altrimenti esatta (foto) */
    paint(o: { lm: Landmark[]; aspect: number; hand: Hand; gear: Gear | null; cal: BoneCal | null; time: number; smooth?: boolean; view?: typeof sagomaView; /** centro dell'inquadratura scelto dal modello (es. una mano), per i dettagli */ at?: (m: Model) => V3 }) {
      const view = o.view ?? sagomaView;
      const model = buildModel(o.lm, o.aspect, o.hand, o.gear, o.cal, o.smooth ? memo : null, o.time);
      const g = ctx.createRadialGradient(W * 0.45, H * 0.35, 0, W * 0.45, H * 0.35, Math.max(W, H) * 0.8);
      for (const [k, c] of BG_STOPS) g.addColorStop(k, c);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      if (!model) return false;
      const dt = Math.max(0, Math.min(0.2, o.time - lastT));
      lastT = o.time;
      const kc = camSm && o.smooth ? 1 - Math.exp(-dt / 0.35) : 1;
      camSm = camSm && o.smooth
        ? { c: [camSm.c[0] + (model.center[0] - camSm.c[0]) * kc, camSm.c[1] + (model.height * 0.5 - camSm.c[1]) * kc, camSm.c[2] + (model.center[2] - camSm.c[2]) * kc], h: camSm.h + (model.height - camSm.h) * kc }
        : { c: [model.center[0], model.height * 0.5, model.center[2]], h: model.height };
      const { VP, eye } = sceneCamera(o.at ? { c: o.at(model), h: camSm.h } : camSm, view, W, H);
      R.clear(W, H);
      R.draw(model, VP, eye, o.time, view.layers, null, false);
      ctx.drawImage(gl, 0, 0);
      paintHud(ctx, model, VP, W, H, dpr, view.layers, o.time);
      // crediti dell'atlante (licenze CC BY e CC BY-SA): restano sull'immagine
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = `500 ${Math.round(9 * dpr)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(BODY_CREDIT, W / 2, H - 8 * dpr);
      return true;
    },
    dispose() {
      R.dispose();
    },
  };
}


export function Anatomy3D({
  lm = null,
  lmRef,
  gearRef,
  seq,
  calFrames,
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
  /** tutti i fotogrammi letti dal video: danno le lunghezze vere delle ossa dell'arciere */
  calFrames?: (Landmark[] | null)[] | null;
  aspect: number;
  hand: Hand;
  className?: string;
}) {
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const hudCanvas = useRef<HTMLCanvasElement>(null);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ pelle: true, muscolo: true, osso: true, punti: true, quote: true });
  const layersRef = useRef(layers);
  layersRef.current = layers;
  // si parte come la ripresa del video (di fronte), fermi: si gira con il dito
  const cam = useRef({ yaw: 0, pitch: 0.06, zoom: 1, auto: false, home: false });
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
  // lunghezze vere delle ossa: dalla sequenza salvata o dai fotogrammi dell'analisi; dal vivo si
  // imparano dai fotogrammi che passano
  const fixedCal = useMemo<BoneCal | null>(() => {
    if (calFrames && calFrames.length >= 8) return boneCal(calFrames, aspect);
    if (seq && seq.length >= 8) return boneCal(seq.map((f) => unpackLm(f.lm)), aspect);
    return null;
  }, [calFrames, seq, aspect]);
  const live = useRef<{ frames: Landmark[][]; cal: BoneCal | null; n: number }>({ frames: [], cal: null, n: 0 });
  useEffect(() => {
    live.current = { frames: [], cal: null, n: 0 };
  }, [calFrames, aspect]);
  /** l'ultima posa disegnata: serve alla foto in alta definizione */
  const lastShot = useRef<{ lm: Landmark[] | null; aspect: number; hand: Hand; gear: Gear | null; cal: BoneCal | null; time: number } | null>(null);
  const [shooting, setShooting] = useState(false);
  const [shotMsg, setShotMsg] = useState("");
  /**
   * Foto della sagoma in alta definizione (4K sul lato lungo, come il riquadro sullo schermo), con la
   * vista, i livelli e le quote scelti; si salva o si condivide come immagine PNG
   */
  async function photoHD() {
    const shot = lastShot.current;
    const box = glCanvas.current;
    if (!shot?.lm || !box || shooting) return;
    setShooting(true);
    setShotMsg("Preparo la foto in alta definizione…");
    try {
      const ratio = (box.clientWidth || 9) / (box.clientHeight || 16);
      const long = 3840;
      const W = ratio >= 1 ? long : Math.round((long * ratio) / 2) * 2;
      const H = ratio >= 1 ? Math.round(long / ratio / 2) * 2 : long;
      const painter = await sagomaPainter(W, H);
      if (!painter) throw new Error("3D");
      painter.paint({ lm: shot.lm, aspect: shot.aspect, hand: shot.hand, gear: shot.gear, cal: shot.cal, time: shot.time });
      const blob = await new Promise<Blob | null>((res) => painter.canvas.toBlob(res, "image/png"));
      painter.dispose();
      if (!blob) throw new Error("vuota");
      await saveFile(blob, `sagoma-${W}x${H}.png`);
      setShotMsg(`Foto ${W}×${H} salvata`);
    } catch {
      setShotMsg("Foto non riuscita su questo telefono");
    } finally {
      setShooting(false);
      window.setTimeout(() => setShotMsg(""), 3500);
    }
  }
  const input = useRef({ lm, lmRef, seq, aspect, hand: effHand, gearRef, cal: fixedCal });
  input.current = { lm, lmRef, seq, aspect, hand: effHand, gearRef, cal: fixedCal };

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
    // profondità che insegue piano: niente braccia che scattano avanti e indietro
    const memo = depthMemo();
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
      const { lm: still, lmRef: ref, seq: sq, aspect: asp, hand: hd, gearRef: gr, cal: fc } = input.current;
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
        if (!fc) {
          const lv = live.current;
          lv.n += 1;
          if (lv.n % 2 === 0) {
            lv.frames.push(target);
            if (lv.frames.length > 300) lv.frames.shift();
            if (lv.frames.length >= 8 && lv.frames.length % 15 === 8) lv.cal = boneCal(lv.frames, asp);
          }
        }
      }
      const c = cam.current;
      if (c.auto) c.yaw += dt * 0.35;
      else if (c.home) {
        // dopo «Ferma» si torna piano davanti, come nel video
        const tw = Math.round(c.yaw / (Math.PI * 2)) * Math.PI * 2;
        const k = 1 - Math.exp(-dt / 0.25);
        c.yaw += (tw - c.yaw) * k;
        c.pitch += (0.06 - c.pitch) * k;
        if (Math.abs(tw - c.yaw) < 0.002 && Math.abs(0.06 - c.pitch) < 0.002) {
          c.yaw = tw;
          c.pitch = 0.06;
          c.home = false;
        }
      }
      const L0 = layersRef.current;
      const key = `${c.yaw.toFixed(4)}|${c.pitch.toFixed(4)}|${c.zoom.toFixed(3)}|${L0.pelle}${L0.muscolo}${L0.osso}${L0.punti}${L0.quote}|${canvas.clientWidth}x${canvas.clientHeight}|${scale}|${bodyTick}`;
      // dopo un movimento si disegna ancora un attimo con il corpo leggero, poi una volta con quello pieno
      const fast = now - lastChange < 450 || dragging.current;
      if (!moving && key === lastKey && !playing && fast === lastFast) return;
      // fermo: alla risoluzione piena dello schermo (fino a 3×), nitido come una tavola anatomica;
      // in movimento a 2× e, se il telefono non sta al passo, un po' meno
      const resting = !fast && !playing;
      const dprBase = Math.min(resting ? 3 : 2, window.devicePixelRatio || 1);
      lastKey = key;
      lastFast = fast;
      if (target && moving) {
        // inseguimento continuo nel tempo: tra un rilevamento e l'altro il corpo scorre, non salta
        const t = target;
        const a = playing ? 1 : 1 - Math.exp(-dt / 0.075);
        let far = 0;
        if (!smooth || smooth.length !== t.length) smooth = t.map((p) => ({ ...p }));
        else
          smooth = smooth.map((p, i) => {
            far = Math.max(far, Math.abs(t[i].x - p.x), Math.abs(t[i].y - p.y));
            return mixLm(p, t[i], a, t[i].visibility);
          });
        if (far < 0.0006 && !playing) moving = false;
        model = buildModel(smooth, asp, hd, gr?.current ?? null, fc ?? live.current.cal, memo, time) ?? model;
      }
      if (emptyRef.current !== !model) {
        emptyRef.current = !model;
        setEmpty(!model);
      }
      const t1 = performance.now();

      const dpr = dprBase * (resting ? 1 : scale);
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
      // se un disegno in movimento costa troppo, la volta dopo si disegna a risoluzione più bassa
      if (!resting) queueMicrotask(() => {
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
      const { VP, eye } = sceneCamera(camSm, c, W, H);
      const L = layersRef.current;
      // la vista scelta (angolo, distanza, livelli) vale anche per foto e video in alta definizione
      sagomaView.yaw = c.yaw;
      sagomaView.pitch = c.pitch;
      sagomaView.zoom = c.zoom;
      sagomaView.layers = { ...L };
      lastShot.current = { lm: smooth, aspect: asp, hand: hd, gear: gr?.current ?? null, cal: fc ?? live.current.cal, time };
      R.draw(model, VP, eye, time, L, null, fast);

      paintHud(ctx, model, VP, W, H, dpr, L, time);
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
      cam.current.home = false;
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
      {/* in alto: Gira e la foto in alta definizione; in basso cosa si vede (corpo, muscoli, scheletro…) */}
      <div className={cx("absolute top-2 flex gap-1", inBox ? "left-2" : "right-2")}>
        <button
          type="button"
          aria-pressed={auto}
          onClick={() => {
            // ferma: torna piano alla vista del video
            cam.current.auto = !cam.current.auto;
            cam.current.home = !cam.current.auto;
            setAuto(cam.current.auto);
          }}
          className={cx("min-h-9 rounded-full px-3 text-xs font-semibold backdrop-blur", auto ? "bg-[#5fd4ff]/35 text-white ring-1 ring-[#5fd4ff]/70" : "bg-black/45 text-white")}
        >
          {auto ? "Ferma" : "Gira"}
        </button>
        <button
          type="button"
          disabled={shooting || empty}
          onClick={() => void photoHD()}
          aria-label="Foto della sagoma in alta definizione"
          className="min-h-9 rounded-full bg-black/45 px-3 text-xs font-semibold text-white backdrop-blur disabled:opacity-50"
        >
          {shooting ? "Foto…" : "Foto HD"}
        </button>
      </div>
      <div className={cx("absolute inset-x-2 flex flex-wrap justify-center gap-1", inBox ? "bottom-4" : "bottom-4")}>
        {([["pelle", "Corpo"], ["muscolo", "Muscoli"], ["osso", "Scheletro"], ["punti", "Punti"], ["quote", "Misure"]] as const).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={layers[k]} onClick={() => toggle(k)} className={cx("min-h-8 rounded-full px-2.5 text-[0.7rem] font-semibold backdrop-blur", layers[k] ? "bg-[#5fd4ff]/25 text-white ring-1 ring-[#5fd4ff]/60" : "bg-black/40 text-white/60")}>
            {label}
          </button>
        ))}
      </div>
      {shotMsg ? <p className="pointer-events-none absolute inset-x-0 top-14 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">{shotMsg}</p> : null}
    </div>
  );
}

/** quote, punti e anelli a terra disegnati sopra la scena (2D), per lo schermo e per le immagini HD */
function paintHud(ctx: CanvasRenderingContext2D, model: Model, VP: Float32Array, W: number, H: number, dpr: number, L: Record<Layer, boolean>, time: number) {
  const proj = (p: V3): [number, number, number] => {
    const x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12];
    const y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13];
    const w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
    return [((x / w) * 0.5 + 0.5) * W, (1 - ((y / w) * 0.5 + 0.5)) * H, w];
  };
  const hudD = model.hud;
  ctx.lineWidth = 0.8 * dpr;
  // anelli a terra
  for (const [r, a] of [[0.45, 0.4], [0.62, 0.2], [0.8, 0.1]] as const) {
    ctx.strokeStyle = `rgba(95,212,255,${a})`;
    ctx.setLineDash(r > 0.5 ? [3 * dpr, 5 * dpr] : []);
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
  for (let i = 0; i < 16; i++) {
    const an = (i / 16) * Math.PI * 2 + time * 0.2;
    const a = proj([hudD.feet[0] + Math.cos(an) * 0.45, 0.002, hudD.feet[2] + Math.sin(an) * 0.45]);
    const b = proj([hudD.feet[0] + Math.cos(an) * 0.48, 0.002, hudD.feet[2] + Math.sin(an) * 0.48]);
    ctx.strokeStyle = "rgba(95,212,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  if (L.punti && model.J) drawJoints(ctx, model.J, proj, dpr, model.hand ?? "destro");
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
    ctx.strokeStyle = "rgba(255,214,120,0.85)";
    ctx.lineWidth = 1.1 * dpr;
    ctx.beginPath();
    ctx.arc(o[0], o[1], 11 * dpr, Math.min(a1, a2), Math.max(a1, a2));
    ctx.stroke();
  }
  // quota dell'allungo
  for (const d of hudD.dims) {
    const a = proj(d.a);
    const b = proj(d.b);
    const nx = -(b[1] - a[1]);
    const ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1;
    const off = 13 * dpr;
    const ox = (nx / nl) * off * (ny / nl > 0 ? -1 : 1);
    const oy = (ny / nl) * off * (ny / nl > 0 ? -1 : 1);
    ctx.strokeStyle = "rgba(255,214,120,0.8)";
    ctx.lineWidth = 0.8 * dpr;
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath();
    ctx.moveTo(a[0] + ox, a[1] + oy);
    ctx.lineTo(b[0] + ox, b[1] + oy);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const q of [a, b]) {
      ctx.beginPath();
      ctx.moveTo(q[0], q[1]);
      ctx.lineTo(q[0] + ox * 1.2, q[1] + oy * 1.2);
      ctx.stroke();
    }
  }
  // etichette con linea guida: a sinistra o a destra della figura, senza sovrapporsi tra loro.
  // Le misure il cui punto è fuori dall'inquadratura (zoom su una mano) non si disegnano.
  const mid = proj(model.center)[0];
  const H2 = ctx.canvas.height;
  ctx.font = TAG_FONT(dpr);
  const gap = 3 * dpr;
  const th = 14 * dpr;
  const items = [...hudD.labels, ...hudD.dims.map((d) => ({ at: v3.lerp(d.a, d.b, 0.55), text: d.text, tone: "gold" as const }))]
    .map((l) => {
      const p = proj(l.at);
      const tw = ctx.measureText(l.text).width + 10 * dpr;
      let side = p[0] < mid ? -1 : 1;
      // dal lato scelto non c'è posto: l'etichetta va dall'altra parte
      if (side < 0 && p[0] - 52 * dpr - tw < 4 * dpr) side = 1;
      else if (side > 0 && p[0] + 52 * dpr + tw > W - 4 * dpr) side = -1;
      return { ...l, p, tw, side };
    })
    .filter((it) => it.p[2] > 0 && it.p[0] >= 0 && it.p[0] <= W && it.p[1] >= 0 && it.p[1] <= H2)
    .sort((a, b) => a.p[1] - b.p[1]);
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const it of items) {
    // la casella resta dentro il riquadro: la linea guida arriva al suo bordo
    const tx = it.side < 0 ? Math.max(4 * dpr + it.tw, it.p[0] - 52 * dpr) : Math.min(W - 4 * dpr - it.tw, it.p[0] + 52 * dpr);
    const x0 = it.side < 0 ? tx - it.tw : tx;
    const x1 = x0 + it.tw;
    let ty = it.p[1] - 12 * dpr;
    for (let guard = 0; guard < 40; guard++) {
      const hit = placed.find((b) => x0 < b.x1 + gap && x1 > b.x0 - gap && ty - th / 2 < b.y1 + gap && ty + th / 2 > b.y0 - gap);
      if (!hit) break;
      ty = hit.y1 + gap + th / 2;
    }
    placed.push({ x0, x1, y0: ty - th / 2, y1: ty + th / 2 });
    ctx.strokeStyle = it.tone === "warn" ? "rgba(255,160,110,0.75)" : it.tone === "gold" ? "rgba(255,214,120,0.75)" : "rgba(95,212,255,0.7)";
    ctx.lineWidth = 0.7 * dpr;
    ctx.beginPath();
    ctx.moveTo(it.p[0], it.p[1]);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(it.p[0], it.p[1], 1.6 * dpr, 0, Math.PI * 2);
    ctx.fill();
    tag(ctx, it.text, tx, ty, it.tone, dpr, false, it.side);
  }
}

/** collegamenti dei punti: corpo, piedi, mani (21 punti per mano) */
const BODY_LINKS: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [15, 17], [15, 19], [15, 21], [17, 19], [16, 18], [16, 20], [16, 22], [18, 20],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
  [7, 8], [0, 7], [0, 8],
];
const HAND_LINKS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

/**
 * Lo scheletro dei punti rilevati nel video, sopra il corpo 3D: ogni articolazione è un punto
 * (lato dell'arco in azzurro, lato della corda in oro), le linee sono quelle dello scheletro del video
 */
function drawJoints(ctx: CanvasRenderingContext2D, J: Record<number, V3>, proj: (p: V3) => [number, number, number], dpr: number, hand: Hand) {
  // punti dispari (11, 13, 15...) = lato sinistro dell'arciere
  const bowOdd = hand === "destro"; // per un destro l'arco è nella mano sinistra (punti dispari)
  const tone = (i: number) => (i <= 10 ? "#ffffff" : (i % 2 === 1) === bowOdd ? "#5fd4ff" : "#ffd36e");
  const P: Record<number, [number, number, number]> = {};
  for (const k of Object.keys(J)) {
    const i = Number(k);
    if (J[i]) P[i] = proj(J[i]);
  }
  ctx.lineCap = "round";
  const line = (a: number, b: number, col: string, w: number) => {
    const p = P[a];
    const q = P[b];
    if (!p || !q || p[2] <= 0 || q[2] <= 0) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = w * dpr;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
  };
  for (const [a, b] of BODY_LINKS) line(a, b, "rgba(4,20,34,0.45)", 2.6);
  for (const [a, b] of BODY_LINKS) line(a, b, a <= 10 ? "rgba(255,255,255,0.85)" : tone(b), 1.2);
  for (const base of [33, 54]) {
    if (!J[base]) continue;
    const col = base === 33 ? tone(15) : tone(16);
    for (const [a, b] of HAND_LINKS) line(base + a, base + b, col, 0.7);
  }
  const dot = (i: number, r: number) => {
    const p = P[i];
    if (!p || p[2] <= 0) return;
    ctx.fillStyle = "rgba(4,20,34,0.8)";
    ctx.beginPath();
    ctx.arc(p[0], p[1], (r + 0.8) * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tone(i);
    ctx.beginPath();
    ctx.arc(p[0], p[1], r * dpr, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const i of [0, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]) dot(i, i >= 15 && i <= 22 ? 1.4 : 2);
  for (const base of [33, 54]) if (J[base]) for (let k = 1; k < 21; k++) dot(base + k, 0.9);
}

/** etichetta con fondo scuro e bordo del colore della misura */
const TAG_FONT = (dpr: number) => `500 ${9.5 * dpr}px system-ui, sans-serif`;

/** etichetta piccola: fondo scuro arrotondato, una sola tacca del colore della misura sul lato della linea guida */
function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tone: "cyan" | "gold" | "warn", dpr: number, center: boolean, side = 1) {
  ctx.font = TAG_FONT(dpr);
  const w = ctx.measureText(text).width + 10 * dpr;
  const h = 14 * dpr;
  const W = ctx.canvas.width;
  const bx = Math.max(4 * dpr, Math.min(W - w - 4 * dpr, center ? x - w / 2 : side < 0 ? x - w : x));
  const by = y - h / 2;
  const r = 3 * dpr;
  ctx.fillStyle = "rgba(3,16,26,0.7)";
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + w, by, bx + w, by + h, r);
  ctx.arcTo(bx + w, by + h, bx, by + h, r);
  ctx.arcTo(bx, by + h, bx, by, r);
  ctx.arcTo(bx, by, bx + w, by, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = tone === "warn" ? "#ffa06e" : tone === "gold" ? "#ffd678" : "#5fd4ff";
  const ax = center ? bx + r : side < 0 ? bx + w - 2 * dpr : bx;
  ctx.fillRect(ax, by + 3 * dpr, 2 * dpr, h - 6 * dpr);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, bx + 5 * dpr, y + 0.5 * dpr);
}
