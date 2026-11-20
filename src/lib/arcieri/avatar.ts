/** L'arciere della Home: aspetto e attrezzatura, salvati sul telefono. */
export type AvatarLook = {
  body: "uomo" | "donna" | "ragazzo";
  skin: string;
  face: "ovale" | "tondo" | "squadrato";
  eyes: string;
  brows: "sottili" | "normali" | "folte";
  freckles: boolean;
  glasses: boolean;
  hair: "corti" | "rasati" | "mossi" | "ricci" | "lunghi" | "coda" | "chignon" | "treccia" | "calvo";
  hairColor: string;
  beard: "nessuna" | "accenno" | "corta" | "piena" | "pizzetto" | "baffi";
  hat: "nessuno" | "berretto" | "fascia" | "piuma";
  hatColor: string;
  shirt: string;
  pants: string;
  shoes: string;
  /** usa arco e frecce dell'attrezzatura principale */
  useMain: boolean;
  bowType: string;
  riser: string;
  limbs: string;
  string: string;
  fletch: string;
  cock: string;
  nock: string;
  shaft: string;
  tab: string;
  armguard: string;
  chestguard: boolean;
  chestColor: string;
  quiver: string;
};

export const SKINS = ["#f6d7c3", "#eac4a6", "#d9a77f", "#b97f56", "#8d5a3a", "#5e3a24"];
export const HAIR_COLORS = ["#1b1612", "#3b2a1d", "#6b4428", "#a8743f", "#d9b26a", "#efe2bd", "#8a8a8a", "#ececec", "#2c3e66", "#7c3aed"];
export const EYE_COLORS = ["#5b3a1e", "#2f2116", "#3d7a4f", "#3b6ea8", "#7a8a96", "#8a6a2c"];
export const CLOTH_COLORS = ["#2f6f62", "#1f3a5f", "#5b2b6e", "#8a2f2f", "#c46b2b", "#d9c39a", "#3a3a3a", "#e9e4d8", "#4b6b2e", "#2a5d8a"];
export const GEAR_COLORS = ["#2f6fbe", "#1d2126", "#b02a2a", "#3fae6a", "#e6b325", "#c9c9c9", "#7a4a26", "#7c3aed", "#e07a2f", "#f4f1ea", "#ff5fa2", "#14181c"];

export const AVATAR_DEFAULT: AvatarLook = {
  body: "uomo",
  skin: "#eac4a6",
  face: "ovale",
  eyes: "#5b3a1e",
  brows: "normali",
  freckles: false,
  glasses: false,
  hair: "corti",
  hairColor: "#3b2a1d",
  beard: "corta",
  hat: "nessuno",
  hatColor: "#1f3a5f",
  shirt: "#2f6f62",
  pants: "#2b3440",
  shoes: "#3a2a1e",
  useMain: true,
  bowType: "olimpico",
  riser: "#2f6fbe",
  limbs: "#15191d",
  string: "#f4f1ea",
  fletch: "#d63a2f",
  cock: "#e6b325",
  nock: "#f4f1ea",
  shaft: "#1d1f22",
  tab: "#5b3a1e",
  armguard: "#1d2126",
  chestguard: true,
  chestColor: "#1d2126",
  quiver: "#7a4a26",
};

export const AVATAR_KEY = "aa-avatar-v1";

/** Tre partenze già pronte: si cambia tutto dopo. */
export const AVATAR_PRESETS: { id: string; label: string; look: Partial<AvatarLook> }[] = [
  { id: "uomo", label: "Arciere", look: { body: "uomo", hair: "corti", beard: "corta", hairColor: "#3b2a1d", skin: "#eac4a6" } },
  { id: "donna", label: "Arciera", look: { body: "donna", hair: "coda", beard: "nessuna", hairColor: "#1b1612", skin: "#d9a77f", shirt: "#1f3a5f" } },
  { id: "ragazzo", label: "Giovane", look: { body: "ragazzo", hair: "mossi", beard: "nessuna", hairColor: "#a8743f", skin: "#f6d7c3", shirt: "#c46b2b", chestguard: false } },
];

function pick<T>(list: readonly T[], r: number) {
  return list[Math.floor(r * list.length) % list.length];
}

/** Un arciere a caso, per chi non sa da dove partire. */
export function randomLook(base: AvatarLook): AvatarLook {
  const r = () => Math.random();
  const body = pick(["uomo", "donna", "ragazzo"] as const, r());
  const hair = pick(["corti", "rasati", "mossi", "ricci", "lunghi", "coda", "chignon", "treccia", "calvo"] as const, r());
  return {
    ...base,
    body,
    skin: pick(SKINS, r()),
    face: pick(["ovale", "tondo", "squadrato"] as const, r()),
    eyes: pick(EYE_COLORS, r()),
    brows: pick(["sottili", "normali", "folte"] as const, r()),
    freckles: r() < 0.25,
    glasses: r() < 0.15,
    hair: body === "ragazzo" && hair === "calvo" ? "mossi" : hair,
    hairColor: pick(HAIR_COLORS.slice(0, 8), r()),
    beard: body === "uomo" ? pick(["nessuna", "accenno", "corta", "piena", "pizzetto", "baffi"] as const, r()) : "nessuna",
    hat: pick(["nessuno", "nessuno", "berretto", "fascia", "piuma"] as const, r()),
    hatColor: pick(CLOTH_COLORS, r()),
    shirt: pick(CLOTH_COLORS, r()),
    pants: pick(["#2b3440", "#3a2a1e", "#1f3a5f", "#4b4b4b", "#5b4a2e"], r()),
    tab: pick(["#5b3a1e", "#14181c", "#7a4a26", "#8a2f2f"], r()),
    armguard: pick(GEAR_COLORS, r()),
    chestColor: pick(GEAR_COLORS, r()),
  };
}
