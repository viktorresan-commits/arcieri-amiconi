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

/** le compagnie dell'elenco del portale: dalla tabella con la colonna del nome, se no dalle righe di testo */
export function parseCompanies(page: FitastPage): PortalCompany[] {
  const out = new Map<string, PortalCompany>();
  const add = (c: PortalCompany) => {
    const k = teamKey(c.name);
    if (!k || k.length < 3 || out.has(k)) return;
    out.set(k, c);
  };
  for (const t of [...page.tables].sort((a, b) => b.rows.length - a.rows.length)) {
    if (t.rows.length < 3) continue;
    const head = t.rows[0].map((c) => clean(c.text));
    const col = (re: RegExp) => head.findIndex((h) => re.test(h));
    let nameCol = col(HEAD.name);
    // senza titoli: la colonna dove le righe sembrano nomi di compagnie
    if (nameCol < 0) {
      const width = Math.max(...t.rows.map((r) => r.length));
      let best = -1;
      let score = 0;
      for (let k = 0; k < width; k++) {
        const n = t.rows.slice(1).filter((r) => LOOKS_COMPANY.test(r[k]?.text ?? "")).length;
        if (n > score) [best, score] = [k, n];
      }
      if (score < 2) continue;
      nameCol = best;
    }
    const at = (r: FitastTable["rows"][number], re: RegExp) => {
      const k = col(re);
      return k >= 0 ? clean(r[k]?.text ?? "") : "";
    };
    for (const r of t.rows.slice(1)) {
      const name = clean(r[nameCol]?.text ?? "");
      if (name.length < 3 || /^\d+$/.test(name)) continue;
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
      add({ name, city: at(r, HEAD.city), province: at(r, HEAD.province), region: at(r, HEAD.region), code: at(r, HEAD.code), president: at(r, HEAD.president), phone: at(r, HEAD.phone), email, website: at(r, HEAD.website), address: at(r, HEAD.address), logo, detail });
    }
    if (out.size >= 3) break;
  }
  // elenco senza tabella (zona ripetuta): le righe che sembrano nomi di compagnie
  if (out.size < 3) {
    for (const l of page.lines) {
      const t = clean(l);
      if (t.length < 6 || t.length > 90 || !LOOKS_COMPANY.test(t) || /fitast|federazion|elenco|compagnie$|^compagnia$/i.test(t)) continue;
      if (t === t.toUpperCase() || /^(compagnia|arcieri|a\.?s\.?d)/i.test(t)) add({ name: t, city: "", province: "", region: "", code: "", president: "", phone: "", email: "", website: "", address: "" });
    }
  }
  return [...out.values()].slice(0, 400);
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

/** la categoria in parole dell'app: Messeri, Madonne, Juniores, Pueri; e la tipologia d'arco */
export function categoryGroup(category: string): { group: string; tipologia: string } {
  const parts = category.split(" · ").map(clean);
  const find = (re: RegExp) => parts.find((p) => re.test(p)) ?? "";
  const g = find(/messer|madonn|junior|puer/i) || parts[0] || "";
  const group = /messer/i.test(g) ? "Messeri" : /madonn/i.test(g) ? "Madonne" : /junior/i.test(g) ? "Juniores" : /puer/i.test(g) ? "Pueri" : titleName(g);
  const tipologia = titleName(parts.find((p) => p !== g) ?? "");
  return { group, tipologia };
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
