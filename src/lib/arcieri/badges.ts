import type { Sql } from "@/lib/db";
import { BADGE_TITLES, asIso, asNum } from "./access";
import { romeDayKey, ymdAdd } from "./time";

export async function syncBadges(sql: Sql, userId: string) {
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
  const comps = await sql<{ n: number; champ: number }>`
    select count(*)::int as n, coalesce(sum(championship_points), 0)::int as champ
    from competition_entries where user_id = ${userId} and score is not null`;
  const gare = asNum(comps[0]?.n);
  const champ = asNum(comps[0]?.champ);

  const codes: string[] = [];
  if (mapped.length >= 1) codes.push("first_session");
  if (mapped.length >= 5) codes.push("sessions_5");
  if (mapped.length >= 10) codes.push("sessions_10");
  if (mapped.length >= 50) codes.push("sessions_50");
  if (mapped.length >= 100) codes.push("sessions_100");
  if (totalArrows >= 100 || completeArrows >= 100) codes.push("arrows_100");
  if (totalArrows >= 500) codes.push("arrows_500");
  if (totalArrows >= 1000) codes.push("arrows_1000");
  if (totalArrows >= 5000) codes.push("arrows_5000");
  if (firstRecord) codes.push("first_record");
  if (gare > 0) codes.push("first_comp");
  if (gare >= 5) codes.push("gare_5");
  if (gare >= 10) codes.push("gare_10");
  if (champ >= 10) codes.push("champ_10");
  if (champ >= 50) codes.push("champ_50");
  if (champ >= 100) codes.push("champ_100");
  if (improved) codes.push("improve_5");
  if (days.length >= 30) codes.push("days_30");
  if (bestStreak >= 7) codes.push("streak_7");

  const fresh: string[] = [];
  for (const code of codes) {
    const ins = await sql<{ code: string }>`
      insert into user_achievements (user_id, code) values (${userId}, ${code})
      on conflict (user_id, code) do nothing
      returning code`;
    if (ins[0]) fresh.push(ins[0].code);
  }
  const flags = await sql<{ notify_goals: boolean }>`select notify_goals from members where user_id = ${userId} limit 1`;
  if (flags[0]?.notify_goals !== false) {
    for (const code of fresh) {
      await sql`
        insert into notifications (user_id, title, body, href, dedupe)
        values (${userId}, ${"Medaglia: " + (BADGE_TITLES[code] ?? code)}, ${"È nel tuo albo."}, ${"/obiettivi"}, ${"ach-" + userId + "-" + code})
        on conflict (dedupe) do nothing`;
    }
  }
  return fresh.map((code) => BADGE_TITLES[code] ?? code);
}
