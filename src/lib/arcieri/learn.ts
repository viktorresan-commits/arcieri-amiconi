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

export const GLOSSARY: [string, string][] = [
  ["Allungo", "Distanza a cui apri l'arco, dalla gola della cocca al punto di appoggio nell'impugnatura più 4,4 cm (1¾″)."],
  ["Ancoraggio", "Punto fisso del viso dove torna la mano della corda a ogni tiro."],
  ["Asta nuda", "Freccia senza penne, usata per controllare l'accordo tra arco e freccia."],
  ["Bottone", "Pistoncino a molla sul lato dell'arco dove appoggia la freccia: ne corregge la spinta laterale."],
  ["Brace height", "Distanza tra corda e impugnatura con l'arco montato."],
  ["Clicker", "Lamina che scatta quando la freccia arriva al tuo allungo."],
  ["Cocca", "Pezzo in fondo alla freccia che si aggancia alla corda."],
  ["Compound", "Arco con carrucole (camme) che riducono lo sforzo a piena apertura."],
  ["Corda", "Unisce le punte dei flettenti; sul centro ha il serving, una fasciatura che la protegge."],
  ["Diottra", "La parte del mirino che si allinea al bersaglio."],
  ["Flettenti", "Le due lame dell'arco che si piegano e immagazzinano energia."],
  ["FOC", "Front of center: quanto il punto di equilibrio della freccia sta davanti alla metà, in percentuale."],
  ["Follow-through", "Il gesto che continua dopo il rilascio: braccia e testa restano in posa."],
  ["Grano", "Unità di peso delle frecce: 1 grano ≈ 0,065 g."],
  ["Impennaggio", "Penne o alette che stabilizzano la freccia in volo."],
  ["Inserto", "Pezzo nella punta dell'asta dove si avvita la punta."],
  ["Libbraggio", "La forza dell'arco in libbre, misurata di solito a 28″ di allungo."],
  ["Mirino", "Accessorio per mirare, regolabile in altezza e di lato."],
  ["Paglione", "Il supporto su cui si appende il bersaglio."],
  ["Patella", "Protezione di cuoio per le dita che tirano la corda."],
  ["Punto d'incocco", "Il segno sulla corda dove si mette la cocca, sempre alla stessa altezza."],
  ["Rest", "Il supporto su cui poggia la freccia nell'arco."],
  ["Rilascio", "Il momento in cui le dita (o lo sgancio) lasciano la corda."],
  ["Riser", "Il corpo centrale dell'arco, con l'impugnatura."],
  ["Sgancio", "Attrezzo meccanico per tirare la corda del compound."],
  ["Spine", "Rigidità della freccia: numero più alto = asta più morbida."],
  ["Stabilizzatori", "Aste con pesi che rendono l'arco più fermo durante la mira e il rilascio."],
  ["Tiller", "Differenza tra la distanza corda–flettente in alto e in basso: regola l'equilibrio dei flettenti."],
  ["Trasferimento", "Il passaggio del lavoro dalle braccia ai muscoli della schiena, dopo l'ancoraggio."],
  ["Volée", "Il gruppo di frecce tirate prima di andare a segnare i punti (3 o 6)."],
  ["X", "Il cerchio più interno del 10: vale 10 e serve per gli spareggi."],
];
