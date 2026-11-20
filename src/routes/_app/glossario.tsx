import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { GLOSSARY } from "@/lib/arcieri/learn";

export const Route = createFileRoute("/_app/glossario")({ component: Page });

function Page() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const list = GLOSSARY.filter(([t, d]) => (t + " " + d).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="grid gap-3">
      <PageHead kicker="Impara" title="Glossario" lede="Le parole dell'arciere, spiegate in breve." />
      <label className="flex items-center gap-2 rounded-2xl border border-hair bg-black/20 px-3">
        <Glyph name="eye" size={16} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca una parola" className="min-h-12 w-full bg-transparent text-sm outline-none" />
      </label>
      <Card className="grid gap-0.5">
        {list.map(([t, d], i) => (
          <button key={t} type="button" onClick={() => setOpen(open === t ? null : t)} className="aa-menu-row grid gap-0.5 rounded-xl px-2 py-2 text-left active:bg-white/5" style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}>
            <span className="flex items-center justify-between font-semibold">{t}<Glyph name="chevron" size={14} className={`text-muted transition-transform ${open === t ? "rotate-90" : ""}`} /></span>
            {open === t || q ? <span className="aa-rise text-sm text-muted">{d}</span> : null}
          </button>
        ))}
        {!list.length ? <p className="p-2 text-sm text-muted">Nessuna parola trovata.</p> : null}
      </Card>
    </div>
  );
}
