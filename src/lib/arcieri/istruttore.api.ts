/**
 * Pannello istruttori: gli atleti della compagnia in una schermata, con media, andamento,
 * ultimo allenamento e avvisi per cali e assenze.
 *
 * Lo aprono lo staff, il capogruppo e chi ha scelto il percorso "istruttore".
 * Un arciere può togliere i suoi allenamenti dal pannello (Profilo › Account › Privacy).
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asBool, asNum, db, ensureMember, staffLevel } from "./access";
import { homeId, myMembership } from "./compagnie.api";
import { faceById } from "./scoring";

const DAY = 86_400_000;

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export type Athlete = {
  memberId: number;
  name: string;
  photoUrl: string | null;
  color: string;
  shares: boolean;
  lastAt: string | null;
  daysAway: number | null;
  avg: number | null;
  delta: number | null;
  spark: number[];
  arrows30: number;
  sessions30: number;
  lastInfo: string;
  alerts: { kind: "calo" | "assente" | "nuovo"; text: string }[];
};

export const coachBoard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ companyId: asNum((input as { companyId?: unknown })?.companyId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const staff = staffLevel(me);
    const mine = await myMembership(sql, context.userId);
    const leader = mine.role === "owner";
    if (!staff && !leader && !asBool(me.coach)) {
      throw new Error("Il pannello è per gli istruttori, il capogruppo e lo staff della compagnia.");
    }
    // lo staff segue tutte le compagnie; gli altri solo la propria
    const companyId = staff && data.companyId ? data.companyId : mine.companyId;
    const home = await homeId(sql);
    const company = await sql<{ id: number; name: string; color: string }>`select id, name, color from companies where id = ${companyId} limit 1`;
    if (!company[0]) throw new Error("Compagnia non trovata.");
    const companies = staff ? await sql<{ id: number; name: string }>`select id, name from companies order by name` : [];

    const people = await sql<{ id: number; user_id: string; given_name: string; family_name: string; nickname: string; photo_url: string | null; avatar_color: string; share_coach: boolean | null; company_id: number | null }>`
      select m.id, m.user_id, m.given_name, m.family_name, m.nickname, m.photo_url, m.avatar_color, m.share_coach, cm.company_id
      from members m
      left join company_members cm on cm.user_id = m.user_id
      where m.user_id is not null`.then((rows) => rows.filter((r) => (r.company_id == null ? home : asNum(r.company_id)) === companyId && r.user_id !== context.userId));
    const ids = new Set(people.map((p) => p.user_id));

    const sessions = await sql<{ id: number; user_id: string; started_at: unknown; face: string; distance_m: number; n: number; avg: number }>`
      select s.id, s.user_id, s.started_at, s.face, s.distance_m, count(sh.id)::int as n, avg(case when sh.miss then 0 else sh.score end)::float as avg
      from sessions s join shots sh on sh.session_id = s.id
      where s.started_at > now() - interval '150 days'
      group by s.id
      order by s.started_at desc`.then((rows) => rows.filter((r) => ids.has(r.user_id)));
    const lastEver = await sql<{ user_id: string; at: unknown }>`select user_id, max(started_at) as at from sessions group by user_id`.then((rows) => new Map(rows.filter((r) => ids.has(r.user_id)).map((r) => [r.user_id, iso(r.at)])));

    const now = Date.now();
    const athletes: Athlete[] = people.map((p) => {
      const name = [p.given_name, p.family_name].filter(Boolean).join(" ") || p.nickname || "Arciere";
      const shares = p.share_coach !== false;
      const base = { memberId: asNum(p.id), name, photoUrl: p.photo_url && p.photo_url.length < 200_000 ? p.photo_url : null, color: p.avatar_color || "#1f5c38", shares };
      if (!shares) return { ...base, lastAt: null, daysAway: null, avg: null, delta: null, spark: [], arrows30: 0, sessions30: 0, lastInfo: "Non condivide i suoi allenamenti", alerts: [] };
      const mine = sessions.filter((s) => s.user_id === p.user_id);
      // media di ogni seduta in decimi del bersaglio, così bersagli diversi si confrontano
      const scored = mine.filter((s) => asNum(s.n) >= 6).map((s) => ({ ...s, tenths: (asNum(s.avg) / (faceById(s.face).max || 10)) * 10 }));
      const last3 = scored.slice(0, 3).map((s) => s.tenths);
      const prev3 = scored.slice(3, 6).map((s) => s.tenths);
      const avg = last3.length ? mean(last3) : null;
      const delta = last3.length === 3 && prev3.length === 3 ? mean(last3) - mean(prev3) : null;
      const lastAt = lastEver.get(p.user_id) || null;
      const daysAway = lastAt ? Math.floor((now - new Date(lastAt).getTime()) / DAY) : null;
      const in30 = mine.filter((s) => now - new Date(iso(s.started_at)).getTime() < 30 * DAY);
      const top = mine[0];
      const alerts: Athlete["alerts"] = [];
      if (delta != null && delta <= -0.3) alerts.push({ kind: "calo", text: `media in calo da 3 sedute (${delta.toFixed(2).replace(".", ",")})` });
      if (daysAway != null && daysAway >= 10) alerts.push({ kind: "assente", text: `nessun tiro da ${daysAway} giorni` });
      if (!lastAt) alerts.push({ kind: "nuovo", text: "non ha ancora registrato allenamenti" });
      return {
        ...base,
        lastAt,
        daysAway,
        avg,
        delta,
        spark: scored.slice(0, 8).map((s) => Math.round(s.tenths * 100) / 100).reverse(),
        arrows30: in30.reduce((a, s) => a + asNum(s.n), 0),
        sessions30: in30.length,
        lastInfo: top ? `${asNum(top.n)} frecce · ${asNum(top.distance_m)} m` : "",
        alerts,
      };
    });
    // prima chi ha bisogno di attenzione, poi chi è più attivo
    const weight = (a: Athlete) => (a.alerts.some((x) => x.kind !== "nuovo") ? 0 : a.shares && a.lastAt ? 1 : 2);
    athletes.sort((a, b) => weight(a) - weight(b) || (a.daysAway ?? 9999) - (b.daysAway ?? 9999) || a.name.localeCompare(b.name));
    return {
      company: { id: asNum(company[0].id), name: company[0].name, color: company[0].color },
      companies: companies.map((c) => ({ id: asNum(c.id), name: c.name })),
      athletes,
      summary: {
        total: athletes.length,
        active7: athletes.filter((a) => a.daysAway != null && a.daysAway < 7).length,
        follow: athletes.filter((a) => a.alerts.some((x) => x.kind !== "nuovo")).length,
      },
    };
  });
