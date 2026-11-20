import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAvatar } from "@/components/avatar-hero";
import { LessonArt } from "@/components/lesson-art";
import { Button, Card, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { LESSONS, LEVELS, type Lesson } from "@/lib/arcieri/lessons";
import { useLocalState } from "@/lib/arcieri/local-store";
import { award } from "@/lib/arcieri/xp";

export const Route = createFileRoute("/_app/lezioni")({
  component: Page,
});

/** Corso in tre livelli: ogni lezione ha un disegno, i punti chiave, gli errori, un esercizio e una domanda. */
function Page() {
  const [st, setSt] = useLocalState<{ done: string[]; open: string | null }>("aa-lezioni-v1", { done: [], open: null });
  const { shown } = useAvatar();
  const lesson = LESSONS.find((l) => l.id === st.open) ?? null;
  const done = new Set(st.done);
  const markDone = (id: string) => {
    if (done.has(id)) return;
    setSt((s) => ({ ...s, done: [...s.done, id] }));
    award(10, `Lezione: ${LESSONS.find((l) => l.id === id)?.title ?? id}`, `lezione-${id}`);
  };

  if (lesson) {
    const level = LEVELS.find((l) => l.n === lesson.level) ?? LEVELS[0];
    const list = LESSONS.filter((l) => l.level === lesson.level);
    const i = list.findIndex((l) => l.id === lesson.id);
    const next = list[i + 1] ?? LESSONS.find((l) => l.level === lesson.level + 1) ?? null;
    return (
      <div className="grid gap-3">
        <button type="button" onClick={() => setSt((s) => ({ ...s, open: null }))} className="aa-chip justify-self-start"><Glyph name="chevron" size={13} className="rotate-180" /> Tutte le lezioni</button>
        <div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em]" style={{ color: level.color }}>Livello {level.n} · {level.name} · {i + 1}/{list.length}</p>
          <h1 className="font-display text-[2rem] leading-tight">{lesson.title}</h1>
          <p className="text-sm text-muted">{lesson.intro}</p>
        </div>
        <LessonArt art={lesson.art} look={shown} />
        <LessonBody lesson={lesson} done={done.has(lesson.id)} onDone={() => markDone(lesson.id)} />
        {next ? (
          <Button variant="ghost" onClick={() => { setSt((s) => ({ ...s, open: next.id })); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            Prossima: {next.title}
          </Button>
        ) : null}
      </div>
    );
  }

  const total = LESSONS.length;
  return (
    <div className="grid gap-3">
      <PageHead kicker="Impara" title="Lezioni" lede="Dal primo tiro alla gara, in tre livelli. Ogni lezione ha un disegno, gli errori da evitare, un esercizio e una domanda.">
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#7cf0a8]" style={{ width: `${(st.done.length / total) * 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-white/70">{st.done.length} di {total} completate</p>
      </PageHead>
      {LEVELS.map((lv) => {
        const list = LESSONS.filter((l) => l.level === lv.n);
        const n = list.filter((l) => done.has(l.id)).length;
        return (
          <Card key={lv.n} className="grid gap-2">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-display text-xl text-[#0b120e]" style={{ background: lv.color }}>{lv.n}</span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl leading-tight">{lv.name}</p>
                <p className="text-xs text-muted">{lv.sub} · {n}/{list.length}</p>
              </div>
              {n === list.length ? <Glyph name="medal" size={22} /> : null}
            </div>
            <ul className="grid gap-1.5">
              {list.map((l, k) => (
                <li key={l.id}>
                  <button type="button" onClick={() => { setSt((s) => ({ ...s, open: l.id })); window.scrollTo({ top: 0 }); }} className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-left">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${done.has(l.id) ? "bg-[#7cf0a8] text-[#0b120e]" : "border border-line"}`}>{done.has(l.id) ? <Glyph name="check" size={15} /> : k + 1}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm">{l.title}</b>
                      <span className="text-[0.7rem] text-muted">{l.minutes} min · {l.points.length} punti chiave</span>
                    </span>
                    <Glyph name="chevron" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function LessonBody({ lesson, done, onDone }: { lesson: Lesson; done: boolean; onDone: () => void }) {
  const [answer, setAnswer] = useState<number | null>(null);
  const right = answer === lesson.quiz.correct;
  return (
    <>
      <Card className="grid gap-2">
        <p className="aa-section-title">Punti chiave</p>
        <ol className="grid gap-1.5">
          {lesson.points.map((p, i) => (
            <li key={p} className="flex gap-2 text-sm leading-snug">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#2f8f6a] text-xs font-bold text-[#0b120e]">{i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </Card>
      <Card className="grid gap-2">
        <p className="aa-section-title">Errori tipici</p>
        <ul className="grid gap-1.5">
          {lesson.errors.map((e) => (
            <li key={e} className="flex gap-2 rounded-xl bg-[#e07a72]/10 px-2.5 py-2 text-sm"><Glyph name="close" size={15} className="mt-0.5 shrink-0 text-[#e07a72]" />{e}</li>
          ))}
        </ul>
      </Card>
      <Card className="grid gap-1.5">
        <p className="aa-section-title">Esercizio</p>
        <p className="text-sm">{lesson.drill}</p>
      </Card>
      <Card className="grid gap-2">
        <p className="aa-section-title">Verifica</p>
        <p className="text-sm font-semibold">{lesson.quiz.q}</p>
        <div className="grid gap-1.5">
          {lesson.quiz.options.map((o, i) => {
            const picked = answer === i;
            const tone = answer == null ? "border-line" : i === lesson.quiz.correct ? "border-[#7cf0a8] bg-[#7cf0a8]/10" : picked ? "border-[#e07a72] bg-[#e07a72]/10" : "border-line opacity-60";
            return (
              <button key={o} type="button" disabled={answer != null && right} onClick={() => { setAnswer(i); if (i === lesson.quiz.correct) onDone(); }} className={`min-h-11 rounded-xl border px-3 text-left text-sm ${tone}`}>
                {o}
              </button>
            );
          })}
        </div>
        {answer != null ? <p className={`text-sm ${right ? "text-[#7cf0a8]" : "text-[#f2a65a]"}`}>{right ? "Giusto. " : "Non proprio. "}{lesson.quiz.why}</p> : null}
        {done ? <p className="text-xs text-muted"><Glyph name="check" size={12} className="mr-1 inline" />Lezione completata (+10 punti esperienza).</p> : <button type="button" className="justify-self-start text-xs text-muted underline" onClick={onDone}>Segna come fatta senza domanda</button>}
      </Card>
    </>
  );
}
