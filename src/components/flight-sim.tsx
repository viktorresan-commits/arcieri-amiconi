import { AppIcon, Glyph, IconLabel } from "./icons";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { airDensity, angularSize, effectiveLb, goldOf, compensatedDistance, describeRound, eyePoint, launchSpeed, releasePoint, type Fletch, type FlightInput } from "@/lib/arcieri/flight";
import { Button, Card, Chips, Field, Segmented, Select, TextInput } from "@/components/kit";
import { listEquipment, saveEquipment } from "@/lib/arcieri/club.api";
import { Zoomable } from "./zoomable";
import { ConvertButton } from "./unit-converter";
import { Flight3D } from "./flight-gl";
import { Tiro3D } from "./tiro-3d";
import { useAvatar } from "./avatar-hero";
import { tiroConfig } from "@/lib/arcieri/tiro3d";
import { FlightCurves } from "./flight-curves";
import { useNarrow } from "@/lib/arcieri/use-narrow";
import { readMainGear, useMainArrowLook } from "@/lib/arcieri/main-gear";
import { useArcherSetup, type ArcherSetup } from "@/lib/arcieri/setup";

const ROUNDS = [
  { id: "18", name: "Indoor 18 m", distanceM: 18, faceCm: 40 },
  { id: "30", name: "30 m", distanceM: 30, faceCm: 80 },
  { id: "50", name: "50 m", distanceM: 50, faceCm: 80 },
  { id: "70", name: "70 m", distanceM: 70, faceCm: 122 },
  { id: "campo", name: "Campo 50 m", distanceM: 50, faceCm: 40 },
] as const;

const BOWS = [
  { id: "tradizionale", name: "Tradizionale", eta: 0.72, k: 0.5, sighted: false, scatter: 3.8, speed: 0.016 },
  { id: "longbow", name: "Longbow", eta: 0.68, k: 0.48, sighted: false, scatter: 4.2, speed: 0.018 },
  { id: "barebow", name: "Nudo", eta: 0.74, k: 0.55, sighted: false, scatter: 3.2, speed: 0.014 },
  { id: "recurve", name: "Olimpico", eta: 0.78, k: 0.55, sighted: true, scatter: 1.8, speed: 0.01 },
  { id: "compound", name: "Compound", eta: 0.84, k: 0.7, sighted: true, scatter: 1.1, speed: 0.006 },
] as const;

const RELEASES = [
  { id: "dita", name: "Tre dita", gain: 1, eyeCm: 11 },
  { id: "sotto", name: "Tre sotto", gain: 0.92, eyeCm: 8 },
  { id: "sgancio", name: "Sgancio", gain: 0.75, eyeCm: 5 },
] as const;

const START: FlightInput = {
  drawLb: 30,
  drawCm: 71,
  braceCm: 20,
  eta: 0.72,
  k: 0.5,
  grains: 420,
  diameterMm: 6.5,
  lengthCm: 76,
  fletch: "feather3",
  distanceM: 18,
  heightCm: 175,
  eyeCm: 11,
  eyeBackCm: 8,
  wind: 0,
  sighted: false,
  faceCm: 40,
  zones: 10,
  slopeDeg: 0,
  goldM: 1.3,
  lbAt28: true,
  headWind: 0,
  tempC: 15,
  altM: 0,
  targetSpeed: 0,
  focPct: 10,
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
    const bow = BOWS.find((item) => item.id === raw.bow)?.id ?? "tradizionale";
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
  const [bow, setBow] = useState<(typeof BOWS)[number]["id"]>("tradizionale");
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
  const [replay, setReplay] = useState(0);
  const [view3d, setView3d] = useState(true);
  /** il 3D con i modelli veri non parte (niente animazioni o WebGL): resta il tiro disegnato */
  const [plain3d, setPlain3d] = useState(false);
  const { shown: avatarLook } = useAvatar();
  const arrowLook = useMainArrowLook();
  const archer = useArcherSetup();
  const [tab, setTab] = useState<"arco" | "freccia" | "tiro" | "meteo">("arco");
  const patch = (part: Partial<FlightInput>) => setForm((current) => ({ ...current, ...part }));

  // I dati balistici restano sul telefono: si ricaricano all'apertura e si salvano a ogni modifica.
  useEffect(() => {
    const saved = readSaved();
    const main = readMainGear();
    if (!saved && main && Number(main.bowSpecs.draw) > 0) {
      // prima apertura: si parte dalla tua attrezzatura principale
      const b = main.bowSpecs;
      const a = main.arrowSpecs;
      const inch = Number(b.drawLen) || 28;
      setForm((f) => ({
        ...f,
        drawLb: Number(b.draw) || f.drawLb,
        drawCm: Math.round(inch * 2.54 * 2) / 2,
        grains: Number(a.weight) || f.grains,
        lengthCm: Number(a.length) ? Math.round(Number(a.length) * 2.54 * 2) / 2 : f.lengthCm,
        diameterMm: GEAR_DIAM[a.material] ?? f.diameterMm,
      }));
      setBow(GEAR_BOW[b.bowType] ?? "tradizionale");
    }
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
    setBow("tradizionale");
    setRelease("dita");
    setRound("18");
    setOther("50");
    setCompare(true);
    setN(6);
    setConsistency(0.4);
    setSeed(4);
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
  const flightInput = useMemo(() => ({ ...form, sighted: setup.sighted }), [form, setup.sighted]);
  const tiroCfg = useMemo(() => tiroConfig(flightInput, primary, bow, avatarLook), [flightInput, primary, bow, avatarLook]);
  const gpp = form.drawLb > 0 ? form.grains / form.drawLb : 0;
  const bad = form.braceCm >= form.drawCm || form.grains < 80 || form.drawLb < 10;

  return (
    <Card className="grid gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="aa-section-title">Simulatore di volo</h2>
          <p className="text-xs text-muted">Scegli una composizione o regola i valori: tutto si salva da solo.</p>
        </div>
        <button type="button" onClick={resetAll} className="aa-chip shrink-0" aria-label="Ripristina valori iniziali">
          <Glyph name="history" size={14} /> Iniziali
        </button>
      </div>
      <Compositions
        current={{ form, bow, release, round }}
        onApply={(c) => {
          setForm({ ...START, ...c.form });
          setBow(c.bow);
          setRelease(c.release);
          setRound(c.round);
        }}
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: "arco", label: <IconLabel icon="bow" size={14}>Arco</IconLabel> },
          { id: "freccia", label: <IconLabel icon="arrow" size={14}>Freccia</IconLabel> },
          { id: "tiro", label: <IconLabel icon="target" size={14}>Tiro</IconLabel> },
          { id: "meteo", label: <IconLabel icon="wind" size={14}>Aria</IconLabel> },
        ]}
      />
      {tab === "arco" ? (
        <div className="grid gap-2.5">
          <Chips value={bow} onChange={(id) => { const item = BOWS.find((b) => b.id === id) ?? BOWS[0]; setBow(item.id); patch({ lbAt28: item.id !== "compound", eta: item.eta, k: item.k, sighted: item.sighted, eyeCm: item.sighted ? 2 : (RELEASES.find((r) => r.id === release) ?? RELEASES[0]).eyeCm }); }} options={BOWS.map((b) => ({ id: b.id, label: b.name }))} />
          <Chips value={release} onChange={(id) => { const item = RELEASES.find((r) => r.id === id) ?? RELEASES[0]; setRelease(item.id); if (!setup.sighted) patch({ eyeCm: item.eyeCm }); }} options={RELEASES.map((r) => ({ id: r.id, label: r.name }))} />
          <Slider label={form.lbAt28 ? "Libbre segnate (a 28″)" : "Libbre"} unit="lb" value={form.drawLb} min={16} max={70} step={1} onChange={(drawLb) => patch({ drawLb, grains: Math.round(gpp * drawLb) })} />
          <Slider label={`Allungo (${(form.drawCm / 2.54).toFixed(1).replace(".", ",")}″ · ${effectiveLb(form).toFixed(1).replace(".", ",")} lb reali)`} unit="cm" value={form.drawCm} min={58} max={84} step={0.5} onChange={(drawCm) => patch({ drawCm })} />
          <Slider label="Brace (corda–impugnatura)" unit="cm" value={form.braceCm} min={14} max={28} step={0.5} onChange={(braceCm) => patch({ braceCm })} />
          <Slider label="Resa dell'arco (energia che passa alla freccia)" unit="%" value={Math.round(form.eta * 100)} min={55} max={92} step={1} onChange={(v) => patch({ eta: v / 100 })} />
          <Slider label="Curva di carico (accumulo: 50 morbida, 70 camme)" unit="%" value={Math.round(form.k * 100)} min={40} max={80} step={1} onChange={(v) => patch({ k: v / 100 })} />
          <p className="text-[0.7rem] text-muted">Energia {speed.energy.toFixed(1).replace(".", ",")} J · corsa di spinta {(speed.stroke * 100).toFixed(1).replace(".", ",")} cm · {Math.round(speed.speed * 3.28084)} fps</p>
        </div>
      ) : null}
      {tab === "freccia" ? (
        <div className="grid gap-2.5">
          <Slider label={`Peso totale (${gpp.toFixed(1).replace(".", ",")} grani per libbra)`} unit="gr" value={form.grains} min={150} max={900} step={1} onChange={(grains) => patch({ grains })} />
          <Slider label="Lunghezza" unit="cm" value={form.lengthCm} min={55} max={86} step={0.5} onChange={(lengthCm) => patch({ lengthCm })} />
          <Slider label="Diametro" unit="mm" value={form.diameterMm} min={3.2} max={9} step={0.1} onChange={(diameterMm) => patch({ diameterMm })} />
          <Field label="Penne">
            <Select value={form.fletch} onChange={(e) => patch({ fletch: e.target.value as Fletch })}>
              <option value="spin">Spin wing</option>
              <option value="vane3">3 alette</option>
              <option value="feather3">3 piume</option>
              <option value="feather4">4 piume</option>
            </Select>
          </Field>
          <Slider label="FOC (peso davanti: sotto l'8% il gruppo si apre)" unit="%" value={form.focPct ?? 10} min={2} max={30} step={0.5} onChange={(focPct) => patch({ focPct })} />
          <p className="text-[0.7rem] text-muted">Il FOC esatto lo calcoli qui sotto, in «Calcolo FOC».</p>
        </div>
      ) : null}
      {tab === "tiro" ? (
        <div className="grid gap-2.5">
          <Chips value={round} onChange={(id) => { const item = ROUNDS.find((r) => r.id === id); if (!item) return; setRound(item.id); patch({ distanceM: item.distanceM, faceCm: item.faceCm }); }} options={ROUNDS.map((r) => ({ id: r.id, label: r.name }))} />
          <Slider label="Distanza" unit="m" value={form.distanceM} min={5} max={90} step={0.5} onChange={(distanceM) => { setRound(""); patch({ distanceM }); }} />
          <Slider label="Diametro della faccia" unit="cm" value={form.faceCm} min={10} max={122} step={1} onChange={(faceCm) => patch({ faceCm })} />
          <Slider label="Altezza dell'oro da terra" unit="m" value={goldOf(form)} min={0.3} max={3} step={0.01} onChange={(goldM) => patch({ goldM })} />
          <Slider label="Bersaglio in movimento (+ verso destra, − verso sinistra)" unit="m/s" value={form.targetSpeed ?? 0} min={-6} max={6} step={0.1} onChange={(targetSpeed) => patch({ targetSpeed })} />
          <Slider label="La tua altezza" unit="cm" value={form.heightCm} min={120} max={210} step={1} onChange={(heightCm) => patch({ heightCm })} />
          {!setup.sighted ? (
            <Slider label="Occhio sopra la freccia (aggancio)" unit="cm" value={form.eyeCm} min={2} max={16} step={0.5} onChange={(eyeCm) => patch({ eyeCm })} />
          ) : null}
          <Field label="Zone">
            <Select value={String(form.zones)} onChange={(e) => patch({ zones: Number(e.target.value) === 5 ? 5 : 10 })}>
              <option value="10">10 zone</option>
              <option value="5">5 zone</option>
            </Select>
          </Field>
        </div>
      ) : null}
      {tab === "meteo" ? (
        <div className="grid gap-2.5">
          <Slider label="Vento (+ da sinistra, − da destra)" unit="m/s" value={form.wind} min={-8} max={8} step={0.5} onChange={(wind) => patch({ wind })} />
          <Slider label="Vento frontale (+ contrario, − a favore)" unit="m/s" value={form.headWind ?? 0} min={-8} max={8} step={0.5} onChange={(headWind) => patch({ headWind })} />
          <Slider label="Temperatura dell'aria" unit="°C" value={form.tempC ?? 15} min={-10} max={42} step={1} onChange={(tempC) => patch({ tempC })} />
          <Slider label="Quota del campo" unit="m" value={form.altM ?? 0} min={0} max={2500} step={50} onChange={(altM) => patch({ altM })} />
          <p className="text-[0.7rem] text-muted">Aria a {airDensity(form).toFixed(3).replace(".", ",")} kg/m³: più caldo o più in alto, meno resistenza e la freccia cala meno.</p>
          <Slider label="Pendenza (+ salita, − discesa)" unit="°" value={form.slopeDeg ?? 0} min={-35} max={35} step={1} onChange={(slopeDeg) => patch({ slopeDeg })} />
          <Inclinometer onUse={(slopeDeg) => patch({ slopeDeg })} />
          {form.slopeDeg ? (
            <p className="text-xs text-muted">In pendenza la distanza da usare sul mirino è circa {compensatedDistance(form).toFixed(1)} m (linea di tiro × coseno dell'angolo); la parabola tiene già conto della gravità inclinata.</p>
          ) : null}
        </div>
      ) : null}
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
      {archer.has ? <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-muted">{personalAdvice(form, archer)}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Traiettoria e bersaglio</span>
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={() => setView3d(true)} className={`min-h-9 rounded-full px-3 text-xs ${view3d ? "bg-primary text-primary-fg" : "border border-line"}`}>3D</button>
          <button type="button" onClick={() => setView3d(false)} className={`min-h-9 rounded-full px-3 text-xs ${!view3d ? "bg-primary text-primary-fg" : "border border-line"}`}>Grafici</button>
          <button type="button" onClick={() => setReplay((r) => r + 1)} className="min-h-9 rounded-full bg-white/10 px-3 text-xs font-semibold"><Glyph name="play" size={12} className="mr-1 inline -translate-y-px" />Rivedi il tiro</button>
        </div>
      </div>
      {view3d ? (
        <>
          <Expand title="Tiro in 3D" onReplay={() => setReplay((r) => r + 1)}>
            {/* con il bersaglio in movimento resta il tiro disegnato, che sposta il paglione mentre la freccia vola */}
            {plain3d || (flightInput.targetSpeed ?? 0) !== 0 ? (
              <Flight3D key={`f3-${replay}`} input={flightInput} round={primary} sighted={setup.sighted} look={arrowLook} height="h-[30rem] sm:h-80" />
            ) : (
              <Tiro3D cfg={tiroCfg} replay={replay} onFail={() => setPlain3d(true)} className="h-[30rem] sm:h-96" />
            )}
          </Expand>
          <AimHelp input={flightInput} round={primary} sighted={setup.sighted} fixY={-primary.my} fixZ={goldOf(form) + (setup.sighted ? 0 : primary.gap) - (primary.mz - goldOf(form))} gold={goldOf(form)} R={form.faceCm / 200} />
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => setPathMode("reale")} className={`min-h-9 rounded-full px-3 text-xs ${pathMode === "reale" ? "bg-primary text-primary-fg" : "border border-line"}`}>Quota da terra</button>
            <button type="button" onClick={() => setPathMode("linea")} className={`min-h-9 rounded-full px-3 text-xs ${pathMode === "linea" ? "bg-primary text-primary-fg" : "border border-line"}`}>Sulla linea all'oro</button>
            <button type="button" onClick={() => setTrueScale((v) => !v)} className={`min-h-9 rounded-full px-3 text-xs ${trueScale ? "bg-accent text-accent-fg" : "border border-line"}`}>{trueScale ? "Proporzioni vere ✓" : "Proporzioni vere"}</button>
          </div>
          <Expand title="Traiettoria" onReplay={() => setReplay((r) => r + 1)}>
            <FlightPath replay={replay} trueScale={trueScale} input={flightInput} round={primary} sighted={setup.sighted} mode={pathMode} title={`${form.distanceM} m · faccia ${form.faceCm} cm${form.slopeDeg ? ` · pendenza ${form.slopeDeg > 0 ? "+" : ""}${form.slopeDeg}°` : ""} · gruppo ${primary.total}/${n * (form.zones === 5 ? 9 : 10)}`} />
          </Expand>
          <Expand title="Bersaglio" onReplay={() => setReplay((r) => r + 1)}>
            <FaceFront key={`ff-${replay}`} input={flightInput} round={primary} sighted={setup.sighted} />
          </Expand>
          <FlightCurves hit={primary.clean} distance={form.distanceM} replay={replay} />
        </>
      )}
      {Math.abs(form.targetSpeed ?? 0) > 0.01 ? (
        <p className="rounded-xl border border-[#7cf0a8]/40 bg-[#7cf0a8]/[0.07] px-3 py-2 text-sm">
          Bersaglio in movimento a {Math.abs(form.targetSpeed ?? 0).toFixed(1).replace(".", ",")} m/s verso {(form.targetSpeed ?? 0) > 0 ? "destra" : "sinistra"}: la freccia vola {primary.clean.t.toFixed(2).replace(".", ",")} s, quindi mira <b>{Math.abs(primary.lead * 100).toFixed(0)} cm avanti</b> rispetto al centro che vedi al rilascio (circa {(Math.abs(primary.lead) / Math.max(0.01, form.faceCm / 100)).toFixed(1).replace(".", ",")} facce). Il cerchio tratteggiato è dov'era il bersaglio quando sei partito.
        </p>
      ) : null}
      <p className="text-center text-[0.68rem] text-muted">Trascina o usa due dita per girare, ingrandire e spostare · doppio tocco per tornare com'era · «Gira» fa il giro della scena · il volo dura quanto quello vero ({primary.clean.t.toFixed(2).replace(".", ",")} s).</p>
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

/** Confronto fra quello che simuli e il tuo arco vero (libbre reali, allungo, peso consigliato). */
function personalAdvice(form: FlightInput, a: ArcherSetup) {
  const out: string[] = [`Il tuo arco: ${a.summary}.`];
  if (a.realLb && Math.abs(form.drawLb - a.realLb) >= 2) out.push(`Qui simuli ${Math.round(form.drawLb)} lb: con il tuo arco ne tiri circa ${Math.round(a.realLb)}, la freccia andrà ${form.drawLb > a.realLb ? "più bassa e più lenta" : "più alta e più veloce"} di così.`);
  const inch = form.drawCm / 2.54;
  if (Math.abs(inch - a.drawIn) >= 0.5) out.push(`Allungo simulato ${inch.toFixed(1).replace(".", ",")}″, il tuo è ${a.drawIn.toFixed(1).replace(".", ",")}″.`);
  if (a.grains) {
    if (form.grains < a.grains.min) out.push(`${Math.round(form.grains)} grani sono pochi per il tuo arco (consigliati ${a.grains.min}–${a.grains.max}): più veloce ma più sensibile al vento.`);
    else if (form.grains > a.grains.max) out.push(`${Math.round(form.grains)} grani sono tanti per il tuo arco (consigliati ${a.grains.min}–${a.grains.max}): traiettoria più curva, serve più alzo.`);
    else out.push(`Peso freccia adatto al tuo arco (${a.grains.min}–${a.grains.max} grani).`);
  }
  if (a.spineRange) out.push(`Spine indicato per te: ${a.spineRange}.`);
  return out.join(" ");
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

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (value: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  const digits = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  const shown = Number(value.toFixed(digits));
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const commit = (raw: string) => {
    const v = Number(raw.replace(",", "."));
    if (Number.isFinite(v)) onChange(Number(clamp(v).toFixed(digits)));
    setText(null);
  };
  const nudge = (dir: 1 | -1) => onChange(Number(clamp(value + dir * step).toFixed(digits)));
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[0.78rem] leading-tight text-muted">{label}</span>
        <button type="button" onClick={() => nudge(-1)} className="grid h-8 w-8 place-items-center rounded-full border border-hair bg-white/5 text-base" aria-label={`${label}: meno`}>−</button>
        <label className="flex h-8 items-center gap-1 rounded-lg border border-hair bg-black/25 px-2">
          <input
            inputMode="decimal"
            value={text ?? String(shown).replace(".", ",")}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="w-12 bg-transparent text-right text-sm font-semibold tabular-nums outline-none"
            aria-label={label}
          />
          {unit ? <span className="text-[0.7rem] text-muted">{unit}</span> : null}
        </label>
        <button type="button" onClick={() => nudge(1)} className="grid h-8 w-8 place-items-center rounded-full border border-hair bg-white/5 text-base" aria-label={`${label}: più`}>+</button>
        {unit ? <ConvertButton unit={unit} value={String(shown).replace(".", ",")} onUse={(v) => commit(v)} className="h-8" /> : null}
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-6 w-full accent-[var(--primary)]" />
    </div>
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
function FlightPath({ input, round, sighted, mode, title, trueScale = false, replay = 0 }: { input: FlightInput; round: RoundView; sighted: boolean; mode: "reale" | "linea"; title: string; trueScale?: boolean; replay?: number }) {
  const GOLD_HEIGHT = goldOf(input);
  // animazione del tiro in tempo reale: la freccia percorre la traiettoria nel suo vero tempo di volo
  const [k, setK] = useState(1);
  const flightS = round.clean.t;
  useEffect(() => {
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setK(1);
      return;
    }
    const dur = Math.max(16, flightS * 1000);
    let raf = 0;
    const t0 = performance.now() + 350;
    const step = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - t0) / dur));
      setK(t);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    setK(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [replay, input.distanceM, flightS, mode]);
  const narrow = useNarrow();
  const W = 380;
  const H = narrow ? 330 : 236;
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
    <Zoomable label="Traiettoria" className="border border-line">
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full"
      style={{ background: "#0f1a14" }}
      role="img"
      aria-label={`Traiettoria a ${D} metri`}
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
      <text x={X(eye.x) + 11} y={Y(v(eye.x, eye.z)) + 13} fill="#f4f1ea" fontSize="9" opacity="0.9">◉ occhio {fmtM(eye.z)}</text>
      {/* linea di mira */}
      <line x1={X(eye.x)} y1={Y(v(eye.x, eye.z))} x2={X(D)} y2={Y(v(D, aim.z))} stroke="#f4f1ea" strokeWidth="1" strokeDasharray="3 3" opacity="0.75" />
      {/* dispersione del gruppo */}
      {spread.map((path, i) => <path key={i} d={line(path)} fill="none" stroke="#e07a2f" strokeWidth="1" opacity="0.28" />)}
      {/* traiettoria pulita: tratteggio di tutto il volo, scia luminosa fin dove è arrivata la freccia */}
      <defs>
        <linearGradient id={`fp-trail-${D}-${mode}`} x1="0" x2="1">
          <stop offset="0" stopColor="#e6b325" stopOpacity="0.1" />
          <stop offset="1" stopColor="#fff1b0" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d={line(clean)} fill="none" stroke="#e6b325" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.55" />
      {(() => {
        const n = Math.max(1, Math.round(k * (clean.length - 1)));
        const done = clean.slice(0, n + 1);
        const a = clean[Math.max(0, n - 1)];
        const b = clean[n];
        const ang = (Math.atan2(Y(v(b.x, b.z)) - Y(v(a.x, a.z)), X(b.x) - X(a.x)) * 180) / Math.PI;
        return (
          <>
            <path d={line(done)} fill="none" stroke={`url(#fp-trail-${D}-${mode})`} strokeWidth="2.8" strokeLinecap="round" />
            {k < 1 ? (
              <g transform={`translate(${X(b.x)} ${Y(v(b.x, b.z))}) rotate(${ang})`}>
                <line x1={-22} y1={0} x2={0} y2={0} stroke="#f4f1ea" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M0 0 l-5 -2.4 v4.8 z" fill="#c9d0d8" />
                <path d="M-22 0 l4 -4 h4 l-3 4 z M-22 0 l4 4 h4 l-3 -4 z" fill="#d63a2f" />
              </g>
            ) : (
              <g>
                <circle cx={tx - 1} cy={Y(v(D, round.clean.z))} r="9" fill="none" stroke="#fff1b0" strokeWidth="1.5" className="aa-impact" />
                <line x1={tx - 16} y1={Y(v(D, round.clean.z))} x2={tx} y2={Y(v(D, round.clean.z))} stroke="#f4f1ea" strokeWidth="1.8" />
                <path d={`M${tx - 16} ${Y(v(D, round.clean.z))} l4 -4 h4 l-3 4 z M${tx - 16} ${Y(v(D, round.clean.z))} l4 4 h4 l-3 -4 z`} fill="#d63a2f" />
              </g>
            )}
          </>
        );
      })()}
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
      <text x={W - 44} y={14} fill={k < 1 ? "#fff1b0" : "var(--muted)"} fontSize="9.5" textAnchor="end">{(k * flightS).toFixed(2).replace(".", ",")} s</text>
    </svg>
    </Zoomable>
  );
}

/**
 * Il bersaglio come si vede dalla linea di tiro, con lo stesso linguaggio del grafico di fianco:
 * riquadro largo, griglia in centimetri, linea dell'oro, cavalletto e terreno, occhio, mira e frecce.
 * Stessa scala in orizzontale e in verticale (i cerchi restano tondi).
 */
function FaceFront({ input, round, sighted, title }: { input: FlightInput; round: RoundView; sighted: boolean; title?: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const GOLD_HEIGHT = goldOf(input);
  const R = input.faceCm / 200;
  const boss = R + 0.14;
  const gap = sighted ? 0 : round.gap;
  const eye = eyePoint(input);
  const narrow = useNarrow();
  const W = 380;
  const H = narrow ? 380 : 236;
  const pad = { l: 38, r: 14, t: 22, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  // finestra verticale: paglione + mira + gruppo, con un po' di margine
  // mira corretta: sposto la mira al contrario dello scarto del gruppo, così il centro gruppo va sull'oro
  const fixY = -round.my;
  const fixZ = GOLD_HEIGHT + gap - (round.mz - GOLD_HEIGHT);
  const zs = [GOLD_HEIGHT + boss, GOLD_HEIGHT - boss, GOLD_HEIGHT + gap, fixZ, ...round.hits.map((h) => h.z)];
  let lo = Math.min(...zs);
  let hi = Math.max(...zs);
  const m = Math.max(0.08, (hi - lo) * 0.12);
  lo -= m;
  hi += m * 1.3;
  // se il terreno è vicino lo includo: si vede il paglione appoggiato
  if (lo < 0.45) lo = Math.min(lo, -0.05);
  // bersaglio in movimento: al rilascio era indietro di `lead`, la finestra deve contenerlo
  const lead = round.lead ?? 0;
  const moving = Math.abs(lead) > 0.005;
  const flightMs = Math.round(round.clean.t * 1000);
  const ys = moving ? [-boss, boss, -lead - R, -lead + R, round.my, -round.my] : [];
  const needY = moving ? (Math.max(...ys) - Math.min(...ys)) * 1.15 : 0;
  if (needY > ((hi - lo) * iw) / ih) {
    const extra = (needY * ih) / iw - (hi - lo);
    lo -= extra / 2;
    hi += extra / 2;
  }
  const spanZ = hi - lo;
  const spanY = (spanZ * iw) / ih;
  const cy = moving ? (Math.max(...ys) + Math.min(...ys)) / 2 : Math.max(-spanY / 2, Math.min(spanY / 2, round.my * 0.5));
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
      <Zoomable label="Bersaglio" className="border border-line">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ background: "#0f1a14" }} role="img" aria-label="Bersaglio visto di fronte">
        <defs>
          <clipPath id="ff-clip"><rect x={pad.l} y={pad.t} width={iw} height={ih} /></clipPath>
          <marker id="ff-move" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#f4f1ea" /></marker>
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
          {moving ? (
            <g>
              <circle cx={X(-lead)} cy={gy} r={R * k} fill="none" stroke="#f4f1ea" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
              <text x={X(-lead)} y={Y(GOLD_HEIGHT + R) - 4} fill="#f4f1ea" fontSize="8.5" textAnchor="middle" opacity="0.8">al rilascio</text>
              <line x1={X(-lead)} y1={gy} x2={gx} y2={gy} stroke="#f4f1ea" strokeWidth="1.2" opacity="0.7" markerEnd="url(#ff-move)" />
              <text x={X(-lead)} y={Y(GOLD_HEIGHT - R) + 12} fill="#f4f1ea" fontSize="8.5" textAnchor="middle" stroke="#0f1a14" strokeWidth="2.6" style={{ paintOrder: "stroke" }}>anticipo {Math.abs(lead * 100).toFixed(0)} cm in {round.clean.t.toFixed(2).replace(".", ",")} s {lead > 0 ? "→" : "←"}</text>
            </g>
          ) : null}
          <g className={moving ? "aa-slide-x" : undefined} style={moving ? ({ "--dx": `${-lead * k}px`, animationDuration: `${flightMs}ms`, animationDelay: "350ms" } as CSSProperties) : undefined}>
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
          {/* anello della X e numeri delle zone sulla destra */}
          <circle cx={gx} cy={gy} r={(R / zones / 2) * k} fill="none" stroke="rgba(20,24,28,0.6)" strokeWidth="0.5" />
          {R * k > 40
            ? rings.map((ring, i) => (
                <text key={`n${i}`} x={gx + (ring.r - R / zones / 2) * k} y={gy + 2.5} fontSize={Math.max(5, Math.min(8, (R / zones) * k * 0.55))} textAnchor="middle" fill={ring.color === "#1a1c1e" || ring.color === "#2a6294" ? "#f4f1ea" : "#14181c"} opacity="0.75">
                  {zones === 5 ? 5 + i : i + 1}
                </text>
              ))
            : null}
          {/* spessore della faccia e ombra sul paglione */}
          <circle cx={gx + 2} cy={gy + 3} r={R * k} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
          <circle cx={gx} cy={gy} r={R * k} fill="url(#ff-sheen)" />
          <path d={`M${gx - 3} ${gy} H${gx + 3} M${gx} ${gy - 3} V${gy + 3}`} stroke="#14181c" strokeWidth="0.7" />
          </g>
          {/* occhio: a che quota guarda */}
          {eyeIn ? (
            <>
              <line x1={pad.l} x2={W - pad.r} y1={Y(eye.z)} y2={Y(eye.z)} stroke="#f4f1ea" strokeWidth="0.8" strokeDasharray="2 4" opacity="0.55" />
              <text x={W - pad.r - 4} y={Y(eye.z) - 4} fill="#f4f1ea" fontSize="9" textAnchor="end" opacity="0.9">◉ occhio {fmtM(eye.z)}</text>
            </>
          ) : (
            <text x={W - pad.r - 4} y={eye.z > hi ? pad.t + 10 : H - pad.b - 4} fill="#f4f1ea" fontSize="9" textAnchor="end" opacity="0.8">occhio {fmtM(eye.z)} {eye.z > hi ? "↑" : "↓"}</text>
          )}
          {/* dispersione e centro del gruppo */}
          <circle cx={centreX} cy={centreY} r={Math.max(round.rms * k, dot)} fill="rgba(224,122,47,0.14)" stroke="#e07a2f" strokeWidth="1" strokeDasharray="4 3" />
          {/* quote dal centro dell'oro al centro del gruppo: quanto e da che parte */}
          {Math.hypot(centreX - gx, centreY - gy) > 3 ? (
            <g stroke="#e07a2f" strokeWidth="0.9" fill="#e07a2f" fontSize="8.5">
              <line x1={gx} y1={gy} x2={centreX} y2={gy} strokeDasharray="2 2" />
              <line x1={centreX} y1={gy} x2={centreX} y2={centreY} strokeDasharray="2 2" />
              {Math.abs(round.my) >= 0.005 ? (
                <text x={(gx + centreX) / 2} y={gy + (centreY > gy ? -4 : 10)} textAnchor="middle" stroke="#0f1a14" strokeWidth="2.6" strokeDasharray="none" style={{ paintOrder: "stroke" }}>
                  {`${Math.abs(round.my * 100).toFixed(1).replace(".", ",")} cm ${round.my > 0 ? "dx" : "sx"}`}
                </text>
              ) : null}
              {Math.abs(round.mz - GOLD_HEIGHT) >= 0.005 ? (
                <text x={centreX + (centreX >= gx ? 5 : -5)} y={(gy + centreY) / 2 + 3} textAnchor={centreX >= gx ? "start" : "end"} stroke="#0f1a14" strokeWidth="2.6" strokeDasharray="none" style={{ paintOrder: "stroke" }}>
                  {`${Math.abs((round.mz - GOLD_HEIGHT) * 100).toFixed(1).replace(".", ",")} cm ${round.mz > GOLD_HEIGHT ? "su" : "giù"}`}
                </text>
              ) : null}
            </g>
          ) : null}
          {round.hits.map((hit, i) => (
            <g key={i} className="aa-hit cursor-pointer" style={{ animationDelay: `${450 + flightMs + i * 110}ms` }} onClick={() => setPicked(picked === i ? null : i)}>
              <circle cx={X(hit.y)} cy={Y(hit.z)} r={dot * 3.2} fill="none" stroke="#f4f1ea" strokeWidth="0.8" className="aa-hit-ring" style={{ animationDelay: `${450 + flightMs + i * 110}ms` }} />
              <circle cx={X(hit.y)} cy={Y(hit.z)} r={Math.max(dot, 5)} fill="transparent" />
              {/* coda della freccia vista da dietro: cocca e tre penne, arriva "verso lo schermo" */}
              <g className="aa-ff-arrow" style={{ animationDelay: `${450 + flightMs + i * 110}ms` }}>
                {[0, 120, 240].map((a) => (
                  <path key={a} d={`M${X(hit.y)} ${Y(hit.z)} l${Math.cos(((a - 90) * Math.PI) / 180) * dot * 2.6} ${Math.sin(((a - 90) * Math.PI) / 180) * dot * 2.6}`} stroke={a === 0 ? "#e6b325" : "#d63a2f"} strokeWidth={Math.max(1.4, dot * 0.9)} strokeLinecap="round" />
                ))}
                <circle cx={X(hit.y)} cy={Y(hit.z)} r={dot} fill={picked === i ? "#7cf0a8" : "#14181c"} stroke="#f4f1ea" strokeWidth="0.9" />
              </g>
              {round.hits.length <= 12 ? <text x={X(hit.y) + dot + 1.5} y={Y(hit.z) - dot} fontSize="6.5" fill="#f4f1ea" opacity="0.85">{i + 1}</text> : null}
            </g>
          ))}
          <path d={`M${centreX - 6} ${centreY} H${centreX + 6} M${centreX} ${centreY - 6} V${centreY + 6}`} stroke="#e07a2f" strokeWidth="1.6" />
          {/* mira usata (rombo) → dove arriva (centro gruppo) */}
          <path d={`M${gx} ${aimY - 5} l5 5 l-5 5 l-5 -5 Z`} fill="#f4f1ea" stroke="#14181c" strokeWidth="0.8" opacity="0.85" />
          {/* MIRA QUI: mirino che porta il centro del gruppo sull'oro */}
          {(() => {
            const fx = X(fixY);
            const fy = Y(Math.max(lo, Math.min(hi, fixZ)));
            const rr = 9;
            const far = Math.hypot(fx - gx, fy - gy) > 4;
            return (
              <g>
                {far ? (
                  <line x1={fx} y1={fy} x2={gx} y2={gy} stroke="#7cf0a8" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                ) : null}
                <circle cx={fx} cy={fy} r={rr} fill="none" stroke="#7cf0a8" strokeWidth="1.8" className="aa-pulse" />
                <path d={`M${fx - rr - 5} ${fy} H${fx - 3} M${fx + 3} ${fy} H${fx + rr + 5} M${fx} ${fy - rr - 5} V${fy - 3} M${fx} ${fy + 3} V${fy + rr + 5}`} stroke="#7cf0a8" strokeWidth="1.6" />
                <text x={Math.min(fx + rr + 8, W - pad.r - 52)} y={fy - rr} fill="#7cf0a8" fontSize="10" fontWeight="700" style={{ paintOrder: "stroke" }} stroke="#0f1a14" strokeWidth="3">MIRA QUI</text>
              </g>
            );
          })()}
        </g>
        {/* cornice dell'area */}
        <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="none" stroke="rgba(244,241,234,0.08)" />
      </svg>
      </Zoomable>
      {picked != null && round.hits[picked] ? (() => {
        const h = round.hits[picked];
        const dy = h.y * 100;
        const dz = (h.z - GOLD_HEIGHT) * 100;
        const dist = Math.hypot(dy, dz);
        const clock = Math.round((((Math.atan2(dy, dz) * 180) / Math.PI + 360) % 360) / 30) % 12 || 12;
        return (
          <div className="aa-rise grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-xl border border-hair bg-white/[0.04] p-2.5 text-[0.78rem]">
            <span className="grid h-10 w-10 place-items-center rounded-full font-display text-xl" style={{ background: h.miss ? "#5b6470" : Number(h.zone) >= 9 || h.zone === "X" ? "#e6b325" : Number(h.zone) >= 7 ? "#c4473d" : Number(h.zone) >= 5 ? "#2a6294" : "#1a1c1e", color: Number(h.zone) >= 9 || h.zone === "X" ? "#14181c" : "#f4f1ea" }}>{h.zone}</span>
            <span className="leading-snug">
              <b>Freccia {picked + 1}</b>: a {dist.toFixed(1).replace(".", ",")} cm dal centro, ore {clock}
              <br />
              <span className="text-muted">{Math.abs(dz).toFixed(1).replace(".", ",")} cm {dz >= 0 ? "sopra" : "sotto"} · {Math.abs(dy).toFixed(1).replace(".", ",")} cm a {dy >= 0 ? "destra" : "sinistra"} · arriva in {h.t.toFixed(2).replace(".", ",")} s</span>
            </span>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-full bg-white/5" onClick={() => setPicked(null)} aria-label="Chiudi"><Glyph name="close" size={14} /></button>
          </div>
        );
      })() : <p className="text-center text-[0.68rem] text-muted">Tocca una freccia sul bersaglio per vedere dove è arrivata rispetto al centro.</p>}
      <AimHelp input={input} round={round} sighted={sighted} fixY={fixY} fixZ={fixZ} gold={GOLD_HEIGHT} R={R} />
      <p className="text-center text-[0.68rem] text-muted">
        Frecce: {fmtScore}
        {size ? ` · la faccia copre ${size.moa.toFixed(0)} MOA` : ""}
        {" · "}◆ mira usata · <span style={{ color: "#e07a2f" }}>✚</span> dove arrivano · <span style={{ color: "#7cf0a8" }}>⊕</span> mira giusta
      </p>
    </div>
  );
}

/** Dove mirare, detto a parole: zona e ore del bersaglio, centimetri, e per il mirino di quanto spostarlo. */
function AimHelp({ input, round, sighted, fixY, fixZ, gold, R }: { input: FlightInput; round: RoundView; sighted: boolean; fixY: number; fixZ: number; gold: number; R: number }) {
  const dy = fixY;
  const dz = fixZ - gold;
  const dist = Math.hypot(dy, dz);
  const zones = input.zones === 5 ? 5 : 10;
  const zone = dist >= R ? null : Math.max(1, zones - Math.floor((dist / R) * zones));
  const hour = (() => {
    const deg = (Math.atan2(dy, dz) * 180) / Math.PI;
    return Math.round(((deg + 360) % 360) / 30) % 12 || 12;
  })();
  const where = dist < 0.01
    ? "proprio al centro (sull'oro)"
    : zone != null
      ? `nel ${zones === 5 ? ["", "bianco", "nero", "blu", "rosso", "oro"][zone] ?? zone : zone} a ore ${hour}`
      : `${((dist - R) * 100).toFixed(0)} cm fuori dalla faccia, a ore ${hour}`;
  const cm = (m: number) => `${Math.abs(m * 100).toFixed(0)} cm`;
  // mirino: lo sposti dalla parte in cui vuoi che vadano le frecce; la distanza occhio-mirino ~ 85 cm
  const sightMm = (m: number) => Math.abs((m / Math.max(1, input.distanceM)) * 850).toFixed(1).replace(".", ",");
  const offY = round.my;
  const offZ = round.mz - gold;
  return (
    <div className="grid gap-1.5 rounded-xl border border-[#7cf0a8]/30 bg-[#7cf0a8]/[0.06] p-2.5 text-[0.78rem] leading-snug">
      <p className="flex items-center gap-1.5 font-semibold text-[#7cf0a8]"><Glyph name="crosshair" size={16} />Dove mirare</p>
      {sighted ? (
        <>
          <p>
            Con il mirino sull'oro il gruppo arriva {Math.abs(offZ) < 0.005 ? "in quota" : `${cm(offZ)} ${offZ > 0 ? "alto" : "basso"}`}
            {Math.abs(offY) < 0.005 ? "" : ` e ${cm(offY)} a ${offY > 0 ? "destra" : "sinistra"}`}.
          </p>
          <p>
            Per centrare: <b>mira {where}</b>, oppure sposta il mirino di circa{" "}
            {Math.abs(offZ) >= 0.005 ? <b>{sightMm(offZ)} mm {offZ > 0 ? "in su" : "in giù"}</b> : null}
            {Math.abs(offZ) >= 0.005 && Math.abs(offY) >= 0.005 ? " e " : null}
            {Math.abs(offY) >= 0.005 ? <b>{sightMm(offY)} mm a {offY > 0 ? "destra" : "sinistra"}</b> : null}
            {Math.abs(offZ) < 0.005 && Math.abs(offY) < 0.005 ? <b>niente: sei già centrato</b> : null}
            {" "}(il mirino va dalla stessa parte in cui vanno le frecce).
          </p>
        </>
      ) : (
        <>
          <p>
            Senza mirino tieni la punta della freccia <b>{Math.abs(round.gap) < 0.01 ? "sull'oro" : `${cm(round.gap)} ${round.gap >= 0 ? "sopra" : "sotto"} l'oro`}</b>
            {round.gap > R ? " (sopra la faccia)" : round.gap < -R ? " (sotto la faccia)" : ""}.
          </p>
          <p>
            Con vento e dispersione il gruppo arriva {Math.abs(offZ) < 0.005 ? "in quota" : `${cm(offZ)} ${offZ > 0 ? "alto" : "basso"}`}
            {Math.abs(offY) < 0.005 ? "" : ` e ${cm(offY)} a ${offY > 0 ? "destra" : "sinistra"}`}: per centrare <b>mira {where}</b>.
          </p>
        </>
      )}
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
      <button type="button" onClick={() => void start()} className="min-h-10 w-fit rounded-full border border-line px-3 text-sm"><IconLabel icon="mountain">Misura la pendenza con il telefono</IconLabel></button>
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

type BowId = (typeof BOWS)[number]["id"];
type ReleaseId = (typeof RELEASES)[number]["id"];
type FlightSnapshot = { form: FlightInput; bow: BowId; release: ReleaseId; round: string };
type Composition = FlightSnapshot & { id: string; name: string; note: string; kind: "pronta" | "tua" | "attrezzatura"; use?: string; gearId?: number };

const FLETCH_TO_GEAR: Record<string, string> = { spin: "spin", vane3: "alette", feather3: "penne", feather4: "penne" };

const roundOf = (id: string) => ROUNDS.find((r) => r.id === id) ?? ROUNDS[0];
const preset = (id: string, name: string, note: string, bow: BowId, release: ReleaseId, round: string, part: Partial<FlightInput>): Composition => {
  const b = BOWS.find((x) => x.id === bow) ?? BOWS[0];
  const r = roundOf(round);
  const rel = RELEASES.find((x) => x.id === release) ?? RELEASES[0];
  return {
    id,
    name,
    note,
    kind: "pronta",
    bow,
    release,
    round,
    form: { ...START, eta: b.eta, k: b.k, sighted: b.sighted, lbAt28: bow !== "compound", eyeCm: b.sighted ? 2 : rel.eyeCm, distanceM: r.distanceM, faceCm: r.faceCm, ...part },
  };
};

/** Composizioni pronte: valori tipici per ogni specialità, da cui partire e poi ritoccare. */
const PRESETS: Composition[] = [
  preset("sc", "Scuola · principianti", "20 lb, frecce in alluminio leggere", "recurve", "dita", "18", { drawLb: 20, drawCm: 66, grains: 300, diameterMm: 6, lengthCm: 72, fletch: "vane3", faceCm: 80 }),
  preset("ol18", "Olimpico indoor 18 m", "36 lb, carbonio, spin wing", "recurve", "dita", "18", { drawLb: 36, drawCm: 71, grains: 360, diameterMm: 5, lengthCm: 76, fletch: "spin" }),
  preset("ol70", "Olimpico 70 m", "42 lb, frecce sottili da outdoor", "recurve", "dita", "70", { drawLb: 42, drawCm: 72, grains: 330, diameterMm: 4, lengthCm: 76, fletch: "spin" }),
  preset("co50", "Compound 50 m", "55 lb, sgancio, alette", "compound", "sgancio", "50", { drawLb: 55, drawCm: 71, grains: 340, diameterMm: 5, lengthCm: 74, fletch: "vane3", braceCm: 17 }),
  preset("nu18", "Arco nudo 18 m", "34 lb, tre sotto, freccia pesante", "barebow", "sotto", "18", { drawLb: 34, drawCm: 70, grains: 400, diameterMm: 5.5, lengthCm: 76, fletch: "vane3" }),
  preset("lb", "Longbow in legno", "40 lb, legno e piume naturali", "longbow", "dita", "30", { drawLb: 40, drawCm: 71, grains: 520, diameterMm: 8.5, lengthCm: 79, fletch: "feather3", braceCm: 17 }),
  preset("tr3d", "Tradizionale 3D", "38 lb, ricurvo da caccia, piume", "tradizionale", "dita", "30", { drawLb: 38, drawCm: 70, grains: 460, diameterMm: 7, lengthCm: 78, fletch: "feather3", braceCm: 19 }),
  preset("st", "Storico / a cavallo", "35 lb, pollice o dita, frecce leggere", "tradizionale", "dita", "30", { drawLb: 35, drawCm: 74, grains: 420, diameterMm: 7.5, lengthCm: 80, fletch: "feather3", braceCm: 15 }),
];

const GEAR_BOW: Record<string, BowId> = { ricurvo: "tradizionale", storico: "tradizionale", asiatico: "tradizionale", longbow: "longbow", flatbow: "longbow", nudo: "barebow", olimpico: "recurve", compound: "compound" };
const GEAR_DIAM: Record<string, number> = { carbonio: 5.2, legno: 8.5, alluminio: 6.5, "carbo-alluminio": 5, bambu: 8.5 };

function describeComp(c: FlightSnapshot) {
  return `${c.form.drawLb} lb · ${(c.form.drawCm / 2.54).toFixed(0)}″ · ${c.form.grains} gr · ${c.form.distanceM} m`;
}

function sameComp(a: FlightSnapshot, b: FlightSnapshot) {
  return a.bow === b.bow && a.form.drawLb === b.form.drawLb && a.form.drawCm === b.form.drawCm && a.form.grains === b.form.grains && a.form.distanceM === b.form.distanceM && a.form.diameterMm === b.form.diameterMm;
}

/**
 * Composizioni: pronte, le tue salvate e quelle costruite dalla tua attrezzatura (arco + frecce).
 * Un tocco le applica; "Salva questa" la mette in Attrezzatura come da gara o da allenamento.
 */
function Compositions({ current, onApply }: { current: FlightSnapshot; onApply: (c: FlightSnapshot) => void }) {
  const [mine, setMine] = useState<Composition[]>([]);
  const [fromGear, setFromGear] = useState<Composition[]>([]);
  const [saving, setSaving] = useState(false);
  const [use, setUse] = useState<"gara" | "allenamento" | "entrambi">("allenamento");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function refresh() {
    try {
      const rows = await listEquipment();
      const saved: Composition[] = [];
      const bows = rows.filter((r) => r.mine && r.category === "arco" && Number(r.specs.draw) > 0);
      const arrows = rows.filter((r) => r.mine && r.category === "freccia" && !r.specs.flight && Number(r.specs.weight) > 0);
      for (const row of rows) {
        if (!row.mine || !row.specs.flight) continue;
        try {
          const snap = JSON.parse(row.specs.flight) as FlightSnapshot;
          saved.push({ ...snap, form: { ...START, ...snap.form }, id: `e${row.id}`, gearId: row.id, name: row.name, note: row.specs.use === "gara" ? "Da gara" : row.specs.use === "allenamento" ? "Da allenamento" : "Gara e allenamento", kind: "tua", use: row.specs.use });
        } catch {
          /* voce non leggibile: saltata */
        }
      }
      const built: Composition[] = [];
      for (const b of bows.slice(0, 4)) {
        const bow = GEAR_BOW[b.specs.bowType] ?? "tradizionale";
        const list = arrows.length ? arrows.slice(0, 3) : [null];
        for (const a of list) {
          const base = PRESETS.find((p) => p.bow === bow) ?? PRESETS[1];
          const inch = Number(b.specs.drawLen) || 28;
          built.push({
            ...base,
            id: `g${b.id}-${a?.id ?? 0}`,
            kind: "attrezzatura",
            name: a ? `${b.name} + ${a.name}` : b.name,
            note: "Dalla tua attrezzatura",
            form: {
              ...base.form,
              drawLb: Number(b.specs.draw) || base.form.drawLb,
              drawCm: Math.round(inch * 2.54 * 2) / 2,
              grains: a ? Number(a.specs.weight) : base.form.grains,
              lengthCm: a && Number(a.specs.length) ? Math.round(Number(a.specs.length) * 2.54 * 2) / 2 : base.form.lengthCm,
              diameterMm: a ? GEAR_DIAM[a.specs.material] ?? base.form.diameterMm : base.form.diameterMm,
              fletch: a ? (a.specs.fletchType === "spin" ? "spin" : a.specs.fletchType === "penne" || a.specs.fletchType === "scudo" ? "feather3" : "vane3") : base.form.fletch,
            },
          });
        }
      }
      setMine(saved);
      setFromGear(built);
    } catch {
      /* senza rete restano le composizioni pronte */
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function save() {
    const f = current.form;
    const label = name.trim() || `${(BOWS.find((b) => b.id === current.bow) ?? BOWS[0]).name} ${f.drawLb} lb · ${f.distanceM} m`;
    setBusy(true);
    setErr("");
    try {
      await saveEquipment({
        data: {
          id: null,
          category: "freccia",
          name: label,
          status: "in_use",
          visibility: "personal",
          notes: `Composizione del simulatore: ${describeComp(current)}.`,
          specs: {
            use,
            weight: String(f.grains),
            length: (f.lengthCm / 2.54).toFixed(1),
            draw: String(f.drawLb),
            drawLen: (f.drawCm / 2.54).toFixed(1),
            diameter: String(f.diameterMm),
            fletchType: FLETCH_TO_GEAR[f.fletch] ?? "alette",
            material: "carbonio",
            flight: JSON.stringify(current),
          },
        },
      });
      setSaving(false);
      setName("");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Non salvata");
    } finally {
      setBusy(false);
    }
  }

  const all = [...mine, ...fromGear, ...PRESETS];
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Composizioni</p>
        <button type="button" className="aa-chip" onClick={() => setSaving((v) => !v)}>
          <Glyph name="save" size={14} /> Salva questa
        </button>
      </div>
      {saving ? (
        <div className="aa-rise grid gap-2 rounded-2xl border border-hair bg-white/[0.04] p-2.5">
          <Chips value={use} onChange={setUse} options={[{ id: "gara", label: <IconLabel icon="trophy" size={14}>Da gara</IconLabel> }, { id: "allenamento", label: <IconLabel icon="bow" size={14}>Allenamento</IconLabel> }, { id: "entrambi", label: "Entrambi" }]} />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (facoltativo)" />
            <Button disabled={busy} onClick={() => void save()}>{busy ? "…" : "Salva"}</Button>
          </div>
          <p className="text-[0.68rem] text-muted">Finisce in Attrezzatura tra le frecce, con i valori di volo: la ritrovi qui tra «Le tue».</p>
          {err ? <p className="text-xs text-danger">{err}</p> : null}
        </div>
      ) : null}
      <div className="-mx-3.5 flex snap-x gap-2 overflow-x-auto px-3.5 pb-1 [scrollbar-width:none]">
        {all.map((c, i) => {
          const on = sameComp(c, current);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onApply(c);
                if (navigator.vibrate) navigator.vibrate(8);
              }}
              aria-pressed={on}
              className={`aa-short grid w-[9.2rem] shrink-0 snap-start gap-1.5 rounded-2xl border p-2.5 text-left transition ${on ? "border-primary bg-primary/15" : "border-hair bg-white/[0.03]"}`}
              style={{ animationDelay: `${i * 35}ms` }}
            >
              <span className="flex items-center justify-between">
                <AppIcon name={c.kind === "pronta" ? (c.bow === "compound" ? "gear" : c.bow === "longbow" || c.bow === "tradizionale" ? "quiver" : "bow") : c.kind === "tua" ? (c.use === "gara" ? "trophy" : "save") : "archer"} color={c.kind === "pronta" ? "#55647b" : c.kind === "tua" ? "#c39320" : "#2c8a57"} size={30} />
                <span className="text-[0.58rem] font-semibold uppercase tracking-wider text-muted">{c.kind === "pronta" ? "pronta" : c.kind === "tua" ? "tua" : "attrezzi"}</span>
              </span>
              <span className="line-clamp-2 text-[0.78rem] font-semibold leading-tight">{c.name}</span>
              <span className="text-[0.64rem] tabular-nums text-muted">{describeComp(c)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Riquadro che si apre a tutto schermo (anche in orizzontale, se il telefono lo consente),
 * con il pulsante per rivedere l'animazione del tiro.
 */
function Expand({ title, children, onReplay }: { title: string; children: ReactNode; onReplay?: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = box.current;
    const anyEl = el as (HTMLDivElement & { requestFullscreen?: () => Promise<void> }) | null;
    anyEl?.requestFullscreen?.().catch(() => undefined);
    const orientation = (screen as Screen & { orientation?: { lock?: (o: string) => Promise<void> } }).orientation;
    orientation?.lock?.("landscape").catch(() => undefined);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onFs = () => {
      if (!document.fullscreenElement) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    onReplay?.();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      (screen as Screen & { orientation?: { unlock?: () => void } }).orientation?.unlock?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <div className="relative">
      {children}
      <button type="button" onClick={() => setOpen(true)} aria-label={`${title} a tutto schermo`} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-lg bg-black/55 text-white backdrop-blur">
        <Glyph name="expand" size={15} />
      </button>
      {open ? (
        <div ref={box} className="aa-full fixed inset-0 z-[90] flex flex-col bg-[#0b120e]">
          <div className="flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),10px)] pb-2">
            <p className="font-display text-xl">{title}</p>
            <div className="ml-auto flex gap-2">
              {onReplay ? <button type="button" onClick={onReplay} className="min-h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg"><Glyph name="play" size={13} className="mr-1 inline -translate-y-px" />Rivedi il tiro</button> : null}
              <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-full bg-white/10 px-4 text-sm">Chiudi</button>
            </div>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-2">
            <div className="aa-full-body w-full">{children}</div>
          </div>
          <p className="pb-[max(env(safe-area-inset-bottom),8px)] text-center text-[0.7rem] text-white/50">Gira il telefono in orizzontale per vederlo più grande.</p>
        </div>
      ) : null}
    </div>
  );
}
