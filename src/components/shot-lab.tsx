import { useEffect, useMemo, useRef, useState } from "react";
import { ringPoint, scoreAtRadius, type Face } from "@/lib/arcieri/scoring";
import { Card } from "@/components/kit";
import { PoseRead } from "@/components/pose-read";
import { Target3D, lookOf } from "@/components/target-3d";
import { TargetRead } from "@/components/target-read";

type Point = { nx: number | null; ny: number | null; score: number; isX?: boolean; miss?: boolean; arrow: number; end: number };

export function ShotLab({
  face,
  shots,
  onPhoto,
  expected,
  volleyLabel,
  onPhotoBatch,
  arrowSpecs,
}: {
  /** scheda delle frecce dell'utente: colori di asta, penne e cocca nella vista 3D */
  arrowSpecs?: string;
  volleyLabel?: string;
  onPhotoBatch?: (volleys: { nx: number; ny: number; score: number; isX: boolean; miss: boolean }[][]) => void;
  face: Face;
  shots: Point[];
  /** quante frecce aspettarsi nella foto (quelle che mancano alla volée) */
  expected?: number;
  onPhoto?: (hits: { nx: number; ny: number; score: number; isX: boolean; miss: boolean }[]) => void;
}) {
  const placed = shots
    .map((shot, index) => {
      const spot = spotOf(face, shot, index);
      return spot ? { ...shot, ...spot } : null;
    })
    .filter((shot): shot is Point & { x: number; y: number } => Boolean(shot));
  const [view, setView] = useState<"mappa" | "tre" | "corpo">("mappa");
  const look = useMemo(() => lookOf(arrowSpecs), [arrowSpecs]);
  const stats = useMemo(() => groupStats(placed), [placed]);

  return (
    <Card className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setView("mappa")} className={`min-h-11 rounded-full px-3 text-sm ${view === "mappa" ? "bg-primary text-primary-fg" : "border border-line"}`}>Mappa termica</button>
        <button type="button" onClick={() => setView("tre")} className={`min-h-11 rounded-full px-3 text-sm ${view === "tre" ? "bg-primary text-primary-fg" : "border border-line"}`}>Vista 3D</button>
        <button type="button" onClick={() => setView("corpo")} className={`min-h-11 rounded-full px-3 text-sm ${view === "corpo" ? "bg-primary text-primary-fg" : "border border-line"}`}>Gesto (video)</button>
      </div>
      {view === "corpo" ? <PoseRead /> : null}
      {view !== "corpo" && placed.length < 2 ? <p className="text-sm text-muted">Servono almeno due frecce sul bersaglio.</p> : null}
      {view === "mappa" ? <Heat face={face} shots={placed} /> : null}
      {view === "tre" ? <Target3D face={face} shots={placed} look={look} /> : null}
      {view === "corpo" ? null : (
      <>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Mini k="Centro" v={stats.center} />
        <Mini k="Deviazione" v={stats.sigma} />
        <Mini k="Gruppo" v={stats.size} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr><th>Freccia</th><th>Media</th><th>Tiri</th><th>Gruppo</th></tr>
          </thead>
          <tbody>
            {stats.arrows.map((row) => (
              <tr key={row.n} className="border-t border-line">
                <td className="py-1">{row.n}</td>
                <td>{row.avg}</td>
                <td>{row.nShots}</td>
                <td>{row.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
      {onPhoto && view !== "corpo" ? <TargetRead face={face} onApply={onPhoto} expected={expected} volleyLabel={volleyLabel} onApplyBatch={onPhotoBatch} known={placed.map((p) => ({ x: p.x, y: p.y }))} /> : null}
    </Card>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{k}</p>
      <p className="font-semibold">{v}</p>
    </div>
  );
}

function Heat({ face, shots }: { face: Face; shots: { x: number; y: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const size = 420;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#07080c";
    ctx.fillRect(0, 0, size, size);
    const at = (nx: number, ny: number) => ({ x: ((nx + 1.12) / 2.24) * size, y: ((ny + 1.12) / 2.24) * size });
    const center = at(0, 0);
    const scale = size / 2.24;
    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, scale * 1.02, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#10141c";
    ctx.fillRect(0, 0, size, size);
    for (const ring of [...face.rings].sort((a, b) => b.outer - a.outer)) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, ring.outer * scale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(244,241,234,0.28)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    const heat = new Float32Array(size * size);
    const radius = 36;
    for (const shot of shots) {
      const c = at(shot.x, shot.y);
      const x0 = Math.max(0, Math.floor(c.x - radius));
      const x1 = Math.min(size - 1, Math.ceil(c.x + radius));
      const y0 = Math.max(0, Math.floor(c.y - radius));
      const y1 = Math.min(size - 1, Math.ceil(c.y + radius));
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          const d = Math.hypot(x - c.x, y - c.y) / radius;
          if (d >= 1) continue;
          heat[y * size + x] += Math.exp(-d * d * 4.2);
        }
      }
    }
    let peak = 0.001;
    for (const value of heat) if (value > peak) peak = value;
    const image = ctx.getImageData(0, 0, size, size);
    const pix = image.data;
    for (let i = 0; i < heat.length; i += 1) {
      const t = heat[i] / peak;
      if (t < 0.08) continue;
      const color = thermal(t);
      const o = i * 4;
      const a = Math.min(0.92, 0.2 + t * 0.8);
      pix[o] = Math.round(pix[o] * (1 - a) + color[0] * a);
      pix[o + 1] = Math.round(pix[o + 1] * (1 - a) + color[1] * a);
      pix[o + 2] = Math.round(pix[o + 2] * (1 - a) + color[2] * a);
    }
    ctx.putImageData(image, 0, 0);
    ctx.fillStyle = "#fff";
    for (const shot of shots) {
      const c = at(shot.x, shot.y);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#14181c";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }, [face, shots]);
  return (
    <div>
      <canvas ref={ref} className="mx-auto aspect-square w-full max-w-md rounded-2xl" />
      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
        <span>Meno</span>
        <span className="h-2 flex-1 rounded-full" style={{ background: "linear-gradient(90deg,#2a3f8f,#2aa8c9,#3d9b74,#e6b325,#e05a2f,#f4f1ea)" }} />
        <span>Più</span>
      </div>
    </div>
  );
}

function thermal(t: number): [number, number, number] {
  const stops: [number, number, number, number][] = [
    [0, 20, 40, 120],
    [0.25, 30, 150, 190],
    [0.5, 40, 160, 90],
    [0.72, 230, 180, 40],
    [0.88, 220, 70, 40],
    [1, 255, 244, 230],
  ];
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const span = upper[0] - lower[0] || 1;
  const f = (t - lower[0]) / span;
  return [
    Math.round(lower[1] + (upper[1] - lower[1]) * f),
    Math.round(lower[2] + (upper[2] - lower[2]) * f),
    Math.round(lower[3] + (upper[3] - lower[3]) * f),
  ];
}

function groupStats(shots: { x: number; y: number; score: number; arrow: number }[]) {
  if (!shots.length) return { center: "—", sigma: "—", size: "—", arrows: [] as { n: number; avg: string; nShots: number; size: string }[] };
  const mx = shots.reduce((s, p) => s + p.x, 0) / shots.length;
  const my = shots.reduce((s, p) => s + p.y, 0) / shots.length;
  const sigma = Math.sqrt(shots.reduce((s, p) => s + (p.x - mx) ** 2 + (p.y - my) ** 2, 0) / shots.length);
  let size = 0;
  for (const a of shots) for (const b of shots) size = Math.max(size, Math.hypot(a.x - b.x, a.y - b.y));
  const clock = clockOf(mx, my);
  const by = new Map<number, typeof shots>();
  for (const shot of shots) {
    const list = by.get(shot.arrow) ?? [];
    list.push(shot);
    by.set(shot.arrow, list);
  }
  const arrows = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([arrow, list]) => {
    let span = 0;
    for (const a of list) for (const b of list) span = Math.max(span, Math.hypot(a.x - b.x, a.y - b.y));
    const avg = list.reduce((s, p) => s + p.score, 0) / list.length;
    return { n: arrow + 1, avg: avg.toFixed(2), nShots: list.length, size: span.toFixed(2) };
  });
  return { center: clock, sigma: sigma.toFixed(3), size: size.toFixed(3), arrows };
}

function clockOf(x: number, y: number) {
  const deg = (Math.atan2(x, -y) * 180) / Math.PI;
  const hour = Math.round(((deg + 360) % 360) / 30) % 12 || 12;
  const radius = Math.hypot(x, y);
  return `ore ${hour} · ${Math.round(radius * 100)}%`;
}

function spotOf(face: Face, shot: Point, index: number) {
  const miss = Boolean(shot.miss) || shot.score === 0;
  if (shot.nx != null && shot.ny != null) {
    const hit = scoreAtRadius(face, Math.hypot(shot.nx, shot.ny));
    const same = miss ? hit.miss : shot.isX ? hit.isX : !hit.miss && hit.score === shot.score;
    if (same || shot.score == null) return { x: shot.nx, y: shot.ny };
  }
  if (shot.score == null) return null;
  const spot = ringPoint(face, shot.score, Boolean(shot.isX), miss, index);
  return { x: spot.nx, y: spot.ny };
}
