import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, ErrorNote, Field, Loading, Select, TextInput, cx } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { saveEntry } from "@/lib/arcieri/club.api";
import { FITAST_HOME, fitastRead } from "@/lib/arcieri/fitast.api";
import type { FitastCell, FitastPage, FitastTable } from "@/lib/arcieri/fitast-parse";
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
  return words.every((w) => t.includes(w));
}

function codeOf(c: Comp) {
  return (c.notes ?? "").match(/^fitast:(\d+)/)?.[1] ?? "";
}

type Match = { page: FitastPage; table: FitastTable; index: number };

/**
 * Portale FITAST dentro l'app: si sfoglia il calendario, si cerca il proprio nome nelle pagine delle
 * gare (iscritti, piazzole, classifiche), si vedono i compagni di piazzola e si porta il punteggio
 * nella propria gara del calendario.
 */
export function FitastPanel({ comps, myName, userId, startCode, onSaved, onClose }: { comps: Comp[]; myName: string; userId: string; startCode?: string; onSaved: () => void; onClose?: () => void }) {
  const [url, setUrl] = useState(FITAST_HOME);
  const [back, setBack] = useState<string[]>([]);
  const [page, setPage] = useState<FitastPage | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState(myName);
  const [found, setFound] = useState<Match[] | null>(null);
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);
  const [extra, setExtra] = useState<{ text: string; href: string; squadre: boolean }[]>([]);
  const stop = useRef(false);

  const go = (next: string, push = true) => {
    if (push && page) setBack((b) => [...b, url]);
    setUrl(next);
  };

  useEffect(() => {
    let off = false;
    setBusy(true);
    setErr("");
    fitastRead({ data: { url } })
      .then((p) => {
        if (off) return;
        setPage(p);
        // aperto da una gara del calendario: si va dritti alla sua pagina, se il calendario la collega
        if (startCode && url === FITAST_HOME) {
          const l = p.links.find((x) => new RegExp(`(^|\\D)${startCode}(\\D|$)`).test(x.href));
          if (l) go(l.href);
        }
      })
      .catch((e: unknown) => !off && setErr(e instanceof Error ? e.message : "Portale FITAST non raggiungibile."))
      .finally(() => !off && setBusy(false));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  /** cerca il nome in tutte le gare del calendario e nelle loro pagine (iscritti, piazzole, classifiche) */
  async function searchAll() {
    if (!q.trim()) return;
    stop.current = false;
    setFound([]);
    setErr("");
    const home = await fitastRead({ data: { url: FITAST_HOME } });
    const first = home.links.filter((l) => sameSite(l.href) && l.href !== FITAST_HOME).slice(0, 30).map((l) => l.href);
    const queue = [...new Set(first)];
    const seen = new Set<string>([FITAST_HOME]);
    const out: Match[] = [];
    const keys = new Set<string>();
    const rankings: { text: string; href: string; squadre: boolean }[] = [];
    const take = (p: FitastPage) => {
      for (const t of p.tables) {
        t.rows.forEach((r, i) => {
          // la stessa riga può comparire in più pagine (gara e classifica): una volta sola
          const key = `${p.title}|${rowText(r)}`;
          if (i && hits(rowText(r), q) && !keys.has(key)) {
            keys.add(key);
            out.push({ page: p, table: t, index: i });
          }
        });
      }
      for (const l of p.links) if (/classific/i.test(l.text + l.href) && !rankings.some((x) => x.href === l.href)) rankings.push({ text: l.text, href: l.href, squadre: /squadr/i.test(l.text + l.href) });
    };
    take(home);
    let done = 0;
    setScan({ done, total: queue.length });
    while (queue.length && !stop.current && seen.size < 60) {
      const batch = queue.splice(0, 3).filter((u) => !seen.has(u));
      batch.forEach((u) => seen.add(u));
      const pages = await Promise.all(batch.map((u) => fitastRead({ data: { url: u } }).catch(() => null)));
      for (const p of pages) {
        if (!p) continue;
        take(p);
        // un livello in più: le pagine di iscritti, piazzole e classifiche della gara
        p.links.filter((l) => sameSite(l.href) && SUBPAGE.test(l.text + l.href) && !seen.has(l.href)).slice(0, 4).forEach((l) => queue.push(l.href));
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
      {found ? <Matches found={found} q={q} comps={comps} userId={userId} onSaved={onSaved} onOpen={(u) => go(u)} searching={Boolean(scan)} /> : null}
      {extra.length ? (
        <div className="grid gap-1.5">
          <p className="text-sm font-semibold">Classifiche trovate</p>
          <div className="flex flex-wrap gap-1.5">
            {extra.slice(0, 16).map((l) => <button key={l.href} type="button" className="aa-chip" onClick={() => go(l.href)}>{l.squadre ? "Squadre · " : "Arcieri · "}{l.text.slice(0, 40)}</button>)}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-2">
        {back.length ? <button type="button" className="aa-chip" onClick={() => { const prev = back[back.length - 1]; setBack((b) => b.slice(0, -1)); go(prev, false); }}><Glyph name="chevron" size={12} className="rotate-180" /> Indietro</button> : null}
        {url !== FITAST_HOME ? <button type="button" className="aa-chip" onClick={() => { setBack([]); go(FITAST_HOME, false); }}>Calendario</button> : null}
        <button type="button" className="aa-chip" onClick={() => void openExternal(url)}>Apri sul sito</button>
      </div>
      {busy ? <Loading /> : null}
      {err ? <ErrorNote text={err} /> : null}
      {page && !busy ? <PageView page={page} q={q} onOpen={(u) => go(u)} /> : null}
    </Card>
  );
}

/** la pagina letta: tabelle (con il nome evidenziato), testo e collegamenti utili */
function PageView({ page, q, onOpen }: { page: FitastPage; q: string; onOpen: (u: string) => void }) {
  if (page.kind === "pdf") {
    return (
      <div className="grid gap-2 rounded-2xl bg-white/[0.04] p-3">
        <p className="text-sm">È un documento PDF: si apre fuori dall'app.</p>
        <Button variant="ghost" onClick={() => void openExternal(page.url)}>Apri il PDF</Button>
      </div>
    );
  }
  const useful = page.links.filter((l) => (sameSite(l.href) || /\.pdf/i.test(l.href)) && l.href !== page.url).slice(0, 60);
  return (
    <div className="grid gap-3">
      {page.title ? <p className="text-sm font-semibold">{page.title}</p> : null}
      {page.tables.slice(0, 8).map((t, i) => <TableView key={i} t={t} q={q} onOpen={onOpen} />)}
      {!page.tables.length ? (
        <div className="grid max-h-80 gap-1 overflow-y-auto rounded-2xl bg-white/[0.03] p-3 text-sm">
          {page.lines.slice(0, 200).map((l, i) => <p key={i} className={cx(hits(l, q) && "rounded bg-[#e0b15a]/25 px-1")}>{l}</p>)}
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

function TableView({ t, q, onOpen }: { t: FitastTable; q: string; onOpen: (u: string) => void }) {
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
              return (
                <tr key={i} onClick={href ? () => onOpen(href) : undefined} className={cx(i === 0 ? "bg-white/[0.06] font-semibold text-muted" : "border-t border-white/[0.05]", mine && "bg-[#e0b15a]/20", href && "cursor-pointer hover:bg-white/[0.04]")}>
                  {r.map((c, k) => <td key={k} className={cx("px-2 py-1.5 align-top", c.href && "text-[#8cc3f0] underline-offset-2")}>{c.text}</td>)}
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
function Matches({ found, q, comps, userId, onSaved, onOpen, searching }: { found: Match[]; q: string; comps: Comp[]; userId: string; onSaved: () => void; onOpen: (u: string) => void; searching: boolean }) {
  if (!found.length) return <p className="rounded-2xl bg-white/[0.04] p-3 text-sm text-muted">{searching ? "Ancora nessuna riga con questo nome…" : `Nessuna riga con «${q}» nelle pagine lette. Prova solo il cognome, o apri la gara qui sotto.`}</p>;
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold">Trovato in {found.length} {found.length === 1 ? "riga" : "righe"}</p>
      {found.slice(0, 30).map((m, i) => <MatchCard key={i} m={m} comps={comps} userId={userId} onSaved={onSaved} onOpen={onOpen} />)}
    </div>
  );
}

function MatchCard({ m, comps, userId, onSaved, onOpen }: { m: Match; comps: Comp[]; userId: string; onSaved: () => void; onOpen: (u: string) => void }) {
  const head = m.table.rows[0];
  const row = m.table.rows[m.index];
  const g = head.findIndex((c) => GROUP.test(c.text));
  const mates = g >= 0 && row[g]?.text ? m.table.rows.filter((r, i) => i > 0 && i !== m.index && r[g]?.text === row[g].text) : [];
  const nums = row.map((c, i) => ({ i, v: Number(c.text.replace(",", ".")), label: head[i]?.text || `colonna ${i + 1}` })).filter((x) => isNum(row[x.i]) && Number.isFinite(x.v) && x.v >= 0 && x.v < 2000);
  const [save, setSave] = useState(false);
  return (
    <div className="grid gap-2 rounded-2xl border border-[#e0b15a]/30 bg-[#e0b15a]/[0.06] p-3">
      <button type="button" onClick={() => onOpen(m.page.url)} className="text-left text-xs font-semibold text-[#e0b15a]">{m.page.title || "Pagina FITAST"} ›</button>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        {row.map((cell, i) => (cell.text ? <Pair key={i} k={head[i]?.text || "—"} v={cell.text} /> : null))}
      </div>
      {mates.length ? (
        <div className="rounded-xl bg-black/20 px-3 py-2">
          <p className="text-xs font-semibold">Con te {/squadr/i.test(head[g].text) ? "in squadra" : "in piazzola"} ({head[g].text} {row[g].text})</p>
          <ul className="mt-1 grid gap-0.5 text-xs text-muted">{mates.slice(0, 12).map((r, i) => <li key={i}>{r.filter((_, k) => k !== g).map((c2) => c2.text).filter(Boolean).slice(0, 3).join(" · ")}</li>)}</ul>
        </div>
      ) : null}
      {nums.length ? (save ? <SaveScore nums={nums} m={m} comps={comps} userId={userId} onDone={() => { setSave(false); onSaved(); }} onCancel={() => setSave(false)} /> : <button type="button" className="aa-chip justify-self-start" onClick={() => setSave(true)}>Porta il punteggio nella mia gara</button>) : null}
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
function SaveScore({ nums, m, comps, userId, onDone, onCancel }: { nums: { i: number; v: number; label: string }[]; m: Match; comps: Comp[]; userId: string; onDone: () => void; onCancel: () => void }) {
  // la gara giusta: stesso codice nell'indirizzo, oppure la stessa data scritta nella pagina
  const guess = useMemo(() => {
    const text = `${m.page.url} ${m.page.title} ${m.page.lines.slice(0, 40).join(" ")}`;
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
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const row = m.table.rows[m.index];
  const val = (i: number) => (i >= 0 ? Math.round(Number(row[i].text.replace(",", "."))) : null);
  const save = () => {
    const comp = comps.find((x) => x.id === compId);
    if (!comp) return setErr("Scegli la gara del calendario.");
    const old = comp.entries.find((e) => e.userId === userId);
    if (old?.piazzole.length) return setErr("In questa gara hai già segnato le piazzole: il totale viene da quelle. Correggile dalla gara.");
    setBusy(true);
    setErr("");
    saveEntry({ data: { competitionId: comp.id, score: val(scoreCol), championshipPoints: val(champCol), rank: old?.rank ?? null, category: old?.category ?? "", laneCount: old?.laneCount ?? null, spot: old?.spot ?? null, targetKind: old?.targetKind ?? "", sagomaMax: old?.sagomaMax ?? null, notes: "Dal portale FITAST", piazzole: [] } })
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
