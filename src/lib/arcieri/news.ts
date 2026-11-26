import { asNum } from "./access";
import { MONTELAGO_GIFT, specialLooksFor } from "./special-looks";
import type { getSql } from "@/lib/db";

type Sql = Awaited<ReturnType<typeof getSql>>;

function weekKey(date = new Date()) {
  const start = new Date(Date.UTC(date.getFullYear(), 0, 1));
  return `${date.getFullYear()}-${Math.ceil(((date.getTime() - start.getTime()) / 86_400_000 + start.getUTCDay() + 1) / 7)}`;
}

export async function publishNews(sql: Sql, userId: string) {
  // abiti su misura regalati: un avviso in Bacheca per il titolare, una volta sola
  const me = await sql<{ given_name: string | null; family_name: string | null; is_super: boolean | null; role: string | null }>`select given_name, family_name, is_super, role from members where user_id = ${userId} limit 1`;
  const founder = Boolean(me[0]?.is_super) && me[0]?.role === "admin";
  const all = me[0] ? specialLooksFor(me[0].given_name ?? "", me[0].family_name ?? "", founder) : [];
  // il Demone di Montelago ha il suo avviso, a Simone e al fondatore (anche a chi aveva già avuto abiti in regalo)
  if (MONTELAGO_GIFT && all.some((g) => g.id.startsWith("demone-"))) {
    await sql`
      insert into notifications (user_id, title, body, href, dedupe)
      values (${userId}, ${"È arrivato il costume da Demone di Montelago"}, ${"I due costumi del Montelago Celtic Festival sono nel tuo Avatar: maschera, corna, bastone e lo sfondo dell'Arpa di notte con i fuochi. Li potete indossare solo voi due, Simone e Victor: li trovi tra i tuoi abiti su misura, con il nome «Demone di Montelago»."}, ${"/avatar"}, ${`demone-montelago-${userId}`})
      on conflict (dedupe) do nothing`;
  }
  const gifts = all.filter((g) => !g.id.startsWith("demone-"));
  if (gifts.length) {
    const names = gifts.map((g) => `«${g.label.replace(/^[^·]*·\s*/, "")}»`).join(" e ");
    await sql`
      insert into notifications (user_id, title, body, href, dedupe)
      values (${userId}, ${gifts.length === 1 ? "Hai un nuovo vestito in regalo" : `Hai ${gifts.length} nuovi vestiti in regalo`}, ${`Il fondatore ti ha disegnato ${gifts.length === 1 ? "un abito" : "due abiti"} su misura: ${names}. Solo tu li puoi indossare: li trovi in Avatar, tra gli abiti.`}, ${"/avatar"}, ${`abiti-su-misura-${userId}`})
      on conflict (dedupe) do nothing`;
  }
  const people = await sql<{ user_id: string; name: string; created_at: string }>`
    select user_id,
      coalesce(nullif(nickname, ''), nullif(given_name, ''), 'Un arciere') as name,
      created_at::text as created_at
    from members
    where user_id is not null and status = 'active'`;
  const nameOf = new Map(people.map((row) => [row.user_id, row.name]));
  const going = await sql<{ user_id: string; competition_id: number; name: string }>`
    select p.user_id, c.id as competition_id, c.name
    from competition_presence p
    join competitions c on c.id = p.competition_id
    where p.attended = true and c.starts_on >= current_date`;
  const trainings = await sql<{ user_id: string; id: number }>`
    select s.user_id, s.id
    from sessions s
    where s.started_at >= now() - interval '21 days'
      and exists (select 1 from shots sh where sh.session_id = s.id)
    order by s.started_at desc
    limit 30`;
  const scored = await sql<{ user_id: string; competition_id: number; name: string }>`
    select e.user_id, c.id as competition_id, c.name
    from competition_entries e
    join competitions c on c.id = e.competition_id
    where e.score is not null and c.starts_on >= current_date - 45
    order by c.starts_on desc
    limit 30`;
  const shots = await sql<{ user_id: string; arrows: number; high: number; zeros: number }>`
    select s.user_id, count(*)::int as arrows,
      count(*) filter (where sh.miss = false and (sh.is_x or sh.score >= s.max_arrow - 1))::int as high,
      count(*) filter (where sh.miss = true or sh.score <= 0)::int as zeros
    from shots sh
    join sessions s on s.id = sh.session_id
    group by s.user_id`;
  const lanes = await sql<{ user_id: string; arrows: string; target_kind: string }>`
    select p.user_id, p.arrows, e.target_kind
    from piazzole p
    join competition_entries e on e.competition_id = p.competition_id and e.user_id = p.user_id`;
  const bag = new Map<string, { arrows: number; high: number; zeros: number }>();
  for (const row of shots) bag.set(row.user_id, { arrows: asNum(row.arrows), high: asNum(row.high), zeros: asNum(row.zeros) });
  for (const row of lanes) {
    const parts = String(row.arrows ?? "").split("+").map((part) => part.trim()).filter(Boolean).map((part) => asNum(part)).filter((part) => Number.isInteger(part) && part >= 0);
    if (!parts.length) continue;
    const cur = bag.get(row.user_id) ?? { arrows: 0, high: 0, zeros: 0 };
    const padiglione = row.target_kind === "padiglione";
    for (const score of parts) {
      cur.arrows += 1;
      if (score <= 0) cur.zeros += 1;
      else if (padiglione ? score >= 9 : score >= 8) cur.high += 1;
    }
    bag.set(row.user_id, cur);
  }
  const notes: { userId: string; title: string; body: string; href: string; dedupe: string }[] = [];
  const tell = (actor: string, title: string, href: string, dedupe: string) => {
    for (const person of people) {
      if (person.user_id === actor) continue;
      notes.push({ userId: person.user_id, title, body: "", href, dedupe: `${dedupe}-${person.user_id}` });
    }
  };
  for (const row of going) tell(row.user_id, `${nameOf.get(row.user_id) ?? "Un arciere"} ci va a ${row.name}`, `/gare#gara-${asNum(row.competition_id)}`, `news-go-${asNum(row.competition_id)}-${row.user_id}`);
  for (const row of trainings) tell(row.user_id, `${nameOf.get(row.user_id) ?? "Un arciere"} ha registrato un allenamento`, `/squadra`, `news-train-${asNum(row.id)}`);
  for (const row of scored) tell(row.user_id, `${nameOf.get(row.user_id) ?? "Un arciere"} ha segnato ${row.name}`, `/gare#gara-${asNum(row.competition_id)}`, `news-score-${asNum(row.competition_id)}-${row.user_id}`);
  const recentJoin = Date.now() - 45 * 86_400_000;
  for (const row of people) {
    const created = new Date(row.created_at).getTime();
    if (!Number.isFinite(created) || created < recentJoin) continue;
    tell(row.user_id, `${row.name} è entrato in squadra`, "/squadra", `news-join-${row.user_id}`);
  }
  const week = weekKey();
  let arrowLeader = "";
  let arrowBest = 0;
  let preciseLeader = "";
  let preciseBest = 0;
  for (const [id, stats] of bag) {
    if (stats.arrows > arrowBest) {
      arrowBest = stats.arrows;
      arrowLeader = id;
    }
    const compared = stats.high + stats.zeros;
    const precision = compared >= 12 ? stats.high / compared : 0;
    if (precision > preciseBest) {
      preciseBest = precision;
      preciseLeader = id;
    }
  }
  if (arrowLeader && arrowBest > 0) tell(arrowLeader, `${nameOf.get(arrowLeader) ?? "Un arciere"} guida il numero di frecce`, "/squadra", `news-lead-arrows-${arrowLeader}-${week}`);
  if (preciseLeader && preciseBest > 0) tell(preciseLeader, `${nameOf.get(preciseLeader) ?? "Un arciere"} è il più preciso`, "/statistiche", `news-lead-precise-${preciseLeader}-${week}`);
  for (const person of people) {
    const mine = bag.get(person.user_id);
    let aheadArrows = "";
    let aheadArrowsN = mine?.arrows ?? 0;
    let aheadPrecise = "";
    let aheadPreciseN = mine && mine.high + mine.zeros >= 12 ? mine.high / (mine.high + mine.zeros) : 0;
    for (const [id, stats] of bag) {
      if (id === person.user_id) continue;
      if (stats.arrows > aheadArrowsN) {
        aheadArrowsN = stats.arrows;
        aheadArrows = id;
      }
      const compared = stats.high + stats.zeros;
      const precision = compared >= 12 ? stats.high / compared : 0;
      if (precision > aheadPreciseN) {
        aheadPreciseN = precision;
        aheadPrecise = id;
      }
    }
    if (aheadArrows) notes.push({ userId: person.user_id, title: `${nameOf.get(aheadArrows) ?? "Un arciere"} ti ha superato nelle frecce`, body: "", href: "/squadra", dedupe: `news-over-arrows-${aheadArrows}-${person.user_id}` });
    if (aheadPrecise) notes.push({ userId: person.user_id, title: `${nameOf.get(aheadPrecise) ?? "Un arciere"} ti ha superato in precisione`, body: "", href: "/statistiche", dedupe: `news-over-precise-${aheadPrecise}-${person.user_id}` });
  }
  for (const note of notes) {
    if (note.userId !== userId) continue;
    await sql`
      insert into notifications (user_id, title, body, href, dedupe)
      values (${note.userId}, ${note.title}, ${note.body}, ${note.href}, ${note.dedupe})
      on conflict (dedupe) do nothing`;
  }
}
