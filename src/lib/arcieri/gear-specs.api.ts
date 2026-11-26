import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { db, ensureMember } from "./access";
import { cleanValue, guessSpecs, keyOfLabel } from "./gear-specs";

/**
 * Legge la scheda di un prodotto dal link del negozio: titolo, foto, prezzo e la tabella delle
 * caratteristiche («Spine: 600», «Diametro: 5,2 mm»). Solo indirizzi pubblici in http/https:
 * niente indirizzi interni, al massimo 4 redirect, 8 secondi e 1,5 MB.
 */

type Pair = { label: string; value: string };
export type ProductPage = { url: string; title: string; image: string; priceCents: number | null; pairs: Pair[]; specs: Record<string, string> };

/** indirizzi privati, di loopback, link-local e riservati (IPv4 e IPv6) */
function privateIp(ip: string): boolean {
  const v4 = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(ip);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const l = ip.toLowerCase();
  return l === "::" || l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe8") || l.startsWith("fe9") || l.startsWith("fea") || l.startsWith("feb") || l.startsWith("ff");
}

async function checkUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Questo non è un link: copialo dalla pagina del prodotto (inizia con https://).");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Serve un link https:// della pagina del prodotto.");
  if (u.username || u.password) throw new Error("Link non valido.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("Link non valido.");
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host.includes(".") || host === "localhost" || /\.(localhost|local|internal|lan|home|corp)$/.test(host)) throw new Error("Link non valido.");
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    if (privateIp(host)) throw new Error("Link non valido.");
    return u;
  }
  const dns = await import("node:dns/promises");
  const addrs = await dns.lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error("Questo sito non risponde: controlla il link.");
  if (addrs.some((a) => privateIp(a.address))) throw new Error("Link non valido.");
  return u;
}

async function fetchPage(start: string): Promise<{ url: string; html: string }> {
  let url = (await checkUrl(start)).toString();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(url, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": "Mozilla/5.0 (compatible; ArcieriAmiconi/1.0; +https://arcieri-amiconi.vercel.app)", accept: "text/html,application/xhtml+xml", "accept-language": "it,en;q=0.8" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || hop === 4) throw new Error("La pagina rimanda altrove troppe volte.");
        url = (await checkUrl(new URL(loc, url).toString())).toString();
        continue;
      }
      if (!res.ok) throw new Error(`Il negozio risponde ${res.status}: apri la pagina e copia tu i dati.`);
      const type = res.headers.get("content-type") ?? "";
      if (type && !/html|xml|text/i.test(type)) throw new Error("Il link non è una pagina web.");
      const reader = res.body?.getReader();
      if (!reader) return { url, html: await res.text() };
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        size += value.length;
        if (size > 1_500_000) {
          await reader.cancel().catch(() => undefined);
          break;
        }
      }
      const all = new Uint8Array(size);
      let at = 0;
      for (const c of chunks) {
        const part = c.subarray(0, Math.min(c.length, size - at));
        all.set(part, at);
        at += part.length;
      }
      const charset = /charset=([\w-]+)/i.exec(type)?.[1]?.toLowerCase() ?? "utf-8";
      let html: string;
      try {
        html = new TextDecoder(charset === "iso-8859-1" || charset === "latin1" ? "latin1" : charset === "windows-1252" ? "windows-1252" : "utf-8").decode(all);
      } catch {
        html = new TextDecoder("utf-8").decode(all);
      }
      return { url, html };
    }
    throw new Error("Pagina non raggiungibile.");
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Il negozio ci mette troppo a rispondere: riprova o copia tu i dati.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", egrave: "è", eacute: "é", agrave: "à", ograve: "ò", ugrave: "ù", igrave: "ì", deg: "°", times: "×", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "–", mdash: "—", euro: "€", frac12: "½", Prime: "″", prime: "′" };
const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, k: string) => ENT[k] ?? ENT[k.toLowerCase()] ?? m);
const text = (html: string) => decode(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const meta = (html: string, name: string) =>
  decode(
    new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i").exec(html)?.[1] ??
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${name}["']`, "i").exec(html)?.[1] ??
      "",
  ).trim();

/** voci «etichetta → valore» dalle tabelle, dagli elenchi <dl>, dalle righe «Etichetta: valore» e dal JSON-LD */
function pairsOf(html: string): Pair[] {
  const out: Pair[] = [];
  const add = (label: string, value: string) => {
    const l = label.replace(/[:：]\s*$/, "").trim();
    const v = value.trim();
    if (l.length < 2 || l.length > 48 || !v || v.length > 90) return;
    if (out.some((p) => p.label.toLowerCase() === l.toLowerCase())) return;
    out.push({ label: l, value: v });
  };
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (o: unknown): void => {
        if (Array.isArray(o)) return o.forEach(walk);
        if (!o || typeof o !== "object") return;
        const r = o as Record<string, unknown>;
        if (typeof r.name === "string" && (typeof r.value === "string" || typeof r.value === "number") && r["@type"] === "PropertyValue") add(r.name, String(r.value));
        for (const v of Object.values(r)) if (v && typeof v === "object") walk(v);
      };
      walk(JSON.parse(m[1]));
    } catch {
      /* JSON-LD rotto: si va avanti */
    }
  }
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ");
  for (const row of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => text(c[1]));
    if (cells.length === 2) add(cells[0], cells[1]);
  }
  for (const m of body.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)) add(text(m[1]), text(m[2]));
  for (const m of body.matchAll(/<(?:li|p|div|span)[^>]*>([^<>]{2,140})<\/(?:li|p|div|span)>/gi)) {
    const t = text(m[1]);
    const kv = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .\/()'-]{1,40})\s*[:：]\s*(.{1,80})$/.exec(t);
    if (kv) add(kv[1], kv[2]);
  }
  return out.slice(0, 60);
}

export const readProductPage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const url = String(raw.url ?? "").trim();
    if (url.length < 8 || url.length > 1000) throw new Error("Incolla il link della pagina del prodotto.");
    return { url, category: String(raw.category ?? "altro").slice(0, 40) };
  })
  .handler(async ({ context, data }): Promise<ProductPage> => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const { url, html } = await fetchPage(data.url);
    const title = meta(html, "og:title") || text(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
    const desc = meta(html, "og:description") || meta(html, "description");
    let image = meta(html, "og:image");
    if (image) {
      try {
        image = new URL(image, url).toString();
        if (!/^https:/.test(image)) image = "";
      } catch {
        image = "";
      }
    }
    const priceRaw = meta(html, "product:price:amount") || meta(html, "og:price:amount") || meta(html, "price") || /"price"\s*:\s*"?(\d+(?:[.,]\d{1,2})?)/.exec(html)?.[1] || "";
    const price = Number(priceRaw.replace(",", "."));
    const pairs = pairsOf(html);
    // prima il testo libero (titolo, descrizione), poi le voci della tabella, che contano di più
    const specs: Record<string, string> = { ...guessSpecs(`${title} ${desc}`, data.category) };
    for (const p of pairs) {
      const key = keyOfLabel(p.label, data.category);
      if (!key) continue;
      const v = cleanValue(key, p.value, data.category);
      if (v) specs[key] = v;
    }
    return { url, title: title.slice(0, 140), image: image.slice(0, 500), priceCents: Number.isFinite(price) && price > 0 && price < 100000 ? Math.round(price * 100) : null, pairs: pairs.slice(0, 30), specs };
  });
