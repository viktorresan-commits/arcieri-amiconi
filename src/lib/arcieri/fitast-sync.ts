/**
 * Legge dal portale FITAST le classifiche del campionato in corso e le salva per tutti:
 * generale compagnie (GENERALE SQUADRE) e generale arcieri per categoria, poi per ogni gara del
 * campionato i primi arcieri di ogni categoria e la classifica squadre. Gira nel browser di chi apre
 * la scheda Compagnie FITAST (le pagine passano dal server dell'app), un passo alla volta.
 */
import { FITAST_HOME, fitastRead } from "./fitast.api";
import type { FitastPage } from "./fitast-parse";
import { classificaUrl, cleanTitle, titleScore, findGare, garaDateOf, garaIdOf, garaTitleOf, rowFields, seasonRange, seasonSelect, type Gara } from "./fitast-gare";
import { currentTexts, FILTER_BUTTON, filterCombos, pressReq, type Req } from "./fitast-nav";
import { namesOnly, piazzoleRows, pzName as cleanPz, smartPiazzoleRows, rankingRows, SQUADRE_PAGES, type RankRow } from "./fitast-league";
import { saveFitastStandings, type StandingKind } from "./fitast-league.api";

export type SyncProgress = { step: string; pages: number; saved: number; diag?: string[]; done?: boolean; error?: string; /** a fine giro: cosa si è letto delle piazzole */ note?: string };
type Item = { kind: StandingKind; season: string; seasonName: string; garaId: string; garaTitle: string; day: string; category: string; rows: RankRow[] };

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const short = (t: string) => t.split(" - ").pop()?.trim() ?? t;
const MAX_PAGES = 360;
/** la pagina del portale con l'elenco delle piazzole di una gara (P1 = numero della gara) */
const PZ_PAGE = "pagView-Piazzole.awp";
/** pagine al massimo per le piazzole di una gara (una per piazzola, il portale ne mostra una alla volta) */
const PZ_MAX = 50;

/** il numero della gara di una pagina delle piazzole: dall'indirizzo (P1=…) o dal titolo («… 3D2472», «Gara_da_configurare2489») */
function pzGaraOf(p: FitastPage): string {
  const u = /[?&]P1=(\d{3,6})\b/i.exec(p.url)?.[1];
  if (u) return u;
  const id = garaIdOf(p);
  if (id) return id;
  for (const l of p.lines.slice(0, 14)) {
    const t = l.trim();
    if (!/gara/i.test(t) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t)) continue;
    const m = /(\d{3,6})\s*$/.exec(t);
    if (m && !(Number(m[1]) >= 1990 && Number(m[1]) <= 2100)) return m[1];
  }
  return "";
}

const isNum = (t: string) => /^\s*(?:piazzola|pz\.?|n\.?|nr\.?|turno)?\s*\d{1,3}\s*$/i.test(t);
const isAll = (t: string) => /^\s*$|^\s*[-–*]+\s*$|tutt|qualsias|^all$|seleziona|scegli/i.test(t);

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
  /**
   * Come si sceglie una riga dell'elenco delle gare (il campo nascosto della tabella WEBDEV e se le righe si
   * contano da 1 o da 0): si scopre una volta premendo CLASSIFICA su una gara nota, come fa la ricerca del nome,
   * e si ricorda. Serve per premere PIAZZOLE sulla gara giusta, come si fa a mano.
   */
  const selOf = (p: FitastPage, f: string): Record<string, string> => ((p.wdAliases ?? []).includes(f) ? { [`${f}_SEL`]: p.form?.fields[f] ?? "" } : {});
  const rowIdx = (g: Gara) => g.alts.find((a): a is { kind: "row"; index: number } => a.kind === "row")?.index ?? 0;
  let rowSel: { field: string; shift: number } | null | undefined;
  try {
    const saved = JSON.parse(localStorage.getItem("aa-fitast-rowsel") ?? "null") as { field?: string; shift?: number } | null;
    if (saved?.field) rowSel = { field: saved.field, shift: Number(saved.shift) || 0 };
  } catch {
    rowSel = undefined;
  }
  const probeRow = async (): Promise<{ field: string; shift: number } | null> => {
    if (rowSel !== undefined) return rowSel;
    rowSel = null;
    const cl = (base.form?.buttons ?? []).find((b) => /classific/i.test(b.label) && !/squadr|general/i.test(b.label));
    const g2 = findGare(base).find((g) => g.id && rowIdx(g) > 1);
    if (!cl || !g2) return null;
    for (const f of rowFields(base)) {
      for (const shift of [0, -1]) {
        if (opts.stop()) return null;
        const t = await read(pressReq(base, cl, { ...choose, [f]: String(rowIdx(g2) + shift), ...selOf(base, f) }, "Riga dell'elenco"));
        if (t && garaIdOf(t) === g2.id) {
          rowSel = { field: f, shift };
          try {
            localStorage.setItem("aa-fitast-rowsel", JSON.stringify(rowSel));
          } catch {
            /* niente */
          }
          return rowSel;
        }
      }
    }
    return null;
  };
  /** le tendine della pagina delle piazzole: Piazzola (una alla volta), Turno, e il pulsante CERCA */
  const pzControls = (p: FitastPage) => {
    const form = p.form;
    if (!form) return null;
    const sels = form.selects;
    const numeric = (x: (typeof sels)[number]) => x.options.filter((o) => isNum(o.text)).length;
    const turn = sels.find((x) => /turn/i.test(x.label)) ?? null;
    const pz =
      sels.find((x) => /piazz|paglion|bersagl/i.test(x.label)) ??
      sels.filter((x) => x !== turn && !/categ|tipolog|classe|divisi|arco|sesso/i.test(x.label) && numeric(x) >= 3 && numeric(x) >= x.options.length * 0.6).sort((a, b) => numeric(b) - numeric(a))[0] ??
      null;
    const input = pz ? null : (form.inputs ?? []).find((x) => /piazz/i.test(x.label)) ?? null;
    const btn = form.buttons.find((b) => FILTER_BUTTON.test(b.label.trim())) ?? null;
    const now: Record<string, string> = Object.fromEntries(sels.map((x) => [x.name, (x.options.find((o) => o.selected) ?? x.options[0])?.value ?? ""]));
    return { pz, turn, input, btn, now, sels };
  };
  // una piazzola alla volta solo per le gare più vicine: le due appena fatte e le prossime tre
  const pzDeep = { past: 0, next: 0 };
  /**
   * Tutte le piazzole di una gara dalla sua pagina: quelle già mostrate, poi «tutte» se il portale lo permette,
   * altrimenti una piazzola alla volta con CERCA (come si fa a mano), e per ogni turno.
   */
  const pzHarvest = async (id: string, p0: FitastPage, day: string): Promise<RankRow[]> => {
    const got = new Map<string, RankRow>();
    const add = (rows: RankRow[]) => {
      for (const r of rows) got.set(`${r.place}|${r.name}`, r);
    };
    const places = () => new Set([...got.values()].map((r) => r.place)).size;
    add(piazzoleRows(p0));
    const c = pzControls(p0);
    if (!c || !c.btn || (!c.pz && !c.input)) {
      if (!got.size && pzStats.seen.length < 3) {
        const sels = (p0.form?.selects ?? []).map((x) => `${x.label || x.name} (${x.options.length})`).join(", ");
        pzStats.seen.push(`${PZ_PAGE}?P1=${id} → tendine: ${sels || "nessuna"} · CERCA ${c?.btn ? "sì" : "no"}`);
      }
      return [...got.values()];
    }
    // già tutte (più piazzole nella stessa pagina): basta
    if (places() >= 2) return [...got.values()];
    const btn = c.btn;
    // il numero della gara deve restare nell'invio: senza P1 il portale riapre la sua gara predefinita
    const withP1 = (u: string) => (/[?&]P1=/i.test(u) ? u : `${u}${u.includes("?") ? "&" : "?"}P1=${id}`);
    const targets = [...new Set([withP1(p0.url), withP1(p0.form?.action || p0.url)])];
    let how = -1;
    // la tabella dei nomi (WEBDEV), per chiederne le righe come fa il browser
    const tAlias = p0.wdAliases?.[0] || /DeclareChamp (\w+):WDTable/.exec((p0.diag ?? []).join(" "))?.[1] || "";
    const baseLines = new Set(p0.lines.map((l) => l.trim()));
    const tried: string[] = [];
    /** i nomi comparsi dopo CERCA (righe di testo che la pagina vuota non aveva), se nessuna tabella li dà */
    const newNames = (q: FitastPage, pzNum: number) => {
      const fresh = q.lines.map((l) => l.trim()).filter((l) => l && !baseLines.has(l));
      const out: RankRow[] = [];
      fresh.forEach((l, i) => {
        const nm = cleanPz(l);
        if (!/^[\p{L}'’.\- ]{5,60}$/u.test(nm) || nm.split(/\s+/).length < 2 || /arcier|compagn|societ|gruppo|club|piazzol|categor|tipolog|turno|cerca|indietro|elenco/i.test(nm)) return;
        const next = fresh[i + 1] ?? "";
        out.push({ place: pzNum, name: nm, team: /arcier|compagn|a\.?s\.?d|societ|club|sagittar|frecc|tiro/i.test(next) ? next : "", score: null, camp: null });
      });
      return out.length >= 2 ? out.slice(0, 40) : [];
    };
    const rowsOf = (q: FitastPage, pzNum: number | null) => {
      let rows = piazzoleRows(q);
      if (!rows.length) rows = smartPiazzoleRows(q, pzNum);
      // la pagina di una sola piazzola a volte non ripete il numero: si prende quello scelto
      if (!rows.length && pzNum != null) rows = namesOnly(q).map((r) => ({ ...r, place: pzNum }));
      if (!rows.length && pzNum != null) rows = newNames(q, pzNum);
      return rows;
    };
    const press = async (choose: Record<string, string>, label: string, pzNum: number | null = null) => {
      if (opts.stop()) return 0;
      // la prima volta si provano i modi di inviare (indirizzo con P1, azione del modulo con P1): poi si tiene quello buono
      const ways = how >= 0 ? [how] : [...targets.map((_, k) => k), ...(tAlias ? [targets.length] : [])];
      for (const k of ways) {
        let r = pressReq(p0, btn, { ...c.now, ...choose, P1: id }, label);
        if (!r) return 0;
        if (k < targets.length) r.url = targets[k];
        else {
          // come la tabella AJAX del browser: le righe chieste alla pagina con i filtri scelti (pagine AWP senza sessione)
          const fields: Record<string, string> = { ...(p0.form?.fields ?? {}), ...c.now, ...choose, P1: id, WD_ACTION_: "AJAXEXECUTE", LIGNESTABLE: tAlias, "0": "100" };
          delete fields.WD_BUTTON_CLICK_;
          r = { url: targets[0], post: { fields, charset: p0.charset }, referer: p0.url, label };
        }
        const q = await read(r);
        if (!q) continue;
        const shown = pzGaraOf(q);
        const rows = shown && shown !== id ? [] : rowsOf(q, pzNum);
        if (tried.length < 2 && how < 0) {
          const tabs = q.tables.slice(0, 3).map((t) => `${t.rows.length}r:${t.rows[0]?.map((x) => x.text.slice(0, 10)).join("/") ?? ""}|${t.rows[1]?.map((x) => x.text.slice(0, 12)).join("/") ?? ""}`).join(" ; ");
          const fresh = q.lines.map((l) => l.trim()).filter((l) => l && !baseLines.has(l)).slice(0, 5).map((l) => l.slice(0, 30)).join(" / ");
          tried.push(`${k < targets.length ? `CERCA ${k + 1} (${targets[k].split("/").pop()?.slice(0, 34)})` : `AJAX ${tAlias}`} → gara ${shown || "?"} · ${rows.length} nomi · tabelle ${tabs || "nessuna"} · testo nuovo: ${fresh || "nessuno"} · ${(q.diag ?? []).join(" · ").slice(0, 400)}`);
        }
        if (rows.length) {
          how = k;
          add(rows);
          return rows.length;
        }
      }
      return 0;
    };
    // turni: «tutti» se c'è, altrimenti ognuno (di solito 1 o 2)
    const tAll = c.turn?.options.find((o) => isAll(o.text));
    const tNums = c.turn ? c.turn.options.filter((o) => isNum(o.text)).slice(0, 3).map((o) => o.value) : [];
    const turns = tAll ? [tAll.value] : tNums.length ? tNums : [""];
    const turnSet = (v: string) => (c.turn && v !== "" ? { [c.turn.name]: v } : c.turn ? { [c.turn.name]: c.now[c.turn.name] ?? "" } : {});
    // prima «tutte le piazzole», se la tendina lo offre
    const all = c.pz?.options.find((o) => isAll(o.text));
    if (c.pz && all) {
      for (const t of turns) await press({ [c.pz.name]: all.value, ...turnSet(t) }, `${step} · tutte`);
      if (places() >= 2) return [...got.values()];
    }
    // poi una alla volta: solo per poche gare (le più vicine), le pagine lette hanno un limite
    const future = Boolean(day) && day > today;
    if (future ? pzDeep.next >= 3 : pzDeep.past >= 2) return [...got.values()];
    if (future) pzDeep.next++;
    else pzDeep.past++;
    let spent = 0;
    const values = c.pz ? c.pz.options.filter((o) => isNum(o.text)).map((o) => ({ v: o.value, t: o.text.trim() })) : Array.from({ length: 40 }, (_, k) => ({ v: String(k + 1), t: String(k + 1) }));
    for (const [ti, t] of turns.entries()) {
      let empty = 0;
      let found = 0;
      for (const o of values) {
        if (opts.stop() || spent >= PZ_MAX || pages >= MAX_PAGES) break;
        spent++;
        const field = c.pz ? c.pz.name : c.input!.name;
        const n = await press({ [field]: o.v, ...turnSet(t) }, `${step} · piazzola ${o.t}${turns.length > 1 ? ` · turno ${ti + 1}` : ""}`, Number(/\d+/.exec(o.t)?.[0] ?? NaN) || null);
        found += n;
        empty = n ? 0 : empty + 1;
        // a mano (campo di testo) ci si ferma dopo tre piazzole vuote di fila; un secondo turno vuoto non si gira tutto
        if (!c.pz && empty >= 3 && got.size) break;
        if (ti > 0 && !found && empty >= 3) break;
      }
    }
    if (!got.size && pzStats.seen.length < 4) pzStats.seen.push(`${PZ_PAGE}?P1=${id} → ${spent} piazzole provate con CERCA, nessun nome · tendine ${c.sels.map((x) => `${x.label || x.name}=${x.name}(${x.options.length})`).join(", ")} · CERCA=${btn.code} · ${tried.join(" | ")} · pagina: ${(p0.diag ?? []).join(" · ").slice(0, 500)}`);
    return [...got.values()];
  };
  const piazzole = async (id: string, gara: { id: string; title: string; day: string }, referer: string, g?: Gara, page?: FitastPage | null) => {
    if (opts.stop()) return;
    step = `${gara.title || "Gara"} · piazzole`;
    pzStats.tried++;
    const reqs: Req[] = [];
    // la pagina delle piazzole della gara, per numero: quella del portale, poi quella che ha funzionato l'ultima
    // volta e quelle nominate dal portale (pagina iniziale, campionato, pagina della gara)
    const names = [...new Set([PZ_PAGE, pzName, ...(home.awp ?? []), ...(base.awp ?? []), ...(page?.awp ?? [])].filter((x) => x && /piazz/i.test(x)))];
    for (const name of names.slice(0, 4)) reqs.push({ url: new URL(`${name}?P1=${id}`, FITAST_HOME).toString(), referer, label: step });
    for (const ref of (page?.refs ?? []).filter((x) => /piazz/i.test(x)).slice(0, 2)) reqs.push({ url: ref, referer, label: step });
    for (const l of (page?.links ?? []).filter((x) => /piazz/i.test(`${x.text} ${x.href}`) && x.href).slice(0, 2)) reqs.push({ url: l.href, referer, label: step });
    // il pulsante PIAZZOLE della pagina della gara (si preme lì, la gara è già scelta)
    const garaBtn = (page?.form?.buttons ?? []).find((b) => /piazzol/i.test(b.label));
    if (page && garaBtn) {
      const r = pressReq(page, garaBtn, {}, step);
      if (r) reqs.push(r);
    }
    // la gara scelta come riga dell'elenco (come toccarla), poi PIAZZOLE: il modo che si usa a mano
    if (pzBtn && g && rowIdx(g)) {
      const sel = await probeRow();
      if (sel) {
        const r = pressReq(base, pzBtn, { ...choose, [sel.field]: String(rowIdx(g) + sel.shift), ...selOf(base, sel.field) }, step);
        if (r) reqs.push(r);
      }
      const row = g.alts.find((a) => a.kind === "row" && a.alias);
      if (row && row.kind === "row" && row.alias && row.alias !== sel?.field) {
        const r = pressReq(base, pzBtn, { ...choose, [row.alias]: String(row.index), ...selOf(base, row.alias) }, step);
        if (r) reqs.push(r);
      }
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
    const other = new Set<string>();
    for (const r of reqs) {
      if (opts.stop()) return;
      const k = `${r.url}|${JSON.stringify(r.post ?? "")}`;
      if (done.has(k)) continue;
      done.add(k);
      const p = await read(r);
      if (!p) continue;
      // la pagina di un'altra gara (es. premendo PIAZZOLE sull'elenco si apre la gara sbagliata): si scarta
      const shown = pzGaraOf(p);
      if (shown && shown !== id) {
        other.add(shown);
        continue;
      }
      const rows = /piazz/i.test(`${p.url} ${p.title}`) ? await pzHarvest(id, p, gara.day) : piazzoleRows(p);
      if (!rows.length) {
        // com'è fatta la pagina (solo titoli delle colonne e conteggi), per capire cosa manca
        const heads = p.tables.slice(0, 3).map((t) => `${t.rows.length}r:${t.rows[0]?.map((c) => c.text.slice(0, 14)).join("/") ?? ""}`).join(" ; ");
        const file = p.url.split("/").pop()?.slice(0, 40) ?? "";
        // una volta sola per pagina: titolo, prime righe di testo, pulsanti e struttura, per capire dove sono i nomi
        if (pzStats.seen.length < 3 && !pzStats.seen.some((x) => x.startsWith(`${file} `))) {
          const sample = p.lines.filter((l) => l.trim().length > 2).slice(0, 6).map((l) => l.slice(0, 34)).join(" / ");
          const btns = (p.form?.buttons ?? []).map((b) => b.label).filter(Boolean).slice(0, 6).join("/");
          pzStats.seen.push(`${file} ${r.post ? "(premuto) " : ""}→ ${heads || "nessuna tabella"} · titolo «${(p.title || "").slice(0, 30)}» · testo: ${sample || "vuoto"}${btns ? ` · pulsanti: ${btns}` : ""}${p.redirect ? ` · rimanda a ${p.redirect.split("/").pop()?.slice(0, 40)}` : ""} · ${(p.diag ?? []).slice(0, 2).join(" · ")}`);
        }
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
      await flush();
      return;
    }
    if (other.size && pzStats.seen.length < 3) pzStats.seen.push(`gara ${id}: il portale ha aperto ${[...other].join(", ")} (scartata)`);
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
  // l'ultimo esito delle piazzole resta: la gara lo mostra quando «Con te in piazzola» è vuoto
  try {
    if (note) localStorage.setItem("aa-fitast-pz-note", JSON.stringify({ at: new Date().toISOString(), note, pzBtn: Boolean(pzBtn), rowSel: rowSel ?? null }));
  } catch {
    /* niente */
  }
  report({ done: true, ...(note ? { note } : {}) });
}
