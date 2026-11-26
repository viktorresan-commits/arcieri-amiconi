/**
 * Il collegamento tra il profilo e il nome con cui il portale FITAST conosce l'arciere. Lo fa ognuno per sé;
 * il presidente della compagnia (o il fondatore) può farlo per i compagni della sua compagnia.
 * Con il nome collegato le gare del campionato si riempiono da sole (posto, punti, punti campionato).
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { asNum, clip, db, ensureMember, staffLevel, type MemberRow } from "./access";
import { myMembership } from "./compagnie.api";
import { cleanCategory, teamKey, titleName, type RankRow } from "./fitast-league";
import { nameKey } from "./fitast-rank";

type Row = MemberRow & { fitast_name?: string; fitast_team?: string };

async function homeTeam(sql: Sql, userId: string) {
  const r = await sql<{ id: number; name: string; fitast_name: string }>`
    select c.id, c.name, c.fitast_name from company_members cm join companies c on c.id = cm.company_id where cm.user_id = ${userId} limit 1`.catch(() => []);
  return r[0] ? { id: asNum(r[0].id), team: r[0].fitast_name || r[0].name } : { id: 0, team: "" };
}

/** può collegare il nome di target: sé stesso, oppure presidente della stessa compagnia, oppure il fondatore */
async function mayLink(sql: Sql, me: MemberRow, userId: string, target: string) {
  if (target === userId) return true;
  if (staffLevel(me)) return true;
  const mine = await myMembership(sql, userId);
  if (mine.role !== "owner") return false;
  const theirs = await sql<{ company_id: number }>`select company_id from company_members where user_id = ${target} limit 1`;
  return Boolean(theirs[0]) && asNum(theirs[0].company_id) === mine.companyId;
}

const face = (m: Row) => ({
  userId: m.user_id ?? "",
  givenName: m.given_name ?? "",
  familyName: m.family_name ?? "",
  nickname: m.nickname ?? "",
  slug: m.slug ?? "",
  photoUrl: m.photo_url ?? null,
  avatarColor: m.avatar_color ?? "#1f5c38",
  fitastName: String(m.fitast_name ?? ""),
  fitastTeam: String(m.fitast_team ?? ""),
});

/** il mio collegamento e, per il presidente, quello dei compagni */
export const fitastLinkState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const me = (await ensureMember(sql, context.userId)) as Row;
    const mine = await myMembership(sql, context.userId);
    const home = await homeTeam(sql, context.userId);
    const canManage = mine.role === "owner" || staffLevel(me) != null;
    const mates = canManage
      ? await sql<Row>`
          select m.* from members m join company_members cm on cm.user_id = m.user_id
          where cm.company_id = ${mine.companyId} and m.user_id <> ${context.userId} and coalesce(m.status, '') <> 'left'
          order by m.given_name, m.family_name`.catch(() => [] as Row[])
      : [];
    return { me: face(me), team: home.team, canManage, mates: mates.map(face) };
  });

type Person = { name: string; team: string; key: string; words: string[]; category: string; gare: Set<string>; points: number | null };

/** le persone delle classifiche del campionato più recente (generale e gare) */
async function peopleNow(sql: Sql) {
  const latest = await sql<{ season: string }>`select season from fitast_standings order by updated_at desc limit 1`;
  if (!latest[0]) return [] as Person[];
  const tabs = await sql<{ kind: string; gara_id: string; category: string; rows: RankRow[] }>`
    select kind, gara_id, category, rows from fitast_standings
    where season = ${latest[0].season} and kind in ('generale-arcieri', 'gara-arcieri')`;
  const people = new Map<string, Person>();
  const precision = (c: string) => cleanCategory(c).split("·").filter(Boolean).length;
  for (const t of tabs) {
    for (const r of Array.isArray(t.rows) ? t.rows : []) {
      const key = nameKey(r.name ?? "");
      if (!key) continue;
      const id = `${key}|${teamKey(r.team ?? "")}`;
      const p = people.get(id) ?? { name: r.name, team: r.team ?? "", key, words: key.split(" "), category: "", gare: new Set<string>(), points: null };
      if (t.kind === "gara-arcieri" && t.gara_id) p.gare.add(t.gara_id);
      if (t.kind === "generale-arcieri") {
        const pts = r.camp ?? r.score;
        if (pts != null && (p.points == null || pts > p.points)) p.points = pts;
      }
      if (precision(t.category) > precision(p.category)) p.category = t.category;
      people.set(id, p);
    }
  }
  return [...people.values()];
}

/** cerca un nome nelle classifiche del portale (vuoto: i nomi che somigliano a quello del profilo) */
export const fitastNameSearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    return { q: clip(r.q, 60), userId: clip(r.userId, 80) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const target = data.userId || context.userId;
    if (!(await mayLink(sql, me, context.userId, target))) throw new Error("Solo il presidente della compagnia può collegare il nome di un compagno.");
    const who = (await sql<Row>`select * from members where user_id = ${target} limit 1`)[0];
    const team = teamKey((await homeTeam(sql, target)).team);
    const all = await peopleNow(sql);
    const q = nameKey(data.q);
    const qWords = q ? q.split(" ") : [];
    const starts = (p: Person) => qWords.every((w) => p.words.some((x) => x.startsWith(w)));
    let list: Person[];
    if (qWords.length) list = all.filter(starts);
    else {
      // senza ricerca: chi ha il nome o il cognome del profilo, prima nella sua compagnia
      const own = [who?.given_name ?? "", who?.family_name ?? "", who?.nickname ?? ""].map((x) => nameKey(x)).filter(Boolean).flatMap((x) => x.split(" "));
      const full = nameKey([who?.given_name, who?.family_name].filter(Boolean).join(" "));
      list = all.filter((p) => (full.includes(" ") && full.split(" ").every((w) => p.words.includes(w))) || (teamKey(p.team) === team && own.some((w) => p.words.includes(w))));
    }
    // nomi già presi da altri profili
    const linked = await sql<Row>`select * from members where coalesce(fitast_name, '') <> '' and user_id <> ${target}`;
    const takenBy = (p: Person) => {
      const m = linked.find((x) => nameKey(String(x.fitast_name ?? "")) === p.key && (!x.fitast_team || teamKey(String(x.fitast_team)) === teamKey(p.team)));
      return m ? [m.given_name, m.family_name].filter(Boolean).join(" ") || m.nickname || "un altro arciere" : "";
    };
    const results = list
      .sort((a, b) => Number(teamKey(b.team) === team) - Number(teamKey(a.team) === team) || (b.points ?? -1) - (a.points ?? -1) || a.name.localeCompare(b.name, "it"))
      .slice(0, 15)
      .map((p) => ({ name: p.name, label: titleName(p.name), team: p.team, teamLabel: titleName(p.team), category: cleanCategory(p.category), gare: p.gare.size, points: p.points, sameTeam: teamKey(p.team) === team && team !== "", takenBy: takenBy(p) }));
    return { results, searched: qWords.length > 0, empty: all.length === 0 };
  });

/** collega (o scollega, con nome vuoto) il nome FITAST di un profilo */
export const setFitastLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    return { userId: clip(r.userId, 80), name: clip(r.name, 90), team: clip(r.team, 110) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const target = data.userId || context.userId;
    if (!(await mayLink(sql, me, context.userId, target))) throw new Error("Solo il presidente della compagnia può collegare il nome di un compagno.");
    if (data.name) {
      // solo nomi che il portale conosce davvero
      const all = await peopleNow(sql);
      const key = nameKey(data.name);
      if (!all.some((p) => p.key === key && (!data.team || teamKey(p.team) === teamKey(data.team)))) throw new Error("Questo nome non è nelle classifiche del portale.");
    }
    await sql`update members set fitast_name = ${data.name}, fitast_team = ${data.name ? data.team : ""} where user_id = ${target}`;
    return { ok: true };
  });
