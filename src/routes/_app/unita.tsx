import { createFileRoute } from "@tanstack/react-router";
import { ToolArt } from "@/components/tool-art";
import { Card, PageHead } from "@/components/kit";
import { Num, num } from "@/components/tool-kit";
import { useLocalState } from "@/lib/arcieri/local-store";

export const Route = createFileRoute("/_app/unita")({ component: Page });

/** Convertitore delle unità che l'arciere incontra: scrivi in una casella, l'altra si aggiorna. */
const PAIRS = [
  { id: "lb", a: "lb", b: "kg", k: 0.45359237, hint: "Libbraggio" },
  { id: "in", a: "pollici", b: "cm", k: 2.54, hint: "Allungo, freccia, arco" },
  { id: "yd", a: "iarde", b: "metri", k: 0.9144, hint: "Distanze" },
  { id: "gr", a: "grani", b: "grammi", k: 0.06479891, hint: "Peso di punte e frecce" },
  { id: "fps", a: "fps", b: "m/s", k: 0.3048, hint: "Velocità" },
  { id: "ftlb", a: "ft·lb", b: "joule", k: 1.35582, hint: "Energia" },
];

function Page() {
  const [st, setSt] = useLocalState<Record<string, string>>("aa-unita-v1", {});
  const show = (x: number) => (Number.isFinite(x) ? String(Math.round(x * 1000) / 1000).replace(".", ",") : "");
  return (
    <div className="grid gap-3">
      <PageHead kicker="Strumenti" title="Convertitore" lede="Scrivi in una delle due caselle." />
      <ToolArt id="unita" />
      {PAIRS.map((p) => {
        const a = st[`${p.id}a`] ?? "";
        const b = st[`${p.id}b`] ?? "";
        return (
          <Card key={p.id} className="grid gap-1.5">
            <p className="text-xs text-muted">{p.hint}</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <Num label={p.a} value={a} onChange={(v) => setSt({ ...st, [`${p.id}a`]: v, [`${p.id}b`]: v.trim() ? show(num(v) * p.k) : "" })} />
              <span className="pb-3 text-muted">⇄</span>
              <Num label={p.b} value={b} onChange={(v) => setSt({ ...st, [`${p.id}b`]: v, [`${p.id}a`]: v.trim() ? show(num(v) / p.k) : "" })} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
