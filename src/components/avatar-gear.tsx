/**
 * Materia dell'equipaggiamento: pieghe morbide di stoffa (sfumate senza filtri, così restano leggere anche
 * nel gioco), pantaloni con volume e pieghe al ginocchio, parabraccio e pettorina di cuoio con grana,
 * impunture e cinghie, fibbia di metallo con lume e ardiglione.
 */

type P = { x: number; y: number };
const f = (n: number) => n.toFixed(1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const at = (a: P, b: P, t: number): P => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const dirN = (a: P, b: P) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { ux: dx / l, uy: dy / l, nx: -dy / l, ny: dx / l, len: l };
};
const off = (p: P, d: ReturnType<typeof dirN>, k: number): P => ({ x: p.x + d.nx * k, y: p.y + d.ny * k });

/**
 * Tratto sfumato: tre passate sovrapposte, larga e trasparente sotto, stretta e piena sopra.
 * Sembra un'ombra dipinta col pennello morbido, senza il costo di un filtro di sfocatura.
 */
export function Soft({ d, color = "#000", w = 1.4, o = 0.2, transform }: { d: string; color?: string; w?: number; o?: number; transform?: string }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" transform={transform}>
      <path d={d} stroke={color} strokeOpacity={f(o * 0.28)} strokeWidth={f(w * 2.8)} />
      <path d={d} stroke={color} strokeOpacity={f(o * 0.45)} strokeWidth={f(w * 1.7)} />
      <path d={d} stroke={color} strokeOpacity={f(o)} strokeWidth={f(w)} />
    </g>
  );
}

/** Pieghe a ventaglio sul ginocchio o sul gomito: archetti morbidi in ombra, con il bordo in luce. */
function bendFolds(c: P, d: ReturnType<typeof dirN>, w: number, n: number, gap: number) {
  return Array.from({ length: n }, (_, i) => {
    const k = (i - (n - 1) / 2) * gap;
    const mid = { x: c.x + d.ux * k, y: c.y + d.uy * k };
    const a = off(mid, d, w * 0.44);
    const b = off(mid, d, -w * 0.3);
    const ctrl = { x: (a.x + b.x) / 2 + d.ux * (2.2 + i * 0.4), y: (a.y + b.y) / 2 + d.uy * (2.2 + i * 0.4) };
    return `M${f(a.x)} ${f(a.y)} Q${f(ctrl.x)} ${f(ctrl.y)} ${f(b.x)} ${f(b.y)}`;
  });
}

/**
 * Gamba di profilo (un tratto dall'anca al ginocchio o dal ginocchio alla caviglia): trama di saia, ombra
 * sul lato dietro, lume sulla piega davanti, pieghe che si raccolgono al ginocchio.
 */
export function LegDetail({ uid, a, b, w, knee = false, shin = false }: { uid: string; a: P; b: P; w: number; /** pieghe al ginocchio in fondo al tratto */ knee?: boolean; /** stinco: pieghe che si posano sulla calzatura */ shin?: boolean }) {
  const d = dirN(a, b);
  const seg = (k: number, t0 = 0.06, t1 = 0.94) => {
    const p0 = off(at(a, b, t0), d, k);
    const p1 = off(at(a, b, t1), d, k);
    return `M${f(p0.x)} ${f(p0.y)} L${f(p1.x)} ${f(p1.y)}`;
  };
  return (
    <g pointerEvents="none">
      <line x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} stroke={`url(#${uid}weave)`} strokeWidth={f(w)} strokeLinecap="round" opacity="0.45" />
      {/* ombra morbida sul lato dietro */}
      <Soft d={seg(w * 0.3)} w={w * 0.22} o={0.16} />
      {knee ? (
        <g>
          {bendFolds(at(a, b, 0.86), d, w, 3, 3.4).map((p, i) => <Soft key={i} d={p} w={1.2} o={0.14} />)}
          {bendFolds(at(a, b, 0.86), d, w, 3, 3.4).map((p, i) => <path key={`l${i}`} d={p} transform={`translate(${f(d.ux * 1.1)} ${f(d.uy * 1.1)})`} stroke="#fff" strokeOpacity="0.09" strokeWidth="0.7" fill="none" strokeLinecap="round" />)}
        </g>
      ) : null}
      {shin ? (
        <g>
          {bendFolds(at(a, b, 0.2), d, w * 0.9, 2, 4).map((p, i) => <Soft key={i} d={p} w={1.1} o={0.1} />)}
          {bendFolds(at(a, b, 0.88), d, w * 0.95, 2, 2.8).map((p, i) => <Soft key={`s${i}`} d={p} w={1.1} o={0.13} />)}
        </g>
      ) : null}
    </g>
  );
}

/**
 * Gamba di fronte: `L(y, dx)` dà la x del bordo della gamba alla quota y. Luce da sinistra: ombra sul lato
 * destro, piega stirata davanti, pieghe a ventaglio sul ginocchio e sopra la calzatura.
 */
export function FrontLegDetail({ uid, L, legW, kneeY = 268, bottom = 326 }: { uid: string; L: (y: number, d: number) => string; legW: number; kneeY?: number; bottom?: number }) {
  const n = (y: number, d: number) => Number(L(y, d));
  const vline = (d: number, y0: number, y1: number) => `M${L(y0, d)} ${y0} L${L(y1, d)} ${y1}`;
  const fold = (y: number, k: number, bend: number) => `M${f(n(y, -legW * 0.42 * k))} ${f(y - 1)} Q${f(n(y, 0))} ${f(y + bend)} ${f(n(y, legW * 0.4 * k))} ${f(y - 2)}`;
  return (
    <g pointerEvents="none">
      <path d={`M${L(208, -legW / 2)} 208 L${L(208, legW / 2)} 208 L${L(bottom, legW / 2)} ${bottom} L${L(bottom, -legW / 2)} ${bottom} Z`} fill={`url(#${uid}weave)`} opacity="0.5" />
      <Soft d={vline(legW * 0.3, 214, bottom - 4)} w={legW * 0.2} o={0.18} />
      <Soft d={vline(-legW * 0.08, 216, bottom - 6)} color="#fff" w={legW * 0.08} o={0.1} />
      {/* ginocchio: due pieghe che si aprono a ventaglio e una sotto, più corta */}
      {[[kneeY - 3, 1, 3.4], [kneeY + 4, 0.85, 3], [kneeY + 11, 0.6, 2.2]].map(([y, k, b], i) => (
        <g key={i}>
          <Soft d={fold(y, k, b)} w={1.3} o={0.16} />
          <path d={fold(y + 1.4, k * 0.9, b)} stroke="#fff" strokeOpacity="0.08" strokeWidth="0.7" fill="none" strokeLinecap="round" />
        </g>
      ))}
      {/* la stoffa si posa sopra la calzatura */}
      {[bottom - 12, bottom - 6].map((y, i) => <Soft key={y} d={fold(y, 0.9 - i * 0.15, 2.4)} w={0.9} o={0.2} />)}
    </g>
  );
}

/**
 * Parabraccio di cuoio sull'avambraccio dell'arco (da a verso b): placca con grana, bordo impunturato,
 * nervatura in luce, lato in ombra e due cinghiette con fibbia.
 */
export function ArmGuard({ uid, a, b, w, color, out = "#2a1d14" }: { uid: string; a: P; b: P; w: number; color: string; out?: string }) {
  const d = dirN(a, b);
  const edge = (k: number) => {
    const p0 = off(at(a, b, 0.04), d, k);
    const p1 = off(at(a, b, 0.96), d, k);
    return `M${f(p0.x)} ${f(p0.y)} L${f(p1.x)} ${f(p1.y)}`;
  };
  const strap = (t: number) => {
    const c = at(a, b, t);
    const p0 = off(c, d, w * 0.6);
    const p1 = off(c, d, -w * 0.6);
    const bk = off(c, d, -w * 0.32);
    return (
      <g key={t}>
        <line x1={f(p0.x)} y1={f(p0.y)} x2={f(p1.x)} y2={f(p1.y)} stroke={out} strokeOpacity="0.55" strokeWidth="3.4" strokeLinecap="round" />
        <line x1={f(p0.x)} y1={f(p0.y)} x2={f(p1.x)} y2={f(p1.y)} stroke={shadeHex(color, -0.42)} strokeWidth="2.4" strokeLinecap="round" />
        <line x1={f(p0.x)} y1={f(p0.y)} x2={f(p1.x)} y2={f(p1.y)} stroke="#fff" strokeOpacity="0.12" strokeWidth="0.5" transform={`translate(${f(-d.ux * 0.6)} ${f(-d.uy * 0.6)})`} />
        <rect x={f(bk.x - 1.7)} y={f(bk.y - 1.7)} width="3.4" height="3.4" rx="0.7" fill="none" stroke="#7a5a1a" strokeWidth="1.1" transform={`rotate(${f((Math.atan2(d.uy, d.ux) * 180) / Math.PI)} ${f(bk.x)} ${f(bk.y)})`} />
        <rect x={f(bk.x - 1.7)} y={f(bk.y - 1.7)} width="3.4" height="3.4" rx="0.7" fill="none" stroke="#e3c06a" strokeWidth="0.6" transform={`rotate(${f((Math.atan2(d.uy, d.ux) * 180) / Math.PI)} ${f(bk.x)} ${f(bk.y)})`} />
      </g>
    );
  };
  return (
    <g pointerEvents="none">
      <line x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} stroke={out} strokeOpacity="0.6" strokeWidth={f(w + 1.3)} strokeLinecap="round" />
      <line x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} stroke={color} strokeWidth={f(w)} strokeLinecap="round" />
      <line x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} stroke={`url(#${uid}grain)`} strokeWidth={f(w)} strokeLinecap="round" opacity="0.6" />
      <Soft d={edge(w * 0.3)} w={w * 0.2} o={0.22} />
      <Soft d={edge(-w * 0.12)} color="#fff" w={w * 0.12} o={0.13} />
      <path d={`${edge(w / 2 - 1.3)} ${edge(-(w / 2 - 1.3))}`} stroke={shadeHex(color, 0.55)} strokeOpacity="0.55" strokeWidth="0.35" strokeDasharray="1 0.8" fill="none" />
      {[0.24, 0.72].map(strap)}
    </g>
  );
}

/**
 * Pettorina di cuoio: forma `d` già decisa da chi la disegna. Grana, lume in alto e ombra in basso,
 * smusso scuro lungo il bordo e impuntura interna (la stessa forma un po' rimpicciolita verso `c`).
 */
export function ChestGuard({ uid, d, c, color, out = "#2a1d14" }: { uid: string; d: string; c: P; color: string; out?: string }) {
  const k = 0.84;
  const inset = `translate(${f(c.x)} ${f(c.y)}) scale(${k}) translate(${f(-c.x)} ${f(-c.y)})`;
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id={`${uid}cgc`}><path d={d} /></clipPath>
      </defs>
      <path d={d} fill={color} stroke={out} strokeOpacity="0.6" strokeWidth="0.8" />
      <g clipPath={`url(#${uid}cgc)`}>
        <path d={d} fill={`url(#${uid}grain)`} opacity="0.55" />
        <ellipse cx={f(c.x - 2)} cy={f(c.y - 10)} rx="12" ry="9" fill={`url(#${uid}sl)`} opacity="0.3" />
        <ellipse cx={f(c.x + 2)} cy={f(c.y + 14)} rx="16" ry="8" fill={`url(#${uid}sd)`} opacity="0.45" />
        <path d={d} fill="none" stroke="#000" strokeOpacity="0.28" strokeWidth="2.6" />
        <path d={d} fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="1" transform="translate(0.6 0.8)" />
      </g>
      <path d={d} transform={inset} fill="none" stroke={shadeHex(color, 0.6)} strokeOpacity="0.6" strokeWidth={f(0.42 / k)} strokeDasharray="1.1 0.9" />
    </g>
  );
}

/**
 * Fibbia di metallo semplice: telaio rettangolare in ottone con ombra, lume sui bordi in alto e a
 * sinistra, ardiglione che attraversa e passante di cuoio accanto.
 */
export function PlainBuckle({ x, y, w, h, sw = 1.4, metal = "#d9b45a" }: { x: number; y: number; w: number; h: number; sw?: number; metal?: string }) {
  const x0 = x - w / 2;
  const y0 = y - h / 2;
  return (
    <g pointerEvents="none">
      <rect x={f(x0 + 0.4)} y={f(y0 + 0.7)} width={f(w)} height={f(h)} rx={f(sw)} fill="none" stroke="#000" strokeOpacity="0.4" strokeWidth={f(sw)} />
      <rect x={f(x0)} y={f(y0)} width={f(w)} height={f(h)} rx={f(sw)} fill="none" stroke={shadeHex(metal, -0.35)} strokeWidth={f(sw)} />
      <rect x={f(x0)} y={f(y0)} width={f(w)} height={f(h)} rx={f(sw)} fill="none" stroke={metal} strokeWidth={f(sw * 0.62)} />
      <path d={`M${f(x0 + sw * 0.2)} ${f(y0 + h - sw)} V${f(y0 + sw * 0.2)} H${f(x0 + w - sw)}`} stroke="#fff6d8" strokeOpacity="0.7" strokeWidth={f(sw * 0.3)} fill="none" strokeLinecap="round" />
      <line x1={f(x0 + sw * 0.4)} y1={f(y)} x2={f(x + w * 0.18)} y2={f(y)} stroke={shadeHex(metal, -0.4)} strokeWidth={f(sw * 0.7)} strokeLinecap="round" />
      <line x1={f(x0 + sw * 0.4)} y1={f(y - sw * 0.15)} x2={f(x + w * 0.16)} y2={f(y - sw * 0.15)} stroke="#fff6d8" strokeOpacity="0.5" strokeWidth={f(sw * 0.22)} strokeLinecap="round" />
    </g>
  );
}

/**
 * Luce e materia di un flettente (stesso tracciato `d`): riflesso lucido allungato su un tratto, e sul
 * legno una venatura irregolare e la lamina più chiara del ventre.
 */
export function LimbGloss({ d, width, wood }: { d: string; width: number; wood: boolean }) {
  return (
    <g fill="none" strokeLinecap="round" pointerEvents="none">
      {wood ? <path d={d} stroke="#2a1608" strokeOpacity="0.3" strokeWidth={f(Math.max(0.35, width * 0.09))} strokeDasharray="7 2.4 12 3 4 2.2 9 3.4" transform="translate(-0.7 0)" /> : null}
      {wood ? <path d={d} stroke="#3a2210" strokeOpacity="0.22" strokeWidth={f(Math.max(0.3, width * 0.07))} strokeDasharray="3 5 10 2 6 4" transform="translate(0.9 0)" /> : null}
      <path d={d} pathLength={100} strokeDasharray="22 100" strokeDashoffset={-16} stroke="#fff" strokeOpacity={wood ? 0.08 : 0.1} strokeWidth={f(width * 0.6)} />
      <path d={d} pathLength={100} strokeDasharray="16 100" strokeDashoffset={-19} stroke="#fff" strokeOpacity={wood ? 0.18 : 0.26} strokeWidth={f(Math.max(0.5, width * 0.2))} />
    </g>
  );
}

/** Venatura del legno del riser, ritagliata sulla sua sagoma (coordinate locali dell'arco). */
export function RiserGrain({ id, d, top, bottom, x0, x1 }: { id: string; d: string; top: number; bottom: number; x0: number; x1: number }) {
  const lines = [0.18, 0.36, 0.55, 0.74, 0.9].map((u, i) => {
    const x = lerp(x0, x1, u);
    const w = i % 2 ? 1.4 : -1.2;
    return `M${f(x)} ${f(top)} C${f(x + w)} ${f(lerp(top, bottom, 0.3))} ${f(x - w)} ${f(lerp(top, bottom, 0.6))} ${f(x + w * 0.5)} ${f(bottom)}`;
  });
  return (
    <g pointerEvents="none">
      <defs><clipPath id={id}><path d={d} /></clipPath></defs>
      <g clipPath={`url(#${id})`} fill="none" strokeLinecap="round">
        {lines.map((p, i) => <path key={i} d={p} stroke="#2a1608" strokeOpacity={i % 2 ? 0.22 : 0.3} strokeWidth={i % 2 ? 0.4 : 0.55} />)}
        <ellipse cx={f(lerp(x0, x1, 0.62))} cy={f(lerp(top, bottom, 0.22))} rx="1.6" ry="3.2" stroke="#2a1608" strokeOpacity="0.25" strokeWidth="0.4" />
        <path d={`M${f(lerp(x0, x1, 0.62))} ${f(top)} V${f(bottom)}`} stroke="#fff" strokeOpacity="0.12" strokeWidth="1.4" />
      </g>
    </g>
  );
}

function shadeHex(hex: string, k: number) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return hex;
  const ch = (sh: number) => {
    const v = (n >> sh) & 255;
    const r = k < 0 ? v * (1 + k) : v + (255 - v) * k;
    return Math.max(0, Math.min(255, Math.round(r)));
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}
