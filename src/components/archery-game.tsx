import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  STANDARD_GEAR,
  WORLD,
  arrowCap,
  computerAim,
  gearOf,
  flight,
  idealAim,
  impact,
  planFor,
  type GameMode,
  type Gear,
  type Hit,
  type SceneId,
  type ShotPlan,
} from "@/lib/arcieri/game";

type Shot = { yaw: number; pitch: number; at: number; draw: number; pound: number; grain: number; shaft: number; vane: string };

const LOOK: Record<SceneId, { sky: [string, string, string]; ground: string; far: string; tree: string; fog: string }> = {
  bosco: { sky: ["#163044", "#6f93aa", "#e4d2b0"], ground: "#1b3326", far: "#24382c", tree: "#102018", fog: "#d5e0d8" },
  montagna: { sky: ["#24344a", "#8aa4c0", "#efe6d6"], ground: "#3c433c", far: "#5c6568", tree: "#1c2622", fog: "#e4ebf0" },
  prateria: { sky: ["#3d6e9a", "#f0c27a", "#f7e7c1"], ground: "#6d8f3e", far: "#8f7a48", tree: "#2d4c24", fog: "#f6ead0" },
  medievale: { sky: ["#2a241f", "#8a5a3a", "#e7c39a"], ground: "#3a3228", far: "#5a4636", tree: "#1a140f", fog: "#ead8be" },
  fantasy: { sky: ["#24143a", "#6a3d8a", "#f0b7d8"], ground: "#1b2e2c", far: "#3a2458", tree: "#141c28", fog: "#ead8f6" },
};

const images = new Map<string, HTMLImageElement>();

function picture(src: string) {
  let image = images.get(src);
  if (!image) {
    image = new Image();
    image.src = src;
    images.set(src, image);
  }
  return image;
}

function animalImage(name: string) {
  return picture(`/sagome/${name}.png`);
}

const RANGE_SRC = ["/gioco/campo.jpg", "/gioco/prato.jpg", "/gioco/montagna.jpg", "/gioco/autunno.jpg", "/gioco/nebbia.jpg", "/gioco/sera.jpg", "/gioco/sala.jpg", "/gioco/notte.jpg"];
const BOW_SRC = { ricurvo: "/gioco/braccio.png", longbow: "/gioco/longbow.png", takedown: "/gioco/takedown.png" } as const;
if (typeof window !== "undefined") {
  for (const src of [...RANGE_SRC, ...Object.values(BOW_SRC)]) picture(src);
}

function project(x: number, y: number, z: number, w: number, h: number) {
  const s = (h * 2.5) / Math.max(12, z);
  const dist = Math.max(12, z);
  const far = Math.min(1, Math.max(0, (dist - 15) / 40));
  const foot = h * (0.68 - far * 0.12);
  const face = WORLD.faceR * s;
  const sy = foot - face - (y - WORLD.targetY) * s - 6;
  return { sx: w * 0.5 + x * s, sy, s };
}

function centerAt(plan: ShotPlan, second: number) {
  return Math.sin(plan.phase + second * plan.swayHz * Math.PI * 2) * plan.sway + plan.place;
}

function drawWorld(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  second: number,
  look: (typeof LOOK)[SceneId],
  scene: SceneId,
  index: number,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, look.sky[0]);
  sky.addColorStop(0.42, look.sky[1]);
  sky.addColorStop(0.72, look.sky[2]);
  sky.addColorStop(1, look.ground);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * 0.78, h * 0.16, 4, w * 0.78, h * 0.16, h * 0.16);
  sun.addColorStop(0, "rgba(255,236,196,0.95)");
  sun.addColorStop(1, "rgba(255,236,196,0)");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.16, h * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.far;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.58);
  for (let i = 0; i <= 6; i += 1) ctx.lineTo((w * i) / 6, h * (0.5 + ((i * 3 + index) % 3) * 0.025));
  ctx.lineTo(w, h * 0.7);
  ctx.lineTo(0, h * 0.7);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = look.tree;
  for (let i = 0; i < 8; i += 1) {
    const x = ((i + 0.2 + (index % 3) * 0.04) / 8) * w;
    const th = h * (0.11 + ((i + index) % 4) * 0.028);
    const base = h * 0.64;
    ctx.fillRect(x + 6, base - 8, 4, 16);
    ctx.beginPath();
    ctx.moveTo(x - 4, base);
    ctx.lineTo(x + 16, base);
    ctx.lineTo(x + 6, base - th);
    ctx.fill();
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo(x, base - th * 0.35);
    ctx.lineTo(x + 12, base - th * 0.35);
    ctx.lineTo(x + 6, base - th * 0.85);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (scene === "medievale") {
    ctx.fillStyle = "#241910";
    ctx.fillRect(w * 0.06, h * 0.42, 46, h * 0.2);
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.42);
    ctx.lineTo(w * 0.06 + 23, h * 0.34);
    ctx.lineTo(w * 0.06 + 50, h * 0.42);
    ctx.fill();
  }
  if (scene === "fantasy") {
    ctx.fillStyle = "#e7b6ff";
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.arc((w * (i + 1)) / 7, h * 0.26 + Math.sin(second * 0.8 + i) * 10, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (index % 4 === 0) {
    ctx.strokeStyle = "rgba(244,241,234,0.55)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i += 1) {
      const bx = ((second * 18 + i * 90) % (w + 40)) - 20;
      const by = h * 0.22 + i * 14;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + 8, by - 4, bx + 16, by);
      ctx.stroke();
    }
  }
  const ground = ctx.createLinearGradient(0, h * 0.62, 0, h);
  ground.addColorStop(0, look.far);
  ground.addColorStop(0.18, look.ground);
  ground.addColorStop(1, "#070b09");
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.62, w, h);
  ctx.strokeStyle = "rgba(244,241,234,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i += 1) {
    const x = ((i * 37 + index * 11) % w);
    ctx.beginPath();
    ctx.moveTo(x, h * 0.78);
    ctx.lineTo(x + 2, h * 0.78 - 8 - (i % 3) * 3);
    ctx.stroke();
  }
  ctx.fillStyle = look.fog;
  ctx.globalAlpha = 0.18 + (index % 3) * 0.04;
  ctx.fillRect(0, h * 0.56, w, h * 0.1);
  ctx.globalAlpha = 1;
}

function drawStand(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, groundY: number) {
  const foot = Math.min(groundY, y + radius + 90);
  ctx.strokeStyle = "#5a4030";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.28, y + radius * 0.15);
  ctx.lineTo(x - radius * 0.55, foot);
  ctx.moveTo(x + radius * 0.28, y + radius * 0.15);
  ctx.lineTo(x + radius * 0.55, foot);
  ctx.moveTo(x, y + radius * 0.2);
  ctx.lineTo(x, foot - 4);
  ctx.stroke();
  ctx.fillStyle = "rgba(20,16,10,0.28)";
  ctx.beginPath();
  ctx.ellipse(x, foot + 2, Math.max(16, radius * 0.7), 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFace(ctx: CanvasRenderingContext2D, plan: ShotPlan, x: number, y: number, radius: number, second: number) {
  if (plan.face === "sagoma") {
    const image = animalImage(plan.animal);
    ctx.fillStyle = "rgba(7,11,9,0.28)";
    ctx.beginPath();
    ctx.ellipse(x, y + radius * 0.72, radius * 0.7, radius * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    if (image.complete && image.naturalWidth) {
      const bob = Math.sin(second * 1.4 + plan.phase) * 2;
      const iw = radius * 2.4;
      const ih = iw * (image.naturalHeight / image.naturalWidth);
      ctx.drawImage(image, x - iw / 2, y - ih * 0.62 + bob, iw, ih);
    }
    ctx.strokeStyle = "rgba(242,193,78,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const straw = ctx.createRadialGradient(x, y, radius * 0.72, x, y, radius * 1.22);
  straw.addColorStop(0, "#e7cc90");
  straw.addColorStop(1, "#8a6738");
  ctx.fillStyle = straw;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.18, 0, Math.PI * 2);
  ctx.fill();
  const bands = ["#f7f4ee", "#161616", "#1d63e0", "#c73535", "#f2c14e"];
  for (let ring = 5; ring >= 1; ring -= 1) {
    ctx.beginPath();
    ctx.fillStyle = bands[5 - ring] ?? "#f7f4ee";
    ctx.arc(x, y, (radius * ring) / 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = Math.max(1, radius * 0.03);
  ctx.beginPath();
  ctx.arc(x - radius * 0.12, y - radius * 0.14, radius * 0.7, Math.PI * 1.05, Math.PI * 1.7);
  ctx.stroke();
  ctx.fillStyle = "#f2c14e";
  ctx.beginPath();
  ctx.arc(x, y, Math.max(2, radius * 0.08), 0, Math.PI * 2);
  ctx.fill();
}

function drawCrack(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.strokeStyle = "rgba(244,241,234,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.2, y);
  ctx.lineTo(x + radius * 0.45, y - radius * 0.2);
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x - radius * 0.4, y + radius * 0.35);
  ctx.stroke();
}

function drawSight(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = "#f4f1ea";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.moveTo(x - 13, y);
  ctx.lineTo(x - 4, y);
  ctx.moveTo(x + 4, y);
  ctx.lineTo(x + 13, y);
  ctx.moveTo(x, y - 13);
  ctx.lineTo(x, y - 4);
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x, y + 13);
  ctx.stroke();
  ctx.fillStyle = "#e07a2f";
  ctx.beginPath();
  ctx.arc(x, y, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawStuckArrow(ctx: CanvasRenderingContext2D, x: number, y: number, vane: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-3.2, -3.2);
  ctx.lineTo(3.2, 3.2);
  ctx.moveTo(3.2, -3.2);
  ctx.lineTo(-3.2, 3.2);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.strokeStyle = vane;
  ctx.lineWidth = 1.15;
  ctx.stroke();
  ctx.restore();
}

function drawFlyingArrow(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, ease: number, hen = "#c73535", cock = "#f4f1ea", angle = -Math.PI / 2, shaft = "#e4d2a8") {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.scale(scale, scale);
  ctx.strokeStyle = shaft;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.lineTo(0, -16);
  ctx.stroke();
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(-3.2, -12);
  ctx.lineTo(3.2, -12);
  ctx.fill();
  feather(ctx, 0, 22, 0, -1, 1, 0, hen, 1, 16);
  feather(ctx, 0, 22, 0, -1, 1, 0, hen, -1, 14);
  feather(ctx, 0, 24, 0, -1, 1, 0, cock, 0.2, 18);
  ctx.restore();
}

function feather(ctx: CanvasRenderingContext2D, x: number, y: number, ux: number, uy: number, px: number, py: number, color: string, side: number, length: number) {
  const s = side === 0 ? 0.15 : side;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - ux * 2, y - uy * 2);
  ctx.lineTo(x - ux * length + px * s * length * 0.18, y - uy * length + py * s * length * 0.18);
  ctx.lineTo(x - ux * length * 0.72, y - uy * length * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(20,12,8,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - ux * 2, y - uy * 2);
  ctx.lineTo(x - ux * length * 0.9, y - uy * length * 0.9);
  ctx.stroke();
}

const tintedArms = new Map<string, HTMLCanvasElement>();

function tintedArm(img: HTMLImageElement, limb: string, glove: string) {
  const key = `${img.src}|${limb}|${glove}|${img.naturalWidth}`;
  const cached = tintedArms.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const pen = canvas.getContext("2d");
  if (!pen) return img;
  pen.drawImage(img, 0, 0);
  const frame = pen.getImageData(0, 0, canvas.width, canvas.height);
  const pix = frame.data;
  const limbRgb = [parseInt(limb.slice(1, 3), 16), parseInt(limb.slice(3, 5), 16), parseInt(limb.slice(5, 7), 16)];
  const gloveRgb = [parseInt(glove.slice(1, 3), 16), parseInt(glove.slice(3, 5), 16), parseInt(glove.slice(5, 7), 16)];
  const w = canvas.width;
  const h = canvas.height;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if ((pix[i + 3] ?? 0) < 40) continue;
      const nx = x / w;
      const ny = y / h;
      const r = pix[i] ?? 0;
      const g = pix[i + 1] ?? 0;
      const b = pix[i + 2] ?? 0;
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      const limbPix = ny < 0.38 && nx > 0.5;
      const glovePix = ny > 0.46 && ny < 0.64 && nx > 0.22 && nx < 0.62 && lum < 165 && lum > 28;
      const dye = limbPix ? limbRgb : glovePix ? gloveRgb : null;
      if (!dye) continue;
      const dyeLum = 0.3 * (dye[0] ?? 0) + 0.59 * (dye[1] ?? 0) + 0.11 * (dye[2] ?? 0) || 1;
      const scale = lum / dyeLum;
      const k = limbPix ? 0.78 : 0.7;
      pix[i] = Math.max(0, Math.min(255, Math.round((dye[0] ?? 0) * scale * k + r * (1 - k))));
      pix[i + 1] = Math.max(0, Math.min(255, Math.round((dye[1] ?? 0) * scale * k + g * (1 - k))));
      pix[i + 2] = Math.max(0, Math.min(255, Math.round((dye[2] ?? 0) * scale * k + b * (1 - k))));
    }
  }
  pen.putImageData(frame, 0, 0);
  tintedArms.set(key, canvas);
  return canvas;
}

function pose(w: number, h: number, draw: number) {
  const ih = h * 0.8;
  const iw = ih * (720 / 1285);
  const left = w - iw * 0.86;
  const top = h - ih * 0.78;
  const grip = { x: left + iw * 0.4, y: top + ih * 0.47 };
  const tip = { x: left + iw * 0.97, y: top + ih * 0.02 };
  const t = Math.max(0, Math.min(1, draw));
  const nock = { x: grip.x + iw * (0.1 + t * 0.16), y: grip.y + ih * (0.03 + t * 0.12) };
  return { left, top, iw, ih, grip, tip, nock };
}

function spin(p: { x: number; y: number }, pivot: { x: number; y: number }, ang: number) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const x = p.x - pivot.x;
  const y = p.y - pivot.y;
  return { x: pivot.x + x * c - y * s, y: pivot.y + x * s + y * c };
}

function bowFrame(w: number, h: number, draw: number, hand: "right" | "left", aimX: number, aimAt: { x: number; y: number }) {
  const spot = pose(w, h, draw);
  const localAim = hand === "left" ? { x: w - aimAt.x, y: aimAt.y } : aimAt;
  const slide = (hand === "left" ? -aimX : aimX) * w * 0.04;
  const pivot = { x: spot.grip.x + slide, y: spot.grip.y + spot.ih * 0.2 };
  const ang = Math.max(-0.16, Math.min(0.16, ((localAim.y - h * 0.45) / h) * 0.32));
  const nockLocal = spin({ x: spot.nock.x + slide, y: spot.nock.y }, pivot, ang);
  const nock = hand === "left" ? { x: w - nockLocal.x, y: nockLocal.y } : nockLocal;
  return { spot, slide, pivot, ang, nock, localAim };
}

function drawBow(ctx: CanvasRenderingContext2D, w: number, h: number, draw: number, gear: Gear, showArrow: boolean, hand: "right" | "left", aimX: number, aimAt: { x: number; y: number }) {
  const arm = picture(BOW_SRC[gear.bow] ?? BOW_SRC.ricurvo);
  const frame = bowFrame(w, h, draw, hand, aimX, aimAt);
  ctx.save();
  if (hand === "left") {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.translate(frame.pivot.x, frame.pivot.y);
  ctx.rotate(frame.ang);
  ctx.translate(-frame.pivot.x, -frame.pivot.y);
  if (arm.complete && arm.naturalWidth) {
    const tinted = tintedArm(arm, gear.limb, gear.glove);
    ctx.drawImage(tinted, frame.spot.left + frame.slide, frame.spot.top, frame.spot.iw, frame.spot.ih);
  }
  const nock = spin({ x: frame.spot.nock.x + frame.slide, y: frame.spot.nock.y }, frame.pivot, frame.ang);
  const tip = spin({ x: frame.spot.tip.x + frame.slide, y: frame.spot.tip.y }, frame.pivot, frame.ang);
  ctx.restore();
  ctx.save();
  if (hand === "left") {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.strokeStyle = "rgba(236,228,210,0.95)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  const high = spin(
    { x: frame.spot.left + frame.slide + frame.spot.iw * 0.95, y: frame.spot.top + frame.spot.ih * 0.018 },
    frame.pivot,
    frame.ang,
  );
  const low = spin(
    { x: frame.spot.left + frame.slide + frame.spot.iw * 0.7, y: frame.spot.top + frame.spot.ih * 0.76 },
    frame.pivot,
    frame.ang,
  );
  const mid = { x: (high.x + low.x) / 2, y: (high.y + low.y) / 2 };
  const bend = 0.22 + Math.min(1, Math.max(0, draw)) * 0.55;
  const ctrl = {
    x: mid.x + (nock.x - mid.x) * bend - frame.spot.iw * 0.02,
    y: mid.y + (nock.y - mid.y) * bend,
  };
  ctx.beginPath();
  ctx.moveTo(high.x, high.y);
  ctx.quadraticCurveTo(ctrl.x, ctrl.y, low.x, low.y);
  ctx.stroke();
  if (showArrow) {
    const dx = frame.localAim.x - ctrl.x;
    const dy = frame.localAim.y - ctrl.y;
    const span = Math.hypot(dx, dy) || 1;
    let ux = dx / span;
    let uy = dy / span;
    if (uy > -0.12 || ux > -0.08) {
      ux = Math.min(ux, -0.2);
      uy = Math.min(uy, -0.28);
      const fix = Math.hypot(ux, uy) || 1;
      ux /= fix;
      uy /= fix;
    }
    const px = -uy;
    const py = ux;
    const shaft = Math.min(frame.spot.iw * (0.48 + (gear.shaft - 26) * 0.015), Math.max(90, span * 0.62));
    const point = { x: ctrl.x + ux * shaft, y: ctrl.y + uy * shaft };
    ctx.strokeStyle = gear.shaftColor;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ctrl.x, ctrl.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.fillStyle = "#e6eaee";
    ctx.beginPath();
    ctx.moveTo(point.x + ux * 16, point.y + uy * 16);
    ctx.lineTo(point.x + px * 4.5, point.y + py * 4.5);
    ctx.lineTo(point.x - px * 4.5, point.y - py * 4.5);
    ctx.fill();
    const vane = 18 + (gear.shaft - 26);
    feather(ctx, ctrl.x, ctrl.y, ux, uy, px, py, gear.vane, 1, vane);
    feather(ctx, ctrl.x, ctrl.y, ux, uy, px, py, gear.vane, -1, vane * 0.85);
    feather(ctx, ctrl.x, ctrl.y, ux, uy, px, py, gear.cock, 0, vane * 1.1);
  }
  ctx.restore();
}

export function ArcheryGame({
  mode,
  seed,
  scene,
  versusCpu,
  onExit,
  onFinished,
}: {
  mode: GameMode;
  seed: string;
  scene: SceneId;
  versusCpu: boolean;
  onExit: () => void;
  onFinished: (shots: Shot[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gearRef = useRef<Gear>(STANDARD_GEAR);
  const handRef = useRef<"right" | "left">("right");
  const [gear, setGear] = useState<Gear>(() => {
    try {
      return gearOf(JSON.parse(localStorage.getItem("aa-gear") || "null") as Partial<Gear> | null);
    } catch {
      return STANDARD_GEAR;
    }
  });
  const [windOn, setWindOn] = useState(true);
  const windRef = useRef(true);
  windRef.current = windOn;
  const [hand, setHand] = useState<"right" | "left">(() => (typeof localStorage !== "undefined" && localStorage.getItem("aa-hand") === "left" ? "left" : "right"));
  gearRef.current = gear;
  handRef.current = hand;
  const [setup, setSetup] = useState(false);
  const [hud, setHud] = useState({
    score: 0,
    cpu: 0,
    index: 1,
    total: arrowCap(mode),
    lives: 3,
    wind: 0,
    distance: 18,
    face: "Bersaglio",
    left: mode === "time" ? 60 : 0,
    last: "Tira la corda indietro, poi rilascia",
    over: false,
  });

  useEffect(() => {
    const canvasNode = canvasRef.current;
    if (!canvasNode) return;
    const canvas: HTMLCanvasElement = canvasNode;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const look = LOOK[scene] ?? LOOK.bosco;
    const cap = arrowCap(mode);
    const started = performance.now();
    let frame = 0;
    let ended = false;
    const state = {
      index: 0,
      score: 0,
      cpu: 0,
      hits: 0,
      misses: 0,
      combo: 0,
      phase: "aim" as "aim" | "fly" | "hold",
      pointer: -1,
      originX: 0,
      originY: 0,
      lastY: 0,
      dragX: 0,
      dragY: 0,
      draw: 0,
      lift: 0,
      aiming: false,
      aim: { yaw: 0, pitch: 0 },
      flyFrom: 0,
      flyMs: 220,
      arc: 16,
      windPush: 0,
      hit: null as Hit | null,
      hitPoint: { sx: 0, sy: 0 },
      stuck: [] as { dx: number; dy: number; vane: string; cock: string }[],
      particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[],
      shards: [] as { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; w: number; h: number; color: string }[],
      broken: 0,
      smash: false,
      landed: false,
      label: "",
      creak: 0,
      flash: 0,
      shots: [] as Shot[],
      plan: planFor(mode, seed, 0),
      holdUntil: 0,
      hudAt: 0,
    };

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function pushHud(last = hud.last, over = false) {
      const now = (performance.now() - started) / 1000;
      setHud({
        score: state.score,
        cpu: state.cpu,
        index: state.index + 1,
        total: cap,
        lives: Math.max(0, 3 - state.misses),
        wind: state.plan.wind,
        distance: Math.round(state.plan.distance),
        face: state.plan.face === "sagoma" ? state.plan.animal : "Bersaglio",
        left: mode === "time" ? Math.max(0, 60 - now) : 0,
        last,
        over,
      });
    }

    function finish(last: string) {
      if (ended) return;
      ended = true;
      pushHud(last, true);
      onFinished(state.shots);
    }

    function release(nowMs: number) {
      if (state.phase !== "aim" || ended) return;
      const at = nowMs - started;
      if (mode === "time" && at > 60000) {
        finish("Tempo scaduto");
        return;
      }
      const releaseSec = at / 1000;
      const aim = state.aim;
      const gear = gearOf({ ...gearRef.current, draw: Math.max(0.35, state.draw) });
      const shotPlan = windRef.current ? state.plan : { ...state.plan, wind: 0 };
      const hit = impact(shotPlan, aim, releaseSec, gear);
      state.shots.push({ yaw: aim.yaw, pitch: aim.pitch, at, draw: gear.draw, pound: gear.pound, grain: gear.grain, shaft: gear.shaft, vane: gear.vane });
      state.hit = hit;
      if (hit.points > 0) {
        state.hits += 1;
        state.combo += 1;
        state.stuck.push({ dx: hit.dx, dy: hit.dy, vane: gear.vane, cock: gear.cock });
        if (state.stuck.length > 3) state.stuck.shift();
      } else {
        state.misses += 1;
        state.combo = 0;
      }
      state.score += hit.points;
      if (versusCpu) {
        const cpuGear = gearOf({ ...gear, draw: 1 });
        const cpuHit = impact(shotPlan, computerAim(shotPlan, releaseSec, seed), releaseSec, cpuGear);
        state.cpu += cpuHit.points;
      }
      state.phase = "fly";
      const travel = flight(shotPlan, aim, releaseSec, gear);
      state.flyFrom = nowMs;
      state.flyMs = reduce ? 150 : Math.max(130, Math.min(320, travel.t * 680));
      state.arc = Math.min(42, 8 + travel.t * 46);
      state.windPush = shotPlan.wind * 16;
      state.aiming = false;
      state.flash = 0;
      state.broken = 0;
      const leaving = mode !== "gara" || state.shots.length % 3 === 0;
      state.smash = leaving && hit.points >= 8;
      state.landed = false;
      state.label = hit.points === 0 ? "Mancato" : hit.perfect ? "Perfetto" : hit.points >= 8 ? "Rotto" : String(hit.points);
      bowRelease();
      if (navigator.vibrate) navigator.vibrate(10);
      const spot = project(centerAt(state.plan, releaseSec + 0.35) + hit.dx, WORLD.targetY + state.plan.lift + hit.dy, state.plan.distance, canvas.clientWidth, canvas.clientHeight);
      state.hitPoint = { sx: spot.sx, sy: spot.sy };
      pushHud("");
    }

    function advance(nowMs: number) {
      const doneByLives = mode === "infinite" && state.misses >= 3;
      const doneByCount = state.shots.length >= cap;
      const doneByTime = mode === "time" && nowMs - started >= 60000;
      if (doneByLives || doneByCount || doneByTime) {
        finish(doneByTime ? "Tempo scaduto" : doneByLives ? "Tre errori" : "Frecce finite");
        return;
      }
      state.index = state.shots.length;
      state.plan = planFor(mode, seed, state.index);
      state.phase = "aim";
      state.hit = null;
      state.dragX = 0;
      state.dragY = 0;
      state.broken = 0;
      state.smash = false;
      state.landed = false;
      state.creak = 0;
      if (mode !== "gara" || state.shots.length % 3 === 0) state.stuck = [];
      state.shards = [];
      pushHud("");
    }

    function onDown(event: PointerEvent) {
      if (state.phase !== "aim" || ended) return;
      state.pointer = event.pointerId;
      state.originX = event.clientX;
      state.originY = event.clientY;
      state.lastY = event.clientY;
      state.dragX = 0;
      state.dragY = 0;
      state.aiming = true;
      state.creak = 0;
      canvas.setPointerCapture(event.pointerId);
    }
    function onMove(event: PointerEvent) {
      if (event.pointerId !== state.pointer || !state.aiming) return;
      state.dragX = Math.max(-1, Math.min(1, (event.clientX - state.originX) / 110));
      const dy = event.clientY - state.originY;
      const step = event.clientY - state.lastY;
      state.lastY = event.clientY;
      const nextDraw = Math.max(0, Math.min(1.15, Math.max(0, dy) / 145));
      if (step < 0) state.dragY = Math.max(-2.2, Math.min(2.6, state.dragY + -step / 62));
      else if (nextDraw >= 1 && step > 0) state.dragY = Math.max(-2.2, Math.min(2.6, state.dragY - step / 70));
      state.draw = nextDraw;
      if (state.draw > state.creak + 0.14) {
        state.creak = state.draw;
        stringCreak(state.draw);
      }
    }
    function onUp(event: PointerEvent) {
      if (event.pointerId !== state.pointer) return;
      state.pointer = -1;
      const drawn = state.aiming && state.draw >= 0.28;
      state.aiming = false;
      if (drawn) release(performance.now());
      else state.draw = 0;
    }
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    pushHud();

    function draw(nowMs: number) {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const second = (nowMs - started) / 1000;
      const plan = windRef.current ? state.plan : { ...state.plan, wind: 0 };
      ctx.clearRect(0, 0, w, h);
      const station = mode === "gara" ? Math.floor(plan.index / 3) : 0;
      const wanted = picture(RANGE_SRC[station % RANGE_SRC.length] ?? RANGE_SRC[0]!);
      const ready = wanted.complete && wanted.naturalWidth ? wanted : RANGE_SRC.map((src) => images.get(src)).find((img) => img && img.complete && img.naturalWidth);
      if (ready && ready.naturalWidth) {
        const scale = Math.max(w / ready.naturalWidth, h / ready.naturalHeight) * 1.12;
        const dw = ready.naturalWidth * scale;
        const dh = ready.naturalHeight * scale;
        ctx.save();
        ctx.filter = "saturate(0.82) contrast(0.94)";
        ctx.drawImage(ready, (w - dw) / 2, h - dh + 2, dw, dh + 8);
        ctx.restore();
        const wash = ctx.createRadialGradient(w * 0.5, h * 0.42, h * 0.12, w * 0.5, h * 0.46, h * 0.78);
        wash.addColorStop(0, "rgba(0,0,0,0)");
        wash.addColorStop(1, "rgba(12,18,14,0.42)");
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = "#1c2a22";
        ctx.fillRect(0, 0, w, h);
      }

      const tuned = gearOf({ ...gearRef.current, draw: state.aiming ? Math.max(0.55, state.draw) : 1 });
      const calm = idealAim({ ...plan, wind: 0, sway: 0 }, 0, tuned);
      state.aim = {
        yaw: calm.yaw + state.dragX * 0.11,
        pitch: calm.pitch + (state.aiming ? state.dragY * 0.2 : 0),
      };
      const cx = centerAt(plan, second);
      const target = project(cx, WORLD.targetY + plan.lift, plan.distance, w, h);
      const ground = project(cx, 0, plan.distance, w, h);
      const radius = Math.max(18, WORLD.faceR * plan.size * target.s);
      const hanging = plan.lift > 0.4;
      if (plan.face === "tondo" && state.broken < 1) {
        if (hanging) {
          const beam = target.sy - radius * 1.45;
          ctx.strokeStyle = "#6a4e34";
          ctx.lineWidth = Math.max(4, radius * 0.1);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(target.sx - radius * 1.45, beam);
          ctx.lineTo(target.sx + radius * 0.35, beam);
          ctx.moveTo(target.sx - radius * 1.45, beam);
          ctx.lineTo(target.sx - radius * 1.2, target.sy + radius * 1.35);
          ctx.stroke();
          ctx.strokeStyle = "#cbb892";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(target.sx - radius * 0.28, beam);
          ctx.lineTo(target.sx - radius * 0.12, target.sy - radius * 1.12);
          ctx.moveTo(target.sx + radius * 0.22, beam);
          ctx.lineTo(target.sx + radius * 0.08, target.sy - radius * 1.12);
          ctx.stroke();
        } else {
          const foot = target.sy + radius * 1.2;
          ctx.strokeStyle = "#5c4030";
          ctx.lineWidth = Math.max(3, radius * 0.08);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(target.sx - radius * 0.28, target.sy + radius * 1.05);
          ctx.lineTo(target.sx - radius * 0.4, foot);
          ctx.moveTo(target.sx + radius * 0.28, target.sy + radius * 1.05);
          ctx.lineTo(target.sx + radius * 0.4, foot);
          ctx.stroke();
          ctx.fillStyle = "rgba(12,16,10,0.28)";
          ctx.beginPath();
          ctx.ellipse(target.sx, foot + 1, Math.max(10, radius * 0.45), 3.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        drawFace(ctx, plan, target.sx, target.sy, radius, second);
      } else if (state.broken < 1) {
        drawStand(ctx, target.sx, target.sy, radius, ground.sy);
        if (state.broken < 1) drawFace(ctx, plan, target.sx, target.sy, radius, second);
        else drawCrack(ctx, target.sx, target.sy, radius);
      }

      for (const arrow of state.stuck) {
        if (state.broken > 0) continue;
        const spot = project(cx + arrow.dx, WORLD.targetY + plan.lift + arrow.dy, plan.distance, w, h);
        drawStuckArrow(ctx, spot.sx, spot.sy, arrow.vane);
      }

      let aimAt = { x: target.sx + state.dragX * w * 0.08, y: target.sy - state.dragY * h * 0.05 };
      if (state.phase === "aim") {
        const sight = impact({ ...plan, wind: 0, sway: 0 }, state.aim, 0, tuned);
        const pin = project(cx + sight.dx, WORLD.targetY + plan.lift + sight.dy, plan.distance, w, h);
        drawSight(ctx, pin.sx, pin.sy);
      }

      drawBow(ctx, w, h, state.aiming ? state.draw : 0.05, gearRef.current, state.phase === "aim", handRef.current, state.dragX, aimAt);
      if (state.phase === "aim") {
        const meterX = handRef.current === "left" ? 16 : w - 24;
        const meterTop = h * 0.58;
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(meterX, meterTop, 7, 86);
        const amount = Math.min(1, state.draw);
        ctx.fillStyle = amount > 0.82 && amount < 1.05 ? "#d7b56a" : "#e07a2f";
        ctx.fillRect(meterX, meterTop + 86 - amount * 86, 7, amount * 86);
      }

      if (state.phase === "fly" && state.hit) {
        const u = Math.min(1, (nowMs - state.flyFrom) / state.flyMs);
        const ease = 1 - (1 - u) * (1 - u);
        const from = bowFrame(w, h, state.draw, handRef.current, state.dragX, { x: state.hitPoint.sx, y: state.hitPoint.sy }).nock;
        const angle = Math.atan2(state.hitPoint.sy - from.y, state.hitPoint.sx - from.x);
        const sx = from.x + (state.hitPoint.sx - from.x) * ease + Math.sin(ease * Math.PI) * state.windPush;
        const sy = from.y + (state.hitPoint.sy - from.y) * ease - Math.sin(ease * Math.PI) * state.arc;
        drawFlyingArrow(ctx, sx, sy, 1 - ease * 0.45, ease, gearRef.current.vane, gearRef.current.cock, angle, gearRef.current.shaftColor);
        if (u >= 1 && !state.landed) {
          state.landed = true;
          state.phase = "hold";
          state.holdUntil = nowMs + (state.hit.perfect && !reduce ? 720 : 380);
          impactSound(state.hit.points);
          pushHud(state.label);
          if (navigator.vibrate) navigator.vibrate(state.hit.perfect ? [12, 24, 12] : state.hit.points === 0 ? 18 : 8);
          if (state.smash) {
            state.broken = 1;
            const colors = ["#f7f4ee", "#161616", "#1d63e0", "#c73535", "#f2c14e", "#c6a56a"];
            for (let i = 0; i < 16; i += 1) {
              const angle = (i / 16) * Math.PI * 2;
              const speed = 90 + Math.random() * 220;
              state.shards.push({
                x: state.hitPoint.sx,
                y: state.hitPoint.sy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 40,
                rot: Math.random() * Math.PI,
                vr: (Math.random() - 0.5) * 10,
                life: 1,
                w: 14 + Math.random() * 18,
                h: 8 + Math.random() * 12,
                color: colors[i % colors.length] ?? "#f7f4ee",
              });
            }
          }
        }
      }
      if (state.phase === "hold" && nowMs >= state.holdUntil) advance(nowMs);
      if (state.phase === "aim" && mode === "time" && nowMs - started >= 60000) finish("Tempo scaduto");

      state.particles = state.particles.filter((bit) => bit.life > 0);
      for (const bit of state.particles) {
        bit.x += bit.vx * 0.016;
        bit.y += bit.vy * 0.016;
        bit.vy += 280 * 0.016;
        bit.life -= 0.018;
        ctx.globalAlpha = Math.max(0, bit.life);
        ctx.fillStyle = bit.color;
        ctx.fillRect(bit.x, bit.y, bit.size, bit.size);
      }
      state.shards = state.shards.filter((bit) => bit.life > 0);
      for (const bit of state.shards) {
        bit.x += bit.vx * 0.016;
        bit.y += bit.vy * 0.016;
        bit.vy += 420 * 0.016;
        bit.rot += bit.vr * 0.016;
        bit.life -= 0.012;
        ctx.save();
        ctx.globalAlpha = Math.max(0, bit.life);
        ctx.translate(bit.x, bit.y);
        ctx.rotate(bit.rot);
        ctx.fillStyle = bit.color;
        ctx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (state.flash > 0) {
        ctx.fillStyle = `rgba(242,193,78,${state.flash * 0.22})`;
        ctx.fillRect(0, 0, w, h);
        state.flash = Math.max(0, state.flash - 0.03);
      }
      if (mode === "time" && state.phase === "aim" && nowMs - state.hudAt > 250) {
        state.hudAt = nowMs;
        setHud((prev) => ({ ...prev, left: Math.max(0, 60 - second), wind: state.plan.wind }));
      }
    }

    function loop(nowMs: number) {
      draw(nowMs);
      if (!ended) frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => {
      ended = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
    // The match is one session. Restarting happens by remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, seed]);

  const windTo = hud.wind >= 0 ? "→" : "←";
  const station = Math.min(20, Math.floor((hud.index - 1) / 3) + 1);
  const spent = (hud.index - 1) % 3;
  function tune(patch: Partial<Gear>) {
    setGear((prev) => {
      const next = gearOf({ ...prev, ...patch });
      localStorage.setItem("aa-gear", JSON.stringify(next));
      return next;
    });
  }
  const shell = (
    <div className="fixed inset-0 z-[80] h-[100dvh] w-screen overflow-hidden bg-[#1a241c] text-white" style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, width: "100vw", height: "100dvh" }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div>
          <div className="rounded-2xl bg-black/55 px-3 py-2 text-white backdrop-blur-sm [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
            <p className="font-display text-5xl leading-none tabular-nums">{hud.score}</p>
            <p className="text-sm text-white">
              {hud.face} · {hud.distance} m · {windOn ? `vento ${windTo} ${Math.abs(hud.wind).toFixed(1)}` : "vento off"}
            </p>
            {mode === "gara" ? <p className="mt-1 text-sm text-white">Piazzola {station}/20</p> : null}
          </div>
          <button type="button" onClick={() => setWindOn((on) => !on)} className={`pointer-events-auto mt-2 rounded-full px-3 py-1 text-xs ${windOn ? "bg-[#142018] text-white" : "bg-white text-black"}`}>
            Vento {windOn ? "on" : "off"}
          </button>
        </div>
        <div className="rounded-2xl bg-black/55 px-3 py-2 text-right text-sm text-white backdrop-blur-sm [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
          {mode === "time" ? <p className="font-display text-4xl leading-none">{Math.ceil(hud.left)}</p> : mode === "gara" ? (
            <span className="flex justify-end gap-1">
              {[0, 1, 2].map((arrow) => (
                <span key={arrow} className="inline-block h-7 w-1.5 rounded-full" style={{ background: arrow < spent ? "rgba(255,255,255,0.25)" : gear.vane }} />
              ))}
            </span>
          ) : <p className="font-display text-3xl leading-none">{hud.index}</p>}
          <p>{mode === "infinite" ? `${hud.lives} vite` : mode === "time" ? "secondi" : mode === "gara" ? "frecce" : `${hud.index}/${hud.total}`}</p>
          {versusCpu ? <p>Computer {hud.cpu}</p> : null}
        </div>
      </div>
      <button type="button" onClick={() => setSetup((open) => !open)} className="absolute inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 rounded-2xl border border-white/20 bg-[#142018] px-3 py-2.5 text-sm text-white">
        Attrezzatura · {gear.shaft}" · {gear.grain} gr · {gear.pound} lb
      </button>
      {setup ? (
        <div className="absolute inset-x-3 bottom-[max(3.6rem,env(safe-area-inset-bottom))] z-30 max-h-[52dvh] overflow-y-auto rounded-2xl border border-white/20 bg-[#142018] p-3 text-sm">
          <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/70">Arco</p>
          <GearRow label="Mano">
            <Chip on={hand === "right"} onClick={() => { setHand("right"); localStorage.setItem("aa-hand", "right"); }}>Destro</Chip>
            <Chip on={hand === "left"} onClick={() => { setHand("left"); localStorage.setItem("aa-hand", "left"); }}>Mancino</Chip>
          </GearRow>
          <GearRow label="Tipo">
            {(["ricurvo", "longbow", "takedown"] as const).map((style) => (
              <Chip key={style} on={gear.bow === style} onClick={() => tune({ bow: style })}>{style === "ricurvo" ? "Ricurvo" : style === "longbow" ? "Longbow" : "Takedown"}</Chip>
            ))}
          </GearRow>
          <GearRow label="Legno">
            {["#8a5a32", "#c4a574", "#3d2918", "#1f5c38", "#1c2838"].map((color) => (
              <Swatch key={color} color={color} on={gear.limb === color} onClick={() => tune({ limb: color })} />
            ))}
          </GearRow>
          <GearRow label="Guanto">
            {["#6b4226", "#1a1a1a", "#f4f1ea", "#1f5c38", "#8a3030", "#c4a574"].map((color) => (
              <Swatch key={color} color={color} on={gear.glove === color} onClick={() => tune({ glove: color })} />
            ))}
          </GearRow>
          <GearRow label="Libbre">
            {[24, 28, 32, 36, 40, 44, 50].map((value) => <Chip key={value} on={gear.pound === value} onClick={() => tune({ pound: value })}>{value}</Chip>)}
          </GearRow>
          <p className="mb-2 mt-3 text-[11px] uppercase tracking-[0.16em] text-white/70">Freccia</p>
          <GearRow label="Asta">
            {[26, 27, 28, 29, 30, 31].map((value) => <Chip key={value} on={gear.shaft === value} onClick={() => tune({ shaft: value })}>{value}"</Chip>)}
          </GearRow>
          <GearRow label="Colore">
            {["#e4d2a8", "#1a1a1a", "#f4f1ea", "#2d5a3c", "#c73535"].map((color) => (
              <Swatch key={color} color={color} on={gear.shaftColor === color} onClick={() => tune({ shaftColor: color })} />
            ))}
          </GearRow>
          <GearRow label="Punta">
            {[80, 100, 120, 140].map((value) => <Chip key={value} on={gear.grain === value} onClick={() => tune({ grain: value })}>{value}</Chip>)}
          </GearRow>
          <GearRow label="Penne">
            {["#c73535", "#f4f1ea", "#e07a2f", "#f2c14e", "#1f5c38", "#1d63e0"].map((color) => (
              <Swatch key={color} color={color} on={gear.vane === color} onClick={() => tune({ vane: color })} />
            ))}
          </GearRow>
          <GearRow label="Indice">
            {["#f4f1ea", "#c73535", "#e07a2f", "#f2c14e", "#1d63e0", "#1a1a1a"].map((color) => (
              <Swatch key={color} color={color} on={gear.cock === color} onClick={() => tune({ cock: color })} />
            ))}
          </GearRow>
        </div>
      ) : null}
      {hud.last ? <p className="pointer-events-none absolute inset-x-0 bottom-24 z-10 text-center"><span className="rounded-full bg-black/55 px-3 py-1 font-display text-2xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">{hud.last}</span></p> : null}
      <button type="button" onClick={onExit} className="absolute right-4 top-[max(7.6rem,env(safe-area-inset-top))] z-10 rounded-xl bg-black/55 px-3 py-2 text-sm text-white backdrop-blur-sm">
        Chiudi
      </button>
    </div>
  );
  if (typeof document === "undefined") return shell;
  return createPortal(shell, document.body);
}

function Swatch({ color, on, onClick }: { color: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={color} className={`h-8 w-8 shrink-0 rounded-full border-2 ${on ? "border-white" : "border-white/20"}`} style={{ background: color }} />
  );
}

function GearRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs uppercase tracking-wide text-white/80">{label}</span>
      <div className="flex gap-1.5 overflow-x-auto pb-1">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`shrink-0 rounded-full border px-2 py-1 text-xs ${on ? "border-white bg-white text-black" : "border-white/30"}`}>
      {children}
    </button>
  );
}

let audioCtx: AudioContext | null = null;

function audio() {
  audioCtx ??= new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function tone(freq: number, dur: number, type: OscillatorType, gainValue: number, slideTo?: number) {
  const ctx = audio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + dur);
  gain.gain.setValueAtTime(gainValue, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function noise(seconds: number, freq: number, gainValue: number, slideTo?: number, attack = 0.012) {
  const ctx = audio();
  const now = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.4;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(freq, now);
  if (slideTo) filter.frequency.exponentialRampToValueAtTime(Math.max(80, slideTo), now + seconds);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainValue), now + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(now);
}

function stringCreak(amount: number) {
  try {
    noise(0.32, 180 + amount * 60, 0.04, 260 + amount * 120, 0.06);
  } catch {
    /* il suono è facoltativo */
  }
}

function bowRelease() {
  try {
    noise(0.7, 1400, 0.07, 240, 0.09);
    tone(220, 0.45, "sine", 0.02, 90);
  } catch {
    /* il suono è facoltativo */
  }
}

function impactSound(points: number) {
  try {
    noise(0.07, points >= 8 ? 1800 : 1100, 0.09, 240);
    tone(points <= 0 ? 70 : 130, 0.18, "sine", 0.07, 48);
    noise(0.16, 280, 0.06, 90);
  } catch {
    /* il suono è facoltativo */
  }
}
