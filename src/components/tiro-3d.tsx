import { useEffect, useRef, useState } from "react";
import { tiro3dPage } from "@/lib/arcieri/prova3d.api";
import type { TiroCfg } from "@/lib/arcieri/tiro3d";

/** la pagina 3D si scarica una volta per sessione (animazioni comprese) e resta in memoria */
let pageCache: Promise<string | null> | null = null;
function loadPage() {
  pageCache ??= tiro3dPage()
    .then((r) => (r.ok ? r.html.replace("__BASE__", `${window.location.origin}/prova3d/`) : null))
    .catch(() => {
      pageCache = null;
      return null;
    });
  return pageCache;
}

/**
 * Il tiro in 3D con i modelli veri: l'arciere animato (corpo e abiti presi dal tuo avatar), arco lungo o
 * ricurvo, paglione con il cavalletto e frecce di legno che volano lungo la traiettoria del simulatore e si
 * piantano dove dice il calcolo. Dentro c'è la scelta del punto di vista; se il 3D vero non parte, `onFail`
 * lascia il posto al tiro disegnato.
 */
export function Tiro3D({ cfg, replay = 0, onFail, className = "h-[30rem]" }: { cfg: TiroCfg; /** cambia: si ritira da capo */ replay?: number; onFail: () => void; className?: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const failRef = useRef(onFail);
  failRef.current = onFail;

  useEffect(() => {
    let off = false;
    void loadPage().then((h) => {
      if (off) return;
      if (h) setHtml(h);
      else failRef.current();
    });
    return () => {
      off = true;
    };
  }, []);

  // la scena chiede la configurazione quando è pronta; poi la riceve a ogni cambio del simulatore
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if ((e.data as { type?: string } | null)?.type === "tiro-pronto") frame.current?.contentWindow?.postMessage({ type: "tiro", cfg: cfgRef.current }, "*");
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: "tiro", cfg }, "*");
  }, [cfg, replay]);

  if (!html) return <div className={`grid w-full place-items-center rounded-2xl bg-[#16211a] text-sm text-white/70 ${className}`}>Preparo il campo in 3D…</div>;
  return <iframe ref={frame} title="Tiro in 3D: arciere, traiettoria e paglione" srcDoc={html} allow="fullscreen" className={`block w-full rounded-2xl border-0 bg-[#16211a] ${className}`} />;
}
