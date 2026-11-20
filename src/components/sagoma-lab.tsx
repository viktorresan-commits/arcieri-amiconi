import { useEffect, useMemo, useRef, useState } from "react";
import { TargetGL } from "@/components/target-gl";
import { animalByLabel } from "@/lib/arcieri/sagome";
import { faceById } from "@/lib/arcieri/scoring";
import { type Picture } from "@/components/target-3d";

type SagomaShot = { score: number; miss?: boolean; nx: number | null; ny: number | null; end?: number };

/**
 * Sagome 3D come il padiglione: mappa termica sopra l'animale e vista 3D animata con le frecce
 * che arrivano. Va bene sia per la sintesi della gara (bersaglio riassuntivo) sia per ogni piazzola.
 */
export function SagomaLab({ animal, shots, title, initial = "mappa" }: { animal: string; shots: SagomaShot[]; title?: string; initial?: "mappa" | "tre" }) {
  const face = animalByLabel(animal);
  const [view, setView] = useState<"mappa" | "tre">(initial);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let gone = false;
    const image = new Image();
    image.onload = () => {
      if (!gone) setImg(image);
    };
    image.src = face.src;
    return () => {
      gone = true;
    };
  }, [face.src]);

  const placed = shots.filter((s): s is SagomaShot & { nx: number; ny: number } => s.nx != null && s.ny != null);
  const picture: Picture | null = useMemo(() => {
    if (!img) return null;
    const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
    const max = 1.1;
    return aspect >= 1 ? { img, halfW: max, halfH: max / aspect } : { img, halfW: max * aspect, halfH: max };
  }, [img]);
  const shots3d = picture ? placed.map((s) => ({ x: s.nx * picture.halfW, y: s.ny * picture.halfH, end: s.end, score: s.score, miss: s.miss })) : [];

  const total = shots.reduce((sum, s) => sum + (s.miss ? 0 : s.score), 0);
  const counts = new Map<number, number>();
  for (const s of shots) counts.set(s.miss ? 0 : s.score, (counts.get(s.miss ? 0 : s.score) ?? 0) + 1);
  const spot = shots.filter((s) => !s.miss && s.score >= 8).length;

  return (
    <div className="grid gap-2">
      {title ? <p className="text-sm font-semibold">{title}</p> : null}
      <div className="flex gap-2">
        <button type="button" onClick={() => setView("mappa")} className={`min-h-10 rounded-full px-3 text-sm ${view === "mappa" ? "bg-primary text-primary-fg" : "border border-line"}`}>Mappa termica</button>
        <button type="button" onClick={() => setView("tre")} className={`min-h-10 rounded-full px-3 text-sm ${view === "tre" ? "bg-primary text-primary-fg" : "border border-line"}`}>Vista 3D</button>
      </div>
      {view === "mappa" ? <SagomaHeat img={img} shots={placed} /> : picture ? <TargetGL face={faceById("sagoma11")} shots={shots3d} picture={picture} /> : <p className="text-sm text-muted">Carico la sagoma…</p>}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat k="Frecce" v={String(shots.length)} />
        <Stat k="Punti" v={String(total)} />
        <Stat k="Nello spot" v={shots.length ? `${Math.round((spot / shots.length) * 100)}%` : "—"} />
      </div>
      {shots.length ? (
        <div className="flex flex-wrap gap-1.5">
          {[...counts.entries()].sort((a, b) => b[0] - a[0]).map(([score, n]) => (
            <span key={score} className="rounded-full border border-line px-2.5 py-1 text-xs tabular-nums">
              <b style={{ color: score >= 10 ? "#e6b325" : score >= 8 ? "#3ee08f" : score > 0 ? "#e07a2f" : "#d15c56" }}>{score === 0 ? "M" : score}</b> × {n}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-line px-2 py-2">
      <p className="text-[11px] text-muted">{k}</p>
      <p className="font-display text-xl leading-none tabular-nums">{v}</p>
    </div>
  );
}

function SagomaHeat({ img, shots }: { img: HTMLImageElement | null; shots: { nx: number; ny: number; score: number; miss?: boolean }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !img) return;
    const W = 720;
    const H = Math.round((W * img.naturalHeight) / Math.max(1, img.naturalWidth));
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    bg.addColorStop(0, "#1b2a22");
    bg.addColorStop(1, "#0b120e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    if (shots.length) {
      // densità su una griglia piccola, poi colori dal blu al bianco
      const gw = 96;
      const gh = Math.max(8, Math.round((gw * H) / W));
      const dens = new Float32Array(gw * gh);
      const sigma = 0.045;
      for (const s of shots) {
        const px = ((s.nx + 1) / 2) * gw;
        const py = ((s.ny + 1) / 2) * gh;
        const r = sigma * gw * 3;
        for (let y = Math.max(0, Math.floor(py - r)); y < Math.min(gh, Math.ceil(py + r)); y += 1) {
          for (let x = Math.max(0, Math.floor(px - r)); x < Math.min(gw, Math.ceil(px + r)); x += 1) {
            const dx = (x + 0.5 - px) / (sigma * gw);
            const dy = ((y + 0.5 - py) / (sigma * gw));
            dens[y * gw + x] += Math.exp(-(dx * dx + dy * dy) / 2);
          }
        }
      }
      const top = Math.max(...dens) || 1;
      const layer = document.createElement("canvas");
      layer.width = gw;
      layer.height = gh;
      const lc = layer.getContext("2d");
      if (lc) {
        const data = lc.createImageData(gw, gh);
        const stops: [number, number, number][] = [[40, 90, 220], [40, 200, 220], [120, 220, 90], [250, 210, 40], [240, 90, 40], [255, 245, 235]];
        for (let i = 0; i < gw * gh; i += 1) {
          const v = dens[i] / top;
          if (v < 0.04) continue;
          const t = Math.min(0.999, v) * (stops.length - 1);
          const k = Math.floor(t);
          const f = t - k;
          for (let c = 0; c < 3; c += 1) data.data[i * 4 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f;
          data.data[i * 4 + 3] = Math.round(Math.min(1, v * 1.4) * 200);
        }
        lc.putImageData(data, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(layer, 0, 0, W, H);
      }
      for (const s of shots) {
        const x = ((s.nx + 1) / 2) * W;
        const y = ((s.ny + 1) / 2) * H;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = s.miss || s.score === 0 ? "#d64545" : s.score >= 8 ? "#f4f1ea" : "#e07a2f";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#14181c";
        ctx.stroke();
      }
    }
  }, [img, shots]);
  return <canvas ref={ref} className="w-full rounded-xl border border-line" />;
}
