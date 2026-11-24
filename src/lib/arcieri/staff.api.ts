/**
 * Gestione della compagnia: incarichi e permessi.
 *
 * - Fondatore (is_super): ha le credenziali di amministratore, vede tutte le compagnie, nomina i presidenti.
 *   Nessuno lo può togliere né declassare.
 * - Presidente della compagnia (company_members.role = 'owner'): aggiunge (invito) e toglie persone
 *   della sua compagnia e ne nomina gli allenatori. Non tocca le altre compagnie.
 * - Allenatore (members.coach): aggiunge e toglie persone della sua compagnia (non il presidente),
 *   segue gli allievi nella scheda Allenatore.
 *
 * Amministratori e moderatori non esistono più. Il presidente si nomina con un codice monouso
 * (valido 7 giorni) o approvando una richiesta.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { asBool, asNum, clip, db, ensureMember, staffLevel, type MemberRow } from "./access";
import { dropIfEmpty, homeId, myMembership } from "./compagnie.api";

type Level = ReturnType<typeof staffLevel>;
const ABSENT_DAYS = 90;

function randomCode(prefix: string) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += abc[Math.floor(Math.random() * abc.length)];
  return `${prefix}-${out.slice(0, 4)}-${out.slice(4)}`;
}

function asIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value ? String(value) : null;
}

async function notify(sql: Sql, userId: string, title: string, body: string, href: string, dedupe: string) {
  try {
    await sql`
      insert into notifications (user_id, title, body, href, dedupe)
      values (${userId}, ${title}, ${body}, ${href}, ${dedupe})
      on conflict (dedupe) do nothing`;
  } catch {
    /* le notifiche non sono indispensabili */
  }
}

async function me(sql: Sql, userId: string) {
  const row = await ensureMember(sql, userId);
  return { row, level: staffLevel(row) as Level };
}

/** l'ultima volta che una persona si è fatta viva: accesso all'app o allenamento registrato */
async function lastSeenMap(sql: Sql) {
  const rows = await sql<{ user_id: string; seen: unknown }>`
    select m.user_id, greatest(
      coalesce((select max(s."updatedAt") from "session" s where s."userId" = m.user_id), 'epoch'::timestamptz),
      coalesce((select max(t.started_at) from sessions t where t.user_id = m.user_id), 'epoch'::timestamptz),
      coalesce(m.created_at::timestamptz, 'epoch'::timestamptz)
    ) as seen
    from members m where m.user_id is not null`;
  return new Map(rows.map((r) => [r.user_id, asIso(r.seen)]));
}

/** tutto quello che serve alla pagina Gestione compagnia, in base a chi la apre */
export const staffOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const { row, level } = await me(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    const company = await sql<{ id: number; name: string; color: string }>`select id, name, color from companies where id = ${mine.companyId} limit 1`;
    const myRequests = await sql<{ id: number; kind: string; status: string; created_at: unknown }>`
      select id, kind, status, created_at from role_requests where user_id = ${context.userId} order by created_at desc limit 5`;
    const base = {
      me: { memberId: asNum(row.id), level, leader: mine.role === "owner", coach: asBool(row.coach), manager: Boolean(level) || mine.role === "owner" || asBool(row.coach), companyId: mine.companyId, companyName: company[0]?.name ?? "", companyColor: company[0]?.color ?? "#1f7a46" },
      myRequests: myRequests.map((r) => ({ id: asNum(r.id), kind: r.kind, status: r.status, createdAt: asIso(r.created_at) })),
    };

    // presidente e allenatori vedono la loro compagnia; il fondatore le vede tutte
    const seen = await lastSeenMap(sql);
    const people = await sql<{ id: number; user_id: string; given_name: string; family_name: string; nickname: string; role: string; staff: string; is_super: boolean; coach: boolean; photo_url: string | null; avatar_color: string; company_id: number | null; company_role: string | null }>`
      select m.id, m.user_id, m.given_name, m.family_name, m.nickname, m.role, m.staff, m.is_super, m.coach, m.photo_url, m.avatar_color, cm.company_id, cm.role as company_role
      from members m left join company_members cm on cm.user_id = m.user_id
      where m.user_id is not null
      order by m.given_name, m.id`;
    const home = await homeId(sql);
    const companies = await sql<{ id: number; name: string; color: string }>`select id, name, color from companies order by (id = ${home}) desc, name`;
    const nameOf = new Map(companies.map((c) => [asNum(c.id), c.name]));
    const toPerson = (p: (typeof people)[number]) => ({
      memberId: asNum(p.id),
      userId: p.user_id,
      name: [p.given_name, p.family_name].filter(Boolean).join(" ") || p.nickname || "Arciere",
      photoUrl: p.photo_url && p.photo_url.length < 200_000 ? p.photo_url : null,
      color: p.avatar_color || "#1f5c38",
      level: staffLevel({ role: p.role as MemberRow["role"], is_super: p.is_super, staff: p.staff }),
      companyId: asNum(p.company_id ?? home),
      companyName: nameOf.get(asNum(p.company_id ?? home)) ?? "",
      leader: p.company_role === "owner",
      coach: asBool(p.coach),
      lastSeen: seen.get(p.user_id) ?? null,
    });
    const visible = level ? people : mine.role === "owner" || asBool(row.coach) ? people.filter((p) => asNum(p.company_id ?? home) === mine.companyId) : [];
    const list = visible.map(toPerson);
    const limit = Date.now() - ABSENT_DAYS * 86_400_000;
    const absent = list.filter((p) => p.lastSeen && new Date(p.lastSeen).getTime() < limit && p.userId !== context.userId);

    let requests: { id: number; userId: string; name: string; kind: string; companyId: number; companyName: string; note: string; createdAt: string | null }[] = [];
    let codes: { code: string; kind: string; companyName: string; expiresAt: string | null; used: boolean }[] = [];
    if (level) {
      const reqs = await sql<{ id: number; user_id: string; kind: string; company_id: number | null; note: string; created_at: unknown }>`
        select id, user_id, kind, company_id, note, created_at from role_requests where status = 'attesa' order by created_at`;
      const byUser = new Map(list.map((p) => [p.userId, p]));
      requests = reqs.map((r) => ({
        id: asNum(r.id),
        userId: r.user_id,
        name: byUser.get(r.user_id)?.name ?? "Arciere",
        kind: r.kind,
        companyId: asNum(r.company_id),
        companyName: nameOf.get(asNum(r.company_id)) ?? "",
        note: r.note,
        createdAt: asIso(r.created_at),
      }));
      const made = await sql<{ code: string; kind: string; company_id: number | null; expires_at: unknown; used_by: string | null }>`
        select code, kind, company_id, expires_at, used_by from role_codes
        where created_by = ${context.userId} and (used_by is null and expires_at > now() or used_at > now() - interval '7 days')
        order by created_at desc limit 12`;
      codes = made.map((c) => ({ code: c.code, kind: c.kind, companyName: nameOf.get(asNum(c.company_id)) ?? "", expiresAt: asIso(c.expires_at), used: Boolean(c.used_by) }));
    }
    return {
      ...base,
      people: list,
      absent,
      absentDays: ABSENT_DAYS,
      requests,
      codes,
      companies: level ? companies.map((c) => ({ id: asNum(c.id), name: c.name, color: c.color })) : [],
    };
  });

/** crea un codice monouso per nominare qualcuno */
export const createRoleCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { kind?: unknown; companyId?: unknown };
    // l'unico incarico che si dà con un codice è il presidente (nei dati: "capogruppo")
    if (raw.kind !== "capogruppo" && raw.kind !== "presidente") throw new Error("Scegli che incarico dare.");
    return { kind: "capogruppo" as const, companyId: raw.companyId == null ? null : asNum(raw.companyId) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { level } = await me(sql, context.userId);
    if (!level) throw new Error("Solo il fondatore nomina i presidenti.");
    const co = await sql<{ id: number }>`select id from companies where id = ${data.companyId ?? 0} limit 1`;
    if (!co[0]) throw new Error("Scegli la compagnia.");
    const prefix = "PRE";
    for (let i = 0; i < 5; i++) {
      const code = randomCode(prefix);
      try {
        await sql`
          insert into role_codes (code, kind, company_id, created_by, expires_at)
          values (${code}, ${data.kind}, ${data.companyId}, ${context.userId}, now() + interval '7 days')`;
        return { code };
      } catch {
        /* codice già usato: se ne prova un altro */
      }
    }
    throw new Error("Codice non creato, riprova.");
  });

/** usa un codice ricevuto: presidente di una compagnia, o invito in una compagnia */
export const redeemCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const code = clip((input as { code?: unknown })?.code, 24).toUpperCase().replace(/\s+/g, "");
    if (code.length < 6) throw new Error("Codice troppo corto.");
    return { code };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { row } = await me(sql, context.userId);
    // invito a una compagnia (da WhatsApp)
    const invite = await sql<{ company_id: number }>`select company_id from company_invites where code = ${data.code} limit 1`;
    if (invite[0]) {
      await moveTo(sql, context.userId, asNum(invite[0].company_id), "member");
      const co = await sql<{ name: string }>`select name from companies where id = ${invite[0].company_id} limit 1`;
      return { ok: true as const, message: `Sei entrato in ${co[0]?.name ?? "compagnia"}.` };
    }
    const found = await sql<{ code: string; kind: string; company_id: number | null; expires_at: unknown; used_by: string | null }>`
      select code, kind, company_id, expires_at, used_by from role_codes where code = ${data.code} limit 1`;
    const c = found[0];
    if (!c) throw new Error("Codice non trovato.");
    if (c.used_by) throw new Error("Codice già usato.");
    if (new Date(String(c.expires_at instanceof Date ? c.expires_at.toISOString() : c.expires_at)).getTime() < Date.now()) throw new Error("Codice scaduto: chiedine uno nuovo.");
    if (c.kind === "admin" || c.kind === "editor") throw new Error("Questo incarico non esiste più: ci sono solo presidente e allenatore.");
    const taken = await sql<{ code: string }>`update role_codes set used_by = ${context.userId}, used_at = now() where code = ${data.code} and used_by is null returning code`;
    if (!taken[0]) throw new Error("Codice già usato.");
    void row;
    await moveTo(sql, context.userId, asNum(c.company_id), "owner");
    return { ok: true as const, message: "Ora sei presidente della tua compagnia." };
  });

/** sposta una persona in una compagnia, con il ruolo indicato; chiude la vecchia se resta vuota */
async function moveTo(sql: Sql, userId: string, companyId: number, role: "owner" | "member") {
  const co = await sql<{ id: number }>`select id from companies where id = ${companyId} limit 1`;
  if (!co[0]) throw new Error("Compagnia non trovata.");
  const before = await myMembership(sql, userId);
  await sql`
    insert into company_members (user_id, company_id, role, chosen) values (${userId}, ${companyId}, ${role}, true)
    on conflict (user_id) do update set
      company_id = excluded.company_id,
      role = case when company_members.company_id = excluded.company_id and company_members.role = 'owner' then 'owner' else excluded.role end,
      chosen = true,
      joined_at = case when company_members.company_id = excluded.company_id then company_members.joined_at else now() end`;
  if (before.companyId !== companyId) await dropIfEmpty(sql, before.companyId);
}

/** un arciere chiede al fondatore di diventare presidente della sua compagnia */
export const requestLeader = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ note: clip((input as { note?: unknown })?.note, 300) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    if (mine.role === "owner") throw new Error("Sei già presidente.");
    const open = await sql<{ id: number }>`select id from role_requests where user_id = ${context.userId} and status = 'attesa' limit 1`;
    if (open[0]) throw new Error("Hai già una richiesta in attesa.");
    const made = await sql<{ id: number }>`
      insert into role_requests (user_id, kind, company_id, note) values (${context.userId}, 'capogruppo', ${mine.companyId}, ${data.note}) returning id`;
    const staff = await sql<{ user_id: string }>`select user_id from members where user_id is not null and role = 'admin' and is_super`;
    for (const s of staff) await notify(sql, s.user_id, "Nuova richiesta di presidente", data.note || "Un arciere chiede di guidare la sua compagnia.", "/staff", `req-${asNum(made[0]?.id)}-${s.user_id}`);
    return { ok: true as const };
  });

/** il fondatore accetta o rifiuta una richiesta */
export const decideRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { id?: unknown; ok?: unknown };
    return { id: asNum(raw.id), ok: raw.ok === true };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { level } = await me(sql, context.userId);
    if (!level) throw new Error("Solo il fondatore risponde alle richieste.");
    const rows = await sql<{ id: number; user_id: string; kind: string; company_id: number | null; status: string }>`
      select id, user_id, kind, company_id, status from role_requests where id = ${data.id} limit 1`;
    const r = rows[0];
    if (!r || r.status !== "attesa") throw new Error("Richiesta non più in attesa.");
    await sql`update role_requests set status = ${data.ok ? "ok" : "no"}, decided_by = ${context.userId}, decided_at = now() where id = ${r.id}`;
    if (data.ok && r.kind === "capogruppo" && r.company_id != null) await moveTo(sql, r.user_id, asNum(r.company_id), "owner");
    await notify(sql, r.user_id, data.ok ? "Richiesta accettata" : "Richiesta non accettata", data.ok ? "Ora sei presidente della tua compagnia." : "Per ora la richiesta non è stata accettata.", "/staff", `req-done-${r.id}`);
    return { ok: true as const };
  });

/**
 * Cambia l'incarico di una persona: presidente sì o no (solo il fondatore), allenatore sì o no
 * (il fondatore, o il presidente della compagnia di quella persona).
 */
export const setRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { memberId?: unknown; leader?: unknown; coach?: unknown };
    return {
      memberId: asNum(raw.memberId),
      leader: typeof raw.leader === "boolean" ? raw.leader : null,
      coach: typeof raw.coach === "boolean" ? raw.coach : null,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { level } = await me(sql, context.userId);
    const rows = await sql<MemberRow>`select * from members where id = ${data.memberId} limit 1`;
    const target = rows[0];
    if (!target?.user_id) throw new Error("Persona non trovata.");
    const mine = await myMembership(sql, context.userId);
    const theirs = await myMembership(sql, target.user_id);
    const presidentOfTheirs = mine.role === "owner" && mine.companyId === theirs.companyId;
    if (staffLevel(target) === "super" && level !== "super") throw new Error("Il fondatore non si può modificare.");
    if (data.leader != null && !level) throw new Error("Solo il fondatore nomina i presidenti.");
    if (data.coach != null && !level && !presidentOfTheirs) throw new Error("Gli allenatori li nomina il presidente della compagnia.");
    if (data.leader != null) {
      await sql`update company_members set role = ${data.leader ? "owner" : "member"} where user_id = ${target.user_id} and company_id = ${theirs.companyId}`;
    }
    if (data.coach != null) {
      await sql`update members set coach = ${data.coach} where id = ${target.id}`;
    }
    // chi riceve un incarico lo sa subito, con un avviso in Bacheca
    const what = data.leader ? "presidente" : data.coach ? "allenatore" : "";
    if (what && target.user_id !== context.userId) {
      await notify(sql, target.user_id, `Sei ${what}`, what === "allenatore" ? "Nel Menu trovi la scheda Allenatore: i tuoi allievi, le schede e i loro progressi." : "Nel Menu trovi Gestione compagnia: inviti, allenatori e iscritti.", what === "allenatore" ? "/istruttore" : "/staff", `role-${what}-${target.user_id}-${Date.now()}`);
    }
    return { ok: true as const };
  });

/** codice d'invito per la propria compagnia (o per una a scelta, se si è dello staff) */
export const companyInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ companyId: asNum((input as { companyId?: unknown })?.companyId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { row, level } = await me(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    const companyId = data.companyId || mine.companyId;
    const manager = mine.role === "owner" || asBool(row.coach);
    if (!level && !(manager && mine.companyId === companyId)) throw new Error("Invitano nella compagnia il presidente e gli allenatori, solo nella loro.");
    const old = await sql<{ code: string }>`select code from company_invites where company_id = ${companyId} and created_by = ${context.userId} order by created_at desc limit 1`;
    if (old[0]) return { code: old[0].code };
    for (let i = 0; i < 5; i++) {
      const code = randomCode("INV");
      try {
        await sql`insert into company_invites (code, company_id, created_by) values (${code}, ${companyId}, ${context.userId})`;
        return { code };
      } catch {
        /* riprova */
      }
    }
    throw new Error("Invito non creato, riprova.");
  });

/** il presidente o un allenatore (o il fondatore) toglie una persona dalla compagnia: torna in quella di Fabriano e potrà sceglierne un'altra */
export const removeFromCompany = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ memberId: asNum((input as { memberId?: unknown })?.memberId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { row: meRow, level } = await me(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    const rows = await sql<MemberRow>`select * from members where id = ${data.memberId} limit 1`;
    const target = rows[0];
    if (!target?.user_id) throw new Error("Persona non trovata.");
    if (target.user_id === context.userId) throw new Error("Per uscire scegli un'altra compagnia.");
    const theirs = await myMembership(sql, target.user_id);
    if (staffLevel(target) === "super") throw new Error("Il fondatore non si può togliere.");
    if (!level) {
      const president = mine.role === "owner";
      if (!president && !asBool(meRow.coach)) throw new Error("Tolgono persone dalla compagnia il presidente e gli allenatori.");
      if (theirs.companyId !== mine.companyId) throw new Error("Puoi gestire solo la tua compagnia.");
      if (!president && theirs.role === "owner") throw new Error("Un allenatore non toglie il presidente.");
    }
    const home = await homeId(sql);
    await sql`update company_members set company_id = ${home}, role = 'member', chosen = false, joined_at = now() where user_id = ${target.user_id}`;
    if (theirs.companyId !== home) await dropIfEmpty(sql, theirs.companyId);
    return { ok: true as const };
  });
