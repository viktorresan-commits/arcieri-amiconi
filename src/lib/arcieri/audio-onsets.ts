/**
 * Lo schiocco della corda nel suono del video. Al rilascio la corda torna avanti di colpo e fa un
 * rumore secco (più forte dell'impatto lontano sul paglione): è il segnale più preciso del momento in
 * cui la freccia parte, anche quando la mano della corda si muove poco (arco storico, longbow).
 *
 * Si guarda l'energia della derivata del segnale (le alte frequenze dello schiocco) a passi di 5 ms:
 * un colpo è un salto rispetto alla mediana dei 100 ms precedenti. La forza (z) è misurata in deviazioni
 * robuste (mediana e MAD) di tutto il video, così non dipende dal volume del telefono.
 */

export type Onset = { t: number; z: number };

export function audioOnsets(x: Float32Array, sr: number): Onset[] {
  const hop = Math.max(1, Math.round(sr * 0.005));
  const n = Math.floor((x.length - 1) / hop);
  if (n < 60) return [];
  const le = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const a = i * hop + 1;
    for (let k = a; k < a + hop; k++) {
      const d = x[k] - x[k - 1];
      s += d * d;
    }
    le[i] = Math.log(Math.sqrt(s / hop) + 1e-6);
  }
  const win: number[] = [];
  const rise = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 24);
    const b = Math.max(a + 1, i - 4);
    win.length = 0;
    for (let k = a; k < b; k++) win.push(le[k]);
    win.sort((p, q) => p - q);
    rise[i] = le[i] - win[win.length >> 1];
  }
  const sorted = Array.from(rise).sort((p, q) => p - q);
  const med = sorted[sorted.length >> 1];
  const dev = Array.from(rise, (v) => Math.abs(v - med)).sort((p, q) => p - q);
  const mad = dev[dev.length >> 1] || 1e-3;
  const out: Onset[] = [];
  const gap = Math.round(0.15 / 0.005);
  for (let i = 1; i < n - 1; i++) {
    const z = (rise[i] - med) / mad;
    // l'avvio della registrazione fa sempre un colpo: i primi 150 ms non contano
    if (z < 5 || i * 0.005 < 0.15 || rise[i] < rise[i - 1] || rise[i] < rise[i + 1]) continue;
    const t = (i * hop) / sr;
    const last = out[out.length - 1];
    if (last && (i * hop) / sr - last.t < gap * 0.005) {
      if (z > last.z) out[out.length - 1] = { t, z };
      continue;
    }
    out.push({ t, z });
  }
  return out;
}

/** il suono del video (mono, 16 kHz); null se il file non ha audio o il telefono non lo decodifica */
export async function videoAudio(url: string, maxBytes = 220e6): Promise<{ x: Float32Array; sr: number } | null> {
  try {
    const res = await fetch(url);
    const size = Number(res.headers.get("content-length") ?? 0);
    if (size > maxBytes) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) return null;
    const w = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
    const AC = w.OfflineAudioContext ?? w.webkitOfflineAudioContext;
    if (!AC) return null;
    const ctx = new AC(1, 16000, 16000);
    const audio = await ctx.decodeAudioData(buf);
    const len = audio.length;
    const x = new Float32Array(len);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const d = audio.getChannelData(c);
      for (let i = 0; i < len; i++) x[i] += d[i] / audio.numberOfChannels;
    }
    // video al rallentatore dei telefoni: traccia muta
    let peak = 0;
    for (let i = 0; i < len; i += 7) peak = Math.max(peak, Math.abs(x[i]));
    if (peak < 1e-4) return null;
    return { x, sr: audio.sampleRate };
  } catch {
    return null;
  }
}
