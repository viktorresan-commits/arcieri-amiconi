/**
 * Muoversi nel portale FITAST come un browser: richieste (pagine e comandi premuti), tendine-filtro
 * delle classifiche (Categoria, Tipologia) e le loro combinazioni da provare.
 */
import { pressFields, type FitastPage } from "./fitast-parse";
import { seasonSelect } from "./fitast-gare";

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** una richiesta al portale: una pagina, oppure un comando premuto (modulo rimandato) */
export type Req = { url: string; post?: { fields: Record<string, string>; charset: string }; referer?: string; label?: string; filtered?: boolean; thenClassifica?: boolean };

/** pulsante che applica i filtri di una classifica (Categoria, Tipologia… e poi CERCA) */
export const FILTER_BUTTON = /^(cerca|filtra|aggiorna|visualizza|mostra|applica|ok|vai)\b/i;
/** tendine di una classifica da provare tutte: categoria, tipologia, classe, divisione, arco */
export const FILTER_SELECT = /categ|tipolog|classe|divisi|arco|stile|sesso|special|tipo/i;
/** tendine da non girare dentro una classifica: la gara e la stagione sono già scelte */
export const FIXED_SELECT = /gara|campionat|stagion|anno|data|evento/i;


export type Combo = { req: Req; texts: string[] };
/** le tendine-filtro di una classifica (Categoria, Tipologia…), al massimo due */
export function filterSelects(page: FitastPage) {
  const season = seasonSelect(page);
  // Categoria e Tipologia sempre; le altre tendine solo se non sono gara, stagione o data
  return (page.form?.selects ?? [])
    .filter((x) => x !== season && x.options.length >= 2 && x.options.length <= 120 && (FILTER_SELECT.test(x.label) || !FIXED_SELECT.test(x.label)))
    .sort((a, b) => Number(FILTER_SELECT.test(b.label)) - Number(FILTER_SELECT.test(a.label)))
    .slice(0, 2);
}
/** le scelte attuali dei filtri della pagina (es. MESSERE · TRADIZIONALE) */
export const currentTexts = (page: FitastPage) => filterSelects(page).map((x) => (x.options.find((o) => o.selected) ?? x.options[0]).text.trim());


/**
 * Le classifiche del portale mostrano una categoria alla volta (Categoria MESSERE, Tipologia
 * TRADIZIONALE… e CERCA): ogni combinazione diventa un comando CERCA da premere.
 */
export function filterCombos(page: FitastPage, r: Req): Combo[] {
  const form = page.form;
  if (!form) return [];
  const ranked = filterSelects(page);
  if (!ranked.length) return [];
  const btn = form.buttons.find((b) => FILTER_BUTTON.test(b.label.trim()));
  // solo pagine che sono davvero classifiche con filtri: pulsante CERCA o tendine come Categoria
  if (!btn && !ranked.some((x) => FILTER_SELECT.test(x.label))) return [];
  const press = btn ? { code: btn.code, set: btn.set } : (ranked.find((x) => x.press)?.press ?? null);
  if (!press) return [];
  const base: Record<string, string> = Object.fromEntries(form.selects.map((x) => [x.name, (x.options.find((o) => o.selected) ?? x.options[0]).value]));
  let combos: { choose: Record<string, string>; texts: string[] }[] = [{ choose: {}, texts: [] }];
  for (const x of ranked) {
    const next: typeof combos = [];
    for (const c of combos) for (const o of x.options) if (o.value !== "" || o.text.trim()) next.push({ choose: { ...c.choose, [x.name]: o.value }, texts: [...c.texts, o.text.trim()] });
    combos = next;
  }
  const now = currentTexts(page).map(norm).join("|");
  return combos
    .filter((c) => c.texts.map(norm).join("|") !== now)
    .slice(0, 200)
    .flatMap((c) => {
      const q = pressReq(page, press, { ...base, ...c.choose }, `${r.label ? `${r.label} · ` : ""}${c.texts.join(" · ")}`);
      return q ? [{ req: { ...q, filtered: true }, texts: c.texts }] : [];
    });
}

/**
 * In che ordine provare i filtri: quelli dove il nome è già comparso in questa ricerca e poi i vicini
 * (stessa categoria o stessa tipologia) e basta; altrimenti tutti, prima quelli già visti in passato
 * e quelli che somigliano alla categoria dell'arciere nel calendario.
 */
export function orderCombos(all: Combo[], confirmed: string[][], hints: string[][], preferred: string[]) {
  const key = (t: string[]) => t.map(norm).join("|");
  const pref = preferred.map(norm).filter(Boolean);
  const pscore = (c: Combo) => c.texts.reduce((n, t) => n + (pref.some((p) => norm(t).includes(p) || p.includes(norm(t))) ? 1 : 0), 0);
  const isIn = (c: Combo, list: string[][]) => list.some((k) => key(k) === key(c.texts));
  const near = (c: Combo, list: string[][]) => list.some((k) => c.texts.some((t) => k.map(norm).includes(norm(t))));
  if (confirmed.length) {
    return [...all.filter((c) => isIn(c, confirmed)), ...all.filter((c) => !isIn(c, confirmed) && near(c, confirmed)).sort((a, b) => pscore(b) - pscore(a)).slice(0, 10)];
  }
  return [...all].sort((a, b) => Number(isIn(b, hints)) - Number(isIn(a, hints)) || Number(near(b, hints)) - Number(near(a, hints)) || pscore(b) - pscore(a));
}


/** il comando premuto come richiesta: campi del modulo, scelte nelle tendine e alias WEBDEV */
export function pressReq(page: FitastPage, b: { code: string; set: Record<string, string> }, choose: Record<string, string>, label: string): Req | null {
  if (!page.form) return null;
  return { url: page.form.action || page.url, post: { fields: pressFields(page.form, b.code, b.set, choose), charset: page.charset }, referer: page.url, label };
}

