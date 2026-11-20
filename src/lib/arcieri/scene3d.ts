/**
 * Pezzi di scena per le viste 3D in WebGL: cielo con colline e nuvole, prato, alberi, paglione con
 * la visuale, frecce (di legno con il modello CC0, oppure costruite con i colori scelti).
 */
import { basis, canvasTexture, hexRgb, segment, trs, v3, type GL3D, type Vec3 } from "./gl3d";
import { drawSky, type Sky } from "./sky3d";

const rand = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

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
export function drawWorld(g: GL3D, center: Vec3, size = 900, sky: Sky = { tod: "pomeriggio", weather: "sereno" }, time = 0) {
  drawSky(g, sky, time);
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

export type ArrowLook = { shaft?: string; fletch?: string; cock?: string; nock?: string; wood?: boolean; material?: string; fletchType?: string; fletchStyle?: string; fletch2?: string; wrap?: string; pointType?: string };

// ── freccia dettagliata ───────────────────────────────────────────────────────
type VaneShape = { lenF: number; hF: number; prof: (x: number) => number; curl?: number; feather?: boolean };
const VANES: Record<string, VaneShape> = {
  alette: { lenF: 0.085, hF: 0.022, prof: (x) => { const t = x ** 0.65; return 4 * t * (1 - t); } },
  penne: { lenF: 0.16, hF: 0.026, prof: (x) => Math.min(1, x * 6) * (1 - x) ** 0.35 * (x > 0.85 ? 1 - (x - 0.85) * 3 : 1), feather: true },
  scudo: { lenF: 0.16, hF: 0.026, prof: (x) => (x < 0.12 ? x / 0.12 : x < 0.55 ? 1 : x < 0.62 ? 1 - (x - 0.55) * 4 : 0.72 - (x - 0.62) * 1.7), feather: true },
  plastifletch: { lenF: 0.1, hF: 0.022, prof: (x) => Math.min(1, x * 4) * (1 - x) ** 0.7 },
  blazer: { lenF: 0.07, hF: 0.026, prof: (x) => { const t = x ** 0.5; return 4 * t * (1 - t); } },
  fusion: { lenF: 0.08, hF: 0.022, prof: (x) => Math.min(1, x * 5) * (1 - x) ** 0.5 },
  quickspin: { lenF: 0.07, hF: 0.02, prof: (x) => { const t = x ** 0.6; return 4 * t * (1 - t); }, curl: 0.25 },
  spin: { lenF: 0.065, hF: 0.02, prof: (x) => Math.sin(Math.PI * Math.min(1, x * 1.05)) ** 0.7, curl: 0.6 },
};

function vaneMesh(g: GL3D, id: string) {
  return g.once(`vane-${id}`, () => {
    const v = VANES[id] ?? VANES.alette;
    const N = 16;
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let side = 0; side < 2; side += 1) {
      const base = pos.length / 3;
      const nx = side ? -1 : 1;
      for (let i = 0; i <= N; i += 1) {
        const x = i / N;
        const h = Math.max(0, v.prof(x));
        const curl = (v.curl ?? 0) * h * h;
        pos.push(0, 0, x, curl, h, x);
        nor.push(nx, 0, 0, nx, -curl * 0.5, 0);
        uv.push(x, 0, x, 1);
      }
      for (let i = 0; i < N; i += 1) {
        const a = base + i * 2;
        if (side) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    return g.mesh({ pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx: new Uint16Array(idx) });
  });
}

function vaneTexture(g: GL3D, style: string, c1: string, c2: string, feather: boolean) {
  return g.once(`vtex-${style}-${c1}-${c2}-${feather}`, () =>
    g.textureFrom(
      canvasTexture(128, (c, s) => {
        c.fillStyle = c1;
        c.fillRect(0, 0, s, s);
        if (style === "striato" || style === "spirale") {
          c.fillStyle = c2;
          for (let i = -2; i < 10; i += 1) {
            c.beginPath();
            const x = i * (s / 6);
            const sk = style === "spirale" ? s * 0.5 : s * 0.18;
            c.moveTo(x, s);
            c.lineTo(x + s / 14, s);
            c.lineTo(x + s / 14 + sk, 0);
            c.lineTo(x + sk, 0);
            c.closePath();
            c.fill();
          }
        } else if (style === "bicolore") {
          c.fillStyle = c2;
          c.fillRect(0, 0, s, s * 0.45);
        } else if (style === "punta") {
          c.fillStyle = c2;
          c.fillRect(s * 0.72, 0, s * 0.28, s);
        } else if (style === "maculato") {
          const r = rand(9);
          c.fillStyle = c2;
          for (let i = 0; i < 24; i += 1) {
            c.beginPath();
            c.ellipse(r() * s, r() * s, 3 + r() * 6, 2 + r() * 4, r() * 3, 0, Math.PI * 2);
            c.fill();
          }
        }
        if (feather) {
          // rachide e barbe della penna naturale
          c.strokeStyle = "rgba(0,0,0,0.22)";
          c.lineWidth = 1;
          for (let x = -s; x < s * 2; x += 3) {
            c.beginPath();
            c.moveTo(x, s);
            c.lineTo(x + s * 0.35, 0);
            c.stroke();
          }
          c.fillStyle = "rgba(255,255,255,0.35)";
          c.fillRect(0, s - 6, s, 3);
        } else {
          // lucido delle alette in plastica
          const gr = c.createLinearGradient(0, 0, 0, s);
          gr.addColorStop(0, "rgba(255,255,255,0.18)");
          gr.addColorStop(0.5, "rgba(255,255,255,0)");
          gr.addColorStop(1, "rgba(0,0,0,0.12)");
          c.fillStyle = gr;
          c.fillRect(0, 0, s, s);
        }
      }),
      true,
      false,
    ),
  );
}

function shaftTexture(g: GL3D, material: string) {
  return g.once(`shaft-${material}`, () =>
    g.textureFrom(
      canvasTexture(256, (c, s) => {
        if (material === "legno" || material === "bambu") {
          c.fillStyle = "#c9a06a";
          c.fillRect(0, 0, s, s);
          const r = rand(17);
          // venature lungo l'asta (v = lunghezza)
          for (let i = 0; i < 70; i += 1) {
            const x = r() * s;
            c.strokeStyle = r() < 0.5 ? "rgba(110,70,30,0.35)" : "rgba(240,210,160,0.35)";
            c.lineWidth = 0.6 + r() * 1.6;
            c.beginPath();
            c.moveTo(x, 0);
            for (let y = 0; y <= s; y += 16) c.lineTo(x + Math.sin(y * 0.05 + i) * 3, y);
            c.stroke();
          }
        } else if (material === "carbonio" || material === "carbo-alluminio") {
          c.fillStyle = "#3a3d42";
          c.fillRect(0, 0, s, s);
          for (let y = 0; y < s; y += 8) {
            for (let x = 0; x < s; x += 8) {
              c.fillStyle = (x + y) % 16 === 0 ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.25)";
              c.fillRect(x, y, 8, 4);
              c.fillStyle = (x + y) % 16 === 0 ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.08)";
              c.fillRect(x, y + 4, 8, 4);
            }
          }
        } else {
          c.fillStyle = "#cfd5db";
          c.fillRect(0, 0, s, s);
          for (let x = 0; x < s; x += 2) {
            c.fillStyle = `rgba(255,255,255,${0.05 + 0.08 * Math.abs(Math.sin(x * 0.3))})`;
            c.fillRect(x, 0, 1, s);
          }
        }
      }),
      true,
      true,
    ),
  );
}

/**
 * Freccia da `nock` lungo `dir` per `len` metri; `r` raggio dell'asta (già ingrandito).
 * Disegna i dettagli scelti dall'arciere: materiale dell'asta, fascia e cresting, cocca con gola,
 * forma e stile delle penne (anche elicoidali), inserto e tipo di punta.
 */
export function drawArrow3D(g: GL3D, nock: Vec3, dir: Vec3, len: number, spin: number, r: number, look: ArrowLook = {}) {
  const d = v3.norm(dir);
  const ref: Vec3 = Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const a0 = v3.norm(v3.cross(ref, d));
  const b0 = v3.cross(d, a0);
  const c = Math.cos(spin);
  const s = Math.sin(spin);
  const a = v3.add(v3.scale(a0, c), v3.scale(b0, s));
  const b = v3.cross(d, a);
  const at = (f: number) => v3.add(nock, v3.scale(d, len * f));
  const material = look.material ?? (look.wood ? "legno" : "carbonio");
  const woodish = material === "legno" || material === "bambu";
  const shaftCol = look.shaft || (woodish ? "#d8b07a" : material === "alluminio" ? "#9aa7b2" : material === "carbo-alluminio" ? "#5b6670" : "#2a2d31");
  const metal = { shine: 0.95 };
  // asta: tubo con la texture del materiale (la v della texture corre lungo l'asta)
  const shine = woodish ? 0.22 : material === "alluminio" ? 0.95 : 0.7;
  g.draw("tube", segment(at(0.012), at(0.955), r), woodish ? v3.lerp(hexRgb(shaftCol), [1, 1, 1], 0.2) : shaftCol, { shine, tex: shaftTexture(g, material) });
  if (material === "bambu") for (const f of [0.3, 0.55, 0.8]) g.draw("tube", segment(at(f - 0.004), at(f + 0.004), r * 1.12), v3.scale(hexRgb(shaftCol), 0.8), { shine: 0.3 });
  // fascia (wrap) e cresting
  if (look.wrap) {
    g.draw("tube", segment(at(0.015), at(0.2), r * 1.05), look.wrap, { shine: 0.35 });
    g.draw("tube", segment(at(0.205), at(0.212), r * 1.06), look.cock || "#f4f1ea", { shine: 0.35 });
    g.draw("tube", segment(at(0.217), at(0.221), r * 1.06), look.fletch2 || look.cock || "#14181c", { shine: 0.35 });
  }
  // cocca con la gola per la corda
  const nockCol = look.nock || "#e6b325";
  g.draw("cyl", segment(at(-0.004), at(0.016), r * 1.12), nockCol, { shine: 0.6 });
  g.draw("cyl", segment(at(0.014), at(0.02), r * 1.04), "#c9ced4", metal);
  for (const sg of [-1, 1]) g.draw("box", basis(v3.add(at(-0.012), v3.scale(b, sg * r * 0.62)), v3.scale(a, r * 2.0), v3.scale(b, r * 0.62), v3.scale(d, len * 0.016)), nockCol, { shine: 0.6 });
  // penne
  const ft = look.fletchType ?? (woodish ? "penne" : "alette");
  const style = look.fletchStyle ?? "pieno";
  const c1 = look.fletch || "#d63a2f";
  const c2 = look.fletch2 || "#f4f1ea";
  if (ft === "fob") {
    g.draw("tube", segment(at(0.03), at(0.055), r * 4.2), c1, { shine: 0.3 });
    g.draw("tube", segment(at(0.03), at(0.055), r * 3.8), v3.scale(hexRgb(c1), 0.7), { shine: 0.3 });
  } else {
    const shape = VANES[ft] ?? VANES.alette;
    const mesh = vaneMesh(g, VANES[ft] ? ft : "alette");
    const cant = style === "elicoidale" || style === "spirale" || ft === "spin" || ft === "quickspin" ? 0.09 : 0.02;
    for (let i = 0; i < 3; i += 1) {
      const ang = (i * Math.PI * 2) / 3;
      const out = v3.add(v3.scale(a, Math.cos(ang)), v3.scale(b, Math.sin(ang)));
      const tan = v3.cross(out, d);
      const col = i === 0 ? look.cock || c1 : c1;
      const tex = vaneTexture(g, style, i === 0 && look.cock ? look.cock : col, c2, !!shape.feather);
      const lz = len * shape.lenF;
      const zAxis = v3.add(v3.scale(d, lz), v3.scale(tan, lz * cant));
      const start = v3.add(at(0.035), v3.scale(out, r * 0.95));
      g.draw(mesh, basis(start, v3.scale(tan, len * shape.hF), v3.scale(out, len * shape.hF), zAxis), [1, 1, 1], { tex, shine: shape.feather ? 0.05 : 0.35 });
    }
  }
  // inserto e punta
  const pt = look.pointType ?? "ogiva";
  g.draw("tube", segment(at(0.95), at(0.962), r * 1.04), "#b8c0c8", metal);
  if (pt === "field") {
    g.draw("cyl", segment(at(0.958), at(0.985), r * 1.04), "#c9ced4", metal);
    g.draw("cone", segment(at(0.985), at(1.0), r * 1.04), "#d8dde2", metal);
  } else if (pt === "3d") {
    g.draw("cyl", segment(at(0.958), at(0.975), r * 1.08), "#c9ced4", metal);
    g.draw("tube", segment(at(0.975), at(0.978), r * 0.9), "#6b737d", metal);
    g.draw("cone", segment(at(0.978), at(1.0), r * 1.08), "#d8dde2", metal);
  } else if (pt === "caccia") {
    g.draw("cone", segment(at(0.958), at(1.0), r * 1.05), "#9aa3ab", metal);
    for (let i = 0; i < 3; i += 1) {
      const ang = (i * Math.PI * 2) / 3 + 0.4;
      const out = v3.add(v3.scale(a, Math.cos(ang)), v3.scale(b, Math.sin(ang)));
      g.draw("vane", basis(at(0.962), v3.cross(out, d), v3.scale(out, len * 0.028), v3.scale(d, len * 0.036)), "#e6e9ec", { shine: 1 });
    }
  } else {
    // ogiva (bullet): corpo e punta arrotondata
    g.draw("cyl", segment(at(0.958), at(0.975), r * 1.04), "#c9ced4", metal);
    g.draw("cone", segment(at(0.975), at(1.0), r * 1.04), "#d8dde2", metal);
    g.draw("sphere", trs(at(0.975), 0, [r * 1.04, r * 1.04, r * 1.04]), "#c9ced4", metal);
  }
}
