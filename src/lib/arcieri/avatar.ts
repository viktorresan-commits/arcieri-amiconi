/** L'arciere della Home: aspetto, abiti, accessori e attrezzatura. Salvato sul telefono e sul profilo. */
export type HairStyle = "corti" | "rasati" | "mossi" | "ricci" | "lunghi" | "coda" | "chignon" | "treccia" | "codini" | "caschetto" | "cresta" | "calvo" | "spettinati" | "lunghi-mossi" | "raccolti" | "afro" | "trecce" | "frangia" | "ciuffo" | "undercut" | "dread" | "vichinga" | "coda-alta";
export type Pose = "animata" | "riposo" | "incocco" | "mira" | "allungo" | "accompagna" | "vittoria" | "fiero" | "saluto";

export type AvatarLook = {
  body: "uomo" | "donna" | "ragazzo" | "ragazza";
  build: "snello" | "normale" | "robusto";
  skin: string;
  face: "ovale" | "tondo" | "squadrato" | "allungato";
  eyes: string;
  brows: "sottili" | "normali" | "folte";
  nose: "piccolo" | "dritto" | "aquilino" | "largo" | "insu" | "patata";
  expression: "sorriso" | "sereno" | "concentrato" | "deciso";
  freckles: boolean;
  glasses: boolean;
  hair: HairStyle;
  hairColor: string;
  beard: "nessuna" | "accenno" | "corta" | "piena" | "pizzetto" | "baffi" | "lunga" | "barbetta" | "basette" | "mosca";
  /** baffi scelti a parte, da unire a qualsiasi barba ("auto" = quelli che vanno con la barba) */
  stache: "auto" | "nessuno" | "sottili" | "classici" | "folti" | "manubrio" | "ferro";
  /** colore di barba e baffi ("" = come i capelli) */
  beardColor: string;
  hat: "nessuno" | "berretto" | "fascia" | "piuma" | "cappuccio" | "elmo" | "bandana" | "robin" | "tesa" | "cerchietto" | "cuffia" | "alloro";
  hatColor: string;
  /** stile degli abiti: moderno o medievale */
  style: "moderno" | "medievale";
  top: "maglia" | "felpa" | "polo" | "gilet" | "giacca" | "canotta" | "camicia" | "divisa" | "tunica" | "tunica-lunga" | "farsetto" | "corpetto" | "ranger" | "incrociata" | "cappotto" | "giubba" | "cappotto-lungo" | "cotta" | "giubbetto";
  /** maniche e sottoveste di un altro colore ("" = come la veste) */
  sleeves: string;
  shirt: string;
  trim: string;
  bottom: "pantaloni" | "jeans" | "pantaloncini" | "calzamaglia" | "brache" | "larghi" | "gonna" | "cargo";
  pants: string;
  footwear: "sportive" | "stivali" | "stivaletti" | "stivali-risvolto" | "sandali" | "stivali-alti" | "mocassini" | "scarponi" | "stivali-pelliccia";
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
  /** altre barre: lunghezza della barba, grandezza del naso, volume dei capelli */
  beardLength: string;
  noseSize: string;
  hairVolume: string;
  /** accessori in più */
  amulet: boolean;
  armband: boolean;
  watch: boolean;
  hairFeather: boolean;
  sunglasses: boolean;
  /** corporatura continua (0 snello – 100 robusto; "" = segue la scelta a pulsanti) */
  buildW: string;
  /** statura, grandezza degli occhi e spessore delle sopracciglia (0-100, 50 = normale) */
  stature: string;
  eyeSize: string;
  browSize: string;
  /** altezza della faretra (-40 su, +40 giù) */
  quiverY: string;
  /** dettagli in più (vedi EXTRA_OPTIONS) */
  pattern: string;
  emblem: string;
  /** compagnia di cui portare lo stemma ("" = la propria) */
  crest: string;
  paint: string;
  tattoo: string;
  earringType: string;
  hairAcc: string;
  bowDeco: string;
  fletchStyle: string;
  quiverStyle: string;
  eyeShape: string;
  mouth: string;
  ears: string;
  blush: string;
  age: string;
  mark: string;
  buckle: string;
  pouchType: string;
  clasp: string;
  capePattern: string;
  frame: string;
  idle: string;
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
export const CLOTH_COLORS = ["#2f6f62", "#1f3a5f", "#5b2b6e", "#8a2f2f", "#c46b2b", "#d9c39a", "#3a3a3a", "#e9e4d8", "#4b6b2e", "#2a5d8a", "#c7a03a", "#1d1d1f", "#d8cdb6", "#4a4a2c", "#55585a", "#6b5a48", "#c9b08a", "#5a3a22", "#2f4a2a", "#7a2a3a",
  // 24 tinte nuove: naturali, nobili e moderne
  "#0f5257", "#3c6e71", "#7d8f69", "#a3b18a", "#bc6c25", "#dda15e", "#9c6644", "#7f5539", "#6d597a", "#b56576", "#e56b6f", "#355070",
  "#14213d", "#fca311", "#e5e5e5", "#2b2d42", "#8d99ae", "#ef233c", "#06d6a0", "#118ab2", "#ffd166", "#073b4c", "#f4a261", "#264653"];
export const GEAR_COLORS = ["#2f6fbe", "#1d2126", "#b02a2a", "#3fae6a", "#e6b325", "#c9c9c9", "#7a4a26", "#7c3aed", "#e07a2f", "#f4f1ea", "#ff5fa2", "#14181c"];

export const TOPS: Record<AvatarLook["style"], { id: AvatarLook["top"]; label: string }[]> = {
  moderno: [
    { id: "maglia", label: "Maglia" },
    { id: "felpa", label: "Felpa" },
    { id: "polo", label: "Polo" },
    { id: "gilet", label: "Gilet tecnico" },
    { id: "giacca", label: "Giacca" },
    { id: "camicia", label: "Camicia" },
    { id: "canotta", label: "Canotta" },
    { id: "divisa", label: "Divisa di società" },
  ],
  medievale: [
    { id: "giubbetto", label: "Giubbetto della compagnia" },
    { id: "tunica", label: "Tunica" },
    { id: "tunica-lunga", label: "Tunica lunga con bottoni" },
    { id: "farsetto", label: "Farsetto" },
    { id: "corpetto", label: "Corpetto di cuoio" },
    { id: "ranger", label: "Veste incrociata del ramingo" },
    { id: "incrociata", label: "Tunica a portafoglio" },
    { id: "giubba", label: "Giubba di cuoio con alamari" },
    { id: "cappotto", label: "Cappotto con cinghie" },
    { id: "cappotto-lungo", label: "Cappotto lungo a spacchi" },
    { id: "cotta", label: "Cotta di maglia" },
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
  scene: "fabriano",
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
  stache: "auto",
  beardColor: "",
  beardLength: "50",
  noseSize: "50",
  hairVolume: "50",
  amulet: false,
  armband: false,
  watch: false,
  hairFeather: false,
  sunglasses: false,
  buildW: "",
  stature: "50",
  eyeSize: "50",
  browSize: "50",
  quiverY: "0",
  pattern: "nessuno",
  emblem: "compagnia",
  crest: "",
  paint: "nessuna",
  tattoo: "nessuno",
  earringType: "cerchio",
  hairAcc: "nessuno",
  bowDeco: "nessuna",
  fletchStyle: "classica",
  quiverStyle: "cuoio",
  eyeShape: "normali",
  mouth: "normale",
  ears: "normali",
  blush: "leggero",
  age: "adulto",
  mark: "nessuno",
  buckle: "semplice",
  pouchType: "borsello",
  clasp: "nessuno",
  capePattern: "liscio",
  frame: "nessuna",
  idle: "respiro",
};

/**
 * Le scelte in più dell'avatar: ogni voce è una novità disegnata. Si mostrano come
 * file di miniature da scorrere nell'editor.
 */
export const EXTRA_OPTIONS = {
  pattern: { label: "Fantasia della veste", tab: "abiti", items: [["nessuno", "Tinta unita"], ["righe", "A righe"], ["righe-verticali", "Righe verticali"], ["quadri", "A quadri"], ["scozzese", "Scozzese"], ["pois", "A pois"], ["rombi", "A rombi"], ["chevron", "A spina"], ["mimetico", "Mimetico"], ["ricamo", "Ricamata"], ["bordure", "Con bordure"], ["fasce", "A fasce"], ["sfumata", "Sfumata"]] },
  emblem: { label: "Stemma sul petto", tab: "abiti", items: [["nessuno", "Nessuno"], ["compagnia", "Stemma della compagnia"], ["cervo", "Cervo"], ["lupo", "Lupo"], ["drago", "Drago"], ["freccia", "Freccia"], ["bersaglio", "Bersaglio"], ["giglio", "Giglio"], ["stella", "Stella"], ["scudo", "Scudo"], ["quercia", "Quercia"], ["aquila", "Aquila"], ["falco", "Falco"], ["leone", "Leone"], ["croce", "Croce"], ["sole", "Sole"], ["luna", "Luna"], ["corona", "Corona"]] },
  paint: { label: "Pittura sul viso", tab: "viso", items: [["nessuna", "Nessuna"], ["strisce", "Strisce"], ["maschera", "Maschera sugli occhi"], ["punti", "Punti"], ["tribale", "Tribale"], ["fulmine", "Fulmine"], ["mezza", "Mezzo viso"], ["naso", "Riga sul naso"], ["guance", "Guance"], ["volpe", "Volpe"], ["lupo", "Lupo"]] },
  tattoo: { label: "Tatuaggio", tab: "viso", items: [["nessuno", "Nessuno"], ["rune", "Rune sul braccio"], ["onde", "Onde sul braccio"], ["freccia", "Freccia sul braccio"], ["stelle", "Stelle sul collo"], ["lacrima", "Lacrima sul viso"], ["punti", "Punti sulla mano"], ["drago", "Drago sul braccio"], ["sole", "Sole sulla spalla"]] },
  earringType: { label: "Tipo di orecchino", tab: "accessori", items: [["cerchio", "Cerchio"], ["perla", "Perla"], ["pendente", "Pendente"], ["piuma", "Piuma"], ["doppio", "Doppio"], ["croce", "Croce"], ["zanna", "Zanna"]] },
  hairAcc: { label: "Nei capelli", tab: "capelli", items: [["nessuno", "Niente"], ["perline", "Perline"], ["fermaglio", "Fermaglio"], ["nastro", "Nastro"], ["fiori", "Fiori"], ["piume", "Due piume"], ["anelli", "Anelli"], ["filo", "Filo dorato"], ["pettine", "Pettine"]] },
  bowDeco: { label: "Decorazione dell'arco", tab: "attrezzatura", items: [["nessuna", "Nessuna"], ["nastrini", "Nastrini"], ["intagli", "Intagli"], ["pelliccia", "Pelliccia"], ["dipinto", "Dipinto"], ["rune", "Rune"], ["piume", "Piume"], ["perline", "Perline"], ["fasce", "Fasce colorate"]] },
  fletchStyle: { label: "Forma delle penne", tab: "attrezzatura", items: [["classica", "Classica"], ["scudo", "A scudo"], ["parabolica", "Parabolica"], ["vela", "A vela"], ["lunga", "Lunga"], ["spirale", "A spirale"]] },
  quiverStyle: { label: "Tipo di faretra", tab: "accessori", items: [["cuoio", "Cuoio"], ["decorata", "Decorata"], ["pelliccia", "Con pelliccia"], ["tubo", "Tubo moderno"], ["cestino", "Intrecciata"], ["legno", "Legno"], ["stoffa", "Stoffa"], ["borchie", "Con borchie"]] },
  eyeShape: { label: "Forma degli occhi", tab: "viso", items: [["normali", "Normali"], ["mandorla", "A mandorla"], ["tondi", "Tondi"], ["allungati", "Allungati"], ["socchiusi", "Socchiusi"], ["grandi", "Grandi e vivaci"]] },
  mouth: { label: "Labbra", tab: "viso", items: [["normale", "Normali"], ["sottile", "Sottili"], ["piena", "Piene"], ["ghigno", "Sorriso storto"], ["aperta", "Aperte"], ["broncio", "Broncio"]] },
  ears: { label: "Orecchie", tab: "viso", items: [["normali", "Normali"], ["piccole", "Piccole"], ["grandi", "Grandi"], ["punta", "A punta"]] },
  blush: { label: "Colorito", tab: "viso", items: [["nessuno", "Naturale"], ["leggero", "Leggero"], ["rosato", "Rosato"], ["abbronzato", "Abbronzato"]] },
  age: { label: "Età", tab: "viso", items: [["giovane", "Giovane"], ["adulto", "Adulto"], ["maturo", "Maturo"], ["anziano", "Anziano"]] },
  mark: { label: "Segni particolari", tab: "viso", items: [["nessuno", "Nessuno"], ["neo", "Neo sulla guancia"], ["neo-labbro", "Neo sul labbro"], ["mento", "Cicatrice sul mento"], ["sopracciglio", "Sopracciglio tagliato"]] },
  buckle: { label: "Fibbia della cintura", tab: "abiti", items: [["semplice", "Semplice"], ["oro", "Oro"], ["argento", "Argento"], ["celtica", "Celtica"], ["ovale", "Ovale"], ["quadrata", "Quadrata"]] },
  pouchType: { label: "Tipo di borsello", tab: "accessori", items: [["borsello", "Borsello"], ["tascapane", "Tascapane"], ["sacchetto", "Sacchetto"], ["cofanetto", "Cofanetto"], ["corno", "Corno"], ["borraccia", "Borraccia"]] },
  clasp: { label: "Fermaglio del mantello", tab: "accessori", items: [["nessuno", "Nessuno"], ["oro", "Oro"], ["argento", "Argento"], ["foglia", "Foglia"], ["drago", "Drago"], ["gemma", "Gemma"]] },
  capePattern: { label: "Fantasia del mantello", tab: "accessori", items: [["liscio", "Liscio"], ["bordato", "Bordato"], ["righe", "A righe"], ["stelle", "Stellato"], ["scacchi", "A scacchi"], ["stemma", "Con stemma"]] },
  frame: { label: "Cornice della foto profilo", tab: "scena", items: [["nessuna", "Nessuna"], ["oro", "Oro"], ["argento", "Argento"], ["bronzo", "Bronzo"], ["foglie", "Foglie"], ["frecce", "Frecce"], ["fuoco", "Fuoco"], ["ghiaccio", "Ghiaccio"], ["notte", "Notte"], ["arcobaleno", "Arcobaleno"], ["legno", "Legno"], ["bersaglio", "Bersaglio"]] },
  idle: { label: "Movimento da fermo", tab: "posa", items: [["fermo", "Fermo"], ["respiro", "Respira"], ["guarda", "Si guarda intorno"], ["corda", "Controlla la corda"], ["stretching", "Si sgranchisce"], ["saluta", "Saluta ogni tanto"]] },
} as const;

export type ExtraKey = keyof typeof EXTRA_OPTIONS;

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
  // la divisa degli Arcieri di Fabriano: giubbetto nero bordato d'argento, camicia del colore che si vuole, stemma sul petto
  { id: "fabriano", label: "Divisa Arcieri di Fabriano", look: { style: "medievale", top: "giubbetto", shirt: "#15171a", trim: "#e9e6de", sleeves: "#f1ece0", emblem: "compagnia", crest: "", bottom: "calzamaglia", pants: "#15171a", footwear: "stivali-alti", shoes: "#2b2420", belt: "larga", beltColor: "#7a4a24", bracers: "#8a5a2e", gloves: true, pouch: true, pouchType: "tascapane", necklace: true, quiverPlace: "fianco", quiver: "#9a6234", quiverStyle: "cuoio", bowType: "longbow", useMain: false, chestguard: false, cape: false, hat: "nessuno", scene: "fabriano" } },
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
  // 20 stili pronti nuovi
  { id: "olimpionico", label: "Olimpionico", look: { body: "uomo", style: "moderno", top: "divisa", shirt: "#1f3a5f", trim: "#e6c84a", bottom: "pantaloni", pants: "#14213d", footwear: "sportive", bowType: "olimpico", useMain: false, chestguard: true, emblem: "bersaglio", hair: "corti", beard: "nessuna", scene: "palazzetto", watch: true } },
  { id: "campionessa", label: "Campionessa", look: { body: "donna", style: "moderno", top: "divisa", shirt: "#8a2f2f", trim: "#f4f1ea", bottom: "pantaloni", pants: "#2b2d42", footwear: "sportive", bowType: "olimpico", useMain: false, chestguard: true, emblem: "stella", hair: "coda-alta", hairColor: "#16110d", scene: "palazzetto", earring: true, earringType: "perla" } },
  { id: "compoundista", label: "Compoundista", look: { body: "uomo", style: "moderno", top: "camicia", shirt: "#e5e5e5", trim: "#118ab2", bottom: "cargo", pants: "#3a3a3a", footwear: "scarponi", bowType: "compound", useMain: false, sunglasses: true, hat: "berretto", hatColor: "#118ab2", scene: "campo" } },
  { id: "palestra", label: "Allenamento al chiuso", look: { body: "ragazza", style: "moderno", top: "canotta", shirt: "#06d6a0", trim: "#073b4c", bottom: "pantaloncini", pants: "#073b4c", footwear: "sportive", hair: "coda", hairAcc: "nastro", scene: "palestra", bowType: "nudo", useMain: false } },
  { id: "cavaliere", label: "Cavaliere", look: { body: "uomo", style: "medievale", top: "cotta", shirt: "#8d949b", trim: "#8a2f2f", bottom: "brache", pants: "#3a3a3a", footwear: "stivali-alti", cape: true, capeColor: "#8a2f2f", capePattern: "stemma", clasp: "oro", emblem: "leone", hat: "nessuno", beard: "corta", scene: "salone", bowType: "storico", useMain: false } },
  { id: "vichingo", label: "Vichingo", look: { body: "uomo", style: "medievale", top: "giubba", shirt: "#6b5a48", trim: "#c9a46a", bottom: "larghi", pants: "#3a2a1e", footwear: "stivali-pelliccia", fur: true, furColor: "#6b5a48", hair: "vichinga", hairColor: "#b88a4a", beard: "lunga", stache: "folti", paint: "strisce", tattoo: "rune", scene: "neve", bowType: "longbow", useMain: false, quiverStyle: "pelliccia" } },
  { id: "elfo", label: "Elfo dei boschi", look: { body: "donna", style: "medievale", top: "incrociata", shirt: "#3c6e71", trim: "#d9b45a", bottom: "calzamaglia", pants: "#2f4a2a", footwear: "stivali-alti", ears: "punta", hair: "lunghi", hairColor: "#e9e4d8", hairAcc: "filo", cape: true, capeColor: "#2f4a2a", clasp: "foglia", hat: "alloro", scene: "foresta", bowType: "flatbow", useMain: false, fletchStyle: "parabolica" } },
  { id: "druido", label: "Druido", look: { body: "uomo", style: "medievale", top: "tunica-lunga", shirt: "#e9e4d8", trim: "#4b6b2e", bottom: "brache", pants: "#6b5a48", footwear: "sandali", age: "anziano", hair: "lunghi", hairColor: "#e5e5e5", beard: "lunga", beardColor: "#e5e5e5", hat: "alloro", amulet: true, scene: "rovine", bowType: "longbow", useMain: false } },
  { id: "cacciatrice", label: "Cacciatrice", look: { body: "donna", style: "medievale", top: "corpetto", shirt: "#7f5539", trim: "#dda15e", bottom: "larghi", pants: "#3a2a1e", footwear: "mocassini", hair: "trecce", hairColor: "#5e3b22", hairAcc: "piume", paint: "guance", quiverStyle: "decorata", scene: "autunno", bowType: "flatbow", useMain: false, fletchStyle: "scudo" } },
  { id: "nomade", label: "Arciere delle steppe", look: { body: "uomo", style: "medievale", top: "cappotto", shirt: "#bc6c25", trim: "#264653", pattern: "ricamo", bottom: "larghi", pants: "#3a2a1e", footwear: "stivali-alti", hat: "cuffia", hatColor: "#264653", stache: "manubrio", beard: "nessuna", bowType: "asiatico", useMain: false, scene: "deserto", quiverStyle: "decorata" } },
  { id: "pirata", label: "Arciere di mare", look: { body: "uomo", style: "medievale", top: "camicia", shirt: "#e9e4d8", trim: "#8a2f2f", pattern: "righe", bottom: "larghi", pants: "#1f3a5f", footwear: "stivali-risvolto", hat: "bandana", hatColor: "#8a2f2f", earring: true, earringType: "cerchio", beard: "pizzetto", scene: "spiaggia", bowType: "ricurvo", useMain: false } },
  { id: "templare", label: "Guardia del castello", look: { body: "uomo", style: "medievale", top: "cotta", shirt: "#8d949b", trim: "#e9e4d8", emblem: "croce", bottom: "brache", pants: "#55585a", footwear: "stivali", hat: "elmo", cape: true, capeColor: "#e9e4d8", capePattern: "bordato", scene: "castello", bowType: "storico", useMain: false } },
  { id: "principessa", label: "Principessa arciera", look: { body: "donna", style: "medievale", top: "tunica-lunga", shirt: "#6d597a", trim: "#d9b45a", pattern: "bordure", bottom: "calzamaglia", pants: "#3a2a4e", footwear: "stivaletti", hat: "cerchietto", hatColor: "#d9b45a", hair: "lunghi-mossi", hairColor: "#c98a4a", earring: true, earringType: "pendente", cape: true, capeColor: "#b56576", clasp: "gemma", scene: "palazzo", frame: "oro" } },
  { id: "montanaro", label: "Montanaro", look: { body: "uomo", style: "moderno", top: "giacca", shirt: "#bc6c25", pattern: "scozzese", trim: "#3a2a1e", bottom: "cargo", pants: "#4b4b4b", footwear: "scarponi", hat: "cuffia", hatColor: "#8a2f2f", beard: "piena", scene: "montagna", bowType: "ricurvo", useMain: false } },
  { id: "ranger-moderno", label: "Ranger moderno", look: { body: "donna", style: "moderno", top: "giacca", shirt: "#4b6b2e", pattern: "mimetico", trim: "#3a3a2a", bottom: "cargo", pants: "#3f4a2e", footwear: "scarponi", hat: "berretto", hatColor: "#3f4a2e", sunglasses: true, scene: "foresta", bowType: "compound", useMain: false, quiverStyle: "tubo" } },
  { id: "giullare", label: "Giullare del torneo", look: { body: "ragazzo", style: "medievale", top: "farsetto", shirt: "#ef233c", trim: "#ffd166", pattern: "rombi", bottom: "calzamaglia", pants: "#118ab2", footwear: "mocassini", hat: "robin", hatColor: "#ffd166", scene: "torneo", bowType: "ricurvo", useMain: false, blush: "rosato" } },
  { id: "saggio", label: "Maestro d'arco", look: { body: "uomo", style: "medievale", top: "cappotto-lungo", shirt: "#2b2d42", trim: "#d9b45a", bottom: "brache", pants: "#2b2d42", footwear: "stivali", age: "anziano", hair: "raccolti", hairColor: "#e5e5e5", beard: "pizzetto", beardColor: "#e5e5e5", stache: "sottili", scene: "salone", bowType: "asiatico", useMain: false, frame: "bronzo" } },
  { id: "volpe", label: "Volpe rossa", look: { body: "ragazza", style: "medievale", top: "ranger", shirt: "#bc6c25", trim: "#f4f1ea", bottom: "calzamaglia", pants: "#3a2a1e", footwear: "stivaletti", hair: "frangia", hairColor: "#c46b2b", paint: "volpe", cape: true, capeColor: "#9c6644", hat: "cappuccio", hatColor: "#9c6644", scene: "autunno", bowType: "flatbow", useMain: false } },
  { id: "notturno", label: "Arciere della notte", look: { body: "uomo", style: "medievale", top: "incrociata", shirt: "#14213d", trim: "#8d99ae", pattern: "fasce", bottom: "larghi", pants: "#14181c", footwear: "stivali-alti", cape: true, capeColor: "#14181c", capePattern: "stelle", mask: true, hat: "cappuccio", hatColor: "#14181c", scene: "castello", frame: "notte", bowType: "longbow", useMain: false, fletchStyle: "vela" } },
  { id: "contadino", label: "Arciere del villaggio", look: { body: "uomo", style: "medievale", top: "tunica", shirt: "#a3b18a", trim: "#7f5539", bottom: "brache", pants: "#7f5539", footwear: "mocassini", hat: "tesa", hatColor: "#c9b08a", pouch: true, pouchType: "tascapane", beard: "barbetta", scene: "villaggio", bowType: "longbow", useMain: false, quiverStyle: "cestino" } },
];

function pick<T>(list: readonly T[], r: number) {
  return list[Math.floor(r * list.length) % list.length];
}

/** Un arciere a caso, per chi non sa da dove partire. */
/** tratti della persona: uno stile pronto li cambia solo se li indica lui */
const PERSONAL: (keyof AvatarLook)[] = ["body", "build", "skin", "face", "eyes", "brows", "nose", "noseSize", "hair", "hairColor", "hairLength", "hairVolume", "beard", "beardColor", "beardLength", "stache", "expression", "eyeSize", "browSize", "eyeShape", "mouth", "ears", "freckles", "buildW", "stature", "age", "lefty"];

/**
 * Stile pronto: abiti e accessori ripartono da zero, così non restano pezzi del modello
 * precedente (maschera, corone...). Il viso e il corpo restano i tuoi, se lo stile non li cambia.
 */
export function presetLook(base: AvatarLook, preset: Partial<AvatarLook>): AvatarLook {
  const keep: Partial<AvatarLook> = {};
  for (const k of PERSONAL) if (!(k in preset)) (keep as Record<string, unknown>)[k] = base[k];
  return normalizeLook({ ...AVATAR_DEFAULT, ...keep, ...preset, lefty: base.lefty });
}

export function randomLook(base: AvatarLook): AvatarLook {
  const r = () => Math.random();
  const body = pick(["uomo", "donna", "ragazzo", "ragazza"] as const, r());
  const style = r() < 0.65 ? "moderno" : "medievale";
  const hair = pick(["corti", "rasati", "mossi", "ricci", "lunghi", "coda", "chignon", "treccia", "codini", "caschetto", "cresta", "calvo", "spettinati", "lunghi-mossi", "raccolti", "afro", "trecce", "frangia", "ciuffo", "undercut", "dread", "vichinga", "coda-alta"] as const, r());
  return normalizeLook({
    ...base,
    mask: false,
    body,
    build: pick(["snello", "normale", "robusto"] as const, r()),
    skin: pick(SKINS, r()),
    face: pick(["ovale", "tondo", "squadrato", "allungato"] as const, r()),
    eyes: pick(EYE_COLORS, r()),
    brows: pick(["sottili", "normali", "folte"] as const, r()),
    expression: pick(["sorriso", "sereno", "concentrato", "deciso"] as const, r()),
    freckles: r() < 0.25,
    glasses: r() < 0.15,
    hair: (body === "ragazzo" || body === "ragazza") && hair === "calvo" ? "mossi" : hair,
    hairColor: pick(HAIR_COLORS.slice(0, 10), r()),
    beard: body === "uomo" ? pick(["nessuna", "accenno", "corta", "piena", "pizzetto", "baffi", "lunga", "barbetta", "basette", "mosca"] as const, r()) : "nessuna",
    stache: body === "uomo" ? pick(["auto", "auto", "nessuno", "sottili", "classici", "folti", "manubrio", "ferro"] as const, r()) : "nessuno",
    nose: pick(["piccolo", "dritto", "aquilino", "largo", "insu", "patata"] as const, r()),
    noseSize: String(Math.round(30 + r() * 40)),
    hairVolume: String(Math.round(30 + r() * 40)),
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
