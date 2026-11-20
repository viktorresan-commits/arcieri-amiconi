/**
 * Strumenti del profilo: migrazione personale dei dati dalla vecchia app (JSON o report PDF),
 * azzeramento dei propri dati e gestione della squadra (solo amministratori).
 *
 * La migrazione è per singolo utente: ognuno carica il proprio file "Scarica JSON" del vecchio
 * sito e i dati finiscono sul proprio account, con id nuovi. Ripeterla non duplica nulla.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asNum, clip, db, ensureMember } from "./access";
import type { Sql } from "../db";

type Row = Record<string, unknown>;

const MAX_ROWS = 5000;

function rowsOf(value: unknown, max = MAX_ROWS): Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is Row => !!r && typeof r === "object" && !Array.isArray(r)).slice(0, max);
}

const colCache = new Map<string, string[]>();
async function columnsOf(sql: Sql, table: string) {
  const hit = colCache.get(table);
  if (hit) return hit;
  const rows = await sql.query<{ c: string }>(
    `select column_name as c from information_schema.columns where table_schema = 'public' and table_name = $1`,
    [table],
  );
  const cols = rows.map((r) => r.c);
  colCache.set(table, cols);
  return cols;
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** Inserisce le colonne note di una riga, scartando quelle che il database nuovo non ha. */
async function insertRow(sql: Sql, table: string, row: Row, fixed: Row, drop: string[]) {
  const cols = await columnsOf(sql, table);
  const keys = cols.filter((c) => !drop.includes(c) && (c in fixed || (c in row && row[c] !== undefined)));
  const values = keys.map((k) => {
    const v = k in fixed ? fixed[k] : row[k];
    return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
  });
  const text = `insert into ${ident(table)} (${keys.map(ident).join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id`;
  const out = await sql.query<{ id: number }>(text, values);
  return asNum(out[0]?.id);
}

/* ---------------- migrazione: attrezzatura e assetti ---------------- */

export const importGrokGear = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { equipment?: unknown; setups?: unknown };
    return { equipment: rowsOf(raw.equipment, 500), setups: rowsOf(raw.setups, 200) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const equip: [number, number][] = [];
    let added = 0;
    for (const item of data.equipment) {
      const name = clip(item.name, 120);
      const category = clip(item.category, 40);
      if (!name || !category) continue;
      const same = await sql<{ id: number }>`select id from equipment where user_id = ${context.userId} and name = ${name} and category = ${category} limit 1`;
      let id = asNum(same[0]?.id);
      if (!id) {
        id = await insertRow(sql, "equipment", item, { user_id: context.userId }, ["id"]);
        added += 1;
      }
      if (item.id != null && id) equip.push([asNum(item.id), id]);
    }
    const eqMap = new Map(equip);
    const setups: [number, number][] = [];
    for (const item of data.setups) {
      const name = clip(item.name, 120) || "Assetto";
      const same = await sql<{ id: number }>`select id from setups where user_id = ${context.userId} and name = ${name} limit 1`;
      let id = asNum(same[0]?.id);
      if (!id) {
        id = await insertRow(sql, "setups", { ...item, name }, {
          user_id: context.userId,
          bow_id: item.bow_id == null ? null : eqMap.get(asNum(item.bow_id)) ?? null,
          arrow_id: item.arrow_id == null ? null : eqMap.get(asNum(item.arrow_id)) ?? null,
        }, ["id"]);
        added += 1;
      }
      if (item.id != null && id) setups.push([asNum(item.id), id]);
    }
    return { added, setups };
  });

/* ---------------- migrazione: allenamenti con le frecce ---------------- */

export const importGrokSessions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { sessions?: unknown; shots?: unknown; setups?: unknown };
    const setups = Array.isArray(raw.setups) ? (raw.setups as unknown[]).filter((p): p is [number, number] => Array.isArray(p) && p.length === 2).map(([a, b]) => [asNum(a), asNum(b)] as [number, number]) : [];
    return { sessions: rowsOf(raw.sessions, 200), shots: rowsOf(raw.shots, 20000), setups };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const setupMap = new Map(data.setups);
    const shotsBy = new Map<number, Row[]>();
    for (const shot of data.shots) {
      const key = asNum(shot.session_id);
      const list = shotsBy.get(key) ?? [];
      list.push(shot);
      shotsBy.set(key, list);
    }
    const shotCols = (await columnsOf(sql, "shots")).filter((c) => c !== "id" && c !== "session_id");
    let added = 0;
    let skipped = 0;
    let arrows = 0;
    for (const s of data.sessions) {
      if (!s.started_at || s.distance_m == null) {
        skipped += 1;
        continue;
      }
      let key = clip(s.client_key, 120) || `grok-${asNum(s.id)}-${String(s.started_at)}`;
      const exists = await sql<{ user_id: string }>`select user_id from sessions where client_key = ${key} limit 1`;
      if (exists[0]) {
        if (exists[0].user_id === context.userId) {
          skipped += 1;
          continue;
        }
        key = `${key}-${context.userId.slice(0, 8)}`;
        const again = await sql`select 1 from sessions where client_key = ${key} limit 1`;
        if (again[0]) {
          skipped += 1;
          continue;
        }
      }
      const id = await insertRow(sql, "sessions", s, {
        user_id: context.userId,
        client_key: key,
        setup_id: s.setup_id == null ? null : setupMap.get(asNum(s.setup_id)) ?? null,
      }, ["id"]);
      if (!id) continue;
      added += 1;
      const list = shotsBy.get(asNum(s.id)) ?? [];
      for (let i = 0; i < list.length; i += 200) {
        const part = list.slice(i, i + 200);
        const params: unknown[] = [];
        const tuples = part.map((shot) => {
          const vals = [id, ...shotCols.map((c) => shot[c] ?? null)];
          const at = params.length;
          params.push(...vals);
          return `(${vals.map((_, j) => `$${at + j + 1}`).join(", ")})`;
        });
        await sql.query(
          `insert into shots (session_id, ${shotCols.map(ident).join(", ")}) values ${tuples.join(", ")} on conflict do nothing`,
          params,
        );
        arrows += part.length;
      }
    }
    return { added, skipped, arrows };
  });

/* ---------------- migrazione dal report PDF (solo le uscite, senza frecce) ---------------- */

export const importReportSessions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const rows = rowsOf((input as { rows?: unknown })?.rows, 2000).map((r) => ({
      startedAt: clip(r.startedAt, 40),
      distanceM: Number(r.distanceM),
      bowType: clip(r.bowType, 40) || "olimpico",
      place: clip(r.place, 120),
    }));
    return { rows: rows.filter((r) => /^\d{4}-\d{2}-\d{2}/.test(r.startedAt) && Number.isFinite(r.distanceM) && r.distanceM > 0 && r.distanceM < 200) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    let added = 0;
    let skipped = 0;
    for (const r of data.rows) {
      const key = `pdf-${context.userId.slice(0, 12)}-${r.startedAt}-${r.distanceM}`;
      const exists = await sql`select 1 from sessions where client_key = ${key} limit 1`;
      if (exists[0]) {
        skipped += 1;
        continue;
      }
      const when = r.startedAt.length <= 10 ? `${r.startedAt}T10:00:00` : r.startedAt.replace(" ", "T");
      await sql`
        insert into sessions (client_key, user_id, started_at, place, distance_m, discipline, bow_type, face, max_arrow, arrows_per_end, ends_planned, blocks_planned, notes)
        values (${key}, ${context.userId}, ${when}, ${r.place}, ${r.distanceM}, ${"libero"}, ${r.bowType}, ${"wa10"}, ${10}, ${6}, ${0}, ${1}, ${"Importato dal report PDF (senza frecce)"})`;
      added += 1;
    }
    return { added, skipped };
  });

/* ---------------- azzeramento dei propri dati ---------------- */

type Scope = "allenamenti" | "gare" | "attrezzatura" | "tutto";

async function wipeUser(sql: Sql, userId: string, memberId: number, scope: Scope) {
  const counts: Record<string, number> = {};
  const run = async (label: string, text: string, params: unknown[]) => {
    try {
      const rows = await sql.query(`${text} returning 1`, params);
      counts[label] = (counts[label] ?? 0) + rows.length;
    } catch {
      /* tabella assente in questo database: si va avanti */
    }
  };
  if (scope === "allenamenti" || scope === "tutto") {
    await run("allenamenti", "delete from sessions where user_id = $1", [userId]);
    await run("analisi del gesto", "delete from gestures where member_id = $1", [memberId]);
  }
  if (scope === "gare" || scope === "tutto") {
    await run("piazzole", "delete from piazzole where user_id = $1", [userId]);
    await run("presenze", "delete from competition_presence where user_id = $1", [userId]);
    await run("gare", "delete from competition_entries where user_id = $1", [userId]);
  }
  if (scope === "attrezzatura" || scope === "tutto") {
    await run("assetti", "delete from setups where user_id = $1", [userId]);
    await run("attrezzatura", "delete from equipment where user_id = $1", [userId]);
    await run("lista acquisti", "delete from shopping_items where user_id = $1", [userId]);
  }
  if (scope === "tutto") {
    await run("obiettivi", "delete from goals where user_id = $1", [userId]);
    await run("medaglie", "delete from user_achievements where user_id = $1", [userId]);
    await run("sfide", "delete from challenge_members where user_id = $1", [userId]);
    await run("notifiche", "delete from notifications where user_id = $1", [userId]);
    await run("ordini", "delete from club_orders where user_id = $1", [userId]);
    await run("eventi", "delete from events where user_id = $1 and (created_by is null or created_by = $1)", [userId]);
    await run("duelli", "delete from game_duels where challenger_id = $1 or opponent_id = $1", [memberId]);
    await run("partite", "delete from game_matches where member_id = $1", [memberId]);
    await run("premi del gioco", "delete from game_rewards where member_id = $1", [memberId]);
  }
  return Object.entries(counts).filter(([, n]) => n > 0).map(([label, n]) => ({ label, n }));
}

export const resetMyData = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { scope?: string; confirm?: string };
    const scope = (["allenamenti", "gare", "attrezzatura", "tutto"] as const).find((s) => s === raw.scope);
    if (!scope) throw new Error("Scegli cosa azzerare.");
    if (String(raw.confirm ?? "").trim().toUpperCase() !== "AZZERA") throw new Error("Per confermare scrivi AZZERA.");
    return { scope };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const removed = await wipeUser(sql, context.userId, asNum(me.id), data.scope);
    return { removed };
  });

/* ---------------- squadra: togliere una persona (solo amministratori) ---------------- */

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const id = asNum((input as { id?: number })?.id);
    if (!id) throw new Error("Profilo assente.");
    return { id };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (me.role !== "admin") throw new Error("Solo l'amministratore toglie persone dalla squadra.");
    if (asNum(me.id) === data.id) throw new Error("Non puoi togliere te stesso: passa il ruolo di amministratore a un altro prima.");
    const rows = await sql<{ id: number; user_id: string | null; given_name: string }>`select id, user_id, given_name from members where id = ${data.id} limit 1`;
    const target = rows[0];
    if (!target) throw new Error("Profilo non trovato.");
    if (target.user_id) await wipeUser(sql, target.user_id, asNum(target.id), "tutto");
    try {
      await sql`delete from gestures where member_id = ${data.id}`;
    } catch {
      /* nessuna tabella dei gesti */
    }
    await sql`delete from members where id = ${data.id}`;
    // l'account sparisce del tutto: sessioni e accessi vanno via a cascata
    if (target.user_id) await sql`delete from "user" where id = ${target.user_id}`;
    return { ok: true as const, name: target.given_name };
  });

/* ---------------- squadra: elenco completo per l'amministratore ---------------- */

export const teamList = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const admin = me.role === "admin";
    const rows = await sql<{ id: number; user_id: string | null; given_name: string; family_name: string; nickname: string; role: string; status: string; claim_code: string; email: string | null; photo_url: string | null; avatar_color: string; sessions: number }>`
      select m.id, m.user_id, m.given_name, m.family_name, m.nickname, m.role, m.status, m.claim_code, u.email, m.photo_url, m.avatar_color,
        (select count(*)::int from sessions s where s.user_id = m.user_id) as sessions
      from members m
      left join "user" u on u.id = m.user_id
      order by m.given_name, m.id`;
    return {
      admin,
      meId: asNum(me.id),
      people: rows.map((r) => ({
        id: asNum(r.id),
        name: [r.given_name, r.family_name].filter(Boolean).join(" ") || r.nickname || "Arciere",
        nickname: r.nickname ?? "",
        role: r.role,
        linked: !!r.user_id,
        email: admin ? r.email ?? "" : "",
        code: admin && !r.user_id ? r.claim_code : "",
        photoUrl: r.photo_url && r.photo_url.length < 200_000 ? r.photo_url : null,
        color: r.avatar_color || "#1f5c38",
        sessions: asNum(r.sessions),
      })),
    };
  });

/* ---------------- amministratore con ID e password ---------------- */

// Solo l'impronta (sha256 con sale) delle credenziali: ID e password in chiaro non sono nel codice.
// Su Vercel si possono cambiare con la variabile ADMIN_KEY_HASH (formato "sale:impronta").
const ADMIN_KEY = "3e6506e3f750be33032d4419cc735c5c:76d4a63c01cede6377b91febde5ad81d2084b7f6cb3399e0f89557989a9921f1";

export const unlockAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { id?: unknown; password?: unknown };
    return { id: String(raw.id ?? "").trim().slice(0, 80), password: String(raw.password ?? "").slice(0, 120) };
  })
  .handler(async ({ context, data }) => {
    const { createHash, timingSafeEqual } = await import("node:crypto");
    const [salt, hash] = (process.env.ADMIN_KEY_HASH || ADMIN_KEY).split(":");
    const got = createHash("sha256").update(`${salt}:${data.id}:${data.password}`).digest();
    const want = Buffer.from(hash ?? "", "hex");
    // piccola attesa fissa: rende inutili i tentativi a raffica
    await new Promise((r) => setTimeout(r, 600));
    if (want.length !== got.length || !timingSafeEqual(got, want)) throw new Error("ID o password non corretti.");
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    await sql`update members set role = 'admin' where id = ${me.id}`;
    return { ok: true as const };
  });
