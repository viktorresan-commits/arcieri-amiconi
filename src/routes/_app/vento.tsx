import { createFileRoute } from "@tanstack/react-router";
import { ToolArt } from "@/components/tool-art";
import { Card, Chips, PageHead } from "@/components/kit";
import { Num, Mini, num, fmt } from "@/components/tool-kit";
import { useLocalState } from "@/lib/arcieri/local-store";
import { estimateSpeed } from "@/components/foc-3d";
import { ToolChart, type ChartSeries } from "@/components/tool-chart";

export const Route = createFileRoute("/_app/vento")({ component: Page });

/**
 * Deriva da vento laterale con il metodo del "ritardo": la freccia rallenta (≈0,2% di velocità per metro),
 * e il vento la spinge per il tempo in più rispetto a un volo senza aria. Stima indicativa.
 */
type Store = { kmh: string; dir: string; dist: number; lb: string; grains: string };
const DIRS = [
  { id: "9", label: "Da sinistra", f: 1, side: 1 },
  { id: "10", label: "Da sx in diagonale", f: 0.71, side: 1 },
  { id: "12", label: "Di fronte", f: 0, side: 0 },
  { id: "2", label: "Da dx in diagonale", f: 0.71, side: -1 },
  { id: "3", label: "Da destra", f: 1, side: -1 },
];

function Page() {
  const [st, setSt] = useLocalState<Store>("aa-vento-v1", { kmh: "15", dir: "9", dist: 50, lb: "36", grains: "350" });
  const d = DIRS.find((x) => x.id === st.dir) ?? DIRS[0];
  const v0 = estimateSpeed(num(st.lb), num(st.grains)) || 55;
  const w = (num(st.kmh) || 0) / 3.6;
  const a = 0.002;
  const D = st.dist;
  const driftAt = (dist: number, wind: number) => {
    const t = -Math.log(Math.max(1e-6, 1 - a * dist)) / (a * v0);
    return wind * d.f * (t - dist / v0);
  };
  const drift = driftAt(D, w); // metri
  const xs = Array.from({ length: 17 }, (_, i) => 10 + i * 5);
  const kmh = num(st.kmh) || 0;
  const curves: ChartSeries[] = [
    { name: `${fmt(kmh, 0)} km/h`, color: "#9fe9ff", unit: "cm", points: xs.map((x) => ({ x, y: driftAt(x, w) * 100 })) },
    { name: `${fmt(kmh + 10, 0)} km/h`, color: "#f2a65a", unit: "cm", dashed: true, points: xs.map((x) => ({ x, y: driftAt(x, (kmh + 10) / 3.6) * 100 })) },
  ];
  const cm = drift * 100;
  const faceCm = D >= 60 ? 122 : D >= 40 ? 80 : 60;
  const ringCm = faceCm / 20;
  const px = Math.min(70, (cm / (faceCm / 2)) * 70) * d.side;
  return (
    <div className="grid gap-3">
      <PageHead kicker="Strumenti" title="Vento" lede="Quanto il vento laterale sposta la freccia, e dove mirare per compensare." />
      <ToolArt id="vento" />
      <Card className="grid gap-2.5">
        <div className="grid grid-cols-2 gap-2">
          <Num label="Vento" unit="km/h" value={st.kmh} onChange={(kmh) => setSt({ ...st, kmh })} />
          <Num label="Libbre" unit="lb" value={st.lb} onChange={(lb) => setSt({ ...st, lb })} />
          <Num label="Peso freccia" unit="gr" value={st.grains} onChange={(grains) => setSt({ ...st, grains })} />
        </div>
        <Chips value={st.dir} onChange={(dir) => setSt({ ...st, dir })} options={DIRS.map((x) => ({ id: x.id, label: x.label }))} />
        <Chips value={String(st.dist)} onChange={(v) => setSt({ ...st, dist: Number(v) })} options={[18, 30, 50, 60, 70, 90].map((x) => ({ id: String(x), label: `${x} m` }))} />
      </Card>
      <Card className="grid justify-items-center gap-3">
        <svg viewBox="-90 -90 180 180" className="h-56 w-56">
          {["#f4f1ea", "#1d2126", "#2f7fd1", "#d63a2f", "#f2c94c"].map((c, i) => <circle key={c} r={70 * (1 - i * 0.2)} fill={c} />)}
          {d.f ? (
            <g className="aa-wind" style={{ ["--dx" as string]: `${-d.side * 40}px` }}>
              {[-30, -10, 10, 30].map((y) => <path key={y} d={`M${-d.side * 85} ${y} h${d.side * 22}`} stroke="#9fe9ff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />)}
            </g>
          ) : null}
          <circle cx={-px} cy={0} r={5} fill="none" stroke="#7cf0a8" strokeWidth="2" strokeDasharray="3 2" />
          <circle cx={0} cy={0} r={4} fill="#fff" stroke="#1d2126" strokeWidth="1.5" />
          <circle cx={px} cy={0} r={4.5} fill="#1d2126" stroke="#fff" strokeWidth="1.5" className="aa-pop" key={px} />
          {Math.abs(px) > 3 ? <path d={`M0 0 L${px * 0.85} 0`} stroke="#fff" strokeWidth="1.2" opacity="0.7" /> : null}
        </svg>
        <div className="grid w-full grid-cols-3 gap-1.5">
          <Mini k="Spostamento" v={`${fmt(Math.abs(cm), 0)} cm`} tone={Math.abs(cm) > ringCm * 2 ? "warn" : "ok"} />
          <Mini k="Anelli" v={fmt(Math.abs(cm) / ringCm, 1)} />
          <Mini k="Velocità freccia" v={`${Math.round(v0)} m/s`} />
        </div>
        <p className="text-sm">
          {d.f === 0 ? "Vento di fronte o alle spalle: non sposta di lato, cambia un po' l'altezza." : `Mira circa ${fmt(Math.abs(cm), 0)} cm ${d.side > 0 ? "a sinistra" : "a destra"} del centro (cerchio tratteggiato), su un bersaglio da ${faceCm} cm.`}
        </p>
        {d.f ? <div className="w-full"><ToolChart title="Spostamento per distanza" series={curves} xLabel="metri" yLabel="cm" marker={{ x: D, label: `a ${D} m` }} /></div> : null}
        <p className="text-[0.7rem] text-muted">Stima per raffiche costanti: il vento vero cambia in volo. Usala per capire l'ordine di grandezza, poi correggi sul campo.</p>
      </Card>
    </div>
  );
}
