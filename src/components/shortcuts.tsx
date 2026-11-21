import { useArcherSetup } from "@/lib/arcieri/setup";
import { CURIOSITA, randomCuriosita } from "@/lib/arcieri/curiosita";
import { useState, type CSSProperties } from "react";
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
    <button type="button" onClick={next} className="mt-6 flex w-full items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.05]">
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
export function PathMap({ onPick, current, onPersonalize }: { onPick?: () => void; current?: string; onPersonalize?: () => void }) {
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
      <label className="flex items-center gap-2 rounded-2xl border border-hair bg-white/[0.05] px-3 focus-within:border-primary/60">
        <Glyph name="eye" size={16} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Cerca tra ${SHORTCUTS.length} voci`} className="min-h-12 w-full bg-transparent text-sm outline-none" />
        {q ? <button type="button" aria-label="Cancella" onClick={() => setQ("")} className="text-muted"><Glyph name="close" size={16} /></button> : null}
      </label>
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
          {STATIONS.map((st, k) => {
            const items = SHORTCUTS.filter((s) => s.group === st.id);
            return (
              <section key={st.id} className="aa-menu-row grid gap-2.5 rounded-3xl border border-white/[0.07] p-3" style={{ animationDelay: `${k * 45}ms`, background: `linear-gradient(160deg, ${st.color}26, transparent 55%)` }}>
                <div className="flex items-center gap-2.5">
                  <AppIcon name={st.icon} color={st.color} size={34} />
                  <div className="min-w-0">
                    <p className="font-display text-lg leading-none">{st.title}</p>
                    <p className="truncate text-[0.7rem] text-muted">{st.sub}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-x-1 gap-y-3">
                  {items.map((s) => (
                    <Link key={s.id} to={s.to as "/"} search={(s.search ?? {}) as never} onClick={go} aria-current={isHere(s) ? "page" : undefined} className={cx("aa-short flex min-w-0 flex-col items-center gap-1 text-center", isHere(s) && "is-here")}>
                      <AppIcon name={s.icon} color={s.color} size={46} className="aa-short-icon" />
                      <span className="w-full truncate text-[0.66rem] font-semibold leading-tight">{s.label}</span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
      {onPersonalize ? (
        <button type="button" onClick={onPersonalize} className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-muted">
          <Glyph name="palette" size={15} /> Personalizza colori, icone e Home
        </button>
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
