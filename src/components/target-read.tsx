import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { scoreAtRadius, type Face } from "@/lib/arcieri/scoring";
import {
  RECT_SIZE,
  calibFromTaps,
  estimateDistance,
  faceToRect,
  groupOf,
  readPhoto,
  readVideoArrivals,
  rectToFace,
  rectify,
  toFace,
  toImage,
  type Calib,
  type Pix,
} from "@/lib/arcieri/target-vision";
import { MediaPick } from "@/components/media-pick";

type Hit = { nx: number; ny: number; score: number; isX: boolean; miss: boolean; t?: number; kind?: string; tail?: { x: number; y: number } | null };
type Apply = (hits: { nx: number; ny: number; score: number; isX: boolean; miss: boolean }[]) => void;

const SIZES = [40, 60, 80, 122];

/**
 * Lettura del bersaglio da foto (anche dall'album) o da video a telefono fermo.
 * Due viste: la foto con gli anelli trovati sopra, e il bersaglio raddrizzato dove si correggono i punti.
 */
export function TargetRead({ face, onApply, known = [] }: { face: Face; onApply: Apply; known?: { x: number; y: number }[] }) {
  const [mode, setMode] = useState<"foto" | "video">("foto");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [calib, setCalib] = useState<Calib | null>(null);
  const [pix, setPix] = useState<Pix | null>(null);
  const [rect, setRect] = useState<Pix | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [facePx, setFacePx] = useState(0);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<"foto" | "dritta">("foto");
  const [taps, setTaps] = useState<{ x: number; y: number }[] | null>(null);
  const [note, setNote] = useState("");
  const [applied, setApplied] = useState(false);
  const [ignoreKnown, setIgnoreKnown] = useState(false);
  const [faceCm, setFaceCm] = useState(40);
  const [progress, setProgress] = useState<number | null>(null);
  const cancel = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoCanvas = useRef<HTMLCanvasElement>(null);
  const rectCanvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ index: number; moved: boolean; x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("aa-face-cm"));
      if (SIZES.includes(saved)) setFaceCm(saved);
    } catch {
      /* niente */
    }
  }, []);

  function pickSize(cm: number) {
    setFaceCm(cm);
    try {
      localStorage.setItem("aa-face-cm", String(cm));
    } catch {
      /* niente */
    }
  }

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const scored = (nx: number, ny: number): Hit => {
    const s = scoreAtRadius(face, Math.max(0, Math.hypot(nx, ny) - 0.012));
    return { nx, ny, score: s.score, isX: s.isX, miss: s.miss };
  };

  function runPhoto(img: HTMLImageElement, forced?: Calib | null) {
    const res = readPhoto(img, img.naturalWidth, img.naturalHeight, face, { calib: forced ?? null, known: ignoreKnown ? known : [] });
    setCalib(res.calib);
    setPix(res.pix);
    setRect(res.rect);
    setFacePx(res.facePx);
    setDims({ w: img.naturalWidth, h: img.naturalHeight });
    setHits(res.hits.map((h) => ({ nx: h.nx, ny: h.ny, score: h.score, isX: h.isX, miss: h.miss, kind: h.kind, tail: h.tailPx != null && res.calib && res.pix ? toFace(res.calib, (h.tailPx ?? 0) * res.pix.w, (h.tailPy ?? 0) * res.pix.h) : null })));
    setApplied(false);
    if (!res.found) setNote(res.note);
    else setNote(res.hits.length ? `${res.hits.length} frecce stimate. Controlla sul bersaglio raddrizzato: trascina un punto per spostarlo, toccalo per toglierlo, tocca un punto vuoto per aggiungere.` : "Anelli trovati, frecce non abbastanza nette: tocca il bersaglio raddrizzato dove sono entrate.");
  }

  function onPhoto(file: File) {
    setMode("foto");
    setTaps(null);
    const local = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setUrl(local);
      runPhoto(img);
      setView("foto");
    };
    img.src = local;
  }

  async function onVideo(file: File) {
    setMode("video");
    setTaps(null);
    setImage(null);
    const local = URL.createObjectURL(file);
    setUrl(local);
    setHits([]);
    setNote("Leggo il video…");
    const video = videoRef.current;
    if (!video) return;
    video.src = local;
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1) resolve();
      else video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    });
    try {
      await video.play();
      video.pause();
    } catch {
      /* alcuni telefoni non vogliono: va bene lo stesso */
    }
    cancel.current = false;
    setProgress(0);
    const res = await readVideoArrivals(video, face, {
      cancelled: () => cancel.current,
      onProgress: (k) => setProgress(k),
    });
    setProgress(null);
    setCalib(res.calib);
    setPix(res.first);
    setDims({ w: video.videoWidth, h: video.videoHeight });
    if (res.calib && res.first) {
      setRect(rectify(res.first, res.calib));
    }
    setHits(res.arrivals.map((a) => ({ nx: a.hit.nx, ny: a.hit.ny, score: a.hit.score, isX: a.hit.isX, miss: a.hit.miss, t: a.t, kind: a.hit.kind })));
    setApplied(false);
    setView("dritta");
    if (!res.calib) setNote("Non trovo il bersaglio nel primo fotogramma. Inquadralo tutto, con la faccia ben visibile.");
    else setNote(res.arrivals.length ? `${res.arrivals.length} frecce arrivate, in ordine di tempo. Correggi pure sul bersaglio raddrizzato.` : "Nessuna freccia nuova trovata. Il telefono deve restare fermo per tutto il video.");
  }

  // --- disegno: foto con gli anelli trovati sopra ---
  useEffect(() => {
    const canvas = photoCanvas.current;
    if (!canvas || view !== "foto") return;
    const source: CanvasImageSource | null = image ?? (mode === "video" ? videoRef.current : null);
    if (!source || !dims.w) return;
    const W = 900;
    const H = Math.round((W * dims.h) / dims.w);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(source, 0, 0, W, H);
    const sx = pix ? W / pix.w : 1;
    const sy = pix ? H / pix.h : 1;
    if (calib && pix) {
      for (const ring of face.rings) {
        ctx.beginPath();
        for (let k = 0; k <= 72; k += 1) {
          const a = (k / 72) * Math.PI * 2;
          const p = toImage(calib, Math.cos(a) * ring.outer, Math.sin(a) * ring.outer);
          if (k) ctx.lineTo(p.x * sx, p.y * sy);
          else ctx.moveTo(p.x * sx, p.y * sy);
        }
        ctx.strokeStyle = "rgba(126,200,227,0.55)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      hits.forEach((hit, index) => {
        const p = toImage(calib, hit.nx, hit.ny);
        if (hit.tail) {
          const q = toImage(calib, hit.tail.x, hit.tail.y);
          ctx.beginPath();
          ctx.moveTo(p.x * sx, p.y * sy);
          ctx.lineTo(q.x * sx, q.y * sy);
          ctx.strokeStyle = "rgba(230,179,37,0.7)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        mark(ctx, p.x * sx, p.y * sy, index, hit, 13);
      });
    }
    if (taps) {
      taps.forEach((t, i) => {
        ctx.beginPath();
        ctx.arc(t.x * sx, t.y * sy, 10, 0, Math.PI * 2);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText(String(i + 1), t.x * sx + 12, t.y * sy - 8);
      });
    }
  }, [image, calib, pix, hits, view, taps, dims, face, mode]);

  // --- disegno: bersaglio raddrizzato ---
  const group = useMemo(() => groupOf(hits.filter((h) => !h.miss).map((h) => ({ x: h.nx, y: h.ny }))), [hits]);
  useEffect(() => {
    const canvas = rectCanvas.current;
    if (!canvas || view !== "dritta") return;
    const S = 720;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const k = S / RECT_SIZE;
    ctx.fillStyle = "#0f1a14";
    ctx.fillRect(0, 0, S, S);
    if (rect) {
      const tmp = document.createElement("canvas");
      tmp.width = RECT_SIZE;
      tmp.height = RECT_SIZE;
      const tctx = tmp.getContext("2d");
      if (tctx) {
        const data = tctx.createImageData(RECT_SIZE, RECT_SIZE);
        data.data.set(rect.data);
        tctx.putImageData(data, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(tmp, 0, 0, S, S);
      }
    }
    const c = faceToRect(0, 0);
    for (const ring of face.rings) {
      const e = faceToRect(ring.outer, 0);
      ctx.beginPath();
      ctx.arc(c.i * k, c.j * k, (e.i - c.i) * k, 0, Math.PI * 2);
      ctx.strokeStyle = rect ? "rgba(126,200,227,0.5)" : ring.fill;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (group && group.n >= 3) {
      ctx.beginPath();
      group.hull.forEach((p, i) => {
        const q = faceToRect(p.x, p.y);
        if (i) ctx.lineTo(q.i * k, q.j * k);
        else ctx.moveTo(q.i * k, q.j * k);
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(224,122,47,0.14)";
      ctx.fill();
      ctx.strokeStyle = "#e07a2f";
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      const g = faceToRect(group.cx, group.cy);
      ctx.strokeStyle = "#e07a2f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(g.i * k - 14, g.j * k);
      ctx.lineTo(g.i * k + 14, g.j * k);
      ctx.moveTo(g.i * k, g.j * k - 14);
      ctx.lineTo(g.i * k, g.j * k + 14);
      ctx.stroke();
    }
    hits.forEach((hit, index) => {
      const p = faceToRect(hit.nx, hit.ny);
      mark(ctx, p.i * k, p.j * k, index, hit, 14);
    });
  }, [rect, hits, view, group, face]);

  // --- tocchi ---
  function pointOf(event: RPointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { u: (event.clientX - box.left) / box.width, v: (event.clientY - box.top) / box.height, box };
  }

  function faceAt(u: number, v: number) {
    if (view === "dritta") return rectToFace(u * (RECT_SIZE - 1), v * (RECT_SIZE - 1));
    if (!calib || !pix) return null;
    return toFace(calib, u * pix.w, v * pix.h);
  }

  function screenOf(hit: Hit, box: DOMRect) {
    if (view === "dritta") {
      const p = faceToRect(hit.nx, hit.ny);
      return { x: (p.i / (RECT_SIZE - 1)) * box.width, y: (p.j / (RECT_SIZE - 1)) * box.height };
    }
    if (!calib || !pix) return { x: -999, y: -999 };
    const p = toImage(calib, hit.nx, hit.ny);
    return { x: (p.x / pix.w) * box.width, y: (p.y / pix.h) * box.height };
  }

  function down(event: RPointerEvent<HTMLCanvasElement>) {
    const { u, v, box } = pointOf(event);
    if (taps && view === "foto" && pix) {
      const next = [...taps, { x: u * pix.w, y: v * pix.h }];
      if (next.length === 4) {
        const manual = calibFromTaps(next);
        setTaps(null);
        if (manual && image) runPhoto(image, manual);
        else setNote("Calibrazione non riuscita: tocca il bordo esterno in alto, a destra, in basso e a sinistra.");
      } else setTaps(next);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const index = hits.findIndex((hit) => {
      const s = screenOf(hit, box);
      return Math.hypot(s.x - u * box.width, s.y - v * box.height) < 22;
    });
    drag.current = { index, moved: false, x: event.clientX, y: event.clientY };
  }

  function move(event: RPointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    if (!d || d.index < 0) return;
    if (!d.moved && Math.hypot(event.clientX - d.x, event.clientY - d.y) < 6) return;
    d.moved = true;
    const { u, v } = pointOf(event);
    const f = faceAt(u, v);
    if (!f) return;
    setApplied(false);
    setHits((list) => list.map((hit, i) => (i === d.index ? { ...hit, ...scored(f.x, f.y), tail: null } : hit)));
  }

  function up(event: RPointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    setApplied(false);
    if (d.index >= 0) {
      setHits((list) => list.filter((_, i) => i !== d.index));
      return;
    }
    const { u, v } = pointOf(event);
    const f = faceAt(u, v);
    if (!f || Math.hypot(f.x, f.y) > 1.15) return;
    setHits((list) => (list.length >= 24 ? list : [...list, scored(f.x, f.y)]));
  }

  const total = hits.reduce((s, h) => s + h.score, 0);
  const distance = estimateDistance(facePx, faceCm, dims.w, dims.h);
  const cm = (u: number) => (u * faceCm) / 2;
  const has = Boolean(url);

  return (
    <div className="grid gap-2 border-t border-line pt-3">
      <p className="text-sm font-semibold">Leggi il bersaglio da foto o video</p>
      <p className="text-xs text-muted">Foto: scattala adesso o prendila dall'album. Video: telefono fermo (appoggiato o sul cavalletto) mentre tiri, e trovo ogni freccia nell'ordine in cui arriva.</p>
      <MediaPick kind="image" onFile={onPhoto} />
      <MediaPick kind="video" onFile={(file) => void onVideo(file)} shootLabel="🎥 Video del bersaglio" albumLabel="🎞️ Video dalla galleria" />
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={ignoreKnown} onChange={(e) => setIgnoreKnown(e.target.checked)} />
        Ignora le frecce già segnate (se nella foto ci sono ancora quelle di prima)
      </label>
      <video ref={videoRef} className="hidden" playsInline muted preload="auto" />
      {progress != null ? (
        <div className="grid gap-1 text-xs">
          <span>Guardo il video… {Math.round(progress * 100)}%</span>
          <div className="h-1.5 rounded-full bg-line/30"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${progress * 100}%` }} /></div>
          <button type="button" onClick={() => { cancel.current = true; }} className="min-h-9 w-fit rounded-full border border-line px-3">Ferma</button>
        </div>
      ) : null}

      {has && (calib || image) ? (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setView("foto"); setTaps(null); }} className={`min-h-10 rounded-full px-3 text-sm ${view === "foto" ? "bg-primary text-primary-fg" : "border border-line"}`}>Foto</button>
            <button type="button" disabled={!calib} onClick={() => { setView("dritta"); setTaps(null); }} className={`min-h-10 rounded-full px-3 text-sm disabled:opacity-50 ${view === "dritta" ? "bg-primary text-primary-fg" : "border border-line"}`}>Bersaglio raddrizzato</button>
            {image ? (
              <button type="button" onClick={() => { setView("foto"); setTaps([]); setNote("Tocca il bordo esterno della faccia: in alto, a destra, in basso, a sinistra."); }} className={`min-h-10 rounded-full px-3 text-sm ${taps ? "bg-accent text-accent-fg" : "border border-line"}`}>📐 Calibra con 4 tocchi</button>
            ) : null}
          </div>
          {view === "foto" ? (
            <canvas ref={photoCanvas} className="w-full touch-none rounded-xl" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }} />
          ) : (
            <canvas ref={rectCanvas} className="mx-auto aspect-square w-full max-w-md touch-none rounded-xl" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }} />
          )}
        </>
      ) : null}
      {note ? <p className="text-sm">{note}</p> : null}

      {has ? (
        <div className="grid gap-2 rounded-xl border border-line p-3 text-sm">
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
            Faccia:
            {SIZES.map((size) => (
              <button key={size} type="button" onClick={() => pickSize(size)} className={`min-h-8 rounded-full px-2 ${faceCm === size ? "bg-accent text-accent-fg" : "border border-line"}`}>{size} cm</button>
            ))}
          </div>
          {hits.length ? (
            <>
              <p className="tabular-nums">
                <span className="font-semibold">{total}</span> punti · {hits.map((h) => (h.miss ? "M" : h.isX ? "X" : h.score)).join(" ")}
              </p>
              {hits.some((h) => h.t != null) ? (
                <p className="text-xs text-muted">Arrivi: {hits.map((h, i) => `${i + 1}) ${h.t != null ? `${h.t.toFixed(1)} s` : "a mano"}`).join(" · ")}</p>
              ) : null}
              {group && group.n >= 2 ? (
                <p className="text-xs text-muted">
                  Gruppo: diametro {cm(group.diameter).toFixed(1)} cm, dispersione media {cm(group.sigma).toFixed(1)} cm, centro {clock(group.cx, group.cy)} a {cm(Math.hypot(group.cx, group.cy)).toFixed(1)} cm dal centro.
                </p>
              ) : null}
            </>
          ) : null}
          {distance ? (
            <p className="text-xs text-muted">📏 Distanza stimata dalla foto: circa {distance.toFixed(1)} m (faccia da {faceCm} cm, foto senza zoom: con lo zoom il conto non vale).</p>
          ) : null}
        </div>
      ) : null}

      {hits.length ? (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button type="button" disabled={applied} className="min-h-11 rounded-full bg-primary px-3 text-sm font-semibold text-primary-fg disabled:opacity-60" onClick={() => { onApply(hits.map(({ nx, ny, score, isX, miss }) => ({ nx, ny, score, isX, miss }))); setApplied(true); }}>
            {applied ? "Frecce aggiunte" : `Metti ${hits.length} frecce nella volée`}
          </button>
          <button type="button" className="min-h-11 rounded-full border border-line px-3 text-sm" onClick={() => { setHits([]); setApplied(false); }}>Svuota</button>
        </div>
      ) : null}
    </div>
  );
}

function mark(ctx: CanvasRenderingContext2D, x: number, y: number, index: number, hit: Hit, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20,24,28,0.35)";
  ctx.fill();
  ctx.strokeStyle = hit.kind === "foro" ? "#c084fc" : "#e6b325";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  const label = `${index + 1}·${hit.miss ? "M" : hit.isX ? "X" : hit.score}`;
  ctx.font = "bold 22px sans-serif";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#14181c";
  ctx.strokeText(label, x + r + 3, y - r + 2);
  ctx.fillStyle = "#fff";
  ctx.fillText(label, x + r + 3, y - r + 2);
}

function clock(x: number, y: number) {
  const deg = (Math.atan2(x, -y) * 180) / Math.PI;
  const hour = Math.round(((deg + 360) % 360) / 30) % 12 || 12;
  return `a ore ${hour}`;
}
