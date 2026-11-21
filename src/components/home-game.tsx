import { Component, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import type { AvatarLook } from "@/lib/arcieri/avatar";
import { useSky } from "@/lib/arcieri/sky3d";
import { useLocalState } from "@/lib/arcieri/local-store";
import { award, readXp, today } from "@/lib/arcieri/xp";
import { ArcherAvatar } from "./archer-avatar";
import { SceneBackdrop } from "./scene-2d";
import { SCENES, isIndoor } from "@/lib/arcieri/scenes";

/**
 * Gioco della Home con il tuo arciere, nell'ambientazione scelta.
 * Se non tocchi niente l'arciere tira da solo (dimostrazione). Appena tocchi compare il mirino e
 * giochi tu: tieni premuto per tendere, trascina per mirare, lascia per scoccare. Vento, tremolio se
 * tieni troppo, trazione incompleta che fa cadere il tiro, bersaglio fermo o in movimento.
 *
 * Mondo in unità SVG 300×400 (contenitore 3:4, nessuna deformazione).
 */
const W = 300;
const H = 400;
const AV = { left: -24, width: 220 };
const AV_H = (AV.width * 350) / 300;
const AV_TOP = H - 6 - AV_H;
const GRIP = { x: AV.left + ((250 - 40) / 300) * AV.width, y: AV_TOP + (124 / 350) * AV_H };
const BASE = { x: 232, y: 236 };
// a ogni volée una distanza a caso: il bersaglio è più grande o più piccolo, il vento pesa di più o di meno
const DISTANCES = [18, 25, 30, 40, 50, 60, 70] as const;
type Dist = (typeof DISTANCES)[number];
const randomDist = (not?: number): Dist => {
  const pool = DISTANCES.filter((d) => d !== not);
  return pool[Math.floor(Math.random() * pool.length)];
};
const RINGS = ["#f4f1ea", "#f4f1ea", "#1a1c1e", "#1a1c1e", "#2a6294", "#2a6294", "#c4473d", "#c4473d", "#e6b325", "#e6b325"];
const DRAW_S = 0.75;
const STATIONS = 20;
const ROUND_KEY = "aa-game-round";

type Hit = { dx: number; dy: number; score: number; x10: boolean };
type Flight = { from: { x: number; y: number }; to: { x: number; y: number }; hit: Hit; t0: number; dur: number; arc: number; demo: boolean };
type Draw = { t0: number; sx: number; sy: number; ax: number; ay: number; aim: { x: number; y: number }; demo: boolean; releaseAt?: number };

const radiusOf = (d: Dist) => 34 * Math.sqrt(18 / d);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const now = () => performance.now() / 1000;

export function HomeGame({ look, children, info, className = "" }: { look: AvatarLook; children?: ReactNode; info?: ReactNode; className?: string }) {
  const { sky } = useSky();
  const lefty = Boolean(look.lefty);
  // tra una piazzola e l'altra l'ambientazione cambia da sola: si parte da quella scelta
  const [scene, setScene] = useState(look.scene);
  // al chiuso non c'è vento: niente deriva e niente manica a vento
  const indoor = isIndoor(scene);
  useEffect(() => setScene(look.scene), [look.scene]);
  const nextScene = () => setScene((cur) => {
    const others = SCENES.filter((sc) => sc.id !== cur);
    return others[Math.floor(Math.random() * others.length)]?.id ?? cur;
  });
  const bodyLook = useMemo(() => (look.lefty ? { ...look, lefty: false } : look), [look]);
  const stage = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState<Dist>(() => randomDist());
  // il bersaglio si muove sempre da solo: ampiezza e velocità cambiano a ogni volée
  const [motion, setMotion] = useState(() => ({ amp: 18 + Math.random() * 18, speed: 0.45 + Math.random() * 0.5, phase: Math.random() * 6 }));
  const moving = true;
  const [best, setBest] = useLocalState<number>("aa-game-best-giro", 0);
  const [hits, setHits] = useState<Hit[]>([]);
  const [demoHits, setDemoHits] = useState<Hit[]>([]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [draw, setDraw] = useState<Draw | null>(null);
  const [released, setReleased] = useState<number | null>(null);
  const [t, setT] = useState(() => now());
  const [pop, setPop] = useState<{ id: number; x: number; y: number; text: string } | null>(null);
  const [puff, setPuff] = useState<{ id: number; x: number; y: number; t0: number } | null>(null);
  // colpo sul paglione: il bersaglio vibra un attimo (niente scossoni di tutto il riquadro, che lampeggiava)
  const [thud, setThud] = useState<number | null>(null);
  const [rawWind, setWind] = useState(() => Math.round((Math.random() * 6 - 3) * 10) / 10);
  const wind = indoor ? 0 : rawWind;
  const [playing, setPlaying] = useState(false);
  const lastTouch = useRef(0);
  const landed = useRef(0);
  const hitsRef = useRef<Hit[]>([]);
  const stationsRef = useRef<number[]>([]);
  const R = radiusOf(dist);
  // un giro è di 20 piazzole da 3 frecce: alla fine di ogni piazzola si passa alla successiva
  const [station, setStation] = useState(1);
  const [stations, setStations] = useState<number[]>([]);
  const stationDone = playing && hits.length >= 3 && !flight;
  const done = stationDone && station >= STATIONS;
  const piazzola = hits.reduce((a, h) => a + h.score, 0);
  const total = stations.reduce((a, b) => a + b, 0) + (stationDone ? 0 : piazzola);

  // il giro resta salvato sul telefono: cambiando pagina e tornando si riparte dalla stessa piazzola
  const restored = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ROUND_KEY);
      if (raw) {
        const r = JSON.parse(raw) as { station?: number; stations?: number[]; hits?: Hit[]; dist?: Dist; wind?: number; at?: number };
        const fresh = typeof r.at === "number" && Date.now() - r.at < 7 * 86_400_000;
        if (fresh && Array.isArray(r.stations) && r.stations.length < STATIONS && (r.stations.length > 0 || (r.hits?.length ?? 0) > 0)) {
          stationsRef.current = r.stations.map(Number).filter((v) => Number.isFinite(v));
          setStations(stationsRef.current);
          setStation(Math.min(STATIONS, stationsRef.current.length + 1));
          const hs = Array.isArray(r.hits) ? r.hits.filter((h) => h && typeof h.score === "number").slice(0, 2) : [];
          hitsRef.current = hs;
          setHits(hs);
          if (r.dist && DISTANCES.includes(r.dist)) setDist(r.dist);
          if (typeof r.wind === "number") setWind(r.wind);
          setPlaying(true);
        }
      }
    } catch {
      /* giro salvato rovinato: si ricomincia */
    }
    restored.current = true;
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    try {
      if (!playing || stations.length >= STATIONS || (stations.length === 0 && hits.length === 0)) localStorage.removeItem(ROUND_KEY);
      else localStorage.setItem(ROUND_KEY, JSON.stringify({ station, stations, hits: hits.length >= 3 ? [] : hits, dist, wind: rawWind, at: Date.now() }));
    } catch {
      /* memoria non disponibile */
    }
  }, [playing, station, stations, hits, dist, rawWind]);
  // il record si aggiorna subito, anche a giro non finito
  useEffect(() => {
    if (playing && total > best) setBest(total);
  }, [playing, total, best]);

  // posizione del bersaglio: fermo, o su un carrello che va avanti e indietro
  const amp = motion.amp;
  const speed = motion.speed + (dist - 18) / 160;
  const targetAt = (time: number) => ({ x: BASE.x + Math.sin(time * speed + motion.phase) * amp, y: BASE.y });
  const T = targetAt(t);
  const since0 = thud != null ? t - thud : 9;
  const wobble = since0 < 0.4 ? Math.sin(since0 * 48) * 1.6 * (1 - since0 / 0.4) : 0;

  // orologio: fluido mentre si tende o la freccia vola, più lento a riposo (risparmia batteria)
  const busy = draw != null || flight != null || (released != null && t - released < 1.2) || (thud != null && t - thud < 0.6);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (ms: number) => {
      const step = busy ? 0 : moving ? 25 : 40;
      if (ms - last >= step && !document.hidden) {
        last = ms;
        setT(ms / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [busy, moving]);

  const pull = draw ? clamp((t - draw.t0) / DRAW_S, 0, 1) : 0;
  const hold = draw ? Math.max(0, t - draw.t0 - DRAW_S) : 0;
  const swayA = (draw?.demo ? 0.6 : 0.8) + Math.max(0, hold - 3) * 2.2 + (sky.weather === "pioggia" ? 0.5 : 0);
  const sway = draw ? { x: Math.sin(t * 1.7) * swayA + Math.sin(t * 4.1) * swayA * 0.25, y: Math.cos(t * 1.3) * swayA * 0.8 } : { x: 0, y: 0 };
  const sight = draw ? { x: draw.aim.x + sway.x, y: draw.aim.y + sway.y } : null;

  const shoot = (d: Draw, at: number) => {
    const p = clamp((at - d.t0) / DRAW_S, 0, 1);
    setDraw(null);
    setReleased(at);
    if (p < 0.25 || !sight) return;
    const drift = wind * (dist / 18) * 1.4;
    const drop = (1 - p) * (40 + dist * 0.8);
    const spread = 0.6 + dist / 60;
    const dur = 0.36 + dist / 170;
    const land = targetAt(at + dur);
    const x = sight.x + drift + (Math.random() - 0.5) * spread * 2;
    const y = sight.y + drop + (Math.random() - 0.5) * spread * 2;
    const dx = x - land.x;
    const dy = y - land.y;
    const r = Math.hypot(dx, dy) / R;
    const score = r <= 1 ? Math.max(1, 10 - Math.floor(r * 10)) : 0;
    const from = { x: GRIP.x + 6, y: GRIP.y - (BASE.y - d.aim.y) * 0.25 };
    setFlight({ from, to: { x, y }, hit: { dx, dy, score, x10: r <= 0.05 }, t0: at, dur, arc: 6 + dist * 0.35, demo: d.demo });
  };

  // dimostrazione: se nessuno tocca da qualche secondo, l'arciere tira da solo
  useEffect(() => {
    if (playing || draw || flight) return;
    if (released != null && t - released < 1.4) return;
    if (t - lastTouch.current < 2.5) return;
    const start = now();
    const land = targetAt(start + 1.6 + 0.36 + dist / 170);
    const err = R * 0.32;
    const ax = land.x - wind * (dist / 18) * 1.1 + (Math.random() - 0.5) * err * 2;
    const ay = land.y + (Math.random() - 0.5) * err * 2;
    setDraw({ t0: start, sx: 0, sy: 0, ax, ay, aim: { x: ax, y: ay }, demo: true, releaseAt: start + DRAW_S + 0.9 + Math.random() * 0.5 });
  }, [t, playing, draw, flight, released]);
  useEffect(() => {
    if (draw?.demo && draw.releaseAt && t >= draw.releaseAt) shoot(draw, t);
  }, [t, draw]);

  // la freccia in volo
  let flyPos: { x: number; y: number; ang: number; k: number } | null = null;
  if (flight) {
    const u = clamp((t - flight.t0) / flight.dur, 0, 1);
    const x = flight.from.x + (flight.to.x - flight.from.x) * u;
    const y = flight.from.y + (flight.to.y - flight.from.y) * u - flight.arc * 4 * u * (1 - u);
    const dy = flight.to.y - flight.from.y - flight.arc * 4 * (1 - 2 * u);
    flyPos = { x, y, ang: (Math.atan2(dy, flight.to.x - flight.from.x) * 180) / Math.PI, k: 1 - u * 0.62 };
    if (u >= 1 && landed.current !== flight.t0) {
      landed.current = flight.t0;
      const f = flight;
      queueMicrotask(() => land(f));
    }
  }

  const land = (f: Flight) => {
    setFlight(null);
    const h = f.hit;
    const at = targetAt(now());
    setPop({ id: Date.now(), x: at.x + h.dx, y: at.y + h.dy, text: h.score === 0 ? "M" : h.x10 ? "X" : String(h.score) });
    if (h.score > 0) setPuff({ id: Date.now(), x: at.x + h.dx, y: at.y + h.dy, t0: now() });
    setThud(now());
    if (f.demo) {
      setDemoHits((list) => [...list.slice(-5), h]);
      return;
    }
    const next = [...hitsRef.current, h];
    hitsRef.current = next;
    setHits(next);
    if (next.length === 3) finish(next);
    try {
      navigator.vibrate?.(h.score >= 9 ? [18, 30, 18] : 12);
    } catch {
      /* niente */
    }
  };

  const finish = (list: Hit[]) => {
    const sum = list.reduce((a, h) => a + h.score, 0);
    const all = [...stationsRef.current, sum];
    stationsRef.current = all;
    setStations(all);
    if (all.length < STATIONS) {
      // breve riepilogo della piazzola, poi si cammina alla prossima
      window.setTimeout(() => nextStation(), 1700);
      return;
    }
    const round = all.reduce((a, b) => a + b, 0);
    // punti esperienza: al massimo tre giri al giorno
    const day = today();
    for (let i = 1; i <= 3; i++) {
      const once = `giro-${day}-${i}`;
      if (readXp().log.some((l) => l.why === once)) continue;
      award(round >= 540 ? 8 : round >= 450 ? 6 : round >= 350 ? 4 : 2, "Giro di 20 piazzole", once);
      break;
    }
  };

  const toWorld = (cx: number, cy: number) => {
    const r = stage.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const x = ((cx - r.left) / r.width) * W;
    return { x: lefty ? W - x : x, y: ((cy - r.top) / r.height) * H };
  };

  const onDown = (e: RPointerEvent) => {
    lastTouch.current = now();
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    if (!playing) {
      // si entra in gioco: via la dimostrazione
      setPlaying(true);
      setDemoHits([]);
      if (draw?.demo) setDraw(null);
    }
    if (flight && !flight.demo) return;
    if (stationDone || (draw && !draw.demo)) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const w = toWorld(e.clientX, e.clientY);
    const ax = T.x + (Math.random() - 0.5) * R * 1.6;
    const ay = T.y + (Math.random() - 0.5) * R * 1.6;
    setReleased(null);
    const t0 = now();
    setT(t0);
    setDraw({ t0, sx: w.x, sy: w.y, ax, ay, aim: { x: ax, y: ay }, demo: false });
  };
  const onMove = (e: RPointerEvent) => {
    if (!draw || draw.demo) return;
    lastTouch.current = now();
    const w = toWorld(e.clientX, e.clientY);
    const k = 0.45;
    setDraw({ ...draw, aim: { x: clamp(draw.ax + (w.x - draw.sx) * k, BASE.x - 110, BASE.x + 55), y: clamp(draw.ay + (w.y - draw.sy) * k, BASE.y - 90, BASE.y + 80) } });
  };
  const onUp = () => {
    lastTouch.current = now();
    if (!draw || draw.demo) return;
    shoot(draw, now());
  };

  // nuova piazzola: distanza, vento e movimento del bersaglio cambiano
  const freshStation = () => {
    hitsRef.current = [];
    setHits([]);
    setPop(null);
    setWind(Math.round((Math.random() * 6 - 3) * 10) / 10);
    setDist((d) => randomDist(d));
    setMotion({ amp: 18 + Math.random() * 18, speed: 0.45 + Math.random() * 0.5, phase: Math.random() * 6 });
  };
  const nextStation = () => {
    if (stationsRef.current.length >= STATIONS) return;
    nextScene();
    setStation(stationsRef.current.length + 1);
    freshStation();
  };
  const again = () => {
    nextScene();
    stationsRef.current = [];
    setStations([]);
    setStation(1);
    freshStation();
  };
  const stop = () => {
    setPlaying(false);
    again();
    lastTouch.current = now();
  };

  const aimLift = draw ? clamp((BASE.y - draw.aim.y) / 6, -14, 18) : 0;
  // dopo l'accompagnamento l'arciere torna in posizione: niente pose bloccate
  const since = released != null && !draw ? t - released : null;
  const active = draw != null || (since != null && since < 2.4);
  const drive = useMemo(() => (active ? { pull, aim: aimLift, released: since != null && since < 2.4 ? since : null } : null), [active, pull, aimLift, since]);
  const bestHere = best;
  const pct = (x: number, y: number) => ({ left: `${((lefty ? W - x : x) / W) * 100}%`, top: `${(y / H) * 100}%` });
  const shownHits = playing ? hits : demoHits;
  // la manica pende quando non c'è vento e si alza quando soffia
  const droop = clamp(75 - Math.abs(wind) * 24, 4, 75) + Math.sin(t * 6) * Math.min(4, Math.abs(wind) * 1.5);

  return (
    <div
      ref={stage}
      className={`aa-game aspect-[3/4] w-full ${className}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="application"
      aria-label="Gioco: tieni premuto per tendere, trascina per mirare, lascia per tirare"
    >
      {/* mancino: campo, bersaglio e arciere si specchiano; i testi restano dritti */}
      <div className={`pointer-events-none absolute inset-0 ${lefty ? "aa-mirror" : ""}`}>
      <div key={scene} className="aa-scene-swap absolute inset-0">
        <SceneBackdrop sky={sky} id="game" scene={scene} wind={wind} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="gm-straw" cx="0.4" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#e2c58c" />
            <stop offset="1" stopColor="#a8823f" />
          </radialGradient>
          <linearGradient id="gm-lane" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.04" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.14" />
          </linearGradient>
          <radialGradient id="gm-glow">
            <stop offset="0.45" stopColor="#fff6c8" stopOpacity="0.45" />
            <stop offset="1" stopColor="#fff6c8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="gm-vig" cx="0.5" cy="0.45" r="0.75">
            <stop offset="0.6" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.35" />
          </radialGradient>
        </defs>
        {/* corsia verso il paglione */}
        <path d={`M${BASE.x - 30} 300 L${BASE.x + 30} 300 L320 400 L40 400 Z`} fill="url(#gm-lane)" />
        {[0.3, 0.6].map((u) => {
          const y = 300 + u * 100;
          return <line key={u} x1={BASE.x - 30 + (40 - (BASE.x - 30)) * u} y1={y} x2={BASE.x + 30 + (320 - (BASE.x + 30)) * u} y2={y} stroke="#fff" strokeOpacity="0.16" strokeWidth={1 + u} strokeDasharray="5 6" />;
        })}
        {/* manica a vento: indica direzione e forza (al chiuso non serve) */}
        <g transform="translate(286 300)" opacity={indoor ? 0 : 1}>
          <line x1="0" y1="0" x2="0" y2="-46" stroke="#d9d4c8" strokeWidth="1.6" />
          <g transform={`translate(0 -44) rotate(${wind >= 0 ? droop : 180 - droop})`}>
            {[0, 1, 2, 3].map((i) => <path key={i} d={`M${i * 5} -3 L${i * 5 + 5} -2.6 L${i * 5 + 5} 2.6 L${i * 5} 3 Z`} fill={i % 2 ? "#f4f1ea" : "#e06a2a"} />)}
          </g>
        </g>
        {/* binario del bersaglio mobile */}
        {moving ? <path d={`M${BASE.x - amp - 30} 302 H${BASE.x + amp + 30}`} stroke="#5b3d22" strokeWidth="2.4" strokeLinecap="round" /> : null}
        {/* paglione su cavalletto */}
        <g transform={`translate(${(T.x - BASE.x + wobble).toFixed(2)} 0)`}>
          <ellipse cx={BASE.x + 3} cy={302} rx={R * 1.6} ry="4" fill="#000" opacity="0.3" />
          <circle cx={BASE.x} cy={BASE.y} r={R * 1.9} fill="url(#gm-glow)" className="aa-target-glow" />
          <path d={`M${BASE.x - R * 0.8} ${BASE.y + R * 0.8} L${BASE.x - R * 1.05} 302 M${BASE.x + R * 0.8} ${BASE.y + R * 0.8} L${BASE.x + R * 1.05} 302 M${BASE.x} ${BASE.y + R} L${BASE.x + R * 0.3} 300`} stroke="#5b3d22" strokeWidth={Math.max(2, R * 0.09)} strokeLinecap="round" />
          {moving ? [-1, 1].map((s) => <circle key={s} cx={BASE.x + s * R * 0.9} cy="302" r="3" fill="#2a2f35" stroke="#9aa0a6" strokeWidth="0.8" />) : null}
          <rect x={BASE.x - R * 1.18 + 2} y={BASE.y - R * 1.18 + 3} width={R * 2.36} height={R * 2.36} rx={R * 0.25} fill="#5b3d22" opacity="0.6" />
          <rect x={BASE.x - R * 1.18} y={BASE.y - R * 1.18} width={R * 2.36} height={R * 2.36} rx={R * 0.25} fill="url(#gm-straw)" stroke="#7d5a2a" strokeWidth="1" />
          {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${BASE.x - R * 1.15} ${BASE.y - R + i * R * 0.34} h${R * 2.3}`} stroke="#8e6a33" strokeOpacity="0.35" strokeWidth="0.7" />)}
          {RINGS.map((c, i) => <circle key={i} cx={BASE.x} cy={BASE.y} r={R * (1 - i / 10)} fill={c} stroke={i < 2 ? "#1a1c1e" : i < 4 ? "#f4f1ea" : "#1a1c1e"} strokeWidth={0.35} strokeOpacity="0.6" />)}
          <path d={`M${BASE.x - 1.5} ${BASE.y} h3 M${BASE.x} ${BASE.y - 1.5} v3`} stroke="#1a1c1e" strokeWidth="0.4" />
          {shownHits.map((h, i) =>
            h.score > 0 ? (
              <g key={i} opacity={playing ? 1 : 0.85}>
                <circle cx={BASE.x + h.dx} cy={BASE.y + h.dy} r="1.1" fill="#101214" />
                <line x1={BASE.x + h.dx} y1={BASE.y + h.dy} x2={BASE.x + h.dx - 8} y2={BASE.y + h.dy + 2.6} stroke={look.shaft || "#1d1f22"} strokeWidth="1.4" strokeLinecap="round" />
                <path d={`M${BASE.x + h.dx - 8} ${BASE.y + h.dy + 2.6} l-3.8 -2.8 l1.5 3.8 z`} fill={look.fletch} />
                <path d={`M${BASE.x + h.dx - 8} ${BASE.y + h.dy + 2.6} l-2.5 3.2 l2.8 -0.4 z`} fill={look.cock} />
              </g>
            ) : null,
          )}
        </g>
        {/* mirino: piccolo, solo quando giochi tu */}
        {sight && !draw?.demo ? (
          <g opacity={0.45 + pull * 0.55}>
            <circle cx={sight.x} cy={sight.y} r={2.6 + (1 - pull) * 5} fill="none" stroke={pull >= 1 ? "#7CFFB2" : "#fff"} strokeWidth="0.8" />
            <circle cx={sight.x} cy={sight.y} r="0.6" fill={pull >= 1 ? "#7CFFB2" : "#fff"} />
            <path d={`M${sight.x - 6} ${sight.y} h2.6 M${sight.x + 3.4} ${sight.y} h2.6 M${sight.x} ${sight.y - 6} v2.6 M${sight.x} ${sight.y + 3.4} v2.6`} stroke={pull >= 1 ? "#7CFFB2" : "#fff"} strokeWidth="0.7" />
          </g>
        ) : null}
        {/* freccia in volo con scia */}
        {flyPos ? (
          <g transform={`translate(${flyPos.x} ${flyPos.y}) rotate(${flyPos.ang}) scale(${flyPos.k})`}>
            <path d="M-46 0 L-8 0" stroke="#fff" strokeOpacity="0.22" strokeWidth="3.4" strokeLinecap="round" />
            <line x1="-30" y1="0" x2="6" y2="0" stroke={look.shaft || "#1d1f22"} strokeWidth="1.6" />
            <path d="M6 -1.6 L11 0 L6 1.6 Z" fill="#cfd6dd" />
            <path d="M-30 0 L-25 -3.6 L-19 -3 L-18 0 Z" fill={look.cock} />
            <path d="M-30 0 L-25 3.6 L-19 3 L-18 0 Z" fill={look.fletch} />
          </g>
        ) : null}
        {puff && t - puff.t0 < 0.5 ? (
          // sbuffo di paglia: calcolato a ogni fotogramma insieme al resto, senza animazioni CSS dentro l'SVG
          <g opacity={(1 - (t - puff.t0) / 0.5).toFixed(2)}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const k = 0.6 + ((t - puff.t0) / 0.5) * 1.8;
              return <circle key={i} cx={puff.x + Math.cos(i) * 4 * k} cy={puff.y + Math.sin(i * 1.7) * 3 * k} r={1.4 * k} fill="#e2c58c" />;
            })}
          </g>
        ) : null}
        <rect width={W} height={H} fill="url(#gm-vig)" pointerEvents="none" />
      </svg>

      {/* arciere, grande in primo piano */}
      <div className="pointer-events-none absolute" style={{ left: `${(AV.left / W) * 100}%`, top: `${(AV_TOP / H) * 100}%`, width: `${(AV.width / W) * 100}%`, height: `${(AV_H / H) * 100}%` }}>
        <ArcherAvatar look={bodyLook} drive={drive} pose="riposo" interactive={false} hideFlight className="h-full w-full drop-shadow-[0_12px_20px_rgba(0,0,0,0.45)]" />
      </div>
      </div>

      {pop ? (
        <span key={pop.id} className="aa-game-pop aa-game-score pointer-events-none absolute text-3xl font-black text-[#ffe08a]" style={pct(pop.x, pop.y)}>
          {pop.text}
        </span>
      ) : null}

      {/* HUD: a sinistra le informazioni di oggi, a destra punteggio, volée e vento */}
      <div className="aa-game-hud pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="min-w-0 text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.55)]">{info}</div>
        <div className="grid shrink-0 justify-items-end gap-1.5 text-right text-white">
          <p className="aa-game-score text-4xl font-black leading-none">{playing ? total : "—"}</p>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/75">record {bestHere}/{STATIONS * 30}</p>
          <span className="aa-game-pill">
            {[0, 1, 2].map((i) => <span key={i} className={`inline-block h-3.5 w-1.5 rounded-full ${i < hits.length ? "bg-white/25" : "bg-[#ffd27a]"}`} />)}
            <span className="ml-1">Piazzola {station}/{STATIONS}</span>
          </span>
          <span className="aa-game-pill">
            {indoor ? "Al chiuso, niente vento" : <>{Math.abs(wind).toFixed(1)} m/s {wind === 0 ? "" : (wind > 0) !== lefty ? "→" : "←"}</>}
          </span>
        </div>
      </div>
      {children}

      {!playing ? (
        <div className="pointer-events-none absolute inset-x-0 top-[70%] flex justify-center pl-[30%]">
          <p className="aa-game-hint rounded-2xl bg-black/45 px-4 py-2 text-center text-sm font-semibold text-white backdrop-blur">
            Tocca per giocare
            <span className="block text-xs font-normal text-white/80">tieni premuto, trascina per mirare, lascia</span>
          </p>
        </div>
      ) : null}
      {playing && !draw && !flight && !stationDone && hits.length === 0 && station === 1 ? (
        <button data-ui type="button" onPointerDown={(e) => e.stopPropagation()} onClick={stop} className="absolute left-3 top-[44%] rounded-full bg-black/45 px-3 py-1.5 text-[0.7rem] font-semibold text-white backdrop-blur">
          Guarda tirare
        </button>
      ) : null}
      {draw && !draw.demo && pull >= 1 && hold > 3 ? (
        <p className="pointer-events-none absolute inset-x-0 top-[30%] text-center text-xs font-semibold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">Il braccio si stanca: tira o rilassa</p>
      ) : null}

      {stationDone && !done ? (
        <div className="aa-rise pointer-events-none absolute inset-x-6 top-[30%] rounded-3xl bg-[#101814]/75 p-3 text-center text-white backdrop-blur-md">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-white/70">Piazzola {station} di {STATIONS}</p>
          <p className="aa-game-score text-4xl font-black">{piazzola}<span className="text-lg text-white/60">/30</span></p>
          <p className="text-xs text-white/80">{hits.map((h) => (h.score === 0 ? "M" : h.x10 ? "X" : h.score)).join(" · ")} · totale {total}</p>
          <p className="mt-1 text-[0.66rem] text-white/60">Si va alla prossima piazzola…</p>
        </div>
      ) : null}
      {done ? (
        <div data-ui className="absolute inset-x-4 top-[20%] rounded-3xl bg-[#101814]/85 p-4 text-center text-white backdrop-blur-md" onPointerDown={(e) => e.stopPropagation()}>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/70">Giro finito · {STATIONS} piazzole</p>
          <p className="aa-game-score mt-1 text-5xl font-black">{total}<span className="text-xl text-white/60">/{STATIONS * 30}</span></p>
          <p className="mt-1 text-sm text-white/85">media {(total / (STATIONS * 3)).toFixed(2).replace(".", ",")} a freccia{total >= bestHere && total > 0 ? " · nuovo record" : ""}</p>
          <div className="mx-auto mt-3 grid max-w-[16rem] grid-cols-10 gap-1">
            {stations.map((v, i) => <span key={i} className="grid h-6 place-items-center rounded-md text-[0.62rem] font-bold" style={{ background: v >= 27 ? "#ffd27a" : v >= 21 ? "#ff7a6e" : v >= 15 ? "#5aa6ff" : "rgba(255,255,255,0.15)", color: v >= 27 ? "#2a1d0c" : "#fff" }}>{v}</span>)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={again} className="rounded-full bg-[#ffd27a] px-4 py-2.5 text-sm font-bold text-[#2a1d0c]">Nuovo giro</button>
            <button type="button" onClick={stop} className="rounded-full bg-white/15 px-4 py-2.5 text-sm font-bold">Guarda tirare</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Se il gioco dovesse rompersi, il resto della Home continua a funzionare. */
export class GameGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error(err);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="grid aspect-[3/4] w-full place-items-center rounded-[1.75rem] bg-white/[0.04] p-6 text-center text-sm text-muted">
          <p>
            Il gioco non è partito.{" "}
            <button type="button" className="underline" onClick={() => this.setState({ failed: false })}>
              Riprova
            </button>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
