import { useState } from "react";
import { listClubOrders, saveClubOrder, setClubOrder } from "@/lib/arcieri/club.api";
import { memberLabel } from "@/lib/arcieri/labels";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, Empty, ErrorNote, Field, Select, TextInput } from "@/components/kit";

const ORDER_LABEL: Record<string, string> = {
  penne: "Penne",
  aste: "Aste",
  punte: "Punte",
  cocche: "Cocche",
  flettenti: "Flettenti",
  altro: "Altro",
};

/** Spesa comune della compagnia: penne, aste, punte che si ordinano insieme (prima stava fra i Trofei). */
export function ClubSpend() {
  const [nonce, setNonce] = useState(0);
  const orders = useLoad(`orders-${nonce}`, () => listClubOrders());
  const [item, setItem] = useState("penne");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  return (
    <Card className="grid gap-3">
      <h2 className="font-display text-2xl">Spesa comune della compagnia</h2>
      <p className="text-sm text-muted">Penne, aste, punte: si scrive qui e si ordina insieme.</p>
      <div className="grid grid-cols-2 gap-2">
        <Select value={item} onChange={(e) => setItem(e.target.value)}>
          {Object.entries(ORDER_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </Select>
        <TextInput inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Quantità" />
      </div>
      <Field label="Nota"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Marca, misura, colore" /></Field>
      {err ? <ErrorNote text={err} /> : null}
      <Button onClick={() => saveClubOrder({ data: { item, qty: Number(qty) || 1, note } }).then(() => { setNote(""); setNonce((n) => n + 1); }).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"))}>Aggiungi all'ordine</Button>
      {(orders.data ?? []).length === 0 ? <Empty title="Nessun ordine" text="Quando manca qualcosa, mettilo qui." /> : null}
      {(orders.data ?? []).map((row) => (
        <div key={row.id} className="rounded-xl border border-line p-2">
          <p className="font-semibold">{ORDER_LABEL[row.item] ?? row.item} × {row.qty}</p>
          <p className="text-xs text-muted">{memberLabel(row, orders.data ?? [])} · {row.status}{row.note ? ` · ${row.note}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["aperto", "Aperto"], ["ordinato", "Ordinato"], ["arrivato", "Arrivato"]] as const).map(([status, label]) => (
              <button key={status} type="button" className="min-h-10 rounded-full border border-line px-3 text-xs" onClick={() => setClubOrder({ data: { id: row.id, status } }).then(() => setNonce((n) => n + 1))}>{label}</button>
            ))}
            {row.mine ? <button type="button" className="text-xs text-danger" onClick={() => setClubOrder({ data: { id: row.id, remove: true } }).then(() => setNonce((n) => n + 1))}>Togli</button> : null}
          </div>
        </div>
      ))}
    </Card>
  );
}
