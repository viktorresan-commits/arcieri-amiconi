import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { LessonChart } from "@/components/lesson-charts";
import { GLOSSARY, GLOSS_CATS, type GlossCat } from "@/lib/arcieri/learn";
import { LESSONS } from "@/lib/arcieri/lessons";

export const Route = createFileRoute("/_app/glossario")({ component: Page });

/** Le parole dell'arciere: per categoria e in ordine alfabetico, con la lezione e il grafico che le spiegano. */
function Page() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<GlossCat | "tutte">("tutte");
  const [open, setOpen] = useState<string | null>(null);
  const [chart, setChart] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const list = useMemo(
    () => GLOSSARY.filter((g) => (cat === "tutte" || g.c === cat) && (g.t + " " + g.d).toLowerCase().includes(needle)).sort((a, b) => a.t.localeCompare(b.t, "it")),
    [cat, needle],
  );
  const count = (c: GlossCat) => GLOSSARY.filter((g) => g.c === c).length;
  // raggruppo per iniziale
  const groups: { letter: string; items: typeof list }[] = [];
  for (const g of list) {
    const letter = g.t[0].toUpperCase();
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.items.push(g);
    else groups.push({ letter, items: [g] });
  }
  return (
    <div className="grid gap-3">
      <PageHead kicker="Impara" title="Glossario" lede={`${GLOSSARY.length} parole dell'arciere, spiegate in breve. Tocca una parola: dove c'è, apri la lezione e il grafico che la spiegano.`} />
      <label className="flex items-center gap-2 rounded-2xl border border-hair bg-black/20 px-3">
        <Glyph name="eye" size={16} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca una parola" className="min-h-12 w-full bg-transparent text-sm outline-none" />
      </label>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        <button type="button" aria-pressed={cat === "tutte"} className="aa-chip shrink-0" onClick={() => setCat("tutte")}>Tutte · {GLOSSARY.length}</button>
        {GLOSS_CATS.map((c) => (
          <button key={c.id} type="button" aria-pressed={cat === c.id} className="aa-chip shrink-0" onClick={() => setCat(c.id)}>{c.label} · {count(c.id)}</button>
        ))}
      </div>
      {groups.map((grp) => (
        <Card key={grp.letter} className="grid gap-0.5">
          <p className="px-2 font-display text-2xl leading-none text-muted">{grp.letter}</p>
          {grp.items.map((g, i) => {
            const isOpen = open === g.t || needle !== "";
            const lesson = g.lesson ? LESSONS.find((l) => l.id === g.lesson) : null;
            const first = lesson?.charts?.[0] ?? null;
            return (
              <div key={g.t} className="grid gap-1 rounded-xl px-2 py-2">
                <button type="button" onClick={() => { setOpen(open === g.t ? null : g.t); setChart(null); }} className="aa-menu-row flex items-center justify-between text-left font-semibold active:bg-white/5" style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}>
                  <span>{g.t} <span className="ml-1 text-[0.62rem] font-normal uppercase tracking-[0.12em] text-muted">{GLOSS_CATS.find((c) => c.id === g.c)?.label}</span></span>
                  <Glyph name="chevron" size={14} className={`text-muted transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>
                {isOpen ? (
                  <div className="aa-rise grid gap-2">
                    <p className="text-sm text-muted">{g.d}</p>
                    {lesson ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Link to="/lezioni" search={{ l: lesson.id } as never} className="aa-chip">Lezione: {lesson.title}</Link>
                        {first ? <button type="button" aria-pressed={chart === g.t} className="aa-chip" onClick={() => setChart(chart === g.t ? null : g.t)}>{chart === g.t ? "Nascondi il grafico" : "Mostra il grafico"}</button> : null}
                      </div>
                    ) : null}
                    {chart === g.t && first ? <LessonChart id={first} /> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </Card>
      ))}
      {!list.length ? <Card><p className="text-sm text-muted">Nessuna parola trovata.</p></Card> : null}
    </div>
  );
}
