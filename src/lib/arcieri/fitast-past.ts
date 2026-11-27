/**
 * L'archivio FITAST dal 2019 (tabella fitast_history, riempita da «Scansiona tutto dal 2019») per gli arcieri
 * dell'app: di ogni classifica si leggono solo le righe con i loro nomi, più quante righe aveva per intero.
 * Il risultato resta qualche minuto in memoria e si rilegge appena l'archivio cambia. Solo lato server.
 */
import type { Sql } from "@/lib/db";
import { teamKey, type RankRow } from "./fitast-league";
import { nameKey } from "./fitast-rank";
import type { GaraTable, PortalResult, Who } from "./fitast-ours";

export type PastKind = "gara-arcieri" | "generale-arcieri";
export type PastTable = GaraTable & { season_name: string; total: number };

type NameOf = { fitastName?: string; fullName: string; givenName?: string; nickname?: string };

/**
 * Le parole che tengono le righe dei nostri: per ogni arciere la parola più lunga del nome collegato,
 * di nome e cognome, del nome e del soprannome. Chiunque si possa riconoscere contiene almeno una di queste.
 */
export function nameWords(people: NameOf[]): string[] {
  const words = new Set<string>();
  const longest = (s: string) => nameKey(s).split(" ").filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? "";
  for (const p of people) {
    for (const raw of [p.fitastName ?? "", p.fullName, p.givenName ?? "", p.nickname ?? ""]) {
      const w = longest(raw);
      if (w.length >= 2) words.add(w);
    }
  }
  return [...words].sort();
}

/** @deprecated nome di prima: le parole come chiave */
export const namePattern = (people: NameOf[]) => nameWords(people).join("|");

const TTL = 3 * 60_000;
const cache = new Map<string, { at: number; tables: PastTable[] }>();
/** oltre questo tempo l'archivio non blocca la pagina: si mostra senza e si riprova alla prossima */
const LIMIT_MS = 6000;

/** le classifiche dell'archivio di un tipo, con le sole righe dei nomi cercati (lette con l'indice delle parole) */
export async function pastTables(sql: Sql, kind: PastKind, pattern: string): Promise<PastTable[]> {
  const words = pattern ? pattern.split("|").filter(Boolean) : [];
  if (!words.length) return [];
  const key = `${kind}|${pattern}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.tables;
  const query = sql<PastTable>`
    select h.gara_id, h.gara_title, h.held_on::text as held_on, h.season, h.season_name, h.category,
      max(r.total)::int as total, jsonb_agg(r.row order by r.pos) as rows
    from fitast_history_rows r
    join fitast_history h on h.id = r.history_id
    where r.kind = ${kind} and r.words && ${words}::text[]
    group by h.id`
    .then((rows) => rows.map((r) => ({ ...r, total: Number(r.total) || 0, rows: (Array.isArray(r.rows) ? r.rows : []) as RankRow[] })))
    .catch(() => null);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), LIMIT_MS));
  const tables = await Promise.race([query, timeout]);
  if (!tables) return hit?.tables ?? [];
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), tables });
  return tables;
}

/**
 * Negli anni passati il solo nome non basta: un omonimo di un'altra compagnia non è il nostro arciere.
 * Vale il nome collegato al profilo; senza collegamento serve anche la stessa compagnia.
 */
export function trustedPast(r: PortalResult, who: Who) {
  if (r.linked) return true;
  const team = teamKey(who.fitastTeam || who.team || "");
  return Boolean(team) && teamKey(r.team) === team;
}
