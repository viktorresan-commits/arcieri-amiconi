import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { db, ensureMember } from "./access";
import { romeYmd } from "./time";
import {
  GAME_MODES,
  GROUP_GOALS,
  REWARDS,
  arrowCap,
  dayKey,
  gearOf,
  modeLabel,
  rankFor,
  rewardsFor,
  scoreShots,
  weekStartKey,
  type GameMode,
} from "./game";

type ShotIn = { yaw: number; pitch: number; at: number; draw?: number; pound?: number; grain?: number; shaft?: number; vane?: string };

function isMode(value: string): value is GameMode {
  return (GAME_MODES as readonly string[]).includes(value);
}

function parseShots(raw: unknown, mode: GameMode): ShotIn[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > arrowCap(mode)) throw new Error("Numero di frecce non valido.");
  if ((mode === "perfect" && raw.length !== 10) || ((mode === "daily" || mode === "duel") && raw.length !== 8)) {
    throw new Error("La partita non è completa.");
  }
  let prev = -1;
  return raw.map((item) => {
    const row = item as ShotIn;
    const yaw = Number(row?.yaw);
    const pitch = Number(row?.pitch);
    const at = Number(row?.at);
    if (!Number.isFinite(yaw) || !Number.isFinite(pitch) || !Number.isFinite(at)) throw new Error("Tiro illeggibile.");
    if (at < 0 || at > 20 * 60 * 1000 || (prev >= 0 && at < prev + 280)) throw new Error("Tempo del tiro non valido.");
    prev = at;
    const gear = gearOf(row);
    return { yaw, pitch, at, draw: gear.draw, pound: gear.pound, grain: gear.grain, shaft: gear.shaft, vane: gear.vane };
  });
}

function personName(row: { nickname?: string | null; given_name?: string | null; family_name?: string | null }) {
  const nick = row.nickname?.trim();
  if (nick) return nick;
  return [row.given_name, row.family_name].filter(Boolean).join(" ") || "Amiconi";
}

function rewardTitle(code: string) {
  return REWARDS.find((item) => item.code === code)?.title ?? code;
}

export const gameHome = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const today = dayKey(romeYmd());
    const week = weekStartKey(romeYmd());
    const mine = await sql<{
      matches: number;
      arrows: number;
      hits: number;
      perfects: number;
      best_combo: number;
      record: number;
      xp: number;
      avg: number;
    }>`
      select
        count(*) filter (where status = 'chiusa')::int as matches,
        coalesce(sum(arrows) filter (where status = 'chiusa'), 0)::int as arrows,
        coalesce(sum(hits) filter (where status = 'chiusa'), 0)::int as hits,
        coalesce(sum(perfects) filter (where status = 'chiusa'), 0)::int as perfects,
        coalesce(max(best_combo) filter (where status = 'chiusa'), 0)::int as best_combo,
        coalesce(max(score) filter (where status = 'chiusa' and mode <> 'training'), 0)::int as record,
        coalesce(sum(xp) filter (where status = 'chiusa'), 0)::int as xp,
        coalesce(avg(score) filter (where status = 'chiusa' and mode <> 'training'), 0)::float as avg
      from game_matches
      where member_id = ${me.id}`;
    const stats = mine[0];
    const rank = rankFor(stats?.xp ?? 0);
    const bestRows = await sql<{ member_id: number; score: number; nickname: string; given_name: string; family_name: string }>`
      select m.member_id, m.score::int, p.nickname, p.given_name, p.family_name
      from (
        select member_id, max(score) as score
        from game_matches
        where status = 'chiusa' and mode <> 'training'
        group by member_id
      ) m
      join members p on p.id = m.member_id
      order by m.score desc, p.given_name`;
    const position = bestRows.findIndex((row) => row.member_id === me.id);
    const board = bestRows.slice(0, 10).map((row, index) => ({
      place: index + 1,
      memberId: row.member_id,
      name: personName(row),
      score: row.score,
      me: row.member_id === me.id,
    }));
    const weekRows = await sql<{ member_id: number; score: number; arrows: number; hits: number; perfects: number; day: string; nickname: string; given_name: string; family_name: string }>`
      select g.member_id, g.score::int, g.arrows::int, g.hits::int, g.perfects::int,
             (g.created_at at time zone 'Europe/Rome')::date::text as day,
             p.nickname, p.given_name, p.family_name
      from game_matches g
      join members p on p.id = g.member_id
      where g.status = 'chiusa' and g.mode <> 'training'`;
    const weekMatches = weekRows.filter((row) => row.day >= week);
    const todayBest = new Map<number, number>();
    const weekBest = new Map<number, { score: number; name: string }>();
    let weekArrows = 0;
    let weekHits = 0;
    let weekPerfects = 0;
    for (const row of weekMatches) {
      weekArrows += row.arrows;
      weekHits += row.hits;
      weekPerfects += row.perfects;
      const name = personName(row);
      const prev = weekBest.get(row.member_id);
      if (!prev || row.score > prev.score) weekBest.set(row.member_id, { score: row.score, name });
      if (row.day === today) todayBest.set(row.member_id, Math.max(todayBest.get(row.member_id) ?? 0, row.score));
    }
    const byWeek = new Map<string, Map<number, number>>();
    for (const row of weekRows) {
      const key = weekStartKey({ y: Number(row.day.slice(0, 4)), m: Number(row.day.slice(5, 7)), d: Number(row.day.slice(8, 10)) });
      const bag = byWeek.get(key) ?? new Map<number, number>();
      bag.set(row.member_id, Math.max(bag.get(row.member_id) ?? 0, row.score));
      byWeek.set(key, bag);
    }
    let weekRecord = 0;
    for (const bag of byWeek.values()) {
      let sum = 0;
      for (const score of bag.values()) sum += score;
      weekRecord = Math.max(weekRecord, sum);
    }
    let teamWeek = 0;
    const weekBoard = [...weekBest.values()].sort((a, b) => b.score - a.score).slice(0, 10).map((row, index) => {
      return { place: index + 1, name: row.name, score: row.score };
    });
    for (const row of weekBest.values()) teamWeek += row.score;
    let teamToday = 0;
    for (const score of todayBest.values()) teamToday += score;
    const myToday = await sql<{ attempts: number; best: number }>`
      select count(*)::int as attempts, coalesce(max(score), 0)::int as best
      from game_matches
      where member_id = ${me.id} and mode = 'daily' and status = 'chiusa'
        and (created_at at time zone 'Europe/Rome')::date = ${today}::date`;
    const matchCount = await sql<{ n: number }>`
      select count(*)::int as n from game_matches
      where status = 'chiusa' and mode <> 'training'
        and (created_at at time zone 'Europe/Rome')::date >= ${week}::date`;
    const accuracy = weekArrows ? Math.round((weekHits / weekArrows) * 1000) / 10 : 0;
    const goals = GROUP_GOALS.map((goal) => {
      const current = goal.key === "perfects" ? weekPerfects : goal.key === "arrows" ? weekArrows : goal.key === "accuracy" ? accuracy : matchCount[0]?.n ?? 0;
      const done = goal.key === "accuracy" ? weekArrows >= 30 && current >= goal.target : current >= goal.target;
      return { ...goal, current, done };
    });
    const rewards = await sql<{ code: string }>`select code from game_rewards where member_id = ${me.id}`;
    const history = await sql<{ id: number; mode: string; score: number; hits: number; arrows: number; perfects: number; created_at: string }>`
      select id, mode, score::int, hits::int, arrows::int, perfects::int, created_at
      from game_matches
      where member_id = ${me.id} and status = 'chiusa'
      order by created_at desc
      limit 12`;
    const duels = await sql<{
      id: number;
      challenger_id: number;
      opponent_id: number;
      seed: string;
      challenger_score: number | null;
      opponent_score: number | null;
      challenger_hits: number | null;
      opponent_hits: number | null;
      challenger_perfects: number | null;
      opponent_perfects: number | null;
      status: string;
      created_at: string;
      c_nick: string;
      c_given: string;
      c_family: string;
      o_nick: string;
      o_given: string;
      o_family: string;
    }>`
      select d.*, c.nickname as c_nick, c.given_name as c_given, c.family_name as c_family,
             o.nickname as o_nick, o.given_name as o_given, o.family_name as o_family
      from game_duels d
      join members c on c.id = d.challenger_id
      join members o on o.id = d.opponent_id
      where d.challenger_id = ${me.id} or d.opponent_id = ${me.id}
      order by d.created_at desc
      limit 20`;
    const modes = await sql<{ mode: string; score: number }>`
      select mode, max(score)::int as score
      from game_matches
      where member_id = ${me.id} and status = 'chiusa'
      group by mode`;
    return {
      me: {
        id: me.id,
        xp: stats?.xp ?? 0,
        rank: rank.current.title,
        scene: rank.current.scene,
        nextRank: rank.next?.title ?? null,
        nextXp: rank.next?.xp ?? null,
        record: stats?.record ?? 0,
        matches: stats?.matches ?? 0,
        arrows: stats?.arrows ?? 0,
        hits: stats?.hits ?? 0,
        perfects: stats?.perfects ?? 0,
        bestCombo: stats?.best_combo ?? 0,
        avg: Math.round((stats?.avg ?? 0) * 10) / 10,
        accuracy: stats?.arrows ? Math.round(((stats.hits ?? 0) / stats.arrows) * 1000) / 10 : 0,
        position: position >= 0 ? position + 1 : null,
        of: bestRows.length,
        modes: Object.fromEntries(modes.map((row) => [row.mode, row.score])),
      },
      bestArcher: bestRows[0] ? { name: personName(bestRows[0]), score: bestRows[0].score } : null,
      daily: {
        seed: `daily-${today}`,
        attempts: myToday[0]?.attempts ?? 0,
        max: 3,
        myBest: (myToday[0]?.attempts ?? 0) > 0 ? myToday[0].best : null,
        team: teamToday,
        players: todayBest.size,
      },
      week: {
        team: teamWeek,
        record: weekRecord,
        arrows: weekArrows,
        hits: weekHits,
        perfects: weekPerfects,
        matches: matchCount[0]?.n ?? 0,
        accuracy,
        goals,
      },
      board,
      weekBoard,
      rewards: rewards.map((row) => row.code),
      catalog: REWARDS,
      history: history.map((row) => ({ ...row, label: modeLabel(row.mode) })),
      duels: duels.map((row) => {
        const mineSide = row.challenger_id === me.id;
        return {
          id: row.id,
          seed: row.seed,
          status: row.status,
          createdAt: row.created_at,
          opponent: mineSide ? personName({ nickname: row.o_nick, given_name: row.o_given, family_name: row.o_family }) : personName({ nickname: row.c_nick, given_name: row.c_given, family_name: row.c_family }),
          mine: mineSide ? row.challenger_score : row.opponent_score,
          theirs: mineSide ? row.opponent_score : row.challenger_score,
          myHits: mineSide ? row.challenger_hits : row.opponent_hits,
          theirHits: mineSide ? row.opponent_hits : row.challenger_hits,
          canPlay: mineSide ? row.challenger_score == null && row.status === "aperta" : row.opponent_score == null && row.status === "aperta",
        };
      }),
    };
  });

export const gameBoard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = input as { mode?: string; period?: string };
    const mode = raw.mode && isMode(raw.mode) ? raw.mode : "all";
    const period = raw.period === "week" ? "week" : "all";
    return { mode, period };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const week = weekStartKey(romeYmd());
    const rows = await sql<{ member_id: number; score: number; matches: number; arrows: number; hits: number; perfects: number; xp: number; nickname: string; given_name: string; family_name: string }>`
      select p.id as member_id,
        coalesce(max(g.score) filter (where g.id is not null and (${data.mode} = 'training' or g.mode <> 'training')), 0)::int as score,
        count(g.id)::int as matches,
        coalesce(sum(g.arrows), 0)::int as arrows,
        coalesce(sum(g.hits), 0)::int as hits,
        coalesce(sum(g.perfects), 0)::int as perfects,
        coalesce(sum(g.xp), 0)::int as xp,
        p.nickname, p.given_name, p.family_name
      from members p
      left join game_matches g on g.member_id = p.id
        and g.status = 'chiusa'
        and (${data.mode} = 'all' or g.mode = ${data.mode})
        and (${data.mode} = 'training' or g.mode <> 'training')
        and (${data.period} = 'all' or (g.created_at at time zone 'Europe/Rome')::date >= ${week}::date)
      group by p.id, p.nickname, p.given_name, p.family_name
      order by score desc, p.given_name`;
    return rows.map((row, index) => ({
      place: index + 1,
      memberId: row.member_id,
      name: personName(row),
      score: row.score,
      matches: row.matches,
      arrows: row.arrows,
      hits: row.hits,
      perfects: row.perfects,
      accuracy: row.arrows ? Math.round((row.hits / row.arrows) * 1000) / 10 : 0,
      rank: rankFor(row.xp).current.title,
      me: row.member_id === me.id,
    }));
  });

export const gameCompare = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const memberId = Number((input as { memberId?: number })?.memberId);
    if (!Number.isInteger(memberId)) throw new Error("Scegli un arciere.");
    return { memberId };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const rows = await sql<{ member_id: number; nickname: string; given_name: string; family_name: string; matches: number; arrows: number; hits: number; perfects: number; record: number; avg: number; xp: number }>`
      select g.member_id, p.nickname, p.given_name, p.family_name,
        count(*)::int as matches,
        coalesce(sum(g.arrows), 0)::int as arrows,
        coalesce(sum(g.hits), 0)::int as hits,
        coalesce(sum(g.perfects), 0)::int as perfects,
        coalesce(max(g.score) filter (where g.mode <> 'training'), 0)::int as record,
        coalesce(avg(g.score) filter (where g.mode <> 'training'), 0)::float as avg,
        coalesce(sum(g.xp), 0)::int as xp
      from game_matches g
      join members p on p.id = g.member_id
      where g.status = 'chiusa' and g.member_id in (${me.id}, ${data.memberId})
      group by g.member_id, p.nickname, p.given_name, p.family_name`;
    return rows.map((row) => ({
      memberId: row.member_id,
      name: personName(row),
      me: row.member_id === me.id,
      matches: row.matches,
      arrows: row.arrows,
      hits: row.hits,
      perfects: row.perfects,
      record: row.record,
      avg: Math.round(row.avg * 10) / 10,
      accuracy: row.arrows ? Math.round((row.hits / row.arrows) * 1000) / 10 : 0,
      rank: rankFor(row.xp).current.title,
    }));
  });

async function dropOpen(sql: Awaited<ReturnType<typeof db>>, memberId: number, keepDuel: number | null) {
  await sql`update game_matches set status = 'abbandonata' where member_id = ${memberId} and status = 'aperta'`;
  await sql`
    update game_duels set status = 'annullata'
    where challenger_id = ${memberId} and challenger_score is null and status = 'aperta'
      and (${keepDuel}::int is null or id <> ${keepDuel})`;
}

export const startMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = input as { mode?: string; duelId?: number };
    if (!raw.mode || !isMode(raw.mode) || raw.mode === "duel" && !raw.duelId) throw new Error("Modalità non valida.");
    const duelId = raw.duelId == null ? null : Number(raw.duelId);
    if (duelId != null && !Number.isInteger(duelId)) throw new Error("Sfida non valida.");
    return { mode: raw.mode, duelId };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const today = dayKey(romeYmd());
    if (data.mode === "daily") {
      const attempts = await sql<{ n: number }>`
        select count(*)::int as n from game_matches
        where member_id = ${me.id} and mode = 'daily' and status = 'chiusa'
          and (created_at at time zone 'Europe/Rome')::date = ${today}::date`;
      if ((attempts[0]?.n ?? 0) >= 3) throw new Error("Hai già usato i 3 tentativi di oggi.");
    }
    let seed = `${data.mode}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    let duelId = data.duelId;
    if (data.mode === "daily") seed = `daily-${today}`;
    if (data.mode === "duel" && duelId) {
      const duel = await sql<{ id: number; seed: string; challenger_id: number; opponent_id: number; challenger_score: number | null; opponent_score: number | null; status: string }>`
        select * from game_duels where id = ${duelId} limit 1`;
      const row = duel[0];
      if (!row || row.status !== "aperta") throw new Error("Questa sfida non è più aperta.");
      if (row.challenger_id !== me.id && row.opponent_id !== me.id) throw new Error("Non sei in questa sfida.");
      const already = row.challenger_id === me.id ? row.challenger_score : row.opponent_score;
      if (already != null) throw new Error("Hai già tirato questa sfida.");
      seed = row.seed;
    } else {
      duelId = null;
    }
    await dropOpen(sql, me.id, duelId);
    const inserted = await sql<{ id: number }>`
      insert into game_matches (member_id, mode, seed, duel_id)
      values (${me.id}, ${data.mode}, ${seed}, ${duelId})
      returning id`;
    return { matchId: inserted[0].id, seed, mode: data.mode };
  });

export const createDuel = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const opponentId = Number((input as { opponentId?: number })?.opponentId);
    if (!Number.isInteger(opponentId)) throw new Error("Scegli un avversario.");
    return { opponentId };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (data.opponentId === me.id) throw new Error("Non puoi sfidare te stesso.");
    const other = await sql<{ id: number }>`select id from members where id = ${data.opponentId} limit 1`;
    if (!other[0]) throw new Error("Arciere non trovato.");
    const seed = `duel-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    const duel = await sql<{ id: number }>`
      insert into game_duels (challenger_id, opponent_id, seed)
      values (${me.id}, ${data.opponentId}, ${seed})
      returning id`;
    await dropOpen(sql, me.id, duel[0].id);
    const match = await sql<{ id: number }>`
      insert into game_matches (member_id, mode, seed, duel_id)
      values (${me.id}, 'duel', ${seed}, ${duel[0].id})
      returning id`;
    return { duelId: duel[0].id, matchId: match[0].id, seed, mode: "duel" as const };
  });

export const finishMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = input as { matchId?: number; shots?: unknown };
    const matchId = Number(raw.matchId);
    if (!Number.isInteger(matchId)) throw new Error("Partita non valida.");
    return { matchId, shots: raw.shots };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const found = await sql<{ id: number; mode: string; seed: string; duel_id: number | null; status: string }>`
      select id, mode, seed, duel_id, status from game_matches where id = ${data.matchId} and member_id = ${me.id} limit 1`;
    const match = found[0];
    if (!match) throw new Error("Partita non trovata.");
    if (match.status !== "aperta") throw new Error("Partita già chiusa.");
    if (!isMode(match.mode)) throw new Error("Modalità non valida.");
    const shots = parseShots(data.shots, match.mode);
    if (match.mode === "time" && shots[shots.length - 1].at > 63000) throw new Error("Il tempo è scaduto.");
    const scored = scoreShots(match.mode, match.seed, shots);
    const before = await sql<{ xp: number; n: number }>`
      select coalesce(sum(xp), 0)::int as xp, count(*)::int as n
      from game_matches where member_id = ${me.id} and status = 'chiusa'`;
    const xpBefore = before[0]?.xp ?? 0;
    const rankBefore = rankFor(xpBefore).current.id;
    await sql`
      update game_matches
      set score = ${scored.score}, arrows = ${scored.arrows}, hits = ${scored.hits},
          perfects = ${scored.perfects}, best_combo = ${scored.bestCombo}, xp = ${scored.xp},
          shots = ${JSON.stringify(scored.detail)}::jsonb, status = 'chiusa'
      where id = ${match.id}`;
    let duel: { mine: number; theirs: number | null; opponent: string; winner: "tu" | "avversario" | "pari" | "in_attesa" } | null = null;
    let duelWon = false;
    if (match.duel_id) {
      const rows = await sql<{
        challenger_id: number;
        opponent_id: number;
        challenger_score: number | null;
        opponent_score: number | null;
        c_nick: string;
        c_given: string;
        c_family: string;
        o_nick: string;
        o_given: string;
        o_family: string;
      }>`
        select d.challenger_id, d.opponent_id, d.challenger_score, d.opponent_score,
               c.nickname as c_nick, c.given_name as c_given, c.family_name as c_family,
               o.nickname as o_nick, o.given_name as o_given, o.family_name as o_family
        from game_duels d
        join members c on c.id = d.challenger_id
        join members o on o.id = d.opponent_id
        where d.id = ${match.duel_id} limit 1`;
      const row = rows[0];
      if (row) {
        const mineSide = row.challenger_id === me.id;
        if (mineSide) {
          await sql`update game_duels set challenger_score = ${scored.score}, challenger_hits = ${scored.hits}, challenger_perfects = ${scored.perfects} where id = ${match.duel_id}`;
        } else {
          await sql`update game_duels set opponent_score = ${scored.score}, opponent_hits = ${scored.hits}, opponent_perfects = ${scored.perfects} where id = ${match.duel_id}`;
        }
        const mine = scored.score;
        const theirs = mineSide ? row.opponent_score : row.challenger_score;
        const both = theirs != null;
        if (both) await sql`update game_duels set status = 'chiusa' where id = ${match.duel_id}`;
        const winner = !both ? "in_attesa" : mine > theirs ? "tu" : mine < theirs ? "avversario" : "pari";
        duelWon = winner === "tu";
        duel = {
          mine,
          theirs,
          opponent: mineSide ? personName({ nickname: row.o_nick, given_name: row.o_given, family_name: row.o_family }) : personName({ nickname: row.c_nick, given_name: row.c_given, family_name: row.c_family }),
          winner,
        };
      }
    }
    const xpAfter = xpBefore + scored.xp;
    const codes = rewardsFor({
      matchesBefore: before[0]?.n ?? 0,
      score: scored.score,
      perfects: scored.perfects,
      bestCombo: scored.bestCombo,
      mode: match.mode,
      detail: scored.detail,
      xpAfter,
      duelWon,
    });
    const unlocked: { code: string; title: string }[] = [];
    for (const code of codes) {
      const added = await sql<{ code: string }>`
        insert into game_rewards (member_id, code) values (${me.id}, ${code})
        on conflict do nothing
        returning code`;
      if (added[0]) unlocked.push({ code, title: rewardTitle(code) });
    }
    const placeRows = await sql<{ member_id: number; score: number }>`
      select member_id, max(score)::int as score
      from game_matches
      where status = 'chiusa' and mode <> 'training'
      group by member_id
      order by score desc`;
    const position = placeRows.findIndex((row) => row.member_id === me.id);
    return {
      score: scored.score,
      hits: scored.hits,
      perfects: scored.perfects,
      bestCombo: scored.bestCombo,
      arrows: scored.arrows,
      xp: scored.xp,
      rank: rankFor(xpAfter).current.title,
      rankUp: rankFor(xpAfter).current.id !== rankBefore,
      unlocked,
      position: position >= 0 ? position + 1 : null,
      accuracy: scored.arrows ? Math.round((scored.hits / scored.arrows) * 1000) / 10 : 0,
      duel,
    };
  });
