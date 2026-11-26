import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { addMarketMedia, contactSeller, deleteMarketItem, getMarketItem, getMarketVideo, listMarket, removeMarketMedia, saveMarketItem, setMarketStatus, type MarketItem, type MarketScope, type MarketStatus } from "@/lib/arcieri/market.api";
import { compressPhoto, compressVideo, thumbOf } from "@/lib/arcieri/media-compress";
import { CATEGORIES, categoryLabel, euro, parseEuro } from "@/lib/arcieri/labels";
import { useLoad } from "@/lib/arcieri/use-load";
import { useLocalState } from "@/lib/arcieri/local-store";
import { Button, Card, Empty, ErrorNote, Field, Loading, Select, TextArea, TextInput } from "@/components/kit";
import { CategoryIcon } from "@/components/gear-icons";
import { ShareAd } from "@/components/market-share";
import { Glyph } from "@/components/icons";
import { useMemberMaybe } from "@/components/shell";

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
  /** contatti separati: telefono, WhatsApp, e-mail */
  phone?: string;
  whatsapp?: string;
  email?: string;
  everyone: boolean;
  videoUrl: string;
  photos: { id?: number; src: string }[];
  hasVideo?: boolean;
};

export const emptyDraft = (): MarketDraft => ({ category: "accessorio", title: "", description: "", qty: 1, price: "", condition: "buono", place: "", lat: null, lng: null, contact: "", phone: "", whatsapp: "", email: "", everyone: true, videoUrl: "", photos: [] });

/** contatti scritti nell'annuncio: telefono (con WhatsApp) o e-mail; con `text` il messaggio parte già scritto */
function contactLinks(raw: string, text = "", subject = "") {
  const out: { href: string; label: string }[] = [];
  const mail = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(raw)?.[0];
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length >= 8) {
    const intl = digits.startsWith("+") ? digits.slice(1) : digits.startsWith("00") ? digits.slice(2) : `39${digits}`;
    out.push({ href: `https://wa.me/${intl.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`, label: "WhatsApp" });
    out.push({ href: `tel:${digits}`, label: "Chiama" });
  }
  if (mail) out.push({ href: `mailto:${mail}${text ? `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` : ""}`, label: "E-mail" });
  return out;
}

/** numero per WhatsApp: con il prefisso internazionale (+39 se manca) */
const waOf = (raw: string) => {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 6) return "";
  return (digits.startsWith("+") ? digits.slice(1) : digits.startsWith("00") ? digits.slice(2) : `39${digits}`).replace(/\D/g, "");
};

/**
 * Contattare chi vende: telefono, WhatsApp ed e-mail scritti nell'annuncio (visibili e da toccare),
 * oppure un messaggio nella sua Bacheca dall'app.
 */
function SellerContact({ item }: { item: MarketItem }) {
  const member = useMemberMaybe();
  const [open, setOpen] = useState(false);
  // il messaggio già scritto: saluto per nome, l'annuncio visto sull'app, la domanda e come averlo (ritiro o spedizione)
  const first = item.seller.split(" ")[0] || item.seller;
  const price = item.priceCents != null ? euro(item.priceCents) : "";
  const [text, setText] = useState(
    `Ciao ${first}, ho visto il tuo annuncio «${item.title}»${price ? ` a ${price}` : ""} nel mercatino dell'app Arcieri Amiconi. Mi interessa: è ancora disponibile? Vorrei qualche informazione in più e, se va tutto bene, comprarlo. Preferisci che passi a ritirarlo${item.place ? ` a ${item.place}` : ""} o me lo puoi spedire?`,
  );
  const subject = `Annuncio «${item.title}» su Arcieri Amiconi`;
  const [saved] = useLocalState<{ phone: string; whatsapp: string; email: string }>("aa-market-contacts", { phone: "", whatsapp: "", email: "" });
  const [reply, setReply] = useState(saved.whatsapp || saved.phone || member?.me.email || "");
  const [state, setState] = useState<"" | "busy" | "sent">("");
  const [err, setErr] = useState("");
  const old = item.phone || item.whatsapp || item.email ? [] : contactLinks(item.contact, text, subject);
  const wa = waOf(item.whatsapp || item.phone);
  const rows: { label: string; value: string; href: string; ext?: boolean }[] = [
    ...(item.phone ? [{ label: "Telefono", value: item.phone, href: `tel:${item.phone.replace(/[^\d+]/g, "")}` }] : []),
    ...(wa ? [{ label: "WhatsApp", value: item.whatsapp || item.phone, href: `https://wa.me/${wa}?text=${encodeURIComponent(text)}`, ext: true }] : []),
    ...(item.email ? [{ label: "E-mail", value: item.email, href: `mailto:${item.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` }] : []),
  ];
  async function send() {
    setErr("");
    setState("busy");
    try {
      await contactSeller({ data: { id: item.id, text, reply } });
      setState("sent");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Messaggio non inviato.");
      setState("");
    }
  }
  return (
    <div className="grid gap-2 rounded-2xl bg-white/[0.04] p-2.5">
      <p className="text-xs font-semibold text-muted">Contatta {item.seller}</p>
      {rows.length ? (
        <ul className="grid gap-1.5">
          {rows.map((r) => (
            <li key={r.label}>
              <a href={r.href} target={r.ext ? "_blank" : undefined} rel={r.ext ? "noreferrer" : undefined} className="aa-press flex min-h-11 items-center gap-2 rounded-xl bg-primary/15 px-3 text-sm">
                <span className="w-20 shrink-0 font-semibold">{r.label}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{r.value}</span>
                <Glyph name="chevron" size={14} className="shrink-0 text-muted" />
              </a>
            </li>
          ))}
        </ul>
      ) : old.length ? (
        <div className="grid grid-cols-3 gap-1.5">
          {old.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="aa-press inline-flex min-h-11 items-center justify-center rounded-xl bg-primary/20 text-sm font-semibold">{l.label}</a>
          ))}
        </div>
      ) : item.contact ? <p className="text-sm">Contatto: {item.contact}</p> : <p className="text-xs text-muted">Nell'annuncio non ci sono telefono né e-mail: scrivigli in Bacheca.</p>}
      <Field label="Messaggio (parte già scritto su WhatsApp, e-mail e Bacheca)"><TextArea value={text} onChange={(e) => setText(e.target.value)} rows={4} /></Field>
      {state === "sent" ? (
        <p className="rounded-xl bg-[#2fbf71]/15 px-3 py-2 text-sm">Messaggio arrivato nella Bacheca di {item.seller}.</p>
      ) : open ? (
        <div className="grid gap-2">
          <Field label="Come ti risponde (telefono, WhatsApp o e-mail)"><TextInput value={reply} onChange={(e) => setReply(e.target.value)} /></Field>
          {err ? <ErrorNote text={err} /> : null}
          <Button onClick={() => void send()} disabled={state === "busy" || text.trim().length < 2}>{state === "busy" ? "Invio…" : "Manda nella sua Bacheca"}</Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setOpen(true)}><Glyph name="megaphone" size={16} /> Scrivigli in Bacheca</Button>
      )}
    </div>
  );
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
  // aperto da un avviso in Bacheca (#mercatino-12): l'annuncio si apre subito, anche se è di un'altra compagnia
  useEffect(() => {
    const m = /^#mercatino-(\d+)$/.exec(window.location.hash);
    if (!m) return;
    setOpen(Number(m[1]));
    if (scope === "compagnia") setScope("tutte");
    history.replaceState(null, "", window.location.pathname + window.location.search);
    // solo all'apertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const [zoomAt, setZoomAt] = useState<number | null>(null);

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
              {photos.map((p, i) => (
                <button key={p.id} type="button" onClick={() => setZoomAt(i)} aria-label={`Apri la foto ${i + 1} a tutto schermo`} className="aa-press relative shrink-0 snap-center">
                  <img src={p.src} alt="" className="h-64 w-auto max-w-[85vw] rounded-2xl object-cover" />
                  <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white"><Glyph name="search" size={15} /></span>
                </button>
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
          <ShareAd item={it} photos={photos} />
          {!it.mine ? (
            <SellerContact item={it} />
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
                <Button variant="ghost" onClick={() => onEdit({ id: it.id, equipmentId: it.equipmentId, category: it.category, title: it.title, description: it.description, qty: it.qty, price: it.priceCents != null ? (it.priceCents / 100).toFixed(2).replace(".", ",") : "", condition: it.condition, place: it.place, lat: it.lat, lng: it.lng, contact: it.contact, phone: it.phone, whatsapp: it.whatsapp, email: it.email, everyone: it.everyone, videoUrl: it.videoUrl, photos, hasVideo: it.hasVideo })}>
                  Modifica
                </Button>
                {sure ? <Button variant="ghost" className="!text-danger" onClick={() => void remove()}>Conferma</Button> : <Button variant="ghost" onClick={() => setSure(true)}>Elimina</Button>}
              </div>
            </div>
          )}
        </>
      ) : null}
      {err ? <p className="text-sm text-muted">{err}</p> : null}
      {zoomAt != null && photos.length ? <PhotoViewer photos={photos.map((p) => p.src)} start={zoomAt} onClose={() => setZoomAt(null)} /> : null}
    </Sheet>
  );
}

/**
 * Foto a tutto schermo: si scorre da una all'altra, si ingrandisce con due dita o con un doppio tocco,
 * e ingrandita si sposta con un dito.
 */
function PhotoViewer({ photos, start, onClose }: { photos: string[]; start: number; onClose: () => void }) {
  const [at, setAt] = useState(start);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
    // solo all'apertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [zoomed, setZoomed] = useState(false);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black" role="dialog" aria-modal="true" aria-label="Foto dell'annuncio">
      <div
        ref={strip}
        onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className={`flex h-full w-full snap-x snap-mandatory [scrollbar-width:none] ${zoomed ? "overflow-hidden" : "overflow-x-auto"}`}
      >
        {photos.map((src, i) => (
          <div key={i} className="relative h-full w-full shrink-0 snap-center overflow-hidden">
            <ZoomImage src={src} active={i === at} onZoom={setZoomed} />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="rounded-full bg-black/55 px-3 py-1 text-sm font-semibold text-white tabular-nums">{at + 1} / {photos.length}</span>
        <button type="button" onClick={onClose} aria-label="Chiudi le foto" className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white"><Glyph name="close" size={18} /></button>
      </div>
      {!zoomed ? <p className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] text-center text-xs text-white/70">Due dita o doppio tocco per ingrandire</p> : null}
    </div>,
    document.body,
  );
}

/** una foto che si ingrandisce (pizzico o doppio tocco, fino a 5 volte) e si sposta quando è ingrandita */
function ZoomImage({ src, active, onZoom }: { src: string; active: boolean; onZoom: (z: boolean) => void }) {
  const [v, setV] = useState({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; s: number; cx: number; cy: number; x: number; y: number } | null>(null);
  const pan = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) setV({ s: 1, x: 0, y: 0 });
  }, [active]);
  useEffect(() => {
    if (active) onZoom(v.s > 1.02);
  }, [v.s, active, onZoom]);
  // tiene la foto dentro lo schermo quando è ingrandita
  const clampV = (s: number, x: number, y: number) => {
    const el = box.current;
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    const mx = (w * (s - 1)) / 2;
    const my = (h * (s - 1)) / 2;
    return { s, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  };
  const rel = (e: { clientX: number; clientY: number }) => {
    const r = box.current?.getBoundingClientRect();
    return { x: e.clientX - (r ? r.left + r.width / 2 : 0), y: e.clientY - (r ? r.top + r.height / 2 : 0) };
  };
  return (
    <div
      ref={box}
      className="grid h-full w-full place-items-center"
      style={{ touchAction: v.s > 1.02 ? "none" : "pan-x" }}
      onPointerDown={(e) => {
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.current.size === 2) {
          const [a, b] = [...pts.current.values()];
          const c = rel({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
          pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: v.s, cx: c.x, cy: c.y, x: v.x, y: v.y };
          pan.current = null;
        } else if (pts.current.size === 1) {
          const now = Date.now();
          if (now - lastTap.current < 300) {
            // doppio tocco: ingrandisce dove si tocca, o torna intera
            const c = rel(e);
            setV(v.s > 1.02 ? { s: 1, x: 0, y: 0 } : clampV(2.5, -c.x * 1.5, -c.y * 1.5));
            lastTap.current = 0;
          } else lastTap.current = now;
          if (v.s > 1.02) {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            pan.current = { px: e.clientX, py: e.clientY, x: v.x, y: v.y };
          }
        }
      }}
      onPointerMove={(e) => {
        if (!pts.current.has(e.pointerId)) return;
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch.current && pts.current.size >= 2) {
          const [a, b] = [...pts.current.values()];
          const k = Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d;
          const s = Math.max(1, Math.min(5, pinch.current.s * k));
          const p = pinch.current;
          // il punto fra le due dita resta sotto le dita
          setV(clampV(s, p.cx - (p.cx - p.x) * (s / p.s), p.cy - (p.cy - p.y) * (s / p.s)));
        } else if (pan.current) {
          setV(clampV(v.s, pan.current.x + e.clientX - pan.current.px, pan.current.y + e.clientY - pan.current.py));
        }
      }}
      onPointerUp={(e) => {
        pts.current.delete(e.pointerId);
        if (pts.current.size < 2) pinch.current = null;
        if (!pts.current.size) pan.current = null;
        if (v.s < 1.05) setV({ s: 1, x: 0, y: 0 });
      }}
      onPointerCancel={(e) => {
        pts.current.delete(e.pointerId);
        pinch.current = null;
        pan.current = null;
      }}
    >
      <img src={src} alt="" draggable={false} className="max-h-full max-w-full select-none object-contain" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.s})`, transition: pinch.current || pan.current ? "none" : "transform 160ms ease-out" }} />
    </div>
  );
}

/** Nuovo annuncio o modifica: foto, video breve o link, descrizione, posizione, contatto, chi lo vede. */
export function MarketForm({ start, onClose, onSaved }: { start: MarketDraft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<MarketDraft>(start);
  const [removed, setRemoved] = useState<number[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ what: string; p: number } | null>(null);
  const [err, setErr] = useState("");
  const [savedContact] = useLocalState("aa-market-contact", "");
  const [saved, setSaved] = useLocalState<{ phone: string; whatsapp: string; email: string }>("aa-market-contacts", { phone: "", whatsapp: "", email: "" });
  const member = useMemberMaybe();
  const photoIn = useRef<HTMLInputElement>(null);
  const videoIn = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<MarketDraft>) => setD((x) => ({ ...x, ...patch }));
  useEffect(() => {
    // un annuncio nuovo parte dai contatti dell'ultima volta (e dall'e-mail del tuo account)
    if (!start.id) {
      const oldDigits = savedContact.replace(/[^\d+]/g, "").replace(/\D/g, "").length >= 8 ? savedContact.replace(/[^\d+ ]/g, "").trim() : "";
      const oldMail = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(savedContact)?.[0] ?? "";
      setD((x) => ({
        ...x,
        phone: x.phone || saved.phone || oldDigits,
        whatsapp: x.whatsapp || saved.whatsapp || saved.phone || oldDigits,
        email: x.email || saved.email || oldMail || member?.me.email || "",
      }));
    }
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
        data: { id: d.id ?? null, equipmentId: d.equipmentId ?? null, category: d.category, title: d.title.trim(), description: d.description.trim(), qty: Math.min(max, Math.max(1, d.qty)), priceCents: d.price.trim() ? parseEuro(d.price) : null, condition: d.condition, place: d.place.trim(), lat: d.lat, lng: d.lng, contact: d.contact.trim(), phone: (d.phone ?? "").trim(), whatsapp: (d.whatsapp ?? "").trim(), email: (d.email ?? "").trim(), everyone: d.everyone, thumb, videoUrl: d.videoUrl.trim() },
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
      setSaved({ phone: (d.phone ?? "").trim(), whatsapp: (d.whatsapp ?? "").trim(), email: (d.email ?? "").trim() });
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
      <div className="grid gap-2 rounded-xl bg-white/[0.04] p-2.5">
        <p className="text-sm font-semibold">Come contattarti</p>
        <p className="text-[0.7rem] text-muted">Li vede chi apre l'annuncio. Ti possono anche scrivere in Bacheca dall'app.</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Telefono"><TextInput inputMode="tel" value={d.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} placeholder="333 1234567" /></Field>
          <Field label="WhatsApp"><TextInput inputMode="tel" value={d.whatsapp ?? ""} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="come il telefono" /></Field>
        </div>
        <Field label="E-mail"><TextInput inputMode="email" value={d.email ?? ""} onChange={(e) => set({ email: e.target.value })} placeholder="nome@esempio.it" /></Field>
        {d.contact && !d.phone && !d.whatsapp && !d.email ? <Field label="Altro contatto"><TextInput value={d.contact} onChange={(e) => set({ contact: e.target.value })} /></Field> : null}
      </div>
      <label className="flex items-start gap-2 rounded-xl bg-white/[0.04] p-2.5 text-sm">
        <input type="checkbox" checked={d.everyone} onChange={(e) => set({ everyone: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
        <span>
          <b>Visibile a tutte le compagnie</b>
          <span className="block text-xs text-muted">Con la spunta lo vedono gli arcieri di tutte le compagnie e arriva un avviso in Bacheca a tutti; senza, solo alla tua compagnia.</span>
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
