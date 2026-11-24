/**
 * Segreteria della compagnia: quote dell'anno, certificati medici (solo scadenza e tipo),
 * presenze ai corsi. La vedono e la cambiano solo lo staff e il presidente della compagnia.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { asBool, asNum, clip, db, ensureMember, staffLevel, type MemberRow } from "./access";
import { homeId, myMembership } from "./compagnie.api";

const DAY = 86_400_000;

function dayOf(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const m = String(value ?? "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "";
}

/** la stagione che si sta pagando: da novembre si raccolgono le quote dell'anno dopo */
export function currentSeason(now = new Date()) {
  return now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear();
}

/** chi apre la segreteria e di quale compagnia: lo staff le vede tutte, il presidente solo la sua */
async function access(sql: Sql, me: MemberRow, userId: string, wanted: number) {
  const staff = staffLevel(me);
  const mine = await myMembership(sql, userId);
  if (!staff && mine.role !== "owner" && !asBool(me.coach)) throw new Error("La segreteria è per il presidente, gli allenatori e lo staff della compagnia.");
  return { companyId: staff && wanted ? wanted : mine.companyId, staff: staff != null };
}

async function peopleOf(sql: Sql, companyId: number) {
  const home = await homeId(sql);
  const rows = await sql<{ id: number; user_id: string; given_name: string; family_name: string; nickname: string; photo_url: string | null; avatar_color: string; company_id: number | null }>`
    select m.id, m.user_id, m.given_name, m.family_name, m.nickname, m.photo_url, m.avatar_color, cm.company_id
    from members m left join company_members cm on cm.user_id = m.user_id
    where m.user_id is not null`;
  return rows
    .filter((r) => (r.company_id == null ? home : asNum(r.company_id)) === companyId)
    .map((r) => ({
      userId: r.user_id,
      memberId: asNum(r.id),
      name: [r.given_name, r.family_name].filter(Boolean).join(" ") || r.nickname || "Arciere",
      photoUrl: r.photo_url && r.photo_url.length < 200_000 ? r.photo_url : null,
      color: r.avatar_color || "#1f5c38",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function checkPerson(sql: Sql, companyId: number, userId: string) {
  const people = await peopleOf(sql, companyId);
  if (!people.some((p) => p.userId === userId)) throw new Error("Questa persona non è nella compagnia.");
}

export const secretaryBoard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { companyId?: unknown; season?: unknown };
    const season = asNum(raw.season);
    return { companyId: asNum(raw.companyId), season: season >= 2000 && season <= 2100 ? season : currentSeason() };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const { companyId, staff } = await access(sql, me, context.userId, data.companyId);
    const company = await sql<{ id: number; name: string; color: string }>`select id, name, color from companies where id = ${companyId} limit 1`;
    if (!company[0]) throw new Error("Compagnia non trovata.");
    const companies = staff ? await sql<{ id: number; name: string }>`select id, name from companies order by name` : [];
    const people = await peopleOf(sql, companyId);
    const dues = await sql<{ user_id: string; paid: boolean; paid_on: unknown; amount_cents: number | null; note: string }>`
      select user_id, paid, paid_on, amount_cents, note from company_dues where company_id = ${companyId} and season = ${data.season}`;
    const certs = await sql<{ user_id: string; valid_until: unknown; kind: string }>`select user_id, valid_until, kind from company_certs where company_id = ${companyId}`;
    const days = await sql<{ id: number; day: unknown; title: string }>`select id, day, title from course_days where company_id = ${companyId} order by day desc, id desc limit 40`;
    const presence = await sql<{ day_id: number; user_id: string }>`
      select p.day_id, p.user_id from course_presence p join course_days d on d.id = p.day_id where d.company_id = ${companyId}`;
    const dueOf = new Map(dues.map((d) => [d.user_id, d]));
    const certOf = new Map(certs.map((c) => [c.user_id, c]));
    const presentBy = new Map<number, string[]>();
    for (const p of presence) presentBy.set(asNum(p.day_id), [...(presentBy.get(asNum(p.day_id)) ?? []), p.user_id]);
    const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
    const rows = people.map((p) => {
      const d = dueOf.get(p.userId);
      const c = certOf.get(p.userId);
      const until = c ? dayOf(c.valid_until) : "";
      const daysLeft = until ? Math.round((new Date(until).getTime() - today) / DAY) : null;
      const attended = days.filter((x) => (presentBy.get(asNum(x.id)) ?? []).includes(p.userId)).length;
      return {
        ...p,
        paid: Boolean(d?.paid),
        paidOn: d ? dayOf(d.paid_on) : "",
        amount: d?.amount_cents != null ? asNum(d.amount_cents) / 100 : null,
        certUntil: until,
        certKind: c?.kind ?? "agonistico",
        certDays: daysLeft,
        attended,
      };
    });
    const recent = days.slice(0, 10);
    const attendance = recent.length && people.length
      ? Math.round((recent.reduce((a, x) => a + (presentBy.get(asNum(x.id)) ?? []).filter((u) => people.some((p) => p.userId === u)).length, 0) / (recent.length * people.length)) * 100)
      : null;
    return {
      company: { id: asNum(company[0].id), name: company[0].name, color: company[0].color },
      companies: companies.map((c) => ({ id: asNum(c.id), name: c.name })),
      season: data.season,
      people: rows,
      days: days.map((x) => ({ id: asNum(x.id), day: dayOf(x.day), title: x.title, present: presentBy.get(asNum(x.id)) ?? [] })),
      stats: {
        members: rows.length,
        paid: rows.filter((r) => r.paid).length,
        certAlert: rows.filter((r) => r.certDays == null || r.certDays <= 30).length,
        attendance,
      },
    };
  });

export const setDue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { companyId?: unknown; userId?: unknown; season?: unknown; paid?: unknown; amount?: unknown };
    const amount = raw.amount == null || raw.amount === "" ? null : Math.round(Number(String(raw.amount).replace(",", ".")) * 100);
    if (amount != null && (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000)) throw new Error("Importo non valido.");
    return { companyId: asNum(raw.companyId), userId: clip(raw.userId, 80), season: asNum(raw.season) || currentSeason(), paid: Boolean(raw.paid), amount };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const { companyId } = await access(sql, me, context.userId, data.companyId);
    await checkPerson(sql, companyId, data.userId);
    await sql`
      insert into company_dues (company_id, user_id, season, paid, paid_on, amount_cents, updated_at)
      values (${companyId}, ${data.userId}, ${data.season}, ${data.paid}, ${data.paid ? new Date().toISOString().slice(0, 10) : null}, ${data.amount}, now())
      on conflict (company_id, user_id, season) do update set
        paid = excluded.paid,
        paid_on = case when excluded.paid and company_dues.paid then company_dues.paid_on else excluded.paid_on end,
        amount_cents = coalesce(excluded.amount_cents, company_dues.amount_cents),
        updated_at = now()`;
    return { ok: true as const };
  });

export const setCert = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { companyId?: unknown; userId?: unknown; validUntil?: unknown; kind?: unknown };
    const until = String(raw.validUntil ?? "");
    if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error("Data non valida.");
    const kind = raw.kind === "non agonistico" ? "non agonistico" : "agonistico";
    return { companyId: asNum(raw.companyId), userId: clip(raw.userId, 80), validUntil: until || null, kind };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const { companyId } = await access(sql, me, context.userId, data.companyId);
    await checkPerson(sql, companyId, data.userId);
    await sql`
      insert into company_certs (company_id, user_id, valid_until, kind, updated_at)
      values (${companyId}, ${data.userId}, ${data.validUntil}, ${data.kind}, now())
      on conflict (company_id, user_id) do update set valid_until = excluded.valid_until, kind = excluded.kind, updated_at = now()`;
    return { ok: true as const };
  });

export const addCourseDay = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { companyId?: unknown; day?: unknown; title?: unknown };
    const day = String(raw.day ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Scegli il giorno.");
    return { companyId: asNum(raw.companyId), day, title: clip(raw.title, 60) || "Corso" };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const { companyId } = await access(sql, me, context.userId, data.companyId);
    const made = await sql<{ id: number }>`
      insert into course_days (company_id, day, title, created_by) values (${companyId}, ${data.day}, ${data.title}, ${context.userId}) returning id`;
    return { id: asNum(made[0]?.id) };
  });

export const deleteCourseDay = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ companyId: asNum((input as { companyId?: unknown })?.companyId), id: asNum((input as { id?: unknown })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const { companyId } = await access(sql, me, context.userId, data.companyId);
    await sql`delete from course_days where id = ${data.id} and company_id = ${companyId}`;
    return { ok: true as const };
  });

export const setPresence = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { companyId?: unknown; dayId?: unknown; userId?: unknown; present?: unknown };
    return { companyId: asNum(raw.companyId), dayId: asNum(raw.dayId), userId: clip(raw.userId, 80), present: Boolean(raw.present) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const { companyId } = await access(sql, me, context.userId, data.companyId);
    const day = await sql`select 1 from course_days where id = ${data.dayId} and company_id = ${companyId} limit 1`;
    if (!day[0]) throw new Error("Giornata non trovata.");
    await checkPerson(sql, companyId, data.userId);
    if (data.present) await sql`insert into course_presence (day_id, user_id) values (${data.dayId}, ${data.userId}) on conflict do nothing`;
    else await sql`delete from course_presence where day_id = ${data.dayId} and user_id = ${data.userId}`;
    return { ok: true as const };
  });
