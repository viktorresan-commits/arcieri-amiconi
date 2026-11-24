/**
 * Scheda Allenatore: gli allievi della compagnia in una schermata, con media, andamento,
 * ultimo allenamento e avvisi per cali e assenze; per ogni allievo progressi, analisi del gesto,
 * foto delle volée e schede di allenamento personalizzate.
 *
 * La aprono gli allenatori, il presidente della compagnia e il fondatore.
 * Un arciere può togliere i suoi allenamenti dal pannello (Profilo › Account › Privacy).
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asBool, asNum, db, ensureMember, staffLevel } from "./access";
import { homeId, myMembership } from "./compagnie.api";
import { faceById } from "./scoring";

const DAY = 86_400_000;

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export type Athlete = {
  memberId: number;
  name: string;
  photoUrl: string | null;
  color: string;
  shares: boolean;
  lastAt: string | null;
  daysAway: number | null;
  avg: number | null;
  delta: number | null;
  spark: number[];
  arrows30: number;
  sessions30: number;
  lastInfo: string;
  alerts: { kind: "calo" | "assente" | "nuovo"; text: string }[];
};

export const coachBoard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ companyId: asNum((input as { companyId?: unknown })?.companyId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const staff = staffLevel(me);
    const mine = await myMembership(sql, context.userId);
    const leader = mine.role === "owner";
    if (!staff && !leader && !asBool(me.coach)) {
      throw new Error("La scheda Allenatore è per gli allenatori e il presidente della compagnia.");
    }
    // lo staff segue tutte le compagnie; gli altri solo la propria
    const companyId = staff && data.companyId ? data.companyId : mine.companyId;
    const home = await homeId(sql);
    const company = await sql<{ id: number; name: string; color: string }>`select id, name, color from companies where id = ${companyId} limit 1`;
    if (!company[0]) throw new Error("Compagnia non trovata.");
    const companies = staff ? await sql<{ id: number; name: string }>`select id, name from companies order by name` : [];

    const people = await sql<{ id: number; user_id: string; given_name: string; family_name: string; nickname: string; photo_url: string | null; avatar_color: string; share_coach: boolean | null; company_id: number | null }>`
      select m.id, m.user_id, m.given_name, m.family_name, m.nickname, m.photo_url, m.avatar_color, m.share_coach, cm.company_id
      from members m
      left join company_members cm on cm.user_id = m.user_id
      where m.user_id is not null`.then((rows) => rows.filter((r) => (r.company_id == null ? home : asNum(r.company_id)) === companyId && r.user_id !== context.userId));
    const ids = new Set(people.map((p) => p.user_id));

    const sessions = await sql<{ id: number; user_id: string; started_at: unknown; face: string; distance_m: number; n: number; avg: number }>`
      select s.id, s.user_id, s.started_at, s.face, s.distance_m, count(sh.id)::int as n, avg(case when sh.miss then 0 else sh.score end)::float as avg
      from sessions s join shots sh on sh.session_id = s.id
      where s.started_at > now() - interval '150 days'
      group by s.id
      order by s.started_at desc`.then((rows) => rows.filter((r) => ids.has(r.user_id)));
    const lastEver = await sql<{ user_id: string; at: unknown }>`select user_id, max(started_at) as at from sessions group by user_id`.then((rows) => new Map(rows.filter((r) => ids.has(r.user_id)).map((r) => [r.user_id, iso(r.at)])));

    const now = Date.now();
    const athletes: Athlete[] = people.map((p) => {
      const name = [p.given_name, p.family_name].filter(Boolean).join(" ") || p.nickname || "Arciere";
      const shares = p.share_coach !== false;
      const base = { memberId: asNum(p.id), name, photoUrl: p.photo_url && p.photo_url.length < 200_000 ? p.photo_url : null, color: p.avatar_color || "#1f5c38", shares };
      if (!shares) return { ...base, lastAt: null, daysAway: null, avg: null, delta: null, spark: [], arrows30: 0, sessions30: 0, lastInfo: "Non condivide i suoi allenamenti", alerts: [] };
      const mine = sessions.filter((s) => s.user_id === p.user_id);
      // media di ogni seduta in decimi del bersaglio, così bersagli diversi si confrontano
      const scored = mine.filter((s) => asNum(s.n) >= 6).map((s) => ({ ...s, tenths: (asNum(s.avg) / (faceById(s.face).max || 10)) * 10 }));
      const last3 = scored.slice(0, 3).map((s) => s.tenths);
      const prev3 = scored.slice(3, 6).map((s) => s.tenths);
      const avg = last3.length ? mean(last3) : null;
      const delta = last3.length === 3 && prev3.length === 3 ? mean(last3) - mean(prev3) : null;
      const lastAt = lastEver.get(p.user_id) || null;
      const daysAway = lastAt ? Math.floor((now - new Date(lastAt).getTime()) / DAY) : null;
      const in30 = mine.filter((s) => now - new Date(iso(s.started_at)).getTime() < 30 * DAY);
      const top = mine[0];
      const alerts: Athlete["alerts"] = [];
      if (delta != null && delta <= -0.3) alerts.push({ kind: "calo", text: `media in calo da 3 sedute (${delta.toFixed(2).replace(".", ",")})` });
      if (daysAway != null && daysAway >= 10) alerts.push({ kind: "assente", text: `nessun tiro da ${daysAway} giorni` });
      if (!lastAt) alerts.push({ kind: "nuovo", text: "non ha ancora registrato allenamenti" });
      return {
        ...base,
        lastAt,
        daysAway,
        avg,
        delta,
        spark: scored.slice(0, 8).map((s) => Math.round(s.tenths * 100) / 100).reverse(),
        arrows30: in30.reduce((a, s) => a + asNum(s.n), 0),
        sessions30: in30.length,
        lastInfo: top ? `${asNum(top.n)} frecce · ${asNum(top.distance_m)} m` : "",
        alerts,
      };
    });
    // prima chi ha bisogno di attenzione, poi chi è più attivo
    const weight = (a: Athlete) => (a.alerts.some((x) => x.kind !== "nuovo") ? 0 : a.shares && a.lastAt ? 1 : 2);
    athletes.sort((a, b) => weight(a) - weight(b) || (a.daysAway ?? 9999) - (b.daysAway ?? 9999) || a.name.localeCompare(b.name));
    // schede attive per allievo
    const open = await sql<{ athlete_user_id: string; n: number }>`
      select athlete_user_id, count(*)::int as n from coach_plans where company_id = ${companyId} and status = 'attiva' group by athlete_user_id`;
    const byUser = new Map(people.map((p) => [p.user_id, asNum(p.id)]));
    const planCount: Record<number, number> = {};
    for (const r of open) {
      const id = byUser.get(r.athlete_user_id);
      if (id) planCount[id] = asNum(r.n);
    }
    return {
      company: { id: asNum(company[0].id), name: company[0].name, color: company[0].color },
      companies: companies.map((c) => ({ id: asNum(c.id), name: c.name })),
      athletes,
      planCount,
      summary: {
        total: athletes.length,
        active7: athletes.filter((a) => a.daysAway != null && a.daysAway < 7).length,
        follow: athletes.filter((a) => a.alerts.some((x) => x.kind !== "nuovo")).length,
      },
    };
  });

/* ---------------- scheda Allenatore: un allievo, le sue schede, i suoi progressi ---------------- */

export type PlanItem = { title: string; detail: string; distance: number | null; arrows: number | null };

export type Plan = {
  id: number;
  athleteMemberId: number;
  athleteName: string;
  coachName: string;
  mine: boolean;
  title: string;
  goal: string;
  notes: string;
  items: PlanItem[];
  done: number[];
  startsOn: string;
  endsOn: string;
  status: "attiva" | "conclusa";
  athleteNote: string;
  updatedAt: string;
};

type PlanRaw = {
  id: number;
  coach_user_id: string;
  athlete_user_id: string;
  title: string;
  goal: string;
  notes: string;
  items: unknown;
  done: unknown;
  starts_on: unknown;
  ends_on: unknown;
  status: string;
  athlete_note: string;
  updated_at: unknown;
};

function day(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const m = String(value ?? "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "";
}

function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function personName(p: { given_name?: string | null; family_name?: string | null; nickname?: string | null } | undefined) {
  if (!p) return "Arciere";
  return [p.given_name, p.family_name].filter(Boolean).join(" ") || p.nickname || "Arciere";
}

/** chi può allenare chi: il fondatore tutti, presidente e allenatori solo la loro compagnia */
async function coachAccess(sql: Awaited<ReturnType<typeof db>>, userId: string, memberId: number) {
  const me = await ensureMember(sql, userId);
  const staff = staffLevel(me);
  const mine = await myMembership(sql, userId);
  if (!staff && mine.role !== "owner" && !asBool(me.coach)) throw new Error("La scheda Allenatore è per gli allenatori e il presidente della compagnia.");
  const rows = await sql<{ id: number; user_id: string | null; given_name: string; family_name: string; nickname: string; photo_url: string | null; avatar_color: string; share_coach: boolean | null; bow_type: string }>`
    select id, user_id, given_name, family_name, nickname, photo_url, avatar_color, share_coach, bow_type from members where id = ${memberId} limit 1`;
  const target = rows[0];
  if (!target?.user_id) throw new Error("Allievo non trovato.");
  const theirs = await myMembership(sql, target.user_id);
  if (!staff && theirs.companyId !== mine.companyId) throw new Error("Puoi seguire solo gli allievi della tua compagnia.");
  return { me, staff, mine, target: { ...target, user_id: target.user_id }, companyId: theirs.companyId };
}

function planOf(r: PlanRaw, names: Map<string, string>, athleteMemberId: number, viewer: string): Plan {
  const items = asJson<PlanItem[]>(r.items, []).filter((x) => x && typeof x.title === "string");
  return {
    id: asNum(r.id),
    athleteMemberId,
    athleteName: names.get(r.athlete_user_id) ?? "Allievo",
    coachName: names.get(r.coach_user_id) ?? "Allenatore",
    mine: r.coach_user_id === viewer,
    title: r.title,
    goal: r.goal,
    notes: r.notes,
    items,
    done: asJson<number[]>(r.done, []).filter((n) => Number.isInteger(n) && n >= 0 && n < items.length),
    startsOn: day(r.starts_on),
    endsOn: day(r.ends_on),
    status: r.status === "conclusa" ? "conclusa" : "attiva",
    athleteNote: r.athlete_note ?? "",
    updatedAt: iso(r.updated_at),
  };
}

async function nameMap(sql: Awaited<ReturnType<typeof db>>, userIds: string[]) {
  if (!userIds.length) return { names: new Map<string, string>(), ids: new Map<string, number>() };
  const rows = await sql<{ id: number; user_id: string; given_name: string; family_name: string; nickname: string }>`
    select id, user_id, given_name, family_name, nickname from members where user_id = any(string_to_array(${userIds.join(",")}, ','))`;
  return { names: new Map(rows.map((r) => [r.user_id, personName(r)])), ids: new Map(rows.map((r) => [r.user_id, asNum(r.id)])) };
}

/** tutto quello che l'allenatore vede di un allievo: progressi, analisi del gesto, foto delle volée, schede */
export const athleteBoard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ memberId: asNum((input as { memberId?: unknown })?.memberId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { target, companyId } = await coachAccess(sql, context.userId, data.memberId);
    const shares = target.share_coach !== false;
    const plansRaw = await sql<PlanRaw>`
      select * from coach_plans where athlete_user_id = ${target.user_id} and (company_id = ${companyId} or company_id is null)
      order by (status = 'attiva') desc, updated_at desc limit 40`;
    const { names } = await nameMap(sql, [...new Set([target.user_id, ...plansRaw.map((p) => p.coach_user_id)])]);
    const plans = plansRaw.map((p) => planOf(p, names, data.memberId, context.userId));
    const base = {
      athlete: {
        memberId: asNum(target.id),
        name: personName(target),
        photoUrl: target.photo_url && target.photo_url.length < 200_000 ? target.photo_url : null,
        color: target.avatar_color || "#1f5c38",
        bowType: target.bow_type || "",
        shares,
      },
      plans,
    };
    if (!shares) return { ...base, sessions: [], gestures: [], photos: [] };

    // sedute degli ultimi 12 mesi, con media in decimi del bersaglio (così bersagli diversi si confrontano)
    const rows = await sql<{ id: number; started_at: unknown; face: string; distance_m: number; n: number; avg: number; xs: number; tens: number; has_photo: boolean }>`
      select s.id, s.started_at, s.face, s.distance_m, count(sh.id)::int as n,
        avg(case when sh.miss then 0 else sh.score end)::float as avg,
        sum(case when sh.is_x then 1 else 0 end)::int as xs,
        sum(case when not sh.miss and sh.score >= 10 then 1 else 0 end)::int as tens,
        (s.target_photo <> '') as has_photo
      from sessions s join shots sh on sh.session_id = s.id
      where s.user_id = ${target.user_id} and s.started_at > now() - interval '365 days'
      group by s.id
      order by s.started_at`;
    const sessions = rows
      .filter((r) => asNum(r.n) >= 3)
      .map((r) => {
        const max = faceById(r.face).max || 10;
        return {
          id: asNum(r.id),
          day: iso(r.started_at).slice(0, 10),
          distance: asNum(r.distance_m),
          face: r.face,
          arrows: asNum(r.n),
          avg: Math.round(asNum(r.avg) * 100) / 100,
          tenths: Math.round((asNum(r.avg) / max) * 1000) / 100,
          tens: asNum(r.tens),
          photo: Boolean(r.has_photo),
        };
      });

    const g = await sql<Record<string, unknown>>`
      select id, title, kind, hand, score, shots, anchor_s, draw_s, line_deg, bow_deg, shoulder_deg, jitter, distance_m, thumb, created_at
      from gestures where member_id = ${target.id} order by created_at desc limit 24`;
    const gestures = g.map((r) => ({
      id: asNum(r.id),
      title: String(r.title ?? ""),
      kind: r.kind === "foto" ? "foto" : "video",
      score: r.score == null ? null : asNum(r.score),
      shots: asNum(r.shots),
      anchorS: r.anchor_s == null ? null : Number(r.anchor_s),
      drawS: r.draw_s == null ? null : Number(r.draw_s),
      lineDeg: r.line_deg == null ? null : Number(r.line_deg),
      bowDeg: r.bow_deg == null ? null : Number(r.bow_deg),
      shoulderDeg: r.shoulder_deg == null ? null : Number(r.shoulder_deg),
      jitter: r.jitter == null ? null : Number(r.jitter),
      distanceM: r.distance_m == null ? null : Number(r.distance_m),
      thumb: String(r.thumb ?? "").length < 170_000 ? String(r.thumb ?? "") : "",
      createdAt: iso(r.created_at),
    }));

    // foto delle volée: le ultime 12 sedute con la foto del bersaglio
    const ph = await sql<{ id: number; started_at: unknown; target_photo: string; distance_m: number }>`
      select id, started_at, target_photo, distance_m from sessions
      where user_id = ${target.user_id} and target_photo <> '' and length(target_photo) < 600000
      order by started_at desc limit 12`;
    const bySession = new Map(sessions.map((s) => [s.id, s]));
    const photos = ph.map((p) => ({
      sessionId: asNum(p.id),
      day: iso(p.started_at).slice(0, 10),
      distance: asNum(p.distance_m),
      photo: p.target_photo,
      avg: bySession.get(asNum(p.id))?.avg ?? null,
      arrows: bySession.get(asNum(p.id))?.arrows ?? null,
    }));
    return { ...base, sessions, gestures, photos };
  });

/** le schede preparate nella compagnia, per la lista della scheda Allenatore */
export const companyPlans = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ companyId: asNum((input as { companyId?: unknown })?.companyId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const staff = staffLevel(me);
    const mine = await myMembership(sql, context.userId);
    if (!staff && mine.role !== "owner" && !asBool(me.coach)) throw new Error("La scheda Allenatore è per gli allenatori e il presidente della compagnia.");
    const companyId = staff && data.companyId ? data.companyId : mine.companyId;
    const rows = await sql<PlanRaw>`select * from coach_plans where company_id = ${companyId} order by (status = 'attiva') desc, updated_at desc limit 80`;
    const { names, ids } = await nameMap(sql, [...new Set(rows.flatMap((r) => [r.coach_user_id, r.athlete_user_id]))]);
    return rows.map((r) => planOf(r, names, ids.get(r.athlete_user_id) ?? 0, context.userId));
  });

function cleanItems(value: unknown): PlanItem[] {
  if (!Array.isArray(value)) return [];
  const toNum = (v: unknown, hi: number) => {
    const n = Number(v);
    return v === "" || v == null || !Number.isFinite(n) || n <= 0 ? null : Math.min(hi, Math.round(n));
  };
  return value
    .slice(0, 24)
    .map((x) => {
      const r = (x ?? {}) as Record<string, unknown>;
      return { title: String(r.title ?? "").replace(/\s+/g, " ").trim().slice(0, 90), detail: String(r.detail ?? "").trim().slice(0, 400), distance: toNum(r.distance, 90), arrows: toNum(r.arrows, 300) };
    })
    .filter((x) => x.title);
}

/** crea o modifica una scheda di allenamento per un allievo */
export const savePlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null);
    const title = String(r.title ?? "").replace(/\s+/g, " ").trim().slice(0, 90);
    if (!title) throw new Error("Dai un titolo alla scheda.");
    const items = cleanItems(r.items);
    if (!items.length) throw new Error("Aggiungi almeno un esercizio.");
    return {
      id: r.id == null ? null : asNum(r.id),
      memberId: asNum(r.memberId),
      title,
      goal: String(r.goal ?? "").trim().slice(0, 300),
      notes: String(r.notes ?? "").trim().slice(0, 1200),
      items,
      startsOn: date(r.startsOn),
      endsOn: date(r.endsOn),
      status: r.status === "conclusa" ? ("conclusa" as const) : ("attiva" as const),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { target, companyId } = await coachAccess(sql, context.userId, data.memberId);
    const items = JSON.stringify(data.items);
    if (data.id) {
      const old = await sql<{ id: number; athlete_user_id: string; items: unknown; done: unknown }>`select id, athlete_user_id, items, done from coach_plans where id = ${data.id} limit 1`;
      if (!old[0] || old[0].athlete_user_id !== target.user_id) throw new Error("Scheda non trovata.");
      // gli esercizi già spuntati restano spuntati se il titolo non cambia
      const before = asJson<PlanItem[]>(old[0].items, []);
      const doneTitles = new Set(asJson<number[]>(old[0].done, []).map((i) => before[i]?.title).filter(Boolean));
      const done = JSON.stringify(data.items.map((x, i) => (doneTitles.has(x.title) ? i : -1)).filter((i) => i >= 0));
      await sql`
        update coach_plans set title = ${data.title}, goal = ${data.goal}, notes = ${data.notes}, items = ${items}::jsonb, done = ${done}::jsonb,
          starts_on = ${data.startsOn}, ends_on = ${data.endsOn}, status = ${data.status}, updated_at = now()
        where id = ${data.id}`;
      return { id: data.id };
    }
    const made = await sql<{ id: number }>`
      insert into coach_plans (company_id, coach_user_id, athlete_user_id, title, goal, notes, items, starts_on, ends_on, status)
      values (${companyId}, ${context.userId}, ${target.user_id}, ${data.title}, ${data.goal}, ${data.notes}, ${items}::jsonb, ${data.startsOn}, ${data.endsOn}, ${data.status})
      returning id`;
    const id = asNum(made[0]?.id);
    if (target.user_id !== context.userId) {
      try {
        await sql`
          insert into notifications (user_id, title, body, href, dedupe)
          values (${target.user_id}, ${"Nuova scheda di allenamento"}, ${`«${data.title}»: ${data.items.length} esercizi preparati dal tuo allenatore.`}, ${"/schede"}, ${`plan-${id}`})
          on conflict (dedupe) do nothing`;
      } catch {
        /* l'avviso non è indispensabile */
      }
    }
    return { id };
  });

/** toglie una scheda: chi l'ha scritta, il presidente della compagnia o il fondatore */
export const deletePlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: unknown })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const rows = await sql<{ id: number; coach_user_id: string; athlete_user_id: string; company_id: number | null }>`select id, coach_user_id, athlete_user_id, company_id from coach_plans where id = ${data.id} limit 1`;
    const p = rows[0];
    if (!p) throw new Error("Scheda non trovata.");
    const me = await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    const allowed = p.coach_user_id === context.userId || Boolean(staffLevel(me)) || (mine.role === "owner" && asNum(p.company_id) === mine.companyId);
    if (!allowed) throw new Error("La toglie chi l'ha scritta o il presidente della compagnia.");
    await sql`delete from coach_plans where id = ${p.id}`;
    return { ok: true as const };
  });

/** le schede che gli allenatori hanno preparato per me */
export const myPlans = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const rows = await sql<PlanRaw>`select * from coach_plans where athlete_user_id = ${context.userId} order by (status = 'attiva') desc, updated_at desc limit 40`;
    const { names } = await nameMap(sql, [...new Set([context.userId, ...rows.map((r) => r.coach_user_id)])]);
    return rows.map((r) => planOf(r, names, asNum(me.id), context.userId));
  });

/** l'allievo spunta un esercizio fatto, o lascia una nota all'allenatore */
export const tickPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    return { id: asNum(r.id), index: r.index == null ? null : asNum(r.index), done: r.done === true, note: r.note == null ? null : String(r.note).trim().slice(0, 600) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const rows = await sql<{ id: number; athlete_user_id: string; coach_user_id: string; items: unknown; done: unknown; title: string }>`select id, athlete_user_id, coach_user_id, items, done, title from coach_plans where id = ${data.id} limit 1`;
    const p = rows[0];
    if (!p || p.athlete_user_id !== context.userId) throw new Error("Scheda non trovata.");
    if (data.index != null) {
      const n = asJson<PlanItem[]>(p.items, []).length;
      if (data.index < 0 || data.index >= n) throw new Error("Esercizio non trovato.");
      const set = new Set(asJson<number[]>(p.done, []));
      if (data.done) set.add(data.index);
      else set.delete(data.index);
      const done = [...set].sort((a, b) => a - b);
      await sql`update coach_plans set done = ${JSON.stringify(done)}::jsonb, updated_at = now() where id = ${p.id}`;
      // quando l'allievo finisce tutta la scheda, l'allenatore lo sa
      if (data.done && done.length === n) {
        try {
          await sql`
            insert into notifications (user_id, title, body, href, dedupe)
            values (${p.coach_user_id}, ${"Scheda completata"}, ${`Un allievo ha completato «${p.title}».`}, ${"/istruttore"}, ${`plan-done-${p.id}-${n}`})
            on conflict (dedupe) do nothing`;
        } catch {
          /* niente */
        }
      }
    }
    if (data.note != null) await sql`update coach_plans set athlete_note = ${data.note}, updated_at = now() where id = ${p.id}`;
    return { ok: true as const };
  });
