/**
 * Compagnie e classifiche FITAST per tutti: l'elenco delle compagnie del portale diventa l'elenco da cui
 * scegliere all'ingresso (stemma disegnato, città e contatti), e le classifiche lette dal portale
 * (generale compagnie e arcieri del campionato, primi arcieri e squadre di ogni gara) restano salvate.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { asNum, clip, db, ensureMember, staffLevel } from "./access";
import { readFitastPage } from "./fitast.api";
import { COMPAGNIE_URL, crestOf, parseCompanies, teamKey, titleName, type RankRow } from "./fitast-league";

const DAY = 86_400_000;
export const STANDING_KINDS = ["generale-squadre", "generale-arcieri", "gara-arcieri", "gara-squadre"] as const;
export type StandingKind = (typeof STANDING_KINDS)[number];

function slugOf(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "compagnia"
  );
}

async function freeSlug(sql: Sql, name: string) {
  const base = slugOf(name);
  let slug = base;
  for (let i = 2; i < 60; i += 1) {
    const clash = await sql<{ id: number }>`select id from companies where slug = ${slug} limit 1`;
    if (!clash[0]) break;
    slug = `${base}-${i}`;
  }
  return slug;
}

/**
 * Prepara le compagnie dell'elenco FITAST (tranne Fabriano, che c'è già): una volta alla settimana, da chiunque
 * apra la scelta della compagnia; lo staff può forzarla. Le compagnie già nell'app si collegano per nome.
 */
export const syncFitastCompanies = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ force: Boolean((input as { force?: unknown } | null)?.force) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const last = await sql<{ at: string; info: { total?: number; ok?: boolean } }>`select at, info from fitast_sync where key = 'compagnie' limit 1`;
    const age = last[0] ? Date.now() - new Date(last[0].at).getTime() : Infinity;
    const ok = Boolean(last[0]?.info?.ok);
    // riuscita: si rilegge dopo una settimana; non riuscita: dopo un'ora
    if (!(data.force && staffLevel(me)) && age < (ok ? 7 * DAY : DAY / 24)) return { added: 0, linked: 0, total: asNum(last[0]?.info?.total), skipped: true, diag: [] as string[] };
    await sql`insert into fitast_sync (key, at, info) values ('compagnie', now(), '{"ok":false}'::jsonb) on conflict (key) do update set at = now()`;
    let list: ReturnType<typeof parseCompanies> = [];
    let diag: string[] = [];
    try {
      const page = await readFitastPage(COMPAGNIE_URL);
      list = parseCompanies(page);
      diag = page.diag ?? [];
    } catch (e) {
      diag = [e instanceof Error ? e.message : "Portale FITAST non raggiungibile."];
    }
    const existing = await sql<{ id: number; name: string; fitast_name: string; slug: string }>`select id, name, fitast_name, slug from companies`;
    const byKey = new Map<string, number>();
    for (const c of existing) {
      for (const k of [teamKey(c.fitast_name), teamKey(c.name)]) if (k && !byKey.has(k)) byKey.set(k, asNum(c.id));
    }
    let added = 0;
    let linked = 0;
    for (const c of list) {
      const key = teamKey(c.name);
      // Fabriano c'è già: si collega soltanto
      const found = byKey.get(key) ?? (/\bFABRIANO\b/.test(key) ? existing.find((x) => x.slug === "fabriano")?.id : undefined);
      if (found != null) {
        await sql`update companies set fitast_name = case when fitast_name = '' then ${c.name} else fitast_name end, fitast_code = case when fitast_code = '' then ${clip(c.code, 20)} else fitast_code end where id = ${asNum(found)}`;
        linked++;
        continue;
      }
      const name = clip(titleName(c.name), 70);
      if (name.length < 3) continue;
      const crest = crestOf(c.name);
      const city = clip(titleName(c.city || c.province), 50);
      const bio = clip(
        [`Compagnia iscritta alla FITAST${c.region ? ` (${titleName(c.region)})` : ""}.`, c.president ? `Presidente: ${titleName(c.president)}.` : "", c.code ? `Codice FITAST ${c.code}.` : ""].filter(Boolean).join(" "),
        500,
      );
      const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) ? c.email.toLowerCase().slice(0, 120) : "";
      const phone = c.phone.replace(/[^\d+]/g, "").slice(0, 20);
      const website = c.website ? clip(/^https?:\/\//i.test(c.website) ? c.website.replace(/^http:/i, "https:") : `https://${c.website.replace(/^\/+/, "")}`, 160) : "";
      const slug = await freeSlug(sql, name);
      const made = await sql<{ id: number }>`
        insert into companies (slug, name, city, bio, logo_url, color, phone, email, website, address, source, fitast_name, fitast_code)
        values (${slug}, ${name}, ${city}, ${bio}, ${crest.logo}, ${crest.color}, ${phone}, ${email}, ${website}, ${clip(c.address, 160)}, 'fitast', ${c.name}, ${clip(c.code, 20)})
        on conflict (slug) do nothing
        returning id`;
      if (made[0]) {
        byKey.set(key, asNum(made[0].id));
        added++;
      }
    }
    const good = list.length >= 3;
    await sql`update fitast_sync set info = ${JSON.stringify({ ok: good, total: list.length, added, linked })}::jsonb where key = 'compagnie'`;
    return { added, linked, total: list.length, skipped: false, diag: good ? [] : diag };
  });

export type StandingRow = RankRow;
export type Standing = { kind: StandingKind; season: string; seasonName: string; garaId: string; garaTitle: string; day: string; category: string; rows: StandingRow[]; updatedAt: string };

/** le classifiche FITAST salvate del campionato più recente */
export const fitastStandings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const latest = await sql<{ season: string; season_name: string }>`select season, season_name from fitast_standings order by updated_at desc limit 1`;
    if (!latest[0]) return { season: "", seasonName: "", updatedAt: "", items: [] as Standing[] };
    const rows = await sql<{ kind: string; season: string; season_name: string; gara_id: string; gara_title: string; held_on: string | null; category: string; rows: StandingRow[]; updated_at: string }>`
      select kind, season, season_name, gara_id, gara_title, held_on::text as held_on, category, rows, updated_at
      from fitast_standings where season = ${latest[0].season}
      order by held_on desc nulls first, kind, category`;
    const items: Standing[] = rows.map((r) => ({
      kind: r.kind as StandingKind,
      season: r.season,
      seasonName: r.season_name,
      garaId: r.gara_id,
      garaTitle: r.gara_title,
      day: r.held_on ?? "",
      category: r.category,
      rows: Array.isArray(r.rows) ? r.rows : [],
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
    const updatedAt = items.reduce((m, x) => (x.updatedAt > m ? x.updatedAt : m), "");
    return { season: latest[0].season, seasonName: latest[0].season_name, updatedAt, items };
  });

const optNum = (v: unknown, max: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
};

/** salva per tutti le classifiche lette dal portale (dati pubblici del campionato) */
export const saveFitastStandings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { items?: unknown };
    const list = Array.isArray(raw.items) ? raw.items.slice(0, 80) : [];
    return {
      items: list
        .map((item) => {
          const r = (item ?? {}) as Record<string, unknown>;
          const day = String(r.day ?? "").slice(0, 10);
          const rows = (Array.isArray(r.rows) ? r.rows.slice(0, 40) : []).map((x) => {
            const o = (x ?? {}) as Record<string, unknown>;
            const place = optNum(o.place, 9999);
            return { place: place == null ? null : Math.round(place), name: clip(o.name, 90), team: clip(o.team, 110), score: optNum(o.score, 10_000_000), camp: optNum(o.camp, 10_000_000) };
          }).filter((x) => x.name);
          return {
            kind: String(r.kind ?? "") as StandingKind,
            season: clip(r.season, 24).replace(/[^\w-]/g, ""),
            seasonName: clip(r.seasonName, 90),
            garaId: clip(r.garaId, 10).replace(/\D/g, ""),
            garaTitle: clip(r.garaTitle, 140),
            day: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
            category: clip(r.category, 90),
            rows,
          };
        })
        .filter((x) => STANDING_KINDS.includes(x.kind) && x.season && x.rows.length),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    for (const x of data.items) {
      await sql`
        insert into fitast_standings (kind, season, season_name, gara_id, gara_title, held_on, category, rows, updated_by, updated_at)
        values (${x.kind}, ${x.season}, ${x.seasonName}, ${x.garaId}, ${x.garaTitle}, ${x.day}::date, ${x.category}, ${JSON.stringify(x.rows)}::jsonb, ${context.userId}, now())
        on conflict (kind, season, gara_id, category) do update set
          season_name = excluded.season_name, gara_title = case when excluded.gara_title <> '' then excluded.gara_title else fitast_standings.gara_title end,
          held_on = coalesce(excluded.held_on, fitast_standings.held_on), rows = excluded.rows, updated_by = excluded.updated_by, updated_at = now()`;
    }
    return { saved: data.items.length };
  });

/** punti FITAST delle compagnie nel campionato più recente (classifica generale squadre), per nome */
export async function fitastPointsBy(sql: Sql) {
  const latest = await sql<{ season: string; season_name: string }>`select season, season_name from fitast_standings where kind = 'generale-squadre' order by updated_at desc limit 1`;
  const map = new Map<string, { points: number; place: number | null; season: string }>();
  if (!latest[0]) return map;
  const rows = await sql<{ category: string; rows: StandingRow[] }>`select category, rows from fitast_standings where kind = 'generale-squadre' and season = ${latest[0].season}`;
  for (const r of rows) {
    for (const x of Array.isArray(r.rows) ? r.rows : []) {
      const k = teamKey(x.team || x.name);
      if (!k) continue;
      const cur = map.get(k) ?? { points: 0, place: null, season: latest[0].season_name };
      cur.points += x.camp ?? x.score ?? 0;
      if (x.place != null && (cur.place == null || x.place < cur.place)) cur.place = x.place;
      map.set(k, cur);
    }
  }
  return map;
}
