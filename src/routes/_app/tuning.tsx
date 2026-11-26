import { useState } from "react";
import { ToolArt } from "@/components/tool-art";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Chips, PageHead } from "@/components/kit";
import { useLocalState } from "@/lib/arcieri/local-store";
import { award } from "@/lib/arcieri/xp";

export const Route = createFileRoute("/_app/tuning")({ component: Page });

/**
 * Prova dell'asta nuda (arco con le dita): tira 3 frecce impennate e 2 nude alla stessa mira,
 * poi tocca dove sono finite le nude rispetto al gruppo. Destro: nuda a sinistra = rigida, a destra = morbida.
 */
const CELLS = [
  ["su-sx", "su", "su-dx"],
  ["sx", "ok", "dx"],
  ["giu-sx", "giu", "giu-dx"],
];

function advice(cell: string, hand: "destro" | "mancino") {
  const out: string[] = [];
  const left = cell.endsWith("sx") || cell === "sx";
  const right = cell.endsWith("dx") || cell === "dx";
  if (cell.startsWith("su")) out.push("Nude alte: punto d'incocco troppo basso. Alzalo di 1–2 mm e riprova.");
  if (cell.startsWith("giu")) out.push("Nude basse: punto d'incocco troppo alto. Abbassalo di 1–2 mm e riprova.");
  const stiff = hand === "destro" ? left : right;
  const weak = hand === "destro" ? right : left;
  if (stiff) out.push("Nude dal lato dell'arco: freccia rigida. Aumenta le libbre o la punta, oppure ammorbidisci il bottone.");
  if (weak) out.push("Nude dal lato opposto all'arco: freccia morbida. Diminuisci punta o libbre, oppure indurisci il bottone.");
  if (cell === "ok") out.push("Nude nel gruppo: freccia e arco sono in accordo. Ripeti a 18 e a 30 m per conferma.");
  return out;
}

function Page() {
  const [st, setSt] = useLocalState<{ hand: "destro" | "mancino"; cell: string }>("aa-tuning-v1", { hand: "destro", cell: "" });
  const [anim, setAnim] = useState(0);
  const pick = (cell: string) => {
    setSt({ ...st, cell });
    setAnim((a) => a + 1);
    award(3, "Prova dell'asta nuda", `tuning-${new Date().toLocaleDateString("sv-SE")}`);
  };
  const pos = (cell: string) => {
    const r = CELLS.findIndex((row) => row.includes(cell));
    const c = r >= 0 ? CELLS[r].indexOf(cell) : 1;
    return { x: (c - 1) * 46, y: ((r < 0 ? 1 : r) - 1) * 46 };
  };
  const p = st.cell ? pos(st.cell) : null;
  return (
    <div className="grid gap-3">
      <PageHead kicker="Prepara" title="Asta nuda" lede="Tre frecce con le penne e due senza, stessa mira, a 18 m. Tocca dove sono finite le nude." />
      <ToolArt id="tuning" />
      <Chips value={st.hand} onChange={(hand) => setSt({ ...st, hand })} options={[{ id: "destro", label: "Arciere destro" }, { id: "mancino", label: "Mancino" }]} />
      <Card className="grid justify-items-center gap-3">
        <div className="relative">
          <svg viewBox="-80 -80 160 160" className="h-64 w-64">
            {["#f4f1ea", "#1d2126", "#2f7fd1", "#d63a2f", "#f2c94c"].map((c, i) => <circle key={c} r={76 * (1 - i * 0.2)} fill={c} />)}
            {[[-4, -3], [4, 2], [-2, 5]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.6" fill="#1d2126" stroke="#f2c94c" strokeWidth="1.6" />)}
            {p ? (
              <g key={anim} className="aa-pop">
                <circle cx={p.x - 3} cy={p.y} r="3.4" fill="#fff" stroke="#1d2126" strokeWidth="1.5" />
                <circle cx={p.x + 4} cy={p.y + 3} r="3.4" fill="#fff" stroke="#1d2126" strokeWidth="1.5" />
              </g>
            ) : null}
          </svg>
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
            {CELLS.flat().map((cell) => (
              <button key={cell} type="button" aria-label={cell} onClick={() => pick(cell)} className={`rounded-lg transition ${st.cell === cell ? "bg-white/10 ring-1 ring-white/40" : "active:bg-white/10"}`} />
            ))}
          </div>
        </div>
        <p className="text-xs text-muted">Pallini neri: gruppo con le penne. Bianchi: le nude.</p>
      </Card>
      {st.cell ? (
        <Card key={anim} className="aa-rise grid gap-2">
          {advice(st.cell, st.hand).map((t) => <p key={t} className="text-sm">{t}</p>)}
          <p className="text-[0.7rem] text-muted">Cambia una cosa alla volta e ritira. Vale per arco olimpico, nudo e tradizionale tirati con le dita.</p>
        </Card>
      ) : null}
    </div>
  );
}
