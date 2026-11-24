import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asBool, asNum, db, ensureMember, staffLevel, type MemberRow } from "./access";
import { myMembership } from "./compagnie.api";

type Sql = Awaited<ReturnType<typeof db>>;
const HOURS = 3;

export type Acting = { memberId: number; name: string; until: string } | null;

type Target = { id: number; user_id: string | null; given_name: string; family_name: string; nickname: string };

function nameOf(t: Pick<Target, "given_name" | "family_name" | "nickname">) {
  return [t.given_name, t.family_name].filter(Boolean).join(" ").trim() || t.nickname || "Allievo";
}

/** il fondatore può inserire per tutti; presidente e allenatori solo per la loro compagnia */
async function allowed(sql: Sql, me: MemberRow, userId: string, target: Target) {
  if (staffLevel(me)) return true;
  if (!target.user_id || target.user_id === userId) return false;
  const mine = await myMembership(sql, userId);
  if (mine.role !== "owner" && !asBool(me.coach)) return false;
  const theirs = await myMembership(sql, target.user_id);
  return theirs.companyId === mine.companyId;
}

async function loadTarget(sql: Sql, memberId: number) {
  const rows = await sql<Target>`select id, user_id, given_name, family_name, nickname from members where id = ${memberId} limit 1`;
  return rows[0] ?? null;
}

/**
 * Chi riceve i dati che si stanno salvando: l'allievo se è attivo «Inserisci per», altrimenti chi salva.
 * Il permesso viene ricontrollato a ogni salvataggio.
 */
export async function writerFor(sql: Sql, userId: string, me: MemberRow) {
  try {
    const rows = await sql<{ target_member_id: number }>`select target_member_id from acting_as where user_id = ${userId} and until > now() limit 1`;
    const id = asNum(rows[0]?.target_member_id);
    if (id && id !== asNum(me.id)) {
      const target = await loadTarget(sql, id);
      if (target && (await allowed(sql, me, userId, target))) {
        return { userId: target.user_id, memberId: asNum(target.id), by: userId, name: nameOf(target) };
      }
    }
  } catch {
    /* tabella non ancora creata */
  }
  return { userId: userId as string | null, memberId: asNum(me.id), by: null as string | null, name: "" };
}

/** come writerFor, ma per dati che richiedono un account (allenamenti e gare) */
export async function accountWriter(sql: Sql, userId: string, me: MemberRow) {
  const w = await writerFor(sql, userId, me);
  if (!w.userId) throw new Error(`${w.name} non ha ancora un account: puoi aggiungere solo l'analisi del gesto.`);
  return { ...w, userId: w.userId };
}

export async function actingOf(sql: Sql, userId: string): Promise<Acting> {
  try {
    const rows = await sql<{ target_member_id: number; until: Date }>`select target_member_id, until from acting_as where user_id = ${userId} and until > now() limit 1`;
    if (!rows[0]) return null;
    const target = await loadTarget(sql, asNum(rows[0].target_member_id));
    if (!target) return null;
    return { memberId: asNum(target.id), name: nameOf(target), until: new Date(rows[0].until).toISOString() };
  } catch {
    return null;
  }
}

export const startActing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const memberId = asNum((input as { memberId?: number })?.memberId);
    if (!memberId) throw new Error("Allievo non trovato.");
    return { memberId };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const target = await loadTarget(sql, data.memberId);
    if (!target) throw new Error("Allievo non trovato.");
    if (asNum(target.id) === asNum(me.id)) throw new Error("Per te stesso non serve: salva normalmente.");
    if (!(await allowed(sql, me, context.userId, target))) {
      throw new Error("Puoi inserire dati solo per gli allievi della tua compagnia; il fondatore per tutti.");
    }
    await sql`
      insert into acting_as (user_id, target_member_id, until)
      values (${context.userId}, ${data.memberId}, now() + make_interval(hours => ${HOURS}))
      on conflict (user_id) do update set target_member_id = excluded.target_member_id, until = excluded.until`;
    return { memberId: asNum(target.id), name: nameOf(target), hasAccount: Boolean(target.user_id) };
  });

export const stopActing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    try {
      await sql`delete from acting_as where user_id = ${context.userId}`;
    } catch {
      /* tabella non ancora creata */
    }
    return { ok: true as const };
  });
