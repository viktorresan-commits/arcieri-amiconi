/**
 * Aiuto in contesto: due o tre consigli pratici per ogni pagina, aperti dal pulsante "?" in alto.
 * Le frasi descrivono solo quello che la pagina fa davvero.
 */
export const PAGE_HELP: Record<string, string[]> = {
  "/": [
    "Tocca il tuo volto in alto per cambiare l'aspetto del tuo arciere.",
    "Il pulsante + in basso apre le azioni rapide: tiro rapido, volée da foto, analisi del gesto.",
    "Tieni premuto un allenamento per eliminarlo.",
  ],
  "/allenamento": [
    "Tiro rapido riparte con le impostazioni dell'ultima volta.",
    "Con Volée da foto fotografi il bersaglio e segni le frecce dall'immagine.",
    "Già fatto serve a registrare un tiro passato; Storico mostra tutti gli allenamenti.",
  ],
  "/squadra": [
    "In alto scegli Arcieri, Statistiche o Compagnie.",
    "Tocca una compagnia in classifica per aprire contatti, motto e arcieri.",
    "Tocca un arciere per vedere il suo profilo e il suo avatar.",
  ],
  "/avatar": [
    "Semplice mostra le scelte a scorrimento; Completa apre tutte le schede e i cursori.",
    "Profilo, Fronte e 3D cambiano la vista dell'anteprima.",
    "Nella scheda Scena scegli l'ambientazione, anche al chiuso.",
  ],
  "/gare": [
    "Segni solo le gare a cui hai partecipato.",
    "Il punteggio degli altri si vede, ma si cambia solo il tuo.",
    "Tieni premuto il tuo punteggio per eliminarlo.",
  ],
  "/statistiche": [
    "Confronta allenamento e campionato periodo su periodo.",
    "Gara contro gara vedi dove sei migliorato.",
  ],
  "/balistica": [
    "Imposta arco e freccia e guarda la parabola cambiare in tempo reale.",
    "Più in basso trovi il calcolo del FOC.",
  ],
  "/attrezzatura": [
    "Salva archi, frecce e corde: una configurazione si aggancia all'allenamento.",
  ],
  "/calendario": [
    "Vedi i tuoi allenamenti, le tue gare e gli appuntamenti comuni.",
    "Tieni premuto un allenamento per eliminarlo.",
  ],
  "/classifiche": [
    "Contano gli allenamenti e le piazzole di ogni gara; poi puoi filtrare.",
    "Tieni premuta la tua riga per eliminarla.",
  ],
  "/sfide": [
    "Una sfida vale solo con stesse frecce, arco, distanza e bersaglio.",
    "Tieni premuta una sfida che hai lanciato tu per eliminarla.",
    "In fondo c'è Confronta: prima vedi tutti gli arcieri, poi metti a fianco due tuoi allenamenti.",
  ],
  "/obiettivi": [
    "Le medaglie premiano anche il salto di media e i giorni diversi, non solo il numero di frecce.",
  ],
  "/bacheca": [
    "Qui trovi gli avvisi del gruppo.",
    "Le notifiche arrivano solo per gare, sfide e medaglie.",
  ],
  "/acquisti": ["La lista è tua: gli altri non la vedono."],
  "/profilo": ["Dati personali, importazioni, password e preferenze dell'app."],
  "/staff": [
    "Hai ricevuto un codice? Scrivilo in «Hai un codice?»: vale per la nomina a presidente e per gli inviti.",
    "Presidente e allenatori creano un invito e lo mandano su WhatsApp: chi apre il link entra nella compagnia.",
    "Presidente e allenatori tolgono persone solo dalla loro compagnia; gli allenatori li nomina il presidente.",
  ],
  "/istruttore": [
    "Allievi: in alto chi ha bisogno di attenzione (media in calo o assente da più di 10 giorni). Tocca un allievo per i suoi progressi.",
    "Nella scheda dell'allievo trovi miglioramenti, analisi del gesto, foto delle volée e le sue schede di allenamento.",
    "Schede: prepara gli esercizi, l'allievo li trova nel Menu in «Le mie schede» e li spunta man mano.",
    "Chi ha tolto la condivisione dal profilo compare senza numeri, ma puoi comunque preparargli una scheda.",
  ],
  "/schede": [
    "Tocca un esercizio quando l'hai fatto: l'allenatore vede a che punto sei.",
    "Con «Invia la nota» gli scrivi com'è andata o cosa non ti è chiaro.",
  ],
  "/segreteria": [
    "Quote: tocca «Segna pagata»; l'importo è facoltativo.",
    "Certificati: basta la data di scadenza. Arancione = scade entro 30 giorni.",
    "Presenze: aggiungi la giornata e tocca chi c'era. «Esporta tabella» crea un CSV per Excel.",
  ],
  "/riepilogo": [
    "Scorri i mesi con le frecce: l'immagine si aggiorna da sola.",
    "«Condividi» apre WhatsApp, Instagram e le altre app; sul computer scarica l'immagine.",
  ],
  "/timer": ["Semaforo, fischi e turni AB/CD come in gara.", "Lo schermo resta acceso mentre il timer corre."],
  "/borsa": ["Spunta la borsa prima di uscire, poi avvia il riscaldamento guidato."],
  "/manutenzione": ["Tocca Fatto quando sistemi una parte: l'app conta giorni e frecce da allora."],
  "/secco": ["Tieni quando fischia una volta, rilascia piano con due fischi."],
  "/tempi": ["Misura dall'inizio della trazione al rilascio: più è costante, più il tiro è ripetibile."],
  "/routine": ["Sempre gli stessi passi, nello stesso ordine.", "Avanza un passo alla volta durante il tiro."],
  "/respiro": ["Pochi respiri lenti prima della volée abbassano il battito."],
  "/segnapunti": ["Aggiungi gli amici, poi tocca i punti.", "A fine volée passa da solo al prossimo arciere."],
  "/spine": ["Le libbre sui flettenti valgono a 28″: inserisci il tuo allungo per le libbre reali."],
  "/vento": ["Inserisci vento laterale e distanza per sapere dove mirare."],
  "/energia": ["Velocità, energia e quantità di moto per scegliere il peso della freccia."],
  "/allungo": ["Braccia aperte, schiena al muro: misura da punta a punta del dito medio."],
  "/tuning": ["Tre frecce impennate e due nude, stessa mira, a 18 m.", "Tocca dove sono finite le nude."],
  "/assetto": ["Segna le misure quando le controlli: vedi subito se qualcosa si è spostato."],
  "/unita": ["Scrivi in una delle due caselle: l'altra si aggiorna da sola."],
  "/lezioni": ["Ogni lezione ha un disegno, gli errori da evitare, un esercizio e una domanda."],
  "/sfida-giorno": ["Un esercizio diverso ogni giorno: fallo e segnalo per far crescere la serie."],
  "/quiz": ["Cinque domande su regole, tecnica e attrezzatura."],
  "/stima": ["Nel 3D le distanze non sono scritte: la sagoma è alta circa 80 cm."],
  "/glossario": ["Le parole dell'arciere, spiegate in breve."],
  "/regole": ["Un promemoria veloce: per le gare fa fede il regolamento federale aggiornato."],
};

/** Gesti che valgono in tutta l'app. */
export const GLOBAL_TIPS: { icon: "plus" | "grid" | "chevron" | "hand" | "search"; text: string }[] = [
  { icon: "plus", text: "Il + al centro in basso apre le azioni rapide per tirare subito." },
  { icon: "grid", text: "Menu raccoglie tutte le sezioni, divise per categoria." },
  { icon: "search", text: "Nel Menu la lente cerca tra tutte le voci." },
  { icon: "hand", text: "Tieni premuto un elemento tuo per eliminarlo." },
];

export function helpFor(path: string): string[] {
  if (PAGE_HELP[path]) return PAGE_HELP[path];
  const key = Object.keys(PAGE_HELP)
    .filter((k) => k !== "/" && path.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? PAGE_HELP[key] : [];
}
