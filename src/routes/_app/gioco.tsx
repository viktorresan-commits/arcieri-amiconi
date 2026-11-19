import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArcheryGame } from "@/components/archery-game";
import { Button, Card, Empty, ErrorNote, Loading, PageHead, Select } from "@/components/kit";
import { useMember } from "@/components/shell";
import { computerAim, gearOf, impact, modeLabel, planFor, REWARDS, type GameMode, type SceneId } from "@/lib/arcieri/game";
import { createDuel, finishMatch, gameBoard, gameHome, startMatch } from "@/lib/arcieri/game.api";
import { memberLabel } from "@/lib/arcieri/labels";
import { listRoster } from "@/lib/arcieri/members.api";
import { messageOf, useLoad } from "@/lib/arcieri/use-load";

export const Route = createFileRoute("/_app/gioco")({ component: Page });

type Result = Awaited<ReturnType<typeof finishMatch>>;
type Screen =
  | { name: "hub" | "modes" | "duel" | "board" | "profile" | "goals" | "history" }
  | { name: "play"; mode: GameMode; seed: string; matchId: number; versusCpu: boolean }
  | { name: "result"; result: Result; versusCpu: boolean; mode: GameMode; seed: string; shots: { yaw: number; pitch: number; at: number; draw?: number; pound?: number; grain?: number; shaft?: number; vane?: string }[] };

const PLAY_MODES: { id: GameMode; title: string; text: string }[] = [
  { id: "gara", title: "Gara", text: "20 piazzole, 3 frecce. Le vedi finire." },
  { id: "infinite", title: "Corsa infinita", text: "Livelli senza fine. Tre errori e la corsa si chiude." },
  { id: "time", title: "Time Attack", text: "60 secondi, più punti possibile." },
  { id: "perfect", title: "Perfect 10", text: "Dieci frecce. Conta solo dove arriva." },
  { id: "training", title: "Allenamento", text: "Venti frecce, senza classifica." },
];

function Page() {
  const { me } = useMember();
  const [nonce, setNonce] = useState(0);
  const [screen, setScreen] = useState<Screen>({ name: "hub" });
  const [cpu, setCpu] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [boardMode, setBoardMode] = useState("all");
  const [boardPeriod, setBoardPeriod] = useState("all");
  const [query, setQuery] = useState("");
  const home = useLoad(`game-${nonce}`, () => gameHome());
  const roster = useLoad("game-roster", () => listRoster());
  const board = useLoad(`game-board-${boardMode}-${boardPeriod}-${nonce}`, () => gameBoard({ data: { mode: boardMode, period: boardPeriod } }));

  async function begin(mode: GameMode, versusCpu: boolean, duelId?: number) {
    setErr("");
    setBusy(true);
    try {
      const started = duelId ? await startMatch({ data: { mode: "duel", duelId } }) : await startMatch({ data: { mode } });
      setScreen({ name: "play", mode: started.mode as GameMode, seed: started.seed, matchId: started.matchId, versusCpu });
    } catch (error) {
      setErr(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function challenge(opponentId: number) {
    setErr("");
    setBusy(true);
    try {
      const started = await createDuel({ data: { opponentId } });
      setScreen({ name: "play", mode: "duel", seed: started.seed, matchId: started.matchId, versusCpu: false });
    } catch (error) {
      setErr(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  if (screen.name === "play") {
    const scene = (home.data?.me.scene ?? "bosco") as SceneId;
    return (
      <ArcheryGame
        mode={screen.mode}
        seed={screen.seed}
        scene={scene}
        versusCpu={screen.versusCpu}
        onExit={() => setScreen({ name: "hub" })}
        onFinished={(shots) => {
          const played = screen;
          void finishMatch({ data: { matchId: played.matchId, shots } })
            .then((result) => {
              setNonce((value) => value + 1);
              setScreen({ name: "result", result, versusCpu: played.versusCpu, mode: played.mode, seed: played.seed, shots });
            })
            .catch((error: unknown) => {
              setErr(messageOf(error));
              setScreen({ name: "hub" });
            });
        }}
      />
    );
  }

  if (home.loading && !home.data) return <Loading />;
  if (home.error) return <ErrorNote text={home.error} />;
  if (!home.data) return null;
  const data = home.data;
  const others = (roster.data ?? []).filter((person) => person.id !== me.id);

  return (
    <div className="grid gap-3">
      <PageHead title="Giochiamo" lede="Un tiro. Poi un altro. Il record è di qualcuno del gruppo, finché non è tuo." />
      {err ? <ErrorNote text={err} /> : null}
      {screen.name === "result" ? <ResultCard screen={screen} onClose={() => setScreen({ name: "hub" })} /> : null}
      {data.week.goals.some((goal) => goal.done) ? (
        <Card className="border-accent bg-accent text-accent-fg">
          <p className="font-display text-3xl leading-none">Obiettivo di gruppo preso</p>
          <p className="mt-1 text-sm">{data.week.goals.filter((goal) => goal.done).map((goal) => goal.title).join(" · ")}</p>
        </Card>
      ) : null}

      {screen.name === "hub" ? (
        <>
          <section className="aa-glow-panel overflow-hidden rounded-3xl border border-line">
            <div className="px-5 py-6">
              <p className="text-xs uppercase tracking-[0.22em] text-primary">{data.me.rank}</p>
              <h2 className="mt-2 font-display text-5xl leading-none">Tiro</h2>
              <p className="mt-2 max-w-xs text-sm text-white/70">Distanza, vento e bersaglio cambiano a ogni freccia. Un centro spezza la faccia.</p>
              <button type="button" disabled={busy} onClick={() => setScreen({ name: "modes" })} className="mt-5 min-h-14 w-full rounded-2xl bg-primary text-lg font-semibold text-primary-fg">Gioca</button>
            </div>
          </section>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setScreen({ name: "duel" })} className="rounded-2xl border border-line bg-bg px-3 py-4 text-left"><span className="block text-xs uppercase tracking-wide text-muted">Diretta</span><span className="font-display text-2xl">Sfida</span></button>
            <button type="button" onClick={() => setScreen({ name: "board" })} className="rounded-2xl border border-line bg-bg px-3 py-4 text-left"><span className="block text-xs uppercase tracking-wide text-muted">Squadra</span><span className="font-display text-2xl">Classifica</span></button>
            <button type="button" onClick={() => setScreen({ name: "profile" })} className="rounded-2xl border border-line bg-bg px-3 py-4 text-left"><span className="block text-xs uppercase tracking-wide text-muted">Tu</span><span className="font-display text-2xl">Profilo</span></button>
            <button type="button" onClick={() => setScreen({ name: "goals" })} className="rounded-2xl border border-line bg-bg px-3 py-4 text-left"><span className="block text-xs uppercase tracking-wide text-muted">Premi</span><span className="font-display text-2xl">Obiettivi</span></button>
            <button type="button" onClick={() => setScreen({ name: "history" })} className="rounded-2xl border border-line bg-bg px-3 py-4 text-left"><span className="block text-xs uppercase tracking-wide text-muted">Partite</span><span className="font-display text-2xl">Storico</span></button>
            <button type="button" disabled={busy || data.daily.attempts >= data.daily.max} onClick={() => void begin("daily", false)} className="rounded-2xl border border-primary bg-primary px-3 py-4 text-left text-primary-fg disabled:opacity-50">
              <span className="block text-xs uppercase tracking-wide text-white/70">Oggi {data.daily.attempts}/{data.daily.max}</span>
              <span className="font-display text-2xl">Sfida</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Record" value={data.me.record || "—"} />
            <Stat label="Posizione" value={data.me.position ? `${data.me.position}/${data.me.of}` : "—"} />
            <Stat label="Miglior Amiconi" value={data.bestArcher ? `${data.bestArcher.name} · ${data.bestArcher.score}` : "—"} />
            <Stat label="Gruppo oggi" value={data.daily.team} />
          </div>
          <Card>
            <p className="text-xs uppercase tracking-wide text-muted">Obiettivo della settimana</p>
            <ul className="mt-2 grid gap-2">
              {data.week.goals.map((goal) => (
                <li key={goal.code}>
                  <div className="mb-1 flex justify-between text-sm"><span>{goal.title}</span><span>{Math.round(goal.current)}/{goal.target}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : null}

      {screen.name === "modes" ? (
        <div className="grid gap-2">
          <label className="flex items-center gap-2 rounded-2xl border border-line px-3 py-3 text-sm"><input type="checkbox" checked={cpu} onChange={(event) => setCpu(event.target.checked)} /> Contro il computer</label>
          {PLAY_MODES.map((mode) => (
            <button key={mode.id} type="button" disabled={busy} onClick={() => void begin(mode.id, cpu)} className="rounded-2xl border border-line bg-bg px-4 py-4 text-left">
              <p className="font-display text-3xl leading-none">{mode.title}</p>
              <p className="mt-1 text-sm text-muted">{mode.text}</p>
            </button>
          ))}
          <Button variant="ghost" onClick={() => setScreen({ name: "hub" })}>Indietro</Button>
        </div>
      ) : null}

      {screen.name === "duel" ? (
        <Card className="grid gap-2">
          <p className="font-display text-2xl">Sfida un Amiconi</p>
          <p className="text-sm text-muted">Otto frecce, stesso bersaglio, stesso vento. Vince il punteggio.</p>
          {others.map((person) => (
            <button key={person.id} type="button" disabled={busy} onClick={() => void challenge(person.id)} className="flex min-h-12 items-center justify-between rounded-xl border border-line px-3 text-left">
              <span>{memberLabel(person, others)}</span>
              <span className="text-sm text-muted">Sfida</span>
            </button>
          ))}
          {!others.length ? <Empty title="Nessun avversario" text="In squadra non c'è ancora nessun altro." /> : null}
          <p className="mt-2 font-semibold">Sfide aperte</p>
          {data.duels.length ? data.duels.map((duel) => (
            <div key={duel.id} className="rounded-xl border border-line px-3 py-2 text-sm">
              <p className="font-semibold">Tu vs {duel.opponent}</p>
              <p>{duel.mine == null ? "Tu non hai ancora tirato" : `Tu ${duel.mine}`} · {duel.theirs == null ? "l'altro non ha ancora tirato" : `lui ${duel.theirs}`}</p>
              {duel.canPlay ? <Button className="mt-2" disabled={busy} onClick={() => void begin("duel", false, duel.id)}>Tira la sfida</Button> : null}
            </div>
          )) : <Empty title="Nessuna sfida" text="Nessuna sfida diretta." />}
          <Button variant="ghost" onClick={() => setScreen({ name: "hub" })}>Indietro</Button>
        </Card>
      ) : null}

      {screen.name === "board" ? (
        <Card className="grid gap-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtra un nome" className="min-h-12 rounded-xl border border-line bg-bg px-3" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={boardMode} onChange={(event) => setBoardMode(event.target.value)}>
              <option value="all">Tutte le modalità</option>
              <option value="infinite">Corsa infinita</option>
              <option value="time">Time Attack</option>
              <option value="perfect">Perfect 10</option>
              <option value="daily">Sfida del giorno</option>
              <option value="gara">Gara</option>
              <option value="duel">Duelli</option>
            </Select>
            <Select value={boardPeriod} onChange={(event) => setBoardPeriod(event.target.value)}>
              <option value="all">Sempre</option>
              <option value="week">Questa settimana</option>
            </Select>
          </div>
          {board.loading ? <Loading /> : null}
          {board.error ? <ErrorNote text={board.error} /> : null}
          {(board.data ?? []).filter((row) => row.name.toLowerCase().includes(query.trim().toLowerCase())).map((row) => (
            <div key={row.memberId} className="rounded-xl border border-line px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{row.place}. {row.name}{row.me ? " · tu" : ""}</span>
                <span className="font-display text-2xl leading-none">{row.score}</span>
              </div>
              <p className="text-muted">{row.rank} · {row.matches} partite · {row.arrows} frecce · {row.accuracy}% · {row.perfects} centri</p>
            </div>
          ))}
          {board.data && !board.data.length ? <Empty title="Nessun arciere" text="La squadra non ha ancora un profilo." /> : null}
          <p className="text-xs text-muted">La classifica di gruppo della settimana vale {data.week.team}. Record storico {data.week.record}.</p>
          <Button variant="ghost" onClick={() => setScreen({ name: "hub" })}>Indietro</Button>
        </Card>
      ) : null}

      {screen.name === "profile" ? (
        <Card className="grid gap-2">
          <p className="font-display text-4xl leading-none">{data.me.rank}</p>
          <p className="text-sm text-muted">{data.me.xp} xp{data.me.nextRank ? ` · prossimo ${data.me.nextRank} a ${data.me.nextXp}` : ""}</p>
          <div className="h-2 overflow-hidden rounded-full bg-bg">
            <div className="h-full bg-accent" style={{ width: `${data.me.nextXp ? Math.min(100, (data.me.xp / data.me.nextXp) * 100) : 100}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat label="Partite" value={data.me.matches} />
            <Stat label="Media" value={data.me.avg} />
            <Stat label="Frecce" value={data.me.arrows} />
            <Stat label="A segno" value={data.me.hits} />
            <Stat label="Precisione" value={`${data.me.accuracy}%`} />
            <Stat label="Centri" value={data.me.perfects} />
            <Stat label="Combo" value={data.me.bestCombo} />
            <Stat label="Record" value={data.me.record} />
          </div>
          <p className="text-sm text-muted">Record per modalità: {Object.entries(data.me.modes).map(([mode, score]) => `${modeLabel(mode)} ${score}`).join(" · ") || "nessuno"}</p>
          <Button variant="ghost" onClick={() => setScreen({ name: "board" })}>Confronta con la squadra</Button>
          <Button variant="ghost" onClick={() => setScreen({ name: "hub" })}>Indietro</Button>
        </Card>
      ) : null}

      {screen.name === "goals" ? (
        <Card className="grid gap-2">
          <p className="font-display text-2xl">Premi di gioco</p>
          {REWARDS.map((reward) => {
            const got = data.rewards.includes(reward.code);
            return (
              <div key={reward.code} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                <span><span className="font-semibold">{reward.title}</span><span className="block text-sm text-muted">{reward.hint}</span></span>
                <span className="text-sm">{got ? "Tuo" : "Chiuso"}</span>
              </div>
            );
          })}
          <Button variant="ghost" onClick={() => setScreen({ name: "hub" })}>Indietro</Button>
        </Card>
      ) : null}

      {screen.name === "history" ? (
        <Card className="grid gap-2">
          {data.history.length ? data.history.map((row) => (
            <div key={row.id} className="flex items-center justify-between border-b border-line py-2 text-sm">
              <span>{row.label}<span className="block text-muted">{row.hits}/{row.arrows} a segno · {row.perfects} centri</span></span>
              <span className="font-display text-2xl">{row.score}</span>
            </div>
          )) : <Empty title="Nessuna partita" text="Nessuna partita salvata." />}
          <p className="text-sm text-muted">Duelli</p>
          {data.duels.map((duel) => (
            <p key={duel.id} className="text-sm">vs {duel.opponent}: {duel.mine ?? "—"} a {duel.theirs ?? "—"}</p>
          ))}
          <Button variant="ghost" onClick={() => setScreen({ name: "hub" })}>Indietro</Button>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-bg px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-2xl leading-none">{value}</p>
    </div>
  );
}

function ResultCard({ screen, onClose }: { screen: Extract<Screen, { name: "result" }>; onClose: () => void }) {
  const { result } = screen;
  let cpu = 0;
  if (screen.versusCpu) {
    screen.shots.forEach((shot, index) => {
      const plan = planFor(screen.mode, screen.seed, index);
      cpu += impact(plan, computerAim(plan, shot.at / 1000, screen.seed), shot.at / 1000, gearOf(shot)).points;
    });
  }
  return (
    <Card className="grid gap-1">
      <p className="text-xs uppercase tracking-wide text-muted">{modeLabel(screen.mode)}</p>
      <p className="font-display text-6xl leading-none">{result.score}</p>
      <p className="text-sm">{result.hits}/{result.arrows} a segno · {result.accuracy}% · {result.perfects} centri · combo {result.bestCombo}</p>
      {screen.versusCpu ? <p className="text-sm">{result.score === cpu ? "Pari con il computer" : result.score > cpu ? `Hai battuto il computer di ${result.score - cpu}` : `Il computer ti supera di ${cpu - result.score}`}</p> : null}
      {result.duel ? (
        <p className="text-sm">
          {result.duel.winner === "in_attesa" ? `${result.duel.opponent} deve ancora tirare.` : result.duel.winner === "tu" ? `Hai battuto ${result.duel.opponent}.` : result.duel.winner === "pari" ? `Pari con ${result.duel.opponent}.` : `${result.duel.opponent} è avanti.`}
          {result.duel.theirs != null ? ` ${result.duel.mine} a ${result.duel.theirs}.` : ""}
        </p>
      ) : null}
      <p className="text-sm">{result.rankUp ? `Nuovo grado: ${result.rank}` : result.rank} · +{result.xp} xp{result.position ? ` · posto ${result.position}` : ""}</p>
      {result.unlocked.length ? <p className="text-sm">Sbloccato: {result.unlocked.map((item) => item.title).join(", ")}</p> : null}
      <Button className="mt-2" onClick={onClose}>Torna al gioco</Button>
    </Card>
  );
}
