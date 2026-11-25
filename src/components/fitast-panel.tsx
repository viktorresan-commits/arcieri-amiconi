import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, ErrorNote, Field, Loading, Select, TextInput, cx } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { saveEntry } from "@/lib/arcieri/club.api";
import { FITAST_HOME, fitastRead } from "@/lib/arcieri/fitast.api";
import { pressFields, type FitastCell, type FitastPage, type FitastTable } from "@/lib/arcieri/fitast-parse";
import { findGare, garaIdOf, garaTitleOf, rowFields, seasonRange, seasonSelect, type Gara } from "@/lib/arcieri/fitast-gare";
import { openExternal } from "@/lib/arcieri/native";

type Lane = { n: number; score: number; arrows: number[]; label: string; distanceM: number | null; note: string; aimAngle: string };
type Entry = { userId: string; score: number | null; rank: number | null; laneCount: number | null; spot: number | null; championshipPoints: number | null; targetKind: "" | "padiglione" | "sagoma"; sagomaMax: 11 | 10 | 8 | null; category: string; piazzole: Lane[] };
type Comp = { id: number; name: string; startsOn: string; notes?: string; entries: Entry[] };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const rowText = (r: FitastCell[]) => r.map((c) => c.text).join(" ");
const GROUP = /piazz|turn|grupp|paglion|bersagl|squadr|linea/i;
const sameSite = (href: string) => href.includes("89.46.73.21/FITAST_WEB/");

/** il nome cercato sta nella riga: tutte le parole, in qualsiasi ordine (COGNOME Nome o Nome Cognome) */
function hits(text: string, q: string) {
  const words = norm(q).split(" ").filter((w) => w.length > 1);
  if (!words.length) return false;
  const t = norm(text);
  if (words.every((w) => t.includes(w))) return true;
  // classifiche con il nome puntato ("TORRESAN V."): basta il cognome intero e l'iniziale del nome
  if (words.length < 2) return false;
  const toks = t.split(/[\s,;]+/);
  let full = 0;
  for (const w of words) {
    if (toks.includes(w)) full++;
    else if (!toks.some((x) => x === `${w[0]}.` || x === w[0])) return false;
  }
  return full >= 1;
}

function codeOf(c: Comp) {
  return (c.notes ?? "").match(/^fitast:(\d+)/)?.[1] ?? "";
}

/** una richiesta al portale: una pagina, oppure un comando premuto (modulo rimandato) */
type Req = { url: string; post?: { fields: Record<string, string>; charset: string }; referer?: string; label?: string; filtered?: boolean; thenClassifica?: boolean };
type Page = FitastPage & { cookie: string };
type Match = { page: FitastPage; req: Req; table: FitastTable | null; index: number; line?: string };

const KEY_BUTTON = /piazz|classific|generale|campionat|iscritt|risultat|elenco|partecip|turn/i;
/** pulsante che applica i filtri di una classifica (Categoria, Tipologia… e poi CERCA) */
const FILTER_BUTTON = /^(cerca|filtra|aggiorna|visualizza|mostra|applica|ok|vai)\b/i;
/** tendine di una classifica da provare tutte: categoria, tipologia, classe, divisione, arco */
const FILTER_SELECT = /categ|tipolog|classe|divisi|arco|stile|sesso|special|tipo/i;
/** tendine da non girare dentro una classifica: la gara e la stagione sono già scelte */
const FIXED_SELECT = /gara|campionat|stagion|anno|data|evento/i;

type Combo = { req: Req; texts: string[] };
/** le tendine-filtro di una classifica (Categoria, Tipologia…), al massimo due */
function filterSelects(page: FitastPage) {
  return (page.form?.selects ?? [])
    .filter((x) => x.options.length >= 2 && x.options.length <= 80 && !FIXED_SELECT.test(`${x.label} ${x.name}`))
    .sort((a, b) => Number(FILTER_SELECT.test(b.label)) - Number(FILTER_SELECT.test(a.label)))
    .slice(0, 2);
}
/** le scelte attuali dei filtri della pagina (es. MESSERE · TRADIZIONALE) */
const currentTexts = (page: FitastPage) => filterSelects(page).map((x) => (x.options.find((o) => o.selected) ?? x.options[0]).text.trim());

/**
 * Le classifiche del portale mostrano una categoria alla volta (Categoria MESSERE, Tipologia
 * TRADIZIONALE… e CERCA): ogni combinazione diventa un comando CERCA da premere.
 */
function filterCombos(page: FitastPage, r: Req): Combo[] {
  const form = page.form;
  if (!form) return [];
  const ranked = filterSelects(page);
  if (!ranked.length) return [];
  const btn = form.buttons.find((b) => FILTER_BUTTON.test(b.label.trim()));
  // solo pagine che sono davvero classifiche con filtri: pulsante CERCA o tendine come Categoria
  if (!btn && !ranked.some((x) => FILTER_SELECT.test(x.label))) return [];
  const press = btn ? { code: btn.code, set: btn.set } : (ranked.find((x) => x.press)?.press ?? null);
  if (!press) return [];
  const base: Record<string, string> = Object.fromEntries(form.selects.map((x) => [x.name, (x.options.find((o) => o.selected) ?? x.options[0]).value]));
  let combos: { choose: Record<string, string>; texts: string[] }[] = [{ choose: {}, texts: [] }];
  for (const x of ranked) {
    const next: typeof combos = [];
    for (const c of combos) for (const o of x.options) if (o.value !== "" || o.text.trim()) next.push({ choose: { ...c.choose, [x.name]: o.value }, texts: [...c.texts, o.text.trim()] });
    combos = next;
  }
  const now = currentTexts(page).map(norm).join("|");
  return combos
    .filter((c) => c.texts.map(norm).join("|") !== now)
    .slice(0, 200)
    .flatMap((c) => {
      const q = pressReq(page, press, { ...base, ...c.choose }, `${r.label ? `${r.label} · ` : ""}${c.texts.join(" · ")}`);
      return q ? [{ req: { ...q, filtered: true }, texts: c.texts }] : [];
    });
}

/**
 * In che ordine provare i filtri: quelli dove il nome è già comparso in questa ricerca e poi i vicini
 * (stessa categoria o stessa tipologia) e basta; altrimenti tutti, prima quelli già visti in passato
 * e quelli che somigliano alla categoria dell'arciere nel calendario.
 */
function orderCombos(all: Combo[], confirmed: string[][], hints: string[][], preferred: string[]) {
  const key = (t: string[]) => t.map(norm).join("|");
  const pref = preferred.map(norm).filter(Boolean);
  const pscore = (c: Combo) => c.texts.reduce((n, t) => n + (pref.some((p) => norm(t).includes(p) || p.includes(norm(t))) ? 1 : 0), 0);
  const isIn = (c: Combo, list: string[][]) => list.some((k) => key(k) === key(c.texts));
  const near = (c: Combo, list: string[][]) => list.some((k) => c.texts.some((t) => k.map(norm).includes(norm(t))));
  if (confirmed.length) {
    return [...all.filter((c) => isIn(c, confirmed)), ...all.filter((c) => !isIn(c, confirmed) && near(c, confirmed)).sort((a, b) => pscore(b) - pscore(a)).slice(0, 10)];
  }
  return [...all].sort((a, b) => Number(isIn(b, hints)) - Number(isIn(a, hints)) || Number(near(b, hints)) - Number(near(a, hints)) || pscore(b) - pscore(a));
}

const COMBO_KEY = "aa-fitast-filtri";
function loadCombos(): string[][] {
  try {
    const v = JSON.parse(localStorage.getItem(COMBO_KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string[] => Array.isArray(x) && x.every((t) => typeof t === "string")).slice(0, 4) : [];
  } catch {
    return [];
  }
}
function saveCombos(list: string[][]) {
  try {
    localStorage.setItem(COMBO_KEY, JSON.stringify(list.slice(0, 4)));
  } catch {
    /* memoria del browser non disponibile */
  }
}

const WINDOW_DAYS = 360;
const MAX_PAGES = 900;
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDay = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
const rowsOf = (p: FitastPage) => p.tables.reduce((n, t) => n + Math.max(0, t.rows.length - 1), 0);
/** una gara letta durante la ricerca: cosa si è aperto e cosa si è trovato */
type Step = { id: string; date: string | null; title: string; pages: number; rows: number; found: number; note: string };

const reqKey = (r: Req) => `${r.url}|${r.post ? JSON.stringify(r.post.fields) : ""}|${r.label ?? ""}`;

/** il comando premuto come richiesta: campi del modulo, scelte nelle tendine e alias WEBDEV */
function pressReq(page: FitastPage, b: { code: string; set: Record<string, string> }, choose: Record<string, string>, label: string): Req | null {
  if (!page.form) return null;
  return { url: page.form.action || page.url, post: { fields: pressFields(page.form, b.code, b.set, choose), charset: page.charset }, referer: page.url, label };
}

/** la tendina con più voci è di solito l'elenco delle gare */
function garaSelect(page: FitastPage) {
  return [...(page.form?.selects ?? [])].filter((x) => x.options.length >= 2).sort((a, b) => b.options.length - a.options.length)[0] ?? null;
}

/**
 * Portale FITAST dentro l'app: si sfoglia il calendario, si cerca il proprio nome nelle pagine delle
 * gare (iscritti, piazzole, classifiche), si vedono i compagni di piazzola e si porta il punteggio
 * nella propria gara del calendario. I pulsanti del portale (PIAZZOLE, CLASSIFICA…) si premono da qui.
 */
export function FitastPanel({ comps, myName, userId, startCode, onSaved, onClose }: { comps: Comp[]; myName: string; userId: string; startCode?: string; onSaved: () => void; onClose?: () => void }) {
  const [req, setReq] = useState<Req>({ url: FITAST_HOME });
  const [back, setBack] = useState<Req[]>([]);
  const [page, setPage] = useState<Page | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState(myName);
  const [found, setFound] = useState<Match[] | null>(null);
  const [scan, setScan] = useState<{ gara: number; label: string; pages: number } | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [extra, setExtra] = useState<{ text: string; req: Req; squadre: boolean }[]>([]);
  const stop = useRef(false);
  const cookie = useRef("");
  // il campo che sceglie la riga dell'elenco gare, quando la ricerca l'ha scoperto
  const rowFieldRef = useRef<string | null>(null);

  const read = async (r: Req) => {
    const p = await fitastRead({ data: { url: r.url, post: r.post, referer: r.referer, cookie: cookie.current } });
    if (p.cookie) cookie.current = p.cookie;
    return p;
  };

  const go = (next: Req, push = true) => {
    if (push && page) setBack((b) => [...b, req]);
    setReq(next);
  };
  const open = (url: string) => go({ url, referer: page?.url });

  useEffect(() => {
    let off = false;
    setBusy(true);
    setErr("");
    read(req)
      .then((p) => {
        if (off) return;
        setPage(p);
        // riga di gara toccata: il portale la sceglie e risponde con la stessa pagina, si apre la classifica
        if (req.thenClassifica) {
          const b = p.form?.buttons.find((x) => /classific/i.test(x.label) && !/squadr/i.test(x.label));
          const r = b ? pressReq(p, b, {}, req.label ? `${req.label} · Classifica` : "Classifica") : null;
          if (r) go(r, false);
          return;
        }
        // aperto da una gara del calendario: si va dritti alla sua pagina, se il calendario la collega
        if (startCode && req.url === FITAST_HOME && !req.post) {
          const re = new RegExp(`(^|\\D)${startCode}(\\D|$)`);
          const l = p.links.find((x) => re.test(x.href));
          if (l) go({ url: l.href, referer: p.url });
          else {
            const sel = garaSelect(p);
            const opt = sel?.options.find((o) => re.test(o.value) || re.test(o.text));
            if (sel && opt) {
              if (sel.press) {
                const r = pressReq(p, sel.press, { [sel.name]: opt.value }, opt.text);
                if (r) go(r);
              }
            }
          }
        }
      })
      .catch((e: unknown) => !off && setErr(e instanceof Error ? e.message : "Portale FITAST non raggiungibile."))
      .finally(() => !off && setBusy(false));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  /**
   * Cerca il nome gara per gara, dalla più recente all'indietro fino a 360 giorni fa: per ogni stagione
   * del portale (la più recente per prima) si riconoscono le gare con la data, si apre la classifica di
   * ciascuna e se ne provano i filtri (Categoria, Tipologia) finché il nome compare.
   */
  async function searchAll() {
    if (!q.trim()) return;
    stop.current = false;
    setFound([]);
    setErr("");
    setSteps([]);
    setExtra([]);
    const todayIso = isoDay(new Date());
    const from = isoDay(new Date(Date.now() - WINDOW_DAYS * 86_400_000));
    const out: Match[] = [];
    const hitKeys = new Set<string>();
    const log: Step[] = [];
    let pages = 0;
    let garaN = 0;
    let label = "";
    const show = () => setScan({ gara: garaN, label, pages });
    show();
    const get = async (r: Req | null) => {
      if (!r || stop.current || pages >= MAX_PAGES) return null;
      pages++;
      show();
      try {
        return await read(r);
      } catch {
        return null;
      }
    };
    // categoria dell'arciere (dalle sue gare nel calendario) e filtri dove il nome è comparso le altre volte
    const preferred = [...new Set(comps.flatMap((c) => c.entries.filter((e) => e.userId === userId).map((e) => e.category)).filter(Boolean))];
    const hints = loadCombos();
    const confirmed: string[][] = [];
    const calendar = new Map(comps.map((c) => [codeOf(c), c.startsOn.slice(0, 10)] as const).filter(([k]) => k));

    /** righe con il nome nella pagina: quante nuove */
    const take = (p: FitastPage, r: Req, texts: string[]) => {
      let n = 0;
      let inTables = false;
      for (const t of p.tables) {
        t.rows.forEach((row, i) => {
          const key = `${r.label ?? p.title}|${rowText(row)}`;
          if (i && hits(rowText(row), q)) {
            inTables = true;
            if (!hitKeys.has(key)) {
              hitKeys.add(key);
              out.push({ page: p, req: r, table: t, index: i });
              n++;
            }
          }
        });
      }
      // pagine senza tabelle (zone ripetute WEBDEV): si cerca nelle righe di testo
      if (!inTables) {
        for (const line of p.lines) {
          const key = `${r.label ?? p.title}|${line}`;
          if (line.length < 400 && hits(line, q) && !hitKeys.has(key)) {
            hitKeys.add(key);
            out.push({ page: p, req: r, table: null, index: -1, line });
            n++;
          }
        }
      }
      if (n) {
        setFound([...out]);
        if (texts.length && !confirmed.some((c) => c.join("|") === texts.join("|"))) {
          confirmed.push(texts);
          saveCombos([texts, ...hints.filter((h) => h.join("|") !== texts.join("|"))]);
        }
      }
      return n;
    };

    const home = await get({ url: FITAST_HOME });
    if (!home) throw new Error("Portale FITAST non raggiungibile.");
    // classifiche a pulsante (anche squadre), da aprire a mano per la stagione scelta in tendina
    const ss = seasonSelect(home);
    const rankings: { text: string; req: Req; squadre: boolean }[] = [];
    for (const b of (home.form?.buttons ?? []).filter((x) => /classific|generale|campionat/i.test(x.label))) {
      const r = pressReq(home, b, {}, b.label);
      const st = ss ? (ss.options.find((o) => o.selected) ?? ss.options[0]).text : "";
      if (r) rankings.push({ text: [b.label, st].filter(Boolean).join(" · "), req: r, squadre: /squadr/i.test(b.label) });
    }
    setExtra(rankings);

    // stagioni dalla più recente; solo quelle che toccano gli ultimi 360 giorni
    type Season = { value: string | null; text: string; range: { from: string; to: string } | null };
    let seasons: Season[] = [{ value: null, text: "", range: null }];
    if (ss) {
      const all: Season[] = ss.options.map((o) => ({ value: o.value, text: o.text, range: seasonRange(o.text) ?? seasonRange(o.value) }));
      const dated = all.filter((x) => x.range && x.range.to >= from && x.range.from <= todayIso).sort((a, b) => (b.range?.to ?? "").localeCompare(a.range?.to ?? ""));
      const sel = all.find((x) => x.value === (ss.options.find((o) => o.selected) ?? ss.options[0]).value);
      seasons = dated.length ? dated : sel ? [sel, ...all.filter((x) => x !== sel).slice(0, 1)] : all.slice(0, 2);
    }

    const seenIds = new Set<string>();
    let rowField: string | null | undefined;
    const probe: { last: { id: string; p: FitastPage; r: Req } | null } = { last: null };
    const btnOf = (p: FitastPage) => p.form?.buttons.find((b) => /classific/i.test(b.label) && !/squadr/i.test(b.label)) ?? null;
    const pzOf = (p: FitastPage) => p.form?.buttons.find((b) => /piazzol/i.test(b.label)) ?? null;
    const isClassifica = (p: FitastPage) => Boolean(p.form?.selects.some((x) => FILTER_SELECT.test(x.label))) && !btnOf(p);
    const short = (t: string) => t.split(" - ").pop()?.trim() ?? t;

    for (const season of seasons) {
      if (stop.current || pages >= MAX_PAGES) break;
      const choose: Record<string, string> = {};
      /** la pagina della stagione, riletta da capo prima di ogni gara (come tornare INDIETRO nel portale) */
      const seasonPage = async (): Promise<FitastPage | null> => {
        const h = await get({ url: FITAST_HOME });
        if (!h) return null;
        const s2 = seasonSelect(h);
        if (!s2 || season.value == null) return h;
        choose[s2.name] = season.value;
        const selected = (s2.options.find((o) => o.selected) ?? s2.options[0]).value;
        if (selected === season.value || !s2.press) return h;
        return (await get(pressReq(h, s2.press, { [s2.name]: season.value }, season.text))) ?? h;
      };
      let page = await seasonPage();
      if (!page) continue;
      const every: Gara[] = findGare(page).map((g) => ({ ...g, date: g.date ?? calendar.get(g.id) ?? null }));
      // solo le gare già fatte, dalla più recente, fino a 360 giorni fa
      let gare = every.filter((g) => !g.date || (g.date >= from && g.date <= todayIso));
      if (!gare.length && every.some((g) => g.date)) continue;
      if (!gare.length) gare = [{ id: "", date: null, title: season.text ? short(season.text) : "Gara scelta nel portale", alts: [{ kind: "current" }] }];

      // il campo nascosto che sceglie la riga di un elenco: lo si cerca una volta (vale per tutte le stagioni)
      const idx = (g: Gara) => g.alts.find((a): a is { kind: "row"; index: number } => a.kind === "row")?.index ?? 0;
      const probeRow = async (p: FitastPage): Promise<string | null> => {
        const btn = btnOf(p);
        const g2 = every.find((g) => g.id && idx(g) > 1);
        if (!btn || !g2) return null;
        for (const f of rowFields(p)) {
          const r = pressReq(p, btn, { ...choose, [f]: String(idx(g2)) }, "prova");
          const t = await get(r);
          if (t && r && garaIdOf(t) === g2.id) {
            probe.last = { id: g2.id, p: t, r };
            return f;
          }
        }
        return null;
      };

      for (let gi = 0; gi < gare.length; gi++) {
        const g = gare[gi];
        if (stop.current || pages >= MAX_PAGES) break;
        if (g.id && seenIds.has(g.id)) continue;
        if (gi > 0) page = (await seasonPage()) ?? page;
        if (!page) break;
        const base: FitastPage = page;
        garaN++;
        label = [fmtDay(g.date), g.title || (g.id ? `gara ${g.id}` : "")].filter(Boolean).join(" · ");
        const step: Step = { id: g.id, date: g.date, title: g.title, pages: 0, rows: 0, found: 0, note: "" };
        log.push(step);
        setSteps([...log]);
        const startPages = pages;
        const lbl = (what: string) => [fmtDay(g.date), g.id, g.title || short(season.text), what].filter(Boolean).join(" · ");
        const wrong = (p: FitastPage) => {
          const id = garaIdOf(p);
          return Boolean(g.id && id && id !== g.id);
        };

        // si apre la classifica della gara, nel primo modo che funziona
        let opened: { p: FitastPage; r: Req; via: { page: FitastPage; choose: Record<string, string> } } | null = null;
        for (const how of g.alts) {
          if (stop.current) break;
          const btn = btnOf(base);
          let via = { page: base, choose: { ...choose } };
          let r: Req | null = null;
          if (how.kind === "href" || how.kind === "press") {
            const r0 = how.kind === "href" ? { url: how.href, referer: base.url, label: lbl("") } : pressReq(base, how.press, choose, lbl(""));
            const p0 = await get(r0);
            if (!p0 || !r0) continue;
            if (isClassifica(p0)) {
              if (wrong(p0)) continue;
              opened = { p: p0, r: r0, via };
              break;
            }
            const b2 = btnOf(p0);
            if (b2) {
              via = { page: p0, choose: {} };
              r = pressReq(p0, b2, {}, lbl("Classifica"));
            } else if (btn) r = pressReq(base, btn, choose, lbl("Classifica"));
          } else if (how.kind === "option" || how.kind === "input" || how.kind === "row") {
            let field = "";
            let value = "";
            if (how.kind === "option") [field, value] = [how.select, how.value];
            else if (how.kind === "input") [field, value] = [how.input, g.id];
            else {
              if (!rowField) rowField = await probeRow(base);
              if (!rowField) continue;
              rowFieldRef.current = rowField;
              [field, value] = [rowField, String(how.index)];
            }
            via = { page: base, choose: { ...choose, [field]: value } };
            // la prova del campo ha già aperto proprio questa gara: la si usa
            const pr = probe.last;
            if (how.kind === "row" && pr && pr.id === g.id) {
              opened = { p: pr.p, r: pr.r, via };
              probe.last = null;
              break;
            }
            r = btn ? pressReq(base, btn, via.choose, lbl("Classifica")) : null;
          } else r = btn ? pressReq(base, btn, choose, lbl("Classifica")) : null;
          if (!r) continue;
          const p = await get(r);
          if (!p) continue;
          if (wrong(p)) {
            step.note = `si apre un'altra gara (${garaIdOf(p)})`;
            continue;
          }
          opened = { p, r, via };
          break;
        }
        if (!opened) {
          step.note ||= "classifica non aperta";
          step.pages = pages - startPages;
          setSteps([...log]);
          continue;
        }
        step.note = "";
        const gotId = garaIdOf(opened.p);
        if (!g.id && gotId && seenIds.has(gotId)) {
          step.note = "gara già letta";
          step.pages = pages - startPages;
          setSteps([...log]);
          continue;
        }
        if (gotId) seenIds.add(gotId);
        if (g.id) seenIds.add(g.id);
        step.id ||= gotId;
        step.title = garaTitleOf(opened.p) || step.title;
        label = [fmtDay(g.date), step.title || (step.id ? `gara ${step.id}` : "")].filter(Boolean).join(" · ");
        show();

        let n = take(opened.p, opened.r, currentTexts(opened.p));
        step.rows += rowsOf(opened.p);
        // CLASSIFICA a volte risponde con il PDF
        for (const l of opened.p.links.filter((x) => sameSite(x.href) && /\.pdf($|\?)/i.test(x.href)).slice(0, 2)) {
          if (n) break;
          const pdf = await get({ url: l.href, referer: opened.p.url, label: lbl(l.text || "PDF") });
          if (pdf) {
            step.rows += pdf.lines.length;
            n += take(pdf, { url: l.href, referer: opened.p.url, label: lbl(l.text || "PDF") }, []);
          }
        }
        // poi una categoria alla volta, finché il nome compare
        if (!n) {
          for (const c of orderCombos(filterCombos(opened.p, opened.r), confirmed, hints, preferred)) {
            if (stop.current || pages >= MAX_PAGES) break;
            const p = await get(c.req);
            if (!p) continue;
            step.rows += rowsOf(p);
            n += take(p, c.req, c.texts);
            if (n) break;
          }
        }
        // trovato: anche le piazzole della stessa gara, per i compagni di piazzola
        if (n) {
          const pz = pzOf(opened.via.page);
          const pr = pz ? pressReq(opened.via.page, pz, opened.via.choose, lbl("Piazzole")) : null;
          const pp = await get(pr);
          if (pp && pr) take(pp, pr, []);
        }
        step.found = n;
        step.pages = pages - startPages;
        setSteps([...log]);
      }
    }
    if (pages >= MAX_PAGES) setErr(`Fermato dopo ${MAX_PAGES} pagine lette: riprova con il cognome o apri la gara qui sotto.`);
    setScan(null);
  }

  return (
    <Card className="grid gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#e0b15a]">Portale FITAST</p>
          <p className="font-display text-2xl leading-tight">Gare, piazzole e classifiche</p>
        </div>
        {onClose ? <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.08] text-lg leading-none">×</button> : null}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cognome e nome" aria-label="Nome da cercare" />
        {scan ? <Button variant="ghost" onClick={() => { stop.current = true; }}>Ferma</Button> : <Button onClick={() => void searchAll().catch((e: unknown) => { setScan(null); setErr(e instanceof Error ? e.message : "Ricerca non riuscita."); })} disabled={!q.trim()}>Cerca</Button>}
      </div>
      <p className="-mt-1.5 text-[0.7rem] text-muted">Cerca il nome nelle classifiche delle gare, dalla più recente all'indietro fino a {WINDOW_DAYS} giorni fa.</p>
      {scan ? (
        <p className="text-xs text-muted">
          {scan.gara ? `Gara ${scan.gara}${scan.label ? ` · ${scan.label}` : ""}` : "Leggo l'elenco delle gare"} · {scan.pages} {scan.pages === 1 ? "pagina letta" : "pagine lette"}
        </p>
      ) : null}
      {found ? <Matches found={found} q={q} comps={comps} userId={userId} onSaved={onSaved} onOpen={(r) => go(r)} searching={Boolean(scan)} /> : null}
      {steps.length ? <Steps steps={steps} searching={Boolean(scan)} /> : null}
      {extra.length ? (
        <div className="grid gap-1.5">
          <p className="text-sm font-semibold">Classifiche trovate</p>
          <div className="flex flex-wrap gap-1.5">
            {extra.slice(0, 16).map((l) => <button key={reqKey(l.req)} type="button" className="aa-chip" onClick={() => go(l.req)}>{l.squadre ? "Squadre · " : "Arcieri · "}{l.text.slice(0, 48)}</button>)}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-2">
        {back.length ? <button type="button" className="aa-chip" onClick={() => { const prev = back[back.length - 1]; setBack((b) => b.slice(0, -1)); go(prev, false); }}><Glyph name="chevron" size={12} className="rotate-180" /> Indietro</button> : null}
        {req.url !== FITAST_HOME || req.post ? <button type="button" className="aa-chip" onClick={() => { setBack([]); go({ url: FITAST_HOME }, false); }}>Calendario</button> : null}
        <button type="button" className="aa-chip" onClick={() => void openExternal(req.post ? req.referer || req.url : req.url)}>Apri sul sito</button>
      </div>
      {busy ? <Loading /> : null}
      {err ? <ErrorNote text={err} /> : null}
      {page && !busy ? <PageView page={page} label={req.label} q={q} rowField={rowFieldRef.current} onOpen={open} onGo={(r) => go(r)} /> : null}
    </Card>
  );
}

/** i comandi del portale: la tendina delle gare e i pulsanti (PIAZZOLE, CLASSIFICA arcieri…) */
function Commands({ page, onGo }: { page: FitastPage; onGo: (r: Req) => void }) {
  const form = page.form;
  const [choose, setChoose] = useState<Record<string, string>>(() => Object.fromEntries((form?.selects ?? []).map((x) => [x.name, (x.options.find((o) => o.selected) ?? x.options[0]).value])));
  if (!form || (!form.selects.length && !form.buttons.length)) return null;
  const textOf = (name: string) => form.selects.find((x) => x.name === name)?.options.find((o) => o.value === choose[name])?.text ?? "";
  const sel = garaSelect(page);
  const season = seasonSelect(page);
  const label = (b: string) => [sel ? textOf(sel.name) : "", b].filter(Boolean).join(" · ");
  return (
    <div className="grid gap-2 rounded-2xl bg-white/[0.04] p-3">
      {form.selects.filter((x) => x.options.length >= 2).slice(0, 4).map((x) => (
        <Field key={x.name} label={x === season ? "Campionato" : x.label || "Scegli"}>
          <Select
            value={choose[x.name] ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setChoose((c) => ({ ...c, [x.name]: v }));
              // la tendina che nel portale ricarica la pagina: la si ricarica anche qui
              if (x.press) {
                const r = pressReq(page, x.press, { ...choose, [x.name]: v }, x.options.find((o) => o.value === v)?.text ?? "");
                if (r) onGo(r);
              }
            }}
          >
            {x.options.map((o) => <option key={o.value + o.text} value={o.value}>{o.text || "—"}</option>)}
          </Select>
        </Field>
      ))}
      {form.buttons.length ? (
        <div className="flex flex-wrap gap-1.5">
          {form.buttons.slice(0, 24).map((b) => (
            <button
              key={b.code + b.label + JSON.stringify(b.set)}
              type="button"
              className={cx("aa-chip", KEY_BUTTON.test(b.label) && "border-[#e0b15a]/50 text-[#f1cf8a]")}
              onClick={() => {
                const r = pressReq(page, b, choose, label(b.label));
                if (r) onGo(r);
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** la pagina letta: comandi, tabelle (con il nome evidenziato), testo e collegamenti utili */
function PageView({ page, label, q, rowField, onOpen, onGo }: { page: FitastPage; label?: string; q: string; rowField: string | null; onOpen: (u: string) => void; onGo: (r: Req) => void }) {
  if (page.kind === "pdf") {
    const mine = page.lines.filter((l) => hits(l, q));
    return (
      <div className="grid gap-2 rounded-2xl bg-white/[0.04] p-3">
        <p className="text-sm">{page.lines.length ? `Documento PDF: ${page.lines.length} righe lette${q.trim() ? `, ${mine.length} con «${q.trim()}»` : ""}.` : "Documento PDF senza testo leggibile (forse una scansione): si apre fuori dall'app."}</p>
        {page.lines.length ? (
          <div className="grid max-h-80 gap-1 overflow-y-auto rounded-2xl bg-white/[0.03] p-3 text-sm">
            {page.lines.slice(0, 400).map((l, i) => <p key={i} className={cx(hits(l, q) && "rounded bg-[#e0b15a]/25 px-1")}>{l}</p>)}
          </div>
        ) : null}
        <Button variant="ghost" onClick={() => void openExternal(page.url)}>Apri il PDF</Button>
      </div>
    );
  }
  const useful = page.links.filter((l) => (sameSite(l.href) || /\.pdf/i.test(l.href)) && l.href !== page.url).slice(0, 60);
  const heading = label || (page.title && !/^view_/i.test(page.title) ? page.title : "");
  return (
    <div className="grid gap-3">
      {heading ? <p className="text-sm font-semibold">{heading}</p> : null}
      <Commands key={page.url + page.fetchedAt} page={page} onGo={onGo} />
      <GareList page={page} rowField={rowField} onOpen={onOpen} onGo={onGo} />
      {page.tables.slice(0, 8).map((t, i) => <TableView key={i} t={t} q={q} onOpen={onOpen} onPress={(code) => { const p = JSON.parse(code) as { code: string; set: Record<string, string> }; const r = pressReq(page, p, {}, label ?? ""); if (r) onGo(r); }} />)}
      {!page.tables.length && page.lines.length && !findGare(page).length ? (
        <div className="grid max-h-80 gap-1 overflow-y-auto rounded-2xl bg-white/[0.03] p-3 text-sm">
          {page.lines.slice(0, 300).map((l, i) => <p key={i} className={cx(hits(l, q) && "rounded bg-[#e0b15a]/25 px-1")}>{l}</p>)}
        </div>
      ) : null}
      {useful.length ? (
        <div className="grid gap-1.5">
          <p className="text-xs text-muted">Pagine collegate</p>
          <div className="flex flex-wrap gap-1.5">
            {useful.map((l) => <button key={l.href + l.text} type="button" className="aa-chip max-w-full truncate" onClick={() => onOpen(l.href)}>{l.text.slice(0, 48)}</button>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** le gare della stagione scelta, dalla più recente: un tocco apre la classifica (o la gara) */
function GareList({ page, rowField, onOpen, onGo }: { page: FitastPage; rowField: string | null; onOpen: (u: string) => void; onGo: (r: Req) => void }) {
  const gare = useMemo(() => findGare(page), [page]);
  const [all, setAll] = useState(false);
  if (!gare.length) return null;
  const btn = page.form?.buttons.find((b) => /classific/i.test(b.label) && !/squadr/i.test(b.label)) ?? null;
  const today = isoDay(new Date());
  const action = (g: Gara): (() => void) | null => {
    const lbl = [fmtDay(g.date), g.id, g.title].filter(Boolean).join(" · ");
    for (const a of g.alts) {
      if (a.kind === "href") return () => onOpen(a.href);
      if (a.kind === "press") return () => {
        const r = pressReq(page, a.press, {}, lbl);
        if (r) onGo({ ...r, thenClassifica: true });
      };
      // senza ricerca fatta il campo della riga non è noto: si prova il più probabile (la classifica mostra il nome della gara)
      const field = a.kind === "option" ? a.select : a.kind === "input" ? a.input : a.kind === "row" ? (rowField ?? rowFields(page)[0] ?? null) : null;
      const value = a.kind === "option" ? a.value : a.kind === "input" ? g.id : a.kind === "row" ? String(a.index) : "";
      if (field && btn) return () => {
        const r = pressReq(page, btn, { [field]: value }, `${lbl} · Classifica`);
        if (r) onGo(r);
      };
    }
    return null;
  };
  const shown = all ? gare : gare.slice(0, 12);
  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-semibold">Gare della stagione</p>
      <div className="grid gap-1">
        {shown.map((g, i) => {
          const act = action(g);
          const future = Boolean(g.date && g.date > today);
          return (
            <button key={`${g.id}-${i}`} type="button" disabled={!act} onClick={act ?? undefined} className={cx("flex items-baseline gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-left text-sm", act ? "hover:bg-white/[0.07]" : "cursor-default opacity-70")}>
              <span className="w-[5.2rem] shrink-0 tabular-nums text-muted">{fmtDay(g.date) || "—"}</span>
              <span className="min-w-0 flex-1">
                {g.title || "Gara"}
                {g.id ? <span className="text-muted"> · {g.id}</span> : null}
                {future ? <span className="text-muted"> · da fare</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      {gare.length > 12 ? <button type="button" className="justify-self-start text-xs text-muted underline-offset-2 hover:underline" onClick={() => setAll((x) => !x)}>{all ? "Mostra meno" : `Mostra tutte le ${gare.length} gare`}</button> : null}
    </div>
  );
}

function TableView({ t, q, onOpen, onPress }: { t: FitastTable; q: string; onOpen: (u: string) => void; onPress: (press: string) => void }) {
  const [all, setAll] = useState(false);
  const rows = all ? t.rows : t.rows.slice(0, 40);
  return (
    <div className="grid gap-1">
      <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
        <table className="w-full min-w-max text-left text-[0.76rem]">
          <tbody>
            {rows.map((r, i) => {
              const mine = i > 0 && hits(rowText(r), q);
              const href = r.find((c) => c.href)?.href;
              const press = r.find((c) => c.press)?.press;
              const act = href ? () => onOpen(href) : press ? () => onPress(press) : undefined;
              return (
                <tr key={i} onClick={act} className={cx(i === 0 ? "bg-white/[0.06] font-semibold text-muted" : "border-t border-white/[0.05]", mine && "bg-[#e0b15a]/20", act && "cursor-pointer hover:bg-white/[0.04]")}>
                  {r.map((c, k) => <td key={k} className={cx("px-2 py-1.5 align-top", (c.href || c.press) && "text-[#8cc3f0] underline-offset-2")}>{c.text}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {t.rows.length > 40 ? <button type="button" className="justify-self-start text-xs text-muted underline-offset-2 hover:underline" onClick={() => setAll((x) => !x)}>{all ? "Mostra meno" : `Mostra tutte le ${t.rows.length} righe`}</button> : null}
    </div>
  );
}

/** le gare lette, dalla più recente: cosa si è aperto, quante righe e se il nome c'era */
function Steps({ steps, searching }: { steps: Step[]; searching: boolean }) {
  const dates = steps.map((s) => s.date).filter((d): d is string => Boolean(d)).sort();
  const span = dates.length ? ` dal ${fmtDay(dates[0])} al ${fmtDay(dates[dates.length - 1])}` : "";
  const noRows = !searching && steps.length > 0 && steps.every((s) => !s.rows && !s.found);
  return (
    <details className="rounded-2xl bg-white/[0.03] p-3 text-xs" open={!searching && !steps.some((s) => s.found)}>
      <summary className="cursor-pointer text-muted">
        Gare lette: {steps.length}
        {span}
      </summary>
      <ul className="mt-2 grid gap-1">
        {steps.slice(0, 60).map((s, i) => (
          <li key={i} className={cx("flex gap-2", s.found ? "text-[#f1cf8a]" : "text-muted")}>
            <span className="w-[4.6rem] shrink-0 tabular-nums">{fmtDay(s.date) || "—"}</span>
            <span className="min-w-0 flex-1">
              {s.id ? `${s.id} · ` : ""}
              {s.title.slice(0, 70) || "gara"}
              {" — "}
              {s.found ? `trovato (${s.found} ${s.found === 1 ? "riga" : "righe"})` : s.note || (searching && i === steps.length - 1 ? "in lettura…" : `non in classifica · ${s.rows} righe in ${s.pages} pagine`)}
            </span>
          </li>
        ))}
      </ul>
      {noRows ? <p className="mt-2 text-muted">Le classifiche lette non contengono righe: il portale le carica solo nel browser. Apri la gara qui sotto o sul sito.</p> : null}
    </details>
  );
}

/** dove compare il nome: riga, compagni di piazzola e il punteggio da portare nella gara */
function Matches({ found, q, comps, userId, onSaved, onOpen, searching }: { found: Match[]; q: string; comps: Comp[]; userId: string; onSaved: () => void; onOpen: (r: Req) => void; searching: boolean }) {
  if (!found.length) return <p className="rounded-2xl bg-white/[0.04] p-3 text-sm text-muted">{searching ? "Ancora nessuna riga con questo nome…" : `Nessuna riga con «${q}» nelle gare degli ultimi ${WINDOW_DAYS} giorni. Prova solo il cognome, o apri la gara qui sotto.`}</p>;
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold">Trovato in {found.length} {found.length === 1 ? "riga" : "righe"}</p>
      {found.slice(0, 30).map((m, i) => <MatchCard key={i} m={m} comps={comps} userId={userId} onSaved={onSaved} onOpen={onOpen} />)}
    </div>
  );
}

function MatchCard({ m, comps, userId, onSaved, onOpen }: { m: Match; comps: Comp[]; userId: string; onSaved: () => void; onOpen: (r: Req) => void }) {
  const head: FitastCell[] = m.table ? m.table.rows[0] : [];
  const row: FitastCell[] = m.table ? m.table.rows[m.index] : (m.line ?? "").split(" ").map((text) => ({ text }));
  const g = head.findIndex((c) => GROUP.test(c.text));
  const mates = m.table && g >= 0 && row[g]?.text ? m.table.rows.filter((r, i) => i > 0 && i !== m.index && r[g]?.text === row[g].text) : [];
  const nums = row.map((c, i) => ({ i, v: Number(c.text.replace(",", ".")), label: head[i]?.text || `${m.table ? "colonna" : "numero"} ${i + 1}` })).filter((x) => isNum(row[x.i]) && Number.isFinite(x.v) && x.v >= 0 && x.v < 2000);
  const [save, setSave] = useState(false);
  return (
    <div className="grid gap-2 rounded-2xl border border-[#e0b15a]/30 bg-[#e0b15a]/[0.06] p-3">
      <button type="button" onClick={() => onOpen(m.req)} className="text-left text-xs font-semibold text-[#e0b15a]">{m.req.label || (m.page.title && !/^view_/i.test(m.page.title) ? m.page.title : "Pagina FITAST")} ›</button>
      {m.table ? (
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          {row.map((cell, i) => (cell.text ? <Pair key={i} k={head[i]?.text || "—"} v={cell.text} /> : null))}
        </div>
      ) : (
        <p className="text-sm font-semibold">{m.line}</p>
      )}
      {mates.length ? (
        <div className="rounded-xl bg-black/20 px-3 py-2">
          <p className="text-xs font-semibold">Con te {/squadr/i.test(head[g].text) ? "in squadra" : "in piazzola"} ({head[g].text} {row[g].text})</p>
          <ul className="mt-1 grid gap-0.5 text-xs text-muted">{mates.slice(0, 12).map((r, i) => <li key={i}>{r.filter((_, k) => k !== g).map((c2) => c2.text).filter(Boolean).slice(0, 3).join(" · ")}</li>)}</ul>
        </div>
      ) : null}
      {nums.length ? (save ? <SaveScore nums={nums} row={row} m={m} comps={comps} userId={userId} onDone={() => { setSave(false); onSaved(); }} onCancel={() => setSave(false)} /> : <button type="button" className="aa-chip justify-self-start" onClick={() => setSave(true)}>Porta il punteggio nella mia gara</button>) : null}
    </div>
  );
}

const isNum = (cell: FitastCell | undefined) => Boolean(cell && /^\d+([.,]\d+)?$/.test(cell.text.trim()));

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span className="text-xs text-muted">{k}</span>
      <span className="font-semibold">{v}</span>
    </>
  );
}

/** sceglie la gara del calendario e quali numeri sono punteggio e punti campionato */
function SaveScore({ nums, row, m, comps, userId, onDone, onCancel }: { nums: { i: number; v: number; label: string }[]; row: FitastCell[]; m: Match; comps: Comp[]; userId: string; onDone: () => void; onCancel: () => void }) {
  // la gara giusta: stesso codice nell'indirizzo, oppure la stessa data scritta nella pagina
  const guess = useMemo(() => {
    const text = `${m.page.url} ${m.req.label ?? ""} ${m.page.title} ${m.page.lines.slice(0, 40).join(" ")}`;
    const byCode = comps.find((x) => codeOf(x) && new RegExp(`(^|\\D)${codeOf(x)}(\\D|$)`).test(m.page.url));
    if (byCode) return byCode.id;
    const byDate = comps.find((x) => {
      const [y, mo, d] = x.startsOn.split("-");
      return text.includes(`${d}/${mo}/${y}`) || text.includes(`${Number(d)}/${Number(mo)}/${y}`);
    });
    return byDate?.id ?? 0;
  }, [m, comps]);
  const pick = (re: RegExp) => nums.find((x) => re.test(x.label))?.i ?? -1;
  const [compId, setCompId] = useState(guess);
  const [scoreCol, setScoreCol] = useState(() => { const k = pick(/tot|punt|score/i); return k >= 0 ? k : nums[nums.length - 1].i; });
  const [champCol, setChampCol] = useState(() => pick(/camp/i));
  // posizione in classifica: la colonna "Pos."/"Class." o il primo numero della riga (1°, 2°, 3°… = podio)
  const [rankCol, setRankCol] = useState(() => {
    const k = pick(/pos|clas|^cl|rank|ord|°/i);
    if (k >= 0) return k;
    return nums[0] && nums[0].i === 0 && nums[0].v >= 1 && nums[0].v <= 500 ? nums[0].i : -1;
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const val = (i: number) => (i >= 0 ? Math.round(Number(row[i].text.replace(",", "."))) : null);
  const save = () => {
    const comp = comps.find((x) => x.id === compId);
    if (!comp) return setErr("Scegli la gara del calendario.");
    const old = comp.entries.find((e) => e.userId === userId);
    if (old?.piazzole.length) return setErr("In questa gara hai già segnato le piazzole: il totale viene da quelle. Correggile dalla gara.");
    setBusy(true);
    setErr("");
    saveEntry({ data: { competitionId: comp.id, score: val(scoreCol), championshipPoints: val(champCol), rank: rankCol >= 0 && (val(rankCol) ?? 0) >= 1 ? val(rankCol) : (old?.rank ?? null), category: old?.category ?? "", laneCount: old?.laneCount ?? null, spot: old?.spot ?? null, targetKind: old?.targetKind ?? "", sagomaMax: old?.sagomaMax ?? null, notes: "Dal portale FITAST", piazzole: [] } })
      .then(onDone)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non salvato."))
      .finally(() => setBusy(false));
  };
  return (
    <div className="grid gap-2 rounded-xl bg-black/25 p-3">
      <Field label="Gara del calendario">
        <Select value={String(compId || "")} onChange={(e) => setCompId(Number(e.target.value))}>
          <option value="">Scegli la gara…</option>
          {comps.map((x) => <option key={x.id} value={x.id}>{x.startsOn} · {x.name}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Punteggio gara">
          <Select value={String(scoreCol)} onChange={(e) => setScoreCol(Number(e.target.value))}>
            {nums.map((x) => <option key={x.i} value={x.i}>{x.label}: {row[x.i].text}</option>)}
          </Select>
        </Field>
        <Field label="Posizione in classifica">
          <Select value={String(rankCol)} onChange={(e) => setRankCol(Number(e.target.value))}>
            <option value="-1">Non indicata</option>
            {nums.map((x) => <option key={x.i} value={x.i}>{x.label}: {row[x.i].text}</option>)}
          </Select>
        </Field>
        <Field label="Punti campionato">
          <Select value={String(champCol)} onChange={(e) => setChampCol(Number(e.target.value))}>
            <option value="-1">Nessuno</option>
            {nums.map((x) => <option key={x.i} value={x.i}>{x.label}: {row[x.i].text}</option>)}
          </Select>
        </Field>
      </div>
      {err ? <ErrorNote text={err} /> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onCancel}>Annulla</Button>
        <Button onClick={save} disabled={busy}>{busy ? "Salvo…" : "Salva nella gara"}</Button>
      </div>
    </div>
  );
}
