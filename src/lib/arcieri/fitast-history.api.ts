import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { clip, db, ensureMember } from "./access";

/**
 * Storico FITAST: le classifiche delle stagioni passate (dal 2019) lette dal portale dall'app di chi preme
 * «Storico dal 2019». Stanno in una tabella a parte (fitast_history): il campionato in corso resta quello di sempre.
 */

const KINDS = ["generale-squadre", "gara-arcieri", "gara-squadre"] as const;
type Kind = (typeof KINDS)[number];
const optNum = (v: unknown, max: number) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.min(max, Number(v))));

export const saveFitastHistory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { items?: unknown };
    const list = Array.isArray(raw.items) ? raw.items.slice(0, 80) : [];
    return {
      items: list
        .map((item) => {
          const r = (item ?? {}) as Record<string, unknown>;
          const day = String(r.day ?? "").slice(0, 10);
          const kind = String(r.kind ?? "") as Kind;
          // dello storico bastano i podi degli arcieri e le classifiche delle compagnie
          const keep = kind === "gara-arcieri" ? 3 : kind === "gara-squadre" ? 60 : 80;
          const rows = (Array.isArray(r.rows) ? r.rows.slice(0, keep) : [])
            .map((x) => {
              const o = (x ?? {}) as Record<string, unknown>;
              const place = optNum(o.place, 9999);
              return { place: place == null ? null : Math.round(place), name: clip(o.name, 90), team: clip(o.team, 110), score: optNum(o.score, 10_000_000), camp: optNum(o.camp, 10_000_000) };
            })
            .filter((x) => x.name);
          return {
            kind,
            season: clip(r.season, 24).replace(/[^\w-]/g, ""),
            seasonName: clip(r.seasonName, 90),
            garaId: clip(r.garaId, 10).replace(/\D/g, ""),
            garaTitle: clip(r.garaTitle, 140),
            day: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
            category: clip(r.category, 90),
            rows,
          };
        })
        .filter((x) => KINDS.includes(x.kind) && x.season && x.rows.length),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    for (const x of data.items) {
      await sql`
        insert into fitast_history (kind, season, season_name, gara_id, gara_title, held_on, category, rows, updated_by, updated_at)
        values (${x.kind}, ${x.season}, ${x.seasonName}, ${x.garaId}, ${x.garaTitle}, ${x.day}::date, ${x.category}, ${JSON.stringify(x.rows)}::jsonb, ${context.userId}, now())
        on conflict (kind, season, gara_id, category) do update set
          season_name = excluded.season_name,
          gara_title = case when excluded.gara_title <> '' then excluded.gara_title else fitast_history.gara_title end,
          held_on = coalesce(excluded.held_on, fitast_history.held_on), rows = excluded.rows, updated_by = excluded.updated_by, updated_at = now()`;
    }
    return { saved: data.items.length };
  });

/** cosa c'è già nello storico: per stagione, le gare lette (arcieri e squadre) e se c'è la generale compagnie */
export const fitastHistoryIndex = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    try {
      const rows = await sql<{ kind: string; season: string; gara_id: string }>`select distinct kind, season, gara_id from fitast_history`;
      const done = await sql<{ key: string }>`select key from fitast_sync where key like 'storico-%'`;
      return { items: rows.map((r) => ({ kind: r.kind, season: r.season, garaId: r.gara_id })), seasonsDone: done.map((d) => d.key.slice("storico-".length)) };
    } catch {
      return { items: [] as { kind: string; season: string; garaId: string }[], seasonsDone: [] as string[] };
    }
  });

/** una stagione letta per intero: non si riapre più */
export const markHistorySeason = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ season: clip((input as { season?: unknown } | null)?.season, 24).replace(/[^\w-]/g, "") }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    if (!data.season) return { ok: false };
    await sql`insert into fitast_sync (key, at, info) values (${`storico-${data.season}`}, now(), '{}'::jsonb) on conflict (key) do update set at = now()`;
    return { ok: true };
  });
