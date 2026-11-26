import { useState } from "react";
import { ToolArt } from "@/components/tool-art";
import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { Num, num, fmt } from "@/components/tool-kit";
import { useLocalState } from "@/lib/arcieri/local-store";

export const Route = createFileRoute("/_app/assetto")({ component: Page });

/** Registro dell'assetto: brace height, tiller e punto d'incocco nel tempo, con la differenza dalla volta prima. */
type Row = { at: string; brace: number; top: number; bottom: number; nock: number; note: string };

function Page() {
  const [rows, setRows] = useLocalState<{ list: Row[] }>("aa-assetto-v1", { list: [] });
  const last = rows.list[0];
  const [f, setF] = useState({ brace: last ? String(last.brace).replace(".", ",") : "21,5", top: last ? String(last.top) : "", bottom: last ? String(last.bottom) : "", nock: last ? String(last.nock) : "", note: "" });
  const tiller = num(f.top) - num(f.bottom);
  const save = () => {
    const r: Row = { at: new Date().toISOString(), brace: num(f.brace), top: num(f.top), bottom: num(f.bottom), nock: num(f.nock), note: f.note.trim() };
    setRows({ list: [r, ...rows.list].slice(0, 60) });
    setF({ ...f, note: "" });
  };
  const delta = (a: number, b?: number, unit = "") => (b == null || !Number.isFinite(a - b) || a === b ? null : <span className={a > b ? "text-amber-300" : "text-sky-300"}> {a > b ? "+" : ""}{fmt(a - b, 1)}{unit}</span>);
  return (
    <div className="grid gap-3">
      <PageHead kicker="Prepara" title="Assetto arco" lede="Segna le misure quando le controlli: vedi subito se qualcosa si è spostato." />
      <ToolArt id="assetto" />
      <Card className="grid gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Num label="Brace height" unit="cm" value={f.brace} onChange={(brace) => setF({ ...f, brace })} />
          <Num label="Punto d'incocco" unit="mm" value={f.nock} onChange={(nock) => setF({ ...f, nock })} hint="sopra i 90°" />
          <Num label="Tiller alto" unit="mm" value={f.top} onChange={(top) => setF({ ...f, top })} />
          <Num label="Tiller basso" unit="mm" value={f.bottom} onChange={(bottom) => setF({ ...f, bottom })} />
        </div>
        {Number.isFinite(tiller) && f.top && f.bottom ? <p className="text-sm">Tiller: <b>{tiller > 0 ? "+" : ""}{fmt(tiller, 1)} mm</b> {tiller > 0 ? "(positivo, il più comune)" : tiller < 0 ? "(negativo)" : "(neutro)"}</p> : null}
        <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Nota (es. corda nuova, bottone più duro)" className="min-h-11 rounded-xl border border-hair bg-black/20 px-3 text-sm outline-none" />
        <button type="button" onClick={save} className="aa-press min-h-12 rounded-2xl bg-primary font-semibold text-primary-fg">Segna le misure di oggi</button>
      </Card>
      {rows.list.length ? (
        <div className="grid gap-2">
          {rows.list.map((r, i) => {
            const prev = rows.list[i + 1];
            return (
              <Card key={r.at} className="grid gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">{new Date(r.at).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</p>
                  <button type="button" aria-label="Togli" className="grid h-8 w-8 place-items-center rounded-lg bg-white/5" onClick={() => setRows({ list: rows.list.filter((x) => x.at !== r.at) })}><Glyph name="trash" size={14} /></button>
                </div>
                <p className="text-sm tabular-nums">
                  Brace {fmt(r.brace, 1)} cm{delta(r.brace, prev?.brace)} · Tiller {fmt(r.top - r.bottom, 1)} mm{delta(r.top - r.bottom, prev ? prev.top - prev.bottom : undefined)} · Incocco {fmt(r.nock, 1)} mm{delta(r.nock, prev?.nock)}
                </p>
                {r.note ? <p className="text-xs text-muted">{r.note}</p> : null}
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
