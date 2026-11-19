/**
 * Trasloco dei dati da un database all'altro (da Grok al database proprio).
 *
 * Vecchio sito: un amministratore esporta ogni tabella a pezzi (JSON prodotto da Postgres stesso,
 * così date, jsonb e numeri tornano identici). Nuovo sito, ancora vuoto: lo stesso file viene
 * reimportato a pezzi. Account e password viaggiano con gli altri dati (le password sono già
 * cifrate), le sessioni no: dopo il trasloco si rientra con il vecchio utente e password.
 *
 * I pezzi restano sotto ~2 MB perché le funzioni su Vercel accettano al massimo 4,5 MB.
 */
import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";
import { authMiddleware } from "@/lib/auth/middleware";
import { db, ensureMember } from "./access";
import type { Sql } from "../db";

const SKIP = new Set(["_migrations", "_trasloco", "session", "verification"]);
const MAX_CHUNK = 2_000_000;

type TableInfo = { name: string; rows: number };

async function requireAdmin(userId: string) {
  const sql = await db();
  const me = await ensureMember(sql, userId);
  if (me.role !== "admin") throw new Error("Solo un amministratore può fare il trasloco.");
  return sql;
}

/** Tabelle dell'app in ordine di dipendenza: prima quelle a cui le altre fanno riferimento. */
async function orderedTables(sql: Sql): Promise<string[]> {
  const tables = (await sql.query<{ name: string }>(
    `select table_name as name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'`,
  ))
    .map((t) => t.name)
    .filter((name) => !SKIP.has(name));
  const deps = await sql.query<{ child: string; parent: string }>(
    `select tc.table_name as child, ccu.table_name as parent
     from information_schema.table_constraints tc
     join information_schema.constraint_column_usage ccu
       on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
     where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`,
  );
  const need = new Map(tables.map((t) => [t, new Set<string>()]));
  for (const { child, parent } of deps) {
    if (child !== parent && need.has(child) && need.has(parent)) need.get(child)!.add(parent);
  }
  const out: string[] = [];
  const done = new Set<string>();
  while (out.length < tables.length) {
    const ready = tables.filter((t) => !done.has(t) && [...need.get(t)!].every((p) => done.has(p))).sort();
    // un giro di riferimenti incrociati: si prosegue comunque in ordine alfabetico
    const next = ready.length ? ready : tables.filter((t) => !done.has(t)).sort().slice(0, 1);
    for (const t of next) {
      out.push(t);
      done.add(t);
    }
  }
  return out;
}

async function checkTable(sql: Sql, table: string) {
  const known = await orderedTables(sql);
  if (!known.includes(table)) throw new Error(`Tabella sconosciuta: ${table}`);
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function orderBy(sql: Sql, table: string) {
  const pk = await sql.query<{ col: string }>(
    `select a.attname as col
     from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
     where i.indrelid = $1::regclass and i.indisprimary
     order by a.attnum`,
    [ident(table)],
  );
  return pk.length ? pk.map((p) => ident(p.col)).join(", ") : "ctid";
}

export const traslocoTables = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<TableInfo[]> => {
    const sql = await requireAdmin(context.userId);
    const names = await orderedTables(sql);
    const out: TableInfo[] = [];
    for (const name of names) {
      const count = await sql.query<{ n: string }>(`select count(*)::text as n from ${ident(name)}`);
      out.push({ name, rows: Number(count[0]?.n ?? 0) });
    }
    return out;
  });

export const traslocoExport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const v = input as { table?: string; offset?: number; limit?: number };
    return {
      table: String(v?.table ?? ""),
      offset: Math.max(0, Math.floor(Number(v?.offset) || 0)),
      limit: Math.min(2000, Math.max(1, Math.floor(Number(v?.limit) || 200))),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    await checkTable(sql, data.table);
    const order = await orderBy(sql, data.table);
    let limit = data.limit;
    for (;;) {
      const res = await sql.query<{ j: string; n: string }>(
        `select coalesce(json_agg(t), '[]'::json)::text as j, count(*)::text as n
         from (select * from ${ident(data.table)} order by ${order} limit $1 offset $2) t`,
        [limit, data.offset],
      );
      const json = res[0]?.j ?? "[]";
      const n = Number(res[0]?.n ?? 0);
      // pezzo troppo grosso (foto): dimezzo finché ci sta, ma almeno una riga
      if (json.length > MAX_CHUNK && limit > 1) {
        limit = Math.max(1, Math.floor(limit / 2));
        continue;
      }
      return { json, count: n, limit };
    }
  });

/** Nuovo sito: controlla che sia vuoto, svuota tutto e dà un gettone per i pezzi successivi. */
export const traslocoBegin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const v = input as { confirm?: string; tables?: string[] };
    if (v?.confirm !== "TRASLOCO") throw new Error("Scrivi TRASLOCO per confermare.");
    return { tables: Array.isArray(v.tables) ? v.tables.map(String) : [] };
  })
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    const users = await sql.query<{ n: string }>(`select count(*)::text as n from "user"`);
    const sessions = await sql.query<{ n: string }>(`select count(*)::text as n from sessions`);
    if (Number(users[0]?.n) > 3 || Number(sessions[0]?.n) > 0) {
      throw new Error("Questo database ha già dei dati: il trasloco si fa solo in un sito nuovo e vuoto.");
    }
    const known = await orderedTables(sql);
    const missing = data.tables.filter((t) => !known.includes(t));
    if (missing.length) throw new Error(`Il file contiene tabelle che qui non esistono: ${missing.join(", ")}. Pubblica prima la stessa versione dell'app.`);
    await sql.query(`create table if not exists _trasloco (token text primary key, created_at timestamptz not null default now())`);
    await sql.query(`delete from _trasloco`);
    const token = randomBytes(24).toString("hex");
    await sql.query(`insert into _trasloco (token) values ($1)`, [token]);
    await sql.query(`truncate ${[...known, "session", "verification"].map(ident).join(", ")} restart identity cascade`);
    return { token };
  });

async function checkToken(sql: Sql, token: string) {
  const ok = await sql.query<{ token: string }>(
    `select token from _trasloco where token = $1 and created_at > now() - interval '2 hours'`,
    [token],
  );
  if (!ok[0]) throw new Error("Trasloco scaduto o non valido: ricomincia l'importazione.");
}

/** Un pezzo di una tabella. Senza sessione (il trasloco ha appena svuotato gli utenti): vale il gettone. */
export const traslocoImport = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const v = input as { token?: string; table?: string; json?: string };
    const json = String(v?.json ?? "[]");
    if (json.length > 3_500_000) throw new Error("Pezzo troppo grande.");
    return { token: String(v?.token ?? ""), table: String(v?.table ?? ""), json };
  })
  .handler(async ({ data }) => {
    const sql = await db();
    await checkToken(sql, data.token);
    await checkTable(sql, data.table);
    const t = ident(data.table);
    const rows = await sql.query<{ n: string }>(
      `with ins as (insert into ${t} select * from json_populate_recordset(null::${t}, $1::json) returning 1)
       select count(*)::text as n from ins`,
      [data.json],
    );
    return { inserted: Number(rows[0]?.n ?? 0) };
  });

/** Fine: rimetto a posto i contatori automatici e butto il gettone. */
export const traslocoFinish = createServerFn({ method: "POST" })
  .validator((input: unknown) => ({ token: String((input as { token?: string })?.token ?? "") }))
  .handler(async ({ data }) => {
    const sql = await db();
    await checkToken(sql, data.token);
    const seqs = await sql.query<{ tbl: string; col: string }>(
      `select table_name as tbl, column_name as col from information_schema.columns
       where table_schema = 'public' and column_default like 'nextval(%'`,
    );
    for (const { tbl, col } of seqs) {
      if (SKIP.has(tbl)) continue;
      await sql.query(
        `select setval(pg_get_serial_sequence($1, $2), coalesce((select max(${ident(col)}) from ${ident(tbl)}), 0) + 1, false)`,
        [ident(tbl), col],
      );
    }
    await sql.query(`delete from _trasloco`);
    const counts: Record<string, number> = {};
    for (const name of await orderedTables(sql)) {
      const c = await sql.query<{ n: string }>(`select count(*)::text as n from ${ident(name)}`);
      counts[name] = Number(c[0]?.n ?? 0);
    }
    return { counts };
  });
