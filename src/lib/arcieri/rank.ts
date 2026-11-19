import { romeDayKey } from "./time";

export type RankShot = {
  userId: string;
  sessionId: number;
  startedAt: string;
  maxArrow: number;
  score: number;
  isX: boolean;
  miss: boolean;
};

export type RankStats = {
  userId: string;
  arrows: number;
  points: number;
  sessions: number;
  lanes: number;
  avg: number | null;
  bestAvg: number | null;
  precisePct: number | null;
  days: number;
  consistency: number | null;
  improvement: number | null;
};

function pack(shots: RankShot[], periodDays: number, spanDays: number | null): Map<string, Omit<RankStats, "improvement">> {
  const byUser = new Map<string, RankShot[]>();
  for (const s of shots) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }
  const out = new Map<string, Omit<RankStats, "improvement">>();
  for (const [userId, list] of byUser) {
    const sessions = new Map<number, RankShot[]>();
    for (const s of list) {
      const bucket = sessions.get(s.sessionId) ?? [];
      bucket.push(s);
      sessions.set(s.sessionId, bucket);
    }
    let train = 0;
    let lanes = 0;
    for (const id of sessions.keys()) {
      if (id > 0) train += 1;
      else lanes += 1;
    }
    const arrows = list.length;
    const points = list.reduce((a, s) => a + s.score, 0);
    const precise = list.filter((s) => !s.miss && (s.isX || s.score >= s.maxArrow - 1)).length;
    let bestAvg: number | null = null;
    for (const bucket of sessions.values()) {
      if (bucket.length < 6) continue;
      const avg = bucket.reduce((a, s) => a + s.score, 0) / bucket.length;
      if (bestAvg == null || avg > bestAvg) bestAvg = avg;
    }
    const days = new Set(list.map((s) => romeDayKey(s.startedAt))).size;
    const denom = periodDays > 0 ? periodDays : spanDays && spanDays > 0 ? spanDays : 0;
    out.set(userId, {
      userId,
      arrows,
      points,
      sessions: train,
      lanes,
      avg: arrows ? points / arrows : null,
      bestAvg,
      precisePct: arrows ? (precise / arrows) * 100 : null,
      days,
      consistency: denom > 0 && sessions.size >= 2 ? Math.min(100, (days / denom) * 100) : null,
    });
  }
  return out;
}

export function buildRanks(current: RankShot[], previous: RankShot[], periodDays: number): RankStats[] {
  let span: number | null = null;
  if (periodDays === 0 && current.length) {
    const times = current.map((s) => new Date(s.startedAt).getTime());
    span = Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 86_400_000) + 1);
  }
  const now = pack(current, periodDays, span);
  const prev = pack(previous, periodDays, span);
  const rows: RankStats[] = [];
  for (const row of now.values()) {
    const before = prev.get(row.userId);
    let improvement: number | null = null;
    if (row.avg != null && before?.avg && row.arrows >= 12 && before.arrows >= 12 && before.avg > 0) {
      improvement = ((row.avg - before.avg) / before.avg) * 100;
    }
    rows.push({ ...row, improvement });
  }
  return rows;
}

export type RankMetric = "avg" | "best" | "points" | "arrows" | "sessions" | "consistency" | "improvement" | "precision";

export function sortRanks(rows: RankStats[], metric: RankMetric) {
  const value = (r: RankStats) => {
    if (metric === "avg") return r.avg;
    if (metric === "best") return r.bestAvg;
    if (metric === "points") return r.points;
    if (metric === "arrows") return r.arrows;
    if (metric === "sessions") return r.sessions;
    if (metric === "consistency") return r.consistency;
    if (metric === "improvement") return r.improvement;
    return r.precisePct;
  };
  return [...rows].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av == null && bv == null) return b.arrows - a.arrows;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  });
}
