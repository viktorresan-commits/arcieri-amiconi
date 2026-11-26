/**
 * Abiti su misura: disegnati sulle foto di un arciere e riservati a lui. Li vede e li indossa solo
 * chi ne è il titolare (nome e cognome del profilo); per tutti gli altri non esistono.
 */
import type { AvatarLook } from "./avatar";

export type SpecialLook = { id: string; owner: { given: string; family: string }; label: string; motto: string; look: Partial<AvatarLook> };

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

/** gli abiti su misura di questo profilo (nessuno se non ne ha) */
export function specialLooksFor(given: string, family: string): SpecialLook[] {
  const k = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return SPECIAL_LOOKS.filter((s) => k(s.owner.given) === k(given) && k(s.owner.family) === k(family));
}
