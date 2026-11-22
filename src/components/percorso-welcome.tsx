import { useState } from "react";
import { createPortal } from "react-dom";
import { setPercorso } from "@/lib/arcieri/account.api";
import { PERCORSI, type Percorso } from "@/lib/arcieri/percorso";
import { shortcutById } from "@/lib/arcieri/shortcuts";
import { AppIcon } from "./icons";
import { cx } from "./kit";

const ICON = { principiante: "target", compagnia: "bow", istruttore: "team" } as const;

/**
 * Secondo passo del primo accesso, solo per chi entra da ora: "Come tiri?".
 * La scelta decide le funzioni mostrate prima nel Menu e le scorciatoie della Casa.
 * Chi aveva già l'account non vede mai questa domanda.
 */
export function PercorsoWelcome({ onDone }: { onDone: () => void }) {
  const [pick, setPick] = useState<Percorso>("compagnia");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (typeof document === "undefined") return null;
  const chosen = PERCORSI.find((p) => p.id === pick) ?? PERCORSI[1];
  async function go() {
    setBusy(true);
    setErr("");
    try {
      await setPercorso({ data: { percorso: pick } });
      try {
        // le scorciatoie della Casa partono da quelle del percorso; poi ognuno le cambia come vuole
        localStorage.setItem("aa-shortcuts-v1", JSON.stringify(chosen.focus));
        window.dispatchEvent(new Event("aa-shortcuts"));
      } catch {
        /* memoria non disponibile */
      }
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Non riuscito");
      setBusy(false);
    }
  }
  return createPortal(
    <div className="fixed inset-0 z-[79] overflow-y-auto bg-[#07100b]/95 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Come tiri?">
      <div className="mx-auto grid min-h-full max-w-md content-start gap-4 px-4 pb-10 pt-[calc(env(safe-area-inset-top)+2rem)]">
        <div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-white/60">Benvenuto · ultimo passo</p>
          <h2 className="font-display text-4xl leading-none text-white">Come tiri oggi?</h2>
          <p className="mt-2 text-sm text-white/70">Ti mostriamo prima le 6 funzioni che ti servono. Le altre arrivano da sole dopo qualche allenamento, o quando vuoi dal Menu.</p>
        </div>
        <div className="grid gap-2.5" role="radiogroup">
          {PERCORSI.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={pick === p.id}
              onClick={() => setPick(p.id)}
              className={cx("aa-press flex items-center gap-3 rounded-[1.4rem] border p-3.5 text-left transition", pick === p.id ? "border-[#7cf0a8] bg-[#7cf0a8]/10 shadow-[0_10px_30px_-12px_rgba(61,143,95,0.6)]" : "border-white/10 bg-white/[0.04]")}
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${p.color}26` }}>
                <AppIcon name={ICON[p.id]} color={p.color} size={34} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-white">{p.title}</span>
                <span className="block text-xs text-white/65">{p.text}</span>
              </span>
              <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2", pick === p.id ? "border-[#7cf0a8]" : "border-white/25")}>
                {pick === p.id ? <span className="h-2.5 w-2.5 rounded-full bg-[#7cf0a8]" /> : null}
              </span>
            </button>
          ))}
        </div>
        <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-3.5">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#7cf0a8]">Vedrai subito</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {chosen.focus.map((id) => (
              <FocusItem key={id} id={id} />
            ))}
          </div>
        </div>
        {err ? <p className="text-center text-sm text-red-300">{err}</p> : null}
        <button type="button" disabled={busy} onClick={() => void go()} className="aa-press min-h-12 rounded-2xl bg-primary text-base font-bold text-primary-fg">
          {busy ? "Un attimo…" : "Continua"}
        </button>
      </div>
    </div>,
    document.body,
  );
}


function FocusItem({ id }: { id: string }) {
  const s = shortcutById(id);
  if (!s) return null;
  return (
    <span className="flex flex-col items-center gap-1 text-center">
      <AppIcon name={s.icon} color={s.color} size={40} />
      <span className="w-full truncate text-[0.66rem] font-semibold text-white/85">{s.label}</span>
    </span>
  );
}
