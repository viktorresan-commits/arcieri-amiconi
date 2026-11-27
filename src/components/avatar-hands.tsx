/**
 * Mani dell'arciere: pugno chiuso con quattro dita che avvolgono (impugnatura dell'arco, freccia), nocche,
 * pollice con l'unghia, pieghe e luce da sinistra; con i guanti il cuoio, le cuciture e il polsino.
 * Di fronte (FrontFist) e di profilo, orientata lungo l'avambraccio (SideHand).
 */
import { Claws } from "./demon-costume";
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

function blend(a: string, b: string, t: number) {
  const ma = /^#?([0-9a-f]{6})$/i.exec((a || "").trim());
  const mb = /^#?([0-9a-f]{6})$/i.exec((b || "").trim());
  if (!ma || !mb) return a;
  const na = Number.parseInt(ma[1], 16);
  const nb = Number.parseInt(mb[1], 16);
  const ch = (sh: number) => Math.round(((na >> sh) & 255) * (1 - t) + ((nb >> sh) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

/** i colori della mano: pelle (con le nocche un po' più calde) o cuoio del guanto */
function tones(skin: string, gloves: boolean) {
  const base = gloves ? "#4a2c16" : skin;
  // la mano ha la stessa pelle del volto: ombra calda con il rosso sotto la pelle, nocche arrossate
  return {
    base,
    hi: shade(base, gloves ? 0.22 : 0.15),
    lo: gloves ? shade(base, -0.42) : blend(shade(skin, -0.26), "#6a2c1c", 0.16),
    line: gloves ? "#1a0e06" : blend(shade(skin, -0.45), "#4a1c12", 0.25),
    knuckle: gloves ? "#6b4526" : blend(skin, "#c4473f", 0.3),
    nail: gloves ? "#5a3a20" : blend(shade(skin, 0.3), "#e8a49a", 0.25),
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
 * destra di chi guarda, -1 a sinistra. Dorso della mano, quattro dita piegate una sotto l'altra (il mignolo più
 * corto) e il pollice di traverso sopra l'indice con l'unghia; contorno sottile, volume dato dalla luce.
 */
export function FrontFist({ x, y, r, skin, gloves, flip = 1, claws = false }: { x: number; y: number; r: number; skin: string; gloves: boolean; flip?: 1 | -1; /** artigli d'oro (costume del demone) */ claws?: boolean }) {
  const t = tones(skin, gloves);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gid = `hf${id}`;
  const vid = `hv${id}`;
  const P = (px: number, py: number) => `${f(px * r)} ${f(py * r)}`;
  const line = gloves ? OUT : t.line;
  const back = `M${P(-0.6, -1.12)} C${P(-0.1, -1.18)} ${P(0.4, -1.16)} ${P(0.62, -1.1)} C${P(0.88, -0.9)} ${P(0.98, -0.4)} ${P(0.96, 0.05)} L${P(-0.86, 0.1)} C${P(-0.94, -0.4)} ${P(-0.88, -0.9)} ${P(-0.6, -1.12)} Z`;
  const fingers = [3, 2, 1, 0].map((k) => {
    const y0 = -0.36 + k * 0.385;
    const h = 0.42;
    const x0 = -0.86 + k * 0.07;
    const x1 = 1.0 - k * 0.09;
    const d = `M${P(x0 + 0.16, y0)} L${P(x1 - 0.18, y0)} C${P(x1 + 0.02, y0)} ${P(x1 + 0.06, y0 + h * 0.9)} ${P(x1 - 0.16, y0 + h)} L${P(x0 + 0.16, y0 + h)} C${P(x0 - 0.04, y0 + h)} ${P(x0 - 0.04, y0)} ${P(x0 + 0.16, y0)} Z`;
    return { k, d, y0, h, x0, x1 };
  });
  const thumb = `M${P(-0.92, -0.8)} C${P(-0.6, -0.68)} ${P(-0.1, -0.52)} ${P(0.36, -0.42)} C${P(0.58, -0.37)} ${P(0.62, -0.12)} ${P(0.4, -0.07)} C${P(0.0, -0.1)} ${P(-0.5, -0.2)} ${P(-0.92, -0.34)} Z`;
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${flip} 1)`}>
      <defs>
        <radialGradient id={gid} cx="0.32" cy="0.3" r="0.85">
          <stop offset="0" stopColor={t.hi} />
          <stop offset="0.55" stopColor={t.base} />
          <stop offset="1" stopColor={t.lo} />
        </radialGradient>
        <linearGradient id={vid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.hi} />
          <stop offset="0.5" stopColor={t.base} />
          <stop offset="1" stopColor={t.lo} />
        </linearGradient>
      </defs>
      {/* dorso della mano, con le nocche arrossate sul lato esterno */}
      <path d={back} fill={`url(#${gid})`} stroke={line} strokeOpacity="0.75" strokeWidth="0.3" strokeLinejoin="round" />
      {gloves ? null : <ellipse cx={f(0.6 * r)} cy={f(-0.55 * r)} rx={f(0.28 * r)} ry={f(0.45 * r)} fill={t.knuckle} opacity="0.3" />}
      {/* le quattro dita piegate */}
      {fingers.map((g) => (
        <g key={g.k}>
          <path d={g.d} fill={`url(#${vid})`} stroke={line} strokeOpacity="0.75" strokeWidth="0.28" strokeLinejoin="round" />
          <path d={`M${P(g.x0 + 0.2, g.y0 + 0.08)} L${P(g.x1 - 0.32, g.y0 + 0.08)}`} stroke={t.hi} strokeOpacity={gloves ? 0.35 : 0.6} strokeWidth={f(0.05 * r)} strokeLinecap="round" />
          {gloves ? (
            <path d={`M${P(g.x0 + 0.24, g.y0 + g.h * 0.55)} L${P(g.x1 - 0.3, g.y0 + g.h * 0.55)}`} stroke="#c9a46a" strokeOpacity="0.5" strokeWidth={f(0.022 * r)} strokeDasharray={`${f(0.09 * r)} ${f(0.08 * r)}`} />
          ) : (
            <ellipse cx={f((g.x1 - 0.17) * r)} cy={f((g.y0 + g.h * 0.45) * r)} rx={f(0.12 * r)} ry={f(0.14 * r)} fill={t.knuckle} opacity="0.5" />
          )}
        </g>
      ))}
      {/* pollice di traverso sopra l'indice, con l'unghia in punta */}
      <path d={thumb} fill={`url(#${gid})`} stroke={line} strokeOpacity="0.75" strokeWidth="0.3" strokeLinejoin="round" />
      <path d={`M${P(-0.84, -0.7)} C${P(-0.5, -0.6)} ${P(-0.1, -0.47)} ${P(0.3, -0.38)}`} stroke={t.hi} strokeOpacity={gloves ? 0.35 : 0.65} strokeWidth={f(0.05 * r)} fill="none" strokeLinecap="round" />
      {gloves ? null : (
        <g>
          <ellipse cx={f(0.42 * r)} cy={f(-0.24 * r)} rx={f(0.15 * r)} ry={f(0.11 * r)} fill={t.nail} stroke={t.line} strokeOpacity="0.55" strokeWidth={f(0.025 * r)} transform={`rotate(14 ${f(0.42 * r)} ${f(-0.24 * r)})`} />
          <ellipse cx={f(0.4 * r)} cy={f(-0.27 * r)} rx={f(0.06 * r)} ry={f(0.035 * r)} fill="#fff" opacity="0.6" />
        </g>
      )}
      {/* polsino del guanto */}
      {gloves ? (
        <g>
          <path d={`M${f(-0.74 * r)} ${f(-1.36 * r)} L${f(0.74 * r)} ${f(-1.36 * r)} L${f(0.68 * r)} ${f(-1.02 * r)} L${f(-0.68 * r)} ${f(-1.02 * r)} Z`} fill="#3a220f" stroke={OUT} strokeOpacity="0.5" strokeWidth="0.21" />
          <path d={`M${f(-0.62 * r)} ${f(-1.18 * r)} H${f(0.62 * r)}`} stroke="#c9a46a" strokeOpacity="0.55" strokeWidth={f(0.022 * r)} strokeDasharray={`${f(0.09 * r)} ${f(0.08 * r)}`} />
        </g>
      ) : null}
      {claws ? <Claws r={r} /> : null}
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
      <path d={body} fill={`url(#${gid})`} stroke={OUT} strokeOpacity="0.58" strokeWidth="0.3" strokeLinejoin="round" />
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
      {/* pollice: attaccato al palmo, dalla parte interna della mano. Nel pugno parte dalla base del palmo e si
          chiude davanti alle dita piegate; sulla mano della corda resta disteso sotto il palmo, verso il collo. */}
      {(() => {
        const R = (v: number) => f(v * r);
        const fill = open
          ? `M${R(-0.5)} ${R(0.5)} C${R(-0.2)} ${R(0.74)} ${R(0.12)} ${R(0.98)} ${R(0.42)} ${R(1.0)} C${R(0.58)} ${R(1.0)} ${R(0.62)} ${R(0.82)} ${R(0.5)} ${R(0.72)} C${R(0.3)} ${R(0.6)} ${R(-0.1)} ${R(0.5)} ${R(-0.36)} ${R(0.34)} Z`
          : `M${R(-0.42)} ${R(0.74)} C${R(-0.1)} ${R(0.9)} ${R(0.36)} ${R(0.98)} ${R(0.68)} ${R(0.7)} C${R(0.8)} ${R(0.56)} ${R(0.74)} ${R(0.34)} ${R(0.58)} ${R(0.36)} C${R(0.36)} ${R(0.42)} ${R(0.04)} ${R(0.56)} ${R(-0.36)} ${R(0.5)} Z`;
        // bordo solo sul lato libero e in punta: la base si fonde con il palmo
        const edge = open
          ? `M${R(-0.2)} ${R(0.74)} C${R(0.12)} ${R(0.98)} ${R(0.42)} ${R(1.0)} ${R(0.42)} ${R(1.0)} C${R(0.58)} ${R(1.0)} ${R(0.62)} ${R(0.82)} ${R(0.5)} ${R(0.72)} C${R(0.3)} ${R(0.6)} ${R(-0.1)} ${R(0.5)} ${R(-0.3)} ${R(0.38)}`
          : `M${R(-0.3)} ${R(0.82)} C${R(-0.02)} ${R(0.94)} ${R(0.4)} ${R(0.96)} ${R(0.68)} ${R(0.7)} C${R(0.8)} ${R(0.56)} ${R(0.74)} ${R(0.34)} ${R(0.58)} ${R(0.36)} C${R(0.36)} ${R(0.42)} ${R(0.04)} ${R(0.58)} ${R(-0.26)} ${R(0.57)}`;
        const nail = open ? { x: 0.47, y: 0.88, a: 70 } : { x: 0.64, y: 0.5, a: -62 };
        return (
          <g>
            <path d={fill} fill={`url(#${gid})`} />
            <path d={edge} stroke={OUT} strokeOpacity="0.58" strokeWidth="0.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {/* piega dove il pollice si appoggia al palmo */}
            <path d={open ? `M${R(-0.34)} ${R(0.4)} C${R(-0.1)} ${R(0.52)} ${R(0.2)} ${R(0.62)} ${R(0.42)} ${R(0.7)}` : `M${R(-0.3)} ${R(0.6)} C${R(0.02)} ${R(0.62)} ${R(0.32)} ${R(0.5)} ${R(0.52)} ${R(0.4)}`} stroke={t.line} strokeWidth={R(0.035)} fill="none" strokeLinecap="round" opacity="0.6" />
            {gloves ? null : <ellipse cx={R(nail.x)} cy={R(nail.y)} rx={R(0.12)} ry={R(0.08)} transform={`rotate(${nail.a} ${R(nail.x)} ${R(nail.y)})`} fill={t.nail} opacity="0.95" />}
          </g>
        );
      })()}
      {/* polso: l'attacco all'avambraccio, con il polsino se c'è il guanto */}
      {gloves ? (
        <g>
          <path d={`M${f(-0.98 * r)} ${f(-0.62 * r)} L${f(-0.66 * r)} ${f(-0.66 * r)} L${f(-0.66 * r)} ${f(0.62 * r)} L${f(-0.98 * r)} ${f(0.58 * r)} Z`} fill="#3a220f" stroke={OUT} strokeOpacity="0.5" strokeWidth="0.18" />
          <path d={`M${f(-0.2 * r)} ${f(-0.6 * r)} C${f(0.3 * r)} ${f(-0.7 * r)} ${f(0.6 * r)} ${f(-0.6 * r)} ${f(0.8 * r)} ${f(-0.4 * r)}`} stroke="#c9a46a" strokeOpacity="0.5" strokeWidth={f(0.022 * r)} strokeDasharray={`${f(0.09 * r)} ${f(0.08 * r)}`} fill="none" />
        </g>
      ) : (
        <path d={`M${f(-0.6 * r)} ${f(-0.2 * r)} q${f(0.14 * r)} ${f(0.2 * r)} 0 ${f(0.4 * r)}`} stroke={t.line} strokeWidth={f(0.03 * r)} fill="none" opacity="0.4" />
      )}
    </g>
  );
}
