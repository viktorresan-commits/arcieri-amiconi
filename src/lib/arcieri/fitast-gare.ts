/**
 * Le gare del portale FITAST in una pagina già letta: id, data, nome e come si apre ciascuna
 * (collegamento, riga cliccabile, voce di una tendina, campo "Id Gara" o riga di un elenco).
 * Pura, senza rete: la usa la ricerca del nome, che va dalla gara più recente all'indietro.
 */
import type { FitastPage, FitastSelect } from "./fitast-parse";

export type Press = { code: string; set: Record<string, string> };
export type GaraHow =
  | { kind: "href"; href: string }
  | { kind: "press"; press: Press }
  | { kind: "option"; select: string; value: string }
  | { kind: "input"; input: string }
  | { kind: "row"; index: number; /** tabella WEBDEV della riga: la riga scelta si manda come valore della tabella */ alias?: string }
  | { kind: "current" };
/** key: la chiave del record della riga (CLEENREG), forse lo stesso numero della gara: da verificare aprendola */
export type Gara = { id: string; date: string | null; title: string; alts: GaraHow[]; key?: string };

/** la classifica arcieri di una gara si apre direttamente: pagView-Class-Arcieri-Gara.awp?P1=2472 */
export const CLASSIFICA_PAGE = "pagView-Class-Arcieri-Gara.awp";
export function classificaUrl(id: string, base: string) {
  return new URL(`${CLASSIFICA_PAGE}?P1=${encodeURIComponent(id)}`, base).toString();
}
/** le pagine di classifica citate nella pagina (link, onclick, script): numero della gara e indirizzo */
export function classificaRefs(page: FitastPage): { id: string; href: string }[] {
  const out = new Map<string, string>();
  for (const h of [...(page.refs ?? []), ...page.links.map((l) => l.href)]) {
    const m = /class[^/?]*\.awp\?P1=(\d{3,6})\b/i.exec(h);
    if (m && !/squadr|compagn|societ/i.test(h) && !out.has(m[1])) out.set(m[1], h);
  }
  return [...out].map(([id, href]) => ({ id, href }));
}
/** la data della gara aperta: la prima data in cima alla pagina */
export function garaDateOf(page: FitastPage): string | null {
  for (const l of [page.title, ...page.lines.slice(0, 40)]) {
    const d = dateIn(l);
    if (d) return d;
  }
  return null;
}

const MONTHS: Record<string, number> = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12 };
const pad = (n: number) => String(n).padStart(2, "0");
function iso(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** la prima data nel testo (15/11/2026, 15-11-26, 2026-11-15, 15 novembre 2026) in formato AAAA-MM-GG */
export function dateIn(text: string): string | null {
  let m = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/.exec(text);
  if (m) return iso(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), +m[2], +m[1]);
  m = /\b(\d{1,2})\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*\.?\s+(20\d{2})\b/i.exec(text);
  if (m) return iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  return null;
}

const SEASON = /camp|stagion|\b\d{2}_[A-Z]{1,3}\b|\b20\d{2}\s*\/\s*20\d{2}\b|invernal|estiv/i;

/** una voce di stagione: "26_I - Camp. invernale 2026/2027", non una gara con data o numero */
const isSeason = (t: string) => SEASON.test(t) && !dateIn(t) && !/^\s*\d{3,6}\b/.test(t);

/** la tendina del campionato / stagione (26_I - Camp. invernale 2026/2027…) */
export function seasonSelect(page: FitastPage): FitastSelect | null {
  const sels = (page.form?.selects ?? []).filter((x) => x.options.length >= 2);
  const share = (x: FitastSelect) => x.options.filter((o) => isSeason(`${o.text} ${o.value}`)).length / x.options.length;
  return sels.filter((x) => share(x) >= 0.5).sort((a, b) => share(b) - share(a))[0] ?? null;
}

/** il periodo coperto da una stagione: invernale da ottobre ad aprile, estivo da marzo a ottobre */
export function seasonRange(text: string): { from: string; to: string } | null {
  let m = /invernal\w*\D{0,12}(20\d{2})\s*\/\s*(20\d{2})/i.exec(text);
  if (m) return { from: `${m[1]}-10-01`, to: `${m[2]}-04-30` };
  m = /estiv\w*\D{0,12}(20\d{2})/i.exec(text);
  if (m) return { from: `${m[1]}-03-01`, to: `${m[1]}-10-31` };
  m = /\b(\d{2})_I\b/.exec(text);
  if (m) return { from: `20${m[1]}-10-01`, to: `20${Number(m[1]) + 1}-04-30` };
  m = /\b(\d{2})_E\b/.exec(text);
  if (m) return { from: `20${m[1]}-03-01`, to: `20${m[1]}-10-31` };
  m = /\b(20\d{2})\s*\/\s*(20\d{2})\b/.exec(text);
  if (m) return { from: `${m[1]}-09-01`, to: `${m[2]}-08-31` };
  m = /\b(20\d{2})\b/.exec(text);
  if (m) return { from: `${m[1]}-01-01`, to: `${m[1]}-12-31` };
  return null;
}

/** l'id della gara aperta, dal titolo della classifica ("2472-GARA DI CAMPIONATO INVERNALE 3D") */
export function garaIdOf(page: FitastPage): string {
  for (const l of [page.title, ...page.lines.slice(0, 80)]) {
    const m = /^(\d{3,6})\s*[-–]\s*\S/.exec(l.trim()) ?? /\bgara\s*(?:n\.?|nr\.?|id|num\.?)\s*:?\s*(\d{3,6})\b/i.exec(l);
    if (m) return m[1];
  }
  return "";
}

/** il nome della gara aperta, se la pagina lo mostra */
export function garaTitleOf(page: FitastPage): string {
  // senza la data che a volte sta sulla stessa riga (2472-GARA … 15/11/2026)
  for (const l of page.lines.slice(0, 80)) if (/^\d{3,6}\s*[-–]\s*\S/.test(l.trim())) return cleanTitle(l.trim().replace(/^\d{3,6}\s*[-–]\s*/, "")) || l.trim().replace(/^\d{3,6}\s*[-–]\s*/, "");
  return "";
}

const ID = /^\d{3,6}$/;
/** il numero della gara come lo scrive il portale: «2472» o col punto delle migliaia «2.472» */
const idText = (x: string) => {
  const t = x.trim();
  return /^\d{1,3}(?:[.'’\u00a0 ]\d{3})+$/.test(t) ? t.replace(/\D/g, "") : t;
};
/** il nome della gara da una riga dell'elenco: senza date, numero, codice stagione e stato */
export function cleanTitle(text: string, id = "") {
  return text
    .replace(/\b\d{1,2}[-/.]\d{1,2}[-/.](?:20)?\d{2}\b|\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, " ")
    .replace(/\b\d{2}_[A-Z]{1,3}\b/g, " ")
    .replace(id ? new RegExp(`(^|\\s)${id}(?=\\s|$)`, "g") : /$^/, " ")
    .replace(/\b(CHIUSA|APERTA|CHIUSE|APERTE|ISCRIZIONI APERTE|ISCRIZIONI CHIUSE)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s·\-–]+|[\s·\-–]+$/g, "")
    .slice(0, 120);
}
const HAS_WORDS = /[A-Za-zÀ-ÿ]{3}/;
const RANK = { href: 0, press: 1, option: 2, input: 3, row: 4, current: 5 } as const;
const parsePress = (s?: string): Press | null => {
  if (!s) return null;
  try {
    return JSON.parse(s) as Press;
  } catch {
    return null;
  }
};

/**
 * Tutte le gare riconoscibili nella pagina: righe di tabelle (anche quelle scritte negli script),
 * elementi cliccabili, voci di tendine, elenchi di testo sotto "Id Gara" e collegamenti.
 */
export function findGare(page: FitastPage): Gara[] {
  const found: Gara[] = [];
  const season = seasonSelect(page);
  const garaInput = page.form?.inputs?.find((x) => /gara/i.test(x.label));
  const add = (g: Gara) => {
    if (garaInput && g.id && !g.alts.some((a) => a.kind === "input")) g.alts.push({ kind: "input", input: garaInput.name });
    found.push(g);
  };

  // 1) tabelle con una colonna Id Gara o con date
  for (const t of page.tables) {
    const head = t.rows[0].map((c) => c.text);
    if (head.some((h) => /arcier|posiz|piazzol|punt/i.test(h))) continue;
    const idCol = head.findIndex((h) => /id\s*gara|^id$|^cod/i.test(h.trim()));
    const dateCol = head.findIndex((h) => /^data|giorno/i.test(h.trim()));
    const titleCol = head.findIndex((h, k) => k !== idCol && /gara|denomin|descri|evento|manifest|nome/i.test(h));
    const looksGare = idCol >= 0 || head.some((h) => /gara/i.test(h)) || t.rows.slice(1, 6).some((r) => r.some((c) => dateIn(c.text)));
    if (!looksGare) continue;
    t.rows.slice(1).forEach((r, k) => {
      const texts = r.map((c) => c.text);
      const id = idCol >= 0 ? idText(texts[idCol] ?? "") : texts.map(idText).find((x) => ID.test(x)) ?? "";
      const date = dateCol >= 0 ? dateIn(texts[dateCol] ?? "") : dateIn(texts.join(" "));
      if (!id && !date) return;
      const title = (titleCol >= 0 ? texts[titleCol] : [...texts].filter((x) => HAS_WORDS.test(x)).sort((a, b) => b.length - a.length)[0]) ?? "";
      const alts: GaraHow[] = [];
      const href = r.find((c) => c.href)?.href;
      if (href) alts.push({ kind: "href", href });
      const press = parsePress(r.find((c) => c.press)?.press);
      if (press) {
        for (const [f, v] of Object.entries(press.set)) if (id) alts.push({ kind: "option", select: f, value: v });
        alts.push({ kind: "press", press });
      }
      alts.push({ kind: "row", index: k + 1, ...(t.alias ? { alias: t.alias } : {}) });
      const key = idText(t.keys?.[k] ?? "");
      add({ id: ID.test(id) ? id : "", date, title, alts, ...(ID.test(key) ? { key } : {}) });
    });
  }

  // 2) elementi cliccabili (righe di zone ripetute) con un id o una data
  for (const b of page.blocks ?? []) {
    const date = dateIn(b.text);
    const id = idText(/(?:^|\s)(\d{1,3}\.\d{3}|\d{3,6})(?=\s|$)/.exec(b.text)?.[1] ?? "");
    if (!date && !(id && /gara|camp|trofeo|torneo|memorial|coppa/i.test(b.text))) continue;
    const press = parsePress(b.press);
    if (!press) continue;
    const alts: GaraHow[] = [];
    if (id) for (const [f, v] of Object.entries(press.set)) alts.push({ kind: "option", select: f, value: v });
    alts.push({ kind: "press", press });
    add({ id, date, title: cleanTitle(b.text, id), alts });
  }

  // 3) tendine di gare (non quella della stagione, non categorie)
  for (const s of page.form?.selects ?? []) {
    if (s === season || s.options.length < 1) continue;
    if (/categ|tipolog|classe|divisi|arco|sesso/i.test(s.label)) continue;
    for (const o of s.options) {
      const date = dateIn(o.text);
      const id = idText(/^\s*(\d{1,3}\.\d{3}|\d{3,6})(?!\.?\d)/.exec(o.text)?.[1] ?? "") || (ID.test(o.value.trim()) ? o.value.trim() : "");
      if (!date && !id) continue;
      add({ id, date, title: cleanTitle(o.text, id), alts: [{ kind: "option", select: s.name, value: o.value }] });
    }
  }

  // 4) elenco di solo testo sotto "Id Gara": ogni numero da solo apre una riga
  const h = page.lines.findIndex((l) => /^id\s*gara\b/i.test(l.trim()));
  if (h >= 0) {
    let cur: { id: string; lines: string[] } | null = null;
    const recs: { id: string; lines: string[] }[] = [];
    for (const l of page.lines.slice(h + 1, h + 4000)) {
      const t = idText(l);
      if (ID.test(t)) {
        cur = { id: t, lines: [] };
        recs.push(cur);
      } else if (cur && cur.lines.length < 14) cur.lines.push(t);
    }
    recs.forEach((r, k) => {
      const all = r.lines.join(" ");
      // il titolo: la riga più lunga con parole, non la data né il codice della stagione (26_I…)
      const title = [...r.lines].filter((x) => HAS_WORDS.test(x) && !dateIn(x) && !/\b\d{2}_[A-Z]{1,3}\b/.test(x) && x.length < 140).sort((a, b) => b.length - a.length)[0] ?? "";
      add({ id: r.id, date: dateIn(all), title, alts: [{ kind: "row", index: k + 1 }] });
    });
  }
  // righe di testo con id e data insieme ("2472 15/11/2026 GARA …")
  for (const l of page.lines) {
    const date = dateIn(l);
    const id = idText(/(?:^|\s)(\d{1,3}\.\d{3}|\d{3,6})(?=\s|$)/.exec(l)?.[1] ?? "");
    if (date && id && l.length < 300 && !found.some((g) => g.id === id)) add({ id, date, title: cleanTitle(l, id), alts: [{ kind: "current" }] });
  }

  // 5) collegamenti a una gara
  for (const l of page.links) {
    const id = /[?&](?:id_?gara|idgara|gara|id)=(\d{2,7})/i.exec(l.href)?.[1] ?? "";
    const date = dateIn(l.text);
    if (!id && !date) continue;
    add({ id, date, title: cleanTitle(l.text, id), alts: [{ kind: "href", href: l.href }] });
  }

  // 6) classifiche citate nella pagina (anche negli script): si aprono direttamente
  for (const r of classificaRefs(page)) add({ id: r.id, date: null, title: "", alts: [{ kind: "href", href: r.href }] });

  // una gara sola per id: si tengono la data e tutti i modi di aprirla, i migliori per primi
  const byKey = new Map<string, Gara>();
  for (const g of found) {
    const key = g.id || `${g.date}|${g.title}`;
    const old = byKey.get(key);
    if (!old) byKey.set(key, { ...g, alts: [...g.alts] });
    else {
      old.date ??= g.date;
      old.key ??= g.key;
      // fra i titoli trovati si tiene il più corto con parole: di solito è il nome pulito della gara
      if (!old.title || (g.title && HAS_WORDS.test(g.title) && g.title.length < old.title.length)) old.title = g.title;
      for (const a of g.alts) if (!old.alts.some((x) => JSON.stringify(x) === JSON.stringify(a))) old.alts.push(a);
    }
  }
  const list = [...byKey.values()];
  for (const g of list) g.alts.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
  return list.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || Number(b.id || 0) - Number(a.id || 0));
}

/** i campi nascosti che possono tenere la riga scelta di un elenco WEBDEV (da provare uno per uno) */
export function rowFields(page: FitastPage): string[] {
  const fromPress = new Set<string>();
  // le tabelle WEBDEV tengono la riga scelta nel campo con il loro alias
  for (const a of page.wdAliases ?? []) if (page.form && a in page.form.fields) fromPress.add(a);
  for (const b of page.blocks ?? []) for (const k of Object.keys(parsePress(b.press)?.set ?? {})) fromPress.add(k);
  const hidden = Object.entries(page.form?.fields ?? {})
    .filter(([k, v]) => !/^WD_/i.test(k) && /^-?\d{1,4}$/.test(v.trim()))
    .map(([k]) => k);
  return [...new Set([...fromPress, ...hidden])].slice(0, 6);
}

const normT = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const STOP = new Set(["compagnia", "compagnie", "degli", "dei", "delle", "della", "del", "di", "arcieri", "arciere", "asd", "ssd", "aps", "gruppo", "storici", "storico", "the", "team"]);

/** le parole che distinguono una compagnia ("Compagnia degli Arcieri di Fabriano" → fabriano) */
export function teamTokens(name: string) {
  return normT(name)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** la cella è la propria compagnia: stesso nome del portale, o tutte le parole che la distinguono */
export function teamMatches(cell: string, names: string[], tokens: string[]) {
  const c = normT(cell);
  if (!c) return false;
  if (names.some((n) => n && (c === normT(n) || c.startsWith(`${normT(n)} `)))) return true;
  const words = c.split(/[^a-z0-9]+/);
  return tokens.length > 0 && tokens.every((t) => words.includes(t));
}

/** numero all'italiana: 1.240 → 1240, 1240,5 → 1240.5 */
export function numIt(text: string): number | null {
  const t = text.replace(/\s|°|ª|º/g, "");
  if (!/^-?[\d.,]+$/.test(t)) return null;
  const v = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

/** le colonne di una classifica: posizione, compagnia o squadra, punti */
export function columnsOf(head: string[]) {
  const find = (re: RegExp) => head.findIndex((h) => re.test(h.trim()));
  return { place: find(/^(pos|class|n\.?$|n°|#)/i), team: find(/compagn|squadr|societ|team/i), score: find(/punt|tot|score|^pt/i) };
}

export type TeamRow = { team: string; place: number | null; score: number | null; teams: number };
/** le righe della propria compagnia in una classifica squadre, con posizione, punti e numero di squadre */
export function teamRowsOf(page: FitastPage, names: string[], tokens: string[]): TeamRow[] {
  const out: TeamRow[] = [];
  for (const t of page.tables) {
    const head = t.rows[0].map((c) => c.text);
    if (head.some((h) => /^arcier/i.test(h.trim()))) continue;
    const cols = columnsOf(head);
    const data = t.rows.slice(1);
    let tc = cols.team;
    if (tc < 0) tc = head.findIndex((_, k) => data.some((r) => teamMatches(r[k]?.text ?? "", names, tokens)));
    if (tc < 0) continue;
    const teams = data.filter((r) => (r[tc]?.text ?? "").trim()).length;
    for (const r of data) {
      const team = (r[tc]?.text ?? "").trim();
      if (!teamMatches(team, names, tokens)) continue;
      const nums = r.map((c, k) => ({ k, v: numIt(c.text) })).filter((x): x is { k: number; v: number } => x.v != null && x.k !== tc);
      const place = cols.place >= 0 ? numIt(r[cols.place]?.text ?? "") : (nums[0]?.v ?? null);
      const score = cols.score >= 0 ? numIt(r[cols.score]?.text ?? "") : (nums.filter((x) => x.k !== (cols.place >= 0 ? cols.place : nums[0]?.k)).pop()?.v ?? null);
      out.push({ team, place: place != null && place > 0 && place < 1000 ? Math.round(place) : null, score, teams });
    }
  }
  return out;
}

/** il nome della compagnia come lo scrive il portale, dalla riga dell'arciere trovato (colonna Compagnia) */
export function teamOfRow(head: string[], row: string[]) {
  const k = head.findIndex((h) => /compagn|societ/i.test(h));
  return k >= 0 ? (row[k] ?? "").trim() : "";
}

const GENERIC = new Set(["gara", "gare", "campionato", "invernale", "estivo", "estiva", "regionale", "provinciale", "nazionale", "finale", "trofeo", "coppa", "memorial", "torneo", "prova", "tappa", "giornata", "arcieri", "compagnia", "della", "delle", "degli"]);
const words = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 2);
/**
 * Quanto il nome di una gara aperta somiglia a quello dell'elenco: 2 uguale, 1 una parola che la
 * distingue in comune (Falconara, Natale…), 0.5 nessuna parola distintiva da confrontare, 0 diversa.
 */
export function titleScore(listTitle: string, pageTitle: string) {
  const a = words(cleanTitle(listTitle));
  const b = words(cleanTitle(pageTitle));
  if (a.length && a.join(" ") === b.join(" ")) return 2;
  const distinct = a.filter((w) => !GENERIC.has(w) && !/^\d+$/.test(w));
  if (!distinct.length) return 0.5;
  return distinct.some((w) => b.includes(w)) ? 1 : 0;
}
