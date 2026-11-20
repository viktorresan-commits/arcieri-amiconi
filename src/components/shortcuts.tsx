import { useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { SHORTCUTS, STATIONS, TIPS, shortcutById, usePinned, type Shortcut } from "@/lib/arcieri/shortcuts";
import { cx } from "./kit";
import { AppIcon, Glyph } from "./icons";
import { RealIcon } from "./real-icons";

/** Una scorciatoia: icona colorata che rimbalza al tocco. */
export function ShortcutTile({ s, size = "md", onClick, index = 0 }: { s: Shortcut; size?: "md" | "lg"; onClick?: () => void; index?: number }) {
  return (
    <Link
      to={s.to as "/"}
      search={(s.search ?? {}) as never}
      hash={s.hash}
      onClick={() => {
        if (navigator.vibrate) navigator.vibrate(8);
        onClick?.();
      }}
      className={cx("aa-short group flex flex-col items-center gap-1.5 text-center", size === "lg" ? "min-w-0" : "w-[4.6rem] shrink-0")}
      style={{ "--c": s.color, animationDelay: `${index * 40}ms` } as CSSProperties}
    >
      <AppIcon name={s.icon} color={s.color} size={size === "lg" ? 56 : 54} className="aa-short-icon" />
      <span className="w-full truncate text-[0.7rem] font-semibold leading-tight">{s.label}</span>
      {size === "lg" ? <span className="-mt-1 line-clamp-2 text-[0.62rem] leading-tight text-muted">{s.hint}</span> : null}
    </Link>
  );
}

/** Le scorciatoie scelte, in fila scorrevole, con il pulsante per personalizzarle. */
export function ShortcutRow() {
  const { pinned } = usePinned();
  const [edit, setEdit] = useState(false);
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <h2 className="aa-section-title">In un tocco</h2>
        <button type="button" className="aa-chip" onClick={() => setEdit(true)}><Glyph name="edit" size={14} /> Personalizza</button>
      </div>
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {pinned.map((id, i) => {
          const s = shortcutById(id);
          return s ? <ShortcutTile key={id} s={s} index={i} /> : null;
        })}
        <button type="button" onClick={() => setEdit(true)} className="aa-short flex w-[4.6rem] shrink-0 flex-col items-center gap-1.5" style={{ "--c": "#8a8f98" } as CSSProperties}>
          <span className="grid h-[54px] w-[54px] place-items-center rounded-[16px] border border-dashed border-white/25 text-muted"><Glyph name="plus" size={22} /></span>
          <span className="text-[0.7rem] font-semibold text-muted">Aggiungi</span>
        </button>
      </div>
      {edit ? <ShortcutEditor onClose={() => setEdit(false)} /> : null}
    </section>
  );
}

/** Foglio per scegliere e ordinare le scorciatoie. */
export function ShortcutEditor({ onClose }: { onClose: () => void }) {
  const { pinned, toggle, move, reset } = usePinned();
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[2px]" onClick={onClose}>
      <div className="aa-sheet grid max-h-[85dvh] w-full gap-3 overflow-y-auto rounded-t-3xl border-t border-hair bg-elev p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1.5 w-10 rounded-full bg-white/20" />
        <div className="flex items-center justify-between">
          <p className="aa-section-title">Le tue scorciatoie</p>
          <button type="button" className="aa-chip is-on" onClick={onClose}>Fatto</button>
        </div>
        <p className="text-xs text-muted">Tocca per mettere o togliere. Le frecce cambiano l'ordine in Home.</p>
        <ul className="grid gap-1.5">
          {SHORTCUTS.map((s) => {
            const on = pinned.includes(s.id);
            return (
              <li key={s.id} className={cx("flex items-center gap-3 rounded-2xl border px-3 py-2 transition", on ? "border-white/15 bg-white/[0.06]" : "border-transparent opacity-70")}>
                <button type="button" onClick={() => toggle(s.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <AppIcon name={s.icon} color={s.color} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{s.label}</span>
                    <span className="block truncate text-[0.7rem] text-muted">{s.hint}</span>
                  </span>
                </button>
                {on ? (
                  <span className="flex gap-1">
                    <button type="button" className="aa-chip !min-h-8 !px-2" onClick={() => move(s.id, -1)} aria-label="Più su">↑</button>
                    <button type="button" className="aa-chip !min-h-8 !px-2" onClick={() => move(s.id, 1)} aria-label="Più giù">↓</button>
                  </span>
                ) : null}
                <button type="button" onClick={() => toggle(s.id)} aria-pressed={on} className={cx("grid h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition", on ? "bg-primary" : "bg-white/15")}>
                  <span className={cx("h-6 w-6 rounded-full bg-white shadow transition-transform", on ? "translate-x-5" : "")} />
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="aa-chip justify-self-start" onClick={reset}>Ripristina predefinite</button>
      </div>
    </div>
  );
}

/** "Lo sapevi?": un consiglio di tiro o un trucco dell'app; tocca per il prossimo. */
export function TipCard() {
  const [i, setI] = useState(() => Math.floor((Date.now() / 86_400_000) % TIPS.length));
  const tip = TIPS[i % TIPS.length];
  return (
    <button
      type="button"
      onClick={() => setI((n) => n + 1)}
      className="aa-tile aa-kpi flex w-full items-start gap-3 text-left"
      style={{ "--kpi": "#7cf0a8" } as CSSProperties}
    >
      <span key={`e${i}`} className="aa-pop"><AppIcon name={tip.icon} color="#2f9e6a" size={40} /></span>
      <span key={`t${i}`} className="aa-rise min-w-0">
        <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#7cf0a8]">Lo sapevi? · {(i % TIPS.length) + 1}/{TIPS.length}</span>
        <span className="mt-0.5 block text-[0.8rem] leading-snug">{tip.text}</span>
      </span>
      <Glyph name="chevron" size={16} className="ml-auto shrink-0 self-center text-muted" />
    </button>
  );
}

/** Mappa del percorso: cinque tappe in fila, collegate da un sentiero, con le loro sezioni. */
/** Menu: cerca, oppure scegli una sezione (schede scorrevoli, anche con il dito di lato) e tocca la voce. */
export function PathMap({ onPick, current, onPersonalize }: { onPick?: () => void; current?: string; onPersonalize?: () => void }) {
  const here = SHORTCUTS.find((s) => current && s.to !== "/" && current.startsWith(s.to));
  const [tab, setTab] = useState<string>(here?.group ?? "allena");
  const [dir, setDir] = useState(0);
  const [q, setQ] = useState("");
  const touch = useRef<{ x: number; y: number } | null>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const idx = Math.max(0, STATIONS.findIndex((st) => st.id === tab));
  const go = (i: number) => {
    const k = (i + STATIONS.length) % STATIONS.length;
    setDir(k > idx ? 1 : -1);
    setTab(STATIONS[k].id);
    const el = tabs.current?.children[k] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };
  const st = STATIONS[idx];
  const query = q.trim().toLowerCase();
  const items = query ? SHORTCUTS.filter((s) => `${s.label} ${s.hint}`.toLowerCase().includes(query)) : SHORTCUTS.filter((s) => s.group === st.id);
  const stationOf = (id: string) => STATIONS.find((x) => x.id === id);
  return (
    <div className="grid gap-3">
      <label className="flex items-center gap-2 rounded-2xl border border-hair bg-white/[0.04] px-3 focus-within:border-primary/60">
        <Glyph name="eye" size={16} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Cerca tra ${SHORTCUTS.length} voci`} className="min-h-11 w-full bg-transparent text-sm outline-none" />
        {q ? <button type="button" aria-label="Cancella" onClick={() => setQ("")} className="text-muted"><Glyph name="close" size={16} /></button> : null}
      </label>
      {query ? null : (
        <div ref={tabs} className="-mx-4 flex snap-x gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {STATIONS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-pressed={s.id === tab}
              className={cx("aa-menu-tab flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-semibold transition-all duration-300", s.id === tab ? "text-fg" : "bg-white/[0.04] text-muted")}
              style={s.id === tab ? { background: `color-mix(in srgb, ${s.color} 30%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${s.color} 55%, transparent)` } : undefined}
            >
              <RealIcon name={s.icon} size={26} className={cx("transition-transform duration-300", s.id === tab ? "scale-110" : "opacity-75")} />
              {s.title}
              <span className="text-[0.6rem] opacity-60">{SHORTCUTS.filter((x) => x.group === s.id).length}</span>
            </button>
          ))}
        </div>
      )}
      <div
        key={query ? "q" : tab}
        className={query ? "aa-rise" : dir >= 0 ? "aa-menu-in-r" : "aa-menu-in-l"}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t || query) return;
          const dx = e.changedTouches[0].clientX - t.x;
          const dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(idx + (dx < 0 ? 1 : -1));
        }}
      >
        {query ? null : <p className="mb-2 px-1 text-xs text-muted">{st.sub}</p>}
        <ul className="grid gap-1">
          {items.map((s, i) => {
            const on = !!current && s.to !== "/" && current.startsWith(s.to) && (!s.search || here?.id === s.id);
            const sta = stationOf(s.group);
            return (
              <li key={s.id} className="aa-menu-row" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                <Link
                  to={s.to as "/"}
                  search={(s.search ?? {}) as never}
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(8);
                    onPick?.();
                  }}
                  aria-current={on ? "page" : undefined}
                  className={cx("aa-short flex items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors", on ? "bg-primary/12" : "active:bg-white/[0.05]")}
                >
                  <AppIcon name={s.icon} color={s.color} size={44} className="aa-short-icon" />
                  <span className="min-w-0 flex-1">
                    <span className={cx("block text-[0.95rem] font-semibold", on && "text-primary")}>{s.label}</span>
                    <span className="block truncate text-xs text-muted">{query && sta ? `${sta.title} · ` : ""}{s.hint}</span>
                  </span>
                  <Glyph name="chevron" size={16} className="text-muted/60" />
                </Link>
              </li>
            );
          })}
          {!items.length ? <li className="px-2 py-6 text-center text-sm text-muted">Nessuna voce trovata.</li> : null}
        </ul>
      </div>
      {onPersonalize ? (
        <button type="button" onClick={onPersonalize} className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-muted">
          <Glyph name="palette" size={15} /> Personalizza colori, icone e Home
        </button>
      ) : null}
    </div>
  );
}
