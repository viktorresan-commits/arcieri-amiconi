import { useTeamAvatars } from "@/components/avatar-hero";
import { ArcherStage, ROLE_STYLE, archerName } from "@/components/archer-stage";
import { InsertFor } from "@/components/insert-for";
import { createFileRoute, Link } from "@tanstack/react-router";
import { archerBoard, listGadgets } from "@/lib/arcieri/club.api";
import { fmtAvg } from "@/lib/arcieri/scoring";
import { useLoad } from "@/lib/arcieri/use-load";
import { AvgLine, ScoreLine } from "@/components/charts";
import { Card, ErrorNote, Loading } from "@/components/kit";
import { HPages } from "@/components/hpages";
import { PrizeMark, prizeTier, topPrizes } from "@/components/prize-mark";
import { KindEmblem, KindHeading } from "@/components/kind-emblem";
import { KINDS } from "@/lib/arcieri/kinds";
import { useState } from "react";
import { setRole } from "@/lib/arcieri/staff.api";
import { refreshCrests } from "@/lib/arcieri/crest";
import { GAME_LEVELS, GAME_MODES, modeOf } from "@/lib/arcieri/game-modes";
import { levelOf } from "@/lib/arcieri/xp";
import { Glyph } from "@/components/icons";
import { ArcherPalmares, Medal } from "@/components/palmares";
import { titleName } from "@/lib/arcieri/fitast-league";
import { Chips } from "@/components/fitast-league";

type Board = Awaited<ReturnType<typeof archerBoard>>;

export const Route = createFileRoute("/_app/arciere/$id")({ component: Page });

function Page() {
  const looks = useTeamAvatars();
  const { id } = Route.useParams();
  const { data, error, loading } = useLoad(`archer-${id}`, () => archerBoard({ data: { id: Number(id) } }));
  const gadgets = useLoad(`gadgets-m${id}`, () => listGadgets({ data: { memberId: Number(id) } }));
  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote text={error || "Errore"} />;
  const { name } = archerName(data);
  const train = data.trainings.slice(-12).map((s) => ({ name: s.day.slice(5), avg: Number(s.avg.toFixed(2)) }));
  // gara dopo gara: tutte le gare con un punteggio, anche quelle degli anni passati (app, portale e archivio FITAST)
  const races = data.stats.seasons.flatMap((s) => s.races).filter((r) => r.score != null).sort((a, b) => a.day.localeCompare(b.day));
  const comps = races.length ? races.map((r) => ({ name: dayTick(r.day, races[0].day.slice(0, 4) !== races[races.length - 1].day.slice(0, 4)), score: r.score as number })) : data.comps.map((c) => ({ name: c.day.slice(5), score: c.score }));
  const raceSince = races[0]?.day.slice(0, 4) ?? "";
  const shownPrizes = topPrizes((gadgets.data?.prizes ?? []).filter((prize) => prize.holders.some((holder) => holder.userId === data.userId)));
  return (
    <div className="grid gap-5">
      {/* il suo arciere, grande e di fronte, con accanto gli ultimi premi: la stessa scheda del proprio profilo */}
      <ArcherStage data={data} look={looks[data.userId] ?? null} />
      {/* una foto dei due arcieri insieme, da condividere come storia */}
      {!data.viewer.self && data.userId && looks[data.userId] ? (
        <Link to="/riepilogo" search={{ vista: "foto", con: data.userId }} className="aa-press flex min-h-12 items-center gap-3 rounded-2xl border border-[#e0b15a]/35 bg-[#e0b15a]/[0.08] px-3">
          <Glyph name="camera" size={20} className="shrink-0 text-[#f1cf8a]" />
          <span className="min-w-0 flex-1 text-sm font-semibold">Fai una foto insieme a {name.split(" ")[0]}</span>
          <Glyph name="chevron" size={16} className="shrink-0 text-muted" />
        </Link>
      ) : null}
      {data.viewerStats ? <CompareWithMe them={data.stats} me={data.viewerStats} name={name.split(" ")[0]} /> : null}
      <ChampionshipCard st={data.stats} />
      {data.stats.last ? <LastGara g={data.stats.last} /> : null}
      <StatsGrid st={data.stats} />
      <SeasonsCard st={data.stats} firstName={name.split(" ")[0]} />
      <RolesCard data={data} />
      {data.viewer.level === "super" && !data.viewer.self ? <InsertFor memberId={data.id} name={name} hasAccount={Boolean(data.userId)} /> : null}
      {data.viewer.level === "super" && !data.viewer.self ? (
        <Link to="/gestisci/$id" params={{ id: String(data.id) }} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-hair bg-white/5 px-4 text-left">
          <span>
            <span className="block font-display text-lg leading-tight">Gestisci i dati di {name.split(" ")[0]}</span>
            <span className="block text-xs text-muted">Allenamenti, gare, analisi del gesto e il resto: elimina quello che non va. Solo tu vedi questa voce.</span>
          </span>
          <span aria-hidden className="text-xl text-muted">›</span>
        </Link>
      ) : null}
      <ArcherPalmares memberId={data.id} firstName={name.split(" ")[0]} />
      <GameRecords games={data.games} mine={data.mine} />
      <Card>
        <h2 className="mb-3 font-display text-2xl">I premi migliori</h2>
        {!gadgets.loading && shownPrizes.length === 0 ? <p className="text-sm text-muted">Nessuno sbloccato.</p> : (
          <div className="grid grid-cols-3 gap-2">
            {shownPrizes.map((prize) => (
              <div key={prize.code} className="grid justify-items-center gap-1 text-center">
                <PrizeMark code={prize.code} size="lg" />
                <p className="text-xs font-semibold leading-tight">{prize.title}</p>
                <p className="text-[10px] text-muted">{prizeTier(prize.code).label}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card className="grid gap-2">
        <KindHeading kind="allenamento" title="Allenamento dopo allenamento" sub="Media per freccia delle ultime sessioni" />
        <AvgLine data={train} />
      </Card>
      <Card className="grid gap-2">
        <KindHeading kind="campionato" title="Gara dopo gara" sub={races.length ? `Punteggio di ${races.length} ${races.length === 1 ? "gara" : "gare"}${raceSince ? `, dal ${raceSince}` : ""}` : "Punteggio nelle gare del calendario"} />
        <ScoreLine data={comps} />
      </Card>
      <p className="text-sm text-muted">Qui si vede solo il riassunto. Note, attrezzatura personale e acquisti restano di chi li ha scritti.</p>
    </div>
  );
}

type Stats = Board["stats"];

/** il giorno sull'asse del grafico: 15/11, o 15/11/24 quando le gare coprono più anni */
const dayTick = (day: string, years: boolean) => {
  const [y, m, d] = day.split("-");
  return years ? `${d}/${m}/${y.slice(2)}` : `${d}/${m}`;
};

const fmtNum = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("it-IT"));

/** Campionato in corso: punti, posto nella generale FITAST, gare vinte e podi */
function ChampionshipCard({ st }: { st: Stats }) {
  return (
    <Card className="grid gap-3" style={{ boxShadow: `inset 0 -3px 0 ${KINDS.campionato.color}55` }}>
      <KindHeading kind="campionato" title="Campionato" sub={st.seasonName} />
      <div className="grid grid-cols-[1.25fr_1fr_1fr] gap-2 text-center">
        <div className="rounded-2xl bg-white/[0.05] p-2.5">
          <p className="font-display text-4xl leading-none tabular-nums">{fmtNum(st.champSeason)}</p>
          <p className="mt-1 text-[0.68rem] text-muted">punti campionato</p>
        </div>
        <div className="rounded-2xl bg-white/[0.05] p-2.5">
          <p className="font-display text-4xl leading-none tabular-nums">{st.winsSeason}</p>
          <p className="mt-1 text-[0.68rem] text-muted">{st.winsSeason === 1 ? "gara vinta" : "gare vinte"}</p>
        </div>
        <div className="rounded-2xl bg-white/[0.05] p-2.5">
          <p className="font-display text-4xl leading-none tabular-nums">{st.podiumsSeason}</p>
          <p className="mt-1 text-[0.68rem] text-muted">{st.podiumsSeason === 1 ? "podio" : "podi"}</p>
        </div>
      </div>
      {st.fitast ? <FitastPlaces r={st.fitast} /> : null}
      <p className="text-sm text-muted">
        {st.gareSeason ? `${st.gareSeason} ${st.gareSeason === 1 ? "gara" : "gare"} in questa stagione` : "Nessuna gara in questa stagione"}
        {st.fitast?.points != null ? ` · ${fmtNum(st.fitast.points)} punti nella generale FITAST` : ""}
      </p>
    </Card>
  );
}

/** I posti veri nella classifica generale arcieri FITAST: categoria, generale, divisione e compagnia */
function FitastPlaces({ r }: { r: NonNullable<Stats["fitast"]> }) {
  const cells: Array<{ n: number | null; label: string; sub: string; of: string }> = [
    { n: r.place, label: "in categoria", sub: titleName(r.category), of: r.size ? `su ${r.size}` : "" },
    { n: r.overall, label: "nella generale", sub: "", of: `su ${r.overallSize} arcieri` },
    { n: r.teamPlace, label: "in compagnia", sub: "", of: r.teamSize ? `su ${r.teamSize}` : "" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {cells.map((c, i) => (
        <div key={c.label} className="grid content-start justify-items-center rounded-2xl p-2.5" style={{ background: i === 0 ? "linear-gradient(180deg, rgb(156 30 49 / 0.55), rgb(66 9 18 / 0.55))" : "rgb(255 255 255 / 0.05)" }}>
          <p className="font-display text-3xl leading-none tabular-nums">{c.n != null ? `${c.n}°` : "—"}</p>
          <p className="mt-1 text-[0.68rem] font-semibold">{c.label}</p>
          {c.sub ? <p className="line-clamp-2 text-[0.62rem] font-semibold leading-tight text-white/85">{c.sub}</p> : null}
          {c.of ? <p className="text-[0.62rem] leading-tight text-muted">{c.of}</p> : null}
        </div>
      ))}
    </div>
  );
}

/** L'ultima gara: posto in classifica, punteggio e punti campionato */
function LastGara({ g }: { g: NonNullable<Stats["last"]> }) {
  const [y, m, d] = g.day.split("-");
  const cells: [string, string][] = [
    ["Posto", g.rank != null ? `${g.rank}°` : "—"],
    ["Punteggio", fmtNum(g.score)],
    ["Punti camp.", fmtNum(g.champ)],
    ["Spot", fmtNum(g.spot)],
  ];
  return (
    <Card className="grid gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">Ultima gara</p>
          <p className="truncate font-display text-xl leading-tight">{g.name}</p>
          <p className="text-xs text-muted">{`${d}/${m}/${y}`}{g.category ? ` · ${g.category}` : ""}</p>
        </div>
        {g.rank != null && g.rank <= 3 ? <Medal place={g.rank} size={46} /> : null}
      </div>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {cells.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-black/20 py-2">
            <p className="font-display text-xl leading-none tabular-nums">{v}</p>
            <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-wider text-muted">{k}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Le statistiche che vedono tutti: frecce e piazzole (allenamenti e gare), gare, punti dell'avatar */
function StatsGrid({ st }: { st: Stats }) {
  const lv = levelOf(Math.max(0, st.xp));
  const items: { kind: "allenamento" | "campionato" | "minigioco"; label: string; value: string }[] = [
    { kind: "allenamento", label: "Allenamenti", value: fmtNum(st.trainings) },
    { kind: "allenamento", label: "Piazzole", value: fmtNum(st.piazzole) },
    { kind: "allenamento", label: "Frecce", value: fmtNum(st.arrows) },
    { kind: "allenamento", label: "Media a freccia", value: st.avg == null ? "—" : fmtAvg(st.avg) },
    { kind: "campionato", label: "Gare", value: fmtNum(st.gare) },
    { kind: "campionato", label: "Podi", value: fmtNum(st.podiums) },
    { kind: "campionato", label: "Miglior gara", value: fmtNum(st.bestScore) },
    { kind: "campionato", label: "Media gare", value: fmtNum(st.avgScore) },
    { kind: "minigioco", label: "Punti avatar", value: fmtNum(st.xp) },
    { kind: "minigioco", label: "Livello", value: String(lv.level) },
    { kind: "minigioco", label: "Giri al minigioco", value: fmtNum(st.gameRounds) },
    { kind: "minigioco", label: "Record minigioco", value: fmtNum(st.gameBest || null) },
  ];
  return (
    <Card className="grid gap-2.5">
      <div>
        <h2 className="font-display text-2xl">Statistiche</h2>
        {st.since ? <p className="text-xs text-muted">Gare e podi di tutte le stagioni, dal {st.since}</p> : null}
      </div>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {items.map((it) => (
          <div key={it.label} className="grid content-start justify-items-center gap-1 rounded-2xl bg-white/[0.04] px-1 py-2" style={{ boxShadow: `inset 0 -2px 0 ${KINDS[it.kind].color}55` }}>
            <p className="font-display text-xl leading-none tabular-nums">{it.value}</p>
            <p className="text-[0.62rem] leading-tight text-muted">{it.label}</p>
          </div>
        ))}
      </div>
      {st.estimatedGare > 0 ? (
        <p className="text-xs leading-snug text-muted">
          {st.estimatedGare === 1 ? "Per una gara" : `Per ${st.estimatedGare} gare`} manca il cartellino: piazzole e frecce sono contate sulle piazzole della gara (di solito 20, 3 frecce a piazzola). Si correggono da Gare, con la foto del cartellino o a mano.
        </p>
      ) : null}
    </Card>
  );
}

/** «Campionato invernale 2024/2025» → «Invernale 2024/25» */
const shortSeason = (label: string) => {
  const t = label.replace(/^campionato\s+/i, "").replace(/\b(20\d{2})\s*\/\s*20(\d{2})\b/, "$1/$2");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Stagione per stagione: le gare di ogni campionato (dall'app e dall'archivio FITAST) e il posto nella generale */
function SeasonsCard({ st, firstName }: { st: Stats; firstName: string }) {
  const seasons = st.seasons;
  const [pick, setPick] = useState("");
  if (!seasons.length || (seasons.length === 1 && seasons[0].current)) return null;
  const names = seasons.map((x) => shortSeason(x.label));
  const index = Math.max(0, names.indexOf(pick));
  const s = seasons[index];
  const g = s.general;
  const tiles: [string, string][] = [
    ["Gare", String(s.gare)],
    ["Podi", String(s.podiums)],
    ["Vinte", String(s.wins)],
    ["Miglior gara", fmtNum(s.best)],
  ];
  return (
    <Card className="grid gap-3" style={{ boxShadow: `inset 0 -3px 0 ${KINDS.campionato.color}55` }}>
      <KindHeading kind="campionato" title="Stagione per stagione" sub={`${seasons.length} ${seasons.length === 1 ? "stagione" : "stagioni"} di ${firstName}${st.since ? `, dal ${st.since}` : ""}`} />
      <Chips value={names[index]} options={names} onChange={(v) => setPick(v)} />
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white/[0.05] py-2">
            <p className="font-display text-xl leading-none tabular-nums">{v}</p>
            <p className="mt-1 text-[0.62rem] text-muted">{k}</p>
          </div>
        ))}
      </div>
      {g ? (
        <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: "linear-gradient(110deg, rgb(156 30 49 / 0.45), rgb(66 9 18 / 0.4))" }}>
          {g.place != null && g.place <= 3 ? <Medal place={g.place} size={34} /> : <p className="font-display text-3xl leading-none tabular-nums">{g.place != null ? `${g.place}°` : "—"}</p>}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">
              {g.place != null ? `${g.place}° nella classifica generale` : "Nella classifica generale"}
              {g.size ? <span className="font-normal text-muted"> su {g.size}</span> : null}
            </p>
            <p className="truncate text-xs text-white/80">{[titleName(g.category), g.points != null ? `${fmtNum(g.points)} punti` : ""].filter(Boolean).join(", ")}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">{s.current ? "La classifica generale di questa stagione arriva con la prossima lettura del portale." : "Classifica generale di questa stagione non salvata: si aggiunge con «Scansiona tutto dal 2019» nell'Albo d'oro."}</p>
      )}
      {s.races.length ? (
        // le gare della stagione a pagine di 6 che scorrono di lato
        <HPages as="div" className="gap-1" items={s.races} per={6} keyOf={(r, i) => `${r.day}-${r.name}-${i}`} render={(r) => {
            const [y, m, d] = r.day.split("-");
            return (
              <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-2.5 py-2">
                <span className="grid w-9 shrink-0 place-items-center">
                  {r.rank != null && r.rank <= 3 ? <Medal place={r.rank} size={24} /> : <span className="font-display text-lg leading-none tabular-nums text-white/85">{r.rank != null ? `${r.rank}°` : "—"}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold leading-tight">{r.name || "Gara"}</span>
                  <span className="block truncate text-[0.68rem] text-muted">{[`${d}/${m}/${y}`, r.category].filter(Boolean).join(", ")}</span>
                </span>
                {r.score != null ? <span className="shrink-0 font-display text-lg tabular-nums">{fmtNum(r.score)}</span> : null}
              </div>
            );
          }} />
      ) : (
        <p className="text-sm text-muted">Nessuna gara trovata in questa stagione.</p>
      )}
    </Card>
  );
}

/** «Confronta con me»: un tocco e si vedono i propri numeri accanto ai suoi */
function CompareWithMe({ them, me, name }: { them: Stats; me: Stats; name: string }) {
  const [open, setOpen] = useState(false);
  const rows: { label: string; a: number | null; b: number | null; fmt?: (v: number) => string }[] = [
    { label: "Punti campionato", a: me.champSeason, b: them.champSeason },
    { label: "Gare vinte", a: me.wins, b: them.wins },
    { label: "Podi", a: me.podiums, b: them.podiums },
    { label: "Gare", a: me.gare, b: them.gare },
    { label: "Miglior gara", a: me.bestScore, b: them.bestScore },
    { label: "Allenamenti", a: me.trainings, b: them.trainings },
    { label: "Piazzole", a: me.piazzole, b: them.piazzole },
    { label: "Frecce", a: me.arrows, b: them.arrows },
    { label: "Media a freccia", a: me.avg, b: them.avg, fmt: (v) => fmtAvg(v) },
    { label: "Punti avatar", a: me.xp, b: them.xp },
    { label: "Giri al minigioco", a: me.gameRounds, b: them.gameRounds },
  ];
  const mine = rows.filter((r) => r.a != null && r.b != null && r.a > r.b).length;
  const theirs = rows.filter((r) => r.a != null && r.b != null && r.b > r.a).length;
  return (
    <div className="grid gap-2">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="aa-press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-semibold text-primary-fg shadow-[0_10px_24px_-12px_rgba(0,0,0,0.7)]">
        <Glyph name="duel" size={18} />
        {open ? "Chiudi il confronto" : "Confronta con me"}
      </button>
      {open ? (
        <Card className="aa-rise grid gap-1.5">
          <div className="grid grid-cols-[1fr_4.5rem_4.5rem] items-end gap-2 px-1 pb-1 text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-muted">
            <span>{mine > theirs ? `Avanti tu, ${mine} a ${theirs}` : theirs > mine ? `Avanti ${name}, ${theirs} a ${mine}` : `Pari, ${mine} a ${theirs}`}</span>
            <span className="text-right">Tu</span>
            <span className="text-right">{name}</span>
          </div>
          {rows.map((r) => {
            const f = (v: number | null) => (v == null ? "—" : r.fmt ? r.fmt(v) : fmtNum(v));
            const aWin = r.a != null && r.b != null && r.a > r.b;
            const bWin = r.a != null && r.b != null && r.b > r.a;
            return (
              <div key={r.label} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 rounded-xl bg-white/[0.04] px-2.5 py-2 text-sm">
                <span className="truncate">{r.label}</span>
                <span className={`text-right font-display text-lg tabular-nums ${aWin ? "text-primary" : bWin ? "text-muted" : ""}`}>{f(r.a)}</span>
                <span className={`text-right font-display text-lg tabular-nums ${bWin ? "text-primary" : aWin ? "text-muted" : ""}`}>{f(r.b)}</span>
              </div>
            );
          })}
        </Card>
      ) : null}
    </div>
  );
}

/** Incarichi: il fondatore nomina presidente e allenatore; il presidente della compagnia solo gli allenatori. */
function RolesCard({ data }: { data: Board }) {
  const [roles, setRoles] = useState(data.roles);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const v = data.viewer;
  const target = roles.level;
  if (!v.level && !v.leaderHere) return null;
  // il fondatore non lo tocca nessuno
  const locked = target === "super";
  const run = (key: string, change: Partial<typeof roles>, payload: { leader?: boolean; coach?: boolean }) => {
    setErr("");
    setBusy(key);
    setRole({ data: { memberId: data.id, ...payload } })
      .then(() => {
        setRoles((r) => ({ ...r, ...change }));
        refreshCrests();
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non riuscito."))
      .finally(() => setBusy(""));
  };
  const items: { key: string; label: string; hint: string; on: boolean; show: boolean; toggle: () => void }[] = [
    {
      key: "leader",
      label: "Presidente",
      hint: roles.companyName ? `Guida ${roles.companyName}` : "Guida la compagnia",
      on: roles.leader,
      show: Boolean(v.level) && !locked,
      toggle: () => run("leader", { leader: !roles.leader }, { leader: !roles.leader }),
    },
    {
      key: "coach",
      label: "Allenatore",
      hint: "Allievi, schede e progressi",
      on: roles.coach,
      show: (Boolean(v.level) || v.leaderHere) && !locked,
      toggle: () => run("coach", { coach: !roles.coach }, { coach: !roles.coach }),
    },
  ];
  const shown = items.filter((i) => i.show);
  if (!shown.length) return null;
  return (
    <Card className="grid gap-2">
      <h2 className="font-display text-2xl">Incarichi</h2>
      <p className="text-xs text-muted">Tocca per nominare o togliere. Chi riceve un incarico trova un avviso in Bacheca.</p>
      <div className="grid grid-cols-2 gap-2">
        {shown.map((i) => (
          <button
            key={i.key}
            type="button"
            aria-pressed={i.on}
            disabled={busy !== ""}
            onClick={i.toggle}
            className="grid gap-0.5 rounded-2xl border p-3 text-left transition disabled:opacity-60"
            style={{ borderColor: i.on ? ROLE_STYLE[i.key].color : "rgba(255,255,255,0.1)", background: i.on ? "rgba(255,255,255,0.08)" : "transparent" }}
          >
            <span className="flex items-center justify-between gap-2 text-sm font-semibold">
              {i.label}
              <span className="grid h-5 w-5 place-items-center rounded-full text-[0.7rem] font-black" style={{ background: i.on ? ROLE_STYLE[i.key].color : "rgba(255,255,255,0.12)", color: "#1a1408" }}>{i.on ? "✓" : ""}</span>
            </span>
            <span className="text-[0.7rem] text-muted">{busy === i.key ? "Salvo…" : i.hint}</span>
          </button>
        ))}
      </div>
      {locked ? <p className="text-xs text-muted">Il fondatore non si può modificare.</p> : null}
      {err ? <ErrorNote text={err} /> : null}
    </Card>
  );
}

/** I record al gioco della Home, per bersaglio e livello, con il dettaglio del giro migliore. */
function GameRecords({ games, mine }: { games: Board["games"]; mine: boolean }) {
  const list = [...games].sort((a, b) => GAME_MODES.findIndex((m) => m.id === a.mode) - GAME_MODES.findIndex((m) => m.id === b.mode) || GAME_LEVELS.findIndex((l) => l.id === a.level) - GAME_LEVELS.findIndex((l) => l.id === b.level));
  const [open, setOpen] = useState(0);
  return (
    <Card className="grid gap-3">
      <KindHeading kind="minigioco" title="Record al minigioco" sub="Giro di 20 piazzole da 3 frecce sul gioco della Home. Solo per divertimento: non entra nelle medie." />
      {!list.length ? (
        <p className="text-sm text-muted">{mine ? "Finisci un giro di 20 piazzole sul gioco della Home: il record compare qui." : "Nessun giro completo, per ora."}</p>
      ) : (
        <>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
            {list.map((g, i) => (
              <button key={`${g.mode}-${g.level}`} type="button" aria-pressed={i === open} onClick={() => setOpen(i)} className="aa-chip shrink-0">
                {modeOf(g.mode).label} · {GAME_LEVELS.find((l) => l.id === g.level)?.label ?? g.level}
              </button>
            ))}
          </div>
          {list[open] ? <GameRecordDetail g={list[open]} /> : null}
        </>
      )}
    </Card>
  );
}

function GameRecordDetail({ g }: { g: Board["games"][number] }) {
  const m = modeOf(g.mode);
  const top = m.perArrow * 3;
  const pct = g.max ? Math.round((g.best / g.max) * 100) : 0;
  const arrows = g.arrows || 60;
  const bestSt = g.stations.length ? Math.max(...g.stations) : 0;
  const worstSt = g.stations.length ? Math.min(...g.stations) : 0;
  const when = g.bestAt ? new Date(g.bestAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "";
  return (
    <div className="grid gap-3">
      <div className="flex items-end gap-3">
        <p className="font-display text-5xl leading-none tabular-nums">{g.best}<span className="text-xl text-muted">/{g.max}</span></p>
        <div className="mb-1 h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ffd27a]" style={{ width: `${pct}%` }} /></div>
        <span className="mb-0.5 text-sm font-semibold tabular-nums">{pct}%</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[
          ["media a freccia", (g.best / arrows).toFixed(2).replace(".", ",")],
          [`da ${m.perArrow}`, String(g.tens)],
          [g.mode === "sagome" ? "nel cuore" : "X", String(g.xs)],
          ["fuori", String(g.misses)],
          ["piazzola migliore", `${bestSt}/${top}`],
          ["giri giocati", String(g.rounds)],
        ].map(([k, val]) => (
          <div key={k} className="rounded-2xl bg-white/[0.05] px-1 py-2">
            <p className="font-display text-xl leading-none tabular-nums">{val}</p>
            <p className="mt-1 text-[0.62rem] text-muted">{k}</p>
          </div>
        ))}
      </div>
      {g.stations.length ? (
        <div>
          <p className="mb-1 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted">Le 20 piazzole del record · peggiore {worstSt}</p>
          <div className="grid grid-cols-10 gap-1">
            {g.stations.map((v, i) => (
              <span key={i} title={`Piazzola ${i + 1}: ${v}`} className="grid h-7 place-items-center rounded-md text-[0.66rem] font-bold" style={{ background: v >= top * 0.9 ? "#ffd27a" : v >= top * 0.7 ? "#ff7a6e" : v >= top * 0.5 ? "#5aa6ff" : "rgba(255,255,255,0.12)", color: v >= top * 0.9 ? "#2a1d0c" : "#fff" }}>{v}</span>
            ))}
          </div>
        </div>
      ) : null}
      {when ? <p className="text-xs text-muted">Record del {when}.</p> : null}
    </div>
  );
}
