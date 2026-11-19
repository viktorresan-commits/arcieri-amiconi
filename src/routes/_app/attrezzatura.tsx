import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { deleteEquipment, deleteSetup, listEquipment, listSetups, saveEquipment, saveSetup } from "@/lib/arcieri/club.api";
import { CATEGORIES, categoryLabel, euro, parseEuro } from "@/lib/arcieri/labels";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHead, Select, TextArea, TextInput } from "@/components/kit";
import { FlightSim } from "@/components/flight-sim";

export const Route = createFileRoute("/_app/attrezzatura")({ component: Page });

function Page() {
  const [nonce, setNonce] = useState(0);
  const gear = useLoad(`g-${nonce}`, () => listEquipment());
  const setups = useLoad(`s-${nonce}`, () => listSetups());
  const [form, setForm] = useState({ name: "", brand: "", model: "", category: "arco", status: "in_use", visibility: "personal", price: "", shop: "", notes: "", draw: "", material: "", length: "", size: "", qty: "" });
  const [setup, setSetup] = useState({ name: "", bowId: "", arrowId: "", stringNote: "" });
  const [err, setErr] = useState("");
  const reload = () => setNonce((n) => n + 1);
  return (
    <div className="grid gap-3">
      <PageHead title="Attrezzatura" lede="Archi, frecce, corde e il resto. Una configurazione si aggancia all'allenamento." />
      <FlightSim />
      <Card className="grid gap-2">
        <Field label="Nome"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Marca"><TextInput value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
          <Field label="Modello"><TextInput value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
        </div>
        <Field label="Categoria">
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
        </Field>
        {form.category === "freccia" ? (
          <Field label="Numero frecce">
            <TextInput inputMode="numeric" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="12" />
          </Field>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Libbraggio / peso"><TextInput value={form.draw} onChange={(e) => setForm({ ...form, draw: e.target.value })} /></Field>
          <Field label="Materiale"><TextInput value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} /></Field>
          <Field label="Lunghezza"><TextInput value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} /></Field>
          <Field label="Taglia"><TextInput value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></Field>
        </div>
        <Field label="Prezzo €"><TextInput inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
        <Field label="Negozio"><TextInput value={form.shop} onChange={(e) => setForm({ ...form, shop: e.target.value })} /></Field>
        <Field label="Note da ricordare"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="in_use">In uso</option>
          <option value="replace">Da sostituire</option>
          <option value="unused">Non usato</option>
        </Select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.visibility === "group"} onChange={(e) => setForm({ ...form, visibility: e.target.checked ? "group" : "personal" })} /> Inventario del gruppo</label>
        {err ? <ErrorNote text={err} /> : null}
        <Button onClick={() => {
          const qty = form.qty.trim();
          if (form.category === "freccia" && qty && (!/^\d+$/.test(qty) || Number(qty) < 1 || Number(qty) > 200)) {
            setErr("Il numero di frecce è un intero, da 1 a 200.");
            return;
          }
          saveEquipment({ data: { ...form, priceCents: parseEuro(form.price), specs: { draw: form.draw, material: form.material, length: form.length, size: form.size, string: form.category === "corda" ? form.material : "", qty: form.category === "freccia" ? qty : "" } } }).then(() => { setErr(""); setForm((f) => ({ ...f, name: "", qty: "" })); reload(); }).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"));
        }}>Aggiungi</Button>
      </Card>
      {gear.loading ? <Loading /> : null}
      {(gear.data ?? []).length === 0 && !gear.loading ? <Empty title="Inventario vuoto" text="Aggiungi almeno l'arco che usi di solito." /> : null}
      <div className="grid gap-2">
        {(gear.data ?? []).map((item) => (
          <Card key={item.id} className="p-3">
            <p className="font-semibold">{item.name}</p>
            <p className="text-xs text-muted">{categoryLabel(item.category)}{item.category === "freccia" && item.specs.qty ? ` · ${item.specs.qty} frecce` : ""} · {item.brand} {item.model} · {item.status === "in_use" ? "in uso" : item.status === "replace" ? "da sostituire" : "fermo"} · {euro(item.priceCents)}{item.visibility === "group" ? " · gruppo" : ""}</p>
            {item.mine ? <button type="button" className="mt-1 text-xs text-danger" onClick={() => deleteEquipment({ data: { id: item.id } }).then(reload)}>Elimina</button> : null}
          </Card>
        ))}
      </div>
      <Card className="grid gap-2">
        <h2 className="font-display text-2xl">Configurazione</h2>
        <TextInput value={setup.name} onChange={(e) => setSetup({ ...setup, name: e.target.value })} placeholder="Nome, es. Indoor 18" />
        <Select value={setup.bowId} onChange={(e) => setSetup({ ...setup, bowId: e.target.value })}>
          <option value="">Arco</option>
          {(gear.data ?? []).filter((g) => g.category === "arco").map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
        <Select value={setup.arrowId} onChange={(e) => setSetup({ ...setup, arrowId: e.target.value })}>
          <option value="">Frecce</option>
          {(gear.data ?? []).filter((g) => g.category === "freccia").map((g) => <option key={g.id} value={g.id}>{g.name}{g.specs.qty ? ` · ${g.specs.qty}` : ""}</option>)}
        </Select>
        <TextInput value={setup.stringNote} onChange={(e) => setSetup({ ...setup, stringNote: e.target.value })} placeholder="Corda: marca, fili, lunghezza" />
        <Button variant="primary" onClick={() => saveSetup({ data: { name: setup.name, bowId: setup.bowId || null, arrowId: setup.arrowId || null, stringNote: setup.stringNote, notes: "" } }).then(reload)}>Salva configurazione</Button>
        <ul className="text-sm">{(setups.data ?? []).map((s) => <li key={s.id} className="flex justify-between py-1">{s.name} <button type="button" className="text-danger" onClick={() => deleteSetup({ data: { id: s.id } }).then(reload)}>togli</button></li>)}</ul>
      </Card>
    </div>
  );
}
