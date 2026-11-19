import { useRef } from "react";

/**
 * Due strade per la stessa cosa: scattare/registrare adesso, oppure prendere
 * un file già fatto dall'album. L'attributo `capture` obbliga il telefono ad
 * aprire la fotocamera, quindi l'album usa un input senza `capture`.
 */
export function MediaPick({
  kind,
  onFile,
  shootLabel,
  albumLabel,
  className = "",
}: {
  kind: "image" | "video";
  onFile: (file: File) => void;
  shootLabel?: string;
  albumLabel?: string;
  className?: string;
}) {
  const shoot = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const accept = kind === "image" ? "image/*" : "video/*";
  const take = (input: HTMLInputElement | null) => {
    const file = input?.files?.[0];
    if (file) onFile(file);
    if (input) input.value = "";
  };
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <button type="button" onClick={() => shoot.current?.click()} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm font-semibold">
        {shootLabel ?? (kind === "image" ? "📷 Scatta foto" : "🎥 Registra video")}
      </button>
      <button type="button" onClick={() => album.current?.click()} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm font-semibold">
        {albumLabel ?? (kind === "image" ? "🖼️ Dall'album" : "🎞️ Dalla galleria")}
      </button>
      <input ref={shoot} type="file" accept={accept} capture="environment" className="hidden" onChange={(e) => take(e.currentTarget)} />
      <input ref={album} type="file" accept={accept} className="hidden" onChange={(e) => take(e.currentTarget)} />
    </div>
  );
}
