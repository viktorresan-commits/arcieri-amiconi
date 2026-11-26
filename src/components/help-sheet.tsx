import { useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { SHORTCUTS, STATIONS, currentShortcut } from "@/lib/arcieri/shortcuts";
import { GLOBAL_TIPS, helpFor } from "@/lib/arcieri/help";
import { AppIcon, Glyph } from "./icons";
import { ShortcutTile } from "./shortcuts";

/**
 * Aiuto in contesto: cosa fa questa pagina, come si usa e dove andare dopo.
 * Si apre dal "?" in alto e si chiude toccando fuori, con la X o con Esc.
 */
export function HelpSheet({ path, search, onClose, onMenu }: { path: string; search?: unknown; onClose: () => void; onMenu: () => void }) {
  const here = currentShortcut(path, search);
  const station = here ? STATIONS.find((s) => s.id === here.group) : null;
  const tips = helpFor(path);
  const related = here ? SHORTCUTS.filter((s) => s.group === here.group && s.to !== here.to).slice(0, 6) : [];
  const title = path === "/" ? "Casa" : here?.label ?? "Questa pagina";
  // il colore della sezione, come la pagina
  const color = station?.color ?? "#2c8a57";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="aa-help-backdrop fixed inset-0 z-[70] flex items-end justify-center bg-black/55 backdrop-blur-[3px] md:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Aiuto: ${title}`}>
      <div
        className="aa-sheet aa-help grid max-h-[88dvh] w-full max-w-lg gap-4 overflow-y-auto rounded-t-3xl border-t border-hair bg-elev p-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] md:rounded-3xl md:border"
        style={{ "--c": color } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-white/20 md:hidden" />
        <header className="aa-help-head relative flex items-center gap-3 overflow-hidden rounded-2xl p-3">
          {here ? <AppIcon name={here.icon} enamel={station?.enamel} size={52} /> : <AppIcon name="home" enamel="ivory" size={52} />}
          <div className="min-w-0 flex-1">
            {station ? <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-white/70">{station.title}</p> : null}
            <h2 className="truncate font-display text-2xl leading-tight">{title}</h2>
            {here ? <p className="text-sm text-white/80">{here.hint}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-10 w-10 shrink-0 place-items-center self-start rounded-full bg-black/25">
            <Glyph name="close" size={18} />
          </button>
        </header>

        {tips.length ? (
          <section className="grid gap-2">
            <p className="aa-section-title">Come si usa</p>
            <ol className="grid gap-2">
              {tips.map((t, i) => (
                <li key={t} className="aa-help-tip flex items-start gap-3 rounded-2xl bg-white/[0.04] p-3 text-sm" style={{ animationDelay: `${60 + i * 60}ms` }}>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-display text-[0.8rem]" style={{ background: color, color: "#fff" }}>{i + 1}</span>
                  <span className="leading-snug">{t}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {related.length ? (
          <section className="grid gap-2">
            <p className="aa-section-title">Nella stessa sezione</p>
            <div className="grid grid-cols-3 gap-x-2 gap-y-3">
              {related.map((s, i) => (
                <ShortcutTile key={s.id} s={s} size="lg" index={i} onClick={onClose} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-2">
          <p className="aa-section-title">Gesti utili</p>
          <ul className="grid gap-1.5">
            {GLOBAL_TIPS.map((t) => (
              <li key={t.text} className="flex items-center gap-3 text-sm text-muted">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-fg">
                  <Glyph name={t.icon} size={16} />
                </span>
                {t.text}
              </li>
            ))}
          </ul>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { onClose(); onMenu(); }} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/[0.07] text-sm font-semibold active:scale-[0.98]">
            <Glyph name="grid" size={17} /> Apri il Menu
          </button>
          <Link to="/guida" onClick={onClose} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-fg active:scale-[0.98]">
            <Glyph name="book" size={17} /> Guida completa
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
