import { useRef, useState } from "react";
import { describeRound, goldOf, releasePoint, type FlightInput } from "@/lib/arcieri/flight";
import { camera, drawArrow, norm, orbit, Stage3D, useCanvas, type Arrow3DLook, type V } from "./foc-3d";

type RoundView = ReturnType<typeof describeRound>;
export type Preset = "panoramica" | "arciere" | "bersaglio" | "alto";

export const PRESETS: { id: Preset; label: string }[] = [
  { id: "panoramica", label: "Panoramica" },
  { id: "arciere", label: "Dietro l'arciere" },
  { id: "bersaglio", label: "Al bersaglio" },
  { id: "alto", label: "Dall'alto" },
];

const RINGS = ["#f4f1ea", "#f4f1ea", "#1a1c1e", "#1a1c1e", "#2a6294", "#2a6294", "#c4473d", "#c4473d", "#e6b325", "#e6b325"];

/**
 * Il tiro in 3D, con lo stesso linguaggio del FOC 3D: campo, arciere, parabola vera, paglione con la
 * faccia e le frecce piantate. Il volo dura il tempo reale; le altezze degli oggetti sono ingrandite
 * sulle distanze lunghe (scritto in alto) per vederli, la curva della traiettoria è esagerata a parte.
 */
export function Flight3DCanvas({ input, round, sighted, look = {}, height = "h-72" }: { input: FlightInput; round: RoundView; sighted: boolean; look?: Arrow3DLook; height?: string }) {
  const [preset, setPreset] = useState<Preset>("panoramica");
  const presetRef = useRef<Preset>(preset);
  presetRef.current = preset;
  const { ref, view } = useCanvas(
    (ctx, w, h, time, v) => {
      const D = input.distanceM;
      const G = goldOf(input);
      const R = input.faceCm / 200;
      const big = Math.max(1, D / 22);
      const T = Math.max(0.05, round.clean.t);
      const path = round.clean.path;
      const rel = releasePoint(input);
      const end = path[path.length - 1] ?? { x: D, z: G };
      // esagerazione della curva: scarto dalla retta rilascio→impatto
      const lineZ = (x: number) => rel.z + ((end.z - rel.z) * x) / D;
      const maxDev = path.reduce((m, p) => Math.max(m, Math.abs(p.z - lineZ(p.x))), 0.001);
      const ex = Math.max(1, Math.min(6, (D * 0.045) / (big * maxDev)));
      const lat = (x: number) => round.clean.y * (x / D) ** 2;
      const W3 = (x: number, z: number, y = lat(x)): V => [y * big, big * (lineZ(x) + ex * (z - lineZ(x))), x];
      const faceAt = (y: number, z: number, dz = 0): V => [y * big, z * big, D - dz];
      // movimento del bersaglio: al rilascio era indietro di `lead`, all'impatto è al centro
      const lead = round.lead ?? 0;
      const cycle = T + 3.2;
      const tt = (time % cycle) - 0.35;
      const flying = tt >= 0 && tt < T;
      const landed = tt >= T;
      const shift = lead && tt < T ? -lead * (1 - Math.max(0, tt) / T) : 0;

      // camera
      const gH = G * big;
      const p = presetRef.current;
      let eye: V;
      let tgt: V;
      if (p === "arciere") {
        eye = [0.9 * big, 2.4 * big, -3.2 * big];
        tgt = [0, gH, D * 0.75];
      } else if (p === "bersaglio") {
        eye = [1.6 * big, gH + 0.6 * big, D - 3.4 * big];
        tgt = [0, gH, D];
      } else if (p === "alto") {
        eye = [D * 0.12 + 2, D * 0.75 + 4, D * 0.5];
        tgt = [0, 0, D * 0.5];
      } else {
        eye = [D * 0.78 + 4, 3 + D * 0.22, D * 0.5];
        tgt = [0, gH * 0.8, D * 0.5];
      }
      const cam = orbit(eye, tgt, v);
      const P = camera(cam.eye, cam.target, p === "bersaglio" ? 46 : 54, w, h);

      // cielo, colline lontane e prato
      const horizon = P([0, 0, D * 4]).y;
      const hy = Math.max(-h, Math.min(h * 2, horizon));
      const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, hy));
      sky.addColorStop(0, "#2a4d78");
      sky.addColorStop(1, "#b9cfd9");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, Math.max(0, hy));
      const grass = ctx.createLinearGradient(0, Math.max(0, hy), 0, h);
      grass.addColorStop(0, "#5f7f4a");
      grass.addColorStop(1, "#2e4a26");
      ctx.fillStyle = grass;
      ctx.fillRect(0, Math.max(0, hy), w, h - Math.max(0, hy));
      if (hy > 0 && hy < h) {
        ctx.fillStyle = "rgba(48,74,58,0.85)";
        ctx.beginPath();
        ctx.moveTo(0, hy);
        for (let i = 0; i <= 24; i += 1) {
          const x = (i / 24) * w;
          ctx.lineTo(x, hy - 6 - 10 * Math.abs(Math.sin(i * 1.7)) - 6 * Math.abs(Math.sin(i * 0.6)));
        }
        ctx.lineTo(w, hy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0, hy - 2, w, 2);
      }

      // corsia: linee delle distanze e bordi
      const step = D > 40 ? 10 : 5;
      ctx.lineWidth = 1;
      for (let z = 0; z <= D + 0.01; z += step) {
        const a = P([-3 * big, 0, z]);
        const b = P([3 * big, 0, z]);
        ctx.strokeStyle = z === 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.22)";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        if (z > 0 && b.z > 0.2) {
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.font = "10px system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(`${z} m`, b.x + 4, b.y + 3);
        }
      }
      for (const x of [-3 * big, 3 * big]) {
        const a = P([x, 0, -1]);
        const b = P([x, 0, D + 6]);
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      const line = (pts: V[], color: string, width: number, dash: number[] = []) => {
        ctx.setLineDash(dash);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        pts.map(P).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.stroke();
        ctx.setLineDash([]);
      };
      const poly = (pts: V[], fill: string, stroke?: string) => {
        ctx.beginPath();
        pts.map(P).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      };

      // paglione: cavalletto, paglia con spessore, faccia
      const boss = (R + 0.14) * big;
      const cx = shift * big;
      const depth = 0.32 * big;
      const legs: [V, V][] = [
        [[cx - boss * 0.6, gH - boss * 0.5, D + depth * 0.2], [cx - boss * 1.05, 0, D - depth * 1.2]],
        [[cx + boss * 0.6, gH - boss * 0.5, D + depth * 0.2], [cx + boss * 1.05, 0, D - depth * 1.2]],
        [[cx, gH + boss * 0.6, D + depth], [cx, 0, D + depth * 3]],
      ];
      legs.forEach(([a, b]) => line([a, b], "#7a5a30", Math.max(1.5, P(a).k * 0.05)));
      const front: V[] = [[cx - boss, gH - boss, D], [cx + boss, gH - boss, D], [cx + boss, gH + boss, D], [cx - boss, gH + boss, D]];
      const back = front.map(([x, y, z]) => [x, y, z + depth] as V);
      poly([front[1], back[1], back[2], front[2]], "#a9844d", "rgba(0,0,0,0.25)");
      poly([front[0], back[0], back[1], front[1]], "#8f6c3b", "rgba(0,0,0,0.25)");
      poly([front[3], back[3], back[2], front[2]], "#d9b77c", "rgba(0,0,0,0.25)");
      poly(front, "#c9a46a", "rgba(0,0,0,0.3)");
      // trama della paglia
      ctx.strokeStyle = "rgba(110,80,40,0.35)";
      ctx.lineWidth = 0.7;
      for (let i = 1; i < 8; i += 1) {
        const y = gH - boss + (2 * boss * i) / 8;
        const a = P([cx - boss, y, D - 0.001]);
        const b = P([cx + boss, y, D - 0.001]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      const circle = (rad: number, ox: number, oy: number, dz = 0.002) => Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2;
        return [ox + Math.cos(a) * rad, oy + Math.sin(a) * rad, D - dz] as V;
      });
      const zones = input.zones === 5 ? 5 : 10;
      for (let i = 0; i < zones; i += 1) {
        const rad = R * big * (1 - i / zones);
        const color = zones === 5 ? RINGS[i * 2] : RINGS[i];
        poly(circle(rad, cx, gH), color, color === "#1a1c1e" ? "rgba(244,241,234,0.5)" : "rgba(20,24,28,0.4)");
      }
      poly(circle((R * big) / zones / 2, cx, gH, 0.003), "#e6b325", "rgba(20,24,28,0.6)");

      // bersaglio in movimento: dov'era al rilascio
      if (Math.abs(lead) > 0.005) {
        line([...circle(R * big, -lead * big, gH, 0.01), circle(R * big, -lead * big, gH, 0.01)[0]], "rgba(255,255,255,0.55)", 1.2, [4, 4]);
        const a = P([-lead * big, gH - R * big - 0.15 * big, D]);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "600 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`al rilascio · anticipo ${Math.abs(lead * 100).toFixed(0)} cm`, a.x, a.y + 12);
      }

      // mira giusta (porta il centro del gruppo sull'oro)
      const gap = sighted ? 0 : round.gap;
      const fixY = -round.my;
      const fixZ = G + gap - (round.mz - G);
      const fm = P(faceAt(fixY, fixZ, 0.01));
      const rr = Math.max(6, 0.06 * big * fm.k);
      ctx.strokeStyle = "#7cf0a8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fm.x, fm.y, rr, 0, Math.PI * 2);
      ctx.moveTo(fm.x - rr - 6, fm.y);
      ctx.lineTo(fm.x - 3, fm.y);
      ctx.moveTo(fm.x + 3, fm.y);
      ctx.lineTo(fm.x + rr + 6, fm.y);
      ctx.moveTo(fm.x, fm.y - rr - 6);
      ctx.lineTo(fm.x, fm.y - 3);
      ctx.moveTo(fm.x, fm.y + 3);
      ctx.lineTo(fm.x, fm.y + rr + 6);
      ctx.stroke();
      ctx.font = "800 10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(11,18,14,0.8)";
      ctx.strokeText("MIRA QUI", fm.x + rr + 8, fm.y - rr);
      ctx.fillStyle = "#7cf0a8";
      ctx.fillText("MIRA QUI", fm.x + rr + 8, fm.y - rr);

      // traiettoria: tratteggio intero e scia fin dove è arrivata
      const pts = path.map((q) => W3(q.x, q.z));
      line(pts, "rgba(255,255,255,0.35)", 1.2, [4, 5]);
      const u = flying ? tt / T : landed ? 1 : 0;
      const n = Math.max(1, Math.min(pts.length - 1, Math.floor(u * (pts.length - 1))));
      if (u > 0) {
        const done = pts.slice(0, n + 1);
        ctx.shadowColor = "rgba(255,241,176,0.8)";
        ctx.shadowBlur = 8;
        line(done, "#fff1b0", 2.4);
        ctx.shadowBlur = 0;
      }
      // culmine
      const top = path.reduce((b, q) => (q.z > b.z ? q : b), path[0] ?? { x: 0, z: 0 });
      const tp = P(W3(top.x, top.z));
      ctx.fillStyle = "#e6b325";
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "600 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`culmine ${top.z.toFixed(2).replace(".", ",")} m`, tp.x, tp.y - 8);

      // frecce del gruppo piantate (dopo l'impatto, una dopo l'altra); le mancate finiscono dietro
      const slopeEnd = (() => {
        const b = path[path.length - 1];
        const a = path[Math.max(0, path.length - 5)];
        const sl = a && b && b.x - a.x > 0.05 ? (b.z - a.z) / (b.x - a.x) : -0.05;
        return Math.max(-0.6, Math.min(0.6, sl));
      })();
      const arrowLen = 0.72 * big;
      round.hits.forEach((hit, i) => {
        if (!landed || tt - T < 0.15 + i * 0.12) return;
        if (hit.miss) {
          // oltre il paglione: segue la discesa e si pianta nel prato dietro
          const s = Math.min(-0.04, slopeEnd);
          const run = Math.min(25, hit.z / -s);
          const tip: V = [hit.y * big * (1 + run / D), 0.02, D + depth + run];
          const dir = norm([0, s * big, 1]);
          const nock: V = [tip[0] - dir[0] * arrowLen, tip[1] - dir[1] * arrowLen, tip[2] - dir[2] * arrowLen];
          drawArrow(ctx, P, nock, dir, arrowLen * 0.98, i, 0.012 * big, look);
          return;
        }
        const tip: V = [hit.y * big, hit.z * big, D + 0.05 * big];
        const dir: V = norm([0.03 * Math.sin(i * 3.1), slopeEnd * big * 0.6, 1]);
        const nock: V = [tip[0] - dir[0] * arrowLen * 0.8, tip[1] - dir[1] * arrowLen * 0.8, tip[2] - dir[2] * arrowLen * 0.8];
        drawArrow(ctx, P, nock, dir, arrowLen * 0.8, i * 0.7, 0.012 * big, look);
      });

      // freccia in volo
      if (flying) {
        const fi = u * (pts.length - 1);
        const i0 = Math.floor(fi);
        const i1 = Math.min(pts.length - 1, i0 + 1);
        const f = fi - i0;
        const a = pts[i0];
        const b = pts[i1];
        const tip: V = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
        const prev = pts[Math.max(0, i0 - 1)];
        const dir = norm([b[0] - prev[0], b[1] - prev[1], b[2] - prev[2] || 1e-3]);
        const nock: V = [tip[0] - dir[0] * arrowLen, tip[1] - dir[1] * arrowLen, tip[2] - dir[2] * arrowLen];
        drawArrow(ctx, P, nock, dir, arrowLen, time * 18 + v.spin, 0.014 * big, look);
      } else if (landed && tt - T < 0.6) {
        const q = P(W3(end.x, end.z));
        const k = (tt - T) / 0.6;
        ctx.strokeStyle = `rgba(255,241,176,${1 - k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 6 + k * 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      // arciere sulla linea: corpo pieno, arco e freccia in aggancio prima del rilascio
      const A = (x: number, y: number, z: number): V => [x * big - 0.35 * big, y * big, z * big];
      const hgt = input.heightCm / 100;
      const sc = hgt / 1.75;
      const limb = (a: V, b: V, wdt: number, color: string) => {
        const pa = P(a);
        const pb = P(b);
        ctx.strokeStyle = color;
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(2, wdt * big * ((pa.k + pb.k) / 2));
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      };
      const skin = "#d7a98a";
      const cloth = "#2f6f62";
      limb(A(0, 0, -0.05), A(0, 0.95 * sc, 0), 0.1, "#2b3440");
      limb(A(0.12, 0, 0.05), A(0.06, 0.95 * sc, 0), 0.1, "#2b3440");
      limb(A(0.03, 0.95 * sc, 0), A(0.03, 1.45 * sc, 0), 0.24, cloth);
      limb(A(0.03, 1.42 * sc, 0), A(0.03, 1.42 * sc, 0.62 * sc), 0.075, skin);
      limb(A(0.03, 1.42 * sc, 0), A(0.0, 1.48 * sc, 0.06), 0.075, skin);
      const head = P(A(0.03, 1.62 * sc, 0));
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(head.x, head.y, Math.max(3, 0.11 * big * head.k), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a2a1e";
      ctx.beginPath();
      ctx.arc(head.x, head.y - 0.03 * big * head.k, Math.max(3, 0.11 * big * head.k), Math.PI, 0);
      ctx.fill();
      const bowTop = A(0.03, 1.42 * sc + 0.75, 0.62 * sc);
      const bowBot = A(0.03, 1.42 * sc - 0.75, 0.62 * sc);
      const bowMid = A(0.03, 1.42 * sc, 0.7 * sc);
      ctx.strokeStyle = "#1d2a33";
      ctx.lineWidth = Math.max(2, 0.04 * big * P(bowMid).k);
      ctx.beginPath();
      const b0 = P(bowTop);
      const b1 = P(bowMid);
      const b2 = P(bowBot);
      ctx.moveTo(b0.x, b0.y);
      ctx.quadraticCurveTo(b1.x, b1.y, b2.x, b2.y);
      ctx.stroke();
      line([bowTop, A(0.03, 1.48 * sc, flying || landed ? 0.58 * sc : 0.05), bowBot], "rgba(240,240,240,0.8)", 1);

      // scritte: tempo reale e scale
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(`${(Math.min(T, Math.max(0, tt))).toFixed(2).replace(".", ",")} / ${T.toFixed(2).replace(".", ",")} s · ${round.clean.v0.toFixed(0)} m/s`, 10, 18);
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(`${D} m · ${big > 1.05 ? `oggetti ×${big.toFixed(1).replace(".", ",")} · ` : ""}curva ×${(ex).toFixed(0)}`, 10, 32);
    },
    [input, round, sighted, look.fletch, look.shaft, look.cock, look.nock],
  );
  return (
    <div className="grid gap-1.5">
      <Stage3D canvasRef={ref} view={view} className={height} label="Tiro in 3D: traiettoria e bersaglio" />
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
