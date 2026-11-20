import type { AvatarLook } from "@/lib/arcieri/avatar";
import { basis, segment, trs, v3, type Vec3 } from "@/lib/arcieri/gl3d";
import { drawArcher, drawBody, poseAt, type Joints } from "@/lib/arcieri/mannequin";
import { drawArrow3D, drawBoss, drawWorld } from "@/lib/arcieri/scene3d";
import { orbit } from "./foc-3d";
import { GLStage, useGLScene } from "./gl-stage";

/**
 * L'avatar in 3D sulla linea di tiro: alza, tende, mira, rilascia e accompagna, in ciclo.
 * La camera gira con le dita; il paglione è a 12 m e riceve la freccia.
 */
export function Archer3D({ look, height = "h-80", still }: { look: AvatarLook; height?: string; still?: "riposo" | "allungo" }) {
  const { ref, glRef, view, failed } = useGLScene((g, _o, _w, _h, time, v) => {
    const D = 12;
    const cycle = 6.4;
    const tt = still === "allungo" ? -0.5 : still === "riposo" ? -3 : (time % cycle) - 3.0;
    const T = 0.28;
    const cam = orbit([-2.9, 1.65, -0.9], [0, 1.15, 0.3], v);
    g.begin(cam.eye as Vec3, cam.target as Vec3, 42);
    drawWorld(g, [0, 0, 6], 300);
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
  });
  if (failed) return null;
  return <GLStage glRef={glRef} overlayRef={ref} view={view} className={`w-full ${height}`} label="Il tuo arciere in 3D" hint={false} />;
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
