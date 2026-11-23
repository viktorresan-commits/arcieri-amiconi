import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLocalState } from "@/lib/arcieri/local-store";

export const Route = createFileRoute("/_app/segnapunti")({ component: Page });

/**
 * Segnapunti veloce per tirare con gli amici, classifica dal vivo.
 * Padiglione: volée da 3 o 6 frecce, X-10…1-M. Sagome: 20 piazzole, da 1 a 3 frecce, 8 vitale, 5 corpo, 0 fuori.
 */
type P = { name: string; color: string; ends: number[][] };
type Mode = "padiglione" | "sagome";
type Store = { per: number; players: P[]; cur: number; mode: Mode; lanes: number };
const COLORS = ["#2f7fd1", "#d63a2f", "#2fbf71", "#f2c94c", "#b8508a", "#7652d1"];
const KEYS = ["X", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "M"];
const SAG_KEYS = ["8", "5", "M"];

function Page() {
  const [st, setSt] = useLocalState<Store>("aa-segnapunti-v1", { per: 3, players: [{ name: "Io", color: COLORS[0], ends: [[]] }], cur: 0, mode: "padiglione", lanes: 20 });
  const [name, setName] = useState("");
  const sag = st.mode === "sagome";
  const p = st.players[st.cur] ?? st.players[0];
  const total = (x: P) => x.ends.flat().reduce((a, b) => a + (b === 11 ? 10 : b), 0);
  // spareggio: le X sul padiglione, gli 8 sulle sagome
  const xs = (x: P) => x.ends.flat().filter((b) => (sag ? b === 8 : b === 11)).length;
  const tieLabel = sag ? "da 8" : "X";
  const finished = (x: P) => sag && x.ends.length >= st.lanes && (x.ends[x.ends.length - 1]?.length ?? 0) >= st.per;
  const allDone = sag && st.players.every(finished);
  const rank = [...st.players].sort((a, b) => total(b) - total(a) || xs(b) - xs(a));
  const fresh = (patch: Partial<Store>) => setSt({ ...st, ...patch, players: st.players.map((x) => ({ ...x, ends: [[]] })), cur: 0 });
  const press = (k: string) => {
    if (finished(p)) return;
    const v = k === "X" ? 11 : k === "M" ? 0 : Number(k);
    const players = st.players.map((x, i) => {
      if (i !== st.cur) return x;
      const ends = x.ends.map((e) => [...e]);
      let last = ends[ends.length - 1];
      if (last.length >= st.per) {
        last = [];
        ends.push(last);
      }
      last.push(v);
      return { ...x, ends };
    });
    const me = players[st.cur];
    const full = me.ends[me.ends.length - 1].length >= st.per;
    // volée (o piazzola) finita: passa al prossimo arciere che deve ancora tirare
    let next = st.cur;
    if (full) {
      for (let k = 1; k <= players.length; k++) {
        const c = (st.cur + k) % players.length;
        const pl = players[c];
        const done = sag && pl.ends.length >= st.lanes && (pl.ends[pl.ends.length - 1]?.length ?? 0) >= st.per;
        if (!done) {
          next = c;
          break;
        }
      }
    }
    setSt({ ...st, players, cur: next });
    if (navigator.vibrate) navigator.vibrate(8);
  };
  const undo = () => setSt({ ...st, players: st.players.map((x, i) => (i === st.cur ? { ...x, ends: (() => { const e = x.ends.map((y) => [...y]); if (!e[e.length - 1].length && e.length > 1) e.pop(); e[e.length - 1].pop(); return e; })() } : x)) });
  const share = async () => {
    const head = sag ? `Sagome · ${st.lanes} piazzole da ${st.per} frecce` : `Padiglione · volée da ${st.per}`;
    const text = `Segnapunti Arcieri Amiconi · ${head}\n${rank.map((x, i) => `${i + 1}. ${x.name}: ${total(x)} (${xs(x)} ${tieLabel})`).join("\n")}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } catch {
      /* annullato */
    }
  };
  return (
    <div className="grid gap-3">
      <PageHead kicker="Gareggia" title="Segnapunti" lede="Padiglione o sagome. Aggiungi gli amici, poi tocca i punti: a fine volée passa da solo al prossimo." />
      <div className="grid grid-cols-2 gap-2">
        {([["padiglione", "Padiglione", "X, 10 … 1, M"], ["sagome", "Sagome", "8 · 5 · 0, 20 piazzole"]] as const).map(([id, label, hint]) => (
          <button key={id} type="button" aria-pressed={st.mode === id} onClick={() => st.mode !== id && fresh({ mode: id, per: id === "sagome" ? 2 : 3 })} className={`grid gap-0.5 rounded-2xl border p-3 text-left ${st.mode === id ? "border-[#7cf0a8] bg-white/[0.07]" : "border-hair"}`}>
            <b className="font-display text-xl leading-none">{label}</b>
            <span className="text-xs text-muted">{hint}</span>
          </button>
        ))}
      </div>
      <Card className="grid gap-2">
        <div className="flex flex-wrap gap-1.5">
          {st.players.map((x, i) => (
            <button key={i} type="button" onClick={() => setSt({ ...st, cur: i })} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${i === st.cur ? "bg-white/15 ring-2" : "bg-white/5"}`} style={{ ["--tw-ring-color" as string]: x.color }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />
              {x.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome di un amico" className="min-h-11 flex-1 rounded-xl border border-hair bg-black/20 px-3 text-sm outline-none" />
          <button type="button" aria-label="Aggiungi" className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-fg" onClick={() => { if (name.trim() && st.players.length < 6) { setSt({ ...st, players: [...st.players, { name: name.trim(), color: COLORS[st.players.length % COLORS.length], ends: [[]] }] }); setName(""); } }}><Glyph name="plus" size={18} /></button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(sag ? [1, 2, 3] : [3, 6]).map((n) => <button key={n} type="button" aria-pressed={st.per === n} className="aa-chip" onClick={() => setSt({ ...st, per: n })}>{n} {n === 1 ? "freccia" : "frecce"}{sag ? " a piazzola" : ""}</button>)}
          <button type="button" className="aa-chip ml-auto" onClick={() => fresh({})}>Nuova partita</button>
        </div>
      </Card>
      <Card className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold" style={{ color: p.color }}>Tocca a {p.name}</p>
          <p className="text-xs text-muted">{sag ? `piazzola ${Math.min(p.ends.length, st.lanes)}/${st.lanes}` : `volée ${p.ends.length}`} · {(p.ends[p.ends.length - 1] ?? []).map((v) => (v === 11 ? "X" : v === 0 ? "M" : v)).join(" ") || "—"}</p>
        </div>
        {allDone ? (
          <p className="rounded-xl bg-[#3f8a76]/25 p-3 text-sm font-semibold">Giro finito: {st.lanes} piazzole per tutti. Vince {rank[0]?.name} con {total(rank[0])}.</p>
        ) : sag ? (
          <div className="grid grid-cols-3 gap-1.5">
            {SAG_KEYS.map((k) => (
              <button key={k} type="button" onClick={() => press(k)} disabled={finished(p)} className={`aa-press grid min-h-16 place-items-center rounded-xl disabled:opacity-40 ${k === "8" ? "bg-rose-600/90" : k === "5" ? "bg-sky-600/90" : "bg-white/10"}`}>
                <b className="font-display text-3xl leading-none">{k === "M" ? "0" : k}</b>
                <span className="text-[0.66rem] opacity-80">{k === "8" ? "vitale" : k === "5" ? "corpo" : "fuori"}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1.5">
            {KEYS.map((k) => (
              <button key={k} type="button" onClick={() => press(k)} className={`aa-press min-h-12 rounded-xl font-display text-xl ${k === "X" || k === "10" || k === "9" ? "bg-amber-400/90 text-black" : k === "8" || k === "7" ? "bg-rose-600/90" : k === "6" || k === "5" ? "bg-sky-600/90" : k === "M" ? "bg-white/10" : k === "4" || k === "3" ? "bg-zinc-900" : "bg-zinc-100 text-black"}`}>{k}</button>
            ))}
          </div>
        )}
        {sag ? (
          // cartellino delle 20 piazzole di chi sta tirando
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: st.lanes }, (_, i) => {
              const e = p.ends[i];
              const v = e && e.length ? e.reduce((a, b) => a + b, 0) : null;
              const lastFull = (p.ends[p.ends.length - 1]?.length ?? 0) >= st.per;
              const now = i === (lastFull ? p.ends.length : p.ends.length - 1) && !finished(p);
              return (
                <span key={i} className={`grid h-9 place-items-center rounded-md text-[0.7rem] font-bold tabular-nums ${now ? "ring-2 ring-[#7cf0a8]" : ""}`} style={{ background: v == null ? "rgba(255,255,255,0.05)" : v >= st.per * 8 * 0.9 ? "#e0533f" : v >= st.per * 5 ? "#2a6294" : "rgba(255,255,255,0.14)" }}>
                  {v == null ? <span className="text-muted">{i + 1}</span> : v}
                </span>
              );
            })}
          </div>
        ) : null}
        <button type="button" className="justify-self-start text-xs text-muted" onClick={undo}>Annulla l'ultima</button>
      </Card>
      <Card className="grid gap-1.5">
        {rank.map((x, i) => (
          <div key={x.name + i} className="aa-menu-row flex items-center gap-3" style={{ animationDelay: `${i * 40}ms` }}>
            <span className="w-5 text-center font-display text-lg">{i + 1}</span>
            <span className="h-3 w-3 rounded-full" style={{ background: x.color }} />
            <span className="flex-1 font-semibold">{x.name}</span>
            <span className="text-xs text-muted">{xs(x)} {tieLabel}{sag ? ` · ${Math.min(x.ends.filter((e) => e.length).length, st.lanes)}/${st.lanes}` : ""}</span>
            <b key={total(x)} className="aa-pop font-display text-2xl tabular-nums">{total(x)}</b>
          </div>
        ))}
        <button type="button" className="aa-chip mt-1 justify-self-start" onClick={() => void share()}><Glyph name="share" size={14} /> Condividi la classifica</button>
      </Card>
    </div>
  );
}
