import { createFileRoute } from "@tanstack/react-router";
import { ToolArt } from "@/components/tool-art";
import { Card, Chips, PageHead } from "@/components/kit";
import { Num, Mini, num, fmt } from "@/components/tool-kit";
import { useLocalState } from "@/lib/arcieri/local-store";
import { estimateSpeed } from "@/components/foc-3d";

export const Route = createFileRoute("/_app/energia")({ component: Page });

/** Velocità, energia cinetica e quantità di moto della freccia: dalla velocità misurata o stimata dalle libbre. */
type Store = { mode: "stima" | "misura"; lb: string; grains: string; fps: string };

function Page() {
  const [st, setSt] = useLocalState<Store>("aa-energia-v1", { mode: "stima", lb: "36", grains: "350", fps: "180" });
  const gr = num(st.grains);
  const ms = st.mode === "misura" ? num(st.fps) * 0.3048 : estimateSpeed(num(st.lb), gr);
  const kg = gr * 6.48e-5;
  const ke = 0.5 * kg * ms * ms;
  const mom = kg * ms;
  const ok = ms > 0 && kg > 0;
  const bars = [
    { k: "Velocità", v: ms, max: 100, label: `${fmt(ms, 0)} m/s · ${fmt(ms / 0.3048, 0)} fps`, c: "#3aa7c4" },
    { k: "Energia", v: ke, max: 120, label: `${fmt(ke, 1)} J · ${fmt(ke * 0.7376, 1)} ft·lb`, c: "#d6912a" },
    { k: "Quantità di moto", v: mom, max: 2, label: `${fmt(mom, 2)} kg·m/s`, c: "#2fbf71" },
  ];
  return (
    <div className="grid gap-3">
      <PageHead kicker="Strumenti" title="Velocità ed energia" lede="Quanto corre e quanta energia porta la freccia: utile per scegliere il peso giusto." />
      <ToolArt id="energia" />
      <Chips value={st.mode} onChange={(mode) => setSt({ ...st, mode })} options={[{ id: "stima", label: "Stima dalle libbre" }, { id: "misura", label: "Ho il cronografo" }]} />
      <Card className="grid grid-cols-2 gap-2">
        {st.mode === "stima" ? <Num label="Libbre sulle dita" unit="lb" value={st.lb} onChange={(lb) => setSt({ ...st, lb })} /> : <Num label="Velocità misurata" unit="fps" value={st.fps} onChange={(fps) => setSt({ ...st, fps })} />}
        <Num label="Peso freccia" unit="gr" value={st.grains} onChange={(grains) => setSt({ ...st, grains })} />
      </Card>
      {ok ? (
        <Card className="grid gap-3">
          {bars.map((b, i) => (
            <div key={b.k} className="grid gap-1">
              <div className="flex justify-between text-xs"><span className="text-muted">{b.k}</span><b className="tabular-nums">{b.label}</b></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="aa-grow h-full rounded-full" style={{ width: `${Math.min(100, (b.v / b.max) * 100)}%`, background: b.c, animationDelay: `${i * 120}ms` }} />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-1.5">
            <Mini k="Grani per libbra" v={st.mode === "stima" && num(st.lb) ? fmt(gr / num(st.lb), 1) : "—"} />
            <Mini k="Tempo a 70 m" v={`${fmt(70 / ms, 2)} s`} />
          </div>
          <p className="text-[0.7rem] text-muted">{st.mode === "stima" ? "Stima per archi ricurvi e tradizionali (resa circa 75%): un cronografo dà il dato vero." : "1 fps = 0,3048 m/s. Energia = ½·massa·velocità²."}</p>
        </Card>
      ) : null}
    </div>
  );
}
