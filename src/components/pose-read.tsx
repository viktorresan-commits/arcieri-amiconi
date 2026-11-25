import { Glyph, IconLabel, StatusMark } from "./icons";
import { Link } from "@tanstack/react-router";
import { Anatomy3D, sagomaPainter } from "@/components/anatomy-3d";
import { boneCal } from "@/lib/arcieri/anatomy-model";
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { MediaPick } from "@/components/media-pick";
import { saveFile } from "@/lib/arcieri/native";
import { saveGesture } from "@/lib/arcieri/gesture.api";
import { ProPanel, drawPro, type ProSave } from "./pose-pro";
import { archeryKit } from "@/lib/arcieri/pose-kit";
import { buildRecord } from "@/lib/arcieri/gesture-record";
import { placeLabel, resetLabels } from "@/lib/arcieri/overlay-labels";
export { archeryKit };
import {
  PHASE_COLORS,
  PHASE_LABEL,
  analyzeShots,
  cameraDistance,
  detectGear,
  cleanSequence,
  validateGear,
  isDrawing,
  metricsOf,
  notesFor,
  personBox,
  sides,
  smoothLm,
  mixLm,
  withExtras,
  FACE_IDS,
  HAND_L,
  HAND_R,
  HAND_LINKS,
  FACE0,
  LM_TOTAL,
  type Gear,
  type Hand,
  type Landmark,
  type Metrics,
  type Sample,
  type Shot,
  sideEvidence,
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
  [11, 13], [13, 15], [12, 14], [14, 16],
  // mani: polso, pollice, indice, mignolo
  [15, 17], [15, 19], [15, 21], [17, 19], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  // piedi: caviglia, tallone, punta
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
];
const JOINTS = [0, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
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

/* ---------- mani e viso: 100 punti in più per ancoraggio, presa e dita ---------- */
type PartMarker = { detect: (image: CanvasImageSource) => { landmarks?: Landmark[][]; faceLandmarks?: Landmark[][] } };
const PART_MODELS = {
  hand: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
};
const partEngines: Partial<Record<"hand" | "face", Promise<PartMarker>>> = {};
const otherHand = (h: Hand): Hand => (h === "destro" ? "mancino" : "destro");

function partEngine(kind: "hand" | "face"): Promise<PartMarker> {
  let job = partEngines[kind];
  if (!job) {
    job = (async () => {
      const vision = await new Function("url", "return import(url)")(`${VISION}/+esm`);
      const files = await vision.FilesetResolver.forVisionTasks(`${VISION}/wasm`);
      const make = (delegate: "GPU" | "CPU") =>
        (kind === "hand"
          ? vision.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: PART_MODELS.hand, delegate }, runningMode: "IMAGE", numHands: 1, minHandDetectionConfidence: 0.35, minHandPresenceConfidence: 0.35 })
          : vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: PART_MODELS.face, delegate }, runningMode: "IMAGE", numFaces: 1, minFaceDetectionConfidence: 0.35 })) as Promise<PartMarker>;
      try {
        return await make("GPU");
      } catch {
        return await make("CPU");
      }
    })();
    partEngines[kind] = job;
    job.catch(() => {
      delete partEngines[kind];
    });
  }
  return job;
}

const partCanvas: { c: HTMLCanvasElement | null } = { c: null };
/** rileva una mano o il viso in un riquadro quadrato attorno a (cx, cy) e riporta i punti nel fotogramma */
async function detectPart(kind: "hand" | "face", source: CanvasImageSource, W: number, H: number, cx: number, cy: number, side: number): Promise<Landmark[] | null> {
  const marker = await partEngine(kind);
  const sz = Math.max(48, Math.min(Math.max(W, H), side));
  const x0 = Math.max(0, Math.min(W - sz, cx - sz / 2));
  const y0 = Math.max(0, Math.min(H - sz, cy - sz / 2));
  const sw = Math.min(sz, W);
  const sh = Math.min(sz, H);
  const c = partCanvas.c ?? (partCanvas.c = document.createElement("canvas"));
  const k = Math.min(2.5, 320 / Math.max(sw, sh));
  c.width = Math.round(sw * k);
  c.height = Math.round(sh * k);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, x0, y0, sw, sh, 0, 0, c.width, c.height);
  let res: ReturnType<PartMarker["detect"]>;
  try {
    res = marker.detect(c);
  } catch {
    return null;
  }
  const pts = kind === "hand" ? res.landmarks?.[0] : res.faceLandmarks?.[0];
  if (!pts?.length) return null;
  const map = (p: Landmark) => ({ x: (x0 + p.x * sw) / W, y: (y0 + p.y * sh) / H, z: p.z != null ? (p.z * sw) / W : undefined, visibility: 0.9 });
  return kind === "hand" ? pts.map(map) : FACE_IDS.map((id) => map(pts[id] ?? pts[0]));
}

/** mani (attorno ai polsi) e viso (attorno al naso) per i 100 punti in più */
async function detectExtras(source: CanvasImageSource, W: number, H: number, body: Landmark[]): Promise<Landmark[]> {
  const px = (i: number) => ({ x: body[i].x * W, y: body[i].y * H });
  const dist = (a: number, b: number) => Math.hypot(px(a).x - px(b).x, px(a).y - px(b).y);
  const shoulders = dist(11, 12) || H * 0.1;
  const hand = async (wrist: 15 | 16, elbow: 13 | 14) => {
    if ((body[wrist].visibility ?? 1) < 0.25) return null;
    const w = px(wrist);
    const e = px(elbow);
    // un po' oltre il polso, dove ci sono le dita
    const cx = w.x + (w.x - e.x) * 0.35;
    const cy = w.y + (w.y - e.y) * 0.35;
    const pts = await detectPart("hand", source, W, H, cx, cy, Math.max(shoulders * 1.1, dist(wrist, elbow) * 1.6));
    // la mano trovata deve partire dal polso giusto
    if (pts && Math.hypot(pts[0].x * W - w.x, pts[0].y * H - w.y) > Math.max(shoulders * 0.5, 40)) return null;
    return pts;
  };
  const face = async () => {
    if ((body[0].visibility ?? 1) < 0.3) return null;
    const n = px(0);
    return detectPart("face", source, W, H, n.x, n.y, Math.max(dist(7, 8) * 2.6, shoulders * 0.9));
  };
  try {
    const [l, r, f] = [await hand(15, 13), await hand(16, 14), await face()];
    return withExtras(body, l, r, f);
  } catch {
    return withExtras(body, null, null, null);
  }
}

export function PoseRead() {
  const box = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const pip = useRef<HTMLCanvasElement>(null);
  const work = useRef<HTMLCanvasElement | null>(null);
  const [hand, setHandState] = useState<Hand>("destro");
  // lati della persona: null finché il gesto non lo dice, poi resta deciso per il video.
  // Video specchiato (fotocamera frontale): il braccio dell'arco è l'altro rispetto a destro/mancino scelto.
  const sideScore = useRef(0);
  const sideSwap = useRef<boolean | null>(null);
  const [sideFlip, setSideFlip] = useState(false);
  const userHandRef = useRef(hand);
  userHandRef.current = hand;
  /** la mano usata per l'analisi di questo video */
  const effHand: Hand = sideFlip ? otherHand(hand) : hand;
  const handRef = useRef(effHand);
  handRef.current = effHand;
  const resetSides = () => {
    sideScore.current = 0;
    sideSwap.current = null;
    setSideFlip(false);
  };
  /** 100 punti in più (mani e viso): più preciso su ancoraggio, presa e dita, un po' più lento */
  const [detail, setDetail] = useState(true);
  const detailRef = useRef(detail);
  detailRef.current = detail;
  const [quality, setQualityState] = useState<Quality>("full");
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const [kind, setKind] = useState<"none" | "photo" | "video">("none");
  const [src, setSrc] = useState("");
  const [size, setSize] = useState({ w: 9, h: 16 });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
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
  /** zoom dentro il video: pizzica con due dita, trascina con uno quando è ingrandito */
  const [zoomV, setZoomV] = useState({ z: 1, x: 0, y: 0 });
  const zoomRef = useRef(zoomV);
  const [used3d, setUsed3d] = useState(false);
  useEffect(() => {
    if (look === "sagoma") setUsed3d(true);
  }, [look]);
  const gesture = useRef<{ pts: Map<number, { x: number; y: number }>; pinch: number; moved: number }>({ pts: new Map(), pinch: 0, moved: 0 });
  const lookRef = useRef(look);
  lookRef.current = look;
  const [samples, setSamples] = useState<Sample[]>([]);
  /** riquadro dell'arciere nell'ultimo fotogramma: serve a seguire sempre la stessa persona */
  const lastPerson = useRef<Rect | null>(null);
  /** ultimo aggiornamento delle letture sullo schermo (si limitano durante la riproduzione) */
  const lastReadout = useRef(0);
  const samplesRef = useRef<Sample[]>(samples);
  samplesRef.current = samples;
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
  const [saveTitle, setSaveTitle] = useState("");
  const [saveState, setSaveState] = useState<"" | "busy" | "ok" | string>("");
  /** parte del video da analizzare e salvare (null = tutto) */
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  /** analisi pro: più punti (testa, mani), polsi, postura, allungo e consigli */
  const [pro, setProState] = useState(true);
  const [live, setLive] = useState(false);
  const proRef = useRef(pro);
  proRef.current = pro;
  const span = () => ({ from: range?.from ?? 0, to: range?.to ?? duration });

  useEffect(() => {
    try {
      if (localStorage.getItem("aa-hand") === "left") setHandState("mancino");
      const q = localStorage.getItem("aa-pose-quality");
      if (q === "lite" || q === "full" || q === "heavy") setQualityState(q);
      if (localStorage.getItem("aa-pose-pro") === "0") setProState(false);
    } catch {
      /* niente */
    }
  }, []);

  function setHand(next: Hand) {
    setHandState(next);
    resetSides();
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

  const analysis = useMemo(() => analyzeShots(samples, effHand), [samples, effHand]);
  // fotogrammi dell'analisi: la sagoma ne ricava le lunghezze vere delle ossa dell'arciere
  const calFrames = useMemo(() => samples.map((s) => s.lm), [samples]);
  const shot: Shot | null = analysis.shots[Math.min(shotIndex, analysis.shots.length - 1)] ?? null;
  const distance = useMemo(
    () => cameraDistance(samples.length ? samples : now ? [{ t: 0, lm: null, m: now }] : [], size.w, size.h),
    [samples, now, size],
  );

  /* ---------- rilevamento ---------- */

  /** Rileva il corpo nel riquadro scelto (o seguito) e riporta i punti nel fotogramma intero. */
  async function detectOn(source: CanvasImageSource, W: number, H: number, extras = true): Promise<Landmark[] | null> {
    // nell'analisi completa sempre il modello più preciso
    const marker = await (scanning.current ? engine("heavy").catch(() => engine(qualityRef.current)) : engine(qualityRef.current));
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
    let worlds: { x: number; y: number; z: number }[][] = [];
    try {
      const res = marker.detect(canvas) as { landmarks?: Landmark[][]; worldLandmarks?: { x: number; y: number; z: number }[][] };
      poses = res.landmarks ?? [];
      worlds = res.worldLandmarks ?? [];
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
    // l'arciere seguito: tra un fotogramma e l'altro resta la stessa persona (vicina a dove era e
    // grande uguale), così chi passa sullo sfondo non "ruba" i punti
    const prevB = lastPerson.current;
    const score = (lm: Landmark[]) => {
      const b = personBox(lm, 0);
      if (!b) return 0;
      const a = b.w * b.h;
      if (!prevB) return a;
      const cx = b.x + b.w / 2 - (prevB.x + prevB.w / 2);
      const cy = b.y + b.h / 2 - (prevB.y + prevB.h / 2);
      const d = Math.hypot(cx, cy) / Math.max(0.05, Math.max(prevB.w, prevB.h));
      const sizeRatio = Math.min(a, prevB.w * prevB.h) / Math.max(1e-6, Math.max(a, prevB.w * prevB.h));
      return a * sizeRatio / (1 + 4 * d * d);
    };
    const chosen = [...poses].sort((a, b) => score(b) - score(a))[0];
    const chosenBox = personBox(chosen.map((p) => ({ ...p, x: region.x + p.x * region.w, y: region.y + p.y * region.h })), 0);
    if (chosenBox) lastPerson.current = chosenBox;
    const world = worlds[poses.indexOf(chosen)];
    const raw = chosen.map((p, i) => ({ x: region.x + p.x * region.w, y: region.y + p.y * region.h, z: p.z != null ? p.z * region.w : undefined, visibility: p.visibility, xw: world?.[i]?.x, yw: world?.[i]?.y, zw: world?.[i]?.z }));
    // video specchiato (fotocamera frontale) o arciere di spalle: il riconoscimento scambia sinistra e destra.
    // Si capisce dal gesto (mano della corda al viso, braccio dell'arco teso) e si raddrizza per tutto il video.
    // i punti restano dove sono (il 3D deve essere identico al video, anche se specchiato):
    // cambia solo quale braccio è quello dell'arco
    const ev = sideEvidence(raw, userHandRef.current, W / H);
    if (ev) sideScore.current = Math.max(-6, Math.min(6, sideScore.current + ev));
    if (sideSwap.current === null && Math.abs(sideScore.current) >= 3) {
      sideSwap.current = sideScore.current < 0;
      if (sideSwap.current) {
        handRef.current = otherHand(userHandRef.current);
        setSideFlip(true);
      }
    }
    const mapped = raw;
    if (!cropRef.current && followRef.current) autoBox.current = personBox(mapped, 0.45);
    // sempre 133 punti (mani e viso a visibilità 0 se non cercati), così i fotogrammi si confrontano
    if (!detailRef.current || !extras) return withExtras(mapped, null, null, null);
    return detectExtras(source, W, H, mapped);
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
    resetLabels();
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
    // in «Mista» sopra la sagoma anche lo scheletro con tutti i punti
    if (lm && lookRef.current !== "sagoma" && (showRef.current || lookRef.current === "mista")) drawPose(ctx, w, h, lm, handRef.current, gearRef.current);
    paintPip(lm);
    if (lm && proRef.current && showRef.current && lookRef.current !== "sagoma") drawPro(ctx, w, h, lm, handRef.current);
    if (draft) {
      ctx.strokeStyle = "#e6b325";
      ctx.lineWidth = 3 * dpr;
      ctx.strokeRect(draft.x * w, draft.y * h, draft.w * w, draft.h * h);
    }
  }

  /**
   * Con la sagoma 3D a tutto riquadro, in un angolo resta il video con lo scheletro e i punti:
   * si confronta il 3D con l'arciere vero fotogramma per fotogramma
   */
  function paintPip(lm: Landmark[] | null) {
    const c = pip.current;
    const media = videoRef.current ?? imageRef.current;
    if (!c || !media || lookRef.current !== "sagoma") return;
    const holder = box.current;
    if (!holder) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // dal video stesso (questa funzione può arrivare da un disegno precedente, con misure vecchie)
    const mw = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const mh = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
    if (!mw || !mh) return;
    const ratio = mw / mh;
    const cw = Math.max(60, Math.round(Math.min(holder.clientWidth * 0.3, holder.clientHeight * 0.3 * ratio)));
    const ch = Math.round(cw / ratio);
    if (c.style.width !== `${cw}px`) {
      c.style.width = `${cw}px`;
      c.style.height = `${ch}px`;
    }
    const W = Math.round(cw * dpr);
    const H = Math.round(ch * dpr);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    try {
      ctx.drawImage(media, 0, 0, W, H);
    } catch {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
    }
    resetLabels();
    if (lm) drawPose(ctx, W, H, lm, handRef.current, gearRef.current);
  }

  /**
   * Dopo l'analisi completa il video scorre sui punti già letti (corpo, mani, viso, arco e freccia di ogni
   * fotogramma), interpolati tra un campione e l'altro: la sagoma segue tutti i micropunti ed è fluida.
   */
  function fromSamples(t: number): boolean {
    const arr = samplesRef.current;
    if (arr.length < 2 || scanning.current) return false;
    if (t < arr[0].t - 0.05 || t > arr[arr.length - 1].t + 0.05) return false;
    let lo = 0;
    let hi = arr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = arr[lo];
    const b = arr[hi];
    if (b.t - a.t > 0.6) return false;
    const k = Math.max(0, Math.min(1, (t - a.t) / Math.max(1e-3, b.t - a.t)));
    let lm: Landmark[] | null;
    if (a.lm && b.lm && a.lm.length === b.lm.length) {
      lm = a.lm.map((p, i) => {
        const q = b.lm![i];
        const va = p.visibility ?? 1;
        const vb = q.visibility ?? 1;
        // un punto visto solo in uno dei due fotogrammi non si trascina dall'altro
        if (va < 0.5 && vb >= 0.5) return q;
        if (vb < 0.5 && va >= 0.5) return p;
        return mixLm(p, q, k, Math.min(va, vb));
      });
    } else lm = (k < 0.5 ? a.lm : b.lm) ?? a.lm ?? b.lm;
    if (!lm) return false;
    const g = (k < 0.5 ? a.g : b.g) ?? null;
    lastLm.current = lm;
    gearRef.current = g;
    smoothRef.current = { lm, t };
    paintOverlay(lm);
    const video = videoRef.current;
    const nowMs = performance.now();
    if (video && nowMs - lastReadout.current > 150) {
      lastReadout.current = nowMs;
      setNow(metricsOf(lm, handRef.current, video.videoWidth / Math.max(1, video.videoHeight), video.videoHeight));
    }
    return true;
  }

  async function detectFrame() {
    const video = videoRef.current;
    if (!video || busyDetect.current || scanning.current || video.readyState < 2) return;
    busyDetect.current = true;
    try {
      const W = video.videoWidth;
      const H = video.videoHeight;
      // mentre il video scorre solo il corpo (fluido); da fermo anche mani e viso
      const raw = await detectOn(video, W, H, video.paused);
      const prev = smoothRef.current;
      const near = prev.t >= 0 && Math.abs(video.currentTime - prev.t) < 0.25;
      const lm = raw ? smoothLm(near ? prev.lm : null, raw) : null;
      smoothRef.current = { lm, t: video.currentTime };
      lastLm.current = lm;
      const m = lm ? metricsOf(lm, handRef.current, W / H, H) : null;
      // freccia e arco solo da fermo (costa un po' di calcolo)
      const g = lm && video.paused ? safeGear(video, W, H, lm, handRef.current) : null;
      if (video.paused || gearRef.current) setGear(g);
      gearRef.current = g;
      paintOverlay(lm);
      const nowMs = performance.now();
      if (video.paused || nowMs - lastReadout.current > 150) {
        lastReadout.current = nowMs;
        setNow(m);
      }
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
    if (lastLm.current) setNow(metricsOf(lastLm.current, effHand, size.w / size.h, size.h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effHand, showPose, size, crop, gear, look]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || kind !== "video") return;
    let stop = false;
    let handle = 0;
    const withFrame = "requestVideoFrameCallback" in video;
    let lastUi = 0;
    const tick = () => {
      if (stop) return;
      const nowMs = performance.now();
      // la pagina (barra del tempo, letture) si aggiorna 8 volte al secondo mentre il video scorre:
      // ridisegnarla a ogni fotogramma rallentava tutto e il 3D andava a scatti
      if (video.paused || nowMs - lastUi > 125) {
        lastUi = nowMs;
        setTime(video.currentTime);
      }
      const fromSeq = !video.paused && !recRef.current && fromSamples(video.currentTime);
      if (!video.paused && !recRef.current && !fromSeq) void detectFrame();
      // con l'analisi fatta si segue il tempo a ogni schermata (punti interpolati, movimento continuo);
      // senza, a ogni fotogramma nuovo del video
      handle =
        withFrame && !fromSeq
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
    zoomRef.current = { z: 1, x: 0, y: 0 };
    setZoomV({ z: 1, x: 0, y: 0 });
    setError("");
    setSamples([]);
    setNow(null);
    setGear(null);
    setCropState(null);
    cropRef.current = null;
    setCropMode(false);
    autoBox.current = null;
    lastPerson.current = null;
    lastLm.current = null;
    smoothRef.current = { lm: null, t: -1 };
    setShotIndex(0);
    resetSides();
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
      setError(lm ? "" : "Non vedo una persona. Inquadra l'arciere con il riquadro «Inquadra l'arciere» e riprova.");
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
    lastPerson.current = null;
    try {
      try {
        await video.play();
        video.pause();
      } catch {
        /* va bene */
      }
      const W = video.videoWidth;
      const H = video.videoHeight;
      // ogni fotogramma (30 al secondo, fino a 600 fotogrammi) e il modello più preciso: l'analisi
      // dura di più ma la sagoma segue il video senza buchi e con la profondità più affidabile
      const step = Math.max(1 / 30, (to - from) / 600);
      const out: Sample[] = [];
      let prev: Landmark[] | null = null;
      // fotogrammi letti prima di sapere se i lati sono scambiati: si sistemano alla fine
      let undecided = 0;
      for (let t = from; t <= to + 1e-6; t += step) {
        if (cancel.current) break;
        await seekTo(video, Math.min(t, Math.max(0, duration - 0.02)));
        let lm = await detectOn(video, W, H);
        if (sideSwap.current === null) undecided = out.length + 1;
        if (lm) lm = smoothLm(prev, lm);
        prev = lm;
        // arco e freccia di ogni fotogramma: servono alle misure e alla sagoma mentre il video scorre
        const g = lm ? safeGear(video, W, H, lm, handRef.current) : null;
        out.push({ t: video.currentTime, lm, m: lm ? metricsOf(lm, handRef.current, W / H, H) : null, g });
        lastLm.current = lm;
        paintOverlay(lm);
        setTime(video.currentTime);
        setProgress(Math.min(1, (t - from) / Math.max(0.01, to - from)));
      }
      if (!cancel.current && sideSwap.current && undecided > 0) {
        for (let i = 0; i < Math.min(undecided, out.length); i++) {
          const lm = out[i].lm;
          if (lm) out[i] = { ...out[i], m: metricsOf(lm, handRef.current, W / H, H) };
        }
      }
      if (!cancel.current) {
        // punti ripuliti lungo il tempo: niente salti, niente arco o freccia inventati
        const clean = cleanSequence(out, handRef.current, W / H, H);
        out.splice(0, out.length, ...clean);
        result = out;
        setSamples(out);
        setShotIndex(0);
        const found = analyzeShots(out, handRef.current).shots[0];
        if (found) await seekTo(video, (found.anchorFrom + (found.release ?? found.anchorTo)) / 2);
        else if (!out.some((s) => s.m)) setError("Non vedo l'arciere nel video. Inquadralo con il riquadro «Inquadra l'arciere» e riprova.");
        else setError("Non trovo un tiro completo (mano della corda al viso e braccio dell'arco alzato). Controlla destro/mancino o inquadra l'arciere con il riquadro.");
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
    if (look !== "scheletro") drawSagoma(ctx, size.w, size.h, lastLm.current, effHand, gear, look === "sagoma");
    if (lastLm.current && look !== "sagoma") drawPose(ctx, size.w, size.h, lastLm.current, effHand, gear);
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
    const kind = lookRef.current;
    const canvas = document.createElement("canvas");
    // sagoma: il corpo 3D in alta definizione (1080p, la vista scelta nel 3D) con il video in piccolo;
    // scheletro e mista: 640 px sul lato lungo, abbastanza nitido e leggero da disegnare a ogni fotogramma
    let painter: Awaited<ReturnType<typeof sagomaPainter>> = null;
    if (kind === "sagoma") {
      setInfo("Preparo il 3D in alta definizione…");
      const portrait = size.h >= size.w;
      const W = portrait ? 1080 : Math.round((1080 * size.w) / size.h / 2) * 2;
      const H = portrait ? Math.round((1080 * size.h) / size.w / 2) * 2 : 1080;
      painter = await sagomaPainter(W, H).catch(() => null);
      setInfo("");
      canvas.width = W;
      canvas.height = H;
    }
    if (!painter) {
      const k = Math.min(1, 640 / Math.max(size.w, size.h));
      canvas.width = Math.round((size.w * k) / 2) * 2;
      canvas.height = Math.round((size.h * k) / 2) * 2;
    }
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    // lunghezze vere delle ossa dell'arciere e arco/freccia di ogni fotogramma, per il 3D
    const cal = painter ? boneCal(data.map((x) => x.lm), size.w / Math.max(1, size.h)) : null;
    const gearAt = (t: number) => {
      let best: Sample | null = null;
      for (const x of data) if (!best || Math.abs(x.t - t) < Math.abs(best.t - t)) best = x;
      return best && Math.abs(best.t - t) < 0.25 ? (best.g ?? null) : null;
    };
    // le ombre sfocate (shadowBlur) sul telefono costano decine di ms a fotogramma: in registrazione niente ombre
    Object.defineProperty(ctx, "shadowBlur", { configurable: true, get: () => 0, set: () => undefined });
    const stream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(30);
    const type = ["video/mp4;codecs=avc1", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: painter ? 10_000_000 : 2_500_000 });
    } catch {
      setError("Questo telefono non riesce a registrare il video: salva i fotogrammi uno per volta.");
      return;
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const name = kind === "scheletro" ? "scheletro" : painter ? "sagoma-3d-hd" : "sagoma";
    const wasMuted = video.muted;
    let watchdog = 0;
    rec.onstop = () => {
      window.clearInterval(watchdog);
      painter?.dispose();
      stream.getTracks().forEach((t) => t.stop());
      video.muted = wasMuted;
      recRef.current = null;
      setRecording(false);
      setProgress(null);
      const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
      if (!blob.size) {
        setError("Il video registrato è vuoto: riprova con una parte più corta (⟦ Inizio qui / Fine qui ⟧).");
        return;
      }
      setInfo("Video pronto: lo salvo…");
      saveFile(blob, `gesto-${name}.${(rec.mimeType || "").includes("mp4") ? "mp4" : "webm"}`)
        .then(() => setInfo("Video salvato."))
        .catch(() => setError("Video registrato ma non salvato: riprova."));
    };
    recRef.current = { rec, canvas };
    setRecording(true);
    setProgress(0);
    video.pause();
    // muto: così il telefono lascia partire il video anche senza un nuovo tocco
    video.muted = true;
    video.playbackRate = 0.5;
    await seekTo(video, from);
    const paint = () => {
      if (painter) {
        // corpo 3D a tutto schermo e, in alto a sinistra, il video con lo scheletro: si confrontano
        const t = video.currentTime;
        const lm = lmAt(data, t);
        if (lm) painter.paint({ lm, aspect: size.w / Math.max(1, size.h), hand: handRef.current, gear: gearAt(t), cal, time: t, smooth: true });
        ctx.drawImage(painter.canvas, 0, 0);
        const pw = Math.round(canvas.width * 0.3);
        const ph = Math.round((pw * size.h) / Math.max(1, size.w));
        const px = Math.round(canvas.width * 0.03);
        ctx.drawImage(video, px, px, pw, ph);
        if (lm) {
          ctx.save();
          ctx.translate(px, px);
          ctx.beginPath();
          ctx.rect(0, 0, pw, ph);
          ctx.clip();
          resetLabels();
          drawPose(ctx, pw, ph, lm, handRef.current, null);
          ctx.restore();
        }
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = Math.max(2, canvas.width / 400);
        ctx.strokeRect(px, px, pw, ph);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const lm = lmAt(data, video.currentTime);
      if (kind !== "scheletro") drawSagoma(ctx, canvas.width, canvas.height, lm, handRef.current, null, kind === "sagoma");
      if (lm && kind !== "sagoma") drawPose(ctx, canvas.width, canvas.height, lm, handRef.current, null);
    };
    paint();
    rec.start(1000);
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
    let lastUi = 0;
    let lastT = -1;
    let stuckSince = performance.now();
    const step = () => {
      if (done) return;
      if (cancel.current) {
        stop();
        return;
      }
      paint();
      const now = performance.now();
      // aggiorna la barra 4 volte al secondo, non a ogni fotogramma (ridisegnare la pagina rallenta il video)
      if (now - lastUi > 250) {
        lastUi = now;
        setProgress(Math.min(1, (video.currentTime - from) / Math.max(0.01, to - from)));
      }
      if (video.currentTime >= to - 0.01 || video.ended) stop();
    };
    const loop = () => {
      step();
      if (done) return;
      if (withFrame) (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => number }).requestVideoFrameCallback(loop);
      else requestAnimationFrame(loop);
    };
    // guardia: se il video si ferma (buffer, schermo, permessi) lo riavvio; se non riparte chiudo comunque il file
    watchdog = window.setInterval(() => {
      if (done) return;
      const t = video.currentTime;
      if (Math.abs(t - lastT) > 1e-3) {
        lastT = t;
        stuckSince = performance.now();
        return;
      }
      step();
      if (video.paused && !done) void video.play().catch(() => undefined);
      if (performance.now() - stuckSince > 6000) stop();
    }, 400);
    video.addEventListener("ended", stop, { once: true });
    try {
      await video.play();
    } catch {
      stop();
      return;
    }
    loop();
  }

  /** Salva numeri e miniatura dell'analisi nel profilo, per i confronti nel tempo e nel gruppo. */
  async function storeAnalysis(proData?: ProSave) {
    const media = kind === "video" ? videoRef.current : imageRef.current;
    if (!media) return;
    setSaveState("busy");
    try {
      // fotogramma dell'ancoraggio: porto il video lì prima di fare la miniatura
      let frameLm = lastLm.current;
      if (proData?.at != null && kind === "video" && videoRef.current) {
        videoRef.current.pause();
        await seekTo(videoRef.current, proData.at);
        frameLm = lmAt(samples, proData.at) ?? frameLm;
      }
      const k = (proData ? 480 : 360) / Math.max(size.w, size.h);
      const c = document.createElement("canvas");
      c.width = Math.round(size.w * k);
      c.height = Math.round(size.h * k);
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Miniatura non riuscita.");
      ctx.drawImage(media, 0, 0, c.width, c.height);
      if (look !== "scheletro") drawSagoma(ctx, c.width, c.height, frameLm, effHand, null, look === "sagoma");
      if (frameLm && look !== "sagoma") drawPose(ctx, c.width, c.height, frameLm, effHand, null);
      if (proData && frameLm && look !== "sagoma") drawPro(ctx, c.width, c.height, frameLm, effHand);
      let thumb = c.toDataURL("image/jpeg", 0.72);
      if (thumb.length > 150_000) thumb = c.toDataURL("image/jpeg", 0.5);
      const m = shot?.at ?? now;
      await saveGesture({
        data: {
          title: saveTitle.trim() || (proData ? `Analisi pro · ${proData.total}/100` : kind === "video" ? "Video del gesto" : "Foto del gesto"),
          kind: kind === "video" ? "video" : "foto",
          hand: effHand,
          score: proData ? proData.total : (shot?.score ?? null),
          shots: analysis.shots.length,
          anchorS: shot?.anchorTime ?? null,
          drawS: shot?.drawTime ?? null,
          lineDeg: m?.line ?? null,
          bowDeg: m?.bow ?? null,
          shoulderDeg: m?.shoulder ?? null,
          jitter: shot?.jitter ?? null,
          distanceM: distance,
          data: {
            // dato completo: punti del corpo, sequenza del tiro, angoli, misure in cm, tempi e postura per zone
            ...buildRecord({ lm: frameLm, samples, shot: shot ?? null, hand: effHand, aspect: size.w / Math.max(1, size.h), w: size.w, h: size.h, gear }),
            shoulderSide: m?.bowSh ?? null,
            draw: m?.draw ?? null,
            trunk: m?.trunk ?? null,
            handFace: m?.handFace ?? null,
            arrowTilt: gear?.arrow?.tilt ?? m?.arrowTilt ?? null,
            cant: gear?.bow?.cant ?? null,
            checks: shot?.checks.map((ch) => `${ch.ok ? "ok" : ch.warn ? "attenzione" : "no"}: ${ch.text}`) ?? [],
            spread: analysis.spread,
            pro: proData ? { total: proData.total, areas: proData.areas, issues: proData.issues, m: proData.m, setup: proData.setup } : undefined,
          },
          thumb,
        },
      });
      setSaveState("ok");
      setSaveTitle("");
    } catch (e) {
      setSaveState(e instanceof Error ? e.message : "Salvataggio non riuscito.");
    }
  }

  const ratio = size.w / size.h;
  const frameStep = 1 / 30;

  function setZoom(z: number, x: number, y: number) {
    const el = box.current;
    if (!el) return;
    const W = el.clientWidth;
    const H = el.clientHeight;
    const zz = Math.max(1, Math.min(5, z));
    const next = { z: zz, x: Math.max(W * (1 - zz), Math.min(0, x)), y: Math.max(H * (1 - zz), Math.min(0, y)) };
    zoomRef.current = next;
    setZoomV(next);
  }
  /** ingrandisce tenendo fermo il punto sotto le dita */
  function zoomAt(f: number, cx: number, cy: number) {
    const { z, x, y } = zoomRef.current;
    const nz = Math.max(1, Math.min(5, z * f));
    setZoom(nz, cx - ((cx - x) * nz) / z, cy - ((cy - y) * nz) / z);
  }
  const zoomOn = !cropMode && look !== "sagoma";
  function zoomDown(e: RPointerEvent<HTMLDivElement>) {
    if (!zoomOn) return;
    const g = gesture.current;
    g.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pts.size === 1) g.moved = 0;
    if (g.pts.size === 2) {
      const [a, b] = [...g.pts.values()];
      g.pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }
  function zoomMove(e: RPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    const prev = g.pts.get(e.pointerId);
    if (!prev || !zoomOn) return;
    g.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = e.currentTarget.getBoundingClientRect();
    if (g.pts.size === 2) {
      const [a, b] = [...g.pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.pinch > 0) zoomAt(d / g.pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      g.pinch = d;
      g.moved += 20;
    } else if (zoomRef.current.z > 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      g.moved += Math.abs(dx) + Math.abs(dy);
      setZoom(zoomRef.current.z, zoomRef.current.x + dx, zoomRef.current.y + dy);
    }
  }
  function zoomUp(e: RPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    g.pts.delete(e.pointerId);
    if (g.pts.size < 2) g.pinch = 0;
  }

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
      {sideFlip ? <p className="text-xs text-muted">Nel video l'arco è nell'altra mano (video specchiato o arciere ripreso da dietro): l'analisi segue il video.</p> : null}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        Precisione:
        {(["lite", "full", "heavy"] as const).map((q) => (
          <button key={q} type="button" onClick={() => setQuality(q)} className={`min-h-9 rounded-full px-3 ${quality === q ? "bg-accent text-accent-fg" : "border border-line"}`}>{QUALITY_LABEL[q]}</button>
        ))}
        <span>{quality === "heavy" ? "più lento, il più preciso" : quality === "lite" ? "per telefoni lenti" : "consigliato"}</span>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} />
        <span><b className="text-text">Mani e viso (+100 punti)</b>: dita, presa dell'arco, bocca, naso e mento per un ancoraggio preciso. Cercati nell'analisi e a video fermo.</span>
      </label>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.05] p-1">
        <button type="button" onClick={() => setLive(false)} className={`min-h-11 rounded-xl text-sm font-semibold transition ${!live ? "bg-primary text-primary-fg" : "text-muted"}`}>Video o foto</button>
        <button type="button" onClick={() => { setLive(true); resetMedia(); setKind("none"); }} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition ${live ? "bg-primary text-primary-fg" : "text-muted"}`}><span className="h-2 w-2 rounded-full bg-red-500" />Dal vivo</button>
      </div>
      {live ? <LivePose hand={hand} quality={quality} onRecorded={(file) => { setLive(false); void onVideo(file); }} /> : null}
      <div className={`grid gap-2 ${live ? "hidden" : ""}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Video del gesto</p>
        <MediaPick kind="video" onFile={(file) => void onVideo(file)} />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Oppure una foto</p>
        <MediaPick kind="image" onFile={onPhoto} />
      </div>
      {busy ? <p className="text-sm">{busy}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {info && !error ? <p className="text-sm text-muted">{info}</p> : null}

      {kind !== "none" && src ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setCropMode((v) => !v); draftRef.current = null; }} className={`min-h-10 rounded-full px-3 text-sm ${cropMode ? "bg-accent text-accent-fg" : "border border-line"}`}>
              <Glyph name="scan" size={15} className="mr-1 inline -translate-y-px" />{cropMode ? "Trascina un rettangolo sull'arciere…" : crop ? "Rifai il riquadro" : "Inquadra l'arciere"}
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
            style={{ aspectRatio: `${size.w} / ${size.h}`, width: `min(100%, calc(70vh * ${ratio.toFixed(4)}))`, touchAction: zoomV.z > 1 ? "none" : "pan-y" }}
            onPointerDown={zoomDown}
            onPointerMove={zoomMove}
            onPointerUp={zoomUp}
            onPointerCancel={zoomUp}
            onClickCapture={(e) => {
              // dopo aver trascinato o pizzicato non parte il video
              if (gesture.current.moved > 8) {
                e.stopPropagation();
                gesture.current.moved = 0;
              }
            }}
          >
            <div className="absolute inset-0 origin-top-left" style={{ transform: `translate(${zoomV.x}px, ${zoomV.y}px) scale(${zoomV.z})` }}>
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
            </div>
            {/* Sagoma: il corpo in 3D (pelle, muscoli, scheletro) al posto del video, nello stesso riquadro */}
            {/* una volta aperta la vista 3D resta pronta (nascosta): cambiare vista non la ricrea, niente scatti */}
            {used3d ? (
              <div className={`absolute inset-0 z-[1] ${look === "sagoma" ? "" : "hidden"}`}>
                <Anatomy3D lmRef={lastLm} gearRef={gearRef} calFrames={calFrames} aspect={size.w / Math.max(1, size.h)} hand={effHand} inBox className="h-full" />
                {/* il video con lo scheletro, in piccolo: per confrontare la sagoma con l'arciere vero */}
                <canvas ref={pip} className="pointer-events-none absolute left-2 top-2 z-[2] rounded-lg shadow-lg ring-1 ring-white/40" aria-label="Il video con lo scheletro e i punti rilevati" />
              </div>
            ) : null}
            {zoomOn ? (
              <div className="absolute bottom-2 left-2 z-[2] flex items-center gap-1 rounded-full bg-[#14181c]/75 p-1 text-xs font-semibold text-[#f4f1ea]">
                <button type="button" aria-label="Rimpicciolisci" onClick={() => { const el = box.current; if (el) zoomAt(1 / 1.5, el.clientWidth / 2, el.clientHeight / 2); }} className="grid h-8 w-8 place-items-center rounded-full text-base">−</button>
                <button type="button" aria-label="Zoom normale" onClick={() => setZoom(1, 0, 0)} className="min-h-8 rounded-full px-1.5 tabular-nums">{zoomV.z.toFixed(1).replace(".", ",")}×</button>
                <button type="button" aria-label="Ingrandisci" onClick={() => { const el = box.current; if (el) zoomAt(1.5, el.clientWidth / 2, el.clientHeight / 2); }} className="grid h-8 w-8 place-items-center rounded-full text-base">+</button>
              </div>
            ) : null}
            <div className="absolute right-2 top-2 z-[2] flex gap-1 rounded-full bg-[#14181c]/75 p-1 text-xs font-semibold text-[#f4f1ea]">
              {([["scheletro", "Scheletro"], ["sagoma", "Sagoma"], ["mista", "Mista"]] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => { setLook(k); if (k === "scheletro") setShowPose(true); }} className={`min-h-8 rounded-full px-2.5 ${look === k ? "bg-[#3ee08f] text-[#04140c]" : ""}`}>{label}</button>
              ))}
              {look === "scheletro" ? (
                <button type="button" onClick={() => setShowPose((v) => !v)} className="min-h-8 rounded-full px-2" aria-label="Mostra o nascondi lo scheletro"><Glyph name="eye" size={15} className={showPose ? "" : "opacity-40"} /></button>
              ) : null}
            </div>
            {progress != null ? (
              <div className="absolute inset-x-0 bottom-0 z-[3] bg-[#14181c]/80 p-2 text-xs text-[#f4f1ea]">
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
                <span className="text-xs text-muted">Parte:</span>
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
                  <button type="button" disabled={!duration || Boolean(busy)} onClick={() => void scanAll()} className="min-h-11 rounded-xl bg-accent px-3 text-sm font-semibold text-accent-fg disabled:opacity-60"><Glyph name="scan" size={15} className="mr-1 inline -translate-y-px" />{range ? "Analizza la parte" : "Analizza tutto il video"}</button>
                )}
                <button type="button" onClick={snapshot} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold"><IconLabel icon="download" size={15}>Salva fotogramma</IconLabel></button>
                <button type="button" disabled={recording || progress != null} onClick={() => void recordAnnotated()} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold disabled:opacity-60">{recording ? "● Registro…" : look === "scheletro" ? "⏺ Salva video con scheletro" : look === "sagoma" ? "⏺ Salva video 3D in HD" : "⏺ Salva video con sagoma"}</button>
                <button type="button" disabled={!samples.length} onClick={exportCsv} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold disabled:opacity-60"><IconLabel icon="download" size={15}>Dati CSV</IconLabel></button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={snapshot} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold"><IconLabel icon="download" size={15}>Salva l'immagine con lo scheletro</IconLabel></button>
          )}

          <Readout m={now} gear={gear} distance={distance} />

          <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.04] px-3 py-2">
            <span className="text-sm font-semibold">Analisi pro <span className="text-xs font-normal text-muted">testa, polsi, postura, allungo</span></span>
            <button
              type="button"
              aria-pressed={pro}
              onClick={() => {
                const next = !pro;
                setProState(next);
                proRef.current = next;
                try { localStorage.setItem("aa-pose-pro", next ? "1" : "0"); } catch { /* niente */ }
                paintOverlay(lastLm.current);
              }}
              className={`relative h-7 w-12 rounded-full transition ${pro ? "bg-primary" : "bg-white/15"}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${pro ? "left-6" : "left-1"}`} />
            </button>
          </div>
          {pro ? (
            <ProPanel
              lm={lastLm.current}
              samples={samples}
              shot={kind === "video" ? shot : null}
              hand={effHand}
              aspect={size.w / size.h}
              gear={gear}
              saveState={saveState}
              onSave={(p) => void storeAnalysis(p)}
            />
          ) : null}

          {now ? (
            <div className="grid gap-2 rounded-xl border border-line bg-elev p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><Glyph name="save" size={16} />Salva questa analisi nel tuo profilo</p>
              <p className="text-xs text-muted">Restano i numeri e una miniatura (il video resta sul telefono): così vedi i progressi nel tempo e la postura migliore del gruppo.{kind === "video" && !samples.length ? " Per tempi e punteggio premi prima «Analizza»." : ""}</p>
              <div className="flex gap-2">
                <input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} placeholder="Titolo, es. 18 m sera" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-transparent px-3 text-sm" />
                <button type="button" disabled={saveState === "busy"} onClick={() => void storeAnalysis()} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-60">{saveState === "busy" ? "Salvo…" : "Salva"}</button>
              </div>
              {saveState === "ok" ? <p className="text-xs text-primary"><StatusMark state="ok" />Salvata nello storico. <Link to="/gesti" className="font-semibold underline underline-offset-2">Apri lo storico delle analisi</Link></p> : saveState && saveState !== "busy" ? <p className="text-xs text-danger">{saveState}</p> : null}
            </div>
          ) : null}

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
    // solo arco e freccia credibili: niente archi di altri arcieri, niente freccia a riposo
    return validateGear(detectGear(source, W, H, lm, hand), lm, hand, W / H);
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
          Ripresa a circa {distance.toFixed(1)} m dall'arciere (stima dalle spalle)
          {distance < 2.5 ? ": un po' vicino, allontanati" : distance > 8 ? ": lontano, avvicinati o usa il riquadro" : ": distanza giusta"}.
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
          <li key={c.text}><StatusMark state={c.ok ? "ok" : c.warn ? "warn" : "bad"} />{c.text}</li>
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

export function drawPose(ctx: CanvasRenderingContext2D, w: number, h: number, lm: Landmark[], hand: Hand, gear: Gear | null) {
  drawPoseBody(ctx, w, h, lm, hand, gear);
  drawExtras(ctx, w, h, lm);
}

/** dita e viso (i 100 punti in più): linee sottili sulle dita, punti su bocca, naso, occhi e mento */
function drawExtras(ctx: CanvasRenderingContext2D, w: number, h: number, lm: Landmark[]) {
  if (lm.length < LM_TOTAL) return;
  const s = Math.max(0.6, Math.min(w, h) / 520);
  ctx.lineCap = "round";
  for (const base of [HAND_L, HAND_R]) {
    if ((lm[base].visibility ?? 0) < 0.5) continue;
    ctx.strokeStyle = "rgba(255,214,120,0.95)";
    ctx.lineWidth = 1.1 * s;
    ctx.beginPath();
    for (const [a, b] of HAND_LINKS) {
      ctx.moveTo(lm[base + a].x * w, lm[base + a].y * h);
      ctx.lineTo(lm[base + b].x * w, lm[base + b].y * h);
    }
    ctx.stroke();
    ctx.fillStyle = "#ffd678";
    for (let k = 0; k < 21; k++) {
      ctx.beginPath();
      ctx.arc(lm[base + k].x * w, lm[base + k].y * h, (k % 4 === 0 ? 1.8 : 1.2) * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if ((lm[FACE0].visibility ?? 0) >= 0.5) {
    // contorno delle labbra (i primi 20 punti) e il resto come puntini
    ctx.strokeStyle = "rgba(255,138,170,0.9)";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) {
      const p = lm[FACE0 + (k % 20)];
      if (k) ctx.lineTo(p.x * w, p.y * h);
      else ctx.moveTo(p.x * w, p.y * h);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(140,220,255,0.95)";
    for (let k = 20; k < FACE_IDS.length; k++) {
      const p = lm[FACE0 + k];
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 1.1 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPoseBody(ctx: CanvasRenderingContext2D, w: number, h: number, lm: Landmark[], hand: Hand, gear: Gear | null) {
  const s = Math.max(0.6, Math.min(w, h) / 520);
  const at = (i: number) => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 });
  const { bow, draw } = sides(hand);
  ctx.lineCap = "round";
  if (gear?.arrow) {
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 1.8 * s;
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
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.moveTo(bw.x, bw.y);
      ctx.lineTo(dw.x, dw.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (gear?.bow) {
    ctx.strokeStyle = "#a3e635";
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.moveTo(gear.bow.x1 * w, gear.bow.y1 * h);
    ctx.lineTo(gear.bow.x2 * w, gear.bow.y2 * h);
    ctx.stroke();
  }
  ctx.strokeStyle = "#4aa3ff";
  ctx.lineWidth = 1.6 * s;
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
  ctx.lineWidth = 1.8 * s;
  ctx.beginPath();
  ctx.moveTo(l.x, l.y);
  ctx.lineTo(r.x, r.y);
  ctx.stroke();
  for (const i of JOINTS) {
    if (!lm[i]) continue;
    const p = at(i);
    if (p.v < 0.4) continue;
    ctx.beginPath();
    ctx.fillStyle = i === draw[1] || i === bow[1] ? "#ef4444" : i >= 29 ? "#34d399" : i >= 17 && i <= 22 ? "#f472b6" : "#4aa3ff";
    ctx.arc(p.x, p.y, (i >= 17 && i <= 22 ? 2 : 2.6) * s, 0, Math.PI * 2);
    ctx.fill();
  }
  const m = metricsOf(lm, hand, w / h, h);
  const label = (text: string, x: number, y: number, color: string) => {
    ctx.font = `600 ${Math.round(13 * s)}px system-ui, sans-serif`;
    const tw = ctx.measureText(text).width;
    // posto libero: le etichette non si coprono a vicenda
    const at0 = placeLabel(x - 5 * s, y - 14 * s, tw + 10 * s, 19 * s, w, h);
    const px = at0.x + 5 * s;
    const py = at0.y + 14 * s;
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
    const mark = (good: boolean) => (good ? "✓ " : "! ");
    // gomito in linea e braccio teso hanno senso solo quando l'arciere tira: a riposo non si giudicano
    if (isDrawing(m)) label(`${mark(m.line >= 168)}Gomito in linea ${m.line.toFixed(0)}°`, de.x + 16 * s, de.y - 6 * s, m.line >= 168 ? "#b9ffd9" : "#fde68a");
    if (m.bowUp) label(`${mark(m.bow >= 165)}Braccio arco ${m.bow.toFixed(0)}°`, be.x + 16 * s, be.y + 22 * s, m.bow >= 165 ? "#b9ffd9" : "#fde68a");
    label(`${mark(Math.abs(m.shoulder) <= 4)}Spalle ${Math.abs(m.shoulder).toFixed(1)}°`, (l.x + r.x) / 2 - 30 * s, Math.min(l.y, r.y) - 12 * s, Math.abs(m.shoulder) <= 4 ? "#b9ffd9" : "#fde68a");
    if (m.handFace < 0.85) label("✓ Ancorato", at(draw[2]).x - 30 * s, at(draw[2]).y + 26 * s, "#b9ffd9");
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
  // arco, corda e freccia ricostruiti dalle mani, in scala con il corpo
  const kit = archeryKit(lm, w, h, hand, gear);
  if (kit) {
    const { grip, nock, u, n, tipUp, tipDown, recUp, recDown, ctrlUp, ctrlDown, arrowTip, drawn } = kit;
    ctx.shadowColor = "#b9ffd9";
    ctx.shadowBlur = 6 * s;
    // flettenti
    ctx.strokeStyle = "rgba(233,255,243,0.92)";
    ctx.lineWidth = 3.2 * s;
    ctx.beginPath();
    ctx.moveTo(recUp.x, recUp.y);
    ctx.lineTo(tipUp.x, tipUp.y);
    ctx.quadraticCurveTo(ctrlUp.x, ctrlUp.y, grip.x, grip.y);
    ctx.quadraticCurveTo(ctrlDown.x, ctrlDown.y, tipDown.x, tipDown.y);
    ctx.lineTo(recDown.x, recDown.y);
    ctx.stroke();
    // impugnatura
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.moveTo(grip.x + n.x * kit.px * 0.06, grip.y + n.y * kit.px * 0.06);
    ctx.lineTo(grip.x - n.x * kit.px * 0.06, grip.y - n.y * kit.px * 0.06);
    ctx.stroke();
    // corda: dalle punte alla cocca se è in trazione
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(233,255,243,0.75)";
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(tipUp.x, tipUp.y);
    if (drawn) ctx.lineTo(nock.x, nock.y);
    ctx.lineTo(tipDown.x, tipDown.y);
    ctx.stroke();
    // freccia: asta, penne verso la cocca, punta oltre l'arco
    ctx.strokeStyle = "#ffd36b";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(nock.x, nock.y);
    ctx.lineTo(arrowTip.x, arrowTip.y);
    ctx.stroke();
    ctx.fillStyle = "#ffd36b";
    ctx.beginPath();
    ctx.moveTo(arrowTip.x + u.x * 8 * s, arrowTip.y + u.y * 8 * s);
    ctx.lineTo(arrowTip.x + n.x * 3 * s, arrowTip.y + n.y * 3 * s);
    ctx.lineTo(arrowTip.x - n.x * 3 * s, arrowTip.y - n.y * 3 * s);
    ctx.closePath();
    ctx.fill();
    for (const side of [1, -1]) {
      const f0 = { x: nock.x + u.x * kit.px * 0.03, y: nock.y + u.y * kit.px * 0.03 };
      const f1 = { x: nock.x + u.x * kit.px * 0.11, y: nock.y + u.y * kit.px * 0.11 };
      ctx.fillStyle = "rgba(255,90,90,0.85)";
      ctx.beginPath();
      ctx.moveTo(f0.x, f0.y);
      ctx.lineTo(f0.x + n.x * side * kit.px * 0.025, f0.y + n.y * side * kit.px * 0.025);
      ctx.lineTo(f1.x, f1.y);
      ctx.closePath();
      ctx.fill();
    }
    // misure in cm
    const rows = kit.measures;
    ctx.font = `600 ${Math.round(11 * s)}px system-ui, sans-serif`;
    const tw = Math.max(...rows.map((r) => ctx.measureText(r).width));
    const bx = 8 * s;
    const by = h - (rows.length * 15 + 14) * s;
    ctx.fillStyle = "rgba(3,12,9,0.78)";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(bx, by, tw + 16 * s, (rows.length * 15 + 8) * s, 8 * s);
    else ctx.rect(bx, by, tw + 16 * s, (rows.length * 15 + 8) * s);
    ctx.fill();
    ctx.fillStyle = "#b9ffd9";
    rows.forEach((r, i) => ctx.fillText(r, bx + 8 * s, by + (15 + i * 15) * s));
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
    return a.lm.map((p, i) => mixLm(p, b.lm![i], f));
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

/**
 * Scansione dal vivo con la fotocamera: scheletro e punti pro sopra all'immagine mentre tiri,
 * angoli principali in tempo reale e "Registra" per fare una ripresa. A ripresa finita il video
 * passa all'analisi completa (fasi, tempi, analisi pro) e resta sul telefono.
 */
function LivePose({ hand, quality, onRecorded }: { hand: Hand; quality: Quality; onRecorded: (file: File) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const over = useRef<HTMLCanvasElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const work = useRef<HTMLCanvasElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<{ r: MediaRecorder; chunks: Blob[]; type: string } | null>(null);
  const lmRef = useRef<Landmark[] | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [on, setOn] = useState(false);
  const [err, setErr] = useState("");
  const [lm, setLm] = useState<Landmark[] | null>(null);
  const [m, setM] = useState<Metrics | null>(null);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [ratio, setRatio] = useState(9 / 16);
  const [saveState, setSaveState] = useState("");

  async function start(face = facing) {
    setErr("");
    try {
      stop();
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      stream.current = s;
      const v = video.current;
      if (!v) return;
      v.srcObject = s;
      await v.play();
      setRatio((v.videoWidth || 9) / (v.videoHeight || 16));
      setOn(true);
      await engine(quality);
    } catch (e) {
      setErr(e instanceof Error && /Permission|NotAllowed/i.test(e.name + e.message) ? "Serve il permesso della fotocamera: consentilo nelle impostazioni del browser." : "Non riesco ad aprire la fotocamera.");
    }
  }

  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setOn(false);
  }

  useEffect(() => () => {
    if (rec.current?.r.state === "recording") rec.current.r.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // rilevamento continuo (~15 al secondo) e disegno sopra al video
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let busy = false;
    let last = 0;
    let live = true;
    const tick = async (now: number) => {
      if (!live) return;
      raf = requestAnimationFrame((t) => void tick(t));
      const v = video.current;
      if (!v || busy || v.readyState < 2 || now - last < 66) return;
      busy = true;
      last = now;
      try {
        const marker = await engine(quality);
        const W = v.videoWidth;
        const H = v.videoHeight;
        const k = Math.min(1, 640 / Math.max(W, H));
        const c = work.current ?? (work.current = document.createElement("canvas"));
        c.width = Math.round(W * k);
        c.height = Math.round(H * k);
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const poses = marker.detect(c).landmarks ?? [];
        const area = (p: Landmark[]) => {
          const b = personBox(p, 0);
          return b ? b.w * b.h : 0;
        };
        const best = [...poses].sort((a, b) => area(b) - area(a))[0] ?? null;
        const next = best ? smoothLm(lmRef.current, best, 0.55) : null;
        lmRef.current = next;
        setLm(next);
        setM(next ? metricsOf(next, hand, W / H, H) : null);
        paint(next);
      } catch {
        /* fotogramma saltato */
      } finally {
        busy = false;
      }
    };
    raf = requestAnimationFrame((t) => void tick(t));
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, quality, hand]);

  function paint(points: Landmark[] | null) {
    const c = over.current;
    const h = holder.current;
    if (!c || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(h.clientWidth * dpr);
    const hh = Math.round(h.clientHeight * dpr);
    if (c.width !== w || c.height !== hh) {
      c.width = w;
      c.height = hh;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, hh);
    if (!points) return;
    drawPose(ctx, w, hh, points, hand, null);
    drawPro(ctx, w, hh, points, hand);
  }

  function record() {
    const s = stream.current;
    if (!s) return;
    const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
    const type = types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
    try {
      const r = new MediaRecorder(s, type ? { mimeType: type, videoBitsPerSecond: 6_000_000 } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        const mime = r.mimeType || type || "video/webm";
        const blob = new Blob(chunks, { type: mime });
        const ext = mime.includes("mp4") ? "mp4" : "webm";
        setRecording(false);
        if (blob.size > 0) onRecorded(new File([blob], `ripresa-tiro.${ext}`, { type: mime }));
      };
      r.start(500);
      rec.current = { r, chunks, type };
      setRecording(true);
      setSecs(0);
      if (navigator.vibrate) navigator.vibrate(20);
    } catch {
      setErr("Questo telefono non riesce a registrare dal browser: usa la fotocamera del telefono e carica il video.");
    }
  }

  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setSecs((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);

  async function saveLive(p: ProSave) {
    const v = video.current;
    const points = lmRef.current;
    if (!v || !points) return;
    setSaveState("busy");
    try {
      const k = 480 / Math.max(v.videoWidth, v.videoHeight);
      const c = document.createElement("canvas");
      c.width = Math.round(v.videoWidth * k);
      c.height = Math.round(v.videoHeight * k);
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Fotogramma non riuscito.");
      ctx.drawImage(v, 0, 0, c.width, c.height);
      drawPose(ctx, c.width, c.height, points, hand, null);
      drawPro(ctx, c.width, c.height, points, hand);
      let thumb = c.toDataURL("image/jpeg", 0.72);
      if (thumb.length > 150_000) thumb = c.toDataURL("image/jpeg", 0.5);
      const mm = metricsOf(points, hand, v.videoWidth / v.videoHeight, v.videoHeight);
      await saveGesture({
        data: {
          title: `Dal vivo · ${p.total}/100`,
          kind: "foto",
          hand,
          score: p.total,
          shots: 0,
          anchorS: null,
          drawS: null,
          lineDeg: mm?.line ?? null,
          bowDeg: mm?.bow ?? null,
          shoulderDeg: mm?.shoulder ?? null,
          jitter: null,
          distanceM: null,
          data: { ...buildRecord({ lm: points, samples: [], shot: null, hand, aspect: v.videoWidth / Math.max(1, v.videoHeight), w: v.videoWidth, h: v.videoHeight, gear: null }), pro: { total: p.total, areas: p.areas, issues: p.issues, m: p.m, setup: p.setup } },
          thumb,
        },
      });
      setSaveState("ok");
    } catch (e) {
      setSaveState(e instanceof Error ? e.message : "Salvataggio non riuscito.");
    }
  }

  const mirror = facing === "user";
  const ok = (good: boolean) => (good ? "text-emerald-300" : "text-amber-300");
  return (
    <div className="grid gap-3">
      <div
        ref={holder}
        className="relative mx-auto w-full overflow-hidden rounded-2xl bg-black"
        style={{ aspectRatio: `${ratio}`, maxHeight: "70vh", width: `min(100%, calc(70vh * ${ratio.toFixed(4)}))` }}
      >
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" style={{ transform: mirror ? "scaleX(-1)" : undefined }} />
        <canvas ref={over} className="pointer-events-none absolute inset-0 h-full w-full" style={{ transform: mirror ? "scaleX(-1)" : undefined }} />
        {!on ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="grid justify-items-center gap-3">
              <Glyph name="camera" size={40} className="text-white/80" />
              <p className="text-sm text-white/80">Appoggia il telefono di fronte all'arciere, a 3–5 metri, con tutto il corpo nell'inquadratura.</p>
              <button type="button" onClick={() => void start()} className="min-h-12 rounded-2xl bg-primary px-6 font-semibold text-primary-fg">Apri la fotocamera</button>
            </div>
          </div>
        ) : null}
        {on && m ? (
          <div className="absolute inset-x-2 bottom-2 grid grid-cols-3 gap-1 rounded-xl bg-black/60 p-1.5 text-center text-[0.7rem] text-white backdrop-blur">
            <span>Braccio arco<b className={`block font-display text-lg ${ok(m.bow >= 165)}`}>{m.bow.toFixed(0)}°</b></span>
            <span>Gomito in linea<b className={`block font-display text-lg ${ok(m.line >= 168)}`}>{m.line.toFixed(0)}°</b></span>
            <span>Spalle<b className={`block font-display text-lg ${ok(Math.abs(m.shoulder) <= 4)}`}>{Math.abs(m.shoulder).toFixed(0)}°</b></span>
          </div>
        ) : null}
        {on && !lm ? <p className="absolute inset-x-0 top-2 text-center text-xs text-white/80">Cerco l'arciere…</p> : null}
        {recording ? (
          <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />REC {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
          </span>
        ) : null}
      </div>
      {err ? <p className="text-sm text-danger">{err}</p> : null}
      {on ? (
        <div className="grid grid-cols-2 gap-2">
          {recording ? (
            <button type="button" onClick={() => rec.current?.r.stop()} className="col-span-2 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-red-600 font-semibold text-white">
              <span className="h-3.5 w-3.5 rounded-sm bg-white" /> Ferma e analizza la ripresa
            </button>
          ) : (
            <button type="button" onClick={record} className="col-span-2 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-red-600/90 font-semibold text-white">
              <span className="h-3.5 w-3.5 rounded-full bg-white" /> Registra una ripresa
            </button>
          )}
          <button type="button" disabled={recording} onClick={() => { const f = facing === "user" ? "environment" : "user"; setFacing(f); void start(f); }} className="min-h-11 rounded-xl border border-line text-sm font-semibold disabled:opacity-50">Gira fotocamera</button>
          <button type="button" disabled={recording} onClick={stop} className="min-h-11 rounded-xl border border-line text-sm font-semibold disabled:opacity-50">Chiudi fotocamera</button>
        </div>
      ) : null}
      {on ? <ProPanel lm={lm} samples={[]} shot={null} hand={hand} aspect={ratio} saveState={saveState} onSave={(p) => void saveLive(p)} /> : null}
    </div>
  );
}
