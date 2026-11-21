/** L'arciere della Home: aspetto, abiti, accessori e attrezzatura. Salvato sul telefono e sul profilo. */
export type HairStyle = "corti" | "rasati" | "mossi" | "ricci" | "lunghi" | "coda" | "chignon" | "treccia" | "codini" | "caschetto" | "cresta" | "calvo" | "spettinati" | "lunghi-mossi" | "raccolti" | "afro" | "trecce" | "frangia";
export type Pose = "animata" | "riposo" | "incocco" | "mira" | "allungo" | "accompagna" | "vittoria" | "fiero" | "saluto";

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
  hat: "nessuno" | "berretto" | "fascia" | "piuma" | "cappuccio" | "elmo" | "bandana" | "robin" | "tesa" | "cerchietto";
  hatColor: string;
  /** stile degli abiti: moderno o medievale */
  style: "moderno" | "medievale";
  top: "maglia" | "felpa" | "polo" | "gilet" | "giacca" | "tunica" | "tunica-lunga" | "farsetto" | "corpetto" | "ranger" | "incrociata" | "cappotto" | "giubba" | "cappotto-lungo";
  /** maniche e sottoveste di un altro colore ("" = come la veste) */
  sleeves: string;
  shirt: string;
  trim: string;
  bottom: "pantaloni" | "jeans" | "pantaloncini" | "calzamaglia" | "brache" | "larghi";
  pants: string;
  footwear: "sportive" | "stivali" | "stivaletti" | "stivali-risvolto" | "sandali" | "stivali-alti";
  shoes: string;
  cape: boolean;
  capeColor: string;
  /** taglio del mantello */
  capeStyle: "liscio" | "frastagliato" | "corto";
  /** cappuccio-scialle avvolto al collo */
  cowl: boolean;
  cowlColor: string;
  /** maschera sul viso, sotto gli occhi */
  mask: boolean;
  /** pelliccia sulle spalle */
  fur: boolean;
  furColor: string;
  /** fusciacca di stoffa in vita con il lembo che pende */
  sash: boolean;
  sashColor: string;
  /** cinghie incrociate sul petto con fibbie */
  straps: boolean;
  /** fasce incrociate sulle gambe */
  wraps: boolean;
  wrapsColor: string;
  /** pittura sul viso e cicatrice */
  warpaint: boolean;
  scar: boolean;
  /** sfondo della foto profilo */
  faceBg: string;
  faceBgStyle: "sfumato" | "tinta" | "bersaglio" | "scena";
  /** ambientazione della Home e del profilo */
  scene: string;
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
  /** bracciali di cuoio su entrambi gli avambracci ("" = niente) */
  bracers: string;
  belt: "sottile" | "larga" | "nessuna";
  beltColor: string;
  gloves: boolean;
  /** sequenza di tiro: completa (11 tempi), rapida, da gara (mira lunga) */
  routine: "completa" | "rapida" | "gara";
  /** secondi di mira all'ancoraggio */
  hold: string;
  /** frecce per volée nella sequenza animata */
  volley: string;
  /** il volto dell'arciere fa da foto profilo */
  facePhoto: boolean;
  /** arciere mancino: tiene l'arco con la destra e guarda dall'altra parte */
  lefty: boolean;
  /** barre di regolazione (0-100, 50 = normale) e rotazioni in gradi, salvate come testo */
  hairLength: string;
  topLength: string;
  hatRot: string;
  quiverRot: string;
};

/** legge una regolazione numerica salvata come testo */
export function tune(value: string | number | undefined, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export const SKINS = ["#f8dcc8", "#eec5a4", "#dba57d", "#c0865c", "#9a6440", "#6e4429", "#4a2c1a"];
export const HAIR_COLORS = ["#16110d", "#3b2a1d", "#5e3b22", "#8a5a2e", "#b88a4a", "#e2c48a", "#f1e6c8", "#8a8a8a", "#e8e8e8", "#a0301f", "#2c3e66", "#7c3aed", "#2f9e7a"];
export const EYE_COLORS = ["#5b3a1e", "#2f2116", "#3d7a4f", "#3b6ea8", "#7a8a96", "#8a6a2c", "#6b4fa0"];
export const CLOTH_COLORS = ["#2f6f62", "#1f3a5f", "#5b2b6e", "#8a2f2f", "#c46b2b", "#d9c39a", "#3a3a3a", "#e9e4d8", "#4b6b2e", "#2a5d8a", "#c7a03a", "#1d1d1f", "#d8cdb6", "#4a4a2c", "#55585a", "#6b5a48", "#c9b08a", "#5a3a22", "#2f4a2a", "#7a2a3a"];
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
    { id: "tunica-lunga", label: "Tunica lunga con bottoni" },
    { id: "farsetto", label: "Farsetto" },
    { id: "corpetto", label: "Corpetto di cuoio" },
    { id: "ranger", label: "Veste incrociata del ramingo" },
    { id: "incrociata", label: "Tunica a portafoglio" },
    { id: "giubba", label: "Giubba di cuoio con alamari" },
    { id: "cappotto", label: "Cappotto con cinghie" },
    { id: "cappotto-lungo", label: "Cappotto lungo a spacchi" },
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
  capeStyle: "liscio",
  cowl: false,
  cowlColor: "#4a4d4f",
  mask: false,
  fur: false,
  furColor: "#6b5a48",
  sash: false,
  sashColor: "#8a5a2e",
  straps: false,
  wraps: false,
  wrapsColor: "#6b5a48",
  warpaint: false,
  scar: false,
  faceBg: "",
  faceBgStyle: "sfumato",
  scene: "campo",
  sleeves: "",
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
  bracers: "",
  belt: "sottile",
  beltColor: "#5b3a1e",
  gloves: false,
  routine: "completa",
  hold: "2",
  volley: "3",
  facePhoto: false,
  lefty: false,
  hairLength: "50",
  topLength: "50",
  hatRot: "0",
  quiverRot: "0",
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
  { id: "boscaiolo", label: "Arciere del bosco", look: { body: "uomo", style: "medievale", top: "tunica-lunga", shirt: "#e4d9bf", trim: "#8a6a3a", bottom: "brache", pants: "#3d4a52", footwear: "stivali-risvolto", shoes: "#5e3b22", bracers: "#6b4224", belt: "larga", beltColor: "#4a2c16", quiverPlace: "schiena", quiver: "#6b4224", cape: false, hat: "nessuno", bowType: "longbow", useMain: false, chestguard: false, beard: "accenno", hair: "corti" } },
  { id: "ramingo", label: "Ramingo incappucciato", look: { body: "uomo", style: "medievale", top: "ranger", shirt: "#d8cdb6", trim: "#5b3a1e", sleeves: "#d8cdb6", bottom: "larghi", pants: "#3f4a2e", footwear: "stivali-alti", shoes: "#4a3322", cape: true, capeStyle: "frastagliato", capeColor: "#4a4a2c", hat: "cappuccio", hatColor: "#4a4a2c", mask: true, sash: true, sashColor: "#5b4a36", straps: true, belt: "larga", beltColor: "#4a2c16", bracers: "#4a2c16", pouch: true, quiverPlace: "schiena", quiver: "#4a2c16", bowType: "longbow", useMain: false, chestguard: false, beard: "accenno", scene: "foresta" } },
  { id: "esploratore", label: "Esploratore grigio", look: { body: "uomo", style: "medievale", top: "cappotto", shirt: "#4c5444", trim: "#6b4224", sleeves: "#5a5f55", bottom: "pantaloni", pants: "#3a3d3a", footwear: "stivaletti", shoes: "#3a2a1e", cowl: true, cowlColor: "#55585a", wraps: true, wrapsColor: "#7a6a52", belt: "larga", beltColor: "#6b4224", pouch: true, cape: false, hat: "nessuno", bowType: "ricurvo", useMain: false, chestguard: false, beard: "corta", scene: "montagna" } },
  { id: "pellegrino", label: "Pellegrino del deserto", look: { body: "uomo", style: "medievale", top: "incrociata", shirt: "#c9b08a", trim: "#7a5232", sleeves: "#c9b08a", bottom: "larghi", pants: "#6b4a2e", footwear: "stivali-alti", shoes: "#5b3a20", sash: true, sashColor: "#8a5a2e", belt: "larga", beltColor: "#4a2c16", cape: true, capeStyle: "corto", capeColor: "#6b4a2e", bracers: "#5b3a20", hat: "nessuno", bowType: "asiatico", useMain: false, chestguard: false, scene: "deserto" } },
  { id: "ombra", label: "Arciere dell'ombra", look: { body: "uomo", style: "medievale", top: "cappotto-lungo", shirt: "#1f2023", trim: "#9aa0a6", sleeves: "#26282c", bottom: "pantaloni", pants: "#1b1c1f", footwear: "stivali-alti", shoes: "#141416", cape: true, capeStyle: "frastagliato", capeColor: "#1d1e21", straps: true, belt: "larga", beltColor: "#2a2420", pouch: true, hat: "nessuno", bracers: "#2a2420", bowType: "ricurvo", useMain: false, chestguard: false, beard: "pizzetto", scene: "castello" } },
  { id: "foresta", label: "Guardiano della foresta", look: { body: "uomo", style: "medievale", top: "giubba", shirt: "#5a3a22", trim: "#c9a46a", sleeves: "#c9a678", bottom: "pantaloni", pants: "#5a3a22", footwear: "stivali-alti", shoes: "#4a2c16", cape: true, capeStyle: "liscio", capeColor: "#2f4a2a", hat: "cappuccio", hatColor: "#2f4a2a", belt: "larga", beltColor: "#3a2414", pouch: true, bowType: "longbow", useMain: false, chestguard: false, beard: "corta", scene: "foresta" } },
  { id: "nordico", label: "Cacciatore del nord", look: { body: "uomo", style: "medievale", top: "cappotto-lungo", shirt: "#2c2a28", trim: "#8a6a3a", sleeves: "#2c2a28", bottom: "pantaloni", pants: "#2a2622", footwear: "stivali-alti", shoes: "#3a2414", fur: true, furColor: "#7a6650", belt: "larga", beltColor: "#4a2c16", bracers: "#4a2c16", hair: "trecce", beard: "piena", hairColor: "#8a5a2e", bowType: "flatbow", useMain: false, chestguard: false, scene: "neve" } },
  { id: "ramingadonna", label: "Ramingo (donna)", look: { body: "donna", style: "medievale", top: "giubba", shirt: "#4a3322", trim: "#c9a46a", sleeves: "#d8cdb6", bottom: "pantaloni", pants: "#3a2a1e", footwear: "stivali-alti", shoes: "#3a2414", cape: true, capeColor: "#3a5a3a", hat: "nessuno", hair: "lunghi-mossi", hairColor: "#8a5a2e", beard: "nessuna", belt: "larga", beltColor: "#3a2414", bracers: "#3a2414", bowType: "longbow", useMain: false, chestguard: false, scene: "lago" } },
  { id: "elfa", label: "Arciera del bosco (donna)", look: { body: "donna", style: "medievale", top: "ranger", shirt: "#e7dfcc", trim: "#5b7a3a", sleeves: "#e7dfcc", bottom: "calzamaglia", pants: "#3f5a2e", footwear: "stivali-risvolto", shoes: "#5e3b22", cape: true, capeStyle: "frastagliato", capeColor: "#3f5a2e", sash: true, sashColor: "#5b7a3a", hair: "treccia", hairColor: "#e2c48a", beard: "nessuna", hat: "cerchietto", hatColor: "#d9b45a", bowType: "ricurvo", useMain: false, chestguard: false, scene: "foresta" } },
  { id: "dama", label: "Arciera di corte (donna)", look: { body: "donna", style: "medievale", top: "cappotto", shirt: "#5b2b6e", trim: "#d9b45a", sleeves: "#e9e4d8", bottom: "calzamaglia", pants: "#2a2230", footwear: "stivali-alti", shoes: "#2a1d14", cape: true, capeColor: "#3a1d4a", hair: "chignon", hairColor: "#16110d", beard: "nessuna", necklace: true, hat: "cerchietto", hatColor: "#d9b45a", bowType: "storico", useMain: false, chestguard: false, scene: "palazzo" } },
  { id: "scudiero", label: "Giovane scudiero", look: { body: "ragazzo", style: "medievale", top: "giubba", shirt: "#7a4a26", trim: "#d9b45a", sleeves: "#e4d9bf", bottom: "brache", pants: "#3d4a52", footwear: "stivali", shoes: "#5e3b22", hat: "robin", hatColor: "#3f6a2e", hair: "spettinati", hairColor: "#b88a4a", beard: "nessuna", belt: "sottile", beltColor: "#4a2c16", bowType: "longbow", useMain: false, chestguard: false, scene: "villaggio" } },
  { id: "piccola", label: "Piccola ramingo", look: { body: "ragazza", style: "medievale", top: "incrociata", shirt: "#d8cdb6", trim: "#8a5a2e", sleeves: "#d8cdb6", bottom: "larghi", pants: "#5a6a3a", footwear: "stivali-risvolto", shoes: "#5e3b22", cape: true, capeStyle: "corto", capeColor: "#8a2f2f", hat: "cappuccio", hatColor: "#8a2f2f", sash: true, sashColor: "#c7a03a", hair: "trecce", hairColor: "#a0301f", beard: "nessuna", freckles: true, bowType: "flatbow", useMain: false, chestguard: false, scene: "campagna" } },
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
  const hair = pick(["corti", "rasati", "mossi", "ricci", "lunghi", "coda", "chignon", "treccia", "codini", "caschetto", "cresta", "calvo", "spettinati", "lunghi-mossi", "raccolti", "afro", "trecce", "frangia"] as const, r());
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
    hat: pick(["nessuno", "nessuno", "berretto", "fascia", "piuma", "cappuccio", "bandana", "robin", "tesa", "cerchietto"] as const, r()),
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
    sleeves: r() < 0.3 ? pick(CLOTH_COLORS, r()) : "",
    capeStyle: pick(["liscio", "frastagliato", "corto"] as const, r()),
    cowl: style === "medievale" && r() < 0.2,
    sash: style === "medievale" && r() < 0.35,
    sashColor: pick(CLOTH_COLORS, r()),
    straps: style === "medievale" && r() < 0.3,
    wraps: style === "medievale" && r() < 0.2,
    fur: style === "medievale" && r() < 0.15,
    tab: pick(["#5b3a1e", "#14181c", "#7a4a26", "#8a2f2f"], r()),
    armguard: pick(GEAR_COLORS, r()),
    chestColor: pick(GEAR_COLORS, r()),
    quiverPlace: r() < 0.5 ? "fianco" : "schiena",
  });
}
