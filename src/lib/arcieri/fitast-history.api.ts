import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asNum, clip, db, ensureMember } from "./access";
import type { RankRow } from "./fitast-league";

/**
 * Storico FITAST dal 2019: le classifiche delle stagioni finite lette dal portale dall'app di chi preme
 * «Scansiona tutto dal 2019». Stanno in una tabella a parte (fitast_history): il campionato in corso resta
 * quello di sempre. Le classifiche lette per intero hanno v = 2; quelle vecchie o lette a metà si rileggono.
 */

const KINDS = ["generale-squadre", "generale-arcieri", "gara-arcieri", "gara-squadre"] as const;
type Kind = (typeof KINDS)[number];
const optNum = (v: unknown, max: number) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.min(max, Number(v))));
/** righe tenute per ogni classifica: tutte (le gare hanno al massimo qualche centinaio di arcieri per categoria) */
const KEEP: Record<Kind, number> = { "generale-squadre": 120, "generale-arcieri": 800, "gara-arcieri": 500, "gara-squadre": 120 };
/** chiave di stagione letta per intero (la vecchia «storico-» teneva solo i primi tre: si rilegge) */
const DONE_KEY = "storico2-";
/** segno che la scansione ha letto tutte le stagioni finite del portale */
export const ALL_DONE = "_tutto";

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
          const rows = (Array.isArray(r.rows) ? r.rows.slice(0, KEEP[kind] ?? 0) : [])
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
            // letta per intero (tutte le categorie): non si rilegge più
            v: r.complete === false ? 1 : 2,
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
        insert into fitast_history (kind, season, season_name, gara_id, gara_title, held_on, category, rows, v, updated_by, updated_at)
        values (${x.kind}, ${x.season}, ${x.seasonName}, ${x.garaId}, ${x.garaTitle}, ${x.day}::date, ${x.category}, ${JSON.stringify(x.rows)}::jsonb, ${x.v}, ${context.userId}, now())
        on conflict (kind, season, gara_id, category) do update set
          season_name = excluded.season_name,
          gara_title = case when excluded.gara_title <> '' then excluded.gara_title else fitast_history.gara_title end,
          held_on = coalesce(excluded.held_on, fitast_history.held_on), rows = excluded.rows, v = excluded.v,
          updated_by = excluded.updated_by, updated_at = now()`;
    }
    return { saved: data.items.length };
  });

/** cosa c'è già, letto per intero: per stagione le gare (arcieri e squadre) e le generali; le stagioni finite */
export const fitastHistoryIndex = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    try {
      const rows = await sql<{ kind: string; season: string; gara_id: string }>`select distinct kind, season, gara_id from fitast_history where v >= 2`;
      const done = await sql<{ key: string }>`select key from fitast_sync where key like ${`${DONE_KEY}%`}`;
      return { items: rows.map((r) => ({ kind: r.kind, season: r.season, garaId: r.gara_id })), seasonsDone: done.map((d) => d.key.slice(DONE_KEY.length)) };
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
    await sql`insert into fitast_sync (key, at, info) values (${`${DONE_KEY}${data.season}`}, now(), '{}'::jsonb) on conflict (key) do update set at = now()`;
    return { ok: true };
  });

// ——— Albo d'oro: quello che lo storico ha salvato, stagione per stagione ———

export type ArchiveBoard = { category: string; rows: RankRow[]; /** righe salvate in tutta la classifica */ total: number };
export type ArchiveGara = { id: string; title: string; day: string; arcieri: ArchiveBoard[]; squadre: ArchiveBoard[] };
export type ArchiveSeasonInfo = { season: string; seasonName: string; from: string; to: string; gare: number; done: boolean };

/** le stagioni nell'archivio, dalla più recente, e quante gare e righe ci sono */
export const fitastArchive = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    try {
      const rows = await sql<{ season: string; season_name: string; first: string | null; last: string | null; gare: number; arcieri: number }>`
        select season, max(season_name) as season_name, min(held_on)::text as first, max(held_on)::text as last,
          count(distinct gara_id) filter (where gara_id <> '')::int as gare,
          coalesce(sum(jsonb_array_length(rows)) filter (where kind in ('gara-arcieri', 'generale-arcieri')), 0)::int as arcieri
        from fitast_history group by season`;
      const done = await sql<{ key: string; at: string }>`select key, at::text as at from fitast_sync where key like ${`${DONE_KEY}%`}`;
      const doneSet = new Set(done.map((d) => d.key.slice(DONE_KEY.length)));
      const seasons: ArchiveSeasonInfo[] = rows
        .map((r) => ({ season: r.season, seasonName: r.season_name, from: r.first ?? "", to: r.last ?? "", gare: asNum(r.gare), done: doneSet.has(r.season) }))
        .sort((a, b) => (b.to || b.season).localeCompare(a.to || a.season));
      const lastDone = done.reduce((m, d) => (d.at > m ? d.at : m), "");
      // «_tutto»: una scansione è arrivata in fondo a tutte le stagioni del portale
      return { seasons, gare: seasons.reduce((t, s) => t + s.gare, 0), archers: rows.reduce((t, r) => t + asNum(r.arcieri), 0), lastDone, complete: doneSet.has(ALL_DONE) };
    } catch {
      return { seasons: [] as ArchiveSeasonInfo[], gare: 0, archers: 0, lastDone: "", complete: false };
    }
  });

/**
 * Una stagione dell'archivio: le classifiche generali (compagnie intere, arcieri sul podio) e, per ogni gara,
 * i podi degli arcieri per categoria e i primi tre delle compagnie. Il resto delle righe resta nel database.
 */
export const fitastArchiveSeason = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ season: clip((input as { season?: unknown } | null)?.season, 24).replace(/[^\w-]/g, "") }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const empty = { season: data.season, seasonName: "", genSq: [] as ArchiveBoard[], genAr: [] as ArchiveBoard[], gare: [] as ArchiveGara[] };
    if (!data.season) return empty;
    // i primi tre (posto 1-3; se il posto non c'è, le prime tre righe): basta per i podi e la risposta resta leggera
    const rows = await sql<{ kind: string; season_name: string; gara_id: string; gara_title: string; held_on: string | null; category: string; rows: RankRow[]; total: number }>`
      select kind, season_name, gara_id, gara_title, held_on::text as held_on, category, jsonb_array_length(rows)::int as total,
        case when kind = 'generale-squadre' then rows
          else coalesce(nullif(jsonb_path_query_array(rows, '$[*] ? (@.place <= 3)'), '[]'::jsonb), jsonb_path_query_array(rows, '$[0 to 2]')) end as rows
      from fitast_history where season = ${data.season}
      order by held_on desc nulls last, kind, category`;
    const out = { ...empty, seasonName: rows[0]?.season_name ?? "" };
    const gare = new Map<string, ArchiveGara>();
    for (const r of rows) {
      const board: ArchiveBoard = { category: r.category, rows: Array.isArray(r.rows) ? r.rows : [], total: asNum(r.total) };
      if (r.kind === "generale-squadre") out.genSq.push(board);
      else if (r.kind === "generale-arcieri") out.genAr.push(board);
      else {
        const g = gare.get(r.gara_id) ?? { id: r.gara_id, title: r.gara_title, day: r.held_on ?? "", arcieri: [], squadre: [] };
        (r.kind === "gara-arcieri" ? g.arcieri : g.squadre).push(board);
        g.title ||= r.gara_title;
        g.day ||= r.held_on ?? "";
        gare.set(r.gara_id, g);
      }
    }
    out.gare = [...gare.values()].sort((a, b) => b.day.localeCompare(a.day));
    return out;
  });
