import { useState } from "react";
import { Segmented } from "@/components/kit";
import { ConvertButton } from "@/components/unit-converter";
import { tagsOf } from "@/lib/arcieri/arrow-tags";
import {
  carbonSpineFor,
  catalogSpine,
  packArrowWeights,
  parseArrowWeights,
  parseRace,
  pickRace,
  spineLb,
  spineUnitOf,
  weightInfo,
  woodSpineBand,
  type SpineUnit,
} from "@/lib/arcieri/arrow-spec";

type Specs = Record<string, string>;
type SetSpec = (k: string, v: string) => void;

const g1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
const numIn = (s: string) => Number(String(s).replace(",", "."));

/**
 * Spine delle frecce in libbre (aste di legno) o come flessione (carbonio e alluminio): la conversione
 * la fa l'app, con le formule dei due metodi di misura.
 */
export function SpineField({ specs, set }: { specs: Specs; set: SetSpec }) {
  const raw = specs.spine ?? "";
  const unit: SpineUnit = (specs.spineUnit as SpineUnit) || (raw ? spineUnitOf(raw) : "lb");
  const lb = spineLb(raw, unit, specs.material);
  const switchTo = (u: SpineUnit) => {
    if (u === unit) return;
    // il valore scritto si converte nell'altra unità, così non si perde
    // (per il legno la flessione è quella misurata su 26″, per carbonio e alluminio su 28″)
    if (lb) set("spine", u === "lb" ? String(Math.round(lb)) : specs.material === "legno" ? String(Math.round((26 / lb) * 1000)) : String(catalogSpine(carbonSpineFor(lb) ?? 0)));
    set("spineUnit", u);
  };
  const carbonEq = lb ? catalogSpine(carbonSpineFor(lb) ?? 0) : null;
  return (
    <div className="grid gap-1.5 rounded-xl border border-line bg-white/[0.03] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Spine</span>
        <Segmented value={unit} onChange={switchTo} options={[{ id: "lb", label: "Libbre" }, { id: "defl", label: "Flessione" }]} />
      </div>
      <span className="flex items-center gap-1 rounded-xl border border-hair bg-black/20 px-3">
        <input
          inputMode="decimal"
          aria-label={unit === "lb" ? "Spine in libbre" : "Spine come flessione"}
          value={raw}
          onChange={(e) => {
            set("spine", e.target.value);
            if (!specs.spineUnit) set("spineUnit", unit);
          }}
          placeholder={unit === "lb" ? "es. 45 oppure 45-50" : "es. 600"}
          className="min-h-11 w-full min-w-0 bg-transparent text-base tabular-nums outline-none"
        />
        <span className="shrink-0 text-xs text-muted">{unit === "lb" ? "lb" : "millesimi"}</span>
      </span>
      <p className="text-xs text-muted">
        {!raw
          ? "In libbre come per le aste di legno (45, 45-50…). Se hai aste di carbonio scegli Flessione e scrivi il numero stampato sull'asta (500, 600…): le libbre le calcolo io."
          : !lb
            ? "Numero non riconosciuto: libbre tra 10 e 150, flessione tra 200 e 2000."
            : unit === "lb"
              ? `Fascia ${woodSpineBand(lb)} lb. In carbonio corrisponde a un ${carbonEq} circa.`
              : `Circa ${Math.round(lb)} lb (fascia ${woodSpineBand(lb)}): ${specs.material === "legno" ? "26" : "31,5"} ÷ flessione in pollici.`}
      </p>
    </div>
  );
}

/**
 * Peso delle frecce in grammi: uguale per tutte, da… a…, oppure una per una. Con i pesi singoli si
 * scelgono le frecce da gara (le più simili tra loro), da tenere da parte in allenamento.
 */
export function ArrowWeights({ specs, set }: { specs: Specs; set: SetSpec }) {
  const mode = (specs.weightMode as "uguale" | "fascia" | "singole") || (specs.arrowsG ? "singole" : specs.weightMinG ? "fascia" : "uguale");
  const tags = tagsOf(JSON.stringify(specs));
  const from = tags[0] ?? 1;
  const each = parseArrowWeights(specs.arrowsG);
  const race = parseRace(specs.race);
  const info = weightInfo(specs);
  // testo scritto nei pesi singoli (per non perdere la virgola mentre si scrive "26,")
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const legacyGrains = !specs.weightG && Number(specs.weight) > 0 ? Number(specs.weight) : 0;
  const setEach = (i: number, v: string) => {
    const list = tags.map((_, k) => each[k] ?? null);
    const x = numIn(v);
    list[i] = x > 0 ? x : null;
    set("arrowsG", packArrowWeights(list));
    setDrafts((d) => ({ ...d, [i]: v }));
  };
  const toggleRace = (t: number) => {
    const next = race.includes(t) ? race.filter((x) => x !== t) : [...race, t].sort((a, b) => a - b);
    set("race", next.join(","));
  };
  const auto = (k: number) => {
    const list = tags.map((t, i) => ({ tag: t, g: each[i] ?? 0 }));
    set("race", pickRace(list, k).join(","));
  };
  const draftOf = (i: number, v: number | null | undefined) => {
    const d = drafts[i];
    if (d != null && (numIn(d) === v || (!d.trim() && v == null) || /[,.]$/.test(d))) return d;
    return v != null ? String(v).replace(".", ",") : "";
  };
  const weighed = each.filter((x) => x != null && x > 0).length;
  const spread = info && info.each ? info.maxG - info.minG : 0;
  const raceSpread = info?.raceMinG != null && info.raceMaxG != null ? info.raceMaxG - info.raceMinG : null;
  return (
    <div className="grid gap-2 rounded-xl border border-line bg-white/[0.03] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Peso</span>
        <Segmented value={mode} onChange={(m) => set("weightMode", m)} options={[{ id: "uguale", label: "Uguale" }, { id: "fascia", label: "Da… a…" }, { id: "singole", label: "Una per una" }]} />
      </div>
      {mode === "uguale" ? (
        <GramInput label="Peso di una freccia" value={specs.weightG ?? (legacyGrains ? g1(legacyGrains / 15.4324) : "")} onChange={(v) => set("weightG", v)} />
      ) : null}
      {mode === "fascia" ? (
        <div className="grid grid-cols-2 gap-2">
          <GramInput label="La più leggera" value={specs.weightMinG ?? ""} onChange={(v) => set("weightMinG", v)} />
          <GramInput label="La più pesante" value={specs.weightMaxG ?? ""} onChange={(v) => set("weightMaxG", v)} />
        </div>
      ) : null}
      {mode === "singole" ? (
        <>
          <p className="text-xs text-muted">Pesa ogni freccia (anche solo alcune) e tocca la stella per segnare quelle da gara.</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {tags.map((t, i) => {
              const on = race.includes(t);
              return (
                <div key={t} className={`flex items-center gap-1.5 rounded-xl border px-1.5 py-1 ${on ? "border-accent bg-accent/10" : "border-hair bg-black/20"}`}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.08] font-display text-sm tabular-nums">{t}</span>
                  <input
                    inputMode="decimal"
                    aria-label={`Peso della freccia ${t} in grammi`}
                    value={draftOf(i, each[i])}
                    onChange={(e) => setEach(i, e.target.value)}
                    placeholder="g"
                    className="min-h-9 w-full min-w-0 bg-transparent text-base tabular-nums outline-none"
                  />
                  <button type="button" aria-pressed={on} aria-label={on ? `Togli la freccia ${t} da quelle da gara` : `Segna la freccia ${t} da gara`} onClick={() => toggleRace(t)} className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg ${on ? "text-accent" : "text-muted"}`}>
                    {on ? "★" : "☆"}
                  </button>
                </div>
              );
            })}
          </div>
          {weighed >= 3 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">Le più simili per la gara:</span>
              {[3, 4, 6].filter((k) => k <= weighed).map((k) => (
                <button key={k} type="button" className="aa-chip" onClick={() => auto(k)}>{k} frecce</button>
              ))}
              {race.length ? <button type="button" className="aa-chip" onClick={() => set("race", "")}>Nessuna</button> : null}
            </div>
          ) : null}
        </>
      ) : null}
      {mode !== "singole" ? (
        <div className="grid gap-1">
          <span className="text-xs text-muted">Frecce da gara (facoltativo): quelle che tieni da parte</span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <button key={t} type="button" aria-pressed={race.includes(t)} onClick={() => toggleRace(t)} className="aa-chip min-w-10 justify-center tabular-nums">{race.includes(t) ? "★ " : ""}{t}</button>
            ))}
          </div>
        </div>
      ) : null}
      {info ? (
        <p className="text-xs">
          Media <b className="tabular-nums">{g1(info.avgG)} g</b> ({Math.round(info.avgG * 15.4324)} grani)
          {info.maxG - info.minG >= 0.05 ? <>, da {g1(info.minG)} a {g1(info.maxG)} g</> : null}
          {race.length ? <>. Gara: n. {race.join(", ")}{raceSpread != null ? ` (scarto ${g1(raceSpread)} g)` : ""}</> : null}.
        </p>
      ) : null}
      {spread > 1 && (!race.length || (raceSpread ?? 9) > 0.5) ? (
        <p className="text-xs text-muted">Tra la più leggera e la più pesante ci sono {g1(spread)} g: a 18 m la differenza si vede in altezza. Per la gara tieni insieme quelle più vicine di peso.</p>
      ) : null}
    </div>
  );
}

function GramInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-center gap-1 rounded-xl border border-hair bg-black/20 px-3">
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="26,5" className="min-h-11 w-full min-w-0 bg-transparent text-base tabular-nums outline-none" />
        <span className="text-xs text-muted">g</span>
        <ConvertButton unit="g" value={value} onUse={onChange} className="ml-1.5" />
      </span>
    </label>
  );
}
