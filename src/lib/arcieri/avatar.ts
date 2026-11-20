/** L'arciere della Home: aspetto, abiti, accessori e attrezzatura. Salvato sul telefono e sul profilo. */
export type HairStyle = "corti" | "rasati" | "mossi" | "ricci" | "lunghi" | "coda" | "chignon" | "treccia" | "codini" | "caschetto" | "cresta" | "calvo";
export type Pose = "animata" | "riposo" | "allungo" | "vittoria" | "fiero";

export type AvatarLook = {
  body: "uomo" | "donna" | "ragazzo" | "ragazza";
  build: "snello" | "normale" | "robusto";
  skin: string;
  face: "ovale" | "tondo" | "squadrato" | "allungato";
  eyes: string;
  brows: "sottili" | "normali" | "folte";
  nose: "piccolo" | "dritto" | "aquilino" | "largo";
  expression: "sorriso" | "sereno" | "concentrato" | "deciso";
  freckles: boolean;
  glasses: boolean;
  hair: HairStyle;
  hairColor: string;
  beard: "nessuna" | "accenno" | "corta" | "piena" | "pizzetto" | "baffi";
  hat: "nessuno" | "berretto" | "fascia" | "piuma" | "cappuccio" | "elmo";
  hatColor: string;
  /** stile degli abiti: moderno o medievale */
  style: "moderno" | "medievale";
  top: "maglia" | "felpa" | "polo" | "gilet" | "giacca" | "tunica" | "farsetto" | "corpetto";
  shirt: string;
  trim: string;
  bottom: "pantaloni" | "jeans" | "pantaloncini" | "calzamaglia";
  pants: string;
  footwear: "sportive" | "stivali" | "stivaletti";
  shoes: string;
  cape: boolean;
  capeColor: string;
  necklace: boolean;
  earring: boolean;
  scarf: boolean;
  scarfColor: string;
  pouch: boolean;
  pose: Pose;
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
  quiverPlace: "fianco" | "schiena";
};

export const SKINS = ["#f8dcc8", "#eec5a4", "#dba57d", "#c0865c", "#9a6440", "#6e4429", "#4a2c1a"];
export const HAIR_COLORS = ["#16110d", "#3b2a1d", "#5e3b22", "#8a5a2e", "#b88a4a", "#e2c48a", "#f1e6c8", "#8a8a8a", "#e8e8e8", "#a0301f", "#2c3e66", "#7c3aed", "#2f9e7a"];
export const EYE_COLORS = ["#5b3a1e", "#2f2116", "#3d7a4f", "#3b6ea8", "#7a8a96", "#8a6a2c", "#6b4fa0"];
export const CLOTH_COLORS = ["#2f6f62", "#1f3a5f", "#5b2b6e", "#8a2f2f", "#c46b2b", "#d9c39a", "#3a3a3a", "#e9e4d8", "#4b6b2e", "#2a5d8a", "#c7a03a", "#1d1d1f"];
export const GEAR_COLORS = ["#2f6fbe", "#1d2126", "#b02a2a", "#3fae6a", "#e6b325", "#c9c9c9", "#7a4a26", "#7c3aed", "#e07a2f", "#f4f1ea", "#ff5fa2", "#14181c"];

export const TOPS: Record<AvatarLook["style"], { id: AvatarLook["top"]; label: string }[]> = {
  moderno: [
    { id: "maglia", label: "Maglia" },
    { id: "felpa", label: "Felpa" },
    { id: "polo", label: "Polo" },
    { id: "gilet", label: "Gilet tecnico" },
    { id: "giacca", label: "Giacca" },
  ],
  medievale: [
    { id: "tunica", label: "Tunica" },
    { id: "farsetto", label: "Farsetto" },
    { id: "corpetto", label: "Corpetto di cuoio" },
  ],
};

export const AVATAR_DEFAULT: AvatarLook = {
  body: "uomo",
  build: "normale",
  skin: "#eec5a4",
  face: "ovale",
  eyes: "#5b3a1e",
  brows: "normali",
  nose: "dritto",
  expression: "sorriso",
  freckles: false,
  glasses: false,
  hair: "corti",
  hairColor: "#3b2a1d",
  beard: "corta",
  hat: "nessuno",
  hatColor: "#1f3a5f",
  style: "moderno",
  top: "polo",
  shirt: "#2f6f62",
  trim: "#e9e4d8",
  bottom: "pantaloni",
  pants: "#2b3440",
  footwear: "sportive",
  shoes: "#3a2a1e",
  cape: false,
  capeColor: "#5b2b6e",
  necklace: false,
  earring: false,
  scarf: false,
  scarfColor: "#c46b2b",
  pouch: false,
  pose: "animata",
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
  quiverPlace: "fianco",
};

export const AVATAR_KEY = "aa-avatar-v1";

/** Porta un aspetto salvato (anche vecchio) alla forma attuale. */
export function normalizeLook(raw: unknown): AvatarLook {
  const r = raw && typeof raw === "object" ? (raw as Partial<AvatarLook>) : {};
  const out = { ...AVATAR_DEFAULT, ...r } as AvatarLook;
  if (!TOPS[out.style]?.some((t) => t.id === out.top)) out.top = TOPS[out.style][0].id;
  return out;
}

/** Partenze già pronte: si cambia tutto dopo. */
export const AVATAR_PRESETS: { id: string; label: string; look: Partial<AvatarLook> }[] = [
  { id: "uomo", label: "Arciere", look: { body: "uomo", hair: "corti", beard: "corta", hairColor: "#3b2a1d", skin: "#eec5a4", style: "moderno", top: "polo", hat: "nessuno", cape: false } },
  { id: "donna", label: "Arciera", look: { body: "donna", hair: "coda", beard: "nessuna", hairColor: "#16110d", skin: "#dba57d", style: "moderno", top: "gilet", shirt: "#1f3a5f", hat: "nessuno", cape: false } },
  { id: "ragazzo", label: "Giovane", look: { body: "ragazzo", hair: "mossi", beard: "nessuna", hairColor: "#b88a4a", skin: "#f8dcc8", style: "moderno", top: "felpa", shirt: "#c46b2b", chestguard: false, bottom: "pantaloncini" } },
  { id: "ragazza", label: "Giovane arciera", look: { body: "ragazza", hair: "codini", beard: "nessuna", hairColor: "#5e3b22", skin: "#c0865c", style: "moderno", top: "maglia", shirt: "#2a5d8a", bottom: "jeans", freckles: true } },
  { id: "medievale", label: "Medievale", look: { style: "medievale", top: "tunica", shirt: "#4b6b2e", trim: "#c7a03a", bottom: "calzamaglia", pants: "#3a2a1e", footwear: "stivali", shoes: "#5e3b22", cape: true, capeColor: "#5b2b6e", hat: "cappuccio", hatColor: "#4b6b2e", bowType: "longbow", useMain: false, quiverPlace: "schiena", pouch: true, chestguard: false } },
];

function pick<T>(list: readonly T[], r: number) {
  return list[Math.floor(r * list.length) % list.length];
}

/** Un arciere a caso, per chi non sa da dove partire. */
export function randomLook(base: AvatarLook): AvatarLook {
  const r = () => Math.random();
  const body = pick(["uomo", "donna", "ragazzo", "ragazza"] as const, r());
  const style = r() < 0.65 ? "moderno" : "medievale";
  const hair = pick(["corti", "rasati", "mossi", "ricci", "lunghi", "coda", "chignon", "treccia", "codini", "caschetto", "cresta", "calvo"] as const, r());
  return normalizeLook({
    ...base,
    body,
    build: pick(["snello", "normale", "robusto"] as const, r()),
    skin: pick(SKINS, r()),
    face: pick(["ovale", "tondo", "squadrato", "allungato"] as const, r()),
    eyes: pick(EYE_COLORS, r()),
    brows: pick(["sottili", "normali", "folte"] as const, r()),
    nose: pick(["piccolo", "dritto", "aquilino", "largo"] as const, r()),
    expression: pick(["sorriso", "sereno", "concentrato", "deciso"] as const, r()),
    freckles: r() < 0.25,
    glasses: r() < 0.15,
    hair: (body === "ragazzo" || body === "ragazza") && hair === "calvo" ? "mossi" : hair,
    hairColor: pick(HAIR_COLORS.slice(0, 10), r()),
    beard: body === "uomo" ? pick(["nessuna", "accenno", "corta", "piena", "pizzetto", "baffi"] as const, r()) : "nessuna",
    hat: pick(["nessuno", "nessuno", "berretto", "fascia", "piuma", "cappuccio"] as const, r()),
    hatColor: pick(CLOTH_COLORS, r()),
    style,
    top: pick(TOPS[style], r()).id,
    shirt: pick(CLOTH_COLORS, r()),
    trim: pick(CLOTH_COLORS, r()),
    bottom: style === "medievale" ? pick(["calzamaglia", "pantaloni"] as const, r()) : pick(["pantaloni", "jeans", "pantaloncini"] as const, r()),
    pants: pick(["#2b3440", "#3a2a1e", "#1f3a5f", "#4b4b4b", "#5b4a2e", "#2a4a7a"], r()),
    footwear: style === "medievale" ? "stivali" : pick(["sportive", "stivaletti"] as const, r()),
    cape: style === "medievale" && r() < 0.6,
    capeColor: pick(CLOTH_COLORS, r()),
    necklace: r() < 0.3,
    earring: r() < 0.25,
    scarf: r() < 0.2,
    scarfColor: pick(CLOTH_COLORS, r()),
    pouch: r() < 0.4,
    tab: pick(["#5b3a1e", "#14181c", "#7a4a26", "#8a2f2f"], r()),
    armguard: pick(GEAR_COLORS, r()),
    chestColor: pick(GEAR_COLORS, r()),
    quiverPlace: r() < 0.5 ? "fianco" : "schiena",
  });
}
