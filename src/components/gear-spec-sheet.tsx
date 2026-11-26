import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { saveEquipment, type listEquipment } from "@/lib/arcieri/club.api";
import { findProductSpecs, type ProductPage } from "@/lib/arcieri/gear-specs.api";
import { fieldsOf, guessSpecs, mountPatch, partAdvice, searchWords, withEstimatedWeight, type SpecField } from "@/lib/arcieri/gear-specs";
import { gearPhoto } from "@/lib/arcieri/media-compress";
import { readMainGear, saveMainGear } from "@/lib/arcieri/main-gear";
import { categoryLabel, euro } from "@/lib/arcieri/labels";
import { Button, ErrorNote, Field, Select, TextInput } from "@/components/kit";
import { CategoryIcon } from "@/components/gear-icons";
import { Glyph } from "@/components/icons";

export type GearItem = Awaited<ReturnType<typeof listEquipment>>[number];

const PARTS = new Set(["aste", "punte", "alette", "cocche"]);
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const labelOf = (fields: SpecField[], key: string) => fields.find((f) => f.key === key)?.label ?? key;
const show = (f: SpecField | undefined, v: string) => {
  const opt = f?.options?.find((o) => o.id === v)?.label;
  return `${opt ?? v}${!opt && f?.unit ? ` ${f.unit}` : ""}`;
};

/**
 * Scheda delle specifiche di un pezzo: l'app le cerca da sola nei negozi in rete (o dal link del negozio),
 * riempie i campi vuoti, prende la foto del prodotto e salva sul pezzo, senza uscire dall'app. Poi si usano:
 * montate su una serie di frecce, come attrezzatura principale (FOC, balistica, spine, tuning) e nei consigli.
 */
export function GearSpecSheet({ item, gear, onClose, onSaved }: { item: GearItem; gear: GearItem[]; onClose: () => void; onSaved: () => void }) {
  const fields = fieldsOf(item.category);
  const [specs, setSpecs] = useState<Record<string, string>>({ ...item.specs });
  const [url, setUrl] = useState(item.specs.url ?? "");
  const [page, setPage] = useState<ProductPage | null>(null);
  const [reading, setReading] = useState(false);
  const [photo, setPhoto] = useState<string | null>(item.photoUrl);
  const [others, setOthers] = useState<{ url: string; title: string }[]>([]);
  const [note, setNote] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const specsRef = useRef(specs);
  specsRef.current = specs;
  const photoRef = useRef(photo);
  photoRef.current = photo;
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [allPairs, setAllPairs] = useState(false);
  const arrows = gear.filter((g) => g.mine && g.category === "freccia");
  const main = readMainGear();
  const [target, setTarget] = useState<number | "">(main?.arrowId && arrows.some((a) => a.id === main.arrowId) ? main.arrowId : arrows[0]?.id ?? "");
  const bow = main?.bowSpecs && Object.keys(main.bowSpecs).length ? main.bowSpecs : (gear.find((g) => g.mine && g.category === "arco" && g.status === "in_use")?.specs ?? null);
  const arrowSpecs = (target !== "" ? arrows.find((a) => a.id === target)?.specs : null) ?? main?.arrowSpecs ?? null;

  // dati letti dal nome, che ancora mancano
  const fromName = useMemo(() => {
    const g = guessSpecs([item.brand, item.model, item.name].filter(Boolean).join(" "), item.category);
    return Object.entries(g).filter(([k, v]) => fields.some((f) => f.key === k) && v && specs[k] !== v);
  }, [item, specs, fields]);
  const fromPage = page ? Object.entries(page.specs).filter(([k, v]) => fields.some((f) => f.key === k) && v && specs[k] !== v) : [];
  const advice = partAdvice(item.category, specs, bow, arrowSpecs);
  // un dato scritto a mano non si cambia più in automatico
  const set = (k: string, v: string) => setSpecs((s) => ({ ...s, [k]: v, autoKeys: (s.autoKeys ?? "").split(",").filter((x) => x && x !== k).join(",") }));
  const apply = (list: [string, string][]) => setSpecs((s) => ({ ...s, ...Object.fromEntries(list) }));

  /**
   * Cerca e compila da sola: il link del negozio se c'è, altrimenti il nome in rete. Riempie i campi vuoti
   * (o tutti, se si sceglie un'altra pagina), mette la foto del prodotto se il pezzo non ne ha una sua e salva.
   */
  async function run(opts: { url?: string; replace?: boolean; skip?: string[] } = {}) {
    setErr("");
    setMsg("");
    setNote("");
    setReading(true);
    try {
      const cur = specsRef.current;
      const r = await findProductSpecs({ data: { name: item.name, brand: item.brand, model: item.model, category: item.category, shop: item.shop, url: opts.url ?? "", skip: opts.skip ?? [] } });
      if (!r.page) {
        setNote(r.note || "Non ho trovato la pagina del prodotto.");
        setLinkOpen(true);
        return;
      }
      setPage(r.page);
      setUrl(r.page.url);
      setOthers(r.others);
      const found = Object.entries(r.page.specs as Record<string, string>).filter(([k, v]) => fields.some((f) => f.key === k) && v);
      // i dati scritti a mano restano; quelli messi in automatico si aggiornano con la pagina nuova
      const autoKeys = (cur.autoKeys ?? "").split(",").filter(Boolean);
      const fill = found.filter(([k, v]) => cur[k] !== v && (opts.replace || !cur[k] || autoKeys.includes(k)));
      const next: Record<string, string> = { ...cur, ...Object.fromEntries(fill), url: r.page.url };
      if (r.page.scheda) next.scheda = r.page.scheda;
      next.autoKeys = [...new Set([...autoKeys, ...fill.map(([k]) => k)])].join(",");
      // la foto del negozio solo se il pezzo non ne ha una sua (una presa in automatico si cambia)
      let pic = photoRef.current;
      if (r.photo && (!pic || cur.photoAuto === "1" || opts.replace)) {
        try {
          pic = await gearPhoto(r.photo);
          next.photoAuto = "1";
        } catch {
          /* foto che il telefono non apre: si va avanti senza */
        }
      }
      await persist(next, pic);
      setSpecs(next);
      setPhoto(pic);
      const what = fill.map(([k, v]) => `${labelOf(fields, k).toLowerCase()} ${show(fields.find((f) => f.key === k), v)}`);
      const newPic = pic !== photoRef.current;
      setMsg(
        what.length || newPic
          ? `Da ${hostOf(r.page.url)}: ${[...what, ...(newPic ? ["foto del prodotto"] : [])].join(", ")}. Salvato sul pezzo.`
          : `Letta la pagina di ${hostOf(r.page.url)}: nessun dato nuovo per i campi di questo pezzo${r.page.scheda ? ", ho salvato la scheda del negozio" : ""}.`,
      );
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Non riesco a cercare ora: riprova tra poco.");
    } finally {
      setReading(false);
    }
  }

  // appena si apre: se mancano dati o foto, cerca da sola (una volta per pezzo in questa sessione)
  useEffect(() => {
    const filled = fields.some((f) => item.specs[f.key]);
    if (filled && item.photoUrl) return;
    const k = `aa-spec-auto-${item.id}`;
    try {
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch {
      /* niente */
    }
    void run({ url: item.specs.url || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  async function persist(out: Record<string, string>, pic: string | null) {
    await saveEquipment({
      data: {
        id: item.id,
        category: item.category,
        name: item.name,
        brand: item.brand,
        model: item.model,
        status: item.status,
        visibility: item.visibility,
        priceCents: item.priceCents,
        shop: item.shop,
        notes: item.notes,
        purchasedOn: item.purchasedOn,
        photoUrl: pic,
        specs: out,
      },
    });
    const m = readMainGear();
    if (m && m.bowId === item.id) saveMainGear({ ...m, bowSpecs: out });
    if (m && m.arrowId === item.id) saveMainGear({ ...m, arrowSpecs: out });
  }

  async function save(extra: Record<string, string> = {}) {
    setErr("");
    const out = { ...specs, ...extra, ...(url.trim() ? { url: url.trim() } : {}) };
    await saveEquipment({
      data: {
        id: item.id,
        category: item.category,
        name: item.name,
        brand: item.brand,
        model: item.model,
        status: item.status,
        visibility: item.visibility,
        priceCents: item.priceCents,
        shop: item.shop,
        notes: item.notes,
        purchasedOn: item.purchasedOn,
        photoUrl: photo,
        specs: out,
      },
    });
    // se è l'arco o la serie principale, la copia sul telefono si aggiorna subito (FOC, balistica, 3D)
    const m = readMainGear();
    if (m && m.bowId === item.id) saveMainGear({ ...m, bowSpecs: out });
    if (m && m.arrowId === item.id) saveMainGear({ ...m, arrowSpecs: out });
    onSaved();
  }

  async function mount() {
    const arrow = arrows.find((a) => a.id === target);
    if (!arrow) return;
    setErr("");
    try {
      await save();
      const patch = mountPatch(item.category, specs);
      // le aste si comprano lunghe e si tagliano: la serie tiene la sua lunghezza
      if (item.category === "aste" && arrow.specs.length) delete patch.length;
      // il peso stimato si rifà con i pezzi nuovi; quello pesato resta
      const base = arrow.specs.weightEstimated ? { ...arrow.specs, weight: "", weightG: "", weightEstimated: "" } : arrow.specs;
      const next = withEstimatedWeight({ ...base, ...patch });
      await saveEquipment({ data: { id: arrow.id, category: arrow.category, name: arrow.name, brand: arrow.brand, model: arrow.model, status: arrow.status, visibility: arrow.visibility, priceCents: arrow.priceCents, shop: arrow.shop, notes: arrow.notes, purchasedOn: arrow.purchasedOn, photoUrl: arrow.photoUrl, specs: next } });
      const m = readMainGear();
      if (m && m.arrowId === arrow.id) saveMainGear({ ...m, arrowSpecs: next });
      const moved = Object.keys(patch).map((k) => labelOf(fieldsOf("freccia").concat(fields), k).toLowerCase());
      setMsg(`Montati su «${arrow.name}»: ${moved.join(", ") || "niente da copiare"}${next.weightEstimated ? `, peso stimato ${next.weightG} g` : ""}.`);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Non riesco a salvarlo.");
    }
  }

  function makeMain() {
    const m = readMainGear() ?? { setupId: null, name: "", bowId: null, arrowId: null, bowName: "", arrowName: "", bowSpecs: {}, arrowSpecs: {} };
    if (item.category === "arco") saveMainGear({ ...m, bowId: item.id, bowName: item.name, bowSpecs: specs });
    else saveMainGear({ ...m, arrowId: item.id, arrowName: item.name, arrowSpecs: specs });
    setMsg(item.category === "arco" ? "Ora è il tuo arco principale: FOC, balistica, spine e consigli partono da questo." : "Ora sono le tue frecce principali: FOC, balistica e consigli partono da queste.");
  }

  if (typeof document === "undefined") return null;
  // sul corpo della pagina: dentro una sezione animata il foglio finirebbe sotto le barre
  return createPortal(
    <div className="fixed inset-0 z-[70] grid items-end bg-black/60 backdrop-blur-[2px] sm:place-items-center" role="dialog" aria-modal="true" aria-label={`Specifiche di ${item.name}`}>
      <button type="button" className="absolute inset-0" aria-label="Chiudi" onClick={onClose} />
      <div className="relative grid max-h-[92dvh] w-full gap-3 overflow-y-auto overscroll-contain rounded-t-3xl border border-line bg-bg p-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-start gap-3">
          {photo ? <img src={photo} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain" /> : <CategoryIcon category={item.category} className="h-12 w-12 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl leading-tight">{item.name}</p>
            <p className="truncate text-xs text-muted">{categoryLabel(item.category)}{item.brand || item.model ? ` · ${item.brand} ${item.model}`.trimEnd() : ""}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line"><Glyph name="close" size={16} /></button>
        </div>

        <section className="grid gap-2 rounded-2xl bg-white/[0.04] p-3">
          <p className="aa-section-title">Specifiche dal negozio</p>
          {reading ? (
            <p className="flex items-center gap-2 text-sm" role="status">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              Cerco «{searchWords(item).slice(0, 40)}» nei negozi e leggo la scheda…
            </p>
          ) : (
            <Button variant={page ? "ghost" : undefined} onClick={() => void run({ url: page ? "" : item.specs.url || "", skip: page ? [page.url] : [] })}>
              <Glyph name="search" size={16} /> {page ? "Cerca un'altra pagina" : "Cerca e compila da solo"}
            </Button>
          )}
          {note ? <p className="text-xs text-muted">{note}</p> : null}
          {page ? (
            <div className="grid gap-2 rounded-xl border border-line p-2">
              <div className="flex items-center gap-2">
                {page.image ? <img src={page.image} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain" referrerPolicy="no-referrer" /> : null}
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold">{page.title || "Pagina del prodotto"}</p>
                  <p className="truncate text-[0.68rem] text-muted">{hostOf(page.url)}</p>
                  {page.priceCents != null ? (
                    <p className="text-xs text-muted">
                      Prezzo sul sito {euro(page.priceCents)}
                      {item.priceCents != null ? ` · tu l'hai pagato ${euro(item.priceCents)}${Number(item.specs.qty) > 1 ? ` (${euro(Math.round(item.priceCents / Number(item.specs.qty)))} l'uno)` : ""}` : ""}
                    </p>
                  ) : null}
                </div>
              </div>
              {fromPage.length ? (
                <>
                  <ul className="grid gap-1 text-sm">
                    {fromPage.map(([k, v]) => (
                      <li key={k} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-2 py-1">
                        <span className="min-w-0 truncate"><span className="text-muted">{labelOf(fields, k)}</span> {show(fields.find((f) => f.key === k), v)}</span>
                        <button type="button" className="aa-chip shrink-0" onClick={() => apply([[k, v]])}>Usa</button>
                      </li>
                    ))}
                  </ul>
                  <Button variant="ghost" onClick={() => apply(fromPage)}>Usa tutti i dati trovati</Button>
                </>
              ) : (
                <p className="text-xs text-muted">I dati di questa pagina sono già nei campi.</p>
              )}
              {page.pairs.length ? (
                <button type="button" className="text-left text-xs font-semibold text-primary" onClick={() => setAllPairs((v) => !v)}>
                  {allPairs ? "Nascondi" : `Tutte le voci della pagina (${page.pairs.length})`}
                </button>
              ) : null}
              {allPairs ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  {page.pairs.map((p) => (
                    <div key={p.label} className="contents">
                      <dt className="text-muted">{p.label}</dt>
                      <dd className="min-w-0 break-words">{p.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ) : null}
          {others.length ? (
            <div className="grid gap-1">
              <p className="text-xs text-muted">Non è questo prodotto? Altre pagine trovate:</p>
              {others.map((o) => (
                <button key={o.url} type="button" disabled={reading} onClick={() => void run({ url: o.url, replace: true })} className="aa-press flex min-h-10 items-center justify-between gap-2 rounded-xl border border-line px-3 text-left text-xs">
                  <span className="min-w-0 truncate">{o.title || o.url}</span>
                  <span className="shrink-0 text-muted">{hostOf(o.url)}</span>
                </button>
              ))}
            </div>
          ) : null}
          {linkOpen ? (
            <div className="flex gap-2">
              <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://negozio.it/prodotto…" inputMode="url" aria-label="Link della pagina del prodotto" />
              <Button onClick={() => void run({ url: url.trim(), replace: true })} disabled={reading || url.trim().length < 8}>Leggi</Button>
            </div>
          ) : (
            <button type="button" className="text-left text-xs font-semibold text-primary" onClick={() => setLinkOpen(true)}>Hai il link del negozio? Incollalo qui</button>
          )}
          {fromName.length ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">Dal nome:</span>
              {fromName.map(([k, v]) => (
                <button key={k} type="button" className="aa-chip" onClick={() => apply([[k, v]])}>
                  {labelOf(fields, k)} {show(fields.find((f) => f.key === k), v)} <Glyph name="plus" size={12} />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="grid gap-2">
          <p className="aa-section-title">Specifiche</p>
          <div className="grid grid-cols-2 gap-2">
            {fields.map((f) =>
              f.options ? (
                <Field key={f.key} label={f.label}>
                  <Select value={specs[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                    <option value="">—</option>
                    {f.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </Select>
                </Field>
              ) : (
                <Field key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ""}`}>
                  <TextInput value={specs[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} placeholder={f.hint} inputMode={f.unit && f.key !== "draw" ? "decimal" : undefined} />
                </Field>
              ),
            )}
          </div>
          {specs.scheda ? <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-xs leading-relaxed"><span className="text-muted">Dalla scheda del negozio: </span>{specs.scheda}</p> : null}
          <Button onClick={() => void save().then(() => setMsg("Specifiche salvate sul pezzo.")).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"))}>Salva le specifiche</Button>
        </section>

        {PARTS.has(item.category) ? (
          <section className="grid gap-2 rounded-2xl bg-white/[0.04] p-3">
            <p className="aa-section-title">Monta su una serie di frecce</p>
            {arrows.length ? (
              <>
                <Select value={target} onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : "")}>
                  {arrows.map((a) => <option key={a.id} value={a.id}>{a.name}{a.specs.qty ? ` · ${a.specs.qty} frecce` : ""}</option>)}
                </Select>
                <p className="text-xs text-muted">
                  Passano sulla serie: {Object.keys(mountPatch(item.category, specs)).filter((k) => !(item.category === "aste" && k === "length" && arrows.find((a) => a.id === target)?.specs.length)).map((k) => labelOf(fields, k).toLowerCase()).join(", ") || "niente, scrivi prima le specifiche"}. Il peso, se non l'hai pesato, lo stimo dai pezzi.
                </p>
                <Button variant="ghost" onClick={() => void mount()} disabled={!Object.keys(mountPatch(item.category, specs)).length}>Monta e aggiorna la serie</Button>
              </>
            ) : (
              <p className="text-xs text-muted">Crea prima una serie di frecce in Attrezzatura.</p>
            )}
          </section>
        ) : null}

        {item.category === "arco" || item.category === "freccia" ? (
          <section className="grid gap-2 rounded-2xl bg-white/[0.04] p-3">
            <p className="aa-section-title">Usa nelle impostazioni</p>
            <Button variant="ghost" onClick={makeMain}>{item.category === "arco" ? "Rendilo l'arco principale" : "Rendile le frecce principali"}</Button>
            <div className="grid grid-cols-2 gap-1.5 text-sm">
              {(
                [
                  { to: "/foc", label: "FOC e peso" },
                  { to: "/spine", label: "Spine" },
                  { to: "/tuning", label: "Tuning" },
                  { to: "/balistica", label: "Balistica" },
                ] as const
              ).map((l) => (
                <Link key={l.to} to={l.to} className="aa-press flex min-h-10 items-center justify-between rounded-xl border border-line px-3" onClick={onClose}>
                  {l.label} <Glyph name="chevron" size={14} />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {advice.length ? (
          <section className="grid gap-1 rounded-2xl border border-[#7cf0a8]/25 bg-[#7cf0a8]/[0.05] p-3">
            <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#7cf0a8]"><Glyph name="sparkle" size={13} />Consiglio</p>
            {advice.map((l) => <p key={l} className="text-[0.8rem] leading-snug">{l}</p>)}
          </section>
        ) : null}

        {msg ? <p className="text-sm font-semibold text-accent">{msg}</p> : null}
        {err ? <ErrorNote text={err} /> : null}
      </div>
    </div>,
    document.body,
  );
}
