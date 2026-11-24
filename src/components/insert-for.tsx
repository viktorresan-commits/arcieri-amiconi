import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card, ErrorNote, cx } from "./kit";
import { AppIcon, type IconName } from "./icons";
import { useMemberMaybe } from "./shell";
import { startActing } from "@/lib/arcieri/acting.api";
import { clearLoadCache } from "@/lib/arcieri/use-load";

type Kind = { id: string; label: string; hint: string; icon: IconName; color: string; to: string; search?: Record<string, string>; account: boolean };

const KINDS: Kind[] = [
  { id: "gesto", label: "Analisi del gesto", hint: "Video o foto con lo scheletro", icon: "archer", color: "#7652d1", to: "/allenamento", search: { avvia: "gesto" }, account: false },
  { id: "bersaglio", label: "Punti al bersaglio", hint: "Allenamento volée per volée", icon: "target", color: "#2c8a57", to: "/allenamento", account: true },
  { id: "fatto", label: "Tiro già fatto", hint: "Sagome o bersaglio, a posteriori", icon: "notebook", color: "#3f8a76", to: "/allenamento", search: { avvia: "fatto" }, account: true },
  { id: "gara", label: "Gara", hint: "Punteggio, piazzole e posizione", icon: "trophy", color: "#c39320", to: "/gare", account: true },
];

/**
 * «Inserisci per …»: l'allenatore (o il fondatore) passa a salvare dati a nome dell'allievo.
 * Finché resta attivo, in alto compare la fascia «Stai inserendo per …» con il tasto Fine.
 */
export function InsertFor({ memberId, name, hasAccount = true, only }: { memberId: number; name: string; hasAccount?: boolean; only?: string[] }) {
  const ctx = useMemberMaybe();
  const navigate = useNavigate();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const first = name.split(" ")[0] || name;
  const kinds = KINDS.filter((k) => (!only || only.includes(k.id)) && (hasAccount || !k.account));
  async function go(k: Kind) {
    setBusy(k.id);
    setError("");
    try {
      await startActing({ data: { memberId } });
      clearLoadCache();
      ctx?.reload();
      void navigate({ to: k.to, search: k.search as never });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non riesco ad aprire l'inserimento.");
    } finally {
      setBusy("");
    }
  }
  return (
    <Card className="grid gap-3">
      <span>
        <span className="block font-display text-lg leading-tight">Inserisci per {first}</span>
        <span className="block text-xs text-muted">Quello che salvi finisce nelle statistiche di {first}. In alto vedi per chi stai inserendo; tocca Fine quando hai finito.</span>
      </span>
      <div className="grid grid-cols-2 gap-2">
        {kinds.map((k) => (
          <button
            key={k.id}
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void go(k)}
            className={cx("aa-press flex items-center gap-2.5 rounded-2xl border border-line bg-white/5 p-2.5 text-left disabled:opacity-60", busy === k.id && "animate-pulse")}
          >
            <AppIcon name={k.icon} color={k.color} size={40} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight">{k.label}</span>
              <span className="block text-[0.7rem] leading-snug text-muted">{k.hint}</span>
            </span>
          </button>
        ))}
      </div>
      {!hasAccount ? <p className="text-xs text-muted">{first} non ha ancora un account: per ora puoi aggiungere solo l'analisi del gesto.</p> : null}
      {error ? <ErrorNote text={error} /> : null}
    </Card>
  );
}
