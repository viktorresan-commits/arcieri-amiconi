import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { listGestures, type GestureRow } from "@/lib/arcieri/gesture.api";
import { Card } from "./kit";
import { Glyph } from "./icons";

type Pro = { total?: number; areas?: Record<string, number | null>; m?: { drawLenCm?: number | null } };

const AREA_LABEL: Record<string, string> = { testa: "Testa", spalle: "Spalle", braccioArco: "Braccio arco", polsoArco: "Polso arco", gomito: "Gomito corda", polsoCorda: "Polso corda", ancoraggio: "Ancoraggio", busto: "Busto", gambe: "Gambe", attrezzatura: "Allungo" };
const f1 = (v: number) => v.toFixed(1).replace(".", ",");
const f2 = (v: number) => v.toFixed(2).replace(".", ",");
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
};

function proOf(g: GestureRow): Pro | null {
  try {
    return (JSON.parse(g.data || "{}") as { pro?: Pro }).pro ?? null;
  } catch {
    return null;
  }
}

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

  const g = useMemo(() => [...(rows ?? [])].reverse(), [rows]);
  const pros = g.map((r) => ({ r, p: proOf(r) })).filter((x) => x.p && typeof x.p.total === "number") as { r: GestureRow; p: Pro }[];
  const drawLen = pros.map((x) => x.p.m?.drawLenCm).filter((v): v is number => typeof v === "number" && v > 40 && v < 95);
  const drawS = [...g.map((r) => r.drawS).filter((v): v is number => v != null && v > 0.3 && v < 8), ...laps.map((l) => l.s)].slice(-40);
  const hold = g.map((r) => r.anchorS).filter((v): v is number => v != null && v > 0.2 && v < 15);
  const jitter = g.map((r) => r.jitter).filter((v): v is number => v != null && v >= 0);
  const totals = pros.map((x) => x.p.total as number);

  // zone del corpo: prima e ultima analisi pro
  const firstAreas = pros[0]?.p.areas ?? {};
  const lastAreas = pros[pros.length - 1]?.p.areas ?? {};
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
      {tips.length ? (
        <Card className="grid gap-1.5">
          <Head icon="sparkle" title="In breve" />
          <ul className="grid gap-1">
            {tips.map((t) => <li key={t} className="rounded-xl bg-white/[0.04] px-2.5 py-1.5 text-sm">{t}</li>)}
          </ul>
        </Card>
      ) : null}

      <Card className="grid gap-2">
        <Head icon="span" title="Allungo" sub="Misurato nelle analisi del gesto (serve la tua altezza)" />
        <Kpis items={[["Ultimo", drawLen.length ? `${f1(drawLen[drawLen.length - 1])} cm` : "—"], ["Medio", drawLen.length ? `${f1(mean(drawLen))} cm` : "—"], ["Variazione", drawLen.length > 1 ? `±${f1(sd(drawLen))}` : "—"]]} />
        <MiniLine values={drawLen} color="#5aa6e8" unit=" cm" />
      </Card>

      <Card className="grid gap-2">
        <Head icon="stopwatch" title="Tempo di allungo e tenuta" sub="Dal registratore dei tempi e dai video analizzati" />
        <Kpis items={[["Allungo", drawS.length ? `${f2(mean(drawS))} s` : "—"], ["Costanza", drawS.length > 1 ? `±${f2(sd(drawS))} s` : "—"], ["Tenuta", hold.length ? `${f1(mean(hold))} s` : "—"]]} />
        <MiniLine values={drawS} color="#8a5bd1" unit=" s" />
        <div className="flex flex-wrap gap-2 text-xs">
          <Link to="/tempi" className="aa-chip"><Glyph name="stopwatch" size={13} /> Registra i tempi</Link>
        </div>
      </Card>

      <Card className="grid gap-2">
        <Head icon="posture" title="Postura" sub={`${pros.length} analisi pro · punteggio su 100`} />
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
        <Head icon="lungs" title="Respiro e mira ferma" sub="Respiri guidati e tremolio della mira nelle analisi" />
        <Kpis items={[["Respiri", String(breathTotal)], ["Giorni", String(breathDays)], ["Tremolio", jitter.length ? f2(jitter[jitter.length - 1]) : "—"]]} />
        <div className="flex h-20 items-end gap-1">
          {days.map((d) => (
            <div key={d.key} className="grid flex-1 justify-items-center gap-0.5">
              <div className="aa-grow-y w-full rounded-t-md" style={{ height: `${Math.max(3, (d.n / maxDay) * 60)}px`, background: d.n ? "#5aa6e8" : "rgba(255,255,255,0.08)" }} />
              <span className="text-[0.55rem] text-muted">{d.label}</span>
            </div>
          ))}
        </div>
        <MiniLine values={jitter} color="#e0b15a" invert />
        <p className="text-[0.68rem] text-muted">Tremolio: quanto si muove la mano dell'arco durante la mira (più basso è meglio).</p>
        <Link to="/respiro" className="aa-chip justify-self-start"><Glyph name="breath" size={13} /> Respiro guidato</Link>
      </Card>
    </>
  );
}
