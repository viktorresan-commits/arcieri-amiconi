/**
 * Compagnie di arcieri: ognuno fa parte di una sola compagnia (di base quella di
 * Fabriano), può fondarne una nuova o passare a un'altra. La classifica mette a
 * confronto le compagnie per iscritti, frecce, punti e gare.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { asNum, cleanPhoto, clip, db, ensureMember, staffLevel } from "./access";
import { fitastPointsBy } from "./fitast-league.api";
import { teamKey } from "./fitast-league";

export const HOME_SLUG = "fabriano";

type CompanyRow = {
  id: number; slug: string; name: string; motto: string; city: string; bio: string; logo_url: string | null; color: string;
  phone: string; whatsapp: string; email: string; website: string; instagram: string; facebook: string; youtube: string; tiktok: string;
  address: string; created_by: string | null; created_at: unknown; fitast_name?: string | null; source?: string | null;
};

const LINK_FIELDS = ["phone", "whatsapp", "email", "website", "instagram", "facebook", "youtube", "tiktok", "address"] as const;
type LinkField = (typeof LINK_FIELDS)[number];

function toCompany(row: CompanyRow) {
  return {
    id: asNum(row.id),
    slug: row.slug,
    name: row.name,
    motto: row.motto,
    city: row.city,
    bio: row.bio,
    logoUrl: row.logo_url,
    color: row.color,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    website: row.website,
    instagram: row.instagram,
    facebook: row.facebook,
    youtube: row.youtube,
    tiktok: row.tiktok,
    address: row.address,
    /** preparata dall'elenco del portale FITAST */
    fitast: row.source === "fitast",
    fitastName: row.fitast_name ?? "",
  };
}

export type Company = ReturnType<typeof toCompany>;

export async function homeId(sql: Sql) {
  const rows = await sql<{ id: number }>`select id from companies where slug = ${HOME_SLUG} limit 1`;
  if (rows[0]) return asNum(rows[0].id);
  const made = await sql<{ id: number }>`
    insert into companies (slug, name, motto, city, logo_url, color)
    values (${HOME_SLUG}, 'Compagnia degli Arcieri di Fabriano', 'In animo iuncti', 'Fabriano', '/compagnie/fabriano-stemma.png', '#1f7a46')
    on conflict (slug) do update set slug = excluded.slug
    returning id`;
  return asNum(made[0]?.id);
}

/** la compagnia della persona: se non ne ha scelta una, entra in quella di Fabriano */
export async function myMembership(sql: Sql, userId: string) {
  const rows = await sql<{ company_id: number; role: string; chosen: boolean }>`select company_id, role, chosen from company_members where user_id = ${userId} limit 1`;
  if (rows[0]) return { companyId: asNum(rows[0].company_id), role: rows[0].role as "owner" | "member", chosen: Boolean(rows[0].chosen) };
  const home = await homeId(sql);
  await sql`insert into company_members (user_id, company_id, chosen) values (${userId}, ${home}, false) on conflict (user_id) do nothing`;
  return { companyId: home, role: "member" as const, chosen: false };
}

/** id degli utenti che stanno nella stessa compagnia di userId */
export async function companyPeers(sql: Sql, userId: string) {
  const mine = await myMembership(sql, userId);
  const home = await homeId(sql);
  const rows = await sql<{ user_id: string }>`
    select m.user_id
    from members m
    left join company_members cm on cm.user_id = m.user_id
    where m.user_id is not null and coalesce(cm.company_id, ${home}) = ${mine.companyId}`;
  return new Set(rows.map((row) => row.user_id));
}

function slugOf(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "compagnia";
}

function cleanLink(field: LinkField, value: unknown) {
  const raw = clip(value, 160);
  if (!raw) return "";
  if (field === "phone" || field === "whatsapp") {
    const digits = raw.replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length < 6) throw new Error("Numero di telefono troppo corto.");
    return digits.slice(0, 20);
  }
  if (field === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw new Error("Email non valida.");
    return raw.toLowerCase();
  }
  if (field === "address") return raw;
  // social e sito: si accetta il nome utente o un link https
  if (/^https?:\/\//i.test(raw)) return raw.replace(/^http:/i, "https:");
  return raw.replace(/^@/, "").replace(/[^\w.\-/]/g, "");
}

function cleanColor(value: unknown) {
  const raw = clip(value, 9);
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : "#1f7a46";
}

function readFields(raw: Record<string, unknown>) {
  const name = clip(raw.name, 70);
  if (name.length < 3) throw new Error("Il nome della compagnia è troppo corto.");
  const out: Record<string, string> = {
    name,
    motto: clip(raw.motto, 80),
    city: clip(raw.city, 50),
    bio: clip(raw.bio, 500),
    color: cleanColor(raw.color),
  };
  for (const field of LINK_FIELDS) out[field] = cleanLink(field, raw[field]);
  const logo = raw.logoUrl === undefined ? undefined : raw.logoUrl === null || raw.logoUrl === "" ? null : String(raw.logoUrl).startsWith("/compagnie/") ? clip(raw.logoUrl, 80) : cleanPhoto(raw.logoUrl);
  return { fields: out, logo };
}

/** tutte le compagnie con i loro numeri, più la mia */
export const listCompanies = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    const home = await homeId(sql);
    const companies = await sql<CompanyRow>`select * from companies order by id`;
    const people = await sql<{ user_id: string; company_id: number; role: string | null; given_name: string; family_name: string; nickname: string; avatar_color: string; photo_url: string | null; member_id: number }>`
      select m.user_id, coalesce(cm.company_id, ${home}) as company_id, cm.role, m.given_name, m.family_name, m.nickname, m.avatar_color, m.photo_url, m.id as member_id
      from members m
      join "user" u on u.id = m.user_id
      left join company_members cm on cm.user_id = m.user_id
      where m.user_id is not null`;
    const train = await sql<{ user_id: string; sessions: number; arrows: number; points: number }>`
      select s.user_id, count(distinct s.id) as sessions, count(sh.id) as arrows, coalesce(sum(sh.score), 0) as points
      from sessions s
      left join shots sh on sh.session_id = s.id
      group by s.user_id`;
    const comps = await sql<{ user_id: string; gare: number; points: number }>`
      select user_id, count(distinct competition_id) as gare, coalesce(sum(score), 0) as points
      from competition_entries
      where score is not null
      group by user_id`;
    // punti del campionato FITAST (classifica generale squadre letta dal portale), per nome della compagnia
    const fitastPts = await fitastPointsBy(sql).catch(() => new Map<string, { points: number; place: number | null; season: string }>());
    const trainOf = new Map(train.map((row) => [row.user_id, row]));
    const compOf = new Map(comps.map((row) => [row.user_id, row]));
    const board = companies.map((row) => {
      const id = asNum(row.id);
      const crew = people.filter((p) => asNum(p.company_id) === id);
      let arrows = 0;
      let trainPoints = 0;
      let sessions = 0;
      let gare = 0;
      let gareRaw = 0;
      for (const p of crew) {
        const t = trainOf.get(p.user_id);
        const c = compOf.get(p.user_id);
        arrows += asNum(t?.arrows);
        trainPoints += asNum(t?.points);
        sessions += asNum(t?.sessions);
        gare += asNum(c?.gare);
        gareRaw += asNum(c?.points);
      }
      const fp = fitastPts.get(teamKey(row.fitast_name || "")) ?? fitastPts.get(teamKey(row.name));
      return {
        ...toCompany(row),
        fitastPoints: fp ? fp.points : null,
        fitastPlace: fp ? fp.place : null,
        fitastSeason: fp ? fp.season : "",
        members: crew.length,
        arrows,
        sessions,
        gare,
        points: trainPoints + gareRaw,
        avg: arrows > 0 ? trainPoints / arrows : null,
        owner: crew.find((p) => p.role === "owner")?.user_id ?? null,
        // gli iscritti delle altre compagnie li vede solo lo staff (amministratori ed editor)
        crew: (id === mine.companyId || staffLevel(me) ? crew : []).map((p) => ({
          userId: p.user_id,
          memberId: asNum(p.member_id),
          givenName: p.given_name,
          familyName: p.family_name,
          nickname: p.nickname,
          avatarColor: p.avatar_color,
          photoUrl: p.photo_url,
          owner: p.role === "owner",
          arrows: asNum(trainOf.get(p.user_id)?.arrows),
        })),
      };
    });
    const current = board.find((c) => c.id === mine.companyId) ?? board[0];
    const staff = staffLevel(me);
    const canEdit = mine.role === "owner" || staff != null || (me.role === "admin" && current?.owner == null);
    return { companies: board, mine: mine.companyId, myRole: mine.role, canEdit, homeId: home, isAdmin: staff != null, staff, chosen: mine.chosen };
  });

export const createCompany = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => readFields((input ?? {}) as Record<string, unknown>))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    if (mine.role === "owner") {
      const others = await sql<{ n: number }>`select count(*)::int as n from company_members where company_id = ${mine.companyId} and user_id <> ${context.userId}`;
      if (asNum(others[0]?.n) > 0) throw new Error("Sei il fondatore della tua compagnia: prima passa il ruolo a un altro iscritto o restate soli.");
    }
    const taken = await sql<{ id: number }>`select id from companies where lower(name) = lower(${data.fields.name}) limit 1`;
    if (taken[0]) throw new Error("Esiste già una compagnia con questo nome.");
    const base = slugOf(data.fields.name);
    let slug = base;
    for (let i = 2; i < 50; i += 1) {
      const clash = await sql<{ id: number }>`select id from companies where slug = ${slug} limit 1`;
      if (!clash[0]) break;
      slug = `${base}-${i}`;
    }
    const f = data.fields;
    const made = await sql<{ id: number }>`
      insert into companies (slug, name, motto, city, bio, logo_url, color, phone, whatsapp, email, website, instagram, facebook, youtube, tiktok, address, created_by)
      values (${slug}, ${f.name}, ${f.motto}, ${f.city}, ${f.bio}, ${data.logo ?? null}, ${f.color}, ${f.phone}, ${f.whatsapp}, ${f.email}, ${f.website}, ${f.instagram}, ${f.facebook}, ${f.youtube}, ${f.tiktok}, ${f.address}, ${context.userId})
      returning id`;
    const id = asNum(made[0]?.id);
    const old = mine.companyId;
    await sql`
      insert into company_members (user_id, company_id, role, chosen) values (${context.userId}, ${id}, 'owner', true)
      on conflict (user_id) do update set company_id = excluded.company_id, role = 'owner', chosen = true, joined_at = now()`;
    await dropIfEmpty(sql, old);
    return { id, slug };
  });

export const updateCompany = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    return { id: asNum(raw.id), ...readFields(raw) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    // lo staff (amministratori ed editor) segue tutte le compagnie; il presidente solo la sua
    const staff = staffLevel(me);
    if (!staff && mine.companyId !== data.id) throw new Error("Puoi modificare solo la tua compagnia.");
    const owners = await sql<{ user_id: string }>`select user_id from company_members where company_id = ${data.id} and role = 'owner'`;
    const allowed = staff != null || (mine.role === "owner" && mine.companyId === data.id) || (me.role === "admin" && owners.length === 0);
    if (!allowed) throw new Error("Solo il presidente della compagnia o lo staff possono modificarla.");
    const clash = await sql<{ id: number }>`select id from companies where lower(name) = lower(${data.fields.name}) and id <> ${data.id} limit 1`;
    if (clash[0]) throw new Error("Esiste già una compagnia con questo nome.");
    const f = data.fields;
    await sql`
      update companies set
        name = ${f.name}, motto = ${f.motto}, city = ${f.city}, bio = ${f.bio}, color = ${f.color},
        phone = ${f.phone}, whatsapp = ${f.whatsapp}, email = ${f.email}, website = ${f.website},
        instagram = ${f.instagram}, facebook = ${f.facebook}, youtube = ${f.youtube}, tiktok = ${f.tiktok}, address = ${f.address},
        logo_url = case when ${data.logo === undefined} then logo_url else ${data.logo ?? null} end
      where id = ${data.id}`;
    return { ok: true };
  });

/** entra in un'altra compagnia; se quella di prima resta vuota (e non è Fabriano) si chiude */
export const joinCompany = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: unknown })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const target = await sql<{ id: number }>`select id from companies where id = ${data.id} limit 1`;
    if (!target[0]) throw new Error("Compagnia non trovata.");
    const mine = await myMembership(sql, context.userId);
    if (mine.companyId === data.id) {
      await sql`update company_members set chosen = true where user_id = ${context.userId}`;
      return { ok: true };
    }
    if (mine.role === "owner") {
      const others = await sql<{ user_id: string }>`select user_id from company_members where company_id = ${mine.companyId} and user_id <> ${context.userId} order by joined_at limit 1`;
      // il ruolo di fondatore passa a chi è entrato per primo
      if (others[0]) await sql`update company_members set role = 'owner' where user_id = ${others[0].user_id}`;
    }
    await sql`
      insert into company_members (user_id, company_id, role, chosen) values (${context.userId}, ${data.id}, 'member', true)
      on conflict (user_id) do update set company_id = excluded.company_id, role = 'member', chosen = true, joined_at = now()`;
    await dropIfEmpty(sql, mine.companyId);
    return { ok: true };
  });

export async function dropIfEmpty(sql: Sql, companyId: number) {
  const home = await homeId(sql);
  if (companyId === home) return;
  // le compagnie dell'elenco FITAST restano anche senza iscritti
  const kept = await sql<{ source: string }>`select source from companies where id = ${companyId} limit 1`;
  if (kept[0]?.source === "fitast") return;
  const left = await sql<{ n: number }>`select count(*)::int as n from company_members where company_id = ${companyId}`;
  if (asNum(left[0]?.n) === 0) await sql`delete from companies where id = ${companyId}`;
}

/** primo accesso: la persona non ha ancora scelto la sua compagnia? (lettura leggera) */
export const companyWelcome = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    if (mine.chosen) return { chosen: true as const, companies: [] as { id: number; name: string; city: string; logoUrl: string | null; color: string; members: number }[], homeId: mine.companyId };
    const home = await homeId(sql);
    const rows = await sql<{ id: number; name: string; city: string; logo_url: string | null; color: string; members: number }>`
      select c.id, c.name, c.city, c.logo_url, c.color, count(cm.user_id)::int as members
      from companies c left join company_members cm on cm.company_id = c.id
      group by c.id order by (c.id = ${home}) desc, count(cm.user_id) desc, c.name`;
    return { chosen: false as const, companies: rows.map((r) => ({ id: asNum(r.id), name: r.name, city: r.city, logoUrl: r.logo_url, color: r.color, members: asNum(r.members) })), homeId: home };
  });

/**
 * Stemmi di tutte le compagnie, per disegnarli sulla veste e sul mantello degli avatar,
 * e la compagnia di chi chiede (per mettere il proprio stemma con un tocco).
 */
export const companyCrests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const mine = await myMembership(sql, context.userId);
    const rows = await sql<{ id: number; name: string; logo_url: string | null; color: string }>`
      select id, name, logo_url, color from companies order by id`;
    return { mine: mine.companyId, crests: rows.map((r) => ({ id: asNum(r.id), name: r.name, logoUrl: r.logo_url, color: r.color })) };
  });
