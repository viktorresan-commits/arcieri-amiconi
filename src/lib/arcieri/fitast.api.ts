/**
 * Lettore del portale pubblico FITAST (http://89.46.73.21/FITAST_WEB/…): il sito non ha API, quindi
 * il server scarica la pagina e la riduce a tabelle, righe di testo e collegamenti. L'app poi cerca il
 * nome dell'arciere, i compagni di piazzola e le classifiche. Si leggono solo pagine di quel portale.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const FITAST_HOME = "http://89.46.73.21/FITAST_WEB/IT/pagView-GARE.awp";
const HOST = "89.46.73.21";

import { formBody, parseHtml, type FitastPage } from "./fitast-parse";
import { pdfLines } from "./pdf-text";

export type { FitastButton, FitastCell, FitastForm, FitastLink, FitastPage, FitastSelect, FitastTable } from "./fitast-parse";

const cache = new Map<string, { at: number; page: FitastPage; cookie: string }>();
const TTL = 10 * 60_000;

/** cookie di sessione del portale (le pagine .awp ricordano la scelta fatta): si rimandano tali e quali */
function mergeCookies(old: string, res: Response) {
  const jar = new Map<string, string>();
  for (const part of old.split(/;\s*/)) {
    const [k, ...v] = part.split("=");
    if (k?.trim()) jar.set(k.trim(), v.join("="));
  }
  const raw = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);
  for (const line of raw) {
    const [pair] = line.split(";");
    const [k, ...v] = pair.split("=");
    if (k?.trim()) jar.set(k.trim(), v.join("="));
  }
  return [...jar.entries()].slice(0, 20).map(([k, v]) => `${k}=${v}`).join("; ").slice(0, 3000);
}

type Req = { url: string; body?: string; cookie: string; referer?: string };

async function fetchPage(req: Req): Promise<FitastPage & { cookie: string }> {
  const key = `${req.url}|${req.body ?? ""}`;
  // in cache solo i PDF: le pagine .awp cambiano con la sessione (gara e filtri scelti), e una
  // risposta ricordata farebbe vedere la classifica di un'altra gara
  const hit = cache.get(key);
  if (hit && hit.page.kind === "pdf" && Date.now() - hit.at < TTL) return { ...hit.page, cookie: req.cookie || hit.cookie };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const headers: Record<string, string> = { "user-agent": "Mozilla/5.0 (Arcieri Amiconi; lettura calendario)", accept: "text/html,application/pdf,*/*" };
    if (req.cookie) headers.cookie = req.cookie;
    if (req.referer) headers.referer = req.referer;
    if (req.body != null) headers["content-type"] = "application/x-www-form-urlencoded";
    let res = await fetch(req.url, { method: req.body != null ? "POST" : "GET", body: req.body, headers, signal: ctrl.signal, redirect: "manual" });
    let cookie = mergeCookies(req.cookie, res);
    // dopo un invio WEBDEV spesso risponde con un rimando: lo si segue restando sul portale
    for (let hop = 0; hop < 4 && res.status >= 300 && res.status < 400; hop++) {
      const loc = res.headers.get("location");
      if (!loc) break;
      const next = new URL(loc, res.url || req.url);
      if (next.hostname !== HOST || !next.pathname.startsWith("/FITAST_WEB/")) throw new Error("Il portale rimanda fuori da FITAST.");
      const { "content-type": _drop, ...getHeaders } = headers;
      res = await fetch(next.toString(), { headers: { ...getHeaders, cookie }, signal: ctrl.signal, redirect: "manual" });
      cookie = mergeCookies(cookie, res);
    }
    if (!res.ok) throw new Error(`Il portale FITAST risponde ${res.status}.`);
    const finalUrl = res.url || req.url;
    const type = res.headers.get("content-type") ?? "";
    const now = new Date().toISOString();
    if (/pdf/i.test(type) || /\.pdf($|\?)/i.test(finalUrl)) {
      // classifiche e risultati delle gare passate sono spesso PDF: se ne legge il testo, riga per riga,
      // così il nome dell'arciere si trova anche lì
      const bytes = new Uint8Array(await res.arrayBuffer());
      let lines: string[] = [];
      try {
        lines = bytes.length < 12_000_000 ? pdfLines(bytes, 3000).map((l) => l.slice(0, 400)) : [];
      } catch {
        lines = [];
      }
      const page: FitastPage = { url: finalUrl, title: decodeURIComponent(finalUrl.split("/").pop() ?? "Documento"), kind: "pdf", tables: [], lines, links: [], form: null, charset: "", fetchedAt: now };
      cache.set(key, { at: Date.now(), page, cookie });
      return { ...page, cookie };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    // i siti WEBDEV spesso sono in windows-1252: si guarda il charset dichiarato
    const head = new TextDecoder("latin1").decode(buf.slice(0, 4000));
    const charset = (type.match(/charset=([\w-]+)/i)?.[1] ?? head.match(/charset=["']?([\w-]+)/i)?.[1] ?? "utf-8").toLowerCase();
    let html: string;
    try {
      html = new TextDecoder(charset === "iso-8859-1" || charset === "latin1" ? "windows-1252" : charset).decode(buf);
    } catch {
      html = new TextDecoder("utf-8").decode(buf);
    }
    const page: FitastPage = { ...parseHtml(html, finalUrl), kind: /html|xml|text/i.test(type) || !type ? "html" : "altro", charset, fetchedAt: now };
    return { ...page, cookie };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Il portale FITAST non risponde: riprova più tardi.");
    throw e instanceof Error ? e : new Error("Portale FITAST non raggiungibile.");
  } finally {
    clearTimeout(timer);
  }
}

function onPortal(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Indirizzo non valido.");
  }
  if (u.hostname !== HOST || !u.pathname.startsWith("/FITAST_WEB/")) throw new Error("Si leggono solo le pagine del portale FITAST.");
  return u.toString();
}

/**
 * legge una pagina del portale FITAST (solo quel sito). Con `post` preme un comando della pagina
 * (PIAZZOLE, CLASSIFICA…): rimanda il modulo con i suoi campi, come farebbe il browser.
 */
export const fitastRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { url?: unknown; post?: { fields?: unknown; charset?: unknown }; cookie?: unknown; referer?: unknown };
    const url = onPortal(String(raw.url ?? "") || FITAST_HOME);
    const cookie = String(raw.cookie ?? "").replace(/[\r\n]/g, "").slice(0, 3000);
    const referer = raw.referer ? onPortal(String(raw.referer)) : undefined;
    let body: string | undefined;
    if (raw.post && typeof raw.post === "object") {
      const f = raw.post.fields && typeof raw.post.fields === "object" ? (raw.post.fields as Record<string, unknown>) : {};
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(f).slice(0, 200)) {
        if (k.length > 80) continue;
        fields[k] = String(v ?? "").slice(0, 4000);
      }
      body = formBody(fields, String(raw.post.charset ?? "utf-8"));
      if (body.length > 60_000) throw new Error("Modulo troppo grande.");
    }
    return { url, body, cookie, referer };
  })
  .handler(async ({ data }) => fetchPage(data));
