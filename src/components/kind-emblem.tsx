/** Emblema e etichetta delle tre tipologie: minigioco, allenamento, gara di campionato. */
import { Insignia } from "@/components/insignia";
import { KINDS, type ActivityKind } from "@/lib/arcieri/kinds";
import { cx } from "@/components/kit";
import type { ReactNode } from "react";

/** decorativo di solito (c'è il nome accanto); con titled lo legge anche lo screen reader */
export function KindEmblem({ kind, size = 56, glow, pop, titled = false, className }: { kind: ActivityKind; size?: number; glow?: boolean; pop?: boolean; titled?: boolean; className?: string }) {
  const k = KINDS[kind];
  const big = size >= 64;
  return <Insignia {...k.emblem} crown={k.emblem.crown && big} laurel={k.emblem.laurel && big} size={size} glow={glow} pop={pop} className={className} title={titled ? k.long : undefined} />;
}

/** etichetta piccola: emblema e nome, nel colore della tipologia */
export function KindChip({ kind, long = false, suffix, className }: { kind: ActivityKind; long?: boolean; suffix?: string; className?: string }) {
  const k = KINDS[kind];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-[0.72rem] font-semibold", className)} style={{ background: k.tint, color: k.color, boxShadow: `inset 0 0 0 1px ${k.color}33` }}>
      <KindEmblem kind={kind} size={20} />
      {long ? k.long : k.label}
      {suffix ? <span className="opacity-70">{suffix}</span> : null}
    </span>
  );
}

/** intestazione di sezione con l'emblema grande della tipologia */
export function KindHeading({ kind, title, sub, right }: { kind: ActivityKind; title?: string; sub?: string; right?: ReactNode }) {
  const k = KINDS[kind];
  return (
    <div className="flex items-center gap-3">
      <KindEmblem kind={kind} size={46} />
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-2xl leading-tight" style={{ color: k.color }}>
          {title ?? k.long}
        </h2>
        {sub ? <p className="text-xs text-muted">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}
