/**
 * Cartellini di gara letti dalla foto: le piazzole di un arciere del gruppo (anche di chi non usa l'app),
 * salvate per la gara. Servono a vedere con chi si era in piazzola e i suoi punti, piazzola per piazzola.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asNum, canScore, clip, db, ensureMember } from "./access";
import { nameKey } from "./fitast-rank";
import { peopleOf, pzTablesFor, type GaraTable } from "./fitast-ours";
import { titleName } from "./fitast-league";
import type { Sql } from "@/lib/db";

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
 * L'elenco delle piazzole del portale per una gara dell'app (nome, compagnia, piazzola), se è già stato letto.
 * `names`: fra più gare dello stesso giorno, quella in cui c'è almeno uno di questi nomi.
 */
async function portalLanesOf(sql: Sql, competitionId: number, names: string[] = []) {
  const comp = (await sql<{ notes: string; starts_on: string }>`select notes, starts_on::text as starts_on from competitions where id = ${competitionId} limit 1`)[0];
  if (!comp) return [];
  const garaId = /^fitast:(\d+)/.exec(comp.notes ?? "")?.[1] ?? "";
  const tables = await sql<GaraTable>`
    select gara_id, gara_title, held_on::text as held_on, season, category, rows from fitast_standings
    where kind = 'gara-piazzole' and gara_id <> ''`.catch(() => [] as GaraTable[]);
  const keys = names.map((n) => new Set(nameKey(n).split(" ").filter(Boolean)));
  const named = (key: string) => keys.some((ws) => key.split(" ").length >= 2 && key.split(" ").every((w) => ws.has(w)));
  const list = pzTablesFor(tables, garaId, String(comp.starts_on ?? "").slice(0, 10), (l) => peopleOf(l).some((p) => named(p.key)));
  return peopleOf(list)
    .map((p) => ({ name: titleName(p.name), team: titleName(p.team), key: p.key, piazzola: Number(p.entries[0]?.place ?? 0) }))
    .filter((p) => p.piazzola > 0);
}

/** chi era in quale piazzola, dal portale: per scegliere un compagno e mettersi nella sua piazzola */
export const garaPiazzole = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ competitionId: asNum((input as { competitionId?: unknown } | null)?.competitionId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    if (!(data.competitionId > 0)) return { lanes: [] };
    return { lanes: await portalLanesOf(sql, data.competitionId) };
  });

/**
 * Compagni di piazzola scelti a mano (quando nell'elenco del portale non ci sei, per esempio da ospite, o
 * l'elenco non c'è): una riga senza punti, che non tocca i cartellini letti. Se il compagno scelto è
 * nell'elenco delle piazzole del portale, ti metto nella sua piazzola anche senza scriverla.
 */
export const savePiazzolaMates = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    const names = (Array.isArray(r.names) ? r.names.slice(0, 8) : []).map((x) => clip(x, 90).trim()).filter((x) => x.length >= 3);
    const piazzola = asNum(r.piazzola);
    if (!names.length) throw new Error("Scegli almeno un nome.");
    return { competitionId: asNum(r.competitionId), piazzola: Number.isInteger(piazzola) && piazzola >= 1 && piazzola <= 40 ? piazzola : 0, names };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Profilo in sola lettura.");
    if (!(data.competitionId > 0)) throw new Error("Scegli la gara.");
    // la piazzola del compagno dal portale vale più di quella scritta: ci si mette nel suo gruppo
    const lanes = await portalLanesOf(sql, data.competitionId, data.names);
    // stesso nome, oppure un nome scritto a mano che contiene nome e cognome dell'elenco («Mauro Maramonti istruttore»)
    const laneFor = (n: string) => {
      const k = nameKey(n);
      const words = new Set(k.split(" "));
      return lanes.find((p) => p.key === k) ?? lanes.find((p) => p.key.split(" ").length >= 2 && p.key.split(" ").every((w) => words.has(w))) ?? null;
    };
    const found = data.names.map(laneFor).find((p) => p != null) ?? null;
    const piazzola = found?.piazzola || data.piazzola;
    if (!piazzola) throw new Error("Questo compagno non è nell'elenco delle piazzole: scrivi tu il numero della piazzola.");
    // la propria riga: dice in che piazzola eri (un cartellino letto dalla foto, con le sue piazzole, resta com'è)
    const own = await sql<{ id: number; n: number }>`select id, jsonb_array_length(lanes)::int as n from gara_cartellini where competition_id = ${data.competitionId} and user_id = ${context.userId} limit 1`;
    if (!own[0]) {
      const self = [me.family_name, me.given_name].filter(Boolean).join(" ").trim() || me.nickname || "Io";
      await sql`
        insert into gara_cartellini (competition_id, piazzola, name, name_key, user_id, lanes, total, spots, updated_by, updated_at)
        values (${data.competitionId}, ${piazzola}, ${self}, ${nameKey(self)}, ${context.userId}, '[]'::jsonb, null, null, ${context.userId}, now())
        on conflict (competition_id, name_key) do update set user_id = coalesce(gara_cartellini.user_id, excluded.user_id), piazzola = excluded.piazzola, updated_at = now()`;
    } else if (!(Number(own[0].n) > 0)) {
      await sql`update gara_cartellini set piazzola = ${piazzola}, updated_at = now() where id = ${own[0].id}`;
    }
    for (const name of data.names) {
      await sql`
        insert into gara_cartellini (competition_id, piazzola, name, name_key, user_id, lanes, total, spots, updated_by, updated_at)
        values (${data.competitionId}, ${piazzola}, ${name}, ${nameKey(name)}, null, '[]'::jsonb, null, null, ${context.userId}, now())
        on conflict (competition_id, name_key) do update set piazzola = excluded.piazzola, updated_by = excluded.updated_by, updated_at = now()`;
    }
    const group = lanes.filter((p) => p.piazzola === piazzola).length;
    return { ok: true as const, added: data.names.length, piazzola, fromPortal: Boolean(found), group };
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
