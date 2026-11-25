import { useEffect, useState, type ReactNode } from "react";
import type { AvatarLook } from "@/lib/arcieri/avatar";
import { Avatar } from "./kit";

export type RankRow = {
  id: string;
  name: string;
  value: number;
  /** testo mostrato al posto del valore (es. "8,4 media") */
  label?: string;
  sub?: string;
  color?: string;
  photo?: string | null;
  look?: AvatarLook | null;
  logo?: string | null;
  /** disegno al posto del volto (es. lo stemma di una compagnia senza immagine) */
  badge?: ReactNode;
  me?: boolean;
};

const MEDAL = ["#f2c14e", "#c9d1d9", "#d08a4e"];

/**
 * Classifica a barre orizzontali: volto o stemma, nome, barra sfumata che cresce
 * all'apertura e valore. I primi tre hanno la medaglia; la riga dell'utente è evidenziata.
 */
export function RankBars({ rows, unit = "", tint = "var(--color-primary)", limit = 8, empty = "Ancora nessun dato.", icon }: { rows: RankRow[]; unit?: string; tint?: string; limit?: number; empty?: string; icon?: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = window.requestAnimationFrame(() => setOn(true));
    return () => window.cancelAnimationFrame(t);
  }, []);
  const list = rows.filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  if (!list.length) return <p className="text-sm text-muted">{empty}</p>;
  const shown = list.slice(0, limit);
  const mine = list.findIndex((row) => row.me);
  if (mine >= limit) shown.push(list[mine]);
  const top = shown[0]?.value || 1;
  return (
    <ol className="grid gap-2">
      {shown.map((row) => {
        const rank = list.indexOf(row);
        const pct = Math.max(6, (row.value / top) * 100);
        const color = row.color || tint;
        return (
          <li key={row.id} className={`aa-rank-row flex items-center gap-2.5 rounded-2xl px-2 py-1.5 ${row.me ? "bg-white/[0.07] ring-1 ring-white/15" : ""}`}>
            <span className="relative grid h-6 w-6 shrink-0 place-items-center rounded-full font-display text-[0.8rem] tabular-nums" style={rank < 3 ? { background: MEDAL[rank], color: "#1b1405" } : { background: "rgba(255,255,255,0.07)" }}>
              {rank + 1}
            </span>
            {row.badge ? (
              <span className="h-9 w-9 shrink-0">{row.badge}</span>
            ) : row.logo ? (
              <img src={row.logo} alt="" className="h-9 w-9 shrink-0 object-contain" />
            ) : (
              <Avatar size="sm" label={row.name} color={row.color || "#3d8a4e"} photo={row.photo} look={row.look} userId={row.id} className="h-9 w-9 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">{row.name}</span>
                <span className="shrink-0 font-display text-base tabular-nums">{row.label ?? `${row.value.toLocaleString("it-IT")}${unit ? ` ${unit}` : ""}`}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: on ? `${pct}%` : "0%",
                    background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})`,
                    boxShadow: `0 0 12px color-mix(in srgb, ${color} 45%, transparent)`,
                    transition: `width 0.9s cubic-bezier(.22,1,.36,1) ${Math.min(rank, 8) * 60}ms`,
                  }}
                />
              </div>
              {row.sub ? <p className="mt-0.5 truncate text-[0.68rem] text-muted">{row.sub}</p> : null}
            </div>
            {icon}
          </li>
        );
      })}
    </ol>
  );
}
