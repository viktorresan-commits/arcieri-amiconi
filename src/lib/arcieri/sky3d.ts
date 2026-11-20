/**
 * Cielo e meteo per le scene 3D: mattina, pomeriggio, tramonto, notte; sereno, nuvoloso, pioggia.
 * Sole o luna con alone e raggi, nuvole che scorrono, stelle di notte, pioggia sopra la scena.
 * La luce della scena (sole, cielo, nebbia) segue l'ora scelta.
 */
import { useEffect, useState } from "react";
import { basis, canvasTexture, project, trs, v3, type Env, type GL3D, type Vec3 } from "./gl3d";
import { useLocalState } from "./local-store";

export type TimeOfDay = "mattina" | "pomeriggio" | "tramonto" | "notte";
export type Weather = "sereno" | "nuvoloso" | "pioggia";
export type Sky = { tod: TimeOfDay; weather: Weather };

export const TODS: { id: TimeOfDay; label: string }[] = [
  { id: "mattina", label: "Mattina" },
  { id: "pomeriggio", label: "Pomeriggio" },
  { id: "tramonto", label: "Tramonto" },
  { id: "notte", label: "Notte" },
];
export const WEATHERS: { id: Weather; label: string }[] = [
  { id: "sereno", label: "Sereno" },
  { id: "nuvoloso", label: "Nuvoloso" },
  { id: "pioggia", label: "Pioggia" },
];

export function autoTod(d = new Date()): TimeOfDay {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 6 && h < 11) return "mattina";
  if (h >= 11 && h < 17) return "pomeriggio";
  if (h >= 17 && h < 20.5) return "tramonto";
  return "notte";
}

type SkyPref = { tod: TimeOfDay | "auto"; weather: Weather };

/** Preferenza condivisa da tutte le scene: ora (o automatica) e meteo. */
export function useSky() {
  const [pref, setPref] = useLocalState<SkyPref>("aa-sky", { tod: "auto", weather: "sereno" });
  const [now, setNow] = useState(() => autoTod());
  useEffect(() => {
    const id = window.setInterval(() => setNow(autoTod()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const sky: Sky = { tod: pref.tod === "auto" ? now : pref.tod, weather: pref.weather };
  return { sky, pref, setPref };
}

// direzione del sole (o della luna) verso cui si guarda il cielo: il campo tira verso +Z
const SUN: Record<TimeOfDay, Vec3> = {
  mattina: v3.norm([-0.75, 0.32, 0.55]),
  pomeriggio: v3.norm([0.35, 0.85, 0.35]),
  tramonto: v3.norm([0.8, 0.1, 0.6]),
  notte: v3.norm([-0.4, 0.55, 0.7]),
};

export function sunDir(sky: Sky) {
  return SUN[sky.tod];
}

export function envOf(sky: Sky): Env {
  const wet = sky.weather === "pioggia";
  const dim = sky.weather === "sereno" ? 1 : wet ? 0.45 : 0.7;
  const base: Record<TimeOfDay, Env> = {
    mattina: { sun: SUN.mattina, sunCol: [1.0, 0.9, 0.74], sky: [0.42, 0.5, 0.6], ground: [0.2, 0.22, 0.15], fog: [0.78, 0.82, 0.86], fogNear: 30, fogFar: 170 },
    pomeriggio: { sun: SUN.pomeriggio, sunCol: [1.0, 0.96, 0.88], sky: [0.42, 0.52, 0.64], ground: [0.22, 0.25, 0.16], fog: [0.72, 0.8, 0.88], fogNear: 40, fogFar: 200 },
    tramonto: { sun: SUN.tramonto, sunCol: [1.0, 0.62, 0.36], sky: [0.42, 0.36, 0.46], ground: [0.2, 0.15, 0.12], fog: [0.92, 0.66, 0.5], fogNear: 25, fogFar: 150 },
    notte: { sun: SUN.notte, sunCol: [0.42, 0.5, 0.72], sky: [0.1, 0.13, 0.22], ground: [0.05, 0.06, 0.07], fog: [0.06, 0.08, 0.14], fogNear: 15, fogFar: 110 },
  };
  const e = base[sky.tod];
  if (dim === 1) return e;
  const grey: Vec3 = sky.tod === "notte" ? [0.05, 0.06, 0.08] : wet ? [0.45, 0.48, 0.52] : [0.62, 0.66, 0.7];
  return { ...e, sunCol: v3.scale(e.sunCol, dim), fog: v3.lerp(e.fog, grey, wet ? 0.8 : 0.5), fogNear: e.fogNear * (wet ? 0.5 : 0.8), fogFar: e.fogFar * (wet ? 0.6 : 0.85), sky: v3.lerp(e.sky, v3.scale(grey, 0.7), wet ? 0.6 : 0.3) };
}

const PAL: Record<TimeOfDay, { top: string; mid: string; hor: string; hills: [string, string, string]; ground: string }> = {
  mattina: { top: "#3d6fa3", mid: "#9cc0d9", hor: "#f2dcc0", hills: ["#9fb3b2", "#6f8b78", "#4e6a45"], ground: "#43603a" },
  pomeriggio: { top: "#2c5583", mid: "#7fa6c4", hor: "#d9e3df", hills: ["#8ea6a8", "#5f7d6c", "#46613f"], ground: "#3f5a35" },
  tramonto: { top: "#2b2f5c", mid: "#c76a5a", hor: "#ffb36b", hills: ["#7a5a6a", "#4e3d48", "#2f2a2c"], ground: "#2c2522" },
  notte: { top: "#03060f", mid: "#0c1a33", hor: "#1d2c48", hills: ["#141d2c", "#0e1520", "#090d14"], ground: "#070a0e" },
};

const rand = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

function skyTexture(g: GL3D, sky: Sky) {
  return g.once(`sky-${sky.tod}-${sky.weather}`, () =>
    g.textureFrom(
      canvasTexture(1024, (c, s) => {
        const p = PAL[sky.tod];
        const h = s / 2;
        const grd = c.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, p.top);
        grd.addColorStop(0.6, p.mid);
        grd.addColorStop(1, p.hor);
        c.fillStyle = grd;
        c.fillRect(0, 0, s, h);
        const r = rand(7);
        if (sky.tod === "notte") {
          for (let i = 0; i < 900; i += 1) {
            const y = r() * h * 0.92;
            c.fillStyle = `rgba(255,255,255,${(0.25 + r() * 0.75) * (1 - y / h)})`;
            const z = r() < 0.05 ? 1.6 : 0.8;
            c.fillRect(r() * s, y, z, z);
          }
          // via lattea leggera
          c.save();
          c.globalAlpha = 0.12;
          c.translate(s * 0.55, h * 0.35);
          c.rotate(-0.5);
          const mw = c.createLinearGradient(0, -40, 0, 40);
          mw.addColorStop(0, "rgba(180,190,255,0)");
          mw.addColorStop(0.5, "rgba(200,210,255,1)");
          mw.addColorStop(1, "rgba(180,190,255,0)");
          c.fillStyle = mw;
          c.fillRect(-s, -40, s * 2, 80);
          c.restore();
        }
        // velature e nuvole dipinte nel cielo
        const clouds = sky.weather === "sereno" ? 16 : sky.weather === "nuvoloso" ? 44 : 70;
        const cloudCol = sky.tod === "notte" ? "60,70,90" : sky.tod === "tramonto" ? "255,190,160" : sky.weather === "pioggia" ? "120,126,134" : "255,255,255";
        for (let i = 0; i < clouds; i += 1) {
          const x = r() * s;
          const y = h * (0.3 + r() * 0.62);
          const w = 50 + r() * 140;
          for (let k = 0; k < 7; k += 1) {
            const gx = x + (k - 3) * w * 0.2 + r() * 10;
            const gy = y + (r() - 0.5) * w * 0.12;
            const rr = w * (0.18 + r() * 0.18);
            const rg = c.createRadialGradient(gx, gy, 0, gx, gy, rr);
            const a = sky.weather === "pioggia" ? 0.7 : 0.5;
            rg.addColorStop(0, `rgba(${cloudCol},${a})`);
            rg.addColorStop(1, `rgba(${cloudCol},0)`);
            c.fillStyle = rg;
            for (const off of [-s, 0, s]) c.fillRect(gx - rr + off, gy - rr, rr * 2, rr * 2);
          }
        }
        if (sky.weather === "pioggia") {
          c.fillStyle = "rgba(70,76,86,0.45)";
          c.fillRect(0, 0, s, h);
        }
        const hill = (base: number, amp: number, col: string, f1: number, f2: number) => {
          c.fillStyle = col;
          c.beginPath();
          c.moveTo(0, h + 4);
          for (let x = 0; x <= s; x += 4) {
            const a = (x / s) * Math.PI * 2;
            c.lineTo(x, base - amp * (0.55 + 0.3 * Math.sin(a * f1 + 1.3) + 0.15 * Math.sin(a * f2 + 0.4)));
          }
          c.lineTo(s, h + 4);
          c.closePath();
          c.fill();
        };
        hill(h, 36, p.hills[0], 3, 11);
        hill(h, 21, p.hills[1], 5, 13);
        hill(h + 2, 9, p.hills[2], 9, 23);
        c.fillStyle = p.ground;
        c.fillRect(0, h, s, s - h);
      }),
      true,
      false,
    ),
  );
}

function glowTexture(g: GL3D) {
  return g.once("glow", () =>
    g.textureFrom(
      canvasTexture(128, (c, s) => {
        const rg = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        rg.addColorStop(0, "rgba(255,255,255,1)");
        rg.addColorStop(0.12, "rgba(255,255,255,0.95)");
        rg.addColorStop(0.2, "rgba(255,255,255,0.35)");
        rg.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = rg;
        c.fillRect(0, 0, s, s);
      }),
      true,
      false,
    ),
  );
}

function cloudTexture(g: GL3D) {
  return g.once("cloud", () =>
    g.textureFrom(
      canvasTexture(256, (c, s) => {
        const r = rand(21);
        for (let i = 0; i < 26; i += 1) {
          const x = s * (0.18 + r() * 0.64);
          const y = s * (0.42 + (r() - 0.5) * 0.26);
          const rr = s * (0.1 + r() * 0.16);
          const rg = c.createRadialGradient(x, y - rr * 0.3, 0, x, y, rr);
          rg.addColorStop(0, "rgba(255,255,255,0.75)");
          rg.addColorStop(0.7, "rgba(235,240,245,0.35)");
          rg.addColorStop(1, "rgba(220,226,232,0)");
          c.fillStyle = rg;
          c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
        }
      }),
      true,
      false,
    ),
  );
}

/** Cupola del cielo, sole o luna, nuvole che scorrono. Va disegnata per prima. */
export function drawSky(g: GL3D, sky: Sky, time: number) {
  const R = g.far * 0.85;
  const eye = g.eye;
  g.draw("sphere", trs([eye[0], eye[1] - R * 0.02, eye[2]], 0, [R, R, R]), [1, 1, 1], { tex: skyTexture(g, sky), unlit: true, noFog: true, noDepth: true });
  const bill = (center: Vec3, size: number, color: Vec3 | string, alpha: number, tex: WebGLTexture, additive: boolean) => {
    const toEye = v3.norm(v3.sub(eye, center));
    const right = v3.norm(v3.cross([0, 1, 0], toEye));
    const up = v3.cross(toEye, right);
    g.draw("disc", basis(center, v3.scale(right, size), v3.scale(up, size), v3.scale(toEye, -1)), color, { tex, unlit: true, noFog: true, noDepth: true, alpha, additive, texAlpha: true });
  };
  const S = sunDir(sky);
  const sunAt = v3.add(eye, v3.scale(S, R * 0.8));
  const glow = glowTexture(g);
  if (sky.weather !== "pioggia") {
    const night = sky.tod === "notte";
    const col: Vec3 = night ? [0.85, 0.9, 1] : sky.tod === "tramonto" ? [1, 0.6, 0.3] : [1, 0.95, 0.82];
    const k = sky.weather === "nuvoloso" ? 0.45 : 1;
    bill(sunAt, R * (night ? 0.05 : 0.09), col, 0.95 * k, glow, true);
    bill(sunAt, R * (night ? 0.16 : 0.32), col, 0.35 * k, glow, true);
  }
  // nuvole in movimento
  const n = sky.weather === "sereno" ? 7 : sky.weather === "nuvoloso" ? 14 : 18;
  const r = rand(5);
  const cloudCol: Vec3 = sky.tod === "notte" ? [0.22, 0.25, 0.32] : sky.tod === "tramonto" ? [1, 0.72, 0.6] : sky.weather === "pioggia" ? [0.5, 0.52, 0.56] : [1, 1, 1];
  const ct = cloudTexture(g);
  for (let i = 0; i < n; i += 1) {
    const az = r() * Math.PI * 2 + time * 0.004 * (0.6 + r());
    const el = 0.12 + r() * 0.28;
    const d = R * (0.55 + r() * 0.25);
    const c: Vec3 = [eye[0] + Math.cos(az) * Math.cos(el) * d, eye[1] + Math.sin(el) * d, eye[2] + Math.sin(az) * Math.cos(el) * d];
    bill(c, d * (0.12 + r() * 0.1), cloudCol, sky.weather === "pioggia" ? 0.95 : 0.85, ct, false);
  }
}

/** Raggi del sole e pioggia, disegnati sopra la scena nella tela delle scritte. */
export function drawSkyOverlay(o: CanvasRenderingContext2D, g: GL3D, sky: Sky, w: number, h: number, time: number) {
  if (sky.weather !== "pioggia" && sky.tod !== "notte") {
    const S = sunDir(sky);
    const p = project(g.vp, v3.add(g.eye, v3.scale(S, 100)), w, h);
    if (p && p.x > -w * 0.4 && p.x < w * 1.4 && p.y > -h * 0.6 && p.y < h * 1.2) {
      const strength = (sky.weather === "nuvoloso" ? 0.4 : 1) * (sky.tod === "tramonto" ? 1.2 : 0.8);
      const col = sky.tod === "tramonto" ? "255,170,90" : "255,240,200";
      o.save();
      o.globalCompositeOperation = "lighter";
      const rg = o.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(w, h) * 0.7);
      rg.addColorStop(0, `rgba(${col},${0.32 * strength})`);
      rg.addColorStop(0.25, `rgba(${col},${0.1 * strength})`);
      rg.addColorStop(1, `rgba(${col},0)`);
      o.fillStyle = rg;
      o.fillRect(0, 0, w, h);
      // raggi che ruotano piano
      const L = Math.max(w, h) * 1.3;
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2 + time * 0.03 + Math.sin(i * 7.1) * 0.2;
        const wid = 0.035 + 0.03 * Math.abs(Math.sin(i * 3.3 + time * 0.2));
        const lg = o.createLinearGradient(p.x, p.y, p.x + Math.cos(a) * L, p.y + Math.sin(a) * L);
        lg.addColorStop(0, `rgba(${col},${0.12 * strength})`);
        lg.addColorStop(1, `rgba(${col},0)`);
        o.fillStyle = lg;
        o.beginPath();
        o.moveTo(p.x, p.y);
        o.lineTo(p.x + Math.cos(a - wid) * L, p.y + Math.sin(a - wid) * L);
        o.lineTo(p.x + Math.cos(a + wid) * L, p.y + Math.sin(a + wid) * L);
        o.closePath();
        o.fill();
      }
      // riflessi della lente
      const cx = w / 2;
      const cy = h / 2;
      [0.35, 0.6, 1.25].forEach((k, i) => {
        const x = p.x + (cx - p.x) * k * 2;
        const y = p.y + (cy - p.y) * k * 2;
        o.fillStyle = `rgba(${col},${0.07 * strength})`;
        o.beginPath();
        o.arc(x, y, 10 + i * 9, 0, Math.PI * 2);
        o.fill();
      });
      o.restore();
    }
  }
  if (sky.weather === "pioggia") {
    o.save();
    o.strokeStyle = sky.tod === "notte" ? "rgba(170,190,220,0.35)" : "rgba(220,230,240,0.45)";
    o.lineWidth = 1;
    o.beginPath();
    for (let i = 0; i < 170; i += 1) {
      const sx = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const sy = ((Math.sin(i * 78.233) * 12543.123) % 1 + 1) % 1;
      const speed = 0.9 + (i % 5) * 0.12;
      const y = ((sy * h + time * 620 * speed) % (h + 40)) - 20;
      const x = ((sx * (w + 60) - time * 90) % (w + 60) + w + 60) % (w + 60) - 30;
      const len = 10 + (i % 4) * 4;
      o.moveTo(x, y);
      o.lineTo(x - len * 0.18, y + len);
    }
    o.stroke();
    o.fillStyle = "rgba(40,48,60,0.12)";
    o.fillRect(0, 0, w, h);
    o.restore();
  }
}

