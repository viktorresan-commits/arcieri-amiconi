import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AppIcon, Glyph, type IconName } from "./icons";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { getMe } from "@/lib/arcieri/members.api";
import type { PublicMember } from "@/lib/arcieri/access";
import { memberLabel, initials } from "@/lib/arcieri/labels";
import { Avatar, Loading, Mark, cx } from "./kit";
import { SHORTCUTS, STATIONS, currentShortcut } from "@/lib/arcieri/shortcuts";
import { NextCard, PathMap, ShortcutEditor, TipCard, rememberPage } from "./shortcuts";
import { CompanyWelcome } from "./compagnia";
import { PercorsoWelcome } from "./percorso-welcome";
import { percorsoOf } from "@/lib/arcieri/percorso";
import { Scene } from "./scene";
import { adoptXp, levelOf, onActivityRefresh, setActivity, useXp, useXpToasts } from "@/lib/arcieri/xp";
import { syncXp } from "@/lib/arcieri/xp.api";
import { AvatarFace } from "./archer-avatar";
import { useAvatar, useAvatarSync } from "./avatar-hero";
import { PersonalizeSheet } from "./personalize";
import { HelpSheet } from "./help-sheet";
import { rememberMenu, takeMenu, useBackRestore } from "@/lib/arcieri/back-restore";
import { onBack } from "@/lib/arcieri/native";
import { redeemCode } from "@/lib/arcieri/staff.api";
import { stopActing } from "@/lib/arcieri/acting.api";
import { clearLoadCache } from "@/lib/arcieri/use-load";
import { refreshCrests } from "@/lib/arcieri/crest";
import { applyPrefs, readPrefs, usePrefs } from "@/lib/arcieri/prefs";

type Ctx = { me: PublicMember; reload: () => void };
const MemberCtx = createContext<Ctx | null>(null);

/** come useMember, ma senza errore fuori dall'app (anteprime) */
export function useMemberMaybe() {
  return useContext(MemberCtx);
}

export function useMember() {
  const ctx = useContext(MemberCtx);
  if (!ctx) throw new Error("Profilo non pronto");
  return ctx;
}



/** «Stai inserendo per …»: finché è attivo, allenamenti, gare e analisi del gesto vanno all'allievo */
function ActingBanner({ name, memberId, onStop }: { name: string; memberId: number; onStop: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="aa-rise flex w-full items-center gap-3 bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
      <Glyph name="user" size={16} strokeWidth={2.2} />
      <Link to="/istruttore/$id" params={{ id: String(memberId) }} className="min-w-0 flex-1 truncate underline-offset-2 hover:underline">
        Stai inserendo per {name}
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          stopActing()
            .then(() => {
              clearLoadCache();
              onStop();
            })
            .finally(() => setBusy(false));
        }}
        className="rounded-full bg-black/85 px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
      >
        Fine
      </button>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<PublicMember | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [menu, setMenu] = useState(false);
  const [menuSearch, setMenuSearch] = useState(false);
  const [editShort, setEditShort] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [help, setHelp] = useState(false);
  // invito a una compagnia arrivato da WhatsApp (?invito=CODICE): si tiene da parte finché la persona entra
  useState(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("invito");
      if (code) localStorage.setItem("aa-invito", code.toUpperCase().slice(0, 24));
    } catch {
      /* niente */
    }
    return 0;
  });
  const [inviteMsg, setInviteMsg] = useState("");
  const [helpSeen, setHelpSeen] = useState(true);
  useEffect(() => {
    try {
      setHelpSeen(localStorage.getItem("aa-help-seen") === "1");
    } catch {
      /* archivio non disponibile */
    }
  }, []);
  const openHelp = () => {
    setHelp(true);
    setHelpSeen(true);
    try {
      localStorage.setItem("aa-help-seen", "1");
    } catch {
      /* archivio non disponibile */
    }
  };
  const [offline, setOffline] = useState(false);
  const avatar = useAvatar();
  useAvatarSync(avatar.shown);
  const xp = useXp();
  // i punti vanno anche sul server (poco dopo ogni guadagno): il livello si vede sul profilo
  // e un altro telefono riparte da lì. Mentre il fondatore inserisce per un altro, non si manda niente.
  const actingNow = Boolean(me?.acting);
  // anche allenamenti e gare registrati fanno punti: li calcola il server, si chiedono dopo ogni salvataggio
  const [xpTick, setXpTick] = useState(0);
  useEffect(() => onActivityRefresh(() => setXpTick((n) => n + 1)), []);
  useEffect(() => {
    if (!me || actingNow) return;
    const t = window.setTimeout(() => {
      // si mandano solo i punti del telefono; quelli di allenamenti e gare tornano a parte
      syncXp({ data: { xp: xp.own } })
        .then((r) => {
          adoptXp(r.xp);
          setActivity(r.activity);
        })
        .catch(() => {
          /* senza rete: si riprova al prossimo guadagno */
        });
    }, 2500);
    return () => window.clearTimeout(t);
  }, [xp.own, xpTick, Boolean(me), actingNow]);
  // notizie non lette: le scrive la Home quando carica la bacheca
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const read = () => setUnread(Number(localStorage.getItem("aa-unread") || 0) || 0);
    read();
    window.addEventListener("aa-unread", read);
    return () => window.removeEventListener("aa-unread", read);
  }, []);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const href = useRouterState({ select: (s) => s.location.href });
  // indietro = esattamente dove si era: scorrimento della pagina e, se si era partiti dal Menu, il Menu aperto allo stesso punto
  const menuBox = useRef<HTMLDivElement>(null);
  const menuTop = useRef<number | null>(null);
  useBackRestore(href, (key) => {
    const m = takeMenu(key);
    setHelp(false);
    if (m) {
      menuTop.current = m.top;
      setMenuSearch(m.search);
      setMenu(true);
    } else {
      setMenu(false);
    }
  });
  useLayoutEffect(() => {
    if (menu && menuTop.current != null && menuBox.current) {
      menuBox.current.scrollTop = menuTop.current;
      menuTop.current = null;
    }
  }, [menu]);
  // tasto indietro di Android: prima chiude ciò che è aperto sopra la pagina
  useEffect(() => {
    if (!(menu || help || prefsOpen || editShort)) return;
    return onBack(() => {
      if (editShort) setEditShort(false);
      else if (prefsOpen) setPrefsOpen(false);
      else if (help) setHelp(false);
      else setMenu(false);
      return true;
    });
  }, [menu, help, prefsOpen, editShort]);
  const { prefs } = usePrefs();
  const navigate = useNavigate();
  const here = currentShortcut(path);
  useEffect(() => {
    rememberPage(path);
  }, [path]);

  useLayoutEffect(() => {
    const root = document.querySelector("main");
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = new Set<Element>();
    let count = 0;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entry.target.classList.toggle("is-in", entry.isIntersecting);
      },
      { threshold: 0.01, rootMargin: "8% 0px" },
    );
    const arm = (node: Element) => {
      if (!(node instanceof HTMLElement) || seen.has(node) || !node.matches(".aa-glow-panel, .aa-tile")) return;
      seen.add(node);
      node.classList.add("aa-watch");
      node.dataset.side = count % 2 ? "right" : "left";
      count += 1;
      if (reduce) node.classList.add("is-in");
      else io.observe(node);
    };
    const scan = (base: ParentNode) => {
      if (base instanceof Element) arm(base);
      base.querySelectorAll(".aa-glow-panel, .aa-tile").forEach(arm);
    };
    scan(root);
    const mo = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) scan(node);
        });
      }
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [path]);

  useEffect(() => {
    applyPrefs(readPrefs());
    const onOff = () => setOffline(!navigator.onLine);
    onOff();
    window.addEventListener("online", onOff);
    window.addEventListener("offline", onOff);
    return () => {
      window.removeEventListener("online", onOff);
      window.removeEventListener("offline", onOff);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    getMe()
      .then((row) => {
        if (!cancel) setMe(row);
      })
      .catch((e: unknown) => {
        if (!cancel) setError(e instanceof Error ? e.message : "Errore");
      });
    return () => {
      cancel = true;
    };
  }, [user?.id, nonce]);

  useEffect(() => {
    if (!me) return;
    let code = "";
    try {
      code = localStorage.getItem("aa-invito") || "";
    } catch {
      /* niente */
    }
    if (!code) return;
    try {
      localStorage.removeItem("aa-invito");
    } catch {
      /* niente */
    }
    redeemCode({ data: { code } })
      .then((r) => {
        sessionStorage.setItem("aa-company-ok", "1");
        refreshCrests();
        setInviteMsg(r.message);
      })
      .catch((e: unknown) => setInviteMsg(e instanceof Error ? `Invito: ${e.message}` : "Invito non valido."));
  }, [me?.id]);

  if (isPending || (user && !me && !error)) return <Loading />;
  if (!user || error === "Unauthorized") return <RedirectToSignIn />;
  if (!me) return <main className="p-6 text-sm text-danger">{error || "Profilo non disponibile."}</main>;

  const label = memberLabel(me, [me]);
  // voci che questa persona non può aprire, e il percorso dei nuovi (prime 6 funzioni)
  // squadra admin, allenatori e segreteria li vede solo chi ha un incarico
  // voci che ora vivono dentro un'altra pagina: Il tuo arciere nel Profilo, Stima distanze in Distanze e bersagli,
  // Quiz in Lezioni, Tempo di allungo in Allungo, Convertitore a comparsa vicino ai campi, Segreteria in Gestione compagnia
  const hide = ["avatar", "stima", "quiz", "tempi", "unita", "segreteria", "routine", "respiro", "timer", "storico-gesto", ...(me.hasPlans ? [] : ["schede"]), ...(me.canCoach ? [] : ["istruttore"]), ...(me.canSegreteria ? [] : ["segreteria"]), ...(me.canStaff ? [] : ["staff"])];
  const focus = me.essenziale ? percorsoOf(me.percorso)?.focus ?? null : null;
  const lvl = levelOf(xp.xp);


  const nav = [
    { to: "/", label: "Casa", icon: "home" as IconName },
    { to: "/allenamento", label: "Tiro", icon: "bow" as IconName },
    { to: "/squadra", label: "Compagnia", icon: "team" as IconName },
  ] as const;
  const bottom = [
    { to: "/", label: "Casa", icon: "home" as IconName, match: (p: string) => p === "/" },
    { to: "/gare", label: "Gare", icon: "flag" as IconName, match: (p: string) => p.startsWith("/gare") },
    { to: "/squadra", label: "Compagnia", icon: "team" as IconName, match: (p: string) => p === "/squadra" || p.startsWith("/arciere/") || p.startsWith("/compagnia") },
  ];

  return (
    <MemberCtx.Provider value={{ me, reload: () => setNonce((n) => n + 1) }}>
      <div className="aa-app min-h-dvh text-fg" data-app="arcieri-amiconi">
        <Scene path={path} />
        <XpToasts />
        <aside className="aa-side inset-y-0 left-0 z-[60] hidden w-60 flex-col overflow-hidden border-r border-line bg-elev px-4 py-5 md:flex">
          <Link to="/" className="mb-6 flex items-center gap-2">
            <Mark />
            <span className="font-display text-2xl leading-none">
              ARCIERI
              <br />
              AMICONI
            </span>
          </Link>
          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} label={item.label} active={item.to === "/squadra" ? path === "/squadra" || path.startsWith("/arciere/") : path === item.to || (item.to !== "/" && path.startsWith(item.to))} />
            ))}
            {STATIONS.map((st) => {
              // tutte le voci della categoria, come nel Menu dell'app (anche quelle che aprono una scheda di una pagina)
              const items = SHORTCUTS.filter((sc) => sc.group === st.id && !hide.includes(sc.id));
              if (!items.length) return null;
              return (
                <div key={st.id} className="mt-3 grid gap-0.5">
                  <p className="px-3 pb-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted/80">{st.title}</p>
                  {items.map((sc) => (
                    <Link key={sc.id} to={sc.to as "/"} search={(sc.search ?? {}) as never} hash={sc.hash} className={cx("aa-sidelink flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm font-medium", !sc.search && !sc.hash && sc.to !== "/" && path.startsWith(sc.to) ? "is-active" : "text-muted")} style={{ "--c": sc.color } as CSSProperties}>
                      <AppIcon name={sc.icon} color={sc.color} size={26} />
                      <span className="truncate">{sc.label}</span>
                    </Link>
                  ))}
                </div>
              );
            })}
            <Link to="/guida" className={cx("aa-sidelink mt-3 flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm font-medium", path === "/guida" ? "is-active" : "text-muted")} style={{ "--c": "#646c7a" } as CSSProperties}>
              <AppIcon name="book" color="#646c7a" size={26} />
              Guida
            </Link>
          </nav>
          <Link to="/profilo" className="mt-auto flex items-center gap-3 pt-4">
            <Avatar label={initials(label)} color={me.avatarColor} photo={me.photoUrl} size="lg" className="aa-pin" />
            <span className="truncate text-sm font-semibold">{label}</span>
          </Link>
        </aside>
        <div className="aa-main relative z-0 min-w-0 md:ml-60">
          {path === "/" ? (
            /* Home: in alto il profilo (volto, nome, categoria e livello, esperienza) e gli avvisi */
            <header className="aa-appheader aa-homehead aa-bar sticky top-0 z-20 flex items-center gap-3 border-b px-3 py-2 backdrop-blur-md md:px-4">
              <Link to="/profilo" aria-label="Il tuo profilo" className={cx("relative grid h-11 w-11 shrink-0 place-items-center rounded-full p-[2.5px]", me.role === "admin" ? "aa-facering aa-facering-admin" : "aa-ring")}>
                <span className="relative z-[1] grid h-full w-full place-items-center overflow-hidden rounded-full bg-bg">
                  <AvatarFace look={avatar.shown} className="h-full w-full" />
                </span>
              </Link>
              <Link to="/obiettivi" className="min-w-0 flex-1" aria-label={`${label}, livello ${lvl.level}`}>
                <p className="flex min-w-0 items-baseline gap-2">
                  <b className="truncate font-display text-[1.15rem] leading-none">{label}</b>
                  <span className="aa-tone shrink-0 text-[0.7rem] font-semibold">{me.category ? `${me.category} · ` : ""}Livello {lvl.level}</span>
                </p>
                <span className="mt-1 flex items-center gap-2">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span className="aa-xp block h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.round((lvl.into / Math.max(1, lvl.need)) * 100)}%` }} />
                  </span>
                  <span className="shrink-0 text-[0.62rem] tabular-nums text-white/70">{lvl.into.toLocaleString("it-IT")}/{lvl.need.toLocaleString("it-IT")} XP</span>
                </span>
              </Link>
              <Link to="/bacheca" aria-label={unread > 0 ? `Avvisi, ${unread} da leggere` : "Avvisi"} className="aa-bell relative grid h-10 w-10 shrink-0 place-items-center rounded-full">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
                {unread > 0 ? <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#d6402f] px-1 text-[0.66rem] font-bold text-white">{unread > 9 ? "9+" : unread}</span> : null}
              </Link>
            </header>
          ) : (
          <header className="aa-appheader aa-bar sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b px-4 backdrop-blur-md">
              <div className="flex min-w-0 items-center gap-2">
                <button type="button" onClick={() => (window.history.length > 1 ? window.history.back() : void navigate({ to: "/" }))} aria-label="Indietro" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06] active:scale-95">
                  <Glyph name="chevron" size={18} className="rotate-180" />
                </button>
                {here ? <AppIcon name={here.icon} color={here.color} size={30} /> : null}
                <p className="truncate font-display text-xl leading-none">{here?.label ?? "Arcieri Amiconi"}</p>
              </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Link to="/obiettivi" className="flex h-9 items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 text-[0.72rem] font-semibold" aria-label={`Livello ${lvl.level}`}>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#ffd27a] font-display text-[0.8rem] text-[#1a1408]">{lvl.level}</span>
                <span className="h-1.5 w-9 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-[#ffd27a]" style={{ width: `${Math.round((lvl.into / Math.max(1, lvl.need)) * 100)}%` }} /></span>
              </Link>
              <button type="button" onClick={openHelp} className={cx("aa-helpbtn grid h-9 w-9 place-items-center rounded-full bg-white/[0.06]", helpSeen ? "" : "is-new")} aria-label="Aiuto su questa pagina">
                <Glyph name="help" size={18} />
              </button>
              <Link to="/bacheca" className="relative grid h-9 w-9 place-items-center rounded-full bg-white/[0.06]" aria-label="News">
                <Glyph name="megaphone" size={17} />
                {unread > 0 ? <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.58rem] font-bold text-accent-fg">{unread > 9 ? "9+" : unread}</span> : null}
              </Link>
              <Link to="/allenamento" className="hidden h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg md:flex">
                <Glyph name="plus" size={16} strokeWidth={2.4} /> Nuovo tiro
              </Link>
            </div>
          </header>
          )}
          {inviteMsg ? (
            <button type="button" onClick={() => setInviteMsg("")} className="aa-rise flex w-full items-center justify-between gap-2 bg-primary px-4 py-2 text-left text-sm font-semibold text-primary-fg">
              {inviteMsg}
              <Glyph name="close" size={16} />
            </button>
          ) : null}
          {me.acting ? <ActingBanner name={me.acting.name} memberId={me.acting.memberId} onStop={() => setNonce((n) => n + 1)} /> : null}
          {offline ? <p className="bg-accent px-4 py-2 text-sm text-accent-fg">Sei offline. Il tiro resta sul telefono e si sincronizza al ritorno della rete.</p> : null}
          <main key={path} className="aa-page mx-auto w-full min-w-0 max-w-3xl overflow-x-clip px-4 py-6 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-12">
            {children}
            <NextCard path={path} />
            {prefs.home.tips ? <TipCard key={path} /> : null}
            <CompanyWelcome />
            {me.percorso === "" ? <PercorsoWelcome onDone={() => setNonce((n) => n + 1)} /> : null}
          </main>
          {/* barra in basso: solo voci che in Home non ci sono già (Tiro rapido, Da foto, Segnapunti e Statistiche stanno sul gioco) */}
          <nav className="aa-bottomnav aa-bar-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 items-end border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
            {bottom.map((item) => <BottomLink key={item.to} item={item} active={item.match(path)} />)}
            <button type="button" className={cx("flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", menu ? "aa-tone-hi" : "text-white/75")} onClick={() => setMenu(true)}>
              <span className="grid h-8 w-14 place-items-center"><Glyph name="grid" size={22} /></span>
              Menu
            </button>
          </nav>
          {menu ? (
            <div ref={menuBox} className="aa-sheet fixed inset-0 z-40 overflow-y-auto bg-bg pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:hidden">
              <div className="aa-appheader aa-bar sticky top-0 z-10 flex h-14 items-center justify-between border-b px-4 backdrop-blur-md">
                <p className="font-display text-xl">Menu</p>
                <div className="flex items-center gap-2">
                  <button type="button" className={cx("grid h-11 w-11 place-items-center rounded-full", menuSearch ? "bg-primary text-primary-fg" : "bg-white/5")} onClick={() => setMenuSearch((v) => !v)} aria-label="Cerca" aria-pressed={menuSearch}>
                    <Glyph name="search" size={19} />
                  </button>
                  <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-white/5" onClick={() => setMenu(false)} aria-label="Chiudi">
                    <Glyph name="close" size={20} />
                  </button>
                </div>
              </div>
              <div className="grid gap-3 px-4">
                <PathMap
                  current={path}
                  showSearch={menuSearch}
                  focus={focus}
                  hide={hide}
                  onPick={() => {
                    rememberMenu(menuBox.current?.scrollTop ?? 0, menuSearch);
                    setMenu(false);
                  }}
                />
              </div>
            </div>
          ) : null}
          {help ? <HelpSheet path={path} onClose={() => setHelp(false)} onMenu={() => setMenu(true)} /> : null}
          {prefsOpen ? <PersonalizeSheet onClose={() => setPrefsOpen(false)} /> : null}
          {editShort ? <ShortcutEditor onClose={() => setEditShort(false)} /> : null}
        </div>
      </div>
    </MemberCtx.Provider>
  );
}

function BottomLink({ item, active }: { item: { to: string; label: string; icon: IconName }; active: boolean }) {
  return (
    <Link to={item.to} className={cx("aa-tab flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "is-active aa-tone-hi" : "text-white/75")}>
      <span className="aa-tab-pill relative grid h-8 w-14 place-items-center rounded-full">
        <Glyph name={item.icon} size={22} strokeWidth={active ? 2.1 : 1.7} className="relative transition-transform duration-300" />
      </span>
      {item.label}
    </Link>
  );
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link to={to} className={cx("flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium", active ? "bg-primary text-primary-fg" : "text-muted")}>
      {label}
    </Link>
  );
}

function XpToasts() {
  const list = useXpToasts();
  if (!list.length) return null;
  return (
    <div className="aa-xp-toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="aa-xp-toast">
          <Glyph name="daily" size={22} className="aa-tone-hi shrink-0" />+{t.n} punti
          <span className="max-w-40 truncate font-semibold opacity-80">· {t.why}</span>
        </div>
      ))}
    </div>
  );
}
