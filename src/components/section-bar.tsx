/**
 * La barra in basso: Casa e le sette sezioni dell'app. Un tocco su una sezione apre sopra la barra
 * un riquadro con le sue voci (quattro per fila); un altro tocco, il fondo scuro o «indietro» lo chiudono.
 * Se il telefono è stretto la barra scorre di lato, con la sezione della pagina sempre in vista.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { SHORTCUTS, STATIONS, currentShortcut, sectionOf, type Shortcut, type StationId } from "@/lib/arcieri/shortcuts";
import { useLocalState } from "@/lib/arcieri/local-store";
import { onBack } from "@/lib/arcieri/native";
import { AppIcon, Glyph } from "./icons";
import { cx } from "./kit";

const MENU_LAST_KEY = "aa-menu-last";

export function SectionBar({ path, search, hide = [], onSearch }: { path: string; /** parametri dell'indirizzo: distinguono le voci che aprono la stessa pagina */ search?: unknown; /** voci che questa persona non può aprire */ hide?: string[]; /** apre la ricerca fra tutte le voci */ onSearch: () => void }) {
  const [open, setOpen] = useState<StationId | null>(null);
  const [anchor, setAnchor] = useState(0.5);
  const scroller = useRef<HTMLDivElement>(null);
  const here = sectionOf(path, search);
  // una sola voce accesa: quella della pagina aperta, parametri compresi
  const hash = useRouterState({ select: (st) => st.location.hash });
  const hereItem = path === "/" ? null : currentShortcut(path, search, hash);
  const [lastTouched, setLastTouched] = useLocalState<Record<string, string>>(MENU_LAST_KEY, {});
  // sfumatura ai lati solo se la barra scorre davvero (telefono stretto)
  const [scrolls, setScrolls] = useState(false);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => setScrolls(el.scrollWidth > el.clientWidth + 2);
    check();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  // la sezione della pagina resta in vista nella barra che scorre
  useLayoutEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-st="${here ?? "casa"}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [here]);
  // cambiando pagina il riquadro si chiude
  useEffect(() => setOpen(null), [path]);
  useEffect(() => {
    if (!open) return;
    const off = onBack(() => {
      setOpen(null);
      return true;
    });
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", esc);
    return () => {
      off?.();
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  const toggle = (id: StationId, el: HTMLElement) => {
    if (navigator.vibrate) navigator.vibrate(8);
    const r = el.getBoundingClientRect();
    setAnchor(Math.min(0.92, Math.max(0.08, (r.left + r.width / 2) / window.innerWidth)));
    setOpen((cur) => (cur === id ? null : id));
  };
  const st = open ? STATIONS.find((x) => x.id === open) ?? null : null;
  const items = st ? SHORTCUTS.filter((s) => s.group === st.id && !hide.includes(s.id)) : [];
  const pick = (s: Shortcut) => {
    if (navigator.vibrate) navigator.vibrate(8);
    setLastTouched((m) => (m[s.group] === s.id ? m : { ...m, [s.group]: s.id }));
    setOpen(null);
  };
  const isHere = (s: Shortcut) => hereItem?.id === s.id;
  // la voce in evidenza (solo i raggi che girano): quella della pagina aperta se è di questa sezione, altrimenti l'ultima toccata
  const glowId = st ? (hereItem?.group === st.id ? hereItem.id : lastTouched[st.id]) : undefined;

  return (
    <>
      {/* veste, riquadro e barra nello stesso livello della pagina: la barra resta sopra il velo */}
      {st ? (
            <div className="md:hidden">
              {/* velo scuro senza sfocatura: la sfocatura a tutto schermo rallenta i telefoni e fa scattare l'apertura */}
              <button type="button" aria-label="Chiudi" className="aa-tray-veil fixed inset-0 z-[35] bg-black/65" onClick={() => setOpen(null)} />
              <div
                role="dialog"
                aria-label={st.title}
                className="aa-tray fixed inset-x-1.5 z-[36] rounded-[1.9rem] p-3.5 pb-4"
                style={{
                  bottom: "calc(env(safe-area-inset-bottom) + 4.9rem)",
                  ["--cat" as string]: st.color,
                  ["--at" as string]: `${anchor * 100}%`,
                  // sfumatura dall'alto verso il basso: colore della sezione in cima, scuro in fondo
                  background: `linear-gradient(180deg, color-mix(in srgb, ${st.color} 46%, #131820) 0%, color-mix(in srgb, ${st.color} 22%, #10151c) 42%, color-mix(in srgb, ${st.color} 6%, #0b0f14) 78%, #090c10 100%)`,
                } as CSSProperties}
              >
                {/* bersaglio decorativo nell'angolo, ritagliato dentro il riquadro (prima sporgeva sopra) */}
                <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                  <svg viewBox="0 0 200 200" className="absolute -right-12 -top-14 h-48 w-48 opacity-[0.12]">
                    {[96, 78, 60, 42, 24].map((r, k) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#fff" strokeWidth={k === 4 ? 10 : 6} />)}
                  </svg>
                </span>
                <div className="relative mb-3.5 flex items-center gap-3">
                  <AppIcon name={st.icon} size={50} enamel={st.enamel} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[2rem] leading-none text-white">{st.title}</p>
                    <p className="mt-0.5 truncate text-[0.8rem] text-white/70">{st.sub}</p>
                  </div>
                  <button type="button" onClick={() => { setOpen(null); onSearch(); }} aria-label="Cerca fra tutte le voci" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.1] text-white">
                    <Glyph name="search" size={19} />
                  </button>
                  <button type="button" onClick={() => setOpen(null)} aria-label="Chiudi" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.1] text-white">
                    <Glyph name="close" size={19} />
                  </button>
                </div>
                <div className="relative grid max-h-[60dvh] grid-cols-3 gap-x-2 gap-y-4 overflow-y-auto px-0.5 pb-1 pt-1 [scrollbar-width:none]">
                  {items.map((s, i) => (
                    <Link
                      key={s.id}
                      to={s.to as "/"}
                      search={(s.search ?? {}) as never}
                      hash={s.hash}
                      onClick={() => pick(s)}
                      aria-current={isHere(s) ? "page" : undefined}
                      className="aa-tray-item aa-short grid min-w-0 justify-items-center gap-1.5 rounded-2xl px-1 py-1 text-center"
                      style={{ animationDelay: `${60 + i * 28}ms` }}
                    >
                      <span className="grid h-[76px] w-[76px] place-items-center"><AppIcon name={s.icon} size={70} className="aa-short-icon" enamel={st.enamel} glow={glowId === s.id} /></span>
                      <span className="line-clamp-2 w-full text-[0.86rem] font-semibold leading-tight text-white">{s.label}</span>
                    </Link>
                  ))}
                </div>
                {/* la punta verso la sezione toccata */}
                <span aria-hidden className="aa-tray-tip absolute -bottom-[7px] h-3.5 w-3.5 rotate-45" style={{ left: `calc(var(--at) - 7px)` }} />
              </div>
            </div>
      ) : null}
      <nav aria-label="Sezioni" className="aa-bottomnav aa-bar-bottom fixed inset-x-0 bottom-0 z-[37] border-t pb-[env(safe-area-inset-bottom)] md:hidden">
        <div ref={scroller} className={cx("aa-secbar flex snap-x overflow-x-auto px-1 [scrollbar-width:none]", scrolls && "is-scroll")}>
          <Link
            to="/"
            data-st="casa"
            onClick={() => setOpen(null)}
            aria-current={path === "/" ? "page" : undefined}
            className={cx("aa-secbar-item relative grid min-w-[3rem] flex-1 snap-start justify-items-center gap-0.5 pb-1.5 pt-2", path === "/" && !open && "is-on")}
            style={{ ["--acc" as string]: "#f2e6c4" }}
          >
            {/* come le sezioni: niente placca, quando è aperta girano i raggi */}
            <AppIcon name="home" size={30} enamel="ivory" glow={path === "/" && !open} />
            <span className="text-[0.6rem] font-semibold leading-none tracking-tight">Casa</span>
          </Link>
          {STATIONS.map((x) => {
            const on = open ? open === x.id : here === x.id;
            return (
              <button
                key={x.id}
                type="button"
                data-st={x.id}
                aria-expanded={open === x.id}
                onClick={(e) => toggle(x.id, e.currentTarget)}
                className={cx("aa-secbar-item relative grid min-w-[3rem] flex-1 snap-start justify-items-center gap-0.5 pb-1.5 pt-2", on && "is-on")}
                style={{ ["--acc" as string]: x.color }}
              >
                {/* sezione aperta: niente placca, girano i raggi del suo colore */}
                <AppIcon name={x.icon} size={30} enamel={x.enamel} glow={on} />
                <span className="text-[0.6rem] font-semibold leading-none tracking-tight">{x.short}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
