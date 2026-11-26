import { useArcherSetup } from "@/lib/arcieri/setup";
import { CURIOSITA, randomCuriosita } from "@/lib/arcieri/curiosita";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { SHORTCUTS, STATIONS, currentShortcut, nextShortcut, shortcutById, stationOf, usePinned, type Shortcut } from "@/lib/arcieri/shortcuts";
import { cx } from "./kit";
import { menuAllOpen, setMenuAllOpen } from "@/lib/arcieri/percorso";
import { AppIcon, Glyph } from "./icons";
import { useLocalState } from "@/lib/arcieri/local-store";

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
      <AppIcon name={s.icon} enamel={stationOf(s.group)?.enamel} size={size === "lg" ? 56 : 54} className="aa-short-icon" />
      <span className="w-full truncate text-[0.7rem] font-semibold leading-tight">{s.label}</span>
      {size === "lg" ? <span className="-mt-1 line-clamp-2 text-[0.62rem] leading-tight text-muted">{s.hint}</span> : null}
    </Link>
  );
}

/** icona grande della fila "In un tocco": niente animazioni d'ingresso, così non restano buchi mentre si scorre */
function BigTile({ s, recent = false }: { s: Shortcut; recent?: boolean }) {
  return (
    <Link
      to={s.to as "/"}
      search={(s.search ?? {}) as never}
      hash={s.hash}
      onClick={() => {
        if (navigator.vibrate) navigator.vibrate(8);
      }}
      className="aa-bigtile relative flex w-[5.4rem] shrink-0 flex-col items-center gap-1.5 rounded-[1.4rem] px-1 pb-2 pt-2.5 text-center"
      style={{ "--c": s.color } as CSSProperties}
    >
      <AppIcon name={s.icon} enamel={stationOf(s.group)?.enamel} size={62} />
      <span className="line-clamp-2 w-full text-[0.72rem] font-semibold leading-tight">{s.label}</span>
      {recent ? (
        <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white" title="Aperta di recente">
          <Glyph name="history" size={11} />
        </span>
      ) : null}
    </Link>
  );
}

/** `hide`: scorciatoie già a portata di mano sulla pagina (per id), così la fila non le ripete. */
export function ShortcutRow({ hide = [] }: { hide?: string[] } = {}) {
  const { pinned } = usePinned();
  const [edit, setEdit] = useState(false);
  const [recent, setRecent] = useState<Shortcut[]>([]);
  useEffect(() => setRecent(readRecent().slice(0, 8)), []);
  // un percorso nascosto vale per tutte le scorciatoie che portano lì senza parametri (es. /sfide)
  const hiddenTo = new Set(hide.map((id) => shortcutById(id)).filter((x): x is Shortcut => Boolean(x && !x.search)).map((x) => x.to));
  const shown = (x: Shortcut) => !hide.includes(x.id) && !(hiddenTo.has(x.to) && !x.search);
  const mine = pinned.map((id) => shortcutById(id)).filter((x): x is Shortcut => Boolean(x)).filter(shown);
  // un'unica fila: prima le ultime aperte che non sono già tra le tue, poi le tue scorciatoie. Nessun doppione.
  const extra = recent.filter(shown).filter((r) => !mine.some((m) => m.id === r.id || (m.to === r.to && !m.search && !r.search))).slice(0, 4);
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <h2 className="aa-section-title">In un tocco</h2>
        <button type="button" className="aa-chip" onClick={() => setEdit(true)}><Glyph name="edit" size={14} /> Personalizza</button>
      </div>
      <div className="aa-bigrow -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {extra.map((s) => <BigTile key={`r${s.id}`} s={s} recent />)}
        {mine.map((s) => <BigTile key={s.id} s={s} />)}
        <button type="button" onClick={() => setEdit(true)} className="aa-bigtile flex w-[5.4rem] shrink-0 flex-col items-center gap-1.5 rounded-[1.4rem] border border-dashed border-white/20 px-1 pb-2 pt-2.5 text-center text-muted">
          <span className="grid h-[62px] w-[62px] place-items-center rounded-[1.1rem] bg-white/[0.06]"><Glyph name="plus" size={24} /></span>
          <span className="text-[0.72rem] font-semibold leading-tight">Aggiungi</span>
        </button>
      </div>
      {extra.length ? <p className="flex items-center gap-1.5 px-0.5 text-[0.66rem] text-muted"><Glyph name="history" size={11} /> = aperta di recente</p> : null}
      {edit ? <ShortcutEditor onClose={() => setEdit(false)} /> : null}
    </section>
  );
}

/** Foglio per scegliere e ordinare le scorciatoie. */
export function ShortcutEditor({ onClose }: { onClose: () => void }) {
  const { pinned, toggle, move, reset } = usePinned();
  // il foglio va sul corpo della pagina: dentro una sezione animata "fixed" non starebbe fermo sullo schermo
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[2px]" onClick={onClose}>
      <div className="aa-sheet grid max-h-[85dvh] w-full gap-3 overflow-y-auto rounded-t-3xl border-t border-hair bg-elev p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1.5 w-10 rounded-full bg-white/20" />
        <div className="flex items-center justify-between">
          <p className="aa-section-title">Le tue scorciatoie</p>
          <button type="button" className="aa-chip is-on" onClick={onClose}>Fatto</button>
        </div>
        <p className="text-xs text-muted">In alto le tue, nell'ordine della Home: le frecce le spostano subito. Sotto le altre da aggiungere.</p>
        <ul className="grid gap-1.5">
          {pinned.map((id, i) => {
            const s = shortcutById(id);
            if (!s) return null;
            return (
              <li key={s.id} className="aa-rise flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-2 py-2">
                <span className="w-5 text-center font-display text-sm tabular-nums text-muted">{i + 1}</span>
                <AppIcon name={s.icon} enamel={stationOf(s.group)?.enamel} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.label}</span>
                  <span className="block truncate text-[0.7rem] text-muted">{s.hint}</span>
                </span>
                <button type="button" disabled={i === 0} className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.07] disabled:opacity-30" onClick={() => move(s.id, -1)} aria-label={`Sposta ${s.label} più su`}><Glyph name="chevron" size={15} className="-rotate-90" /></button>
                <button type="button" disabled={i === pinned.length - 1} className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.07] disabled:opacity-30" onClick={() => move(s.id, 1)} aria-label={`Sposta ${s.label} più giù`}><Glyph name="chevron" size={15} className="rotate-90" /></button>
                <button type="button" className="grid h-9 w-9 place-items-center rounded-xl text-muted" onClick={() => toggle(s.id)} aria-label={`Togli ${s.label}`}><Glyph name="close" size={15} /></button>
              </li>
            );
          })}
        </ul>
        <p className="aa-section-title mt-1 text-base">Da aggiungere</p>
        <ul className="grid gap-1.5">
          {SHORTCUTS.filter((s) => !pinned.includes(s.id)).map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => toggle(s.id)} className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2 text-left opacity-80 transition hover:opacity-100">
                <AppIcon name={s.icon} enamel={stationOf(s.group)?.enamel} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.label}</span>
                  <span className="block truncate text-[0.7rem] text-muted">{s.hint}</span>
                </span>
                <Glyph name="plus" size={18} className="text-muted" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="aa-chip justify-self-start" onClick={reset}>Ripristina predefinite</button>
      </div>
    </div>,
    document.body,
  );
}

/** "Lo sapevi?": una curiosità a caso (o, ogni tanto, un consiglio sul tuo arco); tocca per un'altra. */
export function TipCard() {
  const archer = useArcherSetup();
  const [i, setI] = useState(() => randomCuriosita());
  // ogni tanto, se l'attrezzatura principale ha libbre e allungo, un consiglio sul tuo arco
  const [mine, setMine] = useState(() => Math.random() < 0.15);
  const personal = archer.has && mine;
  const tip = personal
    ? { icon: "bow" as const, text: `Con il tuo ${archer.summary}: frecce da ${archer.grains ? `${archer.grains.min}–${archer.grains.max} grani` : "6–9 grani per libbra"}${archer.spineRange ? `, spine ${archer.spineRange}` : ""}, lunghe circa ${(archer.drawIn + 1).toFixed(1).replace(".", ",")}″.` }
    : CURIOSITA[i];
  const next = () => {
    setMine(Math.random() < 0.1);
    setI((n) => randomCuriosita(n));
  };
  return (
    <button type="button" onClick={next} className="mb-4 mt-8 flex w-full items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.05]">
      <span key={`e${i}${personal}`} className="aa-pop shrink-0 opacity-90"><AppIcon name={tip.icon} color="#2f9e6a" size={32} /></span>
      <span key={`t${i}${personal}`} className="aa-rise min-w-0">
        <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.16em] aa-tone">{personal ? "Per il tuo arco" : "Lo sapevi?"}</span>
        <span className="mt-0.5 block text-[0.78rem] leading-snug text-white/85">{tip.text}</span>
      </span>
      <Glyph name="sparkle" size={14} className="ml-auto mt-1 shrink-0 text-muted" />
    </button>
  );
}

/** Pagine visitate di recente, per tornarci dal Menu con un tocco. */
const RECENT_KEY = "aa-recent-pages";
const MENU_LAST_KEY = "aa-menu-last";

export function rememberPage(path: string) {
  const here = SHORTCUTS.filter((s) => s.to !== "/" && path.startsWith(s.to)).sort((x, y) => y.to.length - x.to.length)[0];
  if (!here) return;
  try {
    const list = (JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[]).filter((id) => id !== here.id);
    localStorage.setItem(RECENT_KEY, JSON.stringify([here.id, ...list].slice(0, 8)));
  } catch {
    /* memoria non disponibile */
  }
}
function readRecent() {
  try {
    return (JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[]).map(shortcutById).filter((s): s is Shortcut => Boolean(s));
  } catch {
    return [];
  }
}

/** Menu: cerca, riprendi una pagina recente, oppure scegli dalle sezioni, tutte in vista. */
export function PathMap({ onPick, current, currentSearch, showSearch = false, focus = null, hide = [], onSearch, onClose }: { onPick?: () => void; current?: string; /** parametri dell'indirizzo della pagina aperta */ currentSearch?: unknown; showSearch?: boolean; /** percorso dei nuovi: le voci da mostrare prima di tutte */ focus?: string[] | null; /** voci che questa persona non può aprire */ hide?: string[]; /** pulsanti sul margine destro, sotto l'indice delle sezioni */ onSearch?: () => void; onClose?: () => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(() => !focus || menuAllOpen());
  const query = q.trim().toLowerCase();
  const visible = SHORTCUTS.filter((s) => !hide.includes(s.id));
  const found = query ? visible.filter((s) => `${s.label} ${s.hint}`.toLowerCase().includes(query)) : [];
  const mine = focus ? focus.map((id) => shortcutById(id)).filter((s): s is Shortcut => !!s && !hide.includes(s.id)) : [];
  // una sola voce accesa: quella della pagina aperta, parametri compresi
  const hereId = current && current !== "/" ? currentShortcut(current, currentSearch)?.id : undefined;
  const isHere = (s: Shortcut) => !!hereId && s.id === hereId;
  // l'ultima voce toccata di ogni sezione brilla e ha i raggi che girano
  const [lastTouched, setLastTouched] = useLocalState<Record<string, string>>(MENU_LAST_KEY, {});
  const touch = (s: Shortcut) => setLastTouched((m) => (m[s.group] === s.id ? m : { ...m, [s.group]: s.id }));
  const go = () => {
    if (navigator.vibrate) navigator.vibrate(8);
    onPick?.();
  };
  return (
    <div className="grid gap-4">
      {showSearch ? <label className="aa-rise flex items-center gap-2 rounded-2xl border border-hair bg-white/[0.05] px-3 focus-within:border-primary/60">
        <Glyph name="search" size={16} className="text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Cerca tra ${visible.length} voci`} className="min-h-12 w-full bg-transparent text-sm outline-none" />
        {q ? <button type="button" aria-label="Cancella" onClick={() => setQ("")} className="text-muted"><Glyph name="close" size={16} /></button> : null}
      </label> : null}
      {query ? (
        <ul className="grid gap-1">
          {found.map((s, i) => {
            const sta = STATIONS.find((x) => x.id === s.group);
            return (
              <li key={s.id} className="aa-menu-row" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                <Link to={s.to as "/"} search={(s.search ?? {}) as never} onClick={() => { touch(s); go(); }} className="aa-short flex items-center gap-3 rounded-2xl px-2 py-1.5 active:bg-white/[0.05]">
                  <AppIcon name={s.icon} enamel={sta?.enamel} size={42} className="aa-short-icon" glow={lastTouched[s.group] === s.id} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.95rem] font-semibold">{s.label}</span>
                    <span className="block truncate text-xs text-muted">{sta ? `${sta.title} · ` : ""}{s.hint}</span>
                  </span>
                  <Glyph name="chevron" size={16} className="text-muted/60" />
                </Link>
              </li>
            );
          })}
          {!found.length ? <li className="px-2 py-6 text-center text-sm text-muted">Nessuna voce trovata.</li> : null}
        </ul>
      ) : (
        <>
          {mine.length ? (
            <section className="aa-rise grid gap-3 rounded-[1.6rem] border border-primary/30 bg-primary/[0.08] p-3">
              <div>
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-primary">Per te</p>
                <p className="text-xs text-muted">Le funzioni giuste per iniziare. Le altre compaiono da sole dopo 5 allenamenti.</p>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {mine.map((s) => (
                  <Link key={s.id} to={s.to as "/"} search={(s.search ?? {}) as never} onClick={() => { touch(s); go(); }} aria-current={isHere(s) ? "page" : undefined} className={cx("aa-short aa-cat-tile flex min-w-0 flex-col items-center gap-1.5 rounded-[1.4rem] px-1.5 pb-2.5 pt-3 text-center", isHere(s) && "is-here")}>
                    <AppIcon name={s.icon} enamel={stationOf(s.group)?.enamel} size={60} className="aa-short-icon" glow={lastTouched[s.group] === s.id} />
                    <span className="w-full truncate text-[0.78rem] font-semibold leading-tight">{s.label}</span>
                    <span className="line-clamp-2 w-full text-[0.6rem] leading-tight text-muted">{s.hint}</span>
                  </Link>
                ))}
              </div>
              {!all ? (
                <button type="button" onClick={() => { setAll(true); setMenuAllOpen(true); }} className="aa-press min-h-11 rounded-2xl border border-white/15 text-sm font-semibold">
                  Mostra tutte le {visible.length} voci
                </button>
              ) : null}
            </section>
          ) : null}
        </>
      )}
      <SectionStack showSections={!query && all} searching={showSearch} onSearch={onSearch} onClose={onClose} onGo={(s) => { touch(s); go(); }} isHere={isHere} hide={hide} lastTouched={lastTouched} />
    </div>
  );
}

/**
 * Menu: tutte le sezioni una sotto l'altra in un'unica pagina che scorre, voci tre per fila.
 * A destra, sul margine, l'indice delle sezioni (quella in vista è evidenziata; un tocco ci porta)
 * e sotto i pulsanti Cerca e Chiudi.
 */
function SectionStack({ onGo, isHere, hide = [], lastTouched = {}, searching, onSearch, onClose, showSections }: { onGo: (s: Shortcut) => void; isHere: (s: Shortcut) => boolean; hide?: string[]; lastTouched?: Record<string, string>; searching: boolean; onSearch?: () => void; onClose?: () => void; showSections: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>(STATIONS[0].id);
  // dopo un tocco sull'indice la sezione scelta resta accesa mentre la pagina scorre fin lì
  const lock = useRef(0);
  const scroller = () => (box.current?.closest("[data-menu-scroll]") as HTMLElement | null) ?? null;
  // la sezione in vista: l'ultima il cui titolo è già salito in cima (in fondo alla pagina vale l'ultima)
  useEffect(() => {
    const root = scroller();
    if (!root || !showSections) return;
    const spy = () => {
      if (Date.now() < lock.current) return;
      const secs = Array.from(box.current?.querySelectorAll<HTMLElement>("[data-sec]") ?? []);
      if (!secs.length) return;
      const atEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - 4;
      const top = root.getBoundingClientRect().top + 90;
      let cur = secs[0].dataset.sec ?? "";
      for (const el of secs) if (el.getBoundingClientRect().top <= top) cur = el.dataset.sec ?? cur;
      if (atEnd) cur = secs[secs.length - 1].dataset.sec ?? cur;
      setActive(cur);
    };
    spy();
    root.addEventListener("scroll", spy, { passive: true });
    return () => root.removeEventListener("scroll", spy);
  }, [showSections]);
  const jump = (id: string) => {
    const root = scroller();
    const el = box.current?.querySelector<HTMLElement>(`[data-sec="${id}"]`);
    if (!root || !el) return;
    setActive(id);
    lock.current = Date.now() + 900;
    root.scrollTo({ top: root.scrollTop + el.getBoundingClientRect().top - root.getBoundingClientRect().top - 12, behavior: "smooth" });
  };
  return (
    <div ref={box}>
      {showSections ? (
        <div className="grid gap-5">
          {STATIONS.map((st) => {
            const items = SHORTCUTS.filter((s) => s.group === st.id && !hide.includes(s.id));
            if (!items.length) return null;
            return (
              <section key={st.id} data-sec={st.id} className="aa-menu-sec" style={{ ["--cat" as string]: st.color }}>
                <div className="mb-2.5 flex items-baseline gap-2 border-b pb-1.5" style={{ borderColor: `color-mix(in srgb, ${st.color} 55%, transparent)` }}>
                  <h2 className="shrink-0 font-display text-[1.45rem] leading-none" style={{ color: `color-mix(in srgb, ${st.color} 65%, white)` }}>{st.title}</h2>
                  <span className="truncate text-[0.7rem] text-muted">{st.sub}</span>
                </div>
                <div className="grid grid-cols-3 gap-y-3.5">
                  {items.map((s) => (
                    <Link key={s.id} to={s.to as "/"} search={(s.search ?? {}) as never} onClick={() => onGo(s)} aria-current={isHere(s) ? "page" : undefined} className={cx("aa-short aa-menu-item flex min-w-0 flex-col items-center gap-1 rounded-2xl px-0.5 py-1 text-center", isHere(s) && "is-here")}>
                      <AppIcon name={s.icon} size={58} className="aa-short-icon" enamel={st.enamel} glow={lastTouched[st.id] === s.id} />
                      <span className="line-clamp-2 w-full text-[0.76rem] font-semibold leading-tight">{s.label}</span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
      {onClose && typeof document !== "undefined" ? createPortal(
        <nav className="aa-menu-rail aa-sheet fixed inset-y-0 right-0 z-[41] flex w-[3.6rem] md:hidden flex-col items-center justify-center gap-1 overflow-y-auto border-l border-white/10 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] [scrollbar-width:none]" aria-label="Sezioni del menu">
          {showSections
            ? STATIONS.map((st) => {
                const on = st.id === active;
                return (
                  <button key={st.id} type="button" onClick={() => jump(st.id)} aria-current={on ? "true" : undefined} className={cx("aa-rail-item relative grid w-full shrink-0 justify-items-center gap-0.5 py-1", on && "is-on")} style={{ ["--acc" as string]: st.color }}>
                    {on ? <span aria-hidden className="absolute inset-y-1 right-0 w-[3px] rounded-l" style={{ background: st.color }} /> : null}
                    <span className={cx("transition", on ? "" : "opacity-60 grayscale-[35%]")}><AppIcon name={st.icon} size={on ? 40 : 32} enamel={st.enamel} /></span>
                    <span className="text-[0.56rem] font-semibold leading-tight" style={{ color: on ? `color-mix(in srgb, ${st.color} 60%, white)` : "rgb(255 255 255 / 0.55)" }}>{st.title}</span>
                  </button>
                );
              })
            : null}
          <span aria-hidden className="my-1.5 h-px w-8 shrink-0 bg-white/15" />
          <button type="button" onClick={onSearch} aria-label="Cerca" aria-pressed={searching} className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-full", searching ? "bg-primary text-primary-fg" : "bg-white/[0.07]")}>
            <Glyph name="search" size={19} />
          </button>
          <button type="button" onClick={onClose} aria-label="Chiudi il menu" className="mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07]">
            <Glyph name="close" size={20} />
          </button>
        </nav>,
        document.body,
      ) : null}
    </div>
  );
}

/** In fondo a ogni pagina: il passo successivo più naturale. */
export function NextCard({ path, onGo }: { path: string; onGo?: () => void }) {
  const next = nextShortcut(path);
  if (!next || path === "/") return null;
  return (
    <Link to={next.to as "/"} search={(next.search ?? {}) as never} onClick={onGo} className="aa-next mt-6 flex items-center gap-3 rounded-[var(--radius-card)] p-3">
      <AppIcon name={next.icon} enamel={stationOf(next.group)?.enamel} size={46} />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">Continua con</span>
        <span className="block font-display text-xl leading-tight">{next.label}</span>
        <span className="block truncate text-xs text-muted">{next.hint}</span>
      </span>
      <Glyph name="chevron" size={18} className="text-muted" />
    </Link>
  );
}
