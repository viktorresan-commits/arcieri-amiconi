import { useMemo, useState } from "react";
import { Button, Card, Empty, ErrorNote, Field, Loading, Select, TextArea, TextInput, cx } from "./kit";
import { Glyph } from "./icons";
import { useLoad } from "@/lib/arcieri/use-load";
import { listClasses } from "@/lib/arcieri/classi.api";
import { deleteProgram, listPrograms, saveProgram, type ProgramRow } from "@/lib/arcieri/programmi.api";
import { CATALOG, LEVEL_HINT, LEVEL_NAME, preset, type ExItem, type ExProgram, type Level } from "@/lib/arcieri/exercise-catalog";
import { programFileName, programPdf } from "@/lib/arcieri/program-pdf";
import { isNativeApp, saveFile, whatsappLink } from "@/lib/arcieri/native";

/** pallini della difficoltà (come nel PDF) */
export function LevelDots({ level, size = 9 }: { level: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Difficoltà ${level} su 3`}>
      {[1, 2, 3].map((i) => <span key={i} className={cx("inline-block rounded-full border border-current", i <= level ? "bg-current" : "")} style={{ width: size, height: size }} />)}
    </span>
  );
}

/** scarica il PDF o lo manda con WhatsApp (nell'app: foglio Condividi; sul telefono: condivisione con il file) */
export async function sendProgram(p: ExProgram, how: "scarica" | "whatsapp") {
  const blob = new Blob([programPdf(p) as BlobPart], { type: "application/pdf" });
  const name = programFileName(p);
  if (how === "whatsapp" && !isNativeApp()) {
    const file = new File([blob], name, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: "Programma di allenamento", text: `Programma di allenamento${p.header.athlete ? ` di ${p.header.athlete}` : ""}` });
        return;
      } catch {
        /* annullato: si scarica */
      }
    }
    await saveFile(blob, name);
    window.open(whatsappLink(`Ti mando il programma di allenamento${p.header.athlete ? ` di ${p.header.athlete}` : ""}: è il PDF «${name}», allegalo qui.`), "_blank");
    return;
  }
  await saveFile(blob, name);
}

type Person = { memberId: number; name: string };

/** I programmi di esercizi della compagnia: nuovi da un modello già pronto, salvati, in PDF. */
export function ProgramsTab({ companyId, companyName, coachName }: { companyId: number; companyName: string; coachName: string }) {
  const [nonce, setNonce] = useState(0);
  const list = useLoad(`progs-${companyId}-${nonce}`, () => listPrograms({ data: { companyId } }));
  const classes = useLoad(`progs-cls-${companyId}`, () => listClasses({ data: { companyId } }));
  const [edit, setEdit] = useState<{ id: number; memberId: number | null; program: ExProgram } | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const start = (lv: Level) => {
    const p = preset(lv);
    p.header.company = companyName;
    p.header.coach = coachName;
    setEdit({ id: 0, memberId: null, program: p });
  };

  if (edit) {
    return (
      <ProgramEditor
        key={edit.id || `new-${edit.program.level}`}
        initial={edit}
        companyId={companyId}
        classes={classes.data ?? null}
        onCancel={() => setEdit(null)}
        onSaved={() => {
          setEdit(null);
          setNonce((n) => n + 1);
        }}
      />
    );
  }
  const rows = list.data ?? [];
  return (
    <div className="grid gap-3">
      <Card className="grid gap-3">
        <div>
          <p className="font-display text-2xl leading-tight">Nuovo programma di esercizi</p>
          <p className="text-xs text-muted">Parti da un modello già pronto e adattalo: lo salvi per l'allievo, lo scarichi in PDF (da stampare in bianco e nero) o lo mandi su WhatsApp.</p>
        </div>
        <div className="grid gap-2">
          {([1, 2, 3] as const).map((lv) => (
            <button key={lv} type="button" onClick={() => start(lv)} className="aa-press flex items-center gap-3 rounded-2xl border border-line bg-white/[0.04] p-3 text-left">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-[#e0b15a]"><LevelDots level={lv} size={8} /></span>
              <span className="min-w-0 flex-1">
                <b className="block">{LEVEL_NAME[lv]}</b>
                <span className="block text-xs text-muted">{LEVEL_HINT[lv]} · {preset(lv).sections.reduce((n, s) => n + s.items.length, 0)} esercizi</span>
              </span>
              <Glyph name="chevron" size={16} className="text-muted" />
            </button>
          ))}
        </div>
      </Card>
      {list.loading ? <Loading /> : null}
      {list.error ? <ErrorNote text={list.error} /> : null}
      {err ? <ErrorNote text={err} /> : null}
      {!list.loading && !rows.length ? <Empty title="Nessun programma salvato" text="I programmi che salvi compaiono qui, e l'allievo li trova anche nelle sue schede." /> : null}
      {rows.map((r: ProgramRow) => (
        <Card key={r.id} className="grid gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <b className="block truncate">{r.athleteName}</b>
              <span className="flex items-center gap-1.5 text-xs text-muted"><span className="text-[#e0b15a]"><LevelDots level={r.level} size={7} /></span>{LEVEL_NAME[r.level as Level]} · {r.program.sections.reduce((n, s) => n + s.items.length, 0)} esercizi · di {r.coachName} · {new Date(r.updatedAt).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</span>
              {r.athleteMemberId ? null : <span className="mt-0.5 inline-block rounded-full bg-white/[0.07] px-1.5 py-px text-[0.62rem] text-muted">non è nell'app</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="aa-chip" onClick={() => void sendProgram(r.program, "scarica")}><Glyph name="download" size={13} /> PDF</button>
            <button type="button" className="aa-chip border-[#25d366]/50 text-[#7ee2a4]" onClick={() => void sendProgram(r.program, "whatsapp")}><Glyph name="share" size={13} /> WhatsApp</button>
            <button type="button" className="aa-chip" onClick={() => setEdit({ id: r.id, memberId: r.athleteMemberId, program: r.program })}>Modifica</button>
            <button
              type="button"
              className="aa-chip"
              onClick={() => {
                const copy = structuredClone(r.program);
                copy.header.athlete = "";
                setEdit({ id: 0, memberId: null, program: copy });
              }}
            >
              Usa per un altro
            </button>
            {r.mine ? (
              <button
                type="button"
                disabled={busy === `del-${r.id}`}
                className="aa-chip text-danger"
                onClick={() => {
                  if (!window.confirm(`Eliminare il programma di ${r.athleteName}?`)) return;
                  setBusy(`del-${r.id}`);
                  deleteProgram({ data: { id: r.id } })
                    .then(() => setNonce((n) => n + 1))
                    .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Non eliminato."))
                    .finally(() => setBusy(""));
                }}
              >
                Elimina
              </button>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}

type ClassesData = Awaited<ReturnType<typeof listClasses>>;

function ProgramEditor({ initial, companyId, classes, onSaved, onCancel }: { initial: { id: number; memberId: number | null; program: ExProgram }; companyId: number; classes: ClassesData | null; onSaved: () => void; onCancel: () => void }) {
  const [p, setP] = useState<ExProgram>(() => structuredClone(initial.program));
  const [memberId, setMemberId] = useState<number | null>(initial.memberId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  // chi può ricevere il programma: prima gli allievi delle classi, poi gli altri della compagnia
  const groups = useMemo(() => {
    if (!classes) return [] as { label: string; people: Person[] }[];
    const inClass = new Set<number>();
    const out = classes.classes
      .filter((c) => c.members.length)
      .map((c) => {
        c.members.forEach((m) => inClass.add(m.memberId));
        return { label: c.name, people: c.members.map((m) => ({ memberId: m.memberId, name: m.name })) };
      });
    const others = classes.people.filter((x) => !inClass.has(x.memberId)).map((m) => ({ memberId: m.memberId, name: m.name }));
    if (others.length) out.push({ label: "Altri della compagnia", people: others });
    return out;
  }, [classes]);
  const everyone = groups.flatMap((g) => g.people);

  const setHeader = (k: keyof ExProgram["header"], v: string) => setP((x) => ({ ...x, header: { ...x.header, [k]: v } }));
  const setItem = (si: number, ii: number, patch: Partial<ExItem>) =>
    setP((x) => ({ ...x, sections: x.sections.map((s, a) => (a === si ? { ...s, items: s.items.map((it, b) => (b === ii ? { ...it, ...patch } : it)) } : s)) }));
  const removeItem = (si: number, ii: number) =>
    setP((x) => ({ ...x, sections: x.sections.map((s, a) => (a === si ? { ...s, items: s.items.filter((_, b) => b !== ii) } : s)).filter((s) => s.items.length) }));
  const moveItem = (si: number, ii: number, d: -1 | 1) =>
    setP((x) => ({
      ...x,
      sections: x.sections.map((s, a) => {
        if (a !== si) return s;
        const items = [...s.items];
        const j = ii + d;
        if (j < 0 || j >= items.length) return s;
        [items[ii], items[j]] = [items[j], items[ii]];
        return { ...s, items };
      }),
    }));
  const addItem = (sectionId: string, item: ExItem) =>
    setP((x) => {
      const cat = CATALOG.find((c) => c.id === sectionId);
      const has = x.sections.some((s) => s.id === sectionId);
      const sections = has
        ? x.sections.map((s) => (s.id === sectionId ? { ...s, items: [...s.items, item] } : s))
        : [...x.sections, { id: sectionId, title: cat?.title ?? "Altro", hint: cat?.hint ?? "", items: [item] }].sort((a, b) => CATALOG.findIndex((c) => c.id === a.id) - CATALOG.findIndex((c) => c.id === b.id));
      return { ...x, sections };
    });

  const total = p.sections.reduce((n, s) => n + s.items.length, 0);
  const pickedName = everyone.find((x) => x.memberId === memberId)?.name;

  async function save() {
    setBusy(true);
    setErr("");
    try {
      await saveProgram({ data: { id: initial.id, companyId, athleteMemberId: memberId, program: p } });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Programma non salvato.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Card className="grid gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-2xl leading-tight">{initial.id ? "Modifica programma" : "Nuovo programma"}</p>
            <p className="text-xs text-muted">Quello che lasci vuoto nel PDF diventa una riga da compilare a penna.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Chiudi" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.08] text-lg leading-none">×</button>
        </div>
        <Field label="Per chi è">
          <Select
            value={memberId == null ? "0" : String(memberId)}
            onChange={(e) => {
              const id = Number(e.target.value) || null;
              setMemberId(id);
              const who = everyone.find((x) => x.memberId === id);
              if (who) setHeader("athlete", who.name);
            }}
          >
            <option value="0">Scrivo il nome (non è nell'app)</option>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.people.map((x) => <option key={`${g.label}-${x.memberId}`} value={x.memberId}>{x.name}</option>)}
              </optgroup>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-[1fr_6.5rem] gap-2">
          <Field label="Nome e cognome"><TextInput value={p.header.athlete} onChange={(e) => setHeader("athlete", e.target.value)} placeholder={pickedName ?? "Lascia vuoto per scriverlo a penna"} /></Field>
          <Field label="Età"><TextInput value={p.header.age} onChange={(e) => setHeader("age", e.target.value)} placeholder="10 anni" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Compagnia"><TextInput value={p.header.company} onChange={(e) => setHeader("company", e.target.value)} /></Field>
          <Field label="Arco"><TextInput value={p.header.bow} onChange={(e) => setHeader("bow", e.target.value)} placeholder="Ricurvo 18 lb" /></Field>
          <Field label="Allenatore"><TextInput value={p.header.coach} onChange={(e) => setHeader("coach", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Dal"><TextInput value={p.header.from} onChange={(e) => setHeader("from", e.target.value)} placeholder="1/12" /></Field>
            <Field label="Al"><TextInput value={p.header.to} onChange={(e) => setHeader("to", e.target.value)} placeholder="21/12" /></Field>
          </div>
        </div>
        <Field label="Quando mi alleno"><TextInput value={p.header.days} onChange={(e) => setHeader("days", e.target.value)} /></Field>
        <Field label="Il mio obiettivo"><TextInput value={p.header.goal} onChange={(e) => setHeader("goal", e.target.value)} /></Field>
        <Field label="Livello">
          <div className="grid grid-cols-3 gap-1.5">
            {([1, 2, 3] as const).map((lv) => (
              <button key={lv} type="button" aria-pressed={p.level === lv} onClick={() => setP((x) => ({ ...x, level: lv }))} className={cx("grid justify-items-center gap-1 rounded-xl border px-2 py-2 text-xs font-semibold", p.level === lv ? "border-[#e0b15a] bg-[#e0b15a]/15 text-[#f1cf8a]" : "border-line")}>
                <LevelDots level={lv} size={8} />
                {LEVEL_NAME[lv]}
              </button>
            ))}
          </div>
        </Field>
        <button
          type="button"
          className="aa-chip justify-self-start"
          onClick={() => {
            if (!window.confirm(`Sostituire gli esercizi con il programma pronto «${LEVEL_NAME[p.level]}»? I dati dell'allievo restano.`)) return;
            setP((x) => ({ ...preset(x.level), header: x.header, notes: x.notes }));
          }}
        >
          Carica gli esercizi del livello {LEVEL_NAME[p.level].toLowerCase()}
        </button>
      </Card>

      {p.sections.map((s, si) => (
        <Card key={s.id} className="grid gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-xl leading-tight"><span className="text-muted">{si + 1}.</span> {s.title}</p>
            <span className="text-[0.68rem] text-muted">{s.hint}</span>
          </div>
          {s.items.map((it, ii) => (
            <div key={`${it.code}-${ii}`} className="grid gap-1.5 rounded-xl bg-white/[0.04] p-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 w-9 shrink-0 text-[0.68rem] font-bold text-muted">{it.code}</span>
                <span className="min-w-0 flex-1">
                  <b className="block text-sm leading-tight">{it.name}</b>
                  <span className="block text-xs text-muted">{it.how}</span>
                </span>
                <span className="flex shrink-0 flex-col gap-0.5">
                  <button type="button" aria-label="Su" onClick={() => moveItem(si, ii, -1)} className="grid h-6 w-6 place-items-center rounded bg-white/[0.06] text-xs">▲</button>
                  <button type="button" aria-label="Giù" onClick={() => moveItem(si, ii, 1)} className="grid h-6 w-6 place-items-center rounded bg-white/[0.06] text-xs">▼</button>
                </span>
              </div>
              <div className="flex items-center gap-2 pl-11">
                <TextInput value={it.dose} onChange={(e) => setItem(si, ii, { dose: e.target.value })} aria-label="Quanto" className="!min-h-9 flex-1 !py-1 text-sm" />
                <button type="button" onClick={() => setItem(si, ii, { level: ((it.level % 3) + 1) as Level })} className="flex min-h-9 items-center rounded-lg bg-white/[0.06] px-2 text-[#e0b15a]" aria-label={`Difficoltà ${it.level}: tocca per cambiare`}>
                  <LevelDots level={it.level} size={8} />
                </button>
                <button type="button" onClick={() => removeItem(si, ii)} aria-label={`Togli ${it.name}`} className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.06] text-lg leading-none">×</button>
              </div>
            </div>
          ))}
          <AddExercise sectionId={s.id} present={s.items.map((x) => x.code)} open={open === s.id} onOpen={(v) => setOpen(v ? s.id : null)} onAdd={(it) => addItem(s.id, it)} />
        </Card>
      ))}

      <Card className="grid gap-2">
        <p className="text-sm font-semibold">Aggiungi una categoria</p>
        <div className="flex flex-wrap gap-1.5">
          {CATALOG.filter((c) => !p.sections.some((s) => s.id === c.id)).map((c) => (
            <button key={c.id} type="button" className="aa-chip" onClick={() => setOpen(c.id)}>+ {c.title}</button>
          ))}
        </div>
        {open && !p.sections.some((s) => s.id === open) ? <AddExercise sectionId={open} present={[]} open onOpen={(v) => !v && setOpen(null)} onAdd={(it) => { addItem(open, it); }} /> : null}
        <Field label="Note per l'allievo (vanno in fondo al PDF)"><TextArea value={p.notes} onChange={(e) => setP((x) => ({ ...x, notes: e.target.value }))} rows={3} placeholder="Lascia vuoto per avere le righe da scrivere a mano" /></Field>
      </Card>

      {err ? <ErrorNote text={err} /> : null}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-10 grid grid-cols-3 gap-2 rounded-2xl bg-[#0c1410]/90 p-2 backdrop-blur">
        <Button variant="ghost" onClick={() => void sendProgram(p, "scarica")}><Glyph name="download" size={16} /> PDF</Button>
        <Button variant="ghost" onClick={() => void sendProgram(p, "whatsapp")}><Glyph name="share" size={16} /> WhatsApp</Button>
        <Button onClick={() => void save()} disabled={busy || !total}>{busy ? "Salvo…" : "Salva"}</Button>
      </div>
    </div>
  );
}

/** aggiunge un esercizio della categoria (dal catalogo) o uno scritto dall'allenatore */
function AddExercise({ sectionId, present, open, onOpen, onAdd }: { sectionId: string; present: string[]; open: boolean; onOpen: (v: boolean) => void; onAdd: (it: ExItem) => void }) {
  const cat = CATALOG.find((c) => c.id === sectionId);
  const [mine, setMine] = useState<ExItem>({ code: "", name: "", how: "", dose: "", level: 1 });
  if (!open) return <button type="button" className="aa-chip justify-self-start" onClick={() => onOpen(true)}>+ Esercizio</button>;
  const free = (cat?.items ?? []).filter((x) => !present.includes(x.code));
  return (
    <div className="grid gap-2 rounded-xl border border-dashed border-line p-2.5">
      <p className="text-xs font-semibold">{cat?.title ?? "Esercizi"}</p>
      {free.length ? (
        <div className="grid gap-1">
          {free.map((it) => (
            <button key={it.code} type="button" onClick={() => onAdd(it)} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5 text-left text-sm">
              <span className="w-9 shrink-0 text-[0.68rem] font-bold text-muted">{it.code}</span>
              <span className="min-w-0 flex-1 truncate">{it.name} <span className="text-xs text-muted">· {it.dose}</span></span>
              <span className="text-[#e0b15a]"><LevelDots level={it.level} size={7} /></span>
            </button>
          ))}
        </div>
      ) : <p className="text-xs text-muted">Gli esercizi di questa categoria sono già tutti nel programma.</p>}
      <p className="pt-1 text-xs font-semibold">Oppure scrivine uno tuo</p>
      <TextInput value={mine.name} onChange={(e) => setMine({ ...mine, name: e.target.value })} placeholder="Nome (es. Tiro con il vento)" />
      <TextInput value={mine.how} onChange={(e) => setMine({ ...mine, how: e.target.value })} placeholder="Come si fa, in una frase semplice" />
      <TextInput value={mine.dose} onChange={(e) => setMine({ ...mine, dose: e.target.value })} placeholder="Quanto (es. 3 × 10, 2 minuti)" />
      <div className="flex gap-1.5">
        <button
          type="button"
          className="aa-chip"
          disabled={!mine.name.trim()}
          onClick={() => {
            const prefix = (cat?.items[0]?.code.replace(/\d+$/, "") || "X").slice(0, 3);
            onAdd({ ...mine, code: `${prefix}+`, name: mine.name.trim(), how: mine.how.trim(), dose: mine.dose.trim() || "—" });
            setMine({ code: "", name: "", how: "", dose: "", level: 1 });
          }}
        >
          Aggiungi il mio
        </button>
        <button type="button" className="aa-chip" onClick={() => onOpen(false)}>Chiudi</button>
      </div>
    </div>
  );
}
