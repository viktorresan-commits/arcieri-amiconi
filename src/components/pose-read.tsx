import { useEffect, useMemo, useRef, useState } from "react";
import { MediaPick } from "@/components/media-pick";
import { saveFile } from "@/lib/arcieri/native";

/**
 * Analisi del gesto da foto o video (anche dalla galleria).
 * Il video si vede davvero, con lo scheletro sopra, la barra per scorrere,
 * il fotogramma avanti/indietro e la velocità. "Analizza tutto" passa il video
 * a passi regolari, trova la trazione piena e il rilascio e fa il grafico
 * degli angoli. Sono stime da una ripresa 2D, non un giudizio.
 */

type Landmark = { x: number; y: number; visibility?: number };
type Hand = "destro" | "mancino";
type Metrics = { draw: number; bow: number; shoulder: number; trunk: number; line: number; bowSh: number; drawSh: number; stance: number };
type Sample = { t: number; lm: Landmark[] | null; m: Metrics | null };
type Part = { label: string; value: number };
type Shot = {
  holdFrom: number;
  holdTo: number;
  release: number | null;
  at: Metrics;
  jitter: number;
  follow: number | null;
  score: number;
  parts: Part[];
  notes: string[];
};
type Summary = Shot;
type Analysis = { shots: Shot[]; spread: { draw: number; bow: number; hold: number } | null };

const LINKS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32], [27, 29], [28, 30],
];
const JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type Marker = {
  detect: (image: CanvasImageSource) => { landmarks?: Landmark[][] };
  detectForVideo: (video: CanvasImageSource, ts: number) => { landmarks?: Landmark[][] };
};

let engines: { IMAGE?: Promise<Marker>; VIDEO?: Promise<Marker> } = {};

async function engine(mode: "IMAGE" | "VIDEO"): Promise<Marker> {
  if (!engines[mode]) {
    engines[mode] = (async () => {
      const vision = await new Function("url", "return import(url)")(`${VISION}/+esm`);
      const files = await vision.FilesetResolver.forVisionTasks(`${VISION}/wasm`);
      const make = (delegate: "GPU" | "CPU") =>
        vision.PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL, delegate },
          runningMode: mode,
          numPoses: 1,
        }) as Promise<Marker>;
      try {
        return await make("GPU");
      } catch {
        return await make("CPU");
      }
    })();
    engines[mode]!.catch(() => {
      engines = { ...engines, [mode]: undefined };
    });
  }
  return engines[mode]!;
}

export function PoseRead() {
  const box = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const [hand, setHandState] = useState<Hand>("destro");
  const handRef = useRef(hand);
  handRef.current = hand;
  const [kind, setKind] = useState<"none" | "photo" | "video">("none");
  const [src, setSrc] = useState("");
  const [size, setSize] = useState({ w: 9, h: 16 });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState<Metrics | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [showPose, setShowPose] = useState(true);
  const showRef = useRef(showPose);
  showRef.current = showPose;
  const [samples, setSamples] = useState<Sample[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const cancel = useRef(false);
  const lastLm = useRef<Landmark[] | null>(null);
  const tsRef = useRef(0);
  const busyDetect = useRef(false);
  const scanning = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("aa-hand");
      if (saved === "left") setHandState("mancino");
    } catch {
      /* niente */
    }
  }, []);

  function setHand(next: Hand) {
    setHandState(next);
    try {
      localStorage.setItem("aa-hand", next === "mancino" ? "left" : "right");
    } catch {
      /* niente */
    }
  }

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const analysis = useMemo(() => analyzeShots(samples, hand), [samples, hand]);
  const [shotIndex, setShotIndex] = useState(0);
  const summary: Summary | null = analysis.shots[Math.min(shotIndex, analysis.shots.length - 1)] ?? null;
  const smoothRef = useRef<{ lm: Landmark[] | null; t: number }>({ lm: null, t: -1 });
  const recRef = useRef<{ rec: MediaRecorder; canvas: HTMLCanvasElement; chunks: Blob[] } | null>(null);
  const [recording, setRecording] = useState(false);

  // se il riquadro cambia misura (rotazione del telefono) ridisegna lo scheletro
  useEffect(() => {
    const holder = box.current;
    if (!holder) return;
    const ro = new ResizeObserver(() => paintOverlay(lastLm.current));
    ro.observe(holder);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, src]);

  // ridisegna se cambia mano o si accende/spegne lo scheletro
  useEffect(() => {
    paintOverlay(lastLm.current);
    if (lastLm.current) setNow(metricsOf(lastLm.current, hand));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand, showPose, size]);

  function paintOverlay(lm: Landmark[] | null) {
    const canvas = overlay.current;
    const holder = box.current;
    if (!canvas || !holder) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(holder.clientWidth * dpr));
    const h = Math.max(1, Math.round(holder.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!lm || !showRef.current) return;
    drawPose(ctx, w, h, lm, handRef.current);
  }

  // Rilevamento dal vivo mentre il video scorre o quando ti fermi su un fotogramma.
  async function detectFrame() {
    const video = videoRef.current;
    if (!video || kind !== "video" || busyDetect.current || scanning.current) return;
    if (video.readyState < 2) return;
    busyDetect.current = true;
    try {
      const marker = await engine("VIDEO");
      tsRef.current = Math.max(tsRef.current + 1, performance.now());
      const found = marker.detectForVideo(video, tsRef.current);
      const rawLm = found.landmarks?.[0] ?? null;
      const prev = smoothRef.current;
      const near = prev.t >= 0 && Math.abs(video.currentTime - prev.t) < 0.25;
      const lm = rawLm ? smoothLm(near ? prev.lm : null, rawLm) : null;
      smoothRef.current = { lm, t: video.currentTime };
      lastLm.current = lm;
      paintOverlay(lm);
      setNow(lm ? metricsOf(lm, handRef.current) : null);
      const rec = recRef.current;
      if (rec) {
        const ctx = rec.canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, rec.canvas.width, rec.canvas.height);
          if (lm) drawPose(ctx, rec.canvas.width, rec.canvas.height, lm, handRef.current);
        }
      }
    } catch {
      /* il fotogramma dopo riprova */
    } finally {
      busyDetect.current = false;
    }
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video || kind !== "video") return;
    let stop = false;
    let handle = 0;
    const withFrame = "requestVideoFrameCallback" in video;
    const tick = () => {
      if (stop) return;
      setTime(video.currentTime);
      if (!video.paused) void detectFrame();
      handle = withFrame
        ? (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => number }).requestVideoFrameCallback(tick)
        : requestAnimationFrame(tick);
    };
    tick();
    const onSeeked = () => {
      setTime(video.currentTime);
      if (!scanning.current) void detectFrame();
    };
    const onMeta = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setSize({ w: video.videoWidth || 9, h: video.videoHeight || 16 });
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      if (!scanning.current) void detectFrame();
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("loadeddata", onSeeked);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      stop = true;
      if (withFrame) (video as HTMLVideoElement & { cancelVideoFrameCallback: (h: number) => void }).cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("loadeddata", onSeeked);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, src]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate, src]);

  async function onPhoto(file: File) {
    cancel.current = true;
    setError("");
    setSamples([]);
    setKind("photo");
    setNow(null);
    lastLm.current = null;
    const url = URL.createObjectURL(file);
    setSrc(url);
    const image = new Image();
    image.onload = async () => {
      setSize({ w: image.naturalWidth, h: image.naturalHeight });
      setBusy("Carico il modello del corpo…");
      try {
        const marker = await engine("IMAGE");
        const found = marker.detect(image);
        const lm = found.landmarks?.[0] ?? null;
        lastLm.current = lm;
        requestAnimationFrame(() => paintOverlay(lm));
        setNow(lm ? metricsOf(lm, handRef.current) : null);
        if (!lm) setError("Non vedo un corpo intero. Inquadra dalla testa ai piedi.");
      } catch {
        setError("Non riesco a caricare il modello del corpo. Controlla la rete e riprova.");
      } finally {
        setBusy("");
      }
    };
    image.src = url;
  }

  async function onVideo(file: File) {
    cancel.current = true;
    setError("");
    setSamples([]);
    setNow(null);
    lastLm.current = null;
    setTime(0);
    setDuration(0);
    setKind("video");
    setSrc(URL.createObjectURL(file));
    setBusy("Carico il modello del corpo…");
    try {
      await engine("VIDEO");
    } catch {
      setError("Non riesco a caricare il modello del corpo. Controlla la rete e riprova.");
    } finally {
      setBusy("");
    }
  }

  function seek(t: number) {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = Math.max(0, Math.min(duration || video.duration || 0, t));
    setTime(video.currentTime);
  }

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.ended || video.currentTime >= (duration || video.duration) - 0.05) video.currentTime = 0;
      void video.play();
    } else video.pause();
  }

  async function scanAll() {
    const video = videoRef.current;
    if (!video || !duration) return;
    cancel.current = false;
    scanning.current = true;
    video.pause();
    setProgress(0);
    setError("");
    try {
      const marker = await engine("VIDEO");
      const step = Math.max(1 / 15, duration / 160);
      const out: Sample[] = [];
      for (let t = 0; t <= duration + 1e-6; t += step) {
        if (cancel.current) break;
        await seekTo(video, Math.min(t, Math.max(0, duration - 0.02)));
        tsRef.current = Math.max(tsRef.current + 1, performance.now());
        let lm: Landmark[] | null = null;
        try {
          lm = marker.detectForVideo(video, tsRef.current).landmarks?.[0] ?? null;
        } catch {
          lm = null;
        }
        const prevLm = out.length ? out[out.length - 1].lm : null;
        if (lm) lm = smoothLm(prevLm, lm);
        out.push({ t: video.currentTime, lm, m: lm ? metricsOf(lm, handRef.current) : null });
        lastLm.current = lm;
        paintOverlay(lm);
        setTime(video.currentTime);
        setProgress(Math.min(1, t / duration));
      }
      if (!cancel.current) {
        setSamples(out);
        setShotIndex(0);
        const found = analyzeShots(out, handRef.current).shots[0];
        if (found) await seekTo(video, (found.holdFrom + found.holdTo) / 2);
        else setError("Non trovo una trazione piena chiara. Prova un video con tutto il corpo inquadrato, da davanti o di lato.");
      }
    } catch {
      setError("Analisi interrotta: il modello del corpo non risponde.");
    } finally {
      scanning.current = false;
      setProgress(null);
      void detectFrame();
    }
  }

  function exportCsv() {
    const head = "tempo_s;corda_gradi;arco_gradi;spalle_gradi;busto_gradi;spalla_arco_gradi;spalla_corda_gradi;piedi_su_spalle";
    const rows = samples.map((s) => (s.m ? [s.t, s.m.draw, s.m.bow, s.m.shoulder, s.m.trunk, s.m.bowSh, s.m.drawSh, s.m.stance] : [s.t, "", "", "", "", "", "", ""]).map((v) => (typeof v === "number" ? v.toFixed(2).replace(".", ",") : v)).join(";"));
    void saveFile(new Blob([[head, ...rows].join("\n")], { type: "text/csv" }), "analisi-gesto.csv");
  }

  async function recordAnnotated() {
    const video = videoRef.current;
    if (!video || recRef.current || typeof MediaRecorder === "undefined") {
      if (typeof MediaRecorder === "undefined") setError("Questo telefono non sa registrare video dal browser.");
      return;
    }
    const canvas = document.createElement("canvas");
    const k = Math.min(1, 720 / Math.max(size.w, size.h));
    canvas.width = Math.round(size.w * k);
    canvas.height = Math.round(size.h * k);
    const stream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(30);
    const type = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
      void saveFile(blob, `gesto-con-scheletro.${(rec.mimeType || "").includes("mp4") ? "mp4" : "webm"}`);
      recRef.current = null;
      setRecording(false);
    };
    recRef.current = { rec, canvas, chunks };
    setRecording(true);
    video.pause();
    video.playbackRate = 1;
    setRate(1);
    await seekTo(video, 0);
    rec.start(250);
    const stop = () => {
      video.removeEventListener("ended", stop);
      if (rec.state !== "inactive") rec.stop();
    };
    video.addEventListener("ended", stop);
    void video.play();
  }

  function snapshot() {
    const canvas = document.createElement("canvas");
    const media = kind === "video" ? videoRef.current : imageRef.current;
    if (!media) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(media, 0, 0, size.w, size.h);
    if (lastLm.current) drawPose(ctx, size.w, size.h, lastLm.current, hand);
    canvas.toBlob((blob) => {
      if (!blob) return;
      void saveFile(blob, `gesto-${fmt(time).replace(":", "m")}s.png`);
    }, "image/png");
  }

  const ratio = size.w / size.h;
  const frameStep = 1 / 30;

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">Carica un video o una foto del tiro, anche dalla galleria. Vedi lo scheletro sopra il video, gli angoli delle braccia e, con «Analizza tutto», la trazione piena e il rilascio.</p>
      <div className="flex gap-2">
        {(["destro", "mancino"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setHand(item)} className={`min-h-11 rounded-full px-3 text-sm ${hand === item ? "bg-primary text-primary-fg" : "border border-line"}`}>
            {item === "destro" ? "Arciere destro" : "Arciere mancino"}
          </button>
        ))}
      </div>
      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Video del gesto</p>
        <MediaPick kind="video" onFile={(file) => void onVideo(file)} />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Oppure una foto</p>
        <MediaPick kind="image" onFile={(file) => void onPhoto(file)} />
      </div>
      {busy ? <p className="text-sm">{busy}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {kind !== "none" && src ? (
        <div className="grid gap-2">
          <div
            ref={box}
            className="relative mx-auto overflow-hidden rounded-2xl bg-black"
            style={{ aspectRatio: `${size.w} / ${size.h}`, width: `min(100%, calc(70vh * ${ratio.toFixed(4)}))` }}
          >
            {kind === "video" ? (
              <video
                ref={videoRef}
                src={src}
                playsInline
                muted
                preload="auto"
                className="absolute inset-0 h-full w-full object-contain"
                onClick={toggle}
              />
            ) : (
              <img ref={imageRef} src={src} alt="Foto del gesto" className="absolute inset-0 h-full w-full object-contain" />
            )}
            <canvas ref={overlay} className="pointer-events-none absolute inset-0 h-full w-full" />
            <button
              type="button"
              onClick={() => setShowPose((v) => !v)}
              className="absolute right-2 top-2 min-h-9 rounded-full bg-[#14181c]/75 px-3 text-xs font-semibold text-[#f4f1ea]"
            >
              {showPose ? "👁 Scheletro" : "Scheletro spento"}
            </button>
            {progress != null ? (
              <div className="absolute inset-x-0 bottom-0 bg-[#14181c]/80 p-2 text-xs text-[#f4f1ea]">
                Analizzo il video… {Math.round(progress * 100)}%
                <div className="mt-1 h-1.5 rounded-full bg-white/20"><div className="h-1.5 rounded-full bg-[#e6b325]" style={{ width: `${progress * 100}%` }} /></div>
              </div>
            ) : null}
          </div>

          {kind === "video" ? (
            <div className="grid gap-2">
              <div className="flex items-center gap-2 text-xs tabular-nums text-muted">
                <span className="w-12">{fmt(time)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.01}
                  value={Math.min(time, duration || 0)}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="h-11 flex-1 accent-[var(--primary)]"
                  aria-label="Posizione nel video"
                />
                <span className="w-12 text-right">{fmt(duration)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => seek(time - frameStep)} className="min-h-11 min-w-11 rounded-full border border-line px-3 text-sm" aria-label="Fotogramma indietro">⏮</button>
                <button type="button" onClick={toggle} className="min-h-11 min-w-20 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg">{playing ? "⏸ Pausa" : "▶ Play"}</button>
                <button type="button" onClick={() => seek(time + frameStep)} className="min-h-11 min-w-11 rounded-full border border-line px-3 text-sm" aria-label="Fotogramma avanti">⏭</button>
                {[0.25, 0.5, 1].map((value) => (
                  <button key={value} type="button" onClick={() => setRate(value)} className={`min-h-11 rounded-full px-3 text-sm ${rate === value ? "bg-accent text-accent-fg" : "border border-line"}`}>{value === 1 ? "1×" : `${value}×`}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {progress != null ? (
                  <button type="button" onClick={() => { cancel.current = true; }} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold">Ferma l'analisi</button>
                ) : (
                  <button type="button" disabled={!duration || Boolean(busy)} onClick={() => void scanAll()} className="min-h-11 rounded-xl bg-accent px-3 text-sm font-semibold text-accent-fg disabled:opacity-60">🔍 Analizza tutto il video</button>
                )}
                <button type="button" onClick={snapshot} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold">⬇ Salva fotogramma</button>
                <button type="button" disabled={recording || progress != null} onClick={() => void recordAnnotated()} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold disabled:opacity-60">{recording ? "⏺ Registro… (fino alla fine)" : "⏺ Salva video con scheletro"}</button>
                <button type="button" disabled={!samples.length} onClick={exportCsv} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold disabled:opacity-60">⬇ Dati CSV</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={snapshot} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold">⬇ Salva l'immagine con lo scheletro</button>
          )}

          <Readout m={now} />

          {kind === "video" && samples.length ? (
            <Timeline samples={samples} shots={analysis.shots} time={time} duration={duration} onSeek={seek} />
          ) : null}

          {analysis.shots.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {analysis.shots.map((shot, i) => (
                <button key={shot.holdFrom} type="button" onClick={() => { setShotIndex(i); seek((shot.holdFrom + shot.holdTo) / 2); }} className={`min-h-11 shrink-0 rounded-full px-3 text-sm ${i === shotIndex ? "bg-primary text-primary-fg" : "border border-line"}`}>
                  Tiro {i + 1} · {fmt(shot.holdFrom)} · {shot.score}/100
                </button>
              ))}
            </div>
          ) : null}
          {summary && kind === "video" ? <SummaryCard summary={summary} onSeek={seek} /> : null}
          {analysis.spread ? (
            <div className="rounded-xl border border-line bg-elev p-3 text-sm">
              <p className="font-semibold">Ripetibilità su {analysis.shots.length} tiri</p>
              <p className="text-xs text-muted">Variazione da un tiro all'altro: corda ±{analysis.spread.draw.toFixed(1)}°, arco ±{analysis.spread.bow.toFixed(1)}°, tenuta ±{analysis.spread.hold.toFixed(1)} s. Più sono piccoli, più il gesto è sempre uguale.</p>
            </div>
          ) : null}
          {kind === "photo" && now ? <Notes lines={notesFor(now)} /> : null}
          {kind === "video" && !samples.length && now && progress == null ? <Notes lines={notesFor(now)} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Readout({ m }: { m: Metrics | null }) {
  const cells: [string, string, string][] = m
    ? [
        ["Linea corda", `${m.line.toFixed(0)}°`, "#c084fc"],
        ["Braccio arco", `${m.bow.toFixed(0)}°`, "#e07a2f"],
        ["Spalle", `${m.shoulder >= 0 ? "+" : ""}${m.shoulder.toFixed(1)}°`, "#e6b325"],
        ["Busto", `${m.trunk >= 0 ? "+" : ""}${m.trunk.toFixed(1)}°`, "#7ec8e3"],
      ]
    : [
        ["Linea corda", "—", "#c084fc"],
        ["Braccio arco", "—", "#e07a2f"],
        ["Spalle", "—", "#e6b325"],
        ["Busto", "—", "#7ec8e3"],
      ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cells.map(([k, v, color]) => (
        <div key={k} className="rounded-xl border border-line px-3 py-2" style={{ borderLeft: `4px solid ${color}` }}>
          <p className="text-xs text-muted">{k}</p>
          <p className="font-display text-2xl leading-none tabular-nums">{v}</p>
        </div>
      ))}
    </div>
  );
}

function Notes({ lines }: { lines: string[] }) {
  return (
    <ul className="grid gap-1 rounded-xl border border-line bg-elev p-3 text-sm">
      {lines.map((line) => <li key={line}>• {line}</li>)}
    </ul>
  );
}

function SummaryCard({ summary, onSeek }: { summary: Summary; onSeek: (t: number) => void }) {
  const hold = summary.holdTo - summary.holdFrom;
  return (
    <div className="grid gap-2 rounded-xl border border-line bg-elev p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Lettura del tiro</p>
        <p className="font-display text-2xl tabular-nums" style={{ color: summary.score >= 70 ? "#3d9b74" : summary.score >= 50 ? "#e6b325" : "#d15c56" }}>{summary.score}/100 <span className="text-xs text-muted">{summary.score >= 70 ? "buono" : "da sistemare"}</span></p>
      </div>
      <div className="grid gap-1">
        {summary.parts.map((part) => (
          <div key={part.label} className="grid grid-cols-[1fr_5rem] items-center gap-2 text-xs">
            <span>{part.label}</span>
            <span className="h-2 rounded-full bg-line/30"><span className="block h-2 rounded-full" style={{ width: `${Math.round(part.value * 100)}%`, background: part.value >= 0.7 ? "#3d9b74" : part.value >= 0.4 ? "#e6b325" : "#d15c56" }} /></span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <button type="button" onClick={() => onSeek(summary.holdFrom)} className="rounded-lg border border-line p-2 text-left">
          <span className="block text-xs text-muted">Trazione piena</span>
          <span className="font-semibold tabular-nums">{fmt(summary.holdFrom)}</span>
        </button>
        <div className="rounded-lg border border-line p-2">
          <span className="block text-xs text-muted">Tenuta</span>
          <span className="font-semibold tabular-nums">{hold.toFixed(1)} s</span>
        </div>
        <button type="button" disabled={summary.release == null} onClick={() => summary.release != null && onSeek(summary.release)} className="rounded-lg border border-line p-2 text-left disabled:opacity-60">
          <span className="block text-xs text-muted">Rilascio</span>
          <span className="font-semibold tabular-nums">{summary.release != null ? fmt(summary.release) : "—"}</span>
        </button>
      </div>
      <p className="text-xs text-muted">In tenuta: gomito della corda {summary.at.draw.toFixed(0)}° (linea con la freccia {summary.at.line.toFixed(0)}°), arco {summary.at.bow.toFixed(0)}°, spalla dell'arco {summary.at.bowSh.toFixed(0)}°, spalla della corda {summary.at.drawSh.toFixed(0)}°, spalle {summary.at.shoulder.toFixed(1)}°, busto {summary.at.trunk.toFixed(1)}°{summary.at.stance ? `, piedi ${summary.at.stance.toFixed(1)}× le spalle` : ""}. Movimento della mano dell'arco: {summary.jitter.toFixed(1)}% della larghezza spalle.</p>
      <Notes lines={summary.notes} />
      <p className="text-xs text-muted">Stime da una ripresa 2D: l'angolo cambia con il punto di vista. Confronta video girati sempre dallo stesso posto.</p>
    </div>
  );
}

function Timeline({ samples, shots, time, duration, onSeek }: { samples: Sample[]; shots: Shot[]; time: number; duration: number; onSeek: (t: number) => void }) {
  const held = useRef(false);
  const W = 600;
  const H = 170;
  const pad = { l: 34, r: 8, t: 10, b: 20 };
  const lo = 60;
  const hi = 190;
  const x = (t: number) => pad.l + (t / Math.max(duration, 0.01)) * (W - pad.l - pad.r);
  const y = (a: number) => pad.t + ((hi - Math.max(lo, Math.min(hi, a))) / (hi - lo)) * (H - pad.t - pad.b);
  const path = (pick: (m: Metrics) => number) => {
    let d = "";
    let pen = false;
    for (const s of samples) {
      if (!s.m) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${x(s.t).toFixed(1)} ${y(pick(s.m)).toFixed(1)} `;
      pen = true;
    }
    return d;
  };
  const go = (e: { currentTarget: SVGSVGElement; clientX: number }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    onSeek(Math.max(0, Math.min(duration, ((px - pad.l) / (W - pad.l - pad.r)) * duration)));
  };
  return (
    <div className="grid gap-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none rounded-xl border border-line bg-elev"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          held.current = true;
          go(e);
        }}
        onPointerMove={(e) => {
          if (held.current) go(e);
        }}
        onPointerUp={() => {
          held.current = false;
        }}
        onPointerCancel={() => {
          held.current = false;
        }}
      >
        {shots.map((shot) => <rect key={`h${shot.holdFrom}`} x={x(shot.holdFrom)} y={pad.t} width={Math.max(2, x(shot.holdTo) - x(shot.holdFrom))} height={H - pad.t - pad.b} fill="rgba(230,179,37,0.18)" />)}
        {[90, 120, 150, 180].map((a) => (
          <g key={a}>
            <line x1={pad.l} x2={W - pad.r} y1={y(a)} y2={y(a)} stroke="var(--line)" strokeDasharray="3 4" />
            <text x={4} y={y(a) + 4} fontSize="11" fill="var(--muted)">{a}°</text>
          </g>
        ))}
        <path d={path((m) => m.bow)} fill="none" stroke="#e07a2f" strokeWidth="2.2" />
        <path d={path((m) => m.draw)} fill="none" stroke="#c084fc" strokeWidth="2.2" />
        {shots.map((shot) => (shot.release != null ? <line key={`r${shot.release}`} x1={x(shot.release)} x2={x(shot.release)} y1={pad.t} y2={H - pad.b} stroke="#d15c56" strokeWidth="2" /> : null))}
        <line x1={x(time)} x2={x(time)} y1={pad.t} y2={H - pad.b} stroke="var(--fg)" strokeWidth="1.5" />
        <text x={pad.l} y={H - 5} fontSize="11" fill="var(--muted)">0:00</text>
        <text x={W - pad.r - 30} y={H - 5} fontSize="11" fill="var(--muted)">{fmt(duration)}</text>
      </svg>
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        <span><span className="mr-1 inline-block h-2 w-3 rounded" style={{ background: "#c084fc" }} />Braccio corda</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded" style={{ background: "#e07a2f" }} />Braccio arco</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded" style={{ background: "rgba(230,179,37,0.6)" }} />Trazione piena</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded" style={{ background: "#d15c56" }} />Rilascio</span>
        <span>Tocca il grafico per andare a quel momento.</span>
      </div>
    </div>
  );
}

/* ---------- calcoli ---------- */

function sides(hand: Hand) {
  // MediaPipe: 11/13/15 = lato sinistro della persona. Il destro tiene l'arco con la sinistra.
  return hand === "destro" ? { bow: [11, 13, 15], draw: [12, 14, 16] } : { bow: [12, 14, 16], draw: [11, 13, 15] };
}

function metricsOf(lm: Landmark[], hand: Hand): Metrics | null {
  if (lm.length < 29) return null;
  const { bow, draw } = sides(hand);
  const p = (i: number) => lm[i];
  const seen = [11, 12, 13, 14, 15, 16].every((i) => (p(i).visibility ?? 1) > 0.3);
  if (!seen) return null;
  const drawAngle = joint(p(draw[0]), p(draw[1]), p(draw[2]));
  const bowAngle = joint(p(bow[0]), p(bow[1]), p(bow[2]));
  const sh = Math.atan2(p(12).y - p(11).y, p(12).x - p(11).x) * (180 / Math.PI);
  const shoulder = Math.abs(sh) > 90 ? (sh > 0 ? sh - 180 : sh + 180) : sh;
  const midS = { x: (p(11).x + p(12).x) / 2, y: (p(11).y + p(12).y) / 2 };
  const midH = { x: (p(23).x + p(24).x) / 2, y: (p(23).y + p(24).y) / 2 };
  const trunk = Math.atan2(midS.x - midH.x, midH.y - midS.y) * (180 / Math.PI);
  const line = joint(p(bow[2]), p(draw[2]), p(draw[1]));
  // archery-posture-ai: angolo della spalla (anca-spalla-gomito) e apertura dei piedi
  const hipBow = hand === "destro" ? 23 : 24;
  const hipDraw = hand === "destro" ? 24 : 23;
  const bowSh = joint(p(hipBow), p(bow[0]), p(bow[1]));
  const drawSh = joint(p(hipDraw), p(draw[0]), p(draw[1]));
  const width = Math.hypot(p(11).x - p(12).x, p(11).y - p(12).y) || 1e-3;
  const feet = (p(27).visibility ?? 1) > 0.3 && (p(28).visibility ?? 1) > 0.3 ? Math.hypot(p(27).x - p(28).x, p(27).y - p(28).y) / width : 0;
  return { draw: drawAngle, bow: bowAngle, shoulder: -shoulder, trunk, line, bowSh, drawSh, stance: feet };
}

function notesFor(m: Metrics): string[] {
  const out: string[] = [];
  if (m.bow < 160) out.push("Il braccio dell'arco è piegato. Distendilo senza alzare la spalla.");
  else out.push("Braccio dell'arco disteso.");
  if (m.line < 160) out.push(`Il gomito della corda esce di ${(180 - m.line).toFixed(0)}° dalla linea della freccia: portalo dietro, in linea con la freccia.`);
  else out.push("Gomito della corda in linea con la freccia.");
  if (Math.abs(m.shoulder) > 8) out.push("Una spalla è più alta dell'altra: cerca una linea delle spalle più orizzontale.");
  if (Math.abs(m.trunk) > 8) out.push(`Il busto pende di ${Math.abs(m.trunk).toFixed(0)}° ${m.trunk > 0 ? "verso destra" : "verso sinistra"} nell'immagine: resta più verticale.`);
  return out;
}

const ramp = (v: number, bad: number, good: number) => Math.max(0, Math.min(1, (v - bad) / (good - bad)));

/**
 * Trova i tiri nel video. Come archery-posture-ai: il rilascio è un picco di velocità del polso
 * della corda insieme a un'accelerazione del gomito; prima del rilascio cerco la tenuta.
 */
function analyzeShots(samples: Sample[], hand: Hand): Analysis {
  const valid = samples.filter((s): s is Sample & { m: Metrics; lm: Landmark[] } => Boolean(s.m && s.lm));
  if (valid.length < 6) return { shots: [], spread: null };
  const { bow, draw } = sides(hand);
  const width = (s: { lm: Landmark[] }) => Math.hypot(s.lm[11].x - s.lm[12].x, s.lm[11].y - s.lm[12].y) || 0.1;
  const n = valid.length;
  const ws: number[] = [0];
  const ev: number[] = [0];
  for (let i = 1; i < n; i += 1) {
    const dt = Math.max(1e-3, valid[i].t - valid[i - 1].t);
    const p = valid[i - 1].lm[draw[2]];
    const q = valid[i].lm[draw[2]];
    ws.push(Math.hypot(q.x - p.x, q.y - p.y) / width(valid[i]) / dt);
    ev.push((valid[i].m.draw - valid[i - 1].m.draw) / dt);
  }
  const acc = ev.map((v, i) => (i ? Math.abs(v - ev[i - 1]) : 0));
  const raw = ws.map((v, i) => v * acc[i]);
  const measure = raw.map((_, i) => (raw[Math.max(0, i - 1)] + raw[i] + raw[Math.min(n - 1, i + 1)]) / 3);
  const mean = measure.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(measure.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const thr = mean + 2.2 * sd;
  const peaks: number[] = [];
  let group: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (measure[i] <= thr || ws[i] < 1) continue;
    if (group.length && valid[i].t - valid[group[group.length - 1]].t > 0.2) {
      peaks.push(group.reduce((best, k) => (measure[k] > measure[best] ? k : best), group[0]));
      group = [];
    }
    group.push(i);
  }
  if (group.length) peaks.push(group.reduce((best, k) => (measure[k] > measure[best] ? k : best), group[0]));

  // trazione piena: braccio dell'arco alzato all'altezza della spalla, mano della corda al viso,
  // mani ben aperte e quasi ferme
  const full = valid.map((s, i) => {
    const w = width(s);
    const sb = s.lm[bow[0]];
    const sd = s.lm[draw[0]];
    const bw = s.lm[bow[2]];
    const dw = s.lm[draw[2]];
    const bowUp = Math.abs(bw.y - sb.y) < 0.7 * w;
    const handUp = dw.y > sd.y - 1.0 * w && dw.y < sd.y + 0.45 * w;
    const apart = Math.hypot(bw.x - dw.x, bw.y - dw.y) > 1.3 * w;
    const still = ws[i] < 0.9;
    return bowUp && handUp && apart && still && s.m.bow >= 140;
  });
  const runs: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= n; i += 1) {
    const ok = i < n && (full[i] || (start >= 0 && i + 1 < n && full[i + 1] && full[i - 1])); // tollera un buco
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      if (valid[i - 1].t - valid[start].t >= 0.4) runs.push([start, i - 1]);
      start = -1;
    }
  }
  // una tenuta vera arriva dopo una trazione: prima le mani erano vicine (aggancio della corda)
  const spreadOf = (s: { lm: Landmark[] }) => Math.hypot(s.lm[bow[2]].x - s.lm[draw[2]].x, s.lm[bow[2]].y - s.lm[draw[2]].y) / width(s);
  const drawn = runs.filter(([from, to], r) => {
    // guardo solo dopo la tenuta precedente: l'accompagnamento dopo un rilascio non è un nuovo tiro
    const prevEnd = r > 0 ? valid[runs[r - 1][1]].t : -Infinity;
    const before = valid.filter((s) => s.t < valid[from].t && s.t >= valid[from].t - 3 && s.t > prevEnd);
    // nessuno incocca e tende di nuovo in meno di un secondo e mezzo
    if (valid[from].t - prevEnd < 1.5) return false;
    if (!before.length) return r === 0;
    const pre = Math.min(...before.map(spreadOf));
    const during = valid.slice(from, to + 1).reduce((a, s) => a + spreadOf(s), 0) / (to - from + 1);
    return during - pre > 0.4;
  });

  const shotFrom = (from: number, to: number, releaseIdx: number | null): Shot | null => {
    if (valid[to].t - valid[from].t < 0.3) return null;
    const hold = valid.slice(from, to + 1);
    const avg = (pick: (m: Metrics) => number) => hold.reduce((a, s) => a + pick(s.m), 0) / hold.length;
    const at: Metrics = { draw: avg((m) => m.draw), bow: avg((m) => m.bow), shoulder: avg((m) => m.shoulder), trunk: avg((m) => m.trunk), line: avg((m) => m.line), bowSh: avg((m) => m.bowSh), drawSh: avg((m) => m.drawSh), stance: avg((m) => m.stance) };
    const w = hold.reduce((a, s) => a + width(s), 0) / hold.length;
    const bx = hold.map((s) => s.lm[bow[2]].x);
    const by = hold.map((s) => s.lm[bow[2]].y);
    const jitter = (Math.sqrt(variance(bx) + variance(by)) / w) * 100;
    // accompagnamento: quanto cade la mano dell'arco nel mezzo secondo dopo il rilascio
    let follow: number | null = null;
    if (releaseIdx != null) {
      const r0 = valid[releaseIdx];
      const after = valid.filter((s) => s.t > r0.t && s.t <= r0.t + 0.6);
      if (after.length) follow = (Math.max(...after.map((s) => s.lm[bow[2]].y)) - r0.lm[bow[2]].y) / w;
    }
    const holdTime = valid[to].t - valid[from].t;
    const parts: Part[] = [
      { label: "Braccio dell'arco disteso", value: ramp(at.bow, 150, 170) },
      { label: "Gomito della corda in linea con la freccia", value: ramp(at.line, 150, 172) },
      { label: "Spalle in piano", value: 1 - ramp(Math.abs(at.shoulder), 3, 12) },
      { label: "Busto verticale", value: 1 - ramp(Math.abs(at.trunk), 3, 12) },
      { label: "Mira ferma", value: 1 - ramp(jitter, 2, 8) },
      { label: "Tenuta giusta", value: holdTime < 1.5 ? ramp(holdTime, 0.4, 1.5) : 1 - ramp(holdTime, 5, 9) },
    ];
    if (follow != null) parts.push({ label: "Accompagnamento dopo il rilascio", value: 1 - ramp(follow, 0.06, 0.3) });
    const score = Math.round((parts.reduce((a, p) => a + p.value, 0) / parts.length) * 100);
    const notes = notesFor(at);
    if (holdTime < 0.8) notes.push(`Tenuta breve (${holdTime.toFixed(1)} s): stabilizza la mira prima di sganciare.`);
    else if (holdTime > 6) notes.push(`Tenuta lunga (${holdTime.toFixed(1)} s): oltre i 5-6 secondi la mira di solito peggiora.`);
    else notes.push(`Tenuta di ${holdTime.toFixed(1)} s, in un intervallo normale.`);
    notes.push(jitter > 6 ? "La mano dell'arco si muove parecchio in tenuta: lavora sulla spinta costante verso il bersaglio." : "Mano dell'arco ferma durante la tenuta.");
    if (follow != null) notes.push(follow > 0.2 ? "Dopo il rilascio l'arco cade subito: tieni il braccio su per un attimo (accompagnamento)." : "Buon accompagnamento: il braccio dell'arco resta su dopo il rilascio.");
    if (at.stance > 0 && (at.stance < 0.8 || at.stance > 2.2)) notes.push(`Piedi ${at.stance < 0.8 ? "troppo stretti" : "molto larghi"} (${at.stance.toFixed(1)} volte le spalle): cerca circa la larghezza delle spalle.`);
    return { holdFrom: valid[from].t, holdTo: valid[to].t, release: releaseIdx != null ? valid[releaseIdx].t : null, at, jitter, follow, score, parts, notes };
  };

  const shots: Shot[] = [];
  for (const [from, to] of drawn) {
    // il rilascio: il picco (velocità polso × accelerazione gomito) subito dopo la tenuta,
    // altrimenti il primo scatto veloce del polso della corda
    const endT = valid[to].t;
    let rel: number | null = peaks.find((k) => valid[k].t >= endT - 0.1 && valid[k].t <= endT + 0.5) ?? null;
    if (rel == null) {
      for (let i = to + 1; i < n && valid[i].t <= endT + 0.5; i += 1) if (ws[i] > 1.5) { rel = i; break; }
    }
    const shot = shotFrom(from, to, rel);
    if (shot) shots.push(shot);
  }
  shots.sort((a, b) => a.holdFrom - b.holdFrom);
  const dev = (list: number[]) => Math.sqrt(variance(list));
  const spread = shots.length >= 2 ? { draw: dev(shots.map((s) => s.at.draw)), bow: dev(shots.map((s) => s.at.bow)), hold: dev(shots.map((s) => s.holdTo - s.holdFrom)) } : null;
  return { shots, spread };
}

/** EMA dei punti del corpo (archery-posture-ai, alfa 0,6): toglie il tremolio del modello. */
function smoothLm(prev: Landmark[] | null, next: Landmark[], alpha = 0.6): Landmark[] {
  if (!prev || prev.length !== next.length) return next;
  return next.map((p, i) => ({ x: alpha * p.x + (1 - alpha) * prev[i].x, y: alpha * p.y + (1 - alpha) * prev[i].y, visibility: p.visibility }));
}

function drawPose(ctx: CanvasRenderingContext2D, w: number, h: number, lm: Landmark[], hand: Hand) {
  const s = Math.max(1, Math.min(w, h) / 360);
  const at = (i: number) => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 });
  const { bow, draw } = sides(hand);
  ctx.lineCap = "round";
  // linea della freccia: mano dell'arco → mano della corda
  const bw = at(bow[2]);
  const dw = at(draw[2]);
  if (bw.v > 0.3 && dw.v > 0.3) {
    ctx.setLineDash([8 * s, 6 * s]);
    ctx.strokeStyle = "rgba(244,241,234,0.85)";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(bw.x, bw.y);
    ctx.lineTo(dw.x, dw.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.strokeStyle = "#4aa3ff";
  ctx.lineWidth = 3 * s;
  for (const [a, b] of LINKS) {
    if (!lm[a] || !lm[b]) continue;
    const p = at(a);
    const q = at(b);
    if (p.v < 0.35 || q.v < 0.35) continue;
    if ((a === 11 && b === 12) || (a === 12 && b === 11)) continue;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
  // linea delle spalle
  const l = at(11);
  const r = at(12);
  ctx.strokeStyle = "#e6b325";
  ctx.lineWidth = 3.5 * s;
  ctx.beginPath();
  ctx.moveTo(l.x, l.y);
  ctx.lineTo(r.x, r.y);
  ctx.stroke();
  for (const i of JOINTS) {
    if (!lm[i]) continue;
    const p = at(i);
    if (p.v < 0.35) continue;
    ctx.beginPath();
    ctx.fillStyle = i === draw[1] || i === bow[1] ? "#ef4444" : "#4aa3ff";
    ctx.arc(p.x, p.y, 4.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  const m = metricsOf(lm, hand);
  const label = (text: string, x: number, y: number, color: string) => {
    ctx.font = `600 ${Math.round(13 * s)}px system-ui, sans-serif`;
    const tw = ctx.measureText(text).width;
    const px = Math.min(w - tw - 10 * s, Math.max(4 * s, x));
    const py = Math.min(h - 6 * s, Math.max(18 * s, y));
    ctx.fillStyle = "rgba(20,24,28,0.72)";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(px - 5 * s, py - 14 * s, tw + 10 * s, 19 * s, 6 * s);
    else ctx.rect(px - 5 * s, py - 14 * s, tw + 10 * s, 19 * s);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, px, py);
  };
  const ring = (i: number, color: string) => {
    const p = at(i);
    if (p.v < 0.35) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14 * s, 0, Math.PI * 2);
    ctx.stroke();
  };
  ring(draw[1], "#c084fc");
  ring(bow[1], "#e07a2f");
  if (m) {
    const de = at(draw[1]);
    const be = at(bow[1]);
    label(`Corda ${m.draw.toFixed(0)}°`, de.x + 16 * s, de.y - 6 * s, "#d8b4fe");
    label(`Arco ${m.bow.toFixed(0)}°`, be.x + 16 * s, be.y + 22 * s, "#fdba74");
    label(`Spalle ${Math.abs(m.shoulder).toFixed(1)}°`, (l.x + r.x) / 2 - 30 * s, Math.min(l.y, r.y) - 12 * s, "#fde68a");
  }
}

function joint(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  const ab = Math.hypot(a.x - b.x, a.y - b.y);
  const cb = Math.hypot(c.x - b.x, c.y - b.y);
  if (ab < 1e-6 || cb < 1e-6) return 0;
  const cos = ((a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y)) / (ab * cb);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

function avg(list: number[]) {
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
}

function variance(list: number[]) {
  const m = avg(list);
  return avg(list.map((v) => (v - m) ** 2));
}

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function seekTo(video: HTMLVideoElement, t: number) {
  return new Promise<void>((resolve) => {
    if (Math.abs(video.currentTime - t) < 1e-3 && video.readyState >= 2) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", finish);
      resolve();
    };
    video.addEventListener("seeked", finish);
    window.setTimeout(finish, 1500);
    video.currentTime = t;
  });
}
