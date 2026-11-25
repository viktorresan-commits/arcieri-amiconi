import { useId, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AVATAR_DEFAULT, figureScale, type AvatarLook } from "@/lib/arcieri/avatar";
import { ArcherAvatar, AvatarFace } from "./archer-avatar";
import { Confetti, Sparkle } from "./celebrate";
import { Card } from "./kit";

export type PodiumRow = { id: number; userId: string; name: string; mark: string };

const METALS = {
  1: { a: "#fff3b8", b: "#e2b340", c: "#8a6216", text: "#3a2604", label: "1°" },
  2: { a: "#ffffff", b: "#c9d2db", c: "#6f7b87", text: "#1d2430", label: "2°" },
  3: { a: "#f6c08c", b: "#c4844a", c: "#6e4019", text: "#2e1606", label: "3°" },
} as const;

/** riquadro dell'arciere nello scudo: per un adulto medio a sinistra -22%, in alto -12%, largo 192% */
function frame(look: AvatarLook) {
  const k = Math.max(0.85, Math.min(1.35, 1 / figureScale(look)));
  // il punto dei piedi (150, 342 nel disegno) resta fermo: 110/300 della larghezza, 342/300 in altezza
  return { left: `${(-22 - 70.4 * (k - 1)).toFixed(2)}%`, top: `${(-12 - 171 * (k - 1)).toFixed(2)}%`, width: `${(192 * k).toFixed(2)}%` };
}

type Place = 1 | 2 | 3;

/** Corona d'alloro attorno allo scudo: due rami di foglie nel metallo del posto. */
export function Laurel({ place, className = "" }: { place: Place; className?: string }) {
  const uid = (useId().replace(/[^a-zA-Z0-9]/g, "") + "_");
  const m = METALS[place];
  const leaves: { x: number; y: number; r: number; s: number }[] = [];
  for (const side of [-1, 1]) {
    const n = 9;
    for (let i = 0; i < n; i += 1) {
      const t = i / (n - 1);
      // dal fondo (nastro) su lungo il fianco: angolo da 98° a 228° (sinistra), specchiato a destra
      const deg = side < 0 ? 98 + t * 130 : 82 - t * 130;
      const a = (deg * Math.PI) / 180;
      const R = 45;
      const x = 50 + Math.cos(a) * R;
      const y = 54 + Math.sin(a) * R;
      // tangente al ramo, verso la cima; le foglie si alternano dentro e fuori
      const tan = deg + (side < 0 ? 90 : -90);
      const out = i % 2 ? 38 : -38;
      leaves.push({ x, y, r: tan + out * side, s: 1 - t * 0.35 });
    }
  }
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${uid}l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.a} />
          <stop offset="0.55" stopColor={m.b} />
          <stop offset="1" stopColor={m.c} />
        </linearGradient>
      </defs>
      <path d="M50 99 C22 97 4 76 6 46 M50 99 C78 97 96 76 94 46" fill="none" stroke={m.c} strokeWidth="1.6" strokeLinecap="round" />
      {leaves.map((l, i) => (
        <g key={i} transform={`translate(${l.x.toFixed(2)} ${l.y.toFixed(2)}) rotate(${l.r.toFixed(1)}) scale(${l.s.toFixed(2)})`}>
          <path d="M0 0 C3 -4.2 10 -4.4 14 0 C10 4.4 3 4.2 0 0 Z" fill={`url(#${uid}l)`} stroke={m.c} strokeWidth="0.6" />
          <path d="M1 0 L12 0" stroke={m.c} strokeWidth="0.45" opacity="0.7" />
        </g>
      ))}
      {/* nastro che lega i due rami */}
      <path d="M43 95 L50 99 L57 95 L60 101 L50 98.5 L40 101 Z" fill={place === 1 ? "#b3262c" : place === 2 ? "#2f5d9a" : "#2e7a4f"} />
    </svg>
  );
}

/** Coppa d'oro sopra il primo posto */
export function Cup({ className = "" }: { className?: string }) {
  const uid = (useId().replace(/[^a-zA-Z0-9]/g, "") + "_");
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset="0.45" stopColor="#f0c24c" />
          <stop offset="1" stopColor="#8a5a12" />
        </linearGradient>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* manici */}
      <path d="M16 13 C4 13 4 31 20 33" fill="none" stroke="#6b440c" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M48 13 C60 13 60 31 44 33" fill="none" stroke="#6b440c" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M16 13 C4 13 4 31 20 33" fill="none" stroke={`url(#${uid}g)`} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M48 13 C60 13 60 31 44 33" fill="none" stroke={`url(#${uid}g)`} strokeWidth="3.4" strokeLinecap="round" />
      {/* coppa, gambo e base */}
      <path d="M14 8 L50 8 C50 26 44 36 32 39 C20 36 14 26 14 8 Z" fill={`url(#${uid}g)`} stroke="#6b440c" strokeWidth="1.4" />
      <path d="M28 39 L36 39 L35 47 L29 47 Z" fill={`url(#${uid}g)`} stroke="#6b440c" strokeWidth="1.2" />
      <path d="M20 54 C20 48 44 48 44 54 L46 58 L18 58 Z" fill={`url(#${uid}g)`} stroke="#6b440c" strokeWidth="1.4" />
      <rect x="23" y="51" width="18" height="3.2" rx="1" fill="#6b440c" opacity="0.55" />
      {/* stella sbalzata e riflesso */}
      <path d="M32 14 L34.4 19.6 L40.4 20 L35.8 23.8 L37.3 29.6 L32 26.4 L26.7 29.6 L28.2 23.8 L23.6 20 L29.6 19.6 Z" fill="#fff3b8" stroke="#8a5a12" strokeWidth="0.9" />
      <path d="M18 10 L24 10 C24 22 27 30 30 35 C22 31 18 22 18 10 Z" fill={`url(#${uid}s)`} opacity="0.65" />
      <ellipse cx="32" cy="8" rx="18" ry="2.4" fill="#fff6c8" opacity="0.55" />
    </svg>
  );
}

/** gradino del podio: piano di marmo con il bordo nel metallo e il numero inciso */
function Step({ place }: { place: Place }) {
  const m = METALS[place];
  const h = place === 1 ? "h-16" : place === 2 ? "h-11" : "h-8";
  return (
    <div className={`relative w-full ${h}`}>
      <div className="absolute inset-x-0 top-0 h-2 rounded-t-md" style={{ background: `linear-gradient(90deg, ${m.c}, ${m.a} 45%, ${m.b} 70%, ${m.c})` }} />
      <div className="absolute inset-x-0 bottom-0 top-2 grid place-items-center rounded-b-md border-x border-b border-white/10" style={{ background: "linear-gradient(180deg, #2c3a35, #18221f 70%, #111915)" }}>
        <span className="font-display leading-none" style={{ fontSize: place === 1 ? "2rem" : "1.5rem", color: m.b, textShadow: `0 1px 0 ${m.c}, 0 0 12px ${m.b}55` }}>{place}</span>
      </div>
    </div>
  );
}

/** raggi di luce che girano lenti dietro al primo */
function Glory() {
  return (
    <div aria-hidden className="aa-glory pointer-events-none absolute left-1/2 top-[-22%] aspect-square w-[200%] -translate-x-1/2 rounded-full" />
  );
}

type Slot = { key: string; place: Place; art: ReactNode; to?: { id: number }; /** l'alloro lo disegna già l'arte (attorno allo stemma) */ ownWreath?: boolean };

/**
 * Podio epico: tre colonne (secondo, primo, terzo) con la corona d'alloro, la coppa sul primo,
 * i raggi di luce dietro e i gradini di marmo. `art` è lo scudo con l'arciere o lo stemma della compagnia.
 */
function Stage({ slots }: { slots: Slot[] }) {
  const at = (p: Place) => slots.find((x) => x.place === p);
  return (
    <div className="relative flex items-end justify-center gap-1 pb-1 pt-14">
      {([2, 1, 3] as Place[]).map((p) => {
        const s = at(p);
        const big = p === 1;
        const width = big ? "w-[37%]" : "w-[30%]";
        if (!s) return <div key={p} className={width} />;
        const body = (
          <div className="relative">
            {big ? <Glory /> : null}
            {big ? (
              <>
                <span aria-hidden className="pointer-events-none absolute -top-12 left-1/2 z-10 aspect-square w-[60%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,214,110,0.55),transparent_65%)] blur-md" />
                <Cup className="aa-cup absolute -top-14 left-1/2 z-20 w-[44%] -translate-x-1/2 drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]" />
                <Sparkle size={10} className="aa-twinkle absolute -top-12 left-[14%] z-20" />
                <Sparkle size={8} className="aa-twinkle absolute -top-5 right-[16%] z-20" style={{ animationDelay: "1.1s" }} />
              </>
            ) : null}
            {s.ownWreath ? null : <Laurel place={p} className="pointer-events-none absolute -inset-x-[11%] -bottom-[6%] z-0 h-auto w-[122%]" />}
            <div className="relative z-10">{s.art}</div>
          </div>
        );
        return (
          <div key={s.key} className={`aa-pop relative grid ${width} ${big ? "z-10" : ""}`} style={{ animationDelay: `${0.25 + (3 - p) * 0.15}s` }}>
            {s.to ? <Link to="/arciere/$id" params={{ id: String(s.to.id) }} className="block">{body}</Link> : body}
            <div className="mt-2"><Step place={p} /></div>
          </div>
        );
      })}
    </div>
  );
}

/** dove l'arciere può uscire dallo scudo: tutto sopra e ai lati in alto, il fondo dello scudo in basso */
const ESCAPE = "polygon(-45% -70%, 145% -70%, 145% 40%, 97% 62%, 96% 70%, 90% 80%, 78% 89%, 64% 95.5%, 50% 100%, 36% 95.5%, 22% 89%, 10% 80%, 4% 70%, 3% 62%, -45% 40%)";

/** «172 pt campionato» → 172 sopra, «pt camp.» sotto; «media gara 7,20» → 7,20 sopra, «media gara» sotto */
function splitMark(mark: string) {
  const first = /^([\d.,]+)\s+(.+)$/.exec(mark.trim());
  if (first) return { value: first[1], unit: first[2].replace(/campionato/i, "camp.") };
  const last = /^(.*?)\s+([\d.,]+)$/.exec(mark.trim());
  if (last) return { value: last[2], unit: last[1] };
  return { value: mark, unit: "" };
}

/** Scudo con l'arciere dentro (vittoria per il primo, fiero per gli altri), nome e valore in basso. */
function Shield({ row, place, look }: { row: PodiumRow; place: Place; look: AvatarLook }) {
  const uid = (useId().replace(/[^a-zA-Z0-9]/g, "") + "_");
  const m = METALS[place];
  const big = place === 1;
  const shield = "M0.5 0.02 L0.97 0.09 L0.97 0.64 C0.97 0.8 0.76 0.93 0.5 1 C0.24 0.93 0.03 0.8 0.03 0.64 L0.03 0.09 Z";
  return (
    <div className="relative aspect-[100/128] w-full drop-shadow-[0_14px_18px_rgba(0,0,0,0.55)]">
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <clipPath id={`${uid}s`} clipPathUnits="objectBoundingBox"><path d={shield} /></clipPath>
        </defs>
      </svg>
      <div className="absolute inset-0" style={{ clipPath: `url(#${uid}s)`, background: `linear-gradient(135deg, ${m.a}, ${m.b} 50%, ${m.c})` }} />
      <div className="absolute inset-[4%]" style={{ clipPath: `url(#${uid}s)` }}>
        <div className="absolute inset-0" style={{ background: `radial-gradient(120% 80% at 50% 10%, ${look.shirt}aa, #0d1b17 75%)` }} />
      </div>
      {/* l'arciere: in basso resta dentro lo scudo, in alto e ai lati ne esce (arco, braccia, testa) */}
      <div className="pointer-events-none absolute inset-[4%]" style={{ clipPath: ESCAPE }}>
        {/* ragazzi e arcieri bassi: la figura si ingrandisce attorno ai piedi, così testa e busto stanno al centro come per gli altri */}
        <div className={big ? "aa-podium-cheer absolute" : "aa-podium-sway absolute"} style={{ ...frame(look), animationDelay: `${place * -1.3}s` }}>
          <ArcherAvatar look={look} pose={big ? "vittoria" : "fiero"} interactive={false} className="h-auto w-full" />
        </div>
      </div>
      <div className="absolute inset-[4%]" style={{ clipPath: `url(#${uid}s)` }}>
        <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
        <div className="absolute inset-x-[8%] bottom-[9%] text-center">
          <p className="truncate font-display text-[1.05rem] uppercase leading-none tracking-wide text-white">{row.name}</p>
          {(() => {
            const { value, unit } = splitMark(row.mark);
            return (
              <p className="mt-0.5 leading-none text-white">
                <b className="block font-display text-[1.05rem] tabular-nums">{value}</b>
                {unit ? <span className="block text-[0.56rem] font-semibold uppercase tracking-wider text-white/75">{unit}</span> : null}
              </p>
            );
          })()}
        </div>
      </div>
      {big ? (
        <>
          <Sparkle size={12} className="aa-twinkle absolute -left-1 top-6" />
          <Sparkle size={9} className="aa-twinkle absolute -right-1 top-12" style={{ animationDelay: "0.8s" }} />
        </>
      ) : null}
    </div>
  );
}

/** Podio degli arcieri: scudi con l'avatar di ciascuno, in posa, sul podio con alloro e coppa. */
export function Podium({ title, rows, looks }: { title: string; rows: PodiumRow[]; looks: Record<string, AvatarLook> }) {
  const slots: Slot[] = rows.slice(0, 3).map((row, i) => ({ key: row.userId, place: (i + 1) as Place, to: { id: row.id }, art: <Shield row={row} place={(i + 1) as Place} look={looks[row.userId] ?? AVATAR_DEFAULT} /> }));
  return (
    <Card className="relative overflow-hidden bg-[radial-gradient(120%_70%_at_50%_0%,rgba(224,177,90,0.22),transparent_70%)]">
      {rows[0] ? <Confetti count={22} /> : null}
      <h2 className="relative mb-1 font-display text-2xl uppercase tracking-wide">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted">Nessuno con un risultato, per ora.</p> : <Stage slots={slots} />}
    </Card>
  );
}

export type CrestPodiumRow = { key: string; name: string; mark: string; logo: string | null; color: string };

/** Medaglione con lo stemma della compagnia, nome e valore */
function CrestMedal({ row, place }: { row: CrestPodiumRow; place: Place }) {
  const m = METALS[place];
  return (
    <div className="grid justify-items-center text-center">
      <div className="relative w-[86%]">
        <Laurel place={place} className="pointer-events-none absolute -inset-x-[16%] -bottom-[14%] z-0 h-auto w-[132%]" />
        <div className="relative z-10 aspect-square w-full rounded-full p-[5%] shadow-[0_14px_18px_rgba(0,0,0,0.55)]" style={{ background: `linear-gradient(135deg, ${m.a}, ${m.b} 50%, ${m.c})` }}>
          <div className="grid h-full w-full place-items-center rounded-full" style={{ background: `radial-gradient(circle at 50% 30%, ${row.color}66, #0d1b17 75%)` }}>
            {row.logo ? <img src={row.logo} alt="" className="h-[74%] w-[74%] object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]" /> : <span className="font-display text-3xl text-white">{row.name.slice(0, 1)}</span>}
          </div>
        </div>
      </div>
      <p className="relative z-10 mt-3 line-clamp-2 w-full font-display text-[0.86rem] uppercase leading-tight tracking-wide text-white">{row.name}</p>
      {(() => {
        const { value, unit } = splitMark(row.mark);
        return (
          <p className="leading-none text-white">
            <b className="block font-display text-[1rem] tabular-nums">{value}</b>
            {unit ? <span className="block text-[0.54rem] font-semibold uppercase tracking-wider text-white/70">{unit}</span> : null}
          </p>
        );
      })()}
    </div>
  );
}

/** Podio delle compagnie: i loro stemmi sul podio con alloro e coppa */
export function CrestPodium({ rows }: { rows: CrestPodiumRow[] }) {
  if (!rows.length) return null;
  const slots: Slot[] = rows.slice(0, 3).map((row, i) => ({ key: row.key, place: (i + 1) as Place, ownWreath: true, art: <CrestMedal row={row} place={(i + 1) as Place} /> }));
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(120%_80%_at_50%_0%,rgba(224,177,90,0.2),transparent_70%)] px-1">
      <Confetti count={14} />
      <Stage slots={slots} />
    </div>
  );
}

/** Riga di classifica con volto, posizione e valore. */
export function RankRow({ pos, name, sub, value, look, me = false }: { pos: number; name: string; sub?: string; value: string; look: AvatarLook; me?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${me ? "bg-[linear-gradient(90deg,#6d4fd6,#8b6cf0)] text-white shadow-[0_10px_24px_-10px_rgba(109,79,214,0.8)]" : "bg-white/[0.04]"}`}>
      <span className="w-8 shrink-0 font-display text-2xl tabular-nums">{pos}</span>
      <span className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full ${me ? "ring-2 ring-white/80" : "ring-1 ring-white/15"}`}>
        <AvatarFace look={look} className="h-10 w-10" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{me ? "Tu" : name}{me ? <span className="ml-1.5 text-xs font-normal opacity-80">{name}</span> : null}</p>
        {sub ? <p className={`truncate text-xs ${me ? "text-white/80" : "text-muted"}`}>{sub}</p> : null}
      </div>
      <p className="shrink-0 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}
