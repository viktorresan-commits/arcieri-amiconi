import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { deleteShopping, listEquipment, listShopping, saveEquipment, saveShopping } from "@/lib/arcieri/club.api";
import { CATEGORIES, categoryLabel, euro, parseEuro } from "@/lib/arcieri/labels";
import { useLoad } from "@/lib/arcieri/use-load";
import { useArcherSetup } from "@/lib/arcieri/setup";
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHead, TextInput } from "@/components/kit";
import { CategoryIcon } from "@/components/gear-icons";
import { Glyph } from "@/components/icons";
import { ReceiptsCard } from "@/components/receipt-import";
import { ClubSpend } from "@/components/club-spend";

export const Route = createFileRoute("/_app/acquisti")({ component: Page });

type Status = "todo" | "ordered" | "bought";
const STATUS: { id: Status; label: string; tone: string }[] = [
  { id: "todo", label: "Da comprare", tone: "#e6b325" },
  { id: "ordered", label: "Ordinato", tone: "#5aa6e8" },
  { id: "bought", label: "Preso", tone: "#3d9b74" },
];
const PRIORITY: { id: string; label: string; tone: string }[] = [
  { id: "alta", label: "Urgente", tone: "#d63a2f" },
  { id: "normal", label: "Normale", tone: "#9aa3ab" },
  { id: "bassa", label: "Quando capita", tone: "#5b6670" },
];
const EMPTY = { name: "", category: "freccia", qty: "1", price: "", url: "", priority: "normal", notes: "", sizeLabel: "", visibility: "personal" };

/**
 * Lista della spesa dell'arciere: con le stesse icone dell'attrezzatura, totale da spendere,
 * stato a un tocco, suggerimenti dai pezzi da sostituire e dal tuo arco; quello che prendi passa
 * in attrezzatura con un tocco.
 */
function Page() {
  const [nonce, setNonce] = useState(0);
  const [view, setView] = useState<Status | "tutti">("todo");
  const [cat, setCat] = useState("tutte");
  const [adding, setAdding] = useState(false);
  const { data, error, loading } = useLoad(`shop-${nonce}`, () => listShopping());
  const gear = useLoad(`shop-gear-${nonce}`, () => listEquipment());
  const setup = useArcherSetup();
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState("");
  const [moved, setMoved] = useState<number[]>([]);
  const all = data ?? [];
  const reload = () => setNonce((n) => n + 1);
  const rows = all.filter((r) => (view === "tutti" || r.status === view) && (cat === "tutte" || r.category === cat));
  const open = all.filter((r) => r.status !== "bought");
  const toSpend = open.reduce((t, r) => t + (r.priceCents ?? 0) * (r.qty ?? 1), 0);
  const spent = all.filter((r) => r.status === "bought").reduce((t, r) => t + (r.priceCents ?? 0) * (r.qty ?? 1), 0);
  const cats = [...new Set(all.map((r) => r.category))];
  const wear = form.category === "abbigliamento" || form.category === "scarpe";

  // suggerimenti: pezzi segnati "da sostituire" e frecce adatte al tuo arco
  const names = new Set(all.map((r) => r.name.toLowerCase()));
  const replace = (gear.data ?? []).filter((g) => g.mine && g.status === "replace" && !names.has(`nuovo ${g.name}`.toLowerCase()));
  const arrowIdea = setup.has && setup.grains ? `Frecce spine ${setup.spineRange.split(" (")[0]} · ${(((setup.grains.min + setup.grains.max) / 2) / 15.4324).toFixed(0)} g · ${(setup.drawIn + 1).toFixed(0)}″` : "";

  const add = (item: typeof EMPTY) =>
    saveShopping({ data: { ...item, qty: Number(item.qty) || 1, priceCents: parseEuro(item.price), status: "todo" } })
      .then(() => {
        setForm(EMPTY);
        setAdding(false);
        setErr("");
        reload();
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"));

  return (
    <div className="grid gap-3">
      <PageHead title="Acquisti" lede="La tua lista e gli scontrini: gli altri non li vedono." />

      <div className="grid grid-cols-3 gap-2">
        <Kpi k="Da spendere" v={euro(toSpend) || "0 €"} tone="#e6b325" />
        <Kpi k="Aperti" v={String(open.length)} tone="#5aa6e8" />
        <Kpi k="Già spesi" v={euro(spent) || "0 €"} tone="#3d9b74" />
      </div>

      {/* scontrini e fatture: dalla foto alla spesa fatta, e i pezzi in attrezzatura */}
      <ReceiptsCard onSaved={reload} />

      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white/[0.05] p-1">
        {[...STATUS.map((s) => ({ id: s.id, label: s.label })), { id: "tutti" as const, label: "Tutti" }].map((s) => (
          <button key={s.id} type="button" onClick={() => setView(s.id)} className={`min-h-10 rounded-xl text-[0.72rem] font-semibold ${view === s.id ? "bg-elev shadow" : "text-muted"}`}>
            {s.label}
            <span className="ml-1 tabular-nums opacity-70">{s.id === "tutti" ? all.length : all.filter((r) => r.status === s.id).length}</span>
          </button>
        ))}
      </div>

      {cats.length > 1 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          <button type="button" onClick={() => setCat("tutte")} className={`flex min-h-10 shrink-0 items-center rounded-full px-3 text-sm ${cat === "tutte" ? "bg-primary text-primary-fg" : "border border-line"}`}>Tutte</button>
          {cats.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-sm ${cat === c ? "bg-primary text-primary-fg" : "border border-line"}`}>
              <CategoryIcon category={c} className="h-7 w-7" />
              {categoryLabel(c)}
            </button>
          ))}
        </div>
      ) : null}

      {replace.length || arrowIdea ? (
        <Card className="grid gap-2">
          <p className="aa-section-title">Suggeriti</p>
          {arrowIdea ? (
            <SuggestRow category="freccia" title={arrowIdea} sub={`Adatte al tuo ${setup.summary}`} onAdd={() => add({ ...EMPTY, name: arrowIdea, category: "freccia", qty: "12", notes: `Per ${setup.summary}` })} />
          ) : null}
          {replace.map((g) => (
            <SuggestRow key={g.id} category={g.category} title={`Nuovo ${g.name}`} sub="Segnato da sostituire in attrezzatura" onAdd={() => add({ ...EMPTY, name: `Nuovo ${g.name}`, category: g.category, notes: g.brand || g.model ? `${g.brand} ${g.model}`.trim() : "" })} />
          ))}
        </Card>
      ) : null}

      {adding ? (
        <Card className="grid gap-3">
          <div className="flex items-center justify-between">
            <p className="aa-section-title">Cosa ti serve</p>
            <button type="button" aria-label="Chiudi" onClick={() => setAdding(false)} className="grid h-9 w-9 place-items-center rounded-full border border-line"><Glyph name="close" size={16} /></button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" onClick={() => setForm({ ...form, category: c.id })} className={`grid justify-items-center gap-0.5 rounded-xl border p-1.5 text-[0.62rem] leading-tight ${form.category === c.id ? "border-primary bg-primary/15" : "border-line"}`}>
                <CategoryIcon category={c.id} className="h-10 w-10" />
                <span className="line-clamp-2 text-center">{c.label}</span>
              </button>
            ))}
          </div>
          <Field label="Prodotto"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Es. Punte 100 gr, corda, parabraccio…" /></Field>
          <div className="grid grid-cols-[auto_1fr] items-end gap-2">
            <div className="grid gap-1">
              <span className="text-xs text-muted">Quantità</span>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Meno" onClick={() => setForm({ ...form, qty: String(Math.max(1, (Number(form.qty) || 1) - 1)) })} className="grid h-11 w-11 place-items-center rounded-xl border border-line text-lg">−</button>
                <span className="w-8 text-center font-display text-xl tabular-nums">{form.qty}</span>
                <button type="button" aria-label="Più" onClick={() => setForm({ ...form, qty: String(Math.min(99, (Number(form.qty) || 1) + 1)) })} className="grid h-11 w-11 place-items-center rounded-xl border border-line text-lg">+</button>
              </div>
            </div>
            <Field label="Prezzo €"><TextInput inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0,00" /></Field>
          </div>
          {wear ? <Field label="Taglia"><TextInput value={form.sizeLabel} onChange={(e) => setForm({ ...form, sizeLabel: e.target.value })} placeholder="M, 42…" /></Field> : null}
          <Field label="Link del negozio"><TextInput value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" /></Field>
          <div className="grid grid-cols-3 gap-1.5">
            {PRIORITY.map((p) => (
              <button key={p.id} type="button" onClick={() => setForm({ ...form, priority: p.id })} className={`min-h-10 rounded-xl text-xs font-semibold ${form.priority === p.id ? "text-white" : "border border-line"}`} style={form.priority === p.id ? { background: p.tone } : undefined}>{p.label}</button>
            ))}
          </div>
          {err ? <ErrorNote text={err} /> : null}
          <Button onClick={() => add(form)}>Aggiungi alla lista</Button>
        </Card>
      ) : (
        <Button onClick={() => setAdding(true)}><Glyph name="plus" size={18} /> Aggiungi alla lista</Button>
      )}

      {loading ? <Loading /> : null}
      {error ? <ErrorNote text={error} /> : null}
      {rows.length === 0 && !loading ? <Empty title={view === "bought" ? "Ancora niente di preso" : "Lista vuota"} text="Metti qui quello che manca, non quello che hai già in attrezzatura." /> : null}

      {rows.map((item) => {
        const pr = PRIORITY.find((p) => p.id === item.priority) ?? PRIORITY[1];
        const isMoved = moved.includes(item.id);
        return (
          <Card key={item.id} className="grid gap-2.5 p-3">
            <div className="flex items-start gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/[0.05]"><CategoryIcon category={item.category} className="h-12 w-12" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{item.name}{item.qty > 1 ? <span className="text-muted"> × {item.qty}</span> : null}</p>
                <p className="mt-0.5 text-xs text-muted">{categoryLabel(item.category)}{item.sizeLabel ? ` · taglia ${item.sizeLabel}` : ""}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full px-2 py-0.5 text-[0.65rem] font-semibold text-white" style={{ background: pr.tone }}>{pr.label}</span>
                  {item.priceCents ? <span className="font-display text-base tabular-nums">{euro(item.priceCents * (item.qty || 1))}</span> : null}
                </div>
              </div>
              {item.mine ? <button type="button" aria-label="Elimina" onClick={() => deleteShopping({ data: { id: item.id } }).then(reload)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-danger"><Glyph name="trash" size={17} /></button> : null}
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/[0.04] p-1">
              {STATUS.map((s) => (
                <button key={s.id} type="button" onClick={() => saveShopping({ data: { ...item, priceCents: item.priceCents, status: s.id } }).then(reload)} className={`min-h-9 rounded-lg text-[0.72rem] font-semibold ${item.status === s.id ? "text-[#0b120e]" : "text-muted"}`} style={item.status === s.id ? { background: s.tone } : undefined}>{s.label}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {item.url ? <a className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line px-3 text-xs" href={item.url} target="_blank" rel="noreferrer"><Glyph name="share" size={14} /> Negozio</a> : null}
              {item.status === "bought" && item.mine && !isMoved ? (
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary/20 px-3 text-xs font-semibold"
                  onClick={() =>
                    saveEquipment({ data: { id: null, category: item.category, name: item.name, status: "in_use", visibility: "personal", priceCents: item.priceCents, notes: item.notes ?? "", purchasedOn: new Date().toISOString().slice(0, 10), specs: item.category === "freccia" ? { qty: String(Math.max(1, item.qty || 1)) } : {} } })
                      .then(() => setMoved((m) => [...m, item.id]))
                      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"))
                  }
                >
                  <Glyph name="save" size={14} /> Metti in attrezzatura
                </button>
              ) : null}
              {isMoved ? <span className="text-xs font-semibold text-accent">Aggiunto all'attrezzatura</span> : null}
            </div>
          </Card>
        );
      })}

      {/* quello che si compra insieme in compagnia */}
      <ClubSpend />
    </div>
  );
}

function Kpi({ k, v, tone }: { k: string; v: string; tone: string }) {
  return (
    <span className="rounded-2xl border border-line bg-white/[0.04] px-2 py-2 text-center">
      <span className="block text-[0.6rem] uppercase tracking-wider text-muted">{k}</span>
      <b className="font-display text-lg tabular-nums" style={{ color: tone }}>{v}</b>
    </span>
  );
}

function SuggestRow({ category, title, sub, onAdd }: { category: string; title: string; sub: string; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2">
      <CategoryIcon category={category} className="h-11 w-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted">{sub}</p>
      </div>
      <button type="button" onClick={onAdd} className="min-h-9 shrink-0 rounded-full border border-line px-3 text-xs font-semibold">Aggiungi</button>
    </div>
  );
}
