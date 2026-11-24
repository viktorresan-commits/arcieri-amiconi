import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asIso, asNum, db, ensureMember, staffLevel } from "./access";

type Sql = Awaited<ReturnType<typeof db>>;

/**
 * Gestione dei dati di un profilo, solo per il fondatore: elenco di quello che la persona ha inserito e
 * cancellazione voce per voce. Non arriva nessun avviso alla persona; ogni apertura e ogni cancellazione
 * restano nel registro del server. Messaggi privati, accesso e password non sono toccati da qui.
 */
export const KINDS = ["allenamento", "gara", "gesto", "attrezzo", "assetto", "obiettivo", "acquisto", "gioco"] as const;
export type ManageKind = (typeof KINDS)[number];

async function founder(sql: Sql, userId: string) {
  const me = await ensureMember(sql, userId);
  if (staffLevel(me) !== "super") throw new Error("Solo il fondatore può gestire i profili degli altri.");
  return me;
}

async function target(sql: Sql, memberId: number) {
  const rows = await sql<{ id: number; user_id: string | null; given_name: string; family_name: string; nickname: string; is_super: boolean }>`
    select id, user_id, given_name, family_name, nickname, is_super from members where id = ${memberId} limit 1`;
  if (!rows[0]) throw new Error("Profilo non trovato.");
  return rows[0];
}

async function log(sql: Sql, by: string, memberId: number, action: string, detail = "") {
  try {
    await sql`insert into founder_access_log (by_user, member_id, action, detail) values (${by}, ${memberId}, ${action}, ${detail})`;
  } catch {
    /* tabella non ancora creata */
  }
}

/** una query che può fallire se la tabella non c'è ancora: elenco vuoto */
async function safe<T>(q: Promise<T[]>): Promise<T[]> {
  try {
    return await q;
  } catch {
    return [];
  }
}

export type ManageItem = { kind: ManageKind; id: string; title: string; sub: string; at: string | null };

export const manageProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ memberId: asNum((input as { memberId?: number })?.memberId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await founder(sql, context.userId);
    const t = await target(sql, data.memberId);
    await log(sql, context.userId, asNum(t.id), "apre");
    const uid = t.user_id ?? "";
    const items: ManageItem[] = [];
    if (uid) {
      for (const r of await safe(sql<{ id: number; started_at: unknown; place: string; distance_m: number; n: number; total: number }>`
        select s.id, s.started_at, s.place, s.distance_m, count(x.id)::int as n, coalesce(sum(x.score), 0)::int as total
        from sessions s left join shots x on x.session_id = s.id
        where s.user_id = ${uid} group by s.id order by s.started_at desc limit 400`))
        items.push({ kind: "allenamento", id: String(r.id), title: `${asNum(r.distance_m)} m${r.place ? ` · ${r.place}` : ""}`, sub: `${r.n} frecce · ${r.total} punti`, at: asIso(r.started_at) });
      for (const r of await safe(sql<{ id: number; name: string; starts_on: unknown; score: number | null; category: string }>`
        select e.id, c.name, c.starts_on, e.score, e.category from competition_entries e join competitions c on c.id = e.competition_id
        where e.user_id = ${uid} order by c.starts_on desc limit 200`))
        items.push({ kind: "gara", id: String(r.id), title: r.name, sub: [r.score != null ? `${r.score} punti` : "senza punteggio", r.category].filter(Boolean).join(" · "), at: asIso(r.starts_on) });
      for (const r of await safe(sql<{ id: number; name: string; category: string; created_at: unknown }>`
        select id, name, category, created_at from equipment where user_id = ${uid} order by created_at desc limit 200`))
        items.push({ kind: "attrezzo", id: String(r.id), title: r.name || "Attrezzo", sub: r.category, at: asIso(r.created_at) });
      for (const r of await safe(sql<{ id: number; name: string; created_at: unknown }>`
        select id, name, created_at from setups where user_id = ${uid} order by created_at desc limit 100`))
        items.push({ kind: "assetto", id: String(r.id), title: r.name || "Assetto", sub: "", at: asIso(r.created_at) });
      for (const r of await safe(sql<{ id: number; title: string; target: number; created_at: unknown }>`
        select id, title, target, created_at from goals where user_id = ${uid} order by created_at desc limit 100`))
        items.push({ kind: "obiettivo", id: String(r.id), title: r.title || "Obiettivo", sub: r.target != null ? `traguardo ${r.target}` : "", at: asIso(r.created_at) });
      for (const r of await safe(sql<{ id: number; name: string; status: string; created_at: unknown }>`
        select id, name, status, created_at from shopping_items where user_id = ${uid} order by created_at desc limit 200`))
        items.push({ kind: "acquisto", id: String(r.id), title: r.name || "Acquisto", sub: r.status, at: asIso(r.created_at) });
      for (const r of await safe(sql<{ mode: string; level: string; best: number; updated_at: unknown }>`
        select mode, level, best, updated_at from game_records where user_id = ${uid} order by updated_at desc limit 50`))
        items.push({ kind: "gioco", id: `${r.mode}|${r.level}`, title: `Record del gioco · ${r.mode} ${r.level}`, sub: `${r.best} punti`, at: asIso(r.updated_at) });
    }
    for (const r of await safe(sql<{ id: number; title: string; score: number | null; created_at: unknown }>`
      select id, title, score, created_at from gestures where member_id = ${t.id} order by created_at desc limit 300`))
      items.push({ kind: "gesto", id: String(r.id), title: r.title || "Analisi del gesto", sub: r.score != null ? `${r.score}/100` : "", at: asIso(r.created_at) });
    return {
      member: { id: asNum(t.id), name: [t.given_name, t.family_name].filter(Boolean).join(" ").trim() || t.nickname || "Arciere", hasAccount: Boolean(uid), self: asNum(t.id) === asNum(me.id) },
      items,
    };
  });

export const manageDelete = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const i = (input ?? {}) as { memberId?: number; kind?: string; id?: string };
    const kind = KINDS.find((k) => k === i.kind);
    if (!kind) throw new Error("Tipo di dato sconosciuto.");
    const id = String(i.id ?? "").slice(0, 80);
    if (!id) throw new Error("Voce non trovata.");
    return { memberId: asNum(i.memberId), kind, id };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await founder(sql, context.userId);
    const t = await target(sql, data.memberId);
    const uid = t.user_id ?? "";
    const n = asNum(data.id);
    let done = 0;
    // ogni cancellazione è legata al proprietario: non si può toccare la voce di un'altra persona
    if (data.kind === "gesto") done = (await sql`delete from gestures where id = ${n} and member_id = ${t.id} returning id`).length;
    else if (!uid) throw new Error("Questo profilo non ha un account: ci sono solo analisi del gesto.");
    else if (data.kind === "allenamento") done = (await sql`delete from sessions where id = ${n} and user_id = ${uid} returning id`).length;
    else if (data.kind === "gara") done = (await sql`delete from competition_entries where id = ${n} and user_id = ${uid} returning id`).length;
    else if (data.kind === "attrezzo") done = (await sql`delete from equipment where id = ${n} and user_id = ${uid} returning id`).length;
    else if (data.kind === "assetto") done = (await sql`delete from setups where id = ${n} and user_id = ${uid} returning id`).length;
    else if (data.kind === "obiettivo") done = (await sql`delete from goals where id = ${n} and user_id = ${uid} returning id`).length;
    else if (data.kind === "acquisto") done = (await sql`delete from shopping_items where id = ${n} and user_id = ${uid} returning id`).length;
    else if (data.kind === "gioco") {
      const [mode, level] = data.id.split("|");
      done = (await sql`delete from game_records where user_id = ${uid} and mode = ${mode ?? ""} and level = ${level ?? ""} returning user_id`).length;
    }
    if (!done) throw new Error("Voce non trovata: forse è già stata eliminata.");
    await log(sql, context.userId, asNum(t.id), "elimina", `${data.kind}:${data.id}`);
    return { ok: true as const };
  });
