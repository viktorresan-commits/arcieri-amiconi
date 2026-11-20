import { basis, canvasTexture, cylinderGeo, project, trs, v3, type Env, type GL3D, type Vec3 } from "@/lib/arcieri/gl3d";
import { drawArrow3D } from "@/lib/arcieri/scene3d";
import { FocBalance3D, orbit, type Arrow3DLook } from "./foc-3d";
import { GLStage, useGLScene } from "./gl-stage";

const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));

const SHOP: Env = { sun: v3.norm([-0.35, 0.85, -0.4]), sunCol: [1.0, 0.93, 0.8], sky: [0.34, 0.38, 0.42], ground: [0.16, 0.13, 0.1], fog: [0.07, 0.1, 0.09], fogNear: 4, fogFar: 14 };

function woodTex(g: GL3D) {
  return g.once("bench", () =>
    g.textureFrom(
      canvasTexture(512, (c, s) => {
        c.fillStyle = "#8a5a32";
        c.fillRect(0, 0, s, s);
        for (let y = 0; y < s; y += 2) {
          const k = 0.5 + 0.5 * Math.sin(y * 0.09 + Math.sin(y * 0.013) * 4);
          c.fillStyle = `rgba(${60 + k * 40},${36 + k * 22},${18 + k * 10},0.35)`;
          c.fillRect(0, y, s, 2);
        }
        for (let i = 0; i < 6; i += 1) {
          c.fillStyle = "rgba(30,16,6,0.35)";
          c.fillRect(0, (i * s) / 6, s, 2);
        }
      }),
      true,
      true,
    ),
  );
}

/**
 * Equilibrio del FOC in WebGL: la freccia (di legno col modello vero, o con i tuoi colori) appoggiata
 * su un fulcro di metallo sul banco: pende in avanti a metà, il fulcro scivola al punto di equilibrio
 * e la freccia si raddrizza oscillando.
 */
export function FocBalanceGL({ L, B, foc, look = {} }: { L: number; B: number; foc: number; look?: Arrow3DLook }) {
  const { ref, glRef, view, failed } = useGLScene((g, o, w, h, time, v) => {
    const t = time % 6.5;
    const yaw = -0.55 + (v.touched ? 0 : Math.sin(time * 0.35) * 0.35);
    const cam = orbit([Math.sin(yaw) * 3.1, 1.05, -Math.cos(yaw) * 3.1], [0.05, -0.15, 0], v);
    g.begin(cam.eye as Vec3, cam.target as Vec3, 38, SHOP);
    const toX = (cm: number) => (cm / L) * 2 - 1;
    const xb = toX(B);
    const slide = ease((t - 1.1) / 1.2);
    const fx = slide * xb;
    const lean = -Math.min(0.32, Math.max(0.05, Math.abs(xb) * 2.2)) * Math.sign(xb || 1);
    let ang: number;
    if (t < 1.1) ang = lean * ease(t / 0.9);
    else {
      const s = Math.max(0, t - 1.6);
      ang = t < 1.6 ? lean * (1 - ease((t - 1.1) / 0.5) * 0.6) : lean * 0.4 * Math.exp(-2.6 * s) * Math.cos(7 * s);
    }
    const floorY = -0.62;
    // banco di legno e pavimento scuro
    g.draw("plane", trs([0, floorY - 0.9, 0], 0, [30, 1, 30]), [0.1, 0.12, 0.11], { shine: 0 });
    g.draw("box", trs([0, floorY - 0.06, 0], 0, [3.4, 0.12, 1.4]), [1, 1, 1], { tex: woodTex(g), shine: 0.25 });
    for (const [x, z] of [[-1.5, -0.55], [1.5, -0.55], [-1.5, 0.55], [1.5, 0.55]]) g.draw("box", trs([x, floorY - 0.55, z], 0, [0.12, 0.9, 0.12]), "#5b3a1e");
    // righello inciso sul banco
    for (let i = 0; i <= 20; i += 1) g.draw("box", trs([-1 + i * 0.1, floorY + 0.002, 0.42], 0, [0.006, 0.002, i % 5 ? 0.04 : 0.09]), [0.95, 0.9, 0.75], { unlit: true });
    // fulcro: prisma triangolare
    const prism = g.once("prism", () => g.mesh(cylinderGeo(3, true)));
    // asse del prisma lungo Z, spigolo in alto a y = 0
    g.draw(prism, basis([fx, floorY + 0.207, -0.16], [0, 0.413, 0], [0, 0, 0.32], [0.231, 0, 0]), "#b9c1c9", { shine: 0.9 });
    g.shadow([fx + 0.05, 0, 0.02], 0.22, 0.18, 0.4);
    // ombra della freccia sul banco
    g.draw("disc", basis([fx * 0.2, floorY + 0.003, 0.05], [1.05, 0, 0], [0, 0, 0.05], [0, -1, 0]), [0, 0, 0], { alpha: 0.35, unlit: true });
    // freccia ruotata attorno al fulcro
    const r = 0.03;
    const rot = (x: number): Vec3 => [fx + (x - fx) * Math.cos(ang), r + (x - fx) * Math.sin(ang), 0];
    const nock = rot(-1);
    const tip = rot(1);
    drawArrow3D(g, nock, v3.sub(tip, nock), 2, time * 0.6 + v.spin, 0.022, look);
    // scritte
    const P = (p: Vec3) => project(g.vp, p, w, h);
    const mark = (x: number, color: string, label: string, up: number) => {
      const p = rot(x);
      const a = P([p[0], p[1] + 0.06, 0]);
      const b = P([p[0], p[1] + up, 0]);
      if (!a || !b) return;
      o.strokeStyle = color;
      o.lineWidth = 1.4;
      o.setLineDash([3, 3]);
      o.beginPath();
      o.moveTo(a.x, a.y);
      o.lineTo(b.x, b.y);
      o.stroke();
      o.setLineDash([]);
      o.fillStyle = color;
      o.font = "600 11px system-ui, sans-serif";
      o.textAlign = "center";
      o.fillText(label, b.x, b.y - 5);
    };
    mark(0, "rgba(255,255,255,0.75)", "metà", 0.42);
    mark(xb, "#7cf0a8", "equilibrio", 0.62);
    if (slide > 0.9) {
      const a = P(rot(0));
      const b = P(rot(xb));
      if (a && b) {
        o.globalAlpha = Math.min(1, (slide - 0.9) * 10);
        o.strokeStyle = "#7cf0a8";
        o.lineWidth = 3;
        o.beginPath();
        o.moveTo(a.x, a.y - 16);
        o.lineTo(b.x, b.y - 16);
        o.stroke();
        o.fillStyle = "#7cf0a8";
        o.font = "800 13px system-ui, sans-serif";
        o.fillText(`${foc.toFixed(1).replace(".", ",")}%`, (a.x + b.x) / 2, Math.min(a.y, b.y) - 22);
        o.globalAlpha = 1;
      }
    }
  });
  if (failed) return <FocBalance3D L={L} B={B} foc={foc} look={look} />;
  return <GLStage glRef={glRef} overlayRef={ref} view={view} className="h-56 w-full" label="Animazione 3D del punto di equilibrio" />;
}
