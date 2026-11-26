import { useId } from "react";

/**
 * Archi disegnati come oggetti veri, visti di fianco (corda a sinistra, dorso verso il bersaglio a destra):
 * longbow a D con le lamelle del legno e i puntali in corno, ricurvo tradizionale con riser in legni
 * diversi e flettenti in fibra, olimpico in alluminio con mirino, stabilizzatore e clicker, compound con
 * camme e cavi, archi a cavallo in corno con le orecchie rigide, flatbow. Tutto in vettoriale, nitido a ogni misura.
 */

type P = [number, number];

/** legni per gli archi di legno: dorso, anima, ventre e il colore delle venature */
export const BOW_WOODS = [
  { id: "tasso", label: "Tasso", back: "#f0dfb4", core: "#d18a4a", belly: "#b4582a", grain: "#6e2f12" },
  { id: "frassino", label: "Frassino", back: "#efdcae", core: "#e2c58f", belly: "#cfae74", grain: "#8a6a3a" },
  { id: "noce", label: "Noce", back: "#8a5a36", core: "#6b4428", belly: "#55331d", grain: "#2c190c" },
  { id: "bubinga", label: "Bubinga", back: "#a7492a", core: "#8e3b24", belly: "#722c1a", grain: "#3d1309" },
  { id: "zebrano", label: "Zebrano", back: "#d9b77c", core: "#c9a46a", belly: "#b48d55", grain: "#3c2a18" },
  { id: "olivo", label: "Olivo", back: "#cdb27a", core: "#b89a5c", belly: "#9d7f45", grain: "#4a3a1c" },
  { id: "bambu", label: "Bambù laminato", back: "#e8cf86", core: "#5a2a4a", belly: "#7a4a2a", grain: "#9b7a33" },
  { id: "laminato", label: "Laminato scuro", back: "#d9c08a", core: "#3b2418", belly: "#6e3f22", grain: "#1f120a" },
] as const;

/** modelli pronti di arco: un tocco imposta tipo, legno e colori */
export const BOW_MODELS: { id: string; label: string; note: string; specs: Record<string, string> }[] = [
  { id: "longbow-tasso", label: "Longbow inglese", note: "Tasso, puntali in corno", specs: { bowType: "longbow", wood: "tasso", riser: "", limbs: "" } },
  { id: "longbow-lam", label: "Longbow laminato", note: "Bambù e legni scuri", specs: { bowType: "longbow", wood: "bambu", riser: "", limbs: "" } },
  { id: "ricurvo-caccia", label: "Ricurvo da caccia", note: "Riser in bubinga, fibra nera", specs: { bowType: "ricurvo", wood: "bubinga", riser: "", limbs: "#15191d" } },
  { id: "ricurvo-noce", label: "Ricurvo in noce", note: "Flettenti in fibra marrone", specs: { bowType: "ricurvo", wood: "noce", riser: "", limbs: "#5b3618" } },
  { id: "olimpico-blu", label: "Olimpico blu", note: "Alluminio, mirino, stabilizzatori", specs: { bowType: "olimpico", riser: "#2f6fbe", limbs: "#15191d", wood: "" } },
  { id: "olimpico-rosso", label: "Olimpico rosso", note: "Flettenti in carbonio", specs: { bowType: "olimpico", riser: "#b02a2a", limbs: "#15191d", wood: "" } },
  { id: "nudo", label: "Arco nudo", note: "Senza mirino, peso in basso", specs: { bowType: "nudo", riser: "#1d2126", limbs: "#15191d", wood: "" } },
  { id: "compound", label: "Compound", note: "Camme, diottra, scope", specs: { bowType: "compound", riser: "#23272c", limbs: "#4b535c", wood: "" } },
  { id: "turco", label: "Arco turco", note: "Corno, orecchie rigide", specs: { bowType: "storico", wood: "", riser: "#7a1f1a", limbs: "" } },
  { id: "mongolo", label: "Arco mongolo", note: "Corteccia di betulla", specs: { bowType: "asiatico", wood: "", riser: "#2f5d3a", limbs: "" } },
  { id: "flatbow", label: "Flatbow in frassino", note: "Flettenti piatti", specs: { bowType: "flatbow", wood: "frassino", riser: "", limbs: "" } },
];

export function shadeHex(hex: string, k: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, "0")}`;
}

/* ---------- geometria: una linea centrale fatta di curve e una fascia di spessore variabile ---------- */

type Seg = [P, P, P, P];
const cub = (s: Seg, t: number): P => {
  const u = 1 - t;
  return [
    u * u * u * s[0][0] + 3 * u * u * t * s[1][0] + 3 * u * t * t * s[2][0] + t * t * t * s[3][0],
    u * u * u * s[0][1] + 3 * u * u * t * s[1][1] + 3 * u * t * t * s[2][1] + t * t * t * s[3][1],
  ];
};
/** la linea centrale: t da 0 (puntale in alto) a 1 (puntale in basso), un tratto per curva */
const along = (segs: Seg[]) => (t: number): P => {
  const k = Math.min(segs.length - 1, Math.floor(t * segs.length));
  return cub(segs[k], t * segs.length - k);
};
const mirror = (segs: Seg[], cy: number): Seg[] => segs.map((s) => s.map(([x, y]) => [x, 2 * cy - y] as P).reverse() as Seg).reverse();

const f1 = (v: number) => Math.round(v * 10) / 10;

/**
 * La fascia fra due frazioni dello spessore: 0 = dorso (a destra), 1 = ventre (a sinistra, verso la corda).
 * Con a=0, b=1 è tutto il flettente; con frazioni intermedie, le lamelle del legno.
 */
function band(c: (t: number) => P, w: (t: number) => number, a: number, b: number, t0 = 0, t1 = 1, n = 56) {
  const left: P[] = [];
  const right: P[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = t0 + ((t1 - t0) * i) / n;
    const p = c(t);
    const q = c(Math.min(1, t + 0.002));
    const o = c(Math.max(0, t - 0.002));
    let tx = q[0] - o[0];
    let ty = q[1] - o[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const nx = ty;
    const ny = -tx;
    const ww = w(t);
    const pa = ww * (0.5 - a);
    const pb = ww * (0.5 - b);
    left.push([p[0] + nx * pa, p[1] + ny * pa]);
    right.push([p[0] + nx * pb, p[1] + ny * pb]);
  }
  return `M${left.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(" L")} L${right.reverse().map(([x, y]) => `${f1(x)} ${f1(y)}`).join(" L")} Z`;
}
/** una linea parallela alla centrale (venature, cuciture, bordi) */
function line(c: (t: number) => P, w: (t: number) => number, f: number, t0 = 0, t1 = 1, n = 48, wob = 0, seed = 1) {
  const pts: string[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = t0 + ((t1 - t0) * i) / n;
    const p = c(t);
    const q = c(Math.min(1, t + 0.002));
    const o = c(Math.max(0, t - 0.002));
    let tx = q[0] - o[0];
    let ty = q[1] - o[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const off = w(t) * (0.5 - f) + (wob ? Math.sin(t * 40 * seed + seed * 3.1) * wob * w(t) : 0);
    pts.push(`${f1(p[0] + ty * off)} ${f1(p[1] - tx * off)}`);
  }
  return `M${pts.join(" L")}`;
}

/** numeri pseudo-casuali ripetibili (venature uguali a ogni disegno) */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Wood = (typeof BOW_WOODS)[number];
const woodOf = (id: string | undefined, fallback: Wood["id"]) => BOW_WOODS.find((w) => w.id === id) ?? BOW_WOODS.find((w) => w.id === fallback) ?? BOW_WOODS[0];

/* ---------------------------------------- l'arco ---------------------------------------- */

export function BowArt({ type, className = "h-16 w-16", riser = "", limbs = "", wood = "" }: { type: string; className?: string; riser?: string; limbs?: string; wood?: string }) {
  const u = `b${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const kind = type === "ricurvo" || type === "longbow" || type === "olimpico" || type === "nudo" || type === "compound" || type === "storico" || type === "asiatico" || type === "flatbow" ? type : "olimpico";
  return (
    <svg viewBox="0 0 120 240" className={className} aria-hidden>
      <defs>
        {/* luce da sinistra in alto: lucido sul bordo, ombra sotto */}
        <linearGradient id={`${u}-gloss`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0.06" />
          <stop offset="1" stopColor="#000" stopOpacity="0.32" />
        </linearGradient>
        <linearGradient id={`${u}-metal`} x1="0" x2="1">
          <stop offset="0" stopColor="#fbfcfd" />
          <stop offset="0.45" stopColor="#a9b2bb" />
          <stop offset="0.7" stopColor="#6c757e" />
          <stop offset="1" stopColor="#3b4249" />
        </linearGradient>
        <linearGradient id={`${u}-brass`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff0b8" />
          <stop offset="0.5" stopColor="#d9a93a" />
          <stop offset="1" stopColor="#7a5512" />
        </linearGradient>
        <linearGradient id={`${u}-leather`} x1="0" x2="1">
          <stop offset="0" stopColor="#7a4a26" />
          <stop offset="0.5" stopColor="#4a2a14" />
          <stop offset="1" stopColor="#2a160a" />
        </linearGradient>
        <pattern id={`${u}-weave`} width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="1.2" height="2.4" fill="#fff" opacity="0.07" />
        </pattern>
        <filter id={`${u}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>
      {/* ombra a terra */}
      <ellipse cx="66" cy="236" rx="30" ry="2.6" fill="#000" opacity="0.28" filter={`url(#${u}-soft)`} />
      {kind === "longbow" ? <Longbow u={u} wood={woodOf(wood, "tasso")} tint={riser} /> : null}
      {kind === "flatbow" ? <Flatbow u={u} wood={woodOf(wood, "frassino")} tint={riser} /> : null}
      {kind === "ricurvo" ? <TradRecurve u={u} wood={woodOf(wood, "bubinga")} glass={limbs || "#15191d"} tint={riser} /> : null}
      {kind === "olimpico" || kind === "nudo" ? <Olympic u={u} riser={riser || (kind === "nudo" ? "#1d2126" : "#2f6fbe")} limbs={limbs || "#15191d"} bare={kind === "nudo"} /> : null}
      {kind === "compound" ? <Compound u={u} riser={riser || "#23272c"} limbs={limbs && limbs !== riser ? limbs : "#4b535c"} /> : null}
      {kind === "storico" || kind === "asiatico" ? <HorseBow u={u} long={kind === "asiatico"} grip={riser || (kind === "asiatico" ? "#2f5d3a" : "#7a1f1a")} belly={limbs || "#1c1410"} /> : null}
    </svg>
  );
}

/** corda: filo chiaro, rinforzo scuro al centro e il punto d'incocco in ottone */
function BowString({ u, top, bottom, x, serving = "#1d1f22", nock = 112 }: { u: string; top: P; bottom: P; x: number; serving?: string; nock?: number }) {
  return (
    <g>
      <path d={`M${top[0]} ${top[1]} L${x} ${top[1] + 18} L${x} ${bottom[1] - 18} L${bottom[0]} ${bottom[1]}`} fill="none" stroke="#efe9da" strokeWidth="0.9" strokeLinejoin="round" />
      <path d={`M${x} ${top[1] + 18} L${x} ${bottom[1] - 18}`} stroke="#9c9381" strokeWidth="0.3" strokeDasharray="0.6 0.9" />
      <rect x={x - 0.75} y={nock - 14} width="1.5" height="34" rx="0.6" fill={serving} />
      <path d={`M${x - 0.75} ${nock - 13} v32`} stroke="#fff" strokeOpacity="0.18" strokeWidth="0.35" />
      <rect x={x - 1.3} y={nock - 1.6} width="2.6" height="1.5" rx="0.6" fill={`url(#${u}-brass)`} />
      <rect x={x - 1.3} y={nock + 2.6} width="2.6" height="1.2" rx="0.5" fill={`url(#${u}-brass)`} />
    </g>
  );
}

/** venature: linee sottili che seguono il flettente, qualcuna più scura */
function Grain({ c, w, color, seed, t0 = 0.03, t1 = 0.97, n = 9, a = 0.08, b = 0.92 }: { c: (t: number) => P; w: (t: number) => number; color: string; seed: number; t0?: number; t1?: number; n?: number; a?: number; b?: number }) {
  const r = rng(seed);
  const lines = Array.from({ length: n }, (_, i) => {
    const f = a + ((b - a) * (i + 0.5)) / n + (r() - 0.5) * 0.05;
    const s0 = t0 + r() * 0.12;
    const s1 = t1 - r() * 0.12;
    return { d: line(c, w, f, s0, s1, 40, 0.035, 1 + r() * 2), o: 0.18 + r() * 0.3, sw: 0.22 + r() * 0.3 };
  });
  return (
    <g>
      {lines.map((l, i) => (
        <path key={i} d={l.d} fill="none" stroke={color} strokeOpacity={l.o} strokeWidth={l.sw} strokeLinecap="round" />
      ))}
    </g>
  );
}

/* --------------------------- longbow: arco a D, lamelle, puntali in corno --------------------------- */

function Longbow({ u, wood, tint }: { u: string; wood: Wood; tint: string }) {
  const top: Seg[] = [[[58, 8], [62, 42], [77, 78], [78, 120]]];
  const segs = [...top, ...mirror(top, 120)];
  const c = along(segs);
  // spesso all'impugnatura (sezione a D), sottile ai puntali
  const w = (t: number) => 2.6 + 6.2 * Math.pow(Math.sin(Math.PI * t), 1.35);
  const back = tint ? shadeHex(tint, 0.35) : wood.back;
  const core = tint || wood.core;
  const belly = tint ? shadeHex(tint, -0.3) : wood.belly;
  const lam = wood.id === "bambu" || wood.id === "laminato";
  return (
    <g>
      <BowString u={u} top={[57.2, 11]} bottom={[57.2, 229]} x={57.2} />
      {/* il legno: dorso chiaro (alburno o bambù), anima, ventre */}
      <path d={band(c, w, 0, 1)} fill={belly} />
      <path d={band(c, w, 0, lam ? 0.2 : 0.3)} fill={back} />
      {lam ? <path d={band(c, w, 0.2, 0.32)} fill={core} /> : <path d={band(c, w, 0.3, 0.42)} fill={core} opacity="0.55" />}
      <Grain c={c} w={w} color={wood.grain} seed={wood.id.length * 7 + 3} />
      {/* nodi del tasso */}
      {wood.id === "tasso" ? (
        <g fill={wood.grain} opacity="0.55">
          <ellipse cx="71.8" cy="62" rx="0.9" ry="1.6" />
          <ellipse cx="74.2" cy="166" rx="0.8" ry="1.4" />
        </g>
      ) : null}
      <path d={band(c, w, 0, 1)} fill={`url(#${u}-gloss)`} />
      <path d={line(c, w, 0.08, 0.04, 0.96)} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.45" />
      {/* passaggio della freccia in madreperla e impugnatura in cuoio cucita */}
      <path d={band(c, (t) => w(t) + 0.8, -0.05, 1.05, 0.455, 0.565)} fill={`url(#${u}-leather)`} />
      <path d={line(c, (t) => w(t) + 0.8, 0.88, 0.46, 0.56, 16)} fill="none" stroke="#e7c48a" strokeOpacity="0.8" strokeWidth="0.35" strokeDasharray="0.9 0.8" />
      <path d={line(c, (t) => w(t) + 0.8, 0.12, 0.46, 0.56, 16)} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.3" />
      <path d={band(c, w, 0.55, 1.02, 0.43, 0.452)} fill="#efe8dc" />
      <path d={band(c, w, 0.55, 1.02, 0.43, 0.452)} fill={`url(#${u}-gloss)`} />
      {/* puntali in corno con la gola per la corda */}
      <HornTip c={c} w={w} t0={0} t1={0.045} />
      <HornTip c={c} w={w} t0={0.955} t1={1} />
    </g>
  );
}

function HornTip({ c, w, t0, t1 }: { c: (t: number) => P; w: (t: number) => number; t0: number; t1: number }) {
  const ww = (t: number) => w(t) + 0.9;
  const mid = (t0 + t1) / 2;
  return (
    <g>
      <path d={band(c, ww, -0.05, 1.05, t0, t1, 12)} fill="#e9dcc0" />
      <path d={band(c, ww, 0.55, 1.05, t0, t1, 12)} fill="#3a2a1e" opacity="0.55" />
      <path d={band(c, ww, -0.05, 1.05, mid - 0.004, mid + 0.004, 4)} fill="#2a1d12" opacity="0.8" />
    </g>
  );
}

/* -------------------------------------- flatbow -------------------------------------- */

function Flatbow({ u, wood, tint }: { u: string; wood: Wood; tint: string }) {
  const top: Seg[] = [[[60, 10], [66, 50], [74, 92], [75, 120]]];
  const segs = [...top, ...mirror(top, 120)];
  const c = along(segs);
  // di fianco il flatbow è sottile; all'impugnatura c'è un rialzo incollato
  const w = (t: number) => 2.4 + 2.2 * Math.sin(Math.PI * t) + 5.5 * Math.exp(-Math.pow((t - 0.5) / 0.06, 2));
  const base = tint || wood.core;
  return (
    <g>
      <BowString u={u} top={[59.2, 12]} bottom={[59.2, 228]} x={59.2} />
      <path d={band(c, w, 0, 1)} fill={tint ? shadeHex(tint, -0.25) : wood.belly} />
      <path d={band(c, w, 0, 0.45)} fill={base} />
      <path d={band(c, w, 0, 0.14)} fill="#1a1512" opacity="0.85" />
      <Grain c={c} w={w} color={wood.grain} seed={41} n={6} />
      <path d={band(c, w, 0, 1)} fill={`url(#${u}-gloss)`} />
      <path d={band(c, (t) => w(t) + 0.5, -0.03, 1.03, 0.45, 0.57)} fill={`url(#${u}-leather)`} />
      <path d={line(c, (t) => w(t) + 0.5, 0.9, 0.455, 0.565, 14)} fill="none" stroke="#e7c48a" strokeOpacity="0.7" strokeWidth="0.32" strokeDasharray="0.8 0.8" />
      <path d={band(c, (t) => w(t) + 0.4, -0.04, 1.04, 0, 0.03, 8)} fill="#1a1512" />
      <path d={band(c, (t) => w(t) + 0.4, -0.04, 1.04, 0.97, 1, 8)} fill="#1a1512" />
    </g>
  );
}

/* ----------------------- ricurvo tradizionale: riser in legni, flettenti in fibra ----------------------- */

function TradRecurve({ u, wood, glass, tint }: { u: string; wood: Wood; glass: string; tint: string }) {
  // flettente superiore: punta che si arriccia verso il bersaglio, poi giù fino al riser
  const top: Seg[] = [
    [[72, 9], [70, 15], [64, 19], [63.5, 30]],
    [[63.5, 30], [63.5, 48], [71, 62], [76, 80]],
  ];
  const limbT = along(top);
  const limbB = along(mirror(top, 120));
  const lw = (t: number) => 2.1 + 2.2 * t;
  const lwB = (t: number) => 2.1 + 2.2 * (1 - t);
  const glassC = glass;
  const core = shadeHex(wood.back, 0.1);
  const riserA = tint || wood.core;
  const riserB = tint ? shadeHex(tint, -0.35) : wood.belly;
  const limb = (c: (t: number) => P, w: (t: number) => number) => (
    <g>
      <path d={band(c, w, 0, 1)} fill={glassC} />
      <path d={band(c, w, 0.2, 0.8)} fill={core} />
      <path d={line(c, w, 0.5, 0.05, 0.95)} fill="none" stroke={wood.grain} strokeOpacity="0.3" strokeWidth="0.25" />
      <path d={band(c, w, 0, 1)} fill={`url(#${u}-gloss)`} />
      <path d={line(c, w, 0.04, 0.02, 0.98)} fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="0.35" />
    </g>
  );
  // il riser: dorso quasi dritto, finestra con il ripiano della freccia, impugnatura che sporge verso la corda
  const riserPath = "M74 80 C77 79 80 79 82 82 C85 96 86 108 86 120 C86 132 85 144 82 158 C80 161 77 161 74 160 C73 152 72 146 73 140 C70 136 68 130 68.5 124 C69 120 71 117 75.5 116.5 L75.5 112 C72 110 72.5 104 74 98 C74.6 92 74.4 86 74 80 Z";
  return (
    <g>
      <BowString u={u} top={[72, 10]} bottom={[72, 230]} x={63} />
      {limb(limbT, lw)}
      {limb(limbB, lwB)}
      {/* puntali in fenolico bianco con filetto nero */}
      <path d={band(limbT, (t) => lw(t) + 0.5, -0.06, 1.06, 0, 0.12, 10)} fill="#f2efe8" />
      <path d={band(limbT, (t) => lw(t) + 0.5, -0.06, 1.06, 0.12, 0.135, 4)} fill="#14181c" />
      <path d={band(limbB, (t) => lwB(t) + 0.5, -0.06, 1.06, 0.88, 1, 10)} fill="#f2efe8" />
      <path d={band(limbB, (t) => lwB(t) + 0.5, -0.06, 1.06, 0.865, 0.88, 4)} fill="#14181c" />
      <clipPath id={`${u}-riser`}>
        <path d={riserPath} />
      </clipPath>
      <path d={riserPath} fill={riserA} />
      {/* lamelle del riser: legni diversi incollati, come i ricurvi fatti a mano */}
      <g clipPath={`url(#${u}-riser)`}>
        <path d="M79.4 70 C81.4 100 81.4 140 79.4 170 L80.6 170 C82.6 140 82.6 100 80.6 70 Z" fill={tint ? shadeHex(tint, 0.45) : "#efe2c2"} opacity="0.85" />
        <path d="M81.4 70 C83.5 100 83.5 140 81.4 170 L82.4 170 C84.5 140 84.5 100 82.4 70 Z" fill="#14100c" opacity="0.75" />
        <path d="M66 70 C70 100 70 140 66 170 L76 170 C78 140 78 100 76 70 Z" fill={riserB} opacity="0.65" />
        <Grain c={along([[[79, 80], [79, 110], [79, 130], [79, 160]]])} w={() => 14} color={wood.grain} seed={73} t0={0} t1={1} n={7} />
        <rect x="60" y="70" width="40" height="100" fill={`url(#${u}-gloss)`} />
      </g>
      <path d={riserPath} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.4" />
      {/* ripiano con il feltro e l'impugnatura in cuoio */}
      <rect x="73.6" y="110.6" width="2.6" height="1.6" rx="0.4" fill="#3a2a1e" />
      <path d="M69.2 120 C69.6 117.6 72 117 75.6 117 L75.6 136 C72 136 69.4 132 69.2 128 Z" fill={`url(#${u}-leather)`} opacity="0.92" />
      <path d="M70.4 119.5 L70 130" stroke="#e7c48a" strokeOpacity="0.7" strokeWidth="0.3" strokeDasharray="0.8 0.8" />
    </g>
  );
}

/* --------------------- olimpico e arco nudo: riser in alluminio, flettenti in carbonio --------------------- */

function Olympic({ u, riser, limbs, bare }: { u: string; riser: string; limbs: string; bare: boolean }) {
  const top: Seg[] = [
    [[73, 9], [70.5, 15], [64.5, 19], [64, 31]],
    [[64, 31], [64, 50], [72, 64], [77, 76]],
  ];
  const limbT = along(top);
  const limbB = along(mirror(top, 120));
  const lw = (t: number) => 2 + 2.6 * t;
  const lwB = (t: number) => 2 + 2.6 * (1 - t);
  const limb = (c: (t: number) => P, w: (t: number) => number, flip: boolean) => (
    <g>
      <path d={band(c, w, 0, 1)} fill={limbs} />
      <path d={band(c, w, 0, 1)} fill={`url(#${u}-weave)`} />
      {/* fascia colorata del modello e la scritta */}
      <path d={band(c, w, 0.25, 0.75, flip ? 0.12 : 0.62, flip ? 0.38 : 0.88, 14)} fill={shadeHex(riser, 0.25)} opacity="0.85" />
      <path d={band(c, w, 0, 1)} fill={`url(#${u}-gloss)`} />
      <path d={line(c, w, 0.05, 0.03, 0.97)} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.35" />
    </g>
  );
  const riserPath = "M73 74 C76 72 82 72 85 76 C88 92 89 106 89 120 C89 134 88 148 85 164 C82 168 76 168 73 166 C72 158 71.5 150 72 144 C68.6 140 66.5 133 67 126 C67.5 121 70 118.5 74 118 L74 113.6 C71.5 112 71.6 106 73 101 C73.6 92 73.5 82 73 74 Z";
  const sh = shadeHex(riser, -0.45);
  const hi = shadeHex(riser, 0.45);
  return (
    <g>
      <BowString u={u} top={[73, 10]} bottom={[73, 230]} x={64} />
      {limb(limbT, lw, false)}
      {limb(limbB, lwB, true)}
      {/* tasche dei flettenti e viti di regolazione */}
      <rect x="72.6" y="70" width="12.6" height="6.4" rx="2" fill="#24282d" />
      <rect x="72.6" y="163.6" width="12.6" height="6.4" rx="2" fill="#24282d" />
      <circle cx="82.2" cy="73.2" r="1.3" fill={`url(#${u}-metal)`} />
      <circle cx="82.2" cy="166.8" r="1.3" fill={`url(#${u}-metal)`} />
      <linearGradient id={`${u}-ano`} x1="0" x2="1">
        <stop offset="0" stopColor={hi} />
        <stop offset="0.35" stopColor={riser} />
        <stop offset="0.8" stopColor={sh} />
        <stop offset="1" stopColor={shadeHex(riser, -0.65)} />
      </linearGradient>
      <path d={riserPath} fill={`url(#${u}-ano)`} />
      {/* finestre fresate nell'alluminio */}
      <path d="M78 82 C80 81 83 82 84 86 L84.6 99 C83 101 80 101 78.6 99.4 Z" fill="#0d1013" opacity="0.85" />
      <path d="M78.6 140.6 C80 139 83 139 84.6 141 L84 154 C83 158 80 159 78 158 Z" fill="#0d1013" opacity="0.85" />
      <path d="M78 82 C80 81 83 82 84 86" fill="none" stroke={hi} strokeOpacity="0.8" strokeWidth="0.45" />
      <path d="M78.6 140.6 C80 139 83 139 84.6 141" fill="none" stroke={hi} strokeOpacity="0.8" strokeWidth="0.45" />
      <path d={riserPath} fill="none" stroke="#000" strokeOpacity="0.4" strokeWidth="0.4" />
      <path d="M86.4 80 C88.4 96 88.8 140 86.4 160" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.5" />
      {/* impugnatura in legno */}
      <path d="M67.6 125.6 C68 121 70.6 118.8 74.4 118.6 L75.6 140 C71.6 140 68 135 67.6 129 Z" fill="#6b4428" />
      <path d="M68.4 124 C69.2 121.4 71.4 120 74 119.8" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.5" />
      {/* rest, bottone ammortizzato e freccia appoggiata */}
      <path d="M74 112.6 L70 112.2" stroke="#c9ced3" strokeWidth="0.6" />
      <rect x="85" y="110.4" width="5" height="2.6" rx="1" fill={`url(#${u}-metal)`} />
      {bare ? (
        <>
          {/* arco nudo: peso sotto il riser */}
          <rect x="85.4" y="150" width="7" height="9" rx="1.6" fill={`url(#${u}-metal)`} />
          <rect x="85.4" y="150" width="7" height="9" rx="1.6" fill="none" stroke="#2a2f35" strokeWidth="0.4" />
        </>
      ) : (
        <>
          {/* clicker */}
          <path d="M87.6 100 L80 111.5" stroke="#d8dde2" strokeWidth="0.55" />
          {/* mirino: barra, blocchetto, diottra */}
          <rect x="85" y="88" width="5" height="4" rx="1" fill="#24282d" />
          <path d="M90 89.6 L110 84" stroke="#2a2f35" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M90 89 L110 83.4" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.5" />
          <rect x="106.6" y="76" width="6" height="12" rx="1.4" fill="#2a2f35" />
          <circle cx="109.6" cy="74.4" r="3" fill="none" stroke={`url(#${u}-metal)`} strokeWidth="1.1" />
          <circle cx="109.6" cy="74.4" r="0.8" fill="#f5c542" />
          {/* stabilizzatore lungo, V-bar e pesi */}
          <rect x="85.4" y="146.6" width="5" height="4.4" rx="1.2" fill="#24282d" />
          <path d="M90 148.8 L118 150.6" stroke="#15181c" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M90 148.2 L118 150" stroke="#fff" strokeOpacity="0.22" strokeWidth="0.5" />
          <rect x="113.6" y="147.4" width="5.6" height="6.4" rx="1.2" fill={`url(#${u}-metal)`} />
          <path d="M89 150 L82 166" stroke="#15181c" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="79.4" y="164.6" width="4.4" height="4.8" rx="1" fill={`url(#${u}-metal)`} />
        </>
      )}
    </g>
  );
}

/* --------------------------- compound: riser lungo, flettenti corti, camme, cavi --------------------------- */

function Compound({ u, riser, limbs }: { u: string; riser: string; limbs: string }) {
  const sh = shadeHex(riser, -0.45);
  const hi = shadeHex(riser, 0.5);
  const riserPath = "M76 40 C80 36 86 36 88 42 C92 70 93 100 92 120 C93 140 92 170 88 198 C86 204 80 204 76 200 C75 182 74 160 75 146 C71 142 69 136 69.4 128 C70 122 72 119 76.4 118.4 L76.4 113 C74 110 74.6 100 75.6 92 C76.4 74 76.4 56 76 40 Z";
  const limb = (y: number, dir: 1 | -1) => (
    <g>
      {/* flettenti divisi, quasi paralleli */}
      <path d={`M82 ${y} C74 ${y - dir * 4} 64 ${y - dir * 10} 57 ${y - dir * 15} L55 ${y - dir * 11} C62 ${y - dir * 6} 72 ${y + dir * 0.4} 80 ${y + dir * 4.4} Z`} fill={limbs} />
      <path d={`M82 ${y} C74 ${y - dir * 4} 64 ${y - dir * 10} 57 ${y - dir * 15} L55 ${y - dir * 11} C62 ${y - dir * 6} 72 ${y + dir * 0.4} 80 ${y + dir * 4.4} Z`} fill={`url(#${u}-gloss)`} />
      <path d={`M81 ${y + dir * 0.6} C73 ${y - dir * 3.4} 63 ${y - dir * 9.6} 56.6 ${y - dir * 14}`} fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="0.45" />
      <path d={`M80 ${y + dir * 2.2} L70 ${y - dir * 3}`} stroke="#000" strokeOpacity="0.45" strokeWidth="0.5" />
    </g>
  );
  const cam = (cx: number, cy: number) => (
    <g>
      <ellipse cx={cx} cy={cy} rx="7.4" ry="6" fill={`url(#${u}-metal)`} />
      <ellipse cx={cx} cy={cy} rx="7.4" ry="6" fill="none" stroke="#2a2f35" strokeWidth="0.6" />
      <ellipse cx={cx - 0.8} cy={cy} rx="4.6" ry="3.7" fill="#2a2f35" />
      <path d={`M${cx - 6} ${cy - 2} C${cx - 3} ${cy - 5} ${cx + 3} ${cy - 5} ${cx + 6} ${cy - 1}`} fill="none" stroke="#9aa3ad" strokeWidth="0.6" />
      <circle cx={cx} cy={cy} r="1.6" fill={`url(#${u}-metal)`} />
      <circle cx={cx} cy={cy} r="0.6" fill="#14181c" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={a} cx={cx - 0.8 + Math.cos((a * Math.PI) / 180) * 3.1} cy={cy + Math.sin((a * Math.PI) / 180) * 2.4} r="0.55" fill="#14181c" />
      ))}
    </g>
  );
  return (
    <g>
      {/* corda e cavi */}
      <path d="M48.6 26 L48.6 214" stroke="#efe9da" strokeWidth="1" />
      <rect x="47.8" y="104" width="1.6" height="30" rx="0.6" fill="#1d1f22" />
      <circle cx="48.6" cy="96" r="1.6" fill="#14181c" stroke="#9aa3ad" strokeWidth="0.4" />
      <path d="M56 32 L66 118 L60 210 M60 30 L66 120 L56 208" fill="none" stroke="#cfc8b8" strokeWidth="0.6" />
      <path d="M66 112 L66 128" stroke="#2a2f35" strokeWidth="1.2" />
      <path d="M66 120 L76 120" stroke={`url(#${u}-metal)`} strokeWidth="1.6" />
      {limb(46, 1)}
      {limb(194, -1)}
      {cam(56, 30)}
      {cam(56, 210)}
      <linearGradient id={`${u}-cano`} x1="0" x2="1">
        <stop offset="0" stopColor={hi} />
        <stop offset="0.4" stopColor={riser} />
        <stop offset="1" stopColor={shadeHex(riser, -0.6)} />
      </linearGradient>
      <path d={riserPath} fill={`url(#${u}-cano)`} />
      {/* finestre e nervature */}
      <path d="M80 50 C83 48 86 52 86.4 58 L87 92 C85 95 81 94 80 90 Z" fill="#0d1013" opacity="0.8" />
      <path d="M80 150 C81 146 85 145 87 148 L86.4 184 C86 190 83 192 80 190 Z" fill="#0d1013" opacity="0.8" />
      <path d={riserPath} fill="none" stroke="#000" strokeOpacity="0.4" strokeWidth="0.4" />
      <path d="M89.4 50 C91.6 80 91.8 160 89.4 192" fill="none" stroke={sh} strokeOpacity="0.6" strokeWidth="0.6" />
      <path d="M78 44 C78.6 80 78.6 150 78 196" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.5" />
      {/* impugnatura, rest a caduta, mirino con lente, stabilizzatore */}
      <path d="M69.8 127 C70.4 122 72.8 119.6 76.6 119.4 L77.6 142 C73.4 142 70.2 137 69.8 131 Z" fill="#15181c" />
      <path d="M92 110 L98 108 L98 112 Z" fill="#2a2f35" />
      <path d="M91.6 84 L106 80" stroke="#2a2f35" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="109" cy="80" r="5" fill="#15181c" />
      <circle cx="109" cy="80" r="3.6" fill="#3f6f8f" opacity="0.6" />
      <circle cx="109" cy="80" r="0.9" fill="#7ef56a" />
      <path d="M106.4 77.6 a3.4 3.4 0 0 1 3.6 -1.2" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.5" fill="none" />
      <path d="M92 156 L118 158" stroke="#15181c" strokeWidth="3" strokeLinecap="round" />
      <rect x="114" y="154.4" width="5.4" height="7.4" rx="1.2" fill={`url(#${u}-metal)`} />
    </g>
  );
}

/* ------------------ archi a cavallo in corno: turco (corto) e mongolo/mancese (orecchie lunghe) ------------------ */

function HorseBow({ u, long, grip, belly }: { u: string; long: boolean; grip: string; belly: string }) {
  // flettente che lavora, poi il ginocchio e l'orecchia rigida (siyah) che punta in avanti
  const top: Seg[] = long
    ? [
        [[90, 8], [86, 20], [78, 32], [70, 45]],
        [[70, 45], [62, 62], [74, 94], [80, 120]],
      ]
    : [
        [[88, 22], [85, 31], [79, 40], [73, 49]],
        [[73, 49], [64, 63], [74, 96], [80, 120]],
      ];
  const c = along([...top, ...mirror(top, 120)]);
  const w = (t: number) => {
    const d = Math.abs(t - 0.5) * 2;
    return 2.6 + 3.6 * (1 - d) + (d > (long ? 0.62 : 0.66) ? 0.9 : 0);
  };
  const siyah = long ? 0.25 : 0.2;
  const tipT: P = long ? [90, 8] : [88, 22];
  const tipB: P = long ? [90, 232] : [88, 218];
  const kneeX = long ? 69 : 72;
  return (
    <g>
      {/* corda: dalla punta al ponticello del ginocchio, poi dritta */}
      <path d={`M${tipT[0]} ${tipT[1]} L${kneeX - 1.5} ${long ? 47 : 53} L${kneeX - 1.5} ${long ? 193 : 187} L${tipB[0]} ${tipB[1]}`} fill="none" stroke="#efe9da" strokeWidth="0.9" strokeLinejoin="round" />
      <rect x={kneeX - 2.2} y="103" width="1.4" height="32" rx="0.6" fill="#5a1e14" />
      {/* ventre in corno scuro, dorso in corteccia o cuoio dipinto */}
      <path d={band(c, w, 0, 1)} fill={belly} />
      <path d={band(c, w, 0.5, 1, siyah, 1 - siyah)} fill={shadeHex(belly, 0.25)} opacity="0.6" />
      <path d={band(c, w, 0, 0.48, siyah, 1 - siyah)} fill={long ? "#e8dcc0" : "#7a1f1a"} />
      {/* decorazioni del dorso: macchie della betulla o fregi d'oro */}
      {long ? (
        <g>
          {[0.3, 0.36, 0.41, 0.59, 0.64, 0.7].map((t) => (
            <path key={t} d={band(c, w, 0.08, 0.38, t, t + 0.008, 3)} fill="#3a2a1e" opacity="0.75" />
          ))}
        </g>
      ) : (
        <g>
          {[0.27, 0.33, 0.39, 0.61, 0.67, 0.73].map((t) => (
            <path key={t} d={band(c, w, 0.06, 0.42, t, t + 0.02, 4)} fill="#e6b325" opacity="0.85" />
          ))}
          <path d={line(c, w, 0.24, siyah + 0.02, 1 - siyah - 0.02)} fill="none" stroke="#e6b325" strokeWidth="0.35" strokeDasharray="1.2 1" />
        </g>
      )}
      {/* orecchie rigide in legno chiaro con la punta in osso */}
      <path d={band(c, w, 0, 1, 0, siyah, 16)} fill="#c9a46a" />
      <path d={band(c, w, 0, 1, 1 - siyah, 1, 16)} fill="#c9a46a" />
      <path d={band(c, (t) => w(t) + 0.6, -0.05, 1.05, 0, 0.04, 6)} fill="#f2ead8" />
      <path d={band(c, (t) => w(t) + 0.6, -0.05, 1.05, 0.96, 1, 6)} fill="#f2ead8" />
      {/* ponticelli per la corda al ginocchio */}
      <path d={band(c, (t) => w(t) + 1.6, 0.55, 1.15, siyah - 0.012, siyah + 0.004, 4)} fill="#f2ead8" />
      <path d={band(c, (t) => w(t) + 1.6, 0.55, 1.15, 1 - siyah - 0.004, 1 - siyah + 0.012, 4)} fill="#f2ead8" />
      <path d={band(c, w, 0, 1)} fill={`url(#${u}-gloss)`} />
      {/* impugnatura in cuoio con legature d'oro */}
      <path d={band(c, (t) => w(t) + 1.2, -0.08, 1.08, 0.44, 0.56)} fill={grip} />
      <path d={band(c, (t) => w(t) + 1.2, -0.08, 1.08, 0.44, 0.56)} fill={`url(#${u}-gloss)`} />
      {[0.445, 0.555].map((t) => (
        <path key={t} d={band(c, (tt) => w(tt) + 1.4, -0.1, 1.1, t - 0.006, t + 0.006, 3)} fill="#e6b325" />
      ))}
    </g>
  );
}
