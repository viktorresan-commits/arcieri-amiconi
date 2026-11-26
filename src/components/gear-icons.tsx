import { ArrowArt, FLETCH_SHAPES, POINT_TYPES } from "./arrow-art";
import { BowArt } from "./bow-art";
import { GearArt } from "./gear-art";
import type { IconName } from "./icons";
/** Disegni dell'attrezzatura: archi per tipo, frecce con i loro colori, icone per categoria. */

export const BOW_TYPES = [
  { id: "olimpico", label: "Olimpico" },
  { id: "compound", label: "Compound" },
  { id: "nudo", label: "Arco nudo" },
  { id: "longbow", label: "Longbow" },
  { id: "ricurvo", label: "Ricurvo tradizionale" },
  { id: "storico", label: "Storico / a cavallo" },
  { id: "asiatico", label: "Asiatico (corno)" },
  { id: "flatbow", label: "Flatbow" },
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

export function BowIcon({ type, className = "h-16 w-16", riser = "", limbs = "", wood = "" }: { type: string; className?: string; color?: string; riser?: string; limbs?: string; wood?: string }) {
  return <BowArt type={type} riser={riser} limbs={limbs} wood={wood} className={className} />;
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

/** Icone di categoria: la stessa tessera a linee di tutta l'app, nel colore scelto. */
export const CATEGORY_GLYPH: Record<string, IconName> = {
  arco: "bow",
  freccia: "arrow",
  aste: "shaft",
  punte: "point",
  alette: "fletch",
  cocche: "nock",
  corda: "bowstring",
  mirino: "sight",
  rest: "rest",
  stabilizzatore: "stabilizer",
  parabraccio: "armguard",
  guantino: "hand",
  sgancio: "release",
  pettorina: "chestguard",
  faretra: "quiver",
  bersaglio: "target",
  custodia: "bowcase",
  borsa: "bag",
  supporto: "bowstand",
  accessorio: "gear",
  abbigliamento: "shirt",
  scarpe: "shoe",
  altro: "archer",
};

export function CategoryIcon({ category, className = "h-8 w-8" }: { category: string; className?: string }) {
  // oggetto disegnato con i suoi materiali; il vecchio simbolo resta per chi lo chiede per nome (CATEGORY_GLYPH)
  return <GearArt category={category} className={["shrink-0", className].filter(Boolean).join(" ")} />;
}
