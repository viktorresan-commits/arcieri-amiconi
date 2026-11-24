import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { GestureGallery } from "@/components/gesture-gallery";

export const Route = createFileRoute("/_app/gesti")({ component: Page });

/** Storico delle analisi del gesto: tutte quelle salvate, da cui prendono i dati le statistiche del corpo. */
function Page() {
  return (
    <div className="grid gap-3">
      <PageHead kicker="Analizza" title="Storico del gesto" lede="Tutte le analisi del gesto che hai salvato, dalla più recente. Da qui prendono i numeri le statistiche del corpo: allungo, tempi, postura e tenuta." />
      <div className="grid grid-cols-2 gap-2">
        <Link to="/allenamento" search={{ avvia: "gesto" } as never} className="aa-press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-bold text-accent-fg">
          <Glyph name="archer" size={18} /> Nuova analisi
        </Link>
        <Link to="/statistiche" search={{ tab: "corpo" } as never} className="aa-press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/[0.08] text-sm font-semibold">
          <Glyph name="chart" size={18} /> Statistiche del corpo
        </Link>
      </div>
      <GestureGallery />
    </div>
  );
}
