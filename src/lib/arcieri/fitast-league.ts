/**
 * Compagnie e classifiche del portale FITAST, senza rete: l'elenco delle compagnie (View-COMPAGNIE.awp),
 * le righe di una classifica (posto, arciere o compagnia, punti) e lo stemma disegnato per chi non ne ha uno.
 */
import type { FitastPage, FitastTable } from "./fitast-parse";
import { numIt } from "./fitast-gare";

export const COMPAGNIE_URL = "http://89.46.73.21/FITAST_WEB/IT/View-COMPAGNIE.awp";

export type PortalCompany = {
  name: string;
  city: string;
  province: string;
  region: string;
  code: string;
  president: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  /** stemma mostrato dal portale nella riga della compagnia, se c'è */
  logo?: string;
  /** pagina della compagnia sul portale, se la riga ci porta */
  detail?: string;
};

const IMG_PATH = /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i;
/** immagini di servizio del portale (frecce, pulsanti, spazi): non sono stemmi */
const NOT_LOGO = /spacer|pixel|blank|vide|puce|fleche|freccia|arrow|btn|bouton|button|loupe|search|cerca|icone?_|ico_|picto|sort|tri_|check|coche|plus|moins|close|chiudi|loading|attente/i;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** chiave per riconoscere la stessa compagnia scritta in modi diversi (ASD, Compagnia, apostrofi…) */
/** categoria leggibile: via i pezzi vuoti e «Tutte» (es. «Messere · » → «Messere») */
export function cleanCategory(raw: string) {
  return raw
    .split("·")
    .map((x) => x.trim())
    .filter((x) => x && !/^tutt/i.test(x))
    .join(" · ");
}

export function teamKey(name: string) {
  return clean(
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/\bA\.?\s?S\.?\s?D\.?(?=\s|$)|\bS\.?\s?S\.?\s?D\.?(?=\s|$)|\bASD\b|\bSSD\b|\bAPS\b|\bA\.P\.S\.?/g, " ")
      .replace(/[^A-Z0-9]+/g, " ")
      .replace(/\b(COMPAGNIA|COMPAGNIE|ASSOCIAZIONE|SPORTIVA|DILETTANTISTICA|GRUPPO|DEGLI|DELLA|DELLE|DEL|DEI|DI|DE|LA|LE|IL|LO|GLI|E|D)\b/g, " "),
  );
}

/** parole che tante compagnie hanno nel nome: da sole non dicono quale compagnia è */
const TEAM_COMMON = new Set(["ARCIERI", "ARCIERE", "ARCIER", "ARCO", "ARCHI", "TIRO", "STORICI", "STORICO", "STORICA", "STORICHE", "TRADIZIONALE", "TRADIZIONALI", "SPORT", "SPORTIVO", "CLUB", "CITTA", "SAN", "SANTA", "SANTO", "SANT", "NUOVA", "NUOVO", "ITALIA", "MEDIEVALE", "MEDIEVALI", "BALESTRIERI", "SAGITTARII", "ARCATORES", "ARCATORI", "SAGITTAE"]);

/** le parole che riconoscono una compagnia (le sigle A.M.A.L.A.C. anche tutte attaccate) */
export function teamWords(name: string) {
  const key = teamKey(name);
  const words = key.split(" ").filter((w) => w.length >= 3 && !TEAM_COMMON.has(w));
  const letters = /(?:\b[A-Z]\b ?){3,}/.exec(key)?.[0].replace(/ /g, "");
  if (letters) words.push(letters);
  return [...new Set(words)];
}

/**
 * La compagnia come la scrive la classifica del portale: l'elenco delle compagnie e le classifiche non usano
 * sempre lo stesso nome («ARCARIUS HELVINIUM» e «A.S.D. ARCARIUS HELVINIUM GUALDO»). Si sceglie il nome della
 * classifica con più parole rare in comune; se due nomi vanno bene allo stesso modo, nessuno.
 */
export function matchTeam(name: string, teams: string[]): string | null {
  const key = teamKey(name);
  if (!key) return null;
  const exact = teams.find((t) => teamKey(t) === key);
  if (exact) return exact;
  const mine = teamWords(name);
  if (!mine.length) return null;
  // peso di ogni parola: più è rara fra tutte le squadre, più conta
  const freq = new Map<string, number>();
  const tw = teams.map((t) => {
    const w = teamWords(t);
    for (const x of w) freq.set(x, (freq.get(x) ?? 0) + 1);
    return w;
  });
  const weight = (w: string) => 1 / (freq.get(w) ?? 1);
  const same = (a: string, b: string) => a === b || (a.length >= 6 && b.length >= 6 && (a.startsWith(b.slice(0, 6)) || b.startsWith(a.slice(0, 6))));
  const total = mine.reduce((t, w) => t + weight(w), 0);
  let best = -1;
  let top = 0;
  let second = 0;
  tw.forEach((w, i) => {
    if (!w.length) return;
    const hit = mine.filter((m) => w.some((x) => same(m, x)));
    if (!hit.length) return;
    const extra = w.filter((x) => !mine.some((m) => same(m, x))).length;
    const score = hit.reduce((t, m) => t + weight(m), 0) / total - extra * 0.05;
    if (score > top) {
      second = top;
      top = score;
      best = i;
    } else if (score > second) second = score;
  });
  return best >= 0 && top >= 0.45 && top - second >= 0.15 ? teams[best] : null;
}

const SMALL = new Set(["di", "del", "della", "delle", "dei", "degli", "da", "dal", "e", "ed", "in", "la", "le", "il", "lo", "gli", "a", "al", "alla", "sul", "sulla", "con"]);
/** ARCIERI DI GROTTAZZOLINA → Arcieri di Grottazzolina (le sigle come A.S.D. restano maiuscole) */
export function titleName(name: string) {
  const words = clean(name).split(" ");
  return words
    .map((w, i) => {
      if (/^([A-Z]\.)+[A-Z]?\.?$/.test(w) || /^(ASD|SSD|APS|FITAST|FITARCO)$/i.test(w) || /\d/.test(w)) return w.toUpperCase();
      const lower = w.toLowerCase();
      if (i > 0 && SMALL.has(lower)) return lower;
      // dell'arco, d'Arcieri: l'apostrofo resta minuscolo davanti, maiuscola dopo
      return lower.replace(/(^|['’\-])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase()).replace(/^(d|l|dell|dall|nell|sull)(['’])(\p{L})/iu, (_m, a: string, ap: string, c: string) => `${i > 0 ? a.toLowerCase() : a[0].toUpperCase() + a.slice(1).toLowerCase()}${ap}${c.toUpperCase()}`);
    })
    .join(" ");
}

const HEAD = {
  name: /compagn|societ|denomin|ragione|squadr|^nome|nominativ/i,
  city: /citt|comune|localit|sede/i,
  province: /^prov/i,
  region: /regione/i,
  code: /^cod|^id\b|matricol|affil/i,
  president: /presid|responsab|referent/i,
  phone: /tel|cell/i,
  email: /mail/i,
  website: /sito|web|internet/i,
  address: /indirizz|^via\b/i,
};
const LOOKS_COMPANY = /arcier|compagn|a\.?s\.?d|societ|gruppo|club|sagittar|balestr|arco|frecc|tiro/i;

const REGIONS = [
  "ABRUZZO", "BASILICATA", "CALABRIA", "CAMPANIA", "EMILIA[- ]ROMAGNA", "FRIULI[- ]VENEZIA GIULIA", "LAZIO", "LIGURIA", "LOMBARDIA", "MARCHE", "MOLISE",
  "PIEMONTE", "PUGLIA", "SARDEGNA", "SICILIA", "TOSCANA", "TRENTINO[- ]ALTO ADIGE", "UMBRIA", "VALLE D'AOSTA", "VENETO", "SAN MARINO",
];
const REGION_RE = new RegExp(`\\b(${REGIONS.join("|")})\\b`, "i");
/** etichette della scheda della compagnia sul portale (Regione:, Tel e Fax:, E-mail:, Web) */
const LABEL_RE = /\b(?:Regione|Tel(?:\.|efono)?\s*(?:e|\/)\s*Fax|Telefono|Cellulare|Fax|E-?mail|Posta|Web|Sito(?:\s*web)?|Indirizzo|Presidente|Referente)\s*:?(?=\s|$)/gi;
const LABEL_ONE = new RegExp(LABEL_RE.source, "i");
/** campi di servizio del portale che finiscono nel testo (il nome del campo dell'immagine) */
const JUNK_RE = /\bID\s*_?IMM\w*\b|\bIMG_?\w*\b/gi;
const ADDRESS_RE = /\b(via|viale|v\.le|piazza|piazzale|p\.zza|p\.za|corso|c\.so|frazione|fraz\.|loc\.|località|localita|contrada|c\.da|strada|str\.|vocabolo|voc\.|borgo|largo|vicolo|lungomare|lungotevere|zona|quartiere|casella postale|c\.p\.)\s+\S/i;
const CODE_RE = /\b\d{2}\s?\/\s?\d{3}\b/;

export type CompanyText = { name: string; address: string; city: string; region: string; phone: string; email: string; website: string; code: string };

/**
 * La scheda di una compagnia del portale letta come testo unico («A.S.D SAGITTAS FELIX TERRAE MONTEGIORGIO via
 * Del Sole 1 Regione: MARCHE Tel e Fax: 3396371229 E-mail: … Web Fb @…»): si tolgono etichette e campi di
 * servizio, si prendono e-mail, sito, telefono, regione e codice dove stanno, e quel che resta è nome e indirizzo.
 * `lines` (le righe della pagina) dice dove finisce il nome quando nome e indirizzo stanno su righe diverse.
 */
export function parseCompanyText(raw: string, lines?: Set<string>): CompanyText {
  let t = clean(raw).replace(JUNK_RE, " \u0001 ");
  const out: CompanyText = { name: "", address: "", city: "", region: "", phone: "", email: "", website: "", code: "" };
  const cut = (re: RegExp) => {
    const m = re.exec(t);
    if (!m) return "";
    t = `${t.slice(0, m.index)} \u0001 ${t.slice(m.index + m[0].length)}`;
    return m[0];
  };
  out.email = cut(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/).toLowerCase();
  out.website = cut(/\b(?:https?:[/\\]{2}|www\.)\S+|\bfb\s*@\s*[\w.]+|\bfacebook\.com\/\S+/i).replace(/^http:\\\\/i, "http://");
  const reg = /Regione\s*:?\s*([A-Z' -]{4,30}?)(?=\s+(?:Tel|E-?mail|Web|Fax|$)|$)/i.exec(t);
  if (reg && REGION_RE.test(reg[1])) {
    out.region = REGION_RE.exec(reg[1])?.[1] ?? "";
    t = `${t.slice(0, reg.index)} \u0001 ${t.slice(reg.index + reg[0].length)}`;
  }
  out.code = cut(CODE_RE).replace(/\s/g, "");
  // telefono: solo quello dopo «Tel» (un CAP seguito dal numero civico non è un telefono)
  const tel = /\bTel(?:\.|efono)?\s*(?:(?:e|\/)\s*Fax)?\s*:?\s*((?:\+39\s?)?\d(?:[\s./-]?\d){5,12})\b/i.exec(t);
  if (tel) {
    out.phone = tel[1].replace(/[^\d+]/g, "");
    t = `${t.slice(0, tel.index)} \u0001 ${t.slice(tel.index + tel[0].length)}`;
  }
  t = t.replace(LABEL_RE, " \u0001 ");
  if (!out.region) {
    const m = REGION_RE.exec(t);
    // regione rimasta senza etichetta: solo se sta da sola fra due campi, non dentro il nome
    if (m && new RegExp(`\u0001\\s*${m[1]}\\s*(\u0001|$)`, "i").test(t)) {
      out.region = m[1];
      t = t.replace(new RegExp(`\u0001\\s*${m[1]}`, "i"), "\u0001");
    }
  }
  const parts = t
    .split("\u0001")
    .map((x) => x.replace(/^[\s,;:·|–-]+|[\s,;:·|–-]+$/g, "").replace(/\s+/g, " "))
    .filter((x) => (x.match(/\p{L}/gu) ?? []).length >= 2);
  let head = parts[0] ?? "";
  // nome e indirizzo su righe diverse della pagina: il nome è la riga con cui comincia la scheda
  if (lines && head) {
    let best = "";
    for (const l of lines) if (l.length >= 6 && l.length < head.length && head.startsWith(l) && l.length > best.length && !ADDRESS_RE.test(l) && goodCompanyName(l)) best = l;
    const rest = best ? head.slice(best.length).trim() : "";
    if (best && /\s/.test(head.slice(best.length, best.length + 1)) && (ADDRESS_RE.test(rest) || /\d/.test(rest))) {
      out.name = best;
      head = head.slice(best.length).trim();
      out.address = head;
    }
  }
  if (!out.name) {
    const a = ADDRESS_RE.exec(head);
    if (a && a.index > 0) {
      let name = head.slice(0, a.index).trim();
      let addr = head.slice(a.index).trim();
      // «… TERRAE MONTEGIORGIO via Del Sole 1»: la parola in maiuscolo prima di «via» minuscolo è il paese
      const words = name.split(" ");
      if (/^[a-z]/.test(a[1]) && words.length >= 3 && /^\p{Lu}{3,}$/u.test(words[words.length - 1])) {
        out.city = words.pop() ?? "";
        name = words.join(" ");
        addr = `${out.city} ${addr}`;
      }
      out.name = name;
      out.address = addr;
    } else {
      // nome tutto maiuscolo e indirizzo scritto normale («ARCIERI STORICI Monte Santo n.6»): si divide dove cambia
      const words = head.split(" ");
      const at = words.findIndex((w) => /\p{Ll}/u.test(w) && !/^(d|l|dell|dall|nell|sull)['’]/i.test(w));
      const upper = at >= 2 ? words.slice(0, at).join(" ") : "";
      if (upper && upper === upper.toUpperCase() && goodCompanyName(upper) && /\d|\bsnc\b/i.test(words.slice(at).join(" "))) {
        out.name = upper;
        out.address = words.slice(at).join(" ");
      } else out.name = head;
    }
  }
  if (!out.address) out.address = parts.slice(1).find((x) => ADDRESS_RE.test(x) || /\d/.test(x)) ?? "";
  out.name = out.name.replace(/[\s.,;:-]+$/, "").replace(/\s+/g, " ").trim().slice(0, 90);
  out.address = out.address.replace(/\s+/g, " ").trim().slice(0, 160);
  return out;
}

/** nome salvato con pezzi della scheda dentro («Idimm Regione: Tel e Fax:», «06/024 A.s.d. …») */
export const GARBLED_NAME = /\bID\s*_?IMM|\bRegione\b|\bTel\s*e\s*Fax\b|\bE-?mail\b|^\s*\d{2}\s?\/\s?\d{3}\s/i;

/** il nome da mostrare e quello FITAST, puliti anche se nel database c'è ancora il nome rotto */
export function cleanCompanyNames(name: string, fitastName: string | null | undefined) {
  if (!GARBLED_NAME.test(name) && !GARBLED_NAME.test(fitastName ?? "")) return { name, fitastName: fitastName ?? "" };
  const p = parseCompanyText(fitastName || name);
  if (!goodCompanyName(p.name)) return { name, fitastName: fitastName ?? "" };
  return { name: titleName(p.name).slice(0, 70), fitastName: p.name };
}

/** un nome di compagnia vero: lettere, non un'etichetta, un indirizzo o un contatto */
export function goodCompanyName(name: string) {
  const n = clean(name);
  if (n.length < 3 || n.length > 90 || (n.match(/\p{L}/gu) ?? []).length < 3) return false;
  if (/@|https?:|www\.|^\d+$|^(regione|tel|e-?mail|web|fax|sito|elenco|compagnie|cerca)\b/i.test(n)) return false;
  if (ADDRESS_RE.test(n) && ADDRESS_RE.exec(n)?.index === 0) return false;
  if (REGION_RE.test(n) && REGION_RE.exec(n)?.[0].length === n.length) return false;
  return true;
}

/** testo con campi della scheda dentro (etichette, campo dell'immagine, codice davanti): va letto per pezzi */
const isCard = (t: string) => /\bRegione\b|\bTel\s*e\s*Fax\b|\bE-?mail\b|\bID\s*_?IMM/i.test(t) || /^\s*\d{2}\s?\/\s?\d{3}\s/.test(t);

/** le compagnie dell'elenco del portale: dalla tabella con la colonna del nome, se no dalle schede scritte riga per riga */
export function parseCompanies(page: FitastPage): PortalCompany[] {
  const out = new Map<string, PortalCompany>();
  const pageLines = new Set(page.lines.map(clean));
  const add = (c: PortalCompany) => {
    if (!goodCompanyName(c.name)) return;
    const k = teamKey(c.name);
    if (!k || k.length < 3) return;
    const had = out.get(k);
    if (!had) {
      out.set(k, c);
      return;
    }
    // la stessa compagnia trovata due volte: si tengono i campi che mancavano
    for (const f of ["city", "province", "region", "code", "president", "phone", "email", "website", "address", "logo", "detail"] as const) if (!had[f] && c[f]) had[f] = c[f];
  };
  const fromCard = (text: string, base: Partial<PortalCompany> = {}): PortalCompany => {
    const p = parseCompanyText(text, pageLines);
    return {
      name: p.name,
      city: base.city || p.city,
      province: base.province ?? "",
      region: base.region || (p.region ? p.region.toUpperCase() : ""),
      code: base.code || p.code,
      president: base.president ?? "",
      phone: base.phone || p.phone,
      email: base.email || p.email,
      website: base.website || p.website,
      address: base.address || p.address,
      logo: base.logo,
      detail: base.detail,
    };
  };
  for (const t of [...page.tables].sort((a, b) => b.rows.length - a.rows.length)) {
    if (t.rows.length < 3) continue;
    const head = t.rows[0].map((c) => clean(c.text));
    const col = (re: RegExp) => head.findIndex((h) => re.test(h));
    let nameCol = col(HEAD.name);
    // senza titoli: la colonna dove le righe sembrano nomi di compagnie (o schede con «Regione:»)
    if (nameCol < 0) {
      const width = Math.max(...t.rows.map((r) => r.length));
      let best = -1;
      let score = 0;
      for (let k = 0; k < width; k++) {
        const n = t.rows.slice(1).filter((r) => LOOKS_COMPANY.test(r[k]?.text ?? "") || isCard(r[k]?.text ?? "")).length;
        if (n > score) [best, score] = [k, n];
      }
      if (score < 2) continue;
      nameCol = best;
    }
    const at = (r: FitastTable["rows"][number], re: RegExp) => {
      const k = col(re);
      return k >= 0 ? clean(r[k]?.text ?? "") : "";
    };
    const before = out.size;
    for (const r of t.rows.slice(1)) {
      const cellText = clean(r[nameCol]?.text ?? "");
      if (cellText.length < 3 || /^\d+$/.test(cellText)) continue;
      const email = at(r, HEAD.email) || (r.map((c) => c.text).join(" ").match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? "");
      // stemma: un'immagine nella riga, oppure (righe WEBDEV) il percorso di un'immagine scritto in una colonna
      const imgCell = r.find((c) => c.img && !NOT_LOGO.test(c.img))?.img ?? "";
      const imgText = r.map((c) => clean(c.text)).find((x) => IMG_PATH.test(x) && !/\s/.test(x) && !NOT_LOGO.test(x)) ?? "";
      let logo = imgCell;
      if (!logo && imgText) {
        try {
          logo = new URL(imgText, page.url).href;
        } catch {
          logo = "";
        }
      }
      const detail = r.map((c) => c.href ?? "").find((h) => /\.awp\b/i.test(h) && !/COMPAGNIE\.awp/i.test(h)) ?? "";
      const base = { city: at(r, HEAD.city), province: at(r, HEAD.province), region: at(r, HEAD.region), code: at(r, HEAD.code), president: at(r, HEAD.president), phone: at(r, HEAD.phone), email, website: at(r, HEAD.website), address: at(r, HEAD.address), logo, detail };
      // la cella è la scheda intera (nome, indirizzo, Regione:, Tel e Fax:…): si legge per pezzi
      if (isCard(cellText)) add(fromCard(r.map((c) => clean(c.text)).filter((x, i, all) => x && all.indexOf(x) === i).join(" "), base));
      else add({ name: cellText, ...base });
    }
    if (out.size - before >= 3) break;
  }
  // schede scritte riga per riga (nome, indirizzo, «Regione:», «Tel e Fax:»…): una per ogni «Regione»
  const cards = cardsFromLines(page);
  for (const c of cards) add(c);
  // elenco senza tabella né schede: le righe che sembrano nomi di compagnie
  if (out.size < 3) {
    for (const l of page.lines) {
      const t = clean(l);
      if (t.length < 6 || t.length > 90 || !LOOKS_COMPANY.test(t) || /fitast|federazion|elenco|compagnie$|^compagnia$/i.test(t)) continue;
      if (t === t.toUpperCase() || /^(compagnia|arcieri|a\.?s\.?d)/i.test(t)) add({ name: t, city: "", province: "", region: "", code: "", president: "", phone: "", email: "", website: "", address: "" });
    }
  }
  return [...out.values()].slice(0, 400);
}

/**
 * Le schede dell'elenco lette dalle righe della pagina. Ogni scheda ha una riga «Regione»: il nome sta una
 * o due righe sopra (sopra c'è l'indirizzo), i contatti sotto. Lo stemma è l'immagine che il portale mette
 * accanto al nome: quella fra la scheda di prima e il nome (o fra il nome e la scheda dopo), se ogni scheda
 * ne ha al massimo una.
 */
export function cardsFromLines(page: FitastPage): PortalCompany[] {
  const lines = page.lines.map(clean);
  const regionAt = lines.map((l, i) => (/^Regione\b/i.test(l) ? i : -1)).filter((i) => i >= 0);
  if (regionAt.length < 3) return [];
  type Card = { c: PortalCompany; nameAt: number; end: number };
  const cards: Card[] = [];
  let prevEnd = -1;
  for (const [n, r] of regionAt.entries()) {
    const next = regionAt[n + 1] ?? lines.length;
    // il nome: risalendo, la prima riga che non è indirizzo, campo di servizio o contatto
    let nameAt = -1;
    for (let k = r - 1; k > prevEnd && k >= r - 4; k -= 1) {
      const l = lines[k].replace(JUNK_RE, "").trim();
      if (!l || ADDRESS_RE.test(l) || /^\d/.test(l) || /@|https?:|www\./i.test(l) || LABEL_ONE.test(l) || !goodCompanyName(l)) continue;
      nameAt = k;
      break;
    }
    // fine della scheda: prima del nome della scheda dopo (che sta 1-3 righe sopra la sua «Regione»)
    let end = Math.min(lines.length - 1, r + 8);
    if (next < lines.length) end = Math.min(end, next - 3);
    if (nameAt < 0) {
      prevEnd = end;
      continue;
    }
    const text = lines.slice(nameAt, end + 1).join(" ");
    const p = parseCompanyText(text, new Set([lines[nameAt].replace(JUNK_RE, "").trim()]));
    const address = p.address || (nameAt + 1 < r ? lines.slice(nameAt + 1, r).join(" ").replace(JUNK_RE, "").trim() : "");
    cards.push({ c: { name: p.name || lines[nameAt], city: p.city, province: "", region: p.region.toUpperCase(), code: p.code, president: "", phone: p.phone, email: p.email, website: p.website, address: address.slice(0, 160) }, nameAt, end });
    prevEnd = end;
  }
  // stemmi: le immagini della pagina con la loro posizione fra le righe
  const pics = (page.pics ?? []).filter((x) => !NOT_LOGO.test(x.src));
  if (pics.length && cards.length) {
    const before = cards.map((cd, i) => pics.filter((x) => x.at > (i ? cards[i - 1].end : -1) && x.at <= cd.nameAt));
    const after = cards.map((cd, i) => pics.filter((x) => x.at > cd.nameAt && x.at <= (cards[i + 1]?.nameAt ?? Infinity) - 1));
    const good = (list: { src: string }[][]) => list.filter((l) => l.length === 1).length;
    const many = (list: { src: string }[][]) => list.filter((l) => l.length > 1).length;
    const pick = good(before) >= good(after) ? before : after;
    // si usano solo se quasi nessuna scheda ha due immagini (allora l'abbinamento è sicuro)
    if (good(pick) >= 2 && many(pick) <= Math.max(1, cards.length * 0.1)) cards.forEach((cd, i) => {
      if (pick[i].length === 1) cd.c.logo = pick[i][0].src;
    });
  }
  return cards.map((x) => x.c);
}

export type RankRow = { place: number | null; name: string; team: string; score: number | null; camp: number | null };

/** le righe di una classifica (arcieri o compagnie): posto, nome, compagnia, punti e punti campionato */
export function rankingRows(page: FitastPage, kind: "arcieri" | "squadre", limit = 20): RankRow[] {
  for (const t of [...page.tables].sort((a, b) => b.rows.length - a.rows.length)) {
    if (t.rows.length < 2) continue;
    const head = t.rows[0].map((c) => clean(c.text));
    const col = (re: RegExp) => head.findIndex((h) => re.test(h));
    const posCol = col(/^pos|posiz|^class|^n\.?$|^#|^rank/i);
    const teamCol = col(/compagn|societ|squadr/i);
    const nameCol = kind === "arcieri" ? col(/arcier|atleta|cognome|nominativ|^nome/i) : teamCol;
    const campCol = col(/camp/i);
    const scoreCol = head.findIndex((h, k) => k !== campCol && /punt|^tot|score|^pt/i.test(h));
    if (nameCol < 0) continue;
    const rows: RankRow[] = [];
    for (const [i, r] of t.rows.slice(1).entries()) {
      const name = clean(r[nameCol]?.text ?? "");
      if (!name || /^\d+$/.test(name)) continue;
      const place = posCol >= 0 ? numIt(r[posCol]?.text ?? "") : i + 1;
      rows.push({
        place: place != null && Number.isFinite(place) ? Math.round(place) : i + 1,
        name,
        team: kind === "arcieri" && teamCol >= 0 ? clean(r[teamCol]?.text ?? "") : kind === "squadre" ? name : "",
        score: scoreCol >= 0 ? numIt(r[scoreCol]?.text ?? "") : null,
        camp: campCol >= 0 ? numIt(r[campCol]?.text ?? "") : null,
      });
      if (rows.length >= limit) break;
    }
    if (rows.length) return rows;
  }
  return [];
}

/**
 * L'elenco delle piazzole di una gara (chi tira insieme): per ogni arciere la piazzola (o il gruppo) di
 * partenza, il nome e la compagnia. La piazzola va nel posto («place») della riga.
 */
/** «PIAZZOLA 11», «Piazzola n° 11», «Gruppo 11», «Pagl. 11»: l'inizio di un gruppo nell'elenco */
const GROUP_RE = /^(?:piazzola|piazz\.?|pagl\w*\.?|paglione|gruppo|bersaglio|turno)\s*(?:n[°.º]?\s*)?(\d{1,3})\b/i;
const NAME_LIKE = (t: string) => /^[\p{L}'’.\- ]{5,60}$/u.test(t) && t.trim().split(/\s+/).length >= 2 && !LOOKS_COMPANY.test(t) && !GROUP_RE.test(t);

/**
 * L'elenco delle piazzole di una gara: chi tira in quale piazzola. Va bene la tabella con le colonne
 * (Piazzola · Arciere · Compagnia, anche Cognome e Nome separati) e l'elenco a gruppi («PIAZZOLA 11»
 * e sotto gli arcieri), in tabella o in righe di testo.
 */
export function piazzoleRows(page: FitastPage, limit = 600): RankRow[] {
  const tables = [...page.tables].sort((a, b) => b.rows.length - a.rows.length);
  for (const t of tables) {
    if (t.rows.length < 3) continue;
    const head = t.rows[0].map((c) => clean(c.text));
    const col = (re: RegExp) => head.findIndex((h) => re.test(h));
    const pzCol = col(/piazz|grupp|paglion|bersagl|turn|linea/i);
    const surCol = col(/^cognome$/i);
    const firstCol = col(/^nome$/i);
    const nameCol = col(/arcier|atleta|cognome|nominativ|^nome/i);
    const teamCol = col(/compagn|societ|squadr/i);
    if (pzCol < 0 || nameCol < 0) continue;
    const rows: RankRow[] = [];
    let last: number | null = null;
    for (const r of t.rows.slice(1)) {
      // cognome e nome in due colonne: si rimettono insieme
      const name = surCol >= 0 && firstCol >= 0 && surCol !== firstCol ? clean(`${r[surCol]?.text ?? ""} ${r[firstCol]?.text ?? ""}`) : clean(r[nameCol]?.text ?? "");
      // la piazzola a volte è scritta solo sulla prima riga del gruppo
      const pz = numIt(r[pzCol]?.text ?? "");
      if (pz != null && Number.isFinite(pz)) last = Math.round(pz);
      if (!name || /^\d+$/.test(name) || last == null) continue;
      rows.push({ place: last, name, team: teamCol >= 0 ? clean(r[teamCol]?.text ?? "") : "", score: null, camp: null });
      if (rows.length >= limit) break;
    }
    if (rows.length >= 2) return rows;
  }
  // elenco a gruppi in tabella: una riga «PIAZZOLA 11», sotto una riga per arciere
  for (const t of tables) {
    if (t.rows.length < 4) continue;
    const rows: RankRow[] = [];
    let cur: number | null = null;
    for (const r of t.rows) {
      const cells = r.map((c) => clean(c.text)).filter(Boolean);
      const joined = cells.join(" ");
      const g = GROUP_RE.exec(joined) ?? GROUP_RE.exec(cells[0] ?? "");
      if (g) {
        cur = Number(g[1]);
        // «Piazzola 11 | ROSSI MARIO | ARCIERI …» sulla stessa riga
        const rest = cells.filter((c) => !GROUP_RE.test(c));
        const nm = rest.find(NAME_LIKE);
        if (nm) rows.push({ place: cur, name: nm, team: rest.find((c) => c !== nm && LOOKS_COMPANY.test(c)) ?? "", score: null, camp: null });
        continue;
      }
      if (cur == null) continue;
      const nm = cells.find(NAME_LIKE);
      if (!nm) continue;
      rows.push({ place: cur, name: nm, team: cells.find((c) => c !== nm && LOOKS_COMPANY.test(c)) ?? "", score: null, camp: null });
      if (rows.length >= limit) break;
    }
    if (rows.length >= 2 && new Set(rows.map((x) => x.place)).size >= 2) return rows;
  }
  // elenco a gruppi in righe di testo
  const rows: RankRow[] = [];
  let cur: number | null = null;
  for (const raw of page.lines) {
    const l = clean(raw);
    const g = GROUP_RE.exec(l);
    if (g) {
      cur = Number(g[1]);
      continue;
    }
    if (cur == null) continue;
    // «ROSSI MARIO - ARCIERI DI FABRIANO» o solo il nome
    const parts = l.split(/\s+[-–|·]\s+|\t/).map((x) => x.trim());
    const nm = parts.find(NAME_LIKE);
    if (!nm) continue;
    rows.push({ place: cur, name: nm, team: parts.find((x) => x !== nm && LOOKS_COMPANY.test(x)) ?? "", score: null, camp: null });
    if (rows.length >= limit) break;
  }
  return rows.length >= 2 && new Set(rows.map((x) => x.place)).size >= 2 ? rows : [];
}

/** le classi del campionato, dalla più specifica: Juvenis prima di Messeri/Madonne */
const CLASSES: [RegExp, string][] = [
  [/juven\p{L}*/iu, "Juvenis"],
  [/junior\p{L}*/iu, "Juniores"],
  [/puer\p{L}*/iu, "Pueri"],
  [/messer\p{L}*/iu, "Messeri"],
  [/madonn\p{L}*/iu, "Madonne"],
];
const BOW = /arco|bow|stor|nud|ricurv|long|compound|olimp|tradiz|istint|medieval|rinasc/i;
/** testo pulito per confronti: niente spazi doppi, segni invisibili né differenze di maiuscole */
const plain = (s: string) => clean(s.normalize("NFKC").replace(/[\p{Cf}]/gu, ""));

/**
 * La categoria in parole dell'app: la classe (Messeri, Madonne, Juniores, Juvenis, Pueri) e la tipologia d'arco.
 * La classe si riconosce in qualunque posizione della categoria (il portale non mette i filtri sempre nello
 * stesso ordine); «Tutte» non conta.
 */
export function categoryGroup(category: string): { group: string; tipologia: string } {
  const parts = category.split("·").map(plain).filter((p) => p && !/^tutt/i.test(p));
  let group = "";
  let at = -1;
  let extra = "";
  for (const [re, name] of CLASSES) {
    at = parts.findIndex((p) => re.test(p));
    if (at >= 0) {
      group = name;
      // il resto del pezzo (es. «Juvenis maschile» → maschile) va con la tipologia
      extra = clean(parts[at].replace(re, " "));
      break;
    }
  }
  if (at < 0 && parts.length) {
    // nessuna classe riconosciuta: se il primo pezzo non è un tipo d'arco è la classe, altrimenti sono tutti
    const first = parts.findIndex((p) => !BOW.test(p));
    at = parts.length > 1 || first === 0 ? Math.max(first, 0) : -1;
    group = at >= 0 ? titleName(parts[at]) : "Tutti";
  }
  const rest = [extra, ...parts.filter((_, i) => i !== at)].filter(Boolean).map(titleName);
  return { group: group || "Tutti", tipologia: rest.join(" · ") };
}

// stemmi disegnati: scudo con bordo d'oro, campo partito/troncato/in banda/inquartato, arma al centro e iniziali
const FIELDS = ["#1f4fa8", "#b3202f", "#1f7a46", "#6b2fa0", "#0f6e6a", "#8a4b14", "#1d2b4f", "#a8781a", "#7a1f3d", "#2d5f2e"];
const SECOND = ["#f2ead8", "#1a1a1a", "#d9b44a", "#f2ead8", "#e9e2cf"];
function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}
const STOP = new Set(["ARCIERI", "ARCIERE", "COMPAGNIA", "ASD", "A.S.D.", "SSD", "DI", "DEL", "DELLA", "DEI", "DEGLI", "DELLE", "LA", "IL", "LE", "E", "SAN", "SANTA", "CITTA", "STORICI", "STORICO", "ARCO", "ASSOCIAZIONE", "GRUPPO"]);
/** iniziali della compagnia: le parole che la distinguono (Grottazzolina → G, Palio dei Castelli → PC) */
export function initialsOf(name: string) {
  const words = clean(name.toUpperCase().replace(/[^\p{L}0-9 ]/gu, " ")).split(" ").filter((w) => w.length > 1 && !STOP.has(w));
  const pick = words.length ? words : clean(name.toUpperCase()).split(" ");
  return pick.slice(0, 2).map((w) => w[0]).join("") || "A";
}

/** colore e stemma (SVG come indirizzo data:) di una compagnia, sempre uguali per lo stesso nome */
export function crestOf(name: string): { color: string; logo: string } {
  const h = hash(teamKey(name) || name);
  const field = FIELDS[h % FIELDS.length];
  let second = SECOND[(h >>> 4) % SECOND.length];
  if (second === field) second = "#f2ead8";
  const pattern = (h >>> 8) % 5;
  const charge = (h >>> 12) % 3;
  const shield = "M50 4 C62 9 80 9 94 5 L94 52 C94 84 76 104 50 116 C24 104 6 84 6 52 L6 5 C20 9 38 9 50 4 Z";
  const inner = "M50 11 C61 15 76 15 87 12 L87 52 C87 79 72 96 50 107 C28 96 13 79 13 52 L13 12 C24 15 39 15 50 11 Z";
  const split =
    pattern === 0 ? `<rect x="50" y="0" width="60" height="120" fill="${second}"/>`
    : pattern === 1 ? `<rect x="0" y="0" width="100" height="44" fill="${second}"/>`
    : pattern === 2 ? `<path d="M0 22 L22 0 L100 78 L100 100 L78 120 Z" fill="${second}" transform="translate(-6 -2)"/>`
    : pattern === 3 ? `<rect x="50" y="0" width="60" height="58" fill="${second}"/><rect x="0" y="58" width="50" height="62" fill="${second}"/>`
    : `<path d="${inner}" fill="none" stroke="${second}" stroke-width="7"/>`;
  const ink = "#f7d774";
  const dark = "#4f3406";
  const arms =
    charge === 0
      ? // frecce incrociate
        `<g stroke="${dark}" stroke-width="6" stroke-linecap="round"><path d="M30 36 L70 82 M70 36 L30 82"/></g><g stroke="${ink}" stroke-width="3.4" stroke-linecap="round"><path d="M30 36 L70 82 M70 36 L30 82"/></g><g fill="${ink}" stroke="${dark}" stroke-width="1.4"><path d="M27 31 L37 35 L31 41 Z"/><path d="M73 31 L63 35 L69 41 Z"/></g>`
      : charge === 1
        ? // bersaglio
          `<circle cx="50" cy="58" r="22" fill="${ink}" stroke="${dark}" stroke-width="2.4"/><circle cx="50" cy="58" r="14.5" fill="${field}" stroke="${dark}" stroke-width="1.6"/><circle cx="50" cy="58" r="7" fill="${ink}" stroke="${dark}" stroke-width="1.4"/>`
        : // arco teso con freccia
          `<path d="M38 32 C64 44 64 74 38 86" fill="none" stroke="${dark}" stroke-width="6.5" stroke-linecap="round"/><path d="M38 32 C64 44 64 74 38 86" fill="none" stroke="${ink}" stroke-width="3.6" stroke-linecap="round"/><path d="M38 32 L38 86" stroke="${ink}" stroke-width="1.4"/><path d="M30 59 L76 59" stroke="${dark}" stroke-width="4.6" stroke-linecap="round"/><path d="M30 59 L76 59" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/><path d="M78 59 L70 54 L70 64 Z" fill="${ink}" stroke="${dark}" stroke-width="1.2"/>`;
  const ini = initialsOf(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#e2b546"/><stop offset="1" stop-color="#8a5a12"/></linearGradient><linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="c"><path d="${inner}"/></clipPath></defs><path d="${shield}" fill="#2a1a04" transform="translate(0 2.5)"/><path d="${shield}" fill="url(#g)" stroke="#5a3d0a" stroke-width="1"/><g clip-path="url(#c)"><rect width="100" height="120" fill="${field}"/>${split}<rect width="100" height="120" fill="url(#l)"/></g><path d="${inner}" fill="none" stroke="#5a3d0a" stroke-width="1.2"/>${arms}<path d="M22 92 Q50 100 78 92 L74 104 Q50 111 26 104 Z" fill="${dark}" opacity=".85"/><text x="50" y="104" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="11" fill="${ink}" letter-spacing="1">${ini}</text></svg>`;
  return { color: field, logo: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
}

/** classifiche di squadra di una gara, accanto a pagView-Class-Arcieri-Gara.awp: nomi possibili */
export const SQUADRE_PAGES = ["pagView-Class-Squadre-Gara.awp", "pagView-Class-Compagnie-Gara.awp", "pagView-Class-Societa-Gara.awp", "pagView-Class-Squadra-Gara.awp"];
