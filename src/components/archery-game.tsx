import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import type { AvatarLook } from "@/lib/arcieri/avatar";
import { useSky } from "@/lib/arcieri/sky3d";
import { useLocalState } from "@/lib/arcieri/local-store";
import { award, readXp, today } from "@/lib/arcieri/xp";
import { ArcherAvatar } from "./archer-avatar";
import { SceneBackdrop } from "./scene-2d";

/**
 * Mini-gioco della Home: il tuo arciere tira al paglione.
 * Tieni premuto per tendere (l'arco arriva all'ancoraggio in meno di un secondo), trascina per
 * spostare il mirino, lascia per scoccare. Il vento sposta la freccia, la mira trema se tieni troppo
 * a lungo e una trazione incompleta fa cadere il tiro. Volée da tre frecce, record salvato.
 *
 * Mondo in unità SVG 300×400 (il contenitore ha proporzione 3:4, quindi nessuna deformazione).
 */
const W = 300;
const H = 400;
// arciere: in basso a sinistra, larghezza 168 unità (il suo SVG è 300×350)
const AV = { left: -14, width: 168 };
const AV_H = (AV.width * 350) / 300;
const AV_TOP = H - 10 - AV_H;
const GRIP = { x: AV.left + ((250 - 40) / 300) * AV.width, y: AV_TOP + (124 / 350) * AV_H };
const TARGET = { x: 228, y: 246 };
const DISTANCES = [18, 30, 50, 70] as const;
type Dist = (typeof DISTANCES)[number];
const RINGS = ["#f4f1ea", "#f4f1ea", "#1a1c1e", "#1a1c1e", "#2a6294", "#2a6294", "#c4473d", "#c4473d", "#e6b325", "#e6b325"];

type Hit = { x: number; y: number; score: number; x10: boolean };
type Flight = { from: { x: number; y: number }; to: Hit; t0: number; dur: number; arc: number };

const radiusOf = (d: Dist) => 34 * Math.sqrt(18 / d);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function scoreOf(dx: number, dy: number, R: number): Hit & { r: number } {
  const r = Math.hypot(dx, dy) / R;
  const score = r <= 1 ? Math.max(1, 10 - Math.floor(r * 10)) : 0;
  return { x: TARGET.x + dx, y: TARGET.y + dy, score, x10: r <= 0.05, r };
}

export function ArcheryGame({ look, children, className = "" }: { look: AvatarLook; children?: ReactNode; className?: string }) {
  const { sky } = useSky();
  const stage = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useLocalState<Dist>("aa-game-dist", 18);
  const [best, setBest] = useLocalState<Record<string, number>>("aa-game-best", {});
  const [hits, setHits] = useState<Hit[]>([]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [draw, setDraw] = useState<{ t0: number; sx: number; sy: number; ax: number; ay: number; aim: { x: number; y: number } } | null>(null);
  const [released, setReleased] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [pop, setPop] = useState<{ id: number; x: number; y: number; text: string } | null>(null);
  const [shake, setShake] = useState(0);
  const [wind, setWind] = useState(() => Math.round((Math.random() * 6 - 3) * 10) / 10);
  const [touched, setTouched] = useState(false);
  const landed = useRef(0);
  const hitsRef = useRef<Hit[]>([]);
  const R = radiusOf(dist);
  const done = hits.length >= 3 && !flight;
  const total = hits.reduce((a, h) => a + h.score, 0);

  // orologio del gioco: corre solo mentre si tende, si scocca o la freccia vola
  const live = draw != null || flight != null || (released != null && now - released < 1.2);
  useEffect(() => {
    if (!live) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now() / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live]);

  const pull = draw ? clamp((now - draw.t0) / 0.75, 0, 1) : 0;
  const hold = draw ? Math.max(0, now - draw.t0 - 0.75) : 0;
  // tremolio della mira: piccolo all'inizio, cresce dopo 3 secondi di tenuta
  const swayA = 0.9 + Math.max(0, hold - 3) * 2.2 + (sky.weather === "pioggia" ? 0.6 : 0);
  const sway = draw ? { x: Math.sin(now * 1.7) * swayA + Math.sin(now * 4.1) * swayA * 0.25, y: Math.cos(now * 1.3) * swayA * 0.8 } : { x: 0, y: 0 };
  const sight = draw ? { x: draw.aim.x + sway.x, y: draw.aim.y + sway.y } : null;

  // la freccia in volo
  let flyPos: { x: number; y: number; ang: number; k: number } | null = null;
  if (flight) {
    const u = clamp((now - flight.t0) / flight.dur, 0, 1);
    const x = flight.from.x + (flight.to.x - flight.from.x) * u;
    const y = flight.from.y + (flight.to.y - flight.from.y) * u - flight.arc * 4 * u * (1 - u);
    const dy = (flight.to.y - flight.from.y) - flight.arc * 4 * (1 - 2 * u);
    const dx = flight.to.x - flight.from.x;
    flyPos = { x, y, ang: (Math.atan2(dy, dx) * 180) / Math.PI, k: 1 - u * 0.62 };
    if (u >= 1 && landed.current !== flight.t0) {
      landed.current = flight.t0;
      const h = flight.to;
      queueMicrotask(() => land(h));
    }
  }

  const land = (h: Hit) => {
    setFlight(null);
    const next = [...hitsRef.current, h];
    hitsRef.current = next;
    setHits(next);
    if (next.length === 3) finish(next);
    setPop({ id: Date.now(), x: h.x, y: h.y, text: h.score === 0 ? "M" : h.x10 ? "X" : String(h.score) });
    setShake((s) => s + 1);
    try {
      navigator.vibrate?.(h.score >= 9 ? [18, 30, 18] : 12);
    } catch {
      /* niente */
    }
  };

  const finish = (list: Hit[]) => {
    const sum = list.reduce((a, h) => a + h.score, 0);
    const key = String(dist);
    if (sum > (best[key] ?? 0)) setBest({ ...best, [key]: sum });
    // punti esperienza: al massimo cinque volée al giorno
    const day = today();
    for (let i = 1; i <= 5; i++) {
      const once = `gioco-${day}-${i}`;
      if (readXp().log.some((l) => l.why === once)) continue;
      award(sum >= 27 ? 3 : sum >= 20 ? 2 : 1, "Volée nel gioco", once);
      break;
    }
  };

  const toWorld = (cx: number, cy: number) => {
    const r = stage.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0, k: 1 };
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H, k: W / r.width };
  };

  const onDown = (e: RPointerEvent) => {
    if (flight || done || draw) return;
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const w = toWorld(e.clientX, e.clientY);
    // il mirino parte vicino al centro, non proprio sopra: tocca a te allinearlo
    const ax = TARGET.x + (Math.random() - 0.5) * R * 1.6;
    const ay = TARGET.y + (Math.random() - 0.5) * R * 1.6;
    setTouched(true);
    setReleased(null);
    setNow(performance.now() / 1000);
    setDraw({ t0: performance.now() / 1000, sx: w.x, sy: w.y, ax, ay, aim: { x: ax, y: ay } });
  };
  const onMove = (e: RPointerEvent) => {
    if (!draw) return;
    const w = toWorld(e.clientX, e.clientY);
    // spostamento del dito ridotto: mira fine anche con il pollice
    const k = 0.45;
    setDraw({ ...draw, aim: { x: clamp(draw.ax + (w.x - draw.sx) * k, TARGET.x - 90, TARGET.x + 60), y: clamp(draw.ay + (w.y - draw.sy) * k, TARGET.y - 90, TARGET.y + 80) } });
  };
  const onUp = () => {
    if (!draw || !sight) return;
    const t = performance.now() / 1000;
    const p = clamp((t - draw.t0) / 0.75, 0, 1);
    setDraw(null);
    setReleased(t);
    if (p < 0.25) return; // non era ancora teso: nessun tiro
    // dove va la freccia: mirino + vento + caduta se la trazione non era completa + un minimo di dispersione
    const drift = wind * (dist / 18) * 1.5;
    const drop = (1 - p) * (40 + dist * 0.8);
    const spread = 0.6 + dist / 60;
    const dx = sight.x - TARGET.x + drift + (Math.random() - 0.5) * spread * 2;
    const dy = sight.y - TARGET.y + drop + (Math.random() - 0.5) * spread * 2;
    const h = scoreOf(dx, dy, R);
    const from = { x: GRIP.x + 4, y: GRIP.y - (TARGET.y - draw.aim.y) * 0.25 };
    setFlight({ from, to: h, t0: t, dur: 0.38 + dist / 160, arc: 6 + dist * 0.35 });
  };

  const again = () => {
    hitsRef.current = [];
    setHits([]);
    setPop(null);
    setWind(Math.round((Math.random() * 6 - 3) * 10) / 10);
  };
  const pickDist = (d: Dist) => {
    setDist(d);
    again();
  };

  // l'avatar: tende con la trazione e alza l'arco con la mira
  const aimLift = draw ? clamp((TARGET.y - draw.aim.y) / 6, -14, 18) : 0;
  const drive = useMemo(() => ({ pull, aim: aimLift, released: released != null && !draw ? now - released : null }), [pull, aimLift, released, draw, now]);
  const bestHere = best[String(dist)] ?? 0;
  const pct = (x: number, y: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

  return (
    <div
      ref={stage}
      className={`aa-game aspect-[3/4] w-full ${shake === 0 ? "" : shake % 2 ? "aa-game-shake" : "aa-game-shake2"} ${className}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="application"
      aria-label="Gioco: tieni premuto per tendere, trascina per mirare, lascia per tirare"
    >
      <SceneBackdrop sky={sky} id="game" />
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="gm-straw" cx="0.4" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#e2c58c" />
            <stop offset="1" stopColor="#a8823f" />
          </radialGradient>
          <linearGradient id="gm-lane" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9ccf6a" stopOpacity="0.12" />
            <stop offset="1" stopColor="#c7ef90" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {/* corsia rasata verso il paglione */}
        <path d={`M${TARGET.x - 26} 296 L${TARGET.x + 26} 296 L300 400 L60 400 Z`} fill="url(#gm-lane)" />
        {[0.25, 0.5, 0.75].map((u) => {
          const y = 296 + u * 104;
          const x0 = TARGET.x - 26 + (60 - (TARGET.x - 26)) * u;
          const x1 = TARGET.x + 26 + (300 - (TARGET.x + 26)) * u;
          return <line key={u} x1={x0} y1={y} x2={x1} y2={y} stroke="#fff" strokeOpacity="0.18" strokeWidth={1 + u} strokeDasharray="5 6" />;
        })}
        {/* paglione su cavalletto */}
        <g>
          <ellipse cx={TARGET.x} cy={300} rx={R * 1.5} ry="4" fill="#000" opacity="0.25" />
          <path d={`M${TARGET.x - R * 0.8} ${TARGET.y + R * 0.8} L${TARGET.x - R * 1.05} 300 M${TARGET.x + R * 0.8} ${TARGET.y + R * 0.8} L${TARGET.x + R * 1.05} 300 M${TARGET.x} ${TARGET.y + R} L${TARGET.x + R * 0.3} 298`} stroke="#5b3d22" strokeWidth={Math.max(2, R * 0.09)} strokeLinecap="round" />
          <rect x={TARGET.x - R * 1.18} y={TARGET.y - R * 1.18} width={R * 2.36} height={R * 2.36} rx={R * 0.25} fill="url(#gm-straw)" stroke="#7d5a2a" strokeWidth="1" />
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M${TARGET.x - R * 1.15} ${TARGET.y - R + i * R * 0.42} h${R * 2.3}`} stroke="#8e6a33" strokeOpacity="0.35" strokeWidth="0.7" />
          ))}
          {RINGS.map((c, i) => (
            <circle key={i} cx={TARGET.x} cy={TARGET.y} r={R * (1 - i / 10)} fill={c} stroke={i < 2 ? "#1a1c1e" : i < 4 ? "#f4f1ea" : "#1a1c1e"} strokeWidth={0.35} strokeOpacity="0.6" />
          ))}
          <circle cx={TARGET.x} cy={TARGET.y} r={R * 0.05} fill="none" stroke="#1a1c1e" strokeWidth="0.4" />
          <path d={`M${TARGET.x - 1.5} ${TARGET.y} h3 M${TARGET.x} ${TARGET.y - 1.5} v3`} stroke="#1a1c1e" strokeWidth="0.4" />
          {/* frecce piantate */}
          {hits.map((h, i) =>
            h.score > 0 ? (
              <g key={i}>
                <circle cx={h.x} cy={h.y} r="1.1" fill="#101214" />
                <line x1={h.x} y1={h.y} x2={h.x - 7} y2={h.y + 2.4} stroke={look.shaft || "#1d1f22"} strokeWidth="1.3" strokeLinecap="round" />
                <path d={`M${h.x - 7} ${h.y + 2.4} l-3.6 -2.6 l1.4 3.6 z`} fill={look.fletch} />
                <path d={`M${h.x - 7} ${h.y + 2.4} l-2.4 3 l2.6 -0.4 z`} fill={look.cock} />
              </g>
            ) : null,
          )}
        </g>
        {/* mirino */}
        {sight ? (
          <g opacity={0.35 + pull * 0.65}>
            <circle cx={sight.x} cy={sight.y} r={4 + (1 - pull) * 10} fill="none" stroke={pull >= 1 ? "#7CFFB2" : "#fff"} strokeWidth="1.1" />
            <circle cx={sight.x} cy={sight.y} r="0.9" fill={pull >= 1 ? "#7CFFB2" : "#fff"} />
            <path d={`M${sight.x - 9} ${sight.y} h4 M${sight.x + 5} ${sight.y} h4 M${sight.x} ${sight.y - 9} v4 M${sight.x} ${sight.y + 5} v4`} stroke={pull >= 1 ? "#7CFFB2" : "#fff"} strokeWidth="0.9" />
            {wind ? (
              <circle cx={sight.x + wind * (dist / 18) * 1.5} cy={sight.y} r="1.6" fill="none" stroke="#9fd8ff" strokeOpacity="0.55" strokeDasharray="1 1.2" strokeWidth="0.6" />
            ) : null}
          </g>
        ) : null}
        {/* freccia in volo */}
        {flyPos ? (
          <g transform={`translate(${flyPos.x} ${flyPos.y}) rotate(${flyPos.ang}) scale(${flyPos.k})`}>
            <path d="M-34 0 L-6 0" stroke="#fff" strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round" />
            <line x1="-30" y1="0" x2="6" y2="0" stroke={look.shaft || "#1d1f22"} strokeWidth="1.6" />
            <path d="M6 -1.6 L11 0 L6 1.6 Z" fill="#cfd6dd" />
            <path d="M-30 0 L-25 -3.6 L-19 -3 L-18 0 Z" fill={look.cock} />
            <path d="M-30 0 L-25 3.6 L-19 3 L-18 0 Z" fill={look.fletch} />
          </g>
        ) : null}
      </svg>

      {/* arciere */}
      <div className="pointer-events-none absolute" style={{ left: `${(AV.left / W) * 100}%`, top: `${(AV_TOP / H) * 100}%`, width: `${(AV.width / W) * 100}%`, height: `${(AV_H / H) * 100}%` }}>
        <ArcherAvatar look={look} drive={drive} interactive={false} hideFlight className="h-full w-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.4)]" />
      </div>

      {/* punteggio che salta fuori */}
      {pop ? (
        <span key={pop.id} className="aa-game-pop aa-game-score pointer-events-none absolute text-3xl font-black text-[#ffe08a]" style={pct(pop.x, pop.y)}>
          {pop.text}
        </span>
      ) : null}

      {/* HUD */}
      <div className="aa-game-hud pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="grid gap-1.5" data-ui>
          <span className="aa-game-pill">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`inline-block h-3.5 w-1.5 rounded-full ${i < hits.length ? "bg-white/25" : "bg-[#ffd27a]"}`} />
            ))}
            <span className="ml-1">Volée</span>
          </span>
          <span className="aa-game-pill" title="Vento">
            <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden style={{ transform: wind < 0 ? "scaleX(-1)" : undefined }}>
              <path d="M1 3 H9 a2 2 0 1 0 -2 -2 M1 7 H11 a2 2 0 1 1 -2 2" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            </svg>
            {Math.abs(wind).toFixed(1)} m/s {wind === 0 ? "" : wind > 0 ? "→" : "←"}
          </span>
        </div>
        <div className="text-right text-white">
          <p className="aa-game-score text-4xl font-black leading-none">{total}</p>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-white/75">record {bestHere}/30</p>
        </div>
      </div>
      {children}

      {/* distanza */}
      <div data-ui className="absolute bottom-3 right-3 flex gap-1 rounded-full bg-black/45 p-1 backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
        {DISTANCES.map((d) => (
          <button key={d} type="button" onClick={() => pickDist(d)} className={`rounded-full px-2.5 py-1 text-[0.72rem] font-bold ${d === dist ? "bg-[#ffd27a] text-[#2a1d0c]" : "text-white/85"}`}>
            {d} m
          </button>
        ))}
      </div>

      {!touched && !draw && !flight && !done ? (
        <div className="pointer-events-none absolute inset-x-0 top-[40%] flex justify-center">
          <p className="aa-game-hint rounded-2xl bg-black/50 px-4 py-2 text-center text-sm font-semibold text-white backdrop-blur">
            Tieni premuto per tendere
            <span className="block text-xs font-normal text-white/80">trascina per mirare, lascia per tirare</span>
          </p>
        </div>
      ) : null}
      {draw && pull >= 1 && hold > 3 ? (
        <p className="pointer-events-none absolute inset-x-0 top-[22%] text-center text-xs font-semibold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">Il braccio si stanca: tira o rilassa</p>
      ) : null}

      {done ? (
        <div data-ui className="absolute inset-x-4 top-[24%] rounded-3xl bg-[#101814]/80 p-4 text-center text-white backdrop-blur-md" onPointerDown={(e) => e.stopPropagation()}>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/70">Volée a {dist} m</p>
          <p className="aa-game-score mt-1 text-5xl font-black">{total}<span className="text-xl text-white/60">/30</span></p>
          <p className="mt-1 text-sm text-white/85">
            {hits.map((h) => (h.score === 0 ? "M" : h.x10 ? "X" : h.score)).join(" · ")}
            {total >= bestHere && total > 0 ? " · nuovo record" : ""}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={again} className="rounded-full bg-[#ffd27a] px-4 py-2.5 text-sm font-bold text-[#2a1d0c]">Altra volée</button>
            {dist !== 70 ? (
              <button type="button" onClick={() => pickDist(DISTANCES[DISTANCES.indexOf(dist) + 1])} className="rounded-full bg-white/15 px-4 py-2.5 text-sm font-bold">Più lontano</button>
            ) : (
              <button type="button" onClick={() => pickDist(18)} className="rounded-full bg-white/15 px-4 py-2.5 text-sm font-bold">Torna a 18 m</button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
