/**
 * Il mio mese: i numeri di un mese di tiro, pronti per un'immagine da condividere.
 * Frecce, allenamenti, media, miglior volée, la rosata e il posto nella compagnia.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asNum, db, ensureMember } from "./access";
import { companyPeers, myMembership } from "./compagnie.api";
import { faceById } from "./scoring";

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

type ShotRow = { session_id: number; started_at: unknown; face: string; block_index: number; end_index: number; score: number; is_x: boolean; miss: boolean; nx: number | null; ny: number | null };

function tenthsOf(s: ShotRow) {
  const max = faceById(s.face).max || 10;
  return s.miss ? 0 : ((s.is_x ? max : asNum(s.score)) / max) * 10;
}

/** larghezza del gruppo dalle frecce con la posizione segnata */
function spreadOf(rows: ShotRow[]) {
  const placed = rows.filter((s) => s.nx != null && s.ny != null && !s.miss);
  if (placed.length < 6) return null;
  const cx = mean(placed.map((s) => asNum(s.nx)));
  const cy = mean(placed.map((s) => asNum(s.ny)));
  return Math.sqrt(mean(placed.map((s) => (asNum(s.nx) - cx) ** 2 + (asNum(s.ny) - cy) ** 2)));
}

export const monthSummary = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = String((input as { month?: unknown })?.month ?? "");
    const now = new Date();
    const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return { month: /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : fallback };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const [y, m] = data.month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();
    const prevStart = new Date(Date.UTC(y, m - 2, 1)).toISOString();

    const rows = await sql<ShotRow>`
      select sh.session_id, s.started_at, s.face, sh.block_index, sh.end_index, sh.score, sh.is_x, sh.miss, sh.nx, sh.ny
      from shots sh join sessions s on s.id = sh.session_id
      where s.user_id = ${context.userId} and s.started_at >= ${prevStart} and s.started_at < ${end}
      order by s.started_at desc, sh.id desc`;
    const inMonth = rows.filter((r) => new Date(String(r.started_at instanceof Date ? r.started_at.toISOString() : r.started_at)) >= new Date(start));
    const before = rows.filter((r) => !inMonth.includes(r));

    const sessions = new Set(inMonth.map((r) => r.session_id));
    const days = new Set(inMonth.map((r) => (r.started_at instanceof Date ? r.started_at.toISOString() : String(r.started_at)).slice(0, 10)));
    const avg = inMonth.length ? mean(inMonth.map(tenthsOf)) : null;
    const avgPrev = before.length ? mean(before.map(tenthsOf)) : null;

    // miglior volée: la somma più alta di una volée, con il massimo possibile per quel bersaglio
    const ends = new Map<string, { points: number; max: number; n: number }>();
    for (const r of inMonth) {
      const key = `${r.session_id}-${r.block_index}-${r.end_index}`;
      const face = faceById(r.face).max || 10;
      const e = ends.get(key) ?? { points: 0, max: 0, n: 0 };
      e.points += r.miss ? 0 : r.is_x ? face : asNum(r.score);
      e.max += face;
      e.n += 1;
      ends.set(key, e);
    }
    const best = [...ends.values()].filter((e) => e.n >= 3).sort((a, b) => b.points / b.max - a.points / a.max || b.points - a.points)[0] ?? null;

    const spread = spreadOf(inMonth);
    const spreadPrev = spreadOf(before);
    const spreadChange = spread != null && spreadPrev != null && spreadPrev > 0 ? Math.round(((spreadPrev - spread) / spreadPrev) * 100) : null;

    // posto nella compagnia per frecce tirate nel mese
    const peers = await companyPeers(sql, context.userId);
    peers.add(context.userId);
    const counts = await sql<{ user_id: string; n: number }>`
      select s.user_id, count(sh.id)::int as n
      from sessions s join shots sh on sh.session_id = s.id
      where s.started_at >= ${start} and s.started_at < ${end}
      group by s.user_id`.then((r) => r.filter((x) => peers.has(x.user_id) && asNum(x.n) > 0));
    counts.sort((a, b) => asNum(b.n) - asNum(a.n));
    const pos = counts.findIndex((c) => c.user_id === context.userId);

    const mine = await myMembership(sql, context.userId);
    const company = await sql<{ name: string }>`select name from companies where id = ${mine.companyId} limit 1`;
    const dots = inMonth
      .filter((r) => r.nx != null && r.ny != null && !r.miss)
      .slice(0, 90)
      .map((r) => ({ x: Math.round(asNum(r.nx) * 1000) / 1000, y: Math.round(asNum(r.ny) * 1000) / 1000 }));

    return {
      month: data.month,
      label: `${MONTHS[m - 1]} ${y}`,
      monthName: MONTHS[m - 1],
      name: [me.given_name, me.family_name].filter(Boolean).join(" ") || me.nickname || "Arciere",
      company: company[0]?.name ?? "",
      sessions: sessions.size,
      days: days.size,
      arrows: inMonth.length,
      avg,
      avgDelta: avg != null && avgPrev != null ? avg - avgPrev : null,
      best: best ? { points: best.points, max: best.max } : null,
      spreadChange,
      rank: pos >= 0 ? { pos: pos + 1, of: counts.length } : null,
      dots,
    };
  });
