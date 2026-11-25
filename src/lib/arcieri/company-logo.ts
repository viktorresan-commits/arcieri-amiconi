/**
 * Logo vero di una compagnia: dove cercarlo in una pagina (sito della compagnia, pagina del portale) e
 * come riconoscere un'immagine che può fare da stemma (formato, misure, proporzioni).
 * Solo funzioni pure: le letture in rete le fa il server.
 */

export type LogoCandidate = { url: string; score: number; why: string };

/** immagini che non sono loghi: social, pulsanti, segnaposto, bandiere, store */
const NOT_LOGO = /spacer|pixel|blank|transparent|placeholder|loading|spinner|lazy|arrow|freccia|fleche|puce|btn|button|sprite|facebook|instagram|twitter|x-logo|youtube|whatsapp|tiktok|linkedin|telegram|google|apple-app|app-store|play-store|badge|cookie|iubenda|flag|bandiera|paypal|visa|mastercard|wix-logo|wixstatic\.com\/media\/[^"']*wix|wordpress-logo|powered|gravatar|emoji|avatar/i;

/** domini di posta generici: dal dominio dell'e-mail non si arriva al sito della compagnia */
const MAIL_HOSTS = /^(gmail|googlemail|libero|alice|tin|virgilio|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|mac|tiscali|fastwebnet|email|pec|legalmail|postecert|poste|aruba|arubapec|pec\.aruba|inwind|iol|katamail|teletu|tim|vodafone|infinito|jumpy|supereva|interfree|lycos|gmx|protonmail|proton|zoho|mail|webmail)\./i;

function attrsOf(tag: string) {
  const m = new Map<string, string>();
  for (const a of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) m.set(a[1].toLowerCase(), (a[3] ?? a[4] ?? a[5] ?? "").replace(/&amp;/g, "&"));
  return m;
}

function absoluteUrl(u: string, base: string) {
  try {
    const url = new URL(u.trim(), base);
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

/**
 * I posti dove una pagina mette il suo logo, dal più affidabile: dati strutturati ("logo"), immagini con
 * "logo"/"stemma" nel nome o nel testo alternativo, icona per la schermata Home, og:image, icone grandi.
 */
export function logoCandidates(html: string, base: string): LogoCandidate[] {
  const out: LogoCandidate[] = [];
  const push = (raw: string, score: number, why: string) => {
    const url = absoluteUrl(raw, base);
    if (!url || NOT_LOGO.test(url)) return;
    out.push({ url, score, why });
  };
  const head = html.slice(0, 600_000);
  // dati strutturati: "logo": "https://…" oppure "logo": { "url": "https://…" }
  for (const m of head.matchAll(/"logo"\s*:\s*(?:\{[^{}]*?"(?:url|contentUrl)"\s*:\s*)?"([^"]{4,400})"/g)) push(m[1].replace(/\\\//g, "/"), 6, "dati strutturati");
  let n = 0;
  for (const m of head.matchAll(/<img\b[^>]*>/gi)) {
    n += 1;
    const a = attrsOf(m[0]);
    const srcset = (a.get("srcset") ?? a.get("data-srcset") ?? "").split(",").map((x) => x.trim().split(/\s+/)[0]).filter(Boolean);
    const src = a.get("src") && !/^data:/i.test(a.get("src") ?? "") ? a.get("src") ?? "" : a.get("data-src") ?? a.get("data-lazy-src") ?? srcset[srcset.length - 1] ?? "";
    if (!src || /^data:/i.test(src)) continue;
    const text = `${src} ${a.get("alt") ?? ""} ${a.get("class") ?? ""} ${a.get("id") ?? ""} ${a.get("title") ?? ""}`;
    if (!/logo|stemma|marchio|emblema|scudo|crest/i.test(text)) continue;
    // i primi loghi della pagina (testata) valgono di più di quelli in fondo (sponsor, partner)
    push(src, 5 - Math.min(2.5, n * 0.05), "immagine logo");
  }
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrsOf(m[0]);
    const rel = (a.get("rel") ?? "").toLowerCase();
    const href = a.get("href") ?? "";
    if (!href) continue;
    if (rel.includes("apple-touch-icon")) push(href, 3.4, "icona Home");
    else if (/\bicon\b/.test(rel)) {
      const size = Math.max(0, ...(a.get("sizes") ?? "").split(/\s+/).map((x) => Number(x.split("x")[0]) || 0));
      if (size >= 120 || /\.svg(\?|$)/i.test(href) || /(180|192|256|270|512)/.test(href)) push(href, 2.8, "icona");
    }
  }
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrsOf(m[0]);
    const p = (a.get("property") ?? a.get("name") ?? a.get("itemprop") ?? "").toLowerCase();
    const content = a.get("content") ?? "";
    if (!content) continue;
    if (p === "og:logo" || p === "logo") push(content, 5.5, "og:logo");
    else if (p === "og:image" || p === "twitter:image") push(content, /logo|stemma/i.test(content) ? 4.2 : 1.6, "og:image");
    else if (p === "msapplication-tileimage") push(content, 2.4, "tile");
  }
  // un indirizzo una volta sola, con il punteggio migliore
  const best = new Map<string, LogoCandidate>();
  for (const c of out) if (!best.has(c.url) || best.get(c.url)!.score < c.score) best.set(c.url, c);
  return [...best.values()].sort((x, y) => y.score - x.score);
}

/** il sito della compagnia dedotto dall'e-mail (info@arciericastello.it → https://arciericastello.it), se non è un indirizzo generico */
export function siteFromEmail(email: string) {
  const host = email.trim().toLowerCase().split("@")[1] ?? "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) || MAIL_HOSTS.test(host)) return "";
  return `https://${host.replace(/^(pec|mail|posta)\./, "")}`;
}

export type ImageInfo = { mime: string; w: number; h: number };

const be16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const le16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const be32 = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const le24 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

/** formato e misure di un'immagine dai suoi primi byte (PNG, JPEG, GIF, WebP, SVG, ICO) */
export function imageInfo(b: Uint8Array): ImageInfo | null {
  if (b.length < 16) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", w: be32(b, 16), h: be32(b, 20) };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { mime: "image/gif", w: le16(b, 6), h: le16(b, 8) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = be16(b, i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { mime: "image/jpeg", w: be16(b, i + 7), h: be16(b, i + 5) };
      i += 2 + len;
    }
    return null;
  }
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 && b.length > 30) {
    const kind = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (kind === "VP8X") return { mime: "image/webp", w: 1 + le24(b, 24), h: 1 + le24(b, 27) };
    if (kind === "VP8 ") return { mime: "image/webp", w: le16(b, 26) & 0x3fff, h: le16(b, 28) & 0x3fff };
    if (kind === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { mime: "image/webp", w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return { mime: "image/x-icon", w: b[6] || 256, h: b[7] || 256 };
  const head = new TextDecoder().decode(b.slice(0, 2048)).toLowerCase();
  if (/<svg[\s>]/.test(head)) return { mime: "image/svg+xml", w: 512, h: 512 };
  return null;
}

/** un'immagine fa da stemma se non è minuscola e non è una striscia (testate larghe, banner) */
export function usableLogo(info: ImageInfo | null) {
  if (!info) return false;
  const small = Math.min(info.w, info.h);
  const ratio = Math.max(info.w, info.h) / Math.max(1, small);
  return small >= (info.mime === "image/x-icon" ? 96 : 56) && ratio <= 3.2;
}
