import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { categoryLabel, euro } from "@/lib/arcieri/labels";

/**
 * Anteprima pubblica di un annuncio del Mercatino, per condividerlo fuori dall'app.
 * WhatsApp, Facebook, Telegram e le e-mail leggono i tag og: e mostrano la scheda con la foto.
 * Si apre solo con il codice del link: mostra l'oggetto (foto, prezzo, stato, luogo, descrizione),
 * mai chi vende né i suoi contatti. Con ?foto=N risponde con la foto N dell'annuncio.
 */

const CONDITION: Record<string, string> = { nuovo: "Nuovo", "come-nuovo": "Come nuovo", buono: "Buono", usato: "Usato" };
const STATUS: Record<string, { label: string; tone: string }> = {
  open: { label: "Disponibile", tone: "#2fbf71" },
  reserved: { label: "Riservato", tone: "#e3a21a" },
  sold: { label: "Venduto", tone: "#8a949c" },
};
const APK_URL = "https://github.com/viktorresan-commits/arcieri-amiconi/releases/latest/download/arcieri-amiconi.apk";

type Ad = {
  id: number; title: string; description: string; qty: number; price_cents: number | null; condition: string; place: string;
  status: string; category: string; company_name: string | null; photos: number;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function originOf(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}

function page(title: string, head: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><meta name="theme-color" content="#0c1210"><title>${esc(title)}</title>${head}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700&family=Outfit:wght@400;500;600&display=swap">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
*{box-sizing:border-box}html,body{margin:0;background:#0c1210;color:#f3f0e8;font-family:Outfit,system-ui,sans-serif}
main{max-width:34rem;margin:0 auto;padding:max(env(safe-area-inset-top),.75rem) 1rem 2.5rem}
.brand{display:flex;align-items:center;gap:.55rem;padding:.4rem 0 .9rem;color:#c9d2c9;font-size:.85rem;text-decoration:none}
.brand b{font-family:"Barlow Condensed",sans-serif;font-size:1.15rem;letter-spacing:.02em;color:#f3f0e8}
.photos{display:flex;gap:.5rem;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -1rem;padding:0 1rem;scrollbar-width:none}
.photos img{height:min(70vw,22rem);max-width:88vw;border-radius:1.1rem;object-fit:cover;scroll-snap-align:center;flex:none;background:#18211c}
.empty{display:grid;place-items:center;height:12rem;border-radius:1.1rem;background:#16201a;color:#8fa093;font-size:.9rem}
h1{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:2rem;line-height:1.05;margin:1.1rem 0 .35rem}
.row{display:flex;align-items:flex-end;justify-content:space-between;gap:.75rem}
.price{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:2.6rem;line-height:1;font-variant-numeric:tabular-nums}
.meta{color:#a9b5ab;font-size:.85rem;margin-top:.3rem}
.pill{border-radius:99px;padding:.3rem .7rem;font-size:.72rem;font-weight:700;color:#0b120e;white-space:nowrap}
.place{display:flex;gap:.5rem;align-items:center;margin-top:.9rem;padding:.6rem .8rem;border-radius:.8rem;background:rgba(255,255,255,.05);font-size:.92rem}
p.desc{white-space:pre-line;line-height:1.55;font-size:.95rem;margin:1rem 0 0}
.box{margin-top:1.4rem;padding:1rem;border-radius:1.1rem;background:#16201a;border:1px solid rgba(255,255,255,.07)}
.box p{margin:0 0 .8rem;font-size:.9rem;line-height:1.45;color:#c9d2c9}
.btn{display:flex;align-items:center;justify-content:center;min-height:3rem;border-radius:.85rem;font-weight:600;text-decoration:none;font-size:.95rem}
.btn+.btn{margin-top:.5rem}.main{background:#3d8f5f;color:#f3f7f4}.ghost{border:1px solid rgba(255,255,255,.16);color:#f3f0e8}
a:focus-visible{outline:2px solid #e0c36a;outline-offset:2px}
</style></head><body><main>
<a class="brand" href="/"><svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" fill="#f3f0e8"/><circle cx="13" cy="13" r="9" fill="#1d1d1d"/><circle cx="13" cy="13" r="6.5" fill="#3a7fd0"/><circle cx="13" cy="13" r="4" fill="#d4402f"/><circle cx="13" cy="13" r="1.8" fill="#f2c230"/></svg><span><b>Arcieri Amiconi</b> · Mercatino</span></a>
${body}
</main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120", "x-robots-tag": "noindex", "referrer-policy": "strict-origin-when-cross-origin" },
  });
}

function gone(origin: string) {
  return page(
    "Annuncio non disponibile · Arcieri Amiconi",
    `<meta property="og:title" content="Mercatino · Arcieri Amiconi"><meta property="og:image" content="${esc(origin)}/og.jpg">`,
    `<div class="box"><p>Questo annuncio non c'è più: chi lo vendeva l'ha tolto dal Mercatino.</p><a class="btn main" href="/squadra#mercatino">Guarda il Mercatino nell'app</a></div>`,
    404,
  );
}

export const Route = createFileRoute("/api/annuncio/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const token = String(params.token ?? "");
        const origin = originOf(request);
        if (!/^[a-z0-9]{8,16}$/.test(token)) return gone(origin);
        const sql = await getSql();
        const rows = await sql<Ad>`
          select i.id, i.title, i.description, i.qty, i.price_cents, i.condition, i.place, i.status, i.category, c.name as company_name,
            (select count(*)::int from market_media x where x.item_id = i.id and x.kind = 'photo') as photos
          from market_items i left join companies c on c.id = i.company_id
          where i.share_token = ${token} limit 1`;
        const ad = rows[0];
        if (!ad) return gone(origin);
        const photos = Number(ad.photos) || 0;

        // la foto N dell'annuncio (la usano le anteprime di WhatsApp e Facebook)
        const foto = new URL(request.url).searchParams.get("foto");
        if (foto != null) {
          const n = Math.max(0, Math.min(11, Number(foto) || 0));
          const media = await sql<{ data: string }>`select data from market_media where item_id = ${ad.id} and kind = 'photo' order by position, id offset ${n} limit 1`;
          const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(media[0]?.data ?? "");
          if (!m) return new Response("", { status: 404 });
          return new Response(new Uint8Array(Buffer.from(m[2], "base64")), {
            headers: { "content-type": m[1], "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff", "x-robots-tag": "noindex" },
          });
        }

        const price = ad.price_cents != null ? euro(Number(ad.price_cents)) : "Prezzo da chiedere";
        const st = STATUS[ad.status] ?? STATUS.open;
        const cond = CONDITION[ad.condition] ?? ad.condition;
        const qty = Number(ad.qty) > 1 ? `${ad.qty} pezzi · ` : "";
        const link = `${origin}/api/annuncio/${token}`;
        const image = photos ? `${origin}/api/annuncio/${token}?foto=0` : `${origin}/og.jpg`;
        const summary = [ad.price_cents != null ? price : "", cond, ad.place, st.label !== "Disponibile" ? st.label : ""].filter(Boolean).join(" · ");
        const short = ad.description.replace(/\s+/g, " ").trim().slice(0, 160);
        const ogDesc = `${summary}${short ? ` — ${short}` : ""}`;
        const ogTitle = `${ad.title}${ad.price_cents != null ? ` · ${price}` : ""}`;

        const head = [
          `<meta name="description" content="${esc(ogDesc)}">`,
          `<meta property="og:type" content="website">`,
          `<meta property="og:site_name" content="Mercatino · Arcieri Amiconi">`,
          `<meta property="og:title" content="${esc(ogTitle)}">`,
          `<meta property="og:description" content="${esc(ogDesc)}">`,
          `<meta property="og:url" content="${esc(link)}">`,
          `<meta property="og:image" content="${esc(image)}">`,
          `<meta property="og:image:alt" content="${esc(ad.title)}">`,
          `<meta property="og:locale" content="it_IT">`,
          `<meta name="twitter:card" content="summary_large_image">`,
        ].join("");

        const gallery = photos
          ? `<div class="photos">${Array.from({ length: Math.min(photos, 12) }, (_, i) => `<img src="/api/annuncio/${token}?foto=${i}" alt="${esc(ad.title)}, foto ${i + 1}"${i ? ' loading="lazy"' : ""}>`).join("")}</div>`
          : `<div class="empty">${esc(categoryLabel(ad.category))} senza foto</div>`;
        const body = `${gallery}
<h1>${esc(ad.title)}</h1>
<div class="row"><div><div class="price">${esc(price)}</div><div class="meta">${esc(qty)}${esc(cond)} · ${esc(categoryLabel(ad.category))}${ad.company_name ? ` · ${esc(ad.company_name)}` : ""}</div></div><span class="pill" style="background:${st.tone}">${st.label}</span></div>
${ad.place ? `<div class="place"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a9b5ab" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>${esc(ad.place)}</div>` : ""}
${ad.description ? `<p class="desc">${esc(ad.description)}</p>` : ""}
<div class="box"><p>Questo annuncio è nel Mercatino dell'app Arcieri Amiconi. Per scrivere a chi lo vende entra nell'app: trovi telefono, WhatsApp ed e-mail.</p>
<a class="btn main" href="/squadra#mercatino-${ad.id}">Apri l'annuncio nell'app</a>
<a class="btn ghost" href="${APK_URL}">Scarica l'app per Android</a></div>`;
        return page(`${ad.title} · Mercatino Arcieri Amiconi`, head, body);
      },
    },
  },
});
