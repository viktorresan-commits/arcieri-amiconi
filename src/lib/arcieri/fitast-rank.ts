/**
 * Il posto vero di un arciere nel campionato FITAST, dalla classifica generale arcieri salvata dal portale:
 * in categoria (come la pubblica il portale), assoluto (tutti gli arcieri del campionato per punti),
 * nella sua divisione (Madonne, Messeri, Pueri, Juniores) e nella sua compagnia.
 * Solo lato server: riceve la connessione al database.
 */
import type { Sql } from "@/lib/db";
import { cleanCategory, teamKey } from "./fitast-league";

type GenRow = { place: number | null; name: string; team?: string; score: number | null; camp: number | null };
export type GenTable = { season_name: string; category: string; rows: GenRow[] };

export type FitastRank = {
  season: string;
  /** il nome come lo scrive il portale */
  name: string;
  team: string;
  points: number | null;
  /** categoria del portale, pulita (es. «Madonna · Tradizionale») */
  category: string;
  place: number | null;
  size: number;
  overall: number | null;
  overallSize: number;
  division: string;
  divisionPlace: number | null;
  divisionSize: number;
  teamPlace: number | null;
  teamSize: number;
};

/** chiave di un nome di persona: senza accenti, parole in ordine alfabetico (Rossi Mario = Mario Rossi) */
export const nameKey = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .sort()
    .join(" ");

/** la classifica generale arcieri del campionato più recente, tutte le categorie */
export async function loadGenerale(sql: Sql): Promise<GenTable[]> {
  return sql<GenTable>`
    select season_name, category, rows from fitast_standings
    where kind = 'generale-arcieri' and season = (select season from fitast_standings where kind = 'generale-arcieri' order by updated_at desc limit 1)`.catch(() => []);
}

type Person = { name: string; team: string; teamK: string; words: Set<string>; points: number | null; entries: { category: string; place: number | null; size: number }[] };

/**
 * Trova l'arciere nella generale e calcola i suoi posti. Cerca, in ordine: il nome FITAST collegato al profilo,
 * nome e cognome del profilo (anche se il portale aggiunge «Istruttore», «Capogruppo»…), e infine il solo nome
 * dentro la sua compagnia, quando è uno solo.
 */
export function fitastRankOf(gen: GenTable[], who: { fitastName?: string; fullName: string; givenName?: string; nickname?: string; team?: string }): FitastRank | null {
  if (!gen.length) return null;
  const people = new Map<string, Person>();
  for (const g of gen) {
    const rows = Array.isArray(g.rows) ? g.rows : [];
    for (const r of rows) {
      const nk = nameKey(r.name ?? "");
      if (!nk) continue;
      const tk = teamKey(r.team ?? "");
      const id = `${nk}|${tk}`;
      const p = people.get(id) ?? { name: r.name, team: r.team ?? "", teamK: tk, words: new Set(nk.split(" ")), points: null, entries: [] };
      const pts = r.camp ?? r.score;
      if (pts != null && (p.points == null || pts > p.points)) p.points = pts;
      if (!p.entries.some((e) => e.category === g.category)) p.entries.push({ category: g.category, place: r.place ?? null, size: rows.length });
      people.set(id, p);
    }
  }
  const all = [...people.values()];
  const team = teamKey(who.team ?? "");
  const has = (p: Person, key: string) => key.split(" ").every((w) => p.words.has(w));
  const choose = (list: Person[], unique: boolean) => {
    if (!list.length) return undefined;
    const inTeam = team ? list.filter((p) => p.teamK === team) : [];
    if (inTeam.length === 1) return inTeam[0];
    if (unique) return list.length === 1 ? list[0] : undefined;
    return inTeam[0] ?? list[0];
  };
  let me: Person | undefined;
  const linked = nameKey(who.fitastName ?? "");
  if (linked) me = choose(all.filter((p) => nameKey(p.name) === linked), false);
  const full = nameKey(who.fullName);
  if (!me && full.includes(" ")) me = choose(all.filter((p) => nameKey(p.name) === full), false) ?? choose(all.filter((p) => has(p, full)), true);
  if (!me && team) {
    for (const raw of [who.givenName ?? "", who.nickname ?? "", who.fullName]) {
      const k = nameKey(raw);
      if (!k) continue;
      const found = all.filter((p) => p.teamK === team && has(p, k));
      if (found.length === 1) {
        me = found[0];
        break;
      }
    }
  }
  if (!me) return null;
  const mine = me;
  // la categoria da mostrare: quella più precisa (con la tipologia d'arco), non «Tutte»
  const score = (c: string) => cleanCategory(c).split("·").filter(Boolean).length;
  const entry = [...mine.entries].sort((a, b) => score(b.category) - score(a.category))[0];
  const category = cleanCategory(entry?.category ?? "");
  const pts = mine.points;
  const above = (list: Person[]) => (pts == null ? null : 1 + list.filter((p) => (p.points ?? -1) > pts).length);
  const division = category.split("·")[0]?.trim() ?? "";
  const divKey = division.toLowerCase();
  const inDivision = divKey ? all.filter((p) => p.entries.some((e) => cleanCategory(e.category).split("·")[0]?.trim().toLowerCase() === divKey)) : [];
  const mates = all.filter((p) => p.teamK && p.teamK === mine.teamK);
  return {
    season: gen[0]?.season_name ?? "",
    name: mine.name,
    team: mine.team,
    points: pts,
    category,
    place: entry?.place ?? null,
    size: entry?.size ?? 0,
    overall: above(all),
    overallSize: all.length,
    division,
    divisionPlace: inDivision.length ? above(inDivision) : null,
    divisionSize: inDivision.length,
    teamPlace: mates.length ? above(mates) : null,
    teamSize: mates.length,
  };
}
