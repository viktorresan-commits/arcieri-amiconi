import { createFileRoute } from "@tanstack/react-router";
import { Mark } from "@/components/kit";

export const Route = createFileRoute("/privacy")({ component: Privacy });

/** Chi tratta i dati. Da completare con nome e email del titolare prima della pubblicazione sugli store. */
const OWNER = "";
const EMAIL = "";

const SECTIONS: { title: string; text: string[] }[] = [
  {
    title: "Chi tratta i tuoi dati",
    text: [
      OWNER ? `Il titolare del trattamento è ${OWNER}, autore dell'app Arcieri Amiconi.` : "Il titolare del trattamento è l'autore dell'app Arcieri Amiconi.",
      EMAIL ? `Per qualsiasi richiesta scrivi a ${EMAIL}.` : "Per qualsiasi richiesta scrivi al fondatore dell'app dalla Bacheca, oppure chiedi al presidente della tua compagnia.",
      "Le compagnie che usano l'app non vendono e non comprano dati: li usano solo per la vita della compagnia.",
    ],
  },
  {
    title: "Quali dati raccogliamo",
    text: [
      "Account: nome, email e, se entri con Google, l'identificativo che Google ci passa. La password non la vediamo: è salvata in forma cifrata.",
      "Profilo: nome, cognome, soprannome, foto o volto dell'avatar, arco, compagnia, note che scrivi tu.",
      "Tiro: allenamenti, frecce e punteggi, posizione delle frecce sul bersaglio, gare, obiettivi, attrezzatura, lista acquisti.",
      "Analisi del gesto: i video restano sul tuo telefono; se scegli di salvare un'analisi, conserviamo i numeri che ne ricava l'app (angoli e tempi) e una piccola immagine di anteprima.",
      "Segreteria della compagnia: quota pagata o no, scadenza della tessera della compagnia e della tessera FITAST, data di scadenza e tipo del certificato medico, presenze ai corsi. Nessun dato sanitario oltre alla data di scadenza.",
    ],
  },
  {
    title: "Perché li usiamo",
    text: [
      "Per far funzionare l'app: registrare i tiri, calcolare statistiche, classifiche, sfide e l'arciere che tira come te.",
      "Per la vita della compagnia: classifiche interne, gare, inviti e, per chi la gestisce, la segreteria.",
      "Non usiamo i tuoi dati per pubblicità e non li vendiamo a nessuno.",
    ],
  },
  {
    title: "Chi li vede",
    text: [
      "Gli arcieri della tua compagnia vedono il tuo nome, la foto, l'avatar, i punteggi in classifica e le gare.",
      "Gli allenatori e il presidente della tua compagnia vedono l'andamento dei tuoi allenamenti, le analisi del gesto e le foto delle volée, se non lo spegni dal Profilo.",
      "Quote, certificati e presenze li vedono solo il presidente e gli allenatori della tua compagnia e il fondatore dell'app.",
      "Sito e database sono ospitati da fornitori cloud (Vercel per il sito, Neon per il database), che li custodiscono per nostro conto.",
    ],
  },
  {
    title: "Per quanto li teniamo",
    text: [
      "Finché hai l'account. Se lo elimini, cancelliamo il profilo, gli allenamenti, le gare, l'attrezzatura e tutto il resto.",
      "Il fondatore può togliere un account inattivo da più di 3 mesi, con gli stessi effetti.",
    ],
  },
  {
    title: "I tuoi diritti",
    text: [
      "Vedere e scaricare i tuoi dati: Profilo › Account › Scarica JSON o Report PDF.",
      "Correggerli: Profilo › Io.",
      "Eliminare l'account e tutti i dati: Profilo › Account › Elimina il mio account.",
      "Puoi anche opporti a un uso dei dati o chiedere chiarimenti scrivendo al titolare, e rivolgerti al Garante per la protezione dei dati personali.",
    ],
  },
  {
    title: "Minori",
    text: [
      "Sotto i 14 anni serve il consenso di un genitore o di chi ne fa le veci: l'account va creato insieme a lui.",
    ],
  },
  {
    title: "Cookie",
    text: [
      "Usiamo solo i cookie tecnici che servono a tenerti dentro dopo l'accesso, e la memoria del telefono per le tue preferenze. Nessun cookie di profilazione o pubblicità.",
    ],
  },
];

function Privacy() {
  return (
    <main className="min-h-dvh bg-bg px-4 py-8 text-fg">
      <div className="mx-auto grid max-w-2xl gap-5">
        <a href="/" className="flex items-center gap-2 text-sm text-muted">
          <Mark />
          <span className="font-display text-xl leading-none text-fg">ARCIERI AMICONI</span>
        </a>
        <header className="grid gap-1">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-muted">Informativa sulla privacy</p>
          <h1 className="font-display text-4xl leading-none">I tuoi dati, in chiaro</h1>
          <p className="text-sm text-muted">Aggiornata al 22 novembre 2026. Ogni punto dice cosa succede davvero nell'app.</p>
        </header>
        {SECTIONS.map((s) => (
          <section key={s.title} className="grid gap-2 rounded-[var(--radius-card)] border border-hair bg-elev p-4">
            <h2 className="font-display text-2xl leading-tight">{s.title}</h2>
            <ul className="grid gap-1.5 text-sm leading-relaxed text-fg/90">
              {s.text.map((t) => (
                <li key={t} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{t}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="pb-10 text-center text-xs text-muted">Arcieri Amiconi · <a className="underline" href="/login">Entra</a> · <a className="underline" href="/">Torna all'app</a></p>
      </div>
    </main>
  );
}
