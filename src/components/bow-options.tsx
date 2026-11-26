import { BOWS, MAIN_BOWS } from "@/lib/arcieri/labels";

/** voci di una tendina d'arco: tradizionale, storico, foggia storica; gli altri archi raccolti in fondo */
export function BowOptions() {
  return (
    <>
      {BOWS.filter((b) => MAIN_BOWS.includes(b.id)).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
      <optgroup label="Altri archi">
        {BOWS.filter((b) => !MAIN_BOWS.includes(b.id)).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
      </optgroup>
    </>
  );
}
