/**
 * Mani dell'arciere: pugno chiuso con quattro dita che avvolgono (impugnatura dell'arco, freccia), nocche,
 * pollice con l'unghia, pieghe e luce da sinistra; con i guanti il cuoio, le cuciture e il polsino.
 * Di fronte (FrontFist) e di profilo, orientata lungo l'avambraccio (SideHand).
 */
import { useId } from "react";

type P = { x: number; y: number };
const f = (n: number) => n.toFixed(2);
const OUT = "#2a1d14";

function shade(hex: string, k: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, "0")}`;
}

/** i colori della mano: pelle (con le nocche un po' più calde) o cuoio del guanto */
function tones(skin: string, gloves: boolean) {
  const base = gloves ? "#4a2c16" : skin;
  return {
    base,
    hi: shade(base, gloves ? 0.22 : 0.16),
    lo: shade(base, gloves ? -0.42 : -0.24),
    line: gloves ? "#1a0e06" : shade(skin, -0.42),
    knuckle: gloves ? "#6b4526" : shade(skin, 0.05),
    nail: gloves ? "#5a3a20" : shade(skin, 0.42),
  };
}


/** volume della mano: luce sul lato da cui arriva, ombra verso il palmo */
function HandGrad({ id, t }: { id: string; t: ReturnType<typeof tones> }) {
  return (
    <defs>
      <radialGradient id={id} cx="0.32" cy="0.3" r="0.85">
        <stop offset="0" stopColor={t.hi} />
        <stop offset="0.5" stopColor={t.base} />
        <stop offset="1" stopColor={t.lo} />
      </radialGradient>
    </defs>
  );
}

/**
 * Pugno di fronte, al centro (x, y): l'impugnatura o la freccia passano in verticale. `flip` = 1 con le nocche a
 * destra di chi guarda, -1 a sinistra.
 */
export function FrontFist({ x, y, r, skin, gloves, flip = 1 }: { x: number; y: number; r: number; skin: string; gloves: boolean; flip?: 1 | -1 }) {
  const t = tones(skin, gloves);
  const gid = `hf${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const rows = [0, 1, 2, 3].map((k) => ({ y: -0.74 * r + k * 0.49 * r, x0: -0.78 * r + (k === 3 ? 0.14 * r : 0), x1: 0.94 * r - (k === 3 ? 0.12 * r : k === 0 ? 0.04 * r : 0) }));
  // sagoma del pugno: le quattro nocche sul lato esterno, il palmo arrotondato dall'altra parte
  const knuckles = rows.map((w) => `Q${f(w.x1 + 0.16 * r)} ${f(w.y)} ${f(w.x1)} ${f(w.y + 0.245 * r)}`).join(" ");
  const silhouette = `M${f(-0.62 * r)} ${f(-1.12 * r)} L${f(0.6 * r)} ${f(-1.12 * r)} C${f(0.82 * r)} ${f(-1.1 * r)} ${f(0.98 * r)} ${f(-0.98 * r)} ${f(0.94 * r)} ${f(-0.98 * r)} ${knuckles} C${f(0.7 * r)} ${f(1.2 * r)} ${f(-0.5 * r)} ${f(1.2 * r)} ${f(-0.72 * r)} ${f(0.98 * r)} C${f(-1.02 * r)} ${f(0.5 * r)} ${f(-1.04 * r)} ${f(-0.7 * r)} ${f(-0.62 * r)} ${f(-1.12 * r)} Z`;
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${flip} 1)`}>
      <HandGrad id={gid} t={t} />
      <path d={silhouette} fill={`url(#${gid})`} stroke={OUT} strokeOpacity="0.78" strokeWidth="0.5" strokeLinejoin="round" />
      {/* dita: rotoli sovrapposti, il bordo alto in luce e la piega scura sotto */}
      {rows.map((w, k) => (
        <g key={k}>
          <path d={`M${f(w.x0)} ${f(w.y + 0.2 * r)} C${f(w.x0)} ${f(w.y - 0.08 * r)} ${f(w.x1 - 0.1 * r)} ${f(w.y - 0.1 * r)} ${f(w.x1)} ${f(w.y + 0.12 * r)}`} stroke={t.hi} strokeWidth={f(0.045 * r)} fill="none" strokeLinecap="round" opacity="0.85" />
          {k < 3 ? <path d={`M${f(w.x0 + 0.04 * r)} ${f(w.y + 0.27 * r)} C${f(w.x0 + 0.3 * r)} ${f(w.y + 0.34 * r)} ${f(w.x1 - 0.2 * r)} ${f(w.y + 0.33 * r)} ${f(w.x1 + 0.02 * r)} ${f(w.y + 0.26 * r)}`} stroke={t.line} strokeWidth={f(0.032 * r)} fill="none" strokeLinecap="round" opacity="0.8" /> : null}
          {/* nocca */}
          <ellipse cx={f(w.x1 - 0.07 * r)} cy={f(w.y + 0.1 * r)} rx={f(0.09 * r)} ry={f(0.06 * r)} fill={t.knuckle} opacity="0.7" />
          <circle cx={f(w.x1 - 0.1 * r)} cy={f(w.y + 0.07 * r)} r={f(0.03 * r)} fill="#fff" opacity={gloves ? 0.3 : 0.45} />
          {gloves ? <path d={`M${f(w.x0 + 0.2 * r)} ${f(w.y + 0.02 * r)} L${f(w.x1 - 0.22 * r)} ${f(w.y)}`} stroke="#c9a46a" strokeOpacity="0.5" strokeWidth={f(0.022 * r)} strokeDasharray={`${f(0.09 * r)} ${f(0.08 * r)}`} /> : null}
        </g>
      ))}
      {/* ombra sul lato del palmo, in ombra (la luce viene da sinistra di chi guarda) */}
      <path d={`M${f(-0.7 * r)} ${f(-0.9 * r)} C${f(-0.92 * r)} ${f(-0.3 * r)} ${f(-0.9 * r)} ${f(0.5 * r)} ${f(-0.6 * r)} ${f(0.95 * r)}`} stroke={t.lo} strokeWidth={f(0.08 * r)} fill="none" opacity="0.35" strokeLinecap="round" />
      {/* pollice che chiude sopra l'indice, con l'unghia */}
      <path d={`M${f(-0.98 * r)} ${f(-0.42 * r)} C${f(-0.7 * r)} ${f(-0.98 * r)} ${f(-0.1 * r)} ${f(-1.02 * r)} ${f(0.42 * r)} ${f(-0.82 * r)}`} stroke={OUT} strokeOpacity="0.75" strokeWidth={f(0.44 * r)} fill="none" strokeLinecap="round" />
      <path d={`M${f(-0.98 * r)} ${f(-0.42 * r)} C${f(-0.7 * r)} ${f(-0.98 * r)} ${f(-0.1 * r)} ${f(-1.02 * r)} ${f(0.42 * r)} ${f(-0.82 * r)}`} stroke={t.base} strokeWidth={f(0.38 * r)} fill="none" strokeLinecap="round" />
      <path d={`M${f(-0.86 * r)} ${f(-0.62 * r)} C${f(-0.6 * r)} ${f(-1.02 * r)} ${f(-0.1 * r)} ${f(-1.08 * r)} ${f(0.3 * r)} ${f(-0.92 * r)}`} stroke={t.hi} strokeWidth={f(0.045 * r)} fill="none" strokeLinecap="round" opacity="0.9" />
      {gloves ? null : <ellipse cx={f(0.36 * r)} cy={f(-0.84 * r)} rx={f(0.15 * r)} ry={f(0.1 * r)} fill={t.nail} stroke={t.line} strokeWidth={f(0.03 * r)} strokeOpacity="0.6" transform={`rotate(-18 ${f(0.36 * r)} ${f(-0.84 * r)})`} />}
      <path d={`M${f(-0.4 * r)} ${f(-0.86 * r)} q${f(0.06 * r)} ${f(0.08 * r)} ${f(0.14 * r)} ${f(0.02 * r)}`} stroke={t.line} strokeWidth={f(0.03 * r)} fill="none" opacity="0.6" />
      {/* polsino del guanto */}
      {gloves ? (
        <g>
          <path d={`M${f(-0.74 * r)} ${f(-1.36 * r)} L${f(0.74 * r)} ${f(-1.36 * r)} L${f(0.68 * r)} ${f(-1.02 * r)} L${f(-0.68 * r)} ${f(-1.02 * r)} Z`} fill="#3a220f" stroke={OUT} strokeOpacity="0.7" strokeWidth="0.35" />
          <path d={`M${f(-0.62 * r)} ${f(-1.18 * r)} H${f(0.62 * r)}`} stroke="#c9a46a" strokeOpacity="0.55" strokeWidth={f(0.022 * r)} strokeDasharray={`${f(0.09 * r)} ${f(0.08 * r)}`} />
        </g>
      ) : null}
    </g>
  );
}

/**
 * Mano di profilo in h, orientata lungo l'avambraccio (dal gomito e). «bow»: pugno sull'impugnatura con le nocche
 * avanti; «draw»: dita agganciate alla corda (il paradita le copre), pollice sotto; «free»: pugno rilassato.
 */
export function SideHand({ h, e, r, skin, gloves, kind }: { h: P; e: P; r: number; skin: string; gloves: boolean; kind: "bow" | "draw" | "free" }) {
  const t = tones(skin, gloves);
  const gid = `hs${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const ang = (Math.atan2(h.y - e.y, h.x - e.x) * 180) / Math.PI;
  // il pollice sta dalla parte di chi guarda (sopra se il braccio va avanti, sotto se torna indietro)
  const up = Math.abs(ang) <= 90 ? 1 : -1;
  const open = kind === "draw";
  // dorso e dita in un pezzo: polso stretto, dorso, nocche, dita piegate verso il palmo
  const body = open
    ? `M${f(-0.9 * r)} ${f(-0.5 * r)} C${f(-0.3 * r)} ${f(-0.78 * r)} ${f(0.5 * r)} ${f(-0.82 * r)} ${f(0.98 * r)} ${f(-0.5 * r)} C${f(1.22 * r)} ${f(-0.2 * r)} ${f(1.2 * r)} ${f(0.38 * r)} ${f(0.92 * r)} ${f(0.62 * r)} C${f(0.5 * r)} ${f(0.86 * r)} ${f(-0.4 * r)} ${f(0.74 * r)} ${f(-0.9 * r)} ${f(0.46 * r)} Z`
    : `M${f(-0.92 * r)} ${f(-0.54 * r)} C${f(-0.3 * r)} ${f(-0.86 * r)} ${f(0.52 * r)} ${f(-0.9 * r)} ${f(0.86 * r)} ${f(-0.62 * r)} C${f(1.16 * r)} ${f(-0.36 * r)} ${f(1.14 * r)} ${f(0.5 * r)} ${f(0.76 * r)} ${f(0.82 * r)} C${f(0.3 * r)} ${f(1.06 * r)} ${f(-0.5 * r)} ${f(0.86 * r)} ${f(-0.92 * r)} ${f(0.5 * r)} Z`;
  return (
    <g transform={`translate(${f(h.x)} ${f(h.y)}) rotate(${f(ang)}) scale(1 ${up})`}>
      <HandGrad id={gid} t={t} />
      <path d={body} fill={`url(#${gid})`} stroke={OUT} strokeOpacity="0.8" strokeWidth="0.5" strokeLinejoin="round" />
      {/* luce sul dorso, ombra sul palmo */}
      <path d={`M${f(-0.7 * r)} ${f(-0.5 * r)} C${f(-0.1 * r)} ${f(-0.74 * r)} ${f(0.5 * r)} ${f(-0.74 * r)} ${f(0.8 * r)} ${f(-0.5 * r)}`} stroke={t.hi} strokeWidth={f(0.05 * r)} fill="none" strokeLinecap="round" opacity="0.85" />
      <path d={`M${f(-0.7 * r)} ${f(0.48 * r)} C${f(-0.1 * r)} ${f(0.78 * r)} ${f(0.4 * r)} ${f(0.8 * r)} ${f(0.72 * r)} ${f(0.66 * r)}`} stroke={t.lo} strokeWidth={f(0.07 * r)} fill="none" strokeLinecap="round" opacity="0.45" />
      {open ? (
        // dita tese verso la corda: tre linee che si piegano in punta
        [-0.28, 0.06, 0.38].map((k) => <path key={k} d={`M${f(0.3 * r)} ${f(k * r)} L${f(0.96 * r)} ${f(k * r + 0.04 * r)} q${f(0.18 * r)} ${f(0.06 * r)} ${f(0.16 * r)} ${f(0.2 * r)}`} stroke={t.line} strokeWidth={f(0.03 * r)} fill="none" strokeLinecap="round" opacity="0.75" />)
      ) : (
        <g>
          {/* nocche e dita chiuse: tre pieghe che girano verso il palmo */}
          {[-0.42, -0.12, 0.18, 0.46].map((k) => (
            <g key={k}>
              <path d={`M${f(0.5 * r)} ${f(k * r)} C${f(0.86 * r)} ${f(k * r - 0.04 * r)} ${f(1.02 * r)} ${f(k * r + 0.12 * r)} ${f(0.92 * r)} ${f(k * r + 0.26 * r)}`} stroke={t.line} strokeWidth={f(0.03 * r)} fill="none" strokeLinecap="round" opacity="0.75" />
              <circle cx={f(0.82 * r)} cy={f(k * r + 0.04 * r)} r={f(0.035 * r)} fill="#fff" opacity={gloves ? 0.25 : 0.4} />
            </g>
          ))}
        </g>
      )}
      {/* pollice: dal polso lungo il fianco della mano, con l'unghia */}
      <path d={open ? `M${f(-0.5 * r)} ${f(0.3 * r)} C${f(-0.1 * r)} ${f(0.7 * r)} ${f(0.3 * r)} ${f(0.86 * r)} ${f(0.56 * r)} ${f(0.8 * r)}` : `M${f(-0.55 * r)} ${f(-0.42 * r)} C${f(-0.1 * r)} ${f(-0.86 * r)} ${f(0.4 * r)} ${f(-0.86 * r)} ${f(0.66 * r)} ${f(-0.66 * r)}`} stroke={OUT} strokeOpacity="0.75" strokeWidth={f(0.38 * r)} fill="none" strokeLinecap="round" />
      <path d={open ? `M${f(-0.5 * r)} ${f(0.3 * r)} C${f(-0.1 * r)} ${f(0.7 * r)} ${f(0.3 * r)} ${f(0.86 * r)} ${f(0.56 * r)} ${f(0.8 * r)}` : `M${f(-0.55 * r)} ${f(-0.42 * r)} C${f(-0.1 * r)} ${f(-0.86 * r)} ${f(0.4 * r)} ${f(-0.86 * r)} ${f(0.66 * r)} ${f(-0.66 * r)}`} stroke={t.base} strokeWidth={f(0.32 * r)} fill="none" strokeLinecap="round" />
      {gloves ? null : <ellipse cx={f(open ? 0.56 * r : 0.64 * r)} cy={f(open ? 0.8 * r : -0.66 * r)} rx={f(0.13 * r)} ry={f(0.09 * r)} fill={t.nail} opacity="0.95" />}
      {/* polso: l'attacco all'avambraccio, con il polsino se c'è il guanto */}
      {gloves ? (
        <g>
          <path d={`M${f(-0.98 * r)} ${f(-0.62 * r)} L${f(-0.66 * r)} ${f(-0.66 * r)} L${f(-0.66 * r)} ${f(0.62 * r)} L${f(-0.98 * r)} ${f(0.58 * r)} Z`} fill="#3a220f" stroke={OUT} strokeOpacity="0.7" strokeWidth="0.3" />
          <path d={`M${f(-0.2 * r)} ${f(-0.6 * r)} C${f(0.3 * r)} ${f(-0.7 * r)} ${f(0.6 * r)} ${f(-0.6 * r)} ${f(0.8 * r)} ${f(-0.4 * r)}`} stroke="#c9a46a" strokeOpacity="0.5" strokeWidth={f(0.022 * r)} strokeDasharray={`${f(0.09 * r)} ${f(0.08 * r)}`} fill="none" />
        </g>
      ) : (
        <path d={`M${f(-0.6 * r)} ${f(-0.2 * r)} q${f(0.14 * r)} ${f(0.2 * r)} 0 ${f(0.4 * r)}`} stroke={t.line} strokeWidth={f(0.03 * r)} fill="none" opacity="0.4" />
      )}
    </g>
  );
}
