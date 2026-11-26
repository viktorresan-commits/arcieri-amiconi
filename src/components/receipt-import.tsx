import { useRef, useState } from "react";
import { saveEquipment } from "@/lib/arcieri/club.api";
import { deleteReceipt, listReceipts, saveReceipt } from "@/lib/arcieri/receipts.api";
import { readReceipt, receiptThumb, type ReceiptItem } from "@/lib/arcieri/receipt-read";
import { CATEGORIES, categoryLabel, euro, parseEuro } from "@/lib/arcieri/labels";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, ErrorNote, Field, TextInput } from "@/components/kit";
import { CategoryIcon } from "@/components/gear-icons";
import { Glyph } from "@/components/icons";

type Row = Omit<ReceiptItem, "priceCents"> & { price: string };

const cents = (raw: string) => (raw.trim() ? parseEuro(raw) : null);
const toPrice = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Scontrini e fatture: una foto e il telefono legge negozio, data, totale e righe. Si controlla,
 * si salva tra la spesa fatta e, con un tocco per riga, i pezzi passano in attrezzatura.
 */
export function ReceiptsCard({ onSaved }: { onSaved: () => void }) {
  const [nonce, setNonce] = useState(0);
  const list = useLoad(`receipts-${nonce}`, () => listReceipts());
  const file = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState<{ p: number; what: string } | null>(null);
  const [readErr, setReadErr] = useState("");
  const [note, setNote] = useState("");
  const [store, setStore] = useState("");
  const [day, setDay] = useState(today());
  const [total, setTotal] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);

  const reset = () => {
    setImg(null);
    setPhoto("");
    setBusy(null);
    setReadErr("");
    setNote("");
    setStore("");
    setDay(today());
    setTotal("");
    setRows([]);
    setErr("");
  };

  const pick = (f: File | undefined) => {
    if (!f) return;
    reset();
    setDone("");
    const url = URL.createObjectURL(f);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setPhoto(receiptThumb(image));
      setBusy({ p: 0, what: "Preparo il lettore" });
      readReceipt(image, (p, what) => setBusy({ p, what }))
        .then((r) => {
          setStore(r.store);
          if (r.day) setDay(r.day);
          setTotal(toPrice(r.totalCents));
          // prima le tue righe, poi le altre del foglio
          setRows([...r.items.filter((it) => it.mine), ...r.items.filter((it) => !it.mine)].map((it) => ({ ...it, price: toPrice(it.priceCents) })));
          setNote(r.note);
          if (!r.items.length && r.totalCents == null) setReadErr("Non ho trovato righe con il prezzo: scrivi tu totale e righe.");
        })
        .catch((e: unknown) => {
          setReadErr(e instanceof Error ? e.message : "Non riesco a leggerlo: scrivi tu totale e righe.");
          setRows([{ name: "", qty: 1, price: "", category: "accessorio", toGear: false, mine: true }]);
        })
        .finally(() => setBusy(null));
    };
    image.onerror = () => setReadErr("Questa immagine non si apre: prova con una foto (JPG o PNG).");
    image.src = url;
  };

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const sum = rows.filter((r) => r.mine).reduce((t, r) => t + (cents(r.price) ?? 0) * (r.qty || 1), 0);
  const totalCents = cents(total);

  const save = async () => {
    setErr("");
    setSaving(true);
    try {
      const items = rows.filter((r) => r.mine && r.name.trim().length >= 2).map((r) => ({ name: r.name.trim(), category: r.category, qty: r.qty || 1, priceCents: cents(r.price) }));
      await saveReceipt({ data: { store: store.trim(), day, totalCents, photo, items } });
      // i pezzi scelti passano anche in attrezzatura, con la data dello scontrino
      const gear = rows.filter((r) => r.mine && r.toGear && r.name.trim().length >= 2);
      for (const r of gear) {
        await saveEquipment({
          data: {
            id: null,
            category: r.category,
            name: r.name.trim(),
            status: "in_use",
            visibility: "personal",
            priceCents: cents(r.price),
            notes: store.trim() ? `Comprato da ${store.trim()}` : "",
            purchasedOn: day,
            // frecce: i pezzi scritti nel nome («6 pz», «12 frecce») contano più della quantità della riga
            specs: r.category === "freccia" ? { qty: String(Math.max(1, Math.min(200, (Number(/(\d{1,3})\s*(?:pz|pezzi|pcs|frecce)\b/i.exec(r.name)?.[1]) || 1) * (r.qty || 1)))) } : {},
          },
        });
      }
      setDone(`Salvato tra la spesa fatta${gear.length ? `, ${gear.length} ${gear.length === 1 ? "pezzo" : "pezzi"} in attrezzatura` : ""}.`);
      reset();
      setNonce((n) => n + 1);
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Errore");
    } finally {
      setSaving(false);
    }
  };

  const saved = list.data ?? [];
  return (
    <Card className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="aa-section-title">Scontrini e fatture</p>
          <p className="text-xs text-muted">Una foto: il telefono legge le righe, tu controlli e salvi.</p>
        </div>
        <button type="button" onClick={() => file.current?.click()} className="aa-press inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-semibold text-accent-fg">
          <Glyph name="camera" size={16} /> Foto
        </button>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {done ? <p className="text-sm font-semibold text-accent">{done}</p> : null}

      {img ? (
        <div className="grid gap-3">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => setZoom(photo)} className="shrink-0 overflow-hidden rounded-xl border border-line" aria-label="Ingrandisci lo scontrino">
              <img src={photo} alt="Scontrino" className="h-28 w-20 object-cover" />
            </button>
            <div className="grid min-w-0 flex-1 gap-2">
              {busy ? (
                <div className="grid gap-1.5">
                  <p className="text-sm font-semibold">{busy.what}…</p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(busy.p * 100)}%` }} /></div>
                  <p className="text-xs text-muted">La prima volta scarica il lettore (qualche MB), poi è subito pronto.</p>
                </div>
              ) : (
                <>
                  <Field label="Negozio"><TextInput value={store} onChange={(e) => setStore(e.target.value)} placeholder="Nome del negozio" /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Data"><TextInput type="date" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
                    <Field label="Totale €"><TextInput inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0,00" /></Field>
                  </div>
                </>
              )}
            </div>
          </div>
          {readErr ? <p className="text-sm text-muted">{readErr}</p> : null}
          {note && !busy ? <p className="rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-muted">Ho letto: {note}. Togli la spunta «Comprato da me» a quello che non è tuo.</p> : null}
          {busy ? null : (
            <>
              <div className="grid gap-2">
                {rows.map((r, i) => (
                  <div key={i} className={`grid gap-2 rounded-2xl bg-white/[0.04] p-2 ${r.mine ? "" : "opacity-55"}`}>
                    <div className="flex items-center gap-2">
                      <CategoryIcon category={r.category} className="h-10 w-10 shrink-0" />
                      <TextInput value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Cosa hai comprato" />
                      <button type="button" aria-label="Togli la riga" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted"><Glyph name="close" size={15} /></button>
                    </div>
                    <div className="grid grid-cols-[1fr_4.2rem_5.4rem] gap-2">
                      <select value={r.category} onChange={(e) => set(i, { category: e.target.value })} className="min-h-10 rounded-xl border border-line bg-bg px-2 text-sm" aria-label="Categoria">
                        {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                      <TextInput inputMode="numeric" value={String(r.qty)} onChange={(e) => set(i, { qty: Math.max(1, Math.min(99, Number(e.target.value.replace(/\D/g, "")) || 1)) })} aria-label="Quantità" />
                      <TextInput inputMode="decimal" value={r.price} onChange={(e) => set(i, { price: e.target.value })} placeholder="€ cad." aria-label="Prezzo di un pezzo" />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                      <label className="flex items-center gap-2 font-semibold">
                        <input type="checkbox" checked={r.mine} onChange={(e) => set(i, { mine: e.target.checked, toGear: e.target.checked ? r.toGear || r.category !== "altro" : false })} className="h-4 w-4 accent-[var(--accent)]" />
                        Comprato da me
                      </label>
                      {r.mine ? (
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={r.toGear} onChange={(e) => set(i, { toGear: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                          In attrezzatura{r.toGear ? ` · ${categoryLabel(r.category)}` : ""}
                        </label>
                      ) : null}
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setRows((rs) => [...rs, { name: "", qty: 1, price: "", category: "accessorio", toGear: true, mine: true }])} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-sm">
                  <Glyph name="plus" size={15} /> Aggiungi una riga
                </button>
              </div>
              {rows.length ? (
                <p className="text-xs text-muted">
                  Le tue righe {euro(sum) || "0 €"}{totalCents != null ? ` · totale ${euro(totalCents) || "0 €"}` : ""}
                  {totalCents != null && Math.abs(totalCents - sum) > 2 ? " · non tornano: controlla prezzi e quantità, o aggiungi una riga" : ""}
                </p>
              ) : null}
              {err ? <ErrorNote text={err} /> : null}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={reset}>Annulla</Button>
                <Button onClick={() => void save()} disabled={saving}>{saving ? "Salvo…" : "Salva tra le spese"}</Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {saved.length ? (
        <div className="grid gap-1.5">
          {saved.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2">
              <button type="button" onClick={() => setZoom(r.photo || null)} disabled={!r.photo} className="h-12 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-white/5" aria-label="Vedi lo scontrino">
                {r.photo ? <img src={r.photo} alt="" className="h-full w-full object-cover" /> : <Glyph name="notebook" size={16} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.store || "Scontrino"}</p>
                <p className="truncate text-xs text-muted">{r.day ? r.day.split("-").reverse().join("/") : "senza data"} · {r.items} {r.items === 1 ? "riga" : "righe"}</p>
              </div>
              <b className="shrink-0 font-display text-lg tabular-nums">{r.totalCents != null ? euro(r.totalCents) : "—"}</b>
              <button type="button" aria-label="Elimina lo scontrino e le sue righe" onClick={() => deleteReceipt({ data: { id: r.id } }).then(() => { setNonce((n) => n + 1); onSaved(); })} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-danger"><Glyph name="trash" size={16} /></button>
            </div>
          ))}
        </div>
      ) : null}

      {zoom ? (
        <button type="button" onClick={() => setZoom(null)} className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" aria-label="Chiudi">
          <img src={zoom} alt="Scontrino" className="max-h-full max-w-full rounded-xl" />
        </button>
      ) : null}
    </Card>
  );
}
