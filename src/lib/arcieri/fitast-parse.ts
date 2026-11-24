/** Lettura delle pagine del portale FITAST: HTML → tabelle, righe di testo e link. Pura, senza rete. */

export type FitastLink = { text: string; href: string };
export type FitastCell = { text: string; href?: string };
export type FitastTable = { rows: FitastCell[][] };
export type FitastPage = { url: string; title: string; kind: "html" | "pdf" | "altro"; tables: FitastTable[]; lines: string[]; links: FitastLink[]; fetchedAt: string };


const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", agrave: "à", egrave: "è", eacute: "é", igrave: "ì", ograve: "ò", ugrave: "ù", Agrave: "À", Egrave: "È", Eacute: "É", deg: "°", laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—" };
function decode(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
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

/** pagina HTML → tabelle (anche annidate: ogni tabella tiene le sue righe), righe di testo e link */
export function parseHtml(html: string, url: string): Omit<FitastPage, "fetchedAt" | "kind"> {
  const body = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ");
  const title = clean((body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""));
  type T = { rows: FitastCell[][]; row: FitastCell[] | null; cell: { text: string; href?: string } | null };
  const stack: T[] = [];
  const tables: FitastTable[] = [];
  const lines: string[] = [];
  const links: FitastLink[] = [];
  let line = "";
  let link: { href: string; text: string } | null = null;
  const flush = () => {
    const t = line.replace(/\s+/g, " ").trim();
    if (t) lines.push(t);
    line = "";
  };
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m[4] != null) {
      const text = decode(m[4]);
      const top = stack[stack.length - 1];
      if (top?.cell) top.cell.text += text;
      line += text;
      if (link) link.text += text;
      continue;
    }
    const close = m[1] === "/";
    const tag = m[2].toLowerCase();
    const attrs = m[3] ?? "";
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
      continue;
    }
    if (tag === "a") {
      if (!close) {
        const href = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const raw = href ? href[2] ?? href[3] ?? href[4] ?? "" : "";
        const abs = raw && !/^javascript:/i.test(raw) && !raw.startsWith("#") ? absolute(raw, url) : "";
        link = abs ? { href: abs, text: "" } : null;
        if (abs && top?.cell && !top.cell.href) top.cell.href = abs;
      } else if (link) {
        const text = link.text.replace(/\s+/g, " ").trim();
        if (text || link.href) links.push({ text: text || link.href.split("/").pop() || "link", href: link.href });
        link = null;
      }
      continue;
    }
    if (["br", "p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article"].includes(tag)) flush();
  }
  flush();
  // niente doppioni fra i link
  const seen = new Set<string>();
  const uniq = links.filter((l) => (seen.has(l.href + l.text) ? false : (seen.add(l.href + l.text), true)));
  return { url, title, tables, lines: lines.slice(0, 1500), links: uniq.slice(0, 400) };
}

