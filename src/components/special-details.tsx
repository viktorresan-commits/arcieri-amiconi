/**
 * Dettagli degli abiti su misura (lib/arcieri/special-looks): disegnati solo quando l'aspetto porta
 * quell'abito. Di fronte e di profilo, con il tratto definito del resto dell'avatar.
 */
import { CompanyCrest } from "./avatar-extras";
import type { AvatarLook } from "@/lib/arcieri/avatar";
import { DemonFrontLeg, DemonFrontTorso, DemonSideTorso, demonOf } from "./demon-costume";

const f = (n: number) => n.toFixed(1);
const OUTL = "#160f0a";

/** bandoliera bianca a tracolla con il medaglione della compagnia */
function Baldric({ a, b, crest, s = 1 }: { a: [number, number]; b: [number, number]; crest?: string; s?: number }) {
  const m: [number, number] = [a[0] + (b[0] - a[0]) * 0.3, a[1] + (b[1] - a[1]) * 0.3];
  const d = `M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])}`;
  return (
    <g pointerEvents="none">
      <path d={d} stroke={OUTL} strokeOpacity="0.85" strokeWidth={7.4 * s} strokeLinecap="round" />
      <path d={d} stroke="#efe9dc" strokeWidth={5.6 * s} strokeLinecap="round" />
      <path d={d} stroke="#c9bfae" strokeWidth={0.6 * s} strokeDasharray={`${2 * s} ${1.6 * s}`} transform={`translate(${-1.6 * s} 0)`} />
      <g transform={`translate(${f(m[0])} ${f(m[1])})`}>
        <ellipse rx={9.4 * s} ry={10.6 * s} fill="#6b5a3a" stroke={OUTL} strokeWidth={1 * s} />
        <ellipse rx={8 * s} ry={9.2 * s} fill="#f4efe2" />
        <CompanyCrest id={crest} x={0} y={0.4 * s} s={0.55 * s} />
      </g>
    </g>
  );
}

/** davanti, sul busto (sopra la veste) */
export function SpecialFrontTorso({ look, cx, sh, hip, layer = "under", uid = "sp" }: { look: AvatarLook; cx: number; sh: { l: number; r: number }; hip: { l: number; r: number }; /** "over": sopra le braccia (la pellegrina copre spalle e braccia) */ layer?: "under" | "over"; uid?: string }) {
  if (demonOf(look)) return <DemonFrontTorso look={look} cx={cx} sh={sh} hip={hip} layer={layer} />;
  if (look.special === "simone-medievale" && look.style === "medievale") {
    // la bandoliera intera sta sotto le braccia; sopra, la pellegrina e il tratto di bandoliera che la attraversa
    if (layer !== "over") return <Baldric a={[sh.r - 7, 100]} b={[hip.l + 4, 200]} crest={look.crest} />;
    if (!look.cowl) return <Baldric a={[sh.r - 7, 100]} b={[hip.l + 4, 200]} crest={look.crest} />;
    const c = look.cowlColor || "#5a4632";
    const lo = "#3a2c1e";
    const hi = "#7a6448";
    // pellegrina di lana: scende dalle spalle fin sopra il gomito e sul petto a punta morbida; orlo irregolare
    const L = sh.l - 15;
    const R = sh.r + 15;
    const hem = `C${L - 1} 128 ${L + 1} 146 ${L + 4} 156 L${L + 9} 153 L${L + 13} 159 Q${cx - 22} 166 ${cx - 9} 168 L${cx} 172 L${cx + 9} 168 Q${cx + 22} 166 ${R - 13} 159 L${R - 9} 153 L${R - 4} 156 C${R - 1} 146 ${R + 1} 128 ${R} 110`;
    const d = `M${L} 110 ${hem} C${R - 6} 98 ${sh.r - 4} 92 ${cx + 12} 92 Q${cx} 96 ${cx - 12} 92 C${sh.l + 4} 92 ${L + 6} 98 ${L} 110 Z`;
    return (
      <g pointerEvents="none">
        <path d={d} fill={lo} transform="translate(0 2)" opacity="0.5" />
        <path d={d} fill={c} stroke={OUTL} strokeWidth="1.2" strokeLinejoin="round" />
        {/* pieghe che scendono dalle spalle e luce sulla lana */}
        <path d={`M${L + 8} 116 Q${L + 6} 136 ${L + 9} 152 M${sh.l + 8} 112 Q${sh.l + 6} 136 ${sh.l + 10} 160 M${cx - 10} 104 Q${cx - 12} 134 ${cx - 7} 164 M${cx + 10} 104 Q${cx + 12} 134 ${cx + 7} 164 M${sh.r - 8} 112 Q${sh.r - 6} 136 ${sh.r - 10} 160 M${R - 8} 116 Q${R - 6} 136 ${R - 9} 152`} stroke={lo} strokeOpacity="0.75" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path d={`M${L + 5} 112 Q${sh.l} 100 ${cx - 14} 97 M${R - 5} 112 Q${sh.r} 100 ${cx + 14} 97`} stroke={hi} strokeOpacity="0.55" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <clipPath id={`${uid}pel`}><path d={d} /></clipPath>
        <g clipPath={`url(#${uid}pel)`}><Baldric a={[sh.r - 7, 100]} b={[hip.l + 4, 200]} crest={look.crest} /></g>
      </g>
    );
  }
  if (layer !== "under") return null;
  if (look.special === "simone-inverno" && look.top === "giacca") {
    return (
      <g pointerEvents="none">
        {/* softshell: cerniera lunga, colletto alto con il sotto blu notte, cappuccio raccolto dietro il collo */}
        <path d={`M${cx - 9} 100 Q${cx} 108 ${cx + 9} 100 L${cx + 7} 94 Q${cx} 99 ${cx - 7} 94 Z`} fill="#1b2f4a" stroke={OUTL} strokeWidth="0.8" />
        <path d={`M${cx} 104 V196`} stroke="#14202e" strokeWidth="1.6" />
        <path d={`M${cx} 104 V196`} stroke="#8fb6d0" strokeWidth="0.6" strokeDasharray="1 1.2" />
        <rect x={cx - 1.4} y="108" width="2.8" height="5" rx="0.8" fill="#c7ccd2" stroke={OUTL} strokeWidth="0.4" />
        <path d={`M${cx + 6} 138 l14 -2`} stroke="#14202e" strokeWidth="1.2" />
        {/* spallacci dello zaino */}
        {[-1, 1].map((sd) => (
          <g key={sd}>
            <path d={`M${f(cx + sd * 16)} 100 C${f(cx + sd * 20)} 120 ${f(cx + sd * 22)} 150 ${f(cx + sd * 26)} 172`} stroke={OUTL} strokeWidth="8" fill="none" strokeLinecap="round" />
            <path d={`M${f(cx + sd * 16)} 100 C${f(cx + sd * 20)} 120 ${f(cx + sd * 22)} 150 ${f(cx + sd * 26)} 172`} stroke="#2b2e33" strokeWidth="6.2" fill="none" strokeLinecap="round" />
            <path d={`M${f(cx + sd * 15)} 104 C${f(cx + sd * 19)} 124 ${f(cx + sd * 21)} 150 ${f(cx + sd * 24.6)} 170`} stroke="#5a6068" strokeWidth="0.5" strokeDasharray="1.4 1.2" fill="none" />
            <rect x={f(cx + sd * 21 - 3)} y="140" width="6" height="4" rx="1" fill="#1a1c1f" stroke="#5a6068" strokeWidth="0.5" />
          </g>
        ))}
        <path d={`M${cx - 21} 142 H${cx + 21}`} stroke="#2b2e33" strokeWidth="2" />
      </g>
    );
  }
  return null;
}

/** davanti, su una gamba: pantaloni da trekking a due colori con la tasca a cerniera */
export function SpecialFrontLeg({ look, L, legW, i, bootTop }: { look: AvatarLook; L: (y: number, d: number) => string; legW: number; i: number; bootTop: number }) {
  if (demonOf(look)) return <DemonFrontLeg look={look} L={L} legW={legW} />;
  if (look.special !== "simone-inverno" || look.bottom !== "cargo") return null;
  const out = i ? 1 : -1;
  // pannello grigio sul davanti della coscia e dello stinco, i fianchi restano arancio
  const panel = `M${L(214, -legW * 0.2 + out * legW * 0.06)} 214 L${L(214, legW * 0.26 + out * legW * 0.06)} 214 L${L(bootTop - 2, legW * 0.3 + out * legW * 0.06)} ${bootTop - 2} L${L(bootTop - 2, -legW * 0.24 + out * legW * 0.06)} ${bootTop - 2} Z`;
  return (
    <g pointerEvents="none">
      <path d={panel} fill="#3a3d42" stroke={OUTL} strokeOpacity="0.7" strokeWidth="0.8" />
      <path d={`M${L(262, -legW * 0.26)} 262 L${L(262, legW * 0.32)} 262`} stroke="#c4622d" strokeWidth="3.2" />
      <path d={`M${L(222, out * legW * 0.1)} 222 L${L(250, out * legW * 0.34)} 250`} stroke="#14181c" strokeWidth="1" />
      <path d={`M${L(222, out * legW * 0.1)} 222 L${L(250, out * legW * 0.34)} 250`} stroke="#9aa3ad" strokeWidth="0.4" strokeDasharray="0.8 0.8" />
    </g>
  );
}

/** di profilo, sul busto: bandoliera o spallaccio e zaino */
export function SpecialSideTorso({ look, cx, shoulderL, shoulderR, hipL, hipR }: { look: AvatarLook; cx: number; shoulderL: number; shoulderR: number; hipL: number; hipR: number }) {
  void hipR;
  if (demonOf(look)) return <DemonSideTorso look={look} cx={cx} shoulderL={shoulderL} shoulderR={shoulderR} />;
  if (look.special === "simone-medievale" && look.style === "medievale") return <Baldric a={[shoulderR - 6, 122]} b={[hipL + 6, 200]} crest={look.crest} s={1.05} />;
  if (look.special === "simone-inverno" && look.top === "giacca") {
    return (
      <g pointerEvents="none">
        {/* zaino dietro la schiena, spallaccio sul davanti; cerniera della giacca */}
        <path d={`M${f(shoulderL - 22)} 124 C${f(shoulderL - 26)} 140 ${f(shoulderL - 26)} 176 ${f(shoulderL - 18)} 192 L${f(shoulderL + 2)} 194 L${f(shoulderL + 4)} 120 C${f(shoulderL - 6)} 116 ${f(shoulderL - 16)} 116 ${f(shoulderL - 22)} 124 Z`} fill="#2b2e33" stroke={OUTL} strokeWidth="1.1" />
        <path d={`M${f(shoulderL - 20)} 150 C${f(shoulderL - 12)} 146 ${f(shoulderL - 4)} 146 ${f(shoulderL + 2)} 150`} stroke="#4a5058" strokeWidth="1" fill="none" />
        <path d={`M${f(shoulderL - 21)} 132 C${f(shoulderL - 12)} 128 ${f(shoulderL - 4)} 128 ${f(shoulderL + 3)} 131`} stroke="#5a6068" strokeWidth="0.6" strokeDasharray="1.4 1.2" fill="none" />
        <path d={`M${f(shoulderL + 2)} 120 C${f(cx)} 112 ${f(shoulderR - 2)} 118 ${f(shoulderR - 6)} 132 L${f(shoulderR - 10)} 176`} stroke={OUTL} strokeWidth="7.6" fill="none" strokeLinecap="round" />
        <path d={`M${f(shoulderL + 2)} 120 C${f(cx)} 112 ${f(shoulderR - 2)} 118 ${f(shoulderR - 6)} 132 L${f(shoulderR - 10)} 176`} stroke="#2b2e33" strokeWidth="5.8" fill="none" strokeLinecap="round" />
        <rect x={f(shoulderR - 12)} y="150" width="6" height="4" rx="1" fill="#1a1c1f" stroke="#5a6068" strokeWidth="0.5" />
        <path d={`M${f(cx + 2)} 122 V196`} stroke="#14202e" strokeWidth="1.4" />
        <path d={`M${f(cx + 2)} 122 V196`} stroke="#8fb6d0" strokeWidth="0.5" strokeDasharray="1 1.2" />
      </g>
    );
  }
  return null;
}
