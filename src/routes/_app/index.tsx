import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
import { AppIcon, Glyph, type IconName } from "@/components/icons";
import { LastArrows, LastSummary } from "@/components/last-arrows";
import { Button, Card, Empty, ErrorNote, HoldDelete, Loading, cx } from "@/components/kit";

export const Route = createFileRoute("/_app/")({ component: Home });

/** già sul gioco (Tiro rapido, Da foto, Segnapunti, Statistiche) o nella barra in basso (Gare, Compagnia): la fila non li ripete */
const HOME_HIDE = ["rapido", "foto", "segnapunti", "statistiche", "gare", "squadra"];

/** Pulsante a tema sul prolungamento del gioco: placca di cuoio bordata d'oro, medaglione con l'icona. */
/** un numero dell'attività con la sua icona, per la barra delle statistiche */
function MiniStat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <span className="flex items-center gap-1 px-1.5 first:pl-0">
      <Glyph name={icon} detailed size={17} className="aa-tone-hi shrink-0" />
      <span className="grid leading-none">
        <b className="text-[0.86rem] tabular-nums">{value}</b>
        <span className="aa-plaque-sub text-[0.56rem]">{label}</span>
      </span>
    </span>
  );
}

function Plaque({ to, search, icon, label, sub }: { to: string; search?: Record<string, string>; icon: IconName; label: string; sub?: string }) {
  return (
    <Link to={to as "/"} search={search as never} className="aa-plaque aa-press flex min-h-[52px] min-w-0 items-center gap-2 rounded-2xl px-2 text-left">
      <AppIcon name={icon} size={36} />
      <span className="min-w-0 flex-1">
        <b className="aa-plaque-title block truncate font-display text-[1.05rem] leading-tight">{label}</b>
        {sub ? <span className="aa-plaque-sub block truncate text-[0.68rem]">{sub}</span> : null}
      </span>
      <Glyph name="chevron" size={14} className="aa-tone-hi shrink-0 opacity-80" />
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

/** Segnaposto con la stessa sagoma della Home (scena da bordo a bordo e pulsanti sotto). */
function HomeSkeleton() {
  return (
    <div className="aa-loading grid content-start gap-2" aria-busy>
      <span className="sr-only">Caricamento…</span>
      <div className="aa-home-skel -mx-4 -mt-6 aspect-[3/4] md:mx-0 md:mt-0 md:rounded-3xl" />
      <div className="aa-skel h-[58px] rounded-2xl" />
      <div className="grid grid-cols-2 gap-2">
        <div className="aa-skel h-[52px] rounded-2xl" style={{ animationDelay: "120ms" }} />
        <div className="aa-skel h-[52px] rounded-2xl" style={{ animationDelay: "160ms" }} />
      </div>
      <div className="aa-skel h-[52px] rounded-2xl" style={{ animationDelay: "240ms" }} />
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
  const activePerks = useMemo(() => (duel.data?.perks ?? []).filter((p) => p.active).map((p) => p.id), [duel.data]);
  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem("aa-unread", String(data.unread ?? 0));
      window.dispatchEvent(new Event("aa-unread"));
    } catch {
      /* niente */
    }
  }, [data]);
  // la Home compare in un colpo solo, quando ci sono sia i numeri sia la forma dell'arciere
  if (loading || (duel.loading && !duel.data && !duel.error)) return <HomeSkeleton />;
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;
  const rankFill = data.rank && data.rank.of > 1 ? ((data.rank.of - data.rank.position) / (data.rank.of - 1)) * 100 : data.rank ? 100 : 0;
  return (
    <div className="aa-home aa-arrive grid gap-3">
      <Rise i={0}>
        <div className="grid gap-2">
          {/* sul telefono il gioco va da bordo a bordo e sale fino sotto la barra in alto */}
          <div className="-mx-4 -mt-6 md:mx-0 md:mt-0">
          <GameGuard>
          <HomeGame
            bleed
            /* il gioco si allunga: continua il terreno e i pulsanti ci stanno sopra senza coprire il tiro */
            apron={
              <>
            {/* solo l'icona per vestire l'arciere, piccola, sotto i suoi piedi: non copre la figura */}
            <div className="aa-home-palette flex h-8 items-center pl-[5%]">
              <Link to="/avatar" aria-label="Personalizza l'arciere e l'ambientazione" className="aa-bell grid h-8 w-8 place-items-center rounded-full shadow-[0_4px_10px_-4px_rgba(0,0,0,0.7)]">
                <Glyph name="palette" size={15} />
              </Link>
            </div>
            {/* azione principale: lo stesso avvio di sempre del tiro rapido */}
            <Link to="/allenamento" search={{ avvia: "rapido" }} className="aa-cta aa-press flex min-h-[58px] items-center gap-3 rounded-2xl px-3 text-left">
              <AppIcon name="bolt" size={44} />
              <span className="min-w-0 flex-1"><b className="block truncate font-display text-[1.45rem] uppercase leading-none tracking-wide">Tiro rapido</b><span className="block truncate text-[0.74rem] font-semibold opacity-85">Registra le frecce di oggi</span></span>
              <Glyph name="chevron" size={18} className="shrink-0 opacity-80" />
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Plaque to="/allenamento" search={{ avvia: "foto" }} icon="camera" label="Da foto" sub="Leggi il bersaglio" />
              <Plaque to="/segnapunti" icon="scorecard" label="Segnapunti" sub="Punti con gli amici" />
            </div>
            {/* statistiche con l'attività del mese: uscite, frecce, media (dati reali) */}
            <Link to="/statistiche" className="aa-plaque aa-stats-bar aa-press flex min-h-[52px] items-center gap-2 rounded-2xl px-2.5 text-left">
              <AppIcon name="chart" size={32} />
              <span className="min-w-0 shrink-0">
                <b className="aa-plaque-title block font-display text-[1.02rem] leading-none">Statistiche</b>
                <span className="aa-plaque-sub block text-[0.62rem]">questo mese</span>
              </span>
              <span className="ml-auto grid grid-cols-3 divide-x divide-white/10">
                <MiniStat icon="footprints" value={String(data.month.sessions)} label="uscite" />
                <MiniStat icon="arrow" value={num(data.month.arrows)} label="frecce" />
                <MiniStat icon="trend" value={data.month.arrows ? data.month.avg.toFixed(2).replace(".", ",") : "—"} label="media" />
              </span>
              <Glyph name="chevron" size={14} className="aa-tone-hi shrink-0 opacity-80" />
            </Link>
              </>
            }
            look={avatar.shown}
            form={duel.data?.form ?? null}
            perks={activePerks}
            banner={duel.data?.company.color}
            info={
              /* blocco di oggi: data, il tuo campo, uscite e frecce del mese, ultimo tiro (dati reali) */
              <div className="aa-hud aa-day grid justify-items-start gap-0.5 rounded-2xl px-3 py-2">
                <p className="aa-day-date flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-white/75"><Glyph name="calendar" size={12} className="aa-hud-ico" />{new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</p>
                <h1 className="aa-day-title font-display text-[1.6rem] leading-none tracking-tight">Il tuo campo</h1>
                <p className="flex items-center gap-1.5 text-[0.7rem] leading-snug text-white/90"><Glyph name="target" size={12} className="aa-hud-ico shrink-0" />{data.month.sessions} {data.month.sessions === 1 ? "uscita" : "uscite"} · {num(data.month.arrows)} frecce questo mese</p>
                {data.since ? (
                  <p className="aa-day-last flex items-center gap-1.5 text-[0.7rem] leading-snug text-white/80"><Glyph name="history" size={12} className="aa-hud-ico shrink-0" />Ultimo tiro {data.since.n} {data.since.unit === "h" ? (data.since.n === 1 ? "ora" : "ore") : data.since.n === 1 ? "giorno" : "giorni"} fa</p>
                ) : null}
                {data.streak > 1 || activePerks.includes("corona") ? (
                  <p className="aa-day-extra mt-0.5 flex flex-wrap gap-1">
                    {data.streak > 1 ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.62rem] font-semibold">{data.streak} giorni di fila</span> : null}
                    {activePerks.includes("corona") ? <span className="inline-flex items-center gap-1 rounded-full bg-[#ffcf5a] px-2 py-0.5 text-[0.62rem] font-bold text-[#1a1408]"><Glyph name="trophy" size={11} /> Corona</span> : null}
                  </p>
                ) : null}
              </div>
            }
          >
          </HomeGame>
          </GameGuard>
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
