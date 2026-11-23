import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AppIcon, Glyph } from "./icons";
import { drillOfDay, QUIZ } from "@/lib/arcieri/learn";
import { award, levelOf, today, useXp } from "@/lib/arcieri/xp";
import { useLocalState } from "@/lib/arcieri/local-store";

/**
 * "Oggi per te" in Home: livello in punti, la sfida del giorno e una domanda lampo
 * a cui si risponde direttamente qui, con un tocco. Dopo la risposta la domanda
 * resta visibile qualche secondo per la spiegazione, poi sparisce: la successiva
 * compare 12 ore dopo.
 */
const QUIZ_GAP = 12 * 60 * 60 * 1000;
type Lampo = { n: number; at: number | null; k: number | null };
function quizAt(n: number) {
  return QUIZ[(n * 7 + 3) % QUIZ.length] ?? QUIZ[0];
}
export function TodayCard() {
  const xp = useXp();
  const lv = levelOf(xp.xp);
  const d = drillOfDay();
  const day = today();
  const [done] = useLocalState<{ done: string[] }>("aa-sfida-giorno-v1", { done: [] });
  const [lampo, setLampo] = useLocalState<Lampo>("aa-quiz-lampo-v2", { n: Math.floor(Date.now() / QUIZ_GAP), at: null, k: null });
  // appena risposto la card resta qualche secondo, poi si chiude
  const [justNow, setJustNow] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    // passate 12 ore dalla risposta arriva la domanda successiva
    if (lampo.at != null && now - lampo.at >= QUIZ_GAP) setLampo({ n: lampo.n + 1, at: null, k: null });
  }, [lampo, now, setLampo]);
  useEffect(() => {
    if (!justNow) return;
    const t = window.setTimeout(() => setJustNow(false), 7000);
    return () => window.clearTimeout(t);
  }, [justNow]);
  const q = quizAt(lampo.n);
  const answered = lampo.at != null ? lampo.k : null;
  const showQuiz = lampo.at == null || justNow;
  const [flip, setFlip] = useState(0);
  const pick = (k: number) => {
    if (answered != null) return;
    setLampo({ n: lampo.n, at: Date.now(), k });
    setJustNow(true);
    setFlip((f) => f + 1);
    if (k === q.correct) award(10, "Domanda lampo", `qlampo-${lampo.n}`);
    else if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
  };
  const drillDone = done.done.includes(day);
  return (
    <section className="aa-today grid gap-3 rounded-[var(--radius-card)] p-3.5">
      <div className="flex items-center gap-3">
        <div className="relative grid h-14 w-14 shrink-0 place-items-center">
          <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
            <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth="5" />
            <circle cx="28" cy="28" r="24" fill="none" stroke="url(#aa-xp-g)" strokeWidth="5" strokeLinecap="round" strokeDasharray={150.8} strokeDashoffset={150.8 * (1 - lv.into / lv.need)} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)" }} />
            <defs><linearGradient id="aa-xp-g"><stop offset="0" stopColor="#f6c43a" /><stop offset="1" stopColor="#e07a2f" /></linearGradient></defs>
          </svg>
          <span className="font-display text-xl">{lv.level}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted">Oggi per te</p>
          <p className="font-semibold">Livello {lv.level} · {xp.xp} punti</p>
          <p className="text-xs text-muted">{lv.need - lv.into} punti al prossimo livello</p>
        </div>
      </div>
      <Link to="/sfida-giorno" className="aa-press flex items-center gap-3 rounded-2xl bg-white/[0.05] p-2.5">
        <AppIcon name="daily" size={40} />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.62rem] font-semibold uppercase tracking-wider text-muted">Sfida del giorno · +{d.xp}</span>
          <span className="block truncate font-semibold">{d.title}</span>
        </span>
        {drillDone ? <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/25 text-emerald-200"><Glyph name="check" size={14} strokeWidth={2.6} /></span> : <Glyph name="chevron" size={16} className="text-muted" />}
      </Link>
      {showQuiz ? <div className="grid gap-2 rounded-2xl bg-white/[0.05] p-2.5">
        <p className="flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-wider text-muted"><Glyph name="quiz" size={22} className="aa-tone-hi shrink-0" />Domanda lampo · +10</p>
        <p className="text-sm font-semibold">{q.q}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {q.options.map((o, k) => {
            const tone = answered == null ? "bg-white/[0.06]" : k === q.correct ? "bg-emerald-500/25 ring-1 ring-emerald-400" : k === answered ? "aa-shake bg-rose-500/25 ring-1 ring-rose-400" : "bg-white/[0.04] opacity-50";
            return (
              <button key={`${o}-${flip}`} type="button" onClick={() => pick(k)} className={`aa-press min-h-10 rounded-xl px-2 text-xs font-semibold transition ${tone}`}>{o}</button>
            );
          })}
        </div>
        {answered != null ? <p className="aa-rise text-xs text-muted">{q.why} <Link to="/quiz" className="font-semibold text-primary">Altre domande</Link></p> : null}
      </div> : null}
    </section>
  );
}
