import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLocalState } from "@/lib/arcieri/local-store";

export const Route = createFileRoute("/_app/segnapunti")({ component: Page });

/** Segnapunti veloce per tirare con gli amici: più arcieri, volée da 3 o 6, classifica dal vivo. */
type P = { name: string; color: string; ends: number[][] };
type Store = { per: number; players: P[]; cur: number };
const COLORS = ["#2f7fd1", "#d63a2f", "#2fbf71", "#f2c94c", "#b8508a", "#7652d1"];
const KEYS = ["X", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "M"];

function Page() {
  const [st, setSt] = useLocalState<Store>("aa-segnapunti-v1", { per: 3, players: [{ name: "Io", color: COLORS[0], ends: [[]] }], cur: 0 });
  const [name, setName] = useState("");
  const p = st.players[st.cur] ?? st.players[0];
  const total = (x: P) => x.ends.flat().reduce((a, b) => a + (b === 11 ? 10 : b), 0);
  const xs = (x: P) => x.ends.flat().filter((b) => b === 11).length;
  const rank = [...st.players].sort((a, b) => total(b) - total(a) || xs(b) - xs(a));
  const press = (k: string) => {
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
    // volée finita: passa al prossimo arciere
    setSt({ ...st, players, cur: full ? (st.cur + 1) % players.length : st.cur });
    if (navigator.vibrate) navigator.vibrate(8);
  };
  const undo = () => setSt({ ...st, players: st.players.map((x, i) => (i === st.cur ? { ...x, ends: (() => { const e = x.ends.map((y) => [...y]); if (!e[e.length - 1].length && e.length > 1) e.pop(); e[e.length - 1].pop(); return e; })() } : x)) });
  const share = async () => {
    const text = `Segnapunti Arcieri Amiconi\n${rank.map((x, i) => `${i + 1}. ${x.name}: ${total(x)} (${xs(x)} X)`).join("\n")}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } catch {
      /* annullato */
    }
  };
  return (
    <div className="grid gap-3">
      <PageHead kicker="Gareggia" title="Segnapunti" lede="Aggiungi gli amici, poi tocca i punti: a fine volée passa da solo al prossimo." />
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
        <div className="flex gap-1.5">
          {[3, 6].map((n) => <button key={n} type="button" aria-pressed={st.per === n} className="aa-chip" onClick={() => setSt({ ...st, per: n })}>{n} frecce</button>)}
          <button type="button" className="aa-chip ml-auto" onClick={() => setSt({ ...st, players: st.players.map((x) => ({ ...x, ends: [[]] })), cur: 0 })}>Nuova partita</button>
        </div>
      </Card>
      <Card className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold" style={{ color: p.color }}>Tocca a {p.name}</p>
          <p className="text-xs text-muted">volée {p.ends.length} · {(p.ends[p.ends.length - 1] ?? []).map((v) => (v === 11 ? "X" : v === 0 ? "M" : v)).join(" ") || "—"}</p>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {KEYS.map((k) => (
            <button key={k} type="button" onClick={() => press(k)} className={`aa-press min-h-12 rounded-xl font-display text-xl ${k === "X" || k === "10" || k === "9" ? "bg-amber-400/90 text-black" : k === "8" || k === "7" ? "bg-rose-600/90" : k === "6" || k === "5" ? "bg-sky-600/90" : k === "M" ? "bg-white/10" : k === "4" || k === "3" ? "bg-zinc-900" : "bg-zinc-100 text-black"}`}>{k}</button>
          ))}
        </div>
        <button type="button" className="justify-self-start text-xs text-muted" onClick={undo}>Annulla l'ultima</button>
      </Card>
      <Card className="grid gap-1.5">
        {rank.map((x, i) => (
          <div key={x.name + i} className="aa-menu-row flex items-center gap-3" style={{ animationDelay: `${i * 40}ms` }}>
            <span className="w-5 text-center font-display text-lg">{i + 1}</span>
            <span className="h-3 w-3 rounded-full" style={{ background: x.color }} />
            <span className="flex-1 font-semibold">{x.name}</span>
            <span className="text-xs text-muted">{xs(x)} X</span>
            <b key={total(x)} className="aa-pop font-display text-2xl tabular-nums">{total(x)}</b>
          </div>
        ))}
        <button type="button" className="aa-chip mt-1 justify-self-start" onClick={() => void share()}><Glyph name="share" size={14} /> Condividi la classifica</button>
      </Card>
    </div>
  );
}
