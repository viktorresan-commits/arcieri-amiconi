import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, ErrorNote, Field, Loading, Select, TextInput, cx } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { saveEntry } from "@/lib/arcieri/club.api";
import { FITAST_HOME, fitastRead } from "@/lib/arcieri/fitast.api";
import { pressFields, type FitastCell, type FitastPage, type FitastTable } from "@/lib/arcieri/fitast-parse";
import { openExternal } from "@/lib/arcieri/native";

type Lane = { n: number; score: number; arrows: number[]; label: string; distanceM: number | null; note: string; aimAngle: string };
type Entry = { userId: string; score: number | null; rank: number | null; laneCount: number | null; spot: number | null; championshipPoints: number | null; targetKind: "" | "padiglione" | "sagoma"; sagomaMax: 11 | 10 | 8 | null; category: string; piazzole: Lane[] };
type Comp = { id: number; name: string; startsOn: string; notes?: string; entries: Entry[] };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const rowText = (r: FitastCell[]) => r.map((c) => c.text).join(" ");
const GROUP = /piazz|turn|grupp|paglion|bersagl|squadr|linea/i;
const SUBPAGE = /classific|iscritt|piazz|turn|squadr|risultat|elenco|partecip|grupp|ordine/i;
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
type Req = { url: string; post?: { fields: Record<string, string>; charset: string }; referer?: string; label?: string };
type Page = FitastPage & { cookie: string };
type Match = { page: FitastPage; req: Req; table: FitastTable | null; index: number; line?: string };

const KEY_BUTTON = /piazz|classific|generale|campionat|iscritt|risultat|elenco|partecip|turn/i;
const reqKey = (r: Req) => `${r.url}|${r.post ? JSON.stringify(r.post.fields) : ""}`;

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
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);
  const [extra, setExtra] = useState<{ text: string; req: Req; squadre: boolean }[]>([]);
  const stop = useRef(false);
  const cookie = useRef("");

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
   * cerca il nome in tutte le gare: le pagine collegate (iscritti, piazzole, classifiche) e, se il
   * portale usa i pulsanti, ogni gara della tendina con PIAZZOLE, CLASSIFICA, GENERALE e Campionato
   */
  async function searchAll() {
    if (!q.trim()) return;
    stop.current = false;
    setFound([]);
    setErr("");
    const home = await read({ url: FITAST_HOME });
    const queue: Req[] = [];
    const seen = new Set<string>([reqKey({ url: FITAST_HOME })]);
    const push = (r: Req) => {
      const k = reqKey(r);
      if (!seen.has(k) && !queue.some((x) => reqKey(x) === k)) queue.push(r);
    };
    home.links.filter((l) => sameSite(l.href) && l.href !== FITAST_HOME).slice(0, 30).forEach((l) => push({ url: l.href, referer: home.url, label: l.text }));
    // portale a pulsanti: ogni gara della tendina × i comandi utili (prima le gare più recenti in elenco)
    const sel = garaSelect(home);
    const keys = (home.form?.buttons ?? []).filter((b) => KEY_BUTTON.test(b.label));
    const named = keys.filter((b) => !/squadr/i.test(b.label));
    if (sel) {
      for (const o of sel.options.slice(0, 120)) {
        for (const b of named.length ? named : sel.press ? [{ code: sel.press.code, set: sel.press.set, label: "" }] : []) {
          const r = pressReq(home, b, { [sel.name]: o.value }, `${o.text}${b.label ? ` · ${b.label}` : ""}`);
          if (r) push(r);
        }
      }
    } else {
      for (const b of named) {
        const r = pressReq(home, b, {}, b.label);
        if (r) push(r);
      }
    }
    const out: Match[] = [];
    const hitKeys = new Set<string>();
    const rankings: { text: string; req: Req; squadre: boolean }[] = [];
    const take = (p: FitastPage, r: Req) => {
      let inTables = false;
      for (const t of p.tables) {
        t.rows.forEach((row, i) => {
          // la stessa riga può comparire in più pagine (gara e classifica): una volta sola
          const key = `${r.label ?? p.title}|${rowText(row)}`;
          if (i && hits(rowText(row), q)) {
            inTables = true;
            if (!hitKeys.has(key)) {
              hitKeys.add(key);
              out.push({ page: p, req: r, table: t, index: i });
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
          }
        }
      }
      for (const l of p.links) if (/classific/i.test(l.text + l.href) && !rankings.some((x) => x.req.url === l.href)) rankings.push({ text: l.text, req: { url: l.href, referer: p.url }, squadre: /squadr/i.test(l.text + l.href) });
    };
    take(home, { url: FITAST_HOME });
    // classifiche a pulsante (anche squadre), da aprire a mano per la gara scelta in tendina
    for (const b of keys.filter((x) => /classific|generale|campionat/i.test(x.label))) {
      const r = pressReq(home, b, sel ? { [sel.name]: (sel.options.find((o) => o.selected) ?? sel.options[0]).value } : {}, b.label);
      if (r) rankings.push({ text: `${b.label}${sel ? ` · ${(sel.options.find((o) => o.selected) ?? sel.options[0]).text}` : ""}`, req: r, squadre: /squadr/i.test(b.label) });
    }
    let done = 0;
    setScan({ done, total: queue.length });
    while (queue.length && !stop.current && seen.size < 400) {
      // una pagina alla volta: il portale ricorda nella sessione (cookie) la gara scelta, e due comandi
      // premuti insieme si confondevano (risposta di una gara al posto dell'altra)
      const batch = queue.splice(0, 1).filter((r) => !seen.has(reqKey(r)));
      batch.forEach((r) => seen.add(reqKey(r)));
      const pages = await Promise.all(batch.map((r) => read(r).then((p) => ({ p, r })).catch(() => null)));
      for (const x of pages) {
        if (!x) continue;
        take(x.p, x.r);
        // un livello in più: le pagine di iscritti, piazzole e classifiche della gara
        // (anche dopo un comando premuto: CLASSIFICA spesso risponde con il collegamento al PDF)
        x.p.links
          .filter((l) => sameSite(l.href) && (/\.pdf($|\?)/i.test(l.href) || (!x.r.post && SUBPAGE.test(l.text + l.href))))
          .slice(0, 6)
          .forEach((l) => push({ url: l.href, referer: x.p.url, label: `${x.r.label ? `${x.r.label} · ` : ""}${l.text || "PDF"}` }));
      }
      done += batch.length;
      setScan({ done, total: done + queue.length });
      setFound([...out]);
    }
    setExtra(rankings);
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
      <p className="-mt-1.5 text-[0.7rem] text-muted">Cerca il nome in tutte le gare del portale: iscrizioni, piazzole e classifiche.</p>
      {scan ? <p className="text-xs text-muted">Leggo le pagine delle gare… {scan.done} di {scan.total}</p> : null}
      {found ? <Matches found={found} q={q} comps={comps} userId={userId} onSaved={onSaved} onOpen={(r) => go(r)} searching={Boolean(scan)} /> : null}
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
      {page && !busy ? <PageView page={page} label={req.label} q={q} onOpen={open} onGo={(r) => go(r)} /> : null}
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
  const label = (b: string) => [sel ? textOf(sel.name) : "", b].filter(Boolean).join(" · ");
  return (
    <div className="grid gap-2 rounded-2xl bg-white/[0.04] p-3">
      {form.selects.filter((x) => x.options.length >= 2).slice(0, 4).map((x) => (
        <Field key={x.name} label={x.label || "Scegli"}>
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
function PageView({ page, label, q, onOpen, onGo }: { page: FitastPage; label?: string; q: string; onOpen: (u: string) => void; onGo: (r: Req) => void }) {
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
      {page.tables.slice(0, 8).map((t, i) => <TableView key={i} t={t} q={q} onOpen={onOpen} onPress={(code) => { const p = JSON.parse(code) as { code: string; set: Record<string, string> }; const r = pressReq(page, p, {}, label ?? ""); if (r) onGo(r); }} />)}
      {!page.tables.length && page.lines.length ? (
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

/** dove compare il nome: riga, compagni di piazzola e il punteggio da portare nella gara */
function Matches({ found, q, comps, userId, onSaved, onOpen, searching }: { found: Match[]; q: string; comps: Comp[]; userId: string; onSaved: () => void; onOpen: (r: Req) => void; searching: boolean }) {
  if (!found.length) return <p className="rounded-2xl bg-white/[0.04] p-3 text-sm text-muted">{searching ? "Ancora nessuna riga con questo nome…" : `Nessuna riga con «${q}» nelle pagine lette. Prova solo il cognome, o apri la gara qui sotto.`}</p>;
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
