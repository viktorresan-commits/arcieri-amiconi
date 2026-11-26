import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Card, ErrorNote, PageHead, Select } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLocalState } from "@/lib/arcieri/local-store";
import { ANIMALS } from "@/lib/arcieri/sagome";
import { listCompetitions, saveEntry } from "@/lib/arcieri/club.api";
import { useLoad } from "@/lib/arcieri/use-load";
import { useMember } from "@/components/shell";
import { romeDayKey } from "@/lib/arcieri/time";
import { refreshActivity } from "@/lib/arcieri/xp";

export const Route = createFileRoute("/_app/segnapunti")({ component: Page });

/**
 * Segnapunti veloce per tirare con gli amici, classifica dal vivo.
 * Padiglione: volée da 3 o 6 frecce, X-10…1-M. Sagome: 20 piazzole, da 1 a 3 frecce, 8 vitale, 5 corpo, 0 fuori;
 * per ogni piazzola (facoltativo) il bersaglio (animale o sagoma 3D cubica) e la distanza stimata, e alla fine
 * il proprio punteggio si salva nella gara del calendario, piazzola per piazzola.
 */
type P = { name: string; color: string; ends: number[][] };
type Mode = "padiglione" | "sagome";
/** quello che si sa di una piazzola: bersaglio e distanza stimata (uguali per tutto il gruppo) */
type LaneInfo = { label: string; dist: number | null };
type Store = { per: number; players: P[]; cur: number; mode: Mode; lanes: number; info?: LaneInfo[]; recent?: string[]; savedIn?: number | null };
const COLORS = ["#2f7fd1", "#d63a2f", "#2fbf71", "#f2c94c", "#b8508a", "#7652d1"];
const KEYS = ["X", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "M"];
const SAG_KEYS = ["8", "5", "M"];
const CUBE = "Sagoma 3D cubica";
const DISTANCES = [5, 8, 10, 12, 15, 18, 20, 25, 30, 35, 40];

function Page() {
  const [st, setSt] = useLocalState<Store>("aa-segnapunti-v1", { per: 3, players: [{ name: "Io", color: COLORS[0], ends: [[]] }], cur: 0, mode: "padiglione", lanes: 20 });
  const [name, setName] = useState("");
  // piazzola scelta toccando il cartellino (per correggere bersaglio o distanza); null = quella in corso
  const [focus, setFocus] = useState<number | null>(null);
  // la piazzola a cui stai dando bersaglio e distanza resta ferma finché non segni la freccia dopo
  const [pin, setPin] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // persona da togliere (si chiede conferma: i suoi punti si perdono)
  const [removing, setRemoving] = useState<number | null>(null);
  const sag = st.mode === "sagome";
  const p = st.players[st.cur] ?? st.players[0];
  const total = (x: P) => x.ends.flat().reduce((a, b) => a + (b === 11 ? 10 : b), 0);
  // spareggio: le X sul padiglione, gli 8 sulle sagome
  const xs = (x: P) => x.ends.flat().filter((b) => (sag ? b === 8 : b === 11)).length;
  const tieLabel = sag ? "da 8" : "X";
  const finished = (x: P) => sag && x.ends.length >= st.lanes && (x.ends[x.ends.length - 1]?.length ?? 0) >= st.per;
  const allDone = sag && st.players.every(finished);
  const rank = [...st.players].sort((a, b) => total(b) - total(a) || xs(b) - xs(a));
  const fresh = (patch: Partial<Store>) => {
    setFocus(null);
    setPin(null);
    setSt({ ...st, ...patch, players: st.players.map((x) => ({ ...x, ends: [[]] })), cur: 0, info: [], savedIn: null });
  };
  const lastFull = (p.ends[p.ends.length - 1]?.length ?? 0) >= st.per;
  const currentLane = Math.min(st.lanes - 1, lastFull ? p.ends.length : p.ends.length - 1);
  const info = st.info ?? [];
  // bersaglio e distanza vanno alla piazzola appena finita finché non li hai segnati (prima i punti, poi
  // l'animale), altrimenti a quella in corso (prima l'animale, poi i punti)
  const lastIdx = Math.max(0, p.ends.length - 1);
  const lastKnown = Boolean(info[lastIdx]?.label || info[lastIdx]?.dist != null);
  const autoLane = lastFull && lastKnown ? Math.min(st.lanes - 1, lastIdx + 1) : lastIdx;
  const lane = focus ?? pin ?? autoLane;
  // subito dopo una piazzola, un tocco sposta i dati fra quella appena tirata e la prossima
  const other = lastFull && focus == null && lastIdx + 1 < st.lanes ? (lane === lastIdx ? lastIdx + 1 : lane === lastIdx + 1 ? lastIdx : null) : null;
  const here: LaneInfo = info[lane] ?? { label: "", dist: null };
  const setInfo = (patch: Partial<LaneInfo>) => {
    const next = [...info];
    while (next.length <= lane) next.push({ label: "", dist: null });
    next[lane] = { ...next[lane], ...patch };
    const recent = patch.label ? [patch.label, ...(st.recent ?? []).filter((x) => x !== patch.label)].slice(0, 8) : st.recent;
    if (focus == null) setPin(lane);
    setSt({ ...st, info: next, recent });
  };
  const press = (k: string) => {
    const v = k === "X" ? 11 : k === "M" ? 0 : Number(k);
    // correzione: la piazzola (o volée) scelta sul cartellino e rimasta incompleta si riempie prima di tutto
    if (focus != null && focus < p.ends.length - 1 && (p.ends[focus]?.length ?? 0) < st.per) {
      const players = st.players.map((x, i) => (i === st.cur ? { ...x, ends: x.ends.map((e, j) => (j === focus ? [...e, v] : e)) } : x));
      setSt({ ...st, players });
      if ((p.ends[focus]?.length ?? 0) + 1 >= st.per) setFocus(null);
      if (navigator.vibrate) navigator.vibrate(8);
      return;
    }
    if (finished(p)) return;
    setFocus(null);
    setPin(null);
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
  const undo = () => {
    setPin(null);
    setSt({ ...st, players: st.players.map((x, i) => (i === st.cur ? { ...x, ends: (() => { const e = x.ends.map((y) => [...y]); if (!e[e.length - 1].length && e.length > 1) e.pop(); e[e.length - 1].pop(); return e; })() } : x)) });
  };
  // cancella una freccia o tutta la piazzola/volée di chi sta tirando (l'ultima, se resta vuota, sparisce)
  const clearArrows = (endIdx: number, arrowIdx?: number) => {
    setPin(null);
    const players = st.players.map((x, i) => {
      if (i !== st.cur) return x;
      const ends = x.ends.map((e, j) => (j === endIdx ? (arrowIdx == null ? [] : e.filter((_, a) => a !== arrowIdx)) : [...e]));
      while (ends.length > 1 && !ends[ends.length - 1].length) ends.pop();
      return { ...x, ends };
    });
    setSt({ ...st, players });
    if (endIdx >= players[st.cur].ends.length) setFocus(null);
  };
  const removePlayer = (idx: number) => {
    const players = st.players.filter((_, i) => i !== idx);
    const cur = st.cur === idx ? 0 : st.cur > idx ? st.cur - 1 : st.cur;
    setRemoving(null);
    setFocus(null);
    setPin(null);
    setSt({ ...st, players, cur });
  };
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
  const recent = [...new Set([...(st.recent ?? []), CUBE])].slice(0, 7);
  const mine = st.players[0];
  const myLanes = sag ? mine.ends.filter((e) => e.length).length : 0;
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
            <span key={i} className={`flex items-center rounded-full text-sm font-semibold transition ${i === st.cur ? "bg-white/15 ring-2" : "bg-white/5"}`} style={{ ["--tw-ring-color" as string]: x.color }}>
              <button type="button" onClick={() => { setFocus(null); setSt({ ...st, cur: i }); }} className={`flex items-center gap-1.5 py-1.5 pl-3 ${i === 0 ? "pr-3" : "pr-1.5"}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />
                {x.name}
              </button>
              {/* «Io» resta sempre: è il punteggio che si salva nella gara */}
              {i > 0 ? (
                <button type="button" aria-label={`Togli ${x.name}`} onClick={() => setRemoving(i)} className="mr-1 grid h-7 w-7 place-items-center rounded-full text-white/60 active:bg-white/10">
                  <Glyph name="close" size={13} />
                </button>
              ) : null}
            </span>
          ))}
        </div>
        {removing != null && st.players[removing] ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 p-2.5 text-sm">
            <span className="min-w-0 flex-1">Togliere <b>{st.players[removing].name}</b> dalla partita? I suoi punti si perdono.</span>
            <button type="button" className="aa-chip" onClick={() => setRemoving(null)}>Annulla</button>
            <button type="button" className="aa-chip !border-transparent !bg-danger !text-danger-fg" onClick={() => removePlayer(removing)}>Togli</button>
          </div>
        ) : null}
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
        {sag && !allDone ? (
          // la piazzola: bersaglio e distanza stimata, facoltativi, con un tocco
          <div className="grid gap-1.5 rounded-xl bg-white/[0.04] p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">
                Piazzola {lane + 1}
                {focus != null ? <span className="text-muted"> · correzione</span> : lastFull && lane === lastIdx ? <span className="text-muted"> · appena tirata</span> : null}
                {other != null ? (
                  <button type="button" onClick={() => setPin(other)} className="ml-2 rounded-full border border-hair px-2 py-0.5 text-[0.68rem] font-semibold text-muted">
                    {other > lane ? `Prossima, la ${other + 1}` : `Era la ${other + 1}`}
                  </button>
                ) : null}
              </p>
              <p className="truncate text-xs text-muted">{[here.label, here.dist != null ? `${here.dist} m` : ""].filter(Boolean).join(" · ") || "bersaglio e distanza facoltativi"}</p>
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="group" aria-label="Bersaglio">
              {recent.map((a) => (
                <button key={a} type="button" aria-pressed={here.label === a} onClick={() => setInfo({ label: here.label === a ? "" : a })} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${here.label === a ? "border-[#7cf0a8] bg-[#7cf0a8]/15" : "border-hair bg-black/15"}`}>
                  {a}
                </button>
              ))}
              <label className="relative shrink-0">
                <span className="sr-only">Altro animale</span>
                <select value="" onChange={(e) => e.target.value && setInfo({ label: e.target.value })} className="min-h-[2.05rem] appearance-none rounded-full border border-dashed border-hair bg-black/15 px-3 text-xs font-semibold text-fg">
                  <option value="">Animale…</option>
                  {ANIMALS.map((a) => <option key={a.id} value={a.label}>{a.label}</option>)}
                </select>
              </label>
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="group" aria-label="Distanza stimata">
              {DISTANCES.map((d) => (
                <button key={d} type="button" aria-pressed={here.dist === d} onClick={() => setInfo({ dist: here.dist === d ? null : d })} className={`min-w-11 shrink-0 rounded-full border px-2.5 py-1.5 text-xs font-semibold tabular-nums ${here.dist === d ? "border-[#7cf0a8] bg-[#7cf0a8]/15" : "border-hair bg-black/15"}`}>
                  {d} m
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {sag ? (
          // cartellino delle 20 piazzole di chi sta tirando: toccane una per correggere bersaglio o distanza
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: st.lanes }, (_, i) => {
              const e = p.ends[i];
              const v = e && e.length ? e.reduce((a, b) => a + b, 0) : null;
              const now = i === currentLane && !finished(p);
              const known = Boolean(info[i]?.label || info[i]?.dist != null);
              return (
                <button key={i} type="button" onClick={() => setFocus(focus === i ? null : i)} aria-label={`Piazzola ${i + 1}`} className={`relative grid h-9 place-items-center rounded-md text-[0.7rem] font-bold tabular-nums ${now ? "ring-2 ring-[#7cf0a8]" : ""} ${focus === i ? "ring-2 ring-white" : ""}`} style={{ background: v == null ? "rgba(255,255,255,0.05)" : v >= st.per * 8 * 0.9 ? "#e0533f" : v >= st.per * 5 ? "#2a6294" : "rgba(255,255,255,0.14)" }}>
                  {v == null ? <span className="text-muted">{i + 1}</span> : v}
                  {known ? <span aria-hidden className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[#7cf0a8]" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
        {!sag && p.ends.some((e) => e.length) ? (
          // cartellino delle volée di chi sta tirando: toccane una per cancellare o correggere le frecce
          <div className="flex flex-wrap gap-1">
            {p.ends.map((e, i) => (
              <button key={i} type="button" onClick={() => setFocus(focus === i ? null : i)} aria-label={`Volée ${i + 1}`} className={`grid min-w-11 place-items-center rounded-md px-1.5 py-1 text-[0.7rem] font-bold tabular-nums ${focus === i ? "ring-2 ring-white" : ""}`} style={{ background: e.length ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)" }}>
                <span className="text-[0.58rem] font-semibold text-muted">V{i + 1}</span>
                {e.length ? total({ ...p, ends: [e] }) : "—"}
              </button>
            ))}
          </div>
        ) : null}
        {focus != null && p.ends[focus] ? (
          // correzione: le frecce della piazzola (o volée) scelta, ognuna si cancella con un tocco
          <div className="grid gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">{sag ? `Piazzola ${focus + 1}` : `Volée ${focus + 1}`} di {p.name}</p>
              <button type="button" className="text-xs font-semibold text-muted" onClick={() => setFocus(null)}>Fatto</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {p.ends[focus].map((v, a) => (
                <button key={a} type="button" onClick={() => clearArrows(focus, a)} aria-label={`Cancella la freccia ${a + 1}`} className="flex items-center gap-1 rounded-full bg-white/10 py-1 pl-3 pr-2 font-display text-lg leading-none">
                  {v === 11 ? "X" : v === 0 ? (sag ? "0" : "M") : v}
                  <Glyph name="close" size={12} className="text-white/60" />
                </button>
              ))}
              {p.ends[focus].length ? (
                <button type="button" className="aa-chip ml-auto" onClick={() => clearArrows(focus)}>
                  <Glyph name="trash" size={13} /> {sag ? "Svuota la piazzola" : "Svuota la volée"}
                </button>
              ) : null}
            </div>
            {p.ends[focus].length < st.per && focus < p.ends.length - 1 ? <p className="text-[0.7rem] text-muted">Tocca i punti qui sopra per rimettere le frecce in questa {sag ? "piazzola" : "volée"}.</p> : null}
          </div>
        ) : null}
        <button type="button" className="aa-chip justify-self-start" onClick={undo}><Glyph name="history" size={13} /> Annulla l'ultima freccia</button>
        <p className="text-[0.7rem] text-muted">Per cancellare o correggere altri punti tocca {sag ? "la piazzola" : "la volée"} sul cartellino.</p>
      </Card>
      {sag && myLanes > 0 ? (
        saving ? (
          <SaveToGara st={st} onClose={() => setSaving(false)} onSaved={(id) => setSt({ ...st, savedIn: id })} />
        ) : (
          <Button onClick={() => setSaving(true)}>{st.savedIn ? "Salva di nuovo nella gara" : `Salva il mio punteggio nella gara (${myLanes} ${myLanes === 1 ? "piazzola" : "piazzole"})`}</Button>
        )
      ) : null}
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

/**
 * Il proprio punteggio (il primo arciere, «Io») nella gara del calendario: piazzola per piazzola con frecce,
 * bersaglio e distanza. Posto, categoria e punti campionato già segnati restano; quelli del portale si
 * aggiungono poi dal pannello FITAST della gara.
 */
function SaveToGara({ st, onClose, onSaved }: { st: Store; onClose: () => void; onSaved: (compId: number) => void }) {
  const { me } = useMember();
  const comps = useLoad("segnapunti-gare", () => listCompetitions());
  // solo le gare dell'app (quelle lette solo dal portale non hanno dove salvare le piazzole)
  const list = ((comps.data?.competitions ?? []) as { id: number; name: string; startsOn: string; entries: { userId: string; rank: number | null; category: string; championshipPoints: number | null; piazzole: unknown[] }[] }[]).filter((c) => c.id > 0);
  const today = romeDayKey(new Date().toISOString());
  // la gara di oggi, se c'è; altrimenti la più vicina (prima le appena passate)
  const byNear = [...list].sort((a, b) => Math.abs(Date.parse(a.startsOn) - Date.parse(today)) - Math.abs(Date.parse(b.startsOn) - Date.parse(today)) || (a.startsOn < b.startsOn ? 1 : -1));
  const [pick, setPick] = useState<number>(st.savedIn ?? 0);
  const compId = pick || byNear[0]?.id || 0;
  const comp = list.find((c) => c.id === compId);
  const old = comp?.entries.find((e) => e.userId === me.userId);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const mine = st.players[0];
  const lanes = mine.ends
    .map((arrows, i) => ({ n: i + 1, arrows, info: st.info?.[i] }))
    .filter((l) => l.arrows.length)
    .slice(0, st.lanes)
    .map((l) => ({ n: l.n, score: l.arrows.reduce((a, b) => a + b, 0), arrows: l.arrows, label: l.info?.label ?? "", distanceM: l.info?.dist ?? null, note: "", aimAngle: "" }));
  const total = lanes.reduce((a, l) => a + l.score, 0);
  const save = () => {
    if (!comp) return setErr("Scegli la gara del calendario.");
    setBusy(true);
    setErr("");
    saveEntry({
      data: {
        competitionId: comp.id,
        score: total,
        // il posto resta solo con la sua categoria (senza, il server non lo accetta)
        rank: old?.rank != null && old.category ? old.rank : null,
        category: old?.category ?? "",
        notes: "Dal segnapunti",
        laneCount: lanes.length,
        spot: lanes.reduce((a, l) => a + l.arrows.filter((x) => x === 8).length, 0),
        championshipPoints: old?.championshipPoints ?? null,
        targetKind: "sagoma",
        sagomaMax: 8,
        piazzole: lanes,
      },
    })
      .then(() => {
        refreshActivity();
        onSaved(comp.id);
        setDone(true);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non salvato: i punti restano qui, riprova quando c'è rete."))
      .finally(() => setBusy(false));
  };
  return (
    <Card className="aa-rise grid gap-2">
      <p className="font-display text-xl leading-tight">Salva nella gara</p>
      <p className="text-xs text-muted">Il punteggio di «{mine.name}»: {lanes.length} piazzole, {total} punti, con bersaglio e distanza dove li hai segnati.</p>
      {comps.error ? <ErrorNote text={comps.error} /> : null}
      <Select value={String(compId || "")} onChange={(e) => setPick(Number(e.target.value))} aria-label="Gara del calendario">
        <option value="">{comps.loading ? "Carico le gare…" : "Scegli la gara…"}</option>
        {byNear.map((c) => <option key={c.id} value={c.id}>{c.startsOn.split("-").reverse().join("/")} · {c.name}</option>)}
      </Select>
      {old?.piazzole.length ? <p className="text-xs text-[#f1cf8a]">In questa gara hai già delle piazzole: verranno sostituite da queste.</p> : null}
      {err ? <ErrorNote text={err} /> : null}
      {done ? (
        <div className="grid gap-2 rounded-xl bg-[#3f8a76]/25 p-3 text-sm">
          <p className="font-semibold">Salvato nella gara. Quando escono i risultati sul portale, aggiungi posto e punti campionato dal pannello FITAST in Gare.</p>
          <Link to="/gare" className="aa-chip justify-self-start">Vai alle gare</Link>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onClose}>Chiudi</Button>
        <Button onClick={save} disabled={busy || !comp}>{busy ? "Salvo…" : "Salva"}</Button>
      </div>
    </Card>
  );
}
