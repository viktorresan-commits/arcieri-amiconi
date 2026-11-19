import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { deleteShopping, listShopping, saveShopping } from "@/lib/arcieri/club.api";
import { CATEGORIES, categoryLabel, euro, parseEuro } from "@/lib/arcieri/labels";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHead, Select, TextInput } from "@/components/kit";

export const Route = createFileRoute("/_app/acquisti")({ component: Page });

function Page() {
  const [nonce, setNonce] = useState(0);
  const [tab, setTab] = useState<"all" | "wear">("all");
  const { data, error, loading } = useLoad(`shop-${nonce}`, () => listShopping());
  const [form, setForm] = useState({ name: "", category: "accessorio", qty: "1", price: "", url: "", priority: "normal", notes: "", sizeLabel: "", visibility: "personal" });
  const [err, setErr] = useState("");
  const rows = (data ?? []).filter((r) => {
    if (tab === "wear") return r.category === "abbigliamento" || r.category === "scarpe";
    return true;
  });
  return (
    <div className="grid gap-3">
      <PageHead title="Acquisti" lede="Solo tua. Gli altri non la vedono." />
      <div className="flex gap-2">
        {[["all", "Tutto"], ["wear", "Abbigliamento"]].map(([id, label]) => (
          <button key={id} type="button" className={`min-h-11 rounded-full border px-3 text-sm ${tab === id ? "border-accent bg-accent text-accent-fg" : "border-line"}`} onClick={() => setTab(id as typeof tab)}>{label}</button>
        ))}
      </div>
      <Card className="grid gap-2">
        <Field label="Prodotto"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
        <div className="grid grid-cols-3 gap-2">
          <TextInput value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="Qtà" />
          <TextInput value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="€" />
          <TextInput value={form.sizeLabel} onChange={(e) => setForm({ ...form, sizeLabel: e.target.value })} placeholder="Taglia" />
        </div>
        <TextInput value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="Link negozio" />
        <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          <option value="alta">Priorità alta</option>
          <option value="normal">Normale</option>
          <option value="bassa">Bassa</option>
        </Select>
        {err ? <ErrorNote text={err} /> : null}
        <Button onClick={() => saveShopping({ data: { ...form, qty: Number(form.qty) || 1, priceCents: parseEuro(form.price), status: "todo" } }).then(() => setNonce((n) => n + 1)).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"))}>Aggiungi</Button>
      </Card>
      {loading ? <Loading /> : null}
      {rows.length === 0 && !loading ? <Empty title="Lista vuota" text="Metti qui quello che manca, non quello che hai già in inventario." /> : null}
      {rows.map((item) => (
        <Card key={item.id} className="p-3">
          <p className="font-semibold">{item.name} × {item.qty}</p>
          <p className="text-xs text-muted">{categoryLabel(item.category)} · {item.priority} · {euro(item.priceCents)} {item.sizeLabel ? `· tg ${item.sizeLabel}` : ""} · {item.status}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["todo", "ordered", "bought"].map((status) => (
              <button key={status} type="button" className="min-h-11 rounded-full border border-line px-3 text-xs" onClick={() => saveShopping({ data: { ...item, priceCents: item.priceCents, status } }).then(() => setNonce((n) => n + 1))}>
                {status === "todo" ? "Da comprare" : status === "ordered" ? "Ordinato" : "Preso"}
              </button>
            ))}
            {item.url ? <a className="min-h-11 rounded-full border border-line px-3 text-xs leading-11" href={item.url} target="_blank" rel="noreferrer">Negozio</a> : null}
            {item.mine ? <button type="button" className="text-xs text-danger" onClick={() => deleteShopping({ data: { id: item.id } }).then(() => setNonce((n) => n + 1))}>Elimina</button> : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
