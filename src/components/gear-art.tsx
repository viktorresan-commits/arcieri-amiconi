import { useId, type ReactNode } from "react";
import { ArrowArt } from "./arrow-art";
import { BowArt } from "./bow-art";

/**
 * Icone delle categorie di attrezzatura: piccoli oggetti disegnati con luce e materiali veri
 * (metallo, carbonio, cuoio, legno) su una tessera scura. Tutte nello stesso stile: luce dall'alto
 * a sinistra, ombra morbida sotto l'oggetto, contorni scuri sottili.
 */

type Art = (p: P) => ReactNode;
type P = { u: (k: string) => string };

const EDGE = "rgba(0,0,0,0.55)";

/** ombra morbida a terra sotto l'oggetto */
const Floor = ({ u, cx = 32, cy = 56, rx = 20 }: P & { cx?: number; cy?: number; rx?: number }) => <ellipse cx={cx} cy={cy} rx={rx} ry={2.6} fill={u("sh")} />;

const ART: Record<string, Art> = {
  arco: () => (
    <g transform="translate(31 32) rotate(-24) scale(1.22) translate(-32 -32)">
      <BowArt type="ricurvo" wood="bubinga" />
    </g>
  ),
  freccia: () => (
    <g transform="rotate(-40 32 32)">
      {/* la freccia viene un po' più spessa del vero, se no in piccolo sparisce */}
      <svg x="-6" y="25" width="76" height="14" overflow="visible">
        <ArrowArt material="carbonio" fletch="#e5484d" cock="#f4f1ea" nock="#f4f1ea" fletchType="alette" point="ogiva" wrap="#f4f1ea" className="" stretch shine />
      </svg>
    </g>
  ),
  aste: ({ u }) => (
    <g>
      <Floor u={u} rx={22} />
      {/* tre aste: carbonio, alluminio e legno */}
      {(
        [
          [-7, "#2a2e33", "cf", "#e9ecef"],
          [0, "#b8c2ca", "al", "#1d2126"],
          [7, "#cf9a5c", "wd", "#3a2410"],
        ] as const
      ).map(([d, c, tex, ink], i) => (
        <g key={i} transform={`translate(${d} ${d * 0.6}) rotate(-36 32 32)`}>
          <rect x="1" y="29.4" width="62" height="5.2" rx="2.6" fill={c} />
          <rect x="1" y="29.4" width="62" height="5.2" rx="2.6" fill={u(tex)} />
          <rect x="3" y="30.1" width="58" height="1.2" rx="0.6" fill="#fff" opacity="0.38" />
          <rect x="3" y="33.2" width="58" height="0.8" rx="0.4" fill="#000" opacity="0.25" />
          <rect x="1" y="29.4" width="62" height="5.2" rx="2.6" fill="none" stroke={EDGE} strokeWidth="0.45" />
          <text x="26" y="33.3" fontSize="2.6" fontWeight="800" fill={ink} opacity="0.75" fontFamily="system-ui, sans-serif">{["600", "1916", "30#"][i]}</text>
        </g>
      ))}
    </g>
  ),
  punte: ({ u }) => (
    <g>
      <Floor u={u} rx={21} />
      {[
        [10, 1.05],
        [26, 1.2],
        [42, 1.05],
      ].map(([x, s], i) => (
        <g key={i} transform={`translate(${x as number} 54) scale(${s as number}) rotate(-14)`}>
          {/* gambo filettato, spalla e ogiva in acciaio lucido */}
          <rect x="-2" y="-14" width="4" height="12" rx="0.6" fill={u("m")} stroke={EDGE} strokeWidth="0.35" />
          {[0, 1, 2, 3, 4].map((k) => (
            <rect key={k} x="-2" y={-13 + k * 2.3} width="4" height="0.5" fill="#000" opacity="0.28" />
          ))}
          <rect x="-3.2" y="-18" width="6.4" height="4.2" rx="0.9" fill={u("mx")} stroke={EDGE} strokeWidth="0.35" />
          <path d="M-3.2 -18 L-3.2 -30 Q0 -40 3.2 -30 L3.2 -18 Z" fill={u("mx")} stroke={EDGE} strokeWidth="0.4" />
          <path d="M-1.9 -19 L-1.9 -29.5 Q-0.6 -35 0.2 -36" fill="none" stroke="#fff" strokeWidth="0.9" opacity="0.85" strokeLinecap="round" />
        </g>
      ))}
    </g>
  ),
  alette: ({ u }) => (
    <g>
      <Floor u={u} rx={22} />
      {/* penna naturale barrata e due alette in plastica */}
      <g transform="rotate(-30 32 32)">
        <path d="M8 30 C9 16 30 14 56 30 Z" fill="#d9c08f" />
        <path d="M8 30 C9 16 30 14 56 30 Z" fill={u("bar")} />
        <path d="M8 30 C9 16 30 14 56 30 Z" fill="none" stroke="#6b5130" strokeOpacity="0.5" strokeWidth="0.4" strokeDasharray="0.4 0.6" />
        <path d="M6 30.3 L57 30.3" stroke="#f6eedb" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M20 30 L15 22 M33 30 L28 20" stroke="#3a2a1e" strokeWidth="0.6" opacity="0.6" />
      </g>
      <g transform="translate(6 30) rotate(-8)">
        <path d="M10 22 L13 12 L34 12 L46 22 Z" fill="#e6b325" stroke={EDGE} strokeWidth="0.4" />
        <path d="M13 12 L34 12 L38 15 L14 15 Z" fill="#fff" opacity="0.28" />
        <path d="M14 24 L17 15 L38 15 L50 24 Z" fill="#2f7fd1" stroke={EDGE} strokeWidth="0.4" />
        <path d="M17 15 L38 15 L42 18 L18 18 Z" fill="#fff" opacity="0.28" />
      </g>
    </g>
  ),
  cocche: ({ u }) => (
    <g>
      <Floor u={u} rx={20} />
      {[
        [14, "#c6f24a"],
        [32, "#ff5fa2"],
        [50, "#f4f1ea"],
      ].map(([x, c], i) => (
        <g key={i} transform={`translate(${x as number} 34) rotate(${-12 + i * 12})`}>
          {/* cocca: corpo, gola per la corda e codolo che entra nell'asta */}
          <rect x="-2.2" y="6" width="4.4" height="12" rx="1" fill={u("m")} opacity="0.9" stroke={EDGE} strokeWidth="0.35" />
          <path d="M-4.6 -14 L-4.4 6 L4.4 6 L4.6 -14 L1.6 -14 L1.4 -4 L-1.4 -4 L-1.6 -14 Z" fill={c as string} stroke={EDGE} strokeWidth="0.45" />
          <path d="M-3.8 -13 L-3.6 5" stroke="#fff" strokeWidth="1" opacity="0.55" strokeLinecap="round" />
          <path d="M-1.4 -4 L1.4 -4" stroke="#000" strokeWidth="0.6" opacity="0.4" />
          <rect x="-4.6" y="4" width="9.2" height="2.2" rx="0.6" fill="#000" opacity="0.2" />
        </g>
      ))}
    </g>
  ),
  corda: ({ u }) => (
    <g>
      <Floor u={u} rx={21} />
      {/* corda arrotolata: fili chiari ritorti, serving nero al centro e alle asole */}
      <path d="M13 50 C6 38 12 17 25 10 C35 5 47 9 51 19 C56 33 44 50 30 53 C21 55 15 49 19 41" fill="none" stroke="#0b0d0f" strokeWidth="4.6" strokeLinecap="round" opacity="0.5" />
      <path d="M13 50 C6 38 12 17 25 10 C35 5 47 9 51 19 C56 33 44 50 30 53 C21 55 15 49 19 41" fill="none" stroke="#e9edf0" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M13 50 C6 38 12 17 25 10 C35 5 47 9 51 19 C56 33 44 50 30 53 C21 55 15 49 19 41" fill="none" stroke="#7d8790" strokeWidth="3.4" strokeDasharray="0.45 1.1" strokeLinecap="butt" opacity="0.4" />
      <path d="M41 7.6 C48 10 52 15 53.4 22" fill="none" stroke="#14181c" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M41 7.6 C48 10 52 15 53.4 22" fill="none" stroke="#9aa4ad" strokeWidth="4.4" strokeDasharray="0.4 0.9" opacity="0.5" />
      <ellipse cx="13" cy="50" rx="5" ry="3" fill="none" stroke="#14181c" strokeWidth="2.6" transform="rotate(-30 13 50)" />
      <ellipse cx="19" cy="40" rx="4.2" ry="2.6" fill="none" stroke="#14181c" strokeWidth="2.4" transform="rotate(40 19 40)" />
      <rect x="28" y="50.6" width="4.4" height="4" rx="1" fill={u("g")} stroke={EDGE} strokeWidth="0.35" />
      <path d="M22 11.4 C30 7 38 7 44 10" fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />
    </g>
  ),
  mirino: ({ u }) => (
    <g>
      <Floor u={u} rx={20} />
      {/* barra verticale con scala, braccio di prolunga, blocco e diottra */}
      <rect x="40" y="6" width="5" height="46" rx="1.2" fill={u("kx")} stroke={EDGE} strokeWidth="0.45" />
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x="40.8" y={9 + i * 3} width={i % 2 ? 1.6 : 2.6} height="0.45" fill="#e9ecef" opacity="0.8" />
      ))}
      <rect x="10" y="40" width="32" height="4.6" rx="1.2" fill={u("k")} stroke={EDGE} strokeWidth="0.45" />
      <rect x="11" y="40.6" width="30" height="0.9" fill="#fff" opacity="0.2" />
      <rect x="36" y="22" width="12" height="7" rx="1.4" fill={u("r")} stroke={EDGE} strokeWidth="0.45" />
      <rect x="47" y="24" width="4" height="3" rx="0.8" fill={u("m")} />
      <rect x="22" y="23.6" width="14" height="3.6" rx="1" fill={u("r")} stroke={EDGE} strokeWidth="0.4" />
      <circle cx="17" cy="25.4" r="6.4" fill="none" stroke={u("k")} strokeWidth="2.6" />
      <circle cx="17" cy="25.4" r="6.4" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.5" />
      <circle cx="17" cy="25.4" r="4.6" fill="#a8d8ff" opacity="0.18" />
      <circle cx="17" cy="25.4" r="1.2" fill="#c6f24a" />
      <path d="M17 19.8 L17 24.2" stroke="#c6f24a" strokeWidth="0.6" />
      <rect x="6" y="38.6" width="6" height="7.4" rx="1.4" fill={u("k")} stroke={EDGE} strokeWidth="0.4" />
      <circle cx="9" cy="42.3" r="1.3" fill={u("m")} />
    </g>
  ),
  rest: ({ u }) => (
    <g>
      <Floor u={u} rx={18} />
      {/* rest magnetico: piastra adesiva, corpo e baffo che regge la freccia */}
      <rect x="12" y="20" width="26" height="22" rx="4" fill={u("k")} stroke={EDGE} strokeWidth="0.5" />
      <rect x="13" y="21" width="24" height="3" rx="1.5" fill="#fff" opacity="0.14" />
      <circle cx="18" cy="36" r="2" fill={u("m")} stroke={EDGE} strokeWidth="0.3" />
      <circle cx="32" cy="36" r="2" fill={u("m")} stroke={EDGE} strokeWidth="0.3" />
      <path d="M17 36 L19 36 M31 36 L33 36" stroke="#333" strokeWidth="0.5" />
      <rect x="22" y="13" width="7" height="12" rx="2" fill={u("r")} stroke={EDGE} strokeWidth="0.45" />
      <path d="M28 16 C38 15 46 17 52 22" fill="none" stroke={u("mx")} strokeWidth="2" strokeLinecap="round" />
      <path d="M28 16 C38 15 46 17 52 22" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.7" strokeLinecap="round" />
    </g>
  ),
  stabilizzatore: ({ u }) => (
    <g>
      <Floor u={u} rx={24} />
      <g transform="rotate(-30 32 32)">
        {/* asta lunga in carbonio, smorzatore e pesi in acciaio */}
        <rect x="4" y="28.8" width="44" height="6.4" rx="3.2" fill="#2a2f35" />
        <rect x="4" y="28.8" width="44" height="6.4" rx="3.2" fill={u("cf")} />
        <rect x="6" y="29.6" width="40" height="1.5" rx="0.75" fill="#fff" opacity="0.4" />
        <rect x="6" y="33.4" width="40" height="0.9" rx="0.45" fill="#000" opacity="0.3" />
        <rect x="4" y="28.8" width="44" height="6.4" rx="3.2" fill="none" stroke={EDGE} strokeWidth="0.45" />
        <rect x="0" y="27.6" width="6" height="8.8" rx="1.6" fill={u("r")} stroke={EDGE} strokeWidth="0.45" />
        <rect x="48" y="27.4" width="5.4" height="9.2" rx="2" fill="#1b1e21" stroke={EDGE} strokeWidth="0.45" />
        {[53.4, 57.4].map((x) => (
          <rect key={x} x={x} y="24.6" width="3.6" height="14.8" rx="1.2" fill={u("m")} stroke={EDGE} strokeWidth="0.45" />
        ))}
        <rect x="61" y="29.4" width="2" height="5.2" rx="1" fill={u("m")} />
      </g>
    </g>
  ),
  parabraccio: ({ u }) => (
    <g>
      <Floor u={u} rx={18} />
      {/* parabraccio curvo con fori di aerazione e cinghie a strappo */}
      <path d="M18 8 C30 6 42 10 46 12 L44 54 C38 57 26 58 18 56 C22 40 22 24 18 8 Z" fill={u("lb")} stroke={EDGE} strokeWidth="0.6" />
      <path d="M20 10 C30 8 40 11 44 13 L43.4 20 C36 17 28 16 21.6 17 Z" fill="#fff" opacity="0.12" />
      {[
        [30, 22],
        [36, 24],
        [30, 31],
        [36, 33],
        [30, 40],
        [36, 42],
      ].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="1.6" ry="2.4" fill="#0c0d0f" stroke="#fff" strokeOpacity="0.12" strokeWidth="0.4" />
      ))}
      <rect x="10" y="17" width="44" height="5" rx="1.4" fill="#2f7fd1" stroke={EDGE} strokeWidth="0.4" />
      <rect x="10" y="44" width="44" height="5" rx="1.4" fill="#2f7fd1" stroke={EDGE} strokeWidth="0.4" />
      <rect x="10" y="17.5" width="44" height="1" fill="#fff" opacity="0.3" />
      <rect x="10" y="44.5" width="44" height="1" fill="#fff" opacity="0.3" />
      <path d="M20 12 C24 28 24 40 20 54" stroke="#9aa4ad" strokeWidth="0.45" strokeDasharray="1 1" fill="none" opacity="0.7" />
    </g>
  ),
  guantino: ({ u }) => (
    <g>
      <Floor u={u} rx={16} />
      {/* patella: cuoio, piastra in ottone con appoggio sotto il mento e separatore delle dita */}
      <path d="M20 14 C20 10 44 10 44 14 L45 46 C45 54 19 54 19 46 Z" fill={u("l")} stroke={EDGE} strokeWidth="0.6" />
      <path d="M22 16 C22 13 42 13 42 16 L42.4 22 C36 20 28 20 21.6 22 Z" fill="#fff" opacity="0.14" />
      <path d="M21 46 C24 50 40 50 43 46" stroke="#f0dfc0" strokeWidth="0.5" strokeDasharray="1 0.8" fill="none" opacity="0.7" />
      <path d="M18 12 L46 12 L47 20 L17 20 Z" fill={u("g")} stroke={EDGE} strokeWidth="0.5" />
      <path d="M18 12 L46 12 L46.4 14 L17.8 14 Z" fill="#fff" opacity="0.4" />
      <rect x="10" y="12" width="9" height="5" rx="1.6" fill={u("g")} stroke={EDGE} strokeWidth="0.45" />
      <path d="M28 24 L36 24 L35 32 L29 32 Z" fill={u("k")} stroke={EDGE} strokeWidth="0.45" />
      <circle cx="24" cy="16" r="1" fill={u("m")} />
      <circle cx="40" cy="16" r="1" fill={u("m")} />
    </g>
  ),
  sgancio: ({ u }) => (
    <g>
      <Floor u={u} rx={20} />
      {/* sgancio a polso: cinturino nero, asta regolabile e testa a pinza */}
      <path d="M6 40 C6 30 22 26 30 30 L30 46 C22 50 6 50 6 40 Z" fill={u("lb")} stroke={EDGE} strokeWidth="0.5" />
      <rect x="10" y="33" width="14" height="10" rx="2" fill="#2b2f33" stroke={EDGE} strokeWidth="0.4" />
      <path d="M11 34 L23 34" stroke="#fff" strokeWidth="0.6" opacity="0.2" />
      <rect x="29" y="35.6" width="14" height="3.4" rx="1.4" fill={u("mx")} stroke={EDGE} strokeWidth="0.35" />
      {[31, 33.2, 35.4, 37.6, 39.8].map((x) => (
        <rect key={x} x={x} y="35.6" width="0.5" height="3.4" fill="#000" opacity="0.3" />
      ))}
      <path d="M42 30 L54 30 C58 30 58 44 54 44 L42 44 Z" fill={u("r")} stroke={EDGE} strokeWidth="0.5" />
      <path d="M53 33 L58 31 M53 41 L58 43" stroke={u("mx")} strokeWidth="2" strokeLinecap="round" />
      <rect x="44" y="44" width="5" height="6" rx="1.6" fill={u("m")} stroke={EDGE} strokeWidth="0.35" />
      <path d="M43 31 L53 31" stroke="#fff" strokeWidth="0.7" opacity="0.35" />
    </g>
  ),
  pettorina: ({ u }) => (
    <g>
      <Floor u={u} rx={18} />
      {/* pettorina in rete con bordo e cinghie */}
      <path d="M14 14 C26 10 40 10 50 14 L48 48 C40 52 24 52 16 48 Z" fill="#1d2228" stroke={EDGE} strokeWidth="0.6" />
      <path d="M14 14 C26 10 40 10 50 14 L48 48 C40 52 24 52 16 48 Z" fill={u("mesh")} />
      <path d="M14 14 C26 10 40 10 50 14 L48 48 C40 52 24 52 16 48 Z" fill="none" stroke="#2f7fd1" strokeWidth="2" />
      <path d="M50 18 C56 22 58 30 56 36" fill="none" stroke="#14181c" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 18 C10 12 8 8 12 4" fill="none" stroke="#14181c" strokeWidth="3" strokeLinecap="round" />
      <rect x="53" y="34" width="5" height="4" rx="1" fill={u("m")} stroke={EDGE} strokeWidth="0.3" />
      <path d="M18 16 C28 13 38 13 47 16" stroke="#fff" strokeWidth="0.8" opacity="0.22" fill="none" />
    </g>
  ),
  faretra: ({ u }) => (
    <g>
      <Floor u={u} cx={33} rx={17} />
      {/* frecce che escono dalla faretra */}
      {[
        [24, "#e5484d", -16],
        [31, "#e6b325", -4],
        [38, "#2f7fd1", 9],
      ].map(([x, c, r], i) => (
        <g key={i} transform={`rotate(${r as number} ${x as number} 26)`}>
          <rect x={(x as number) - 0.8} y="4" width="1.6" height="24" fill="#2a2e33" />
          <path d={`M${(x as number) - 0.8} 6 L${(x as number) - 4} 9 L${(x as number) - 4} 15 L${(x as number) - 0.8} 17 Z`} fill={c as string} stroke={EDGE} strokeWidth="0.3" />
          <path d={`M${(x as number) + 0.8} 6 L${(x as number) + 4} 9 L${(x as number) + 4} 15 L${(x as number) + 0.8} 17 Z`} fill={c as string} stroke={EDGE} strokeWidth="0.3" />
          <rect x={(x as number) - 1.2} y="2.6" width="2.4" height="2.4" rx="0.6" fill="#f4f1ea" />
        </g>
      ))}
      {/* corpo in cuoio con cuciture, bocca rinforzata e passante per la cintura */}
      <path d="M18 22 L48 22 L44 54 C40 57 28 57 24 54 Z" fill={u("l")} stroke={EDGE} strokeWidth="0.6" />
      <path d="M20 24 L46 24 L45.4 30 L21 30 Z" fill="#fff" opacity="0.12" />
      <rect x="16.5" y="20" width="33" height="5" rx="2" fill="#5a2f15" stroke={EDGE} strokeWidth="0.5" />
      <path d="M21 27 L25 53 M45 27 L42 53" stroke="#f0dfc0" strokeWidth="0.5" strokeDasharray="1 0.8" opacity="0.7" />
      <rect x="29" y="34" width="8" height="10" rx="1.6" fill="#5a2f15" stroke={EDGE} strokeWidth="0.4" />
      <circle cx="33" cy="39" r="1.3" fill={u("g")} />
    </g>
  ),
  bersaglio: ({ u }) => (
    <g>
      {/* cavalletto in legno dietro il paglione */}
      <path d="M22 40 L12 60 M42 40 L52 60 M32 44 L32 60" stroke={u("wx")} strokeWidth="2.4" strokeLinecap="round" />
      <Floor u={u} cy={59} rx={22} />
      <rect x="8" y="6" width="48" height="44" rx="4" fill="#c7a35d" stroke={EDGE} strokeWidth="0.6" />
      <rect x="8" y="6" width="48" height="44" rx="4" fill={u("straw")} />
      {/* visuale a 10 zone: bianco, nero, azzurro, rosso, oro */}
      {[
        [19, "#f4f1ea", "#1d2024"],
        [15.2, "#1d2024", "#f4f1ea"],
        [11.4, "#2b8fd6", "#1d2024"],
        [7.6, "#e2413a", "#1d2024"],
        [3.8, "#f2cf3b", "#1d2024"],
      ].map(([r, c, line], i) => (
        <g key={i}>
          <circle cx="32" cy="28" r={r as number} fill={c as string} />
          <circle cx="32" cy="28" r={(r as number) - 1.9} fill="none" stroke={line as string} strokeWidth="0.25" opacity="0.7" />
        </g>
      ))}
      <circle cx="32" cy="28" r="1.2" fill="none" stroke="#1d2024" strokeWidth="0.25" />
      <ellipse cx="25" cy="19" rx="9" ry="5" fill="#fff" opacity="0.1" transform="rotate(-30 25 19)" />
      {/* una freccia piantata vicino al centro */}
      <path d="M33.4 26.8 L48 14" stroke="#2a2e33" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M45 16.6 L50 9 L52 11 L48 15.6 Z M45.6 17.2 L53 13.4 L53.6 16 L48.6 17.4 Z" fill="#e5484d" stroke={EDGE} strokeWidth="0.3" />
      <circle cx="33.4" cy="26.8" r="0.9" fill="#0c0d0f" />
    </g>
  ),
  custodia: ({ u }) => (
    <g>
      <Floor u={u} cy={55} rx={24} />
      {/* valigia rigida per arco: guscio, maniglia e chiusure */}
      <rect x="4" y="22" width="56" height="30" rx="6" fill={u("k")} stroke={EDGE} strokeWidth="0.6" />
      <rect x="6" y="24" width="52" height="5" rx="2.5" fill="#fff" opacity="0.1" />
      <path d="M4 37 L60 37" stroke="#000" strokeWidth="1" opacity="0.5" />
      <path d="M4 36.2 L60 36.2" stroke="#fff" strokeWidth="0.5" opacity="0.15" />
      {[8, 18, 28, 38, 48].map((x) => (
        <path key={x} d={`M${x} 26 L${x + 6} 26`} stroke="#000" strokeWidth="2.4" opacity="0.25" strokeLinecap="round" />
      ))}
      <path d="M24 22 L24 16 C24 13 40 13 40 16 L40 22" fill="none" stroke="#1a1d20" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M24.4 20 L24.4 16.4 C24.4 14.2 39.6 14.2 39.6 16.4" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.25" />
      {[12, 48].map((x) => (
        <g key={x}>
          <rect x={x - 3.4} y="33" width="6.8" height="7.6" rx="1.4" fill={u("m")} stroke={EDGE} strokeWidth="0.4" />
          <rect x={x - 1.6} y="35" width="3.2" height="1.4" rx="0.5" fill="#000" opacity="0.35" />
        </g>
      ))}
    </g>
  ),
  borsa: ({ u }) => (
    <g>
      <Floor u={u} rx={20} />
      {/* zaino da campo: corpo, tasca frontale con zip, spallacci */}
      <path d="M22 14 C22 8 42 8 42 14" fill="none" stroke="#1a1d20" strokeWidth="2.6" />
      <path d="M14 20 C14 14 50 14 50 20 L50 52 C50 55 14 55 14 52 Z" fill={u("bag")} stroke={EDGE} strokeWidth="0.6" />
      <path d="M16 20 C17 16 47 16 48 20 L48 24 C40 21 24 21 16 24 Z" fill="#fff" opacity="0.13" />
      <rect x="20" y="32" width="24" height="17" rx="3.4" fill="#1d4d3a" stroke={EDGE} strokeWidth="0.5" />
      <path d="M22 35 L42 35" stroke="#c9ced3" strokeWidth="0.7" strokeDasharray="0.6 0.5" />
      <rect x="38" y="33.6" width="3" height="4" rx="0.8" fill={u("m")} />
      <path d="M20 26 L44 26" stroke="#000" strokeWidth="0.6" opacity="0.35" />
      <rect x="27" y="24" width="10" height="3" rx="1.2" fill="#e6b325" />
    </g>
  ),
  supporto: ({ u }) => (
    <g>
      <Floor u={u} cy={57} rx={22} />
      {/* cavalletto pieghevole per arco: snodo centrale e tre gambe */}
      <path d="M32 26 L14 56 M32 26 L50 56 M32 26 L33 57" stroke={u("kx")} strokeWidth="2.8" strokeLinecap="round" />
      <path d="M32 26 L14 56 M32 26 L50 56" stroke="#fff" strokeWidth="0.5" opacity="0.25" strokeLinecap="round" />
      <path d="M32 8 L32 26" stroke={u("mx")} strokeWidth="3" strokeLinecap="round" />
      <path d="M24 8 C26 14 38 14 40 8" fill="none" stroke={u("r")} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="26" r="3.6" fill={u("r")} stroke={EDGE} strokeWidth="0.5" />
      <circle cx="32" cy="26" r="1.2" fill={u("m")} />
      {[14, 50, 33].map((x, i) => (
        <circle key={i} cx={x} cy={i === 2 ? 57 : 56} r="1.6" fill="#111" />
      ))}
    </g>
  ),
  accessorio: ({ u }) => (
    <g>
      <Floor u={u} rx={22} />
      {/* squadretta per il punto di incocco e chiavi a brugola */}
      <g transform="rotate(-24 32 32)">
        <rect x="6" y="28" width="46" height="7" rx="1.4" fill={u("m")} stroke={EDGE} strokeWidth="0.45" />
        {Array.from({ length: 18 }, (_, i) => (
          <rect key={i} x={8 + i * 2.4} y="28" width="0.4" height={i % 5 === 0 ? 3.6 : 2} fill="#20262b" />
        ))}
        <rect x="27" y="14" width="7" height="22" rx="1.4" fill={u("m")} stroke={EDGE} strokeWidth="0.45" />
        <circle cx="30.5" cy="18" r="1.4" fill="#20262b" />
      </g>
      <path d="M40 54 L50 54 L50 36" fill="none" stroke={u("k")} strokeWidth="3" strokeLinejoin="round" />
      <path d="M44 56 L56 56 L56 40" fill="none" stroke={u("r")} strokeWidth="3" strokeLinejoin="round" />
    </g>
  ),
  abbigliamento: ({ u }) => (
    <g>
      <Floor u={u} rx={20} />
      {/* polo della compagnia */}
      <path d="M22 10 L14 13 L4 24 L12 31 L16 27 L16 54 L48 54 L48 27 L52 31 L60 24 L50 13 L42 10 C40 15 24 15 22 10 Z" fill={u("shirt")} stroke={EDGE} strokeWidth="0.6" />
      <path d="M22 10 L26 20 L32 16 L38 20 L42 10 C40 14 24 14 22 10 Z" fill="#f4f1ea" stroke={EDGE} strokeWidth="0.4" />
      <path d="M32 16 L32 28" stroke="#0f3d2b" strokeWidth="0.8" />
      {[20, 24].map((y) => (
        <circle key={y} cx="32" cy={y} r="0.9" fill="#f4f1ea" />
      ))}
      <circle cx="41" cy="26" r="3.4" fill={u("g")} stroke={EDGE} strokeWidth="0.3" />
      <path d="M39.4 26 L42.8 26 M41.8 25 L42.8 26 L41.8 27" stroke="#5a3e10" strokeWidth="0.5" fill="none" />
      <path d="M17 30 C17 40 18 48 17 54" stroke="#000" strokeWidth="1.2" opacity="0.2" />
      <path d="M16 50 L48 50" stroke="#f4f1ea" strokeWidth="1.2" opacity="0.6" />
    </g>
  ),
  scarpe: ({ u }) => (
    <g>
      <Floor u={u} cy={53} rx={25} />
      {/* scarpa da campo con suola scolpita */}
      <path d="M6 44 C6 36 10 30 16 28 L26 22 C30 20 34 22 36 26 L44 32 C52 34 58 38 58 44 Z" fill={u("shoe")} stroke={EDGE} strokeWidth="0.6" />
      <path d="M26 22 C30 20 34 22 36 26 L32 30 C28 28 24 26 26 22 Z" fill="#f4f1ea" opacity="0.85" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${27 + i * 3} ${24 + i * 2} L${31 + i * 3} ${23 + i * 2}`} stroke="#f4f1ea" strokeWidth="0.9" strokeLinecap="round" />
      ))}
      <path d="M8 38 C20 40 40 40 56 40" stroke="#e5484d" strokeWidth="1.6" fill="none" />
      <path d="M5 44 L59 44 L58 49 C40 51 20 51 6 49 Z" fill="#e8e4da" stroke={EDGE} strokeWidth="0.5" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={9 + i * 5.4} y="48.6" width="2.6" height="1.6" fill="#3a3f45" />
      ))}
      <path d="M10 32 C14 30 18 29 22 28" stroke="#fff" strokeWidth="0.8" opacity="0.3" fill="none" />
    </g>
  ),
  altro: ({ u }) => (
    <g>
      <Floor u={u} rx={22} />
      {/* cassetta per gli attrezzi */}
      <path d="M24 20 L24 14 C24 12 40 12 40 14 L40 20" fill="none" stroke={u("mx")} strokeWidth="2.4" />
      <rect x="6" y="20" width="52" height="32" rx="3" fill={u("r")} stroke={EDGE} strokeWidth="0.6" />
      <rect x="6" y="20" width="52" height="9" rx="3" fill="#fff" opacity="0.13" />
      <path d="M6 30 L58 30" stroke="#000" strokeWidth="0.9" opacity="0.4" />
      <rect x="28" y="27.6" width="8" height="5" rx="1" fill={u("m")} stroke={EDGE} strokeWidth="0.4" />
      {[10, 54].map((x) => (
        <rect key={x} x={x - 2} y="40" width="4" height="8" rx="1" fill="#000" opacity="0.25" />
      ))}
    </g>
  ),
};

const has = (c: string) => c in ART;

export function GearArt({ category, className = "h-12 w-12", bare = false }: { category: string; className?: string; /** senza tessera di sfondo */ bare?: boolean }) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const u = (k: string) => `url(#g${raw}${k})`;
  const d = (k: string) => `g${raw}${k}`;
  const draw = ART[has(category) ? category : "altro"];
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={d("m")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#cfd6dc" />
          <stop offset="0.7" stopColor="#858f98" />
          <stop offset="1" stopColor="#3d454c" />
        </linearGradient>
        <linearGradient id={d("mx")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#59626b" />
          <stop offset="0.3" stopColor="#f4f7f9" />
          <stop offset="0.55" stopColor="#b8c1c9" />
          <stop offset="1" stopColor="#4a535b" />
        </linearGradient>
        <linearGradient id={d("k")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a636b" />
          <stop offset="0.45" stopColor="#262b30" />
          <stop offset="1" stopColor="#0f1215" />
        </linearGradient>
        <linearGradient id={d("kx")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5a636b" />
          <stop offset="0.4" stopColor="#2c3238" />
          <stop offset="1" stopColor="#0f1215" />
        </linearGradient>
        <linearGradient id={d("r")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f07a6e" />
          <stop offset="0.45" stopColor="#c8302a" />
          <stop offset="1" stopColor="#6e1512" />
        </linearGradient>
        <linearGradient id={d("l")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c98a4f" />
          <stop offset="0.55" stopColor="#8e5228" />
          <stop offset="1" stopColor="#4f2912" />
        </linearGradient>
        <linearGradient id={d("lb")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4c4f54" />
          <stop offset="1" stopColor="#141518" />
        </linearGradient>
        <linearGradient id={d("g")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbe59a" />
          <stop offset="0.5" stopColor="#d2a23d" />
          <stop offset="1" stopColor="#7c5616" />
        </linearGradient>
        <linearGradient id={d("wx")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e0ad72" />
          <stop offset="1" stopColor="#8a5529" />
        </linearGradient>
        <linearGradient id={d("bag")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3f8a68" />
          <stop offset="1" stopColor="#173d2d" />
        </linearGradient>
        <linearGradient id={d("shirt")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3f9b74" />
          <stop offset="1" stopColor="#14553b" />
        </linearGradient>
        <linearGradient id={d("shoe")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5c6670" />
          <stop offset="1" stopColor="#1d2126" />
        </linearGradient>
        <radialGradient id={d("tile")} cx="0.32" cy="0.22" r="0.95">
          <stop offset="0" stopColor="#34433b" />
          <stop offset="1" stopColor="#111613" />
        </radialGradient>
        <radialGradient id={d("sh")}>
          <stop offset="0" stopColor="#000" stopOpacity="0.5" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <pattern id={d("cf")} width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="0.8" height="1.6" fill="#fff" opacity="0.08" />
        </pattern>
        <pattern id={d("al")} width="6" height="0.8" patternUnits="userSpaceOnUse">
          <rect width="6" height="0.25" fill="#fff" opacity="0.25" />
        </pattern>
        <pattern id={d("wd")} width="14" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-36)">
          <path d="M0 1 C4 0.6 9 1.6 14 1" stroke="#7a4a1e" strokeWidth="0.35" fill="none" opacity="0.6" />
        </pattern>
        <pattern id={d("bar")} width="5" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
          <rect width="2" height="20" fill="#3a2a1e" opacity="0.85" />
        </pattern>
        <pattern id={d("mesh")} width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2.4" height="2.4" fill="none" stroke="#5c6670" strokeWidth="0.5" />
        </pattern>
        <pattern id={d("straw")} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
          <rect width="3" height="0.6" fill="#8a6a2e" opacity="0.45" />
          <rect y="1.6" width="2" height="0.4" fill="#f2dc9a" opacity="0.5" />
        </pattern>
      </defs>
      {bare ? null : (
        <g>
          <rect x="0.5" y="0.5" width="63" height="63" rx="16" fill={`url(#${d("tile")})`} />
          <rect x="0.5" y="0.5" width="63" height="63" rx="16" fill="none" stroke="#fff" strokeOpacity="0.09" />
          <path d="M8 1.5 H56" stroke="#fff" strokeOpacity="0.16" strokeLinecap="round" />
        </g>
      )}
      <g transform={bare ? undefined : "translate(32 32) scale(0.86) translate(-32 -32)"}>{draw({ u })}</g>
    </svg>
  );
}
