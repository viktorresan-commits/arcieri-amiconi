import { useEntryState } from "@/lib/arcieri/back-restore";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Chips, PageHead } from "@/components/kit";

export const Route = createFileRoute("/_app/regole")({ component: Page });

/** Promemoria di distanze, bersagli e tempi: le regole generali World Archery più usate. */
const DATA: Record<string, { title: string; rows: [string, string, string][]; notes: string[] }> = {
  indoor: {
    title: "Sala (indoor)",
    rows: [["Olimpico", "18 m", "40 cm (anche trispot)"], ["Compound", "18 m", "trispot 40 cm, 10 piccolo"], ["Nudo", "18 m", "40 cm"]],
    notes: ["Volée da 3 frecce in 2 minuti.", "Si tira anche a 25 m su bersaglio da 60 cm in alcune gare."],
  },
  targa: {
    title: "Targa all'aperto",
    rows: [["Olimpico", "70 m", "122 cm, 10 zone"], ["Compound", "50 m", "80 cm, 6 zone"], ["Nudo", "50 m", "122 cm"]],
    notes: ["Volée da 6 frecce in 4 minuti (o 3 frecce in 2 minuti).", "Freccia sulla riga: vale il punteggio più alto."],
  },
  campagna: {
    title: "Campagna (field)",
    rows: [["Piazzole", "distanze note e sconosciute", "facce gialle e nere, 6 zone"], ["Frecce", "3 per piazzola", ""]],
    notes: ["Percorso nel bosco, salite e discese: la stima della distanza conta.", "Distanze e picchetti cambiano per divisione e classe."],
  },
  tred: {
    title: "3D",
    rows: [["Sagome", "distanze sconosciute", "animali in gomma"], ["Punti FITARCO", "11 · 10 · 8 · 5", "zone vitali"]],
    notes: ["Allenati con «Stima distanze» per leggere i metri a occhio.", "Il numero di frecce per sagoma dipende dal regolamento della gara."],
  },
};

function Page() {
  const [tab, setTab] = useEntryState("regole-tab", "targa");
  const d = DATA[tab];
  return (
    <div className="grid gap-3">
      <PageHead kicker="Impara" title="Distanze e bersagli" lede="Un promemoria veloce. Per le gare fa fede il regolamento federale aggiornato." />
      <Chips value={tab} onChange={setTab} options={[{ id: "indoor", label: "Sala" }, { id: "targa", label: "Targa" }, { id: "campagna", label: "Campagna" }, { id: "tred", label: "3D" }]} />
      <Card key={tab} className="aa-rise grid gap-2">
        <p className="aa-section-title">{d.title}</p>
        {d.rows.map(([a, b, c], i) => (
          <div key={a} className="aa-menu-row grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-b border-white/5 py-1.5 last:border-0" style={{ animationDelay: `${i * 50}ms` }}>
            <span className="font-semibold">{a}</span>
            <span className="font-display text-xl tabular-nums">{b}</span>
            {c ? <span className="col-span-2 text-xs text-muted">{c}</span> : null}
          </div>
        ))}
        {d.notes.map((n) => <p key={n} className="text-sm text-muted">{n}</p>)}
      </Card>
      <Card className="grid gap-1.5">
        <p className="aa-section-title">I fischi</p>
        <p className="text-sm"><b>2 fischi</b>: in linea di tiro (10 secondi per prepararsi).</p>
        <p className="text-sm"><b>1 fischio</b>: si tira.</p>
        <p className="text-sm"><b>3 fischi</b>: si va al bersaglio a segnare.</p>
        <p className="text-sm"><b>5 o più</b>: stop immediato, pericolo.</p>
      </Card>
    </div>
  );
}
