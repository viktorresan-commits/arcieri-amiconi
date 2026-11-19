import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  House,
  Menu,
  Plus,
  Target,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { getMe } from "@/lib/arcieri/members.api";
import type { PublicMember } from "@/lib/arcieri/access";
import { greet, romeHour } from "@/lib/arcieri/time";
import { memberLabel, initials } from "@/lib/arcieri/labels";
import { Avatar, Loading, Mark, cx } from "./kit";

type Ctx = { me: PublicMember; reload: () => void };
const MemberCtx = createContext<Ctx | null>(null);

export function useMember() {
  const ctx = useContext(MemberCtx);
  if (!ctx) throw new Error("Profilo non pronto");
  return ctx;
}

const MORE = [
  ["/profilo", "Profilo"],
  ["/calendario", "Calendario"],
  ["/classifiche", "Classifiche"],
  ["/statistiche", "Statistiche"],
  ["/sfide", "Sfide"],
  ["/attrezzatura", "Attrezzatura"],
  ["/gare", "Gare"],
  ["/obiettivi", "Obiettivi"],
  ["/bacheca", "Bacheca"],
  ["/confronta", "Confronta"],
  ["/gioco", "Giochiamo"],
  ["/guida", "Guida"],
] as const;

const INKS = [
  { id: "verde", color: "#1f5c38" },
  { id: "blu", color: "#2f6fbe" },
  { id: "rosso", color: "#c4473d" },
  { id: "giallo", color: "#d7b56a" },
  { id: "viola", color: "#7a4bb5" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<PublicMember | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [menu, setMenu] = useState(false);
  const [quick, setQuick] = useState(false);
  const [ink, setInk] = useState("verde");
  const [offline, setOffline] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

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
    setInk(document.documentElement.dataset.ink || "verde");
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

  if (isPending || (user && !me && !error)) return <Loading />;
  if (!user || error === "Unauthorized") return <RedirectToSignIn />;
  if (!me) return <main className="p-6 text-sm text-danger">{error || "Profilo non disponibile."}</main>;

  const label = memberLabel(me, [me]);
  const hour = greet(romeHour());

  function pickInk(next: string) {
    document.documentElement.dataset.ink = next;
    localStorage.setItem("aa-ink", next);
    setInk(next);
  }

  const nav = [
    { to: "/", label: "Casa", icon: House },
    { to: "/allenamento", label: "Tiro", icon: Target },
    { to: "/squadra", label: "Squadra", icon: Users },
  ] as const;

  return (
    <MemberCtx.Provider value={{ me, reload: () => setNonce((n) => n + 1) }}>
      <div className="aa-app min-h-dvh text-fg" data-app="arcieri-amiconi">
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
            {MORE.map(([to, text]) => (
              <NavLink key={to} to={to} label={text} active={path === to} />
            ))}
          </nav>
          <Link to="/profilo" className="mt-auto flex items-center gap-3 pt-4">
            <Avatar label={initials(label)} color={me.avatarColor} photo={me.photoUrl} size="lg" className="aa-pin" />
            <span className="truncate text-sm font-semibold">{label}</span>
          </Link>
        </aside>
        <div className="aa-main relative z-0 min-w-0 md:ml-60">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line/60 bg-bg/85 px-4 backdrop-blur-md">
            <Link to="/profilo" className="flex min-w-0 items-center gap-3">
              <Avatar label={initials(label)} color={me.avatarColor} photo={me.photoUrl} className="aa-pin shrink-0" />
              <span className="min-w-0">
                <p className="truncate text-[11px] leading-tight text-muted">{hour}</p>
                <p className="truncate font-display text-xl leading-none">{label}</p>
              </span>
            </Link>
            <Link to="/allenamento" className="hidden h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg md:flex">
              <Plus className="h-4 w-4" /> Nuovo tiro
            </Link>
          </header>
          {offline ? <p className="bg-accent px-4 py-2 text-sm text-accent-fg">Sei offline. Il tiro resta sul telefono e si sincronizza al ritorno della rete.</p> : null}
          <main key={path} className="aa-rise mx-auto w-full min-w-0 max-w-3xl overflow-x-clip px-4 py-6 pb-28 md:pb-10">{children}</main>
          <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t border-line/60 bg-elev/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
            {[nav[0], nav[1]].map((item) => <BottomLink key={item.to} item={item} active={path === item.to || (item.to !== "/" && path.startsWith(item.to))} />)}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setQuick(true)}
                aria-label="Nuovo tiro"
                className="-mt-7 mb-2 grid h-16 w-16 place-items-center rounded-full border-4 border-bg bg-primary text-primary-fg shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] active:scale-95"
              >
                <Plus className="h-8 w-8" strokeWidth={2.6} />
              </button>
            </div>
            <BottomLink item={nav[2]} active={path === "/squadra" || path.startsWith("/arciere/")} />
            <button type="button" className="flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] text-muted" onClick={() => setMenu(true)}>
              <Menu className="h-5 w-5" />
              Menu
            </button>
          </nav>
          {quick ? (
            <div className="fixed inset-0 z-40 flex items-end bg-black/50 md:hidden" onClick={() => setQuick(false)}>
              <div className="aa-rise grid w-full gap-2 rounded-t-3xl border-t border-line bg-elev p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]" onClick={(e) => e.stopPropagation()}>
                <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-line" />
                <p className="font-display text-2xl">Cosa fai?</p>
                {([
                  ["/allenamento", "Allenamento", "Volée, foto del bersaglio, gesto", Target],
                  ["/gare", "Gara", "Iscrizioni e risultati", Trophy],
                  ["/calendario", "Calendario", "Allenamenti e gare in programma", CalendarDays],
                ] as const).map(([to, title, sub, Icon]) => (
                  <Link key={to} to={to} onClick={() => setQuick(false)} className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary"><Icon className="h-6 w-6" /></span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{title}</span>
                      <span className="block truncate text-xs text-muted">{sub}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {menu ? (
            <div className="fixed inset-0 z-40 bg-bg md:hidden">
              <div className="flex h-14 items-center justify-between px-4">
                <p className="font-display text-2xl">Menu</p>
                <button type="button" className="grid h-11 w-11 place-items-center" onClick={() => setMenu(false)} aria-label="Chiudi">
                  <X />
                </button>
              </div>
              <div className="grid gap-2 px-4">
                <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
                  <span className="text-sm font-semibold">Colore dell'app</span>
                  <span className="flex items-center gap-2" role="group" aria-label="Colore">
                    {INKS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-label={item.id}
                        aria-pressed={ink === item.id}
                        onClick={() => pickInk(item.id)}
                        className={cx("h-7 w-7 rounded-full border-2", ink === item.id ? "border-fg" : "border-transparent")}
                        style={{ background: item.color }}
                      />
                    ))}
                  </span>
                </div>
                {MORE.map(([to, text]) => (
                  <Link key={to} to={to} onClick={() => setMenu(false)} className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-4 font-semibold">
                    {to === "/gioco" ? <Mark className="h-8 w-8" /> : null}
                    {text}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </MemberCtx.Provider>
  );
}

function BottomLink({ item, active }: { item: { to: string; label: string; icon: typeof House }; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link to={item.to} className={cx("flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px]", active ? "text-primary" : "text-muted")}>
      <Icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2} />
      {item.label}
      <span className={cx("mt-0.5 h-1 w-1 rounded-full", active ? "bg-primary" : "bg-transparent")} />
    </Link>
  );
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link to={to} className={cx("flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium", active ? "bg-primary text-primary-fg" : "text-muted")}>
      {to === "/gioco" ? <Mark className="h-6 w-6" /> : null}
      {label}
    </Link>
  );
}
