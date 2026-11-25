/**
 * Legge dal portale FITAST le classifiche del campionato in corso e le salva per tutti:
 * generale compagnie (GENERALE SQUADRE) e generale arcieri per categoria, poi per ogni gara del
 * campionato i primi arcieri di ogni categoria e la classifica squadre. Gira nel browser di chi apre
 * la scheda Compagnie FITAST (le pagine passano dal server dell'app), un passo alla volta.
 */
import { FITAST_HOME, fitastRead } from "./fitast.api";
import type { FitastPage } from "./fitast-parse";
import { classificaUrl, cleanTitle, titleScore, findGare, garaDateOf, garaIdOf, garaTitleOf, seasonRange, seasonSelect } from "./fitast-gare";
import { currentTexts, filterCombos, pressReq, type Req } from "./fitast-nav";
import { rankingRows, SQUADRE_PAGES, type RankRow } from "./fitast-league";
import { saveFitastStandings, type StandingKind } from "./fitast-league.api";

export type SyncProgress = { step: string; pages: number; saved: number; diag?: string[]; done?: boolean; error?: string };
type Item = { kind: StandingKind; season: string; seasonName: string; garaId: string; garaTitle: string; day: string; category: string; rows: RankRow[] };

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const short = (t: string) => t.split(" - ").pop()?.trim() ?? t;
const MAX_PAGES = 360;

function learnedIds(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem("aa-fitast-gare") ?? "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function syncStandings(opts: { onProgress: (p: SyncProgress) => void; stop: () => boolean }) {
  let cookie = "";
  let pages = 0;
  let saved = 0;
  let diag: string[] | undefined;
  let step = "Apro il portale";
  const report = (extra: Partial<SyncProgress> = {}) => opts.onProgress({ step, pages, saved, diag, ...extra });
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
      const r = await saveFitastStandings({ data: { items: batch } });
      saved += r.saved;
    } catch {
      /* si riprova al prossimo aggiornamento */
    }
    report();
  };
  const today = isoDay(new Date());

  const home = await read({ url: FITAST_HOME });
  if (!home) {
    report({ done: true, error: "Portale FITAST non raggiungibile." });
    return;
  }
  // il campionato di oggi (es. 26_I · Camp. invernale 2026/2027)
  const ss = seasonSelect(home);
  const now = ss ? ss.options.map((o) => ({ o, range: seasonRange(o.text) ?? seasonRange(o.value) })).find((x) => x.range && x.range.from <= today && x.range.to >= today)?.o ?? ss.options.find((o) => o.selected) ?? ss.options[0] : null;
  const season = (now?.value || "corrente").replace(/[^\w-]/g, "").slice(0, 20) || "corrente";
  const seasonName = now ? short(now.text) : "Campionato in corso";
  const choose: Record<string, string> = ss && now ? { [ss.name]: now.value } : {};
  let base: FitastPage = home;
  if (ss && now && ss.press && (ss.options.find((o) => o.selected) ?? ss.options[0]).value !== now.value) base = (await read(pressReq(home, ss.press, choose, now.text))) ?? home;

  const collect = (p: FitastPage | null, kind: StandingKind, texts: string[], limit: number, gara: { id: string; title: string; day: string } = { id: "", title: "", day: "" }) => {
    if (!p) return 0;
    const rows = rankingRows(p, kind.endsWith("squadre") ? "squadre" : "arcieri", limit);
    if (!rows.length) {
      diag ??= p.diag;
      return 0;
    }
    pending.push({ kind, season, seasonName, garaId: gara.id, garaTitle: gara.title, day: gara.day, category: texts.join(" · "), rows });
    return rows.length;
  };
  /** una classifica con i suoi filtri: la scelta mostrata e poi ogni combinazione (al massimo max) */
  const allCombos = async (p0: FitastPage | null, r0: Req | null, kind: StandingKind, limit: number, max: number, gara?: { id: string; title: string; day: string }) => {
    if (!p0 || !r0) return;
    collect(p0, kind, currentTexts(p0), limit, gara);
    for (const c of filterCombos(p0, r0).slice(0, max)) {
      if (opts.stop()) break;
      collect(await read(c.req), kind, c.texts, limit, gara);
    }
    await flush();
  };

  // classifiche generali del campionato: compagnie e arcieri
  const btns = base.form?.buttons ?? [];
  const genSq = btns.find((b) => /general/i.test(b.label) && /squadr|compagn|societ/i.test(b.label));
  const genAr = btns.find((b) => /general/i.test(b.label) && /arcier/i.test(b.label));
  if (genSq) {
    step = `Classifica generale compagnie · ${seasonName}`;
    const r0 = pressReq(base, genSq, choose, step);
    await allCombos(await read(r0), r0, "generale-squadre", 40, 8);
  }
  if (genAr && !opts.stop()) {
    step = `Classifica generale arcieri · ${seasonName}`;
    const r0 = pressReq(base, genAr, choose, step);
    await allCombos(await read(r0), r0, "generale-arcieri", 10, 24);
  }

  // gare del campionato già fatte: classifica arcieri (primi 3 per categoria) e squadre
  const range = now ? seasonRange(now.text) ?? seasonRange(now.value) : null;
  const learned = learnedIds();
  const gare = findGare(base).filter((g) => g.date && g.date <= today && (!range || (g.date >= range.from && g.date <= range.to)));
  const seen = new Set<string>();
  let sqName = "";
  try {
    sqName = localStorage.getItem("aa-fitast-squadre") ?? "";
  } catch {
    sqName = "";
  }
  for (const g of gare) {
    if (opts.stop() || pages >= MAX_PAGES) break;
    // il numero della gara: dall'elenco, dalla chiave della riga o dalle gare già viste nelle ricerche (stessa data)
    const candidates = [g.id, g.key ?? "", ...Object.entries(learned).filter(([, d]) => d === g.date).map(([id]) => id)].filter((x, i, a) => /^\d{3,6}$/.test(x) && a.indexOf(x) === i);
    for (const id of candidates.slice(0, 4)) {
      if (seen.has(id) || opts.stop()) continue;
      step = `${g.title || "Gara"} · ${g.date?.split("-").reverse().join("/") ?? ""}`;
      const r0: Req = { url: classificaUrl(id, FITAST_HOME), referer: FITAST_HOME, label: step };
      const p0 = await read(r0);
      if (!p0 || garaIdOf(p0) !== id) continue;
      // più gare nello stesso giorno: deve essere quella dell'elenco
      const title = cleanTitle(garaTitleOf(p0) || g.title) || g.title;
      if (candidates.length > 1 && titleScore(g.title, title) < 1 && candidates.indexOf(id) < candidates.length - 1) continue;
      seen.add(id);
      const gara = { id, title, day: garaDateOf(p0) ?? g.date ?? "" };
      await allCombos(p0, r0, "gara-arcieri", 3, 24, gara);
      // classifica squadre della gara: l'indirizzo che ha funzionato l'ultima volta, poi i nomi simili
      for (const name of [...new Set([sqName, ...(home.awp ?? []).filter((x) => /squadr|compagn|societ/i.test(x) && !/general/i.test(x)), ...SQUADRE_PAGES].filter(Boolean))].slice(0, 5)) {
        if (opts.stop()) break;
        const r1: Req = { url: new URL(`${name}?P1=${id}`, FITAST_HOME).toString(), referer: p0.url, label: `${step} · squadre` };
        const p1 = await read(r1);
        if (!p1 || (garaIdOf(p1) && garaIdOf(p1) !== id)) continue;
        if (!rankingRows(p1, "squadre", 1).length && !garaIdOf(p1)) continue;
        sqName = name;
        try {
          localStorage.setItem("aa-fitast-squadre", name);
        } catch {
          /* niente */
        }
        await allCombos(p1, r1, "gara-squadre", 5, 4, gara);
        break;
      }
      break;
    }
  }
  await flush();
  step = "Fatto";
  report({ done: true });
}
