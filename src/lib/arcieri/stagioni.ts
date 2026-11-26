/**
 * Le stagioni di campionato con un nome solo, che vengano dal calendario dell'app o dal portale FITAST:
 * «Campionato invernale 2024/2025» (ottobre-aprile) e «Campionato estivo 2025». Senza rete né database.
 */
import { seasonRange } from "./fitast-gare";

export type SeasonTag = { label: string; from: string };

/** la stagione di campionato di un giorno: invernale da ottobre ad aprile, estiva da maggio a settembre */
export function champSeasonOf(day: string) {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  if (m >= 10) return { from: `${y}-10-01`, to: `${y + 1}-04-30`, name: `Campionato invernale ${y}/${y + 1}` };
  if (m <= 4) return { from: `${y - 1}-10-01`, to: `${y}-04-30`, name: `Campionato invernale ${y - 1}/${y}` };
  return { from: `${y}-05-01`, to: `${y}-09-30`, name: `Campionato estivo ${y}` };
}

/**
 * Il nome della stagione di una gara: quello del portale, scritto come nell'app, e se manca quello del giorno.
 * Le stagioni del portale che non sono né invernali né estive tengono il loro nome.
 */
export function seasonTag(seasonName: string, day: string): SeasonTag {
  const name = seasonName.replace(/\s+/g, " ").trim();
  const range = name ? seasonRange(name) : null;
  if (range) {
    const y1 = range.from.slice(0, 4);
    const y2 = range.to.slice(0, 4);
    if (/^\d{4}-10-01$/.test(range.from) && /-04-30$/.test(range.to)) return { label: `Campionato invernale ${y1}/${y2}`, from: `${y1}-10-01` };
    if (/-03-01$/.test(range.from) && /-10-31$/.test(range.to)) return { label: `Campionato estivo ${y1}`, from: `${y1}-05-01` };
    return { label: name, from: range.from };
  }
  if (day) {
    const s = champSeasonOf(day);
    return { label: s.name, from: s.from };
  }
  return { label: name || "Stagione senza data", from: "" };
}
