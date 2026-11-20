import { useId, useState } from "react";
import type { AvatarLook } from "@/lib/arcieri/avatar";

/**
 * L'arciere disegnato: in piedi di fianco, in pieno allungo verso destra.
 * Corpo, viso, capelli, barba, abiti e tutta l'attrezzatura vengono da `look`.
 * Toccandolo scocca la freccia.
 */

function shade(hex: string, k: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, "0")}`;
}

type BowShape = { top: [number, number]; bot: [number, number]; limbs: string[]; wood: boolean };

const GRIP: [number, number] = [248, 119];

function bowShape(type: string): BowShape {
  const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${x} ${238 - Number(y)}`);
  switch (type) {
    case "longbow": {
      const up = "M249 119 C252 88 250 42 238 16";
      return { top: [238, 16], bot: [238, 222], limbs: [up, mirror(up)], wood: true };
    }
    case "storico": {
      const up = "M248 102 C252 84 250 66 240 54 L250 38";
      return { top: [250, 38], bot: [250, 200], limbs: [up, mirror(up)], wood: true };
    }
    case "compound": {
      const up = "M248 92 C246 80 242 70 236 62";
      return { top: [236, 56], bot: [236, 182], limbs: [up, mirror(up)], wood: false };
    }
    case "ricurvo": {
      const up = "M248 92 C250 66 238 44 232 30 C229 22 234 16 241 18";
      return { top: [232, 28], bot: [232, 210], limbs: [up, mirror(up)], wood: true };
    }
    default: {
      // olimpico e nudo
      const up = "M248 88 C250 60 238 38 232 22 C229 13 235 8 242 11";
      return { top: [232, 20], bot: [232, 218], limbs: [up, mirror(up)], wood: false };
    }
  }
}

export function ArcherAvatar({ look, className = "h-72 w-auto", interactive = true }: { look: AvatarLook; className?: string; interactive?: boolean }) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [loose, setLoose] = useState(0);
  const flying = loose > 0;
  const skin = look.skin;
  const skinDark = shade(skin, -0.18);
  const hair = look.hairColor;
  const bow = bowShape(look.bowType);
  const kid = look.body === "ragazzo";
  const woman = look.body === "donna";
  const nock: [number, number] = [166, 104];
  const restX = 286;
  const restY = nock[1] + ((restX - nock[0]) * 10) / 83;
  const stringMid = flying ? `${GRIP[0] - 12} ${GRIP[1]}` : `${nock[0]} ${nock[1]}`;
  const riserFill = bow.wood ? `url(#${u}wood)` : `url(#${u}riser)`;
  const limbStroke = bow.wood && !look.limbs ? `url(#${u}wood)` : look.limbs || "#15191d";

  const face =
    look.face === "tondo"
      ? "M150 62 C163 62 172 71 172 84 C172 97 163 106 151 106 C139 106 129 97 129 84 C129 71 138 62 150 62 Z"
      : look.face === "squadrato"
        ? "M150 61 C163 61 171 70 171 82 C171 94 169 104 160 107 L145 107 C135 104 130 96 130 84 C130 70 138 61 150 61 Z"
        : "M150 61 C163 61 171 71 171 84 C171 97 164 107 153 108 C141 108 130 99 130 84 C130 70 138 61 150 61 Z";

  const shoot = () => {
    if (!interactive || flying) return;
    setLoose(1);
    window.setTimeout(() => setLoose(0), 1100);
  };

  return (
    <svg viewBox="40 0 300 350" className={className} role="img" aria-label="Il tuo arciere" onClick={shoot} style={{ cursor: interactive ? "pointer" : undefined }}>
      <defs>
        <linearGradient id={`${u}riser`} x1="0" x2="1">
          <stop offset="0" stopColor={shade(look.riser || "#2f6fbe", -0.45)} />
          <stop offset="0.45" stopColor={shade(look.riser || "#2f6fbe", 0.25)} />
          <stop offset="1" stopColor={shade(look.riser || "#2f6fbe", -0.55)} />
        </linearGradient>
        <linearGradient id={`${u}wood`} x1="0" x2="1">
          <stop offset="0" stopColor="#4a2b16" />
          <stop offset="0.5" stopColor="#b47a42" />
          <stop offset="1" stopColor="#5b3518" />
        </linearGradient>
        <linearGradient id={`${u}shirt`} x1="0" x2="1">
          <stop offset="0" stopColor={shade(look.shirt, -0.3)} />
          <stop offset="0.6" stopColor={look.shirt} />
          <stop offset="1" stopColor={shade(look.shirt, 0.12)} />
        </linearGradient>
        <linearGradient id={`${u}pants`} x1="0" x2="1">
          <stop offset="0" stopColor={shade(look.pants, -0.3)} />
          <stop offset="1" stopColor={shade(look.pants, 0.1)} />
        </linearGradient>
        <radialGradient id={`${u}face`} cx="65%" cy="40%" r="70%">
          <stop offset="0" stopColor={shade(skin, 0.12)} />
          <stop offset="1" stopColor={skinDark} />
        </radialGradient>
        <linearGradient id={`${u}hair`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={shade(hair, 0.18)} />
          <stop offset="1" stopColor={shade(hair, -0.35)} />
        </linearGradient>
      </defs>

      <ellipse cx="150" cy="340" rx="78" ry="7" fill="#000" opacity="0.28" />
      <g transform={kid ? "translate(150 342) scale(0.8) translate(-150 -342)" : undefined}>
        <g className="aa-breathe">
          {/* capelli dietro: lunghi, coda, treccia */}
          {look.hair === "lunghi" ? <path d="M136 70 C122 92 122 126 130 150 L148 146 C142 126 141 104 144 84 Z" fill={`url(#${u}hair)`} /> : null}
          {look.hair === "coda" ? <path d="M134 76 C120 86 116 112 122 136 C126 132 128 120 128 108 C130 96 136 88 140 82 Z" fill={`url(#${u}hair)`} /> : null}
          {look.hair === "treccia" ? (
            <g fill={`url(#${u}hair)`}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <ellipse key={i} cx={133 - i * 1.6} cy={96 + i * 11} rx={6 - i * 0.4} ry="7" stroke={shade(hair, -0.4)} strokeWidth="0.8" />
              ))}
              <path d={`M${125} 158 l-3 8 m3 -8 l1 9 m-1 -9 l4 7`} stroke={shade(hair, -0.2)} strokeWidth="1.4" />
            </g>
          ) : null}

          {/* faretra al fianco, con le frecce */}
          <g transform="translate(108 196) rotate(-16)">
            {[-5, 0, 5].map((dx, i) => (
              <g key={dx}>
                <line x1={dx} y1={-40} x2={dx} y2={-58} stroke={look.shaft || "#1d1f22"} strokeWidth="2" />
                <path d={`M${dx} -58 l-4 -10 l4 3 l4 -3 z`} fill={i === 1 ? look.cock : look.fletch} />
              </g>
            ))}
            <rect x="-10" y="-42" width="20" height="82" rx="6" fill={look.quiver} />
            <rect x="-10" y="-42" width="20" height="82" rx="6" fill="none" stroke={shade(look.quiver, -0.4)} strokeWidth="1.2" />
            <rect x="-11" y="-44" width="22" height="7" rx="2.5" fill={shade(look.quiver, -0.3)} />
            <path d="M-6 -30 v60 M6 -30 v60" stroke={shade(look.quiver, 0.3)} strokeWidth="0.8" strokeDasharray="3 3" />
          </g>
        </g>

        {/* gambe e scarpe */}
        <path d="M128 202 L148 202 L126 328 L110 326 Z" fill={`url(#${u}pants)`} />
        <path d={woman ? "M146 202 L166 202 L180 326 L166 328 Z" : "M146 202 L166 202 L182 326 L167 328 Z"} fill={`url(#${u}pants)`} />
        <path d="M106 326 C108 320 122 320 126 325 L134 331 C134 336 128 338 106 337 Z" fill={look.shoes} />
        <path d="M164 326 C166 320 180 320 184 325 L194 331 C194 336 188 338 164 337 Z" fill={look.shoes} />
        <path d="M106 335 H134 M164 335 H194" stroke="#000" strokeOpacity="0.35" strokeWidth="2" />

        <g className="aa-breathe">
          {/* busto */}
          <path
            d={
              woman
                ? "M132 122 C138 116 158 116 165 124 C169 140 162 160 159 176 C163 186 165 194 166 204 L126 204 C126 192 130 184 132 176 C126 160 126 140 132 122 Z"
                : "M127 122 C134 115 161 115 169 124 C173 142 168 172 165 204 L125 204 C121 174 121 142 127 122 Z"
            }
            fill={`url(#${u}shirt)`}
          />
          <rect x="124" y="198" width="43" height="8" rx="2" fill={shade(look.pants, -0.45)} />
          <rect x="141" y="198.5" width="7" height="7" rx="1.2" fill="none" stroke="#c9a46a" strokeWidth="1.2" />
          {/* pettorina */}
          {look.chestguard ? (
            <g>
              <path d="M149 126 C159 123 168 127 169 134 L167 160 C159 163 151 161 146 156 Z" fill={look.chestColor} />
              <path d="M149 126 C159 123 168 127 169 134 L167 160 C159 163 151 161 146 156 Z" fill="#fff" opacity="0.08" />
              <path d="M146 138 L130 128 M146 154 L128 160" stroke={shade(look.chestColor, -0.3)} strokeWidth="2.4" strokeLinecap="round" />
            </g>
          ) : null}

          {/* braccio della corda: gomito indietro, mano all'ancoraggio */}
          <path d={`M132 126 L92 116`} stroke={`url(#${u}shirt)`} strokeWidth="16" strokeLinecap="round" />
          <path d={`M93 116 L${nock[0] - 2} ${nock[1]}`} stroke={skin} strokeWidth="11" strokeLinecap="round" />
          <path d={`M93 116 L${nock[0] - 2} ${nock[1]}`} stroke={skinDark} strokeWidth="11" strokeLinecap="round" opacity="0.25" />

          {/* collo e testa */}
          <rect x="142" y="98" width="14" height="26" rx="6" fill={skinDark} />
          <g transform={kid ? "translate(150 86) scale(1.16) translate(-150 -86)" : undefined}>
            {look.hair !== "calvo" && look.hair !== "rasati" ? <path d="M130 82 C128 66 138 57 150 57 C140 64 136 74 137 88 Z" fill={`url(#${u}hair)`} /> : null}
            <path d={face} fill={`url(#${u}face)`} />
            {/* orecchio */}
            <ellipse cx="141" cy="86" rx="4.2" ry="6.4" fill={skinDark} />
            <path d="M141 82 Q138 86 141 90" stroke={shade(skin, -0.35)} strokeWidth="0.9" fill="none" />
            {/* naso, bocca */}
            <path d="M169 78 C171 84 175 89 176 92 C174 94 171 94 168 93" fill={skin} stroke={shade(skin, -0.3)} strokeWidth="0.8" />
            <path d="M162 99 Q166 101 169 98.5" stroke={shade(skin, -0.45)} strokeWidth="1.2" fill="none" strokeLinecap="round" />
            {/* occhio e sopracciglio */}
            <path d="M157.5 81 Q162 77.5 167 80.5 Q162 84 157.5 81 Z" fill="#fbf7f2" />
            <circle cx="163.6" cy="80.9" r="2.3" fill={look.eyes} />
            <circle cx="164.1" cy="80.4" r="0.7" fill="#fff" />
            <path d="M157.5 80.8 Q162 77.2 167.2 80.2" stroke="#2a1d14" strokeWidth={woman ? 1.3 : 0.9} fill="none" />
            {woman ? <path d="M166.4 79.6 l2 -1.6 M165 78.6 l1.4 -2" stroke="#2a1d14" strokeWidth="0.7" /> : null}
            <path d="M155.5 74.5 Q161.5 71 168 73.2" stroke={shade(hair, -0.2)} strokeWidth={look.brows === "folte" ? 3.2 : look.brows === "sottili" ? 1.2 : 2} strokeLinecap="round" fill="none" />
            {look.freckles ? (
              <g fill={shade(skin, -0.4)} opacity="0.55">
                {[[160, 88], [164, 90], [168, 88], [158, 91], [166, 86], [162, 86]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="0.8" />)}
              </g>
            ) : null}
            <path d="M152 93 Q158 96 163 94" stroke={shade(skin, -0.15)} strokeWidth="2" fill="none" opacity="0.5" />

            {/* barba */}
            {look.beard === "piena" || look.beard === "accenno" ? (
              <path d="M138 92 C140 104 148 113 157 113 C165 113 171 106 172 97 C168 100 163 101 159 100 L152 97 C147 97 142 95 138 92 Z" fill={shade(hair, -0.1)} opacity={look.beard === "accenno" ? 0.35 : 1} />
            ) : null}
            {look.beard === "corta" ? <path d="M143 96 C145 106 151 110 158 110 C164 110 169 105 170 99 C166 101 162 102 158 101 C153 100 148 99 143 96 Z" fill={shade(hair, -0.1)} /> : null}
            {look.beard === "pizzetto" ? <path d="M159 102 C160 108 163 111 167 110 C170 108 170 104 169 101 C166 103 162 103 159 102 Z" fill={shade(hair, -0.1)} /> : null}
            {look.beard === "piena" || look.beard === "corta" || look.beard === "baffi" ? <path d="M161 96 C164 94 169 94 173 96 C170 98 165 98 161 96 Z" fill={shade(hair, -0.15)} /> : null}

            {/* capelli davanti */}
            {look.hair === "corti" || look.hair === "coda" || look.hair === "treccia" || look.hair === "chignon" || look.hair === "lunghi" ? (
              <path d="M130 84 C127 66 138 56 151 56 C164 56 173 64 171 76 C166 70 158 68 151 71 C146 68 140 72 141 81 C138 83 135 87 133 93 C131 90 130 87 130 84 Z" fill={`url(#${u}hair)`} />
            ) : null}
            {look.hair === "rasati" ? <path d="M131 82 C129 66 139 58 151 58 C163 58 171 65 170 75 C164 70 157 69 151 71 C146 68 141 72 141 81 C138 83 135 86 133 90 Z" fill={hair} opacity="0.55" /> : null}
            {look.hair === "mossi" ? (
              <path d="M130 86 C125 64 138 53 152 54 C167 55 176 64 172 78 C170 72 166 70 162 72 C160 68 155 67 151 71 C147 67 141 71 142 80 C138 82 136 88 134 95 C131 92 130 89 130 86 Z" fill={`url(#${u}hair)`} />
            ) : null}
            {look.hair === "ricci" ? (
              <g fill={`url(#${u}hair)`}>
                {[[136, 70, 8], [144, 61, 8], [155, 58, 8], [165, 63, 7], [170, 72, 5.5], [134, 82, 7], [138, 92, 5.5], [148, 66, 6]].map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}
              </g>
            ) : null}
            {look.hair === "chignon" ? <circle cx="135" cy="64" r="9" fill={`url(#${u}hair)`} stroke={shade(hair, -0.35)} strokeWidth="0.8" /> : null}
            {look.hair === "coda" || look.hair === "treccia" ? <circle cx="135" cy="80" r="3.2" fill={look.hatColor} /> : null}

            {/* copricapo */}
            {look.hat === "berretto" ? (
              <g>
                <path d="M130 76 C129 60 141 53 153 54 C165 55 172 63 172 72 L131 77 Z" fill={look.hatColor} />
                <path d="M168 71 C176 70 185 71 190 74 C186 77 178 77 170 76 Z" fill={shade(look.hatColor, -0.3)} />
                <circle cx="151" cy="55" r="1.8" fill={shade(look.hatColor, -0.3)} />
              </g>
            ) : null}
            {look.hat === "fascia" ? <path d="M130 74 C142 69 160 68 171 71 L171 77 C160 74 142 75 131 80 Z" fill={look.hatColor} /> : null}
            {look.hat === "piuma" ? (
              <g>
                <path d="M126 76 C128 58 142 50 156 52 C166 54 172 62 174 72 C162 70 146 72 126 76 Z" fill={look.hatColor} />
                <path d="M122 78 C140 72 162 70 182 74" stroke={shade(look.hatColor, -0.35)} strokeWidth="3" strokeLinecap="round" fill="none" />
                <path d="M136 60 C126 44 114 36 100 34 C112 42 120 52 132 62 Z" fill="#f4f1ea" stroke="#c9c0ae" strokeWidth="0.6" />
              </g>
            ) : null}
            {look.glasses ? (
              <g fill="none" stroke="#1d2126" strokeWidth="1.3">
                <circle cx="163.5" cy="81" r="5.2" fill="#a8d8ff" fillOpacity="0.18" />
                <path d="M158.3 81 L143 82" />
              </g>
            ) : null}
          </g>

          {/* corda e freccia (la freccia scocca quando tocchi l'arciere) */}
          <path d={`M${bow.top[0]} ${bow.top[1]} L${stringMid} L${bow.bot[0]} ${bow.bot[1]}`} stroke={look.string || "#f4f1ea"} strokeWidth="1.1" fill="none" opacity="0.9" />
          <g className={flying ? "aa-loose" : undefined}>
            <line x1={nock[0]} y1={nock[1]} x2={restX} y2={restY} stroke={look.shaft || "#1d1f22"} strokeWidth="2.4" strokeLinecap="round" />
            <path d={`M${restX - 1} ${restY - 2.4} L${restX + 9} ${restY + 0.6} L${restX - 1} ${restY + 2.6} Z`} fill="#c9d0d8" />
            <path d={`M170 ${nock[1] + 0.5} L176 ${nock[1] - 7} L194 ${nock[1] - 4.8} L196 ${nock[1] + 2.4} Z`} fill={look.cock} />
            <path d={`M170 ${nock[1] + 0.5} L175 ${nock[1] + 8} L193 ${nock[1] + 9} L196 ${nock[1] + 2.4} Z`} fill={look.fletch} />
            <rect x={nock[0] - 4} y={nock[1] - 1.8} width="6" height="3.6" rx="1" fill={look.nock} />
          </g>
          {/* mano della corda con il guantino/patella */}
          <circle cx={nock[0] - 1} cy={nock[1] + 1} r="7" fill={skin} />
          <path d={`M${nock[0] + 1} ${nock[1] - 6} h7 a2 2 0 0 1 2 2 v10 a2 2 0 0 1 -2 2 h-7 z`} fill={look.tab} />
          <path d={`M${nock[0] + 3} ${nock[1] - 3} h5 M${nock[0] + 3} ${nock[1] + 1} h5 M${nock[0] + 3} ${nock[1] + 5} h5`} stroke={shade(look.tab, 0.35)} strokeWidth="0.7" />

          {/* braccio dell'arco con parabraccio */}
          <path d="M160 126 L205 121" stroke={`url(#${u}shirt)`} strokeWidth="16" strokeLinecap="round" />
          <path d="M204 121 L239 119" stroke={skin} strokeWidth="11" strokeLinecap="round" />
          <path d="M209 121 L233 119.4" stroke={look.armguard} strokeWidth="13.5" strokeLinecap="round" />
          <path d="M213 115 l2 12 M219 114.6 l2 12 M225 114.2 l2 12" stroke={shade(look.armguard, 0.4)} strokeWidth="0.8" />

          {/* arco */}
          {bow.limbs.map((d) => (
            <path key={d} d={d} stroke={limbStroke} strokeWidth={look.bowType === "compound" ? 6.5 : 5.2} strokeLinecap="round" fill="none" />
          ))}
          {look.bowType === "compound" ? (
            <g>
              <circle cx={bow.top[0]} cy={bow.top[1]} r="7" fill="#b7c0c8" stroke="#2a2f35" />
              <circle cx={bow.bot[0]} cy={bow.bot[1]} r="7" fill="#b7c0c8" stroke="#2a2f35" />
              <path d={`M${bow.top[0] + 3} ${bow.top[1]} L${bow.bot[0] + 5} ${bow.bot[1]}`} stroke="#9aa3ad" strokeWidth="0.8" />
            </g>
          ) : null}
          {look.bowType === "longbow" ? <rect x="245" y="108" width="8" height="22" rx="3" fill="#3a2a1e" /> : <rect x="243" y={look.bowType === "storico" ? 100 : 86} width="10" height={look.bowType === "storico" ? 38 : 66} rx="4" fill={riserFill} />}
          {look.bowType === "olimpico" ? (
            <g>
              <path d="M253 138 L306 140" stroke="#1d2126" strokeWidth="3" strokeLinecap="round" />
              <rect x="302" y="135" width="9" height="10" rx="2" fill="#2a2f35" />
              <path d="M253 96 L270 84 L270 70" stroke="#9aa3ad" strokeWidth="1.6" fill="none" />
              <circle cx="270" cy="68" r="3" fill="none" stroke="#e3a21a" strokeWidth="1.6" />
            </g>
          ) : null}
          {look.bowType === "compound" ? (
            <g>
              <path d="M253 134 L300 136" stroke="#1d2126" strokeWidth="3.2" strokeLinecap="round" />
              <circle cx="268" cy="96" r="6" fill="none" stroke="#e3a21a" strokeWidth="2" />
              <path d="M253 104 L262 98" stroke="#9aa3ad" strokeWidth="1.6" />
            </g>
          ) : null}
          {look.bowType === "nudo" ? <rect x="250" y="146" width="7" height="6" rx="1.5" fill="#9aa3ad" /> : null}
          {/* mano dell'arco */}
          <circle cx={GRIP[0] - 2} cy={GRIP[1]} r="8" fill={skin} />
          <path d={`M${GRIP[0] - 1} ${GRIP[1] - 6} q5 2 5 6 M${GRIP[0] - 1} ${GRIP[1]} q5 2 5 6`} stroke={skinDark} strokeWidth="1" fill="none" />
        </g>
      </g>
    </svg>
  );
}
