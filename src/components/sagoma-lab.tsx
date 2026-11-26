import { useEffect, useMemo, useRef, useState } from "react";
import { TargetGL } from "@/components/target-gl";
import { animalByLabel } from "@/lib/arcieri/sagome";
import { faceById } from "@/lib/arcieri/scoring";
import { type Picture } from "@/components/target-3d";
import { foamSkin } from "@/lib/arcieri/sagoma-mesh";

type SagomaShot = { score: number; miss?: boolean; nx: number | null; ny: number | null; end?: number };

/**
 * Sagome 3D come il padiglione: mappa termica sopra l'animale e vista 3D animata con le frecce
 * che arrivano. Va bene sia per la sintesi della gara (bersaglio riassuntivo) sia per ogni piazzola.
 */
/** colore della schiuma dipinta di ogni animale */
const TONES: Record<string, string> = {
  orso: "#5b4132", stambecco: "#8c7556", "pantera-seduta": "#3a3836", "volpe-sdraiata": "#b4692f", avvoltoio: "#5c4a3a",
  "lince-seduta": "#a8875a", "capra-montes": "#9a8566", gufo: "#7d6244", "pecora-sdraiata": "#cfc6b4", "lince-piedi": "#a8875a",
  multiplo: "#7a6a55", capriolo: "#9b6a3e", giavellina: "#4c4038", "cinghiale-solengo": "#6e5a48", cinghiale: "#6e5a48",
  "gallo-cedrone": "#3d3b37", puma: "#b08a5c", "cucciolo-orso": "#6b4b33", castoro: "#6a4a30", "gatto-selvatico": "#8a7a60",
  sciacallo: "#a27a50", volpe: "#b4692f", lupo: "#7a7268", cervo: "#93683e", lince: "#a8875a", pantera: "#3a3836",
};

/** i tiri della sintesi (bersaglio riassuntivo) nelle coordinate della visuale tonda: 1 = bordo del nero */
const toRing = (s: { nx: number; ny: number }) => ({ x: s.nx * 2, y: (s.ny + 0.14) * 2 });

/**
 * Sagome 3D come il padiglione: mappa termica e vista 3D animata con le frecce che arrivano.
 * Gli animali sono in schiuma dipinta e in volume; la sintesi della gara è un battifreccia con la
 * visuale tonda della sagoma (rosso, giallo, blu, nero), in vero 3D.
 */
export function SagomaLab({ animal, shots, title, initial = "mappa" }: { animal: string; shots: SagomaShot[]; title?: string; initial?: "mappa" | "tre" }) {
  const face = animalByLabel(animal);
  const summary = face.id === "sagome-3d";
  const ringFace = faceById("sagoma11");
  const [view, setView] = useState<"mappa" | "tre" | "piana">(initial);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (summary) return;
    let gone = false;
    const image = new Image();
    image.onload = () => {
      if (!gone) setImg(image);
    };
    image.src = face.src;
    return () => {
      gone = true;
    };
  }, [face.src, summary]);

  const placed = shots.filter((s): s is SagomaShot & { nx: number; ny: number } => s.nx != null && s.ny != null);
  const heatKey = placed.map((s) => `${s.nx.toFixed(3)},${s.ny.toFixed(3)},${s.score}`).join(";");
  const skin = useMemo(() => (img && typeof document !== "undefined" ? foamSkin(img, TONES[face.id] ?? "#6b5440", [face.blue, face.yellow, face.red]) : null), [img, face]);
  const picture: Picture | null = useMemo(() => {
    if (!img) return null;
    const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
    const max = 1.1;
    const box = aspect >= 1 ? { halfW: max, halfH: max / aspect } : { halfW: max * aspect, halfH: max };
    return { img, ...box, skin, skinKey: `${face.src}-foam` };
  }, [img, skin, face.src]);
  const heatPicture: Picture | null = useMemo(() => {
    if (!picture || !skin || typeof document === "undefined") return picture;
    const c = document.createElement("canvas");
    paintHeat(c, skin, placed, "volume");
    return { ...picture, skin: c, skinKey: `${face.src}-${heatKey}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picture, skin, heatKey]);
  const ringCanvas = useMemo(() => {
    if (!summary || view !== "mappa" || typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    paintRingFace(c, ringFace.rings, placed.map((s) => ({ ...toRing(s), score: s.score, miss: s.miss })), "volume");
    return { canvas: c, key: `ring-${heatKey}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, view, heatKey]);
  // in 3D al massimo le ultime 90 frecce: con tutta la compagnia il bersaglio diventerebbe un istrice (la termica le conta tutte)
  const recent = placed.slice(-90);
  const shots3d = summary
    ? recent.map((s) => ({ ...toRing(s), end: s.end, score: s.score, miss: s.miss }))
    : picture
      ? recent.map((s) => ({ x: s.nx * picture.halfW, y: s.ny * picture.halfH, end: s.end, score: s.score, miss: s.miss }))
      : [];

  const total = shots.reduce((sum, s) => sum + (s.miss ? 0 : s.score), 0);
  const counts = new Map<number, number>();
  for (const s of shots) counts.set(s.miss ? 0 : s.score, (counts.get(s.miss ? 0 : s.score) ?? 0) + 1);
  const spot = shots.filter((s) => !s.miss && s.score >= 8).length;

  return (
    <div className="grid gap-2">
      {title ? <p className="text-sm font-semibold">{title}</p> : null}
      <div className="flex gap-2">
        <button type="button" onClick={() => setView("mappa")} className={`min-h-10 rounded-full px-3 text-sm ${view === "mappa" ? "bg-primary text-primary-fg" : "border border-line"}`}>Termica 3D</button>
        <button type="button" onClick={() => setView("tre")} className={`min-h-10 rounded-full px-3 text-sm ${view === "tre" ? "bg-primary text-primary-fg" : "border border-line"}`}>Vista 3D</button>
        <button type="button" onClick={() => setView("piana")} className={`min-h-10 rounded-full px-3 text-sm ${view === "piana" ? "bg-primary text-primary-fg" : "border border-line"}`}>Piana</button>
      </div>
      {summary ? (
        view === "piana" ? <RingPlan rings={ringFace.rings} shots={placed.map((s) => ({ ...toRing(s), score: s.score, miss: s.miss }))} /> : <TargetGL face={ringFace} shots={shots3d} faceCanvas={view === "mappa" ? ringCanvas : null} />
      ) : view === "piana" ? (
        <SagomaHeat skin={skin} shots={placed} />
      ) : picture ? (
        <TargetGL face={ringFace} shots={shots3d} picture={view === "mappa" ? heatPicture : picture} />
      ) : (
        <p className="text-sm text-muted">Carico la sagoma…</p>
      )}
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

type HeatShot = { nx: number; ny: number; score: number; miss?: boolean };

const HEAT_STOPS: [number, number, number][] = [[46, 92, 210], [38, 190, 214], [96, 214, 104], [246, 206, 52], [238, 96, 44], [255, 236, 220]];

/** densità morbida dei tiri su una griglia, colorata dal blu al bianco con trasparenza */
function heatLayer(points: { u: number; v: number }[], aspect: number, sigma = 0.04) {
  const gw = 180;
  const gh = Math.max(12, Math.round(gw / Math.max(0.2, aspect)));
  const dens = new Float32Array(gw * gh);
  for (const p of points) {
    const px = p.u * gw;
    const py = p.v * gh;
    const sg = sigma * gw;
    const r = sg * 3;
    for (let y = Math.max(0, Math.floor(py - r)); y < Math.min(gh, Math.ceil(py + r)); y += 1)
      for (let x = Math.max(0, Math.floor(px - r)); x < Math.min(gw, Math.ceil(px + r)); x += 1) {
        const dx = (x + 0.5 - px) / sg;
        const dy = (y + 0.5 - py) / sg;
        dens[y * gw + x] += Math.exp(-(dx * dx + dy * dy) / 2);
      }
  }
  let top = 0;
  for (const v of dens) if (v > top) top = v;
  const layer = document.createElement("canvas");
  layer.width = gw;
  layer.height = gh;
  const lc = layer.getContext("2d");
  if (!lc || !top) return layer;
  const data = lc.createImageData(gw, gh);
  for (let i = 0; i < gw * gh; i += 1) {
    const v = dens[i] / top;
    if (v < 0.025) continue;
    const t = Math.min(0.999, v) * (HEAT_STOPS.length - 1);
    const k = Math.floor(t);
    const f = t - k;
    for (let c = 0; c < 3; c += 1) data.data[i * 4 + c] = HEAT_STOPS[k][c] + (HEAT_STOPS[k + 1][c] - HEAT_STOPS[k][c]) * f;
    data.data[i * 4 + 3] = Math.round(Math.pow(Math.min(1, v * 1.3), 0.7) * 215);
  }
  lc.putImageData(data, 0, 0);
  return layer;
}

function dotsOn(ctx: CanvasRenderingContext2D, pts: { x: number; y: number; score: number; miss?: boolean }[], r: number) {
  for (const s of pts) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = s.miss || s.score === 0 ? "#d64545" : s.score >= 8 ? "#f4f1ea" : "#e07a2f";
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.32);
    ctx.strokeStyle = "#14181c";
    ctx.stroke();
  }
}

/**
 * La pelle in schiuma con la mappa termica dei tiri. "volume": per la sagoma in 3D, la pelle si
 * attenua e il colore resta dentro il contorno; "piana": su fondo scuro, con i punti dei tiri.
 */
function paintHeat(canvas: HTMLCanvasElement, skin: HTMLCanvasElement, shots: HeatShot[], mode: "volume" | "piana") {
  const W = 900;
  const H = Math.round((W * skin.height) / Math.max(1, skin.width));
  const pad = mode === "piana" ? Math.round(W * 0.04) : 0;
  canvas.width = W + pad * 2;
  canvas.height = H + pad * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (mode === "piana") {
    const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, Math.max(W, H) * 0.75);
    grad.addColorStop(0, "#22302a");
    grad.addColorStop(1, "#0c1310");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(skin, pad, pad, W, H);
    ctx.restore();
  } else {
    ctx.drawImage(skin, 0, 0, W, H);
    // la pelle si scurisce un po', così i colori della mappa risaltano
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(10,16,24,0.3)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }
  if (!shots.length) return;
  const layer = heatLayer(shots.map((s) => ({ u: (s.nx + 1) / 2, v: (s.ny + 1) / 2 })), W / H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalCompositeOperation = mode === "piana" ? "source-over" : "source-atop";
  ctx.drawImage(layer, pad, pad, W, H);
  ctx.globalCompositeOperation = "source-over";
  if (mode === "piana") dotsOn(ctx, shots.map((s) => ({ x: pad + ((s.nx + 1) / 2) * W, y: pad + ((s.ny + 1) / 2) * H, score: s.score, miss: s.miss })), W / 110);
}

type RingShot = { x: number; y: number; score: number; miss?: boolean };

/** La visuale tonda della sintesi (anelli veri della sagoma) con la mappa termica; in "piana" con fondo e punti. */
function paintRingFace(canvas: HTMLCanvasElement, rings: { outer: number; fill: string }[], shots: RingShot[], mode: "volume" | "piana") {
  const S = 900;
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // in "piana" la visuale occupa il 70% e intorno c'è posto per i tiri fuori
  const R = mode === "piana" ? S * 0.35 : S / 2;
  const C = S / 2;
  if (mode === "piana") {
    const grad = ctx.createRadialGradient(C, C, 0, C, C, S * 0.7);
    grad.addColorStop(0, "#22302a");
    grad.addColorStop(1, "#0c1310");
    ctx.fillStyle = grad;
  } else ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(0, 0, S, S);
  for (const ring of [...rings].sort((a, b) => b.outer - a.outer)) {
    ctx.fillStyle = ring.fill;
    ctx.beginPath();
    ctx.arc(C, C, ring.outer * R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ring.fill === "#1a1c1e" ? "rgba(244,241,234,0.6)" : "rgba(20,24,28,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (mode === "volume") {
    ctx.fillStyle = "rgba(10,16,24,0.38)";
    ctx.fillRect(0, 0, S, S);
  }
  if (!shots.length) return;
  const span = (S / 2 / R) * 2; // unità della visuale coperte dal quadro
  const layer = heatLayer(shots.map((s) => ({ u: 0.5 + s.x / span, v: 0.5 + s.y / span })), 1, 0.03);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(layer, 0, 0, S, S);
  if (mode === "piana") dotsOn(ctx, shots.map((s) => ({ x: C + s.x * R, y: C + s.y * R, score: s.score, miss: s.miss })), S / 110);
}

function RingPlan({ rings, shots }: { rings: { outer: number; fill: string }[]; shots: RingShot[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintRingFace(ref.current, rings, shots, "piana");
  }, [rings, shots]);
  return <canvas ref={ref} className="aspect-square w-full rounded-xl border border-line" />;
}

function SagomaHeat({ skin, shots }: { skin: HTMLCanvasElement | null; shots: HeatShot[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current && skin) paintHeat(ref.current, skin, shots, "piana");
  }, [skin, shots]);
  return <canvas ref={ref} className="w-full rounded-xl border border-line" />;
}
