import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Chips, PageHead, TextInput } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLocalState } from "@/lib/arcieri/local-store";

export const Route = createFileRoute("/_app/tacche")({ component: Page });

/**
 * Tacche del mirino: segni le tacche provate ad almeno due distanze e l'app ricava
 * tutte le altre (retta con 2 punti, curva con 3 o più). Più archi, ognuno con le sue tacche.
 */
type Mark = { d: number; m: number };
/** Nel salvataggio teniamo il testo scritto (così "4," resta mentre si digita). */
type RawMark = { d: string | number | null; m: string | number | null };
type Store = { bows: { name: string; marks: RawMark[] }[]; active: number };
const DEFAULT: Store = { bows: [{ name: "Il mio arco", marks: [{ d: "18", m: "4,2" }, { d: "50", m: "7,8" }] }], active: 0 };
const num = (x: RawMark["d"]) => (x == null || String(x).trim() === "" ? NaN : Number(String(x).replace(",", ".")));
const txt = (x: RawMark["d"]) => (x == null ? "" : typeof x === "number" ? (Number.isFinite(x) ? String(x).replace(".", ",") : "") : x);

/** Minimi quadrati: grado 1 con due punti, grado 2 da tre in su. */
function fit(marks: Mark[]) {
  const pts = marks.filter((p) => Number.isFinite(p.d) && Number.isFinite(p.m) && p.d > 0);
  if (pts.length < 2) return null;
  if (pts.length === 2) {
    const [a, b] = pts;
    const k = (b.m - a.m) / (b.d - a.d || 1);
    return (d: number) => a.m + k * (d - a.d);
  }
  // risolvo il sistema normale 3×3 per m = c0 + c1 d + c2 d²
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
  for (const { d, m } of pts) {
    const d2 = d * d;
    s0 += 1; s1 += d; s2 += d2; s3 += d2 * d; s4 += d2 * d2;
    t0 += m; t1 += m * d; t2 += m * d2;
  }
  const A = [[s0, s1, s2, t0], [s1, s2, s3, t1], [s2, s3, s4, t2]];
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let r = i + 1; r < 3; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    if (Math.abs(A[i][i]) < 1e-12) return null;
    for (let r = 0; r < 3; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c < 4; c++) A[r][c] -= f * A[i][c];
    }
  }
  const c0 = A[0][3] / A[0][0];
  const c1 = A[1][3] / A[1][1];
  const c2 = A[2][3] / A[2][2];
  return (d: number) => c0 + c1 * d + c2 * d * d;
}

const fmt = (n: number, dig = 2) => n.toFixed(dig).replace(".", ",");

function Page() {
  const [store, setStore] = useLocalState<Store>("aa-tacche-v1", DEFAULT);
  const [ask, setAsk] = useState("");
  const bow = store.bows[store.active] ?? store.bows[0];
  const marks: Mark[] = useMemo(() => bow.marks.map((r) => ({ d: num(r.d), m: num(r.m) })), [bow.marks]);
  const f = useMemo(() => fit(marks), [marks]);
  const setBow = (next: Store["bows"][number]) => setStore({ ...store, bows: store.bows.map((b, i) => (i === store.active ? next : b)) });
  const setMark = (i: number, part: Partial<RawMark>) => setBow({ ...bow, marks: bow.marks.map((m, j) => (j === i ? { ...m, ...part } : m)) });
  const dists = [5, 10, 15, 18, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90];
  const asked = Number(ask.replace(",", "."));

  // grafico: distanza in orizzontale, tacca in verticale
  const W = 340;
  const H = 170;
  const pad = { l: 30, r: 10, t: 12, b: 24 };
  const valid = marks.filter((p) => Number.isFinite(p.d) && Number.isFinite(p.m) && p.d > 0);
  const ds = valid.map((p) => p.d);
  const dMin = Math.max(0, Math.min(5, ...ds));
  const dMax = Math.max(60, ...ds) + 5;
  const ys = [...(f ? dists.filter((d) => d >= dMin && d <= dMax).map(f) : []), ...valid.map((p) => p.m)].filter(Number.isFinite);
  const yMin = (ys.length ? Math.min(...ys) : 0) - 0.5;
  const yMax = (ys.length ? Math.max(...ys) : 10) + 0.5;
  const X = (d: number) => pad.l + ((d - dMin) / (dMax - dMin)) * (W - pad.l - pad.r);
  const Y = (m: number) => pad.t + (1 - (m - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b);
  const curve = f ? Array.from({ length: 60 }, (_, i) => dMin + ((dMax - dMin) * i) / 59).map((d, i) => `${i ? "L" : "M"}${X(d).toFixed(1)} ${Y(f(d)).toFixed(1)}`).join(" ") : "";

  return (
    <div className="grid gap-3">
      <PageHead kicker="Mirino" title="Tacche" lede="Segna le tacche provate ad almeno due distanze: ricavo tutte le altre. Si salva da solo." />
      <Chips
        value={String(store.active)}
        onChange={(v) => (v === "nuovo" ? setStore({ bows: [...store.bows, { name: `Arco ${store.bows.length + 1}`, marks: [] }], active: store.bows.length }) : setStore({ ...store, active: Number(v) }))}
        options={[...store.bows.map((b, i) => ({ id: String(i), label: b.name || `Arco ${i + 1}` })), { id: "nuovo", label: "+ Arco" }]}
      />
      <Card className="grid gap-2.5">
        <TextInput value={bow.name} onChange={(e) => setBow({ ...bow, name: e.target.value })} placeholder="Nome dell'arco" />
        <p className="text-xs text-muted">Tacche provate (distanza in metri e numero letto sulla scala del mirino)</p>
        {bow.marks.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <label className="flex items-center gap-1 rounded-xl border border-hair bg-black/20 px-3">
              <input inputMode="decimal" value={txt(m.d)} onChange={(e) => setMark(i, { d: e.target.value })} className="min-h-11 w-full bg-transparent text-sm outline-none" aria-label="Distanza" />
              <span className="text-xs text-muted">m</span>
            </label>
            <label className="flex items-center gap-1 rounded-xl border border-hair bg-black/20 px-3">
              <input inputMode="decimal" value={txt(m.m)} onChange={(e) => setMark(i, { m: e.target.value })} className="min-h-11 w-full bg-transparent text-sm outline-none" aria-label="Tacca" />
              <span className="text-xs text-muted">tacca</span>
            </label>
            <button type="button" className="grid h-11 w-11 place-items-center rounded-xl bg-white/5" onClick={() => setBow({ ...bow, marks: bow.marks.filter((_, j) => j !== i) })} aria-label="Togli">
              <Glyph name="trash" size={16} />
            </button>
          </div>
        ))}
        <button type="button" className="aa-chip justify-self-start" onClick={() => setBow({ ...bow, marks: [...bow.marks, { d: "", m: "" }] })}>
          <Glyph name="plus" size={14} /> Aggiungi una distanza
        </button>
        {!f ? <p className="text-xs text-muted">Servono almeno due distanze diverse.</p> : null}
      </Card>
      {f ? (
        <>
          <Card className="grid gap-2">
            <div className="flex items-end gap-2">
              <label className="flex flex-1 items-center gap-1 rounded-xl border border-hair bg-black/20 px-3">
                <input inputMode="decimal" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Distanza da calcolare" className="min-h-12 w-full bg-transparent text-base outline-none" />
                <span className="text-xs text-muted">m</span>
              </label>
              <div className="min-w-24 rounded-xl bg-primary/15 px-3 py-1.5 text-center">
                <p className="text-[0.6rem] uppercase tracking-wider text-muted">tacca</p>
                <p className="font-display text-2xl tabular-nums">{asked > 0 ? fmt(f(asked)) : "—"}</p>
              </div>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = pad.t + t * (H - pad.t - pad.b);
                return (
                  <g key={t}>
                    <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.07} />
                    <text x={pad.l - 4} y={y + 3} fontSize="8" fill="currentColor" fillOpacity={0.5} textAnchor="end">{fmt(yMax - t * (yMax - yMin), 1)}</text>
                  </g>
                );
              })}
              {[10, 20, 30, 40, 50, 60, 70, 80, 90].filter((d) => d >= dMin && d <= dMax).map((d) => (
                <text key={d} x={X(d)} y={H - 8} fontSize="8" fill="currentColor" fillOpacity={0.5} textAnchor="middle">{d} m</text>
              ))}
              <path d={curve} fill="none" stroke="var(--accent)" strokeWidth="2.2" pathLength={100} className="aa-draw" />
              {valid.map((p, i) => (
                <circle key={i} cx={X(p.d)} cy={Y(p.m)} r="4.5" fill="var(--primary)" stroke="#fff" strokeWidth="1.4" />
              ))}
              {asked > 0 && asked >= dMin && asked <= dMax ? <circle cx={X(asked)} cy={Y(f(asked))} r="5" fill="none" stroke="#7cf0a8" strokeWidth="2" className="aa-pulse" /> : null}
            </svg>
          </Card>
          <Card>
            <p className="aa-section-title mb-2">Tabella</p>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {dists.map((d) => {
                const known = marks.some((p) => p.d === d);
                return (
                  <button key={d} type="button" onClick={() => setAsk(String(d))} className={`rounded-xl px-1 py-1.5 ${known ? "bg-primary/20" : "bg-white/[0.04]"}`}>
                    <span className="block text-[0.62rem] text-muted">{d} m</span>
                    <span className="block font-display text-lg tabular-nums">{fmt(f(d))}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[0.68rem] text-muted">{valid.length >= 3 ? "Curva calcolata sulle tue tacche." : "Con due tacche è una retta: aggiungine una terza (lontana) per una curva più fedele."} Lontano dalle distanze provate il valore è meno preciso.</p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
