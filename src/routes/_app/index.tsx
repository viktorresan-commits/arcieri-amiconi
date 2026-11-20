import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { dashboard, deleteSession } from "@/lib/arcieri/training.api";
import { dismissNote, openNotes } from "@/lib/arcieri/club.api";
import { fmtWhen } from "@/lib/arcieri/time";
import { programById } from "@/lib/arcieri/program";
import { useLoad } from "@/lib/arcieri/use-load";
import { useAvatar } from "@/components/avatar-hero";
import { SkyPicker } from "@/components/archer-3d";
import { HomeGame } from "@/components/home-game";
import { MainGearCard } from "@/components/main-gear";
import { ShortcutRow, TipCard } from "@/components/shortcuts";
import { JourneyCard } from "@/components/journey";
import { TodayCard } from "@/components/today-card";
import { usePrefs } from "@/lib/arcieri/prefs";
import { Glyph } from "@/components/icons";
import { ArrowArt } from "@/components/arrow-art";
import { Button, Card, Empty, ErrorNote, HoldDelete, Loading, cx } from "@/components/kit";

export const Route = createFileRoute("/_app/")({ component: Home });



function useCount(target: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !Number.isFinite(target)) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 720);
      setValue(target * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

function num(value: number, digits = 0) {
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function Rise({ i, className, children }: { i: number; className?: string; children: ReactNode }) {
  return (
    <div className={cx("aa-in", className)} style={{ animationDelay: `${i * 60}ms` }}>
      {children}
    </div>
  );
}

function Home() {
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`dash-${nonce}`, () => dashboard());
  const { prefs } = usePrefs();
  const notes = useLoad(`notes-${nonce}`, () => openNotes());
  const avatar = useAvatar();
  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem("aa-unread", String(data.unread ?? 0));
      window.dispatchEvent(new Event("aa-unread"));
    } catch {
      /* niente */
    }
  }, [data]);
  if (loading) return <Loading />;
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;
  const rankFill = data.rank && data.rank.of > 1 ? ((data.rank.of - data.rank.position) / (data.rank.of - 1)) * 100 : data.rank ? 100 : 0;
  return (
    <div className="grid gap-3">
      <Rise i={0}>
        <div className="grid gap-2">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</p>
              <h1 className="font-display text-[2.1rem] leading-none tracking-tight">Oggi</h1>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {data.month.sessions} uscite e {num(data.month.arrows)} frecce questo mese
                {data.since ? ` · ultimo tiro ${data.since.n} ${data.since.unit === "h" ? (data.since.n === 1 ? "ora" : "ore") : data.since.n === 1 ? "giorno" : "giorni"} fa` : ""}
              </p>
            </div>
            {data.streak > 1 ? <p className="shrink-0 rounded-full bg-[var(--accent-soft,rgba(255,210,122,0.18))] px-2.5 py-1 text-[0.7rem] font-semibold">{data.streak} giorni di fila</p> : null}
          </div>
          <HomeGame look={avatar.shown}>
            <div data-ui className="absolute left-3 top-[5.6rem] grid gap-2" onPointerDown={(e) => e.stopPropagation()}>
              <SkyPicker />
              <Link to="/avatar" aria-label="Personalizza l'arciere" className="grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur">
                <Glyph name="palette" size={18} />
              </Link>
            </div>
          </HomeGame>
          <div className="grid grid-cols-[1.4fr_1fr] gap-2">
            <Link to="/allenamento" search={{ avvia: "rapido" }} className="block">
              <Button className="aa-glow w-full"><Glyph name="bolt" size={18} /> Tiro rapido</Button>
            </Link>
            <Link to="/allenamento" search={{ avvia: "foto" }} className="block">
              <Button variant="ghost" className="w-full"><Glyph name="camera" size={18} /> Da foto</Button>
            </Link>
          </div>
          <MainGearCard compact />
        </div>
      </Rise>
      {prefs.home.shortcuts ? (
        <Rise i={1}>
          <ShortcutRow />
        </Rise>
      ) : null}
      <Rise i={2}>
        <TodayCard />
      </Rise>
      {prefs.home.journey ? (
        <Rise i={2}>
          <JourneyCard totalArrows={data.all.arrows} weekArrows={data.weekArrows} streak={data.streak} />
        </Rise>
      ) : null}
      {prefs.home.tips ? (
        <Rise i={2}>
          <TipCard />
        </Rise>
      ) : null}
      {prefs.home.numbers ? <div className="grid grid-cols-3 gap-2">
        <Rise i={2}><Link to="/statistiche" className="block"><Meter label="Media mese" value={data.month.arrows ? data.month.avg : null} digits={2} color="#e0b15a" /></Link></Rise>
        <Rise i={3}><Link to="/statistiche" className="block"><Meter label="Precisione" value={data.all.precisePct} digits={1} suffix="%" color="#3d8f5f" /></Link></Rise>
        <Rise i={4}><Link to="/statistiche" className="block"><Meter label="Miglior media" value={data.all.bestAvg || null} digits={2} color="#c4a2f2" /></Link></Rise>
        <Rise i={5}><Link to="/statistiche" className="block"><Meter label="Frecce" value={data.all.arrows} color="#5aa6e8" /></Link></Rise>
        <Rise i={6}><Link to="/calendario" className="block"><Meter label="Uscite mese" value={data.month.sessions} color="#9dbea4" /></Link></Rise>
        <Rise i={7}><Link to="/statistiche" className="block"><Meter label="Miglior dist." value={data.bestDistance} suffix=" m" color="#e07a72" /></Link></Rise>
      </div> : null}
      {prefs.home.arrows ? <Rise i={8}>
        <Card>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <p className="aa-section-title">Ultime frecce</p>
            <Link to="/attrezzatura" className="text-[0.68rem] font-semibold text-muted underline-offset-2 hover:underline"><span className="inline-flex items-center gap-1"><Glyph name="palette" size={13} />Personalizza frecce</span></Link>
          </div>
          {data.lastShots.length ? <LastArrows shots={data.lastShots} /> : <p className="text-xs text-muted">Le frecce che tiri compaiono qui.</p>}
        </Card>
      </Rise> : null}
      <Rise i={9}>
        <Link to="/classifiche" className="block">
          <Card>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">Classifica del tuo tiro più frequente</p>
            {data.rank ? (
              <>
                <p className="font-display text-[2rem]"><Count value={data.rank.position} />° <span className="text-xl text-muted">su {data.rank.of}</span></p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg">
                  <div className="aa-grow h-full rounded-full bg-accent" style={{ width: `${rankFill}%`, animationDelay: "280ms" }} />
                </div>
              </>
            ) : (
              <p className="font-display text-[2rem]">—</p>
            )}
          </Card>
        </Link>
      </Rise>
      {data.recent.length ? (
        <div className="grid gap-2">
          <Rise i={10}><Link to="/allenamento" search={{ vista: "storico" }} className="text-xs uppercase tracking-wide text-muted">Allenamenti · tutti</Link></Rise>
          {data.recent.map((s, index) => (
            <Rise key={s.id} i={11 + index}>
              <HoldDelete
                hint={index === 0}
                label="Eliminare questo allenamento?"
                onDelete={() => deleteSession({ data: { id: s.id } }).then(() => setNonce((n) => n + 1))}
              >
                <Link to="/allenamento/$id" params={{ id: String(s.id) }}>
                  <Card className="aa-tile flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{fmtWhen(s.startedAt)}</p>
                      <p className="truncate text-xs text-muted">{s.distanceM} m · {s.arrows} frecce{s.place ? ` · ${s.place}` : ""}{programById(s.program) ? ` · ${programById(s.program)?.title}` : ""}</p>
                    </div>
                    <p className="rounded-xl bg-white/6 px-2.5 py-1 font-display text-2xl tabular-nums">{num(s.avg, 2)}</p>
                  </Card>
                </Link>
              </HoldDelete>
            </Rise>
          ))}
        </div>
      ) : (
        <Rise i={10}><Empty title="Quaderno vuoto" /></Rise>
      )}
      <Rise i={19}>
        <Card>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">Note del quaderno</p>
          {notes.data?.items.length ? (
            <ul className="mt-2 grid gap-2">
              {notes.data.items.map((item) => (
                <li key={`${item.source}-${item.id}`} className="flex items-start gap-2">
                  <button
                    type="button"
                    aria-label="Segna come fatto"
                    className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line text-sm font-semibold"
                    onClick={() => dismissNote({ data: { source: item.source, id: item.id } }).then(() => setNonce((n) => n + 1))}
                  >
                    ✓
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm">{item.text}</p>
                    <p className="text-xs text-muted">{item.where}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </Rise>
      {data.nextComp ? (
        <Rise i={20}>
          <Link to="/gare" hash={`gara-${data.nextComp.id}`} className="block">
            <Card>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">Prossima gara</p>
              <p className="font-display text-2xl">{data.nextComp.name}</p>
              <p className="text-sm text-muted">{data.nextComp.startsOn} · {data.nextComp.place}{data.nextComp.signupDeadline ? ` · iscrizioni ${data.nextComp.signupDeadline}` : ""}</p>
            </Card>
          </Link>
        </Rise>
      ) : null}
      {data.challenges.length ? (
        <Rise i={21}>
          <Link to="/sfide" className="block">
            <Card>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">Sfide aperte</p>
              <ul className="mt-2 grid gap-2">
                {data.challenges.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{c.title}</span>
                    <span className="text-muted">{c.state === "accepted" ? "dentro" : c.state === "invited" ? "invito" : "aperta"} · {c.endsOn}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Link>
        </Rise>
      ) : null}
      {data.goals.length ? (
        <Rise i={22}>
          <Link to="/obiettivi" className="block">
            <Card>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">Obiettivi</p>
              <ul className="mt-2 text-sm">
                {data.goals.map((g) => <li key={g.id}>{g.title}{g.collective ? " · gruppo" : ""}</li>)}
              </ul>
            </Card>
          </Link>
        </Rise>
      ) : null}
    </div>
  );
}

function Count({ value, digits = 0, suffix = "" }: { value: number; digits?: number; suffix?: string }) {
  const shown = useCount(value);
  return <>{num(digits ? shown : Math.round(shown), digits)}{suffix}</>;
}

function Meter({ label, value, digits = 0, suffix = "", color }: { label: string; value: number | null; digits?: number; suffix?: string; color?: string }) {
  return (
    <div className="aa-kpi aa-tile h-full" style={color ? ({ "--kpi": color } as CSSProperties) : undefined}>
      <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 font-display text-[1.35rem] tabular-nums leading-none">{value == null ? "—" : <Count value={value} digits={digits} suffix={suffix} />}</p>
    </div>
  );
}

type LastShot = { score: number; n: number; tag?: number | null; max?: number; distance: number; miss: boolean; isX: boolean; day: string; specs: string; link?: { kind: "allenamento" | "gara"; id: number } };

function specsOf(raw: string): Record<string, string> {
  try {
    const v = JSON.parse(raw || "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Le ultime frecce, disegnate come sono davvero (colori, penne, punta) con numero e distanza. */
function LastArrows({ shots }: { shots: LastShot[] }) {
  const navigate = useNavigate();
  const hold = useRef<number | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  // tenendo premuta una freccia si apre l'allenamento o la gara in cui è stata segnata
  const open = (shot: LastShot) => {
    if (!shot.link) return;
    if (shot.link.kind === "allenamento") void navigate({ to: "/allenamento/$id", params: { id: String(shot.link.id) } });
    else void navigate({ to: "/gare", hash: `gara-${shot.link.id}` });
  };
  const start = (i: number, shot: LastShot) => {
    if (hold.current) window.clearTimeout(hold.current);
    setPressed(i);
    hold.current = window.setTimeout(() => {
      hold.current = null;
      setPressed(null);
      if (navigator.vibrate) navigator.vibrate(18);
      open(shot);
    }, 520);
  };
  const stop = () => {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = null;
    setPressed(null);
  };
  // l'animazione parte quando la lista entra nello schermo, così si vede davvero
  const ref = useRef<HTMLUListElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((list) => {
      if (list.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <ul ref={ref} className={`grid gap-1.5 ${seen ? "is-in" : "is-wait"}`}>
      {shots.map((shot, i) => {
        const sp = specsOf(shot.specs);
        const from = Number(sp.numFrom) || 1;
        const num = shot.tag != null ? shot.tag : shot.n + from - 1;
        const max = shot.max && shot.max > 0 ? shot.max : 10;
        const ratio = shot.miss ? 0 : (shot.isX ? max : shot.score) / max;
        // alone: verde se il colpo è buono, rosso se è debole o fuori, nessuno a metà strada
        const mood = shot.miss || ratio < 0.55 ? "neg" : ratio >= 0.8 ? "pos" : "mid";
        const tone = mood === "neg" ? "bg-rose-500/20 text-rose-200" : mood === "pos" ? "bg-emerald-400/20 text-emerald-200" : "bg-white/8 text-fg";
        const delay = 150 + i * 220;
        // sfalsate come frecce piantate a profondità diverse
        const stagger = [0, 9, 4, 13, 2, 11, 6, 15][i % 8];
        return (
          <li
            key={`${shot.day}-${i}`}
            className={`aa-shot aa-shot-${mood} flex select-none items-center gap-2 ${pressed === i ? "aa-shot-press" : ""}`}
            style={{ ["--d" as string]: `${delay}ms`, WebkitTouchCallout: "none" }}
            onPointerDown={() => start(i, shot)}
            onPointerUp={stop}
            onPointerLeave={stop}
            onPointerCancel={stop}
            onContextMenu={(e) => e.preventDefault()}
            title={shot.link ? (shot.link.kind === "allenamento" ? "Tieni premuto per aprire l'allenamento" : "Tieni premuto per aprire la gara") : undefined}
          >
            <div className="aa-shot-track relative h-10 min-w-0 flex-1 overflow-hidden" style={{ paddingLeft: `${stagger}%` }}>
              <span aria-hidden className="aa-shot-streak" style={{ left: `${stagger}%` }} />
              <span aria-hidden className="aa-shot-butt" />
              <div className="aa-launch absolute inset-y-0 right-3" style={{ left: `${stagger}%` }}>
                <ArrowArt
                  material={sp.material || "carbonio"}
                  shaft={sp.shaft}
                  fletch={sp.fletch || "#d63a2f"}
                  cock={sp.cock || "#e6b325"}
                  nock={sp.nock || "#f4f1ea"}
                  wrap={sp.wrap}
                  fletchType={sp.fletchType || "alette"}
                  fletchStyle={sp.fletchStyle}
                  fletch2={sp.fletch2}
                  point={sp.pointType || "ogiva"}
                  number={num}
                  className="h-10 w-full"
                />
              </div>
            </div>
            <span className="aa-shot-label grid w-11 shrink-0 justify-items-end gap-0.5 text-right text-[0.62rem] font-semibold leading-none">
              <span className={`rounded px-1.5 py-0.5 font-display text-sm tabular-nums ${tone}`}>{shot.miss ? "M" : shot.isX ? "X" : shot.score}</span>
              <span className="text-white/85">n.{num}</span>
              <span className="text-muted">{shot.distance ? `${shot.distance} m` : "—"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

