import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { asNum, db, ensureMember } from "./access";

/**
 * Punti che vengono da quello che si registra (non dal telefono): ogni allenamento segnato, ogni gara
 * con il suo risultato (di più se presa dal portale FITAST) e i podi. Si ricalcolano sempre dai dati,
 * così non si contano due volte e valgono anche per quello registrato prima.
 */
export async function activityXp(sql: Sql, userId: string) {
  const s = await sql<{ n: number; pts: number }>`
    select count(*)::int as n, coalesce(sum(least(12, floor(arrows / 10.0))), 0)::int as pts from (
      select count(sh.id)::int as arrows from sessions s join shots sh on sh.session_id = s.id
      where s.user_id = ${userId} group by s.id having count(sh.id) >= 6
    ) t`.catch(() => []);
  const g = await sql<{ n: number; fitast: number; first: number; second: number; third: number }>`
    select count(*)::int as n,
      count(*) filter (where notes ilike '%FITAST%')::int as fitast,
      count(*) filter (where rank = 1)::int as first,
      count(*) filter (where rank = 2)::int as second,
      count(*) filter (where rank = 3)::int as third
    from competition_entries
    where user_id = ${userId} and (score is not null or rank is not null or championship_points is not null)`.catch(() => []);
  const trainings = asNum(s[0]?.n) * 8 + asNum(s[0]?.pts);
  const gare = asNum(g[0]?.n) * 25 + asNum(g[0]?.fitast) * 10 + asNum(g[0]?.first) * 30 + asNum(g[0]?.second) * 20 + asNum(g[0]?.third) * 10;
  return trainings + gare;
}

/** gli stessi punti di activityXp, per tutti gli arcieri in due sole letture */
async function allActivityXp(sql: Sql) {
  const out = new Map<string, number>();
  const s = await sql<{ user_id: string; n: number; pts: number }>`
    select user_id, count(*)::int as n, coalesce(sum(least(12, floor(arrows / 10.0))), 0)::int as pts from (
      select s.user_id, count(sh.id)::int as arrows from sessions s join shots sh on sh.session_id = s.id
      group by s.id, s.user_id having count(sh.id) >= 6
    ) t group by user_id`.catch(() => []);
  for (const r of s) out.set(r.user_id, (out.get(r.user_id) ?? 0) + asNum(r.n) * 8 + asNum(r.pts));
  const g = await sql<{ user_id: string; n: number; fitast: number; first: number; second: number; third: number }>`
    select user_id, count(*)::int as n,
      count(*) filter (where notes ilike '%FITAST%')::int as fitast,
      count(*) filter (where rank = 1)::int as first,
      count(*) filter (where rank = 2)::int as second,
      count(*) filter (where rank = 3)::int as third
    from competition_entries
    where score is not null or rank is not null or championship_points is not null
    group by user_id`.catch(() => []);
  for (const r of g) out.set(r.user_id, (out.get(r.user_id) ?? 0) + asNum(r.n) * 25 + asNum(r.fitast) * 10 + asNum(r.first) * 30 + asNum(r.second) * 20 + asNum(r.third) * 10);
  return out;
}

/** I punti di tutti gli arcieri (telefono + allenamenti e gare): servono per l'alone del livello attorno al ritratto. */
export const memberLevels = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<{ user_id: string; xp: number }>`select user_id, coalesce(xp, 0)::int as xp from members where user_id is not null`;
    const act = await allActivityXp(sql);
    const out: Record<string, number> = {};
    for (const r of rows) out[r.user_id] = asNum(r.xp) + (act.get(r.user_id) ?? 0);
    return out;
  });

/**
 * Punti esperienza: il telefono manda i suoi, il server tiene il valore più alto e lo rimanda, insieme ai
 * punti di allenamenti e gare registrati. Così il livello si vede sul profilo e un telefono nuovo riparte da lì.
 */
export const syncXp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const xp = Math.floor(asNum((input as { xp?: number })?.xp));
    return { xp: Math.max(0, Math.min(10_000_000, Number.isFinite(xp) ? xp : 0)) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const rows = await sql<{ xp: number }>`update members set xp = greatest(xp, ${data.xp}) where id = ${me.id} returning xp`;
    // xp: i punti del telefono (minigioco, quiz, esercizi); activity: allenamenti e gare registrati
    return { xp: asNum(rows[0]?.xp), activity: await activityXp(sql, context.userId) };
  });
