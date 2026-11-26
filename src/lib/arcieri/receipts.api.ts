import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asNum, asNumOrNull, canScore, clip, db, ensureMember } from "./access";

/**
 * Scontrini e fatture degli acquisti: la foto ridotta, il negozio, la data e il totale; le righe
 * diventano voci "prese" della lista della spesa (contano in «Già spesi»), legate allo scontrino.
 */
export const listReceipts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<{ id: number; store: string; day: string | null; total_cents: number | null; discount_cents: number | null; photo: string; items: number }>`
      select r.id, r.store, r.day::text as day, r.total_cents, r.discount_cents, r.photo,
        (select count(*)::int from shopping_items s where s.receipt_id = r.id) as items
      from receipts r where r.user_id = ${context.userId}
      order by coalesce(r.day, r.created_at::date) desc, r.id desc
      limit 60`.catch(() => []);
    return rows.map((r) => ({ id: asNum(r.id), store: r.store, day: r.day ? String(r.day).slice(0, 10) : null, totalCents: asNumOrNull(r.total_cents), discountCents: asNumOrNull(r.discount_cents), photo: r.photo, items: asNum(r.items) }));
  });

export const saveReceipt = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const photo = typeof raw.photo === "string" ? raw.photo : "";
    if (photo && (!photo.startsWith("data:image/") || photo.length > 400_000)) throw new Error("Foto dello scontrino troppo pesante.");
    const day = clip(raw.day, 10);
    if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Data dello scontrino non valida.");
    const list = Array.isArray(raw.items) ? raw.items.slice(0, 40) : [];
    const items = list
      .map((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        return {
          name: clip(o.name, 80),
          category: clip(o.category, 40) || "altro",
          qty: Math.max(1, Math.min(99, asNum(o.qty, 1))),
          priceCents: o.priceCents == null || o.priceCents === "" ? null : Math.max(0, Math.min(10_000_000, asNum(o.priceCents))),
        };
      })
      .filter((x) => x.name.length >= 2);
    const total = raw.totalCents == null || raw.totalCents === "" ? null : Math.max(0, Math.min(100_000_000, asNum(raw.totalCents)));
    if (!items.length && total == null) throw new Error("Scrivi almeno il totale o una riga.");
    const discount = raw.discountCents == null || raw.discountCents === "" ? null : Math.max(0, Math.min(100_000_000, asNum(raw.discountCents)));
    return { store: clip(raw.store, 80), day: day || null, totalCents: total, discountCents: discount || null, photo, items };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    const rows = await sql<{ id: number }>`
      insert into receipts (user_id, store, day, total_cents, discount_cents, photo)
      values (${context.userId}, ${data.store}, ${data.day}::date, ${data.totalCents}, ${data.discountCents}, ${data.photo})
      returning id`;
    const id = asNum(rows[0].id);
    // senza righe lette: una voce sola con il totale
    const items = data.items.length ? data.items : [{ name: data.store ? `Spesa da ${data.store}` : "Spesa", category: "altro", qty: 1, priceCents: data.totalCents }];
    const note = ["Scontrino", data.store, data.day ? data.day.split("-").reverse().join("/") : ""].filter(Boolean).join(" · ");
    const ids: number[] = [];
    for (const it of items) {
      const r = await sql<{ id: number }>`
        insert into shopping_items (user_id, visibility, name, category, qty, price_cents, url, priority, notes, status, size_label, receipt_id)
        values (${context.userId}, 'personal', ${it.name}, ${it.category}, ${it.qty}, ${it.priceCents}, '', 'normal', ${note}, 'bought', '', ${id})
        returning id`;
      ids.push(asNum(r[0].id));
    }
    return { id, itemIds: ids };
  });

export const deleteReceipt = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: number })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const own = await sql<{ id: number }>`select id from receipts where id = ${data.id} and user_id = ${context.userId}`;
    if (!own[0]) throw new Error("Scontrino non trovato.");
    await sql`delete from shopping_items where receipt_id = ${data.id} and user_id = ${context.userId}`;
    await sql`delete from receipts where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });
