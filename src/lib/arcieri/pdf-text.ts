/**
 * Testo di un PDF, riga per riga, senza librerie: basta per le classifiche del portale FITAST (report
 * generati dal gestionale, testo vero e non scansioni). Legge i flussi compressi (FlateDecode), i
 * comandi di testo (Tj, TJ, ', ") e, se il font ha una tabella ToUnicode, la usa per le lettere.
 * Solo lato server (usa node:zlib).
 */
import { inflateSync } from "node:zlib";

type Obj = { num: number; dict: string; stream: Uint8Array | null };

const latin1 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, Math.min(b.length, i + 8192)));
  return s;
};

function a85(b: Uint8Array): Uint8Array {
  const out: number[] = [];
  let grp: number[] = [];
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (c === 126) break; // "~>"
    if (c <= 32) continue;
    if (c === 122 && !grp.length) {
      out.push(0, 0, 0, 0);
      continue;
    }
    grp.push(c - 33);
    if (grp.length === 5) {
      let v = 0;
      for (const d of grp) v = v * 85 + d;
      out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
      grp = [];
    }
  }
  if (grp.length) {
    const n = grp.length;
    while (grp.length < 5) grp.push(84);
    let v = 0;
    for (const d of grp) v = v * 85 + d;
    const bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    out.push(...bytes.slice(0, n - 1));
  }
  return new Uint8Array(out);
}

function ahx(b: Uint8Array): Uint8Array {
  const h = latin1(b).replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(Math.ceil(h.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(2 * i, 2 * i + 2).padEnd(2, "0"), 16);
  return out;
}

/** tutti gli oggetti "n 0 obj … endobj" con l'eventuale flusso già decompresso */
function objects(buf: Uint8Array): Map<number, Obj> {
  const text = latin1(buf);
  const out = new Map<number, Obj>();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const num = Number(m[1]);
    const start = m.index + m[0].length;
    const end = text.indexOf("endobj", start);
    if (end < 0) break;
    const body = text.slice(start, end);
    const si = body.indexOf("stream");
    let dict = body;
    let stream: Uint8Array | null = null;
    if (si >= 0 && /<<[\s\S]*>>\s*$/.test(body.slice(0, si))) {
      dict = body.slice(0, si);
      let ds = start + si + 6;
      if (text[ds] === "\r") ds++;
      if (text[ds] === "\n") ds++;
      const lenM = dict.match(/\/Length\s+(\d+)(\s+\d+\s+R)?/);
      let de = text.indexOf("endstream", ds);
      if (lenM && !lenM[2]) de = Math.min(de, ds + Number(lenM[1]));
      let raw: Uint8Array = buf.subarray(ds, Math.max(ds, de));
      // filtri nell'ordine in cui sono scritti: ASCII85 e Flate (testo); gli altri (immagini) non servono
      const filters = [...(dict.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/)?.[1] ?? "").matchAll(/\/(\w+)/g)].map((x) => x[1]);
      for (const f of filters) {
        if (f === "FlateDecode" || f === "Fl") {
          try {
            raw = inflateSync(raw);
          } catch {
            try {
              raw = inflateSync(raw, { finishFlush: 2 });
            } catch {
              raw = new Uint8Array(0);
            }
          }
        } else if (f === "ASCII85Decode" || f === "A85") raw = a85(raw);
        else if (f === "ASCIIHexDecode" || f === "AHx") raw = ahx(raw);
        else {
          raw = new Uint8Array(0);
          break;
        }
      }
      stream = raw;
    }
    out.set(num, { num, dict, stream });
    re.lastIndex = end;
  }
  // flussi di oggetti (PDF 1.5+): gli oggetti piccoli stanno dentro un /ObjStm
  for (const o of [...out.values()]) {
    if (!o.stream || !/\/Type\s*\/ObjStm/.test(o.dict)) continue;
    const n = Number(o.dict.match(/\/N\s+(\d+)/)?.[1] ?? 0);
    const first = Number(o.dict.match(/\/First\s+(\d+)/)?.[1] ?? 0);
    const s = latin1(o.stream);
    const head = s.slice(0, first).trim().split(/\s+/).map(Number);
    for (let k = 0; k < n; k++) {
      const num = head[2 * k];
      const off = first + head[2 * k + 1];
      const next = k + 1 < n ? first + head[2 * k + 3] : s.length;
      if (!out.has(num)) out.set(num, { num, dict: s.slice(off, next), stream: null });
    }
  }
  return out;
}

/** tabella ToUnicode: codice del font → lettere */
function cmapOf(s: string): { map: Map<number, string>; bytes: number } {
  const map = new Map<number, string>();
  const hexStr = (h: string) => {
    let r = "";
    for (let i = 0; i + 4 <= h.length; i += 4) r += String.fromCharCode(parseInt(h.slice(i, i + 4), 16));
    if (h.length === 2) r = String.fromCharCode(parseInt(h, 16));
    return r;
  };
  let bytes = 1;
  const cs = s.match(/begincodespacerange\s*<([0-9a-fA-F]+)>/);
  if (cs) bytes = Math.max(1, cs[1].length / 2);
  for (const block of s.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const p of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(parseInt(p[1], 16), hexStr(p[2]));
  }
  for (const block of s.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const p of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]+)>|\[([^\]]*)\])/g)) {
      const a = parseInt(p[1], 16);
      const b = parseInt(p[2], 16);
      if (b - a > 5000) continue;
      if (p[4]) {
        const base = parseInt(p[4], 16);
        for (let c = a; c <= b; c++) map.set(c, String.fromCharCode(base + (c - a)));
      } else if (p[5]) {
        const list = [...p[5].matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => hexStr(x[1]));
        for (let c = a; c <= b && c - a < list.length; c++) map.set(c, list[c - a]);
      }
    }
  }
  return { map, bytes };
}

const WIN = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";
const winChar = (c: number) => (c >= 0x80 && c < 0xa0 ? WIN[c - 0x80] : String.fromCharCode(c));

/** stringa letterale "( … )" con le sequenze di escape */
function literal(s: string, i: number): [number[], number] {
  const out: number[] = [];
  let depth = 1;
  i++;
  while (i < s.length && depth > 0) {
    const ch = s[i];
    if (ch === "\\") {
      const n = s[i + 1];
      const map: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, "(": 40, ")": 41, "\\": 92 };
      if (n in map) {
        out.push(map[n]);
        i += 2;
      } else if (/[0-7]/.test(n)) {
        const oct = s.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)![0];
        out.push(parseInt(oct, 8) & 255);
        i += 1 + oct.length;
      } else if (n === "\r" || n === "\n") {
        i += n === "\r" && s[i + 2] === "\n" ? 3 : 2;
      } else {
        i += 1;
      }
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") {
      depth--;
      if (!depth) break;
    }
    out.push(ch.charCodeAt(0) & 255);
    i++;
  }
  return [out, i + 1];
}

type Font = { map: Map<number, string>; bytes: number; widths?: Map<number, number>; dw?: number } | null;

/** lettere e larghezza (in unità del corpo del carattere) di una stringa */
function decodeBytes(b: number[], font: Font): { t: string; w: number } {
  const bytes = font?.bytes ?? 1;
  let r = "";
  let w = 0;
  for (let i = 0; i + bytes <= b.length; i += bytes) {
    let code = 0;
    for (let k = 0; k < bytes; k++) code = code * 256 + b[i + k];
    r += font?.map.get(code) ?? (bytes === 1 ? winChar(code) : "");
    w += font?.widths?.get(code) ?? font?.dw ?? 0.55;
  }
  return { t: r, w };
}

type M6 = [number, number, number, number, number, number];
const mulM = (m: M6, n: M6): M6 => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
type Item = { y: number; x: number; t: string; size: number; w: number };

/** testo di un flusso di contenuto, con la posizione sulla pagina di ogni pezzo */
function contentLines(s: string, fonts: Map<string, Font>, lines: Item[]) {
  let font: Font = null;
  let size = 10;
  let ctm: M6 = [1, 0, 0, 1, 0, 0];
  const saved: M6[] = [];
  let tm: M6 = [1, 0, 0, 1, 0, 0];
  let lm: M6 = [1, 0, 0, 1, 0, 0];
  let lead = 0;
  const stack: string[] = [];
  const add = (t: string, w: number) => {
    const m = mulM(tm, ctm);
    const k = Math.hypot(m[2], m[3]) || 1;
    if (t) lines.push({ x: m[4], y: m[5], t, size: size * k, w: w * size * (Math.hypot(m[0], m[1]) || 1) });
    // avanza alla fine del pezzo: un secondo pezzo sulla stessa riga resta dopo
    tm = mulM([1, 0, 0, 1, w * size, 0], tm);
  };
  const newLine = (tx: number, ty: number) => {
    lm = mulM([1, 0, 0, 1, tx, ty], lm);
    tm = lm;
  };
  let i = 0;
  const n = s.length;
  while (i < n) {
    const ch = s[i];
    if (ch === "(") {
      const [b, j] = literal(s, i);
      stack.push(JSON.stringify(b));
      i = j;
      continue;
    }
    if (ch === "<" && s[i + 1] !== "<") {
      const j = s.indexOf(">", i);
      const h = s.slice(i + 1, j).replace(/\s+/g, "");
      const b: number[] = [];
      for (let k = 0; k < h.length; k += 2) b.push(parseInt(h.slice(k, k + 2).padEnd(2, "0"), 16));
      stack.push(JSON.stringify(b));
      i = j + 1;
      continue;
    }
    if (ch === "<" && s[i + 1] === "<") {
      // dizionari in linea (contenuti marcati): si saltano
      let depth = 0;
      while (i < n) {
        if (s[i] === "<" && s[i + 1] === "<") {
          depth++;
          i += 2;
        } else if (s[i] === ">" && s[i + 1] === ">") {
          depth--;
          i += 2;
          if (!depth) break;
        } else i++;
      }
      continue;
    }
    if (ch === "[") {
      stack.push("[");
      i++;
      continue;
    }
    if (ch === "]") {
      // array del TJ: si uniscono le stringhe; uno spazio dove lo scarto è grande
      const parts: string[] = [];
      while (stack.length && stack[stack.length - 1] !== "[") parts.unshift(stack.pop()!);
      stack.pop();
      stack.push(`A${JSON.stringify(parts)}`);
      i++;
      continue;
    }
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "%") {
      while (i < n && s[i] !== "\n" && s[i] !== "\r") i++;
      continue;
    }
    let j = i;
    if (ch === "/") {
      j = i + 1;
      while (j < n && !/[\s()<>[\]/%]/.test(s[j])) j++;
      stack.push(s.slice(i, j));
      i = j;
      continue;
    }
    while (j < n && !/[\s()<>[\]/%]/.test(s[j])) j++;
    if (j === i) {
      i++;
      continue;
    }
    const tok = s.slice(i, j);
    i = j;
    if (/^[-+.\d]+$/.test(tok)) {
      stack.push(tok);
      continue;
    }
    const num = (k: number) => Number(stack[stack.length - k]) || 0;
    switch (tok) {
      case "q":
        saved.push(ctm);
        break;
      case "Q":
        ctm = saved.pop() ?? ctm;
        break;
      case "cm":
        ctm = mulM([num(6), num(5), num(4), num(3), num(2), num(1)], ctm);
        break;
      case "BT":
        tm = [1, 0, 0, 1, 0, 0];
        lm = tm;
        break;
      case "Tf": {
        const name = stack[stack.length - 2]?.slice(1) ?? "";
        font = fonts.get(name) ?? null;
        size = Math.abs(num(1)) || size;
        break;
      }
      case "TL":
        lead = num(1);
        break;
      case "Td":
        newLine(num(2), num(1));
        break;
      case "TD":
        lead = -num(1);
        newLine(num(2), num(1));
        break;
      case "Tm":
        lm = [num(6), num(5), num(4), num(3), num(2), num(1)];
        tm = lm;
        break;
      case "T*":
        newLine(0, -lead);
        break;
      case "Tj":
      case "'":
      case '"': {
        if (tok !== "Tj") newLine(0, -lead);
        const v = stack[stack.length - 1];
        if (v && v.startsWith("[")) {
          const d = decodeBytes(JSON.parse(v) as number[], font);
          add(d.t, d.w);
        }
        break;
      }
      case "TJ": {
        const v = stack[stack.length - 1];
        if (v && v.startsWith("A")) {
          let t = "";
          let w = 0;
          for (const p of JSON.parse(v.slice(1)) as string[]) {
            if (p.startsWith("[")) {
              const d = decodeBytes(JSON.parse(p) as number[], font);
              t += d.t;
              w += d.w;
            } else {
              w -= Number(p) / 1000;
              if (Number(p) < -250) t += " ";
            }
          }
          add(t, w);
        }
        break;
      }
      default:
        break;
    }
    stack.length = 0;
  }
}

/** righe di testo del PDF, pagina per pagina, dall'alto in basso */
export function pdfLines(buf: Uint8Array, maxLines = 4000): string[] {
  const objs = objects(buf);
  const ref = (s: string | undefined) => (s ? objs.get(Number(s)) : undefined);
  // font → ToUnicode
  const fontCache = new Map<number, Font>();
  const fontOf = (num: number): Font => {
    if (fontCache.has(num)) return fontCache.get(num)!;
    const o = objs.get(num);
    let f: Font = null;
    const tu = o?.dict.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/)?.[1];
    const cm = ref(tu);
    const cid = Boolean(o && /\/Subtype\s*\/Type0/.test(o.dict));
    if (cm?.stream) f = cmapOf(latin1(cm.stream));
    else if (cid) f = { map: new Map(), bytes: 2 };
    else f = { map: new Map(), bytes: 1 };
    if (cid) f.bytes = Math.max(2, f.bytes);
    // larghezze delle lettere: servono a capire dove c'è uno spazio tra due pezzi della stessa riga
    const arr = (s: string | undefined) => {
      if (!s) return "";
      const r = s.match(/^\s*(\d+)\s+\d+\s+R/);
      return r ? (objs.get(Number(r[1]))?.dict ?? "") : s;
    };
    const widths = new Map<number, number>();
    if (o && !cid) {
      const fc = Number(o.dict.match(/\/FirstChar\s+(\d+)/)?.[1] ?? 0);
      const ws = arr(o.dict.match(/\/Widths\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/)?.[1]);
      (ws.match(/-?[\d.]+/g) ?? []).forEach((v, k) => widths.set(fc + k, Number(v) / 1000));
    } else if (o) {
      const desc = objs.get(Number(o.dict.match(/\/DescendantFonts\s*\[?\s*(\d+)\s+\d+\s+R/)?.[1]));
      if (desc) {
        f.dw = Number(desc.dict.match(/\/DW\s+(\d+)/)?.[1] ?? 1000) / 1000;
        const wm = desc.dict.match(/\/W\s*(\[[\s\S]*?\]\s*\]|\d+\s+\d+\s+R)/)?.[1];
        const w = arr(wm);
        // [c [w1 w2 …] c1 c2 w …]
        const toks = w.replace(/^\[|\]$/g, "").match(/\[[^\]]*\]|-?[\d.]+/g) ?? [];
        for (let k = 0; k < toks.length; ) {
          const c = Number(toks[k]);
          if (toks[k + 1]?.startsWith("[")) {
            (toks[k + 1].match(/-?[\d.]+/g) ?? []).forEach((v, q) => widths.set(c + q, Number(v) / 1000));
            k += 2;
          } else {
            const c2 = Number(toks[k + 1]);
            const v = Number(toks[k + 2]) / 1000;
            for (let q = c; q <= c2 && q - c < 5000; q++) widths.set(q, v);
            k += 3;
          }
        }
      }
    }
    if (widths.size) f.widths = widths;
    fontCache.set(num, f);
    return f;
  };
  const dictOf = (s: string, key: string): string => {
    // /Key << … >> oppure /Key n 0 R
    const i = s.indexOf(`/${key}`);
    if (i < 0) return "";
    const rest = s.slice(i + key.length + 1).trimStart();
    const r = rest.match(/^(\d+)\s+\d+\s+R/);
    if (r) return objs.get(Number(r[1]))?.dict ?? "";
    if (!rest.startsWith("<<")) return "";
    let depth = 0;
    for (let k = 0; k < rest.length - 1; k++) {
      if (rest[k] === "<" && rest[k + 1] === "<") {
        depth++;
        k++;
      } else if (rest[k] === ">" && rest[k + 1] === ">") {
        depth--;
        k++;
        if (!depth) return rest.slice(0, k + 1);
      }
    }
    return rest;
  };
  const pages = [...objs.values()].filter((o) => /\/Type\s*\/Page(?!s)\b/.test(o.dict));
  const all: string[] = [];
  for (const pg of pages) {
    // risorse della pagina (o del nodo padre)
    let res = dictOf(pg.dict, "Resources");
    if (!res) {
      const parent = objs.get(Number(pg.dict.match(/\/Parent\s+(\d+)/)?.[1]));
      res = parent ? dictOf(parent.dict, "Resources") : "";
    }
    const fontDict = dictOf(res, "Font");
    const fonts = new Map<string, Font>();
    for (const f of fontDict.matchAll(/\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g)) fonts.set(f[1], fontOf(Number(f[2])));
    const cont = pg.dict.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/)?.[1] ?? "";
    const parts = [...cont.matchAll(/(\d+)\s+\d+\s+R/g)].map((x) => objs.get(Number(x[1]))?.stream).filter((x): x is Uint8Array => Boolean(x));
    const items: Item[] = [];
    contentLines(parts.map(latin1).join("\n"), fonts, items);
    // stessa altezza = stessa riga (le colonne di una tabella), da sinistra a destra; i pezzi
    // attaccati (lettere spaziate una per una) senza spazio in mezzo
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let row: Item[] = [];
    const flush = () => {
      if (!row.length) return;
      row.sort((a, b) => a.x - b.x);
      let line = "";
      let end = -1e9;
      for (const r of row) {
        const gap = r.x - end;
        line += line && gap > r.size * 0.15 ? ` ${r.t}` : r.t;
        end = r.x + r.w;
      }
      line = line.replace(/\s+/g, " ").trim();
      if (line) all.push(line);
      row = [];
    };
    for (const it of items) {
      if (row.length && Math.abs(row[0].y - it.y) > Math.max(2, it.size * 0.3)) flush();
      row.push(it);
    }
    flush();
    if (all.length >= maxLines) break;
  }
  return all.slice(0, maxLines);
}
