import { Card, Chips } from "@/components/kit";
import { StatusMark } from "@/components/icons";
import { useLocalState } from "@/lib/arcieri/local-store";
import { FocFlight3D, estimateSpeed } from "@/components/foc-3d";
import { FocBalanceGL } from "@/components/foc-gl";
import { useMainArrowLook } from "@/lib/arcieri/main-gear";

/**
 * FOC (front of center): di quanto il punto di equilibrio della freccia sta davanti alla metà.
 * Due modi: misurato (lunghezza e punto di equilibrio) o stimato dai pesi dei componenti.
 */
type Store = {
  mode: "misura" | "pesi";
  len: string; // cm, dalla gola della cocca alla fine dell'asta
  bal: string; // cm, dalla gola della cocca al punto di equilibrio
  gpi: string; // grani per pollice dell'asta
  point: string;
  insert: string;
  fletch: string; // tutte le penne insieme
  nock: string;
  lb: string; // libbre sulle dita (per i grani per libbra)
  grains: string; // peso totale misurato (modo "Ho misurato")
  view: "equilibrio" | "gittata";
  dist: number;
  spine?: string; // spine dell'asta (facoltativo), per il confronto
};
const DEFAULT: Store = { mode: "pesi", len: "72", bal: "41", gpi: "7,5", point: "100", insert: "10", fletch: "18", nock: "8", lb: "36", grains: "350", view: "equilibrio", dist: 30 };
const n = (s: string) => Number(String(s).replace(",", "."));
const f1 = (x: number) => x.toFixed(1).replace(".", ",");

function compute(st: Store) {
  const L = n(st.len);
  if (!(L > 20 && L < 120)) return null;
  if (st.mode === "misura") {
    const B = n(st.bal);
    if (!(B > 0 && B < L)) return null;
    return { L, B, foc: ((B - L / 2) / L) * 100, total: null as number | null };
  }
  const shaft = n(st.gpi) * (L / 2.54);
  // posizioni dalla gola della cocca (cm): cocca, penne, asta a metà, inserto e punta in fondo
  const parts: [number, number][] = [
    [n(st.nock) || 0, 0.6],
    [n(st.fletch) || 0, 6],
    [shaft || 0, L / 2],
    [n(st.insert) || 0, L - 1.6],
    [n(st.point) || 0, L + 0.4],
  ];
  const total = parts.reduce((a, [m]) => a + m, 0);
  if (!(total > 0)) return null;
  const B = parts.reduce((a, [m, x]) => a + m * x, 0) / total;
  return { L, B, foc: ((B - L / 2) / L) * 100, total };
}

export function FocTool() {
  const look = useMainArrowLook();
  const [st, setSt] = useLocalState<Store>("aa-foc-v1", DEFAULT);
  const r = compute(st);
  const set = (k: keyof Store) => (e: { target: { value: string } }) => setSt({ ...st, [k]: e.target.value });
  const verdict = !r ? null : r.foc < 6 ? { s: "warn" as const, t: "Basso: la freccia può essere instabile al vento. Prova una punta più pesante." } : r.foc <= 13 ? { s: "ok" as const, t: "Nella fascia giusta per il tiro alla targa (circa 7–13%)." } : r.foc <= 20 ? { s: "ok" as const, t: "Alto: buono per 3D e campagna, frecce più stabili e penetranti." } : { s: "warn" as const, t: "Molto alto: freccia pesante davanti, cala di più sulle lunghe distanze." };
  const grains = r?.total ?? n(st.grains);
  const gpp = grains > 0 && n(st.lb) > 0 ? grains / n(st.lb) : null;
  const speed = estimateSpeed(n(st.lb), grains);
  const flight = speed > 0 ? (() => {
    const s2 = Math.min(1, (9.81 * st.dist) / (speed * speed));
    const th = 0.5 * Math.asin(s2);
    return { angle: (th * 180) / Math.PI, peak: (speed * speed * Math.sin(th) ** 2) / (2 * 9.81) };
  })() : null;

  // disegno: la freccia in scala con metà e punto di equilibrio
  const W = 320;
  const x0 = 14;
  const span = W - 40;
  const X = (cm: number) => x0 + (r ? (cm / r.L) * span : 0);

  return (
    <div id="foc" className="grid scroll-mt-20 gap-3">
      <div className="px-1">
        <h2 className="aa-section-title">Calcolo FOC</h2>
        <p className="text-xs text-muted">Quanto la freccia pesa davanti. Scrivi i dati: il risultato si aggiorna e resta salvato.</p>
      </div>
      <Chips value={st.mode} onChange={(mode) => setSt({ ...st, mode })} options={[{ id: "pesi", label: "Dai pesi" }, { id: "misura", label: "Ho misurato" }]} />
      <Card className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Num label="Lunghezza asta" unit="cm" value={st.len} onChange={set("len")} />
          {st.mode === "misura" ? (
            <>
              <Num label="Punto di equilibrio" unit="cm" value={st.bal} onChange={set("bal")} hint="Dalla cocca" />
              <Num label="Peso freccia" unit="gr" value={st.grains} onChange={set("grains")} hint="Per la gittata" />
              <Num label="Libbre" unit="lb" value={st.lb} onChange={set("lb")} />
            </>
          ) : (
            <>
              <Num label="Asta" unit="gpi" value={st.gpi} onChange={set("gpi")} hint="Grani per pollice" />
              <Num label="Punta" unit="gr" value={st.point} onChange={set("point")} />
              <Num label="Inserto" unit="gr" value={st.insert} onChange={set("insert")} />
              <Num label="Penne (tutte)" unit="gr" value={st.fletch} onChange={set("fletch")} />
              <Num label="Cocca" unit="gr" value={st.nock} onChange={set("nock")} />
              <Num label="Libbre" unit="lb" value={st.lb} onChange={set("lb")} hint="Facoltativo" />
            </>
          )}
        </div>
      </Card>
      {r ? (
        <Card className="grid gap-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-muted">FOC</p>
              <p key={f1(r.foc)} className="aa-pop font-display text-5xl tabular-nums">{f1(r.foc)}%</p>
            </div>
            <div className="text-right text-xs text-muted">
              <p>Equilibrio a {f1(r.B)} cm</p>
              {r.total ? <p>Peso totale {Math.round(r.total)} gr</p> : null}
              {gpp ? <p>{f1(gpp)} grani per libbra</p> : null}
            </div>
          </div>
          <svg viewBox={`0 0 ${W} 70`} className="w-full">
            <rect x={x0} y={33} width={span} height={4} rx={2} fill="#2a2f35" />
            <path d={`M${x0 + 2} 33 l12 -9 h6 l-8 9z M${x0 + 2} 37 l12 9 h6 l-8 -9z`} fill="#d63a2f" />
            <rect x={x0 - 4} y={31.5} width={6} height={7} rx={2} fill="#f2c94c" />
            <path d={`M${x0 + span} 31 l14 4 l-14 4z`} fill="#b9c0c8" />
            <line x1={X(r.L / 2)} x2={X(r.L / 2)} y1={14} y2={56} stroke="currentColor" strokeOpacity={0.45} strokeDasharray="3 3" />
            <text x={X(r.L / 2)} y={10} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity={0.6}>metà</text>
            <g style={{ transform: `translateX(${X(r.B)}px)`, transition: "transform .5s cubic-bezier(.22,1,.36,1)" }}>
              <path d="M0 40 l-7 14 h14z" fill="#7cf0a8" />
              <text y={66} textAnchor="middle" fontSize="9" fill="#7cf0a8">equilibrio</text>
            </g>
            <path d={`M${X(r.L / 2)} 24 H${X(r.B)}`} stroke="#7cf0a8" strokeWidth={2} />
          </svg>
          {verdict ? (
            <p className="text-sm">
              <StatusMark state={verdict.s} />
              {verdict.t}
            </p>
          ) : null}
          {gpp ? <p className="text-xs text-muted">{gpp < 6 ? "Sotto i 6 grani per libbra la freccia è leggera: occhio alla garanzia dei flettenti." : gpp > 9 ? "Freccia pesante per il carico: più stabile, ma cala di più." : "Peso equilibrato per il carico."}</p> : null}
        </Card>
      ) : null}
      {r ? <Analysis st={st} r={r} grains={grains} speed={speed} onSpine={(spine) => setSt({ ...st, spine })} /> : null}
      {r ? (
        <Card className="grid gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="aa-section-title">In 3D</p>
            <Chips value={st.view} onChange={(view) => setSt({ ...st, view })} options={[{ id: "equilibrio", label: "Equilibrio" }, { id: "gittata", label: "Gittata" }]} />
          </div>
          {st.view === "equilibrio" ? (
            <FocBalanceGL key="eq" L={r.L} B={r.B} foc={r.foc} look={look} />
          ) : (
            <>
              <FocFlight3D key="fl" distance={st.dist} speed={speed} foc={r.foc} look={look} />
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
                {[18, 30, 50, 70, 90].map((d) => (
                  <button key={d} type="button" aria-pressed={st.dist === d} className="aa-chip" onClick={() => setSt({ ...st, dist: d })}>{d} m</button>
                ))}
              </div>
              {flight ? (
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <Mini k="Velocità" v={`${Math.round(speed)} m/s`} />
                  <Mini k="Alzo" v={`${flight.angle.toFixed(1).replace(".", ",")}°`} />
                  <Mini k="Sale fino a" v={`${flight.peak.toFixed(1).replace(".", ",")} m`} />
                </div>
              ) : null}
              <p className="text-[0.7rem] text-muted">Velocità stimata da libbre e peso (arco ricurvo o tradizionale, senza attrito dell'aria). Con FOC basso la freccia oscilla di più all'uscita; con FOC alto si stabilizza prima.</p>
            </>
          )}
          <p className="text-[0.7rem] text-muted">{st.view === "equilibrio" ? "Sul fulcro a metà la freccia pende verso la punta: spostandolo fino al punto di equilibrio torna dritta. La distanza tra i due segni è il FOC." : null}</p>
        </Card>
      ) : (
        <Card><p className="text-sm text-muted">Inserisci la lunghezza dell'asta (in cm) e i pesi per vedere il risultato.</p></Card>
      )}
      <p className="px-1 text-[0.7rem] text-muted">Il calcolo dai pesi è una stima: per il dato esatto appoggia la freccia finita su un bordo e misura il punto dove sta in equilibrio.</p>
    </div>
  );
}

function Num({ label, unit, value, onChange, hint }: { label: string; unit: string; value: string; onChange: (e: { target: { value: string } }) => void; hint?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted">{label}{hint ? <span className="opacity-70"> · {hint}</span> : null}</span>
      <span className="flex items-center gap-1 rounded-xl border border-hair bg-black/20 px-3">
        <input inputMode="decimal" value={value} onChange={onChange} className="min-h-11 w-full min-w-0 bg-transparent text-base tabular-nums outline-none" />
        <span className="text-xs text-muted">{unit}</span>
      </span>
    </label>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-xl bg-white/[0.05] px-2 py-1.5">
      <span className="block text-[0.6rem] uppercase tracking-wider text-muted">{k}</span>
      <b className="font-display text-lg tabular-nums">{v}</b>
    </span>
  );
}

/** Spine consigliato (indicativo, tabelle per archi ricurvi a dita): libbre effettive per lunghezza e punta. */
function spineFor(lb: number, lenIn: number, point: number) {
  if (!(lb > 10 && lenIn > 20)) return null;
  const eff = lb + 2.5 * (lenIn - 28) + 3 * ((point - 100) / 25);
  if (!(eff > 8)) return null;
  const raw = 23500 / eff;
  const step = raw > 1000 ? 100 : 50;
  return Math.round(raw / step) * step;
}

/** Riepilogo dei numeri della freccia e cosa cambiare per correggerla. */
function Analysis({ st, r, grains, speed, onSpine }: { st: Store; r: { L: number; B: number; foc: number; total: number | null }; grains: number; speed: number; onSpine: (v: string) => void }) {
  const lb = n(st.lb);
  const lenIn = r.L / 2.54;
  const point = st.mode === "pesi" ? n(st.point) || 0 : 100;
  const gpp = grains > 0 && lb > 0 ? grains / lb : null;
  const mass = grains * 6.48e-5;
  const energy = speed > 0 && grains > 0 ? 0.5 * mass * speed * speed : null;
  const momentum = speed > 0 && grains > 0 ? mass * speed : null;
  const spineIdeal = spineFor(lb, lenIn, point);
  const spineMine = n(st.spine ?? "");
  // punta che porta il FOC al 10% (solo dai pesi): risolvo il baricentro con la massa della punta
  let pointFor10: number | null = null;
  if (st.mode === "pesi" && r.total) {
    const L = r.L;
    const shaft = n(st.gpi) * (L / 2.54);
    const parts: [number, number][] = [[n(st.nock) || 0, 0.6], [n(st.fletch) || 0, 6], [shaft || 0, L / 2], [n(st.insert) || 0, L - 1.6]];
    const M = parts.reduce((a, [m]) => a + m, 0);
    const S = parts.reduce((a, [m, x]) => a + m * x, 0);
    const want = L * 0.6;
    const xp = L + 0.4;
    const p = (want * M - S) / (xp - want);
    if (p > 0 && p < 400) pointFor10 = Math.round(p / 5) * 5;
  }
  const tips: { s: "ok" | "warn"; t: string }[] = [];
  if (r.foc < 7) tips.push({ s: "warn", t: pointFor10 ? `FOC basso: con una punta da circa ${pointFor10} grani arrivi al 10%. In alternativa inserto più pesante o penne più leggere.` : "FOC basso: punta o inserto più pesanti, oppure penne più leggere." });
  else if (r.foc > 18) tips.push({ s: "warn", t: pointFor10 ? `FOC alto: per la targa una punta da circa ${pointFor10} grani riporta il FOC al 10%, la freccia cala meno.` : "FOC alto: punta più leggera se tiri alla targa sulle lunghe distanze." });
  else tips.push({ s: "ok", t: "FOC nella fascia buona: niente da cambiare sul peso davanti." });
  if (gpp != null) {
    if (gpp < 6) tips.push({ s: "warn", t: `${f1(gpp)} grani per libbra: troppo leggera per il carico, rischi di danneggiare i flettenti. Sali almeno a ${Math.round(lb * 6)} grani totali.` });
    else if (gpp > 10) tips.push({ s: "warn", t: `${f1(gpp)} grani per libbra: molto pesante, traiettoria più curva. Per la targa resta tra 6 e 9.` });
    else tips.push({ s: "ok", t: `${f1(gpp)} grani per libbra: peso adatto al carico.` });
  }
  if (spineIdeal && spineMine > 0) {
    const diff = (spineMine - spineIdeal) / spineIdeal;
    if (diff > 0.12) tips.push({ s: "warn", t: `Spine ${spineMine} più morbido del consigliato (~${spineIdeal}): con lo sgancio a dita la punta va a sinistra (arciere destro). Punta più leggera, asta più corta o spine più rigido.` });
    else if (diff < -0.12) tips.push({ s: "warn", t: `Spine ${spineMine} più rigido del consigliato (~${spineIdeal}): la punta tende a destra (arciere destro). Punta più pesante o asta più lunga lo ammorbidiscono.` });
    else tips.push({ s: "ok", t: `Spine ${spineMine} in linea con il carico (~${spineIdeal}).` });
  }
  if (lenIn > 0 && lb > 0 && r.L > 0 && st.mode === "pesi" && n(st.fletch) > 30) tips.push({ s: "warn", t: "Penne pesanti: spostano il baricentro indietro. Penne più corte o spin wing aumentano il FOC e la velocità." });
  return (
    <Card className="grid gap-2.5">
      <p className="aa-section-title">Analisi delle aste</p>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <Mini k="Peso" v={grains > 0 ? `${Math.round(grains)} gr` : "—"} />
        <Mini k="Velocità" v={speed > 0 ? `${Math.round(speed)} m/s` : "—"} />
        <Mini k="Energia" v={energy ? `${f1(energy)} J` : "—"} />
        <Mini k="Q. moto" v={momentum ? `${(momentum).toFixed(3).replace(".", ",")}` : "—"} />
        <Mini k="Spine ideale" v={spineIdeal ? String(spineIdeal) : "—"} />
        <Mini k="Lunghezza" v={`${lenIn.toFixed(1).replace(".", ",")}″`} />
      </div>
      <label className="grid gap-1">
        <span className="text-xs text-muted">Spine delle tue aste (facoltativo, per il confronto)</span>
        <span className="flex items-center gap-1 rounded-xl border border-hair bg-black/20 px-3">
          <input inputMode="numeric" value={st.spine ?? ""} onChange={(e) => onSpine(e.target.value)} placeholder="es. 600" className="min-h-11 w-full min-w-0 bg-transparent text-base tabular-nums outline-none" />
        </span>
      </label>
      <ul className="grid gap-1.5">
        {tips.map((tip) => (
          <li key={tip.t} className="flex gap-2 rounded-xl bg-white/[0.04] px-2.5 py-2 text-sm leading-snug">
            <StatusMark state={tip.s} />
            <span>{tip.t}</span>
          </li>
        ))}
      </ul>
      <p className="text-[0.68rem] text-muted">Valori stimati per archi ricurvi e tradizionali a dita; spine dalle tabelle indicative (libbre al tuo allungo, lunghezza e punta). La prova vera resta il tiro con frecce senza penne (bare shaft).</p>
    </Card>
  );
}
