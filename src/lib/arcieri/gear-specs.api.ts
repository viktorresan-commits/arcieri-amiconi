import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { db, ensureMember } from "./access";
import { cleanValue, fieldsOf, guessSpecs, keyOfLabel } from "./gear-specs";

/**
 * Legge la scheda di un prodotto dal link del negozio: titolo, foto, prezzo e la tabella delle
 * caratteristiche («Spine: 600», «Diametro: 5,2 mm»). Solo indirizzi pubblici in http/https:
 * niente indirizzi interni, al massimo 4 redirect, 8 secondi e 1,5 MB.
 */

type Pair = { label: string; value: string };
export type ProductPage = { url: string; title: string; image: string; priceCents: number | null; pairs: Pair[]; specs: Record<string, string>; scheda: string };

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

const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

/** scarica un indirizzo pubblico controllando ogni rimando (niente indirizzi interni), con tempo e peso massimi */
async function safeGet(start: string, opts: { ms: number; max: number; accept: string; cut?: boolean }): Promise<{ url: string; type: string; body: Uint8Array }> {
  let url = (await checkUrl(start)).toString();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.ms);
  try {
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(url, { redirect: "manual", signal: ctrl.signal, headers: { "user-agent": UA, accept: opts.accept, "accept-language": "it-IT,it;q=0.9,en;q=0.7" } });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || hop === 4) throw new Error("La pagina rimanda altrove troppe volte.");
        url = (await checkUrl(new URL(loc, url).toString())).toString();
        continue;
      }
      if (!res.ok) throw new Error(`Il negozio risponde ${res.status}: apri la pagina e copia tu i dati.`);
      const type = res.headers.get("content-type") ?? "";
      const reader = res.body?.getReader();
      if (!reader) return { url, type, body: new Uint8Array(await res.arrayBuffer()) };
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        size += value.length;
        if (size > opts.max) {
          await reader.cancel().catch(() => undefined);
          // una pagina troppo lunga si legge fino al limite; un'immagine troppo pesante no
          if (!opts.cut) throw new Error("File troppo pesante.");
          break;
        }
      }
      const all = new Uint8Array(Math.min(size, opts.max));
      let at = 0;
      for (const c of chunks) {
        const part = c.subarray(0, Math.min(c.length, all.length - at));
        all.set(part, at);
        at += part.length;
        if (at >= all.length) break;
      }
      return { url, type, body: all };
    }
    throw new Error("Pagina non raggiungibile.");
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Il negozio ci mette troppo a rispondere: riprova o copia tu i dati.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPage(start: string, ms = 8000): Promise<{ url: string; html: string }> {
  const r = await safeGet(start, { ms, max: 1_500_000, accept: "text/html,application/xhtml+xml", cut: true });
  if (r.type && !/html|xml|text/i.test(r.type)) throw new Error("Il link non è una pagina web.");
  const charset = /charset=([\w-]+)/i.exec(r.type)?.[1]?.toLowerCase() ?? "utf-8";
  let html: string;
  try {
    html = new TextDecoder(charset === "iso-8859-1" || charset === "latin1" ? "latin1" : charset === "windows-1252" ? "windows-1252" : "utf-8").decode(r.body);
  } catch {
    html = new TextDecoder("utf-8").decode(r.body);
  }
  return { url: r.url, html };
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

/** il prodotto descritto nel JSON-LD della pagina (nome, descrizione, foto, prezzo), se c'è */
function productLd(html: string): { name: string; description: string; image: string; price: string } {
  const out = { name: "", description: "", image: "", price: "" };
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (o: unknown): void => {
        if (Array.isArray(o)) return o.forEach(walk);
        if (!o || typeof o !== "object") return;
        const r = o as Record<string, unknown>;
        const type = String(Array.isArray(r["@type"]) ? r["@type"].join(" ") : r["@type"] ?? "");
        if (/product/i.test(type)) {
          if (!out.name && typeof r.name === "string") out.name = r.name;
          if (!out.description && typeof r.description === "string") out.description = r.description;
          const img = Array.isArray(r.image) ? r.image[0] : r.image;
          const imgUrl = typeof img === "string" ? img : img && typeof img === "object" ? String((img as Record<string, unknown>).url ?? "") : "";
          if (!out.image && imgUrl) out.image = imgUrl;
          const offers = (Array.isArray(r.offers) ? r.offers[0] : r.offers) as Record<string, unknown> | undefined;
          const price = offers?.price ?? offers?.lowPrice;
          if (!out.price && (typeof price === "string" || typeof price === "number")) out.price = String(price);
        }
        for (const v of Object.values(r)) if (v && typeof v === "object") walk(v);
      };
      walk(JSON.parse(m[1]));
    } catch {
      /* JSON-LD rotto: si va avanti */
    }
  }
  // la descrizione del JSON-LD è spesso HTML con le entità: prima si decodifica, poi si tolgono i tag
  out.description = text(decode(out.description));
  return out;
}

/** il testo della descrizione del prodotto (le misure e i materiali sono spesso solo lì) */
function descriptionOf(html: string): string {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
  const parts: string[] = [];
  for (const m of body.matchAll(/<(div|section|p|span)[^>]+(?:itemprop=["']description["']|(?:class|id)=["'][^"']*(?:description|descrizione|product-desc|short-desc|tab-desc|product__desc)[^"']*["'])[^>]*>([\s\S]{0,8000})/gi)) {
    const t = text(m[2]).slice(0, 1500);
    if (t.length > 20) parts.push(t);
    if (parts.join(" ").length > 3000) break;
  }
  return parts.join(" ").slice(0, 3000);
}

/** voci della scheda che non sono campi del pezzo ma servono (colore, dimensioni…): niente prezzi, codici o spedizioni */
const NOT_INFO = /prezz|price|€|sku|codice|code|ean|gtin|mpn|disponib|availab|quantit|spedizion|shipping|consegna|deliver|reso|return|garanzia|warrant|recension|review|valutaz|rating|categor|tag\b|condivid|share|iva\b|vat\b|stock|magazzin/i;
function schedaOf(pairs: Pair[]): string {
  const out: string[] = [];
  for (const p of pairs) {
    if (NOT_INFO.test(p.label) || NOT_INFO.test(p.value) || p.value.length > 50) continue;
    const item = `${p.label}: ${p.value}`;
    if (out.join(" · ").length + item.length > 190) break;
    out.push(item);
  }
  return out.join(" · ");
}

/** legge la pagina di un prodotto: titolo, foto, prezzo, voci della scheda e i dati che servono per la categoria */
async function readPage(link: string, category: string, ms = 8000): Promise<ProductPage> {
  const { url, html } = await fetchPage(link, ms);
  const ld = productLd(html);
  const title = meta(html, "og:title") || ld.name || text(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const desc = meta(html, "og:description") || meta(html, "description");
  const long = [ld.description, descriptionOf(html)].filter(Boolean).join(" ").slice(0, 4000);
  let image = meta(html, "og:image") || meta(html, "og:image:secure_url") || meta(html, "twitter:image") || ld.image;
  if (image) {
    try {
      image = new URL(image, url).toString();
      if (!/^https?:/.test(image)) image = "";
    } catch {
      image = "";
    }
  }
  const priceRaw = meta(html, "product:price:amount") || meta(html, "og:price:amount") || meta(html, "price") || ld.price || /"price"\s*:\s*"?(\d+(?:[.,]\d{1,2})?)/.exec(html)?.[1] || "";
  const price = Number(priceRaw.replace(",", "."));
  const pairs = pairsOf(html);
  // prima il testo libero (titolo, descrizioni, valori della scheda), poi le voci della tabella, che contano di più
  // per i pezzi con numeri tecnici (spine, pollici, grani) il testo lungo inganna (codici, misure di altro): solo titolo
  // e descrizione breve; per custodie, faretre, protezioni anche la descrizione intera e la scheda
  const technical = fieldsOf(category).some((f) => f.unit);
  const loose = technical ? `${title} ${desc}` : `${title} ${desc} ${long} ${pairs.map((p) => `${p.label}: ${p.value}`).join(". ")}`;
  const specs: Record<string, string> = { ...guessSpecs(loose, category) };
  for (const p of pairs) {
    const key = keyOfLabel(p.label, category);
    if (!key) continue;
    const v = cleanValue(key, p.value, category);
    if (v) specs[key] = v;
  }
  return { url, title: title.slice(0, 140), image: image.slice(0, 500), priceCents: Number.isFinite(price) && price > 0 && price < 100000 ? Math.round(price * 100) : null, pairs: pairs.slice(0, 30), specs, scheda: schedaOf(pairs) };
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
    return readPage(data.url, data.category);
  });

// --- ricerca in rete, senza uscire dall'app -------------------------------------------------------------

/** siti che non sono negozi né schede di prodotto (motori, social, marketplace che non si lasciano leggere) */
const NOT_SHOP = /(^|\.)(google|bing|duckduckgo|mojeek|yahoo|yandex|msn|microsoft|live|youtube|youtu|facebook|fb|instagram|pinterest|tiktok|twitter|x|reddit|wikipedia|wikimedia|amazon|ebay|aliexpress|temu|wish|idealo|trovaprezzi|kelkoo|pricerunner|linkedin|tripadvisor|archive|wordpress|blogspot|apple|whatsapp|telegram)\.[a-z.]+$/i;
const STOP = new Set(["la", "il", "lo", "le", "gli", "di", "da", "del", "della", "dei", "per", "con", "the", "and", "for", "with", "una", "uno", "nel", "pz", "pezzi", "set", "cm", "mm", "nuovo", "nuova"]);
const normW = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/** le parole che riconoscono il prodotto (marca, modello, nome) */
const wordsOf = (s: string) => [...new Set(normW(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)))].slice(0, 10);

/** i link dei risultati da una pagina di ricerca: si tolgono i rimandi del motore (DuckDuckGo, Bing) */
function resultLinks(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    let h = decode(m[1]);
    const uddg = /[?&]uddg=([^&]+)/.exec(h)?.[1];
    if (uddg) {
      try {
        h = decodeURIComponent(uddg);
      } catch {
        continue;
      }
    }
    if (/bing\.com\/ck\/a/i.test(h)) {
      const u = /[?&]u=a1([^&]+)/.exec(h)?.[1];
      if (!u) continue;
      try {
        h = Buffer.from(u.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      } catch {
        continue;
      }
    }
    if (h.startsWith("//")) h = `https:${h}`;
    if (!/^https?:\/\//i.test(h)) continue;
    let u: URL;
    try {
      u = new URL(h);
    } catch {
      continue;
    }
    if (NOT_SHOP.test(u.hostname) || u.pathname.length < 3 || /\.(jpe?g|png|gif|webp|svg|css|js|pdf|xml)$/i.test(u.pathname)) continue;
    u.hash = "";
    out.push(u.toString());
  }
  return [...new Set(out)];
}

/** cerca il prodotto in rete (DuckDuckGo, poi Bing, poi Mojeek) e dà i link più somiglianti al nome */
async function searchProduct(query: string, words: string[], shop: string, until: number): Promise<{ links: string[]; engine: string }> {
  const q = encodeURIComponent(query);
  const engines: [string, string][] = [
    ["DuckDuckGo", `https://html.duckduckgo.com/html/?q=${q}&kl=it-it`],
    ["Bing", `https://www.bing.com/search?setlang=it&cc=IT&q=${q}`],
    ["Mojeek", `https://www.mojeek.com/search?q=${q}`],
  ];
  const shopW = wordsOf(shop).map((w) => w.replace(/[^a-z0-9]/g, ""));
  for (const [name, url] of engines) {
    if (Date.now() > until - 9000) break;
    const html = await safeGet(url, { ms: 6000, max: 2_000_000, accept: "text/html", cut: true })
      .then((r) => new TextDecoder().decode(r.body))
      .catch(() => "");
    const links = html ? resultLinks(html) : [];
    if (!links.length) continue;
    const ranked = links
      .map((u, i) => {
        const x = new URL(u);
        const slug = normW(decodeURIComponent(`${x.hostname} ${x.pathname}`)).replace(/[^a-z0-9]+/g, " ");
        const hits = words.filter((w) => slug.includes(w)).length;
        const host = x.hostname.replace(/[^a-z0-9]/g, "");
        const fromShop = shopW.length && shopW.some((w) => w.length >= 4 && host.includes(w)) ? 2 : 0;
        return { u, score: hits * 2 + fromShop - i * 0.02 };
      })
      .sort((a, b) => b.score - a.score);
    // i più somiglianti; se il nome ha errori (scontrino letto male) anche i primi del motore
    const good = ranked.filter((x) => x.score >= 3).map((x) => x.u);
    const first = links.slice(0, 3);
    return { links: [...new Set([...good, ...first])].slice(0, 6), engine: name };
  }
  return { links: [], engine: "" };
}

export type FoundProduct = { page: ProductPage | null; photo: string; others: { url: string; title: string }[]; note: string };

/** la foto del prodotto come data URL (JPEG, PNG, WebP o GIF, non minuscola), da ridurre sul telefono */
async function photoOf(url: string): Promise<string> {
  if (!url) return "";
  try {
    const r = await safeGet(url, { ms: 6000, max: 1_500_000, accept: "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8" });
    const b = r.body;
    const mime =
      b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : b[0] === 0x89 && b[1] === 0x50 ? "image/png" : b[0] === 0x47 && b[1] === 0x49 ? "image/gif" : b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 ? "image/webp" : "";
    if (!mime || b.length < 2000) return "";
    return `data:${mime};base64,${Buffer.from(b).toString("base64")}`;
  } catch {
    return "";
  }
}

/**
 * Cerca da sola le specifiche di un pezzo: se c'è il link del negozio lo legge, altrimenti cerca il nome in
 * rete, legge le prime pagine di negozio e tiene quella che somiglia di più (nome nel titolo, dati trovati),
 * con la sua foto. Niente da aprire fuori dall'app.
 */
export const findProductSpecs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
    const name = clip(raw.name, 120);
    if (name.length < 2) throw new Error("Scrivi il nome del pezzo.");
    return { name, brand: clip(raw.brand, 60), model: clip(raw.model, 60), category: clip(raw.category, 40) || "altro", shop: clip(raw.shop, 80), url: clip(raw.url, 1000), skip: Array.isArray(raw.skip) ? raw.skip.slice(0, 10).map((x) => clip(x, 1000)) : [] };
  })
  .handler(async ({ context, data }): Promise<FoundProduct> => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const until = Date.now() + 28_000;
    const words = wordsOf(`${data.brand} ${data.model} ${data.name}`);
    let links: string[] = [];
    let engine = "";
    if (/^https?:\/\//i.test(data.url)) links = [data.url];
    else {
      const what = ["aste", "freccia"].includes(data.category) ? "spine" : "";
      const q = [...new Set(`${data.brand} ${data.model} ${data.name}`.split(/\s+/).filter(Boolean))].join(" ");
      const found = await searchProduct(`${q} ${what} tiro con l'arco`.replace(/\s+/g, " ").trim(), words, data.shop, until);
      links = found.links.filter((u) => !data.skip.includes(u));
      engine = found.engine;
      if (!links.length) return { page: null, photo: "", others: [], note: engine ? "La ricerca non ha trovato pagine di negozio per questo nome: correggi il nome o incolla il link." : "La ricerca in rete non risponde ora: riprova tra poco o incolla il link del negozio." };
    }
    // le prime pagine insieme: si tiene quella col nome nel titolo e più dati
    const left = Math.max(4000, Math.min(9000, until - Date.now() - 7000));
    const pages = (await Promise.all(links.slice(0, 4).map((u) => readPage(u, data.category, left).catch(() => null)))).filter((p): p is ProductPage => Boolean(p));
    const scored = pages
      .map((p) => {
        const t = normW(`${p.title} ${p.url}`);
        const hits = words.filter((w) => t.includes(w)).length;
        const useful = Object.keys(p.specs).length;
        return { p, hits, score: hits * 3 + useful * 2 + (p.image ? 1 : 0) + Math.min(3, p.pairs.length / 5) };
      })
      .filter((x) => links.length === 1 || x.hits >= Math.min(2, words.length))
      .sort((a, b) => b.score - a.score);
    const best = scored[0]?.p ?? null;
    if (!best) return { page: null, photo: "", others: [], note: links.length === 1 ? "Non riesco a leggere quella pagina: prova con un altro link." : "Ho trovato pagine in rete, ma nessuna è di questo prodotto: correggi il nome (marca e modello) o incolla il link." };
    const photo = Date.now() < until - 3000 ? await photoOf(best.image) : "";
    return { page: best, photo, others: scored.slice(1, 4).map((x) => ({ url: x.p.url, title: x.p.title })), note: engine ? `Trovato con ${engine}.` : "" };
  });
