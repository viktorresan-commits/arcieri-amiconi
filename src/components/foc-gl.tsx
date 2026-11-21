import { basis, canvasTexture, cylinderGeo, project, segment, trs, v3, type Env, type GL3D, type Vec3 } from "@/lib/arcieri/gl3d";
import { drawArrow3D, drawBoss, drawLane, drawTrees, drawWorld } from "@/lib/arcieri/scene3d";
import { drawSkyOverlay, envOf, useSky } from "@/lib/arcieri/sky3d";
import { useAvatar } from "./avatar-hero";
import { FocBalance3D, FocFlight3D, orbit, type Arrow3DLook } from "./foc-3d";
import { GLStage, useGLScene } from "./gl-stage";
import { useAvatarSprite } from "./avatar-sprite";

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
    drawArrow3D(g, nock, v3.sub(tip, nock), 2, v.spin, 0.017, look);
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
  }, { autoYaw: false });
  if (failed) return <FocBalance3D L={L} B={B} foc={foc} look={look} />;
  return <GLStage glRef={glRef} overlayRef={ref} view={view} className="h-[22rem] w-full sm:h-64" label="Animazione 3D del punto di equilibrio" />;
}

/**
 * Gittata in 3D: il tuo arciere esegue pre-trazione, ancoraggio e mira, rilascia e la freccia vola
 * con l'alzo che serve per la distanza scelta. Altezze esagerate (scritto in alto) per vedere la curva.
 */
export function FocFlightGL({ distance, speed, foc, look = {} }: { distance: number; speed: number; foc: number; look?: Arrow3DLook }) {
  const { shown } = useAvatar();
  const sprite = useAvatarSprite(shown);
  const { sky } = useSky();
  const { ref, glRef, view, failed } = useGLScene((g, o, w, h, time, v) => {
    const G = 9.81;
    const D = distance;
    const vel = Math.max(20, speed);
    const s2 = Math.min(1, (G * D) / (vel * vel));
    const theta = 0.5 * Math.asin(s2);
    const tf = D / (vel * Math.cos(theta));
    const play = Math.min(2.6, Math.max(1.2, tf * 1.6));
    const pre = 3.1;
    const cycle = pre + play + 1.8;
    const t = (time % cycle) - pre;
    const big = Math.max(1, D / 22);
    const peak = (vel * vel * Math.sin(theta) ** 2) / (2 * G);
    const ex = Math.max(1, Math.min(8, (D * 0.07) / Math.max(0.05, peak)));
    const rel = 1.45 * big;
    const yAt = (u: number) => rel + ex * (Math.tan(theta) * D * u - (G * (D * u) ** 2) / (2 * vel * vel * Math.cos(theta) ** 2)) - (rel - 1.3 * big) * u;
    const cam = orbit([-(D * 0.55 + 6), 2.6 + D * 0.1, D * 0.15 - 3], [0, rel * 0.8 + peak * ex * 0.5, D * 0.45], v);
    g.begin(cam.eye as Vec3, cam.target as Vec3, 50, envOf(sky));
    drawWorld(g, [0, 0, D / 2], 900, sky, time);
    drawTrees(g, D, Math.round(D) + 7);
    const step = D > 40 ? 10 : 5;
    drawLane(g, D, big, step);
    drawBoss(g, 0, 1.3 * big, D, 0.61 * big, big, 10);
    // arciere: ancoraggio e mira prima del rilascio (t = 0)
    const s = big;
    const tt = t < 0 ? -2.6 + ((t + pre) / pre) * 2.6 : t;
    // l'arciere è il tuo avatar disegnato, messo nella scena 3D
    const foot: Vec3 = [-0.25 * big, 0, -0.62 * s];
    g.shadow([foot[0] + 0.2 * s, 0, foot[2] + 0.1], 0.45 * s, 0.25 * s, 0.35);
    sprite.place(project(g.vp, foot, w, h), project(g.vp, [foot[0], 1.82 * s, foot[2]], w, h), tt);
    // traiettoria
    const N = 60;
    const pts: Vec3[] = [];
    for (let i = 0; i <= N; i += 1) pts.push([0, yAt(i / N), (i / N) * D]);
    for (let i = 0; i < N; i += 2) g.draw("tube", segment(pts[i], pts[i + 1], 0.006 * big), [1, 1, 1], { alpha: 0.45, unlit: true });
    const k = t <= 0 ? 0 : Math.min(1, t / play);
    const n = Math.floor(k * N);
    for (let i = 0; i < n; i += 1) g.draw("tube", segment(pts[i], pts[i + 1], 0.012 * big), [0.49, 0.94, 0.66], { unlit: true, alpha: 0.9 });
    const len = 0.75 * big;
    if (k > 0 && k < 1) {
      const fi = k * N;
      const i0 = Math.floor(fi);
      const p0 = v3.lerp(pts[i0], pts[Math.min(N, i0 + 1)], fi - i0);
      const dir = v3.norm(v3.sub(pts[Math.min(N, i0 + 1)], pts[Math.max(0, i0 - 1)]));
      drawArrow3D(g, v3.sub(p0, v3.scale(dir, len)), dir, len, time * 18, 0.0065 * big, look);
      g.shadow([p0[0], 0, p0[2] - len / 2], 0.05 * big, len * 0.5, 0.25);
    } else if (k >= 1) {
      const dir = v3.norm(v3.sub(pts[N], pts[N - 2]));
      drawArrow3D(g, v3.sub(v3.add(pts[N], [0, 0, 0.05 * big]), v3.scale(dir, len * 0.8)), dir, len * 0.8, 0.5, 0.0065 * big, look);
    }
    drawSkyOverlay(o, g, sky, w, h, time);
    const P = (p: Vec3) => project(g.vp, p, w, h);
    const top = P([0, yAt(0.5), D * 0.5]);
    if (top) {
      o.font = "600 10px system-ui, sans-serif";
      o.textAlign = "center";
      o.lineWidth = 3;
      o.strokeStyle = "rgba(8,14,12,0.7)";
      const txt = `sale fino a ${peak.toFixed(2).replace(".", ",")} m`;
      o.strokeText(txt, top.x, top.y - 10);
      o.fillStyle = "#ffe39a";
      o.fillText(txt, top.x, top.y - 10);
    }
    o.textAlign = "left";
    o.font = "600 11px system-ui, sans-serif";
    const line1 = `${D} m · ${Math.round(vel)} m/s · alzo ${((theta * 180) / Math.PI).toFixed(1).replace(".", ",")}° · volo ${tf.toFixed(2).replace(".", ",")} s`;
    const line2 = `FOC ${foc.toFixed(1).replace(".", ",")}% · ${big > 1.05 ? `oggetti ×${big.toFixed(1).replace(".", ",")} · ` : ""}curva ×${ex.toFixed(0)}`;
    for (const [txt, y] of [[line1, 18], [line2, 32]] as const) {
      o.lineWidth = 3;
      o.strokeStyle = "rgba(8,14,12,0.7)";
      o.strokeText(txt, 10, y);
      o.fillStyle = "#fff";
      o.fillText(txt, 10, y);
    }
  });
  if (failed) return <FocFlight3D distance={distance} speed={speed} foc={foc} look={look} />;
  return (
    <GLStage glRef={glRef} overlayRef={ref} view={view} className="h-[28rem] w-full sm:h-72" label="Gittata in 3D con il tuo arciere">
      {sprite.node}
    </GLStage>
  );
}
