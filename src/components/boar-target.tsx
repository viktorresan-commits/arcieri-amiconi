import { useEffect, useRef, useState } from "react";
import type { SagomaMax } from "@/lib/arcieri/scoring";
import { animalByLabel, type Animal, type Zone } from "@/lib/arcieri/sagome";

function inside(x: number, y: number, zone: Zone) {
  const dx = (x - zone.cx) / zone.rx;
  const dy = (y - zone.cy) / zone.ry;
  return dx * dx + dy * dy <= 1;
}

const FACE_3D = { cx: 0.495, cy: 0.428, rx: 0.318, ry: 0.285 };
const STAND_3D = { x0: 0.15, y0: 0.66, x1: 0.86, y1: 0.96 };

function spotOf(animal: Animal, x: number, y: number) {
  if (animal.id === "sagome-3d") return inside(x, y, animal.red) || inside(x, y, animal.yellow);
  return inside(x, y, animal.red) || inside(x, y, animal.yellow) || inside(x, y, animal.blue);
}

function scoreOfColor(r: number, g: number, b: number, a: number, spotBlue: boolean) {
  if (a < 24) return 0;
  if (spotBlue && b > r + 25 && b > g + 15 && b > 70) return 8;
  if (r > 160 && g > 120 && b < 110) return 8;
  if (r > 150 && g < 110 && b < 110 && r > g + 40) return 8;
  return 5;
}

function closeMask(src: Uint8Array, w: number, h: number, radius: number) {
  const grown = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!src[y * w + x]) continue;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(h - 1, y + radius);
      for (let yy = y0; yy <= y1; yy++) {
        const row = yy * w;
        for (let xx = x0; xx <= x1; xx++) grown[row + xx] = 1;
      }
    }
  }
  const closed = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(h - 1, y + radius);
      let ok = true;
      for (let yy = y0; yy <= y1 && ok; yy++) {
        const row = yy * w;
        for (let xx = x0; xx <= x1; xx++) {
          if (!grown[row + xx]) {
            ok = false;
            break;
          }
        }
      }
      if (ok) closed[y * w + x] = 1;
    }
  }
  return closed;
}

function floodOutside(blocked: Uint8Array, w: number, h: number) {
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (index: number) => {
    if (outside[index] || blocked[index]) return;
    outside[index] = 1;
    stack.push(index);
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const index = stack.pop() ?? 0;
    const x = index % w;
    if (x > 0) push(index - 1);
    if (x + 1 < w) push(index + 1);
    if (index >= w) push(index - w);
    if (index + w < w * h) push(index + w);
  }
  return outside;
}

function scoreMap(image: HTMLImageElement, spotBlue: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const count = canvas.width * canvas.height;
  const opaque = new Uint8Array(count);
  const base = new Uint8Array(count);
  for (let index = 0; index < count; index++) {
    const offset = index * 4;
    const score = scoreOfColor(pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3], spotBlue);
    base[index] = score;
    if (pixels[offset + 3] >= 24) opaque[index] = 1;
  }
  const outside = floodOutside(closeMask(opaque, canvas.width, canvas.height, 3), canvas.width, canvas.height);
  const scores = new Uint8Array(count);
  for (let index = 0; index < count; index++) {
    if (base[index] === 8) scores[index] = 8;
    else if (opaque[index] || !outside[index]) scores[index] = 5;
  }
  return { w: canvas.width, h: canvas.height, scores };
}

function readScore(map: { w: number; h: number; scores: Uint8Array }, x: number, y: number) {
  const px = Math.min(map.w - 1, Math.max(0, Math.floor(x * map.w)));
  const py = Math.min(map.h - 1, Math.max(0, Math.floor(y * map.h)));
  const direct = map.scores[py * map.w + px];
  if (direct) return direct;
  const radius = 10;
  let best = 0;
  let bestD = radius * radius + 1;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const distance = dx * dx + dy * dy;
      if (!distance || distance >= bestD) continue;
      const xx = px + dx;
      const yy = py + dy;
      if (xx < 0 || yy < 0 || xx >= map.w || yy >= map.h) continue;
      const score = map.scores[yy * map.w + xx];
      if (score && distance < bestD) {
        best = score;
        bestD = distance;
      }
    }
  }
  return best;
}

function hash(n: number) {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function scoreOnBoar(x: number, y: number, _max: SagomaMax, onBody: boolean, animal: Animal = animalByLabel("cinghiale")): { score: number; miss: boolean } {
  if (spotOf(animal, x, y)) return { score: 8, miss: false };
  if (animal.id === "sagome-3d") {
    if (inside(x, y, FACE_3D) && onBody) return { score: 5, miss: false };
    return { score: 0, miss: true };
  }
  if (onBody) return { score: 5, miss: false };
  return { score: 0, miss: true };
}

function guess(score: number, index: number, step: number, animal: Animal) {
  const n = index * 64 + step;
  const turn = n * 2.399;
  if (animal.id === "sagome-3d") {
    const a = hash(index * 97 + step * 13 + 1) * Math.PI * 2;
    const u = hash(index * 97 + step * 13 + 3);
    if (score >= 8) {
      const reach = Math.sqrt(u);
      return {
        x: animal.yellow.cx + Math.cos(a) * animal.yellow.rx * reach,
        y: animal.yellow.cy + Math.sin(a) * animal.yellow.ry * reach,
      };
    }
    if (score <= 0) {
      const band = Math.floor(hash(index * 97 + step * 13 + 7) * 4);
      const t = hash(index * 97 + step * 13 + 9);
      if (band === 0) return { x: 0.04 + t * 0.92, y: 0.02 + u * 0.1 };
      if (band === 1) return { x: 0.02 + u * 0.1, y: 0.04 + t * 0.92 };
      if (band === 2) return { x: 0.88 + u * 0.1, y: 0.04 + t * 0.92 };
      return { x: t < 0.5 ? 0.03 + u * 0.1 : 0.87 + u * 0.1, y: 0.9 + hash(index * 97 + step * 13 + 11) * 0.08 };
    }
    const reach = 0.42 + Math.sqrt(u) * 0.52;
    return {
      x: FACE_3D.cx + Math.cos(a) * FACE_3D.rx * reach,
      y: FACE_3D.cy + Math.sin(a) * FACE_3D.ry * reach,
    };
  }
  if (score >= 8) {
    const reach = ((n % 9) / 9) * Math.min(animal.blue.rx, animal.blue.ry) * 0.82;
    return {
      x: animal.blue.cx + Math.cos(turn) * reach,
      y: animal.blue.cy + Math.sin(turn) * reach * (animal.blue.ry / Math.max(animal.blue.rx, 0.01)),
    };
  }
  if (score <= 0) {
    const side = n % 4;
    const along = ((n * 17) % 100) / 100;
    const pad = 0.025 + (n % 6) * 0.012;
    if (side === 0) return { x: 0.04 + along * 0.92, y: pad };
    if (side === 1) return { x: 1 - pad, y: 0.05 + along * 0.9 };
    if (side === 2) return { x: 0.06 + (1 - along) * 0.88, y: 1 - pad };
    return { x: pad, y: 0.08 + (1 - along) * 0.84 };
  }
  return {
    x: 0.08 + ((n * 47) % 84) / 100,
    y: 0.1 + ((n * 29) % 78) / 100,
  };
}

function inFrame(point: { x: number; y: number }) {
  return point.x > 0.02 && point.x < 0.98 && point.y > 0.02 && point.y < 0.98;
}

function onSpot(point: { x: number; y: number }, animal: Animal) {
  return spotOf(animal, point.x, point.y);
}

function placeShot(score: number, index: number, animal: Animal, bodyAt: ((x: number, y: number) => boolean) | null) {
  const tries = animal.id === "sagome-3d" ? 120 : 64;
  for (let step = 0; step < tries; step += 1) {
    const point = guess(score, index, step, animal);
    if (!inFrame(point)) continue;
    if (animal.id === "sagome-3d") {
      const onBody = bodyAt ? bodyAt(point.x, point.y) : false;
      const spot = onSpot(point, animal);
      const onFace = inside(point.x, point.y, FACE_3D);
      const onStand = point.x > STAND_3D.x0 && point.x < STAND_3D.x1 && point.y > STAND_3D.y0 && point.y < STAND_3D.y1;
      if (score >= 8 && spot) return point;
      if (score > 0 && score < 8 && onFace && !spot && (onBody || !bodyAt)) return point;
      if (score <= 0 && !onFace && !onStand && !onBody) return point;
      continue;
    }
    if (!bodyAt) return point;
    const onBody = bodyAt(point.x, point.y);
    const spot = onSpot(point, animal);
    if (score >= 8 && spot) return point;
    if (score > 0 && score < 8 && onBody && !spot) return point;
    if (score <= 0 && !onBody) return point;
  }
  return guess(score, index, 0, animal);
}

export function BoarTarget({
  animal = "cinghiale",
  shots,
  onScore,
  onMove,
}: {
  max?: SagomaMax;
  animal?: string;
  shots: { score: number; miss?: boolean; nx: number | null; ny: number | null }[];
  onScore?: (score: number, miss: boolean, nx: number, ny: number) => void;
  onMove?: (index: number, score: number, miss: boolean, nx: number, ny: number, done: boolean) => void;
}) {
  const face = animalByLabel(animal);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [bodyAt, setBodyAt] = useState<((x: number, y: number) => boolean) | null>(null);
  const [colorAt, setColorAt] = useState<((x: number, y: number) => number) | null>(null);

  useEffect(() => {
    setBodyAt(null);
    setColorAt(null);
    let gone = false;
    const image = new Image();
    image.src = face.src;
    image.onload = () => {
      if (gone) return;
      const map = scoreMap(image, face.id !== "sagome-3d");
      if (!map) return;
      setBodyAt(() => (x: number, y: number) => readScore(map, x, y) > 0);
      setColorAt(() => (x: number, y: number) => readScore(map, x, y));
    };
    return () => {
      gone = true;
    };
  }, [face.src, face.id]);

  const dots = shots.flatMap((shot, index) => {
    if (shot.nx != null && shot.ny != null) return [{ key: index, x: (shot.nx + 1) / 2, y: (shot.ny + 1) / 2, score: shot.score }];
    return [{ key: index, ...placeShot(shot.score, index, face, bodyAt), score: shot.score }];
  });

  function pointOf(clientX: number, clientY: number) {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    const x = (clientX - box.left) / box.width;
    const y = (clientY - box.top) / box.height;
    if (x < -0.05 || y < -0.05 || x > 1.05 || y > 1.05) return null;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  }

  function nearest(x: number, y: number) {
    let best = -1;
    let bestD = 0.08;
    dots.forEach((dot) => {
      const distance = Math.hypot(dot.x - x, dot.y - y);
      if (distance < bestD) {
        bestD = distance;
        best = dot.key;
      }
    });
    return best;
  }

  function read(x: number, y: number) {
    const score = colorAt ? colorAt(x, y) : 0;
    return { score, miss: score === 0, nx: x * 2 - 1, ny: y * 2 - 1 };
  }

  const active = Boolean(onScore) || Boolean(onMove);

  return (
    <div className="bg-transparent" data-hold-actions="">
      <div
        ref={wrap}
        className={`relative bg-transparent ${active ? "touch-none" : "touch-pan-y"}`}
        onPointerDown={active ? (event) => {
          const point = pointOf(event.clientX, event.clientY);
          if (!point) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const index = onMove ? nearest(point.x, point.y) : -1;
          if (index >= 0) {
            drag.current = index;
            start.current = null;
            const hit = read(point.x, point.y);
            onMove?.(index, hit.score, hit.miss, hit.nx, hit.ny, false);
            return;
          }
          drag.current = null;
          start.current = point;
        } : undefined}
        onPointerMove={active ? (event) => {
          if (drag.current == null) return;
          const point = pointOf(event.clientX, event.clientY);
          if (!point) return;
          const hit = read(point.x, point.y);
          onMove?.(drag.current, hit.score, hit.miss, hit.nx, hit.ny, false);
        } : undefined}
        onPointerUp={active ? (event) => {
          const point = pointOf(event.clientX, event.clientY);
          if (drag.current != null && point) {
            const hit = read(point.x, point.y);
            onMove?.(drag.current, hit.score, hit.miss, hit.nx, hit.ny, true);
          } else if (start.current && point && onScore && Math.hypot(point.x - start.current.x, point.y - start.current.y) < 0.03) {
            const hit = read(point.x, point.y);
            onScore(hit.score, hit.miss, hit.nx, hit.ny);
          }
          drag.current = null;
          start.current = null;
        } : undefined}
        onPointerCancel={() => {
          drag.current = null;
          start.current = null;
        }}
      >
        <img src={face.src} alt={`Sagoma ${face.label}`} className="block w-full bg-transparent select-none" draggable={false} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          {dots.map((dot) => {
            const fill = dot.score <= 0 ? "#d64545" : dot.score >= 8 ? "#2f9e5b" : "#e07a2f";
            return (
              <g key={dot.key}>
                <circle cx={dot.x * 100} cy={dot.y * 100} r="2.4" fill={fill} stroke="#14181c" strokeWidth="0.28" />
                <text x={dot.x * 100} y={dot.y * 100 + 0.7} textAnchor="middle" fontSize="2.2" fill="#f7f4ee" fontFamily="var(--font-disp)">{dot.score}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
