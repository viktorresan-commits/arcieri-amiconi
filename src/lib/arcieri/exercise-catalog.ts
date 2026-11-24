/**
 * Esercizi per i programmi dell'allenatore, divisi per categoria. Fonte: «Programmazione
 * dell'allenamento» (A. Fontana, istruttore FITARCO: riscaldamento R, elastico EL, bastone BS,
 * coordinazione, equilibrio EQ, mano MANO, rinforzo RM, specifici SP) unita agli esercizi delle
 * lezioni dell'app. Le frasi sono scritte perché le capisca anche un bambino.
 * Regola d'oro del testo: ci si ferma alla fatica, mai al dolore.
 */

export type Level = 1 | 2 | 3;
export type ExItem = { code: string; name: string; how: string; dose: string; level: Level };
export type ExSection = { id: string; title: string; hint: string; items: ExItem[] };

export type ProgramHeader = {
  athlete: string;
  age: string;
  company: string;
  bow: string;
  coach: string;
  from: string;
  to: string;
  days: string;
  goal: string;
};

export type ExProgram = {
  level: Level;
  title: string;
  header: ProgramHeader;
  sections: ExSection[];
  notes: string;
};

export const LEVEL_NAME: Record<Level, string> = { 1: "Principiante", 2: "Intermedio", 3: "Avanzato" };
export const LEVEL_HINT: Record<Level, string> = {
  1: "Bambini e primi mesi: giochi, basi del gesto, poche frecce",
  2: "Chi tira da almeno un anno: tenuta, ritmo e più frecce",
  3: "Agonisti: carico, tenuta lunga, simulazioni di gara",
};

/** catalogo completo: categoria → esercizi (code, nome, come si fa, quanto, difficoltà) */
export const CATALOG: ExSection[] = [
  {
    id: "riscaldamento",
    title: "Riscaldamento",
    hint: "Prima di prendere l'arco, sempre",
    items: [
      { code: "R1", name: "Mulino con le braccia", how: "Braccia tese, palmi in su: fai dei cerchi in avanti, poi all'indietro.", dose: "1 minuto per verso", level: 1 },
      { code: "R2", name: "Spingi il cielo", how: "Braccia sopra la testa: spingi in alto prima una mano poi l'altra.", dose: "20 volte", level: 1 },
      { code: "R3", name: "Giro del busto", how: "Gira piano il busto a destra e a sinistra, la testa segue.", dose: "10 per lato", level: 1 },
      { code: "R4", name: "Mano sulla spalla", how: "Piega il gomito e tocca la spalla, poi distendi il braccio.", dose: "15 per braccio", level: 1 },
      { code: "R5", name: "Inclinazioni laterali", how: "In piedi, piegati di lato piano, un lato e poi l'altro.", dose: "10 per lato", level: 1 },
      { code: "R6", name: "Piegamenti al muro", how: "Mani sul muro, piega e distendi le braccia. Più bravo? A terra.", dose: "10 volte", level: 2 },
      { code: "R7", name: "Ginocchia alte", how: "Sul posto, alza le ginocchia sopra l'ombelico, una per volta.", dose: "30 secondi", level: 1 },
      { code: "R8", name: "Giro dei polsi", how: "Fai girare piano i polsi in un verso e nell'altro.", dose: "10 per verso", level: 1 },
      { code: "R9", name: "Collo morbido", how: "Testa avanti e indietro, poi verso le spalle. Piano, senza scatti.", dose: "5 per direzione", level: 1 },
    ],
  },
  {
    id: "elastico",
    title: "Elastico",
    hint: "Elastico leggero; più forte solo quando è facile",
    items: [
      { code: "EL1", name: "Tira in avanti", how: "Elastico davanti, mani larghe come le spalle: allarga e torna.", dose: "3 × 10", level: 1 },
      { code: "EL2", name: "Tira e tieni", how: "Come EL1, ma tieni aperto 3 secondi prima di tornare.", dose: "3 × 8", level: 2 },
      { code: "EL3", name: "Elastico sotto i piedi", how: "Piedi sull'elastico: alza le braccia fino alle spalle e scendi piano.", dose: "3 × 10", level: 1 },
      { code: "EL4", name: "La trazione", how: "Una mano ferma all'ombelico, l'altra tira indietro come con l'arco.", dose: "3 × 10 per lato", level: 1 },
      { code: "EL5", name: "Apri dietro", how: "Elastico dietro la schiena: apri e chiudi le braccia alla larghezza delle spalle.", dose: "3 × 10", level: 2 },
      { code: "EL6", name: "Gomito a 90°", how: "Elastico dietro, gomito piegato ad angolo: tira verso il basso.", dose: "3 × 10", level: 2 },
      { code: "EL7", name: "Gomito incollato", how: "Gomito attaccato al fianco: ruota l'avambraccio verso fuori e torna.", dose: "3 × 12 per lato", level: 2 },
      { code: "EL8", name: "Trazione completa", how: "Con l'elastico fai tutta la sequenza: alza, tira, ancora 5 secondi, rilascia piano.", dose: "15 volte", level: 3 },
    ],
  },
  {
    id: "bastone",
    title: "Bastone",
    hint: "Dai 14 anni in su",
    items: [
      { code: "BS1", name: "Cerchi col bastone", how: "Bastone tenuto largo: cerchi grandi che diventano piccoli, dietro la linea delle spalle.", dose: "10 cerchi", level: 2 },
      { code: "BS3", name: "Su e giù", how: "Bastone in linea con le spalle: alza e abbassa piano.", dose: "3 × 10", level: 2 },
      { code: "BS4", name: "Elica", how: "Tieni il bastone in mezzo e fallo girare in un verso e nell'altro.", dose: "30 secondi per verso", level: 3 },
    ],
  },
  {
    id: "coordinazione",
    title: "Coordinazione ed equilibrio",
    hint: "Giochi per il corpo e per la mira",
    items: [
      { code: "CO1", name: "Giocoliere", how: "Due palline da tennis o di spugna: lancia e riprendi, sempre più in alto.", dose: "2 minuti", level: 1 },
      { code: "CO2", name: "Passa la palla", how: "Passa una palla da una mano all'altra, veloce ma senza farla cadere.", dose: "1 minuto", level: 1 },
      { code: "CO3", name: "Braccio e gamba incrociati", how: "Alza la gamba sinistra e il braccio destro, poi cambia.", dose: "10 per lato", level: 1 },
      { code: "CO4", name: "Palleggio", how: "Palleggia con la mano destra, poi con la sinistra.", dose: "1 minuto per mano", level: 2 },
      { code: "EQ1", name: "Su un piede, mirando", how: "Stai su un piede e guarda fisso un bersaglio lontano.", dose: "3 × 20 secondi per piede", level: 1 },
      { code: "EQ2", name: "Mira in equilibrio", how: "Su un cuscino o una tavoletta, mira un bersaglio vicino; poi più lontano.", dose: "3 × 30 secondi", level: 2 },
      { code: "EQ4", name: "Sulla trave", how: "Cammina su una trave bassa; all'inizio con un compagno che ti dà la mano.", dose: "5 passaggi", level: 3 },
    ],
  },
  {
    id: "mani",
    title: "Mani e dita",
    hint: "Per una presa morbida e un rilascio pulito",
    items: [
      { code: "MA1", name: "Strizza la pallina", how: "Stringi una pallina e tieni 10 secondi (prima di spugna, poi da tennis).", dose: "5 per mano", level: 1 },
      { code: "MA2", name: "Apri e chiudi", how: "Allarga le dita più che puoi, tieni 5 secondi, poi chiudi.", dose: "10 volte", level: 1 },
      { code: "MA3", name: "Polso su e giù", how: "Piega il polso in su, tieni 5 secondi, poi in giù.", dose: "8 per verso", level: 1 },
      { code: "MA4", name: "Gira l'avambraccio", how: "Con un pesetto leggero in mano, gira il palmo in su e in giù.", dose: "3 × 10", level: 2 },
      { code: "MA5", name: "Arrotola il peso", how: "Dita aperte, polso piegato, poi chiudi le dita e solleva un pesetto.", dose: "3 × 8", level: 3 },
    ],
  },
  {
    id: "forza",
    title: "Forza",
    hint: "Fatica sì, dolore no",
    items: [
      { code: "RM1", name: "Rotazioni con la palla", how: "Palla medica da 2 kg al petto: gira il busto, prima piano poi più veloce.", dose: "3 × 10", level: 3 },
      { code: "RM2", name: "Palla al muro", how: "Lancia la palla contro il muro e riprendila (calcio, poi basket, poi 1 kg dai 16 anni).", dose: "2 minuti", level: 2 },
      { code: "RM3", name: "Lancia in alto", how: "Lancia la palla in alto e riprendila (calcio dai 14, poi basket, poi 1 kg dai 16).", dose: "3 minuti", level: 2 },
      { code: "RM4", name: "Lanci in coppia", how: "Con un compagno, lanciatevi la palla; poi scambiate i ruoli.", dose: "2 minuti a testa", level: 3 },
      { code: "SP4", name: "Gambe sul tappetino", how: "Sdraiato, alza le gambe di 20 cm e alternale; più bravo: anche a destra e sinistra.", dose: "3 × 20 secondi", level: 2 },
    ],
  },
  {
    id: "tecnica",
    title: "Tecnica (dalle lezioni)",
    hint: "Le lezioni dell'app da ripassare con questi esercizi",
    items: [
      { code: "TE1", name: "I fischi", how: "Prima di ogni volée di' ad alta voce cosa vuol dire il segnale che senti.", dose: "Ogni volée", level: 1 },
      { code: "TE2", name: "Piedi fermi", how: "Segna i piedi con due bastoncini e tieni la postura senza arco, occhi chiusi.", dose: "30 secondi", level: 1 },
      { code: "TE3", name: "Mano aperta", how: "Trazioni con l'elastico tenendo la mano dell'arco aperta e morbida.", dose: "10 volte", level: 1 },
      { code: "TE4", name: "Allo specchio", how: "Fai l'allungo davanti allo specchio: la corda tocca sempre gli stessi punti?", dose: "5 allunghi", level: 1 },
      { code: "TE5", name: "Incocca senza guardare", how: "Incocca le frecce senza guardare, poi controlla che la penna sia giusta.", dose: "12 frecce", level: 1 },
      { code: "TE6", name: "Paglione bianco", how: "Da 5 metri, senza bersaglio: senti solo il rilascio e l'accompagnamento.", dose: "12 frecce", level: 2 },
      { code: "TE7", name: "Le fasi a mente", how: "In una volée di' a mente il nome di ogni fase del tiro.", dose: "1 volée", level: 2 },
      { code: "TE8", name: "Clicker a occhi chiusi", how: "Con elastico o arco leggero, passa il clicker a occhi chiusi e conta il tempo.", dose: "10 volte", level: 2 },
      { code: "SP1", name: "Tieni 6 secondi", how: "Arco aperto: tieni l'ancoraggio 6 secondi, poi rilascia.", dose: "3 × 6 frecce", level: 2 },
      { code: "SP2", name: "Il 5 / 8", how: "All'ancoraggio conta 5 secondi, aspetta altri 3, poi rilascia.", dose: "3 × 6 frecce", level: 2 },
      { code: "SP3", name: "Tenuta con elastico al polso", how: "Come il 6 secondi, con un elastico legato al polso dell'arco: tieni la mira almeno 6 secondi.", dose: "3 × 6 frecce", level: 3 },
      { code: "TE9", name: "Tacche a gruppi", how: "Tira 3 volée e regola il mirino solo dopo aver visto il gruppo di tutte e 3.", dose: "3 volée", level: 3 },
    ],
  },
  {
    id: "tiro",
    title: "Tiro con l'arco",
    hint: "Frecce vere: conta le volée",
    items: [
      { code: "TI1", name: "Volée vicine", how: "Bersaglio grande a 10 metri: tira con calma, una freccia per volta.", dose: "6 volée da 3 frecce", level: 1 },
      { code: "TI2", name: "Vicino e lontano", how: "3 volée a 10 m e 3 a 18 m sullo stesso bersaglio: guarda quanto è largo il gruppo.", dose: "6 volée da 3", level: 1 },
      { code: "TI3", name: "Volée di ritmo", how: "18 metri, sempre lo stesso ritmo a ogni freccia.", dose: "10 volée da 3", level: 2 },
      { code: "TI4", name: "Piramide", how: "Quattro frecce tenendo l'ancoraggio 2, 4, 6 e 4 secondi.", dose: "4 serie", level: 3 },
      { code: "TI5", name: "Gara simulata", how: "Un turno intero con il timer di gara e un compagno che segna i punti.", dose: "60 frecce (al chiuso) o 72 (fuori)", level: 3 },
      { code: "TI6", name: "Finale sotto pressione", how: "3 frecce in 2 minuti con un compagno che ti guarda.", dose: "3 volte", level: 3 },
      { code: "TI7", name: "Fermati quando trema", how: "Conta le frecce e smetti alla prima volée in cui il braccio trema.", dose: "Ogni uscita", level: 1 },
    ],
  },
  {
    id: "testa",
    title: "Respiro e testa",
    hint: "Calma e sempre gli stessi passi",
    items: [
      { code: "TS1", name: "Respiro a quadrato", how: "Dentro 4 secondi, fermo 4, fuori 4, fermo 4.", dose: "5 giri prima di tirare", level: 1 },
      { code: "TS2", name: "La mia routine", how: "Prima di ogni freccia ripeti gli stessi passi, sempre nello stesso ordine.", dose: "Ogni freccia", level: 2 },
      { code: "TS3", name: "Una cosa da migliorare", how: "Guarda le statistiche e scegli una sola cosa su cui lavorare questa settimana.", dose: "1 volta a settimana", level: 3 },
    ],
  },
  {
    id: "defaticamento",
    title: "Defaticamento",
    hint: "Alla fine, per tornare tranquilli",
    items: [
      { code: "DF1", name: "Allunga le spalle", how: "Porta un braccio davanti al petto e tienilo con l'altra mano.", dose: "20 secondi per braccio", level: 1 },
      { code: "DF2", name: "Allunga le braccia", how: "Mano dietro la testa, gomito in alto, spingi piano con l'altra mano.", dose: "20 secondi per braccio", level: 1 },
      { code: "DF3", name: "Dita e polsi", how: "Braccio teso, palmo in avanti: tira piano le dita verso di te.", dose: "15 secondi per mano", level: 1 },
      { code: "DF4", name: "Respira e cammina", how: "Cammina piano e respira lento con il naso.", dose: "2 minuti", level: 1 },
    ],
  },
];

const byCode = new Map(CATALOG.flatMap((s) => s.items.map((i) => [i.code, i] as const)));

function pick(codes: (string | [string, string])[]) {
  return codes
    .map((c) => {
      const [code, dose] = Array.isArray(c) ? c : [c, ""];
      const it = byCode.get(code);
      return it ? { ...it, dose: dose || it.dose } : null;
    })
    .filter((x): x is ExItem => Boolean(x));
}

function section(id: string, codes: (string | [string, string])[]): ExSection {
  const s = CATALOG.find((x) => x.id === id)!;
  return { id: s.id, title: s.title, hint: s.hint, items: pick(codes) };
}

export const EMPTY_HEADER: ProgramHeader = { athlete: "", age: "", company: "", bow: "", coach: "", from: "", to: "", days: "", goal: "" };

/** i tre programmi già pronti, da adattare all'allievo */
export function preset(level: Level): ExProgram {
  if (level === 1)
    return {
      level,
      title: "Programma di allenamento",
      header: { ...EMPTY_HEADER, days: "2 volte a settimana, 45 minuti", goal: "Imparare il gesto giusto e divertirsi in sicurezza" },
      sections: [
        section("riscaldamento", ["R1", "R3", "R4", "R7", "R8", "R9"]),
        section("elastico", ["EL1", "EL3", "EL4"]),
        section("coordinazione", ["CO1", "CO2", "CO3", "EQ1"]),
        section("mani", ["MA1", "MA2"]),
        section("tecnica", ["TE1", "TE2", "TE3", "TE4", "TE5"]),
        section("tiro", ["TI1", "TI7"]),
        section("testa", ["TS1"]),
        section("defaticamento", ["DF1", "DF2", "DF4"]),
      ],
      notes: "",
    };
  if (level === 2)
    return {
      level,
      title: "Programma di allenamento",
      header: { ...EMPTY_HEADER, days: "3 volte a settimana, 75 minuti", goal: "Tiro più ripetibile: stessa tenuta e stesso ritmo a ogni freccia" },
      sections: [
        section("riscaldamento", ["R1", "R2", "R3", "R5", "R6", "R8"]),
        section("elastico", ["EL2", "EL4", "EL5", "EL6", "EL7"]),
        section("bastone", ["BS1", "BS3"]),
        section("coordinazione", ["CO4", "EQ2"]),
        section("mani", ["MA1", "MA3", "MA4"]),
        section("forza", ["RM2", "RM3", "SP4"]),
        section("tecnica", ["TE6", "TE7", "TE8", "SP1", "SP2"]),
        section("tiro", ["TI2", "TI3"]),
        section("testa", ["TS1", "TS2"]),
        section("defaticamento", ["DF1", "DF2", "DF3"]),
      ],
      notes: "",
    };
  return {
    level,
    title: "Programma di allenamento",
    header: { ...EMPTY_HEADER, days: "4–5 volte a settimana, 2 ore", goal: "Tenuta lunga, ritmo di gara e lucidità sotto pressione" },
    sections: [
      section("riscaldamento", ["R1", "R2", "R3", "R5", ["R6", "3 × 12"], "R8"]),
      section("elastico", [["EL2", "3 × 12"], "EL5", "EL6", ["EL7", "3 × 15 per lato"], "EL8"]),
      section("bastone", ["BS1", "BS3", "BS4"]),
      section("coordinazione", ["EQ2", "EQ4"]),
      section("mani", ["MA4", "MA5"]),
      section("forza", ["RM1", "RM2", "RM4", ["SP4", "3 × 30 secondi"]]),
      section("tecnica", [["SP1", "4 × 6 frecce"], "SP2", "SP3", "TE9"]),
      section("tiro", ["TI4", "TI5", "TI6"]),
      section("testa", ["TS1", "TS2", "TS3"]),
      section("defaticamento", ["DF1", "DF2", "DF3", "DF4"]),
    ],
    notes: "",
  };
}

/** un programma letto dal database, ripulito */
export function cleanProgram(raw: unknown): ExProgram {
  const r = (raw ?? {}) as Partial<ExProgram>;
  const lv = (r.level === 2 || r.level === 3 ? r.level : 1) as Level;
  const str = (v: unknown, n = 200) => String(v ?? "").slice(0, n);
  const h = (r.header ?? {}) as Partial<ProgramHeader>;
  return {
    level: lv,
    title: str(r.title, 80) || "Programma di allenamento",
    header: { athlete: str(h.athlete, 80), age: str(h.age, 20), company: str(h.company, 80), bow: str(h.bow, 60), coach: str(h.coach, 80), from: str(h.from, 20), to: str(h.to, 20), days: str(h.days, 80), goal: str(h.goal, 200) },
    sections: (Array.isArray(r.sections) ? r.sections : []).slice(0, 16).map((s) => ({
      id: str(s?.id, 40),
      title: str(s?.title, 60),
      hint: str(s?.hint, 120),
      items: (Array.isArray(s?.items) ? s.items : []).slice(0, 20).map((i) => ({
        code: str(i?.code, 8),
        name: str(i?.name, 60),
        how: str(i?.how, 220),
        dose: str(i?.dose, 50),
        level: (i?.level === 2 || i?.level === 3 ? i.level : 1) as Level,
      })),
    })).filter((s) => s.items.length),
    notes: str(r.notes, 600),
  };
}
