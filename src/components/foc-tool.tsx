import { Card, Chips } from "@/components/kit";
import { StatusMark } from "@/components/icons";
import { useLocalState } from "@/lib/arcieri/local-store";
import { FocBalance3D, FocFlight3D, estimateSpeed } from "@/components/foc-3d";

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
      {r ? (
        <Card className="grid gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="aa-section-title">In 3D</p>
            <Chips value={st.view} onChange={(view) => setSt({ ...st, view })} options={[{ id: "equilibrio", label: "Equilibrio" }, { id: "gittata", label: "Gittata" }]} />
          </div>
          {st.view === "equilibrio" ? (
            <FocBalance3D key="eq" L={r.L} B={r.B} foc={r.foc} />
          ) : (
            <>
              <FocFlight3D key="fl" distance={st.dist} speed={speed} foc={r.foc} />
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
