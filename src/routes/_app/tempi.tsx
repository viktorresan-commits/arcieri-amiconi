import { useEffect, useRef, useState } from "react";
import { ToolArt } from "@/components/tool-art";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, Chips, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { Mini, fmt } from "@/components/tool-kit";
import { useLocalState } from "@/lib/arcieri/local-store";
import { listGestures, type GestureRow } from "@/lib/arcieri/gesture.api";
import { award } from "@/lib/arcieri/xp";

export const Route = createFileRoute("/_app/tempi")({ component: Page });

/**
 * Tempo di allungo: quanto passa dall'inizio della trazione al rilascio, freccia per freccia.
 * Si cronometra con un tocco (meglio se lo fa un compagno), oppure si leggono i tempi dalle analisi
 * del gesto salvate. Un tempo costante è uno dei segni più chiari di un tiro ripetibile.
 */
type Lap = { at: string; s: number };
const BANDS: Record<string, { lo: number; hi: number; text: string }> = {
  olimpico: { lo: 4, hi: 8, text: "Olimpico: di solito 4–8 s dall'inizio trazione al clicker." },
  nudo: { lo: 3, hi: 7, text: "Nudo: di solito 3–7 s." },
  tradizionale: { lo: 2, hi: 5, text: "Tradizionali: tiro più veloce, di solito 2–5 s." },
  compound: { lo: 5, hi: 12, text: "Compound: mira più lunga, di solito 5–12 s." },
};

function Page() {
  const [st, setSt] = useLocalState<{ laps: Lap[]; bow: string }>("aa-tempi-v1", { laps: [], bow: "olimpico" });
  const [src, setSrc] = useState<"cronometro" | "video">("cronometro");
  const [running, setRunning] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const raf = useRef(0);
  const band = BANDS[st.bow] ?? BANDS.olimpico;

  useEffect(() => {
    if (running == null) return;
    const tick = () => {
      setNow((performance.now() - running) / 1000);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running]);

  const tap = () => {
    if (running == null) {
      setRunning(performance.now());
      setNow(0);
      if (navigator.vibrate) navigator.vibrate(15);
      return;
    }
    const s = (performance.now() - running) / 1000;
    setRunning(null);
    if (s < 0.5) return;
    const laps = [{ at: new Date().toISOString(), s }, ...st.laps].slice(0, 120);
    setSt({ ...st, laps });
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    if (laps.filter((l) => l.at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length === 12) award(10, "Dodici tempi di allungo");
  };

  const today = st.laps.filter((l) => l.at.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const list = today.length ? today : st.laps.slice(0, 24);
  const stats = (xs: number[]) => {
    if (!xs.length) return null;
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    return { m, sd, min: Math.min(...xs), max: Math.max(...xs) };
  };
  const st1 = stats(list.map((l) => l.s));

  return (
    <div className="grid gap-3">
      <PageHead kicker="Allenati" title="Tempo di allungo" lede="Dall'inizio della trazione al rilascio. Più è costante, più il tiro è ripetibile." />
      <ToolArt id="tempi" />
      <Chips value={src} onChange={setSrc} options={[{ id: "cronometro", label: "Cronometro" }, { id: "video", label: "Dalle analisi del gesto" }]} />
      <Chips value={st.bow} onChange={(bow) => setSt({ ...st, bow })} options={[{ id: "olimpico", label: "Olimpico" }, { id: "nudo", label: "Nudo" }, { id: "tradizionale", label: "Tradizionale" }, { id: "compound", label: "Compound" }]} />
      {src === "cronometro" ? (
        <>
          <button
            type="button"
            onClick={tap}
            className={`aa-press grid min-h-56 place-items-center rounded-[2rem] text-center transition-colors ${running != null ? "bg-rose-600/85" : "bg-primary/85"}`}
          >
            <span>
              <span className="block font-display text-7xl tabular-nums">{fmt(running != null ? now : (list[0]?.s ?? 0), 1)}<span className="text-3xl">s</span></span>
              <span className="mt-2 block text-sm font-semibold uppercase tracking-[0.2em]">{running != null ? "Tocca al rilascio" : "Tocca all'inizio della trazione"}</span>
            </span>
          </button>
          <p className="text-center text-xs text-muted">{band.text}</p>
        </>
      ) : (
        <FromVideos band={band} />
      )}
      {src === "cronometro" && list.length ? (
        <Card className="grid gap-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{today.length ? `Oggi · ${today.length} frecce` : "Ultimi tempi"}</p>
            <button type="button" className="text-xs text-muted" onClick={() => setSt({ ...st, laps: st.laps.filter((l) => !today.includes(l)) })}>Azzera oggi</button>
          </div>
          {st1 ? (
            <div className="grid grid-cols-3 gap-1.5">
              <Mini k="Media" v={`${fmt(st1.m, 1)} s`} tone={st1.m >= band.lo && st1.m <= band.hi ? "ok" : "warn"} />
              <Mini k="Costanza" v={`±${fmt(st1.sd, 1)} s`} tone={st1.sd < 0.6 ? "ok" : st1.sd < 1.2 ? "warn" : "bad"} />
              <Mini k="Da – a" v={`${fmt(st1.min, 1)}–${fmt(st1.max, 1)}`} />
            </div>
          ) : null}
          <Bars values={[...list].reverse().map((l) => l.s)} band={band} />
          <p className="text-xs text-muted">{st1 && st1.sd >= 1.2 ? "I tempi cambiano molto: prova a contare mentalmente le fasi (trazione, ancoraggio, mira) sempre uguali." : "Fascia verde: tempo consigliato per il tuo arco."}</p>
        </Card>
      ) : null}
      <Link to="/routine" className="aa-chip justify-self-start"><Glyph name="steps" size={14} /> Ripassa la routine di tiro</Link>
    </div>
  );
}

function Bars({ values, band }: { values: number[]; band: { lo: number; hi: number } }) {
  const W = 320;
  const H = 120;
  const max = Math.max(band.hi + 2, ...values);
  const bw = Math.min(22, (W - 20) / Math.max(1, values.length) - 3);
  const Y = (v: number) => H - 14 - (v / max) * (H - 24);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <rect x="0" y={Y(band.hi)} width={W} height={Y(band.lo) - Y(band.hi)} fill="rgb(52 211 153 / 0.12)" />
      {values.map((v, i) => {
        const x = 10 + i * (bw + 3);
        const good = v >= band.lo && v <= band.hi;
        return <rect key={i} x={x} y={Y(v)} width={bw} height={H - 14 - Y(v)} rx="3" fill={good ? "#2fbf71" : "#e3a21a"} className="aa-grow-y" style={{ animationDelay: `${i * 30}ms` }} />;
      })}
      <line x1="0" x2={W} y1={H - 14} y2={H - 14} stroke="currentColor" strokeOpacity="0.2" />
    </svg>
  );
}

function FromVideos({ band }: { band: { lo: number; hi: number } }) {
  const [rows, setRows] = useState<GestureRow[] | null>(null);
  useEffect(() => {
    listGestures().then(setRows).catch(() => setRows([]));
  }, []);
  if (!rows) return <Card><p className="text-sm text-muted">Carico le analisi…</p></Card>;
  const timed = rows.filter((r) => r.drawS != null || r.anchorS != null).slice(0, 24);
  if (!timed.length) {
    return (
      <Card className="grid gap-2">
        <p className="text-sm">Nessuna analisi con i tempi. In «Analisi gesto» carica o registra un video e premi «Analizza»: trazione e ancoraggio vengono misurati da soli.</p>
        <Link to="/allenamento" search={{ avvia: "gesto" } as never} className="aa-chip justify-self-start">Apri l'analisi del gesto</Link>
      </Card>
    );
  }
  const total = (r: GestureRow) => (r.drawS ?? 0) + (r.anchorS ?? 0);
  return (
    <Card className="grid gap-2">
      <p className="font-semibold">Dai video analizzati</p>
      <Bars values={[...timed].reverse().map(total)} band={band} />
      {timed.slice(0, 8).map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 border-b border-white/5 py-1 text-sm last:border-0">
          <span className="min-w-0 truncate">{r.title || "Analisi"} · {new Date(r.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</span>
          <span className="tabular-nums text-muted">trazione {fmt(r.drawS ?? NaN, 1)} s · ancoraggio {fmt(r.anchorS ?? NaN, 1)} s</span>
        </div>
      ))}
    </Card>
  );
}
