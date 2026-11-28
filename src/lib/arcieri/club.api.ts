import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asBool, asIso, asNum, asNumOrNull, canScore, clip, db, ensureMember, PRIZES, staffLevel, type MemberRow } from "./access";
import { syncBadges } from "./badges";
import { companyPeers, myMembership } from "./compagnie.api";
import { teamResultsOf } from "./palmares.api";
import { challengeScores, gameScores, garaScores, metricInfo, ruleKind, rulesFair, teamMeans, type Metric, type Rule } from "./challenge";
import { kindOf } from "./kinds";
import { romeDayKey, romeMidnightUtc, ymdAdd } from "./time";
import { divisionOf } from "./labels";
import { accountWriter, writerFor } from "./acting.api";
import { activityXp, allActivityXp } from "./xp.api";
import { fitastRankOf, loadGenerale, type GenTable } from "./fitast-rank";
import { garaLoads, sumLoads, type GaraLoad } from "./gara-volume";
import { champSeasonOf, seasonTag } from "./stagioni";
import { namePattern, pastTables, trustedPast } from "./fitast-past";
import { archersIn, championshipName, matchPerson, nearPerson, oursInGara, peopleOf, pzTablesFor, resultOf, stepsOf, type GaraTable, type PortalResult, type Who } from "./fitast-ours";
import { nameKey } from "./fitast-rank";
import { categoryGroup, teamKey as teamKeyOf, titleName } from "./fitast-league";
import type { TallyShot } from "./scoring";
import { aimSpot, faceById, ringPoint, scoreAtRadius } from "./scoring";

const METRICS: Metric[] = ["total", "avg", "tens", "sessions", "improvement", "best", "rounds", "points", "champ", "rank"];

function optionalInt(value: unknown, min: number, max: number, message: string) {
  if (value == null || value === "") return null;
  const n = asNum(value, Number.NaN);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(message);
  return Math.round(n);
}

function specsOf(raw: unknown) {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  // "flight" tiene le impostazioni del simulatore di volo (JSON): serve più spazio
  for (const [k, v] of Object.entries(src)) out[clip(k, 40)] = clip(v, k === "flight" ? 2400 : 200);
  // troppo lungo: si tolgono prima le voci accessorie (scheda del negozio), poi le ultime, mai un JSON tagliato a metà
  const drop = ["scheda", "purchase", ...Object.keys(out).reverse()];
  while (JSON.stringify(out).length > 4000 && drop.length) delete out[drop.shift() as string];
  return JSON.stringify(out);
}

function readSpecs(raw: string) {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, String(val ?? "")]));
  } catch {
    return {};
  }
}

export const listEquipment = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    // l'inventario è personale: solo i propri pezzi (per mostrarli agli altri c'è il Mercatino)
    const rows = await sql<{
      id: number; user_id: string; visibility: string; category: string; name: string; brand: string; model: string;
      photo_url: string | null; purchased_on: string | null; price_cents: number | null; shop: string; notes: string;
      status: string; specs: string; given_name: string | null; family_name: string | null; nickname: string | null;
    }>`
      select e.id, e.user_id, e.visibility, e.category, e.name, e.brand, e.model, e.photo_url, e.purchased_on::text as purchased_on,
        e.price_cents, e.shop, e.notes, e.status, e.specs, m.given_name, m.family_name, m.nickname
      from equipment e left join members m on m.user_id = e.user_id
      where e.user_id = ${context.userId}
      order by e.category, e.name`;
    return rows.map((r) => ({
      id: asNum(r.id),
      mine: r.user_id === context.userId,
      /** di chi è il pezzo (per l'inventario del gruppo) */
      owner: r.user_id === context.userId ? "" : r.nickname || [r.given_name, r.family_name].filter(Boolean).join(" ") || "un compagno",
      visibility: r.visibility,
      category: r.category,
      name: r.name,
      brand: r.brand,
      model: r.model,
      photoUrl: r.user_id === context.userId || r.visibility === "group" ? r.photo_url : null,
      purchasedOn: r.purchased_on,
      priceCents: r.user_id === context.userId ? asNumOrNull(r.price_cents) : null,
      shop: r.user_id === context.userId ? r.shop : "",
      notes: r.user_id === context.userId ? r.notes : "",
      status: r.status,
      specs: readSpecs(r.specs),
    }));
  });

export const saveEquipment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const name = clip(raw.name, 80);
    if (name.length < 2) throw new Error("Dai un nome al pezzo.");
    const status = clip(raw.status, 20);
    if (!["in_use", "replace", "unused"].includes(status || "in_use")) throw new Error("Stato non valido.");
    const purchased = clip(raw.purchasedOn, 10);
    if (purchased && !/^\d{4}-\d{2}-\d{2}$/.test(purchased)) throw new Error("Data acquisto non valida.");
    const photo = raw.photoUrl == null || raw.photoUrl === "" ? null : String(raw.photoUrl);
    if (photo && photo.length > 180_000) throw new Error("Foto troppo pesante.");
    const specs = specsOf(raw.specs);
    let qty = "";
    try {
      qty = String((JSON.parse(specs) as { qty?: string }).qty ?? "");
    } catch {
      qty = "";
    }
    if (clip(raw.category, 40) === "freccia" && qty && (!/^\d+$/.test(qty) || Number(qty) < 1 || Number(qty) > 200)) {
      throw new Error("Numero frecce non valido.");
    }
    return {
      id: raw.id == null ? null : asNum(raw.id),
      // l'inventario è personale: nessun pezzo è più condiviso con la compagnia
      visibility: "personal" as const,
      category: clip(raw.category, 40) || "altro",
      name,
      brand: clip(raw.brand, 60),
      model: clip(raw.model, 60),
      photoUrl: photo,
      purchasedOn: purchased || null,
      priceCents: raw.priceCents == null || raw.priceCents === "" ? null : Math.max(0, asNum(raw.priceCents)),
      shop: clip(raw.shop, 80),
      notes: clip(raw.notes, 500),
      status: (status || "in_use") as "in_use" | "replace" | "unused",
      specs,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Il visualizzatore non modifica l'inventario.");
    if (data.id) {
      const rows = await sql<{ id: number }>`
        update equipment set
          visibility = ${data.visibility}, category = ${data.category}, name = ${data.name}, brand = ${data.brand},
          model = ${data.model}, photo_url = ${data.photoUrl}, purchased_on = ${data.purchasedOn}::date,
          price_cents = ${data.priceCents}, shop = ${data.shop}, notes = ${data.notes},
          note_done = case when notes is distinct from ${data.notes} and ${data.notes} <> '' then false else note_done end,
          status = ${data.status}, specs = ${data.specs}
        where id = ${data.id} and user_id = ${context.userId}
        returning id`;
      if (!rows[0]) throw new Error("Pezzo non trovato.");
      return { id: asNum(rows[0].id) };
    }
    const rows = await sql<{ id: number }>`
      insert into equipment (user_id, visibility, category, name, brand, model, photo_url, purchased_on, price_cents, shop, notes, status, specs)
      values (${context.userId}, ${data.visibility}, ${data.category}, ${data.name}, ${data.brand}, ${data.model}, ${data.photoUrl},
        ${data.purchasedOn}::date, ${data.priceCents}, ${data.shop}, ${data.notes}, ${data.status}, ${data.specs})
      returning id`;
    return { id: asNum(rows[0].id) };
  });

/**
 * Elimina un pezzo dalla borsa. Gli allenamenti non si toccano mai: le configurazioni che lo usavano passano
 * al pezzo scelto al suo posto (stessa categoria, tuo o del gruppo), oppure restano senza.
 */
export const deleteEquipment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { id?: number; moveTo?: number | null };
    return { id: asNum(raw.id), moveTo: raw.moveTo == null || (raw.moveTo as unknown) === "" ? null : asNum(raw.moveTo) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const own = await sql<{ id: number; category: string }>`
      select id, category from equipment where id = ${data.id} and (user_id = ${context.userId} or (${me.role === "admin"} and visibility = 'group')) limit 1`;
    if (!own[0]) throw new Error("Pezzo non trovato.");
    let moveTo: number | null = null;
    if (data.moveTo && data.moveTo !== data.id) {
      const to = await sql<{ id: number }>`
        select id from equipment where id = ${data.moveTo} and category = ${own[0].category}
          and (user_id = ${context.userId} or visibility = 'group') limit 1`;
      moveTo = to[0] ? asNum(to[0].id) : null;
    }
    // le tue configurazioni passano al pezzo scelto; quelle degli altri (se era un pezzo del gruppo) restano senza
    await sql`update setups set bow_id = case when user_id = ${context.userId} then ${moveTo}::int else null end where bow_id = ${data.id}`;
    await sql`update setups set arrow_id = case when user_id = ${context.userId} then ${moveTo}::int else null end where arrow_id = ${data.id}`;
    await sql`delete from equipment where id = ${data.id}`;
    return { ok: true as const, moveTo };
  });

export const saveSetup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const name = clip(raw.name, 60);
    if (name.length < 2) throw new Error("Dai un nome alla configurazione.");
    return {
      id: raw.id == null ? null : asNum(raw.id),
      name,
      bowId: raw.bowId == null || raw.bowId === "" ? null : asNum(raw.bowId),
      arrowId: raw.arrowId == null || raw.arrowId === "" ? null : asNum(raw.arrowId),
      stringNote: clip(raw.stringNote, 200),
      notes: clip(raw.notes, 400),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    if (data.id) {
      const rows = await sql<{ id: number }>`
        update setups set name = ${data.name}, bow_id = ${data.bowId}, arrow_id = ${data.arrowId},
          string_note = ${data.stringNote}, notes = ${data.notes}
        where id = ${data.id} and user_id = ${context.userId} returning id`;
      if (!rows[0]) throw new Error("Configurazione non trovata.");
      return { id: asNum(rows[0].id) };
    }
    const rows = await sql<{ id: number }>`
      insert into setups (user_id, name, bow_id, arrow_id, string_note, notes)
      values (${context.userId}, ${data.name}, ${data.bowId}, ${data.arrowId}, ${data.stringNote}, ${data.notes})
      returning id`;
    return { id: asNum(rows[0].id) };
  });

export const listSetups = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<{ id: number; name: string; bow_id: number | null; arrow_id: number | null; string_note: string; notes: string }>`
      select id, name, bow_id, arrow_id, string_note, notes from setups where user_id = ${context.userId} order by name`;
    return rows.map((r) => ({
      id: asNum(r.id), name: r.name, bowId: asNumOrNull(r.bow_id), arrowId: asNumOrNull(r.arrow_id), stringNote: r.string_note, notes: r.notes,
    }));
  });

/** Toglie una configurazione: i suoi allenamenti restano e passano a quella scelta (o restano senza). */
export const deleteSetup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { id?: number; moveTo?: number | null };
    return { id: asNum(raw.id), moveTo: raw.moveTo == null || (raw.moveTo as unknown) === "" ? null : asNum(raw.moveTo) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    let moveTo: number | null = null;
    if (data.moveTo && data.moveTo !== data.id) {
      const to = await sql<{ id: number }>`select id from setups where id = ${data.moveTo} and user_id = ${context.userId} limit 1`;
      moveTo = to[0] ? asNum(to[0].id) : null;
    }
    await sql`update sessions set setup_id = ${moveTo} where user_id = ${context.userId} and setup_id = ${data.id}`;
    await sql`delete from setups where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

/** Quanti allenamenti usano ogni configurazione (per chiedere dove spostarli prima di toglierla). */
export const setupUse = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<{ id: number; sessions: number }>`
      select setup_id as id, count(*)::int as sessions from sessions where user_id = ${context.userId} and setup_id is not null group by setup_id`;
    return rows.map((r) => ({ id: asNum(r.id), sessions: Number(r.sessions) || 0 }));
  });

function parseRule(raw: Record<string, unknown>): Rule {
  const metric = METRICS.includes(raw.metric as Metric) ? (raw.metric as Metric) : "avg";
  const distance = Number(raw.distanceM);
  const kind = kindOf(raw.kind);
  // minigioco e gare non hanno arco, distanza e bersaglio da fissare
  if (kind !== "allenamento") {
    const rule: Rule = { kind, metric, arrows: null, distanceM: null, bowType: "", face: "", discipline: "", gameMode: kind === "minigioco" ? clip(raw.gameMode, 20) : "", gameLevel: kind === "minigioco" ? clip(raw.gameLevel, 20) : "" };
    const problem = rulesFair(rule);
    if (problem) throw new Error(problem);
    return rule;
  }
  const rule: Rule = {
    kind,
    metric,
    arrows: raw.arrows == null || raw.arrows === "" ? null : Math.max(1, asNum(raw.arrows)),
    distanceM: Number.isFinite(distance) ? distance : null,
    bowType: clip(raw.bowType, 30),
    face: clip(raw.face, 20),
    discipline: clip(raw.discipline, 30),
  };
  const problem = rulesFair(rule);
  if (problem) throw new Error(problem);
  return rule;
}

export const listChallenges = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<{
      id: number; title: string; rules: string; starts_on: string; ends_on: string; open_join: boolean; cancelled: boolean; created_by: string; state: string | null; team_name: string | null;
    }>`
      select c.id, c.title, c.rules, c.starts_on::text as starts_on, c.ends_on::text as ends_on, c.open_join, c.cancelled, c.created_by,
        cm.state, cm.team_name
      from challenges c
      left join challenge_members cm on cm.challenge_id = c.id and cm.user_id = ${context.userId}
      order by c.ends_on desc, c.id desc`;
    return rows.map((r) => ({
      id: asNum(r.id),
      title: r.title,
      rules: JSON.parse(r.rules) as Rule,
      startsOn: String(r.starts_on).slice(0, 10),
      endsOn: String(r.ends_on).slice(0, 10),
      openJoin: asBool(r.open_join),
      cancelled: asBool(r.cancelled),
      mine: r.created_by === context.userId,
      state: r.state,
      teamName: r.team_name ?? "",
    }));
  });

export const saveChallenge = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const title = clip(raw.title, 80);
    if (title.length < 3) throw new Error("Dai un titolo alla sfida.");
    const starts = clip(raw.startsOn, 10);
    const ends = clip(raw.endsOn, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(starts) || !/^\d{4}-\d{2}-\d{2}$/.test(ends) || ends < starts) {
      throw new Error("Date della sfida non valide.");
    }
    const invites = Array.isArray(raw.invites) ? raw.invites.map((id) => clip(id, 80)).filter(Boolean).slice(0, 30) : [];
    return {
      title,
      starts,
      ends,
      openJoin: Boolean(raw.openJoin),
      team: Boolean(raw.team),
      invites,
      rule: parseRule(raw),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    const rows = await sql<{ id: number }>`
      insert into challenges (created_by, title, rules, starts_on, ends_on, open_join)
      values (${context.userId}, ${data.title}, ${JSON.stringify(data.rule)}, ${data.starts}::date, ${data.ends}::date, ${data.openJoin})
      returning id`;
    const id = asNum(rows[0].id);
    await sql`insert into challenge_members (challenge_id, user_id, state, team_name) values (${id}, ${context.userId}, 'accepted', '')`;
    for (const userId of data.invites) {
      if (userId === context.userId) continue;
      await sql`
        insert into challenge_members (challenge_id, user_id, state, team_name)
        values (${id}, ${userId}, 'invited', '')
        on conflict do nothing`;
      const flags = await sql<{ notify_challenges: boolean }>`select notify_challenges from members where user_id = ${userId} limit 1`;
      if (flags[0]?.notify_challenges !== false) {
        await sql`
          insert into notifications (user_id, title, body, href, dedupe)
          values (${userId}, ${"Sfida: " + data.title}, ${"Puoi accettare o rifiutare."}, ${"/sfide"}, ${"ch-" + id + "-" + userId})
          on conflict (dedupe) do nothing`;
      }
    }
    return { id };
  });

export const respondChallenge = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const action = clip(raw.action, 20);
    if (!["accept", "decline", "join", "cancel"].includes(action)) throw new Error("Azione non valida.");
    return { id: asNum(raw.id), action, teamName: clip(raw.teamName, 40) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (data.action === "cancel") {
      if (me.role !== "admin") {
        const own = await sql`select id from challenges where id = ${data.id} and created_by = ${context.userId}`;
        if (!own[0]) throw new Error("Solo chi ha lanciato la sfida può annullarla.");
      }
      await sql`delete from challenges where id = ${data.id}`;
      return { ok: true as const };
    }
    if (data.action === "join") {
      const ch = await sql<{ open_join: boolean; cancelled: boolean }>`select open_join, cancelled from challenges where id = ${data.id}`;
      if (!ch[0] || ch[0].cancelled || !ch[0].open_join) throw new Error("Questa sfida non è aperta.");
      await sql`
        insert into challenge_members (challenge_id, user_id, state, team_name)
        values (${data.id}, ${context.userId}, 'accepted', ${data.teamName})
        on conflict (challenge_id, user_id) do update set state = 'accepted', team_name = ${data.teamName}`;
      return { ok: true as const };
    }
    const state = data.action === "accept" ? "accepted" : "declined";
    const rows = await sql`
      update challenge_members set state = ${state}, team_name = ${data.teamName}
      where challenge_id = ${data.id} and user_id = ${context.userId}
      returning challenge_id`;
    if (!rows[0]) throw new Error("Non sei stato invitato.");
    return { ok: true as const };
  });

export const challengeBoard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: number })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const ch = await sql<{ rules: string; starts_on: string; ends_on: string; title: string }>`
      select rules, starts_on::text as starts_on, ends_on::text as ends_on, title from challenges where id = ${data.id} limit 1`;
    if (!ch[0]) throw new Error("Sfida non trovata.");
    const rule = JSON.parse(ch[0].rules) as Rule;
    const start = String(ch[0].starts_on).slice(0, 10);
    const end = String(ch[0].ends_on).slice(0, 10);
    const [ys, ms, ds] = start.split("-").map(Number);
    const [ye, me, de] = end.split("-").map(Number);
    const from = romeMidnightUtc(ys, ms, ds);
    const endNext = ymdAdd(ye, me, de, 1);
    const to = romeMidnightUtc(endNext.y, endNext.m, endNext.d);
    const span = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - span);
    const people = await sql<{ user_id: string; state: string; team_name: string }>`
      select user_id, state, team_name from challenge_members where challenge_id = ${data.id} and state = 'accepted'`;
    const ids = people.map((p) => p.user_id);
    if (!ids.length) return { title: ch[0].title, rule, rows: [], teams: [] };
    const kind = ruleKind(rule);
    const lowerWins = Boolean(metricInfo(rule).lowerWins);
    const members = await sql<MemberRow>`select * from members where user_id is not null`;
    const byUser = new Map(members.map((m) => [m.user_id, m]));
    const teamOf = new Map(people.map((p) => [p.user_id, p.team_name]));
    const toRows = (scores: { userId: string; value: number }[]) =>
      scores.map((s, index) => {
        const member = byUser.get(s.userId);
        return {
          position: index + 1,
          userId: s.userId,
          value: s.value,
          givenName: member?.given_name ?? "Arciere",
          familyName: member?.family_name ?? "",
          nickname: member?.nickname ?? "",
          slug: member?.slug ?? "",
          avatarColor: member?.avatar_color ?? "#1f5c38",
          team: teamOf.get(s.userId) ?? "",
        };
      });
    const allowed = new Set(ids);
    // minigioco: i giri del gioco nel periodo, stesso bersaglio e livello
    if (kind === "minigioco") {
      const rounds = await sql<{ user_id: string; mode: string; level: string; total: number; played_at: unknown }>`
        select user_id, mode, level, total, played_at from game_rounds
        where played_at >= ${from.toISOString()}::timestamptz and played_at < ${to.toISOString()}::timestamptz`.catch(() => []);
      const list = rounds.filter((r) => allowed.has(r.user_id)).map((r) => ({ userId: r.user_id, mode: r.mode, level: r.level, total: asNum(r.total), at: asIso(r.played_at) }));
      const rows = toRows(gameScores(rule, list, from.toISOString(), to.toISOString()));
      return { title: ch[0].title, rule, rows, teams: teamMeans(rows.map((r) => ({ userId: r.userId, team: r.team, value: r.value }))) };
    }
    // gara di campionato: i risultati delle gare del calendario fra le due date
    if (kind === "campionato") {
      const res = await sql<{ user_id: string; starts_on: string; score: number | null; rank: number | null; championship_points: number | null }>`
        select e.user_id, c.starts_on::text as starts_on, e.score, e.rank, e.championship_points
        from competition_entries e join competitions c on c.id = e.competition_id
        where c.starts_on >= ${start}::date and c.starts_on <= ${end}::date`;
      const list = res
        .filter((r) => allowed.has(r.user_id))
        .map((r) => ({ userId: r.user_id, day: String(r.starts_on).slice(0, 10), score: asNumOrNull(r.score), rank: asNumOrNull(r.rank), champ: asNumOrNull(r.championship_points) }));
      const rows = toRows(garaScores(rule, list, start, end));
      return { title: ch[0].title, rule, rows, teams: teamMeans(rows.map((r) => ({ userId: r.userId, team: r.team, value: r.value })), lowerWins) };
    }
    const shots = await sql<{
      user_id: string; session_id: number; started_at: unknown; distance_m: unknown; bow_type: string; face: string; discipline: string;
      block_index: number; end_index: number; arrow_index: number; score: number; is_x: boolean; miss: boolean;
    }>`
      select s.user_id, s.id as session_id, s.started_at, s.distance_m, s.bow_type, s.face, s.discipline,
        sh.block_index, sh.end_index, sh.arrow_index, sh.score, sh.is_x, sh.miss
      from sessions s join shots sh on sh.session_id = s.id
      where s.started_at >= ${prevFrom.toISOString()}::timestamptz and s.started_at < ${to.toISOString()}::timestamptz`;
    const grouped = new Map<number, { userId: string; startedAt: string; distanceM: number; bowType: string; face: string; discipline: string; shots: TallyShot[] }>();
    for (const shot of shots) {
      if (!allowed.has(shot.user_id)) continue;
      let bucket = grouped.get(asNum(shot.session_id));
      if (!bucket) {
        bucket = {
          userId: shot.user_id,
          startedAt: asIso(shot.started_at),
          distanceM: asNum(shot.distance_m),
          bowType: shot.bow_type,
          face: shot.face,
          discipline: shot.discipline,
          shots: [],
        };
        grouped.set(asNum(shot.session_id), bucket);
      }
      bucket.shots.push({
        block: asNum(shot.block_index),
        end: asNum(shot.end_index),
        arrow: asNum(shot.arrow_index),
        score: asNum(shot.score),
        isX: asBool(shot.is_x),
        miss: asBool(shot.miss),
      });
    }
    const scores = challengeScores(rule, [...grouped.values()], from.toISOString(), to.toISOString(), prevFrom.toISOString());
    const rows = toRows(scores);
    return { title: ch[0].title, rule, rows, teams: teamMeans(rows.map((r) => ({ userId: r.userId, team: r.team, value: r.value }))) };
  });

/** id della gara FITAST scritto nelle note della gara («fitast:2472»), o "" */
function fitastIdOf(notes: string | null | undefined) {
  return /^fitast:(\d+)/.exec(notes ?? "")?.[1] ?? "";
}

export const listCompetitions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const comps = await sql<{
      id: number; name: string; starts_on: string; place: string; organizer: string; kind: string; distance_m: number | null;
      category: string; signup_deadline: string | null; external_url: string; notes: string; created_by: string; lanes: number | null;
    }>`
      select id, name, starts_on::text as starts_on, place, organizer, kind, distance_m, category,
        signup_deadline::text as signup_deadline, external_url, notes, created_by, lanes
      from competitions order by starts_on`;
    const viewer = await sql<MemberRow>`select * from members where user_id = ${context.userId} limit 1`;
    const staffHere = viewer[0] ? staffLevel(viewer[0]) != null : false;
    const entries = await sql<{ id: number; competition_id: number; user_id: string; score: number | null; rank: number | null; category: string; notes: string; lane_count: number | null; spot: number | null; championship_points: number | null; target_kind: string; sagoma_max: number | null }>`
      select id, competition_id, user_id, score, rank, category, notes, lane_count, spot, championship_points, target_kind, sagoma_max from competition_entries`;
    const lanes = await sql<{ competition_id: number; user_id: string; n: number; score: number; arrows: string; label: string; distance_m: number | null; note: string; aim_angle: string }>`
      select competition_id, user_id, n, score, arrows, label, distance_m, note, aim_angle from piazzole order by n`;
    const presence = await sql<{ competition_id: number; user_id: string; attended: boolean }>`
      select competition_id, user_id, attended from competition_presence`;
    const mine = new Map(presence.filter((row) => row.user_id === context.userId).map((row) => [asNum(row.competition_id), asBool(row.attended)]));
    const members = await sql<MemberRow & { fitast_name?: string; fitast_team?: string }>`select * from members where user_id is not null`;
    // risultati di squadra della propria compagnia (dalla classifica squadre del portale FITAST)
    const myCo = (await myMembership(sql, context.userId)).companyId;
    const teamRows = await teamResultsOf(sql, myCo);
    const linkedTo = (c: { id: number; notes: string }) =>
      teamRows.filter((r) => r.competitionId === asNum(c.id) || (r.fitastId !== "" && new RegExp(`^fitast:${r.fitastId}(\\D|$)`).test(c.notes ?? "")));

    // classifiche di gara del portale: i nostri arcieri (posto, punti, punti campionato) e la tappa del campionato
    const tables = await sql<GaraTable>`
      select gara_id, gara_title, held_on::text as held_on, season, category, rows from fitast_standings
      where kind = 'gara-arcieri' and gara_id <> ''`.catch(() => [] as GaraTable[]);
    const homes = await sql<{ user_id: string; company_id: number; name: string; fitast_name: string }>`
      select cm.user_id, cm.company_id, c.name, c.fitast_name from company_members cm join companies c on c.id = cm.company_id`.catch(() => []);
    const homeOf = new Map(homes.map((h) => [h.user_id, h.fitast_name || h.name]));
    const who: Who[] = members.map((m) => ({
      userId: m.user_id ?? "",
      fitastName: String(m.fitast_name ?? ""),
      fitastTeam: String(m.fitast_team ?? ""),
      fullName: [m.given_name, m.family_name].filter(Boolean).join(" "),
      givenName: m.given_name ?? "",
      nickname: m.nickname ?? "",
      team: homeOf.get(m.user_id ?? "") ?? "",
    }));
    const byGara = new Map<string, GaraTable[]>();
    for (const t of tables) byGara.set(t.gara_id, [...(byGara.get(t.gara_id) ?? []), t]);
    const steps = stepsOf(tables);
    const portal = new Map<string, { ours: Map<string, PortalResult>; total: number; title: string; day: string }>();
    for (const [id, list] of byGara) {
      portal.set(id, { ours: oursInGara(list, who), total: archersIn(list), title: list.find((t) => t.gara_title)?.gara_title ?? "", day: String(list.find((t) => t.held_on)?.held_on ?? "").slice(0, 10) });
    }
    // con chi si era in piazzola: i cartellini letti dalla foto e gli elenchi delle piazzole del portale
    type CardRow = { competition_id: number; piazzola: number; name: string; name_key: string; user_id: string | null; lanes: { p: number; arrows: number[] }[]; total: number | null; spots: number | null };
    const cards = await sql<CardRow>`select competition_id, piazzola, name, name_key, user_id, lanes, total, spots from gara_cartellini`.catch(() => [] as CardRow[]);
    const pzTables = await sql<GaraTable>`
      select gara_id, gara_title, held_on::text as held_on, season, category, rows from fitast_standings
      where kind = 'gara-piazzole' and gara_id <> ''`.catch(() => [] as GaraTable[]);
    // piazzole di ogni gara: quelle scritte nella gara, altrimenti la più alta letta su un cartellino
    const cardTop = new Map<number, number>();
    for (const card of cards) {
      const lanes = Array.isArray(card.lanes) ? card.lanes : [];
      const top = Math.max(0, ...lanes.map((lane) => asNum(lane?.p)));
      if (top > (cardTop.get(asNum(card.competition_id)) ?? 0)) cardTop.set(asNum(card.competition_id), top);
    }
    const meWho = who.find((x) => x.userId === context.userId) ?? null;
    /**
     * le piazzole del portale per una gara: con il suo numero; se il portale le ha date con un altro numero
     * (la pagina delle piazzole e la classifica non sempre coincidono), quelle lette per lo stesso giorno,
     * e fra più gare dello stesso giorno quella in cui ci sono io
     */
    const pzFor = (garaId: string, day: string): GaraTable[] => pzTablesFor(pzTables, garaId, day, (list) => Boolean(meWho && matchPerson(peopleOf(list), meWho)));
    const groupOf = (compId: number, garaId: string, day = "") => {
      const mineKeys = new Set([nameKey(meWho?.fitastName ?? ""), nameKey(meWho?.fullName ?? "")].filter(Boolean));
      const here = cards.filter((c) => asNum(c.competition_id) === compId);
      const myCard = here.find((c) => c.user_id === context.userId) ?? here.find((c) => mineKeys.has(c.name_key)) ?? null;
      const pz = pzFor(garaId, day);
      const pzPeople = pz.length ? peopleOf(pz) : [];
      const meOnPortal = meWho && pzPeople.length ? matchPerson(pzPeople, meWho) : null;
      const portalPz = meOnPortal ? meOnPortal.p.entries[0]?.place ?? null : null;
      const piazzola = myCard?.piazzola || portalPz || 0;
      if (!myCard && !meOnPortal) return null;
      const results = garaId ? peopleOf(byGara.get(garaId) ?? []) : [];
      const resultFor = (key: string, team: string) => {
        const tk = team ? teamKeyOf(team) : "";
        // nome scritto uguale; altrimenti quasi uguale (un errore di battitura tra elenco piazzole e classifica)
        const p = results.find((x) => x.key === key && (!tk || x.teamK === tk)) ?? results.find((x) => x.key === key) ?? (tk ? nearPerson(results, key, tk) : null) ?? nearPerson(results, key);
        return p ? resultOf(p, false) : null;
      };
      const mates = new Map<string, { name: string; team: string; lanes: { p: number; arrows: number[] }[] | null; total: number | null; spots: number | null; place: number | null; category: string; camp: number | null; size: number }>();
      if (myCard) {
        for (const c of here) {
          // io non sono un mio compagno (anche con due righe: il cartellino e quella messa a mano)
          if (c === myCard || c.user_id === context.userId || mineKeys.has(c.name_key) || c.piazzola !== myCard.piazzola) continue;
          const r = resultFor(c.name_key, "");
          mates.set(c.name_key, { name: titleName(c.name), team: r?.team ? titleName(r.team) : "", lanes: Array.isArray(c.lanes) ? c.lanes : null, total: c.total ?? r?.score ?? null, spots: c.spots ?? null, place: r?.place ?? null, category: r?.category ?? "", camp: r?.camp ?? null, size: r?.size ?? 0 });
        }
      }
      // il portale: chi aveva la stessa piazzola (la mia dal portale, o quella scritta sul mio cartellino)
      const pzMine = portalPz ?? (myCard?.piazzola || null);
      // nomi miei per non mettermi fra i compagni: quello collegato, quello del profilo e quello del cartellino
      if (myCard?.name_key) mineKeys.add(myCard.name_key);
      if (pzMine != null && pzPeople.length) {
        for (const p of pzPeople) {
          if (p === meOnPortal?.p || (p.entries[0]?.place ?? null) !== pzMine || mates.has(p.key) || mineKeys.has(p.key)) continue;
          const card = here.find((c) => c.name_key === p.key);
          const r = resultFor(p.key, p.team);
          mates.set(p.key, { name: titleName(p.name), team: titleName(p.team), lanes: card && Array.isArray(card.lanes) ? card.lanes : null, total: card?.total ?? r?.score ?? null, spots: card?.spots ?? null, place: r?.place ?? null, category: r?.category ?? "", camp: r?.camp ?? null, size: r?.size ?? 0 });
        }
      }
      return { piazzola, mates: [...mates.values()].sort((a, b) => (b.total ?? -1) - (a.total ?? -1) || a.name.localeCompare(b.name, "it")) };
    };
    /** l'elenco delle piazzole del portale per questa gara: letto o no, quanti arcieri, la mia piazzola lì */
    // gli elenchi delle piazzole già letti (numero della gara, giorno, arcieri): se una gara non trova il suo, si vede quali ci sono
    const pzKnown = [...new Map(pzTables.map((t) => [t.gara_id, { id: t.gara_id, day: String(t.held_on ?? "").slice(0, 10), n: Array.isArray(t.rows) ? t.rows.length : 0 }])).values()]
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, 4);
    const pzInfoOf = (garaId: string, day = "") => {
      const list = pzFor(garaId, day);
      if (!garaId && !list.length) return null;
      const people = peopleOf(list);
      const me = meWho && people.length ? matchPerson(people, meWho) : null;
      return {
        read: people.length > 0,
        people: people.length,
        mine: me ? me.p.entries[0]?.place ?? null : null,
        lanes: new Set(people.map((p) => p.entries[0]?.place).filter((x) => x != null)).size,
        garaId: list[0]?.gara_id ?? garaId,
        known: people.length ? [] : pzKnown,
      };
    };
    /**
     * la compagnia nell'elenco delle piazzole del portale: chi dei nostri parte da quale piazzola. I nostri sono i
     * profili della compagnia trovati per nome (collegato o nome e cognome) e chi il portale scrive con il nome
     * della compagnia anche se nell'app non c'è. null: l'elenco della gara non è ancora stato letto
     */
    const coUsers = new Set(homes.filter((h) => asNum(h.company_id) === myCo).map((h) => h.user_id));
    const coHome = homes.find((h) => asNum(h.company_id) === myCo);
    const ourTeamKeys = new Set([coHome?.name, coHome?.fitast_name].filter((x): x is string => Boolean(x)).map((x) => teamKeyOf(x)).filter((k) => k.length >= 3));
    const ourWho = who.filter((w) => coUsers.has(w.userId));
    const ourPzOf = (garaId: string, day = "") => {
      const list = pzFor(garaId, day);
      if (!list.length) return null;
      const people = peopleOf(list);
      const found = new Map<string, { name: string; piazzola: number; userId: string | null }>();
      for (const w of ourWho) {
        const m = matchPerson(people, w);
        const pz = m?.p.entries[0]?.place ?? null;
        if (m && pz != null && !found.has(m.p.key)) found.set(m.p.key, { name: titleName(m.p.name), piazzola: pz, userId: w.userId });
      }
      for (const p of people) {
        const pz = p.entries[0]?.place ?? null;
        if (pz != null && !found.has(p.key) && ourTeamKeys.has(p.teamK)) found.set(p.key, { name: titleName(p.name), piazzola: pz, userId: null });
      }
      return [...found.values()].sort((a, b) => a.piazzola - b.piazzola || a.name.localeCompare(b.name, "it"));
    };
    const memberOf = (userId: string) => members.find((m) => m.user_id === userId);
    const face = (userId: string) => {
      const m = memberOf(userId);
      return { givenName: m?.given_name ?? "", familyName: m?.family_name ?? "", nickname: m?.nickname ?? "", slug: m?.slug ?? "", photoUrl: m?.photo_url ?? null, avatarColor: m?.avatar_color ?? "#1f5c38" };
    };
    const fitastOf = (garaId: string) => {
      const g = garaId ? portal.get(garaId) : undefined;
      if (!garaId) return null;
      const step = steps.get(garaId);
      return {
        garaId,
        step: step?.n ?? 0,
        champ: step?.champ || championshipName(g?.title ?? ""),
        total: g?.total ?? 0,
        read: Boolean(g),
        // i nostri come li scrive il portale: per evidenziarli nella classifica della gara
        ours: g ? [...g.ours.entries()].map(([userId, r]) => ({ userId, name: r.name, team: r.team, category: r.category, place: r.place })) : [],
      };
    };
    type EntryOut = {
      id: number; userId: string; score: number | null; rank: number | null; laneCount: number | null; spot: number | null; championshipPoints: number | null;
      targetKind: "" | "sagoma" | "padiglione"; sagomaMax: 10 | 8 | 11 | null; category: string; notes: string;
      givenName: string; familyName: string; nickname: string; slug: string; photoUrl: string | null; avatarColor: string;
      piazzole: { n: number; score: number; arrows: number[]; label: string; distanceM: number | null; note: string; aimAngle: string }[];
      /** dal portale FITAST: solo il portale (nessun punteggio segnato nell'app) o anche il portale */
      portal: "" | "solo" | "anche";
      /** arcieri nella sua categoria, secondo il portale */
      categorySize: number | null;
    };
    const entriesOf = (compId: number, garaId: string): EntryOut[] => {
      const found = garaId ? portal.get(garaId)?.ours ?? new Map<string, PortalResult>() : new Map<string, PortalResult>();
      const out: EntryOut[] = entries.filter((e) => asNum(e.competition_id) === compId).map((e) => {
        const r = found.get(e.user_id);
        return {
          id: asNum(e.id),
          userId: e.user_id,
          score: asNumOrNull(e.score) ?? r?.score ?? null,
          // il posto e la categoria veri sono quelli del portale
          rank: r?.place ?? asNumOrNull(e.rank),
          laneCount: asNumOrNull(e.lane_count),
          spot: asNumOrNull(e.spot),
          championshipPoints: r?.camp ?? asNumOrNull(e.championship_points),
          targetKind: e.target_kind === "sagoma" ? "sagoma" : e.target_kind === "padiglione" ? "padiglione" : "",
          sagomaMax: e.sagoma_max === 10 || e.sagoma_max === 8 || e.sagoma_max === 11 ? e.sagoma_max : null,
          category: r?.category || e.category,
          notes: e.user_id === context.userId ? e.notes : "",
          ...face(e.user_id),
          piazzole: lanes
            .filter((p) => asNum(p.competition_id) === compId && p.user_id === e.user_id)
            .map((p) => ({
              n: asNum(p.n),
              score: asNum(p.score),
              arrows: String(p.arrows ?? "")
                .split("+")
                .map((part) => part.trim())
                .filter(Boolean)
                .map((part) => asNum(part))
                .filter((part) => Number.isInteger(part) && part >= 0),
              label: String(p.label ?? ""),
              distanceM: p.distance_m == null ? null : asNum(p.distance_m),
              note: String(p.note ?? ""),
              aimAngle: String(p.aim_angle ?? ""),
            })),
          portal: r ? "anche" : "",
          categorySize: r?.size || null,
        };
      });
      // chi è nella classifica del portale ma non ha segnato nulla nell'app: il risultato del portale
      let k = 0;
      for (const [userId, r] of found) {
        if (out.some((e) => e.userId === userId)) continue;
        k += 1;
        out.push({
          id: -(Math.abs(compId) * 1000 + k),
          userId,
          score: r.score,
          rank: r.place,
          laneCount: null,
          spot: null,
          championshipPoints: r.camp,
          targetKind: "",
          sagomaMax: null,
          category: r.category,
          notes: "",
          ...face(userId),
          piazzole: [],
          portal: "solo",
          categorySize: r.size || null,
        });
      }
      return out;
    };
    const rosterOf = (compId: number, garaId: string) => {
      const found = garaId ? portal.get(garaId)?.ours ?? new Map<string, PortalResult>() : new Map<string, PortalResult>();
      const rows = presence.filter((row) => asNum(row.competition_id) === compId).map((row) => ({ userId: row.user_id, attended: asBool(row.attended) || found.has(row.user_id), ...face(row.user_id) }));
      // nella classifica del portale vuol dire che c'era
      for (const userId of found.keys()) if (!rows.some((r) => r.userId === userId)) rows.push({ userId, attended: true, ...face(userId) });
      return rows;
    };
    const listed = new Set<string>();
    const out = comps.map((c) => {
      const garaId = fitastIdOf(c.notes);
      if (garaId) listed.add(garaId);
      const iWas = garaId ? portal.get(garaId)?.ours.has(context.userId) ?? false : false;
      return {
        id: asNum(c.id),
        name: c.name,
        startsOn: String(c.starts_on).slice(0, 10),
        place: c.place,
        organizer: c.organizer,
        kind: c.kind,
        distanceM: asNumOrNull(c.distance_m),
        lanes: asNumOrNull(c.lanes) ?? cardTop.get(asNum(c.id)) ?? null,
        category: c.category,
        signupDeadline: c.signup_deadline ? String(c.signup_deadline).slice(0, 10) : null,
        externalUrl: c.external_url,
        notes: c.notes,
        // la elimina per tutti solo il fondatore
        canDelete: staffHere,
        teamResults: linkedTo(c),
        attended: iWas ? true : mine.has(asNum(c.id)) ? mine.get(asNum(c.id)) ?? null : null,
        roster: rosterOf(asNum(c.id), garaId),
        entries: entriesOf(asNum(c.id), garaId),
        fitast: fitastOf(garaId),
        /** con chi si era in piazzola (cartellini e portale) */
        group: groupOf(asNum(c.id), garaId, String(c.starts_on).slice(0, 10)),
        pzInfo: pzInfoOf(garaId, String(c.starts_on).slice(0, 10)),
        /** chi della compagnia parte da quale piazzola (elenco delle piazzole del portale) */
        ourPz: garaId ? ourPzOf(garaId, String(c.starts_on).slice(0, 10)) : null,
        /** solo dal portale: nessuna gara nell'app (niente presenza né punteggio da segnare) */
        virtual: false,
      };
    });
    // gare del portale che nell'app non ci sono, ma con dentro qualcuno dei nostri
    for (const [garaId, g] of portal) {
      if (listed.has(garaId) || !g.ours.size || !g.day) continue;
      const id = -Number(garaId);
      out.push({
        id,
        name: championshipName(g.title) || `Gara ${garaId}`,
        startsOn: g.day,
        place: "",
        organizer: "",
        kind: "campionato",
        distanceM: null,
        lanes: null as number | null,
        category: "",
        signupDeadline: null,
        externalUrl: "",
        notes: `fitast:${garaId}`,
        canDelete: false,
        teamResults: teamRows.filter((r) => r.fitastId === garaId),
        attended: g.ours.has(context.userId) ? true : null,
        roster: rosterOf(id, garaId),
        entries: entriesOf(id, garaId),
        fitast: fitastOf(garaId),
        group: groupOf(id, garaId, g.day),
        pzInfo: pzInfoOf(garaId, g.day),
        ourPz: ourPzOf(garaId, g.day),
        virtual: true,
      });
    }
    // gare in arrivo del portale che nell'app non ci sono: con l'elenco delle piazzole già uscito e dentro qualcuno
    // della compagnia (la classifica ancora non c'è, ma si sa chi parte da dove)
    const today = romeDayKey(new Date().toISOString());
    for (const t of pzTables) {
      const garaId = t.gara_id;
      const day = String(t.held_on ?? "").slice(0, 10);
      if (!garaId || !day || day < today || listed.has(garaId) || portal.has(garaId) || out.some((c) => c.notes === `fitast:${garaId}`)) continue;
      const ourPz = ourPzOf(garaId, day);
      if (!ourPz?.length) continue;
      const id = -Number(garaId);
      out.push({
        id,
        name: championshipName(t.gara_title) || titleName(t.gara_title) || `Gara ${garaId}`,
        startsOn: day,
        place: "",
        organizer: "",
        kind: "campionato",
        distanceM: null,
        lanes: null as number | null,
        category: "",
        signupDeadline: null,
        externalUrl: "",
        notes: `fitast:${garaId}`,
        canDelete: false,
        teamResults: [],
        attended: ourPz.some((x) => x.userId === context.userId) ? true : null,
        roster: rosterOf(id, garaId),
        entries: [],
        fitast: fitastOf(garaId),
        group: groupOf(id, garaId, day),
        pzInfo: pzInfoOf(garaId, day),
        ourPz,
        virtual: true,
      });
    }
    out.sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.id - b.id);
    return { competitions: out };
  });

export const saveCompetition = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const name = clip(raw.name, 120);
    const starts = clip(raw.startsOn, 10);
    if (name.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(starts)) throw new Error("Nome e data sono obbligatori.");
    const deadline = clip(raw.signupDeadline, 10);
    return {
      id: raw.id == null ? null : asNum(raw.id),
      name,
      starts,
      place: clip(raw.place, 80),
      organizer: clip(raw.organizer, 80),
      kind: clip(raw.kind, 60),
      distanceM: raw.distanceM == null || raw.distanceM === "" ? null : Number(raw.distanceM),
      category: clip(raw.category, 60),
      signupDeadline: deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : null,
      externalUrl: clip(raw.externalUrl, 300),
      notes: clip(raw.notes, 500),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    if (data.id) {
      const rows = await sql<{ id: number }>`
        update competitions set name=${data.name}, starts_on=${data.starts}::date, place=${data.place}, organizer=${data.organizer},
          kind=${data.kind}, distance_m=${data.distanceM}, category=${data.category}, signup_deadline=${data.signupDeadline}::date,
          external_url=${data.externalUrl}, notes=${data.notes}
        where id=${data.id} and (created_by=${context.userId} or ${me.role === "admin"})
        returning id`;
      if (!rows[0]) throw new Error("Gara non trovata.");
      return { id: asNum(rows[0].id) };
    }
    const rows = await sql<{ id: number }>`
      insert into competitions (name, starts_on, place, organizer, kind, distance_m, category, signup_deadline, external_url, notes, created_by)
      values (${data.name}, ${data.starts}::date, ${data.place}, ${data.organizer}, ${data.kind}, ${data.distanceM}, ${data.category},
        ${data.signupDeadline}::date, ${data.externalUrl}, ${data.notes}, ${context.userId})
      returning id`;
    return { id: asNum(rows[0].id) };
  });

export const saveEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    return {
      competitionId: asNum(raw.competitionId),
      score: raw.score == null || raw.score === "" ? null : asNum(raw.score),
      rank: raw.rank == null || raw.rank === "" ? null : asNum(raw.rank),
      // anche la categoria del portale («Messeri · Tradizionale») vale: conta la divisione
      category: divisionOf(categoryGroup(clip(raw.category, 90)).group) || divisionOf(clip(raw.category, 20)),
      notes: clip(raw.notes, 300),
      fitastName: clip(raw.fitastName, 120),
      laneCount: optionalInt(raw.laneCount, 0, 40, "Numero piazzole non valido."),
      spot: optionalInt(raw.spot, 0, 999, "Spot non valido."),
      championshipPoints: optionalInt(raw.championshipPoints, 0, 999, "Punti campionato non validi."),
      targetKind: raw.targetKind === "sagoma" ? "sagoma" as const : raw.targetKind === "padiglione" ? "padiglione" as const : "" as const,
      sagomaMax: raw.sagomaMax === 10 || raw.sagomaMax === 8 || raw.sagomaMax === 11 ? raw.sagomaMax : null,
      piazzole: Array.isArray(raw.piazzole)
        ? raw.piazzole.slice(0, 40).map((item, index) => {
            const row = (item ?? {}) as { n?: number; score?: number; arrows?: unknown; label?: unknown; distanceM?: unknown; note?: unknown; aimAngle?: unknown };
            const n = asNum(row.n, index + 1);
            const arrows = Array.isArray(row.arrows) ? row.arrows.slice(0, 8).map((value) => {
              const shot = asNum(value);
              if (!Number.isInteger(shot) || shot < 0) throw new Error("Freccia non valida.");
              return shot;
            }) : [];
            const score = arrows.length ? arrows.reduce((sum, shot) => sum + shot, 0) : asNum(row.score);
            if (n < 1 || n > 40 || !Number.isInteger(score) || score < 0) throw new Error("Punteggio piazzola non valido.");
            const distanceRaw = row.distanceM == null || row.distanceM === "" ? null : Number(row.distanceM);
            if (distanceRaw != null && (!Number.isFinite(distanceRaw) || distanceRaw < 1 || distanceRaw > 200)) throw new Error("Distanza piazzola non valida.");
            const aimAngle = ["alto", "basso", "destra", "sinistra", "frontale"].includes(String(row.aimAngle)) ? String(row.aimAngle) : "";
            return { n, score, arrows, label: clip(row.label, 40), distanceM: distanceRaw == null ? null : Math.round(distanceRaw * 10) / 10, note: clip(row.note, 280), aimAngle };
          })
        : [],
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    const owner = await accountWriter(sql, context.userId, me);
    const fromLanes = data.piazzole.length > 0;
    const laneCount = fromLanes ? data.piazzole.length : data.laneCount;
    const spot = data.spot;
    const score = fromLanes ? data.piazzole.reduce((sum, lane) => sum + lane.score, 0) : data.score;
    const allowed = data.targetKind === "sagoma"
      ? [8, 5, 0]
      : data.targetKind === "padiglione" ? [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] : null;
    if (allowed) {
      for (const lane of data.piazzole) {
        if (lane.arrows.some((shot) => !allowed.includes(shot))) throw new Error("Una freccia non vale su questo bersaglio.");
      }
    }
    if (data.rank != null && !data.category) throw new Error("Per il posto scegli Madonne, Messeri, Pueri o Juniores.");
    if (score == null && laneCount == null && spot == null && data.championshipPoints == null) throw new Error("Metti almeno un numero: piazzole, punti, spot o punti campionato.");
    await sql`
      insert into competition_entries (competition_id, user_id, score, rank, category, notes, lane_count, spot, championship_points, target_kind, sagoma_max)
      values (${data.competitionId}, ${owner.userId}, ${score}, ${data.rank}, ${data.category}, ${data.notes}, ${laneCount}, ${spot}, ${data.championshipPoints}, ${data.targetKind}, ${data.sagomaMax})
      on conflict (competition_id, user_id) do update set
        score = excluded.score, rank = excluded.rank, category = excluded.category, notes = excluded.notes,
        lane_count = excluded.lane_count, spot = excluded.spot, championship_points = excluded.championship_points,
        target_kind = excluded.target_kind, sagoma_max = excluded.sagoma_max`;
    const previous = await sql<{ n: number; note: string; note_done: boolean }>`
      select n, note, note_done from piazzole where competition_id = ${data.competitionId} and user_id = ${owner.userId}`;
    const kept = new Map(previous.map((row) => [asNum(row.n), row]));
    await sql`delete from piazzole where competition_id = ${data.competitionId} and user_id = ${owner.userId}`;
    for (const lane of data.piazzole) {
      const old = kept.get(lane.n);
      const done = Boolean(lane.note && old && old.note === lane.note && old.note_done);
      await sql`
        insert into piazzole (competition_id, user_id, n, score, arrows, label, distance_m, note, note_done, aim_angle)
        values (${data.competitionId}, ${owner.userId}, ${lane.n}, ${lane.score}, ${lane.arrows.length ? lane.arrows.join("+") : ""}, ${lane.label}, ${lane.distanceM}, ${lane.note}, ${done}, ${lane.aimAngle})`;
    }
    // il nome con cui il portale FITAST conosce l'arciere: serve per il suo posto in campionato
    if (data.fitastName) await sql`update members set fitast_name = ${data.fitastName} where user_id = ${owner.userId}`.catch(() => []);
    if (owner.by) await sql`update competition_entries set added_by = ${owner.by} where competition_id = ${data.competitionId} and user_id = ${owner.userId}`;
    if (score != null) await syncBadges(sql, owner.userId);
    await sql`
      insert into competition_presence (competition_id, user_id, attended)
      values (${data.competitionId}, ${owner.userId}, true)
      on conflict (competition_id, user_id) do update set attended = true`;
    return { ok: true as const, score };
  });

export const setPresence = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { competitionId?: number; attended?: boolean };
    return { competitionId: asNum(raw.competitionId), attended: raw.attended === true };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    if (!data.attended) {
      const rows = await sql<{ id: number }>`
        select id from competition_entries
        where competition_id = ${data.competitionId} and user_id = ${context.userId}
          and (score is not null or lane_count is not null or spot is not null or championship_points is not null)`;
      if (rows[0]) throw new Error("C'è già un punteggio. Tienilo premuto e tocca Elimina, poi segna che non hai partecipato.");
    }
    await sql`
      insert into competition_presence (competition_id, user_id, attended)
      values (${data.competitionId}, ${context.userId}, ${data.attended})
      on conflict (competition_id, user_id) do update set attended = excluded.attended`;
    return { ok: true as const };
  });

/**
 * Toglie una gara: "mine" la toglie dalle proprie (punteggio, piazzole e presenza), "all" la cancella per tutti
 * (solo chi l'ha aggiunta o lo staff).
 */
export const deleteCompetition = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { id?: unknown; scope?: unknown };
    return { id: asNum(raw.id), scope: raw.scope === "all" ? ("all" as const) : ("mine" as const) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const rows = await sql<{ id: number; created_by: string }>`select id, created_by from competitions where id = ${data.id} limit 1`;
    const comp = rows[0];
    if (!comp) throw new Error("Gara non trovata.");
    if (data.scope === "all") {
      if (staffLevel(me) == null) throw new Error("La gara la elimina per tutti solo il fondatore.");
      await sql`delete from piazzole where competition_id = ${data.id}`;
      await sql`delete from competition_entries where competition_id = ${data.id}`;
      await sql`delete from competition_presence where competition_id = ${data.id}`;
      await sql`delete from competitions where id = ${data.id}`;
      return { ok: true as const };
    }
    await sql`delete from piazzole where competition_id = ${data.id} and user_id = ${context.userId}`;
    await sql`delete from competition_entries where competition_id = ${data.id} and user_id = ${context.userId}`;
    await sql`delete from competition_presence where competition_id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { competitionId?: number; userId?: string };
    const userId = clip(raw.userId, 80);
    if (!userId) throw new Error("Punteggio non trovato.");
    return { competitionId: asNum(raw.competitionId), userId };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    const owner = await writerFor(sql, context.userId, me);
    if (data.userId !== context.userId && data.userId !== owner.userId) throw new Error("Puoi togliere solo il tuo punteggio.");
    await sql`delete from piazzole where competition_id = ${data.competitionId} and user_id = ${data.userId}`;
    const rows = await sql`
      delete from competition_entries
      where competition_id = ${data.competitionId} and user_id = ${data.userId}
      returning id`;
    if (!rows[0]) throw new Error("Punteggio non trovato.");
    return { ok: true as const };
  });

/** i numeri di un arciere che si vedono sul profilo e nel confronto: gare, campionato, allenamenti, avatar */
/** il posto nella classifica generale arcieri di una stagione */
type SeasonGeneral = { category: string; place: number | null; size: number; points: number | null };

/** una stagione di un arciere: le sue gare (app e portale) e il posto nella generale FITAST */
export type ArcherSeason = {
  label: string;
  from: string;
  current: boolean;
  gare: number;
  wins: number;
  podiums: number;
  best: number | null;
  avg: number | null;
  champ: number;
  general: SeasonGeneral | null;
  races: { name: string; day: string; rank: number | null; score: number | null; category: string; champ: number | null; spot: number | null; lanes: number }[];
};

/**
 * Le stagioni di un arciere, dalla più recente: le gare raggruppate per campionato e, per le stagioni chiuse,
 * il posto nella classifica generale salvata con «Scansiona tutto dal 2019».
 */
async function seasonsOf(sql: Awaited<ReturnType<typeof db>>, done: GaraLoad[], who: Who, currentLabel: string, currentGeneral: SeasonGeneral | null): Promise<ArcherSeason[]> {
  const groups = new Map<string, ArcherSeason>();
  const groupOf = (label: string, from: string) => {
    const g = groups.get(label) ?? { label, from, current: label === currentLabel, gare: 0, wins: 0, podiums: 0, best: null, avg: null, champ: 0, general: null, races: [] };
    if (from && (!g.from || from < g.from)) g.from = from;
    groups.set(label, g);
    return g;
  };
  for (const l of done) {
    const g = groupOf(l.season, l.seasonFrom || l.day);
    g.gare += 1;
    if (l.rank === 1) g.wins += 1;
    if (l.rank != null && l.rank <= 3) g.podiums += 1;
    g.champ += l.champ ?? 0;
    g.races.push({ name: l.name, day: l.day, rank: l.rank, score: l.points, category: divisionOf(l.category ?? "") || l.category || "", champ: l.champ, spot: l.spot, lanes: l.piazzole });
  }
  // le classifiche generali delle stagioni chiuse
  const general = await pastTables(sql, "generale-arcieri", namePattern([who])).catch(() => []);
  const bySeason = new Map<string, typeof general>();
  for (const t of general) bySeason.set(t.season, [...(bySeason.get(t.season) ?? []), t]);
  for (const list of bySeason.values()) {
    const r = oursInGara(list, [who]).get(who.userId);
    if (!r || !trustedPast(r, who)) continue;
    const tag = seasonTag(list.find((t) => t.season_name)?.season_name ?? "", "");
    if (tag.label === currentLabel) continue;
    groupOf(tag.label, tag.from).general = { category: r.category, place: r.place, size: r.size, points: r.camp ?? r.score };
  }
  if (currentGeneral) groupOf(currentLabel, "").general = currentGeneral;
  for (const g of groups.values()) {
    const scores = g.races.map((x) => x.score).filter((v): v is number => v != null);
    g.best = scores.length ? Math.max(...scores) : null;
    g.avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    g.races.sort((a, b) => b.day.localeCompare(a.day));
  }
  return [...groups.values()].sort((a, b) => Number(b.current) - Number(a.current) || b.from.localeCompare(a.from) || b.label.localeCompare(a.label));
}

async function archerStats(sql: Awaited<ReturnType<typeof db>>, userId: string, who: { fullName: string; givenName: string; nickname: string; fitastName: string; fitastTeam: string; team: string }, xp: number, gen: GenTable[]) {
  // le gare fatte: risultati segnati nell'app, classifiche del portale FITAST e gare con «Ho partecipato»
  const loads = ((await garaLoads(sql, userId)).get(userId) ?? []).sort((a, b) => a.day.localeCompare(b.day));
  const today = new Date().toISOString().slice(0, 10);
  const season = champSeasonOf(today);
  const gare = loads.map((g) => ({
    name: g.name,
    day: g.day,
    score: g.points,
    rank: g.rank,
    category: divisionOf(g.category ?? "") || "",
    champ: g.champ,
    spot: g.spot,
  }));
  const done = gare.filter((g) => g.day <= today);
  const inSeason = done.filter((g) => g.day >= season.from && g.day <= season.to);
  const inSeasonPodiums = inSeason.filter((g) => g.rank != null && g.rank <= 3).length;
  const scores = done.map((g) => g.score).filter((v): v is number => v != null);
  const sessions = await sql<{ arrows: number; points: number }>`
    select count(sh.id)::int as arrows, coalesce(sum(sh.score), 0)::int as points
    from sessions s left join shots sh on sh.session_id = s.id
    where s.user_id = ${userId}
    group by s.id`;
  const real = sessions.filter((x) => asNum(x.arrows) > 0);
  const trainArrows = real.reduce((sum, x) => sum + asNum(x.arrows), 0);
  const trainPoints = real.reduce((sum, x) => sum + asNum(x.points), 0);
  // le gare contano sempre: piazzole e frecce dal cartellino, dalle piazzole inserite o stimate (20 piazzole × 3 frecce)
  const vol = sumLoads(loads);
  const arrows = trainArrows + vol.arrows;
  const avgArrows = trainArrows + vol.pointArrows;
  const game = await sql<{ rounds: number; best: number; max_points: number }>`
    select coalesce(sum(rounds), 0)::int as rounds, coalesce(max(best), 0)::int as best, coalesce(max(max_points), 0)::int as max_points from game_records where user_id = ${userId}`.catch(() => []);
  // il posto vero nel campionato FITAST: in categoria, assoluto, nella divisione e in compagnia
  const fitast = fitastRankOf(gen, who);
  const last = [...done].reverse()[0] ?? null;
  // le stagioni: quella in corso con il posto vero nella generale, le altre dall'archivio del portale
  const currentTag = seasonTag(fitast?.season ?? "", today);
  const seasons = await seasonsOf(
    sql,
    loads.filter((l) => l.day <= today),
    { userId, fitastName: who.fitastName, fitastTeam: who.fitastTeam, fullName: who.fullName, givenName: who.givenName, nickname: who.nickname, team: who.team },
    currentTag.label,
    fitast ? { category: fitast.category, place: fitast.place, size: fitast.size, points: fitast.points } : null,
  );
  const firstDay = done[0]?.day ?? "";
  return {
    seasonName: season.name,
    champSeason: inSeason.reduce((sum, g) => sum + (g.champ ?? 0), 0),
    gareSeason: inSeason.length,
    winsSeason: inSeason.filter((g) => g.rank === 1).length,
    podiumsSeason: inSeasonPodiums,
    /** anno della prima gara conosciuta (app o archivio del portale) */
    since: firstDay.slice(0, 4),
    seasons,
    gare: done.length,
    wins: done.filter((g) => g.rank === 1).length,
    podiums: done.filter((g) => g.rank != null && g.rank <= 3).length,
    bestScore: scores.length ? Math.max(...scores) : null,
    avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    last,
    trainings: real.length,
    arrows,
    trainArrows,
    garaArrows: vol.arrows,
    piazzole: vol.piazzole,
    estimatedGare: vol.estimated,
    avg: avgArrows ? (trainPoints + vol.points) / avgArrows : null,
    gameRounds: asNum(game[0]?.rounds),
    gameBest: asNum(game[0]?.best),
    xp,
    fitast,
  };
}
export type ArcherStats = Awaited<ReturnType<typeof archerStats>>;

export const archerBoard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const id = asNum((input as { id?: number })?.id);
    if (!id) throw new Error("Arciere non trovato.");
    return { id };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const viewer = await ensureMember(sql, context.userId);
    const rows = await sql<MemberRow>`select * from members where id = ${data.id} and user_id is not null limit 1`;
    const member = rows[0];
    if (!member?.user_id) throw new Error("Questo arciere non è ancora nel gruppo.");
    // incarichi della persona e cosa può cambiare chi guarda
    const theirs = await myMembership(sql, member.user_id);
    const mineCo = await myMembership(sql, context.userId);
    const coName = await sql<{ name: string; color: string; fitast_name: string }>`select name, color, fitast_name from companies where id = ${theirs.companyId} limit 1`;
    const viewerCo = await sql<{ name: string; fitast_name: string }>`select name, fitast_name from companies where id = ${mineCo.companyId} limit 1`;
    const gen = await loadGenerale(sql);
    const whoOf = (m: MemberRow, co: { name: string; fitast_name: string } | undefined) => ({
      fullName: `${m.given_name} ${m.family_name}`,
      givenName: m.given_name,
      nickname: m.nickname,
      fitastName: String((m as MemberRow & { fitast_name?: string }).fitast_name ?? ""),
      fitastTeam: String((m as MemberRow & { fitast_team?: string }).fitast_team ?? ""),
      team: co?.fitast_name || co?.name || "",
    });
    // punti dell'avatar: quelli del telefono (minigioco, quiz, esercizi) più allenamenti e gare registrati
    const theirXp = asNum((member as MemberRow & { xp?: number }).xp) + (await activityXp(sql, member.user_id));
    const games = await sql<{ mode: string; level: string; best: number; max_points: number; stations: string; arrows: number; tens: number; xs: number; misses: number; rounds: number; best_at: unknown }>`
      select mode, level, best, max_points, stations, arrows, tens, xs, misses, rounds, best_at from game_records where user_id = ${member.user_id}`.catch(() => []);
    const sessions = await sql<{ started_at: unknown; distance_m: unknown; arrows: number; points: number }>`
      select s.started_at, s.distance_m, count(sh.id)::int as arrows, coalesce(sum(sh.score), 0)::int as points
      from sessions s
      left join shots sh on sh.session_id = s.id
      where s.user_id = ${member.user_id}
      group by s.id
      order by s.started_at`;
    const comps = await sql<{ name: string; starts_on: string; score: number | null }>`
      select c.name, c.starts_on::text as starts_on, e.score
      from competition_entries e
      join competitions c on c.id = e.competition_id
      where e.user_id = ${member.user_id} and e.score is not null
      order by c.starts_on`;
    const trainings = sessions
      .map((s) => ({
        day: asIso(s.started_at).slice(0, 10),
        distanceM: asNum(s.distance_m),
        arrows: asNum(s.arrows),
        avg: asNum(s.arrows) ? asNum(s.points) / asNum(s.arrows) : 0,
      }))
      .filter((s) => s.arrows > 0);
    return {
      id: asNum(member.id),
      userId: member.user_id,
      xp: theirXp,
      givenName: member.given_name,
      familyName: member.family_name,
      nickname: member.nickname,
      slug: member.slug,
      bowType: member.bow_type,
      photoUrl: member.photo_url,
      avatarColor: member.avatar_color,
      admin: member.role === "admin",
      joinedOn: String(member.joined_on ?? "").slice(0, 10),
      mine: member.user_id === context.userId,
      roles: {
        level: staffLevel(member),
        leader: theirs.role === "owner",
        coach: asBool(member.coach),
        companyName: coName[0]?.name ?? "",
        companyColor: coName[0]?.color ?? "#1f7a46",
      },
      viewer: { level: staffLevel(viewer), leaderHere: mineCo.role === "owner" && mineCo.companyId === theirs.companyId, self: member.user_id === context.userId },
      games: games.map((g) => {
        let stations: number[] = [];
        try {
          stations = (JSON.parse(g.stations) as unknown[]).map(Number).filter((v) => Number.isFinite(v));
        } catch {
          /* dettaglio non leggibile */
        }
        return {
          mode: g.mode,
          level: g.level,
          best: asNum(g.best),
          max: asNum(g.max_points),
          stations,
          arrows: asNum(g.arrows),
          tens: asNum(g.tens),
          xs: asNum(g.xs),
          misses: asNum(g.misses),
          rounds: asNum(g.rounds),
          bestAt: g.best_at ? asIso(g.best_at) : "",
        };
      }),
      trainings,
      comps: comps.map((c) => ({
        name: c.name,
        day: String(c.starts_on).slice(0, 10),
        score: asNum(c.score),
      })),
      stats: await archerStats(sql, member.user_id, whoOf(member, coName[0]), theirXp, gen),
      // i numeri di chi guarda, per «Confronta con me»
      viewerStats: member.user_id === context.userId ? null : await archerStats(sql, context.userId, whoOf(viewer, viewerCo[0]), asNum((viewer as MemberRow & { xp?: number }).xp) + (await activityXp(sql, context.userId)), gen),
    };
  });

export const listShopping = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<{
      id: number; user_id: string; visibility: string; name: string; category: string; qty: number; price_cents: number | null;
      url: string; priority: string; notes: string; status: string; size_label: string;
    }>`
      select id, user_id, visibility, name, category, qty, price_cents, url, priority, notes, status, size_label
      from shopping_items where user_id = ${context.userId}
      order by case status when 'todo' then 0 when 'ordered' then 1 else 2 end, id desc`;
    return rows.map((r) => ({
      id: asNum(r.id), mine: r.user_id === context.userId, visibility: r.visibility, name: r.name, category: r.category,
      qty: asNum(r.qty, 1), priceCents: asNumOrNull(r.price_cents), url: r.url, priority: r.priority, notes: r.notes,
      status: r.status, sizeLabel: r.size_label,
    }));
  });

export const saveShopping = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const name = clip(raw.name, 80);
    if (name.length < 2) throw new Error("Cosa vuoi comprare?");
    const status = ["todo", "ordered", "bought"].includes(String(raw.status)) ? String(raw.status) : "todo";
    const priority = ["alta", "normal", "bassa"].includes(String(raw.priority)) ? String(raw.priority) : "normal";
    return {
      id: raw.id == null ? null : asNum(raw.id),
      visibility: raw.visibility === "group" ? "group" : "personal",
      name,
      category: clip(raw.category, 40) || "accessorio",
      qty: Math.max(1, Math.min(99, asNum(raw.qty, 1))),
      priceCents: raw.priceCents == null || raw.priceCents === "" ? null : Math.max(0, asNum(raw.priceCents)),
      url: clip(raw.url, 300),
      priority,
      notes: clip(raw.notes, 300),
      status,
      sizeLabel: clip(raw.sizeLabel, 20),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    if (data.id) {
      const rows = await sql<{ id: number }>`
        update shopping_items set visibility=${data.visibility}, name=${data.name}, category=${data.category}, qty=${data.qty},
          price_cents=${data.priceCents}, url=${data.url}, priority=${data.priority}, notes=${data.notes}, status=${data.status}, size_label=${data.sizeLabel}
        where id=${data.id} and (user_id=${context.userId} or (${me.role === "admin"} and visibility='group'))
        returning id`;
      if (!rows[0]) throw new Error("Voce non trovata.");
      return { id: asNum(rows[0].id) };
    }
    const rows = await sql<{ id: number }>`
      insert into shopping_items (user_id, visibility, name, category, qty, price_cents, url, priority, notes, status, size_label)
      values (${context.userId}, ${data.visibility}, ${data.name}, ${data.category}, ${data.qty}, ${data.priceCents}, ${data.url}, ${data.priority}, ${data.notes}, ${data.status}, ${data.sizeLabel})
      returning id`;
    return { id: asNum(rows[0].id) };
  });

export const deleteShopping = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: number })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    await sql`delete from shopping_items where id=${data.id} and (user_id=${context.userId} or ${me.role === "admin"})`;
    return { ok: true as const };
  });

export const listGoals = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    await syncBadges(sql, context.userId);
    const goals = await sql<{
      id: number; user_id: string | null; title: string; metric: string; target: number; bow_type: string; distance_m: number | null; created_by: string;
    }>`select id, user_id, title, metric, target, bow_type, distance_m, created_by from goals where user_id is null or user_id = ${context.userId} order by id desc`;
    const shots = await sql<{ user_id: string; started_at: unknown; bow_type: string; distance_m: unknown; score: number; session_id: number }>`
      select s.user_id, s.started_at, s.bow_type, s.distance_m, sh.score, s.id as session_id
      from sessions s join shots sh on sh.session_id = s.id`;
    const badges = await sql<{ code: string; unlocked_at: unknown; title: string }>`
      select u.code, u.unlocked_at, a.title from user_achievements u
      join achievements a on a.code = u.code
      where u.user_id = ${context.userId} order by u.unlocked_at desc`;
    const groupBadges = await sql<{ user_id: string; code: string; title: string; given_name: string; nickname: string; slug: string; family_name: string }>`
      select u.user_id, u.code, a.title, m.given_name, m.nickname, m.slug, m.family_name
      from user_achievements u
      join achievements a on a.code = u.code
      join members m on m.user_id = u.user_id
      order by u.unlocked_at desc limit 20`;
    return {
      goals: goals.map((g) => {
        const relevant = shots.filter((s) => {
          if (g.user_id && s.user_id !== g.user_id) return false;
          if (g.bow_type && s.bow_type !== g.bow_type) return false;
          if (g.distance_m != null && Math.abs(asNum(s.distance_m) - asNum(g.distance_m)) > 0.05) return false;
          return true;
        });
        const arrows = relevant.length;
        const sessions = new Set(relevant.map((s) => s.session_id)).size;
        const points = relevant.reduce((a, s) => a + asNum(s.score), 0);
        const days = new Set(relevant.map((s) => asIso(s.started_at).slice(0, 10))).size;
        const progress = g.metric === "arrows" ? arrows : g.metric === "sessions" ? sessions : g.metric === "days" ? days : arrows ? points / arrows : 0;
        return {
          id: asNum(g.id), title: g.title, metric: g.metric, target: asNum(g.target), collective: !g.user_id,
          bowType: g.bow_type, distanceM: asNumOrNull(g.distance_m), progress, mine: g.created_by === context.userId,
        };
      }),
      badges: badges.map((b) => ({ code: b.code, title: b.title, unlockedAt: asIso(b.unlocked_at) })),
      albo: groupBadges.map((b) => ({
        title: b.title, givenName: b.given_name, familyName: b.family_name, nickname: b.nickname, slug: b.slug,
      })),
    };
  });

export const saveGoal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const title = clip(raw.title, 80);
    const metric = clip(raw.metric, 20);
    if (title.length < 3) throw new Error("Dai un nome all'obiettivo.");
    if (!["arrows", "sessions", "avg", "days"].includes(metric)) throw new Error("Tipo di obiettivo non valido.");
    const target = Number(raw.target);
    if (!Number.isFinite(target) || target <= 0) throw new Error("Soglia non valida.");
    return {
      title, metric, target,
      collective: Boolean(raw.collective),
      bowType: clip(raw.bowType, 30),
      distanceM: raw.distanceM == null || raw.distanceM === "" ? null : Number(raw.distanceM),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (data.collective && me.role !== "admin") throw new Error("Gli obiettivi di gruppo li crea il fondatore.");
    if (!canScore(me.role) && !data.collective) throw new Error("Profilo in sola lettura.");
    const rows = await sql<{ id: number }>`
      insert into goals (user_id, title, metric, target, bow_type, distance_m, created_by)
      values (${data.collective ? null : context.userId}, ${data.title}, ${data.metric}, ${data.target}, ${data.bowType}, ${data.distanceM}, ${context.userId})
      returning id`;
    return { id: asNum(rows[0].id) };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: number })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    await sql`delete from goals where id = ${data.id} and (created_by = ${context.userId} or ${me.role === "admin"})`;
    return { ok: true as const };
  });

export const listEvents = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { from?: string; to?: string };
    return { from: clip(raw.from, 10), to: clip(raw.to, 10) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<{ id: number; title: string; starts_on: string; notes: string; user_id: string | null }>`
      select id, title, starts_on::text as starts_on, notes, user_id from events
      where starts_on >= ${data.from}::date and starts_on < ${data.to}::date
        and (user_id is null or user_id = ${context.userId})
      order by starts_on`;
    return rows.map((r) => ({ id: asNum(r.id), title: r.title, startsOn: String(r.starts_on).slice(0, 10), notes: r.notes, group: !r.user_id }));
  });

export const saveEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const title = clip(raw.title, 80);
    const day = clip(raw.startsOn, 10);
    if (title.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Titolo e data sono obbligatori.");
    return { title, day, notes: clip(raw.notes, 300), group: Boolean(raw.group) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    if (data.group && me.role !== "admin") throw new Error("Gli eventi di gruppo li inserisce il fondatore.");
    await sql`
      insert into events (user_id, title, starts_on, notes, created_by)
      values (${data.group ? null : context.userId}, ${data.title}, ${data.day}::date, ${data.notes}, ${context.userId})`;
    return { ok: true as const };
  });

export const squadBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const missing = await sql<{ id: string }>`
      select u.id from "user" u
      left join members m on m.user_id = u.id
      where m.id is null`;
    for (const person of missing) await ensureMember(sql, person.id);

    const everyone = await sql<{
      id: number; user_id: string; given_name: string; family_name: string; nickname: string; slug: string;
      avatar_color: string; photo_url: string | null; bow_type: string; user_image: string | null; role: string; xp: number | null; fitast_name: string | null; fitast_team: string | null;
    }>`
      select m.id, m.user_id, m.given_name, m.family_name, m.nickname, m.slug, m.avatar_color, m.photo_url, m.bow_type, u.image as user_image, m.role, m.xp, m.fitast_name, m.fitast_team
      from members m
      join "user" u on u.id = m.user_id
      where m.user_id is not null
      order by m.given_name, m.id`;
    // si vedono solo gli arcieri della propria compagnia
    const peers = await companyPeers(sql, context.userId);
    const people = everyone.filter((row) => peers.has(row.user_id));
    // l'arco con cui tira nel campionato: quello della sua categoria FITAST (es. «Madonne · Tradizionale»),
    // altrimenti quello scritto nel profilo. Così i podi per arco seguono le classifiche del portale
    const gen = await loadGenerale(sql);
    const homeRows = await sql<{ user_id: string; name: string; fitast_name: string }>`
      select cm.user_id, c.name, c.fitast_name from company_members cm join companies c on c.id = cm.company_id`.catch(() => []);
    const homeName = new Map(homeRows.map((h) => [h.user_id, h.fitast_name || h.name]));
    const bowOf = new Map<string, string>();
    for (const row of people) {
      const r = gen.length ? fitastRankOf(gen, { fitastName: row.fitast_name ?? "", fullName: [row.given_name, row.family_name].filter(Boolean).join(" "), givenName: row.given_name, nickname: row.nickname, team: (row.fitast_team || homeName.get(row.user_id)) ?? "" }) : null;
      const tip = r ? categoryGroup(r.category).tipologia : "";
      bowOf.set(row.user_id, bowIdOf(tip) || row.bow_type);
    }
    // livello di ognuno: punti del telefono più allenamenti e gare registrati
    // le gare di ognuno come sul suo profilo: app, classifiche del portale e archivio FITAST dal 2019
    const loadsOf = await garaLoads(sql).catch(() => new Map<string, GaraLoad[]>());
    const today = new Date().toISOString().slice(0, 10);
    const season = champSeasonOf(today);
    const act = await allActivityXp(sql, loadsOf).catch(() => new Map<string, number>());
    const xpOf = new Map<string, number>(people.map((row) => [row.user_id, asNum(row.xp) + (act.get(row.user_id) ?? 0)]));

    const train = await sql<{ user_id: string; sessions: number; arrows: number; points: number }>`
      select s.user_id,
        count(distinct s.id) as sessions,
        count(sh.id) as arrows,
        coalesce(sum(sh.score), 0) as points
      from sessions s
      left join shots sh on sh.session_id = s.id
      group by s.user_id`;

    const entries = await sql<{
      user_id: string; competition_id: number; score: number | null; championship_points: number | null;
      category: string; lane_count: number | null; spot: number | null; starts_on: string;
    }>`
      select e.user_id, e.competition_id, e.score, e.championship_points, e.category, e.lane_count, e.spot, c.starts_on::text as starts_on
      from competition_entries e
      join competitions c on c.id = e.competition_id`;

    const dots = await sql<{ user_id: string; score: number; is_x: boolean; miss: boolean; nx: number | null; ny: number | null; face: string; aim_target: string; aim_angle: string; distance_m: number | null }>`
      select s.user_id, sh.score, sh.is_x, sh.miss, sh.nx, sh.ny, s.face, s.aim_target, s.aim_angle, s.distance_m
      from shots sh
      join sessions s on s.id = sh.session_id
      order by s.started_at desc, sh.id desc`;

    const distances = await sql<{ user_id: string; best: number }>`
      select user_id, max(distance_m) as best
      from sessions
      where distance_m > 0
      group by user_id`;

    const lanes = await sql<{ user_id: string; arrows: string; score: number; distance_m: number | null; aim_angle: string; target_kind: string }>`
      select p.user_id, p.arrows, p.score, p.distance_m, p.aim_angle, coalesce(e.target_kind, '') as target_kind
      from piazzole p
      left join competition_entries e on e.competition_id = p.competition_id and e.user_id = p.user_id`;

    const trainOf = new Map(train.map((row) => [row.user_id, row]));
    const gareOf = new Map<string, Set<number>>();
    const champOf = new Map<string, number>();
    const compOf = new Map<string, { points: number; n: number }>();
    const divisionOfEntry = new Map<string, { day: string; name: "Madonne" | "Messeri" | "Pueri" | "Juniores" }>();

    for (const row of entries) {
      if (row.score != null) {
        const set = gareOf.get(row.user_id) ?? new Set<number>();
        set.add(asNum(row.competition_id));
        gareOf.set(row.user_id, set);
      }
      const champ = asNumOrNull(row.championship_points);
      if (champ != null) champOf.set(row.user_id, (champOf.get(row.user_id) ?? 0) + champ);
      const score = asNumOrNull(row.score);
      if (score != null) {
        const bag = compOf.get(row.user_id) ?? { points: 0, n: 0 };
        bag.points += score;
        bag.n += 1;
        compOf.set(row.user_id, bag);
      }
      const day = String(row.starts_on).slice(0, 10);
      const name = divisionOf(row.category);
      if (!name) continue;
      const prev = divisionOfEntry.get(row.user_id);
      if (!prev || day > prev.day) divisionOfEntry.set(row.user_id, { day, name });
    }

    const shotsOf = new Map<string, { nx: number; ny: number }[]>();
    for (const dot of dots) {
      const animal = dot.aim_target === "sagoma" || String(dot.face || "").startsWith("sagoma");
      const list = shotsOf.get(dot.user_id) ?? [];
      const face = faceById(animal ? "wa10" : (dot.face || "wa10"));
      const score = asNum(dot.score);
      const isX = asBool(dot.is_x);
      const miss = asBool(dot.miss) || score <= 0;
      const rawX = dot.nx == null ? Number.NaN : asNum(dot.nx, Number.NaN);
      const rawY = dot.ny == null ? Number.NaN : asNum(dot.ny, Number.NaN);
      const stored = Number.isFinite(rawX) && Number.isFinite(rawY) ? { nx: rawX, ny: rawY } : null;
      let spot = !animal && stored ? stored : null;
      if (spot) {
        const hit = scoreAtRadius(face, Math.hypot(spot.nx, spot.ny));
        const same = miss ? hit.miss : isX ? hit.isX : !hit.miss && !hit.isX && hit.score === score;
        if (!same) spot = null;
      }
      if (!spot) {
        spot = animal
          ? aimSpot(miss ? 0 : score, String(dot.aim_angle ?? ""), dot.distance_m == null ? null : asNum(dot.distance_m), list.length, "padiglione")
          : ringPoint(face, score, isX, miss, list.length);
      }
      list.push({ nx: Math.max(-1.15, Math.min(1.15, spot.nx)), ny: Math.max(-1.15, Math.min(1.15, spot.ny)) });
      shotsOf.set(dot.user_id, list);
    }

    const garaArrowsOf = new Map<string, number>();
    const bestDistanceOf = new Map<string, number>();
    const sagomaOf = new Map<string, { score: number; nx: number | null; ny: number | null; angle: string; distance: number | null }[]>();
    for (const row of distances) {
      const best = asNum(row.best);
      if (best > 0) bestDistanceOf.set(row.user_id, best);
    }
    for (const row of lanes) {
      const parts = arrowMarks(row.arrows);
      garaArrowsOf.set(row.user_id, (garaArrowsOf.get(row.user_id) ?? 0) + parts.length);
      const distance = row.distance_m == null ? 0 : asNum(row.distance_m);
      if (distance > 0) bestDistanceOf.set(row.user_id, Math.max(bestDistanceOf.get(row.user_id) ?? 0, distance));
      const sagoma = /sagoma|3d|threed/i.test(row.target_kind || "");
      const scores = parts.length ? parts : sagoma ? [asNum(row.score)].filter((score) => score === 8 || score === 5 || score === 0 || score === 10 || score === 11) : [];
      if (!scores.length) continue;
      const faceList = shotsOf.get(row.user_id) ?? [];
      for (const score of scores) {
        faceList.push(aimSpot(score, String(row.aim_angle ?? ""), row.distance_m == null ? null : asNum(row.distance_m), faceList.length, "padiglione"));
      }
      shotsOf.set(row.user_id, faceList);
      if (!sagoma) continue;
      const list = sagomaOf.get(row.user_id) ?? [];
      for (const score of scores) {
        const meters = row.distance_m == null ? null : asNum(row.distance_m);
        const spot = aimSpot(score, String(row.aim_angle ?? ""), meters, list.length, "sagoma");
        list.push({ score, ...spot, angle: String(row.aim_angle ?? ""), distance: meters });
      }
      sagomaOf.set(row.user_id, list);
    }
    const trainSagoma = await sql<{ user_id: string; score: number; nx: number | null; ny: number | null; aim_angle: string; distance_m: number | null }>`
      select s.user_id, sh.score, sh.nx, sh.ny, s.aim_angle, s.distance_m
      from sessions s
      join shots sh on sh.session_id = s.id
      where s.aim_target = 'sagoma' or s.face like 'sagoma%'`;
    for (const row of trainSagoma) {
      const list = sagomaOf.get(row.user_id) ?? [];
      const nx = row.nx == null ? null : asNum(row.nx, Number.NaN);
      const ny = row.ny == null ? null : asNum(row.ny, Number.NaN);
      const known = nx != null && ny != null && Number.isFinite(nx) && Number.isFinite(ny);
      const distance = row.distance_m == null ? null : asNum(row.distance_m);
      const spot = known ? { nx, ny } : aimSpot(asNum(row.score), String(row.aim_angle ?? ""), distance, list.length, "sagoma");
      list.push({ score: asNum(row.score), nx: spot.nx, ny: spot.ny, angle: String(row.aim_angle ?? ""), distance });
      sagomaOf.set(row.user_id, list);
    }

    return {
      people: people.map((row) => {
        const shot = trainOf.get(row.user_id);
        const arrows = asNum(shot?.arrows);
        const points = asNum(shot?.points);
        // gare, frecce di gara, media gara e punti campionato della stagione: gli stessi numeri del profilo
        const done = (loadsOf.get(row.user_id) ?? []).filter((l) => l.day <= today);
        const vol = sumLoads(done);
        const garaArrows = done.length ? vol.arrows : garaArrowsOf.get(row.user_id) ?? 0;
        const scored = done.map((l) => l.points).filter((v): v is number => v != null);
        const comp = scored.length ? { points: scored.reduce((a, b) => a + b, 0), n: scored.length } : compOf.get(row.user_id);
        const inSeason = done.filter((l) => l.day >= season.from && l.day <= season.to);
        const champ = done.length ? inSeason.reduce((sum, l) => sum + (l.champ ?? 0), 0) : champOf.get(row.user_id) ?? 0;
        const lastDivision = [...done].reverse().map((l) => portalDivision(l.category ?? "")).find(Boolean) ?? "";
        // l'andamento delle ultime gare: punti per freccia (le gare hanno piazzole diverse), dalla più vecchia
        const perArrow = [...done]
          .sort((a, b) => a.day.localeCompare(b.day))
          .filter((l) => l.points != null && l.arrows > 0)
          .map((l) => (l.points as number) / l.arrows);
        const trend = perArrow.slice(-8).map((v) => Math.round(v * 100) / 100);
        const before = perArrow.slice(-4, -1);
        const lastAvg = perArrow[perArrow.length - 1];
        const prevAvg = before.length ? before.reduce((a, b) => a + b, 0) / before.length : null;
        const trendPct = lastAvg != null && prevAvg ? Math.round(((lastAvg - prevAvg) / prevAvg) * 100) : null;
        const podi = done.filter((l) => l.rank != null && l.rank <= 3).length;
        const remote = row.user_image && /^https:\/\//.test(row.user_image) ? row.user_image : null;
        const bestDistance = bestDistanceOf.get(row.user_id) ?? null;
        return {
          id: asNum(row.id),
          userId: row.user_id,
          givenName: row.given_name,
          familyName: row.family_name,
          nickname: row.nickname,
          slug: row.slug,
          avatarColor: row.avatar_color,
          admin: row.role === "admin",
          photoUrl: row.photo_url || remote,
          bowType: bowOf.get(row.user_id) ?? row.bow_type,
          xp: xpOf.get(row.user_id) ?? 0,
          sessions: asNum(shot?.sessions),
          arrows: arrows + garaArrows,
          trainArrows: arrows,
          garaArrows,
          avg: arrows > 0 ? points / arrows : null,
          gare: Math.max(done.length, gareOf.get(row.user_id)?.size ?? 0),
          podi,
          trend,
          trendPct,
          champ,
          compAvg: comp && comp.n > 0 ? comp.points / comp.n : null,
          bestDistance,
          division: divisionOfEntry.get(row.user_id)?.name ?? lastDivision,
          shots: shotsOf.get(row.user_id) ?? [],
          sagoma: sagomaOf.get(row.user_id) ?? [],
        };
      }),
    };
  });

/** la divisione dalla categoria di gara, anche come la scrive il portale («Madonna · Tradizionale» → Madonne) */
function portalDivision(category: string) {
  const head = category.split("·")[0]?.trim() ?? "";
  if (/^mad/i.test(head)) return divisionOf("Madonne");
  if (/^messer/i.test(head)) return divisionOf("Messeri");
  if (/^puer/i.test(head)) return divisionOf("Pueri");
  if (/^junior/i.test(head)) return divisionOf("Juniores");
  return divisionOf(head);
}

/** la tipologia d'arco della categoria FITAST come arco dell'app («Tradizionale» → tradizionale) */
function bowIdOf(tip: string) {
  const t = tip.trim();
  if (!t || /^tutt/i.test(t)) return "";
  if (/senza|nessun/i.test(t)) return "senza tipologia";
  if (/tradiz/i.test(t)) return "tradizionale";
  if (/foggia/i.test(t)) return "foggia storica";
  if (/storic|medieval|rinasc/i.test(t)) return "storico";
  if (/long|lungo/i.test(t)) return "lungo";
  if (/nud|bare/i.test(t)) return "nudo";
  if (/compound/i.test(t)) return "compound";
  if (/olimp|ricurv/i.test(t)) return "olimpico";
  return t.toLowerCase();
}

function arrowMarks(raw: unknown) {
  return String(raw ?? "")
    .split(/[+,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (/^m$/i.test(part)) return 0;
      if (/^x$/i.test(part)) return 10;
      const score = asNum(part, Number.NaN);
      return Number.isInteger(score) && score >= 0 && score <= 11 ? score : Number.NaN;
    })
    .filter((score) => Number.isInteger(score));
}

export const openNotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const lanes = await sql<{ id: number; note: string; label: string; n: number; name: string }>`
      select p.id, p.note, p.label, p.n, c.name
      from piazzole p
      join competitions c on c.id = p.competition_id
      where p.user_id = ${context.userId} and p.note <> '' and p.note_done = false
      order by c.starts_on desc, p.n`;
    const gear = await sql<{ id: number; notes: string; name: string }>`
      select id, notes, name from equipment
      where user_id = ${context.userId} and notes <> '' and note_done = false
        and notes !~* '^(comprato da|scontrino)' 
      order by id desc`;
    const sessions = await sql<{ id: number; notes: string; started_at: string }>`
      select id, notes, started_at::text as started_at from sessions
      where user_id = ${context.userId} and notes <> '' and note_done = false
      order by started_at desc`;
    return {
      items: [
        ...lanes.map((row) => ({
          source: "piazzola" as const,
          id: asNum(row.id),
          text: row.note,
          where: `${row.name} · piazzola ${asNum(row.n)}${row.label ? ` · ${row.label}` : ""}`,
        })),
        ...gear.map((row) => ({
          source: "attrezzatura" as const,
          id: asNum(row.id),
          text: row.notes,
          where: row.name,
        })),
        ...sessions.map((row) => ({
          source: "allenamento" as const,
          id: asNum(row.id),
          text: row.notes,
          where: String(row.started_at).slice(0, 10),
        })),
      ],
    };
  });

export const dismissNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { source?: string; id?: number };
    const source = raw.source === "piazzola" || raw.source === "attrezzatura" || raw.source === "allenamento" ? raw.source : "";
    const id = asNum(raw.id);
    if (!source || id < 1) throw new Error("Nota non valida.");
    return { source, id };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    if (data.source === "piazzola") {
      await sql`update piazzole set note_done = true where id = ${data.id} and user_id = ${context.userId}`;
    } else if (data.source === "attrezzatura") {
      await sql`update equipment set note_done = true where id = ${data.id} and user_id = ${context.userId}`;
    } else {
      await sql`update sessions set note_done = true where id = ${data.id} and user_id = ${context.userId}`;
    }
    return { ok: true as const };
  });

export const skillBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const people = await sql<{ user_id: string; given_name: string; family_name: string; nickname: string; slug: string; avatar_color: string; photo_url: string | null }>`
      select user_id, given_name, family_name, nickname, slug, avatar_color, photo_url
      from members where user_id is not null`;
    const animalLanes = await sql<{ user_id: string; label: string; score: number; arrows: string }>`
      select p.user_id, p.label, p.score, p.arrows
      from piazzole p
      join competition_entries e on e.competition_id = p.competition_id and e.user_id = p.user_id
      where e.target_kind = 'sagoma' and p.label <> ''`;
    const places = await sql<{ user_id: string; discipline: string; arrows: number; points: number }>`
      select s.user_id, s.discipline, count(sh.id)::int as arrows, coalesce(sum(sh.score), 0)::int as points
      from sessions s
      join shots sh on sh.session_id = s.id
      where s.discipline in ('indoor', 'outdoor')
      group by s.user_id, s.discipline`;
    const sagomaTrain = await sql<{ user_id: string; n: number; points: number }>`
      select s.user_id, count(sh.id)::int as n, coalesce(sum(sh.score), 0)::int as points
      from sessions s
      join shots sh on sh.session_id = s.id
      where s.aim_target = 'sagoma' or s.face like 'sagoma%'
      group by s.user_id`;
    const sagomaLaneRows = await sql<{ user_id: string; score: number; arrows: string }>`
      select p.user_id, p.score, p.arrows
      from piazzole p
      join competition_entries e on e.competition_id = p.competition_id and e.user_id = p.user_id
      where e.target_kind = 'sagoma'`;
    const animalBag = new Map<string, { userId: string; label: string; n: number; points: number }>();
    for (const row of animalLanes) {
      const parts = String(row.arrows ?? "")
        .split("+")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => asNum(part))
        .filter((part) => Number.isInteger(part) && part >= 0);
      const shots = parts.length ? parts : [asNum(row.score)];
      const key = `${row.user_id}\0${row.label}`;
      const cur = animalBag.get(key) ?? { userId: row.user_id, label: row.label, n: 0, points: 0 };
      cur.n += shots.length;
      cur.points += shots.reduce((sum, shot) => sum + shot, 0);
      animalBag.set(key, cur);
    }
    return {
      people: people.map((row) => ({
        userId: row.user_id,
        givenName: row.given_name,
        familyName: row.family_name,
        nickname: row.nickname,
        slug: row.slug,
        avatarColor: row.avatar_color,
        photoUrl: row.photo_url,
      })),
      animals: [...animalBag.values()],
      places: places.map((row) => ({ userId: row.user_id, discipline: row.discipline, arrows: asNum(row.arrows), points: asNum(row.points) })),
      sagoma: [...new Set([...sagomaTrain.map((row) => row.user_id), ...sagomaLaneRows.map((row) => row.user_id)])].map((userId) => {
        const train = sagomaTrain.find((row) => row.user_id === userId);
        let laneN = 0;
        let lanePoints = 0;
        for (const row of sagomaLaneRows) {
          if (row.user_id !== userId) continue;
          const parts = String(row.arrows ?? "")
            .split("+")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => asNum(part))
            .filter((part) => Number.isInteger(part) && part >= 0);
          const shots = parts.length ? parts : [asNum(row.score)];
          laneN += shots.length;
          lanePoints += shots.reduce((sum, shot) => sum + shot, 0);
        }
        const n = asNum(train?.n) + laneN;
        const points = asNum(train?.points) + lanePoints;
        return { userId, n, points, trainN: asNum(train?.n), laneN };
      }),
    };
  });

const ORDER_ITEMS = ["penne", "aste", "punte", "cocche", "flettenti", "altro"];

export const listClubOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<{ id: number; user_id: string; item: string; qty: number; note: string; status: string; given_name: string; family_name: string; nickname: string; slug: string }>`
      select o.id, o.user_id, o.item, o.qty, o.note, o.status, m.given_name, m.family_name, m.nickname, m.slug
      from club_orders o
      join members m on m.user_id = o.user_id
      order by case o.status when 'aperto' then 0 when 'ordinato' then 1 else 2 end, o.id desc`;
    return rows.map((row) => ({
      id: asNum(row.id),
      userId: row.user_id,
      item: row.item,
      qty: asNum(row.qty, 1),
      note: row.note,
      status: row.status,
      mine: row.user_id === context.userId,
      givenName: row.given_name,
      familyName: row.family_name,
      nickname: row.nickname,
      slug: row.slug,
    }));
  });

export const saveClubOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { item?: string; qty?: number; note?: string };
    const item = ORDER_ITEMS.includes(String(raw.item)) ? String(raw.item) : "";
    const qty = Math.round(asNum(raw.qty, 1));
    if (!item) throw new Error("Scegli cosa ordinare.");
    if (qty < 1 || qty > 500) throw new Error("Quantità non valida.");
    return { item, qty, note: clip(raw.note, 160) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    await sql`insert into club_orders (user_id, item, qty, note) values (${context.userId}, ${data.item}, ${data.qty}, ${data.note})`;
    return { ok: true as const };
  });

export const setClubOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { id?: number; status?: string; remove?: boolean };
    const status = raw.status === "ordinato" || raw.status === "arrivato" || raw.status === "aperto" ? raw.status : "";
    const id = asNum(raw.id);
    if (!id) throw new Error("Ordine non valido.");
    return { id, status, remove: raw.remove === true };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (data.remove) {
      await sql`delete from club_orders where id = ${data.id} and (user_id = ${context.userId} or ${me.role === "admin"})`;
      return { ok: true as const };
    }
    if (!data.status) throw new Error("Stato non valido.");
    await sql`update club_orders set status = ${data.status} where id = ${data.id}`;
    return { ok: true as const };
  });

/**
 * I premi di tutti gli arcieri, ricalcolati al più ogni 6 ore e un pezzo alla volta (al massimo 4 secondi per
 * richiesta, 6 arcieri insieme): chi riprende dal punto dov'era rimasto il giro precedente.
 */
async function syncAllBadges(sql: Awaited<ReturnType<typeof db>>) {
  const KEY = "premi_giro";
  const cur = await sql<{ value: { done?: string; after?: string | null } | string }>`select value from app_settings where key = ${KEY} limit 1`;
  const raw = cur[0]?.value;
  const st: { done?: string; after?: string | null } = (typeof raw === "string" ? JSON.parse(raw) : raw) ?? {};
  // un giro intero al massimo ogni ora (gare nuove, risultati dal portale, archivio FITAST)
  if (!st.after && st.done && Date.now() - Date.parse(st.done) < 3600_000) return;
  const after = st.after ?? "";
  const members = await sql<{ user_id: string }>`select user_id from members where user_id is not null and user_id > ${after} order by user_id`;
  // le gare di tutti in una lettura sola: prima ognuno rileggeva tutte le classifiche e il giro non finiva mai
  const loads = await garaLoads(sql).catch(() => null);
  const t0 = Date.now();
  let last = after;
  for (let i = 0; i < members.length && Date.now() - t0 < 3500; i += 8) {
    const chunk = members.slice(i, i + 8);
    await Promise.all(chunk.map((m) => syncBadges(sql, m.user_id, loads ? (loads.get(m.user_id) ?? []) : undefined).catch(() => [])));
    last = chunk[chunk.length - 1].user_id;
  }
  const finished = !members.length || last === members[members.length - 1].user_id;
  const value = finished ? { done: new Date().toISOString(), after: null } : { done: st.done ?? null, after: last };
  await sql`
    insert into app_settings (key, value, updated_at) values (${KEY}, ${JSON.stringify(value)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

const prizeTarget = (input: unknown) => {
  const raw = (input ?? {}) as { userId?: unknown; memberId?: unknown };
  return { userId: clip(raw.userId, 80), memberId: asNum(raw.memberId) };
};

/**
 * Premi ricalcolati in sottofondo: l'app manda questa richiesta senza aspettarla, le pagine leggono subito i premi
 * già salvati (prima la lettura ricalcolava tutto e, a giro aperto, ogni pagina con i premi aspettava 4-5 secondi
 * e caricava il database mentre l'arciere usava l'app). changed: medaglie nuove per chi apre o per l'arciere guardato.
 * GET: non è un salvataggio dell'arciere, così i dati già in memoria nel telefono restano validi.
 */
export const refreshPrizes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(prizeTarget)
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    let fresh = (await syncBadges(sql, context.userId).catch(() => [] as string[])).length;
    if ((data.userId && data.userId !== context.userId) || data.memberId) {
      const known = data.memberId
        ? await sql<{ user_id: string }>`select user_id from members where id = ${data.memberId} and user_id is not null limit 1`
        : await sql<{ user_id: string }>`select user_id from members where user_id = ${data.userId} limit 1`;
      const uid = known[0]?.user_id;
      if (uid && uid !== context.userId) fresh += (await syncBadges(sql, uid).catch(() => [] as string[])).length;
    }
    // il giro di tutti: una richiesta alla volta (se un'altra lo sta facendo da meno di 15 secondi, questa salta)
    const turn = await sql<{ key: string }>`
      insert into app_settings (key, value, updated_at) values ('premi_giro_turno', '{}'::jsonb, now())
      on conflict (key) do update set updated_at = now() where app_settings.updated_at < now() - interval '15 seconds'
      returning key`;
    if (turn.length) await syncAllBadges(sql).catch(() => undefined);
    return { changed: fresh > 0 };
  });

export const listGadgets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(prizeTarget)
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    // solo lettura: il ricalcolo è in refreshPrizes, in sottofondo
    const rows = await sql<{ user_id: string; code: string; given_name: string; family_name: string; nickname: string; slug: string; unlocked_at: unknown }>`
      select u.user_id, u.code, m.given_name, m.family_name, m.nickname, m.slug, u.unlocked_at
      from user_achievements u
      join members m on m.user_id = u.user_id
      order by u.unlocked_at desc`;
    return {
      prizes: PRIZES.map((prize) => ({
        ...prize,
        holders: rows.filter((row) => row.code === prize.code).map((row) => ({
          userId: row.user_id,
          givenName: row.given_name,
          familyName: row.family_name,
          nickname: row.nickname,
          slug: row.slug,
          unlockedAt: row.unlocked_at instanceof Date ? row.unlocked_at.toISOString() : String(row.unlocked_at ?? ""),
        })),
      })),
    };
  });


/** Quanto è stato usato ogni attrezzo: uscite, frecce e media, passando dalle configurazioni. */
export const gearStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<{ id: number; sessions: number; arrows: number; points: number; last: unknown }>`
      select eq.id,
        count(distinct s.id)::int as sessions,
        count(sh.id)::int as arrows,
        coalesce(sum(sh.score), 0)::int as points,
        max(s.started_at) as last
      from equipment eq
      join setups su on su.user_id = ${context.userId} and (su.bow_id = eq.id or su.arrow_id = eq.id)
      join sessions s on s.setup_id = su.id and s.user_id = ${context.userId}
      left join shots sh on sh.session_id = s.id
      where eq.user_id = ${context.userId}
      group by eq.id`;
    return rows.map((r) => {
      const arrows = Number(r.arrows) || 0;
      return {
        id: Number(r.id),
        sessions: Number(r.sessions) || 0,
        arrows,
        avg: arrows ? (Number(r.points) || 0) / arrows : 0,
        last: r.last ? new Date(String(r.last)).toISOString().slice(0, 10) : "",
      };
    });
  });
