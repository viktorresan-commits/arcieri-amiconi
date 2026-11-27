/**
 * Scadenze di un arciere (tessera della compagnia, tessera FITAST e certificato medico) e gli avvisi in Bacheca
 * 15 giorni prima e a scadenza passata. Solo lato server.
 */
import type { Sql } from "@/lib/db";
import { asNum } from "./access";
import { myMembership } from "./compagnie.api";

const DAY = 86_400_000;
/** quanti giorni prima della scadenza arriva l'avviso in Bacheca */
export const NOTICE_DAYS = 15;

export function dayOf(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const m = String(value ?? "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "";
}

/** giorni che mancano alla data (negativi se è passata); null senza data */
export function daysTo(until: string) {
  if (!until) return null;
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.round((new Date(until).getTime() - today) / DAY);
}

const itDate = (d: string) => d.split("-").reverse().join("/");

export async function deadlinesOf(sql: Sql, userId: string) {
  const { companyId } = await myMembership(sql, userId);
  const dues = await sql<{ season: number; paid: boolean; card_until: unknown }>`
    select season, paid, card_until from company_dues where company_id = ${companyId} and user_id = ${userId} order by season desc limit 4`;
  const certs = await sql<{ valid_until: unknown; kind: string }>`
    select valid_until, kind from company_certs where company_id = ${companyId} and user_id = ${userId} limit 1`;
  // tessera: la stagione più recente con la data scritta o con la quota pagata (vale fino al 31 dicembre)
  const best = dues.find((d) => dayOf(d.card_until)) ?? dues.find((d) => d.paid);
  const written = best ? dayOf(best.card_until) : "";
  const cardUntil = best ? written || `${asNum(best.season)}-12-31` : "";
  const certUntil = certs[0] ? dayOf(certs[0].valid_until) : "";
  // tessera FITAST: tabella nuova, se non c'è ancora si va avanti senza
  const fitast = await sql<{ valid_until: unknown }>`
    select valid_until from company_fitast_cards where company_id = ${companyId} and user_id = ${userId} limit 1`.catch(() => []);
  const fitastUntil = fitast[0] ? dayOf(fitast[0].valid_until) : "";
  return {
    companyId,
    card: { until: cardUntil, days: daysTo(cardUntil), written: Boolean(written), season: best ? asNum(best.season) : null },
    fitast: { until: fitastUntil, days: daysTo(fitastUntil) },
    cert: { until: certUntil, days: daysTo(certUntil), kind: certs[0]?.kind === "non agonistico" ? "non agonistico" : "agonistico" },
  };
}

/**
 * Avvisi in Bacheca: uno quando mancano 15 giorni (o meno) e uno quando la data è passata.
 * Ogni avviso vale per quella data: con la data nuova, al prossimo giro ne arrivano di nuovi.
 */
export async function deadlineNotices(sql: Sql, userId: string) {
  const d = await deadlinesOf(sql, userId);
  const items: { key: string; title: string; body: string }[] = [];
  const g = (n: number) => `${n} ${n === 1 ? "giorno" : "giorni"}`;
  const add = (what: "cert" | "card" | "fitast", until: string, days: number | null) => {
    if (!until || days == null || days > NOTICE_DAYS) return;
    const cert = what === "cert";
    const name = cert ? "Il certificato medico" : what === "fitast" ? "La tessera FITAST" : "La tessera della compagnia";
    const gone = days < 0;
    items.push({
      key: `scad-${what}-${userId}-${until}-${gone ? "scaduta" : "presto"}`,
      title: gone ? `${name} è ${cert ? "scaduto" : "scaduta"}` : days === 0 ? `${name} scade oggi` : `${name} scade tra ${g(days)}`,
      body: cert
        ? `${gone ? "È scaduto" : "Scade"} il ${itDate(until)}. Senza certificato valido non si tira in campo: rinnovalo e scrivi la nuova data nel profilo.`
        : what === "fitast"
          ? `${gone ? "È scaduta" : "Scade"} il ${itDate(until)}. Senza tessera FITAST valida non si gareggia: rinnovala con la segreteria e scrivi la nuova data nel profilo.`
          : `${gone ? "È scaduta" : "Scade"} il ${itDate(until)}. Rinnova la tessera con la segreteria della compagnia; la nuova data compare nel profilo.`,
    });
  };
  add("cert", d.cert.until, d.cert.days);
  add("card", d.card.until, d.card.days);
  add("fitast", d.fitast.until, d.fitast.days);
  for (const it of items) {
    await sql`
      insert into notifications (user_id, title, body, href, dedupe)
      values (${userId}, ${it.title}, ${it.body}, ${"/profilo"}, ${it.key})
      on conflict (dedupe) do nothing`;
  }
}
