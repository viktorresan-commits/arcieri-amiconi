/**
 * Scansione dello storico FITAST dal 2019: per ogni stagione finita la classifica generale delle compagnie e
 * degli arcieri (tutte le categorie) e, per ogni gara, la classifica intera degli arcieri per categoria e
 * quella delle compagnie. Si legge dal portale come l'aggiornamento del campionato (dall'app di chi preme, le
 * pagine passano dal server dell'app) e si salva per tutte le compagnie.
 *
 * Va avanti finché non ha finito (anche un'ora): si può fermare e riprende da dove era. Una classifica letta
 * a metà (fermata, pagina persa) si salva lo stesso ma resta da rileggere; una stagione è finita solo quando
 * tutte le sue gare sono state lette per intero.
 */
import { FITAST_HOME, fitastRead } from "./fitast.api";
import type { FitastPage } from "./fitast-parse";
import { classificaUrl, cleanTitle, findGare, garaDateOf, garaIdOf, garaTitleOf, seasonRange, seasonSelect } from "./fitast-gare";
import { currentTexts, filterCombos, pressReq, type Req } from "./fitast-nav";
import { rankingRows, SQUADRE_PAGES, type RankRow } from "./fitast-league";
import { ALL_DONE, fitastHistoryIndex, markHistorySeason, saveFitastHistory } from "./fitast-history.api";
import type { SyncProgress } from "./fitast-sync";

type Kind = "generale-squadre" | "generale-arcieri" | "gara-arcieri" | "gara-squadre";
type Item = { kind: Kind; season: string; seasonName: string; garaId: string; garaTitle: string; day: string; category: string; rows: RankRow[]; complete: boolean };
type Gara = { id: string; title: string; day: string };

/** avanzamento della scansione: stagioni e gare, per la barra */
export type HistoryProgress = SyncProgress & { pct: number; seasons: number; seasonsDone: number; gare: number; startedAt: number };

/** limite di sicurezza: una scansione intera ne legge qualche migliaio */
const SAFETY_PAGES = 15000;
/** pagine perse di fila prima di fermarsi (portale giù o connessione assente) */
const MAX_FAILS = 8;
/** categorie al massimo per classifica (Categoria × Tipologia) */
const MAX_COMBOS = 48;
/** righe al massimo per ogni salvataggio: le richieste restano piccole */
const ROWS_PER_SAVE = 2500;

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const short = (t: string) => t.split(" - ").pop()?.trim() ?? t;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function syncHistory(opts: { onProgress: (p: HistoryProgress) => void; stop: () => boolean; fromYear?: number }) {
  const fromYear = opts.fromYear ?? 2019;
  const startedAt = Date.now();
  let cookie = "";
  let pages = 0;
  let saved = 0;
  let fails = 0;
  let broken = false;
  let saveFailed = false;
  let step = "Apro il portale";
  let seasonsTotal = 0;
  let seasonsDone = 0;
  let gareRead = 0;
  /** dentro la stagione: quante gare e a che punto */
  let inSeason = { at: 0, of: 0 };
  const pct = () => (seasonsTotal ? Math.min(0.999, (seasonsDone + (inSeason.of ? inSeason.at / inSeason.of : 0)) / seasonsTotal) : 0);
  const report = (extra: Partial<HistoryProgress> = {}) => opts.onProgress({ step, pages, saved, pct: pct(), seasons: seasonsTotal, seasonsDone, gare: gareRead, startedAt, ...extra });
  const halted = () => opts.stop() || broken || pages >= SAFETY_PAGES;

  /** una pagina del portale; se non arriva si riprova una volta, e dopo troppe perse di fila ci si ferma */
  const read = async (r: Req | null): Promise<FitastPage | null> => {
    if (!r || halted()) return null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (halted()) return null;
      pages++;
      report();
      try {
        const p = await fitastRead({ data: { url: r.url, post: r.post, referer: r.referer, cookie } });
        if (p.cookie) cookie = p.cookie;
        fails = 0;
        return p;
      } catch {
        fails++;
        if (fails >= MAX_FAILS) {
          broken = true;
          return null;
        }
        await wait(1500 * (attempt + 1));
      }
    }
    return null;
  };

  /** salva a pezzi; se il server non risponde la stagione resta da rifare */
  const save = async (items: Item[]) => {
    let batch: Item[] = [];
    let rows = 0;
    const send = async () => {
      if (!batch.length) return;
      const out = batch;
      batch = [];
      rows = 0;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await saveFitastHistory({ data: { items: out } });
          saved += r.saved;
          return;
        } catch {
          await wait(2000);
        }
      }
      saveFailed = true;
    };
    for (const it of items) {
      if (batch.length && (rows + it.rows.length > ROWS_PER_SAVE || batch.length >= 60)) await send();
      batch.push(it);
      rows += it.rows.length;
    }
    await send();
    report();
  };

  /**
   * Una classifica con tutte le sue categorie (Categoria × Tipologia): la pagina aperta e poi ogni combinazione.
   * Torna true se l'ha letta per intero.
   */
  const board = async (p0: FitastPage | null, r0: Req | null, kind: Kind, season: string, seasonName: string, gara: Gara = { id: "", title: "", day: "" }) => {
    if (!p0 || !r0) return false;
    const list: Item[] = [];
    let complete = true;
    const add = (p: FitastPage, texts: string[]) => {
      const rows = rankingRows(p, kind.endsWith("squadre") ? "squadre" : "arcieri", 800);
      if (rows.length) list.push({ kind, season, seasonName, garaId: gara.id, garaTitle: gara.title, day: gara.day, category: texts.join(" · "), rows, complete: true });
    };
    add(p0, currentTexts(p0));
    const combos = filterCombos(p0, r0);
    if (combos.length > MAX_COMBOS) complete = false;
    for (const c of combos.slice(0, MAX_COMBOS)) {
      if (halted()) {
        complete = false;
        break;
      }
      const p = await read(c.req);
      if (!p) {
        complete = false;
        continue;
      }
      add(p, c.texts);
    }
    if (!complete) for (const it of list) it.complete = false;
    if (list.length) await save(list);
    return complete;
  };

  const home = await read({ url: FITAST_HOME });
  if (!home) {
    report({ done: true, error: "Il portale FITAST non risponde. Riprova più tardi: la scansione riparte da dove era." });
    return;
  }
  const ss = seasonSelect(home);
  if (!ss) {
    report({ done: true, error: "Sul portale non trovo l'elenco delle stagioni." });
    return;
  }
  const today = isoDay(new Date());
  // solo le stagioni finite, dalla più recente
  const seasons = ss.options
    .map((o) => ({ o, range: seasonRange(o.text) ?? seasonRange(o.value) }))
    .filter((x): x is { o: (typeof ss.options)[number]; range: { from: string; to: string } } => Boolean(x.range) && (x.range?.from ?? "") >= `${fromYear}-01-01` && (x.range?.to ?? "9999") < today)
    .sort((a, b) => b.range.from.localeCompare(a.range.from));
  if (!seasons.length) {
    report({ done: true, error: `Sul portale non trovo stagioni finite dal ${fromYear}.` });
    return;
  }
  let index: Awaited<ReturnType<typeof fitastHistoryIndex>> = { items: [], seasonsDone: [] };
  try {
    index = await fitastHistoryIndex();
  } catch {
    /* senza indice si legge tutto */
  }
  const doneSeasons = new Set(index.seasonsDone);
  const have = new Set(index.items.map((i) => `${i.kind}|${i.season}|${i.garaId}`));
  const seasonKey = (o: { value: string; text: string }) => (o.value || o.text).replace(/[^\w-]/g, "").slice(0, 20);
  seasonsTotal = seasons.length;
  seasonsDone = seasons.filter(({ o }) => doneSeasons.has(seasonKey(o))).length;
  report();

  let sqName = "";
  try {
    sqName = localStorage.getItem("aa-fitast-squadre") ?? "";
  } catch {
    sqName = "";
  }
  for (const { o, range } of seasons) {
    const season = seasonKey(o);
    if (!season || doneSeasons.has(season)) continue;
    if (halted()) break;
    const seasonName = short(o.text);
    const choose: Record<string, string> = { [ss.name]: o.value };
    inSeason = { at: 0, of: 0 };
    step = `${seasonName} · apro la stagione`;
    const base = ss.press ? await read(pressReq(home, ss.press, choose, o.text)) : null;
    if (!base) continue;
    let complete = true;
    const btns = base.form?.buttons ?? [];
    // classifiche generali della stagione: compagnie e arcieri, tutte le categorie
    const genSq = btns.find((b) => /general/i.test(b.label) && /squadr|compagn|societ/i.test(b.label));
    const genAr = btns.find((b) => /general/i.test(b.label) && /arcier/i.test(b.label));
    if (genSq && !have.has(`generale-squadre|${season}|`)) {
      step = `${seasonName} · classifica generale compagnie`;
      const r0 = pressReq(base, genSq, choose, step);
      if (!(await board(await read(r0), r0, "generale-squadre", season, seasonName))) complete = false;
    }
    if (genAr && !have.has(`generale-arcieri|${season}|`)) {
      step = `${seasonName} · classifica generale arcieri`;
      const r0 = pressReq(base, genAr, choose, step);
      if (!(await board(await read(r0), r0, "generale-arcieri", season, seasonName))) complete = false;
    }
    // le gare della stagione: tutti gli arcieri per categoria e la classifica delle compagnie
    const gare = findGare(base)
      .filter((g) => g.date && g.date >= range.from && g.date <= range.to)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    inSeason = { at: 0, of: gare.length };
    for (const g of gare) {
      if (halted()) {
        complete = false;
        break;
      }
      inSeason.at++;
      const ids = [g.id, g.key ?? ""].filter((x, i, a) => /^\d{3,6}$/.test(x) && a.indexOf(x) === i);
      const known = ids.find((id) => have.has(`gara-arcieri|${season}|${id}`));
      if (known && have.has(`gara-squadre|${season}|${known}`)) continue;
      let hit: { id: string; p0: FitastPage; r0: Req; gara: Gara } | null = null;
      const day = g.date?.split("-").reverse().join("/") ?? "";
      for (const id of ids.slice(0, 3)) {
        step = `${seasonName} · ${g.title || "Gara"} · ${day}`;
        const r0: Req = { url: classificaUrl(id, FITAST_HOME), referer: FITAST_HOME, label: step };
        const p0 = await read(r0);
        if (!p0 || garaIdOf(p0) !== id) continue;
        hit = { id, p0, r0, gara: { id, title: cleanTitle(garaTitleOf(p0) || g.title) || g.title, day: garaDateOf(p0) ?? g.date ?? "" } };
        break;
      }
      if (!hit) {
        // pagina persa: da rifare; gara senza classifica sul portale: si va avanti
        if (halted() || fails > 0) complete = false;
        continue;
      }
      gareRead++;
      if (!have.has(`gara-arcieri|${season}|${hit.id}`)) {
        step = `${seasonName} · ${hit.gara.title || "Gara"} · ${day} · arcieri`;
        if (!(await board(hit.p0, hit.r0, "gara-arcieri", season, seasonName, hit.gara))) complete = false;
      }
      if (!have.has(`gara-squadre|${season}|${hit.id}`) && !halted()) {
        step = `${seasonName} · ${hit.gara.title || "Gara"} · ${day} · compagnie`;
        for (const name of [...new Set([sqName, ...SQUADRE_PAGES].filter(Boolean))].slice(0, 4)) {
          if (halted()) break;
          const r1: Req = { url: new URL(`${name}?P1=${hit.id}`, FITAST_HOME).toString(), referer: hit.p0.url, label: step };
          const p1 = await read(r1);
          if (!p1 || (garaIdOf(p1) && garaIdOf(p1) !== hit.id)) continue;
          if (!rankingRows(p1, "squadre", 1).length) continue;
          sqName = name;
          if (!(await board(p1, r1, "gara-squadre", season, seasonName, hit.gara))) complete = false;
          break;
        }
      }
      report();
    }
    if (complete && !halted() && !saveFailed) {
      try {
        await markHistorySeason({ data: { season } });
        seasonsDone++;
        inSeason = { at: 0, of: 0 };
      } catch {
        /* si rifà al prossimo giro */
      }
    }
    report();
  }
  const left = seasonsTotal - seasonsDone;
  if (!left) {
    try {
      await markHistorySeason({ data: { season: ALL_DONE } });
    } catch {
      /* resta il pulsante per riprendere: non legge niente di nuovo */
    }
  }
  step = "Fatto";
  inSeason = { at: 0, of: 0 };
  const why = broken
    ? "Il portale ha smesso di rispondere."
    : saveFailed
      ? "Alcune classifiche non si sono salvate."
      : opts.stop()
        ? "Scansione fermata."
        : pages >= SAFETY_PAGES
          ? "Raggiunto il limite di pagine di un giro."
          : "";
  report({
    done: true,
    pct: left ? pct() : 1,
    note: left
      ? `${why ? `${why} ` : ""}Stagioni salvate: ${seasonsDone} su ${seasonsTotal}. Tocca «Riprendi la scansione» per continuare da dove si è fermata.`
      : `Albo d'oro completo: ${seasonsTotal} ${seasonsTotal === 1 ? "stagione" : "stagioni"} dal ${fromYear}${gareRead ? `, ${gareRead} gare lette in questo giro` : ""}.`,
  });
}
