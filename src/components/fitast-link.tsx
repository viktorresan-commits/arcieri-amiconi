/**
 * Il nome FITAST del profilo: invito a collegarlo, ricerca tra i nomi delle classifiche del portale,
 * e per il presidente della compagnia il collegamento dei compagni. Usato in Gare e nel profilo.
 */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Glyph } from "@/components/icons";
import { Avatar, Button, ErrorNote, Loading, TextInput, cx } from "@/components/kit";
import { CrestMark, FitastLogo, type Crest } from "@/components/fitast-league";
import { fitastLinkState, fitastNameSearch, setFitastLink } from "@/lib/arcieri/fitast-link.api";
import { titleName } from "@/lib/arcieri/fitast-league";
import { memberLabel } from "@/lib/arcieri/labels";
import { messageOf, useLoad } from "@/lib/arcieri/use-load";

type Person = Awaited<ReturnType<typeof fitastLinkState>>["mates"][number];
type Target = { userId: string; label: string; self: boolean; linked: string; team: string };

const nameOf = (p: Person) => memberLabel(p, [p]);
const noCrest = (): Crest | null => null;

/**
 * In Gare (e nel profilo): se il nome non è collegato invita a farlo; se lo è, lo mostra con «Cambia».
 * Il presidente vede anche quanti compagni non sono ancora collegati.
 */
export function FitastLinkCard({ onChanged, crestOf = noCrest, always = false }: { onChanged?: () => void; crestOf?: (t: string) => Crest | null; /** mostra la riga anche quando è collegato (nel profilo) */ always?: boolean }) {
  const [nonce, setNonce] = useState(0);
  const { data } = useLoad(`fitast-link-${nonce}`, () => fitastLinkState());
  const [target, setTarget] = useState<Target | null>(null);
  const [mates, setMates] = useState(false);
  if (!data) return null;
  const me = data.me;
  const linked = me.fitastName.trim();
  const unlinked = data.mates.filter((m) => !m.fitastName.trim() && !m.reserved);
  // collegato in modo riservato dal fondatore: per l'arciere qui non c'è niente da fare né da vedere
  const reserved = me.reserved;
  const done = () => {
    setTarget(null);
    setNonce((n) => n + 1);
    onChanged?.();
  };
  const mine: Target = { userId: me.userId, label: nameOf(me), self: true, linked, team: me.fitastTeam };
  return (
    <>
      {reserved ? null : !linked ? (
        <button type="button" onClick={() => setTarget(mine)} className="aa-press flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-[#e0b15a]/30 bg-[#e0b15a]/[0.07] p-3 text-left">
          <FitastLogo size={44} />
          <span className="min-w-0 flex-1">
            <b className="block">Collega il tuo nome FITAST</b>
            <span className="block text-xs text-muted">Le gare del campionato si riempiono da sole con il tuo posto e i punti campionato.</span>
          </span>
          <Glyph name="chevron" size={16} className="text-muted" />
        </button>
      ) : always ? (
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
          <CrestMark crest={crestOf(me.fitastTeam || data.team)} team={me.fitastTeam || data.team} size={34} />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted">Su FITAST sei</span>
            <b className="block truncate">{titleName(linked)}</b>
            {me.fitastTeam ? <span className="block truncate text-xs text-muted">{titleName(me.fitastTeam)}</span> : null}
          </span>
          <button type="button" onClick={() => setTarget(mine)} className="aa-chip shrink-0">Cambia</button>
        </div>
      ) : null}
      {data.canManage && data.mates.length && (always || unlinked.length) ? (
        <button type="button" onClick={() => setMates(true)} className="aa-press flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[0.06]"><Glyph name="duel" size={20} /></span>
          <span className="min-w-0 flex-1">
            <b className="block text-sm">{unlinked.length ? `${unlinked.length} ${unlinked.length === 1 ? "compagno non ancora collegato" : "compagni non ancora collegati"}` : "Tutti i compagni sono collegati"}</b>
            <span className="block text-xs text-muted">{data.founder ? "Da fondatore puoi scegliere il nome FITAST di ognuno: resta riservato, lo vedi solo tu." : "Da presidente puoi scegliere il nome FITAST di ognuno."}</span>
          </span>
          <Glyph name="chevron" size={16} className="text-muted" />
        </button>
      ) : null}
      {mates ? (
        <Sheet title={data.founder ? "Nomi FITAST degli arcieri" : "Nomi FITAST dei compagni"} sub={data.founder ? "Scegli il nome con cui il portale conosce ognuno. Nessun avviso all'arciere: il collegamento lo vedi solo tu." : "Scegli il nome con cui il portale conosce ognuno."} onClose={() => setMates(false)}>
          <ol className="grid gap-1.5">
            {[...unlinked, ...data.mates.filter((m) => m.fitastName.trim() || m.reserved)].map((m) => (
              <li key={m.userId} className="flex items-center gap-2.5 rounded-xl bg-white/[0.035] px-2.5 py-2">
                <Avatar size="sm" label={nameOf(m)} color={m.avatarColor} photo={m.photoUrl} userId={m.userId} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{nameOf(m)}</b>
                  <span className="block truncate text-xs text-muted">{m.reserved ? "collegato" : m.fitastName ? `su FITAST: ${titleName(m.fitastName)}` : "non collegato"}</span>
                </span>
                {m.reserved ? null : (
                  <button type="button" onClick={() => setTarget({ userId: m.userId, label: nameOf(m), self: false, linked: m.fitastName, team: m.fitastTeam })} className={cx("aa-chip shrink-0", !m.fitastName && "border-[#e0b15a]/60 bg-[#e0b15a]/15 text-[#f1cf8a]")}>
                    {m.fitastName ? "Cambia" : "Collega"}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </Sheet>
      ) : null}
      {target ? <LinkSheet target={target} crestOf={crestOf} onClose={() => setTarget(null)} onDone={done} /> : null}
    </>
  );
}

/** ricerca del nome nelle classifiche e conferma */
function LinkSheet({ target, crestOf, onClose, onDone }: { target: Target; crestOf: (t: string) => Crest | null; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setQ(text.trim()), 300);
    return () => window.clearTimeout(t);
  }, [text]);
  const { data, error, loading } = useLoad(`fitast-search-${target.userId}-${q}`, () => fitastNameSearch({ data: { q, userId: target.self ? "" : target.userId } }));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const pick = async (name: string, team: string) => {
    setBusy(name || "-");
    setErr("");
    try {
      await setFitastLink({ data: { userId: target.self ? "" : target.userId, name, team } });
      onDone();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy("");
    }
  };
  const results = data?.results ?? [];
  return (
    <Sheet
      title={target.self ? "Il tuo nome su FITAST" : `Il nome FITAST di ${target.label}`}
      sub={target.self ? "Scegli il tuo nome nelle classifiche del portale: le gare del campionato si riempiono da sole con i tuoi risultati." : "Scegli il suo nome nelle classifiche del portale: le sue gare del campionato si riempiono da sole."}
      onClose={onClose}
    >
      <div className="grid gap-3">
        <label className="relative block">
          <span className="sr-only">Cerca nome o cognome</span>
          <Glyph name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Cerca nome o cognome" className="w-full pl-9" autoFocus />
        </label>
        {err ? <ErrorNote text={err} /> : null}
        {error ? <ErrorNote text={error} /> : loading && !data ? <Loading /> : data?.empty ? (
          <p className="text-sm text-muted">Le classifiche del portale non sono ancora state lette. Aprile da Compagnie con «Aggiorna dal portale», poi torna qui.</p>
        ) : !results.length ? (
          <p className="text-sm text-muted">{q ? "Nessun nome trovato. Prova con il solo cognome." : "Scrivi il tuo nome o il tuo cognome come lo usa il portale."}</p>
        ) : (
          <>
            {!q ? <p className="text-xs text-muted">Nomi che somigliano al profilo:</p> : null}
            <ol className="grid gap-1.5">
              {results.map((r) => {
                const current = target.linked && r.name.toLowerCase() === target.linked.toLowerCase() && (!target.team || r.team.toLowerCase() === target.team.toLowerCase());
                return (
                  <li key={`${r.name}|${r.team}`} className={cx("flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5", r.sameTeam ? "border border-[#e0b15a]/40 bg-[#e0b15a]/[0.07]" : "bg-white/[0.035]")}>
                    <CrestMark crest={crestOf(r.team)} team={r.team} size={34} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm">{r.label}</b>
                      <span className="block truncate text-xs">{r.teamLabel}</span>
                      <span className="block truncate text-[0.7rem] text-muted">{[r.category, r.gare ? `${r.gare} ${r.gare === 1 ? "gara" : "gare"}` : "", r.points != null ? `${r.points} pt camp.` : ""].filter(Boolean).join(" · ")}</span>
                    </span>
                    {current ? (
                      <span className="shrink-0 text-xs text-[#7fd49a]">collegato</span>
                    ) : r.takenBy ? (
                      <span className="max-w-[6.5rem] shrink-0 text-right text-[0.7rem] leading-tight text-muted">già di {r.takenBy}</span>
                    ) : (
                      <Button className="shrink-0 px-3 text-sm" variant={r.sameTeam ? "primary" : "ghost"} disabled={Boolean(busy)} onClick={() => void pick(r.name, r.team)}>
                        {busy === r.name ? "…" : target.self ? "Sono io" : "È lui"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="text-[0.72rem] text-muted">In alto c'è chi è della stessa compagnia. Il collegamento si può cambiare o togliere quando vuoi.</p>
          </>
        )}
        {target.linked ? (
          <button type="button" disabled={Boolean(busy)} onClick={() => void pick("", "")} className="justify-self-center text-xs text-muted underline underline-offset-2">
            Togli il collegamento
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}

function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 backdrop-blur-[3px] md:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="aa-sheet grid max-h-[88dvh] w-full max-w-lg grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-t-3xl border-t border-hair bg-elev p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:rounded-3xl md:border" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl leading-tight">{title}</h2>
            {sub ? <p className="mt-0.5 text-sm text-muted">{sub}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06]">
            <Glyph name="close" size={18} />
          </button>
        </header>
        <div className="-mx-1 overflow-y-auto px-1 pt-1">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
