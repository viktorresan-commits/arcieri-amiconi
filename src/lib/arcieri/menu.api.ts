import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { db, ensureMember, staffLevel } from "./access";

/**
 * Disposizione delle voci nei menu delle sezioni (Prepara, Allena, Gare, Impara, Compagnia), uguale per tutti.
 * La sceglie il fondatore tenendo premuta un'icona e trascinandola; chi non è fondatore la legge soltanto.
 */

const STATIONS = ["prepara", "allena", "gareggia", "impara", "squadra"] as const;
export type MenuLayout = Partial<Record<(typeof STATIONS)[number], string[]>>;

function cleanLayout(raw: unknown): MenuLayout | null {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("Disposizione non valida.");
  const out: MenuLayout = {};
  const seen = new Set<string>();
  for (const st of STATIONS) {
    const list = (raw as Record<string, unknown>)[st];
    if (list == null) continue;
    if (!Array.isArray(list) || list.length > 80) throw new Error("Disposizione non valida.");
    out[st] = list
      .map((v) => String(v))
      .filter((v) => /^[a-z0-9-]{1,40}$/.test(v) && !seen.has(v) && (seen.add(v), true));
  }
  return out;
}

export const getMenuLayout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    try {
      const rows = await sql<{ value: unknown; updated_at: string }>`select value, updated_at::text as updated_at from app_settings where key = 'menu_layout' limit 1`;
      return { layout: rows[0] ? cleanLayout(rows[0].value) : null, updatedAt: rows[0]?.updated_at ?? null };
    } catch {
      // tabella non ancora creata: disposizione originale
      return { layout: null, updatedAt: null };
    }
  });

/** salva la disposizione per tutti (solo il fondatore); null torna a quella originale */
export const saveMenuLayout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ layout: cleanLayout((input as { layout?: unknown } | null)?.layout ?? null) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (staffLevel(me) !== "super") throw new Error("Solo il fondatore può cambiare i menu per tutti.");
    if (!data.layout) {
      await sql`delete from app_settings where key = 'menu_layout'`;
      return { ok: true as const, layout: null };
    }
    await sql`
      insert into app_settings (key, value, updated_by, updated_at)
      values ('menu_layout', ${JSON.stringify(data.layout)}::jsonb, ${context.userId}, now())
      on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
    return { ok: true as const, layout: data.layout };
  });
