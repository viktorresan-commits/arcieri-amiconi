/**
 * Le proprie scadenze: tessera della compagnia, tessera FITAST e certificato medico. Ognuno vede solo le sue, dal profilo,
 * e può scriverle se la segreteria non l'ha ancora fatto; la segreteria della compagnia vede le stesse date.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { db, ensureMember } from "./access";
import { myMembership } from "./compagnie.api";
import { deadlinesOf } from "./scadenze";

function dateOrEmpty(value: unknown) {
  if (value == null) return undefined;
  const s = String(value);
  if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Data non valida.");
  return s;
}

export const myDeadlines = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const d = await deadlinesOf(sql, context.userId);
    return { card: d.card, fitast: d.fitast, cert: d.cert };
  });

export const setMyDeadlines = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { cardUntil?: unknown; fitastUntil?: unknown; certUntil?: unknown; certKind?: unknown };
    return {
      cardUntil: dateOrEmpty(raw.cardUntil),
      fitastUntil: dateOrEmpty(raw.fitastUntil),
      certUntil: dateOrEmpty(raw.certUntil),
      certKind: raw.certKind === "non agonistico" ? "non agonistico" : "agonistico",
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const { companyId } = await myMembership(sql, context.userId);
    if (data.certUntil !== undefined) {
      await sql`
        insert into company_certs (company_id, user_id, valid_until, kind, updated_at)
        values (${companyId}, ${context.userId}, ${data.certUntil || null}, ${data.certKind}, now())
        on conflict (company_id, user_id) do update set valid_until = excluded.valid_until, kind = excluded.kind, updated_at = now()`;
    }
    if (data.fitastUntil !== undefined) {
      await sql`
        insert into company_fitast_cards (company_id, user_id, valid_until, updated_at)
        values (${companyId}, ${context.userId}, ${data.fitastUntil || null}, now())
        on conflict (company_id, user_id) do update set valid_until = excluded.valid_until, updated_at = now()`;
    }
    if (data.cardUntil !== undefined) {
      if (data.cardUntil) {
        // la tessera vale per la stagione dell'anno in cui scade; la quota pagata o no resta com'è
        const season = Number(data.cardUntil.slice(0, 4));
        await sql`
          insert into company_dues (company_id, user_id, season, card_until, updated_at)
          values (${companyId}, ${context.userId}, ${season}, ${data.cardUntil}, now())
          on conflict (company_id, user_id, season) do update set card_until = excluded.card_until, updated_at = now()`;
      } else {
        await sql`update company_dues set card_until = null, updated_at = now() where company_id = ${companyId} and user_id = ${context.userId}`;
      }
    }
    return { ok: true as const };
  });
