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

const ACCENTED = "ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑàáâãäåèéêëìíîïòóôõöùúûüçñ";
const PLAIN = ACCENTED.normalize("NFD").replace(/[̀-ͯ]/g, "");

type NameOf = { fitastName?: string; fullName: string; givenName?: string; nickname?: string };

/**
 * L'espressione che tiene le righe dei nostri: per ogni arciere la parola più lunga del nome collegato,
 * di nome e cognome, del nome e del soprannome. Chiunque si possa riconoscere contiene almeno una di queste.
 */
export function namePattern(people: NameOf[]): string {
  const words = new Set<string>();
  const longest = (s: string) => nameKey(s).split(" ").filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? "";
  for (const p of people) {
    for (const raw of [p.fitastName ?? "", p.fullName, p.givenName ?? "", p.nickname ?? ""]) {
      const w = longest(raw);
      if (w.length >= 2) words.add(w);
    }
  }
  return words.size ? `\\m(${[...words].sort().join("|")})\\M` : "";
}

const TTL = 30 * 60_000;
const cache = new Map<string, { at: number; stamp: string; tables: PastTable[] }>();

/** le classifiche dell'archivio di un tipo, con le sole righe che corrispondono ai nomi */
export async function pastTables(sql: Sql, kind: PastKind, pattern: string): Promise<PastTable[]> {
  if (!pattern) return [];
  const stampRows = await sql<{ stamp: string }>`
    select coalesce(max(updated_at)::text, '') || '|' || count(*)::text as stamp from fitast_history where kind = ${kind}`.catch(() => [] as { stamp: string }[]);
  const stamp = stampRows[0]?.stamp ?? "";
  if (!stamp || stamp.endsWith("|0")) return [];
  const key = `${kind}|${pattern}`;
  const hit = cache.get(key);
  if (hit && hit.stamp === stamp && Date.now() - hit.at < TTL) return hit.tables;
  const rows = await sql<PastTable>`
    select h.gara_id, h.gara_title, h.held_on::text as held_on, h.season, h.season_name, h.category,
      jsonb_array_length(h.rows)::int as total, jsonb_agg(x.v order by x.n) as rows
    from fitast_history h
    cross join lateral jsonb_array_elements(h.rows) with ordinality as x(v, n)
    where h.kind = ${kind} and translate(coalesce(x.v->>'name', ''), ${ACCENTED}, ${PLAIN}) ~* ${pattern}
    group by h.id`.catch(() => [] as PastTable[]);
  const tables = rows.map((r) => ({ ...r, total: Number(r.total) || 0, rows: (Array.isArray(r.rows) ? r.rows : []) as RankRow[] }));
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), stamp, tables });
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
