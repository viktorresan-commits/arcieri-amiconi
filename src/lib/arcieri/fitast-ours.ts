/**
 * I nostri arcieri dentro le classifiche di gara del portale FITAST: chi è (nome collegato al profilo, oppure
 * nome e cognome, oppure il solo nome dentro la sua compagnia quando è uno solo), in che categoria, a che posto,
 * con quanti punti e punti campionato. Più la tappa del campionato di ogni gara. Senza rete né database.
 */
import { cleanCategory, teamKey, titleName, type RankRow } from "./fitast-league";
import { nameKey } from "./fitast-rank";

export type GaraTable = { gara_id: string; gara_title: string; held_on: string | null; season: string; category: string; rows: RankRow[] };

export type Who = {
  userId: string;
  /** nome FITAST collegato al profilo ("" se non collegato) */
  fitastName: string;
  /** compagnia con cui il portale lo conosce, scelta al collegamento */
  fitastTeam: string;
  fullName: string;
  givenName: string;
  nickname: string;
  /** la sua compagnia nell'app (nome FITAST della compagnia, se c'è) */
  team: string;
};

export type PortalResult = {
  /** il nome come lo scrive il portale */
  name: string;
  team: string;
  /** categoria pulita, la più precisa (es. «Messeri · Tradizionale») */
  category: string;
  place: number | null;
  /** arcieri in quella categoria */
  size: number;
  score: number | null;
  camp: number | null;
  /** trovato con il nome collegato al profilo (non indovinato dal nome) */
  linked: boolean;
};

export type Person = { name: string; team: string; teamK: string; key: string; words: Set<string>; entries: { category: string; place: number | null; size: number; score: number | null; camp: number | null }[] };

/** tutte le persone di una gara (un arciere compare in più tabelle: categoria intera e per tipologia) */
export function peopleOf(tables: GaraTable[]): Person[] {
  const people = new Map<string, Person>();
  for (const t of tables) {
    const rows = Array.isArray(t.rows) ? t.rows : [];
    for (const r of rows) {
      const key = nameKey(r.name ?? "");
      if (!key) continue;
      const teamK = teamKey(r.team ?? "");
      const id = `${key}|${teamK}`;
      const p = people.get(id) ?? { name: r.name, team: r.team ?? "", teamK, key, words: new Set(key.split(" ")), entries: [] };
      if (!p.entries.some((e) => e.category === t.category)) p.entries.push({ category: t.category, place: r.place ?? null, size: rows.length, score: r.score ?? null, camp: r.camp ?? null });
      people.set(id, p);
    }
  }
  return [...people.values()];
}

/** chi è questo profilo tra le persone della classifica (o nessuno) */
export function matchPerson(all: Person[], who: Who): { p: Person; linked: boolean } | null {
  const team = teamKey(who.fitastTeam || who.team || "");
  const has = (p: Person, key: string) => key.split(" ").every((w) => p.words.has(w));
  const choose = (list: Person[], unique: boolean) => {
    if (!list.length) return undefined;
    const inTeam = team ? list.filter((p) => p.teamK === team) : [];
    if (inTeam.length === 1) return inTeam[0];
    if (unique) return list.length === 1 ? list[0] : undefined;
    return inTeam[0] ?? list[0];
  };
  const linked = nameKey(who.fitastName);
  if (linked) {
    const found = choose(all.filter((p) => p.key === linked), false);
    // collegato: si cerca solo quel nome (un omonimo non collegato non deve prenderne il posto)
    return found ? { p: found, linked: true } : null;
  }
  const full = nameKey(who.fullName);
  let me: Person | undefined;
  if (full.includes(" ")) me = choose(all.filter((p) => p.key === full), false) ?? choose(all.filter((p) => has(p, full)), true);
  if (!me && team) {
    for (const raw of [who.givenName, who.nickname]) {
      const k = nameKey(raw);
      if (!k) continue;
      const found = all.filter((p) => p.teamK === team && has(p, k));
      if (found.length === 1) {
        me = found[0];
        break;
      }
    }
  }
  return me ? { p: me, linked: false } : null;
}

const precision = (c: string) => cleanCategory(c).split("·").filter(Boolean).length;

/** il risultato di una persona: la categoria più precisa in cui compare */
export function resultOf(p: Person, linked: boolean): PortalResult {
  const e = [...p.entries].sort((a, b) => precision(b.category) - precision(a.category) || (a.size - b.size))[0];
  return { name: p.name, team: p.team, category: cleanCategory(e?.category ?? ""), place: e?.place ?? null, size: e?.size ?? 0, score: e?.score ?? null, camp: e?.camp ?? null, linked };
}

/** i nostri arcieri in una gara; ogni persona del portale va a un solo profilo (prima ai collegati) */
export function oursInGara(tables: GaraTable[], members: Who[]): Map<string, PortalResult> {
  const all = peopleOf(tables);
  const out = new Map<string, PortalResult>();
  const taken = new Set<Person>();
  const order = [...members].sort((a, b) => Number(Boolean(b.fitastName)) - Number(Boolean(a.fitastName)));
  for (const who of order) {
    const m = matchPerson(all.filter((p) => !taken.has(p)), who);
    if (!m) continue;
    taken.add(m.p);
    out.set(who.userId, resultOf(m.p, m.linked));
  }
  return out;
}

/** quanti arcieri ha la gara (persone diverse in tutte le categorie) */
export function archersIn(tables: GaraTable[]) {
  return peopleOf(tables).length;
}

/** «Gara di Campionato Invernale 3D» → «Campionato Invernale 3D» */
export function championshipName(title: string) {
  const t = titleName(title.replace(/\s+/g, " ").trim()).replace(/^gara\s+(di|del|della)\s+/i, "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

/** la tappa di ogni gara: posizione per data tra le gare dello stesso campionato (stagione e titolo) */
export function stepsOf(tables: GaraTable[]): Map<string, { n: number; champ: string }> {
  const gare = new Map<string, { id: string; day: string; season: string; champ: string }>();
  for (const t of tables) {
    if (!t.gara_id) continue;
    const g = gare.get(t.gara_id) ?? { id: t.gara_id, day: "", season: t.season, champ: "" };
    if (!g.day && t.held_on) g.day = String(t.held_on).slice(0, 10);
    if (!g.champ && t.gara_title) g.champ = championshipName(t.gara_title);
    gare.set(t.gara_id, g);
  }
  const groups = new Map<string, { id: string; day: string; champ: string }[]>();
  for (const g of gare.values()) {
    const k = `${g.season}|${g.champ.toLowerCase()}`;
    groups.set(k, [...(groups.get(k) ?? []), g]);
  }
  const out = new Map<string, { n: number; champ: string }>();
  for (const list of groups.values()) {
    const dated = list.filter((g) => g.day).sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
    dated.forEach((g, i) => out.set(g.id, { n: i + 1, champ: g.champ }));
    for (const g of list) if (!g.day) out.set(g.id, { n: 0, champ: g.champ });
  }
  return out;
}
