import type { TallyShot } from "./scoring";
import type { ActivityKind } from "./kinds";

export type Metric = "total" | "avg" | "tens" | "sessions" | "improvement" | "best" | "rounds" | "points" | "champ" | "rank";

export type Rule = {
  /** tipologia della sfida: allenamento (predefinita), minigioco, gara di campionato */
  kind?: ActivityKind;
  metric: Metric;
  arrows: number | null;
  distanceM: number | null;
  bowType: string;
  face: string;
  discipline: string;
  /** minigioco: bersaglio e livello, tutti uguali */
  gameMode?: string;
  gameLevel?: string;
};

/** cosa si può misurare in ogni tipologia; lowerWins: vince il numero più basso (posizione) */
export const METRICS_BY_KIND: Record<ActivityKind, { id: Metric; label: string; short: string; lowerWins?: boolean }[]> = {
  allenamento: [
    { id: "avg", label: "Miglior media sulle frecce indicate", short: "miglior media" },
    { id: "total", label: "Punteggio più alto sulle frecce indicate", short: "punteggio più alto" },
    { id: "tens", label: "Più 10 nel periodo", short: "più 10" },
    { id: "sessions", label: "Più allenamenti validi", short: "più allenamenti" },
    { id: "improvement", label: "Miglioramento rispetto al periodo prima", short: "miglioramento" },
  ],
  minigioco: [
    { id: "best", label: "Miglior giro", short: "miglior giro" },
    { id: "avg", label: "Media dei giri (almeno 3)", short: "media dei giri" },
    { id: "rounds", label: "Più giri giocati", short: "più giri" },
  ],
  campionato: [
    { id: "points", label: "Somma dei punteggi nelle gare del periodo", short: "somma dei punteggi" },
    { id: "best", label: "Miglior punteggio in una gara", short: "miglior punteggio" },
    { id: "champ", label: "Più punti campionato", short: "punti campionato" },
    { id: "rank", label: "Miglior posizione in classifica", short: "miglior posizione", lowerWins: true },
  ],
};

export const ruleKind = (rule: Pick<Rule, "kind">): ActivityKind => (rule.kind === "minigioco" || rule.kind === "campionato" ? rule.kind : "allenamento");
export const metricInfo = (rule: Pick<Rule, "kind" | "metric">) => METRICS_BY_KIND[ruleKind(rule)].find((m) => m.id === rule.metric) ?? METRICS_BY_KIND[ruleKind(rule)][0];

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
  const kind = ruleKind(rule);
  if (!METRICS_BY_KIND[kind].some((m) => m.id === rule.metric)) return "Scegli cosa conta nella sfida.";
  if (kind === "minigioco") {
    if (!rule.gameMode || !rule.gameLevel) return "Scegli bersaglio e livello del gioco: ogni combinazione ha un punteggio massimo diverso.";
    return null;
  }
  if (kind === "campionato") return null;
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

export function teamMeans(rows: { userId: string; team: string; value: number }[], lowerWins = false) {
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
    .sort((a, b) => (lowerWins ? a.value - b.value : b.value - a.value));
}

/** un giro del minigioco */
export type GameRound = { userId: string; mode: string; level: string; total: number; at: string };

/** sfida di tipo minigioco: stesso bersaglio e livello, nel periodo */
export function gameScores(rule: Rule, rounds: GameRound[], fromIso: string, toIso: string) {
  const byUser = new Map<string, number[]>();
  for (const r of rounds) {
    if (r.mode !== rule.gameMode || r.level !== rule.gameLevel || !inWindow(r.at, fromIso, toIso)) continue;
    const list = byUser.get(r.userId) ?? [];
    list.push(r.total);
    byUser.set(r.userId, list);
  }
  const rows: { userId: string; value: number }[] = [];
  for (const [userId, list] of byUser) {
    if (rule.metric === "rounds") rows.push({ userId, value: list.length });
    else if (rule.metric === "avg") {
      if (list.length >= 3) rows.push({ userId, value: list.reduce((a, b) => a + b, 0) / list.length });
    } else rows.push({ userId, value: Math.max(...list) });
  }
  return rows.sort((x, y) => y.value - x.value);
}

/** un risultato di gara del calendario */
export type GaraScore = { userId: string; day: string; score: number | null; rank: number | null; champ: number | null };

/** sfida di tipo gara di campionato: le gare del calendario fra le due date */
export function garaScores(rule: Rule, results: GaraScore[], fromDay: string, toDay: string) {
  const byUser = new Map<string, GaraScore[]>();
  for (const r of results) {
    if (r.day < fromDay || r.day > toDay) continue;
    const list = byUser.get(r.userId) ?? [];
    list.push(r);
    byUser.set(r.userId, list);
  }
  const rows: { userId: string; value: number }[] = [];
  for (const [userId, list] of byUser) {
    const scores = list.map((r) => r.score).filter((v): v is number => v != null);
    if (rule.metric === "points" && scores.length) rows.push({ userId, value: scores.reduce((a, b) => a + b, 0) });
    if (rule.metric === "best" && scores.length) rows.push({ userId, value: Math.max(...scores) });
    if (rule.metric === "champ") {
      const pts = list.map((r) => r.champ).filter((v): v is number => v != null);
      if (pts.length) rows.push({ userId, value: pts.reduce((a, b) => a + b, 0) });
    }
    if (rule.metric === "rank") {
      const ranks = list.map((r) => r.rank).filter((v): v is number => v != null && v > 0);
      if (ranks.length) rows.push({ userId, value: Math.min(...ranks) });
    }
  }
  return rule.metric === "rank" ? rows.sort((x, y) => x.value - y.value) : rows.sort((x, y) => y.value - x.value);
}
