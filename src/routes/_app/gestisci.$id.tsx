import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { manageDelete, manageProfile, type ManageItem, type ManageKind } from "@/lib/arcieri/gestione.api";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, Empty, ErrorNote, Loading } from "@/components/kit";

export const Route = createFileRoute("/_app/gestisci/$id")({ component: Page });

const GROUPS: { kind: ManageKind; label: string }[] = [
  { kind: "allenamento", label: "Allenamenti" },
  { kind: "gara", label: "Gare" },
  { kind: "gesto", label: "Analisi del gesto" },
  { kind: "attrezzo", label: "Attrezzatura" },
  { kind: "assetto", label: "Assetti" },
  { kind: "obiettivo", label: "Obiettivi" },
  { kind: "acquisto", label: "Lista acquisti" },
  { kind: "gioco", label: "Record del gioco" },
];

function day(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

function Page() {
  const { id } = Route.useParams();
  const memberId = Number(id);
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`manage-${memberId}-${nonce}`, () => manageProfile({ data: { memberId } }));
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<ManageKind | null>("allenamento");
  const items = useMemo(() => (data?.items ?? []).filter((i) => !gone.has(`${i.kind}:${i.id}`)), [data, gone]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorNote text={error} />;
  if (!data) return null;
  const { member } = data;

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-xs font-semibold text-muted">Gestione profilo · solo fondatore</p>
        <h1 className="font-display text-3xl leading-tight">{member.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Qui elimini i dati inseriti da {member.name.split(" ")[0]}. La persona non riceve avvisi. Messaggi privati e accesso non si gestiscono da qui.
        </p>
        <Link to="/arciere/$id" params={{ id: String(member.id) }} className="mt-2 inline-block text-sm font-semibold text-accent underline-offset-2 hover:underline">
          Torna al profilo
        </Link>
      </div>
      {!member.hasAccount ? <Card className="text-sm">Senza account: ci sono solo le analisi del gesto inserite dagli allenatori.</Card> : null}
      {GROUPS.map((g) => {
        const list = items.filter((i) => i.kind === g.kind);
        if (!list.length && (g.kind === "gioco" || g.kind === "assetto")) return null;
        const isOpen = open === g.kind;
        return (
          <Card key={g.kind} className="grid gap-2 p-0">
            <button type="button" onClick={() => setOpen(isOpen ? null : g.kind)} aria-expanded={isOpen} className="flex min-h-12 items-center justify-between gap-3 px-4 text-left">
              <span className="font-display text-lg">{g.label}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-sm tabular-nums">{list.length}</span>
            </button>
            {isOpen ? (
              <div className="grid gap-1 px-2 pb-2">
                {list.length ? list.map((it) => <Row key={`${it.kind}:${it.id}`} item={it} memberId={member.id} onGone={() => setGone((s) => new Set(s).add(`${it.kind}:${it.id}`))} />) : <Empty title="Niente da gestire" />}
              </div>
            ) : null}
          </Card>
        );
      })}
      <Button variant="ghost" onClick={() => { setGone(new Set()); setNonce((n) => n + 1); }}>Aggiorna l'elenco</Button>
    </div>
  );
}

function Row({ item, memberId, onGone }: { item: ManageItem; memberId: number; onGone: () => void }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function remove() {
    setBusy(true);
    setErr("");
    try {
      await manageDelete({ data: { memberId, kind: item.kind, id: item.id } });
      onGone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Non riesco a eliminare.");
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-1 rounded-xl bg-white/[0.04] px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{item.title}</p>
          <p className="truncate text-xs text-muted">{[day(item.at), item.sub].filter(Boolean).join(" · ")}</p>
        </div>
        {ask ? (
          <span className="flex shrink-0 gap-1.5">
            <Button variant="ghost" className="min-h-10 px-3" disabled={busy} onClick={() => setAsk(false)}>No</Button>
            <Button variant="danger" className="min-h-10 px-3" disabled={busy} onClick={remove}>{busy ? "…" : "Elimina"}</Button>
          </span>
        ) : (
          <Button variant="ghost" className="min-h-10 shrink-0 px-3" onClick={() => setAsk(true)}>Elimina</Button>
        )}
      </div>
      {err ? <p className="text-xs text-danger">{err}</p> : null}
    </div>
  );
}
