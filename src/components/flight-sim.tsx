import { useEffect, useMemo, useRef, useState } from "react";
import { angularSize, effectiveLb, goldOf, compensatedDistance, describeRound, eyePoint, launchSpeed, releasePoint, type Fletch, type FlightInput } from "@/lib/arcieri/flight";
import { Card, Field, Select } from "@/components/kit";

const ROUNDS = [
  { id: "18", name: "Indoor 18 m", distanceM: 18, faceCm: 40 },
  { id: "30", name: "30 m", distanceM: 30, faceCm: 80 },
  { id: "50", name: "50 m", distanceM: 50, faceCm: 80 },
  { id: "70", name: "70 m", distanceM: 70, faceCm: 122 },
  { id: "campo", name: "Campo 50 m", distanceM: 50, faceCm: 40 },
] as const;

const BOWS = [
  { id: "recurve", name: "Olimpico", eta: 0.78, k: 0.55, sighted: true, scatter: 1.8, speed: 0.01 },
  { id: "compound", name: "Compound", eta: 0.84, k: 0.7, sighted: true, scatter: 1.1, speed: 0.006 },
  { id: "barebow", name: "Nudo", eta: 0.74, k: 0.55, sighted: false, scatter: 3.2, speed: 0.014 },
  { id: "longbow", name: "Longbow", eta: 0.68, k: 0.48, sighted: false, scatter: 4.2, speed: 0.018 },
] as const;

const RELEASES = [
  { id: "dita", name: "Tre dita", gain: 1, eyeCm: 11 },
  { id: "sotto", name: "Tre sotto", gain: 0.92, eyeCm: 8 },
  { id: "sgancio", name: "Sgancio", gain: 0.75, eyeCm: 5 },
] as const;

const START: FlightInput = {
  drawLb: 36,
  drawCm: 71,
  braceCm: 22,
  eta: 0.78,
  k: 0.55,
  grains: 360,
  diameterMm: 4.2,
  lengthCm: 76,
  fletch: "feather3",
  distanceM: 18,
  heightCm: 175,
  eyeCm: 2,
  eyeBackCm: 8,
  wind: 0,
  sighted: true,
  faceCm: 40,
  zones: 10,
  slopeDeg: 0,
  goldM: 1.3,
  lbAt28: true,
};

const SAVE_KEY = "aa-flight-v1";

type Saved = {
  form: FlightInput;
  bow: (typeof BOWS)[number]["id"];
  release: (typeof RELEASES)[number]["id"];
  round: string;
  other: string;
  compare: boolean;
  n: number;
  consistency: number;
  seed: number;
};

function readSaved(): Saved | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null") as Partial<Saved> | null;
    if (!raw || typeof raw !== "object") return null;
    const form = { ...START } as FlightInput;
    const given = (raw.form ?? {}) as Partial<FlightInput>;
    for (const key of Object.keys(START) as (keyof FlightInput)[]) {
      const value = given[key];
      if (typeof START[key] === "number" && typeof value === "number" && Number.isFinite(value)) (form as Record<string, unknown>)[key] = value;
      if (typeof START[key] === "boolean" && typeof value === "boolean") (form as Record<string, unknown>)[key] = value;
    }
    if (given.fletch === "spin" || given.fletch === "vane3" || given.fletch === "feather3" || given.fletch === "feather4") form.fletch = given.fletch;
    form.zones = given.zones === 5 ? 5 : 10;
    const bow = BOWS.find((item) => item.id === raw.bow)?.id ?? "recurve";
    form.lbAt28 = bow !== "compound";
    const release = RELEASES.find((item) => item.id === raw.release)?.id ?? "dita";
    const round = typeof raw.round === "string" && (raw.round === "" || ROUNDS.some((item) => item.id === raw.round)) ? raw.round : "18";
    const other = typeof raw.other === "string" && ROUNDS.some((item) => item.id === raw.other) ? raw.other : "50";
    const n = raw.n === 3 || raw.n === 6 || raw.n === 12 ? raw.n : 6;
    const consistency = raw.consistency === 0.15 || raw.consistency === 0.4 || raw.consistency === 0.7 ? raw.consistency : 0.4;
    const seed = typeof raw.seed === "number" && Number.isFinite(raw.seed) ? raw.seed : 4;
    return { form, bow, release, round, other, compare: raw.compare !== false, n, consistency, seed };
  } catch {
    return null;
  }
}

export function FlightSim() {
  const [form, setForm] = useState(START);
  const [bow, setBow] = useState<(typeof BOWS)[number]["id"]>("recurve");
  const [release, setRelease] = useState<(typeof RELEASES)[number]["id"]>("dita");
  const [round, setRound] = useState("18");
  const [other, setOther] = useState("50");
  const [compare, setCompare] = useState(true);
  const [n, setN] = useState(6);
  const [consistency, setConsistency] = useState(0.4);
  const [seed, setSeed] = useState(4);
  const [ready, setReady] = useState(false);
  const [pathMode, setPathMode] = useState<"reale" | "linea">("reale");
  const [trueScale, setTrueScale] = useState(false);
  const [savedNote, setSavedNote] = useState("");
  const patch = (part: Partial<FlightInput>) => setForm((current) => ({ ...current, ...part }));

  // I dati balistici restano sul telefono: si ricaricano all'apertura e si salvano a ogni modifica.
  useEffect(() => {
    const saved = readSaved();
    if (saved) {
      setForm(saved.form);
      setBow(saved.bow);
      setRelease(saved.release);
      setRound(saved.round);
      setOther(saved.other);
      setCompare(saved.compare);
      setN(saved.n);
      setConsistency(saved.consistency);
      setSeed(saved.seed);
      setSavedNote("Ripresi i tuoi ultimi dati.");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, form, bow, release, round, other, compare, n, consistency, seed }));
    } catch {
      /* memoria piena o privata: si continua senza salvare */
    }
  }, [ready, form, bow, release, round, other, compare, n, consistency, seed]);

  function resetAll() {
    setForm(START);
    setBow("recurve");
    setRelease("dita");
    setRound("18");
    setOther("50");
    setCompare(true);
    setN(6);
    setConsistency(0.4);
    setSeed(4);
    setSavedNote("Valori iniziali ripristinati.");
  }

  const setup = useMemo(() => {
    const chosen = BOWS.find((item) => item.id === bow) ?? BOWS[0];
    const hand = RELEASES.find((item) => item.id === release) ?? RELEASES[0];
    return { scatter: chosen.scatter * hand.gain, speed: chosen.speed * hand.gain, sighted: chosen.sighted };
  }, [bow, release]);

  const primary = useMemo(
    () => describeRound({ ...form, sighted: setup.sighted }, n, setup.scatter, setup.speed, consistency, seed),
    [form, n, setup, consistency, seed],
  );
  const secondInput = useMemo(() => {
    const stage = ROUNDS.find((item) => item.id === other) ?? ROUNDS[2];
    return { ...form, sighted: setup.sighted, distanceM: stage.distanceM, faceCm: stage.faceCm };
  }, [form, other, setup.sighted]);
  const second = useMemo(
    () => (compare ? describeRound(secondInput, n, setup.scatter, setup.speed, consistency, seed + 7) : null),
    [compare, secondInput, n, setup, consistency, seed],
  );
  const speed = launchSpeed({ ...form, sighted: setup.sighted });
  const gpp = form.drawLb > 0 ? form.grains / form.drawLb : 0;
  const bad = form.braceCm >= form.drawCm || form.grains < 80 || form.drawLb < 10;

  return (
    <Card className="grid gap-3">
      <div>
        <h2 className="font-display text-2xl">Simulatore di volo</h2>
        <p className="text-sm text-muted">Dalla corda al bersaglio: velocità, parabola, vento e quanto vale un gruppo con questa attrezzatura.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full border border-line px-2 py-1">💾 {savedNote || "Ogni modifica resta salvata su questo telefono."}</span>
          <button type="button" onClick={resetAll} className="min-h-9 rounded-full border border-line px-3 text-xs">Ripristina valori iniziali</button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ROUNDS.map((item) => (
          <button key={item.id} type="button" onClick={() => { setRound(item.id); patch({ distanceM: item.distanceM, faceCm: item.faceCm }); }} className={`min-h-11 shrink-0 rounded-full px-3 text-sm ${round === item.id ? "bg-primary text-primary-fg" : "border border-line"}`}>
            {item.name}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {BOWS.map((item) => (
          <button key={item.id} type="button" onClick={() => { setBow(item.id); patch({ lbAt28: item.id !== "compound", eta: item.eta, k: item.k, sighted: item.sighted, eyeCm: item.sighted ? 2 : (RELEASES.find((r) => r.id === release) ?? RELEASES[0]).eyeCm }); }} className={`min-h-11 shrink-0 rounded-full px-3 text-sm ${bow === item.id ? "bg-primary text-primary-fg" : "border border-line"}`}>
            {item.name}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {RELEASES.map((item) => (
          <button key={item.id} type="button" onClick={() => { setRelease(item.id); if (!setup.sighted) patch({ eyeCm: item.eyeCm }); }} className={`min-h-11 shrink-0 rounded-full px-3 text-sm ${release === item.id ? "bg-accent text-accent-fg" : "border border-line"}`}>
            {item.name}
          </button>
        ))}
      </div>
      <div className="grid gap-2">
        <Slider label={form.lbAt28 ? "Libbre segnate sull'arco (a 28″)" : "Libbre"} value={form.drawLb} min={16} max={70} step={1} onChange={(drawLb) => patch({ drawLb, grains: Math.round(gpp * drawLb) })} />
        <Slider label={`Allungo cm (${(form.drawCm / 2.54).toFixed(1).replace(".", ",")}″ · ${effectiveLb(form).toFixed(1).replace(".", ",")} lb)`} value={form.drawCm} min={58} max={84} step={1} onChange={(drawCm) => patch({ drawCm })} />
        <Slider label="Brace cm" value={form.braceCm} min={14} max={28} step={0.5} onChange={(braceCm) => patch({ braceCm })} />
        <Slider label="Grani per libbra" value={Number(gpp.toFixed(1))} min={5} max={16} step={0.1} onChange={(next) => patch({ grains: Math.round(next * form.drawLb) })} />
        <Slider label="Lunghezza freccia cm" value={form.lengthCm} min={55} max={86} step={0.5} onChange={(lengthCm) => patch({ lengthCm })} />
        {!setup.sighted ? (
          <Slider label="Occhio sopra la freccia cm (aggancio)" value={form.eyeCm} min={2} max={16} step={0.5} onChange={(eyeCm) => patch({ eyeCm })} />
        ) : null}
        <Slider label="Diametro mm" value={form.diameterMm} min={3.2} max={9} step={0.1} onChange={(diameterMm) => patch({ diameterMm })} />
        <Slider label="Distanza m" value={form.distanceM} min={10} max={90} step={1} onChange={(distanceM) => { setRound(""); patch({ distanceM }); }} />
        <Slider label="Bersaglio cm" value={form.faceCm} min={20} max={122} step={1} onChange={(faceCm) => patch({ faceCm })} />
        <Slider label="Altezza cm" value={form.heightCm} min={140} max={210} step={1} onChange={(heightCm) => patch({ heightCm })} />
        <Slider label="Vento m/s" value={form.wind} min={-8} max={8} step={0.5} onChange={(wind) => patch({ wind })} />
        <Slider label="Pendenza ° (+ salita, − discesa)" value={form.slopeDeg ?? 0} min={-35} max={35} step={1} onChange={(slopeDeg) => patch({ slopeDeg })} />
        <Inclinometer onUse={(slopeDeg) => patch({ slopeDeg })} />
        {form.slopeDeg ? (
          <p className="text-xs text-muted">In pendenza la distanza da usare sul mirino è circa {compensatedDistance(form).toFixed(1)} m (linea di tiro × coseno dell'angolo); la parabola sopra tiene già conto della gravità inclinata.</p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Penne">
          <Select value={form.fletch} onChange={(e) => patch({ fletch: e.target.value as Fletch })}>
            <option value="spin">Spin wing</option>
            <option value="vane3">3 alette</option>
            <option value="feather3">3 piume</option>
            <option value="feather4">4 piume</option>
          </Select>
        </Field>
        <Field label="Zone">
          <Select value={String(form.zones)} onChange={(e) => patch({ zones: Number(e.target.value) === 5 ? 5 : 10 })}>
            <option value="10">10 zone</option>
            <option value="5">5 zone</option>
          </Select>
        </Field>
      </div>
      {bad ? <p className="text-sm text-danger">Controlla brace, libbre e peso della freccia: con questi numeri il volo non sta in piedi.</p> : null}
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat k="Velocità" v={`${primary.clean.v0.toFixed(1)} m/s`} hint={`${Math.round(primary.clean.v0 * 3.28084)} fps`} />
        <Stat k="Angolo" v={`${((primary.theta * 180) / Math.PI).toFixed(2)}°`} hint={`${speed.energy.toFixed(1)} J`} />
        <Stat k="Tempo di volo" v={`${primary.clean.t.toFixed(2)} s`} hint={`${form.grains} gr · ${gpp.toFixed(1)} gpp`} />
        <Stat k={`Gruppo ${n}`} v={`${primary.total} / ${n * (form.zones === 5 ? 9 : 10)}`} hint={`atteso ${Math.round(primary.expected * n)}`} />
        <Stat k="Centro gruppo" v={side(primary.my)} hint={up(primary.mz)} />
        <Stat k="Apertura" v={`${(primary.rms * 100).toFixed(1)} cm`} hint="scarto quadratico" />
        <Stat k="Rispetto all'oro" v={up(primary.clean.z)} hint={side(primary.clean.y)} />
        <Stat k="Punto di mira" v={setup.sighted ? "oro" : `${Math.abs(primary.gap * 100).toFixed(0)} cm ${primary.gap >= 0 ? "sopra" : "sotto"}`} hint={setup.sighted ? "mirino sull'oro" : Math.abs(primary.gap) > form.faceCm / 200 ? "punta fuori dalla faccia" : "punta della freccia"} />
      </div>
      <p className="rounded-xl border border-line bg-elev px-3 py-2 text-sm">{advice(form, setup.sighted, primary)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Traiettoria e bersaglio</span>
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={() => setPathMode("reale")} className={`min-h-9 rounded-full px-3 text-xs ${pathMode === "reale" ? "bg-primary text-primary-fg" : "border border-line"}`}>Quota da terra</button>
          <button type="button" onClick={() => setPathMode("linea")} className={`min-h-9 rounded-full px-3 text-xs ${pathMode === "linea" ? "bg-primary text-primary-fg" : "border border-line"}`}>Sulla linea all'oro</button>
          <button type="button" onClick={() => setTrueScale((v) => !v)} className={`min-h-9 rounded-full px-3 text-xs ${trueScale ? "bg-accent text-accent-fg" : "border border-line"}`}>{trueScale ? "Proporzioni vere ✓" : "Proporzioni vere"}</button>
        </div>
      </div>
      <div className="flex items-stretch gap-2">
      <div className="min-w-0 flex-1">
      <FlightPath trueScale={trueScale} onGold={(goldM) => patch({ goldM })} input={{ ...form, sighted: setup.sighted }} round={primary} sighted={setup.sighted} mode={pathMode} title={`${form.distanceM} m · faccia ${form.faceCm} cm${form.slopeDeg ? ` · pendenza ${form.slopeDeg > 0 ? "+" : ""}${form.slopeDeg}°` : ""} · gruppo ${primary.total}/${n * (form.zones === 5 ? 9 : 10)}`} />
      </div>
      <label className="flex w-12 shrink-0 flex-col items-center gap-1 text-center text-[10px] leading-tight text-muted">
        <span>🎯 oro</span>
        <input
          type="range"
          min={0.3}
          max={3}
          step={0.01}
          value={goldOf(form)}
          onChange={(e) => patch({ goldM: Number(e.target.value) })}
          aria-label="Altezza del centro del bersaglio"
          className="min-h-0 flex-1 accent-[var(--accent)]"
          style={{ writingMode: "vertical-lr", direction: "rtl" }}
        />
        <span className="font-display text-sm text-fg tabular-nums">{goldOf(form).toFixed(2).replace(".", ",")} m</span>
        <button type="button" onClick={() => patch({ goldM: 1.3 })} className="rounded-full border border-line px-1.5 py-0.5">1,30</button>
      </label>
      </div>
      <FaceFront input={{ ...form, sighted: setup.sighted }} round={primary} sighted={setup.sighted} />
      <div className="flex flex-wrap gap-2">
        {[3, 6, 12].map((count) => (
          <button key={count} type="button" onClick={() => setN(count)} className={`min-h-11 rounded-full px-3 text-sm ${n === count ? "bg-primary text-primary-fg" : "border border-line"}`}>{count} frecce</button>
        ))}
        <button type="button" className="min-h-11 rounded-full border border-line px-3 text-sm" onClick={() => setSeed((value) => value + 11)}>Nuovo gruppo</button>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {[
          [0.15, "Costanza alta"],
          [0.4, "Media"],
          [0.7, "Bassa"],
        ].map(([value, label]) => (
          <button key={label} type="button" onClick={() => setConsistency(Number(value))} className={`min-h-11 shrink-0 rounded-full px-3 text-sm ${consistency === value ? "bg-primary text-primary-fg" : "border border-line"}`}>{label}</button>
        ))}
      </div>
      <p className="text-xs text-muted">La costanza non cambia la media della dispersione: sposta punti fra le volée buone e quelle larghe. L'atteso è la media delle due.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
        Confronta un'altra distanza, stessa freccia
      </label>
      {compare && second ? (
        <div className="grid gap-2">
          <div className="flex gap-2 overflow-x-auto">
            {ROUNDS.filter((item) => item.id !== round).map((item) => (
              <button key={item.id} type="button" onClick={() => setOther(item.id)} className={`min-h-11 shrink-0 rounded-full px-3 text-sm ${other === item.id ? "bg-accent text-accent-fg" : "border border-line"}`}>{item.name}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Stat k="Velocità" v="stessa" hint={`${second.clean.t.toFixed(2)} s`} />
            <Stat k="Centro" v={side(second.my)} hint={up(second.mz)} />
            <Stat k="Gruppo" v={`${second.total}`} hint={`atteso ${Math.round(second.expected * n)}`} />
          </div>
          <FlightPath trueScale={trueScale} input={secondInput} round={second} sighted={setup.sighted} mode={pathMode} title={`${secondInput.distanceM} m · faccia ${secondInput.faceCm} cm · gruppo ${second.total}/${n * (secondInput.zones === 5 ? 9 : 10)}`} />
          <FaceFront input={secondInput} round={second} sighted={setup.sighted} />
        </div>
      ) : null}
    </Card>
  );
}

function advice(form: FlightInput, sighted: boolean, round: { clean: { y: number; z: number }; gap: number; my: number }) {
  const wind = round.clean.y * 100;
  const drop = (round.clean.z - 1.3) * 100;
  const windText = Math.abs(wind) < 0.4 ? "il vento non sposta il centro" : `il vento porta il centro ${Math.abs(wind).toFixed(0)} cm a ${wind > 0 ? "destra" : "sinistra"}`;
  const vertical = Math.abs(drop) < 0.4 ? "in quota sull'oro" : `${Math.abs(drop).toFixed(0)} cm ${drop > 0 ? "sopra" : "sotto"} l'oro`;
  if (sighted) return `Mirino sull'oro. ${sentence(windText)}, e la freccia senza errore arriva ${vertical}. Per centrare, correggi dalla parte opposta al centro gruppo.`;
  const gap = round.gap * 100;
  const point = `${Math.abs(gap).toFixed(0)} cm ${gap >= 0 ? "sopra" : "sotto"} l'oro`;
  return `Senza mirino la punta va tenuta ${point}. ${sentence(windText)}.`;
}

function sentence(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function side(metres: number) {
  const cm = metres * 100;
  if (Math.abs(cm) < 0.3) return "in centro";
  return `${Math.abs(cm).toFixed(1)} cm ${cm > 0 ? "a destra" : "a sinistra"}`;
}

function up(metres: number) {
  const cm = (metres - 1.3) * 100;
  if (Math.abs(cm) < 0.3) return "sull'oro";
  return `${Math.abs(cm).toFixed(1)} cm ${cm > 0 ? "sopra" : "sotto"}`;
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="flex justify-between text-muted"><span>{label}</span><span className="tabular-nums text-fg">{value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full accent-[var(--primary)]" />
    </label>
  );
}

function Stat({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line px-2 py-1">
      <p className="text-xs text-muted">{k}</p>
      <p className="font-display text-xl leading-none">{v}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

type RoundView = ReturnType<typeof describeRound>;

const RING_COLORS = ["#f4f1ea", "#1a1c1e", "#2a6294", "#c4473d", "#e6b325"];

/** Traiettoria di fianco: tiratore, linea di mira, parabola, linea dell'oro e il paglione in fondo. */
function FlightPath({ input, round, sighted, mode, title, onGold, trueScale = false }: { input: FlightInput; round: RoundView; sighted: boolean; mode: "reale" | "linea"; title: string; onGold?: (m: number) => void; trueScale?: boolean }) {
  const GOLD_HEIGHT = goldOf(input);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const W = 380;
  const H = 236;
  const pad = { l: 38, r: 30, t: 22, b: 30 };
  const D = input.distanceM;
  const R = input.faceCm / 200;
  const boss = R + 0.14;
  const rel = releasePoint(input);
  const eye = eyePoint(input);
  const gap = sighted ? 0 : round.gap;
  const aim = { x: D, z: GOLD_HEIGHT + gap };
  const base = (x: number) => (mode === "linea" ? rel.z + ((GOLD_HEIGHT - rel.z) * x) / D : 0);
  const v = (x: number, z: number) => z - base(x);
  const sample = (path: { x: number; z: number }[], every: number) => path.filter((_, i) => i % every === 0 || i === path.length - 1);
  const clean = sample(round.clean.path, 2);
  const spread = round.hits.map((hit) => sample((hit as { path: { x: number; z: number }[] }).path, 6));
  const ys: number[] = [
    ...clean.map((p) => v(p.x, p.z)),
    v(eye.x, eye.z),
    v(D, aim.z),
    v(D, GOLD_HEIGHT + boss),
    v(D, GOLD_HEIGHT - boss),
  ];
  if (mode === "reale") ys.push(0);
  else ys.push(v(D, 0), v(0, 0));
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  const span = Math.max(0.6, hi - lo);
  lo -= span * 0.08;
  hi += span * 0.12;
  if (trueScale) {
    // stessi metri in orizzontale e in verticale: la parabola com'è davvero
    const need = ((H - pad.t - pad.b) / (W - pad.l - pad.r)) * (D + 1);
    const mid = mode === "reale" ? Math.max(need / 2 - 0.3, (lo + hi) / 2) : (lo + hi) / 2;
    lo = mid - need / 2;
    hi = mid + need / 2;
  }
  const X = (x: number) => pad.l + ((x + 1) / (D + 1)) * (W - pad.l - pad.r);
  const Y = (z: number) => pad.t + ((hi - z) / (hi - lo)) * (H - pad.t - pad.b);
  const P = (x: number, z: number) => `${X(x).toFixed(1)} ${Y(v(x, z)).toFixed(1)}`;
  const line = (path: { x: number; z: number }[]) => path.map((p, i) => `${i ? "L" : "M"}${P(p.x, p.z)}`).join(" ");
  const pxPerMx = (W - pad.l - pad.r) / (D + 1);
  const pxPerMz = (H - pad.t - pad.b) / (hi - lo);
  const exaggeration = pxPerMz / pxPerMx;
  const xStep = D > 60 ? 10 : D > 25 ? 5 : 2;
  const zStep = niceStep((hi - lo) / 5);
  const zTicks: number[] = [];
  for (let z = Math.ceil(lo / zStep) * zStep; z <= hi; z += zStep) zTicks.push(Number(z.toFixed(3)));
  const xTicks: number[] = [];
  for (let x = 0; x <= D + 1e-6; x += xStep) xTicks.push(x);
  const top = v(D, GOLD_HEIGHT + boss);
  const bottom = v(D, GOLD_HEIGHT - boss);
  const groundAtTarget = v(D, 0);
  const tx = X(D);
  const peak = round.clean.path.reduce((best, p) => (p.z > best.z ? p : best), round.clean.path[0] ?? { x: 0, z: 0 });
  const offFace = Math.abs(gap) > R;
  const aimText = sighted
    ? "mira: oro (mirino)"
    : `mira: ${Math.abs(gap * 100).toFixed(0)} cm ${gap >= 0 ? "sopra" : "sotto"} l'oro${offFace ? " · fuori faccia" : ""}`;
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full rounded-xl border border-line ${onGold ? "touch-pan-x" : ""}`}
      style={{ background: "#0f1a14" }}
      role="img"
      aria-label={`Traiettoria a ${D} metri`}
      onPointerDown={(e) => {
        if (!onGold || mode !== "reale") return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * W;
        if (px < tx - 30) return; // si trascina solo il bersaglio, a destra
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
      }}
      onPointerMove={(e) => {
        if (!dragging.current || !onGold) return;
        const r = e.currentTarget.getBoundingClientRect();
        const py = ((e.clientY - r.top) / r.height) * H;
        const z = hi - ((py - pad.t) / (H - pad.t - pad.b)) * (hi - lo);
        onGold(Math.round(Math.max(0.3, Math.min(3, z)) * 100) / 100);
      }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
    >
      <text x={pad.l} y={14} fill="var(--muted)" fontSize="10.5">{title}</text>
      {/* griglia */}
      {zTicks.map((z) => (
        <g key={`z${z}`}>
          <line x1={pad.l} x2={W - pad.r} y1={Y(z)} y2={Y(z)} stroke="rgba(244,241,234,0.08)" />
          <text x={pad.l - 4} y={Y(z) + 3} fill="var(--muted)" fontSize="9" textAnchor="end">{z > 0 ? "+" : ""}{fmtM(z)}</text>
        </g>
      ))}
      {xTicks.map((x) => (
        <g key={`x${x}`}>
          <line x1={X(x)} x2={X(x)} y1={pad.t} y2={H - pad.b} stroke="rgba(244,241,234,0.06)" />
          <text x={X(x)} y={H - pad.b + 11} fill="var(--muted)" fontSize="9" textAnchor="middle">{x}m</text>
        </g>
      ))}
      <text x={W / 2} y={H - 4} fill="var(--muted)" fontSize="9" textAnchor="middle">
        {mode === "linea" ? "quota rispetto alla linea verso l'oro" : "quota da terra"} · scala verticale ×{exaggeration.toFixed(exaggeration < 10 ? 1 : 0)}
      </text>
      {/* terreno */}
      <path d={`M${P(-1, 0)} L${P(D, 0)} L${W - pad.r + 30} ${Y(groundAtTarget)}`} stroke="#7aa452" strokeWidth="2" fill="none" />
      <text x={X(D * 0.82)} y={Y(v(D * 0.82, 0)) + 11} fill="#9cc275" fontSize="9">terreno</text>
      {/* linea dell'oro */}
      {mode === "reale" ? (
        <>
          <line x1={X(-1)} x2={tx} y1={Y(GOLD_HEIGHT)} y2={Y(GOLD_HEIGHT)} stroke="#e6b325" strokeWidth="1.2" strokeDasharray="6 4" opacity="0.9" />
          <text x={X(0) + 12} y={Y(GOLD_HEIGHT) - 4} fill="#e6b325" fontSize="9.5">oro {fmtM(GOLD_HEIGHT)}</text>
        </>
      ) : (
        <>
          <line x1={X(0)} x2={tx} y1={Y(0)} y2={Y(0)} stroke="#e6b325" strokeWidth="1.2" strokeDasharray="6 4" opacity="0.9" />
          <text x={X(0) + 2} y={Y(0) + 11} fill="#e6b325" fontSize="9.5">linea verso l'oro</text>
        </>
      )}
      {/* tiratore: l'occhio dice a che altezza guarda */}
      <line x1={X(-0.3)} x2={X(-0.3)} y1={Y(v(-0.3, 0))} y2={Y(v(eye.x, eye.z)) + 7} stroke="#c9c0ae" strokeWidth="2" />
      <g transform={`translate(${X(eye.x)} ${Y(v(eye.x, eye.z))})`}>
        <path d="M-8 0 Q0 -7 8 0 Q0 7 -8 0 Z" fill="#f4f1ea" stroke="#14181c" strokeWidth="0.8" />
        <circle r="3" fill="#2f7fd1" />
        <circle r="1.3" fill="#0b0f12" />
      </g>
      <text x={X(eye.x) + 11} y={Y(v(eye.x, eye.z)) + 13} fill="#f4f1ea" fontSize="9" opacity="0.9">👁 occhio {fmtM(eye.z)}</text>
      {/* linea di mira */}
      <line x1={X(eye.x)} y1={Y(v(eye.x, eye.z))} x2={X(D)} y2={Y(v(D, aim.z))} stroke="#f4f1ea" strokeWidth="1" strokeDasharray="3 3" opacity="0.75" />
      {/* dispersione del gruppo */}
      {spread.map((path, i) => <path key={i} d={line(path)} fill="none" stroke="#e07a2f" strokeWidth="1" opacity="0.28" />)}
      {/* traiettoria pulita */}
      <path d={line(clean)} fill="none" stroke="#e6b325" strokeWidth="2.4" />
      <circle cx={X(peak.x)} cy={Y(v(peak.x, peak.z))} r="2.2" fill="#e6b325" />
      <text x={X(peak.x)} y={Math.max(pad.t + 8, Y(v(peak.x, peak.z)) - 6)} fill="#e6b325" fontSize="9" textAnchor="middle" opacity="0.95">culmine {fmtM(peak.z)} a {peak.x.toFixed(0)} m</text>
      {/* paglione in fondo: cavalletto, paglia, faccia */}
      <line x1={tx + 5} y1={Y(bottom)} x2={tx - 8} y2={Y(groundAtTarget)} stroke="#8a6a3c" strokeWidth="2" />
      <line x1={tx + 5} y1={Y(bottom)} x2={tx + 18} y2={Y(groundAtTarget)} stroke="#8a6a3c" strokeWidth="2" />
      <rect x={tx} y={Y(top)} width="9" height={Math.max(2, Y(bottom) - Y(top))} fill="#c9a46a" stroke="#6b4a2b" strokeWidth="0.8" />
      {RING_COLORS.map((color, i) => {
        const r = R * (1 - i * 0.2);
        return <rect key={color} x={tx - 2.5} y={Y(v(D, GOLD_HEIGHT + r))} width="3" height={Math.max(0.6, Y(v(D, GOLD_HEIGHT - r)) - Y(v(D, GOLD_HEIGHT + r)))} fill={color} />;
      })}
      {round.hits.map((hit, i) => <circle key={i} cx={tx - 1} cy={Y(v(D, hit.z))} r="1.6" fill="#14181c" stroke="#f4f1ea" strokeWidth="0.5" />)}
      {/* punto di mira */}
      <path d={`M${tx} ${Y(v(D, aim.z)) - 5} l5 5 l-5 5 l-5 -5 Z`} fill="#f4f1ea" stroke="#14181c" strokeWidth="0.8" />
      <text x={tx - 8} y={Y(v(D, aim.z)) < pad.t + 14 ? Y(v(D, aim.z)) + 16 : Y(v(D, aim.z)) - 7} fill="#f4f1ea" fontSize="9.5" textAnchor="end">{aimText}</text>
    </svg>
  );
}

/**
 * Il bersaglio come si vede dalla linea di tiro, con lo stesso linguaggio del grafico di fianco:
 * riquadro largo, griglia in centimetri, linea dell'oro, cavalletto e terreno, occhio, mira e frecce.
 * Stessa scala in orizzontale e in verticale (i cerchi restano tondi).
 */
function FaceFront({ input, round, sighted, title }: { input: FlightInput; round: RoundView; sighted: boolean; title?: string }) {
  const GOLD_HEIGHT = goldOf(input);
  const R = input.faceCm / 200;
  const boss = R + 0.14;
  const gap = sighted ? 0 : round.gap;
  const eye = eyePoint(input);
  const W = 380;
  const H = 236;
  const pad = { l: 38, r: 14, t: 22, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  // finestra verticale: paglione + mira + gruppo, con un po' di margine
  const zs = [GOLD_HEIGHT + boss, GOLD_HEIGHT - boss, GOLD_HEIGHT + gap, ...round.hits.map((h) => h.z)];
  let lo = Math.min(...zs);
  let hi = Math.max(...zs);
  const m = Math.max(0.08, (hi - lo) * 0.12);
  lo -= m;
  hi += m * 1.3;
  // se il terreno è vicino lo includo: si vede il paglione appoggiato
  if (lo < 0.45) lo = Math.min(lo, -0.05);
  const spanZ = hi - lo;
  const spanY = (spanZ * iw) / ih;
  const cy = Math.max(-spanY / 2, Math.min(spanY / 2, round.my * 0.5));
  const left = cy - spanY / 2;
  const X = (y: number) => pad.l + ((y - left) / spanY) * iw;
  const Y = (z: number) => pad.t + ((hi - z) / spanZ) * ih;
  const k = iw / spanY; // px per metro
  const step = niceStep(spanZ / 5);
  const zTicks: number[] = [];
  for (let z = Math.ceil(lo / step) * step; z <= hi + 1e-9; z += step) zTicks.push(Number(z.toFixed(3)));
  const yTicks: number[] = [];
  for (let y = Math.ceil(left / step) * step; y <= left + spanY + 1e-9; y += step) yTicks.push(Number(y.toFixed(3)));
  const zones = input.zones === 5 ? 5 : 10;
  const rings = Array.from({ length: zones }, (_, i) => ({ r: R * (1 - i / zones), color: RING_COLORS[Math.floor((i * 5) / zones)] }));
  const dot = Math.max(2.2, (input.diameterMm / 2000) * k);
  const gx = X(0);
  const gy = Y(GOLD_HEIGHT);
  const aimZ = GOLD_HEIGHT + gap;
  const aimIn = aimZ <= hi && aimZ >= lo;
  const aimY = Y(Math.max(lo + spanZ * 0.04, Math.min(hi - spanZ * 0.04, aimZ)));
  const size = angularSize(input.faceCm, input.distanceM);
  const fmtScore = round.hits.map((hit) => (hit.miss ? "M" : hit.zone)).join(" ");
  const centreX = X(round.my);
  const centreY = Y(round.mz);
  const legTop = Y(GOLD_HEIGHT - boss * 0.6);
  const ground = Y(0);
  const eyeIn = eye.z <= hi && eye.z >= lo;
  return (
    <div className="grid gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-line" style={{ background: "#0f1a14" }} role="img" aria-label="Bersaglio visto di fronte">
        <defs>
          <clipPath id="ff-clip"><rect x={pad.l} y={pad.t} width={iw} height={ih} /></clipPath>
          <radialGradient id="ff-sheen" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="70%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <text x={pad.l} y={14} fill="var(--muted)" fontSize="10.5">{title ?? `Di fronte, dalla linea di tiro · ${input.distanceM} m`}</text>
        {/* griglia in cm, come nel grafico di fianco */}
        {zTicks.map((z) => (
          <g key={`z${z}`}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(z)} y2={Y(z)} stroke="rgba(244,241,234,0.08)" />
            <text x={pad.l - 4} y={Y(z) + 3} fill="var(--muted)" fontSize="9" textAnchor="end">{fmtM(z)}</text>
          </g>
        ))}
        {yTicks.map((y) => (
          <g key={`y${y}`}>
            <line x1={X(y)} x2={X(y)} y1={pad.t} y2={H - pad.b} stroke="rgba(244,241,234,0.06)" />
            <text x={X(y)} y={H - pad.b + 11} fill="var(--muted)" fontSize="9" textAnchor="middle">{y === 0 ? "0" : `${y > 0 ? "→" : "←"}${Math.abs(Math.round(y * 100))}`}</text>
          </g>
        ))}
        <text x={W / 2} y={H - 4} fill="var(--muted)" fontSize="9" textAnchor="middle">quota da terra · cm a sinistra/destra del centro · scala reale</text>
        <g clipPath="url(#ff-clip)">
          {/* terreno */}
          {ground <= H - pad.b + 2 ? (
            <>
              <rect x={pad.l} y={ground} width={iw} height={H - pad.b - ground + 2} fill="rgba(122,164,82,0.12)" />
              <line x1={pad.l} x2={W - pad.r} y1={ground} y2={ground} stroke="#7aa452" strokeWidth="2" />
            </>
          ) : null}
          {/* cavalletto */}
          <line x1={gx - boss * k * 0.55} y1={legTop} x2={gx - boss * k * 0.95} y2={Math.max(ground, H)} stroke="#8a6a3c" strokeWidth="3" />
          <line x1={gx + boss * k * 0.55} y1={legTop} x2={gx + boss * k * 0.95} y2={Math.max(ground, H)} stroke="#8a6a3c" strokeWidth="3" />
          {/* paglione con spessore */}
          <rect x={X(-boss) + 3} y={Y(GOLD_HEIGHT + boss) + 3} width={boss * 2 * k} height={boss * 2 * k} rx={4} fill="#6b4a2b" />
          <rect x={X(-boss)} y={Y(GOLD_HEIGHT + boss)} width={boss * 2 * k} height={boss * 2 * k} rx={4} fill="#c9a46a" stroke="#6b4a2b" strokeWidth="0.8" />
          {/* linea dell'oro */}
          <line x1={pad.l} x2={W - pad.r} y1={gy} y2={gy} stroke="#e6b325" strokeWidth="1.2" strokeDasharray="6 4" opacity="0.9" />
          <text x={pad.l + 4} y={gy - 4} fill="#e6b325" fontSize="9.5">oro {fmtM(GOLD_HEIGHT)}</text>
          {/* faccia */}
          {rings.map((ring, i) => (
            <circle key={i} cx={gx} cy={gy} r={ring.r * k} fill={ring.color} stroke={ring.color === "#1a1c1e" ? "rgba(244,241,234,0.5)" : "rgba(20,24,28,0.45)"} strokeWidth="0.5" />
          ))}
          <circle cx={gx} cy={gy} r={R * k} fill="url(#ff-sheen)" />
          <path d={`M${gx - 3} ${gy} H${gx + 3} M${gx} ${gy - 3} V${gy + 3}`} stroke="#14181c" strokeWidth="0.7" />
          {/* occhio: a che quota guarda */}
          {eyeIn ? (
            <>
              <line x1={pad.l} x2={W - pad.r} y1={Y(eye.z)} y2={Y(eye.z)} stroke="#f4f1ea" strokeWidth="0.8" strokeDasharray="2 4" opacity="0.55" />
              <text x={W - pad.r - 4} y={Y(eye.z) - 4} fill="#f4f1ea" fontSize="9" textAnchor="end" opacity="0.9">👁 occhio {fmtM(eye.z)}</text>
            </>
          ) : (
            <text x={W - pad.r - 4} y={eye.z > hi ? pad.t + 10 : H - pad.b - 4} fill="#f4f1ea" fontSize="9" textAnchor="end" opacity="0.8">👁 occhio {fmtM(eye.z)} {eye.z > hi ? "↑" : "↓"}</text>
          )}
          {/* dispersione e centro del gruppo */}
          <circle cx={centreX} cy={centreY} r={Math.max(round.rms * k, dot)} fill="rgba(224,122,47,0.14)" stroke="#e07a2f" strokeWidth="1" strokeDasharray="4 3" />
          {round.hits.map((hit, i) => (
            <g key={i} className="aa-rise" style={{ animationDelay: `${i * 70}ms` }}>
              <circle cx={X(hit.y)} cy={Y(hit.z)} r={dot} fill="#14181c" stroke="#f4f1ea" strokeWidth="0.9" />
            </g>
          ))}
          <path d={`M${centreX - 6} ${centreY} H${centreX + 6} M${centreX} ${centreY - 6} V${centreY + 6}`} stroke="#e07a2f" strokeWidth="1.6" />
          {/* punto di mira */}
          <path d={`M${gx} ${aimY - 6} l6 6 l-6 6 l-6 -6 Z`} fill="#f4f1ea" stroke="#14181c" strokeWidth="0.8" />
          <line x1={gx + 7} y1={aimY} x2={Math.min(X(boss) + 4, W - pad.r - 95)} y2={aimY} stroke="#f4f1ea" strokeWidth="0.7" strokeDasharray="2 2" opacity="0.7" />
          <text x={Math.min(X(boss) + 7, W - pad.r - 92)} y={aimY + 3} fill="#f4f1ea" fontSize="9.5" style={{ paintOrder: "stroke" }} stroke="#0f1a14" strokeWidth="3">
            {sighted ? "mira: oro" : `mira ${Math.abs(gap * 100).toFixed(0)} cm ${gap >= 0 ? "sopra" : "sotto"}${aimIn ? "" : gap > 0 ? " ↑" : " ↓"}`}
          </text>
        </g>
        {/* cornice dell'area */}
        <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="none" stroke="rgba(244,241,234,0.08)" />
      </svg>
      <p className="text-center text-[0.7rem] text-muted">
        Frecce: {fmtScore}
        {size ? ` · la faccia copre ${size.moa.toFixed(0)} MOA (${size.inchesAt20yd.toFixed(1)} in/20 yd)` : ""}
        {" · "}
        <span style={{ color: "#e07a2f" }}>✚</span> centro gruppo · <span style={{ color: "#e07a2f" }}>◌</span> dispersione · ◆ mira
      </p>
    </div>
  );
}

function niceStep(raw: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  const f = raw / exp;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * exp;
}

function fmtM(m: number) {
  const a = Math.abs(m);
  if (a < 1) return `${(m * 100).toFixed(0)} cm`;
  return `${m.toFixed(a < 10 ? 2 : 1).replace(".", ",")} m`;
}

/**
 * Pendenza misurata con il telefono: tienilo dritto in verticale, con la fotocamera verso il bersaglio
 * (come per fare una foto). In piano segna 0°, puntando in su è positivo.
 */
function Inclinometer({ onUse }: { onUse: (deg: number) => void }) {
  const [on, setOn] = useState(false);
  const [deg, setDeg] = useState<number | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!on) return;
    let smooth: number | null = null;
    const read = (e: DeviceOrientationEvent) => {
      if (e.beta == null) return;
      const raw = e.beta - 90; // in verticale beta = 90
      const value = Math.max(-60, Math.min(60, -raw));
      smooth = smooth == null ? value : smooth * 0.8 + value * 0.2;
      setDeg(smooth);
    };
    window.addEventListener("deviceorientation", read);
    const t = window.setTimeout(() => setNote((n) => n || "Se il numero non si muove, questo telefono o browser non dà l'inclinazione."), 2500);
    return () => {
      window.removeEventListener("deviceorientation", read);
      window.clearTimeout(t);
    };
  }, [on]);
  async function start() {
    setNote("");
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof D.requestPermission === "function") {
      try {
        if ((await D.requestPermission()) !== "granted") {
          setNote("Permesso ai sensori negato.");
          return;
        }
      } catch {
        setNote("Permesso ai sensori non disponibile.");
        return;
      }
    }
    setOn(true);
  }
  if (!on) {
    return (
      <button type="button" onClick={() => void start()} className="min-h-10 w-fit rounded-full border border-line px-3 text-sm">📐 Misura la pendenza con il telefono</button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
      <span className="text-xs text-muted">Telefono dritto, fotocamera verso il bersaglio:</span>
      <span className="font-display text-2xl tabular-nums">{deg == null ? "—" : `${deg >= 0 ? "+" : ""}${deg.toFixed(0)}°`}</span>
      <button type="button" disabled={deg == null} onClick={() => { if (deg != null) onUse(Math.max(-35, Math.min(35, Math.round(deg)))); setOn(false); }} className="min-h-9 rounded-full bg-accent px-3 font-semibold text-accent-fg disabled:opacity-50">Usa</button>
      <button type="button" onClick={() => setOn(false)} className="min-h-9 rounded-full border border-line px-3">Chiudi</button>
      {note ? <span className="w-full text-xs text-muted">{note}</span> : null}
    </div>
  );
}
