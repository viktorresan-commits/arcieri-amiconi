import { useRef, useState } from "react";
import { traslocoBegin, traslocoExport, traslocoFinish, traslocoImport, traslocoTables } from "@/lib/arcieri/trasloco.api";
import { saveFile } from "@/lib/arcieri/native";
import { Button, Card, TextInput } from "./kit";

type Pack = { format: "arcieri-trasloco"; version: 1; createdAt: string; tables: { name: string; rows: number; chunks: string[] }[] };

/** Trasloco dei dati (solo amministratori): esporta dal vecchio sito, importa nel nuovo. */
export function Trasloco() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pack, setPack] = useState<Pack | null>(null);
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const say = (line: string) => setLog((l) => [...l.slice(-30), line]);

  async function esporta() {
    setBusy(true);
    setLog([]);
    try {
      const tables = await traslocoTables();
      const out: Pack = { format: "arcieri-trasloco", version: 1, createdAt: new Date().toISOString(), tables: [] };
      for (const t of tables) {
        const chunks: string[] = [];
        let offset = 0;
        let limit = 300;
        while (offset < t.rows) {
          const part = await traslocoExport({ data: { table: t.name, offset, limit } });
          if (!part.count) break;
          chunks.push(part.json);
          offset += part.count;
          limit = part.limit;
        }
        out.tables.push({ name: t.name, rows: t.rows, chunks });
        say(`${t.name}: ${t.rows} righe`);
      }
      const total = out.tables.reduce((a, t) => a + t.rows, 0);
      await saveFile(new Blob([JSON.stringify(out)], { type: "application/json" }), `arcieri-amiconi-trasloco-${out.createdAt.slice(0, 10)}.json`);
      say(`Pronto: ${total} righe in ${out.tables.length} tabelle. Tieni il file: serve nel nuovo sito.`);
    } catch (e) {
      say(`Errore: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function leggi(file: File) {
    setLog([]);
    try {
      const data = JSON.parse(await file.text()) as Pack;
      if (data.format !== "arcieri-trasloco" || !Array.isArray(data.tables)) throw new Error("Non è un file di trasloco.");
      setPack(data);
      const total = data.tables.reduce((a, t) => a + t.rows, 0);
      say(`File del ${data.createdAt.slice(0, 16).replace("T", " ")}: ${total} righe in ${data.tables.length} tabelle.`);
      for (const t of data.tables) if (t.rows) say(`${t.name}: ${t.rows}`);
    } catch (e) {
      setPack(null);
      say(`Errore: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function importa() {
    if (!pack) return;
    setBusy(true);
    try {
      const { token } = await traslocoBegin({ data: { confirm, tables: pack.tables.map((t) => t.name) } });
      say("Database svuotato, carico i dati…");
      for (const t of pack.tables) {
        let n = 0;
        for (const json of t.chunks) {
          const res = await traslocoImport({ data: { token, table: t.name, json } });
          n += res.inserted;
        }
        if (t.rows) say(`${t.name}: ${n}/${t.rows}`);
        if (n !== t.rows) throw new Error(`${t.name}: caricate ${n} righe su ${t.rows}.`);
      }
      await traslocoFinish({ data: { token } });
      say("Trasloco finito. Ora esci e rientra con il tuo vecchio utente e password.");
      setDone(true);
    } catch (e) {
      say(`Errore: ${e instanceof Error ? e.message : String(e)}. Puoi ripetere l'importazione dall'inizio.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="grid gap-2">
      <h2 className="font-display text-2xl">Trasloco dei dati</h2>
      <p className="text-sm text-muted">Per spostare tutta la squadra su un nuovo sito: account e password, allenamenti, gare, sagome, foto, messaggi. Le persone poi rientrano con il loro solito utente e password.</p>
      <div className="grid gap-2 rounded-xl border border-line p-3">
        <p className="text-sm font-semibold">1 · Nel vecchio sito</p>
        <Button variant="ghost" disabled={busy} onClick={() => void esporta()}>{busy && !pack ? "Esporto…" : "Esporta tutto il database"}</Button>
      </div>
      <div className="grid gap-2 rounded-xl border border-line p-3">
        <p className="text-sm font-semibold">2 · Nel nuovo sito, appena pubblicato e vuoto</p>
        <Button variant="ghost" disabled={busy} onClick={() => fileRef.current?.click()}>Scegli il file del trasloco</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void leggi(f); e.currentTarget.value = ""; }} />
        {pack && !done ? (
          <>
            <p className="text-xs text-danger">Attenzione: tutto quello che c'è in questo sito viene sostituito dai dati del file.</p>
            <TextInput value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} placeholder="Scrivi TRASLOCO per confermare" />
            <Button disabled={busy || confirm !== "TRASLOCO"} onClick={() => void importa()}>{busy ? "Importo…" : "Importa i dati"}</Button>
          </>
        ) : null}
        {done ? <Button onClick={() => { window.location.href = "/login"; }}>Vai all'accesso</Button> : null}
      </div>
      {log.length ? <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-elev p-2 text-xs">{log.join("\n")}</pre> : null}
    </Card>
  );
}
