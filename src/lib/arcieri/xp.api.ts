import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { asNum, db, ensureMember } from "./access";
import { garaLoads, type GaraLoad } from "./gara-volume";
import { namePattern, pastTables, trustedPast } from "./fitast-past";
import { oursInGara, type Who } from "./fitast-ours";
import { XP_RULES, xpTotal, type XpParts } from "./xp";

/**
 * Punti che vengono da quello che si registra (non dal telefono), ricalcolati sempre dai dati:
 * - allenamenti salvati (almeno 6 frecce), di più con più frecce;
 * - gare fatte: quelle dell'app, delle classifiche del portale FITAST e dell'archivio dal 2019;
 * - podi di gara e posti nella classifica generale delle stagioni chiuse;
 * - analisi del gesto salvate (al massimo due al giorno) e presenze ai corsi.
 * Così non si contano due volte, valgono per tutto il passato e salgono da sole quando arrivano dati dal portale.
 */
export async function xpPartsAll(sql: Sql, opts: { userId?: string; loads?: Map<string, GaraLoad[]> } = {}): Promise<Map<string, XpParts>> {
  const only = opts.userId ?? null;
  const out = new Map<string, XpParts>();
  const bag = (userId: string) => {
    let p = out.get(userId);
    if (!p) {
      p = { allenamenti: 0, gare: 0, podi: 0, classifiche: 0, gesti: 0, corsi: 0 };
      out.set(userId, p);
    }
    return p;
  };
  // allenamenti
  const s = await sql<{ user_id: string; n: number; pts: number }>`
    select user_id, count(*)::int as n, coalesce(sum(least(${XP_RULES.trainingArrowsMax}, floor(arrows / 10.0) * ${XP_RULES.trainingPer10Arrows})), 0)::int as pts from (
      select s.user_id, count(sh.id)::int as arrows from sessions s join shots sh on sh.session_id = s.id
      where (${only}::text is null or s.user_id = ${only})
      group by s.id, s.user_id having count(sh.id) >= 6
    ) t group by user_id`.catch(() => [] as { user_id: string; n: number; pts: number }[]);
  for (const r of s) bag(r.user_id).allenamenti += asNum(r.n) * XP_RULES.training + asNum(r.pts);
  // gare fatte e podi: le stesse gare del profilo
  const loads = opts.loads ?? (await garaLoads(sql, only).catch(() => new Map<string, GaraLoad[]>()));
  const today = new Date().toISOString().slice(0, 10);
  for (const [userId, list] of loads) {
    if (only && userId !== only) continue;
    const p = bag(userId);
    for (const l of list) {
      if (l.day > today) continue;
      p.gare += XP_RULES.gara + (l.garaId || l.source === "portale" ? XP_RULES.garaFitast : 0);
      if (l.rank != null) p.podi += XP_RULES.podium[l.rank] ?? 0;
    }
  }
  // classifica generale delle stagioni chiuse (archivio FITAST): podio e primi dieci
  const members = await sql<{ user_id: string; given_name: string; family_name: string; nickname: string; fitast_name: string | null; fitast_team: string | null }>`
    select user_id, given_name, family_name, nickname, fitast_name, fitast_team from members where user_id is not null`.catch(() => []);
  const homes = await sql<{ user_id: string; name: string; fitast_name: string | null }>`
    select cm.user_id, c.name, c.fitast_name from company_members cm join companies c on c.id = cm.company_id`.catch(() => []);
  const homeOf = new Map(homes.map((h) => [h.user_id, h.fitast_name || h.name]));
  const who: Who[] = members.map((m) => ({
    userId: m.user_id,
    fitastName: String(m.fitast_name ?? ""),
    fitastTeam: String(m.fitast_team ?? ""),
    fullName: [m.given_name, m.family_name].filter(Boolean).join(" "),
    givenName: m.given_name ?? "",
    nickname: m.nickname ?? "",
    team: homeOf.get(m.user_id) ?? "",
  }));
  const whoOf = new Map(who.map((w) => [w.userId, w]));
  const general = await pastTables(sql, "generale-arcieri", namePattern(who)).catch(() => []);
  const bySeason = new Map<string, typeof general>();
  for (const t of general) bySeason.set(t.season, [...(bySeason.get(t.season) ?? []), t]);
  for (const list of bySeason.values()) {
    for (const [userId, r] of oursInGara(list, who)) {
      if (only && userId !== only) continue;
      const w = whoOf.get(userId);
      if (!w || !trustedPast(r, w) || r.place == null) continue;
      bag(userId).classifiche += XP_RULES.season[r.place] ?? (r.place <= 10 ? XP_RULES.seasonTop10 : 0);
    }
  }
  // analisi del gesto salvate: al massimo due al giorno
  const g = await sql<{ user_id: string; n: number }>`
    select m.user_id, coalesce(sum(least(${XP_RULES.gesturesPerDay}, t.n)), 0)::int as n from (
      select member_id, (created_at at time zone 'Europe/Rome')::date as d, count(*)::int as n from gestures group by 1, 2
    ) t join members m on m.id = t.member_id
    where m.user_id is not null and (${only}::text is null or m.user_id = ${only})
    group by m.user_id`.catch(() => [] as { user_id: string; n: number }[]);
  for (const r of g) bag(r.user_id).gesti += asNum(r.n) * XP_RULES.gesture;
  // presenze ai corsi
  const c = await sql<{ user_id: string; n: number }>`
    select user_id, count(*)::int as n from course_presence where (${only}::text is null or user_id = ${only}) group by user_id`.catch(() => [] as { user_id: string; n: number }[]);
  for (const r of c) bag(r.user_id).corsi += asNum(r.n) * XP_RULES.course;
  return out;
}

const EMPTY: XpParts = { allenamenti: 0, gare: 0, podi: 0, classifiche: 0, gesti: 0, corsi: 0 };

/** i punti delle attività di un arciere, voce per voce */
export async function activityParts(sql: Sql, userId: string): Promise<XpParts> {
  return (await xpPartsAll(sql, { userId })).get(userId) ?? { ...EMPTY };
}

/** il totale dei punti delle attività di un arciere */
export async function activityXp(sql: Sql, userId: string) {
  return xpTotal(await activityParts(sql, userId));
}

/** gli stessi punti per tutti gli arcieri in una volta (le gare si possono passare già lette) */
export async function allActivityXp(sql: Sql, loads?: Map<string, GaraLoad[]>) {
  const out = new Map<string, number>();
  for (const [userId, p] of await xpPartsAll(sql, { loads })) out.set(userId, xpTotal(p));
  return out;
}

/** I punti di tutti gli arcieri (telefono + allenamenti e gare): servono per l'alone del livello attorno al ritratto. */
export const memberLevels = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<{ user_id: string; xp: number }>`select user_id, coalesce(xp, 0)::int as xp from members where user_id is not null`;
    const act = await allActivityXp(sql);
    const out: Record<string, number> = {};
    for (const r of rows) out[r.user_id] = asNum(r.xp) + (act.get(r.user_id) ?? 0);
    return out;
  });

/**
 * Punti esperienza: il telefono manda i suoi, il server tiene il valore più alto e lo rimanda, insieme ai
 * punti di allenamenti e gare registrati. Così il livello si vede sul profilo e un telefono nuovo riparte da lì.
 */
export const syncXp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const xp = Math.floor(asNum((input as { xp?: number })?.xp));
    return { xp: Math.max(0, Math.min(10_000_000, Number.isFinite(xp) ? xp : 0)) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const rows = await sql<{ xp: number }>`update members set xp = greatest(xp, ${data.xp}) where id = ${me.id} returning xp`;
    // xp: i punti del telefono (minigioco, quiz, esercizi); activity: allenamenti e gare registrati
    const parts = await activityParts(sql, context.userId);
    return { xp: asNum(rows[0]?.xp), activity: xpTotal(parts), parts };
  });
