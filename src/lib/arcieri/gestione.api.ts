import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asIso, asNum, db, ensureMember, staffLevel } from "./access";
import { CATEGORIES } from "./labels";

type Sql = Awaited<ReturnType<typeof db>>;

/**
 * Gestione dei dati di un profilo, solo per il fondatore: elenco di quello che la persona ha inserito,
 * modifica e cancellazione voce per voce. Non arriva nessun avviso alla persona; ogni apertura e ogni cancellazione
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

/* ---------- modifica di una voce (solo fondatore) ---------- */

export type FieldType = "text" | "number" | "date" | "select" | "euro";
export type ManageField = { key: string; label: string; type: FieldType; value: string; options?: { value: string; label: string }[] };

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c.id, label: c.label }));
const SPECS: Partial<Record<ManageKind, Omit<ManageField, "value">[]>> = {
  allenamento: [
    { key: "day", label: "Data", type: "date" },
    { key: "place", label: "Luogo", type: "text" },
    { key: "distance_m", label: "Distanza (m)", type: "number" },
    { key: "notes", label: "Note", type: "text" },
  ],
  gara: [
    { key: "score", label: "Punti della gara", type: "number" },
    { key: "rank", label: "Posto in classifica", type: "number" },
    { key: "championship_points", label: "Punti campionato", type: "number" },
    { key: "lane_count", label: "Piazzole tirate", type: "number" },
    { key: "spot", label: "Spot", type: "number" },
    { key: "category", label: "Categoria", type: "text" },
    { key: "target_kind", label: "Bersaglio", type: "select", options: [{ value: "", label: "Non detto" }, { value: "sagoma", label: "Sagome 3D" }, { value: "padiglione", label: "Padiglione" }] },
    { key: "notes", label: "Note", type: "text" },
  ],
  attrezzo: [
    { key: "name", label: "Nome", type: "text" },
    { key: "category", label: "Categoria", type: "select", options: CATEGORY_OPTIONS },
    { key: "status", label: "Stato", type: "select", options: [{ value: "in_use", label: "In uso" }, { value: "replace", label: "Da cambiare" }, { value: "unused", label: "Non usato" }] },
    { key: "price_cents", label: "Prezzo €", type: "euro" },
    { key: "shop", label: "Negozio", type: "text" },
    { key: "purchased_on", label: "Comprato il", type: "date" },
    { key: "notes", label: "Note", type: "text" },
  ],
  assetto: [
    { key: "name", label: "Nome", type: "text" },
    { key: "notes", label: "Note", type: "text" },
  ],
  obiettivo: [
    { key: "title", label: "Obiettivo", type: "text" },
    { key: "target", label: "Traguardo", type: "number" },
  ],
  acquisto: [
    { key: "name", label: "Cosa", type: "text" },
    { key: "category", label: "Categoria", type: "select", options: CATEGORY_OPTIONS },
    { key: "qty", label: "Quantità", type: "number" },
    { key: "price_cents", label: "Prezzo di un pezzo €", type: "euro" },
    { key: "status", label: "Stato", type: "select", options: [{ value: "todo", label: "Da comprare" }, { value: "ordered", label: "Ordinato" }, { value: "bought", label: "Preso" }] },
    { key: "notes", label: "Note", type: "text" },
  ],
  gesto: [
    { key: "title", label: "Titolo", type: "text" },
    { key: "score", label: "Voto (0-100)", type: "number" },
  ],
  gioco: [{ key: "best", label: "Record", type: "number" }],
};

const str = (v: unknown) => (v == null ? "" : String(v));
const euroText = (c: unknown) => (c == null || c === "" ? "" : (Number(c) / 100).toFixed(2).replace(".", ","));
const dayText = (v: unknown) => {
  const iso = asIso(v);
  return iso ? iso.slice(0, 10) : "";
};

/** i campi di una voce con i valori di adesso */
export const manageFields = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const i = (input ?? {}) as { memberId?: number; kind?: string; id?: string };
    const kind = KINDS.find((k) => k === i.kind);
    if (!kind) throw new Error("Tipo di dato sconosciuto.");
    return { memberId: asNum(i.memberId), kind, id: String(i.id ?? "").slice(0, 80) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await founder(sql, context.userId);
    const t = await target(sql, data.memberId);
    const uid = t.user_id ?? "";
    const n = asNum(data.id);
    const spec = SPECS[data.kind as ManageKind];
    if (!spec) throw new Error("Questa voce non si modifica.");
    let row: Record<string, unknown> | undefined;
    if (data.kind === "gesto") row = (await sql`select title, score from gestures where id = ${n} and member_id = ${t.id}`)[0];
    else if (!uid) throw new Error("Questo profilo non ha un account.");
    else if (data.kind === "allenamento") row = (await sql`select started_at, place, distance_m, notes from sessions where id = ${n} and user_id = ${uid}`)[0];
    else if (data.kind === "gara") row = (await sql`select score, rank, championship_points, lane_count, spot, category, target_kind, notes from competition_entries where id = ${n} and user_id = ${uid}`)[0];
    else if (data.kind === "attrezzo") row = (await sql`select name, category, status, price_cents, shop, purchased_on, notes from equipment where id = ${n} and user_id = ${uid}`)[0];
    else if (data.kind === "assetto") row = (await sql`select name, notes from setups where id = ${n} and user_id = ${uid}`)[0];
    else if (data.kind === "obiettivo") row = (await sql`select title, target from goals where id = ${n} and user_id = ${uid}`)[0];
    else if (data.kind === "acquisto") row = (await sql`select name, category, qty, price_cents, status, notes from shopping_items where id = ${n} and user_id = ${uid}`)[0];
    else if (data.kind === "gioco") {
      const [mode, level] = data.id.split("|");
      row = (await sql`select best from game_records where user_id = ${uid} and mode = ${mode ?? ""} and level = ${level ?? ""}`)[0];
    }
    if (!row) throw new Error("Voce non trovata.");
    const r = row;
    const fields: ManageField[] = spec.map((f) => ({
      ...f,
      value: f.key === "day" ? dayText(r.started_at) : f.type === "euro" ? euroText(r[f.key]) : f.type === "date" ? dayText(r[f.key]) : str(r[f.key]),
    }));
    return { fields };
  });

/** salva i campi modificati di una voce: solo i campi previsti, con i tipi giusti */
export const manageUpdate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const i = (input ?? {}) as { memberId?: number; kind?: string; id?: string; values?: Record<string, unknown> };
    const kind = KINDS.find((k) => k === i.kind);
    if (!kind) throw new Error("Tipo di dato sconosciuto.");
    const values: Record<string, string> = {};
    for (const f of SPECS[kind] ?? []) values[f.key] = String(i.values?.[f.key] ?? "").trim().slice(0, f.type === "text" ? 300 : 40);
    return { memberId: asNum(i.memberId), kind, id: String(i.id ?? "").slice(0, 80), values };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await founder(sql, context.userId);
    const t = await target(sql, data.memberId);
    const uid = t.user_id ?? "";
    const n = asNum(data.id);
    const v = data.values;
    // numero (vuoto = niente), euro in centesimi, data AAAA-MM-GG, scelta fra quelle previste
    const numOrNull = (k: string) => {
      const x = Number((v[k] ?? "").replace(",", "."));
      return v[k] === "" || !Number.isFinite(x) ? null : x;
    };
    const intOrNull = (k: string) => {
      const x = numOrNull(k);
      return x == null ? null : Math.round(x);
    };
    const cents = (k: string) => {
      const raw = (v[k] ?? "").replace(/[€\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
      const x = Number(raw);
      return raw === "" || !Number.isFinite(x) ? null : Math.round(x * 100);
    };
    const day = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v[k] ?? "") ? v[k] : null);
    const pick = (k: string) => {
      const f = SPECS[data.kind as ManageKind]?.find((x) => x.key === k);
      return f?.options?.some((o) => o.value === v[k]) ? v[k] : null;
    };
    const text = (k: string) => (v[k] ?? "").slice(0, 300);
    let done = 0;
    if (data.kind === "gesto") {
      const score = intOrNull("score");
      done = (await sql`update gestures set title = ${text("title")}, score = ${score == null ? null : Math.max(0, Math.min(100, score))} where id = ${n} and member_id = ${t.id} returning id`).length;
    } else if (!uid) throw new Error("Questo profilo non ha un account.");
    else if (data.kind === "allenamento") {
      const d = day("day");
      const dist = numOrNull("distance_m");
      done = (await sql`
        update sessions set
          started_at = case when ${d}::text is null then started_at else ((${d}::date + (started_at at time zone 'Europe/Rome')::time) at time zone 'Europe/Rome') end,
          place = ${text("place")}, distance_m = coalesce(${dist}, distance_m), notes = ${text("notes")}
        where id = ${n} and user_id = ${uid} returning id`).length;
    } else if (data.kind === "gara") {
      const lanes = intOrNull("lane_count");
      done = (await sql`
        update competition_entries set
          score = ${intOrNull("score")}, rank = ${intOrNull("rank")}, championship_points = ${intOrNull("championship_points")},
          lane_count = ${lanes == null ? null : Math.max(1, Math.min(60, lanes))}, spot = ${intOrNull("spot")},
          category = ${text("category")}, target_kind = ${pick("target_kind") ?? ""}, notes = ${text("notes")}
        where id = ${n} and user_id = ${uid} returning id`).length;
    } else if (data.kind === "attrezzo") {
      if (!text("name")) throw new Error("Il nome non può restare vuoto.");
      done = (await sql`
        update equipment set
          name = ${text("name")}, category = coalesce(${pick("category")}, category), status = coalesce(${pick("status")}, status),
          price_cents = ${cents("price_cents")}, shop = ${text("shop")}, purchased_on = ${day("purchased_on")}, notes = ${text("notes")}
        where id = ${n} and user_id = ${uid} returning id`).length;
    } else if (data.kind === "assetto") {
      if (!text("name")) throw new Error("Il nome non può restare vuoto.");
      done = (await sql`update setups set name = ${text("name")}, notes = ${text("notes")} where id = ${n} and user_id = ${uid} returning id`).length;
    } else if (data.kind === "obiettivo") {
      if (!text("title")) throw new Error("L'obiettivo non può restare vuoto.");
      done = (await sql`update goals set title = ${text("title")}, target = coalesce(${numOrNull("target")}, target) where id = ${n} and user_id = ${uid} returning id`).length;
    } else if (data.kind === "acquisto") {
      if (!text("name")) throw new Error("Il nome non può restare vuoto.");
      const qty = intOrNull("qty");
      done = (await sql`
        update shopping_items set
          name = ${text("name")}, category = coalesce(${pick("category")}, category), qty = ${qty == null ? 1 : Math.max(1, Math.min(999, qty))},
          price_cents = ${cents("price_cents")}, status = coalesce(${pick("status")}, status), notes = ${text("notes")}
        where id = ${n} and user_id = ${uid} returning id`).length;
    } else if (data.kind === "gioco") {
      const [mode, level] = data.id.split("|");
      done = (await sql`update game_records set best = coalesce(${intOrNull("best")}, best) where user_id = ${uid} and mode = ${mode ?? ""} and level = ${level ?? ""} returning user_id`).length;
    }
    if (!done) throw new Error("Voce non trovata: forse è stata eliminata.");
    await log(sql, context.userId, asNum(t.id), "modifica", `${data.kind}:${data.id}`);
    return { ok: true as const };
  });
