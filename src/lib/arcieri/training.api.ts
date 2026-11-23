import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asBool, asIso, asNum, asNumOrNull, canScore, cleanPhoto, clip, db, ensureMember, type MemberRow } from "./access";
import { syncBadges } from "./badges";
import { faceById, scoreAllowed, summarize, asAimAngle, asAimTarget, type TallyShot } from "./scoring";
import { buildRanks, sortRanks, type RankMetric, type RankShot } from "./rank";
import { periodBounds, romeDayKey, type PeriodKind } from "./time";
import { publishNews } from "./news";
import { divisionOf } from "./labels";

const METRICS: RankMetric[] = ["avg", "best", "points", "arrows", "sessions", "consistency", "improvement", "precision"];
const PERIODS: PeriodKind[] = ["day", "week", "month", "year", "all"];

type ShotIn = TallyShot & { nx: number | null; ny: number | null; tag: number | null; set: number | null };

function parseShots(faceId: string, raw: unknown): ShotIn[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > 400) throw new Error("Troppe frecce in una sessione.");
  const face = faceById(faceId);
  const seen = new Set<string>();
  const shots: ShotIn[] = [];
  for (const item of raw) {
    const s = item as Record<string, unknown>;
    const block = asNum(s.block);
    const end = asNum(s.end);
    const arrow = asNum(s.arrow);
    const miss = Boolean(s.miss);
    const isX = Boolean(s.isX) && !miss;
    const score = miss ? 0 : asNum(s.score);
    if (!scoreAllowed(face, score, isX, miss)) throw new Error("Punteggio non valido per questo bersaglio.");
    const key = `${block}:${end}:${arrow}`;
    if (seen.has(key)) throw new Error("Due frecce nello stesso posto della volée.");
    seen.add(key);
    const nx = s.nx == null || s.nx === "" ? null : asNum(s.nx, Number.NaN);
    const ny = s.ny == null || s.ny === "" ? null : asNum(s.ny, Number.NaN);
    if (nx != null && (!Number.isFinite(nx) || Math.abs(nx) > 1.5)) throw new Error("Posizione freccia non valida.");
    if (ny != null && (!Number.isFinite(ny) || Math.abs(ny) > 1.5)) throw new Error("Posizione freccia non valida.");
    const tagN = s.tag == null || s.tag === "" ? null : Math.round(asNum(s.tag, Number.NaN));
    const tag = tagN != null && Number.isFinite(tagN) && tagN >= 0 && tagN <= 999 ? tagN : null;
    const setN = s.set == null || s.set === "" ? null : Math.round(asNum(s.set, Number.NaN));
    const set = setN != null && Number.isFinite(setN) && setN > 0 && setN < 2_000_000_000 ? setN : null;
    shots.push({ block, end, arrow, score, isX, miss, nx, ny, tag, set });
  }
  return shots;
}

export const saveSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const clientKey = clip(raw.clientKey, 80);
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(clientKey)) throw new Error("Bozza non valida.");
    const face = clip(raw.face, 20) || "wa10";
    const started = new Date(String(raw.startedAt ?? ""));
    if (Number.isNaN(started.getTime())) throw new Error("Data non valida.");
    if (started.getTime() > Date.now() + 86_400_000) throw new Error("La data è nel futuro.");
    const ended = raw.endedAt ? new Date(String(raw.endedAt)) : null;
    const distance = Number(raw.distanceM);
    if (!Number.isFinite(distance) || distance < 5 || distance > 200) throw new Error("Distanza non valida.");
    const rating = raw.rating == null || raw.rating === "" ? null : asNum(raw.rating);
    if (rating != null && (rating < 1 || rating > 5)) throw new Error("Valutazione da 1 a 5.");
    const shots = parseShots(face, raw.shots);
    const known = faceById(face);
    const program = clip(raw.program, 4);
    const body = clip(raw.body, 20);
    if (!["", "A", "B", "C", "D", "E"].includes(program)) throw new Error("Obiettivo non valido.");
    if (!["", "fresco", "normale", "affaticato"].includes(body)) throw new Error("Stato fisico non valido.");
    return {
      clientKey,
      startedAt: started.toISOString(),
      endedAt: ended && !Number.isNaN(ended.getTime()) ? ended.toISOString() : null,
      place: clip(raw.place, 80),
      distanceM: Math.round(distance * 10) / 10,
      discipline: clip(raw.discipline, 30) || "indoor",
      bowType: clip(raw.bowType, 30) || "olimpico",
      bowCustom: clip(raw.bowCustom, 40),
      face,
      maxArrow: known.max,
      setupId: raw.setupId == null || raw.setupId === "" ? null : asNum(raw.setupId),
      arrowsPerEnd: Math.min(24, Math.max(1, asNum(raw.arrowsPerEnd, 3))),
      endsPlanned: Math.min(60, Math.max(1, asNum(raw.endsPlanned, 10))),
      blocksPlanned: Math.min(40, Math.max(1, asNum(raw.blocksPlanned, 1))),
      weather: clip(raw.weather, 40),
      feeling: clip(raw.feeling, 400),
      rating,
      notes: clip(raw.notes, 2000),
      durationMs: Math.max(0, Math.min(asNum(raw.durationMs), 86_400_000)),
      timerLimitMs: raw.timerLimitMs == null ? null : Math.max(0, asNum(raw.timerLimitMs)),
      endLimitMs: raw.endLimitMs == null ? null : Math.max(0, asNum(raw.endLimitMs)),
      gearSnapshot: clip(raw.gearSnapshot, 500),
      stringNote: clip(raw.stringNote, 200),
      program,
      body,
      dispersion: clip(raw.dispersion, 400),
      errors: clip(raw.errors, 400),
      targetPhoto: raw.targetPhoto == null || raw.targetPhoto === "" ? "" : (cleanPhoto(raw.targetPhoto) ?? ""),
      aimTarget: asAimTarget(raw.aimTarget),
      aimAngle: asAimAngle(raw.aimAngle),
      shots,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Questo profilo può solo consultare.");
    let setupId = data.setupId;
    if (setupId) {
      const own = await sql`select id from setups where id = ${setupId} and user_id = ${context.userId} limit 1`;
      if (!own[0]) setupId = null;
    }
    const base: unknown[] = [
      data.clientKey,
      context.userId,
      data.startedAt,
      data.endedAt,
      data.place,
      data.distanceM,
      data.discipline,
      data.bowType,
      data.bowCustom,
      data.face,
      data.maxArrow,
      setupId,
      data.arrowsPerEnd,
      data.endsPlanned,
      data.blocksPlanned,
      data.weather,
      data.feeling,
      data.rating,
      data.notes,
      data.durationMs,
      data.timerLimitMs,
      data.endLimitMs,
      data.gearSnapshot,
      data.stringNote,
      data.program,
      data.body,
      data.dispersion,
      data.errors,
      data.targetPhoto,
      data.aimTarget,
      data.aimAngle,
    ];
    // serie di frecce: solo schede "freccia" di chi salva
    const wanted = [...new Set(data.shots.map((s) => s.set).filter((v): v is number => v != null))];
    const mySets = new Set<number>();
    if (wanted.length) {
      const rows = await sql<{ id: number }>`select id from equipment where user_id = ${context.userId} and category = 'freccia' and id = any(string_to_array(${wanted.join(",")}, ',')::int[])`;
      rows.forEach((r) => mySets.add(asNum(r.id)));
    }
    const shotParams: unknown[] = [];
    const tuples: string[] = [];
    data.shots.forEach((s, i) => {
      const b = 32 + i * 10;
      tuples.push(`($${b}::int,$${b + 1}::int,$${b + 2}::int,$${b + 3}::int,$${b + 4}::boolean,$${b + 5}::boolean,$${b + 6}::float8,$${b + 7}::float8,$${b + 8}::int,$${b + 9}::int)`);
      shotParams.push(s.block, s.end, s.arrow, s.score, s.isX, s.miss, s.nx, s.ny, s.tag, s.set != null && mySets.has(s.set) ? s.set : null);
    });
    const header = `
      with up as (
        insert into sessions (
          client_key, user_id, started_at, ended_at, place, distance_m, discipline,
          bow_type, bow_custom, face, max_arrow, setup_id, arrows_per_end, ends_planned,
          blocks_planned, weather, feeling, rating, notes, duration_ms, timer_limit_ms,
          end_limit_ms, gear_snapshot, string_note, program, body, dispersion, tech_errors,
          target_photo, aim_target, aim_angle, updated_at
        ) values (
          $1,$2,$3::timestamptz,$4::timestamptz,$5,$6::float8,$7,$8,$9,$10,$11::int,$12::int,
          $13::int,$14::int,$15::int,$16,$17,$18::int,$19,$20::int,$21::int,$22::int,$23,$24,
          $25,$26,$27,$28,$29,$30,$31, now()
        )
        on conflict (client_key) do update set
          started_at = excluded.started_at,
          ended_at = excluded.ended_at,
          place = excluded.place,
          distance_m = excluded.distance_m,
          discipline = excluded.discipline,
          bow_type = excluded.bow_type,
          bow_custom = excluded.bow_custom,
          face = excluded.face,
          max_arrow = excluded.max_arrow,
          setup_id = excluded.setup_id,
          arrows_per_end = excluded.arrows_per_end,
          ends_planned = excluded.ends_planned,
          blocks_planned = excluded.blocks_planned,
          weather = excluded.weather,
          feeling = excluded.feeling,
          rating = excluded.rating,
          notes = excluded.notes,
          note_done = case when sessions.notes is distinct from excluded.notes and excluded.notes <> '' then false else sessions.note_done end,
          duration_ms = excluded.duration_ms,
          timer_limit_ms = excluded.timer_limit_ms,
          end_limit_ms = excluded.end_limit_ms,
          gear_snapshot = excluded.gear_snapshot,
          string_note = excluded.string_note,
          program = excluded.program,
          body = excluded.body,
          dispersion = excluded.dispersion,
          tech_errors = excluded.tech_errors,
          target_photo = excluded.target_photo,
          aim_target = excluded.aim_target,
          aim_angle = excluded.aim_angle,
          updated_at = now()
        where sessions.user_id = $2
        returning id
      )`;
    const textFixed = data.shots.length
      ? `${header},
        ins as (
          insert into shots (session_id, block_index, end_index, arrow_index, score, is_x, miss, nx, ny, arrow_tag, arrow_set)
          select up.id, v.block_index, v.end_index, v.arrow_index, v.score, v.is_x, v.miss, v.nx, v.ny, v.arrow_tag, v.arrow_set
          from up
          join (values ${tuples.join(",")}) as v(block_index, end_index, arrow_index, score, is_x, miss, nx, ny, arrow_tag, arrow_set) on true
          on conflict (session_id, block_index, end_index, arrow_index) do update set
            arrow_tag = excluded.arrow_tag,
            arrow_set = excluded.arrow_set,
            score = excluded.score,
            is_x = excluded.is_x,
            miss = excluded.miss,
            nx = excluded.nx,
            ny = excluded.ny
          returning session_id, block_index, end_index, arrow_index
        ),
        del as (
          delete from shots
          using up
          where shots.session_id = up.id
            and not exists (
              select 1 from ins
              where ins.session_id = shots.session_id
                and ins.block_index = shots.block_index
                and ins.end_index = shots.end_index
                and ins.arrow_index = shots.arrow_index
            )
        )
        select id::int as id from up`
      : `${header},
        del as (
          delete from shots using up where shots.session_id = up.id
        )
        select id::int as id from up`;
    const saved = await sql.query<{ id: number }>(textFixed, [...base, ...shotParams]);
    if (!saved[0]) throw new Error("Sessione non salvata. Se non è tua, non posso sovrascriverla.");
    const badges = data.endedAt ? await syncBadges(sql, context.userId) : [];
    const tally = summarize(data.shots, data.maxArrow);
    return { id: asNum(saved[0].id), tally, badges };
  });

type SessionRow = {
  id: number;
  client_key: string;
  user_id: string;
  started_at: unknown;
  ended_at: unknown;
  place: string;
  distance_m: unknown;
  discipline: string;
  bow_type: string;
  bow_custom: string;
  face: string;
  max_arrow: number;
  setup_id: number | null;
  arrows_per_end: number;
  ends_planned: number;
  blocks_planned: number;
  weather: string;
  feeling: string;
  rating: number | null;
  notes: string;
  duration_ms: number;
  timer_limit_ms: number | null;
  end_limit_ms: number | null;
  gear_snapshot: string;
  string_note: string;
  program: string;
  body: string;
  dispersion: string;
  tech_errors: string;
  target_photo: string;
  aim_target: string;
  aim_angle: string;
  arrows: number;
  points: number;
};

function card(row: SessionRow, withNotes: boolean) {
  const arrows = asNum(row.arrows);
  const points = asNum(row.points);
  return {
    id: asNum(row.id),
    clientKey: row.client_key,
    userId: row.user_id,
    startedAt: asIso(row.started_at),
    endedAt: row.ended_at ? asIso(row.ended_at) : null,
    place: row.place,
    distanceM: asNum(row.distance_m),
    discipline: row.discipline,
    bowType: row.bow_type,
    bowCustom: row.bow_custom,
    face: row.face,
    maxArrow: asNum(row.max_arrow, 10),
    setupId: asNumOrNull(row.setup_id),
    arrowsPerEnd: asNum(row.arrows_per_end, 3),
    endsPlanned: asNum(row.ends_planned, 1),
    blocksPlanned: asNum(row.blocks_planned, 1),
    weather: row.weather,
    feeling: withNotes ? row.feeling : "",
    rating: asNumOrNull(row.rating),
    notes: withNotes ? row.notes : "",
    durationMs: asNum(row.duration_ms),
    timerLimitMs: asNumOrNull(row.timer_limit_ms),
    endLimitMs: asNumOrNull(row.end_limit_ms),
    gearSnapshot: row.gear_snapshot,
    stringNote: row.string_note,
    program: row.program ?? "",
    body: withNotes ? (row.body ?? "") : "",
    dispersion: withNotes ? (row.dispersion ?? "") : "",
    errors: withNotes ? (row.tech_errors ?? "") : "",
    targetPhoto: withNotes ? (row.target_photo ?? "") : "",
    aimTarget: row.aim_target ?? "",
    aimAngle: row.aim_angle ?? "",
    arrows,
    points,
    avg: arrows ? points / arrows : 0,
  };
}

const SESSION_SELECT = `
  select s.*, count(sh.id)::int as arrows, coalesce(sum(sh.score),0)::int as points
  from sessions s
  left join shots sh on sh.session_id = s.id
`;

export const listSessions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const rows = await sql.query<SessionRow>(
      `${SESSION_SELECT} where s.user_id = $1 group by s.id order by s.started_at desc limit 1000`,
      [context.userId],
    );
    const places = [...new Set(rows.map((r) => r.place).filter(Boolean))].slice(0, 12);
    return { mine: me.role, sessions: rows.map((r) => card(r, true)), places };
  });

export const getSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: number })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const rows = await sql.query<SessionRow>(`${SESSION_SELECT} where s.id = $1 group by s.id`, [data.id]);
    const row = rows[0];
    if (!row) throw new Error("Allenamento non trovato.");
    const own = row.user_id === context.userId;
    if (!own && me.role !== "admin") throw new Error("Questo allenamento non è tuo.");
    const shots = await sql<{
      block_index: number;
      end_index: number;
      arrow_index: number;
      score: number;
      is_x: boolean;
      miss: boolean;
      nx: number | null;
      ny: number | null;
      arrow_tag: number | null;
      arrow_set: number | null;
    }>`
      select block_index, end_index, arrow_index, score, is_x, miss, nx, ny, arrow_tag, arrow_set
      from shots where session_id = ${data.id}
      order by block_index, end_index, arrow_index`;
    let prior: { startedAt: string; arrows: number; avg: number; dispersion: string; errors: string } | null = null;
    if (own && row.program) {
      const prev = await sql.query<{
        started_at: unknown;
        arrows: number;
        points: number;
        dispersion: string;
        tech_errors: string;
      }>(
        `select s.started_at, s.dispersion, s.tech_errors,
                count(sh.id)::int as arrows, coalesce(sum(sh.score),0)::int as points
         from sessions s
         left join shots sh on sh.session_id = s.id
         where s.user_id = $1 and s.program = $2 and s.id <> $3 and s.ended_at is not null
         group by s.id, s.started_at, s.dispersion, s.tech_errors
         order by s.started_at desc
         limit 1`,
        [context.userId, row.program, data.id],
      );
      const previous = prev[0];
      if (previous) {
        const arrows = asNum(previous.arrows);
        prior = {
          startedAt: asIso(previous.started_at),
          arrows,
          avg: arrows ? asNum(previous.points) / arrows : 0,
          dispersion: previous.dispersion ?? "",
          errors: previous.tech_errors ?? "",
        };
      }
    }
    // schede delle frecce dell'assetto: numeri (da/quante) e colori, per numerare i colpi
    let arrowSpecs = "";
    if (row.setup_id) {
      const sp = await sql<{ specs: unknown }>`
        select eq.specs from setups su join equipment eq on eq.id = su.arrow_id and eq.category = 'freccia' where su.id = ${row.setup_id} limit 1`;
      const v = sp[0]?.specs;
      arrowSpecs = typeof v === "string" ? v : v ? JSON.stringify(v) : "";
    }
    // tutte le serie di frecce di chi ha tirato: il numero si sceglie dentro la serie giusta
    const setRows = await sql<{ id: number; name: string; specs: unknown }>`
      select id, name, specs from equipment where user_id = ${row.user_id} and category = 'freccia' order by name, id`;
    const arrowSets = setRows.map((r) => ({ id: asNum(r.id), name: r.name, specs: typeof r.specs === "string" ? r.specs : r.specs ? JSON.stringify(r.specs) : "" }));
    return {
      session: card(row, true),
      prior,
      arrowSpecs,
      arrowSets,
      shots: shots.map((s) => ({
        block: asNum(s.block_index),
        end: asNum(s.end_index),
        arrow: asNum(s.arrow_index),
        score: asNum(s.score),
        isX: asBool(s.is_x),
        miss: asBool(s.miss),
        nx: asNumOrNull(s.nx),
        ny: asNumOrNull(s.ny),
        tag: asNumOrNull(s.arrow_tag),
        set: asNumOrNull(s.arrow_set),
      })),
    };
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: number })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const rows = await sql<{ id: number }>`
      delete from sessions where id = ${data.id} and (${me.role === "admin"} or user_id = ${context.userId})
      returning id`;
    if (!rows[0]) throw new Error("Allenamento non trovato.");
    return { ok: true as const };
  });

type FlatShot = {
  user_id: string;
  session_id: number;
  started_at: unknown;
  distance_m: unknown;
  bow_type: string;
  bow_custom: string;
  face: string;
  discipline: string;
  max_arrow: number;
  score: number;
  is_x: boolean;
  miss: boolean;
};

async function flatShots(from: string | null, to: string | null, bow: string, distance: number | null, face: string, discipline: string) {
  const sql = await db();
  return sql.query<FlatShot>(
    `select s.user_id, s.id as session_id, s.started_at, s.distance_m, s.bow_type, s.bow_custom,
            s.face, s.discipline, s.max_arrow, sh.score, sh.is_x, sh.miss
     from sessions s
     join shots sh on sh.session_id = s.id
     where ($1::timestamptz is null or s.started_at >= $1::timestamptz)
       and ($2::timestamptz is null or s.started_at < $2::timestamptz)
       and ($3::text = '' or s.bow_type = $3)
       and ($4::float8 is null or abs(s.distance_m - $4::float8) < 0.05)
       and ($5::text = '' or s.face = $5)
       and ($6::text = '' or s.discipline = $6)`,
    [from, to, bow, distance, face, discipline],
  );
}

function toRankShots(rows: FlatShot[]): RankShot[] {
  return rows.map((r) => ({
    userId: r.user_id,
    sessionId: asNum(r.session_id),
    startedAt: asIso(r.started_at),
    maxArrow: asNum(r.max_arrow, 10),
    score: asNum(r.score),
    isX: asBool(r.is_x),
    miss: asBool(r.miss),
  }));
}

export const rankings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const metric = METRICS.includes(raw.metric as RankMetric) ? (raw.metric as RankMetric) : "avg";
    const period = PERIODS.includes(raw.period as PeriodKind) ? (raw.period as PeriodKind) : "month";
    const distance = raw.distanceM == null || raw.distanceM === "" ? null : Number(raw.distanceM);
    return {
      metric,
      period,
      bow: clip(raw.bow, 30),
      face: clip(raw.face, 20),
      discipline: clip(raw.discipline, 30),
      distance: distance != null && Number.isFinite(distance) ? distance : null,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const bounds = periodBounds(data.period);
    const current = toRankShots(await flatShots(bounds.from, bounds.to, data.bow, data.distance, data.face, data.discipline));
    if (!data.bow && !data.discipline) {
      const lanes = await sql<{ user_id: string; n: number; arrows: string; score: number; competition_id: number; starts_on: string; target_kind: string | null }>`
        select p.user_id, p.n, p.arrows, p.score::int as score, p.competition_id, c.starts_on::text as starts_on, e.target_kind
        from piazzole p
        join competitions c on c.id = p.competition_id
        left join competition_entries e on e.competition_id = p.competition_id and e.user_id = p.user_id
        where (${bounds.from}::timestamptz is null or c.starts_on >= (${bounds.from}::timestamptz)::date)
          and (${bounds.to}::timestamptz is null or c.starts_on < (${bounds.to}::timestamptz)::date)
          and (${data.distance}::float8 is null or abs(coalesce(p.distance_m, c.distance_m) - ${data.distance}::float8) < 0.05)
          and (
            ${data.face} = ''
            or (${data.face} in ('sagoma8', 'threed') and coalesce(e.target_kind, '') ~* 'sagoma|3d|threed')
            or (${data.face} in ('wa10', 'field6') and coalesce(e.target_kind, '') !~* 'sagoma|3d|threed')
          )`;
      for (const lane of lanes) {
        const raw = String(lane.arrows || "").trim();
        const parts = raw ? raw.split(/[+,\s]+/).map((piece) => Number(piece)).filter((piece) => Number.isFinite(piece)) : [];
        const scores = parts.length ? parts : lane.score > 0 ? [lane.score] : [];
        const sagoma = /sagoma|3d|threed/i.test(lane.target_kind || "");
        for (const value of scores) {
          current.push({
            userId: lane.user_id,
            sessionId: -(lane.competition_id * 100 + lane.n),
            startedAt: `${String(lane.starts_on).slice(0, 10)}T12:00:00.000Z`,
            maxArrow: sagoma ? 8 : 10,
            score: value,
            isX: value >= (sagoma ? 8 : 10),
            miss: value <= 0,
          });
        }
      }
    }
    const previous = bounds.prevFrom
      ? toRankShots(await flatShots(bounds.prevFrom, bounds.prevTo, data.bow, data.distance, data.face, data.discipline))
      : [];
    const ranked = sortRanks(buildRanks(current, previous, bounds.days), data.metric);
    const members = await sql<MemberRow>`select * from members where user_id is not null`;
    const cats = await sql<{ user_id: string; category: string; starts_on: string }>`
      select e.user_id, e.category, c.starts_on::text as starts_on
      from competition_entries e
      join competitions c on c.id = e.competition_id
      where e.category <> ''
      order by c.starts_on`;
    const divisionByUser = new Map<string, string>();
    for (const row of cats) {
      const name = divisionOf(row.category);
      if (name) divisionByUser.set(row.user_id, name);
    }
    const byId = new Map(members.map((m) => [m.user_id, m]));
    let last: number | null = null;
    let position = 0;
    const rows = ranked.map((row, index) => {
      const value =
        data.metric === "avg" ? row.avg
        : data.metric === "best" ? row.bestAvg
        : data.metric === "points" ? row.points
        : data.metric === "arrows" ? row.arrows
        : data.metric === "sessions" ? row.sessions
        : data.metric === "consistency" ? row.consistency
        : data.metric === "improvement" ? row.improvement
        : row.precisePct;
      if (value == null) position = index + 1;
      else if (value !== last) {
        position = index + 1;
        last = value;
      }
      const member = byId.get(row.userId);
      return {
        position,
        givenName: member?.given_name ?? "Arciere",
        familyName: member?.family_name ?? "",
        nickname: member?.nickname ?? "",
        slug: member?.slug ?? "",
        avatarColor: member?.avatar_color ?? "#1f5c38",
        photoUrl: member?.photo_url ?? null,
        division: divisionByUser.get(row.userId) ?? "",
        ...row,
        value,
      };
    });
    const seen = new Set(rows.map((row) => row.userId));
    for (const member of members) {
      if (!member.user_id || seen.has(member.user_id)) continue;
      const numeric = data.metric === "points" || data.metric === "arrows" || data.metric === "sessions";
      rows.push({
        position: rows.length + 1,
        givenName: member.given_name,
        familyName: member.family_name,
        nickname: member.nickname,
        slug: member.slug,
        avatarColor: member.avatar_color,
        photoUrl: member.photo_url,
        division: divisionByUser.get(member.user_id) ?? "",
        userId: member.user_id,
        arrows: 0,
        points: 0,
        sessions: 0,
        lanes: 0,
        avg: null,
        bestAvg: null,
        precisePct: null,
        days: 0,
        consistency: null,
        improvement: null,
        value: numeric ? 0 : null,
      });
    }
    const open = !data.bow || data.distance == null || !data.face || !data.discipline;
    return {
      blocked: null as string | null,
      warning: open
        ? data.bow || data.discipline
          ? "Filtro su arco o disciplina: le gare non hanno l'arco segnato, quindi qui restano solo gli allenamenti."
          : "Totale di allenamenti e piazzole di gara. Filtra se vuoi solo una distanza o un bersaglio."
        : "Allenamenti e piazzole di gara, nello stesso filtro.",
      rows,
    };
  });

export const clearRanking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const period = PERIODS.includes(raw.period as PeriodKind) ? (raw.period as PeriodKind) : "month";
    const distance = raw.distanceM == null || raw.distanceM === "" ? null : Number(raw.distanceM);
    const userId = clip(raw.userId, 80);
    if (!userId) throw new Error("Arciere non trovato.");
    return {
      userId,
      period,
      bow: clip(raw.bow, 30),
      face: clip(raw.face, 20),
      discipline: clip(raw.discipline, 30),
      distance: distance != null && Number.isFinite(distance) ? distance : null,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (data.userId !== context.userId && me.role !== "admin") throw new Error("Puoi togliere solo i tuoi tiri dalla classifica.");
    const bounds = periodBounds(data.period);
    const rows = await sql.query<{ id: number }>(
      `delete from sessions
       where user_id = $1
         and ($2::timestamptz is null or started_at >= $2::timestamptz)
         and ($3::timestamptz is null or started_at < $3::timestamptz)
         and ($4::text = '' or bow_type = $4)
         and ($5::float8 is null or abs(distance_m - $5::float8) < 0.05)
         and ($6::text = '' or face = $6)
         and ($7::text = '' or discipline = $7)
       returning id`,
      [data.userId, bounds.from, bounds.to, data.bow, data.distance, data.face, data.discipline],
    );
    if (!rows.length) throw new Error("Niente da togliere in questo filtro.");
    return { ok: true as const, n: rows.length };
  });

export const dashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const mine = await sql.query<SessionRow>(
      `${SESSION_SELECT} where s.user_id = $1 group by s.id order by s.started_at desc`,
      [context.userId],
    );
    const cards = mine.map((r) => card(r, true));
    const month = periodBounds("month");
    const monthCards = cards.filter((s) => s.startedAt >= (month.from ?? "") && s.startedAt < (month.to ?? "9999"));
    const sum = (list: typeof cards) => {
      const arrows = list.reduce((a, s) => a + s.arrows, 0);
      const points = list.reduce((a, s) => a + s.points, 0);
      return { sessions: list.filter((s) => s.arrows > 0).length, arrows, points, avg: arrows ? points / arrows : 0 };
    };
    const today = new Date().toISOString().slice(0, 10);
    const comps = await sql<{
      id: number;
      name: string;
      starts_on: string;
      place: string;
      signup_deadline: string | null;
    }>`
      select id, name, starts_on::text as starts_on, place, signup_deadline::text as signup_deadline
      from competitions where starts_on >= ${today}::date
      order by starts_on limit 3`;
    if (me.notify_comps) {
      const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
      for (const comp of comps) {
        const deadline = comp.signup_deadline && comp.signup_deadline <= soon;
        const close = comp.starts_on <= soon;
        if (!deadline && !close) continue;
        await sql`
          insert into notifications (user_id, title, body, href, dedupe)
          values (${context.userId}, ${comp.name}, ${deadline ? "Scadenza iscrizioni vicina." : "Gara in calendario."}, ${"/gare"}, ${"comp-" + comp.id + "-" + context.userId})
          on conflict (dedupe) do nothing`;
      }
    }
    const challenges = await sql<{ id: number; title: string; ends_on: string; state: string | null }>`
      select c.id, c.title, c.ends_on::text as ends_on, cm.state
      from challenges c
      left join challenge_members cm on cm.challenge_id = c.id and cm.user_id = ${context.userId}
      where c.cancelled = false and c.ends_on >= ${today}::date
        and (c.open_join = true or cm.user_id is not null)
      order by c.ends_on limit 4`;
    const goals = await sql<{ id: number; title: string; metric: string; target: number; user_id: string | null; bow_type: string; distance_m: number | null }>`
      select id, title, metric, target, user_id, bow_type, distance_m
      from goals where user_id is null or user_id = ${context.userId}
      order by id desc limit 6`;
    try {
      await publishNews(sql, context.userId);
    } catch {
      /* le news non devono bloccare la home */
    }
    const unread = await sql<{ n: number }>`select count(*)::int as n from notifications where user_id = ${context.userId} and read_at is null`;
    const allTrain = sum(cards);
    const fromDay = (month.from ?? "0000").slice(0, 10);
    const toDay = (month.to ?? "9999").slice(0, 10);
    const inMonth = (day: string) => day >= fromDay && day < toDay;
    const trainShots = await sql<{ score: number; miss: boolean; is_x: boolean; max_arrow: number; started_at: string; distance_m: number; session_id: number; shot_id: number; arrow_index: number; arrow_tag: number | null; arrow_specs: string | null }>`
      select sh.score, sh.miss, sh.is_x, s.max_arrow, s.started_at::text as started_at, s.distance_m, s.id as session_id, sh.id as shot_id,
        sh.arrow_index, sh.arrow_tag, coalesce(es.specs, eq.specs) as arrow_specs
      from shots sh
      join sessions s on s.id = sh.session_id
      left join setups su on su.id = s.setup_id
      left join equipment eq on eq.id = su.arrow_id and eq.category = 'freccia'
      left join equipment es on es.id = sh.arrow_set and es.category = 'freccia' and es.user_id = s.user_id
      where s.user_id = ${context.userId}
      order by s.started_at, sh.id`;
    // la freccia "di casa": l'ultima in uso, se nella seduta non c'è un assetto con le frecce
    const homeArrow = await sql<{ specs: string }>`
      select specs from equipment
      where user_id = ${context.userId} and category = 'freccia' and status = 'in_use'
      order by id desc limit 1`;
    const laneRows = await sql<{ n: number; score: number; arrows: string; distance_m: number | null; target_kind: string; starts_on: string; comp_distance: number | null; competition_id: number }>`
      select p.n, p.score, p.arrows, p.distance_m, e.target_kind, c.starts_on::text as starts_on,
        c.distance_m as comp_distance, p.competition_id
      from piazzole p
      join competitions c on c.id = p.competition_id
      join competition_entries e on e.competition_id = p.competition_id and e.user_id = p.user_id
      where p.user_id = ${context.userId}
      order by c.starts_on, p.n`;
    const entryRows = await sql<{ competition_id: number; score: number | null; spot: number | null; lane_count: number | null; starts_on: string; distance_m: number | null }>`
      select e.competition_id, e.score, e.spot, e.lane_count, c.starts_on::text as starts_on, c.distance_m
      from competition_entries e
      join competitions c on c.id = e.competition_id
      where e.user_id = ${context.userId}`;

    const bag = { arrows: 0, points: 0 };
    const monthBag = { arrows: 0, points: 0 };
    let highN = 0;
    let zeroN = 0;
    const bySession = new Map<number, { arrows: number; points: number; day: string }>();
    // at: momento del tiro (per ordinare davvero dalla più recente); link: dove è stata inserita
    const shotMarks: { day: string; at: number; seq: number; score: number; n: number; tag?: number | null; max?: number; distance: number; miss: boolean; isX: boolean; specs: string; link: { kind: "allenamento" | "gara"; id: number } }[] = [];
    let bestDistance = 0;
    const noteDistance = (value: number) => {
      if (value > bestDistance) bestDistance = value;
    };
    const mark = (high: boolean, zero: boolean) => {
      if (high) highN += 1;
      if (zero) zeroN += 1;
    };
    const addShot = (day: string, score: number, sessionId: number | null) => {
      bag.arrows += 1;
      bag.points += score;
      if (inMonth(day)) {
        monthBag.arrows += 1;
        monthBag.points += score;
      }
      if (sessionId != null) {
        const cur = bySession.get(sessionId) ?? { arrows: 0, points: 0, day };
        cur.arrows += 1;
        cur.points += score;
        bySession.set(sessionId, cur);
      }
    };
    const partsOf = (raw: string) => String(raw ?? "").split("+").map((part) => part.trim()).filter(Boolean).map((part) => asNum(part)).filter((part) => Number.isInteger(part) && part >= 0);

    for (const cardRow of cards) noteDistance(cardRow.distanceM);
    for (const shot of trainShots) {
      const score = asNum(shot.score);
      const day = romeDayKey(String(shot.started_at));
      const maxArrow = asNum(shot.max_arrow, 10);
      const miss = asBool(shot.miss) || score <= 0;
      addShot(day, score, asNum(shot.session_id));
      mark(!miss && (asBool(shot.is_x) || score >= maxArrow - 1), miss);
      noteDistance(asNum(shot.distance_m));
      const atRaw = Date.parse(String(shot.started_at).replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
      const at = Number.isFinite(atRaw) ? atRaw : 0;
      shotMarks.push({ day, at, seq: asNum(shot.shot_id), score, n: asNum(shot.arrow_index) + 1, tag: shot.arrow_tag != null ? asNum(shot.arrow_tag) : null, max: asNum(shot.max_arrow, 10), distance: asNum(shot.distance_m), miss, isX: asBool(shot.is_x), specs: shot.arrow_specs ?? "", link: { kind: "allenamento", id: asNum(shot.session_id) } });
    }
    const compsWithArrows = new Set<number>();
    for (const row of laneRows) {
      const day = String(row.starts_on).slice(0, 10);
      const laneDistance = row.distance_m == null ? 0 : asNum(row.distance_m);
      const compDistance = row.comp_distance == null ? 0 : asNum(row.comp_distance);
      noteDistance(laneDistance);
      noteDistance(compDistance);
      const parts = partsOf(row.arrows);
      if (!parts.length) continue;
      const id = asNum(row.competition_id);
      compsWithArrows.add(id);
      const padiglione = row.target_kind === "padiglione";
      for (const score of parts) {
        addShot(day, score, null);
        mark(padiglione ? score >= 9 : score >= 8, score <= 0);
      }
      const at = new Date(`${day}T12:00:00`).getTime() || 0;
      parts.forEach((score, index) => shotMarks.push({ day, at, seq: 1_000_000 + asNum(row.n) * 20 + index, score, n: index + 1, max: padiglione ? 10 : Math.max(11, ...parts), distance: laneDistance || compDistance, miss: score <= 0, isX: false, specs: "", link: { kind: "gara", id } }));
    }
    let monthEvents = monthCards.filter((session) => session.arrows > 0).length;
    const seenMonth = new Set<number>();
    for (const row of entryRows) {
      const day = String(row.starts_on).slice(0, 10);
      const distance = row.distance_m == null ? 0 : asNum(row.distance_m);
      if (distance > bestDistance) bestDistance = distance;
      const id = asNum(row.competition_id);
      const scored = row.score != null || compsWithArrows.has(id) || row.lane_count != null || row.spot != null;
      if (scored && inMonth(day) && !seenMonth.has(id)) {
        seenMonth.add(id);
        monthEvents += 1;
      }
    }
    const squadTrain = await sql<{ user_id: string; distance_m: number; score: number }>`
      select s.user_id, s.distance_m, sh.score
      from shots sh
      join sessions s on s.id = sh.session_id
      where s.distance_m > 0`;
    const squadLanes = await sql<{ user_id: string; distance_m: number | null; comp_distance: number | null; arrows: string; score: number }>`
      select p.user_id, p.distance_m, c.distance_m as comp_distance, p.arrows, p.score
      from piazzole p
      join competitions c on c.id = p.competition_id
      join competition_entries e on e.competition_id = p.competition_id and e.user_id = p.user_id`;
    const freq = new Map<number, number>();
    const cell = new Map<string, { points: number; arrows: number }>();
    const take = (userId: string, meters: number, score: number) => {
      const distance = Math.round(meters);
      if (!(distance > 0)) return;
      const key = `${userId}|${distance}`;
      const cur = cell.get(key) ?? { points: 0, arrows: 0 };
      cur.points += score;
      cur.arrows += 1;
      cell.set(key, cur);
      if (userId === context.userId) freq.set(distance, (freq.get(distance) ?? 0) + 1);
    };
    for (const shot of squadTrain) take(shot.user_id, asNum(shot.distance_m), asNum(shot.score));
    for (const row of squadLanes) {
      const meters = row.distance_m == null ? asNum(row.comp_distance) : asNum(row.distance_m);
      for (const score of partsOf(row.arrows)) take(row.user_id, meters, score);
    }
    let rankDistance = 0;
    let rankArrows = 0;
    for (const [distance, n] of freq) {
      if (n > rankArrows) {
        rankArrows = n;
        rankDistance = distance;
      }
    }
    let rank: { position: number; of: number } | null = null;
    if (rankArrows > 0) {
      const rows: { userId: string; avg: number }[] = [];
      for (const [key, value] of cell) {
        const [userId, distance] = key.split("|");
        if (Number(distance) !== rankDistance || value.arrows <= 0) continue;
        rows.push({ userId, avg: value.points / value.arrows });
      }
      const mineAvg = rows.find((row) => row.userId === context.userId)?.avg;
      if (mineAvg != null) {
        rank = { position: rows.filter((row) => row.avg > mineAvg).length + 1, of: rows.length };
      }
    }
    const averages = [...bySession.values()].filter((row) => row.arrows >= 6).map((row) => row.points / row.arrows);
    const laneGroups = new Map<string, { arrows: number; points: number }>();
    for (const row of laneRows) {
      const parts = partsOf(row.arrows);
      if (parts.length < 1) continue;
      const key = String(asNum(row.competition_id));
      const cur = laneGroups.get(key) ?? { arrows: 0, points: 0 };
      for (const score of parts) {
        cur.arrows += 1;
        cur.points += score;
      }
      laneGroups.set(key, cur);
    }
    for (const row of laneGroups.values()) {
      if (row.arrows >= 6) averages.push(row.points / row.arrows);
    }
    const best = averages.reduce((max, value) => Math.max(max, value), 0);
    const ordered = shotMarks.sort((a, b) => a.day.localeCompare(b.day) || a.at - b.at || a.seq - b.seq);
    const trend = ordered.slice(-60).map((row) => row.score);
    const fallbackSpecs = homeArrow[0]?.specs ?? "";
    // le ultime frecce tirate, con numero, distanza e l'aspetto della freccia (specs come testo JSON)
    const lastShots = ordered.slice(-8).reverse().map((row) => ({
      score: row.score,
      n: row.n,
      distance: row.distance,
      miss: row.miss,
      isX: row.isX,
      day: row.day,
      specs: row.specs || fallbackSpecs,
      tag: row.tag ?? null,
      max: row.max,
      link: row.link,
    }));
    let lastMs = 0;
    for (const session of cards) {
      if (session.arrows <= 0) continue;
      const time = new Date(session.startedAt).getTime();
      if (time > lastMs) lastMs = time;
    }
    for (const row of entryRows) {
      const day = String(row.starts_on).slice(0, 10);
      const id = asNum(row.competition_id);
      const scored = row.score != null || compsWithArrows.has(id) || row.lane_count != null || row.spot != null;
      if (!scored) continue;
      const time = new Date(`${day}T18:00:00`).getTime();
      if (time > lastMs) lastMs = time;
    }
    const elapsedHours = lastMs ? Math.max(0, (Date.now() - lastMs) / 3_600_000) : null;
    const since = elapsedHours == null ? null : elapsedHours < 24 ? { n: Math.max(1, Math.round(elapsedHours)), unit: "h" as const } : { n: Math.max(1, Math.floor(elapsedHours / 24)), unit: "g" as const };
    const compared = highN + zeroN;
    const monthTrain = sum(monthCards);
    // coinvolgimento: giorni di fila con almeno una freccia e frecce della settimana (da lunedì)
    const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const shotDays = new Set(cards.filter((c) => c.arrows > 0).map((c) => dayKey(new Date(c.startedAt))));
    let streak = 0;
    const probe = new Date();
    if (!shotDays.has(dayKey(probe))) probe.setDate(probe.getDate() - 1);
    while (shotDays.has(dayKey(probe))) {
      streak += 1;
      probe.setDate(probe.getDate() - 1);
    }
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weekArrows = cards.filter((c) => new Date(c.startedAt) >= monday).reduce((a, c) => a + c.arrows, 0);
    return {
      month: { sessions: monthEvents, arrows: monthBag.arrows, points: monthBag.points, avg: monthBag.arrows ? monthBag.points / monthBag.arrows : monthTrain.avg },
      all: { ...allTrain, arrows: bag.arrows, points: bag.points, avg: bag.arrows ? bag.points / bag.arrows : 0, bestAvg: best, precisePct: compared ? (highN / compared) * 100 : null },
      bestDistance: bestDistance || null,
      since,
      trend,
      lastShots,
      streak,
      weekArrows,
      last: cards[0] ?? null,
      recent: cards.slice(0, 12).map((s) => ({
        id: s.id,
        startedAt: s.startedAt,
        distanceM: s.distanceM,
        place: s.place,
        arrows: s.arrows,
        avg: s.avg,
        program: s.program,
      })),
      rank,
      nextComp: comps[0] ? { id: asNum(comps[0].id), name: comps[0].name, startsOn: String(comps[0].starts_on).slice(0, 10), place: comps[0].place, signupDeadline: comps[0].signup_deadline } : null,
      challenges: challenges.map((c) => ({ id: asNum(c.id), title: c.title, endsOn: String(c.ends_on).slice(0, 10), state: c.state })),
      goals: goals.map((g) => ({ id: asNum(g.id), title: g.title, metric: g.metric, target: asNum(g.target), collective: !g.user_id })),
      unread: asNum(unread[0]?.n),
    };
  });

export const trainingBootstrap = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const gear = await sql<{ id: number; user_id: string; category: string; name: string; brand: string; model: string; specs: string | null }>`
      select id, user_id, category, name, brand, model, specs from equipment
      where user_id = ${context.userId} or visibility = 'group'
      order by name`;
    const setups = await sql<{ id: number; name: string; bow_id: number | null; arrow_id: number | null; string_note: string }>`
      select id, name, bow_id, arrow_id, string_note from setups where user_id = ${context.userId} order by name`;
    const places = await sql<{ place: string }>`
      select distinct place from sessions where user_id = ${context.userId} and place <> '' order by place limit 12`;
    const recentRows = await sql.query<{
      program: string;
      body: string;
      dispersion: string;
      tech_errors: string;
      feeling: string;
      started_at: unknown;
      planned: number;
      arrows: number;
      points: number;
    }>(
      `select s.program, s.body, s.dispersion, s.tech_errors, s.feeling, s.started_at,
              (s.arrows_per_end * s.ends_planned * s.blocks_planned)::int as planned,
              count(sh.id)::int as arrows, coalesce(sum(sh.score),0)::int as points
       from sessions s
       left join shots sh on sh.session_id = s.id
       where s.user_id = $1 and s.program <> '' and s.ended_at is not null
       group by s.id, s.program, s.body, s.dispersion, s.tech_errors, s.feeling, s.started_at,
                s.arrows_per_end, s.ends_planned, s.blocks_planned
       order by s.started_at desc
       limit 8`,
      [context.userId],
    );
    return {
      canScore: canScore(me.role),
      gear: gear.map((g) => ({ id: asNum(g.id), mine: g.user_id === context.userId, category: g.category, name: g.name, brand: g.brand, model: g.model, specs: typeof g.specs === "string" ? g.specs : g.specs ? JSON.stringify(g.specs) : "" })),
      setups: setups.map((s) => ({ id: asNum(s.id), name: s.name, bowId: asNumOrNull(s.bow_id), arrowId: asNumOrNull(s.arrow_id), stringNote: s.string_note })),
      places: places.map((p) => p.place),
      recent: recentRows.map((row) => {
        const arrows = asNum(row.arrows);
        return {
          program: row.program,
          body: row.body ?? "",
          arrows: arrows,
          planned: asNum(row.planned, arrows),
          avg: arrows ? asNum(row.points) / arrows : 0,
          dispersion: row.dispersion ?? "",
          errors: row.tech_errors ?? "",
          feeling: row.feeling ?? "",
          startedAt: asIso(row.started_at),
        };
      }),
    };
  });

export const statsSeries = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const distance = raw.distanceM == null || raw.distanceM === "" ? null : Number(raw.distanceM);
    return {
      bow: clip(raw.bow, 30),
      face: clip(raw.face, 20),
      discipline: clip(raw.discipline, 30),
      distance: distance != null && Number.isFinite(distance) ? distance : null,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql.query<{
      id: number;
      started_at: unknown;
      distance_m: unknown;
      bow_type: string;
      face: string;
      discipline: string;
      aim_target: string;
      aim_angle: string;
      arrows: number;
      points: number;
    }>(
      `select s.id, s.started_at, s.distance_m, s.bow_type, s.face, s.discipline, s.aim_target, s.aim_angle,
              count(sh.id)::int as arrows, coalesce(sum(sh.score),0)::int as points
       from sessions s join shots sh on sh.session_id = s.id
       where s.user_id = $1
         and ($2::text = '' or s.bow_type = $2)
         and ($3::float8 is null or abs(s.distance_m - $3::float8) < 0.05)
         and ($4::text = '' or s.face = $4)
         and ($5::text = '' or s.discipline = $5)
       group by s.id order by s.started_at`,
      [context.userId, data.bow, data.distance, data.face, data.discipline],
    );
    const dist = await sql.query<{ score: number; is_x: boolean; n: number }>(
      `select sh.score, sh.is_x, count(*)::int as n
       from shots sh join sessions s on s.id = sh.session_id
       where s.user_id = $1
         and ($2::text = '' or s.bow_type = $2)
         and ($3::float8 is null or abs(s.distance_m - $3::float8) < 0.05)
         and ($4::text = '' or s.face = $4)
         and ($5::text = '' or s.discipline = $5)
       group by sh.score, sh.is_x order by sh.score`,
      [context.userId, data.bow, data.distance, data.face, data.discipline],
    );
    const byBow = await sql.query<{ bow_type: string; arrows: number; points: number }>(
      `select s.bow_type, count(sh.id)::int as arrows, coalesce(sum(sh.score),0)::int as points
       from sessions s join shots sh on sh.session_id = s.id
       where s.user_id = $1 group by s.bow_type`,
      [context.userId],
    );
    const byDistance = await sql.query<{ distance_m: unknown; arrows: number; points: number }>(
      `select s.distance_m, count(sh.id)::int as arrows, coalesce(sum(sh.score),0)::int as points
       from sessions s join shots sh on sh.session_id = s.id
       where s.user_id = $1 group by s.distance_m order by s.distance_m`,
      [context.userId],
    );
    const series = rows.map((r) => {
      const arrows = asNum(r.arrows);
      const points = asNum(r.points);
      return {
        id: asNum(r.id),
        startedAt: asIso(r.started_at),
        day: romeDayKey(asIso(r.started_at)),
        distanceM: asNum(r.distance_m),
        bowType: r.bow_type,
        face: r.face,
        discipline: r.discipline,
        aimTarget: r.aim_target ?? "",
        aimAngle: r.aim_angle ?? "",
        arrows,
        avg: arrows ? points / arrows : 0,
      };
    });
    const last30 = series.filter((s) => new Date(s.startedAt).getTime() >= Date.now() - 30 * 86_400_000);
    const prev30 = series.filter((s) => {
      const t = new Date(s.startedAt).getTime();
      return t >= Date.now() - 60 * 86_400_000 && t < Date.now() - 30 * 86_400_000;
    });
    const weighted = (list: typeof series) => {
      const arrows = list.reduce((a, s) => a + s.arrows, 0);
      const points = list.reduce((a, s) => a + s.avg * s.arrows, 0);
      return arrows ? points / arrows : null;
    };
    const a = weighted(last30);
    const b = weighted(prev30);
    return {
      series,
      distribution: dist.map((d) => ({ score: asNum(d.score), isX: asBool(d.is_x), n: asNum(d.n) })),
      byBow: byBow.map((r) => ({ bow: r.bow_type, arrows: asNum(r.arrows), avg: asNum(r.arrows) ? asNum(r.points) / asNum(r.arrows) : 0 })),
      byDistance: byDistance.map((r) => ({ distance: asNum(r.distance_m), arrows: asNum(r.arrows), avg: asNum(r.arrows) ? asNum(r.points) / asNum(r.arrows) : 0 })),
      progress: a != null && b != null && b > 0 ? { recent: a, previous: b, delta: ((a - b) / b) * 100 } : null,
    };
  });

export const calendarMonth = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { y?: number; m?: number };
    const y = asNum(raw.y, new Date().getFullYear());
    const m = asNum(raw.m, new Date().getMonth() + 1);
    if (m < 1 || m > 12) throw new Error("Mese non valido.");
    return { y, m };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const from = `${data.y}-${String(data.m).padStart(2, "0")}-01`;
    const nextM = data.m === 12 ? 1 : data.m + 1;
    const nextY = data.m === 12 ? data.y + 1 : data.y;
    const to = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
    const sessions = await sql<{ id: number; started_at: unknown; place: string; distance_m: unknown }>`
      select id, started_at, place, distance_m from sessions
      where user_id = ${context.userId} and started_at >= ${from}::timestamptz and started_at < ${to}::timestamptz`;
    const comps = await sql<{ id: number; name: string; starts_on: string }>`
      select distinct c.id, c.name, c.starts_on::text as starts_on
      from competitions c
      left join competition_entries e on e.competition_id = c.id and e.user_id = ${context.userId}
      where c.starts_on >= ${from}::date and c.starts_on < ${to}::date`;
    const challenges = await sql<{ id: number; title: string; starts_on: string; ends_on: string }>`
      select c.id, c.title, c.starts_on::text as starts_on, c.ends_on::text as ends_on
      from challenges c
      join challenge_members cm on cm.challenge_id = c.id and cm.user_id = ${context.userId} and cm.state = 'accepted'
      where c.cancelled = false and c.ends_on >= ${from}::date and c.starts_on < ${to}::date`;
    const events = await sql<{ id: number; title: string; starts_on: string; kind: string }>`
      select id, title, starts_on::text as starts_on, kind from events
      where starts_on >= ${from}::date and starts_on < ${to}::date and (user_id is null or user_id = ${context.userId})`;
    const badges = await sql<{ code: string; unlocked_at: unknown }>`
      select code, unlocked_at from user_achievements
      where user_id = ${context.userId} and unlocked_at >= ${from}::timestamptz and unlocked_at < ${to}::timestamptz`;
    const items: { day: string; kind: string; title: string; href: string }[] = [];
    for (const s of sessions) {
      const iso = asIso(s.started_at);
      items.push({ day: romeDayKey(iso), kind: "training", title: `${asNum(s.distance_m)} m${s.place ? " · " + s.place : ""}`, href: `/allenamento/${asNum(s.id)}` });
    }
    for (const c of comps) items.push({ day: String(c.starts_on).slice(0, 10), kind: "comp", title: c.name, href: "/gare" });
    for (const c of challenges) items.push({ day: String(c.starts_on).slice(0, 10), kind: "challenge", title: c.title, href: "/sfide" });
    for (const e of events) items.push({ day: String(e.starts_on).slice(0, 10), kind: "event", title: e.title, href: "/calendario" });
    for (const b of badges) items.push({ day: romeDayKey(asIso(b.unlocked_at)), kind: "badge", title: b.code, href: "/obiettivi" });
    return { items };
  });

export const compareSessions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { a?: number; b?: number };
    return { a: asNum(raw.a), b: asNum(raw.b) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const rows = await sql.query<SessionRow>(`${SESSION_SELECT} where s.id = $1 or s.id = $2 group by s.id`, [data.a, data.b]);
    if (rows.length < 2) throw new Error("Servono due allenamenti.");
    for (const row of rows) {
      if (row.user_id !== context.userId && me.role !== "admin") throw new Error("Puoi confrontare solo i tuoi allenamenti, salvo essere amministratore.");
    }
    const pack = async (row: SessionRow) => {
      const shots = await sql<{ score: number; is_x: boolean; miss: boolean }>`
        select score, is_x, miss from shots where session_id = ${row.id}`;
      const list = shots.map((s) => ({ score: asNum(s.score), isX: asBool(s.is_x), miss: asBool(s.miss), block: 0, end: 0, arrow: 0 }));
      const tally = summarize(list, asNum(row.max_arrow, 10));
      const buckets = new Map<number, number>();
      for (const s of list) buckets.set(s.score, (buckets.get(s.score) ?? 0) + 1);
      return { session: card(row, row.user_id === context.userId || me.role === "admin"), tally, buckets: [...buckets.entries()].map(([score, n]) => ({ score, n })) };
    };
    const a = rows.find((r) => asNum(r.id) === data.a);
    const b = rows.find((r) => asNum(r.id) === data.b);
    if (!a || !b) throw new Error("Allenamento non trovato.");
    const left = await pack(a);
    const right = await pack(b);
    const fair = left.session.distanceM === right.session.distanceM && left.session.face === right.session.face && left.session.discipline === right.session.discipline && left.session.bowType === right.session.bowType;
    const delta = left.tally.arrows && right.tally.arrows ? ((right.tally.avg - left.tally.avg) / (left.tally.avg || 1)) * 100 : null;
    return { left, right, fair, delta };
  });

export const compareArchers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const distance = Number(raw.distanceM);
    if (!Number.isFinite(distance)) throw new Error("Scegli la distanza.");
    const face = clip(raw.face, 20);
    const discipline = clip(raw.discipline, 30);
    const bow = clip(raw.bow, 30);
    if (!face || !discipline || !bow) throw new Error("Arco, bersaglio e disciplina sono obbligatori.");
    const period = PERIODS.includes(raw.period as PeriodKind) ? (raw.period as PeriodKind) : "month";
    return { a: clip(raw.a, 80), b: clip(raw.b, 80), distance, face, discipline, bow, period };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const bounds = periodBounds(data.period);
    const rows = toRankShots(await flatShots(bounds.from, bounds.to, data.bow, data.distance, data.face, data.discipline));
    const table = buildRanks(rows, [], bounds.days);
    const pick = (id: string) => table.find((r) => r.userId === id) ?? null;
    return { a: pick(data.a), b: pick(data.b), fair: true };
  });

/**
 * Rendimento di ogni freccia numerata (serie + numero): media dei punti (in frazione del massimo),
 * dove cade rispetto al gruppo delle altre e quanto si sparpaglia. Serve a trovare la freccia "storta".
 */
export const arrowPerformance = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<{ set_id: number | null; tag: number; n: number; avg: number; mx: number | null; my: number | null; spread: number | null; name: string | null; specs: unknown }>`
      select sh.arrow_set as set_id, sh.arrow_tag as tag, count(*)::int as n,
        avg(case when sh.miss then 0 else sh.score::float / greatest(1, s.max_arrow) end)::float as avg,
        avg(sh.nx)::float as mx, avg(sh.ny)::float as my,
        sqrt(greatest(0, coalesce(var_pop(sh.nx), 0) + coalesce(var_pop(sh.ny), 0)))::float as spread,
        max(e.name) as name, max(e.specs::text) as specs
      from shots sh
      join sessions s on s.id = sh.session_id
      left join equipment e on e.id = sh.arrow_set and e.user_id = s.user_id
      where s.user_id = ${context.userId} and sh.arrow_tag is not null
      group by sh.arrow_set, sh.arrow_tag
      having count(*) >= 3
      order by sh.arrow_set, sh.arrow_tag`;
    return rows.map((r) => ({
      setId: r.set_id == null ? null : asNum(r.set_id),
      setName: r.name ?? "",
      tag: asNum(r.tag),
      n: asNum(r.n),
      avg: asNum(r.avg),
      mx: r.mx == null ? null : asNum(r.mx),
      my: r.my == null ? null : asNum(r.my),
      spread: r.spread == null ? null : asNum(r.spread),
    }));
  });
