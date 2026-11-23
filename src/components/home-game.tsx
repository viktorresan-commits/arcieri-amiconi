import type { Form } from "@/lib/arcieri/coach";
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import type { AvatarLook } from "@/lib/arcieri/avatar";
import { useSky } from "@/lib/arcieri/sky3d";
import { useLocalState } from "@/lib/arcieri/local-store";
import { award, readXp, today } from "@/lib/arcieri/xp";
import { ArcherAvatar } from "./archer-avatar";
import { Glyph, type IconName } from "./icons";
import { ArcherLightDefs, SceneBackdrop, isPainted, lightMode } from "./scene-2d";
import { GameApron } from "./scene-apron";
import { SCENES, isIndoor } from "@/lib/arcieri/scenes";
import { ANIMALS, type Animal } from "@/lib/arcieri/sagome";
import { GAME_LEVELS, GAME_MODES, GAME_STATIONS, levelOf, maxRound, modeOf, type GameLevel, type GameMode } from "@/lib/arcieri/game-modes";
import { myGameRecords, saveGameRound } from "@/lib/arcieri/game.api";

/**
 * Gioco della Home con il tuo arciere, nell'ambientazione scelta.
 * Se non tocchi niente l'arciere tira da solo (dimostrazione). Appena tocchi compare il mirino e
 * giochi tu: tieni premuto per tendere, trascina per mirare, lascia per scoccare. Vento, tremolio se
 * tieni troppo, trazione incompleta che fa cadere il tiro, bersaglio fermo o in movimento.
 *
 * Mondo in unità SVG 300×400 (contenitore 3:4, nessuna deformazione).
 * Tre bersagli (Bersaglio 10 anelli, Field 6-1, Sagome 8-5-0) e tre livelli; il record di ogni
 * combinazione si salva sul server a fine giro e compare nel profilo dell'arciere.
 */
const W = 300;
const H = 400;
// arciere un po' più grande: i piedi possono finire sotto i pulsanti
const AV = { left: -40, width: 252 };
const AV_H = (AV.width * 350) / 300;
const AV_TOP = H + 34 - AV_H;
const GRIP = { x: AV.left + ((250 - 40) / 300) * AV.width, y: AV_TOP + (124 / 350) * AV_H };
const BASE = { x: 232, y: 236 };
// a ogni volée una distanza a caso tra quelle del livello: il bersaglio è più grande o più piccolo, il vento pesa di più o di meno
type Dist = number;
const randomDist = (pool: number[], not?: number): Dist => {
  const list = pool.length > 1 ? pool.filter((d) => d !== not) : pool;
  return list[Math.floor(Math.random() * list.length)];
};
const RINGS = ["#f4f1ea", "#f4f1ea", "#1a1c1e", "#1a1c1e", "#2a6294", "#2a6294", "#c4473d", "#c4473d", "#e6b325", "#e6b325"];
// field: due zone gialle (6 e 5) e quattro nere (4, 3, 2, 1), tutte della stessa larghezza
const FIELD = ["#1a1c1e", "#1a1c1e", "#1a1c1e", "#1a1c1e", "#e6b325", "#e6b325"];
const DRAW_S = 0.75;
const STATIONS = GAME_STATIONS;
const ROUND_KEY = "aa-game-round";
const randomWind = (max: number) => Math.round((Math.random() * 2 - 1) * max * 10) / 10;
const randomAnimal = (not?: string) => {
  const pool = ANIMALS.filter((a) => a.id !== not);
  return pool[Math.floor(Math.random() * pool.length)].id;
};

/** sagoma: forma dell'animale (trasparenza del disegno) per capire se la freccia è sul corpo */
type Mask = { w: number; h: number; data: Uint8ClampedArray };
const masks = new Map<string, Mask | "loading">();
function loadMask(src: string, done: () => void) {
  if (masks.has(src) || typeof window === "undefined") return;
  masks.set(src, "loading");
  const img = new Image();
  img.onload = () => {
    try {
      const w = Math.min(260, img.naturalWidth);
      const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      masks.set(src, { w, h, data: ctx.getImageData(0, 0, w, h).data });
      done();
    } catch {
      masks.delete(src);
    }
  };
  img.onerror = () => masks.delete(src);
  img.src = src;
}
const maskOf = (src: string) => {
  const m = masks.get(src);
  return m && m !== "loading" ? m : null;
};

type Hit = { dx: number; dy: number; score: number; x10: boolean };
type Flight = { from: { x: number; y: number }; to: { x: number; y: number }; hit: Hit; t0: number; dur: number; arc: number; demo: boolean };
type Draw = { t0: number; sx: number; sy: number; ax: number; ay: number; aim: { x: number; y: number }; demo: boolean; releaseAt?: number };

const radiusOf = (d: Dist) => 34 * Math.sqrt(18 / d);

/** dove sta la sagoma rispetto al centro del cavalletto, in unità del mondo */
function sagomaBox(a: Animal, R: number) {
  const m = maskOf(a.src);
  const w = R * 3;
  const h = w * (m ? m.h / m.w : 0.8);
  // poggia a terra (y 300), centrata sul carrello
  return { w, h, left: -w / 2, top: 300 - BASE.y - h };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const now = () => performance.now() / 1000;

export function HomeGame({ look, children, info, className = "", form, perks = [], banner, bleed = false, apron }: {
  look: AvatarLook;
  children?: ReactNode;
  info?: ReactNode;
  className?: string;
  /** dove finiscono davvero le tue frecce: l'arciere, quando tira da solo, tira come te */
  form?: Form | null;
  /** privilegi attivi: "fuoco" (scia di fuoco), "aura" (luce d'oro), "stendardo" (bandiera della compagnia), "corona" */
  perks?: string[];
  /** colore dello stendardo della compagnia */
  banner?: string;
  /** a tutta larghezza, senza riquadro: la scena sfuma nella pagina */
  bleed?: boolean;
  /** pulsanti da mettere sotto il gioco: la scena si allunga e ci stanno sopra */
  apron?: ReactNode;
}) {
  const fire = perks.includes("fuoco");
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
  const wrap = useRef<HTMLDivElement>(null);
  // con i pulsanti sotto: se lo schermo è basso, il cielo in cima si accorcia quanto basta perché
  // gioco e pulsanti si vedano interi tra la barra in alto e quella in basso, senza scorrere
  const [crop, setCrop] = useState(0);
  // schermo basso: il cielo è stato accorciato e il pannello del campo finirebbe sul bersaglio
  const [tight, setTight] = useState(false);
  useLayoutEffect(() => {
    if (!apron) return;
    const calc = () => {
      const el = stage.current;
      const box = wrap.current;
      const inner = box?.parentElement?.querySelector<HTMLElement>(".aa-apron-inner");
      if (!el || !box || !inner) return;
      const gh = el.getBoundingClientRect().height;
      const below = inner.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom;
      const nav = document.querySelector<HTMLElement>(".aa-bottomnav");
      const navH = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().height : 0;
      const top = box.getBoundingClientRect().top + window.scrollY;
      const over = top + gh + below + 10 - (window.innerHeight - navH);
      // mai tanto da far finire la testa dell'arciere sotto il blocco di oggi (data, titolo e due righe):
      // su telefoni molto bassi piuttosto si scorre un poco per l'ultima riga di pulsanti
      const headTop = gh * ((AV_TOP + AV_H * 0.08) / H);
      setCrop(Math.round(Math.max(0, Math.min(gh * 0.34, headTop - 90, over))));
      setTight(over > gh * 0.1);
    };
    calc();
    const t = window.setTimeout(calc, 400);
    window.addEventListener("resize", calc);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(calc) : null;
    const inner = wrap.current?.parentElement?.querySelector(".aa-apron-inner");
    if (ro && inner) ro.observe(inner);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", calc);
      ro?.disconnect();
    };
  }, [apron != null]);
  // bersaglio e livello scelti: restano sul telefono
  const [modeId, setModeId] = useLocalState<GameMode>("aa-game-mode", "fita");
  const [levelId, setLevelId] = useLocalState<GameLevel>("aa-game-level", "normale");
  const mode = modeOf(modeId);
  const level = levelOf(levelId);
  const [picker, setPicker] = useState(false);
  // il pannello del campo si può ridurre a un bottone, e resta come lo si è lasciato
  const [hudOpen, setHudOpen] = useLocalState<boolean>("aa-hud-open", true);
  const [hudForce, setHudForce] = useState(false);
  // su schermi bassi parte ridotto, così il bersaglio resta libero; se lo si apre, resta aperto
  const hudShown = hudOpen && (!tight || hudForce);
  const [dist, setDist] = useState<Dist>(() => randomDist(level.distances));
  // il bersaglio si muove da solo (se il livello lo prevede): ampiezza e velocità cambiano a ogni volée
  const newMotion = (k: number) => ({ amp: (18 + Math.random() * 18) * k, speed: (0.45 + Math.random() * 0.5) * Math.max(1, k), phase: Math.random() * 6 });
  const [motion, setMotion] = useState(() => newMotion(level.motion));
  const moving = level.motion > 0;
  const [animalId, setAnimalId] = useState(() => randomAnimal());
  const animal = ANIMALS.find((a) => a.id === animalId) ?? ANIMALS[0];
  const [, setMaskTick] = useState(0);
  useEffect(() => {
    if (modeId === "sagome") loadMask(animal.src, () => setMaskTick((n) => n + 1));
  }, [modeId, animal.src]);
  // record per bersaglio e livello; il vecchio record del giro vale per Bersaglio · Normale
  const [bests, setBests] = useLocalState<Record<string, number>>("aa-game-bests", {});
  const comboKey = `${modeId}-${levelId}`;
  const best = bests[comboKey] ?? 0;
  const setBest = (v: number) => setBests((cur) => ({ ...cur, [comboKey]: v }));
  useEffect(() => {
    try {
      const old = Number(localStorage.getItem("aa-game-best-giro") || 0);
      if (old > 0) setBests((cur) => ({ ...cur, "fita-normale": Math.max(cur["fita-normale"] ?? 0, old) }));
    } catch {
      /* niente */
    }
    // su un telefono nuovo i record arrivano dal server
    myGameRecords()
      .then((rows) => setBests((cur) => {
        const next = { ...cur };
        for (const r of rows) next[`${r.mode}-${r.level}`] = Math.max(next[`${r.mode}-${r.level}`] ?? 0, r.best);
        return next;
      }))
      .catch(() => undefined);
  }, []);
  const [saved, setSaved] = useState<{ record: boolean } | null>(null);
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
  const [rawWind, setWind] = useState(() => randomWind(level.wind));
  const wind = indoor ? 0 : rawWind;
  const [playing, setPlaying] = useState(false);
  const lastTouch = useRef(0);
  const landed = useRef(0);
  const hitsRef = useRef<Hit[]>([]);
  const stationsRef = useRef<number[]>([]);
  // dettaglio del giro: dieci (o il massimo della zona), centri e frecce fuori
  const countRef = useRef({ tens: 0, xs: 0, misses: 0 });
  const R = radiusOf(dist);
  const perStation = mode.perArrow * 3;
  const box = modeId === "sagome" ? sagomaBox(animal, R) : null;
  // il punto da mirare (rispetto al centro del cavalletto) e la sua "grandezza"
  const goalOff = box ? { x: box.left + animal.blue.cx * box.w, y: box.top + animal.blue.cy * box.h } : { x: 0, y: 0 };
  const Rg = box ? Math.max(animal.blue.rx * box.w, animal.blue.ry * box.h) : R;
  const scoreAt = (dx: number, dy: number): { score: number; x10: boolean } => {
    if (box) {
      const u = (dx - box.left) / box.w;
      const v = (dy - box.top) / box.h;
      const inside = (z: { cx: number; cy: number; rx: number; ry: number }) => ((u - z.cx) / z.rx) ** 2 + ((v - z.cy) / z.ry) ** 2 <= 1;
      if (inside(animal.blue)) return { score: 8, x10: inside(animal.red) };
      if (u < 0 || u > 1 || v < 0 || v > 1) return { score: 0, x10: false };
      const m = maskOf(animal.src);
      const body = m ? m.data[(Math.min(m.h - 1, Math.floor(v * m.h)) * m.w + Math.min(m.w - 1, Math.floor(u * m.w))) * 4 + 3] > 60 : ((u - 0.5) / 0.4) ** 2 + ((v - 0.55) / 0.35) ** 2 <= 1;
      return { score: body ? 5 : 0, x10: false };
    }
    const r = Math.hypot(dx, dy) / R;
    if (modeId === "field") return { score: r <= 1 ? Math.max(1, 6 - Math.floor(r * 6)) : 0, x10: r <= 1 / 12 };
    return { score: r <= 1 ? Math.max(1, 10 - Math.floor(r * 10)) : 0, x10: r <= 0.05 };
  };
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
        const r = JSON.parse(raw) as { station?: number; stations?: number[]; hits?: Hit[]; dist?: Dist; wind?: number; at?: number; combo?: string; count?: { tens: number; xs: number; misses: number }; animal?: string };
        const fresh = typeof r.at === "number" && Date.now() - r.at < 7 * 86_400_000;
        const sameCombo = (r.combo ?? "fita-normale") === `${localStorage.getItem("aa-game-mode")?.replace(/"/g, "") || "fita"}-${localStorage.getItem("aa-game-level")?.replace(/"/g, "") || "normale"}`;
        if (r.count) countRef.current = { tens: Number(r.count.tens) || 0, xs: Number(r.count.xs) || 0, misses: Number(r.count.misses) || 0 };
        if (r.animal && ANIMALS.some((a) => a.id === r.animal)) setAnimalId(r.animal);
        if (fresh && sameCombo && Array.isArray(r.stations) && r.stations.length < STATIONS && (r.stations.length > 0 || (r.hits?.length ?? 0) > 0)) {
          stationsRef.current = r.stations.map(Number).filter((v) => Number.isFinite(v));
          setStations(stationsRef.current);
          setStation(Math.min(STATIONS, stationsRef.current.length + 1));
          const hs = Array.isArray(r.hits) ? r.hits.filter((h) => h && typeof h.score === "number").slice(0, 2) : [];
          hitsRef.current = hs;
          setHits(hs);
          if (typeof r.dist === "number" && r.dist >= 10 && r.dist <= 90) setDist(r.dist);
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
      else localStorage.setItem(ROUND_KEY, JSON.stringify({ station, stations, hits: hits.length >= 3 ? [] : hits, dist, wind: rawWind, at: Date.now(), combo: comboKey, count: countRef.current, animal: animalId }));
    } catch {
      /* memoria non disponibile */
    }
  }, [playing, station, stations, hits, dist, rawWind, comboKey, animalId]);
  // il record si aggiorna subito, anche a giro non finito
  useEffect(() => {
    if (playing && total > best) setBest(total);
  }, [playing, total, best, comboKey]);

  // posizione del bersaglio: fermo, o su un carrello che va avanti e indietro
  const amp = motion.amp;
  const speed = motion.speed + (dist - 18) / 160;
  const targetAt = (time: number) => ({ x: BASE.x + (moving ? Math.sin(time * speed + motion.phase) * amp : 0), y: BASE.y });
  const goalAt = (time: number) => {
    const p = targetAt(time);
    return { x: p.x + goalOff.x, y: p.y + goalOff.y };
  };
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
  const swayA = ((draw?.demo ? 0.6 : 0.8) + Math.max(0, hold - 3) * 2.2 + (sky.weather === "pioggia" ? 0.5 : 0)) * level.sway;
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
    const { score, x10 } = scoreAt(dx, dy);
    const from = { x: GRIP.x + 6, y: GRIP.y - (BASE.y - d.aim.y) * 0.25 };
    setFlight({ from, to: { x, y }, hit: { dx, dy, score, x10 }, t0: at, dur, arc: 6 + dist * 0.35, demo: d.demo });
  };

  // dimostrazione: se nessuno tocca da qualche secondo, l'arciere tira da solo
  useEffect(() => {
    if (playing || draw || flight) return;
    if (released != null && t - released < 1.4) return;
    if (t - lastTouch.current < 2.5) return;
    const start = now();
    const land = goalAt(start + 1.6 + 0.36 + dist / 170);
    let ax: number;
    let ay: number;
    if (form && form.n >= 6) {
      // tira come te: stesso spostamento medio e stessa larghezza del gruppo delle tue ultime frecce
      const g = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
      const sx = lefty ? -form.offX : form.offX;
      const out = Math.random() < form.missRate ? 1.25 : 0;
      const ang = Math.random() * Math.PI * 2;
      ax = land.x - wind * (dist / 18) * 1.1 + sx * Rg + g() * form.spread * Rg * 0.72 + Math.cos(ang) * out * Rg;
      ay = land.y + form.offY * Rg + g() * form.spread * Rg * 0.72 + Math.sin(ang) * out * Rg;
    } else {
      const err = Rg * 0.32;
      ax = land.x - wind * (dist / 18) * 1.1 + (Math.random() - 0.5) * err * 2;
      ay = land.y + (Math.random() - 0.5) * err * 2;
    }
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
    if (h.score === 0) countRef.current.misses += 1;
    else if (h.score === mode.perArrow) countRef.current.tens += 1;
    if (h.x10) countRef.current.xs += 1;
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
    const k = round / maxRound(modeId);
    // punti esperienza: al massimo tre giri al giorno
    const day = today();
    for (let i = 1; i <= 3; i++) {
      const once = `giro-${day}-${i}`;
      if (readXp().log.some((l) => l.why === once)) continue;
      award(k >= 0.9 ? 8 : k >= 0.75 ? 6 : k >= 0.58 ? 4 : 2, "Giro di 20 piazzole", once);
      break;
    }
    // il record va sul server, con il dettaglio: si vede nel profilo dell'arciere
    setSaved(null);
    saveGameRound({ data: { mode: modeId, level: levelId, stations: all, ...countRef.current } })
      .then((r) => setSaved({ record: r.record }))
      .catch(() => undefined);
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
    const G = { x: T.x + goalOff.x, y: T.y + goalOff.y };
    const ax = G.x + (Math.random() - 0.5) * Rg * 1.6;
    const ay = G.y + (Math.random() - 0.5) * Rg * 1.6;
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
    setDraw({ ...draw, aim: { x: clamp(draw.ax + (w.x - draw.sx) * k, BASE.x - 120, BASE.x + 60), y: clamp(draw.ay + (w.y - draw.sy) * k, BASE.y - 100, BASE.y + 80) } });
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
    setWind(randomWind(level.wind));
    setDist((d) => randomDist(level.distances, d));
    setMotion(newMotion(level.motion));
    setAnimalId((a) => randomAnimal(a));
  };
  const nextStation = () => {
    if (stationsRef.current.length >= STATIONS) return;
    nextScene();
    setStation(stationsRef.current.length + 1);
    freshStation();
  };
  const again = () => {
    nextScene();
    countRef.current = { tens: 0, xs: 0, misses: 0 };
    setSaved(null);
    stationsRef.current = [];
    setStations([]);
    setStation(1);
    freshStation();
  };
  // altro bersaglio o livello: si ricomincia il giro con le regole nuove
  const choose = (m: GameMode, l: GameLevel) => {
    const L = levelOf(l);
    setModeId(m);
    setLevelId(l);
    setPicker(false);
    countRef.current = { tens: 0, xs: 0, misses: 0 };
    stationsRef.current = [];
    setStations([]);
    setStation(1);
    hitsRef.current = [];
    setHits([]);
    setDemoHits([]);
    setPop(null);
    setSaved(null);
    setDraw(null);
    setFlight(null);
    setDist(randomDist(L.distances));
    setWind(randomWind(L.wind));
    setMotion(newMotion(L.motion));
    setAnimalId((a) => randomAnimal(a));
  };
  // quando il livello arriva dalla memoria del telefono, distanza e vento si adeguano senza perdere il giro
  useEffect(() => {
    if (!level.distances.includes(dist)) setDist(randomDist(level.distances));
    setWind((w) => clamp(w, -level.wind, level.wind));
    setMotion((m) => (level.motion > 0 && m.amp === 0 ? newMotion(level.motion) : m));
  }, [levelId]);
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

  const game = (
    <div
      ref={stage}
      className={`aa-game aspect-[3/4] w-full ${bleed ? "aa-game-bleed" : ""} ${apron ? "aa-game-joined" : ""} ${className}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="application"
      aria-label="Gioco: tieni premuto per tendere, trascina per mirare, lascia per tirare"
    >
      {/* mancino: campo, bersaglio e arciere si specchiano; i testi restano dritti */}
      <div className={`pointer-events-none absolute inset-0 ${lefty ? "aa-mirror" : ""} ${bleed ? "aa-game-fade" : ""}`} style={crop ? { WebkitMaskImage: `linear-gradient(180deg, transparent ${crop}px, rgba(0,0,0,0.55) calc(${crop}px + 5%), #000 calc(${crop}px + 13%), #000 100%)`, maskImage: `linear-gradient(180deg, transparent ${crop}px, rgba(0,0,0,0.55) calc(${crop}px + 5%), #000 calc(${crop}px + 13%), #000 100%)` } : undefined}>
      <div key={scene} className={`aa-scene-swap absolute inset-0 z-0 ${apron ? "aa-backdrop-joined" : ""}`}>
        <SceneBackdrop sky={sky} id="game" scene={scene} wind={wind} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 z-[1] h-full w-full" aria-hidden>
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
          <ellipse cx={BASE.x + 3} cy={302} rx={box ? box.w * 0.45 : R * 1.6} ry="4" fill="#000" opacity="0.3" />
          <circle cx={BASE.x + goalOff.x} cy={BASE.y + goalOff.y} r={R * 1.9} fill="url(#gm-glow)" className="aa-target-glow" />
          {box ? null : <path d={`M${BASE.x - R * 0.8} ${BASE.y + R * 0.8} L${BASE.x - R * 1.05} 302 M${BASE.x + R * 0.8} ${BASE.y + R * 0.8} L${BASE.x + R * 1.05} 302 M${BASE.x} ${BASE.y + R} L${BASE.x + R * 0.3} 300`} stroke="#5b3d22" strokeWidth={Math.max(2, R * 0.09)} strokeLinecap="round" />}
          {moving ? [-1, 1].map((s) => <circle key={s} cx={BASE.x + s * R * 0.9} cy="302" r="3" fill="#2a2f35" stroke="#9aa0a6" strokeWidth="0.8" />) : null}
          {box ? (
            // sagoma: l'animale in piedi sul prato, senza paglione
            <g>
              <image href={animal.src} x={BASE.x + box.left} y={BASE.y + box.top} width={box.w} height={box.h} preserveAspectRatio="none" />
            </g>
          ) : (
            <>
              <rect x={BASE.x - R * 1.18 + 2} y={BASE.y - R * 1.18 + 3} width={R * 2.36} height={R * 2.36} rx={R * 0.25} fill="#5b3d22" opacity="0.6" />
              <rect x={BASE.x - R * 1.18} y={BASE.y - R * 1.18} width={R * 2.36} height={R * 2.36} rx={R * 0.25} fill="url(#gm-straw)" stroke="#7d5a2a" strokeWidth="1" />
              {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${BASE.x - R * 1.15} ${BASE.y - R + i * R * 0.34} h${R * 2.3}`} stroke="#8e6a33" strokeOpacity="0.35" strokeWidth="0.7" />)}
              {modeId === "field"
                ? FIELD.map((c, i) => <circle key={i} cx={BASE.x} cy={BASE.y} r={R * (1 - i / 6)} fill={c} stroke={c === "#e6b325" ? "#1a1c1e" : "#f4f1ea"} strokeWidth={0.5} strokeOpacity="0.8" />)
                : RINGS.map((c, i) => <circle key={i} cx={BASE.x} cy={BASE.y} r={R * (1 - i / 10)} fill={c} stroke={i < 2 ? "#1a1c1e" : i < 4 ? "#f4f1ea" : "#1a1c1e"} strokeWidth={0.35} strokeOpacity="0.6" />)}
              {modeId === "field" ? <circle cx={BASE.x} cy={BASE.y} r={R / 12} fill="none" stroke="#1a1c1e" strokeWidth="0.4" /> : null}
              <path d={`M${BASE.x - 1.5} ${BASE.y} h3 M${BASE.x} ${BASE.y - 1.5} v3`} stroke="#1a1c1e" strokeWidth="0.4" />
            </>
          )}
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
            {fire ? (
              // privilegio "Freccia infuocata": scia di fuoco
              <g>
                <path d="M-64 0 L-8 0" stroke="#ff6a1a" strokeOpacity="0.35" strokeWidth="7" strokeLinecap="round" />
                <path d="M-52 0 L-8 0" stroke="#ffb02e" strokeOpacity="0.7" strokeWidth="3.6" strokeLinecap="round" />
                <path d="M-36 0 L-8 0" stroke="#fff3b0" strokeOpacity="0.9" strokeWidth="1.6" strokeLinecap="round" />
                {[0, 1, 2, 3].map((i) => <circle key={i} cx={-20 - i * 11 - ((t * 60) % 11)} cy={Math.sin(t * 30 + i * 2) * 2.2} r={1.6 - i * 0.3} fill="#ffcf5a" opacity={0.8 - i * 0.18} />)}
              </g>
            ) : (
              <path d="M-46 0 L-8 0" stroke="#fff" strokeOpacity="0.22" strokeWidth="3.4" strokeLinecap="round" />
            )}
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

      {/* arciere, grande in primo piano: sempre sopra lo sfondo sfumato (su alcuni WebView Android
          lo sfondo con la maschera veniva composto sopra e dell'arciere restavano solo gli stivali) */}
      <div className="aa-game-archer pointer-events-none absolute z-[2]" style={{ left: `${(AV.left / W) * 100}%`, top: `${(AV_TOP / H) * 100}%`, width: `${(AV.width / W) * 100}%`, height: `${(AV_H / H) * 100}%` }}>
        {perks.includes("aura") ? <span aria-hidden className="aa-perk-aura absolute inset-[-6%_8%_2%_4%] rounded-full" /> : null}
        {perks.includes("stendardo") ? (
          // privilegio "Stendardo della compagnia": la bandiera sventola dietro l'arciere
          <svg aria-hidden viewBox="0 0 40 90" className="absolute left-[2%] top-[6%] h-[46%] w-auto">
            <path d="M5 2 V88" stroke="#5a4632" strokeWidth="2.2" />
            <circle cx="5" cy="2.5" r="2.2" fill="#d9b45a" />
            <path className="aa-perk-flag" d="M6 6 H34 Q30 16 34 26 Q30 36 34 44 H6 Z" fill={banner || "#1f7a46"} />
            <path d="M6 6 H34 Q30 16 34 26 Q30 36 34 44 H6 Z" fill="none" stroke="#d9b45a" strokeWidth="1" />
            <path d="M14 18 h12 v8 q0 6 -6 9 q-6 -3 -6 -9 Z" fill="#f3ecda" opacity="0.9" />
          </svg>
        ) : null}
        {/* luce dell'ambiente: tinta dell'ora e bordo illuminato dal lato del sole */}
        {indoor ? null : <ArcherLightDefs />}
        <ArcherAvatar look={bodyLook} drive={drive} pose="riposo" interactive={false} hideFlight wind={indoor ? 0 : wind} light={indoor ? undefined : `aa-lit-${lightMode(sky)}-${isPainted(scene) !== Boolean(look.lefty) || sky.tod === "mattina" ? "l" : "r"}`} className="aa-archer-feet h-full w-full drop-shadow-[0_10px_14px_rgba(0,0,0,0.4)]" />
        {/* ombra di contatto morbida sotto i piedi */}
        <span aria-hidden className="aa-archer-contact pointer-events-none absolute bottom-[1.5%] left-[18%] h-[5%] w-[52%] rounded-[50%]" />
      </div>
      </div>

      {pop ? (
        <span key={pop.id} className="aa-game-pop aa-game-score pointer-events-none absolute text-3xl font-black text-[#ffe08a]" style={pct(pop.x, pop.y)}>
          {pop.text}
        </span>
      ) : null}

      {/* HUD: a sinistra il blocco di oggi; a destra il record e un solo pannello del campo
          (bersaglio, piazzola, vento, distanza), in vetro scuro, riducibile a un bottone */}
      {/* sfumatura: l'intestazione scende morbida nel cielo, senza uno stacco netto */}
      <div aria-hidden className="aa-game-topfade pointer-events-none absolute inset-x-0 z-[3] h-[26%]" style={{ top: crop }} />
      <div className={`aa-game-hud pointer-events-none absolute inset-x-0 top-0 z-[4] flex items-start justify-between gap-2 p-3 ${tight ? "aa-hud-tight" : ""}`} style={crop ? { top: crop } : undefined}>
        <div className="min-w-0 text-white">{info}</div>
        <div className="grid w-[8.4rem] shrink-0 justify-items-stretch gap-1.5 text-white">
          {/* record (o punti della partita in corso): coppa d'oro, numero grande, etichetta sotto */}
          <div className="aa-hud aa-hud-record grid grid-cols-[auto_1fr] items-center gap-x-2 rounded-2xl px-2.5 pb-2 pt-1.5">
            <Glyph name="trophy" detailed size={26} className="aa-trophy row-span-2 shrink-0" />
            <b className="aa-game-score text-center text-[2rem] leading-none tabular-nums">{playing ? total : bestHere}</b>
            <span className="text-center text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-white/75">{playing ? `punti · record ${bestHere}` : "record"}</span>
          </div>
          {hudShown ? (
            <div data-ui className="aa-hud aa-hud-panel pointer-events-auto relative grid rounded-2xl py-1" onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => { setHudOpen(false); setHudForce(false); }} aria-label="Riduci il pannello del campo" className="absolute right-1 top-1 z-[1] grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white/80">
                <Glyph name="chevron" size={12} className="-rotate-90" />
              </button>
              <HudRow icon="target" label="Bersaglio" onClick={() => setPicker((v) => !v)} expanded={picker}>{mode.label}<span className="ml-1 font-semibold text-white/70">· {level.label} ▾</span></HudRow>
              <HudRow icon="pin" label="Piazzola">
                <span className="tabular-nums">{station} / {STATIONS}</span>
                <span className="ml-1.5 inline-flex gap-0.5" aria-label={`${3 - hits.length} frecce rimaste`}>{[0, 1, 2].map((i) => <span key={i} className={`inline-block h-2.5 w-1 rounded-full ${i < hits.length ? "bg-white/25" : "aa-hud-pip"}`} />)}</span>
              </HudRow>
              <HudRow icon="wind" label="Vento">{indoor ? "al chiuso" : <>{Math.abs(wind).toFixed(1).replace(".", ",")} m/s {wind === 0 ? "" : (wind > 0) !== lefty ? "→" : "←"}</>}</HudRow>
              <HudRow icon="arrow" label="Distanza" last>{dist} m{box ? ` · ${animal.label}` : ""}</HudRow>
            </div>
          ) : (
            <button data-ui type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => { setHudOpen(true); setHudForce(true); }} aria-label="Apri il pannello del campo" className="aa-hud pointer-events-auto flex items-center justify-between gap-1.5 rounded-full px-2.5 py-1.5 text-[0.7rem] font-semibold">
              <span className="flex items-center gap-1"><Glyph name="wind" size={14} className="aa-hud-ico" />{indoor ? "—" : `${Math.abs(wind).toFixed(1).replace(".", ",")}`}</span>
              <span className="tabular-nums">{dist} m</span>
              <Glyph name="chevron" size={12} className="rotate-90 text-white/70" />
            </button>
          )}
        </div>
      </div>
      {children}
      {picker ? (
        <div data-ui className="aa-rise absolute inset-x-3 top-[18%] z-10 grid gap-3 rounded-3xl bg-[#101814]/90 p-3 text-white backdrop-blur-md" style={crop ? { top: `calc(18% + ${crop}px)` } : undefined} onPointerDown={(e) => e.stopPropagation()}>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-white/70">Bersaglio</p>
          <div className="grid grid-cols-3 gap-1.5">
            {GAME_MODES.map((m) => (
              <button key={m.id} type="button" aria-pressed={m.id === modeId} onClick={() => choose(m.id, levelId)} className={`grid gap-0.5 rounded-2xl p-2 text-left ${m.id === modeId ? "bg-[#ffd27a] text-[#2a1d0c]" : "bg-white/10"}`}>
                <b className="text-sm">{m.label}</b>
                <span className="text-[0.62rem] leading-tight opacity-80">{m.hint}</span>
              </button>
            ))}
          </div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-white/70">Livello</p>
          <div className="grid grid-cols-3 gap-1.5">
            {GAME_LEVELS.map((l) => (
              <button key={l.id} type="button" aria-pressed={l.id === levelId} onClick={() => choose(modeId, l.id)} className={`grid gap-0.5 rounded-2xl p-2 text-left ${l.id === levelId ? "bg-[#7cf0a8] text-[#0b2015]" : "bg-white/10"}`}>
                <b className="text-sm">{l.label}</b>
                <span className="text-[0.62rem] leading-tight opacity-80">{l.hint}</span>
                <span className="text-[0.62rem] font-bold">record {bests[`${modeId}-${l.id}`] ?? 0}</span>
              </button>
            ))}
          </div>
          <p className="text-[0.66rem] text-white/60">Cambiare bersaglio o livello fa ripartire il giro. Ogni combinazione ha il suo record, visibile nel tuo profilo.</p>
          <button type="button" onClick={() => setPicker(false)} className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold">Chiudi</button>
        </div>
      ) : null}

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
          <p className="aa-game-score text-4xl font-black">{piazzola}<span className="text-lg text-white/60">/{perStation}</span></p>
          <p className="text-xs text-white/80">{hits.map((h) => (h.score === 0 ? "M" : h.x10 ? "X" : h.score)).join(" · ")} · totale {total}</p>
          <p className="mt-1 text-[0.66rem] text-white/60">Si va alla prossima piazzola…</p>
        </div>
      ) : null}
      {done ? (
        <div data-ui className="absolute inset-x-4 top-[20%] rounded-3xl bg-[#101814]/85 p-4 text-center text-white backdrop-blur-md" style={crop ? { top: `calc(20% + ${crop}px)` } : undefined} onPointerDown={(e) => e.stopPropagation()}>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/70">Giro finito · {mode.label} · {level.label}</p>
          <p className="aa-game-score mt-1 text-5xl font-black">{total}<span className="text-xl text-white/60">/{maxRound(modeId)}</span></p>
          <p className="mt-1 text-sm text-white/85">media {(total / (STATIONS * 3)).toFixed(2).replace(".", ",")} a freccia{total >= bestHere && total > 0 ? " · nuovo record" : ""}</p>
          <p className="mt-0.5 text-xs text-white/70">{countRef.current.tens} da {mode.perArrow} · {countRef.current.xs} {modeId === "sagome" ? "nel cuore" : "X"} · {countRef.current.misses} fuori{saved ? " · salvato nel profilo" : ""}</p>
          <div className="mx-auto mt-3 grid max-w-[16rem] grid-cols-10 gap-1">
            {stations.map((v, i) => <span key={i} className="grid h-6 place-items-center rounded-md text-[0.62rem] font-bold" style={{ background: v >= perStation * 0.9 ? "#ffd27a" : v >= perStation * 0.7 ? "#ff7a6e" : v >= perStation * 0.5 ? "#5aa6ff" : "rgba(255,255,255,0.15)", color: v >= perStation * 0.9 ? "#2a1d0c" : "#fff" }}>{v}</span>)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={again} className="rounded-full bg-[#ffd27a] px-4 py-2.5 text-sm font-bold text-[#2a1d0c]">Nuovo giro</button>
            <button type="button" onClick={stop} className="rounded-full bg-white/15 px-4 py-2.5 text-sm font-bold">Guarda tirare</button>
          </div>
        </div>
      ) : null}
    </div>
  );
  if (!apron) return game;
  return (
    <div className="aa-game-stack">
      <div ref={wrap} className="relative z-[1] overflow-hidden" style={crop ? { marginTop: 0 } : undefined}>
        <div style={crop ? { marginTop: -crop } : undefined}>{game}</div>
      </div>
      <GameApron sky={sky} scene={scene} lefty={lefty}>{apron}</GameApron>
    </div>
  );
}

/** Una riga del pannello del campo: icona, etichetta piccola, valore. */
function HudRow({ icon, label, children, onClick, expanded, last = false }: { icon: IconName; label: string; children: ReactNode; onClick?: () => void; expanded?: boolean; last?: boolean }) {
  const body = (
    <>
      <Glyph name={icon} size={16} className="aa-hud-ico mt-0.5 shrink-0" />
      <span className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/60">{label}</span>
        <span className="flex flex-wrap items-center text-[0.74rem] font-bold">{children}</span>
      </span>
    </>
  );
  const cls = `flex items-start gap-2 px-2.5 py-1.5 ${last ? "" : "border-b border-white/[0.08]"}`;
  return onClick ? (
    <button type="button" onClick={onClick} aria-expanded={expanded} className={`${cls} pr-7 active:bg-white/5`}>{body}<span className="sr-only">cambia</span></button>
  ) : (
    <div className={`${cls} pr-2.5`}>{body}</div>
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
