import { useRef } from "react";
import { Glyph } from "./icons";

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
      <button type="button" onClick={() => shoot.current?.click()} className="aa-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-hair bg-white/[0.05] px-3 text-sm font-semibold">
        <Glyph name={kind === "image" ? "camera" : "video"} size={17} className="shrink-0 opacity-90" />
        {shootLabel ?? (kind === "image" ? "Scatta foto" : "Registra video")}
      </button>
      <button type="button" onClick={() => album.current?.click()} className="aa-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-hair bg-white/[0.05] px-3 text-sm font-semibold">
        <Glyph name="image" size={17} className="shrink-0 opacity-90" />
        {albumLabel ?? (kind === "image" ? "Dall'album" : "Dalla galleria")}
      </button>
      <input ref={shoot} type="file" accept={accept} capture="environment" className="hidden" onChange={(e) => take(e.currentTarget)} />
      <input ref={album} type="file" accept={accept} className="hidden" onChange={(e) => take(e.currentTarget)} />
    </div>
  );
}
