import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { listEquipment, listShopping } from "@/lib/arcieri/club.api";
import { useLoad } from "@/lib/arcieri/use-load";
import { boughtParts, compose, partOf, type Bought, type PartKind } from "@/lib/arcieri/arrow-compose";
import { ArrowArt } from "@/components/arrow-art";
import { cx } from "@/components/kit";

const ROWS: { kind: PartKind; label: string; empty: string }[] = [
  { kind: "aste", label: "Asta", empty: "aste" },
  { kind: "alette", label: "Penne o alette", empty: "penne o alette" },
  { kind: "punte", label: "Punta", empty: "punte" },
  { kind: "cocche", label: "Cocca", empty: "cocche" },
];

const fmt = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 1 });

/**
 * La freccia si compone prima da quello che hai comprato: un'asta, le penne, la punta e la cocca prese
 * dagli acquisti e dall'attrezzatura. Scelto un pezzo, la scheda si riempie (materiale, spine, misure,
 * forma e colori, quante frecce vengono, peso stimato); sotto resta tutto da personalizzare.
 */
export function ArrowComposer({ specs, isNew, onApply }: { specs: Record<string, string>; isNew: boolean; onApply: (specs: Record<string, string>, name: string) => void }) {
  const gear = useLoad("compose-gear", () => listEquipment());
  const shop = useLoad("compose-shop", () => listShopping());
  const parts = useMemo(() => boughtParts((gear.data ?? []) as Parameters<typeof boughtParts>[0], shop.data ?? []), [gear.data, shop.data]);
  const byKind = (k: PartKind) => parts.filter((p) => p.kind === k);
  // pezzi scelti: quelli già usati da questa serie, altrimenti il primo (il più recente) di ogni tipo
  const initial = () => Object.fromEntries(ROWS.map(({ kind }) => {
    const used = specs[`comp_${kind}`];
    const list = parts.filter((p) => p.kind === kind);
    return [kind, (used && list.find((p) => p.name === used)?.key) || (isNew ? list[0]?.key ?? "" : "")];
  })) as Record<PartKind, string>;
  const [pick, setPick] = useState<Record<PartKind, string> | null>(null);
  const chosen = pick ?? (parts.length ? initial() : null);
  const ready = !gear.loading && !shop.loading;
  const applied = useRef(false);

  const result = useMemo(() => {
    if (!chosen) return null;
    const get = (k: PartKind) => parts.find((p) => p.key === chosen[k]) ?? null;
    const wooden = (get("aste") ? partOf(get("aste") as Bought).specs.material : specs.material) === "legno";
    const ps = { aste: get("aste") ? partOf(get("aste") as Bought) : null, alette: get("alette") ? partOf(get("alette") as Bought) : null, punte: get("punte") ? partOf(get("punte") as Bought, wooden) : null, cocche: get("cocche") ? partOf(get("cocche") as Bought) : null };
    return { parts: ps, comp: compose(ps, specs) };
  }, [chosen, parts, specs]);

  const apply = (sel: Record<PartKind, string>) => {
    const get = (k: PartKind) => parts.find((p) => p.key === sel[k]) ?? null;
    const shaft = get("aste");
    const wooden = (shaft ? partOf(shaft).specs.material : specs.material) === "legno";
    const ps = { aste: shaft ? partOf(shaft) : null, alette: get("alette") ? partOf(get("alette") as Bought) : null, punte: get("punte") ? partOf(get("punte") as Bought, wooden) : null, cocche: get("cocche") ? partOf(get("cocche") as Bought) : null };
    if (!ps.aste && !ps.alette && !ps.punte && !ps.cocche) return;
    const c = compose(ps, specs);
    const out: Record<string, string> = { ...c.specs };
    for (const { kind } of ROWS) out[`comp_${kind}`] = get(kind)?.name ?? "";
    // peso stimato solo se non l'hai già pesata (o se c'è ancora la stima di prima): un peso vero vale più di una stima
    const mine = specs.weightG && specs.weightG !== specs.weightEst;
    if (c.weight.totalG != null && !mine && !specs.arrowsG && !specs.weightMinG) {
      out.weightMode = "uguale";
      out.weightG = String(c.weight.totalG);
      out.weightEst = String(c.weight.totalG);
    }
    onApply(out, c.name);
  };

  // scheda nuova: si compone subito da sola con i pezzi più recenti
  useEffect(() => {
    if (!isNew || applied.current || !ready || !parts.length || !chosen) return;
    applied.current = true;
    apply(chosen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, ready, parts.length]);

  const choose = (kind: PartKind, key: string) => {
    const next = { ...(chosen ?? initial()), [kind]: key };
    setPick(next);
    apply(next);
  };

  if (!ready) return <div className="aa-skel h-24 rounded-xl" />;
  if (!parts.length) {
    return (
      <div className="grid gap-1 rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-muted">
        <p className="text-sm font-semibold text-fg">Componi dai tuoi acquisti</p>
        <p>Segna in Acquisti le aste, le penne, le punte e le cocche che hai comprato (o fotografa lo scontrino): la freccia si compone da sola con quei pezzi, poi la personalizzi.</p>
        <Link to="/acquisti" className="justify-self-start font-semibold text-fg underline underline-offset-2">Vai agli acquisti</Link>
      </div>
    );
  }
  const w = result?.comp.weight;
  return (
    <div className="grid gap-2.5 rounded-xl border border-line bg-white/[0.03] p-2.5">
      <div>
        <p className="text-sm font-semibold">Composta da quello che hai comprato</p>
        <p className="text-xs text-muted">Tocca un pezzo per cambiarlo: la scheda si aggiorna. Sotto puoi personalizzare tutto.</p>
      </div>
      {ROWS.map(({ kind, label, empty }) => {
        const list = byKind(kind);
        const cur = chosen?.[kind] ?? "";
        return (
          <div key={kind} className="grid gap-1">
            <p className="text-[0.7rem] font-semibold text-muted">{label}</p>
            {list.length ? (
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {list.map((b) => {
                  const part = partOf(b, specs.material === "legno");
                  const look = { ...specs, ...part.specs };
                  return (
                    <button key={b.key} type="button" onClick={() => choose(kind, b.key)} aria-pressed={cur === b.key} className={cx("grid w-40 shrink-0 gap-1 rounded-xl border p-1.5 text-left", cur === b.key ? "border-accent bg-accent/10" : "border-line")}>
                      <span className="grid h-10 place-items-center overflow-hidden rounded-lg bg-[#0d1013]/60">
                        <ArrowArt material={look.material} shaft={look.shaft} fletch={look.fletch} cock={kind === "alette" ? part.specs.fletch || look.cock : look.cock} nock={look.nock} fletchType={look.fletchType} fletchStyle={look.fletchStyle} fletch2={look.fletch2} fletchLen={look.fletchLen} point={look.pointType || "field"} ground={false} part={kind} className="h-10 w-full" />
                      </span>
                      <span className="line-clamp-2 text-[0.7rem] font-semibold leading-tight">{b.name}</span>
                      <span className="text-[0.62rem] text-muted">{part.arrowsFor ? `per ${part.arrowsFor} frecce` : ""}{part.grains ? `${part.arrowsFor ? " · " : ""}${fmt(part.grains)} gr${kind === "alette" ? " l'una" : ""}` : ""}</span>
                    </button>
                  );
                })}
                <button type="button" onClick={() => choose(kind, "")} aria-pressed={!cur} className={cx("w-20 shrink-0 rounded-xl border p-1.5 text-[0.7rem] text-muted", !cur ? "border-accent" : "border-line")}>Nessuna</button>
              </div>
            ) : (
              <p className="text-xs text-muted">Nessun acquisto di {empty}: sceglilo sotto a mano.</p>
            )}
          </div>
        );
      })}
      {result ? (
        <div className="grid gap-0.5 rounded-lg bg-black/20 px-2.5 py-2 text-xs">
          {result.comp.canMake ? <p><b>Bastano per {result.comp.canMake} frecce</b> (il pezzo che finisce prima decide).</p> : null}
          {w && w.totalG != null ? (
            <p className="text-muted">
              Peso stimato <b className="text-fg">{fmt(w.totalG)} g</b> ({w.totalGr} grani): asta {w.shaft} · punta {w.point} · penne 3×{fmt((w.fletch ?? 0) / 3)} · cocca {w.nock}{w.insert ? ` · inserto ${w.insert}` : ""}. Pesala appena puoi: il peso vero vale di più.
            </p>
          ) : w ? <p className="text-muted">Per stimare il peso servono asta, penne, punta e cocca.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
