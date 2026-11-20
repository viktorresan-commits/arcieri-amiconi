import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { clearRanking, rankings } from "@/lib/arcieri/training.api";
import { BOWS, DISCIPLINES, DISTANCES, DIVISIONS, memberLabel } from "@/lib/arcieri/labels";
import { fmtAvg, fmtPct } from "@/lib/arcieri/scoring";
import type { PeriodKind } from "@/lib/arcieri/time";
import type { RankMetric } from "@/lib/arcieri/rank";
import { useLoad } from "@/lib/arcieri/use-load";
import { useMember } from "@/components/shell";
import { Empty, ErrorNote, HoldDelete, Loading, PageHead, Select } from "@/components/kit";
import { RankRow } from "@/components/podium";
import { useTeamAvatars } from "@/components/avatar-hero";
import { AVATAR_DEFAULT } from "@/lib/arcieri/avatar";

export const Route = createFileRoute("/_app/classifiche")({ component: Page });

const METRICS: { id: RankMetric; label: string }[] = [
  { id: "avg", label: "Media" },
  { id: "best", label: "Miglior sessione" },
  { id: "precision", label: "Precisione" },
  { id: "consistency", label: "Costanza" },
  { id: "improvement", label: "Miglioramento" },
  { id: "sessions", label: "Allenamenti" },
  { id: "arrows", label: "Frecce" },
  { id: "points", label: "Totale punti" },
];

function Page() {
  const { me } = useMember();
  const [nonce, setNonce] = useState(0);
  const [period, setPeriod] = useState<PeriodKind>("all");
  const [metric, setMetric] = useState<RankMetric>("points");
  const [bow, setBow] = useState("");
  const [distance, setDistance] = useState("");
  const [face, setFace] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [division, setDivision] = useState("");
  const key = [nonce, period, metric, bow, distance, face, discipline].join("|");
  const { data, error, loading } = useLoad(key, () =>
    rankings({ data: { period, metric, bow, distanceM: distance, face, discipline } }),
  );
  const looks = useTeamAvatars();
  const rows = (data?.rows ?? []).filter((row) => !division || row.division === division);
  const mine = rows.findIndex((row) => row.userId === me.userId);
  return (
    <div className="grid min-w-0 gap-3">
      <PageHead title="Classifica" lede="Conta gli allenamenti e le piazzole di ogni gara. Poi puoi filtrare." />
      <div className="flex flex-wrap gap-2">
        {(["day", "week", "month", "year", "all"] as const).map((p) => (
          <button key={p} type="button" onClick={() => setPeriod(p)} className={`min-h-11 rounded-full border px-3 text-sm ${period === p ? "border-accent bg-accent text-accent-fg" : "border-line"}`}>
            {p === "day" ? "Oggi" : p === "week" ? "Settimana" : p === "month" ? "Mese" : p === "year" ? "Anno" : "Sempre"}
          </button>
        ))}
      </div>
      <Select value={metric} onChange={(e) => setMetric(e.target.value as RankMetric)}>
        {METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Select value={bow} onChange={(e) => setBow(e.target.value)}><option value="">Tutti gli archi</option>{BOWS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
        <Select value={distance} onChange={(e) => setDistance(e.target.value)}><option value="">Tutte le distanze</option>{DISTANCES.map((d) => <option key={d} value={d}>{d} m</option>)}</Select>
        <Select value={face} onChange={(e) => setFace(e.target.value)}>
          <option value="">Tutti i bersagli</option>
          <option value="wa10">WA 10</option>
          <option value="field6">Field</option>
          <option value="threed">3D</option>
          <option value="sagoma8">Sagoma</option>
        </Select>
        <Select value={discipline} onChange={(e) => setDiscipline(e.target.value)}><option value="">Tutte le discipline</option>{DISCIPLINES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</Select>
        <Select value={division} onChange={(e) => setDivision(e.target.value)}>
          <option value="">Tutte le categorie</option>
          {DIVISIONS.map((name) => <option key={name} value={name}>{name}</option>)}
        </Select>
      </div>
      {loading ? <Loading /> : null}
      {error ? <ErrorNote text={error} /> : null}
      {data?.blocked ? <ErrorNote text={data.blocked} /> : null}
      {data?.warning ? <p className="text-sm text-muted">{data.warning}</p> : null}
      {data && !data.blocked && data.rows.length === 0 ? <Empty title="Nessun tiro in questo filtro" text="Quando qualcuno registra frecce compatibili, la classifica si riempie da sola." /> : null}
      <div className="grid gap-2 pb-20">
        {rows.map((row, index) => {
          const name = memberLabel(row, data?.rows ?? []);
          const show = metric === "avg" || metric === "best" ? fmtAvg(row.value ?? 0) : metric === "precision" || metric === "consistency" || metric === "improvement" ? row.value == null ? "—" : fmtPct(row.value) : String(Math.round(row.value ?? 0));
          const own = row.userId === me.userId;
          const canDrop = own || me.role === "admin";
          const sub = [
            row.division,
            `${row.arrows} frecce`,
            `${row.sessions} ${row.sessions === 1 ? "allenamento" : "allenamenti"}`,
            row.lanes ? `${row.lanes} ${row.lanes === 1 ? "piazzola" : "piazzole"}` : "",
          ].filter(Boolean).join(" · ") + (row.improvement != null ? ` · ${row.improvement > 0 ? "+" : ""}${fmtPct(row.improvement)} sul periodo prima` : "");
          const card = <RankRow pos={division ? index + 1 : row.position} name={name} sub={sub} value={row.value == null ? "—" : show} look={looks[row.userId] ?? AVATAR_DEFAULT} me={own} />;
          if (!canDrop) return <div key={row.userId}>{card}</div>;
          return (
            <HoldDelete
              key={row.userId}
              hint={own}
              label={own
                ? "Togliere il tuo nome da questa classifica? Si cancellano gli allenamenti che rientrano nel filtro."
                : `Eliminare i tiri di ${name} in questo filtro?`}
              onDelete={() => clearRanking({ data: { userId: row.userId, period, bow, distanceM: distance, face, discipline } }).then(() => setNonce((n) => n + 1))}
            >
              {card}
            </HoldDelete>
          );
        })}
      </div>
      {mine >= 3 ? (
        <div className="pointer-events-none sticky bottom-24 z-10 -mt-20 md:bottom-4">
          <div className="pointer-events-auto">
            <RankRow pos={division ? mine + 1 : rows[mine].position} name={memberLabel(rows[mine], data?.rows ?? [])} sub="La tua posizione" value={rows[mine].value == null ? "—" : metric === "avg" || metric === "best" ? fmtAvg(rows[mine].value ?? 0) : metric === "precision" || metric === "consistency" || metric === "improvement" ? fmtPct(rows[mine].value ?? 0) : String(Math.round(rows[mine].value ?? 0))} look={looks[me.userId ?? ""] ?? AVATAR_DEFAULT} me />
          </div>
        </div>
      ) : null}
    </div>
  );
}

