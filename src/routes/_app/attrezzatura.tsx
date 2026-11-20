import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { deleteEquipment, deleteSetup, listEquipment, listSetups, saveEquipment, saveSetup } from "@/lib/arcieri/club.api";
import { CATEGORIES, categoryLabel, euro, parseEuro } from "@/lib/arcieri/labels";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHead, Select, TextArea, TextInput } from "@/components/kit";
import { FlightSim } from "@/components/flight-sim";
import { ARROW_USE, BOW_TYPES, FLETCH_TYPES, POINT_TYPES, SHAFT_MATERIALS, SWATCHES, ArrowIcon, BowIcon, CategoryIcon } from "@/components/gear-icons";

export const Route = createFileRoute("/_app/attrezzatura")({ component: Page });

type Form = {
  id: number | null;
  name: string;
  brand: string;
  model: string;
  category: string;
  status: string;
  visibility: string;
  price: string;
  shop: string;
  notes: string;
  specs: Record<string, string>;
};

const EMPTY: Form = { id: null, name: "", brand: "", model: "", category: "arco", status: "in_use", visibility: "personal", price: "", shop: "", notes: "", specs: { bowType: "olimpico", material: "carbonio", fletchType: "alette", fletch: "#d63a2f", cock: "#e6b325", nock: "#f4f1ea", use: "entrambi", numFrom: "1" } };

function Page() {
  const [nonce, setNonce] = useState(0);
  const gear = useLoad(`g-${nonce}`, () => listEquipment());
  const setups = useLoad(`s-${nonce}`, () => listSetups());
  const [form, setForm] = useState<Form>(EMPTY);
  const [open, setOpen] = useState(false);
  const [setup, setSetup] = useState({ name: "", bowId: "", arrowId: "", stringNote: "" });
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("tutto");
  const reload = () => setNonce((n) => n + 1);
  const spec = (k: string) => form.specs[k] ?? "";
  const setSpec = (k: string, v: string) => setForm((f) => ({ ...f, specs: { ...f.specs, [k]: v } }));
  const items = (gear.data ?? []).filter((g) => filter === "tutto" || g.category === filter);

  function edit(item: NonNullable<typeof gear.data>[number]) {
    setForm({
      id: item.id,
      name: item.name,
      brand: item.brand,
      model: item.model,
      category: item.category,
      status: item.status,
      visibility: item.visibility,
      price: item.priceCents == null ? "" : (item.priceCents / 100).toFixed(2).replace(".", ","),
      shop: item.shop,
      notes: item.notes,
      specs: { ...EMPTY.specs, ...item.specs },
    });
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function save() {
    const qty = spec("qty").trim();
    if (form.category === "freccia" && qty && (!/^\d+$/.test(qty) || Number(qty) < 1 || Number(qty) > 200)) {
      setErr("Il numero di frecce è un intero, da 1 a 200.");
      return;
    }
    saveEquipment({ data: { ...form, priceCents: parseEuro(form.price), specs: { ...form.specs, string: form.category === "corda" ? spec("material") : spec("string") } } })
      .then(() => {
        setErr("");
        setForm(EMPTY);
        setOpen(false);
        reload();
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"));
  }

  return (
    <div className="grid gap-3">
      <PageHead title="Attrezzatura" lede="Archi, frecce, corde e il resto. Una configurazione si aggancia all'allenamento." />
      {!open ? (
        <Button onClick={() => { setForm(EMPTY); setOpen(true); }}>＋ Aggiungi attrezzatura</Button>
      ) : (
      <Card className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">{form.id ? "Modifica" : "Nuovo pezzo"}</h2>
          <button type="button" className="text-sm text-muted" onClick={() => { setOpen(false); setForm(EMPTY); }}>Chiudi</button>
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" onClick={() => setForm({ ...form, category: c.id })} className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-[11px] ${form.category === c.id ? "border-accent bg-accent/15 text-fg" : "border-line text-muted"}`}>
              <CategoryIcon category={c.id} className="h-7 w-7" />
              <span className="truncate">{c.label}</span>
            </button>
          ))}
        </div>
        <Field label="Nome"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.category === "freccia" ? "Es. Frecce gara 18 m" : form.category === "arco" ? "Es. Il mio olimpico" : ""} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Marca"><TextInput value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
          <Field label="Modello"><TextInput value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
        </div>

        {form.category === "arco" ? (
          <>
            <p className="text-sm font-semibold">Tipo di arco</p>
            <div className="grid grid-cols-3 gap-1.5">
              {BOW_TYPES.map((t) => (
                <button key={t.id} type="button" onClick={() => setSpec("bowType", t.id)} className={`flex flex-col items-center rounded-xl border p-1.5 text-[11px] ${spec("bowType") === t.id ? "border-accent bg-accent/15" : "border-line text-muted"}`}>
                  <BowIcon type={t.id} className="h-12 w-12" />
                  {t.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Libbre"><TextInput inputMode="decimal" value={spec("draw")} onChange={(e) => setSpec("draw", e.target.value)} placeholder="36" /></Field>
              <Field label="Lunghezza ″"><TextInput inputMode="decimal" value={spec("length")} onChange={(e) => setSpec("length", e.target.value)} placeholder="68" /></Field>
              <Field label="Allungo ″"><TextInput inputMode="decimal" value={spec("drawLen")} onChange={(e) => setSpec("drawLen", e.target.value)} placeholder="28" /></Field>
            </div>
          </>
        ) : null}

        {form.category === "freccia" ? (
          <>
            <div className="rounded-xl border border-line bg-elev p-2">
              <ArrowIcon material={spec("material")} shaft={spec("shaft")} fletch={spec("fletch")} cock={spec("cock")} nock={spec("nock")} wrap={spec("wrap")} fletchType={spec("fletchType")} point={spec("pointType") || "ogiva"} number={spec("numFrom") || undefined} className="h-14 w-full" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Quante"><TextInput inputMode="numeric" value={spec("qty")} onChange={(e) => setSpec("qty", e.target.value)} placeholder="12" /></Field>
              <Field label="Numerate da"><TextInput inputMode="numeric" value={spec("numFrom")} onChange={(e) => setSpec("numFrom", e.target.value)} placeholder="1" /></Field>
              <Field label="Spine"><TextInput value={spec("spine")} onChange={(e) => setSpec("spine", e.target.value)} placeholder="600" /></Field>
              <Field label="Lunghezza ″"><TextInput inputMode="decimal" value={spec("length")} onChange={(e) => setSpec("length", e.target.value)} placeholder="29" /></Field>
              <Field label="Punta grani"><TextInput inputMode="numeric" value={spec("point")} onChange={(e) => setSpec("point", e.target.value)} placeholder="100" /></Field>
              <Field label="Peso tot. grani"><TextInput inputMode="numeric" value={spec("weight")} onChange={(e) => setSpec("weight", e.target.value)} placeholder="360" /></Field>
            </div>
            <Chips label="Uso" value={spec("use")} options={ARROW_USE} onPick={(v) => setSpec("use", v)} />
            <Chips label="Materiale" value={spec("material")} options={SHAFT_MATERIALS} onPick={(v) => setSpec("material", v)} />
            <Chips label="Impennaggio" value={spec("fletchType")} options={FLETCH_TYPES} onPick={(v) => setSpec("fletchType", v)} />
            <Chips label="Punta" value={spec("pointType") || "ogiva"} options={POINT_TYPES} onPick={(v) => setSpec("pointType", v)} />
            <Swatches label="Colore asta (vuoto = colore del materiale)" value={spec("shaft")} onPick={(v) => setSpec("shaft", v)} allowNone />
            <Swatches label="Colore penne / alette" value={spec("fletch")} onPick={(v) => setSpec("fletch", v)} />
            <Swatches label="Penna indice (guida)" value={spec("cock")} onPick={(v) => setSpec("cock", v)} />
            <Swatches label="Cocca" value={spec("nock")} onPick={(v) => setSpec("nock", v)} />
            <Swatches label="Fascia (cresting)" value={spec("wrap")} onPick={(v) => setSpec("wrap", v)} allowNone />
          </>
        ) : null}

        {form.category !== "arco" && form.category !== "freccia" ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Libbraggio / peso"><TextInput value={spec("draw")} onChange={(e) => setSpec("draw", e.target.value)} /></Field>
            <Field label="Materiale"><TextInput value={spec("material")} onChange={(e) => setSpec("material", e.target.value)} /></Field>
            <Field label="Lunghezza"><TextInput value={spec("length")} onChange={(e) => setSpec("length", e.target.value)} /></Field>
            <Field label="Taglia"><TextInput value={spec("size")} onChange={(e) => setSpec("size", e.target.value)} /></Field>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Prezzo €"><TextInput inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          <Field label="Negozio"><TextInput value={form.shop} onChange={(e) => setForm({ ...form, shop: e.target.value })} /></Field>
        </div>
        <Field label="Note da ricordare"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="in_use">In uso</option>
          <option value="replace">Da sostituire</option>
          <option value="unused">Non usato</option>
        </Select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.visibility === "group"} onChange={(e) => setForm({ ...form, visibility: e.target.checked ? "group" : "personal" })} /> Inventario del gruppo</label>
        {err ? <ErrorNote text={err} /> : null}
        <Button onClick={save}>{form.id ? "Salva le modifiche" : "Aggiungi"}</Button>
      </Card>
      )}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[{ id: "tutto", label: "Tutto" }, ...CATEGORIES].map((c) => (
          <button key={c.id} type="button" onClick={() => setFilter(c.id)} className={`min-h-9 shrink-0 rounded-full px-3 text-sm ${filter === c.id ? "bg-primary text-primary-fg" : "border border-line"}`}>{c.label}</button>
        ))}
      </div>
      {gear.loading ? <Loading /> : null}
      {items.length === 0 && !gear.loading ? <Empty title="Inventario vuoto" text="Aggiungi almeno l'arco che usi di solito." /> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const sp = item.specs;
          const isArrow = item.category === "freccia";
          const from = Number(sp.numFrom || 1);
          const qty = Number(sp.qty || 0);
          return (
            <Card key={item.id} className="grid gap-2 p-3">
              <div className="flex items-start gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  {item.category === "arco" ? <BowIcon type={sp.bowType || "olimpico"} className="h-12 w-12" /> : <CategoryIcon category={item.category} className="h-8 w-8" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.name}</p>
                  <p className="text-xs text-muted">
                    {item.category === "arco" ? (BOW_TYPES.find((t) => t.id === sp.bowType)?.label ?? "Arco") : categoryLabel(item.category)}
                    {item.brand || item.model ? ` · ${item.brand} ${item.model}` : ""}
                    {sp.draw ? ` · ${sp.draw} lb` : ""}
                  </p>
                  <p className="text-xs text-muted">
                    {item.status === "in_use" ? "in uso" : item.status === "replace" ? "da sostituire" : "fermo"}
                    {item.priceCents != null ? ` · ${euro(item.priceCents)}` : ""}
                    {item.visibility === "group" ? " · gruppo" : ""}
                  </p>
                </div>
              </div>
              {isArrow ? (
                <>
                  <ArrowIcon material={sp.material} shaft={sp.shaft} fletch={sp.fletch} cock={sp.cock} nock={sp.nock} wrap={sp.wrap} fletchType={sp.fletchType} point={sp.pointType} number={qty ? `${from}–${from + qty - 1}` : sp.numFrom} className="h-9 w-full" />
                  <div className="flex flex-wrap gap-1 text-[11px]">
                    {sp.use ? <span className={`rounded-full px-2 py-0.5 ${sp.use === "gara" ? "bg-accent text-accent-fg" : "border border-line"}`}>{ARROW_USE.find((u) => u.id === sp.use)?.label}</span> : null}
                    {sp.material ? <span className="rounded-full border border-line px-2 py-0.5">{SHAFT_MATERIALS.find((m) => m.id === sp.material)?.label ?? sp.material}</span> : null}
                    {sp.spine ? <span className="rounded-full border border-line px-2 py-0.5">spine {sp.spine}</span> : null}
                    {sp.length ? <span className="rounded-full border border-line px-2 py-0.5">{sp.length}″</span> : null}
                    {sp.point ? <span className="rounded-full border border-line px-2 py-0.5">punta {sp.point} gr</span> : null}
                    {qty ? <span className="rounded-full border border-line px-2 py-0.5">{qty} frecce</span> : null}
                  </div>
                </>
              ) : null}
              {item.mine ? (
                <div className="flex gap-3 text-xs">
                  <button type="button" className="font-semibold text-primary" onClick={() => edit(item)}>Modifica</button>
                  <button type="button" className="text-danger" onClick={() => deleteEquipment({ data: { id: item.id } }).then(reload)}>Elimina</button>
                </div>
              ) : null}
            </Card>
          );
        })}
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
      <FlightSim />
    </div>
  );
}

function Chips({ label, value, options, onPick }: { label: string; value: string; options: readonly { id: string; label: string }[]; onPick: (v: string) => void }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.id} type="button" onClick={() => onPick(o.id)} className={`min-h-9 rounded-full px-3 text-sm ${value === o.id ? "bg-accent text-accent-fg" : "border border-line"}`}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function Swatches({ label, value, onPick, allowNone }: { label: string; value: string; onPick: (v: string) => void; allowNone?: boolean }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {allowNone ? <button type="button" onClick={() => onPick("")} className={`h-8 rounded-full border px-2 text-xs ${value ? "border-line" : "border-fg"}`}>nessuna</button> : null}
        {SWATCHES.map((c) => (
          <button key={c} type="button" aria-label={c} onClick={() => onPick(c)} className={`h-8 w-8 rounded-full border-2 ${value === c ? "border-fg" : "border-line"}`} style={{ background: c }} />
        ))}
        <input type="color" value={value || "#ffffff"} onChange={(e) => onPick(e.target.value)} className="h-8 w-10 rounded" aria-label={`${label}: altro colore`} />
      </div>
    </div>
  );
}
