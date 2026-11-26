/**
 * Calzature dell'arciere, di lato e di fronte: suola con tacco e bordo cucito, punta lucida, pieghe di cuoio,
 * lacci, fibbie di ottone, risvolti e pellicce. Ogni modello ha il suo carattere (stivale da ranger, scarponcino
 * da montagna, mocassino legato alla gamba, sandalo da gladiatore).
 */
import type { AvatarLook } from "@/lib/arcieri/avatar";

type P = { x: number; y: number };
const f = (n: number) => n.toFixed(1);
const OUT = "#2a1d14";
const SOLE = "#1d1611";
const STITCH = "#e8d9b0";
const BRASS = "#c9a24a";
const BRASS_HI = "#f6e3a1";
const STEEL = "#b9c0c8";
const FUR = "#e2d4b8";
const FUR_D = "#b29d78";

function shade(hex: string, k: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, "0")}`;
}

/** quanto sale la calzatura sulla gamba, di lato (dalla caviglia) */
const SIDE_TOP: Record<string, number> = { sportive: 6, stivaletti: 17, stivali: 46, "stivali-risvolto": 54, "stivali-alti": 64, "stivali-pelliccia": 50, mocassini: 7, scarponi: 24, sandali: 4 };

/** fibbia d'ottone su un cinturino */
function Buckle({ x, y, w = 5, h = 7 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={f(x)} y={f(y)} width={f(w)} height={f(h)} rx="1" fill="none" stroke="#5c4316" strokeWidth="2.1" />
      <rect x={f(x)} y={f(y)} width={f(w)} height={f(h)} rx="1" fill="none" stroke={BRASS} strokeWidth="1.3" />
      <path d={`M${f(x + 0.6)} ${f(y + 0.7)} h${f(w - 1.4)}`} stroke={BRASS_HI} strokeWidth="0.55" strokeLinecap="round" />
      <path d={`M${f(x + w / 2)} ${f(y + 0.6)} v${f(h - 1.2)}`} stroke={BRASS} strokeWidth="0.8" />
    </g>
  );
}

/** bordo di pelliccia: soffice in alto e in basso, con ciuffi */
function FurBand({ x0, x1, y, h }: { x0: number; x1: number; y: number; h: number }) {
  const n = Math.max(4, Math.round((x1 - x0) / 4.2));
  const step = (x1 - x0) / n;
  const top = Array.from({ length: n }, (_, i) => `q${f(step / 2)} ${f(-2.6 - (i % 2) * 0.8)} ${f(step)} 0`).join(" ");
  const bot = Array.from({ length: n }, (_, i) => `q${f(-step / 2)} ${f(2.4 + (i % 2) * 0.9)} ${f(-step)} 0`).join(" ");
  return (
    <g>
      <path d={`M${f(x0)} ${f(y)} ${top} L${f(x1)} ${f(y + h)} ${bot} Z`} fill={FUR} stroke={OUT} strokeOpacity="0.55" strokeWidth="0.8" />
      {Array.from({ length: n * 2 }, (_, i) => {
        const x = x0 + (i + 0.5) * (step / 2);
        const yy = y + 1.5 + (i % 3) * (h / 4);
        return <path key={i} d={`M${f(x)} ${f(yy)} q${f(0.8)} ${f(1.6)} ${f(-0.3)} ${f(3)}`} stroke={FUR_D} strokeWidth="0.6" fill="none" strokeLinecap="round" opacity="0.8" />;
      })}
      <path d={`M${f(x0 + 1)} ${f(y + 1)} H${f(x1 - 1)}`} stroke="#fff" strokeOpacity="0.35" strokeWidth="1.1" strokeLinecap="round" />
      <path d={`M${f(x0)} ${f(y + h)} H${f(x1)}`} stroke="#000" strokeOpacity="0.2" strokeWidth="1.6" />
    </g>
  );
}

/** Calzatura di profilo (la punta verso destra), sulla caviglia `a`. */
export function SideShoe({ look, a, uid, skin }: { look: AvatarLook; a: P; uid: string; skin: string }) {
  const sc = look.shoes;
  const fw = look.footwear;
  const dk = shade(sc, -0.45);
  const lt = shade(sc, 0.3);
  const line = shade(sc, -0.62);
  const X = (d: number) => f(a.x + d);
  const Y = (d: number) => f(a.y + d);
  const top = SIDE_TOP[fw] ?? 6;
  const low = top < 12;
  const sandal = fw === "sandali";
  const hiker = fw === "scarponi";
  const sportive = fw === "sportive";
  // sagoma: gambale (se c'è), collo del piede, punta arrotondata, tallone
  const toe = `C${X(12.5)} ${Y(-1.6)} ${X(19.5)} ${Y(0.4)} ${X(22.8)} ${Y(4)} Q${X(25.6)} ${Y(6.8)} ${X(23.6)} ${Y(8.4)} L${X(-10.6)} ${Y(8.4)} C${X(-12.9)} ${Y(6.4)} ${X(-12.6)} ${Y(-2.6)}`;
  const flare = fw === "stivali-risvolto" ? 1.6 : fw === "stivali-alti" ? 1.2 : 0.6;
  const body = low
    ? `M${X(-10.6)} ${Y(-top - 1)} C${X(-5)} ${Y(-top - 2.6)} ${X(1)} ${Y(-top - 0.4)} ${X(5)} ${Y(-4.4)} C${X(10)} ${Y(-2.6)} ${X(19.5)} ${Y(0.4)} ${X(22.8)} ${Y(4)} Q${X(25.6)} ${Y(6.8)} ${X(23.6)} ${Y(8.4)} L${X(-10.6)} ${Y(8.4)} C${X(-12.9)} ${Y(6.4)} ${X(-12.6)} ${Y(-2.6)} ${X(-10.6)} ${Y(-top - 1)} Z`
    : `M${X(-10 - flare)} ${Y(-top)} L${X(9 + flare)} ${Y(-top)} L${X(8.6)} ${Y(-3)} ${toe} ${X(-10.4)} ${Y(-8)} Z`;
  const soleH = hiker ? 4.6 : sportive ? 3.8 : 2.8;
  const heelH = hiker ? 5.2 : sportive ? 3.8 : 4.2;
  const sole = `M${X(-12.4)} ${Y(8)} L${X(23.8)} ${Y(8)} Q${X(26.4)} ${Y(8.5)} ${X(25.8)} ${Y(8 + soleH * 0.6)} Q${X(25.2)} ${Y(8 + soleH)} ${X(23)} ${Y(8 + soleH)} L${X(-2.6)} ${Y(8 + soleH)} L${X(-2.6)} ${Y(8 + heelH)} L${X(-12.8)} ${Y(8 + heelH)} Z`;

  if (sandal) {
    // piede nudo: dita, unghia dell'alluce, suola di cuoio e lacci alla schiava fin sopra la caviglia
    return (
      <g>
        <path d={`M${X(-9)} ${Y(-5)} C${X(-2)} ${Y(-5.6)} ${X(8)} ${Y(-2.6)} ${X(15)} ${Y(1.4)} C${X(19)} ${Y(3.4)} ${X(23.4)} ${Y(4)} ${X(24)} ${Y(6.2)} Q${X(24.4)} ${Y(8.2)} ${X(22)} ${Y(8.2)} L${X(-10.4)} ${Y(8.2)} C${X(-12.6)} ${Y(5.6)} ${X(-12)} ${Y(-1.6)} ${X(-9)} ${Y(-5)} Z`} fill={skin} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.2" />
        <path d={`M${X(-9)} ${Y(1)} C${X(0)} ${Y(-1)} ${X(10)} ${Y(2)} ${X(20)} ${Y(5)}`} stroke="#000" strokeOpacity="0.12" strokeWidth="2.6" fill="none" />
        {[18.4, 20.6, 22.6].map((x) => <path key={x} d={`M${X(x)} ${Y(4.2)} q0.6 1.8 0 3.6`} stroke={shade(skin, -0.35)} strokeWidth="0.6" fill="none" />)}
        <path d={`M${X(21.4)} ${Y(4.4)} q1.8 -0.4 2.2 1.2`} stroke="#fff" strokeOpacity="0.55" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        <path d={`M${X(-11.6)} ${Y(8)} L${X(24.8)} ${Y(8)} Q${X(26.2)} ${Y(9)} ${X(24.6)} ${Y(10.6)} L${X(-12)} ${Y(10.6)} Z`} fill={shade(sc, -0.15)} stroke={OUT} strokeOpacity="0.7" strokeWidth="0.9" />
        <path d={`M${X(-11)} ${Y(9.2)} H${X(24)}`} stroke={STITCH} strokeOpacity="0.4" strokeWidth="0.5" strokeDasharray="1.2 1" />
        <g stroke={sc} strokeWidth="2.2" strokeLinecap="round" fill="none">
          <path d={`M${X(-8)} ${Y(-22)} L${X(5)} ${Y(-13)} M${X(5)} ${Y(-22)} L${X(-8)} ${Y(-13)} M${X(-8)} ${Y(-13)} L${X(5)} ${Y(-4)} M${X(5)} ${Y(-13)} L${X(-8)} ${Y(-4)}`} />
          <path d={`M${X(-9)} ${Y(-3)} C${X(-2)} ${Y(-4)} ${X(4)} ${Y(-2)} ${X(9)} ${Y(1)} M${X(9)} ${Y(1)} L${X(19)} ${Y(4.6)}`} />
        </g>
        <path d={`M${X(-8)} ${Y(-22)} L${X(5)} ${Y(-13)} M${X(5)} ${Y(-22)} L${X(-8)} ${Y(-13)}`} stroke={shade(sc, 0.35)} strokeWidth="0.6" strokeLinecap="round" />
        {[-22, -13, -4].map((d) => <circle key={d} cx={X(-1.5)} cy={Y(d + 4.5)} r="1.1" fill={BRASS} stroke="#5c4316" strokeWidth="0.4" />)}
      </g>
    );
  }

  return (
    <g>
      {/* gambale e tomaia */}
      <path d={body} fill={`url(#${uid}boot)`} stroke={OUT} strokeOpacity="0.88" strokeWidth="1.5" strokeLinejoin="round" />
      {/* volume: luce sul gambale, ombra sul retro, ombra sotto il collo del piede */}
      {!low ? <path d={`M${X(-6)} ${Y(-top + 6)} L${X(-5.4)} ${Y(-6)}`} stroke="#fff" strokeOpacity="0.17" strokeWidth="2.6" strokeLinecap="round" /> : null}
      {!low ? <path d={`M${X(7.2)} ${Y(-top + 3)} L${X(7)} ${Y(-4)}`} stroke="#000" strokeOpacity="0.2" strokeWidth="2.4" strokeLinecap="round" /> : null}
      <path d={`M${X(-9)} ${Y(5.6)} C${X(0)} ${Y(4.4)} ${X(12)} ${Y(5.4)} ${X(22)} ${Y(7.2)}`} stroke="#000" strokeOpacity="0.22" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* puntale: cucitura, riflesso */}
      <path d={`M${X(12.4)} ${Y(-0.8)} Q${X(15)} ${Y(3.6)} ${X(13.4)} ${Y(7.8)}`} stroke={line} strokeOpacity="0.55" strokeWidth="0.8" fill="none" />
      <path d={`M${X(13.6)} ${Y(-0.2)} Q${X(16.2)} ${Y(3.8)} ${X(14.6)} ${Y(7.6)}`} stroke={STITCH} strokeOpacity="0.35" strokeWidth="0.45" strokeDasharray="1 0.9" fill="none" />
      <ellipse cx={X(18)} cy={Y(3.2)} rx="4.4" ry="1.4" fill="#fff" opacity="0.24" transform={`rotate(22 ${X(18)} ${Y(3.2)})`} />
      {/* contrafforte del tallone */}
      <path d={`M${X(-10.6)} ${Y(-4)} Q${X(-4)} ${Y(-3.4)} ${X(-2.4)} ${Y(7.6)}`} stroke={line} strokeOpacity="0.45" strokeWidth="0.8" fill="none" />
      {/* pieghe del cuoio alla caviglia */}
      <path d={`M${X(1)} ${Y(-6.2)} q4 0.6 7.4 2.6 M${X(0)} ${Y(-9.6)} q4.4 0.4 8.2 2.4`} stroke="#000" strokeOpacity="0.3" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      <path d={`M${X(1)} ${Y(-5.4)} q4 0.6 7.4 2.6`} stroke="#fff" strokeOpacity="0.12" strokeWidth="0.6" fill="none" />
      {/* suola con tacco, bordo cucito */}
      <path d={sole} fill={hiker ? "#24201c" : sportive ? "#f2efe8" : SOLE} stroke={OUT} strokeOpacity="0.85" strokeWidth="1" strokeLinejoin="round" />
      <path d={`M${X(-12)} ${Y(8.4)} H${X(23.8)}`} stroke={sportive ? "#fff" : "#6a5a4a"} strokeOpacity="0.55" strokeWidth="0.6" />
      {!sportive ? <path d={`M${X(-9.6)} ${Y(7)} H${X(21.6)}`} stroke={STITCH} strokeOpacity="0.45" strokeWidth="0.5" strokeDasharray="1.2 1" /> : null}

      {sportive ? (
        <g>
          <path d={`M${X(-12.2)} ${Y(10.6)} H${X(25)}`} stroke="#b9b4aa" strokeWidth="0.7" />
          {[-9, -5, -1, 3, 7, 11, 15, 19].map((x) => <path key={x} d={`M${X(x)} ${Y(11.8)} v-1`} stroke="#9a958c" strokeWidth="0.7" />)}
          <path d={`M${X(-8)} ${Y(1)} C${X(0)} ${Y(-2)} ${X(8)} ${Y(4)} ${X(18)} ${Y(1.6)}`} stroke={shade(sc, 0.55)} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d={`M${X(-10.4)} ${Y(-6.4)} C${X(-5)} ${Y(-7.8)} ${X(0)} ${Y(-6)} ${X(4)} ${Y(-4.2)}`} stroke={shade(sc, 0.45)} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          {[0, 1, 2, 3].map((k) => <path key={k} d={`M${X(6 + k * 2.6)} ${Y(-3.6 + k * 1.1)} l1.6 2`} stroke="#f4f1ea" strokeWidth="1.1" strokeLinecap="round" />)}
        </g>
      ) : null}

      {fw === "mocassini" ? (
        <g>
          {/* cucitura a U sul collo del piede, frange e lacci avvolti alla gamba */}
          <path d={`M${X(4)} ${Y(-3.4)} C${X(9)} ${Y(-5)} ${X(16)} ${Y(-1)} ${X(19)} ${Y(3)}`} stroke={line} strokeWidth="0.8" fill="none" />
          <path d={`M${X(4.6)} ${Y(-2.4)} C${X(9.4)} ${Y(-4)} ${X(15.6)} ${Y(-0.2)} ${X(18.4)} ${Y(3.6)}`} stroke={STITCH} strokeOpacity="0.5" strokeWidth="0.55" strokeDasharray="1.1 1" fill="none" />
          {[-8, -5.5, -3, -0.5, 2].map((x, k) => <path key={x} d={`M${X(x)} ${Y(-7.6 - (k % 2) * 0.4)} l${f(0.4)} 3.6`} stroke={dk} strokeWidth="0.9" strokeLinecap="round" />)}
          <g stroke={shade(sc, -0.12)} strokeWidth="1.9" strokeLinecap="round" fill="none">
            <path d={`M${X(-9)} ${Y(-30)} L${X(6)} ${Y(-22)} M${X(6)} ${Y(-30)} L${X(-9)} ${Y(-22)} M${X(-9)} ${Y(-22)} L${X(6)} ${Y(-14)} M${X(6)} ${Y(-22)} L${X(-9)} ${Y(-14)} M${X(-9)} ${Y(-14)} L${X(6)} ${Y(-7)}`} />
          </g>
          <path d={`M${X(6)} ${Y(-30)} q3 3 1.6 7 M${X(6)} ${Y(-30)} q4.4 1 5 5.6`} stroke={shade(sc, -0.12)} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      ) : null}

      {fw === "stivaletti" || hiker ? (
        <g>
          {/* allacciatura: ganci sul davanti, laccio che incrocia */}
          {[0, 1, 2, 3].map((k) => {
            const y = -top + 3 + k * ((top - 6) / 3.2);
            return <circle key={k} cx={X(8.6 - k * 0.1)} cy={Y(y)} r={hiker ? 1.2 : 0.95} fill={hiker ? STEEL : BRASS} stroke="#3a3026" strokeWidth="0.4" />;
          })}
          <path d={`M${X(8.6)} ${Y(-top + 3)} ${[1, 2, 3].map((k) => `L${X(k % 2 ? 6 : 8.6)} ${Y(-top + 3 + k * ((top - 6) / 3.2))}`).join(" ")} L${X(10)} ${Y(-2.6)}`} stroke={hiker ? "#c8553a" : "#e2cfa6"} strokeWidth="1.1" fill="none" strokeLinejoin="round" />
          {/* collarino imbottito e linguetta dietro */}
          <path d={`M${X(-10.6)} ${Y(-top)} L${X(9.4)} ${Y(-top)} L${X(9.2)} ${Y(-top + 3.4)} L${X(-10.6)} ${Y(-top + 3.4)} Z`} fill={shade(sc, -0.25)} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.8" />
          <path d={`M${X(-11.4)} ${Y(-top - 3)} h3.4 v6 h-3.4 z`} fill={dk} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.6" />
        </g>
      ) : null}
      {hiker ? (
        <g>
          {/* puntale di gomma e tacchetti della suola */}
          <path d={`M${X(15)} ${Y(1.4)} Q${X(24)} ${Y(3)} ${X(24)} ${Y(8)} L${X(15)} ${Y(8)} Z`} fill="#2f2a26" opacity="0.9" />
          {[-11.4, -7.6, -3.8, 0, 3.8, 7.6, 11.4, 15.2, 19].map((x) => <rect key={x} x={X(x)} y={Y(8 + soleH)} width="2.6" height="1.6" fill="#14110e" />)}
          <path d={`M${X(-12)} ${Y(10)} H${X(24.6)}`} stroke="#4a4038" strokeWidth="0.6" />
        </g>
      ) : null}

      {!low && fw !== "stivaletti" && !hiker ? (
        <g>
          {/* cucitura laterale del gambale */}
          <path d={`M${X(-1.4)} ${Y(-top + 5)} L${X(-1)} ${Y(-6)}`} stroke={line} strokeOpacity="0.5" strokeWidth="0.8" />
          <path d={`M${X(-0.4)} ${Y(-top + 5)} L${X(0)} ${Y(-6)}`} stroke={STITCH} strokeOpacity="0.32" strokeWidth="0.45" strokeDasharray="1.1 1" />
          {/* bordo in alto */}
          {fw === "stivali" ? <path d={`M${X(-10.6)} ${Y(-top)} L${X(9.6)} ${Y(-top)} L${X(9.4)} ${Y(-top + 5)} L${X(-10.4)} ${Y(-top + 5)} Z`} fill={shade(sc, -0.28)} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.8" /> : null}
          {fw === "stivali" ? <path d={`M${X(-9.6)} ${Y(-top + 3.6)} H${X(8.6)}`} stroke={STITCH} strokeOpacity="0.4" strokeWidth="0.45" strokeDasharray="1.1 1" /> : null}
          {/* cinturino con fibbia sulla caviglia */}
          {fw === "stivali" || fw === "stivali-pelliccia" ? (
            <g>
              <path d={`M${X(-10.4)} ${Y(-13)} L${X(8.8)} ${Y(-11)} L${X(8.8)} ${Y(-8)} L${X(-10.4)} ${Y(-10)} Z`} fill={dk} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.6" />
              <Buckle x={a.x + 1} y={a.y - 13.2} w={4.4} h={5.2} />
            </g>
          ) : null}
        </g>
      ) : null}

      {fw === "stivali-risvolto" ? (
        <g>
          {/* risvolto: il dentro dello stivale ripiegato, scamosciato e più chiaro, con l'orlo cucito */}
          <path d={`M${X(-12.2)} ${Y(-top - 2)} L${X(11.2)} ${Y(-top - 2)} L${X(12.6)} ${Y(-top + 12)} Q${X(0)} ${Y(-top + 14.6)} ${X(-13.4)} ${Y(-top + 12)} Z`} fill={lt} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.1" />
          <path d={`M${X(-12.6)} ${Y(-top + 10)} Q${X(0)} ${Y(-top + 12.6)} ${X(12)} ${Y(-top + 10)}`} stroke={line} strokeOpacity="0.45" strokeWidth="0.5" strokeDasharray="1.1 1" fill="none" />
          <path d={`M${X(-12)} ${Y(-top - 1)} H${X(11)}`} stroke="#fff" strokeOpacity="0.3" strokeWidth="1.2" />
          <path d={`M${X(-9)} ${Y(-top + 1)} q1 5 0 10 M${X(6)} ${Y(-top + 1)} q1 5 0 10`} stroke="#000" strokeOpacity="0.14" strokeWidth="1.6" fill="none" />
          <path d={`M${X(-10.4)} ${Y(-top + 13.6)} Q${X(0)} ${Y(-top + 16)} ${X(9.4)} ${Y(-top + 13.6)}`} stroke="#000" strokeOpacity="0.3" strokeWidth="1.4" fill="none" />
        </g>
      ) : null}

      {fw === "stivali-alti" ? (
        <g>
          {/* gambale da cavaliere: ginocchiera alta davanti, due cinturini con fibbie, borchie */}
          <path d={`M${X(-11.4)} ${Y(-top + 3)} L${X(-11.6)} ${Y(-top - 1)} L${X(7)} ${Y(-top - 9)} Q${X(11.6)} ${Y(-top - 9.6)} ${X(11)} ${Y(-top - 4)} L${X(10.4)} ${Y(-top + 8)} Z`} fill={shade(sc, -0.12)} stroke={OUT} strokeOpacity="0.85" strokeWidth="1.2" strokeLinejoin="round" />
          <path d={`M${X(-10.4)} ${Y(-top)} L${X(7)} ${Y(-top - 7.6)} Q${X(10)} ${Y(-top - 8)} ${X(9.6)} ${Y(-top - 3.4)}`} stroke={STITCH} strokeOpacity="0.4" strokeWidth="0.5" strokeDasharray="1.1 1" fill="none" />
          <path d={`M${X(-9)} ${Y(-top + 1)} L${X(6.6)} ${Y(-top - 5.8)}`} stroke="#fff" strokeOpacity="0.2" strokeWidth="1.4" strokeLinecap="round" />
          {[0, 1, 2].map((k) => <circle key={k} cx={X(-6 + k * 6)} cy={Y(-top + 1.6 - k * 2.6)} r="0.95" fill={BRASS} stroke="#5c4316" strokeWidth="0.4" />)}
          {[22, 34].map((d) => (
            <g key={d}>
              <path d={`M${X(-11)} ${Y(-top + d)} L${X(10)} ${Y(-top + d - 1.6)} L${X(10)} ${Y(-top + d + 2.2)} L${X(-11)} ${Y(-top + d + 3.8)} Z`} fill={dk} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.6" />
              <Buckle x={a.x + 2.4} y={a.y - top + d - 2.2} w={4.6} h={6.2} />
              <path d={`M${X(7)} ${Y(-top + d + 0.4)} l3.4 3.6`} stroke={dk} strokeWidth="1.6" strokeLinecap="round" />
            </g>
          ))}
        </g>
      ) : null}

      {fw === "stivali-pelliccia" ? (
        <g>
          {/* laccio di cuoio incrociato davanti e risvolto di pelliccia */}
          <path d={`M${X(8.4)} ${Y(-top + 12)} L${X(4.6)} ${Y(-top + 18)} L${X(8.6)} ${Y(-top + 24)} L${X(4.6)} ${Y(-top + 30)} L${X(8.6)} ${Y(-top + 36)}`} stroke="#d9c39a" strokeWidth="1" fill="none" strokeLinejoin="round" />
          <FurBand x0={a.x - 13.2} x1={a.x + 12.4} y={a.y - top - 3} h={10} />
        </g>
      ) : null}
    </g>
  );
}

/** quanto sale la calzatura sulla gamba, di fronte (y del bordo) */
export function frontBootTop(fw: string) {
  return fw === "stivali-alti" ? 262 : fw === "stivali" || fw === "stivali-risvolto" || fw === "stivali-pelliccia" ? 280 : fw === "stivaletti" || fw === "scarponi" ? 306 : fw === "mocassini" ? 326 : 318;
}

/**
 * Calzatura di fronte, su una gamba: `L(y, d)` dà la x a quota y spostata di d dal centro della gamba.
 * La punta viene verso chi guarda e si apre un poco verso l'esterno.
 */
export function FrontShoe({ look, L, legW, i, uid, skin }: { look: AvatarLook; L: (y: number, d: number) => string; legW: number; i: number; uid: string; skin: string }) {
  const sc = look.shoes;
  const fw = look.footwear;
  const top = frontBootTop(fw);
  const h = legW / 2 + 1;
  const o = i === 0 ? -1.3 : 1.3; // la punta un poco in fuori
  const dk = shade(sc, -0.45);
  const lt = shade(sc, 0.3);
  const line = shade(sc, -0.62);
  const Pt = (y: number, d: number) => `${L(y, d)} ${y}`;
  const flare = fw === "stivali-risvolto" ? 1.4 : fw === "stivali-alti" ? 1.6 : fw === "stivali" ? 0.8 : 0;
  const hiker = fw === "scarponi";
  const sportive = fw === "sportive";
  const sandal = fw === "sandali";
  // gambale (dal bordo alla caviglia) e piede che si allarga, con la punta che viene avanti
  const shape = `M${Pt(top, -h - flare)} L${Pt(top, h + flare)} L${Pt(337, h + 0.6)} C${Pt(340.6, h + 3.6 + o)} ${Pt(345.6, h + 5 + o)} ${Pt(349.4, h + 4.6 + o)} L${Pt(349.4, -h - 4.6 + o)} C${Pt(345.6, -h - 5 + o)} ${Pt(340.6, -h - 3.6 + o)} ${Pt(337, -h - 0.6)} Z`;
  const soleTop = hiker ? 347.6 : 348.8;
  const soleBot = hiker ? 354.2 : sportive ? 352.8 : 352.4;
  const sole = `M${Pt(soleTop, -h - 5.6 + o)} L${Pt(soleTop, h + 5.6 + o)} Q${Pt(soleTop + 1.2, h + 6.6 + o)} ${Pt(soleBot - 0.6, h + 5.4 + o)} L${Pt(soleBot, h + 4.4 + o)} L${Pt(soleBot, -h - 4.4 + o)} L${Pt(soleBot - 0.6, -h - 5.4 + o)} Q${Pt(soleTop + 1.2, -h - 6.6 + o)} ${Pt(soleTop, -h - 5.6 + o)} Z`;

  if (sandal) {
    const st = shade(sc, -0.05);
    return (
      <g>
        {/* piede nudo visto davanti: collo del piede, dita, alluce */}
        <path d={`M${Pt(318, -h + 1)} L${Pt(318, h - 1)} L${Pt(336, h)} C${Pt(340, h + 3.4 + o)} ${Pt(345, h + 4.6 + o)} ${Pt(349, h + 4 + o)} L${Pt(349, -h - 4 + o)} C${Pt(345, -h - 4.6 + o)} ${Pt(340, -h - 3.4 + o)} ${Pt(336, -h)} Z`} fill={skin} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.2" />
        <path d={`M${Pt(320, h - 2)} L${Pt(346, h + 2 + o)}`} stroke="#000" strokeOpacity="0.14" strokeWidth="3" />
        {[-0.72, -0.36, 0, 0.32, 0.62].map((k, n) => {
          const d = k * (h + 3) * (i === 0 ? -1 : 1) + o;
          return <path key={k} d={`M${Pt(349, d - (n === 0 ? 2 : 1.4))} q${f(n === 0 ? 2 : 1.4)} ${f(-3.2)} ${f(n === 0 ? 4 : 2.8)} 0`} fill={shade(skin, -0.05)} stroke={shade(skin, -0.4)} strokeWidth="0.6" />;
        })}
        <path d={sole.replace(/^M/, "M")} fill={shade(sc, -0.15)} stroke={OUT} strokeOpacity="0.7" strokeWidth="0.9" />
        <g stroke={st} strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d={`M${Pt(322, -h)} L${Pt(322, h)}`} />
          <path d={`M${Pt(334, -h - 1)} L${Pt(344, h + 3 + o)} M${Pt(334, h + 1)} L${Pt(344, -h - 3 + o)}`} />
          <path d={`M${Pt(343.6, -h - 3.6 + o)} L${Pt(343.6, h + 3.6 + o)}`} />
        </g>
        <path d={`M${Pt(334, -h - 1)} L${Pt(344, h + 3 + o)}`} stroke={shade(sc, 0.35)} strokeWidth="0.6" strokeLinecap="round" />
        <circle cx={L(322, 0)} cy="322" r="1.4" fill={BRASS} stroke="#5c4316" strokeWidth="0.4" />
      </g>
    );
  }

  return (
    <g>
      <path d={shape} fill={`url(#${uid}bo)`} stroke={OUT} strokeOpacity="0.88" strokeWidth="1.4" strokeLinejoin="round" />
      {/* luce sul lato sinistro, ombra sul destro, ombra sotto il collo del piede */}
      {top < 330 ? <path d={`M${Pt(top + 5, -h * 0.5)} L${Pt(334, -h * 0.5)}`} stroke="#fff" strokeOpacity="0.15" strokeWidth="2.2" strokeLinecap="round" /> : null}
      <path d={`M${Pt(339, -h - 1 + o)} Q${Pt(336.6, o)} ${Pt(339, h + 1 + o)}`} stroke="#000" strokeOpacity="0.3" strokeWidth="1.6" fill="none" />
      {/* puntale: cucitura e riflesso */}
      <path d={`M${Pt(341.6, -h - 2.6 + o)} Q${Pt(338.4, o)} ${Pt(341.6, h + 2.6 + o)}`} stroke={line} strokeOpacity="0.45" strokeWidth="0.7" fill="none" />
      <path d={`M${Pt(342.6, -h - 2.4 + o)} Q${Pt(339.4, o)} ${Pt(342.6, h + 2.4 + o)}`} stroke={STITCH} strokeOpacity="0.32" strokeWidth="0.45" strokeDasharray="1 0.9" fill="none" />
      <ellipse cx={L(344.4, o - h * 0.25)} cy="344.4" rx={f(h * 0.5)} ry="1.7" fill="#fff" opacity="0.24" />
      {/* pieghe alla caviglia */}
      {top < 326 ? <path d={`M${Pt(328, -h * 0.6)} q${f(h * 0.6)} 1.8 ${f(h * 1.2)} 0 M${Pt(332.4, -h * 0.55)} q${f(h * 0.55)} 1.6 ${f(h * 1.1)} 0`} stroke="#000" strokeOpacity="0.3" strokeWidth="0.75" fill="none" /> : null}
      {/* suola */}
      <path d={sole} fill={hiker ? "#24201c" : sportive ? "#f2efe8" : SOLE} stroke={OUT} strokeOpacity="0.85" strokeWidth="1" strokeLinejoin="round" />
      <path d={`M${Pt(soleTop + 0.5, -h - 5 + o)} L${Pt(soleTop + 0.5, h + 5 + o)}`} stroke={sportive ? "#fff" : "#6a5a4a"} strokeOpacity="0.55" strokeWidth="0.6" />
      {!sportive ? <path d={`M${Pt(soleTop - 0.9, -h - 4.4 + o)} L${Pt(soleTop - 0.9, h + 4.4 + o)}`} stroke={STITCH} strokeOpacity="0.4" strokeWidth="0.45" strokeDasharray="1.1 0.9" /> : null}

      {sportive ? (
        <g>
          <path d={`M${Pt(350.8, -h - 5 + o)} L${Pt(350.8, h + 5 + o)}`} stroke="#b9b4aa" strokeWidth="0.6" />
          {/* linguetta, lacci bianchi, fasce laterali */}
          <path d={`M${Pt(top - 2, -h * 0.42)} Q${Pt(top - 4, 0)} ${Pt(top - 2, h * 0.42)} L${Pt(334, h * 0.4)} L${Pt(334, -h * 0.4)} Z`} fill={lt} stroke={OUT} strokeOpacity="0.55" strokeWidth="0.7" />
          {[322, 326, 330, 334].map((y) => <path key={y} d={`M${Pt(y, -h * 0.55)} L${Pt(y + 1.2, h * 0.55)}`} stroke="#f4f1ea" strokeWidth="1.2" strokeLinecap="round" />)}
          <path d={`M${Pt(330, -h - 0.4)} C${Pt(336, -h - 2)} ${Pt(342, -h - 4 + o)} ${Pt(346, -h - 4 + o)} M${Pt(330, h + 0.4)} C${Pt(336, h + 2)} ${Pt(342, h + 4 + o)} ${Pt(346, h + 4 + o)}`} stroke={shade(sc, 0.55)} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      ) : null}

      {fw === "stivaletti" || hiker ? (
        <g>
          {/* allacciatura con ganci e collarino */}
          <path d={`M${Pt(top, -h)} L${Pt(top, h)} L${Pt(top + 4.4, h)} L${Pt(top + 4.4, -h)} Z`} fill={shade(sc, -0.25)} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.8" />
          {hiker ? <path d={`M${Pt(top + 0.6, -h + 0.6)} Q${Pt(top - 1.6, 0)} ${Pt(top + 0.6, h - 0.6)}`} stroke="#fff" strokeOpacity="0.25" strokeWidth="1" fill="none" /> : null}
          {[0, 1, 2, 3, 4].map((k) => {
            const y = top + 7 + k * 5.4;
            return (
              <g key={k}>
                <circle cx={L(y, -h * 0.5)} cy={y} r={hiker ? 1.1 : 0.9} fill={hiker ? STEEL : BRASS} stroke="#3a3026" strokeWidth="0.35" />
                <circle cx={L(y, h * 0.5)} cy={y} r={hiker ? 1.1 : 0.9} fill={hiker ? STEEL : BRASS} stroke="#3a3026" strokeWidth="0.35" />
                {k < 4 ? <path d={`M${Pt(y, -h * 0.5)} L${Pt(y + 5.4, h * 0.5)} M${Pt(y, h * 0.5)} L${Pt(y + 5.4, -h * 0.5)}`} stroke={hiker ? "#c8553a" : "#e2cfa6"} strokeWidth="0.9" /> : null}
              </g>
            );
          })}
        </g>
      ) : null}
      {hiker ? (
        <g>
          {/* puntale di gomma e tacchetti */}
          <path d={`M${Pt(341, -h - 3.6 + o)} Q${Pt(338.8, o)} ${Pt(341, h + 3.6 + o)} L${Pt(347.6, h + 5 + o)} L${Pt(347.6, -h - 5 + o)} Z`} fill="#2f2a26" opacity="0.92" />
          {[-0.8, -0.4, 0, 0.4, 0.8].map((k) => <rect key={k} x={L(354.2, k * (h + 3) + o - 1.2)} y="354.2" width="2.4" height="1.5" fill="#14110e" />)}
        </g>
      ) : null}

      {fw === "stivali" ? (
        <g>
          <path d={`M${Pt(top, -h - flare)} L${Pt(top, h + flare)} L${Pt(top + 6, h + flare * 0.7)} L${Pt(top + 6, -h - flare * 0.7)} Z`} fill={shade(sc, -0.28)} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.8" />
          <path d={`M${Pt(top + 4.2, -h)} L${Pt(top + 4.2, h)}`} stroke={STITCH} strokeOpacity="0.4" strokeWidth="0.45" strokeDasharray="1.1 1" />
        </g>
      ) : null}
      {fw === "stivali" || fw === "stivali-pelliccia" ? (
        <g>
          {/* cinturino della caviglia con fibbia sul lato esterno */}
          <path d={`M${Pt(323, -h - 0.4)} L${Pt(323, h + 0.4)} L${Pt(327, h + 0.4)} L${Pt(327, -h - 0.4)} Z`} fill={dk} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.6" />
          <g transform={`translate(${i === 0 ? -h * 0.62 : h * 0.18} 0)`}>
            <Buckle x={Number(L(321.6, 0))} y={321.6} w={4.2} h={6.6} />
          </g>
        </g>
      ) : null}
      {!fw.startsWith("stivali") || fw === "stivaletti" ? null : (
        <path d={`M${Pt(top + 6, i === 0 ? h * 0.55 : -h * 0.55)} L${Pt(334, i === 0 ? h * 0.6 : -h * 0.6)}`} stroke={line} strokeOpacity="0.4" strokeWidth="0.7" />
      )}

      {fw === "stivali-risvolto" ? (
        <g>
          {/* risvolto scamosciato con orlo cucito e lo scollo a V davanti */}
          <path d={`M${Pt(top - 3, -h - 3.4)} L${Pt(top - 3, h + 3.4)} L${Pt(top + 13, h + 2.8)} L${Pt(top + 15.4, h * 0.2)} L${Pt(top + 12, 0)} L${Pt(top + 15.4, -h * 0.2)} L${Pt(top + 13, -h - 2.8)} Z`} fill={lt} stroke={OUT} strokeOpacity="0.75" strokeWidth="1.1" strokeLinejoin="round" />
          <path d={`M${Pt(top + 10.6, -h - 2.2)} L${Pt(top + 10.6, -h * 0.25)} M${Pt(top + 10.6, h * 0.25)} L${Pt(top + 10.6, h + 2.2)}`} stroke={line} strokeOpacity="0.45" strokeWidth="0.5" strokeDasharray="1.1 1" />
          <path d={`M${Pt(top - 2, -h - 2.6)} L${Pt(top - 2, h + 2.6)}`} stroke="#fff" strokeOpacity="0.3" strokeWidth="1.1" />
          <path d={`M${Pt(top + 15, -h - 1)} L${Pt(top + 15, h + 1)}`} stroke="#000" strokeOpacity="0.28" strokeWidth="1.6" />
        </g>
      ) : null}

      {fw === "stivali-alti" ? (
        <g>
          {/* ginocchiera a scudo con borchie, due cinturini con fibbie */}
          <path d={`M${Pt(top + 8, -h - 2.4)} L${Pt(top + 1, -h - 2.2)} L${Pt(top - 4, -h * 0.35)} Q${Pt(top - 9, 0)} ${Pt(top - 4, h * 0.35)} L${Pt(top + 1, h + 2.2)} L${Pt(top + 8, h + 2.4)} Z`} fill={shade(sc, -0.1)} stroke={OUT} strokeOpacity="0.85" strokeWidth="1.2" strokeLinejoin="round" />
          <path d={`M${Pt(top + 6, -h - 1)} L${Pt(top + 1.6, -h - 0.8)} L${Pt(top - 2.6, -h * 0.3)} Q${Pt(top - 6.6, 0)} ${Pt(top - 2.6, h * 0.3)} L${Pt(top + 1.6, h + 0.8)} L${Pt(top + 6, h + 1)}`} stroke={STITCH} strokeOpacity="0.4" strokeWidth="0.45" strokeDasharray="1.1 1" fill="none" />
          <path d={`M${Pt(top - 2.4, -h * 0.25)} Q${Pt(top - 5.4, -h * 0.05)} ${Pt(top - 4.6, h * 0.1)}`} stroke="#fff" strokeOpacity="0.3" strokeWidth="1" fill="none" strokeLinecap="round" />
          {[-0.5, 0, 0.5].map((k) => <circle key={k} cx={L(top + 3, k * h)} cy={top + 3 - Math.abs(k) * 0} r="1" fill={BRASS} stroke="#5c4316" strokeWidth="0.35" />)}
          {[290, 306].map((y) => (
            <g key={y}>
              <path d={`M${Pt(y, -h - 1)} L${Pt(y, h + 1)} L${Pt(y + 4, h + 1)} L${Pt(y + 4, -h - 1)} Z`} fill={dk} stroke={OUT} strokeOpacity="0.6" strokeWidth="0.6" />
              <g transform={`translate(${i === 0 ? -h * 0.7 : h * 0.2} 0)`}>
                <Buckle x={Number(L(y - 1.6, 0))} y={y - 1.6} w={4.4} h={7.2} />
              </g>
            </g>
          ))}
        </g>
      ) : null}

      {fw === "stivali-pelliccia" ? (
        <g>
          <path d={`M${Pt(top + 12, -h * 0.4)} L${Pt(top + 18, h * 0.4)} L${Pt(top + 24, -h * 0.4)} L${Pt(top + 30, h * 0.4)} L${Pt(top + 36, -h * 0.4)}`} stroke="#d9c39a" strokeWidth="1" fill="none" strokeLinejoin="round" />
          <FurBand x0={Number(L(top, -h - 3.6))} x1={Number(L(top, h + 3.6))} y={top - 3} h={11} />
        </g>
      ) : null}

      {fw === "mocassini" ? (
        <g>
          {/* lacci incrociati sulla gamba fino a metà polpaccio, nodo con le code; cucitura a U sul piede */}
          <g stroke={shade(sc, -0.12)} strokeWidth="1.9" strokeLinecap="round" fill="none">
            {[0, 1, 2].map((k) => <path key={k} d={`M${Pt(296 + k * 10, -h + 0.5)} L${Pt(306 + k * 10, h - 0.5)} M${Pt(296 + k * 10, h - 0.5)} L${Pt(306 + k * 10, -h + 0.5)}`} />)}
          </g>
          <path d={`M${Pt(296, 0)} q${i === 0 ? -3 : 3} 4 ${i === 0 ? -2 : 2} 9 M${Pt(296, 0)} q${i === 0 ? -5 : 5} 2 ${i === 0 ? -6 : 6} 7`} stroke={shade(sc, -0.12)} strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <circle cx={L(296, 0)} cy="296" r="1.6" fill={shade(sc, -0.2)} />
          <path d={`M${Pt(337.6, -h * 0.6 + o)} Q${Pt(333.4, o)} ${Pt(337.6, h * 0.6 + o)}`} stroke={STITCH} strokeOpacity="0.5" strokeWidth="0.55" strokeDasharray="1.1 1" fill="none" />
          {[-0.6, -0.2, 0.2, 0.6].map((k) => <path key={k} d={`M${Pt(top, k * h)} l0 3.6`} stroke={dk} strokeWidth="0.9" strokeLinecap="round" />)}
        </g>
      ) : null}
    </g>
  );
}
