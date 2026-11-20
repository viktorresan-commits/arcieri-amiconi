import { useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { gearStats, listEquipment, listSetups } from "@/lib/arcieri/club.api";
import { useLoad } from "@/lib/arcieri/use-load";
import { saveMainGear, useMainGear, type MainGear } from "@/lib/arcieri/main-gear";
import { ArrowIcon, BOW_TYPES, BowIcon } from "./gear-icons";
import { Card } from "./kit";
import { Glyph } from "./icons";

type Equip = Awaited<ReturnType<typeof listEquipment>>[number];

/** Copia una configurazione (o un arco e una serie di frecce) come attrezzatura principale. */
function snapshot(setupId: number | null, name: string, bow: Equip | null, arrow: Equip | null): MainGear {
  return {
    setupId,
    name,
    bowId: bow?.id ?? null,
    arrowId: arrow?.id ?? null,
    bowName: bow?.name ?? "",
    arrowName: arrow?.name ?? "",
    bowSpecs: (bow?.specs as Record<string, string>) ?? {},
    arrowSpecs: (arrow?.specs as Record<string, string>) ?? {},
  };
}

/**
 * Attrezzatura principale: arco e frecce che usi di solito, con le loro statistiche.
 * Si sceglie fra le configurazioni; un allenamento nuovo parte da qui.
 */
export function MainGearCard({ compact = false }: { compact?: boolean }) {
  const main = useMainGear();
  const gear = useLoad("main-gear-eq", () => listEquipment());
  const setups = useLoad("main-gear-su", () => listSetups());
  const stats = useLoad("main-gear-st", () => gearStats());
  const mine = useMemo(() => (gear.data ?? []).filter((g) => g.mine), [gear.data]);
  const byId = (id: number | null) => (id == null ? null : mine.find((g) => g.id === id) ?? null);

  // tiene la copia aggiornata se nel frattempo hai cambiato le schede
  useEffect(() => {
    if (!main || !gear.data) return;
    const bow = byId(main.bowId);
    const arrow = byId(main.arrowId);
    const fresh = snapshot(main.setupId, main.name, bow, arrow);
    if (JSON.stringify(fresh.bowSpecs) !== JSON.stringify(main.bowSpecs) || JSON.stringify(fresh.arrowSpecs) !== JSON.stringify(main.arrowSpecs) || fresh.bowName !== main.bowName || fresh.arrowName !== main.arrowName) {
      saveMainGear(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gear.data, main?.bowId, main?.arrowId]);

  const pick = (id: number) => {
    const su = (setups.data ?? []).find((s) => s.id === id);
    if (!su) return;
    saveMainGear(snapshot(su.id, su.name, byId(su.bowId), byId(su.arrowId)));
  };
  const statOf = (id: number | null) => (stats.data ?? []).find((s) => s.id === id);
  const bowStat = statOf(main?.bowId ?? null);
  const arrowStat = statOf(main?.arrowId ?? null);
  const b = main?.bowSpecs ?? {};
  const a = main?.arrowSpecs ?? {};
  const bowLabel = BOW_TYPES.find((t) => t.id === b.bowType)?.label;
  const cells: [string, string][] = [
    ["Libbre", b.draw ? `${b.draw} lb` : "—"],
    ["Arco", b.length ? `${b.length}″` : "—"],
    ["Frecce", a.qty ? `${a.qty}` : "—"],
    ["Spine", a.spine || "—"],
    ["Tirate", bowStat?.arrows || arrowStat?.arrows ? `${(arrowStat?.arrows ?? bowStat?.arrows ?? 0).toLocaleString("it-IT")}` : "0"],
    ["Media", arrowStat?.arrows ? arrowStat.avg.toFixed(2).replace(".", ",") : bowStat?.arrows ? bowStat.avg.toFixed(2).replace(".", ",") : "—"],
  ];
  const list = setups.data ?? [];

  return (
    <Card className="grid gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted">Attrezzatura principale</p>
          <p className="font-display text-xl leading-tight">{main?.name || "Da scegliere"}</p>
        </div>
        <Link to="/attrezzatura" className="aa-chip shrink-0"><Glyph name="bag" size={14} /> Borsa</Link>
      </div>
      {main ? (
        <div className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
          <span className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-2xl bg-white/[0.05]">
            <BowIcon type={b.bowType || "olimpico"} riser={b.riser} limbs={b.limbs} className="h-16 w-16" />
          </span>
          <div className="grid min-w-0 gap-1">
            <p className="truncate text-sm"><b>{main.bowName || "Arco"}</b>{bowLabel ? <span className="text-muted"> · {bowLabel}</span> : null}</p>
            <ArrowIcon material={a.material} shaft={a.shaft} fletch={a.fletch} cock={a.cock} nock={a.nock} wrap={a.wrap} fletchType={a.fletchType} fletchStyle={a.fletchStyle} fletch2={a.fletch2} point={a.pointType} className="h-7 w-full" />
            <p className="truncate text-xs text-muted">{main.arrowName || "Frecce"}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">{list.length ? "Scegli la configurazione che usi di solito: la vedrai qui, sull'arciere della Home e all'inizio di ogni allenamento." : "Crea una configurazione (arco + frecce) in Attrezzatura, poi sceglila come principale."}</p>
      )}
      {main && !compact ? (
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {cells.map(([k, v]) => (
            <span key={k} className="rounded-xl bg-white/[0.05] px-1 py-1.5">
              <span className="block text-[0.58rem] uppercase tracking-wider text-muted">{k}</span>
              <b className="font-display text-base tabular-nums">{v}</b>
            </span>
          ))}
        </div>
      ) : null}
      {list.length ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
          {list.map((su) => (
            <button key={su.id} type="button" aria-pressed={main?.setupId === su.id} className="aa-chip shrink-0" onClick={() => pick(su.id)}>
              {main?.setupId === su.id ? <Glyph name="check" size={13} /> : null}
              {su.name || `Configurazione ${su.id}`}
            </button>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
