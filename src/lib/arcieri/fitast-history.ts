/**
 * Scansione dello storico FITAST dal 2019: per ogni stagione finita la classifica generale delle compagnie e
 * degli arcieri (tutte le categorie) e, per ogni gara, la classifica degli arcieri per categoria e quella delle
 * compagnie. Si legge dal portale come l'aggiornamento del campionato (dall'app di chi preme, le pagine passano
 * dal server dell'app) e si salva per tutte le compagnie.
 *
 * Le stagioni passate il portale le apre in modi diversi: con il comando della tendina della stagione, con la
 * tendina mandata insieme al modulo, oppure non le apre affatto. Si provano tutti, controllando ogni volta che
 * la pagina sia davvero di quella stagione. Le gare che così non si trovano si cercano per numero (ogni gara ha
 * la sua classifica a pagView-Class-Arcieri-Gara.awp?P1=numero), dalla più vecchia della stagione in corso
 * all'indietro, fino a prima del 2019.
 *
 * Va avanti finché non ha finito (anche un'ora o più): si può fermare e riprende da dove era. Alla fine lascia
 * un riassunto tecnico di cosa ha trovato, per capire cosa non va se qualcosa manca.
 */
import { pointsChanged } from "./points-refresh";
import { FITAST_HOME, fitastRead } from "./fitast.api";
import type { FitastPage } from "./fitast-parse";
import { classificaUrl, cleanTitle, findGare, garaDateOf, garaIdOf, garaTitleOf, seasonRange, seasonSelect } from "./fitast-gare";
import { currentTexts, filterCombos, FILTER_BUTTON, pressReq, type Req } from "./fitast-nav";
import { generaleFp, rankingRows, SQUADRE_PAGES, type RankRow } from "./fitast-league";
import { ALL_DONE, fitastHistoryIndex, markHistorySeason, saveFitastHistory, setHistoryCursor } from "./fitast-history.api";
import type { SyncProgress } from "./fitast-sync";
import { fitastStandings } from "./fitast-league.api";

type Kind = "generale-squadre" | "generale-arcieri" | "gara-arcieri" | "gara-squadre";
type Item = { kind: Kind; season: string; seasonName: string; garaId: string; garaTitle: string; day: string; category: string; rows: RankRow[]; complete: boolean };
type GaraRef = { id: string; title: string; day: string };
type Season = { key: string; name: string; value: string; text: string; from: string; to: string };

/** avanzamento della scansione: stagioni e gare, per la barra */
export type HistoryProgress = SyncProgress & { pct: number; seasons: number; seasonsDone: number; gare: number; startedAt: number };

/** limite di sicurezza per un giro: poi si riprende da dove si era */
const SAFETY_PAGES = 30000;
/** pagine perse di fila prima di fermarsi (portale giù o connessione assente) */
const MAX_FAILS = 8;
/** categorie al massimo per classifica (Categoria × Tipologia) */
const MAX_COMBOS = 40;
/** righe al massimo per ogni salvataggio: le richieste restano piccole */
const ROWS_PER_SAVE = 2500;
/** ricerca per numero: si smette dopo tante gare di fila più vecchie del 2019 o tanti numeri vuoti di fila */
const OLD_RUN = 30;
const EMPTY_RUN = 400;
/** pausa tra una pagina e l'altra: il portale non va sommerso */
const GAP_MS = 120;

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const short = (t: string) => t.split(" - ").pop()?.trim() ?? t;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** la pagina parla di questa stagione: la tendina la ha scelta, oppure le sue gare cadono nelle sue date */
function isSeasonPage(p: FitastPage | null, s: Season) {
  if (!p) return false;
  const sel = seasonSelect(p);
  const chosen = sel?.options.find((o) => o.selected);
  if (chosen && chosen.value === s.value) return true;
  return findGare(p).some((g) => g.date && g.date >= s.from && g.date <= s.to);
}

/** una classifica generale è di questa stagione se ne cita gli anni (o almeno non cita quelli di un'altra) */
function mentionsSeason(p: FitastPage, s: Season, other: Season | null) {
  const text = plain([p.title, ...p.lines.slice(0, 60)].join(" "));
  const y1 = s.from.slice(0, 4);
  const y2 = s.to.slice(0, 4);
  const pair = (a: string, b: string) => a !== b && (text.includes(`${a}/${b}`) || text.includes(`${a}-${b}`));
  const mine = pair(y1, y2) || text.includes(plain(short(s.text)));
  const o1 = other?.from.slice(0, 4) ?? "";
  const o2 = other?.to.slice(0, 4) ?? "";
  const theirs = Boolean(other && other.key !== s.key && (pair(o1, o2) || text.includes(plain(short(other.text)))));
  if (mine && !theirs) return "si";
  if (theirs && !mine) return "no";
  // stagione di un anno solo: basta l'anno, se la pagina non cita la stagione di oggi
  if (!theirs && y1 === y2 && text.includes(y1)) return "si";
  return "forse";
}

export async function syncHistory(opts: { onProgress: (p: HistoryProgress) => void; stop: () => boolean; fromYear?: number }) {
  const fromYear = opts.fromYear ?? 2019;
  const fromDay = `${fromYear}-01-01`;
  const startedAt = Date.now();
  const diag: string[] = [];
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
  let pctNow = 0;
  const report = (extra: Partial<HistoryProgress> = {}) => {
    // dati nuovi dal portale: punti dell'avatar e livelli si ricalcolano
    if (extra.done && saved > 0) pointsChanged();
    opts.onProgress({ step, pages, saved, pct: pctNow, seasons: seasonsTotal, seasonsDone, gare: gareRead, startedAt, diag: diag.slice(-40), ...extra });
  };
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
        await wait(GAP_MS);
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

  /** salva a pezzi; se il server non risponde si segna (e la stagione resta da rifare) */
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

  /** una classifica con tutte le sue categorie: la pagina aperta e poi ogni combinazione. Torna le righe lette e se è intera */
  const board = async (p0: FitastPage | null, r0: Req | null, kind: Kind, season: Season, gara: GaraRef = { id: "", title: "", day: "" }) => {
    if (!p0 || !r0) return { rows: 0, complete: false, rejected: 0 };
    const list: Item[] = [];
    let complete = true;
    let rejected = 0;
    const generale = kind.startsWith("generale");
    const add = (p: FitastPage, texts: string[]) => {
      const rows = rankingRows(p, kind.endsWith("squadre") ? "squadre" : "arcieri", 800);
      if (!rows.length) return;
      // una generale uguale a quella di un'altra stagione è la classifica sbagliata: non si salva
      // (se la pagina cita gli anni della stagione si crede alla pagina: era quella copiata nelle altre)
      if (generale && rows.length >= 2) {
        const fp = generaleFp(kind, rows, rows.length);
        const other = mentionsSeason(p, season, current) !== "si" && [...(genSeen.get(fp) ?? [])].some((k) => k !== season.key);
        if (other) {
          rejected++;
          return;
        }
        genSeen.set(fp, new Set([...(genSeen.get(fp) ?? []), season.key]));
      }
      list.push({ kind, season: season.key, seasonName: season.name, garaId: gara.id, garaTitle: gara.title, day: gara.day, category: texts.join(" · "), rows, complete: true });
    };
    add(p0, currentTexts(p0));
    // la prima pagina è già di un'altra stagione: le altre categorie lo sarebbero anche loro
    if (generale && rejected && !list.length) return { rows: 0, complete: true, rejected };
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
    return { rows: list.reduce((t, x) => t + x.rows.length, 0), complete, rejected };
  };

  // ——— il portale e le sue stagioni ———
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
  const all: Season[] = ss.options
    .map((o) => ({ o, range: seasonRange(o.text) ?? seasonRange(o.value) }))
    .filter((x): x is { o: (typeof ss.options)[number]; range: { from: string; to: string } } => Boolean(x.range))
    .map(({ o, range }) => ({ key: (o.value || o.text).replace(/[^\w-]/g, "").slice(0, 20), name: short(o.text), value: o.value, text: o.text, from: range.from, to: range.to }));
  const current = all.find((s) => s.from <= today && s.to >= today) ?? null;
  // solo le stagioni finite dal 2019, dalla più recente
  const seasons = all.filter((s) => s.from >= fromDay && s.to < today && s.key).sort((a, b) => b.from.localeCompare(a.from));
  if (!seasons.length) {
    report({ done: true, error: `Sul portale non trovo stagioni finite dal ${fromYear}.` });
    return;
  }
  diag.push(`Stagioni sul portale: ${all.length}, finite dal ${fromYear}: ${seasons.length}. Tendina: ${ss.name}${ss.press ? " (con comando)" : " (senza comando)"}. Pulsanti: ${(home.form?.buttons ?? []).map((b) => b.label || b.code).slice(0, 12).join(", ") || "nessuno"}.`);
  let index: Awaited<ReturnType<typeof fitastHistoryIndex>> = { items: [], seasonsDone: [], cursor: null };
  try {
    index = await fitastHistoryIndex();
  } catch {
    diag.push("Indice dell'archivio non letto: si rilegge tutto.");
  }
  const doneSeasons = new Set(index.seasonsDone);
  /** impronte delle classifiche generali già salvate (e di quella in corso): una stagione non può avere quella di un'altra */
  const genSeen = new Map<string, Set<string>>(((index as { generali?: { fp: string; seasons: string[] }[] }).generali ?? []).map((g) => [g.fp, new Set(g.seasons)]));
  const have = new Set(index.items.map((i) => `${i.kind}|${i.season}|${i.garaId}`));
  /** gare già salvate per intero, qualunque stagione */
  const haveGara = new Set(index.items.filter((i) => i.kind === "gara-arcieri").map((i) => i.garaId));
  seasonsTotal = seasons.length;
  seasonsDone = seasons.filter((s) => doneSeasons.has(s.key)).length;
  report();

  let sqName = "";
  try {
    sqName = localStorage.getItem("aa-fitast-squadre") ?? "";
  } catch {
    sqName = "";
  }

  /** una gara: tutti gli arcieri per categoria e la classifica delle compagnie */
  const readGara = async (p0: FitastPage, r0: Req, gara: GaraRef, season: Season) => {
    let complete = true;
    const day = gara.day.split("-").reverse().join("/");
    if (!have.has(`gara-arcieri|${season.key}|${gara.id}`)) {
      step = `${season.name} · ${gara.title || "Gara"} · ${day} · arcieri`;
      if (!(await board(p0, r0, "gara-arcieri", season, gara)).complete) complete = false;
    }
    if (!have.has(`gara-squadre|${season.key}|${gara.id}`) && !halted()) {
      step = `${season.name} · ${gara.title || "Gara"} · ${day} · compagnie`;
      for (const name of [...new Set([sqName, ...SQUADRE_PAGES].filter(Boolean))].slice(0, 4)) {
        if (halted()) break;
        const r1: Req = { url: new URL(`${name}?P1=${gara.id}`, FITAST_HOME).toString(), referer: p0.url, label: step };
        const p1 = await read(r1);
        if (!p1 || (garaIdOf(p1) && garaIdOf(p1) !== gara.id)) continue;
        if (!rankingRows(p1, "squadre", 1).length) continue;
        sqName = name;
        if (!(await board(p1, r1, "gara-squadre", season, gara)).complete) complete = false;
        break;
      }
    }
    gareRead++;
    haveGara.add(gara.id);
    report();
    return complete;
  };

  /** la pagina della stagione: si provano i modi in cui il portale la può aprire, e si controlla */
  const seasonPage = async (s: Season): Promise<{ page: FitastPage; how: string } | null> => {
    const choose: Record<string, string> = { [ss.name]: s.value };
    const tries: { how: string; r: Req | null }[] = [];
    if (ss.press) tries.push({ how: "comando della tendina", r: pressReq(home, ss.press, choose, s.text) });
    tries.push({ how: "tendina come comando", r: pressReq(home, { code: ss.name, set: {} }, choose, s.text) });
    tries.push({ how: "modulo con la tendina", r: pressReq(home, { code: "", set: {} }, choose, s.text) });
    for (const b of (home.form?.buttons ?? []).filter((x) => FILTER_BUTTON.test(x.label.trim())).slice(0, 2)) tries.push({ how: `pulsante ${b.label}`, r: pressReq(home, b, choose, s.text) });
    for (const t of tries) {
      if (halted()) return null;
      const p = await read(t.r);
      if (isSeasonPage(p, s)) return { page: p as FitastPage, how: t.how };
    }
    return null;
  };

  // ——— 1. stagione per stagione: generali e gare dell'elenco ———
  /** stagioni di cui il portale non ha dato l'elenco delle gare: le si cerca per numero */
  const missing: Season[] = [];
  for (const s of seasons) {
    if (doneSeasons.has(s.key)) continue;
    if (halted()) break;
    pctNow = ((seasonsDone + 0.05) / Math.max(1, seasonsTotal)) * 0.5;
    step = `${s.name} · apro la stagione`;
    const opened = await seasonPage(s);
    const base = opened?.page ?? home;
    const choose: Record<string, string> = { [ss.name]: s.value };
    const btns = base.form?.buttons ?? [];
    const genSq = btns.find((b) => /general/i.test(b.label) && /squadr|compagn|societ/i.test(b.label));
    const genAr = btns.find((b) => /general/i.test(b.label) && /arcier/i.test(b.label));
    const notes: string[] = [opened ? `aperta (${opened.how})` : "non si apre"];
    for (const [kind, btn, label] of [["generale-squadre", genSq, "compagnie"], ["generale-arcieri", genAr, "arcieri"]] as const) {
      if (!btn) {
        notes.push(`generale ${label}: pulsante assente`);
        continue;
      }
      if (have.has(`${kind}|${s.key}|`) || halted()) continue;
      step = `${s.name} · classifica generale ${label}`;
      const r0 = pressReq(base, btn, choose, step);
      const p0 = await read(r0);
      if (!p0) {
        notes.push(`generale ${label}: pagina persa`);
        continue;
      }
      // la generale potrebbe essere quella di oggi anche con la stagione aperta: si controlla sempre che sia la sua
      const ok = mentionsSeason(p0, s, current);
      if (ok === "no") {
        notes.push(`generale ${label}: il portale dà un'altra stagione`);
        continue;
      }
      const got = await board(p0, r0, kind, s);
      notes.push(
        got.rejected && !got.rows
          ? `generale ${label}: il portale dà la classifica di un'altra stagione`
          : `generale ${label}: ${got.rows} righe${got.rejected ? `, ${got.rejected} categorie di un'altra stagione scartate` : ""}${ok === "forse" ? " (stagione non verificata)" : ""}`,
      );
    }
    const gare = opened
      ? findGare(opened.page)
          .filter((g) => g.date && g.date >= s.from && g.date <= s.to)
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      : [];
    notes.push(`gare nell'elenco: ${gare.length}`);
    if (!gare.length) missing.push(s);
    let complete = true;
    let at = 0;
    for (const g of gare) {
      if (halted()) {
        complete = false;
        break;
      }
      at++;
      pctNow = ((seasonsDone + at / gare.length) / Math.max(1, seasonsTotal)) * 0.5;
      const ids = [g.id, g.key ?? ""].filter((x, i, a) => /^\d{3,6}$/.test(x) && a.indexOf(x) === i);
      if (ids.some((id) => haveGara.has(id))) continue;
      let hit: { p0: FitastPage; r0: Req; gara: GaraRef } | null = null;
      for (const id of ids.slice(0, 3)) {
        step = `${s.name} · ${g.title || "Gara"}`;
        const r0: Req = { url: classificaUrl(id, FITAST_HOME), referer: FITAST_HOME, label: step };
        const p0 = await read(r0);
        if (!p0 || garaIdOf(p0) !== id) continue;
        hit = { p0, r0, gara: { id, title: cleanTitle(garaTitleOf(p0) || g.title) || g.title, day: garaDateOf(p0) ?? g.date ?? "" } };
        break;
      }
      if (!hit) {
        if (halted() || fails > 0) complete = false;
        continue;
      }
      if (!(await readGara(hit.p0, hit.r0, hit.gara, s))) complete = false;
    }
    diag.push(`${s.name}: ${notes.join("; ")}.`);
    // con l'elenco delle gare letto per intero la stagione è chiusa; senza, aspetta la ricerca per numero
    if (gare.length && complete && !halted() && !saveFailed) {
      try {
        await markHistorySeason({ data: { season: s.key } });
        doneSeasons.add(s.key);
        seasonsDone++;
      } catch {
        /* si rifà al prossimo giro */
      }
    }
    report();
  }

  // ——— 2. gare cercate per numero, per le stagioni senza elenco ———
  if (missing.length && !halted()) {
    const oldest = missing.reduce((m, s) => (s.from < m ? s.from : m), missing[0].from);
    const ofDay = (d: string) => missing.find((s) => d >= s.from && d <= s.to) ?? null;
    // si parte dalla gara con il numero più basso della stagione in corso (o da dove si era rimasti)
    let nowIds = findGare(home).flatMap((g) => [g.id, g.key ?? ""]).filter((x) => /^\d{3,6}$/.test(x)).map(Number);
    // l'elenco del portale non dà i numeri: quelli delle gare del campionato in corso già salvate
    if (!nowIds.length) {
      try {
        const st = await fitastStandings();
        nowIds = st.items.map((x) => x.garaId).filter((x) => /^\d{3,6}$/.test(x)).map(Number);
      } catch {
        nowIds = [];
      }
    }
    const start = index.cursor && !index.cursor.done ? index.cursor.id : nowIds.length ? Math.min(...nowIds) - 1 : 0;
    if (index.cursor?.done) diag.push("Ricerca per numero già finita in un giro precedente.");
    else if (!start) diag.push("Ricerca per numero: nessuna gara della stagione in corso da cui partire.");
    else {
      diag.push(`Ricerca per numero: dalla gara ${start} all'indietro, fino a prima del ${oldest.slice(0, 4)}.`);
      let id = start;
      let oldRun = 0;
      let emptyRun = 0;
      let found = 0;
      let kept = 0;
      let lastSaved = start;
      let finished = false;
      const todayMs = Date.parse(today);
      const span = Math.max(1, todayMs - Date.parse(oldest));
      while (id > 0 && !halted()) {
        const key = String(id);
        if (!haveGara.has(key)) {
          step = `Cerco le gare per numero · ${key}`;
          const r0: Req = { url: classificaUrl(key, FITAST_HOME), referer: FITAST_HOME, label: step };
          const p0 = await read(r0);
          if (halted()) break;
          if (!p0 || garaIdOf(p0) !== key) emptyRun++;
          else {
            emptyRun = 0;
            found++;
            const day = garaDateOf(p0) ?? "";
            if (day && day < oldest) oldRun++;
            else if (day) {
              oldRun = 0;
              pctNow = 0.5 + 0.5 * Math.min(1, Math.max(0, (todayMs - Date.parse(day)) / span));
              const s = ofDay(day);
              if (s) {
                kept++;
                const gara: GaraRef = { id: key, title: cleanTitle(garaTitleOf(p0)) || `Gara ${key}`, day };
                step = `${s.name} · ${gara.title}`;
                await readGara(p0, r0, gara, s);
              }
            }
          }
        }
        if (oldRun >= OLD_RUN || emptyRun >= EMPTY_RUN) {
          finished = true;
          break;
        }
        id--;
        if (lastSaved - id >= 20) {
          lastSaved = id;
          try {
            await setHistoryCursor({ data: { id, done: false } });
          } catch {
            /* si riprende un po' più su */
          }
        }
      }
      if (id <= 0) finished = true;
      try {
        await setHistoryCursor({ data: { id: Math.max(0, id), done: finished } });
      } catch {
        /* niente */
      }
      diag.push(`Ricerca per numero: arrivata alla gara ${id}, ${found} gare trovate, ${kept} delle stagioni passate${finished ? ", finita" : ", da riprendere"}.`);
      if (finished && !saveFailed) {
        for (const s of missing) {
          try {
            await markHistorySeason({ data: { season: s.key } });
            if (!doneSeasons.has(s.key)) seasonsDone++;
            doneSeasons.add(s.key);
          } catch {
            /* al prossimo giro */
          }
        }
      }
    }
  }

  const left = seasons.filter((s) => !doneSeasons.has(s.key)).length;
  if (!left && !halted()) {
    try {
      await markHistorySeason({ data: { season: ALL_DONE } });
    } catch {
      /* resta il pulsante per riprendere */
    }
  }
  step = "Fatto";
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
    pct: left ? pctNow : 1,
    note: left
      ? `${why ? `${why} ` : ""}Stagioni complete: ${seasonsDone} su ${seasonsTotal}, ${gareRead} gare lette in questo giro, ${saved} classifiche salvate. Tocca «Riprendi la scansione» per continuare da dove si è fermata.`
      : `Albo d'oro completo: ${seasonsTotal} ${seasonsTotal === 1 ? "stagione" : "stagioni"} dal ${fromYear}${gareRead ? `, ${gareRead} gare lette in questo giro` : ""}.`,
  });
}
