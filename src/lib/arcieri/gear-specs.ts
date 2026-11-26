/**
 * Specifiche dei pezzi di attrezzatura: quali dati servono per ogni categoria, come leggerli dal
 * nome («Easton X10 600», «Punte 100 gr») o dalla scheda di un negozio («Spine: 600», «GPI 5,7»),
 * e come usarli: montare aste, punte, alette e cocche su una serie di frecce, consigli col proprio arco.
 * Funziona sul telefono e sul server (nessuna dipendenza del browser).
 */
import { arrowAdvice, bowAdvice, type BowLike } from "./gear-advice";
import { GRAINS_PER_G } from "./arrow-spec";

export type SpecField = { key: string; label: string; unit?: string; hint?: string; options?: readonly { id: string; label: string }[] };

const POINT_SHAPES = [
  { id: "ogiva", label: "Ogiva" },
  { id: "field", label: "Field" },
  { id: "3d", label: "3D" },
  { id: "gommino", label: "Gommino" },
  { id: "caccia", label: "Lama" },
] as const;
const NOCK_TYPES = [
  { id: "pin", label: "Pin" },
  { id: "in", label: "A innesto (in)" },
  { id: "out", label: "Out" },
  { id: "over", label: "Over" },
  { id: "conica", label: "Conica" },
] as const;
const VANE_TYPES = [
  { id: "alette", label: "Alette" },
  { id: "spin", label: "Spin wing" },
  { id: "penne", label: "Penne" },
  { id: "blazer", label: "Blazer" },
  { id: "plastifletch", label: "Plastifletch" },
] as const;

const MATERIAL: SpecField = { key: "material", label: "Materiale" };
const SIZE: SpecField = { key: "size", label: "Taglia / misura" };

/** i dati che contano per ogni categoria (le chiavi sono quelle già usate da frecce, FOC e balistica) */
export const SPEC_FIELDS: Record<string, SpecField[]> = {
  arco: [
    { key: "draw", label: "Libbraggio", unit: "lb", hint: "36" },
    { key: "length", label: "Lunghezza", unit: "″", hint: "68" },
    { key: "brace", label: "Brace height", unit: "″", hint: "8,75" },
    { key: "drawLen", label: "Allungo", unit: "″", hint: "28" },
  ],
  freccia: [
    { key: "spine", label: "Spine", hint: "600" },
    { key: "gpi", label: "Peso per pollice", unit: "gpi", hint: "7,5" },
    { key: "diameter", label: "Diametro", unit: "mm", hint: "5,2" },
    { key: "length", label: "Lunghezza", unit: "″", hint: "29" },
    { key: "point", label: "Punta", unit: "grani", hint: "100" },
  ],
  aste: [
    { key: "spine", label: "Spine", hint: "600" },
    { key: "gpi", label: "Peso per pollice", unit: "gpi", hint: "7,5" },
    { key: "diameter", label: "Diametro esterno", unit: "mm", hint: "5,2" },
    { key: "length", label: "Lunghezza", unit: "″", hint: "32" },
    MATERIAL,
  ],
  punte: [
    { key: "point", label: "Peso", unit: "grani", hint: "100" },
    { key: "pointType", label: "Forma", options: POINT_SHAPES },
    { key: "diameter", label: "Diametro", unit: "mm", hint: "5,2" },
    MATERIAL,
  ],
  alette: [
    { key: "fletchType", label: "Tipo", options: VANE_TYPES },
    { key: "fletchLen", label: "Lunghezza", unit: "″", hint: "1,75" },
    { key: "weight", label: "Peso di una", unit: "grani", hint: "5" },
    MATERIAL,
  ],
  cocche: [
    { key: "nockType", label: "Attacco", options: NOCK_TYPES },
    { key: "weight", label: "Peso", unit: "grani", hint: "9" },
    { key: "size", label: "Misura", hint: "S, L, G…" },
  ],
  corda: [
    { key: "material", label: "Materiale", hint: "8125G, BCY-X, Dacron…" },
    { key: "strands", label: "Fili", hint: "16" },
    { key: "length", label: "Lunghezza", unit: "″", hint: "65" },
    { key: "draw", label: "Per libbraggio", unit: "lb", hint: "30-40" },
  ],
  stabilizzatore: [
    { key: "length", label: "Lunghezza", unit: "″", hint: "30" },
    { key: "weightG", label: "Peso", unit: "g", hint: "120" },
    MATERIAL,
  ],
  mirino: [{ key: "length", label: "Estensione", unit: "″", hint: "9" }, MATERIAL],
  rest: [{ key: "kind", label: "Tipo", hint: "Magnetico, a molla, flipper…" }, MATERIAL],
  parabraccio: [SIZE, MATERIAL],
  guantino: [SIZE, MATERIAL],
  pettorina: [SIZE, MATERIAL],
  abbigliamento: [SIZE, MATERIAL],
  scarpe: [{ key: "size", label: "Numero", hint: "42" }, MATERIAL],
};
const GENERIC: SpecField[] = [MATERIAL, { key: "length", label: "Lunghezza" }, SIZE];

export const fieldsOf = (category: string) => SPEC_FIELDS[category] ?? GENERIC;

const num = (s: string) => s.replace(".", ",");
const SPINES = new Set([250, 300, 340, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 2000]);
/** misure delle aste in alluminio (1716, 1916, 2014…): diametro in 64esimi e spessore in millesimi */
const ALU = /\b(1[5-9]|2[0-4])(1[0-9]|0[89])\b/;

/** dati letti dal testo libero: nome del pezzo, titolo o descrizione di un negozio */
export function guessSpecs(text: string, category: string): Record<string, string> {
  const t = ` ${text.replace(/\s+/g, " ")} `;
  const out: Record<string, string> = {};
  const shafts = category === "aste" || category === "freccia";
  const sp = /\bspine\s*[:=]?\s*(\d{3,4})\b/i.exec(t) ?? (shafts ? /(?:^|[\s/-])(\d{3,4})(?=[\s/-]|$)(?!\s*(?:mm|gr|g\b|pz|€))/.exec(t) : null);
  if (sp && (SPINES.has(Number(sp[1])) || /spine/i.test(sp[0]))) out.spine = sp[1];
  else if (shafts) {
    const alu = ALU.exec(t);
    if (alu) out.spine = alu[0];
  }
  const gpi = /(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:gpi|gr\s*\/\s*(?:in|″|")|grani\s+per\s+pollice|grains?\s+per\s+inch)/i.exec(t);
  if (gpi) out.gpi = num(gpi[1]);
  const gr = /(\d{2,3}(?:[.,]\d)?)\s*(?:gr\b|grs\b|grani|grains?\b)/i.exec(t);
  if (gr) out[category === "punte" || category === "freccia" ? "point" : "weight"] = num(gr[1]);
  const inch = /(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:"|″|''|pollici|inch(?:es)?\b|in\b)/i.exec(t);
  if (inch) out[category === "alette" ? "fletchLen" : "length"] = num(inch[1]);
  const mm = /(\d{1,2}(?:[.,]\d{1,2})?)\s*mm\b/i.exec(t);
  if (mm) out.diameter = num(mm[1]);
  const lb = /(\d{2}(?:\s*-\s*\d{2})?)\s*(?:#|lbs?\b|libbre)/i.exec(t);
  if (lb) out.draw = lb[1].replace(/\s/g, "");
  const strands = /(\d{1,2})\s*(?:fili|strands?|str\b)/i.exec(t);
  if (strands) out.strands = strands[1];
  const grams = /(\d{2,4})\s*(?:g|gr?ammi)\b(?!\s*\/)/i.exec(t);
  if (grams && category === "stabilizzatore") out.weightG = grams[1];
  // custodie, faretre, protezioni, abbigliamento: prima i tessuti (la «carbon» di una custodia è delle frecce che porta)
  const cloth = !["aste", "freccia", "punte", "corda", "stabilizzatore", "mirino", "rest", "arco"].includes(category) ? clothOf(t) : "";
  const mat =
    cloth ||
    (/\b(8125g?|8190|bcy[\s-]?x|452x|d97|dacron|fast\s*flight|dyneema)\b/i.exec(t)?.[1] ??
      (/\bcarbo[\s-]?allu|carbon[\s-]?alu|x10|ace\b/i.test(t) ? "carbo-alluminio" : /\bcarbon(?:io|e)?\b/i.test(t) ? "carbonio" : /\ballumini|aluminum|\balu\b/i.test(t) ? "alluminio" : /\b(legno|cedro|pino|wood|cedar)\b/i.test(t) ? "legno" : /\bbamb[uù]\b/i.test(t) ? "bambu" : ""));
  if (mat) out.material = category === "corda" ? mat.toUpperCase().replace(/\s+/g, " ") : mat.toLowerCase();
  // pezzi senza unità fissa (custodie, borse, faretre): misure intere «183 × 15 cm» e lunghezza con la sua unità
  const lenField = fieldsOf(category).find((f) => f.key === "length");
  if (lenField && !lenField.unit) {
    const d = /(\d{2,3}(?:[.,]\d)?)\s*(cm|″|"|''|in)?\s*[x×*]\s*(\d{1,3}(?:[.,]\d)?)\s*(cm|″|"|''|in)(?:\s*[x×*]\s*(\d{1,3}(?:[.,]\d)?)\s*(?:cm|″|"|''|in))?/i.exec(t);
    const unitOf = (u: string | undefined) => (!u || /cm/i.test(u) ? "cm" : "″");
    const lenCm = /(?:lunghezza|length|lungo|long|lang)\s*[:=]?\s*(?:circa|approx\.?|ca\.?)?\s*(\d{2,3}(?:[.,]\d)?)\s*cm\b/i.exec(t) ?? /\b(\d{2,3}(?:[.,]\d)?)\s*cm\s*(?:lang|long|di lunghezza)\b/i.exec(t);
    if (d) {
      const u = unitOf(d[4] ?? d[2]);
      const tail = u === "cm" ? " cm" : "″";
      out.size = `${num(d[1])} × ${num(d[3])}${d[5] ? ` × ${num(d[5])}` : ""}${tail}`;
      out.length = `${num(d[1])}${tail}`;
    } else if (lenCm) out.length = `${num(lenCm[1])} cm`;
    else if (out.length) out.length = `${out.length}″`;
  }
  if (category === "punte") {
    const shape = /\b(ogiva|bullet)\b/i.test(t) ? "ogiva" : /\bfield\b/i.test(t) ? "field" : /\b3\s?d\b/i.test(t) ? "3d" : /\b(blunt|gommino)\b/i.test(t) ? "gommino" : "";
    if (shape) out.pointType = shape;
  }
  if (category === "cocche") {
    const nk = /\bpin\b/i.test(t) ? "pin" : /\bover\b/i.test(t) ? "over" : /\bout\b/i.test(t) ? "out" : /\b(in[\s-]?nock|innesto|g[\s-]?nock|\bin\b)/i.test(t) ? "in" : "";
    if (nk) out.nockType = nk;
  }
  if (category === "alette") {
    const v = /spin\s*wing|\bspin\b/i.test(t) ? "spin" : /\b(penn[ae]|feather)/i.test(t) ? "penne" : /\bblazer\b/i.test(t) ? "blazer" : /plastifletch/i.test(t) ? "plastifletch" : /\b(alett[ae]|vanes?)\b/i.test(t) ? "alette" : "";
    if (v) out.fletchType = v;
  }
  const size = /\btaglia\s*[:=]?\s*([a-z0-9]{1,4})\b/i.exec(t) ?? /\b(XXS|XS|XXL|XL|S|M|L)\b/.exec(t);
  if (size && ["parabraccio", "guantino", "pettorina", "abbigliamento", "scarpe", "cocche"].includes(category)) out.size = size[1].toUpperCase();
  return out;
}

/** il tessuto o il materiale di una custodia, di una faretra o di un capo («lana e pelle», «cordura») */
function clothOf(t: string): string {
  const found: string[] = [];
  const add = (re: RegExp, name: string) => {
    if (re.test(t) && !found.includes(name)) found.push(name);
  };
  add(/\b(eco[\s-]?pelle|similpelle|finta pelle|faux leather|pu leather|synthetic leather)\b/i, "ecopelle");
  if (!found.length) add(/\b(pelle|cuoio|leather|camoscio|suede)\b/i, "pelle");
  add(/\b(lana|wool|loden)\b/i, "lana");
  add(/\bcordura\b/i, "cordura");
  add(/\b(poliestere|polyester)\b/i, "poliestere");
  add(/\bnylon\b/i, "nylon");
  add(/\b(tela|canvas|canapa)\b/i, "tela");
  add(/\b(cotone|cotton)\b/i, "cotone");
  add(/\b(feltro|felt)\b/i, "feltro");
  add(/\b(pile|fleece)\b/i, "pile");
  add(/\bneoprene\b/i, "neoprene");
  add(/\b(abs|polipropilene|polypropylene|plastica|plastic)\b/i, "plastica");
  // l'imbottitura dice poco del materiale: solo se non c'è altro
  if (!found.length) add(/\b(eva|schiuma|foam|espanso)\b/i, "imbottitura in espanso");
  return found.slice(0, 3).join(" e ").replace(/ e (?=.* e )/, ", ");
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** da un'etichetta della scheda di un negozio («Diametro esterno», «Grains per inch») alla chiave */
export function keyOfLabel(label: string, category: string): string | null {
  const l = norm(label);
  if (/spine|deflessione|deflection/.test(l)) return "spine";
  if (/\bgpi\b|grains? per inch|grani per pollice|peso per pollice|peso\/pollice|gr\/in|weight per inch/.test(l)) return "gpi";
  if (/diametr|outer diam|\bo\.?d\.?\b|\bdiam/.test(l)) return "diameter";
  if (/brace|altezza (?:della )?corda/.test(l)) return "brace";
  if (/libbr|draw weight|potenza|\blbs?\b/.test(l)) return "draw";
  if (/allungo|draw length/.test(l)) return "drawLen";
  if (/\bfili\b|strands?/.test(l)) return "strands";
  if (/lunghezza|length/.test(l)) return category === "alette" ? "fletchLen" : "length";
  if (/peso|weight|grani|grains?/.test(l)) return category === "punte" ? "point" : category === "stabilizzatore" ? "weightG" : "weight";
  if (/materiale|material|composizione/.test(l)) return "material";
  if (/taglia|size|misura|numero|dimension|ingombro|formato/.test(l)) return "size";
  if (/forma|tipo|type|modello di punta/.test(l)) return category === "punte" ? "pointType" : category === "cocche" ? "nockType" : category === "alette" ? "fletchType" : "kind";
  return null;
}

/** il valore utile di una voce: il numero per i campi numerici, il testo ripulito per gli altri */
export function cleanValue(key: string, value: string, category: string): string {
  const v = value.replace(/\s+/g, " ").trim();
  const numeric = ["spine", "gpi", "diameter", "brace", "length", "fletchLen", "point", "weight", "weightG", "strands", "drawLen"];
  // lunghezza senza unità fissa (custodie, borse): si tiene l'unità del negozio
  if (key === "length" && !fieldsOf(category).find((f) => f.key === "length")?.unit) {
    const g = guessSpecs(v, category);
    if (g.length) return g.length;
    const m = /(\d{1,4}(?:[.,]\d{1,3})?)\s*(cm|mm|m\b|″|"|in\b)?/i.exec(v);
    return m ? `${num(m[1])}${m[2] ? ` ${m[2] === '"' || m[2] === "in" ? "″" : m[2]}` : ""}` : "";
  }
  if (key === "draw") return /(\d{2}(?:\s*-\s*\d{2})?)/.exec(v)?.[1]?.replace(/\s/g, "") ?? "";
  if (numeric.includes(key)) {
    const m = /(\d{1,4}(?:[.,]\d{1,3})?)/.exec(v);
    return m ? num(m[1]) : "";
  }
  if (key === "pointType" || key === "nockType" || key === "fletchType") {
    const g = guessSpecs(v, category);
    return g[key] ?? "";
  }
  return v.slice(0, 40);
}

/** marca, modello e nome senza parole ripetute («Skylon Radius» + «Aste Skylon Radius 600») */
export function searchWords(item: { name: string; brand?: string; model?: string }) {
  const seen = new Set<string>();
  return [item.brand, item.model, item.name]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .filter((w) => {
      const k = w.toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(" ");
}

/** ricerca in rete delle specifiche del pezzo */
export function searchUrl(item: { name: string; brand?: string; model?: string; category: string }) {
  const words = searchWords(item);
  const what = item.category === "aste" || item.category === "freccia" ? "spine gpi specifiche" : item.category === "corda" ? "fili materiale specifiche" : "specifiche";
  return `https://www.google.com/search?q=${encodeURIComponent(`${words} ${what}`.replace(/\s+/g, " ").trim())}`;
}

const n = (v: string | undefined) => {
  const x = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) && x > 0 ? x : 0;
};

/**
 * Peso stimato di una freccia in grani: asta (gpi × lunghezza) + punta + cocca + tre alette.
 * Serve quando il peso non è stato pesato.
 */
export function arrowGrains(s: Record<string, string>) {
  const L = n(s.length);
  const gpi = n(s.gpi);
  if (!L || !gpi) return 0;
  const point = n(s.point) || 100;
  const nock = n(s.nockWeight) || 9;
  const vanes = 3 * (n(s.fletchWeight) || 5);
  return Math.round(gpi * L + point + nock + vanes);
}

/** cosa passa su una serie di frecce montando questo pezzo */
export function mountPatch(category: string, specs: Record<string, string>): Record<string, string> {
  const pick = (...keys: string[]) => Object.fromEntries(keys.filter((k) => specs[k]).map((k) => [k, specs[k]]));
  if (category === "aste") return { ...pick("spine", "gpi", "diameter", "material"), ...(specs.length ? { length: specs.length } : {}) };
  if (category === "punte") return { ...pick("point"), ...(specs.pointType ? { pointType: specs.pointType } : {}) };
  if (category === "alette") return { ...pick("fletchType"), ...(specs.weight ? { fletchWeight: specs.weight } : {}), ...(specs.fletchLen ? { fletchLen: specs.fletchLen } : {}) };
  if (category === "cocche") return { ...(specs.weight ? { nockWeight: specs.weight } : {}), ...(specs.nockType ? { nockType: specs.nockType } : {}) };
  return {};
}

/** dopo il montaggio: se il peso non è stato pesato, lo stima dai pezzi */
export function withEstimatedWeight(arrow: Record<string, string>): Record<string, string> {
  if (arrow.weightG || arrow.arrowsG) return arrow;
  const gr = arrowGrains(arrow);
  return gr ? { ...arrow, weight: String(gr), weightG: String(Math.round((gr / GRAINS_PER_G) * 10) / 10), weightEstimated: "1" } : arrow;
}

const it = (x: number, d = 1) => (Number.isInteger(x) ? String(x) : x.toFixed(d)).replace(".", ",");

/** consigli sul pezzo, confrontato con l'arco principale e la serie di frecce principale */
export function partAdvice(category: string, specs: Record<string, string>, bow: BowLike | null, arrow: Record<string, string> | null): string[] {
  const out: string[] = [];
  if (category === "arco") return bowAdvice(specs);
  if (category === "freccia") return arrowAdvice(withEstimatedWeight(specs), bow);
  if (category === "aste") {
    // la freccia che verrebbe con queste aste e il resto della serie principale
    // la lunghezza delle aste è quella da tagliare: conta quella della serie, se c'è
    const patch = mountPatch("aste", specs);
    if (arrow?.length) delete patch.length;
    const test = withEstimatedWeight({ ...(arrow ?? {}), ...patch, weightG: "", arrowsG: "", weight: "" });
    if (!bow) out.push("Scegli l'arco principale: confronto lo spine di queste aste con il tuo libraggio.");
    else out.push(...arrowAdvice(test, bow));
    if (n(specs.gpi) && n(test.length)) out.push(`Asta da sola: ${it(n(specs.gpi) * n(test.length), 0)} grani a ${it(n(test.length))}″ (${it((n(specs.gpi) * n(test.length)) / GRAINS_PER_G)} g).`);
    return out;
  }
  if (category === "punte") {
    const p = n(specs.point);
    if (p && arrow) {
      const before = arrowGrains(arrow);
      const after = arrowGrains({ ...arrow, point: specs.point });
      if (before && after) out.push(`Con queste punte la freccia passa da ${it(before, 0)} a ${it(after, 0)} grani.`);
      const was = n(arrow.point);
      if (was && Math.abs(was - p) >= 20) out.push(`${p > was ? "Più pesanti" : "Più leggere"} di ${it(Math.abs(p - was), 0)} grani rispetto a quelle che usi: lo spine si comporta più ${p > was ? "morbido" : "rigido"}, ricontrolla il tuning.`);
    } else if (p) out.push("Monta le punte su una serie di frecce: calcolo il nuovo peso e cosa cambia.");
    if (p >= 140) out.push("Punte pesanti: FOC più alto, freccia più stabile al vento ma traiettoria più curva.");
    return out;
  }
  if (category === "corda") {
    const s = n(specs.strands);
    const lb = n(bow?.draw);
    if (s && lb) {
      const want = lb < 30 ? [12, 14] : lb < 40 ? [14, 16] : lb < 50 ? [16, 18] : [18, 20];
      if (s < want[0]) out.push(`${s} fili sono pochi per ${it(lb, 0)} lb: per materiali moderni (8125, BCY-X) di solito ${want[0]}-${want[1]}.`);
      else if (s > want[1]) out.push(`${s} fili sono tanti per ${it(lb, 0)} lb: corda più lenta, di solito ${want[0]}-${want[1]}.`);
      else out.push(`${s} fili vanno bene per ${it(lb, 0)} lb (di solito ${want[0]}-${want[1]} con 8125 o BCY-X).`);
    }
    if (/dacron/i.test(specs.material ?? "")) out.push("Il Dacron è per archi in legno o vecchi: sugli archi moderni si usano 8125 o BCY-X.");
    return out;
  }
  if (category === "alette" && arrow) {
    const w = n(specs.weight);
    if (w) out.push(`Tre alette pesano ${it(3 * w, 0)} grani in coda: più leggere alzano il FOC.`);
  }
  return out;
}
