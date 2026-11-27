import type { Sql } from "@/lib/db";
import { BADGE_TITLES, asIso, asNum } from "./access";
import { romeDayKey, ymdAdd } from "./time";
import { garaLoads, sumLoads, type GaraLoad } from "./gara-volume";
import { codesFor } from "./prize-ladders";

/**
 * I premi di un arciere, ricalcolati dai dati: allenamenti e frecce, gare (app, portale e archivio FITAST),
 * podi, vittorie, piazzole e punti campionato. loads: le gare già lette (per non rileggerle per ognuno).
 */
export async function syncBadges(sql: Sql, userId: string, loadsIn?: GaraLoad[]) {
  const sessions = await sql<{
    id: number;
    started_at: unknown;
    arrows_per_end: number;
    ends_planned: number;
    blocks_planned: number;
    arrows: number;
    points: number;
  }>`
    select s.id, s.started_at, s.arrows_per_end, s.ends_planned, s.blocks_planned,
      count(sh.id)::int as arrows, coalesce(sum(sh.score), 0)::int as points
    from sessions s
    left join shots sh on sh.session_id = s.id
    where s.user_id = ${userId}
    group by s.id`;

  const mapped = sessions
    .map((s) => ({
      startedAt: asIso(s.started_at),
      arrows: asNum(s.arrows),
      points: asNum(s.points),
      planned: asNum(s.arrows_per_end) * asNum(s.ends_planned) * asNum(s.blocks_planned),
    }))
    .filter((s) => s.arrows > 0);

  const totalArrows = mapped.reduce((a, s) => a + s.arrows, 0);
  const completeArrows = mapped
    .filter((s) => s.planned > 0 && s.arrows >= s.planned)
    .reduce((a, s) => a + s.arrows, 0);
  const days = [...new Set(mapped.map((s) => romeDayKey(s.startedAt)))].sort();
  let streak = 0;
  let bestStreak = 0;
  let prev = "";
  for (const day of days) {
    if (!prev) streak = 1;
    else {
      const [y, m, d] = prev.split("-").map(Number);
      const next = ymdAdd(y, m, d, 1);
      const key = `${next.y}-${String(next.m).padStart(2, "0")}-${String(next.d).padStart(2, "0")}`;
      streak = key === day ? streak + 1 : 1;
    }
    bestStreak = Math.max(bestStreak, streak);
    prev = day;
  }
  const avgs = mapped
    .filter((s) => s.arrows >= 6)
    .map((s) => ({ at: s.startedAt, avg: s.points / s.arrows }))
    .sort((a, b) => a.at.localeCompare(b.at));
  let running = -1;
  let firstRecord = false;
  for (const row of avgs) {
    if (running >= 0 && row.avg > running + 1e-9) firstRecord = true;
    running = Math.max(running, row.avg);
  }
  const now = Date.now();
  const weigh = (from: number, to: number) => {
    const list = mapped.filter((s) => {
      const t = new Date(s.startedAt).getTime();
      return t >= from && t < to;
    });
    const arrows = list.reduce((a, s) => a + s.arrows, 0);
    const points = list.reduce((a, s) => a + s.points, 0);
    return { arrows, avg: arrows ? points / arrows : 0 };
  };
  const recent = weigh(now - 30 * 86_400_000, now + 86_400_000);
  const prior = weigh(now - 60 * 86_400_000, now - 30 * 86_400_000);
  const improved = recent.arrows >= 30 && prior.arrows >= 30 && prior.avg > 0 && (recent.avg - prior.avg) / prior.avg >= 0.05;
  // le gare come sul profilo: app, classifiche del portale e archivio FITAST dal 2019
  const today = new Date().toISOString().slice(0, 10);
  const loads = (loadsIn ?? ((await garaLoads(sql, userId).catch(() => new Map<string, GaraLoad[]>())).get(userId) ?? [])).filter((l) => l.day <= today);
  const vol = sumLoads(loads);
  const ranks = loads.map((l) => l.rank).filter((r): r is number => r != null);

  const codes = codesFor({
    allenamenti: mapped.length,
    frecce: Math.max(totalArrows + vol.arrows, completeArrows >= 100 ? 100 : 0),
    gare: loads.length,
    podi: ranks.filter((r) => r <= 3).length,
    vittorie: ranks.filter((r) => r === 1).length,
    piazzole: vol.piazzole,
    campionato: loads.reduce((sum, l) => sum + (l.champ ?? 0), 0),
  });
  if (firstRecord) codes.push("first_record");
  if (improved) codes.push("improve_5");
  if (days.length >= 30) codes.push("days_30");
  if (bestStreak >= 7) codes.push("streak_7");

  // solo quelli che mancano: una lettura sola, poi gli inserimenti nuovi
  const have = new Set((await sql<{ code: string }>`select code from user_achievements where user_id = ${userId}`).map((r) => r.code));
  const fresh: string[] = [];
  for (const code of codes) {
    if (have.has(code)) continue;
    const ins = await sql<{ code: string }>`
      insert into user_achievements (user_id, code) values (${userId}, ${code})
      on conflict (user_id, code) do nothing
      returning code`;
    if (ins[0]) fresh.push(ins[0].code);
  }
  if (!fresh.length) return [];
  const flags = await sql<{ notify_goals: boolean }>`select notify_goals from members where user_id = ${userId} limit 1`;
  if (flags[0]?.notify_goals !== false) {
    if (fresh.length <= 2) {
      for (const code of fresh) {
        await sql`
          insert into notifications (user_id, title, body, href, dedupe)
          values (${userId}, ${"Medaglia: " + (BADGE_TITLES[code] ?? code)}, ${"È nel tuo albo."}, ${"/obiettivi"}, ${"ach-" + userId + "-" + code})
          on conflict (dedupe) do nothing`;
      }
    } else {
      // tante insieme (per esempio dopo l'importazione dal portale): un solo avviso
      const names = fresh.slice(-3).map((code) => BADGE_TITLES[code] ?? code).join(", ");
      await sql`
        insert into notifications (user_id, title, body, href, dedupe)
        values (${userId}, ${`${fresh.length} nuove medaglie`}, ${`Fra queste: ${names}. Sono nel tuo albo.`}, ${"/obiettivi"}, ${"ach-" + userId + "-" + fresh.length + "-" + fresh[fresh.length - 1]})
        on conflict (dedupe) do nothing`;
    }
  }
  return fresh.map((code) => BADGE_TITLES[code] ?? code);
}
