import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { addMarketMedia, deleteMarketItem, getMarketItem, getMarketVideo, listMarket, removeMarketMedia, saveMarketItem, setMarketStatus, type MarketItem, type MarketScope, type MarketStatus } from "@/lib/arcieri/market.api";
import { compressPhoto, compressVideo, thumbOf } from "@/lib/arcieri/media-compress";
import { CATEGORIES, categoryLabel, euro, parseEuro } from "@/lib/arcieri/labels";
import { useLoad } from "@/lib/arcieri/use-load";
import { useLocalState } from "@/lib/arcieri/local-store";
import { Button, Card, Empty, ErrorNote, Field, Loading, Select, TextArea, TextInput } from "@/components/kit";
import { CategoryIcon } from "@/components/gear-icons";
import { Glyph } from "@/components/icons";

const CONDITION: { id: string; label: string }[] = [
  { id: "nuovo", label: "Nuovo" },
  { id: "come-nuovo", label: "Come nuovo" },
  { id: "buono", label: "Buono" },
  { id: "usato", label: "Usato" },
];
const STATUS: { id: MarketStatus; label: string; tone: string }[] = [
  { id: "open", label: "Disponibile", tone: "#2fbf71" },
  { id: "reserved", label: "Riservato", tone: "#e3a21a" },
  { id: "sold", label: "Venduto", tone: "#8a949c" },
];

/** bozza di un annuncio: nuovo, dall'inventario o da modificare */
export type MarketDraft = {
  id?: number;
  equipmentId?: number | null;
  /** quanti pezzi hai (dall'inventario): la quantità non può superarli */
  maxQty?: number;
  category: string;
  title: string;
  description: string;
  qty: number;
  price: string;
  condition: string;
  place: string;
  lat: number | null;
  lng: number | null;
  contact: string;
  everyone: boolean;
  videoUrl: string;
  photos: { id?: number; src: string }[];
  hasVideo?: boolean;
};

export const emptyDraft = (): MarketDraft => ({ category: "accessorio", title: "", description: "", qty: 1, price: "", condition: "buono", place: "", lat: null, lng: null, contact: "", everyone: false, videoUrl: "", photos: [] });

/** contatti scritti nell'annuncio: telefono (con WhatsApp) o e-mail */
function contactLinks(raw: string) {
  const out: { href: string; label: string }[] = [];
  const mail = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(raw)?.[0];
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length >= 8) {
    const intl = digits.startsWith("+") ? digits.slice(1) : digits.startsWith("00") ? digits.slice(2) : `39${digits}`;
    out.push({ href: `https://wa.me/${intl.replace(/\D/g, "")}`, label: "WhatsApp" });
    out.push({ href: `tel:${digits}`, label: "Chiama" });
  }
  if (mail) out.push({ href: `mailto:${mail}`, label: "E-mail" });
  return out;
}

const mapUrl = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;

/** La scheda Mercatino della Compagnia: annunci della compagnia, di tutte, i tuoi. */
export function MarketTab() {
  const [scope, setScope] = useLocalState<MarketScope>("aa-market-scope", "compagnia");
  const [nonce, setNonce] = useState(0);
  const list = useLoad(`market-${scope}-${nonce}`, () => listMarket({ data: { scope } }));
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState<MarketDraft | null>(null);
  const items = list.data?.items ?? [];
  const reload = () => setNonce((n) => n + 1);
  return (
    <div className="grid gap-3">
      <Card className="grid gap-2">
        <div className="flex items-start gap-3">
          <CategoryIcon category="borsa" className="h-12 w-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl leading-tight">Mercatino dell'usato</h2>
            <p className="text-xs text-muted">Archi, frecce e accessori che non usi più: foto, video, descrizione e dove si trova. Lo vede la tua compagnia, o tutte se lo scegli.</p>
          </div>
        </div>
        <Button onClick={() => setDraft(emptyDraft())}><Glyph name="plus" size={16} /> Metti in vendita</Button>
        <p className="text-[0.7rem] text-muted">Dall'inventario (Manutenzione) scegli pezzo e quantità con «Vendi».</p>
      </Card>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/[0.05] p-1">
        {(
          [
            ["compagnia", "La compagnia"],
            ["tutte", "Tutte"],
            ["mie", "I miei"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setScope(id)} className={`min-h-10 rounded-xl text-[0.74rem] font-semibold ${scope === id ? "bg-elev shadow" : "text-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      {list.loading && !list.data ? <Loading /> : null}
      {list.error ? <ErrorNote text={list.error} /> : null}
      {!list.loading && !items.length ? <Empty title={scope === "mie" ? "Nessun annuncio tuo" : "Ancora niente in vendita"} text={scope === "mie" ? "Metti in vendita un pezzo che non usi più." : "Il primo annuncio può essere il tuo."} /> : null}
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <MarketCard key={it.id} item={it} onOpen={() => setOpen(it.id)} />
        ))}
      </div>
      {open != null ? (
        <MarketDetail
          id={open}
          onClose={() => setOpen(null)}
          onChanged={reload}
          onEdit={(d) => {
            setOpen(null);
            setDraft(d);
          }}
        />
      ) : null}
      {draft ? <MarketForm start={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); reload(); }} /> : null}
    </div>
  );
}

function MarketCard({ item, onOpen }: { item: MarketItem; onOpen: () => void }) {
  const st = STATUS.find((s) => s.id === item.status) ?? STATUS[0];
  return (
    <button type="button" onClick={onOpen} className="aa-press grid min-w-0 content-start overflow-hidden rounded-2xl border border-line bg-white/[0.03] text-left">
      <span className="relative block aspect-[4/3] w-full overflow-hidden bg-white/[0.04]">
        {item.thumb ? <img src={item.thumb} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="grid h-full place-items-center"><CategoryIcon category={item.category} className="h-16 w-16" /></span>}
        {item.status !== "open" ? <span className="absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[0.62rem] font-bold text-[#0b120e]" style={{ background: st.tone }}>{st.label}</span> : null}
        <span className="absolute bottom-1.5 right-1.5 flex gap-1">
          {item.photos > 1 ? <span className="rounded-full bg-black/60 px-1.5 py-0.5 text-[0.6rem] text-white">{item.photos} foto</span> : null}
          {item.hasVideo || item.videoUrl ? <span className="grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"><Glyph name="play" size={10} /></span> : null}
        </span>
      </span>
      <span className="grid gap-0.5 p-2">
        <b className="font-display text-lg leading-none tabular-nums">{item.priceCents != null ? euro(item.priceCents) : "Prezzo da chiedere"}</b>
        <span className="line-clamp-2 text-[0.8rem] font-semibold leading-tight">{item.qty > 1 ? `${item.qty} × ` : ""}{item.title}</span>
        <span className="truncate text-[0.66rem] text-muted">{[item.place, item.sameCompany ? "" : item.company].filter(Boolean).join(" · ") || categoryLabel(item.category)}</span>
        {item.everyone ? <span className="text-[0.6rem] font-semibold text-accent">visibile a tutte le compagnie</span> : null}
      </span>
    </button>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // sul corpo della pagina: dentro la sezione animata il foglio finirebbe sotto la barra delle sezioni
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] grid items-end bg-black/60 backdrop-blur-[2px] sm:place-items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0" aria-label="Chiudi" onClick={onClose} />
      <div className="relative grid max-h-[92dvh] w-full gap-3 overflow-y-auto overscroll-contain rounded-t-3xl border border-line bg-bg p-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate font-display text-xl">{title}</p>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line"><Glyph name="close" size={16} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function MarketDetail({ id, onClose, onChanged, onEdit }: { id: number; onClose: () => void; onChanged: () => void; onEdit: (d: MarketDraft) => void }) {
  const [nonce, setNonce] = useState(0);
  const got = useLoad(`market-item-${id}-${nonce}`, () => getMarketItem({ data: { id } }));
  const [video, setVideo] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [sure, setSure] = useState(false);
  const it = got.data?.item ?? null;
  const photos = got.data?.photos ?? [];

  async function play() {
    setBusy("video");
    try {
      const v = await getMarketVideo({ data: { id } });
      setVideo(v?.src ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Video non disponibile.");
    } finally {
      setBusy("");
    }
  }
  async function status(s: MarketStatus) {
    setErr("");
    try {
      const r = await setMarketStatus({ data: { id, status: s } });
      setNonce((n) => n + 1);
      onChanged();
      if (s === "sold" && r.left != null) setErr(`Segnato venduto: nell'inventario ne restano ${r.left}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore");
    }
  }
  async function remove() {
    try {
      await deleteMarketItem({ data: { id } });
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore");
    }
  }
  return (
    <Sheet title={it?.title ?? "Annuncio"} onClose={onClose}>
      {got.loading && !it ? <Loading /> : null}
      {got.error ? <ErrorNote text={got.error} /> : null}
      {it ? (
        <>
          {photos.length ? (
            <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
              {photos.map((p) => (
                <img key={p.id} src={p.src} alt="" className="h-64 w-auto max-w-[85%] shrink-0 snap-center rounded-2xl object-cover" />
              ))}
            </div>
          ) : (
            <div className="grid h-40 place-items-center rounded-2xl bg-white/[0.04]"><CategoryIcon category={it.category} className="h-20 w-20" /></div>
          )}
          {it.hasVideo ? (
            video ? (
              <video src={video} controls playsInline className="max-h-72 w-full rounded-2xl bg-black" />
            ) : (
              <Button variant="ghost" onClick={() => void play()} disabled={busy === "video"}><Glyph name="play" size={15} /> {busy === "video" ? "Carico il video…" : "Guarda il video"}</Button>
            )
          ) : null}
          {it.videoUrl ? (
            <a href={it.videoUrl} target="_blank" rel="noreferrer" className="aa-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold">
              <Glyph name="video" size={16} /> Apri il video
            </a>
          ) : null}
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="font-display text-3xl leading-none tabular-nums">{it.priceCents != null ? euro(it.priceCents) : "Prezzo da chiedere"}</p>
              <p className="text-xs text-muted">{it.qty > 1 ? `${it.qty} pezzi · ` : ""}{CONDITION.find((c) => c.id === it.condition)?.label ?? it.condition} · {categoryLabel(it.category)}</p>
            </div>
            <span className="rounded-full px-2.5 py-1 text-[0.68rem] font-bold text-[#0b120e]" style={{ background: (STATUS.find((s) => s.id === it.status) ?? STATUS[0]).tone }}>{(STATUS.find((s) => s.id === it.status) ?? STATUS[0]).label}</span>
          </div>
          {it.description ? <p className="whitespace-pre-line text-sm leading-relaxed">{it.description}</p> : null}
          {it.place || it.lat != null ? (
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
              <Glyph name="pin" size={16} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1">{it.place || "Posizione segnata sulla mappa"}</span>
              {it.lat != null && it.lng != null ? <a href={mapUrl(it.lat, it.lng)} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-primary">Mappa</a> : null}
            </div>
          ) : null}
          <div className="flex items-center gap-2 text-sm">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold text-white" style={{ background: it.companyColor || "#3a4a40" }}>{it.seller.slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0">
              <b className="block truncate">{it.seller}</b>
              <span className="block truncate text-xs text-muted">{it.company || "Compagnia"}{it.everyone ? " · visibile a tutte le compagnie" : ""}</span>
            </span>
          </div>
          {!it.mine ? (
            contactLinks(it.contact).length ? (
              <div className="grid grid-cols-3 gap-1.5">
                {contactLinks(it.contact).map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="aa-press inline-flex min-h-11 items-center justify-center rounded-xl bg-primary/20 text-sm font-semibold">{l.label}</a>
                ))}
              </div>
            ) : it.contact ? <p className="text-sm">Contatto: {it.contact}</p> : <p className="text-xs text-muted">Nessun contatto nell'annuncio: chiedi in compagnia.</p>
          ) : (
            <div className="grid gap-2 rounded-2xl bg-white/[0.04] p-2.5">
              <p className="text-xs font-semibold text-muted">Il tuo annuncio</p>
              <div className="grid grid-cols-3 gap-1">
                {STATUS.map((s) => (
                  <button key={s.id} type="button" onClick={() => void status(s.id)} aria-pressed={it.status === s.id} className={`min-h-10 rounded-xl text-[0.72rem] font-semibold ${it.status === s.id ? "text-[#0b120e]" : "border border-line text-muted"}`} style={it.status === s.id ? { background: s.tone } : undefined}>
                    {s.label}
                  </button>
                ))}
              </div>
              {it.equipmentId ? <p className="text-[0.68rem] text-muted">Venduto: tolgo i pezzi dall'inventario.</p> : null}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => onEdit({ id: it.id, equipmentId: it.equipmentId, category: it.category, title: it.title, description: it.description, qty: it.qty, price: it.priceCents != null ? (it.priceCents / 100).toFixed(2).replace(".", ",") : "", condition: it.condition, place: it.place, lat: it.lat, lng: it.lng, contact: it.contact, everyone: it.everyone, videoUrl: it.videoUrl, photos, hasVideo: it.hasVideo })}>
                  Modifica
                </Button>
                {sure ? <Button variant="ghost" className="!text-danger" onClick={() => void remove()}>Conferma</Button> : <Button variant="ghost" onClick={() => setSure(true)}>Elimina</Button>}
              </div>
            </div>
          )}
        </>
      ) : null}
      {err ? <p className="text-sm text-muted">{err}</p> : null}
    </Sheet>
  );
}

/** Nuovo annuncio o modifica: foto, video breve o link, descrizione, posizione, contatto, chi lo vede. */
export function MarketForm({ start, onClose, onSaved }: { start: MarketDraft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<MarketDraft>(start);
  const [removed, setRemoved] = useState<number[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ what: string; p: number } | null>(null);
  const [err, setErr] = useState("");
  const [savedContact, setSavedContact] = useLocalState("aa-market-contact", "");
  const photoIn = useRef<HTMLInputElement>(null);
  const videoIn = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<MarketDraft>) => setD((x) => ({ ...x, ...patch }));
  useEffect(() => {
    if (!start.contact && savedContact) setD((x) => ({ ...x, contact: savedContact }));
    // solo all'apertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const max = d.maxQty && d.maxQty > 0 ? d.maxQty : 999;

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setErr("");
    const room = Math.max(0, 6 - d.photos.length);
    const list = Array.from(files).slice(0, room);
    if (!list.length) return setErr("Al massimo 6 foto.");
    for (const [i, f] of list.entries()) {
      setBusy({ what: `Riduco la foto ${i + 1} di ${list.length}`, p: i / list.length });
      try {
        const src = await compressPhoto(f);
        setD((x) => ({ ...x, photos: [...x.photos, { src }] }));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Foto non valida.");
      }
    }
    setBusy(null);
  }
  async function addVideo(file: File | undefined) {
    if (!file) return;
    setErr("");
    setBusy({ what: "Preparo il video (al massimo 20 secondi)", p: 0 });
    try {
      setVideo(await compressVideo(file, (p) => setBusy({ what: "Preparo il video (al massimo 20 secondi)", p })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Video non valido.");
    } finally {
      setBusy(null);
    }
  }
  function locate() {
    if (!navigator.geolocation) return setErr("Il telefono non dà la posizione: scrivi il luogo.");
    setBusy({ what: "Cerco la posizione", p: 0.3 });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({ lat: Math.round(pos.coords.latitude * 1000) / 1000, lng: Math.round(pos.coords.longitude * 1000) / 1000 });
        setBusy(null);
      },
      () => {
        setBusy(null);
        setErr("Posizione non disponibile: scrivi il luogo.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }
  async function publish() {
    setErr("");
    if (d.title.trim().length < 3) return setErr("Scrivi cosa vendi.");
    try {
      setBusy({ what: "Pubblico l'annuncio", p: 0.05 });
      const first = d.photos[0]?.src ?? "";
      const thumb = first ? await thumbOf(first) : "";
      const res = await saveMarketItem({
        data: { id: d.id ?? null, equipmentId: d.equipmentId ?? null, category: d.category, title: d.title.trim(), description: d.description.trim(), qty: Math.min(max, Math.max(1, d.qty)), priceCents: d.price.trim() ? parseEuro(d.price) : null, condition: d.condition, place: d.place.trim(), lat: d.lat, lng: d.lng, contact: d.contact.trim(), everyone: d.everyone, thumb, videoUrl: d.videoUrl.trim() },
      });
      for (const id of removed) await removeMarketMedia({ data: { id } });
      const fresh = d.photos.filter((p) => p.id == null);
      for (const [i, p] of fresh.entries()) {
        setBusy({ what: `Carico la foto ${i + 1} di ${fresh.length}`, p: 0.1 + (0.7 * i) / Math.max(1, fresh.length) });
        await addMarketMedia({ data: { itemId: res.id, kind: "photo", data: p.src } });
      }
      if (video) {
        setBusy({ what: "Carico il video", p: 0.85 });
        await addMarketMedia({ data: { itemId: res.id, kind: "video", data: video } });
      }
      if (d.contact.trim()) setSavedContact(d.contact.trim());
      setBusy(null);
      onSaved();
    } catch (e) {
      setBusy(null);
      setErr(e instanceof Error ? e.message : "Non riesco a pubblicarlo.");
    }
  }

  return (
    <Sheet title={d.id ? "Modifica l'annuncio" : "Metti in vendita"} onClose={onClose}>
      <div className="grid gap-2">
        <p className="text-xs font-semibold text-muted">Foto (fino a 6)</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {d.photos.map((p, i) => (
            <span key={p.id ?? `n${i}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line">
              <img src={p.src} alt="" className="h-full w-full object-cover" />
              <button type="button" aria-label="Togli la foto" onClick={() => { if (p.id != null) setRemoved((r) => [...r, p.id as number]); set({ photos: d.photos.filter((_, k) => k !== i) }); }} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white">
                <Glyph name="close" size={12} />
              </button>
              {i === 0 ? <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-1.5 text-[0.56rem] text-white">copertina</span> : null}
            </span>
          ))}
          {d.photos.length < 6 ? (
            <button type="button" onClick={() => photoIn.current?.click()} className="grid h-24 w-24 shrink-0 place-items-center rounded-xl border border-dashed border-line text-xs text-muted">
              <span className="grid justify-items-center gap-1"><Glyph name="camera" size={20} />Aggiungi</span>
            </button>
          ) : null}
        </div>
        <input ref={photoIn} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
      </div>
      <div className="grid gap-2">
        <p className="text-xs font-semibold text-muted">Video</p>
        {video ? (
          <div className="grid gap-1.5">
            <video src={video} controls playsInline className="max-h-56 w-full rounded-xl bg-black" />
            <button type="button" className="justify-self-start text-xs text-muted underline" onClick={() => setVideo(null)}>Togli il video</button>
          </div>
        ) : (
          <button type="button" onClick={() => videoIn.current?.click()} className="aa-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm">
            <Glyph name="video" size={16} /> {d.hasVideo ? "Sostituisci il video" : "Carica un video breve (fino a 20 s)"}
          </button>
        )}
        <input ref={videoIn} type="file" accept="video/*" className="hidden" onChange={(e) => { void addVideo(e.target.files?.[0]); e.target.value = ""; }} />
        <TextInput value={d.videoUrl} onChange={(e) => set({ videoUrl: e.target.value })} placeholder="Oppure un link (YouTube, Instagram, Drive…)" inputMode="url" aria-label="Link del video" />
      </div>
      <Field label="Cosa vendi"><TextInput value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Es. Longbow 28 lb, 6 frecce in cedro…" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Categoria">
          <Select value={d.category} onChange={(e) => set({ category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label="Prezzo €"><TextInput inputMode="decimal" value={d.price} onChange={(e) => set({ price: e.target.value })} placeholder="Vuoto = da chiedere" /></Field>
      </div>
      <div className="grid gap-1">
        <span className="text-xs text-muted">Quantità{d.maxQty ? ` (ne hai ${d.maxQty})` : ""}</span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Meno" onClick={() => set({ qty: Math.max(1, d.qty - 1) })} className="grid h-11 w-11 place-items-center rounded-xl border border-line text-lg">−</button>
          <span className="w-10 text-center font-display text-2xl tabular-nums">{d.qty}</span>
          <button type="button" aria-label="Più" onClick={() => set({ qty: Math.min(max, d.qty + 1) })} className="grid h-11 w-11 place-items-center rounded-xl border border-line text-lg">+</button>
          {d.maxQty && d.maxQty > 1 ? <button type="button" className="aa-chip" onClick={() => set({ qty: max })}>Tutti</button> : null}
        </div>
      </div>
      <div className="grid gap-1">
        <span className="text-xs text-muted">Condizioni</span>
        <div className="flex flex-wrap gap-1.5">
          {CONDITION.map((c) => (
            <button key={c.id} type="button" aria-pressed={d.condition === c.id} onClick={() => set({ condition: c.id })} className={`min-h-9 rounded-full px-3 text-sm ${d.condition === c.id ? "bg-accent text-accent-fg" : "border border-line"}`}>{c.label}</button>
          ))}
        </div>
      </div>
      <Field label="Descrizione"><TextArea value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Misure, libbre, spine, stato, cosa è incluso…" rows={4} /></Field>
      <div className="grid gap-1.5">
        <Field label="Dove si trova"><TextInput value={d.place} onChange={(e) => set({ place: e.target.value })} placeholder="Es. Fabriano, campo di tiro" /></Field>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button type="button" className="aa-chip" onClick={locate}><Glyph name="pin" size={13} /> Usa la mia posizione</button>
          {d.lat != null && d.lng != null ? (
            <>
              <a href={mapUrl(d.lat, d.lng)} target="_blank" rel="noreferrer" className="font-semibold text-primary">Vedi sulla mappa</a>
              <button type="button" className="text-muted underline" onClick={() => set({ lat: null, lng: null })}>togli</button>
              <span className="text-muted">approssimata, circa 100 m</span>
            </>
          ) : null}
        </div>
      </div>
      <Field label="Contatto (telefono o e-mail)"><TextInput value={d.contact} onChange={(e) => set({ contact: e.target.value })} placeholder="Es. 333 1234567" /></Field>
      <label className="flex items-start gap-2 rounded-xl bg-white/[0.04] p-2.5 text-sm">
        <input type="checkbox" checked={d.everyone} onChange={(e) => set({ everyone: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
        <span>
          <b>Visibile a tutte le compagnie</b>
          <span className="block text-xs text-muted">Senza spunta lo vede solo la tua compagnia.</span>
        </span>
      </label>
      {busy ? (
        <div className="grid gap-1">
          <p className="text-sm font-semibold">{busy.what}…</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(busy.p * 100)}%` }} /></div>
        </div>
      ) : null}
      {err ? <ErrorNote text={err} /> : null}
      <Button onClick={() => void publish()} disabled={Boolean(busy)}>{d.id ? "Salva l'annuncio" : "Pubblica l'annuncio"}</Button>
    </Sheet>
  );
}
