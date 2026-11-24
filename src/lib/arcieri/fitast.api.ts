/**
 * Lettore del portale pubblico FITAST (http://89.46.73.21/FITAST_WEB/…): il sito non ha API, quindi
 * il server scarica la pagina e la riduce a tabelle, righe di testo e collegamenti. L'app poi cerca il
 * nome dell'arciere, i compagni di piazzola e le classifiche. Si leggono solo pagine di quel portale.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const FITAST_HOME = "http://89.46.73.21/FITAST_WEB/IT/pagView-GARE.awp";
const HOST = "89.46.73.21";

import { parseHtml, type FitastPage } from "./fitast-parse";

export type { FitastCell, FitastLink, FitastPage, FitastTable } from "./fitast-parse";

const cache = new Map<string, { at: number; page: FitastPage }>();
const TTL = 10 * 60_000;

async function fetchPage(url: string): Promise<FitastPage> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.page;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (Arcieri Amiconi; lettura calendario)", accept: "text/html,application/pdf,*/*" } });
    if (!res.ok) throw new Error(`Il portale FITAST risponde ${res.status}.`);
    const type = res.headers.get("content-type") ?? "";
    const now = new Date().toISOString();
    if (/pdf/i.test(type) || /\.pdf($|\?)/i.test(url)) {
      const page: FitastPage = { url, title: decodeURIComponent(url.split("/").pop() ?? "Documento"), kind: "pdf", tables: [], lines: [], links: [], fetchedAt: now };
      cache.set(url, { at: Date.now(), page });
      return page;
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
    const page: FitastPage = { ...parseHtml(html, res.url || url), kind: /html|xml|text/i.test(type) || !type ? "html" : "altro", fetchedAt: now };
    cache.set(url, { at: Date.now(), page });
    return page;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Il portale FITAST non risponde: riprova più tardi.");
    throw e instanceof Error ? e : new Error("Portale FITAST non raggiungibile.");
  } finally {
    clearTimeout(timer);
  }
}

/** legge una pagina del portale FITAST (solo quel sito) */
export const fitastRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = String((input as { url?: unknown })?.url ?? "") || FITAST_HOME;
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      throw new Error("Indirizzo non valido.");
    }
    if (u.hostname !== HOST || !u.pathname.startsWith("/FITAST_WEB/")) throw new Error("Si leggono solo le pagine del portale FITAST.");
    return { url: u.toString() };
  })
  .handler(async ({ data }) => fetchPage(data.url));
