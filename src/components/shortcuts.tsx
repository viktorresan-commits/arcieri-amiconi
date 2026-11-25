import { useArcherSetup } from "@/lib/arcieri/setup";
import { CURIOSITA, randomCuriosita } from "@/lib/arcieri/curiosita";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { SHORTCUTS, STATIONS, nextShortcut, shortcutById, usePinned, type Shortcut } from "@/lib/arcieri/shortcuts";
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
      <AppIcon name={s.icon} color={s.color} size={size === "lg" ? 56 : 54} className="aa-short-icon" />
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
      <AppIcon name={s.icon} color={s.color} size={62} />
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
                <AppIcon name={s.icon} color={s.color} size={38} />
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
                <AppIcon name={s.icon} color={s.color} size={38} />
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
        <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#7cf0a8]/90">{personal ? "Per il tuo arco" : "Lo sapevi?"}</span>
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
export function PathMap({ onPick, current, showSearch = false, focus = null, hide = [] }: { onPick?: () => void; current?: string; showSearch?: boolean; /** percorso dei nuovi: le voci da mostrare prima di tutte */ focus?: string[] | null; /** voci che questa persona non può aprire */ hide?: string[] }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(() => !focus || menuAllOpen());
  const query = q.trim().toLowerCase();
  const visible = SHORTCUTS.filter((s) => !hide.includes(s.id));
  const found = query ? visible.filter((s) => `${s.label} ${s.hint}`.toLowerCase().includes(query)) : [];
  const mine = focus ? focus.map((id) => shortcutById(id)).filter((s): s is Shortcut => !!s && !hide.includes(s.id)) : [];
  const isHere = (s: Shortcut) => !!current && s.to !== "/" && current.startsWith(s.to);
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
                  <AppIcon name={s.icon} accent={sta?.color} size={42} className="aa-short-icon" glow={lastTouched[s.group] === s.id} />
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
                    <AppIcon name={s.icon} color={s.color} size={60} className="aa-short-icon" glow={lastTouched[s.group] === s.id} />
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
          {all ? <CategoryCarousel current={current} onGo={(s) => { touch(s); go(); }} isHere={isHere} hide={hide} lastTouched={lastTouched} /> : null}
        </>
      )}
    </div>
  );
}

/**
 * Sezioni del Menu in un carosello infinito: si scorre a destra e a sinistra senza fine, una
 * categoria per pagina con tutte le sue voci; in alto le linguette per saltare a una categoria.
 */
function CategoryCarousel({ current, onGo, isHere, hide = [], lastTouched = {} }: { current?: string; onGo: (s: Shortcut) => void; isHere: (s: Shortcut) => boolean; hide?: string[]; /** per sezione, l'ultima voce toccata */ lastTouched?: Record<string, string> }) {
  const COPIES = 5;
  const n = STATIONS.length;
  const mid = Math.floor(COPIES / 2) * n;
  const here = current ? SHORTCUTS.filter((s) => s.to !== "/" && current.startsWith(s.to)).sort((x, y) => y.to.length - x.to.length)[0] : undefined;
  // si riapre sulla categoria in cui si era (anche tornando indietro da una voce), altrimenti su quella della pagina
  const remembered = (() => {
    try {
      return sessionStorage.getItem("aa-menu-cat") || "";
    } catch {
      return "";
    }
  })();
  const startAt = Math.max(0, STATIONS.findIndex((st) => st.id === (remembered || here?.group || "allena")));
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [active, setActive] = useState(startAt);
  const [cur, setCur] = useState(mid + startAt);
  useEffect(() => {
    try {
      sessionStorage.setItem("aa-menu-cat", STATIONS[active].id);
    } catch {
      /* niente */
    }
  }, [active]);
  const pageW = () => (ref.current?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1;
  const gap = 0;
  const leftOf = (i: number) => {
    const el = ref.current;
    const page = el?.children[i] as HTMLElement | undefined;
    if (!el || !page) return 0;
    return page.offsetLeft - (el.clientWidth - page.offsetWidth) / 2;
  };
  const jump = (i: number, smooth: boolean) => ref.current?.scrollTo({ left: leftOf(i), behavior: smooth ? "smooth" : "auto" });
  useLayoutEffect(() => {
    jump(mid + startAt, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / (pageW() + gap));
    const st = ((i % n) + n) % n;
    if (st !== active) setActive(st);
    if (i !== cur) setCur(i);
    if (timer.current) window.clearTimeout(timer.current);
    // fermo: se sono vicino ai bordi della lista ripetuta, torno al centro senza scatti visibili
    timer.current = window.setTimeout(() => {
      if (i < n || i >= (COPIES - 1) * n) jump(mid + st, false);
    }, 140);
  };
  const pages = Array.from({ length: COPIES * n }, (_, i) => STATIONS[i % n]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_4.1rem] items-start gap-1.5">
      <div ref={ref} onScroll={onScroll} className="relative -ml-4 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]" style={{ overscrollBehaviorX: "contain" }}>
        {pages.map((st, i) => {
          const items = SHORTCUTS.filter((s) => s.group === st.id && !hide.includes(s.id));
          const k = i % n;
          return (
            <section key={i} className={cx("aa-cat-page grid min-h-[calc(100dvh-10rem)] w-full shrink-0 snap-center content-start gap-3 rounded-r-[1.6rem] pb-8 pl-4 pr-2.5 pt-2", i === cur && "is-active")} data-k={k} style={{ ["--cat" as string]: st.color, background: `linear-gradient(180deg, color-mix(in srgb, ${st.color} 16%, transparent) 0%, color-mix(in srgb, ${st.color} 9%, transparent) 35%, color-mix(in srgb, ${st.color} 5%, transparent) 70%, color-mix(in srgb, ${st.color} 2%, transparent) 100%)` }}>
              {/* intestazione della sezione: icona con alone, titolo e bersaglio decorativo */}
              <div className="aa-cat-hero relative overflow-hidden rounded-[1.3rem] px-3 py-2.5" style={{ ["--cat" as string]: st.color, background: `linear-gradient(135deg, color-mix(in srgb, ${st.color} 28%, transparent), color-mix(in srgb, ${st.color} 8%, transparent) 55%, rgba(255,255,255,0.02))` }}>
                <svg aria-hidden viewBox="0 0 200 200" className="aa-cat-rings pointer-events-none absolute -right-12 -top-14 h-44 w-44 opacity-[0.2]">
                  {[96, 78, 60, 42, 24].map((r, j) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#fff" strokeWidth={j === 4 ? 10 : 6} />)}
                </svg>
                <div className="relative flex items-center gap-3">
                  <span className="aa-cat-icon relative grid place-items-center">
                    <span aria-hidden className="absolute inset-[-8px] rounded-full blur-xl" style={{ background: `color-mix(in srgb, ${st.color} 40%, transparent)` }} />
                    <AppIcon name={st.icon} size={46} className="relative" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[1.6rem] leading-none text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.35)]">{st.title}</p>
                    <p className="mt-0.5 text-[0.72rem] leading-snug text-white/80">{st.sub}</p>
                  </div>
                  <span className="ml-auto self-start rounded-full bg-black/30 px-2 py-0.5 text-[0.6rem] font-semibold tabular-nums text-white/85">{items.length}</span>
                </div>
              </div>
              {/* le voci: tre per fila, icone tutte della stessa misura e allineate */}
              <div className="grid grid-cols-3 gap-x-1.5 gap-y-2">
                {items.map((s, j) => (
                  <Link key={s.id} to={s.to as "/"} search={(s.search ?? {}) as never} onClick={() => onGo(s)} aria-current={isHere(s) ? "page" : undefined} className={cx("aa-short aa-cat-tile flex min-w-0 flex-col items-center gap-1 rounded-[1.2rem] px-0.5 pb-2 pt-2.5 text-center", isHere(s) && "is-here")} style={{ ["--i" as string]: j }}>
                    <AppIcon name={s.icon} size={58} className="aa-short-icon" glow={lastTouched[st.id] === s.id} />
                    <span className="line-clamp-2 min-h-[2em] w-full text-[0.74rem] font-semibold leading-tight">{s.label}</span>
                    <span className="line-clamp-2 w-full text-[0.58rem] leading-tight text-muted">{s.hint}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {/* sezioni in colonna sul margine destro: icona e nome, quella aperta in evidenza */}
      <nav className="aa-sec-rail sticky top-16 z-[5] -mr-2 grid gap-1 py-1" role="tablist" aria-label="Sezioni del menu" aria-orientation="vertical">
        {STATIONS.map((st, k) => (
          <button
            key={st.id}
            type="button"
            role="tab"
            aria-selected={k === active}
            onClick={() => jump(mid + k, true)}
            className={cx("aa-sec-tab grid justify-items-center gap-0.5 rounded-2xl px-0.5 pb-1 pt-1.5 text-[0.6rem] font-semibold leading-tight transition", k === active && "is-on")}
            style={{ ["--acc" as string]: st.color }}
          >
            <AppIcon name={st.icon} size={k === active ? 38 : 32} />
            <span className="w-full truncate text-center">{st.title}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/** In fondo a ogni pagina: il passo successivo più naturale. */
export function NextCard({ path, onGo }: { path: string; onGo?: () => void }) {
  const next = nextShortcut(path);
  if (!next || path === "/") return null;
  return (
    <Link to={next.to as "/"} search={(next.search ?? {}) as never} onClick={onGo} className="aa-next mt-6 flex items-center gap-3 rounded-[var(--radius-card)] p-3">
      <AppIcon name={next.icon} color={next.color} size={46} />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">Continua con</span>
        <span className="block font-display text-xl leading-tight">{next.label}</span>
        <span className="block truncate text-xs text-muted">{next.hint}</span>
      </span>
      <Glyph name="chevron" size={18} className="text-muted" />
    </Link>
  );
}
