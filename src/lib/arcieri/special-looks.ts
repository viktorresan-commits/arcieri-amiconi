/**
 * Abiti su misura: disegnati sulle foto di un arciere e riservati a lui. Li vede e li indossa solo
 * chi ne è il titolare (nome e cognome del profilo); per tutti gli altri non esistono.
 */
import type { AvatarLook } from "./avatar";

type Owner = { given: string; family: string };
export type SpecialLook = {
  id: string;
  /** titolare (o titolari: lo stesso costume può essere di più persone) */
  owner: Owner;
  owners?: Owner[];
  /** lo vede anche il fondatore (per provarlo prima di regalarlo) */
  founder?: boolean;
  label: string;
  motto: string;
  look: Partial<AvatarLook>;
};

/** il viso di Simone (solo per l'anteprima: sul suo profilo resta il suo) */
export const SIMONE_FACE: Partial<AvatarLook> = { body: "uomo", skin: "#c99572", hair: "corti", hairColor: "#2a1a12", beard: "piena", stache: "folti", beardColor: "#24160e", eyes: "#3b2a1d", brows: "folte", face: "allungato", nose: "dritto", expression: "sorriso" };

export const SPECIAL_LOOKS: SpecialLook[] = [
  {
    id: "simone-inverno",
    owner: { given: "Simone", family: "Salimbeni" },
    label: "Simone · Inverno in montagna",
    motto: "Cuffia, softshell azzurro e pantaloni da trekking arancio",
    look: {
      style: "moderno", top: "giacca", shirt: "#3f7fa6", trim: "#1b2f4a", sleeves: "", pattern: "nessuno", emblem: "nessuno",
      bottom: "cargo", pants: "#c4622d", footwear: "scarponi", shoes: "#3a2a1e",
      hat: "cuffia", hatColor: "#2f7a9a", cape: false, cowl: false, fur: false, scarf: false, mask: false, sash: false, straps: false, wraps: false,
      belt: "sottile", beltColor: "#2a1a12", gloves: false, necklace: false, amulet: false, pouch: false, pendant: "nessuno", eyepatch: "nessuna",
      quiverPlace: "fianco", quiver: "#2a1a12", quiverStyle: "cuoio", chestguard: false, bracers: "",
      bowType: "longbow", useMain: false, riser: "#7a4a22", limbs: "#8a5a2a", string: "#f4f1ea", fletch: "#2f6f3a", cock: "#e6e6e6", nock: "#f4f1ea", shaft: "#7a5a32",
      scene: "montagna", frame: "nessuna", special: "simone-inverno",
    },
  },
  {
    id: "simone-medievale",
    owner: { given: "Simone", family: "Salimbeni" },
    label: "Simone · Arciere storico",
    motto: "Cappuccio di lana, tunica verde e bandoliera con lo stemma",
    look: {
      style: "medievale", top: "tunica", shirt: "#1f7a4a", trim: "#efe9dc", sleeves: "", pattern: "nessuno", emblem: "nessuno",
      bottom: "calzamaglia", pants: "#a8c3a0", footwear: "stivaletti", shoes: "#16130f",
      hat: "cappuccio", hatColor: "#5a4632", cowl: true, cowlColor: "#5a4632", cape: false, fur: false, scarf: false, mask: false, sash: false, straps: false, wraps: false,
      belt: "larga", beltColor: "#4a2c16", buckle: "semplice", pouch: true, pouchType: "tascapane", gloves: false, necklace: false, amulet: false, pendant: "nessuno", eyepatch: "nessuna",
      quiverPlace: "fianco", quiver: "#2a1a12", quiverStyle: "cuoio", chestguard: false, bracers: "",
      bowType: "longbow", useMain: false, riser: "#1a1a1a", limbs: "#1a1a1a", string: "#f4f1ea", fletch: "#f4f1ea", cock: "#c0283a", nock: "#1a1a1a", shaft: "#2a1a12",
      scene: "torneo", frame: "nessuna", special: "simone-medievale",
    },
  },
];

/**
 * Demone di Montelago: i due costumi del Montelago Celtic Festival, disegnati dalle foto. Sono di Simone e del
 * fondatore insieme: ognuno dei due può indossare l'uno o l'altro, nessun altro li vede. Simone li riceve
 * quando il fondatore li conferma (MONTELAGO_GIFT): fino ad allora li vede e li prova solo il fondatore.
 */
export const MONTELAGO_GIFT = false;
const MONTELAGO_OWNERS: Owner[] = MONTELAGO_GIFT ? [{ given: "Simone", family: "Salimbeni" }] : [];
const MONTELAGO_SCENE = "montelago";
SPECIAL_LOOKS.push(
  {
    id: "demone-simone",
    owner: MONTELAGO_OWNERS[0] ?? { given: "", family: "" },
    owners: MONTELAGO_OWNERS,
    founder: true,
    label: "Demone di Montelago (Simone)",
    motto: "Maschera rossa con la lingua di fuori, barba grigia intrecciata, tunica cremisi, mantello bordeaux e bastone col teschio di cavallo",
    look: {
      style: "medievale", top: "maglia", shirt: "#8e1b26", trim: "#b8862e", sleeves: "", pattern: "nessuno", emblem: "nessuno",
      bottom: "larghi", pants: "#1a1818", footwear: "sandali", shoes: "#141414",
      hat: "nessuno", cape: true, capeStyle: "liscio", capeColor: "#4e2420", capePattern: "liscio", clasp: "nessuno",
      cowl: false, fur: false, scarf: false, mask: false, sash: false, straps: false, wraps: false,
      belt: "larga", beltColor: "#5a3418", buckle: "semplice", pouch: false, gloves: false, bracers: "#3a2414",
      necklace: false, amulet: false, pendant: "nessuno", eyepatch: "nessuna", glasses: false, sunglasses: false, earring: false,
      faceBg: "#5a0c12", faceBgStyle: "sfumato", chestguard: false, armguard: "", quiverPlace: "schiena", scene: MONTELAGO_SCENE, frame: "nessuna", special: "demone-simone",
    },
  },
  {
    id: "demone-victor",
    owner: MONTELAGO_OWNERS[0] ?? { given: "", family: "" },
    owners: MONTELAGO_OWNERS,
    founder: true,
    label: "Demone di Montelago (Victor)",
    motto: "Teschio con le corna ad anelli, capelli rossi, stola di pelliccia rossa, kilt scozzese, corno per bere e bastone con la nappa rossa",
    look: {
      style: "medievale", top: "maglia", shirt: "#161414", trim: "#2a2626", sleeves: "", pattern: "nessuno", emblem: "nessuno",
      bottom: "gonna", pants: "#141212", footwear: "sandali", shoes: "#141414",
      hat: "nessuno", cape: false, cowl: false, fur: false, scarf: false, mask: false, sash: false, straps: false, wraps: false,
      belt: "sottile", beltColor: "#2a1a10", buckle: "semplice", pouch: false, gloves: false, bracers: "#3d2618",
      necklace: false, amulet: false, pendant: "nessuno", eyepatch: "nessuna", glasses: false, sunglasses: false, earring: false,
      faceBg: "#2a0a14", faceBgStyle: "sfumato", chestguard: false, armguard: "", quiverPlace: "schiena", scene: MONTELAGO_SCENE, frame: "nessuna", special: "demone-victor",
    },
  },
);

const keyOf = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const isOwner = (o: Owner, given: string, family: string) => Boolean(o.given) && keyOf(o.given) === keyOf(given) && keyOf(o.family) === keyOf(family);

/** gli abiti su misura di questo profilo (nessuno se non ne ha); il fondatore vede anche quelli da provare */
export function specialLooksFor(given: string, family: string, founder = false): SpecialLook[] {
  return SPECIAL_LOOKS.filter((s) => (s.owners ?? [s.owner]).some((o) => isOwner(o, given, family)) || (founder && s.founder));
}

/** sfondi riservati ai titolari di un abito su misura */
export const EXCLUSIVE_SCENES: Record<string, string[]> = { [MONTELAGO_SCENE]: ["demone-simone", "demone-victor"] };
