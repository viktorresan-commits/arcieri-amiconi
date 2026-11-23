/**
 * Contenuti per imparare e restare coinvolti: esercizi del giorno, domande del quiz, glossario.
 * Le regole citate sono quelle generali World Archery: per le gare federali fa fede il regolamento aggiornato.
 */

export type Drill = { id: string; title: string; how: string; xp: number; kind: "tecnica" | "forza" | "mente" | "precisione" };

export const DRILLS: Drill[] = [
  { id: "giallo3", title: "Tre volée nel giallo", how: "A 18 m, tira finché metti 3 volée di fila tutte nel giallo. Conta quante ne servono.", xp: 30, kind: "precisione" },
  { id: "tenute5", title: "Cinque tenute da 10 secondi", how: "Arco o elastico in ancoraggio, 10 secondi fermo, 10 di riposo. Cinque volte, spalle basse.", xp: 25, kind: "forza" },
  { id: "occhichiusi", title: "Volée a occhi chiusi", how: "A 3 m dal paglione vuoto: 2 volée da 6 frecce a occhi chiusi. Senti solo schiena e rilascio.", xp: 25, kind: "tecnica" },
  { id: "60frecce", title: "Sessanta frecce", how: "Oggi tira almeno 60 frecce, divise in volée da 6, con la tua routine completa a ogni freccia.", xp: 35, kind: "forza" },
  { id: "ritmo", title: "Una freccia ogni 20 secondi", how: "Una volée da 6 frecce a ritmo costante: 20 secondi l'una. Usa il Timer di tiro.", xp: 25, kind: "mente" },
  { id: "followthrough", title: "Tieni la posa due secondi", how: "Dopo ogni rilascio resta fermo 2 secondi con il braccio dell'arco verso il bersaglio. 3 volée.", xp: 20, kind: "tecnica" },
  { id: "respiro", title: "Respiro prima di ogni volée", how: "Prima di ogni volée fai 3 respiri lenti (inspira 4, espira 6). Annota se il gruppo si stringe.", xp: 20, kind: "mente" },
  { id: "gruppo", title: "Gruppo più stretto", how: "Ignora il centro: a 18 m cerca il gruppo più piccolo possibile in 5 volée. Fotografale.", xp: 30, kind: "precisione" },
  { id: "lontano", title: "Una distanza nuova", how: "Tira 3 volée a una distanza che non usi mai (più lunga o più corta di 10 m).", xp: 25, kind: "precisione" },
  { id: "routine", title: "Ripassa la routine", how: "Apri «Routine di tiro» e fai la prova guidata due volte, con il gesto a vuoto.", xp: 15, kind: "mente" },
  { id: "manutenzione", title: "Controllo attrezzatura", how: "Cocche, penne, punte e corda: controlla tutto e segna in «Manutenzione» quello che sistemi.", xp: 15, kind: "tecnica" },
  { id: "video", title: "Riprendi il tuo gesto", how: "Fatti riprendere di lato per 3 frecce e guardalo in «Analisi gesto».", xp: 25, kind: "tecnica" },
  { id: "spalle", title: "Spalle in ordine", how: "Prima di tirare: 2 minuti di rotazioni delle spalle e 15 aperture con l'elastico.", xp: 15, kind: "forza" },
  { id: "punteggio", title: "Batti il tuo punteggio", how: "Fai una volée da 30 frecce e prova a superare la tua media di quest'ultimo mese.", xp: 35, kind: "precisione" },
];

/** L'esercizio di oggi: sempre lo stesso per tutto il giorno, diverso da ieri. */
export function drillOfDay(date = new Date()) {
  const key = date.toLocaleDateString("sv-SE");
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return DRILLS[h % DRILLS.length];
}

export type Question = { q: string; options: string[]; correct: number; why: string };

export const QUIZ: Question[] = [
  { q: "A che distanza tira l'arco olimpico nelle gare all'aperto World Archery?", options: ["50 m", "60 m", "70 m", "90 m"], correct: 2, why: "Il ricurvo olimpico tira a 70 m su un bersaglio da 122 cm." },
  { q: "E il compound, all'aperto?", options: ["50 m", "70 m", "30 m", "18 m"], correct: 0, why: "Il compound tira a 50 m, sul bersaglio da 80 cm a 6 zone." },
  { q: "Qual è la distanza delle gare indoor?", options: ["12 m", "18 m", "25 m", "30 m"], correct: 1, why: "Le gare in sala si tirano a 18 m (a volte anche a 25 m)." },
  { q: "Quanto misura il bersaglio olimpico a 70 m?", options: ["80 cm", "100 cm", "122 cm", "60 cm"], correct: 2, why: "122 cm, con 10 zone colorate dal bianco al giallo." },
  { q: "Una freccia tocca la riga tra il 9 e il 10. Che punto vale?", options: ["9", "10", "Si ritira", "Media 9,5"], correct: 1, why: "Se la freccia tocca la riga di divisione vale il punteggio più alto." },
  { q: "A cosa servono le X nel 10?", options: ["Valgono 11", "Per gli spareggi", "Solo per il compound", "Non contano"], correct: 1, why: "La X vale 10, ma il numero di X serve a separare i pari punteggio." },
  { q: "Quanto tempo c'è per una volée da 6 frecce all'aperto?", options: ["2 minuti", "3 minuti", "4 minuti", "6 minuti"], correct: 2, why: "4 minuti per 6 frecce; 2 minuti per volée da 3 frecce." },
  { q: "Che cos'è la brace height?", options: ["L'altezza dell'arco", "La distanza tra corda e impugnatura", "L'allungo", "La lunghezza della freccia"], correct: 1, why: "È la distanza tra la corda a riposo e il punto più profondo dell'impugnatura." },
  { q: "Che cosa indica lo spine di una freccia?", options: ["Il peso", "La rigidità", "La lunghezza", "Il diametro"], correct: 1, why: "Lo spine misura quanto l'asta si flette: numero più alto = asta più morbida." },
  { q: "Più il numero dello spine è alto, l'asta è…", options: ["Più rigida", "Più morbida", "Più pesante", "Più corta"], correct: 1, why: "Uno spine 700 è più morbido di uno spine 500." },
  { q: "A cosa serve il clicker sull'arco olimpico?", options: ["A mirare", "A segnalare l'allungo raggiunto", "A tenere la freccia", "A smorzare le vibrazioni"], correct: 1, why: "Scatta quando la punta lo supera: indica che hai raggiunto lo stesso allungo ogni volta." },
  { q: "Che cos'è l'ancoraggio?", options: ["Il punto fisso della mano sul viso", "Il paglione", "Il nodo della corda", "La posizione dei piedi"], correct: 0, why: "La mano della corda va sempre nello stesso punto del viso: è il riferimento che rende ripetibile il tiro." },
  { q: "L'arco nudo può montare un mirino?", options: ["Sì", "No", "Solo indoor", "Solo con i giovani"], correct: 1, why: "Nell'arco nudo niente mirino: si mira con la punta della freccia e con il viso." },
  { q: "Cosa vuol dire follow-through?", options: ["Ritirare la freccia", "Restare in posa dopo il rilascio", "Tirare in fretta", "Camminare al bersaglio"], correct: 1, why: "Dopo il rilascio il gesto continua: braccia e testa restano in posa per un attimo." },
  { q: "Quanti grammi è un grano?", options: ["0,065 g", "1 g", "0,5 g", "6,5 g"], correct: 0, why: "1 grano ≈ 0,0648 g: una punta da 100 grani pesa circa 6,5 g." },
  { q: "Un FOC più alto rende la freccia…", options: ["Più instabile", "Più stabile in volo", "Più veloce", "Più leggera"], correct: 1, why: "Più peso davanti stabilizza la freccia, che però cala un po' di più sulle lunghe distanze." },
  { q: "Il punto d'incocco serve a…", options: ["Mettere la cocca sempre nello stesso punto", "Tendere la corda", "Fermare il clicker", "Mirare"], correct: 0, why: "È il riferimento sulla corda dove si incocca la freccia, sempre alla stessa altezza." },
  { q: "Nel 3D FITARCO a 4 zone, quanto vale il centro più piccolo?", options: ["10", "11", "12", "8"], correct: 1, why: "Le zone valgono 11, 10, 8 e 5: l'11 è il cerchio più piccolo." },
  { q: "Se un arciere destro vede le aste nude a sinistra del gruppo, la freccia è…", options: ["Morbida", "Rigida", "Giusta", "Troppo corta"], correct: 1, why: "Per un destro che tira con le dita, nude a sinistra = asta rigida." },
  { q: "Cosa fa l'arciere quando sente un fischio solo, dopo i due dell'avvicinamento?", options: ["Si ferma", "Inizia a tirare", "Va a ritirare", "Cambia turno"], correct: 1, why: "Due fischi: in linea. Un fischio: si tira. Tre fischi: si va al bersaglio." },
];

export function quizOfDay(date = new Date()) {
  const key = date.toLocaleDateString("sv-SE");
  let h = 7;
  for (const c of key) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return QUIZ[h % QUIZ.length];
}

export type GlossCat = "arco" | "freccia" | "tiro" | "gara" | "campagna";
export const GLOSS_CATS: { id: GlossCat; label: string }[] = [
  { id: "arco", label: "Arco" },
  { id: "freccia", label: "Freccia" },
  { id: "tiro", label: "Tecnica" },
  { id: "gara", label: "Gara" },
  { id: "campagna", label: "3D e campagna" },
];

/** Voce del glossario: parola, spiegazione, categoria e (se c'è) la lezione che la spiega meglio. */
export type Gloss = { t: string; d: string; c: GlossCat; lesson?: string };

export const GLOSSARY: Gloss[] = [
  // arco
  { t: "Arco olimpico", d: "Arco ricurvo con mirino, stabilizzatori e clicker: è l'arco delle Olimpiadi, tira a 70 m.", c: "arco", lesson: "attrezzatura-base" },
  { t: "Arco nudo", d: "Ricurvo senza mirino né stabilizzatori lunghi: si mira con la punta della freccia (barebow).", c: "arco", lesson: "string-walking" },
  { t: "Longbow", d: "Arco tradizionale dritto in legno, senza finestra d'appoggio scavata: si tira d'istinto.", c: "arco", lesson: "istintivo" },
  { t: "Arco storico", d: "Arco costruito come quelli antichi (medievali, asiatici, nativi americani), senza materiali moderni.", c: "arco", lesson: "istintivo" },
  { t: "Compound", d: "Arco con carrucole (camme) che riducono lo sforzo a piena apertura; si tira con lo sgancio.", c: "arco", lesson: "compound" },
  { t: "Riser", d: "Il corpo centrale dell'arco, con l'impugnatura e gli attacchi dei flettenti.", c: "arco", lesson: "attrezzatura-base" },
  { t: "Flettenti", d: "Le due lame dell'arco che si piegano e immagazzinano energia; sopra c'è scritto il libbraggio.", c: "arco", lesson: "attrezzatura-base" },
  { t: "Impugnatura", d: "La parte del riser dove si appoggia la mano dell'arco, senza stringere.", c: "arco", lesson: "presa-aggancio" },
  { t: "Finestra", d: "L'incavo del riser sopra l'impugnatura dove passa la freccia.", c: "arco" },
  { t: "Libbraggio", d: "La forza dell'arco in libbre, misurata di solito a 28″ di allungo: circa 2 libbre per ogni pollice in più o in meno.", c: "arco", lesson: "attrezzatura-base" },
  { t: "Corda", d: "Unisce le punte dei flettenti; si fa di fibre moderne e si tiene incerata.", c: "arco", lesson: "manutenzione" },
  { t: "Serving", d: "La fasciatura al centro della corda che la protegge dove la toccano dita e cocca.", c: "arco" },
  { t: "Punto d'incocco", d: "Il segno sulla corda dove si mette la cocca, sempre alla stessa altezza.", c: "arco", lesson: "incocco" },
  { t: "Brace height", d: "Distanza tra corda e punto più profondo dell'impugnatura con l'arco montato.", c: "arco", lesson: "assetto" },
  { t: "Tiller", d: "Differenza tra la distanza corda–flettente in alto e in basso: regola l'equilibrio dei flettenti.", c: "arco", lesson: "assetto" },
  { t: "Rest", d: "Il supporto su cui poggia la freccia nell'arco.", c: "arco", lesson: "attrezzatura-base" },
  { t: "Bottone", d: "Pistoncino a molla sul lato dell'arco dove appoggia la freccia: ne corregge la spinta laterale.", c: "arco", lesson: "bare-shaft" },
  { t: "Mirino", d: "Accessorio per mirare, regolabile in altezza e di lato; la diottra si sposta verso il gruppo.", c: "arco", lesson: "mirino-tacche" },
  { t: "Diottra", d: "La parte del mirino che si allinea al bersaglio (con o senza lente).", c: "arco", lesson: "mirino-tacche" },
  { t: "Clicker", d: "Lamina che scatta quando la punta della freccia arriva al tuo allungo.", c: "arco", lesson: "clicker" },
  { t: "Stabilizzatori", d: "Aste con pesi che rendono l'arco più fermo durante la mira e il rilascio.", c: "arco", lesson: "attrezzatura-base" },
  { t: "V-bar", d: "Il raccordo che regge i due stabilizzatori laterali corti.", c: "arco" },
  { t: "Dragonne", d: "Laccio al polso o alle dita che trattiene l'arco dopo il rilascio, così la mano resta aperta.", c: "arco", lesson: "presa-aggancio" },
  { t: "Tendicorda", d: "Cordino per montare e smontare l'arco ricurvo senza piegare i flettenti di lato.", c: "arco", lesson: "manutenzione" },
  { t: "Camme", d: "Le carrucole del compound: danno il calo di forza (let-off) a piena apertura.", c: "arco", lesson: "compound" },
  { t: "Let-off", d: "Nel compound, quanto cala la forza a piena apertura (per esempio 65–80%).", c: "arco", lesson: "compound" },
  { t: "Peep", d: "Nel compound, il forellino nella corda attraverso cui si guarda il mirino.", c: "arco", lesson: "compound" },
  { t: "Sgancio", d: "Attrezzo meccanico per tirare la corda del compound.", c: "arco", lesson: "compound" },
  { t: "Patella", d: "Protezione di cuoio per le dita che tirano la corda; nell'arco nudo ha i segni per lo string walking.", c: "arco", lesson: "presa-aggancio" },
  { t: "Parabraccio", d: "Protezione dell'avambraccio dell'arco dalla corda.", c: "arco", lesson: "postura" },
  { t: "Pettorina", d: "Protezione del petto che tiene i vestiti lontani dalla corda.", c: "arco" },
  // freccia
  { t: "Asta", d: "Il corpo della freccia: carbonio, alluminio, carbonio-alluminio o legno.", c: "freccia", lesson: "spine" },
  { t: "Spine", d: "Rigidità della freccia: numero più alto = asta più morbida. Dipende da libbre, allungo e punta.", c: "freccia", lesson: "spine" },
  { t: "Cocca", d: "Pezzo in fondo alla freccia che si aggancia alla corda.", c: "freccia", lesson: "incocco" },
  { t: "Impennaggio", d: "Penne o alette che stabilizzano la freccia in volo.", c: "freccia", lesson: "manutenzione" },
  { t: "Penna guida", d: "La penna di colore diverso, rivolta verso l'esterno dell'arco quando si incocca.", c: "freccia", lesson: "incocco" },
  { t: "Inserto", d: "Pezzo nella punta dell'asta dove si avvita la punta.", c: "freccia" },
  { t: "Punta", d: "Si misura in grani: più pesante = freccia più stabile ma più morbida all'uscita.", c: "freccia", lesson: "peso-freccia" },
  { t: "Grano", d: "Unità di peso delle frecce: 1 grano ≈ 0,065 g.", c: "freccia", lesson: "peso-freccia" },
  { t: "GPP", d: "Grani per libbra: peso della freccia diviso le libbre dell'arco. Troppo pochi stressano l'arco.", c: "freccia", lesson: "peso-freccia" },
  { t: "FOC", d: "Front of center: quanto il punto di equilibrio della freccia sta davanti alla metà, in percentuale.", c: "freccia", lesson: "peso-freccia" },
  { t: "Asta nuda", d: "Freccia senza penne, usata per controllare l'accordo tra arco e freccia.", c: "freccia", lesson: "bare-shaft" },
  { t: "Paradosso dell'arciere", d: "La freccia si flette e serpeggia girando intorno all'arco: per questo lo spine conta.", c: "freccia", lesson: "spine" },
  // tecnica
  { t: "Postura", d: "La posizione dei piedi e del corpo sulla linea di tiro, sempre uguale.", c: "tiro", lesson: "postura" },
  { t: "Aggancio", d: "Come le dita prendono la corda: mediterraneo (un dito sopra la cocca e due sotto) o tre sotto.", c: "tiro", lesson: "presa-aggancio" },
  { t: "Set-up", d: "La fase in cui si alza l'arco e si preparano spalle e braccia prima dell'allungo.", c: "tiro", lesson: "sequenza" },
  { t: "Allungo", d: "Distanza a cui apri l'arco, dalla gola della cocca al punto di appoggio nell'impugnatura più 4,4 cm (1¾″).", c: "tiro", lesson: "ancoraggio" },
  { t: "Ancoraggio", d: "Punto fisso del viso dove torna la mano della corda a ogni tiro.", c: "tiro", lesson: "ancoraggio" },
  { t: "Trasferimento", d: "Il passaggio del lavoro dalle braccia ai muscoli della schiena, dopo l'ancoraggio.", c: "tiro", lesson: "clicker" },
  { t: "Espansione", d: "Il piccolo movimento continuo della schiena che porta la freccia oltre il clicker.", c: "tiro", lesson: "clicker" },
  { t: "Mira", d: "Allineare diottra (o punta) e bersaglio mentre la schiena continua a lavorare.", c: "tiro", lesson: "mira-rilascio" },
  { t: "Rilascio", d: "Il momento in cui le dita (o lo sgancio) lasciano la corda, rilassandosi.", c: "tiro", lesson: "mira-rilascio" },
  { t: "Follow-through", d: "Il gesto che continua dopo il rilascio: braccia e testa restano in posa.", c: "tiro", lesson: "mira-rilascio" },
  { t: "Sequenza di tiro", d: "Le fasi del tiro sempre nello stesso ordine e con gli stessi tempi.", c: "tiro", lesson: "sequenza" },
  { t: "Routine", d: "Quello che fai prima e durante la volée, anche con la testa, sempre uguale.", c: "tiro", lesson: "routine" },
  { t: "Gruppo", d: "L'insieme delle frecce di una volée sul bersaglio: stretto vuol dire gesto ripetibile.", c: "tiro", lesson: "gruppi" },
  { t: "Tacca", d: "La posizione del mirino segnata per una distanza.", c: "tiro", lesson: "mirino-tacche" },
  { t: "Point on", d: "Nell'arco nudo, la distanza a cui la punta della freccia sta proprio sul centro.", c: "tiro", lesson: "string-walking" },
  { t: "String walking", d: "Nell'arco nudo, spostare le dita più giù sulla corda per tirare più vicino.", c: "tiro", lesson: "string-walking" },
  { t: "Face walking", d: "Cambiare punto di ancoraggio sul viso per cambiare distanza (arco nudo e tradizionale).", c: "tiro", lesson: "string-walking" },
  { t: "Tiro istintivo", d: "Si tira senza riferimenti di mira, guardando solo il punto da colpire.", c: "tiro", lesson: "istintivo" },
  { t: "Gap", d: "Lo spazio tra la punta della freccia e il punto da colpire, usato come riferimento per mirare.", c: "tiro", lesson: "istintivo" },
  { t: "Target panic", d: "Quando non si riesce a tenere la mira sul centro e si rilascia di scatto: si cura con il lavoro sul gesto.", c: "tiro", lesson: "pressione" },
  // gara
  { t: "Volée", d: "Il gruppo di frecce tirate prima di andare a segnare i punti (3 o 6).", c: "gara", lesson: "punteggio" },
  { t: "X", d: "Il cerchio più interno del 10: vale 10 e serve per gli spareggi.", c: "gara", lesson: "punteggio" },
  { t: "Linea di tiro", d: "La riga da cui si tira; si incocca solo lì.", c: "gara", lesson: "sicurezza" },
  { t: "Linea d'attesa", d: "La riga dietro la linea di tiro dove si aspetta il proprio turno.", c: "gara", lesson: "sicurezza" },
  { t: "Paglione", d: "Il supporto su cui si appende il bersaglio.", c: "gara", lesson: "sicurezza" },
  { t: "Visuale", d: "Il foglio con le zone colorate (il bersaglio vero e proprio).", c: "gara", lesson: "bersagli-distanze" },
  { t: "Trispot", d: "Bersaglio da sala con tre piccoli bersagli verticali, uno per freccia.", c: "gara", lesson: "bersagli-distanze" },
  { t: "Direttore di tiro", d: "Chi dà i segnali con fischi e semaforo e controlla la sicurezza.", c: "gara", lesson: "sicurezza" },
  { t: "Fischi", d: "2: alla linea. 1: si tira. 3: a recuperare. 5 o più: stop immediato.", c: "gara", lesson: "sicurezza" },
  { t: "Scontro", d: "Sfida diretta a eliminazione tra due arcieri.", c: "gara", lesson: "scontri" },
  { t: "Set", d: "Negli scontri olimpici: set vinto 2 punti, pari 1, perso 0; vince chi arriva a 6.", c: "gara", lesson: "scontri" },
  { t: "Spareggio", d: "Una freccia a testa: vince il punteggio più alto, e a pari punti la freccia più vicina al centro.", c: "gara", lesson: "scontri" },
  { t: "Qualifica", d: "La prima parte della gara: serie di frecce che decide la classifica per gli scontri.", c: "gara", lesson: "tempi-gara" },
  { t: "Divisione", d: "La categoria di arco: olimpico, compound, arco nudo, longbow, storico…", c: "gara" },
  { t: "Classe", d: "La categoria per età e sesso (giovanissimi, ragazzi, allievi, juniores, seniores, master).", c: "gara" },
  { t: "Indoor", d: "Gare in sala, di solito a 18 m.", c: "gara", lesson: "bersagli-distanze" },
  { t: "Tabellone", d: "Lo schema degli scontri a eliminazione.", c: "gara", lesson: "scontri" },
  { t: "Segnapunti", d: "Chi scrive i punti sullo statino: si chiama ogni freccia dal valore più alto al più basso.", c: "gara", lesson: "punteggio" },
  // campagna e 3D
  { t: "Piazzola", d: "Ogni postazione di tiro di un percorso di campagna o 3D.", c: "campagna", lesson: "terreni" },
  { t: "Picchetto", d: "Il paletto colorato da cui si tira in una piazzola; il colore dipende dalla divisione.", c: "campagna", lesson: "terreni" },
  { t: "Sagoma", d: "Bersaglio a forma di animale. Conteggio 3D FITARCO: 11-10-8-5; conteggio semplice: 8 vitale, 5 corpo, 0 fuori.", c: "campagna", lesson: "sagome" },
  { t: "Zona vitale", d: "Sulla sagoma, la zona del cuore e dei polmoni: è quella che vale di più.", c: "campagna", lesson: "sagome" },
  { t: "Field", d: "Tiro di campagna su bersagli gialli e neri a sei zone, a distanze note o sconosciute.", c: "campagna", lesson: "field" },
  { t: "Hunter", d: "Percorso di campagna con distanze non dichiarate da stimare.", c: "campagna", lesson: "distanze" },
  { t: "Distanza sconosciuta", d: "Piazzola in cui la distanza va stimata a occhio.", c: "campagna", lesson: "distanze" },
  { t: "Pendenza", d: "In salita o in discesa conta la distanza in orizzontale, più corta di quella reale.", c: "campagna", lesson: "terreni" },
  { t: "Telemetro", d: "Strumento che misura la distanza: in gara 3D non si usa, ma è utile per allenare la stima.", c: "campagna", lesson: "distanze" },
];
