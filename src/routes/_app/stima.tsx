import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHead } from "@/components/kit";
import { useLocalState } from "@/lib/arcieri/local-store";
import { award } from "@/lib/arcieri/xp";

export const Route = createFileRoute("/_app/stima")({ component: Page });

/**
 * Stima delle distanze su fotografie di campi e boschi: il paglione (largo 1 m, alto 1,3 m da terra) è messo nella
 * foto con la prospettiva giusta (occhio a 1,6 m, orizzonte della foto misurato). Indovina i metri: più ti avvicini,
 * più punti. 5 bersagli a partita.
 */
const rnd = () => 5 + Math.round(Math.random() * 40);

/** foto 1008×1792: riga dell'orizzonte (punto di fuga del sentiero) misurata su ciascuna */
const PHOTOS = [
  { src: "/gioco/campo.jpg", horizon: 1040, haze: 0 },
  { src: "/gioco/montagna.jpg", horizon: 1035, haze: 0 },
  { src: "/gioco/prato.jpg", horizon: 1030, haze: 0 },
  { src: "/gioco/nebbia.jpg", horizon: 970, haze: 0.012 },
];
const PW = 1008;
const PH = 1792;
const F = 1080; // focale in pixel della foto (circa 50° di campo orizzontale)
const EYE = 1.6;

function Scene({ d, show, photo, lat }: { d: number; show: boolean; photo: number; lat: number }) {
  const ph = PHOTOS[photo % PHOTOS.length];
  const y0 = ph.horizon - 360;
  const vh = PH - y0;
  const px = (m: number) => (F * m) / d;
  const ground = ph.horizon + px(EYE);
  const cx = PW / 2 + Math.max(-PW * 0.3, Math.min(PW * 0.3, px(lat)));
  const boss = px(1);
  const top = ground - px(1.3);
  const leg = Math.max(1.5, px(0.05));
  return (
    <svg viewBox={`0 ${y0} ${PW} ${vh}`} className="w-full rounded-2xl" role="img" aria-label="Paglione nel campo: stima la distanza">
      <image href={ph.src} x="0" y="0" width={PW} height={PH} preserveAspectRatio="none" />
      <g key={`${d}-${photo}`} className="aa-pop" style={{ transformOrigin: `${cx}px ${ground}px` }}>
        <ellipse cx={cx + boss * 0.08} cy={ground} rx={boss * 0.75} ry={Math.max(2, boss * 0.07)} fill="#000" opacity="0.35" />
        {/* cavalletto: tre gambe di legno */}
        <path d={`M${cx - boss * 0.38} ${top + boss} L${cx - boss * 0.5} ${ground} M${cx + boss * 0.38} ${top + boss} L${cx + boss * 0.5} ${ground} M${cx} ${top + boss} L${cx + boss * 0.08} ${ground - px(0.05)}`} stroke="#5a3d22" strokeWidth={leg} strokeLinecap="round" />
        {/* paglione con il bersaglio, un po' scurito per la luce della foto */}
        <rect x={cx - boss / 2 + px(0.02)} y={top + px(0.02)} width={boss} height={boss} fill="#000" opacity="0.3" />
        <image href="/gioco/bersaglio.jpg" x={cx - boss / 2} y={top} width={boss} height={boss} preserveAspectRatio="none" style={{ filter: "brightness(0.82) saturate(0.85)" }} />
        {ph.haze ? <rect x={cx - boss / 2} y={top} width={boss} height={boss + px(0.3)} fill="#d9dde0" opacity={Math.min(0.55, ph.haze * d)} /> : null}
      </g>
      {show ? <text x={PW / 2} y={y0 + 120} textAnchor="middle" fontSize="96" fontWeight="800" fill="#fff" stroke="#000" strokeOpacity="0.45" strokeWidth="4" paintOrder="stroke">{d} m</text> : null}
    </svg>
  );
}

/** il contenuto della pagina, anche dentro un'altra pagina (senza intestazione) */
export function StimaBody({ embedded = false }: { embedded?: boolean }) {
  const [best, setBest] = useLocalState<{ best: number }>("aa-stima-v1", { best: 0 });
  const [d, setD] = useState(rnd);
  const [photo, setPhoto] = useState(() => Math.floor(Math.random() * PHOTOS.length));
  const [lat, setLat] = useState(() => (Math.random() - 0.5) * 3);
  const shuffle = () => {
    setPhoto((p) => (p + 1 + Math.floor(Math.random() * (PHOTOS.length - 1))) % PHOTOS.length);
    setLat((Math.random() - 0.5) * 3);
  };
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
    shuffle();
    setShown(false);
  };
  return (
    <div className="grid gap-3">
      {embedded ? null : <PageHead kicker="Impara" title="Stima distanze" lede="Nel 3D le distanze non sono scritte: allena l'occhio sulle foto. Il paglione è largo 1 m e arriva a 1,3 m da terra: usalo come metro." />}
      {!over ? (
        <Card className="grid gap-3">
          <div className="flex justify-between text-xs text-muted"><span>Bersaglio {round} di 5</span><span>Punti {pts}</span></div>
          <Scene d={d} show={shown} photo={photo} lat={lat} />
          <label className="grid gap-1">
            <span className="flex items-baseline justify-between"><span className="text-xs text-muted">La tua stima</span><b className="font-display text-3xl tabular-nums">{guess} m</b></span>
            <input type="range" min={5} max={50} value={guess} disabled={shown} onChange={(e) => setGuess(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
          </label>
          {!shown ? (
            <button type="button" className="aa-press min-h-12 rounded-2xl bg-primary font-semibold text-primary-fg" onClick={confirm}>Conferma</button>
          ) : (
            <div className="aa-rise grid gap-2 text-center">
              <p className="font-semibold">{err === 0 ? "Esatto!" : `Era a ${d} m: hai sbagliato di ${err} m`} · +{gain}</p>
              <button type="button" className="aa-press min-h-12 rounded-2xl bg-primary font-semibold text-primary-fg" onClick={next}>{round < 5 ? "Prossimo bersaglio" : "Risultato"}</button>
            </div>
          )}
        </Card>
      ) : (
        <Card className="grid justify-items-center gap-3 py-6 text-center">
          <p className="font-display text-6xl">{pts}<span className="text-2xl text-muted">/50</span></p>
          <p className="text-sm">{pts >= 40 ? "Occhio da cacciatore." : pts >= 25 ? "Buona stima: con l'allenamento scendi sotto i 3 m d'errore." : "Le distanze ingannano: riprova."}</p>
          <p className="text-xs text-muted">Record {Math.max(best.best, pts)}</p>
          <button type="button" className="aa-press min-h-12 rounded-2xl bg-primary px-8 font-semibold text-primary-fg" onClick={() => { setRound(1); setPts(0); setD(rnd()); shuffle(); setShown(false); }}>Gioca ancora</button>
        </Card>
      )}
    </div>
  );
}

function Page() {
  return <StimaBody />;
}
