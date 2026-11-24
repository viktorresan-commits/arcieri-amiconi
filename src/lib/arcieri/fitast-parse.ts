/**
 * Lettura delle pagine del portale FITAST: HTML → tabelle, righe di testo, link e comandi del modulo.
 * Pura, senza rete. Il portale è fatto con WEBDEV (pagine .awp): molti pulsanti non sono link ma
 * invii del modulo della pagina in JavaScript (es. _JSL(_PAGE_,'A5',…)); qui si riconoscono, così
 * il server può "premerli" rimandando il modulo con WD_BUTTON_CLICK_ come farebbe il browser.
 */

export type FitastLink = { text: string; href: string };
export type FitastCell = { text: string; href?: string; press?: string };
export type FitastTable = { rows: FitastCell[][] };
export type FitastOption = { value: string; text: string; selected: boolean };
export type FitastSelect = { name: string; label: string; options: FitastOption[]; press?: { code: string; set: Record<string, string> } };
/** un comando della pagina: code è l'alias WEBDEV (A5…), set sono i campi che il click imposta prima dell'invio */
export type FitastButton = { code: string; label: string; set: Record<string, string> };
export type FitastForm = { action: string; fields: Record<string, string>; selects: FitastSelect[]; buttons: FitastButton[] };
export type FitastPage = {
  url: string;
  title: string;
  kind: "html" | "pdf" | "altro";
  tables: FitastTable[];
  lines: string[];
  links: FitastLink[];
  form: FitastForm | null;
  charset: string;
  fetchedAt: string;
};

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", agrave: "à", egrave: "è", eacute: "é", igrave: "ì", ograve: "ò", ugrave: "ù", Agrave: "À", Egrave: "È", Eacute: "É", Igrave: "Ì", Ograve: "Ò", Ugrave: "Ù", deg: "°", laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", euro: "€", ordm: "º", ordf: "ª" };
export function decode(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENT[n] ?? m);
}
const clean = (s: string) => decode(s).replace(/\s+/g, " ").trim();

function absolute(href: string, base: string) {
  try {
    const u = new URL(decode(href).trim(), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

/** attributi di un tag, con i valori fra virgolette che possono contenere > e spazi */
export function attrsOf(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([^\s=/>"']+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const k = m[1].toLowerCase();
    if (k in out) continue;
    out[k] = decode(m[3] ?? m[4] ?? m[5] ?? "");
  }
  return out;
}

type Token = { kind: "text"; text: string } | { kind: "tag"; name: string; close: boolean; attrs: Record<string, string>; self: boolean };

/** HTML → sequenza di tag e testo; commenti, doctype, script e stili saltati; virgolette rispettate */
export function tokenize(html: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      out.push({ kind: "text", text: html.slice(i) });
      break;
    }
    if (lt > i) out.push({ kind: "text", text: html.slice(i, lt) });
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      const end = html.indexOf(">", lt);
      i = end < 0 ? n : end + 1;
      continue;
    }
    const nm = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(lt, lt + 64));
    if (!nm) {
      // un "<" che non apre un tag: è testo
      out.push({ kind: "text", text: "<" });
      i = lt + 1;
      continue;
    }
    // fine del tag: il primo > fuori dalle virgolette
    let j = lt + nm[0].length;
    let q = "";
    for (; j < n; j++) {
      const c = html[j];
      if (q) {
        if (c === q) q = "";
      } else if (c === '"' || c === "'") {
        // le virgolette contano solo come valore di un attributo (dopo un =)
        const before = html.slice(Math.max(lt, j - 3), j).replace(/\s+$/, "");
        if (before.endsWith("=")) q = c;
      } else if (c === ">") break;
    }
    const rawAttrs = html.slice(lt + nm[0].length, j);
    const name = nm[2].toLowerCase();
    const close = nm[1] === "/";
    out.push({ kind: "tag", name, close, attrs: close ? {} : attrsOf(rawAttrs), self: /\/\s*$/.test(rawAttrs) });
    i = j + 1;
    // contenuto grezzo: script, stili e textarea non si leggono come HTML
    if (!close && (name === "script" || name === "style" || name === "noscript" || name === "textarea" || name === "template")) {
      const endTag = html.toLowerCase().indexOf(`</${name}`, i);
      const inner = endTag < 0 ? html.slice(i) : html.slice(i, endTag);
      if (name === "textarea" && inner.trim()) out.push({ kind: "text", text: inner });
      if (endTag < 0) break;
      const gt = html.indexOf(">", endTag);
      i = gt < 0 ? n : gt + 1;
      if (name === "textarea") out.push({ kind: "tag", name, close: true, attrs: {}, self: false });
    }
  }
  return out;
}

/** dall'onclick o dall'href javascript: l'alias del comando WEBDEV e i campi che imposta */
export function pressOf(js: string): { code: string; set: Record<string, string> } | null {
  if (!js) return null;
  const set: Record<string, string> = {};
  const setter = /_PAGE_\s*\.\s*([A-Za-z][A-Za-z0-9_]*)\s*\.\s*value\s*=\s*(?:'([^']*)'|"([^"]*)"|(-?\d+))/g;
  let s: RegExpExecArray | null;
  while ((s = setter.exec(js))) set[s[1]] = s[2] ?? s[3] ?? s[4] ?? "";
  const call = /_JS[LCM]?\s*\(\s*_PAGE_\s*,\s*['"]([A-Za-z0-9_]+)['"]/.exec(js) ?? /pfGetTraitement\s*\(\s*['"]([A-Za-z0-9_]+)['"]/.exec(js) ?? /_PSL?\s*\(\s*['"]([A-Za-z0-9_]+)['"]/.exec(js);
  if (!call) return null;
  return { code: call[1], set };
}

const BLOCK = new Set(["br", "p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "header", "footer", "form", "fieldset", "legend", "label", "dt", "dd", "hr"]);

/** pagina HTML → tabelle (anche annidate: ogni tabella tiene le sue righe), righe di testo, link e comandi */
export function parseHtml(html: string, url: string): Omit<FitastPage, "fetchedAt" | "kind" | "charset"> {
  const toks = tokenize(html);
  type T = { rows: FitastCell[][]; row: FitastCell[] | null; cell: FitastCell | null };
  const stack: T[] = [];
  const tables: FitastTable[] = [];
  const lines: string[] = [];
  const links: FitastLink[] = [];
  let title = "";
  let inTitle = false;
  let line = "";
  let link: { href: string; text: string; press: string } | null = null;
  let form: FitastForm | null = null;
  let select: (FitastSelect & { pending: FitastOption | null }) | null = null;
  let button: { code: string; set: Record<string, string>; text: string } | null = null;
  const buttons: FitastButton[] = [];
  const addButton = (code: string, label: string, set: Record<string, string>) => {
    const l = label.replace(/\s+/g, " ").trim();
    if (!code || !l || l.length > 60) return;
    if (!buttons.some((b) => b.code === code && b.label === l && JSON.stringify(b.set) === JSON.stringify(set))) buttons.push({ code, label: l, set });
  };
  const ensureForm = () => (form ??= { action: url, fields: {}, selects: [], buttons: [] });
  let lastLabel = "";
  const flush = () => {
    const t = line.replace(/\s+/g, " ").trim();
    if (t) {
      lines.push(t);
      if (t.length < 40) lastLabel = t;
    }
    line = "";
  };
  const text = (raw: string) => {
    const t = decode(raw);
    if (inTitle) {
      title += t;
      return;
    }
    if (select?.pending) {
      select.pending.text += t;
      return;
    }
    const top = stack[stack.length - 1];
    if (top?.cell) top.cell.text += t;
    line += t;
    if (link) link.text += t;
    if (button) button.text += t;
  };
  for (const tk of toks) {
    if (tk.kind === "text") {
      text(tk.text);
      continue;
    }
    const { name: tag, close, attrs } = tk;
    if (tag === "title") {
      inTitle = !close;
      continue;
    }
    if (tag === "form" && !close) {
      const f = ensureForm();
      if (attrs.action) f.action = absolute(attrs.action, url) || url;
      flush();
      continue;
    }
    if (tag === "table") {
      if (!close) stack.push({ rows: [], row: null, cell: null });
      else {
        const t = stack.pop();
        if (t) {
          if (t.cell) (t.row ??= []).push(t.cell);
          if (t.row?.length) t.rows.push(t.row);
          const rows = t.rows.map((r) => r.map((c) => ({ ...c, text: c.text.replace(/\s+/g, " ").trim() }))).filter((r) => r.some((c) => c.text));
          if (rows.length >= 2 && rows.some((r) => r.length >= 2)) tables.push({ rows });
          // il testo di una tabella interna resta anche nella cella che la contiene
          const parent = stack[stack.length - 1];
          if (parent?.cell) parent.cell.text += " " + rows.map((r) => r.map((c) => c.text).join(" ")).join(" ");
        }
      }
      flush();
      continue;
    }
    const top = stack[stack.length - 1];
    if (tag === "tr" && top) {
      if (top.cell && top.row) top.row.push(top.cell);
      top.cell = null;
      if (top.row?.length) top.rows.push(top.row);
      top.row = close ? null : [];
      flush();
      continue;
    }
    if ((tag === "td" || tag === "th") && top) {
      if (!top.row) top.row = [];
      if (top.cell) top.row.push(top.cell);
      top.cell = close ? null : { text: "" };
      if (!close) line += " ";
      // una riga cliccabile di WEBDEV: il comando sta sull'onclick della cella
      const p = close ? null : pressOf(attrs.onclick ?? "");
      if (p && top.cell) top.cell.press = JSON.stringify(p);
      continue;
    }
    if (tag === "tr" || tag === "td" || tag === "th") continue;
    if (tag === "select") {
      if (!close) {
        ensureForm();
        const p = pressOf(attrs.onchange ?? "");
        select = { name: attrs.name || attrs.id || "", label: attrs.title || attrs["aria-label"] || "", options: [], pending: null, ...(p ? { press: p } : {}) };
      } else if (select) {
        if (select.pending) select.options.push(select.pending);
        const s = select;
        s.options = s.options.map((o) => ({ ...o, text: o.text.replace(/\s+/g, " ").trim() }));
        const f = form as FitastForm | null;
        if (s.name && s.options.length && f) {
          f.selects.push({ name: s.name, label: s.label || lastLabel, options: s.options, ...(s.press ? { press: s.press } : {}) });
          const chosen = s.options.find((o) => o.selected) ?? s.options[0];
          f.fields[s.name] = chosen.value;
          line += ` ${chosen.text} `;
        }
        select = null;
      }
      continue;
    }
    if (tag === "option" && select) {
      if (select.pending) select.options.push(select.pending);
      select.pending = close ? null : { value: attrs.value ?? "", text: "", selected: "selected" in attrs };
      if (select.pending && attrs.value == null) select.pending.value = "\u0000";
      continue;
    }
    if (tag === "input") {
      const type = (attrs.type || "text").toLowerCase();
      const nm = attrs.name || "";
      const value = attrs.value ?? "";
      // come il browser: i campi disabilitati non si inviano
      if (nm && !("disabled" in attrs) && ["hidden", "text", "search", "number", "date", "email", "tel", "password"].includes(type)) ensureForm().fields[nm] = value;
      if (nm && (type === "checkbox" || type === "radio") && "checked" in attrs) ensureForm().fields[nm] = value || "on";
      if (["button", "submit", "image"].includes(type)) {
        const p = pressOf(attrs.onclick ?? "");
        if (p) addButton(p.code, value || attrs.title || attrs.alt || "", p.set);
        else if (type === "submit" && nm) addButton(nm, value || nm, {});
        continue;
      }
      // WEBDEV mostra spesso i dati dentro campi in sola lettura: il loro valore è testo della pagina
      if (type !== "hidden" && type !== "password" && value.trim()) text(` ${value} `);
      continue;
    }
    if (tag === "button") {
      if (!close) {
        const p = pressOf(attrs.onclick ?? "");
        button = p ? { ...p, text: "" } : null;
        if (!p && (attrs.type ?? "submit") === "submit" && attrs.name) button = { code: attrs.name, set: {}, text: "" };
      } else if (button) {
        addButton(button.code, button.text || "", button.set);
        button = null;
      }
      continue;
    }
    if (tag === "a") {
      if (!close) {
        const raw = attrs.href ?? "";
        const js = /^javascript:/i.test(raw) ? raw : "";
        const p = pressOf(`${js} ${attrs.onclick ?? ""}`);
        const abs = raw && !js && !raw.startsWith("#") ? absolute(raw, url) : "";
        link = abs || p ? { href: abs, text: "", press: p ? JSON.stringify(p) : "" } : null;
        if (abs && top?.cell && !top.cell.href) top.cell.href = abs;
        if (p && top?.cell && !top.cell.press) top.cell.press = JSON.stringify(p);
      } else if (link) {
        const t = link.text.replace(/\s+/g, " ").trim();
        if (link.press) {
          const p = JSON.parse(link.press) as { code: string; set: Record<string, string> };
          ensureForm();
          addButton(p.code, t, p.set);
        } else if (t || link.href) links.push({ text: t || link.href.split("/").pop() || "link", href: link.href });
        link = null;
      }
      continue;
    }
    if (tag === "img" && link && attrs.alt) link.text += ` ${attrs.alt} `;
    if (BLOCK.has(tag)) flush();
  }
  flush();
  if (form) (form as FitastForm).buttons = buttons;
  // niente doppioni fra i link
  const seen = new Set<string>();
  const uniq = links.filter((l) => (seen.has(l.href + l.text) ? false : (seen.add(l.href + l.text), true)));
  // niente righe ripetute di seguito (menu ripetuti, intestazioni)
  const tidy = lines.filter((l, i) => l !== lines[i - 1]);
  return { url, title: clean(title), tables, lines: tidy.slice(0, 2000), links: uniq.slice(0, 400), form };
}

/** campi da inviare per premere un comando, con le scelte fatte nelle tendine */
export function pressFields(form: FitastForm, code: string, set: Record<string, string> = {}, choose: Record<string, string> = {}) {
  const fields: Record<string, string> = { ...form.fields };
  for (const [k, v] of Object.entries(choose)) fields[k] = v === "\u0000" ? "" : v;
  Object.assign(fields, set);
  fields.WD_BUTTON_CLICK_ = code;
  fields.WD_ACTION_ = fields.WD_ACTION_ ?? "";
  return fields;
}

/** codifica application/x-www-form-urlencoded nel charset della pagina (WEBDEV usa spesso windows-1252) */
export function formBody(fields: Record<string, string>, charset: string) {
  const latin = /1252|8859|latin/i.test(charset);
  const enc = (s: string) => {
    if (!latin) return encodeURIComponent(s).replace(/%20/g, "+");
    let out = "";
    for (const ch of s) {
      const c = ch.codePointAt(0) ?? 63;
      if (/[A-Za-z0-9*\-._]/.test(ch)) out += ch;
      else if (ch === " ") out += "+";
      else if (c < 256) out += `%${c.toString(16).toUpperCase().padStart(2, "0")}`;
      else if (ch === "€") out += "%80";
      else out += encodeURIComponent(ch);
    }
    return out;
  };
  return Object.entries(fields)
    .map(([k, v]) => `${enc(k)}=${enc(v)}`)
    .join("&");
}
