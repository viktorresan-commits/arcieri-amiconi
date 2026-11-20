/**
 * Consigli rapidi sull'attrezzatura, dalle regole pratiche usate in sala:
 * spine indicativo dal libraggio reale, peso freccia in grani per libbra (gpp).
 * Sono indicazioni di partenza, da verificare con la tabella del produttore e sul paglione.
 */

const it = (n: number, d = 1) => (Number.isInteger(n) ? String(n) : n.toFixed(d)).replace(".", ",");

export type BowLike = { bowType?: string; draw?: string; drawLen?: string };
export type ArrowLike = { weight?: string; spine?: string; length?: string; material?: string };

const SPINES: [number, string][] = [
  [20, "1000–900"],
  [24, "900–800"],
  [28, "800–700"],
  [32, "700–600"],
  [36, "600–550"],
  [40, "550–500"],
  [45, "500–400"],
  [50, "400–350"],
  [60, "350–300"],
];

/** Libbre reali all'allungo: ±2 lb per pollice rispetto a 28″ (archi senza camme). */
export function realLb(bow: BowLike) {
  const lb = Number(bow.draw) || 0;
  const inch = Number(bow.drawLen) || 28;
  if (!lb) return 0;
  return bow.bowType === "compound" ? lb : lb + 2 * (inch - 28);
}

export function spineFor(bow: BowLike, arrowLengthInch?: number) {
  let lb = realLb(bow);
  if (!lb) return "";
  // freccia più lunga di 28″ = si comporta come più flessibile: si aggiungono ~1,5 lb per pollice
  if (arrowLengthInch && arrowLengthInch > 28) lb += 1.5 * (arrowLengthInch - 28);
  if (bow.bowType === "compound") lb *= 0.75;
  return (SPINES.find(([max]) => lb <= max) ?? SPINES[SPINES.length - 1])[1];
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
    if (!w) out.push("Aggiungi il peso totale (grani): così confronto la freccia col tuo arco.");
    return out;
  }
  const g = grainsFor(bow);
  const lb = realLb(bow);
  if (w && g) {
    const gpp = w / lb;
    if (w < g.min) out.push(`Leggera per il tuo arco: ${it(gpp)} gr/lb (consigliati ${it(g.gpp[0])}–${it(g.gpp[1])}). Più veloce ma più sensibile al vento.`);
    else if (w > g.max) out.push(`Pesante per il tuo arco: ${it(gpp)} gr/lb. Traiettoria più curva, ma più stabile.`);
    else out.push(`Peso giusto: ${it(gpp)} gr/lb con il tuo arco.`);
  }
  const want = spineFor(bow, Number(arrow.length) || undefined);
  if (arrow.spine && want) {
    const [hi, lo] = want.split("–").map(Number);
    const s = Number(arrow.spine);
    if (s && s > hi + 50) out.push(`Spine ${s}: troppo flessibile per ${lb.toFixed(0)} lb reali (indicativo ${want}).`);
    else if (s && s < lo - 50) out.push(`Spine ${s}: rigida per ${lb.toFixed(0)} lb reali (indicativo ${want}).`);
    else if (s) out.push(`Spine ${s}: in linea con il tuo arco (${want}).`);
  } else if (want) out.push(`Spine indicativo per il tuo arco: ${want}.`);
  return out;
}
