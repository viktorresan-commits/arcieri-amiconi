/**
 * Scrittore PDF minimo, senza librerie: pagine A4, testo Helvetica (normale e grassetto, con
 * le lettere accentate italiane), linee, rettangoli, cerchi. Tutto vettoriale e in scala di
 * grigi, pensato per la stampa in bianco e nero. Le coordinate partono dall'alto a sinistra.
 */

// larghezze Helvetica (unità /1000) per i caratteri 32–126
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const HELVB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

// lettere accentate → lettera base (stessa larghezza)
const BASE: Record<string, string> = { à: "a", á: "a", â: "a", ä: "a", è: "e", é: "e", ê: "e", ë: "e", ì: "i", í: "i", î: "i", ï: "i", ò: "o", ó: "o", ô: "o", ö: "o", ù: "u", ú: "u", û: "u", ü: "u", ç: "c", ñ: "n", À: "A", Á: "A", È: "E", É: "E", Ì: "I", Ò: "O", Ù: "U", Ç: "C", Ñ: "N" };
// caratteri fuori da Latin-1 che WinAnsi ha comunque
const WIN: Record<string, number> = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99 };
const SUBST: Record<string, string> = { "″": '"', "′": "'", "≈": "~", "→": "->", "←": "<-", "✓": "v", "×": "×", "·": "·" };

function widthOf(ch: string, bold: boolean): number {
  const t = bold ? HELVB : HELV;
  const c = ch.charCodeAt(0);
  if (c >= 32 && c <= 126) return t[c - 32];
  const b = BASE[ch];
  if (b) return t[b.charCodeAt(0) - 32];
  if (ch === "×") return 584;
  if (ch === "·") return 278;
  if (ch === "°") return 400;
  if (ch === "’" || ch === "‘") return bold ? 278 : 222;
  if (ch === "“" || ch === "”") return bold ? 500 : 333;
  if (ch === "–" || ch === "€" || ch === "«" || ch === "»") return 556;
  if (ch === "—") return 1000;
  if (ch === "•") return 350;
  return 556;
}

/** testo → byte WinAnsi come stringa "binaria", con ( ) \ protetti */
function encode(s: string) {
  let out = "";
  for (const raw of s) {
    const ch = SUBST[raw] ?? raw;
    for (const c of ch) {
      const code = c.charCodeAt(0);
      let b: number;
      if (WIN[c] != null) b = WIN[c];
      else if (code >= 32 && code <= 126) b = code;
      else if (code >= 0xa0 && code <= 0xff) b = code;
      else b = 63; // ?
      const k = String.fromCharCode(b);
      out += k === "(" || k === ")" || k === "\\" ? `\\${k}` : k;
    }
  }
  return out;
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

export class Pdf {
  readonly W = 595.28;
  readonly H = 841.89;
  private pages: string[][] = [];
  private cur: string[] = [];

  constructor() {
    this.addPage();
  }

  get pageCount() {
    return this.pages.length;
  }

  addPage() {
    this.cur = [];
    this.pages.push(this.cur);
  }

  /** disegna su una pagina già fatta (per i numeri di pagina alla fine) */
  onPage(i: number, fn: () => void) {
    const keep = this.cur;
    this.cur = this.pages[i];
    fn();
    this.cur = keep;
  }

  width(s: string, size: number, bold = false) {
    let w = 0;
    for (const ch of s) w += widthOf(ch, bold);
    return (w / 1000) * size;
  }

  /** a capo sulle parole entro maxW */
  wrap(s: string, size: number, maxW: number, bold = false) {
    const lines: string[] = [];
    for (const para of s.split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (this.width(next, size, bold) <= maxW || !line) line = next;
        else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  text(x: number, y: number, s: string, size: number, opts: { bold?: boolean; gray?: number; align?: "left" | "center" | "right" } = {}) {
    if (!s) return;
    const w = this.width(s, size, opts.bold);
    const xx = opts.align === "center" ? x - w / 2 : opts.align === "right" ? x - w : x;
    this.cur.push(`BT /${opts.bold ? "F2" : "F1"} ${f(size)} Tf ${f(opts.gray ?? 0)} g ${f(xx)} ${f(this.H - y)} Td (${encode(s)}) Tj ET`);
  }

  rect(x: number, y: number, w: number, h: number, opts: { fill?: number; stroke?: number; lw?: number } = {}) {
    const ops: string[] = ["q"];
    if (opts.lw != null) ops.push(`${f(opts.lw)} w`);
    if (opts.fill != null) ops.push(`${f(opts.fill)} g`);
    if (opts.stroke != null) ops.push(`${f(opts.stroke)} G`);
    ops.push(`${f(x)} ${f(this.H - y - h)} ${f(w)} ${f(h)} re`);
    ops.push(opts.fill != null && opts.stroke != null ? "B" : opts.fill != null ? "f" : "S");
    ops.push("Q");
    this.cur.push(ops.join(" "));
  }

  line(x1: number, y1: number, x2: number, y2: number, opts: { lw?: number; gray?: number; dash?: number[] } = {}) {
    this.cur.push(`q ${f(opts.lw ?? 0.6)} w ${f(opts.gray ?? 0)} G ${opts.dash ? `[${opts.dash.map(f).join(" ")}] 0 d` : ""} ${f(x1)} ${f(this.H - y1)} m ${f(x2)} ${f(this.H - y2)} l S Q`);
  }

  circle(cx: number, cy: number, r: number, opts: { fill?: boolean; lw?: number; gray?: number } = {}) {
    const k = 0.5523 * r;
    const y = this.H - cy;
    const path = `${f(cx + r)} ${f(y)} m ${f(cx + r)} ${f(y + k)} ${f(cx + k)} ${f(y + r)} ${f(cx)} ${f(y + r)} c ${f(cx - k)} ${f(y + r)} ${f(cx - r)} ${f(y + k)} ${f(cx - r)} ${f(y)} c ${f(cx - r)} ${f(y - k)} ${f(cx - k)} ${f(y - r)} ${f(cx)} ${f(y - r)} c ${f(cx + k)} ${f(y - r)} ${f(cx + r)} ${f(y - k)} ${f(cx + r)} ${f(y)} c`;
    const g = f(opts.gray ?? 0);
    this.cur.push(`q ${f(opts.lw ?? 0.8)} w ${g} G ${g} g ${path} ${opts.fill ? "B" : "S"} Q`);
  }

  /** il file PDF */
  bytes(title = "Documento"): Uint8Array {
    const objs: string[] = [];
    const add = (s: string) => {
      objs.push(s);
      return objs.length;
    };
    const catalog = add("");
    const pagesId = add("");
    const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const kids: number[] = [];
    for (const ops of this.pages) {
      const content = ops.join("\n");
      const cid = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f(this.W)} ${f(this.H)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${cid} 0 R >>`));
    }
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
    const info = add(`<< /Title (${encode(title)}) /Producer (Arcieri Amiconi) >>`);
    let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
    const offsets: number[] = [];
    objs.forEach((o, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}
