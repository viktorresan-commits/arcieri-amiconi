/**
 * Aspetto dell'arciere di ogni account: lo salva chi lo personalizza, lo vedono tutti
 * sul podio e nelle classifiche.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { db, ensureMember } from "./access";
import { AVATAR_DEFAULT } from "./avatar";

/** Tiene solo le voci conosciute, con testi corti o vero/falso. */
function cleanLook(raw: unknown) {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, string | boolean> = {};
  for (const [key, def] of Object.entries(AVATAR_DEFAULT)) {
    const v = src[key];
    if (typeof def === "boolean" && typeof v === "boolean") out[key] = v;
    else if (typeof def === "string" && typeof v === "string" && v.length <= 24 && /^[#a-zA-Z0-9 _-]*$/.test(v)) out[key] = v;
  }
  return out;
}

export const saveAvatar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ look: cleanLook((input as { look?: unknown } | null)?.look) }))
  .handler(async ({ data, context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    await sql`
      insert into avatars (user_id, look, updated_at)
      values (${context.userId}, ${JSON.stringify(data.look)}::jsonb, now())
      on conflict (user_id) do update set look = excluded.look, updated_at = now()`;
    return { ok: true };
  });

export const listAvatars = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<{ user_id: string; look: unknown }>`select user_id, look from avatars`;
    const out: Record<string, Record<string, string | boolean>> = {};
    for (const r of rows) out[r.user_id] = cleanLook(typeof r.look === "string" ? JSON.parse(r.look) : r.look);
    return out;
  });
