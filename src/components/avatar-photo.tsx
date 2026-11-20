import { useRef, useState } from "react";
import type { AvatarLook } from "@/lib/arcieri/avatar";
import { updateMember } from "@/lib/arcieri/members.api";
import { AvatarFace } from "./archer-avatar";
import { Glyph } from "./icons";

/** Disegna il volto dell'arciere in un'immagine JPEG quadrata (per la foto profilo). */
export async function faceToJpeg(svg: SVGSVGElement, size = 320): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(size));
  clone.setAttribute("height", String(size));
  const text = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Tela non disponibile");
    ctx.drawImage(img, 0, 0, size, size);
    return c.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Pulsante: il volto del tuo arciere diventa la foto profilo (visibile in squadra, classifiche, gare). */
export function AvatarPhotoButton({ look, onDone }: { look: AvatarLook; onDone?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"" | "busy" | "ok" | "err">("");
  const go = async () => {
    const svg = box.current?.querySelector("svg");
    if (!svg) return;
    setState("busy");
    try {
      const data = await faceToJpeg(svg as SVGSVGElement);
      await updateMember({ data: { photoUrl: data } });
      setState("ok");
      onDone?.();
    } catch {
      setState("err");
    }
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white/[0.03] p-2.5">
      <div ref={box} className="h-12 w-12 shrink-0 overflow-hidden rounded-full">
        <AvatarFace look={look} className="h-12 w-12" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Foto profilo</p>
        <p className="text-xs text-muted">{state === "ok" ? "Fatto: ora la squadra vede il tuo arciere." : state === "err" ? "Non riuscito, riprova." : "Usa il volto del tuo arciere come foto."}</p>
      </div>
      <button type="button" disabled={state === "busy"} onClick={() => void go()} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-fg disabled:opacity-60">
        <Glyph name={state === "ok" ? "check" : "camera"} size={15} />
        {state === "busy" ? "…" : "Usa"}
      </button>
    </div>
  );
}
