import { useRef, useState } from "react";
import { IconLabel, IconTitle } from "./icons";
import { importGrokGear, importGrokSessions, importReportSessions } from "@/lib/arcieri/account.api";
import { Button, Card, Select } from "./kit";

type Row = Record<string, unknown>;
type Personal = { sessions: Row[]; shots: Row[]; equipment: Row[]; setups: Row[]; who: string };
type ReportRow = { startedAt: string; distanceM: number; bowType: string; place: string };
type TraslocoPack = { format: "arcieri-trasloco"; tables: { name: string; chunks: string[] }[] };

/* ---------------- lettura dei file ---------------- */

function tableRows(pack: TraslocoPack, name: string): Row[] {
  const t = pack.tables.find((x) => x.name === name);
  if (!t) return [];
  return t.chunks.flatMap((c) => {
    try {
      const v = JSON.parse(c) as unknown;
      return Array.isArray(v) ? (v as Row[]) : [];
    } catch {
      return [];
    }
  });
}

/** Dal file del trasloco completo tengo solo le righe di una persona. */
function fromPack(pack: TraslocoPack, userId: string, who: string): Personal {
  const sessions = tableRows(pack, "sessions").filter((r) => r.user_id === userId);
  const ids = new Set(sessions.map((s) => Number(s.id)));
  return {
    who,
    sessions,
    shots: tableRows(pack, "shots").filter((r) => ids.has(Number(r.session_id))),
    equipment: tableRows(pack, "equipment").filter((r) => r.user_id === userId),
    setups: tableRows(pack, "setups").filter((r) => r.user_id === userId),
  };
}

/** Testo delle righe di un PDF semplice (come il "report PDF" della vecchia app). */
function pdfStrings(raw: string) {
  const out: string[] = [];
  const re = /\((?:\\.|[^\\)])*\)\s*(?:Tj|')/g;
  for (const m of raw.matchAll(re)) {
    const body = m[0].slice(1, m[0].lastIndexOf(")"));
    out.push(
      body
        .replace(/\\([0-7]{1,3})/g, (_, o: string) => String.fromCharCode(Number.parseInt(o, 8)))
        .replace(/\\([nrtbf])/g, " ")
        .replace(/\\(.)/g, "$1"),
    );
  }
  return out;
}

async function inflateStreams(bytes: Uint8Array) {
  const raw = new TextDecoder("latin1").decode(bytes);
  const texts: string[] = [];
  const re = /(?<!end)stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    let stop = end;
    while (stop > start && (bytes[stop - 1] === 10 || bytes[stop - 1] === 13)) stop -= 1;
    const chunk = bytes.slice(start, stop);
    try {
      const ds = new DecompressionStream("deflate");
      const buf = await new Response(new Blob([chunk]).stream().pipeThrough(ds)).arrayBuffer();
      texts.push(new TextDecoder("latin1").decode(buf));
    } catch {
      /* non compresso o non deflate */
    }
    re.lastIndex = end;
  }
  return texts.join("\n");
}

/** Ultima risorsa per PDF fatti da altri programmi: PDF.js dal CDN. */
async function pdfJsLines(bytes: Uint8Array) {
  const base = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38";
  const lib = (await import(/* @vite-ignore */ `${base}/pdf.min.mjs`)) as {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (o: { data: Uint8Array }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str?: string; transform?: number[] }[] }> }> }> };
  };
  lib.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.mjs`;
  const doc = await lib.getDocument({ data: bytes }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, string[]>();
    for (const item of content.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform?.[5] ?? 0);
      rows.set(y, [...(rows.get(y) ?? []), item.str]);
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, parts]) => lines.push(parts.join(" ")));
  }
  return lines;
}

const BOW_IDS = ["olimpico", "compound", "nudo", "lungo", "tradizionale", "altro"];

function reportRows(lines: string[]): ReportRow[] {
  const out: ReportRow[] = [];
  for (const line of lines) {
    const m = /(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?\s+(\d+(?:[.,]\d+)?)\s*m\b\s*(\S+)?\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const bow = (m[4] ?? "").toLowerCase();
    out.push({
      startedAt: m[2] ? `${m[1]}T${m[2]}` : m[1],
      distanceM: Number(m[3].replace(",", ".")),
      bowType: BOW_IDS.includes(bow) ? bow : "olimpico",
      place: BOW_IDS.includes(bow) ? (m[5] ?? "").trim() : `${m[4] ?? ""} ${m[5] ?? ""}`.trim(),
    });
  }
  return out;
}

/** Righe di allenamento dal report PDF della vecchia app (o da un PDF simile). */
export async function readReportPdf(bytes: Uint8Array, onSlow?: () => void): Promise<ReportRow[]> {
  const raw = new TextDecoder("latin1").decode(bytes);
  let lines = pdfStrings(raw);
  if (!reportRows(lines).length) lines = [...lines, ...pdfStrings(await inflateStreams(bytes))];
  if (!reportRows(lines).length) {
    onSlow?.();
    lines = await pdfJsLines(bytes).catch(() => lines);
  }
  return reportRows(lines);
}

/* ---------------- componente ---------------- */

export function Migrazione({ myEmail }: { myEmail: string | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [personal, setPersonal] = useState<Personal | null>(null);
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [pack, setPack] = useState<TraslocoPack | null>(null);
  const [people, setPeople] = useState<{ id: string; label: string }[]>([]);
  const [pick, setPick] = useState("");
  const say = (line: string) => setLog((l) => [...l.slice(-20), line]);

  function reset() {
    setPersonal(null);
    setReport(null);
    setPack(null);
    setPeople([]);
    setLog([]);
  }

  async function read(file: File) {
    reset();
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const head = new TextDecoder("latin1").decode(bytes.slice(0, 8));
      if (head.startsWith("%PDF")) {
        const rows = await readReportPdf(bytes, () => say("PDF compresso: lo leggo con PDF.js…"));
        if (!rows.length) throw new Error("Nel PDF non trovo righe di allenamento (data, distanza, arco).");
        setReport(rows);
        say(`Report PDF: ${rows.length} uscite trovate (${rows[0].startedAt.slice(0, 10)} → ${rows.at(-1)?.startedAt.slice(0, 10)}).`);
        say("Il report contiene solo data, distanza e arco: le frecce arrivano solo dal file JSON.");
        return;
      }
      const data = JSON.parse(new TextDecoder("utf-8").decode(bytes)) as Record<string, unknown>;
      if (data.format === "arcieri-trasloco" && Array.isArray(data.tables)) {
        const p = data as unknown as TraslocoPack;
        const users = tableRows(p, "user");
        const members = tableRows(p, "members");
        const list = users.map((u) => {
          const m = members.find((x) => x.user_id === u.id);
          const name = [m?.given_name, m?.family_name].filter(Boolean).join(" ") || String(u.name ?? "");
          return { id: String(u.id), label: `${name} · ${String(u.email ?? "")}`, email: String(u.email ?? "").toLowerCase() };
        });
        setPack(p);
        setPeople(list.map(({ id, label }) => ({ id, label })));
        const mine = list.find((u) => myEmail && u.email === myEmail.toLowerCase());
        if (mine) {
          setPick(mine.id);
          const mineData = fromPack(p, mine.id, mine.label);
          setPersonal(mineData);
          say(`File di trasloco: trovato il tuo account (${mine.label}).`);
          say(`${mineData.sessions.length} allenamenti, ${mineData.shots.length} frecce, ${mineData.equipment.length} attrezzi.`);
        } else {
          say("File di trasloco completo: scegli di chi sono i dati da portare sul tuo account.");
        }
        return;
      }
      const sessions = Array.isArray(data.sessions) ? (data.sessions as Row[]) : [];
      const shots = Array.isArray(data.shots) ? (data.shots as Row[]) : [];
      const equipment = Array.isArray(data.equipment) ? (data.equipment as Row[]) : [];
      const setups = Array.isArray(data.setups) ? (data.setups as Row[]) : [];
      if (!sessions.length && !equipment.length) throw new Error("Nel file non trovo allenamenti né attrezzatura.");
      const profile = (data.profile ?? {}) as { givenName?: string; familyName?: string };
      const who = [profile.givenName, profile.familyName].filter(Boolean).join(" ") || "file JSON";
      setPersonal({ sessions, shots, equipment, setups, who });
      say(`JSON di ${who}${typeof data.exportedAt === "string" ? ` del ${data.exportedAt.slice(0, 10)}` : ""}.`);
      say(`${sessions.length} allenamenti, ${shots.length} frecce, ${equipment.length} attrezzi, ${setups.length} assetti.`);
    } catch (e) {
      say(`Errore: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function choose(id: string) {
    setPick(id);
    if (!pack || !id) return;
    const label = people.find((p) => p.id === id)?.label ?? "";
    const data = fromPack(pack, id, label);
    setPersonal(data);
    say(`${label}: ${data.sessions.length} allenamenti, ${data.shots.length} frecce, ${data.equipment.length} attrezzi.`);
  }

  async function run() {
    setBusy(true);
    try {
      if (report) {
        let added = 0;
        let skipped = 0;
        for (let i = 0; i < report.length; i += 300) {
          const res = await importReportSessions({ data: { rows: report.slice(i, i + 300) } });
          added += res.added;
          skipped += res.skipped;
        }
        say(`Fatto: ${added} uscite aggiunte${skipped ? `, ${skipped} già presenti` : ""}.`);
        return;
      }
      if (!personal) return;
      const gear = await importGrokGear({ data: { equipment: personal.equipment, setups: personal.setups } });
      say(`Attrezzatura e assetti: ${gear.added} aggiunti.`);
      const shotsBy = new Map<number, Row[]>();
      for (const s of personal.shots) {
        const k = Number(s.session_id);
        shotsBy.set(k, [...(shotsBy.get(k) ?? []), s]);
      }
      // pacchetti piccoli: il server accetta al massimo pochi MB per chiamata
      let batch: Row[] = [];
      let batchShots: Row[] = [];
      let added = 0;
      let skipped = 0;
      let arrows = 0;
      const flush = async () => {
        if (!batch.length) return;
        const res = await importGrokSessions({ data: { sessions: batch, shots: batchShots, setups: gear.setups } });
        added += res.added;
        skipped += res.skipped;
        arrows += res.arrows;
        say(`Allenamenti: ${added} aggiunti, ${arrows} frecce…`);
        batch = [];
        batchShots = [];
      };
      for (const s of personal.sessions) {
        const list = shotsBy.get(Number(s.id)) ?? [];
        if (batch.length >= 25 || batchShots.length + list.length > 2500) await flush();
        batch.push(s);
        batchShots.push(...list);
      }
      await flush();
      say(`Fatto: ${added} allenamenti e ${arrows} frecce sul tuo account${skipped ? ` (${skipped} già presenti, saltati)` : ""}.`);
    } catch (e) {
      say(`Errore: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const ready = !!report?.length || !!personal;
  return (
    <Card className="grid gap-2">
      <IconTitle icon="import" color="#2b74c9" sub="JSON completo o report PDF dalla vecchia app">Porta qui i tuoi dati</IconTitle>
      <p className="text-xs text-muted">
        Nella vecchia app: Profilo → <b>Scarica JSON</b> (completo, con tutte le frecce) oppure <b>Scarica report PDF</b> (solo le uscite).
        Poi caricalo qui: va sul tuo account. Ogni arciere lo fa dal proprio profilo. Ripeterlo non crea doppioni.
      </p>
      <input ref={fileRef} type="file" accept="application/json,.json,application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.currentTarget.value = ""; }} />
      <Button variant="ghost" disabled={busy} onClick={() => fileRef.current?.click()}><IconLabel icon="import">Scegli il file JSON o PDF</IconLabel></Button>
      {people.length ? (
        <Select value={pick} onChange={(e) => choose(e.target.value)}>
          <option value="">Di chi sono i dati?</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
      ) : null}
      {ready ? <Button disabled={busy} onClick={() => void run()}>{busy ? "Importo…" : report ? `Importa ${report.length} uscite` : `Importa sul mio account`}</Button> : null}
      {log.length ? (
        <div className="rounded-xl bg-black/25 p-2 text-[0.72rem] leading-relaxed text-muted">
          {log.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      ) : null}
    </Card>
  );
}
