import { useArcherSetup } from "@/lib/arcieri/setup";
import { CURIOSITA, randomCuriosita } from "@/lib/arcieri/curiosita";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { SHORTCUTS, STATIONS, nextShortcut, shortcutById, usePinned, type Shortcut } from "@/lib/arcieri/shortcuts";
import { cx } from "./kit";
import { AppIcon, Glyph } from "./icons";

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
export function PathMap({ onPick, current, showSearch = false }: { onPick?: () => void; current?: string; showSearch?: boolean }) {
  const [q, setQ] = useState("");
  const [recent] = useState(readRecent);
  const query = q.trim().toLowerCase();
  const found = query ? SHORTCUTS.filter((s) => `${s.label} ${s.hint}`.toLowerCase().includes(query)) : [];
  const isHere = (s: Shortcut) => !!current && s.to !== "/" && current.startsWith(s.to);
  const go = () => {
    if (navigator.vibrate) navigator.vibrate(8);
    onPick?.();
  };
  return (
    <div className="grid gap-4">
      {showSearch ? <label className="aa-rise flex items-center gap-2 rounded-2xl border border-hair bg-white/[0.05] px-3 focus-within:border-primary/60">
        <Glyph name="eye" size={16} className="text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Cerca tra ${SHORTCUTS.length} voci`} className="min-h-12 w-full bg-transparent text-sm outline-none" />
        {q ? <button type="button" aria-label="Cancella" onClick={() => setQ("")} className="text-muted"><Glyph name="close" size={16} /></button> : null}
      </label> : null}
      {query ? (
        <ul className="grid gap-1">
          {found.map((s, i) => {
            const sta = STATIONS.find((x) => x.id === s.group);
            return (
              <li key={s.id} className="aa-menu-row" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                <Link to={s.to as "/"} search={(s.search ?? {}) as never} onClick={go} className="aa-short flex items-center gap-3 rounded-2xl px-2 py-1.5 active:bg-white/[0.05]">
                  <AppIcon name={s.icon} color={s.color} size={42} className="aa-short-icon" />
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
          {recent.length ? (
            <section className="grid gap-2">
              <p className="px-1 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted">Recenti</p>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {recent.map((s) => (
                  <Link key={s.id} to={s.to as "/"} search={(s.search ?? {}) as never} onClick={go} className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] py-1 pl-1 pr-3 text-xs font-semibold">
                    <AppIcon name={s.icon} color={s.color} size={28} />
                    {s.label}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          <CategoryCarousel current={current} onGo={go} isHere={isHere} />
        </>
      )}
    </div>
  );
}

/**
 * Sezioni del Menu in un carosello infinito: si scorre a destra e a sinistra senza fine, una
 * categoria per pagina con tutte le sue voci; in alto le linguette per saltare a una categoria.
 */
function CategoryCarousel({ current, onGo, isHere }: { current?: string; onGo: () => void; isHere: (s: Shortcut) => boolean }) {
  const COPIES = 5;
  const n = STATIONS.length;
  const mid = Math.floor(COPIES / 2) * n;
  const here = current ? SHORTCUTS.filter((s) => s.to !== "/" && current.startsWith(s.to)).sort((x, y) => y.to.length - x.to.length)[0] : undefined;
  const startAt = Math.max(0, STATIONS.findIndex((st) => st.id === (here?.group ?? "allena")));
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [active, setActive] = useState(startAt);
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
    if (timer.current) window.clearTimeout(timer.current);
    // fermo: se sono vicino ai bordi della lista ripetuta, torno al centro senza scatti visibili
    timer.current = window.setTimeout(() => {
      if (i < n || i >= (COPIES - 1) * n) jump(mid + st, false);
    }, 140);
  };
  const pages = Array.from({ length: COPIES * n }, (_, i) => STATIONS[i % n]);
  return (
    <div className="grid gap-3">
      <div className="flex justify-center gap-1.5" aria-hidden>
        {STATIONS.map((st, k) => <span key={st.id} className="h-1.5 rounded-full transition-all duration-300" style={{ width: k === active ? 18 : 6, background: k === active ? st.color : "rgb(255 255 255 / 0.2)" }} />)}
      </div>
      <div ref={ref} onScroll={onScroll} className="relative -mx-4 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]" style={{ overscrollBehaviorX: "contain" }}>
        {pages.map((st, i) => {
          const items = SHORTCUTS.filter((s) => s.group === st.id);
          const k = i % n;
          return (
            <section key={i} className="aa-cat-page grid min-h-[calc(100dvh-15rem)] w-full shrink-0 snap-center content-start gap-4 px-4 pb-8 pt-1" style={{ ["--cat" as string]: st.color, background: `linear-gradient(180deg, ${st.color}38 0%, ${st.color}1f 35%, ${st.color}12 70%, ${st.color}08 100%)` }}>
              {/* intestazione illustrata della categoria: grande icona con alone, titolo e bersaglio decorativo */}
              <div className="aa-cat-hero relative overflow-hidden rounded-[1.75rem] p-4" style={{ ["--cat" as string]: st.color, background: `linear-gradient(135deg, ${st.color}55, ${st.color}1a 55%, rgba(255,255,255,0.02))` }}>
                <svg aria-hidden viewBox="0 0 200 200" className="aa-cat-rings pointer-events-none absolute -right-10 -top-12 h-52 w-52 opacity-[0.22]">
                  {[96, 78, 60, 42, 24].map((r, k) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#fff" strokeWidth={k === 4 ? 10 : 6} />)}
                  <path d="M0 160 L120 96" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
                  <path d="M10 150 l-14 -2 m14 2 l-6 12" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
                </svg>
                <span aria-hidden className="pointer-events-none absolute -left-16 -bottom-20 h-48 w-48 rounded-full blur-3xl" style={{ background: `${st.color}66` }} />
                <div className="relative flex items-center gap-4">
                  <span className="aa-cat-icon relative grid place-items-center">
                    <span aria-hidden className="absolute inset-[-10px] rounded-[2rem] blur-xl" style={{ background: `${st.color}88` }} />
                    <AppIcon name={st.icon} color={st.color} size={76} className="relative" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-white/70">Sezione {k + 1} di {n}</p>
                    <p className="font-display text-[2.1rem] leading-none text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.35)]">{st.title}</p>
                    <p className="mt-1 text-[0.78rem] leading-snug text-white/80">{st.sub}</p>
                  </div>
                </div>
                <span className="absolute right-3 top-3 rounded-full bg-black/30 px-2 py-0.5 text-[0.62rem] font-semibold text-white/85 backdrop-blur">{items.length} voci</span>
              </div>
              <div className="grid grid-cols-3 gap-x-2 gap-y-6 pt-1">
                {items.map((s, j) => (
                  <Link key={s.id} to={s.to as "/"} search={(s.search ?? {}) as never} onClick={onGo} aria-current={isHere(s) ? "page" : undefined} className={cx("aa-short flex min-w-0 flex-col items-center gap-1.5 text-center", isHere(s) && "is-here")} style={{ animationDelay: `${j * 35}ms` }}>
                    <AppIcon name={s.icon} color={st.color} size={72} className="aa-short-icon" />
                    <span className="w-full truncate text-[0.78rem] font-semibold leading-tight">{s.label}</span>
                    <span className="line-clamp-2 w-full text-[0.6rem] leading-tight text-muted">{s.hint}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
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
