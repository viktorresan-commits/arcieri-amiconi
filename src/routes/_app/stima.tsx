import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHead } from "@/components/kit";
import { useLocalState } from "@/lib/arcieri/local-store";
import { award } from "@/lib/arcieri/xp";

export const Route = createFileRoute("/_app/stima")({ component: Page });

/**
 * Stima delle distanze: una sagoma (alta circa 80 cm) compare nel bosco a una distanza tra 5 e 45 m.
 * Indovina i metri: più ti avvicini, più punti. 5 sagome a partita.
 */
const rnd = () => 5 + Math.round(Math.random() * 40);

function Scene({ d, show }: { d: number; show: boolean }) {
  // prospettiva: orizzonte a y=90, osservatore alto 1,6 m, focale tale che a 10 m la sagoma sia alta ~60 px
  const f = 750;
  const base = 90 + (1.6 * f) / d / 1.5;
  const hpx = (0.8 * f) / d / 1.5;
  const w = hpx * 1.5;
  return (
    <svg viewBox="0 0 320 220" className="w-full rounded-2xl">
      <defs>
        <linearGradient id="st-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b4a6b" /><stop offset="1" stopColor="#7aa6c4" /></linearGradient>
        <linearGradient id="st-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d6b3a" /><stop offset="1" stopColor="#1f3d1f" /></linearGradient>
      </defs>
      <rect width="320" height="90" fill="url(#st-sky)" />
      <rect y="90" width="320" height="130" fill="url(#st-g)" />
      {[20, 60, 250, 290, 140].map((x, i) => <path key={x} d={`M${x} 92 l-16 0 l16 -${40 + i * 6} l16 ${40 + i * 6}z`} fill="#1d3a22" opacity={0.85} />)}
      {[0, 1, 2, 3, 4].map((k) => {
        const z = 5 + k * 10;
        const y = 90 + (1.6 * f) / z / 1.5;
        return <line key={k} x1="0" x2="320" y1={y} y2={y} stroke="#fff" strokeOpacity={0.05} />;
      })}
      <path d="M150 220 L158 92 L162 92 L170 220 Z" fill="#8a6a3a" opacity={0.35} />
      <g key={d} className="aa-pop" style={{ transformOrigin: `160px ${base}px` }}>
        <ellipse cx={160} cy={base} rx={w * 0.7} ry={hpx * 0.08} fill="#000" opacity={0.3} />
        <path d={`M${160 - w / 2} ${base - hpx * 0.15} q${w * 0.1} -${hpx * 0.8} ${w * 0.55} -${hpx * 0.75} q${w * 0.35} 0 ${w * 0.45} ${hpx * 0.3} l0 ${hpx * 0.45} l-${w * 0.15} ${hpx * 0.15} l-${w * 0.7} 0 z`} fill="#6e4a2a" stroke="#3b2617" strokeWidth={Math.max(0.5, hpx * 0.02)} />
        <circle cx={160 + w * 0.05} cy={base - hpx * 0.55} r={hpx * 0.1} fill="#f4f1ea" />
        <circle cx={160 + w * 0.05} cy={base - hpx * 0.55} r={hpx * 0.05} fill="#d63a2f" />
      </g>
      {show ? <text x="160" y="30" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff">{d} m</text> : null}
    </svg>
  );
}

function Page() {
  const [best, setBest] = useLocalState<{ best: number }>("aa-stima-v1", { best: 0 });
  const [d, setD] = useState(rnd);
  const [guess, setGuess] = useState(20);
  const [shown, setShown] = useState(false);
  const [round, setRound] = useState(1);
  const [pts, setPts] = useState(0);
  const err = Math.abs(guess - d);
  const gain = Math.max(0, 10 - err * 2);
  const over = round > 5;
  const confirm = () => {
    setShown(true);
    setPts((p) => p + gain);
    if (navigator.vibrate) navigator.vibrate(gain >= 8 ? [10, 30, 10] : 25);
  };
  const next = () => {
    if (round >= 5) {
      const tot = pts;
      if (tot > best.best) setBest({ best: tot });
      award(Math.round(tot / 5), "Stima distanze");
      setRound(6);
      return;
    }
    setRound(round + 1);
    setD(rnd());
    setShown(false);
  };
  return (
    <div className="grid gap-3">
      <PageHead kicker="Impara" title="Stima distanze" lede="Nel 3D le distanze non sono scritte: allena l'occhio. La sagoma è alta circa 80 cm." />
      {!over ? (
        <Card className="grid gap-3">
          <div className="flex justify-between text-xs text-muted"><span>Sagoma {round} di 5</span><span>Punti {pts}</span></div>
          <Scene d={d} show={shown} />
          <label className="grid gap-1">
            <span className="flex items-baseline justify-between"><span className="text-xs text-muted">La tua stima</span><b className="font-display text-3xl tabular-nums">{guess} m</b></span>
            <input type="range" min={5} max={50} value={guess} disabled={shown} onChange={(e) => setGuess(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
          </label>
          {!shown ? (
            <button type="button" className="aa-press min-h-12 rounded-2xl bg-primary font-semibold text-primary-fg" onClick={confirm}>Conferma</button>
          ) : (
            <div className="aa-rise grid gap-2 text-center">
              <p className="font-semibold">{err === 0 ? "Esatto!" : `Era a ${d} m: hai sbagliato di ${err} m`} · +{gain}</p>
              <button type="button" className="aa-press min-h-12 rounded-2xl bg-primary font-semibold text-primary-fg" onClick={next}>{round < 5 ? "Prossima sagoma" : "Risultato"}</button>
            </div>
          )}
        </Card>
      ) : (
        <Card className="grid justify-items-center gap-3 py-6 text-center">
          <p className="font-display text-6xl">{pts}<span className="text-2xl text-muted">/50</span></p>
          <p className="text-sm">{pts >= 40 ? "Occhio da cacciatore." : pts >= 25 ? "Buona stima: con l'allenamento scendi sotto i 3 m d'errore." : "Le distanze ingannano: riprova."}</p>
          <p className="text-xs text-muted">Record {Math.max(best.best, pts)}</p>
          <button type="button" className="aa-press min-h-12 rounded-2xl bg-primary px-8 font-semibold text-primary-fg" onClick={() => { setRound(1); setPts(0); setD(rnd()); setShown(false); }}>Gioca ancora</button>
        </Card>
      )}
    </div>
  );
}
