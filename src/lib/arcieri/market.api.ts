import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asNum, asNumOrNull, canScore, clip, db, ensureMember } from "./access";
import { myMembership } from "./compagnie.api";

/**
 * Mercatino dell'usato: annunci degli arcieri con foto, video breve, descrizione e posizione.
 * Li vede la propria compagnia; con «tutte le compagnie» spuntato li vedono tutti gli arcieri dell'app.
 * Foto e video arrivano già compressi dal telefono, uno per richiesta.
 */

export type MarketStatus = "open" | "reserved" | "sold";
export type MarketScope = "compagnia" | "tutte" | "mie";
const CONDITIONS = ["nuovo", "come-nuovo", "buono", "usato"] as const;

type Row = {
  id: number; user_id: string; company_id: number | null; equipment_id: number | null; category: string; title: string; description: string;
  qty: number; price_cents: number | null; condition: string; place: string; lat: number | null; lng: number | null; contact: string;
  phone: string | null; whatsapp: string | null; email: string | null;
  everyone: boolean; status: string; thumb: string; video_url: string; created_at: string; updated_at: string;
  given_name: string | null; family_name: string | null; nickname: string | null; company_name: string | null; company_logo: string | null; company_color: string | null;
  photos: number; videos: number;
};

const sellerOf = (r: Row) => r.nickname || [r.given_name, r.family_name].filter(Boolean).join(" ") || "Un arciere";

function itemOf(r: Row, me: string, myCompany: number) {
  return {
    id: asNum(r.id),
    mine: r.user_id === me,
    sameCompany: r.company_id != null && asNum(r.company_id) === myCompany,
    equipmentId: asNumOrNull(r.equipment_id),
    category: r.category,
    title: r.title,
    description: r.description,
    qty: asNum(r.qty, 1),
    priceCents: asNumOrNull(r.price_cents),
    condition: r.condition,
    place: r.place,
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    contact: r.contact,
    phone: r.phone ?? "",
    whatsapp: r.whatsapp ?? "",
    email: r.email ?? "",
    everyone: Boolean(r.everyone),
    status: (["open", "reserved", "sold"].includes(r.status) ? r.status : "open") as MarketStatus,
    thumb: r.thumb,
    videoUrl: r.video_url,
    photos: asNum(r.photos),
    hasVideo: asNum(r.videos) > 0,
    createdAt: new Date(r.created_at).toISOString(),
    seller: sellerOf(r),
    company: r.company_name ?? "",
    companyLogo: r.company_logo ?? "",
    companyColor: r.company_color ?? "",
  };
}
export type MarketItem = ReturnType<typeof itemOf>;

const SELECT = `
  select i.*, m.given_name, m.family_name, m.nickname, c.name as company_name, c.logo_url as company_logo, c.color as company_color,
    (select count(*)::int from market_media x where x.item_id = i.id and x.kind = 'photo') as photos,
    (select count(*)::int from market_media x where x.item_id = i.id and x.kind = 'video') as videos
  from market_items i
  left join members m on m.user_id = i.user_id
  left join companies c on c.id = i.company_id`;

/** un annuncio si vede se è tuo, della tua compagnia, o messo per tutte le compagnie */
async function visible(sql: Awaited<ReturnType<typeof db>>, id: number, userId: string, company: number) {
  const rows = await sql<{ user_id: string; company_id: number | null; everyone: boolean }>`select user_id, company_id, everyone from market_items where id = ${id}`;
  const r = rows[0];
  if (!r) throw new Error("Annuncio non trovato.");
  if (r.user_id !== userId && !(r.company_id != null && asNum(r.company_id) === company) && !r.everyone) throw new Error("Annuncio non visibile.");
  return r;
}

export const listMarket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { scope?: unknown };
    const scope = (["compagnia", "tutte", "mie"].includes(String(raw.scope)) ? String(raw.scope) : "compagnia") as MarketScope;
    return { scope };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    const rows =
      data.scope === "mie"
        ? await sql.query<Row>(`${SELECT} where i.user_id = $1 order by i.updated_at desc limit 120`, [context.userId])
        : data.scope === "tutte"
          ? await sql.query<Row>(`${SELECT} where i.status <> 'sold' and (i.everyone or i.company_id = $1 or i.user_id = $2) order by i.created_at desc limit 120`, [mine.companyId, context.userId])
          : await sql.query<Row>(`${SELECT} where i.status <> 'sold' and (i.company_id = $1 or i.user_id = $2) order by i.created_at desc limit 120`, [mine.companyId, context.userId]);
    return { items: rows.map((r) => itemOf(r, context.userId, mine.companyId)), companyId: mine.companyId };
  });

/** l'annuncio intero con le foto (il video si chiede a parte, è più pesante) */
export const getMarketItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: unknown } | null)?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    await visible(sql, data.id, context.userId, mine.companyId);
    const rows = await sql.query<Row>(`${SELECT} where i.id = $1`, [data.id]);
    if (!rows[0]) throw new Error("Annuncio non trovato.");
    const media = await sql<{ id: number; data: string }>`select id, data from market_media where item_id = ${data.id} and kind = 'photo' order by position, id`;
    return { item: itemOf(rows[0], context.userId, mine.companyId), photos: media.map((m) => ({ id: asNum(m.id), src: m.data })) };
  });

export const getMarketVideo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: unknown } | null)?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    await visible(sql, data.id, context.userId, mine.companyId);
    const rows = await sql<{ id: number; data: string }>`select id, data from market_media where item_id = ${data.id} and kind = 'video' order by id desc limit 1`;
    return rows[0] ? { id: asNum(rows[0].id), src: rows[0].data } : null;
  });

export const saveMarketItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const title = clip(raw.title, 90);
    if (title.length < 3) throw new Error("Scrivi cosa vendi.");
    const thumb = String(raw.thumb ?? "");
    if (thumb && (!thumb.startsWith("data:image/") || thumb.length > 60_000)) throw new Error("Miniatura troppo pesante.");
    const video = clip(raw.videoUrl, 300);
    if (video && !/^https:\/\//i.test(video)) throw new Error("Il link del video deve iniziare con https://");
    const lat = asNumOrNull(raw.lat);
    const lng = asNumOrNull(raw.lng);
    const condition = CONDITIONS.includes(String(raw.condition) as (typeof CONDITIONS)[number]) ? String(raw.condition) : "buono";
    return {
      id: raw.id == null || raw.id === "" ? null : asNum(raw.id),
      equipmentId: raw.equipmentId == null || raw.equipmentId === "" ? null : asNum(raw.equipmentId),
      category: clip(raw.category, 40) || "altro",
      title,
      description: String(raw.description ?? "").slice(0, 2000),
      qty: Math.max(1, Math.min(999, asNum(raw.qty, 1))),
      priceCents: raw.priceCents == null || raw.priceCents === "" ? null : Math.max(0, Math.min(10_000_000, asNum(raw.priceCents))),
      condition,
      place: clip(raw.place, 120),
      // la posizione si tiene approssimata (circa 100 m)
      lat: lat != null && Math.abs(lat) <= 90 ? Math.round(lat * 1000) / 1000 : null,
      lng: lng != null && Math.abs(lng) <= 180 ? Math.round(lng * 1000) / 1000 : null,
      contact: clip(raw.contact, 120),
      phone: clip(raw.phone, 30).replace(/[^\d+ ]/g, "").trim(),
      whatsapp: clip(raw.whatsapp, 30).replace(/[^\d+ ]/g, "").trim(),
      email: /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(clip(raw.email, 120).trim()) ? clip(raw.email, 120).trim() : "",
      everyone: raw.everyone == null ? true : Boolean(raw.everyone),
      thumb,
      videoUrl: video,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    const mine = await myMembership(sql, context.userId);
    if (data.equipmentId) {
      const own = await sql<{ id: number }>`select id from equipment where id = ${data.equipmentId} and user_id = ${context.userId}`;
      if (!own[0]) throw new Error("Questo pezzo non è nel tuo inventario.");
    }
    if (data.id) {
      const rows = await sql<{ id: number }>`
        update market_items set category = ${data.category}, title = ${data.title}, description = ${data.description}, qty = ${data.qty},
          price_cents = ${data.priceCents}, condition = ${data.condition}, place = ${data.place}, lat = ${data.lat}, lng = ${data.lng},
          contact = ${data.contact}, phone = ${data.phone}, whatsapp = ${data.whatsapp}, email = ${data.email},
          everyone = ${data.everyone}, thumb = case when ${data.thumb} = '' then thumb else ${data.thumb} end,
          video_url = ${data.videoUrl}, updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
        returning id`;
      if (!rows[0]) throw new Error("Annuncio non trovato.");
      return { id: asNum(rows[0].id) };
    }
    const rows = await sql<{ id: number }>`
      insert into market_items (user_id, company_id, equipment_id, category, title, description, qty, price_cents, condition, place, lat, lng, contact, phone, whatsapp, email, everyone, thumb, video_url)
      values (${context.userId}, ${mine.companyId}, ${data.equipmentId}, ${data.category}, ${data.title}, ${data.description}, ${data.qty}, ${data.priceCents},
        ${data.condition}, ${data.place}, ${data.lat}, ${data.lng}, ${data.contact}, ${data.phone}, ${data.whatsapp}, ${data.email}, ${data.everyone}, ${data.thumb}, ${data.videoUrl})
      returning id`;
    const id = asNum(rows[0].id);
    // un avviso in Bacheca a chi può vedere l'annuncio: a tutti gli arcieri dell'app se è per tutte le compagnie,
    // altrimenti alla propria compagnia (mai a chi lo mette in vendita)
    try {
      const seller = me.nickname || [me.given_name, me.family_name].filter(Boolean).join(" ") || "Un arciere";
      const companyName = (await sql<{ name: string }>`select name from companies where id = ${mine.companyId}`)[0]?.name ?? "";
      const price = data.priceCents != null ? ` · ${(data.priceCents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}` : "";
      const title = `Nuovo nel mercatino: ${data.title}`;
      const body = `${seller}${companyName ? ` (${companyName})` : ""} l'ha messo in vendita${price}.`;
      const href = `/squadra#mercatino-${id}`;
      if (data.everyone) {
        await sql`
          insert into notifications (user_id, title, body, href, dedupe)
          select m.user_id, ${title}, ${body}, ${href}, ${`market-new-${id}-`} || m.user_id
          from members m where m.user_id is not null and m.status = 'active' and m.user_id <> ${context.userId}
          on conflict (dedupe) do nothing`;
      } else if (mine.companyId) {
        await sql`
          insert into notifications (user_id, title, body, href, dedupe)
          select cm.user_id, ${title}, ${body}, ${href}, ${`market-new-${id}-`} || cm.user_id
          from company_members cm where cm.company_id = ${mine.companyId} and cm.user_id <> ${context.userId}
          on conflict (dedupe) do nothing`;
      }
    } catch {
      /* l'annuncio è salvato anche se l'avviso non parte */
    }
    return { id };
  });

/** una foto (fino a 6) o un video breve per annuncio, già compressi sul telefono */
export const addMarketMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const kind = raw.kind === "video" ? "video" : "photo";
    const data = String(raw.data ?? "");
    if (kind === "photo" && (!data.startsWith("data:image/") || data.length > 450_000)) throw new Error("Foto troppo pesante.");
    if (kind === "video" && (!data.startsWith("data:video/") || data.length > 3_600_000)) throw new Error("Video troppo pesante: tienilo sotto i 20 secondi.");
    return { itemId: asNum(raw.itemId), kind, data };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const own = await sql<{ id: number }>`select id from market_items where id = ${data.itemId} and user_id = ${context.userId}`;
    if (!own[0]) throw new Error("Annuncio non trovato.");
    if (data.kind === "photo") {
      const n = await sql<{ n: number }>`select count(*)::int as n from market_media where item_id = ${data.itemId} and kind = 'photo'`;
      if (asNum(n[0]?.n) >= 6) throw new Error("Al massimo 6 foto per annuncio.");
    } else {
      await sql`delete from market_media where item_id = ${data.itemId} and kind = 'video'`;
    }
    const rows = await sql<{ id: number }>`
      insert into market_media (item_id, kind, data, position)
      values (${data.itemId}, ${data.kind}, ${data.data}, coalesce((select max(position) + 1 from market_media where item_id = ${data.itemId}), 0))
      returning id`;
    await sql`update market_items set updated_at = now() where id = ${data.itemId}`;
    return { id: asNum(rows[0].id) };
  });

export const removeMarketMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: unknown } | null)?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    await sql`delete from market_media where id = ${data.id} and item_id in (select id from market_items where user_id = ${context.userId})`;
    return { ok: true as const };
  });

/**
 * Disponibile, riservato o venduto. Venduto: se l'annuncio viene dall'inventario, i pezzi venduti
 * si tolgono dalla quantità; se non ne restano, il pezzo passa a «fermo».
 */
export const setMarketStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const status = (["open", "reserved", "sold"].includes(String(raw.status)) ? String(raw.status) : "open") as MarketStatus;
    return { id: asNum(raw.id), status };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<{ id: number; status: string; equipment_id: number | null; qty: number }>`
      select id, status, equipment_id, qty from market_items where id = ${data.id} and user_id = ${context.userId}`;
    const item = rows[0];
    if (!item) throw new Error("Annuncio non trovato.");
    await sql`update market_items set status = ${data.status}, updated_at = now() where id = ${data.id}`;
    let left: number | null = null;
    if (data.status === "sold" && item.status !== "sold" && item.equipment_id) {
      const eq = await sql<{ specs: string }>`select specs from equipment where id = ${item.equipment_id} and user_id = ${context.userId}`;
      if (eq[0]) {
        let specs: Record<string, string> = {};
        try {
          specs = JSON.parse(eq[0].specs || "{}") as Record<string, string>;
        } catch {
          specs = {};
        }
        const had = Number(specs.qty) || 1;
        left = Math.max(0, had - asNum(item.qty, 1));
        specs.qty = String(left);
        specs.sold = String((Number(specs.sold) || 0) + asNum(item.qty, 1));
        await sql`update equipment set specs = ${JSON.stringify(specs)}, status = case when ${left} = 0 then 'unused' else status end where id = ${item.equipment_id} and user_id = ${context.userId}`;
      }
    }
    return { ok: true as const, left };
  });

export const deleteMarketItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: unknown } | null)?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const own = await sql<{ id: number }>`select id from market_items where id = ${data.id} and user_id = ${context.userId}`;
    if (!own[0]) throw new Error("Annuncio non trovato.");
    await sql`delete from market_media where item_id = ${data.id}`;
    await sql`delete from market_items where id = ${data.id}`;
    return { ok: true as const };
  });

/**
 * Scrivi al venditore: un avviso nella sua Bacheca con il tuo messaggio e come risponderti.
 * Al massimo un messaggio ogni dieci minuti per annuncio.
 */
export const contactSeller = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const text = String(raw.text ?? "").trim().slice(0, 600);
    if (text.length < 2) throw new Error("Scrivi il messaggio.");
    return { id: asNum(raw.id), text, reply: clip(raw.reply, 120).trim() };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    const item = await visible(sql, data.id, context.userId, mine.companyId);
    if (item.user_id === context.userId) throw new Error("È un tuo annuncio.");
    const t = (await sql<{ title: string }>`select title from market_items where id = ${data.id}`)[0]?.title ?? "il tuo annuncio";
    const who = me.nickname || [me.given_name, me.family_name].filter(Boolean).join(" ") || "Un arciere";
    const companyName = (await sql<{ name: string }>`select name from companies where id = ${mine.companyId}`)[0]?.name ?? "";
    const slot = Math.floor(Date.now() / 600_000);
    const rows = await sql<{ id: number }>`
      insert into notifications (user_id, title, body, href, dedupe)
      values (${item.user_id}, ${`${who} ti scrive per «${t}»`}, ${`${data.text}${data.reply ? ` · Rispondi a: ${data.reply}` : ""}${companyName ? ` · ${companyName}` : ""}`}, ${`/squadra#mercatino-${data.id}`}, ${`market-msg-${data.id}-${context.userId}-${slot}`})
      on conflict (dedupe) do nothing
      returning id`;
    if (!rows[0]) throw new Error("Hai già scritto da poco: aspetta qualche minuto.");
    return { ok: true as const };
  });
