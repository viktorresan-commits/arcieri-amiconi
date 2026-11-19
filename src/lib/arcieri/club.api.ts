import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asBool, asIso, asNum, asNumOrNull, canScore, clip, db, ensureMember, PRIZES, type MemberRow } from "./access";
import { syncBadges } from "./badges";
import { challengeScores, rulesFair, teamMeans, type Metric, type Rule } from "./challenge";
import { romeMidnightUtc, ymdAdd } from "./time";
import { divisionOf } from "./labels";
import type { TallyShot } from "./scoring";
import { aimSpot, faceById, ringPoint, scoreAtRadius } from "./scoring";

const METRICS: Metric[] = ["total", "avg", "tens", "sessions", "improvement"];

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
  return JSON.stringify(out).slice(0, 4000);
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
    const rows = await sql<{
      id: number; user_id: string; visibility: string; category: string; name: string; brand: string; model: string;
      photo_url: string | null; purchased_on: string | null; price_cents: number | null; shop: string; notes: string;
      status: string; specs: string;
    }>`
      select id, user_id, visibility, category, name, brand, model, photo_url, purchased_on::text as purchased_on,
        price_cents, shop, notes, status, specs
      from equipment
      where user_id = ${context.userId} or visibility = 'group'
      order by category, name`;
    return rows.map((r) => ({
      id: asNum(r.id),
      mine: r.user_id === context.userId,
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
      visibility: raw.visibility === "group" ? "group" : "personal",
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

export const deleteEquipment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: number })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const rows = await sql`delete from equipment where id = ${data.id} and (user_id = ${context.userId} or (${me.role === "admin"} and visibility = 'group')) returning id`;
    if (!rows[0]) throw new Error("Pezzo non trovato.");
    return { ok: true as const };
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

export const deleteSetup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: number })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await sql`delete from setups where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

function parseRule(raw: Record<string, unknown>): Rule {
  const metric = METRICS.includes(raw.metric as Metric) ? (raw.metric as Metric) : "avg";
  const distance = Number(raw.distanceM);
  const rule: Rule = {
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
    const shots = await sql<{
      user_id: string; session_id: number; started_at: unknown; distance_m: unknown; bow_type: string; face: string; discipline: string;
      block_index: number; end_index: number; arrow_index: number; score: number; is_x: boolean; miss: boolean;
    }>`
      select s.user_id, s.id as session_id, s.started_at, s.distance_m, s.bow_type, s.face, s.discipline,
        sh.block_index, sh.end_index, sh.arrow_index, sh.score, sh.is_x, sh.miss
      from sessions s join shots sh on sh.session_id = s.id
      where s.started_at >= ${prevFrom.toISOString()}::timestamptz and s.started_at < ${to.toISOString()}::timestamptz`;
    const allowed = new Set(ids);
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
    const members = await sql<MemberRow>`select * from members where user_id is not null`;
    const byUser = new Map(members.map((m) => [m.user_id, m]));
    const teamOf = new Map(people.map((p) => [p.user_id, p.team_name]));
    const rows = scores.map((s, index) => {
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
    return { title: ch[0].title, rule, rows, teams: teamMeans(rows.map((r) => ({ userId: r.userId, team: r.team, value: r.value }))) };
  });

export const listCompetitions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const comps = await sql<{
      id: number; name: string; starts_on: string; place: string; organizer: string; kind: string; distance_m: number | null;
      category: string; signup_deadline: string | null; external_url: string; notes: string;
    }>`
      select id, name, starts_on::text as starts_on, place, organizer, kind, distance_m, category,
        signup_deadline::text as signup_deadline, external_url, notes
      from competitions order by starts_on`;
    const entries = await sql<{ id: number; competition_id: number; user_id: string; score: number | null; rank: number | null; category: string; notes: string; lane_count: number | null; spot: number | null; championship_points: number | null; target_kind: string; sagoma_max: number | null }>`
      select id, competition_id, user_id, score, rank, category, notes, lane_count, spot, championship_points, target_kind, sagoma_max from competition_entries`;
    const lanes = await sql<{ competition_id: number; user_id: string; n: number; score: number; arrows: string; label: string; distance_m: number | null; note: string; aim_angle: string }>`
      select competition_id, user_id, n, score, arrows, label, distance_m, note, aim_angle from piazzole order by n`;
    const presence = await sql<{ competition_id: number; user_id: string; attended: boolean }>`
      select competition_id, user_id, attended from competition_presence`;
    const mine = new Map(presence.filter((row) => row.user_id === context.userId).map((row) => [asNum(row.competition_id), asBool(row.attended)]));
    const members = await sql<MemberRow>`select * from members where user_id is not null`;
    return {
      competitions: comps.map((c) => ({
        id: asNum(c.id),
        name: c.name,
        startsOn: String(c.starts_on).slice(0, 10),
        place: c.place,
        organizer: c.organizer,
        kind: c.kind,
        distanceM: asNumOrNull(c.distance_m),
        category: c.category,
        signupDeadline: c.signup_deadline ? String(c.signup_deadline).slice(0, 10) : null,
        externalUrl: c.external_url,
        notes: c.notes,
        attended: mine.has(asNum(c.id)) ? mine.get(asNum(c.id)) ?? null : null,
        roster: presence.filter((row) => row.competition_id === c.id).map((row) => {
          const member = members.find((item) => item.user_id === row.user_id);
          return {
            userId: row.user_id,
            attended: asBool(row.attended),
            givenName: member?.given_name ?? "",
            familyName: member?.family_name ?? "",
            nickname: member?.nickname ?? "",
            slug: member?.slug ?? "",
            photoUrl: member?.photo_url ?? null,
            avatarColor: member?.avatar_color ?? "#1f5c38",
          };
        }),
        entries: entries.filter((e) => e.competition_id === c.id).map((e) => ({
          id: asNum(e.id),
          userId: e.user_id,
          score: asNumOrNull(e.score),
          rank: asNumOrNull(e.rank),
          laneCount: asNumOrNull(e.lane_count),
          spot: asNumOrNull(e.spot),
          championshipPoints: asNumOrNull(e.championship_points),
          targetKind: e.target_kind === "sagoma" ? "sagoma" : e.target_kind === "padiglione" ? "padiglione" : "",
          sagomaMax: e.sagoma_max === 10 || e.sagoma_max === 8 || e.sagoma_max === 11 ? e.sagoma_max : null,
          category: e.category,
          notes: e.user_id === context.userId ? e.notes : "",
          givenName: members.find((m) => m.user_id === e.user_id)?.given_name ?? "",
          familyName: members.find((m) => m.user_id === e.user_id)?.family_name ?? "",
          nickname: members.find((m) => m.user_id === e.user_id)?.nickname ?? "",
          slug: members.find((m) => m.user_id === e.user_id)?.slug ?? "",
          photoUrl: members.find((m) => m.user_id === e.user_id)?.photo_url ?? null,
          avatarColor: members.find((m) => m.user_id === e.user_id)?.avatar_color ?? "#1f5c38",
          piazzole: lanes
            .filter((p) => p.competition_id === c.id && p.user_id === e.user_id)
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
        })),
      })),
    };
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
      category: divisionOf(clip(raw.category, 20)),
      notes: clip(raw.notes, 300),
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
      values (${data.competitionId}, ${context.userId}, ${score}, ${data.rank}, ${data.category}, ${data.notes}, ${laneCount}, ${spot}, ${data.championshipPoints}, ${data.targetKind}, ${data.sagomaMax})
      on conflict (competition_id, user_id) do update set
        score = excluded.score, rank = excluded.rank, category = excluded.category, notes = excluded.notes,
        lane_count = excluded.lane_count, spot = excluded.spot, championship_points = excluded.championship_points,
        target_kind = excluded.target_kind, sagoma_max = excluded.sagoma_max`;
    const previous = await sql<{ n: number; note: string; note_done: boolean }>`
      select n, note, note_done from piazzole where competition_id = ${data.competitionId} and user_id = ${context.userId}`;
    const kept = new Map(previous.map((row) => [asNum(row.n), row]));
    await sql`delete from piazzole where competition_id = ${data.competitionId} and user_id = ${context.userId}`;
    for (const lane of data.piazzole) {
      const old = kept.get(lane.n);
      const done = Boolean(lane.note && old && old.note === lane.note && old.note_done);
      await sql`
        insert into piazzole (competition_id, user_id, n, score, arrows, label, distance_m, note, note_done, aim_angle)
        values (${data.competitionId}, ${context.userId}, ${lane.n}, ${lane.score}, ${lane.arrows.length ? lane.arrows.join("+") : ""}, ${lane.label}, ${lane.distanceM}, ${lane.note}, ${done}, ${lane.aimAngle})`;
    }
    if (score != null) await syncBadges(sql, context.userId);
    await sql`
      insert into competition_presence (competition_id, user_id, attended)
      values (${data.competitionId}, ${context.userId}, true)
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
    if (data.userId !== context.userId) throw new Error("Puoi togliere solo il tuo punteggio.");
    await sql`delete from piazzole where competition_id = ${data.competitionId} and user_id = ${data.userId}`;
    const rows = await sql`
      delete from competition_entries
      where competition_id = ${data.competitionId} and user_id = ${data.userId}
      returning id`;
    if (!rows[0]) throw new Error("Punteggio non trovato.");
    return { ok: true as const };
  });

export const archerBoard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const id = asNum((input as { id?: number })?.id);
    if (!id) throw new Error("Arciere non trovato.");
    return { id };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<MemberRow>`select * from members where id = ${data.id} and user_id is not null limit 1`;
    const member = rows[0];
    if (!member?.user_id) throw new Error("Questo arciere non è ancora nel gruppo.");
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
      givenName: member.given_name,
      familyName: member.family_name,
      nickname: member.nickname,
      slug: member.slug,
      bowType: member.bow_type,
      photoUrl: member.photo_url,
      avatarColor: member.avatar_color,
      joinedOn: String(member.joined_on ?? "").slice(0, 10),
      mine: member.user_id === context.userId,
      trainings,
      comps: comps.map((c) => ({
        name: c.name,
        day: String(c.starts_on).slice(0, 10),
        score: asNum(c.score),
      })),
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
    if (data.collective && me.role !== "admin") throw new Error("Gli obiettivi di gruppo li crea l'amministratore.");
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
    if (data.group && me.role !== "admin") throw new Error("Gli eventi di gruppo li inserisce l'amministratore.");
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

    const people = await sql<{
      id: number; user_id: string; given_name: string; family_name: string; nickname: string; slug: string;
      avatar_color: string; photo_url: string | null; bow_type: string; user_image: string | null;
    }>`
      select m.id, m.user_id, m.given_name, m.family_name, m.nickname, m.slug, m.avatar_color, m.photo_url, m.bow_type, u.image as user_image
      from members m
      join "user" u on u.id = m.user_id
      where m.user_id is not null
      order by m.given_name, m.id`;

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
        const garaArrows = garaArrowsOf.get(row.user_id) ?? 0;
        const points = asNum(shot?.points);
        const comp = compOf.get(row.user_id);
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
          photoUrl: row.photo_url || remote,
          bowType: row.bow_type,
          sessions: asNum(shot?.sessions),
          arrows: arrows + garaArrows,
          trainArrows: arrows,
          garaArrows,
          avg: arrows > 0 ? points / arrows : null,
          gare: gareOf.get(row.user_id)?.size ?? 0,
          champ: champOf.get(row.user_id) ?? 0,
          compAvg: comp && comp.n > 0 ? comp.points / comp.n : null,
          bestDistance,
          division: divisionOfEntry.get(row.user_id)?.name ?? "",
          shots: shotsOf.get(row.user_id) ?? [],
          sagoma: sagomaOf.get(row.user_id) ?? [],
        };
      }),
    };
  });

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

export const listGadgets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const members = await sql<{ user_id: string }>`select user_id from members where user_id is not null`;
    for (const member of members) await syncBadges(sql, member.user_id);
    const rows = await sql<{ user_id: string; code: string; given_name: string; family_name: string; nickname: string; slug: string }>`
      select u.user_id, u.code, m.given_name, m.family_name, m.nickname, m.slug
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
        })),
      })),
    };
  });

