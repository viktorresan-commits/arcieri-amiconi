/**
 * La vita delle ambientazioni disegnate: farfalle, lucciole, foglie e petali che cadono, uccelli
 * che planano, luccichii sull'acqua, pulviscolo nella luce, una barca a vela, il mulino che gira.
 * Tutto in coordinate della scena (400×300) e mosso da animazioni CSS: la scena sotto non si
 * ridisegna mai.
 */
import type { SceneId } from "@/lib/arcieri/scenes";

const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const f = (n: number) => n.toFixed(1);

/**
 * Uccello che batte davvero le ali: le punte salgono e scendono attorno al corpo (animazione del
 * tracciato, non uno schiacciamento). x, y = punta sinistra; a = mezza apertura di un'ala.
 */
export function FlapBird({ x, y, a, dur = 0.5, delay = 0, stroke = "#2a3a46", width = 1.3, opacity }: { x: number; y: number; a: number; dur?: number; delay?: number; stroke?: string; width?: number; opacity?: number }) {
  const d = (tip: number, ctl: number) => `M${f(x)} ${f(y + tip * a)} Q${f(x + a)} ${f(y + ctl * a)} ${f(x + 2 * a)} ${f(y)} Q${f(x + 3 * a)} ${f(y + ctl * a)} ${f(x + 4 * a)} ${f(y + tip * a)}`;
  const up = d(-0.6, -1.3);
  const mid = d(0, -0.8);
  const down = d(0.75, 0.15);
  return (
    <path d={mid} stroke={stroke} strokeWidth={width} strokeOpacity={opacity} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <animate attributeName="d" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" values={`${up};${mid};${down};${mid};${up}`} keyTimes="0;0.3;0.5;0.7;1" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" />
    </path>
  );
}

type Life = {
  /** farfalle di giorno */
  butterflies?: number;
  /** foglie o petali che cadono: quante e di che colori */
  fall?: { n: number; colors: string[]; petals?: boolean };
  /** uccelli che planano nel cielo */
  birds?: "gabbiani" | "aquila" | "rondini";
  /** fascia d'acqua dove luccica (y da, a) */
  water?: [number, number];
  /** pulviscolo nei raggi di luce */
  motes?: boolean;
  /** lucciole di notte */
  fireflies?: boolean;
  /** barca a vela lontana (quota) */
  boat?: number;
  /** foschia bassa che scorre */
  mist?: number;
};

const LIFE: Partial<Record<SceneId, Life>> = {
  campo: { butterflies: 3, fireflies: true, birds: "rondini" },
  foresta: { butterflies: 2, fall: { n: 7, colors: ["#6f9a3a", "#8ab04a", "#4f7a2a"] }, motes: true, fireflies: true },
  castello: { butterflies: 2, birds: "rondini", fireflies: true, mist: 196 },
  palazzo: { butterflies: 3, birds: "rondini", fireflies: true },
  montagna: { birds: "aquila", mist: 186, fireflies: true },
  lago: { butterflies: 2, water: [196, 222], boat: 204, fireflies: true, mist: 200 },
  deserto: { birds: "aquila", mist: 206 },
  villaggio: { butterflies: 2, birds: "rondini", fireflies: true },
  neve: { birds: "rondini", mist: 200 },
  campagna: { butterflies: 4, birds: "rondini", fireflies: true },
  torneo: { butterflies: 2, birds: "rondini", fireflies: true },
  rovine: { butterflies: 2, fall: { n: 4, colors: ["#c9b08a", "#a3b18a"] }, motes: true, fireflies: true },
  spiaggia: { birds: "gabbiani", water: [168, 206], boat: 182 },
  autunno: { fall: { n: 9, colors: ["#d9822a", "#c4473d", "#e6b325", "#9a5a22"] }, birds: "rondini", fireflies: true },
  cascata: { butterflies: 2, water: [214, 238], mist: 205, motes: true, fireflies: true },
  porto: { birds: "gabbiani", water: [196, 236], boat: 200 },
  giardino: { fall: { n: 10, colors: ["#ffc2d6", "#ffd9e6", "#f7a8c4"], petals: true }, butterflies: 2, water: [228, 246], fireflies: true },
  mulino: { butterflies: 4, birds: "rondini", fireflies: true },
};

const WINGS = ["#ffd166", "#ff8fa3", "#8ecae6", "#f4f1ea", "#e76f51", "#b8a1ff"];

export function SceneLife({ scene, night, rain, dusk }: { scene: SceneId; night: boolean; rain: boolean; dusk: boolean }) {
  const life = LIFE[scene];
  if (!life) return null;
  const day = !night && !rain;
  return (
    <g aria-hidden className="aa-life">
      {/* foschia bassa che scorre piano */}
      {life.mist != null ? (
        <g className="aa-life-mist" opacity={night ? 0.12 : rain ? 0.32 : 0.22}>
          {[0, 1, 2].map((i) => <ellipse key={i} cx={60 + i * 150} cy={life.mist! + (i % 2) * 6} rx={110} ry={9} fill={night ? "#9fb4d8" : "#ffffff"} />)}
        </g>
      ) : null}
      {/* luccichii sull'acqua */}
      {life.water && !rain ? (
        <g fill={night ? "#dfe6ff" : "#ffffff"}>
          {Array.from({ length: 14 }, (_, i) => {
            const x = 10 + rnd(i * 3.1 + 7) * 380;
            const y = life.water![0] + rnd(i * 5.7 + 1) * (life.water![1] - life.water![0]);
            return <path key={i} className="aa-life-glint" style={{ animationDelay: `${f(rnd(i + 9) * 3)}s` }} d={`M${f(x - 3)} ${f(y)} H${f(x + 3)} M${f(x)} ${f(y - 1.2)} V${f(y + 1.2)}`} stroke={night ? "#dfe6ff" : "#ffffff"} strokeWidth="0.7" />;
          })}
        </g>
      ) : null}
      {/* barca a vela che attraversa piano */}
      {life.boat != null && !rain ? (
        <g className="aa-life-boat" style={{ animationDuration: "90s" }}>
          <g transform={`translate(-30 ${life.boat})`}>
            <g className="aa-life-bob">
              <path d="M-9 0 H9 L6 4 H-6 Z" fill={night ? "#2a2420" : "#6b4224"} />
              <path d="M0 -1 V-17" stroke={night ? "#2a2420" : "#3a2a1e"} strokeWidth="0.8" />
              <path d="M0.6 -16 L9 -2 H0.6 Z" fill={night ? "#7a8296" : "#f4f1ea"} />
              <path d="M-0.6 -13 L-6 -2 H-0.6 Z" fill={night ? "#5a6276" : "#e8dcc0"} />
            </g>
          </g>
        </g>
      ) : null}
      {/* uccelli che planano */}
      {life.birds && day ? (
        life.birds === "aquila" ? (
          <g className="aa-life-soar">
            <g transform="translate(250 70)">
              <path d="M-16 2 Q-8 -6 0 1 Q8 -6 16 2 Q8 -2 0 4 Q-8 -2 -16 2 Z" fill="#3a2a1e" opacity="0.8">
                {/* l'aquila plana e ogni tanto dà due colpi d'ala */}
                <animate attributeName="d" dur="3.2s" repeatCount="indefinite" keyTimes="0;0.55;0.65;0.75;0.85;0.95;1" values="M-16 2 Q-8 -6 0 1 Q8 -6 16 2 Q8 -2 0 4 Q-8 -2 -16 2 Z;M-16 2 Q-8 -6 0 1 Q8 -6 16 2 Q8 -2 0 4 Q-8 -2 -16 2 Z;M-15 -7 Q-8 -9 0 1 Q8 -9 15 -7 Q8 -3 0 4 Q-8 -3 -15 -7 Z;M-15 9 Q-8 0 0 1 Q8 0 15 9 Q8 2 0 4 Q-8 2 -15 9 Z;M-15 -7 Q-8 -9 0 1 Q8 -9 15 -7 Q8 -3 0 4 Q-8 -3 -15 -7 Z;M-15 9 Q-8 0 0 1 Q8 0 15 9 Q8 2 0 4 Q-8 2 -15 9 Z;M-16 2 Q-8 -6 0 1 Q8 -6 16 2 Q8 -2 0 4 Q-8 -2 -16 2 Z" />
              </path>
            </g>
          </g>
        ) : (
          <g className="aa-life-glide" style={{ animationDuration: life.birds === "gabbiani" ? "38s" : "26s" }}>
            {[[0, 60], [18, 52], [34, 66]].map(([dx, y], i) => (
              <FlapBird key={i} x={dx - 20} y={y} a={4} dur={life.birds === "gabbiani" ? 0.9 : 0.45} delay={i * 0.13} stroke={life.birds === "gabbiani" ? "#f4f1ea" : "#2a3a46"} />
            ))}
          </g>
        )
      ) : null}
      {/* pulviscolo dorato nei raggi di luce */}
      {life.motes && day ? (
        <g fill="#fff6c8">
          {Array.from({ length: 16 }, (_, i) => <circle key={i} className="aa-life-mote" style={{ animationDelay: `${f(rnd(i * 2.3) * 8)}s`, animationDuration: `${f(7 + rnd(i * 4.1) * 6)}s` }} cx={f(40 + rnd(i * 1.7) * 320)} cy={f(110 + rnd(i * 3.9) * 110)} r={f(0.6 + rnd(i) * 0.8)} opacity="0.8" />)}
        </g>
      ) : null}
      {/* foglie o petali che cadono */}
      {life.fall && !rain ? (
        <g>
          {Array.from({ length: life.fall.n }, (_, i) => {
            const c = life.fall!.colors[i % life.fall!.colors.length];
            return (
              <g key={i} className="aa-life-fall" style={{ animationDelay: `${f(rnd(i * 6.1) * 10)}s`, animationDuration: `${f(8 + rnd(i * 2.9) * 6)}s` }}>
                <path transform={`translate(${f(20 + rnd(i * 1.3) * 380)} ${f(20 + rnd(i * 7.7) * 60)})`} d={life.fall!.petals ? "M0 0 C1.6 -1.6 3.2 -0.6 2.6 1 C2 2.4 0.4 2 0 0 Z" : "M0 0 C2 -2.6 5 -1.6 5 0 C5 1.6 2 2.6 0 0 Z"} fill={c} opacity={night ? 0.55 : 0.92} />
              </g>
            );
          })}
        </g>
      ) : null}
      {/* farfalle */}
      {life.butterflies && day && !dusk ? (
        <g>
          {Array.from({ length: life.butterflies }, (_, i) => {
            const x = 50 + rnd(i * 9.1 + 3) * 300;
            const y = 222 + rnd(i * 4.3 + 1) * 40;
            const c = WINGS[Math.floor(rnd(i * 2.7) * WINGS.length)];
            return (
              <g key={i} className="aa-life-flutter" style={{ animationDelay: `${f(-rnd(i * 3.3) * 12)}s`, animationDuration: `${f(10 + rnd(i * 5.1) * 8)}s` }}>
                <g transform={`translate(${f(x)} ${f(y)})`}>
                  <path className="aa-life-flap" d="M0 0 C-3 -3.4 -5.6 -2.4 -4.6 0.4 C-5.4 2.6 -2.4 2.8 0 0 Z M0 0 C3 -3.4 5.6 -2.4 4.6 0.4 C5.4 2.6 2.4 2.8 0 0 Z" fill={c} stroke="#1d1f22" strokeWidth="0.3" />
                  <path d="M0 -1.4 V1.6" stroke="#1d1f22" strokeWidth="0.6" />
                </g>
              </g>
            );
          })}
        </g>
      ) : null}
      {/* lucciole */}
      {life.fireflies && (night || dusk) && !rain ? (
        <g>
          {Array.from({ length: 14 }, (_, i) => <circle key={i} className="aa-firefly-p" style={{ animationDelay: `${f(rnd(i * 3.7) * 5)}s`, animationDuration: `${f(4 + rnd(i * 1.9) * 4)}s` }} cx={f(20 + rnd(i * 2.2) * 360)} cy={f(220 + rnd(i * 8.4) * 60)} r={f(1 + rnd(i) * 0.8)} fill="#f0f59a" opacity="0.9" />)}
        </g>
      ) : null}
    </g>
  );
}
