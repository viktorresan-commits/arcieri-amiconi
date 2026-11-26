/**
 * Cartellini di gara letti dalla foto: le piazzole di un arciere del gruppo (anche di chi non usa l'app),
 * salvate per la gara. Servono a vedere con chi si era in piazzola e i suoi punti, piazzola per piazzola.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asNum, canScore, clip, db, ensureMember } from "./access";
import { nameKey } from "./fitast-rank";

export type CardLane = { p: number; arrows: number[] };

export const saveScorecard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    const lanes = (Array.isArray(r.lanes) ? r.lanes.slice(0, 40) : []).map((x) => {
      const o = (x ?? {}) as { p?: unknown; arrows?: unknown };
      const p = asNum(o.p);
      const arrows = (Array.isArray(o.arrows) ? o.arrows.slice(0, 3) : []).map((v) => asNum(v));
      if (!Number.isInteger(p) || p < 1 || p > 40 || arrows.some((v) => ![0, 5, 8, 10, 11].includes(v))) throw new Error("Piazzola non valida.");
      return { p, arrows };
    });
    const name = clip(r.name, 90).trim();
    if (!name || !lanes.length) throw new Error("Mancano il nome o le piazzole.");
    return { competitionId: asNum(r.competitionId), piazzola: Math.max(0, Math.min(40, asNum(r.piazzola))), name, self: Boolean(r.self), lanes };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    if (!(data.competitionId > 0)) throw new Error("Scegli la gara.");
    const total = data.lanes.reduce((s, l) => s + l.arrows.reduce((a, b) => a + b, 0), 0);
    const spots = data.lanes.reduce((s, l) => s + l.arrows.filter((v) => v === 8 || v === 10 || v === 11).length, 0);
    const key = nameKey(data.name);
    await sql`
      insert into gara_cartellini (competition_id, piazzola, name, name_key, user_id, lanes, total, spots, updated_by, updated_at)
      values (${data.competitionId}, ${data.piazzola}, ${data.name}, ${key}, ${data.self ? context.userId : null}, ${JSON.stringify(data.lanes)}::jsonb, ${total}, ${spots}, ${context.userId}, now())
      on conflict (competition_id, name_key) do update set
        piazzola = excluded.piazzola, name = excluded.name, user_id = coalesce(excluded.user_id, gara_cartellini.user_id),
        lanes = excluded.lanes, total = excluded.total, spots = excluded.spots, updated_by = excluded.updated_by, updated_at = now()`;
    return { ok: true, total, spots };
  });

/**
 * Compagni di piazzola scelti a mano dalla classifica della gara (quando il portale non dà l'elenco
 * delle piazzole e il cartellino non c'è): una riga senza punti, che non tocca i cartellini letti.
 */
export const savePiazzolaMates = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    const names = (Array.isArray(r.names) ? r.names.slice(0, 8) : []).map((x) => clip(x, 90).trim()).filter((x) => x.length >= 3);
    const piazzola = asNum(r.piazzola);
    if (!Number.isInteger(piazzola) || piazzola < 1 || piazzola > 40) throw new Error("Scrivi il numero della piazzola.");
    if (!names.length) throw new Error("Scegli almeno un nome.");
    return { competitionId: asNum(r.competitionId), piazzola, names };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    if (!(data.competitionId > 0)) throw new Error("Scegli la gara.");
    // la propria riga, se non c'è ancora un cartellino tuo: dice in che piazzola eri
    const own = await sql<{ id: number }>`select id from gara_cartellini where competition_id = ${data.competitionId} and user_id = ${context.userId} limit 1`;
    if (!own[0]) {
      const self = [me.family_name, me.given_name].filter(Boolean).join(" ").trim() || me.nickname || "Io";
      await sql`
        insert into gara_cartellini (competition_id, piazzola, name, name_key, user_id, lanes, total, spots, updated_by, updated_at)
        values (${data.competitionId}, ${data.piazzola}, ${self}, ${nameKey(self)}, ${context.userId}, '[]'::jsonb, null, null, ${context.userId}, now())
        on conflict (competition_id, name_key) do update set user_id = coalesce(gara_cartellini.user_id, excluded.user_id), piazzola = excluded.piazzola, updated_at = now()`;
    } else {
      await sql`update gara_cartellini set piazzola = ${data.piazzola}, updated_at = now() where id = ${own[0].id} and piazzola = 0`;
    }
    for (const name of data.names) {
      await sql`
        insert into gara_cartellini (competition_id, piazzola, name, name_key, user_id, lanes, total, spots, updated_by, updated_at)
        values (${data.competitionId}, ${data.piazzola}, ${name}, ${nameKey(name)}, null, '[]'::jsonb, null, null, ${context.userId}, now())
        on conflict (competition_id, name_key) do update set piazzola = excluded.piazzola, updated_by = excluded.updated_by, updated_at = now()`;
    }
    return { ok: true as const, added: data.names.length };
  });

/** toglie un compagno messo a mano (solo le righe senza piazzole segnate: i cartellini letti restano) */
export const removePiazzolaMate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    return { competitionId: asNum(r.competitionId), name: clip(r.name, 90).trim() };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    await sql`delete from gara_cartellini where competition_id = ${data.competitionId} and name_key = ${nameKey(data.name)} and jsonb_array_length(lanes) = 0`;
    return { ok: true as const };
  });
