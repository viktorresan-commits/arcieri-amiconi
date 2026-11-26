import { useRef, useState } from "react";
import { listEquipment, saveEquipment } from "@/lib/arcieri/club.api";
import { GearSpecSheet, type GearItem } from "@/components/gear-spec-sheet";
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
/** sconto scritto in euro («5,00») o in percentuale («10%») sulla somma delle tue righe */
export function discountOf(raw: string, sum: number): number {
  const t = raw.trim();
  if (!t) return 0;
  const pct = /^(\d{1,2}(?:[.,]\d{1,2})?)\s*%$/.exec(t);
  if (pct) return Math.round((sum * Math.min(100, Number(pct[1].replace(",", ".")))) / 100);
  const c = parseEuro(t.replace(/^[-−]/, ""));
  return c == null ? 0 : Math.max(0, Math.min(sum, c));
}
/** pezzi delle frecce: in attrezzatura conta quanti ne hai */
const PIECES = new Set(["aste", "punte", "alette", "cocche"]);

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
  const [discount, setDiscount] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  // righe segnate a mano: quelle degli altri restano chiuse finché non si chiedono
  const [others, setOthers] = useState(false);
  // pezzi appena passati in attrezzatura: da qui si cercano le loro specifiche
  const [created, setCreated] = useState<GearItem[]>([]);
  const [specOf, setSpecOf] = useState<GearItem | null>(null);
  const gearList = useLoad(`receipt-gear-${nonce}-${created.length}`, () => (created.length ? listEquipment() : Promise.resolve([] as GearItem[])));

  const reset = () => {
    setImg(null);
    setPhoto("");
    setBusy(null);
    setReadErr("");
    setNote("");
    setStore("");
    setDay(today());
    setTotal("");
    setDiscount("");
    setRows([]);
    setErr("");
    setOthers(false);
  };

  const pick = (f: File | undefined) => {
    if (!f) return;
    reset();
    setDone("");
    setCreated([]);
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
          setDiscount(r.discountCents ? toPrice(r.discountCents) : "");
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
  const disc = discountOf(discount, sum);
  // lo sconto si divide sulle righe in proporzione al prezzo: ogni pezzo costa quanto l'hai pagato
  const factor = sum > 0 && disc > 0 ? (sum - disc) / sum : 1;
  const paid = (r: Row) => Math.round((cents(r.price) ?? 0) * factor);

  const save = async () => {
    setErr("");
    setSaving(true);
    try {
      const items = rows.filter((r) => r.mine && r.name.trim().length >= 2).map((r) => ({ name: r.name.trim(), category: r.category, qty: r.qty || 1, priceCents: cents(r.price) == null ? null : paid(r) }));
      await saveReceipt({ data: { store: store.trim(), day, totalCents, discountCents: disc || null, photo, items } });
      // i pezzi scelti passano anche in attrezzatura, con la data dello scontrino
      const gear = rows.filter((r) => r.mine && r.toGear && r.name.trim().length >= 2);
      const made: GearItem[] = [];
      for (const r of gear) {
        const entry = {
            id: null,
            category: r.category,
            name: r.name.trim(),
            status: "in_use",
            visibility: "personal",
            priceCents: cents(r.price) != null ? paid(r) * (r.qty || 1) : null,
            notes: [
              store.trim() ? `Comprato da ${store.trim()}` : "",
              (r.qty || 1) > 1 && cents(r.price) != null ? `${r.qty} pezzi da ${euro(paid(r))}` : "",
              disc && cents(r.price) != null ? `listino ${euro((cents(r.price) ?? 0) * (r.qty || 1))}, sconto ${Math.round((1 - factor) * 100)}%` : "",
            ].filter(Boolean).join(" · "),
            shop: store.trim(),
            purchasedOn: day,
            // frecce: i pezzi scritti nel nome («6 pz», «12 frecce») contano più della quantità della riga
            specs:
              r.category === "freccia"
                ? { qty: String(Math.max(1, Math.min(200, (Number(/(\d{1,3})\s*(?:pz|pezzi|pcs|frecce)\b/i.exec(r.name)?.[1]) || 1) * (r.qty || 1)))) }
                : PIECES.has(r.category)
                  ? { qty: String(Math.max(1, Math.min(999, r.qty || 1))) }
                  : {},
        };
        const res = await saveEquipment({ data: entry });
        made.push({ ...entry, id: res.id, mine: true, owner: "", brand: "", model: "", photoUrl: null, status: "in_use", visibility: "personal", specs: entry.specs as Record<string, string> });
      }
      setCreated(made);
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
      {created.length && !img ? (
        <div className="grid gap-1.5 rounded-2xl bg-white/[0.04] p-2">
          <p className="px-1 text-xs text-muted">Cerca le specifiche dei pezzi nuovi: servono a FOC, spine, consigli e inventario.</p>
          {created.map((g) => (
            <div key={g.id} className="flex items-center gap-2">
              <CategoryIcon category={g.category} className="h-9 w-9 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.name}</span>
              <button type="button" onClick={() => setSpecOf(g)} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-primary/20 px-3 text-xs font-semibold">
                <Glyph name="search" size={13} /> Specifiche
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {specOf ? (
        <GearSpecSheet
          item={(gearList.data ?? []).find((g) => g.id === specOf.id) ?? specOf}
          gear={gearList.data ?? []}
          onClose={() => setSpecOf(null)}
          onSaved={() => setNonce((n) => n + 1)}
        />
      ) : null}

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
                    <Field label="Totale pagato €"><TextInput inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0,00" /></Field>
                  </div>
                  <Field label="Sconto ricevuto (€ o %)"><TextInput inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Es. 5,00 oppure 10%" /></Field>
                </>
              )}
            </div>
          </div>
          {readErr ? <p className="text-sm text-muted">{readErr}</p> : null}
          {note && !busy ? <p className="rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-muted">Ho letto: {note}. Togli la spunta «Comprato da me» a quello che non è tuo.</p> : null}
          {busy ? null : (
            <>
              <div className="grid gap-2">
                {rows.map((r, i) => (!others && !r.mine && rows.some((x) => x.hand) ? null : (
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
                      <TextInput inputMode="numeric" value={String(r.qty)} onChange={(e) => set(i, { qty: Math.max(1, Math.min(999, Number(e.target.value.replace(/\D/g, "")) || 1)) })} aria-label="Quantità" />
                      <TextInput inputMode="decimal" value={r.price} onChange={(e) => set(i, { price: e.target.value })} placeholder="€ cad." aria-label="Prezzo di un pezzo" />
                    </div>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted">
                      <span className="font-semibold text-fg">{categoryLabel(r.category)}</span>
                      <span className="tabular-nums">{r.qty} × {euro(cents(r.price) ?? 0) || "0 €"} = <b className="text-fg">{euro((cents(r.price) ?? 0) * (r.qty || 1)) || "0 €"}</b></span>
                      {r.mine && disc > 0 && cents(r.price) != null ? <span className="tabular-nums text-accent">scontato {euro(paid(r) * (r.qty || 1))}</span> : null}
                      {r.hand ? <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-accent">segnata a mano</span> : null}
                      {r.lineCents != null && r.hand && r.lineCents !== (cents(r.price) ?? 0) * (r.qty || 1) ? <span>sul foglio la riga è {euro(r.lineCents)}</span> : null}
                    </p>
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
                )))}
                {!others && rows.some((x) => x.hand) && rows.some((x) => !x.mine) ? (
                  <button type="button" onClick={() => setOthers(true)} className="aa-press inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] text-sm">
                    <Glyph name="chevron" size={15} /> Le altre {rows.filter((x) => !x.mine).length} righe del foglio (non tue)
                  </button>
                ) : null}
                <button type="button" onClick={() => setRows((rs) => [...rs, { name: "", qty: 1, price: "", category: "accessorio", toGear: true, mine: true }])} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-sm">
                  <Glyph name="plus" size={15} /> Aggiungi una riga
                </button>
              </div>
              {rows.length ? (
                <div className="grid gap-1 rounded-xl bg-white/[0.04] px-3 py-2 text-xs tabular-nums">
                  <p className="flex justify-between"><span className="text-muted">Le tue righe</span><span>{euro(sum) || "0 €"}</span></p>
                  {disc > 0 ? <p className="flex justify-between text-accent"><span>Sconto{/%/.test(discount) ? ` ${discount.trim()}` : ""}</span><span>− {euro(disc)}</span></p> : null}
                  <p className="flex justify-between font-semibold"><span>Pagato</span><span>{euro(sum - disc) || "0 €"}</span></p>
                  {totalCents != null && Math.abs(totalCents - (sum - disc)) > 2 ? <p className="text-muted">Sul foglio il totale è {euro(totalCents) || "0 €"}: controlla prezzi, quantità e sconto, o aggiungi una riga.</p> : null}
                </div>
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
                <p className="truncate text-xs text-muted">{r.day ? r.day.split("-").reverse().join("/") : "senza data"} · {r.items} {r.items === 1 ? "riga" : "righe"}{r.discountCents ? ` · sconto ${euro(r.discountCents)}` : ""}</p>
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
