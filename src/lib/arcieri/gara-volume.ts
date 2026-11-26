import type { db } from "./access";
import { championshipName, oursInGara, type GaraTable, type PortalResult, type Who } from "./fitast-ours";

type Sql = Awaited<ReturnType<typeof db>>;

/** Nel 3D FITAST si tirano 3 frecce a piazzola; una gara ha di solito 20 piazzole (alcune meno, es. 14). */
export const ARROWS_PER_LANE = 3;
export const LANES_DEFAULT = 20;

/** quello che una gara conta per un arciere: piazzole, frecce e punti (stimati se mancano cartellino e piazzole) */
export type GaraLoad = {
  competitionId: number;
  /** numero della gara sul portale FITAST ("" se la gara è solo nell'app) */
  garaId: string;
  name: string;
  day: string;
  /** posto, punti campionato, categoria e spot: dall'app o dal portale */
  rank: number | null;
  champ: number | null;
  category: string;
  spot: number | null;
  /** da dove si sa che c'era: risultato nell'app, classifica del portale o solo «Ho partecipato» */
  source: "app" | "portale" | "presenza";
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

// vuoto resta vuoto: Number(null) darebbe 0 (0 piazzole, posto 0 contato come podio)
const num = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type EntryRow = { user_id: string; competition_id: number; score: number | null; rank: number | null; championship_points: number | null; lane_count: number | null; starts_on: string; lanes: number | null; name: string; notes: string; category: string; spot: number | null };
type CompRow = { id: number; name: string; starts_on: string; lanes: number | null; notes: string };

const fitastIdOf = (notes: string | null | undefined) => /^fitast:(\d+)/.exec(notes ?? "")?.[1] ?? "";

/**
 * I risultati del portale FITAST (classifiche di gara salvate) di ogni arciere dell'app, gara per gara:
 * con il nome FITAST collegato o, se non c'è, con nome e cognome del profilo.
 */
async function portalResults(sql: Sql): Promise<Map<string, { r: PortalResult; title: string; day: string }>[]> {
  const tables = await sql<GaraTable>`
    select gara_id, gara_title, held_on::text as held_on, season, category, rows from fitast_standings
    where kind = 'gara-arcieri' and gara_id <> ''`.catch(() => [] as GaraTable[]);
  if (!tables.length) return [];
  const members = await sql<{ user_id: string; given_name: string; family_name: string; nickname: string; fitast_name: string | null; fitast_team: string | null }>`
    select user_id, given_name, family_name, nickname, fitast_name, fitast_team from members where user_id is not null`.catch(() => []);
  const homes = await sql<{ user_id: string; name: string; fitast_name: string | null }>`
    select cm.user_id, c.name, c.fitast_name from company_members cm join companies c on c.id = cm.company_id`.catch(() => []);
  const homeOf = new Map(homes.map((h) => [h.user_id, h.fitast_name || h.name]));
  const who: Who[] = members.map((m) => ({
    userId: m.user_id,
    fitastName: String(m.fitast_name ?? ""),
    fitastTeam: String(m.fitast_team ?? ""),
    fullName: [m.given_name, m.family_name].filter(Boolean).join(" "),
    givenName: m.given_name ?? "",
    nickname: m.nickname ?? "",
    team: homeOf.get(m.user_id) ?? "",
  }));
  const byGara = new Map<string, GaraTable[]>();
  for (const t of tables) byGara.set(t.gara_id, [...(byGara.get(t.gara_id) ?? []), t]);
  const out: Map<string, { r: PortalResult; title: string; day: string }>[] = [];
  for (const [garaId, list] of byGara) {
    const found = oursInGara(list, who);
    if (!found.size) continue;
    const title = list.find((t) => t.gara_title)?.gara_title ?? "";
    const day = String(list.find((t) => t.held_on)?.held_on ?? "").slice(0, 10);
    const m = new Map<string, { r: PortalResult; title: string; day: string }>();
    for (const [userId, r] of found) m.set(`${userId}|${garaId}`, { r, title, day });
    out.push(m);
  }
  return out;
}

/**
 * Le gare già fatte di un arciere (o di tutti), con piazzole e frecce:
 * 1. dal cartellino fotografato, se c'è;
 * 2. dalle piazzole inserite a mano, se coprono la gara;
 * 3. altrimenti dal numero di piazzole della gara (quelle scritte nell'iscrizione, quelle della gara, o 20) × 3 frecce.
 */
export async function garaLoads(sql: Sql, userId: string | null = null): Promise<Map<string, GaraLoad[]>> {
  const today = new Date().toISOString().slice(0, 10);
  const entryRows = await sql<EntryRow>`
    select e.user_id, e.competition_id, e.score, e.rank, e.championship_points, e.lane_count, c.starts_on::text as starts_on, c.lanes, c.name, c.notes, e.category, e.spot
    from competition_entries e
    join competitions c on c.id = e.competition_id
    where (${userId}::text is null or e.user_id = ${userId}) and c.starts_on <= ${today}::date`.catch(
    () => sql<EntryRow>`
      select e.user_id, e.competition_id, e.score, e.rank, e.championship_points, e.lane_count, c.starts_on::text as starts_on, null::int as lanes, c.name, c.notes, e.category, e.spot
      from competition_entries e
      join competitions c on c.id = e.competition_id
      where (${userId}::text is null or e.user_id = ${userId}) and c.starts_on <= ${today}::date`,
  );
  // gare segnate con «Ho partecipato» (anche senza punteggio) e risultati della classifica del portale
  const presence = await sql<{ user_id: string; competition_id: number }>`
    select p.user_id, p.competition_id from competition_presence p join competitions c on c.id = p.competition_id
    where p.attended and c.starts_on <= ${today}::date and (${userId}::text is null or p.user_id = ${userId})`.catch(() => [] as { user_id: string; competition_id: number }[]);
  const comps = await sql<CompRow>`select id, name, starts_on::text as starts_on, lanes, notes from competitions`.catch(
    () => sql<CompRow>`select id, name, starts_on::text as starts_on, null::int as lanes, notes from competitions`,
  );
  const compById = new Map(comps.map((c) => [Number(c.id), c]));
  const compByGara = new Map<string, CompRow>();
  for (const c of comps) {
    const g = fitastIdOf(c.notes);
    if (g && !compByGara.has(g)) compByGara.set(g, c);
  }
  const portal = await portalResults(sql).catch(() => [] as Map<string, { r: PortalResult; title: string; day: string }>[]);
  type Merged = EntryRow & { source: GaraLoad["source"]; garaId: string };
  const merged = new Map<string, Merged>();
  for (const e of entryRows) merged.set(`${e.user_id}|${Number(e.competition_id)}`, { ...e, source: "app", garaId: fitastIdOf(e.notes) });
  for (const map of portal) {
    for (const [key, x] of map) {
      const [uid, garaId] = key.split("|");
      if (userId && uid !== userId) continue;
      const comp = compByGara.get(garaId);
      const compId = comp ? Number(comp.id) : -Number(garaId);
      const day = (comp?.starts_on ?? x.day ?? "").slice(0, 10);
      if (!day || day > today) continue;
      const k = `${uid}|${compId}`;
      const had = merged.get(k);
      if (had) {
        // il portale completa quello che nell'app manca (punteggio, posto, punti campionato, categoria)
        had.score ??= x.r.score;
        had.rank ??= x.r.place;
        had.championship_points ??= x.r.camp;
        if (!had.category) had.category = x.r.category;
        had.garaId ||= garaId;
        continue;
      }
      merged.set(k, {
        user_id: uid, competition_id: compId, score: x.r.score, rank: x.r.place, championship_points: x.r.camp, lane_count: null,
        starts_on: day, lanes: comp?.lanes ?? null, name: comp?.name || championshipName(x.title) || `Gara ${garaId}`, notes: comp?.notes ?? `fitast:${garaId}`,
        category: x.r.category, spot: null, source: "portale", garaId,
      });
    }
  }
  for (const p of presence) {
    const id = Number(p.competition_id);
    const k = `${p.user_id}|${id}`;
    if (merged.has(k)) continue;
    const c = compById.get(id);
    if (!c) continue;
    merged.set(k, { user_id: p.user_id, competition_id: id, score: null, rank: null, championship_points: null, lane_count: null, starts_on: c.starts_on, lanes: c.lanes, name: c.name, notes: c.notes, category: "", spot: null, source: "presenza", garaId: fitastIdOf(c.notes) });
  }
  const entries = [...merged.values()];
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
    // c'era: un risultato, piazzole o cartellino, la classifica del portale o «Ho partecipato»
    const done = score != null || num(e.rank) != null || num(e.championship_points) != null || !!card || !!rows?.length || e.source !== "app";
    if (!done) continue;
    const info = { garaId: e.garaId, name: e.name ?? "", rank: num(e.rank), champ: num(e.championship_points), category: e.category ?? "", spot: num(e.spot), source: e.source };
    const garaLanes = num(e.lane_count) ?? num(e.lanes) ?? cardLanes.get(id) ?? LANES_DEFAULT;
    let load: GaraLoad;
    if (card) {
      const arrows = card.reduce((a, l) => a + (l.arrows.length || ARROWS_PER_LANE), 0);
      const pts = card.reduce((a, l) => a + l.arrows.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0), 0);
      load = { competitionId: id, ...info, day: e.starts_on.slice(0, 10), piazzole: card.length, arrows, points: score ?? pts, estimated: false };
    } else if (rows?.length) {
      const rowPts = rows.reduce((a, r) => a + r.score, 0);
      const rowArrows = rows.reduce((a, r) => a + (r.arrows.length || ARROWS_PER_LANE), 0);
      const complete = score == null || rowPts >= score || rows.length >= garaLanes;
      const piazzole = complete ? rows.length : Math.max(rows.length, garaLanes);
      load = {
        competitionId: id,
        ...info,
        day: e.starts_on.slice(0, 10),
        piazzole,
        arrows: rowArrows + (piazzole - rows.length) * ARROWS_PER_LANE,
        points: score ?? rowPts,
        estimated: !complete,
      };
    } else {
      // stimate solo se nessuno ha detto quante piazzole aveva la gara (iscrizione, gara o un cartellino)
      const known = num(e.lane_count) != null || num(e.lanes) != null || cardLanes.has(id);
      load = { competitionId: id, ...info, day: e.starts_on.slice(0, 10), piazzole: garaLanes, arrows: garaLanes * ARROWS_PER_LANE, points: score, estimated: !known };
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
