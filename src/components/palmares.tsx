/**
 * Palmarès: medaglie e podi. Nella scheda dell'arciere i suoi podi di gara; nella compagnia la bacheca
 * dei trofei di squadra (scritti dal capo compagnia o dallo staff) e i podi di tutti i suoi arcieri.
 */
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Button, Card, ErrorNote, Field, Select, TextInput, cx } from "@/components/kit";
import { archerPodiums, companyPalmares, deleteCompanyAward, saveCompanyAward, type Award, type Podium, type TeamResult } from "@/lib/arcieri/palmares.api";
import { useLoad } from "@/lib/arcieri/use-load";

const METAL: Record<number, { face: string; rim: string; ribbon: string; label: string }> = {
  1: { face: "#f6cf5d", rim: "#b8891c", ribbon: "#c0392b", label: "Oro" },
  2: { face: "#dfe5ea", rim: "#8b98a3", ribbon: "#2c5f9e", label: "Argento" },
  3: { face: "#d99a62", rim: "#8e5527", ribbon: "#2f7d4f", label: "Bronzo" },
};

const fmtDay = (d: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : "");

/** metallo coniato: luce, chiaro, medio, scuro, ombra profonda */
const METALS: Record<"gold" | "silver" | "bronze" | "iron", [string, string, string, string, string]> = {
  gold: ["#fff8d6", "#f7d774", "#dca733", "#9a6a12", "#4f3406"],
  silver: ["#ffffff", "#eef2f6", "#c3ccd5", "#7f8a96", "#3b434c"],
  bronze: ["#ffe3c4", "#eaa86b", "#bb773d", "#7c471d", "#40230d"],
  iron: ["#e9eef2", "#aeb8c1", "#7c8893", "#4c5761", "#262d33"],
};
const metalOf = (place: number | null) => METALS[place === 1 ? "gold" : place === 2 ? "silver" : place === 3 ? "bronze" : place == null ? "gold" : "iron"];
/** nastro: colore, filetto */
const RIBBONS: Record<number, [string, string]> = { 1: ["#b3202e", "#f7d774"], 2: ["#1f4f9a", "#eef2f6"], 3: ["#1f6b44", "#eaa86b"] };

/** un rametto d'alloro in rilievo lungo il bordo del campo (lato -1 sinistra, 1 destra) */
function laurelLeaves(side: 1 | -1, fill: string, dx = 0, dy = 0) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((side === 1 ? 64 - i * 19 : 116 + i * 19) * Math.PI) / 180;
    const r = 19.5;
    const x = 40 + Math.cos(a) * r + dx;
    const y = 66 + Math.sin(a) * r + dy;
    const rot = (a * 180) / Math.PI + (side === 1 ? -90 : 90) + side * 28;
    return <ellipse key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} rx="1.7" ry="3.6" transform={`rotate(${rot.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})`} fill={fill} />;
  });
}

/** medaglia coniata: nastro con filetto, anello, bordo con perline, campo lucido con alloro e il posto in rilievo */
export function Medal({ place, size = 44 }: { place: number; size?: number }) {
  const id = `md${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [lux, hi, mid, lo, deep] = metalOf(place);
  const [rib, stripe] = RIBBONS[place] ?? ["#4b5563", "#c3ccd5"];
  const label = METAL[place]?.label ?? `${place}°`;
  const fine = size >= 34;
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 80 100" aria-label={`${label}: ${place}° posto`} role="img" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`${id}r`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={lux} />
          <stop offset="0.25" stopColor={hi} />
          <stop offset="0.52" stopColor={mid} />
          <stop offset="0.75" stopColor={lo} />
          <stop offset="1" stopColor={hi} />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0.9" y1="1" x2="0.1" y2="0">
          <stop offset="0" stopColor={lux} />
          <stop offset="0.5" stopColor={mid} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <radialGradient id={`${id}f`} cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor={lux} />
          <stop offset="0.35" stopColor={hi} />
          <stop offset="0.75" stopColor={mid} />
          <stop offset="1" stopColor={lo} />
        </radialGradient>
        <linearGradient id={`${id}n`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lux} />
          <stop offset="0.45" stopColor={hi} />
          <stop offset="1" stopColor={mid} />
        </linearGradient>
        <linearGradient id={`${id}rb`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={rib} />
          <stop offset="1" stopColor={rib} stopOpacity="0.78" />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.65" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <circle cx="40" cy="66" r="24.5" />
        </clipPath>
      </defs>
      {/* nastro a V con il filetto e la piega */}
      <path d="M50 0 H66 L48 42 H33 Z" fill={`url(#${id}rb)`} />
      <path d="M50 0 H66 L48 42 H33 Z" fill="#000" opacity="0.22" />
      <path d="M14 0 H30 L47 42 H32 Z" fill={`url(#${id}rb)`} />
      <path d="M20 0 H24 L41.5 42 H37.5 Z" fill={stripe} opacity="0.9" />
      <path d="M56 0 H60 L43.5 42 H39.5 Z" fill={stripe} opacity="0.55" />
      <path d="M14 0 H30 L32 5 H16 Z" fill="#000" opacity="0.18" />
      {/* anello */}
      <circle cx="40" cy="38.5" r="4.6" fill="none" stroke={deep} strokeWidth="3.2" />
      <circle cx="40" cy="38.5" r="4.6" fill="none" stroke={`url(#${id}r)`} strokeWidth="2.2" />
      {/* spessore e bordo */}
      <circle cx="40" cy="68.6" r="30" fill={deep} />
      <circle cx="40" cy="66" r="30" fill={`url(#${id}r)`} stroke={deep} strokeWidth="0.7" strokeOpacity="0.7" />
      <circle cx="40" cy="66" r="27.2" fill={`url(#${id}b)`} />
      {fine ? (
        <g fill={lux} opacity="0.9">
          {Array.from({ length: 26 }, (_, i) => {
            const a = (i / 26) * Math.PI * 2;
            return <circle key={i} cx={(40 + Math.cos(a) * 28.6).toFixed(2)} cy={(66 + Math.sin(a) * 28.6).toFixed(2)} r="0.95" />;
          })}
        </g>
      ) : null}
      {/* campo lucido, alloro e numero in rilievo */}
      <circle cx="40" cy="66" r="24.5" fill={`url(#${id}f)`} />
      {fine ? (
        <g>
          {laurelLeaves(-1, deep, 0.5, 0.8)}
          {laurelLeaves(1, deep, 0.5, 0.8)}
          {laurelLeaves(-1, `url(#${id}n)`)}
          {laurelLeaves(1, `url(#${id}n)`)}
        </g>
      ) : null}
      {/* il posto in rilievo: ombra, contorno scuro, metallo e un filo di luce */}
      <g style={{ fontFamily: "var(--font-disp, 'Barlow Condensed', system-ui, sans-serif)" }} fontSize={fine ? 34 : 40} fontWeight="800" textAnchor="middle">
        <text x="41.2" y={fine ? 80.4 : 82.4} fill={deep} opacity="0.8">{place}</text>
        <text x="40" y={fine ? 78.4 : 80.4} fill={`url(#${id}n)`} stroke={deep} strokeWidth="1.3" paintOrder="stroke">{place}</text>
        <text x="39.5" y={fine ? 77.7 : 79.7} fill="none" stroke={lux} strokeWidth="0.6" opacity="0.75">{place}</text>
      </g>
      {/* riflesso */}
      <g clipPath={`url(#${id}c)`}>
        <ellipse cx="30" cy="50" rx="22" ry="12" transform="rotate(-28 30 50)" fill={`url(#${id}g)`} opacity="0.75" />
      </g>
      {place === 1 && fine ? <path d="M63 43 l1.4 3.6 3.6 1.4 -3.6 1.4 -1.4 3.6 -1.4 -3.6 -3.6 -1.4 3.6 -1.4 Z" fill="#fff" opacity="0.95" /> : null}
    </svg>
  );
}

/** coppa per i trofei di squadra: calice di metallo con anse, emblema smaltato e base con targhetta */
export function Cup({ place, size = 40 }: { place: number | null; size?: number }) {
  const id = `cp${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [lux, hi, mid, lo, deep] = metalOf(place);
  const enamel = place === 2 ? ["#7cc0ff", "#2063c8", "#091f4d"] : place === 3 ? ["#6be8a8", "#14905c", "#05331f"] : ["#ff7a8a", "#c41d3a", "#4e0614"];
  const fine = size >= 34;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden style={{ overflow: "visible" }}>
      <defs>
        {/* il calice è un cilindro: luce a sinistra, ombra ai lati */}
        <linearGradient id={`${id}k`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={lo} />
          <stop offset="0.22" stopColor={hi} />
          <stop offset="0.34" stopColor={lux} />
          <stop offset="0.5" stopColor={hi} />
          <stop offset="0.78" stopColor={mid} />
          <stop offset="1" stopColor={lo} />
        </linearGradient>
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hi} />
          <stop offset="1" stopColor={lo} />
        </linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a2e1a" />
          <stop offset="1" stopColor="#1b0f07" />
        </linearGradient>
        <radialGradient id={`${id}e`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor={enamel[0]} />
          <stop offset="0.5" stopColor={enamel[1]} />
          <stop offset="1" stopColor={enamel[2]} />
        </radialGradient>
        <clipPath id={`${id}c`}>
          <path d="M17 11 H63 V22 C63 38 52 47 40 47 C28 47 17 38 17 22 Z" />
        </clipPath>
      </defs>
      <ellipse cx="40" cy="77.5" rx="24" ry="2.6" fill="#000" opacity="0.35" />
      {/* base di legno con la targhetta */}
      <rect x="17" y="63" width="46" height="13" rx="2.2" fill={`url(#${id}w)`} />
      <rect x="17" y="63" width="46" height="2" rx="1" fill="#fff" opacity="0.12" />
      <rect x="30" y="67" width="20" height="5.4" rx="1" fill={`url(#${id}k)`} stroke={deep} strokeWidth="0.5" />
      {/* gradino e fusto con il nodo */}
      <rect x="22" y="57" width="36" height="7.5" rx="2" fill={`url(#${id}k)`} stroke={deep} strokeWidth="0.6" />
      <path d="M35.5 46 H44.5 L43 57.5 H37 Z" fill={`url(#${id}k)`} stroke={deep} strokeWidth="0.6" />
      <ellipse cx="40" cy="51.5" rx="6" ry="2.6" fill={`url(#${id}k)`} stroke={deep} strokeWidth="0.6" />
      {/* anse */}
      <path d="M18 16 C5 15 5 34 21 37 M62 16 C75 15 75 34 59 37" fill="none" stroke={deep} strokeWidth="5.2" strokeLinecap="round" />
      <path d="M18 16 C5 15 5 34 21 37 M62 16 C75 15 75 34 59 37" fill="none" stroke={`url(#${id}v)`} strokeWidth="3.4" strokeLinecap="round" />
      {/* calice */}
      <path d="M17 11 H63 V22 C63 38 52 47 40 47 C28 47 17 38 17 22 Z" fill={`url(#${id}k)`} stroke={deep} strokeWidth="0.8" />
      <g clipPath={`url(#${id}c)`}>
        <rect x="24" y="8" width="5" height="42" fill="#fff" opacity="0.35" />
        <path d="M17 34 C26 44 54 44 63 34 V48 H17 Z" fill={deep} opacity="0.18" />
      </g>
      <ellipse cx="40" cy="11" rx="23" ry="3.6" fill={`url(#${id}v)`} stroke={deep} strokeWidth="0.7" />
      <ellipse cx="40" cy="11.4" rx="19.5" ry="2.2" fill={deep} opacity="0.85" />
      {/* emblema smaltato con il posto o la stella */}
      <circle cx="40" cy="26" r="9.2" fill={deep} />
      <circle cx="40" cy="25.5" r="9" fill={`url(#${id}v)`} />
      <circle cx="40" cy="25.5" r="7.2" fill={`url(#${id}e)`} />
      {place ? (
        <text x="40" y="30" textAnchor="middle" fontSize="13" fontWeight="800" fill={lux} style={{ fontFamily: "var(--font-disp, 'Barlow Condensed', system-ui, sans-serif)" }}>
          {place}
        </text>
      ) : (
        <path d="M40 19.6 l1.8 3.8 4.1.5 -3 2.8 .8 4.1 -3.7 -2 -3.7 2 .8 -4.1 -3 -2.8 4.1 -.5 Z" fill={lux} />
      )}
      {fine ? (
        <g fill="#fff">
          <path d="M66 6 l1.1 2.9 2.9 1.1 -2.9 1.1 -1.1 2.9 -1.1 -2.9 -2.9 -1.1 2.9 -1.1 Z" opacity="0.95" />
          <circle cx="12" cy="9" r="1" opacity="0.7" />
        </g>
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

/** "3ª su 12 · 1.240 punti" */
export function teamResultText(r: Pick<TeamResult, "place" | "teams" | "score">) {
  return [r.place ? `${r.place}ª${r.teams ? ` su ${r.teams}` : ""}` : "in classifica", r.score != null ? `${r.score.toLocaleString("it-IT")} punti` : ""].filter(Boolean).join(" · ");
}

/** una gara della compagnia nella classifica squadre del portale */
function TeamResultRow({ r }: { r: TeamResult }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-white/[0.035] px-2.5 py-2">
      {r.place && r.place <= 3 ? <Medal place={r.place} size={30} /> : <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-white/[0.07] text-xs font-semibold tabular-nums">{r.place ?? "—"}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{r.competition || `Gara ${r.fitastId}`}</p>
        <p className="text-xs text-muted">{[teamResultText(r), fmtDay(r.day), r.category, r.team].filter(Boolean).join(" · ")}</p>
      </div>
    </li>
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
  const [view, setView] = useState<"podi" | "squadra" | "trofei">("podi");
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;
  const awards = data.awards;
  const pods = data.podiums;
  const results = data.results ?? [];
  // un solo elenco dal più recente: le classifiche generali (anche delle stagioni passate) e le gare
  const teamRows = results;
  const counts = countOf([...awards, ...pods, ...results]);
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
    <Card className="relative grid gap-3 overflow-hidden">
      {/* la vetrina: un'occhiata e si vede quanto ha vinto la compagnia */}
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#e0b15a] opacity-[0.14] blur-3xl" />
      <div className="flex items-center gap-3">
        <Cup place={1} size={52} />
        <div className="min-w-0">
          <h2 className="font-display text-[1.7rem] leading-tight">Bacheca di {companyName}</h2>
          <p className="text-xs text-muted">{awards.length + teamRows.length + pods.length ? `${counts[0] + counts[1] + counts[2]} podi · ${awards.length} ${awards.length === 1 ? "trofeo" : "trofei"} di squadra` : "Ancora vuota: i podi arrivano dalle gare"}</p>
        </div>
      </div>
      <Shelf counts={counts} extra={{ n: awards.length, label: "Trofei" }} />
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/[0.05] p-1">
        {([["podi", "Podi", pods.length], ["squadra", "Squadra", teamRows.length], ["trofei", "Trofei", awards.length]] as const).map(([id, label, n]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={cx("min-h-10 rounded-xl text-[0.78rem] font-semibold", view === id ? "bg-primary text-primary-fg shadow" : "text-muted")}>
            {label} <span className="tabular-nums opacity-70">{n}</span>
          </button>
        ))}
      </div>
      {view === "trofei" ? (
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
                  // i trofei letti dal portale FITAST (id negativi) non si modificano
                  disabled={!data.canEdit || a.id < 0}
                  onClick={() => setDraft({ id: a.id, title: a.title, place: a.place ? String(a.place) : "", competition: a.competition, day: a.day, category: a.category, notes: a.notes })}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                  aria-label={data.canEdit ? `Modifica ${a.title}` : undefined}
                >
                  <p className="text-sm font-semibold leading-snug">{a.title}</p>
                  <p className="text-xs text-muted">{[a.place ? `${a.place}° posto` : "", a.competition, fmtDay(a.day), a.category].filter(Boolean).join(" · ")}</p>
                  {a.notes ? <p className="text-xs text-muted">{a.notes}</p> : null}
                </button>
                {data.canEdit && a.id > 0 ? (
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
      ) : null}
      {view === "squadra" ? (
        /* un solo elenco: prima il campionato in corso (generale squadre dal portale), poi le gare */
        teamRows.length ? (
          <ul className="grid gap-1.5">
            {(all ? teamRows : teamRows.slice(0, 8)).map((r) => <TeamResultRow key={r.id} r={r} />)}
            {teamRows.length > 8 ? (
              <button type="button" className="aa-chip justify-self-start" onClick={() => setAll((v) => !v)}>{all ? "Mostra meno" : `Mostra tutti (${teamRows.length})`}</button>
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-muted">Arrivano dal portale FITAST: dal campionato in corso e, con la scansione dell'Albo d'oro dal 2019 (in Compagnie), dalle stagioni passate.</p>
        )
      ) : null}
      {view === "podi" ? (
        pods.length ? (
          <>
            <ul className="grid gap-1.5">
              {(all ? pods : pods.slice(0, 8)).map((p, i) => <PodiumRow key={`${p.userId}-${p.competition}-${p.day}-${i}`} p={p} withName />)}
            </ul>
            {pods.length > 8 ? (
              <button type="button" className="aa-chip justify-self-start" onClick={() => setAll((v) => !v)}>
                {all ? "Mostra meno" : `Mostra tutti (${pods.length})`}
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">Nessun podio ancora. Arrivano dalle gare del campionato in corso e, per le stagioni passate, dalla scansione dell'Albo d'oro dal 2019 (in Compagnie, in fondo alle classifiche FITAST).</p>
        )
      ) : null}
    </Card>
  );
}
