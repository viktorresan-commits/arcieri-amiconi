import { useMemo, type ReactNode } from "react";
import { AVATAR_DEFAULT, AVATAR_KEY, type AvatarLook } from "@/lib/arcieri/avatar";
import { useLocalState } from "@/lib/arcieri/local-store";
import { useMainGear } from "@/lib/arcieri/main-gear";
import { ArcherAvatar } from "./archer-avatar";

const SHAFT_BY_MATERIAL: Record<string, string> = { legno: "#c99a5e", carbonio: "#1d1f22", alluminio: "#9aa7b2", "carbo-alluminio": "#5b6670", bambu: "#c9b46a" };
const BOW_IDS = ["olimpico", "compound", "nudo", "longbow", "ricurvo", "storico"];

/** Aspetto salvato + (se scelto) arco e frecce dell'attrezzatura principale. */
export function useAvatar() {
  const [look, setLook] = useLocalState<AvatarLook>(AVATAR_KEY, AVATAR_DEFAULT);
  const main = useMainGear();
  const shown = useMemo<AvatarLook>(() => {
    if (!look.useMain || !main) return look;
    const b = main.bowSpecs ?? {};
    const a = main.arrowSpecs ?? {};
    return {
      ...look,
      bowType: BOW_IDS.includes(b.bowType) ? b.bowType : look.bowType,
      riser: b.riser || look.riser,
      limbs: b.limbs || look.limbs,
      fletch: a.fletch || look.fletch,
      cock: a.cock || look.cock,
      nock: a.nock || look.nock,
      shaft: a.shaft || SHAFT_BY_MATERIAL[a.material ?? ""] || look.shaft,
    };
  }, [look, main]);
  return { look, setLook, shown, main };
}

/** Il campo di tiro dietro l'arciere: cielo al tramonto, colline, un paglione lontano. */
export function AvatarScene({ look, children, height = "h-72", interactive = true }: { look: AvatarLook; children?: ReactNode; height?: string; interactive?: boolean }) {
  return (
    <div className={`aa-avatar-stage ${height}`}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="aa-sun" cx="78%" cy="22%" r="40%">
            <stop offset="0" stopColor="#fff2cc" stopOpacity="0.95" />
            <stop offset="0.25" stopColor="#ffd98a" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="300" fill="url(#aa-sun)" />
        <path d="M0 196 C40 170 80 176 120 186 C170 160 220 168 260 182 C300 164 350 166 400 184 V220 H0 Z" fill="#5f7d8f" opacity="0.75" />
        <path d="M0 210 C50 194 110 200 160 208 C220 192 290 196 400 206 V230 H0 Z" fill="#46684f" />
        {Array.from({ length: 16 }, (_, i) => (
          <g key={i} transform={`translate(${i * 27 + (i % 2) * 6} ${206 - (i % 3) * 2})`}>
            <rect x="-1.2" y="0" width="2.4" height="8" fill="#3a2a1e" />
            <ellipse cx="0" cy="-3" rx={7 + (i % 3)} ry={9 + (i % 2) * 2} fill={i % 2 ? "#36583a" : "#2f4d33"} />
          </g>
        ))}
        <rect y="216" width="400" height="84" fill="#4f7340" />
        <path d="M0 236 H400 M0 258 H400 M0 284 H400" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="6" />
        {/* paglione lontano verso cui tira */}
        <g transform="translate(352 196)">
          <path d="M-8 22 L-12 40 M8 22 L12 40" stroke="#6b4a2b" strokeWidth="2" />
          <rect x="-12" y="-4" width="24" height="26" rx="2" fill="#c9a46a" />
          <circle cx="0" cy="9" r="9" fill="#f4f1ea" />
          <circle cx="0" cy="9" r="7" fill="#1a1c1e" />
          <circle cx="0" cy="9" r="5.2" fill="#2a6294" />
          <circle cx="0" cy="9" r="3.4" fill="#c4473d" />
          <circle cx="0" cy="9" r="1.7" fill="#e6b325" />
        </g>
        {/* raggi di luce */}
        <path d="M312 66 L180 300 L240 300 Z" fill="#fff4d6" opacity="0.07" />
        <path d="M312 66 L300 300 L360 300 Z" fill="#fff4d6" opacity="0.06" />
      </svg>
      <div className="absolute bottom-0 left-[-6%] h-[96%]">
        <ArcherAvatar look={look} className="h-full w-auto drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)]" interactive={interactive} />
      </div>
      {children}
    </div>
  );
}
