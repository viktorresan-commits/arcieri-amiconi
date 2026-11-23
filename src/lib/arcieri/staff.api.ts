/**
 * Squadra admin: ruoli e permessi.
 *
 * - Fondatore (is_super): ha le credenziali di amministratore. Nessuno lo può togliere né declassare.
 * - Amministratore: gestisce tutto, nomina editor e capigruppo; non tocca il fondatore né gli altri amministratori.
 * - Editor: segue le compagnie (le vede tutte, ne nomina i capigruppo, risponde alle richieste).
 * - Capogruppo: il titolare di una compagnia; invita persone (anche su WhatsApp) e gestisce solo la sua compagnia.
 * - Istruttore: segue gli atleti della sua compagnia e la segreteria; lo nominano lo staff o il capogruppo.
 *
 * Gli incarichi si danno con codici monouso (validi 7 giorni) o approvando una richiesta.
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

/** tutto quello che serve alla pagina Squadra admin, in base a chi la apre */
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
      me: { memberId: asNum(row.id), level, leader: mine.role === "owner", coach: asBool(row.coach), companyId: mine.companyId, companyName: company[0]?.name ?? "", companyColor: company[0]?.color ?? "#1f7a46" },
      myRequests: myRequests.map((r) => ({ id: asNum(r.id), kind: r.kind, status: r.status, createdAt: asIso(r.created_at) })),
    };

    // il capogruppo vede la sua compagnia; lo staff le vede tutte
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
    const visible = level ? people : mine.role === "owner" ? people.filter((p) => asNum(p.company_id ?? home) === mine.companyId) : [];
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
    const kind = (["admin", "editor", "capogruppo"] as const).find((k) => k === raw.kind);
    if (!kind) throw new Error("Scegli che incarico dare.");
    return { kind, companyId: raw.companyId == null ? null : asNum(raw.companyId) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { level } = await me(sql, context.userId);
    if (data.kind === "admin" && level !== "super") throw new Error("Solo il fondatore nomina altri amministratori.");
    if (data.kind === "editor" && level !== "super" && level !== "admin") throw new Error("Solo un amministratore nomina gli editor.");
    if (data.kind === "capogruppo" && !level) throw new Error("Solo lo staff nomina i capigruppo.");
    if (data.kind === "capogruppo") {
      const co = await sql<{ id: number }>`select id from companies where id = ${data.companyId ?? 0} limit 1`;
      if (!co[0]) throw new Error("Scegli la compagnia.");
    }
    const prefix = data.kind === "admin" ? "ADM" : data.kind === "editor" ? "EDT" : "CAP";
    for (let i = 0; i < 5; i++) {
      const code = randomCode(prefix);
      try {
        await sql`
          insert into role_codes (code, kind, company_id, created_by, expires_at)
          values (${code}, ${data.kind}, ${data.kind === "capogruppo" ? data.companyId : null}, ${context.userId}, now() + interval '7 days')`;
        return { code };
      } catch {
        /* codice già usato: se ne prova un altro */
      }
    }
    throw new Error("Codice non creato, riprova.");
  });

/** usa un codice ricevuto: incarico nello staff, capogruppo, o invito in una compagnia */
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
    const taken = await sql<{ code: string }>`update role_codes set used_by = ${context.userId}, used_at = now() where code = ${data.code} and used_by is null returning code`;
    if (!taken[0]) throw new Error("Codice già usato.");
    if (c.kind === "admin") {
      await sql`update members set role = 'admin' where id = ${row.id}`;
      return { ok: true as const, message: "Ora sei amministratore." };
    }
    if (c.kind === "editor") {
      await sql`update members set staff = 'editor' where id = ${row.id}`;
      return { ok: true as const, message: "Ora sei admin: segui le compagnie." };
    }
    await moveTo(sql, context.userId, asNum(c.company_id), "owner");
    return { ok: true as const, message: "Ora sei capogruppo della tua compagnia." };
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

/** un arciere chiede allo staff di diventare capogruppo della sua compagnia */
export const requestLeader = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ note: clip((input as { note?: unknown })?.note, 300) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    if (mine.role === "owner") throw new Error("Sei già capogruppo.");
    const open = await sql<{ id: number }>`select id from role_requests where user_id = ${context.userId} and status = 'attesa' limit 1`;
    if (open[0]) throw new Error("Hai già una richiesta in attesa.");
    const made = await sql<{ id: number }>`
      insert into role_requests (user_id, kind, company_id, note) values (${context.userId}, 'capogruppo', ${mine.companyId}, ${data.note}) returning id`;
    const staff = await sql<{ user_id: string }>`select user_id from members where user_id is not null and (role = 'admin' or staff = 'editor')`;
    for (const s of staff) await notify(sql, s.user_id, "Nuova richiesta di capogruppo", data.note || "Un arciere chiede di guidare la sua compagnia.", "/staff", `req-${asNum(made[0]?.id)}-${s.user_id}`);
    return { ok: true as const };
  });

/** lo staff accetta o rifiuta una richiesta */
export const decideRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { id?: unknown; ok?: unknown };
    return { id: asNum(raw.id), ok: raw.ok === true };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { level } = await me(sql, context.userId);
    if (!level) throw new Error("Solo lo staff risponde alle richieste.");
    const rows = await sql<{ id: number; user_id: string; kind: string; company_id: number | null; status: string }>`
      select id, user_id, kind, company_id, status from role_requests where id = ${data.id} limit 1`;
    const r = rows[0];
    if (!r || r.status !== "attesa") throw new Error("Richiesta non più in attesa.");
    await sql`update role_requests set status = ${data.ok ? "ok" : "no"}, decided_by = ${context.userId}, decided_at = now() where id = ${r.id}`;
    if (data.ok && r.kind === "capogruppo" && r.company_id != null) await moveTo(sql, r.user_id, asNum(r.company_id), "owner");
    await notify(sql, r.user_id, data.ok ? "Richiesta accettata" : "Richiesta non accettata", data.ok ? "Ora sei capogruppo della tua compagnia." : "Lo staff per ora non ha accettato la richiesta.", "/staff", `req-done-${r.id}`);
    return { ok: true as const };
  });

/**
 * cambia l'incarico di una persona: amministratore, admin (editor), nessuno; capogruppo sì o no; istruttore sì o no.
 * Il fondatore può tutto; il capogruppo può solo nominare o togliere gli istruttori della sua compagnia.
 */
export const setRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { memberId?: unknown; to?: unknown; leader?: unknown; coach?: unknown };
    const to = (["admin", "editor", "none"] as const).find((k) => k === raw.to);
    return {
      memberId: asNum(raw.memberId),
      to: to ?? null,
      leader: typeof raw.leader === "boolean" ? raw.leader : null,
      coach: typeof raw.coach === "boolean" ? raw.coach : null,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { row: meRow, level } = await me(sql, context.userId);
    const rows = await sql<MemberRow>`select * from members where id = ${data.memberId} limit 1`;
    const target = rows[0];
    if (!target?.user_id) throw new Error("Persona non trovata.");
    const targetLevel = staffLevel(target);
    const mine = await myMembership(sql, context.userId);
    const theirs = await myMembership(sql, target.user_id);
    const leaderOfTheirs = mine.role === "owner" && mine.companyId === theirs.companyId;
    if (!level && !(leaderOfTheirs && data.coach != null && data.to == null && data.leader == null)) {
      throw new Error(leaderOfTheirs ? "Il capogruppo nomina solo gli istruttori." : "Solo lo staff cambia gli incarichi.");
    }
    if (targetLevel === "super" && level !== "super") throw new Error("Il fondatore non si può modificare.");
    if (targetLevel === "admin" && level !== "super" && (data.to || data.leader != null)) throw new Error("Solo il fondatore cambia un amministratore.");
    if (data.to && asNum(target.id) === asNum(meRow.id)) throw new Error("Non puoi cambiare il tuo incarico da qui.");
    if (data.to) {
      if (data.to === "admin" && level !== "super") throw new Error("Solo il fondatore nomina amministratori.");
      if (data.to === "editor" && level === "editor") throw new Error("Solo un amministratore nomina gli admin.");
      if (data.to === "none" && level === "editor" && targetLevel !== null) throw new Error("Un admin non toglie incarichi allo staff.");
      await sql`
        update members set
          role = ${data.to === "admin" ? "admin" : target.role === "admin" ? "archer" : target.role},
          staff = ${data.to === "editor" ? "editor" : ""}
        where id = ${target.id}`;
    }
    if (data.leader != null) {
      await sql`update company_members set role = ${data.leader ? "owner" : "member"} where user_id = ${target.user_id} and company_id = ${theirs.companyId}`;
    }
    if (data.coach != null) {
      await sql`update members set coach = ${data.coach} where id = ${target.id}`;
    }
    // chi riceve un incarico lo sa subito, con un avviso in Bacheca
    const what = data.to === "admin" ? "amministratore" : data.to === "editor" ? "admin" : data.leader ? "capogruppo" : data.coach ? "istruttore" : "";
    if (what && target.user_id !== context.userId) {
      await notify(sql, target.user_id, `Sei ${what}`, what === "istruttore" ? "Nel Menu trovi «I miei atleti» e la Segreteria." : "Nel Menu trovi la Squadra admin.", what === "istruttore" ? "/istruttore" : "/staff", `role-${what}-${target.user_id}-${Date.now()}`);
    }
    return { ok: true as const };
  });

/** codice d'invito per la propria compagnia (o per una a scelta, se si è dello staff) */
export const companyInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ companyId: asNum((input as { companyId?: unknown })?.companyId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { level } = await me(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    const companyId = data.companyId || mine.companyId;
    if (!level && !(mine.role === "owner" && mine.companyId === companyId)) throw new Error("Solo il capogruppo invita nella sua compagnia.");
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

/** il capogruppo (o lo staff) toglie una persona dalla compagnia: torna in quella di Fabriano e potrà sceglierne un'altra */
export const removeFromCompany = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ memberId: asNum((input as { memberId?: unknown })?.memberId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { level } = await me(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    const rows = await sql<MemberRow>`select * from members where id = ${data.memberId} limit 1`;
    const target = rows[0];
    if (!target?.user_id) throw new Error("Persona non trovata.");
    if (target.user_id === context.userId) throw new Error("Per uscire scegli un'altra compagnia.");
    const theirs = await myMembership(sql, target.user_id);
    if (!level) {
      if (mine.role !== "owner" || theirs.companyId !== mine.companyId) throw new Error("Puoi gestire solo la tua compagnia.");
      if (staffLevel(target)) throw new Error("Non puoi togliere un membro dello staff.");
    } else if (staffLevel(target) === "super" || (staffLevel(target) === "admin" && level !== "super")) {
      throw new Error("Non puoi spostare questo amministratore.");
    }
    const home = await homeId(sql);
    await sql`update company_members set company_id = ${home}, role = 'member', chosen = false, joined_at = now() where user_id = ${target.user_id}`;
    if (theirs.companyId !== home) await dropIfEmpty(sql, theirs.companyId);
    return { ok: true as const };
  });
