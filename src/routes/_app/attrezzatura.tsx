import { useState } from "react";
import { ConvertButton } from "@/components/unit-converter";
import { createFileRoute, Link } from "@tanstack/react-router";
import { deleteEquipment, deleteSetup, gearStats, listEquipment, listSetups, saveEquipment, saveSetup } from "@/lib/arcieri/club.api";
import { arrowAdvice, bowAdvice } from "@/lib/arcieri/gear-advice";
import { AppIcon, Glyph } from "@/components/icons";
import { CATEGORIES, categoryLabel, euro, parseEuro } from "@/lib/arcieri/labels";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHead, Select, TextArea, TextInput } from "@/components/kit";
import { ARROW_USE, BOW_LENGTHS, BOW_TYPES, FLETCH_TYPES, LIMB_COLORS, POINT_TYPES, RISER_COLORS, SHAFT_MATERIALS, SWATCHES, ArrowIcon, BowIcon, CategoryIcon } from "@/components/gear-icons";
import { ARROW_MODELS, FLETCH_STYLES } from "@/components/arrow-art";
import { MainGearCard } from "@/components/main-gear";
import { ArrowWeights, SpineField } from "@/components/arrow-weights";
import { GRAINS_PER_G, spineLb, spineUnitOf, spineLabel, weightInfo, weightLabel } from "@/lib/arcieri/arrow-spec";

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
  const stats = useLoad(`gs-${nonce}`, () => gearStats());
  const statOf = (id: number) => (stats.data ?? []).find((x) => x.id === id);
  const mainBow = (gear.data ?? []).find((g) => g.mine && g.category === "arco" && g.status === "in_use") ?? (gear.data ?? []).find((g) => g.mine && g.category === "arco") ?? null;
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
    // peso: si scrive in grammi; i grani (usati da FOC, simulatore e consigli) si ricavano da lì
    const specsOut: Record<string, string> = { ...form.specs, string: form.category === "corda" ? spec("material") : spec("string") };
    if (form.category === "freccia") {
      const mode = specsOut.weightMode || "uguale";
      if (mode !== "singole") delete specsOut.arrowsG;
      if (mode !== "fascia") {
        delete specsOut.weightMinG;
        delete specsOut.weightMaxG;
      }
      const w = weightInfo(specsOut);
      if (w) {
        specsOut.weightG = String(Math.round(w.avgG * 10) / 10);
        specsOut.weight = String(Math.round(w.avgG * GRAINS_PER_G));
      }
      if (specsOut.spine && !specsOut.spineUnit) specsOut.spineUnit = spineUnitOf(specsOut.spine);
      const lb = spineLb(specsOut.spine, specsOut.spineUnit, specsOut.material);
      if (lb) specsOut.spineLb = String(Math.round(lb));
      else delete specsOut.spineLb;
    }
    saveEquipment({ data: { ...form, priceCents: parseEuro(form.price), specs: specsOut } })
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
      <MainGearCard />
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
            <div className="grid place-items-center rounded-xl border border-line bg-elev p-2">
              <BowIcon type={spec("bowType") || "olimpico"} riser={spec("riser")} limbs={spec("limbs")} className="h-28 w-28" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Libbre"><span className="flex items-center gap-1.5"><TextInput inputMode="decimal" value={spec("draw")} onChange={(e) => setSpec("draw", e.target.value)} placeholder="36" /><ConvertButton unit="lb" value={spec("draw")} onUse={(v) => setSpec("draw", v)} className="h-11 min-w-9" /></span></Field>
              <Field label="Lunghezza ″"><span className="flex items-center gap-1.5"><TextInput inputMode="decimal" value={spec("length")} onChange={(e) => setSpec("length", e.target.value)} placeholder="68" /><ConvertButton unit="pollici" value={spec("length")} onUse={(v) => setSpec("length", v)} className="h-11 min-w-9" /></span></Field>
              <Field label="Allungo ″"><span className="flex items-center gap-1.5"><TextInput inputMode="decimal" value={spec("drawLen")} onChange={(e) => setSpec("drawLen", e.target.value)} placeholder="28" /><ConvertButton unit="pollici" value={spec("drawLen")} onUse={(v) => setSpec("drawLen", v)} className="h-11 min-w-9" /></span></Field>
            </div>
            <div className="grid gap-1">
              <span className="text-xs text-muted">Lunghezze tipiche per questo arco</span>
              <div className="flex flex-wrap gap-1.5">
                {(BOW_LENGTHS[spec("bowType") || "olimpico"] ?? []).map((l) => (
                  <button key={l} type="button" aria-pressed={spec("length") === String(l)} className="aa-chip" onClick={() => setSpec("length", String(l))}>{l}″</button>
                ))}
              </div>
            </div>
            <ColorRow label="Colore del riser (impugnatura)" value={spec("riser")} colors={RISER_COLORS} onPick={(v) => setSpec("riser", v)} />
            <ColorRow label="Colore dei flettenti" value={spec("limbs")} colors={LIMB_COLORS} onPick={(v) => setSpec("limbs", v)} />
          </>
        ) : null}

        {form.category === "freccia" ? (
          <>
            <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-muted">Ogni scheda è una <b className="text-fg">serie di frecce</b>: se ne hai più di una (per esempio penne rosse per l'indoor e gialle per l'outdoor) crea una scheda per serie, con nome e colori. Quando dai il numero a una freccia sul bersaglio scegli prima la serie, poi il numero.</p>
            <div className="rounded-xl border border-line bg-elev p-2">
              <ArrowIcon material={spec("material")} shaft={spec("shaft")} fletch={spec("fletch")} cock={spec("cock")} nock={spec("nock")} wrap={spec("wrap")} fletchType={spec("fletchType")} fletchStyle={spec("fletchStyle")} fletch2={spec("fletch2")} point={spec("pointType") || "ogiva"} number={spec("numFrom") || undefined} className="h-14 w-full" />
            </div>
            <div className="grid gap-1">
              <span className="text-xs text-muted">Modelli pronti (poi puoi cambiare ogni dettaglio)</span>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {ARROW_MODELS.map((m) => (
                  <button key={m.id} type="button" onClick={() => setForm((f) => ({ ...f, specs: { ...f.specs, ...m.specs } }))} className="grid w-36 shrink-0 gap-1 rounded-xl border border-line bg-white/[0.03] p-1.5 text-left">
                    <ArrowIcon {...m.specs} point={m.specs.pointType} className="h-6 w-full" />
                    <span className="text-[0.72rem] font-semibold leading-tight">{m.label}</span>
                    <span className="text-[0.62rem] leading-tight text-muted">{m.note}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Quante"><TextInput inputMode="numeric" value={spec("qty")} onChange={(e) => setSpec("qty", e.target.value)} placeholder="12" /></Field>
              <Field label="Numerate da"><TextInput inputMode="numeric" value={spec("numFrom")} onChange={(e) => setSpec("numFrom", e.target.value)} placeholder="1" /></Field>
              <Field label="Lunghezza ″"><span className="flex items-center gap-1.5"><TextInput inputMode="decimal" value={spec("length")} onChange={(e) => setSpec("length", e.target.value)} placeholder="29" /><ConvertButton unit="pollici" value={spec("length")} onUse={(v) => setSpec("length", v)} className="h-11 min-w-9" /></span></Field>
              <Field label="Punta grani"><span className="flex items-center gap-1.5"><TextInput inputMode="numeric" value={spec("point")} onChange={(e) => setSpec("point", e.target.value)} placeholder="100" /><ConvertButton unit="grani" value={spec("point")} onUse={(v) => setSpec("point", v)} className="h-11 min-w-9" /></span></Field>
            </div>
            <SpineField specs={form.specs} set={setSpec} />
            <ArrowWeights specs={form.specs} set={setSpec} />
            <Chips label="Uso" value={spec("use")} options={ARROW_USE} onPick={(v) => setSpec("use", v)} />
            <Chips label="Materiale" value={spec("material")} options={SHAFT_MATERIALS} onPick={(v) => setSpec("material", v)} />
            <Chips label="Impennaggio" value={spec("fletchType")} options={FLETCH_TYPES} onPick={(v) => setSpec("fletchType", v)} />
            <Chips label="Stile delle penne" value={spec("fletchStyle") || "pieno"} options={FLETCH_STYLES} onPick={(v) => setSpec("fletchStyle", v)} />
            <Chips label="Punta" value={spec("pointType") || "ogiva"} options={POINT_TYPES} onPick={(v) => setSpec("pointType", v)} />
            <Swatches label="Colore asta (vuoto = colore del materiale)" value={spec("shaft")} onPick={(v) => setSpec("shaft", v)} allowNone />
            <Swatches label="Colore penne / alette" value={spec("fletch")} onPick={(v) => setSpec("fletch", v)} />
            {spec("fletchStyle") && spec("fletchStyle") !== "pieno" && spec("fletchStyle") !== "elicoidale" ? <Swatches label="Secondo colore delle penne" value={spec("fletch2")} onPick={(v) => setSpec("fletch2", v)} /> : null}
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
        {form.category === "arco" || form.category === "freccia" ? (
          <Advice lines={form.category === "arco" ? bowAdvice(form.specs) : arrowAdvice(form.specs, mainBow?.specs)} />
        ) : null}
        {err ? <ErrorNote text={err} /> : null}
        <Button onClick={save}>{form.id ? "Salva le modifiche" : "Aggiungi"}</Button>
      </Card>
      )}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[{ id: "tutto", label: "Tutto" }, ...CATEGORIES].map((c) => (
          <button key={c.id} type="button" onClick={() => setFilter(c.id)} className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-sm ${filter === c.id ? "bg-primary text-primary-fg" : "border border-line"}`}>
            {c.id === "tutto" ? <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs font-bold">∗</span> : <CategoryIcon category={c.id} className="h-7 w-7" />}
            {c.label}
          </button>
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
                  {item.category === "arco" ? <BowIcon type={sp.bowType || "olimpico"} riser={sp.riser} limbs={sp.limbs} className="h-12 w-12" /> : <CategoryIcon category={item.category} className="h-8 w-8" />}
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
                  <ArrowIcon material={sp.material} shaft={sp.shaft} fletch={sp.fletch} cock={sp.cock} nock={sp.nock} wrap={sp.wrap} fletchType={sp.fletchType} fletchStyle={sp.fletchStyle} fletch2={sp.fletch2} point={sp.pointType} number={qty ? `${from}–${from + qty - 1}` : sp.numFrom} className="h-9 w-full" />
                  <div className="flex flex-wrap gap-1 text-[11px]">
                    {sp.use ? <span className={`rounded-full px-2 py-0.5 ${sp.use === "gara" ? "bg-accent text-accent-fg" : "border border-line"}`}>{ARROW_USE.find((u) => u.id === sp.use)?.label}</span> : null}
                    {sp.material ? <span className="rounded-full border border-line px-2 py-0.5">{SHAFT_MATERIALS.find((m) => m.id === sp.material)?.label ?? sp.material}</span> : null}
                    {sp.spine ? <span className="rounded-full border border-line px-2 py-0.5">spine {spineLabel(sp)}</span> : null}
                    {weightInfo(sp) ? <span className="rounded-full border border-line px-2 py-0.5 tabular-nums">{weightLabel(weightInfo(sp))}</span> : null}
                    {sp.race ? <span className="rounded-full bg-accent/20 px-2 py-0.5">★ gara: {sp.race.split(",").join(", ")}</span> : null}
                    {sp.length ? <span className="rounded-full border border-line px-2 py-0.5">{sp.length}″</span> : null}
                    {sp.point ? <span className="rounded-full border border-line px-2 py-0.5">punta {sp.point} gr</span> : null}
                    {qty ? <span className="rounded-full border border-line px-2 py-0.5">{qty} frecce</span> : null}
                  </div>
                </>
              ) : null}
              {(() => {
                const st = statOf(item.id);
                return st && st.arrows ? (
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <span className="rounded-lg bg-white/[0.05] px-1 py-1"><b className="block font-display text-base tabular-nums">{st.arrows.toLocaleString("it-IT")}</b><span className="text-[0.6rem] uppercase tracking-wider text-muted">frecce</span></span>
                    <span className="rounded-lg bg-white/[0.05] px-1 py-1"><b className="block font-display text-base tabular-nums">{st.avg.toFixed(2).replace(".", ",")}</b><span className="text-[0.6rem] uppercase tracking-wider text-muted">media</span></span>
                    <span className="rounded-lg bg-white/[0.05] px-1 py-1"><b className="block font-display text-base tabular-nums">{st.sessions}</b><span className="text-[0.6rem] uppercase tracking-wider text-muted">uscite</span></span>
                  </div>
                ) : item.mine && (item.category === "arco" || item.category === "freccia") ? (
                  <p className="text-[0.7rem] text-muted">Statistiche dopo il primo allenamento con una configurazione che lo usa.</p>
                ) : null;
              })()}
              {item.mine && (item.category === "arco" || item.category === "freccia") ? (
                <Advice compact lines={item.category === "arco" ? bowAdvice(sp) : arrowAdvice(sp, mainBow && mainBow.id !== item.id ? mainBow.specs : null)} />
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
      <Link to="/balistica" className="aa-press flex items-center gap-3 rounded-[var(--radius-card)] border border-hair bg-white/[0.04] p-3">
        <AppIcon name="ballistics" color="#cc4f3b" size={44} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Balistica con la tua attrezzatura</span>
          <span className="block text-[0.72rem] text-muted">Composizioni pronte e dai tuoi archi e frecce, parabola e dove mirare.</span>
        </span>
        <Glyph name="chevron" size={16} className="text-muted" />
      </Link>
    </div>
  );
}

function Advice({ lines, compact = false }: { lines: string[]; compact?: boolean }) {
  if (!lines.length) return null;
  return (
    <div className={`grid gap-1 rounded-xl border border-[#7cf0a8]/25 bg-[#7cf0a8]/[0.05] ${compact ? "p-2" : "p-2.5"}`}>
      <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#7cf0a8]"><Glyph name="sparkle" size={13} />Consiglio</p>
      {(compact ? lines.slice(0, 2) : lines).map((l) => <p key={l} className="text-[0.76rem] leading-snug">{l}</p>)}
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

function ColorRow({ label, value, colors, onPick }: { label: string; value: string; colors: string[]; onPick: (v: string) => void }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={!value} onClick={() => onPick("")} className={`h-8 rounded-full border px-2 text-[0.7rem] ${!value ? "border-accent" : "border-line"}`}>originale</button>
        {colors.map((c) => (
          <button key={c} type="button" aria-label={c} aria-pressed={value === c} onClick={() => onPick(c)} className={`h-8 w-8 rounded-full border-2 ${value === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}
