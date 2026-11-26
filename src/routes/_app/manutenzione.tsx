import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHead, Segmented } from "@/components/kit";
import { Inventory } from "@/components/inventory";
import { listEquipment } from "@/lib/arcieri/club.api";
import { useLoad } from "@/lib/arcieri/use-load";
import { AppIcon, Glyph, StatusMark } from "@/components/icons";
import { useLocalState } from "@/lib/arcieri/local-store";
import { dashboard } from "@/lib/arcieri/training.api";

export const Route = createFileRoute("/_app/manutenzione")({ component: Page });

/**
 * Manutenzione: per ogni parte, quando l'hai sistemata l'ultima volta (giorni e frecce tirate da allora).
 * Le frecce vengono dai tuoi allenamenti; tutto il resto resta sul telefono.
 */
type Part = { id: string; label: string; hint: string; days: number; arrows: number; /** categoria dell'inventario da cui viene il pezzo */ cat?: string };
const PARTS: Part[] = [
  { id: "corda", label: "Corda", hint: "Cambio consigliato", days: 270, arrows: 6000, cat: "corda" },
  { id: "serving", label: "Serving e punto di incocco", hint: "Controlla usura e altezza", days: 90, arrows: 2500 },
  { id: "cera", label: "Cera sulla corda", hint: "Passa la cera", days: 21, arrows: 600 },
  { id: "cocche", label: "Cocche", hint: "Crepe o gioco sulla corda", days: 60, arrows: 1500, cat: "cocche" },
  { id: "penne", label: "Penne e alette", hint: "Incollatura e strappi", days: 45, arrows: 1200, cat: "alette" },
  { id: "rest", label: "Rest e bottone", hint: "Molla e posizione", days: 120, arrows: 3000, cat: "rest" },
  { id: "viti", label: "Viti e mirino", hint: "Stringi e controlla", days: 30, arrows: 800, cat: "mirino" },
];
type Log = Record<string, { date: string; arrows: number } | undefined>;

function Page() {
  const [tab, setTab] = useLocalState<"controlli" | "inventario">("aa-manut-tab", "inventario");
  return (
    <div className="grid gap-3">
      <PageHead kicker="Attrezzatura" title="Manutenzione" lede={tab === "inventario" ? "Tutto quello che hai inserito o comprato: è solo tuo, gli altri non lo vedono." : "Tocca «Fatto» quando sistemi una parte: conto io giorni e frecce da allora."} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: "inventario", label: "Inventario" },
          { id: "controlli", label: "Controlli" },
        ]}
      />
      {tab === "inventario" ? <Inventory /> : <Checks />}
    </div>
  );
}

function Checks() {
  const [log, setLog] = useLocalState<Log>("aa-manut-v1", {});
  const gear = useLoad("manut-gear", () => listEquipment());
  // l'ultimo pezzo comprato per ogni parte: la corda montata, le cocche nuove…
  const lastOf = (cat?: string) =>
    cat ? (gear.data ?? []).filter((g) => g.mine && g.category === cat && g.purchasedOn).sort((a, b) => (b.purchasedOn ?? "").localeCompare(a.purchasedOn ?? ""))[0] ?? null : null;
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    dashboard()
      .then((d) => setTotal(Number(d.all.arrows) || 0))
      .catch(() => setTotal(null));
  }, []);
  const today = new Date();
  const mark = (id: string, date = today.toISOString()) => setLog({ ...log, [id]: { date, arrows: total ?? 0 } });

  const rows = PARTS.map((p) => {
    const l = log[p.id];
    if (!l) return { p, l, frac: null as number | null, days: null as number | null, arrows: null as number | null };
    const days = Math.floor((today.getTime() - new Date(l.date).getTime()) / 86400000);
    const arrows = total != null ? Math.max(0, total - l.arrows) : null;
    const frac = Math.max(days / p.days, arrows != null ? arrows / p.arrows : 0);
    return { p, l, frac, days, arrows };
  });
  const due = rows.filter((r) => r.frac != null && r.frac >= 1).length;

  return (
    <div className="grid gap-3">
      <Card className="flex items-center gap-3">
        <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${due ? "bg-rose-500/20" : "bg-emerald-400/15"}`}>
          <AppIcon name="wrench" size={44} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{due ? `${due} ${due === 1 ? "cosa da fare" : "cose da fare"}` : "Tutto in ordine"}</p>
          <p className="text-xs text-muted">{total != null ? `${total.toLocaleString("it-IT")} frecce tirate in tutto` : "Frecce: apri l'app collegata per contarle"}</p>
        </div>
      </Card>
      <div className="grid gap-2">
        {rows.map(({ p, l, frac, days, arrows }) => {
          const state = frac == null ? null : frac >= 1 ? "bad" : frac >= 0.75 ? "warn" : "ok";
          const bar = frac == null ? 0 : Math.min(1, frac);
          return (
            <Card key={p.id} className="grid gap-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{state ? <StatusMark state={state} /> : null}{p.label}</p>
                  <p className="text-xs text-muted">
                    {l ? `${days === 0 ? "Oggi" : `${days} giorni fa`}${arrows != null ? ` · ${arrows.toLocaleString("it-IT")} frecce` : ""}` : `${p.hint}: ogni ${p.days} giorni o ${p.arrows.toLocaleString("it-IT")} frecce`}
                  </p>
                </div>
                <button type="button" className="aa-chip shrink-0" onClick={() => mark(p.id)}>
                  <Glyph name="check" size={14} /> Fatto
                </button>
              </div>
              {(() => {
                const last = lastOf(p.cat);
                if (!last) return null;
                const bought = last.purchasedOn ?? "";
                const usedIt = l && l.date.slice(0, 10) === bought;
                return (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-muted">
                    <span>Ultimo acquisto: <b className="text-fg">{last.name}</b>, {bought.split("-").reverse().join("/")}</span>
                    {!l || (!usedIt && l.date.slice(0, 10) < bought) ? (
                      <button type="button" className="font-semibold text-primary" onClick={() => mark(p.id, `${bought}T12:00:00.000Z`)}>montato quel giorno</button>
                    ) : null}
                  </p>
                );
              })()}
              {l ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${bar * 100}%`, background: state === "bad" ? "#e5484d" : state === "warn" ? "#e3a21a" : "#2fbf71" }} />
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
      <p className="px-1 text-[0.7rem] text-muted">I tempi sono indicativi: dipendono da quanto tiri e dal materiale. Si salva da solo.</p>
    </div>
  );
}
