import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { asNum, clip, db, ensureMember } from "./access";
import { generaleFp, teamKey, teamWords, type RankRow } from "./fitast-league";

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
/** la scansione delle gare per numero (quando il portale non apre le stagioni passate) */
const CURSOR = "_cursore";

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
      const json = JSON.stringify(x.rows);
      const saved = await sql<{ id: number }>`
        insert into fitast_history (kind, season, season_name, gara_id, gara_title, held_on, category, rows, v, updated_by, updated_at)
        values (${x.kind}, ${x.season}, ${x.seasonName}, ${x.garaId}, ${x.garaTitle}, ${x.day}::date, ${x.category}, ${json}::jsonb, ${x.v}, ${context.userId}, now())
        on conflict (kind, season, gara_id, category) do update set
          season_name = excluded.season_name,
          gara_title = case when excluded.gara_title <> '' then excluded.gara_title else fitast_history.gara_title end,
          held_on = coalesce(excluded.held_on, fitast_history.held_on), rows = excluded.rows, v = excluded.v,
          updated_by = excluded.updated_by, updated_at = now()
        returning id`;
      const id = saved[0]?.id;
      if (id == null) continue;
      // le righe con le parole dei nomi: i profili le cercano con l'indice
      await sql`delete from fitast_history_rows where history_id = ${id}`.catch(() => []);
      await sql`
        insert into fitast_history_rows (history_id, kind, season, gara_id, pos, total, words, row)
        select ${id}, ${x.kind}, ${x.season}, ${x.garaId}, x.n::int, ${x.rows.length},
          array(select w from unnest(regexp_split_to_array(upper(translate(coalesce(x.v->>'name', ''), 'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑàáâãäåèéêëìíîïòóôõöùúûüçñ', 'AAAAAAEEEEIIIIOOOOOUUUUCNaaaaaaeeeeiiiiooooouuuucn')), '[^A-Z]+')) w where length(w) > 1),
          x.v
        from jsonb_array_elements(${json}::jsonb) with ordinality as x(v, n)`.catch(() => []);
    }
    return { saved: data.items.length };
  });

/** cosa c'è già, letto per intero: per stagione le gare (arcieri e squadre) e le generali; le stagioni finite */
type GenFp = { id: number | null; kind: string; season: string; season_name: string | null; total: number; top: RankRow[] | null };
/**
 * Classifiche generali da non credere: la stessa classifica (tipo, righe, prime cinque con i punti) salvata per più
 * stagioni, o uguale alla generale del campionato in corso. Aperta una stagione passata, il portale a volte dà la
 * generale di oggi: così ogni stagione mostrava gli stessi arcieri con gli stessi punti. Non si cancella niente:
 * si nascondono, e la scansione le rilegge (con il controllo della stagione).
 */
async function generalFps(sql: Sql) {
  const hist = await sql<GenFp>`
    select id, kind, season, season_name, jsonb_array_length(rows)::int as total, jsonb_path_query_array(rows, '$[0 to 4]') as top
    from fitast_history where kind in ('generale-arcieri', 'generale-squadre')`.catch(() => [] as GenFp[]);
  const cur = await sql<GenFp>`
    select null::int as id, kind, season, season_name, jsonb_array_length(rows)::int as total, jsonb_path_query_array(rows, '$[0 to 4]') as top
    from fitast_standings where kind in ('generale-arcieri', 'generale-squadre')`.catch(() => [] as GenFp[]);
  const fpOf = (g: GenFp) => (Array.isArray(g.top) && g.top.length >= 2 ? generaleFp(g.kind, g.top, asNum(g.total)) : "");
  // la stessa stagione può avere chiavi scritte in modo diverso nelle due tabelle: conta anche il nome
  const nameOf = (g: GenFp) => String(g.season_name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const seasonsOf = new Map<string, Set<string>>();
  const named = new Map<string, { season: string; name: string }[]>();
  for (const g of [...hist, ...cur]) {
    const k = fpOf(g);
    if (!k) continue;
    const list = named.get(k) ?? [];
    if (!list.some((x) => x.season === g.season || (x.name && x.name === nameOf(g)))) list.push({ season: g.season, name: nameOf(g) });
    named.set(k, list);
    const set = seasonsOf.get(k) ?? new Set<string>();
    set.add(g.season);
    seasonsOf.set(k, set);
  }
  const bad = new Set<number>();
  const badSeasons = new Set<string>();
  for (const g of hist) {
    const k = fpOf(g);
    if (k && (named.get(k)?.length ?? 0) > 1) {
      bad.add(asNum(g.id));
      badSeasons.add(g.season);
    }
  }
  return { bad, badSeasons, fps: [...seasonsOf].map(([fp, ss]) => ({ fp, seasons: [...ss] })) };
}

export const fitastHistoryIndex = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    // le classifiche salvate senza le righe dei nomi (per esempio durante un aggiornamento dell'app): si completano
    await sql`
      insert into fitast_history_rows (history_id, kind, season, gara_id, pos, total, words, row)
      select h.id, h.kind, h.season, h.gara_id, x.n::int, jsonb_array_length(h.rows)::int,
        array(select w from unnest(regexp_split_to_array(upper(translate(coalesce(x.v->>'name', ''), 'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑàáâãäåèéêëìíîïòóôõöùúûüçñ', 'AAAAAAEEEEIIIIOOOOOUUUUCNaaaaaaeeeeiiiiooooouuuucn')), '[^A-Z]+')) w where length(w) > 1),
        x.v
      from fitast_history h
      cross join lateral jsonb_array_elements(h.rows) with ordinality as x(v, n)
      where not exists (select 1 from fitast_history_rows r where r.history_id = h.id)`.catch(() => []);
    try {
      const rows = await sql<{ kind: string; season: string; gara_id: string }>`select distinct kind, season, gara_id from fitast_history where v >= 2`;
      const done = await sql<{ key: string; info: { id?: number; done?: boolean } | null }>`select key, info from fitast_sync where key like ${`${DONE_KEY}%`}`;
      const cur = done.find((d) => d.key === `${DONE_KEY}${CURSOR}`)?.info ?? null;
      // stagioni con una generale dubbia: si riaprono per rileggerla (le gare già salvate restano)
      const g = await generalFps(sql);
      return {
        items: rows.filter((r) => !(r.kind.startsWith("generale") && g.badSeasons.has(r.season))).map((r) => ({ kind: r.kind, season: r.season, garaId: r.gara_id })),
        seasonsDone: done.map((d) => d.key.slice(DONE_KEY.length)).filter((k) => k !== CURSOR && !g.badSeasons.has(k)),
        /** impronte delle generali già salvate (e di quella in corso), con le loro stagioni */
        generali: g.fps,
        /** scansione delle gare per numero: fin dove è arrivata */
        cursor: cur && Number.isFinite(Number(cur.id)) ? { id: Number(cur.id), done: Boolean(cur.done) } : null,
      };
    } catch {
      return { items: [] as { kind: string; season: string; garaId: string }[], seasonsDone: [] as string[], generali: [] as { fp: string; seasons: string[] }[], cursor: null as { id: number; done: boolean } | null };
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

/** fin dove è arrivata la scansione delle gare per numero, per riprendere da lì */
export const setHistoryCursor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as { id?: unknown; done?: unknown };
    return { id: Math.max(0, Math.min(1_000_000, Math.round(Number(r.id) || 0))), done: r.done === true };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    await sql`insert into fitast_sync (key, at, info) values (${`${DONE_KEY}${CURSOR}`}, now(), ${JSON.stringify(data)}::jsonb)
      on conflict (key) do update set at = now(), info = excluded.info`;
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
      const doneSet = new Set(done.map((d) => d.key.slice(DONE_KEY.length)).filter((k) => k !== CURSOR));
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
    const empty = {
      season: data.season,
      seasonName: "",
      genSq: [] as ArchiveBoard[],
      genAr: [] as ArchiveBoard[],
      gare: [] as ArchiveGara[],
      /** generali nascoste perché uguali a quelle di un'altra stagione */
      hidden: { sq: 0, ar: 0 },
      /** generale arcieri rifatta sommando i punti campionato delle gare salvate (quella del portale manca) */
      rebuilt: false,
    };
    if (!data.season) return empty;
    const bad = (await generalFps(sql)).bad;
    // i primi tre (posto 1-3; se il posto non c'è, le prime tre righe): basta per i podi e la risposta resta leggera
    const rows = await sql<{ id: number; kind: string; season_name: string; gara_id: string; gara_title: string; held_on: string | null; category: string; rows: RankRow[]; total: number }>`
      select id, kind, season_name, gara_id, gara_title, held_on::text as held_on, category, jsonb_array_length(rows)::int as total,
        case when kind = 'generale-squadre' then rows
          else coalesce(nullif(jsonb_path_query_array(rows, '$[*] ? (@.place <= 3)'), '[]'::jsonb), jsonb_path_query_array(rows, '$[0 to 2]')) end as rows
      from fitast_history where season = ${data.season}
      order by held_on desc nulls last, kind, category`;
    const out = { ...empty, seasonName: rows[0]?.season_name ?? "" };
    const gare = new Map<string, ArchiveGara>();
    for (const r of rows) {
      const board: ArchiveBoard = { category: r.category, rows: Array.isArray(r.rows) ? r.rows : [], total: asNum(r.total) };
      if (r.kind.startsWith("generale") && bad.has(asNum(r.id))) {
        if (r.kind === "generale-squadre") out.hidden.sq++;
        else out.hidden.ar++;
      } else if (r.kind === "generale-squadre") out.genSq.push(board);
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
    if (!out.genAr.length) {
      out.genAr = await rebuiltArchers(sql, data.season).catch(() => [] as ArchiveBoard[]);
      out.rebuilt = out.genAr.length > 0;
    }
    return out;
  });

/**
 * Generale degli arcieri rifatta dalle gare della stagione: per ogni categoria la somma dei punti campionato di ogni
 * arciere nelle gare salvate (i primi tre, e quanti sono). Serve quando il portale non ha dato la generale vera.
 */
async function rebuiltArchers(sql: Sql, season: string): Promise<ArchiveBoard[]> {
  const rows = await sql<{ category: string; name: string; team: string; pts: number; gare: number }>`
    select h.category, x->>'name' as name, coalesce(x->>'team', '') as team, sum((x->>'camp')::numeric)::float8 as pts, count(*)::int as gare
    from fitast_history h cross join lateral jsonb_array_elements(h.rows) as x
    where h.season = ${season} and h.kind = 'gara-arcieri' and jsonb_typeof(x->'camp') = 'number' and coalesce(x->>'name', '') <> ''
    group by h.category, x->>'name', coalesce(x->>'team', '')`;
  const by = new Map<string, { name: string; team: string; pts: number }[]>();
  for (const r of rows) {
    const list = by.get(r.category) ?? [];
    list.push({ name: r.name, team: r.team, pts: asNum(r.pts) });
    by.set(r.category, list);
  }
  const out: ArchiveBoard[] = [];
  for (const [category, list] of by) {
    list.sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name, "it"));
    const top: RankRow[] = [];
    for (let i = 0; i < list.length; i++) {
      // a pari punti, stesso posto
      const place = i > 0 && list[i].pts === list[i - 1].pts ? (top[i - 1]?.place ?? i + 1) : i + 1;
      if (place > 3) break;
      top.push({ place, name: list[i].name, team: list[i].team, score: null, camp: Math.round(list[i].pts * 10) / 10 });
    }
    if (top.length) out.push({ category, rows: top, total: list.length });
  }
  return out.sort((a, b) => a.category.localeCompare(b.category, "it"));
}

// ——— la nostra compagnia negli anni: posto, punti, podi e arcieri di ogni stagione ———

export type TrendSeason = {
  season: string;
  seasonName: string;
  /** l'anno da scrivere sotto il grafico */
  year: string;
  /** stagione in corso (classifiche del campionato, non dell'albo) */
  current: boolean;
  /** il posto migliore nella generale compagnie, su quante, in quale categoria, con quanti punti */
  place: number | null;
  of: number;
  category: string;
  points: number | null;
  /** podi degli arcieri nelle gare, vittorie, podi di squadra nelle gare, podi nella generale arcieri */
  podi: number;
  vittorie: number;
  podiSquadra: number;
  podiGenerale: number;
  /** arcieri nella generale e gare con almeno un nostro arciere */
  arcieri: number;
  gare: number;
};

type TrendRow = { id: number | null; kind: string; season: string; season_name: string; gara_id: string; held_on: string | null; category: string; rows: RankRow[]; total: number; cur: boolean };

/**
 * La nostra compagnia stagione per stagione, dall'albo d'oro (stagioni finite) e dal campionato in corso.
 * Dal database escono solo le righe con una delle parole del nome della compagnia (poi si confronta il nome intero).
 */
export const fitastArchiveTrend = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { teams?: unknown };
    return { teams: (Array.isArray(raw.teams) ? raw.teams : []).slice(0, 4).map((t) => clip(t, 110)).filter(Boolean) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const keys = new Set(data.teams.map(teamKey).filter((k) => k.length >= 3));
    const words = [...new Set(data.teams.flatMap(teamWords))].filter((w) => /^[A-Z0-9]{3,}$/.test(w));
    if (!keys.size || !words.length) return { seasons: [] as TrendSeason[] };
    const rx = words.join("|");
    const byTeam = `$[*] ? (@.team like_regex "${rx}" flag "i")`;
    const byName = `$[*] ? (@.name like_regex "${rx}" flag "i")`;
    const pick = (table: "h" | "s") =>
      table === "h"
        ? sql<TrendRow>`
          select id, kind, season, season_name, gara_id, held_on::text as held_on, category, jsonb_array_length(rows)::int as total, false as cur,
            case when kind in ('generale-squadre', 'gara-squadre') then jsonb_path_query_array(rows, ${byName}::jsonpath)
              else jsonb_path_query_array(rows, ${byTeam}::jsonpath) end as rows
          from fitast_history`
        : sql<TrendRow>`
          select null::int as id, kind, season, season_name, gara_id, held_on::text as held_on, category, jsonb_array_length(rows)::int as total, true as cur,
            case when kind in ('generale-squadre', 'gara-squadre') then jsonb_path_query_array(rows, ${byName}::jsonpath)
              else jsonb_path_query_array(rows, ${byTeam}::jsonpath) end as rows
          from fitast_standings`;
    let rows: TrendRow[] = [];
    try {
      // le generali uguali a quelle di un'altra stagione non contano (posto e punti sarebbero di un altro anno)
      const bad = (await generalFps(sql)).bad;
      rows = (await pick("h")).filter((r) => !(r.kind.startsWith("generale") && bad.has(asNum(r.id))));
    } catch {
      rows = [];
    }
    const past = new Set(rows.map((r) => r.season));
    try {
      rows = rows.concat((await pick("s")).filter((r) => !past.has(r.season)));
    } catch {
      /* campionato in corso non letto: va bene lo stesso */
    }
    const isOurs = (t: string) => keys.has(teamKey(t));
    const by = new Map<string, TrendSeason & { _days: string[]; _gare: Set<string>; _names: Set<string> }>();
    for (const r of rows) {
      const s = by.get(r.season) ?? { season: r.season, seasonName: r.season_name, year: "", current: r.cur, place: null, of: 0, category: "", points: null, podi: 0, vittorie: 0, podiSquadra: 0, podiGenerale: 0, arcieri: 0, gare: 0, _days: [], _gare: new Set<string>(), _names: new Set<string>() };
      s.seasonName ||= r.season_name;
      if (r.held_on) s._days.push(r.held_on);
      const list = Array.isArray(r.rows) ? r.rows : [];
      if (r.kind === "generale-squadre") {
        for (const x of list) {
          if (!isOurs(x.name) || x.place == null) continue;
          if (s.place == null || x.place < s.place || (x.place === s.place && asNum(r.total) > s.of)) {
            s.place = x.place;
            s.of = asNum(r.total);
            s.category = r.category;
            s.points = x.camp ?? x.score ?? null;
          }
        }
      } else if (r.kind === "gara-squadre") {
        s.podiSquadra += list.filter((x) => isOurs(x.name) && x.place != null && x.place <= 3).length;
      } else if (r.kind === "gara-arcieri") {
        const ours = list.filter((x) => isOurs(x.team));
        if (ours.length) s._gare.add(r.gara_id);
        s.podi += ours.filter((x) => x.place != null && x.place <= 3).length;
        s.vittorie += ours.filter((x) => x.place === 1).length;
      } else if (r.kind === "generale-arcieri") {
        const ours = list.filter((x) => isOurs(x.team));
        for (const x of ours) s._names.add(nameOf(x.name));
        s.podiGenerale += ours.filter((x) => x.place != null && x.place <= 3).length;
      }
      by.set(r.season, s);
    }
    const seasons = [...by.values()]
      .map(({ _days, _gare, _names, ...s }) => {
        const days = _days.sort();
        const y = /\b(20\d{2})(?:\D+(20\d{2}))?/.exec(s.seasonName);
        const year = y ? (y[2] ? `${y[1].slice(2)}/${y[2].slice(2)}` : y[1]) : days.length ? days[days.length - 1].slice(0, 4) : s.season;
        return { ...s, year, arcieri: _names.size, gare: _gare.size, _last: days[days.length - 1] ?? "" };
      })
      .filter((s) => s.place != null || s.podi || s.arcieri || s.gare)
      .sort((a, b) => (a._last || a.season).localeCompare(b._last || b.season))
      .map(({ _last, ...s }) => s);
    return { seasons };
  });

/** nome dell'arciere senza spazi doppi e maiuscole diverse: per contarli una volta sola */
function nameOf(n: string) {
  return n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}
