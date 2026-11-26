/**
 * Composizione di una serie di frecce da quello che si è comprato: asta, penne (o alette), punta e cocca.
 * Dal nome di ogni acquisto (come lo scrive il negozio: «Gateway aletta naturale 4" scudo barrate»,
 * «Asta cedro 11/32 35-40 lb», «Punta field 125 gr») si ricavano materiale, spine, misura, forma,
 * disegno e colore; poi le misure della serie e una stima del peso pezzo per pezzo.
 * Tutto quello che si ricava resta modificabile nella scheda.
 */

export type PartKind = "aste" | "alette" | "punte" | "cocche";

/** un acquisto utilizzabile: dall'attrezzatura o dalla lista della spesa (già preso) */
export type Bought = { key: string; kind: PartKind; name: string; qty: number; source: "attrezzatura" | "acquisti"; specs?: Record<string, string> };

export type Part = {
  kind: PartKind;
  name: string;
  /** campi della scheda freccia che questo pezzo decide */
  specs: Record<string, string>;
  /** grani di un pezzo (per le penne: una penna) */
  grains: number | null;
  /** quante frecce bastano i pezzi comprati */
  arrowsFor: number | null;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[″“”]/g, '"').replace(/''/g, '"');
const num = (s: string) => Number(s.replace(",", "."));

/** colori come li scrivono i cataloghi (italiano e inglese), nell'ordine in cui vanno cercati */
export const FEATHER_COLORS: { id: string; label: string; hex: string; re: RegExp }[] = [
  { id: "giallo-fluo", label: "Giallo fluo", hex: "#e9f53a", re: /giallo\s*fluo|fluo(?:rescent)?\s*yellow|\bfy\b/ },
  { id: "verde-fluo", label: "Verde fluo", hex: "#6be33a", re: /verde\s*fluo|fluo(?:rescent)?\s*green|\bfg\b/ },
  { id: "lime", label: "Lime", hex: "#d8ec62", re: /lemon\s*lime|\blime\b/ },
  { id: "chartreuse", label: "Chartreuse", hex: "#9fd13c", re: /chartreuse/ },
  { id: "verde-scuro", label: "Verde scuro", hex: "#1f5a32", re: /verde\s*scuro|dark\s*green/ },
  { id: "blu-scuro", label: "Blu scuro", hex: "#1f3ea8", re: /blu\s*scuro|dark\s*blue|navy/ },
  { id: "denim", label: "Denim", hex: "#3b78c4", re: /denim/ },
  { id: "mandarino", label: "Mandarino", hex: "#f05a2a", re: /tangerine|mandarin/ },
  { id: "argento", label: "Argento", hex: "#8c9096", re: /argento|silver/ },
  { id: "grigio", label: "Grigio", hex: "#9a9ea4", re: /grigi|\bgr[ae]y\b/ },
  { id: "rosso", label: "Rosso", hex: "#c4232b", re: /ross[oai]|\bred\b|\brd\b/ },
  { id: "arancio", label: "Arancio", hex: "#ef6a1d", re: /aranc|orange|\bor\b/ },
  { id: "giallo", label: "Giallo", hex: "#f3cc1c", re: /giall|yellow|\byl\b/ },
  { id: "verde", label: "Verde", hex: "#2fa24a", re: /verd[ei]|green/ },
  { id: "blu", label: "Blu", hex: "#2366d1", re: /\bblu\b|\bblue\b|azzurr|\bbl\b/ },
  { id: "rosa", label: "Rosa", hex: "#ee4f9c", re: /\brosa\b|pink|fucsia/ },
  { id: "viola", label: "Viola", hex: "#6a2fa0", re: /viola|purple/ },
  { id: "marrone", label: "Marrone", hex: "#8a5a2e", re: /marron|brown|castan/ },
  { id: "nero", label: "Nero", hex: "#141518", re: /\bner[oaie]\b|black|\bbk\b/ },
  { id: "bianco", label: "Bianco", hex: "#f3f1ea", re: /bianc|white|\bwh\b/ },
  { id: "naturale", label: "Naturale", hex: "#b9b2a6", re: /natural[ei]?\s*grig|grey\s*bar/ },
];

function colorIn(t: string) {
  return FEATHER_COLORS.find((c) => c.re.test(t))?.hex ?? "";
}

/** quante unità ci sono in un acquisto: le confezioni contano i pezzi («conf. 50pz», «12 pz») */
function unitsOf(t: string, qty: number) {
  const m = /(?:conf\.?|confezione|pack|set|kit)?\s*(?:da\s*)?(\d{1,3})\s*(?:pz|pezzi|pcs|pc|units)\b/.exec(t) ?? /\b(?:conf\.?|confezione)\s*(?:da\s*)?(\d{1,3})\b/.exec(t) ?? /\bx\s*(\d{1,3})\b/.exec(t);
  const per = m ? Number(m[1]) : 1;
  return Math.max(1, qty) * Math.max(1, per);
}

function inches(t: string, min: number, max: number) {
  const re = /(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:"|pollici|inch|in\b)/g;
  for (const m of t.matchAll(re)) {
    const v = num(m[1]);
    if (v >= min && v <= max) return v;
  }
  return null;
}

function grainsIn(t: string) {
  const m = /(\d{2,3})\s*(?:gr\b|grani|grains?|grn)/.exec(t);
  return m ? Number(m[1]) : null;
}

/* ---------- aste ---------- */

function shaftMaterial(t: string) {
  if (/bamb/.test(t)) return "bambu";
  if (/cedro|cedar|pino|pine|frassino|\bash\b|legno|wood|douglas|abete|faggio|betulla|birch|spruce|port\s*orford|rose\s*city|sitka/.test(t)) return "legno";
  if (/carbo[-\s]*allum|a\/c\b|\bx10\b|\bace\b|carbon\s*\/\s*alum/.test(t)) return "carbo-alluminio";
  if (/allumin|alumin|\bxx75\b|\b(1[5-9]|2[0-3])1[0-9]\b|platinum\s*plus/.test(t)) return "alluminio";
  if (/carbon|victory|cross[-\s]?x|easton|gold\s*tip|skylon|black\s*eagle|avalon|fulmen|\bvap\b|3dhv|beman|carbon\s*express|spigarelli/.test(t)) return "carbonio";
  return "";
}

function shaftPart(b: Bought): Part {
  const t = norm(b.name);
  const material = b.specs?.material && SHAFT_IDS.has(b.specs.material) ? b.specs.material : shaftMaterial(t) || "legno";
  const specs: Record<string, string> = { material };
  // spine in libbre («35-40 lb», «40/45#») o numero di flessione («500», «spine 600»)
  // (prima si tolgono i diametri: «11/32» non è uno spine)
  const ts = t.replace(/\b(5\/16|11\/32|23\/64|21\/64|9\/32|3\/8)\b/g, " ");
  const lb = /(\d{2})\s*[-–/]\s*(\d{2})\s*(?:lb|lbs|#|libbre)?/.exec(ts);
  const flex = /(?:spine\s*)?\b(1[0-9]{3}|[2-9][0-9]{2})\b(?!\s*(?:gr|mm|"|pz))/.exec(ts);
  if (lb && Number(lb[1]) >= 15 && Number(lb[2]) <= 90 && Number(lb[2]) > Number(lb[1])) {
    specs.spine = `${lb[1]}-${lb[2]}`;
    specs.spineUnit = "lb";
  } else if (flex && material !== "legno" && material !== "bambu") {
    specs.spine = flex[1];
    specs.spineUnit = "defl";
  }
  const len = inches(t, 24, 34);
  if (len) specs.length = String(len);
  const diam = /\b(5\/16|11\/32|23\/64|21\/64|9\/32|3\/8)\b/.exec(t);
  if (diam) specs.shaftDiam = diam[1];
  const gpi = /(\d{1,2}(?:[.,]\d)?)\s*gpi/.exec(t);
  if (gpi) specs.gpi = String(num(gpi[1]));
  const color = colorIn(t);
  if (color && material !== "legno" && material !== "bambu") specs.shaft = color;
  return { kind: "aste", name: b.name, specs, grains: null, arrowsFor: unitsOf(t, b.qty) };
}

const SHAFT_IDS = new Set(["legno", "carbonio", "alluminio", "carbo-alluminio", "bambu"]);

/** grani per pollice dell'asta: dal nome se c'è, altrimenti un valore tipico per materiale e spine */
export function shaftGpi(specs: Record<string, string>) {
  if (specs.gpi) return num(specs.gpi);
  const m = specs.material || "legno";
  const spine = specs.spine || "";
  if (m === "legno" || m === "bambu") {
    const lb = Number(/^(\d{2})/.exec(spine)?.[1] ?? 40);
    const d = specs.shaftDiam === "5/16" ? -1.2 : specs.shaftDiam === "23/64" ? 0.8 : 0;
    // cedro 11/32: circa 9 gpi a 35 lb, 10 a 45, 11 a 55
    return Math.round((5.6 + lb * 0.1 + d) * 10) / 10;
  }
  if (m === "alluminio") return 9.2;
  const flex = Number(spine) || 600;
  const table: [number, number][] = [[250, 10.5], [300, 9.6], [350, 9], [400, 8.4], [500, 7.4], [600, 6.6], [700, 6], [800, 5.4], [900, 5], [1000, 4.7], [1200, 4.3]];
  let g = table[table.length - 1][1];
  for (const [s, v] of table) if (flex <= s) {
    g = v;
    break;
  }
  return m === "carbo-alluminio" ? g + 0.6 : g;
}

/* ---------- penne e alette ---------- */

function fletchPart(b: Bought): Part {
  const t = norm(b.name);
  const natural = /penn|naturale|natural|feather|gateway|trueflight|piuma|tacchino|turkey|oca\b|goose/.test(t) && !/vane|gomma|spin|blazer|plastifletch|fusion|quick\s*spin/.test(t);
  let fletchType = "alette";
  if (/spin\s*wing|spinwing|\bspin\b/.test(t)) fletchType = "spin";
  else if (/blazer/.test(t)) fletchType = "blazer";
  else if (/plastifletch/.test(t)) fletchType = "plastifletch";
  else if (/fusion/.test(t)) fletchType = "fusion";
  else if (/quick\s*spin/.test(t)) fletchType = "quickspin";
  else if (natural) fletchType = /scudo|shield/.test(t) ? "scudo" : /parabol/.test(t) ? "parabolica" : /full\s*length|lenght|da\s*tagliare|intera/.test(t) ? "penne" : /banana/.test(t) ? "banana" : "parabolica";
  const specs: Record<string, string> = { fletchType };
  const len = inches(t, 1.5, 6.5);
  if (len) specs.fletchLen = String(len);
  if (/barrat|barred|zebra/.test(t)) specs.fletchStyle = "striato";
  else if (/camo|\btre\b|mimetic/.test(t)) specs.fletchStyle = "camo";
  else specs.fletchStyle = "pieno";
  const color = colorIn(t);
  if (color) specs.fletch = color;
  else if (specs.fletchStyle === "camo") specs.fletch = "#3d8a5a";
  else if (natural && specs.fletchStyle === "striato") specs.fletch = "#ece8de";
  else if (natural) specs.fletch = "#ece8de";
  if (specs.fletchStyle === "striato") specs.fletch2 = /verde|green/.test(t) ? "#173d24" : "#1c1d20";
  if (specs.fletchStyle === "camo") specs.fletch2 = "#14251a";
  // grani di una penna: 0,74 gr per pollice di penna a parabola (3" = 2,2 gr), alette in plastica più pesanti
  const L = len ?? (natural ? 4 : fletchType === "spin" ? 1.75 : 2);
  const per = natural ? (fletchType === "penne" ? 1 : fletchType === "scudo" ? 0.82 : 0.74) * L : fletchType === "spin" ? 2.4 : fletchType === "plastifletch" ? 3.6 * L : fletchType === "blazer" ? 3 * L : 2.6 * L;
  return { kind: "alette", name: b.name, specs, grains: Math.round(per * 10) / 10, arrowsFor: Math.floor(unitsOf(t, b.qty) / 3) };
}

/* ---------- punte ---------- */

function pointPart(b: Bought, wooden: boolean): Part {
  const t = norm(b.name);
  let pointType = wooden ? "field" : "ogiva";
  if (/bullet|ogiva|ogival/.test(t)) pointType = "ogiva";
  else if (/field|campagna|target|da\s*bersaglio/.test(t)) pointType = "field";
  else if (/\b3d\b|longobard|nibb|tre\s*d/.test(t)) pointType = "3d";
  else if (/broadhead|caccia|lama|bodkin|hunting/.test(t)) pointType = "caccia";
  else if (/blunt|judo|gommin|rubber|gomma/.test(t)) pointType = "gommino";
  const grains = grainsIn(t);
  const specs: Record<string, string> = { pointType };
  if (grains) specs.point = String(grains);
  return { kind: "punte", name: b.name, specs, grains: grains ?? (wooden ? 125 : 100), arrowsFor: unitsOf(t, b.qty) };
}

/* ---------- cocche ---------- */

function nockPart(b: Bought): Part {
  const t = norm(b.name);
  const specs: Record<string, string> = {};
  const color = colorIn(t);
  if (color) specs.nock = color;
  if (/luminos|lighted|nockturnal|led/.test(t)) specs.nockKind = "luminosa";
  else if (/\bpin\b/.test(t)) specs.nockKind = "pin";
  else if (/11\/32|legno|wood|classic|conica|taper|speed/.test(t)) specs.nockKind = "conica";
  const g = /luminos|lighted|nockturnal|led/.test(t) ? 21 : /\bpin\b/.test(t) ? 7 : /11\/32|classic|conica|taper|speed/.test(t) ? 10 : 8;
  return { kind: "cocche", name: b.name, specs, grains: grainsIn(t) ?? g, arrowsFor: unitsOf(t, b.qty) };
}

export function partOf(b: Bought, wooden = false): Part {
  if (b.kind === "aste") return shaftPart(b);
  if (b.kind === "alette") return fletchPart(b);
  if (b.kind === "punte") return pointPart(b, wooden);
  return nockPart(b);
}

/** il pezzo più adatto da proporre per primo: quello comprato in quantità sufficiente, più recente */
export function pickDefault(list: Bought[]) {
  return list[0] ?? null;
}

export type Composition = {
  specs: Record<string, string>;
  /** quante frecce si possono montare con quello che c'è (il pezzo che finisce prima) */
  canMake: number | null;
  /** peso stimato, pezzo per pezzo, in grani */
  weight: { shaft: number | null; point: number | null; fletch: number | null; nock: number | null; insert: number; totalGr: number | null; totalG: number | null };
  name: string;
};

const GR_PER_G = 15.4324;

/**
 * Mette insieme i pezzi scelti: le scelte di ogni pezzo nei campi della scheda, quante frecce vengono e
 * il peso stimato (asta = gpi × lunghezza, punta, 3 penne, cocca e, nel carbonio, l'inserto).
 */
export function compose(parts: { aste?: Part | null; alette?: Part | null; punte?: Part | null; cocche?: Part | null }, base: Record<string, string> = {}): Composition {
  const specs: Record<string, string> = {};
  const shaft = parts.aste ?? null;
  for (const p of [parts.aste, parts.alette, parts.punte, parts.cocche]) if (p) Object.assign(specs, p.specs);
  // la penna guida dello stesso colore delle altre (come arrivano dal negozio): si cambia sotto
  if (parts.alette?.specs.fletch) specs.cock = parts.alette.specs.fletch;
  // la lunghezza finita scritta nella scheda vale più di quella dell'asta grezza (le aste si tagliano)
  if (base.length && specs.length) delete specs.length;
  const material = specs.material || base.material || "legno";
  const wooden = material === "legno" || material === "bambu";
  // le legature in filo sono delle frecce di legno con penne naturali: il resto lo decide la scheda
  const counts = [parts.aste?.arrowsFor, parts.alette?.arrowsFor, parts.punte?.arrowsFor, parts.cocche?.arrowsFor].filter((n): n is number => n != null && n > 0);
  const canMake = counts.length ? Math.min(...counts) : null;
  if (canMake) specs.qty = String(Math.min(200, canMake));
  const length = num(specs.length || base.length || "") || (wooden ? 30 : 29);
  const shaftGr = shaft ? Math.round(shaftGpi({ ...base, ...specs }) * length) : null;
  const pointGr = parts.punte ? (num(specs.point || "") || parts.punte.grains) : null;
  const fletchGr = parts.alette?.grains != null ? Math.round(parts.alette.grains * 3 * 10) / 10 : null;
  const nockGr = parts.cocche?.grains ?? null;
  const insert = !wooden && parts.punte && !/glue|incollare|one\s*piece/.test(norm(parts.punte.name)) ? 10 : 0;
  const known = [shaftGr, pointGr, fletchGr, nockGr].filter((v): v is number => v != null);
  const totalGr = shaftGr != null && known.length === 4 ? Math.round(shaftGr + (pointGr ?? 0) + (fletchGr ?? 0) + (nockGr ?? 0) + insert) : null;
  const MAT: Record<string, string> = { legno: "Legno", carbonio: "Carbonio", alluminio: "Alluminio", "carbo-alluminio": "Carbo-alluminio", bambu: "Bambù" };
  const SHAPE: Record<string, string> = { parabolica: "parabola", scudo: "scudo", penne: "penne intere", banana: "banana", spin: "spin wing", blazer: "blazer", plastifletch: "plastifletch", fusion: "fusion", quickspin: "quickspin", alette: "alette" };
  const sp = specs.spine ? (specs.spineUnit === "lb" ? `${specs.spine} lb` : specs.spine) : "";
  const fl = parts.alette ? [SHAPE[specs.fletchType] ?? "", specs.fletchLen ? `${specs.fletchLen.replace(".", ",")}"` : "", specs.fletchStyle === "striato" ? "barrate" : specs.fletchStyle === "camo" ? "camo" : ""].filter(Boolean).join(" ") : "";
  const name = [parts.aste ? [MAT[material], sp].filter(Boolean).join(" ") : "", fl].filter(Boolean).join(" · ");
  return {
    specs,
    canMake,
    weight: { shaft: shaftGr, point: pointGr, fletch: fletchGr, nock: nockGr, insert, totalGr, totalG: totalGr != null ? Math.round((totalGr / GR_PER_G) * 10) / 10 : null },
    name,
  };
}

/** gli acquisti utilizzabili per comporre: attrezzatura dei componenti e lista della spesa già presa */
export function boughtParts(
  gear: { id: number; mine: boolean; category: string; name: string; brand?: string; model?: string; specs?: Record<string, unknown> }[],
  shop: { id: number; category: string; name: string; qty: number; status: string }[],
) {
  const kinds = new Set<PartKind>(["aste", "alette", "punte", "cocche"]);
  const out: Bought[] = [];
  const seen = new Set<string>();
  for (const g of gear) {
    if (!g.mine || !kinds.has(g.category as PartKind)) continue;
    const name = [g.name, g.brand && !norm(g.name).includes(norm(g.brand)) ? g.brand : "", g.model && !norm(g.name).includes(norm(g.model)) ? g.model : ""].filter(Boolean).join(" ");
    const specs = Object.fromEntries(Object.entries(g.specs ?? {}).map(([k, v]) => [k, String(v ?? "")]));
    const qty = Number(specs.qty) || 1;
    seen.add(`${g.category}|${norm(g.name)}`);
    out.push({ key: `g${g.id}`, kind: g.category as PartKind, name, qty, source: "attrezzatura", specs });
  }
  for (const s of shop) {
    if (s.status !== "bought" || !kinds.has(s.category as PartKind)) continue;
    if (seen.has(`${s.category}|${norm(s.name)}`)) continue;
    seen.add(`${s.category}|${norm(s.name)}`);
    out.push({ key: `s${s.id}`, kind: s.category as PartKind, name: s.name, qty: s.qty || 1, source: "acquisti" });
  }
  return out;
}
