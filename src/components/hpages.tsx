/**
 * Liste lunghe in pagine che scorrono di lato (niente elenchi infiniti): in alto le scorciatoie
 * (1–5, 6–10, …) e, se c'è, quella per saltare alla nostra riga; il dito scorre da una pagina all'altra.
 */
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/kit";

export function HPages<T>({ items, per = 6, render, keyOf, labelOf, focus, focusLabel = "Noi", className, as = "ol" }: {
  items: T[];
  /** righe per pagina */
  per?: number;
  render: (item: T, index: number) => ReactNode;
  keyOf: (item: T, index: number) => string;
  /** come chiamare una pagina (di solito i posti: 1–6); senza, i numeri delle righe */
  labelOf?: (first: T, last: T, page: number) => string;
  /** la riga da raggiungere con la scorciatoia in fondo (la nostra compagnia, il tuo nome) */
  focus?: number;
  focusLabel?: string;
  className?: string;
  as?: "ol" | "ul" | "div";
}) {
  const box = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per));
  const List = as;
  // cambiando elenco (un'altra categoria) si riparte dalla prima pagina
  const sig = `${items.length}|${items.length ? keyOf(items[0], 0) : ""}`;
  useEffect(() => {
    box.current?.scrollTo({ left: 0 });
    setCur(0);
  }, [sig]);
  if (pages.length <= 1) {
    return <List className={cx("grid gap-1.5", className)}>{items.map((it, i) => <Fragment key={keyOf(it, i)}>{render(it, i)}</Fragment>)}</List>;
  }
  const go = (p: number) => {
    const el = box.current;
    if (!el) return;
    el.scrollTo({ left: p * el.clientWidth, behavior: "smooth" });
    setCur(p);
  };
  const focusPage = focus != null && focus >= 0 ? Math.floor(focus / per) : -1;
  const label = (p: number) => {
    const pg = pages[p];
    return labelOf ? labelOf(pg[0], pg[pg.length - 1], p) : `${p * per + 1}–${p * per + pg.length}`;
  };
  return (
    <div className="grid min-w-0 gap-2">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="group" aria-label="Pagine dell'elenco">
        {pages.map((_, p) => (
          <button key={p} type="button" aria-pressed={cur === p} onClick={() => go(p)} className={cx("aa-chip shrink-0 tabular-nums", cur === p && "border-[#e0b15a]/60 bg-[#e0b15a]/15 text-[#f1cf8a]")}>
            {label(p)}
          </button>
        ))}
        {focusPage >= 0 && focusPage !== 0 ? (
          <button type="button" aria-pressed={cur === focusPage} onClick={() => go(focusPage)} className="aa-chip shrink-0 border-[#e0b15a]/45 text-[#f1cf8a]">
            {focusLabel}
          </button>
        ) : null}
      </div>
      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          const p = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (p !== cur) setCur(p);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
      >
        {pages.map((pg, p) => (
          <List key={p} className={cx("grid w-full shrink-0 snap-start content-start gap-1.5", className)} aria-label={`Righe ${label(p)}`}>
            {pg.map((it, i) => <Fragment key={keyOf(it, p * per + i)}>{render(it, p * per + i)}</Fragment>)}
          </List>
        ))}
      </div>
      <div className="flex justify-center gap-1" aria-hidden>
        {pages.map((_, p) => <span key={p} className={cx("h-1.5 rounded-full transition-all", cur === p ? "w-4 bg-[#e0b15a]" : "w-1.5 bg-white/20")} />)}
      </div>
    </div>
  );
}
