import { useEffect, useMemo, useRef, useState } from "react";
import { saveEntry } from "@/lib/arcieri/club.api";
import { refreshActivity } from "@/lib/arcieri/xp";
import { DIVISIONS, divisionOf } from "@/lib/arcieri/labels";
import { PADIGLIONE_SCORES, faceById, scoreAtRadius } from "@/lib/arcieri/scoring";
import { ANIMALS, animalByLabel } from "@/lib/arcieri/sagome";
import { BoarTarget } from "@/components/boar-target";
import { SagomaLab } from "@/components/sagoma-lab";
import { TargetFace } from "@/components/target-face";
import { ShotLab } from "@/components/shot-lab";
import { Button, ErrorNote, Field, TextArea, TextInput } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLocalState } from "@/lib/arcieri/local-store";

/**
 * Inserimento del punteggio di gara: piazzola per piazzola con i pulsanti dei punti (spot, corpo,
 * mancata sulle sagome; 10…M sul padiglione), avanzamento automatico, bersaglio facoltativo per
 * segnare dove ha colpito, oppure solo il totale. Ogni tocco si salva da solo.
 */
type Lane = { n: number; score: number; arrows: number[]; label: string; distanceM: number | null; note: string; aimAngle: string };
type Slot = { score: number; arrows: number[]; label: string; distanceM: number | null; note: string; aimAngle: string };
export type LaneEntry = {
  score: number | null;
  rank: number | null;
  laneCount: number | null;
  spot: number | null;
  championshipPoints: number | null;
  targetKind: "" | "padiglione" | "sagoma";
  category: string;
  piazzole: Lane[];
};

function knownAnimal(label: string) {
  const face = animalByLabel(label);
  return label.trim() && face.label.toLowerCase() === label.trim().toLowerCase() ? face : null;
}

export function LaneEditor({ compId, mine, onDone, onSaved }: { compId: number; mine: LaneEntry | null; onDone: () => void; onSaved: () => void }) {
  const initial = useMemo(() => Array.from({ length: 20 }, (_, i) => {
    const found = mine?.piazzole.find((p) => p.n === i + 1);
    return found ? { score: found.score, arrows: found.arrows ?? [], label: found.label ?? "", distanceM: found.distanceM ?? null, note: found.note ?? "", aimAngle: found.aimAngle ?? "" } : null;
  }), [mine]);
  const [slots, setSlots] = useState<(Slot | null)[]>(initial);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const [active, setActive] = useState(0);
  const cursor = useRef(0);
  const [rank, setRank] = useState(mine?.rank ? String(mine.rank) : "");
  const [division, setDivision] = useState(divisionOf(mine?.category ?? ""));
  const [total, setTotal] = useState(mine && !mine.piazzole.length && mine.score != null ? String(mine.score) : "");
  const [laneCount, setLaneCount] = useState(mine?.laneCount != null ? String(mine.laneCount) : mine?.piazzole.length ? String(mine.piazzole.length) : "");
  const [spot, setSpot] = useState(mine?.spot != null ? String(mine.spot) : "");
  const [champ, setChamp] = useState(mine?.championshipPoints != null ? String(mine.championshipPoints) : "");
  const [lanesOn, setLanesOn] = useState((mine?.piazzole.length ?? 0) > 0 || !(mine?.score != null));
  const [perLaneSt, setPerLaneSt] = useLocalState<{ n: number }>("aa-gara-perlane", { n: 0 });
  const perLane = perLaneSt.n;
  const setPerLane = (n: number) => setPerLaneSt({ n });
  const [showTarget, setShowTarget] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [startAt, setStartAt] = useState(1);
  const [kind, setKind] = useState<"padiglione" | "sagoma">(mine?.targetKind === "sagoma" ? "sagoma" : mine?.targetKind === "padiglione" ? "padiglione" : "padiglione");
  const [laneName, setLaneName] = useState(initial[0]?.label ?? "");
  const [laneNote, setLaneNote] = useState(initial[0]?.note ?? "");
  const [laneMeters, setLaneMeters] = useState(initial[0]?.distanceM != null ? String(initial[0].distanceM) : "");
  const [laneSide, setLaneSide] = useState(initial[0]?.aimAngle ?? "");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [marks, setMarks] = useState<({ nx: number; ny: number } | null)[][]>(() => {
    try {
      const raw = sessionStorage.getItem(`aa-gara-dots-${compId}`);
      const saved = raw ? JSON.parse(raw) as ({ nx: number; ny: number } | null)[][] : null;
      if (Array.isArray(saved) && saved.length === 20) return saved;
    } catch {
      /* la memoria del telefono può essere piena */
    }
    return initial.map((slot) => (slot?.arrows ?? []).map(() => null));
  });
  useEffect(() => {
    sessionStorage.setItem(`aa-gara-dots-${compId}`, JSON.stringify(marks));
  }, [marks, compId]);
  const queue = useRef(Promise.resolve());
  const legal = kind === "padiglione" ? PADIGLIONE_SCORES : [8, 5, 0];
  const filled = slots.flatMap((slot, i) => (slot == null ? [] : [{ n: i + 1, score: slot.score, arrows: slot.arrows, label: slot.label, distanceM: slot.distanceM, note: slot.note, aimAngle: slot.aimAngle }]));
  const sum = filled.reduce((totalScore, lane) => totalScore + lane.score, 0);
  const frecce = filled.reduce((totalArrows, lane) => totalArrows + lane.arrows.length, 0);
  const spotsFromArrows = filled.reduce((totalSpots, lane) => totalSpots + lane.arrows.filter((shot) => shot >= 8).length, 0);
  const spotsFollowArrows = kind === "sagoma" && filled.some((lane) => lane.arrows.length > 0);
  const usingLanes = lanesOn && filled.length > 0;
  const activeSlot = slots[active];
  const previewScores = activeSlot?.arrows.length
    ? activeSlot.arrows
    : activeSlot && (activeSlot.score === 8 || activeSlot.score === 5 || activeSlot.score === 0)
      ? [activeSlot.score]
      : [];
  const previewShots = previewScores.slice(0, 8).map((score, index) => {
    const mark = marks[active]?.[index];
    return { score, nx: mark?.nx ?? null, ny: mark?.ny ?? null };
  });

  function pick(index: number) {
    cursor.current = index;
    setActive(index);
    const slot = slots[index];
    setLaneName(slot?.label ?? "");
    setLaneNote(slot?.note ?? "");
    setLaneMeters(slot?.distanceM != null ? String(slot.distanceM) : "");
    setLaneSide(slot?.aimAngle ?? "");
  }

  function metaNow() {
    const text = laneMeters.trim().replace(",", ".");
    const distance = text === "" ? null : Number(text);
    return { label: laneName.trim(), distanceM: distance != null && Number.isFinite(distance) ? distance : null, note: laneNote.trim(), aimAngle: laneSide };
  }

  function rowsOf(next: (Slot | null)[]) {
    return next.flatMap((slot, i) => (slot == null ? [] : [{ n: i + 1, score: slot.score, arrows: slot.arrows, label: slot.label, distanceM: slot.distanceM, note: slot.note, aimAngle: slot.aimAngle }]));
  }

  function persist(next: (Slot | null)[]) {
    const rows = rowsOf(next);
    if (!rows.length) return;
    const laneN = rows.length;
    const punti = rows.reduce((totalScore, lane) => totalScore + lane.score, 0);
    const counted = rows.reduce((totalSpots, lane) => totalSpots + lane.arrows.filter((shot) => shot >= 8).length, 0);
    const spotN = kind === "sagoma" && rows.some((lane) => lane.arrows.length > 0) ? counted : num(spot);
    const champN = num(champ);
    if ([spotN, champN].some((n) => Number.isNaN(n))) {
      setErr("Scrivi solo numeri.");
      return;
    }
    if (rank.trim() && !division) {
      setErr("Per il posto scegli Madonne, Messeri, Pueri o Juniores.");
      return;
    }
    setErr("");
    setSaved(false);
    queue.current = queue.current.then(() => saveEntry({
      data: {
        competitionId: compId,
        score: punti,
        rank: rank === "" ? null : Number(rank),
        category: division,
        notes: "",
        laneCount: laneN,
        spot: spotN,
        championshipPoints: champN,
        targetKind: kind,
        sagomaMax: kind === "sagoma" ? 8 : null,
        piazzole: rows,
      },
    })).then(() => {
      setSaved(true);
      onSaved();
    }).catch((e: unknown) => {
      setSaved(false);
      setErr(e instanceof Error ? e.message : "Errore");
    });
  }

  function writeSlot(index: number, slot: Slot | null) {
    setSlots((current) => current.map((value, i) => (i === index ? slot : value)));
  }

  function moveArrow(arrowIndex: number, score: number, nx: number, ny: number, done: boolean) {
    const index = cursor.current;
    const current = slotsRef.current[index];
    if (!current || arrowIndex < 0 || arrowIndex >= current.arrows.length) return;
    const arrows = current.arrows.map((value, i) => (i === arrowIndex ? score : value));
    const next = slotsRef.current.map((value, i) => (i === index ? { score: arrows.reduce((totalScore, shot) => totalScore + shot, 0), arrows, ...metaNow() } : value));
    slotsRef.current = next;
    setSlots(next);
    setMarks((rows) => rows.map((row, i) => {
      if (i !== index) return row;
      const copy = [...row];
      while (copy.length < arrows.length) copy.push(null);
      copy[arrowIndex] = { nx, ny };
      return copy;
    }));
    if (done) persist(next);
  }

  function placeArrow(score: number, nx: number | null, ny: number | null) {
    const index = cursor.current;
    const current = slotsRef.current[index];
    const arrows = [...(current?.arrows ?? []), score].slice(0, 8);
    const next = slotsRef.current.map((value, i) => (i === index ? { score: arrows.reduce((totalScore, shot) => totalScore + shot, 0), arrows, ...metaNow() } : value));
    slotsRef.current = next;
    setSlots(next);
    setMarks((rows) => rows.map((row, i) => (i === index ? [...row, nx == null || ny == null ? null : { nx, ny }].slice(0, 8) : row)));
    setErr("");
    persist(next);
  }

  function placeMany(hits: { score: number; nx: number; ny: number; miss: boolean }[]) {
    const index = cursor.current;
    const current = slotsRef.current[index];
    const arrows = [...(current?.arrows ?? [])];
    const extra: { nx: number; ny: number }[] = [];
    for (const hit of hits) {
      if (arrows.length >= 8) break;
      arrows.push(hit.miss ? 0 : hit.score);
      extra.push({ nx: hit.nx, ny: hit.ny });
    }
    const next = slotsRef.current.map((value, i) => (i === index ? { score: arrows.reduce((totalScore, shot) => totalScore + shot, 0), arrows, ...metaNow() } : value));
    slotsRef.current = next;
    setSlots(next);
    setMarks((rows) => rows.map((row, i) => (i === index ? [...row, ...extra].slice(0, 8) : row)));
    setErr("");
    persist(next);
  }

  function rememberPlace(distanceText: string, side: string) {
    setLaneMeters(distanceText);
    setLaneSide(side);
    const index = cursor.current;
    const current = slotsRef.current[index];
    if (!current?.arrows.length) return;
    const text = distanceText.trim().replace(",", ".");
    const distance = text === "" ? null : Number(text);
    const next = slotsRef.current.map((value, i) => (i === index && value ? { ...value, label: laneName.trim(), note: laneNote.trim(), aimAngle: side, distanceM: distance != null && Number.isFinite(distance) ? distance : null } : value));
    slotsRef.current = next;
    setSlots(next);
    persist(next);
  }

  function num(raw: string) {
    const text = raw.trim().replace(",", ".");
    if (!text) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : Number.NaN;
  }

  function wipeAll() {
    const empty = Array.from({ length: 20 }, () => null);
    slotsRef.current = empty;
    setSlots(empty);
    setMarks(empty.map(() => []));
    setLaneName("");
    setLaneNote("");
    setLaneMeters("");
    setLaneSide("");
    setSpot("");
    setTotal("");
    setSaved(false);
    const champN = num(champ);
    queue.current = queue.current.then(() => saveEntry({
      data: {
        competitionId: compId,
        score: 0,
        rank: rank.trim() && division ? Number(rank) : null,
        category: division,
        notes: "",
        laneCount: 0,
        spot: 0,
        championshipPoints: champN == null || Number.isNaN(champN) ? null : champN,
        targetKind: kind,
        sagomaMax: kind === "sagoma" ? 8 : null,
        piazzole: [],
      },
    })).then(() => {
      setErr("");
      setSaved(true);
      onSaved();
    }).catch((e: unknown) => {
      setSaved(false);
      setErr(e instanceof Error ? e.message : "Errore");
    });
  }

  function save() {
    setErr("");
    const laneN = usingLanes ? filled.length : num(laneCount);
    const punti = usingLanes ? sum : num(total);
    const spotN = spotsFollowArrows ? spotsFromArrows : num(spot);
    const champN = num(champ);
    if (rank.trim() && !division) {
      setErr("Per il posto scegli Madonne, Messeri, Pueri o Juniores.");
      return;
    }
    if (lanesOn && filled.some((lane) => lane.arrows.some((shot) => !legal.includes(shot)))) {
      setErr("C'è una freccia che non vale su questo bersaglio.");
      return;
    }
    if ([laneN, punti, spotN, champN].some((n) => Number.isNaN(n))) {
      setErr("Scrivi solo numeri.");
      return;
    }
    saveEntry({
      data: {
        competitionId: compId,
        score: punti,
        rank: rank === "" ? null : Number(rank),
        category: division,
        notes: "",
        laneCount: laneN,
        spot: spotN,
        championshipPoints: champN,
        targetKind: kind,
        sagomaMax: kind === "sagoma" ? 8 : null,
        piazzole: lanesOn ? filled : [],
      },
    })
      .then(() => {
        refreshActivity();
        onDone();
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"));
  }

  // ── inserimento guidato, piazzola per piazzola ──
  const order = Array.from({ length: 20 }, (_, step) => (startAt - 1 + step) % 20);
  const posInRound = order.indexOf(active);
  const go = (delta: number) => pick(order[(posInRound + delta + 20) % 20]);
  function quick(score: number) {
    const before = slotsRef.current[cursor.current]?.arrows.length ?? 0;
    placeArrow(score, null, null);
    if (perLane && before + 1 >= perLane) window.setTimeout(() => go(1), 380);
  }
  function removeArrow(arrowIndex: number) {
    const index = cursor.current;
    const current = slotsRef.current[index];
    if (!current) return;
    const arrows = current.arrows.filter((_, i) => i !== arrowIndex);
    const next = slotsRef.current.map((value, i) => (i === index ? (arrows.length ? { ...value!, arrows, score: arrows.reduce((t, x) => t + x, 0) } : null) : value));
    slotsRef.current = next;
    setSlots(next);
    setMarks((rows) => rows.map((row, i) => (i === index ? row.filter((_, j) => j !== arrowIndex) : row)));
    persist(next);
  }
  const quickScores = kind === "sagoma" ? [{ v: 8, label: "Spot", sub: "8", tone: "#e6b325" }, { v: 5, label: "Corpo", sub: "5", tone: "#3d9b74" }, { v: 0, label: "Mancata", sub: "0", tone: "#6b737d" }] : PADIGLIONE_SCORES.slice().sort((x, y) => y - x).map((v) => ({ v, label: v === 0 ? "M" : String(v), sub: "", tone: v >= 9 ? "#e6b325" : v >= 7 ? "#d63a2f" : v >= 5 ? "#2f7fd1" : v >= 3 ? "#1d2126" : v >= 1 ? "#e9e6dc" : "#6b737d" }));
  const laneState = (i: number) => {
    const sl = slots[i];
    if (!sl) return "empty";
    if (kind === "sagoma" && sl.arrows.some((x) => x >= 8)) return "spot";
    return "done";
  };

  return (
    <div className="grid min-w-0 gap-3 border-t border-line pt-3">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setKind("padiglione")} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold ${kind === "padiglione" ? "bg-primary text-primary-fg" : "border border-line"}`}><Glyph name="target" size={26} className="aa-tone-hi shrink-0" />Padiglione</button>
        <button type="button" onClick={() => setKind("sagoma")} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold ${kind === "sagoma" ? "bg-primary text-primary-fg" : "border border-line"}`}><img src={ANIMALS[0]?.src} alt="" className="h-7 w-9 object-contain" />Sagoma 3D</button>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.05] p-1">
        <button type="button" onClick={() => setLanesOn(true)} className={`min-h-10 rounded-xl text-sm font-semibold ${lanesOn ? "bg-elev shadow" : "text-muted"}`}>Piazzola per piazzola</button>
        <button type="button" onClick={() => setLanesOn(false)} className={`min-h-10 rounded-xl text-sm font-semibold ${!lanesOn ? "bg-elev shadow" : "text-muted"}`}>Solo il totale</button>
      </div>

      {lanesOn ? (
        <div className="grid gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Frecce per piazzola</span>
            <div className="flex gap-1">
              {[1, 2, 3, 0].map((k) => (
                <button key={k} type="button" aria-pressed={perLane === k} onClick={() => setPerLane(k)} className={`min-h-9 min-w-9 rounded-full px-2.5 text-xs font-semibold ${perLane === k ? "bg-accent text-accent-fg" : "border border-line"}`}>{k || "Libere"}</button>
              ))}
            </div>
          </div>
          {/* striscia delle piazzole: tocca per saltare */}
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {order.map((i) => {
              const stt = laneState(i);
              const sl = slots[i];
              return (
                <button key={i} type="button" onClick={() => pick(i)} aria-label={`Piazzola ${i + 1}`} className={`grid h-12 w-11 shrink-0 place-items-center rounded-xl border text-center leading-none ${active === i ? "border-accent ring-2 ring-accent/50" : "border-line"} ${stt === "spot" ? "bg-[#e6b325]/25" : stt === "done" ? "bg-primary/20" : "bg-white/[0.03]"}`}>
                  <span className="text-[0.62rem] text-muted">{i + 1}</span>
                  <span className="font-display text-sm tabular-nums">{sl ? sl.score : "·"}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 rounded-3xl border border-line bg-elev p-3">
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => go(-1)} aria-label="Piazzola precedente" className="grid h-11 w-11 place-items-center rounded-full border border-line"><Glyph name="chevron" size={18} className="rotate-180" /></button>
              <div className="text-center">
                <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted">Piazzola {posInRound + 1} di 20</p>
                <p className="font-display text-2xl leading-tight">{laneName || `N. ${active + 1}`}</p>
              </div>
              <button type="button" onClick={() => go(1)} aria-label="Piazzola successiva" className="grid h-11 w-11 place-items-center rounded-full border border-line"><Glyph name="chevron" size={18} /></button>
            </div>

            {kind === "sagoma" ? (
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {ANIMALS.map((animal) => {
                  const on = laneName === animal.label;
                  return (
                    <button key={animal.id} type="button" onClick={() => { setLaneName(animal.label); setSlots((current) => current.map((slot, i) => (i === active && slot ? { ...slot, label: animal.label } : slot))); }} className={`w-16 shrink-0 rounded-xl border px-1 py-1 ${on ? "border-accent bg-accent/15" : "border-line"}`}>
                      <img src={animal.src} alt="" className="mx-auto h-9 w-full object-contain" />
                      <span className="block truncate text-[0.6rem] font-semibold">{animal.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* frecce di questa piazzola */}
            <div className="flex min-h-10 flex-wrap items-center gap-1.5">
              {(activeSlot?.arrows ?? []).map((x, i) => (
                <button key={i} type="button" onClick={() => removeArrow(i)} aria-label={`Togli la freccia da ${x}`} className="flex items-center gap-1 rounded-full bg-white/[0.08] py-1 pl-3 pr-2 font-display text-lg tabular-nums">
                  {kind === "sagoma" ? (x >= 8 ? "8 spot" : x === 5 ? "5" : "0") : x === 0 ? "M" : x}
                  <Glyph name="close" size={13} className="text-muted" />
                </button>
              ))}
              {!(activeSlot?.arrows.length) ? <span className="text-sm text-muted">Tocca il punteggio di ogni freccia.</span> : null}
              {activeSlot ? <span className="ml-auto font-display text-2xl tabular-nums">{activeSlot.score}</span> : null}
            </div>

            <div className={`grid gap-2 ${kind === "sagoma" ? "grid-cols-3" : "grid-cols-4"}`}>
              {quickScores.map((q) => (
                <button key={q.v} type="button" onClick={() => quick(q.v)} className="grid min-h-16 place-items-center rounded-2xl border border-line text-center active:scale-95" style={{ background: `linear-gradient(160deg, ${q.tone}55, ${q.tone}22)` }}>
                  <span className="font-display text-2xl leading-none">{kind === "sagoma" ? q.sub : q.label}</span>
                  {kind === "sagoma" ? <span className="text-[0.68rem] font-semibold">{q.label}</span> : null}
                </button>
              ))}
            </div>

            <button type="button" onClick={() => setShowTarget((v) => !v)} className="text-left text-sm font-semibold text-accent">{showTarget ? "Nascondi il bersaglio" : "Segna dove ha colpito (facoltativo)"}</button>
            {showTarget ? (
              kind === "padiglione" ? (
                <>
                  <TargetFace
                    face={faceById("wa10")}
                    shots={previewShots}
                    onHit={(nx, ny) => {
                      const hit = scoreAtRadius(faceById("wa10"), Math.hypot(nx, ny));
                      placeArrow(hit.miss ? 0 : hit.score, nx, ny);
                    }}
                    onMove={(index, nx, ny, done) => {
                      const hit = scoreAtRadius(faceById("wa10"), Math.hypot(nx, ny));
                      moveArrow(index, hit.miss ? 0 : hit.score, nx, ny, done);
                    }}
                  />
                  <ShotLab face={faceById("wa10")} shots={previewShots.map((shot, index) => ({ score: shot.score, nx: shot.nx, ny: shot.ny, arrow: index, end: active, miss: shot.score === 0 }))} onPhoto={(hits) => placeMany(hits)} />
                </>
              ) : (
                <>
                  <BoarTarget animal={knownAnimal(laneName)?.id ?? ANIMALS[0]?.id} shots={previewShots} onScore={(score, _miss, nx, ny) => placeArrow(score, nx, ny)} onMove={(index, score, _miss, nx, ny, done) => moveArrow(index, score, nx, ny, done)} />
                  <SagomaLab animal={knownAnimal(laneName)?.id ?? "sagome-3d"} shots={previewShots} initial="tre" />
                </>
              )
            ) : null}

            <button type="button" onClick={() => setShowMore((v) => !v)} className="text-left text-xs font-semibold text-muted">{showMore ? "Meno dettagli" : "Distanza, posizione e nota della piazzola"}</button>
            {showMore ? (
              <div className="grid gap-2">
                {kind === "padiglione" ? (
                  <Field label="Nome piazzola">
                    <TextInput value={laneName} placeholder="Volée, sigla..." onChange={(e) => { const label = e.target.value; setLaneName(label); setSlots((current) => current.map((slot, i) => (i === active && slot ? { ...slot, label } : slot))); }} />
                  </Field>
                ) : null}
                <Field label="Distanza stimata (m)">
                  <TextInput inputMode="decimal" value={laneMeters} placeholder="15" onChange={(e) => rememberPlace(e.target.value, laneSide)} />
                </Field>
                <div className="grid grid-cols-3 gap-1.5">
                  {([["frontale", "Frontale"], ["destra", "A destra"], ["sinistra", "A sinistra"], ["alto", "In salita"], ["basso", "In discesa"]] as const).map(([side, label]) => (
                    <button key={side} type="button" onClick={() => rememberPlace(laneMeters, side)} className={`min-h-10 rounded-xl text-xs font-semibold ${laneSide === side ? "bg-accent text-accent-fg" : "border border-line"}`}>{label}</button>
                  ))}
                </div>
                <Field label="Nota">
                  <TextArea value={laneNote} placeholder="Cosa correggere, cosa è andato male" onChange={(e) => { const note = e.target.value; setLaneNote(note); setSlots((current) => current.map((slot, i) => (i === active && slot ? { ...slot, note } : slot))); }} />
                </Field>
                <label className="flex items-center gap-2 text-xs text-muted">
                  Parto dalla piazzola
                  <select value={startAt} onChange={(event) => { const next = Number(event.target.value); setStartAt(next); pick(next - 1); }} className="min-h-9 rounded-xl border border-line bg-transparent px-2">
                    {Array.from({ length: 20 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                  </select>
                </label>
                <Button variant="ghost" className="w-full" onClick={() => { writeSlot(cursor.current, null); slotsRef.current = slotsRef.current.map((value, i) => (i === cursor.current ? null : value)); setMarks((rows) => rows.map((row, i) => (i === cursor.current ? [] : row))); setLaneNote(""); setLaneSide(""); setLaneMeters(""); persist(slotsRef.current); }}>Svuota questa piazzola</Button>
                <Button variant="ghost" className="w-full" onClick={wipeAll}>Svuota tutte le piazzole</Button>
              </div>
            ) : null}
            {saved ? <p className="text-xs font-semibold text-accent">Salvato automaticamente</p> : null}
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <span className="rounded-xl bg-white/[0.05] py-2"><span className="block text-[0.6rem] uppercase tracking-wider text-muted">Punti</span><b className="font-display text-xl tabular-nums">{sum}</b></span>
            <span className="rounded-xl bg-white/[0.05] py-2"><span className="block text-[0.6rem] uppercase tracking-wider text-muted">Piazzole</span><b className="font-display text-xl tabular-nums">{filled.length}</b></span>
            <span className="rounded-xl bg-white/[0.05] py-2"><span className="block text-[0.6rem] uppercase tracking-wider text-muted">{kind === "sagoma" ? "Spot" : "Frecce"}</span><b className="font-display text-xl tabular-nums">{kind === "sagoma" ? spotsFromArrows : frecce}</b></span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Numero piazzole"><TextInput inputMode="numeric" value={laneCount} onChange={(e) => setLaneCount(e.target.value)} placeholder="20" /></Field>
          <Field label="Punti"><TextInput inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="186" /></Field>
          {kind === "sagoma" ? <Field label="Spot"><TextInput inputMode="numeric" value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="7" /></Field> : null}
        </div>
      )}

      <div className="grid gap-2 rounded-3xl border border-line p-3">
        <p className="aa-section-title">Risultato finale</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Posto"><TextInput inputMode="numeric" value={rank} onChange={(e) => setRank(e.target.value)} placeholder="3" /></Field>
          <Field label="Punti campionato"><TextInput inputMode="numeric" value={champ} onChange={(e) => setChamp(e.target.value)} placeholder="12" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {DIVISIONS.map((name) => (
            <button key={name} type="button" onClick={() => setDivision(name)} className={`min-h-10 rounded-xl px-3 text-sm font-semibold ${division === name ? "bg-primary text-primary-fg" : "border border-line"}`}>{name}</button>
          ))}
        </div>
        {err ? <ErrorNote text={err} /> : null}
        <Button className="w-full" onClick={save}>Salva e chiudi</Button>
      </div>
    </div>
  );
}

