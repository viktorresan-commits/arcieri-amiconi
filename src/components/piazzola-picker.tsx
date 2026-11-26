import { useMemo, useState } from "react";
import { fitastGaraBoard } from "@/lib/arcieri/fitast-league.api";
import { garaPiazzole, savePiazzolaMates } from "@/lib/arcieri/scorecard.api";
import { nameKey } from "@/lib/arcieri/fitast-rank";
import { titleName } from "@/lib/arcieri/fitast-league";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, ErrorNote, TextInput } from "@/components/kit";
import { Glyph } from "@/components/icons";

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Compagni di piazzola scelti a mano: si cercano nella classifica della gara (tutte le categorie) e
 * nell'elenco delle piazzole, oppure si scrive il nome. Serve quando non sei nell'elenco del portale
 * (per esempio da ospite) o l'elenco non c'è: scelto un compagno che è nell'elenco, sei nella sua piazzola.
 */
export function PiazzolaPicker({ compId, garaId, piazzola, onSaved }: { compId: number; garaId: string; piazzola: number | null; onSaved: () => void }) {
  const board = useLoad(`pz-pick-${garaId}`, () => (garaId ? fitastGaraBoard({ data: { garaId } }) : Promise.resolve({ arcieri: [], squadre: [] })));
  const lanesQ = useLoad(`pz-lanes-${compId}`, () => garaPiazzole({ data: { competitionId: compId } }));
  const laneOf = useMemo(() => new Map((lanesQ.data?.lanes ?? []).map((p) => [p.key, p.piazzola])), [lanesQ.data]);
  const [q, setQ] = useState("");
  const [lane, setLane] = useState(piazzola ? String(piazzola) : "");
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const people = useMemo(() => {
    const out = new Map<string, { name: string; team: string; category: string }>();
    for (const st of board.data?.arcieri ?? []) {
      for (const r of st.rows) {
        if (!r.name) continue;
        const key = `${fold(r.name)}|${fold(r.team ?? "")}`;
        if (!out.has(key)) out.set(key, { name: titleName(r.name), team: titleName(r.team ?? ""), category: st.category });
      }
    }
    // chi è nell'elenco delle piazzole ma non (ancora) in classifica
    for (const p of lanesQ.data?.lanes ?? []) {
      const key = `${fold(p.name)}|${fold(p.team)}`;
      if (![...out.values()].some((x) => nameKey(x.name) === p.key)) out.set(key, { name: p.name, team: p.team, category: "" });
    }
    return [...out.values()];
  }, [board.data, lanesQ.data]);
  // stesso nome, oppure un nome scritto a mano che contiene nome e cognome dell'elenco
  const pzOf = (name: string) => {
    const k = nameKey(name);
    if (laneOf.has(k)) return laneOf.get(k) ?? null;
    const words = new Set(k.split(" "));
    for (const [key, n] of laneOf) if (key.split(" ").length >= 2 && key.split(" ").every((w) => words.has(w))) return n;
    return null;
  };
  // la piazzola del primo compagno scelto che è nell'elenco: lì ti metto
  const fromMate = picked.map(pzOf).find((x) => x != null) ?? null;
  const words = fold(q).split(" ").filter(Boolean);
  const hits = words.length ? people.filter((p) => words.every((w) => fold(`${p.name} ${p.team}`).includes(w)) && !picked.includes(p.name)).slice(0, 8) : [];

  async function save() {
    setErr("");
    setSaving(true);
    try {
      await savePiazzolaMates({ data: { competitionId: compId, piazzola: Number(lane) || 0, names: picked } });
      setPicked([]);
      setQ("");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Non riesco a salvarli.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-xl border border-line p-2.5">
      <p className="text-sm font-semibold">Scegli tu chi era con te</p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Piazzola di partenza</span>
        <TextInput className="!w-20" inputMode="numeric" value={lane} onChange={(e) => setLane(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder={laneOf.size ? "auto" : "11"} aria-label="Piazzola di partenza" />
      </div>
      {laneOf.size ? <p className="text-[0.7rem] text-muted">Scegli un compagno della tua piazzola: ti metto nella sua, con tutto il gruppo dell'elenco del portale.</p> : null}
      <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={people.length ? `Cerca fra i ${people.length} arcieri della gara` : "Scrivi nome e cognome"} aria-label="Cerca un arciere della gara" />
      {hits.length ? (
        <ul className="grid gap-1">
          {hits.map((p) => (
            <li key={`${p.name}|${p.team}`}>
              <button type="button" onClick={() => { const pz = pzOf(p.name); if (pz != null && !picked.some((n) => pzOf(n) != null)) setLane(String(pz)); setPicked((x) => [...x, p.name]); setQ(""); }} className="flex w-full min-w-0 items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-left">
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{p.name}</b>
                  <span className="block truncate text-[0.68rem] text-muted">{[p.team, p.category, pzOf(p.name) != null ? `piazzola ${pzOf(p.name)}` : ""].filter(Boolean).join(" · ")}</span>
                </span>
                <Glyph name="plus" size={14} className="shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {q.trim().length >= 4 && !hits.length ? (
        <button type="button" onClick={() => { const n = titleName(q.trim()); const pz = pzOf(n); if (pz != null && !picked.some((x) => pzOf(x) != null)) setLane(String(pz)); setPicked((x) => [...x, n]); setQ(""); }} className="aa-chip justify-self-start">
          <Glyph name="plus" size={13} /> Aggiungi «{titleName(q.trim())}»
        </button>
      ) : null}
      {picked.length ? (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((n) => (
            <button key={n} type="button" onClick={() => setPicked((x) => x.filter((y) => y !== n))} className="aa-chip" aria-label={`Togli ${n}`}>
              {n} <Glyph name="close" size={12} />
            </button>
          ))}
        </div>
      ) : null}
      {err ? <ErrorNote text={err} /> : null}
      {fromMate != null ? <p className="text-[0.7rem] text-muted">Ti metto nella piazzola {fromMate}, quella del tuo compagno.</p> : null}
      <Button onClick={() => void save()} disabled={saving || !picked.length || (!lane && fromMate == null)}>{saving ? "Salvo…" : `Salva ${picked.length > 1 ? `i ${picked.length} compagni` : "il compagno"} di piazzola`}</Button>
    </div>
  );
}
