import { useEffect, useMemo, useRef, useState } from "react";
import { boneCal, buildModel, depthMemo, v3, type BoneCal, type Build, type ImageFrame, type Model, type PrePose, type V3 } from "@/lib/arcieri/anatomy-model";
import { solveMotion } from "@/lib/arcieri/motion-solve";
import { aimScene, type AimInfo, type AimSetup } from "@/lib/arcieri/aim-view";
import { useArcherSetup } from "@/lib/arcieri/setup";
import { bodySlices, buildFrom, overlap, rasterAura, sliceWidth, type Aura } from "@/lib/arcieri/aura";
import { createAnatomyRenderer, lookAt, mul4, perspective } from "@/lib/arcieri/anatomy-render";
import { BODY_CREDIT, loadBody } from "@/lib/arcieri/anatomy-body";
import { mixLm, sideEvidence, swapSides, type Gear, type Hand, type Landmark } from "@/lib/arcieri/pose-analysis";
import { unpackLm, type PackedLm } from "@/lib/arcieri/gesture-record";
import { saveFile } from "@/lib/arcieri/native";
import { cx } from "./kit";
import { Glyph } from "./icons";

/** punti con sinistra e destra scambiate, una volta sola per fotogramma (la stessa posa resta la stessa) */
const mirrored = new WeakMap<Landmark[], Landmark[]>();
function mirrorCache(lm: Landmark[]) {
  let m = mirrored.get(lm);
  if (!m) {
    m = swapSides(lm);
    mirrored.set(lm, m);
  }
  return m;
}

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

/** ingrandimento del video nel riquadro (pizzico sullo scheletro): la sagoma lo segue */
export type View2d = { z: number; x: number; y: number };

/**
 * Camera "come il video": proiezione parallela del fotogramma, così ogni punto della sagoma cade
 * esattamente sul punto trovato nel video (larghezza e altezza della sagoma vengono dal video, la
 * profondità no: una prospettiva qualsiasi li spostava). Girando con il dito ruota attorno al corpo
 * e il fotogramma resta allineato; v2d riporta lo stesso ingrandimento del video nel riquadro.
 */
function videoCamera(fr: ImageFrame, pivot: V3, c: { yaw: number; pitch: number; zoom: number }, W: number, H: number, v2d?: View2d | null) {
  const fw = Math.max(0.1, fr.x1 - fr.x0);
  const fh = Math.max(0.1, fr.yTop - fr.yBot);
  const ca = W / H;
  // il fotogramma intero nel riquadro, come object-contain del video
  let hw = fw / 2;
  let hh = fh / 2;
  if (ca > fw / fh) hw = hh * ca;
  else hh = hw / ca;
  const ox = (fr.x0 + fr.x1) / 2 - pivot[0];
  const oy = (fr.yTop + fr.yBot) / 2 - pivot[1];
  const z = c.zoom;
  const l = (ox - hw) / z;
  const r = (ox + hw) / z;
  const b = (oy - hh) / z;
  const t = (oy + hh) / z;
  const dist = 8;
  const near = 0.5;
  const far = 16;
  const eye: V3 = [pivot[0] + Math.sin(c.yaw) * Math.cos(c.pitch) * dist, pivot[1] + Math.sin(c.pitch) * dist, pivot[2] + Math.cos(c.yaw) * Math.cos(c.pitch) * dist];
  const P = new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (far - near), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(far + near) / (far - near), 1]);
  let VP = mul4(P, lookAt(eye, pivot));
  if (v2d && (v2d.z !== 1 || v2d.x || v2d.y)) {
    // lo stesso translate+scale (origine in alto a sinistra) del video, in coordinate dello schermo
    const M = new Float32Array([v2d.z, 0, 0, 0, 0, v2d.z, 0, 0, 0, 0, 1, 0, v2d.z - 1 + (2 * v2d.x) / Math.max(1, W), 1 - v2d.z - (2 * v2d.y) / Math.max(1, H), 0, 1]);
    VP = mul4(M, VP);
  }
  return { eye, VP };
}

/** sguardo nella visuale dell'arciere: ingrandimento e quanto ci si scosta dall'oro (radianti) */
export type AimCam = { zoom: number; yaw: number; pitch: number };
const AIM_FOV = (30 * Math.PI) / 180;

/** la camera nell'occhio di mira, che guarda l'oro (o poco accanto, se si è spostato lo sguardo) */
function aimCamera(info: AimInfo, c: AimCam, W: number, H: number) {
  const d0 = v3.norm(v3.sub(info.gold, info.eye));
  const yaw = Math.atan2(d0[0], d0[2]) + c.yaw;
  const pitch = Math.asin(Math.max(-1, Math.min(1, d0[1]))) + c.pitch;
  const dir: V3 = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const fov = AIM_FOV / Math.max(0.3, c.zoom);
  const VP = mul4(perspective(fov, W / H, 0.03, 170), lookAt(info.eye, v3.add(info.eye, dir)));
  return { VP, eye: info.eye, dir };
}

/**
 * Campo di tiro dietro il paglione (sotto il 3D): cielo, foschia all'orizzonte e una fila di alberi
 * lontani (a 165 m, fissi nel mondo). Il prato e il paglione li disegna il 3D sopra.
 */
function paintField(ctx: CanvasRenderingContext2D, VP: Float32Array, eye: V3, dir: V3, W: number, H: number) {
  const proj = (p: V3): [number, number, number] => {
    const x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12];
    const y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13];
    const w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
    return [((x / w) * 0.5 + 0.5) * W, (1 - ((y / w) * 0.5 + 0.5)) * H, w];
  };
  const flat = v3.norm([dir[0], 0, dir[2]]);
  const hz = proj(v3.add([eye[0], eye[1], eye[2]], v3.mul(flat, 5000)))[1];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sky = ctx.createLinearGradient(0, Math.min(0, hz - H), 0, Math.max(hz, 1));
  sky.addColorStop(0, "#6f95b3");
  sky.addColorStop(0.75, "#a9bfcc");
  sky.addColorStop(1, "#cdd7da");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, Math.max(0, Math.min(H, hz)));
  ctx.fillStyle = "#b3c2c7";
  ctx.fillRect(0, Math.max(0, hz), W, Math.max(0, H - hz));
  // alberi lontani: chiome irregolari, già velate dall'aria
  const az0 = Math.atan2(flat[0], flat[2]);
  const span = 1.4;
  const N = 700;
  const top: [number, number][] = [];
  const base: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const az = az0 - span + (2 * span * i) / N;
    // chiome tonde larghe 6-9 m su una linea che sale e scende piano
    const ph = (az * Math.PI * 165) / 7.5 + 1.4 * Math.sin(az * 17);
    const bump = Math.sqrt(Math.abs(Math.sin(ph)));
    const h = 7 + 1.1 * Math.sin(az * 5 + 0.4) + 0.8 * Math.sin(az * 13 + 1.3) + 2.6 * bump * (0.65 + 0.35 * Math.sin(az * 41 + 2.1));
    const at: V3 = [eye[0] + Math.sin(az) * 165, h, eye[2] + Math.cos(az) * 165];
    const pt = proj(at);
    const pb = proj([at[0], -1, at[2]]);
    if (pt[2] <= 0) continue;
    top.push([pt[0], pt[1]]);
    base.push([pb[0], pb[1]]);
  }
  if (top.length > 1) {
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (const q of top) ctx.lineTo(q[0], q[1]);
    for (let i = base.length - 1; i >= 0; i--) ctx.lineTo(base[i][0], base[i][1]);
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, Math.min(...top.map((q) => q[1])), 0, hz);
    tg.addColorStop(0, "#617669");
    tg.addColorStop(1, "#7b8d84");
    ctx.fillStyle = tg;
    ctx.fill();
  }
}

/** come si guarda nella visuale: tiro istintivo (si guarda l'oro) o mira con la punta della freccia (gap) */
export type AimMode = "istintivo" | "punta";

/**
 * Sopra il 3D, con le scritte: la traiettoria tratteggiata, dove l'asta punta (sopra l'oro, la freccia poi
 * scende), dove si vede la punta della freccia sul bersaglio e dove si guarda. Nel tiro istintivo lo sguardo
 * resta sull'oro e la punta si vede solo di lato; nella mira con la punta si mette la punta sul suo punto.
 */
function paintAimHud(ctx: CanvasRenderingContext2D, VP: Float32Array, info: AimInfo, W: number, H: number, dpr: number, mode: AimMode = "istintivo") {
  const proj = (p: V3): [number, number] | null => {
    const x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12];
    const y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13];
    const w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
    if (w < 0.05) return null;
    return [((x / w) * 0.5 + 0.5) * W, (1 - ((y / w) * 0.5 + 0.5)) * H];
  };
  const cm = (v: number) => `${Math.abs(Math.round(v))} cm ${v < 0 ? "sotto" : "sopra"} l'oro`;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = "round";
  // traiettoria
  ctx.beginPath();
  let on = false;
  for (const p of info.path) {
    const q = proj(p);
    if (!q) {
      on = false;
      continue;
    }
    if (on) ctx.lineTo(q[0], q[1]);
    else ctx.moveTo(q[0], q[1]);
    on = true;
  }
  ctx.setLineDash([5 * dpr, 4 * dpr]);
  ctx.lineWidth = 1.4 * dpr;
  ctx.strokeStyle = "rgba(255, 224, 140, 0.85)";
  ctx.stroke();
  ctx.setLineDash([]);
  /** etichetta su fondo scuro, accanto a un punto, a destra se c'è posto */
  const label = (q: [number, number], text: string, col: string, dy = 0) => {
    ctx.font = `600 ${Math.round(11 * dpr)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    const w = ctx.measureText(text).width + 12 * dpr;
    const h = 18 * dpr;
    let x = q[0] + 12 * dpr;
    let below = 0;
    if (x + w > W - 4 * dpr) x = q[0] - 12 * dpr - w;
    if (x < 4 * dpr) {
      // non ci sta né a destra né a sinistra: sotto il punto, dentro lo schermo
      x = Math.max(4 * dpr, Math.min(W - w - 4 * dpr, q[0] - w / 2));
      below = 14 * dpr + h / 2;
    }
    const y = Math.max(4 * dpr, Math.min(H - h - 4 * dpr, q[1] - h / 2 + dy + below));
    ctx.fillStyle = "rgba(10, 14, 18, 0.72)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 9 * dpr);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 6 * dpr, y + h / 2 + 0.5 * dpr);
  };
  const ring = (q: [number, number], r: number, col: string, wdt: number) => {
    ctx.beginPath();
    ctx.arc(q[0], q[1], r * dpr, 0, Math.PI * 2);
    ctx.lineWidth = wdt * dpr;
    ctx.strokeStyle = col;
    ctx.stroke();
  };
  const g = proj(info.gold);
  const a = proj(info.aimPt);
  const sh = proj(info.shaftPt);
  // dove punta l'asta: sopra l'oro (in entrambe le viste, piccolo)
  if (sh) {
    ctx.beginPath();
    ctx.moveTo(sh[0] - 5 * dpr, sh[1]);
    ctx.lineTo(sh[0] + 5 * dpr, sh[1]);
    ctx.moveTo(sh[0], sh[1] - 5 * dpr);
    ctx.lineTo(sh[0], sh[1] + 5 * dpr);
    ctx.lineWidth = 1.4 * dpr;
    ctx.strokeStyle = "rgba(255, 224, 140, 0.95)";
    ctx.stroke();
    label(sh, `L'asta punta qui: ${cm(info.shaftCm)}`, "#ffe08c");
  }
  if (mode === "istintivo") {
    // lo sguardo sull'oro; la punta si vede solo di lato
    if (a) {
      ring(a, 5, "rgba(120, 225, 255, 0.55)", 1.2);
      label(a, "La punta: la vedi solo di lato", "rgba(175, 235, 255, 0.85)");
    }
    if (g) {
      ring(g, 9, "rgba(255, 255, 255, 0.95)", 2);
      ring(g, 15, "rgba(255, 255, 255, 0.45)", 1);
      label(g, "Guardi qui: il centro del bersaglio", "#ffffff");
    }
  } else {
    // mira con la punta: la punta va sul suo punto, a questa distanza dall'oro
    if (a && g) {
      ctx.beginPath();
      ctx.moveTo(a[0] + 18 * dpr, a[1]);
      ctx.lineTo(g[0] + 18 * dpr, g[1]);
      ctx.lineWidth = 1.2 * dpr;
      ctx.strokeStyle = "rgba(120, 225, 255, 0.9)";
      ctx.stroke();
      for (const q of [a, g]) {
        ctx.beginPath();
        ctx.moveTo(q[0] + 13 * dpr, q[1]);
        ctx.lineTo(q[0] + 23 * dpr, q[1]);
        ctx.stroke();
      }
    }
    if (g) ring(g, 6, "rgba(255, 255, 255, 0.7)", 1.2);
    if (a) {
      ring(a, 7, "rgba(120, 225, 255, 0.98)", 2);
      label(a, `Metti qui la punta: ${cm(info.gapCm)}`, "#9fe9ff", 0);
    }
  }
  ctx.restore();
}

/** dall'occhio la pelle traslucida velerebbe tutto: si vedono i muscoli (e lo scheletro, se acceso) */
const aimLayers = (L: Record<Layer, boolean>): Record<Layer, boolean> => ({ pelle: false, muscolo: true, osso: L.osso, punti: false, quote: false });

/** la sagoma nella visuale dell'arciere: scena girata con l'angolo balistico, camera nell'occhio */
function aimFrame(model: Model, setup: AimSetup, distanceM: number, hand: Hand, c: AimCam, W: number, H: number) {
  const sc = aimScene(model, setup, distanceM, hand);
  if (!sc) return null;
  return { ...sc, ...aimCamera(sc.info, c, W, H) };
}

/** la vista scelta nella sagoma 3D: la usano anche foto e video in alta definizione */
export const sagomaView: { yaw: number; pitch: number; zoom: number; layers: Record<Layer, boolean>; style?: SagomaStyle } = {
  yaw: 0,
  pitch: 0.06,
  zoom: 1,
  style: 0,
  layers: { pelle: true, muscolo: true, osso: true, punti: true, quote: true },
};

/**
 * Stile della tavola: 0 = studio (grafite, come i visori anatomici), 1 = tavola chiara (come un atlante
 * stampato). Sfondo, inchiostro delle quote e velo della pelle cambiano insieme.
 */
export type SagomaStyle = 0 | 1;
const BG: Record<SagomaStyle, [number, string][]> = {
  0: [
    [0, "#454c54"],
    [0.45, "#2b3035"],
    [0.8, "#191c20"],
    [1, "#101214"],
  ],
  1: [
    [0, "#fbfaf7"],
    [0.5, "#ecebe6"],
    [1, "#d6d4cd"],
  ],
};
const bgCss = (st: SagomaStyle) => `radial-gradient(ellipse at 45% 35%, ${BG[st].map(([k, c]) => `${c} ${Math.round(k * 100)}%`).join(", ")})`;
/** inchiostro sopra la sagoma: chiaro su fondo scuro, scuro su fondo chiaro */
const INK: Record<SagomaStyle, { ring: string; line: string; hand: string; dot: string; gold: string; cyan: string; warn: string }> = {
  0: { ring: "255,255,255", line: "rgba(255,255,255,0.55)", hand: "rgba(255,255,255,0.45)", dot: "rgba(255,255,255,0.8)", gold: "rgba(255,214,120,0.85)", cyan: "rgba(170,215,255,0.75)", warn: "rgba(255,160,110,0.8)" },
  1: { ring: "24,28,32", line: "rgba(24,28,32,0.5)", hand: "rgba(24,28,32,0.4)", dot: "rgba(24,28,32,0.75)", gold: "rgba(150,100,12,0.9)", cyan: "rgba(28,88,138,0.85)", warn: "rgba(190,75,35,0.9)" },
};

/**
 * Aura: la sagoma prende la corporatura dell'arciere. Su alcuni fotogrammi la silhouette della sagoma
 * vista come il video (che non si mostra) si confronta con la silhouette dell'arciere: larghezza a
 * fette di busto, testa, braccio dell'arco e gambe. Il rapporto mediano dà lo spessore di ogni parte,
 * poi si ricontrolla quanto le due silhouette coincidono (prima e dopo, 0..1).
 */
export async function auraFit(o: { frames: { lm: Landmark[]; aura: Aura }[]; aspect: number; hand: Hand; cal: BoneCal | null; /** per le prove: le due silhouette e le fette di ogni fotogramma */ debug?: (d: { S: Uint8Array; A: Uint8Array; W: number; H: number; slices: { p: [number, number]; d: [number, number]; wa: number; ws: number; g: string }[] }) => void }): Promise<{ build: Build; before: number; after: number; n: number } | null> {
  if (o.frames.length < 3) return null;
  const long = 320;
  const W = o.aspect >= 1 ? long : Math.max(16, Math.round(long * o.aspect));
  const H = o.aspect >= 1 ? Math.max(16, Math.round(long / o.aspect)) : long;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const R = createAnatomyRenderer(canvas, true);
  if (!R) return null;
  try {
    const body = (await loadBody("leggero")) ?? (await loadBody("pieno"));
    if (!body) return null;
    R.setBody(body, "leggero");
    const view = { yaw: 0, pitch: 0, zoom: 1 };
    const sil = (lm: Landmark[], build: Build | null) => {
      const model = buildModel(lm, o.aspect, o.hand, null, { ...(o.cal ?? {}), build: build ?? undefined });
      if (!model?.frame) return null;
      const { VP, eye } = videoCamera(model.frame, model.center, view, W, H);
      return R.silhouette(model, VP, eye, W, H);
    };
    const archers = o.frames.map((f) => ({ lm: f.lm, A: rasterAura(f.aura, W, H) }));
    /** quanto le due auree coincidono in media con una corporatura */
    const score = (build: Build | null) => {
      let sum = 0;
      let n = 0;
      for (const a of archers) {
        const S = sil(a.lm, build);
        if (!S) continue;
        sum += overlap(S, a.A);
        n += 1;
      }
      return n ? sum / n : 0;
    };
    const one: Build = { torso: 1, arm: 1, leg: 1, head: 1 };
    const before = score(null);
    // 1) quanto credere alla girata del busto stimata dal video: quella che fa coincidere meglio le auree
    let best = { turn: 1, s: before };
    for (const turn of [0.65, 0.3, 0]) {
      const sc = score({ ...one, turn });
      if (sc > best.s + 0.002) best = { turn, s: sc };
    }
    // 2) corporatura: per ogni parte (busto, braccia, gambe, testa) lo spessore che fa coincidere meglio le
    //    auree, a piccoli passi, due giri. Le fette dicono da che parte provare per prima
    const ratios: Record<"torso" | "arm" | "leg" | "head", number[]> = { torso: [], arm: [], leg: [], head: [] };
    for (const a of archers.slice(0, 4)) {
      const S = sil(a.lm, { ...one, turn: best.turn });
      if (!S) continue;
      const dbg: { p: [number, number]; d: [number, number]; wa: number; ws: number; g: string }[] = [];
      for (const sl of bodySlices(a.lm, o.hand, W, H)) {
        const wa = sliceWidth(a.A, W, H, sl);
        const ws = sliceWidth(S, W, H, sl);
        dbg.push({ p: sl.p, d: sl.d, wa, ws, g: sl.g });
        if (wa >= 3 && ws >= 3 && wa / ws > 0.5 && wa / ws < 2.2) ratios[sl.g].push(wa / ws);
      }
      o.debug?.({ S, A: a.A, W, H, slices: dbg });
    }
    const hint = buildFrom(ratios);
    let cur: Build = { ...one, turn: best.turn };
    let curS = best.s;
    for (let pass = 0; pass < 2; pass++) {
      for (const g of ["torso", "leg", "arm", "head"] as const) {
        // primo giro: quello che dicono le fette, poi un passo per parte; secondo giro: ritocchi
        const steps = pass === 0 ? [hint[g], hint[g] >= 1 ? 1.1 : 0.9] : [cur[g] * 0.95, cur[g] * 1.05];
        for (const k of steps) {
          const v = Math.max(0.7, Math.min(1.45, k));
          if (Math.abs(v - cur[g]) < 0.01) continue;
          const trial: Build = { ...cur, [g]: v };
          const sc = score(trial);
          if (sc > curS + 0.002) {
            cur = trial;
            curS = sc;
          }
        }
      }
    }
    const n = archers.length;
    const build = cur;
    const after = curS;
    return { build, before, after: Math.max(after, best.s), n };
  } finally {
    R.dispose();
  }
}

/**
 * Pittore della sagoma 3D fuori schermo, in alta definizione (foto 4K, video 1080p): stesso corpo,
 * stessa luce, stessa vista dello schermo, con lo sfondo e i crediti dell'atlante anatomico.
 */
export async function sagomaPainter(W: number, H: number, quality: "hd" | "pieno" = "hd", /** scala di testi e linee (come lo schermo); se manca, come un telefono largo 440 punti */ hudScale?: number) {
  const gl = document.createElement("canvas");
  gl.width = W;
  gl.height = H;
  const R = createAnatomyRenderer(gl, true);
  if (!R) return null;
  // il corpo in piena definizione dell'atlante (si scarica la prima volta), altrimenti quello dello schermo;
  // per preparare il play fluido basta quello dello schermo (più veloce)
  const body = (quality === "hd" ? await loadBody("hd") : null) ?? (await loadBody("pieno")) ?? (await loadBody("leggero"));
  if (body) R.setBody(body, "pieno");
  await R.gearLoaded();
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  // il testo e le linee come sullo schermo di un telefono largo 400 punti
  const dpr = hudScale ?? Math.min(W, H) / 440;
  let camSm: { c: V3; h: number } | null = null;
  let lastT = 0;
  const memo = depthMemo();
  return {
    canvas: out,
    /** disegna la posa; smooth: inquadratura che segue piano (video), altrimenti esatta (foto) */
    paint(o: { lm: Landmark[]; aspect: number; hand: Hand; gear: Gear | null; cal: BoneCal | null; time: number; smooth?: boolean; view?: typeof sagomaView; /** centro dell'inquadratura scelto dal modello (es. una mano), per i dettagli */ at?: (m: Model) => V3; /** inquadratura "come il video" (con l'eventuale ingrandimento, in frazioni del riquadro) */ frameView?: { z: number; nx: number; ny: number } | null; /** crediti scritti sull'immagine (no per i fotogrammi del play: sotto c'è già la riga) */ credit?: boolean; /** posa già risolta sull'intero video (motion-solve) */ pre?: PrePose | null; /** visuale dell'arciere con il paglione */ aim?: { setup: AimSetup; distanceM: number; cam?: AimCam; mode?: AimMode } | null }) {
      const view = o.view ?? sagomaView;
      const model = buildModel(o.lm, o.aspect, o.hand, o.gear, o.cal, o.pre ? null : o.smooth ? memo : null, o.time, o.pre ?? null);
      if (o.aim) {
        const af = model ? aimFrame(model, o.aim.setup, o.aim.distanceM, o.hand, o.aim.cam ?? { zoom: 1, yaw: 0, pitch: 0 }, W, H) : null;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (!af) return false;
        R.setStyle(0);
        paintField(ctx, af.VP, af.eye, af.dir, W, H);
        R.clear(W, H);
        R.draw(af.model, af.VP, af.eye, o.time, aimLayers(view.layers), null, false, af.info.cut);
        ctx.drawImage(gl, 0, 0);
        paintAimHud(ctx, af.VP, af.info, W, H, dpr, o.aim.mode ?? "istintivo");
        if (o.credit === false) return true;
        ctx.font = `500 ${Math.round(9 * dpr)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillText(BODY_CREDIT, W / 2, H - 8 * dpr);
        return true;
      }
      const g = ctx.createRadialGradient(W * 0.45, H * 0.35, 0, W * 0.45, H * 0.35, Math.max(W, H) * 0.8);
      const st: SagomaStyle = view.style ?? 0;
      R.setStyle(st);
      for (const [k, c] of BG[st]) g.addColorStop(k, c);
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
      const fv = o.frameView;
      const { VP, eye } = fv && model.frame && !o.at
        ? videoCamera(model.frame, camSm.c, view, W, H, { z: fv.z, x: fv.nx * W, y: fv.ny * H })
        : sceneCamera(o.at ? { c: o.at(model), h: camSm.h } : camSm, view, W, H);
      R.clear(W, H);
      R.draw(model, VP, eye, o.time, view.layers, null, false);
      paintStage(ctx, model, VP, W, H, st);
      ctx.drawImage(gl, 0, 0);
      paintHud(ctx, model, VP, W, H, dpr, view.layers, o.time, st);
      // crediti dell'atlante (licenze CC BY e CC BY-SA): restano sull'immagine
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (o.credit === false) return true;
      ctx.font = `500 ${Math.round(9 * dpr)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = st ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.55)";
      ctx.fillText(BODY_CREDIT, W / 2, H - 8 * dpr);
      return true;
    },
    /** paglione, visuale e prato pronti per la visuale dell'arciere */
    aimReady() {
      return R.loadTarget();
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
  mirror = false,
  transport,
  view2d,
  build,
  track,
  clock,
}: {
  /**
   * Tutti i fotogrammi dell'analisi: la sagoma si prepara una volta (immagine per immagine, come il video)
   * e durante il play si mostrano quelle, sincronizzate con il video: fluida anche sui telefoni più lenti
   */
  track?: { t: number[]; at: (i: number) => { lm: Landmark[] | null; gear: Gear | null; /** dentro un tiro (freccia sulla corda) */ armed?: boolean } } | null;
  /** il tempo del video, letto a ogni immagine dello schermo */
  clock?: () => number;
  /** corporatura presa dall'aura dell'arciere (silhouette nel video): spessore di busto, braccia, gambe, testa */
  build?: Build | null;
  /** ingrandimento del video nel riquadro: la sagoma "come il video" lo segue */
  view2d?: View2d | null;
  /** sinistra e destra del modello scambiate rispetto al video (lette al contrario): si raddrizzano per il 3D */
  mirror?: boolean;
  /** comandi del video, per guardarlo anche a schermo intero */
  transport?: { playing: boolean; time: number; duration: number; onToggle: () => void; onSeek: (t: number) => void; step?: number };
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
  /** sotto il corpo: fondo da studio, luce e ombre a terra */
  const stageCanvas = useRef<HTMLCanvasElement>(null);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ pelle: true, muscolo: true, osso: true, punti: true, quote: true });
  const layersRef = useRef(layers);
  layersRef.current = layers;
  // stile della tavola (studio scuro o tavola chiara), ricordato sul telefono
  const [style, setStyleS] = useState<SagomaStyle>(() => {
    try {
      return localStorage.getItem("sagoma-stile") === "1" ? 1 : 0;
    } catch {
      return 0;
    }
  });
  const styleRef = useRef(style);
  styleRef.current = style;
  const setStyle = (v: SagomaStyle) => {
    setStyleS(v);
    try {
      localStorage.setItem("sagoma-stile", String(v));
    } catch {
      /* niente memoria: vale per ora */
    }
  };
  // si parte come la ripresa del video (di fronte), fermi: si gira con il dito
  // nel riquadro del video si parte "come il video": stessa inquadratura, punto su punto
  const homePitch = inBox ? 0 : 0.06;
  const cam = useRef({ yaw: 0, pitch: homePitch, zoom: 1, auto: false, home: false });
  /** girata rispetto al video: compare «Come il video» per tornare davanti */
  const [turned, setTurned] = useState(false);
  const turnedRef = useRef(false);
  /** si sta girando o avvicinando con le dita: si usa il corpo leggero */
  const dragging = useRef(false);
  const [auto, setAuto] = useState(false);
  /** a tutto schermo: il riquadro copre l'app (e, dove il telefono lo permette, anche le barre del sistema) */
  const [full, setFull] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!full) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    // uscendo dal vero schermo intero del telefono (tasto indietro) si chiude anche la vista grande
    const out = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    window.addEventListener("keydown", esc);
    document.addEventListener("fullscreenchange", out);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.removeEventListener("fullscreenchange", out);
      document.body.style.overflow = prev;
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    };
  }, [full]);
  function toggleFull() {
    if (full) {
      setFull(false);
      return;
    }
    setFull(true);
    // il vero schermo intero dove c'è; altrimenti basta il riquadro fisso sopra l'app
    void boxRef.current?.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
  }
  // ---- visuale dell'arciere: dall'occhio di mira, con il paglione alla distanza scelta ----
  const archer = useArcherSetup();
  const aimSetup = useMemo<AimSetup>(() => {
    const drawIn = archer.drawIn || 28;
    const typical = archer.grains ? Math.round((archer.grains.min + archer.grains.max) / 2) : 330;
    return {
      drawLb: archer.lb || 30,
      drawIn,
      grains: archer.arrow.weight || typical,
      lengthIn: archer.arrow.lengthIn || drawIn + 1,
      bowType: archer.bowType,
      known: archer.has && archer.arrow.weight > 0,
    };
  }, [archer.lb, archer.drawIn, archer.grains, archer.arrow.weight, archer.arrow.lengthIn, archer.bowType, archer.has]);
  const [aim, setAim] = useState(false);
  const [aimD, setAimD] = useState(18);
  const [aimInfo, setAimInfo] = useState<AimInfo | null>(null);
  const [aimMode, setAimMode] = useState<AimMode>("istintivo");
  const aimRef = useRef({ on: aim, D: aimD, setup: aimSetup, mode: aimMode });
  aimRef.current = { on: aim, D: aimD, setup: aimSetup, mode: aimMode };
  const aimCam = useRef<AimCam>({ zoom: 1, yaw: 0, pitch: 0 });
  const [failed, setFailed] = useState(false);
  /** il corpo anatomico vero è pronto (prima di allora non si mostra la sagoma semplice a tubi) */
  const [bodyReady, setBodyReady] = useState(false);
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
  const flipHand = swap !== mirror;
  const effHand: Hand = flipHand ? (hand === "destro" ? "mancino" : "destro") : hand;
  // lunghezze vere delle ossa: dalla sequenza salvata o dai fotogrammi dell'analisi; dal vivo si
  // imparano dai fotogrammi che passano
  const fixedCal = useMemo<BoneCal | null>(() => {
    const withBuild = (c: BoneCal) => (build ? { ...c, build } : c);
    if (calFrames && calFrames.length >= 8) return withBuild(boneCal(mirror ? calFrames.map((f) => (f ? swapSides(f) : f)) : calFrames, aspect));
    if (seq && seq.length >= 8) return withBuild(boneCal(seq.map((f) => unpackLm(f.lm)), aspect));
    return null;
  }, [calFrames, seq, aspect, mirror, build]);
  const live = useRef<{ frames: Landmark[][]; cal: BoneCal | null; n: number }>({ frames: [], cal: null, n: 0 });
  useEffect(() => {
    live.current = { frames: [], cal: null, n: 0 };
  }, [calFrames, aspect]);
  /** l'ultima posa disegnata: serve alla foto in alta definizione */
  const lastShot = useRef<{ lm: Landmark[] | null; aspect: number; hand: Hand; gear: Gear | null; cal: BoneCal | null; time: number; pre?: PrePose | null } | null>(null);
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
      const v2 = input.current.view2d;
      const frameView = inBox ? { z: v2?.z ?? 1, nx: (v2?.x ?? 0) / Math.max(1, box.clientWidth), ny: (v2?.y ?? 0) / Math.max(1, box.clientHeight) } : null;
      const am = aimRef.current;
      if (am.on) await painter.aimReady();
      painter.paint({ lm: shot.lm, aspect: shot.aspect, hand: shot.hand, gear: shot.gear, cal: shot.cal, time: shot.time, frameView, pre: shot.pre ?? null, aim: am.on ? { setup: am.setup, distanceM: am.D, cam: { ...aimCam.current }, mode: am.mode } : null });
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
  const input = useRef({ lm, lmRef, seq, aspect, hand: effHand, gearRef, cal: fixedCal, mirror, inBox, view2d: full ? null : (view2d ?? null), playing: Boolean(transport?.playing), clock, full });
  input.current = { lm, lmRef, seq, aspect, hand: effHand, gearRef, cal: fixedCal, mirror, inBox, view2d: full ? null : (view2d ?? null), playing: Boolean(transport?.playing), clock, full };

  // ---- movimento ricostruito sull'intero video (ossa intere, niente scatti né compenetrazioni) ----
  const [solved, setSolved] = useState<{ key: string; t: number[]; lm: (Landmark[] | null)[]; gear: (Gear | null)[]; pre: (PrePose | null)[] } | null>(null);
  const solvedRef = useRef(solved);
  solvedRef.current = solved;
  useEffect(() => {
    if (!track || track.t.length < 4) {
      setSolved(null);
      return;
    }
    let alive = true;
    const id = window.setTimeout(() => {
      const lm: (Landmark[] | null)[] = [];
      const gear: (Gear | null)[] = [];
      const fr = track.t.map((t, i) => {
        const a = track.at(i);
        const l = a.lm ? (mirror ? swapSides(a.lm) : a.lm) : null;
        lm.push(l);
        gear.push(a.gear);
        return { t, lm: l, gear: a.gear, armed: a.armed };
      });
      let pre: (PrePose | null)[] = [];
      try {
        pre = solveMotion(fr, aspect, effHand, fixedCal ?? null);
      } catch {
        pre = fr.map(() => null);
      }
      if (!alive) return;
      const key = `${mirror}|${effHand}|${aspect.toFixed(4)}|${JSON.stringify(fixedCal ?? null)}|${track.t.length}|${track.t[0]}|${track.t[track.t.length - 1]}`;
      setSolved({ key, t: track.t, lm, gear, pre });
    }, 30);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [track, fixedCal, mirror, effHand, aspect]);

  // ---- play fluido: la sagoma di ogni fotogramma dell'analisi preparata una volta, come immagini ----
  const cacheRef = useRef<{ key: string; t: number[]; blobs: (Blob | null)[] } | null>(null);
  const cacheCanvas = useRef<HTMLCanvasElement>(null);
  const [prep, setPrep] = useState<number | null>(null);
  const layersKey = `${layers.pelle}${layers.muscolo}${layers.osso}${layers.punti}${layers.quote}`;
  useEffect(() => {
    if (!track || !inBox || full || track.t.length < 2 || !solved) return;
    let alive = true;
    const run = async () => {
      const box = glCanvas.current;
      if (!box || !box.clientWidth || !box.clientHeight) return;
      const k = Math.min(1.5, window.devicePixelRatio || 1);
      const W = Math.round((box.clientWidth * k) / 2) * 2;
      const H = Math.round((box.clientHeight * k) / 2) * 2;
      const key = `${W}x${H}|${style}|${layersKey}|${solved.key}`;
      if (cacheRef.current?.key === key) return;
      cacheRef.current = null;
      const painter = await sagomaPainter(W, H, "pieno", k).catch(() => null);
      if (!painter || !alive) {
        painter?.dispose();
        return;
      }
      const blobs: (Blob | null)[] = new Array(track.t.length).fill(null);
      cacheRef.current = { key, t: track.t, blobs };
      setPrep(0);
      const view = { yaw: 0, pitch: 0, zoom: 1, layers: { ...layers }, style };
      try {
        for (let i = 0; i < track.t.length && alive; i++) {
          const fl = solved.lm[i];
          const gear = solved.gear[i];
          if (fl) {
            painter.paint({ lm: fl, aspect, hand: effHand, gear, cal: fixedCal, time: track.t[i], smooth: true, view, frameView: { z: 1, nx: 0, ny: 0 }, credit: false, pre: solved.pre[i] });
            blobs[i] = await new Promise<Blob | null>((res) => painter.canvas.toBlob(res, "image/jpeg", 0.86));
          }
          if (i % 8 === 0) setPrep(i / track.t.length);
          // lascia respirare lo schermo tra un fotogramma e l'altro
          await new Promise((r) => setTimeout(r, 0));
        }
      } finally {
        painter.dispose();
        if (alive) setPrep(null);
      }
    };
    const id = window.setTimeout(() => void run(), 500);
    return () => {
      alive = false;
      window.clearTimeout(id);
      setPrep(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, solved, fixedCal, style, layersKey, mirror, effHand, aspect, inBox, full]);

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
    // il corpo pieno si scarica subito insieme a quello leggero (che arriva prima): si mostra il primo pronto.
    // Se nessuno arriva entro 15 secondi (rete assente) si mostra la sagoma semplice, meglio di niente
    let ready = false;
    const markReady = () => {
      if (ready || !alive) return;
      ready = true;
      setBodyReady(true);
    };
    const fallback = window.setTimeout(markReady, 15000);
    void loadBody("leggero").then((b) => {
      if (!alive || !b) return;
      R.setBody(b, "leggero");
      bodyTick += 1;
      markReady();
    });
    void loadBody("pieno").then((f) => {
      if (!alive) return;
      if (f) {
        R.setBody(f, "pieno");
        bodyTick += 1;
      }
      markReady();
    });
    // in movimento si usa il corpo pieno se il telefono ce la fa (almeno ~24 immagini al secondo);
    // se no quello leggero solo mentre si muove
    let slowDevice = false;
    const moveDts: number[] = [];
    let smooth: Landmark[] | null = null;
    let model: Model | null = null;
    // profondità che insegue piano: niente braccia che scattano avanti e indietro
    const memo = depthMemo();
    let last = performance.now();
    const t0 = last;

    // si ridisegna solo quando cambia qualcosa (posa, camera, livelli, dimensioni): niente scatti
    // e niente batteria consumata a vuoto
    let lastTarget: Landmark[] | null = null;
    let lastCal: BoneCal | null = null;
    // play fluido: l'immagine preparata mostrata ora
    let shown: { i: number; bmp: ImageBitmap; key: string } | null = null;
    let decoding = false;
    /** immagini dei fotogrammi successivi, già decodificate */
    const ahead = new Map<number, ImageBitmap>();
    let drawnI = -1;
    let cacheVisible = false;
    let lastKey = "";
    let moving = false;
    let lastChange = -1e9;
    let lastFast = false;
    let camSm: { c: V3; h: number } | null = null;
    let scale = 1; // risoluzione adattiva: scende se il telefono non sta al passo
    let slow = 0;
    // visuale dell'arciere: l'ultima posa con la freccia sulla corda (dopo il rilascio resta quella)
    let aimSrc: Model | null = null;
    let aimSrcPre: PrePose | null = null;
    let targetAsked = false;
    let aimShown = "";
    let usedPre: PrePose | null = null;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const time = (now - t0) / 1000;
      // nascosto (vista non attiva o fuori schermo): non lavora
      if (!canvas.clientWidth || !canvas.clientHeight) return;
      const { lm: still, lmRef: ref, seq: sq, aspect: asp, hand: hd, gearRef: gr, cal: fc, mirror: mir } = input.current;
      // punti da mostrare: sequenza salvata (in ciclo), poi quelli dal vivo, poi quelli fissi
      let target: Landmark[] | null = null;
      const playing = Boolean(sq && sq.length > 1);
      if (playing && sq) {
        const end = sq[sq.length - 1].t + 0.9;
        target = seqAt(sq, time % end);
      } else target = ref?.current ?? still;
      if (target && mir) target = mirrorCache(target);
      // ossa o corporatura nuove (fine dell'analisi, aura): si ricostruisce il corpo anche da fermi
      if (fc !== lastCal) {
        lastCal = fc;
        moving = true;
        lastChange = now;
      }
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
      const { inBox: boxed, view2d: v2 } = input.current;
      const homeP = boxed ? 0 : 0.06;
      if (c.auto) c.yaw += dt * 0.35;
      else if (c.home) {
        // dopo «Ferma» si torna piano davanti, come nel video
        const tw = Math.round(c.yaw / (Math.PI * 2)) * Math.PI * 2;
        const k = 1 - Math.exp(-dt / 0.25);
        c.yaw += (tw - c.yaw) * k;
        c.pitch += (homeP - c.pitch) * k;
        c.zoom += (1 - c.zoom) * k;
        if (Math.abs(tw - c.yaw) < 0.002 && Math.abs(homeP - c.pitch) < 0.002 && Math.abs(1 - c.zoom) < 0.002) {
          c.yaw = tw;
          c.pitch = homeP;
          c.zoom = 1;
          c.home = false;
        }
      }
      const L0 = layersRef.current;
      const off = Math.abs(Math.atan2(Math.sin(c.yaw), Math.cos(c.yaw))) > 0.03 || Math.abs(c.pitch - homeP) > 0.03 || Math.abs(c.zoom - 1) > 0.03;
      if (off !== turnedRef.current && !c.auto) {
        turnedRef.current = off;
        setTurned(off);
      }
      // durante il play: le immagini preparate, sincronizzate con il video (niente 3D da calcolare)
      {
        const cache = cacheRef.current;
        const { playing: vPlaying, clock: clk, full: isFull } = input.current;
        const v2ok = !v2 || (v2.z === 1 && !v2.x && !v2.y);
        const cc = cacheCanvas.current;
        let used = false;
        if (cc && cache && vPlaying && clk && !isFull && v2ok && !turnedRef.current && !c.auto && !dragging.current && !aimRef.current.on) {
          const tNow = clk();
          let lo = 0;
          let hi = cache.t.length - 1;
          while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (cache.t[mid] <= tNow) lo = mid;
            else hi = mid;
          }
          const i = Math.abs(cache.t[hi] - tNow) < Math.abs(cache.t[lo] - tNow) ? hi : lo;
          const blob = cache.blobs[i];
          // le immagini dei prossimi fotogrammi si preparano prima: quando servono sono già pronte
          if (typeof createImageBitmap === "function" && !decoding) {
            for (const j of [i, i + 1, i + 2, i + 3]) {
              const bj = cache.blobs[j];
              if (!bj || ahead.has(j) || (shown?.i === j && shown.key === cache.key)) continue;
              decoding = true;
              const key = cache.key;
              void createImageBitmap(bj)
                .then((bmp) => {
                  if (key !== cacheRef.current?.key) bmp.close();
                  else ahead.set(j, bmp);
                })
                .catch(() => {})
                .finally(() => {
                  decoding = false;
                });
              break;
            }
          }
          const ready = ahead.get(i);
          if (blob && ready && shown?.i !== i) {
            const prev = shown;
            ahead.delete(i);
            shown = { i, bmp: ready, key: cache.key };
            prev?.bmp.close();
          }
          // quelle rimaste indietro (o di un'altra preparazione) si liberano
          for (const [j, bmp] of ahead) {
            if (j < i || j > i + 4) {
              bmp.close();
              ahead.delete(j);
            }
          }
          if (blob && shown && shown.key === cache.key) {
            if (drawnI !== shown.i) {
              drawnI = shown.i;
              if (cc.width !== shown.bmp.width || cc.height !== shown.bmp.height) {
                cc.width = shown.bmp.width;
                cc.height = shown.bmp.height;
              }
              cc.getContext("2d")?.drawImage(shown.bmp, 0, 0);
            }
            used = true;
          }
        }
        if (used !== cacheVisible && cc) {
          cacheVisible = used;
          cc.style.visibility = used ? "visible" : "hidden";
        }
        if (used) {
          // al termine del play si ridisegna subito dal vivo
          lastKey = "";
          return;
        }
      }
      const am = aimRef.current;
      const ac = aimCam.current;
      if (am.on && !targetAsked) {
        targetAsked = true;
        void R.loadTarget().then(() => {
          lastKey = "";
        });
      }
      const aimKey = am.on ? `${am.mode}|${am.D}|${ac.zoom.toFixed(3)}|${ac.yaw.toFixed(4)}|${ac.pitch.toFixed(4)}|${R.targetReady()}|${am.setup.drawLb},${am.setup.drawIn},${am.setup.grains},${am.setup.lengthIn},${am.setup.bowType}` : "";
      const key = `${aimKey}|${ready}|${styleRef.current}|${c.yaw.toFixed(4)}|${c.pitch.toFixed(4)}|${c.zoom.toFixed(3)}|${v2 ? `${v2.z},${v2.x},${v2.y}` : ""}|${L0.pelle}${L0.muscolo}${L0.osso}${L0.punti}${L0.quote}|${canvas.clientWidth}x${canvas.clientHeight}|${scale}|${bodyTick}|${R.gearReady()}`;
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
        // video analizzato: la posa ricostruita sull'intero video nel fotogramma più vicino (la stessa del play)
        const sv = solvedRef.current;
        const clk = input.current.clock;
        let fromSolved: Model | null = null;
        if (sv && clk) {
          const tNow = clk();
          let lo = 0;
          let hi = sv.t.length - 1;
          while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (sv.t[mid] <= tNow) lo = mid;
            else hi = mid;
          }
          const i = Math.abs(sv.t[hi] - tNow) < Math.abs(sv.t[lo] - tNow) ? hi : lo;
          const l = sv.lm[i];
          if (l && sv.pre[i] && Math.abs(sv.t[i] - tNow) < 0.06) {
            fromSolved = buildModel(l, asp, hd, sv.gear[i], fc ?? live.current.cal, null, sv.t[i], sv.pre[i]);
            if (fromSolved) usedPre = sv.pre[i];
          }
        }
        if (!fromSolved) usedPre = null;
        model = fromSolved ?? buildModel(smooth, asp, hd, gr?.current ?? null, fc ?? live.current.cal, memo, time) ?? model;
        if (model?.arrow) {
          aimSrc = model;
          aimSrcPre = usedPre;
        }
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
      const stage = stageCanvas.current;
      const sctx = stage?.getContext("2d") ?? null;
      if (stage && (stage.width !== W || stage.height !== H)) {
        stage.width = W;
        stage.height = H;
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
      // nel riquadro del video: inquadratura del video, punto su punto; altrimenti il corpo al centro
      const { VP, eye } = boxed && model.frame
        ? videoCamera(model.frame, camSm.c, c, W, H, v2 ? { z: v2.z, x: (v2.x * W) / Math.max(1, canvas.clientWidth), y: (v2.y * H) / Math.max(1, canvas.clientHeight) } : null)
        : sceneCamera(camSm, c, W, H);
      const L = layersRef.current;
      // la vista scelta (angolo, distanza, livelli) vale anche per foto e video in alta definizione
      sagomaView.yaw = c.yaw;
      sagomaView.pitch = c.pitch;
      sagomaView.zoom = c.zoom;
      sagomaView.layers = { ...L };
      sagomaView.style = styleRef.current;
      R.setStyle(styleRef.current);
      lastShot.current = { lm: smooth, aspect: asp, hand: hd, gear: gr?.current ?? null, cal: fc ?? live.current.cal, time, pre: usedPre };
      if (!ready && !R.hasBody()) return;
      if (am.on) {
        // visuale dell'arciere: niente quote né studio, il campo di tiro visto dall'occhio di mira
        const af = aimSrc ? aimFrame(aimSrc, am.setup, am.D, hd, ac, W, H) : null;
        if (sctx) {
          sctx.setTransform(1, 0, 0, 1, 0, 0);
          if (af) paintField(sctx, af.VP, af.eye, af.dir, W, H);
          else {
            sctx.fillStyle = "#9fb4bf";
            sctx.fillRect(0, 0, W, H);
          }
        }
        if (aimSrc && lastShot.current && aimSrc !== model) lastShot.current = { ...lastShot.current, pre: aimSrcPre };
        const sig = af ? `${af.info.distanceM}|${af.info.thetaDeg.toFixed(1)}|${af.info.videoDeg.toFixed(1)}|${af.info.gapCm.toFixed(0)}|${af.info.v0.toFixed(0)}|${af.info.tof.toFixed(2)}` : "none";
        if (sig !== aimShown) {
          aimShown = sig;
          setAimInfo(af ? af.info : null);
        }
        if (!af) return;
        R.setStyle(0);
        R.draw(af.model, af.VP, af.eye, time, aimLayers(L), null, fast && slowDevice, af.info.cut);
        paintAimHud(ctx, af.VP, af.info, W, H, dpr, am.mode);
        return;
      }
      if (fast && !slowDevice && R.hasBody()) {
        moveDts.push(dt);
        if (moveDts.length >= 40) {
          const sorted = [...moveDts].sort((x, y) => x - y);
          if (sorted[Math.floor(sorted.length / 2)] > 0.042) slowDevice = true;
          moveDts.length = 0;
        }
      }
      R.draw(model, VP, eye, time, L, null, fast && slowDevice);

      if (sctx) {
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        paintStage(sctx, model, VP, W, H, styleRef.current);
      }
      paintHud(ctx, model, VP, W, H, dpr, L, time, styleRef.current);
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
      const ac = aimCam.current;
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch && aimRef.current.on) ac.zoom = Math.max(1, Math.min(6, ac.zoom * (d / pinch)));
        else if (pinch) cam.current.zoom = Math.max(0.7, Math.min(4, cam.current.zoom * (d / pinch)));
        pinch = d;
        return;
      }
      if (aimRef.current.on) {
        // nella visuale si sposta lo sguardo (come trascinare il campo), poco attorno all'oro
        const k = 0.0028 / ac.zoom;
        ac.yaw = Math.max(-0.6, Math.min(0.6, ac.yaw + (e.clientX - prev.x) * k));
        ac.pitch = Math.max(-0.45, Math.min(0.45, ac.pitch + (e.clientY - prev.y) * k));
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
      if (aimRef.current.on) {
        aimCam.current.zoom = Math.max(1, Math.min(6, aimCam.current.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
        return;
      }
      cam.current.zoom = Math.max(0.7, Math.min(4, cam.current.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      alive = false;
      window.clearTimeout(fallback);
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      for (const b of ahead.values()) b.close();
      ahead.clear();
      R.dispose();
    };
  }, []);

  if (failed) return <p className="rounded-2xl bg-white/[0.04] p-3 text-sm text-muted">Il 3D non parte su questo telefono: le misure restano nell'analisi qui sopra.</p>;
  const toggle = (k: Layer) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  // comandi sobri, leggibili su tutti e due i fondi: grafite su chiaro, vetro scuro su scuro
  const pill = style ? "bg-[#22303a]/85" : "bg-black/45";
  const chipOn = style ? "bg-[#22303a] text-white ring-1 ring-[#22303a]" : "bg-white/20 text-white ring-1 ring-white/55";
  const chipOff = style ? "bg-black/10 text-[#22303a]/70" : "bg-black/40 text-white/60";
  return (
    <div ref={boxRef} className={cx("overflow-hidden", full ? "fixed inset-0 z-[90] h-[100dvh] w-screen" : cx("relative w-full", inBox ? "" : "rounded-2xl", className))} style={{ background: bgCss(style) }}>
      <canvas ref={stageCanvas} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
      <canvas ref={glCanvas} className={cx("absolute inset-0 h-full w-full", inBox && !full ? "touch-pan-y" : "touch-none")} aria-label="Analisi del gesto in 3D: corpo, scheletro e muscoli, da girare con il dito" />
      <canvas ref={hudCanvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas ref={cacheCanvas} className="pointer-events-none absolute inset-0 h-full w-full" style={{ visibility: "hidden" }} aria-hidden />
      {prep != null && !aim ? (
        <p className={cx("pointer-events-none absolute inset-x-0 mx-auto w-fit rounded-full px-3 py-1 text-[0.7rem] font-semibold text-white backdrop-blur", full ? "bottom-28" : "bottom-14", style ? "bg-[#22303a]/80" : "bg-black/50")}>
          Preparo il play fluido… {Math.round(prep * 100)}%
        </p>
      ) : null}
      <p className={cx("pointer-events-none absolute inset-x-0 bottom-0 truncate px-2 text-center text-[0.45rem] leading-[0.7rem]", style ? "text-black/45" : "text-white/50")}>{BODY_CREDIT}</p>
      {!bodyReady && !empty ? <p className={cx("pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm", style ? "text-black/60" : "text-white/75")}>Preparo il corpo anatomico…</p> : null}
      {empty ? <p className={cx("absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm", style ? "text-black/70" : "text-white/80")}>In attesa della posa: avvia il video o scegli un fotogramma.</p> : null}
      {/* in alto: Gira e la foto in alta definizione; in basso cosa si vede (corpo, muscoli, scheletro…) */}
      <div className={cx("absolute flex flex-wrap gap-1", full ? "left-2 top-[max(0.5rem,env(safe-area-inset-top))]" : cx("top-2 w-[10.5rem]", inBox ? "left-2" : "right-2"))}>
        {!aim ? (
          <button
            type="button"
            aria-pressed={auto}
            onClick={() => {
              // ferma: torna piano alla vista del video
              cam.current.auto = !cam.current.auto;
              cam.current.home = !cam.current.auto;
              setAuto(cam.current.auto);
            }}
            className={cx("min-h-9 rounded-full px-3 text-xs font-semibold backdrop-blur", auto ? chipOn : cx(pill, "text-white"))}
          >
            {auto ? "Ferma" : "Gira"}
          </button>
        ) : null}
        <button
          type="button"
          aria-pressed={aim}
          disabled={empty}
          onClick={() => {
            // visuale dell'arciere: si parte guardando l'oro, senza ingrandimento
            aimCam.current = { zoom: 1, yaw: 0, pitch: 0 };
            cam.current.auto = false;
            setAuto(false);
            setAim(!aim);
          }}
          aria-label={aim ? "Torna alla sagoma" : "Visuale dell'arciere: il paglione visto dall'occhio di mira"}
          className={cx("min-h-9 rounded-full px-3 text-xs font-semibold backdrop-blur disabled:opacity-50", aim ? chipOn : cx(pill, "text-white"))}
        >
          {aim ? "Sagoma" : "Mira"}
        </button>
        <button
          type="button"
          disabled={shooting || empty}
          onClick={() => void photoHD()}
          aria-label="Foto della sagoma in alta definizione"
          className={cx("min-h-9 rounded-full px-3 text-xs font-semibold text-white backdrop-blur disabled:opacity-50", pill)}
        >
          {shooting ? "Foto…" : "Foto HD"}
        </button>
        {full ? (
          <button type="button" onClick={toggleFull} aria-pressed aria-label="Esci dallo schermo intero" className={cx("min-h-9 rounded-full px-3 text-xs font-semibold backdrop-blur", chipOn)}>
            Chiudi
          </button>
        ) : null}
        <div className={cx("flex items-center gap-1", full ? "" : "basis-full")}>
          {!full ? (
            // nell'anteprima solo l'icona, sotto «Gira»: in alto a destra c'è la scelta Scheletro / Sagoma
            <button type="button" onClick={toggleFull} aria-label="Guarda a schermo intero" title="Schermo intero" className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full text-white backdrop-blur", pill)}>
              <Glyph name="expand" size={17} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setStyle(style ? 0 : 1)}
            aria-label={style ? "Sfondo scuro, da studio" : "Sfondo chiaro, da tavola anatomica"}
            title={style ? "Sfondo scuro" : "Sfondo chiaro"}
            className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full text-white backdrop-blur", pill)}
          >
            {/* cerchio mezzo pieno: chiaro / scuro */}
            <svg viewBox="0 0 24 24" width={17} height={17} aria-hidden>
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
            </svg>
          </button>
          {turned && !auto && !aim ? (
            // girata o avvicinata con le dita: si torna all'inquadratura del video, punto su punto
            <button
              type="button"
              onClick={() => {
                cam.current.auto = false;
                cam.current.home = true;
              }}
              className={cx("min-h-9 rounded-full px-3 text-xs font-semibold text-white backdrop-blur", pill)}
            >
              {inBox ? "Come il video" : "Di fronte"}
            </button>
          ) : null}
        </div>
      </div>
      {full && transport ? (
        // a schermo intero anche il video: play, pausa, fotogramma per fotogramma e la linea del tempo
        <div className={cx("absolute inset-x-2 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+2.6rem)] flex items-center gap-1.5 rounded-full px-2 py-1 text-white backdrop-blur", pill)}>
          <button type="button" onClick={() => transport.onSeek(transport.time - (transport.step ?? 1 / 30))} aria-label="Fotogramma indietro" className="grid h-9 w-9 shrink-0 place-items-center rounded-full"><TrIcon k="prev" /></button>
          <button type="button" onClick={transport.onToggle} aria-label={transport.playing ? "Pausa" : "Play"} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 text-base ring-1 ring-white/55"><TrIcon k={transport.playing ? "pause" : "play"} /></button>
          <button type="button" onClick={() => transport.onSeek(transport.time + (transport.step ?? 1 / 30))} aria-label="Fotogramma avanti" className="grid h-9 w-9 shrink-0 place-items-center rounded-full"><TrIcon k="next" /></button>
          <input type="range" min={0} max={Math.max(0.01, transport.duration)} step={0.01} value={Math.min(transport.time, transport.duration)} onChange={(e) => transport.onSeek(Number(e.currentTarget.value))} aria-label="Tempo del video" className="min-w-0 flex-1 accent-white" />
          <span className="shrink-0 text-[0.7rem] tabular-nums text-white/80">{transport.time.toFixed(1)} s</span>
        </div>
      ) : null}
      {aim ? <AimPanel info={aimInfo} mode={aimMode} onMode={setAimMode} known={aimSetup.known} summary={aimSetup.known ? `${archer.summary}, frecce da ${aimSetup.grains} gr` : ""} full={full} /> : null}
      <div className={cx("absolute inset-x-2 flex flex-wrap justify-center gap-1", full ? "bottom-[max(1rem,env(safe-area-inset-bottom))]" : "bottom-4")}>
        {aim
          ? [18, 25, 30, 50, 70, 90].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={aimD === d}
                aria-label={`Paglione a ${d} metri`}
                onClick={() => {
                  aimCam.current = { zoom: aimCam.current.zoom, yaw: 0, pitch: 0 };
                  setAimD(d);
                }}
                className={cx("min-h-8 min-w-11 rounded-full px-2.5 text-[0.7rem] font-semibold tabular-nums backdrop-blur", aimD === d ? "bg-[#22303a] text-white ring-1 ring-[#22303a]" : "bg-black/35 text-white/85")}
              >
                {d} m
              </button>
            ))
          : null}
        {aim ? null : ([["pelle", "Corpo"], ["muscolo", "Muscoli"], ["osso", "Scheletro"], ["punti", "Punti"], ["quote", "Misure"]] as const).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={layers[k]} onClick={() => toggle(k)} className={cx("min-h-8 rounded-full px-2.5 text-[0.7rem] font-semibold backdrop-blur", layers[k] ? chipOn : chipOff)}>
            {label}
          </button>
        ))}
      </div>
      {shotMsg ? <p className="pointer-events-none absolute inset-x-0 top-14 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">{shotMsg}</p> : null}
    </div>
  );
}

/**
 * Studio "infinito": sfondo senza orizzonte (pavimento e parete si fondono), una pozza di luce a terra
 * sotto l'arciere e le ombre morbide di piedi e corpo, che lo appoggiano al suolo. Disegnato sotto il corpo.
 */
function paintStage(ctx: CanvasRenderingContext2D, model: Model, VP: Float32Array, W: number, H: number, style: SagomaStyle) {
  const proj = (p: V3): [number, number] => {
    const x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12];
    const y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13];
    const w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
    return [((x / w) * 0.5 + 0.5) * W, (1 - ((y / w) * 0.5 + 0.5)) * H];
  };
  // fondo: luce più chiara dietro il corpo, che sfuma nei bordi (nessuna linea dell'orizzonte)
  const ctr = proj(model.center);
  const g = ctx.createRadialGradient(ctr[0], ctr[1], 0, ctr[0], ctr[1] + H * 0.1, Math.max(W, H) * 0.95);
  for (const [k, c] of BG[style]) g.addColorStop(k, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // un cerchio a terra (raggio r attorno a c) visto dalla camera: centro e semiassi sullo schermo
  const disc = (c: V3, r: number) => {
    const o = proj([c[0], 0, c[2]]);
    let rx = 1;
    let ry = 1;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const q = proj([c[0] + Math.cos(a) * r, 0, c[2] + Math.sin(a) * r]);
      rx = Math.max(rx, Math.abs(q[0] - o[0]));
      ry = Math.max(ry, Math.abs(q[1] - o[1]));
    }
    // camera all'altezza del pavimento: il cerchio sarebbe una riga, si tiene un filo di spessore
    ry = Math.max(ry, rx * 0.14);
    return { o, rx, ry };
  };
  const blob = (c: V3, r: number, stops: [number, string][]) => {
    const d = disc(c, r);
    if (!Number.isFinite(d.o[0] + d.o[1] + d.rx + d.ry)) return;
    ctx.save();
    ctx.translate(d.o[0], d.o[1]);
    ctx.scale(d.rx, d.ry);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (const [k, col] of stops) rg.addColorStop(k, col);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  const feet = model.hud.feet;
  // pozza di luce: il pavimento sotto l'arciere un po' più chiaro, che si perde nel fondo
  blob(feet, 1.6, style ? [[0, "rgba(255,255,255,0.75)"], [0.5, "rgba(255,255,255,0.25)"], [1, "rgba(255,255,255,0)"]] : [[0, "rgba(255,255,255,0.10)"], [0.55, "rgba(255,255,255,0.035)"], [1, "rgba(255,255,255,0)"]]);
  // ombra del corpo e dei piedi: morbide, più scure dove il corpo tocca terra
  const sh = style ? 0.2 : 0.42;
  blob(feet, 0.42, [[0, `rgba(0,0,0,${sh * 0.55})`], [0.6, `rgba(0,0,0,${sh * 0.2})`], [1, "rgba(0,0,0,0)"]]);
  const J = model.J;
  if (J) {
    for (const [ank, toe] of [[27, 31], [28, 32]] as const) {
      if (!J[ank] || !J[toe]) continue;
      const m: V3 = [(J[ank][0] + J[toe][0]) / 2, 0, (J[ank][2] + J[toe][2]) / 2];
      blob(m, 0.13, [[0, `rgba(0,0,0,${sh})`], [0.55, `rgba(0,0,0,${sh * 0.35})`], [1, "rgba(0,0,0,0)"]]);
    }
  }
}

/** quote, punti e anelli a terra disegnati sopra la scena (2D), per lo schermo e per le immagini HD */
function paintHud(ctx: CanvasRenderingContext2D, model: Model, VP: Float32Array, W: number, H: number, dpr: number, L: Record<Layer, boolean>, time: number, style: SagomaStyle = 0) {
  const ink = INK[style];
  const proj = (p: V3): [number, number, number] => {
    const x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12];
    const y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13];
    const w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
    return [((x / w) * 0.5 + 0.5) * W, (1 - ((y / w) * 0.5 + 0.5)) * H, w];
  };
  const hudD = model.hud;
  ctx.lineWidth = 0.55 * dpr;
  if (L.punti && model.J) drawJoints(ctx, model.J, proj, dpr, ink);
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
    ctx.strokeStyle = ink.gold;
    ctx.lineWidth = 0.75 * dpr;
    ctx.beginPath();
    ctx.arc(o[0], o[1], 8.5 * dpr, Math.min(a1, a2), Math.max(a1, a2));
    ctx.stroke();
  }
  // quota dell'allungo
  for (const d of hudD.dims) {
    const a = proj(d.a);
    const b = proj(d.b);
    const nx = -(b[1] - a[1]);
    const ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1;
    const off = 10 * dpr;
    const ox = (nx / nl) * off * (ny / nl > 0 ? -1 : 1);
    const oy = (ny / nl) * off * (ny / nl > 0 ? -1 : 1);
    ctx.strokeStyle = ink.gold;
    ctx.lineWidth = 0.55 * dpr;
    ctx.setLineDash([2.4 * dpr, 2.4 * dpr]);
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
  const gap = 2.5 * dpr;
  const th = TAG_H * dpr;
  const items = [...hudD.labels, ...hudD.dims.map((d) => ({ at: v3.lerp(d.a, d.b, 0.55), text: d.text, tone: "gold" as const }))]
    .map((l) => {
      const p = proj(l.at);
      const tw = ctx.measureText(l.text).width + 8 * dpr;
      let side = p[0] < mid ? -1 : 1;
      // dal lato scelto non c'è posto: l'etichetta va dall'altra parte
      if (side < 0 && p[0] - LEAD * dpr - tw < 4 * dpr) side = 1;
      else if (side > 0 && p[0] + LEAD * dpr + tw > W - 4 * dpr) side = -1;
      return { ...l, p, tw, side };
    })
    .filter((it) => it.p[2] > 0 && it.p[0] >= 0 && it.p[0] <= W && it.p[1] >= 0 && it.p[1] <= H2)
    .sort((a, b) => a.p[1] - b.p[1]);
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const it of items) {
    // la casella resta dentro il riquadro: la linea guida arriva al suo bordo
    const tx = it.side < 0 ? Math.max(4 * dpr + it.tw, it.p[0] - LEAD * dpr) : Math.min(W - 4 * dpr - it.tw, it.p[0] + LEAD * dpr);
    const x0 = it.side < 0 ? tx - it.tw : tx;
    const x1 = x0 + it.tw;
    let ty = it.p[1] - 9 * dpr;
    for (let guard = 0; guard < 40; guard++) {
      const hit = placed.find((b) => x0 < b.x1 + gap && x1 > b.x0 - gap && ty - th / 2 < b.y1 + gap && ty + th / 2 > b.y0 - gap);
      if (!hit) break;
      ty = hit.y1 + gap + th / 2;
    }
    placed.push({ x0, x1, y0: ty - th / 2, y1: ty + th / 2 });
    ctx.strokeStyle = it.tone === "warn" ? ink.warn : it.tone === "gold" ? ink.gold : ink.cyan;
    ctx.lineWidth = 0.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(it.p[0], it.p[1]);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(it.p[0], it.p[1], 1.1 * dpr, 0, Math.PI * 2);
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
function drawJoints(ctx: CanvasRenderingContext2D, J: Record<number, V3>, proj: (p: V3) => [number, number, number], dpr: number, ink: { line: string; hand: string; dot: string }) {
  // come lo scheletro sopra il video: linee bianche, sottili e trasparenti, per vedere il corpo sotto
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
  for (const [a, b] of BODY_LINKS) line(a, b, ink.line, 0.7);
  for (const base of [33, 54]) {
    if (!J[base]) continue;
    for (const [a, b] of HAND_LINKS) line(base + a, base + b, ink.hand, 0.4);
  }
  const dot = (i: number, r: number) => {
    const p = P[i];
    if (!p || p[2] <= 0) return;
    ctx.fillStyle = ink.dot;
    ctx.beginPath();
    ctx.arc(p[0], p[1], r * dpr, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const i of [0, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]) dot(i, i >= 15 && i <= 22 ? 0.8 : 1.1);
  for (const base of [33, 54]) if (J[base]) for (let k = 1; k < 21; k++) dot(base + k, 0.5);
}

/** etichetta con fondo scuro e bordo del colore della misura: piccola, per lasciare vedere il corpo */
const TAG_FONT = (dpr: number) => `500 ${7.6 * dpr}px system-ui, sans-serif`;
/** altezza delle etichette e lunghezza della linea guida (in punti dello schermo) */
const TAG_H = 11;
const LEAD = 38;

/** etichetta piccola: fondo scuro arrotondato, una sola tacca del colore della misura sul lato della linea guida */
function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tone: "cyan" | "gold" | "warn", dpr: number, center: boolean, side = 1) {
  ctx.font = TAG_FONT(dpr);
  const w = ctx.measureText(text).width + 8 * dpr;
  const h = TAG_H * dpr;
  const W = ctx.canvas.width;
  const bx = Math.max(4 * dpr, Math.min(W - w - 4 * dpr, center ? x - w / 2 : side < 0 ? x - w : x));
  const by = y - h / 2;
  const r = 2.5 * dpr;
  ctx.fillStyle = "rgba(3,16,26,0.62)";
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + w, by, bx + w, by + h, r);
  ctx.arcTo(bx + w, by + h, bx, by + h, r);
  ctx.arcTo(bx, by + h, bx, by, r);
  ctx.arcTo(bx, by, bx + w, by, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = tone === "warn" ? "#ffa06e" : tone === "gold" ? "#ffd678" : "#5fd4ff";
  const ax = center ? bx + r : side < 0 ? bx + w - 1.5 * dpr : bx;
  ctx.fillRect(ax, by + 2.5 * dpr, 1.5 * dpr, h - 5 * dpr);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, bx + 4 * dpr, y + 0.5 * dpr);
}

// icone del lettore disegnate a linee: i caratteri ▶ ⏸ su Android diventano emoji colorate
/**
 * La visuale spiegata: nel tiro istintivo si guarda l'oro (il corpo dà alla freccia l'angolo); mirando con
 * la punta (gap) si mette la punta della freccia sul suo punto, sotto o sopra l'oro. L'asta intanto punta
 * più in alto: la freccia sale e poi scende sull'oro.
 */
function AimPanel({ info, mode, onMode, known, summary, full }: { info: AimInfo | null; mode: AimMode; onMode: (m: AimMode) => void; known: boolean; summary: string; full: boolean }) {
  const f = (n: number, d = 1) => n.toFixed(d).replace(".", ",").replace("-", "−");
  const pos = full ? "bottom-[calc(max(1rem,env(safe-area-inset-bottom))+6.2rem)]" : "bottom-14";
  if (!info)
    return <p className={cx("pointer-events-none absolute inset-x-2 mx-auto w-fit rounded-xl bg-black/55 px-3 py-1.5 text-center text-[0.72rem] text-white backdrop-blur", pos)}>Scegli un fotogramma con la freccia sulla corda: da lì si guarda il paglione.</p>;
  const gap = Math.round(info.gapCm);
  const where = (v: number) => `${Math.abs(Math.round(v))} cm ${v < 0 ? "sotto" : "sopra"} l'oro`;
  return (
    <div className={cx("absolute left-2 max-w-[18.5rem] rounded-xl bg-black/55 px-3 py-2 text-[0.7rem] leading-snug text-white backdrop-blur", pos)}>
      <div className="mb-1.5 flex gap-1" role="group" aria-label="Come si mira">
        {([["istintivo", "Tiro istintivo"], ["punta", "Con la punta"]] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={mode === k} onClick={() => onMode(k)} className={cx("min-h-8 rounded-full px-2.5 text-[0.7rem] font-semibold", mode === k ? "bg-white text-[#14181c]" : "bg-white/12 text-white/85")}>
            {l}
          </button>
        ))}
      </div>
      <p className="font-semibold">Paglione a {info.distanceM} m, visuale da {info.faceCm} cm</p>
      {mode === "istintivo" ? (
        <>
          <p>Guardi il centro del bersaglio, non la freccia. Il corpo dà alla freccia l'angolo che serve ({f(info.thetaDeg)}° sull'orizzonte).</p>
          <p className="text-white/75">La punta resta di lato nel campo visivo: qui cade {Math.abs(gap) < 1 ? "sull'oro" : where(gap)}.</p>
        </>
      ) : (
        <>
          <p>{Math.abs(gap) < 1 ? "La punta della freccia va sull'oro." : `Metti la punta della freccia ${where(gap)}: è il «gap» di questa distanza.`}</p>
          <p className="text-white/75">Il gap cambia con la distanza: si impara a ogni distanza, con lo stesso ancoraggio.</p>
        </>
      )}
      <p className="text-white/75">L'asta punta {where(info.shaftCm)}: la freccia sale e poi scende sull'oro ({f(info.v0, 0)} m/s, {f(info.tof, 2)} s).</p>
      <p className="text-white/60">{known ? summary : "Valori tipici: inserisci arco e frecce nell'attrezzatura principale per la tua balistica"}</p>
    </div>
  );
}

function TrIcon({ k }: { k: "play" | "pause" | "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden>
      {k === "play" ? <path d="M8 5.5v13l10.5-6.5z" /> : null}
      {k === "pause" ? <path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" /> : null}
      {k === "prev" ? <path d="M6 5h2v14H6zM19 5.5v13L9.5 12z" /> : null}
      {k === "next" ? <path d="M16 5h2v14h-2zM5 5.5v13L14.5 12z" /> : null}
    </svg>
  );
}
