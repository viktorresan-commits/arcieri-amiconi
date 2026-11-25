import { SceneLife } from "./scene-life";
import { FOUNDER_LAYERS } from "./scene-founder";
import { memo, type ReactNode } from "react";
import type { Sky } from "@/lib/arcieri/sky3d";
import { sceneById, type SceneId } from "@/lib/arcieri/scenes";

/**
 * Sfondi illustrati (stile gioco) per la Home, il profilo e le lezioni: cielo dell'ora scelta con sole
 * o luna, raggi, nuvole che scorrono, stelle, pioggia o neve; poi l'ambientazione (campo, foresta,
 * castello, palazzo reale, montagna, lago, deserto, villaggio, bosco innevato, colline, torneo, rovine,
 * spiaggia, bosco d'autunno). Coordinate 400×300, orizzonte intorno a y = 216.
 */
export const SKY: Record<Sky["tod"], { top: string; mid: string; low: string; sun: string; shade: string; shadeA: number }> = {
  mattina: { top: "#5b8fd6", mid: "#a9cdea", low: "#ffe2b8", sun: "#fff1c9", shade: "#ffd9a0", shadeA: 0.06 },
  pomeriggio: { top: "#2f6db8", mid: "#7fb2e0", low: "#d8ecf6", sun: "#fffbe8", shade: "#ffffff", shadeA: 0 },
  // sera: cielo grigio che schiarisce verso l'orizzonte, senza rosa
  tramonto: { top: "#3b4149", mid: "#858c96", low: "#cfcac1", sun: "#ffe0b0", shade: "#a4a9b0", shadeA: 0.12 },
  notte: { top: "#050a1a", mid: "#0f1e3d", low: "#22355c", sun: "#e8eeff", shade: "#0a1430", shadeA: 0.5 },
};

const shadeHex = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return `#${c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
};

export const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* ---------------- ambientazioni dipinte ----------------
   Alcune scene hanno un'illustrazione vera (giorno e notte, più le varianti che ci sono).
   Sopra, in un solo SVG con le stesse coordinate dell'immagine, solo movimenti leggeri:
   foschia che scorre, uccelli, lucciole e torce di notte, pioggia e neve. */
type Painted = { w: number; h: number; /** quota (su 300) del bordo alto dell'illustrazione */ top?: number; day: string; night: string; dusk?: string; dawn?: string; rain?: string; torches?: [number, number][]; sky: number; grass: [number, number] };
const PAINTED: Partial<Record<SceneId, Painted>> = {
  campo: { w: 843, h: 1264, top: 22, day: "/scene/campo-giorno.webp", night: "/scene/campo-notte.webp", dusk: "/scene/campo-tramonto.webp", dawn: "/scene/campo-alba.webp", rain: "/scene/campo-pioggia.webp", torches: [[258, 522], [748, 520], [97, 518]], sky: 430, grass: [680, 1220] },
};

/** la scena ha un'illustrazione dipinta? (la luce di quelle viene da sinistra) */
export const isPainted = (id: string | undefined) => Boolean(PAINTED[sceneById(id).id]);

function PaintedBackdrop({ sky, id, art, wind = 0 }: { sky: Sky; id: string; art: Painted; wind?: number }) {
  const night = sky.tod === "notte";
  const rain = sky.weather === "pioggia";
  const cloudy = sky.weather !== "sereno";
  const dusk = sky.tod === "tramonto";
  const dawn = sky.tod === "mattina";
  // con il cielo coperto (pioggia o nuvoloso) c'è la sua illustrazione; di notte vince sempre la notte
  const grey = cloudy && Boolean(art.rain) && !night;
  const src = night ? art.night : grey ? art.rain! : dusk && art.dusk ? art.dusk : dawn && art.dawn ? art.dawn : art.day;
  const { w, h } = art;
  const drift = wind < 0 ? -1 : 1;
  // la scena è 400×300 ma sul gioco (3:4) se ne vede la fascia centrale 87.5–312.5:
  // l'illustrazione copre esattamente quella fascia, poggiata in basso; ai lati, se lo schermo
  // è più largo, la stessa immagine sfocata fa da cornice
  const vw = 225;
  const k = vw / w;
  const vh = h * k;
  const tx = 87.5;
  // abbassata quanto basta perché il castello stia fra i due pannelli in alto: sotto si perde solo prato
  const ty = Math.max(300 - vh, art.top ?? 0);
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <filter id={`${id}wide`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9" /></filter>
      </defs>
      <image href={src} x="-10" y={300 - 420 * 1.5} width="420" height={420 * 1.5} preserveAspectRatio="xMidYMax slice" filter={`url(#${id}wide)`} opacity="0.9" />
      <g transform={`translate(${tx} ${ty}) scale(${k})`}>
      <defs>
        <filter id={`${id}soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18" /></filter>
        <radialGradient id={`${id}glow`}><stop offset="0" stopColor="#ffd27a" stopOpacity="0.85" /><stop offset="0.35" stopColor="#ff9a3a" stopOpacity="0.35" /><stop offset="1" stopColor="#ff9a3a" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}fly`}><stop offset="0" stopColor="#fff6b0" /><stop offset="0.4" stopColor="#e8f27a" stopOpacity="0.7" /><stop offset="1" stopColor="#e8f27a" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}vig`} x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.28" /></linearGradient>
      </defs>
      <image href={src} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
      {/* luce dell'ora sopra l'illustrazione di giorno: mattino più fresco, tramonto caldo se manca la sua */}
      {!night && dawn && !art.dawn ? <rect width={w} height={h} fill="#ffe2b8" opacity="0.12" style={{ mixBlendMode: "soft-light" }} /> : null}
      {dusk && !art.dusk && !grey ? <rect width={w} height={h} fill="#ff8a3a" opacity="0.35" style={{ mixBlendMode: "soft-light" }} /> : null}
      {dusk && !art.dusk && !grey ? <rect width={w} height={h * 0.5} fill="#6a3a6a" opacity="0.12" /> : null}
      {cloudy && !grey && !night ? <rect width={w} height={h} fill="#4a5664" opacity={rain ? 0.32 : 0.14} style={{ mixBlendMode: "multiply" }} /> : null}
      {grey && dusk ? <rect width={w} height={h} fill="#ff9a5a" opacity="0.16" style={{ mixBlendMode: "soft-light" }} /> : null}
      {grey && !rain ? <rect width={w} height={h} fill="#ffffff" opacity="0.06" /> : null}
      {/* foschia che scorre nel cielo, nel verso del vento */}
      {!night ? (
        <g className="aa-paint-mist" style={{ ["--drift" as string]: `${drift * 120}px` }} filter={`url(#${id}soft)`} fill="#fff" opacity={rain ? 0.22 : 0.16}>
          <ellipse cx={w * 0.25} cy={art.sky * 0.42} rx={w * 0.22} ry="34" />
          <ellipse cx={w * 0.72} cy={art.sky * 0.3} rx={w * 0.18} ry="26" />
          <ellipse cx={w * 0.55} cy={art.sky * 0.78} rx={w * 0.3} ry="30" />
        </g>
      ) : null}
      {/* uccelli lontani di giorno */}
      {!night && !rain ? (
        <g className="aa-paint-birds" fill="none" stroke="#2a2a2a" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round">
          {[[0, 0], [26, 12], [52, -6]].map(([dx, dy], i) => <path key={i} className="aa-wing" style={{ animationDelay: `${i * 0.15}s` }} d={`M${w * 0.18 + dx} ${art.sky * 0.55 + dy} q7 -7 14 0 q7 -7 14 0`} />)}
        </g>
      ) : null}
      {/* di notte: torce che tremolano e lucciole sull'erba */}
      {night ? (
        <g>
          {(art.torches ?? []).map(([x, y], i) => <circle key={i} className="aa-torch" style={{ animationDelay: `${i * 0.37}s` }} cx={x} cy={y} r="46" fill={`url(#${id}glow)`} />)}
          {Array.from({ length: 16 }, (_, i) => {
            const x = 40 + rnd(i * 3 + 1) * (w - 80);
            const y = art.grass[0] + rnd(i * 7 + 2) * (art.grass[1] - art.grass[0]);
            return <circle key={i} className="aa-firefly-p" style={{ animationDelay: `${(i % 8) * 0.6}s`, animationDuration: `${4 + (i % 5)}s` }} cx={x} cy={y} r={6 + (i % 3) * 2} fill={`url(#${id}fly)`} />;
          })}
        </g>
      ) : null}
      {rain ? (
        <g className="aa-rain" stroke="#dce8f2" strokeOpacity="0.45" strokeWidth="2">
          {Array.from({ length: 110 }, (_, i) => <path key={i} d={`M${(i * 79.3) % (w + 40)} ${(i * 53.9) % h} l-7 26`} />)}
        </g>
      ) : null}
      <rect width={w} height={h} fill={`url(#${id}vig)`} />
      </g>
    </svg>
  );
}

export const SceneBackdrop = memo(function SceneBackdrop({ sky, id = "bk", scene = "campo", wind }: { sky: Sky; id?: string; scene?: string; /** vento in m/s: positivo verso destra. Le nuvole vanno dove tira */ wind?: number }) {
  const p = SKY[sky.tod];
  const sc = sceneById(scene);
  const art = PAINTED[sc.id];
  if (art) return <PaintedBackdrop sky={sky} id={id} art={art} wind={wind} />;
  const rain = sky.weather === "pioggia";
  const cloudy = sky.weather !== "sereno";
  const night = sky.tod === "notte";
  const snow = sc.id === "neve";
  const sunX = sky.tod === "mattina" ? 70 : sky.tod === "tramonto" ? 330 : 300;
  const sunY = sky.tod === "pomeriggio" ? 46 : sky.tod === "tramonto" ? 150 : sky.tod === "mattina" ? 110 : 60;
  const desert = sc.id === "deserto" || sc.id === "spiaggia";
  const indoor = Boolean(sc.indoor);
  // Sala del Trono, Picco del Drago e Cittadella Celeste hanno cielo e luce loro: niente sole, nuvole, velo dell'ora né meteo
  const own = Boolean(sc.ownSky);
  return (
    <>
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.top} />
          <stop offset="0.55" stopColor={desert && !night ? (sky.tod === "tramonto" ? "#b9b3a8" : "#a8d0ea") : p.mid} />
          <stop offset="0.78" stopColor={desert && !night && sky.tod !== "tramonto" ? "#f6e6c4" : p.low} />
        </linearGradient>
        <radialGradient id={`${id}sun`} cx={sunX / 400} cy={sunY / 300} r="0.45">
          <stop offset="0" stopColor={p.sun} stopOpacity={night ? 0.5 : 0.95} />
          <stop offset="0.2" stopColor={p.sun} stopOpacity={night ? 0.15 : 0.45} />
          <stop offset="1" stopColor={p.sun} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}disc`} cx="0.42" cy="0.38" r="0.62">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor={p.sun} />
          <stop offset="1" stopColor={sky.tod === "tramonto" ? "#ffc78a" : "#ffe08a"} />
        </radialGradient>
        <radialGradient id={`${id}moon`} cx="0.38" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#b9c3dc" />
        </radialGradient>
        <linearGradient id={`${id}mist`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor={night ? "#9fb4d8" : "#fff"} stopOpacity={night ? 0.08 : 0.22} />
        </linearGradient>
        <linearGradient id={`${id}blade`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={night ? "#0d1a14" : "#24401f"} />
          <stop offset="0.55" stopColor={night ? "#1d3a2a" : "#4f7f36"} />
          <stop offset="1" stopColor={night ? "#3a6a4e" : "#b5d67a"} />
        </linearGradient>
        <linearGradient id={`${id}ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sc.ground[0]} />
          <stop offset="1" stopColor={sc.ground[1]} />
        </linearGradient>
        <linearGradient id={`${id}water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? "#1a2a48" : "#6aa8d8"} />
          <stop offset="1" stopColor={night ? "#0e1a30" : "#2f6a9a"} />
        </linearGradient>
        <linearGradient id={`${id}stone`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a8f96" />
          <stop offset="0.6" stopColor="#b2b6bb" />
          <stop offset="1" stopColor="#7a7f86" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}sky)`} />
      {indoor || own ? null : <>
      {night ? (
        <g fill="#fff">
          {Array.from({ length: 70 }, (_, i) => (
            <circle key={i} cx={(i * 97.3) % 400} cy={(i * 41.7) % 150} r={i % 9 === 0 ? 1.1 : 0.6} opacity={0.4 + ((i * 13) % 7) / 12} className={i % 5 === 0 ? "aa-twinkle" : undefined} style={{ animationDelay: `${(i % 7) * 0.5}s` }} />
          ))}
        </g>
      ) : null}
      {!rain ? <rect width="400" height="300" fill={`url(#${id}sun)`} /> : null}
      {!rain ? (
        night ? (
          <g>
            <circle cx={sunX} cy={sunY} r="22" fill="#dfe6ff" opacity="0.08" />
            <circle cx={sunX} cy={sunY} r="13" fill={`url(#${id}moon)`} />
            <circle cx={sunX - 4} cy={sunY + 3} r="2.4" fill="#c9d0e6" opacity="0.55" />
            <circle cx={sunX + 3} cy={sunY - 4} r="1.6" fill="#c9d0e6" opacity="0.5" />
            <circle cx={sunX + 4} cy={sunY + 5} r="1.1" fill="#c9d0e6" opacity="0.45" />
          </g>
        ) : (
          <g opacity={cloudy ? 0.65 : 1}>
            {/* corona che gira piano e respira */}
            <g>
              {Array.from({ length: 16 }, (_, i) => {
                const a = (i / 16) * Math.PI * 2;
                const r1 = sky.tod === "tramonto" ? 24 : 19;
                const r2 = r1 + (i % 2 ? 9 : 16);
                return <path key={i} d={`M${(sunX + Math.cos(a - 0.07) * r1).toFixed(1)} ${(sunY + Math.sin(a - 0.07) * r1).toFixed(1)} L${(sunX + Math.cos(a) * r2).toFixed(1)} ${(sunY + Math.sin(a) * r2).toFixed(1)} L${(sunX + Math.cos(a + 0.07) * r1).toFixed(1)} ${(sunY + Math.sin(a + 0.07) * r1).toFixed(1)} Z`} fill={p.sun} opacity={i % 2 ? 0.35 : 0.22} />;
              })}
            </g>
            <circle cx={sunX} cy={sunY} r={sky.tod === "tramonto" ? 30 : 24} fill={p.sun} opacity="0.18" />
            <circle cx={sunX} cy={sunY} r={sky.tod === "tramonto" ? 20 : 15} fill={`url(#${id}disc)`} />
          </g>
        )
      ) : null}
      {!night && !rain ? (
        <g className="aa-ray" fill={p.sun}>
          {[-30, -12, 6, 24].map((a, i) => (
            <path key={a} d={`M${sunX} ${sunY} L${sunX + Math.cos(((90 + a) * Math.PI) / 180) * 420 - 26} ${sunY + 420} L${sunX + Math.cos(((90 + a) * Math.PI) / 180) * 420 + 26} ${sunY + 420} Z`} opacity={0.06 + (i % 2) * 0.03} />
          ))}
        </g>
      ) : null}

      </>}

      {LAYERS[sc.id]?.(id, night) ?? LAYERS.campo(id, night)}
      {indoor || own ? null : <SceneLife scene={sc.id} night={night} rain={rain} dusk={sky.tod === "tramonto"} />}
      {own ? null : indoor ? <IndoorLight id={id} /> : <Atmosphere id={id} sunX={sunX} sunY={sunY} sun={p.sun} night={night} tod={sky.tod} />}
      {indoor || own ? null : <>
      {/* velo dell'ora: la stessa luce su tutto */}
      {p.shadeA ? <rect width="400" height="300" fill={p.shade} opacity={p.shadeA} style={{ mixBlendMode: night ? "multiply" : "soft-light" }} /> : null}
      {rain ? <rect width="400" height="300" fill="#3a4450" opacity={0.2} /> : cloudy ? <rect width="400" height="300" fill="#3a4450" opacity={0.08} /> : null}
      {rain ? (
        <g className="aa-rain" stroke="#dce8f2" strokeOpacity="0.5" strokeWidth="0.8">
          {Array.from({ length: 90 }, (_, i) => <path key={i} d={`M${(i * 37.7) % 420} ${(i * 23.3) % 300} l-3 11`} />)}
        </g>
      ) : null}
      {snow || (sky.weather === "pioggia" && sc.id === "montagna") ? (
        <g className="aa-snow" fill="#fff" opacity="0.85">
          {Array.from({ length: 60 }, (_, i) => <circle key={i} cx={(i * 67.3) % 400} cy={(i * 29.1) % 300} r={0.8 + rnd(i) * 1.4} />)}
        </g>
      ) : null}
      </>}
    </svg>
    {indoor || own ? null : <SkyLayer id={id} tod={sky.tod} night={night} rain={rain} cloudy={cloudy} desert={desert} wind={wind} high={sc.id === "fabriano"} amount={sky.clouds ?? (cloudy ? 0.75 : 0.15)} seed={sky.seed ?? 1} />}
    </>
  );
});

/**
 * Nuvole e uccelli in uno strato a parte: scorrono con una traslazione CSS sul
 * contenitore (gestita dalla scheda grafica), così la scena sotto resta ferma e non
 * viene ridisegnata a ogni fotogramma. Il nastro è largo il doppio e si sposta di metà:
 * il giro torna al punto di partenza senza stacchi.
 */
function SkyLayer({ id, tod, night, rain, cloudy, desert, wind, high = false, amount, seed }: { id: string; tod: Sky["tod"]; night: boolean; rain: boolean; cloudy: boolean; desert: boolean; wind?: number; /** in piazza le nuvole stanno sopra i tetti, piccole e lontane */ high?: boolean; /** quante nuvole, da 0 (limpido) a 1 (coperto) */ amount: number; seed: number }) {
  // senza vento indicato vanno piano verso sinistra; con il vento seguono la sua direzione
  const toRight = wind != null && wind > 0;
  const pace = wind != null ? 0.6 + Math.min(3, Math.abs(wind)) * 0.45 : 1;
  // di sera nuvole grigie (niente rosa)
  // il grigio solo quando è davvero coperto; col bel tempo nuvole bianche, al tramonto appena dorate
  const grey = rain || (cloudy && amount > 0.55);
  const tint = night ? "#3a4870" : rain ? "#8b95a0" : tod === "tramonto" ? "#fff1dc" : "#ffffff";
  const base = night ? "#1a2440" : rain ? "#5d6670" : grey ? "#8e9aa8" : tod === "tramonto" ? "#c79a8a" : "#c9d8e8";
  const top = night ? "#46557a" : rain ? "#a3acb6" : grey ? "#e6eaee" : tod === "tramonto" ? "#fff4e6" : "#ffffff";
  const mid = night ? "#2e3b5c" : rain ? "#7f8994" : grey ? "#c3cad2" : tod === "tramonto" ? "#f2d6c4" : "#f6f9fc";
  const low = night ? "#1e2844" : rain ? "#5d6670" : grey ? "#9aa5b1" : tod === "tramonto" ? "#d9aa98" : "#d8e4f0";
  // nuvole diverse a ogni visita: quante, dove, quanto grandi e quanto trasparenti
  const R = (i: number) => rnd(seed * 0.731 + i * 1.37);
  const make = (layer: number): [number, number, number, number, number][] => {
    const n = Math.max(0, Math.round((layer ? 4.2 : 5.5) * amount + (R(layer * 50) - 0.3) * 1.6));
    return Array.from({ length: n }, (_, i) => {
      const j = layer * 100 + i * 7;
      return [
        ((i + 0.15 + R(j + 1) * 0.7) * 400) / Math.max(1, n),
        layer ? 34 + R(j + 2) * 34 : 14 + R(j + 2) * 30,
        (layer ? 0.55 : 0.38) + R(j + 3) * (layer ? 0.75 : 0.42) + amount * 0.35,
        Math.min(1, 0.3 + R(j + 4) * 0.55 + amount * 0.3),
        j,
      ];
    });
  };
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* in piazza le nuvole restano piccole e alte, sopra i merli del palazzo */}
      <div className="absolute left-0 top-0" style={high ? { width: "222%", transform: "scale(0.45)", transformOrigin: "0 0" } : { width: "100%" }}>
      {[0, 1].map((layer) => {
        const list = make(layer);
        const gid = `${id}cl${layer}`;
        return (
          <div key={layer} className={`aa-cloud-track ${layer ? "aa-cloud-near" : "aa-cloud-far"}`} style={{ opacity: rain ? 0.95 : desert ? 0.6 : 1, animationDirection: toRight ? "reverse" : "normal", animationDuration: `${Math.round((layer ? 90 : 160) / pace)}s` }}>
            <svg viewBox="0 0 560 120" preserveAspectRatio="xMinYMin meet" className="block h-auto w-full">
              <defs>
                <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1="-34" x2="0" y2="12">
                  <stop offset="0" stopColor={top} />
                  <stop offset="0.62" stopColor={mid} />
                  <stop offset="1" stopColor={low} />
                </linearGradient>
              </defs>
              {[0, 280].map((dx) => (
                <g key={dx} transform={`translate(${dx} 6)`}>
                  {list.map(([x, y, k, a, j], i) => <Cloud key={i} x={x * 0.7} y={y} k={k * 0.9} tint={tint} base={base} id={gid} alpha={a} shape={j + seed} />)}
                  {layer === 1 && !night && !rain ? (
                    <g stroke="#2a3a46" strokeWidth="1.3" fill="none" strokeLinecap="round">
                      <path d="M84 84 q4 -4 8 0 q4 -4 8 0" />
                      <path d="M104 76 q3 -3 6 0 q3 -3 6 0" />
                    </g>
                  ) : null}
                </g>
              ))}
            </svg>
          </div>
        );
      })}
      </div>
    </div>
  );
}

/* ---------- elementi comuni ---------- */

/** nuvola a cumulo: sbuffi tondi in alto, base piatta e ombreggiata */
function Cloud({ x, y, k, tint, base, id, alpha = 1, shape = 0 }: { x: number; y: number; k: number; tint: string; base: string; id: string; alpha?: number; shape?: number }) {
  // ogni nuvola ha sbuffi un po' diversi: più lunga, più alta, più gonfia
  const w = 0.75 + rnd(shape * 1.3) * 0.6;
  const h = 0.75 + rnd(shape * 2.1 + 5) * 0.5;
  const puffs: [number, number, number][] = ([[-30, -2, 13], [-14, -11, 16], [4, -16, 19], [22, -9, 15], [36, -1, 11], [-2, -2, 17]] as [number, number, number][]).map(([px, py, r], i) => [px * w, py * h, r * (0.8 + rnd(shape + i * 3.3) * 0.45)]);
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} opacity={alpha}>
      <ellipse cx="2" cy="6" rx="44" ry="6" fill={base} opacity="0.35" />
      {puffs.map(([px, py, r], i) => <circle key={i} cx={px} cy={py} r={r} fill={`url(#${id})`} />)}
      <path d="M-44 4 C-30 9 30 9 48 4 L48 7 C30 12 -30 12 -44 7 Z" fill={base} opacity="0.5" />
      <path d="M-22 -16 C-16 -26 -4 -30 6 -32 C14 -33 20 -28 22 -22" stroke={tint} strokeWidth="2.4" fill="none" opacity="0.55" strokeLinecap="round" />
    </g>
  );
}

/** fili d'erba veri: affusolati, curvi, più scuri alla base, su tre file con un po' di vento */
function Blades({ id, night, grass, y, fill, density = 1 }: { id: string; night: boolean; grass: string; y: number; /** riempimento dei fili, se non è l'erba verde */ fill?: string; /** quanta erba: 1 prato pieno, 0.2 qualche ciuffo */ density?: number }) {
  const rows = [
    { n: 70, top: y + 12, h: 7, w: 1.1, k: 0 },
    { n: 80, top: y + 38, h: 12, w: 1.6, k: 1 },
    { n: 95, top: 296, h: 22, w: 2.4, k: 2 },
  ];
  return (
    <g>
      {rows.map((row) => (
        <g key={row.k}>
          {Array.from({ length: row.n }, (_, i) => {
            if (density < 1 && rnd(i * 11 + row.k * 7) > density) return null;
            const r1 = rnd(i * 3 + row.k * 101);
            const r2 = rnd(i * 7 + row.k * 53);
            const x = (i / row.n) * 404 - 2 + (r1 - 0.5) * 6;
            const by = row.k === 2 ? 302 : row.top + r2 * 18;
            const h = row.h * (0.6 + r2 * 0.8);
            const lean = (r1 - 0.45) * h * 0.7;
            const w = row.w * (0.7 + r1 * 0.6);
            const d = `M${(x - w).toFixed(1)} ${by.toFixed(1)} Q${(x - w * 0.2 + lean * 0.35).toFixed(1)} ${(by - h * 0.6).toFixed(1)} ${(x + lean).toFixed(1)} ${(by - h).toFixed(1)} Q${(x + w * 0.3 + lean * 0.4).toFixed(1)} ${(by - h * 0.55).toFixed(1)} ${(x + w).toFixed(1)} ${by.toFixed(1)} Z`;
            const tinted = i % 5 === 0;
            return <path key={i} d={d} fill={fill ? (tinted ? grass : fill) : tinted ? (night ? "#2f5a3e" : grass) : `url(#${id}blade)`} opacity={row.k === 0 ? 0.75 : 1} />;
          })}
        </g>
      ))}
    </g>
  );
}

function Hills({ far, near, night }: { far: string; near: string; night: boolean }) {
  return (
    <g>
      <path d="M0 176 L40 140 L70 160 L110 120 L150 156 L190 130 L240 166 L290 128 L340 158 L400 136 V220 H0 Z" fill={far} opacity="0.8" />
      <path d="M108 122 L116 132 L102 132 Z M288 130 L297 140 L281 140 Z" fill="#fff" opacity={night ? 0.15 : 0.6} />
      <path d="M0 196 C40 170 80 176 120 186 C170 160 220 168 260 182 C300 164 350 166 400 184 V230 H0 Z" fill={near} opacity="0.85" />
    </g>
  );
}

function TreeLine({ y = 207, colors, n = 18, pines = 3 }: { y?: number; colors: [string, string]; n?: number; pines?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${i * (400 / (n - 1)) + (i % 2) * 6} ${y - (i % 3) * 2})`}>
          <rect x="-1.2" y="0" width="2.4" height="8" fill="#3a2a1e" />
          {i % pines === 0 ? (
            <g>
              <path d={`M0 ${-22 - (i % 2) * 4} L9 2 L-9 2 Z`} fill={colors[1]} />
              <path d={`M0 ${-22 - (i % 2) * 4} L9 2 L2 2 Z`} fill="#000" opacity="0.14" />
            </g>
          ) : (
            <g>
              <ellipse cx="0" cy="-3" rx={7 + (i % 3)} ry={9 + (i % 2) * 2} fill={i % 2 ? colors[0] : colors[1]} />
              <ellipse cx="-2.4" cy={-6 - (i % 2)} rx={(7 + (i % 3)) * 0.55} ry={(9 + (i % 2) * 2) * 0.5} fill="#fff" opacity="0.1" />
              <ellipse cx="2" cy="2.4" rx={(7 + (i % 3)) * 0.8} ry="3.4" fill="#000" opacity="0.16" />
            </g>
          )}
        </g>
      ))}
    </g>
  );
}

function Ground({ id, night, grass = "#86ab5e", flowers = true, y = 216, blade, density = 1 }: { id: string; night: boolean; grass?: string; flowers?: boolean; y?: number; /** colori dei fili [base, metà, punta]: sabbia, neve, foglie secche */ blade?: [string, string, string]; density?: number }) {
  const bid = `${id}bl2`;
  return (
    <g>
      {blade ? (
        <defs>
          <linearGradient id={bid} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={night ? shadeHex(blade[0], -0.55) : blade[0]} />
            <stop offset="0.55" stopColor={night ? shadeHex(blade[1], -0.55) : blade[1]} />
            <stop offset="1" stopColor={night ? shadeHex(blade[2], -0.5) : blade[2]} />
          </linearGradient>
        </defs>
      ) : null}
      <rect y={y} width="400" height={300 - y} fill={`url(#${id}ground)`} />
      {[0, 1, 2, 3].map((i) => <rect key={i} y={y + 6 + i * 20} width="400" height="10" fill="#000" opacity="0.06" />)}
      <Blades id={id} night={night} grass={night && blade ? shadeHex(grass, -0.5) : grass} y={y} fill={blade ? `url(#${bid})` : undefined} density={density} />
      {flowers && !night ? (
        <g>{Array.from({ length: 14 }, (_, i) => <circle key={i} cx={(i * 53) % 400} cy={262 + ((i * 17) % 34)} r="1.6" fill={["#ffd166", "#f4f1ea", "#c084fc", "#ff8fa3"][i % 4]} />)}</g>
      ) : null}
    </g>
  );
}

function Pine({ x, y, h, c, snow }: { x: number; y: number; h: number; c: string; snow?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="aa-tree">
      <rect x={-h * 0.04} y={-h * 0.12} width={h * 0.08} height={h * 0.14} fill="#3a2a1e" />
      {[0, 1, 2].map((k) => (
        <g key={k}>
          <path d={`M0 ${-h + k * h * 0.26} L${h * (0.2 + k * 0.08)} ${-h * 0.42 + k * h * 0.26} L${-h * (0.2 + k * 0.08)} ${-h * 0.42 + k * h * 0.26} Z`} fill={c} />
          {snow ? <path d={`M0 ${-h + k * h * 0.26} L${h * (0.1 + k * 0.04)} ${-h * 0.72 + k * h * 0.26} L${-h * (0.1 + k * 0.04)} ${-h * 0.72 + k * h * 0.26} Z`} fill="#f4f8fb" /> : null}
        </g>
      ))}
      </g>
    </g>
  );
}

function Banner({ x, y, c, h = 14 }: { x: number; y: number; c: string; h?: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y - h} stroke="#3a2a1e" strokeWidth="0.8" />
      <path d={`M${x} ${y - h} l9 2 l-3 2.5 l3 2.5 l-9 1 Z`} fill={c} className="aa-flag" />
    </g>
  );
}

/** profondità all'aperto: foschia verso l'orizzonte, luce dal lato del sole, primo piano più scuro, vignetta */
function Atmosphere({ id, sunX, sunY, sun, night, tod }: { id: string; sunX: number; sunY: number; sun: string; night: boolean; tod: Sky["tod"] }) {
  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id={`${id}haze`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.38" stopColor={night ? "#8ea4cc" : tod === "tramonto" ? "#dcdee2" : "#eaf3fb"} stopOpacity="0" />
          <stop offset="0.7" stopColor={night ? "#8ea4cc" : tod === "tramonto" ? "#dcdee2" : "#eaf3fb"} stopOpacity={night ? 0.06 : 0.16} />
          <stop offset="0.74" stopColor={night ? "#8ea4cc" : tod === "tramonto" ? "#dcdee2" : "#eaf3fb"} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}warm`} cx={sunX / 400} cy={Math.min(0.9, sunY / 300 + 0.2)} r="0.9">
          <stop offset="0" stopColor={sun} stopOpacity={night ? 0.05 : 0.16} />
          <stop offset="1" stopColor={sun} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}fore`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.78" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity={night ? 0.35 : 0.24} />
        </linearGradient>
        <radialGradient id={`${id}vig`} cx="0.5" cy="0.45" r="0.8">
          <stop offset="0.65" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}haze)`} />
      <rect width="400" height="300" fill={`url(#${id}warm)`} />
      <rect width="400" height="300" fill={`url(#${id}fore)`} />
      <rect width="400" height="300" fill={`url(#${id}vig)`} />
    </g>
  );
}

/** al chiuso: coni di luce dalle lampade, pavimento lucido e angoli in ombra */
function IndoorLight({ id }: { id: string }) {
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id={`${id}ivig`} cx="0.5" cy="0.4" r="0.85">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.38" />
        </radialGradient>
        <linearGradient id={`${id}shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect y="214" width="400" height="22" fill={`url(#${id}shine)`} />
      <rect width="400" height="300" fill={`url(#${id}ivig)`} />
    </g>
  );
}

/** paglione al chiuso: battifreccia su cavalletto con visuale da 40 cm */
function IndoorButt({ x, y, s = 1, n }: { x: number; y: number; s?: number; n?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-8 0 L-12 22 M8 0 L12 22 M0 2 L0 22" stroke="#4a3220" strokeWidth="1.6" />
      <rect x="-14" y="-24" width="28" height="26" rx="2" fill="#d9c08a" stroke="#8a6a3a" strokeWidth="0.8" />
      {[0, 1, 2, 3].map((k) => <path key={k} d={`M-14 ${-20 + k * 6} h28`} stroke="#b89a62" strokeWidth="0.6" />)}
      {[9, 7, 5, 3, 1.4].map((r, k) => <circle key={r} cx="0" cy="-11" r={r} fill={["#f4f1ea", "#14181c", "#2f7fd0", "#d0302a", "#f2c84b"][k]} />)}
      {n != null ? <text x="0" y="12" textAnchor="middle" fontSize="6" fontWeight="700" fill="#fff" opacity="0.85">{n}</text> : null}
    </g>
  );
}

/** pavimento a tavole o a piastrelle in prospettiva verso il fondo */
function Floor({ c1, c2, y = 214, lines = "#000", planks = true }: { c1: string; c2: string; y?: number; lines?: string; planks?: boolean }) {
  return (
    <g>
      <rect y={y} width="400" height={300 - y} fill={c1} />
      <path d={`M0 ${y + 40} H400 V300 H0 Z`} fill={c2} opacity="0.6" />
      {planks ? Array.from({ length: 22 }, (_, i) => {
        const xb = -60 + i * 25;
        return <path key={i} d={`M${200 + (xb - 200) * 0.28} ${y} L${xb} 300`} stroke={lines} strokeOpacity="0.14" strokeWidth="0.8" />;
      }) : null}
      {[0, 1, 2, 3, 4].map((k) => <path key={k} d={`M0 ${y + 6 + k * k * 4.2} H400`} stroke={lines} strokeOpacity={planks ? 0.08 : 0.14} strokeWidth="0.7" />)}
    </g>
  );
}

/* ---------- ambientazioni ---------- */

/**
 * Piazza del Comune di Fabriano: il Palazzo del Podestà con i merli e il grande arco a sesto acuto,
 * la Fontana Sturinalto, i palazzi in mattoni ai lati e i drappi rossi con la croce bianca.
 */
function FabrianoPiazza({ id, night }: { id: string; night: boolean }) {
  const N = (day: string, nt: string) => (night ? nt : day);
  const wall = N("#dcd6c8", "#7c786f");
  const wallD = N("#b9b2a2", "#5e5a53");
  const joint = N("#a89f8c", "#4a4640");
  const glass = N("#3a4656", "#ffd27a");
  const brick = N("#9c4a33", "#4a2a20");
  const brickD = N("#7e3a28", "#3a2018");
  const stuc = N("#c98a66", "#5e4234");
  const shutter = N("#7d8a78", "#3c443a");
  const stone = N("#d3cbb9", "#7a746a");
  const bronze = N("#4f6a5c", "#2e3e36");
  // finestra a sesto acuto (bifora o trifora), con la cornice in pietra
  const lancet = (x: number, y: number, w: number, h: number) => `M${x} ${y + h} V${y + w * 0.55} Q${x} ${y} ${x + w / 2} ${y - w * 0.15} Q${x + w} ${y} ${x + w} ${y + w * 0.55} V${y + h} Z`;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}fbw`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={N("#e9e4d8", "#8a857b")} />
          <stop offset="0.55" stopColor={wall} />
          <stop offset="1" stopColor={wallD} />
        </linearGradient>
        <linearGradient id={`${id}fbarch`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={N("#2a2621", "#120f0c")} />
          <stop offset="1" stopColor={N("#4a4540", "#2a2420")} />
        </linearGradient>
        <linearGradient id={`${id}fbpave`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={N("#8e8a83", "#3c3a37")} />
          <stop offset="1" stopColor={N("#5c5954", "#232220")} />
        </linearGradient>
        <radialGradient id={`${id}fbsheen`} cx="0.5" cy="0" r="0.6">
          <stop offset="0" stopColor={N("#f4efe4", "#ffd27a")} stopOpacity={night ? 0.2 : 0.26} />
          <stop offset="1" stopColor={N("#f4efe4", "#ffd27a")} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* in fondo, a sinistra: il fianco di un palazzo, dietro i drappi */}
      <rect x="50" y="96" width="82" height="136" fill={N("#cdb48e", "#5a4e3e")} />
      <path d="M48 96 H134 V90 H50 Z" fill={N("#e2d2b0", "#6a5e4e")} />
      {[0, 1, 2].map((r) => [100, 116].map((x) => <rect key={`${r}${x}`} x={x} y={110 + r * 30} width="8" height="14" fill={N("#5a4a3a", "#ffd27a")} opacity={night ? 0.7 : 0.9} />))}
      <rect x="96" y="200" width="20" height="32" fill={N("#4a3424", "#2a1a12")} />
      {/* in fondo, a destra: case gialle oltre il voltone */}
      <rect x="296" y="150" width="50" height="82" fill={N("#e2c25c", "#6a5a2e")} />
      <path d="M294 150 h54 l-4 -8 h-46 Z" fill={N("#a8543a", "#4a2a20")} />
      {[302, 318, 334].map((x) => <rect key={x} x={x} y="160" width="6" height="10" fill={N("#8a6a3a", "#ffd27a")} opacity="0.8" />)}

      {/* Palazzo del Podestà: corpo principale con merli guelfi */}
      <rect x="128" y="74" width="136" height="158" fill={`url(#${id}fbw)`} />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={129 + i * 11.3} y="62" width="7" height="13" fill={i % 2 ? wall : N("#e4dfd2", "#848076")} />)}
      {/* torre a destra, più bassa, con i suoi merli */}
      <rect x="262" y="96" width="38" height="136" fill={wallD} />
      {Array.from({ length: 4 }, (_, i) => <rect key={i} x={263 + i * 9.8} y="86" width="6" height="11" fill={wallD} />)}
      {/* corsi di pietra */}
      <g stroke={joint} strokeWidth="0.5" opacity="0.55">
        {Array.from({ length: 26 }, (_, i) => <path key={i} d={`M128 ${80 + i * 6} H300`} />)}
        {Array.from({ length: 26 }, (_, i) => Array.from({ length: 9 }, (_, k) => <path key={`${i}-${k}`} d={`M${132 + k * 19 + (i % 2) * 9} ${74 + i * 6} v6`} />))}
      </g>
      <path d="M262 96 V232" stroke={N("#9c9482", "#3e3a34")} strokeWidth="1.2" />
      {/* bifore in alto */}
      {[150, 196].map((x) => (
        <g key={x}>
          <path d={lancet(x - 2, 92, 22, 32)} fill={N("#c9c1ae", "#6a655c")} />
          <path d={lancet(x, 94, 18, 30)} fill={glass} opacity={night ? 0.85 : 1} />
          <path d={`M${x + 9} 96 V124 M${x} 108 H${x + 18}`} stroke={N("#6a7a8a", "#a8823a")} strokeWidth="0.6" />
          <path d={`M${x + 2} 112 h14 M${x + 2} 118 h14`} stroke={N("#6a7a8a", "#a8823a")} strokeWidth="0.4" opacity="0.7" />
        </g>
      ))}
      {/* trifore a metà facciata */}
      {[150, 204].map((x) => (
        <g key={x}>
          <path d={`M${x - 3} 154 V138 Q${x - 3} 124 ${x + 16} 122 Q${x + 35} 124 ${x + 35} 138 V154 Z`} fill={N("#cfc7b4", "#6e695f")} />
          {[0, 1, 2].map((k) => <path key={k} d={lancet(x + 1 + k * 10.5, 134, 8, 18)} fill={glass} opacity={night ? 0.8 : 1} />)}
          <path d={`M${x - 4} 154 h40`} stroke={N("#b2aa96", "#4a463f")} strokeWidth="1.6" />
        </g>
      ))}
      {/* finestre della torre e loggetta */}
      <path d={lancet(274, 104, 12, 18)} fill={glass} opacity={night ? 0.85 : 1} />
      <path d="M268 196 V176 Q268 160 279 158 Q290 160 290 176 V196 Z" fill={N("#3a3632", "#2a241c")} />
      <path d="M268 186 H290 M272 186 V196 M279 186 V196 M286 186 V196" stroke={N("#2a2622", "#a8823a")} strokeWidth="0.9" />
      <path d={lancet(276, 208, 8, 14)} fill={glass} opacity="0.9" />
      <rect x="230" y="166" width="6" height="7" fill={N("#3a3632", "#ffd27a")} opacity="0.8" />
      <path d={lancet(222, 196, 10, 18)} fill={glass} opacity="0.9" />

      {/* il grande voltone a sesto acuto, con la via che prosegue */}
      <path d="M138 232 V190 Q138 160 173 150 Q208 160 208 190 V232 Z" fill={N("#c9c1ae", "#6a655c")} />
      <path d="M142 232 V190 Q142 163 173 154 Q204 163 204 190 V232 Z" fill={`url(#${id}fbarch)`} />
      <g>
        <rect x="167" y="172" width="12" height="60" fill={N("#a9c6e2", "#1d2a44")} />
        {[[150, 196, 14, "#d98a4a"], [160, 204, 9, "#e8c46a"], [178, 202, 10, "#d9a08a"], [186, 194, 14, "#c96a4a"]].map(([x, y, w, c]) => (
          <g key={x as number}>
            <rect x={x as number} y={y as number} width={w as number} height={232 - (y as number)} fill={night ? "#3a2e24" : (c as string)} />
            <rect x={(x as number) + 2} y={(y as number) + 4} width="3" height="4" fill={N("#5a3a22", "#ffd27a")} />
            <rect x={(x as number) + 2} y={(y as number) + 14} width="3" height="4" fill={N("#5a3a22", "#ffd27a")} />
          </g>
        ))}
        {[158, 186].map((x) => <path key={x} d={`M${x} 200 h5 v8 h-5 Z`} fill="#c8262c" className="aa-flag" />)}
        <path d="M142 232 L166 214 H180 L204 232 Z" fill={N("#6e6a63", "#2a2826")} />
        <path d="M142 190 Q142 163 173 154 Q204 163 204 190 L196 196 Q194 170 173 164 Q152 170 150 196 Z" fill="#000" opacity="0.35" />
      </g>
      {/* il voltone piccolo verso destra */}
      <path d="M300 172 L344 186 V232 H300 Z" fill={wallD} />
      <path d="M306 232 V208 Q306 192 322 190 Q338 192 338 208 V232 Z" fill={`url(#${id}fbarch)`} />
      <rect x="312" y="204" width="20" height="28" fill={N("#e2c25c", "#4a3e22")} opacity="0.8" />

      {/* a sinistra: palazzo in mattoni con il drappo della città */}
      <rect x="0" y="0" width="56" height="232" fill={brick} />
      <g stroke={brickD} strokeWidth="0.5" opacity="0.7">
        {Array.from({ length: 58 }, (_, i) => <path key={i} d={`M0 ${i * 4} H56`} />)}
      </g>
      <rect x="50" y="0" width="6" height="232" fill={brickD} />
      <rect x="20" y="150" width="18" height="30" fill={N("#3a2a20", "#ffd27a")} opacity={night ? 0.75 : 1} />
      <path d="M18 150 h22 v-4 h-22 Z M18 180 h22 v3 h-22 Z" fill={N("#d9cbb0", "#6a5e4e")} />
      <rect x="20" y="196" width="22" height="36" fill={N("#4a2e1e", "#2a1a12")} />
      <path d="M56 6 H118" stroke="#3a2a1e" strokeWidth="1.6" />
      <g>
        <path d="M60 6 H122 V112 Q91 118 60 112 Z" fill={N("#c8262c", "#6a1418")} />
        <path d="M86 6 H96 V114 H86 Z M60 40 H122 V52 H60 Z" fill={N("#f3efe6", "#9c968c")} />
        {[[72, 22, "#e6b325"], [108, 22, "#2f7a4a"], [72, 78, "#2f4fa8"], [108, 78, "#c8262c"]].map(([x, y, c]) => (
          <path key={`${x}${y}`} d={`M${(x as number) - 8} ${(y as number) - 9} H${(x as number) + 8} V${(y as number) + 1} Q${(x as number) + 8} ${(y as number) + 9} ${x} ${(y as number) + 12} Q${(x as number) - 8} ${(y as number) + 9} ${(x as number) - 8} ${(y as number) + 1} Z`} fill={night ? "#3a3a3a" : (c as string)} stroke={N("#d9b45a", "#6a5a2a")} strokeWidth="1" />
        ))}
        <path d={`M60 112 ${Array.from({ length: 15 }, (_, i) => `L${62 + i * 4} ${i % 2 ? 118 : 114}`).join(" ")} L122 112`} stroke={N("#d9b45a", "#6a5a2a")} strokeWidth="1.6" fill="none" />
        <path d="M60 6 V112" stroke="#000" strokeOpacity="0.15" strokeWidth="3" />
      </g>
      {/* secondo drappo più in basso */}
      <g>
        <path d="M58 124 H92 V176 Q75 180 58 176 Z" fill={N("#c8262c", "#6a1418")} />
        <path d="M71 124 H78 V178 H71 Z M58 142 H92 V148 H58 Z" fill={N("#f3efe6", "#9c968c")} />
        <path d="M60 128 h8 v6 q0 4 -4 5 q-4 -1 -4 -5 Z" fill={N("#e6b325", "#3a3a3a")} />
        <path d="M81 128 h8 v6 q0 4 -4 5 q-4 -1 -4 -5 Z" fill={N("#2f7a4a", "#3a3a3a")} />
      </g>

      {/* a destra: palazzo intonacato con persiane e portone */}
      <rect x="344" y="112" width="56" height="120" fill={stuc} />
      <path d="M340 112 H400 V104 H344 Z" fill={N("#e6dccb", "#6a6258")} />
      {[0, 1].map((r) => [352, 378].map((x) => (
        <g key={`${r}${x}`}>
          <rect x={x} y={124 + r * 34} width="14" height="20" fill={N("#3a3632", "#ffd27a")} opacity={night ? 0.7 : 1} />
          <rect x={x - 4} y={124 + r * 34} width="4" height="20" fill={shutter} />
          <rect x={x + 14} y={124 + r * 34} width="4" height="20" fill={shutter} />
          <path d={`M${x - 5} ${122 + r * 34} h24 v-3 h-24 Z`} fill={N("#e6dccb", "#6a6258")} />
        </g>
      )))}
      <path d="M368 232 V206 Q368 192 384 190 Q400 192 400 206 V232 Z" fill={N("#6a3e22", "#2a1a10")} />
      <path d="M364 232 V206 Q364 188 384 186 Q404 188 404 206" stroke={N("#e6dccb", "#6a6258")} strokeWidth="2" fill="none" />

      {/* il selciato bagnato della piazza */}
      <rect x="0" y="230" width="400" height="70" fill={`url(#${id}fbpave)`} />
      <g stroke={N("#4c4944", "#161514")} strokeWidth="0.6" opacity="0.55">
        {[236, 243, 251, 260, 270, 281, 293].map((y) => <path key={y} d={`M0 ${y} H400`} />)}
        {Array.from({ length: 15 }, (_, i) => <path key={i} d={`M${173 + (i - 7) * 8} 230 L${173 + (i - 7) * 60} 300`} />)}
      </g>
      {/* riflesso del palazzo sulla pietra bagnata */}
      <ellipse cx="214" cy="232" rx="110" ry="34" fill={`url(#${id}fbsheen)`} />

      {/* Fontana Sturinalto: vasche di pietra e coppa di bronzo */}
      <g transform="translate(252 0)">
        <ellipse cx="0" cy="244" rx="40" ry="5" fill="#000" opacity="0.2" />
        <path d="M-38 228 L-34 242 H34 L38 228 Z" fill={stone} />
        <path d="M-38 228 H38 L34 224 H-34 Z" fill={N("#e6dfcf", "#8a8478")} />
        <path d="M-34 236 H34" stroke={N("#a89f8a", "#4a463f")} strokeWidth="0.8" />
        {[-24, -8, 8, 24].map((x) => <path key={x} d={`M${x} 228 V242`} stroke={N("#b2aa96", "#4a463f")} strokeWidth="0.6" />)}
        <path d="M-22 224 L-18 212 H18 L22 224 Z" fill={stone} />
        <path d="M-24 212 H24 L20 208 H-20 Z" fill={N("#e6dfcf", "#8a8478")} />
        <path d="M-4 208 V196 H4 V208 Z" fill={bronze} />
        <path d="M-12 196 Q0 202 12 196 L10 192 H-10 Z" fill={bronze} />
        <path d="M-2 192 V182 H2 V192 Z" fill={bronze} />
        <ellipse cx="0" cy="182" rx="6" ry="2" fill={N("#6a8a78", "#3a4a42")} />
        <path className="aa-fountain" d="M0 180 q-9 -6 -14 14 M0 180 q9 -6 14 14 M-10 194 q-8 2 -12 14 M10 194 q8 2 12 14" stroke={N("#d6ecff", "#9fb4d8")} strokeWidth="1.1" fill="none" opacity="0.85" />
        <ellipse cx="0" cy="226" rx="30" ry="1.8" fill={N("#9cc4e2", "#2a3a54")} opacity="0.8" />
        {/* colonnine con le catene */}
        {[-46, -30, -14, 2, 18, 34, 50].map((x) => <rect key={x} x={x - 1.6} y="244" width="3.2" height="9" rx="1.4" fill={N("#eae6dc", "#8a857b")} />)}
        <path d="M-46 246 Q-38 250 -30 246 Q-22 250 -14 246 Q-6 250 2 246 Q10 250 18 246 Q26 250 34 246 Q42 250 50 246" stroke={N("#4a4640", "#2a2826")} strokeWidth="0.8" fill="none" />
      </g>
      {night ? <circle cx="173" cy="200" r="40" fill="#ffd27a" opacity="0.08" /> : null}
    </g>
  );
}

const LAYERS: Record<SceneId, (id: string, night: boolean) => ReactNode> = {
  trono: (id) => FOUNDER_LAYERS.trono(id),
  drago: (id) => FOUNDER_LAYERS.drago(id),
  cielo: (id) => FOUNDER_LAYERS.cielo(id),
  fabriano: (id, night) => <FabrianoPiazza id={id} night={night} />,
  campo: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#9db3c6"} near={night ? "#141f33" : "#6e8f86"} night={night} />
      <rect y="150" width="400" height="80" fill={`url(#${id}mist)`} />
      <path d="M0 210 C50 194 110 200 160 208 C220 192 290 196 400 206 V232 H0 Z" fill={night ? "#13202a" : "#58784c"} />
      <TreeLine colors={night ? ["#10201a", "#0c1914"] : ["#3b6a3e", "#2f5a35"]} />
      <Ground id={id} night={night} />
      {/* paglioni lontani e linea di tiro */}
      {[60, 110, 330].map((x) => (
        <g key={x} transform={`translate(${x} 214)`}>
          <path d="M-4 0 L-6 8 M4 0 L6 8" stroke="#5b3d22" strokeWidth="1" />
          <rect x="-6" y="-11" width="12" height="12" rx="1" fill="#c9a46a" />
          <circle cx="0" cy="-5" r="3.6" fill="#e6b325" stroke="#c4473d" strokeWidth="1.2" />
        </g>
      ))}
    </g>
  ),
  foresta: (id, night) => (
    <g>
      <path d="M0 180 C60 160 120 170 200 164 C280 158 340 170 400 160 V230 H0 Z" fill={night ? "#0e1a16" : "#4f6f5a"} opacity="0.8" />
      {Array.from({ length: 16 }, (_, i) => <Pine key={`f${i}`} x={i * 27 + 6} y={214} h={60 + rnd(i) * 30} c={night ? "#0c1914" : i % 2 ? "#2f5a35" : "#3b6a3e"} />)}
      {!night ? <g fill="#fff6c8" opacity="0.18">{[70, 160, 260, 340].map((x) => <path key={x} d={`M${x} 40 L${x + 30} 40 L${x + 70} 300 L${x + 20} 300 Z`} />)}</g> : null}
      <Ground id={id} night={night} grass="#6a9a4a" flowers={false} />
      {/* tronchi grandi in primo piano ai lati */}
      {[[-6, 1.2], [392, 1.1]].map(([x, k]) => (
        <g key={x} transform={`translate(${x} 0) scale(${k} 1)`}>
          <rect x="-10" y="40" width="22" height="260" fill={night ? "#1a120c" : "#4a3322"} />
          <path d="M-10 60 q11 6 22 0 M-10 120 q11 6 22 0 M-10 190 q11 6 22 0" stroke="#2a1d14" strokeWidth="1.4" fill="none" />
        </g>
      ))}
      <g fill={night ? "#10201a" : "#2f5a35"}>
        <ellipse cx="10" cy="40" rx="60" ry="40" />
        <ellipse cx="390" cy="30" rx="60" ry="42" />
      </g>
      {/* felci */}
      {[30, 90, 300, 370].map((x) => (
        <g key={x} transform={`translate(${x} 290)`} stroke={night ? "#1f3a2a" : "#4f8a3a"} strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M0 0 q-12 -14 -22 -12 M0 0 q12 -16 22 -14 M0 0 q-4 -20 -2 -26 M0 0 q6 -18 10 -22" />
        </g>
      ))}
    </g>
  ),
  castello: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#9db3c6"} near={night ? "#141f33" : "#6e8f86"} night={night} />
      {/* castello sulla collina */}
      <path d="M190 200 C220 170 300 166 340 196 Z" fill={night ? "#1a2a22" : "#5f7d52"} />
      <g transform="translate(232 150)">
        <rect x="0" y="10" width="76" height="40" fill={`url(#${id}stone)`} />
        {[0, 8, 16, 24, 32, 40, 48, 56, 64, 72].map((x) => <rect key={x} x={x} y="6" width="5" height="5" fill="#9aa0a6" />)}
        {[[-8, 30], [32, 44], [72, 30]].map(([x, h]) => (
          <g key={x}>
            <rect x={x} y={10 - h} width="14" height={h + 40} fill={`url(#${id}stone)`} />
            <path d={`M${x - 2} ${10 - h} L${x + 7} ${-4 - h} L${x + 16} ${10 - h} Z`} fill="#7a3a3a" />
            <Banner x={x + 7} y={-4 - h} c="#c4473d" h={10} />
            <rect x={x + 5} y={20 - h} width="4" height="7" rx="2" fill={night ? "#ffd27a" : "#2a2f35"} />
          </g>
        ))}
        <path d="M32 50 v-14 a6 6 0 0 1 12 0 v14 Z" fill="#3a2a1e" />
        {[12, 56].map((x) => <rect key={x} x={x} y="22" width="4" height="7" rx="2" fill={night ? "#ffd27a" : "#2a2f35"} />)}
      </g>
      <TreeLine colors={night ? ["#10201a", "#0c1914"] : ["#3b6a3e", "#2f5a35"]} />
      <Ground id={id} night={night} />
      {/* mura in primo piano a destra */}
      <g transform="translate(330 196)">
        <rect x="0" y="0" width="80" height="34" fill={`url(#${id}stone)`} opacity="0.9" />
        {[0, 10, 20, 30, 40, 50, 60, 70].map((x) => <rect key={x} x={x} y="-5" width="6" height="6" fill="#9aa0a6" />)}
        <path d="M0 12 H80 M0 24 H80 M10 0 V12 M30 12 V24 M50 0 V12 M70 12 V24" stroke="#6a6f76" strokeWidth="0.7" />
      </g>
    </g>
  ),
  palazzo: (id, night) => (
    <g>
      <path d="M0 196 C80 186 160 190 400 188 V230 H0 Z" fill={night ? "#141f33" : "#7a9a8a"} opacity="0.8" />
      {/* facciata del palazzo con cupole */}
      <g transform="translate(110 132)">
        <rect x="0" y="20" width="180" height="62" fill={night ? "#5a5248" : "#efe3c8"} stroke="#b9a57a" strokeWidth="0.8" />
        <path d="M-6 20 H186 L180 12 H0 Z" fill={night ? "#4a4238" : "#d9c9a2"} />
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i}>
            <rect x={10 + i * 19} y="30" width="8" height="14" rx="4" fill={night ? "#ffd27a" : "#5a7a9a"} opacity={night ? 0.8 : 1} />
            <rect x={10 + i * 19} y="54" width="8" height="16" rx="4" fill={night ? "#ffd27a" : "#5a7a9a"} opacity={night ? 0.7 : 1} />
          </g>
        ))}
        <path d="M70 20 C70 -6 110 -6 110 20 Z" fill={night ? "#3a5a5a" : "#5aa08a"} />
        <path d="M90 -6 V-16" stroke="#d9b45a" strokeWidth="1.4" />
        <circle cx="90" cy="-17" r="2" fill="#d9b45a" />
        {[0, 180].map((x) => (
          <g key={x}>
            <rect x={x - 12} y="0" width="24" height="82" fill={night ? "#5a5248" : "#e6d6b2"} stroke="#b9a57a" strokeWidth="0.8" />
            <path d={`M${x - 14} 0 C${x - 14} -18 ${x + 14} -18 ${x + 14} 0 Z`} fill={night ? "#3a5a5a" : "#5aa08a"} />
            <Banner x={x} y={-16} c="#2a5d8a" h={10} />
          </g>
        ))}
        <path d="M76 82 v-20 a14 14 0 0 1 28 0 v20 Z" fill="#6a4a2a" />
      </g>
      <Ground id={id} night={night} grass="#9ac46a" />
      {/* siepi, viale e fontana */}
      <path d="M150 216 L250 216 L330 300 L70 300 Z" fill={night ? "#3a3428" : "#e2d2a8"} opacity="0.85" />
      {[[20, 218], [300, 218]].map(([x, y]) => <rect key={x} x={x} y={y} width="80" height="12" rx="6" fill={night ? "#16301e" : "#3f7a3a"} />)}
      {[[40, 240], [290, 240]].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <path d="M0 0 C-6 -10 -2 -26 6 -34 C14 -26 18 -10 12 0 Z" fill={night ? "#16301e" : "#2f6a32"} />
          <rect x="3" y="0" width="6" height="8" fill="#a07a4a" />
        </g>
      ))}
      <g transform="translate(200 246)">
        <ellipse cx="0" cy="6" rx="26" ry="6" fill={night ? "#3a4450" : "#cfc3a6"} />
        <ellipse cx="0" cy="5" rx="22" ry="4" fill={`url(#${id}water)`} />
        <rect x="-3" y="-12" width="6" height="16" fill="#cfc3a6" />
        <path className="aa-fountain" d="M0 -14 q-8 -10 -14 4 M0 -14 q8 -10 14 4" stroke="#bfe3ff" strokeWidth="1.4" fill="none" opacity="0.8" />
      </g>
    </g>
  ),
  montagna: (id, night) => (
    <g>
      <path d="M0 190 L60 90 L100 140 L160 60 L220 150 L270 80 L330 140 L400 70 V230 H0 Z" fill={night ? "#1c2a44" : "#7d93b0"} />
      <path d="M160 60 L176 86 L168 84 L160 92 L152 82 L146 84 Z M270 80 L284 104 L270 98 L258 104 Z M60 90 L72 110 L60 106 L50 112 Z M400 70 L400 100 L388 92 Z" fill="#f4f8fb" opacity={night ? 0.5 : 0.95} />
      <path d="M0 200 L80 150 L140 186 L210 140 L280 184 L340 150 L400 176 V232 H0 Z" fill={night ? "#141f33" : "#5a7488"} opacity="0.9" />
      <rect y="150" width="400" height="80" fill={`url(#${id}mist)`} />
      {Array.from({ length: 14 }, (_, i) => <Pine key={i} x={i * 30 + 4} y={216} h={34 + rnd(i) * 18} c={night ? "#0c1914" : "#2f5038"} />)}
      <Ground id={id} night={night} />
      {[[30, 266, 18], [350, 274, 24], [300, 290, 12]].map(([x, y, r]) => <path key={x} d={`M${x - r} ${y} Q${x - r * 0.6} ${y - r} ${x} ${y - r * 0.9} Q${x + r * 0.8} ${y - r * 0.7} ${x + r} ${y} Z`} fill={night ? "#3a4450" : "#8a8f96"} />)}
    </g>
  ),
  lago: (id, night) => (
    <g>
      <path d="M0 196 L50 140 L90 170 L150 120 L210 176 L260 132 L320 168 L400 130 V206 H0 Z" fill={night ? "#1c2a44" : "#8aa6bd"} />
      <TreeLine y={200} colors={night ? ["#10201a", "#0c1914"] : ["#3b6a3e", "#2f5a35"]} n={22} />
      <rect y="206" width="400" height="34" fill={`url(#${id}water)`} />
      {/* riflessi delle montagne e scintille */}
      <path d="M0 206 L50 236 L90 220 L150 240 L210 214 L260 236 L320 218 L400 238 V206 Z" fill={night ? "#1c2a44" : "#8aa6bd"} opacity="0.25" />
      <g className="aa-shimmer" stroke="#fff" strokeOpacity="0.5" strokeWidth="1">
        {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${(i * 53) % 400} ${210 + (i % 5) * 6} h${6 + (i % 3) * 4}`} />)}
      </g>
      <Ground id={id} night={night} y={238} />
      {/* pontile e canne */}
      <g transform="translate(300 230)">
        <path d="M0 0 L60 0 L60 5 L0 5 Z" fill="#7a5a3a" />
        {[6, 22, 38, 54].map((x) => <rect key={x} x={x} y="5" width="2.6" height="10" fill="#4a3322" />)}
      </g>
      {[20, 34, 48, 220, 236].map((x, i) => <path key={x} d={`M${x} 244 q${i % 2 ? 3 : -3} -18 ${i % 2 ? 1 : -2} -30`} stroke={night ? "#2f4a3a" : "#6a8a3a"} strokeWidth="1.6" fill="none" className="aa-tree" />)}
    </g>
  ),
  deserto: (id, night) => (
    <g>
      {/* mese lontane a strati, dune con il lato in luce e quello in ombra, cactus, rocce e tremolio del caldo */}
      {[[196, 150, 96, 1], [96, 170, 70, 0.8], [300, 176, 60, 0.7]].map(([x, y, w, k], i) => (
        <g key={i} opacity={k}>
          <path d={`M${x} 204 L${x + w * 0.16} ${y} L${x + w * 0.84} ${y} L${x + w} 204 Z`} fill={night ? "#3a2a2a" : ["#c27a4a", "#b8704a", "#c88a5a"][i]} />
          <path d={`M${x + w * 0.16} ${y} L${x + w * 0.84} ${y} L${x + w * 0.83} ${y + 6} L${x + w * 0.17} ${y + 6} Z`} fill={night ? "#4a3434" : "#e0a070"} />
          {[16, 26, 36].map((dy) => <path key={dy} d={`M${x + w * 0.14 - dy * 0.05} ${y + dy} H${x + w * 0.86 + dy * 0.05}`} stroke={night ? "#2a1e1e" : "#a8603a"} strokeWidth="1.2" opacity="0.6" />)}
          <path d={`M${x + w * 0.6} ${y + 6} L${x + w * 0.84} ${y} L${x + w} 204 L${x + w * 0.7} 204 Z`} fill="#000" opacity="0.14" />
        </g>
      ))}
      <path d="M0 206 C50 186 110 190 170 204 C230 184 300 182 400 200 V232 H0 Z" fill={night ? "#4a3c2a" : "#ecca90"} />
      <path d="M170 204 C230 184 300 182 400 200 V210 C330 196 260 198 170 204 Z" fill="#fff" opacity="0.18" />
      <path d="M0 218 C70 200 150 208 220 218 C290 204 350 206 400 214 V240 H0 Z" fill={night ? "#3e3222" : "#ddb27a"} />
      <path d="M0 218 C70 200 150 208 220 218 L220 226 C150 216 70 210 0 226 Z" fill="#000" opacity="0.08" />
      <Ground id={id} night={night} grass="#a8864a" flowers={false} blade={["#7a5a2a", "#b0905a", "#e2c48a"]} density={0.18} />
      {/* increspature della sabbia */}
      <g fill="none" strokeLinecap="round">
        {[244, 256, 270, 286].map((y, i) => <path key={y} d={`M-10 ${y} q30 -${3 + i} 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0`} stroke="#fff" strokeOpacity={0.14 + i * 0.03} strokeWidth={1 + i * 0.4} />)}
      </g>
      {/* saguari */}
      {[[124, 240, 1], [286, 226, 0.66]].map(([x, y, k]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${k})`}>
          <ellipse cx="0" cy="1" rx="14" ry="2.6" fill="#000" opacity="0.2" />
          <path d="M-5 0 V-52 C-5 -60 5 -60 5 -52 V0 Z" fill={night ? "#1f3a2a" : "#4f8a4a"} />
          <path d="M-5 -24 H-14 C-18 -24 -18 -28 -18 -32 V-44 C-18 -48 -12 -48 -12 -44 V-30 H-5 Z" fill={night ? "#1f3a2a" : "#4f8a4a"} />
          <path d="M5 -32 H12 V-50 C12 -54 18 -54 18 -50 V-30 C18 -26 16 -26 12 -26 H5 Z" fill={night ? "#1f3a2a" : "#4f8a4a"} />
          {[-3, 0, 3].map((dx) => <path key={dx} d={`M${dx} -2 V-54`} stroke={night ? "#14281a" : "#3a6a36"} strokeWidth="0.7" />)}
          <path d="M-3.4 -54 V-4" stroke="#fff" strokeOpacity="0.2" strokeWidth="1.2" />
          <circle cx="0" cy="-58" r="2" fill={night ? "#4a2a30" : "#f27a9a"} />
        </g>
      ))}
      {[[170, 266, 12, 7], [250, 250, 8, 5], [276, 278, 14, 8]].map(([x, y, w, h]) => (
        <g key={x}>
          <ellipse cx={x + 1} cy={y + 1} rx={w * 1.1} ry={h * 0.3} fill="#000" opacity="0.2" />
          <path d={`M${x - w} ${y} Q${x - w * 0.8} ${y - h} ${x} ${y - h} Q${x + w * 0.9} ${y - h * 0.9} ${x + w} ${y} Z`} fill={night ? "#3a2a22" : "#b07a4a"} />
          <path d={`M${x - w * 0.6} ${y - h * 0.6} Q${x} ${y - h * 1.05} ${x + w * 0.4} ${y - h * 0.7}`} stroke="#fff" strokeOpacity="0.25" strokeWidth="1.2" fill="none" />
        </g>
      ))}
      {night ? null : <g className="aa-shimmer" stroke="#fff" strokeOpacity="0.12" strokeWidth="1.2" fill="none">{[0, 1, 2].map((i) => <path key={i} d={`M${40 + i * 120} ${210 + i * 3} q20 -3 40 0 t40 0`} />)}</g>}
    </g>
  ),
  villaggio: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#9db3c6"} near={night ? "#141f33" : "#6e8f86"} night={night} />
      <TreeLine y={204} colors={night ? ["#10201a", "#0c1914"] : ["#3b6a3e", "#2f5a35"]} />
      {/* case e campanile */}
      {[[30, 184, 34, "#e9dcc0", "#8a3a2a"], [80, 190, 28, "#d9c9a8", "#6a4a2a"], [250, 186, 32, "#efe3c8", "#9a4a32"], [300, 182, 40, "#e2d2b0", "#7a3a2a"], [352, 190, 26, "#d9c9a8", "#8a3a2a"]].map(([x, y, w, wall, roof]) => (
        <g key={x as number}>
          <rect x={x as number} y={y as number} width={w as number} height={34} fill={night ? "#4a4238" : (wall as string)} stroke="#6a5a42" strokeWidth="0.6" />
          <path d={`M${(x as number) - 4} ${y} L${(x as number) + (w as number) / 2} ${(y as number) - 16} L${(x as number) + (w as number) + 4} ${y} Z`} fill={roof as string} />
          <path d={`M${(x as number) + 4} ${(y as number) + 4} V${(y as number) + 30} M${(x as number) + (w as number) - 4} ${(y as number) + 4} V${(y as number) + 30} M${x} ${(y as number) + 14} H${(x as number) + (w as number)}`} stroke="#5a3a22" strokeWidth="1" opacity="0.6" />
          <rect x={(x as number) + (w as number) / 2 - 3} y={(y as number) + 18} width="6" height="9" fill={night ? "#ffd27a" : "#3a2a1e"} />
        </g>
      ))}
      <g transform="translate(150 150)">
        <rect x="0" y="0" width="22" height="70" fill={night ? "#4a4238" : "#d9c9a8"} stroke="#8a7a5a" strokeWidth="0.6" />
        <path d="M-3 0 L11 -24 L25 0 Z" fill="#7a3a2a" />
        <rect x="7" y="10" width="8" height="12" rx="4" fill="#3a2a1e" />
        <circle cx="11" cy="34" r="5" fill="#f4f1ea" stroke="#3a2a1e" strokeWidth="0.8" />
      </g>
      {!night ? <path className="aa-smoke" d="M320 162 q-6 -10 2 -20 q8 -10 0 -22" stroke="#e8e8e8" strokeOpacity="0.5" strokeWidth="4" fill="none" strokeLinecap="round" /> : null}
      <Ground id={id} night={night} />
      <g stroke="#7a5a3a" strokeWidth="2">
        <path d="M0 240 H150 M0 252 H150" />
        {[10, 40, 70, 100, 130].map((x) => <path key={x} d={`M${x} 232 V258`} />)}
      </g>
    </g>
  ),
  neve: (id, night) => (
    <g>
      {/* montagne innevate con il lato in luce e quello in ombra, poi colline morbide, abeti carichi di neve */}
      {[[-20, 176, 70, 124], [60, 182, 90, 108], [170, 178, 80, 120], [250, 182, 100, 104], [330, 178, 90, 126]].map(([x, base, w, peak], i) => (
        <g key={i}>
          <path d={`M${x} ${base} L${x + w * 0.5} ${peak} L${x + w} ${base} Z`} fill={night ? "#2a3a54" : "#b9c8d8"} />
          <path d={`M${x + w * 0.5} ${peak} L${x + w} ${base} L${x + w * 0.62} ${base} Z`} fill="#000" opacity="0.12" />
          <path d={`M${x + w * 0.5} ${peak} L${x + w * 0.66} ${peak + (base - peak) * 0.38} L${x + w * 0.58} ${peak + (base - peak) * 0.3} L${x + w * 0.5} ${peak + (base - peak) * 0.42} L${x + w * 0.42} ${peak + (base - peak) * 0.3} L${x + w * 0.34} ${peak + (base - peak) * 0.38} Z`} fill={night ? "#c9d4e6" : "#f8fbfd"} />
        </g>
      ))}
      <path d="M0 196 C40 176 80 180 120 188 C170 168 220 174 260 186 C300 170 350 172 400 188 V230 H0 Z" fill={night ? "#3a4a64" : "#e6edf3"} />
      <path d="M0 196 C40 176 80 180 120 188 L120 194 C80 186 40 184 0 202 Z" fill="#fff" opacity="0.5" />
      {Array.from({ length: 16 }, (_, i) => <Pine key={i} x={i * 27 + 4} y={214} h={40 + rnd(i + 3) * 26} c={night ? "#16302a" : "#2f5038"} snow />)}
      <Ground id={id} night={night} grass="#dfe7ef" flowers={false} blade={["#9aaab8", "#c9d6e2", "#ffffff"]} density={0.22} />
      <path d="M0 248 C60 238 120 244 180 248 C240 252 320 238 400 246 V256 C320 248 240 262 180 256 C120 252 60 248 0 256 Z" fill="#fff" opacity="0.55" />
      <path d="M0 272 C80 262 160 268 240 274 C300 278 360 266 400 270" stroke="#b9c8d8" strokeOpacity="0.5" strokeWidth="2" fill="none" />
    </g>
  ),
  campagna: (id, night) => (
    <g>
      <path d="M0 190 C70 150 140 160 200 176 C260 150 330 150 400 172 V230 H0 Z" fill={night ? "#1a2a22" : "#8aaa5a"} />
      <path d="M0 206 C80 180 170 186 240 198 C300 186 360 186 400 196 V232 H0 Z" fill={night ? "#16241c" : "#a8b85a"} />
      {/* filari di vite sulla collina */}
      <g stroke={night ? "#1f3a2a" : "#4f7a2a"} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="3 3">
        {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${20 + i * 8} ${196 - i * 6} Q120 ${170 - i * 6} 190 ${188 - i * 4}`} fill="none" />)}
      </g>
      {/* casale e cipressi */}
      <g transform="translate(270 160)">
        <rect x="0" y="0" width="44" height="24" fill={night ? "#4a4238" : "#e8c89a"} />
        <path d="M-3 0 L22 -10 L47 0 Z" fill="#a0503a" />
        <rect x="30" y="-14" width="10" height="18" fill={night ? "#4a4238" : "#e0bc8a"} />
        <rect x="8" y="8" width="6" height="8" fill={night ? "#ffd27a" : "#5a3a22"} />
      </g>
      {[240, 252, 330, 342, 356].map((x, i) => <path key={x} d={`M${x} 186 C${x - 5} 170 ${x - 3} 150 ${x} ${136 + (i % 2) * 8} C${x + 3} 150 ${x + 5} 170 ${x} 186 Z`} fill={night ? "#10201a" : "#2f4a2a"} className="aa-tree" />)}
      <Ground id={id} night={night} />
    </g>
  ),
  torneo: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#9db3c6"} near={night ? "#141f33" : "#6e8f86"} night={night} />
      <TreeLine y={202} colors={night ? ["#10201a", "#0c1914"] : ["#3b6a3e", "#2f5a35"]} />
      {/* tribune e tende a righe */}
      <g transform="translate(20 180)">
        <path d="M0 30 L110 30 L104 0 L6 0 Z" fill={night ? "#3a2a1e" : "#8a6a42"} />
        {[6, 14, 22].map((y) => <path key={y} d={`M${4 + y * 0.2} ${y} H${106 - y * 0.2}`} stroke="#5a3a22" strokeWidth="1" />)}
        {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={10 + i * 8} cy={4 + (i % 3) * 8} r="2.4" fill={["#c4473d", "#2a5d8a", "#e6b325", "#f4f1ea"][i % 4]} />)}
        <path d="M-2 0 L112 0 L106 -8 L4 -8 Z" fill="#c4473d" />
        {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${4 + i * 13} 0 l6.5 6 l6.5 -6`} fill={i % 2 ? "#f4f1ea" : "#c4473d"} />)}
      </g>
      {[[260, "#2a5d8a"], [320, "#c4473d"], [372, "#e6b325"]].map(([x, c]) => (
        <g key={x as number} transform={`translate(${x} 204)`}>
          <path d="M-18 14 L0 -18 L18 14 Z" fill={c as string} />
          <path d="M-9 14 L0 -18 L9 14 Z" fill="#f4f1ea" opacity="0.85" />
          <path d="M-4 14 L0 2 L4 14 Z" fill="#3a2a1e" />
          <Banner x={0} y={-18} c={c as string} h={10} />
        </g>
      ))}
      <Ground id={id} night={night} />
      {/* staccionata della lizza */}
      <g stroke="#e9dcc0" strokeWidth="2">
        <path d="M0 236 H400" />
        {Array.from({ length: 11 }, (_, i) => <path key={i} d={`M${i * 40} 228 V244`} />)}
      </g>
    </g>
  ),
  rovine: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#b3bfc6"} near={night ? "#141f33" : "#8a9a86"} night={night} />
      {/* colonnato e arco */}
      <g transform="translate(160 140)" fill={night ? "#5a5650" : "#d8cfbd"} stroke={night ? "#3a3632" : "#a89a7a"} strokeWidth="0.8">
        <rect x="0" y="0" width="140" height="8" />
        {[6, 36, 66, 96, 126].map((x, i) => (
          <g key={x}>
            <rect x={x} y="8" width="10" height={i === 3 ? 40 : 72} />
            {[2.5, 5, 7.5].map((d) => <path key={d} d={`M${x + d} 12 V${i === 3 ? 46 : 78}`} stroke={night ? "#3a3632" : "#b8ac90"} strokeWidth="0.6" />)}
            <rect x={x - 2.5} y="8" width="15" height="4" fill={night ? "#66625a" : "#e6dcc8"} />
            {i === 3 ? <path d={`M${x} 48 l3 -5 l3 4 l4 -3 V48 Z`} /> : <rect x={x - 2.5} y="76" width="15" height="4" fill={night ? "#66625a" : "#e6dcc8"} />}
            <rect x={x + 6.5} y="12" width="3.5" height={i === 3 ? 36 : 64} fill="#000" opacity="0.12" stroke="none" />
          </g>
        ))}
        <path d="M0 0 H140 V3 H0 Z" fill={night ? "#66625a" : "#e6dcc8"} />
        <path d="M70 0 l8 -6 l10 6 Z" />
        <path d="M100 48 L106 40 L112 46 Z" />
      </g>
      <g transform="translate(40 150)" fill={night ? "#5a5650" : "#cfc5b0"} stroke={night ? "#3a3632" : "#a89a7a"} strokeWidth="0.8">
        <path d="M0 64 V10 H14 V64 Z M46 64 V10 H60 V64 Z" />
        <path d="M0 10 C0 -14 60 -14 60 10 L46 10 C46 -2 14 -2 14 10 Z" />
      </g>
      <TreeLine y={210} colors={night ? ["#10201a", "#0c1914"] : ["#5a7a4a", "#4a6a3a"]} n={10} pines={2} />
      <Ground id={id} night={night} />
      {[[120, 252, 10], [330, 262, 14], [250, 244, 8]].map(([x, y, s]) => <rect key={x} x={x} y={y} width={s * 2} height={s} rx="1" fill={night ? "#5a5650" : "#cfc5b0"} transform={`rotate(${(x % 7) - 3} ${x} ${y})`} />)}
      {[[150, 224], [320, 230]].map(([x, y]) => <path key={x} d={`M${x} ${y} q4 -10 10 -12 q-2 8 4 12`} stroke={night ? "#1f3a2a" : "#5a8a3a"} strokeWidth="1.6" fill="none" />)}
    </g>
  ),
  spiaggia: (id, night) => (
    <g>
      {/* mare con l'orizzonte netto, una vela lontana, scogli, onde che arrivano sulla sabbia bagnata */}
      <rect y="178" width="400" height="44" fill={`url(#${id}water)`} />
      <rect y="178" width="400" height="2" fill="#fff" opacity="0.35" />
      <path d="M300 180 L322 168 L344 172 L366 164 L400 170 V180 Z" fill={night ? "#1c2a44" : "#7a9a8a"} />
      <path d="M322 168 L344 172 L366 164 L366 168 L344 175 L322 171 Z" fill="#000" opacity="0.15" />
      <g transform="translate(150 176)">
        <path d="M0 0 L0 -12 L7 0 Z" fill={night ? "#8a90a0" : "#f4f1ea"} />
        <path d="M-4 0 H9 L7 2.4 H-2 Z" fill={night ? "#3a3a44" : "#7a4a2a"} />
      </g>
      <g className="aa-shimmer" stroke="#fff" strokeOpacity="0.55" strokeWidth="1">
        {Array.from({ length: 22 }, (_, i) => <path key={i} d={`M${(i * 47) % 400} ${184 + (i % 6) * 6} h${6 + (i % 3) * 5}`} />)}
      </g>
      <path d="M0 214 C60 208 120 216 200 212 C280 208 340 214 400 210 V226 H0 Z" fill={night ? "#2a3a4a" : "#c9b07a"} opacity="0.9" />
      <path className="aa-wave" d="M0 214 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V219 H0 Z" fill="#fff" opacity="0.7" />
      <Ground id={id} night={night} y={222} grass="#c9b07a" flowers={false} blade={["#7a8a4a", "#a8b06a", "#e0dca0"]} density={0.1} />
      <g fill="none" strokeLinecap="round">
        {[246, 262, 280].map((y, i) => <path key={y} d={`M-10 ${y} q30 -${2 + i} 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0`} stroke="#fff" strokeOpacity={0.16 + i * 0.03} strokeWidth={1 + i * 0.4} />)}
      </g>
      {/* palme: tronco ad anelli che si piega, foglie piene con le foglioline, noci di cocco */}
      {[[112, 266, 1, 1], [292, 246, 0.66, -1]].map(([x, y, k, lean]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${k})`}>
          <ellipse cx={lean * 22} cy="2" rx="34" ry="4" fill="#000" opacity="0.18" />
          <g className="aa-tree">
            <path d={`M-4 0 C${-4 + lean * 4} -30 ${lean * 10} -60 ${lean * 22} -88 L${lean * 22 + 6} -86 C${lean * 14 + 6} -60 ${4 + lean * 4} -30 4 0 Z`} fill={night ? "#3a2a1e" : "#8a6a42"} />
            {Array.from({ length: 11 }, (_, i) => {
              const u = i / 11;
              const cx = lean * 22 * Math.pow(u, 1.4);
              return <path key={i} d={`M${cx - 4 + u * 1} ${-u * 86} q4 2 8 0`} stroke={night ? "#2a1e14" : "#5a4028"} strokeWidth="1.2" fill="none" />;
            })}
            <g transform={`translate(${lean * 22 + 3} -88)`}>
              {[-150, -110, -70, -30, 10, 50, 200].map((a, i) => {
                const r = (a * Math.PI) / 180;
                const ex = Math.cos(r) * 40;
                const ey = Math.sin(r) * 16 + 14;
                const leaf = `M0 0 Q${ex * 0.5} ${ey * 0.5 - 14} ${ex} ${ey} Q${ex * 0.55} ${ey * 0.5 - 6} 0 0 Z`;
                return (
                  <g key={a}>
                    <path d={leaf} fill={night ? "#1f3a2a" : i % 2 ? "#3f8a3a" : "#4f9a44"} />
                    {[0.3, 0.5, 0.7, 0.88].map((t) => <path key={t} d={`M${ex * t} ${(ey * t) - 14 * t * (1 - t) * 2} l${ex > 0 ? 3 : -3} 6`} stroke={night ? "#14281a" : "#2f6a2a"} strokeWidth="0.9" />)}
                  </g>
                );
              })}
              {[[-3, 4], [3, 5], [0, 7]].map(([cx, cy]) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="2.6" fill={night ? "#2a1e14" : "#6a4a2a"} />)}
            </g>
          </g>
        </g>
      ))}
      <g transform="translate(236 262)">
        <path d="M-18 4 C-20 -6 18 -6 16 4 Z" fill={night ? "#3a3a44" : "#8a8a84"} />
        <path d="M-10 -1 C-4 -4 4 -4 10 -1" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.2" fill="none" />
      </g>
      {[[230, 272], [262, 286], [180, 284]].map(([x, y], i) => <path key={x} d={`M${x} ${y} q4 -6 8 0 q-4 3 -8 0`} fill={["#f4c6a8", "#f4e6d4", "#e8b090"][i]} />)}
    </g>
  ),
  autunno: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#b3a48a"} near={night ? "#141f33" : "#9a7a5a"} night={night} />
      {Array.from({ length: 18 }, (_, i) => (
        <g key={i} transform={`translate(${i * 23 + (i % 2) * 6} ${210 - (i % 3) * 3})`}>
          <rect x="-1.5" y="-2" width="3" height="10" fill="#4a3322" />
          <ellipse cx="0" cy="-8" rx={9 + (i % 3)} ry={11 + (i % 2) * 2} fill={night ? "#2a1a10" : ["#d9822a", "#c4473d", "#e6b325", "#b0602a"][i % 4]} className="aa-tree" style={{ animationDelay: `${(i % 5) * 0.4}s` }} />
        </g>
      ))}
      <Ground id={id} night={night} grass="#c9a04a" flowers={false} blade={["#6a5424", "#a8883a", "#e6c46a"]} density={0.85} />
      <g className="aa-leaves">
        {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${(i * 61) % 400} ${(i * 37) % 260} q3 -3 6 0 q-3 3 -6 0`} fill={["#d9822a", "#c4473d", "#e6b325"][i % 3]} style={{ animationDelay: `${(i % 8) * 0.6}s` }} />)}
      </g>
      {Array.from({ length: 20 }, (_, i) => <circle key={i} cx={(i * 43) % 400} cy={250 + (i * 13) % 46} r="2" fill={["#d9822a", "#c4473d", "#e6b325"][i % 3]} opacity="0.8" />)}
    </g>
  ),
  // ---------- al chiuso ----------
  cascata: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#9db3c6"} near={night ? "#141f33" : "#6e8f86"} night={night} />
      {/* pareti di roccia ai lati della valle, la cascata che scende in mezzo */}
      <path d="M120 214 L128 120 L150 96 L168 104 L176 214 Z" fill={night ? "#262a34" : "#7d8085"} />
      <path d="M228 214 L232 110 L252 92 L274 108 L284 214 Z" fill={night ? "#22262f" : "#70747a"} />
      <path d="M150 96 L168 104 L172 150 L156 140 Z M252 92 L274 108 L270 150 L256 136 Z" fill="#fff" opacity="0.08" />
      <rect x="176" y="100" width="52" height="118" fill={`url(#${id}water)`} />
      <g className="aa-life-fallwater" stroke="#ffffff" strokeOpacity="0.65" strokeWidth="1.6" strokeLinecap="round">
        {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${180 + i * 4} ${100 + (i % 3) * 14} v${20 + (i % 4) * 8}`} />)}
      </g>
      <TreeLine y={206} colors={night ? ["#10201a", "#0c1914"] : ["#3b6a3e", "#2f5a35"]} n={20} />
      <ellipse cx="202" cy="222" rx="90" ry="14" fill={`url(#${id}water)`} />
      <g className="aa-life-spray" fill="#ffffff" opacity="0.55">
        {[178, 192, 206, 220].map((x, i) => <circle key={x} cx={x} cy={214 - (i % 2) * 3} r={6 + (i % 3) * 2} />)}
      </g>
      <Ground id={id} night={night} y={232} />
      {[60, 340].map((x, i) => <Pine key={x} x={x} y={238} h={70 + i * 12} c={night ? "#0c1914" : "#2f5a35"} />)}
    </g>
  ),
  porto: (id, night) => (
    <g>
      <rect y="186" width="400" height="56" fill={`url(#${id}water)`} />
      <rect y="186" width="400" height="1.6" fill="#fff" opacity="0.3" />
      {/* faro sul molo, case del porto, barche ormeggiate */}
      <g transform="translate(286 120)">
        <path d="M-7 70 L-4 0 H4 L7 70 Z" fill={night ? "#cfd2d8" : "#f4f1ea"} />
        {[14, 30, 46].map((y) => <rect key={y} x="-6" y={y} width="12" height="6" fill="#c4473d" />)}
        <rect x="-6" y="-8" width="12" height="9" fill={night ? "#ffe08a" : "#9fd8ff"} />
        <path d="M-8 -8 L0 -16 L8 -8 Z" fill="#3a3a44" />
        {night ? <path className="aa-life-beam" d="M0 -4 L-180 -30 L-180 22 Z" fill="#fff4c0" opacity="0.18" /> : null}
      </g>
      <g>
        {[[70, 162, 34, "#e8c89a"], [106, 158, 28, "#c46b2b"], [136, 164, 30, "#e9e4d8"], [168, 160, 26, "#a8c3a0"]].map(([x, y, w, c]) => (
          <g key={x as number}>
            <rect x={x as number} y={y as number} width={w as number} height={190 - (y as number)} fill={night ? "#4a4238" : (c as string)} />
            <path d={`M${(x as number) - 2} ${y} L${(x as number) + (w as number) / 2} ${(y as number) - 10} L${(x as number) + (w as number) + 2} ${y} Z`} fill="#a0503a" />
            <rect x={(x as number) + 6} y={(y as number) + 8} width="6" height="8" fill={night ? "#ffd27a" : "#5a3a22"} />
          </g>
        ))}
      </g>
      <path d="M0 190 H200 V196 H0 Z" fill={night ? "#3a3026" : "#8a7a62"} />
      {[[236, 214, 1], [150, 226, 0.8]].map(([x, y, k]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${k})`}>
          <g className="aa-life-bob" style={{ animationDelay: `${(x as number) % 3}s` }}>
            <path d="M-22 0 H22 L16 9 H-16 Z" fill={night ? "#2a2420" : "#7a4a2a"} />
            <path d="M-22 0 H22" stroke="#e6b325" strokeWidth="1.2" />
            <path d="M0 0 V-38" stroke="#3a2a1e" strokeWidth="1.4" />
            <path d="M1 -36 L20 -4 H1 Z" fill={night ? "#8a90a0" : "#f4f1ea"} />
          </g>
        </g>
      ))}
      <g className="aa-shimmer" stroke="#fff" strokeOpacity="0.5" strokeWidth="1">
        {Array.from({ length: 18 }, (_, i) => <path key={i} d={`M${(i * 61) % 400} ${200 + (i % 6) * 6} h${6 + (i % 3) * 4}`} />)}
      </g>
      <path d="M0 240 H400 V300 H0 Z" fill={night ? "#2a2420" : "#9a8a6e"} />
      {Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${i * 44} 240 V300`} stroke="#000" strokeOpacity="0.12" />)}
      <Ground id={id} night={night} y={262} grass="#8a9a5a" flowers={false} density={0.25} />
    </g>
  ),
  giardino: (id, night) => (
    <g>
      <Hills far={night ? "#1c2a44" : "#b6c6d6"} near={night ? "#141f33" : "#8aa69a"} night={night} />
      {/* portale di legno rosso, laghetto con il ponticello, ciliegi in fiore */}
      <g transform="translate(200 150)">
        <rect x="-44" y="0" width="7" height="62" fill={night ? "#5a2020" : "#c4302a"} />
        <rect x="37" y="0" width="7" height="62" fill={night ? "#5a2020" : "#c4302a"} />
        <path d="M-58 -8 Q0 -16 58 -8 L56 -2 Q0 -10 -56 -2 Z" fill={night ? "#3a1414" : "#2a1d14"} />
        <rect x="-48" y="8" width="96" height="6" fill={night ? "#5a2020" : "#c4302a"} />
      </g>
      <Ground id={id} night={night} y={214} grass="#7aa05a" />
      <ellipse cx="200" cy="236" rx="120" ry="16" fill={`url(#${id}water)`} />
      <path d="M140 236 Q200 206 260 236" stroke={night ? "#5a2020" : "#c4302a"} strokeWidth="4" fill="none" />
      <path d="M140 236 Q200 214 260 236" stroke={night ? "#3a1414" : "#8a2a22"} strokeWidth="1.2" fill="none" />
      {[[108, 218, 1.1], [300, 212, 1], [140, 206, 0.6]].map(([x, y, k]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${k})`}>
          <path d="M-3 0 C-4 -20 -10 -34 -18 -44 M-1 -16 C4 -30 14 -36 22 -40 M-2 -26 C-2 -40 2 -50 0 -60" stroke={night ? "#2a1a14" : "#5a3a2a"} strokeWidth="4" fill="none" strokeLinecap="round" />
          <g className="aa-tree">
            {[[-18, -48, 16], [0, -64, 18], [22, -44, 15], [-6, -46, 14], [12, -56, 14]].map(([cx, cy, r]) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={r} fill={night ? "#5a3a4a" : "#f7b8cc"} opacity="0.95" />)}
            {[[-12, -54], [6, -70], [18, -50], [-20, -42], [4, -48]].map(([cx, cy]) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="5" fill="#fff" opacity={night ? 0.15 : 0.5} />)}
          </g>
        </g>
      ))}
      {[70, 300, 330].map((x) => <g key={x} transform={`translate(${x} 262)`}><path d="M-8 0 C-8 -6 8 -6 8 0 Z" fill={night ? "#3a3a44" : "#9a9a94"} /></g>)}
    </g>
  ),
  mulino: (id, night) => (
    <g>
      <path d="M0 196 C80 168 160 176 220 186 C290 168 350 170 400 182 V230 H0 Z" fill={night ? "#1a2a22" : "#9ab85a"} />
      {/* il mulino a vento con le pale che girano piano */}
      <g transform="translate(252 120)">
        <path d="M-12 76 L-8 0 H8 L12 76 Z" fill={night ? "#4a4238" : "#e8dcc0"} />
        <path d="M-10 0 L0 -12 L10 0 Z" fill="#a0503a" />
        <rect x="-4" y="54" width="8" height="22" fill={night ? "#2a1d14" : "#5a3a22"} />
        <rect x="-3" y="20" width="6" height="7" fill={night ? "#ffd27a" : "#5a3a22"} />
        <g className="aa-life-sails">
          {[0, 90, 180, 270].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <path d="M0 0 L3 -44" stroke={night ? "#2a1d14" : "#5a3a22"} strokeWidth="1.6" />
              <path d="M3 -12 L12 -13 L10 -44 L3 -44 Z" fill={night ? "#6a6458" : "#f4f1ea"} stroke={night ? "#2a1d14" : "#8a6a42"} strokeWidth="0.6" />
            </g>
          ))}
          <circle r="3" fill="#3a2a1e" />
        </g>
      </g>
      {/* girasoli in file */}
      {Array.from({ length: 14 }, (_, i) => (
        <g key={i} transform={`translate(${12 + i * 29} ${214 + (i % 2) * 6})`}>
          <g className="aa-tree" style={{ animationDelay: `${(i % 5) * 0.4}s` }}>
            <path d="M0 0 V-14" stroke={night ? "#1f3a2a" : "#4f7a2a"} strokeWidth="1.4" />
            <circle cy="-16" r="5" fill={night ? "#6a5a2a" : "#f2c84b"} />
            <circle cy="-16" r="2.2" fill="#5a3a1a" />
          </g>
        </g>
      ))}
      <Ground id={id} night={night} y={226} grass="#8aaa4a" />
    </g>
  ),
  palestra: (id) => (
    <g>
      <rect width="400" height="214" fill="#c9cfd4" />
      <rect width="400" height="60" fill="#e6e9ec" />
      {/* soffitto con plafoniere accese */}
      {[50, 150, 250, 350].map((x) => (
        <g key={x}>
          <rect x={x - 28} y="10" width="56" height="7" rx="1.5" fill="#fffbe6" />
          <path d={`M${x - 28} 17 L${x - 60} 120 L${x + 60} 120 L${x + 28} 17 Z`} fill="#fffbe6" opacity="0.08" />
        </g>
      ))}
      <path d="M0 40 H400" stroke="#9aa3ad" strokeWidth="1.2" />
      {/* spalliere di legno a sinistra, finestre alte, rete verde dietro i paglioni */}
      <g>{Array.from({ length: 6 }, (_, i) => <rect key={i} x={6 + i * 9} y="70" width="3" height="144" fill="#b5895a" />)}{Array.from({ length: 12 }, (_, k) => <rect key={k} x="4" y={76 + k * 11.6} width="56" height="2.2" fill="#9a7048" />)}</g>
      {[110, 200, 290].map((x) => <g key={x}><rect x={x - 26} y="48" width="52" height="22" fill="#9fc4e0" stroke="#7a8590" strokeWidth="1.6" /><path d={`M${x} 48 V70 M${x - 26} 59 H${x + 26}`} stroke="#7a8590" strokeWidth="1" /></g>)}
      <rect x="80" y="120" width="320" height="94" fill="#2f5a3e" opacity="0.88" />
      {Array.from({ length: 30 }, (_, i) => <path key={i} d={`M${80 + i * 11} 120 V214`} stroke="#1f3a28" strokeWidth="0.5" opacity="0.6" />)}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => <path key={k} d={`M80 ${124 + k * 12} H400`} stroke="#1f3a28" strokeWidth="0.5" opacity="0.6" />)}
      {[120, 180, 240, 300, 360].map((x, i) => <IndoorButt key={x} x={x} y={190} s={0.9} n={i + 1} />)}
      <Floor c1="#c49a62" c2="#a87d48" lines="#3a2410" />
      {/* righe del campo e linea di tiro */}
      <path d="M0 236 H400" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.6" />
      <path d="M40 262 L200 216 L360 262" stroke="#e0533a" strokeOpacity="0.5" strokeWidth="1.2" fill="none" />
      <rect y="280" width="400" height="4" fill="#e6c84a" opacity="0.8" />
    </g>
  ),
  palazzetto: (id) => (
    <g>
      <rect width="400" height="214" fill="#1d2a3a" />
      {/* capriate d'acciaio e fari */}
      {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${i * 50} 0 L${i * 50 + 25} 34 L${i * 50 + 50} 0`} stroke="#5d6b7a" strokeWidth="1.4" fill="none" />)}
      <path d="M0 34 H400 M0 2 H400" stroke="#6b7a8a" strokeWidth="2" />
      {[40, 120, 200, 280, 360].map((x) => <g key={x}><circle cx={x} cy="40" r="4" fill="#fffbe6" /><path d={`M${x - 4} 42 L${x - 46} 214 L${x + 46} 214 L${x + 4} 42 Z`} fill="#fffbe6" opacity="0.05" /></g>)}
      {/* tribune con il pubblico */}
      {[0, 1, 2, 3, 4].map((r) => (
        <g key={r}>
          <rect y={62 + r * 13} width="400" height="13" fill={r % 2 ? "#2a3a4e" : "#24344a"} />
          {Array.from({ length: 46 }, (_, i) => <circle key={i} cx={4 + i * 8.7 + (r % 2) * 4} cy={68 + r * 13} r="2.6" fill={["#c4473d", "#e6c84a", "#3f8fd0", "#f4f1ea", "#3fae6a", "#8a5bc4"][(i * 7 + r * 3) % 6]} opacity="0.75" />)}
        </g>
      ))}
      {/* tabellone luminoso */}
      <rect x="150" y="44" width="100" height="16" rx="2" fill="#0a0f14" stroke="#3a4a5a" />
      <text x="200" y="56" textAnchor="middle" fontSize="9" fontWeight="700" fill="#ffd23f" fontFamily="monospace">10 · 9 · X</text>
      <rect y="127" width="400" height="87" fill="#16202c" />
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={i * 70} y="127" width="66" height="6" fill={["#2f6fbe", "#c4473d", "#e6c84a", "#3fae6a", "#2f6fbe", "#c4473d"][i]} opacity="0.85" />)}
      {[70, 140, 210, 280, 350].map((x, i) => <IndoorButt key={x} x={x} y={190} s={0.85} n={i + 1} />)}
      <Floor c1="#2f5f8a" c2="#234a6c" lines="#fff" planks={false} />
      {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${105 + i * 70 * 0.28 * 2.5} 214 L${-40 + i * 96} 300`} stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />)}
      <rect y="268" width="400" height="5" fill="#f4f1ea" opacity="0.85" />
    </g>
  ),
  capannone: (id) => (
    <g>
      <rect width="400" height="214" fill="#6a4a2e" />
      {Array.from({ length: 20 }, (_, i) => <rect key={i} x={i * 20} y="0" width="19" height="214" fill={i % 2 ? "#6e4d30" : "#654529"} />)}
      {Array.from({ length: 20 }, (_, i) => <path key={i} d={`M${i * 20} 0 V214`} stroke="#3a2614" strokeWidth="0.8" />)}
      {/* capriate di legno e lampade calde */}
      <path d="M0 30 H400" stroke="#3e2a18" strokeWidth="8" />
      {[60, 200, 340].map((x) => <g key={x}><path d={`M${x - 60} 30 L${x} 4 L${x + 60} 30`} stroke="#3e2a18" strokeWidth="5" fill="none" /><path d={`M${x} 30 V56`} stroke="#222" strokeWidth="0.8" /><path d={`M${x - 8} 56 h16 l-4 -6 h-8 Z`} fill="#2a2a2a" /><circle cx={x} cy="58" r="3" fill="#ffd27a" /><path d={`M${x - 8} 58 L${x - 70} 214 L${x + 70} 214 L${x + 8} 58 Z`} fill="#ffcf7a" opacity="0.1" /></g>)}
      {/* balle di fieno come battifreccia */}
      {[0, 1].map((row) => Array.from({ length: 9 }, (_, i) => (
        <g key={`${row}${i}`}>
          <rect x={i * 46 - 6} y={170 - row * 26} width="44" height="26" rx="3" fill={row ? "#d8b25a" : "#caa04a"} stroke="#8a6a2a" strokeWidth="0.8" />
          {[0, 1, 2].map((k) => <path key={k} d={`M${i * 46 - 2} ${175 - row * 26 + k * 7} h36`} stroke="#a87e34" strokeWidth="0.6" />)}
        </g>
      )))}
      {[110, 200, 290].map((x) => <g key={x}>{[8, 6, 4, 2.4, 1].map((r, k) => <circle key={r} cx={x} cy={170} r={r} fill={["#f4f1ea", "#14181c", "#2f7fd0", "#d0302a", "#f2c84b"][k]} />)}</g>)}
      <Floor c1="#8a6a42" c2="#6e5232" lines="#2a1a0a" planks={false} />
      {Array.from({ length: 40 }, (_, i) => <path key={i} d={`M${rnd(i) * 400} ${220 + rnd(i + 9) * 78} l${4 + rnd(i + 3) * 6} ${-1 - rnd(i + 5) * 2}`} stroke="#d8b25a" strokeWidth="0.8" opacity="0.7" />)}
    </g>
  ),
  salone: (id) => (
    <g>
      <rect width="400" height="214" fill="#6e6a64" />
      {/* muro di pietra a blocchi */}
      {Array.from({ length: 12 }, (_, r) => Array.from({ length: 11 }, (_, i) => (
        <rect key={`${r}-${i}`} x={i * 38 - (r % 2) * 19} y={r * 18} width="37" height="17" rx="1.5" fill={["#7a7670", "#726e68", "#827d76"][(i + r) % 3]} stroke="#4e4a46" strokeWidth="0.6" />
      )))}
      {/* finestre ad arco con la luce che entra */}
      {[100, 300].map((x) => (
        <g key={x}>
          <path d={`M${x - 16} 110 V60 A16 16 0 0 1 ${x + 16} 60 V110 Z`} fill="#bcd8ee" stroke="#3e3a36" strokeWidth="2" />
          <path d={`M${x} 44 V110 M${x - 16} 80 H${x + 16}`} stroke="#3e3a36" strokeWidth="1.2" />
          <path d={`M${x - 16} 110 L${x - 60} 214 L${x + 10} 214 L${x + 16} 110 Z`} fill="#fff6d8" opacity="0.1" />
        </g>
      ))}
      {/* stendardi e torce */}
      {[40, 200, 360].map((x, i) => (
        <g key={x}>
          <path d={`M${x - 14} 20 H${x + 14} V86 L${x} 78 L${x - 14} 86 Z`} fill={["#8a2f2f", "#1f3a5f", "#2f5a3e"][i]} />
          <path d={`M${x - 14} 20 H${x + 14}`} stroke="#d9b45a" strokeWidth="2" />
          <circle cx={x} cy="48" r="6" fill="none" stroke="#d9b45a" strokeWidth="1.4" />
          <path d={`M${x - 4} 52 L${x} 42 L${x + 4} 52`} stroke="#d9b45a" strokeWidth="1.2" fill="none" />
        </g>
      ))}
      {[150, 250].map((x) => (
        <g key={x}>
          <circle cx={x} cy="96" r="22" fill="#ffb04a" opacity="0.14" />
          <path d={`M${x - 3} 104 h6 l-1 14 h-4 Z`} fill="#3a2a1e" />
          <path d={`M${x} 90 C${x + 5} 96 ${x + 4} 103 ${x} 104 C${x - 4} 103 ${x - 5} 96 ${x} 90 Z`} fill="#ffb04a" className="aa-flame" />
          <path d={`M${x} 95 C${x + 2} 98 ${x + 2} 102 ${x} 103 C${x - 2} 102 ${x - 2} 98 ${x} 95 Z`} fill="#fff1a8" />
        </g>
      ))}
      {[90, 200, 310].map((x) => <g key={x}><path d={`M${x - 8} 190 L${x - 12} 214 M${x + 8} 190 L${x + 12} 214`} stroke="#3a2614" strokeWidth="1.8" /><circle cx={x} cy="180" r="16" fill="#d8b25a" stroke="#8a6a2a" strokeWidth="1" />{[11, 8, 5, 2.4].map((r, k) => <circle key={r} cx={x} cy="180" r={r} fill={["#f4f1ea", "#2f7fd0", "#d0302a", "#f2c84b"][k]} />)}</g>)}
      <Floor c1="#6a4a30" c2="#573c26" lines="#1a0e06" />
      <path d="M120 300 L170 214 H230 L280 300 Z" fill="#7a1f24" opacity="0.75" />
      <path d="M128 300 L174 214 M272 300 L226 214" stroke="#d9b45a" strokeWidth="1.2" opacity="0.8" />
    </g>
  ),
};

/** Miniatura di un'ambientazione per la scelta nelle impostazioni. */
export function SceneThumb({ scene, sky, className = "h-16 w-24" }: { scene: string; sky: Sky; className?: string }) {
  return (
    <span className={`relative block overflow-hidden rounded-xl ${className}`}>
      <SceneBackdrop sky={sky} scene={scene} id={`th${scene}`} />
    </span>
  );
}

/**
 * Luce dell'ambiente sull'arciere: tinta dell'ora (caldo al tramonto, blu di notte, grigio col
 * cielo coperto) e un filo di luce sul bordo rivolto al sole, così la figura vettoriale si
 * fonde con lo sfondo invece di sembrare incollata sopra. Filtri SVG usati via CSS.
 */
export type LightMode = "day" | "dawn" | "dusk" | "night" | "grey";
export function lightMode(sky: Sky): LightMode {
  if (sky.tod === "notte") return "night";
  if (sky.weather !== "sereno") return "grey";
  if (sky.tod === "tramonto") return "dusk";
  if (sky.tod === "mattina") return "dawn";
  return "day";
}
const LIGHT: Record<LightMode, { m: string; rim: string; rimA: number }> = {
  day: { m: "1.04 0 0 0 0.01  0 1.03 0 0 0.01  0 0 1 0 0  0 0 0 1 0", rim: "#fff3d6", rimA: 0.55 },
  dawn: { m: "1.04 0.02 0 0 0.02  0 1 0 0 0.01  0 0 0.98 0 0.01  0 0 0 1 0", rim: "#ffe2bd", rimA: 0.5 },
  dusk: { m: "1.06 0.06 0 0 0.03  0 0.93 0.02 0 0.01  0 0 0.78 0 0  0 0 0 1 0", rim: "#ffb56a", rimA: 0.75 },
  night: { m: "0.62 0.04 0.03 0 0  0.04 0.66 0.06 0 0  0.05 0.08 0.84 0 0.02  0 0 0 1 0", rim: "#9fb8ff", rimA: 0.4 },
  grey: { m: "0.86 0.05 0.04 0 0  0.04 0.88 0.05 0 0  0.04 0.05 0.9 0 0.01  0 0 0 1 0", rim: "#dfe8f2", rimA: 0.25 },
};
export function ArcherLightDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        {(Object.keys(LIGHT) as LightMode[]).flatMap((mode) =>
          ([-1, 1] as const).map((dir) => {
            const L = LIGHT[mode];
            return (
              <filter key={`${mode}${dir}`} id={`aa-lit-${mode}-${dir < 0 ? "l" : "r"}`} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
                <feColorMatrix in="SourceGraphic" type="matrix" values={L.m} result="graded" />
                {/* niente alone sui contorni: solo la tinta dell'ora, il tratto resta pulito */}
                <feComposite in="graded" in2="SourceGraphic" operator="in" />
              </filter>
            );
          }),
        )}
      </defs>
    </svg>
  );
}
