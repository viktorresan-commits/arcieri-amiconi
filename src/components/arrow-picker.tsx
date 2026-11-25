import { useEffect, useState } from "react";
import { tagsOf } from "@/lib/arcieri/arrow-tags";
import { parseRace } from "@/lib/arcieri/arrow-spec";
import { lookOf, type ArrowLook } from "./target-3d";

/** Una serie di frecce: la scheda "freccia" dell'attrezzatura (numeri e colori delle penne). */
export type ArrowSet = { id: number; name: string; specs: string };

const LAST = "aa-arrow-set";

/** Ultima serie usata (resta sul telefono): la prossima freccia parte da lì. */
export function lastArrowSet(sets: ArrowSet[], fallback: number | null = null) {
  if (typeof localStorage !== "undefined") {
    const v = Number(localStorage.getItem(LAST));
    if (sets.some((s) => s.id === v)) return v;
  }
  if (fallback != null && sets.some((s) => s.id === fallback)) return fallback;
  return sets[0]?.id ?? null;
}

export function rememberArrowSet(id: number | null) {
  try {
    if (id != null) localStorage.setItem(LAST, String(id));
  } catch {
    /* memoria non disponibile */
  }
}

/** Pallino con i colori della serie: penna, penna guida e cocca. */
export function SetSwatch({ specs, size = 22 }: { specs: string; size?: number }) {
  const look: Partial<ArrowLook> = lookOf(specs) ?? {};
  const fletch = look.fletch || "#d63a2f";
  const cock = look.cock || fletch;
  const nock = look.nock || "#f4f1ea";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {[0, 120, 240].map((a) => (
        <path key={a} d="M12 12 L12 2.5 Q16 5 15 11 Z" fill={a === 0 ? cock : fletch} transform={`rotate(${a} 12 12)`} stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
      ))}
      <circle cx="12" cy="12" r="3.6" fill={nock} stroke="rgba(0,0,0,0.5)" strokeWidth="0.8" />
    </svg>
  );
}

/**
 * Scelta della freccia: prima la serie (se ne hai più di una), poi il numero dentro quella serie.
 * `used` sono i numeri già presi nella stessa volée (per la serie mostrata).
 */
export function ArrowPicker({
  sets,
  setId,
  tag,
  fallbackTags,
  used = () => [],
  onPick,
}: {
  sets: ArrowSet[];
  setId: number | null;
  tag: number | null;
  fallbackTags?: number[];
  used?: (setId: number | null) => number[];
  onPick: (setId: number | null, tag: number | null) => void;
}) {
  const [shown, setShown] = useState<number | null>(setId ?? null);
  useEffect(() => {
    setShown(setId ?? lastArrowSet(sets));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, sets.length]);
  const current = sets.find((s) => s.id === shown) ?? null;
  const tags = current ? tagsOf(current.specs) : fallbackTags ?? tagsOf("");
  const taken = used(shown);
  // frecce da gara (segnate in Attrezzatura): una stellina sul numero
  const race = (() => {
    try {
      return parseRace((JSON.parse(current?.specs || "{}") as { race?: string }).race);
    } catch {
      return [] as number[];
    }
  })();
  return (
    <div className="grid gap-2">
      {sets.length > 1 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          {sets.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={shown === s.id}
              onClick={() => {
                setShown(s.id);
                rememberArrowSet(s.id);
              }}
              className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-sm transition ${shown === s.id ? "border-accent bg-accent/15 font-semibold" : "border-line bg-white/[0.04]"}`}
            >
              <SetSwatch specs={s.specs} />
              {s.name || `Serie ${s.id}`}
            </button>
          ))}
        </div>
      ) : current ? (
        <p className="flex items-center gap-1.5 text-xs text-muted"><SetSwatch specs={current.specs} size={18} />{current.name || "Le tue frecce"}</p>
      ) : null}
      <div className="grid grid-cols-6 gap-1.5">
        {tags.map((n) => {
          const on = tag === n && (setId == null || setId === (current?.id ?? null));
          const busy = !on && taken.includes(n);
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              onClick={() => {
                rememberArrowSet(current?.id ?? null);
                onPick(current?.id ?? null, on ? null : n);
              }}
              aria-label={race.includes(n) ? `Freccia ${n}, da gara` : `Freccia ${n}`}
              className={`relative min-h-11 rounded-xl font-display text-lg tabular-nums transition ${on ? "bg-accent text-accent-fg" : busy ? "bg-white/[0.03] text-muted" : "bg-white/[0.07]"}`}
            >
              {n}
              {race.includes(n) ? <span aria-hidden className={`absolute right-1 top-0.5 text-[0.6rem] leading-none ${on ? "" : "text-accent"}`}>★</span> : null}
            </button>
          );
        })}
      </div>
      {sets.length > 1 ? <p className="text-[0.68rem] text-muted">Le serie e i colori delle penne si impostano in Attrezzatura, nella scheda di ogni gruppo di frecce.</p> : null}
    </div>
  );
}
