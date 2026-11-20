/** Lezioni in tre livelli: punti chiave, errori tipici, un esercizio e una domanda di verifica. */
export type Lesson = {
  id: string;
  level: 1 | 2 | 3;
  title: string;
  minutes: number;
  art: string;
  intro: string;
  points: string[];
  errors: string[];
  drill: string;
  quiz: { q: string; options: string[]; correct: number; why: string };
};

export const LEVELS = [
  { n: 1 as const, name: "Principiante", sub: "Sicurezza e basi del gesto", color: "#3d8f5f" },
  { n: 2 as const, name: "Intermedio", sub: "Ripetibilità e attrezzatura", color: "#2f7fd1" },
  { n: 3 as const, name: "Avanzato", sub: "Messa a punto, gara, testa", color: "#d6912a" },
];

export const LESSONS: Lesson[] = [
  {
    id: "sicurezza", level: 1, title: "Sicurezza in campo", minutes: 4, art: "sicurezza",
    intro: "Prima di tutto: dove si sta, quando si tira e quando si va a prendere le frecce.",
    points: ["Si incocca solo sulla linea di tiro, con la freccia verso il bersaglio.", "2 fischi: alla linea. 1 fischio: si tira. 3 fischi: a recuperare. 5 o più: stop immediato.", "Si recupera camminando, mai correndo, e ci si avvicina al paglione di lato.", "Mai trazione a vuoto senza freccia: si rompono i flettenti."],
    errors: ["Estrarre le frecce stando davanti al paglione.", "Lasciare frecce a terra sulla linea."],
    drill: "Alla prossima uscita ripeti ad alta voce il segnale che senti prima di ogni volée.",
    quiz: { q: "Cosa significano 3 fischi?", options: ["Stop di emergenza", "Andate a recuperare le frecce", "Avvicinatevi alla linea"], correct: 1, why: "Tre fischi: tiro finito, si va a recuperare." },
  },
  {
    id: "attrezzatura-base", level: 1, title: "Com'è fatto l'arco", minutes: 4, art: "parti",
    intro: "I nomi delle parti servono a capire le correzioni dell'istruttore.",
    points: ["Riser: l'impugnatura centrale, dove si attaccano i flettenti.", "Flettenti: accumulano l'energia; le libbre sono scritte lì (a 28″).", "Rest e bottone: sostengono e guidano la freccia.", "Mirino, clicker e stabilizzatore: mira, allungo costante, arco fermo."],
    errors: ["Montare i flettenti invertiti (alto e basso).", "Corda senza punto d'incocco segnato."],
    drill: "Monta e smonta l'arco una volta con l'istruttore, nominando ogni parte.",
    quiz: { q: "Dove si leggono le libbre dell'arco?", options: ["Sulla corda", "Sui flettenti", "Sul mirino"], correct: 1, why: "Sono scritte sui flettenti, misurate a 28 pollici di allungo." },
  },
  {
    id: "postura", level: 1, title: "Postura e piedi", minutes: 5, art: "postura",
    intro: "Una base ferma rende tutto il resto ripetibile.",
    points: ["Piedi alla larghezza delle spalle, a cavallo della linea.", "Peso 50/50 su entrambi i piedi, ginocchia morbide non bloccate.", "Bacino sotto il busto, niente pancia in avanti né schiena inarcata.", "Testa dritta, si gira verso il bersaglio senza inclinarla."],
    errors: ["Sbilanciarsi all'indietro durante la trazione.", "Testa che va verso la corda invece del contrario."],
    drill: "Segna i piedi con due bastoncini e tieni la postura 30 secondi senza arco, occhi chiusi.",
    quiz: { q: "Come va distribuito il peso?", options: ["Più sul piede avanti", "Più sul piede dietro", "Metà e metà"], correct: 2, why: "50/50: la base resta stabile in tutta la trazione." },
  },
  {
    id: "presa-aggancio", level: 1, title: "Presa dell'arco e aggancio", minutes: 5, art: "presa",
    intro: "La mano dell'arco spinge, non stringe. Le dita della corda agganciano, non tirano con le punte.",
    points: ["L'arco appoggia sul cuscinetto del pollice; le dita restano rilassate.", "Aggancio mediterraneo: indice sopra la cocca, medio e anulare sotto.", "La corda nella prima piega delle dita, dorso della mano piatto.", "Usa la patella o il guantino: protegge le dita e rende il rilascio pulito."],
    errors: ["Stringere l'impugnatura: la freccia va a sinistra (arciere destro).", "Corda sulle punte delle dita: rilascio che strappa."],
    drill: "10 trazioni con un elastico mantenendo la mano dell'arco aperta.",
    quiz: { q: "Nell'aggancio mediterraneo quante dita stanno sotto la cocca?", options: ["Una", "Due", "Tre"], correct: 1, why: "Indice sopra, medio e anulare sotto." },
  },
  {
    id: "ancoraggio", level: 1, title: "Allungo e ancoraggio", minutes: 5, art: "ancoraggio",
    intro: "L'ancoraggio è il punto fisso sul viso: se cambia, cambia dove va la freccia.",
    points: ["Trazione con i muscoli della schiena: la scapola va verso la colonna.", "Gomito della corda in linea con la freccia, alla stessa altezza.", "Ancoraggio sempre uguale: corda su mento e naso (olimpico) o dito all'angolo della bocca.", "Arrivati all'ancoraggio non ci si ferma: si continua a espandere."],
    errors: ["Tirare con il bicipite e il braccio.", "Ancoraggio diverso a ogni freccia."],
    drill: "Allo specchio: 5 allunghi, controlla che la corda tocchi sempre gli stessi punti.",
    quiz: { q: "Con cosa si fa la trazione?", options: ["Bicipite", "Muscoli della schiena", "Polso"], correct: 1, why: "La schiena: il braccio fa solo da gancio." },
  },
  {
    id: "mira-rilascio", level: 2, title: "Mira, rilascio e accompagnamento", minutes: 6, art: "rilascio",
    intro: "Il rilascio non si fa: succede, rilassando le dita mentre la schiena continua a lavorare.",
    points: ["Il mirino oscilla sempre: si accetta il movimento e si tiene il centro.", "Le dita si rilassano, non si aprono di scatto.", "La mano della corda scivola indietro lungo il collo.", "Il braccio dell'arco resta verso il bersaglio finché la freccia non arriva."],
    errors: ["Abbassare l'arco per guardare la freccia.", "Aspettare il centro perfetto: la mira si stanca."],
    drill: "Tira 12 frecce a 5 metri su un paglione bianco, solo per sentire il rilascio.",
    quiz: { q: "Dove va la mano della corda dopo il rilascio?", options: ["Avanti verso l'arco", "Indietro lungo il collo", "In basso"], correct: 1, why: "Continua il lavoro della schiena: scivola indietro." },
  },
  {
    id: "respiro", level: 2, title: "Respiro e ritmo", minutes: 4, art: "respiro",
    intro: "Lo stesso respiro a ogni freccia dà lo stesso tempo e la stessa tenuta.",
    points: ["Inspira alzando l'arco, espira in parte durante la trazione.", "In mira si tiene circa metà aria, senza bloccare il torace.", "Tempo totale costante: 4–7 secondi per l'olimpico.", "Se la mira dura troppo, si abbassa e si ricomincia."],
    errors: ["Trattenere il fiato a lungo: il mirino trema.", "Ritmo diverso a ogni volée."],
    drill: "Usa «Respiro» e «Tempo di allungo» per una volée intera e confronta i tempi.",
    quiz: { q: "Se la mira dura troppo cosa si fa?", options: ["Si tira comunque", "Si abbassa e si ricomincia", "Si tende di più"], correct: 1, why: "Meglio ricominciare che tirare stanchi." },
  },
  {
    id: "spine", level: 2, title: "Frecce giuste: spine e peso", minutes: 6, art: "spine",
    intro: "La freccia deve flettersi quanto serve per girare attorno al riser.",
    points: ["Lo spine dipende dalle libbre al tuo allungo, dalla lunghezza dell'asta e dal peso della punta.", "Punta più pesante = asta che si comporta più morbida.", "Restare fra 6 e 9 grani per libbra.", "Un FOC tra 8% e 15% rende la freccia stabile."],
    errors: ["Comprare frecce in base al colore.", "Asta tagliata troppo corta per l'allungo."],
    drill: "Calcola il tuo spine nello strumento «Spine e libbre» e confrontalo con le tue aste.",
    quiz: { q: "Una punta più pesante rende l'asta…", options: ["Più rigida", "Più morbida", "Uguale"], correct: 1, why: "Più massa davanti: l'asta si flette di più." },
  },
  {
    id: "assetto", level: 2, title: "Assetto: brace, tiller, incocco", minutes: 6, art: "assetto",
    intro: "Tre misure che vanno scritte e controllate ogni tanto.",
    points: ["Brace: distanza tra corda e punto più profondo dell'impugnatura.", "Tiller: differenza tra la distanza corda–flettente in alto e in basso.", "Punto d'incocco: qualche millimetro sopra il rest.", "Se una misura cambia, cambia il gruppo: segnala nell'app."],
    errors: ["Cambiare tre cose insieme: non sai più quale ha funzionato.", "Corda nuova senza ricontrollare il brace."],
    drill: "Misura brace e tiller e salvali in «Assetto arco».",
    quiz: { q: "Il brace si misura…", options: ["Dalla corda alla punta del flettente", "Dalla corda al punto più profondo dell'impugnatura", "Dal rest al bottone"], correct: 1, why: "Corda–gola dell'impugnatura." },
  },
  {
    id: "vento", level: 2, title: "Leggere il vento", minutes: 5, art: "vento",
    intro: "All'aperto il vento laterale sposta la freccia per tutto il volo.",
    points: ["Guarda bandierine, erba e alberi vicino al bersaglio, non solo alla linea.", "Si mira dalla parte da cui arriva il vento.", "Più distanza e più vento: lo spostamento cresce molto.", "Tira nelle pause, non nelle raffiche, se il tempo lo consente."],
    errors: ["Correggere il mirino a ogni raffica.", "Guardare solo la bandierina vicino a sé."],
    drill: "Nello strumento «Vento» prova 3 m/s a 30 e a 70 m e confronta.",
    quiz: { q: "Con vento da sinistra dove si mira?", options: ["Più a destra", "Più a sinistra", "Al centro"], correct: 1, why: "Controvento: verso il lato da cui arriva." },
  },
  {
    id: "bare-shaft", level: 3, title: "Messa a punto con l'asta nuda", minutes: 7, art: "tuning",
    intro: "Le frecce senza penne mostrano subito se spine e bottone sono giusti.",
    points: ["Tre frecce impennate e due nude, stessa mira, a 18 m.", "Nude a sinistra (destro): spine rigido o bottone duro.", "Nude a destra: spine morbido o bottone morbido.", "Nude sopra o sotto: punto d'incocco da correggere."],
    errors: ["Fare il test stanchi: i rilasci sporchi falsano tutto.", "Muovere bottone e incocco insieme."],
    drill: "Fai il test e segna dove finiscono in «Asta nuda».",
    quiz: { q: "Nude in alto rispetto alle impennate: cosa si fa?", options: ["Si alza il punto d'incocco", "Si abbassa il punto d'incocco", "Si cambia lo spine"], correct: 0, why: "Nude alte: il punto d'incocco è troppo basso, quindi va alzato di poco alla volta." },
  },
  {
    id: "tempi-gara", level: 3, title: "Ritmo di gara e tempi", minutes: 5, art: "tempi",
    intro: "In gara hai un tempo per volée: allenarti con lo stesso ritmo evita la fretta.",
    points: ["Indoor e targa: 2 minuti per 3 frecce, 4 per 6.", "Conta un tempo per freccia e tienilo anche in allenamento.", "Il semaforo giallo avverte: ultimi 30 secondi.", "Un ritmo regolare tiene stabili tenuta e mira."],
    errors: ["Tirare le prime frecce velocissime e l'ultima di fretta.", "Guardare ogni freccia col binocolo dopo ogni tiro."],
    drill: "Usa il «Timer» in modalità gara per un'intera sessione.",
    quiz: { q: "Quanto tempo per 3 frecce in una gara indoor?", options: ["1 minuto", "2 minuti", "4 minuti"], correct: 1, why: "Due minuti per volée da tre." },
  },
  {
    id: "routine", level: 3, title: "Routine mentale", minutes: 5, art: "mente",
    intro: "La stessa sequenza a ogni freccia toglie spazio ai pensieri.",
    points: ["Una parola chiave per ogni fase (piedi, aggancio, schiena, rilascio).", "Dopo una freccia storta: respiro, routine, niente analisi.", "Obiettivi di gesto, non di punteggio, durante la gara.", "Il punteggio si guarda a fine volée, non a ogni freccia."],
    errors: ["Fare i conti della classifica tra una volée e l'altra.", "Cambiare tecnica in gara."],
    drill: "Scrivi la tua routine in «Routine» e ripetila prima di ogni freccia per una settimana.",
    quiz: { q: "Dopo una freccia sbagliata in gara…", options: ["Cambi l'ancoraggio", "Respiri e rifai la routine", "Tiri subito la successiva"], correct: 1, why: "Respiro e routine: si resetta." },
  },
  {
    id: "distanze", level: 3, title: "Stimare le distanze (3D e campagna)", minutes: 5, art: "distanze",
    intro: "Nelle gare a distanza sconosciuta conta l'occhio: si allena come un muscolo.",
    points: ["Dividi la distanza in tratti da 5 metri che conosci bene.", "Confronta con oggetti di misura nota (paglione, persona, albero).", "In salita e in discesa la distanza da mirare è più corta di quella reale.", "Prima di guardare il bersaglio, scegli dove mirare sull'animale."],
    errors: ["Fidarsi solo della dimensione dell'animale.", "Dimenticare la pendenza."],
    drill: "Gioca a «Stima distanze» 5 minuti al giorno per una settimana.",
    quiz: { q: "Tirando in forte discesa la distanza da mirare è…", options: ["Più lunga", "Più corta", "Uguale"], correct: 1, why: "Conta la distanza orizzontale: è più corta." },
  },
  {
    id: "bilancio", level: 3, title: "Leggere le tue statistiche", minutes: 4, art: "statistiche",
    intro: "Numeri e analisi del gesto dicono cosa allenare la settimana dopo.",
    points: ["Guarda la costanza (gruppo, tempi, allungo) prima della media.", "Confronta periodi uguali: 30 giorni con i 30 precedenti.", "Se la postura cala, torna al lavoro a vuoto e allo specchio.", "Fissa un obiettivo misurabile in «Obiettivi»."],
    errors: ["Cambiare attrezzatura dopo una giornata storta.", "Allenarsi solo a distanze facili."],
    drill: "Apri «Statistiche › Corpo» e scegli una cosa da migliorare questa settimana.",
    quiz: { q: "Cosa guardare prima della media?", options: ["La costanza", "La freccia migliore", "Il meteo"], correct: 0, why: "Prima la ripetibilità, poi viene la media." },
  },
];
