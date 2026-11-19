import type { TallyShot } from "./scoring";

export type Metric = "total" | "avg" | "tens" | "sessions" | "improvement";

export type Rule = {
  metric: Metric;
  arrows: number | null;
  distanceM: number | null;
  bowType: string;
  face: string;
  discipline: string;
};

export type ChallengeSession = {
  userId: string;
  startedAt: string;
  distanceM: number;
  bowType: string;
  face: string;
  discipline: string;
  shots: TallyShot[];
};

export function rulesFair(rule: Rule): string | null {
  if (!rule.bowType || rule.distanceM == null || !rule.face || !rule.discipline) {
    return "Servono arco, distanza, bersaglio e disciplina. Senza, la sfida mescola tiri che non si possono confrontare.";
  }
  if (rule.metric === "total" && !rule.arrows) {
    return "Il totale punti vale solo se tutti tirano lo stesso numero di frecce.";
  }
  if ((rule.metric === "avg" || rule.metric === "tens") && !rule.arrows) {
    return "Indica quante frecce contano, così una sessione lunga non vince da sola.";
  }
  return null;
}

function matches(s: ChallengeSession, rule: Rule) {
  if (rule.distanceM != null && Math.abs(s.distanceM - rule.distanceM) > 0.05) return false;
  if (rule.bowType && s.bowType !== rule.bowType) return false;
  if (rule.face && s.face !== rule.face) return false;
  if (rule.discipline && s.discipline !== rule.discipline) return false;
  return true;
}

function ordered(s: ChallengeSession) {
  return [...s.shots].sort((a, b) => a.block - b.block || a.end - b.end || a.arrow - b.arrow);
}

function inWindow(iso: string, from: string, to: string) {
  const t = new Date(iso).getTime();
  return t >= new Date(from).getTime() && t < new Date(to).getTime();
}

function sliceShots(s: ChallengeSession, n: number | null) {
  const list = ordered(s);
  if (!n) return list;
  if (list.length < n) return null;
  return list.slice(0, n);
}

export function challengeScores(
  rule: Rule,
  sessions: ChallengeSession[],
  fromIso: string,
  toIso: string,
  prevFromIso?: string | null,
): { userId: string; value: number }[] {
  const current = sessions.filter((s) => matches(s, rule) && inWindow(s.startedAt, fromIso, toIso));
  const byUser = new Map<string, ChallengeSession[]>();
  for (const s of current) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }
  const rows: { userId: string; value: number }[] = [];

  if (rule.metric === "improvement") {
    const prevFrom = prevFromIso ?? fromIso;
    const prev = sessions.filter((s) => matches(s, rule) && inWindow(s.startedAt, prevFrom, fromIso));
    const prevMap = new Map<string, ChallengeSession[]>();
    for (const s of prev) {
      const list = prevMap.get(s.userId) ?? [];
      list.push(s);
      prevMap.set(s.userId, list);
    }
    for (const [userId, list] of byUser) {
      const a = arrowsOf(list, null);
      const b = arrowsOf(prevMap.get(userId) ?? [], null);
      if (a.count < 12 || b.count < 12 || b.avg <= 0) continue;
      rows.push({ userId, value: ((a.avg - b.avg) / b.avg) * 100 });
    }
    return rows.sort((x, y) => y.value - x.value);
  }

  for (const [userId, list] of byUser) {
    if (rule.metric === "sessions") {
      const n = list.filter((s) => s.shots.length > 0).length;
      if (n > 0) rows.push({ userId, value: n });
      continue;
    }
    const samples: number[] = [];
    for (const s of list) {
      const shots = sliceShots(s, rule.arrows);
      if (!shots) continue;
      if (rule.metric === "total") samples.push(shots.reduce((a, x) => a + x.score, 0));
      if (rule.metric === "avg") samples.push(shots.reduce((a, x) => a + x.score, 0) / shots.length);
      if (rule.metric === "tens") samples.push(shots.filter((x) => x.isX || x.score === 10).length);
    }
    if (!samples.length) continue;
    if (rule.metric === "tens") rows.push({ userId, value: samples.reduce((a, b) => a + b, 0) });
    else rows.push({ userId, value: Math.max(...samples) });
  }
  return rows.sort((x, y) => y.value - x.value);
}

function arrowsOf(list: ChallengeSession[], n: number | null) {
  let points = 0;
  let count = 0;
  for (const s of list) {
    const shots = n ? ordered(s).slice(0, n) : ordered(s);
    if (n && ordered(s).length < n) continue;
    for (const shot of shots) {
      points += shot.score;
      count += 1;
    }
  }
  return { count, avg: count ? points / count : 0 };
}

export function teamMeans(rows: { userId: string; team: string; value: number }[]) {
  const map = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.team) continue;
    const list = map.get(row.team) ?? [];
    list.push(row.value);
    map.set(row.team, list);
  }
  return [...map.entries()]
    .map(([team, values]) => ({
      team,
      members: values.length,
      value: values.reduce((a, b) => a + b, 0) / values.length,
    }))
    .sort((a, b) => b.value - a.value);
}
