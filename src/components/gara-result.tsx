import { memberLabel, divisionOf, type NameBits } from "@/lib/arcieri/labels";
import { aimSpot } from "@/lib/arcieri/scoring";
import { BoarTarget } from "@/components/boar-target";

type Lane = { n: number; score: number; arrows?: number[]; label?: string; distanceM?: number | null; aimAngle?: string };
export type GaraPerson = NameBits & {
  userId: string;
  score: number | null;
  spot: number | null;
  championshipPoints: number | null;
  rank: number | null;
  category: string;
  laneCount: number | null;
  piazzole: Lane[];
  targetKind?: string;
  sagomaMax?: number | null;
};

function division(category: string) {
  return divisionOf(category);
}

function placeDots(marks: { key: string; score: number; label: string; angle: string; distance: number | null }[]) {
  return marks.map((mark, index) => {
    const spot = aimSpot(mark.score, mark.angle, mark.distance, index, "padiglione");
    const best = Math.max(...marks.map((row) => row.score));
    return { ...mark, nx: spot.nx, ny: spot.ny, best: mark.score === best && best > 0 };
  });
}

export function GaraResult({ title, entry, peers }: { title: string; entry: GaraPerson; peers: GaraPerson[] }) {
  const lanes = [...entry.piazzole].sort((a, b) => a.n - b.n);
  const sum = lanes.reduce((total, lane) => total + lane.score, 0);
  const punti = entry.score ?? (lanes.length ? sum : null);
  const media = lanes.length ? sum / lanes.length : null;
  const best = lanes.length ? lanes.reduce((top, lane) => (lane.score > top.score ? lane : top), lanes[0]) : null;
  const worst = lanes.length ? lanes.reduce((low, lane) => (lane.score < low.score ? lane : low), lanes[0]) : null;
  const shots = lanes.flatMap((lane) => (lane.arrows?.length ? lane.arrows : [lane.score]));
  const counts = new Map<number, number>();
  for (const shot of shots) counts.set(shot, (counts.get(shot) ?? 0) + 1);
  const bands = [...counts.entries()].sort((a, b) => b[0] - a[0]);
  const maxBand = Math.max(1, ...bands.map(([, n]) => n));
  const sagoma = entry.targetKind === "sagoma";
  const boarShots = lanes.flatMap((lane) => {
    const arrows = lane.arrows?.length ? lane.arrows : [lane.score];
    return arrows.filter((score) => score >= 0).map((score, index) => {
      const spot = aimSpot(score, lane.aimAngle ?? "", lane.distanceM ?? null, lane.n * 4 + index, "sagoma");
      return { score: score >= 10 ? 8 : score, nx: spot.nx, ny: spot.ny };
    });
  });
  const hasArrows = lanes.some((lane) => (lane.arrows?.length ?? 0) > 0);
  const marks = lanes.flatMap((lane) =>
    lane.arrows?.length
      ? lane.arrows.map((score, index) => ({ key: `${lane.n}-${index}`, score, label: String(score), angle: lane.aimAngle ?? "", distance: lane.distanceM ?? null }))
      : [{ key: String(lane.n), score: lane.score, label: String(lane.n), angle: lane.aimAngle ?? "", distance: lane.distanceM ?? null }],
  );
  const dots = marks.length ? placeDots(marks) : [];
  const board = [...peers]
    .filter((person) => person.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || memberLabel(a, peers).localeCompare(memberLabel(b, peers), "it"));
  const posto = entry.rank != null ? `${entry.rank}°${division(entry.category) ? ` ${division(entry.category)}` : ""}` : division(entry.category);
  const high = lanes.length ? Math.max(...lanes.map((lane) => lane.score)) : 0;
  const low = lanes.length ? Math.min(...lanes.map((lane) => lane.score)) : 0;
  const span = high - low || 1;
  const course = lanes.map((lane, index) => {
    const x = lanes.length === 1 ? 50 : (index / (lanes.length - 1)) * 100;
    const y = 36 - ((lane.score - low) / span) * 28;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="grid min-w-0 gap-3 rounded-xl border border-line p-3">
      <div>
        <p className="text-xs text-muted">Risultato · {title}</p>
        <p className="font-display text-2xl leading-tight">{memberLabel(entry, peers)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <Mini k="Punti" v={punti == null ? "—" : String(punti)} />
        <Mini k="Media piazzola" v={media == null ? "—" : media.toFixed(1)} />
        <Mini k="Spot" v={entry.spot == null ? "—" : String(entry.spot)} />
        <Mini k="Campionato" v={entry.championshipPoints == null ? "—" : String(entry.championshipPoints)} />
        <Mini k="Posto" v={posto || "—"} />
        <Mini k="Piazzole" v={String(entry.laneCount ?? lanes.length)} />
      </div>
      {hasArrows ? <p className="text-sm text-muted">{shots.length} frecce su {lanes.length} piazzole. I punti sono la somma.</p> : null}
      {lanes.length === 0 ? (
        <p className="text-sm text-muted">Aggiungi i punti delle piazzole per vedere il bersaglio, la distribuzione e l'andamento.</p>
      ) : (
        <>
          {sagoma ? (
            <div>
              <h3 className="mb-1 font-display text-xl">Sagome 3D</h3>
              <p className="mb-2 text-xs text-muted">Sintesi della gara. Rosso e giallo sono lo spot (8), blu e nero sono il corpo (5), fuori dalla sagoma è 0.</p>
              {boarShots.length ? <BoarTarget animal="sagome-3d" shots={boarShots} /> : <p className="text-xs text-muted">Segna le frecce, per esempio 8+5+0, per vederle sulla sintesi.</p>}
            </div>
          ) : (
            <div>
              <h3 className="mb-1 font-display text-xl">Padiglione</h3>
              <p className="mb-2 text-xs text-muted">{hasArrows ? "Ogni punto è una freccia. Più è al centro, più alto è il punteggio. Non è il buco vero sul paglione: quello si segna in allenamento." : "Ogni punto è una piazzola. Più è al centro, più alto è il punteggio di questa gara. Non è il buco vero sul paglione: quello si segna in allenamento."}</p>
              <svg viewBox="-1.15 -1.15 2.3 2.3" className="mx-auto aspect-square w-full max-w-sm" role="img" aria-label="Padiglione con le piazzole">
                <circle cx="0" cy="0" r="1.08" fill="var(--elev)" />
                <circle cx="0" cy="0" r="1" fill="#f4f1ea" />
                <circle cx="0" cy="0" r="0.78" fill="#1a1c1e" />
                <circle cx="0" cy="0" r="0.56" fill="#2a6294" />
                <circle cx="0" cy="0" r="0.34" fill="#c4473d" />
                <circle cx="0" cy="0" r="0.16" fill="#e6b325" />
                {dots.map((dot) => (
                  <g key={dot.key}>
                    <circle cx={dot.nx} cy={dot.ny} r="0.055" fill={dot.best ? "#e07a2f" : "#14181c"} stroke="#f4f1ea" strokeWidth="0.012" />
                    <text x={dot.nx} y={dot.ny + 0.018} textAnchor="middle" fontSize="0.055" fill="#f4f1ea" fontFamily="var(--font-disp)">{dot.label}</text>
                  </g>
                ))}
              </svg>
            </div>
          )}
          <div>
            <h3 className="mb-2 font-display text-xl">Andamento</h3>
            <svg viewBox="0 0 100 44" className="h-28 w-full" role="img" aria-label="Punteggio per piazzola">
              <polyline points={course} fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
              {lanes.map((lane, index) => {
                const x = lanes.length === 1 ? 50 : (index / (lanes.length - 1)) * 100;
                const y = 36 - ((lane.score - low) / span) * 28;
                return <circle key={lane.n} cx={x} cy={y} r="1.3" fill="var(--primary)" />;
              })}
            </svg>
            <p className="text-xs text-muted">Dalla piazzola 1 alla {lanes[lanes.length - 1]?.n}. {best ? `La migliore è la ${best.n}${best.label ? ` ${best.label}` : ""} con ${best.arrows?.length ? `${best.arrows.join("+")} = ` : ""}${best.score}.` : ""} {worst && best && worst.n !== best.n ? `La più bassa è la ${worst.n}${worst.label ? ` ${worst.label}` : ""} con ${worst.arrows?.length ? `${worst.arrows.join("+")} = ` : ""}${worst.score}.` : ""}</p>
            {lanes.some((lane) => lane.label || lane.distanceM != null) ? (
              <ul className="mt-2 grid gap-1 text-sm">
                {lanes.map((lane) => (
                  <li key={lane.n} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{lane.n}. {lane.label || "Senza nome"}</span>
                    <span className="shrink-0 tabular-nums">{lane.distanceM != null ? `${lane.distanceM} m · ` : ""}{lane.arrows?.length ? lane.arrows.join("+") : lane.score}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <DistanceStats lanes={lanes} />
          <div>
            <h3 className="mb-2 font-display text-xl">{hasArrows ? "Frecce per zona" : "Quanti tiri per zona"}</h3>
            <ul className="grid gap-1.5">
              {bands.map(([score, n]) => (
                <li key={score} className="grid grid-cols-[3rem_1fr_2rem] items-center gap-2 text-sm">
                  <span className="tabular-nums font-semibold">{score}</span>
                  <span className="h-3 overflow-hidden rounded-full bg-line">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(n / maxBand) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-muted">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {board.length ? (
        <div>
          <h3 className="mb-1 font-display text-xl">Classifica di questa gara</h3>
          <p className="mb-2 text-xs text-muted">Solo tra chi ha messo il punteggio nell'app. Il posto ufficiale resta quello scritto a mano.</p>
          <ol className="grid gap-1">
            {board.map((person, index) => (
              <li key={person.userId} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{index + 1}. {memberLabel(person, peers)}</span>
                <span className="shrink-0 tabular-nums">{person.score}{person.rank != null ? ` · ${person.rank}°` : ""}{division(person.category) ? ` ${division(person.category)}` : ""}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function DistanceStats({ lanes }: { lanes: Lane[] }) {
  const rows = lanes.filter((lane) => lane.distanceM != null && lane.distanceM > 0);
  if (!rows.length) return null;
  const values = rows.map((lane) => lane.distanceM ?? 0);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const by = new Map<number, { n: number; points: number }>();
  for (const lane of rows) {
    const key = lane.distanceM ?? 0;
    const cur = by.get(key) ?? { n: 0, points: 0 };
    cur.n += 1;
    cur.points += lane.score;
    by.set(key, cur);
  }
  return (
    <div>
      <h3 className="mb-2 font-display text-xl">Distanze</h3>
      <p className="mb-2 text-sm text-muted">Media {avg.toFixed(1)} m, dalla più corta {min} m alla più lunga {max} m.</p>
      <ul className="grid gap-1 text-sm">
        {[...by.entries()].sort((a, b) => a[0] - b[0]).map(([distance, bag]) => (
          <li key={distance} className="flex justify-between gap-3">
            <span>{distance} m</span>
            <span className="tabular-nums text-muted">{bag.n} {bag.n === 1 ? "piazzola" : "piazzole"} · media {(bag.points / bag.n).toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-surface px-2 py-2">
      <p className="text-[11px] text-muted">{k}</p>
      <p className="truncate font-display text-2xl tabular-nums">{v}</p>
    </div>
  );
}
