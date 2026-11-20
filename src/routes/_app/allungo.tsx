import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHead } from "@/components/kit";
import { Num, Mini, num, fmt } from "@/components/tool-kit";
import { useLocalState } from "@/lib/arcieri/local-store";

export const Route = createFileRoute("/_app/allungo")({ component: Page });

/** Allungo stimato dall'apertura delle braccia (÷2,5), e lunghezza d'arco consigliata. */
function Page() {
  const [st, setSt] = useLocalState<{ span: string }>("aa-allungo-v1", { span: "175" });
  const cm = num(st.span);
  const inch = cm / 2.54 / 2.5;
  const ok = cm > 100 && cm < 230;
  const bow = inch < 24 ? "62–64″" : inch < 26 ? "64–66″" : inch < 28 ? "66–68″" : inch < 29.5 ? "68–70″" : "70–72″";
  const arrow = inch + 1;
  return (
    <div className="grid gap-3">
      <PageHead kicker="Strumenti" title="Allungo" lede="Braccia aperte, schiena al muro: misura da punta a punta del dito medio." />
      <Card className="grid gap-3">
        <Num label="Apertura delle braccia" unit="cm" value={st.span} onChange={(span) => setSt({ span })} />
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
        <p className="text-[0.7rem] text-muted">È una stima: l'allungo vero si misura all'ancoraggio con una freccia graduata, meglio con l'istruttore.</p>
      </Card>
    </div>
  );
}
