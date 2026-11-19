import { ArrowArt, FLETCH_SHAPES, POINT_TYPES } from "./arrow-art";
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

export function BowIcon({ type, className = "h-16 w-16", color = "currentColor" }: { type: string; className?: string; color?: string }) {
  const stroke = { fill: "none", stroke: color, strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      {type === "compound" ? (
        <>
          <path d="M30 6 L30 58" {...stroke} />
          <circle cx="30" cy="8" r="5" {...stroke} />
          <circle cx="30" cy="56" r="5" {...stroke} />
          <path d="M30 22 L24 32 L30 42" {...stroke} strokeWidth={4} />
          <path d="M25 8 L18 32 L25 56" {...stroke} strokeWidth={1.4} />
          <path d="M30 32 L54 32" {...stroke} strokeWidth={2} />
          <circle cx="40" cy="27" r="2.5" fill={color} />
        </>
      ) : type === "longbow" ? (
        <>
          <path d="M34 4 C46 18 46 46 34 60" {...stroke} />
          <path d="M34 4 L34 60" {...stroke} strokeWidth={1.2} />
          <path d="M40 29 L44 29 L44 35 L40 35" {...stroke} strokeWidth={2} />
        </>
      ) : type === "storico" ? (
        <>
          <path d="M32 6 C24 8 22 14 28 18 C40 24 40 40 28 46 C22 50 24 56 32 58" {...stroke} />
          <path d="M32 6 L32 58" {...stroke} strokeWidth={1.2} />
        </>
      ) : (
        <>
          {/* ricurvo: olimpico (con mirino e stabilizzatore), nudo, tradizionale */}
          <path d="M28 4 C22 6 22 10 26 12 C36 18 38 26 36 32 C38 38 36 46 26 52 C22 54 22 58 28 60" {...stroke} />
          <path d="M28 4 L28 60" {...stroke} strokeWidth={1.2} />
          {type === "olimpico" ? (
            <>
              <path d="M38 30 L60 30" {...stroke} strokeWidth={2} />
              <circle cx="60" cy="30" r="2.5" fill={color} />
              <path d="M38 24 L48 18 L48 14" {...stroke} strokeWidth={1.6} />
              <rect x="46" y="11" width="4" height="4" fill={color} />
              <path d="M37 36 L30 44" {...stroke} strokeWidth={1.6} />
            </>
          ) : null}
          {type === "ricurvo" ? <path d="M33 29 L39 29 L39 35 L33 35" {...stroke} strokeWidth={2} /> : null}
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
  point?: string;
  className?: string;
}) {
  return <ArrowArt {...look} number={number != null && number !== "" ? `${number}` : undefined} className={className} />;
}

export function CategoryIcon({ category, className = "h-8 w-8" }: { category: string; className?: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (category) {
    case "arco":
      return <BowIcon type="olimpico" className={className} />;
    case "freccia":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <path d="M5 27 L27 5" {...s} />
          <path d="M27 5 L20 6 M27 5 L26 12" {...s} />
          <path d="M5 27 L5 21 M5 27 L11 27 M8 24 L8 19 M8 24 L13 24" {...s} />
        </svg>
      );
    case "corda":
      return <svg viewBox="0 0 32 32" className={className} aria-hidden><path d="M10 3 C4 12 4 20 10 29 M10 3 L10 29" {...s} /><path d="M10 14 L14 14 M10 18 L14 18" {...s} /></svg>;
    case "mirino":
      return <svg viewBox="0 0 32 32" className={className} aria-hidden><circle cx="16" cy="16" r="9" {...s} /><path d="M16 3 L16 10 M16 22 L16 29 M3 16 L10 16 M22 16 L29 16" {...s} /></svg>;
    case "stabilizzatore":
      return <svg viewBox="0 0 32 32" className={className} aria-hidden><path d="M4 16 L26 16" {...s} /><rect x="24" y="12" width="5" height="8" rx="1" {...s} /><path d="M8 16 L4 24 M8 16 L4 8" {...s} /></svg>;
    case "bersaglio":
      return <svg viewBox="0 0 32 32" className={className} aria-hidden><circle cx="16" cy="16" r="12" {...s} /><circle cx="16" cy="16" r="7" {...s} /><circle cx="16" cy="16" r="2.5" fill="currentColor" /></svg>;
    case "faretra":
      return <svg viewBox="0 0 32 32" className={className} aria-hidden><path d="M10 10 L22 10 L20 29 L12 29 Z" {...s} /><path d="M13 10 L11 3 M16 10 L16 2 M19 10 L21 3" {...s} /></svg>;
    case "parabraccio":
    case "guantino":
      return <svg viewBox="0 0 32 32" className={className} aria-hidden><path d="M9 6 L23 6 L21 26 L11 26 Z" {...s} /><path d="M11 12 L21 12 M11 18 L21 18" {...s} /></svg>;
    case "rest":
      return <svg viewBox="0 0 32 32" className={className} aria-hidden><path d="M6 22 L20 22 L26 12" {...s} /><path d="M6 22 L6 28" {...s} /></svg>;
    default:
      return <svg viewBox="0 0 32 32" className={className} aria-hidden><rect x="6" y="9" width="20" height="16" rx="3" {...s} /><path d="M12 9 L12 6 L20 6 L20 9" {...s} /></svg>;
  }
}
