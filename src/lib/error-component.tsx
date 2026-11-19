import { useEffect } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "Qualcosa non ha funzionato. Ricarica la pagina.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

function isStaleChunk(message: string) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(message);
}

export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  const message = errorMessage(error);
  useEffect(() => {
    if (!isStaleChunk(message)) return;
    try {
      if (sessionStorage.getItem("aa-chunk-reload") === "1") return;
      sessionStorage.setItem("aa-chunk-reload", "1");
    } catch {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(Date.now()));
    window.location.replace(url.toString());
  }, [message]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center text-zinc-50">
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Non riesco ad aprire questa pagina</h1>
      <p className="max-w-md text-sm break-words text-zinc-400">{message}</p>
      <button
        type="button"
        className="mt-2 min-h-11 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-950"
        onClick={() => {
          try { sessionStorage.removeItem("aa-chunk-reload"); } catch { /* ignore */ }
          reset?.();
          window.location.reload();
        }}
      >
        Ricarica
      </button>
    </main>
  );
}
