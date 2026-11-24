import { Card, Segmented } from "./kit";
import { PoseRead } from "./pose-read";
import { GestureGallery } from "./gesture-gallery";
import { useEntryState } from "@/lib/arcieri/back-restore";

/**
 * Analisi del gesto con il suo storico: una nuova analisi (video, foto, 3D) e tutte quelle salvate,
 * complete, da cui prendono i numeri le statistiche del corpo.
 */
export function GestureHub({ initial = "nuova" }: { initial?: "nuova" | "storico" }) {
  const [tab, setTab] = useEntryState<"nuova" | "storico">("gesto-vista", initial);
  return (
    <div className="grid gap-3">
      <Card className="grid gap-3">
        <div>
          <h1 className="font-display text-3xl">Analisi del gesto</h1>
          <p className="mt-1 text-sm text-muted">
            {tab === "storico"
              ? "Tutte le analisi salvate, complete: tempi, misure in cm, angoli, postura per zone e il gesto in 3D. Le statistiche del corpo partono dall'ultima."
              : "Scegli un video dalla galleria o registralo adesso. Il video resta sul telefono, non viene caricato."}
          </p>
        </div>
        <Segmented value={tab} onChange={setTab} options={[{ id: "nuova", label: "Nuova analisi" }, { id: "storico", label: "Storico" }]} />
        {tab === "nuova" ? <PoseRead /> : null}
      </Card>
      {tab === "storico" ? <GestureGallery /> : null}
    </div>
  );
}
