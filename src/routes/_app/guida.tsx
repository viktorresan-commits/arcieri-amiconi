import { createFileRoute } from "@tanstack/react-router";
import { PageHead, Card } from "@/components/kit";

export const Route = createFileRoute("/_app/guida")({ component: Page });

const BLOCKS = [
  ["Chi entra", "Ti registri con un nome utente e una password, oppure con Google o X. Vale anche l'app installata sul telefono. Appena l'account esiste, il nome è in squadra e nelle statistiche. Non c'è una rosa già scritta."],
  ["Compagnia", "È nel menu in basso: stemma, contatti e social della tua compagnia, gli arcieri, le statistiche e la classifica tra compagnie. Nelle statistiche ci sono i podi Generale, Madonne, Messeri, Pueri e Juniores: prima i punti campionato, poi la media di gara, poi la media per freccia."],
  ["Password", "La cambi dal tuo profilo. Non c'è un amministratore che la reimposta, e non parte nessuna email."],
  ["Gare", "Sotto Salva punteggio, se hai scelto l'animale della piazzola, compare la sua sagoma con le frecce di quella piazzola. Il cinghiale resta il riassunto della gara: 8 nello spot, 5 sul corpo, 0 fuori."],
  ["Allenamento", "Scegli il bersaglio, se è frontale, a destra, a sinistra, alto o basso, e la distanza stimata. I punti li metti solo toccando il bersaglio."],
  ["Giochiamo", "Sta nel menu, subito sopra questa guida, col segno del club. È il tiro in prima persona: scegli destro o mancino, lunghezza dell'asta, grano della punta, libbre e colore delle penne. Tiri la corda indietro e rilasci. In modalità Gara ci sono 20 piazzole da 3 frecce, e le vedi finire."],
  ["Cosa vedono gli altri", "Foto rotonda, media degli allenamenti e punteggi di gara, come grafico. Non vedono acquisti, note personali né il materiale che è solo tuo."],
  ["Eliminare", "Tieni premuto un allenamento, in casa o nel calendario, poi tocca Elimina. Lo stesso sulla tua riga in classifica, sul tuo punteggio di gara (anche in arrivo) e su una sfida che hai lanciato tu. Il punteggio di gara di un altro non si toglie."],
  ["Programma istintivo", "A 18 metri, prima di tirare scegli obiettivo, stato fisico e frecce: 15, 30, 45 o 60. Il programma non alza volume né difficoltà. A fine tiro registri serie, rosata, errori, sensazioni e, se vuoi, la foto."],
  ["Cronometro", "Il tempo segue l'orologio. Se il telefono si blocca, al ritorno il tempo è quello vero."],
];

function Page() {
  return (
    <div className="grid gap-3">
      <PageHead title="Guida" lede="Come è fatto il quaderno, senza scorciatoie finte." />
      {BLOCKS.map(([title, text]) => (
        <Card key={title}>
          <h2 className="font-display text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-muted">{text}</p>
        </Card>
      ))}
    </div>
  );
}
