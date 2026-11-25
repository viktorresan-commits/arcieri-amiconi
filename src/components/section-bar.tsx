/**
 * La barra in basso: Casa e le sette sezioni dell'app. Un tocco su una sezione apre sopra la barra
 * un riquadro con le sue voci (quattro per fila); un altro tocco, il fondo scuro o «indietro» lo chiudono.
 * Se il telefono è stretto la barra scorre di lato, con la sezione della pagina sempre in vista.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { SHORTCUTS, STATIONS, currentShortcut, type Shortcut, type StationId } from "@/lib/arcieri/shortcuts";
import { useLocalState } from "@/lib/arcieri/local-store";
import { onBack } from "@/lib/arcieri/native";
import { AppIcon, Glyph } from "./icons";
import { cx } from "./kit";

const SHORT: Record<StationId, string> = { prepara: "Prepara", allena: "Allena", strumenti: "Strumenti", analizza: "Analizza", gareggia: "Gare", impara: "Impara", squadra: "Compagnia" };
const MENU_LAST_KEY = "aa-menu-last";

export function SectionBar({ path, hide = [], onSearch }: { path: string; /** voci che questa persona non può aprire */ hide?: string[]; /** apre la ricerca fra tutte le voci */ onSearch: () => void }) {
  const [open, setOpen] = useState<StationId | null>(null);
  const [anchor, setAnchor] = useState(0.5);
  const scroller = useRef<HTMLDivElement>(null);
  const here = path === "/" ? null : currentShortcut(path)?.group ?? null;
  const [lastTouched, setLastTouched] = useLocalState<Record<string, string>>(MENU_LAST_KEY, {});
  // la sezione della pagina resta in vista nella barra che scorre
  useLayoutEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-st="${here ?? "casa"}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [here]);
  // cambiando pagina il riquadro si chiude
  useEffect(() => setOpen(null), [path]);
  useEffect(() => {
    if (!open) return;
    const off = onBack(() => setOpen(null));
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
  const isHere = (s: Shortcut) => s.to !== "/" && path.startsWith(s.to);

  return (
    <>
      {/* veste, riquadro e barra nello stesso livello della pagina: la barra resta sopra il velo */}
      {st ? (
            <div className="md:hidden">
              <button type="button" aria-label="Chiudi" className="aa-tray-veil fixed inset-0 z-[35] bg-black/55 backdrop-blur-[3px]" onClick={() => setOpen(null)} />
              <div
                role="dialog"
                aria-label={st.title}
                className="aa-tray fixed inset-x-2 z-[36] rounded-[1.7rem] p-3 pb-3.5"
                style={{
                  bottom: "calc(env(safe-area-inset-bottom) + 4.9rem)",
                  ["--cat" as string]: st.color,
                  ["--at" as string]: `${anchor * 100}%`,
                  background: `radial-gradient(120% 90% at var(--at) 110%, color-mix(in srgb, ${st.color} 30%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in srgb, ${st.color} 22%, #151b24), #0e131a 75%)`,
                } as CSSProperties}
              >
                {/* bersaglio decorativo nell'angolo */}
                <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 opacity-[0.14]">
                  {[96, 78, 60, 42, 24].map((r, k) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#fff" strokeWidth={k === 4 ? 10 : 6} />)}
                </svg>
                <div className="relative mb-2.5 flex items-center gap-2.5">
                  <AppIcon name={st.icon} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[1.6rem] leading-none text-white">{st.title}</p>
                    <p className="truncate text-[0.72rem] text-white/65">{st.sub}</p>
                  </div>
                  <button type="button" onClick={() => { setOpen(null); onSearch(); }} aria-label="Cerca fra tutte le voci" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.09] text-white">
                    <Glyph name="search" size={17} />
                  </button>
                  <button type="button" onClick={() => setOpen(null)} aria-label="Chiudi" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.09] text-white">
                    <Glyph name="close" size={17} />
                  </button>
                </div>
                <div className="relative grid max-h-[52dvh] grid-cols-4 gap-x-1 gap-y-3 overflow-y-auto pb-0.5 [scrollbar-width:none]">
                  {items.map((s, i) => (
                    <Link
                      key={s.id}
                      to={s.to as "/"}
                      search={(s.search ?? {}) as never}
                      onClick={() => pick(s)}
                      aria-current={isHere(s) ? "page" : undefined}
                      className={cx("aa-tray-item aa-short grid min-w-0 justify-items-center gap-1 rounded-2xl px-0.5 py-1 text-center", isHere(s) && "is-here")}
                      style={{ animationDelay: `${60 + i * 28}ms` }}
                    >
                      <AppIcon name={s.icon} size={52} className="aa-short-icon" glow={lastTouched[st.id] === s.id} />
                      <span className="line-clamp-2 w-full text-[0.7rem] font-semibold leading-tight text-white">{s.label}</span>
                    </Link>
                  ))}
                </div>
                {/* la punta verso la sezione toccata */}
                <span aria-hidden className="aa-tray-tip absolute -bottom-[7px] h-3.5 w-3.5 rotate-45" style={{ left: `calc(var(--at) - 7px)` }} />
              </div>
            </div>
      ) : null}
      <nav aria-label="Sezioni" className="aa-bottomnav aa-bar-bottom fixed inset-x-0 bottom-0 z-[37] border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <div ref={scroller} className="aa-secbar flex snap-x overflow-x-auto px-1 [scrollbar-width:none]">
          <Link
            to="/"
            data-st="casa"
            onClick={() => setOpen(null)}
            aria-current={path === "/" ? "page" : undefined}
            className={cx("aa-secbar-item relative grid min-w-[3rem] flex-1 snap-start justify-items-center gap-0.5 pb-1.5 pt-2", path === "/" && !open && "is-on")}
            style={{ ["--acc" as string]: "#7cf0a8" }}
          >
            <AppIcon name="home" size={30} />
            <span className="text-[0.58rem] font-semibold leading-none tracking-tight">Casa</span>
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
                <AppIcon name={x.icon} size={30} />
                <span className="text-[0.58rem] font-semibold leading-none tracking-tight">{SHORT[x.id]}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
