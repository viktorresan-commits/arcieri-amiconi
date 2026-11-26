/**
 * Storico FITAST dal 2019: per ogni stagione già finita la classifica generale delle compagnie e, per ogni gara,
 * i podi degli arcieri per categoria e la classifica delle compagnie. Si legge dal portale come l'aggiornamento
 * del campionato (dall'app di chi preme, le pagine passano dal server dell'app) e si salva per tutte le compagnie.
 * Riprende da dove si era fermato: le stagioni lette per intero e le gare già salvate non si riaprono.
 */
import { FITAST_HOME, fitastRead } from "./fitast.api";
import type { FitastPage } from "./fitast-parse";
import { classificaUrl, cleanTitle, findGare, garaDateOf, garaIdOf, garaTitleOf, seasonRange, seasonSelect } from "./fitast-gare";
import { currentTexts, filterCombos, pressReq, type Req } from "./fitast-nav";
import { rankingRows, SQUADRE_PAGES, type RankRow } from "./fitast-league";
import { fitastHistoryIndex, markHistorySeason, saveFitastHistory } from "./fitast-history.api";
import type { SyncProgress } from "./fitast-sync";

type Kind = "generale-squadre" | "gara-arcieri" | "gara-squadre";
type Item = { kind: Kind; season: string; seasonName: string; garaId: string; garaTitle: string; day: string; category: string; rows: RankRow[] };

/** pagine al massimo per ogni giro: poi si preme di nuovo e si riparte da dove si era rimasti */
const MAX_PAGES = 600;
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const short = (t: string) => t.split(" - ").pop()?.trim() ?? t;

export async function syncHistory(opts: { onProgress: (p: SyncProgress) => void; stop: () => boolean; fromYear?: number }) {
  const fromYear = opts.fromYear ?? 2019;
  let cookie = "";
  let pages = 0;
  let saved = 0;
  let step = "Apro il portale · storico";
  const report = (extra: Partial<SyncProgress> = {}) => opts.onProgress({ step, pages, saved, ...extra });
  const read = async (r: Req | null): Promise<FitastPage | null> => {
    if (!r || opts.stop() || pages >= MAX_PAGES) return null;
    pages++;
    report();
    try {
      const p = await fitastRead({ data: { url: r.url, post: r.post, referer: r.referer, cookie } });
      if (p.cookie) cookie = p.cookie;
      return p;
    } catch {
      return null;
    }
  };
  let pending: Item[] = [];
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending;
    pending = [];
    try {
      const r = await saveFitastHistory({ data: { items: batch } });
      saved += r.saved;
    } catch {
      /* si riprova al prossimo giro */
    }
    report();
  };

  const home = await read({ url: FITAST_HOME });
  if (!home) {
    report({ done: true, error: "Portale FITAST non raggiungibile." });
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

  const collect = (p: FitastPage | null, kind: Kind, texts: string[], limit: number, season: string, seasonName: string, gara = { id: "", title: "", day: "" }) => {
    if (!p) return 0;
    const rows = rankingRows(p, kind === "gara-arcieri" ? "arcieri" : "squadre", limit);
    if (!rows.length) return 0;
    pending.push({ kind, season, seasonName, garaId: gara.id, garaTitle: gara.title, day: gara.day, category: texts.join(" · "), rows });
    return rows.length;
  };
  const allCombos = async (p0: FitastPage | null, r0: Req | null, kind: Kind, limit: number, max: number, season: string, seasonName: string, gara?: { id: string; title: string; day: string }) => {
    if (!p0 || !r0) return 0;
    let n = collect(p0, kind, currentTexts(p0), limit, season, seasonName, gara);
    for (const c of filterCombos(p0, r0).slice(0, max)) {
      if (opts.stop()) break;
      n += collect(await read(c.req), kind, c.texts, limit, season, seasonName, gara);
    }
    await flush();
    return n;
  };

  let sqName = "";
  try {
    sqName = localStorage.getItem("aa-fitast-squadre") ?? "";
  } catch {
    sqName = "";
  }
  let left = 0;
  let gareRead = 0;
  for (const { o, range } of seasons) {
    const season = (o.value || o.text).replace(/[^\w-]/g, "").slice(0, 20);
    if (!season || doneSeasons.has(season)) continue;
    if (opts.stop() || pages >= MAX_PAGES) {
      left++;
      continue;
    }
    const seasonName = short(o.text);
    const choose: Record<string, string> = { [ss.name]: o.value };
    step = `${seasonName} · apro la stagione`;
    const base = ss.press ? await read(pressReq(home, ss.press, choose, o.text)) : null;
    if (!base) {
      left++;
      continue;
    }
    let complete = true;
    // classifica generale delle compagnie della stagione
    if (!have.has(`generale-squadre|${season}|`)) {
      const genSq = (base.form?.buttons ?? []).find((b) => /general/i.test(b.label) && /squadr|compagn|societ/i.test(b.label));
      if (genSq) {
        step = `${seasonName} · classifica compagnie`;
        const r0 = pressReq(base, genSq, choose, step);
        const p0 = await read(r0);
        if (!p0) complete = false;
        else await allCombos(p0, r0, "generale-squadre", 80, 8, season, seasonName);
      }
    }
    // le gare della stagione: podi degli arcieri e classifica delle compagnie
    const gare = findGare(base)
      .filter((g) => g.date && g.date >= range.from && g.date <= range.to)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    for (const g of gare) {
      if (opts.stop() || pages >= MAX_PAGES) {
        complete = false;
        break;
      }
      const ids = [g.id, g.key ?? ""].filter((x, i, a) => /^\d{3,6}$/.test(x) && a.indexOf(x) === i);
      const known = ids.find((id) => have.has(`gara-arcieri|${season}|${id}`));
      if (known && have.has(`gara-squadre|${season}|${known}`)) continue;
      let hit: { id: string; p0: FitastPage; r0: Req; gara: { id: string; title: string; day: string } } | null = null;
      for (const id of ids.slice(0, 3)) {
        step = `${seasonName} · ${g.title || "Gara"} · ${g.date?.split("-").reverse().join("/") ?? ""}`;
        const r0: Req = { url: classificaUrl(id, FITAST_HOME), referer: FITAST_HOME, label: step };
        const p0 = await read(r0);
        if (!p0 || garaIdOf(p0) !== id) continue;
        hit = { id, p0, r0, gara: { id, title: cleanTitle(garaTitleOf(p0) || g.title) || g.title, day: garaDateOf(p0) ?? g.date ?? "" } };
        break;
      }
      if (!hit) continue;
      gareRead++;
      // i primi tre di ogni categoria bastano per i podi
      if (!have.has(`gara-arcieri|${season}|${hit.id}`)) await allCombos(hit.p0, hit.r0, "gara-arcieri", 3, 16, season, seasonName, hit.gara);
      if (!have.has(`gara-squadre|${season}|${hit.id}`)) {
        for (const name of [...new Set([sqName, ...SQUADRE_PAGES].filter(Boolean))].slice(0, 4)) {
          if (opts.stop()) break;
          const r1: Req = { url: new URL(`${name}?P1=${hit.id}`, FITAST_HOME).toString(), referer: hit.p0.url, label: `${step} · compagnie` };
          const p1 = await read(r1);
          if (!p1 || (garaIdOf(p1) && garaIdOf(p1) !== hit.id)) continue;
          if (!rankingRows(p1, "squadre", 1).length) continue;
          sqName = name;
          await allCombos(p1, r1, "gara-squadre", 60, 4, season, seasonName, hit.gara);
          break;
        }
      }
    }
    await flush();
    if (complete && !opts.stop() && pages < MAX_PAGES) {
      try {
        await markHistorySeason({ data: { season } });
      } catch {
        /* si rifà al prossimo giro */
      }
    } else left++;
  }
  await flush();
  step = "Fatto";
  report({
    done: true,
    note: left
      ? `Storico: lette ${gareRead} gare, restano ${left} ${left === 1 ? "stagione" : "stagioni"}. Tocca di nuovo «Storico dal ${fromYear}» per continuare da dove si è fermato.`
      : `Storico dal ${fromYear} completo (${gareRead} gare lette in questo giro).`,
  });
}
