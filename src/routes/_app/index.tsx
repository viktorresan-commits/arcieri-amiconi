import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { dashboard, deleteSession } from "@/lib/arcieri/training.api";
import { dismissNote, openNotes } from "@/lib/arcieri/club.api";
import { fmtWhen } from "@/lib/arcieri/time";
import { programById } from "@/lib/arcieri/program";
import { useLoad } from "@/lib/arcieri/use-load";
import { useAvatar } from "@/components/avatar-hero";
import { GameGuard, HomeGame } from "@/components/home-game";
import { CoachCard } from "@/components/avatar-challenge";
import { avatarChallenge } from "@/lib/arcieri/challenge.api";
import { MainGearCard } from "@/components/main-gear";
import { ShortcutRow } from "@/components/shortcuts";
import { JourneyCard } from "@/components/journey";
import { TodayCard } from "@/components/today-card";
import { usePrefs } from "@/lib/arcieri/prefs";
import { Glyph, type IconName } from "@/components/icons";
import { sceneById } from "@/lib/arcieri/scenes";
import { LastArrows, LastSummary } from "@/components/last-arrows";
import { Button, Card, Empty, ErrorNote, HoldDelete, Loading, cx } from "@/components/kit";

export const Route = createFileRoute("/_app/")({ component: Home });

/** già sul gioco (Tiro rapido, Da foto, Sfide, Classifiche) o nella barra in basso (Gare, Compagnia): la fila non li ripete */
const HOME_HIDE = ["rapido", "foto", "sfide", "classifiche", "gare", "squadra"];

/** Scurisce un colore esadecimale verso il nero (f tra 0 e 1). */
function shade(hex: string, f: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - f)));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Il prolungamento del gioco: il terreno della scena continua, scurendosi, con un selciato appena accennato. */
function GameApron({ ground, children }: { ground: string; children: ReactNode }) {
  return (
    <div
      className="aa-apron relative px-3 pb-5 pt-3 md:mt-2 md:rounded-[1.75rem] md:pb-3"
      style={{ background: `linear-gradient(180deg, ${shade(ground, 0.52)} 0%, ${shade(ground, 0.64)} 30%, ${shade(ground, 0.74)} 72%, var(--bg) 100%)` }}
    >
      <svg className="pointer-events-none absolute inset-x-0 top-0 h-28 w-full opacity-[0.16]" viewBox="0 0 390 96" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: 6 }, (_, r) => Array.from({ length: 9 }, (_, c) => <rect key={`${r}-${c}`} x={c * 46 + (r % 2) * 23 - 10} y={r * 16} width="42" height="13" rx="4" fill="none" stroke="#c8c0b0" strokeWidth="1" />))}
      </svg>
      <div className="relative grid gap-2">{children}</div>
    </div>
  );
}

/** Pulsante a tema sul prolungamento del gioco: placca di cuoio bordata d'oro, medaglione con l'icona. */
function Plaque({ to, search, icon, label, sub }: { to: string; search?: Record<string, string>; icon: IconName; label: string; sub?: string }) {
  return (
    <Link to={to as "/"} search={search as never} className="aa-press flex min-h-[64px] min-w-0 items-center gap-2.5 rounded-2xl border-[1.5px] border-[#c9a15a] bg-[linear-gradient(180deg,#3b2b19,#1a130b)] px-2.5 text-left shadow-[0_8px_16px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,226,160,0.25),inset_0_-2px_0_rgba(0,0,0,0.4)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#e6b85c]/70 bg-[radial-gradient(circle_at_35%_30%,#5a4122,#24180c)] text-[#f3d48a]"><Glyph name={icon} size={20} /></span>
      <span className="min-w-0">
        <b className="block truncate font-display text-[1.05rem] leading-tight text-[#f6ead0]">{label}</b>
        {sub ? <span className="block truncate text-[0.66rem] text-[#e9dcc0]/70">{sub}</span> : null}
      </span>
    </Link>
  );
}



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
  // l'arciere della Home tira come te; i privilegi attivi si vedono nel gioco
  const duel = useLoad(`duel-${nonce}`, () => avatarChallenge());
  const activePerks = (duel.data?.perks ?? []).filter((p) => p.active).map((p) => p.id);
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
    <div className="aa-home grid gap-3">
      <Rise i={0}>
        <div className="grid gap-2">
          {/* sul telefono il gioco va da bordo a bordo e sale fino sotto la barra in alto */}
          <div className="-mx-4 -mt-6 md:mx-0 md:mt-0">
          <GameGuard>
          <HomeGame
            bleed
            look={avatar.shown}
            form={duel.data?.form ?? null}
            perks={activePerks}
            banner={duel.data?.company.color}
            info={
              <div className="grid justify-items-start gap-0.5">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/80">{new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</p>
                <h1 className="font-display text-[2rem] leading-none tracking-tight">Oggi</h1>
                <p className="max-w-[13rem] text-[0.7rem] leading-snug text-white/90">
                  {data.month.sessions} uscite e {num(data.month.arrows)} frecce questo mese
                  {data.since ? ` · ultimo tiro ${data.since.n} ${data.since.unit === "h" ? (data.since.n === 1 ? "ora" : "ore") : data.since.n === 1 ? "giorno" : "giorni"} fa` : ""}
                </p>
                {data.streak > 1 ? <p className="mt-1 inline-flex rounded-full bg-black/35 px-2.5 py-0.5 text-[0.66rem] font-semibold backdrop-blur">{data.streak} giorni di fila</p> : null}
                {activePerks.includes("corona") ? <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#ffcf5a] px-2.5 py-0.5 text-[0.66rem] font-bold text-[#1a1408]"><Glyph name="trophy" size={12} /> Corona della settimana</p> : null}
              </div>
            }
          >
            {/* solo l'icona per vestire l'arciere, piccola, a sinistra sotto i suoi piedi */}
            <div data-ui className="absolute bottom-1.5 left-2" onPointerDown={(e) => e.stopPropagation()}>
              <Link to="/avatar" aria-label="Personalizza l'arciere e l'ambientazione" className="grid h-8 w-8 place-items-center rounded-full border border-[#e6b85c]/45 bg-black/45 text-[#f3d48a] backdrop-blur">
                <Glyph name="palette" size={15} />
              </Link>
            </div>
          </HomeGame>
          </GameGuard>
          {/* il gioco si allunga: continua il terreno e i pulsanti ci stanno sopra senza coprire il tiro */}
          <GameApron ground={sceneById(avatar.shown.scene).ground[1]}>
            <div className="grid grid-cols-[1.45fr_1fr] gap-2">
              <Link to="/allenamento" search={{ avvia: "rapido" }} className="aa-plaque-gold aa-press flex min-h-[64px] items-center gap-2.5 rounded-2xl border-[1.5px] border-[#fff0c4]/70 bg-[linear-gradient(180deg,#f6d98e,#c8902c)] px-3 text-left text-[#2a1a08] shadow-[0_10px_18px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-3px_0_rgba(120,70,10,0.45)]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#2a1a08] text-[#f6d98e]"><Glyph name="bolt" size={20} /></span>
                <span className="min-w-0"><b className="block truncate font-display text-[1.25rem] leading-none">Tiro rapido</b><span className="block truncate text-[0.68rem] font-semibold opacity-75">segna le frecce di oggi</span></span>
              </Link>
              <Plaque to="/allenamento" search={{ avvia: "foto" }} icon="camera" label="Da foto" sub="leggo il bersaglio" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Plaque to="/sfide" icon="duel" label="Sfide" sub={data.challenges.length ? `${data.challenges.length} ${data.challenges.length === 1 ? "aperta" : "aperte"}` : "sfida i compagni"} />
              <Plaque to="/classifiche" icon="podium" label="Classifiche" sub={data.rank ? `${data.rank.position}° su ${data.rank.of}` : "chi è davanti"} />
            </div>
          </GameApron>
          </div>
          <MainGearCard compact />
          {duel.data ? <CoachCard form={duel.data.form} perks={duel.data.perks} lefty={Boolean(avatar.shown.lefty)} look={avatar.shown} /> : null}
        </div>
      </Rise>
      {prefs.home.shortcuts ? (
        <Rise i={1}>
          <ShortcutRow hide={HOME_HIDE} />
        </Rise>
      ) : null}
      <Rise i={2}>
        <section className="grid gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="aa-section-title">Ultimi allenamenti</h2>
            <Link to="/allenamento" search={{ vista: "storico" }} className="text-[0.7rem] font-semibold text-muted">Tutti</Link>
          </div>
          {data.recent.length ? (
            data.recent.slice(0, 3).map((s, index) => {
              const d = new Date(s.startedAt);
              const good = s.avg >= 8 ? "#7cf0a8" : s.avg >= 6 ? "#ffd27a" : "#ff8a7a";
              return (
                <HoldDelete
                  key={s.id}
                  hint={index === 0}
                  label="Eliminare questo allenamento?"
                  onDelete={() => deleteSession({ data: { id: s.id } }).then(() => setNonce((n) => n + 1))}
                >
                  <Link to="/allenamento/$id" params={{ id: String(s.id) }}>
                    <Card className="aa-tile aa-session flex items-center gap-3 p-2.5" style={{ ["--good" as string]: good }}>
                      <div className="grid h-14 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-center leading-none">
                        <span className="font-display text-2xl">{d.getDate()}</span>
                        <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted">{d.toLocaleDateString("it-IT", { month: "short" })}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{fmtWhen(s.startedAt)}</p>
                        <p className="truncate text-xs text-muted">{s.distanceM} m · {s.arrows} frecce{s.place ? ` · ${s.place}` : ""}{programById(s.program) ? ` · ${programById(s.program)?.title}` : ""}</p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="aa-grow h-full rounded-full" style={{ width: `${Math.min(100, (s.avg / 10) * 100)}%`, background: good }} />
                        </div>
                      </div>
                      <div className="grid shrink-0 justify-items-end leading-none">
                        <span className="font-display text-3xl tabular-nums" style={{ color: good }}>{num(s.avg, 2)}</span>
                        <span className="text-[0.6rem] uppercase tracking-wider text-muted">media</span>
                      </div>
                    </Card>
                  </Link>
                </HoldDelete>
              );
            })
          ) : (
            <Empty title="Quaderno vuoto" />
          )}
        </section>
      </Rise>
      <Rise i={2}>
        <TodayCard />
      </Rise>
      {prefs.home.journey ? (
        <Rise i={2}>
          <JourneyCard totalArrows={data.all.arrows} weekArrows={data.weekArrows} streak={data.streak} />
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
            <Link to="/attrezzatura" aria-label="Personalizza frecce" className="aa-press grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-muted"><Glyph name="palette" size={16} /></Link>
          </div>
          {data.lastShots.length ? (
            <>
              <LastSummary shots={data.lastShots} />
              <LastArrows shots={data.lastShots} />
            </>
          ) : <p className="text-xs text-muted">Le frecce che tiri compaiono qui.</p>}
        </Card>
      </Rise> : null}
      <Rise i={9}>
        <Link to="/classifiche" className="block">
          <Card>
            <p className="aa-home-label">Classifica del tuo tiro più frequente</p>
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
      <Rise i={19}>
        <Card>
          <p className="aa-home-label">Note del quaderno</p>
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
            <Card className="flex items-center gap-3">
              <CountdownBadge day={data.nextComp.startsOn} />
              <div className="min-w-0 flex-1">
                <p className="aa-home-label">Prossima gara</p>
                <p className="truncate font-display text-2xl">{data.nextComp.name}</p>
                <p className="text-sm text-muted">{fmtDay(data.nextComp.startsOn)}{data.nextComp.place ? ` · ${data.nextComp.place}` : ""}{data.nextComp.signupDeadline ? ` · iscrizioni entro ${fmtDay(data.nextComp.signupDeadline)}` : ""}</p>
              </div>
            </Card>
          </Link>
        </Rise>
      ) : null}
      {data.challenges.length ? (
        <Rise i={21}>
          <Link to="/sfide" className="block">
            <Card>
              <p className="aa-home-label">Sfide aperte</p>
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
              <p className="aa-home-label">Obiettivi</p>
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

/** Giorni che mancano a una data (AAAA-MM-GG), contati sul calendario di Roma. */
function daysTo(day: string) {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" }));
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86_400_000);
}

function fmtDay(day: string) {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });
}

/** Il conto alla rovescia della prossima gara: quanti giorni mancano. */
function CountdownBadge({ day }: { day: string }) {
  const n = daysTo(day);
  const label = n == null ? "—" : n <= 0 ? "Oggi" : n === 1 ? "Domani" : String(n);
  const urgent = n != null && n <= 3;
  return (
    <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-center leading-none ${urgent ? "bg-[#ffd27a] text-[#2a1d0c]" : "bg-white/[0.07]"}`}>
      <span className={`font-display ${label.length > 3 ? "text-lg" : "text-3xl"}`}>{label}</span>
      {n != null && n > 1 ? <span className="-mt-2 text-[0.6rem] font-semibold uppercase tracking-wider opacity-75">giorni</span> : null}
    </div>
  );
}
