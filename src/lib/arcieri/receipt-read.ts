/**
 * Lettura nel telefono di uno scontrino o di una fattura: il testo lo legge Tesseract (OCR che gira
 * nel browser, scaricato da jsDelivr la prima volta e poi tenuto in memoria), poi qui si ritrovano
 * negozio, data, totale e le righe con il prezzo; ogni riga ha una categoria dell'attrezzatura
 * indovinata dalle parole (frecce, punte, corda, parabraccio...). Niente servizi esterni.
 */

export type ReceiptItem = { name: string; qty: number; priceCents: number; category: string; toGear: boolean; /** comprato da te: si salva solo questo (un foglio a metà fra amici ha le righe segnate a mano) */ mine: boolean };
export type ReceiptRead = { store: string; day: string | null; totalCents: number | null; items: ReceiptItem[]; text: string; /** cosa si è capito, in una riga: righe trovate, sconto, righe segnate a mano */ note: string };

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

/** foto pronta per la lettura: lato lungo ~2600 px (le ricevute A4 hanno il testo piccolo), grigio con il contrasto allargato */
function prepare(img: HTMLImageElement): HTMLCanvasElement {
  const long = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const k = Math.min(1.6, 2600 / long);
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
    const page = prepare(img);
    await worker.setParameters({ tessedit_pageseg_mode: "4", preserve_interword_spaces: "1" });
    let text = (await worker.recognize(page)).data.text ?? "";
    let read = parseReceipt(text);
    // poche righe: si riprova leggendo il foglio come un blocco unico (va meglio con le tabelle)
    if (read.items.length < 2) {
      onProgress?.(0.7, "Rileggo come tabella");
      await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
      const t2 = (await worker.recognize(page)).data.text ?? "";
      const r2 = parseReceipt(t2);
      if (r2.items.length > read.items.length) {
        read = r2;
        text = t2;
      }
    }
    onProgress?.(1, "Fatto");
    return { ...read, text };
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

const MONEY = /-?\d{1,4}(?:\.\d{3})*,\s?\d{2}(?!\d)|-?\d{1,4}\.\d{2}(?!\d)/g;
const letters = (t: string) => (t.match(/\p{L}/gu) ?? []).length;
const HEAD_SKIP = /ricevuta|fattura|cassa\b|causale|data\s*doc|documento|scontrino|cod\.?\s|descrizione|q\.?\s*t[aà]/i;

/** codice articolo in testa alla riga (PENN033-03, PULE024-01, 8012345678901): non fa parte del nome */
const stripCode = (t: string) => t.replace(/^[A-Z0-9]{3,10}[-/.][A-Z0-9]{1,4}\s+/i, "").replace(/^\d{6,}\s+/, "").replace(/^[A-Z]{2,5}\d{2,5}\s+/, "");

/**
 * Il testo letto diventa negozio, data, totale e righe. Va bene per lo scontrino della cassa
 * («PUNTE 100 GR   18,00») e per la ricevuta o fattura a colonne (codice, descrizione, quantità,
 * prezzo, sconto, totale, IVA). Se sul foglio ci sono righe scritte a mano «1 x20 € 13,40»
 * (la parte di chi ha comprato in compagnia), le righe stampate con lo stesso prezzo diventano le tue.
 */
export function parseReceipt(text: string): Omit<ReceiptRead, "text"> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/[|¦]/g, " ").replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1);
  // negozio: la prima riga con parole vere, in alto (non «Ricevuta N.», «Cassa», le intestazioni della tabella)
  let store = "";
  for (const l of lines.slice(0, 8)) {
    // solo sopra le righe con i prezzi
    if ((l.match(MONEY) ?? []).length) break;
    if (letters(l) >= 4 && !SKIP.test(l) && !HEAD_SKIP.test(l) && !/\d{5}/.test(l)) {
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
  let totalCents: number | null = null;
  let totalRank = -1;
  let discount = 0;
  const alloc: { qty: number; amount: number }[] = [];
  const items: ReceiptItem[] = [];
  let pending: { q: number; unit: number } | null = null;
  let lastWasItem = false;
  for (const raw of lines) {
    // via l'IVA in fondo alla riga («22%», «22 %», una lettera di codice)
    let l = raw;
    for (let k = 0; k < 3; k += 1) l = l.replace(/\s+\d{1,2}(?:[.,]\d+)?\s?%\s*$/, "").replace(/\s+[A-Z]\s*$/, "").trim();
    const money = [...l.matchAll(MONEY)].map((m) => ({ v: cents(m[0]), i: m.index ?? 0, s: m[0] })).filter((m): m is { v: number; i: number; s: string } => m.v != null);
    // totale: «totale complessivo» vince, poi «totale» o «tot.» (anche scritto a mano), «importo pagato»...
    if (!/sub\s*tot|iva\b|imponibile|sconto/i.test(l)) {
      const rank = /totale\s+(complessivo|documento|fattura)/i.test(l) ? 3 : /\btotale\b|\btotal\b|\btot\b\.?/i.test(l) ? 2 : /importo\s+pagato|da\s+pagare|netto\s+a\s+pagare|pagato/i.test(l) ? 1 : -1;
      if (rank >= 0) {
        const v = money.length ? money[money.length - 1].v : null;
        if (v != null && v > 0 && rank >= totalRank) {
          totalCents = v;
          totalRank = rank;
        }
        lastWasItem = false;
        continue;
      }
    }
    // a mano: «1 x20 € 13,40», «2 x 6 € 4,80» (quante ne hai prese e quanto hai speso)
    const hand = /^\s*(?:\d\s*)?[xX×*]\s*(\d{1,3})\b[^\d]{0,8}(\d{1,4}[,.]\s?\d{2})\s*$/.exec(l.replace(/^(\d)\s+(?=[xX×*])/, ""));
    if (hand && letters(l) <= 3) {
      const amount = cents(hand[2]);
      if (amount) alloc.push({ qty: Number(hand[1]), amount });
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
      } else pending = { q, unit };
      lastWasItem = false;
      continue;
    }
    if (!money.length) {
      // seguito della descrizione sulla riga sotto («GIALLO»)
      const last = items[items.length - 1];
      if (lastWasItem && last && letters(l) >= 3 && l.length <= 28 && !/\d{2,}/.test(l) && !SKIP.test(l) && !HEAD_SKIP.test(l)) last.name = `${last.name} ${titleCase(l)}`.slice(0, 80);
      lastWasItem = false;
      continue;
    }
    const v = money[money.length - 1].v;
    if (/^\s*(sconto|abbuono|promo)/i.test(l)) {
      // sconto su tutto il foglio (riga a sé)
      discount += Math.abs(v);
      lastWasItem = false;
      continue;
    }
    if (/sconto|abbuono/i.test(l) && v !== 0) {
      const last = items[items.length - 1];
      if (last) last.priceCents = Math.max(0, last.priceCents - Math.round(Math.abs(v) / (last.qty || 1)));
      lastWasItem = false;
      continue;
    }
    if (SKIP.test(l) || v <= 0) {
      lastWasItem = false;
      continue;
    }
    // nome e quantità: il testo prima della prima cifra in euro; la quantità è il numero intero subito prima
    let head = l.slice(0, money[0].i).trim();
    let qty = 1;
    const tail = /\s(\d{1,4})\s*[+\-~^']*\s*$/.exec(head);
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
    let name = stripCode(head).replace(/\s\d{1,2}([,.]\d+)?\s*%.*$/, "").replace(/[*_=]+/g, " ").replace(/\s+\d$/, "").replace(/\s+/g, " ").trim();
    if (letters(name) < 3) {
      lastWasItem = false;
      continue;
    }
    // prezzo di un pezzo: la prima cifra della riga a colonne, se i conti tornano con il totale della riga
    let unit = qty > 1 ? Math.round(v / qty) : v;
    if (money.length >= 2 && qty > 1) {
      const first = money[0].v;
      if (first > 0 && Math.abs(first * qty - v) <= Math.max(3, v * 0.03)) unit = first;
    }
    if (pending && qty === 1) {
      qty = pending.q;
      unit = Math.abs(v - pending.q * pending.unit) <= 2 ? pending.unit : Math.round(v / pending.q);
    }
    pending = null;
    name = titleCase(name).slice(0, 80);
    const category = guessCategory(name);
    items.push({ name, qty, priceCents: unit, category, toGear: category !== "altro", mine: true });
    lastWasItem = true;
  }
  const notes: string[] = [];
  if (items.length) notes.push(`${items.length} ${items.length === 1 ? "riga trovata" : "righe trovate"}`);
  // righe scritte a mano: le tue sono quelle con lo stesso prezzo a pezzo
  let matched = 0;
  if (alloc.length && items.length) {
    const taken = new Set<number>();
    const pick: { i: number; qty: number }[] = [];
    for (const a of alloc) {
      const unit = a.amount / Math.max(1, a.qty);
      let best = -1;
      let gap = Infinity;
      items.forEach((it, i) => {
        if (taken.has(i)) return;
        const g = Math.abs(it.priceCents - unit);
        if (g < gap) {
          gap = g;
          best = i;
        }
      });
      if (best >= 0 && gap <= 1.5) {
        taken.add(best);
        pick.push({ i: best, qty: a.qty });
      }
    }
    if (pick.length) {
      matched = pick.length;
      items.forEach((it, i) => {
        const p = pick.find((x) => x.i === i);
        it.mine = Boolean(p);
        if (p) it.qty = p.qty;
        else it.toGear = false;
      });
      const mineSum = items.filter((it) => it.mine).reduce((t, it) => t + it.priceCents * it.qty, 0);
      const handTotal = alloc.reduce((t, a) => t + a.amount, 0);
      if (totalCents == null || Math.abs(handTotal - mineSum) <= 3) totalCents = handTotal;
      notes.push(`${matched} ${matched === 1 ? "segnata" : "segnate"} a mano come tue`);
    }
  }
  if (discount) {
    if (!matched) {
      // sconto su tutto il foglio: si spalma sulle righe, così la somma torna con il totale
      const gross = items.reduce((t, it) => t + it.priceCents * it.qty, 0);
      if (gross > discount) for (const it of items) it.priceCents = Math.max(0, Math.round(it.priceCents * (1 - discount / gross)));
      notes.push(`sconto di ${(discount / 100).toFixed(2).replace(".", ",")} € diviso sulle righe`);
    } else notes.push(`sconto di ${(discount / 100).toFixed(2).replace(".", ",")} € sul foglio intero`);
  }
  return { store, day, totalCents, items: items.slice(0, 40), note: notes.join(" · ") };
}

const KEYS: [string, RegExp][] = [
  ["arco", /\barc[oh]i?\b|flettent|limbs?\b|riser|longbow|ricurvo|recurve|compound|flatbow/],
  ["freccia", /frecc|\bast[ae]\b|shaft|arrow|carbon|alluminio|cedro|rose city/],
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
  ["accessorio", /\bpunt[ae]\b|point|cocc[ah]|nock|penn[ae]|alett|vanes?\b|feather|gateway|insert|cera\b|wax|colla|glue|tubett|nastr|spine|tirafrecc|cordino|dragon|sling|bullet|bodkin|longobard/],
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
