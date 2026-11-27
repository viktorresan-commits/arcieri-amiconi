/**
 * Domande del quiz. Il grosso riguarda l'arcieria storica e tradizionale delle gare FITAST
 * (regolamento sportivo delle gare in costume e del campionato invernale 3D), poi tecnica del tiro
 * istintivo, storia dell'arco, attrezzatura tradizionale e sicurezza; poche domande sulle altre federazioni.
 */
export type QuizTopic = "fitast" | "tecnica" | "storia" | "attrezzatura" | "sicurezza" | "altre";
export type Question = { id: string; topic: QuizTopic; q: string; options: string[]; correct: number; why: string };

export const QUIZ_TOPICS: { id: QuizTopic | "misto"; label: string }[] = [
  { id: "misto", label: "Misto" },
  { id: "fitast", label: "Regole FITAST" },
  { id: "tecnica", label: "Tecnica" },
  { id: "storia", label: "Storia" },
  { id: "attrezzatura", label: "Attrezzatura" },
  { id: "sicurezza", label: "Sicurezza" },
  { id: "altre", label: "Altre federazioni" },
];

type Raw = Omit<Question, "id" | "topic">;

const FITAST: Raw[] = [
  { q: "Quali sono le tre divisioni d'arco degli adulti nelle gare FITAST?", options: ["Olimpico, Nudo, Compound", "Storico, Tradizionale, Foggia storica", "Longbow, Istintivo, Nudo", "Storico, Ricurvo, Compound"], correct: 1, why: "Messere e Madonna gareggiano divisi in Arco Storico, Arco Tradizionale e Arco a Foggia Storica." },
  { q: "Che cos'è un arco storico per la FITAST?", options: ["Un arco ricavato da un unico pezzo di legno", "Un arco lamellare rivestito di fibra", "Qualsiasi arco che sembri antico", "Un arco di legno e corno incollati"], correct: 0, why: "L'arco storico è monoxilo: un solo legno e la corda." },
  { q: "L'arco a foggia storica è…", options: ["Un arco antico originale", "Un arco con la forma di un arco medievale europeo o orientale, fatto con materiali moderni laminati", "Un arco smontabile in tre pezzi", "Un ricurvo con il mirino"], correct: 1, why: "La foggia è quella storica, i materiali possono essere moderni, a vista o nascosti sotto legno o pelle." },
  { q: "Quale arco FITAST deve avere la finestra, cioè l'incavo per la freccia?", options: ["Lo storico", "La foggia storica", "Il tradizionale", "Nessuno dei tre"], correct: 2, why: "Il tradizionale (longbow o ricurvo laminato) ha la finestra ma niente rest; storico e foggia storica la finestra non l'hanno." },
  { q: "Quanto può essere spessa al massimo la zeppa (l'appoggio della freccia) su storico e foggia storica?", options: ["2 millimetri", "Mezzo centimetro, rivestimento compreso", "Un centimetro", "Non è ammessa"], correct: 1, why: "La zeppa è facoltativa e non può superare mezzo centimetro, compreso il rivestimento dell'impugnatura." },
  { q: "Il rest, l'appoggio meccanico della freccia, è ammesso nelle gare FITAST?", options: ["Sì, su tutti gli archi", "Solo sul tradizionale", "No, è vietato", "Solo nelle gare 3D"], correct: 2, why: "Il rest è tra gli accessori vietati: sul tradizionale la freccia passa nella finestra, sugli altri sulla mano o sulla zeppa." },
  { q: "Di che materiale devono essere le aste delle frecce nelle gare FITAST?", options: ["Legno", "Carbonio", "Alluminio", "Qualsiasi, purché dipinte"], correct: 0, why: "Solo aste di legno, segnate con il nome dell'arciere o il numero di tessera." },
  { q: "Come si riconoscono le proprie frecce in gara FITAST?", options: ["Dal colore della punta", "Dal nome dell'arciere o dal numero di tessera scritto sull'asta", "Dalla lunghezza", "Non serve riconoscerle"], correct: 1, why: "Ogni asta va segnata con il nome, il numero di tessera FITAST o tutti e due; le decorazioni araldiche sono ammesse." },
  { q: "Di che materiale possono essere le cocche?", options: ["Plastica", "Alluminio", "Legno, corno o osso", "Qualsiasi"], correct: 2, why: "Cocche ricavate nell'asta o inserite, ma in legno, corno o osso: la plastica è vietata." },
  { q: "Cosa è vietato sulle penne delle frecce FITAST?", options: ["Le piume naturali", "I colori fluorescenti", "Le penne barrate", "Le penne a tinta unita"], correct: 1, why: "Si usano piume naturali, a tinta unita, barrate o a righe, ma mai in colori fluorescenti." },
  { q: "Che punte si possono usare con l'arco storico e la foggia storica?", options: ["Punte da caccia a lama", "Punte storiche in ferro, come l'italica, il quadrello o l'ogivale", "Punte moderne da bersaglio", "Nessuna punta"], correct: 1, why: "Storico e foggia storica vogliono punte storiche in ferro; il tradizionale può usare qualsiasi punta adatta all'asta. Le lame da caccia sono vietate a tutti." },
  { q: "Dove sta la freccia sulla corda nelle gare FITAST?", options: ["Sotto tre dita", "Tra il dito indice e il dito medio", "Agganciata con il pollice", "Dove vuole l'arciere"], correct: 1, why: "La presa è con la freccia tra indice e medio; l'anello da pollice è ammesso solo per alcuni archi orientali a foggia storica." },
  { q: "A chi è concesso l'anello da pollice nelle gare FITAST?", options: ["A tutti", "A nessuno", "Ad alcuni archi orientali a foggia storica, come il turco, l'ungherese o il mongolo", "Solo ai Pueri"], correct: 2, why: "La presa con il pollice è tipica degli archi orientali: è ammessa solo con quelle fogge." },
  { q: "Durante una gara FITAST cosa non si può mai cambiare?", options: ["La posizione del corpo", "Il punto di ancoraggio", "La presa sulla corda", "La faretra"], correct: 2, why: "Postura e ancoraggio possono variare durante la gara, la presa sulla corda no." },
  { q: "Perché sono vietate tacche, scritte e pezzi di cuoio sul flettente superiore?", options: ["Per motivi estetici", "Perché potrebbero servire da riferimento di mira", "Perché indeboliscono l'arco", "Non sono vietati"], correct: 1, why: "Il tiro è istintivo: niente segni sul flettente o sopra la finestra che aiutino a mirare." },
  { q: "Quale di questi archi non è ammesso nelle gare FITAST?", options: ["Un arco monoxilo di tasso", "Un longbow laminato in un pezzo", "Un arco smontabile in tre pezzi", "Un ricurvo laminato in un pezzo"], correct: 2, why: "Gli archi smontabili (take-down), quelli di metallo e quelli da scuola sono vietati." },
  { q: "I silenziatori sulla corda sono ammessi?", options: ["Sì", "No", "Solo sul tradizionale", "Solo se di lana"], correct: 1, why: "I silenziatori sono nell'elenco degli accessori vietati." },
  { q: "Quanti punti d'incocco può avere la corda?", options: ["Uno solo, fatto anche con due riferimenti", "Due, per frecce diverse", "Nessuno", "Quanti se ne vuole"], correct: 0, why: "Un solo punto d'incocco, ottenuto con uno o due riferimenti; la corda può essere in fibra naturale o sintetica." },
  { q: "Fino a quando si deve tenere il costume in una gara FITAST?", options: ["Solo mentre si tira", "Fino all'ultima piazzola", "Dall'inizio del torneo fino a dopo la premiazione", "Basta il cappello"], correct: 2, why: "Chi si toglie il costume prima della fine della premiazione non può essere premiato." },
  { q: "Quale di questi oggetti non si può indossare in gara?", options: ["Occhiali da vista", "Orologio da polso", "Parabraccio di cuoio", "Faretra di cuoio"], correct: 1, why: "Orologi, braccialetti moderni e occhiali da sole stonano con il costume; gli occhiali da vista sono ammessi." },
  { q: "Come si chiama la categoria degli uomini adulti?", options: ["Cavaliere", "Messere", "Signore", "Scudiero"], correct: 1, why: "Messere per gli uomini e Madonna per le donne, dai 18 anni in su." },
  { q: "Come si chiama la categoria delle donne adulte?", options: ["Dama", "Castellana", "Madonna", "Domina"], correct: 2, why: "Madonna, dai 18 anni in su, divisa nei tre tipi di arco." },
  { q: "Che età hanno gli arcieri Juvenis?", options: ["Da 8 a 13 anni", "Da 14 a 17 anni", "Da 18 a 21 anni", "Oltre i 60"], correct: 1, why: "Juvenis da 14 a 17 anni; Pueri da 8 a 13." },
  { q: "I Pueri sono divisi per tipo di arco?", options: ["Sì, come gli adulti", "No, sono una categoria unica, senza tipologia d'arco", "Solo tra storico e tradizionale", "Solo nelle gare 3D"], correct: 1, why: "I Pueri (8-13 anni) gareggiano in una categoria unica, senza divisione per tipo di arco." },
  { q: "Quante frecce si tirano a ogni piazzola?", options: ["Una", "Due", "Tre", "Sei"], correct: 2, why: "Tre frecce a piazzola; i punti si sommano." },
  { q: "Quante piazzole ha un percorso standard?", options: ["10", "20", "24", "30"], correct: 1, why: "Venti piazzole, di cui una a tempo; con pochi iscritti si può girare due volte un percorso da dieci." },
  { q: "Quanti arcieri tirano insieme sulla stessa piazzola?", options: ["Uno", "Due", "Quattro", "Tutta la pattuglia"], correct: 1, why: "Si tira in due alla volta, salvo casi particolari decisi dal giudice." },
  { q: "Su una sagoma 3D quanto vale lo spot?", options: ["5", "8", "10", "11"], correct: 1, why: "Spot 8 punti, il resto della sagoma 5." },
  { q: "Sul bersaglio normale di carta, come si contano i punti?", options: ["Spot 8, zona interna 5, zona esterna 2", "10, 9, 8 fino a 1", "Spot 11, poi 10, 8 e 5", "Spot 15, poi 10 e 5"], correct: 0, why: "Tre zone: spot 8, zona interna 5, zona esterna 2." },
  { q: "Lo spot si assegna guardando…", options: ["Dove si ferma la cocca", "Il punto d'ingresso della freccia", "La parte più grande dell'asta", "Il giudizio del compagno"], correct: 1, why: "Conta il punto in cui la freccia entra nel bersaglio." },
  { q: "A 20 metri quanto è lungo il perimetro del filo che segna lo spot?", options: ["20 cm", "40 cm", "80 cm", "1 metro"], correct: 2, why: "Il perimetro in centimetri è la distanza in metri per 4: a 20 m sono 80 cm, con un margine del 10%." },
  { q: "Qual è la distanza massima di tiro per gli adulti?", options: ["25 m", "35 m", "50 m", "70 m"], correct: 1, why: "Dagli 8 ai 35 metri, con distanze che cambiano lungo il percorso." },
  { q: "Fino a che distanza tirano i Pueri?", options: ["8 m", "12 m", "18 m", "25 m"], correct: 1, why: "Dagli 8 ai 12 metri: se il picchetto è più lontano si mette una seconda linea per loro." },
  { q: "Al bersaglio a tempo quanto tempo c'è per le tre frecce?", options: ["10 secondi", "20 secondi", "40 secondi", "Un minuto"], correct: 1, why: "Tre frecce, la prima già incoccata, in 20 secondi: chi sfora perde la freccia di punteggio più alto." },
  { q: "Al bersaglio speciale quanto vale un centro con la prima freccia?", options: ["8", "10", "15", "24"], correct: 2, why: "15 alla prima freccia, 10 alla seconda, 5 alla terza: conta solo la prima a segno." },
  { q: "Al bersaglio multiplo, cosa succede se si mettono due frecce sullo stesso bersaglio?", options: ["Valgono doppio", "Si annullano", "Vale solo la migliore", "Si ritira la gara"], correct: 1, why: "Una freccia per ogni bersaglio: due frecce dello stesso arciere sullo stesso bersaglio si annullano." },
  { q: "Una freccia viene buttata fuori dal bersaglio da un'altra freccia. Quanto vale?", options: ["Zero", "Il punteggio più basso di quel bersaglio", "Il punteggio che aveva", "Si ritira"], correct: 1, why: "Le frecce valgono se restano piantate; quelle cadute o espulse prendono il punteggio più basso." },
  { q: "Una freccia rimbalza sul bersaglio. Cosa si fa?", options: ["La si raccoglie e si ritira", "La si sostituisce con una freccia presa dalla faretra", "Vale zero e basta", "Vale 5"], correct: 1, why: "La freccia rimbalzata si sostituisce solo con una della faretra: non si raccoglie quella caduta." },
  { q: "Una freccia si pianta nella cocca di un'altra. Quanto vale?", options: ["Zero", "Il doppio", "Come la freccia che ha colpito", "Il punteggio più basso"], correct: 2, why: "Prende lo stesso punteggio della freccia colpita." },
  { q: "In caso di parità in una gara FITAST chi vince?", options: ["Il più giovane", "Chi ha fatto più spot", "Chi ha tirato per primo", "Si divide il premio"], correct: 1, why: "Vince chi ha più spot; se sono ancora pari, una freccia a testa sul paglione: vince la più vicina a quella del giudice." },
  { q: "Come si deve incoccare la freccia sulla piazzola?", options: ["Con l'arco puntato verso il basso", "Con l'arco già teso verso il bersaglio", "Con l'arco alzato sopra la testa", "In qualsiasi modo"], correct: 0, why: "Si incocca con l'arco verso il basso; tendere l'arco di lato o sopra il bersaglio annulla il tiro." },
  { q: "Sulla linea di tiro dove devono stare i piedi?", options: ["Tutti e due dietro la linea, lontani", "Almeno un piede sulla linea, senza superarla", "Un piede oltre la linea", "Dove si vuole"], correct: 1, why: "Almeno un piede sulla linea, senza oltrepassarla." },
  { q: "Quando si può lasciare la linea di tiro?", options: ["Subito dopo la propria ultima freccia", "Quando tutti e due gli arcieri hanno tirato tutte le frecce", "Quando lo dice il pubblico", "Dopo la prima freccia"], correct: 1, why: "Si esce dalla linea solo quando entrambi hanno finito." },
  { q: "Com'è fatta una squadra FITAST?", options: ["Da tre arcieri della stessa compagnia e della stessa divisione", "Da cinque arcieri qualsiasi", "Da un uomo e una donna", "Da tutta la compagnia"], correct: 0, why: "In classifica vanno i tre migliori della stessa compagnia nella stessa divisione." },
  { q: "Dove si svolgono di solito le gare FITAST?", options: ["In palazzetto, a 18 metri", "Nei borghi storici, nei castelli e nei parchi, in costume", "Solo sui campi da calcio", "Solo in montagna"], correct: 1, why: "Le gare si tirano in costume storico nei centri storici, nei castelli o nei parchi, con percorsi da girare a piedi." },
  { q: "I bersagli in movimento sono ammessi?", options: ["No, mai", "Sì, tranne al bersaglio a tempo", "Solo per i Pueri", "Solo di carta"], correct: 1, why: "Le sagome mobili sono ammesse purché tutti possano tirare, ma non alla piazzola a tempo." },
];

const TECNICA: Raw[] = [
  { q: "Che cos'è il tiro istintivo?", options: ["Tirare senza riferimenti di mira, guardando solo il bersaglio", "Tirare con il mirino", "Tirare a occhi chiusi", "Tirare senza ancoraggio"], correct: 0, why: "Lo sguardo resta sul punto da colpire e il corpo impara la direzione, senza mirare con la punta o con segni." },
  { q: "Nel tiro a gap cosa si usa come riferimento?", options: ["Il mirino", "Lo spazio tra la punta della freccia e il bersaglio", "La corda", "Il flettente superiore"], correct: 1, why: "Si stima la distanza tra punta e bersaglio, che cambia con la distanza di tiro." },
  { q: "Nella presa mediterranea dove stanno le dita?", options: ["Tre dita sotto la cocca", "Indice sopra la cocca, medio e anulare sotto", "Solo il pollice", "Indice e medio sotto"], correct: 1, why: "Un dito sopra e due sotto: è la presa richiesta nelle gare FITAST." },
  { q: "Perché molti arcieri di arco nudo tengono tre dita sotto la cocca?", options: ["Perché tira più forte", "Perché la freccia sale vicino all'occhio e si mira meglio con la punta", "Perché è obbligatorio", "Per non farsi male"], correct: 1, why: "Con tre dita sotto la freccia è più vicina all'occhio: utile per mirare con la punta, ma non è la presa delle gare FITAST." },
  { q: "Che cos'è il paradosso dell'arciere?", options: ["La freccia si flette e aggira l'impugnatura mentre parte", "La freccia va dove non si mira", "L'arco si allunga", "La corda si accorcia"], correct: 0, why: "Lasciando la corda la freccia si piega e si raddrizza, passando intorno all'arco: per questo lo spine conta." },
  { q: "Come si trova l'occhio dominante?", options: ["Guardando un oggetto lontano attraverso un buco fatto con le mani e chiudendo un occhio alla volta", "Misurando la vista", "Si sceglie a caso", "È sempre il destro"], correct: 0, why: "L'occhio che continua a vedere l'oggetto nel buco è il dominante: nel tiro istintivo la freccia va sotto di lui." },
  { q: "Perché molti tiratori istintivi inclinano un po' l'arco?", options: ["Per sembrare più bravi", "Per vedere meglio il bersaglio e tenere la freccia ferma sulla mano", "Perché l'arco è storto", "Per tirare più lontano"], correct: 1, why: "L'arco inclinato libera la vista e tiene la freccia appoggiata; conta farlo sempre uguale." },
  { q: "Un ancoraggio tipico del tiro istintivo è…", options: ["Il dito indice o medio all'angolo della bocca", "La corda sulla nuca", "La mano sul petto", "Il pugno sulla spalla"], correct: 0, why: "Un punto del viso sempre uguale, spesso l'angolo della bocca: rende il tiro ripetibile." },
  { q: "Tiri in forte salita o discesa mirando per la distanza che vedi. La freccia tende ad andare…", options: ["Alta", "Bassa", "A destra", "Dritta"], correct: 0, why: "Per la gravità conta la distanza orizzontale, più corta di quella reale: la freccia va alta." },
  { q: "Che cos'è il target panic?", options: ["La paura dei bersagli grandi", "Non riuscire a tenere la mira: si rilascia d'impulso appena la punta arriva sul bersaglio, o ci si blocca", "La fretta di ritirare le frecce", "Il freddo alle mani"], correct: 1, why: "È un problema di testa e di abitudine: si cura con esercizi di tiro da vicino e attenzione alla sequenza." },
  { q: "Com'è un buon rilascio?", options: ["Le dita si aprono di scatto in avanti", "Le dita si rilassano, la corda scivola via e la mano continua indietro", "Si tira la corda di lato", "Si abbassa l'arco subito"], correct: 1, why: "La schiena continua il lavoro e la mano scorre indietro lungo il viso." },
  { q: "La spalla del braccio dell'arco deve stare…", options: ["Alzata verso l'orecchio", "Bassa e ferma", "Spinta in avanti", "Piegata"], correct: 1, why: "Spalla bassa: il braccio regge l'arco con le ossa e non con il muscolo che si stanca." },
  { q: "Perché il gomito del braccio dell'arco va ruotato verso l'esterno?", options: ["Per tendere di più", "Per non farsi colpire dalla corda", "Per mirare meglio", "Non va ruotato"], correct: 1, why: "Con il gomito girato la corda passa libera e non colpisce l'avambraccio." },
  { q: "Come si tiene l'impugnatura dell'arco?", options: ["Stretta forte con tutte le dita", "Rilassata: l'arco spinge sulla mano, le dita lo accompagnano", "Con due dita", "Con il palmo aperto"], correct: 1, why: "Stringere fa girare l'arco al rilascio e sposta la freccia." },
  { q: "Arciere destro, presa con le dita: le frecce vanno a sinistra di dove guardi. L'asta è probabilmente…", options: ["Troppo rigida", "Troppo morbida", "Giusta", "Troppo lunga"], correct: 0, why: "Per un destro asta rigida va a sinistra, asta morbida a destra; con il mancino è il contrario." },
  { q: "Dove va lo sguardo nel tiro istintivo?", options: ["Sulla punta della freccia", "Su un punto piccolo del bersaglio, fino alla fine del tiro", "Sull'arco", "Sulla corda"], correct: 1, why: "Si sceglie un punto preciso e lo si guarda fino a che la freccia è arrivata." },
  { q: "A cosa serve una routine sempre uguale prima di ogni freccia?", options: ["A perdere tempo", "A rendere il gesto ripetibile e a calmare la testa", "A spaventare l'avversario", "Non serve"], correct: 1, why: "Gli stessi passi ogni volta danno lo stesso tiro, anche sotto pressione in gara." },
];

const STORIA: Raw[] = [
  { q: "Di che legno era l'arco di Ötzi, l'uomo del Similaun?", options: ["Tasso", "Quercia", "Olmo", "Bambù"], correct: 0, why: "Ötzi, vissuto oltre 5000 anni fa, portava un arco di tasso non finito e una faretra con le frecce." },
  { q: "In quale battaglia del 1415 gli arcieri inglesi con l'arco lungo furono decisivi?", options: ["Hastings", "Azincourt", "Legnano", "Lepanto"], correct: 1, why: "Ad Azincourt gli arcieri inglesi fermarono la cavalleria francese." },
  { q: "A Crécy, nel 1346, chi combatteva con la balestra per i francesi?", options: ["Arcieri gallesi", "Balestrieri genovesi", "Arcieri turchi", "Cavalieri teutonici"], correct: 1, why: "I balestrieri genovesi erano mercenari famosi in tutta Europa." },
  { q: "Che cosa si è trovato nel relitto della Mary Rose, la nave di Enrico VIII affondata nel 1545?", options: ["Balestre di ferro", "Archi lunghi di tasso e frecce", "Archi compositi turchi", "Nessun arco"], correct: 1, why: "Dalla Mary Rose sono usciti più di cento archi lunghi inglesi: una fonte preziosa su come erano fatti." },
  { q: "Com'è fatto l'arco composito turco?", options: ["Tutto di metallo", "Anima di legno, corno sul ventre e tendine sul dorso", "Solo bambù", "Un unico legno"], correct: 1, why: "Il corno regge la compressione, il tendine la trazione: archi corti e potenti, adatti a cavallo." },
  { q: "In un arco di tasso, perché si lascia il durame sul ventre e l'alburno sul dorso?", options: ["Per il colore", "Il durame resiste alla compressione, l'alburno alla trazione", "Perché è più leggero", "Non conta"], correct: 1, why: "Il tasso è un arco composito naturale: durame scuro verso l'arciere, alburno chiaro verso il bersaglio." },
  { q: "Che cosa sono le siyah degli archi orientali?", options: ["Le punte rigide dei flettenti che fanno da leva", "Le corde di seta", "Le frecce corte", "Le faretre"], correct: 0, why: "Le estremità rigide e piegate in avanti danno leva al flettente e rendono l'arco più efficiente." },
  { q: "Che cosa ha di particolare lo yumi, l'arco giapponese?", options: ["È smontabile", "È asimmetrico: l'impugnatura sta sotto il centro", "È di metallo", "È cortissimo"], correct: 1, why: "Lungo più di due metri, si impugna nel terzo inferiore: è l'arco del kyudo." },
  { q: "Come tendevano l'arco gli arcieri mongoli e turchi?", options: ["Con tre dita", "Con il pollice, protetto da un anello", "Con un meccanismo", "Con i denti"], correct: 1, why: "La presa con il pollice è ancora oggi quella degli archi orientali a foggia storica." },
  { q: "A cosa serviva la punta bodkin, lunga e sottile?", options: ["Alla caccia di piccoli animali", "A passare tra gli anelli della cotta di maglia", "Ai bersagli di paglia", "A tagliare le corde"], correct: 1, why: "Era la punta da guerra contro le protezioni di maglia." },
  { q: "Che cosa ordinava nel 1363 un'ordinanza di Edoardo III d'Inghilterra?", options: ["Di vietare l'arco", "Di esercitarsi con l'arco nei giorni di festa", "Di usare solo la balestra", "Di pagare una tassa sulle frecce"], correct: 1, why: "Il re voleva sempre pronti gli arcieri: nei giorni di festa ci si allenava al tiro invece che ad altri giochi." },
  { q: "Gli archi di Holmegaard, in Danimarca, tra i più antichi trovati, sono di…", options: ["Tasso", "Olmo", "Corno", "Bambù"], correct: 1, why: "Sono archi d'olmo di circa 9000 anni fa, con i flettenti larghi e piatti." },
  { q: "Secondo la tradizione dell'arazzo di Bayeux, come morì re Aroldo a Hastings nel 1066?", options: ["Di spada", "Colpito da una freccia all'occhio", "Cadendo da cavallo", "In un duello"], correct: 1, why: "È il racconto più famoso della battaglia, anche se gli storici ne discutono." },
  { q: "Quanto era lungo di solito un arco lungo inglese?", options: ["Circa un metro", "Più o meno quanto l'arciere", "Tre metri", "Mezzo metro"], correct: 1, why: "Di solito tra 1,70 e 2 metri, all'incirca l'altezza di chi lo tendeva." },
];

const ATTREZZATURA: Raw[] = [
  { q: "Come si indica lo spine delle aste di legno?", options: ["In libbre, per esempio 40-45", "Con un numero come 500 o 700", "In grammi", "In centimetri"], correct: 0, why: "Le aste di legno si dividono per libbraggio dell'arco; il numero 500-700 è la flessione delle aste moderne." },
  { q: "Le piume di una freccia vanno prese…", options: ["Da ali diverse a caso", "Tutte dalla stessa ala, destra o sinistra", "Una per ala", "Non importa"], correct: 1, why: "Le piume della stessa ala hanno la stessa curva e fanno girare la freccia sempre nello stesso verso." },
  { q: "Tirando dalla mensola o dalla mano, perché si usano piume e non alette di plastica?", options: ["Perché costano meno", "Perché si piegano passando sull'arco senza deviare la freccia", "Perché sono più pesanti", "Per il colore"], correct: 1, why: "La piuma si schiaccia e si rialza; l'aletta rigida sbatte e spinge via la freccia." },
  { q: "Dove va la penna guida?", options: ["Verso l'arco", "Lontana dall'arco", "In alto", "Indifferente"], correct: 1, why: "Con la guida rivolta fuori le altre due passano pulite accanto all'arco." },
  { q: "Che cos'è il fistmele?", options: ["Un tipo di punta", "Il pugno con il pollice alzato, misura tradizionale della distanza tra corda e arco", "Una faretra", "Un nodo"], correct: 1, why: "È il vecchio modo di misurare il brace di un arco lungo: circa 15-18 centimetri." },
  { q: "A quale allungo si misurano le libbre di un arco?", options: ["24 pollici", "28 pollici", "32 pollici", "Al massimo dell'arco"], correct: 1, why: "Le libbre scritte sull'arco valgono a 28 pollici: con un allungo diverso il carico cambia." },
  { q: "Perché un arco di legno va scordato dopo il tiro?", options: ["Per non rovinare la corda", "Per evitare che i flettenti prendano la piega e perdano forza", "Per farlo asciugare", "Non serve"], correct: 1, why: "Lasciato teso, il legno si deforma (string follow) e l'arco tira meno." },
  { q: "Che cosa succede se si rilascia la corda senza freccia?", options: ["Niente", "L'arco può rompersi: tutta l'energia resta nei flettenti", "La corda si allunga", "L'arco tira più forte dopo"], correct: 1, why: "Il tiro a vuoto è il modo più rapido per spaccare un arco, specie se di legno." },
  { q: "Che cos'è una corda Flemish?", options: ["Una corda di metallo", "Una corda con i fili ritorti a mano e le asole intrecciate", "Una corda elastica", "Una catena"], correct: 1, why: "È la corda tradizionale, ritorta e intrecciata, diversa dalla corda continua avvolta." },
  { q: "Quale legno è un classico per le aste delle frecce tradizionali?", options: ["Cedro", "Ulivo", "Quercia", "Castagno"], correct: 0, why: "Il cedro di Port Orford è dritto, leggero e regolare; si usano anche pino e betulla." },
  { q: "Qual è il dorso dell'arco?", options: ["La parte rivolta verso l'arciere", "La parte rivolta verso il bersaglio", "L'impugnatura", "La corda"], correct: 1, why: "Il dorso guarda il bersaglio e lavora in trazione; il ventre guarda l'arciere e lavora in compressione." },
  { q: "Che cosa vuol dire tillerare un arco?", options: ["Dipingerlo", "Regolarne i flettenti perché si pieghino in modo bilanciato", "Accorciarlo", "Cambiare la corda"], correct: 1, why: "Il tiller si controlla tendendo l'arco poco a poco e togliendo legno dove serve." },
  { q: "Perché si passa la cera sulla corda?", options: ["Per farla brillare", "Per tenere uniti i fili e proteggerla dall'usura e dall'umidità", "Per renderla più lunga", "Per tirare più forte"], correct: 1, why: "Una corda cerata dura di più e resta compatta." },
  { q: "Con un arco più potente lo spine dell'asta deve essere…", options: ["Più rigido", "Più morbido", "Uguale", "Non conta"], correct: 0, why: "Più libbre spingono di più la freccia: serve un'asta più rigida per non piegarsi troppo." },
  { q: "Perché una freccia troppo corta è pericolosa?", options: ["Vola troppo", "A trazione piena può cadere dietro l'appoggio e ferire la mano", "Si rompe la corda", "Non è pericolosa"], correct: 1, why: "La freccia deve sporgere oltre l'arco anche ad allungo pieno." },
  { q: "Che cosa protegge il parabraccio?", options: ["Le dita", "L'avambraccio dalla corda", "Il petto", "La faretra"], correct: 1, why: "Le dita le protegge la patella o il guantino; il parabraccio ripara l'avambraccio." },
];

const SICUREZZA: Raw[] = [
  { q: "Perché non si tira mai verso il cielo?", options: ["Perché la freccia va troppo piano", "Perché ricade chissà dove e può ferire qualcuno", "Perché si rompe", "Si può fare"], correct: 1, why: "Chi tende verso l'alto è pericoloso: nelle gare FITAST, dopo un richiamo, deve lasciare il percorso." },
  { q: "Prima di tendere l'arco cosa si controlla?", options: ["Il punteggio", "Che tutti siano dietro e che la traiettoria sia libera da persone e animali", "Il meteo", "La faretra degli altri"], correct: 1, why: "Davanti alla linea non ci deve essere nessuno, nemmeno lontano dietro il bersaglio." },
  { q: "Come si estraggono le frecce dal bersaglio?", options: ["Di corsa, tirando forte", "Con una mano appoggiata al bersaglio, dopo aver controllato che nessuno stia dietro", "Con i piedi", "Tutti insieme alla rinfusa"], correct: 1, why: "Chi sta dietro a chi estrae rischia la cocca in faccia." },
  { q: "Una freccia di legno ha una crepa. Cosa fai?", options: ["La tiri lo stesso", "Non la tiri più: può rompersi e ferire la mano", "La tiri solo da vicino", "La metti per ultima"], correct: 1, why: "Prima di tirarle, piega appena le aste e ascolta: se scricchiolano si buttano." },
  { q: "Come si cammina lungo il percorso tra una piazzola e l'altra?", options: ["Con la freccia incoccata, pronti a tirare", "Con le frecce nella faretra e l'arco scarico", "Di corsa", "Con l'arco teso"], correct: 1, why: "Si incocca solo sulla linea di tiro e quando è il proprio turno." },
  { q: "Se una freccia cade davanti alla linea durante il turno, cosa fai?", options: ["Vai a riprenderla subito", "Aspetti la fine del turno, quando nessuno tira", "La lasci per sempre", "Chiedi al pubblico"], correct: 1, why: "Davanti alla linea si va solo quando tutti hanno finito di tirare." },
];

const ALTRE: Raw[] = [
  { q: "In FITARCO come si chiama la divisione che la World Archery chiama Arco Tradizionale?", options: ["Arco Nudo", "Arco Istintivo", "Longbow", "Arco Storico"], correct: 1, why: "Nei regolamenti FITARCO l'Arco Tradizionale internazionale corrisponde all'Arco Istintivo." },
  { q: "A che distanza tira l'arco olimpico nelle gare all'aperto?", options: ["50 m", "60 m", "70 m", "90 m"], correct: 2, why: "Il ricurvo olimpico tira a 70 metri su un bersaglio da 122 cm." },
  { q: "Qual è la distanza delle gare in sala FITARCO?", options: ["12 m", "18 m", "25 m", "30 m"], correct: 1, why: "Le gare al chiuso si tirano a 18 metri (a volte anche a 25)." },
  { q: "Nelle gare a bersaglio di carta, una freccia tocca la riga tra due zone. Che punto vale?", options: ["Quello più basso", "Quello più alto", "Si ritira", "La media"], correct: 1, why: "Se la freccia tocca la riga di divisione vale il punteggio più alto." },
  { q: "Nel 3D FITARCO a 4 zone, quanto vale il centro più piccolo?", options: ["10", "11", "12", "8"], correct: 1, why: "Le zone valgono 11, 10, 8 e 5; nelle gare FITAST invece lo spot vale 8 e la sagoma 5." },
  { q: "Cosa indicano tre fischi in una gara FITARCO?", options: ["Stop di emergenza", "Si va a ritirare le frecce", "Si entra in linea", "Inizia il tiro"], correct: 1, why: "Due fischi: in linea. Un fischio: si tira. Tre fischi: si va al bersaglio. Una serie di fischi: stop." },
  { q: "Che cos'è la brace height?", options: ["L'altezza dell'arco", "La distanza tra la corda e il punto più profondo dell'impugnatura", "L'allungo", "La lunghezza della freccia"], correct: 1, why: "È la distanza tra la corda a riposo e la gola dell'impugnatura." },
  { q: "Quanti grammi è un grano?", options: ["Circa 0,065 g", "1 g", "0,5 g", "6,5 g"], correct: 0, why: "1 grano è circa 0,0648 g: una punta da 100 grani pesa circa 6,5 g." },
  { q: "Che cosa cambia con un FOC più alto, cioè più peso davanti?", options: ["La freccia è più instabile", "La freccia è più stabile in volo", "La freccia è più leggera", "Niente"], correct: 1, why: "Più peso in punta stabilizza il volo; sulle distanze lunghe però la freccia cala di più." },
];

const tag = (topic: QuizTopic, rows: Raw[], p: string): Question[] => rows.map((r, i) => ({ ...r, id: `${p}${i + 1}`, topic }));

export const QUIZ_BANK: Question[] = [
  ...tag("fitast", FITAST, "f"),
  ...tag("tecnica", TECNICA, "t"),
  ...tag("storia", STORIA, "s"),
  ...tag("attrezzatura", ATTREZZATURA, "a"),
  ...tag("sicurezza", SICUREZZA, "k"),
  ...tag("altre", ALTRE, "o"),
];

/** quote del quiz misto: due domande di regolamento FITAST, una di tecnica, una tra storia e attrezzatura, una tra sicurezza e il resto
 *  (in ogni posto l'argomento si sceglie prima, così anche quelli con poche domande escono spesso) */
const MIX: QuizTopic[][] = [["fitast"], ["fitast"], ["tecnica"], ["storia", "attrezzatura"], ["sicurezza", "sicurezza", "attrezzatura", "storia", "altre"]];

/** cinque domande che non si ripetono: si escludono quelle viste di recente finché ne restano abbastanza */
export function pickQuiz(seed: number, topic: QuizTopic | "misto", seen: string[]): Question[] {
  let s = seed % 233280 || 1;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const shuffle = <T,>(a: T[]) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const pool = topic === "misto" ? QUIZ_BANK : QUIZ_BANK.filter((q) => q.topic === topic);
  const recent = new Set(seen);
  const fresh = (list: Question[]) => {
    const unseen = list.filter((q) => !recent.has(q.id));
    return unseen.length ? unseen : list;
  };
  const out: Question[] = [];
  const take = (list: Question[]) => {
    const c = shuffle(fresh(list.filter((q) => !out.includes(q))))[0];
    if (c) out.push(c);
  };
  if (topic === "misto") for (const slot of MIX) take(pool.filter((q) => q.topic === slot[Math.floor(rnd() * slot.length)]));
  while (out.length < 5 && out.length < pool.length) take(pool);
  return shuffle(out);
}
