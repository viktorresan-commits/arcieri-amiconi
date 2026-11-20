import { Glyph, IconLabel } from "@/components/icons";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { statsSeries } from "@/lib/arcieri/training.api";
import { listCompetitions, skillBoard } from "@/lib/arcieri/club.api";
import { fmtAvg, aimAngleLabel, aimTargetLabel } from "@/lib/arcieri/scoring";
import { useLoad } from "@/lib/arcieri/use-load";
import { useMember } from "@/components/shell";
import { ActivityHeat, AvgLine, ComboBars, DistBars, Ring, ScoreLine } from "@/components/charts";
import { GaraTrend, type GaraPoint } from "@/components/gara-trend";
import { Card, Chips, ErrorNote, Kpi, Loading, PageHead, SectionHead, Segmented } from "@/components/kit";
import { bowLabel } from "@/lib/arcieri/labels";
import { animalByLabel } from "@/lib/arcieri/sagome";

export const Route = createFileRoute("/_app/statistiche")({ component: Page });

type Period = "30" | "90" | "365" | "all";
const PERIODS: { id: Period; label: string }[] = [
  { id: "30", label: "30 giorni" },
  { id: "90", label: "3 mesi" },
  { id: "365", label: "1 anno" },
  { id: "all", label: "Sempre" },
];
const BOW_COLORS = ["#5aa6e8", "#3d8f5f", "#e0b15a", "#c4a2f2", "#e07a72", "#9dbea4"];

function mondayKey(iso: string) {
  const d = new Date(iso);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Page() {
  const [nonce] = useState(0);
  const [period, setPeriod] = useState<Period>("90");
  const [tab, setTab] = useState<"allenamento" | "gare">("allenamento");
  const { me } = useMember();
  const { data, error, loading } = useLoad(`stats-${nonce}`, () => statsSeries({ data: {} }));
  const comps = useLoad(`comps-${nonce}`, () => listCompetitions());
  const mine: GaraPoint[] = (comps.data?.competitions ?? [])
    .flatMap((c) => c.entries.filter((e) => e.userId === me.userId && (e.score != null || e.championshipPoints != null || e.spot != null || e.laneCount != null)).map((e) => ({
      id: `${c.id}:${e.userId}`,
      day: c.startsOn,
      name: c.name,
      laneCount: e.laneCount ?? (e.piazzole.length || null),
      score: e.score,
      spot: e.spot,
      championshipPoints: e.championshipPoints,
    })))
    .sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
  const gara = mine.filter((e) => e.score != null).map((e) => ({ name: e.day.slice(5), score: e.score ?? 0 }));
  const spots = mine.filter((e) => e.spot != null).map((e) => ({ name: e.day.slice(5), score: e.spot ?? 0 }));
  let running = 0;
  const season = mine.filter((e) => e.championshipPoints != null).map((e) => {
    running += e.championshipPoints ?? 0;
    return { name: e.day.slice(5), score: running };
  });
  const last = mine.at(-1);
  const prev = mine.at(-2);
  const sumOf = (pick: (e: GaraPoint) => number | null) => mine.reduce((a, e) => a + (pick(e) ?? 0), 0);

  // ── Allenamento: filtro periodo, KPI, barre settimanali impilate per arco + media
  const all = data?.series ?? [];
  const days = period === "all" ? Infinity : Number(period);
  const since = Date.now() - days * 86_400_000;
  const before = Date.now() - 2 * days * 86_400_000;
  const inPeriod = all.filter((s) => new Date(s.startedAt).getTime() >= since);
  const prevPeriod = period === "all" ? [] : all.filter((s) => { const t = new Date(s.startedAt).getTime(); return t >= before && t < since; });
  const sumArrows = (l: typeof all) => l.reduce((a, s) => a + s.arrows, 0);
  const wAvg = (l: typeof all) => { const n = sumArrows(l); return n ? l.reduce((a, s) => a + s.avg * s.arrows, 0) / n : 0; };
  const arrowsNow = sumArrows(inPeriod);
  const avgNow = wAvg(inPeriod);
  const avgPrev = wAvg(prevPeriod);
  const arrowsPrev = sumArrows(prevPeriod);
  const best = inPeriod.reduce((m, s) => Math.max(m, s.avg), 0);
  const bows = [...new Set(inPeriod.map((s) => s.bowType))];
  const weeks = new Map<string, Record<string, number>>();
  for (const s of inPeriod) {
    const k = mondayKey(s.startedAt);
    const row = weeks.get(k) ?? { _pts: 0, _n: 0 };
    row[s.bowType] = (row[s.bowType] ?? 0) + s.arrows;
    row._pts += s.avg * s.arrows;
    row._n += s.arrows;
    weeks.set(k, row);
  }
  const weekly = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-16).map(([k, row]) => {
    const out: Record<string, string | number | null> = { name: `${k.slice(8)}/${k.slice(5, 7)}`, media: row._n ? Number((row._pts / row._n).toFixed(2)) : null };
    for (const b of bows) out[b] = row[b] ?? 0;
    return out;
  });
  const heat: Record<string, number> = {};
  for (const s of all) heat[s.day] = (heat[s.day] ?? 0) + s.arrows;
  const line = inPeriod.slice(-20).map((s) => ({ name: s.day.slice(5).split("-").reverse().join("/"), avg: Number(s.avg.toFixed(2)) }));
  const dist = data?.distribution ?? [];
  const bars = dist.map((d) => ({ name: d.isX ? `${d.score}X` : String(d.score), n: d.n }));
  const distTotal = dist.reduce((a, d) => a + d.n, 0);
  const gold = dist.filter((d) => d.score >= 9 || d.isX).reduce((a, d) => a + d.n, 0);
  const xs = dist.filter((d) => d.isX).reduce((a, d) => a + d.n, 0);
  const miss = dist.filter((d) => d.score === 0).reduce((a, d) => a + d.n, 0);
  const delta = (a: number, b: number) => (b > 0 ? (a - b) / b : null);

  return (
    <div className="grid gap-3">
      <PageHead kicker="I tuoi numeri" title="Statistiche" lede="Allenamento e campionato, confrontati periodo su periodo e gara contro gara.">
        <Segmented value={tab} onChange={setTab} options={[{ id: "allenamento", label: <IconLabel icon="bow" size={14}>Allenamento</IconLabel> }, { id: "gare", label: <IconLabel icon="trophy" size={14}>Gare</IconLabel> }]} />
      </PageHead>
      {loading ? <Loading /> : null}
      {error ? <ErrorNote text={error} /> : null}

      {tab === "allenamento" ? (
        <>
          <Chips value={period} onChange={setPeriod} options={PERIODS} />
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Allenamenti" value={String(inPeriod.length)} delta={period === "all" ? null : delta(inPeriod.length, prevPeriod.length)} color="#5aa6e8" icon={<Glyph name="calendar" size={16} />} />
            <Kpi label="Frecce" value={arrowsNow.toLocaleString("it-IT")} delta={period === "all" ? null : delta(arrowsNow, arrowsPrev)} color="#3d8f5f" icon={<Glyph name="arrow" size={16} />} />
            <Kpi label="Media freccia" value={fmtAvg(avgNow)} delta={period === "all" ? null : delta(avgNow, avgPrev)} color="#e0b15a" icon={<Glyph name="target" size={16} />} />
            <Kpi label="Miglior seduta" value={best ? best.toFixed(2) : "—"} color="#c4a2f2" icon={<Glyph name="level" size={16} />} />
          </div>
          <Card>
            <SectionHead title="Frecce per settimana" sub="Barre impilate per arco · linea = media a freccia (asse destro)" />
            <ComboBars data={weekly} stacks={bows.map((b, i) => ({ key: b, name: bowLabel(b), color: BOW_COLORS[i % BOW_COLORS.length] }))} line={{ key: "media", name: "Media" }} />
          </Card>
          <Card>
            <SectionHead title="Costanza" sub={`${Object.values(heat).filter((n) => n > 0).length} giorni di tiro nelle ultime 18 settimane`} />
            <ActivityHeat days={heat} />
          </Card>
          <Card>
            <SectionHead title="Media, seduta dopo seduta" sub="Ultime 20 nel periodo" />
            <AvgLine data={line} />
          </Card>
          <Card>
            <SectionHead title="Dove finiscono" sub={`${distTotal.toLocaleString("it-IT")} frecce, da sempre · colori del bersaglio`} />
            {distTotal ? (
              <div className="mb-2 flex items-center justify-around gap-2">
                <Ring value={gold / distTotal} label={`${Math.round((gold / distTotal) * 100)}%`} sub="nell'oro" color="#f2c94c" />
                <Ring value={xs / distTotal} label={`${Math.round((xs / distTotal) * 100)}%`} sub="X" color="#e0b15a" size={78} />
                <Ring value={miss / distTotal} label={`${Math.round((miss / distTotal) * 100)}%`} sub="fuori" color="#e5484d" size={78} />
              </div>
            ) : null}
            <DistBars data={bars} />
          </Card>
          {data ? <AimCard series={data.series} /> : null}
          {data ? (
            <Card>
              <SectionHead title="Per arco" />
              <ul className="grid gap-2">
                {data.byBow.map((b, i) => {
                  const maxAvg = Math.max(...data.byBow.map((x) => x.avg), 1);
                  return (
                    <li key={b.bow} className="grid gap-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-semibold">{bowLabel(b.bow)}</span>
                        <span className="text-xs tabular-nums text-muted">{fmtAvg(b.avg)} · {b.arrows} frecce</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div className="aa-grow h-full rounded-full" style={{ width: `${(b.avg / maxAvg) * 100}%`, background: BOW_COLORS[i % BOW_COLORS.length] }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
          <DistanceCard training={data?.byDistance ?? []} competitions={comps.data?.competitions ?? []} userId={me.userId ?? ""} />
        </>
      ) : (
        <>
          {comps.loading ? <p className="text-xs text-muted">Carico le gare…</p> : null}
          {comps.error ? <ErrorNote text={comps.error} /> : null}
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Gare" value={String(mine.length)} color="#5aa6e8" icon={<Glyph name="trophy" size={16} />} />
            <Kpi label="Piazzole" value={String(sumOf((e) => e.laneCount))} color="#3d8f5f" icon={<Glyph name="flag" size={16} />} />
            <Kpi label="Punti" value={String(sumOf((e) => e.score))} delta={last?.score != null && prev?.score ? delta(last.score, prev.score) : null} color="#e0b15a" icon={<Glyph name="target" size={16} />} />
            <Kpi label="Spot" value={String(sumOf((e) => e.spot))} color="#e07a72" icon={<Glyph name="sparkle" size={16} />} />
          </div>
          <Card className="grid gap-2">
            <SectionHead title="Campionato" sub={`${sumOf((e) => e.championshipPoints)} punti campionato in totale`} />
            {last && prev ? (
              <p className="text-xs text-muted">
                Ultima gara {last.score ?? "—"} punti e {last.spot ?? "—"} spot, contro {prev.score ?? "—"} e {prev.spot ?? "—"} della precedente
                {last.score != null && prev.score != null ? ` (${last.score - prev.score >= 0 ? "+" : ""}${last.score - prev.score} punti)` : ""}.
              </p>
            ) : (
              <p className="text-xs text-muted">Il confronto tra gare compare dalla seconda che segni.</p>
            )}
            <GaraTrend points={mine} />
          </Card>
          <Card><SectionHead title="Punti, gara dopo gara" /><ScoreLine data={gara} label="Punti" /></Card>
          <Card><SectionHead title="Spot, gara dopo gara" /><ScoreLine data={spots} label="Spot" empty="Servono almeno due gare con gli spot." /></Card>
          <Card><SectionHead title="Punti campionato, somma" /><ScoreLine data={season} label="Campionato" empty="Servono almeno due gare con i punti campionato." /></Card>
          <SagomaCard userId={me.userId ?? ""} />
        </>
      )}
    </div>
  );
}

function DistanceCard({
  training,
  competitions,
  userId,
}: {
  training: { distance: number; arrows: number; avg: number }[];
  competitions: { entries: { userId: string; piazzole: { score: number; arrows?: number[]; distanceM?: number | null }[] }[] }[];
  userId: string;
}) {
  const bag = new Map<number, { n: number; points: number }>();
  for (const row of training) {
    const cur = bag.get(row.distance) ?? { n: 0, points: 0 };
    cur.n += row.arrows;
    cur.points += row.avg * row.arrows;
    bag.set(row.distance, cur);
  }
  for (const comp of competitions) {
    for (const entry of comp.entries) {
      if (entry.userId !== userId) continue;
      for (const lane of entry.piazzole) {
        if (lane.distanceM == null || lane.distanceM <= 0) continue;
        const n = lane.arrows?.length || 1;
        const cur = bag.get(lane.distanceM) ?? { n: 0, points: 0 };
        cur.n += n;
        cur.points += lane.score;
        bag.set(lane.distanceM, cur);
      }
    }
  }
  const rows = [...bag.entries()].filter(([, row]) => row.n > 0).sort((a, b) => a[0] - b[0]);
  const best = rows.length ? rows[rows.length - 1][0] : null;
  const total = rows.reduce((sum, [, row]) => sum + row.n, 0);
  const weighted = rows.reduce((sum, [distance, row]) => sum + distance * row.n, 0);
  return (
    <Card>
      <SectionHead title="Distanze" />
      {rows.length === 0 ? <p className="mt-1 text-sm text-muted">Quando segni i metri in allenamento o sulla piazzola, qui vedi la migliore e la media.</p> : (
        <>
          <p className="mt-1 text-sm text-muted">Migliore {best} m{total ? ` · media ${(weighted / total).toFixed(1)} m` : ""}. Conta allenamenti e gare.</p>
          <ul className="mt-2 grid gap-1 text-sm">
            {rows.map(([distance, row]) => (
              <li key={distance} className="flex justify-between gap-3">
                <span>{distance} m</span>
                <span className="tabular-nums text-muted">{row.n} tiri · media {(row.points / row.n).toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function SagomaCard({ userId }: { userId: string }) {
  const board = useLoad("skill-board", () => skillBoard());
  const mine = (board.data?.sagoma ?? []).find((row) => row.userId === userId);
  const rows = (board.data?.animals ?? [])
    .filter((row) => row.userId === userId && row.n > 0)
    .map((row) => {
      const animal = animalByLabel(row.label);
      return { animal, avg: row.points / row.n, n: row.n, known: animal.label.toLowerCase() === row.label.trim().toLowerCase() };
    })
    .filter((row) => row.known)
    .sort((a, b) => b.avg - a.avg || a.animal.label.localeCompare(b.animal.label, "it"));
  const best = rows[0];
  const worst = rows.length > 1 ? rows[rows.length - 1] : null;
  return (
    <Card>
      <SectionHead title="Sagome 3D" />
      {mine && mine.n > 0 ? <p className="mb-3 text-sm text-muted">Sagome 3D, tue: media {(mine.points / mine.n).toFixed(1)} su {mine.n} tiri, tra gare e allenamenti.</p> : <p className="mb-3 text-sm text-muted">I tiri di sagoma in gara e in allenamento finiscono qui, solo i tuoi.</p>}
      {best ? (
        <div className="grid grid-cols-2 gap-3">
          <AnimalStat title="Migliore" label={best.animal.label} src={best.animal.src} avg={best.avg} n={best.n} />
          {worst ? <AnimalStat title="Peggiore" label={worst.animal.label} src={worst.animal.src} avg={worst.avg} n={worst.n} /> : <p className="self-center text-sm text-muted">La peggiore compare con due animali diversi.</p>}
        </div>
      ) : (
        <p className="text-sm text-muted">Quando segni le piazzole di sagoma scegliendo l'animale, qui vedi quella dove punti meglio e quella dove punti peggio.</p>
      )}
    </Card>
  );
}

function AnimalStat({ title, label, src, avg, n }: { title: string; label: string; src: string; avg: number; n: number }) {
  return (
    <div className="aa-kpi">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
      <img src={src} alt="" className="mx-auto h-16 w-full object-contain" />
      <p className="truncate font-semibold">{label}</p>
      <p className="text-sm tabular-nums text-muted">{avg.toFixed(1)} di media · {n} {n === 1 ? "tiro" : "tiri"}</p>
    </div>
  );
}

function AimCard({ series }: { series: { aimTarget: string; aimAngle: string; arrows: number; avg: number }[] }) {
  const groups = new Map<string, { target: string; angle: string; sessions: number; arrows: number; points: number }>();
  for (const row of series) {
    if (!row.aimTarget) continue;
    const key = `${row.aimTarget}|${row.aimAngle}`;
    const cur = groups.get(key) ?? { target: row.aimTarget, angle: row.aimAngle, sessions: 0, arrows: 0, points: 0 };
    cur.sessions += 1;
    cur.arrows += row.arrows;
    cur.points += row.avg * row.arrows;
    groups.set(key, cur);
  }
  const rows = [...groups.values()].sort((a, b) => b.arrows - a.arrows);
  return (
    <Card>
      <SectionHead title="Dove punti" />
      {rows.length ? (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={`${row.target}-${row.angle}`} className="flex items-baseline justify-between gap-3 text-sm">
              <span>{aimTargetLabel(row.target)} · {aimAngleLabel(row.angle)}</span>
              <span className="shrink-0 tabular-nums text-muted">{row.sessions} {row.sessions === 1 ? "volta" : "volte"} · {fmtAvg(row.arrows ? row.points / row.arrows : 0)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Quando segni padiglione, sagoma, piattello o altro, e da che parte stava il bersaglio, il confronto compare qui.</p>
      )}
    </Card>
  );
}
