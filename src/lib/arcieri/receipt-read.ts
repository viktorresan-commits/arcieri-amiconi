/**
 * Lettura nel telefono di uno scontrino o di una fattura: il testo lo legge Tesseract (OCR che gira
 * nel browser, scaricato da jsDelivr la prima volta e poi tenuto in memoria), poi qui si ritrovano
 * negozio, data, totale e le righe con il prezzo; ogni riga ha una categoria dell'attrezzatura
 * indovinata dalle parole (frecce, punte, corda, parabraccio...). Niente servizi esterni.
 */

export type ReceiptItem = {
  name: string;
  qty: number;
  priceCents: number;
  category: string;
  toGear: boolean;
  /** comprato da te: si salva solo questo (un foglio a metà fra amici ha le righe segnate a mano) */
  mine: boolean;
  /** totale della riga stampato sul foglio (quantità per prezzo), se c'è */
  lineCents?: number;
  /** quantità, prezzo e totale della riga tornano fra loro */
  checked?: boolean;
  /** riga segnata a mano come tua */
  hand?: boolean;
};
export type ReceiptRead = { store: string; day: string | null; totalCents: number | null; items: ReceiptItem[]; text: string; /** sconto su tutto il foglio letto dalla stampa (le righe restano a prezzo pieno) */ discountCents: number | null; /** cosa si è capito, in una riga: righe trovate, sconto, righe segnate a mano */ note: string };

const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1";

type TessWorker = {
  setParameters: (p: Record<string, string>) => Promise<unknown>;
  recognize: (img: HTMLCanvasElement, opts?: Record<string, unknown>, output?: Record<string, boolean>) => Promise<{ data: { text?: string; tsv?: string | null } }>;
  terminate: () => Promise<unknown>;
};
type TessLib = { createWorker: (lang: string, oem: number, opts: Record<string, unknown>) => Promise<TessWorker> };

function loadTesseract(): Promise<TessLib> {
  const w = window as unknown as { Tesseract?: TessLib };
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  return new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = `${TESS}/dist/tesseract.min.js`;
    s.async = true;
    s.onload = () => (w.Tesseract ? ok(w.Tesseract) : ko(new Error("Lettore non disponibile.")));
    s.onerror = () => ko(new Error("Serve la connessione la prima volta, per scaricare il lettore."));
    document.head.appendChild(s);
  });
}

/**
 * foto pronta per la lettura: lato lungo ~2600 px, grigio, e la luce pareggiata. Ogni punto si divide
 * per il chiaro della carta lì intorno (media larga, calcolata su una copia piccola): ombre del telefono,
 * pieghe e angoli scuri spariscono e i numeri della colonna a destra restano neri su bianco.
 */
function prepare(img: HTMLImageElement): HTMLCanvasElement {
  const long = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const k = Math.min(1.6, 2600 / long);
  const c = document.createElement("canvas");
  const W = (c.width = Math.max(1, Math.round(img.naturalWidth * k)));
  const H = (c.height = Math.max(1, Math.round(img.naturalHeight * k)));
  const x = c.getContext("2d", { willReadFrequently: true });
  if (!x) return c;
  x.drawImage(img, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H);
  const p = d.data;
  const g = new Uint8ClampedArray(W * H);
  for (let i = 0, j = 0; j < g.length; i += 4, j += 1) g[j] = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11;
  // sfondo: media su un quadrato largo ~1/30 del foglio, su una griglia 4 volte più piccola
  const S = 4;
  const w = Math.ceil(W / S);
  const h = Math.ceil(H / S);
  const small = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1)
    for (let xx = 0; xx < w; xx += 1) {
      let t = 0;
      let n = 0;
      for (let dy = 0; dy < S; dy += 1) {
        const yy = y * S + dy;
        if (yy >= H) break;
        for (let dx = 0; dx < S; dx += 1) {
          const x2 = xx * S + dx;
          if (x2 >= W) break;
          t += g[yy * W + x2];
          n += 1;
        }
      }
      small[y * w + xx] = n ? t / n : 255;
    }
  const r = Math.max(2, Math.round(Math.max(w, h) / 60));
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y += 1) {
    let row = 0;
    for (let xx = 0; xx < w; xx += 1) {
      row += small[y * w + xx];
      I[(y + 1) * (w + 1) + xx + 1] = I[y * (w + 1) + xx + 1] + row;
    }
  }
  const bg = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let xx = 0; xx < w; xx += 1) {
      const x0 = Math.max(0, xx - r);
      const x1 = Math.min(w, xx + r + 1);
      const sum = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      bg[y * w + xx] = Math.max(1, (sum / ((y1 - y0) * (x1 - x0))) * 1.08);
    }
  }
  const out = new Uint8ClampedArray(W * H);
  const hist = new Uint32Array(256);
  for (let y = 0; y < H; y += 1)
    for (let xx = 0; xx < W; xx += 1) {
      const v = Math.min(255, (g[y * W + xx] / bg[Math.min(h - 1, (y / S) | 0) * w + Math.min(w - 1, (xx / S) | 0)]) * 255);
      out[y * W + xx] = v;
      hist[v | 0] += 1;
    }
  // contrasto: l'1,5% più scuro diventa nero
  let lo = 0;
  for (let acc = 0, v = 0; v < 256; v += 1) {
    acc += hist[v];
    if (acc > out.length * 0.015) {
      lo = v;
      break;
    }
  }
  const span = Math.max(40, 235 - lo);
  for (let i = 0, j = 0; j < out.length; i += 4, j += 1) {
    const v = Math.max(0, Math.min(255, ((out[j] - lo) / span) * 255));
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  x.putImageData(d, 0, 0);
  return c;
}

/** foto da salvare con lo scontrino: lato lungo 1000 px, JPEG leggero */
export function receiptThumb(img: HTMLImageElement): string {
  const long = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const k = Math.min(1, 1000 / long);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
  let q = 0.62;
  let url = c.toDataURL("image/jpeg", q);
  while (url.length > 330_000 && q > 0.3) {
    q -= 0.08;
    url = c.toDataURL("image/jpeg", q);
  }
  return url;
}

/**
 * Le righe del foglio ricostruite dalle parole e dalla loro posizione: Tesseract a volte legge una
 * tabella a colonne (prima tutte le descrizioni, poi tutti i prezzi); qui le parole alla stessa altezza
 * tornano sulla stessa riga, anche con il foglio un po' storto.
 */
export function rowsFromTsv(tsv: string): string {
  type W = { b: string; t: string; x: number; y: number; w: number; h: number };
  const words: W[] = [];
  for (const line of tsv.split(/\r?\n/)) {
    const c = line.split("\t");
    if (c.length < 12 || c[0] !== "5") continue;
    const t = c.slice(11).join(" ").trim();
    const conf = Number(c[10]);
    if (!t || !(conf >= 0)) continue;
    words.push({ b: `${c[2]}.${c[3]}.${c[4]}`, t, x: Number(c[6]), y: Number(c[7]), w: Number(c[8]), h: Number(c[9]) });
  }
  if (!words.length) return "";
  const median = (a: number[]) => {
    const s = [...a].sort((p, q) => p - q);
    return s.length ? s[s.length >> 1] : 0;
  };
  // inclinazione: la pendenza mediana delle righe lunghe trovate da Tesseract
  const byLine = new Map<string, W[]>();
  for (const w of words) byLine.set(w.b, [...(byLine.get(w.b) ?? []), w]);
  const slopes: number[] = [];
  for (const ws of byLine.values()) {
    if (ws.length < 3) continue;
    const xs = ws.map((w) => w.x + w.w / 2);
    const ys = ws.map((w) => w.y + w.h / 2);
    if (Math.max(...xs) - Math.min(...xs) < 200) continue;
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    xs.forEach((xv, i) => {
      num += (xv - mx) * (ys[i] - my);
      den += (xv - mx) ** 2;
    });
    if (den) slopes.push(num / den);
  }
  const slope = Math.max(-0.2, Math.min(0.2, median(slopes)));
  const hs = median(words.map((w) => w.h)) || 10;
  const items = words.map((w) => ({ ...w, c: w.y + w.h / 2 - slope * (w.x + w.w / 2) })).sort((a, b) => a.c - b.c);
  const rows: (typeof items)[] = [];
  let cur: typeof items = [];
  for (const w of items) {
    if (cur.length && w.c - median(cur.map((q) => q.c)) > hs * 0.6) {
      rows.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) rows.push(cur);
  return rows.map((r) => r.sort((a, b) => a.x - b.x).map((w) => w.t).join(" ")).join("\n");
}

export async function readReceipt(img: HTMLImageElement, onProgress?: (p: number, what: string) => void): Promise<ReceiptRead> {
  onProgress?.(0.02, "Scarico il lettore");
  const T = await loadTesseract();
  let phase: [number, number] = [0.3, 0.4];
  const worker = await T.createWorker("ita", 1, {
    logger: (m: { status?: string; progress?: number }) => {
      const st = m.status ?? "";
      const pr = m.progress ?? 0;
      if (st.includes("recogniz")) onProgress?.(phase[0] + pr * phase[1], "Leggo lo scontrino");
      else if (st.includes("load") || st.includes("initializ")) onProgress?.(0.05 + pr * 0.22, "Preparo il lettore");
    },
  });
  try {
    onProgress?.(0.28, "Pareggio la luce della foto");
    const page = prepare(img);
    const texts: string[] = [];
    // primo giro: il foglio come un blocco unico (va bene con le tabelle), righe e posizione delle parole
    await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
    const a = (await worker.recognize(page, {}, { text: true, tsv: true })).data;
    texts.push(a.text ?? "");
    if (a.tsv) texts.push(rowsFromTsv(a.tsv));
    let read = combineReads(texts);
    // secondo giro, a parole sparse: serve se i conti non tornano o se ci sono righe a mano da leggere meglio
    if (!read.complete) {
      phase = [0.68, 0.3];
      onProgress?.(0.68, "Rileggo le parole una per una");
      await worker.setParameters({ tessedit_pageseg_mode: "11", preserve_interword_spaces: "1" });
      const b = (await worker.recognize(page, {}, { text: true, tsv: true })).data;
      if (b.tsv) texts.push(rowsFromTsv(b.tsv));
      read = combineReads(texts);
    }
    onProgress?.(1, "Fatto");
    const { complete: _done, ...rest } = read;
    return { ...rest, text: texts[0] ?? "" };
  } finally {
    void worker.terminate();
  }
}

const SKIP = /sub\s*tot|totale|iva\b|imponibile|contant|resto|bancomat|carta|pagament|elettronic|documento|commerciale|p\.?\s*iva|partita|c\.?\s*f\.?\b|scontrino|cassa\b|operatore|arrotond|n\.\s*doc|\brt\b|\btel\b|\bvia\b|piazza|di cui|importo|versato|non riscosso|ticket|resi\b|mastercard|visa\b|pos\b|transaz|autorizz|totali/i;

const cents = (raw: string) => {
  const t = raw.replace(/\s/g, "").replace(/'/g, "");
  const m = /^(-?)(\d{1,4}(?:[.]\d{3})*|\d+)[,.](\d{2})$/.exec(t);
  if (!m) return null;
  const whole = Number(m[2].replace(/\./g, ""));
  const v = whole * 100 + Number(m[3]);
  return m[1] ? -v : v;
};

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

const MONEY = /-?\d{1,4}(?:\.\d{3})*,\s?\d{2}(?!\d)|-?\d{1,4}\.\d{2}(?!\d)/g;
const letters = (t: string) => (t.match(/\p{L}/gu) ?? []).length;
const HEAD_SKIP = /ricevuta|fattura|cassa\b|causale|data\s*doc|documento|scontrino|cod\.?\s|descrizione|q\.?\s*t[aà]/i;

/** codice articolo in testa alla riga (PENN033-03, PULE024-01, 8012345678901): non fa parte del nome */
const stripCode = (t: string) => t.replace(/^[A-Z0-9]{3,10}[-/.][A-Z0-9]{1,4}\s+/i, "").replace(/^\d{6,}\s+/, "").replace(/^[A-Z]{2,5}\d{2,5}\s+/, "");

/** una riga scritta a mano sotto la tabella: «1 x20 € 13,40» → quanto hai speso e quanti pezzi (se si legge) */
type Hand = { amount: number | null; hint: number | null };

/** quello che si legge da un testo, prima di decidere quali righe sono tue */
type Base = { store: string; day: string | null; items: ReceiptItem[]; discount: number; total: number | null; hands: Hand[]; handLines: number };

function readBase(text: string): Base {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/[|¦\]\[{}]/g, " ").replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1);
  // negozio: la prima riga con parole vere, in alto (non «Ricevuta N.», «Cassa», le intestazioni della tabella)
  let store = "";
  for (const l of lines.slice(0, 8)) {
    if ((l.match(MONEY) ?? []).length) break;
    // una parola vera (4 lettere di fila, non «eeeee»), quasi tutto lettere: niente sporco letto dalla carta
    const real = (/\p{L}{5,}/u.test(l) || (l === l.toUpperCase() && /\p{L}{4,}/u.test(l))) && !/(\p{L})\1{3,}/u.test(l) && letters(l) >= l.replace(/\s/g, "").length * 0.6;
    if (real && letters(l) >= 4 && !SKIP.test(l) && !HEAD_SKIP.test(l) && !/causa|vendita|\bun\.|^cod/i.test(l) && !/\d{5}/.test(l)) {
      store = titleCase(l.replace(/[^\p{L}\d&'’ .-]/gu, "").trim()).slice(0, 60);
      break;
    }
  }
  let day: string | null = null;
  for (const l of lines) {
    const m = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(l);
    if (!m) continue;
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100) {
      day = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      break;
    }
  }
  let total: number | null = null;
  let totalRank = -1;
  let discount = 0;
  const hands: Hand[] = [];
  let handLines = 0;
  // dopo la riga dello sconto (o la prima riga a mano) si è sotto la tabella
  let below = false;
  const items: ReceiptItem[] = [];
  let pending: { q: number; unit: number } | null = null;
  let lastWasItem = false;
  // la riga di sopra era solo testo («FRECCE CARBONIO 6PZ»): può essere il nome della riga «2 x 24,99»
  let prevText = "";
  // il totale di riga già contato («49,98» sotto «2 x 24,99»): si salta
  let swallow: number | null = null;
  for (const raw of lines) {
    const textBefore = prevText;
    prevText = "";
    // via l'IVA in fondo alla riga («22%», «22 %», una lettera di codice)
    let l = raw;
    for (let k = 0; k < 3; k += 1) l = l.replace(/\s+\d{1,2}(?:[.,]\d+)?\s?%\s*$/, "").replace(/\s+[A-Z]\s*$/, "").replace(/\s+[;:.,'"~-]\s*$/, "").trim();
    const money = [...l.matchAll(MONEY)].map((m) => ({ v: cents(m[0]), i: m.index ?? 0 })).filter((m): m is { v: number; i: number } => m.v != null);
    // totale: «totale complessivo» vince, poi «totale» o «tot.» (anche scritto a mano), «importo pagato»...
    if (!/sub\s*tot|iva\b|imponibile|sconto/i.test(l)) {
      const rank = /totale\s+(complessivo|documento|fattura)/i.test(l) ? 3 : /\btotale\b|\btotal\b|\btot\b\.?/i.test(l) ? 2 : /importo\s+pagato|da\s+pagare|netto\s+a\s+pagare|pagato/i.test(l) ? 1 : -1;
      if (rank >= 0) {
        const v = money.length ? money[money.length - 1].v : null;
        if (v != null && v > 0 && rank >= totalRank) {
          total = v;
          totalRank = rank;
        }
        lastWasItem = false;
        continue;
      }
    }
    // sconto su tutto il foglio (riga a sé, anche quando la parola «Sconto» non si legge: solo cifre negative)
    if (money.length && (/^\s*(sconto|abbuono|promo)/i.test(l) || (letters(l) <= 2 && money.every((m) => m.v < 0)))) {
      discount += Math.abs(money[money.length - 1].v);
      if (items.length) below = true;
      lastWasItem = false;
      continue;
    }
    // sotto la tabella, a mano: poche lettere, un importo o «x 6» (sotto lo sconto basta una riga corta:
    // la grafia si legge male, ma la riga c'è)
    // il totale di riga già contato («49,98» sotto «2 x 24,99»): si salta
    if (swallow != null && money.length && letters(l) < 3 && Math.abs(money[money.length - 1].v - swallow) <= 2) {
      swallow = null;
      continue;
    }
    // a mano si scrive «x 6», «€» o il numerino davanti: una cifra da sola è il totale di una riga stampata
    const handish = letters(l.replace(/[xX×€]/g, "")) <= 3 && (/[xX×*%K]\s*\d/.test(l) || (money.length > 0 && /€|£|^\d\s+\S/.test(l)));
    if (items.length && l.length <= 32 && (handish || (below && l.length >= 3 && letters(l) <= 8 && !money.some((m) => m.v > 99_999)))) {
      below = true;
      const first = /^(\S+)\s+(.*)$/.exec(l);
      const rest = first && /^(\d|[^\w\s]{1,2})$/.test(first[1]) ? first[2] : l;
      const m = [...rest.matchAll(MONEY)];
      const amount = m.length ? cents(m[m.length - 1][0]) : null;
      const before = m.length ? rest.slice(0, m[m.length - 1].index) : rest;
      const hint = /(\d{1,3})/.exec(before.replace(/[€£]/g, " "))?.[1];
      handLines += 1;
      hands.push({ amount: amount != null && amount > 0 ? amount : null, hint: hint ? Number(hint) : null });
      lastWasItem = false;
      continue;
    }
    // «2 x 4,50» da sola: è della riga sopra se i conti tornano, altrimenti di quella sotto
    const only = /^(\d{1,2})\s*[xX*]\s*(\d{1,4}[,.]\d{2})\s*$/.exec(l);
    if (only) {
      const q = Number(only[1]);
      const unit = cents(only[2]) ?? 0;
      const last = items[items.length - 1];
      if (last && last.qty === 1 && q > 1 && Math.abs(last.priceCents - q * unit) <= 2) {
        last.qty = q;
        last.priceCents = unit;
        last.lineCents = q * unit;
        last.checked = true;
      } else if (textBefore) {
        const name = titleCase(stripCode(textBefore)).slice(0, 80);
        const category = guessCategory(name);
        items.push({ name, qty: q, priceCents: unit, category, toGear: category !== "altro", mine: true, lineCents: q * unit, checked: true });
        swallow = q * unit;
      } else pending = { q, unit };
      lastWasItem = false;
      continue;
    }
    if (!money.length) {
      if (letters(l) >= 3 && !SKIP.test(l) && !HEAD_SKIP.test(l)) prevText = l;
      // seguito della descrizione sulla riga sotto («GIALLO»)
      const last = items[items.length - 1];
      if (lastWasItem && last && letters(l) >= 3 && l.length <= 28 && !/\d{2,}/.test(l) && !SKIP.test(l) && !HEAD_SKIP.test(l)) {
        last.name = `${last.name} ${titleCase(l)}`.slice(0, 80);
        last.category = guessCategory(last.name);
      }
      lastWasItem = false;
      continue;
    }
    const v = money[money.length - 1].v;
    swallow = null;
    if (/sconto|abbuono/i.test(l) && v !== 0) {
      const last = items[items.length - 1];
      if (last) last.priceCents = Math.max(0, last.priceCents - Math.round(Math.abs(v) / (last.qty || 1)));
      lastWasItem = false;
      continue;
    }
    if (SKIP.test(l) || HEAD_SKIP.test(l) || v <= 0) {
      lastWasItem = false;
      continue;
    }
    // nome e quantità: il testo prima della prima cifra in euro; la quantità è il numero intero subito prima
    let head = l.slice(0, money[0].i).trim();
    let qty = 1;
    const tail = /\s(\d{1,4})\s*[+\-~^'—–]*\s*$/.exec(head);
    if (tail && money.length >= 2) {
      qty = Math.max(1, Math.min(999, Number(tail[1])));
      head = head.slice(0, tail.index).trim();
    }
    const lead = /^(\d{1,2})\s*[xX*]\s+/.exec(head);
    if (lead) {
      qty = Number(lead[1]);
      head = head.slice(lead[0].length);
    }
    const inner = /\s(\d{1,2})\s*[xX*]\s*\d{1,4}[,.]\d{2}\s*$/.exec(head);
    if (inner) {
      qty = Number(inner[1]);
      head = head.slice(0, inner.index);
    }
    // via il segno a mano in fondo alla descrizione («ROSSO 1», «30-35# 4»)
    let name = stripCode(head).replace(/\s\d{1,2}([,.]\d+)?\s*%.*$/, "").replace(/[*_=]+/g, " ").replace(/\s+\d[.,]?$/, "").replace(/\s+/g, " ").trim();
    if (letters(name) < 3) {
      lastWasItem = false;
      continue;
    }
    // i conti: quantità per prezzo di un pezzo uguale al totale della riga. Se la quantità letta non
    // torna (un segno a mano sopra la cifra), si prende quella che fa tornare i conti
    let unit = qty > 1 ? Math.round(v / qty) : v;
    let line: number | undefined;
    let checked = false;
    if (money.length >= 2) {
      const first = money[0].v;
      const tol = (t: number) => Math.max(2, t * 0.006);
      if (first > 0 && first < v) {
        if (Math.abs(first * qty - v) <= tol(v)) {
          unit = first;
          line = v;
          checked = true;
        } else {
          const k = Math.round(v / first);
          if (k >= 2 && k <= 999 && Math.abs(first * k - v) <= tol(v)) {
            qty = k;
            unit = first;
            line = v;
            checked = true;
          }
        }
      } else if (first === v && qty === 1) checked = true;
    }
    if (pending && qty === 1) {
      qty = pending.q;
      unit = Math.abs(v - pending.q * pending.unit) <= 2 ? pending.unit : Math.round(v / pending.q);
      line = v;
      checked = Math.abs(v - pending.q * pending.unit) <= 2;
    }
    pending = null;
    name = titleCase(name).slice(0, 80);
    const category = guessCategory(name);
    items.push({ name, qty, priceCents: unit, category, toGear: category !== "altro", mine: true, ...(line != null ? { lineCents: line } : {}), checked });
    lastWasItem = true;
  }
  return { store, day, items, discount, total, hands, handLines };
}

/** quanto vale una lettura: righe trovate, e di più quelle con i conti che tornano */
const scoreOf = (b: Base) => b.items.reduce((t, it) => t + (it.checked ? 2 : 1), 0);

/**
 * Le righe scritte a mano («1 x20 € 13,40», «4 x6 € 19,80», «tot. € 41,60»): ogni importo è un certo
 * numero di pezzi di una riga stampata (13,40 = 20 × 0,67). Si cerca la scelta che spiega più importi;
 * se qualche riga a mano non si legge ma il totale sì, si cerca la riga che fa tornare il totale.
 */
function allocate(items: ReceiptItem[], hands: Hand[], handLines: number, total: number | null) {
  const amounts = hands.filter((h): h is { amount: number; hint: number | null } => h.amount != null);
  const fits = (amount: number, it: ReceiptItem, hint: number | null) => {
    if (it.priceCents <= 0) return 0;
    const k = Math.round(amount / it.priceCents);
    // «x6» letto: i pezzi devono essere 6 (13,50 non sono 18 punte da 0,75)
    if (hint != null && hint >= 1 && hint <= 200 && hint !== k) return 0;
    return k >= 1 && k <= Math.max(it.qty, 1) && Math.abs(k * it.priceCents - amount) <= 1 ? k : 0;
  };
  let best: { pick: { i: number; k: number; amount: number }[]; score: number } = { pick: [], score: 0 };
  const walk = (j: number, used: Set<number>, pick: { i: number; k: number; amount: number }[], score: number) => {
    if (j === amounts.length) {
      const sum = pick.reduce((t, p) => t + p.amount, 0);
      const s = score + (total != null && pick.length && Math.abs(sum - total) <= 1 ? 6 : 0);
      if (s > best.score) best = { pick: [...pick], score: s };
      return;
    }
    walk(j + 1, used, pick, score);
    const a = amounts[j];
    items.forEach((it, i) => {
      if (used.has(i)) return;
      const k = fits(a.amount, it, a.hint);
      if (!k) return;
      used.add(i);
      pick.push({ i, k, amount: a.amount });
      walk(j + 1, used, pick, score + 10 + (a.hint === k ? 3 : 0));
      pick.pop();
      used.delete(i);
    });
  };
  if (amounts.length <= 8) walk(0, new Set(), [], 0);
  const pick = best.pick;
  // righe a mano non lette: il totale scritto dice quanto manca
  const lines = handLines;
  const missing = total != null ? total - pick.reduce((t, p) => t + p.amount, 0) : 0;
  const slots = lines - pick.length;
  if (pick.length && total != null && missing > 0 && slots >= 1 && slots <= 3) {
    const ks = [...new Set(hands.map((h) => h.hint).filter((h): h is number => h != null && h > 0))];
    const free = items.map((_, i) => i).filter((i) => !pick.some((p) => p.i === i));
    const found: { i: number; k: number; amount: number }[][] = [];
    const tryK = (it: ReceiptItem) => [...new Set([...ks, it.qty])].filter((k) => k >= 1 && k <= it.qty);
    const search = (from: number, left: number, need: number, acc: { i: number; k: number; amount: number }[]) => {
      if (found.length > 1) return;
      if (need === 0) {
        if (Math.abs(left) <= 1) found.push([...acc]);
        return;
      }
      for (let n = from; n < free.length; n += 1) {
        const it = items[free[n]];
        for (const k of tryK(it)) {
          const amount = k * it.priceCents;
          if (amount > left + 1) continue;
          acc.push({ i: free[n], k, amount });
          search(n + 1, left - amount, need - 1, acc);
          acc.pop();
        }
      }
    };
    search(0, missing, slots, []);
    // solo se la soluzione è una sola: meglio chiedere che indovinare
    if (found.length === 1) pick.push(...found[0]);
  }
  return pick;
}

/** più letture dello stesso foglio (blocco, righe ricostruite, parole sparse) diventano una sola */
export function combineReads(texts: string[]): Omit<ReceiptRead, "text"> & { complete: boolean } {
  const bases = texts.filter((t) => t.trim()).map(readBase);
  if (!bases.length) return { store: "", day: null, totalCents: null, items: [], note: "", discountCents: null, complete: false };
  const main = [...bases].sort((a, b) => scoreOf(b) - scoreOf(a) || b.items.length - a.items.length)[0];
  const items = main.items.map((it) => ({ ...it }));
  const store = main.store || bases.find((b) => b.store)?.store || "";
  const day = main.day ?? bases.find((b) => b.day)?.day ?? null;
  const discount = main.discount || Math.max(...bases.map((b) => b.discount));
  // il totale: quello letto più spesso (a mano si legge male, «4(,60»)
  const totals = bases.map((b) => b.total).filter((t): t is number => t != null);
  const total = totals.length ? [...totals].sort((a, b) => totals.filter((x) => x === b).length - totals.filter((x) => x === a).length)[0] : null;
  // righe a mano: gli importi letti in tutte le letture (stesso importo una volta sola per lettura)
  const seen = new Map<number, number>();
  const hands: Hand[] = [];
  for (const b of bases) {
    const here = new Map<number, number>();
    for (const h of b.hands) if (h.amount != null) here.set(h.amount, (here.get(h.amount) ?? 0) + 1);
    for (const [amount, n] of here) {
      const had = seen.get(amount) ?? 0;
      for (let k = had; k < n; k += 1) hands.push({ amount, hint: b.hands.find((h) => h.amount === amount)?.hint ?? null });
      seen.set(amount, Math.max(had, n));
    }
  }
  for (const b of bases) for (const h of b.hands) if (h.amount == null && h.hint != null) hands.push(h);
  const handLines = Math.max(0, ...bases.map((b) => b.handLines));
  const notes: string[] = [];
  if (items.length) notes.push(`${items.length} ${items.length === 1 ? "riga trovata" : "righe trovate"}`);
  const pick = handLines && items.length ? allocate(items, hands, handLines, total) : [];
  let totalCents: number | null = total;
  if (pick.length) {
    items.forEach((it, i) => {
      const p = pick.find((x) => x.i === i);
      it.mine = Boolean(p);
      it.hand = Boolean(p);
      if (p) it.qty = p.k;
      else it.toGear = false;
    });
    const mineSum = pick.reduce((t, p) => t + p.amount, 0);
    // il totale scritto a mano è quello speso: se le righe non tornano, lo dice il riquadro sotto
    totalCents = total ?? mineSum;
    notes.push(`${pick.length} ${pick.length === 1 ? "segnata" : "segnate"} a mano come tue${pick.length < handLines ? ` su ${handLines}: segna tu le altre` : ""}`);
    if (discount) notes.push(`sconto di ${(discount / 100).toFixed(2).replace(".", ",")} € sul foglio intero`);
  } else {
    if (discount) {
      // sconto su tutto il foglio: va nel campo «Sconto»; le righe restano a prezzo pieno e
      // al salvataggio lo sconto si divide sulle righe in proporzione
      notes.push(`sconto di ${(discount / 100).toFixed(2).replace(".", ",")} € sul foglio: è nel campo Sconto`);
    }
    if (handLines && items.length) notes.push("righe a mano non lette: togli tu la spunta a quello che non è tuo");
    // niente totale stampato: la somma delle righe
    if (totalCents == null && items.length) totalCents = Math.max(0, items.reduce((t, it) => t + it.priceCents * it.qty, 0) - discount);
  }
  const checked = items.filter((it) => it.checked).length;
  const complete = items.length >= 1 && checked === items.length && (!handLines || pick.length >= handLines);
  // con le righe segnate a mano lo sconto stampato è del foglio intero, non solo delle tue righe
  const discountCents = discount && !pick.length ? discount : null;
  return { store, day, totalCents, items: items.slice(0, 40), note: notes.join(" · "), discountCents, complete };
}

/**
 * Il testo letto diventa negozio, data, totale e righe. Va bene per lo scontrino della cassa
 * («PUNTE 100 GR   18,00») e per la ricevuta o fattura a colonne (codice, descrizione, quantità,
 * prezzo, sconto, totale, IVA). Se sul foglio ci sono righe scritte a mano «1 x20 € 13,40»
 * (la parte di chi ha comprato in compagnia), le righe stampate che fanno quell'importo diventano le tue.
 */
export function parseReceipt(text: string): Omit<ReceiptRead, "text"> {
  const { complete: _c, ...r } = combineReads([text]);
  return r;
}

/**
 * Le parole che dicono cos'è un pezzo. Conta il nome della cosa scritto per primo («Punta» in «Tipping
 * Point Punta Bullet»): le marche (Gateway, Tipping Point, Rose City) servono solo se manca.
 */
const NOUNS: [string, RegExp][] = [
  ["alette", /\balett[ae]\b|\bpenn[ae]\b|\bpiume?\b|\bvanes?\b|\bfeathers?\b|\bfletch/],
  ["punte", /\bpunt[ae]\b|\bpoints?\b(?!\s+(?:punt|cocc|alett|ast))|\bbodkin|\bbroadhead/],
  ["cocche", /\bcocc[ah]e?\b|\bnocks?\b|\bpin\s*nock/],
  ["aste", /\bast[ae]\b|\bshafts?\b|\btubi\b/],
  ["freccia", /\bfrecc|\barrows?\b/],
  ["arco", /\barc[oh]i?\b|flettent|\blimbs?\b|\briser\b|longbow|ricurvo|recurve|compound|flatbow/],
  ["corda", /\bcord[ae]\b|\bstrings?\b|\bserving/],
  ["mirino", /\bmirin|\bsights?\b/],
  ["rest", /\brest\b|poggiafrecc|appoggio|plunger|berger|bottone/],
  ["stabilizzatore", /stabilizz|\bstab\b|\bv-?bar/],
  ["parabraccio", /parabracc|armguard|bracciale/],
  ["guantino", /guantin|patell|\btab\b|\bgloves?\b|guanto/],
  ["sgancio", /sgancio|\brelease\b/],
  ["pettorina", /pettorin|chest\s*guard/],
  ["faretra", /faretr|quiver/],
  ["bersaglio", /bersagl|battifrecc|paglion|visual[ei]|\btargets?\b|sagom|ethafoam/],
  ["custodia", /custodi|valigett|\bcase\b/],
  ["borsa", /\bbors[ae]\b|zaino|\bbag\b/],
  ["supporto", /support|cavallett|\bstand\b/],
  ["abbigliamento", /magli|felpa|giacc|cappell|pantalon|\bpolo\b|t-?shirt|gilet|calz[ea]/],
  ["scarpe", /scarp|stival|scarpon/],
  ["accessorio", /\binserti?\b|\binserts?\b|\bcera\b|\bwax\b|\bcolla\b|\bglue\b|tubett|nastr|tirafrecc|cordino|dragon|\bsling\b|\bkit\b/],
];
/** marche e modelli, quando nel nome non c'è la parola della cosa */
const BRANDS: [string, RegExp][] = [
  ["alette", /gateway|trueflight|bohning|\bblazer\b|aae\b|spin\s*wing|flex[- ]?fletch/],
  ["punte", /tipping\s*point(?!.*(?:cocc|nock|alett))|\bbullet\b|longobard|\bfield\b|\b\d{2,3}\s*gr\b/],
  ["aste", /rose\s*city|\bcedro\b|\bcedar\b|\bpino\b|\bbamb[uù]\b|\bcarbon/],
];

/** la categoria dell'attrezzatura più probabile per una riga dello scontrino */
export function guessCategory(name: string): string {
  const t = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let best = "";
  let at = Infinity;
  for (const [id, re] of NOUNS) {
    const m = re.exec(t);
    if (m && m.index < at) {
      at = m.index;
      best = id;
    }
  }
  if (best) return best;
  for (const [id, re] of BRANDS) if (re.test(t)) return id;
  return "altro";
}
