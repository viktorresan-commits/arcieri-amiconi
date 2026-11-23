import { useEffect, useMemo, useRef, useState } from "react";
import type { Face } from "@/lib/arcieri/scoring";
import type { Draft } from "@/lib/arcieri/draft";
import { TargetRead } from "./target-read";
import { Card, cx } from "./kit";
import { AppIcon, Glyph } from "./icons";

type Hit = { nx: number; ny: number; score: number; isX: boolean; miss: boolean; tag?: number | null };
type Item = { id: number; file: File; url: string; state: "da-leggere" | "salvata" | "saltata"; volley?: number; points?: number; arrows?: number };

/**
 * Allenamento da foto: un allenamento nuovo, poi una o più foto del bersaglio.
 * Ogni foto si legge e si controlla da sola; «Salva» la mette nella volée successiva e passa alla prossima.
 */
export function PhotoSession({
  draft,
  face,
  tags,
  pending,
  onVolley,
  onDistance,
  onFinish,
  onOpenLive,
}: {
  draft: Draft;
  face: Face;
  tags: number[];
  pending: string;
  onVolley: (hits: Hit[]) => void;
  onDistance: (m: number) => void;
  onFinish: () => void;
  onOpenLive: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const shoot = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  useEffect(() => () => items.forEach((it) => URL.revokeObjectURL(it.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const ends = new Set(draft.shots.map((s) => `${s.block}:${s.end}`)).size;
  const points = draft.shots.reduce((a, s) => a + s.score, 0);
  const arrows = draft.shots.length;
  const max = arrows * face.max;
  const open = items.find((it) => it.id === current) ?? null;
  const todo = items.filter((it) => it.state === "da-leggere");

  function add(list: FileList | null) {
    const files = [...(list ?? [])].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(f.name));
    if (!files.length) return;
    files.sort((a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name));
    const fresh = files.map((file) => ({ id: ++seq.current, file, url: URL.createObjectURL(file), state: "da-leggere" as const }));
    setItems((cur) => [...cur, ...fresh]);
    if (current == null || open?.state !== "da-leggere") setCurrent(fresh[0].id);
    if (navigator.vibrate) navigator.vibrate(10);
  }

  function nextAfter(id: number, list: Item[]) {
    const i = list.findIndex((it) => it.id === id);
    return [...list.slice(i + 1), ...list.slice(0, i)].find((it) => it.state === "da-leggere")?.id ?? null;
  }

  function saved(hits: Hit[]) {
    if (!open) return;
    onVolley(hits);
    const pts = hits.reduce((a, h) => a + (h.miss ? 0 : h.score), 0);
    const next = items.map((it) => (it.id === open.id ? { ...it, state: "salvata" as const, volley: ends + 1, points: pts, arrows: hits.length } : it));
    setItems(next);
    setCurrent(nextAfter(open.id, next));
    if (navigator.vibrate) navigator.vibrate([10, 40, 18]);
  }

  function skip() {
    if (!open) return;
    const next = items.map((it) => (it.id === open.id ? { ...it, state: "saltata" as const } : it));
    setItems(next);
    setCurrent(nextAfter(open.id, next));
  }

  const ring = max ? points / max : 0;
  const R = 26;
  const C = 2 * Math.PI * R;
  const dists = useMemo(() => [10, 18, 25, 30, 50, 70], []);

  return (
    <div className="grid gap-3">
      <div className="aa-hero grid gap-3 p-4">
        <div className="flex items-center gap-3">
          <AppIcon name="camera" size={52} />
          <div className="min-w-0 flex-1">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-white/60">Nuovo allenamento</p>
            <h1 className="font-display text-3xl leading-none">Da foto</h1>
            <p className="mt-1 text-xs text-white/70">{face.label} · {draft.meta.distanceM} m</p>
          </div>
          <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
            <circle cx="32" cy="32" r={R} fill="none" stroke="#fff" strokeOpacity={0.12} strokeWidth="6" />
            <circle cx="32" cy="32" r={R} fill="none" stroke="#7cf0a8" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ring)} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)" }} />
          </svg>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[["Volée", ends], ["Frecce", arrows], ["Punti", points]].map(([k, v]) => (
            <span key={k} className="rounded-xl bg-black/25 px-2 py-1.5">
              <span className="block text-[0.6rem] uppercase tracking-wider text-white/60">{k}</span>
              <b key={String(v)} className="aa-pop block font-display text-2xl tabular-nums">{v}</b>
            </span>
          ))}
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
          {dists.map((d) => (
            <button key={d} type="button" aria-pressed={draft.meta.distanceM === d} onClick={() => onDistance(d)} className="aa-chip">{d} m</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => shoot.current?.click()} className="aa-press flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-3 font-semibold text-primary-fg">
          <Glyph name="camera" size={20} /> Scatta
        </button>
        <button type="button" onClick={() => album.current?.click()} className="aa-press flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-hair bg-white/[0.06] px-3 font-semibold">
          <Glyph name="stack" size={20} /> Una o più dall'album
        </button>
      </div>
      <input ref={shoot} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { add(e.currentTarget.files); e.currentTarget.value = ""; }} />
      <input ref={album} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.currentTarget.files); e.currentTarget.value = ""; }} />

      {items.length ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setCurrent(it.id)}
              className={cx("aa-thumb relative h-20 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition", it.id === current ? "border-primary" : "border-transparent opacity-80")}
              style={{ animationDelay: `${i * 40}ms` }}
              aria-label={`Foto ${i + 1}`}
            >
              <img src={it.url} alt="" className="h-full w-full object-cover" />
              <span className={cx("absolute inset-x-0 bottom-0 px-1 py-0.5 text-center text-[0.6rem] font-semibold", it.state === "salvata" ? "bg-emerald-600/85 text-white" : it.state === "saltata" ? "bg-black/70 text-white/70" : "bg-black/60 text-white")}>
                {it.state === "salvata" ? `V${it.volley} · ${it.points}` : it.state === "saltata" ? "saltata" : `foto ${i + 1}`}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Card className="grid justify-items-center gap-2 py-6 text-center">
          <AppIcon name="bolt" size={64} />
          <p className="font-semibold">Fotografa il bersaglio dopo ogni volée</p>
          <p className="max-w-xs text-sm text-muted">Puoi anche sceglierne tante dall'album: le leggo una alla volta, tu controlli e salvi.</p>
        </Card>
      )}

      {open ? (
        <Card className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Foto {items.findIndex((it) => it.id === open.id) + 1} di {items.length}
              {open.state === "salvata" ? <span className="ml-2 text-xs text-emerald-300">già salvata nella volée {open.volley}</span> : null}
            </p>
            {open.state === "da-leggere" ? <button type="button" className="aa-chip" onClick={skip}>Salta</button> : null}
          </div>
          {open.state === "da-leggere" ? (
            <TargetRead
              key={open.id}
              face={face}
              tags={tags}
              file={open.file}
              expected={Math.max(1, draft.meta.arrowsPerEnd)}
              volleyLabel={`volée ${ends + 1}`}
              onApply={saved}
              compact
            />
          ) : (
            <img src={open.url} alt="" className="max-h-80 w-full rounded-xl object-contain" />
          )}
        </Card>
      ) : null}

      {items.length && !todo.length && arrows ? (
        <p className="aa-rise text-center text-sm text-emerald-300">Tutte le foto lette. Aggiungine altre o salva l'allenamento.</p>
      ) : null}
      {pending ? <p className="text-xs text-muted">{pending}</p> : null}
      <div className="grid gap-2">
        <button type="button" disabled={!arrows} onClick={onFinish} className="aa-press flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-base font-semibold text-primary-fg disabled:opacity-40">
          <Glyph name="save" size={20} /> Salva allenamento{arrows ? ` · ${arrows} frecce` : ""}
        </button>
        <button type="button" onClick={onOpenLive} className="min-h-11 text-sm font-semibold text-muted">
          Apri il tiro completo (bersaglio, tempi, note)
        </button>
      </div>
    </div>
  );
}
