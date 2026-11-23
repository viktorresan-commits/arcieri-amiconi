import { useState, type ReactNode } from "react";

/**
 * Grafici delle lezioni: linee, barre e bersagli con i colpi. Dati calcolati con formule semplici
 * (caduta, vento, aree delle zone) o esempi tipici, sempre dichiarati sotto il grafico.
 * Palette per lo sfondo scuro verificata (blu, arancio, acqua: separazione anche per chi non distingue i colori).
 */
const C = ["#3987e5", "#d95926", "#199e70"];
const INK = "rgba(243,240,232,0.92)";
const MUTED = "rgba(243,240,232,0.6)";
const GRID = "rgba(243,240,232,0.1)";
const fmt = (v: number, d = 0) => v.toFixed(d).replace(".", ",");

type Series = { name: string; values: number[] };

function Frame({ title, note, children, legend }: { title: string; note?: string; children: ReactNode; legend?: string[] }) {
  return (
    <figure className="grid gap-2 rounded-[var(--radius-card)] border border-hair bg-black/20 p-3">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {legend && legend.length > 1 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: MUTED }}>
          {legend.map((l, i) => (
            <span key={l} className="inline-flex items-center gap-1.5"><span className="h-2 w-3.5 rounded-sm" style={{ background: C[i] }} />{l}</span>
          ))}
        </div>
      ) : null}
      {children}
      {note ? <p className="text-[0.7rem] leading-snug" style={{ color: MUTED }}>{note}</p> : null}
    </figure>
  );
}

/** linee con mirino al tocco: mostra i valori della x più vicina */
export function LineChart({ title, xs, series, unit, xUnit, digits = 0, note, yMin }: { title: string; xs: number[]; series: Series[]; unit: string; xUnit: string; digits?: number; note?: string; yMin?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320;
  const H = 170;
  const P = { l: 36, r: 46, t: 10, b: 24 };
  const all = series.flatMap((s) => s.values);
  const lo = yMin ?? Math.min(0, ...all);
  const hiRaw = Math.max(...all);
  const step = niceStep((hiRaw - lo) / 4);
  const hi = Math.ceil(hiRaw / step) * step;
  const x = (i: number) => P.l + ((xs[i] - xs[0]) / (xs[xs.length - 1] - xs[0] || 1)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - ((v - lo) / (hi - lo || 1)) * (H - P.t - P.b);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    let best = 0;
    xs.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setHover(best);
  };
  return (
    <Frame title={title} note={note} legend={series.map((s) => s.name)}>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img" aria-label={title}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)} onPointerDown={(e) => pick(e.clientX, e.currentTarget)} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
              <text x={P.l - 5} y={y(t) + 3} textAnchor="end" fontSize="9" fill={MUTED}>{fmt(t, step < 1 ? 1 : 0)}</text>
            </g>
          ))}
          {xs.map((v, i) => (i % Math.ceil(xs.length / 7) === 0 || i === xs.length - 1 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill={MUTED}>{v}</text> : null))}
          {series.map((s, k) => (
            <g key={s.name}>
              <path d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")} fill="none" stroke={C[k]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {/* etichetta diretta in fondo alla linea */}
              <text x={x(s.values.length - 1) + 5} y={y(s.values[s.values.length - 1]) + 3} fontSize="9" fill={INK}>{fmt(s.values[s.values.length - 1], digits)}</text>
            </g>
          ))}
          {hover != null ? (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke={MUTED} strokeWidth="1" strokeDasharray="3 3" />
              {series.map((s, k) => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r="4.5" fill={C[k]} stroke="#141c18" strokeWidth="2" />)}
            </g>
          ) : null}
        </svg>
        {hover != null ? (
          <div className="pointer-events-none absolute right-1 top-1 rounded-lg bg-[#0d1411]/90 px-2 py-1 text-[0.7rem] shadow" style={{ color: INK }}>
            <b>{xs[hover]} {xUnit}</b>
            {series.map((s, k) => (
              <div key={s.name} className="flex items-center gap-1.5"><span className="h-1.5 w-2.5 rounded-sm" style={{ background: C[k] }} />{series.length > 1 ? `${s.name}: ` : ""}{fmt(s.values[hover], digits)} {unit}</div>
            ))}
          </div>
        ) : <p className="absolute right-1 top-1 text-[0.62rem]" style={{ color: MUTED }}>tocca il grafico</p>}
      </div>
      <p className="-mt-1 text-[0.66rem]" style={{ color: MUTED }}>in orizzontale: {xUnit} · in verticale: {unit}</p>
    </Frame>
  );
}

/** barre orizzontali, valore scritto a fianco; al tocco si evidenzia la barra */
export function BarChart({ title, items, unit, digits = 0, note }: { title: string; items: { label: string; value: number; hint?: string }[]; unit: string; digits?: number; note?: string }) {
  const [on, setOn] = useState<number | null>(null);
  const max = Math.max(...items.map((i) => i.value)) || 1;
  return (
    <Frame title={title} note={note}>
      <div className="grid gap-1.5">
        {items.map((it, i) => (
          <button key={it.label} type="button" onClick={() => setOn(on === i ? null : i)} onPointerEnter={() => setOn(i)} onPointerLeave={() => setOn(null)} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 text-left">
            <span className="truncate text-xs" style={{ color: INK }}>{it.label}</span>
            <span className="h-3.5 rounded-r-[4px] rounded-l-[2px] transition-[opacity]" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: C[0], opacity: on == null || on === i ? 1 : 0.45 }} />
            <span className="text-xs tabular-nums" style={{ color: INK }}>{fmt(it.value, digits)} {unit}</span>
            {on === i && it.hint ? <span className="col-span-3 text-[0.7rem]" style={{ color: MUTED }}>{it.hint}</span> : null}
          </button>
        ))}
      </div>
    </Frame>
  );
}

/** bersaglio a 10 zone con gruppi di frecce */
export function TargetPlot({ title, groups, note }: { title: string; groups: { name: string; pts: [number, number][] }[]; note?: string }) {
  const RING = ["#f4f1ea", "#f4f1ea", "#1a1c1e", "#1a1c1e", "#2a6294", "#2a6294", "#c4473d", "#c4473d", "#e6b325", "#e6b325"];
  const score = (p: [number, number]) => {
    const r = Math.hypot(p[0], p[1]);
    return r <= 1 ? Math.max(1, 10 - Math.floor(r * 10)) : 0;
  };
  return (
    <Frame title={title} note={note} legend={groups.map((g) => g.name)}>
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <svg viewBox="-1.1 -1.1 2.2 2.2" className="mx-auto w-full max-w-[13rem]" role="img" aria-label={title}>
          {RING.map((c, i) => <circle key={i} r={1 - i / 10} fill={c} stroke={i < 2 ? "#1a1c1e" : "#f4f1ea"} strokeWidth="0.006" strokeOpacity="0.6" />)}
          {groups.map((g, k) => g.pts.map((p, i) => (
            k === 1 ? <rect key={`${k}-${i}`} x={p[0] - 0.045} y={p[1] - 0.045} width="0.09" height="0.09" fill={C[k]} stroke="#141c18" strokeWidth="0.02" />
              : <circle key={`${k}-${i}`} cx={p[0]} cy={p[1]} r="0.05" fill={C[k]} stroke="#141c18" strokeWidth="0.02" />
          )))}
        </svg>
        <div className="grid gap-2 text-xs" style={{ color: INK }}>
          {groups.map((g, k) => {
            const avg = g.pts.reduce((a, p) => a + score(p), 0) / g.pts.length;
            return (
              <div key={g.name}>
                <span className="inline-flex items-center gap-1.5 font-semibold"><span className="h-2 w-2" style={{ background: C[k], borderRadius: k === 1 ? 1 : 99 }} />{g.name}</span>
                <p className="tabular-nums" style={{ color: MUTED }}>media {fmt(avg, 1)} a freccia</p>
              </div>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const G = 9.81;
const range = (a: number, b: number, s: number) => Array.from({ length: Math.floor((b - a) / s) + 1 }, (_, i) => a + i * s);
/** caduta di una freccia tirata in orizzontale, senza aria: metà di g per il tempo di volo al quadrato */
const drop = (d: number, v: number) => 0.5 * G * (d / v) ** 2;
/** spostamento laterale con vento al traverso: il vento sposta per il "ritardo" dovuto al rallentamento (circa 1,5 per mille a metro) */
const drift = (d: number, v: number, w: number) => w * (d / v) * (1 / (1 - (0.0015 * d) / 2) - 1) * 100;

/** I grafici per id: le lezioni li indicano per nome. */
export function LessonChart({ id }: { id: string }) {
  switch (id) {
    case "caduta": {
      const xs = range(10, 90, 10);
      return <LineChart title="Quanto scenderebbe la freccia se mirassi dritto al centro" xs={xs} xUnit="m" unit="metri di caduta" digits={1}
        series={[{ name: "Compound (90 m/s)", values: xs.map((d) => drop(d, 90)) }, { name: "Olimpico (60 m/s)", values: xs.map((d) => drop(d, 60)) }, { name: "Longbow (50 m/s)", values: xs.map((d) => drop(d, 50)) }]}
        note="Calcolo senza resistenza dell'aria: caduta = ½ · g · tempo². Per questo si mira più in alto (o si alza il mirino) man mano che la distanza cresce." />;
    }
    case "vento": {
      const xs = range(10, 90, 10);
      return <LineChart title="Spostamento laterale con vento al traverso (arco olimpico, 60 m/s)" xs={xs} xUnit="m" unit="cm di spostamento"
        series={[2, 4, 6].map((w) => ({ name: `${w} m/s`, values: xs.map((d) => drift(d, 60, w)) }))}
        note="Stima con un rallentamento tipico della freccia. Raddoppiare il vento raddoppia lo spostamento; raddoppiare la distanza lo moltiplica per più di tre." />;
    }
    case "bersagli":
      return <BarChart title="Quanto sembra grande il bersaglio, visto come se fosse a 18 m" unit="cm" items={[
        { label: "40 cm a 18 m", value: 40, hint: "Indoor: il bersaglio più piccolo, ma vicino." },
        { label: "60 cm a 25 m", value: 43.2 },
        { label: "80 cm a 30 m", value: 48, hint: "Giovani e principianti all'aperto." },
        { label: "80 cm a 50 m", value: 28.8, hint: "Compound all'aperto, sei zone." },
        { label: "122 cm a 70 m", value: 31.4, hint: "Olimpico all'aperto." },
        { label: "122 cm a 90 m", value: 24.4 },
      ]} digits={1} note="Diametro × 18 ÷ distanza: a 70 m il 122 cm è un po' più piccolo, all'occhio, del 40 cm in sala." />;
    case "zone":
      return <BarChart title="Quanta parte del bersaglio occupa ogni zona" unit="%" items={[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((p) => ({ label: `Zona del ${p}`, value: 2 * (11 - p) - 1 }))}
        note="Le zone hanno la stessa larghezza, ma più sono esterne più sono grandi: il 10 è l'1% della superficie, l'1 il 19%." />;
    case "zone-field":
      return <BarChart title="Field: superficie delle sei zone" unit="%" items={[6, 5, 4, 3, 2, 1].map((p) => ({ label: `Zona del ${p}`, value: ((2 * (7 - p) - 1) / 36) * 100 }))} digits={1}
        note="Sei zone della stessa larghezza: il 6 (con la X al centro) è meno del 3% del bersaglio giallo e nero." />;
    case "respiro": {
      const xs = range(0, 20, 1);
      return <LineChart title="Respiro 4-6: inspira 4 secondi, espira 6" xs={xs} xUnit="s" unit="% d'aria nei polmoni" yMin={0}
        series={[{ name: "Respiro", values: xs.map((t) => { const c = t % 10; return Math.round(c < 4 ? 30 + 60 * Math.sin((c / 4) * (Math.PI / 2)) : 90 - 60 * Math.sin(((c - 4) / 6) * (Math.PI / 2))); }) }]}
        note="Prima della volée: due o tre cicli lenti. Al momento del tiro si trattiene a metà dell'espirazione, senza svuotarsi del tutto." />;
    }
    case "tempi":
      return <BarChart title="Secondi a disposizione per ogni freccia" unit="s" items={[
        { label: "Volée da 6 (4 min)", value: 40 },
        { label: "Volée da 3 (2 min)", value: 40 },
        { label: "Scontro a turni", value: 20, hint: "Negli scontri a turni alterni ogni freccia ha 20 secondi." },
      ]} note="Regole generali World Archery: per le gare federali fa fede il regolamento in vigore." />;
    case "spine": {
      const xs = [20, 25, 30, 35, 40, 45];
      return <LineChart title="Spine indicativo per libbre (arco olimpico, dita, 28″)" xs={xs} xUnit="lb" unit="spine" yMin={400}
        series={[{ name: "Spine", values: [1000, 850, 750, 650, 600, 500] }]}
        note="Indicativo: freccia più lunga o punta più pesante = serve uno spine più rigido (numero più basso). Controlla sempre la tabella del produttore." />;
    }
    case "peso-velocita": {
      const xs = range(250, 450, 25);
      return <LineChart title="Freccia più pesante, freccia più lenta (stesso arco, 40 J)" xs={xs} xUnit="grani" unit="m/s"
        series={[{ name: "Velocità", values: xs.map((g) => Math.sqrt(80 / (g * 0.0000648))) }]}
        note="Con la stessa energia: velocità = radice di 2E diviso la massa. La freccia pesante soffre meno il vento laterale ma scende di più." />;
    }
    case "gruppi":
      return <TargetPlot title="Gruppo stretto e spostato contro gruppo largo e centrato" groups={[
        { name: "Stretto, in alto a destra", pts: [[0.28, -0.24], [0.33, -0.2], [0.25, -0.3], [0.31, -0.28], [0.36, -0.25], [0.29, -0.19]] },
        { name: "Largo, centrato", pts: [[-0.35, 0.1], [0.05, 0.42], [0.38, -0.05], [-0.1, -0.38], [0.2, 0.25], [-0.28, -0.22]] },
      ]} note="Il gruppo stretto vale poco perché è spostato, ma basta una regolazione del mirino per portarlo al centro. Il gruppo largo invece va lavorato sul gesto." />;
    case "nude":
      return <TargetPlot title="Aste nude a sinistra del gruppo con le penne (destro, dita)" groups={[
        { name: "Frecce con penne", pts: [[0.02, -0.03], [-0.04, 0.05], [0.05, 0.02], [-0.02, -0.05]] },
        { name: "Aste nude", pts: [[-0.36, 0.02], [-0.4, -0.06]] },
      ]} note="Per un destro che tira con le dita: nude a sinistra = asta rigida, a destra = morbida. Si corregge con libbre, punta o bottone." />;
    case "volume":
      return <BarChart title="Frecce a settimana: si sale piano, con una settimana di scarico" unit="frecce" items={[
        { label: "Settimana 1", value: 180 }, { label: "Settimana 2", value: 240 }, { label: "Settimana 3", value: 300 },
        { label: "Settimana 4 (scarico)", value: 200, hint: "Ogni tre o quattro settimane si scende di un terzo: spalle e tendini recuperano." },
        { label: "Settimana 5", value: 330 }, { label: "Settimana 6", value: 390 },
      ]} note="Esempio: aumenta di circa un quinto alla volta. Dolore alla spalla o al gomito: si scende, non si stringono i denti." />;
    case "primi":
      return <BarChart title="Le prime cinque uscite: frecce per allenamento" unit="frecce" items={[
        { label: "1ª uscita", value: 30 }, { label: "2ª uscita", value: 45 }, { label: "3ª uscita", value: 54 }, { label: "4ª uscita", value: 66 }, { label: "5ª uscita", value: 72 },
      ]} note="Esempio per un principiante con un arco leggero: meglio poche frecce fatte bene che tante frecce stanche." />;
    case "mirino": {
      const xs = [18, 30, 40, 50, 60, 70];
      return <LineChart title="Tacche del mirino: quanto scende la diottra a ogni distanza" xs={xs} xUnit="m" unit="mm sotto la tacca dei 18 m"
        series={[{ name: "Tacca", values: [0, 9, 17, 26, 36, 47] }]}
        note="Esempio di un olimpico: la curva cambia con arco e frecce. Segna le tue tacche dopo ogni cambio di attrezzatura." />;
    }
    case "battito": {
      const xs = range(0, 60, 5);
      return <LineChart title="Battito durante una gara: con e senza respiro lento" xs={xs} xUnit="min" unit="battiti al minuto" yMin={60}
        series={[{ name: "Senza routine", values: [76, 92, 104, 101, 99, 103, 108, 104, 102, 110, 116, 112, 114] }, { name: "Con 3 respiri lenti", values: [76, 86, 92, 88, 86, 89, 92, 90, 88, 93, 97, 94, 95] }]}
        note="Esempio tipico: l'agitazione alza il battito, soprattutto all'inizio e alle volée decisive. Tre respiri lenti prima di ogni volée lo abbassano." />;
    }
    case "stima":
      return <BarChart title="Errore tipico di chi stima a occhio" unit="m" items={[
        { label: "10 m", value: 1 }, { label: "20 m", value: 2.5 }, { label: "30 m", value: 4 }, { label: "40 m", value: 6 }, { label: "50 m", value: 8 },
      ]} digits={1} note="Esempio: chi inizia sbaglia di circa il 10–15%, e l'errore cresce con la distanza. Allenarsi con il telemetro accorcia queste barre." />;
    case "pendenza": {
      const xs = range(0, 40, 5);
      return <LineChart title="Sagoma a 30 m in salita o in discesa: quanto conta la distanza in piano" xs={xs} xUnit="°" unit="metri da usare per la mira" digits={1}
        series={[{ name: "Distanza in piano", values: xs.map((a) => 30 * Math.cos((a * Math.PI) / 180)) }]}
        note="La gravità lavora solo sulla distanza in orizzontale: 30 m con 30° di pendenza si tirano come 26 m. Per questo in salita e in discesa si tende ad andare alti." />;
    }
    case "libbre": {
      const xs = [24, 25, 26, 27, 28, 29, 30];
      return <LineChart title="Libbre reali secondo il tuo allungo (flettenti da 30 lb a 28″)" xs={xs} xUnit="″" unit="libbre" yMin={20}
        series={[{ name: "Libbre", values: xs.map((a) => 30 + (a - 28) * 2) }]}
        note="Regola pratica per il ricurvo: circa 2 libbre per ogni pollice in più o in meno rispetto ai 28″ scritti sul flettente." />;
    }
    case "libbre-inizio":
      return <BarChart title="Libbre per cominciare (sulle dita, arco ricurvo)" unit="lb" items={[
        { label: "Ragazzi 10–13 anni", value: 16, hint: "Da 14 a 18 libbre." },
        { label: "Ragazzi 14–17 anni", value: 20, hint: "Da 18 a 24 libbre." },
        { label: "Adulti, inizio", value: 24, hint: "Da 20 a 28 libbre." },
        { label: "Dopo un anno", value: 30, hint: "Si sale di 2 libbre alla volta." },
      ]} note="Indicativo: si sceglie un arco che si tiene in ancoraggio 10 secondi senza tremare. Meglio leggero e ripetibile." />;
    case "dita":
      return <BarChart title="Come si divide la forza sulle tre dita (aggancio mediterraneo)" unit="%" items={[
        { label: "Indice", value: 40 }, { label: "Medio", value: 50 }, { label: "Anulare", value: 10 },
      ]} note="Indicativo: il medio lavora di più, l'anulare quasi solo appoggia. Le dita restano a uncino, il dorso della mano rilassato." />;
    case "postura":
      return <BarChart title="Dove sta il peso in postura" unit="%" items={[
        { label: "Piede verso il bersaglio", value: 50 }, { label: "Piede dietro", value: 50 }, { label: "Avampiede", value: 60 }, { label: "Talloni", value: 40 },
      ]} note="Peso diviso a metà tra i piedi e un po' in avanti: il corpo non ondeggia e non si sbilancia all'indietro durante il rilascio." />;
    case "allungo-errore":
      return <BarChart title="1 cm di allungo in meno: quanto scende la freccia" unit="cm" items={[
        { label: "18 m", value: 4 }, { label: "30 m", value: 7 }, { label: "50 m", value: 12 }, { label: "70 m", value: 17 },
      ]} note="Esempio indicativo per un olimpico: un allungo che varia di un centimetro allunga il gruppo in verticale. Il clicker serve proprio a questo." />;
    case "dispersione": {
      const xs = range(10, 90, 10);
      return <LineChart title="Lo stesso piccolo errore, più grande con la distanza" xs={xs} xUnit="m" unit="cm di larghezza del gruppo"
        series={[{ name: "Errore di 1 millesimo", values: xs.map((d) => d * 0.1) }, { name: "Errore di 3 millesimi", values: xs.map((d) => d * 0.3) }]}
        note="Un errore di mira o di rilascio è un angolo: a 70 m vale quasi quattro volte che a 18 m. Il rilascio pulito conta di più da lontano." />;
    }
    case "sequenza":
      return <BarChart title="Quanto dura ogni fase della sequenza (circa)" unit="s" items={[
        { label: "Postura", value: 2 }, { label: "Incocco e presa", value: 3 }, { label: "Set-up", value: 2 }, { label: "Allungo", value: 2.5 },
        { label: "Ancoraggio e mira", value: 4, hint: "Oltre 6–7 secondi la mira peggiora: meglio scendere e ricominciare." },
        { label: "Rilascio", value: 0.2 }, { label: "Accompagnamento", value: 2 },
      ]} digits={1} note="Indicativo: conta che i tempi siano uguali a ogni freccia, non che siano velocissimi." />;
    case "set": {
      const xs = [1, 2, 3, 4, 5];
      return <LineChart title="Uno scontro a set: punti set dopo ogni volée" xs={xs} xUnit="set" unit="punti set" yMin={0}
        series={[{ name: "Arciere A", values: [2, 2, 4, 5, 6] }, { name: "Arciere B", values: [0, 2, 2, 3, 3] }]}
        note="Set vinto = 2 punti, pari = 1, perso = 0. Vince chi arriva a 6: si può perdere un set e vincere lo scontro." />;
    }
    case "sagome":
      return <BarChart title="Punti delle sagome secondo dove entra la freccia" unit="punti" items={[
        { label: "Cerchio piccolo (3D)", value: 11 }, { label: "Vitale interno (3D)", value: 10 },
        { label: "Vitale", value: 8, hint: "Nel conteggio 8-5-0 la zona vitale vale 8." }, { label: "Corpo", value: 5 }, { label: "Fuori", value: 0 },
      ]} note="FITARCO 3D: 11-10-8-5. Nel conteggio semplice da campagna: 8 vitale, 5 corpo, 0 fuori." />;
    case "string-walking": {
      const xs = [10, 15, 20, 25, 30, 35, 40, 45];
      return <LineChart title="String walking: di quanto scendono le dita sotto la cocca" xs={xs} xUnit="m" unit="mm sotto la cocca" yMin={0}
        series={[{ name: "Dita", values: [40, 33, 26, 19, 12, 7, 3, 0] }]}
        note="Esempio di arco nudo: più il bersaglio è vicino, più le dita scendono sulla corda. A circa 45 m la punta della freccia è sul centro (point on)." />;
    }
    case "fischi":
      return <BarChart title="I segnali del direttore di tiro" unit="fischi" items={[
        { label: "Alla linea", value: 2 }, { label: "Si tira", value: 1 }, { label: "A recuperare", value: 3 }, { label: "Stop immediato", value: 5, hint: "Cinque o più fischi: si abbassa l'arco, si toglie la freccia dalla corda." },
      ]} />;
    case "riscaldamento":
      return <BarChart title="Riscaldamento da 15 minuti" unit="min" items={[
        { label: "Mobilità spalle e collo", value: 4 }, { label: "Elastico", value: 4 }, { label: "Gesto a vuoto con elastico", value: 3 }, { label: "Prime frecce da vicino", value: 4 },
      ]} />;
    case "manutenzione":
      return <BarChart title="Ogni quante settimane controllare (tiro regolare)" unit="sett." items={[
        { label: "Cocche e punte", value: 1, hint: "A ogni uscita, freccia per freccia." }, { label: "Penne", value: 2 }, { label: "Punto d'incocco e brace", value: 4 }, { label: "Cera sulla corda", value: 4 }, { label: "Corda nuova", value: 26, hint: "Circa ogni sei mesi, o prima se è sfilacciata." },
      ]} note="Indicativo: chi tira tutti i giorni controlla più spesso." />;
    case "forza":
      return <BarChart title="Una settimana di preparazione (oltre al tiro)" unit="min" items={[
        { label: "Elastico e spalle", value: 45 }, { label: "Addome e schiena", value: 40 }, { label: "Tenute in ancoraggio", value: 20 }, { label: "Camminata o bici", value: 90 },
      ]} note="Esempio per due o tre sedute a settimana: costanza più che fatica." />;
    default:
      return null;
  }
}
