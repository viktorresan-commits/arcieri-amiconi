/**
 * Cartellino di gara dalla foto (nel telefono, senza servizi esterni): si mettono i quattro angoli sulla
 * colonna dell'arciere, si leggono le frecce di ogni piazzola (8, 5, 0), si controllano accanto alla foto,
 * si confrontano con il totale del portale FITAST e si salvano nella gara: le proprie nel proprio punteggio,
 * quelle dei compagni di piazzola nel cartellino della gara.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Button, Card, ErrorNote, Select, TextInput, cx } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useMember } from "@/components/shell";
import { listCompetitions, saveEntry } from "@/lib/arcieri/club.api";
import { saveScorecard } from "@/lib/arcieri/scorecard.api";
import { fitastGaraBoard } from "@/lib/arcieri/fitast-league.api";
import { categoryGroup, titleName } from "@/lib/arcieri/fitast-league";
import { nameKey } from "@/lib/arcieri/fitast-rank";
import { COLS, ROWS, fitTotal, laneOrder, quadPoint, readBlock, toGray, type ArrowValue, type BlockRead, type Gray, type Quad, type V2 } from "@/lib/arcieri/scorecard-vision";
import { romeDayKey } from "@/lib/arcieri/time";
import { messageOf, useLoad } from "@/lib/arcieri/use-load";
import { refreshActivity } from "@/lib/arcieri/xp";

type Photo = { url: string; name: string };
type Loaded = { gray: Gray; w: number; h: number; url: string };
type Comp = { id: number; name: string; startsOn: string; organizer: string; notes?: string; entries: { userId: string; rank: number | null; category: string; championshipPoints: number | null }[]; fitast?: { garaId: string; ours: { userId: string; name: string; team: string }[] } | null };

const START_KEY = "aa-cartellino-partenza";
const NEXT: Record<ArrowValue, ArrowValue> = { 8: 5, 5: 0, 0: 8 };

/** la foto ridotta (lato lungo al massimo 1800 punti) e il suo grigio per la lettura */
async function loadPhoto(url: string): Promise<Loaded> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Il telefono non riesce a leggere la foto.");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  return { gray: toGray(data, w, h), w, h, url: c.toDataURL("image/jpeg", 0.85) };
}

export function ScorecardImport({ onClose, onSaved, compId }: { onClose: () => void; onSaved?: () => void; /** gara già scelta (dalla scheda della gara) */ compId?: number }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [read, setRead] = useState<BlockRead | null>(null);
  const [vals, setVals] = useState<ArrowValue[][]>([]);
  const [touched, setTouched] = useState<boolean[][]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pick = async (i: number) => {
    setActive(i);
    setRead(null);
    setErr("");
    setBusy(true);
    try {
      const L = await loadPhoto(photos[i].url);
      setLoaded(L);
      // primo tentativo: una colonna in mezzo alla foto, alta quasi tutto il cartellino
      setQuad([[L.w * 0.35, L.h * 0.22], [L.w * 0.6, L.h * 0.22], [L.w * 0.6, L.h * 0.8], [L.w * 0.35, L.h * 0.8]]);
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const doRead = () => {
    if (!loaded || !quad) return;
    setBusy(true);
    // lascia disegnare «Leggo…» prima del calcolo
    window.setTimeout(() => {
      try {
        const r = readBlock(loaded.gray, quad);
        setRead(r);
        setVals(r.rows.map((row) => row.map((c) => c.v)));
        setTouched(r.rows.map(() => [false, false, false]));
      } catch (e) {
        setErr(messageOf(e));
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  // un altro arciere dello stesso cartellino: la colonna accanto
  const nextColumn = () => {
    if (!quad) return;
    const dx = quad[1][0] - quad[0][0], dy = quad[1][1] - quad[0][1];
    const ex = quad[2][0] - quad[3][0], ey = quad[2][1] - quad[3][1];
    setQuad([[quad[1][0], quad[1][1]], [quad[1][0] + dx, quad[1][1] + dy], [quad[2][0] + ex, quad[2][1] + ey], [quad[2][0], quad[2][1]]]);
    setRead(null);
  };

  return (
    <Card className="aa-rise grid gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e0b15a]/20"><Glyph name="camera" size={22} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight">Cartellino dalla foto</h2>
          <p className="text-sm text-muted">Fotografa il cartellino della piazzola: leggo le frecce di ogni piazzola, le controlli e le porti nella gara.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06]"><Glyph name="close" size={18} /></button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])].slice(0, 6);
          if (!files.length) return;
          const add = files.map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
          setPhotos((cur) => [...cur, ...add]);
          e.target.value = "";
          if (active == null) window.setTimeout(() => void pickAdded(add[0].url), 0);
        }}
      />
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {photos.map((p, i) => (
          <button key={p.url} type="button" onClick={() => void pick(i)} className={cx("h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2", active === i ? "border-[#e0b15a]" : "border-transparent")}>
            <img src={p.url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
        <button type="button" onClick={() => input.current?.click()} className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-dashed border-line text-muted" aria-label="Aggiungi foto">
          <Glyph name="plus" size={20} />
        </button>
      </div>
      {!photos.length ? <Button onClick={() => input.current?.click()}><Glyph name="camera" size={16} /> Scatta o scegli le foto</Button> : null}
      {err ? <ErrorNote text={err} /> : null}
      {busy && !read ? <p className="text-sm text-muted">{loaded ? "Leggo il cartellino…" : "Apro la foto…"}</p> : null}
      {loaded && quad && !read ? (
        <>
          <p className="text-sm">Metti i quattro angoli sulla colonna dell'arciere: dalla prima riga (in alto a sinistra, la casella del numero di piazzola) all'ultima (in basso a destra, la colonna S). Le righe disegnate devono cadere sulle righe del cartellino.</p>
          <Aligner loaded={loaded} quad={quad} onChange={setQuad} />
          <Button onClick={doRead} disabled={busy}>{busy ? "Leggo…" : "Leggi le frecce"}</Button>
        </>
      ) : null}
      {loaded && read ? (
        <Review
          read={read}
          vals={vals}
          touched={touched}
          onSet={(r, c, v) => {
            setVals((cur) => cur.map((row, i) => (i === r ? row.map((x, k) => (k === c ? v : x)) : row)));
            setTouched((cur) => cur.map((row, i) => (i === r ? row.map((x, k) => (k === c ? true : x)) : row)));
          }}
          onFit={(fit) => {
            setTouched((cur) => cur.map((row, i) => row.map((t, k) => t || fit[i][k] !== vals[i][k])));
            setVals(fit);
          }}
          onRealign={() => setRead(null)}
          onNext={nextColumn}
          onSaved={onSaved}
          compId={compId}
        />
      ) : null}
    </Card>
  );

  async function pickAdded(url: string) {
    setPhotos((cur) => {
      const i = cur.findIndex((p) => p.url === url);
      if (i >= 0) window.setTimeout(() => void pickIndex(i, cur), 0);
      return cur;
    });
  }
  async function pickIndex(i: number, list: Photo[]) {
    setActive(i);
    setRead(null);
    setErr("");
    setBusy(true);
    try {
      const L = await loadPhoto(list[i].url);
      setLoaded(L);
      setQuad([[L.w * 0.35, L.h * 0.22], [L.w * 0.6, L.h * 0.22], [L.w * 0.6, L.h * 0.8], [L.w * 0.35, L.h * 0.8]]);
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
}

/** la foto con i quattro angoli da spostare, la griglia del modulo e una lente sotto il dito */
function Aligner({ loaded, quad, onChange }: { loaded: Loaded; quad: Quad; onChange: (q: Quad) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const toImg = (e: RPointerEvent): V2 | null => {
    const el = svg.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * loaded.w, ((e.clientY - r.top) / r.height) * loaded.h];
  };
  const lines = useMemo(() => {
    const out: [V2, V2][] = [];
    for (const f of COLS) out.push([quadPoint(quad, f, 0), quadPoint(quad, f, 1)]);
    for (let i = 0; i <= ROWS; i++) out.push([quadPoint(quad, 0, i / ROWS), quadPoint(quad, 1, i / ROWS)]);
    return out;
  }, [quad]);
  const R = Math.max(loaded.w, loaded.h) * 0.018;
  const pt = drag != null ? quad[drag] : null;
  const lens = 132;
  const zoom = 3;
  return (
    <div className="relative select-none">
      <svg
        ref={svg}
        viewBox={`0 0 ${loaded.w} ${loaded.h}`}
        className="block w-full touch-none rounded-xl"
        onPointerMove={(e) => {
          if (drag == null) return;
          const p = toImg(e);
          if (!p) return;
          const q = quad.map((c, i) => (i === drag ? [Math.max(0, Math.min(loaded.w, p[0])), Math.max(0, Math.min(loaded.h, p[1]))] : c)) as Quad;
          onChange(q);
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <image href={loaded.url} x="0" y="0" width={loaded.w} height={loaded.h} />
        <polygon points={quad.map((p) => p.join(",")).join(" ")} fill="rgba(224,177,90,0.10)" stroke="#e0b15a" strokeWidth={R * 0.18} />
        {lines.map(([a, b], i) => <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={i < COLS.length ? "#ff5a5a" : "#4fc3ff"} strokeWidth={R * 0.08} opacity={0.85} />)}
        {quad.map((p, i) => (
          <g key={i} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(i); }} style={{ cursor: "grab" }}>
            <circle cx={p[0]} cy={p[1]} r={R * 2.6} fill="transparent" />
            <circle cx={p[0]} cy={p[1]} r={R} fill="rgba(224,177,90,0.35)" stroke="#fff" strokeWidth={R * 0.2} />
          </g>
        ))}
      </svg>
      {pt ? (
        // lente: lo stesso punto ingrandito, con il mirino
        <div
          className="pointer-events-none absolute left-2 top-2 overflow-hidden rounded-full border-2 border-white shadow-lg"
          style={{
            width: lens,
            height: lens,
            backgroundImage: `url(${loaded.url})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${(svg.current?.clientWidth ?? 300) * zoom}px auto`,
            backgroundPosition: `${lens / 2 - (pt[0] / loaded.w) * (svg.current?.clientWidth ?? 300) * zoom}px ${lens / 2 - (pt[1] / loaded.h) * (svg.current?.clientHeight ?? 300) * zoom}px`,
          }}
        >
          <span className="absolute left-1/2 top-0 h-full w-px bg-[#ff5a5a]" />
          <span className="absolute left-0 top-1/2 h-px w-full bg-[#ff5a5a]" />
        </div>
      ) : null}
    </div>
  );
}

/** una riga del cartellino raddrizzata (da T1 a TOT): quello che ha scritto il marcatore */
function RowStrip({ read, row }: { read: BlockRead; row: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const { rect, xs, ys } = read;
    const x0 = Math.round(xs[1]), x1 = Math.round(xs[5]);
    const y0 = Math.max(0, Math.round(ys[row] - 2)), y1 = Math.min(rect.h, Math.round(ys[row + 1] + 2));
    const w = x1 - x0, h = y1 - y0;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = 255 - Math.round(rect.d[(y0 + y) * rect.w + x0 + x] * 230);
        const o = (y * w + x) * 4;
        img.data[o] = v;
        img.data[o + 1] = v;
        img.data[o + 2] = v;
        img.data[o + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  }, [read, row]);
  return <canvas ref={ref} className="h-9 w-full rounded-md object-fill" />;
}

function Review({ read, vals, touched, onSet, onFit, onRealign, onNext, onSaved, compId: initialComp = 0 }: { read: BlockRead; vals: ArrowValue[][]; touched: boolean[][]; onSet: (r: number, c: number, v: ArrowValue) => void; onFit: (v: ArrowValue[][]) => void; onRealign: () => void; onNext: () => void; onSaved?: () => void; compId?: number }) {
  const { me } = useMember();
  const [start, setStart] = useState(() => {
    try {
      return Number(localStorage.getItem(START_KEY)) || 1;
    } catch {
      return 1;
    }
  });
  const order = laneOrder(start);
  const tot = vals.map((r) => r[0] + r[1] + r[2]);
  const total = tot.reduce((a, b) => a + b, 0);
  const spots = vals.flat().filter((v) => v === 8).length;
  let prog = 0;
  const unsure = (r: number, c: number) => !touched[r]?.[c] && Math.max(...read.rows[r][c].p) < 0.8;
  const nUnsure = vals.reduce((n, row, r) => n + row.filter((_, c) => unsure(r, c)).length, 0);

  // gara e arciere
  const comps = useLoad("cartellino-gare", () => listCompetitions());
  const today = romeDayKey(new Date().toISOString());
  const list = ((comps.data?.competitions ?? []) as Comp[]).filter((c) => c.id > 0 && c.startsOn <= today).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  const [compId, setCompId] = useState(initialComp);
  const comp = list.find((c) => c.id === compId) ?? list[0] ?? null;
  const garaId = comp?.fitast?.garaId ?? "";
  const board = useLoad(`cartellino-classifica-${garaId}`, () => (garaId ? fitastGaraBoard({ data: { garaId } }) : Promise.resolve({ arcieri: [], squadre: [] })));
  const people = useMemo(() => {
    const seen = new Map<string, { name: string; team: string; score: number | null; place: number | null; category: string }>();
    for (const st of board.data?.arcieri ?? []) for (const r of st.rows) {
      const k = nameKey(r.name);
      const cur = seen.get(k);
      // la categoria più precisa (con la tipologia d'arco)
      if (!cur || st.category.split("·").length > cur.category.split("·").length) seen.set(k, { name: r.name, team: r.team, score: r.score, place: r.place, category: st.category });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "it"));
  }, [board.data]);
  const [who, setWho] = useState<"io" | string>("io");
  const [q, setQ] = useState("");
  const myPortal = comp?.fitast?.ours.find((o) => o.userId === me.userId) ?? null;
  const target = who === "io" ? (myPortal ? people.find((p) => nameKey(p.name) === nameKey(myPortal.name)) ?? null : null) : people.find((p) => p.name === who) ?? null;
  const portalTotal = target?.score ?? null;
  const fit = portalTotal != null && portalTotal !== total ? fitTotal(read.rows, portalTotal) : null;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  const lanes = order.map((p, i) => ({ p, arrows: [...vals[i]] }));
  const save = async () => {
    if (!comp) return setErr("Scegli la gara.");
    setBusy(true);
    setErr("");
    try {
      try {
        localStorage.setItem(START_KEY, String(start));
      } catch {
        /* niente */
      }
      if (who === "io") {
        const old = comp.entries.find((e) => e.userId === me.userId);
        const division = old?.category ? categoryGroup(old.category).group : "";
        await saveEntry({
          data: {
            competitionId: comp.id,
            score: total,
            rank: old?.rank != null && division ? old.rank : null,
            category: division,
            notes: "Dal cartellino (foto)",
            laneCount: lanes.length,
            spot: spots,
            championshipPoints: old?.championshipPoints ?? null,
            targetKind: "sagoma",
            sagomaMax: 8,
            piazzole: lanes.map((l) => ({ n: l.p, score: l.arrows.reduce((a: number, b) => a + b, 0), arrows: l.arrows, label: "", distanceM: null, note: "", aimAngle: "" })),
          },
        });
        const myName = myPortal?.name || [me.givenName, me.familyName].filter(Boolean).join(" ") || me.nickname || "Io";
        await saveScorecard({ data: { competitionId: comp.id, piazzola: start, name: myName, self: true, lanes } });
        refreshActivity();
      } else {
        await saveScorecard({ data: { competitionId: comp.id, piazzola: start, name: who, self: false, lanes } });
      }
      setDone(who === "io" ? "Salvato nel tuo punteggio della gara." : `Salvato il cartellino di ${titleName(who)}.`);
      onSaved?.();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">Piazzola di partenza</span>
        <Select value={String(start)} onChange={(e) => setStart(Number(e.target.value))} aria-label="Piazzola di partenza" className="w-20">
          {Array.from({ length: ROWS }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
        </Select>
        <button type="button" className="aa-chip ml-auto" onClick={onRealign}>Sposta gli angoli</button>
      </div>
      <p className="text-xs text-muted">Tocca una freccia per cambiarla (8, 5, 0). {nUnsure ? `${nUnsure} ${nUnsure === 1 ? "casella incerta è segnata" : "caselle incerte sono segnate"} in oro: controllale con la foto.` : "Controlla le righe con la foto accanto."}</p>
      <ol className="grid gap-1.5">
        {vals.map((row, r) => {
          prog += tot[r];
          return (
            <li key={r} className="grid grid-cols-[1.7rem_minmax(0,1fr)_auto_2.2rem] items-center gap-1.5">
              <span className="text-center font-display text-base tabular-nums text-muted">{order[r]}</span>
              <RowStrip read={read} row={r} />
              <span className="flex gap-1">
                {row.map((v, c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onSet(r, c, NEXT[v])}
                    aria-label={`Piazzola ${order[r]}, freccia ${c + 1}: ${v}`}
                    className={cx("grid h-9 w-9 place-items-center rounded-lg font-display text-lg", v === 8 ? "bg-rose-600/90" : v === 5 ? "bg-sky-600/90" : "bg-white/10", unsure(r, c) && "ring-2 ring-[#e0b15a]")}
                  >
                    {v}
                  </button>
                ))}
              </span>
              <span className="text-right leading-tight">
                <b className="block font-display text-base tabular-nums">{tot[r]}</b>
                <span className="block text-[0.6rem] tabular-nums text-muted">{prog}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex items-baseline justify-between rounded-xl bg-white/[0.05] px-3 py-2">
        <span className="text-sm">Totale</span>
        <span className="font-display text-2xl tabular-nums">{total} <span className="text-sm text-muted">· {spots} spot</span></span>
      </div>

      <div className="grid gap-2 rounded-2xl border border-line p-3">
        <p className="text-sm font-semibold">In quale gara?</p>
        {comps.error ? <ErrorNote text={comps.error} /> : null}
        <Select value={String(comp?.id ?? "")} onChange={(e) => setCompId(Number(e.target.value))} aria-label="Gara">
          {!list.length ? <option value="">{comps.loading ? "Carico le gare…" : "Nessuna gara passata"}</option> : null}
          {list.map((c) => <option key={c.id} value={c.id}>{c.startsOn.split("-").reverse().join("/")} · {c.organizer || c.name}</option>)}
        </Select>
        <p className="text-sm font-semibold">Di chi è la colonna?</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={who === "io"} onClick={() => setWho("io")} className={cx("aa-chip", who === "io" && "border-[#e0b15a]/60 bg-[#e0b15a]/15 text-[#f1cf8a]")}>La mia</button>
          {who !== "io" ? <span className="aa-chip border-[#e0b15a]/60 bg-[#e0b15a]/15 text-[#f1cf8a]">{titleName(who)}</span> : null}
        </div>
        {garaId ? (
          <>
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Un compagno di piazzola: cerca il nome" />
            {q.trim().length >= 2 ? (
              <ol className="grid max-h-48 gap-1 overflow-y-auto">
                {people.filter((p) => nameKey(p.name).includes(nameKey(q)) || p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 12).map((p) => (
                  <li key={`${p.name}|${p.team}`}>
                    <button type="button" onClick={() => { setWho(p.name); setQ(""); }} className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-2.5 py-2 text-left text-sm">
                      <span className="min-w-0"><b className="block truncate">{titleName(p.name)}</b><span className="block truncate text-xs text-muted">{titleName(p.team)}</span></span>
                      <span className="shrink-0 tabular-nums text-muted">{p.score ?? "—"}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        ) : comp ? <p className="text-xs text-muted">Questa gara non ha la classifica del portale: si salva solo la tua colonna.</p> : null}
        {portalTotal != null ? (
          portalTotal === total ? (
            <p className="rounded-lg bg-[#3f8a76]/25 px-3 py-2 text-sm">Il totale torna con il portale FITAST: {portalTotal}.</p>
          ) : (
            <div className="grid gap-1.5 rounded-lg bg-[#e0b15a]/10 px-3 py-2 text-sm">
              <p>Sul portale FITAST il totale è <b>{portalTotal}</b>, dalla foto <b>{total}</b>.</p>
              {fit ? <button type="button" className="aa-chip justify-self-start" onClick={() => onFit(fit)}>Correggi le caselle meno sicure</button> : null}
            </div>
          )
        ) : target === null && who === "io" && garaId ? <p className="text-xs text-muted">Il tuo nome non è nella classifica di questa gara (o non è collegato): niente confronto con il portale.</p> : null}
      </div>
      {err ? <ErrorNote text={err} /> : null}
      {done ? <p className="rounded-xl bg-[#3f8a76]/25 p-3 text-sm font-semibold">{done}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => { setDone(""); onNext(); }}>Colonna accanto</Button>
        <Button onClick={() => void save()} disabled={busy || !comp || (who === "io" && me.role === "viewer")}>{busy ? "Salvo…" : "Salva nella gara"}</Button>
      </div>
    </div>
  );
}
