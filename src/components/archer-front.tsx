import { useId } from "react";
import { tune, type AvatarLook } from "@/lib/arcieri/avatar";
import { AvatarFace, bodyWidth, CAPE_CLOTH, shade } from "./archer-avatar";
import { PATTERN2_IDS } from "@/lib/arcieri/avatar-more";
import { Pendant } from "./avatar-more";
import { SpecialFrontLeg, SpecialFrontTorso } from "./special-details";
import { Buckle, ChestEmblem, Clasp, ClothPattern, Fletching, Pouch, QuiverBody, zigQ } from "./avatar-extras";
import { seamOf, BeltDetail, ClothButton, ClothDetail, DetailDefs, LeatherBand, SleeveDetail } from "./avatar-detail";
import { BUTTON_TOPS } from "./archer-avatar";

// contorno dipinto: bruno scuro morbido, non più nero a china
const OUT = "#2a1d14";
const LONG_TOPS: Record<string, number> = { tunica: 252, "tunica-lunga": 266, ranger: 262, incrociata: 250, cappotto: 258, "cappotto-lungo": 292, giubba: 230, cotta: 240, giubbetto: 234 };
const LONG_SLEEVES = ["felpa", "giacca", "camicia", "tunica", "tunica-lunga", "farsetto", "ranger", "incrociata", "cappotto", "giubba", "cappotto-lungo", "cotta", "giubbetto"];

/**
 * L'arciere visto di fronte, in piedi con l'arco stretto nella mano e una freccia nell'altra:
 * il peso su una gamba, respira, ondeggia appena, il mantello si muove. Stessi colori, abiti,
 * accessori e arco della figura di profilo.
 */
export function ArcherFront({ look, className = "h-96 w-auto", crop, fit = false, armsOut }: { look: AvatarLook; className?: string; /** riquadro da mostrare (viewBox), per le miniature di un dettaglio */ crop?: string; /** ritratto: ragazzi e arcieri bassi riempiono il riquadro come gli altri (niente vuoto sopra la testa) */ fit?: boolean; /** braccia aperte a T (per misurare l'apertura): distanza dal centro alla punta delle dita, senza arco */ armsOut?: number }) {
  const live = !crop;
  const uid = (useId().replace(/[^a-zA-Z0-9]/g, "") + "_");
  const woman = look.body === "donna" || look.body === "ragazza";
  const W = bodyWidth(look);
  const tw = (woman ? 0.9 : 1) * W;
  const cx = 100;
  const sh = { l: cx - 38 * tw, r: cx + 38 * tw };
  const waist = { l: cx - (woman ? 25 : 29) * W, r: cx + (woman ? 25 : 29) * W };
  const hip = { l: cx - (woman ? 33 : 30) * W, r: cx + (woman ? 33 : 30) * W };
  const skin = look.skin;
  const shirt = look.shirt;
  const sleeve = look.top === "cotta" ? look.sleeves || "#8d949b" : look.top === "giubbetto" ? look.sleeves || "#f1ece0" : LONG_SLEEVES.includes(look.top) ? look.sleeves || shirt : skin;
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
  const bowSide: 1 | -1 = look.lefty ? -1 : 1;
  const grip = { x: cx + bowSide * (sh.r - cx + 12), y: 206 };
  const wood = ["longbow", "flatbow", "storico", "asiatico", "ricurvo"].includes(look.bowType);
  const woodBase = look.riser && look.riser !== "#2f6fbe" ? look.riser : "#9b6334";
  const limbs = look.limbs || (wood ? woodBase : "#15191d");
  const riser = wood ? woodBase : look.riser || "#2f6fbe";
  const longbow = ["longbow", "flatbow"].includes(look.bowType);
  const asian = ["storico", "asiatico"].includes(look.bowType);
  const compound = look.bowType === "compound";
  const recurve = !longbow && !asian && !compound;
  // nelle coordinate dell'impugnatura: x verso l'esterno, y in giù
  const half = longbow ? 146 : asian ? 112 : compound ? 96 : 140;
  const rs = longbow ? 10 : asian ? 16 : compound ? 44 : 30;
  const tipX = longbow ? -8 : asian ? 6 : compound ? -8 : -6;
  const limbD = (sg: 1 | -1) =>
    longbow ? `M0 ${-rs * sg} C${20} ${-(rs + 60) * sg} 16 ${-(half - 30) * sg} ${tipX} ${-half * sg}`
    : asian ? `M3 ${-rs * sg} C16 ${-(rs + 30) * sg} 18 ${-(half - 30) * sg} 4 ${-(half - 10) * sg} L${tipX + 8} ${-half * sg}`
    : compound ? `M4 ${-rs * sg} C10 ${-(rs + 20) * sg} 6 ${-(half - 14) * sg} ${tipX} ${-half * sg}`
    : `M4 ${-rs * sg} C8 ${-(rs + 40) * sg} 20 ${-(half - 60) * sg} 6 ${-(half - 14) * sg} C2 ${-(half - 6) * sg} ${tipX} ${-(half - 2) * sg} ${tipX - 2} ${-(half + 4) * sg}`;
  const tip = (sg: 1 | -1) => ({ x: recurve ? tipX - 2 : asian ? tipX + 8 : tipX, y: -(recurve ? half + 4 : half) * sg });
  const strX = recurve ? tipX - 2 : asian ? tipX + 8 : tipX;
  const quiverBack = look.quiverPlace === "schiena";
  const spin = tune(look.quiverRot, 0, -180, 180);
  const medievalTop = ["tunica", "tunica-lunga", "farsetto", "ranger", "incrociata", "cappotto", "giubba", "cappotto-lungo", "cotta"].includes(look.top);
  const sleeveLong = LONG_SLEEVES.includes(look.top) || look.top === "corpetto" || look.top === "gilet";
  const handR = 7.4 * W;
  const handFill = look.gloves ? "#4a2c16" : skin;
  const arm = (side: -1 | 1) => {
    const open = armsOut != null;
    const bowArm = side === bowSide && !open;
    const s0 = { x: side < 0 ? sh.l + 7 : sh.r - 7, y: 108 };
    // braccia aperte: la punta del dito medio a armsOut dal centro, la mano finisce lì
    const hand = open ? { x: cx + side * (armsOut - handR * 0.9), y: 110 } : bowArm ? { x: grip.x - bowSide * 1, y: grip.y } : { x: s0.x + side * 1, y: 214 };
    const elbow = open ? { x: lerp(s0.x, hand.x, 0.47), y: 109 } : bowArm ? { x: s0.x + side * 11, y: 158 } : { x: s0.x + side * 7, y: 160 };
    const upW = 16.5 * W;
    const foreW = 13 * W;
    const segs = `M${f(s0.x)} ${f(s0.y)} L${f(elbow.x)} ${f(elbow.y)}`;
    const cuff = lerpP(elbow, hand, 0.84);
    const brA = lerpP(elbow, hand, 0.34);
    const brB = lerpP(elbow, hand, 0.84);
    return (
      <g key={side} className={live ? (bowArm ? "aa-front-bowarm" : "aa-front-arm") : undefined} style={live ? { transformOrigin: `${f(s0.x)}px ${f(s0.y)}px` } : undefined}>
        <path d={`${segs} L${f(hand.x)} ${f(hand.y)}`} stroke={OUT} strokeOpacity="0.8" strokeWidth={upW + 2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={segs} stroke={sleeve} strokeWidth={upW} strokeLinecap="round" fill="none" />
        {sleeve !== skin ? <path d={segs} stroke={`url(#${uid}linen)`} strokeWidth={upW} strokeLinecap="round" fill="none" /> : null}
        <path d={`M${f(elbow.x)} ${f(elbow.y)} L${f(sleeveLong ? cuff.x : hand.x)} ${f(sleeveLong ? cuff.y : hand.y)}`} stroke={sleeveLong ? sleeve : skin} strokeWidth={foreW + (sleeveLong ? 1.5 : 0)} strokeLinecap="round" fill="none" />
        {sleeveLong ? <path d={`M${f(cuff.x)} ${f(cuff.y)} L${f(hand.x)} ${f(hand.y)}`} stroke={skin} strokeWidth={foreW - 1} strokeLinecap="round" /> : null}
        {LONG_SLEEVES.includes(look.top) || look.top === "canotta" ? null : <path d={open ? `M${f(s0.x)} ${f(s0.y)} L${f(s0.x + side * 20)} ${f(s0.y + 1)}` : `M${f(s0.x)} ${f(s0.y)} L${f(s0.x + side * 4)} 130`} stroke={look.top === "gilet" || look.top === "corpetto" ? look.sleeves || look.trim : shirt} strokeWidth={19 * W} strokeLinecap="round" />}
        {look.top === "canotta" ? null : <SleeveDetail s={s0} e={elbow} h={hand} w={upW} color={seamOf(sleeve)} long={sleeveLong} />}
        <path d={`M${f(s0.x - side * upW * 0.18)} ${f(s0.y + 4)} L${f(elbow.x - side * upW * 0.18)} ${f(elbow.y)}`} stroke="#fff" strokeOpacity="0.14" strokeWidth={upW * 0.26} strokeLinecap="round" />
        {/* ombra sul lato in ombra del braccio (la luce viene da sinistra) */}
        <path d={`M${f(s0.x + upW * 0.3)} ${f(s0.y + 4)} L${f(elbow.x + upW * 0.3)} ${f(elbow.y)}${sleeveLong ? ` L${f(cuff.x + foreW * 0.3)} ${f(cuff.y)}` : ""}`} stroke="#000" strokeOpacity="0.18" strokeWidth={upW * 0.34} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {medievalTop ? <circle cx={f(cuff.x)} cy={f(cuff.y)} r={6.8 * W} fill={look.trim} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.8" /> : null}
        {look.armband && !bowArm ? <path d={`M${f(lerp(s0.x, elbow.x, 0.42))} ${f(lerp(s0.y, elbow.y, 0.42))} L${f(lerp(s0.x, elbow.x, 0.58))} ${f(lerp(s0.y, elbow.y, 0.58))}`} stroke={look.trim} strokeWidth={upW + 1.4} /> : null}
        {look.watch && !bowArm ? <g><circle cx={f(lerp(elbow.x, hand.x, 0.8))} cy={f(lerp(elbow.y, hand.y, 0.8))} r="5.4" fill="#1d2126" /><circle cx={f(lerp(elbow.x, hand.x, 0.8))} cy={f(lerp(elbow.y, hand.y, 0.8))} r="3" fill="#dfe6ee" /></g> : null}
        {bowArm && look.armguard ? <path d={`M${f(lerp(elbow.x, hand.x, 0.2))} ${f(lerp(elbow.y, hand.y, 0.2))} L${f(lerp(elbow.x, hand.x, 0.76))} ${f(lerp(elbow.y, hand.y, 0.76))}`} stroke={look.armguard} strokeWidth={foreW + 3} strokeLinecap="round" opacity="0.95" /> : null}
        {look.bracers ? (
          <g>
            <path d={`M${f(brA.x)} ${f(brA.y)} L${f(brB.x)} ${f(brB.y)}`} stroke={OUT} strokeOpacity="0.8" strokeWidth={foreW + 6} strokeLinecap="round" />
            <path d={`M${f(brA.x)} ${f(brA.y)} L${f(brB.x)} ${f(brB.y)}`} stroke={look.bracers} strokeWidth={foreW + 4} strokeLinecap="round" />
            {[0.42, 0.56, 0.7].map((k) => {
              const c = lerpP(elbow, hand, k);
              return <path key={k} d={`M${f(c.x - 4)} ${f(c.y - 3)} l8 6 M${f(c.x + 4)} ${f(c.y - 3)} l-8 6`} stroke={shade(look.bracers, 0.55)} strokeWidth="0.9" />;
            })}
            <LeatherBand uid={`${uid}${side}`} a={lerpP(elbow, hand, 0.36)} b={lerpP(elbow, hand, 0.82)} w={foreW + 4} color={shade(look.bracers, 0.6)} />
          </g>
        ) : null}
        {/* mano (con le braccia aperte, tutte e due) */}
        {bowArm ? null : (
          <g>
            <ellipse cx={f(hand.x)} cy={f(hand.y + 1)} rx={f(handR * 0.9 + 1.2)} ry={f(handR + 1.4)} fill={OUT} opacity="0.5" />
            <ellipse cx={f(hand.x)} cy={f(hand.y + 1)} rx={f(handR * 0.9)} ry={f(handR)} fill={handFill} />
            <path d={`M${f(hand.x - handR * 0.6)} ${f(hand.y + 2)} h${f(handR * 1.2)} M${f(hand.x - handR * 0.6)} ${f(hand.y + 4.6)} h${f(handR * 1.2)}`} stroke={look.gloves ? "#1a0e06" : shade(skin, -0.35)} strokeWidth="0.7" strokeLinecap="round" />
            <ellipse cx={f(hand.x - handR * 0.3)} cy={f(hand.y - handR * 0.4)} rx={f(handR * 0.4)} ry={f(handR * 0.28)} fill="#fff" opacity="0.16" />
          </g>
        )}
      </g>
    );
  };
  // freccia nella mano libera: punta in giù lungo la gamba, penne sopra la mano
  const freeHand = { x: (bowSide > 0 ? sh.l + 7 : sh.r - 7) - bowSide * 1, y: 214 };
  const heldArrow = (
    <g className={live ? "aa-front-arm" : undefined} style={live ? { transformOrigin: `${f(freeHand.x)}px 108px` } : undefined}>
    <g transform={`translate(${f(freeHand.x)} ${f(freeHand.y)}) rotate(${-bowSide * 4})`}>
      <path d="M0 -30 L0 84" stroke={look.shaft || "#1d1f22"} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M-2.2 84 L0 93 L2.2 84 Z" fill="#c9d0d8" />
      <g transform="translate(0 -30) rotate(-90)">
        <Fletching kind={look.fletchStyle} cock={look.cock} fletch={look.fletch} />
      </g>
      <rect x="-1.8" y="-34" width="3.6" height="5" rx="1" fill={look.nock} />
    </g>
    </g>
  );
  const splay = 4;
  return (
    <svg viewBox={crop ?? "0 0 200 370"} className={className} style={crop ? undefined : { aspectRatio: "200 / 370" }} role="img" aria-label="L'arciere di fronte">
      <defs>
        {/* volume dipinto sopra gli abiti: luce da sinistra, ombra sul fianco destro, ombra sotto il petto e sotto la cintura */}
        <linearGradient id={`${uid}vol`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.34" />
        </linearGradient>
        <linearGradient id={`${uid}ao`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.38" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
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
        <linearGradient id={`${uid}bo`} x1="0" x2="1">
          <stop offset="0" stopColor={shade(look.shoes, -0.35)} />
          <stop offset="0.42" stopColor={shade(look.shoes, 0.16)} />
          <stop offset="1" stopColor={shade(look.shoes, -0.3)} />
        </linearGradient>
        <linearGradient id={`${uid}ri`} x1="0" x2="1">
          <stop offset="0" stopColor={shade(riser, -0.45)} />
          <stop offset="0.45" stopColor={shade(riser, 0.25)} />
          <stop offset="1" stopColor={shade(riser, -0.5)} />
        </linearGradient>
        <linearGradient id={`${uid}cp`} x1="0" x2="1">
          <stop offset="0" stopColor={shade(look.capeColor, -0.35)} />
          <stop offset="0.3" stopColor={shade(look.capeColor, 0.08)} />
          <stop offset="0.5" stopColor={shade(look.capeColor, -0.5)} />
          <stop offset="0.7" stopColor={shade(look.capeColor, 0.08)} />
          <stop offset="1" stopColor={shade(look.capeColor, -0.35)} />
        </linearGradient>
        <DetailDefs uid={uid} />
        <DetailDefs uid={`${uid}cd`} />
        <DetailDefs uid={`${uid}1`} />
        <DetailDefs uid={`${uid}-1`} />
        <clipPath id={`${uid}tcl`}><path d={torsoD} />{longTop ? <path d={tunicD} /> : null}</clipPath>
      </defs>
      <g transform={`translate(100 360) scale(${(fit ? 1 : frontScale(look)).toFixed(3)}) translate(-100 -360)`}>
        <ellipse cx="100" cy="356" rx="62" ry="7" fill="#000" opacity="0.3" />
        <g className={live ? "aa-front-sway" : undefined}>
        {/* dietro: mantello e faretra sulla schiena */}
        {look.cape ? (() => {
          const hemY = look.capeStyle === "corto" ? 232 : 340;
          const frayed = look.capeStyle === "frastagliato";
          // due lembi, uno per lato: si allargano verso il basso, con l'orlo mosso, la fodera scura sul bordo e le pieghe
          const flap = (side: -1 | 1) => {
            const sx = side < 0 ? sh.l : sh.r;
            const outX = sx + side * (look.capeStyle === "corto" ? 16 : 26);
            const inX = cx + side * 6;
            const n = 6;
            const hem = Array.from({ length: n + 1 }, (_, i) => {
              const v = i / n;
              const x = lerp(outX, inX, v);
              const y = hemY + Math.sin(i * 1.7 + side) * 2.2 + (frayed ? (i % 2 ? -10 : 4) : 0) - (1 - v) * 4;
              return `${i ? "L" : ""}${f(x)} ${f(y)}`;
            }).join(" ");
            const d = `M${f(cx + side * 12)} 100 C${f(sx + side * 2)} 98 ${f(sx + side * 6)} 106 ${f(sx + side * 6)} 116 C${f(sx + side * 14)} 180 ${f(outX + side * 4)} ${f(hemY - 70)} ${f(outX)} ${f(hemY - 4)} L${hem} L${f(inX)} 104 Z`;
            const lining = `M${f(sx + side * 7)} 124 C${f(sx + side * 15)} 186 ${f(outX + side * 4)} ${f(hemY - 70)} ${f(outX)} ${f(hemY - 4)} L${f(outX - side * 6)} ${f(hemY - 2)} C${f(outX - side * 4)} ${f(hemY - 70)} ${f(sx + side * 8)} 190 ${f(sx + side * 2)} 126 Z`;
            return (
              <g key={side} className={live ? "aa-front-flap" : undefined} style={live ? { transformOrigin: `${f(sx)}px 104px`, animationDelay: side < 0 ? "0s" : "-2.4s" } : undefined}>
                <path d={d} fill={`url(#${uid}cp)`} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.4" />
                {look.capePattern && look.capePattern !== "liscio" && look.capePattern !== "stemma" ? (
                  look.capePattern === "stelle" ? (
                    <g>
                      <defs><clipPath id={`${uid}cs${side}`}><path d={d} /></clipPath></defs>
                      <g clipPath={`url(#${uid}cs${side})`} fill="#f4e7c2" opacity="0.75">
                        {Array.from({ length: 18 }, (_, i) => <circle key={i} cx={f(lerp(sx - side * 4, outX + side * 4, ((i * 37) % 100) / 100))} cy={f(110 + (((i * 61) % 100) / 100) * (hemY - 110))} r={i % 4 ? 0.9 : 1.6} />)}
                      </g>
                    </g>
                  ) : (
                    <ClothPattern kind={CAPE_CLOTH[look.capePattern] ?? (PATTERN2_IDS.has(look.capePattern) ? look.capePattern : "righe-verticali")} shapes={[d]} base={look.capeColor} trim={look.trim} uid={`${uid}cpp${side}`} box={[Math.min(sx, outX) - 8, 96, Math.max(sx, outX) + 8, hemY + 8]} />
                  )
                ) : null}
                <path d={lining} fill={shade(look.capeColor, -0.6)} opacity="0.85" />
                {[0.25, 0.5, 0.75].map((u) => {
                  const x0 = lerp(sx + side * 4, inX, 1 - u);
                  const x1 = lerp(outX, inX, 1 - u) + side * 2;
                  const fd = `M${f(x0)} 120 Q${f((x0 + x1) / 2 + side * 6)} ${f((120 + hemY) / 2)} ${f(x1)} ${f(hemY - 3)}`;
                  return (
                    <g key={u}>
                      <path d={fd} stroke={shade(look.capeColor, -0.6)} strokeOpacity="0.6" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                      <path d={fd} stroke={shade(look.capeColor, 0.35)} strokeOpacity="0.25" strokeWidth="1" fill="none" transform={`translate(${-side * 1.6} 0)`} />
                    </g>
                  );
                })}
                <path d={`M${hem.replace(/^/, "")}`} stroke={shade(look.capeColor, 0.3)} strokeOpacity="0.4" strokeWidth="1.1" fill="none" />
              </g>
            );
          };
          return <g className={live ? "aa-front-cape" : undefined}>{flap(-1)}{flap(1)}</g>;
        })() : null}
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

        {/* gambe un po' aperte, il peso su quella dell'arco; calzature con suola, punta e cuciture */}
        {legX.map((x, i) => {
          const sp = (i === 0 ? -1 : 1) * splay * (i === (bowSide > 0 ? 1 : 0) ? 1.4 : 0.8);
          const lx = (y: number) => x + (sp * (y - 206)) / 140;
          const L = (y: number, d: number) => f(lx(y) + d);
          return (
            <g key={x}>
              <path d={`M${L(206, -legW / 2)} 206 L${L(206, legW / 2)} 206 L${L(330, legW / 2 - (tight ? 2 : 0))} 330 L${L(330, -legW / 2 + (tight ? 2 : 0))} 330 Z`} fill={shorts ? skin : `url(#${uid}pa)`} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.4" />
              {shorts ? null : <path d={`M${L(268, -legW * 0.3)} 266 q${f(legW * 0.3)} 4 ${f(legW * 0.6)} 0 M${L(274, -legW * 0.25)} 273 q${f(legW * 0.25)} 3 ${f(legW * 0.5)} 0`} stroke="#000" strokeOpacity="0.25" strokeWidth="0.9" fill="none" />}
              {shorts ? null : <path d={`M${L(212, -legW * 0.22)} 212 L${L(326, -legW * 0.22)} 326`} stroke="#fff" strokeOpacity="0.1" strokeWidth={f(legW * 0.18)} strokeLinecap="round" />}
              {/* volume della gamba e ombra sotto la veste */}
              <path d={`M${L(206, -legW / 2)} 206 L${L(206, legW / 2)} 206 L${L(330, legW / 2 - (tight ? 2 : 0))} 330 L${L(330, -legW / 2 + (tight ? 2 : 0))} 330 Z`} fill={`url(#${uid}vol)`} pointerEvents="none" />
              <path d={`M${L(206, -legW / 2)} 206 L${L(206, legW / 2)} 206 L${L(226, legW / 2)} 226 L${L(226, -legW / 2)} 226 Z`} fill={`url(#${uid}ao)`} opacity="0.7" pointerEvents="none" />
              {shorts ? <path d={`M${L(206, -legW / 2 - 1)} 206 h${legW + 2} l${f(sp * 0.33)} 46 h${-legW - 2} Z`} fill={`url(#${uid}pa)`} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.2" /> : null}
              {look.bottom === "jeans" ? <path d={`M${L(214, i ? -3 : 3)} 214 L${L(326, i ? -3 : 3)} 326`} stroke={shade(look.pants, 0.3)} strokeWidth="0.8" strokeDasharray="3 2" /> : null}
              {look.wraps ? [0, 1, 2, 3, 4].map((k) => <path key={k} d={`M${L(246 + k * 12, -legW / 2)} ${246 + k * 12} L${L(240 + k * 12, legW / 2)} ${240 + k * 12}`} stroke={look.wrapsColor} strokeWidth="4" />) : null}
              {/* calzatura */}
              <path d={`M${L(bootTop, -legW / 2 - 1)} ${bootTop} L${L(bootTop, legW / 2 + 1)} ${bootTop} L${L(340, legW / 2 + 2)} 340 C${L(346, legW / 2 + 4)} 346 ${L(352, legW / 2 + 2)} 352 ${L(352, 0)} 352 C${L(352, -legW / 2 - 2)} 352 ${L(346, -legW / 2 - 4)} 346 ${L(340, -legW / 2 - 2)} 340 Z`} fill={look.footwear === "sandali" ? skin : `url(#${uid}bo)`} stroke={OUT} strokeOpacity="0.85" strokeWidth="1.4" />
              {look.footwear === "sandali" ? null : (
                <g fill="none" strokeLinecap="round">
                  <path d={`M${L(351, -legW / 2 - 2)} 350.5 Q${L(355, 0)} 355 ${L(351, legW / 2 + 2)} 350.5`} stroke="#14110e" strokeWidth="2.4" />
                  <path d={`M${L(348, -legW / 2)} 347.4 Q${L(351, 0)} 351 ${L(348, legW / 2)} 347.4`} stroke="#e8d9b0" strokeOpacity="0.35" strokeWidth="0.55" strokeDasharray="1.3 1.1" />
                  <ellipse cx={L(346, -2)} cy="345" rx={f(legW * 0.22)} ry="2" fill="#fff" opacity="0.16" />
                  <path d={`M${L(336, -legW * 0.3)} 334 q${f(legW * 0.3)} 2 ${f(legW * 0.6)} 0 M${L(330, -legW * 0.3)} 328 q${f(legW * 0.3)} 2 ${f(legW * 0.6)} 0`} stroke="#000" strokeOpacity="0.3" strokeWidth="0.8" />
                  {bootTop < 300 ? <path d={`M${L(bootTop + 6, -legW * 0.25)} ${bootTop + 6} L${L(336, -legW * 0.25)} 336`} stroke="#fff" strokeOpacity="0.14" strokeWidth="2.2" /> : null}
                </g>
              )}
              {look.footwear === "stivali-alti" ? (
                <g>
                  <path d={`M${L(bootTop - 3, -legW / 2 - 3)} ${bootTop - 3} L${L(bootTop - 4, legW / 2 + 3)} ${bootTop - 4} L${L(bootTop + 9, legW / 2 + 2)} ${bootTop + 9} L${L(bootTop + 10, -legW / 2 - 2)} ${bootTop + 10} Z`} fill={shade(look.shoes, -0.18)} stroke={OUT} strokeOpacity="0.75" strokeWidth="1" />
                  {[24, 30].map((d) => <path key={d} d={`M${L(bootTop + d, -legW / 2 - 1)} ${bootTop + d} L${L(bootTop + d, legW / 2 + 1)} ${bootTop + d}`} stroke={shade(look.shoes, -0.5)} strokeWidth="1.6" />)}
                  <rect x={L(bootTop + 23, legW * 0.15)} y={bootTop + 22.6} width="5" height="8.4" rx="1" fill="none" stroke="#c9a46a" strokeWidth="1" />
                </g>
              ) : null}
              {look.footwear === "stivali-pelliccia" ? [-1, 0, 1].map((k) => <circle key={k} cx={L(bootTop, k * legW * 0.4)} cy={bootTop} r="5.4" fill="#e3d6be" stroke={OUT} strokeOpacity="0.55" strokeWidth="0.6" />) : null}
              {look.footwear === "scarponi" ? (
                <g>
                  <path d={`M${L(348, -legW / 2 - 3)} 348 h${legW + 6} v4 h${-legW - 6} Z`} fill="#2a2622" />
                  {[0, 1, 2, 3].map((k) => <path key={k} d={`M${L(312 + k * 7, -3)} ${312 + k * 7} l6 2`} stroke="#e8d9b0" strokeWidth="1" />)}
                </g>
              ) : null}
              {look.special && !shorts ? <SpecialFrontLeg look={look} L={L} legW={legW} i={i} bootTop={bootTop} /> : null}
              {look.bottom === "cargo" ? <rect x={L(244, i ? 2 : -legW / 2 - 2)} y="244" width={legW / 2 + 1} height="16" rx="2" fill={shade(look.pants, -0.15)} stroke={shade(look.pants, -0.45)} strokeWidth="0.8" /> : null}
              {look.footwear === "stivali-risvolto" ? <path d={`M${L(bootTop, -legW / 2 - 3)} ${bootTop - 4} h${legW + 6} v9 h${-legW - 6} Z`} fill="#eee2c8" stroke={OUT} strokeOpacity="0.65" strokeWidth="1" /> : null}
              {look.footwear === "sportive" ? <path d={`M${L(346, -legW / 2 - 2)} 346 h${legW + 4} v4 h${-legW - 4} Z`} fill="#f2efe8" /> : null}
              {look.footwear === "sandali" ? <path d={`M${L(330, -legW / 2)} 330 L${L(340, legW / 2)} 340 M${L(330, legW / 2)} 330 L${L(340, -legW / 2)} 340`} stroke={look.shoes} strokeWidth="2.4" /> : null}
            </g>
          );
        })}

        {look.bottom === "gonna" ? (
          <g>
            <path d={`M${hip.l - 2} 200 L${hip.r + 2} 200 L${hip.r + 12} 262 Q${cx} 268 ${hip.l - 12} 262 Z`} fill={`url(#${uid}pa)`} stroke={OUT} strokeOpacity="0.8" strokeWidth="1.4" />
            {[-0.7, -0.35, 0, 0.35, 0.7].map((k) => <path key={k} d={`M${cx + k * 28} 204 L${cx + k * 38} 262`} stroke={shade(look.pants, -0.35)} strokeWidth="1" />)}
          </g>
        ) : null}
        <g className={live ? "aa-front-breath" : undefined}>
        {/* capelli lunghi e cappuccio: dietro il corpo */}
        <svg x={cx - 65} y="-8" width="130" height="130" viewBox="0 0 100 100" overflow="visible">
          <AvatarFace look={look} className="" bare part="back" />
        </svg>
        {/* collo: disegnato prima della veste, così colletti e scolli lo coprono come di profilo */}
        <g className={live ? "aa-front-head" : undefined}>
          {/* collo: più stretto sotto il mento, si allarga nelle spalle; ombra del mento, muscoli appena segnati */}
          <path d={`M${cx - 7.5} 76 L${cx + 7.5} 76 C${cx + 8} 88 ${cx + 9.5} 96 ${cx + 16} 103 L${cx - 16} 103 C${cx - 9.5} 96 ${cx - 8} 88 ${cx - 7.5} 76 Z`} fill={shade(skin, -0.2)} />
          <path d={`M${cx - 7.5} 76 C${cx - 8} 88 ${cx - 9.5} 96 ${cx - 16} 103 L${cx - 10} 103 C${cx - 6} 96 ${cx - 5} 88 ${cx - 5} 78 Z M${cx + 7.5} 76 C${cx + 8} 88 ${cx + 9.5} 96 ${cx + 16} 103 L${cx + 10} 103 C${cx + 6} 96 ${cx + 5} 88 ${cx + 5} 78 Z`} fill={shade(skin, -0.36)} opacity="0.5" />
          <ellipse cx={cx} cy="83" rx="9" ry="5" fill={`url(#${uid}sd)`} opacity="0.75" />
          <path d={`M${cx - 6} 84 Q${cx - 4} 94 ${cx - 1.4} 101 M${cx + 6} 84 Q${cx + 4} 94 ${cx + 1.4} 101`} stroke={shade(skin, -0.4)} strokeOpacity="0.3" strokeWidth="0.7" fill="none" />
          <path d={`M${cx - 7.5} 76 C${cx - 8} 88 ${cx - 9.5} 96 ${cx - 16} 103 M${cx + 7.5} 76 C${cx + 8} 88 ${cx + 9.5} 96 ${cx + 16} 103`} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.2" fill="none" />
        </g>
        {/* veste */}
        {longTop ? <path d={tunicD} fill={`url(#${uid}sh)`} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.4" /> : null}
        <path d={torsoD} fill={`url(#${uid}sh)`} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.4" />
        <ClothPattern kind={look.pattern} shapes={longTop ? [torsoD, tunicD] : [torsoD]} base={shirt} trim={look.trim} uid={`${uid}f`} box={[sh.l - 16, 94, sh.r + 16, (longTop ? hem : 208) + 6]} />
        <ClothDetail uid={`${uid}cd`} shapes={longTop ? [torsoD, tunicD] : [torsoD]} cx={cx} shoulderL={sh.l} shoulderR={sh.r} hipL={hip.l} hipR={hip.r} tunicLen={longTop ? hem : 206} longTunic={longTop} seam={seamOf(shirt)} />
        <FrontTop look={look} cx={cx} sh={sh} waist={waist} hip={hip} hem={hem} sideLen={sideLen} longTop={longTop} skin={skin} shirt={shirt} sleeve={sleeve} uid={uid} tw={tw} />
        <g pointerEvents="none">
          <clipPath id={`${uid}vc`}>
            <path d={torsoD} />
            {longTop ? <path d={tunicD} /> : null}
          </clipPath>
          <g clipPath={`url(#${uid}vc)`}>
            <rect x={sh.l - 20} y="90" width={sh.r - sh.l + 40} height={(longTop ? hem : 210) - 84} fill={`url(#${uid}vol)`} />
            {/* ombra sotto il petto, sotto la cintura e lungo l'orlo */}
            <ellipse cx={cx} cy="166" rx={(sh.r - sh.l) * 0.42} ry="14" fill="#000" opacity="0.08" />
            <rect x={sh.l - 20} y="193" width={sh.r - sh.l + 40} height="16" fill={`url(#${uid}ao)`} />
            <ellipse cx={cx - 8} cy="118" rx={(sh.r - sh.l) * 0.26} ry="9" fill="#fff" opacity="0.07" />
          </g>
        </g>
        {look.chestguard ? <path d={`M${cx + bowSide * 6} 118 C${cx + bowSide * 30} 116 ${cx + bowSide * 34} 150 ${cx + bowSide * 26} 168 L${cx + bowSide * 6} 164 Z`} fill={look.chestColor} opacity="0.92" stroke={OUT} strokeOpacity="0.7" strokeWidth="1" /> : null}
        {look.straps ? <path d={`M${sh.l + 8} 106 L${hip.r - 6} 196 M${sh.r - 8} 106 L${hip.l + 6} 196`} stroke="#3a2414" strokeWidth="4.4" /> : null}
        {look.special ? <SpecialFrontTorso look={look} cx={cx} sh={sh} hip={hip} uid={uid} /> : null}
        {look.sash ? <path d={`M${waist.l - 2} 182 Q${cx} 192 ${waist.r + 2} 182 L${waist.r + 2} 194 Q${cx} 204 ${waist.l - 2} 194 Z M${waist.l + 6} 192 l-6 34 l10 -4 Z`} fill={look.sashColor} /> : null}
        {look.belt !== "nessuna" ? (
          <g>
            <path d={`M${waist.l - 1} ${look.belt === "larga" ? 184 : 187} L${waist.r + 1} ${look.belt === "larga" ? 184 : 187} L${waist.r + 1} 194 L${waist.l - 1} 194 Z`} fill={look.beltColor} stroke={OUT} strokeOpacity="0.7" strokeWidth="1" />
            <BeltDetail uid={uid} x={waist.l - 1} y={look.belt === "larga" ? 184 : 187} w={waist.r - waist.l + 2} h={look.belt === "larga" ? 10 : 7} cx={cx} />
            {look.buckle && look.buckle !== "semplice" ? <Buckle kind={look.buckle} x={cx} y={190} /> : <rect x={cx - 5} y={look.belt === "larga" ? 183 : 186} width="10" height={look.belt === "larga" ? 12 : 9} rx="1.5" fill="none" stroke="#d9b45a" strokeWidth="1.8" />}
          </g>
        ) : null}
        {look.pouch ? <Pouch kind={look.pouchType} x={cx - bowSide * 24} y={192} /> : null}
        <ChestEmblem kind={look.emblem} crest={look.crest} x={look.emblem === "compagnia" ? cx : cx - bowSide * 14} y={look.emblem === "compagnia" ? 150 : 134} s={look.emblem === "compagnia" ? 1.25 : 0.85} base={shirt} trim={look.trim} />
        {/* bottoni come di profilo: sul petto se non c'è lo stemma, sulla falda sotto la cintura se la veste è lunga */}
        {BUTTON_TOPS[look.top] && !(look.special === "simone-inverno" && look.top === "giacca") ? (look.emblem !== "nessuno" ? (longTop ? [205, 217] : []) : [118, 132, 146, 160, 174, ...(longTop ? [205, 217] : [])]).map((y) => <ClothButton key={y} x={cx} y={y} r={2.2} color={BUTTON_TOPS[look.top]} metal={look.top === "giubbetto" || look.top === "divisa" || look.top === "cappotto-lungo"} />) : null}
        {look.cape && look.clasp !== "nessuno" ? (
          // due fermagli sul davanti, uniti da una catenella che pende sul petto
          <g>
            <path d={`M${cx - 16} 102 Q${cx} 112 ${cx + 16} 102`} stroke="#5d5040" strokeWidth="2" fill="none" />
            <path d={`M${cx - 16} 102 Q${cx} 112 ${cx + 16} 102`} stroke={look.clasp === "argento" ? "#d7dbe1" : "#d9b45a"} strokeWidth="1.4" strokeDasharray="1.6 1" fill="none" />
            <Clasp kind={look.clasp} x={cx - 16} y={102} s={0.85} />
            <Clasp kind={look.clasp} x={cx + 16} y={102} s={0.85} />
          </g>
        ) : null}
        {!quiverBack ? (
          <g transform={`translate(${cx - bowSide * (hip.r - cx + 10)} ${222 + tune(look.quiverY, 0, -40, 40)}) rotate(${-bowSide * 8 + spin})`}>
            {[-4, 0, 4].map((dx, i) => <path key={dx} d={`M${dx} -42 l-3.4 -9 l3.4 2.6 l3.4 -2.6 z`} fill={i === 1 ? look.cock : look.fletch} />)}
            <QuiverBody kind={look.quiverStyle} color={look.quiver} w={18} h={70} top={-40} />
            <rect x="-10" y="-42" width="20" height="6" rx="2" fill={shade(look.quiver, -0.3)} />
          </g>
        ) : null}
        {look.fur ? <g fill={look.furColor} stroke={shade(look.furColor, -0.4)} strokeWidth="0.8">{[-34, -24, -14, 14, 24, 34].map((dx, i) => <circle key={dx} cx={cx + dx * tw} cy={102 + (i % 2) * 3} r="9" />)}</g> : null}
        {look.scarf ? <path d={`M${cx - 18} 96 Q${cx} 108 ${cx + 18} 96 L${cx + 16} 104 Q${cx} 116 ${cx - 16} 104 Z M${cx + 8} 106 l4 30 l8 -2 l-6 -28 Z`} fill={look.scarfColor} /> : null}
        {look.cowl && !(look.special === "simone-medievale" && look.style === "medievale") ? <path d={`M${sh.l + 4} 104 C${cx - 20} 92 ${cx + 20} 92 ${sh.r - 4} 104 C${cx + 22} 124 ${cx - 22} 124 ${sh.l + 4} 104 Z`} fill={look.cowlColor} stroke={shade(look.cowlColor, -0.35)} strokeWidth="1" /> : null}
        {look.pendant && look.pendant !== "nessuno" ? <Pendant kind={look.pendant} x={cx} y={look.amulet ? 112 : 118} w={look.amulet ? 8 : 10} y0={100} s={1.05} /> : null}
        {look.amulet ? <g><path d={`M${cx - 11} 100 Q${cx} 126 ${cx + 11} 100`} stroke="#c9a46a" strokeWidth="1" fill="none" /><path d={`M${cx} 122 l5 7 l-5 7 l-5 -7 Z`} fill="#d9b45a" stroke="#7a5a1a" strokeWidth="0.8" /><circle cx={cx} cy="129" r="2" fill="#2f9e7a" /></g> : null}
        {look.necklace && look.top === "giubbetto" ? (
          <g>
            <path d={`M${cx - 18} 99 Q${cx} 134 ${cx + 18} 99`} stroke="#5d6168" strokeWidth="3" fill="none" />
            <path d={`M${cx - 18} 99 Q${cx} 134 ${cx + 18} 99`} stroke="#d7dbe1" strokeWidth="2" strokeDasharray="1.8 1.2" fill="none" />
          </g>
        ) : look.necklace ? <path d={`M${cx - 10} 100 Q${cx} 114 ${cx + 10} 100`} stroke="#d9b45a" strokeWidth="1.4" fill="none" /> : null}

        {/* faretra al fianco sopra la veste, sotto il braccio */}
        {armsOut != null ? null : heldArrow}
        {arm(bowSide === 1 ? -1 : 1)}
        {arm(bowSide)}
        {look.special && armsOut == null ? <SpecialFrontTorso look={look} cx={cx} sh={sh} hip={hip} layer="over" uid={uid} /> : null}
        {/* arco nella mano: flettenti, riser con impugnatura, corda con serving e punto d'incocco, pugno chiuso */}
        {armsOut != null ? null : (
        <g transform={`translate(${f(grip.x)} ${f(grip.y)}) scale(${bowSide} 1) rotate(5)`}>
          <g className={live ? "aa-front-bow" : undefined}>
            {([1, -1] as const).map((sg) => (
              <g key={sg}>
                <path d={limbD(sg)} stroke={OUT} strokeOpacity="0.85" strokeWidth={longbow ? 8 : 7} strokeLinecap="round" fill="none" />
                <path d={limbD(sg)} stroke={limbs} strokeWidth={longbow ? 5.8 : 4.8} strokeLinecap="round" fill="none" />
                <path d={limbD(sg)} stroke={shade(limbs, wood ? 0.35 : 0.55)} strokeOpacity={wood ? 0.6 : 0.4} strokeWidth="1.4" strokeLinecap="round" fill="none" transform="translate(1.2 0)" />
                <path d={limbD(sg)} stroke="#000" strokeOpacity="0.25" strokeWidth="1.2" strokeLinecap="round" fill="none" transform="translate(-1.4 0)" />
                <circle cx={tip(sg).x} cy={tip(sg).y} r={longbow ? 2.6 : 2.1} fill={wood ? "#efe3c4" : "#2a2f35"} stroke={OUT} strokeOpacity="0.8" strokeWidth="0.7" />
                {compound ? <g transform={`translate(${tipX} ${-half * sg})`}><ellipse rx="7" ry="8" fill="#b7c0c8" stroke="#2a2f35" strokeWidth="1.2" /><ellipse rx="3.6" ry="4.2" fill="#8a939c" /><circle r="1.2" fill="#e3a21a" /></g> : null}
              </g>
            ))}
            <path d={`M${f(tip(1).x)} ${f(tip(1).y)} L${f(strX)} 0 L${f(tip(-1).x)} ${f(tip(-1).y)}`} stroke={look.string || "#f4f1ea"} strokeWidth="1.1" fill="none" opacity="0.92" />
            <path d={`M${f(strX)} -16 V18`} stroke={shade(look.string || "#f4f1ea", -0.55)} strokeWidth="2" strokeLinecap="round" />
            <circle cx={f(strX)} cy="-3" r="1.4" fill="#d9b45a" />
            {/* riser */}
            {longbow ? (
              <g>
                <rect x="-4.6" y="-14" width="9.2" height="28" rx="3.4" fill="#4a2c16" stroke={OUT} strokeOpacity="0.8" strokeWidth="0.8" />
                {[0, 1, 2, 3, 4, 5].map((k) => <path key={k} d={`M-4.4 ${-11 + k * 4.2} L4.4 ${-9 + k * 4.2}`} stroke="#c9a46a" strokeWidth="0.7" opacity="0.8" />)}
              </g>
            ) : (
              <g>
                <path d={`M-1 ${-rs} L8 ${-rs} C9 ${-rs * 0.5} 10 -12 9 -8 L9 ${rs} L-1 ${rs} C-2 ${rs * 0.6} -2 14 -4 9 C-5 4 -5 -6 -2 -11 Z`} fill={`url(#${uid}ri)`} stroke={OUT} strokeOpacity="0.85" strokeWidth="0.9" />
                {wood ? null : <path d={`M3 ${-rs + 6} L7 ${-rs + 6} L7 -10 L3.4 -10 Z`} fill="#000" opacity="0.3" />}
                <path d="M9 -6 l4 0 l0 2.4" stroke="#c9d0d8" strokeWidth="1.1" fill="none" />
                {look.bowType === "olimpico" ? (
                  <g>
                    {/* stabilizzatore lungo che viene verso chi guarda e mirino */}
                    <path d="M6 20 L16 44" stroke="#1d2126" strokeWidth="3.4" strokeLinecap="round" />
                    <circle cx="16.4" cy="45" r="4.4" fill="#2a2f35" />
                    <circle cx="16.4" cy="45" r="2" fill="#e07a2f" />
                    <path d="M8 -22 L26 -28 L26 -44" stroke="#9aa3ad" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                    <circle cx="26" cy="-47" r="3" fill="#a8d8ff" fillOpacity="0.35" stroke="#e3a21a" strokeWidth="1.3" />
                  </g>
                ) : null}
              </g>
            )}
            {/* pugno chiuso sull'impugnatura: nocche, dita che avvolgono, pollice */}
            <g>
              <ellipse cx="2" cy="1" rx={f(handR * 0.95 + 1.2)} ry={f(handR + 1.6)} fill={OUT} opacity="0.5" />
              <ellipse cx="2" cy="1" rx={f(handR * 0.95)} ry={f(handR)} fill={handFill} />
              {[-4.6, -1.4, 1.8, 5].map((y) => <path key={y} d={`M${f(2 - handR * 0.8)} ${y} Q2 ${y + 1.2} ${f(2 + handR * 0.85)} ${y - 0.4}`} stroke={look.gloves ? "#1a0e06" : shade(skin, -0.35)} strokeWidth="0.75" fill="none" strokeLinecap="round" />)}
              {[-4.6, -1.4, 1.8, 5].map((y) => <circle key={`k${y}`} cx={f(2 + handR * 0.82)} cy={y - 0.6} r="1.3" fill={look.gloves ? "#5a3a20" : shade(skin, 0.08)} stroke={look.gloves ? "#1a0e06" : shade(skin, -0.3)} strokeWidth="0.4" />)}
              <path d={`M${f(2 - handR * 0.7)} -6 C-1 -10 6 -10 8 -7`} stroke={handFill} strokeWidth="3.2" strokeLinecap="round" fill="none" />
              <path d={`M${f(2 - handR * 0.7)} -6 C-1 -10 6 -10 8 -7`} stroke={look.gloves ? "#1a0e06" : shade(skin, -0.35)} strokeWidth="0.6" strokeLinecap="round" fill="none" transform="translate(0 1.6)" />
              <ellipse cx="0" cy="-3" rx={f(handR * 0.35)} ry={f(handR * 0.26)} fill="#fff" opacity="0.18" />
            </g>
          </g>
        </g>
        )}

        {/* testa di fronte, la stessa della foto profilo */}
        <g className={live ? "aa-front-head" : undefined}>
          <svg x={cx - 65} y="-8" width="130" height="130" viewBox="0 0 100 100" overflow="visible">
            <AvatarFace look={look} className="" bare part="front" />
          </svg>
        </g>
        </g>
        </g>
      </g>
    </svg>
  );
}

/** quanto è alto l'arciere di fronte (ragazzi più bassi, statura scelta): scala attorno ai piedi (100, 360) */
export function frontScale(look: AvatarLook) {
  const kid = look.body === "ragazzo" || look.body === "ragazza";
  return (kid ? 0.84 : 1) * (0.9 + (tune(look.stature, 50, 0, 100) / 100) * 0.2);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpP(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function f(n: number) {
  return n.toFixed(1);
}

/**
 * Dettagli della veste vista di fronte: gli stessi della figura di profilo (Outfit), uno per uno,
 * riportati nelle coordinate del busto frontale. Scollo, colletti, chiusure, alamari, bordi e balze.
 */
function FrontTop({ look, cx, sh, waist, hip, hem, sideLen, longTop, skin, shirt, sleeve, uid, tw }: { look: AvatarLook; cx: number; sh: { l: number; r: number }; waist: { l: number; r: number }; hip: { l: number; r: number }; hem: number; sideLen: number; longTop: boolean; skin: string; shirt: string; sleeve: string; uid: string; tw: number }) {
  const tr = look.trim;
  const neckC = shade(skin, -0.2);
  // dal profilo al fronte: sopra la cintura e sulla falda
  const yt = (y: number) => 97 + (y - 116) * 1.0714;
  const yb = (y: number) => 196 + (y - 210) * (hem - 196) / Math.max(1, sideLen - 210);
  const clip = `url(#${uid}tcl)`;
  /** scollo aperto: pelle del collo dentro, bordo sopra */
  const scoop = (w: number, depth: number, stroke: string, sw: number, v = false) => {
    const d = v ? `M${cx - w} 97.4 L${cx} ${97 + depth} L${cx + w} 97.4` : `M${cx - w} 97.4 Q${cx} ${97 + depth * 2} ${cx + w} 97.4`;
    return (
      <g>
        <path d={`${d} Q${cx} 95.6 ${cx - w} 97.4 Z`} fill={neckC} />
        <path d={`M${cx - w * 0.7} 98 Q${cx} ${97 + depth * 0.9} ${cx + w * 0.7} 98`} stroke={shade(skin, -0.38)} strokeOpacity="0.4" strokeWidth="0.8" fill="none" />
        <path d={d} stroke={stroke} strokeWidth={sw} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </g>
    );
  };
  const hemTrim = (w: number) => (longTop ? <path d={`M${hip.l - 14} ${hem - 3} Q${cx} ${hem + 3} ${hip.r + 14} ${hem - 3}`} stroke={tr} strokeWidth={w} fill="none" /> : <path d={`M${hip.l} 205 L${hip.r} 205`} stroke={tr} strokeWidth={w * 0.8} />);
  const folds = (xs: number[]) => (longTop ? xs.map((k) => <path key={k} d={`M${cx + k * 14 * tw} 200 Q${cx + k * 15 * tw + 2} ${(200 + hem) / 2} ${cx + k * 18 * tw} ${hem - 4}`} stroke={shade(shirt, -0.22)} strokeWidth="1" fill="none" />) : null);
  switch (look.top) {
    case "polo":
      return (
        <g>
          {scoop(8, 7, shade(shirt, -0.3), 1, true)}
          <path d={`M${cx - 11} 96.6 L${cx} 110 L${cx + 11} 96.6 L${cx + 7} 95.6 L${cx} 104 L${cx - 7} 95.6 Z`} fill={tr} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.6" />
          <path d={`M${cx} 104 v14`} stroke={shade(shirt, -0.3)} strokeWidth="1" />
          {[110, 116].map((y) => <circle key={y} cx={cx} cy={y} r="1.1" fill={tr} />)}
        </g>
      );
    case "felpa":
      return (
        <g>
          <path d={`M${cx - 19} 99 C${cx - 15} 91 ${cx + 15} 91 ${cx + 19} 99 C${cx + 10} 109 ${cx - 10} 109 ${cx - 19} 99 Z`} fill={shade(shirt, -0.3)} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.8" />
          <path d={`M${cx - 9} 99 Q${cx} 104 ${cx + 9} 99`} fill="none" stroke={shade(shirt, -0.5)} strokeWidth="1" />
          <path d={`M${cx - 5} 105 v17 M${cx + 5} 105 v15`} stroke={tr} strokeWidth="1.3" strokeLinecap="round" />
          <path d={`M${cx - 18} ${yt(176)} h36 l4 ${yt(196) - yt(176)} h-44 Z`} fill={shade(shirt, -0.12)} stroke={shade(shirt, -0.35)} strokeWidth="0.8" />
          <rect x={hip.l} y="198" width={hip.r - hip.l} height="10" rx="3" fill={shade(shirt, -0.3)} />
        </g>
      );
    case "gilet":
      return (
        <g>
          {scoop(10, 10, tr, 3.6, true)}
          <path d={`M${cx - 10} 104 L${cx - 6} 196 M${cx + 10} 104 L${cx + 6} 196`} stroke={shade(shirt, -0.4)} strokeWidth="1.4" />
          <path d={`M${cx} 106 v90`} stroke={shade(shirt, 0.4)} strokeWidth="1.2" strokeDasharray="2 1.5" />
          <path d={`M${sh.l + 10} ${yt(150)} h14 M${sh.r - 24} ${yt(150)} h14`} stroke={shade(shirt, -0.35)} strokeWidth="2" />
        </g>
      );
    case "giacca":
      return (
        <g>
          {scoop(13, 12, shade(shirt, -0.3), 0.8, true)}
          <path d={`M${cx} 110 V196`} stroke={shade(shirt, 0.45)} strokeWidth="1.4" />
          <path d={`M${cx - 16} 96 L${cx} 110 L${cx + 16} 96 L${cx + 17} 104 L${cx} 118 L${cx - 17} 104 Z`} fill={shade(shirt, -0.3)} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.7" />
          <path d={`M${cx - 22} ${yt(160)} h12 M${cx + 10} ${yt(160)} h12`} stroke={shade(shirt, -0.3)} strokeWidth="1.6" />
        </g>
      );
    case "tunica":
      return (
        <g>
          {scoop(13, 9, tr, 3.5)}
          <path d={`M${cx} 106 v15`} stroke={shade(shirt, -0.35)} strokeWidth="1.2" />
          {longTop ? <path d={`M${cx} 198 L${cx} ${hem}`} stroke={shade(shirt, -0.25)} strokeWidth="1.2" /> : null}
          {hemTrim(4)}
        </g>
      );
    case "tunica-lunga":
      return (
        <g>
          {scoop(13, 6, shade(shirt, -0.3), 2.4)}
          <path d={`M${cx + 1} 103 L${cx + 1} 186`} stroke={shade(shirt, -0.25)} strokeWidth="1.4" />
          {[128, 141, 154, 167, 180].map((y) => (
            <g key={y}>
              <circle cx={cx + 3.5} cy={yt(y)} r="2" fill={tr} stroke={shade(tr, -0.4)} strokeWidth="0.6" />
              <circle cx={cx + 3} cy={yt(y) - 0.6} r="0.6" fill="#fff" opacity="0.6" />
            </g>
          ))}
          {folds([-1, -0.3, 0.4, 1])}
          <path d={`M${sh.l + 10} ${yt(152)} q8 4 16 0 M${sh.r - 26} ${yt(152)} q8 4 16 0`} stroke={shade(shirt, -0.2)} strokeWidth="1" fill="none" />
        </g>
      );
    case "farsetto":
      return (
        <g>
          <g clipPath={clip}>
            {[-2, -1, 0, 1, 2].map((k) => <path key={k} d={`M${cx + k * 12 * tw} 100 L${cx + k * 12.6 * tw} 208`} stroke={shade(shirt, -0.25)} strokeWidth="1" />)}
            {[146, 166, 186].map((y) => <path key={y} d={`M${sh.l - 4} ${yt(y)} H${sh.r + 4}`} stroke={shade(shirt, -0.2)} strokeWidth="0.8" />)}
          </g>
          {[124, 140, 156, 172].map((y) => <circle key={y} cx={cx} cy={y} r="1.8" fill={tr} />)}
          {/* colletto ritto che avvolge la base del collo */}
          <path d={`M${cx - 12} 90 Q${cx} 92.6 ${cx + 12} 90 L${cx + 13} 99 Q${cx} 102 ${cx - 13} 99 Z`} fill={tr} stroke={OUT} strokeOpacity="0.75" strokeWidth="0.9" />
          <path d={`M${cx - 11} 91.4 Q${cx} 93.8 ${cx + 11} 91.4`} stroke="#fff" strokeOpacity="0.25" strokeWidth="0.7" fill="none" />
        </g>
      );
    case "corpetto":
      return (
        <g>
          {scoop(11, 8, tr, 3)}
          <path d={`M${sh.l + 10} 112 C${cx - 12} 106 ${cx + 12} 106 ${sh.r - 10} 112 L${waist.r - 2} 186 L${waist.l + 2} 186 Z`} fill="#6b4224" stroke={OUT} strokeOpacity="0.7" strokeWidth="1" />
          <path d={`M${sh.l + 10} 112 C${cx - 12} 106 ${cx + 12} 106 ${sh.r - 10} 112 L${waist.r - 2} 186 L${waist.l + 2} 186 Z`} fill={`url(#${uid}grain)`} />
          {[122, 135, 148, 161, 174].map((y) => <path key={y} d={`M${cx - 4} ${y} L${cx + 4} ${y + 6} M${cx + 4} ${y} L${cx - 4} ${y + 6}`} stroke="#e8d9b0" strokeWidth="0.9" />)}
        </g>
      );
    case "ranger": {
      // lembo incrociato: scende in diagonale dalla spalla al fianco e sulla falda
      const edge = `M${cx - 14} 98 C${cx - 4} 124 ${cx + 10} 160 ${hip.r} 196 L${hip.r + 12} ${longTop ? hem : 206}`;
      return (
        <g>
          {scoop(13, 8, shade(shirt, -0.3), 1.4)}
          <g clipPath={clip}>
            <path d={`${edge} L${sh.r + 30} ${hem + 10} L${sh.r + 30} 90 Z`} fill={shade(shirt, -0.12)} opacity="0.55" />
            <path d={edge} stroke={OUT} strokeOpacity="0.6" strokeWidth="1" fill="none" transform="translate(-2 1)" />
          </g>
          <path d={edge} stroke={tr} strokeWidth="3" fill="none" />
        </g>
      );
    }
    case "incrociata":
      return (
        <g>
          <path d={`M${cx - 14} 97.4 L${cx + 1} 132 L${cx + 14} 97.4 Q${cx} 95.6 ${cx - 14} 97.4 Z`} fill={neckC} />
          <path d={`M${cx - 14} 97 L${cx + 8} 150 M${cx + 14} 97 L${cx - 4} 136`} stroke={tr} strokeWidth="5" strokeLinecap="round" />
          <path d={`M${cx - 14} 97 L${cx + 8} 150`} stroke={shade(tr, -0.35)} strokeWidth="1" transform="translate(2 0)" />
          {look.sash ? null : <rect x={waist.l - 3} y="172" width={waist.r - waist.l + 6} height="20" rx="3" fill={shade(tr, -0.1)} stroke={OUT} strokeOpacity="0.7" strokeWidth="1.2" />}
          {longTop ? <path d={`M${hip.l - 4} ${yb(232)} Q${cx} ${yb(238)} ${hip.r + 6} ${yb(230)}`} stroke={shade(shirt, -0.3)} strokeWidth="1.4" fill="none" /> : null}
          {folds([-1, 0, 1])}
        </g>
      );
    case "giubba":
      // giubba di cuoio sopra la camicia, chiusa da alamari
      return (
        <g>
          <path d={`M${cx - 11} 96.6 Q${cx} 102 ${cx + 11} 96.6 L${cx + 12} 104 Q${cx} 110 ${cx - 12} 104 Z`} fill={look.sleeves || "#c9b48a"} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.7" />
          <path d={`M${cx} 104 L${cx} 186`} stroke={shade(shirt, -0.45)} strokeWidth="1.4" />
          {longTop ? <path d={`M${cx} 198 L${cx} ${hem}`} stroke={shade(shirt, -0.5)} strokeWidth="2" /> : null}
          {[136, 150, 164, 178].map((y) => (
            <g key={y}>
              <rect x={cx - 6} y={yt(y) - 1.7} width="12" height="3.4" rx="1.7" fill={tr} stroke={shade(tr, -0.45)} strokeWidth="0.6" />
              <path d={`M${cx - 10} ${yt(y)} h3.4 M${cx + 6.6} ${yt(y)} h3.4`} stroke={shade(shirt, -0.5)} strokeWidth="1.2" />
            </g>
          ))}
          <path d={`M${sh.l + 4} 110 C${sh.l + 6} 136 ${sh.l + 4} 160 ${waist.l + 2} 184 M${sh.r - 4} 110 C${sh.r - 6} 136 ${sh.r - 4} 160 ${waist.r - 2} 184`} stroke={shade(shirt, 0.25)} strokeWidth="1" strokeDasharray="2.5 2" fill="none" />
        </g>
      );
    case "cappotto":
    case "cappotto-lungo": {
      // collo alto che avvolge la base del collo, chiusura bordata, bottoni del colore del bordo
      const long = look.top === "cappotto-lungo";
      return (
        <g>
          <path d={`M${cx + 2} 100 L${cx + 4} ${longTop ? hem : 206}`} stroke={tr} strokeWidth="2.4" />
          <path d={`M${cx + 2} 100 L${cx + 4} ${longTop ? hem : 206}`} stroke={OUT} strokeOpacity="0.7" strokeWidth="0.8" transform="translate(-2 0)" />
          {[132, 146, 160, 174].map((y) => <circle key={y} cx={cx + 9} cy={yt(y)} r="1.7" fill={tr} stroke={shade(tr, -0.4)} strokeWidth="0.5" />)}
          <path d={`M${sh.l + 6} ${yt(140)} L${cx - 8} ${yt(140)} M${sh.r - 6} ${yt(140)} L${cx + 14} ${yt(140)}`} stroke={shade(shirt, -0.4)} strokeWidth="1.2" />
          {hemTrim(2)}
          {long && longTop ? (
            <g>
              {[-1, 1].map((k) => <path key={k} d={`M${cx + k * 18 * tw} 198 L${cx + k * 23 * tw} ${hem}`} stroke={shade(shirt, -0.5)} strokeWidth="1.6" />)}
              {[-1, 1].map((k) => <path key={`t${k}`} d={`M${cx + k * 18 * tw + 2} 198 L${cx + k * 23 * tw + 2} ${hem}`} stroke={tr} strokeWidth="1" opacity="0.7" />)}
              {[-1, 1].map((k) => <path key={`v${k}`} d={`M${cx + k * 30 * tw - 6} ${hem - 2} l6 9 l6 -9 Z`} fill={shade(shirt, -0.15)} stroke={tr} strokeWidth="1" strokeLinejoin="round" />)}
            </g>
          ) : folds([-1, 1])}
          <path d={`M${cx - 12} 86 Q${cx} 88.6 ${cx + 12} 86 L${cx + 14.5} 100 Q${cx} 103.6 ${cx - 14.5} 100 Z`} fill={shade(shirt, -0.15)} stroke={tr} strokeWidth="1.2" strokeLinejoin="round" />
          <path d={`M${cx - 12} 86 Q${cx} 88.6 ${cx + 12} 86`} stroke={OUT} strokeOpacity="0.7" strokeWidth="0.8" fill="none" />
          <path d={`M${cx + 2} 88 L${cx + 2} 102`} stroke={tr} strokeWidth="1.2" />
        </g>
      );
    }
    case "canotta":
      return (
        <g>
          {scoop(16, 13, tr, 2)}
          <path d={`M${sh.l + 4} 108 Q${sh.l + 10} 132 ${sh.l + 4} 152 M${sh.r - 4} 108 Q${sh.r - 10} 132 ${sh.r - 4} 152`} stroke={tr} strokeWidth="2" fill="none" />
        </g>
      );
    case "camicia":
      return (
        <g>
          {scoop(10, 10, shade(shirt, -0.3), 0.8, true)}
          <path d={`M${cx} 108 L${cx} 196`} stroke={shade(shirt, -0.3)} strokeWidth="1.2" />
          {[134, 148, 162, 176].map((y) => <circle key={y} cx={cx + 2} cy={yt(y)} r="1.3" fill={tr} />)}
          <rect x={cx + 8} y={yt(138)} width="13" height="12" rx="1.5" fill="none" stroke={shade(shirt, -0.35)} strokeWidth="1" />
          <path d={`M${cx - 12} 96 L${cx} 108 L${cx - 5} 116 L${cx - 15} 104 Z M${cx + 12} 96 L${cx} 108 L${cx + 5} 116 L${cx + 15} 104 Z`} fill={shade(shirt, 0.18)} stroke={shade(shirt, -0.4)} strokeWidth="0.8" />
        </g>
      );
    case "divisa":
      return (
        <g>
          {scoop(11, 7, tr, 3.2)}
          <path d={`M${sh.l + 2} 150 L${sh.r - 2} 134 L${sh.r - 2} 146 L${sh.l + 2} 162 Z`} fill={tr} opacity="0.9" />
          <path d={`M${sh.l + 2} 166 L${sh.r - 2} 150`} stroke={tr} strokeWidth="1.6" opacity="0.7" />
          <circle cx={cx + 16} cy={yt(128)} r="4.2" fill={shade(shirt, 0.3)} stroke={tr} strokeWidth="1" />
          <path d={`M${cx + 13.6} ${yt(128) + 1.6} l2.4 -4 l2.4 4`} stroke={tr} strokeWidth="0.9" fill="none" />
        </g>
      );
    case "cotta":
      return (
        <g>
          <path d={`M${sh.l - 6} 104 L${sh.r + 6} 104 L${hip.r + 16} ${longTop ? hem + 4 : 210} L${hip.l - 16} ${longTop ? hem + 4 : 210} Z`} fill="#8d949b" opacity="0.92" clipPath={clip} />
          <g opacity="0.85" clipPath={clip}>{Array.from({ length: Math.floor((hem - 104) / 5) }, (_, r) => <path key={r} d={`M${sh.l - 6} ${104 + r * 5} ${Array.from({ length: 26 }, () => "q1.8 2.6 3.6 0").join(" ")}`} stroke="#5d646b" strokeWidth="0.7" fill="none" />)}</g>
          {scoop(14, 8, sleeve, 5)}
          {hemTrim(2)}
        </g>
      );
    case "giubbetto":
      // scollo tondo del giubbetto: si vede la camicia, bordo a zig-zag d'argento
      return (
        <g>
          <path d={`M${cx - 17} 98 Q${cx} 130 ${cx + 17} 98 Q${cx} 95.6 ${cx - 17} 98 Z`} fill={sleeve} />
          <path d={`M${cx - 10} 97.4 Q${cx} 106 ${cx + 10} 97.4 Q${cx} 95.6 ${cx - 10} 97.4 Z`} fill={neckC} />
          <path d={`M${cx - 6} 99 L${cx} 112 L${cx + 6} 99`} stroke={shade(sleeve, -0.3)} strokeWidth="1" fill="none" />
          <path d={zigQ([cx - 17, 98], [cx, 130], [cx + 17, 98], 14, 2)} stroke={tr} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
          <path d={`M${sh.l + 4} 108 C${sh.l + 8} 126 ${sh.l + 8} 140 ${sh.l + 4} 150 M${sh.r - 4} 108 C${sh.r - 8} 126 ${sh.r - 8} 140 ${sh.r - 4} 150`} stroke={tr} strokeWidth="1.2" strokeDasharray="2.4 1.8" fill="none" opacity="0.85" />
          {longTop ? <path d={zigQ([hip.l - 14, hem - 3], [cx, hem + 3], [hip.r + 14, hem - 3], 26, 2.2)} stroke={tr} strokeWidth="1.6" fill="none" strokeLinejoin="round" /> : null}
        </g>
      );
    default:
      return (
        <g>
          {scoop(11, look.body === "donna" || look.body === "ragazza" ? 11 : 7, shade(shirt, -0.35), 2.5)}
          <path d={`M${cx - 15} ${yt(150)} h30`} stroke={tr} strokeWidth="5" opacity="0.85" />
        </g>
      );
  }
}
