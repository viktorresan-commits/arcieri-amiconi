import { createFileRoute } from "@tanstack/react-router";
import { Card, Chips, PageHead } from "@/components/kit";
import { Num, Mini, num, fmt } from "@/components/tool-kit";
import { useLocalState } from "@/lib/arcieri/local-store";
import { grainsFor, realLb, spineFor } from "@/lib/arcieri/gear-advice";

export const Route = createFileRoute("/_app/spine")({ component: Page });

/** Libbre reali al tuo allungo, spine e peso freccia consigliati (regole pratiche da verificare sul paglione). */
type Store = { bowType: string; draw: string; drawLen: string; arrowLen: string };
const TYPES = [
  { id: "olimpico", label: "Olimpico" },
  { id: "nudo", label: "Nudo" },
  { id: "ricurvo", label: "Ricurvo" },
  { id: "longbow", label: "Longbow" },
  { id: "storico", label: "Storico" },
  { id: "compound", label: "Compound" },
];

function Page() {
  const [st, setSt] = useLocalState<Store>("aa-spine-v1", { bowType: "olimpico", draw: "34", drawLen: "28", arrowLen: "29" });
  const bow = { bowType: st.bowType, draw: String(num(st.draw) || ""), drawLen: String(num(st.drawLen) || "") };
  const lb = realLb(bow);
  const spine = spineFor(bow, num(st.arrowLen) || undefined);
  const gr = grainsFor(bow);
  const diff = lb - (num(st.draw) || 0);
  return (
    <div className="grid gap-3">
      <PageHead kicker="Strumenti" title="Spine e libbre" lede="Le libbre scritte sui flettenti valgono a 28″: al tuo allungo cambiano. Da qui spine e peso freccia di partenza." />
      <Chips value={st.bowType} onChange={(bowType) => setSt({ ...st, bowType })} options={TYPES} />
      <Card className="grid grid-cols-2 gap-2">
        <Num label="Libbre scritte" unit="lb" value={st.draw} onChange={(draw) => setSt({ ...st, draw })} hint="a 28″" />
        <Num label="Il tuo allungo" unit="pollici" value={st.drawLen} onChange={(drawLen) => setSt({ ...st, drawLen })} />
        <Num label="Lunghezza freccia" unit="pollici" value={st.arrowLen} onChange={(arrowLen) => setSt({ ...st, arrowLen })} />
      </Card>
      {lb ? (
        <Card className="grid gap-3">
          <div className="grid grid-cols-3 gap-1.5">
            <Mini k="Libbre reali" v={`${fmt(lb, 1)} lb`} />
            <Mini k="Spine" v={spine || "—"} tone="ok" />
            <Mini k="Peso freccia" v={gr ? `${gr.min}–${gr.max} gr` : "—"} />
          </div>
          <div className="grid gap-1">
            <div className="flex justify-between text-[0.7rem] text-muted"><span>20 lb</span><span>60 lb</span></div>
            <div className="relative h-3 rounded-full bg-gradient-to-r from-sky-500/40 via-emerald-400/40 to-rose-500/40">
              <span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow transition-[left] duration-500" style={{ left: `${Math.min(100, Math.max(0, ((lb - 20) / 40) * 100))}%` }} />
            </div>
          </div>
          <p className="text-sm">
            {st.bowType === "compound"
              ? "Sul compound le libbre si regolano con i flettenti: l'allungo non le cambia."
              : diff === 0
                ? "Al tuo allungo tiri esattamente le libbre scritte."
                : `Al tuo allungo tiri ${fmt(Math.abs(diff), 1)} lb ${diff > 0 ? "in più" : "in meno"} di quelle scritte (circa 2 lb per pollice).`}
          </p>
          <p className="text-[0.7rem] text-muted">Valori di partenza: confermali con la tabella del produttore delle aste e con la prova dell'asta nuda.</p>
        </Card>
      ) : (
        <Card><p className="text-sm text-muted">Scrivi le libbre dei flettenti.</p></Card>
      )}
    </div>
  );
}
