import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Glyph } from "@/components/icons";
import { Card } from "@/components/kit";
import { prova3dPage, prova3dUpload } from "@/lib/arcieri/prova3d.api";
import { messageOf } from "@/lib/arcieri/use-load";

/**
 * Pagina nascosta: la prova dell'arciere 3D (corpi e abiti liberi, animazioni da arco vere).
 * Non è in nessun menu; la apre solo il Fondatore dalla pagina Avatar. Il server la consegna
 * solo a lui: a chiunque altro risponde come a un indirizzo che non esiste.
 */
export const Route = createFileRoute("/_app/prova-3d")({
  component: Prova3d,
});

type View = { html: string } | { upload: true } | { msg: string } | null;

function Prova3d() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let off = false;
    prova3dPage()
      .then((r) => {
        if (off) return;
        if (r.ok) setView({ html: r.html.replace("__BASE__", `${window.location.origin}/prova3d/`) });
        else setView(r.reason === "animazioni" ? { upload: true } : { msg: "Pagina non trovata." });
      })
      .catch(() => {
        if (!off) setView({ msg: "Pagina non trovata." });
      });
    return () => {
      off = true;
    };
  }, [nonce]);

  if (!view) return <p className="py-10 text-center text-sm text-muted">Un momento…</p>;
  if ("msg" in view) return <p className="py-10 text-center text-sm text-muted">{view.msg}</p>;
  if ("upload" in view) return <UploadClips onDone={() => { setView(null); setNonce((n) => n + 1); }} />;

  const back = () => (window.history.length > 1 ? window.history.back() : void navigate({ to: "/" }));
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#101813]">
      <div className="flex items-center gap-2 px-2 pb-1 pt-[calc(env(safe-area-inset-top)+0.35rem)]">
        <button type="button" onClick={back} aria-label="Torna all'app" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white active:scale-95">
          <Glyph name="chevron" size={18} className="rotate-180" />
        </button>
        <p className="truncate text-sm font-semibold text-white/75">Torna all'app</p>
      </div>
      <iframe title="Prova dell'arciere 3D" srcDoc={view.html} allow="fullscreen" className="min-h-0 w-full flex-1 border-0" />
      <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
    </div>
  );
}

/** primo passo, una volta sola: il file delle animazioni da arco, che non può stare nel codice */
function UploadClips({ onDone }: { onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await prova3dUpload({ data: { text: await file.text() } });
      onDone();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <Card className="grid gap-3">
      <p className="font-display text-xl leading-tight">Prova dell'arciere 3D</p>
      <p className="text-sm text-muted">
        Manca un passo, una volta sola: carica il file <span className="font-semibold text-fg">arco-clips.json</span> che ti ho mandato in chat. Sono le animazioni da arco: la loro licenza non permette di metterle nel codice, così restano nel database e le vedi solo tu.
      </p>
      <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="aa-press min-h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-60">
        {busy ? "Carico…" : "Scegli il file"}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </Card>
  );
}
