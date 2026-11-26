import { createFileRoute } from "@tanstack/react-router";
import { ToolArt } from "@/components/tool-art";
import { Card, Chips, PageHead } from "@/components/kit";
import { Num, Mini, num, fmt } from "@/components/tool-kit";
import { useLocalState } from "@/lib/arcieri/local-store";
import { useArcherSetup } from "@/lib/arcieri/setup";
import { grainsFor, realLb, spineLbFor } from "@/lib/arcieri/gear-advice";
import { carbonSpineFor, catalogSpine, deflectionIn, GRAINS_PER_G, woodSpineBand } from "@/lib/arcieri/arrow-spec";
import { ToolChart, type ChartSeries } from "@/components/tool-chart";

export const Route = createFileRoute("/_app/spine")({ component: Page });

/** Libbre reali al tuo allungo, spine e peso freccia consigliati (regole pratiche da verificare sul paglione). */
type Store = { bowType: string; draw: string; drawLen: string; arrowLen: string; point?: string; conv?: string; convUnit?: "lb" | "carbonio" | "legno" };
const TYPES = [
  { id: "olimpico", label: "Olimpico" },
  { id: "nudo", label: "Nudo" },
  { id: "ricurvo", label: "Ricurvo" },
  { id: "longbow", label: "Longbow" },
  { id: "storico", label: "Storico" },
  { id: "compound", label: "Compound" },
];

function Page() {
  const archer = useArcherSetup();
  const [st, setSt] = useLocalState<Store>("aa-spine-v1", { bowType: "olimpico", draw: "34", drawLen: "28", arrowLen: "29" });
  const bow = { bowType: st.bowType, draw: String(num(st.draw) || ""), drawLen: String(num(st.drawLen) || "") };
  const lb = realLb(bow);
  const spineLbV = spineLbFor(bow, num(st.arrowLen) || undefined, num(st.point ?? "") || 125);
  const carbonEq = spineLbV ? carbonSpineFor(spineLbV) : null;
  const gr = grainsFor(bow);
  const diff = lb - (num(st.draw) || 0);
  const draws = Array.from({ length: 17 }, (_, i) => 24 + i * 0.5);
  const curves: ChartSeries[] = [
    { name: "Libbre reali", color: "#7cf0a8", unit: "lb", points: draws.map((x) => ({ x, y: realLb({ ...bow, drawLen: String(x) }) || 0 })) },
    { name: "Scritte", color: "#9aa7b2", unit: "lb", dashed: true, points: draws.map((x) => ({ x, y: num(st.draw) || 0 })) },
  ];
  return (
    <div className="grid gap-3">
      <PageHead kicker="Prepara" title="Spine e libbre" lede="Le libbre scritte sui flettenti valgono a 28″: al tuo allungo cambiano. Da qui spine e peso freccia di partenza." />
      <ToolArt id="spine" />
      {archer.has ? (
        <button type="button" onClick={() => setSt({ bowType: TYPES.some((t) => t.id === archer.bowType) ? archer.bowType : "olimpico", draw: String(archer.lb), drawLen: String(archer.drawIn), arrowLen: String(archer.arrow.lengthIn || archer.drawIn + 1) })} className="justify-self-start rounded-full border border-line px-3 py-1.5 text-xs font-semibold">
          Usa il mio arco: {archer.summary}
        </button>
      ) : null}
      <Chips value={st.bowType} onChange={(bowType) => setSt({ ...st, bowType })} options={TYPES} />
      <Card className="grid grid-cols-2 gap-2">
        <Num label="Libbre scritte" unit="lb" value={st.draw} onChange={(draw) => setSt({ ...st, draw })} hint="a 28″" />
        <Num label="Il tuo allungo" unit="pollici" value={st.drawLen} onChange={(drawLen) => setSt({ ...st, drawLen })} />
        <Num label="Lunghezza freccia" unit="pollici" value={st.arrowLen} onChange={(arrowLen) => setSt({ ...st, arrowLen })} />
        <Num label="Punta" unit="grani" value={st.point ?? "125"} onChange={(point) => setSt({ ...st, point })} />
      </Card>
      {lb ? (
        <Card className="grid gap-3">
          <div className="grid grid-cols-3 gap-1.5">
            <Mini k="Libbre reali" v={`${fmt(lb, 1)} lb`} />
            <Mini k="Spine" v={spineLbV ? `${woodSpineBand(spineLbV)} lb` : "—"} tone="ok" />
            <Mini k="Peso freccia" v={gr ? `${fmt(gr.min / GRAINS_PER_G, 0)}–${fmt(gr.max / GRAINS_PER_G, 0)} g` : "—"} />
          </div>
          <div className="grid gap-1">
            <div className="flex justify-between text-[0.7rem] text-muted"><span>20 lb</span><span>60 lb</span></div>
            <div className="relative h-3 rounded-full bg-gradient-to-r from-sky-500/40 via-emerald-400/40 to-rose-500/40">
              <span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow transition-[left] duration-500" style={{ left: `${Math.min(100, Math.max(0, ((lb - 20) / 40) * 100))}%` }} />
            </div>
          </div>
          {st.bowType !== "compound" ? <ToolChart title="Libbre al variare dell'allungo" series={curves} xLabel="pollici" yLabel="lb" marker={{ x: num(st.drawLen) || 28, label: `il tuo allungo: ${st.drawLen}″` }} fmtX={(x) => `${x}″`} /> : null}
          <p className="text-sm">
            {st.bowType === "compound"
              ? "Sul compound le libbre si regolano con i flettenti: l'allungo non le cambia."
              : diff === 0
                ? "Al tuo allungo tiri esattamente le libbre scritte."
                : `Al tuo allungo tiri ${fmt(Math.abs(diff), 1)} lb ${diff > 0 ? "in più" : "in meno"} di quelle scritte (circa 2 lb per pollice).`}
          </p>
          {spineLbV ? <p className="text-xs text-muted">Aste di legno: {woodSpineBand(spineLbV)} lb{carbonEq ? `; in carbonio o alluminio una flessione di circa ${catalogSpine(carbonEq)}` : ""}. Peso freccia {gr ? `${gr.min}–${gr.max} grani` : ""}. Regola usata: libbre reali sulle dita, +5 lb per ogni pollice di freccia oltre i 28″, +5 lb ogni 25 grani di punta oltre i 125.</p> : null}
          <p className="text-[0.7rem] text-muted">Valori di partenza: confermali con la tabella del produttore delle aste e con la prova dell'asta nuda.</p>
        </Card>
      ) : (
        <Card><p className="text-sm text-muted">Scrivi le libbre dei flettenti.</p></Card>
      )}
      <SpineConverter st={st} setSt={setSt} />
    </div>
  );
}

/**
 * Convertitore dello spine: libbre (aste di legno, 2 lb su 26″) e flessione delle aste di
 * carbonio o alluminio (1,94 lb su 28″). Libbre = 26 ÷ flessione a 26″ = 31,5 ÷ flessione a 28″.
 */
function SpineConverter({ st, setSt }: { st: Store; setSt: (s: Store) => void }) {
  const unit = st.convUnit ?? "lb";
  const v = st.conv ?? "";
  const x = num(v);
  let lb: number | null = null;
  if (unit === "lb" && x > 5) lb = x;
  if (unit !== "lb") {
    const d = deflectionIn(v);
    if (d > 0.1 && d < 3) lb = (unit === "legno" ? 26 : 31.5) / d;
  }
  const carbon = lb ? catalogSpine(carbonSpineFor(lb) ?? 0) : null;
  const woodDefl = lb ? Math.round((26 / lb) * 1000) : null;
  return (
    <Card className="grid gap-2.5">
      <p className="aa-section-title">Convertitore dello spine</p>
      <Chips value={unit} onChange={(convUnit) => setSt({ ...st, convUnit })} options={[{ id: "lb", label: "Ho le libbre" }, { id: "carbonio", label: "Ho il carbonio (500, 600…)" }, { id: "legno", label: "Flessione del legno" }]} />
      <Num label={unit === "lb" ? "Spine in libbre" : "Flessione"} unit={unit === "lb" ? "lb" : "millesimi"} value={v} onChange={(conv) => setSt({ ...st, conv })} hint={unit === "carbonio" ? "metodo 28″" : unit === "legno" ? "metodo 26″" : undefined} />
      {lb ? (
        <div className="grid grid-cols-3 gap-1.5">
          <Mini k="Libbre" v={`${fmt(lb, 0)} lb`} tone="ok" />
          <Mini k="Carbonio" v={carbon ? String(carbon) : "—"} />
          <Mini k="Legno 26″" v={woodDefl ? `0,${String(woodDefl).padStart(3, "0")}` : "—"} />
        </div>
      ) : (
        <p className="text-xs text-muted">Scrivi un valore: libbre tra 10 e 150, flessione tra 200 e 2000.</p>
      )}
      <p className="text-[0.7rem] text-muted">Legno: 2 lb al centro di 26″, libbre = 26 ÷ flessione. Carbonio e alluminio: 1,94 lb al centro di 28″, libbre ≈ 31,5 ÷ flessione (un 500 vale circa 63 lb).</p>
    </Card>
  );
}
