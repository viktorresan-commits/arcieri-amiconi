import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asBool, asNum, db, ensureMember, staffLevel } from "./access";
import { myMembership } from "./compagnie.api";
import { cleanProgram, type ExProgram } from "./exercise-catalog";

/**
 * Programmi di esercizi: li fanno il fondatore (per tutti), il presidente e gli allenatori
 * (per la loro compagnia). L'allievo li ritrova nelle sue schede e li scarica in PDF.
 */

export type ProgramRow = {
  id: number;
  athleteMemberId: number | null;
  athleteName: string;
  coachName: string;
  mine: boolean;
  level: number;
  program: ExProgram;
  updatedAt: string;
};

type Raw = { id: number; company_id: number | null; coach_user_id: string; athlete_member_id: number | null; athlete_name: string; level: number; data: unknown; updated_at: unknown };
type Sql = Awaited<ReturnType<typeof db>>;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? ""));

async function coachOf(sql: Sql, userId: string) {
  const me = await ensureMember(sql, userId);
  const staff = staffLevel(me) != null;
  const mine = await myMembership(sql, userId);
  if (!staff && mine.role !== "owner" && !asBool(me.coach)) throw new Error("I programmi di esercizi li fanno gli allenatori e il presidente della compagnia.");
  return { me, staff, mine };
}

async function coachNames(sql: Sql, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await sql<{ user_id: string; given_name: string; family_name: string; nickname: string }>`
    select user_id, given_name, family_name, nickname from members where user_id = any(string_to_array(${ids.join(",")}, ','))`;
  return new Map(rows.map((r) => [r.user_id, [r.given_name, r.family_name].filter(Boolean).join(" ") || r.nickname || "Allenatore"]));
}

function rowOf(r: Raw, names: Map<string, string>, viewer: string): ProgramRow {
  const program = cleanProgram(typeof r.data === "string" ? JSON.parse(r.data) : r.data);
  return {
    id: asNum(r.id),
    athleteMemberId: r.athlete_member_id == null ? null : asNum(r.athlete_member_id),
    athleteName: r.athlete_name || program.header.athlete || "Allievo",
    coachName: names.get(r.coach_user_id) ?? "Allenatore",
    mine: r.coach_user_id === viewer,
    level: asNum(r.level) || program.level,
    program,
    updatedAt: iso(r.updated_at),
  };
}

/** i programmi della compagnia (il fondatore sceglie la compagnia) */
export const listPrograms = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ companyId: asNum((input as { companyId?: unknown })?.companyId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { staff, mine } = await coachOf(sql, context.userId);
    const companyId = staff && data.companyId ? data.companyId : mine.companyId;
    const rows = await sql<Raw>`select * from exercise_programs where company_id = ${companyId} order by updated_at desc limit 200`;
    const names = await coachNames(sql, [...new Set(rows.map((r) => r.coach_user_id))]);
    return rows.map((r) => rowOf(r, names, context.userId));
  });

/** crea o modifica un programma; l'allievo può essere dell'app (memberId) o solo un nome */
export const saveProgram = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as { id?: unknown; companyId?: unknown; athleteMemberId?: unknown; program?: unknown };
    const program = cleanProgram(r.program);
    if (!program.sections.length) throw new Error("Aggiungi almeno un esercizio.");
    if (JSON.stringify(program).length > 60_000) throw new Error("Programma troppo lungo.");
    return { id: asNum(r.id), companyId: asNum(r.companyId), athleteMemberId: asNum(r.athleteMemberId) || null, program };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { staff, mine } = await coachOf(sql, context.userId);
    const companyId = staff && data.companyId ? data.companyId : mine.companyId;
    let athleteName = data.program.header.athlete.trim();
    if (data.athleteMemberId) {
      const t = await sql<{ id: number; user_id: string | null; given_name: string; family_name: string; nickname: string }>`
        select id, user_id, given_name, family_name, nickname from members where id = ${data.athleteMemberId} limit 1`;
      if (!t[0]) throw new Error("Allievo non trovato.");
      if (!staff && t[0].user_id) {
        const theirs = await myMembership(sql, t[0].user_id);
        if (theirs.companyId !== mine.companyId) throw new Error("Puoi fare programmi solo per gli allievi della tua compagnia.");
      }
      athleteName = athleteName || [t[0].given_name, t[0].family_name].filter(Boolean).join(" ") || t[0].nickname;
    }
    if (!athleteName && !data.athleteMemberId) throw new Error("Scrivi il nome dell'allievo o sceglilo dall'elenco.");
    const json = JSON.stringify(data.program);
    if (data.id) {
      const prev = await sql<{ coach_user_id: string; company_id: number | null }>`select coach_user_id, company_id from exercise_programs where id = ${data.id} limit 1`;
      if (!prev[0]) throw new Error("Programma non trovato.");
      if (!staff && prev[0].coach_user_id !== context.userId && !(mine.role === "owner" && asNum(prev[0].company_id) === mine.companyId)) throw new Error("Può modificarlo solo chi l'ha fatto o il presidente.");
      await sql`update exercise_programs set athlete_member_id = ${data.athleteMemberId}, athlete_name = ${athleteName}, level = ${data.program.level}, data = ${json}::jsonb, updated_at = now() where id = ${data.id}`;
      return { id: data.id };
    }
    const ins = await sql<{ id: number }>`
      insert into exercise_programs (company_id, coach_user_id, athlete_member_id, athlete_name, level, data)
      values (${companyId}, ${context.userId}, ${data.athleteMemberId}, ${athleteName}, ${data.program.level}, ${json}::jsonb) returning id`;
    return { id: asNum(ins[0].id) };
  });

export const deleteProgram = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: unknown })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { staff, mine } = await coachOf(sql, context.userId);
    const prev = await sql<{ coach_user_id: string; company_id: number | null }>`select coach_user_id, company_id from exercise_programs where id = ${data.id} limit 1`;
    if (!prev[0]) return { ok: true as const };
    if (!staff && prev[0].coach_user_id !== context.userId && !(mine.role === "owner" && asNum(prev[0].company_id) === mine.companyId)) throw new Error("Può eliminarlo solo chi l'ha fatto o il presidente.");
    await sql`delete from exercise_programs where id = ${data.id}`;
    return { ok: true as const };
  });

/** i programmi che gli allenatori hanno fatto per me */
export const myPrograms = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    try {
      const rows = await sql<Raw>`select * from exercise_programs where athlete_member_id = ${me.id} order by updated_at desc limit 50`;
      const names = await coachNames(sql, [...new Set(rows.map((r) => r.coach_user_id))]);
      return rows.map((r) => rowOf(r, names, context.userId));
    } catch {
      return [] as ProgramRow[];
    }
  });
