import { useId } from "react";
import { tune, type AvatarLook } from "@/lib/arcieri/avatar";
import { AvatarFace, bodyWidth, shade } from "./archer-avatar";
import { Buckle, ChestEmblem, Clasp, ClothPattern, Pouch, QuiverBody } from "./avatar-extras";

const OUT = "#1b130d";
const LONG_TOPS: Record<string, number> = { tunica: 252, "tunica-lunga": 266, ranger: 262, incrociata: 250, cappotto: 258, "cappotto-lungo": 292, giubba: 230, cotta: 240 };
const LONG_SLEEVES = ["felpa", "giacca", "camicia", "tunica", "tunica-lunga", "farsetto", "ranger", "incrociata", "cappotto", "giubba", "cappotto-lungo", "cotta"];

/**
 * L'arciere visto di fronte, fermo e in piedi, con l'arco in mano: per il profilo degli
 * altri arcieri. Stessi colori, abiti e accessori della figura di profilo.
 */
export function ArcherFront({ look, className = "h-96 w-auto", crop }: { look: AvatarLook; className?: string; /** riquadro da mostrare (viewBox), per le miniature di un dettaglio */ crop?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const woman = look.body === "donna" || look.body === "ragazza";
  const kid = look.body === "ragazzo" || look.body === "ragazza";
  const W = bodyWidth(look);
  const tw = (woman ? 0.9 : 1) * W;
  const cx = 100;
  const sh = { l: cx - 38 * tw, r: cx + 38 * tw };
  const waist = { l: cx - (woman ? 25 : 29) * W, r: cx + (woman ? 25 : 29) * W };
  const hip = { l: cx - (woman ? 33 : 30) * W, r: cx + (woman ? 33 : 30) * W };
  const skin = look.skin;
  const shirt = look.shirt;
  const sleeve = look.top === "cotta" ? look.sleeves || "#8d949b" : LONG_SLEEVES.includes(look.top) ? look.sleeves || shirt : skin;
  // lunghezza della veste: stessa barra della figura di profilo
  const stretch = (tune(look.topLength, 50, 0, 100) - 50) * 1.3;
  const sideLen = Math.max(206, Math.min(312, (LONG_TOPS[look.top] ?? 200) + stretch));
  const hem = 206 + (sideLen - 206) * 1.05;
  const longTop = sideLen > 216;
  const tunicD = `M${hip.l} 196 L${hip.r} 196 C${hip.r + 6} 230 ${hip.r + 12} ${hem - 20} ${hip.r + 14} ${hem} Q${cx} ${hem + 6} ${hip.l - 14} ${hem} C${hip.l - 12} ${hem - 20} ${hip.l - 6} 230 ${hip.l} 196 Z`;
  const torsoD = `M${sh.l} 106 C${sh.l + 10} 94 ${sh.r - 10} 94 ${sh.r} 106 C${sh.r + 2} 140 ${waist.r + 2} 170 ${waist.r} 186 C${hip.r} 194 ${hip.r} 200 ${hip.r} 208 L${hip.l} 208 C${hip.l} 200 ${hip.l} 194 ${waist.l} 186 C${waist.l - 2} 170 ${sh.l - 2} 140 ${sh.l} 106 Z`;
  const tight = look.bottom === "calzamaglia";
  const wide = look.bottom === "larghi" || look.bottom === "brache";
  const shorts = look.bottom === "pantaloncini" || look.bottom === "gonna";
  const legW = (tight ? 15 : wide ? 22 : 18) * W;
  const legX = [cx - 14 * W, cx + 14 * W];
  const bootTop = look.footwear === "stivali-alti" ? 262 : look.footwear === "stivali" || look.footwear === "stivali-risvolto" || look.footwear === "stivali-pelliccia" ? 280 : look.footwear === "stivaletti" || look.footwear === "scarponi" ? 306 : look.footwear === "mocassini" ? 326 : 318;
  // l'arco sta nella mano dell'arco: la sinistra (a destra per chi guarda), o l'altra se mancino
  const bowSide = look.lefty ? -1 : 1;
  const bowX = cx + bowSide * (sh.r - cx + 14);
  const handY = 214;
  const limbs = look.limbs || "#15191d";
  const riser = look.riser || "#2f6fbe";
  const longbow = ["longbow", "storico", "flatbow", "asiatico"].includes(look.bowType);
  const bowTop = 70;
  const bowBot = 352;
  const bulge = longbow ? 26 : 18;
  const bowPath = longbow
    ? `M${bowX} ${bowTop} C${bowX + bowSide * bulge} ${bowTop + 70} ${bowX + bowSide * bulge} ${bowBot - 70} ${bowX} ${bowBot}`
    : `M${bowX - bowSide * 6} ${bowTop} C${bowX + bowSide * 4} ${bowTop + 20} ${bowX + bowSide * bulge} ${bowTop + 70} ${bowX + bowSide * 4} ${handY - 26} L${bowX + bowSide * 4} ${handY + 26} C${bowX + bowSide * bulge} ${bowBot - 70} ${bowX + bowSide * 4} ${bowBot - 20} ${bowX - bowSide * 6} ${bowBot}`;
  const stringX = longbow ? bowX : bowX - bowSide * 6;
  const quiverBack = look.quiverPlace === "schiena";
  const spin = tune(look.quiverRot, 0, -180, 180);
  const arm = (side: -1 | 1) => {
    const s0 = side < 0 ? sh.l + 7 : sh.r - 7;
    const elbow = { x: s0 + side * 9, y: 160 };
    const hand = side === bowSide ? { x: bowX - bowSide * 2, y: handY } : { x: s0 + side * 6, y: 222 };
    return (
      <g key={side}>
        <path d={`M${s0} 108 L${elbow.x} ${elbow.y} L${hand.x} ${hand.y}`} stroke={OUT} strokeOpacity="0.5" strokeWidth={17 * W + 2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={`M${s0} 108 L${elbow.x} ${elbow.y} L${hand.x} ${hand.y}`} stroke={sleeve} strokeWidth={17 * W} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {LONG_SLEEVES.includes(look.top) || look.top === "canotta" ? null : <path d={`M${s0} 108 L${s0 + side * 4} 128`} stroke={shirt} strokeWidth={19 * W} strokeLinecap="round" />}
        {look.armband && side !== bowSide ? <path d={`M${lerp(s0, elbow.x, 0.45)} ${lerp(108, elbow.y, 0.45) - 4} L${lerp(s0, elbow.x, 0.6)} ${lerp(108, elbow.y, 0.6)}`} stroke={look.trim} strokeWidth={18 * W} /> : null}
        {look.watch && side !== bowSide ? <g><circle cx={lerp(elbow.x, hand.x, 0.8)} cy={lerp(elbow.y, hand.y, 0.8)} r="5.4" fill="#1d2126" /><circle cx={lerp(elbow.x, hand.x, 0.8)} cy={lerp(elbow.y, hand.y, 0.8)} r="3" fill="#dfe6ee" /></g> : null}
        {look.bracers ? <path d={`M${lerp(elbow.x, hand.x, 0.35)} ${lerp(elbow.y, hand.y, 0.35)} L${lerp(elbow.x, hand.x, 0.8)} ${lerp(elbow.y, hand.y, 0.8)}`} stroke={look.bracers} strokeWidth={18 * W} strokeLinecap="butt" /> : null}
        {side === bowSide && look.armguard ? <path d={`M${lerp(elbow.x, hand.x, 0.3)} ${lerp(elbow.y, hand.y, 0.3)} L${lerp(elbow.x, hand.x, 0.78)} ${lerp(elbow.y, hand.y, 0.78)}`} stroke={look.armguard} strokeWidth={14 * W} strokeLinecap="round" opacity="0.92" /> : null}
        <circle cx={hand.x} cy={hand.y} r={7.6 * W} fill={look.gloves ? "#3a2a1e" : skin} stroke={OUT} strokeOpacity="0.45" strokeWidth="1.2" />
      </g>
    );
  };
  return (
    <svg viewBox={crop ?? "0 0 200 370"} className={className} style={crop ? undefined : { aspectRatio: "200 / 370" }} role="img" aria-label="L'arciere di fronte">
      <defs>
        <linearGradient id={`${uid}sh`} x1="0" x2="1">
          <stop offset="0" stopColor={shade(shirt, -0.28)} />
          <stop offset="0.45" stopColor={shade(shirt, 0.1)} />
          <stop offset="1" stopColor={shade(shirt, -0.35)} />
        </linearGradient>
        <linearGradient id={`${uid}pa`} x1="0" x2="1">
          <stop offset="0" stopColor={shade(look.pants, -0.3)} />
          <stop offset="0.5" stopColor={shade(look.pants, 0.08)} />
          <stop offset="1" stopColor={shade(look.pants, -0.35)} />
        </linearGradient>
        <linearGradient id={`${uid}bw`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(limbs, 0.2)} />
          <stop offset="0.5" stopColor={riser} />
          <stop offset="1" stopColor={shade(limbs, 0.2)} />
        </linearGradient>
      </defs>
      <g transform={`translate(100 360) scale(${((kid ? 0.84 : 1) * (0.9 + (tune(look.stature, 50, 0, 100) / 100) * 0.2)).toFixed(3)}) translate(-100 -360)`}>
        <ellipse cx="100" cy="356" rx="58" ry="7" fill="#000" opacity="0.3" />
        {/* dietro: mantello e faretra sulla schiena */}
        {look.cape ? (
          <path d={`M${sh.l - 4} 104 C${sh.l - 18} 180 ${sh.l - 22} 260 ${sh.l - 16} ${look.capeStyle === "corto" ? 230 : 338} L${sh.r + 16} ${look.capeStyle === "corto" ? 230 : 338} C${sh.r + 22} 260 ${sh.r + 18} 180 ${sh.r + 4} 104 Z`} fill={shade(look.capeColor, -0.25)} stroke={OUT} strokeOpacity="0.45" strokeWidth="1.4" />
        ) : null}
        {quiverBack ? (
          <g transform={`translate(${cx - bowSide * 30} ${96 + tune(look.quiverY, 0, -40, 40)}) rotate(${-bowSide * 24 + spin})`}>
            {[-5, 0, 5].map((dx, i) => (
              <g key={dx}>
                <line x1={dx} y1={-22} x2={dx} y2={-40} stroke={look.shaft || "#1d1f22"} strokeWidth="2" />
                <path d={`M${dx} -40 l-4 -10 l4 3 l4 -3 z`} fill={i === 1 ? look.cock : look.fletch} />
              </g>
            ))}
            <QuiverBody kind={look.quiverStyle} color={look.quiver} h={40} top={-24} />
          </g>
        ) : null}

        {/* gambe e calzature */}
        {legX.map((x, i) => (
          <g key={x}>
            <path d={`M${x - legW / 2} 206 L${x + legW / 2} 206 L${x + legW / 2 - (tight ? 2 : 0)} 330 L${x - legW / 2 + (tight ? 2 : 0)} 330 Z`} fill={shorts ? skin : `url(#${uid}pa)`} stroke={OUT} strokeOpacity="0.45" strokeWidth="1.4" />
            {shorts ? <path d={`M${x - legW / 2 - 1} 206 h${legW + 2} v46 h${-legW - 2} Z`} fill={`url(#${uid}pa)`} stroke={OUT} strokeOpacity="0.45" strokeWidth="1.2" /> : null}
            {look.bottom === "jeans" ? <path d={`M${x + (i ? -3 : 3)} 214 V326`} stroke={shade(look.pants, 0.3)} strokeWidth="0.8" strokeDasharray="3 2" /> : null}
            {look.wraps ? [0, 1, 2, 3, 4].map((k) => <path key={k} d={`M${x - legW / 2} ${246 + k * 12} L${x + legW / 2} ${240 + k * 12}`} stroke={look.wrapsColor} strokeWidth="4" />) : null}
            <path d={`M${x - legW / 2 - 1} ${bootTop} L${x + legW / 2 + 1} ${bootTop} L${x + legW / 2 + 2} 344 C${x + legW / 2 + 2} 350 ${x - legW / 2 - 2} 350 ${x - legW / 2 - 2} 344 Z`} fill={look.footwear === "sandali" ? skin : look.shoes} stroke={OUT} strokeOpacity="0.55" strokeWidth="1.4" />
            {look.footwear === "stivali-pelliccia" ? [-1, 0, 1].map((k) => <circle key={k} cx={x + k * legW * 0.4} cy={bootTop} r="5.4" fill="#e3d6be" stroke={OUT} strokeOpacity="0.25" strokeWidth="0.6" />) : null}
            {look.footwear === "scarponi" ? <path d={`M${x - legW / 2 - 3} 346 h${legW + 6} v4 h${-legW - 6} Z`} fill="#2a2622" /> : null}
            {look.bottom === "cargo" ? <rect x={x + (i ? 2 : -legW / 2 - 2)} y="244" width={legW / 2 + 1} height="16" rx="2" fill={shade(look.pants, -0.15)} stroke={shade(look.pants, -0.45)} strokeWidth="0.8" /> : null}
            {look.footwear === "stivali-risvolto" ? <path d={`M${x - legW / 2 - 3} ${bootTop - 4} h${legW + 6} v9 h${-legW - 6} Z`} fill="#eee2c8" stroke={OUT} strokeOpacity="0.35" strokeWidth="1" /> : null}
            {look.footwear === "sportive" ? <path d={`M${x - legW / 2 - 2} 344 h${legW + 4} v4 h${-legW - 4} Z`} fill="#f2efe8" /> : null}
            {look.footwear === "sandali" ? <path d={`M${x - legW / 2} 330 L${x + legW / 2} 340 M${x + legW / 2} 330 L${x - legW / 2} 340`} stroke={look.shoes} strokeWidth="2.4" /> : null}
          </g>
        ))}

        {look.bottom === "gonna" ? (
          <g>
            <path d={`M${hip.l - 2} 200 L${hip.r + 2} 200 L${hip.r + 12} 262 Q${cx} 268 ${hip.l - 12} 262 Z`} fill={`url(#${uid}pa)`} stroke={OUT} strokeOpacity="0.5" strokeWidth="1.4" />
            {[-0.7, -0.35, 0, 0.35, 0.7].map((k) => <path key={k} d={`M${cx + k * 28} 204 L${cx + k * 38} 262`} stroke={shade(look.pants, -0.35)} strokeWidth="1" />)}
          </g>
        ) : null}
        {/* veste */}
        {longTop ? <path d={tunicD} fill={`url(#${uid}sh)`} stroke={OUT} strokeOpacity="0.5" strokeWidth="1.8" /> : null}
        {longTop ? <path d={`M${hip.l - 14} ${hem - 3} Q${cx} ${hem + 3} ${hip.r + 14} ${hem - 3}`} stroke={look.trim} strokeWidth="3" fill="none" /> : null}
        {longTop && ["cappotto-lungo", "ranger", "tunica-lunga", "incrociata"].includes(look.top) ? <path d={`M${cx} 200 L${cx} ${hem + 2}`} stroke={shade(shirt, -0.45)} strokeWidth="1.6" /> : null}
        <path d={torsoD} fill={`url(#${uid}sh)`} stroke={OUT} strokeOpacity="0.5" strokeWidth="1.8" />
        <ClothPattern kind={look.pattern} shapes={longTop ? [torsoD, tunicD] : [torsoD]} base={shirt} trim={look.trim} uid={`${uid}f`} box={[sh.l - 16, 94, sh.r + 16, (longTop ? hem : 208) + 6]} />
        <path d={`M${cx - 12} 97 L${cx} 116 L${cx + 12} 97`} stroke={look.trim} strokeWidth="3.2" fill="none" strokeLinejoin="round" />
        {["tunica-lunga", "farsetto", "giubba", "polo"].includes(look.top) ? [124, 140, 156, 172].map((y) => <circle key={y} cx={cx} cy={y} r="1.8" fill={look.trim} />) : null}
        {look.top === "ranger" || look.top === "incrociata" ? <path d={`M${cx - 18} 100 L${cx + 14} 196`} stroke={look.trim} strokeWidth="2.6" /> : null}
        {look.top === "gilet" ? <path d={`M${cx - 10} 100 L${cx - 6} 200 M${cx + 10} 100 L${cx + 6} 200`} stroke={shade(shirt, -0.4)} strokeWidth="1.4" /> : null}
        {look.chestguard ? <path d={`M${cx + bowSide * 6} 118 C${cx + bowSide * 30} 116 ${cx + bowSide * 34} 150 ${cx + bowSide * 26} 168 L${cx + bowSide * 6} 164 Z`} fill={look.chestColor} opacity="0.92" stroke={OUT} strokeOpacity="0.4" strokeWidth="1" /> : null}
        {look.straps ? <path d={`M${sh.l + 8} 106 L${hip.r - 6} 196 M${sh.r - 8} 106 L${hip.l + 6} 196`} stroke="#3a2414" strokeWidth="4.4" /> : null}
        {look.sash ? <path d={`M${waist.l - 2} 182 Q${cx} 192 ${waist.r + 2} 182 L${waist.r + 2} 194 Q${cx} 204 ${waist.l - 2} 194 Z M${waist.l + 6} 192 l-6 34 l10 -4 Z`} fill={look.sashColor} /> : null}
        {look.belt !== "nessuna" ? (
          <g>
            <path d={`M${waist.l - 1} ${look.belt === "larga" ? 184 : 187} L${waist.r + 1} ${look.belt === "larga" ? 184 : 187} L${waist.r + 1} 194 L${waist.l - 1} 194 Z`} fill={look.beltColor} stroke={OUT} strokeOpacity="0.4" strokeWidth="1" />
            {look.buckle && look.buckle !== "semplice" ? <Buckle kind={look.buckle} x={cx} y={190} /> : <rect x={cx - 5} y={look.belt === "larga" ? 183 : 186} width="10" height={look.belt === "larga" ? 12 : 9} rx="1.5" fill="none" stroke="#d9b45a" strokeWidth="1.8" />}
          </g>
        ) : null}
        {look.pouch ? <Pouch kind={look.pouchType} x={cx - bowSide * 24} y={192} /> : null}
        <ChestEmblem kind={look.emblem} x={cx - bowSide * 14} y={134} s={0.85} base={shirt} trim={look.trim} />
        {look.cape && look.clasp !== "nessuno" ? <><Clasp kind={look.clasp} x={sh.l + 6} y={104} /><Clasp kind={look.clasp} x={sh.r - 6} y={104} /></> : null}
        {!quiverBack ? (
          <g transform={`translate(${cx - bowSide * (hip.r - cx + 10)} ${222 + tune(look.quiverY, 0, -40, 40)}) rotate(${-bowSide * 8 + spin})`}>
            {[-4, 0, 4].map((dx, i) => <path key={dx} d={`M${dx} -42 l-3.4 -9 l3.4 2.6 l3.4 -2.6 z`} fill={i === 1 ? look.cock : look.fletch} />)}
            <QuiverBody kind={look.quiverStyle} color={look.quiver} w={18} h={70} top={-40} />
            <rect x="-10" y="-42" width="20" height="6" rx="2" fill={shade(look.quiver, -0.3)} />
          </g>
        ) : null}
        {look.fur ? <g fill={look.furColor} stroke={shade(look.furColor, -0.4)} strokeWidth="0.8">{[-34, -24, -14, 14, 24, 34].map((dx, i) => <circle key={dx} cx={cx + dx * tw} cy={102 + (i % 2) * 3} r="9" />)}</g> : null}
        {look.scarf ? <path d={`M${cx - 18} 96 Q${cx} 108 ${cx + 18} 96 L${cx + 16} 104 Q${cx} 116 ${cx - 16} 104 Z M${cx + 8} 106 l4 30 l8 -2 l-6 -28 Z`} fill={look.scarfColor} /> : null}
        {look.cowl ? <path d={`M${sh.l + 4} 104 C${cx - 20} 92 ${cx + 20} 92 ${sh.r - 4} 104 C${cx + 22} 124 ${cx - 22} 124 ${sh.l + 4} 104 Z`} fill={look.cowlColor} stroke={shade(look.cowlColor, -0.35)} strokeWidth="1" /> : null}
        {look.amulet ? <g><path d={`M${cx - 11} 100 Q${cx} 126 ${cx + 11} 100`} stroke="#c9a46a" strokeWidth="1" fill="none" /><path d={`M${cx} 122 l5 7 l-5 7 l-5 -7 Z`} fill="#d9b45a" stroke="#7a5a1a" strokeWidth="0.8" /><circle cx={cx} cy="129" r="2" fill="#2f9e7a" /></g> : null}
        {look.top === "cotta" ? <g opacity="0.85">{Array.from({ length: Math.floor((hem - 112) / 5) }, (_, r) => <path key={r} d={`M${cx - 28.8} ${112 + r * 5} ${Array.from({ length: 16 }, () => "q1.8 2.6 3.6 0").join(" ")}`} stroke="#5d646b" strokeWidth="0.7" fill="none" />)}</g> : null}
        {look.top === "canotta" ? <path d={`M${cx - 16} 98 Q${cx} 124 ${cx + 16} 98`} fill={skin} stroke={look.trim} strokeWidth="2" /> : null}
        {look.top === "camicia" ? <path d={`M${cx - 12} 96 L${cx} 108 L${cx - 5} 116 L${cx - 15} 104 Z M${cx + 12} 96 L${cx} 108 L${cx + 5} 116 L${cx + 15} 104 Z`} fill={shade(shirt, 0.18)} stroke={shade(shirt, -0.4)} strokeWidth="0.8" /> : null}
        {look.top === "divisa" ? <path d={`M${sh.l + 2} 150 L${sh.r - 2} 134 L${sh.r - 2} 146 L${sh.l + 2} 162 Z`} fill={look.trim} opacity="0.9" /> : null}
        {look.necklace ? <path d={`M${cx - 10} 100 Q${cx} 114 ${cx + 10} 100`} stroke="#d9b45a" strokeWidth="1.4" fill="none" /> : null}

        {/* arco tenuto in verticale, corda, braccia */}
        <path d={bowPath} stroke={OUT} strokeOpacity="0.5" strokeWidth="7.6" fill="none" strokeLinecap="round" />
        <path d={bowPath} stroke={`url(#${uid}bw)`} strokeWidth="5.4" fill="none" strokeLinecap="round" />
        <path d={`M${stringX} ${bowTop + 2} L${stringX} ${bowBot - 2}`} stroke={look.string || "#f4f1ea"} strokeWidth="1.1" opacity="0.9" />
        {arm(-1)}
        {arm(1)}

        {/* testa di fronte, la stessa della foto profilo */}
        <rect x={cx - 9} y="78" width="18" height="26" rx="4" fill={shade(skin, -0.2)} />
        <svg x={cx - 65} y="-8" width="130" height="130" viewBox="0 0 100 100" overflow="visible">
          <AvatarFace look={look} className="" bare />
        </svg>
      </g>
    </svg>
  );
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
