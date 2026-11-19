import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { dashboard, deleteSession } from "@/lib/arcieri/training.api";
import { dismissNote, openNotes } from "@/lib/arcieri/club.api";
import { fmtWhen } from "@/lib/arcieri/time";
import { programById } from "@/lib/arcieri/program";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, Empty, ErrorNote, HoldDelete, Loading, cx } from "@/components/kit";

export const Route = createFileRoute("/_app/")({ component: Home });

const CATS = [
  ["/gioco", "Giochiamo", "bow"],
  ["/squadra", "Squadra", "people"],
  ["/gare", "Gare", "target"],
  ["/statistiche", "Statistiche", "line"],
  ["/classifiche", "Classifiche", "bars"],
  ["/calendario", "Calendario", "cal"],
  ["/sfide", "Sfide", "cross"],
  ["/attrezzatura", "Attrezzatura", "bow"],
  ["/profilo", "Profilo", "user"],
] as const;

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
  const notes = useLoad(`notes-${nonce}`, () => openNotes());
  if (loading) return <Loading />;
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;
  const trend = data.trend.slice(-60);
  const rankFill = data.rank && data.rank.of > 1 ? ((data.rank.of - data.rank.position) / (data.rank.of - 1)) * 100 : data.rank ? 100 : 0;
  return (
    <div className="grid gap-4">
      <Rise i={0} className="flex items-center justify-between gap-4">
        <h1 className="font-display text-5xl leading-none">Oggi</h1>
        <Link to="/bacheca" className="relative rounded-2xl border border-line bg-surface px-4 py-2 text-sm font-semibold">
          News
          {data.unread > 0 ? <span className="absolute -right-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg">{data.unread > 9 ? "9+" : data.unread}</span> : null}
        </Link>
      </Rise>
      <Rise i={1}>
        <Link to="/allenamento">
          <Button className="aa-glow w-full text-lg">Prepara allenamento</Button>
        </Link>
      </Rise>
      <div className="grid grid-cols-2 gap-2">
        <Rise i={2}><Link to="/calendario" className="block"><Meter label="Uscite mese" value={data.month.sessions} /></Link></Rise>
        <Rise i={3}><Link to="/statistiche" className="block"><Meter label="Frecce mese" value={data.month.arrows} /></Link></Rise>
        <Rise i={4}><Link to="/statistiche" className="block"><Meter label="Media mese" value={data.month.arrows ? data.month.avg : null} digits={2} /></Link></Rise>
        <Rise i={5}><Link to="/statistiche" className="block"><Meter label="Miglior media" value={data.all.bestAvg || null} digits={2} /></Link></Rise>
        <Rise i={6}><Link to="/statistiche" className="block"><Meter label="Frecce totali" value={data.all.arrows} /></Link></Rise>
        <Rise i={7}><Link to="/statistiche" className="block"><Meter label="Miglior distanza" value={data.bestDistance} /></Link></Rise>
        <Rise i={8}><Link to="/allenamento" className="block"><Meter label="Dall'ultimo tiro" value={data.since?.n ?? null} suffix={data.since ? ` ${data.since.unit}` : ""} /></Link></Rise>
        <Rise i={9}><Link to="/statistiche" className="block"><Meter label="Precisione" value={data.all.precisePct} digits={1} suffix="%" /></Link></Rise>
      </div>
      <Rise i={8}>
        <Link to="/statistiche" className="block">
          <Card>
            <p className="text-xs uppercase tracking-wide text-muted">Ultimi tiri</p>
            {trend.length ? <Trend values={trend} /> : null}
          </Card>
        </Link>
      </Rise>
      <Rise i={9}>
        <Link to="/classifiche" className="block">
          <Card>
            <p className="text-xs uppercase tracking-wide text-muted">Classifica del tuo tiro più frequente</p>
            {data.rank ? (
              <>
                <p className="font-display text-4xl"><Count value={data.rank.position} />° <span className="text-xl text-muted">su {data.rank.of}</span></p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg">
                  <div className="aa-grow h-full rounded-full bg-accent" style={{ width: `${rankFill}%`, animationDelay: "280ms" }} />
                </div>
              </>
            ) : (
              <p className="font-display text-4xl">—</p>
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
                      <p className="truncate text-sm text-muted">{s.distanceM} m · {s.arrows} frecce{s.place ? ` · ${s.place}` : ""}{programById(s.program) ? ` · ${programById(s.program)?.title}` : ""}</p>
                    </div>
                    <p className="font-display text-3xl tabular-nums">{num(s.avg, 2)}</p>
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
          <p className="text-xs uppercase tracking-wide text-muted">Note del quaderno</p>
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
              <p className="text-xs uppercase tracking-wide text-muted">Prossima gara</p>
              <p className="font-display text-3xl">{data.nextComp.name}</p>
              <p className="text-sm text-muted">{data.nextComp.startsOn} · {data.nextComp.place}{data.nextComp.signupDeadline ? ` · iscrizioni ${data.nextComp.signupDeadline}` : ""}</p>
            </Card>
          </Link>
        </Rise>
      ) : null}
      {data.challenges.length ? (
        <Rise i={21}>
          <Link to="/sfide" className="block">
            <Card>
              <p className="text-xs uppercase tracking-wide text-muted">Sfide aperte</p>
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
              <p className="text-xs uppercase tracking-wide text-muted">Obiettivi</p>
              <ul className="mt-2 text-sm">
                {data.goals.map((g) => <li key={g.id}>{g.title}{g.collective ? " · gruppo" : ""}</li>)}
              </ul>
            </Card>
          </Link>
        </Rise>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {CATS.map(([to, label, icon], index) => (
          <Rise key={to} i={23 + index}>
            <Link to={to} className="aa-tile flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-3 shadow-card">
              <CatIcon kind={icon} delay={180 + index * 70} />
              <span className="text-sm font-semibold">{label}</span>
            </Link>
          </Rise>
        ))}
      </div>
    </div>
  );
}

function Count({ value, digits = 0, suffix = "" }: { value: number; digits?: number; suffix?: string }) {
  const shown = useCount(value);
  return <>{num(digits ? shown : Math.round(shown), digits)}{suffix}</>;
}

function Meter({ label, value, digits = 0, suffix = "" }: { label: string; value: number | null; digits?: number; suffix?: string }) {
  return (
    <Card className="h-full p-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-3xl tabular-nums leading-none">{value == null ? "—" : <Count value={value} digits={digits} suffix={suffix} />}</p>
    </Card>
  );
}

function Trend({ values }: { values: number[] }) {
  const count = Math.max(values.length, 1);
  const height = 160;
  const reachMax = height;
  const width = 480;
  const pitch = (width - 8) / count;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="aa-shots" role="img" aria-label="Ultimi tiri">
      {values.map((score, index) => {
        const color = score <= 0 ? "#d64545" : score >= 8 ? "#2f9e5b" : "#e07a2f";
        const t = count === 1 ? 1 : index / (count - 1);
        const reach = reachMax * (0.2 + t * 0.8);
        const x = 4 + index * pitch + pitch * 0.5;
        const y0 = height;
        const y1 = y0 - reach;
        const head = 7 + t * 4;
        const wing = Math.min(2.2 + t, pitch * 0.34);
        return (
          <g key={index}>
            <line x1={x} y1={y0} x2={x} y2={y1 + head} stroke={color} strokeWidth={1.6 + t * 0.8} strokeLinecap="round" />
            <path d={`M${x} ${y1} L${x - wing} ${y1 + head} L${x + wing} ${y1 + head} Z`} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

function CatIcon({ kind, delay }: { kind: string; delay: number }) {
  const pen = { fill: "none", stroke: "var(--primary)", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 100, className: "aa-draw", style: { animationDelay: `${delay}ms` } };
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
      {kind === "people" ? <path d="M8 24c1.5-4 4-6 8-6s6.5 2 8 6M12 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0" {...pen} /> : null}
      {kind === "target" ? <><circle cx="16" cy="16" r="10" {...pen} /><circle cx="16" cy="16" r="4" {...pen} /></> : null}
      {kind === "line" ? <path d="M5 24 L12 14 L18 18 L27 7" {...pen} /> : null}
      {kind === "bars" ? <path d="M7 24V16M16 24V8M25 24V13" {...pen} /> : null}
      {kind === "cal" ? <path d="M8 8h16v16H8zM8 13h16M12 6v4M20 6v4" {...pen} /> : null}
      {kind === "cross" ? <path d="M8 16h16M16 8v16" {...pen} /> : null}
      {kind === "bow" ? <path d="M10 6c7 6 7 14 0 20M10 6c8 4 8 16 0 20" {...pen} /> : null}
      {kind === "user" ? <path d="M8 25c2-5 5-7 8-7s6 2 8 7M16 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8" {...pen} /> : null}
    </svg>
  );
}
