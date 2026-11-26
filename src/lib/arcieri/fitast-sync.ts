/**
 * Legge dal portale FITAST le classifiche del campionato in corso e le salva per tutti:
 * generale compagnie (GENERALE SQUADRE) e generale arcieri per categoria, poi per ogni gara del
 * campionato i primi arcieri di ogni categoria e la classifica squadre. Gira nel browser di chi apre
 * la scheda Compagnie FITAST (le pagine passano dal server dell'app), un passo alla volta.
 */
import { FITAST_HOME, fitastRead } from "./fitast.api";
import type { FitastPage } from "./fitast-parse";
import { classificaUrl, cleanTitle, titleScore, findGare, garaDateOf, garaIdOf, garaTitleOf, seasonRange, seasonSelect, type Gara } from "./fitast-gare";
import { currentTexts, filterCombos, pressReq, type Req } from "./fitast-nav";
import { piazzoleRows, rankingRows, SQUADRE_PAGES, type RankRow } from "./fitast-league";
import { saveFitastStandings, type StandingKind } from "./fitast-league.api";

export type SyncProgress = { step: string; pages: number; saved: number; diag?: string[]; done?: boolean; error?: string; /** a fine giro: cosa si è letto delle piazzole */ note?: string };
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

  /**
   * l'elenco delle piazzole di una gara (con chi si tira): una riga per arciere, la piazzola nel posto.
   * Dalla pagina delle piazzole per numero, se il portale la nomina; altrimenti scegliendo la gara
   * nell'elenco e premendo PIAZZOLE, come si fa a mano.
   */
  const pzBtn = (base.form?.buttons ?? []).find((b) => /piazzol/i.test(b.label)) ?? null;
  let pzName = "";
  try {
    pzName = localStorage.getItem("aa-fitast-piazzole") ?? "";
  } catch {
    pzName = "";
  }
  const pzStats = { tried: 0, read: 0, people: 0, seen: [] as string[] };
  const piazzole = async (id: string, gara: { id: string; title: string; day: string }, referer: string, g?: Gara, page?: FitastPage | null) => {
    if (opts.stop()) return;
    step = `${gara.title || "Gara"} · piazzole`;
    pzStats.tried++;
    const reqs: Req[] = [];
    // la pagina delle piazzole: quella che ha funzionato l'ultima volta, poi quelle nominate dal portale
    // (pagina iniziale, campionato, pagina della gara) e i link della gara con il numero dentro
    const names = [...new Set([pzName, ...(home.awp ?? []), ...(base.awp ?? []), ...(page?.awp ?? [])].filter((x) => x && /piazz/i.test(x)))];
    for (const name of names.slice(0, 4)) reqs.push({ url: new URL(`${name}?P1=${id}`, FITAST_HOME).toString(), referer, label: step });
    for (const ref of (page?.refs ?? []).filter((x) => /piazz/i.test(x)).slice(0, 2)) reqs.push({ url: ref, referer, label: step });
    for (const l of (page?.links ?? []).filter((x) => /piazz/i.test(`${x.text} ${x.href}`) && x.href).slice(0, 2)) reqs.push({ url: l.href, referer, label: step });
    // il pulsante PIAZZOLE della pagina della gara (si preme lì, la gara è già scelta)
    const garaBtn = (page?.form?.buttons ?? []).find((b) => /piazzol/i.test(b.label));
    if (page && garaBtn) {
      const r = pressReq(page, garaBtn, {}, step);
      if (r) reqs.push(r);
    }
    if (pzBtn && g) {
      const how = g.alts.find((a) => a.kind === "option" || a.kind === "input");
      if (how) {
        const field = how.kind === "option" ? how.select : how.kind === "input" ? how.input : "";
        const value = how.kind === "option" ? how.value : id;
        const r = field ? pressReq(base, pzBtn, { ...choose, [field]: value }, step) : null;
        if (r) reqs.push(r);
      }
    }
    const done = new Set<string>();
    for (const r of reqs) {
      if (opts.stop()) return;
      const k = `${r.url}|${JSON.stringify(r.post ?? "")}`;
      if (done.has(k)) continue;
      done.add(k);
      const p = await read(r);
      if (!p || (garaIdOf(p) && garaIdOf(p) !== id)) continue;
      const rows = piazzoleRows(p);
      if (!rows.length) {
        // com'è fatta la pagina (solo titoli delle colonne e conteggi), per capire cosa manca
        const heads = p.tables.slice(0, 3).map((t) => `${t.rows.length}r:${t.rows[0]?.map((c) => c.text.slice(0, 14)).join("/") ?? ""}`).join(" ; ");
        if (pzStats.seen.length < 4) pzStats.seen.push(`${p.url.split("/").pop()?.slice(0, 40)} → ${heads || "nessuna tabella"}`);
        continue;
      }
      const name = /\/([\w-]+\.awp)/i.exec(r.url)?.[1] ?? "";
      if (name && /piazz/i.test(name)) {
        try {
          localStorage.setItem("aa-fitast-piazzole", name);
        } catch {
          /* niente */
        }
      }
      pzStats.read++;
      pzStats.people += rows.length;
      pending.push({ kind: "gara-piazzole", season, seasonName, garaId: gara.id, garaTitle: gara.title, day: gara.day, category: "Piazzole", rows });
      return;
    }
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
    // tutta la classifica (non solo i primi dieci): serve la media di tutti gli arcieri di ogni compagnia
    await allCombos(await read(r0), r0, "generale-arcieri", 600, 24);
  }

  // gare del campionato già fatte: classifica arcieri (primi 3 per categoria) e squadre
  const range = now ? seasonRange(now.text) ?? seasonRange(now.value) : null;
  const learned = learnedIds();
  // dalla più recente: le piazzole delle ultime gare servono prima (le pagine lette hanno un limite)
  const gare = findGare(base)
    .filter((g) => g.date && g.date <= today && (!range || (g.date >= range.from && g.date <= range.to)))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
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
      // prima chi era in piazzola con chi (poche pagine), poi le classifiche intere
      await piazzole(id, gara, p0.url, g, p0);
      // tutti gli arcieri della gara (la pagina ne mostra i primi tre): servono iscritti e gare di ogni compagnia
      await allCombos(p0, r0, "gara-arcieri", 400, 24, gara);
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
        await allCombos(p1, r1, "gara-squadre", 200, 4, gara);
        break;
      }
      break;
    }
  }
  // gare delle prossime tre settimane: chi tira con chi (elenco delle piazzole)
  const soon = isoDay(new Date(Date.now() + 21 * 86_400_000));
  for (const g of findGare(base).filter((x) => x.date && x.date > today && x.date <= soon)) {
    if (opts.stop() || pages >= MAX_PAGES) break;
    const id = [g.id, g.key ?? ""].find((x) => /^\d{3,6}$/.test(x));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    step = `${g.title || "Gara"} · ${g.date?.split("-").reverse().join("/") ?? ""} · piazzole`;
    await piazzole(id, { id, title: cleanTitle(g.title) || g.title, day: g.date ?? "" }, FITAST_HOME, g);
  }
  await flush();
  step = "Fatto";
  const note = pzStats.tried
    ? pzStats.read
      ? `Piazzole lette per ${pzStats.read} ${pzStats.read === 1 ? "gara" : "gare"} su ${pzStats.tried} (${pzStats.people} arcieri).`
      : `Piazzole non trovate sul portale per ${pzStats.tried} ${pzStats.tried === 1 ? "gara" : "gare"}.${pzStats.seen.length ? ` Pagine viste: ${pzStats.seen.join(" | ")}` : ""}`
    : "";
  report({ done: true, ...(note ? { note } : {}) });
}
