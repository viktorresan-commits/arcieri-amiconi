/**
 * Lettura delle pagine del portale FITAST: HTML → tabelle, righe di testo, link e comandi del modulo.
 * Pura, senza rete. Il portale è fatto con WEBDEV (pagine .awp): molti pulsanti non sono link ma
 * invii del modulo della pagina in JavaScript (es. _JSL(_PAGE_,'A5',…)); qui si riconoscono, così
 * il server può "premerli" rimandando il modulo con WD_BUTTON_CLICK_ come farebbe il browser.
 */

export type FitastLink = { text: string; href: string };
export type FitastCell = { text: string; href?: string; press?: string; /** immagine dentro la cella (es. stemma della compagnia) */ img?: string };
/**
 * source "script": righe trovate nei dati di uno script della pagina; "wd": tabella WEBDEV (le righe
 * arrivano in XML dentro lo script che la dichiara e poi con le richieste AJAX LIGNESTABLE).
 * alias e total servono a chiedere al portale le righe che mancano.
 */
export type FitastTable = {
  rows: FitastCell[][];
  source?: "script" | "wd";
  alias?: string;
  total?: number;
  /** chiave del record di ogni riga di dati (attributo CLEENREG delle righe WEBDEV), se il portale la manda */
  keys?: string[];
  /** chiave di scorrimento della tabella (CLEENREGAP): va rimandata per avere le righe dopo */
  ap?: string;
};
export type FitastOption = { value: string; text: string; selected: boolean };
export type FitastSelect = { name: string; label: string; options: FitastOption[]; press?: { code: string; set: Record<string, string> } };
/** un comando della pagina: code è l'alias WEBDEV (A5…), set sono i campi che il click imposta prima dell'invio */
export type FitastButton = { code: string; label: string; set: Record<string, string> };
/** un campo di testo visibile del modulo (es. "Id Gara"), con l'etichetta che lo precede */
export type FitastInput = { name: string; label: string; value: string };
export type FitastForm = { action: string; fields: Record<string, string>; selects: FitastSelect[]; buttons: FitastButton[]; inputs?: FitastInput[] };
/** un elemento cliccabile qualsiasi (riga di una zona ripetuta WEBDEV, div, span…) con il suo testo e il comando */
export type FitastBlock = { text: string; press: string };
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
  blocks?: FitastBlock[];
  /** tabelle WEBDEV della pagina (alias come A12): le loro righe si chiedono al portale con AJAX */
  wdAliases?: string[];
  /** indirizzi di pagine .awp con parametri (es. pagView-Class-Arcieri-Gara.awp?P1=2472) scritti ovunque nella pagina */
  refs?: string[];
  /** la pagina rimanda subito a un'altra (meta refresh o location in uno script): dove */
  redirect?: string;
  /** nomi delle pagine .awp citate (es. pagView-Class-Squadre-Gara.awp), anche dove il numero si aggiunge in JavaScript */
  awp?: string[];
  /** come è fatta la pagina (per capire perché una tabella resta vuota): conteggi e nomi, mai il contenuto */
  diag?: string[];
  /** immagini della pagina, in ordine, con la riga di testo a cui stanno accanto (at = indice in lines) */
  pics?: { src: string; at: number }[];
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

type Token = { kind: "text"; text: string } | { kind: "script"; text: string } | { kind: "tag"; name: string; close: boolean; attrs: Record<string, string>; self: boolean };

const hasSrc = (raw: string) => /\bsrc\s*=/i.test(raw);

/** HTML → sequenza di tag e testo; commenti, doctype e stili saltati, script a parte; virgolette rispettate */
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
      // gli script in linea si tengono a parte: a volte contengono le righe delle tabelle
      if (name === "script" && !hasSrc(rawAttrs) && inner.trim()) out.push({ kind: "script", text: inner });
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

const VOID = new Set(["input", "img", "br", "hr", "meta", "link", "area", "base", "col", "embed", "source", "track", "wbr", "param"]);
/** contenitori che WEBDEV rende cliccabili (righe di zone ripetute, celle composte): a, input e button sono già comandi */
const CLICKABLE = new Set(["div", "tr", "span", "li", "p", "section", "article", "label", "table", "tbody", "ul"]);

const BLOCK = new Set(["br", "p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "header", "footer", "form", "fieldset", "legend", "label", "dt", "dd", "hr"]);

/** pagina HTML → tabelle (anche annidate: ogni tabella tiene le sue righe), righe di testo, link e comandi */
export function parseHtml(html: string, url: string): Omit<FitastPage, "fetchedAt" | "kind" | "charset"> {
  const toks = tokenize(html);
  type T = { rows: FitastCell[][]; row: FitastCell[] | null; cell: FitastCell | null; rowPress?: string };
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
  const inputs: FitastInput[] = [];
  // elementi cliccabili aperti (div, tr, span… con onclick WEBDEV): il testo che contengono è la loro etichetta
  const open: { tag: string; depth: number; text: string; press: string }[] = [];
  const blocks: FitastBlock[] = [];
  const pics: { src: string; at: number }[] = [];
  let scripts = "";
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
    for (const b of open) b.text += t;
    line += t;
    if (link) link.text += t;
    if (button) button.text += t;
  };
  for (const tk of toks) {
    if (tk.kind === "text") {
      text(tk.text);
      continue;
    }
    if (tk.kind === "script") {
      if (scripts.length < 3_000_000) scripts += `\n${tk.text}`;
      continue;
    }
    const { name: tag, close, attrs } = tk;
    // fra una cella e l'altra di un elemento cliccabile ci va uno spazio
    if (open.length && (BLOCK.has(tag) || tag === "td" || tag === "th" || tag === "tr")) for (const b of open) b.text += " ";
    if (!VOID.has(tag) && !tk.self) {
      if (!close) {
        for (const b of open) if (b.tag === tag) b.depth++;
        const p = CLICKABLE.has(tag) ? pressOf(attrs.onclick ?? "") : null;
        if (p && open.length < 40) open.push({ tag, depth: 0, text: "", press: JSON.stringify(p) });
      } else {
        for (let k = open.length - 1; k >= 0; k--) {
          if (open[k].tag !== tag) continue;
          if (open[k].depth > 0) {
            open[k].depth--;
            continue;
          }
          const [b] = open.splice(k, 1);
          const t = b.text.replace(/\s+/g, " ").trim();
          if (t && blocks.length < 2000) blocks.push({ text: t.slice(0, 400), press: b.press });
          break;
        }
      }
    }
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
          // il testo di una tabella interna resta anche nella cella che la contiene (e così l'immagine e il link:
          // WEBDEV mette spesso lo stemma in una tabellina dentro la cella della riga)
          const parent = stack[stack.length - 1];
          if (parent?.cell) {
            parent.cell.text += " " + rows.map((r) => r.map((c) => c.text).join(" ")).join(" ");
            const inner = [...t.rows.flat(), ...(t.row ?? [])];
            if (!parent.cell.img) {
              const im = inner.find((c) => c.img)?.img;
              if (im) parent.cell.img = im;
            }
            if (!parent.cell.href) {
              const hr = inner.find((c) => c.href)?.href;
              if (hr) parent.cell.href = hr;
            }
          }
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
      // riga intera cliccabile: il comando va sulla sua prima cella
      const rp = close ? null : pressOf(attrs.onclick ?? "");
      top.rowPress = rp ? JSON.stringify(rp) : undefined;
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
      else if (top.cell && top.rowPress && !top.row?.length) top.cell.press = top.rowPress;
      continue;
    }
    if (tag === "tr" || tag === "td" || tag === "th") continue;
    if (tag === "select") {
      if (!close) {
        ensureForm();
        const p = pressOf(attrs.onchange ?? "");
        // l'etichetta senza <label>: il testo della cella accanto (Categoria | [tendina]) se c'è
        const top2 = stack[stack.length - 1];
        const cellText = (c: FitastCell | null | undefined) => (c?.text ?? "").replace(/\s+/g, " ").trim();
        const prev = [...(top2?.row ?? [])].reverse().find((c) => c !== top2?.cell && cellText(c));
        const near = top2 ? cellText(top2.cell) || cellText(prev) : "";
        select = { name: attrs.name || attrs.id || "", label: attrs.title || attrs["aria-label"] || (near.length > 1 && near.length < 40 ? near : ""), options: [], pending: null, ...(p ? { press: p } : {}) };
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
      if (nm && ["text", "search", "number"].includes(type) && inputs.length < 60) inputs.push({ name: nm, label: (line.replace(/\s+/g, " ").trim() || lastLabel).slice(-40), value });
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
    if (tag === "img" || (tag === "input" && (attrs.type ?? "").toLowerCase() === "image")) {
      // l'indirizzo vero anche quando la pagina carica l'immagine dopo (data-src, srcset)
      const raw = [attrs["data-src"], attrs["data-original"], attrs["data-lazy-src"], attrs.src, (attrs.srcset ?? "").split(/\s+/)[0]].find((v) => v && !/^data:/i.test(v) && !/^(about:|javascript:)/i.test(v)) ?? "";
      const small = [attrs.width, attrs.height].some((v) => v != null && /^\d+$/.test(v) && Number(v) < 24);
      const real = raw && !small && !/spacer|pixel|blank|vide|puce|fleche|arrow|btn|bouton|loupe|picto/i.test(raw);
      const abs = real ? absolute(raw, url) : "";
      // la prima immagine "vera" della cella (non pallini, frecce o spazi del portale)
      if (abs && top?.cell && !top.cell.img) top.cell.img = abs;
      if (abs && pics.length < 3000) pics.push({ src: abs, at: lines.length });
    }
    if (BLOCK.has(tag)) flush();
  }
  flush();
  for (const b of open) {
    const t = b.text.replace(/\s+/g, " ").trim();
    if (t && blocks.length < 2000) blocks.push({ text: t.slice(0, 400), press: b.press });
  }
  if (form) {
    (form as FitastForm).buttons = buttons;
    (form as FitastForm).inputs = inputs;
  }
  // tabelle disegnate dal browser: le righe stanno negli script della pagina (prima le tabelle WEBDEV)
  if (scripts) {
    const wd = wdScriptTables(scripts);
    tables.push(...wd);
    if (!wd.length) tables.push(...scriptTables(scripts));
  }
  // righe XML scritte in un altro modo (attributi, altri escape): si cercano in tutta la pagina
  if (!tables.some((t) => t.source === "wd")) tables.push(...wdDeepTables(html));
  // tabelle WEBDEV: il campo nascosto ALIAS_DATA dice che ci sono (anche senza righe iniziali), le righe si chiedono dopo
  const wdAliases = Object.keys((form as FitastForm | null)?.fields ?? {})
    .map((k) => /^(.+)_DATA$/.exec(k)?.[1] ?? "")
    .filter(Boolean);
  for (const t of tables) if (t.source === "wd" && t.alias && !wdAliases.includes(t.alias)) wdAliases.push(t.alias);
  // niente doppioni fra i link
  const seen = new Set<string>();
  const uniq = links.filter((l) => (seen.has(l.href + l.text) ? false : (seen.add(l.href + l.text), true)));
  // niente righe ripetute di seguito (menu ripetuti, intestazioni); le immagini seguono le righe tenute
  const keptBefore: number[] = [];
  const tidy: string[] = [];
  lines.forEach((l, i) => {
    keptBefore[i] = tidy.length;
    if (l !== lines[i - 1]) tidy.push(l);
  });
  const picsAt = pics.map((x) => ({ src: x.src, at: x.at < lines.length ? keptBefore[x.at] : tidy.length }));
  const refs = awpRefs(html, url);
  const diag = pageDiag(html, (form as FitastForm | null) ?? null, tables);
  const awp = [...new Set([...html.matchAll(/[\w-]+\.awp\b/gi)].map((m) => m[0]))].slice(0, 80);
  const redirect = redirectOf(html, url, tables.length === 0 && tidy.length < 15 && !(form as FitastForm | null)?.buttons.length);
  return { url, title: clean(title), tables, lines: tidy.slice(0, 6000), links: uniq.slice(0, 400), form, blocks, ...(picsAt.length ? { pics: picsAt.filter((x) => x.at <= 6000) } : {}), wdAliases, ...(refs.length ? { refs } : {}), ...(awp.length ? { awp } : {}), ...(redirect ? { redirect } : {}), diag };
}

/** testo con gli escape più comuni sciolti (\\x3c, \\u003c, \\074, &lt;, %3C): per trovare XML nascosto */
function unescapeAll(t: string) {
  return t
    .replace(/\\x3c/gi, "<").replace(/\\x3e/gi, ">").replace(/\\u003c/gi, "<").replace(/\\u003e/gi, ">")
    .replace(/\\074/g, "<").replace(/\\076/g, ">").replace(/\\x22/gi, '"').replace(/\\u0022/gi, '"').replace(/\\"/g, '"').replace(/\\\//g, "/")
    .replace(/%3C/gi, "<").replace(/%3E/gi, ">").replace(/%22/g, '"')
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"');
}

/** blocchi <LIGNES>…</LIGNES> ovunque nella pagina, con le colonne che li precedono */
export function wdDeepTables(html: string): FitastTable[] {
  if (!/ligne/i.test(html)) return [];
  const src = unescapeAll(html);
  const out: FitastTable[] = [];
  const re = /<lignes[\s>]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) && out.length < 6) {
    const end = src.toLowerCase().indexOf("</lignes>", m.index);
    if (end < 0) break;
    const before = src.slice(Math.max(0, m.index - 20000), m.index);
    const colAt = before.toLowerCase().lastIndexOf("<colonnes");
    const start = colAt >= 0 ? m.index - (before.length - colAt) : m.index;
    const xml = `<WDTABLE>${src.slice(start, end + 9)}</WDTABLE>`;
    const alias = [...src.slice(Math.max(0, start - 600), start).matchAll(/DeclareChamp\(\s*["']([^"']+)["']|name=["']([^"']+)["']/g)].pop();
    const t = wdXmlTable(xml, alias?.[1] ?? alias?.[2] ?? "");
    if (t) out.push(t);
    re.lastIndex = end + 9;
  }
  return out;
}

/** come è fatta la pagina: script, tabelle WEBDEV, righe XML, campi nascosti (nomi), azione del modulo */
function pageDiag(html: string, form: FitastForm | null, tables: FitastTable[]): string[] {
  const n = (re: RegExp) => (html.match(re) ?? []).length;
  const lig = /(.{0,8})ligne\b/i.exec(html);
  const hidden = Object.keys(form?.fields ?? {}).filter((k) => /_DATA$|_OCC$|_SEL$|AWP|CONTEXT/i.test(k)).slice(0, 8);
  const decl = [...html.matchAll(/DeclareChamp\(\s*["']([^"']+)["'][^)]{0,80}?(WD\w+)/g)].map((m) => `${m[1]}:${m[2]}`).slice(0, 8);
  return [
    `html ${html.length} · script ${n(/<script\b/gi)} · tabelle html ${n(/<table\b/gi)} · righe lette ${tables.reduce((a, t) => a + Math.max(0, t.rows.length - 1), 0)}`,
    `WDTable ${n(/WDTable/g)} · DeclareChamp ${decl.join(" ") || "nessuno"} · LIGNE ${n(/ligne/gi)}${lig ? ` (${JSON.stringify(lig[1].replace(/[^\\x%&;<a-z0-9]/gi, "·"))})` : ""}`,
    `campi ${hidden.join(" ") || "nessuno"} · azione ${form ? (form.action.split("/").pop() ?? "") : "nessun modulo"} · AWPID ${/_AWPID_/.test(html) ? "sì" : "no"}`,
  ];
}

/** pagine .awp con parametri citate nella pagina (link, onclick, script): pagView-Class-Arcieri-Gara.awp?P1=2472 */
export function awpRefs(html: string, base: string): string[] {
  const out = new Set<string>();
  const src = html.replace(/&amp;/g, "&");
  for (const m of src.matchAll(/[\w./-]*\.awp\?P\d+=[^"'\s<>\\]*/gi)) {
    const abs = absolute(m[0], base);
    if (abs) out.add(abs);
    if (out.size >= 300) break;
  }
  return [...out];
}

/**
 * Rimando immediato: meta refresh, oppure (solo in una pagina quasi vuota) location/_JCL in uno script.
 * Dopo un invio WEBDEV a volte risponde così invece che con un 302.
 */
export function redirectOf(html: string, base: string, thin: boolean): string | null {
  const meta = /<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["']?\s*\d+\s*;\s*url=([^"'>\s]+)/i.exec(html);
  if (meta) return absolute(meta[1].replace(/&amp;/g, "&"), base) || null;
  if (!thin) return null;
  for (const sc of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const js = sc[1];
    const m = /(?:(?:window|document|top|self|parent)\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/.exec(js) ?? /location\.(?:replace|assign)\(\s*["']([^"']+)["']/.exec(js) ?? /_JCL\(\s*["']([^"']+)["']/.exec(js);
    if (m) return absolute(m[1].replace(/&amp;/g, "&"), base) || null;
  }
  return null;
}

/** fine di una stringa JavaScript che comincia in i (virgolette comprese) */
function skipString(js: string, i: number) {
  const q = js[i];
  for (let j = i + 1; j < js.length; j++) {
    if (js[j] === "\\") j++;
    else if (js[j] === q) return j;
    else if (js[j] === "\n") return j;
  }
  return js.length;
}

function unescapeJs(raw: string) {
  return raw.replace(/\\(u\{([0-9a-fA-F]{1,6})\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|.)/g, (_, all: string, ub?: string, u?: string, x?: string) => {
    if (ub || u) return String.fromCodePoint(parseInt(ub || u || "0", 16));
    if (x) return String.fromCharCode(parseInt(x, 16));
    return ({ n: " ", r: "", t: " ", b: "", f: "", v: "" } as Record<string, string>)[all] ?? all;
  });
}

type Lit = { v: string; end: number };
/** un valore semplice in i: stringa, numero, true/false/null */
function literalAt(js: string, i: number): Lit | null {
  const c = js[i];
  if (c === '"' || c === "'") {
    const e = skipString(js, i);
    if (js[e] !== c) return null;
    return { v: decode(unescapeJs(js.slice(i + 1, e))), end: e };
  }
  const m = /^(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|true|false|null|undefined)/.exec(js.slice(i, i + 40));
  if (!m) return null;
  return { v: m[1] === "null" || m[1] === "undefined" ? "" : m[1], end: i + m[1].length - 1 };
}

const ws = (js: string, i: number) => {
  while (i < js.length && /\s/.test(js[i])) i++;
  return i;
};

/** un array piatto [..] o un oggetto piatto {..} di soli valori semplici, a partire da i */
function flatAt(js: string, i: number): { cells: string[]; keys: string[] | null; end: number } | null {
  const obj = js[i] === "{";
  const close = obj ? "}" : "]";
  const cells: string[] = [];
  const keys: string[] = [];
  let j = ws(js, i + 1);
  while (j < js.length && cells.length < 60) {
    if (js[j] === close) return cells.length >= 2 ? { cells, keys: obj ? keys : null, end: j } : null;
    if (obj) {
      const id = /^[A-Za-z_$][\w$]*/.exec(js.slice(j, j + 60))?.[0];
      const k = js[j] === '"' || js[j] === "'" ? literalAt(js, j) : id ? { v: id, end: j + id.length - 1 } : null;
      if (!k) return null;
      j = ws(js, k.end + 1);
      if (js[j] !== ":") return null;
      j = ws(js, j + 1);
      keys.push(k.v);
    }
    const v = literalAt(js, j);
    if (!v) return null;
    cells.push(v.v.replace(/\s+/g, " ").trim().slice(0, 300));
    j = ws(js, v.end + 1);
    if (js[j] === ",") j = ws(js, j + 1);
    else if (js[j] !== close) return null;
  }
  return null;
}

/** XML → albero minimo (nome, attributi, figli, testo) per le risposte delle tabelle WEBDEV */
type XNode = { name: string; attrs: Record<string, string>; kids: XNode[]; text: string };
function xmlTree(xml: string): XNode {
  // il CDATA diventa testo normale
  const src = xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, c: string) => c.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  const root: XNode = { name: "#root", attrs: {}, kids: [], text: "" };
  const stack: XNode[] = [root];
  for (const tk of tokenize(src)) {
    const top = stack[stack.length - 1];
    if (tk.kind === "text") {
      top.text += decode(tk.text);
      continue;
    }
    if (tk.kind !== "tag") continue;
    if (tk.close) {
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].name === tk.name) {
          stack.length = k;
          break;
        }
      }
      continue;
    }
    const node: XNode = { name: tk.name, attrs: tk.attrs, kids: [], text: "" };
    top.kids.push(node);
    if (!tk.self) stack.push(node);
  }
  return root;
}
const xText = (n: XNode): string => (n.text + n.kids.map(xText).join(" ")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
function xAll(n: XNode, out: XNode[] = []): XNode[] {
  for (const k of n.kids) {
    out.push(k);
    xAll(k, out);
  }
  return out;
}
function xFind(n: XNode, name: string, out: XNode[] = []): XNode[] {
  for (const k of n.kids) {
    if (k.name === name) out.push(k);
    else xFind(k, name, out);
  }
  return out;
}

/**
 * Tabella WEBDEV in XML (righe iniziali nello script della pagina o risposta AJAX LIGNESTABLE):
 * COLONNES/COLONNE con il titolo (TITRE), LIGNES/LIGNE con una cella per figlio, NOMBRE = righe totali.
 */
export function wdXmlTable(xml: string, alias = ""): FitastTable | null {
  if (!/<ligne[\s>/]/i.test(xml)) return null;
  const root = xmlTree(xml);
  const lignes = xFind(root, "ligne");
  if (!lignes.length) return null;
  const cols = xFind(root, "colonne");
  // NOMBRE (righe in tutto) e CLEENREGAP sono attributi dell'elemento della tabella, qualunque sia il suo nome
  const all = xAll(root);
  const withTotal = all.find((n) => n.attrs.nombre != null && n.name !== "ligne");
  const total = withTotal ? Number(withTotal.attrs.nombre) : NaN;
  const ap = all.find((n) => n.attrs.cleenregap)?.attrs.cleenregap;
  const rows = lignes.map((l) => l.kids.filter((k) => k.name !== "ruptures").map((k) => ({ text: xText(k) })));
  const keys = lignes.map((l) => l.attrs.cleenreg ?? "");
  const width = Math.max(cols.length, ...rows.map((r) => r.length));
  const head = Array.from({ length: width }, (_, k) => ({ text: (cols[k]?.attrs.titre || cols[k]?.attrs.alias || `Colonna ${k + 1}`).replace(/\s+/g, " ").trim() }));
  return { source: "wd", alias, total: Number.isFinite(total) ? total : undefined, rows: [head, ...rows], ...(keys.some(Boolean) ? { keys } : {}), ...(ap ? { ap } : {}) };
}

/** configurazione di WEBDEV, non dati: stili delle righe e immagini dei pulsanti della tabella */
const WD_JUNK = /\.(gif|png|jpe?g|svg|css|js)$|^[a-z]-\d+( wb\w*)?$|^wb[A-Z]\w*$/i;

/** le tabelle WEBDEV dichiarate negli script: clWDUtil.DeclareChamp("A12", …, WDTable, ["<xml…>", …]) */
export function wdScriptTables(js: string): FitastTable[] {
  const out: FitastTable[] = [];
  for (let i = 0; i < js.length && out.length < 10; i++) {
    const c = js[i];
    if (c !== '"' && c !== "'") continue;
    const e = skipString(js, i);
    const raw = js.slice(i + 1, e);
    if (raw.length > 30 && /<ligne|&lt;ligne|\\x3cligne|\\u003cligne/i.test(raw)) {
      const xml = unescapeJs(raw);
      const before = js.slice(Math.max(0, i - 400), i);
      const alias = [...before.matchAll(/DeclareChamp\(\s*["']([^"']+)["']/g)].pop()?.[1] ?? "";
      const t = wdXmlTable(/&lt;ligne/i.test(xml) && !/<ligne/i.test(xml) ? decode(xml) : xml, alias);
      if (t) out.push(t);
    }
    i = e;
  }
  return out;
}

/**
 * Righe di dati scritte negli script della pagina (le tabelle "lato browser" di WEBDEV e simili):
 * array o oggetti piatti di valori, uno dopo l'altro, diventano le righe di una tabella.
 */
export function scriptTables(js: string): FitastTable[] {
  const rows: { cells: string[]; keys: string[] | null; start: number; end: number }[] = [];
  for (let i = 0; i < js.length && rows.length < 6000; i++) {
    const c = js[i];
    if (c === '"' || c === "'") {
      i = skipString(js, i);
      continue;
    }
    if (c === "/" && js[i + 1] === "/") {
      const e = js.indexOf("\n", i);
      i = e < 0 ? js.length : e;
      continue;
    }
    if (c === "/" && js[i + 1] === "*") {
      const e = js.indexOf("*/", i + 2);
      i = e < 0 ? js.length : e + 1;
      continue;
    }
    if (c !== "[" && c !== "{") continue;
    const r = flatAt(js, i);
    if (r) {
      rows.push({ ...r, start: i });
      i = r.end;
    }
  }
  const out: FitastTable[] = [];
  let group: typeof rows = [];
  const done = () => {
    // le impostazioni di WEBDEV (stili, immagini dei pulsanti) non sono righe
    if (group.some((r) => r.cells.filter((c) => WD_JUNK.test(c.trim())).length >= r.cells.length / 2)) {
      group = [];
      return;
    }
    const data = group.filter((r) => r.cells.some((c) => /[A-Za-zÀ-ÿ]{2}/.test(c)));
    if (data.length >= 2 && data.length >= group.length / 2) {
      const width = Math.max(...group.map((r) => r.cells.length));
      const keys = group[0].keys && group.every((r) => r.keys?.join("|") === group[0].keys?.join("|")) ? group[0].keys : null;
      const head = (keys ?? Array.from({ length: width }, (_, k) => `Colonna ${k + 1}`)).map((text) => ({ text }));
      out.push({ source: "script", rows: [head, ...group.map((r) => r.cells.map((text) => ({ text })))] });
    }
    group = [];
  };
  for (let k = 0; k < rows.length; k++) {
    if (group.length && !/^[\s,\[\]]*$/.test(js.slice(group[group.length - 1].end + 1, rows[k].start))) done();
    group.push(rows[k]);
  }
  done();
  return out.slice(0, 20);
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
  return formBodyPairs(Object.entries(fields), charset);
}

/** come formBody, ma con l'ordine dei campi deciso da chi chiama (le richieste AJAX di WEBDEV) */
export function formBodyPairs(pairs: [string, string][], charset: string) {
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
  return pairs.map(([k, v]) => `${enc(k)}=${enc(v)}`).join("&");
}

/**
 * Le tabelle WEBDEV (classifiche, elenco gare) mandano nella pagina solo le prime righe: le altre il
 * browser le chiede con una richiesta AJAX alla pagina stessa
 * (WD_ACTION_=AJAXEXECUTE&LIGNESTABLE=alias&inizio=quante&alias_DATA=…&alias=riga scelta).
 * Qui si fa la stessa cosa finché la tabella è completa; post manda il corpo e restituisce l'XML.
 */
export async function fillWdTables(page: FitastPage, post: (action: string, body: string) => Promise<string | null>) {
  const aliases = page.wdAliases ?? [];
  if (!aliases.length || !page.form) return;
  // dove manda le richieste il browser: l'azione del modulo; se non risponde, l'indirizzo della pagina
  // con i suoi parametri (le pagine AWP come ...awp?P1=2472 non hanno sessione: la gara sta nell'indirizzo)
  const targets = [...new Set([page.form.action || page.url, page.url])];
  for (const alias of aliases.slice(0, 4)) {
    let t: FitastTable | undefined = page.tables.find((x) => x.source === "wd" && x.alias === alias);
    // righe in tutto: anche dal campo nascosto _ALIAS_OCC
    const occ = Number(page.form.fields[`_${alias}_OCC`] ?? NaN);
    if (t && t.total == null && Number.isFinite(occ) && occ > 0) t.total = occ;
    let target = targets[0];
    for (let round = 0; round < 15; round++) {
      const got = t ? t.rows.length - 1 : 0;
      if (t?.total != null && got >= t.total) break;
      if (got >= 3000) break;
      // come WDTable.js: LIGNESTABLE=alias & inizio=quante, poi i campi della pagina AWP
      const pairs: [string, string][] = [
        ["WD_ACTION_", "AJAXEXECUTE"],
        ["LIGNESTABLE", alias],
        [String(got), "100"],
      ];
      if (t?.ap) pairs.push(["WD_TABLE_CLEENREGAP_POS_", String(t.total ?? got)], ["WD_TABLE_CLEENREGAP_", t.ap]);
      const data = page.form.fields[`${alias}_DATA`];
      if (data != null) pairs.push([`${alias}_DATA`, data]);
      const sel = page.form.fields[alias];
      if (sel != null) pairs.push([`${alias}_SEL`, sel], [alias, sel]);
      // la chiave dell'ultima riga già avuta: il portale riparte da lì
      const lastKey = t?.keys?.[got - 1];
      if (lastKey) pairs.push(["WD_TABLE_CLEENREG_POS_", String(got - 1)], ["WD_TABLE_CLEENREG_", lastKey]);
      const body = formBodyPairs(pairs, page.charset);
      let xml = await post(target, body);
      let more = xml ? wdXmlTable(xml, alias) ?? wdDeepTables(xml)[0] ?? null : null;
      if ((!more || more.rows.length < 2) && round === 0 && targets.length > 1) {
        target = targets[1];
        xml = await post(target, body);
        more = xml ? wdXmlTable(xml, alias) ?? wdDeepTables(xml)[0] ?? null : null;
      }
      // tabella da scorrere per chiave (PARCOURTAP), come chiede il browser quando non sa da dove partire
      if ((!more || more.rows.length < 2) && round === 0) {
        const ap: [string, string][] = [["WD_ACTION_", "AJAXEXECUTE"], ["PARCOURTAP", alias], ...pairs.slice(3)];
        for (const tg of targets) {
          xml = await post(tg, formBodyPairs(ap, page.charset));
          more = xml ? wdXmlTable(xml, alias) ?? wdDeepTables(xml)[0] ?? null : null;
          if (more && more.rows.length >= 2) break;
        }
      }
      if (!more || more.rows.length < 2) break;
      if (!t) {
        t = more;
        page.tables.push(t);
      } else {
        // il portale a volte rimanda anche righe già avute: si tengono solo quelle nuove
        const seen = new Set(t.rows.slice(1).map((r) => r.map((c) => c.text).join("|")));
        const fresh = more.rows.slice(1).map((r, k) => ({ r, key: more!.keys?.[k] ?? "" })).filter((x) => !seen.has(x.r.map((c) => c.text).join("|")));
        if (!fresh.length) break;
        if (t.keys || more.keys) t.keys = [...(t.keys ?? Array(t.rows.length - 1).fill("")), ...fresh.map((x) => x.key)];
        t.rows.push(...fresh.map((x) => x.r));
        if (more.total != null) t.total = more.total;
        if (more.ap) t.ap = more.ap;
        // titoli delle colonne arrivati solo adesso
        if (t.rows[0].every((c) => /^Colonna \d+$/.test(c.text)) && more.rows[0].some((c) => !/^Colonna \d+$/.test(c.text))) t.rows[0] = more.rows[0];
      }
      if (t.total == null && !t.ap) break;
    }
  }
  // una tabella WEBDEV rimasta vuota non serve
  page.tables = page.tables.filter((x) => x.rows.length >= 2);
}
