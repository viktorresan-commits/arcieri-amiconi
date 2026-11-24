import { createFileRoute } from "@tanstack/react-router";
import { Card, Chips, PageHead, Segmented } from "@/components/kit";
import { AvatarFace, shade } from "@/components/archer-avatar";
import { useAvatar } from "@/components/avatar-hero";
import { useEntryState } from "@/lib/arcieri/back-restore";
import type { AvatarLook } from "@/lib/arcieri/avatar";
import { TempiBody } from "./tempi";
import { realLb } from "@/lib/arcieri/gear-advice";
import { Num, Mini, num, fmt } from "@/components/tool-kit";
import { useLocalState } from "@/lib/arcieri/local-store";

export const Route = createFileRoute("/_app/allungo")({ component: Page });

/** Allungo stimato dall'apertura delle braccia (÷2,5), e lunghezza d'arco consigliata; dentro anche il tempo di allungo. */
function Page() {
  const [view, setView] = useEntryState<"misura" | "tempo">("allungo-vista", "misura");
  return (
    <div className="grid gap-3">
      <PageHead kicker="Strumenti" title="Allungo" lede={view === "tempo" ? "Dall'inizio della trazione al rilascio. Più è costante, più il tiro è ripetibile." : "Braccia aperte, schiena al muro: misura da punta a punta del dito medio."} />
      <Segmented value={view} onChange={setView} options={[{ id: "misura", label: "Misura l'allungo" }, { id: "tempo", label: "Tempo di allungo" }]} />
      {view === "tempo" ? <TempiBody embedded /> : <Measure />}
    </div>
  );
}

/**
 * Il tuo arciere a braccia aperte contro il muro: stessi colori di pelle, maglia, maniche e pantaloni
 * scelti nell'avatar; la quota sotto segue l'apertura scritta.
 */
function SpanFigure({ look, cm, ok }: { look: AvatarLook; cm: number; ok: boolean }) {
  const skin = look.skin;
  const shirt = look.shirt;
  const sleeve = look.sleeves || look.shirt;
  const pants = look.pants;
  const out = "#1b130d";
  // braccia più o meno lunghe con l'apertura (fra 140 e 210 cm)
  const reach = ok ? Math.max(96, Math.min(128, 96 + ((cm - 140) / 70) * 32)) : 112;
  const L = 160 - reach;
  const R = 160 + reach;
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-[#101a15]">
      <div className="relative">
      <svg viewBox="0 0 320 170" className="block w-full" role="img" aria-label="Il tuo arciere a braccia aperte, con la misura dell'apertura">
        <line x1={L - 6} y1="10" x2={L - 6} y2="160" stroke="#6f7f76" strokeWidth="3" />
        <text x={L - 2} y="20" fill="#9fb3a8" fontSize="9">muro</text>
        {/* gambe e scarpe */}
        <path d="M150 118 L146 150 M170 118 L174 150" stroke={out} strokeWidth="13" strokeLinecap="round" />
        <path d="M150 118 L146 150 M170 118 L174 150" stroke={pants} strokeWidth="10.6" strokeLinecap="round" />
        <ellipse cx="143" cy="153" rx="8" ry="3.6" fill={look.shoes} stroke={out} strokeWidth="0.9" />
        <ellipse cx="177" cy="153" rx="8" ry="3.6" fill={look.shoes} stroke={out} strokeWidth="0.9" />
        {/* braccia aperte: maniche e mani */}
        <path d={`M${L + 4} 66 L${R - 4} 66`} stroke={out} strokeWidth="11.4" strokeLinecap="round" />
        <path d={`M${L + 4} 66 L${R - 4} 66`} stroke={skin} strokeWidth="9" strokeLinecap="round" />
        <path d={`M${160 - reach * 0.55} 66 L${160 + reach * 0.55} 66`} stroke={sleeve} strokeWidth="10.4" strokeLinecap="butt" />
        <path d={`M${160 - reach * 0.55} 61 V71 M${160 + reach * 0.55} 61 V71`} stroke={look.trim} strokeWidth="1.6" />
        <circle cx={L + 3} cy="66" r="5" fill={skin} stroke={out} strokeWidth="1" />
        <circle cx={R - 3} cy="66" r="5" fill={skin} stroke={out} strokeWidth="1" />
        {/* busto */}
        <path d="M144 60 C146 58 174 58 176 60 L174 120 L146 120 Z" fill={shirt} stroke={out} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M152 60 Q160 70 168 60" stroke={look.trim} strokeWidth="2" fill="none" />
        <rect x="145" y="104" width="30" height="5" rx="1.5" fill={look.beltColor || shade(pants, -0.3)} stroke={out} strokeWidth="0.8" />
        {/* collo */}
        <rect x="155" y="50" width="10" height="10" fill={shade(skin, -0.15)} />
        {/* quota dell'apertura */}
        <path d={`M${L - 6} 86 H${R + 2} M${L - 6} 80 V92 M${R + 2} 80 V92`} stroke="#7cf0a8" strokeWidth="1.6" />
        <text x="160" y="100" textAnchor="middle" fontSize="12" fontWeight="700" fill="#7cf0a8">{ok ? `${fmt(cm, 0)} cm` : "—"}</text>
        <text x="160" y="167" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#e0b15a">allungo ≈ apertura ÷ 2,5 (in pollici)</text>
      </svg>
      {/* la testa è quella dell'avatar */}
      <div className="pointer-events-none absolute" style={{ left: "43.5%", width: "13%", top: "12.6%" }}>
        <AvatarFace look={look} bare className="h-auto w-full" />
      </div>
      </div>
      <figcaption className="px-3 pb-2.5 text-[0.72rem] leading-snug text-muted">Il tuo arciere, braccia aperte e schiena al muro: si misura da punta a punta del dito medio. La stima si conferma all'arco con una freccia lunga segnata.</figcaption>
    </figure>
  );
}

function Measure() {
  const { shown } = useAvatar();
  const [st, setSt] = useLocalState<{ span: string; lb: string; measured: string; bowType: string }>("aa-allungo-v1", { span: "175", lb: "32", measured: "", bowType: "olimpico" });
  const cm = num(st.span);
  const inch = cm / 2.54 / 2.5;
  const ok = cm > 100 && cm < 230;
  const bow = inch < 24 ? "62–64″" : inch < 26 ? "64–66″" : inch < 28 ? "66–68″" : inch < 29.5 ? "68–70″" : "70–72″";
  const arrow = inch + 1;
  return (
    <div className="grid gap-3">
      <SpanFigure look={shown} cm={cm} ok={ok} />
      <Card className="grid gap-3">
        <Num label="Apertura delle braccia" unit="cm" value={st.span} onChange={(span) => setSt({ ...st, span })} />
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
            </>
          );
        })()}
      </Card>
    </div>
  );
}
