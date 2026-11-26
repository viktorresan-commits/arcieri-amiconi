/**
 * Copricapi dell'arciere più definiti, da fantasy realistico: cuciture e pannelli, tese con l'ombra sotto, piume
 * con le barbe, elmo d'acciaio con ribattini, nasale e maglia di ferro, cerchietto e corona d'oro con gemme
 * sfaccettate, alloro con le nervature, cuffia a coste col pompon soffice.
 * Di fronte (FaceHat, coordinate del volto 0–100) e di profilo (SideHat, coordinate della figura).
 */
import type { ReactNode } from "react";
import type { AvatarLook } from "@/lib/arcieri/avatar";

const f = (n: number) => n.toFixed(2);
const INK = "#1b130d";

function shade(hex: string, k: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, "0")}`;
}

/** sfumature del materiale: panno (luce in alto a sinistra), acciaio, oro */
function HatDefs({ uid, c }: { uid: string; c: string }) {
  return (
    <defs>
      <linearGradient id={`${uid}hcl`} x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stopColor={shade(c, 0.22)} />
        <stop offset="0.5" stopColor={c} />
        <stop offset="1" stopColor={shade(c, -0.4)} />
      </linearGradient>
      <linearGradient id={`${uid}hst`} x1="0" y1="0" x2="0.5" y2="1">
        <stop offset="0" stopColor="#f4f7fa" />
        <stop offset="0.35" stopColor="#a9b2bb" />
        <stop offset="0.62" stopColor="#6c757e" />
        <stop offset="0.8" stopColor="#c3cad1" />
        <stop offset="1" stopColor="#3a4148" />
      </linearGradient>
      <linearGradient id={`${uid}hau`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor={shade(c, 0.6)} />
        <stop offset="0.4" stopColor={c} />
        <stop offset="0.75" stopColor={shade(c, -0.35)} />
        <stop offset="1" stopColor={shade(c, 0.15)} />
      </linearGradient>
      <radialGradient id={`${uid}hgm`} cx="35%" cy="30%" r="70%">
        <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
        <stop offset="0.25" stopColor="#fff" stopOpacity="0.15" />
        <stop offset="1" stopColor="#000" stopOpacity="0.35" />
      </radialGradient>
    </defs>
  );
}

/** gemma sfaccettata (rombo o ovale) con riflesso */
function Gem({ x, y, w, h, color, round = false }: { x: number; y: number; w: number; h: number; color: string; round?: boolean }) {
  return (
    <g>
      {round ? <ellipse cx={f(x)} cy={f(y)} rx={f(w / 2)} ry={f(h / 2)} fill={color} stroke={shade(color, -0.55)} strokeWidth="0.35" /> : <path d={`M${f(x)} ${f(y - h / 2)} L${f(x + w / 2)} ${f(y)} L${f(x)} ${f(y + h / 2)} L${f(x - w / 2)} ${f(y)} Z`} fill={color} stroke={shade(color, -0.55)} strokeWidth="0.35" />}
      <path d={`M${f(x - w / 2)} ${f(y)} L${f(x)} ${f(y - h / 2)} L${f(x)} ${f(y)} Z`} fill="#fff" opacity="0.35" />
      <path d={`M${f(x)} ${f(y)} L${f(x + w / 2)} ${f(y)} L${f(x)} ${f(y + h / 2)} Z`} fill="#000" opacity="0.28" />
      <circle cx={f(x - w * 0.14)} cy={f(y - h * 0.18)} r={f(Math.min(w, h) * 0.12)} fill="#fff" opacity="0.95" />
    </g>
  );
}

/** piuma: rachide e barbe, con la punta che si piega (da a verso b, curva c) */
function Plume({ a, b, c, color, width }: { a: [number, number]; b: [number, number]; c: [number, number]; color: string; width: number }) {
  const pts = Array.from({ length: 15 }, (_, i) => {
    const t = (i + 1) / 16;
    const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0];
    const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1];
    const dx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
    const dy = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
    const len = Math.hypot(dx, dy) || 1;
    return { x, y, nx: -dy / len, ny: dx / len, tx: dx / len, ty: dy / len, w: width * Math.sin(Math.PI * Math.min(1, t * 1.15)) };
  });
  const left = pts.map((p) => `${f(p.x + p.nx * p.w)} ${f(p.y + p.ny * p.w)}`);
  const right = pts.map((p) => `${f(p.x - p.nx * p.w * 0.8)} ${f(p.y - p.ny * p.w * 0.8)}`).reverse();
  return (
    <g>
      <path d={`M${f(a[0])} ${f(a[1])} L${left.join(" L")} L${f(b[0])} ${f(b[1])} L${right.join(" L")} Z`} fill={color} stroke={shade(color, -0.45)} strokeWidth="0.3" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <path d={`M${f(p.x)} ${f(p.y)} l${f(p.nx * p.w * 0.95 + p.tx * p.w * 0.5)} ${f(p.ny * p.w * 0.95 + p.ty * p.w * 0.5)}`} stroke={shade(color, -0.25)} strokeWidth="0.3" />
          <path d={`M${f(p.x)} ${f(p.y)} l${f(-p.nx * p.w * 0.75 + p.tx * p.w * 0.45)} ${f(-p.ny * p.w * 0.75 + p.ty * p.w * 0.45)}`} stroke={shade(color, -0.3)} strokeWidth="0.3" />
        </g>
      ))}
      <path d={`M${f(a[0])} ${f(a[1])} Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`} stroke={shade(color, 0.6)} strokeWidth="0.36" fill="none" />
    </g>
  );
}

/** cuciture (tratteggio chiaro) */
const stitch = (d: string, color = "#f1e4c4", op = 0.5, w = 0.24) => <path d={d} stroke={color} strokeOpacity={op} strokeWidth={w} strokeDasharray="0.7 0.55" fill="none" strokeLinecap="round" />;

/** Copricapo visto di fronte, sopra il volto (centro x 50, guance rx, altezza ry, centro del volto fy). */
export function FaceHat({ look, uid, rx, ry, fy }: { look: AvatarLook; uid: string; rx: number; ry: number; fy: number }): ReactNode {
  const c = look.hatColor;
  const L = 50 - rx;
  const R = 50 + rx;
  const top = fy - ry;
  const cl = `url(#${uid}hcl)`;
  switch (look.hat) {
    case "berretto":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          <path d={`M${f(L - 3)} ${f(fy - 9)} C${f(L - 4)} ${f(top - 12)} ${f(R + 4)} ${f(top - 12)} ${f(R + 3)} ${f(fy - 9)} Z`} fill={cl} stroke={INK} strokeOpacity="0.8" strokeWidth="0.5" />
          {/* spicchi cuciti fino al bottone */}
          {[-0.55, 0, 0.55].map((k) => <path key={k} d={`M50 ${f(top - 4.8)} Q${f(50 + k * rx * 0.8)} ${f(top - 2)} ${f(50 + k * (rx + 2.4))} ${f(fy - 12)}`} stroke={shade(c, -0.35)} strokeWidth="0.36" fill="none" />)}
          {[-0.55, 0.55].map((k) => stitch(`M${f(50 + k * 1.2)} ${f(top - 4.2)} Q${f(50 + k * rx * 0.8 + k * 1.2)} ${f(top - 1.2)} ${f(50 + k * (rx + 2.4) + k * 1.2)} ${f(fy - 12)}`))}
          <circle cx="50" cy={f(top - 5.4)} r="1.5" fill={shade(c, -0.25)} stroke={INK} strokeWidth="0.35" />
          <path d={`M${f(L + 1)} ${f(top + 5)} Q${f(50 - rx * 0.5)} ${f(top - 2.6)} ${f(48)} ${f(top - 3.4)}`} stroke="#fff" strokeOpacity="0.28" strokeWidth="0.65" fill="none" strokeLinecap="round" />
          {/* fascia e visiera corta che fa ombra sugli occhi */}
          <path d={`M${f(L - 3.4)} ${f(fy - 12.4)} Q50 ${f(fy - 15.6)} ${f(R + 3.4)} ${f(fy - 12.4)} L${f(R + 3.6)} ${f(fy - 8)} Q50 ${f(fy - 11)} ${f(L - 3.6)} ${f(fy - 8)} Z`} fill={shade(c, -0.28)} stroke={INK} strokeOpacity="0.7" strokeWidth="0.4" />
          {stitch(`M${f(L - 2.8)} ${f(fy - 10.2)} Q50 ${f(fy - 13.2)} ${f(R + 2.8)} ${f(fy - 10.2)}`)}
          <path d={`M${f(L + 1)} ${f(fy - 8.6)} Q50 ${f(fy - 12)} ${f(R - 1)} ${f(fy - 8.6)} Q50 ${f(fy - 2.6)} ${f(L + 1)} ${f(fy - 8.6)} Z`} fill={shade(c, -0.18)} stroke={INK} strokeOpacity="0.75" strokeWidth="0.4" />
          <path d={`M${f(L + 3)} ${f(fy - 7.8)} Q50 ${f(fy - 4.2)} ${f(R - 3)} ${f(fy - 7.8)}`} stroke="#fff" strokeOpacity="0.25" strokeWidth="0.4" fill="none" />
          <path d={`M${f(L + 2)} ${f(fy - 6.6)} Q50 ${f(fy - 1)} ${f(R - 2)} ${f(fy - 6.6)}`} stroke="#000" strokeOpacity="0.28" strokeWidth="1" fill="none" />
        </g>
      );
    case "fascia":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          {/* code del nodo dietro la testa, a destra */}
          <path d={`M${f(R)} ${f(fy - 12.4)} q5 2.4 6.4 11 l-2.6 0.6 q-1 -6.6 -4.4 -9.4 Z M${f(R + 0.6)} ${f(fy - 11)} q3.6 4.2 3.4 12.6 l-2.4 -0.2 q0 -7 -2 -10.6 Z`} fill={shade(c, -0.25)} stroke={INK} strokeOpacity="0.7" strokeWidth="0.36" />
          <path d={`M${f(L - 1.6)} ${f(fy - 14.4)} Q50 ${f(fy - 20)} ${f(R + 1.6)} ${f(fy - 14.4)} L${f(R + 1.8)} ${f(fy - 8.4)} Q50 ${f(fy - 14)} ${f(L - 1.8)} ${f(fy - 8.4)} Z`} fill={cl} stroke={INK} strokeOpacity="0.8" strokeWidth="0.45" />
          {/* ricamo a greca e orli */}
          <path d={Array.from({ length: 9 }, (_, i) => { const x = L + 1 + i * ((rx * 2 - 2) / 9); const y = fy - 11.6 - Math.sin((i / 8) * Math.PI) * 2.8; return `${i ? "L" : "M"}${f(x)} ${f(y)} L${f(x + (rx * 2 - 2) / 18)} ${f(y - 1.4)}`; }).join(" ")} stroke={look.trim || "#e3c06a"} strokeWidth="0.36" fill="none" strokeLinejoin="round" />
          {stitch(`M${f(L - 1)} ${f(fy - 13.6)} Q50 ${f(fy - 19)} ${f(R + 1)} ${f(fy - 13.6)}`)}
          {stitch(`M${f(L - 1)} ${f(fy - 9.4)} Q50 ${f(fy - 14.8)} ${f(R + 1)} ${f(fy - 9.4)}`)}
          <path d={`M${f(L)} ${f(fy - 13.4)} Q${f(50 - rx * 0.5)} ${f(fy - 17)} 50 ${f(fy - 17.2)}`} stroke="#fff" strokeOpacity="0.3" strokeWidth="0.48" fill="none" />
        </g>
      );
    case "piuma":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          {/* berretto rinascimentale piatto e inclinato, con la piuma fermata da una spilla */}
          <defs>
            <clipPath id={`${uid}pcl`}>
              <path d={`M${f(L - 7)} ${f(fy - 11)} C${f(L - 8)} ${f(top - 10)} ${f(R + 2)} ${f(top - 18)} ${f(R + 9)} ${f(fy - 14)} Q50 ${f(fy - 6)} ${f(L - 7)} ${f(fy - 11)} Z`} />
            </clipPath>
          </defs>
          <path d={`M${f(L - 7)} ${f(fy - 11)} C${f(L - 8)} ${f(top - 10)} ${f(R + 2)} ${f(top - 18)} ${f(R + 9)} ${f(fy - 14)} Q50 ${f(fy - 6)} ${f(L - 7)} ${f(fy - 11)} Z`} fill={cl} stroke={INK} strokeOpacity="0.8" strokeWidth="0.5" />
          {/* spicchi cuciti e luce, tenuti dentro la calotta */}
          <g clipPath={`url(#${uid}pcl)`}>
            {[-0.5, 0, 0.5].map((k) => <path key={k} d={`M${f(50 + k * rx * 0.9)} ${f(top - 14)} q${f(k * 3)} 6 ${f(k * 5)} 13`} stroke={shade(c, -0.35)} strokeWidth="0.32" fill="none" />)}
            {[-0.5, 0, 0.5].map((k) => stitch(`M${f(50 + k * rx * 0.9 + 0.7)} ${f(top - 14)} q${f(k * 3)} 6 ${f(k * 5)} 13`, "#f1e4c4", 0.35))}
            <path d={`M${f(L - 4)} ${f(fy - 14)} Q${f(50 - rx * 0.6)} ${f(top - 5)} ${f(50 + 4)} ${f(top - 6.6)}`} stroke="#fff" strokeOpacity="0.3" strokeWidth="0.48" fill="none" strokeLinecap="round" />
          </g>
          <path d={`M${f(L - 6)} ${f(fy - 10.4)} Q50 ${f(fy - 5)} ${f(R + 8)} ${f(fy - 13.4)} L${f(R + 8.4)} ${f(fy - 11)} Q50 ${f(fy - 2)} ${f(L - 6.4)} ${f(fy - 8)} Z`} fill={shade(c, -0.35)} stroke={INK} strokeOpacity="0.7" strokeWidth="0.36" />
          <Plume a={[R + 3, fy - 13]} c={[R + 14, fy - 30]} b={[96, fy - 40]} color="#f4efe2" width={4.4} />
          <circle cx={f(R + 3)} cy={f(fy - 12.4)} r="2.6" fill={`url(#${uid}hau)`} stroke="#5c4316" strokeWidth="0.26" />
          <Gem x={R + 3} y={fy - 12.4} w={2.6} h={2.6} color="#b3123a" round />
        </g>
      );
    case "elmo":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          {/* calotta d'acciaio a spicchi: cresta, rinforzi ribattuti, fascia della fronte, nasale */}
          <path d={`M${f(L - 3.6)} ${f(fy - 5)} C${f(L - 4.8)} ${f(top - 14)} ${f(R + 4.8)} ${f(top - 14)} ${f(R + 3.6)} ${f(fy - 5)} Z`} fill={`url(#${uid}hst)`} stroke={INK} strokeOpacity="0.85" strokeWidth="0.5" />
          <path d={`M50 ${f(top - 5.2)} L50 ${f(fy - 12)}`} stroke="#3a4148" strokeWidth="1.3" />
          <path d={`M50 ${f(top - 5.2)} L50 ${f(fy - 12)}`} stroke="#d9dee3" strokeWidth="0.5" />
          {[-1, 1].map((k) => <path key={k} d={`M${f(50 + k * 1.4)} ${f(top - 5)} Q${f(50 + k * rx * 0.85)} ${f(top - 3)} ${f(50 + k * (rx + 2.6))} ${f(fy - 12)}`} stroke="#4a5158" strokeWidth="0.9" fill="none" />)}
          {[-1, 1].map((k) => [0.25, 0.5, 0.75].map((t) => {
            const x = 50 + k * (1.4 + t * (rx + 1.2));
            const y = top - 5 + t * t * (fy - 12 - (top - 5));
            return <circle key={`${k}${t}`} cx={f(x)} cy={f(y + (1 - t) * 2)} r="0.65" fill="#e3c06a" stroke="#4a3412" strokeWidth="0.25" />;
          }))}
          <path d={`M${f(L)} ${f(top + 5)} Q${f(50 - rx * 0.55)} ${f(top - 3.4)} ${f(47.6)} ${f(top - 4.4)}`} stroke="#fff" strokeOpacity="0.7" strokeWidth="0.5" fill="none" strokeLinecap="round" />
          <path d={`M${f(L - 3.9)} ${f(fy - 11.6)} Q50 ${f(fy - 16)} ${f(R + 3.9)} ${f(fy - 11.6)} L${f(R + 3.9)} ${f(fy - 5.4)} Q50 ${f(fy - 9.8)} ${f(L - 3.9)} ${f(fy - 5.4)} Z`} fill="#7d868f" stroke={INK} strokeOpacity="0.8" strokeWidth="0.4" />
          <path d={`M${f(L - 3.4)} ${f(fy - 10.6)} Q50 ${f(fy - 15)} ${f(R + 3.4)} ${f(fy - 10.6)}`} stroke="#cfd5da" strokeWidth="0.32" fill="none" />
          {Array.from({ length: 7 }, (_, i) => {
            const t = i / 6;
            const x = L - 2.4 + t * (rx * 2 + 4.8);
            const y = fy - 8.6 - Math.sin(t * Math.PI) * 4.2;
            return <circle key={i} cx={f(x)} cy={f(y)} r="0.7" fill="#e3c06a" stroke="#4a3412" strokeWidth="0.25" />;
          })}
          <path d={`M48.2 ${f(fy - 9)} L51.8 ${f(fy - 9)} L51.4 ${f(fy + 7.6)} Q50 ${f(fy + 9.4)} 48.6 ${f(fy + 7.6)} Z`} fill={`url(#${uid}hst)`} stroke={INK} strokeOpacity="0.85" strokeWidth="0.36" />
          <path d={`M49.3 ${f(fy - 8)} L49.4 ${f(fy + 6.6)}`} stroke="#fff" strokeOpacity="0.6" strokeWidth="0.3" />
        </g>
      );
    case "bandana":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          <path d={`M${f(R + 1)} ${f(fy - 12)} q5.4 1 7 7.6 l-2.4 0.8 q-1.6 -4.8 -4.6 -6 Z M${f(R + 1.4)} ${f(fy - 10.6)} q2.6 3.6 1.8 9.6 l-2.2 -0.4 q0.6 -5 -1.2 -8 Z`} fill={shade(c, -0.25)} stroke={INK} strokeOpacity="0.7" strokeWidth="0.32" />
          <path d={`M${f(L - 2.4)} ${f(fy - 8)} C${f(L - 3.6)} ${f(top - 11)} ${f(R + 3.6)} ${f(top - 11)} ${f(R + 2.4)} ${f(fy - 8)} Q50 ${f(fy - 14.6)} ${f(L - 2.4)} ${f(fy - 8)} Z`} fill={cl} stroke={INK} strokeOpacity="0.8" strokeWidth="0.5" />
          {/* pieghe del fazzoletto e motivo a gocce */}
          <path d={`M${f(L + 2)} ${f(fy - 11)} q${f(rx * 0.4)} -6 ${f(rx * 0.7)} -12 M${f(R - 2)} ${f(fy - 11)} q${f(-rx * 0.35)} -6 ${f(-rx * 0.5)} -11`} stroke={shade(c, -0.35)} strokeWidth="0.4" fill="none" strokeLinecap="round" />
          {[[-0.6, -3], [-0.2, -6], [0.25, -5], [0.62, -2], [-0.38, 1], [0.05, -0.5], [0.42, 2]].map(([k, d]) => (
            <g key={`${k}${d}`}>
              <circle cx={f(50 + k * rx)} cy={f(top + 4 + d + Math.abs(k) * 4)} r="0.9" fill="#f4f1ea" opacity="0.75" />
              <path d={`M${f(50 + k * rx + 0.6)} ${f(top + 4 + d + Math.abs(k) * 4)} q1.2 0.4 0.8 1.8`} stroke="#f4f1ea" strokeOpacity="0.6" strokeWidth="0.35" fill="none" />
            </g>
          ))}
          {stitch(`M${f(L - 1.4)} ${f(fy - 9)} Q50 ${f(fy - 15.2)} ${f(R + 1.4)} ${f(fy - 9)}`)}
          <path d={`M${f(L + 1)} ${f(top + 5)} Q${f(50 - rx * 0.45)} ${f(top - 2.2)} ${f(50)} ${f(top - 3)}`} stroke="#fff" strokeOpacity="0.25" strokeWidth="0.6" fill="none" strokeLinecap="round" />
        </g>
      );
    case "robin":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          {/* cappello di feltro a punta, con la tesa rialzata davanti e la penna rossa */}
          <path d={`M${f(L - 6)} ${f(fy - 8)} C${f(L)} ${f(top - 10)} 60 ${f(top - 22)} 86 ${f(top - 26)} C74 ${f(top - 10)} ${f(R + 4)} ${f(top - 2)} ${f(R + 6)} ${f(fy - 8)} Z`} fill={cl} stroke={INK} strokeOpacity="0.8" strokeWidth="0.5" />
          <path d={`M${f(L + 4)} ${f(top - 1)} C${f(50)} ${f(top - 12)} 64 ${f(top - 18)} 80 ${f(top - 23)}`} stroke="#fff" strokeOpacity="0.25" strokeWidth="0.55" fill="none" strokeLinecap="round" />
          <path d={`M54 ${f(top - 8)} C64 ${f(top - 14)} 74 ${f(top - 20)} 84 ${f(top - 24)}`} stroke={shade(c, -0.4)} strokeWidth="0.4" fill="none" />
          <path d={`M${f(L - 6.4)} ${f(fy - 8)} Q${f(L + 6)} ${f(fy - 16)} 50 ${f(fy - 12.6)} Q${f(R - 6)} ${f(fy - 16)} ${f(R + 6.4)} ${f(fy - 8)} Q50 ${f(fy - 10.4)} ${f(L - 6.4)} ${f(fy - 8)} Z`} fill={shade(c, -0.2)} stroke={INK} strokeOpacity="0.75" strokeWidth="0.4" />
          <Plume a={[R + 1, fy - 11]} c={[R + 9, top - 2]} b={[R + 5, top - 22]} color="#c4473d" width={2.6} />
          <path d={`M48.4 ${f(fy - 12.8)} L50 ${f(fy - 9.6)} L51.6 ${f(fy - 12.8)}`} stroke={INK} strokeOpacity="0.6" strokeWidth="0.32" fill="none" />
          {stitch(`M${f(L - 4.4)} ${f(fy - 8.8)} Q${f(L + 6)} ${f(fy - 14.4)} 49 ${f(fy - 11.6)} M51 ${f(fy - 11.6)} Q${f(R - 6)} ${f(fy - 14.4)} ${f(R + 4.4)} ${f(fy - 8.8)}`)}
        </g>
      );
    case "tesa":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          {/* tesa larga: il bordo dietro si vede sopra la calotta, quello davanti scende sulla fronte */}
          <path d={`M6 ${f(fy - 11)} C12 ${f(fy - 19)} 30 ${f(fy - 21)} 50 ${f(fy - 21)} C70 ${f(fy - 21)} 88 ${f(fy - 19)} 94 ${f(fy - 11)} C86 ${f(fy - 4.4)} 66 ${f(fy - 3.4)} 50 ${f(fy - 3.4)} C34 ${f(fy - 3.4)} 14 ${f(fy - 4.4)} 6 ${f(fy - 11)} Z`} fill={shade(c, -0.12)} stroke={INK} strokeOpacity="0.85" strokeWidth="0.5" />
          {stitch(`M9 ${f(fy - 10.6)} C16 ${f(fy - 5.8)} 34 ${f(fy - 5)} 50 ${f(fy - 5)} C66 ${f(fy - 5)} 84 ${f(fy - 5.8)} 91 ${f(fy - 10.6)}`)}
          <path d={`M10 ${f(fy - 13)} C24 ${f(fy - 19)} 40 ${f(fy - 19.6)} 52 ${f(fy - 19.6)}`} stroke="#fff" strokeOpacity="0.22" strokeWidth="0.5" fill="none" strokeLinecap="round" />
          <path d={`M${f(L + 1)} ${f(fy - 13)} C${f(L)} ${f(top - 10)} ${f(50 - 6)} ${f(top - 17)} 50 ${f(top - 13)} C${f(50 + 6)} ${f(top - 17)} ${f(R)} ${f(top - 10)} ${f(R - 1)} ${f(fy - 13)} Z`} fill={cl} stroke={INK} strokeOpacity="0.85" strokeWidth="0.5" />
          <path d={`M50 ${f(top - 13)} L50 ${f(top - 4)}`} stroke={shade(c, -0.45)} strokeWidth="0.48" />
          <path d={`M${f(L + 3)} ${f(top - 2)} Q${f(50 - 7)} ${f(top - 13)} 49 ${f(top - 12.6)}`} stroke="#fff" strokeOpacity="0.28" strokeWidth="0.6" fill="none" strokeLinecap="round" />
          {/* fascia di cuoio con fibbia */}
          <path d={`M${f(L + 0.6)} ${f(fy - 18.6)} L${f(R - 0.6)} ${f(fy - 18.6)} L${f(R - 0.4)} ${f(fy - 14.4)} L${f(L + 0.4)} ${f(fy - 14.4)} Z`} fill={shade(c, -0.55)} stroke={INK} strokeOpacity="0.7" strokeWidth="0.32" />
          <rect x={f(R - 7)} y={f(fy - 19.2)} width="3.6" height="5.4" rx="0.5" fill="none" stroke="#c9a24a" strokeWidth="0.5" />
          <path d={`M${f(R - 6.6)} ${f(fy - 18.6)} h2.8`} stroke="#f6e3a1" strokeWidth="0.35" />
          <path d={`M14 ${f(fy - 7.4)} C30 ${f(fy - 2.6)} 70 ${f(fy - 2.6)} 86 ${f(fy - 7.4)}`} stroke="#000" strokeOpacity="0.3" strokeWidth="2.4" fill="none" />
        </g>
      );
    case "cerchietto":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          {/* cerchietto d'oro inciso con le foglie di filigrana e la gemma a goccia sulla fronte */}
          <path d={`M${f(L - 0.4)} ${f(fy - 13.6)} Q50 ${f(fy - 20.4)} ${f(R + 0.4)} ${f(fy - 13.6)}`} stroke="#4a3412" strokeWidth="2.9" fill="none" strokeLinecap="round" />
          <path d={`M${f(L - 0.4)} ${f(fy - 13.6)} Q50 ${f(fy - 20.4)} ${f(R + 0.4)} ${f(fy - 13.6)}`} stroke={`url(#${uid}hau)`} strokeWidth="2.1" fill="none" strokeLinecap="round" />
          <path d={`M${f(L)} ${f(fy - 14.4)} Q50 ${f(fy - 21)} ${f(R)} ${f(fy - 14.4)}`} stroke="#fff6d0" strokeWidth="0.26" fill="none" opacity="0.8" />
          {[-1, 1].map((k) => (
            <g key={k}>
              <path d={`M${f(50 + k * 3)} ${f(fy - 17.4)} q${f(k * 3)} -3.4 ${f(k * 7)} -2.2 q${f(-k * 3)} 2.4 ${f(-k * 7)} 2.2 Z`} fill={`url(#${uid}hau)`} stroke="#4a3412" strokeWidth="0.3" />
              <path d={`M${f(50 + k * 3)} ${f(fy - 17.4)} q${f(k * 3.4)} -1.6 ${f(k * 7)} -2.2`} stroke="#4a3412" strokeWidth="0.25" fill="none" />
            </g>
          ))}
          <path d={`M50 ${f(fy - 25.4)} Q52.6 ${f(fy - 21.4)} 50 ${f(fy - 18)} Q47.4 ${f(fy - 21.4)} 50 ${f(fy - 25.4)} Z`} fill={`url(#${uid}hau)`} stroke="#4a3412" strokeWidth="0.35" />
          <Gem x={50} y={fy - 21.2} w={2.8} h={4.6} color="#22a86a" round />
          <circle cx="50" cy={f(fy - 21.2)} r="4" fill="#5fffb0" opacity="0.12" />
        </g>
      );
    case "cuffia":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          <path d={`M${f(L - 3)} ${f(fy - 6)} C${f(L - 3)} ${f(top - 18)} ${f(R + 3)} ${f(top - 18)} ${f(R + 3)} ${f(fy - 6)} Z`} fill={cl} stroke={INK} strokeOpacity="0.75" strokeWidth="0.5" />
          {/* maglia: file di punti a V che seguono la calotta */}
          {Array.from({ length: 6 }, (_, row) => {
            const y = top - 6.4 + row * 3.6;
            const half = rx + 1 - Math.max(0, 3 - row) * 3.6;
            const n = Math.max(3, Math.round(half / 2.2));
            return Array.from({ length: n * 2 + 1 }, (_, j) => {
              const x = 50 + (j - n) * (half / n);
              return <path key={`${row}-${j}`} d={`M${f(x - 0.9)} ${f(y - 0.8)} L${f(x)} ${f(y + 0.6)} L${f(x + 0.9)} ${f(y - 0.8)}`} stroke={shade(c, -0.32)} strokeWidth="0.26" fill="none" />;
            });
          })}
          <path d={`M${f(L + 1)} ${f(top + 3)} Q${f(50 - 7)} ${f(top - 7)} 50 ${f(top - 7.6)}`} stroke="#fff" strokeOpacity="0.22" strokeWidth="0.8" fill="none" strokeLinecap="round" />
          {/* risvolto a coste */}
          <rect x={f(L - 4)} y={f(fy - 12.4)} width={f(rx * 2 + 8)} height="7.4" rx="2.6" fill={shade(c, -0.16)} stroke={INK} strokeOpacity="0.7" strokeWidth="0.4" />
          {Array.from({ length: 15 }, (_, i) => <path key={i} d={`M${f(L - 2.6 + i * ((rx * 2 + 5.2) / 14))} ${f(fy - 11.6)} v5.8`} stroke={shade(c, -0.38)} strokeWidth="0.32" />)}
          <path d={`M${f(L - 3)} ${f(fy - 11.6)} H${f(R + 3)}`} stroke="#fff" strokeOpacity="0.2" strokeWidth="0.45" />
          {/* pompon soffice */}
          <circle cx="50" cy={f(top - 13.2)} r="5.4" fill={look.trim} stroke={INK} strokeOpacity="0.55" strokeWidth="0.32" />
          {Array.from({ length: 22 }, (_, i) => {
            const a = (i / 22) * Math.PI * 2;
            return <path key={i} d={`M${f(50 + Math.cos(a) * 3.4)} ${f(top - 13.2 + Math.sin(a) * 3.4)} l${f(Math.cos(a) * 2.6)} ${f(Math.sin(a) * 2.6)}`} stroke={shade(look.trim, i % 2 ? 0.3 : -0.25)} strokeWidth="0.36" strokeLinecap="round" />;
          })}
          <circle cx="48.4" cy={f(top - 14.8)} r="1.6" fill="#fff" opacity="0.3" />
        </g>
      );
    case "alloro":
      return (
        <g>
          {/* corona d'alloro: rametti che si incontrano sulla fronte, foglie con la nervatura e bacche */}
          {[-1, 1].map((side) => Array.from({ length: 7 }, (_, i) => {
            const t = (i + 0.5) / 7;
            const a = Math.PI * (0.08 + t * 0.4);
            const x = 50 + side * Math.cos(a) * (rx + 1.4);
            const y = fy - 11 - Math.sin(a) * 9.4;
            const rot = side * (-70 + t * 60);
            const col = i % 2 ? "#6f9a3a" : "#4f7a2a";
            return (
              <g key={`${side}${i}`} transform={`rotate(${f(rot)} ${f(x)} ${f(y)})`}>
                <path d={`M${f(x)} ${f(y - 4)} Q${f(x + 2)} ${f(y)} ${f(x)} ${f(y + 4)} Q${f(x - 2)} ${f(y)} ${f(x)} ${f(y - 4)} Z`} fill={col} stroke="#2a3f14" strokeWidth="0.3" />
                <path d={`M${f(x)} ${f(y - 3.6)} L${f(x)} ${f(y + 3.6)}`} stroke="#b9d27a" strokeWidth="0.3" opacity="0.8" />
                <path d={`M${f(x - 1.2)} ${f(y - 2)} Q${f(x - 0.3)} ${f(y - 1.4)} ${f(x)} ${f(y - 0.6)}`} stroke="#fff" strokeOpacity="0.3" strokeWidth="0.3" fill="none" />
              </g>
            );
          }))}
          {[-1, 1].map((k) => <circle key={k} cx={f(50 + k * 2.2)} cy={f(fy - 20.6)} r="1" fill="#4a2a5a" stroke="#1a0e20" strokeWidth="0.25" />)}
          <circle cx="50" cy={f(fy - 21.6)} r="1.1" fill="#4a2a5a" stroke="#1a0e20" strokeWidth="0.25" />
        </g>
      );
    case "corona": {
      // corona d'oro: cuffia di velluto rosso dentro, punte a giglio con le perle, fascia con perline e gemme
      const bw = rx - 1;
      const y0 = top - 1;
      const tips: [number, number][] = [[50 - bw - 1, 9], [50 - bw * 0.5, 11.5], [50, 15], [50 + bw * 0.5, 11.5], [50 + bw + 1, 9]];
      const d = `M${f(50 - bw)} ${f(y0 + 1)} ` + tips.map(([x, h], i) => `L${f(x)} ${f(y0 - h)}${i < tips.length - 1 ? ` L${f((x + tips[i + 1][0]) / 2)} ${f(y0 - 2)}` : ""}`).join(" ") + ` L${f(50 + bw)} ${f(y0 + 1)} Z`;
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          <path d={`M${f(50 - bw + 1)} ${f(y0)} C${f(50 - bw)} ${f(y0 - 12)} ${f(50 + bw)} ${f(y0 - 12)} ${f(50 + bw - 1)} ${f(y0)} Z`} fill="#7a1424" stroke={INK} strokeOpacity="0.6" strokeWidth="0.26" />
          <path d={`M${f(50 - bw + 3)} ${f(y0 - 3)} Q${f(50 - 3)} ${f(y0 - 10)} 50 ${f(y0 - 10)}`} stroke="#d84a5a" strokeOpacity="0.5" strokeWidth="0.48" fill="none" />
          <path d={d} fill={`url(#${uid}hau)`} stroke={shade(c, -0.55)} strokeWidth="0.4" strokeLinejoin="round" />
          <path d={d} fill="none" stroke={shade(c, 0.55)} strokeWidth="0.35" opacity="0.7" transform="translate(-0.3 -0.3)" />
          {tips.map(([x, h]) => (
            <g key={x}>
              <path d={`M${f(x)} ${f(y0 - h - 1.6)} q1.6 -1.4 0 -3.2 q-1.6 1.8 0 3.2 Z`} fill={`url(#${uid}hau)`} stroke={shade(c, -0.5)} strokeWidth="0.25" />
              <circle cx={f(x)} cy={f(y0 - h)} r="1.6" fill="#fff6dc" stroke={shade(c, -0.4)} strokeWidth="0.35" />
              <circle cx={f(x - 0.5)} cy={f(y0 - h - 0.5)} r="0.5" fill="#fff" />
            </g>
          ))}
          <path d={`M${f(50 - bw - 1.5)} ${f(y0)} Q50 ${f(y0 + 4)} ${f(50 + bw + 1.5)} ${f(y0)} L${f(50 + bw + 1.5)} ${f(y0 + 6)} Q50 ${f(y0 + 10)} ${f(50 - bw - 1.5)} ${f(y0 + 6)} Z`} fill={`url(#${uid}hau)`} stroke={shade(c, -0.55)} strokeWidth="0.4" />
          {Array.from({ length: 13 }, (_, i) => {
            const t = i / 12;
            const x = 50 - bw - 1 + t * (bw * 2 + 2);
            return <circle key={i} cx={f(x)} cy={f(y0 + 0.6 + Math.sin(t * Math.PI) * 3.6)} r="0.45" fill="#fff6dc" opacity="0.9" />;
          })}
          <Gem x={50} y={y0 + 5} w={4.4} h={3.8} color="#c41d3a" />
          <Gem x={50 - bw * 0.58} y={y0 + 4.3} w={2.6} h={2.6} color="#2063c8" round />
          <Gem x={50 + bw * 0.58} y={y0 + 4.3} w={2.6} h={2.6} color="#14905c" round />
        </g>
      );
    }
    default:
      return null;
  }
}

/** La maglia di ferro sotto l'elmo (camaglio): scende sulle spalle, anelli con la luce. */
export function MailCoif({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <pattern id={`${uid}mail`} width="2.6" height="2.2" patternUnits="userSpaceOnUse">
          <rect width="2.6" height="2.2" fill="#5f676f" />
          <circle cx="1.3" cy="1.1" r="0.95" fill="none" stroke="#c4cbd2" strokeWidth="0.28" />
          <circle cx="0" cy="0" r="0.95" fill="none" stroke="#9aa3ad" strokeWidth="0.28" />
          <circle cx="2.6" cy="0" r="0.95" fill="none" stroke="#9aa3ad" strokeWidth="0.28" />
          <circle cx="0" cy="2.2" r="0.95" fill="none" stroke="#9aa3ad" strokeWidth="0.28" />
          <circle cx="2.6" cy="2.2" r="0.95" fill="none" stroke="#9aa3ad" strokeWidth="0.28" />
        </pattern>
        <linearGradient id={`${uid}mailsh`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <path d="M18 100 C16 60 26 22 50 20 C74 22 84 60 82 100 Z" fill={`url(#${uid}mail)`} stroke={INK} strokeOpacity="0.7" strokeWidth="0.45" />
      <path d="M18 100 C16 60 26 22 50 20 C74 22 84 60 82 100 Z" fill={`url(#${uid}mailsh)`} />
    </g>
  );
}

/** Copricapo di profilo (la testa guarda a destra, nelle coordinate della figura). Null per quelli fatti altrove. */
export function SideHat({ look, uid }: { look: AvatarLook; uid: string }): ReactNode {
  const c = look.hatColor;
  const cl = `url(#${uid}hcl)`;
  switch (look.hat) {
    case "berretto":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          <path d="M130 78 C129 61 141 54 153 55 C165 56 172 64 172 73 L131 79 Z" fill={cl} stroke={INK} strokeOpacity="0.8" strokeWidth="0.5" />
          <path d="M151 55.6 Q146 66 144 77 M151 55.6 Q160 64 164 74" stroke={shade(c, -0.38)} strokeWidth="0.45" fill="none" />
          {stitch("M152.4 56.4 Q148 66 146 77", "#f1e4c4", 0.45, 0.4)}
          <path d="M134 66 Q140 57 150 56" stroke="#fff" strokeOpacity="0.28" strokeWidth="0.8" fill="none" strokeLinecap="round" />
          <path d="M131 75 C145 72 160 71 172 71.4 L172 75.6 C160 75.2 145 76.4 131.4 79.4 Z" fill={shade(c, -0.28)} stroke={INK} strokeOpacity="0.6" strokeWidth="0.4" />
          <path d="M168 72 C176 71 185 72 190 75 C186 78 178 78 170 77 Z" fill={shade(c, -0.22)} stroke={INK} strokeOpacity="0.75" strokeWidth="0.5" />
          {stitch("M170 74 C177 73.4 183 74 187 75.4")}
          <path d="M171 77.4 C178 78.4 185 78 189 76" stroke="#000" strokeOpacity="0.3" strokeWidth="0.6" fill="none" />
          <circle cx="151" cy="55.4" r="1.8" fill={shade(c, -0.3)} stroke={INK} strokeWidth="0.26" />
        </g>
      );
    case "fascia":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          <path d="M131 79 q-8 2 -12 12 l3 1 q3 -7 9 -10 Z M131 80 q-6 6 -6 15 l3 0 q0 -8 4 -13 Z" fill={shade(c, -0.25)} stroke={INK} strokeOpacity="0.7" strokeWidth="0.4" />
          <circle cx="131" cy="79.4" r="2.2" fill={shade(c, -0.15)} stroke={INK} strokeOpacity="0.7" strokeWidth="0.32" />
          <path d="M130 76 C142 71 160 70 171 73 L171 79 C160 76 142 77 131 82 Z" fill={cl} stroke={INK} strokeOpacity="0.8" strokeWidth="0.5" />
          <path d="M133 78 l3 -1.6 l3 1.2 l3 -1.8 l3 1.2 l3 -1.8 l3 1 l3 -1.6 l3 1 l3 -1.4 l3 1 l3 -1.2 l3 0.8" stroke={look.trim || "#e3c06a"} strokeWidth="0.4" fill="none" />
          {stitch("M131 77 C142 72.6 160 71.6 170.6 74.4")}
        </g>
      );
    case "piuma":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          <Plume a={[134, 62]} c={[116, 40]} b={[96, 34]} color="#f4efe2" width={4.6} />
          <path d="M126 78 C128 60 142 52 156 54 C166 56 172 64 174 74 C162 72 146 74 126 78 Z" fill={cl} stroke={INK} strokeOpacity="0.8" strokeWidth="0.5" />
          <path d="M132 66 Q140 56 152 55" stroke="#fff" strokeOpacity="0.26" strokeWidth="0.8" fill="none" strokeLinecap="round" />
          <path d="M122 80 C140 74 162 72 182 76" stroke={INK} strokeOpacity="0.6" strokeWidth="3.6" strokeLinecap="round" fill="none" />
          <path d="M122 80 C140 74 162 72 182 76" stroke={shade(c, -0.35)} strokeWidth="3" strokeLinecap="round" fill="none" />
          <circle cx="134" cy="63" r="2.6" fill={`url(#${uid}hau)`} stroke="#5c4316" strokeWidth="0.26" />
          <Gem x={134} y={63} w={2.6} h={2.6} color="#b3123a" round />
        </g>
      );
    case "bandana":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          <path d="M130 80 l-10 6 l4 2 l8 -4 M130 80 l-8 12 l4 0 l6 -9" fill={shade(c, -0.2)} stroke={INK} strokeOpacity="0.6" strokeWidth="0.32" />
          <path d="M129 82 C128 64 139 56 152 56 C165 56 173 64 172 76 C160 73 146 74 129 82 Z" fill={cl} stroke={INK} strokeOpacity="0.75" strokeWidth="0.5" />
          <path d="M136 77 q2 -8 8 -16 M150 74 q0 -8 4 -16" stroke={shade(c, -0.35)} strokeWidth="0.45" fill="none" strokeLinecap="round" />
          {[[134, 66], [146, 61], [158, 62], [164, 68], [140, 72], [154, 69]].map(([x, y]) => (
            <g key={`${x}${y}`}>
              <circle cx={x} cy={y} r="1.1" fill="#f4f1ea" opacity="0.75" />
              <path d={`M${x + 0.7} ${y} q1.3 0.4 0.9 2`} stroke="#f4f1ea" strokeOpacity="0.6" strokeWidth="0.26" fill="none" />
            </g>
          ))}
          {stitch("M130.6 80 C146 74.4 160 73.6 171.4 75.6")}
        </g>
      );
    case "robin":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          <Plume a={[142, 64]} c={[128, 44]} b={[114, 28]} color="#c4473d" width={3} />
          <path d="M128 78 C134 70 160 66 176 72 C170 60 150 50 132 54 C120 56 112 50 104 46 C112 56 118 66 128 78 Z" fill={cl} stroke={INK} strokeOpacity="0.8" strokeWidth="0.6" />
          <path d="M112 52 C122 56 136 52 150 54" stroke="#fff" strokeOpacity="0.24" strokeWidth="0.7" fill="none" strokeLinecap="round" />
          <path d="M127 78.6 C140 72.6 160 70 177 72 L175 67 C160 65 140 68 128 74 Z" fill={shade(c, -0.22)} stroke={INK} strokeOpacity="0.7" strokeWidth="0.45" />
          {stitch("M128.6 76 C141 70.6 160 68.4 175.6 69.6")}
        </g>
      );
    case "tesa":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          {/* tesa di profilo: si alza un poco ai lati, cucita sul bordo; calotta con la piega e la fascia */}
          <path d="M117 74.6 C130 70.4 150 69.6 170 70.4 C180 70.8 186 72 188 73.6 C182 76.6 168 77.6 152 77.8 C138 78 124 77.4 117 74.6 Z" fill={shade(c, -0.15)} stroke={INK} strokeOpacity="0.85" strokeWidth="0.55" />
          {stitch("M120 74.8 C134 76.4 160 76.6 185 73.4")}
          <path d="M122 78 C140 80.4 166 80.4 186 75.6" stroke="#000" strokeOpacity="0.3" strokeWidth="0.9" fill="none" />
          <path d="M133 72 C132 58 139 49 151 49 C156 49 158 52 160 52 C166 52 172 58 171 71 Z" fill={cl} stroke={INK} strokeOpacity="0.85" strokeWidth="0.55" />
          <path d="M150 50 Q153 56 151 64" stroke={shade(c, -0.45)} strokeWidth="0.48" fill="none" />
          <path d="M137 60 Q141 51 150 50" stroke="#fff" strokeOpacity="0.26" strokeWidth="0.8" fill="none" strokeLinecap="round" />
          <path d="M133 66 L171 65 L171 70.6 L133 71.6 Z" fill={shade(c, -0.55)} stroke={INK} strokeOpacity="0.7" strokeWidth="0.4" />
          <rect x="160" y="65.2" width="3.8" height="5.2" rx="0.5" fill="none" stroke="#c9a24a" strokeWidth="0.5" />
        </g>
      );
    case "cerchietto":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          <path d="M130 76 C142 70 160 69 172 72" stroke="#4a3412" strokeWidth="2.7" fill="none" strokeLinecap="round" />
          <path d="M130 76 C142 70 160 69 172 72" stroke={`url(#${uid}hau)`} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M131 75 C142 69.4 160 68.4 171 71" stroke="#fff6d0" strokeWidth="0.3" fill="none" opacity="0.8" />
          <path d="M160 70 q4 -4 8 -2.4 q-4 2.6 -8 2.4 Z" fill={`url(#${uid}hau)`} stroke="#4a3412" strokeWidth="0.3" />
          <path d="M171.4 71.4 Q174 67 171.6 63 Q169 67 171.4 71.4 Z" fill={`url(#${uid}hau)`} stroke="#4a3412" strokeWidth="0.35" />
          <Gem x={171.5} y={67.4} w={2.4} h={4} color="#22a86a" round />
        </g>
      );
    case "alloro":
      return (
        <g>
          <path d="M129 76 C142 70 160 69 172 72" stroke="#5a7a2e" strokeWidth="0.7" fill="none" />
          {Array.from({ length: 9 }, (_, i) => {
            const x = 131 + i * 4.8;
            const y = 75 - Math.sin((i / 8) * Math.PI) * 4;
            return (
              <g key={i}>
                {[[-30, -3, 0], [35, 2.6, 1.5]].map(([r, dy, dx], k) => (
                  <g key={k} transform={`rotate(${r} ${x + dx} ${y + dy})`}>
                    <path d={`M${x + dx} ${y + dy - 3.6} Q${x + dx + 1.8} ${y + dy} ${x + dx} ${y + dy + 3.6} Q${x + dx - 1.8} ${y + dy} ${x + dx} ${y + dy - 3.6} Z`} fill={(i + k) % 2 ? "#6f9a3a" : "#4f7a2a"} stroke="#2a3f14" strokeWidth="0.3" />
                    <path d={`M${x + dx} ${y + dy - 3.2} V${y + dy + 3.2}`} stroke="#b9d27a" strokeWidth="0.3" opacity="0.8" />
                  </g>
                ))}
              </g>
            );
          })}
          <circle cx="172" cy="70" r="1" fill="#4a2a5a" />
        </g>
      );
    case "corona": {
      const yAt = (x: number) => 66 - (x - 133) * (4 / 38);
      const tips = [134, 143, 152, 161, 170];
      const hs = [9, 11.5, 14, 11.5, 9];
      const pts = tips.flatMap((x, i) => {
        const tip = `L${x} ${(yAt(x) - hs[i]).toFixed(1)}`;
        const nx = tips[i + 1];
        return nx ? [tip, `L${((x + nx) / 2).toFixed(1)} ${(yAt((x + nx) / 2) - 2.5).toFixed(1)}`] : [tip];
      });
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          <path d="M135 66 C136 54 166 50 170 62 Z" fill="#7a1424" stroke={INK} strokeOpacity="0.6" strokeWidth="0.26" />
          <path d={`M133 ${yAt(133) + 1} ${pts.join(" ")} L171 ${yAt(171) + 1} Z`} fill={`url(#${uid}hau)`} stroke={shade(c, -0.55)} strokeWidth="0.5" strokeLinejoin="round" />
          <path d={`M133 ${yAt(133) + 1} ${pts.join(" ")}`} stroke={shade(c, 0.55)} strokeWidth="0.32" fill="none" opacity="0.8" />
          {tips.map((x, i) => (
            <g key={x}>
              <path d={`M${x} ${yAt(x) - hs[i] - 1.6} q1.6 -1.4 0 -3.2 q-1.6 1.8 0 3.2 Z`} fill={`url(#${uid}hau)`} stroke={shade(c, -0.5)} strokeWidth="0.25" />
              <circle cx={x} cy={yAt(x) - hs[i]} r="1.7" fill="#fff6dc" stroke={shade(c, -0.35)} strokeWidth="0.32" />
            </g>
          ))}
          <path d="M132 66 L172 61.6 L172 69 L132 73.6 Z" fill={`url(#${uid}hau)`} stroke={shade(c, -0.55)} strokeWidth="0.5" />
          {Array.from({ length: 11 }, (_, i) => <circle key={i} cx={133 + i * 3.8} cy={66.6 - i * 0.44} r="0.45" fill="#fff6dc" opacity="0.9" />)}
          <Gem x={152} y={66.8} w={4.4} h={3.8} color="#c41d3a" />
          <Gem x={141} y={68} w={2.6} h={2.6} color="#2063c8" round />
          <Gem x={163} y={65.6} w={2.6} h={2.6} color="#14905c" round />
        </g>
      );
    }
    case "cuffia":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          <path d="M127 82 C125 60 138 49 152 49 C166 49 175 59 174 76 Z" fill={cl} stroke={INK} strokeOpacity="0.75" strokeWidth="0.55" />
          {Array.from({ length: 6 }, (_, row) => Array.from({ length: 9 }, (_, j) => {
            const x = 131 + j * 5;
            const y = 56 + row * 4 + Math.abs(j - 4) * 0.6;
            return y < 78 && x < 172 ? <path key={`${row}${j}`} d={`M${x - 1} ${y - 0.8} L${x} ${y + 0.7} L${x + 1} ${y - 0.8}`} stroke={shade(c, -0.32)} strokeWidth="0.3" fill="none" /> : null;
          }))}
          <path d="M134 62 Q140 52 152 51" stroke="#fff" strokeOpacity="0.22" strokeWidth="0.9" fill="none" strokeLinecap="round" />
          <path d="M126 80 C140 74 160 72 175 75 L175 82 C160 79 140 81 127 87 Z" fill={shade(c, -0.18)} stroke={INK} strokeOpacity="0.7" strokeWidth="0.48" />
          {Array.from({ length: 13 }, (_, i) => <path key={i} d={`M${128 + i * 3.8} ${79.4 - i * 0.5} l0.4 6`} stroke={shade(c, -0.4)} strokeWidth="0.36" />)}
          <circle cx="150" cy="45" r="6" fill={look.trim} stroke={INK} strokeOpacity="0.55" strokeWidth="0.32" />
          {Array.from({ length: 22 }, (_, i) => {
            const a = (i / 22) * Math.PI * 2;
            return <path key={i} d={`M${150 + Math.cos(a) * 3.8} ${45 + Math.sin(a) * 3.8} l${Math.cos(a) * 2.8} ${Math.sin(a) * 2.8}`} stroke={shade(look.trim, i % 2 ? 0.3 : -0.25)} strokeWidth="0.4" strokeLinecap="round" />;
          })}
        </g>
      );
    case "elmo":
      return (
        <g>
          <HatDefs uid={uid} c={c} />
          {/* camaglio di maglia che scende sul collo, calotta con cresta, fascia ribattuta, nasale */}
          <path d="M128 82 C124 92 126 104 132 112 L150 114 L148 98 C140 96 134 90 132 82 Z" fill="#6a727a" stroke={INK} strokeOpacity="0.7" strokeWidth="0.5" />
          {Array.from({ length: 6 }, (_, r) => Array.from({ length: 5 }, (_, k) => <circle key={`${r}${k}`} cx={130 + k * 3.6 + (r % 2) * 1.8} cy={88 + r * 4} r="1.2" fill="none" stroke="#c4cbd2" strokeWidth="0.3" />))}
          <path d="M128 84 C126 62 138 52 152 52 C166 52 176 62 175 80 L128 84 Z" fill={`url(#${uid}hst)`} stroke={INK} strokeOpacity="0.85" strokeWidth="0.55" />
          <path d="M132 76 C131 60 141 52.6 152 52.6 C163 52.6 172 60 173 76" stroke="#3a4148" strokeWidth="1.1" fill="none" />
          <path d="M132 76 C131 60 141 52.6 152 52.6 C163 52.6 172 60 173 76" stroke="#d9dee3" strokeWidth="0.5" fill="none" />
          <path d="M136 64 Q142 55 152 54" stroke="#fff" strokeOpacity="0.7" strokeWidth="0.65" fill="none" strokeLinecap="round" />
          <path d="M128 84 L175 80 L175 75 L128.4 78.6 Z" fill="#7d868f" stroke={INK} strokeOpacity="0.8" strokeWidth="0.45" />
          {[132, 139, 146, 153, 160, 167, 173].map((x, i) => <circle key={x} cx={x} cy={81.2 - i * 0.58} r="0.75" fill="#e3c06a" stroke="#4a3412" strokeWidth="0.25" />)}
          <path d="M168 80 L170 98 L174 98 L173 80 Z" fill={`url(#${uid}hst)`} stroke={INK} strokeOpacity="0.8" strokeWidth="0.4" />
          <path d="M170 81 L171.4 96" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.32" />
        </g>
      );
    default:
      return null;
  }
}
