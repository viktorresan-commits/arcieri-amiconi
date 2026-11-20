import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLocalState } from "@/lib/arcieri/local-store";
import { QUIZ } from "@/lib/arcieri/learn";
import { award } from "@/lib/arcieri/xp";

export const Route = createFileRoute("/_app/quiz")({ component: Page });

/** Quiz da 5 domande: risposta giusta = punti, spiegazione sempre. */
function pickFive(seed: number) {
  const idx = QUIZ.map((_, i) => i);
  let s = seed;
  for (let i = idx.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 5);
}

function Page() {
  const [st, setSt] = useLocalState<{ best: number; games: number }>("aa-quiz-v1", { best: 0, games: 0 });
  const [seed, setSeed] = useState(() => Date.now() % 233280);
  const set = useMemo(() => pickFive(seed), [seed]);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = QUIZ[set[i]];
  const end = i >= set.length;
  const answer = (k: number) => {
    if (chosen != null) return;
    setChosen(k);
    if (k === q.correct) {
      setScore((x) => x + 1);
      award(5, "Risposta giusta al quiz");
      if (navigator.vibrate) navigator.vibrate(12);
    } else if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
  };
  const next = () => {
    const ni = i + 1;
    setI(ni);
    setChosen(null);
    if (ni >= set.length) {
      setSt({ best: Math.max(st.best, score), games: st.games + 1 });
      if (score === 5) award(15, "Quiz perfetto");
    }
  };
  return (
    <div className="grid gap-3">
      <PageHead kicker="Impara" title="Quiz" lede="Cinque domande su regole, tecnica e attrezzatura." />
      {!end ? (
        <Card className="grid gap-3">
          <div className="flex items-center gap-1.5">
            {set.map((_, k) => <span key={k} className={`h-1.5 flex-1 rounded-full ${k < i ? "bg-primary" : k === i ? "bg-white/40" : "bg-white/10"}`} />)}
          </div>
          <p key={i} className="aa-rise font-display text-2xl leading-tight">{q.q}</p>
          <div className="grid gap-2">
            {q.options.map((o, k) => {
              const state = chosen == null ? "" : k === q.correct ? "bg-emerald-500/25 ring-1 ring-emerald-400" : k === chosen ? "bg-rose-500/25 ring-1 ring-rose-400 aa-shake" : "opacity-50";
              return (
                <button key={o} type="button" onClick={() => answer(k)} className={`aa-press flex min-h-12 items-center gap-3 rounded-2xl bg-white/[0.05] px-3 text-left text-sm font-semibold transition ${state}`}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs">{String.fromCharCode(65 + k)}</span>
                  {o}
                  {chosen != null && k === q.correct ? <Glyph name="check" size={16} className="ml-auto text-emerald-300" /> : null}
                </button>
              );
            })}
          </div>
          {chosen != null ? (
            <div className="aa-rise grid gap-2">
              <p className="text-sm text-muted">{q.why}</p>
              <button type="button" onClick={next} className="aa-press min-h-12 rounded-2xl bg-primary font-semibold text-primary-fg">{i + 1 < set.length ? "Avanti" : "Risultato"}</button>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card className="grid justify-items-center gap-3 py-6 text-center">
          <p className="font-display text-6xl">{score}/5</p>
          <p className="text-sm">{score === 5 ? "Perfetto! +15 punti bonus." : score >= 3 ? "Bene: ripassa le spiegazioni e riprova." : "Si impara così: riprova con domande nuove."}</p>
          <p className="text-xs text-muted">Record {Math.max(st.best, score)}/5 · partite {st.games}</p>
          <button type="button" className="aa-press min-h-12 rounded-2xl bg-primary px-8 font-semibold text-primary-fg" onClick={() => { setSeed((x) => (x * 7 + 13) % 233280); setI(0); setScore(0); setChosen(null); }}>Nuova partita</button>
        </Card>
      )}
    </div>
  );
}
