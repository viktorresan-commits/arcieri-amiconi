/**
 * Palmarès: medaglie e podi. Nella scheda dell'arciere i suoi podi di gara; nella compagnia la bacheca
 * dei trofei di squadra (scritti dal capo compagnia o dallo staff) e i podi di tutti i suoi arcieri.
 */
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Card, ErrorNote, Field, Select, TextInput, cx } from "@/components/kit";
import { archerPodiums, companyPalmares, deleteCompanyAward, saveCompanyAward, type Award, type Podium } from "@/lib/arcieri/palmares.api";
import { useLoad } from "@/lib/arcieri/use-load";

const METAL: Record<number, { face: string; rim: string; ribbon: string; label: string }> = {
  1: { face: "#f6cf5d", rim: "#b8891c", ribbon: "#c0392b", label: "Oro" },
  2: { face: "#dfe5ea", rim: "#8b98a3", ribbon: "#2c5f9e", label: "Argento" },
  3: { face: "#d99a62", rim: "#8e5527", ribbon: "#2f7d4f", label: "Bronzo" },
};

const fmtDay = (d: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : "");

/** medaglia con nastro e numero del posto */
export function Medal({ place, size = 44 }: { place: number; size?: number }) {
  const m = METAL[place] ?? { face: "#9fb3c8", rim: "#5c6f82", ribbon: "#4b5563", label: `${place}°` };
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 40 50" aria-label={`${m.label}: ${place}° posto`} role="img">
      <path d="M11 0h7l5 16h-7z" fill={m.ribbon} />
      <path d="M29 0h-7l-5 16h7z" fill={m.ribbon} opacity="0.82" />
      <circle cx="20" cy="32" r="15" fill={m.rim} />
      <circle cx="20" cy="32" r="12" fill={m.face} />
      <circle cx="20" cy="32" r="12" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 2.2" />
      <text x="20" y="37" textAnchor="middle" fontSize="13" fontWeight="800" fill={m.rim} fontFamily="system-ui, sans-serif">
        {place}
      </text>
    </svg>
  );
}

/** coppa per i trofei di squadra */
function Cup({ place, size = 40 }: { place: number | null; size?: number }) {
  const m = place ? METAL[place] : null;
  const face = m?.face ?? "#e8c770";
  const rim = m?.rim ?? "#a47a1d";
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path d="M11 5h18v9a9 9 0 0 1-18 0z" fill={face} stroke={rim} strokeWidth="1.5" />
      <path d="M11 8H6a5 5 0 0 0 6 7M29 8h5a5 5 0 0 1-6 7" fill="none" stroke={rim} strokeWidth="2" />
      <path d="M18 23h4v6h-4z" fill={rim} />
      <path d="M12 29h16v5H12z" rx="1" fill={rim} />
      {place ? (
        <text x="20" y="15.5" textAnchor="middle" fontSize="9" fontWeight="800" fill={rim} fontFamily="system-ui, sans-serif">
          {place}
        </text>
      ) : null}
    </svg>
  );
}

/** ripiano con oro, argento e bronzo contati */
function Shelf({ counts, extra }: { counts: [number, number, number]; extra?: { n: number; label: string } }) {
  return (
    <div className="flex items-end justify-around rounded-2xl border border-[#e0b15a]/25 bg-gradient-to-b from-[#e0b15a]/10 to-transparent px-2 pb-2 pt-3">
      {[1, 2, 3].map((p) => (
        <div key={p} className={cx("grid justify-items-center gap-0.5", !counts[p - 1] && "opacity-35")}>
          <Medal place={p} size={p === 1 ? 46 : 38} />
          <p className="font-display text-2xl leading-none tabular-nums">{counts[p - 1]}</p>
          <p className="text-[0.62rem] text-muted">{METAL[p].label}</p>
        </div>
      ))}
      {extra ? (
        <div className={cx("grid justify-items-center gap-0.5", !extra.n && "opacity-35")}>
          <Cup place={null} size={44} />
          <p className="font-display text-2xl leading-none tabular-nums">{extra.n}</p>
          <p className="text-[0.62rem] text-muted">{extra.label}</p>
        </div>
      ) : null}
    </div>
  );
}

const countOf = (ps: { place: number | null }[]): [number, number, number] => [1, 2, 3].map((p) => ps.filter((x) => x.place === p).length) as [number, number, number];

function PodiumRow({ p, withName }: { p: Podium; withName?: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-white/[0.035] px-2.5 py-2">
      <Medal place={p.place} size={26} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{p.competition}</p>
        <p className="truncate text-xs text-muted">
          {[withName ? p.name || "Arciere della compagnia" : "", fmtDay(p.day), p.category, p.score != null ? `${p.score} punti` : ""].filter(Boolean).join(" · ")}
        </p>
      </div>
      {withName && p.memberId ? (
        <Link to="/arciere/$id" params={{ id: String(p.memberId) }} className="shrink-0 text-xs font-semibold text-accent">
          Scheda
        </Link>
      ) : null}
    </li>
  );
}

/** podi di un arciere, nella sua scheda */
export function ArcherPalmares({ memberId, firstName }: { memberId: number; firstName: string }) {
  const { data, error } = useLoad(`podi-${memberId}`, () => archerPodiums({ data: { memberId } }));
  if (error) return null;
  const pods = data?.podiums ?? [];
  return (
    <Card className="grid gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl">Podi in gara</h2>
        {data ? <p className="text-xs text-muted">{data.gare} gare</p> : null}
      </div>
      <Shelf counts={countOf(pods)} />
      {pods.length ? (
        <ul className="grid gap-1.5">
          {pods.slice(0, 12).map((p, i) => <PodiumRow key={`${p.competition}-${p.day}-${i}`} p={p} />)}
        </ul>
      ) : data ? (
        <p className="text-sm text-muted">Ancora nessun podio per {firstName}. Le posizioni arrivano dalle gare del calendario (anche quelle prese dal portale FITAST).</p>
      ) : null}
    </Card>
  );
}

type Draft = { id: number; title: string; place: string; competition: string; day: string; category: string; notes: string };
const EMPTY: Draft = { id: 0, title: "", place: "1", competition: "", day: "", category: "", notes: "" };

/** bacheca dei trofei della compagnia */
export function CompanyTrophies({ companyId, companyName }: { companyId: number; companyName: string }) {
  const [nonce, setNonce] = useState(0);
  const { data, error } = useLoad(`trofei-${companyId}-${nonce}`, () => companyPalmares({ data: { companyId } }));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [all, setAll] = useState(false);
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;
  const awards = data.awards;
  const pods = data.podiums;
  const counts = countOf([...awards, ...pods]);
  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setErr("");
    try {
      await saveCompanyAward({ data: { ...draft, companyId: data.companyId, place: draft.place === "" ? null : Number(draft.place) } });
      setDraft(null);
      setNonce((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Salvataggio non riuscito.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (a: Award) => {
    setBusy(true);
    try {
      await deleteCompanyAward({ data: { id: a.id, companyId: data.companyId } });
      setNonce((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="grid gap-3">
      <div>
        <h2 className="font-display text-2xl leading-tight">Bacheca dei trofei</h2>
        <p className="text-xs text-muted">{companyName}: premi di squadra e podi dei suoi arcieri.</p>
      </div>
      <Shelf counts={counts} extra={{ n: awards.length, label: "Trofei" }} />
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Trofei di squadra{data.canEdit && awards.length ? <span className="ml-1 text-xs font-normal text-muted">(tocca per modificare)</span> : null}</p>
          {data.canEdit && !draft ? (
            <button type="button" className="aa-chip" onClick={() => setDraft({ ...EMPTY })}>
              Aggiungi trofeo
            </button>
          ) : null}
        </div>
        {awards.length ? (
          <ul className="grid gap-1.5">
            {awards.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl bg-white/[0.035] px-2.5 py-2">
                <Cup place={a.place} size={30} />
                <button
                  type="button"
                  disabled={!data.canEdit}
                  onClick={() => setDraft({ id: a.id, title: a.title, place: a.place ? String(a.place) : "", competition: a.competition, day: a.day, category: a.category, notes: a.notes })}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                  aria-label={data.canEdit ? `Modifica ${a.title}` : undefined}
                >
                  <p className="text-sm font-semibold leading-snug">{a.title}</p>
                  <p className="text-xs text-muted">{[a.place ? `${a.place}° posto` : "", a.competition, fmtDay(a.day), a.category].filter(Boolean).join(" · ")}</p>
                  {a.notes ? <p className="text-xs text-muted">{a.notes}</p> : null}
                </button>
                {data.canEdit ? (
                  <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-lg leading-none" disabled={busy} onClick={() => void remove(a)} aria-label={`Togli ${a.title}`}>
                    ×
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : !draft ? (
          <p className="text-sm text-muted">{data.canEdit ? "Nessun trofeo ancora: aggiungi coppe e piazzamenti di squadra della compagnia." : "Nessun trofeo di squadra registrato."}</p>
        ) : null}
        {draft ? (
          <div className="grid gap-2 rounded-2xl bg-white/[0.04] p-3">
            <Field label="Premio">
              <TextInput value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Es. Coppa delle compagnie" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Posto">
                <Select value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })}>
                  <option value="1">1° (oro)</option>
                  <option value="2">2° (argento)</option>
                  <option value="3">3° (bronzo)</option>
                  <option value="">Premio speciale</option>
                </Select>
              </Field>
              <Field label="Data">
                <TextInput type="date" value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })} />
              </Field>
            </div>
            <Field label="Gara o torneo">
              <TextInput value={draft.competition} onChange={(e) => setDraft({ ...draft, competition: e.target.value })} placeholder="Es. Campionato FITAST 2025" />
            </Field>
            <Field label="Categoria (facoltativa)">
              <TextInput value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Es. Squadre arco storico" />
            </Field>
            <Field label="Note (facoltative)">
              <TextInput value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
            {err ? <ErrorNote text={err} /> : null}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => { setDraft(null); setErr(""); }}>
                Annulla
              </Button>
              <Button disabled={busy || !draft.title.trim()} onClick={() => void save()}>
                {draft.id ? "Salva" : "Aggiungi"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <p className="text-sm font-semibold">Podi degli arcieri</p>
        {pods.length ? (
          <>
            <ul className="grid gap-1.5">
              {(all ? pods : pods.slice(0, 6)).map((p, i) => <PodiumRow key={`${p.userId}-${p.competition}-${p.day}-${i}`} p={p} withName />)}
            </ul>
            {pods.length > 6 ? (
              <button type="button" className="aa-chip justify-self-start" onClick={() => setAll((v) => !v)}>
                {all ? "Mostra meno" : `Mostra tutti (${pods.length})`}
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">Nessun podio ancora. Le posizioni in classifica arrivano dalle gare del calendario.</p>
        )}
      </div>
    </Card>
  );
}
