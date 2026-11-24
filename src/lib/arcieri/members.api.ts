import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { publishNews } from "./news";
import { myMembership } from "./compagnie.api";
import {
  asNum,
  canScore,
  categorySingular,
  cleanPhoto,
  clip,
  db,
  ensureMember,
  jsonSafe,
  staffLevel,
  toMember,
  type MemberRow,
  type PublicMember,
  type Role,
} from "./access";

const ROLES: Role[] = ["admin", "archer", "viewer"];

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PublicMember> => {
    const sql = await db();
    const row = await ensureMember(sql, context.userId);
    const email = await sql<{ email: string }>`select email from "user" where id = ${context.userId} limit 1`;
    const out = toMember(row, true, email[0]?.email ?? null);
    const staff = staffLevel(row);
    const mine = await myMembership(sql, context.userId);
    const leader = mine.role === "owner";
    // percorso essenziale: solo per chi ha scelto un percorso al primo accesso, finché non ha 5 allenamenti
    let essenziale = false;
    if (["principiante", "compagnia", "istruttore"].includes(out.percorso)) {
      const n = await sql<{ n: number }>`select count(*)::int as n from sessions where user_id = ${context.userId}`;
      essenziale = asNum(n[0]?.n) < 5;
    }
    // squadra admin, allenatori e segreteria: solo per chi ha un incarico
    const role = staff != null || leader || out.coach;
    // categoria: solo quella dichiarata nell'ultima gara, mai dedotta da altro
    const cat = await sql<{ category: string; starts_on: string }>`
      select e.category, c.starts_on::text as starts_on
      from competition_entries e join competitions c on c.id = e.competition_id
      where e.user_id = ${context.userId}`;
    const last = cat.filter((r) => r.category.trim()).sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0];
    // schede di allenamento ricevute da un allenatore: la voce «Le mie schede» compare solo se ce n'è almeno una
    let hasPlans = false;
    try {
      const n = await sql<{ n: number }>`select count(*)::int as n from coach_plans where athlete_user_id = ${context.userId}`;
      hasPlans = asNum(n[0]?.n) > 0;
    } catch {
      /* tabella non ancora creata */
    }
    return { ...out, essenziale, leader, canStaff: role, canCoach: role, canSegreteria: role, hasPlans, category: last ? categorySingular(last.category) : "" };
  });

export const listRoster = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const missing = await sql<{ id: string }>`
      select u.id from "user" u
      left join members m on m.user_id = u.id
      where m.id is null`;
    for (const person of missing) await ensureMember(sql, person.id);
    const rows = await sql<(MemberRow & { user_image: string | null })>`
      select m.*, u.image as user_image
      from members m
      join "user" u on u.id = m.user_id
      order by m.given_name, m.id`;
    const accounts = await sql<{ userId: string; providerId: string }>`select "userId", "providerId" from account`;
    const byUser = new Map<string, string[]>();
    for (const account of accounts) {
      const list = byUser.get(account.userId) ?? [];
      list.push(account.providerId);
      byUser.set(account.userId, list);
    }
    return rows.map((row) => {
      const member = toMember(row, false);
      const remote = row.user_image && /^https:\/\//.test(row.user_image) ? row.user_image : null;
      return { ...member, photoUrl: member.photoUrl || remote, access: accessLabel(byUser.get(row.user_id ?? "") ?? []) };
    });
  });

function accessLabel(providers: string[]) {
  const ids = providers.map((id) => id.toLowerCase());
  if (ids.some((id) => id.includes("google"))) return "Google";
  if (ids.some((id) => id === "x" || id.includes("twitter"))) return "X";
  if (ids.some((id) => id.includes("credential") || id.includes("email"))) return "Email";
  return ids.length ? "Account" : "";
}

export const claimRoster = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const code = clip((input as { code?: string })?.code, 20).toUpperCase();
    if (code.length < 4) throw new Error("Codice troppo corto.");
    return { code };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const shell = await ensureMember(sql, context.userId);
    const target = await sql<MemberRow>`select * from members where upper(claim_code) = ${data.code} limit 1`;
    if (!target[0]) throw new Error("Codice non trovato.");
    if (target[0].user_id && target[0].user_id !== context.userId) throw new Error("Questo nome è già stato preso.");
    if (target[0].id === shell.id) return toMember(shell, true);
    const role = shell.role === "admin" ? "admin" : target[0].role;
    await sql`update members set user_id = null where id = ${shell.id}`;
    await sql`
      update members set
        user_id = ${context.userId},
        role = ${role},
        status = 'active',
        photo_url = coalesce(photo_url, ${shell.photo_url}),
        bow_type = case when bow_type = '' then ${shell.bow_type} else bow_type end
      where id = ${target[0].id}`;
    await sql`delete from members where id = ${shell.id} and id <> ${target[0].id}`;
    const next = await sql<MemberRow>`select * from members where id = ${target[0].id} limit 1`;
    return toMember(next[0], true);
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const role = raw.role == null ? undefined : clip(raw.role, 20);
    if (role && !ROLES.includes(role as Role)) throw new Error("Ruolo non valido.");
    const joined = raw.joinedOn == null ? undefined : clip(raw.joinedOn, 10);
    if (joined && !/^\d{4}-\d{2}-\d{2}$/.test(joined)) throw new Error("Data non valida.");
    return {
      memberId: raw.memberId == null ? undefined : asNum(raw.memberId),
      givenName: raw.givenName == null ? undefined : clip(raw.givenName, 40),
      familyName: raw.familyName == null ? undefined : clip(raw.familyName, 40),
      nickname: raw.nickname == null ? undefined : clip(raw.nickname, 40),
      bowType: raw.bowType == null ? undefined : clip(raw.bowType, 40),
      bio: raw.bio == null ? undefined : clip(raw.bio, 500),
      photoUrl: raw.photoUrl === undefined ? undefined : cleanPhoto(raw.photoUrl),
      joinedOn: joined,
      role: role as Role | undefined,
      notifyBoard: raw.notifyBoard == null ? undefined : Boolean(raw.notifyBoard),
      notifyChallenges: raw.notifyChallenges == null ? undefined : Boolean(raw.notifyChallenges),
      notifyGoals: raw.notifyGoals == null ? undefined : Boolean(raw.notifyGoals),
      notifyComps: raw.notifyComps == null ? undefined : Boolean(raw.notifyComps),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const targetId = data.memberId ?? me.id;
    if (targetId !== me.id && me.role !== "admin") throw new Error("Solo il fondatore modifica gli altri profili.");
    const rows = await sql<MemberRow>`select * from members where id = ${targetId} limit 1`;
    const row = rows[0];
    if (!row) throw new Error("Profilo assente.");
    if (data.role && data.role !== row.role && me.role !== "admin") throw new Error("Non puoi cambiare il ruolo.");
    if (data.role && data.role !== row.role && row.is_super && row.id !== me.id) throw new Error("Il ruolo del fondatore non si può cambiare.");
    if (data.role && data.role !== row.role && (data.role === "admin" || row.role === "admin")) throw new Error("Il fondatore è uno solo: gli incarichi sono presidente e allenatore, in Gestione compagnia.");
    if (data.role && data.role !== "admin" && row.role === "admin") {
      const left = await sql<{ n: number }>`
        select count(*)::int as n from members
        where role = 'admin' and user_id is not null and id <> ${row.id}`;
      if (asNum(left[0]?.n) < 1) throw new Error("Deve restare almeno un amministratore.");
    }
    const given = data.givenName === undefined ? row.given_name : data.givenName || row.given_name;
    const saved = await sql<MemberRow>`
      update members set
        given_name = ${given},
        family_name = ${data.familyName === undefined ? row.family_name : data.familyName},
        nickname = ${data.nickname === undefined ? row.nickname : data.nickname},
        bow_type = ${data.bowType === undefined ? row.bow_type : data.bowType},
        bio = ${data.bio === undefined ? row.bio : data.bio},
        photo_url = ${data.photoUrl === undefined ? row.photo_url : data.photoUrl},
        joined_on = ${data.joinedOn === undefined ? row.joined_on : data.joinedOn}::date,
        role = ${data.role === undefined ? row.role : data.role},
        notify_board = ${data.notifyBoard === undefined ? row.notify_board : data.notifyBoard},
        notify_challenges = ${data.notifyChallenges === undefined ? row.notify_challenges : data.notifyChallenges},
        notify_goals = ${data.notifyGoals === undefined ? row.notify_goals : data.notifyGoals},
        notify_comps = ${data.notifyComps === undefined ? row.notify_comps : data.notifyComps}
      where id = ${row.id}
      returning *`;
    return toMember(saved[0], me.role === "admin" || saved[0].user_id === context.userId);
  });

export const regenerateCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const id = asNum((input as { id?: number })?.id);
    if (!id) throw new Error("Profilo assente.");
    return { id };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (me.role !== "admin") throw new Error("Solo il fondatore rigenera i codici.");
    const code = `AM${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const rows = await sql<MemberRow>`
      update members set claim_code = ${code}
      where id = ${data.id} and user_id is null
      returning *`;
    if (!rows[0]) throw new Error("Il codice si cambia solo su un nome non ancora rivendicato.");
    return toMember(rows[0], true);
  });

export const requestPasswordHelp = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const email = clip((input as { email?: string })?.email, 180).toLowerCase();
    if (!email.includes("@")) throw new Error("Email non valida.");
    return { email };
  })
  .handler(async ({ data }) => {
    const sql = await db();
    const users = await sql<{ id: string }>`select id from "user" where lower(email) = ${data.email} limit 1`;
    if (users[0]) await sql`insert into password_requests (email) values (${data.email})`;
    return { ok: true as const };
  });

export const listRecovery = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (me.role !== "admin") return [];
    const rows = await sql<{ id: number; email: string; status: string; created_at: unknown }>`
      select id, email, status, created_at from password_requests
      where status = 'open' order by id desc limit 30`;
    return rows.map((r) => ({
      id: asNum(r.id),
      email: r.email,
      status: r.status,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ""),
    }));
  });

export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const email = clip((input as { email?: string })?.email, 180).toLowerCase();
    const password = String((input as { password?: string })?.password ?? "");
    if (!email.includes("@")) throw new Error("Email non valida.");
    if (password.length < 8 || password.length > 128) throw new Error("La password deve avere almeno 8 caratteri.");
    return { email, password };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (me.role !== "admin") throw new Error("Solo il fondatore reimposta le password.");
    const users = await sql<{ id: string }>`select id from "user" where lower(email) = ${data.email} limit 1`;
    if (!users[0]) throw new Error("Nessun account con questa email.");
    const { hashPassword } = await import("@better-auth/utils/password");
    const hash = await hashPassword(data.password);
    const accounts = await sql<{ id: string }>`
      select id from account where "userId" = ${users[0].id} and "providerId" = 'credential' limit 1`;
    if (accounts[0]) {
      await sql`update account set password = ${hash}, "updatedAt" = now() where id = ${accounts[0].id}`;
    } else {
      const id = crypto.randomUUID();
      await sql`
        insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
        values (${id}, ${users[0].id}, 'credential', ${users[0].id}, ${hash}, now(), now())`;
    }
    await sql`update password_requests set status = 'done' where lower(email) = ${data.email} and status = 'open'`;
    await sql`
      insert into notifications (user_id, title, body, href, dedupe)
      values (${users[0].id}, ${"Password aggiornata"}, ${"Il fondatore ha impostato una password nuova. Cambiala dal profilo."}, ${"/profilo"}, ${"pw-" + users[0].id + "-" + Date.now()})`;
    return { ok: true as const };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    try {
      await publishNews(sql, context.userId);
    } catch {
      /* la bacheca resta leggibile anche se un avviso non si scrive */
    }
    const rows = await sql<{
      id: number;
      title: string;
      body: string;
      href: string;
      read_at: unknown;
      created_at: unknown;
    }>`
      select id, title, body, href, read_at, created_at
      from notifications where user_id = ${context.userId} and cleared_at is null
      order by id desc limit 40`;
    return {
      unread: rows.filter((r) => !r.read_at).length,
      items: rows.map((r) => ({
        id: asNum(r.id),
        title: r.title,
        body: r.body,
        href: r.href,
        read: Boolean(r.read_at),
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ""),
      })),
    };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await sql`update notifications set read_at = now() where user_id = ${context.userId} and read_at is null`;
    return { ok: true as const };
  });

/** toglie dalla Bacheca gli avvisi già letti (restano registrati, così non ricompaiono) */
export const clearReadNotifications = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<{ id: number }>`update notifications set cleared_at = now() where user_id = ${context.userId} and read_at is not null and cleared_at is null returning id`;
    return { removed: rows.length };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<{
      id: number;
      user_id: string;
      body: string;
      created_at: unknown;
      given_name: string;
      family_name: string;
      nickname: string;
      slug: string;
      avatar_color: string;
    }>`
      select m.id, m.user_id, m.body, m.created_at,
        coalesce(p.given_name, 'Arciere') as given_name,
        coalesce(p.family_name, '') as family_name,
        coalesce(p.nickname, '') as nickname,
        coalesce(p.slug, '') as slug,
        coalesce(p.avatar_color, '#1f5c38') as avatar_color
      from messages m
      left join members p on p.user_id = m.user_id
      order by m.id desc limit 60`;
    return rows.map((r) => ({
      id: asNum(r.id),
      userId: r.user_id,
      body: r.body,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ""),
      givenName: r.given_name,
      familyName: r.family_name,
      nickname: r.nickname,
      slug: r.slug,
      avatarColor: r.avatar_color,
      mine: r.user_id === context.userId,
    }));
  });

export const postMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = clip((input as { body?: string })?.body, 600);
    if (body.length < 2) throw new Error("Scrivi qualcosa.");
    return { body };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Il visualizzatore legge la bacheca, non pubblica.");
    if (me.notify_board === false) {
      /* still allowed to post; the flag only limits incoming noise */
    }
    await sql`insert into messages (user_id, body) values (${context.userId}, ${data.body})`;
    return { ok: true as const };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: number })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const rows = await sql`delete from messages where id = ${data.id} and (${me.role === "admin"} or user_id = ${context.userId}) returning id`;
    if (!rows[0]) throw new Error("Messaggio non trovato.");
    return { ok: true as const };
  });

export const exportMine = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const sessions = await sql`select * from sessions where user_id = ${context.userId} order by started_at`;
    const shots = await sql`
      select sh.* from shots sh
      join sessions s on s.id = sh.session_id
      where s.user_id = ${context.userId}
      order by sh.session_id, sh.block_index, sh.end_index, sh.arrow_index`;
    const equipment = await sql`select id, category, name, brand, model, purchased_on, price_cents, shop, notes, status, specs, visibility from equipment where user_id = ${context.userId} order by id`;
    const setups = await sql`select * from setups where user_id = ${context.userId} order by id`;
    return { json: JSON.stringify(jsonSafe({
      exportedAt: new Date().toISOString(),
      profile: toMember(me, false, null),
      sessions,
      shots,
      equipment,
      setups,
    }), null, 2) };
  });
