import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLocalState } from "@/lib/arcieri/local-store";
import { pickQuiz, QUIZ_TOPICS, type QuizTopic } from "@/lib/arcieri/quiz-bank";
import { award } from "@/lib/arcieri/xp";

export const Route = createFileRoute("/_app/quiz")({ component: Page });

/** Quiz da 5 domande: risposta giusta = punti, spiegazione sempre. Le domande viste di recente non tornano subito. */
const SEEN_MAX = 60;

/** il contenuto della pagina, anche dentro un'altra pagina (senza intestazione) */
export function QuizBody({ embedded = false }: { embedded?: boolean }) {
  const [st, setSt] = useLocalState<{ best: number; games: number }>("aa-quiz-v1", { best: 0, games: 0 });
  const [seen, setSeen] = useLocalState<string[]>("aa-quiz-seen-v1", []);
  const [topic, setTopic] = useLocalState<QuizTopic | "misto">("aa-quiz-topic-v1", "misto");
  const [seed, setSeed] = useState(() => Date.now() % 233280);
  // la partita si sceglie per seme e argomento (e di nuovo appena letto il telefono): rispondere non la cambia
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const set = useMemo(() => pickQuiz(seed, topic, seen), [seed, topic, ready]);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = set[i];
  const end = i >= set.length;
  const restart = (t = topic) => {
    setTopic(t);
    setSeed((x) => (x * 7 + 13) % 233280);
    setI(0);
    setScore(0);
    setChosen(null);
  };
  const answer = (k: number) => {
    if (chosen != null) return;
    setChosen(k);
    setSeen([...seen.filter((x) => x !== q.id), q.id].slice(-SEEN_MAX));
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
      {embedded ? null : <PageHead kicker="Impara" title="Quiz" lede="Cinque domande sulle gare FITAST, il tiro istintivo, la storia dell'arco, l'attrezzatura e la sicurezza." />}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {QUIZ_TOPICS.map((t) => (
          <button key={t.id} type="button" onClick={() => restart(t.id)} aria-pressed={topic === t.id} className={`aa-press shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${topic === t.id ? "bg-primary text-primary-fg" : "bg-white/[0.06] text-muted"}`}>{t.label}</button>
        ))}
      </div>
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
          <button type="button" className="aa-press min-h-12 rounded-2xl bg-primary px-8 font-semibold text-primary-fg" onClick={() => restart()}>Nuova partita</button>
        </Card>
      )}
    </div>
  );
}

function Page() {
  return <QuizBody />;
}
