import { useId } from "react";
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

/** Scudo con l'arciere dentro (vittoria per il primo, fiero per gli altri). */
function Shield({ row, place, look }: { row: PodiumRow; place: 1 | 2 | 3; look: AvatarLook }) {
  const uid = (useId().replace(/[^a-zA-Z0-9]/g, "") + "_");
  const m = METALS[place];
  const big = place === 1;
  const shield = "M0.5 0.02 L0.97 0.09 L0.97 0.64 C0.97 0.8 0.76 0.93 0.5 1 C0.24 0.93 0.03 0.8 0.03 0.64 L0.03 0.09 Z";
  return (
    <Link to="/arciere/$id" params={{ id: String(row.id) }} className={`aa-pop relative block ${big ? "z-10 -mx-2 w-[38%]" : "w-[31%] translate-y-5"}`} style={{ animationDelay: `${0.25 + (3 - place) * 0.15}s` }}>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <clipPath id={`${uid}s`} clipPathUnits="objectBoundingBox"><path d={shield} /></clipPath>
          <linearGradient id={`${uid}m`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={m.a} />
            <stop offset="0.5" stopColor={m.b} />
            <stop offset="1" stopColor={m.c} />
          </linearGradient>
        </defs>
      </svg>
      <div className="relative aspect-[100/128] w-full drop-shadow-[0_14px_18px_rgba(0,0,0,0.55)]">
        <div className="absolute inset-0" style={{ clipPath: `url(#${uid}s)`, background: `linear-gradient(135deg, ${m.a}, ${m.b} 50%, ${m.c})` }} />
        <div className="absolute inset-[4%]" style={{ clipPath: `url(#${uid}s)` }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(120% 80% at 50% 10%, ${look.shirt}aa, #0d1b17 75%)` }} />
          {/* ragazzi e arcieri bassi: la figura si ingrandisce attorno ai piedi, così testa e busto stanno al centro come per gli altri */}
          <div className="absolute" style={frame(look)}>
            <ArcherAvatar look={look} pose={big ? "vittoria" : "fiero"} still interactive={false} className="h-auto w-full" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
          <div className="absolute inset-x-[8%] bottom-[16%] text-center">
            <p className="truncate font-display text-[1.05rem] uppercase leading-none tracking-wide text-white">{row.name}</p>
            <p className="mt-0.5 truncate text-[0.62rem] font-semibold text-white/75">{row.mark}</p>
          </div>
        </div>
        <span className="absolute bottom-[-2%] left-1/2 grid h-7 min-w-11 -translate-x-1/2 place-items-center rounded-full px-2 font-display text-base shadow" style={{ background: `linear-gradient(180deg, ${m.a}, ${m.b})`, color: m.text }}>{m.label}</span>
      </div>
      {big ? (
        <>
          <Sparkle size={12} className="aa-twinkle absolute -left-1 top-6" />
          <Sparkle size={9} className="aa-twinkle absolute -right-1 top-12" style={{ animationDelay: "0.8s" }} />
        </>
      ) : null}
    </Link>
  );
}

/** Podio a scudi con l'avatar di ciascuno, in posa. */
export function Podium({ title, rows, looks }: { title: string; rows: PodiumRow[]; looks: Record<string, AvatarLook> }) {
  const slots: [PodiumRow | undefined, 1 | 2 | 3][] = [[rows[1], 2], [rows[0], 1], [rows[2], 3]];
  return (
    <Card className="relative overflow-hidden bg-[radial-gradient(120%_70%_at_50%_0%,rgba(43,140,120,0.35),transparent_70%)]">
      {rows[0] ? <Confetti count={18} /> : null}
      <h2 className="relative mb-3 font-display text-2xl uppercase tracking-wide">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted">Nessuno con un risultato, per ora.</p> : (
        <div className="relative flex items-start justify-center pb-6">
          {slots.map(([row, place]) => (row ? <Shield key={row.userId} row={row} place={place} look={looks[row.userId] ?? AVATAR_DEFAULT} /> : <div key={place} className="w-[31%]" />))}
        </div>
      )}
    </Card>
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
