import { useEffect, useMemo, useState } from "react";
import { GOLD_HEIGHT, angularSize, compensatedDistance, describeRound, eyePoint, launchSpeed, releasePoint, type Fletch, type FlightInput } from "@/lib/arcieri/flight";
import { Card, Field, Select } from "@/components/kit";

const ROUNDS = [
  { id: "18", name: "Indoor 18 m", distanceM: 18, faceCm: 40 },
  { id: "30", name: "30 m", distanceM: 30, faceCm: 80 },
  { id: "50", name: "50 m", distanceM: 50, faceCm: 80 },
  { id: "70", name: "70 m", distanceM: 70, faceCm: 122 },
  { id: "campo", name: "Campo 50 m", distanceM: 50, faceCm: 40 },
] as const;

const BOWS = [
  { id: "recurve", name: "Olimpico", eta: 0.78, k: 0.5, sighted: true, scatter: 1.8, speed: 0.01 },
  { id: "compound", name: "Compound", eta: 0.84, k: 0.7, sighted: true, scatter: 1.1, speed: 0.006 },
  { id: "barebow", name: "Nudo", eta: 0.74, k: 0.5, sighted: false, scatter: 3.2, speed: 0.014 },
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
  k: 0.5,
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
          <button key={item.id} type="button" onClick={() => { setBow(item.id); patch({ eta: item.eta, k: item.k, sighted: item.sighted, eyeCm: item.sighted ? 2 : (RELEASES.find((r) => r.id === release) ?? RELEASES[0]).eyeCm }); }} className={`min-h-11 shrink-0 rounded-full px-3 text-sm ${bow === item.id ? "bg-primary text-primary-fg" : "border border-line"}`}>
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
        <Slider label="Libbre" value={form.drawLb} min={16} max={70} step={1} onChange={(drawLb) => patch({ drawLb, grains: Math.round(gpp * drawLb) })} />
        <Slider label="Allungo cm" value={form.drawCm} min={58} max={84} step={1} onChange={(drawCm) => patch({ drawCm })} />
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
        </div>
      </div>
      <FlightPath input={{ ...form, sighted: setup.sighted }} round={primary} sighted={setup.sighted} mode={pathMode} title={`${form.distanceM} m · faccia ${form.faceCm} cm${form.slopeDeg ? ` · pendenza ${form.slopeDeg > 0 ? "+" : ""}${form.slopeDeg}°` : ""} · gruppo ${primary.total}/${n * (form.zones === 5 ? 9 : 10)}`} />
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
          <FlightPath input={secondInput} round={second} sighted={setup.sighted} mode={pathMode} title={`${secondInput.distanceM} m · faccia ${secondInput.faceCm} cm · gruppo ${second.total}/${n * (secondInput.zones === 5 ? 9 : 10)}`} />
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
function FlightPath({ input, round, sighted, mode, title }: { input: FlightInput; round: RoundView; sighted: boolean; mode: "reale" | "linea"; title: string }) {
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-line" style={{ background: "#0f1a14" }} role="img" aria-label={`Traiettoria a ${D} metri`}>
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
          <text x={X(0) + 2} y={Y(GOLD_HEIGHT) - 4} fill="#e6b325" fontSize="9.5">oro 1,30 m</text>
        </>
      ) : (
        <>
          <line x1={X(0)} x2={tx} y1={Y(0)} y2={Y(0)} stroke="#e6b325" strokeWidth="1.2" strokeDasharray="6 4" opacity="0.9" />
          <text x={X(0) + 2} y={Y(0) + 11} fill="#e6b325" fontSize="9.5">linea verso l'oro</text>
        </>
      )}
      {/* tiratore */}
      <line x1={X(-0.3)} x2={X(-0.3)} y1={Y(v(-0.3, 0))} y2={Y(v(eye.x, eye.z)) + 6} stroke="#c9c0ae" strokeWidth="2" />
      <circle cx={X(eye.x)} cy={Y(v(eye.x, eye.z))} r="4" fill="#c9c0ae" />
      {/* linea di mira */}
      <line x1={X(eye.x)} y1={Y(v(eye.x, eye.z))} x2={X(D)} y2={Y(v(D, aim.z))} stroke="#f4f1ea" strokeWidth="1" strokeDasharray="3 3" opacity="0.75" />
      {/* dispersione del gruppo */}
      {spread.map((path, i) => <path key={i} d={line(path)} fill="none" stroke="#e07a2f" strokeWidth="1" opacity="0.28" />)}
      {/* traiettoria pulita */}
      <path d={line(clean)} fill="none" stroke="#e6b325" strokeWidth="2.4" />
      <circle cx={X(peak.x)} cy={Y(v(peak.x, peak.z))} r="2.2" fill="#e6b325" />
      <text x={X(peak.x)} y={Y(v(peak.x, peak.z)) + 13} fill="#f4f1ea" fontSize="9" textAnchor="middle" opacity="0.85">culmine {fmtM(peak.z)} a {peak.x.toFixed(0)} m</text>
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

/** Il bersaglio come si vede dalla linea di tiro: frecce, centro del gruppo, cerchio di dispersione e punto di mira. */
function FaceFront({ input, round, sighted }: { input: FlightInput; round: RoundView; sighted: boolean }) {
  const R = input.faceCm / 200;
  const boss = R + 0.14;
  const gap = sighted ? 0 : round.gap;
  const view = boss * 1.18;
  const toPt = (y: number, z: number) => ({ x: y, y: -(z - GOLD_HEIGHT) });
  const inView = Math.abs(gap) <= view * 0.92;
  const aim = toPt(0, GOLD_HEIGHT + (inView ? gap : Math.sign(gap) * view * 0.92));
  const centre = toPt(round.my, round.mz);
  const zones = input.zones === 5 ? 5 : 10;
  const rings = Array.from({ length: zones }, (_, i) => ({ r: R * (1 - i / zones), color: RING_COLORS[Math.floor((i * 5) / zones)] }));
  const dot = Math.max(R * 0.025, input.diameterMm / 2000);
  const size = angularSize(input.faceCm, input.distanceM);
  const fmtScore = round.hits.map((hit) => (hit.miss ? "M" : hit.zone)).join(" ");
  return (
    <div className="grid gap-1">
      <svg viewBox={`${-view} ${-view} ${view * 2} ${view * 2}`} className="mx-auto aspect-square w-full max-w-xs rounded-xl border border-line" style={{ background: "#0f1a14" }} role="img" aria-label="Bersaglio visto di fronte">
        <rect x={-boss} y={-boss} width={boss * 2} height={boss * 2} rx={boss * 0.05} fill="#c9a46a" stroke="#6b4a2b" strokeWidth={boss * 0.01} />
        {rings.map((ring, i) => (
          <circle key={i} r={ring.r} fill={ring.color} stroke={ring.color === "#1a1c1e" ? "rgba(244,241,234,0.5)" : "rgba(20,24,28,0.45)"} strokeWidth={R * 0.004} />
        ))}
        <path d={`M${-R * 0.03} 0 H${R * 0.03} M0 ${-R * 0.03} V${R * 0.03}`} stroke="#14181c" strokeWidth={R * 0.006} />
        <circle cx={centre.x} cy={centre.y} r={Math.max(round.rms, dot)} fill="rgba(224,122,47,0.12)" stroke="#e07a2f" strokeWidth={R * 0.008} strokeDasharray={`${R * 0.03} ${R * 0.02}`} />
        {round.hits.map((hit, i) => {
          const p = toPt(hit.y, hit.z);
          return <circle key={i} cx={p.x} cy={p.y} r={dot} fill="#14181c" stroke="#f4f1ea" strokeWidth={dot * 0.35} />;
        })}
        <path d={`M${centre.x - R * 0.07} ${centre.y} H${centre.x + R * 0.07} M${centre.x} ${centre.y - R * 0.07} V${centre.y + R * 0.07}`} stroke="#e07a2f" strokeWidth={R * 0.014} />
        <path d={`M${aim.x} ${aim.y - R * 0.06} l${R * 0.06} ${R * 0.06} l${-R * 0.06} ${R * 0.06} l${-R * 0.06} ${-R * 0.06} Z`} fill="#f4f1ea" stroke="#14181c" strokeWidth={R * 0.008} />
        {!inView ? (
          <text x={0} y={aim.y + (gap > 0 ? R * 0.2 : -R * 0.12)} fill="#f4f1ea" fontSize={R * 0.09} textAnchor="middle">
            {gap > 0 ? "▲" : "▼"} mira {Math.abs(gap * 100).toFixed(0)} cm {gap > 0 ? "sopra" : "sotto"}
          </text>
        ) : null}
      </svg>
      <p className="text-center text-xs text-muted">
        Di fronte, come dalla linea di tiro · {fmtScore}
        {size ? ` · la faccia copre ${size.moa.toFixed(0)} MOA (${size.inchesAt20yd.toFixed(1)} in/20 yd)` : ""}
      </p>
      <p className="text-center text-xs text-muted">
        <span style={{ color: "#e07a2f" }}>✚</span> centro del gruppo · <span style={{ color: "#e07a2f" }}>◌</span> dispersione · ◆ punto di mira
        {!sighted && !inView ? " (fuori vista, segnato sul bordo)" : ""}
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
