import { cx } from "@/components/kit";

export type GaraPoint = {
  id: string;
  day: string;
  name: string;
  laneCount: number | null;
  score: number | null;
  spot: number | null;
  championshipPoints: number | null;
};

function sign(n: number) {
  return `${n > 0 ? "+" : ""}${n}`;
}

function line(g: GaraPoint) {
  return [
    g.laneCount != null ? `${g.laneCount} piazzole` : null,
    g.score != null ? `${g.score} punti` : null,
    g.spot != null ? `${g.spot} spot` : null,
    g.championshipPoints != null ? `${g.championshipPoints} pt campionato` : null,
  ].filter(Boolean).join(" · ") || "Senza numeri";
}

function deltaText(curr: GaraPoint, prev: GaraPoint) {
  const bits = [
    curr.score != null && prev.score != null ? `${sign(curr.score - prev.score)} punti` : null,
    curr.spot != null && prev.spot != null ? `${sign(curr.spot - prev.spot)} spot` : null,
    curr.championshipPoints != null && prev.championshipPoints != null ? `${sign(curr.championshipPoints - prev.championshipPoints)} campionato` : null,
    curr.laneCount != null && prev.laneCount != null ? `${sign(curr.laneCount - prev.laneCount)} piazzole` : null,
  ].filter(Boolean);
  return bits.length ? `Rispetto alla precedente: ${bits.join(" · ")}` : "La precedente non ha gli stessi numeri da confrontare.";
}

export function GaraTrend({ points, activeId }: { points: GaraPoint[]; activeId?: string }) {
  if (!points.length) return <p className="text-sm text-muted">Nessun punteggio da confrontare.</p>;
  return (
    <ol className="grid gap-2">
      {points.map((g, i) => {
        const prev = points[i - 1];
        return (
          <li key={g.id} className={cx("rounded-xl border px-3 py-2", g.id === activeId ? "border-accent" : "border-line")}>
            <p className="text-xs text-muted">{g.day}{g.name ? ` · ${g.name}` : ""}</p>
            <p className="text-sm font-semibold">{line(g)}</p>
            <p className="text-xs text-muted">{prev ? deltaText(g, prev) : "Prima gara segnata. Il confronto arriva con la successiva."}</p>
          </li>
        );
      })}
    </ol>
  );
}
