import { useId, type ReactNode } from "react";
import { tune, type AvatarLook } from "@/lib/arcieri/avatar";
import { blend, shade } from "./archer-avatar";

/**
 * Anteprima del nuovo avatar dettagliato: testa, capelli, barba e spalle disegnati con un unico
 * sistema per la vista di fronte e quella di profilo. Stessi colori, stessa luce (dall'alto a
 * sinistra), stesso spessore dei contorni: le due viste sembrano la stessa persona.
 *
 * I capelli sono costruiti da sagome campionate a punti: la lunghezza sposta le punte, il volume
 * allarga la massa, l'ondulazione ne increspa i bordi. Così ogni taglio si regola in lunghezza e forma.
 */

type Pt = [number, number];
type View = "front" | "side";

export type HdLook = AvatarLook & {
  /** 0 lisci – 100 ricci stretti ("" = quella tipica del taglio) */
  hairCurl?: string;
  /** riga: sinistra, centro, destra */
  hairPart?: "sinistra" | "centro" | "destra";
  /** frangia 0 (nessuna) – 100 sugli occhi */
  fringe?: string;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** curva morbida che passa per tutti i punti (Catmull-Rom convertita in Bézier) */
function smooth(pts: Pt[], closed = true, k = 1): string {
  if (pts.length < 2) return "";
  const n = pts.length;
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * k, p1[1] + ((p2[1] - p0[1]) / 6) * k];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * k, p2[1] - ((p3[1] - p1[1]) / 6) * k];
    d += ` C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

/** ricampiona una spezzata a passo costante */
function resample(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    let t = step - carry;
    while (t <= len) {
      out.push([ax + ((bx - ax) * t) / len, ay + ((by - ay) * t) / len]);
      t += step;
    }
    carry = len - (t - step);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * increspa un bordo: onde morbide per i mossi, riccioli a bolla per i ricci.
 * `side` = da che parte sta l'esterno (1 sinistra della direzione di marcia, -1 destra)
 */
function curly(pts: Pt[], curl: number, side: 1 | -1, step = 5, seed = 1): Pt[] {
  if (curl < 4) return pts;
  const s = resample(pts, step);
  const amp = curl < 55 ? (curl / 55) * 2.4 : 2.4 + ((curl - 55) / 45) * 2.6;
  return s.map(([x, y], i) => {
    const a = s[Math.max(0, i - 1)];
    const b = s[Math.min(s.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * side;
    const ny = (dx / l) * side;
    const ph = i * (curl < 55 ? 0.9 : 1.6) + seed;
    const w = curl < 55 ? Math.sin(ph) : Math.abs(Math.sin(ph)) * 1.4 - 0.4;
    const o = w * amp * (i === 0 || i === s.length - 1 ? 0 : 1);
    return [x + nx * o, y + ny * o];
  });
}

const mirror = (pts: Pt[], cx = 100): Pt[] => pts.map(([x, y]) => [2 * cx - x, y] as Pt).reverse();

/** riccioli a bolla: archi di cerchio fra punti vicini, rivolti verso l'esterno */
function scallop(pts: Pt[], step: number, sweep: 0 | 1, seed = 1): string {
  const s = resample(pts, step);
  let d = "";
  for (let i = 1; i < s.length; i++) {
    const [x, y] = s[i];
    const rr = step * (0.62 + ((i * 7 + seed) % 5) * 0.06);
    d += ` A${r1(rr)} ${r1(rr)} 0 0 ${sweep} ${r1(x)} ${r1(y)}`;
  }
  return d;
}

/** contorno chiuso dei capelli: liscio, mosso o a riccioli secondo l'ondulazione */
function outline(pts: Pt[], curl: number, sweep: 0 | 1, seed = 1): string {
  if (curl > 55) {
    const closed = [...pts, pts[0]];
    return `M${r1(pts[0][0])} ${r1(pts[0][1])}${scallop(closed, 7 + (curl - 55) * 0.06, sweep, seed)} Z`;
  }
  return smooth(curly(pts, curl, sweep === 1 ? 1 : -1, 5, seed));
}

/** riccioli dentro la massa: archetti chiari e scuri sparsi in un riquadro */
function curlTexture(k: { hairL: string; hairD: string }, box: [number, number, number, number], n: number, seed = 1): ReactNode {
  const [x0, y0, x1, y1] = box;
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const fx = ((i * 0.618 + seed * 0.13) % 1);
    const fy = ((i * 0.381 + seed * 0.29) % 1);
    const x = x0 + (x1 - x0) * fx;
    const y = y0 + (y1 - y0) * fy;
    const r = 2.4 + ((i * 5) % 4) * 0.6;
    const light = i % 3 === 0;
    out.push(<path key={i} d={`M${r1(x - r)} ${r1(y)} a${r1(r)} ${r1(r)} 0 1 1 ${r1(r * 1.6)} ${r1(r * 0.9)}`} stroke={light ? k.hairL : k.hairD} strokeWidth={light ? 0.7 : 0.9} fill="none" opacity={light ? 0.55 : 0.6} strokeLinecap="round" />);
  }
  return <g>{out}</g>;
}

/** come smooth ma senza il "M" iniziale: per proseguire un tracciato già aperto */
function smoothTail(pts: Pt[]): string {
  return smooth(pts, false).replace(/^M[^C]*/, "");
}

/** ciocche: linee lunghe che seguono la piega dei capelli, chiare e scure */
function strands(from: Pt[], to: Pt[], n: number, bend = 0): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = lerpPt(from, t);
    const b = lerpPt(to, t);
    const mx = (a[0] + b[0]) / 2 + bend * (0.6 - t);
    const my = (a[1] + b[1]) / 2;
    out.push(`M${r1(a[0])} ${r1(a[1])} Q${r1(mx)} ${r1(my)} ${r1(b[0])} ${r1(b[1])}`);
  }
  return out;
}

/** punto a frazione t lungo una spezzata */
function lerpPt(pts: Pt[], t: number): Pt {
  if (pts.length === 1) return pts[0];
  const segs = pts.length - 1;
  const f = Math.max(0, Math.min(0.9999, t)) * segs;
  const i = Math.floor(f);
  const k = f - i;
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
}

type Kit = {
  id: (k: string) => string;
  url: (k: string) => string;
  skin: string;
  skinL: string;
  skinS: string;
  skinD: string;
  line: string;
  hair: string;
  hairL: string;
  hairD: string;
  woman: boolean;
  look: HdLook;
  L: number;
  V: number;
  curl: number;
};

/** ondulazione tipica di ogni taglio, se non scelta a mano */
const CURL_OF: Record<string, number> = { mossi: 35, "lunghi-mossi": 40, ricci: 80, afro: 95, spettinati: 25, dread: 10, trecce: 0 };

/** tagli corti: aderenti alla testa, sopra le orecchie */
const SHORT = new Set(["corti", "ciuffo", "undercut", "cresta", "spettinati", "frangia"]);

/** tagli lunghi: la massa scende dietro le spalle e due ciocche cadono davanti */
const LONG = new Set(["lunghi", "lunghi-mossi", "mossi", "ricci", "afro", "vichinga", "caschetto"]);

/* ---------------------------------------------------------------- fronte */

function frontFace(k: Kit) {
  const f = k.look.face;
  const cw = f === "tondo" ? 41 : f === "allungato" ? 36 : k.woman ? 37.5 : 39;
  const jw = f === "squadrato" ? 33 : f === "tondo" ? 31 : k.woman ? 25 : 28;
  const chin = f === "allungato" ? 157 : f === "tondo" ? 150 : 153;
  const jy = f === "squadrato" ? 136 : 132;
  return {
    cw,
    jw,
    chin,
    d: `M100 42 C${100 + cw * 0.62} 42 ${100 + cw} 58 ${100 + cw} 86 C${100 + cw} 104 ${100 + cw - 2} 118 ${100 + jw + 2} ${jy} C${100 + jw - 6} ${chin - 6} ${112} ${chin} 100 ${chin} C88 ${chin} ${100 - jw + 6} ${chin - 6} ${100 - jw - 2} ${jy} C${100 - cw + 2} 118 ${100 - cw} 104 ${100 - cw} 86 C${100 - cw} 58 ${100 - cw * 0.62} 42 100 42 Z`,
  };
}

function FrontEye({ k, x, dir }: { k: Kit; x: number; dir: 1 | -1 }) {
  // dir 1 = occhio a sinistra di chi guarda (angolo esterno a sinistra)
  const y = 97;
  const s = 0.85 + (tune(k.look.eyeSize, 50, 0, 100) / 100) * 0.3;
  const w = 10 * s;
  const o = x - w * dir; // angolo esterno
  const i = x + w * dir; // angolo interno
  const eye = `M${o} ${y + 0.4} C${x - 5 * dir} ${y - 5.8 * s} ${x + 5 * dir} ${y - 6.2 * s} ${i} ${y - 0.2} C${x + 5 * dir} ${y + 4 * s} ${x - 5 * dir} ${y + 4.8 * s} ${o} ${y + 0.4} Z`;
  const lid = `M${o - 0.6 * dir} ${y + 0.8} C${x - 5 * dir} ${y - 6.2 * s} ${x + 5 * dir} ${y - 6.6 * s} ${i} ${y - 0.2}`;
  const crease = `M${o + 1 * dir} ${y - 3.2 * s} C${x - 4 * dir} ${y - 9 * s} ${x + 5 * dir} ${y - 9 * s} ${i - 1.2 * dir} ${y - 4 * s}`;
  const clip = k.id(`eye${dir}`);
  const iris = blend(k.look.eyes, "#000000", 0.05);
  return (
    <g>
      {/* conca dell'occhio un po' più scura */}
      <ellipse cx={x} cy={y - 1.5} rx={w + 3} ry={6.5 * s} fill={k.skinS} opacity="0.32" />
      <clipPath id={clip}>
        <path d={eye} />
      </clipPath>
      <path d={eye} fill="#f6f1ea" />
      <g clipPath={`url(#${clip})`}>
        <ellipse cx={x} cy={y - 3.6 * s} rx={w} ry={3 * s} fill="#8a6a5a" opacity="0.22" />
        <circle cx={x + 0.4 * dir} cy={y - 0.6} r={5 * s} fill={iris} />
        <circle cx={x + 0.4 * dir} cy={y - 0.6} r={5 * s} fill={k.url("iris")} />
        <circle cx={x + 0.4 * dir} cy={y - 0.6} r={5 * s} fill="none" stroke={shade(iris, -0.55)} strokeWidth="0.7" />
        <circle cx={x + 0.4 * dir} cy={y - 0.6} r={2.1 * s} fill="#0a0806" />
        <path d={`M${x - 4 * s} ${y - 4.8 * s} L${x + 4 * s} ${y - 4.8 * s}`} stroke="#000" strokeOpacity="0.25" strokeWidth={2.2 * s} />
      </g>
      <circle cx={x - 1.6 * s} cy={y - 2.6 * s} r={1.25 * s} fill="#fff" />
      <circle cx={x + 2 * s} cy={y + 1.1 * s} r={0.55 * s} fill="#fff" opacity="0.8" />
      {/* palpebra: riga scura spessa, ciglia più marcate per lei */}
      <path d={lid} fill="none" stroke={shade(k.skin, -0.72)} strokeWidth={k.woman ? 1.9 : 1.5} strokeLinecap="round" />
      {k.woman ? <path d={`M${o + 0.4 * dir} ${y - 0.6} l${-2.6 * dir} -2.2 M${o + 2.4 * dir} ${y - 2.8} l${-2 * dir} -2.6`} stroke={shade(k.skin, -0.75)} strokeWidth="0.9" strokeLinecap="round" /> : null}
      <path d={crease} fill="none" stroke={k.skinD} strokeWidth="0.7" opacity="0.55" strokeLinecap="round" />
      <path d={`M${o + 1.5 * dir} ${y + 1.6} C${x - 3 * dir} ${y + 5 * s} ${x + 4 * dir} ${y + 4.6 * s} ${i - 1 * dir} ${y + 1}`} fill="none" stroke={k.skinD} strokeWidth="0.55" opacity="0.5" />
      <circle cx={i - 0.6 * dir} cy={y + 0.2} r="0.9" fill="#d99a90" opacity="0.7" />
    </g>
  );
}

function frontBrow(k: Kit, x: number, dir: 1 | -1) {
  const y = 85;
  const bw = (k.look.brows === "folte" ? 3.4 : k.look.brows === "sottili" ? 1.6 : 2.5) * (0.65 + (tune(k.look.browSize, 50, 0, 100) / 100) * 0.7);
  const e = k.look.expression;
  const tilt = e === "deciso" ? 2.4 : e === "concentrato" ? 1.4 : 0;
  const inner = x + 9 * dir;
  const outer = x - 12 * dir;
  const d = `M${inner} ${y + 1 + tilt} C${x + 4 * dir} ${y - bw - 2} ${x - 5 * dir} ${y - bw - 3.4} ${outer} ${y - 0.4} C${x - 5 * dir} ${y - 2} ${x + 4 * dir} ${y - 0.6} ${inner} ${y + 1 + tilt + bw} Z`;
  const hairs: string[] = [];
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const hx = inner + (outer - inner) * t;
    const hy = y + 1 + tilt * (1 - t) + bw * 0.6 * (1 - t) - Math.sin(t * Math.PI) * (bw + 1.6);
    hairs.push(`M${r1(hx)} ${r1(hy + bw * 0.5)} l${r1(-2.2 * dir * (0.3 + t))} ${r1(-bw * 0.9)}`);
  }
  return (
    <g key={x}>
      <path d={d} fill={k.hairD} opacity="0.85" />
      <path d={hairs.join(" ")} stroke={shade(k.hairD, -0.3)} strokeWidth="0.55" strokeLinecap="round" />
      <path d={hairs.join(" ")} stroke={k.hairL} strokeWidth="0.35" strokeLinecap="round" opacity="0.5" transform={`translate(${0.6 * dir} 0.4)`} />
    </g>
  );
}

function FrontNose({ k }: { k: Kit }) {
  const s = 0.85 + (tune(k.look.noseSize, 50, 0, 100) / 100) * 0.35;
  const w = k.look.nose === "largo" || k.look.nose === "patata" ? 1.2 : k.look.nose === "piccolo" ? 0.85 : 1;
  return (
    <g transform={`translate(100 118) scale(${s * w} ${s}) translate(-100 -118)`}>
      {/* dorso in ombra dal lato lontano dalla luce */}
      <path d="M103 90 C105 98 107 106 108 114 C105 112 104 104 102 96 Z" fill={k.skinS} opacity="0.45" />
      <path d="M97 92 C96 100 95.5 108 95 113" stroke={k.skinL} strokeWidth="1.6" opacity="0.45" strokeLinecap="round" fill="none" />
      {/* punta e ali */}
      <ellipse cx="99.4" cy="117" rx="4" ry="3" fill={k.skinL} opacity="0.55" />
      <path d="M92 116 C88 120 90 124.5 95 124 M108 116 C112 120 110 124.5 105 124" stroke={k.skinD} strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.75" />
      <path d="M94 124 C97.5 126.2 102.5 126.2 106 124 C103 125 97 125 94 124 Z" fill={k.skinD} opacity="0.55" />
      <ellipse cx="96" cy="122.6" rx="2" ry="1.05" fill={shade(k.skin, -0.62)} transform="rotate(18 96 122.6)" />
      <ellipse cx="104" cy="122.6" rx="2" ry="1.05" fill={shade(k.skin, -0.62)} transform="rotate(-18 104 122.6)" />
      <path d="M95 127 C97 129 103 129 105 127" stroke={k.skinS} strokeWidth="1.2" fill="none" opacity="0.35" />
    </g>
  );
}

function FrontMouth({ k }: { k: Kit }) {
  const y = 135;
  const e = k.look.expression;
  const w = k.woman ? 9 : 9.5;
  const th = k.look.mouth === "piena" ? 1.35 : k.look.mouth === "sottile" ? 0.6 : k.woman ? 1.15 : 0.9;
  const up = e === "sorriso" ? -1.6 : e === "deciso" ? 0.4 : 0;
  const lip = blend(k.skin, k.woman ? "#b5404c" : "#a24a3e", k.woman ? 0.5 : 0.32);
  const L = `${100 - w} ${y + up}`;
  const R = `${100 + w} ${y + up}`;
  const upper = `M${L} C${100 - w * 0.6} ${y - 2.2 * th} ${100 - w * 0.25} ${y - 3.4 * th} 100 ${y - 2.3 * th} C${100 + w * 0.25} ${y - 3.4 * th} ${100 + w * 0.6} ${y - 2.2 * th} ${R} C${100 + w * 0.5} ${y + 0.6} ${100 - w * 0.5} ${y + 0.6} ${L} Z`;
  const lower = `M${L} C${100 - w * 0.5} ${y + 0.8} ${100 + w * 0.5} ${y + 0.8} ${R} C${100 + w * 0.55} ${y + 4.6 * th + 0.6} ${100 - w * 0.55} ${y + 4.6 * th + 0.6} ${L} Z`;
  return (
    <g>
      {/* filtro sopra il labbro e ombra sotto il labbro inferiore */}
      <path d={`M98 127.5 L97.4 ${y - 3} M102 127.5 L102.6 ${y - 3}`} stroke={k.skinS} strokeWidth="0.8" opacity="0.35" />
      <ellipse cx="100" cy={y + 6.6 * th + 1.4} rx="6" ry="1.6" fill={k.skinS} opacity="0.5" />
      <path d={lower} fill={lip} />
      <path d={upper} fill={shade(lip, -0.2)} />
      <ellipse cx="101" cy={y + 2.6 * th} rx={w * 0.32} ry="0.8" fill="#fff" opacity="0.3" />
      <path d={`M${L} C${100 - w * 0.5} ${y + 0.7} ${100 + w * 0.5} ${y + 0.7} ${R}`} stroke={shade(lip, -0.6)} strokeWidth="0.75" fill="none" strokeLinecap="round" />
      {e === "sorriso" ? (
        <path d={`M${100 - w - 1.4} ${y + up - 2.2} q-1 1.8 0.2 3.6 M${100 + w + 1.4} ${y + up - 2.2} q1 1.8 -0.2 3.6`} stroke={k.skinD} strokeWidth="0.7" fill="none" opacity="0.55" strokeLinecap="round" />
      ) : null}
    </g>
  );
}

function frontHair(k: Kit, face: ReturnType<typeof frontFace>) {
  const st = k.look.hair;
  const L = k.L;
  const v = (k.V - 50) / 50;
  const curl = k.curl;
  const spread = 7 + v * 11 + curl * 0.07;
  const part = k.look.hairPart === "centro" ? 100 : k.look.hairPart === "destra" ? 110 : 90;
  const fringe = tune(k.look.fringe, st === "frangia" || st === "caschetto" ? 70 : 0, 0, 100);
  const top = 33 - v * 3 - curl * 0.04;
  const cw = face.cw;
  const back: ReactNode[] = [];
  const front: ReactNode[] = [];
  const over: ReactNode[] = [];

  if (st === "calvo" || st === "rasati") {
    // rasati: solo un'ombra di capelli sulla calotta
    if (st === "rasati") {
      const d = `M${100 - cw + 1} 88 C${100 - cw} 60 ${100 - cw * 0.6} 44 100 43 C${100 + cw * 0.6} 44 ${100 + cw} 60 ${100 + cw - 1} 88 C${100 + cw - 4} 76 ${100 + cw * 0.5} 62 100 60 C${100 - cw * 0.5} 62 ${100 - cw + 4} 76 ${100 - cw + 1} 88 Z`;
      front.push(<path key="r" d={d} fill={k.hair} opacity="0.55" />, <path key="r2" d={d} fill={k.url("stubble")} opacity="0.7" />);
    }
    return { back, front, over };
  }

  // calotta: dalla tempia sinistra sopra la testa alla tempia destra, attaccatura con la riga
  const short = SHORT.has(st);
  const t2 = 37 - L * 0.16 - v * 3 - (st === "cresta" ? 8 : 0);
  const capOuter: Pt[] = short
    ? [
        [100 - cw - 0.5, 96],
        [100 - cw - 3 - v * 2, 74],
        [100 - cw * 0.74 - v, 47 - L * 0.05],
        [part - 8, t2 + 1],
        [part + 10, t2],
        [100 + cw * 0.74 + v, 47 - L * 0.05],
        [100 + cw + 3 + v * 2, 74],
        [100 + cw + 0.5, 96],
      ]
    : [
    [100 - cw - 3 - spread * 0.25, 104],
    [100 - cw - 6 - spread * 0.4, 78],
    [100 - cw * 0.72 - spread * 0.3, 48],
    [part - 8, top + 2],
    [part + 10, top],
    [100 + cw * 0.72 + spread * 0.3, 48],
    [100 + cw + 6 + spread * 0.4, 78],
    [100 + cw + 3 + spread * 0.25, 104],
      ];
  const fy = 58 + (fringe / 100) * 30; // altezza del bordo della frangia
  const hairline: Pt[] =
    fringe > 10
      ? [
          [100 + cw - 1, 100],
          [100 + cw - 4, 82],
          [118, fy - 4],
          [104, fy + 1],
          [90, fy - 1],
          [78, fy - 3],
          [100 - cw + 4, 82],
          [100 - cw + 1, 100],
        ]
      : [
          [100 + cw - 1, 100],
          [100 + cw - 3, 80],
          [126, 64],
          [part + 6, 57],
          [part, 54],
          [part - 6, 57],
          [74, 64],
          [100 - cw + 3, 80],
          [100 - cw + 1, 100],
        ];
  const lineC = fringe > 10 ? curly(hairline, Math.min(50, Math.max(curl, 18)), -1, 4, 5) : hairline;
  const capD =
    curl > 55
      ? `M${r1(capOuter[0][0])} ${r1(capOuter[0][1])}${scallop(capOuter, 7.5, 1, 2)} L${r1(lineC[0][0])} ${r1(lineC[0][1])}${smoothTail(lineC)} Z`
      : smooth([...curly(capOuter, curl, 1, 5, 2), ...lineC]);

  if (LONG.has(st) || st === "trecce" || st === "dread") {
    const bob = st === "caschetto";
    const yB = bob ? 128 + L * 0.4 : 150 + L * 0.95;
    const sideL: Pt[] = [
      [part, top + 2],
      [100 - cw * 0.75 - spread * 0.4, 46],
      [100 - cw - 6 - spread * 0.6, 80],
      [100 - cw - 6 - spread, 116],
      [100 - cw - 4 - spread * 1.1, (116 + yB) / 2],
      [100 - cw - spread * 0.9, yB - 6],
      [78, yB],
    ];
    const sideR = mirror(sideL).slice(1);
    const backD = outline([...sideL, [100, yB - 3] as Pt, ...sideR], curl, 0, 1);
    back.push(<path key="bk" d={backD} fill={k.url("hairBack")} />);
    back.push(<path key="bks" d={backD} fill="#000" opacity="0.28" />);
    if (curl > 55) {
      back.push(
        <g key="bkc">
          <clipPath id={k.id("bkc")}>
            <path d={backD} />
          </clipPath>
          <g clipPath={`url(#${k.id("bkc")})`} opacity="0.7">{curlTexture(k, [40, 40, 160, yB], 40, 5)}</g>
        </g>,
      );
    }
    // ciocche che cadono davanti alle spalle
    if (!bob && st !== "treccia") {
      for (const dir of [1, -1] as const) {
        const X = (x: number) => 100 + (x - 100) * dir;
        const lock: Pt[] = [
          [X(100 - cw + 2), 70],
          [X(100 - cw - 5 - spread * 0.5), 96],
          [X(100 - cw - 6 - spread * 0.7), 132],
          [X(100 - cw - 4 - spread * 0.8), yB - 14],
          [X(100 - cw + 4), yB],
          [X(100 - cw + 10), yB - 16],
          [X(100 - cw + 8), 150],
          [X(100 - cw + 3), 118],
          [X(100 - cw + 3), 96],
        ];
        const lockD = outline(lock, curl, dir === 1 ? 0 : 1, dir === 1 ? 4 : 7);
        const id = `lock${dir}`;
        over.push(
          <g key={id}>
            <clipPath id={k.id(id)}>
              <path d={lockD} />
            </clipPath>
            <path d={lockD} fill={k.url("hairLock")} />
            <g clipPath={`url(#${k.id(id)})`}>
              {curl > 55 ? curlTexture(k, [X(100 - cw - 12), 80, X(100 - cw + 12), yB], 26, dir === 1 ? 1 : 3) : null}
              {curl > 55 ? null : strands(
                [
                  [X(100 - cw - 4), 80],
                  [X(100 - cw + 6), 80],
                ],
                [
                  [X(100 - cw - 2), yB],
                  [X(100 - cw + 8), yB],
                ],
                7,
                curl * 0.08 * dir,
              ).map((d, i) => (
                <path key={i} d={d} stroke={i % 2 ? k.hairL : k.hairD} strokeWidth={i % 2 ? 0.6 : 0.9} opacity={i % 2 ? 0.55 : 0.6} fill="none" />
              ))}
              <path d={lockD} fill={k.url("sheenV")} />
            </g>
          </g>,
        );
      }
    }
  }
  if (st === "treccia") {
    // una treccia sola, portata davanti sulla spalla sinistra; dietro la testa solo la nuca
    back.push(<path key="nape" d={`M${100 - cw - 2} 100 C${100 - cw - 6} 130 ${100 + cw + 6} 130 ${100 + cw + 2} 100 Z`} fill={k.url("hairBack")} />);
    over.push(<Braid key="br" k={k} from={[70, 108]} to={[64, 150 + L * 0.95]} />);
  }

  if (st === "coda" || st === "coda-alta" || st === "chignon" || st === "raccolti" || st === "codini") {
    // capelli tirati indietro: niente frangia, la coda spunta di lato dietro il collo
    if (st === "coda" || st === "coda-alta" || st === "codini") {
      const yB = 130 + L * 0.9;
      const sides = st === "codini" ? ([1, -1] as const) : ([-1] as const);
      for (const dir of sides) {
        const X = (x: number) => 100 + (x - 100) * dir;
        const tail: Pt[] = [
          [X(100 - cw + 4), 92],
          [X(100 - cw - 6 - spread * 0.5), 108],
          [X(100 - cw - 9 - spread * 0.8), (108 + yB) / 2],
          [X(100 - cw - 4), yB],
          [X(100 - cw + 2), (108 + yB) / 2],
          [X(100 - cw + 6), 108],
        ];
        back.push(<path key={`t${dir}`} d={smooth(curly(tail, curl, dir === 1 ? 1 : -1, 4, 2))} fill={k.url("hairBack")} />);
      }
    }
    if (st === "chignon" || st === "raccolti") {
      back.push(<ellipse key="bun" cx="100" cy={top + 4} rx={16 + v * 3} ry={12 + v * 2} fill={k.url("hairBack")} />);
    }
  }

  if (st === "afro") {
    const R = 50 + v * 8 + L * 0.12;
    const cloud: Pt[] = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      cloud.push([100 + Math.cos(a) * R * 1.05, 80 + Math.sin(a) * R * 0.92 - 4]);
    }
    back.push(<path key="afro" d={smooth(curly(cloud, 95, -1, 6, 1))} fill={k.url("hairBack")} />);
  }

  // calotta sopra la fronte con ciocche, riflesso lucido e bordo increspato
  const capId = "cap";
  front.push(
    <g key="cap">
      <clipPath id={k.id(capId)}>
        <path d={capD} />
      </clipPath>
      <path d={capD} fill={k.url("hairCap")} />
      <g clipPath={`url(#${k.id(capId)})`}>
        {strands(
          [
            [part - 1, top + 4],
            [part + 1, top + 4],
          ],
          [
            [100 - cw - 6, 100],
            [100 - cw + 8, fy + 2],
          ],
          9,
          -6 - curl * 0.06,
        ).map((d, i) => (
          <path key={`l${i}`} d={d} stroke={i % 2 ? k.hairL : k.hairD} strokeWidth={i % 2 ? 0.55 : 0.85} opacity={0.6} fill="none" />
        ))}
        {strands(
          [
            [part - 1, top + 4],
            [part + 1, top + 4],
          ],
          [
            [100 + cw - 8, fy + 2],
            [100 + cw + 6, 100],
          ],
          9,
          6 + curl * 0.06,
        ).map((d, i) => (
          <path key={`r${i}`} d={d} stroke={i % 2 ? k.hairL : k.hairD} strokeWidth={i % 2 ? 0.55 : 0.85} opacity={0.6} fill="none" />
        ))}
        {curl > 55
          ? Array.from({ length: 26 }, (_, i) => {
              const a = (i * 137.5 * Math.PI) / 180;
              const rr = 8 + (i % 9) * 4;
              const cx = 100 + Math.cos(a) * rr * 1.3;
              const cy = 64 + Math.sin(a) * rr * 0.55 - 6;
              return <path key={`c${i}`} d={`M${r1(cx - 3)} ${r1(cy)} a3 3 0 1 1 6 0`} stroke={i % 2 ? k.hairL : k.hairD} strokeWidth="0.8" fill="none" opacity="0.6" />;
            })
          : null}
        {/* riflesso a fascia sulla curva della testa */}
        <path d={`M${100 - cw * 0.7} 56 C${100 - cw * 0.3} 42 ${100 + cw * 0.3} 42 ${100 + cw * 0.6} 52`} stroke={k.hairL} strokeWidth="5" opacity="0.28" fill="none" strokeLinecap="round" />
        <path d={`M${100 - cw * 0.6} 55 C${100 - cw * 0.3} 45 ${100 + cw * 0.2} 44 ${100 + cw * 0.5} 51`} stroke="#fff" strokeWidth="1.2" opacity="0.18" fill="none" strokeLinecap="round" />
      </g>
      <path d={capD} fill="none" stroke={shade(k.hair, -0.45)} strokeWidth="0.6" opacity="0.6" />
    </g>,
  );
  if (st === "chignon" || st === "raccolti" || st === "coda" || st === "coda-alta") {
    front.push(<path key="tie" d={`M${100 - cw + 2} 96 C${100 - cw - 2} 98 ${100 - cw - 2} 103 ${100 - cw + 2} 104`} stroke="#c94a3c" strokeWidth="2.2" fill="none" opacity="0" />);
  }
  return { back, front, over };
}

function Braid({ k, from, to }: { k: Kit; from: Pt; to: Pt }) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(4, Math.round(len / 7.5));
  const ang = (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI - 90;
  const links: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    const w = 6.2 - t * 1.8;
    const side = i % 2 ? 1 : -1;
    // ogni maglia è un lobo inclinato, alternato a destra e a sinistra
    links.push(
      <g key={i} transform={`translate(${r1(x)} ${r1(y)}) rotate(${r1(ang)})`}>
        <ellipse cx={side * w * 0.42} cy="4.6" rx={w * 0.78} ry="5.6" transform={`rotate(${side * -32} ${side * w * 0.42} 4.6)`} fill={k.url("hairLock")} stroke={shade(k.hair, -0.5)} strokeWidth="0.5" />
        <path d={`M${r1(side * w * 0.9)} 1.4 C${r1(side * w * 0.4)} 3.6 ${r1(-side * w * 0.1)} 6 ${r1(-side * w * 0.3)} 8.6`} stroke={k.hairL} strokeWidth="0.7" fill="none" opacity="0.6" />
        <path d={`M${r1(side * w * 1.1)} 3 C${r1(side * w * 0.5)} 5.6 ${r1(0)} 8 ${r1(-side * w * 0.1)} 9.6`} stroke={k.hairD} strokeWidth="0.6" fill="none" opacity="0.6" />
      </g>,
    );
  }
  return (
    <g>
      {links}
      <g transform={`translate(${r1(to[0])} ${r1(to[1])}) rotate(${r1(ang)})`}>
        <rect x="-3.6" y="2" width="7.2" height="3.2" rx="1.3" fill="#8a2f2f" />
        <path d="M-2.6 5 L-4 14 M0 5 L0 15 M2.6 5 L4 14 M-1.3 5 L-2 14.6 M1.3 5 L2 14.6" stroke={k.hair} strokeWidth="1.3" strokeLinecap="round" />
        <path d="M-2.6 5 L-4 14 M2.6 5 L4 14" stroke={k.hairD} strokeWidth="0.6" strokeLinecap="round" />
      </g>
    </g>
  );
}

function frontBeard(k: Kit, face: ReturnType<typeof frontFace>) {
  const b = k.look.beard;
  if (b === "nessuna" || k.woman) return null;
  const len = tune(k.look.beardLength, 50, 0, 100);
  const col = k.look.beardColor || k.hair;
  const ext = b === "lunga" ? 16 + len * 0.3 : b === "piena" ? 6 + len * 0.12 : b === "corta" ? 2 + len * 0.04 : 0;
  const cw = face.cw;
  const jw = face.jw;
  const chin = face.chin;
  const nodes: ReactNode[] = [];
  if (b === "corta" || b === "piena" || b === "lunga" || b === "accenno" || b === "barbetta") {
    const full = b !== "accenno";
    const d = `M${100 - cw + 1} 98 C${100 - cw + 1} 116 ${100 - jw - 4} 132 ${100 - jw + 2} ${chin - 8 + ext * 0.4} C${92} ${chin + ext} ${108} ${chin + ext} ${100 + jw - 2} ${chin - 8 + ext * 0.4} C${100 + jw + 4} 132 ${100 + cw - 1} 116 ${100 + cw - 1} 98 L${100 + cw - 5} 99 C${100 + cw - 6} 112 ${118} 124 ${112} 129 C${108} 126 ${92} 126 ${88} 129 C${82} 124 ${100 - cw + 6} 112 ${100 - cw + 5} 99 Z`;
    const mouthHole = `M88 131 C92 129 108 129 112 131 C110 141 90 141 88 131 Z`;
    nodes.push(
      <g key="bd">
        <mask id={k.id("bm")}>
          <rect x="0" y="0" width="200" height="240" fill="#fff" />
          <path d={mouthHole} fill="#000" />
        </mask>
        <g mask={`url(#${k.id("bm")})`}>
          <path d={d} fill={col} opacity={full ? 0.95 : 0.45} />
          <path d={d} fill={k.url("beardTex")} opacity={full ? 0.9 : 0.6} />
          <path d={d} fill={k.url("beardShade")} />
        </g>
      </g>,
    );
  }
  if (b !== "basette") {
    // baffi
    nodes.push(
      <path key="st" d="M88 131 C90 126 96 125.5 100 127.5 C104 125.5 110 126 112 131 C108 129.6 104 129.2 100 130 C96 129.2 92 129.6 88 131 Z" fill={shade(col, -0.1)} />,
      <path key="st2" d="M90 129.5 l-1.2 1.8 M93 128.4 l-1 2 M96 128 l-0.6 2 M104 128 l0.6 2 M107 128.4 l1 2 M110 129.5 l1.2 1.8" stroke={shade(col, 0.3)} strokeWidth="0.5" opacity="0.6" />,
    );
  }
  return <g>{nodes}</g>;
}

function FrontBust({ k }: { k: Kit }) {
  const shirt = k.look.shirt;
  const trim = k.look.trim || "#e9e4d8";
  return (
    <g>
      {/* collo con l'ombra del mento */}
      <path d="M86 136 L86 160 C86 170 80 177 68 182 L132 182 C120 177 114 170 114 160 L114 136 Z" fill={k.url("skinNeck")} />
      <path d="M86 138 C92 152 108 152 114 138 L114 158 C106 163 94 163 86 158 Z" fill={k.skinS} opacity="0.65" />
      <path d="M93 160 C96 170 104 170 107 160" stroke={k.skinS} strokeWidth="1" fill="none" opacity="0.4" />
      {/* spalle e polo: luce sulla spalla sinistra, pieghe verso l'ascella */}
      <path d="M14 240 C16 210 30 194 58 188 C70 185 78 181 86 177 L114 177 C122 181 130 185 142 188 C170 194 184 210 186 240 Z" fill={k.url("cloth")} />
      <path d="M14 240 C16 210 30 194 58 188 C70 185 78 181 86 177 L114 177 C122 181 130 185 142 188 C170 194 184 210 186 240 Z" fill={k.url("clothShade")} />
      <path d="M38 212 C44 222 46 232 44 240 M162 212 C156 222 154 232 156 240" stroke={shade(shirt, -0.4)} strokeWidth="1.2" fill="none" opacity="0.6" />
      <path d="M60 196 C66 204 70 214 70 226 M140 196 C134 204 130 214 130 226" stroke={shade(shirt, -0.3)} strokeWidth="0.9" fill="none" opacity="0.45" />
      <path d="M40 196 C50 190 62 188 74 186" stroke={shade(shirt, 0.35)} strokeWidth="2" fill="none" opacity="0.4" strokeLinecap="round" />
      {/* abbottonatura e colletto */}
      <path d="M96 184 L96 218 L104 218 L104 184 Z" fill={shade(shirt, -0.12)} />
      <path d="M96 184 L96 218" stroke={shade(shirt, -0.45)} strokeWidth="0.6" />
      {[194, 206].map((y) => (
        <g key={y}>
          <circle cx="100" cy={y} r="1.8" fill={trim} />
          <circle cx="99.5" cy={y - 0.5} r="0.6" fill="#fff" opacity="0.6" />
        </g>
      ))}
      <path d="M86 176 L72 186 L82 200 L98 186 Z" fill={trim} stroke={shade(trim, -0.35)} strokeWidth="0.6" />
      <path d="M114 176 L128 186 L118 200 L102 186 Z" fill={shade(trim, -0.08)} stroke={shade(trim, -0.35)} strokeWidth="0.6" />
      <path d="M86 176 C92 184 108 184 114 176" stroke={shade(trim, -0.3)} strokeWidth="1.4" fill="none" />
      <path d="M78 186 L86 196 M122 186 L114 196" stroke={shade(trim, -0.3)} strokeWidth="0.5" strokeDasharray="1 1" />
    </g>
  );
}

function Front({ k }: { k: Kit }) {
  const face = frontFace(k);
  const hair = frontHair(k, face);
  const freck = k.look.freckles;
  return (
    <g>
      {hair.back}
      <FrontBust k={k} />
      {hair.over}
      {/* orecchie */}
      {([1, -1] as const).map((dir) => {
        const X = (x: number) => 100 + (x - 100) * dir;
        const ex = 100 - face.cw;
        return (
          <g key={dir}>
            <path d={`M${X(ex + 2)} 92 C${X(ex - 7)} 86 ${X(ex - 10)} 100 ${X(ex - 7)} 112 C${X(ex - 5)} 120 ${X(ex - 1)} 121 ${X(ex + 2)} 116 Z`} fill={dir === 1 ? k.skin : k.skinS} />
            <path d={`M${X(ex - 1)} 96 C${X(ex - 6)} 94 ${X(ex - 6)} 104 ${X(ex - 4)} 110 C${X(ex - 3)} 113 ${X(ex - 1)} 113 ${X(ex)} 110`} stroke={k.skinD} strokeWidth="0.9" fill="none" opacity="0.7" />
            <path d={`M${X(ex + 2)} 92 C${X(ex - 7)} 86 ${X(ex - 10)} 100 ${X(ex - 7)} 112 C${X(ex - 5)} 120 ${X(ex - 1)} 121 ${X(ex + 2)} 116`} stroke={k.line} strokeWidth="0.6" fill="none" opacity="0.5" />
          </g>
        );
      })}
      {/* volto */}
      <clipPath id={k.id("face")}>
        <path d={face.d} />
      </clipPath>
      <path d={face.d} fill={k.url("skin")} />
      <g clipPath={`url(#${k.id("face")})`}>
        {/* ombra sul lato destro, luce sulla fronte e sullo zigomo sinistro */}
        <rect x="60" y="40" width="82" height="120" fill={k.url("shadeR")} />
        <ellipse cx="88" cy="62" rx="22" ry="12" fill={k.url("hl")} />
        <ellipse cx="78" cy="106" rx="11" ry="6" fill={k.url("hl")} />
        <ellipse cx="99" cy="104" rx="3" ry="10" fill={k.url("hl")} opacity="0.7" />
        <ellipse cx="80" cy="117" rx="11" ry="6.5" fill={k.url("blush")} opacity={k.woman ? 0.9 : 0.55} />
        <ellipse cx="121" cy="117" rx="11" ry="6.5" fill={k.url("blush")} opacity={k.woman ? 0.75 : 0.45} />
        <ellipse cx="100" cy="147" rx="8" ry="3.4" fill={k.url("hl")} opacity="0.7" />
        <path d={`M${100 - face.jw - 4} 130 C92 ${face.chin + 2} 108 ${face.chin + 2} ${100 + face.jw + 4} 130`} stroke={k.skinS} strokeWidth="3" fill="none" opacity="0.25" />
      </g>
      <path d={face.d} fill="none" stroke={k.line} strokeWidth="0.7" opacity="0.55" />
      {freck
        ? Array.from({ length: 18 }, (_, i) => {
            const side = i % 2 ? 1 : -1;
            const a = i * 2.39;
            return <circle key={i} cx={100 + side * (12 + (i % 5) * 3) + Math.cos(a) * 2} cy={112 + Math.sin(a) * 4} r="0.7" fill={shade(k.skin, -0.35)} opacity="0.6" />;
          })
        : null}
      <FrontEye k={k} x={81} dir={1} />
      <FrontEye k={k} x={119} dir={-1} />
      {frontBrow(k, 81, 1)}
      {frontBrow(k, 119, -1)}
      <FrontNose k={k} />
      <FrontMouth k={k} />
      {frontBeard(k, face)}
      {hair.front}
    </g>
  );
}

/* ---------------------------------------------------------------- profilo (guarda a destra) */

const SIDE_HEAD = (k: Kit) => {
  const f = k.look.face;
  const chinX = f === "squadrato" ? 133 : f === "tondo" ? 131 : 132;
  const chinY = f === "allungato" ? 157 : 153;
  const jawX = f === "squadrato" ? 92 : 95;
  return `M78 134 C70 122 63 106 63 88 C63 60 81 41 106 41 C127 41 139 56 141 74 C142 80 141 86 140 89 C139 91 138 93 138.5 95 C139.5 100 141.5 105 145 110.5 C147 114 147 116.5 144.5 118.3 C142.5 119.8 140 120.2 138.4 120.4 C138 122 139.4 125 139.8 127 C140 129 138.2 130.4 137.6 131 C139 132.2 139.4 135 138 137 C136.4 138.8 134.8 139.6 135 141.6 C${chinX + 3.6} ${chinY - 7} ${chinX + 2} ${chinY - 1} ${chinX - 3} ${chinY} C${chinX - 10} ${chinY + 2} 112 ${chinY} 104 149 C98 146 ${jawX + 1} 142 ${jawX} 137 C${jawX - 2} 133 90 130 86 130 Z`;
};

function SideEye({ k }: { k: Kit }) {
  const s = 0.88 + (tune(k.look.eyeSize, 50, 0, 100) / 100) * 0.26;
  const x = 129;
  const y = 97.5;
  const eye = `M${x - 5 * s} ${y - 0.8} C${x - 2 * s} ${y - 3.6 * s} ${x + 2.4 * s} ${y - 3.8 * s} ${x + 4.4 * s} ${y - 1.6} L${x + 3.6 * s} ${y + 1.6} C${x + 1 * s} ${y + 2.8 * s} ${x - 2.6 * s} ${y + 2.2 * s} ${x - 5 * s} ${y - 0.8} Z`;
  const iris = blend(k.look.eyes, "#000000", 0.05);
  return (
    <g>
      <ellipse cx={x - 1} cy={y - 1.4} rx={7.5 * s} ry={5.2 * s} fill={k.skinS} opacity="0.35" />
      <clipPath id={k.id("seye")}>
        <path d={eye} />
      </clipPath>
      <path d={eye} fill="#f6f1ea" />
      <g clipPath={`url(#${k.id("seye")})`}>
        <ellipse cx={x + 1.6 * s} cy={y - 0.4} rx={2.4 * s} ry={3.6 * s} fill={iris} />
        <ellipse cx={x + 1.6 * s} cy={y - 0.4} rx={2.4 * s} ry={3.6 * s} fill={k.url("iris")} />
        <ellipse cx={x + 2.4 * s} cy={y - 0.4} rx={1 * s} ry={1.9 * s} fill="#0a0806" />
        <path d={`M${x - 6} ${y - 2.6 * s} L${x + 6} ${y - 2.6 * s}`} stroke="#000" strokeOpacity="0.25" strokeWidth={1.6 * s} />
      </g>
      <circle cx={x + 1 * s} cy={y - 1.8 * s} r={0.7 * s} fill="#fff" />
      <path d={`M${x - 5.4 * s} ${y - 0.6} C${x - 2 * s} ${y - 4.2 * s} ${x + 2.4 * s} ${y - 4.4 * s} ${x + 4.8 * s} ${y - 1.6}`} stroke={shade(k.skin, -0.72)} strokeWidth={k.woman ? 1.7 : 1.4} fill="none" strokeLinecap="round" />
      {k.woman ? <path d={`M${x + 4.4 * s} ${y - 1.8} l2.6 -1.8 M${x + 3.2 * s} ${y - 2.8} l2.2 -2.2`} stroke={shade(k.skin, -0.75)} strokeWidth="0.8" strokeLinecap="round" /> : null}
      <path d={`M${x - 4.4 * s} ${y - 3.6 * s} C${x - 1 * s} ${y - 6.4 * s} ${x + 2 * s} ${y - 6.4 * s} ${x + 4 * s} ${y - 4 * s}`} stroke={k.skinD} strokeWidth="0.6" fill="none" opacity="0.5" />
      <path d={`M${x - 3 * s} ${y + 2.2 * s} C${x} ${y + 3.6 * s} ${x + 2.4 * s} ${y + 3 * s} ${x + 3.6 * s} ${y + 1.6}`} stroke={k.skinD} strokeWidth="0.5" fill="none" opacity="0.45" />
    </g>
  );
}

function sideHair(k: Kit) {
  const st = k.look.hair;
  const L = k.L;
  const v = (k.V - 50) / 50;
  const curl = k.curl;
  const spread = 7 + v * 11 + curl * 0.07;
  const fringe = tune(k.look.fringe, st === "frangia" || st === "caschetto" ? 70 : 0, 0, 100);
  const top = 33 - v * 3 - curl * 0.04;
  const back: ReactNode[] = [];
  const front: ReactNode[] = [];
  if (st === "calvo") return { back, front };
  if (st === "rasati") {
    const d = "M136 64 C134 48 120 40 104 40 C82 40 64 54 64 82 C64 100 70 116 78 128 L86 126 C86 116 90 104 96 96 C104 92 110 94 112 96 C114 86 120 76 136 64 Z";
    front.push(<path key="r" d={d} fill={k.hair} opacity="0.55" />, <path key="r2" d={d} fill={k.url("stubble")} opacity="0.7" />);
    return { back, front };
  }
  const longish = LONG.has(st) || st === "treccia" || st === "trecce" || st === "dread";
  // calotta: copre il cranio fino alla nuca, attaccatura sulla fronte, basetta davanti all'orecchio
  const fy = 60 + (fringe / 100) * 28;
  const short = SHORT.has(st);
  const t2 = 37 - L * 0.16 - v * 3 - (st === "cresta" ? 8 : 0);
  const outer: Pt[] = short
    ? [
        [137 + (fringe > 10 ? 3 : 0), fringe > 10 ? fy : 64],
        [139, 50],
        [124, t2 + 3],
        [104, t2],
        [80, t2 + 4],
        [64 - v * 2, 52],
        [59 - v * 2, 76],
        [61 - v, 100],
        [69, 120],
        [78, 128],
      ]
    : [
    [137 + (fringe > 10 ? 3 : 0), fringe > 10 ? fy : 64],
    [138 + spread * 0.15, 50],
    [124, top + 4],
    [104, top],
    [80, top + 4],
    [62 - spread * 0.4, 52],
    [56 - spread * 0.7, 78],
    [58 - spread * 0.8, 102],
    [66 - spread * 0.6, 124],
    [76, 136],
      ];
  const inner: Pt[] = [
    short ? [84, 124] : [86, 130],
    short ? [88, 108] : [88, 116],
    longish ? [94, 104] : [92, 98],
    longish ? [100, 98] : [98, 90],
    ...((k.woman || longish
      ? [
          [108, 88],
          [116, 84],
        ]
      : [
          [106, 90],
          [109, 94],
          [110, 106],
          [113.5, 106],
          [114, 92],
        ]) as Pt[]),
    [120, 82],
    [128, 74],
  ];
  if (fringe > 10) inner.push([134, fy + 2]);
  const capD =
    curl > 55
      ? `M${r1(outer[0][0])} ${r1(outer[0][1])}${scallop(outer, 7.5, 0, 3)} L${r1(inner[0][0])} ${r1(inner[0][1])}${smoothTail(inner)} Z`
      : smooth([...curly(outer, curl, -1, 5, 3), ...inner]);
  if (longish) {
    const bob = st === "caschetto";
    const yB = bob ? 128 + L * 0.4 : 150 + L * 0.95;
    const mass: Pt[] = [
      [96, 60],
      [70 - spread * 0.3, 50],
      [56 - spread * 0.8, 80],
      [56 - spread, 116],
      [58 - spread * 1.1, (116 + yB) / 2],
      [62 - spread * 0.7, yB - 4],
      [76, yB],
      [86, yB - 8],
      [90, (126 + yB) / 2],
      [92, 128],
      [96, 108],
    ];
    if (st === "treccia") {
      back.push(<Braid key="br" k={k} from={[72, 120]} to={[66, yB]} />);
    } else {
      const massD = outline(mass, curl, 0, 1);
      back.push(
        <g key="mass">
          <clipPath id={k.id("smass")}>
            <path d={massD} />
          </clipPath>
          <path d={massD} fill={k.url("hairLock")} />
          <g clipPath={`url(#${k.id("smass")})`}>
            {curl > 55 ? curlTexture(k, [46, 60, 96, yB], 34, 2) : null}
            {curl > 55 ? null : strands(
              [
                [60, 70],
                [92, 70],
              ],
              [
                [58, yB],
                [86, yB],
              ],
              11,
              -curl * 0.1,
            ).map((d, i) => (
              <path key={i} d={d} stroke={i % 2 ? k.hairL : k.hairD} strokeWidth={i % 2 ? 0.6 : 0.9} opacity="0.55" fill="none" />
            ))}
            <path d={massD} fill={k.url("sheenV")} />
          </g>
        </g>,
      );
    }
  }
  if (st === "coda" || st === "coda-alta" || st === "codini") {
    const ay = st === "coda-alta" ? 50 : 92;
    const yB = ay + 30 + L * 0.9;
    const tail: Pt[] = [
      [70, ay - 6],
      [58 - spread * 0.4, ay + 4],
      [50 - spread * 0.6, (ay + yB) / 2],
      [56, yB],
      [62, (ay + yB) / 2 + 6],
      [68, ay + 10],
    ];
    back.push(
      <g key="tail">
        <path d={smooth(curly(tail, curl, -1, 4, 2))} fill={k.url("hairLock")} />
        <path d={smooth(tail.slice(1, 4), false)} stroke={k.hairL} strokeWidth="1" fill="none" opacity="0.45" />
      </g>,
    );
    front.push(<rect key="tie" x="66" y={ay - 5} width="6" height="9" rx="2" fill="#2a2a2a" transform={`rotate(20 69 ${ay})`} />);
  }
  if (st === "chignon" || st === "raccolti") {
    back.push(<circle key="bun" cx="66" cy="62" r={14 + v * 3} fill={k.url("hairLock")} />);
    back.push(<path key="bun2" d="M56 56 C62 50 72 52 76 58 M54 64 C62 60 72 62 78 68" stroke={k.hairL} strokeWidth="0.9" fill="none" opacity="0.6" />);
  }
  if (st === "afro") {
    const R = 50 + v * 8 + L * 0.12;
    const cloud: Pt[] = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      cloud.push([96 + Math.cos(a) * R * 1.05, 80 + Math.sin(a) * R * 0.92 - 4]);
    }
    back.push(<path key="afro" d={smooth(curly(cloud, 95, -1, 6, 1))} fill={k.url("hairBack")} />);
  }
  front.push(
    <g key="cap">
      <clipPath id={k.id("scap")}>
        <path d={capD} />
      </clipPath>
      <path d={capD} fill={k.url("hairCap")} />
      <g clipPath={`url(#${k.id("scap")})`}>
        {strands(
          [
            [134, 62],
            [136, 66],
          ],
          [
            [62, 120],
            [90, 130],
          ],
          14,
          -14 - curl * 0.08,
        ).map((d, i) => (
          <path key={i} d={d} stroke={i % 2 ? k.hairL : k.hairD} strokeWidth={i % 2 ? 0.55 : 0.85} opacity="0.6" fill="none" />
        ))}
        {curl > 55
          ? Array.from({ length: 24 }, (_, i) => {
              const a = (i * 137.5 * Math.PI) / 180;
              const rr = 6 + (i % 8) * 4;
              const cx = 96 + Math.cos(a) * rr * 1.1;
              const cy = 70 + Math.sin(a) * rr * 0.9;
              return <path key={`c${i}`} d={`M${r1(cx - 3)} ${r1(cy)} a3 3 0 1 1 6 0`} stroke={i % 2 ? k.hairL : k.hairD} strokeWidth="0.8" fill="none" opacity="0.6" />;
            })
          : null}
        <path d="M76 50 C90 38 112 36 128 46" stroke={k.hairL} strokeWidth="6" opacity="0.28" fill="none" strokeLinecap="round" />
        <path d="M80 48 C94 40 112 39 124 45" stroke="#fff" strokeWidth="1.2" opacity="0.18" fill="none" strokeLinecap="round" />
      </g>
      <path d={capD} fill="none" stroke={shade(k.hair, -0.45)} strokeWidth="0.6" opacity="0.6" />
    </g>,
  );
  return { back, front };
}

function sideBeard(k: Kit) {
  const b = k.look.beard;
  if (b === "nessuna" || k.woman) return null;
  const len = tune(k.look.beardLength, 50, 0, 100);
  const col = k.look.beardColor || k.hair;
  const ext = b === "lunga" ? 16 + len * 0.3 : b === "piena" ? 6 + len * 0.12 : b === "corta" ? 2 + len * 0.04 : 0;
  const nodes: ReactNode[] = [];
  if (b !== "baffi" && b !== "basette" && b !== "pizzetto" && b !== "mosca") {
    const d = `M110 104 C110 116 114 126 124 130 C128 132 132 132 134 134 C136 136 137 138 135 141 C136 146 136 ${150 + ext * 0.5} ${131 + ext * 0.1} ${154 + ext} C${122} ${157 + ext * 0.6} 108 ${154 + ext * 0.3} 100 148 C96 144 94 138 96 128 C100 120 104 112 106 104 Z`;
    nodes.push(
      <g key="bd" opacity={b === "accenno" ? 0.5 : 1}>
        <path d={d} fill={col} />
        <path d={d} fill={k.url("beardTex")} opacity="0.9" />
        <path d={d} fill={k.url("beardShade")} />
      </g>,
    );
  }
  if (b !== "basette") {
    nodes.push(<path key="st" d="M128 125.5 C132 123 137 122.8 139.4 124.6 C139.6 126.4 138.6 128 137.4 128.8 C134 127.4 130.6 127.6 127 128.6 Z" fill={shade(col, -0.1)} />);
  }
  return <g>{nodes}</g>;
}

function SideBust({ k }: { k: Kit }) {
  const shirt = k.look.shirt;
  const trim = k.look.trim || "#e9e4d8";
  return (
    <g>
      <path d="M78 126 C80 148 76 166 66 182 L126 186 C118 174 112 162 110 148 Z" fill={k.url("skinNeck")} />
      <path d="M78 130 C82 146 80 160 74 176 C86 170 92 158 94 140 Z" fill={k.skinS} opacity="0.55" />
      <path d="M104 150 C108 160 112 168 118 176" stroke={k.skinS} strokeWidth="1.4" fill="none" opacity="0.4" />
      {/* busto di profilo: petto verso destra, schiena a sinistra, braccio lungo il fianco */}
      <path d="M44 240 C42 214 48 196 62 186 C74 178 92 176 110 178 C126 180 134 188 140 200 C146 214 148 228 148 240 Z" fill={k.url("cloth")} />
      <path d="M44 240 C42 214 48 196 62 186 C74 178 92 176 110 178 C126 180 134 188 140 200 C146 214 148 228 148 240 Z" fill={k.url("clothShade")} />
      <path d="M78 190 C70 204 68 222 70 240 L110 240 C112 222 110 204 102 190 C96 186 84 186 78 190 Z" fill={shade(shirt, -0.06)} />
      <path d="M78 190 C70 204 68 222 70 240 M102 190 C110 204 112 222 110 240" stroke={shade(shirt, -0.4)} strokeWidth="0.9" fill="none" opacity="0.6" />
      <path d="M80 194 C88 190 96 190 100 194" stroke={shade(shirt, 0.35)} strokeWidth="2" fill="none" opacity="0.35" strokeLinecap="round" />
      <path d="M72 210 C76 216 78 224 78 232 M104 206 C100 214 98 222 98 232" stroke={shade(shirt, -0.3)} strokeWidth="0.8" fill="none" opacity="0.45" />
      {/* colletto: risvolto davanti, alto dietro il collo */}
      <path d="M74 174 C86 178 104 180 116 176 L124 186 C112 190 100 194 92 196 L84 184 Z" fill={trim} stroke={shade(trim, -0.35)} strokeWidth="0.6" />
      <path d="M116 176 L130 192 L118 196 L108 186 Z" fill={shade(trim, -0.06)} stroke={shade(trim, -0.35)} strokeWidth="0.6" />
      <path d="M74 174 C86 178 104 180 116 176" stroke={shade(trim, -0.3)} strokeWidth="1.4" fill="none" />
    </g>
  );
}

function Side({ k }: { k: Kit }) {
  const hair = sideHair(k);
  const head = SIDE_HEAD(k);
  return (
    <g>
      <SideBust k={k} />
      {hair.back}
      <clipPath id={k.id("shead")}>
        <path d={head} />
      </clipPath>
      <path d={head} fill={k.url("skin")} />
      <g clipPath={`url(#${k.id("shead")})`}>
        {/* ombra sotto lo zigomo e lungo la mandibola, luce sulla fronte e sul naso */}
        <ellipse cx="112" cy="130" rx="18" ry="11" fill={k.url("shadeSoft")} />
        <rect x="60" y="134" width="90" height="30" fill={k.url("shadeJaw")} />
        <rect x="60" y="40" width="40" height="110" fill={k.url("shadeBack")} />
        <ellipse cx="126" cy="66" rx="16" ry="11" fill={k.url("hl")} />
        <path d="M140 102 C142 108 144 112 145 115" stroke={k.skinL} strokeWidth="2" opacity="0.55" strokeLinecap="round" />
        <ellipse cx="122" cy="115" rx="11" ry="6.5" fill={k.url("blush")} opacity={k.woman ? 0.8 : 0.5} />
        <ellipse cx="116" cy="105" rx="10" ry="5" fill={k.url("hl")} />
      </g>
      <path d={head} fill="none" stroke={k.line} strokeWidth="0.7" opacity="0.55" />
      {/* orecchio */}
      <path d="M89 93 C99 87 105 97 103 106 C102 114 99 122 93 121 C88.5 120 88 115 89.5 111 Z" fill={k.skin} stroke={k.line} strokeWidth="0.6" strokeOpacity="0.5" />
      <path d="M92 97 C98 94 101 101 99.5 107 C98.5 112 96 115 94 113 M94 103 C96 103 97 106 95.6 108" stroke={k.skinD} strokeWidth="0.9" fill="none" opacity="0.7" strokeLinecap="round" />
      <path d="M91 96 C94 94 97 94.5 99 96.5" stroke={k.skinL} strokeWidth="0.8" fill="none" opacity="0.6" />
      {/* narice, bocca */}
      <path d="M139.6 117.4 C138 116.6 136.6 117.4 136.8 118.8" stroke={shade(k.skin, -0.55)} strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <path d="M137.6 131 C136 131.4 134.6 131.6 133.4 131.2" stroke={shade(blend(k.skin, "#a24a3e", 0.4), -0.5)} strokeWidth="0.8" fill="none" strokeLinecap="round" />
      <path d="M137.8 127 C138.8 128.6 138.6 130 137.6 131 C138.6 132 139 134.4 138 136.6" fill={blend(k.skin, k.woman ? "#b5404c" : "#a24a3e", k.woman ? 0.5 : 0.32)} opacity="0.85" />
      <SideEye k={k} />
      {/* sopracciglio */}
      <path d={`M122 ${88 + (k.look.expression === "deciso" ? 1.4 : 0)} C126 84.6 131 84 137.6 86.6 C132 86.6 126 88 122 ${90.6 + (k.look.expression === "deciso" ? 1.4 : 0)} Z`} fill={k.hairD} opacity="0.85" />
      <path d="M124 88.6 l1.6 -2.6 M127 87.6 l1.6 -2.6 M130 87 l1.6 -2.4 M133 86.8 l1.4 -2" stroke={shade(k.hairD, -0.3)} strokeWidth="0.55" strokeLinecap="round" />
      {sideBeard(k)}
      {hair.front}
    </g>
  );
}

/* ---------------------------------------------------------------- componente */

export function AvatarBust({ look, view = "front", className = "h-64 w-auto" }: { look: HdLook; view?: View; className?: string }) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (k: string) => `hd${raw}${k}`;
  const url = (k: string) => `url(#${id(k)})`;
  const skin = look.skin;
  const hair = look.hairColor;
  const woman = look.body === "donna" || look.body === "ragazza";
  const k: Kit = {
    id,
    url,
    skin,
    skinL: shade(skin, 0.2),
    skinS: blend(shade(skin, -0.2), "#9a3a2a", 0.12),
    skinD: blend(shade(skin, -0.36), "#7a2a1a", 0.12),
    line: shade(skin, -0.58),
    hair,
    hairL: shade(hair, 0.32),
    hairD: shade(hair, -0.35),
    woman,
    look,
    L: tune(look.hairLength, 50, 0, 100),
    V: tune(look.hairVolume, 50, 0, 100),
    curl: tune(look.hairCurl, CURL_OF[look.hair] ?? 0, 0, 100),
  };
  const shirt = look.shirt;
  const beard = look.beardColor || hair;
  return (
    <svg viewBox="0 0 200 240" className={className} aria-hidden>
      <defs>
        <radialGradient id={id("skin")} cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor={shade(skin, 0.12)} />
          <stop offset="0.6" stopColor={skin} />
          <stop offset="1" stopColor={k.skinS} />
        </radialGradient>
        <linearGradient id={id("skinNeck")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(skin, -0.04)} />
          <stop offset="1" stopColor={k.skinS} />
        </linearGradient>
        <linearGradient id={id("shadeR")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.5" stopColor={k.skinS} stopOpacity="0" />
          <stop offset="0.85" stopColor={k.skinS} stopOpacity="0.55" />
          <stop offset="1" stopColor={k.skinD} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={id("shadeBack")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={k.skinD} stopOpacity="0.55" />
          <stop offset="1" stopColor={k.skinS} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("shadeJaw")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={k.skinS} stopOpacity="0" />
          <stop offset="0.5" stopColor={k.skinS} stopOpacity="0.6" />
          <stop offset="1" stopColor={k.skinD} stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id={id("shadeSoft")}>
          <stop offset="0" stopColor={k.skinS} stopOpacity="0.55" />
          <stop offset="1" stopColor={k.skinS} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("hl")}>
          <stop offset="0" stopColor={k.skinL} stopOpacity="0.75" />
          <stop offset="1" stopColor={k.skinL} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("blush")}>
          <stop offset="0" stopColor="#e2685a" stopOpacity="0.38" />
          <stop offset="1" stopColor="#e2685a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("iris")} cx="0.45" cy="0.6" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <linearGradient id={id("hairCap")} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={shade(hair, 0.12)} />
          <stop offset="0.55" stopColor={hair} />
          <stop offset="1" stopColor={k.hairD} />
        </linearGradient>
        <linearGradient id={id("hairBack")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(hair, -0.2)} />
          <stop offset="1" stopColor={shade(hair, -0.45)} />
        </linearGradient>
        <linearGradient id={id("hairLock")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(hair, 0.08)} />
          <stop offset="0.5" stopColor={hair} />
          <stop offset="1" stopColor={k.hairD} />
        </linearGradient>
        <linearGradient id={id("sheenV")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="0.25" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id={id("cloth")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={shade(shirt, 0.18)} />
          <stop offset="0.5" stopColor={shirt} />
          <stop offset="1" stopColor={shade(shirt, -0.35)} />
        </linearGradient>
        <linearGradient id={id("clothShade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id={id("beardShade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
        <pattern id={id("beardTex")} width="3" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
          <path d="M0.6 0 L0.9 2.6" stroke={shade(beard, -0.45)} strokeWidth="0.45" />
          <path d="M2 1 L2.2 3.2" stroke={shade(beard, 0.35)} strokeWidth="0.3" opacity="0.7" />
        </pattern>
        <pattern id={id("stubble")} width="1.6" height="1.6" patternUnits="userSpaceOnUse">
          <circle cx="0.5" cy="0.5" r="0.32" fill={shade(hair, -0.4)} />
          <circle cx="1.3" cy="1.2" r="0.26" fill={shade(hair, -0.2)} />
        </pattern>
      </defs>
      {view === "front" ? <Front k={k} /> : <Side k={k} />}
    </svg>
  );
}
