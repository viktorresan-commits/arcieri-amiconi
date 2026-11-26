import type { db } from "./access";

type Sql = Awaited<ReturnType<typeof db>>;

/** Nel 3D FITAST si tirano 3 frecce a piazzola; una gara ha di solito 20 piazzole (alcune meno, es. 14). */
export const ARROWS_PER_LANE = 3;
export const LANES_DEFAULT = 20;

/** quello che una gara conta per un arciere: piazzole, frecce e punti (stimati se mancano cartellino e piazzole) */
export type GaraLoad = {
  competitionId: number;
  day: string;
  piazzole: number;
  arrows: number;
  /** punti della gara; null se si sa solo il posto */
  points: number | null;
  /** true se piazzole e frecce vengono dal numero di piazzole della gara e non dal cartellino */
  estimated: boolean;
};

export type GaraVolume = {
  gare: number;
  piazzole: number;
  arrows: number;
  points: number;
  /** frecce delle gare di cui si conoscono i punti: servono per la media a freccia */
  pointArrows: number;
  estimated: number;
};

const partsOf = (raw: unknown) =>
  String(raw ?? "")
    .split(/[+,\s]+/)
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 0);

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type EntryRow = { user_id: string; competition_id: number; score: number | null; rank: number | null; championship_points: number | null; lane_count: number | null; starts_on: string; lanes: number | null };

/**
 * Le gare già fatte di un arciere (o di tutti), con piazzole e frecce:
 * 1. dal cartellino fotografato, se c'è;
 * 2. dalle piazzole inserite a mano, se coprono la gara;
 * 3. altrimenti dal numero di piazzole della gara (quelle scritte nell'iscrizione, quelle della gara, o 20) × 3 frecce.
 */
export async function garaLoads(sql: Sql, userId: string | null = null): Promise<Map<string, GaraLoad[]>> {
  const today = new Date().toISOString().slice(0, 10);
  const entries = await sql<EntryRow>`
    select e.user_id, e.competition_id, e.score, e.rank, e.championship_points, e.lane_count, c.starts_on::text as starts_on, c.lanes
    from competition_entries e
    join competitions c on c.id = e.competition_id
    where (${userId}::text is null or e.user_id = ${userId}) and c.starts_on <= ${today}::date`.catch(
    () => sql<EntryRow>`
      select e.user_id, e.competition_id, e.score, e.rank, e.championship_points, e.lane_count, c.starts_on::text as starts_on, null::int as lanes
      from competition_entries e
      join competitions c on c.id = e.competition_id
      where (${userId}::text is null or e.user_id = ${userId}) and c.starts_on <= ${today}::date`,
  );
  const laneRows = await sql<{ user_id: string; competition_id: number; n: number; score: number; arrows: string }>`
    select user_id, competition_id, n, score::int as score, arrows from piazzole
    where (${userId}::text is null or user_id = ${userId})`;
  const cardRows = await sql<{ competition_id: number; user_id: string | null; lanes: unknown }>`
    select competition_id, user_id, lanes from gara_cartellini`.catch(() => [] as { competition_id: number; user_id: string | null; lanes: unknown }[]);

  // piazzole di ogni gara: la più alta letta su un cartellino di quella gara
  const cardLanes = new Map<number, number>();
  const ownCard = new Map<string, { p: number; arrows: number[] }[]>();
  for (const row of cardRows) {
    const lanes = (Array.isArray(row.lanes) ? row.lanes : typeof row.lanes === "string" ? (JSON.parse(row.lanes) as unknown[]) : []) as { p?: unknown; arrows?: unknown }[];
    const list = lanes.map((l) => ({ p: Number(l?.p) || 0, arrows: Array.isArray(l?.arrows) ? (l.arrows as unknown[]).map(Number) : [] })).filter((l) => l.p > 0);
    const id = Number(row.competition_id);
    const top = Math.max(0, ...list.map((l) => l.p));
    if (top > (cardLanes.get(id) ?? 0)) cardLanes.set(id, top);
    if (row.user_id && list.length) ownCard.set(`${row.user_id}|${id}`, list);
  }
  const manual = new Map<string, { n: number; score: number; arrows: number[] }[]>();
  for (const row of laneRows) {
    const key = `${row.user_id}|${Number(row.competition_id)}`;
    const list = manual.get(key) ?? [];
    list.push({ n: Number(row.n), score: Number(row.score) || 0, arrows: partsOf(row.arrows) });
    manual.set(key, list);
  }

  const out = new Map<string, GaraLoad[]>();
  for (const e of entries) {
    const id = Number(e.competition_id);
    const key = `${e.user_id}|${id}`;
    const score = num(e.score);
    const card = ownCard.get(key);
    const rows = manual.get(key);
    const done = score != null || num(e.rank) != null || num(e.championship_points) != null || !!card || !!rows?.length;
    if (!done) continue;
    const garaLanes = num(e.lane_count) ?? num(e.lanes) ?? cardLanes.get(id) ?? LANES_DEFAULT;
    let load: GaraLoad;
    if (card) {
      const arrows = card.reduce((a, l) => a + (l.arrows.length || ARROWS_PER_LANE), 0);
      const pts = card.reduce((a, l) => a + l.arrows.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0), 0);
      load = { competitionId: id, day: e.starts_on.slice(0, 10), piazzole: card.length, arrows, points: score ?? pts, estimated: false };
    } else if (rows?.length) {
      const rowPts = rows.reduce((a, r) => a + r.score, 0);
      const rowArrows = rows.reduce((a, r) => a + (r.arrows.length || ARROWS_PER_LANE), 0);
      const complete = score == null || rowPts >= score || rows.length >= garaLanes;
      const piazzole = complete ? rows.length : Math.max(rows.length, garaLanes);
      load = {
        competitionId: id,
        day: e.starts_on.slice(0, 10),
        piazzole,
        arrows: rowArrows + (piazzole - rows.length) * ARROWS_PER_LANE,
        points: score ?? rowPts,
        estimated: !complete,
      };
    } else {
      // stimate solo se nessuno ha detto quante piazzole aveva la gara (iscrizione, gara o un cartellino)
      const known = num(e.lane_count) != null || num(e.lanes) != null || cardLanes.has(id);
      load = { competitionId: id, day: e.starts_on.slice(0, 10), piazzole: garaLanes, arrows: garaLanes * ARROWS_PER_LANE, points: score, estimated: !known };
    }
    const list = out.get(e.user_id) ?? [];
    list.push(load);
    out.set(e.user_id, list);
  }
  return out;
}

export function sumLoads(list: GaraLoad[] | undefined): GaraVolume {
  const v: GaraVolume = { gare: 0, piazzole: 0, arrows: 0, points: 0, pointArrows: 0, estimated: 0 };
  for (const g of list ?? []) {
    v.gare += 1;
    v.piazzole += g.piazzole;
    v.arrows += g.arrows;
    if (g.points != null) {
      v.points += g.points;
      v.pointArrows += g.arrows;
    }
    if (g.estimated) v.estimated += 1;
  }
  return v;
}
