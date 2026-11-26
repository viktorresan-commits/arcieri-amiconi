import { createFileRoute } from "@tanstack/react-router";
import { Card, Chips, PageHead, Segmented } from "@/components/kit";
import { ArcherFront, frontScale } from "@/components/archer-front";
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
      <PageHead kicker="Prepara" title="Allungo" lede={view === "tempo" ? "Dall'inizio della trazione al rilascio. Più è costante, più il tiro è ripetibile." : "Braccia aperte, schiena al muro: misura da punta a punta del dito medio."} />
      <Segmented value={view} onChange={setView} options={[{ id: "misura", label: "Misura l'allungo" }, { id: "tempo", label: "Tempo di allungo" }]} />
      {view === "tempo" ? <TempiBody embedded /> : <Measure />}
    </div>
  );
}

/**
 * Il tuo arciere a braccia aperte contro il muro: è lo stesso avatar di fronte (viso, abiti, statura),
 * con le proporzioni vere: l'apertura delle braccia è circa quanto l'altezza. Le braccia si allungano
 * o si accorciano con l'apertura scritta; la quota va dal muro alla punta del dito medio.
 */
function SpanFigure({ look, cm, ok }: { look: AvatarLook; cm: number; ok: boolean }) {
  // figura alta ~350 unità per ~175 cm: mezza apertura in unità ≈ apertura in cm
  const half = ok ? Math.max(140, Math.min(215, cm)) : 175;
  const k = frontScale(look);
  const at = (x: number, y: number) => ({ x: 100 + (x - 100) * k, y: 360 + (y - 360) * k });
  const left = at(100 - half, 110);
  const right = at(100 + half, 110);
  const top = at(100, -10).y;
  const x0 = left.x - 30;
  const x1 = Math.max(right.x + 14, 100 + 130);
  const vb = `${x0.toFixed(1)} ${(top - 6).toFixed(1)} ${(x1 - x0).toFixed(1)} ${(374 - top).toFixed(1)}`;
  const lineY = at(100, 132).y;
  // il numero sotto il braccio destro, sul fondo: non copre la maglia
  const labelX = at(100 + half * 0.62, 0).x;
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-[#101a15]">
      <div className="relative">
        <ArcherFront look={look} armsOut={half} crop={vb} className="block h-auto w-full" />
        <svg viewBox={vb} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          {/* muro dietro la schiena: le dita toccano il muro */}
          <line x1={left.x - 4} y1={top} x2={left.x - 4} y2="362" stroke="#6f7f76" strokeWidth="5" />
          <text x={left.x + 4} y={top + 16} fill="#9fb3a8" fontSize="14">muro</text>
          {/* quota dell'apertura, dal muro alla punta del dito medio */}
          <path d={`M${left.x - 4} ${lineY} H${right.x} M${left.x - 4} ${lineY - 9} V${lineY + 9} M${right.x} ${lineY - 9} V${lineY + 9}`} stroke="#7cf0a8" strokeWidth="2.4" />
          <rect x={labelX - 36} y={lineY + 6} width="72" height="24" rx="6" fill="#101a15" opacity="0.85" />
          <text x={labelX} y={lineY + 23.5} textAnchor="middle" fontSize="18" fontWeight="700" fill="#7cf0a8">{ok ? `${fmt(cm, 0)} cm` : "—"}</text>
        </svg>
      </div>
      <p className="px-3 pt-1.5 text-center text-[0.78rem] font-bold text-[#e0b15a]">allungo ≈ apertura ÷ 2,5 (in pollici)</p>
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
