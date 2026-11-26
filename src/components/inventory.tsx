import { useMemo, useState } from "react";
import { listEquipment, listShopping, saveEquipment } from "@/lib/arcieri/club.api";
import { listReceipts } from "@/lib/arcieri/receipts.api";
import { fieldsOf } from "@/lib/arcieri/gear-specs";
import { CATEGORIES, categoryLabel, euro } from "@/lib/arcieri/labels";
import { useLoad } from "@/lib/arcieri/use-load";
import { Card, Empty, ErrorNote, Loading, TextInput } from "@/components/kit";
import { CategoryIcon } from "@/components/gear-icons";
import { Glyph } from "@/components/icons";
import { GearSpecSheet, type GearItem } from "@/components/gear-spec-sheet";
import { MarketForm, emptyDraft, type MarketDraft } from "@/components/market";

type Status = "tutti" | "in_use" | "replace" | "unused";
const STATUS_LABEL: Record<string, string> = { in_use: "In uso", replace: "Da sostituire", unused: "Fermo" };
const STATUS_TONE: Record<string, string> = { in_use: "#2fbf71", replace: "#e5484d", unused: "#8a949c" };
const ORDER = new Map<string, number>(CATEGORIES.map((c, i) => [c.id, i]));

/** «3 mesi fa», «1 anno e 2 mesi fa» */
function ageOf(day: string | null) {
  if (!day) return "";
  const d = new Date(`${day}T12:00:00`);
  const months = Math.floor((Date.now() - d.getTime()) / (30.44 * 86400000));
  if (months < 1) return "questo mese";
  if (months < 12) return `${months} ${months === 1 ? "mese" : "mesi"} fa`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y} ${y === 1 ? "anno" : "anni"}${m ? ` e ${m} ${m === 1 ? "mese" : "mesi"}` : ""} fa`;
}
const dayIt = (day: string | null) => (day ? day.slice(0, 10).split("-").reverse().join("/") : "");

/** pezzi contati: frecce, aste, punte, alette e cocche hanno la quantità nelle specifiche */
const qtyOf = (g: GearItem) => Math.max(1, Number(g.specs.qty) || 1);

function csvOf(items: GearItem[]) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Categoria", "Nome", "Marca", "Modello", "Stato", "Quantità", "Acquistato il", "Prezzo €", "Negozio", "Specifiche", "Note"];
  const rows = items.map((g) => {
    const specs = fieldsOf(g.category)
      .filter((f) => g.specs[f.key])
      .map((f) => `${f.label}: ${g.specs[f.key]}${f.unit ? ` ${f.unit}` : ""}`)
      .join("; ");
    return [categoryLabel(g.category), g.name, g.brand, g.model, STATUS_LABEL[g.status] ?? g.status, qtyOf(g), dayIt(g.purchasedOn), g.priceCents != null ? (g.priceCents / 100).toFixed(2).replace(".", ",") : "", g.shop, specs, g.notes].map(q).join(";");
  });
  return `﻿${[head.map(q).join(";"), ...rows].join("\r\n")}`;
}

/**
 * Inventario completo: tutto quello che hai inserito in attrezzatura o comprato, per categoria, con
 * età, prezzo, stato e specifiche; le spese non ancora in attrezzatura; un file da scaricare.
 */
export function Inventory() {
  const [nonce, setNonce] = useState(0);
  const gear = useLoad(`inv-gear-${nonce}`, () => listEquipment());
  const shop = useLoad(`inv-shop-${nonce}`, () => listShopping());
  const receipts = useLoad(`inv-rec-${nonce}`, () => listReceipts());
  const [status, setStatus] = useState<Status>("tutti");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [specOf, setSpecOf] = useState<GearItem | null>(null);
  // mettere in vendita un pezzo (e quanti) nel Mercatino della compagnia
  const [sell, setSell] = useState<MarketDraft | null>(null);
  const [sold, setSold] = useState("");
  const sellOf = (g: GearItem): MarketDraft => {
    const specs = fieldsOf(g.category)
      .filter((f) => g.specs[f.key])
      .map((f) => `${f.label}: ${f.options?.find((o) => o.id === g.specs[f.key])?.label ?? g.specs[f.key]}${f.unit && !f.options ? ` ${f.unit}` : ""}`);
    const words = new Set<string>();
    const title = [g.brand, g.model, g.name]
      .filter(Boolean)
      .join(" ")
      .split(/\s+/)
      .filter((w) => (words.has(w.toLowerCase()) ? false : (words.add(w.toLowerCase()), true)))
      .join(" ");
    return {
      ...emptyDraft(),
      equipmentId: g.id,
      maxQty: qtyOf(g),
      category: g.category,
      title,
      description: [specs.join("\n"), g.purchasedOn ? `Comprato a ${new Date(`${g.purchasedOn}T12:00:00`).toLocaleDateString("it-IT", { month: "long", year: "numeric" })}.` : ""].filter(Boolean).join("\n"),
      photos: g.photoUrl && g.photoUrl.startsWith("data:image/") ? [{ src: g.photoUrl }] : [],
    };
  };
  const [err, setErr] = useState("");
  const reload = () => setNonce((n) => n + 1);

  const mine = useMemo(() => (gear.data ?? []).filter((g) => g.mine), [gear.data]);
  const shown = mine.filter((g) => (status === "tutti" || g.status === status) && (!q.trim() || `${g.name} ${g.brand} ${g.model} ${categoryLabel(g.category)}`.toLowerCase().includes(q.trim().toLowerCase())));
  const groups = Array.from(new Set<string>(shown.map((g) => String(g.category)))).sort((a, b) => (ORDER.get(a) ?? 99) - (ORDER.get(b) ?? 99));
  const value = mine.reduce((t, g) => t + (g.priceCents ?? 0), 0);
  const year = String(new Date().getFullYear());
  const bought = (shop.data ?? []).filter((s) => s.status === "bought");
  const spentYear = (receipts.data ?? []).filter((r) => (r.day ?? "").startsWith(year)).reduce((t, r) => t + (r.totalCents ?? 0), 0);
  const saved = (receipts.data ?? []).reduce((t, r) => t + (r.discountCents ?? 0), 0);
  // spese prese ma non ancora in attrezzatura (stesso nome)
  const names = new Set(mine.map((g) => g.name.trim().toLowerCase()));
  const loose = bought.filter((s) => s.category !== "altro" && !names.has(s.name.trim().toLowerCase()));
  const missing = (g: GearItem) => fieldsOf(g.category).filter((f) => !g.specs[f.key] && f.key !== "material" && f.key !== "size").map((f) => f.label.toLowerCase());

  const setItemStatus = (g: GearItem, next: string) =>
    saveEquipment({ data: { id: g.id, category: g.category, name: g.name, brand: g.brand, model: g.model, status: next, visibility: g.visibility, priceCents: g.priceCents, shop: g.shop, notes: g.notes, purchasedOn: g.purchasedOn, photoUrl: g.photoUrl, specs: g.specs } })
      .then(reload)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"));

  const toGear = (s: (typeof loose)[number]) =>
    saveEquipment({ data: { id: null, category: s.category, name: s.name, status: "in_use", visibility: "personal", priceCents: s.priceCents != null ? s.priceCents * (s.qty || 1) : null, notes: "", shop: "", purchasedOn: null, specs: { ...(["freccia", "aste", "punte", "alette", "cocche"].includes(s.category) ? { qty: String(Math.max(1, s.qty || 1)) } : {}), ...(s.notes ? { purchase: s.notes } : {}) } } })
      .then(reload)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"));

  const download = () => {
    const blob = new Blob([csvOf(mine)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inventario-arco-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Pezzi" value={String(mine.length)} sub={`${mine.reduce((t, g) => t + qtyOf(g), 0)} contando frecce e ricambi`} tone="#7cc4ff" />
        <Kpi label="Valore" value={euro(value) || "0 €"} sub="quello che hai pagato" tone="#e6b325" />
        <Kpi label={`Spesi nel ${year}`} value={euro(spentYear) || "0 €"} sub={`${(receipts.data ?? []).length} ${(receipts.data ?? []).length === 1 ? "scontrino" : "scontrini"}`} tone="#2fbf71" />
        <Kpi label="Risparmiati" value={euro(saved) || "0 €"} sub="con gli sconti degli scontrini" tone="#b28cff" />
      </div>

      <div className="flex items-center gap-2">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nell'inventario" aria-label="Cerca nell'inventario" />
        <button type="button" onClick={download} disabled={!mine.length} className="aa-press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold">
          <Glyph name="download" size={16} /> CSV
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white/[0.05] p-1">
        {(["tutti", "in_use", "replace", "unused"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={`min-h-10 rounded-xl text-[0.72rem] font-semibold ${status === s ? "bg-elev shadow" : "text-muted"}`}>
            {s === "tutti" ? "Tutto" : STATUS_LABEL[s]}
            <span className="ml-1 tabular-nums opacity-70">{s === "tutti" ? mine.length : mine.filter((g) => g.status === s).length}</span>
          </button>
        ))}
      </div>

      {gear.loading && !gear.data ? <Loading /> : null}
      {gear.error ? <ErrorNote text={gear.error} /> : null}
      {err ? <ErrorNote text={err} /> : null}
      {!gear.loading && !mine.length ? <Empty title="Inventario vuoto" text="Aggiungi i pezzi in Attrezzatura o salva uno scontrino in Acquisti: qui li trovi tutti." /> : null}

      {groups.map((cat) => {
        const list = shown.filter((g) => g.category === cat).sort((a, b) => (b.purchasedOn ?? "").localeCompare(a.purchasedOn ?? ""));
        const isOpen = open === cat || groups.length <= 2 || Boolean(q.trim());
        const tot = list.reduce((t, g) => t + (g.priceCents ?? 0), 0);
        return (
          <Card key={cat} className="grid gap-2 p-3">
            <button type="button" onClick={() => setOpen(open === cat ? null : cat)} className="flex items-center gap-3 text-left" aria-expanded={isOpen}>
              <CategoryIcon category={cat} className="h-12 w-12 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{categoryLabel(cat)}</span>
                <span className="block text-xs text-muted">
                  {list.length} {list.length === 1 ? "pezzo" : "pezzi"}
                  {list.some((g) => g.specs.qty) ? ` · ${list.reduce((t, g) => t + qtyOf(g), 0)} in tutto` : ""}
                  {tot ? ` · ${euro(tot)}` : ""}
                </span>
              </span>
              <Glyph name="chevron" size={16} className={`text-muted transition-transform ${isOpen ? "rotate-90" : ""}`} />
            </button>
            {isOpen
              ? list.map((g) => {
                  const chips = fieldsOf(g.category).filter((f) => g.specs[f.key]);
                  const miss = missing(g);
                  return (
                    <div key={g.id} className="grid gap-1.5 rounded-2xl bg-white/[0.04] p-2.5">
                      <div className="flex items-start gap-2">
                        {g.photoUrl?.startsWith("data:image/") ? <img src={g.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain" /> : null}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {g.name}
                            {g.specs.qty && Number(g.specs.qty) > 1 ? <span className="text-muted"> × {g.specs.qty}</span> : null}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {[g.brand, g.model].filter(Boolean).join(" ") || "marca e modello da aggiungere"}
                            {g.shop ? ` · ${g.shop}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-right">
                          <b className="block font-display text-base tabular-nums">{g.priceCents != null ? euro(g.priceCents) : "—"}</b>
                          <span className="block text-[0.65rem] text-muted">{g.purchasedOn ? `${dayIt(g.purchasedOn)} · ${ageOf(g.purchasedOn)}` : "data da aggiungere"}</span>
                        </span>
                      </div>
                      {chips.length ? (
                        <div className="flex flex-wrap gap-1 text-[0.68rem]">
                          {chips.map((f) => (
                            <span key={f.key} className="rounded-full border border-line px-2 py-0.5">
                              {f.label.toLowerCase()} {f.options?.find((o) => o.id === g.specs[f.key])?.label ?? g.specs[f.key]}
                              {f.unit && !f.options ? ` ${f.unit}` : ""}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(["in_use", "replace", "unused"] as const).map((s) => (
                          <button key={s} type="button" onClick={() => (g.status === s ? undefined : void setItemStatus(g, s))} aria-pressed={g.status === s} className={`min-h-8 rounded-full px-2.5 text-[0.68rem] font-semibold ${g.status === s ? "text-[#0b120e]" : "border border-line text-muted"}`} style={g.status === s ? { background: STATUS_TONE[s] } : undefined}>
                            {STATUS_LABEL[s]}
                          </button>
                        ))}
                        <button type="button" onClick={() => setSell(sellOf(g))} className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-full border border-line px-3 text-[0.7rem] font-semibold">
                          <Glyph name="bag" size={12} /> Vendi
                        </button>
                        <button type="button" onClick={() => setSpecOf(g)} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-primary/20 px-3 text-[0.7rem] font-semibold">
                          <Glyph name="search" size={12} /> Specifiche
                        </button>
                      </div>
                      {miss.length ? <p className="text-[0.66rem] text-muted">Mancano: {miss.slice(0, 4).join(", ")}</p> : null}
                    </div>
                  );
                })
              : null}
          </Card>
        );
      })}

      {loose.length ? (
        <Card className="grid gap-2 p-3">
          <p className="aa-section-title">Comprati ma non in attrezzatura</p>
          <p className="-mt-1 text-xs text-muted">Dagli scontrini e dalla lista della spesa: mettili in attrezzatura per contarli nell'inventario.</p>
          {loose.slice(0, 20).map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-2xl bg-white/[0.04] p-2">
              <CategoryIcon category={s.category} className="h-11 w-11 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{s.name}{s.qty > 1 ? ` × ${s.qty}` : ""}</span>
                <span className="block truncate text-xs text-muted">{categoryLabel(s.category)}{s.priceCents != null ? ` · ${euro(s.priceCents * (s.qty || 1))}` : ""}</span>
              </span>
              <button type="button" onClick={() => void toGear(s)} className="min-h-9 shrink-0 rounded-full border border-line px-3 text-xs font-semibold">In attrezzatura</button>
            </div>
          ))}
        </Card>
      ) : null}

      {sold ? <p className="text-sm font-semibold text-accent">{sold}</p> : null}
      {sell ? <MarketForm start={sell} onClose={() => setSell(null)} onSaved={() => { setSell(null); setSold("Annuncio pubblicato nel Mercatino della compagnia (Compagnia → Mercatino)."); }} /> : null}
      {specOf ? <GearSpecSheet item={mine.find((g) => g.id === specOf.id) ?? specOf} gear={gear.data ?? []} onClose={() => setSpecOf(null)} onSaved={reload} /> : null}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <span className="rounded-2xl border border-line bg-white/[0.04] px-3 py-2">
      <span className="block text-[0.62rem] uppercase tracking-wider text-muted">{label}</span>
      <b className="block font-display text-xl tabular-nums" style={{ color: tone }}>{value}</b>
      <span className="block truncate text-[0.66rem] text-muted">{sub}</span>
    </span>
  );
}
