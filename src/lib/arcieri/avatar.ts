/** L'arciere della Home: aspetto, abiti, accessori e attrezzatura. Salvato sul telefono e sul profilo. */
export type HairStyle = "corti" | "rasati" | "mossi" | "ricci" | "lunghi" | "coda" | "chignon" | "treccia" | "codini" | "caschetto" | "cresta" | "calvo" | "spettinati" | "lunghi-mossi" | "raccolti" | "afro" | "trecce" | "frangia" | "ciuffo" | "undercut" | "dread" | "vichinga" | "coda-alta";
export type Pose = "animata" | "riposo" | "incocco" | "mira" | "allungo" | "accompagna" | "vittoria" | "fiero" | "saluto" | "esulta" | "pensa" | "mostra" | "spalla";

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

export const SKINS = ["#f8dcc8", "#eec5a4", "#dba57d", "#c0865c", "#9a6440", "#6e4429", "#4a2c1a",
  // nove carnagioni in più, dalle più chiare con sottotono rosato alle più scure
  "#fbe7dd", "#f3d0b5", "#e8b896", "#d9a47c", "#b97a52", "#8a5634", "#7a4b30", "#5c3a24", "#3b2315"];
export const HAIR_COLORS = ["#16110d", "#3b2a1d", "#5e3b22", "#8a5a2e", "#b88a4a", "#e2c48a", "#f1e6c8", "#8a8a8a", "#e8e8e8", "#a0301f", "#2c3e66", "#7c3aed", "#2f9e7a",
  // dodici tinte in più: castani caldi, ramati, biondi, grigi e colori di fantasia
  "#2a1a12", "#4a2a1a", "#6e3a1e", "#9a4a22", "#c4622d", "#d99a5a", "#efd9a8", "#b9b2a6", "#5a5a5a", "#d14f8a", "#3a8fd1", "#e0e060"];
export const EYE_COLORS = ["#5b3a1e", "#2f2116", "#3d7a4f", "#3b6ea8", "#7a8a96", "#8a6a2c", "#6b4fa0",
  "#7a4a1a", "#a07a3a", "#5a7a3a", "#2f8a8a", "#5a8ad1", "#9aa8b8", "#b0403a", "#c9a227"];
export const CLOTH_COLORS = ["#2f6f62", "#1f3a5f", "#5b2b6e", "#8a2f2f", "#c46b2b", "#d9c39a", "#3a3a3a", "#e9e4d8", "#4b6b2e", "#2a5d8a", "#c7a03a", "#1d1d1f", "#d8cdb6", "#4a4a2c", "#55585a", "#6b5a48", "#c9b08a", "#5a3a22", "#2f4a2a", "#7a2a3a",
  // 24 tinte nuove: naturali, nobili e moderne
  "#0f5257", "#3c6e71", "#7d8f69", "#a3b18a", "#bc6c25", "#dda15e", "#9c6644", "#7f5539", "#6d597a", "#b56576", "#e56b6f", "#355070",
  "#14213d", "#fca311", "#e5e5e5", "#2b2d42", "#8d99ae", "#ef233c", "#06d6a0", "#118ab2", "#ffd166", "#073b4c", "#f4a261", "#264653",
  // 26 tinte in più: terre, tessuti tinti a mano, pastelli e colori delle compagnie
  "#6b2d2d", "#8c3b2e", "#a65d3b", "#c2884a", "#8a7a4a", "#5f6b3a", "#3f5a3f", "#2d4a4a", "#2f4f6f", "#3a3f6b", "#4a2f5a", "#6a2f4a",
  "#b8a07a", "#cbbf9a", "#e8dcc0", "#f2e6d0", "#a8c3a0", "#9fc0d0", "#c0b0d8", "#e0a8b0", "#f0c8a0", "#d0d0c0",
  "#0a0a0c", "#1c2a1f", "#2a1c1c", "#1c1f2a"];
export const GEAR_COLORS = ["#2f6fbe", "#1d2126", "#b02a2a", "#3fae6a", "#e6b325", "#c9c9c9", "#7a4a26", "#7c3aed", "#e07a2f", "#f4f1ea", "#ff5fa2", "#14181c",
  // legni, metalli e colori da gara
  "#5a3418", "#8a5a2a", "#b07a3a", "#3a2412", "#9aa3ad", "#d9b45a", "#b06a3a", "#0f5257", "#264653", "#e63946", "#06d6a0", "#fca311"];

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
  pattern: { label: "Fantasia della veste", tab: "abiti", items: [["nessuno", "Tinta unita"], ["righe", "A righe"], ["righe-verticali", "Righe verticali"], ["quadri", "A quadri"], ["scozzese", "Scozzese"], ["pois", "A pois"], ["rombi", "A rombi"], ["chevron", "A spina"], ["mimetico", "Mimetico"], ["ricamo", "Ricamata"], ["bordure", "Con bordure"], ["fasce", "A fasce"], ["sfumata", "Sfumata"], ["zigzag", "A zig-zag"], ["stelline", "Stelline"], ["foglie", "Foglie"], ["onde", "Onde"], ["diagonali", "Righe oblique"], ["nido", "Nido d'ape"], ["gigli", "Gigli"], ["croci", "Crocette"]] },
  emblem: { label: "Stemma sul petto", tab: "abiti", items: [["nessuno", "Nessuno"], ["compagnia", "Stemma della compagnia"], ["cervo", "Cervo"], ["lupo", "Lupo"], ["drago", "Drago"], ["freccia", "Freccia"], ["bersaglio", "Bersaglio"], ["giglio", "Giglio"], ["stella", "Stella"], ["scudo", "Scudo"], ["quercia", "Quercia"], ["aquila", "Aquila"], ["falco", "Falco"], ["leone", "Leone"], ["croce", "Croce"], ["sole", "Sole"], ["luna", "Luna"], ["corona", "Corona"], ["orso", "Orso"], ["cinghiale", "Cinghiale"], ["volpe", "Volpe"], ["civetta", "Civetta"], ["spade", "Spade incrociate"], ["torre", "Torre"], ["chiave", "Chiave"], ["ancora", "Ancora"], ["fiore", "Fiore"], ["trifoglio", "Trifoglio"], ["fiamma", "Fiamma"], ["cuore", "Cuore"]] },
  paint: { label: "Pittura sul viso", tab: "viso", items: [["nessuna", "Nessuna"], ["strisce", "Strisce"], ["maschera", "Maschera sugli occhi"], ["punti", "Punti"], ["tribale", "Tribale"], ["fulmine", "Fulmine"], ["mezza", "Mezzo viso"], ["naso", "Riga sul naso"], ["guance", "Guance"], ["volpe", "Volpe"], ["lupo", "Lupo"], ["occhi", "Occhi scuri"], ["zigzag", "Zig-zag"], ["croce", "Croce in fronte"], ["spirale", "Spirali"]] },
  tattoo: { label: "Tatuaggio", tab: "viso", items: [["nessuno", "Nessuno"], ["rune", "Rune sul braccio"], ["onde", "Onde sul braccio"], ["freccia", "Freccia sul braccio"], ["stelle", "Stelle sul collo"], ["lacrima", "Lacrima sul viso"], ["punti", "Punti sulla mano"], ["drago", "Drago sul braccio"], ["sole", "Sole sulla spalla"], ["luna", "Luna sul braccio"], ["foglia", "Foglia sul braccio"], ["bersaglio", "Bersaglio sul braccio"], ["spine", "Rami sul braccio"]] },
  earringType: { label: "Tipo di orecchino", tab: "accessori", items: [["cerchio", "Cerchio"], ["perla", "Perla"], ["pendente", "Pendente"], ["piuma", "Piuma"], ["doppio", "Doppio"], ["croce", "Croce"], ["zanna", "Zanna"], ["stella", "Stella"], ["freccia", "Freccia"], ["luna", "Luna"]] },
  hairAcc: { label: "Nei capelli", tab: "capelli", items: [["nessuno", "Niente"], ["perline", "Perline"], ["fermaglio", "Fermaglio"], ["nastro", "Nastro"], ["fiori", "Fiori"], ["piume", "Due piume"], ["anelli", "Anelli"], ["filo", "Filo dorato"], ["pettine", "Pettine"], ["corona-fiori", "Corona di fiori"], ["gemma", "Gemma"], ["osso", "Osso"], ["farfalla", "Farfalla"]] },
  bowDeco: { label: "Decorazione dell'arco", tab: "attrezzatura", items: [["nessuna", "Nessuna"], ["nastrini", "Nastrini"], ["intagli", "Intagli"], ["pelliccia", "Pelliccia"], ["dipinto", "Dipinto"], ["rune", "Rune"], ["piume", "Piume"], ["perline", "Perline"], ["fasce", "Fasce colorate"], ["spirale", "Fasciatura a spirale"], ["oro", "Punte d'oro"], ["stelle", "Stelle"], ["nappe", "Nappa"]] },
  fletchStyle: { label: "Forma delle penne", tab: "attrezzatura", items: [["classica", "Classica"], ["scudo", "A scudo"], ["parabolica", "Parabolica"], ["vela", "A vela"], ["lunga", "Lunga"], ["spirale", "A spirale"]] },
  quiverStyle: { label: "Tipo di faretra", tab: "accessori", items: [["cuoio", "Cuoio"], ["decorata", "Decorata"], ["pelliccia", "Con pelliccia"], ["tubo", "Tubo moderno"], ["cestino", "Intrecciata"], ["legno", "Legno"], ["stoffa", "Stoffa"], ["borchie", "Con borchie"], ["nastri", "Con nastri"], ["scaglie", "A scaglie"], ["dipinta", "Dipinta"]] },
  eyeShape: { label: "Forma degli occhi", tab: "viso", items: [["normali", "Normali"], ["mandorla", "A mandorla"], ["tondi", "Tondi"], ["allungati", "Allungati"], ["socchiusi", "Socchiusi"], ["grandi", "Grandi e vivaci"]] },
  mouth: { label: "Labbra", tab: "viso", items: [["normale", "Normali"], ["sottile", "Sottili"], ["piena", "Piene"], ["ghigno", "Sorriso storto"], ["aperta", "Aperte"], ["broncio", "Broncio"]] },
  ears: { label: "Orecchie", tab: "viso", items: [["normali", "Normali"], ["piccole", "Piccole"], ["grandi", "Grandi"], ["punta", "A punta"]] },
  blush: { label: "Colorito", tab: "viso", items: [["nessuno", "Naturale"], ["leggero", "Leggero"], ["rosato", "Rosato"], ["abbronzato", "Abbronzato"]] },
  age: { label: "Età", tab: "viso", items: [["giovane", "Giovane"], ["adulto", "Adulto"], ["maturo", "Maturo"], ["anziano", "Anziano"]] },
  mark: { label: "Segni particolari", tab: "viso", items: [["nessuno", "Nessuno"], ["neo", "Neo sulla guancia"], ["neo-labbro", "Neo sul labbro"], ["mento", "Cicatrice sul mento"], ["sopracciglio", "Sopracciglio tagliato"], ["neo-fronte", "Neo sulla fronte"], ["guancia", "Cicatrice sulla guancia"], ["fossette", "Fossette"]] },
  buckle: { label: "Fibbia della cintura", tab: "abiti", items: [["semplice", "Semplice"], ["oro", "Oro"], ["argento", "Argento"], ["celtica", "Celtica"], ["ovale", "Ovale"], ["quadrata", "Quadrata"], ["bronzo", "Bronzo"], ["rombo", "A rombo"], ["leone", "Leone"], ["freccia", "Con freccia"]] },
  pouchType: { label: "Tipo di borsello", tab: "accessori", items: [["borsello", "Borsello"], ["tascapane", "Tascapane"], ["sacchetto", "Sacchetto"], ["cofanetto", "Cofanetto"], ["corno", "Corno"], ["borraccia", "Borraccia"], ["bisaccia", "Bisaccia"], ["astuccio", "Astuccio"]] },
  clasp: { label: "Fermaglio del mantello", tab: "accessori", items: [["nessuno", "Nessuno"], ["oro", "Oro"], ["argento", "Argento"], ["foglia", "Foglia"], ["drago", "Drago"], ["gemma", "Gemma"], ["bronzo", "Bronzo"], ["luna", "Luna"], ["freccia", "Freccia"], ["nodo", "Nodo"]] },
  capePattern: { label: "Fantasia del mantello", tab: "accessori", items: [["liscio", "Liscio"], ["bordato", "Bordato"], ["righe", "A righe"], ["stelle", "Stellato"], ["scacchi", "A scacchi"], ["stemma", "Con stemma"], ["zigzag", "A zig-zag"], ["onde", "Onde"], ["diagonali", "Righe oblique"], ["gigli", "Gigli"], ["foglie", "Foglie"]] },
  frame: { label: "Cornice della foto profilo", tab: "scena", items: [["nessuna", "Nessuna"], ["oro", "Oro"], ["argento", "Argento"], ["bronzo", "Bronzo"], ["foglie", "Foglie"], ["frecce", "Frecce"], ["fuoco", "Fuoco"], ["ghiaccio", "Ghiaccio"], ["notte", "Notte"], ["arcobaleno", "Arcobaleno"], ["legno", "Legno"], ["bersaglio", "Bersaglio"], ["smeraldo", "Smeraldo"], ["rubino", "Rubino"], ["zaffiro", "Zaffiro"], ["corda", "Corda"], ["stelle", "Stelle"], ["alloro", "Alloro"], ["pietra", "Pietra"], ["tramonto", "Tramonto"]] },
  idle: { label: "Movimento da fermo", tab: "posa", items: [["fermo", "Fermo"], ["respiro", "Respira"], ["guarda", "Si guarda intorno"], ["corda", "Controlla la corda"], ["stretching", "Si sgranchisce"], ["saluta", "Saluta ogni tanto"], ["esulta", "Esulta ogni tanto"], ["pensa", "Pensa al tiro"]] },
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
  // 24 stili nuovi, con le fantasie, gli stemmi e le cornici nuove
  { id: "orso", label: "Guardiano dell'orso", look: { body: "uomo", style: "medievale", top: "giubba", shirt: "#4a2a1a", trim: "#c2884a", emblem: "orso", bottom: "brache", pants: "#3a2a1e", footwear: "stivali-pelliccia", fur: true, furColor: "#5a4632", beard: "piena", hair: "spettinati", hairColor: "#4a2a1a", scene: "montagna", bowType: "longbow", useMain: false, quiverStyle: "pelliccia", clasp: "bronzo", frame: "pietra" } },
  { id: "civetta", label: "Arciera della civetta", look: { body: "donna", style: "medievale", top: "incrociata", shirt: "#3a3f6b", trim: "#cbbf9a", emblem: "civetta", pattern: "stelline", bottom: "calzamaglia", pants: "#1c1f2a", footwear: "stivali-alti", hair: "lunghi", hairColor: "#2a1a12", cape: true, capeColor: "#1c1f2a", capePattern: "stelle", clasp: "luna", earring: true, earringType: "luna", scene: "castello", bowType: "ricurvo", useMain: false, frame: "zaffiro" } },
  { id: "cinghiale", label: "Cacciatore del cinghiale", look: { body: "uomo", style: "medievale", top: "corpetto", shirt: "#6b2d2d", trim: "#c2884a", emblem: "cinghiale", bottom: "larghi", pants: "#3a2a1e", footwear: "stivali-alti", beard: "corta", stache: "folti", scene: "autunno", bowType: "longbow", useMain: false, pouch: true, pouchType: "corno", quiverStyle: "scaglie", bowDeco: "nappe" } },
  { id: "marinaio", label: "Arciere del porto", look: { body: "uomo", style: "moderno", top: "maglia", shirt: "#f2e6d0", trim: "#2f4f6f", pattern: "righe", emblem: "ancora", bottom: "pantaloni", pants: "#2f4f6f", footwear: "mocassini", hat: "berretto", hatColor: "#2f4f6f", beard: "barbetta", scene: "spiaggia", bowType: "ricurvo", useMain: false, earring: true, earringType: "cerchio" } },
  { id: "torre", label: "Sentinella della torre", look: { body: "uomo", style: "medievale", top: "cotta", shirt: "#8d949b", trim: "#2f4f6f", emblem: "torre", bottom: "brache", pants: "#3a3f6b", footwear: "stivali", hat: "elmo", cape: true, capeColor: "#2f4f6f", capePattern: "diagonali", clasp: "argento", scene: "castello", bowType: "storico", useMain: false, buckle: "quadrata" } },
  { id: "giardiniera", label: "Arciera dei fiori", look: { body: "ragazza", style: "moderno", top: "camicia", shirt: "#e0a8b0", trim: "#a8c3a0", pattern: "foglie", emblem: "fiore", bottom: "gonna", pants: "#5f6b3a", footwear: "sandali", hair: "trecce", hairColor: "#c4622d", hairAcc: "corona-fiori", freckles: true, scene: "campagna", bowType: "flatbow", useMain: false, frame: "foglie" } },
  { id: "fiamma", label: "Arciere di fuoco", look: { body: "uomo", style: "medievale", top: "farsetto", shirt: "#8c3b2e", trim: "#fca311", emblem: "fiamma", pattern: "zigzag", bottom: "calzamaglia", pants: "#2a1c1c", footwear: "stivali-alti", hair: "cresta", hairColor: "#c4622d", paint: "fulmine", cape: true, capeColor: "#2a1c1c", capePattern: "zigzag", scene: "rovine", bowType: "ricurvo", useMain: false, frame: "fuoco", bowDeco: "oro" } },
  { id: "ghiaccio", label: "Arciera del nord", look: { body: "donna", style: "medievale", top: "cappotto-lungo", shirt: "#d0d0c0", trim: "#9fc0d0", pattern: "onde", bottom: "pantaloni", pants: "#2d4a4a", footwear: "stivali-pelliccia", fur: true, furColor: "#e8dcc0", hair: "vichinga", hairColor: "#efd9a8", scene: "neve", bowType: "flatbow", useMain: false, frame: "ghiaccio", clasp: "nodo" } },
  { id: "trifoglio", label: "Arciere del trifoglio", look: { body: "uomo", style: "medievale", top: "tunica", shirt: "#3f5a3f", trim: "#c2884a", emblem: "trifoglio", pattern: "bordure", bottom: "brache", pants: "#5a3a22", footwear: "mocassini", hat: "robin", hatColor: "#3f5a3f", beard: "accenno", hair: "ricci", hairColor: "#9a4a22", scene: "foresta", bowType: "longbow", useMain: false, quiverStyle: "nastri" } },
  { id: "spadaccino", label: "Arciere della guardia", look: { body: "uomo", style: "medievale", top: "giubbetto", shirt: "#1c2a1f", trim: "#d9b45a", emblem: "spade", bottom: "calzamaglia", pants: "#1c2a1f", footwear: "stivali-alti", cape: true, capeColor: "#6b2d2d", capePattern: "gigli", clasp: "freccia", buckle: "leone", scene: "salone", bowType: "storico", useMain: false, stache: "manubrio", frame: "oro" } },
  { id: "custode", label: "Custode delle chiavi", look: { body: "uomo", style: "medievale", top: "cappotto", shirt: "#2a1c1c", trim: "#b8a07a", emblem: "chiave", bottom: "pantaloni", pants: "#1c1f2a", footwear: "stivali", age: "maturo", beard: "piena", beardColor: "#8a8a8a", hair: "corti", hairColor: "#5a5a5a", scene: "palazzo", bowType: "asiatico", useMain: false, pouch: true, pouchType: "cofanetto" } },
  { id: "volpe-argento", label: "Volpe d'argento", look: { body: "donna", style: "medievale", top: "ranger", shirt: "#8d99ae", trim: "#e5e5e5", emblem: "volpe", bottom: "calzamaglia", pants: "#2b2d42", footwear: "stivaletti", hair: "coda-alta", hairColor: "#b9b2a6", paint: "volpe", cape: true, capeColor: "#2b2d42", hat: "cappuccio", hatColor: "#2b2d42", scene: "neve", bowType: "ricurvo", useMain: false, frame: "argento" } },
  { id: "cuore", label: "Arciere del cuore", look: { body: "ragazzo", style: "moderno", top: "felpa", shirt: "#e56b6f", trim: "#f2e6d0", emblem: "cuore", bottom: "jeans", pants: "#2f4f6f", footwear: "sportive", hair: "ciuffo", hairColor: "#3b2a1d", scene: "campo", bowType: "nudo", useMain: false, blush: "rosato" } },
  { id: "geometra", label: "Arciere geometrico", look: { body: "uomo", style: "moderno", top: "giacca", shirt: "#2d4a4a", trim: "#f0c8a0", pattern: "nido", bottom: "cargo", pants: "#3a3a3a", footwear: "scarponi", hair: "undercut", hairColor: "#16110d", glasses: true, scene: "palazzetto", bowType: "olimpico", useMain: false, watch: true, chestguard: true } },
  { id: "pellegrina", label: "Pellegrina", look: { body: "donna", style: "medievale", top: "tunica-lunga", shirt: "#cbbf9a", trim: "#6b2d2d", pattern: "croci", bottom: "calzamaglia", pants: "#5a3a22", footwear: "sandali", hat: "tesa", hatColor: "#8a7a4a", hair: "raccolti", hairColor: "#6e3a1e", pouch: true, pouchType: "bisaccia", scene: "deserto", bowType: "asiatico", useMain: false, amulet: true } },
  { id: "dragone", label: "Cavaliere del drago", look: { body: "uomo", style: "medievale", top: "cotta", shirt: "#55585a", trim: "#06d6a0", emblem: "drago", bottom: "brache", pants: "#1c2a1f", footwear: "stivali-alti", cape: true, capeColor: "#0f5257", capePattern: "stemma", clasp: "drago", tattoo: "drago", scene: "rovine", bowType: "storico", useMain: false, frame: "smeraldo" } },
  { id: "sole-dorato", label: "Arciera del sole", look: { body: "donna", style: "medievale", top: "corpetto", shirt: "#fca311", trim: "#8c3b2e", emblem: "sole", bottom: "larghi", pants: "#6b2d2d", footwear: "mocassini", hair: "afro", hairColor: "#16110d", skin: "#7a4b30", earring: true, earringType: "stella", hairAcc: "gemma", scene: "deserto", bowType: "flatbow", useMain: false, frame: "tramonto" } },
  { id: "scout", label: "Giovane esploratore", look: { body: "ragazzo", style: "moderno", top: "camicia", shirt: "#7d8f69", trim: "#c2884a", pattern: "diagonali", bottom: "pantaloncini", pants: "#5f6b3a", footwear: "scarponi", scarf: true, scarfColor: "#e63946", hat: "tesa", hatColor: "#8a7a4a", pouch: true, pouchType: "borraccia", scene: "montagna", bowType: "ricurvo", useMain: false } },
  { id: "corvo", label: "Arciere del corvo", look: { body: "uomo", style: "medievale", top: "cappotto-lungo", shirt: "#0a0a0c", trim: "#5a5a5a", emblem: "falco", bottom: "pantaloni", pants: "#0a0a0c", footwear: "stivali-alti", cape: true, capeStyle: "frastagliato", capeColor: "#0a0a0c", hat: "cappuccio", hatColor: "#0a0a0c", paint: "occhi", scene: "castello", bowType: "longbow", useMain: false, fletchStyle: "lunga", frame: "notte" } },
  { id: "lago", label: "Arciera del lago", look: { body: "donna", style: "medievale", top: "incrociata", shirt: "#9fc0d0", trim: "#2f4f6f", pattern: "onde", bottom: "calzamaglia", pants: "#2f4f6f", footwear: "stivaletti", hair: "lunghi-mossi", hairColor: "#efd9a8", hairAcc: "filo", cape: true, capeColor: "#2d4a4a", capePattern: "onde", scene: "lago", bowType: "ricurvo", useMain: false, earring: true, earringType: "perla" } },
  { id: "festa", label: "Arciere del palio", look: { body: "uomo", style: "medievale", top: "farsetto", shirt: "#e63946", trim: "#ffd166", pattern: "scozzese", bottom: "calzamaglia", pants: "#ffd166", footwear: "mocassini", hat: "piuma", hatColor: "#e63946", scene: "torneo", bowType: "longbow", useMain: false, bowDeco: "nastrini", pose: "vittoria", frame: "arcobaleno" } },
  { id: "allievo", label: "Allievo del corso", look: { body: "ragazza", style: "moderno", top: "polo", shirt: "#118ab2", trim: "#f2e6d0", emblem: "bersaglio", bottom: "pantaloni", pants: "#2b2d42", footwear: "sportive", hair: "coda", hairColor: "#5e3b22", chestguard: true, scene: "palestra", bowType: "nudo", useMain: false } },
  { id: "veterano", label: "Veterano dei tornei", look: { body: "uomo", style: "medievale", top: "giubba", shirt: "#5a3a22", trim: "#d9b45a", emblem: "corona", bottom: "brache", pants: "#3a2a1e", footwear: "stivali-risvolto", age: "anziano", beard: "lunga", beardColor: "#d0d0c0", hair: "lunghi", hairColor: "#d0d0c0", mark: "guancia", scene: "torneo", bowType: "longbow", useMain: false, frame: "alloro", pose: "fiero" } },
  { id: "notte-stellata", label: "Arciera delle stelle", look: { body: "donna", style: "medievale", top: "tunica-lunga", shirt: "#14213d", trim: "#ffd166", pattern: "stelline", bottom: "calzamaglia", pants: "#14213d", footwear: "stivali-alti", cape: true, capeColor: "#0a0a0c", capePattern: "stelle", clasp: "gemma", hair: "chignon", hairColor: "#16110d", hairAcc: "farfalla", scene: "lago", bowType: "ricurvo", useMain: false, bowDeco: "stelle", frame: "stelle" } },
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

/**
 * Un'idea di abbigliamento per il tuo arciere: abiti, colori, accessori e dettagli nuovi a caso,
 * ma il viso e il corpo restano i tuoi.
 */
export function outfitIdea(base: AvatarLook): AvatarLook {
  const r = () => Math.random();
  const rl = randomLook(base);
  const out: Partial<AvatarLook> = {};
  for (const [k, v] of Object.entries(rl) as [keyof AvatarLook, unknown][]) if (!PERSONAL.includes(k)) (out as Record<string, unknown>)[k] = v;
  const extra = (k: ExtraKey, chance: number) => {
    if (r() > chance) return;
    const items = EXTRA_OPTIONS[k].items as readonly (readonly [string, string])[];
    (out as Record<string, unknown>)[k] = pick(items, r())[0];
  };
  extra("pattern", 0.45);
  extra("emblem", 0.5);
  extra("capePattern", 0.4);
  extra("clasp", 0.4);
  extra("buckle", 0.5);
  extra("quiverStyle", 0.5);
  extra("bowDeco", 0.35);
  extra("fletchStyle", 0.4);
  extra("frame", 0.3);
  out.scene = pick(SCENE_IDEAS, r());
  out.useMain = false;
  out.bowType = pick(["olimpico", "nudo", "ricurvo", "longbow", "storico", "flatbow", "asiatico"], r());
  return presetLook(base, out);
}

const SCENE_IDEAS = ["campo", "foresta", "castello", "palazzo", "montagna", "lago", "deserto", "villaggio", "neve", "campagna", "torneo", "rovine", "spiaggia", "autunno", "fabriano"];

