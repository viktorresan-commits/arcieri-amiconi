import { useState } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLocalState } from "@/lib/arcieri/local-store";

/** Le unità che l'arciere incontra, a coppie: a × k = b. */
export const UNIT_PAIRS = [
  { id: "lb", a: "lb", b: "kg", k: 0.45359237, hint: "Libbraggio" },
  { id: "in", a: "pollici", b: "cm", k: 2.54, hint: "Allungo, freccia, arco" },
  { id: "yd", a: "iarde", b: "metri", k: 0.9144, hint: "Distanze" },
  { id: "gr", a: "grani", b: "grammi", k: 0.06479891, hint: "Peso di punte e frecce" },
  { id: "fps", a: "fps", b: "m/s", k: 0.3048, hint: "Velocità" },
  { id: "ftlb", a: "ft·lb", b: "joule", k: 1.35582, hint: "Energia" },
] as const;

type Pair = (typeof UNIT_PAIRS)[number];

/** per ogni unità scritta accanto a un campo: la coppia e da che lato sta */
const ALIAS: Record<string, { id: Pair["id"]; side: "a" | "b" }> = {
  lb: { id: "lb", side: "a" }, libbre: { id: "lb", side: "a" }, kg: { id: "lb", side: "b" },
  pollici: { id: "in", side: "a" }, "″": { id: "in", side: "a" }, in: { id: "in", side: "a" }, cm: { id: "in", side: "b" },
  iarde: { id: "yd", side: "a" }, yd: { id: "yd", side: "a" }, m: { id: "yd", side: "b" }, metri: { id: "yd", side: "b" },
  gr: { id: "gr", side: "a" }, grani: { id: "gr", side: "a" }, g: { id: "gr", side: "b" }, grammi: { id: "gr", side: "b" },
  fps: { id: "fps", side: "a" }, "m/s": { id: "fps", side: "b" },
  "ft·lb": { id: "ftlb", side: "a" }, j: { id: "ftlb", side: "b" }, joule: { id: "ftlb", side: "b" },
};

export function unitPair(unit?: string) {
  const hit = unit ? ALIAS[unit.trim().toLowerCase()] : undefined;
  if (!hit) return null;
  const pair = UNIT_PAIRS.find((p) => p.id === hit.id)!;
  return { pair, side: hit.side, mine: hit.side === "a" ? pair.a : pair.b, other: hit.side === "a" ? pair.b : pair.a };
}

const toNum = (s: string) => Number(String(s).replace(",", "."));
const show = (x: number, d = 3) => (Number.isFinite(x) ? String(Math.round(x * 10 ** d) / 10 ** d).replace(".", ",") : "");

function Box({ label, value, onChange, auto = false }: { label: string; value: string; onChange: (v: string) => void; auto?: boolean }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-center rounded-xl border border-hair bg-black/20 px-3 focus-within:border-primary/70">
        <input inputMode="decimal" autoFocus={auto} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 w-full min-w-0 bg-transparent text-base tabular-nums outline-none" />
      </span>
    </label>
  );
}

/** tutte le coppie di unità, una sotto l'altra (pagina Convertitore e «Altre unità» nel popup) */
export function AllUnits() {
  const [st, setSt] = useLocalState<Record<string, string>>("aa-unita-v1", {});
  return (
    <div className="grid gap-2">
      {UNIT_PAIRS.map((p) => {
        const a = st[`${p.id}a`] ?? "";
        const b = st[`${p.id}b`] ?? "";
        return (
          <Card key={p.id} className="grid gap-1.5">
            <p className="text-xs text-muted">{p.hint}</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <Box label={p.a} value={a} onChange={(v) => setSt({ ...st, [`${p.id}a`]: v, [`${p.id}b`]: v.trim() ? show(toNum(v) * p.k) : "" })} />
              <span className="pb-3 text-muted">⇄</span>
              <Box label={p.b} value={b} onChange={(v) => setSt({ ...st, [`${p.id}b`]: v, [`${p.id}a`]: v.trim() ? show(toNum(v) / p.k) : "" })} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Convertitore a comparsa: si apre dal campo che si sta compilando. Scrivi il valore nell'altra unità
 * (per esempio i kg della bilancia) e con «Usa» finisce nel campo, già convertito.
 */
export function ConverterSheet({ unit, value, onUse, onClose }: { unit?: string; value?: string; onUse?: (v: string) => void; onClose: () => void }) {
  const info = unitPair(unit);
  const [mine, setMine] = useState(value ?? "");
  const [other, setOther] = useState(() => (info && value && Number.isFinite(toNum(value)) && value.trim() ? show(info.side === "a" ? toNum(value) * info.pair.k : toNum(value) / info.pair.k, 2) : ""));
  const [all, setAll] = useState(!info);
  const fromMine = (v: string) => {
    setMine(v);
    if (info) setOther(v.trim() ? show(info.side === "a" ? toNum(v) * info.pair.k : toNum(v) / info.pair.k, 2) : "");
  };
  const fromOther = (v: string) => {
    setOther(v);
    if (info) setMine(v.trim() ? show(info.side === "a" ? toNum(v) / info.pair.k : toNum(v) * info.pair.k, 2) : "");
  };
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 backdrop-blur-[2px] md:items-center" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Convertitore" onClick={(e) => e.stopPropagation()} className="aa-rise grid max-h-[86dvh] w-full max-w-md gap-3 overflow-y-auto rounded-t-[1.6rem] border border-white/10 bg-elev p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:rounded-[1.6rem]">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-2xl leading-none">Convertitore</p>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.08] text-lg leading-none">×</button>
        </div>
        {info ? (
          <div className="grid gap-2">
            <p className="text-xs text-muted">{info.pair.hint}: scrivi in una delle due caselle.</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <Box label={`${info.mine} (questo campo)`} value={mine} onChange={fromMine} />
              <span className="pb-3 text-muted">⇄</span>
              <Box label={info.other} value={other} onChange={fromOther} auto />
            </div>
            {onUse ? (
              <button type="button" disabled={!mine.trim() || !Number.isFinite(toNum(mine))} onClick={() => { onUse(mine); onClose(); }} className="aa-press min-h-11 rounded-2xl bg-accent text-sm font-bold text-accent-fg disabled:opacity-40">
                Usa {mine.trim() ? `${mine} ${info.mine}` : "il valore"} nel campo
              </button>
            ) : null}
          </div>
        ) : null}
        {info ? (
          <button type="button" onClick={() => setAll((x) => !x)} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-sm font-semibold">
            Altre unità <Glyph name="chevron" size={14} className={all ? "rotate-90" : ""} />
          </button>
        ) : null}
        {all ? <AllUnits /> : null}
      </div>
    </div>,
    document.body,
  );
}

/** il piccolo pulsante ⇄ accanto a un campo con unità: apre il convertitore già sulla coppia giusta */
export function ConvertButton({ unit, value, onUse, className = "" }: { unit: string; value?: string; onUse?: (v: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!unitPair(unit)) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Converti ${unit}`} title={`Converti ${unit}`} className={`grid h-7 min-w-7 shrink-0 place-items-center rounded-lg bg-white/[0.08] px-1.5 text-[0.75rem] font-bold text-muted transition hover:text-fg active:scale-95 ${className}`}>
        ⇄
      </button>
      {open ? <ConverterSheet unit={unit} value={value} onUse={onUse} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** pulsante «Convertitore» per le pagine con molte misure: apre tutte le coppie */
export function ConverterChip({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`aa-chip ${className}`}><Glyph name="ruler" size={14} /> Convertitore</button>
      {open ? <ConverterSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}
