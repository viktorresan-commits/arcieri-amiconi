import { Card, Chips } from "@/components/kit";
import { StatusMark } from "@/components/icons";
import { useLocalState } from "@/lib/arcieri/local-store";
import { estimateSpeed } from "@/components/foc-3d";
import { FocBalanceGL } from "@/components/foc-gl";
import { ConvertButton } from "@/components/unit-converter";
import { arrowLookOf, useMainArrowLook } from "@/lib/arcieri/main-gear";
import { useArcherSetup, type ArcherSetup } from "@/lib/arcieri/setup";
import { useLoad } from "@/lib/arcieri/use-load";
import { listEquipment } from "@/lib/arcieri/club.api";
import { arrowPerformance } from "@/lib/arcieri/training.api";
import { ArrowIcon } from "@/components/gear-icons";
import { carbonSpineFor, catalogSpine, GRAINS_PER_G, spineLb, spineUnitOf, weightInfo, woodSpineBand, woodSpineIdeal } from "@/lib/arcieri/arrow-spec";

/**
 * FOC (front of center): di quanto il punto di equilibrio della freccia sta davanti alla metà.
 * Due modi: misurato (lunghezza e punto di equilibrio) o stimato dai pesi dei componenti.
 * Pensato per le aste di legno (asta pesata in grammi, spine in libbre); per carbonio e alluminio
 * l'asta si dà in grani per pollice e lo spine come flessione.
 */
type Store = {
  mode: "misura" | "pesi";
  shaftMat?: "legno" | "carbonio";
  shaftG?: string; // grammi dell'asta nuda (legno)
  totalG?: string; // grammi della freccia finita (modo "Ho misurato")
  len: string; // cm, dalla gola della cocca alla fine dell'asta
  bal: string; // cm, dalla gola della cocca al punto di equilibrio
  gpi: string; // grani per pollice dell'asta (carbonio)
  point: string;
  insert: string;
  fletch: string; // tutte le penne insieme
  nock: string;
  lb: string; // libbre sulle dita (per i grani per libbra)
  grains: string; // peso totale misurato (modo "Ho misurato")
  view: "equilibrio" | "gittata";
  dist: number;
  spine?: string; // spine dell'asta (facoltativo), per il confronto
  setId?: number | null; // serie di frecce analizzata
  lbAuto?: boolean; // libbre prese dall'arco principale
};
// di partenza: freccia di legno da 30″ con asta da 27 g, punta da 125 grani, tre penne naturali da 5″
const DEFAULT: Store = { mode: "pesi", shaftMat: "legno", shaftG: "27", totalG: "", len: "76", bal: "44", gpi: "7,5", point: "125", insert: "0", fletch: "8", nock: "8", lb: "36", grains: "", view: "equilibrio", dist: 30 };
const n = (s: string) => Number(String(s).replace(",", "."));
const f1 = (x: number) => x.toFixed(1).replace(".", ",");
const isWood = (st: Store) => (st.shaftMat ?? "legno") === "legno";
/** grani dell'asta: dal peso in grammi (legno) o dai grani per pollice (carbonio) */
const shaftGrains = (st: Store, L: number) => (isWood(st) ? (n(st.shaftG ?? "") || 0) * GRAINS_PER_G : (n(st.gpi) || 0) * (L / 2.54));

function compute(st: Store) {
  const L = n(st.len);
  if (!(L > 20 && L < 120)) return null;
  if (st.mode === "misura") {
    const B = n(st.bal);
    if (!(B > 0 && B < L)) return null;
    return { L, B, foc: ((B - L / 2) / L) * 100, total: null as number | null };
  }
  const shaft = shaftGrains(st, L);
  // posizioni dalla gola della cocca (cm): cocca, penne, asta a metà, inserto e punta in fondo
  const parts: [number, number][] = [
    [n(st.nock) || 0, 0.6],
    [n(st.fletch) || 0, 6],
    [shaft || 0, L / 2],
    [n(st.insert) || 0, L - 1.6],
    [n(st.point) || 0, L + 0.4],
  ];
  const total = parts.reduce((a, [m]) => a + m, 0);
  if (!(total > 0)) return null;
  const B = parts.reduce((a, [m, x]) => a + m * x, 0) / total;
  return { L, B, foc: ((B - L / 2) / L) * 100, total };
}

export function FocTool() {
  const mainLook = useMainArrowLook();
  const setup = useArcherSetup();
  const [st0, setSt] = useLocalState<Store>("aa-foc-v2", { ...DEFAULT, lbAuto: true });
  const gear = useLoad("foc-arrows", () => listEquipment());
  const sets = (gear.data ?? []).filter((x) => x.mine && x.category === "freccia" && !x.specs.flight).sort((x, y) => (weightInfo(x.specs as Record<string, string>)?.avgG ?? 9999) - (weightInfo(y.specs as Record<string, string>)?.avgG ?? 9999));
  const chosen = sets.find((x) => x.id === st0.setId) ?? null;
  const look = chosen ? arrowLookOf(chosen.specs as Record<string, string>) : mainLook;
  // libbre: quelle reali del tuo arco principale, finché non le cambi a mano
  const st: Store = st0.lbAuto !== false && setup.realLb > 0 ? { ...st0, lb: String(Math.round(setup.realLb)) } : st0;
  const r = compute(st);
  const applySet = (x: (typeof sets)[number], use: "media" | "gara" = "media") => {
    const sp = x.specs as Record<string, string>;
    const lenIn = Number(String(sp.length ?? "").replace(",", ".")) || 0;
    const wi = weightInfo(sp);
    // le frecce da gara, se segnate e pesate, altrimenti la media della serie
    const wG = use === "gara" && wi?.raceMinG != null && wi.raceMaxG != null ? (wi.raceMinG + wi.raceMaxG) / 2 : wi?.avgG ?? 0;
    const pt = Number(sp.point) || Number(st.point) || 125;
    const wood = (sp.material || "legno") === "legno";
    const next: Store = { ...st0, setId: x.id, mode: "pesi", point: String(pt), shaftMat: wood ? "legno" : "carbonio" };
    if (lenIn) next.len = String(Math.round(lenIn * 2.54 * 10) / 10).replace(".", ",");
    if (wG) {
      next.grains = String(Math.round(wG * GRAINS_PER_G));
      next.totalG = f1(wG);
    }
    if (sp.spine) {
      const lb = spineLb(sp.spine, sp.spineUnit, sp.material);
      // nel FOC lo spine si scrive come si misura quell'asta: libbre per il legno, flessione per il carbonio
      next.spine = wood ? (lb ? String(Math.round(lb)) : String(sp.spine)) : spineUnitOf(sp.spine, sp.spineUnit) === "defl" ? String(sp.spine) : lb ? String(catalogSpine(carbonSpineFor(lb) ?? 0)) : "";
    }
    // asta: peso totale meno punta, inserto, penne e cocca
    if (wG) {
      const restGr = wG * GRAINS_PER_G - pt - (n(st.insert) || 0) - (n(st.fletch) || 0) - (n(st.nock) || 0);
      if (restGr > 20) {
        if (wood) next.shaftG = f1(restGr / GRAINS_PER_G);
        else if (lenIn) next.gpi = (restGr / lenIn).toFixed(1).replace(".", ",");
      }
    }
    setSt(next);
  };
  const set = (k: keyof Store) => (e: { target: { value: string } }) => setSt({ ...st0, ...(k === "lb" ? { lbAuto: false } : {}), [k]: e.target.value });
  const verdict = !r ? null : r.foc < 6 ? { s: "warn" as const, t: "Basso: la freccia può essere instabile al vento. Prova una punta più pesante." } : r.foc <= 13 ? { s: "ok" as const, t: "Nella fascia giusta per il tiro alla targa (circa 7–13%)." } : r.foc <= 20 ? { s: "ok" as const, t: "Alto: buono per 3D e campagna, frecce più stabili e penetranti." } : { s: "warn" as const, t: "Molto alto: freccia pesante davanti, cala di più sulle lunghe distanze." };
  const grains = r?.total ?? (n(st.totalG ?? "") > 0 ? n(st.totalG ?? "") * GRAINS_PER_G : n(st.grains));
  const gpp = grains > 0 && n(st.lb) > 0 ? grains / n(st.lb) : null;
  const speed = estimateSpeed(n(st.lb), grains);

  // disegno: la freccia in scala con metà e punto di equilibrio
  const W = 320;
  const x0 = 14;
  const span = W - 40;
  const X = (cm: number) => x0 + (r ? (cm / r.L) * span : 0);

  return (
    <div id="foc" className="grid scroll-mt-20 gap-3">
      <div className="px-1">
        <h2 className="aa-section-title">Calcolo FOC</h2>
        <p className="text-xs text-muted">Quanto la freccia pesa davanti. Scrivi i dati: il risultato si aggiorna e resta salvato.</p>
      </div>
      {sets.length ? (
        <Card className="grid gap-2">
          <p className="aa-section-title">Quale freccia analizzi</p>
          <p className="text-xs text-muted">Le tue serie, dalla più leggera. Un tocco riempie lunghezza, punta, peso e spine.</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {sets.map((x) => {
              const sp = x.specs as Record<string, string>;
              return (
                <button key={x.id} type="button" aria-pressed={st0.setId === x.id} onClick={() => applySet(x)} className={`grid w-40 shrink-0 gap-1 rounded-2xl border p-2 text-left ${st0.setId === x.id ? "border-primary bg-primary/10" : "border-line bg-white/[0.03]"}`}>
                  <ArrowIcon material={sp.material} shaft={sp.shaft} fletch={sp.fletch} cock={sp.cock} nock={sp.nock} wrap={sp.wrap} fletchType={sp.fletchType} fletchStyle={sp.fletchStyle} fletch2={sp.fletch2} point={sp.pointType || "ogiva"} className="h-6 w-full" />
                  <span className="truncate text-[0.78rem] font-semibold">{x.name}</span>
                  <span className="text-[0.66rem] text-muted">{weightInfo(sp) ? `${f1(weightInfo(sp)!.avgG)} g` : "peso ?"}{sp.spine ? ` · ${spineLb(sp.spine, sp.spineUnit, sp.material) ? `${Math.round(spineLb(sp.spine, sp.spineUnit, sp.material)!)} lb` : sp.spine}` : ""}{sp.length ? ` · ${sp.length}″` : ""}</span>
                </button>
              );
            })}
          </div>
          {chosen && weightInfo(chosen.specs as Record<string, string>)?.raceMinG != null ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">Peso usato:</span>
              <button type="button" className="aa-chip" onClick={() => applySet(chosen, "media")}>media della serie</button>
              <button type="button" className="aa-chip" onClick={() => applySet(chosen, "gara")}>frecce da gara ★</button>
            </div>
          ) : null}
        </Card>
      ) : null}
      <WeakArrow onAnalyze={(id) => { const x = sets.find((y) => y.id === id); if (x) applySet(x); }} weights={Object.fromEntries(sets.map((x) => [x.id, weightInfo(x.specs as Record<string, string>)?.avgG ?? 0]))} />
      {setup.has ? <p className="px-1 text-xs text-muted">Il tuo arco: <b className="text-fg">{setup.summary}</b>{st0.lbAuto !== false ? " · libbre usate nei calcoli" : ""}.{st0.lbAuto === false ? <button type="button" className="ml-1 underline" onClick={() => setSt({ ...st0, lbAuto: true })}>Usa le libbre del mio arco</button> : null}</p> : null}
      <div className="grid gap-2">
        <Chips value={st.shaftMat ?? "legno"} onChange={(shaftMat) => setSt({ ...st0, shaftMat, ...(shaftMat === "legno" ? { insert: "0" } : { insert: st0.insert === "0" ? "10" : st0.insert }) })} options={[{ id: "legno", label: "Asta di legno" }, { id: "carbonio", label: "Carbonio o alluminio" }]} />
        <Chips value={st.mode} onChange={(mode) => setSt({ ...st0, mode })} options={[{ id: "pesi", label: "Dai pesi" }, { id: "misura", label: "Ho misurato" }]} />
      </div>
      <Card className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Num label="Lunghezza asta" unit="cm" value={st.len} onChange={set("len")} hint="Dalla gola della cocca" />
          {st.mode === "misura" ? (
            <>
              <Num label="Punto di equilibrio" unit="cm" value={st.bal} onChange={set("bal")} hint="Dalla cocca" />
              <Num label="Peso freccia" unit="g" value={st.totalG ?? ""} onChange={(e) => setSt({ ...st0, totalG: e.target.value, grains: String(Math.round(n(e.target.value) * GRAINS_PER_G) || "") })} hint="Finita, con punta e penne" />
              <Num label="Libbre" unit="lb" value={st.lb} onChange={set("lb")} hint="Sulle dita" />
            </>
          ) : (
            <>
              {isWood(st) ? (
                <Num label="Asta nuda" unit="g" value={st.shaftG ?? ""} onChange={set("shaftG")} hint="Senza punta e penne" />
              ) : (
                <Num label="Asta" unit="gpi" value={st.gpi} onChange={set("gpi")} hint="Grani per pollice" />
              )}
              <Num label="Punta" unit="gr" value={st.point} onChange={set("point")} />
              <Num label={isWood(st) ? "Adattatore" : "Inserto"} unit="gr" value={st.insert} onChange={set("insert")} hint={isWood(st) ? "Se c'è" : undefined} />
              <Num label="Penne (tutte)" unit="gr" value={st.fletch} onChange={set("fletch")} hint={isWood(st) ? "3 naturali da 5″ ≈ 8" : undefined} />
              <Num label="Cocca" unit="gr" value={st.nock} onChange={set("nock")} />
              <Num label="Libbre" unit="lb" value={st.lb} onChange={set("lb")} hint="Sulle dita" />
            </>
          )}
        </div>
      </Card>
      {r ? (
        <Card className="grid gap-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-muted">FOC</p>
              <p key={f1(r.foc)} className="aa-pop font-display text-5xl tabular-nums">{f1(r.foc)}%</p>
            </div>
            <div className="text-right text-xs text-muted">
              <p>Equilibrio a {f1(r.B)} cm</p>
              {r.total ? <p>Peso totale {f1(r.total / GRAINS_PER_G)} g ({Math.round(r.total)} grani)</p> : null}
              {gpp ? <p>{f1(gpp)} grani per libbra</p> : null}
            </div>
          </div>
          <svg viewBox={`0 0 ${W} 70`} className="w-full">
            <rect x={x0} y={33} width={span} height={4} rx={2} fill="#2a2f35" />
            <path d={`M${x0 + 2} 33 l12 -9 h6 l-8 9z M${x0 + 2} 37 l12 9 h6 l-8 -9z`} fill="#d63a2f" />
            <rect x={x0 - 4} y={31.5} width={6} height={7} rx={2} fill="#f2c94c" />
            <path d={`M${x0 + span} 31 l14 4 l-14 4z`} fill="#b9c0c8" />
            <line x1={X(r.L / 2)} x2={X(r.L / 2)} y1={14} y2={56} stroke="currentColor" strokeOpacity={0.45} strokeDasharray="3 3" />
            <text x={X(r.L / 2)} y={10} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity={0.6}>metà</text>
            <g style={{ transform: `translateX(${X(r.B)}px)`, transition: "transform .5s cubic-bezier(.22,1,.36,1)" }}>
              <path d="M0 40 l-7 14 h14z" fill="#7cf0a8" />
              <text y={66} textAnchor="middle" fontSize="9" fill="#7cf0a8">equilibrio</text>
            </g>
            <path d={`M${X(r.L / 2)} 24 H${X(r.B)}`} stroke="#7cf0a8" strokeWidth={2} />
          </svg>
          {verdict ? (
            <p className="text-sm">
              <StatusMark state={verdict.s} />
              {verdict.t}
            </p>
          ) : null}
          {gpp ? <p className="text-xs text-muted">{gpp < 6 ? "Sotto i 6 grani per libbra la freccia è leggera: occhio alla garanzia dei flettenti." : gpp > (isWood(st) ? 12.5 : 9) ? "Freccia pesante per il carico: più stabile, ma cala di più." : "Peso equilibrato per il carico."}</p> : null}
        </Card>
      ) : null}
      {r ? <Analysis st={st} r={r} grains={grains} speed={speed} onSpine={(spine) => setSt({ ...st0, spine })} setup={setup} /> : null}
      {r ? (
        <Card className="grid gap-2.5">
          <p className="aa-section-title">Equilibrio in 3D</p>
          <FocBalanceGL key="eq" L={r.L} B={r.B} foc={r.foc} look={look} />
          <p className="text-[0.7rem] text-muted">Sul fulcro a metà la freccia pende verso la punta: spostandolo fino al punto di equilibrio torna dritta. La distanza tra i due segni è il FOC. La gittata la trovi in alto, nell'analisi balistica in 3D.</p>
        </Card>
      ) : (
        <Card><p className="text-sm text-muted">Inserisci la lunghezza dell'asta (in cm) e i pesi per vedere il risultato.</p></Card>
      )}
      <p className="px-1 text-[0.7rem] text-muted">Il calcolo dai pesi è una stima: per il dato esatto appoggia la freccia finita su un bordo e misura il punto dove sta in equilibrio.</p>
    </div>
  );
}

function Num({ label, unit, value, onChange, hint }: { label: string; unit: string; value: string; onChange: (e: { target: { value: string } }) => void; hint?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted">{label}{hint ? <span className="opacity-70"> · {hint}</span> : null}</span>
      <span className="flex items-center gap-1 rounded-xl border border-hair bg-black/20 px-3">
        <input inputMode="decimal" value={value} onChange={onChange} className="min-h-11 w-full min-w-0 bg-transparent text-base tabular-nums outline-none" />
        <span className="text-xs text-muted">{unit}</span>
        <ConvertButton unit={unit} value={value} onUse={(v) => onChange({ target: { value: v } })} className="ml-1.5" />
      </span>
    </label>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-xl bg-white/[0.05] px-2 py-1.5">
      <span className="block text-[0.6rem] uppercase tracking-wider text-muted">{k}</span>
      <b className="font-display text-lg tabular-nums">{v}</b>
    </span>
  );
}

/** Riepilogo dei numeri della freccia e cosa cambiare per correggerla. */
function Analysis({ st, r, grains, speed, onSpine, setup }: { st: Store; r: { L: number; B: number; foc: number; total: number | null }; grains: number; speed: number; onSpine: (v: string) => void; setup: ArcherSetup }) {
  const lb = n(st.lb);
  const lenIn = r.L / 2.54;
  const point = n(st.point) || 125;
  const gpp = grains > 0 && lb > 0 ? grains / lb : null;
  const mass = grains * 6.48e-5;
  const energy = speed > 0 && grains > 0 ? 0.5 * mass * speed * speed : null;
  const momentum = speed > 0 && grains > 0 ? mass * speed : null;
  const wood = isWood(st);
  // spine in libbre (regola del legno), con l'equivalente in carbonio per chi usa quelle aste
  const spineIdealLb = woodSpineIdeal(lb, lenIn, point || 125);
  const spineMineLb = spineLb(st.spine ?? "", wood ? "lb" : "defl", wood ? "legno" : "carbonio");
  const idealTxt = spineIdealLb ? (wood ? `${woodSpineBand(spineIdealLb)} lb` : `${catalogSpine(carbonSpineFor(spineIdealLb) ?? 0)} (≈ ${Math.round(spineIdealLb)} lb)`) : "—";
  // punta che porta il FOC al 10% (solo dai pesi): risolvo il baricentro con la massa della punta
  let pointFor10: number | null = null;
  if (st.mode === "pesi" && r.total) {
    const L = r.L;
    const shaft = shaftGrains(st, L);
    const parts: [number, number][] = [[n(st.nock) || 0, 0.6], [n(st.fletch) || 0, 6], [shaft || 0, L / 2], [n(st.insert) || 0, L - 1.6]];
    const M = parts.reduce((a, [m]) => a + m, 0);
    const S = parts.reduce((a, [m, x]) => a + m * x, 0);
    const want = L * 0.6;
    const xp = L + 0.4;
    const p = (want * M - S) / (xp - want);
    if (p > 0 && p < 400) pointFor10 = Math.round(p / 5) * 5;
  }
  const tips: { s: "ok" | "warn"; t: string }[] = [];
  if (r.foc < 7) tips.push({ s: "warn", t: pointFor10 ? `FOC basso: con una punta da circa ${pointFor10} grani arrivi al 10%. In alternativa ${wood ? "un adattatore in ottone" : "un inserto più pesante"} o penne più corte.` : `FOC basso: punta più pesante${wood ? "" : " o inserto più pesante"}, oppure penne più leggere.` });
  else if (r.foc > 18) tips.push({ s: "warn", t: pointFor10 ? `FOC alto: per la targa una punta da circa ${pointFor10} grani riporta il FOC al 10%, la freccia cala meno.` : "FOC alto: punta più leggera se tiri alla targa sulle lunghe distanze." });
  else tips.push({ s: "ok", t: "FOC nella fascia buona: niente da cambiare sul peso davanti." });
  if (setup.has) {
    const lenIn2 = r.L / 2.54;
    const room = lenIn2 - setup.drawIn;
    if (room < 0.4) tips.push({ s: "warn", t: `Asta di ${f1(lenIn2)}″ con il tuo allungo di ${f1(setup.drawIn)}″: troppo corta, rischi di tirarla oltre il rest. Serve almeno 1″ in più.` });
    else if (room > 2.5) tips.push({ s: "warn", t: `Asta di ${f1(lenIn2)}″ per un allungo di ${f1(setup.drawIn)}″: ${f1(room)}″ di troppo, la freccia è più pesante e più morbida. Puoi accorciarla a circa ${f1(setup.drawIn + 1)}″.` });
    else tips.push({ s: "ok", t: `Lunghezza giusta per il tuo allungo di ${f1(setup.drawIn)}″ (${f1(room)}″ oltre).` });
    if (setup.grains && grains > 0) {
      const gg = (gr: number) => f1(gr / GRAINS_PER_G);
      if (grains < setup.grains.min) tips.push({ s: "warn", t: `Per il tuo ${setup.summary} il peso consigliato è ${gg(setup.grains.min)}–${gg(setup.grains.max)} g: questa freccia (${gg(grains)} g) è leggera.` });
      else if (grains > setup.grains.max) tips.push({ s: "warn", t: `Per il tuo ${setup.summary} il peso consigliato è ${gg(setup.grains.min)}–${gg(setup.grains.max)} g: questa freccia (${gg(grains)} g) è pesante.` });
    }
    if (setup.spineRange && !spineMineLb) tips.push({ s: "ok", t: `Spine indicato per il tuo arco: ${setup.spineRange}. Scrivilo sotto per il confronto.` });
  }
  if (gpp != null) {
    if (gpp < 6) tips.push({ s: "warn", t: `${f1(gpp)} grani per libbra: troppo leggera per il carico, rischi di danneggiare i flettenti. Sali almeno a ${f1((lb * 6) / GRAINS_PER_G)} g.` });
    else if (gpp > (wood ? 13 : 10)) tips.push({ s: "warn", t: `${f1(gpp)} grani per libbra: molto pesante, traiettoria più curva. ${wood ? "Con le aste di legno di solito si sta tra 8 e 12." : "Per la targa resta tra 6 e 9."}` });
    else tips.push({ s: "ok", t: `${f1(gpp)} grani per libbra: peso adatto al carico.` });
  }
  if (spineIdealLb && spineMineLb) {
    const d = spineMineLb - spineIdealLb;
    const mine = wood ? `${Math.round(spineMineLb)} lb` : `${st.spine} (≈ ${Math.round(spineMineLb)} lb)`;
    if (d < -5) tips.push({ s: "warn", t: `Spine ${mine} più morbido del consigliato (${idealTxt}): con lo sgancio a dita la punta va a sinistra (arciere destro). Punta più leggera, asta più corta o spine più rigido.` });
    else if (d > 7) tips.push({ s: "warn", t: `Spine ${mine} più rigido del consigliato (${idealTxt}): la punta tende a destra (arciere destro). Punta più pesante o asta più lunga lo ammorbidiscono.` });
    else tips.push({ s: "ok", t: `Spine ${mine} in linea con il carico (${idealTxt}).` });
  }
  if (lenIn > 0 && lb > 0 && r.L > 0 && st.mode === "pesi" && n(st.fletch) > 30) tips.push({ s: "warn", t: "Penne pesanti: spostano il baricentro indietro. Penne più corte o spin wing aumentano il FOC e la velocità." });
  return (
    <Card className="grid gap-2.5">
      <p className="aa-section-title">Analisi delle aste</p>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <Mini k="Peso" v={grains > 0 ? `${f1(grains / GRAINS_PER_G)} g` : "—"} />
        <Mini k="Velocità" v={speed > 0 ? `${Math.round(speed)} m/s` : "—"} />
        <Mini k="Energia" v={energy ? `${f1(energy)} J` : "—"} />
        <Mini k="Q. moto" v={momentum ? `${(momentum).toFixed(3).replace(".", ",")}` : "—"} />
        <Mini k="Spine ideale" v={idealTxt} />
        <Mini k="Lunghezza" v={`${lenIn.toFixed(1).replace(".", ",")}″`} />
      </div>
      <label className="grid gap-1">
        <span className="text-xs text-muted">Spine delle tue aste (facoltativo, per il confronto)</span>
        <span className="flex items-center gap-1 rounded-xl border border-hair bg-black/20 px-3">
          <input inputMode="decimal" value={st.spine ?? ""} onChange={(e) => onSpine(e.target.value)} placeholder={wood ? "es. 45 oppure 45-50" : "es. 600"} className="min-h-11 w-full min-w-0 bg-transparent text-base tabular-nums outline-none" />
          <span className="text-xs text-muted">{wood ? "lb" : "flessione"}</span>
        </span>
        {!wood && spineMineLb ? <span className="text-[0.7rem] text-muted">Circa {Math.round(spineMineLb)} lb (31,5 ÷ flessione in pollici).</span> : null}
      </label>
      <ul className="grid gap-1.5">
        {tips.map((tip) => (
          <li key={tip.t} className="flex gap-2 rounded-xl bg-white/[0.04] px-2.5 py-2 text-sm leading-snug">
            <StatusMark state={tip.s} />
            <span>{tip.t}</span>
          </li>
        ))}
      </ul>
      <p className="text-[0.68rem] text-muted">Stime per archi tradizionali e ricurvi a dita. Spine in libbre con la regola del legno: libbre sulle dita, +5 lb per pollice oltre i 28″, +5 lb ogni 25 grani di punta oltre i 125. La prova vera resta l'asta nuda (senza penne).</p>
    </Card>
  );
}

/**
 * La freccia che rende meno, dai tiri numerati: media più bassa, gruppo spostato rispetto alle
 * compagne o più sparpagliata. Dice cosa controllare e porta l'analisi su quella serie.
 */
function WeakArrow({ onAnalyze, weights }: { onAnalyze: (setId: number) => void; weights: Record<number, number> }) {
  const perf = useLoad("arrow-perf", () => arrowPerformance());
  const rows = perf.data ?? [];
  if (!rows.length) return null;
  const bySet = new Map<number | null, typeof rows>();
  for (const r of rows) bySet.set(r.setId, [...(bySet.get(r.setId) ?? []), r]);
  type Cand = { r: (typeof rows)[number]; setAvg: number; dx: number; dy: number; spreadK: number; bad: number };
  const cands: Cand[] = [];
  for (const list of bySet.values()) {
    if (list.length < 3) continue;
    const tot = list.reduce((a, x) => a + x.n, 0);
    const avg = list.reduce((a, x) => a + x.avg * x.n, 0) / tot;
    const mx = list.reduce((a, x) => a + (x.mx ?? 0) * x.n, 0) / tot;
    const my = list.reduce((a, x) => a + (x.my ?? 0) * x.n, 0) / tot;
    const sp = list.reduce((a, x) => a + (x.spread ?? 0) * x.n, 0) / tot || 0.0001;
    for (const r of list) {
      if (r.n < 5) continue;
      const others = (avg * tot - r.avg * r.n) / Math.max(1, tot - r.n);
      const dx = (r.mx ?? mx) - mx;
      const dy = (r.my ?? my) - my;
      const spreadK = (r.spread ?? sp) / sp;
      const bad = Math.max(0, others - r.avg) * 4 + Math.max(0, Math.hypot(dx, dy) - 0.04) * 3 + Math.max(0, spreadK - 1.25);
      if (bad > 0.12) cands.push({ r, setAvg: others, dx, dy, spreadK, bad });
    }
  }
  cands.sort((a, b) => b.bad - a.bad);
  const top = cands.slice(0, 2);
  if (!top.length) {
    return (
      <Card className="grid gap-1">
        <p className="aa-section-title">Le tue frecce numerate</p>
        <p className="text-sm"><StatusMark state="ok" />Nessuna freccia si comporta peggio delle altre: le serie sono omogenee.</p>
      </Card>
    );
  }
  const dir = (dx: number, dy: number) => {
    const v = dy > 0.03 ? "in basso" : dy < -0.03 ? "in alto" : "";
    const o = dx > 0.03 ? "a destra" : dx < -0.03 ? "a sinistra" : "";
    return [v, o].filter(Boolean).join(" ");
  };
  return (
    <Card className="grid gap-2.5">
      <p className="aa-section-title">Freccia da controllare</p>
      {top.map(({ r, setAvg, dx, dy, spreadK }) => {
        const where = dir(dx, dy);
        const w = r.setId != null ? weights[r.setId] : 0;
        return (
          <div key={`${r.setId}-${r.tag}`} className="grid gap-1.5 rounded-2xl bg-white/[0.04] p-3">
            <p className="text-sm font-semibold">Freccia n. {r.tag}{r.setName ? ` · ${r.setName}` : ""}</p>
            <p className="text-xs text-muted">
              {Math.round(r.avg * 100)}% del punteggio massimo contro {Math.round(setAvg * 100)}% delle compagne ({r.n} tiri)
              {where ? `; cade ${where} rispetto al gruppo` : ""}
              {spreadK > 1.25 ? `; più sparpagliata (×${spreadK.toFixed(1).replace(".", ",")})` : ""}.
            </p>
            <ul className="grid gap-0.5 text-xs">
              {where ? <li>• Rotolala su un tavolo: se oscilla è storta (un gruppo spostato sempre dallo stesso lato è il segnale tipico).</li> : null}
              <li>• Cocca: crepata, storta o ruotata? Sostituiscila e allineala come le altre.</li>
              <li>• Penne: staccate, piegate o con la colla rovinata.</li>
              <li>• Punta ben incollata e dritta (sul legno controlla anche che la conicità non sia spaccata).</li>
              <li>• Pesala: deve stare entro mezzo grammo dalle altre{w ? ` (serie da ${f1(w)} g)` : ""}; con lo spine diverso va tolta dalla serie.</li>
            </ul>
            {r.setId != null ? <button type="button" onClick={() => onAnalyze(r.setId as number)} className="justify-self-start rounded-full border border-line px-3 py-1.5 text-xs font-semibold">Analizza questa serie</button> : null}
          </div>
        );
      })}
    </Card>
  );
}
