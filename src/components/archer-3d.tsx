import type { AvatarLook } from "@/lib/arcieri/avatar";
import { basis, GL3D, segment, trs, v3, type Vec3 } from "@/lib/arcieri/gl3d";
import { bodyRes, drawRealBody, loadBodyAsset, solveBody } from "@/lib/arcieri/body-mesh";
import { AvatarFace } from "./archer-avatar";
import { drawArcher, drawBody, phaseAt, poseAt, realistic, ROUTINE_END, ROUTINE_START, type Joints } from "@/lib/arcieri/mannequin";
import { drawArrow3D, drawBoss, drawTrees, drawWorld } from "@/lib/arcieri/scene3d";
import { drawSkyOverlay, envOf, TODS, useSky, WEATHERS } from "@/lib/arcieri/sky3d";
import { useEffect, useState, type ReactNode } from "react";
import { orbit } from "./foc-3d";
import { GLStage, useGLScene } from "./gl-stage";

/**
 * L'avatar in 3D sulla linea di tiro: esegue la sequenza completa (posizione, incocco, aggancio,
 * pre-trazione, trazione, ancoraggio, mira, rilascio, accompagnamento), in ciclo. Cielo, luce e
 * meteo seguono l'ora scelta; la camera gira con le dita; il paglione riceve la freccia.
 */
export function Archer3D({ look, height = "h-80", still, framing = "posa", children, fallback = null, phase = true }: { look: AvatarLook; height?: string; still?: "riposo" | "allungo"; framing?: "posa" | "home"; children?: ReactNode; fallback?: ReactNode; phase?: boolean }) {
  const { sky } = useSky();
  const { ref, glRef, view, failed } = useGLScene((g, o, w, h, time, v) => {
    const D = framing === "home" ? 18 : 12;
    const cycle = ROUTINE_END - ROUTINE_START + 0.8;
    const tt = still === "allungo" ? -0.5 : still === "riposo" ? -7 : (time % cycle) + ROUTINE_START - 0.4;
    const T = 0.3 * (D / 12);
    const cam = framing === "home" ? orbit([-2.7, 1.5, 1.5], [0.05, 1.12, -0.25], v) : orbit([-2.9, 1.65, -0.9], [0, 1.15, 0.3], v);
    g.begin(cam.eye as Vec3, cam.target as Vec3, framing === "home" ? 46 : 42, envOf(sky));
    drawWorld(g, [0, 0, 6], 300, sky, time);
    drawTrees(g, D + 10, 3);
    g.draw("box", trs([0, 0.006, 0], 0, [3, 0.006, 0.06]), [1, 1, 1], { unlit: true, alpha: 0.9 });
    drawBoss(g, 0, 1.3, D, 0.4, 1, 10);
    const arrow = { shaft: look.shaft, fletch: look.fletch, cock: look.cock, nock: look.nock, wood: look.shaft === "#c99a5e" || look.bowType === "longbow" || look.style === "medievale" };
    drawArcher(g, [0.05, 0, -0.6], [0, 0, 1], 1, poseAt(tt), look, arrow, 0.75);
    if (tt >= 0 && tt < T) {
      const f = tt / T;
      const a: Vec3 = [0, 1.45, 0.1];
      const b: Vec3 = [0, 1.3, D + 0.05];
      const tip = v3.lerp(a, b, f);
      drawArrow3D(g, v3.sub(tip, [0, 0, 0.75]), [0, 0, 1], 0.75, time * 20, 0.0045, arrow);
    } else if (tt >= T) {
      drawArrow3D(g, [0.04, 1.33, D - 0.68], v3.norm([0, -0.02, 1]), 0.75, 0.4, 0.0045, arrow);
    }
    drawSkyOverlay(o, g, sky, w, h, time);
    if (!still && phase) {
      o.font = "700 12px system-ui, sans-serif";
      o.textAlign = "left";
      o.lineWidth = 3;
      o.strokeStyle = "rgba(8,14,12,0.6)";
      const y = framing === "home" ? h - 64 : 22;
      o.strokeText(phaseAt(tt), 12, y);
      o.fillStyle = "#fff";
      o.fillText(phaseAt(tt), 12, y);
    }
  });
  if (failed) return <>{fallback}</>;
  return (
    <GLStage glRef={glRef} overlayRef={ref} view={view} className={`w-full ${height}`} label="Il tuo arciere in 3D" hint={false} touch={framing === "home" ? "pan-y" : "none"}>
      {children}
    </GLStage>
  );
}

/** Scelta di ora e meteo, piccola, sopra le scene 3D. */
export function SkyPicker({ className = "" }: { className?: string }) {
  const { pref, setPref } = useSky();
  const tods = [{ id: "auto", label: "Ora attuale" }, ...TODS] as const;
  const ti = tods.findIndex((t) => t.id === pref.tod);
  const wi = WEATHERS.findIndex((x) => x.id === pref.weather);
  const nextTod = tods[(ti + 1) % tods.length];
  const nextW = WEATHERS[(wi + 1) % WEATHERS.length];
  const todIcon = <SkyIcon kind={pref.tod === "auto" ? "auto" : pref.tod} />;
  const wIcon = <SkyIcon kind={pref.weather} />;
  return (
    <div className={`flex gap-1.5 ${className}`}>
      <button type="button" onClick={() => setPref({ ...pref, tod: nextTod.id })} className="flex min-h-9 items-center gap-1 rounded-full bg-black/45 px-2.5 text-[0.7rem] font-semibold text-white backdrop-blur" aria-label={`Ora del cielo: ${tods[Math.max(0, ti)].label}. Tocca per ${nextTod.label}`}>
        <span aria-hidden>{todIcon}</span>
        {tods[Math.max(0, ti)].label}
      </button>
      <button type="button" onClick={() => setPref({ ...pref, weather: nextW.id })} className="flex min-h-9 items-center gap-1 rounded-full bg-black/45 px-2.5 text-[0.7rem] font-semibold text-white backdrop-blur" aria-label={`Meteo: ${WEATHERS[Math.max(0, wi)].label}. Tocca per ${nextW.label}`}>
        <span aria-hidden>{wIcon}</span>
        {WEATHERS[Math.max(0, wi)].label}
      </button>
    </div>
  );
}

type Lm = { x: number; y: number; z?: number; visibility?: number };

/** Articolazioni 3D da 33 punti della posa (MediaPipe): piedi a terra, altezza ~1,75 m. */
export function jointsFromLandmarks(lm: Lm[], aspect: number, hand: "destro" | "mancino"): { J: Joints; k: number } | null {
  if (!lm || lm.length < 29) return null;
  const P = (i: number) => lm[i];
  const ankY = Math.max(P(27).y, P(28).y);
  const headY = Math.min(P(0).y, P(7).y, P(8).y) - 0.035;
  const hImg = Math.max(0.05, ankY - headY);
  const sc = 1.7 / hImg;
  const cx = (P(23).x + P(24).x) / 2;
  const cz = ((P(23).z ?? 0) + (P(24).z ?? 0)) / 2;
  const W = (i: number, dy = 0): Vec3 => [(P(i).x - cx) * aspect * sc, (ankY - P(i).y) * sc + 0.08 + dy, -((P(i).z ?? cz) - cz) * aspect * sc * 0.8];
  const mid = (a: Vec3, b: Vec3, t = 0.5) => v3.lerp(a, b, t);
  // per il mancino la mano dell'arco è la destra: scambio i lati così parabraccio e guantino stanno giusti
  const sw = hand === "mancino";
  const side = (a: number, b: number) => (sw ? b : a);
  const sideR = (a: number, b: number) => (sw ? a : b);
  const lSh = W(side(11, 12));
  const rSh = W(sideR(11, 12));
  const lHip = W(side(23, 24));
  const rHip = W(sideR(23, 24));
  const shM = mid(lSh, rSh);
  const hipM = mid(lHip, rHip);
  const nose = W(0);
  const earM = mid(W(7), W(8));
  const head = v3.add(earM, [0, 0.03, 0]);
  const faceRaw = v3.sub(nose, earM);
  const front = v3.norm(v3.cross(v3.sub(lSh, rSh), [0, 1, 0]));
  const face: Vec3 = v3.len([faceRaw[0], 0, faceRaw[2]]) > 0.04 ? v3.add(v3.scale(v3.norm([faceRaw[0], 0, faceRaw[2]]), 0.7), v3.scale(front, 0.3)) : front;
  const J: Joints = {
    head,
    neck: v3.lerp(shM, head, 0.35),
    chest: v3.lerp(hipM, shM, 0.62),
    pelvis: v3.lerp(hipM, shM, 0.08),
    lSh,
    rSh,
    lEl: W(side(13, 14)),
    rEl: W(sideR(13, 14)),
    lHand: W(side(15, 16)),
    rHand: W(sideR(15, 16)),
    lHip,
    rHip,
    lKnee: W(side(25, 26)),
    rKnee: W(sideR(25, 26)),
    lFoot: W(side(27, 28)),
    rFoot: W(sideR(27, 28)),
    face,
  };
  return { J, k: 1 };
}

/**
 * Sagoma 3D dall'analisi del gesto: il corpo dell'avatar messo nella posa rilevata, da girare con
 * le dita. La profondità arriva dalla stima della fotocamera ed è approssimata.
 */
export function Body3D({ lmRef, aspect, hand, look, height = "h-72" }: { lmRef: { current: Lm[] | null }; aspect: number; hand: "destro" | "mancino"; look: AvatarLook; height?: string }) {
  const { ref, glRef, view, failed } = useGLScene((g, o, w, _h, _t, v) => {
    const cam = orbit([0.9, 1.45, 3.6], [0, 1.0, 0], v);
    g.begin(cam.eye as Vec3, cam.target as Vec3, 40);
    drawWorld(g, [0, 0, 0], 120);
    g.draw("disc", basis([0, 0.004, 0], [1.1, 0, 0], [0, 0, 1.1], [0, -1, 0]), [0.1, 0.3, 0.2], { alpha: 0.35, unlit: true });
    const res = lmRef.current ? jointsFromLandmarks(lmRef.current, aspect, hand) : null;
    if (!res) {
      o.font = "600 12px system-ui, sans-serif";
      o.fillStyle = "#fff";
      o.textAlign = "center";
      o.fillText("In attesa della posa…", w / 2, 24);
      return;
    }
    drawBody(g, res.J, res.k, look);
    // linea delle spalle e asse della freccia ideale verso il bersaglio
    const sh = res.J;
    g.draw("tube", segment(sh.rSh, v3.add(sh.lSh, v3.scale(v3.norm(v3.sub(sh.lSh, sh.rSh)), 0.6)), 0.006), [0.49, 0.94, 0.66], { unlit: true, alpha: 0.85 });
    g.draw("tube", segment(sh.rHand, sh.lHand, 0.005), [1, 0.9, 0.55], { unlit: true, alpha: 0.9 });
    o.font = "600 11px system-ui, sans-serif";
    o.textAlign = "left";
    o.fillStyle = "rgba(255,255,255,0.92)";
    o.fillText("Verde: linea delle spalle · giallo: mano–mano", 10, 18);
  });
  if (failed) return null;
  return <GLStage glRef={glRef} overlayRef={ref} view={view} className={`w-full ${height}`} label="Sagoma 3D della posa rilevata" />;
}

/** Iconcine del cielo disegnate (sole, alba, tramonto, luna, nuvola, pioggia). */
function SkyIcon({ kind }: { kind: string }) {
  const sun = (cx: number, cy: number, r: number, col = "#ffd166") => (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={col} />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <path key={i} d={`M${cx + Math.cos(a) * (r + 1.5)} ${cy + Math.sin(a) * (r + 1.5)} L${cx + Math.cos(a) * (r + 3.5)} ${cy + Math.sin(a) * (r + 3.5)}`} stroke={col} strokeWidth={1.4} strokeLinecap="round" />;
      })}
    </g>
  );
  const cloud = (col = "#e8eef5") => <path d="M6 17 h11 a3.5 3.5 0 0 0 0-7 a5 5 0 0 0-9.5 1.2 A3 3 0 0 0 6 17z" fill={col} />;
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden>
      {kind === "pomeriggio" ? sun(12, 12, 4.5) : null}
      {kind === "mattina" ? <>{sun(12, 15, 4, "#ffc078")}<path d="M3 19 H21" stroke="#9ad1ff" strokeWidth={1.6} strokeLinecap="round" /></> : null}
      {kind === "tramonto" ? <><circle cx={12} cy={16} r={5} fill="#ff8a4c" /><path d="M2 16 H22" stroke="#ffd0a8" strokeWidth={1.6} /><rect x={2} y={16.8} width={20} height={6} fill="#1f2a3a" /></> : null}
      {kind === "notte" ? <><path d="M15 3 a8 8 0 1 0 6 13 a6.5 6.5 0 0 1-6-13z" fill="#e6ecff" /><circle cx={6} cy={6} r={0.9} fill="#fff" /><circle cx={9} cy={3.5} r={0.6} fill="#fff" /></> : null}
      {kind === "auto" ? <><circle cx={12} cy={12} r={8} fill="none" stroke="#fff" strokeWidth={1.6} /><path d="M12 7 V12 L15.5 14" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" fill="none" /></> : null}
      {kind === "sereno" ? <>{sun(9, 9, 3.4)}{cloud()}</> : null}
      {kind === "nuvoloso" ? <>{cloud("#c9d3dd")}<path d="M4 12 h7 a3 3 0 0 0-1.5-5.5 a4 4 0 0 0-6 2.5" fill="#9aa8b6" /></> : null}
      {kind === "pioggia" ? <>{cloud("#9aa8b6")}<path d="M8 19 l-1.2 3 M12 19 l-1.2 3 M16 19 l-1.2 3" stroke="#7cc4ff" strokeWidth={1.6} strokeLinecap="round" /></> : null}
    </svg>
  );
}

const portraits = new Map<string, string>();
let portraitGL: GL3D | null = null;

/** Ritratto del viso dal corpo 3D realistico, fatto una volta e tenuto in memoria. */
function renderPortrait(look: AvatarLook): Promise<string | null> {
  const key = JSON.stringify([look.skin, look.shirt, look.hat, look.hatColor, look.hair, look.hairColor, look.body]);
  const hit = portraits.get(key) ?? (typeof localStorage !== "undefined" ? localStorage.getItem(`aa-face-${key}`) : null);
  if (hit) {
    portraits.set(key, hit);
    return Promise.resolve(hit);
  }
  return loadBodyAsset()
    .then(async () => {
      if (!portraitGL) {
        const c = document.createElement("canvas");
        c.width = 192;
        c.height = 192;
        portraitGL = new GL3D(c);
      }
      const g = portraitGL;
      const res = bodyRes(g);
      for (let i = 0; i < 80 && !res.ready && !res.failed; i += 1) await new Promise((r) => setTimeout(r, 50));
      if (!res.ready || !res.asset) return null;
      const s = look.body === "ragazzo" ? 0.82 : 1;
      const head: Vec3 = [0, 1.62 * s, 0];
      const F: Vec3 = [-1, 0, 0];
      const L: Vec3 = [0, 0, 1];
      g.begin(v3.add(head, [-0.55 * s, 0.03, 0.16 * s]), v3.add(head, [0, -0.02, 0]), 30, { ...envOf({ tod: "pomeriggio", weather: "sereno" }), sun: v3.norm([-0.7, 0.6, 0.4]) }, [0.16, 0.24, 0.2]);
      const bones = new Float32Array(256);
      solveBody(res.asset.header, { origin: [0, 0, 0], F, L, s, lHand: [0.15 * s, 0.9 * s, 0.25 * s], rHand: [0.1 * s, 0.9 * s, -0.25 * s], lPole: [1, -0.5, 0], rPole: [1, -0.5, 0], face: [-1, 0, 0.15] }, bones);
      drawRealBody(g, res, bones, look);
      g.gl.finish();
      const url = g.canvas.toDataURL("image/jpeg", 0.88);
      portraits.set(key, url);
      try {
        localStorage.setItem(`aa-face-${key}`, url);
      } catch {
        /* memoria piena */
      }
      return url;
    })
    .catch(() => null);
}

/** Volto dell'avatar: ritratto realistico quando il corpo 3D è disponibile, altrimenti il disegno. */
export function RealFace({ look, className = "h-10 w-10" }: { look: AvatarLook; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const use = realistic(look);
  useEffect(() => {
    if (!use) return;
    let live = true;
    renderPortrait(look).then((u) => {
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [use, look]);
  if (use && url) return <img src={url} alt="" className={`${className} rounded-full object-cover`} />;
  return <AvatarFace look={look} className={className} />;
}
