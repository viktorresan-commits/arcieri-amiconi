/**
 * Pezzi di scena per le viste 3D in WebGL: cielo con colline e nuvole, prato, alberi, paglione con
 * la visuale, frecce (di legno con il modello CC0, oppure costruite con i colori scelti).
 */
import { basis, canvasTexture, hexRgb, loadWoodenArrow, segment, trs, v3, type GL3D, type Mesh, type Vec3 } from "./gl3d";

const rand = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

function skyTex(g: GL3D) {
  return g.once("sky", () =>
    g.textureFrom(
      canvasTexture(1024, (c, s) => {
        const h = s / 2;
        const grd = c.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, "#2c5583");
        grd.addColorStop(0.55, "#7fa6c4");
        grd.addColorStop(0.92, "#cbdbe0");
        grd.addColorStop(1, "#d9e3df");
        c.fillStyle = grd;
        c.fillRect(0, 0, s, h);
        // nuvole morbide
        const r = rand(7);
        for (let i = 0; i < 26; i += 1) {
          const x = r() * s;
          const y = h * (0.35 + r() * 0.42);
          const w = 40 + r() * 110;
          for (let k = 0; k < 6; k += 1) {
            const gx = x + (k - 3) * w * 0.22 + r() * 10;
            const gy = y + (r() - 0.5) * w * 0.12;
            const rr = w * (0.18 + r() * 0.16);
            const rg = c.createRadialGradient(gx, gy, 0, gx, gy, rr);
            rg.addColorStop(0, "rgba(255,255,255,0.55)");
            rg.addColorStop(1, "rgba(255,255,255,0)");
            c.fillStyle = rg;
            for (const off of [-s, 0, s]) c.fillRect(gx - rr + off, gy - rr, rr * 2, rr * 2);
          }
        }
        // colline lontane (periodiche in orizzontale)
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
        hill(h, 34, "#8ea6a8", 3, 11);
        hill(h, 20, "#5f7d6c", 5, 13);
        hill(h + 2, 9, "#46613f", 9, 23);
        c.fillStyle = "#3f5a35";
        c.fillRect(0, h, s, s - h);
      }),
      true,
      false,
    ),
  );
}

function grassTex(g: GL3D) {
  return g.once("grass", () =>
    g.textureFrom(
      canvasTexture(256, (c, s) => {
        c.fillStyle = "#5d7f44";
        c.fillRect(0, 0, s, s);
        const r = rand(3);
        for (let i = 0; i < 2600; i += 1) {
          const x = r() * s;
          const y = r() * s;
          const l = 2 + r() * 5;
          const k = r();
          c.strokeStyle = k < 0.33 ? "rgba(40,70,30,0.5)" : k < 0.66 ? "rgba(120,160,80,0.45)" : "rgba(90,130,60,0.5)";
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + (r() - 0.5) * 2, y - l);
          c.stroke();
        }
      }),
      true,
      true,
    ),
  );
}

function strawTex(g: GL3D) {
  return g.once("straw", () =>
    g.textureFrom(
      canvasTexture(256, (c, s) => {
        c.fillStyle = "#c9a565";
        c.fillRect(0, 0, s, s);
        const r = rand(11);
        for (let i = 0; i < 900; i += 1) {
          const x = r() * s;
          const y = r() * s;
          const a = (r() - 0.5) * 0.5;
          const l = 10 + r() * 30;
          c.strokeStyle = r() < 0.5 ? "rgba(120,86,40,0.35)" : "rgba(240,215,150,0.4)";
          c.lineWidth = 1 + r();
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
          c.stroke();
        }
        for (let y = 0; y < s; y += 32) {
          c.fillStyle = "rgba(90,60,25,0.25)";
          c.fillRect(0, y, s, 2);
        }
      }),
      true,
      false,
    ),
  );
}

const RINGS_10 = ["#f4f1ea", "#f4f1ea", "#1a1c1e", "#1a1c1e", "#2a6294", "#2a6294", "#c4473d", "#c4473d", "#e6b325", "#e6b325"];

function faceTex(g: GL3D, zones: number) {
  return g.once(`face-${zones}`, () =>
    g.textureFrom(
      canvasTexture(512, (c, s) => {
        const R = s / 2;
        c.fillStyle = "#f4f1ea";
        c.fillRect(0, 0, s, s);
        for (let i = 0; i < zones; i += 1) {
          const rr = R * (1 - i / zones);
          const col = zones === 5 ? RINGS_10[i * 2] : RINGS_10[i];
          c.fillStyle = col;
          c.beginPath();
          c.arc(R, R, rr, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = col === "#1a1c1e" ? "rgba(244,241,234,0.7)" : "rgba(20,24,28,0.55)";
          c.lineWidth = 1.5;
          c.stroke();
        }
        c.strokeStyle = "rgba(20,24,28,0.7)";
        c.beginPath();
        c.arc(R, R, R / zones / 2, 0, Math.PI * 2);
        c.stroke();
        c.beginPath();
        c.moveTo(R - 6, R);
        c.lineTo(R + 6, R);
        c.moveTo(R, R - 6);
        c.lineTo(R, R + 6);
        c.stroke();
        // leggera grana della carta
        const r = rand(5);
        for (let i = 0; i < 1500; i += 1) {
          c.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
          c.fillRect(r() * s, r() * s, 1.5, 1.5);
        }
      }),
      true,
      false,
    ),
  );
}

/** Cielo (sempre centrato sulla camera) e prato. `center` è il mezzo del campo. */
export function drawWorld(g: GL3D, center: Vec3, size = 900) {
  const R = g.far * 0.85;
  g.draw("sphere", trs([g.eye[0], g.eye[1] - R * 0.02, g.eye[2]], 0, [R, R, R]), [1, 1, 1], { tex: skyTex(g), unlit: true, noFog: true, noDepth: true });
  g.draw(g.once("ground", () => g.mesh(groundGeo(80))), trs([center[0], 0, center[2]], 0, [size, 1, size]), [1, 1, 1], { tex: grassTex(g), shine: 0.02 });
}

function groundGeo(rep: number) {
  return {
    pos: new Float32Array([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5]),
    nor: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uv: new Float32Array([0, 0, rep, 0, rep, rep, 0, rep]),
    idx: new Uint16Array([0, 2, 1, 0, 3, 2]),
  };
}

/** Corsia: strisce falciate, linea di tiro e linee delle distanze. */
export function drawLane(g: GL3D, D: number, k: number, step: number) {
  const half = 3 * k;
  for (let i = 0; i < Math.ceil((D + 8) / step); i += 1) {
    if (i % 2) continue;
    g.draw("box", trs([0, 0.004, i * step + step / 2 - 2], 0, [half * 2, 0.002, step]), [0.42, 0.56, 0.3], { alpha: 0.35, unlit: true });
  }
  for (let z = 0; z <= D + 0.01; z += step) {
    g.draw("box", trs([0, 0.01, z], 0, [half * 2, 0.01, z === 0 ? 0.12 * k : 0.07 * k]), [1, 1, 1], { unlit: true, alpha: z === 0 ? 0.95 : 0.55 });
  }
  for (const x of [-half, half]) g.draw("box", trs([x, 0.01, D / 2], 0, [0.06 * k, 0.01, D + 8]), [1, 1, 1], { unlit: true, alpha: 0.45 });
}

/** Alberi bassi poligonali sui lati e in fondo al campo. */
export function drawTrees(g: GL3D, D: number, seed = 1) {
  const r = rand(seed * 97 + 13);
  const spots: Vec3[] = [];
  for (let i = 0; i < 18; i += 1) spots.push([(r() < 0.5 ? -1 : 1) * (20 + r() * 30), 0, D * 0.3 + r() * (D * 0.8 + 40)]);
  for (let i = 0; i < 16; i += 1) spots.push([-45 + r() * 90, 0, D + 22 + r() * 30]);
  for (const [x, , z] of spots) {
    const h = 5 + r() * 6;
    const tone = 0.75 + r() * 0.3;
    g.draw("cyl", segment([x, 0, z], [x, h * 0.35, z], 0.22, 0.22), "#5b4129");
    if (r() < 0.5) {
      g.draw("cone", segment([x, h * 0.25, z], [x, h, z], h * 0.28, h * 0.28), v3.scale(hexRgb("#2f5a35"), tone));
    } else {
      g.draw("sphere", trs([x, h * 0.62, z], 0, [h * 0.3, h * 0.36, h * 0.3]), v3.scale(hexRgb("#3d6b3a"), tone));
      g.draw("sphere", trs([x + h * 0.15, h * 0.5, z - 0.4], 0, [h * 0.22, h * 0.24, h * 0.22]), v3.scale(hexRgb("#4a7a40"), tone));
    }
    g.shadow([x + 0.8, 0, z + 0.6], h * 0.32, h * 0.32, 0.22);
  }
}

/** Paglione su cavalletto con la visuale. `R` raggio della visuale, `k` ingrandimento della scena. */
export function drawBoss(g: GL3D, cx: number, gH: number, D: number, R: number, k: number, zones: number) {
  const boss = R + 0.14 * k;
  const depth = 0.32 * k;
  // cavalletto
  const wood = "#7a5a30";
  const leg = 0.035 * k;
  g.draw("cyl", segment([cx - boss * 0.6, gH - boss * 0.4, D + depth * 0.4], [cx - boss * 1.0, 0, D - depth * 1.1], leg), wood);
  g.draw("cyl", segment([cx + boss * 0.6, gH - boss * 0.4, D + depth * 0.4], [cx + boss * 1.0, 0, D - depth * 1.1], leg), wood);
  g.draw("cyl", segment([cx, gH + boss * 0.5, D + depth], [cx, 0, D + depth * 3.2], leg), wood);
  g.draw("box", trs([cx, gH - boss - 0.03 * k, D + depth * 0.35], 0, [boss * 2.3, 0.05 * k, depth * 1.4]), wood);
  // paglia
  g.draw("box", trs([cx, gH, D + depth / 2], 0, [boss * 2, boss * 2, depth]), [1, 1, 1], { tex: strawTex(g), shine: 0.05 });
  // visuale appena davanti
  g.draw("disc", trs([cx, gH, D - 0.004 * k], 0, [R, R, 1]), [1, 1, 1], { tex: faceTex(g, zones), shine: 0.08 });
  g.shadow([cx + 0.3 * k, 0, D + depth * 1.6], boss * 1.4, depth * 3.5, 0.32);
}

export type ArrowLook = { shaft?: string; fletch?: string; cock?: string; nock?: string; wood?: boolean };

type ArrowRes = { mesh: Mesh | null; tex: WebGLTexture | null };
function woodenArrow(g: GL3D): ArrowRes {
  return g.once("wooden-arrow", () => {
    const res: ArrowRes = { mesh: null, tex: null };
    loadWoodenArrow()
      .then(([geo, img]) => {
        res.mesh = g.mesh(geo);
        res.tex = g.textureFrom(img, true, false);
      })
      .catch(() => {});
    return res;
  });
}

/** Freccia da `nock` lungo `dir` per `len` metri; `r` raggio dell'asta (già ingrandito). */
export function drawArrow3D(g: GL3D, nock: Vec3, dir: Vec3, len: number, spin: number, r: number, look: ArrowLook = {}) {
  const d = v3.norm(dir);
  const ref: Vec3 = Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const a0 = v3.norm(v3.cross(ref, d));
  const b0 = v3.cross(d, a0);
  const c = Math.cos(spin);
  const s = Math.sin(spin);
  const a = v3.add(v3.scale(a0, c), v3.scale(b0, s));
  const b = v3.cross(d, a);
  if (look.wood) {
    const w = woodenArrow(g);
    if (w.mesh) {
      // il modello ha la sezione proporzionata alla lunghezza: la allargo se la scena è ingrandita
      const thick = Math.max(1, r / (0.0045 * len));
      g.draw(w.mesh, basis(nock, v3.scale(a, len * thick), v3.scale(b, len * thick), v3.scale(d, len)), look.shaft ? v3.lerp([1, 1, 1], hexRgb(look.shaft), 0.25) : [1, 1, 1], { tex: w.tex, shine: 0.2 });
      return;
    }
  }
  const tipAt = v3.add(nock, v3.scale(d, len));
  g.draw("tube", segment(nock, v3.add(nock, v3.scale(d, len * 0.96)), r), look.shaft || "#1d1f22", { shine: 0.55 });
  g.draw("cone", segment(v3.add(nock, v3.scale(d, len * 0.96)), v3.add(tipAt, v3.scale(d, len * 0.02)), r * 1.25), "#b8c0c8", { shine: 0.9 });
  g.draw("cyl", segment(v3.sub(nock, v3.scale(d, r * 2.2)), v3.add(nock, v3.scale(d, r * 1.5)), r * 1.15), look.nock || "#e6b325", { shine: 0.4 });
  for (let i = 0; i < 3; i += 1) {
    const ang = (i * Math.PI * 2) / 3;
    const out = v3.add(v3.scale(a, Math.cos(ang)), v3.scale(b, Math.sin(ang)));
    const col = i === 0 ? look.cock || look.fletch || "#d63a2f" : look.fletch || "#d63a2f";
    // aletta: piano (out, d), alta 0.05 len, lunga 0.12 len
    g.draw("vane", basis(v3.add(nock, v3.scale(d, len * 0.03)), v3.cross(out, d), v3.scale(out, len * 0.05), v3.scale(d, len * 0.13)), col, { shine: 0.1 });
  }
}
