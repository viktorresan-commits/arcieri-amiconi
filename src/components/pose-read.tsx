import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { MediaPick } from "@/components/media-pick";
import { saveFile } from "@/lib/arcieri/native";
import {
  PHASE_COLORS,
  PHASE_LABEL,
  analyzeShots,
  cameraDistance,
  detectGear,
  metricsOf,
  notesFor,
  personBox,
  sides,
  smoothLm,
  type Gear,
  type Hand,
  type Landmark,
  type Metrics,
  type Sample,
  type Shot,
} from "@/lib/arcieri/pose-analysis";

/**
 * Analisi del gesto da video o foto (anche dalla galleria), anche a mezzo busto.
 * - modello del corpo a scelta (veloce / preciso / massimo);
 * - riquadro per inquadrare solo l'arciere e zoom automatico che lo segue (gli altri restano fuori);
 * - fasi del tiro: alzata, trazione, ancoraggio, rilascio, accompagnamento, con tempi e sequenza;
 * - freccia e arco cercati vicino alle mani; distanza della ripresa stimata dalle spalle.
 * Sono stime da una ripresa 2D: il punto di vista cambia gli angoli.
 */

type Quality = "lite" | "full" | "heavy";
type Rect = { x: number; y: number; w: number; h: number };

const LINKS: [number, number][] = [
  [11, 13], [13, 15], [12, 14], [14, 16], [15, 19], [16, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];
const JOINTS = [0, 11, 12, 13, 14, 15, 16, 19, 20, 23, 24, 25, 26, 27, 28];
const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17";
const MODELS: Record<Quality, string> = {
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  heavy: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
};
const QUALITY_LABEL: Record<Quality, string> = { lite: "Veloce", full: "Preciso", heavy: "Massimo" };

type Marker = { detect: (image: CanvasImageSource) => { landmarks?: Landmark[][] } };
const engines: Partial<Record<Quality, Promise<Marker>>> = {};

function engine(q: Quality): Promise<Marker> {
  let job = engines[q];
  if (!job) {
    job = (async () => {
      const vision = await new Function("url", "return import(url)")(`${VISION}/+esm`);
      const files = await vision.FilesetResolver.forVisionTasks(`${VISION}/wasm`);
      const make = (delegate: "GPU" | "CPU") =>
        vision.PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODELS[q], delegate },
          runningMode: "IMAGE",
          numPoses: 3,
          minPoseDetectionConfidence: 0.4,
          minPosePresenceConfidence: 0.4,
        }) as Promise<Marker>;
      try {
        return await make("GPU");
      } catch {
        return await make("CPU");
      }
    })();
    engines[q] = job;
    job.catch(() => {
      delete engines[q];
    });
  }
  return job;
}

export function PoseRead() {
  const box = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const work = useRef<HTMLCanvasElement | null>(null);
  const [hand, setHandState] = useState<Hand>("destro");
  const handRef = useRef(hand);
  handRef.current = hand;
  const [quality, setQualityState] = useState<Quality>("full");
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const [kind, setKind] = useState<"none" | "photo" | "video">("none");
  const [src, setSrc] = useState("");
  const [size, setSize] = useState({ w: 9, h: 16 });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState<Metrics | null>(null);
  const [gear, setGear] = useState<Gear | null>(null);
  const gearRef = useRef<Gear | null>(null);
  gearRef.current = gear;
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(0.5);
  const [showPose, setShowPose] = useState(true);
  const showRef = useRef(showPose);
  showRef.current = showPose;
  /** come si vede: video con scheletro, sagoma luminosa su fondo scuro, o sagoma sopra il video */
  const [look, setLook] = useState<"scheletro" | "sagoma" | "mista">("scheletro");
  const lookRef = useRef(look);
  lookRef.current = look;
  const [samples, setSamples] = useState<Sample[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [crop, setCropState] = useState<Rect | null>(null);
  const cropRef = useRef<Rect | null>(null);
  cropRef.current = crop;
  const [cropMode, setCropMode] = useState(false);
  const cropStart = useRef<{ x: number; y: number } | null>(null);
  const draftRef = useRef<Rect | null>(null);
  const [follow, setFollow] = useState(true);
  const followRef = useRef(follow);
  followRef.current = follow;
  const autoBox = useRef<Rect | null>(null);
  const cancel = useRef(false);
  const lastLm = useRef<Landmark[] | null>(null);
  const smoothRef = useRef<{ lm: Landmark[] | null; t: number }>({ lm: null, t: -1 });
  const busyDetect = useRef(false);
  const scanning = useRef(false);
  const recRef = useRef<{ rec: MediaRecorder; canvas: HTMLCanvasElement } | null>(null);
  const [recording, setRecording] = useState(false);
  const [shotIndex, setShotIndex] = useState(0);
  /** parte del video da analizzare e salvare (null = tutto) */
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const span = () => ({ from: range?.from ?? 0, to: range?.to ?? duration });

  useEffect(() => {
    try {
      if (localStorage.getItem("aa-hand") === "left") setHandState("mancino");
      const q = localStorage.getItem("aa-pose-quality");
      if (q === "lite" || q === "full" || q === "heavy") setQualityState(q);
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

  function setQuality(q: Quality) {
    setQualityState(q);
    qualityRef.current = q;
    try {
      localStorage.setItem("aa-pose-quality", q);
    } catch {
      /* niente */
    }
    setBusy("Carico il modello del corpo…");
    engine(q)
      .then(() => {
        setBusy("");
        setSamples([]);
        if (kind === "video") void detectFrame();
        else if (kind === "photo" && imageRef.current) void analyzePhoto(imageRef.current);
      })
      .catch(() => {
        setBusy("");
        setError("Non riesco a caricare il modello del corpo. Controlla la rete e riprova.");
      });
  }

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const analysis = useMemo(() => analyzeShots(samples, hand), [samples, hand]);
  const shot: Shot | null = analysis.shots[Math.min(shotIndex, analysis.shots.length - 1)] ?? null;
  const distance = useMemo(
    () => cameraDistance(samples.length ? samples : now ? [{ t: 0, lm: null, m: now }] : [], size.w, size.h),
    [samples, now, size],
  );

  /* ---------- rilevamento ---------- */

  /** Rileva il corpo nel riquadro scelto (o seguito) e riporta i punti nel fotogramma intero. */
  async function detectOn(source: CanvasImageSource, W: number, H: number): Promise<Landmark[] | null> {
    const marker = await engine(qualityRef.current);
    const region = cropRef.current ?? (followRef.current ? autoBox.current : null) ?? { x: 0, y: 0, w: 1, h: 1 };
    const sx = region.x * W;
    const sy = region.y * H;
    const sw = region.w * W;
    const sh = region.h * H;
    const k = Math.min(2, 960 / Math.max(sw, sh));
    const canvas = work.current ?? (work.current = document.createElement("canvas"));
    canvas.width = Math.max(8, Math.round(sw * k));
    canvas.height = Math.max(8, Math.round(sh * k));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    let poses: Landmark[][] = [];
    try {
      poses = marker.detect(canvas).landmarks ?? [];
    } catch {
      poses = [];
    }
    if (!poses.length) {
      if (!cropRef.current) autoBox.current = null; // perso: la prossima volta guardo tutto il fotogramma
      return null;
    }
    // l'arciere: la figura più grande nel riquadro (gli altri restano fuori)
    const area = (lm: Landmark[]) => {
      const b = personBox(lm, 0);
      return b ? b.w * b.h : 0;
    };
    const chosen = [...poses].sort((a, b) => area(b) - area(a))[0];
    const mapped = chosen.map((p) => ({ x: region.x + p.x * region.w, y: region.y + p.y * region.h, visibility: p.visibility }));
    if (!cropRef.current && followRef.current) autoBox.current = personBox(mapped, 0.45);
    return mapped;
  }

  function paintOverlay(lm: Landmark[] | null, draft?: Rect | null) {
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
    const region = cropRef.current;
    if (region) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, w, h);
      ctx.clearRect(region.x * w, region.y * h, region.w * w, region.h * h);
      ctx.strokeStyle = "#e6b325";
      ctx.setLineDash([10, 6]);
      ctx.lineWidth = 2 * dpr;
      ctx.strokeRect(region.x * w, region.y * h, region.w * w, region.h * h);
      ctx.setLineDash([]);
    }
    if (lookRef.current !== "scheletro") drawSagoma(ctx, w, h, lm, handRef.current, gearRef.current, lookRef.current === "sagoma");
    else if (lm && showRef.current) drawPose(ctx, w, h, lm, handRef.current, gearRef.current);
    if (draft) {
      ctx.strokeStyle = "#e6b325";
      ctx.lineWidth = 3 * dpr;
      ctx.strokeRect(draft.x * w, draft.y * h, draft.w * w, draft.h * h);
    }
  }

  async function detectFrame() {
    const video = videoRef.current;
    if (!video || busyDetect.current || scanning.current || video.readyState < 2) return;
    busyDetect.current = true;
    try {
      const W = video.videoWidth;
      const H = video.videoHeight;
      const raw = await detectOn(video, W, H);
      const prev = smoothRef.current;
      const near = prev.t >= 0 && Math.abs(video.currentTime - prev.t) < 0.25;
      const lm = raw ? smoothLm(near ? prev.lm : null, raw) : null;
      smoothRef.current = { lm, t: video.currentTime };
      lastLm.current = lm;
      const m = lm ? metricsOf(lm, handRef.current, W / H, H) : null;
      // freccia e arco solo da fermo (costa un po' di calcolo)
      const g = lm && video.paused ? safeGear(video, W, H, lm, handRef.current) : null;
      setGear(g);
      gearRef.current = g;
      paintOverlay(lm);
      setNow(m);
    } catch {
      /* il fotogramma dopo riprova */
    } finally {
      busyDetect.current = false;
    }
  }

  useEffect(() => {
    const holder = box.current;
    if (!holder) return;
    const ro = new ResizeObserver(() => paintOverlay(lastLm.current));
    ro.observe(holder);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, src]);

  useEffect(() => {
    paintOverlay(lastLm.current);
    if (lastLm.current) setNow(metricsOf(lastLm.current, hand, size.w / size.h, size.h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand, showPose, size, crop, gear, look]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || kind !== "video") return;
    let stop = false;
    let handle = 0;
    const withFrame = "requestVideoFrameCallback" in video;
    const tick = () => {
      if (stop) return;
      setTime(video.currentTime);
      if (!video.paused && !recRef.current) void detectFrame();
      handle = withFrame
        ? (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => number }).requestVideoFrameCallback(tick)
        : requestAnimationFrame(tick);
    };
    tick();
    const onSeeked = () => {
      setTime(video.currentTime);
      if (!scanning.current && !recRef.current) void detectFrame();
    };
    const onMeta = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setSize({ w: video.videoWidth || 9, h: video.videoHeight || 16 });
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      if (!scanning.current && !recRef.current) void detectFrame();
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

  function resetMedia() {
    cancel.current = true;
    setError("");
    setSamples([]);
    setNow(null);
    setGear(null);
    setCropState(null);
    cropRef.current = null;
    setCropMode(false);
    autoBox.current = null;
    lastLm.current = null;
    smoothRef.current = { lm: null, t: -1 };
    setShotIndex(0);
  }

  async function analyzePhoto(image: HTMLImageElement) {
    setBusy("Cerco il corpo…");
    try {
      const W = image.naturalWidth;
      const H = image.naturalHeight;
      autoBox.current = null;
      let lm = await detectOn(image, W, H);
      // seconda passata con lo zoom sulla persona trovata: più precisa se è lontana
      if (lm && !cropRef.current && followRef.current) lm = (await detectOn(image, W, H)) ?? lm;
      lastLm.current = lm;
      const g = lm ? safeGear(image, W, H, lm, handRef.current) : null;
      setGear(g);
      gearRef.current = g;
      requestAnimationFrame(() => paintOverlay(lm));
      setNow(lm ? metricsOf(lm, handRef.current, W / H, H) : null);
      setError(lm ? "" : "Non vedo una persona. Inquadra l'arciere con il riquadro ✂ e riprova.");
    } catch {
      setError("Non riesco a caricare il modello del corpo. Controlla la rete e riprova.");
    } finally {
      setBusy("");
    }
  }

  function onPhoto(file: File) {
    resetMedia();
    setKind("photo");
    const url = URL.createObjectURL(file);
    setSrc(url);
    const image = new Image();
    image.onload = () => {
      setSize({ w: image.naturalWidth, h: image.naturalHeight });
      void analyzePhoto(image);
    };
    image.src = url;
  }

  async function onVideo(file: File) {
    resetMedia();
    setTime(0);
    setDuration(0);
    setKind("video");
    setSrc(URL.createObjectURL(file));
    setBusy("Carico il modello del corpo…");
    try {
      await engine(qualityRef.current);
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
    if (!video || cropMode) return;
    if (video.paused) {
      if (video.ended || video.currentTime >= (duration || video.duration) - 0.05) video.currentTime = 0;
      void video.play();
    } else video.pause();
  }

  async function scanAll(): Promise<Sample[] | null> {
    const video = videoRef.current;
    if (!video || !duration) return null;
    const { from, to } = span();
    let result: Sample[] | null = null;
    cancel.current = false;
    scanning.current = true;
    video.pause();
    setProgress(0);
    setError("");
    autoBox.current = null;
    try {
      try {
        await video.play();
        video.pause();
      } catch {
        /* va bene */
      }
      const W = video.videoWidth;
      const H = video.videoHeight;
      const step = Math.max(1 / 15, (to - from) / 240);
      const out: Sample[] = [];
      let prev: Landmark[] | null = null;
      for (let t = from; t <= to + 1e-6; t += step) {
        if (cancel.current) break;
        await seekTo(video, Math.min(t, Math.max(0, duration - 0.02)));
        let lm = await detectOn(video, W, H);
        if (lm) lm = smoothLm(prev, lm);
        prev = lm;
        out.push({ t: video.currentTime, lm, m: lm ? metricsOf(lm, handRef.current, W / H, H) : null });
        lastLm.current = lm;
        paintOverlay(lm);
        setTime(video.currentTime);
        setProgress(Math.min(1, (t - from) / Math.max(0.01, to - from)));
      }
      if (!cancel.current) {
        result = out;
        setSamples(out);
        setShotIndex(0);
        const found = analyzeShots(out, handRef.current).shots[0];
        if (found) await seekTo(video, (found.anchorFrom + (found.release ?? found.anchorTo)) / 2);
        else if (!out.some((s) => s.m)) setError("Non vedo l'arciere nel video. Inquadralo con il riquadro ✂ e riprova.");
        else setError("Non trovo un tiro completo (mano della corda al viso e braccio dell'arco alzato). Controlla destro/mancino o inquadra l'arciere con ✂.");
      }
    } catch {
      setError("Analisi interrotta: il modello del corpo non risponde.");
    } finally {
      scanning.current = false;
      setProgress(null);
      void detectFrame();
    }
    return result;
  }

  /* ---------- riquadro ---------- */

  function cropPoint(e: RPointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  }

  function cropDown(e: RPointerEvent<HTMLCanvasElement>) {
    if (!cropMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    cropStart.current = cropPoint(e);
    draftRef.current = null;
  }

  function cropMove(e: RPointerEvent<HTMLCanvasElement>) {
    const a = cropStart.current;
    if (!a) return;
    const b = cropPoint(e);
    const rect = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
    draftRef.current = rect;
    paintOverlay(lastLm.current, rect);
  }

  function applyCrop(rect: Rect | null) {
    setCropState(rect);
    cropRef.current = rect;
    autoBox.current = null;
    smoothRef.current = { lm: null, t: -1 };
    setSamples([]);
    if (kind === "video") void detectFrame();
    else if (imageRef.current) void analyzePhoto(imageRef.current);
  }

  function cropUp() {
    cropStart.current = null;
    const draft = draftRef.current;
    draftRef.current = null;
    if (draft && draft.w > 0.06 && draft.h > 0.06) {
      setCropMode(false);
      applyCrop(draft);
    } else paintOverlay(lastLm.current);
  }

  /* ---------- esporta ---------- */

  function snapshot() {
    const canvas = document.createElement("canvas");
    const media = kind === "video" ? videoRef.current : imageRef.current;
    if (!media) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(media, 0, 0, size.w, size.h);
    if (look !== "scheletro") drawSagoma(ctx, size.w, size.h, lastLm.current, hand, gear, look === "sagoma");
    else if (lastLm.current) drawPose(ctx, size.w, size.h, lastLm.current, hand, gear);
    canvas.toBlob((blob) => {
      if (blob) void saveFile(blob, `gesto-${fmt(time).replace(":", "m")}s.png`);
    }, "image/png");
  }

  function exportCsv() {
    const head = "tempo_s;linea_corda;gomito_corda;braccio_arco;spalle;spalla_arco;spalla_corda;busto;mano_viso_spalle;mani_spalle;freccia_inclinazione";
    const rows = samples.map((s) => {
      const m = s.m;
      const v = m ? [s.t, m.line, m.draw, m.bow, m.shoulder, m.bowSh, m.drawSh, m.trunk ?? "", m.handFace, m.spread, m.arrowTilt] : [s.t];
      return v.map((x) => (typeof x === "number" ? x.toFixed(2).replace(".", ",") : x)).join(";");
    });
    void saveFile(new Blob([[head, ...rows].join("\n")], { type: "text/csv" }), "analisi-gesto.csv");
  }

  async function recordAnnotated() {
    const video = videoRef.current;
    if (!video || recRef.current) return;
    if (typeof MediaRecorder === "undefined") {
      setError("Questo telefono non sa registrare video dal browser.");
      return;
    }
    const { from, to } = span();
    // prima l'analisi (una volta sola): così in registrazione si disegna ogni fotogramma senza aspettare il modello
    let data = samples;
    const covers = data.length > 0 && data[0].t <= from + 0.2 && data[data.length - 1].t >= to - 0.2;
    if (!covers) {
      const fresh = await scanAll();
      if (!fresh) return;
      data = fresh;
    }
    const canvas = document.createElement("canvas");
    const k = Math.min(1, 720 / Math.max(size.w, size.h));
    canvas.width = Math.round(size.w * k);
    canvas.height = Math.round(size.h * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const stream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(30);
    const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 4_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const kind = lookRef.current;
    const name = kind === "scheletro" ? "scheletro" : "sagoma";
    rec.onstop = () => {
      void saveFile(new Blob(chunks, { type: rec.mimeType || "video/webm" }), `gesto-${name}.${(rec.mimeType || "").includes("mp4") ? "mp4" : "webm"}`);
      recRef.current = null;
      setRecording(false);
      setProgress(null);
    };
    recRef.current = { rec, canvas };
    setRecording(true);
    video.pause();
    video.playbackRate = 0.5;
    await seekTo(video, from);
    const paint = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const lm = lmAt(data, video.currentTime);
      if (kind !== "scheletro") drawSagoma(ctx, canvas.width, canvas.height, lm, handRef.current, null, kind === "sagoma");
      else if (lm) drawPose(ctx, canvas.width, canvas.height, lm, handRef.current, null);
    };
    paint();
    rec.start(500);
    let done = false;
    const stop = () => {
      if (done) return;
      done = true;
      video.pause();
      video.playbackRate = rate;
      if (rec.state !== "inactive") rec.stop();
    };
    const withFrame = "requestVideoFrameCallback" in video;
    cancel.current = false;
    const loop = () => {
      if (done) return;
      if (cancel.current) {
        stop();
        return;
      }
      paint();
      setProgress(Math.min(1, (video.currentTime - from) / Math.max(0.01, to - from)));
      if (video.currentTime >= to - 0.01 || video.ended) {
        stop();
        return;
      }
      if (withFrame) (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => number }).requestVideoFrameCallback(loop);
      else requestAnimationFrame(loop);
    };
    video.addEventListener("ended", stop, { once: true });
    try {
      await video.play();
    } catch {
      stop();
      return;
    }
    loop();
  }

  const ratio = size.w / size.h;
  const frameStep = 1 / 30;

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">Video o foto del tiro, anche dalla galleria e anche a mezzo busto. Meglio di fronte all'arciere, da 3–6 metri, con la freccia di traverso nell'inquadratura.</p>
      <div className="flex flex-wrap gap-2">
        {(["destro", "mancino"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setHand(item)} className={`min-h-11 rounded-full px-3 text-sm ${hand === item ? "bg-primary text-primary-fg" : "border border-line"}`}>
            {item === "destro" ? "Arciere destro" : "Arciere mancino"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        Precisione:
        {(["lite", "full", "heavy"] as const).map((q) => (
          <button key={q} type="button" onClick={() => setQuality(q)} className={`min-h-9 rounded-full px-3 ${quality === q ? "bg-accent text-accent-fg" : "border border-line"}`}>{QUALITY_LABEL[q]}</button>
        ))}
        <span>{quality === "heavy" ? "più lento, il più preciso" : quality === "lite" ? "per telefoni lenti" : "consigliato"}</span>
      </div>
      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Video del gesto</p>
        <MediaPick kind="video" onFile={(file) => void onVideo(file)} />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Oppure una foto</p>
        <MediaPick kind="image" onFile={onPhoto} />
      </div>
      {busy ? <p className="text-sm">{busy}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {kind !== "none" && src ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setCropMode((v) => !v); draftRef.current = null; }} className={`min-h-10 rounded-full px-3 text-sm ${cropMode ? "bg-accent text-accent-fg" : "border border-line"}`}>
              ✂ {cropMode ? "Trascina un rettangolo sull'arciere…" : crop ? "Rifai il riquadro" : "Inquadra l'arciere"}
            </button>
            {crop ? (
              <button type="button" onClick={() => applyCrop(null)} className="min-h-10 rounded-full border border-line px-3 text-sm">Togli riquadro</button>
            ) : (
              <label className="flex min-h-10 items-center gap-2 rounded-full border border-line px-3 text-sm">
                <input type="checkbox" checked={follow} onChange={(e) => { setFollow(e.target.checked); followRef.current = e.target.checked; autoBox.current = null; }} /> Zoom che segue l'arciere
              </label>
            )}
          </div>
          <div
            ref={box}
            className="relative mx-auto overflow-hidden rounded-2xl bg-black"
            style={{ aspectRatio: `${size.w} / ${size.h}`, width: `min(100%, calc(70vh * ${ratio.toFixed(4)}))` }}
          >
            {kind === "video" ? (
              <video ref={videoRef} src={src} playsInline muted preload="auto" className="absolute inset-0 h-full w-full object-contain" onClick={toggle} />
            ) : (
              <img ref={imageRef} src={src} alt="Foto del gesto" className="absolute inset-0 h-full w-full object-contain" />
            )}
            <canvas
              ref={overlay}
              className={`absolute inset-0 h-full w-full ${cropMode ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
              onPointerDown={cropDown}
              onPointerMove={cropMove}
              onPointerUp={cropUp}
              onPointerCancel={() => { cropStart.current = null; draftRef.current = null; paintOverlay(lastLm.current); }}
            />
            <div className="absolute right-2 top-2 flex gap-1 rounded-full bg-[#14181c]/75 p-1 text-xs font-semibold text-[#f4f1ea]">
              {([["scheletro", "Scheletro"], ["sagoma", "Sagoma"], ["mista", "Mista"]] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => { setLook(k); if (k === "scheletro") setShowPose(true); }} className={`min-h-8 rounded-full px-2.5 ${look === k ? "bg-[#3ee08f] text-[#04140c]" : ""}`}>{label}</button>
              ))}
              {look === "scheletro" ? (
                <button type="button" onClick={() => setShowPose((v) => !v)} className="min-h-8 rounded-full px-2" aria-label="Mostra o nascondi lo scheletro">{showPose ? "👁" : "🚫"}</button>
              ) : null}
            </div>
            {progress != null ? (
              <div className="absolute inset-x-0 bottom-0 bg-[#14181c]/80 p-2 text-xs text-[#f4f1ea]">
                {recording ? "Registro il video…" : "Analizzo il video…"} {Math.round(progress * 100)}%
                <div className="mt-1 h-1.5 rounded-full bg-white/20"><div className="h-1.5 rounded-full bg-[#e6b325]" style={{ width: `${progress * 100}%` }} /></div>
              </div>
            ) : null}
          </div>

          {kind === "video" ? (
            <div className="grid gap-2">
              <div className="flex items-center gap-2 text-xs tabular-nums text-muted">
                <span className="w-12">{fmt(time)}</span>
                <input type="range" min={0} max={duration || 0} step={0.01} value={Math.min(time, duration || 0)} onChange={(e) => seek(Number(e.target.value))} className="h-11 flex-1 accent-[var(--primary)]" aria-label="Posizione nel video" />
                <span className="w-12 text-right">{fmt(duration)}</span>
              </div>
              <div className="relative -mt-2 h-2 rounded-full bg-line/30" aria-hidden>
                {range ? <div className="absolute inset-y-0 rounded-full bg-[#3ee08f]" style={{ left: `${(range.from / Math.max(0.01, duration)) * 100}%`, width: `${((range.to - range.from) / Math.max(0.01, duration)) * 100}%` }} /> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs text-muted">✂ Parte:</span>
                <button type="button" onClick={() => { const to = range?.to ?? duration; setRange({ from: Math.min(time, to - 0.2), to }); setSamples([]); }} className="min-h-9 rounded-full border border-line px-3">⟦ Inizio qui</button>
                <button type="button" onClick={() => { const from = range?.from ?? 0; setRange({ from, to: Math.max(time, from + 0.2) }); setSamples([]); }} className="min-h-9 rounded-full border border-line px-3">Fine qui ⟧</button>
                {range ? <button type="button" onClick={() => { setRange(null); setSamples([]); }} className="min-h-9 rounded-full border border-line px-3">Tutto</button> : null}
                <span className="text-xs tabular-nums text-muted">{range ? `${fmt(range.from)} → ${fmt(range.to)} (${(range.to - range.from).toFixed(1)} s)` : "tutto il video"}</span>
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
                  <button type="button" disabled={!duration || Boolean(busy)} onClick={() => void scanAll()} className="min-h-11 rounded-xl bg-accent px-3 text-sm font-semibold text-accent-fg disabled:opacity-60">🔍 {range ? "Analizza la parte" : "Analizza tutto il video"}</button>
                )}
                <button type="button" onClick={snapshot} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold">⬇ Salva fotogramma</button>
                <button type="button" disabled={recording || progress != null} onClick={() => void recordAnnotated()} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold disabled:opacity-60">{recording ? "⏺ Registro…" : look === "scheletro" ? "⏺ Salva video con scheletro" : "⏺ Salva video con sagoma"}</button>
                <button type="button" disabled={!samples.length} onClick={exportCsv} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold disabled:opacity-60">⬇ Dati CSV</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={snapshot} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold">⬇ Salva l'immagine con lo scheletro</button>
          )}

          <Readout m={now} gear={gear} distance={distance} />

          {kind === "video" && samples.length ? <Timeline samples={samples} shots={analysis.shots} time={time} duration={duration} onSeek={seek} /> : null}

          {analysis.shots.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {analysis.shots.map((s, i) => (
                <button key={s.anchorFrom} type="button" onClick={() => { setShotIndex(i); seek((s.anchorFrom + (s.release ?? s.anchorTo)) / 2); }} className={`min-h-11 shrink-0 rounded-full px-3 text-sm ${i === shotIndex ? "bg-primary text-primary-fg" : "border border-line"}`}>
                  Tiro {i + 1} · {fmt(s.anchorFrom)} · {s.score}/100
                </button>
              ))}
            </div>
          ) : null}
          {shot && kind === "video" ? <ShotCard shot={shot} onSeek={seek} /> : null}
          {analysis.spread ? (
            <div className="rounded-xl border border-line bg-elev p-3 text-sm">
              <p className="font-semibold">Ripetibilità su {analysis.shots.length} tiri</p>
              <p className="text-xs text-muted">Da un tiro all'altro: tempo di ancoraggio ±{analysis.spread.anchor.toFixed(1)} s, linea del gomito ±{analysis.spread.line.toFixed(1)}°, gomito della corda ±{analysis.spread.draw.toFixed(1)}°. Più sono piccoli, più il gesto è sempre uguale.</p>
            </div>
          ) : null}
          {kind === "photo" && now ? <Notes lines={notesFor(now)} /> : null}
          {kind === "video" && !samples.length && now && progress == null ? <Notes lines={[...notesFor(now), "Premi «Analizza tutto il video» per fasi, tempi e sequenza."]} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function safeGear(source: CanvasImageSource, W: number, H: number, lm: Landmark[], hand: Hand): Gear | null {
  try {
    return detectGear(source, W, H, lm, hand);
  } catch {
    return null;
  }
}

function Readout({ m, gear, distance }: { m: Metrics | null; gear: Gear | null; distance: number | null }) {
  const dash = "—";
  const signed = (v: number, d = 1) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}°`;
  const cells: [string, string, string][] = [
    ["Linea gomito corda", m ? `${m.line.toFixed(0)}°` : dash, "#c084fc"],
    ["Braccio arco", m ? `${m.bow.toFixed(0)}°` : dash, "#e07a2f"],
    ["Spalle", m ? signed(m.shoulder) : dash, "#e6b325"],
    ["Spalla arco", m ? `${m.bowSh.toFixed(0)}°` : dash, "#f59e0b"],
    ["Mano–viso", m ? `${m.handFace.toFixed(2)} sp.` : dash, "#7ec8e3"],
    ["Busto", m?.trunk != null ? signed(m.trunk) : m ? "mezzo busto" : dash, "#9eb6c9"],
    ["Freccia", gear?.arrow ? signed(gear.arrow.tilt) : m ? `${signed(m.arrowTilt)} (mani)` : dash, "#f97316"],
    ["Arco inclinato", gear?.bow ? `${Math.abs(gear.bow.cant).toFixed(1)}°${gear.bow.cant > 0.5 ? " verso la corda" : gear.bow.cant < -0.5 ? " verso fuori" : ""}` : dash, "#a3e635"],
  ];
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map(([k, v, color]) => (
          <div key={k} className="rounded-xl border border-line px-3 py-2" style={{ borderLeft: `4px solid ${color}` }}>
            <p className="text-xs text-muted">{k}</p>
            <p className="font-display text-xl leading-none tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      {distance ? (
        <p className="text-xs text-muted">
          📏 Ripresa a circa {distance.toFixed(1)} m dall'arciere (stima dalle spalle)
          {distance < 2.5 ? ": un po' vicino, allontanati" : distance > 8 ? ": lontano, avvicinati o usa il riquadro ✂" : ": distanza giusta"}.
        </p>
      ) : null}
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

function ShotCard({ shot, onSeek }: { shot: Shot; onSeek: (t: number) => void }) {
  return (
    <div className="grid gap-2 rounded-xl border border-line bg-elev p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Lettura del tiro</p>
        <ScoreRing value={shot.score} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {shot.phases.map((p) => (
          <button key={p.name} type="button" onClick={() => onSeek(p.from)} className="rounded-lg border border-line p-2 text-left" style={{ borderLeft: `4px solid ${PHASE_COLORS[p.name]}` }}>
            <span className="block text-xs text-muted">{PHASE_LABEL[p.name]}</span>
            <span className="font-semibold tabular-nums">{(p.to - p.from).toFixed(1)} s</span>
            <span className="block text-[11px] text-muted">da {fmt(p.from)}</span>
          </button>
        ))}
        <button type="button" disabled={shot.release == null} onClick={() => shot.release != null && onSeek(shot.release)} className="rounded-lg border border-line p-2 text-left disabled:opacity-60" style={{ borderLeft: "4px solid #d15c56" }}>
          <span className="block text-xs text-muted">Rilascio</span>
          <span className="font-semibold tabular-nums">{shot.release != null ? fmt(shot.release) : "non visto"}</span>
        </button>
      </div>
      <ul className="grid gap-1 text-sm">
        {shot.checks.map((c) => (
          <li key={c.text}>{c.ok ? "✅" : c.warn ? "⚠️" : "❌"} {c.text}</li>
        ))}
      </ul>
      <div className="grid gap-1">
        {shot.parts.map((part) => (
          <div key={part.label} className="grid grid-cols-[1fr_5rem] items-center gap-2 text-xs">
            <span>{part.label}</span>
            <span className="h-2 rounded-full bg-line/30"><span className="block h-2 rounded-full" style={{ width: `${Math.round(part.value * 100)}%`, background: part.value >= 0.7 ? "#3d9b74" : part.value >= 0.4 ? "#e6b325" : "#d15c56" }} /></span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        All'ancoraggio: linea del gomito {shot.at.line.toFixed(0)}°, braccio dell'arco {shot.at.bow.toFixed(0)}°, spalla dell'arco {shot.at.bowSh.toFixed(0)}°, spalle {shot.at.shoulder.toFixed(1)}°
        {shot.at.trunk != null ? `, busto ${shot.at.trunk.toFixed(1)}°` : ""}, mano dell'arco che si muove del {shot.jitter.toFixed(1)}% delle spalle.
      </p>
      <Notes lines={shot.notes} />
      <p className="text-xs text-muted">Stime da una ripresa 2D: confronta video girati sempre dallo stesso posto.</p>
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const color = value >= 70 ? "#3ee08f" : value >= 50 ? "#e6b325" : "#d15c56";
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c}`} />
        <text x="32" y="38" textAnchor="middle" transform="rotate(90 32 32)" fill="var(--fg)" fontSize="18" fontWeight="700">{value}</text>
      </svg>
      <span className="text-xs text-muted">{value >= 70 ? "buono" : value >= 50 ? "discreto" : "da sistemare"}</span>
    </div>
  );
}

function Timeline({ samples, shots, time, duration, onSeek }: { samples: Sample[]; shots: Shot[]; time: number; duration: number; onSeek: (t: number) => void }) {
  const held = useRef(false);
  const W = 600;
  const H = 190;
  const pad = { l: 34, r: 8, t: 10, b: 40 };
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
  const stripY = H - pad.b + 8;
  return (
    <div className="grid gap-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none rounded-xl border border-line bg-elev"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); held.current = true; go(e); }}
        onPointerMove={(e) => { if (held.current) go(e); }}
        onPointerUp={() => { held.current = false; }}
        onPointerCancel={() => { held.current = false; }}
      >
        {[90, 120, 150, 180].map((a) => (
          <g key={a}>
            <line x1={pad.l} x2={W - pad.r} y1={y(a)} y2={y(a)} stroke="var(--line)" strokeDasharray="3 4" />
            <text x={4} y={y(a) + 4} fontSize="11" fill="var(--muted)">{a}°</text>
          </g>
        ))}
        <path d={path((m) => m.bow)} fill="none" stroke="#e07a2f" strokeWidth="2.2" />
        <path d={path((m) => m.line)} fill="none" stroke="#c084fc" strokeWidth="2.2" />
        {shots.flatMap((s) => s.phases.map((p) => (
          <rect key={`${s.anchorFrom}-${p.name}`} x={x(p.from)} y={stripY} width={Math.max(2, x(p.to) - x(p.from))} height="12" rx="3" fill={PHASE_COLORS[p.name]} />
        )))}
        {shots.map((s) => (s.release != null ? <line key={`r${s.release}`} x1={x(s.release)} x2={x(s.release)} y1={pad.t} y2={stripY + 12} stroke="#d15c56" strokeWidth="2" /> : null))}
        <line x1={x(time)} x2={x(time)} y1={pad.t} y2={stripY + 12} stroke="var(--fg)" strokeWidth="1.5" />
        <text x={pad.l} y={H - 4} fontSize="11" fill="var(--muted)">0:00</text>
        <text x={W - pad.r - 30} y={H - 4} fontSize="11" fill="var(--muted)">{fmt(duration)}</text>
      </svg>
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        <span><span className="mr-1 inline-block h-2 w-3 rounded" style={{ background: "#c084fc" }} />Linea gomito corda</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded" style={{ background: "#e07a2f" }} />Braccio arco</span>
        {(Object.keys(PHASE_COLORS) as (keyof typeof PHASE_COLORS)[]).map((k) => (
          <span key={k}><span className="mr-1 inline-block h-2 w-3 rounded" style={{ background: PHASE_COLORS[k] }} />{PHASE_LABEL[k]}</span>
        ))}
        <span><span className="mr-1 inline-block h-2 w-3 rounded" style={{ background: "#d15c56" }} />Rilascio</span>
      </div>
    </div>
  );
}

function drawPose(ctx: CanvasRenderingContext2D, w: number, h: number, lm: Landmark[], hand: Hand, gear: Gear | null) {
  const s = Math.max(1, Math.min(w, h) / 360);
  const at = (i: number) => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 });
  const { bow, draw } = sides(hand);
  ctx.lineCap = "round";
  if (gear?.arrow) {
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(gear.arrow.x1 * w, gear.arrow.y1 * h);
    ctx.lineTo(gear.arrow.x2 * w, gear.arrow.y2 * h);
    ctx.stroke();
  } else {
    const bw = at(bow[2]);
    const dw = at(draw[2]);
    if (bw.v > 0.3 && dw.v > 0.3) {
      ctx.setLineDash([8 * s, 6 * s]);
      ctx.strokeStyle = "rgba(244,241,234,0.8)";
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(bw.x, bw.y);
      ctx.lineTo(dw.x, dw.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (gear?.bow) {
    ctx.strokeStyle = "#a3e635";
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(gear.bow.x1 * w, gear.bow.y1 * h);
    ctx.lineTo(gear.bow.x2 * w, gear.bow.y2 * h);
    ctx.stroke();
  }
  ctx.strokeStyle = "#4aa3ff";
  ctx.lineWidth = 3 * s;
  for (const [a, b] of LINKS) {
    if (!lm[a] || !lm[b]) continue;
    const p = at(a);
    const q = at(b);
    if (p.v < 0.4 || q.v < 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
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
    if (p.v < 0.4) continue;
    ctx.beginPath();
    ctx.fillStyle = i === draw[1] || i === bow[1] ? "#ef4444" : "#4aa3ff";
    ctx.arc(p.x, p.y, 4.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  const m = metricsOf(lm, hand, w / h, h);
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
    if (p.v < 0.4) return;
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
    const mark = (good: boolean) => (good ? "✅ " : "⚠️ ");
    label(`${mark(m.line >= 168)}Gomito in linea ${m.line.toFixed(0)}°`, de.x + 16 * s, de.y - 6 * s, m.line >= 168 ? "#b9ffd9" : "#fde68a");
    label(`${mark(m.bow >= 165)}Braccio arco ${m.bow.toFixed(0)}°`, be.x + 16 * s, be.y + 22 * s, m.bow >= 165 ? "#b9ffd9" : "#fde68a");
    label(`${mark(Math.abs(m.shoulder) <= 4)}Spalle ${Math.abs(m.shoulder).toFixed(1)}°`, (l.x + r.x) / 2 - 30 * s, Math.min(l.y, r.y) - 12 * s, Math.abs(m.shoulder) <= 4 ? "#b9ffd9" : "#fde68a");
    if (m.handFace < 0.85) label("✅ Ancorato", at(draw[2]).x - 30 * s, at(draw[2]).y + 26 * s, "#b9ffd9");
  }
  if (gear?.bow) label(`Cant ${Math.abs(gear.bow.cant).toFixed(1)}°`, gear.bow.x1 * w + 8 * s, gear.bow.y1 * h + 16 * s, "#bef264");
}

/**
 * Sagoma "a raggi X": corpo verde trasparente con le ossa chiare e gli angoli principali sugli archi
 * (spalla, gomiti, anca), su fondo scuro o sopra il video.
 */
export function drawSagoma(ctx: CanvasRenderingContext2D, w: number, h: number, lm: Landmark[] | null, hand: Hand, gear: Gear | null, dark: boolean) {
  const s = Math.max(1, Math.min(w, h) / 360);
  if (dark) {
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.75);
    g.addColorStop(0, "#0d2a1f");
    g.addColorStop(1, "#030807");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(62,224,143,0.06)";
    ctx.lineWidth = 1;
    const step = 28 * s;
    for (let x = 0; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  } else {
    ctx.fillStyle = "rgba(3,8,7,0.45)";
    ctx.fillRect(0, 0, w, h);
  }
  if (!lm) {
    ctx.fillStyle = "rgba(244,241,234,0.7)";
    ctx.font = `600 ${Math.round(14 * s)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Nessuna figura trovata", w / 2, h / 2);
    ctx.textAlign = "start";
    return;
  }
  const P = (i: number) => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 });
  const ok = (...ids: number[]) => ids.every((i) => lm[i] && (lm[i].visibility ?? 1) > 0.35);
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const sw = Math.max(12 * s, Math.hypot(P(11).x - P(12).x, P(11).y - P(12).y));
  const GREEN = "#3ee08f";
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // carne: arti spessi e trasparenti con alone
  ctx.shadowColor = GREEN;
  ctx.shadowBlur = 18 * s;
  const limb = (a: number, b: number, width: number) => {
    if (!ok(a, b)) return;
    const p = P(a);
    const q = P(b);
    ctx.strokeStyle = "rgba(62,224,143,0.28)";
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  };
  // busto
  if (ok(11, 12)) {
    const ls = P(11);
    const rs = P(12);
    const hipsOk = ok(23, 24);
    const lh = hipsOk ? P(23) : { x: ls.x, y: ls.y + sw * 1.4 };
    const rh = hipsOk ? P(24) : { x: rs.x, y: rs.y + sw * 1.4 };
    ctx.fillStyle = "rgba(62,224,143,0.18)";
    ctx.strokeStyle = "rgba(62,224,143,0.55)";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(ls.x, ls.y);
    ctx.quadraticCurveTo((ls.x + rs.x) / 2, Math.min(ls.y, rs.y) - sw * 0.08, rs.x, rs.y);
    ctx.lineTo(rh.x, rh.y);
    ctx.lineTo(lh.x, lh.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  limb(11, 13, sw * 0.3);
  limb(13, 15, sw * 0.24);
  limb(12, 14, sw * 0.3);
  limb(14, 16, sw * 0.24);
  limb(23, 25, sw * 0.38);
  limb(25, 27, sw * 0.28);
  limb(24, 26, sw * 0.38);
  limb(26, 28, sw * 0.28);
  // testa e collo
  if (ok(0)) {
    const nose = P(0);
    const ears = ok(7, 8) ? mid(P(7), P(8)) : nose;
    const c = { x: (nose.x + ears.x) / 2, y: (nose.y + ears.y) / 2 - sw * 0.05 };
    const r = sw * 0.32;
    ctx.fillStyle = "rgba(62,224,143,0.2)";
    ctx.strokeStyle = "rgba(62,224,143,0.7)";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r, r * 1.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (ok(11, 12)) {
      const n = mid(P(11), P(12));
      ctx.strokeStyle = "rgba(62,224,143,0.3)";
      ctx.lineWidth = sw * 0.18;
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.lineTo(c.x, c.y + r);
      ctx.stroke();
    }
  }
  // ossa: linee chiare dentro la sagoma
  ctx.shadowBlur = 8 * s;
  ctx.shadowColor = "#b9ffd9";
  ctx.strokeStyle = "rgba(225,255,238,0.9)";
  ctx.lineWidth = 2.2 * s;
  const bone = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  for (const [a, b] of [[11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28], [11, 12], [23, 24]] as const) {
    if (ok(a, b)) bone(P(a), P(b));
  }
  if (ok(11, 12)) {
    const neck = mid(P(11), P(12));
    const pelvis = ok(23, 24) ? mid(P(23), P(24)) : { x: neck.x, y: neck.y + sw * 1.4 };
    bone(neck, pelvis); // colonna
    ctx.lineWidth = 1.3 * s;
    for (let k = 1; k <= 4; k += 1) {
      // costole
      const t = k / 6;
      const c = { x: neck.x + (pelvis.x - neck.x) * t, y: neck.y + (pelvis.y - neck.y) * t };
      const span = sw * (0.42 - k * 0.04);
      ctx.beginPath();
      ctx.moveTo(c.x - span, c.y + sw * 0.06);
      ctx.quadraticCurveTo(c.x, c.y - sw * 0.06, c.x + span, c.y + sw * 0.06);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
  // articolazioni
  for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    if (!ok(i)) continue;
    const p = P(i);
    ctx.fillStyle = "#e9fff3";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.2 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // arco
  if (gear?.bow) {
    ctx.strokeStyle = "rgba(233,255,243,0.85)";
    ctx.lineWidth = 2.4 * s;
    const a = { x: gear.bow.x1 * w, y: gear.bow.y1 * h };
    const b = { x: gear.bow.x2 * w, y: gear.bow.y2 * h };
    const m = mid(a, b);
    const nx = -(b.y - a.y);
    const ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    const bend = Math.hypot(b.x - a.x, b.y - a.y) * 0.12;
    const { bow: bowSide } = sides(hand);
    const grip = P(bowSide[2]);
    const dir = (grip.x - m.x) * nx + (grip.y - m.y) * ny > 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(m.x + (nx / len) * bend * dir, m.y + (ny / len) * bend * dir, b.x, b.y);
    ctx.stroke();
  }
  if (gear?.arrow) {
    ctx.strokeStyle = "rgba(233,255,243,0.7)";
    ctx.lineWidth = 1.6 * s;
    bone({ x: gear.arrow.x1 * w, y: gear.arrow.y1 * h }, { x: gear.arrow.x2 * w, y: gear.arrow.y2 * h });
  }
  // angoli sugli archi
  const angleAt = (a: number, b: number, c: number) => {
    const A = P(a);
    const B = P(b);
    const C = P(c);
    const u = Math.atan2(A.y - B.y, A.x - B.x);
    const v = Math.atan2(C.y - B.y, C.x - B.x);
    let d = v - u;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return { B, u, d, deg: Math.abs((d * 180) / Math.PI) };
  };
  const { bow: bw, draw: dw } = sides(hand);
  const marks: { ids: [number, number, number]; label: string }[] = [
    { ids: [bw[0] === 11 ? 23 : 24, bw[0], bw[1]], label: "SPALLA" },
    { ids: [bw[0], bw[1], bw[2]], label: "GOMITO ARCO" },
    { ids: [dw[0], dw[1], dw[2]], label: "GOMITO CORDA" },
    { ids: [bw[0], bw[0] === 11 ? 23 : 24, bw[0] === 11 ? 25 : 26], label: "ANCA" },
  ];
  ctx.font = `700 ${Math.round(11 * s)}px system-ui, sans-serif`;
  for (const mk of marks) {
    if (!ok(...mk.ids)) continue;
    const { B, u, d, deg } = angleAt(...mk.ids);
    const r = sw * 0.32;
    ctx.shadowColor = GREEN;
    ctx.shadowBlur = 10 * s;
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.arc(B.x, B.y, r, u, u + d, d < 0);
    ctx.stroke();
    ctx.strokeStyle = "rgba(62,224,143,0.35)";
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.arc(B.x, B.y, r * 1.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    const text = `${mk.label}: ${deg.toFixed(0)}°`;
    const tw = ctx.measureText(text).width;
    // l'etichetta va dalla parte opposta all'arco
    const away = u + d / 2 + Math.PI;
    let tx = B.x + Math.cos(away) * r * 2.1 - tw / 2;
    let ty = B.y + Math.sin(away) * r * 2.1 + 4 * s;
    tx = Math.max(4 * s, Math.min(w - tw - 4 * s, tx));
    ty = Math.max(14 * s, Math.min(h - 6 * s, ty));
    ctx.fillStyle = "rgba(3,12,9,0.75)";
    ctx.fillRect(tx - 4 * s, ty - 12 * s, tw + 8 * s, 16 * s);
    ctx.fillStyle = "#b9ffd9";
    ctx.fillText(text, tx, ty);
  }
  ctx.restore();
}

/** Punti del corpo al tempo t, interpolati fra i due campioni vicini (registrazione fluida). */
function lmAt(samples: Sample[], t: number): Landmark[] | null {
  let lo = -1;
  let hi = -1;
  for (let i = 0; i < samples.length; i += 1) {
    if (!samples[i].lm) continue;
    if (samples[i].t <= t) lo = i;
    else { hi = i; break; }
  }
  const a = lo >= 0 ? samples[lo] : null;
  const b = hi >= 0 ? samples[hi] : null;
  if (a && b && a.lm && b.lm && b.t - a.t < 0.6) {
    const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
    return a.lm.map((p, i) => ({ x: p.x + (b.lm![i].x - p.x) * f, y: p.y + (b.lm![i].y - p.y) * f, visibility: Math.min(p.visibility ?? 1, b.lm![i].visibility ?? 1) }));
  }
  if (a?.lm && t - a.t < 0.4) return a.lm;
  if (b?.lm && b.t - t < 0.4) return b.lm;
  return null;
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
