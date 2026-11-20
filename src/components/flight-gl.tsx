import { useRef, useState } from "react";
import { describeRound, goldOf, releasePoint, type FlightInput } from "@/lib/arcieri/flight";
import { project, segment, v3, type Vec3 } from "@/lib/arcieri/gl3d";
import { drawArcher, phaseAt, poseAt, ROUTINE_END, ROUTINE_START } from "@/lib/arcieri/mannequin";
import { drawArrow3D, drawBoss, drawLane, drawTrees, drawWorld } from "@/lib/arcieri/scene3d";
import { useAvatar } from "./avatar-hero";
import { orbit, type Arrow3DLook } from "./foc-3d";
import { Flight3DCanvas, PRESETS, type Preset } from "./flight-3d";
import { GLStage, useGLScene } from "./gl-stage";
import { SkyPicker } from "./archer-3d";
import { drawSkyOverlay, envOf, useSky } from "@/lib/arcieri/sky3d";

type RoundView = ReturnType<typeof describeRound>;

/**
 * Il tiro in 3D con WebGL: campo con cielo, colline e alberi, paglione con la visuale, l'arciere
 * (il tuo avatar) che alza, tende, mira e rilascia, la freccia che vola nel tempo reale e si pianta.
 * Le altezze degli oggetti sono ingrandite sulle distanze lunghe e la curva è esagerata a parte
 * (scritto in alto). Se WebGL non c'è, resta la versione disegnata in 2D.
 */
export function Flight3D({ input, round, sighted, look = {}, height = "h-72" }: { input: FlightInput; round: RoundView; sighted: boolean; look?: Arrow3DLook; height?: string }) {
  const [preset, setPreset] = useState<Preset>("panoramica");
  const presetRef = useRef<Preset>(preset);
  presetRef.current = preset;
  const { shown } = useAvatar();
  const { sky } = useSky();

  const { ref, glRef, view, failed } = useGLScene((g, o, w, h, time, v) => {
    const D = input.distanceM;
    const G = goldOf(input);
    const R = input.faceCm / 200;
    const big = Math.max(1, D / 22);
    const T = Math.max(0.05, round.clean.t);
    const rawPath = round.clean.path;
    const every = Math.max(1, Math.ceil(rawPath.length / 90));
    const path = rawPath.filter((_, i) => i % every === 0 || i === rawPath.length - 1);
    const rel = releasePoint(input);
    const end = path[path.length - 1] ?? { x: D, z: G };
    const lineZ = (x: number) => rel.z + ((end.z - rel.z) * x) / D;
    const maxDev = path.reduce((m, p) => Math.max(m, Math.abs(p.z - lineZ(p.x))), 0.001);
    const ex = Math.max(1, Math.min(6, (D * 0.045) / (big * maxDev)));
    const lat = (x: number) => round.clean.y * (x / D) ** 2;
    const W3 = (x: number, z: number, y = lat(x)): Vec3 => [y * big, big * (lineZ(x) + ex * (z - lineZ(x))), x];
    const lead = round.lead ?? 0;
    const cycle = T + ROUTINE_END - ROUTINE_START + 0.6;
    const tt = (time % cycle) + ROUTINE_START - 0.3;
    const flying = tt >= 0 && tt < T;
    const landed = tt >= T;
    const shift = lead && tt < T ? -lead * (1 - Math.max(0, tt) / T) : 0;

    const gH = G * big;
    const p = presetRef.current;
    let eye: Vec3;
    let tgt: Vec3;
    if (p === "arciere") {
      eye = [-1.3 * big, 2.0 * big, -2.6 * big];
      tgt = [0, gH * 0.9, D * 0.6];
    } else if (p === "bersaglio") {
      eye = [-1.6 * big, gH + 0.5 * big, D - 3.6 * big];
      tgt = [0, gH, D];
    } else if (p === "alto") {
      eye = [-(D * 0.12 + 2), D * 0.75 + 4, D * 0.5];
      tgt = [0, 0, D * 0.5];
    } else if (h > w * 1.1) {
      // telefono in verticale: si arretra e si alza un po', l'arciere in primo piano e il paglione in fondo
      eye = [-(D * 0.1 + 2.6) * Math.max(1, big * 0.8), 1.9 * big + D * 0.06, -(4.2 * big + D * 0.12)];
      tgt = [0.2 * big, gH * 0.75, D * 0.42];
    } else {
      eye = [-(D * 0.3 + 4), 2.2 + D * 0.05, -(3 + D * 0.15)];
      tgt = [0, gH * 0.7, D * 0.32];
    }
    const cam = orbit(eye, tgt, v);
    const portrait = h > w * 1.1;
    g.begin(cam.eye as Vec3, cam.target as Vec3, (p === "bersaglio" ? 44 : 50) + (portrait ? 12 : 0), envOf(sky));
    const P2 = (q: Vec3) => project(g.vp, q, w, h);

    drawWorld(g, [0, 0, D / 2], 900, sky, time);
    drawTrees(g, D, Math.round(D));
    const step = D > 40 ? 10 : 5;
    drawLane(g, D, big, step);
    const cx = shift * big;
    drawBoss(g, cx, gH, D, R * big, big, input.zones === 5 ? 5 : 10);

    // arciere: il rilascio coincide con la partenza della freccia
    const pose = poseAt(tt);
    const s = (input.heightCm / 175) * big;
    drawArcher(g, [0.05 * big, 0, -0.62 * s], [0, 0, 1], s, pose, shown, look, 0.75);

    // traiettoria: tratteggio intero e scia fin dove è arrivata
    const pts = path.map((q) => W3(q.x, q.z));
    for (let i = 0; i < pts.length - 1; i += 2) g.draw("tube", segment(pts[i], pts[i + 1], 0.006 * big), [1, 1, 1], { alpha: 0.45, unlit: true });
    const u = flying ? tt / T : landed ? 1 : 0;
    const n = Math.max(1, Math.min(pts.length - 1, Math.floor(u * (pts.length - 1))));
    if (u > 0) {
      for (let i = 0; i < n; i += 1) g.draw("tube", segment(pts[i], pts[i + 1], 0.013 * big), [1, 0.92, 0.6], { unlit: true, alpha: 0.9 });
    }

    // frecce del gruppo piantate; le mancate seguono la discesa e finiscono nel prato dietro
    const slopeEnd = (() => {
      const b = rawPath[rawPath.length - 1];
      const a = rawPath[Math.max(0, rawPath.length - 5)];
      const sl = a && b && b.x - a.x > 0.05 ? (b.z - a.z) / (b.x - a.x) : -0.05;
      return Math.max(-0.6, Math.min(0.6, sl));
    })();
    const arrowLen = 0.75 * big;
    const ar = 0.0065 * big;
    round.hits.forEach((hit, i) => {
      if (!landed || tt - T < 0.15 + i * 0.12) return;
      if (hit.miss) {
        const sl = Math.min(-0.04, slopeEnd);
        const run = Math.min(25, hit.z / -sl);
        const tip: Vec3 = [hit.y * big * (1 + run / D), 0.02, D + 0.32 * big + run];
        const dir = v3.norm([0, sl * big, 1]);
        drawArrow3D(g, v3.sub(tip, v3.scale(dir, arrowLen * 0.75)), dir, arrowLen * 0.75, i, ar, look);
        return;
      }
      const tip: Vec3 = [hit.y * big, hit.z * big, D + 0.06 * big];
      const dir = v3.norm([0.03 * Math.sin(i * 3.1), slopeEnd * big * 0.6, 1]);
      drawArrow3D(g, v3.sub(tip, v3.scale(dir, arrowLen * 0.8)), dir, arrowLen * 0.8, i * 0.7, ar, look);
    });

    // freccia in volo, con la sua ombra sul prato
    let flyTip: Vec3 | null = null;
    if (flying) {
      const fi = u * (pts.length - 1);
      const i0 = Math.floor(fi);
      const i1 = Math.min(pts.length - 1, i0 + 1);
      const f = fi - i0;
      const tip = v3.lerp(pts[i0], pts[i1], f);
      const prev = pts[Math.max(0, i0 - 1)];
      const dir = v3.norm(v3.sub(pts[i1], prev));
      drawArrow3D(g, v3.sub(tip, v3.scale(dir, arrowLen)), dir, arrowLen, time * 18 + v.spin, ar * 1.1, look);
      g.shadow([tip[0], 0, tip[2] - arrowLen / 2], 0.05 * big, arrowLen * 0.5, 0.25);
      flyTip = tip;
    }

    drawSkyOverlay(o, g, sky, w, h, time);
    // ── scritte ──
    o.font = "10px system-ui, sans-serif";
    o.textAlign = "left";
    for (let z = step; z <= D + 0.01; z += step) {
      const q = P2([-3 * big, 0.02, z]);
      if (!q || q.x < -20 || q.x > w + 20) continue;
      label(o, `${z} m`, q.x + 4, q.y + 3, "rgba(255,255,255,0.85)");
    }
    if (Math.abs(lead) > 0.005) {
      o.setLineDash([4, 4]);
      o.strokeStyle = "rgba(255,255,255,0.7)";
      o.lineWidth = 1.2;
      o.beginPath();
      for (let i = 0; i <= 48; i += 1) {
        const a = (i / 48) * Math.PI * 2;
        const q = P2([-lead * big + Math.cos(a) * R * big, gH + Math.sin(a) * R * big, D - 0.02]);
        if (q) (i ? o.lineTo(q.x, q.y) : o.moveTo(q.x, q.y));
      }
      o.stroke();
      o.setLineDash([]);
      const q = P2([-lead * big, gH - R * big - 0.15 * big, D]);
      if (q) {
        o.textAlign = "center";
        label(o, `al rilascio · anticipo ${Math.abs(lead * 100).toFixed(0)} cm`, q.x, q.y + 12, "#fff", "600 10px system-ui, sans-serif");
      }
    }
    // mira giusta
    const gap = sighted ? 0 : round.gap;
    const fm = P2([-round.my * big, (G + gap - (round.mz - G)) * big, D - 0.02]);
    if (fm) {
      const rr = Math.max(6, (0.06 * big * h) / Math.max(0.1, fm.depth) * 0.9);
      o.strokeStyle = "#7cf0a8";
      o.lineWidth = 2;
      o.beginPath();
      o.arc(fm.x, fm.y, rr, 0, Math.PI * 2);
      o.moveTo(fm.x - rr - 6, fm.y);
      o.lineTo(fm.x - 3, fm.y);
      o.moveTo(fm.x + 3, fm.y);
      o.lineTo(fm.x + rr + 6, fm.y);
      o.moveTo(fm.x, fm.y - rr - 6);
      o.lineTo(fm.x, fm.y - 3);
      o.moveTo(fm.x, fm.y + 3);
      o.lineTo(fm.x, fm.y + rr + 6);
      o.stroke();
      o.textAlign = "left";
      label(o, "MIRA QUI", fm.x + rr + 8, fm.y - rr, "#7cf0a8", "800 10px system-ui, sans-serif");
    }
    const top = rawPath.reduce((b, q) => (q.z > b.z ? q : b), rawPath[0] ?? { x: 0, z: 0 });
    const tp = P2(W3(top.x, top.z));
    if (tp) {
      o.fillStyle = "#e6b325";
      o.beginPath();
      o.arc(tp.x, tp.y, 3, 0, Math.PI * 2);
      o.fill();
      o.textAlign = "center";
      label(o, `culmine ${top.z.toFixed(2).replace(".", ",")} m`, tp.x, tp.y - 8, "#ffe39a", "600 10px system-ui, sans-serif");
    }
    if (landed && tt - T < 0.6) {
      const q = P2(W3(end.x, end.z));
      if (q) {
        const k = (tt - T) / 0.6;
        o.strokeStyle = `rgba(255,241,176,${1 - k})`;
        o.lineWidth = 2;
        o.beginPath();
        o.arc(q.x, q.y, 6 + k * 26, 0, Math.PI * 2);
        o.stroke();
      }
    }
    if (flyTip && p !== "bersaglio") {
      const q = P2(flyTip);
      if (q) {
        o.fillStyle = "rgba(255,241,176,0.35)";
        o.beginPath();
        o.arc(q.x, q.y, 7, 0, Math.PI * 2);
        o.fill();
      }
    }
    const phase = tt < 0 ? phaseAt(tt).toLowerCase() : flying ? "in volo" : "a segno";
    o.textAlign = "left";
    label(o, `${Math.min(T, Math.max(0, tt)).toFixed(2).replace(".", ",")} / ${T.toFixed(2).replace(".", ",")} s · ${round.clean.v0.toFixed(0)} m/s · ${phase}`, 10, 18, "rgba(255,255,255,0.95)", "600 11px system-ui, sans-serif");
    label(o, `${D} m · ${big > 1.05 ? `oggetti ×${big.toFixed(1).replace(".", ",")} · ` : ""}curva ×${ex.toFixed(0)}`, 10, 32, "rgba(255,255,255,0.8)");
  });

  if (failed) return <Flight3DCanvas input={input} round={round} sighted={sighted} look={look} height={height} />;
  return (
    <div className="grid gap-1.5">
      <GLStage glRef={glRef} overlayRef={ref} view={view} className={`w-full ${height}`} label="Tiro in 3D: arciere, traiettoria e bersaglio">
        <SkyPicker className="absolute bottom-11 left-2" />
      </GLStage>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={preset === item.id}
            className="aa-chip shrink-0"
            onClick={() => {
              setPreset(item.id);
              const auto = view.current.auto;
              view.current = { yaw: 0, pitch: 0, zoom: 1, px: 0, py: 0, touched: false, auto, spin: 0 };
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function label(o: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, font = "10px system-ui, sans-serif") {
  o.font = font;
  o.lineWidth = 3;
  o.lineJoin = "round";
  o.strokeStyle = "rgba(8,14,12,0.7)";
  o.strokeText(text, x, y);
  o.fillStyle = color;
  o.fillText(text, x, y);
}
