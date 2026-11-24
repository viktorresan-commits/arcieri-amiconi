import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { listGestures, type GestureRow } from "@/lib/arcieri/gesture.api";
import { drawCmOf, postureOf, readRecord } from "@/lib/arcieri/gesture-record";
import { Card } from "./kit";
import { Glyph } from "./icons";


const AREA_LABEL: Record<string, string> = { testa: "Testa", spalle: "Spalle", braccioArco: "Braccio arco", polsoArco: "Polso arco", gomito: "Gomito corda", polsoCorda: "Polso corda", ancoraggio: "Ancoraggio", busto: "Busto", gambe: "Gambe", attrezzatura: "Allungo" };
const f1 = (v: number) => v.toFixed(1).replace(".", ",");
const f2 = (v: number) => v.toFixed(2).replace(".", ",");
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
};

/** Linea minima con punti, area e (facoltativa) fascia ideale. */
function MiniLine({ values, color, band, invert = false, unit = "" }: { values: number[]; color: string; band?: [number, number]; invert?: boolean; unit?: string }) {
  if (values.length < 2) return <p className="text-xs text-muted">Servono almeno due misure.</p>;
  const W = 320;
  const H = 86;
  const lo = Math.min(...values, band?.[0] ?? Infinity);
  const hi = Math.max(...values, band?.[1] ?? -Infinity);
  const pad = (hi - lo) * 0.15 || 1;
  const y = (v: number) => 8 + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - 22);
  const x = (i: number) => 6 + (i / (values.length - 1)) * (W - 12);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const first = values[0];
  const last = values[values.length - 1];
  const better = invert ? last < first : last > first;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Andamento">
      {band ? <rect x="0" y={y(band[1])} width={W} height={Math.max(2, y(band[0]) - y(band[1]))} fill="#3d8f5f" opacity="0.14" /> : null}
      <path d={`${d} L${x(values.length - 1)} ${H - 14} L${x(0)} ${H - 14} Z`} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 3.6 : 2} fill={color} />)}
      <text x="6" y={H - 2} fill="var(--muted)" fontSize="10">prima {f1(first)}{unit}</text>
      <text x={W - 6} y={H - 2} fill={better ? "#7cf0a8" : "#f2a65a"} fontSize="10" textAnchor="end">ultima {f1(last)}{unit}</text>
    </svg>
  );
}

function Head({ icon, title, sub }: { icon: Parameters<typeof Glyph>[0]["name"]; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06]"><Glyph name={icon} size={19} /></span>
      <div className="min-w-0">
        <p className="aa-section-title">{title}</p>
        {sub ? <p className="text-xs text-muted">{sub}</p> : null}
      </div>
    </div>
  );
}

function Kpis({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 text-center">
      {items.map(([k, v]) => (
        <span key={k} className="rounded-xl bg-white/[0.05] px-1 py-1.5">
          <span className="block text-[0.58rem] uppercase tracking-wider text-muted">{k}</span>
          <b className="font-display text-base tabular-nums">{v}</b>
        </span>
      ))}
    </div>
  );
}

/** Statistiche del corpo: allungo, tempi, postura, tenuta e respiro (dalle analisi del gesto e dagli strumenti). */
export function BodyStats() {
  const [rows, setRows] = useState<GestureRow[] | null>(null);
  const [laps, setLaps] = useState<{ at: string; s: number }[]>([]);
  const [breath, setBreath] = useState<Record<string, Record<string, number>>>({});
  useEffect(() => {
    listGestures().then(setRows).catch(() => setRows([]));
    try {
      setLaps((JSON.parse(localStorage.getItem("aa-tempi-v1") || "{}") as { laps?: { at: string; s: number }[] }).laps ?? []);
      setBreath(JSON.parse(localStorage.getItem("aa-respiro-days") || "{}") as Record<string, Record<string, number>>);
    } catch {
      /* niente dati locali */
    }
  }, []);

  // dal più vecchio al più recente; l'ultima analisi è quella che dà i numeri principali
  const g = useMemo(() => [...(rows ?? [])].reverse().map((r) => ({ r, d: readRecord(r.data) })), [rows]);
  const last = g.length ? g[g.length - 1] : null;
  const lastD = last?.d ?? null;
  const drawLen = g.map((x) => drawCmOf(x.d)).filter((v): v is number => v != null);
  const lastDraw = lastD ? drawCmOf(lastD) : null;
  const drawOf = (x: (typeof g)[number]) => x.d.shot?.drawS ?? x.r.drawS;
  const holdOf = (x: (typeof g)[number]) => x.d.shot?.anchorS ?? x.r.anchorS;
  const drawS = [...g.map(drawOf).filter((v): v is number => v != null && v > 0.3 && v < 8), ...laps.map((l) => l.s)].slice(-40);
  const hold = g.map(holdOf).filter((v): v is number => v != null && v > 0.2 && v < 15);
  const jitter = g.map((x) => x.r.jitter).filter((v): v is number => v != null && v >= 0);
  const postures = g.map((x) => postureOf(x.d)).filter((p): p is { total: number; areas: Record<string, number | null> } => Boolean(p));
  const totals = postures.map((p) => p.total);
  const lastDrawS = last ? drawOf(last) : null;
  const lastHold = last ? holdOf(last) : null;
  const lastJitter = last?.r.jitter ?? null;
  const lastCreep = lastD?.shot?.creep ?? null;
  const lastPost = lastD ? postureOf(lastD) : null;

  // zone del corpo: prima analisi e ultima
  const firstAreas = postures[0]?.areas ?? {};
  const lastAreas = lastPost?.areas ?? {};
  const areas = Object.keys(AREA_LABEL)
    .map((k) => ({ k, a: firstAreas[k], b: lastAreas[k] }))
    .filter((x): x is { k: string; a: number; b: number } => typeof x.a === "number" && typeof x.b === "number");

  // respiro: ultimi 14 giorni
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = d.toLocaleDateString("sv-SE");
    const n = Object.values(breath[key] ?? {}).reduce((a, b) => a + b, 0);
    return { key, n, label: d.toLocaleDateString("it-IT", { weekday: "narrow" }) };
  });
  const breathDays = Object.keys(breath).length;
  const breathTotal = Object.values(breath).reduce((a, d) => a + Object.values(d).reduce((x, y) => x + y, 0), 0);
  const maxDay = Math.max(1, ...days.map((d) => d.n));

  const tips: string[] = [];
  if (lastD && !lastD.lm && g.length) tips.push("L'ultima analisi è nel vecchio formato: rifanne una per avere allungo, ancoraggio e postura completi.");
  if (totals.length >= 2) {
    const delta = totals[totals.length - 1] - totals[0];
    tips.push(delta >= 0 ? `Postura: +${delta} punti dalla prima analisi.` : `Postura: ${delta} punti dalla prima analisi, riguarda le zone in calo qui sotto.`);
  }
  if (drawLen.length >= 2) tips.push(sd(drawLen) < 1 ? `Allungo costante (±${f1(sd(drawLen))} cm): bene, la freccia parte sempre uguale.` : `Allungo che varia di ±${f1(sd(drawLen))} cm: lavora sull'ancoraggio e sul clicker.`);
  if (drawS.length >= 5) tips.push(sd(drawS) / Math.max(0.1, mean(drawS)) < 0.12 ? "Tempi di allungo regolari." : "Tempi di allungo irregolari: usa il registratore e cerca lo stesso ritmo a ogni freccia.");
  if (jitter.length >= 2) tips.push(jitter[jitter.length - 1] <= jitter[0] ? "La mira è più ferma di prima." : "La mira trema più di prima: prova il respiro guidato prima della volée.");
  if (breathDays === 0) tips.push("Nessun respiro guidato registrato: prova «Respiro» prima di tirare, compare qui.");

  if (rows == null) return <p className="text-xs text-muted">Carico le analisi del gesto…</p>;
  return (
    <>
      {/* da dove vengono i numeri: l'ultima analisi del gesto salvata */}
      <Link to="/gesti" className="block">
        <Card className="grid gap-2.5">
          <div className="flex items-center gap-3">
            {last?.r.thumb ? <img src={last.r.thumb} alt="" className="h-14 w-11 shrink-0 rounded-lg object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#7652d1]/25"><Glyph name="archer" size={22} /></span>}
            <span className="min-w-0 flex-1">
              <b className="block">{last ? "Dall'ultima analisi del gesto" : "Analisi del gesto"}</b>
              <span className="block text-xs text-muted">{last ? `${new Date(last.r.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "long" })} · ${rows.length} ${rows.length === 1 ? "analisi salvata" : "analisi salvate"}: tocca per lo storico e il 3D.` : "Nessuna analisi salvata: i numeri del corpo arrivano dalle analisi del gesto."}</span>
            </span>
            <Glyph name="chevron" size={16} className="text-muted" />
          </div>
          {last ? (
            <Kpis
              items={[
                ["Allungo", lastDraw != null ? `${Math.round(lastDraw)} cm` : "—"],
                ["Trazione", lastDrawS != null ? `${f1(lastDrawS)} s` : "—"],
                ["Tenuta", lastHold != null ? `${f1(lastHold)} s` : "—"],
                ["Ancoraggio", lastD?.kit?.anchorCm != null ? `${Math.round(lastD.kit!.anchorCm!)} cm` : "—"],
                ["Tremolio", lastJitter != null ? f2(lastJitter) : "—"],
                ["Postura", lastPost ? `${Math.round(lastPost.total)}/100` : "—"],
              ]}
            />
          ) : null}
        </Card>
      </Link>
      {tips.length ? (
        <Card className="grid gap-1.5">
          <Head icon="sparkle" title="In breve" />
          <ul className="grid gap-1">
            {tips.map((t) => <li key={t} className="rounded-xl bg-white/[0.04] px-2.5 py-1.5 text-sm">{t}</li>)}
          </ul>
        </Card>
      ) : null}

      <Card className="grid gap-2">
        <Head icon="span" title="Allungo" sub="Dall'ultima analisi del gesto (con la tua altezza è più preciso)" />
        <Kpis items={[["Ultimo", lastDraw != null ? `${f1(lastDraw)} cm` : "—"], ["Medio", drawLen.length ? `${f1(mean(drawLen))} cm` : "—"], ["Variazione", drawLen.length > 1 ? `±${f1(sd(drawLen))}` : "—"]]} />
        <MiniLine values={drawLen} color="#5aa6e8" unit=" cm" />
      </Card>

      <Card className="grid gap-2">
        <Head icon="stopwatch" title="Tempo di allungo e tenuta" sub="Dall'ultima analisi del gesto; l'andamento include il registratore dei tempi" />
        <Kpis items={[["Allungo", lastDrawS != null ? `${f2(lastDrawS)} s` : drawS.length ? `${f2(drawS[drawS.length - 1])} s` : "—"], ["Costanza", drawS.length > 1 ? `±${f2(sd(drawS))} s` : "—"], ["Tenuta", lastHold != null ? `${f1(lastHold)} s` : hold.length ? `${f1(hold[hold.length - 1])} s` : "—"]]} />
        <MiniLine values={drawS} color="#8a5bd1" unit=" s" />
        <div className="flex flex-wrap gap-2 text-xs">
          <Link to="/tempi" className="aa-chip"><Glyph name="stopwatch" size={13} /> Registra i tempi</Link>
        </div>
      </Card>

      <Card className="grid gap-2">
        <Head icon="posture" title="Postura" sub={lastPost ? `Ultima analisi ${Math.round(lastPost.total)}/100 · ${postures.length} ${postures.length === 1 ? "analisi" : "analisi"} con le zone del corpo` : "Punteggio su 100 per zone del corpo"} />
        <MiniLine values={totals} color="#3d8f5f" band={[75, 100]} />
        {areas.length ? (
          <ul className="grid gap-1.5">
            {areas.map(({ k, a, b }) => (
              <li key={k} className="grid gap-0.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{AREA_LABEL[k]}</span>
                  <span className={`text-xs tabular-nums ${b - a >= 0 ? "text-[#7cf0a8]" : "text-[#f2a65a]"}`}>{Math.round(b)} ({b - a >= 0 ? "+" : ""}{Math.round(b - a)})</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div className="aa-grow h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, b))}%`, background: b >= 75 ? "#3d8f5f" : b >= 55 ? "#e0b15a" : "#e07a72" }} />
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-muted">Fai un'analisi pro del gesto per vedere le zone del corpo.</p>}
        <Link to="/allenamento" search={{ avvia: "gesto" }} className="aa-chip justify-self-start"><Glyph name="posture" size={13} /> Analizza il gesto</Link>
      </Card>

      <Card className="grid gap-2">
        <Head icon="lungs" title="Respiro e mira ferma" sub="Tremolio e scivolamento dall'ultima analisi; respiri guidati dei 14 giorni" />
        <Kpis items={[["Tremolio", lastJitter != null ? f2(lastJitter) : "—"], ["Scivolamento", lastCreep != null ? f2(lastCreep) : "—"], ["Respiri", breathDays ? `${breathTotal} · ${breathDays} gg` : "0"]]} />
        <div className="flex h-20 items-end gap-1">
          {days.map((d) => (
            <div key={d.key} className="grid flex-1 justify-items-center gap-0.5">
              <div className="aa-grow-y w-full rounded-t-md" style={{ height: `${Math.max(3, (d.n / maxDay) * 60)}px`, background: d.n ? "#5aa6e8" : "rgba(255,255,255,0.08)" }} />
              <span className="text-[0.55rem] text-muted">{d.label}</span>
            </div>
          ))}
        </div>
        <MiniLine values={jitter} color="#e0b15a" invert />
        <p className="text-[0.68rem] text-muted">Tremolio: quanto si muove la mano dell'arco durante la mira. Scivolamento: quanto la mano della corda cede in ancoraggio. Più bassi è meglio.</p>
        <Link to="/respiro" className="aa-chip justify-self-start"><Glyph name="breath" size={13} /> Respiro guidato</Link>
      </Card>
    </>
  );
}
