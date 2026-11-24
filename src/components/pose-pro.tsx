import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { type Gear, type Hand, type Landmark, type Sample, type Shot, sides } from "@/lib/arcieri/pose-analysis";
import { AREA_LABEL, type Area, type ProMetrics, type ProSetup, anchorTarget, bowLengthFor, evaluate, gearSizes, proMedian, proMetrics, proSteadiness } from "@/lib/arcieri/pose-pro";
import { listGestures } from "@/lib/arcieri/gesture.api";
import { useLocalState } from "@/lib/arcieri/local-store";
import { BOW_TYPES } from "./gear-icons";
import { Glyph } from "./icons";
import { AREA_MUSCLES, renderAreaImages } from "@/lib/arcieri/muscle-areas";

export type ProSave = { total: number; areas: Record<string, number | null>; issues: string[]; m: Partial<ProMetrics>; setup: ProSetup; at: number | null };

const PRO_DEFAULT: ProSetup = { bowType: "olimpico", arrowIn: 29, heightCm: 0 };

/**
 * Pannello dell'analisi pro: impostazioni (arco, freccia, altezza), punteggio per zona del corpo,
 * radar, barre con la fascia ideale, andamento nel video, cose da migliorare con consigli,
 * storico delle analisi salvate e salvataggio del fotogramma nel calendario.
 */
export function ProPanel({
  lm,
  samples,
  shot,
  hand,
  aspect,
  onSave,
  saveState,
  gear = null,
}: {
  gear?: Gear | null;
  lm: Landmark[] | null;
  samples: Sample[];
  shot: Shot | null;
  hand: Hand;
  aspect: number;
  onSave: (p: ProSave) => void;
  saveState: string;
}) {
  const [setup, setSetup] = useLocalState<ProSetup>("aa-pose-pro-setup", PRO_DEFAULT);
  const [showAll, setShowAll] = useState(false);

  // fotogrammi dell'ancoraggio (se c'è un tiro trovato nel video), altrimenti il fotogramma attuale
  const frames = useMemo(() => {
    if (shot && samples.length) {
      const list = samples.filter((s) => s.lm && s.t >= shot.anchorFrom && s.t <= (shot.release ?? shot.anchorTo));
      return list.map((s) => proMetrics(s.lm!, hand, aspect, setup)).filter((m): m is ProMetrics => Boolean(m));
    }
    const one = lm ? proMetrics(lm, hand, aspect, setup) : null;
    return one ? [one] : [];
  }, [shot, samples, lm, hand, aspect, setup]);
  const m = useMemo(() => proMedian(frames), [frames]);
  const lastFrame = useMemo(() => (shot && samples.length ? samples.filter((x) => x.lm && x.t >= shot.anchorFrom && x.t <= (shot.release ?? shot.anchorTo)).pop()?.lm ?? null : null), [shot, samples]);
  const steady = useMemo(() => (frames.length >= 3 ? proSteadiness(frames) : null), [frames]);
  const ev = useMemo(() => (m ? evaluate(m, setup, steady) : null), [m, setup, steady]);

  // andamento lungo tutto il video
  const series = useMemo(() => {
    if (samples.length < 6) return null;
    const pts = samples
      .filter((s) => s.lm)
      .map((s) => ({ t: s.t, m: proMetrics(s.lm!, hand, aspect, setup) }))
      .filter((p): p is { t: number; m: ProMetrics } => Boolean(p.m));
    return pts.length >= 6 ? pts : null;
  }, [samples, hand, aspect, setup]);

  if (!m || !ev) {
    return (
      <section className="aa-pro grid gap-2 rounded-[var(--radius-card)] p-3.5">
        <ProHead score={null} frames={0} />
        <p className="text-sm text-muted">Carica un video o una foto in cui si vedano bene testa, braccia e mani. Con il video premi «Analizza»: l'analisi pro usa tutta la fase di ancoraggio.</p>
        <SetupRow setup={setup} setSetup={setSetup} />
      </section>
    );
  }

  const at = anchorTarget(setup.bowType);
  const issues = showAll ? ev.issues : ev.issues.slice(0, 3);
  return (
    <section className="aa-pro grid gap-3 rounded-[var(--radius-card)] p-3.5">
      <ProHead score={ev.total} frames={frames.length} />
      <SetupRow setup={setup} setSetup={setSetup} />

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <Radar areas={ev.areas} />
        <div className="grid content-start gap-1.5">
          {ev.areas.filter((a) => a.score != null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).map((a, i) => (
            <div key={a.id} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2 text-xs">
              <span className="truncate text-muted">{a.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <span className="aa-grow block h-full rounded-full" style={{ width: `${a.score}%`, background: tone(a.score ?? 0), animationDelay: `${i * 60}ms` }} />
              </span>
              <b className="text-right tabular-nums">{a.score}</b>
            </div>
          ))}
        </div>
      </div>

      <MuscleAreas lm={lastFrame ?? lm} hand={hand} aspect={aspect} areas={ev.areas} />

      {ev.issues.length ? (
        <div className="grid gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold"><Glyph name="target" size={22} className="aa-tone-hi shrink-0" />Da migliorare, in ordine</p>
          {issues.map((it, i) => (
            <div key={it.title} className="aa-issue grid gap-1 rounded-2xl p-3" style={{ animationDelay: `${i * 80}ms` }}>
              <p className="flex items-start gap-2 font-semibold">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-400 text-[0.65rem] font-black text-black">{i + 1}</span>
                {it.title}
              </p>
              <p className="text-xs text-muted">{it.why}</p>
              <p className="text-sm"><b className="text-emerald-300">Consiglio:</b> {it.fix}</p>
              {it.drill ? (
                <Link to={it.drill.to as "/"} className="aa-chip justify-self-start"><Glyph name="bolt" size={13} /> Esercizio: {it.drill.label}</Link>
              ) : null}
            </div>
          ))}
          {ev.issues.length > 3 ? (
            <button type="button" className="justify-self-start text-xs font-semibold text-muted" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Mostra solo le prime 3" : `Altre ${ev.issues.length - 3} cose da sistemare`}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl bg-emerald-500/15 p-3 text-sm text-emerald-100">Nessun difetto evidente in questo tiro. Ora conta ripeterlo uguale: guarda la stabilità qui sotto.</p>
      )}

      <div className="grid gap-2">
        <p className="text-sm font-semibold">Ogni misura, con la sua fascia ideale</p>
        {ev.gauges.map((g, i) => <GaugeRow key={g.label} g={g} score={ev.scoreOf(g)} i={i} />)}
        <p className="text-[0.68rem] text-muted">"sp" = larghezze di spalle. Fascia verde = zona consigliata. L'ancoraggio atteso per l'arco {setup.bowType}: {at.text}.</p>
      </div>

      {steady ? (
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {([["Testa", steady.head], ["Gomito", steady.elbow], ["Braccio", steady.bowArm], ["Polso", steady.bowWrist]] as const).map(([k, v]) => (
            <span key={k} className="rounded-xl bg-white/[0.05] px-1 py-1.5">
              <span className="block text-[0.6rem] uppercase tracking-wider text-muted">{k}</span>
              <b className={`font-display text-lg tabular-nums ${v == null ? "" : v < 1.5 ? "text-emerald-300" : v < 3 ? "text-amber-300" : "text-rose-300"}`}>{v == null ? "—" : `±${v.toFixed(1)}°`}</b>
            </span>
          ))}
        </div>
      ) : null}

      {series ? <Trend series={series} shot={shot} /> : null}

      <DrawLength m={m} setup={setup} gear={gear} aspect={aspect} />

      <History />

      <div className="grid gap-1.5 rounded-2xl bg-white/[0.05] p-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><Glyph name="calendar" size={24} className="aa-tone-hi shrink-0" />Salva nel calendario della postura</p>
        <p className="text-xs text-muted">Salvo il fotogramma {shot ? "a metà ancoraggio" : "attuale"} con i punti pro e il riassunto: lo ritrovi nel Calendario, nel giorno di oggi, e nel Profilo.</p>
        <button
          type="button"
          disabled={saveState === "busy"}
          onClick={() =>
            onSave({
              total: ev.total,
              areas: Object.fromEntries(ev.areas.map((a) => [a.id, a.score])),
              issues: ev.issues.slice(0, 5).map((x) => x.title),
              m: {
                headTilt: m.headTilt, headTurn: m.headTurn, shrug: m.shrug, bowArm: m.bowArm, bowWrist: m.bowWrist, drawWrist: m.drawWrist,
                elbowLine: m.elbowLine, anchorV: m.anchorV, trunk: m.trunk, stance: m.stance, drawLenCm: m.drawLenCm,
              },
              setup,
              at: shot ? (shot.anchorFrom + (shot.release ?? shot.anchorTo)) / 2 : null,
            })
          }
          className="aa-press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-fg disabled:opacity-60"
        >
          <Glyph name="save" size={18} /> {saveState === "busy" ? "Salvo…" : "Salva fotogramma e analisi"}
        </button>
        {saveState === "ok" ? <p className="text-xs text-emerald-300">Salvato. Aprilo dal Calendario.</p> : saveState && saveState !== "busy" ? <p className="text-xs text-danger">{saveState}</p> : null}
      </div>
    </section>
  );
}

const tone = (v: number) => (v >= 80 ? "#2fbf71" : v >= 60 ? "#e3a21a" : "#e5484d");

function ProHead({ score, frames }: { score: number | null; frames: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (score == null) return;
    let raf = 0;
    const t0 = performance.now();
    const from = shown;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      setShown(Math.round(from + (score - from) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);
  const C = 2 * Math.PI * 30;
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-20 w-20 shrink-0 place-items-center">
        <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90">
          <circle cx="36" cy="36" r="30" fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth="6" />
          <circle cx="36" cy="36" r="30" fill="none" stroke={tone(shown)} strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - shown / 100)} />
        </svg>
        <span className="font-display text-3xl tabular-nums">{score == null ? "—" : shown}</span>
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-amber-300"><Glyph name="archer" size={18} className="aa-tone-hi shrink-0" />Analisi pro</p>
        <p className="font-display text-2xl leading-tight">Postura e gesto</p>
        <p className="text-xs text-muted">{frames > 1 ? `Media su ${frames} fotogrammi dell'ancoraggio` : frames === 1 ? "Su questo fotogramma" : "In attesa del corpo"} · 33 punti del corpo</p>
      </div>
    </div>
  );
}

function SetupRow({ setup, setSetup }: { setup: ProSetup; setSetup: (s: ProSetup) => void }) {
  return (
    <div className="grid gap-2">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {BOW_TYPES.map((b) => (
          <button key={b.id} type="button" aria-pressed={setup.bowType === b.id} className="aa-chip shrink-0" onClick={() => setSetup({ ...setup, bowType: b.id })}>{b.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Lunghezza freccia" unit="pollici" value={setup.arrowIn} onChange={(arrowIn) => setSetup({ ...setup, arrowIn })} />
        <NumField label="Tua altezza" unit="cm" value={setup.heightCm} onChange={(heightCm) => setSetup({ ...setup, heightCm })} hint="per l'allungo" />
      </div>
    </div>
  );
}

function NumField({ label, unit, value, onChange, hint }: { label: string; unit: string; value: number; onChange: (n: number) => void; hint?: string }) {
  const [text, setText] = useState(value ? String(value).replace(".", ",") : "");
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted">{label}{hint ? <span className="opacity-70"> · {hint}</span> : null}</span>
      <span className="flex items-center gap-1 rounded-xl border border-hair bg-black/20 px-3">
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value.replace(",", "."));
            onChange(Number.isFinite(n) ? n : 0);
          }}
          className="min-h-10 w-full min-w-0 bg-transparent text-sm tabular-nums outline-none"
        />
        <span className="text-xs text-muted">{unit}</span>
      </span>
    </label>
  );
}

/** Radar delle zone del corpo: poligono animato, zone non misurate in grigio. */
function Radar({ areas }: { areas: Area[] }) {
  const list = areas.filter((a) => a.id !== "attrezzatura");
  const n = list.length;
  const R = 74;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r];
  };
  const poly = list.map((a, i) => pt(i, ((a.score ?? 0) / 100) * R).join(",")).join(" ");
  return (
    <svg viewBox="-24 -6 248 212" className="mx-auto w-full max-w-[280px]">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={list.map((_, i) => pt(i, R * k).join(",")).join(" ")} fill="none" stroke="currentColor" strokeOpacity={k === 1 ? 0.18 : 0.08} />
      ))}
      {list.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1="100" y1="100" x2={x} y2={y} stroke="currentColor" strokeOpacity={0.08} />;
      })}
      <polygon points={poly} fill="rgb(124 240 168 / 0.22)" stroke="#7cf0a8" strokeWidth="2" strokeLinejoin="round" className="aa-radar" />
      {list.map((a, i) => {
        const [x, y] = pt(i, ((a.score ?? 0) / 100) * R);
        const [lx, ly] = pt(i, R + 16);
        return (
          <g key={a.id}>
            {a.score != null ? <circle cx={x} cy={y} r="3" fill={tone(a.score)} /> : null}
            <text x={lx} y={ly + 3} textAnchor="middle" fontSize="8.5" fill="currentColor" fillOpacity={a.score == null ? 0.35 : 0.75}>{AREA_LABEL[a.id].split(" ")[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function GaugeRow({ g, score, i }: { g: ReturnType<typeof evaluate>["gauges"][number]; score: number | null; i: number }) {
  const span = g.max - g.min || 1;
  const X = (v: number) => Math.min(100, Math.max(0, ((v - g.min) / span) * 100));
  const v = g.value;
  return (
    <div className="grid gap-1" style={{ opacity: v == null ? 0.45 : 1 }}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate">{g.label}</span>
        <b className="tabular-nums" style={{ color: score == null ? undefined : tone(score) }}>{v == null ? "non si vede" : `${v.toFixed(g.digits ?? 0).replace(".", ",")}${g.unit}`}</b>
      </div>
      <div className="relative h-2.5 rounded-full bg-white/[0.06]">
        <span className="absolute inset-y-0 rounded-full bg-emerald-400/30" style={{ left: `${X(g.lo)}%`, width: `${Math.max(2, X(g.hi) - X(g.lo))}%` }} />
        {v != null ? <span className="aa-gauge-dot absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${X(v)}%`, background: tone(score ?? 0), animationDelay: `${i * 40}ms` }} /> : null}
      </div>
    </div>
  );
}

/** Andamento di tre misure nel video, con la fase di ancoraggio evidenziata. */
function Trend({ series, shot }: { series: { t: number; m: ProMetrics }[]; shot: Shot | null }) {
  const [k, setK] = useState<"gomito" | "testa" | "polso">("gomito");
  const W = 320;
  const H = 120;
  const t0 = series[0].t;
  const t1 = series[series.length - 1].t || t0 + 1;
  const val = (m: ProMetrics) => (k === "gomito" ? 180 - m.elbowLine : k === "testa" ? Math.abs(m.headTilt ?? NaN) : (m.bowWrist ?? NaN));
  const vals = series.map((p) => val(p.m)).filter(Number.isFinite);
  const max = Math.max(10, ...vals);
  const X = (t: number) => 8 + ((t - t0) / (t1 - t0 || 1)) * (W - 16);
  const Y = (v: number) => H - 14 - (v / max) * (H - 24);
  let d = "";
  series.forEach((p) => {
    const v = val(p.m);
    if (!Number.isFinite(v)) return;
    d += `${d ? "L" : "M"}${X(p.t).toFixed(1)} ${Y(v).toFixed(1)} `;
  });
  const limit = k === "gomito" ? 12 : k === "testa" ? 5 : 18;
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Durante il tiro</p>
        <div className="flex gap-1">
          {([["gomito", "Gomito"], ["testa", "Testa"], ["polso", "Polso"]] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={k === id} className="aa-chip !min-h-8 !px-2.5 text-xs" onClick={() => setK(id)}>{label}</button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-black/20">
        {shot ? <rect x={X(shot.anchorFrom)} y="0" width={Math.max(2, X(shot.release ?? shot.anchorTo) - X(shot.anchorFrom))} height={H} fill="#e6b325" opacity="0.14" /> : null}
        <line x1="8" x2={W - 8} y1={Y(limit)} y2={Y(limit)} stroke="#e5484d" strokeDasharray="4 4" strokeOpacity="0.6" />
        <text x={W - 10} y={Y(limit) - 3} textAnchor="end" fontSize="8" fill="#e5484d" fillOpacity="0.8">limite {limit}°</text>
        <path key={k} d={d} fill="none" stroke="#7cf0a8" strokeWidth="2" strokeLinejoin="round" pathLength={100} className="aa-draw" />
        {shot ? <text x={X(shot.anchorFrom) + 3} y="11" fontSize="8" fill="#e6b325">ancoraggio</text> : null}
      </svg>
      <p className="text-[0.68rem] text-muted">{k === "gomito" ? "Quanti gradi il gomito della corda esce dalla linea della freccia." : k === "testa" ? "Inclinazione della testa: deve restare piatta e sotto il limite." : "Piega del polso dell'arco: più bassa è, meno torci l'arco."}</p>
    </div>
  );
}

function DrawLength({ m, setup, gear, aspect }: { m: ProMetrics; setup: ProSetup; gear: Gear | null; aspect: number }) {
  if (!setup.heightCm) {
    return <p className="rounded-2xl bg-white/[0.05] p-3 text-xs text-muted">Scrivi la tua altezza qui sopra: stimo l'allungo dal video e lo confronto con la lunghezza della freccia.</p>;
  }
  if (m.drawLenCm == null) return <p className="rounded-2xl bg-white/[0.05] p-3 text-xs text-muted">Per stimare l'allungo servono mani e spalle ben visibili all'ancoraggio.</p>;
  const inch = m.drawLenCm / 2.54;
  const arrowCm = setup.arrowIn * 2.54;
  const room = arrowCm ? arrowCm - m.drawLenCm : null;
  return (
    <div className="grid gap-2 rounded-2xl bg-white/[0.05] p-3">
      <p className="flex items-center gap-2 text-sm font-semibold"><Glyph name="span" size={24} className="aa-tone-hi shrink-0" />Allungo e freccia</p>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <span className="rounded-xl bg-black/20 px-1 py-1.5"><span className="block text-[0.6rem] uppercase tracking-wider text-muted">Allungo</span><b className="font-display text-lg tabular-nums">{inch.toFixed(1).replace(".", ",")}″</b></span>
        <span className="rounded-xl bg-black/20 px-1 py-1.5"><span className="block text-[0.6rem] uppercase tracking-wider text-muted">Margine</span><b className={`font-display text-lg tabular-nums ${room == null ? "" : room < 0 ? "text-rose-300" : room > 9 ? "text-amber-300" : "text-emerald-300"}`}>{room == null ? "—" : `${room > 0 ? "+" : ""}${room.toFixed(0)} cm`}</b></span>
        <span className="rounded-xl bg-black/20 px-1 py-1.5"><span className="block text-[0.6rem] uppercase tracking-wider text-muted">Arco</span><b className="font-display text-lg">{setup.bowType === "compound" ? "—" : bowLengthFor(inch)}</b></span>
      </div>
      <GearSizes m={m} setup={setup} gear={gear} aspect={aspect} drawIn={inch} />
      <p className="text-[0.68rem] text-muted">Stima ±3 cm, misurata {m.scaleFrom === "piedi" ? "dalla tua altezza (piedi visibili)" : "dalla larghezza delle spalle (meno precisa: inquadra anche i piedi)"}. L'allungo vero si misura con una freccia graduata.</p>
    </div>
  );
}

type ProRow = { at: string; total: number };

/** Punteggio pro delle analisi salvate, nel tempo. */
function History() {
  const [rows, setRows] = useState<ProRow[] | null>(null);
  useEffect(() => {
    let live = true;
    listGestures()
      .then((list) => {
        if (!live) return;
        const out: ProRow[] = [];
        for (const g of list) {
          try {
            const d = JSON.parse(g.data || "{}") as { pro?: { total?: number } };
            if (typeof d.pro?.total === "number") out.push({ at: g.createdAt, total: d.pro.total });
          } catch {
            /* dati vecchi */
          }
        }
        setRows(out.reverse().slice(-12));
      })
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, []);
  if (!rows || rows.length < 2) return null;
  const W = 300;
  const H = 70;
  const X = (i: number) => 10 + (i / (rows.length - 1)) * (W - 20);
  const Y = (v: number) => H - 10 - (v / 100) * (H - 20);
  const d = rows.map((r, i) => `${i ? "L" : "M"}${X(i)} ${Y(r.total)}`).join(" ");
  const delta = rows[rows.length - 1].total - rows[rows.length - 2].total;
  return (
    <div className="grid gap-1.5 rounded-2xl bg-white/[0.05] p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">I tuoi progressi</p>
        <span className={`text-xs font-semibold ${delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{delta >= 0 ? "+" : ""}{delta} dall'ultima</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <path d={`${d} L${X(rows.length - 1)} ${H - 10} L${X(0)} ${H - 10} Z`} fill="rgb(124 240 168 / 0.12)" />
        <path d={d} fill="none" stroke="#7cf0a8" strokeWidth="2" pathLength={100} className="aa-draw" />
        {rows.map((r, i) => <circle key={i} cx={X(i)} cy={Y(r.total)} r="2.6" fill="#7cf0a8" />)}
      </svg>
    </div>
  );
}

/* ---------- disegno dei punti pro sopra al video ---------- */

const HEAD = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const HAND_LINKS: [number, number][] = [[15, 17], [15, 19], [15, 21], [17, 19], [16, 18], [16, 20], [16, 22], [18, 20]];

/** Testa (occhi, orecchie, naso, bocca), mani (indice, mignolo, pollice), linee guida e angoli dei polsi. */
export function drawPro(ctx: CanvasRenderingContext2D, w: number, h: number, lm: Landmark[], hand: Hand) {
  if (lm.length < 33) return;
  const s = Math.max(0.6, Math.min(w, h) / 520);
  const at = (i: number) => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 });
  const seen = (i: number) => at(i).v > 0.35;
  ctx.save();
  ctx.lineCap = "round";
  // viso: linea degli occhi, delle orecchie, asse naso-bocca
  const line = (a: number, b: number, color: string, wd = 1.3) => {
    if (!seen(a) || !seen(b)) return;
    const p = at(a);
    const q = at(b);
    ctx.strokeStyle = color;
    ctx.lineWidth = wd * s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  };
  line(3, 6, "rgba(103,232,249,0.9)");
  line(7, 8, "rgba(103,232,249,0.55)");
  line(9, 10, "rgba(244,114,182,0.9)");
  if (seen(0) && seen(9) && seen(10)) {
    const n = at(0);
    const mx = (at(9).x + at(10).x) / 2;
    const my = (at(9).y + at(10).y) / 2;
    const chinY = my + Math.max(4, my - n.y) * 1.15;
    ctx.setLineDash([3 * s, 3 * s]);
    ctx.strokeStyle = "rgba(103,232,249,0.7)";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(n.x, n.y - 30 * s);
    ctx.lineTo(mx + (mx - n.x) * 0.6, chinY);
    ctx.stroke();
    // linea del mento: riferimento d'ancoraggio
    ctx.strokeStyle = "rgba(230,179,37,0.85)";
    ctx.beginPath();
    ctx.moveTo(mx - 40 * s, chinY);
    ctx.lineTo(mx + 40 * s, chinY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const i of HEAD) {
    if (!seen(i)) continue;
    const p = at(i);
    ctx.fillStyle = i === 0 ? "#fde68a" : i >= 9 ? "#f472b6" : "#67e8f9";
    ctx.beginPath();
    ctx.arc(p.x, p.y, (i === 0 ? 2.8 : 2.1) * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // mani
  for (const [a, b] of HAND_LINKS) line(a, b, "rgba(244,114,182,0.85)", 1.4);
  for (const i of [17, 18, 19, 20, 21, 22]) {
    if (!seen(i)) continue;
    const p = at(i);
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // angolo dei polsi: arco tra avambraccio e indice
  const { bow, draw } = sides(hand);
  const wristArc = (e: number, wr: number, idx: number, color: string) => {
    if (!seen(e) || !seen(wr) || !seen(idx)) return;
    const E = at(e);
    const W = at(wr);
    const I = at(idx);
    const a1 = Math.atan2(W.y - E.y, W.x - E.x);
    const a2 = Math.atan2(I.y - W.y, I.x - W.x);
    let da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(W.x, W.y, 11 * s, a1, a1 + da, da < 0);
    ctx.stroke();
    // prolungamento dell'avambraccio
    ctx.setLineDash([2 * s, 3 * s]);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(W.x, W.y);
    ctx.lineTo(W.x + Math.cos(a1) * 26 * s, W.y + Math.sin(a1) * 26 * s);
    ctx.stroke();
    ctx.setLineDash([]);
    const dev = Math.abs((da * 180) / Math.PI);
    const text = `polso ${dev.toFixed(0)}°`;
    ctx.font = `600 ${Math.round(11 * s)}px system-ui, sans-serif`;
    const tw = ctx.measureText(text).width;
    const x = Math.min(w - tw - 8 * s, Math.max(4 * s, W.x - tw / 2));
    const y = W.y - 16 * s;
    ctx.fillStyle = "rgba(20,24,28,0.75)";
    ctx.fillRect(x - 4 * s, y - 11 * s, tw + 8 * s, 15 * s);
    ctx.fillStyle = dev > 22 ? "#fde68a" : "#b9ffd9";
    ctx.fillText(text, x, y);
  };
  wristArc(bow[1], bow[2], hand === "destro" ? 19 : 20, "#f472b6");
  wristArc(draw[1], draw[2], hand === "destro" ? 20 : 19, "#c084fc");
  // inclinazione della testa
  if (seen(2) && seen(5)) {
    const a = at(2);
    const b = at(5);
    const tilt = Math.abs((Math.atan2(b.y - a.y, Math.abs(a.x - b.x) || 1) * 180) / Math.PI);
    const text = `testa ${tilt.toFixed(0)}°`;
    ctx.font = `600 ${Math.round(11 * s)}px system-ui, sans-serif`;
    const tw = ctx.measureText(text).width;
    const x = Math.min(w - tw - 8 * s, Math.max(4 * s, (a.x + b.x) / 2 - tw / 2));
    const y = Math.max(14 * s, Math.min(a.y, b.y) - 26 * s);
    ctx.fillStyle = "rgba(20,24,28,0.75)";
    ctx.fillRect(x - 4 * s, y - 11 * s, tw + 8 * s, 15 * s);
    ctx.fillStyle = tilt > 6 ? "#fde68a" : "#b9ffd9";
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

/** Freccia, arco e corda riconosciuti nell'immagine e misurati con la scala della persona. */
function GearSizes({ m, setup, gear, aspect, drawIn }: { m: ProMetrics; setup: ProSetup; gear: Gear | null; aspect: number; drawIn: number }) {
  const g = gearSizes(gear, aspect, m.cmPerUnit, setup.bowType);
  const inch = (cm: number) => `${(cm / 2.54).toFixed(1).replace(".", ",")}″`;
  const cell = (k: string, v: string, hint: string, tone = "") => (
    <span className="rounded-xl bg-black/20 px-1.5 py-1.5">
      <span className="block text-[0.6rem] uppercase tracking-wider text-muted">{k}</span>
      <b className={`font-display text-lg tabular-nums ${tone}`}>{v}</b>
      <span className="block text-[0.6rem] text-muted">{hint}</span>
    </span>
  );
  if (!gear || (!gear.arrow && !gear.bow)) {
    return <p className="text-[0.68rem] text-muted">Freccia e arco non si vedono abbastanza: inquadra di lato, su uno sfondo uniforme, con tutto l'arco dentro l'immagine.</p>;
  }
  if (!g || (g.arrowCm == null && g.chordCm == null)) {
    return <p className="text-[0.68rem] text-muted">Ho visto {gear.arrow ? "la freccia" : ""}{gear.arrow && gear.bow ? " e " : ""}{gear.bow ? "l'arco" : ""}, ma non le loro estremità: per misurarli serve l'immagine intera dell'arco, dalla punta alta a quella bassa, e la punta della freccia visibile.</p>;
  }
  const arrowIn = g.arrowCm != null ? g.arrowCm / 2.54 : null;
  const room = arrowIn != null ? arrowIn - drawIn : null;
  const declared = setup.arrowIn > 0 && arrowIn != null ? arrowIn - setup.arrowIn : null;
  return (
    <div className="grid gap-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold"><Glyph name="caliper" size={20} className="aa-tone-hi shrink-0" />Attrezzatura riconosciuta nell'immagine</p>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {cell("Freccia", g.arrowCm != null ? inch(g.arrowCm) : "—", g.arrowCm != null ? `${g.arrowCm.toFixed(0)} cm${room != null ? ` · ${room >= 0 ? "+" : ""}${room.toFixed(1).replace(".", ",")}″ sull'allungo` : ""}` : "punta non vista", room != null && (room < 0.5 || room > 3.5) ? "text-amber-300" : "")}
        {cell(g.compound ? "Asse-asse" : "Arco AMO", g.compound ? (g.chordCm != null ? inch(g.chordCm) : "—") : g.amoIn != null ? `${Math.round(g.amoIn)}″` : "—", g.chordCm != null ? `punte a ${g.chordCm.toFixed(0)} cm` : "punte non viste")}
        {cell("Corda", g.stringIn != null && !g.compound ? `${g.stringIn.toFixed(1).replace(".", ",")}″` : "—", g.compound ? "dal produttore" : g.amoIn != null ? `AMO − 3″ = ${Math.round(g.amoIn - 3)}″` : "")}
      </div>
      <p className="text-[0.68rem] text-muted">
        {room != null ? (room < 0.5 ? "Freccia corta per il tuo allungo: la punta rischia di finire dietro il bottone. " : room > 3.5 ? "Freccia lunga: pesa di più e cala prima, puoi accorciarla. " : "Lunghezza della freccia giusta per l'allungo. ") : ""}
        {declared != null && Math.abs(declared) > 1.2 ? `Nelle impostazioni hai scritto ${setup.arrowIn}″, l'immagine dice circa ${arrowIn?.toFixed(1).replace(".", ",")}″. ` : ""}
        {g.amoIn != null && setup.bowType !== "compound" ? `Per il tuo allungo l'arco consigliato è ${bowLengthFor(drawIn)}. ` : ""}
        Misure dall'immagine ±4 cm: valgono se arco e freccia sono di lato alla camera.
      </p>
    </div>
  );
}

/**
 * Zone del corpo con i muscoli che lavorano: per ognuna un'immagine 3D del corpo nella posa del video
 * con i muscoli interessati in giallo, il punteggio e cosa fa ogni muscolo nel tiro.
 */
function MuscleAreas({ lm, hand, aspect, areas }: { lm: Landmark[] | null; hand: Hand; aspect: number; areas: Area[] }) {
  const [imgs, setImgs] = useState<Record<string, string>>({});
  const list = areas.filter((a) => a.score != null && AREA_MUSCLES[a.id]).sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  const key = list.map((a) => a.id).join(",");
  useEffect(() => {
    if (!lm) return;
    // si ridisegna quando la posa si ferma (non a ogni fotogramma del video)
    const t = window.setTimeout(() => {
      try {
        setImgs(renderAreaImages(lm, aspect, hand, list.map((a) => a.id)));
      } catch {
        /* niente WebGL: restano i nomi dei muscoli */
      }
    }, 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lm, aspect, hand, key]);
  if (!list.length) return null;
  return (
    <div className="grid gap-2">
      <p className="flex items-center gap-2 text-sm font-semibold"><Glyph name="posture" size={22} className="aa-tone-hi shrink-0" />Zone del corpo e muscoli che lavorano</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((a) => {
          const info = AREA_MUSCLES[a.id]!;
          return (
            <div key={a.id} className="grid overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03]">
              {imgs[a.id] ? <img src={imgs[a.id]} alt={`Muscoli di ${a.label}`} className="aspect-[640/520] w-full object-cover" /> : <div className="aspect-[640/520] w-full animate-pulse bg-[#0a2335]" />}
              <div className="grid gap-1.5 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <b className="text-sm">{a.label}</b>
                  <b className="tabular-nums" style={{ color: tone(a.score ?? 0) }}>{a.score}</b>
                </div>
                <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><span className="block h-full rounded-full" style={{ width: `${a.score}%`, background: tone(a.score ?? 0) }} /></span>
                <ul className="grid gap-1">
                  {info.muscles.map((mu) => (
                    <li key={mu.name} className="text-xs leading-snug"><b className="text-[#f6d57a]">{mu.name}</b> <span className="text-muted">· {mu.role}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[0.68rem] text-muted">In giallo i muscoli della zona, sul tuo corpo nella posa del video. I punteggi più bassi sono in alto.</p>
    </div>
  );
}
