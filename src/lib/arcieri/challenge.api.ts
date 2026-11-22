/**
 * L'arciere che tira come te, la sfida degli avatar e i privilegi.
 *
 * - Forma: dove finiscono davvero le tue ultime frecce (spostamento medio e larghezza del gruppo).
 *   La Home la usa per far tirare l'avatar come te e per dirti cosa migliorare.
 * - Sfida degli avatar: la forza di ogni arciere della compagnia nasce dai suoi dati veri
 *   (precisione, costanza, allenamenti, frecce, gare). Più registri e migliori, più il tuo arciere sale.
 * - Privilegi: si sbloccano con l'attività e durano un tempo limitato; per tenerli bisogna continuare.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asNum, db, ensureMember } from "./access";
import { companyPeers, myMembership } from "./compagnie.api";
import { faceById } from "./scoring";

const DAY = 86_400_000;

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function std(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

const clamp100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** inizio della settimana (lunedì, ore 0) e la sua fine */
function weekBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start.getTime() + 7 * DAY);
  return { start, end };
}

export type Perk = { id: "fuoco" | "aura" | "stendardo" | "corona"; label: string; text: string; active: boolean; until: string | null; progress: number; goal: string };

export const avatarChallenge = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const peers = await companyPeers(sql, context.userId);
    peers.add(context.userId);
    const mine = await myMembership(sql, context.userId);
    const company = await sql<{ name: string; color: string }>`select name, color from companies where id = ${mine.companyId} limit 1`;

    // ultime frecce di ognuno (fino a 60), con la posizione sul bersaglio quando c'è
    const shots = await sql<{ user_id: string; score: number; is_x: boolean; miss: boolean; nx: number | null; ny: number | null; face: string; started_at: unknown }>`
      select user_id, score, is_x, miss, nx, ny, face, started_at from (
        select s.user_id, sh.score, sh.is_x, sh.miss, sh.nx, sh.ny, s.face, s.started_at,
          row_number() over (partition by s.user_id order by s.started_at desc, sh.id desc) as rn
        from shots sh join sessions s on s.id = sh.session_id
      ) t where rn <= 60`.then((r) => r.filter((x) => peers.has(x.user_id)));
    const days = await sql<{ user_id: string; day: string; arrows: number; points: number; started_at: unknown }>`
      select s.user_id, to_char(s.started_at, 'YYYY-MM-DD') as day, count(sh.id)::int as arrows, coalesce(sum(sh.score), 0)::int as points, max(s.started_at) as started_at
      from sessions s join shots sh on sh.session_id = s.id
      where s.started_at > now() - interval '60 days'
      group by s.user_id, to_char(s.started_at, 'YYYY-MM-DD')`.then((r) => r.filter((x) => peers.has(x.user_id)));
    const gare = await sql<{ user_id: string; n: number }>`
      select e.user_id, count(distinct e.competition_id)::int as n
      from competition_entries e join competitions c on c.id = e.competition_id
      where c.starts_on > now() - interval '120 days'
        and (e.score is not null or e.lane_count is not null)
      group by e.user_id`.then((r) => r.filter((x) => peers.has(x.user_id)));
    const people = await sql<{ id: number; user_id: string; given_name: string; family_name: string; nickname: string; photo_url: string | null; avatar_color: string }>`
      select id, user_id, given_name, family_name, nickname, photo_url, avatar_color from members where user_id is not null`.then((r) => r.filter((x) => peers.has(x.user_id)));
    // record personale: la migliore media di una sessione (almeno 6 frecce) prima di questa settimana e in questa
    const sessionAvg = await sql<{ started_at: unknown; avg: number }>`
      select s.started_at, avg(sh.score)::float as avg
      from sessions s join shots sh on sh.session_id = s.id
      where s.user_id = ${context.userId}
      group by s.id, s.started_at having count(sh.id) >= 6`;

    const now = Date.now();
    const { start: monday, end: sunday } = weekBounds();
    const byUser = new Map<string, typeof shots>();
    for (const row of shots) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
    const daysOf = new Map<string, typeof days>();
    for (const row of days) daysOf.set(row.user_id, [...(daysOf.get(row.user_id) ?? []), row]);
    const gareOf = new Map(gare.map((g) => [g.user_id, asNum(g.n)]));

    const rows = people.map((p) => {
      const list = byUser.get(p.user_id) ?? [];
      // punteggio portato in decimi, qualunque sia il bersaglio
      const tenths = list.map((s) => {
        const max = faceById(s.face).max || 10;
        return s.miss ? 0 : ((s.is_x ? max : asNum(s.score)) / max) * 10;
      });
      const d = daysOf.get(p.user_id) ?? [];
      const in30 = d.filter((x) => now - new Date(iso(x.started_at)).getTime() < 30 * DAY);
      const arrows30 = in30.reduce((a, x) => a + asNum(x.arrows), 0);
      const avg = mean(tenths);
      const parts = {
        precisione: list.length >= 6 ? clamp100(avg * 10) : 0,
        costanza: list.length >= 6 ? clamp100(100 - std(tenths) * 22) : 0,
        allenamento: clamp100((in30.length / 12) * 100),
        frecce: clamp100((arrows30 / 600) * 100),
        gare: clamp100((gareOf.get(p.user_id) ?? 0) * 25),
      };
      const power = Math.round(parts.precisione * 0.35 + parts.costanza * 0.2 + parts.allenamento * 0.2 + parts.frecce * 0.15 + parts.gare * 0.1);
      const week = d.filter((x) => new Date(iso(x.started_at)) >= monday).reduce((a, x) => a + asNum(x.arrows), 0);
      return {
        memberId: asNum(p.id),
        userId: p.user_id,
        name: [p.given_name, p.family_name].filter(Boolean).join(" ") || p.nickname || "Arciere",
        photoUrl: p.photo_url && p.photo_url.length < 200_000 ? p.photo_url : null,
        color: p.avatar_color || "#1f5c38",
        power,
        parts,
        week,
        shots: list.length,
      };
    });
    rows.sort((a, b) => b.power - a.power || b.week - a.week);

    // la mia forma: dove vanno le frecce che hanno la posizione segnata
    const mineShots = byUser.get(context.userId) ?? [];
    const placed = mineShots.filter((s) => s.nx != null && s.ny != null && !s.miss).slice(0, 36);
    const tenthsMine = mineShots.slice(0, 36).map((s) => {
      const max = faceById(s.face).max || 10;
      return s.miss ? 0 : ((s.is_x ? max : asNum(s.score)) / max) * 10;
    });
    const offX = placed.length >= 6 ? mean(placed.map((s) => asNum(s.nx))) : 0;
    const offY = placed.length >= 6 ? mean(placed.map((s) => asNum(s.ny))) : 0;
    // larghezza del gruppo: dalle posizioni se ci sono, altrimenti dal punteggio (10 al centro, 1 sul bordo)
    const spread = placed.length >= 6
      ? Math.sqrt(mean(placed.map((s) => (asNum(s.nx) - offX) ** 2 + (asNum(s.ny) - offY) ** 2)))
      : tenthsMine.length ? Math.min(1.1, mean(tenthsMine.map((v) => Math.max(0.04, (10.5 - v) / 10)))) : 0.5;
    const missRate = mineShots.length ? mineShots.slice(0, 36).filter((s) => s.miss).length / Math.min(36, mineShots.length) : 0;
    const form = {
      n: tenthsMine.length,
      placed: placed.length,
      avg: mean(tenthsMine),
      offX,
      offY,
      spread,
      missRate,
    };

    // privilegi: si sbloccano con l'attività e scadono, per tenerli bisogna continuare
    const myDays = (daysOf.get(context.userId) ?? []).map((x) => new Date(iso(x.started_at)).getTime()).sort((a, b) => b - a);
    const days7 = myDays.filter((t) => now - t < 7 * DAY);
    const fireUntil = days7.length >= 3 ? new Date(days7[0] + 3 * DAY).toISOString() : null;
    const before = sessionAvg.filter((s) => new Date(iso(s.started_at)) < new Date(now - 7 * DAY)).reduce((m, s) => Math.max(m, asNum(s.avg)), 0);
    const recent = sessionAvg.filter((s) => new Date(iso(s.started_at)) >= new Date(now - 7 * DAY));
    const record = recent.find((s) => before > 0 && asNum(s.avg) > before);
    const auraUntil = record ? new Date(new Date(iso(record.started_at)).getTime() + 7 * DAY).toISOString() : null;
    const teamWeek = rows.reduce((a, r) => a + r.week, 0);
    const teamGoal = Math.max(150, rows.length * 100);
    const meRow = rows.find((r) => r.userId === context.userId);
    const topWeek = [...rows].sort((a, b) => b.week - a.week)[0];
    const crowned = Boolean(meRow && topWeek && topWeek.userId === context.userId && meRow.week > 0);
    const perks: Perk[] = [
      { id: "fuoco", label: "Freccia infuocata", text: "Le tue frecce in Home lasciano una scia di fuoco.", active: Boolean(fireUntil && new Date(fireUntil).getTime() > now), until: fireUntil, progress: Math.min(1, days7.length / 3), goal: "Tira in 3 giorni diversi in una settimana" },
      { id: "aura", label: "Aura del campione", text: "Una luce d'oro attorno al tuo arciere.", active: Boolean(auraUntil && new Date(auraUntil).getTime() > now), until: auraUntil, progress: record ? 1 : 0, goal: "Batti la tua miglior media di sempre" },
      { id: "stendardo", label: "Stendardo della compagnia", text: "Lo stendardo della compagnia sventola nella tua Home.", active: teamWeek >= teamGoal, until: teamWeek >= teamGoal ? sunday.toISOString() : null, progress: Math.min(1, teamWeek / teamGoal), goal: `La compagnia tira ${teamGoal} frecce in settimana (${teamWeek} finora)` },
      { id: "corona", label: "Corona della settimana", text: "La corona su chi ha tirato più frecce in settimana.", active: crowned, until: crowned ? sunday.toISOString() : null, progress: meRow && topWeek && topWeek.week ? Math.min(1, meRow.week / topWeek.week) : 0, goal: "Tira più frecce di tutti nella settimana" },
    ];
    return {
      company: { name: company[0]?.name ?? "", color: company[0]?.color ?? "#1f7a46" },
      rows,
      meId: context.userId,
      crownId: topWeek && topWeek.week > 0 ? topWeek.userId : null,
      form,
      perks,
      teamWeek,
      teamGoal,
    };
  });
