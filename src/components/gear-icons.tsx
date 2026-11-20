import { useId } from "react";
import { ArrowArt, FLETCH_SHAPES, POINT_TYPES } from "./arrow-art";
import { RealIcon } from "./real-icons";
/** Disegni dell'attrezzatura: archi per tipo, frecce con i loro colori, icone per categoria. */

export const BOW_TYPES = [
  { id: "olimpico", label: "Olimpico" },
  { id: "compound", label: "Compound" },
  { id: "nudo", label: "Arco nudo" },
  { id: "longbow", label: "Longbow" },
  { id: "ricurvo", label: "Ricurvo tradizionale" },
  { id: "storico", label: "Storico / a cavallo" },
] as const;

export const SHAFT_MATERIALS = [
  { id: "legno", label: "Legno", color: "#d8b07a" },
  { id: "carbonio", label: "Carbonio", color: "#2a2d31" },
  { id: "alluminio", label: "Alluminio", color: "#9aa7b2" },
  { id: "carbo-alluminio", label: "Carbo-alluminio", color: "#5b6670" },
  { id: "bambu", label: "Bambù", color: "#c9b46a" },
] as const;

export const FLETCH_TYPES = FLETCH_SHAPES;
export { POINT_TYPES };

export const ARROW_USE = [
  { id: "entrambi", label: "Gara e allenamento" },
  { id: "gara", label: "Gara" },
  { id: "allenamento", label: "Allenamento" },
] as const;

export const SWATCHES = ["#d63a2f", "#e6b325", "#2f7fd1", "#3d9b74", "#f4f1ea", "#14181c", "#e07a2f", "#c084fc", "#ff5fa2", "#7ec8e3"];

/**
 * Arco disegnato come un oggetto vero: legno o metallo, flettenti con riflessi, corda, accessori.
 * Ogni tipo ha la sua forma (olimpico con mirino e stabilizzatore, compound con camme, longbow a D, ...).
 */
/** Lunghezze tipiche (pollici) per tipo di arco: scelte rapide nella scheda. */
export const BOW_LENGTHS: Record<string, number[]> = {
  olimpico: [62, 64, 66, 68, 70, 72],
  nudo: [60, 62, 64, 66, 68, 70],
  compound: [30, 32, 34, 36, 38, 40],
  longbow: [64, 66, 68, 70, 72],
  ricurvo: [56, 58, 60, 62, 64, 66],
  storico: [44, 48, 50, 52, 54, 58],
};

/** Colori del riser (impugnatura) e dei flettenti, per disegnare l'arco come il tuo. */
export const RISER_COLORS = ["#2f6fbe", "#1d2126", "#b02a2a", "#3fae6a", "#e6b325", "#c9c9c9", "#7a4a26", "#7c3aed", "#e07a2f", "#f4f1ea"];
export const LIMB_COLORS = ["#15191d", "#9b6334", "#5b3618", "#f4f1ea", "#2f6fbe", "#b02a2a", "#3d9b74", "#e6b325"];

function hexShade(hex: string, k: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, "0")}`;
}

export function BowIcon({ type, className = "h-16 w-16", riser = "", limbs = "" }: { type: string; className?: string; color?: string; riser?: string; limbs?: string }) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  const wood = type === "longbow" || type === "ricurvo" || type === "storico";
  const limb = `url(#${u}l)`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${u}l`} x1="0" x2="1">
          {limbs ? (
            <>
              <stop offset="0" stopColor={hexShade(limbs, -0.6)} />
              <stop offset="0.45" stopColor={limbs} />
              <stop offset="0.62" stopColor={hexShade(limbs, 0.35)} />
              <stop offset="1" stopColor={hexShade(limbs, -0.5)} />
            </>
          ) : wood ? (
            <>
              <stop offset="0" stopColor="#3c2414" />
              <stop offset="0.4" stopColor="#9b6334" />
              <stop offset="0.65" stopColor="#d9a066" />
              <stop offset="1" stopColor="#5b3618" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#0d1013" />
              <stop offset="0.45" stopColor="#4a525c" />
              <stop offset="0.6" stopColor="#7d868f" />
              <stop offset="1" stopColor="#15191d" />
            </>
          )}
        </linearGradient>
        <linearGradient id={`${u}r`} x1="0" x2="1">
          <stop offset="0" stopColor={riser ? hexShade(riser, -0.4) : type === "compound" ? "#1f5c38" : "#2f6fbe"} />
          <stop offset="0.5" stopColor={riser ? hexShade(riser, 0.3) : type === "compound" ? "#3fae6a" : "#6fa8f0"} />
          <stop offset="1" stopColor={riser ? hexShade(riser, -0.6) : type === "compound" ? "#14391f" : "#1d3f73"} />
        </linearGradient>
        <linearGradient id={`${u}m`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f5f7f9" />
          <stop offset="0.5" stopColor="#a3abb4" />
          <stop offset="1" stopColor="#4c535b" />
        </linearGradient>
        <linearGradient id={`${u}g`} x1="0" x2="1">
          <stop offset="0" stopColor="#2b1a10" />
          <stop offset="1" stopColor="#7a4a26" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="61" rx="14" ry="1.8" fill="#000" opacity="0.25" />
      {type === "compound" ? (
        <>
          <path d="M28 10 C24 18 24 24 29 26 M28 54 C24 46 24 40 29 38" fill="none" stroke={limb} strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="27" cy="9" r="5" fill={`url(#${u}m)`} stroke="#2a2f35" strokeWidth="0.8" />
          <circle cx="27" cy="55" r="5" fill={`url(#${u}m)`} stroke="#2a2f35" strokeWidth="0.8" />
          <circle cx="27" cy="9" r="1.6" fill="#2a2f35" />
          <circle cx="27" cy="55" r="1.6" fill="#2a2f35" />
          <path d="M22.5 10 L22.5 54" stroke="#f4f1ea" strokeWidth="0.9" />
          <path d="M31 9 L25 54 M24 9 L30 55" stroke="#9aa3ad" strokeWidth="0.6" />
          <path d="M29 24 Q37 32 29 40 L33 40 Q41 32 33 24 Z" fill={`url(#${u}r)`} />
          <rect x="30" y="29" width="5" height="9" rx="2" fill={`url(#${u}g)`} />
          <path d="M35 33 H58" stroke="#1d2126" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="54" y="30.5" width="6" height="5" rx="1.4" fill="#2a2f35" />
          <path d="M36 27 L46 22 V18" stroke="#9aa3ad" strokeWidth="1.2" fill="none" />
          <circle cx="46" cy="17" r="3" fill="none" stroke="#e3a21a" strokeWidth="1.4" />
        </>
      ) : type === "longbow" ? (
        <>
          <path d="M30 4 C46 16 46 48 30 60" fill="none" stroke={limb} strokeWidth="4.6" strokeLinecap="round" />
          <path d="M31.5 7 C44 18 44 46 31.5 57" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.9" />
          <path d="M29.5 5 L29.5 59" stroke="#f4f1ea" strokeWidth="0.9" />
          <rect x="38.5" y="27.5" width="6" height="9" rx="2" fill={`url(#${u}g)`} />
          <path d="M38.8 29 h5.4 M38.8 31 h5.4 M38.8 33 h5.4 M38.8 35 h5.4" stroke="#d9a066" strokeWidth="0.4" />
        </>
      ) : type === "storico" ? (
        <>
          <path d="M33 4 C24 6 22 13 28 17 C40 24 40 40 28 47 C22 51 24 58 33 60" fill="none" stroke={limb} strokeWidth="4.2" strokeLinecap="round" />
          <path d="M33 4 C29 4 27 6 27 8 M33 60 C29 60 27 58 27 56" stroke="#e6c25a" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M31.5 5 L31.5 59" stroke="#f4f1ea" strokeWidth="0.9" />
          <rect x="33" y="28" width="5.5" height="8" rx="2" fill="#7a1f1a" />
          <path d="M33 30 h5.5 M33 34 h5.5" stroke="#e6c25a" strokeWidth="0.6" />
        </>
      ) : (
        <>
          {/* ricurvo: olimpico, nudo, tradizionale */}
          <path d="M33 22 C25 17 22 11 26 6 C27 4.8 29 5 29.4 6.8" fill="none" stroke={limb} strokeWidth="4.4" strokeLinecap="round" />
          <path d="M33 42 C25 47 22 53 26 58 C27 59.2 29 59 29.4 57.2" fill="none" stroke={limb} strokeWidth="4.4" strokeLinecap="round" />
          <path d="M32 21.5 C26.5 17 24.5 12 27 8" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="0.9" />
          <path d="M28.4 6.8 L28.4 57.2" stroke="#f4f1ea" strokeWidth="0.9" />
          {type === "ricurvo" && !riser ? (
            <path d="M31 20 Q40 32 31 44 L36 44 Q44 32 36 20 Z" fill={limb} />
          ) : (
            <path d="M31 19 Q40 32 31 45 L36 45 Q44 32 36 19 Z" fill={`url(#${u}r)`} />
          )}
          <rect x="33" y="28.5" width="5" height="8" rx="2" fill={`url(#${u}g)`} />
          {type === "olimpico" ? (
            <>
              <path d="M39 33 H60" stroke="#1d2126" strokeWidth="2" strokeLinecap="round" />
              <rect x="56" y="30.5" width="5" height="5" rx="1.2" fill="#2a2f35" />
              <path d="M39 37 L46 44" stroke="#1d2126" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M38 24 L49 19 V13" stroke="#9aa3ad" strokeWidth="1.2" fill="none" />
              <rect x="47" y="10" width="4" height="4" rx="1" fill="#e3a21a" />
              <path d="M37 27 h3" stroke="#e3a21a" strokeWidth="1.2" />
            </>
          ) : null}
          {type === "nudo" ? <rect x="37" y="38" width="5" height="4" rx="1" fill={`url(#${u}m)`} /> : null}
        </>
      )}
    </svg>
  );
}

/** Freccia orizzontale con asta, impennaggio, cocca, punta e numero (stesso disegno della Home). */
export function ArrowIcon({
  number,
  className = "h-10 w-full",
  ...look
}: {
  material?: string;
  shaft?: string;
  fletch?: string;
  cock?: string;
  nock?: string;
  wrap?: string;
  number?: string | number;
  fletchType?: string;
  fletchStyle?: string;
  fletch2?: string;
  point?: string;
  className?: string;
}) {
  return <ArrowArt {...look} number={number != null && number !== "" ? `${number}` : undefined} className={className} />;
}

/** Icone di categoria a colori: gli stessi oggetti illustrati del resto dell'app. */
export function CategoryIcon({ category, className = "h-8 w-8" }: { category: string; className?: string }) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  const metal = (
    <linearGradient id={`${u}m`} x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stopColor="#f5f7f9" />
      <stop offset="0.5" stopColor="#a3abb4" />
      <stop offset="1" stopColor="#4c535b" />
    </linearGradient>
  );
  const leather = (
    <linearGradient id={`${u}c`} x1="0" x2="1">
      <stop offset="0" stopColor="#4a2b16" />
      <stop offset="0.45" stopColor="#a8703e" />
      <stop offset="1" stopColor="#5b3518" />
    </linearGradient>
  );
  switch (category) {
    case "arco":
      return <BowIcon type="olimpico" className={className} />;
    case "freccia":
    case "faretra":
    case "bersaglio":
    case "mirino":
      return <RealIcon name={category === "freccia" ? "duel" : category === "faretra" ? "quiver" : category === "bersaglio" ? "target" : "sight3"} size={64} className={className} />;
    case "corda":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <defs>{leather}</defs>
          <ellipse cx="16" cy="17" rx="11" ry="8" fill="none" stroke="#f4f1ea" strokeWidth="1.6" />
          <ellipse cx="16" cy="17" rx="8" ry="5.5" fill="none" stroke="#d6dbe1" strokeWidth="1.4" />
          <ellipse cx="16" cy="17" rx="5" ry="3.2" fill="none" stroke="#f4f1ea" strokeWidth="1.2" />
          <rect x="22" y="13" width="5" height="3" rx="1" fill="#2a2f35" />
          <circle cx="9" cy="10" r="2" fill="#e3a21a" />
        </svg>
      );
    case "stabilizzatore":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <defs>{metal}</defs>
          <rect x="3" y="14.5" width="20" height="3" rx="1.5" fill="#1d2126" />
          <rect x="4" y="15" width="18" height="0.8" rx="0.4" fill="#fff" opacity="0.35" />
          <rect x="22" y="11" width="4" height="10" rx="1.4" fill={`url(#${u}m)`} />
          <rect x="26.5" y="12" width="3" height="8" rx="1.2" fill={`url(#${u}m)`} />
          <circle cx="4" cy="16" r="2.2" fill="#2f6fbe" />
        </svg>
      );
    case "parabraccio":
    case "guantino":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <defs>{leather}</defs>
          <path d="M8 5 H24 L22 27 H10 Z" fill={`url(#${u}c)`} />
          <path d="M9 11 H23 M9.5 18 H22.5" stroke="#2b1a10" strokeWidth="1.6" />
          <path d="M10 6.5 V26 M22 6.5 V26" stroke="#e6c25a" strokeWidth="0.5" strokeDasharray="1 1" />
          <circle cx="22.5" cy="11" r="1" fill="#d6dbe1" />
          <circle cx="22" cy="18" r="1" fill="#d6dbe1" />
        </svg>
      );
    case "rest":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <defs>{metal}</defs>
          <rect x="4" y="18" width="14" height="8" rx="2" fill={`url(#${u}m)`} />
          <path d="M16 20 L25 11" stroke="#1d2126" strokeWidth="2" strokeLinecap="round" />
          <circle cx="25" cy="11" r="2" fill="#e3a21a" />
          <path d="M3 13 H29" stroke="#2a2f35" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <defs>{leather}</defs>
          <rect x="5" y="10" width="22" height="16" rx="3" fill={`url(#${u}c)`} />
          <path d="M12 10 V7 H20 V10" fill="none" stroke="#2b1a10" strokeWidth="1.8" />
          <rect x="5" y="15" width="22" height="2" fill="#2b1a10" opacity="0.5" />
          <rect x="14.5" y="14" width="3" height="4" rx="0.8" fill="#e6c25a" />
        </svg>
      );
  }
}
