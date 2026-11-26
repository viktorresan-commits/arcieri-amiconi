/**
 * Foto e video ridotti sul telefono prima di partire: le foto a 1280 px in JPEG, i video brevi a 640 px
 * ricodificati con il registratore del browser (senza audio), così stanno in una sola richiesta.
 */

export function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Non riesco a leggere il file."));
    r.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Questa immagine non si apre: prova con una foto JPG o PNG."));
    img.src = src;
  });
}

function draw(img: HTMLImageElement, max: number, q: number) {
  const k = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * k));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Il telefono non riesce a ridurre la foto.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", q);
}

/** foto per l'annuncio: lato lungo 1280 px, sotto i 440 kB */
export async function compressPhoto(file: Blob | string): Promise<string> {
  const url = typeof file === "string" ? file : URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    for (const [max, q] of [
      [1280, 0.8],
      [1100, 0.72],
      [900, 0.66],
      [720, 0.6],
    ] as const) {
      const out = draw(img, max, q);
      if (out.length <= 440_000) return out;
    }
    return draw(img, 600, 0.55);
  } finally {
    if (typeof file !== "string") URL.revokeObjectURL(url);
  }
}

/** miniatura per l'elenco: 360 px */
export async function thumbOf(src: string): Promise<string> {
  const img = await loadImage(src);
  const out = draw(img, 360, 0.72);
  return out.length <= 58_000 ? out : draw(img, 260, 0.6);
}

/**
 * Video breve per l'annuncio: se è già leggero va così; altrimenti si ricodifica a 640 px e al massimo
 * `maxSeconds` secondi (senza audio). Serve un browser con MediaRecorder.
 */
export async function compressVideo(file: File, onProgress?: (p: number) => void, maxSeconds = 20): Promise<string> {
  if (file.size <= 2_300_000) return readAsDataURL(file);
  if (typeof MediaRecorder === "undefined") throw new Error("Questo telefono non riesce a ridurre il video: scegline uno più corto o metti un link.");
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Questo video non si apre sul telefono."));
    });
    const k = Math.min(1, 640 / Math.max(video.videoWidth || 640, video.videoHeight || 360));
    const w = Math.max(2, Math.round(((video.videoWidth || 640) * k) / 2) * 2);
    const h = Math.max(2, Math.round(((video.videoHeight || 360) * k) / 2) * 2);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof canvas.captureStream !== "function") throw new Error("Questo telefono non riesce a ridurre il video: metti un link.");
    const stream = canvas.captureStream(24);
    const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 650_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const finished = new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: (rec.mimeType || type || "video/webm").split(";")[0] }));
    });
    const dur = Math.min(maxSeconds, Number.isFinite(video.duration) && video.duration > 0 ? video.duration : maxSeconds);
    let raf = 0;
    const stop = () => {
      cancelAnimationFrame(raf);
      video.pause();
      if (rec.state !== "inactive") rec.stop();
    };
    const frame = () => {
      ctx.drawImage(video, 0, 0, w, h);
      onProgress?.(Math.min(1, video.currentTime / dur));
      if (video.currentTime >= dur || video.ended) return stop();
      raf = requestAnimationFrame(frame);
    };
    video.onended = stop;
    rec.start(500);
    await video.play();
    frame();
    const blob = await finished;
    if (blob.size > 2_600_000) throw new Error("Il video resta troppo pesante: scegline uno più corto (fino a 20 secondi).");
    return await readAsDataURL(blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}
