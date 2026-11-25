/**
 * Consigli rapidi sull'attrezzatura, dalle regole pratiche usate in sala:
 * spine indicativo dal libraggio reale, peso freccia in grani per libbra (gpp).
 * Sono indicazioni di partenza, da verificare con la tabella del produttore e sul paglione.
 */

import { carbonSpineFor, catalogSpine, GRAINS_PER_G, spineLb, woodSpineBand, woodSpineIdeal } from "./arrow-spec";

const it = (n: number, d = 1) => (Number.isInteger(n) ? String(n) : n.toFixed(d)).replace(".", ",");

export type BowLike = { bowType?: string; draw?: string; drawLen?: string };
export type ArrowLike = { weight?: string; weightG?: string; spine?: string; spineUnit?: string; length?: string; material?: string; point?: string };

/** Libbre reali all'allungo: ±2 lb per pollice rispetto a 28″ (archi senza camme). */
export function realLb(bow: BowLike) {
  const lb = Number(bow.draw) || 0;
  const inch = Number(bow.drawLen) || 28;
  if (!lb) return 0;
  return bow.bowType === "compound" ? lb : lb + 2 * (inch - 28);
}

/**
 * Spine consigliato in libbre (aste di legno, sgancio a dita): libbre reali sulle dita, +5 lb per
 * pollice di freccia oltre i 28″, +5 lb ogni 25 grani di punta oltre i 125.
 */
export function spineLbFor(bow: BowLike, arrowLengthInch?: number, pointGr = 125) {
  const lb = realLb(bow);
  if (!lb) return null;
  const eff = bow.bowType === "compound" ? lb * 0.75 : lb;
  return woodSpineIdeal(eff, arrowLengthInch || 28, pointGr);
}

/** "45-50 lb (in carbonio ~600)" */
export function spineFor(bow: BowLike, arrowLengthInch?: number, pointGr = 125) {
  const lb = spineLbFor(bow, arrowLengthInch, pointGr);
  if (!lb) return "";
  const c = carbonSpineFor(lb);
  return `${woodSpineBand(lb)} lb${c ? ` (in carbonio ~${catalogSpine(c)})` : ""}`;
}

/** Intervallo di peso freccia consigliato (grani totali). */
export function grainsFor(bow: BowLike) {
  const lb = realLb(bow);
  if (!lb) return null;
  const gpp: Record<string, [number, number]> = {
    compound: [5.5, 7.5],
    olimpico: [7, 9],
    nudo: [8, 10],
    longbow: [9, 12],
    ricurvo: [8.5, 11],
    storico: [8, 11],
  };
  const [a, b] = gpp[bow.bowType ?? "olimpico"] ?? gpp.olimpico;
  return { min: Math.round(lb * a), max: Math.round(lb * b), gpp: [a, b] as [number, number], lb };
}

/** Consigli per un arco: libbre reali, spine e peso freccia. */
export function bowAdvice(bow: BowLike): string[] {
  const out: string[] = [];
  const lb = realLb(bow);
  if (!lb) return ["Indica libbre e allungo: ti dico spine e peso freccia adatti."];
  const inch = Number(bow.drawLen) || 28;
  if (bow.bowType !== "compound" && Math.abs(inch - 28) >= 0.5) out.push(`Al tuo allungo (${it(inch)}″) tiri circa ${lb.toFixed(0)} lb reali.`);
  const g = grainsFor(bow);
  if (g) out.push(`Freccia consigliata: ${g.min}–${g.max} grani (${it(g.gpp[0])}–${it(g.gpp[1])} gr/lb).`);
  const sp = spineFor(bow, inch + 1);
  if (sp) out.push(`Spine indicativo: ${sp} (freccia ~1″ più lunga dell'allungo).`);
  if (bow.bowType === "compound") out.push("Sotto 5 gr/lb il compound rischia danni: non scendere.");
  return out;
}

/** Consigli per un set di frecce, confrontato con l'arco principale (se c'è). */
export function arrowAdvice(arrow: ArrowLike, bow?: BowLike | null): string[] {
  const out: string[] = [];
  const w = Number(arrow.weight) || 0;
  if (!bow || !realLb(bow)) {
    if (!w) out.push("Aggiungi il peso (in grammi): così confronto la freccia col tuo arco.");
    return out;
  }
  const g = grainsFor(bow);
  const lb = realLb(bow);
  if (w && g) {
    const gpp = w / lb;
    const gTxt = (gr: number) => `${it(gr / GRAINS_PER_G)} g`;
    if (w < g.min) out.push(`Leggera per il tuo arco: ${gTxt(w)}, ${it(gpp)} grani per libbra (consigliati ${gTxt(g.min)}–${gTxt(g.max)}). Più veloce ma più sensibile al vento.`);
    else if (w > g.max) out.push(`Pesante per il tuo arco: ${gTxt(w)}, ${it(gpp)} grani per libbra (consigliati ${gTxt(g.min)}–${gTxt(g.max)}). Traiettoria più curva, ma più stabile.`);
    else out.push(`Peso giusto: ${gTxt(w)}, ${it(gpp)} grani per libbra con il tuo arco.`);
  }
  const point = Number(arrow.point) || 125;
  const wantLb = spineLbFor(bow, Number(arrow.length) || undefined, point);
  const want = spineFor(bow, Number(arrow.length) || undefined, point);
  const mine = spineLb(arrow.spine, arrow.spineUnit, arrow.material);
  if (mine && wantLb) {
    const s = `${Math.round(mine)} lb`;
    if (mine < wantLb - 5) out.push(`Spine ${s}: troppo morbida per ${lb.toFixed(0)} lb reali (indicativo ${want}). Con lo sgancio a dita la punta va a sinistra (arciere destro).`);
    else if (mine > wantLb + 7) out.push(`Spine ${s}: rigida per ${lb.toFixed(0)} lb reali (indicativo ${want}). La punta tende a destra (arciere destro).`);
    else out.push(`Spine ${s}: in linea con il tuo arco (${want}).`);
  } else if (want) out.push(`Spine indicativo per il tuo arco: ${want}.`);
  return out;
}
