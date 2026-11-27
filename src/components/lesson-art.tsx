import { useState, type ReactNode } from "react";
import { ArcherAvatar } from "./archer-avatar";
import { ToolArt } from "./tool-art";
import type { AvatarLook, Pose } from "@/lib/arcieri/avatar";
import { AvatarScene } from "./avatar-hero";

const Q = "#ffd27a";
const G = "#7cf0a8";
const L = "#e8e4da";

function Note({ x, y, children, anchor = "start" }: { x: number; y: number; children: ReactNode; anchor?: "start" | "end" | "middle" }) {
  return (
    <text x={x} y={y} fill={Q} fontSize="11" fontWeight="700" textAnchor={anchor} stroke="#0b120e" strokeWidth="3" style={{ paintOrder: "stroke" }}>
      {children}
    </text>
  );
}

/** Note disegnate sopra l'arciere (stesse coordinate del disegno). */
const OVERLAY: Record<string, ReactNode> = {
  postura: (
    <g>
      <line x1="148" y1="52" x2="148" y2="340" stroke={G} strokeWidth="1.6" strokeDasharray="5 4" />
      <path d="M100 344 L196 344" stroke={Q} strokeWidth="2" markerStart="url(#la-a)" markerEnd="url(#la-a)" />
      <Note x={148} y={346 - 14} anchor="middle">piedi larghi come le spalle</Note>
      <Note x={154} y={48}>testa sopra il bacino</Note>
      <Note x={60} y={250}>peso 50/50</Note>
    </g>
  ),
  presa: (
    <g>
      <circle cx="246" cy="119" r="17" fill="none" stroke={G} strokeWidth="2" />
      <circle cx="166" cy="104" r="14" fill="none" stroke={G} strokeWidth="2" />
      <Note x={246} y={160} anchor="middle">mano aperta, spinge</Note>
      <Note x={176} y={142} anchor="middle">1 dito sopra, 2 sotto</Note>
    </g>
  ),
  ancoraggio: (
    <g>
      <circle cx="166" cy="102" r="13" fill="none" stroke={G} strokeWidth="2" />
      <line x1="88" y1="116" x2="290" y2="116" stroke={G} strokeWidth="1.2" strokeDasharray="4 4" opacity="0.8" transform="rotate(-6.8 166 104)" />
      <path d="M118 150 C112 140 104 132 94 126" stroke={Q} strokeWidth="1.6" fill="none" markerEnd="url(#la-a)" />
      <Note x={120} y={164} anchor="middle">trazione con la schiena</Note>
      <Note x={174} y={66} anchor="start">corda su mento e naso</Note>
    </g>
  ),
  rilascio: (
    <g>
      <path d="M150 112 C132 120 118 124 102 124" stroke={Q} strokeWidth="2.2" fill="none" markerEnd="url(#la-a)" />
      <path d="M260 104 L312 104" stroke={G} strokeWidth="2.2" markerEnd="url(#la-a)" />
      <Note x={100} y={146} anchor="middle">la mano scivola indietro</Note>
      <Note x={286} y={92} anchor="middle">l'arco resta sul bersaglio</Note>
    </g>
  ),
  respiro: (
    <g>
      <ellipse cx="148" cy="150" rx="30" ry="34" fill={G} opacity="0.12" stroke={G} strokeWidth="1.4" />
      <path d="M60 40 C80 20 100 20 120 40 C140 60 160 60 180 40 C200 20 220 20 240 40" stroke={Q} strokeWidth="2" fill="none" />
      <Note x={70} y={64}>inspira</Note>
      <Note x={160} y={64}>espira metà</Note>
      <Note x={238} y={64} anchor="end">tieni</Note>
    </g>
  ),
};

function Frame({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-[#101a15]">
      <svg viewBox="0 0 320 160" className="block w-full" role="img" aria-label={caption}>
        <defs>
          <marker id="lc-a" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill={Q} /></marker>
        </defs>
        {children}
      </svg>
      {caption ? <figcaption className="border-t border-line px-3 py-2 text-xs text-muted">{caption}</figcaption> : null}
    </figure>
  );
}

/**
 * La visuale dell'arciere (Analisi gesto › «Mira»), da un tiro vero a 18 m con l'ancoraggio alla bocca:
 * nel tiro istintivo si guarda il centro, nella mira con la punta si mette la punta sul punto del gap.
 */
function MiraPaglione() {
  const [k, setK] = useState<"istintivo" | "punta">("istintivo");
  const pics = {
    istintivo: { src: "/lezioni/mira-istintivo.webp", text: "Tiro istintivo a 18 m: guardi il centro del bersaglio. La punta della freccia resta di lato, in basso: non la guardi." },
    punta: { src: "/lezioni/mira-punta.webp", text: "Mira con la punta a 18 m: la punta va circa 1,2 m sotto l'oro (il gap di questa distanza). L'asta intanto punta 67 cm sopra: la freccia sale e ricade sul centro." },
  } as const;
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-[#101a15]">
      <div className="flex gap-1 p-2" role="group" aria-label="Come si mira">
        {([["istintivo", "Tiro istintivo"], ["punta", "Con la punta"]] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={k === id} onClick={() => setK(id)} className={`min-h-9 rounded-full px-3 text-xs font-semibold ${k === id ? "bg-[#f4f1ea] text-[#14181c]" : "bg-white/10 text-[#f4f1ea]"}`}>
            {label}
          </button>
        ))}
      </div>
      <img src={pics[k].src} alt={pics[k].text} width={540} height={750} loading="lazy" className="block h-auto w-full" />
      <figcaption className="border-t border-line px-3 py-2 text-xs text-muted">{pics[k].text} Arco da 30 lb e frecce da 330 grani: con il tuo arco i numeri cambiano, li vedi in Analisi gesto con «Mira».</figcaption>
    </figure>
  );
}

const CUSTOM: Record<string, ReactNode> = {
  "mira-paglione": <MiraPaglione />,
  sicurezza: (
    <Frame caption="Linea di tiro, linea d'attesa e fischi del direttore di tiro.">
      <rect x="0" y="0" width="320" height="160" fill="#4f7340" />
      <line x1="20" y1="110" x2="300" y2="110" stroke="#f4f1ea" strokeWidth="3" />
      <line x1="20" y1="140" x2="300" y2="140" stroke="#f4f1ea" strokeWidth="2" strokeDasharray="8 6" />
      <text x="24" y="104" fill="#f4f1ea" fontSize="10" fontWeight="700">linea di tiro</text>
      <text x="24" y="134" fill="#f4f1ea" fontSize="10">linea d'attesa</text>
      {[60, 160, 260].map((x) => (
        <g key={x} transform={`translate(${x} 34)`}>
          <rect x="-16" y="-14" width="32" height="30" rx="2" fill="#c9a46a" />
          <circle r="11" fill="#f4f1ea" /><circle r="8" fill="#2a6294" /><circle r="5" fill="#c4473d" /><circle r="2.5" fill="#e6b325" />
        </g>
      ))}
      <g fontSize="10" fontWeight="700">
        <rect x="190" y="66" width="122" height="38" rx="8" fill="#0b120e" opacity="0.75" />
        <text x="200" y="80" fill={Q}>●● alla linea · ● tirate</text>
        <text x="200" y="96" fill={Q}>●●● recupero · ●●●●● stop</text>
      </g>
    </Frame>
  ),
  parti: (
    <Frame caption="Le parti dell'arco olimpico.">
      <path d="M150 64 C152 40 140 22 134 12 C131 6 136 2 142 4" stroke="#15191d" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M150 96 C152 120 140 138 134 148 C131 154 136 158 142 156" stroke="#15191d" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="145" y="58" width="11" height="44" rx="4" fill="#2f6fbe" />
      <line x1="134" y1="12" x2="134" y2="148" stroke={L} strokeWidth="1" />
      <path d="M156 92 L230 94" stroke="#1d2126" strokeWidth="3" />
      <path d="M156 66 L176 54 L176 42" stroke="#9aa3ad" strokeWidth="1.6" fill="none" />
      <circle cx="176" cy="40" r="3" fill="none" stroke="#e3a21a" strokeWidth="1.6" />
      <rect x="152" y="76" width="7" height="3" fill="#9aa3ad" />
      {[
        [158, 30, 210, 22, "flettente"],
        [156, 80, 210, 74, "rest e bottone"],
        [151, 62, 60, 60, "riser"],
        [134, 120, 60, 124, "corda"],
        [180, 40, 230, 40, "mirino"],
        [214, 94, 250, 116, "stabilizzatore"],
      ].map(([x1, y1, x2, y2, t]) => (
        <g key={String(t)}>
          <line x1={Number(x1)} y1={Number(y1)} x2={Number(x2)} y2={Number(y2)} stroke={Q} strokeWidth="1" />
          <circle cx={Number(x1)} cy={Number(y1)} r="2" fill={Q} />
          <text x={Number(x2) + (Number(x2) < Number(x1) ? -4 : 4)} y={Number(y2) + 4} fill={Q} fontSize="10.5" fontWeight="700" textAnchor={Number(x2) < Number(x1) ? "end" : "start"}>{String(t)}</text>
        </g>
      ))}
    </Frame>
  ),
  mente: (
    <Frame caption="La routine: sempre le stesse fasi, nello stesso ordine, a ogni freccia.">
      {["piedi", "aggancio", "alza", "schiena", "mira", "rilascio"].map((t, i) => {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const x = 160 + Math.cos(a) * 58;
        const y = 80 + Math.sin(a) * 58;
        return (
          <g key={t}>
            <circle cx={x} cy={y} r="18" fill="#2f8f6a" opacity="0.9" />
            <text x={x} y={y + 3.5} fill="#0b120e" fontSize="9" fontWeight="800" textAnchor="middle">{t}</text>
          </g>
        );
      })}
      <circle cx="160" cy="80" r="26" fill="none" stroke={Q} strokeWidth="1.4" strokeDasharray="4 4" />
      <text x="160" y="84" fill={Q} fontSize="10" fontWeight="700" textAnchor="middle">respiro</text>
    </Frame>
  ),
  distanze: (
    <Frame caption="Dividi la distanza in tratti da 5 m e confronta con oggetti noti. In pendenza conta la distanza orizzontale.">
      <rect x="0" y="0" width="320" height="160" fill="#2e4a26" />
      <path d="M0 120 L320 60 L320 160 L0 160 Z" fill="#4f7340" />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const x = 30 + i * 46;
        const y = 120 - (x / 320) * 60;
        return (
          <g key={i}>
            <line x1={x} y1={y} x2={x} y2={y - 8} stroke="#f4f1ea" strokeWidth="2" />
            <text x={x} y={y + 14} fill="#f4f1ea" fontSize="9" textAnchor="middle">{i * 5} m</text>
          </g>
        );
      })}
      <g transform="translate(280 56)">
        <ellipse cx="0" cy="0" rx="16" ry="9" fill="#8a6a3c" />
        <circle cx="13" cy="-6" r="5" fill="#8a6a3c" />
        <circle cx="2" cy="0" r="3" fill={G} />
      </g>
      <line x1="30" y1="120" x2="280" y2="120" stroke={Q} strokeWidth="1.4" strokeDasharray="5 4" />
      <text x="160" y="140" fill={Q} fontSize="10" fontWeight="700" textAnchor="middle">distanza orizzontale (quella da mirare)</text>
    </Frame>
  ),
  statistiche: (
    <Frame caption="Prima la costanza, poi la media: un gruppo stretto si sposta sul centro con il mirino.">
      <g transform="translate(90 80)">
        {[50, 40, 30, 20, 10].map((r, i) => <circle key={r} r={r} fill={["#f4f1ea", "#1a1c1e", "#2a6294", "#c4473d", "#e6b325"][i]} />)}
        {[[18, -14], [22, -10], [16, -8], [20, -16]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="3" fill={G} stroke="#0b120e" />)}
      </g>
      <path d="M160 40 L220 40 L240 70 L270 56 L300 30" stroke={Q} strokeWidth="2.2" fill="none" />
      <text x="230" y="100" fill={Q} fontSize="10" fontWeight="700" textAnchor="middle">media che sale</text>
      <text x="90" y="150" fill={G} fontSize="10" fontWeight="700" textAnchor="middle">gruppo stretto</text>
    </Frame>
  ),
};

/** Illustrazione di una lezione: l'arciere con le note, oppure un disegno dedicato. */
export function LessonArt({ art, look, compact = false }: { art: string; look: AvatarLook; compact?: boolean }) {
  // l'arciere in una posa ("pose:mira") o mentre esegue tutta la sequenza ("seq")
  if (art === "seq" || art.startsWith("pose:")) {
    const pose = art === "seq" ? "animata" : (art.slice(5) as Pose);
    return <AvatarScene look={{ ...look, routine: "completa" }} pose={pose} height={compact ? "h-28" : "h-72"} phase={art === "seq" && !compact} interactive={!compact} />;
  }
  if (OVERLAY[art]) {
    return (
      <div className={`aa-avatar-stage relative ${compact ? "h-28" : "h-72"}`}>
        <div className="absolute inset-0 flex justify-center">
          <div className="relative h-full">
            <ArcherAvatar look={look} className="h-full w-auto" interactive={false} />
            {compact ? null : (
              <svg viewBox="40 0 300 350" className="absolute inset-0 h-full w-full" aria-hidden>
                <defs>
                  <marker id="la-a" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill={Q} /></marker>
                </defs>
                {OVERLAY[art]}
              </svg>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (CUSTOM[art]) return <>{CUSTOM[art]}</>;
  return <ToolArt id={art} />;
}
