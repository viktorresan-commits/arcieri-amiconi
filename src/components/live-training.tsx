import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { elapsed, pauseClock, startClock } from "@/lib/arcieri/clock";
import { loadDraft, newDraft, saveDraft, type Draft, type DraftMeta, type DraftShot } from "@/lib/arcieri/draft";
import { BOWS, DISCIPLINES, DISTANCES, bowLabel } from "@/lib/arcieri/labels";
import {
  BODIES,
  DISPERSIONS,
  PROGRAMS,
  TECH_ERRORS,
  VOLUMES,
  liveCue,
  packMarks,
  programById,
  sameVolume,
  unpackMarks,
  volumeHint,
  type BodyId,
  type ProgramId,
} from "@/lib/arcieri/program";
import { cursor, endPoints, faceById, fmtAvg, scoreAtRadius, summarize, sagomaMaxOf, aimAngleLabel, aimTargetLabel, type Face } from "@/lib/arcieri/scoring";
import { AimPick } from "./aim-pick";
import { BoarTarget } from "./boar-target";
import { fmtClock } from "@/lib/arcieri/time";
import { getSession, listSessions, saveSession, trainingBootstrap } from "@/lib/arcieri/training.api";
import { Button, Card, ErrorNote, Field, Loading, Select, TextArea, TextInput } from "./kit";
import { TargetFace } from "./target-face";
import { PhotoSession } from "./photo-session";
import { tagsOf } from "@/lib/arcieri/arrow-tags";
import { ArrowPicker, lastArrowSet, type ArrowSet } from "./arrow-picker";
import { readMainGear } from "@/lib/arcieri/main-gear";
import { ShotLab } from "./shot-lab";
import { TargetRead } from "./target-read";
import { AppIcon, Glyph } from "./icons";
import { SagomaLab } from "./sagoma-lab";
import { MediaPick } from "./media-pick";
import { GestureHub } from "./gesture-hub";

const QUICK: Array<Partial<DraftMeta> & { label: string }> = [
  { label: "Indoor 18 m", distanceM: 18, bowType: "olimpico", face: "wa10", discipline: "indoor", arrowsPerEnd: 3, endsPlanned: 10, blocksPlanned: 1 },
  { label: "Outdoor 70 m", distanceM: 70, bowType: "olimpico", face: "wa10", discipline: "outdoor", arrowsPerEnd: 6, endsPlanned: 6, blocksPlanned: 2 },
  { label: "Compound 50 m", distanceM: 50, bowType: "compound", face: "wa10", discipline: "outdoor", arrowsPerEnd: 3, endsPlanned: 10, blocksPlanned: 1 },
  { label: "Tradizionale", distanceM: 20, bowType: "tradizionale", face: "field6", discipline: "tradizionale", arrowsPerEnd: 3, endsPlanned: 6, blocksPlanned: 1 },
];

function beep() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  gain.gain.value = 0.05;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.28);
  window.setTimeout(() => void ctx.close(), 600);
}

const LAST_META = "aa-last-meta-v1";

/** Le impostazioni dell'ultima partenza, per ripartire uguale con un tocco. */
function rememberMeta(meta: DraftMeta) {
  try {
    localStorage.setItem(LAST_META, JSON.stringify(meta));
  } catch {
    /* memoria non disponibile */
  }
}

function quickDraft(recentProgram: string): Draft {
  let last: Partial<DraftMeta> = {};
  try {
    last = (JSON.parse(localStorage.getItem(LAST_META) || "null") as Partial<DraftMeta> | null) ?? {};
  } catch {
    last = {};
  }
  const program = (last.program || recentProgram || "A") as DraftMeta["program"];
  const meta: DraftMeta = {
    place: last.place ?? "",
    distanceM: last.distanceM ?? 18,
    discipline: last.discipline ?? "tradizionale",
    bowType: last.bowType ?? "tradizionale",
    bowCustom: last.bowCustom ?? "",
    face: last.face ?? "wa10",
    aimTarget: last.aimTarget ?? "padiglione",
    aimAngle: last.aimAngle ?? "frontale",
    setupId: readMainGear()?.setupId ?? last.setupId ?? null,
    arrowsPerEnd: last.arrowsPerEnd ?? 3,
    endsPlanned: last.endsPlanned ?? 10,
    blocksPlanned: last.blocksPlanned ?? 1,
    weather: "",
    feeling: "",
    rating: null,
    notes: "",
    stringNote: last.stringNote ?? "",
    gearSnapshot: last.gearSnapshot ?? "",
    startedAt: new Date().toISOString(),
    endedAt: "",
    program,
    body: last.body || "normale",
    arrowsChosen: last.arrowsChosen ?? (last.arrowsPerEnd ?? 3) * (last.endsPlanned ?? 10) * (last.blocksPlanned ?? 1),
    dispersion: "",
    errors: "",
    targetPhoto: "",
  };
  return newDraft(meta, null, null);
}

export function LiveTraining({ sessionId, openHistory = false, start }: { sessionId?: number; openHistory?: boolean; start?: "rapido" | "foto" | "gesto" | "fatto" }) {
  const navigate = useNavigate();
  const [boot, setBoot] = useState<Awaited<ReturnType<typeof trainingBootstrap>> | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [phase, setPhase] = useState<"boot" | "ask" | "choose" | "setup" | "past" | "history" | "live" | "gesto" | "foto">("boot");
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState("");
  const [closing, setClosing] = useState(false);
  const [pickSeq, setPickSeq] = useState<number | null>(null);
  const beeped = useRef(false);
  const endBeeped = useRef(false);

  useEffect(() => {
    trainingBootstrap()
      .then(setBoot)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Errore"));
  }, []);

  useEffect(() => {
    if (!boot) return;
    if (sessionId) {
      getSession({ data: { id: sessionId } })
        .then((row) => {
          const meta: DraftMeta = {
            place: row.session.place,
            distanceM: row.session.distanceM,
            discipline: row.session.discipline,
            bowType: row.session.bowType,
            bowCustom: row.session.bowCustom,
            face: row.session.face,
            aimTarget: row.session.aimTarget === "sagoma" || row.session.aimTarget === "piattello" || row.session.aimTarget === "altro" ? row.session.aimTarget : "padiglione",
            aimAngle: row.session.aimAngle === "alto" || row.session.aimAngle === "basso" || row.session.aimAngle === "lato" ? row.session.aimAngle : "frontale",
            setupId: row.session.setupId,
            arrowsPerEnd: row.session.arrowsPerEnd,
            endsPlanned: row.session.endsPlanned,
            blocksPlanned: row.session.blocksPlanned,
            weather: row.session.weather,
            feeling: row.session.feeling,
            rating: row.session.rating,
            notes: row.session.notes,
            stringNote: row.session.stringNote,
            gearSnapshot: row.session.gearSnapshot,
            startedAt: row.session.startedAt,
            program: row.session.program === "A" || row.session.program === "B" || row.session.program === "C" || row.session.program === "D" || row.session.program === "E" ? row.session.program : "",
            body: row.session.body === "fresco" || row.session.body === "normale" || row.session.body === "affaticato" ? row.session.body : "",
            arrowsChosen: row.session.arrowsPerEnd * row.session.endsPlanned * row.session.blocksPlanned,
            dispersion: row.session.dispersion,
            errors: row.session.errors,
            targetPhoto: row.session.targetPhoto,
            endedAt: row.session.endedAt ?? "",
          };
          setDraft({
            clientKey: row.session.clientKey,
            meta,
            shots: row.shots.map((s, i) => ({ ...s, seq: i + 1 })),
            clock: { running: false, startedAt: null, accumulatedMs: row.session.durationMs },
            endClock: { running: false, startedAt: null, accumulatedMs: 0 },
            totalLimitMs: row.session.timerLimitMs,
            endLimitMs: row.session.endLimitMs,
            selected: null,
          });
          setPhase("live");
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Errore"));
      return;
    }
    const existing = loadDraft();
    if (openHistory) setPhase("history");
    else if (start === "gesto") setPhase("gesto");
    else if (start === "fatto") setPhase("past");
    else if (start === "foto") {
      // da foto: sempre un allenamento nuovo (quello lasciato aperto resta salvato sul server)
      setDraft(quickDraft(boot.recent[0]?.program ?? ""));
      setPhase("foto");
    } else if (start === "rapido") {
      // un tocco: riprende quello in corso, altrimenti riparte come l'ultima volta
      if (existing && existing.shots.length) setDraft(existing);
      else setDraft(quickDraft(boot.recent[0]?.program ?? ""));
      setPhase("live");
    } else if (existing && existing.shots.length) setPhase("ask");
    else setPhase("choose");
  }, [boot, sessionId, openHistory, start]);

  useEffect(() => {
    if (draft && (phase === "live" || phase === "foto") && !sessionId) rememberMeta(draft.meta);
  }, [draft?.clientKey, phase, sessionId]);

  useEffect(() => {
    if (phase !== "live") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    const wake = () => setNow(Date.now());
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [phase]);

  useEffect(() => {
    if (draft && (phase === "live" || phase === "foto")) saveDraft(draft);
  }, [draft, phase]);

  useEffect(() => {
    if (!draft || (phase !== "live" && phase !== "foto")) return;
    if (phase === "foto" && !draft.shots.length) return;
    const handle = window.setTimeout(() => {
      void saveSession({ data: payload(draft, false) })
        .then(() => setPending(""))
        .catch(() => setPending("In attesa di rete: le frecce sono sul telefono."));
    }, 700);
    return () => window.clearTimeout(handle);
  }, [draft, phase]);

  const face = faceById(draft?.meta.face ?? "wa10");

  useEffect(() => {
    if (!draft) return;
    const total = elapsed(draft.clock, now);
    const end = elapsed(draft.endClock, now);
    if (draft.totalLimitMs && total >= draft.totalLimitMs && !beeped.current) {
      beeped.current = true;
      beep();
    }
    if (!draft.totalLimitMs || total < draft.totalLimitMs) beeped.current = false;
    if (draft.endLimitMs && end >= draft.endLimitMs && !endBeeped.current) {
      endBeeped.current = true;
      beep();
    }
    if (!draft.endLimitMs || end < draft.endLimitMs) endBeeped.current = false;
  }, [draft, now]);

  if (error) return <ErrorNote text={error} />;
  if (!boot || phase === "boot") return <Loading />;
  if (!boot.canScore) return <ErrorNote text="Questo profilo può consultare, non registrare allenamenti." />;

  if (phase === "ask") {
    return (
      <Card>
        <h1 className="font-display text-3xl">Allenamento in corso</h1>
        <p className="mt-1 text-sm text-muted">C'è una sessione salvata solo su questo telefono.</p>
        <div className="mt-4 grid gap-2">
          <Button
            onClick={() => {
              setDraft(loadDraft());
              setPhase("live");
            }}
          >
            Riprendi
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              saveDraft(null);
              setPhase("choose");
            }}
          >
            Ricomincia da zero
          </Button>
          <Button variant="ghost" onClick={() => setPhase("past")}>
            Aggiungi un allenamento già fatto
          </Button>
          <Button variant="ghost" onClick={() => setPhase("history")}>
            Storico allenamenti
          </Button>
        </div>
      </Card>
    );
  }

  if (phase === "choose") {
    return (
      <ProgramPick
        boot={boot}
        onOther={() => setPhase("setup")}
        onPast={() => setPhase("past")}
        onHistory={() => setPhase("history")}
        onGesture={() => setPhase("gesto")}
        onStart={(next) => {
          setDraft(next);
          setPhase("live");
        }}
      />
    );
  }

  if (phase === "history") return <History onNew={() => setPhase("choose")} />;

  if (phase === "gesto") {
    return (
      <div className="grid gap-3">
        <GestureHub />
        <Button variant="ghost" onClick={() => setPhase(draft ? "live" : "choose")}>Torna all'allenamento</Button>
      </div>
    );
  }

  if (phase === "past") {
    return <Setup past boot={boot} onBack={() => setPhase("choose")} onStart={(next) => { setDraft(next); setPhase("live"); }} />;
  }

  if (phase === "setup" || !draft) return <Setup boot={boot} onBack={() => setPhase("choose")} onStart={(next) => { setDraft(next); setPhase("live"); }} />;

  const meta = draft.meta;
  const spot = cursor(draft.shots, meta.arrowsPerEnd, meta.endsPlanned, meta.blocksPlanned);
  const tally = summarize(draft.shots, face.max);
  const endPts = endPoints(draft.shots, spot.block, spot.end);
  const endMax = meta.arrowsPerEnd * face.max;
  const blockPts = draft.shots.filter((s) => s.block === spot.block).reduce((a, s) => a + s.score, 0);
  const blockMax = meta.endsPlanned * meta.arrowsPerEnd * face.max;
  const endArrows = draft.shots.filter((s) => s.block === spot.block && s.end === spot.end);
  const totalMs = elapsed(draft.clock, now);
  const endMs = elapsed(draft.endClock, now);
  const over = Boolean(draft.endLimitMs && endMs >= draft.endLimitMs);

  function add(score: number, isX: boolean, miss: boolean, nx: number | null, ny: number | null) {
    if (navigator.vibrate) navigator.vibrate(8);
    setDraft((current) => {
      if (!current) return current;
      const plan = current.meta;
      if (current.selected != null) {
        return {
          ...current,
          selected: null,
          shots: current.shots.map((s) => (s.seq === current.selected ? { ...s, score, isX, miss, nx, ny } : s)),
        };
      }
      const here = cursor(current.shots, plan.arrowsPerEnd, plan.endsPlanned, plan.blocksPlanned);
      if (here.done) return current;
      const shot: DraftShot = { block: here.block, end: here.end, arrow: here.arrow, score, isX, miss, nx, ny, seq: current.shots.reduce((max, item) => Math.max(max, item.seq), 0) + 1 };
      const shots = [...current.shots, shot];
      const next = cursor(shots, plan.arrowsPerEnd, plan.endsPlanned, plan.blocksPlanned);
      const wrapped = next.end !== here.end || next.block !== here.block;
      return {
        ...current,
        shots,
        endClock: wrapped ? startClock({ running: false, startedAt: null, accumulatedMs: 0 }, Date.now()) : current.endClock,
      };
    });
    endBeeped.current = false;
  }

  /**
   * Una foto = una volée: riempie quella in corso (o, con «fresh», la prossima vuota) e,
   * se il piano è finito, lo allunga. Con più foto insieme le volée si mettono una dopo l'altra.
   */
  function placeVolley(current: Draft, hits: PhotoHit[], fresh: boolean): Draft {
    const plan = { ...current.meta };
    let shots = current.shots;
    const here = cursor(shots, plan.arrowsPerEnd, plan.endsPlanned, plan.blocksPlanned);
    const inEnd = (b: number, e: number) => shots.filter((x) => x.block === b && x.end === e);
    let block = here.done ? Math.max(0, plan.blocksPlanned - 1) : here.block;
    let end = here.done ? plan.endsPlanned : here.end;
    if (!here.done && fresh && inEnd(block, end).length) end += 1;
    if (end >= plan.endsPlanned) {
      if (plan.endsPlanned < 60) plan.endsPlanned = end + 1;
      else {
        block += 1;
        end = 0;
        plan.blocksPlanned = clampCount(Math.max(plan.blocksPlanned, block + 1), 1, 40);
      }
    }
    const used = new Set(inEnd(block, end).map((x) => x.arrow));
    const free = Array.from({ length: plan.arrowsPerEnd }, (_, i) => i).filter((i) => !used.has(i));
    let seq = shots.reduce((max, item) => Math.max(max, item.seq), 0);
    hits.slice(0, free.length).forEach((hit, k) => {
      seq += 1;
      const miss = hit.miss;
      shots = [...shots, { block, end, arrow: free[k], score: miss ? 0 : hit.score, isX: miss ? false : hit.isX, miss, nx: miss ? null : hit.nx, ny: miss ? null : hit.ny, seq, tag: hit.tag ?? null, set: hit.tag != null ? lastArrowSet(arrowSets, arrowGear?.id ?? null) : null }];
    });
    return { ...current, meta: plan, shots, selected: null, endClock: startClock({ running: false, startedAt: null, accumulatedMs: 0 }, Date.now()) };
  }

  function addVolley(hits: PhotoHit[]) {
    if (!hits.length) return;
    if (navigator.vibrate) navigator.vibrate(12);
    setDraft((current) => (current ? placeVolley(current, hits, false) : current));
    endBeeped.current = false;
  }

  function addVolleys(volleys: PhotoHit[][]) {
    if (!volleys.length) return;
    if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
    setDraft((current) => {
      if (!current) return current;
      let next = current;
      volleys.forEach((hits, i) => {
        if (hits.length) next = placeVolley(next, hits, i > 0);
      });
      return next;
    });
    endBeeped.current = false;
  }

  function moveShot(seq: number, score: number, isX: boolean, miss: boolean, nx: number, ny: number) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        shots: current.shots.map((item) => (item.seq === seq ? { ...item, score: miss ? 0 : score, isX: miss ? false : isX, miss, nx, ny } : item)),
      };
    });
  }

  // numeri delle frecce dell'attrezzatura scelta (es. 1–12), altrimenti 1–12
  const arrowGear = boot.gear.find((g) => g.id === boot.setups.find((st) => st.id === meta.setupId)?.arrowId);
  // tutte le serie di frecce dell'arciere (penne di colore diverso): il numero va dentro la serie giusta
  const arrowSets: ArrowSet[] = boot.gear.filter((g) => g.category === "freccia" && g.mine !== false).map((g) => ({ id: g.id, name: g.name, specs: g.specs }));
  const tagList = tagsOf(arrowSets.find((a) => a.id === lastArrowSet(arrowSets, arrowGear?.id ?? null))?.specs ?? arrowGear?.specs ?? "");
  const pickShot = pickSeq != null ? draft.shots.find((sh) => sh.seq === pickSeq) ?? null : null;
  function setTag(seq: number, tag: number | null, set: number | null = null) {
    setDraft((current) => (current ? { ...current, shots: current.shots.map((sh) => (sh.seq === seq ? { ...sh, tag, set: tag == null ? null : set } : sh)) } : current));
  }

  function onTarget(nx: number, ny: number) {
    const hit = scoreAtRadius(face, Math.hypot(nx, ny));
    add(hit.score, hit.isX, hit.miss, hit.miss ? null : nx, hit.miss ? null : ny);
  }

  async function finish() {
    if (!draft) return;
    const stopped: Draft = {
      ...draft,
      clock: pauseClock(draft.clock, Date.now()),
      endClock: pauseClock(draft.endClock, Date.now()),
    };
    setDraft(stopped);
    try {
      const saved = await saveSession({ data: payload(stopped, true) });
      saveDraft(null);
      for (const badge of saved.badges) toast.success(badge);
      void navigate({ to: "/allenamento/$id", params: { id: String(saved.id) } });
    } catch (e) {
      setPending(e instanceof Error ? e.message : "Salvataggio non riuscito. I dati restano sul telefono.");
    }
  }

  function setPlan(partial: Partial<Pick<DraftMeta, "arrowsPerEnd" | "endsPlanned" | "blocksPlanned">>) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current.meta, ...partial };
      next.arrowsPerEnd = clampCount(next.arrowsPerEnd, 1, 24);
      next.endsPlanned = clampCount(next.endsPlanned, 1, 60);
      next.blocksPlanned = clampCount(next.blocksPlanned, 1, 40);
      // Le frecce già segnate si rimettono in fila nel piano nuovo: altrimenti restano nelle
      // volée del piano vecchio e quelle nuove si aggiungono, contando il doppio.
      const ordered = [...current.shots].sort((a, b) => a.block - b.block || a.end - b.end || a.arrow - b.arrow || a.seq - b.seq);
      const perBlock = next.arrowsPerEnd * next.endsPlanned;
      const shots = ordered.map((shot, i) => ({
        ...shot,
        block: Math.floor(i / perBlock),
        end: Math.floor((i % perBlock) / next.arrowsPerEnd),
        arrow: i % next.arrowsPerEnd,
      }));
      // se le frecce già tirate sono più del piano, il piano si allarga invece di perderle
      const needBlocks = Math.ceil(shots.length / perBlock);
      if (needBlocks > next.blocksPlanned) next.blocksPlanned = clampCount(needBlocks, 1, 40);
      return { ...current, meta: next, shots, selected: null };
    });
  }

  function shiftWhen(day: string, from: string, to: string) {
    const started = stamp(day, from);
    if (!started) return;
    const ended = to ? stamp(day, to) : null;
    if (to && !ended) return;
    if (ended && ended.getTime() <= started.getTime()) return;
    setDraft((current) => {
      if (!current) return current;
      const duration = ended ? ended.getTime() - started.getTime() : current.clock.accumulatedMs;
      return {
        ...current,
        clock: ended ? { running: false, startedAt: null, accumulatedMs: duration } : current.clock,
        meta: { ...current.meta, startedAt: started.toISOString(), endedAt: ended ? ended.toISOString() : "" },
      };
    });
  }

  if (phase === "foto") {
    return (
      <PhotoSession
        draft={draft}
        face={face}
        tags={tagList}
        pending={pending}
        onVolley={addVolley}
        onDistance={(m) => setDraft((d) => (d ? { ...d, meta: { ...d.meta, distanceM: m } } : d))}
        onFinish={() => void finish()}
        onOpenLive={() => setPhase("live")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-16 z-10 -mx-4 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="grid grid-cols-3 gap-2 text-center">
          <ScoreLine k={`Volée ${spot.end + 1}/${meta.endsPlanned}`} v={`${endPts}/${endMax}`} />
          <ScoreLine k={`Bersaglio ${spot.block + 1}/${meta.blocksPlanned}`} v={`${blockPts}/${blockMax}`} />
          <ScoreLine k="Media" v={fmtAvg(tally.avg)} />
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
          <div
            className="aa-bar h-full bg-primary"
            style={{ width: `${Math.min(100, (tally.arrows / Math.max(1, meta.endsPlanned * meta.arrowsPerEnd * meta.blocksPlanned)) * 100)}%` }}
          />
        </div>
        <p className="mt-1 text-center text-xs text-muted tabular-nums">
          {tally.arrows} frecce · {tally.points} punti · {face.max === 10 ? "X" : "centri"} {tally.centers} · pieni {tally.tops}
          {spot.done ? " · piano completato" : ""}
        </p>
      </div>
      <div className={over ? "rounded-xl bg-accent px-3 py-2 text-center text-sm font-semibold text-accent-fg" : "flex items-center justify-between rounded-xl border border-line px-3 py-2"}>
        {meta.endedAt ? (
          <span className="text-sm">Già fatto · {whenLabel(meta.startedAt)}–{whenLabel(meta.endedAt)} · {fmtClock(new Date(meta.endedAt).getTime() - new Date(meta.startedAt).getTime())}</span>
        ) : over ? "Tempo volée scaduto" : (
          <>
            <span className="font-display text-3xl tabular-nums">{fmtClock(totalMs)}</span>
            <span className="text-sm text-muted tabular-nums">volée {fmtClock(endMs)}{draft.endLimitMs ? ` / ${fmtClock(draft.endLimitMs)}` : ""}</span>
            <Button
              variant="ghost"
              className="min-h-11 px-3"
              onClick={() =>
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        clock: d.clock.running ? pauseClock(d.clock, Date.now()) : startClock(d.clock, Date.now()),
                        endClock: d.endClock.running ? pauseClock(d.endClock, Date.now()) : startClock(d.endClock, Date.now()),
                      }
                    : d,
                )
              }
            >
              {draft.clock.running ? "Pausa" : "Via"}
            </Button>
          </>
        )}
      </div>
      {meta.program ? (
        <p className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
          <span className="font-display text-xl">{programById(meta.program)?.title}</span>
          <span className="mt-1 block text-muted">{liveCue(meta.program, meta.body, spot.end, meta.endsPlanned)}</span>
        </p>
      ) : null}
      {pending ? <ErrorNote text={pending} /> : null}
      {sessionId || meta.endedAt ? (
        <Card className="grid gap-3">
          <p className="text-sm text-muted">Puoi cambiare orario, frecce, volée e bersagli. Il totale previsto è {meta.arrowsPerEnd * meta.endsPlanned * meta.blocksPlanned} frecce.</p>
          <Field label="Data"><TextInput type="date" value={dayOf(meta.startedAt)} onChange={(e) => shiftWhen(e.target.value, timeOf(meta.startedAt), timeOf(meta.endedAt))} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Dalle"><TextInput type="time" value={timeOf(meta.startedAt)} onChange={(e) => shiftWhen(dayOf(meta.startedAt), e.target.value, timeOf(meta.endedAt))} /></Field>
            <Field label="Alle"><TextInput type="time" value={timeOf(meta.endedAt)} onChange={(e) => shiftWhen(dayOf(meta.startedAt), timeOf(meta.startedAt), e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Frecce per volée"><PlanNumber value={meta.arrowsPerEnd} onCommit={(v) => setPlan({ arrowsPerEnd: v })} /></Field>
            <Field label="Volée"><PlanNumber value={meta.endsPlanned} onCommit={(v) => setPlan({ endsPlanned: v })} /></Field>
            <Field label="Bersagli"><PlanNumber value={meta.blocksPlanned} onCommit={(v) => setPlan({ blocksPlanned: v })} /></Field>
          </div>
        </Card>
      ) : null}
      <Field label="Distanza stimata (m)">
        <TextInput inputMode="decimal" value={meta.distanceM} onChange={(e) => setDraft({ ...draft, meta: { ...meta, distanceM: Number(e.target.value.replace(",", ".")) || 0 } })} />
      </Field>
      <div className="grid grid-cols-2 gap-1.5">
        {([
          ["frontale", "Frontale"],
          ["destra", "A destra"],
          ["sinistra", "A sinistra"],
          ["alto", "Alto"],
          ["basso", "Basso"],
        ] as const).map(([side, label]) => (
          <button key={side} type="button" onClick={() => setDraft({ ...draft, meta: { ...meta, aimAngle: side } })} className={`min-h-11 rounded-xl text-sm font-semibold ${meta.aimAngle === side ? "bg-accent text-accent-fg" : "border border-line"}`}>{label}</button>
        ))}
      </div>
      {face.id.startsWith("sagoma") ? null : (
        <PhotoVolley
          face={face}
          shots={draft.shots}
          volley={spot.done ? meta.blocksPlanned * meta.endsPlanned + 1 : spot.block * meta.endsPlanned + spot.end + 1}
          room={spot.done ? meta.arrowsPerEnd : meta.arrowsPerEnd - endArrows.length}
          arrows={tally.arrows}
          points={tally.points}
          onApply={addVolley}
          onApplyBatch={addVolleys}
          tags={tagList}
        />
      )}
      {face.id.startsWith("sagoma") ? (
        <BoarTarget
          max={sagomaMaxOf(face.id)}
          shots={endArrows}
          onScore={(score, miss, nx, ny) => add(score, false, miss, miss ? null : nx, miss ? null : ny)}
          onMove={(index, score, miss, nx, ny) => {
            const shot = endArrows[index];
            if (shot) moveShot(shot.seq, score, false, miss, nx, ny);
          }}
        />
      ) : (
        <TargetFace
          face={face}
          shots={endArrows}
          onHit={onTarget}
          numbers
          picked={pickShot ? endArrows.findIndex((sh) => sh.seq === pickShot.seq) : null}
          onPick={(index) => {
            const shot = endArrows[index];
            if (shot) setPickSeq(shot.seq);
          }}
          onMove={(index, nx, ny) => {
            const shot = endArrows[index];
            if (!shot) return;
            const hit = scoreAtRadius(face, Math.hypot(nx, ny));
            moveShot(shot.seq, hit.score, hit.isX, hit.miss, nx, ny);
          }}
        />
      )}
      {pickShot ? (
        <Card className="aa-rise grid gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Colpo da {pickShot.miss ? "M" : pickShot.isX ? "X" : pickShot.score}: quale freccia era?
            </p>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-white/5" onClick={() => setPickSeq(null)} aria-label="Chiudi">
              <Glyph name="close" size={16} />
            </button>
          </div>
          <ArrowPicker
            sets={arrowSets}
            setId={pickShot.set ?? (pickShot.tag != null ? null : lastArrowSet(arrowSets, arrowGear?.id ?? null))}
            tag={pickShot.tag ?? null}
            fallbackTags={tagList}
            used={(setId) => draft.shots.filter((sh) => sh.block === pickShot.block && sh.end === pickShot.end && sh.seq !== pickShot.seq && (sh.set ?? null) === setId && sh.tag != null).map((sh) => sh.tag as number)}
            onPick={(setId, tag) => {
              setTag(pickShot.seq, tag, setId);
              setPickSeq(null);
            }}
          />
          <p className="text-[0.7rem] text-muted">
            {arrowGear ? `Numeri presi da ${arrowGear.name || "le tue frecce"}.` : "Scegli l'assetto con le frecce numerate per usare i loro numeri."} Tieni premuto e trascina per spostare il colpo.
          </p>
        </Card>
      ) : null}
      {face.id.startsWith("sagoma") ? (
        <Card><SagomaLab animal="cinghiale" shots={draft.shots.map((sh) => ({ score: sh.score, miss: sh.miss, nx: sh.nx, ny: sh.ny, end: sh.end }))} /></Card>
      ) : null}
      {face.id.startsWith("sagoma") ? null : <ShotLab face={face} shots={draft.shots} arrowSpecs={arrowGear?.specs} arrowSets={arrowSets} />}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: Math.max(3, meta.arrowsPerEnd) }, (_, index) => {
          const shot = endArrows.find((item) => item.arrow === index);
          if (!shot) {
            return <span key={`vuoto-${index}`} className="grid h-12 min-w-12 place-items-center rounded-xl border border-dashed border-line text-sm text-muted">{index + 1}</span>;
          }
          return (
          <button
            key={shot.seq}
            type="button"
            onClick={() => setDraft({ ...draft, selected: shot.seq })}
            className={`grid h-12 min-w-12 content-center justify-items-center gap-0.5 rounded-xl border font-display text-2xl tabular-nums ${draft.selected === shot.seq ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface"}`}
          >
            <span className="leading-none">{shot.miss ? "M" : shot.isX && face.rings.some((r) => r.x && r.label !== String(r.score)) ? "X" : shot.score}</span>
            {shot.tag != null ? <span className="font-sans text-[0.55rem] leading-none opacity-70">n.{shot.tag}</span> : null}
          </button>
          );
        })}
        <button
          type="button"
          className="h-12 rounded-xl border border-line px-3 text-sm"
          onClick={() =>
            setDraft((d) => {
              if (!d || !d.shots.length) return d;
              const last = Math.max(...d.shots.map((s) => s.seq));
              return { ...d, shots: d.shots.filter((s) => s.seq !== last), selected: null };
            })
          }
        >
          Annulla
        </button>
      </div>
      {closing ? (
        <Card className="grid gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Risultato delle serie</p>
            <ul className="mt-2 grid gap-1 text-sm tabular-nums">
              {seriesOf(draft).map(([end, shots]) => (
                <li key={end} className="flex justify-between gap-2">
                  <span>Volée {end + 1}</span>
                  <span>{shots.map((s) => (s.miss ? "M" : s.isX ? "X" : s.score)).join(" ")} = {shots.reduce((a, s) => a + s.score, 0)}</span>
                </li>
              ))}
            </ul>
            {!draft.shots.length ? <p className="mt-1 text-sm text-muted">Nessuna freccia segnata.</p> : null}
          </div>
          {meta.program ? <CompareLine program={meta.program} arrows={tally.arrows} avg={tally.avg} recent={boot.recent} /> : null}
          <Marks
            label="Dispersione delle frecce"
            known={DISPERSIONS}
            value={meta.dispersion}
            onChange={(dispersion) => setDraft({ ...draft, meta: { ...meta, dispersion } })}
          />
          <Marks
            label="Errori tecnici"
            known={TECH_ERRORS}
            value={meta.errors}
            onChange={(errors) => setDraft({ ...draft, meta: { ...meta, errors } })}
          />
          <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
            Foto della rosata
            <MediaPick
              kind="image"
              onFile={(file) => {
                compressTarget(file)
                  .then((targetPhoto) => setDraft((current) => (current ? { ...current, meta: { ...current.meta, targetPhoto } } : current)))
                  .catch((err: unknown) => setPending(err instanceof Error ? err.message : "Foto non letta"));
              }}
            />
            {meta.targetPhoto ? <img src={meta.targetPhoto} alt="Rosata di questa sessione" className="mt-2 max-h-48 w-full rounded-xl object-cover" /> : null}
          </div>
          <Field label="Meteo">
            <div className="flex flex-wrap gap-2">
              {["Indoor", "Sereno", "Nuvoloso", "Vento", "Pioggia"].map((w) => (
                <button key={w} type="button" aria-pressed={meta.weather === w} className={`aa-pick min-h-11 rounded-full border px-3 ${meta.weather === w ? "border-accent bg-accent text-accent-fg" : "border-line"}`} onClick={() => setDraft({ ...draft, meta: { ...meta, weather: w } })}>
                  {w}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Sensazioni durante il tiro">
            <TextArea value={meta.feeling} onChange={(e) => setDraft({ ...draft, meta: { ...meta, feeling: e.target.value } })} />
          </Field>
          <Field label="Voto">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-pressed={meta.rating === n} className={`aa-pick h-12 w-12 rounded-xl border font-display text-2xl ${meta.rating === n ? "border-accent bg-accent text-accent-fg" : "border-line"}`} onClick={() => setDraft({ ...draft, meta: { ...meta, rating: n } })}>
                  {n}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Note da ricordare">
            <TextArea value={meta.notes} onChange={(e) => setDraft({ ...draft, meta: { ...meta, notes: e.target.value } })} />
          </Field>
          <Button onClick={() => void finish()}>Chiudi e salva</Button>
        </Card>
      ) : (
        <Button onClick={() => setClosing(true)}>Termina allenamento</Button>
      )}
      <p className="text-center text-xs text-muted">{meta.program ? `Istintivo · ${programById(meta.program)?.title} · ` : ""}{bowLabel(meta.bowType, meta.bowCustom)} · {meta.distanceM} m · {aimTargetLabel(meta.aimTarget)} · {aimAngleLabel(meta.aimAngle)}</p>
    </div>
  );
}

function recentDay() {
  const date = new Date();
  if (date.getHours() < 5) date.setDate(date.getDate() - 1);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function stamp(day: string, time: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const clock = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !clock) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(clock[1]), Number(clock[2]), 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function whenLabel(iso: string) {
  return new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function dayOf(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeOf(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function clampCount(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

type PhotoHit = { nx: number; ny: number; score: number; isX: boolean; miss: boolean; tag?: number | null };

function PhotoVolley({
  face,
  shots,
  volley,
  room,
  arrows,
  points,
  onApply,
  onApplyBatch,
  tags,
}: {
  tags?: number[];
  face: Face;
  shots: DraftShot[];
  volley: number;
  room: number;
  arrows: number;
  points: number;
  onApply: (hits: PhotoHit[]) => void;
  onApplyBatch: (volleys: PhotoHit[][]) => void;
}) {
  const [open, setOpen] = useState(shots.length === 0);
  const ends = new Set(shots.map((s) => `${s.block}:${s.end}`)).size;
  const known = shots.filter((s) => s.nx != null && s.ny != null).map((s) => ({ x: s.nx as number, y: s.ny as number }));
  return (
    <div id="volee-foto" className="scroll-mt-16">
    <Card className="grid gap-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="flex items-center gap-2.5"><AppIcon name="camera" color="#2b74c9" size={34} /><span className="aa-section-title block">Volée da foto</span></span>
          <span className="text-xs text-muted">Foto → salva → foto della volée dopo: frecce e volée si contano da sole.</span>
        </span>
        <span className="aa-chip shrink-0">{open ? "Chiudi" : "Apri"}</span>
      </button>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <span className="aa-kpi !px-2 !py-1.5"><span className="block text-[0.62rem] uppercase tracking-wider text-muted">Volée</span><b className="font-display text-xl tabular-nums">{ends}</b></span>
        <span className="aa-kpi !px-2 !py-1.5"><span className="block text-[0.62rem] uppercase tracking-wider text-muted">Frecce</span><b className="font-display text-xl tabular-nums">{arrows}</b></span>
        <span className="aa-kpi !px-2 !py-1.5"><span className="block text-[0.62rem] uppercase tracking-wider text-muted">Punti</span><b className="font-display text-xl tabular-nums">{points}</b></span>
      </div>
      {open ? <TargetRead face={face} tags={tags} onApply={onApply} onApplyBatch={onApplyBatch} expected={Math.max(1, room)} known={known} volleyLabel={`volée ${volley}`} compact /> : null}
    </Card>
    </div>
  );
}

function ScoreLine({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{k}</p>
      <p className="font-display text-3xl tabular-nums leading-none">{v}</p>
    </div>
  );
}

/** Numero del piano: si applica quando esci dal campo, non a ogni cifra (altrimenti mentre scrivi "12" il piano passa da 1). */
function PlanNumber({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n) && n >= 1) {
      if (n !== value) onCommit(Math.round(n));
    } else setText(String(value));
  };
  return (
    <TextInput
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
    />
  );
}

function payload(draft: Draft, close: boolean) {
  return {
    clientKey: draft.clientKey,
    startedAt: draft.meta.startedAt,
    place: draft.meta.place,
    distanceM: draft.meta.distanceM,
    discipline: draft.meta.discipline,
    bowType: draft.meta.bowType,
    bowCustom: draft.meta.bowCustom,
    face: draft.meta.face,
    setupId: draft.meta.setupId,
    arrowsPerEnd: draft.meta.arrowsPerEnd,
    endsPlanned: draft.meta.endsPlanned,
    blocksPlanned: draft.meta.blocksPlanned,
    weather: draft.meta.weather,
    feeling: draft.meta.feeling,
    rating: draft.meta.rating,
    notes: draft.meta.notes,
    durationMs: draft.meta.endedAt
      ? Math.max(0, new Date(draft.meta.endedAt).getTime() - new Date(draft.meta.startedAt).getTime())
      : elapsed(draft.clock, Date.now()),
    timerLimitMs: draft.totalLimitMs,
    endLimitMs: draft.endLimitMs,
    gearSnapshot: draft.meta.gearSnapshot,
    stringNote: draft.meta.stringNote,
    program: draft.meta.program,
    body: draft.meta.body,
    dispersion: draft.meta.dispersion,
    errors: draft.meta.errors,
    targetPhoto: draft.meta.targetPhoto,
    aimTarget: draft.meta.aimTarget,
    aimAngle: draft.meta.aimAngle,
    endedAt: draft.meta.endedAt || (close ? new Date().toISOString() : null),
    shots: draft.shots.map(({ seq: _seq, ...shot }) => shot),
  };
}

function Setup({
  boot,
  past = false,
  onStart,
  onBack,
}: {
  boot: Awaited<ReturnType<typeof trainingBootstrap>>;
  past?: boolean;
  onStart: (draft: Draft) => void;
  onBack: () => void;
}) {
  const [meta, setMeta] = useState<DraftMeta>({
    place: "",
    distanceM: 18,
    discipline: "indoor",
    bowType: "olimpico",
    bowCustom: "",
    face: "wa10",
    aimTarget: "padiglione",
    aimAngle: "frontale",
    setupId: null,
    arrowsPerEnd: 3,
    endsPlanned: 10,
    blocksPlanned: 1,
    weather: "",
    feeling: "",
    rating: null,
    notes: "",
    stringNote: "",
    gearSnapshot: "",
    startedAt: new Date().toISOString(),
    endedAt: "",
    program: "",
    body: "",
    arrowsChosen: 0,
    dispersion: "",
    errors: "",
    targetPhoto: "",
  });
  const [totalMin, setTotalMin] = useState("");
  const [endSec, setEndSec] = useState("");
  const [day, setDay] = useState(recentDay);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [err, setErr] = useState("");

  function apply(partial: Partial<DraftMeta>) {
    setMeta((m) => ({ ...m, ...partial }));
  }

  function start() {
    setErr("");
    const setup = boot.setups.find((s) => s.id === meta.setupId);
    const bow = boot.gear.find((g) => g.id === setup?.bowId);
    const arrow = boot.gear.find((g) => g.id === setup?.arrowId);
    const gearSnapshot = [bow, arrow].filter(Boolean).map((g) => `${g?.name} ${g?.brand} ${g?.model}`.trim()).join(" · ");
    let startedAt = meta.startedAt || new Date().toISOString();
    let endedAt = "";
    let duration = 0;
    if (past) {
      const startAt = stamp(day, from);
      const endAt = stamp(day, to);
      if (!startAt || !endAt) {
        setErr("Metti la data, l'ora di inizio e l'ora di fine.");
        return;
      }
      if (endAt.getTime() <= startAt.getTime()) {
        setErr("La fine deve essere dopo l'inizio.");
        return;
      }
      if (endAt.getTime() > Date.now()) {
        setErr("Quell'orario non è ancora passato. Se era ieri sera, metti la data di ieri.");
        return;
      }
      duration = endAt.getTime() - startAt.getTime();
      if (duration > 86_400_000) {
        setErr("Un allenamento può durare al massimo 24 ore.");
        return;
      }
      startedAt = startAt.toISOString();
      endedAt = endAt.toISOString();
    }
    const draft = newDraft(
      { ...meta, stringNote: setup?.stringNote || meta.stringNote, gearSnapshot, startedAt, endedAt },
      past ? null : totalMin ? Number(totalMin) * 60_000 : null,
      past ? null : endSec ? Number(endSec) * 1000 : null,
    );
    if (past) draft.clock = { running: false, startedAt: null, accumulatedMs: duration };
    onStart(draft);
  }

  return (
    <div className="grid gap-3">
      <h1 className="font-display text-[2.1rem] tracking-tight">{past ? "Allenamento già fatto" : "Nuovo allenamento"}</h1>
      <div className="grid grid-cols-2 gap-2">
        {QUICK.map((q) => (
          <button key={q.label} type="button" className="min-h-14 rounded-2xl border border-line bg-surface px-3 text-left font-semibold" onClick={() => apply(q)}>
            {q.label}
          </button>
        ))}
      </div>
      <Card className="grid gap-3">
        {past ? (
          <>
            <p className="text-sm text-muted">Metti quando l'hai fatto. Poi segni le frecce, senza il cronometro.</p>
            <Field label="Data">
              <TextInput type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Dalle"><TextInput type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="Alle"><TextInput type="time" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            </div>
          </>
        ) : null}
        <Field label="Luogo">
          <TextInput list="places" value={meta.place} onChange={(e) => apply({ place: e.target.value })} placeholder="Tiro a segno, casa..." />
          <datalist id="places">{boot.places.map((p) => <option key={p} value={p} />)}</datalist>
        </Field>
        <Field label="Distanza (m)">
          <div className="flex flex-wrap gap-2">
            {DISTANCES.map((d) => (
              <button key={d} type="button" className={`min-h-11 rounded-full border px-3 ${meta.distanceM === d ? "border-accent bg-accent text-accent-fg" : "border-line"}`} onClick={() => apply({ distanceM: d })}>
                {d}
              </button>
            ))}
          </div>
          <TextInput className="mt-2" inputMode="decimal" value={meta.distanceM} onChange={(e) => apply({ distanceM: Number(e.target.value.replace(",", ".")) })} />
        </Field>
        <Field label="Arco">
          <Select value={meta.bowType} onChange={(e) => apply({ bowType: e.target.value })}>
            {BOWS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </Select>
        </Field>
        {meta.bowType === "altro" ? (
          <Field label="Che arco">
            <TextInput value={meta.bowCustom} onChange={(e) => apply({ bowCustom: e.target.value })} />
          </Field>
        ) : null}
        <Field label="Disciplina">
          <Select value={meta.discipline} onChange={(e) => apply({ discipline: e.target.value })}>
            {DISCIPLINES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </Select>
        </Field>
        <AimPick
          target={meta.aimTarget}
          angle={meta.aimAngle}
          face={meta.face}
          onChange={(next) => apply(next)}
        />
        {meta.aimTarget === "altro" ? (
          <Field label="Che bersaglio">
            <Select value={meta.face} onChange={(e) => apply({ face: e.target.value })}>
              <option value="field6">Field 6 zone</option>
              <option value="eq-5">5 zone uguali</option>
              <option value="eq-10">10 zone senza X</option>
              <option value="wa10">10 zone, se non è un padiglione da gara</option>
            </Select>
          </Field>
        ) : null}
        <Field label="Configurazione">
          <Select value={meta.setupId ?? ""} onChange={(e) => apply({ setupId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Nessuna</option>
            {boot.setups.map((s) => <option key={s.id} value={s.id}>{s.name}{readMainGear()?.setupId === s.id ? " · principale" : ""}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Frecce/volée"><PlanNumber value={meta.arrowsPerEnd} onCommit={(v) => apply({ arrowsPerEnd: Math.min(24, v) })} /></Field>
          <Field label="Volée"><PlanNumber value={meta.endsPlanned} onCommit={(v) => apply({ endsPlanned: Math.min(60, v) })} /></Field>
          <Field label="Sessioni"><PlanNumber value={meta.blocksPlanned} onCommit={(v) => apply({ blocksPlanned: Math.min(40, v) })} /></Field>
        </div>
        {past ? null : (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Limite totale (min)"><TextInput inputMode="numeric" value={totalMin} onChange={(e) => setTotalMin(e.target.value)} placeholder="vuoto" /></Field>
          <Field label="Limite volée (sec)"><TextInput inputMode="numeric" value={endSec} onChange={(e) => setEndSec(e.target.value)} placeholder="120 o 240" /></Field>
        </div>
        )}
        {err ? <ErrorNote text={err} /> : null}
        <Button onClick={start}>{past ? "Segna le frecce" : "Inizia"}</Button>
        <Button variant="ghost" onClick={onBack}>Torna al programma istintivo</Button>
      </Card>
    </div>
  );
}

function ProgramPick({
  boot,
  onStart,
  onOther,
  onPast,
  onHistory,
  onGesture,
}: {
  boot: Awaited<ReturnType<typeof trainingBootstrap>>;
  onStart: (draft: Draft) => void;
  onOther: () => void;
  onPast: () => void;
  onHistory: () => void;
  onGesture: () => void;
}) {
  // già pronti: l'obiettivo dell'ultima volta e "normale", così si parte con un tocco
  const [program, setProgram] = useState<ProgramId | "">(() => (PROGRAMS.some((p) => p.id === boot.recent[0]?.program) ? (boot.recent[0]?.program as ProgramId) : ""));
  const [body, setBody] = useState<BodyId | "">("normale");
  const [volume, setVolume] = useState<(typeof VOLUMES)[number]>(30);
  const [touched, setTouched] = useState(false);
  const [place, setPlace] = useState("");
  const [aimTarget, setAimTarget] = useState<DraftMeta["aimTarget"]>("padiglione");
  const [aimAngle, setAimAngle] = useState<DraftMeta["aimAngle"]>("frontale");
  const [face, setFace] = useState("wa10");
  const last = program ? boot.recent.find((row) => row.program === program) ?? null : null;

  useEffect(() => {
    if (touched || !program) return;
    setVolume(sameVolume(last?.planned ?? null));
  }, [program, touched, last]);

  function prepare() {
    if (!program || !body) return;
    onStart(
      newDraft(
        {
          place,
          distanceM: 18,
          discipline: "tradizionale",
          bowType: "tradizionale",
          bowCustom: "",
          face,
          aimTarget,
          aimAngle,
          setupId: readMainGear()?.setupId ?? null,
          arrowsPerEnd: 3,
          endsPlanned: volume / 3,
          blocksPlanned: 1,
          weather: "",
          feeling: "",
          rating: null,
          notes: "",
          stringNote: "",
          gearSnapshot: "",
          startedAt: new Date().toISOString(),
          endedAt: "",
          program,
          body,
          arrowsChosen: volume,
          dispersion: "",
          errors: "",
          targetPhoto: "",
        },
        null,
        null,
      ),
    );
  }

  const plan = program ? programById(program) : null;

  return (
    <div className="grid gap-5">
      <header className="aa-hero px-4 pb-4 pt-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/60">Allenamento</p>
        <h1 className="font-display text-[2.1rem] leading-none tracking-tight">Cosa alleni oggi</h1>
        <p className="mt-1 text-xs text-white/70">Un tocco per ripartire, oppure scegli qui sotto obiettivo e frecce.</p>
        <Link to="/allenamento" search={{ avvia: "rapido" }} className="mt-3 block">
          <Button className="aa-glow w-full"><Glyph name="bolt" size={18} /> Riparti come l'ultima volta</Button>
        </Link>
        <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[0.68rem] font-semibold">
          <Link to="/allenamento" search={{ avvia: "foto" }} className="aa-press grid gap-0.5 rounded-xl border border-white/10 bg-white/[0.06] py-2">
            <Glyph name="camera" size={20} className="mx-auto" />
            Da foto
          </Link>
          {([
            ["archer", "Gesto", onGesture],
            ["notebook", "Già fatto", onPast],
            ["history", "Storico", onHistory],
          ] as const).map(([icon, label, go]) => (
            <button key={label} type="button" onClick={go} className="aa-press grid gap-0.5 rounded-xl border border-white/10 bg-white/[0.06] py-2">
              <Glyph name={icon} size={20} className="mx-auto" />
              {label}
            </button>
          ))}
        </div>
      </header>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">Obiettivo</h2>
        {PROGRAMS.map((item, index) => {
          const on = program === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              style={{ animationDelay: `${index * 45}ms` }}
              className={`aa-rise aa-pick flex items-start gap-3 rounded-2xl border p-4 text-left ${on ? "border-accent bg-accent/10" : "border-line bg-surface"}`}
              onClick={() => setProgram(item.id)}
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-2xl ${on ? "bg-accent text-accent-fg" : "bg-primary text-primary-fg"}`}>{item.id}</span>
              <span>
                <span className="block font-semibold">{item.ask}</span>
                <span className="mt-0.5 block text-sm text-muted">{item.goal}</span>
              </span>
            </button>
          );
        })}
      </section>
      {plan ? (
        <Card className="aa-rise">
          <p className="text-xs uppercase tracking-wide text-muted">In questa sessione</p>
          <ul className="mt-2 grid gap-1 text-sm">
            {plan.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </Card>
      ) : null}
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">Come ti senti</h2>
        <div className="grid grid-cols-3 gap-2">
          {BODIES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={body === item.id}
              className={`aa-pick min-h-14 rounded-2xl border font-semibold ${body === item.id ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface"}`}
              onClick={() => setBody(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">Quante frecce</h2>
        <div className="grid grid-cols-4 gap-2">
          {VOLUMES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={volume === n}
              className={`aa-pick min-h-14 rounded-2xl border font-display text-2xl ${volume === n ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface"}`}
              onClick={() => {
                setTouched(true);
                setVolume(n);
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">{volumeHint(volume, last?.planned ?? null, body, last?.errors ?? "")}</p>
        {last ? (
          <Card>
            <p className="text-xs uppercase tracking-wide text-muted">Sessione precedente di questo tipo</p>
            <p className="font-display text-3xl tabular-nums">{fmtAvg(last.avg)} <span className="text-lg text-muted">media · {last.arrows} frecce</span></p>
            <p className="text-sm text-muted">{last.startedAt.slice(0, 10)}{last.dispersion ? ` · rosata ${last.dispersion}` : ""}</p>
            {last.errors ? <p className="mt-1 text-sm">Errori segnati: {last.errors}. Si lavora su quelli, senza aggiungere frecce.</p> : null}
          </Card>
        ) : program ? <p className="text-sm text-muted">Prima volta su questo obiettivo. Non c'è un carico da superare.</p> : null}
      </section>
      <AimPick target={aimTarget} angle={aimAngle} face={face} onChange={(next) => { setAimTarget(next.aimTarget); setAimAngle(next.aimAngle); setFace(next.face); }} />
      <Field label="Luogo, se vuoi">
        <TextInput list="places" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Tiro, casa, bosco..." />
        <datalist id="places">{boot.places.map((p) => <option key={p} value={p} />)}</datalist>
      </Field>
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.6rem)] z-10 grid gap-2 md:bottom-4">
        <Button disabled={!program || !body} onClick={prepare} className="shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)]">
          {program && body ? `Inizia · ${volume} frecce` : "Scegli l'obiettivo per iniziare"}
        </Button>
      </div>
      <Button variant="ghost" onClick={onOther}>Altro formato (distanza, volée, arco)</Button>
    </div>
  );
}

function Marks({
  label,
  known,
  value,
  onChange,
}: {
  label: string;
  known: readonly string[];
  value: string;
  onChange: (next: string) => void;
}) {
  const parsed = unpackMarks(value, known);
  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {known.map((item) => {
          const on = parsed.picked.includes(item);
          return (
            <button
              key={item}
              type="button"
              aria-pressed={on}
              className={`aa-pick min-h-11 rounded-full border px-3 ${on ? "border-accent bg-accent text-accent-fg" : "border-line"}`}
              onClick={() => onChange(packMarks(on ? parsed.picked.filter((part) => part !== item) : [...parsed.picked, item], parsed.note))}
            >
              {item}
            </button>
          );
        })}
      </div>
      <TextInput className="mt-2" value={parsed.note} placeholder="Nota libera" onChange={(e) => onChange(packMarks(parsed.picked, e.target.value))} />
    </div>
  );
}

function CompareLine({
  program,
  arrows,
  avg,
  recent,
}: {
  program: string;
  arrows: number;
  avg: number;
  recent: Awaited<ReturnType<typeof trainingBootstrap>>["recent"];
}) {
  const prior = recent.find((row) => row.program === program);
  if (!prior || !prior.arrows || !arrows) {
    return <p className="text-sm text-muted">Nessun confronto ancora. Questa sessione resta il riferimento: la prossima non parte da un volume più alto.</p>;
  }
  const delta = avg - prior.avg;
  const tone = delta > 0.05 ? "sopra" : delta < -0.05 ? "sotto" : "in linea con";
  const volume = arrows === prior.arrows ? "stesso numero di frecce" : `${arrows} frecce oggi, ${prior.arrows} la volta scorsa`;
  return (
    <p className="text-sm">
      Rispetto al {prior.startedAt.slice(0, 10)}: media {fmtAvg(avg)} contro {fmtAvg(prior.avg)}, {tone} la volta scorsa, {volume}. Il programma non ha alzato il carico.
    </p>
  );
}

function seriesOf(draft: Draft) {
  const map = new Map<number, DraftShot[]>();
  for (const shot of draft.shots) {
    const rows = map.get(shot.end) ?? [];
    rows.push(shot);
    map.set(shot.end, rows);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

function compressTarget(file: File) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 480 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas non disponibile"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL("image/jpeg", 0.72);
      if (data.length > 170_000) data = canvas.toDataURL("image/jpeg", 0.5);
      if (data.length > 170_000) return reject(new Error("Foto troppo pesante. Avvicina meno, o riprova."));
      resolve(data);
    };
    img.onerror = () => reject(new Error("Immagine non letta"));
    img.src = URL.createObjectURL(file);
  });
}

function History({ onNew }: { onNew: () => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listSessions>>["sessions"]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    listSessions()
      .then((data) => setRows(data.sessions))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Errore"))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <Loading />;
  return (
    <div className="grid gap-3">
      <h1 className="font-display text-[2.1rem] tracking-tight">Storico</h1>
      <p className="text-sm text-muted">Tutti gli allenamenti. Aprilo per cambiare data, orari, arco, distanza, bersaglio e frecce: le statistiche si aggiornano da questi dati.</p>
      <Button onClick={onNew}>Nuovo allenamento</Button>
      {error ? <ErrorNote text={error} /> : null}
      {rows.length === 0 ? <p className="text-sm text-muted">Nessun allenamento registrato.</p> : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link to="/allenamento/$id" params={{ id: String(row.id) }} className="block rounded-2xl border border-line bg-surface px-3 py-3">
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{new Date(row.startedAt).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{row.endedAt ? ` – ${new Date(row.endedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
                    <span className="block truncate text-sm text-muted">{row.distanceM} m · {bowLabel(row.bowType, row.bowCustom)} · {row.arrows} frecce{row.place ? ` · ${row.place}` : ""}</span>
                  </span>
                  <span className="font-display text-3xl tabular-nums">{row.arrows ? fmtAvg(row.avg) : "—"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

