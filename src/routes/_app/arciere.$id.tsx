import { useTeamAvatars } from "@/components/avatar-hero";
import { InsertFor } from "@/components/insert-for";
import { SceneBackdrop } from "@/components/scene-2d";
import { ArcherFront } from "@/components/archer-front";
import { useSky } from "@/lib/arcieri/sky3d";
import { createFileRoute, Link } from "@tanstack/react-router";
import { archerBoard, listGadgets } from "@/lib/arcieri/club.api";
import { bowLabel, memberLabel } from "@/lib/arcieri/labels";
import { fmtAvg } from "@/lib/arcieri/scoring";
import { useLoad } from "@/lib/arcieri/use-load";
import { AvgLine, ScoreLine } from "@/components/charts";
import { Avatar, Card, ErrorNote, Loading } from "@/components/kit";
import { PrizeMark, prizeTier, topPrizes } from "@/components/prize-mark";
import { KindEmblem, KindHeading } from "@/components/kind-emblem";
import { KINDS } from "@/lib/arcieri/kinds";
import { AVATAR_DEFAULT } from "@/lib/arcieri/avatar";
import { useState } from "react";
import { setRole } from "@/lib/arcieri/staff.api";
import { refreshCrests } from "@/lib/arcieri/crest";
import { GAME_LEVELS, GAME_MODES, modeOf } from "@/lib/arcieri/game-modes";
import { LevelCrest } from "@/components/level-crest";
import { levelOf } from "@/lib/arcieri/xp";
import { Glyph } from "@/components/icons";
import { ArcherPalmares, Medal } from "@/components/palmares";
import { RankBanner } from "@/components/rank-banner";
import { haloOfXp } from "@/components/level-crest";
import { titleName } from "@/lib/arcieri/fitast-league";

type Board = Awaited<ReturnType<typeof archerBoard>>;

const ROLE_STYLE: Record<string, { label: string; color: string }> = {
  super: { label: "Fondatore", color: "#ffd27a" },
  leader: { label: "Presidente", color: "#7cf0a8" },
  coach: { label: "Allenatore", color: "#8cc3f0" },
};

/** gli incarichi della persona, come etichette colorate */
function roleBadges(r: Board["roles"]) {
  return [...(r.level ? [r.level] : []), ...(r.leader ? ["leader"] : []), ...(r.coach ? ["coach"] : [])].map((k) => ROLE_STYLE[k]);
}

export const Route = createFileRoute("/_app/arciere/$id")({ component: Page });

function Page() {
  const looks = useTeamAvatars();
  const { sky } = useSky();
  const { id } = Route.useParams();
  const { data, error, loading } = useLoad(`archer-${id}`, () => archerBoard({ data: { id: Number(id) } }));
  const gadgets = useLoad(`archer-gadgets-${id}`, () => listGadgets());
  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote text={error || "Errore"} />;
  // il nome dell'arciere è quello del profilo; il soprannome si vede accanto
  const full = [data.givenName, data.familyName].filter(Boolean).join(" ").trim();
  const name = full || memberLabel(data, [data]);
  const nick = data.nickname.trim() && data.nickname.trim() !== full ? data.nickname.trim() : "";
  const badges = roleBadges(data.roles);
  const train = data.trainings.slice(-12).map((s) => ({ name: s.day.slice(5), avg: Number(s.avg.toFixed(2)) }));
  const comps = data.comps.map((c) => ({ name: c.day.slice(5), score: c.score }));
  const shownPrizes = topPrizes((gadgets.data?.prizes ?? []).filter((prize) => prize.holders.some((holder) => holder.userId === data.userId)));
  // gli ultimi tre premi vinti, dal più recente
  const latest = (gadgets.data?.prizes ?? [])
    .flatMap((prize) => prize.holders.filter((h) => h.userId === data.userId).map((h) => ({ ...prize, at: h.unlockedAt })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3);
  const look = looks[data.userId] ?? AVATAR_DEFAULT;
  const rank = data.stats.fitast;
  return (
    <div className="grid gap-5">
      {/* il suo arciere, grande e di fronte, con accanto gli ultimi premi */}
      <div className="aa-profile-stage relative h-[34rem] overflow-hidden rounded-[1.75rem]">
        <SceneBackdrop sky={sky} id={`pf${data.id}`} scene={look.scene} />
        {/* luce morbida dietro l'arciere e ombra a terra: l'arciere sta nella scena, non sopra */}
        <div style={{ ["--glow" as string]: haloOfXp(data.xp).a }} className={`aa-stage-glow aa-stage-glow-lv pointer-events-none absolute inset-x-0 top-[18%] bottom-[8%] ${rank ? "px-[22%]" : "pr-[22%]"}`} aria-hidden />
        <div className={`aa-stage-shadow pointer-events-none absolute bottom-[3.5%] h-[4.5%] w-[34%] -translate-x-1/2 ${rank ? "left-1/2" : "left-[39%]"}`} aria-hidden />
        <div className={`absolute inset-x-0 bottom-[1%] top-[11%] flex justify-center ${rank ? "px-[22%]" : "pr-[22%]"}`}>
          <ArcherFront look={look} fit className="h-full w-auto drop-shadow-[0_16px_24px_rgba(0,0,0,0.5)]" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[16%] bg-gradient-to-t from-black/35 to-transparent" aria-hidden />
        {/* il posto vero nel campionato FITAST, come uno stendardo appeso a sinistra */}
        {rank ? <RankBanner r={rank} className="absolute left-[4.5%] top-[7.4rem] w-[24%]" /> : null}
        {/* il livello dell'arciere, come uno stemma in basso a sinistra */}
        <div className="aa-prize-float absolute bottom-4 left-2 w-[24%]" style={{ animationDelay: "0.1s" }}>
          <LevelCrest xp={data.xp} />
        </div>
        <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/65 to-transparent p-3 pb-8">
          <span className="relative shrink-0">
            <Avatar size="lg" label={name} color={data.avatarColor} photo={data.photoUrl} look={looks[data.userId]} admin={data.admin} xp={data.xp} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl leading-none text-white">{name}</h1>
            {nick ? <p className="text-xs italic text-white/75">«{nick}»</p> : null}
            <p className="mt-1 text-xs text-white/75">{data.bowType ? bowLabel(data.bowType) : "Arco non indicato"} · {data.roles.companyName || "nel gruppo"} dal {data.joinedOn || "—"}</p>
            {badges.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {badges.map((b) => <span key={b.label} className="rounded-full px-2 py-0.5 text-[0.62rem] font-bold text-[#1a1408] shadow" style={{ background: b.color }}>{b.label}</span>)}
              </div>
            ) : null}
          </div>
        </div>
        <div className="absolute bottom-4 right-2 top-24 flex w-[24%] flex-col items-center justify-center gap-3">
          {latest.length ? (
            latest.map((prize, i) => (
              <div key={prize.code} className="aa-prize-float grid justify-items-center text-center" style={{ animationDelay: `${0.2 + i * 0.15}s` }}>
                <PrizeMark code={prize.code} size={i === 0 ? "lg" : "md"} />
                <p className="mt-0.5 line-clamp-2 text-[0.65rem] font-semibold leading-tight text-white drop-shadow">{prize.title}</p>
              </div>
            ))
          ) : gadgets.loading ? null : (
            <p className="rounded-2xl bg-black/40 p-2 text-center text-[0.7rem] text-white/80">Ancora nessun premio</p>
          )}
        </div>
      </div>
      {data.viewerStats ? <CompareWithMe them={data.stats} me={data.viewerStats} name={name.split(" ")[0]} /> : null}
      <ChampionshipCard st={data.stats} />
      {data.stats.last ? <LastGara g={data.stats.last} /> : null}
      <StatsGrid st={data.stats} />
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
        <KindHeading kind="campionato" title="Gara dopo gara" sub="Punteggio nelle gare del calendario" />
        <ScoreLine data={comps} />
      </Card>
      <p className="text-sm text-muted">Qui si vede solo il riassunto. Note, attrezzatura personale e acquisti restano di chi li ha scritti.</p>
    </div>
  );
}

type Stats = Board["stats"];

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
          <p className="font-display text-4xl leading-none tabular-nums">{st.wins}</p>
          <p className="mt-1 text-[0.68rem] text-muted">{st.wins === 1 ? "gara vinta" : "gare vinte"}</p>
        </div>
        <div className="rounded-2xl bg-white/[0.05] p-2.5">
          <p className="font-display text-4xl leading-none tabular-nums">{st.podiums}</p>
          <p className="mt-1 text-[0.68rem] text-muted">{st.podiums === 1 ? "podio" : "podi"}</p>
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

/** Le statistiche che vedono tutti: allenamenti, gare, punti dell'avatar */
function StatsGrid({ st }: { st: Stats }) {
  const lv = levelOf(Math.max(0, st.xp));
  const items: { kind: "allenamento" | "campionato" | "minigioco"; label: string; value: string }[] = [
    { kind: "allenamento", label: "Allenamenti", value: fmtNum(st.trainings) },
    { kind: "allenamento", label: "Frecce", value: fmtNum(st.arrows) },
    { kind: "allenamento", label: "Media", value: st.avg == null ? "—" : fmtAvg(st.avg) },
    { kind: "campionato", label: "Gare", value: fmtNum(st.gare) },
    { kind: "campionato", label: "Miglior gara", value: fmtNum(st.bestScore) },
    { kind: "campionato", label: "Media gare", value: fmtNum(st.avgScore) },
    { kind: "minigioco", label: "Punti avatar", value: fmtNum(st.xp) },
    { kind: "minigioco", label: "Livello", value: String(lv.level) },
    { kind: "minigioco", label: "Giri al minigioco", value: fmtNum(st.gameRounds) },
  ];
  return (
    <Card className="grid gap-2.5">
      <h2 className="font-display text-2xl">Statistiche</h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        {items.map((it) => (
          <div key={it.label} className="grid justify-items-center gap-0.5 rounded-2xl bg-white/[0.04] p-2" style={{ boxShadow: `inset 0 -2px 0 ${KINDS[it.kind].color}55` }}>
            <p className="font-display text-2xl leading-none tabular-nums">{it.value}</p>
            <p className="text-[0.66rem] leading-tight text-muted">{it.label}</p>
          </div>
        ))}
      </div>
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
    { label: "Frecce", a: me.arrows, b: them.arrows },
    { label: "Media allenamento", a: me.avg, b: them.avg, fmt: (v) => fmtAvg(v) },
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
