
/**
 * Dettagli che danno volume e materia all'arciere senza cambiarne la sagoma: ombre morbide e luci sulla
 * stoffa, pieghe, cuciture, trama del tessuto, venatura del cuoio; sul viso ombre e luci del volto,
 * orecchio, occhio con l'iride sfumata, sopracciglia a peli, labbra; ciocche nei capelli e nella barba.
 * Tutto è disegnato sopra le forme che già ci sono, con trasparenze: i colori scelti restano quelli.
 */

type P = { x: number; y: number };
const f = (n: number) => n.toFixed(1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const at = (a: P, b: P, t: number): P => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
/** direzione e normale di un segmento */
const dirN = (a: P, b: P) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { ux: dx / l, uy: dy / l, nx: -dy / l, ny: dx / l, len: l };
};

/** colore delle cuciture: più chiaro su una stoffa scura, più scuro su una chiara */
export function seamOf(hex: string) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return "#000";
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l < 0.45 ? "#d8d2c4" : "#3a2a1a";
}

/** Gradienti e trame condivisi: vanno messi una volta sola nei <defs> della figura. */
export function DetailDefs({ uid }: { uid: string }) {
  return (
    <>
      <radialGradient id={`${uid}sd`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#000" stopOpacity="0.55" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}sl`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${uid}lsh`} x1="0" x2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.32" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${uid}rli`} x1="0" x2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#fff" stopOpacity="0.16" />
      </linearGradient>
      {/* trama del tessuto (lana spigata): diagonali fitte, ombra e lume alternati, ben leggibili ma fini */}
      <pattern id={`${uid}weave`} width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <path d="M0 0.55 H2.2" stroke="#000" strokeOpacity="0.13" strokeWidth="0.45" />
        <path d="M0 1.65 H2.2" stroke="#fff" strokeOpacity="0.06" strokeWidth="0.35" />
      </pattern>
      {/* lino delle camicie e delle maniche: ordito e trama sottili */}
      <pattern id={`${uid}linen`} width="1.6" height="1.6" patternUnits="userSpaceOnUse">
        <path d="M0 0.4 H1.6" stroke="#000" strokeOpacity="0.07" strokeWidth="0.3" />
        <path d="M0.4 0 V1.6" stroke="#000" strokeOpacity="0.05" strokeWidth="0.28" />
        <path d="M0 1.2 H1.6" stroke="#fff" strokeOpacity="0.06" strokeWidth="0.25" />
      </pattern>
      {/* grana del cuoio: pori e piccoli graffi */}
      <pattern id={`${uid}grain`} width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1.2" r="0.38" fill="#000" fillOpacity="0.26" />
        <circle cx="3.4" cy="2.6" r="0.32" fill="#000" fillOpacity="0.22" />
        <circle cx="2" cy="4.1" r="0.3" fill="#fff" fillOpacity="0.14" />
        <circle cx="4.4" cy="0.6" r="0.26" fill="#fff" fillOpacity="0.12" />
        <path d="M0.4 3.2 l1.2 -0.5" stroke="#000" strokeOpacity="0.16" strokeWidth="0.25" />
      </pattern>
    </>
  );
}

/** Volume, pieghe, cuciture e trama di busto e veste. */
export function ClothDetail({ uid, shapes, cx, shoulderL, shoulderR, hipL, hipR, tunicLen, longTunic, seam }: { uid: string; shapes: string[]; cx: number; shoulderL: number; shoulderR: number; hipL: number; hipR: number; tunicLen: number; longTunic: boolean; seam: string }) {
  const bottom = longTunic ? tunicLen + 6 : 212;
  const folds = longTunic
    ? [-0.82, -0.5, -0.18, 0.16, 0.48, 0.8].map((k, i) => {
        const x1 = cx + k * (hipR - hipL) * 0.5;
        const x2 = cx + k * (hipR - hipL) * 0.5 * 1.45 + (i % 2 ? 2 : -1);
        const y1 = 214 + (i % 3) * 3;
        return { x1, x2, y1 };
      })
    : [];
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id={`${uid}cl`}>
          {shapes.map((d, i) => <path key={i} d={d} />)}
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}cl)`}>
        <rect x={f(shoulderL - 30)} y="108" width={f(shoulderR - shoulderL + 60)} height={f(bottom - 100)} fill={`url(#${uid}weave)`} />
        {/* ombra sul fianco lontano e luce di taglio su quello vicino */}
        <rect x={f(shoulderL - 14)} y="110" width="22" height={f(bottom - 104)} fill={`url(#${uid}lsh)`} />
        <rect x={f(shoulderR - 12)} y="110" width="16" height={f(bottom - 104)} fill={`url(#${uid}rli)`} />
        {/* petto: luce in alto, ombra sotto; ascelle in ombra */}
        <ellipse cx={f(cx + 8)} cy="138" rx="20" ry="12" fill={`url(#${uid}sl)`} opacity="0.32" />
        <ellipse cx={f(cx + 4)} cy="162" rx="24" ry="6" fill={`url(#${uid}sd)`} opacity="0.4" />
        <ellipse cx={f(shoulderL + 6)} cy="134" rx="8" ry="12" fill={`url(#${uid}sd)`} opacity="0.55" />
        <ellipse cx={f(shoulderR - 5)} cy="134" rx="6" ry="10" fill={`url(#${uid}sd)`} opacity="0.35" />
        {/* pieghe che tirano verso la cintura */}
        <g fill="none" strokeLinecap="round">
          {[[-14, 176, -6, 194], [-4, 180, -1, 195], [10, 178, 6, 194], [18, 174, 12, 192]].map(([a, y1, b, y2], i) => (
            <g key={i}>
              <path d={`M${f(cx + a)} ${y1} Q${f(cx + (a + b) / 2 + 2)} ${(y1 + y2) / 2} ${f(cx + b)} ${y2}`} stroke="#000" strokeOpacity="0.2" strokeWidth="1.3" />
              <path d={`M${f(cx + a + 1.4)} ${y1 + 1} Q${f(cx + (a + b) / 2 + 3.4)} ${(y1 + y2) / 2 + 1} ${f(cx + b + 1.4)} ${y2}`} stroke="#fff" strokeOpacity="0.08" strokeWidth="0.9" />
            </g>
          ))}
          {/* pieghe della veste sotto la cintura, larghe verso l'orlo */}
          {folds.map(({ x1, x2, y1 }, i) => (
            <g key={`fo${i}`}>
              <path d={`M${f(x1)} ${y1} Q${f((x1 + x2) / 2 + 2)} ${f((y1 + tunicLen) / 2)} ${f(x2)} ${tunicLen + 2}`} stroke="#000" strokeOpacity="0.22" strokeWidth="2.2" />
              <path d={`M${f(x1 + 2.2)} ${y1 + 2} Q${f((x1 + x2) / 2 + 4.2)} ${f((y1 + tunicLen) / 2)} ${f(x2 + 2.6)} ${tunicLen + 2}`} stroke="#fff" strokeOpacity="0.1" strokeWidth="1.4" />
            </g>
          ))}
          {longTunic ? <rect x={f(hipL - 20)} y={tunicLen - 6} width={f(hipR - hipL + 40)} height="12" fill="#000" opacity="0.14" /> : null}
          {/* cuciture laterali */}
          <path d={`M${f(shoulderR - 3)} 130 C${f(shoulderR - 2)} 152 ${f(hipR - 2)} 174 ${f(hipR - 2)} 198`} stroke={seam} strokeOpacity="0.45" strokeWidth="0.55" strokeDasharray="1.4 1.2" />
          <path d={`M${f(shoulderL + 3)} 130 C${f(shoulderL + 2)} 152 ${f(hipL + 2)} 174 ${f(hipL + 2)} 198`} stroke={seam} strokeOpacity="0.3" strokeWidth="0.55" strokeDasharray="1.4 1.2" />
          <path d={`M${f(shoulderL + 4)} 124 C${f(shoulderL + 10)} 119 ${f(shoulderR - 10)} 119 ${f(shoulderR - 4)} 124`} stroke={seam} strokeOpacity="0.35" strokeWidth="0.55" strokeDasharray="1.4 1.2" />
        </g>
      </g>
    </g>
  );
}

/** Manica: luce, ombra opposta, pieghe al gomito, cucitura alla spalla e al polsino. */
export function SleeveDetail({ s, e, h, w, color, long }: { s: P; e: P; h: P; w: number; color: string; long: boolean }) {
  const up = dirN(s, e);
  const fo = dirN(e, h);
  const crease = (c: P, d: ReturnType<typeof dirN>, k: number, i: number) => {
    const half = w * 0.42;
    const a = { x: c.x + d.nx * half, y: c.y + d.ny * half };
    const b = { x: c.x - d.nx * half * 0.4, y: c.y - d.ny * half * 0.4 };
    const ctrl = { x: (a.x + b.x) / 2 + d.ux * k, y: (a.y + b.y) / 2 + d.uy * k };
    return <path key={i} d={`M${f(a.x)} ${f(a.y)} Q${f(ctrl.x)} ${f(ctrl.y)} ${f(b.x)} ${f(b.y)}`} />;
  };
  return (
    <g pointerEvents="none" fill="none" strokeLinecap="round">
      {/* ombra sul lato opposto alla luce */}
      <line x1={f(s.x + up.nx * w * 0.26)} y1={f(s.y + up.ny * w * 0.26)} x2={f(e.x + up.nx * w * 0.26)} y2={f(e.y + up.ny * w * 0.26)} stroke="#000" strokeOpacity="0.16" strokeWidth={f(w * 0.36)} />
      {long ? <line x1={f(e.x + fo.nx * w * 0.2)} y1={f(e.y + fo.ny * w * 0.2)} x2={f(at(e, h, 0.82).x + fo.nx * w * 0.2)} y2={f(at(e, h, 0.82).y + fo.ny * w * 0.2)} stroke="#000" strokeOpacity="0.14" strokeWidth={f(w * 0.28)} /> : null}
      {/* pieghe al gomito */}
      <g stroke="#000" strokeOpacity="0.26" strokeWidth="1">
        {[0.78, 0.88].map((k, i) => crease(at(s, e, k), up, 2.4, i))}
        {long ? [0.1, 0.2].map((k, i) => crease(at(e, h, k), fo, -2, i + 4)) : null}
      </g>
      <g stroke="#fff" strokeOpacity="0.1" strokeWidth="0.8">
        {[0.82].map((k, i) => crease(at(s, e, k), up, 2.4, i))}
      </g>
      {/* cucitura alla spalla e al polsino */}
      <path d={`M${f(at(s, e, 0.1).x + up.nx * w * 0.46)} ${f(at(s, e, 0.1).y + up.ny * w * 0.46)} L${f(at(s, e, 0.1).x - up.nx * w * 0.46)} ${f(at(s, e, 0.1).y - up.ny * w * 0.46)}`} stroke={color} strokeOpacity="0.6" strokeWidth="0.55" strokeDasharray="1.2 1" />
      {long ? (() => {
        const c = at(e, h, 0.8);
        return <path d={`M${f(c.x + fo.nx * w * 0.5)} ${f(c.y + fo.ny * w * 0.5)} L${f(c.x - fo.nx * w * 0.5)} ${f(c.y - fo.ny * w * 0.5)}`} stroke={color} strokeOpacity="0.6" strokeWidth="0.55" strokeDasharray="1.2 1" />;
      })() : null}
    </g>
  );
}

/** Cuoio di un bracciale o di una cinghia stesa tra due punti: grana, cuciture ai bordi, luce. */
export function LeatherBand({ uid, a, b, w, color }: { uid: string; a: P; b: P; w: number; color: string }) {
  const d = dirN(a, b);
  const off = w / 2 - 1.1;
  const edge = (sgn: number) => `M${f(a.x + d.nx * off * sgn + d.ux * 1.5)} ${f(a.y + d.ny * off * sgn + d.uy * 1.5)} L${f(b.x + d.nx * off * sgn - d.ux * 1.5)} ${f(b.y + d.ny * off * sgn - d.uy * 1.5)}`;
  return (
    <g pointerEvents="none" strokeLinecap="round">
      <line x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} stroke={`url(#${uid}grain)`} strokeWidth={f(w)} />
      <path d={edge(1)} stroke={color} strokeOpacity="0.65" strokeWidth="0.28" strokeDasharray="0.8 0.7" fill="none" />
      <path d={edge(-1)} stroke={color} strokeOpacity="0.65" strokeWidth="0.28" strokeDasharray="0.8 0.7" fill="none" />
      <line x1={f(a.x + d.nx * w * 0.3)} y1={f(a.y + d.ny * w * 0.3)} x2={f(b.x + d.nx * w * 0.3)} y2={f(b.y + d.ny * w * 0.3)} stroke="#000" strokeOpacity="0.13" strokeWidth={f(w * 0.26)} />
      <line x1={f(a.x - d.nx * w * 0.22)} y1={f(a.y - d.ny * w * 0.22)} x2={f(b.x - d.nx * w * 0.22)} y2={f(b.y - d.ny * w * 0.22)} stroke="#fff" strokeOpacity="0.2" strokeWidth="0.35" />
    </g>
  );
}

/** Allacciatura di un bracciale tra a e b: occhielli d'ottone sui due lembi e un laccio sottile che incrocia. */
export function BracerLacing({ a, b, w, color }: { a: P; b: P; w: number; color: string }) {
  const d = dirN(a, b);
  const n = Math.max(3, Math.round(d.len / 4));
  const half = Math.max(1.3, w * 0.17);
  const pt = (t: number, sg: number) => `${f(a.x + (b.x - a.x) * t + d.nx * half * sg)} ${f(a.y + (b.y - a.y) * t + d.ny * half * sg)}`;
  const ts = Array.from({ length: n + 1 }, (_, i) => i / n);
  const cross = ts.slice(0, -1).map((t, i) => `M${pt(t, -1)} L${pt(ts[i + 1], 1)} M${pt(t, 1)} L${pt(ts[i + 1], -1)}`).join(" ");
  return (
    <g pointerEvents="none" fill="none" strokeLinecap="round">
      <path d={`M${pt(0, -1)} L${pt(1, -1)} M${pt(0, 1)} L${pt(1, 1)}`} stroke="#000" strokeOpacity="0.3" strokeWidth="0.25" />
      <path d={cross} stroke="#000" strokeOpacity="0.4" strokeWidth="0.6" />
      <path d={cross} stroke={color} strokeWidth="0.3" />
      {ts.flatMap((t) => [-1, 1].map((sg) => {
        const [cx, cy] = pt(t, sg).split(" ");
        return <circle key={`${t}${sg}`} cx={cx} cy={cy} r="0.42" fill="#140c06" stroke="#c9a24a" strokeOpacity="0.85" strokeWidth="0.16" />;
      }))}
    </g>
  );
}

/** Mano: nocche, piega del pollice, luce sul dorso. */
export function HandDetail({ h, r, gloved, skinD, draw }: { h: P; r: number; gloved: boolean; skinD: string; draw: boolean }) {
  const line = gloved ? "#1a0e06" : skinD;
  return (
    <g pointerEvents="none" fill="none" strokeLinecap="round">
      <ellipse cx={f(h.x - r * 0.3)} cy={f(h.y - r * 0.35)} rx={f(r * 0.45)} ry={f(r * 0.3)} fill="#fff" opacity={gloved ? 0.12 : 0.18} />
      {draw ? null : <path d={`M${f(h.x - r * 0.7)} ${f(h.y - r * 0.2)} q${f(r * 0.4)} ${f(r * 0.5)} ${f(r * 0.2)} ${f(r * 0.9)}`} stroke={line} strokeOpacity="0.55" strokeWidth="0.8" />}
      {[-0.5, -0.1, 0.3].map((k) => <circle key={k} cx={f(h.x + r * 0.55)} cy={f(h.y + r * k)} r="0.55" fill={line} opacity="0.35" />)}
      {gloved ? <path d={`M${f(h.x - r * 0.9)} ${f(h.y + r * 0.2)} a${f(r * 0.9)} ${f(r * 0.9)} 0 0 0 ${f(r * 1.6)} ${f(r * 0.4)}`} stroke="#c9a46a" strokeOpacity="0.5" strokeWidth="0.5" strokeDasharray="1.1 1" /> : null}
    </g>
  );
}

/** Stivale: cucitura della suola, pieghe alla caviglia, punta lucida. */
export function BootDetail({ ankle, top }: { ankle: P; top: number }) {
  return (
    <g pointerEvents="none" fill="none" strokeLinecap="round">
      <path d={`M${f(ankle.x - 10)} ${f(ankle.y + 6.2)} H${f(ankle.x + 21)}`} stroke="#e8d9b0" strokeOpacity="0.4" strokeWidth="0.55" strokeDasharray="1.3 1.1" />
      <path d={`M${f(ankle.x - 8)} ${f(ankle.y - 6)} q6 -2.4 14 0 M${f(ankle.x - 7)} ${f(ankle.y - 10)} q5 -2 11 0`} stroke="#000" strokeOpacity="0.32" strokeWidth="0.9" />
      <path d={`M${f(ankle.x - 8)} ${f(ankle.y - 5)} q6 -2.4 14 0`} stroke="#fff" strokeOpacity="0.1" strokeWidth="0.7" />
      <ellipse cx={f(ankle.x + 14)} cy={f(ankle.y + 3.4)} rx="4" ry="1.4" fill="#fff" opacity="0.16" transform={`rotate(14 ${f(ankle.x + 14)} ${f(ankle.y + 3.4)})`} />
      {top > 20 ? <path d={`M${f(ankle.x + 8.6)} ${f(ankle.y - top + 6)} L${f(ankle.x + 8)} ${f(ankle.y - 2)}`} stroke="#000" strokeOpacity="0.22" strokeWidth="2" /> : null}
    </g>
  );
}

/** Cintura: grana, impunture ai bordi, fori. */
export function BeltDetail({ uid, x, y, w, h, cx }: { uid: string; x: number; y: number; w: number; h: number; cx: number }) {
  return (
    <g pointerEvents="none">
      <rect x={f(x)} y={f(y)} width={f(w)} height={f(h)} rx="2" fill={`url(#${uid}grain)`} />
      <path d={`M${f(x + 2)} ${f(y + 1.6)} H${f(x + w - 2)} M${f(x + 2)} ${f(y + h - 1.6)} H${f(x + w - 2)}`} stroke="#e8d9b0" strokeOpacity="0.45" strokeWidth="0.5" strokeDasharray="1.3 1.1" />
      {[8, 12, 16].map((d) => <ellipse key={d} cx={f(cx + d + 2)} cy={f(y + h / 2)} rx="0.8" ry="0.9" fill="#000" opacity="0.5" />)}
      <rect x={f(x)} y={f(y + h - 2.4)} width={f(w)} height="2.4" fill="#000" opacity="0.18" />
    </g>
  );
}

/** Volto di profilo: ombre e luci, orecchio, narice, piega naso-labbro, palpebre e labbra. */
export function FaceShade({ uid, headPath, skin, skinDeep, chinY, ear, earRx, earRy, nk }: { uid: string; headPath: string; skin: string; skinDeep: string; chinY: number; ear: boolean; earRx: number; earRy: number; nk: number }) {
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id={`${uid}hc`}>
          <path d={headPath} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}hc)`}>
        {/* guancia incavata e mascella in ombra, tempia, orbita */}
        <ellipse cx="148" cy={f(chinY - 4)} rx="22" ry="9" fill={`url(#${uid}sd)`} opacity="0.42" />
        <ellipse cx="150" cy="93" rx="9" ry="7" fill={`url(#${uid}sd)`} opacity="0.22" />
        <ellipse cx="148" cy="74" rx="9" ry="9" fill={`url(#${uid}sd)`} opacity="0.2" />
        <ellipse cx="163" cy="79" rx="8" ry="4.6" fill={`url(#${uid}sd)`} opacity="0.3" />
        <ellipse cx={f(173 + 2 * nk)} cy="96.4" rx="5" ry="2" fill={`url(#${uid}sd)`} opacity="0.35" />
        {/* luci: fronte, zigomo, dorso del naso, mento */}
        <ellipse cx="161" cy="67" rx="10" ry="5" fill={`url(#${uid}sl)`} opacity="0.42" />
        <ellipse cx="160" cy="87" rx="6.5" ry="3.2" fill={`url(#${uid}sl)`} opacity="0.4" />
        <ellipse cx={f(166 + 2)} cy={f(chinY - 2.6)} rx="4.4" ry="2.4" fill={`url(#${uid}sl)`} opacity="0.18" />
        <ellipse cx="170" cy="99.2" rx="2.6" ry="1.1" fill={`url(#${uid}sl)`} opacity="0.3" />
      </g>
      {/* piega naso-labbro */}
      <path d={`M${f(171.4 - 1.6 * nk)} 96.6 Q167 99 165.6 101.8`} stroke={skinDeep} strokeOpacity="0.18" strokeWidth="0.7" fill="none" strokeLinecap="round" />
      {/* orecchio: elice, antelice, conca, trago, lobo */}
      {ear ? (
        <g fill="none" strokeLinecap="round">
          <ellipse cx="141.7" cy="89" rx={f(earRx * 0.45)} ry={f(earRy * 0.5)} fill={skinDeep} opacity="0.35" />
          <path d={`M${f(141 - earRx * 0.75)} ${f(88 - earRy * 0.6)} Q${f(141 - earRx * 0.2)} ${f(88 - earRy * 0.98)} ${f(141 + earRx * 0.7)} ${f(88 - earRy * 0.55)}`} stroke="#fff" strokeOpacity="0.28" strokeWidth="0.8" />
          <path d={`M${f(141 - earRx * 0.4)} ${f(88 - earRy * 0.35)} Q${f(141 + earRx * 0.1)} ${f(88 - earRy * 0.6)} ${f(141 + earRx * 0.45)} ${f(88 - earRy * 0.1)} Q${f(141 + earRx * 0.35)} ${f(88 + earRy * 0.35)} ${f(141 - earRx * 0.1)} ${f(88 + earRy * 0.45)}`} stroke={skinDeep} strokeOpacity="0.6" strokeWidth="0.7" />
          <path d={`M${f(141 + earRx * 0.85)} ${f(88 + earRy * 0.05)} q1 0.8 0.2 2`} stroke={skinDeep} strokeOpacity="0.55" strokeWidth="0.8" />
          <ellipse cx={f(141 - earRx * 0.1)} cy={f(88 + earRy * 0.72)} rx={f(earRx * 0.4)} ry={f(earRy * 0.18)} fill={skin} opacity="0.5" />
        </g>
      ) : null}
    </g>
  );
}

/** Occhio di profilo più vero: bianco ombreggiato, iride sfumata con anello scuro, due riflessi, piega della palpebra. */
export function EyeDetail({ uid, eyes, skinDeep, lid }: { uid: string; eyes: string; skinDeep: string; lid: number }) {
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id={`${uid}iris`} cx="45%" cy="55%" r="55%">
          <stop offset="0" stopColor={eyes} stopOpacity="0" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="0.85" stopColor="#000" stopOpacity="0.15" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
        <clipPath id={`${uid}ec`}>
          <path d="M157.4 83 C159.6 79.6 164.6 78.2 168.4 81.4 C165.6 84.6 160.8 85.2 157.4 83 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}ec)`}>
        <ellipse cx="164.6" cy="82" rx="2.4" ry="3.1" fill={`url(#${uid}iris)`} />
        {/* striature dell'iride */}
        <g stroke="#000" strokeOpacity="0.18" strokeWidth="0.25">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const a = (i / 8) * Math.PI * 2;
            return <path key={i} d={`M${f(165 + Math.cos(a) * 1.2)} ${f(82 + Math.sin(a) * 1.6)} L${f(164.6 + Math.cos(a) * 2.3)} ${f(82 + Math.sin(a) * 3)}`} />;
          })}
        </g>
        <path d="M156 79 H170 V82.6 Q163 80.4 156 82.6 Z" fill="#000" opacity="0.16" />
      </g>
      <circle cx="163.2" cy="83.4" r="0.45" fill="#fff" opacity="0.7" />
      {/* piega della palpebra e rima inferiore */}
      <path d={`M157.6 ${f(80.6 - lid * 0.2)} Q162.6 ${f(76 + lid * 0.4)} 168.2 ${f(79.6 + lid * 0.2)}`} stroke={skinDeep} strokeOpacity="0.5" strokeWidth="0.6" fill="none" strokeLinecap="round" />
      <path d="M158.2 83.6 Q163 85.8 167.8 82.4" stroke={skinDeep} strokeOpacity="0.4" strokeWidth="0.5" fill="none" strokeLinecap="round" />
      <path d="M158.6 84.4 Q163 86.4 167.4 83.4" stroke="#fff" strokeOpacity="0.18" strokeWidth="0.5" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** Sopracciglio a peli: tanti tratti corti lungo l'arco, più fitti verso la radice del naso. */
export function BrowHairs({ d, color, width }: { d: string; color: string; width: number }) {
  // l'arco è "M x0 y0 Q cx cy x1 y1": lo campiono
  const n = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (n.length < 6) return null;
  const [x0, y0, qx, qy, x1, y1] = n;
  const pt = (t: number) => ({ x: (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * qx + t * t * x1, y: (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * qy + t * t * y1 });
  let hairs = "";
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const c = pt(t);
    const len = width * (0.9 + (1 - Math.abs(t - 0.35)) * 0.6);
    hairs += `M${f(c.x - len * 0.3)} ${f(c.y + width * 0.4)} l${f(len * 0.85)} ${f(-len * 0.55 + t * len * 0.65)}`;
  }
  return <path d={hairs} stroke={color} strokeWidth="0.45" strokeLinecap="round" opacity="0.85" fill="none" pointerEvents="none" />;
}

/** Labbra: arco del labbro superiore, ombra sotto il labbro inferiore e luce sopra. */
export function LipDetail({ lip, skinDeep }: { lip: string; skinDeep: string }) {
  return (
    <g pointerEvents="none" fill="none" strokeLinecap="round">
      <path d="M164.8 99.4 Q166.8 98.2 168.4 99 Q170.2 98.2 172.2 99.4" stroke={lip} strokeOpacity="0.38" strokeWidth="0.6" />
      <path d="M166 101.8 Q168.6 103 171.4 101.6" stroke="#fff" strokeOpacity="0.22" strokeWidth="0.9" />
      <path d="M165.6 103.8 Q168.4 104.8 170.8 103.6" stroke={skinDeep} strokeOpacity="0.35" strokeWidth="0.8" />
    </g>
  );
}

/** Ciocche: tante linee sottili che seguono la forma della testa, chiare e scure, più un riflesso morbido. */
export function HairFineStrands({ color, light, dark, curly }: { color: string; light: string; dark: string; curly: boolean }) {
  if (curly) {
    return (
      <g fill="none" strokeLinecap="round" pointerEvents="none">
        {Array.from({ length: 16 }, (_, i) => {
          const x = 132 + (i % 6) * 6.4 + (i > 5 ? 3 : 0);
          const y = 60 + Math.floor(i / 6) * 7 + (i % 2) * 2;
          return <path key={i} d={`M${x} ${y} q2.4 -2.4 4.8 0 q-1.2 2.4 -3.6 1.2`} stroke={i % 3 ? dark : light} strokeOpacity={i % 3 ? 0.45 : 0.35} strokeWidth="0.7" />;
        })}
      </g>
    );
  }
  return (
    <g fill="none" strokeLinecap="round" pointerEvents="none">
      {/* riflesso lucido largo */}
      <path d="M135 70 Q147 57 165 63" stroke={light} strokeOpacity="0.16" strokeWidth="4" />
      {Array.from({ length: 14 }, (_, i) => {
        const k = i / 13;
        const x0 = 131 + k * 6;
        const y0 = 86 - k * 22;
        const x1 = 150 + k * 18;
        const y1 = 58 + k * 2 + (i % 3);
        const cx = 136 + k * 10;
        const cy = 60 - k * 2;
        return <path key={i} d={`M${f(x0)} ${f(y0)} Q${f(cx)} ${f(cy)} ${f(x1)} ${f(y1)}`} stroke={i % 2 ? dark : light} strokeOpacity={i % 2 ? 0.28 : 0.13} strokeWidth={i % 4 === 0 ? 0.8 : 0.45} />;
      })}
      <path d="M131 84 Q130 78 133 72" stroke={color} strokeOpacity="0.5" strokeWidth="0.6" />
    </g>
  );
}

/** Barba a pelo: tratti brevi inclinati verso il basso, clip sulla forma della barba. */
export function BeardTexture({ uid, d, color, light, dark, box = [138, 92, 36, 44], k = 1, band = "M140 96 Q150 104 172 100", id = "bc" }: { uid: string; d: string; color: string; light: string; dark: string; /** area dei peli: x, y, larghezza, altezza */ box?: [number, number, number, number]; /** scala dei peli */ k?: number; band?: string; id?: string }) {
  let lt = "";
  let dk = "";
  const [bx, by, bw, bh] = box;
  const n = Math.round(70 * (bw * bh) / (36 * 44) / (k * k));
  for (let i = 0; i < n; i++) {
    const x = bx + ((i * 37) % 97) / 97 * bw;
    const y = by + ((i * 53) % 89) / 89 * bh;
    const l = (1.6 + ((i * 7) % 5) * 0.3) * k;
    // i peli scendono verso il centro del mento: leggera inclinazione verso l'asse
    const lean = (x < bx + bw / 2 ? 1 : -1) * (0.2 + (i % 3) * 0.25) * k;
    const seg = `M${f(x)} ${f(y)} l${f(lean)} ${f(l)}`;
    if (i % 4 === 0) lt += seg;
    else dk += seg;
  }
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id={`${uid}${id}`}>
          <path d={d} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}${id})`} strokeWidth={0.45 * k} strokeLinecap="round" fill="none">
        <path d={dk} stroke={dark} strokeOpacity="0.45" />
        <path d={lt} stroke={light} strokeOpacity="0.4" />
        {band ? <path d={band} stroke={color} strokeOpacity="0.3" strokeWidth={3 * k} /> : null}
      </g>
      <path d={d} fill="none" stroke={dark} strokeOpacity="0.6" strokeWidth={0.5 * k} />
    </g>
  );
}

/** Bottone cucito: osso, legno o metallo. Bordo rilevato, ombra sotto, lume in alto e i fori (o la cupola per il metallo). */
export function ClothButton({ x, y, r = 1.8, color = "#c9b48a", metal = false }: { x: number; y: number; r?: number; color?: string; metal?: boolean }) {
  return (
    <g pointerEvents="none">
      <circle cx={f(x + r * 0.18)} cy={f(y + r * 0.28)} r={f(r)} fill="#000" opacity="0.3" />
      <circle cx={f(x)} cy={f(y)} r={f(r)} fill={color} stroke="#1b130d" strokeOpacity="0.85" strokeWidth={f(r * 0.26)} />
      {metal ? (
        <>
          <circle cx={f(x - r * 0.28)} cy={f(y - r * 0.3)} r={f(r * 0.38)} fill="#fff" opacity="0.75" />
          <circle cx={f(x)} cy={f(y)} r={f(r * 0.62)} fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth={f(r * 0.14)} />
        </>
      ) : (
        <>
          <circle cx={f(x)} cy={f(y)} r={f(r * 0.66)} fill="none" stroke="#000" strokeOpacity="0.2" strokeWidth={f(r * 0.14)} />
          <circle cx={f(x - r * 0.26)} cy={f(y)} r={f(r * 0.15)} fill="#1b130d" opacity="0.7" />
          <circle cx={f(x + r * 0.26)} cy={f(y)} r={f(r * 0.15)} fill="#1b130d" opacity="0.7" />
          <path d={`M${f(x - r * 0.55)} ${f(y - r * 0.5)} A${f(r * 0.75)} ${f(r * 0.75)} 0 0 1 ${f(x + r * 0.2)} ${f(y - r * 0.72)}`} stroke="#fff" strokeOpacity="0.5" strokeWidth={f(r * 0.2)} fill="none" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}
