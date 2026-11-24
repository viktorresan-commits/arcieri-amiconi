import { createFileRoute, Link } from "@tanstack/react-router";
import { ToolArt } from "@/components/tool-art";
import { Card, Chips, PageHead } from "@/components/kit";
import { realLb } from "@/lib/arcieri/gear-advice";
import { Num, Mini, num, fmt } from "@/components/tool-kit";
import { useLocalState } from "@/lib/arcieri/local-store";

export const Route = createFileRoute("/_app/allungo")({ component: Page });

/** Allungo stimato dall'apertura delle braccia (÷2,5), e lunghezza d'arco consigliata. */
function Page() {
  const [st, setSt] = useLocalState<{ span: string; lb: string; measured: string; bowType: string }>("aa-allungo-v1", { span: "175", lb: "32", measured: "", bowType: "olimpico" });
  const cm = num(st.span);
  const inch = cm / 2.54 / 2.5;
  const ok = cm > 100 && cm < 230;
  const bow = inch < 24 ? "62–64″" : inch < 26 ? "64–66″" : inch < 28 ? "66–68″" : inch < 29.5 ? "68–70″" : "70–72″";
  const arrow = inch + 1;
  return (
    <div className="grid gap-3">
      <PageHead kicker="Strumenti" title="Allungo" lede="Braccia aperte, schiena al muro: misura da punta a punta del dito medio." />
      <ToolArt id="allungo" />
      <Card className="grid gap-3">
        <Num label="Apertura delle braccia" unit="cm" value={st.span} onChange={(span) => setSt({ ...st, span })} />
        <svg viewBox="0 0 300 120" className="w-full">
          <line x1="20" y1="40" x2="280" y2="40" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" />
          <circle cx="150" cy="22" r="13" fill="#e0b08a" />
          <rect x="135" y="40" width="30" height="45" rx="6" fill="var(--primary)" />
          <path d="M140 85 l-8 32 M160 85 l8 32" stroke="#9aa3ad" strokeWidth="8" strokeLinecap="round" />
          <path d="M20 60 H280 M20 54 V66 M280 54 V66" stroke="#7cf0a8" strokeWidth="1.6" />
          <text x="150" y="76" textAnchor="middle" fontSize="12" fill="#7cf0a8">{ok ? `${fmt(cm, 0)} cm` : "—"}</text>
        </svg>
        {ok ? (
          <div className="grid grid-cols-3 gap-1.5">
            <Mini k="Allungo" v={`${fmt(inch, 1)}″`} tone="ok" />
            <Mini k="In cm" v={fmt(inch * 2.54, 0)} />
            <Mini k="Arco (AMO)" v={bow} />
          </div>
        ) : null}
        {ok ? <p className="text-sm">Freccia di partenza: circa {fmt(arrow, 1)}″ (un pollice oltre l'allungo, per sicurezza).</p> : null}
        <p className="text-[0.7rem] text-muted">È una stima: l'allungo vero si misura all'ancoraggio con una freccia graduata, meglio con l'allenatore.</p>
      </Card>
      <Card className="grid gap-3">
        <p className="aa-section-title">L'arco al tuo allungo</p>
        <Chips value={st.bowType} onChange={(bowType) => setSt({ ...st, bowType })} options={[{ id: "olimpico", label: "Olimpico" }, { id: "nudo", label: "Nudo" }, { id: "ricurvo", label: "Ricurvo" }, { id: "longbow", label: "Longbow" }, { id: "compound", label: "Compound" }]} />
        <div className="grid grid-cols-2 gap-2">
          <Num label="Libbre scritte" unit="lb" value={st.lb} onChange={(lb) => setSt({ ...st, lb })} hint="a 28″" />
          <Num label="Allungo misurato" unit="pollici" value={st.measured} onChange={(measured) => setSt({ ...st, measured })} hint="se lo sai" />
        </div>
        {(() => {
          const drawIn = num(st.measured) > 15 ? num(st.measured) : ok ? inch : 0;
          if (!drawIn || !(num(st.lb) > 0)) return <p className="text-sm text-muted">Scrivi le libbre dei flettenti.</p>;
          const real = realLb({ bowType: st.bowType, draw: String(num(st.lb)), drawLen: drawIn.toFixed(1) });
          const diff = real - num(st.lb);
          return (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                <Mini k="Allungo usato" v={`${fmt(drawIn, 1)}″`} />
                <Mini k="Libbre reali" v={`${fmt(real, 1)} lb`} tone="ok" />
                <Mini k="In kg" v={fmt(real * 0.4536, 1)} />
              </div>
              <p className="text-sm">
                {st.bowType === "compound"
                  ? "Sul compound l'allungo si regola sulle camme: le libbre restano quelle impostate."
                  : Math.abs(diff) < 0.3
                    ? "Al tuo allungo tiri le libbre scritte."
                    : `Tiri ${fmt(Math.abs(diff), 1)} lb ${diff > 0 ? "in più" : "in meno"} di quelle scritte: circa 2 lb per ogni pollice sopra o sotto i 28″.`}
              </p>
              <Link to="/tempi" className="aa-chip justify-self-start">Misura anche il tempo di allungo</Link>
            </>
          );
        })()}
      </Card>
    </div>
  );
}
