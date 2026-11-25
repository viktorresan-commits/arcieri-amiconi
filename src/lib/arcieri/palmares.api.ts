/**
 * Palmarès: podi individuali (dalle gare del calendario, posizione 1-3) e bacheca dei trofei della
 * compagnia (premi di squadra inseriti dal capo compagnia o dallo staff, più i podi dei suoi arcieri).
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { asNum, canScore, clip, db, ensureMember, staffLevel } from "./access";
import { homeId, myMembership } from "./compagnie.api";

export type Podium = { competition: string; day: string; place: number; score: number | null; category: string; userId: string; memberId: number; name: string };
export type Award = { id: number; title: string; place: number | null; competition: string; day: string; category: string; notes: string };
/** risultato di squadra della compagnia in una gara, dalla classifica squadre del portale FITAST */
export type TeamResult = { id: number; fitastId: string; competitionId: number | null; competition: string; day: string; team: string; category: string; place: number | null; score: number | null; teams: number | null };

type ResRow = { id: number; fitast_id: string; competition_id: number | null; competition: string; held_on: string | null; team: string; category: string; place: number | null; score: number | string | null; teams: number | null };
export const toTeamResult = (r: ResRow): TeamResult => ({
  id: asNum(r.id),
  fitastId: r.fitast_id ?? "",
  competitionId: r.competition_id == null ? null : asNum(r.competition_id),
  competition: r.competition ?? "",
  day: r.held_on ? String(r.held_on).slice(0, 10) : "",
  team: r.team ?? "",
  category: r.category ?? "",
  place: r.place == null ? null : asNum(r.place),
  score: r.score == null ? null : Number(r.score),
  teams: r.teams == null ? null : asNum(r.teams),
});

/** i risultati di squadra di una compagnia, dal più recente */
export async function teamResultsOf(sql: Sql, companyId: number) {
  const rows = await sql<ResRow>`
    select id, fitast_id, competition_id, competition, held_on::text as held_on, team, category, place, score, teams
    from company_results where company_id = ${companyId}
    order by held_on desc nulls last, place nulls last, id desc`;
  return rows.map(toTeamResult);
}

type PodRow = { name: string; starts_on: string; rank: number; score: number | null; category: string; user_id: string; member_id: number; given_name: string; family_name: string; nickname: string };

const toPodium = (r: PodRow): Podium => ({
  competition: r.name,
  day: String(r.starts_on).slice(0, 10),
  place: asNum(r.rank),
  score: r.score == null ? null : asNum(r.score),
  category: r.category ?? "",
  userId: r.user_id,
  memberId: asNum(r.member_id),
  name: [r.given_name, r.family_name].filter(Boolean).join(" ") || r.nickname || "Arciere",
});

async function podiumsOf(sql: Sql, userIds: string[]) {
  if (!userIds.length) return [];
  const rows = await sql<PodRow>`
    select c.name, c.starts_on::text as starts_on, e.rank, e.score, coalesce(nullif(e.category, ''), c.category, '') as category,
      e.user_id, m.id as member_id, m.given_name, m.family_name, m.nickname
    from competition_entries e
    join competitions c on c.id = e.competition_id
    join members m on m.user_id = e.user_id
    where e.user_id = any(string_to_array(${userIds.join(",")}, ',')) and e.rank between 1 and 3
    order by c.starts_on desc, e.rank`;
  return rows.map(toPodium);
}

/** podi di un arciere (scheda del personaggio) */
export const archerPodiums = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const id = asNum((input as { memberId?: unknown })?.memberId);
    if (!id) throw new Error("Arciere non trovato.");
    return { id };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<{ user_id: string | null }>`select user_id from members where id = ${data.id} limit 1`;
    const userId = rows[0]?.user_id;
    if (!userId) return { podiums: [] as Podium[], gare: 0 };
    const gare = await sql<{ n: number }>`select count(*)::int as n from competition_entries where user_id = ${userId} and (score is not null or rank is not null)`;
    return { podiums: await podiumsOf(sql, [userId]), gare: asNum(gare[0]?.n) };
  });

async function companyAccess(sql: Sql, userId: string, companyId: number) {
  const me = await ensureMember(sql, userId);
  const mine = await myMembership(sql, userId);
  return staffLevel(me) != null || (mine.role === "owner" && mine.companyId === companyId);
}

/** bacheca della compagnia: trofei di squadra e podi dei suoi arcieri */
export const companyPalmares = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ companyId: asNum((input as { companyId?: unknown })?.companyId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const companyId = data.companyId || (await myMembership(sql, context.userId)).companyId;
    const home = await homeId(sql);
    const crew = await sql<{ user_id: string }>`
      select m.user_id from members m
      left join company_members cm on cm.user_id = m.user_id
      where m.user_id is not null and coalesce(cm.company_id, ${home}) = ${companyId}`;
    const awards = await sql<{ id: number; title: string; place: number | null; competition: string; held_on: string | null; category: string; notes: string }>`
      select id, title, place, competition, held_on::text as held_on, category, notes
      from company_awards where company_id = ${companyId}
      order by held_on desc nulls last, id desc`;
    // i nomi degli iscritti delle altre compagnie li vede solo lo staff (come nell'elenco delle compagnie):
    // agli altri restano le medaglie, senza il nome
    const me = await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    const seeNames = staffLevel(me) != null || mine.companyId === companyId;
    const pods = await podiumsOf(
      sql,
      crew.map((c) => c.user_id),
    );
    return {
      companyId,
      seeNames,
      results: await teamResultsOf(sql, companyId),
      canEdit: await companyAccess(sql, context.userId, companyId),
      awards: awards.map(
        (a): Award => ({ id: asNum(a.id), title: a.title, place: a.place == null ? null : asNum(a.place), competition: a.competition, day: a.held_on ? String(a.held_on).slice(0, 10) : "", category: a.category, notes: a.notes }),
      ),
      podiums: seeNames ? pods : pods.map((p) => ({ ...p, name: "", memberId: 0, userId: "" })),
    };
  });

export const saveCompanyAward = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const title = clip(raw.title, 120);
    if (!title) throw new Error("Scrivi il nome del premio.");
    const place = raw.place == null || raw.place === "" ? null : Math.max(1, Math.min(99, Math.round(asNum(raw.place))));
    const day = String(raw.day ?? "").slice(0, 10);
    return {
      id: asNum(raw.id),
      companyId: asNum(raw.companyId),
      title,
      place,
      competition: clip(raw.competition, 160),
      day: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
      category: clip(raw.category, 80),
      notes: clip(raw.notes, 300),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    if (!data.companyId || !(await companyAccess(sql, context.userId, data.companyId))) throw new Error("Solo il capo della compagnia o lo staff può aggiornare la bacheca.");
    if (data.id) {
      await sql`update company_awards set title = ${data.title}, place = ${data.place}, competition = ${data.competition}, held_on = ${data.day}, category = ${data.category}, notes = ${data.notes}
        where id = ${data.id} and company_id = ${data.companyId}`;
    } else {
      await sql`insert into company_awards (company_id, title, place, competition, held_on, category, notes, created_by)
        values (${data.companyId}, ${data.title}, ${data.place}, ${data.competition}, ${data.day}, ${data.category}, ${data.notes}, ${context.userId})`;
    }
    return { ok: true };
  });

export const deleteCompanyAward = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: unknown })?.id), companyId: asNum((input as { companyId?: unknown })?.companyId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    if (!data.companyId || !(await companyAccess(sql, context.userId, data.companyId))) throw new Error("Solo il capo della compagnia o lo staff può aggiornare la bacheca.");
    await sql`delete from company_awards where id = ${data.id} and company_id = ${data.companyId}`;
    return { ok: true };
  });

/** la compagnia di chi cerca sul portale FITAST e il nome con cui il portale la scrive (es. ARCIERI FABRIANO) */
export const fitastTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    const rows = await sql<{ name: string; city: string; fitast_name: string | null }>`select name, city, fitast_name from companies where id = ${mine.companyId} limit 1`;
    return { companyId: mine.companyId, name: rows[0]?.name ?? "", city: rows[0]?.city ?? "", fitastName: rows[0]?.fitast_name ?? "" };
  });

const optNum = (v: unknown, max: number) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.min(max, Number(v))));

/**
 * Salva per tutta la compagnia di chi cerca i suoi risultati di squadra letti sul portale (posizione,
 * punteggio, quante squadre): li vede ogni arciere della compagnia, senza aspettare i punteggi di tutti.
 */
export const saveCompanyResults = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { fitastName?: unknown; results?: unknown };
    const list = Array.isArray(raw.results) ? raw.results.slice(0, 40) : [];
    return {
      fitastName: clip(raw.fitastName, 80),
      results: list
        .map((item) => {
          const r = (item ?? {}) as Record<string, unknown>;
          const day = String(r.day ?? "").slice(0, 10);
          const place = optNum(r.place, 999);
          const teams = optNum(r.teams, 999);
          return {
            // numero della gara, oppure camp-26_I per la classifica generale del campionato
            fitastId: clip(r.fitastId, 24).replace(/[^0-9A-Za-z_-]/g, ""),
            competition: clip(r.competition, 160),
            day: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
            team: clip(r.team, 120),
            category: clip(r.category, 120),
            place: place == null ? null : Math.round(place),
            score: optNum(r.score, 1_000_000),
            teams: teams == null ? null : Math.round(teams),
          };
        })
        .filter((r) => r.fitastId && r.team && (r.place != null || r.score != null)),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    const mine = await myMembership(sql, context.userId);
    if (data.fitastName) await sql`update companies set fitast_name = ${data.fitastName} where id = ${mine.companyId} and coalesce(fitast_name, '') = ''`;
    let saved = 0;
    for (const r of data.results) {
      // la gara del calendario: quella collegata al portale (fitast:ID) o, se è una sola, quella dello stesso giorno
      let compId: number | null = null;
      // la classifica generale del campionato (camp-…) non è una gara del calendario
      const isGara = /^\d+$/.test(r.fitastId);
      const linked = isGara ? await sql<{ id: number }>`select id from competitions where notes ~ ${`^fitast:${r.fitastId}(\\D|$)`} limit 1` : [];
      if (linked[0]) compId = asNum(linked[0].id);
      else if (r.day && isGara) {
        const same = await sql<{ id: number }>`select id from competitions where starts_on = ${r.day}::date limit 2`;
        if (same.length === 1) compId = asNum(same[0].id);
      }
      await sql`
        insert into company_results (company_id, fitast_id, competition_id, competition, held_on, team, category, place, score, teams, updated_by, updated_at)
        values (${mine.companyId}, ${r.fitastId}, ${compId}, ${r.competition}, ${r.day}::date, ${r.team}, ${r.category}, ${r.place}, ${r.score}, ${r.teams}, ${context.userId}, now())
        on conflict (company_id, fitast_id, team, category) do update set
          competition_id = coalesce(excluded.competition_id, company_results.competition_id),
          competition = case when excluded.competition <> '' then excluded.competition else company_results.competition end,
          held_on = coalesce(excluded.held_on, company_results.held_on),
          place = excluded.place, score = excluded.score, teams = excluded.teams,
          updated_by = excluded.updated_by, updated_at = now()`;
      saved++;
    }
    return { saved };
  });
