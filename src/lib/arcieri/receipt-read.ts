/**
 * Lettura nel telefono di uno scontrino o di una fattura: il testo lo legge Tesseract (OCR che gira
 * nel browser, scaricato da jsDelivr la prima volta e poi tenuto in memoria), poi qui si ritrovano
 * negozio, data, totale e le righe con il prezzo; ogni riga ha una categoria dell'attrezzatura
 * indovinata dalle parole (frecce, punte, corda, parabraccio...). Niente servizi esterni.
 */

export type ReceiptItem = { name: string; qty: number; priceCents: number; category: string; toGear: boolean };
export type ReceiptRead = { store: string; day: string | null; totalCents: number | null; items: ReceiptItem[]; text: string };

const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1";

type TessWorker = {
  setParameters: (p: Record<string, string>) => Promise<unknown>;
  recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
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

/** foto pronta per la lettura: lato lungo ~1800 px, grigio con il contrasto allargato */
function prepare(img: HTMLImageElement): HTMLCanvasElement {
  const long = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const k = Math.min(1, 1800 / long);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const x = c.getContext("2d", { willReadFrequently: true });
  if (!x) return c;
  x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < p.length; i += 4) {
    const g = Math.round(p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11);
    p[i] = g;
    hist[g] += 1;
  }
  const n = p.length / 4;
  let lo = 0;
  let hi = 255;
  for (let acc = 0, v = 0; v < 256; v += 1) {
    acc += hist[v];
    if (acc > n * 0.04) {
      lo = v;
      break;
    }
  }
  for (let acc = 0, v = 255; v >= 0; v -= 1) {
    acc += hist[v];
    if (acc > n * 0.04) {
      hi = v;
      break;
    }
  }
  const span = Math.max(30, hi - lo);
  for (let i = 0; i < p.length; i += 4) {
    const g = Math.max(0, Math.min(255, ((p[i] - lo) / span) * 255));
    p[i] = p[i + 1] = p[i + 2] = g;
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

export async function readReceipt(img: HTMLImageElement, onProgress?: (p: number, what: string) => void): Promise<ReceiptRead> {
  onProgress?.(0.02, "Scarico il lettore");
  const T = await loadTesseract();
  const worker = await T.createWorker("ita", 1, {
    logger: (m: { status?: string; progress?: number }) => {
      const st = m.status ?? "";
      const pr = m.progress ?? 0;
      if (st.includes("recogniz")) onProgress?.(0.35 + pr * 0.63, "Leggo lo scontrino");
      else if (st.includes("load") || st.includes("initializ")) onProgress?.(0.05 + pr * 0.28, "Preparo il lettore");
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: "4", preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(prepare(img));
    onProgress?.(1, "Fatto");
    return { ...parseReceipt(data.text ?? ""), text: data.text ?? "" };
  } finally {
    void worker.terminate();
  }
}

const PRICE = /(-?\d{1,4}(?:[.'\s]\d{3})*[,.]\s?\d{2})\s*(?:€|eur[o]?|e)?\s*[a-z*]{0,2}\s*$/i;
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

/** il testo letto diventa negozio, data, totale e righe */
export function parseReceipt(text: string): Omit<ReceiptRead, "text"> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1);
  // negozio: la prima riga con parole vere, in alto
  let store = "";
  for (const l of lines.slice(0, 6)) {
    const letters = (l.match(/\p{L}/gu) ?? []).length;
    if (letters >= 4 && !SKIP.test(l) && !PRICE.test(l) && !/\d{5}/.test(l)) {
      store = titleCase(l.replace(/[^\p{L}\d&'’ .-]/gu, "").trim()).slice(0, 60);
      break;
    }
  }
  // data: la prima che sembra vera
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
  // totale: «totale complessivo» vince, poi l'ultimo «totale», «importo pagato»...
  let totalCents: number | null = null;
  let totalRank = -1;
  for (const l of lines) {
    if (/sub\s*tot|iva|imponibile|sconto/i.test(l)) continue;
    const rank = /totale\s+complessivo/i.test(l) ? 3 : /\btotale\b|\btotal\b|\btot\.?\s*eur/i.test(l) ? 2 : /importo\s+pagato|da\s+pagare|pagato/i.test(l) ? 1 : -1;
    if (rank < 0) continue;
    const m = PRICE.exec(l);
    const v = m ? cents(m[1]) : null;
    if (v != null && v > 0 && rank >= totalRank) {
      totalCents = v;
      totalRank = rank;
    }
  }
  // righe: testo e prezzo; «2 x 3,50» porta la quantità; «sconto» toglie dalla riga sopra
  const items: ReceiptItem[] = [];
  // «2 x 4,50» da sola: è della riga sopra se i conti tornano, altrimenti di quella sotto
  let pending: { q: number; unit: number } | null = null;
  for (const l of lines) {
    const only = /^(\d{1,2})\s*[xX*]\s*(\d{1,4}[,.]\d{2})\s*$/.exec(l);
    if (only) {
      const q = Number(only[1]);
      const unit = cents(only[2]) ?? 0;
      const last = items[items.length - 1];
      if (last && last.qty === 1 && q > 1 && Math.abs(last.priceCents - q * unit) <= 2) {
        last.qty = q;
        last.priceCents = unit;
      } else pending = { q, unit };
      continue;
    }
    const m = PRICE.exec(l);
    if (!m) continue;
    const v = cents(m[1]);
    if (v == null) continue;
    if (/sconto|abbuono|promo/i.test(l) && v !== 0) {
      const last = items[items.length - 1];
      if (last) last.priceCents = Math.max(0, last.priceCents - Math.abs(v));
      continue;
    }
    if (SKIP.test(l) || v <= 0) continue;
    let name = l.slice(0, m.index).trim();
    let qty = 1;
    const lead = /^(\d{1,2})\s*[xX*]\s+/.exec(name);
    if (lead) {
      qty = Number(lead[1]);
      name = name.slice(lead[0].length);
    }
    const inner = /\s(\d{1,2})\s*[xX*]\s*\d{1,4}[,.]\d{2}\s*$/.exec(name);
    if (inner) {
      qty = Number(inner[1]);
      name = name.slice(0, inner.index);
    }
    name = name.replace(/^\d{5,}\s*/, "").replace(/\s\d{1,2}([,.]\d+)?\s*%.*$/, "").replace(/[*_=]+/g, " ").replace(/\s+/g, " ").trim();
    if ((name.match(/\p{L}/gu) ?? []).length < 3) continue;
    let unit = qty > 1 ? Math.round(v / qty) : v;
    if (pending && qty === 1) {
      qty = pending.q;
      unit = Math.abs(v - pending.q * pending.unit) <= 2 ? pending.unit : Math.round(v / pending.q);
    }
    pending = null;
    const category = guessCategory(name);
    // nella lista si tiene il prezzo di un pezzo: la riga dello scontrino è il totale della riga
    items.push({ name: titleCase(name).slice(0, 80), qty, priceCents: unit, category, toGear: category !== "altro" });
  }
  return { store, day, totalCents, items: items.slice(0, 40) };
}

const KEYS: [string, RegExp][] = [
  ["arco", /\barc[oh]i?\b|flettent|limbs?\b|riser|longbow|ricurvo|recurve|compound|flatbow/],
  ["freccia", /frecc|\baste?\b|shaft|arrow|carbon|alluminio/],
  ["corda", /\bcord[ae]\b|string|serving/],
  ["mirino", /mirin|\bsight/],
  ["rest", /\brest\b|poggiafrecc|appoggio|plunger|berger|bottone/],
  ["stabilizzatore", /stabilizz|\bstab\b|\bv-?bar/],
  ["parabraccio", /parabracc|armguard|bracciale/],
  ["guantino", /guantin|patell|\btab\b|glove|guanto/],
  ["sgancio", /sgancio|release/],
  ["pettorina", /pettorin|chest\s*guard/],
  ["faretra", /faretr|quiver/],
  ["bersaglio", /bersagl|battifrecc|paglion|visual[ei]|target|sagom|ethafoam/],
  ["custodia", /custodi|valigett|\bcase\b/],
  ["borsa", /\bbors[ae]\b|zaino|\bbag\b/],
  ["supporto", /support|cavallett|\bstand\b/],
  ["abbigliamento", /magli|felpa|giacc|cappell|pantalon|\bpolo\b|t-?shirt|gilet|calz[ea]/],
  ["scarpe", /scarp|stival|scarpon/],
  ["accessorio", /\bpunt[ae]\b|point|cocc[ah]|nock|penn[ae]|alett|vanes?\b|feather|insert|cera\b|wax|colla|glue|tubett|nastr|spine|tirafrecc|cordino|dragon|sling/],
];

/** la categoria dell'attrezzatura più probabile per una riga dello scontrino */
export function guessCategory(name: string): string {
  const t = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // conta la prima parola: «punte per frecce» sono punte, «frecce con punte» sono frecce
  const first = t.split(/\s+/)[0] ?? "";
  for (const [id, re] of KEYS) if (re.test(first)) return id;
  for (const [id, re] of KEYS) if (re.test(t)) return id;
  return "altro";
}
