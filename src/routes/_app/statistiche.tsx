import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { statsSeries } from "@/lib/arcieri/training.api";
import { listCompetitions, skillBoard } from "@/lib/arcieri/club.api";
import { fmtAvg, fmtPct, aimAngleLabel, aimTargetLabel } from "@/lib/arcieri/scoring";
import { useLoad } from "@/lib/arcieri/use-load";
import { useMember } from "@/components/shell";
import { AvgLine, DistBars, ScoreLine } from "@/components/charts";
import { GaraTrend, type GaraPoint } from "@/components/gara-trend";
import { Card, ErrorNote, Loading, PageHead } from "@/components/kit";
import { bowLabel } from "@/lib/arcieri/labels";
import { animalByLabel } from "@/lib/arcieri/sagome";

export const Route = createFileRoute("/_app/statistiche")({ component: Page });

function Page() {
  const [nonce] = useState(0);
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
  const line = (data?.series ?? []).slice(-12).map((s) => ({ name: s.day.slice(5), avg: Number(s.avg.toFixed(2)) }));
  const bars = (data?.distribution ?? []).map((d) => ({ name: d.isX ? `${d.score}X` : String(d.score), n: d.n }));
  return (
    <div className="grid gap-3">
      <PageHead title="Statistiche" lede="Allenamento e campionato. I confronti sono gara contro gara, non un totale mescolato." />
      <Card className="grid gap-3">
        <h2 className="font-display text-2xl">Campionato</h2>
        {comps.loading ? <p className="text-sm text-muted">Carico le gare…</p> : null}
        {comps.error ? <ErrorNote text={comps.error} /> : null}
        <div className="grid grid-cols-2 gap-2">
          <Mini k="Gare" v={String(mine.length)} />
          <Mini k="Piazzole" v={String(sumOf((e) => e.laneCount))} />
          <Mini k="Punti" v={String(sumOf((e) => e.score))} />
          <Mini k="Spot" v={String(sumOf((e) => e.spot))} />
          <Mini k="Punti campionato" v={String(sumOf((e) => e.championshipPoints))} />
        </div>
        {last && prev ? (
          <p className="text-sm text-muted">
            Ultima gara {last.score ?? "—"} punti e {last.spot ?? "—"} spot, contro {prev.score ?? "—"} e {prev.spot ?? "—"} della precedente
            {last.score != null && prev.score != null ? ` (${last.score - prev.score >= 0 ? "+" : ""}${last.score - prev.score} punti)` : ""}.
          </p>
        ) : (
          <p className="text-sm text-muted">Il confronto tra gare compare dalla seconda che segni. Tocca un punteggio in Gare per vederlo anche lì sotto.</p>
        )}
        <GaraTrend points={mine} />
      </Card>
      <SagomaCard userId={me.userId ?? ""} />
      <DistanceCard training={data?.byDistance ?? []} competitions={comps.data?.competitions ?? []} userId={me.userId ?? ""} />
      <Card><h2 className="mb-2 font-display text-2xl">Punti, gara dopo gara</h2><ScoreLine data={gara} label="Punti" /></Card>
      <Card><h2 className="mb-2 font-display text-2xl">Spot, gara dopo gara</h2><ScoreLine data={spots} label="Spot" empty="Servono almeno due gare con gli spot." /></Card>
      <Card><h2 className="mb-2 font-display text-2xl">Punti campionato, somma</h2><ScoreLine data={season} label="Campionato" empty="Servono almeno due gare con i punti campionato." /></Card>
      {loading ? <Loading /> : null}
      {error ? <ErrorNote text={error} /> : null}
      {data?.progress ? (
        <Card>
          <p className="text-sm text-muted">Media ultimi 30 giorni {fmtAvg(data.progress.recent)}. Trenta giorni prima {fmtAvg(data.progress.previous)}.</p>
          <p className="font-display text-4xl">{data.progress.delta >= 0 ? "+" : ""}{fmtPct(data.progress.delta)}</p>
        </Card>
      ) : data ? (
        <Card><p className="text-sm text-muted">Il confronto tra mesi compare quando hai almeno un po' di frecce in entrambi i periodi.</p></Card>
      ) : null}
      {data ? <Card><h2 className="mb-2 font-display text-2xl">Allenamento dopo allenamento</h2><AvgLine data={line} /></Card> : null}
      {data ? <AimCard series={data.series} /> : null}
      {data ? <Card><h2 className="mb-2 font-display text-2xl">Dove finiscono</h2><DistBars data={bars} /></Card> : null}
      {data ? (
        <Card>
          <h2 className="font-display text-2xl">Per arco</h2>
          <ul className="mt-2 text-sm">{data.byBow.map((b) => <li key={b.bow}>{bowLabel(b.bow)} · {fmtAvg(b.avg)} · {b.arrows} frecce</li>)}</ul>
        </Card>
      ) : null}
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
      <h2 className="font-display text-2xl">Distanze</h2>
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
      <h2 className="mb-2 font-display text-2xl">Sagome</h2>
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
    <div className="rounded-xl border border-line p-2">
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      <img src={src} alt="" className="mx-auto h-16 w-full object-contain" />
      <p className="truncate font-semibold">{label}</p>
      <p className="text-sm tabular-nums text-muted">{avg.toFixed(1)} di media · {n} {n === 1 ? "tiro" : "tiri"}</p>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted">{k}</p>
      <p className="font-display text-3xl tabular-nums leading-none">{v}</p>
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
      <h2 className="mb-2 font-display text-2xl">Dove punti</h2>
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
