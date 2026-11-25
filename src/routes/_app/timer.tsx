import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Chips, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLocalState, useWakeLock, whistle } from "@/lib/arcieri/local-store";

export const Route = createFileRoute("/_app/timer")({ component: Page });

/**
 * Timer di tiro come in gara: avvicinamento (rosso, 2 fischi), tiro (verde, 1 fischio),
 * ultimi 30 secondi (giallo), fine (3 fischi). Con i turni AB/CD si alternano le linee.
 */
type Settings = { shoot: number; walk: number; ends: number; turns: "singolo" | "abcd"; warn: number };
const DEFAULTS: Settings = { shoot: 120, walk: 10, ends: 10, turns: "singolo", warn: 30 };

type Phase = "pronto" | "avvicinamento" | "tiro" | "fine";

function Page() {
  return <TimerBody />;
}

/** il timer, anche dentro «Ritmo del tiro» (senza intestazione) */
export function TimerBody({ embedded = false }: { embedded?: boolean }) {
  const [cfg, setCfg] = useLocalState<Settings>("aa-timer-v1", DEFAULTS);
  const [phase, setPhase] = useState<Phase>("pronto");
  const [left, setLeft] = useState(cfg.walk);
  const [end, setEnd] = useState(1);
  const [line, setLine] = useState<0 | 1>(0); // 0 = AB, 1 = CD
  const [running, setRunning] = useState(false);
  const last = useRef(0);
  useWakeLock(running);

  const total = phase === "avvicinamento" ? cfg.walk : cfg.shoot;

  useEffect(() => {
    if (!running) return;
    last.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last.current) / 1000;
      last.current = now;
      setLeft((l) => Math.max(0, l - dt));
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running || left > 0) return;
    if (phase === "avvicinamento") {
      whistle(1);
      setPhase("tiro");
      setLeft(cfg.shoot);
      return;
    }
    if (phase === "tiro") {
      if (cfg.turns === "abcd" && line === 0) {
        // cambio linea: avvicinamento del secondo turno
        whistle(2);
        setLine(1);
        setPhase("avvicinamento");
        setLeft(cfg.walk);
        return;
      }
      whistle(3);
      setRunning(false);
      setPhase("fine");
    }
  }, [left, running, phase, cfg, line]);

  function start() {
    if (phase === "pronto" || phase === "fine") {
      if (phase === "fine") {
        setEnd((e) => Math.min(cfg.ends, e + 1));
        setLine(0);
      }
      whistle(2);
      setPhase("avvicinamento");
      setLeft(cfg.walk);
    }
    setRunning(true);
  }

  function reset() {
    setRunning(false);
    setPhase("pronto");
    setEnd(1);
    setLine(0);
    setLeft(cfg.walk);
  }

  function skip() {
    setLeft(0);
    if (!running) setRunning(true);
  }

  const color = phase === "avvicinamento" ? "#d64545" : phase === "tiro" ? (left <= cfg.warn ? "#e3a21a" : "#2fbf71") : phase === "fine" ? "#d64545" : "#55647b";
  const label = phase === "pronto" ? "Pronto" : phase === "avvicinamento" ? "Avvicinamento" : phase === "tiro" ? (left <= cfg.warn ? "Ultimi secondi" : "Tira") : "Fine volée";
  const frac = phase === "pronto" ? 1 : Math.max(0, Math.min(1, left / Math.max(1, total)));
  const r = 108;
  const c = 2 * Math.PI * r;
  const mm = Math.floor(Math.ceil(left) / 60);
  const ss = String(Math.ceil(left) % 60).padStart(2, "0");

  return (
    <div className="grid gap-3">
      {embedded ? null : <PageHead kicker="Come in gara" title="Timer di tiro" lede="Semaforo, fischi e turni AB/CD. Lo schermo resta acceso mentre corre." />}
      <Card className="grid justify-items-center gap-3 overflow-hidden">
        <div className="flex w-full items-center justify-between text-xs text-muted">
          <span>Volée <b className="text-fg">{end}</b> di {cfg.ends}</span>
          {cfg.turns === "abcd" ? <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold text-fg">Turno {line === 0 ? "AB" : "CD"}</span> : null}
        </div>
        <div className="relative grid h-[250px] w-[250px] place-items-center">
          <div className="absolute inset-4 rounded-full blur-2xl transition-colors duration-500" style={{ background: color, opacity: running ? 0.35 : 0.15 }} />
          <svg viewBox="0 0 240 240" className="absolute inset-0 -rotate-90">
            <circle cx="120" cy="120" r={r} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth="14" />
            <circle cx="120" cy="120" r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} style={{ transition: "stroke-dasharray 0.12s linear, stroke 0.4s" }} />
          </svg>
          <div className="relative text-center">
            <p className="font-display text-[4.2rem] leading-none tabular-nums">{mm}:{ss}</p>
            <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em]" style={{ color }}>{label}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {["#d64545", "#e3a21a", "#2fbf71"].map((lamp) => (
            <span key={lamp} className="h-4 w-4 rounded-full transition-all" style={{ background: lamp, opacity: lamp === color ? 1 : 0.18, boxShadow: lamp === color ? `0 0 14px ${lamp}` : "none" }} />
          ))}
        </div>
        <div className="grid w-full grid-cols-[1fr_2fr_1fr] gap-2">
          <button type="button" onClick={reset} className="aa-press grid min-h-14 place-items-center rounded-2xl border border-hair bg-white/[0.04]" aria-label="Azzera">
            <Glyph name="history" size={22} />
          </button>
          <button
            type="button"
            onClick={() => (running ? setRunning(false) : start())}
            className="aa-press min-h-14 rounded-2xl text-base font-bold text-white shadow-lg transition-colors"
            style={{ background: running ? "#55647b" : "var(--primary)" }}
          >
            {running ? "Pausa" : phase === "fine" ? (end >= cfg.ends ? "Ricomincia" : "Volée dopo") : phase === "pronto" ? "Via" : "Riprendi"}
          </button>
          <button type="button" onClick={skip} disabled={phase === "pronto" || phase === "fine"} className="aa-press grid min-h-14 place-items-center rounded-2xl border border-hair bg-white/[0.04] disabled:opacity-40" aria-label="Salta la fase">
            <Glyph name="chevron" size={22} />
          </button>
        </div>
      </Card>
      <Card className="grid gap-3">
        <p className="aa-section-title">Impostazioni</p>
        <div className="grid gap-1">
          <p className="text-xs text-muted">Tempo per volée</p>
          <Chips value={String(cfg.shoot)} onChange={(v) => setCfg({ ...cfg, shoot: Number(v) })} options={[{ id: "40", label: "40 s · 1 freccia" }, { id: "120", label: "2 min · 3 frecce" }, { id: "240", label: "4 min · 6 frecce" }, { id: "90", label: "90 s" }]} />
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted">Avvicinamento</p>
          <Chips value={String(cfg.walk)} onChange={(v) => setCfg({ ...cfg, walk: Number(v) })} options={[{ id: "10", label: "10 s" }, { id: "20", label: "20 s" }, { id: "0", label: "Nessuno" }]} />
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted">Turni</p>
          <Chips value={cfg.turns} onChange={(v) => setCfg({ ...cfg, turns: v })} options={[{ id: "singolo", label: "Linea unica" }, { id: "abcd", label: "AB / CD" }]} />
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted">Volée</p>
          <Chips value={String(cfg.ends)} onChange={(v) => setCfg({ ...cfg, ends: Number(v) })} options={["6", "10", "12", "20"].map((v) => ({ id: v, label: v }))} />
        </div>
      </Card>
    </div>
  );
}
