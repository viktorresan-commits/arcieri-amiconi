import { listCompetitions } from "@/lib/arcieri/club.api";
import { romeDayKey } from "@/lib/arcieri/time";
import { useLoad } from "@/lib/arcieri/use-load";
import type { AvatarLook } from "@/lib/arcieri/avatar";
import { AvatarFace } from "./archer-avatar";
import { Glyph } from "./icons";

type Comps = Awaited<ReturnType<typeof listCompetitions>>["competitions"];
type Comp = Comps[number];
type PzRow = { name: string; piazzola: number; userId: string | null };

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const DAYS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

/** giorni da oggi (ora di Roma) al giorno della gara */
function daysTo(day: string, today: string) {
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

function whenText(n: number) {
  if (n <= 0) return "oggi";
  if (n === 1) return "domani";
  if (n < 14) return `tra ${n} giorni`;
  return `tra ${Math.round(n / 7)} settimane`;
}

/**
 * La prossima gara della compagnia: le gare in arrivo dell'app e quelle del portale FITAST con dentro qualcuno
 * dei nostri; prima quella con l'elenco delle piazzole già uscito, se è la più vicina, poi quella in cui va qualcuno.
 */
export function pickNextGara(comps: Comps, today: string): Comp | null {
  const next = comps.filter((c) => c.startsOn >= today).sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.id - b.id);
  const ours = (c: Comp) => Boolean(c.ourPz?.length) || c.roster.some((r) => r.attended) || c.attended === true || Boolean(c.fitast);
  return next.find(ours) ?? next[0] ?? null;
}

/** le piazzole della compagnia: una riga per piazzola, con chi parte da lì */
function byPiazzola(rows: PzRow[]) {
  const map = new Map<number, PzRow[]>();
  for (const r of rows) map.set(r.piazzola, [...(map.get(r.piazzola) ?? []), r]);
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

function Face({ row, look, me }: { row: PzRow; look?: AvatarLook; me: boolean }) {
  const initials = row.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span className={`grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full ${me ? "ring-2 ring-[#f1cf8a]" : "ring-1 ring-white/15"} bg-[#1b2a22]`}>
      {look ? <AvatarFace look={look} className="h-8 w-8" /> : <span className="text-[0.62rem] font-bold uppercase text-white/80">{initials}</span>}
    </span>
  );
}

/** numero della piazzola su un piccolo bersaglio (dorato se ci sei tu) */
function LaneBadge({ n, mine }: { n: number; mine: boolean }) {
  return (
    <span className="relative grid h-11 w-11 shrink-0 place-items-center" aria-label={`Piazzola ${n}`}>
      <svg viewBox="0 0 44 44" className="absolute inset-0" aria-hidden>
        <circle cx="22" cy="22" r="21" fill={mine ? "#e0b15a" : "#1d2b24"} />
        <circle cx="22" cy="22" r="16.5" fill="none" stroke={mine ? "#7a5414" : "rgba(255,255,255,0.14)"} strokeWidth="1.2" />
        <circle cx="22" cy="22" r="11.5" fill="none" stroke={mine ? "#7a5414" : "rgba(255,255,255,0.1)"} strokeWidth="1" />
      </svg>
      <b className={`relative font-display text-[1.05rem] leading-none tabular-nums ${mine ? "text-[#2c1c04]" : "text-white"}`}>{n}</b>
    </span>
  );
}

/** chi della compagnia parte da quale piazzola: una riga per piazzola (la tua in oro) */
export function CompanyLanes({ rows, meId, looks }: { rows: PzRow[]; meId: string; looks: Record<string, AvatarLook> }) {
  return (
    <ul className="grid gap-1.5">
      {byPiazzola(rows).map(([lane, list]) => {
        const mine = list.some((r) => r.userId === meId);
        return (
          <li key={lane} className={`flex items-center gap-2.5 rounded-2xl px-2 py-1.5 ${mine ? "bg-[#e0b15a]/12 ring-1 ring-[#e0b15a]/40" : "bg-white/[0.04]"}`}>
            <LaneBadge n={lane} mine={mine} />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
              {list.map((r) => (
                <span key={r.name} className="flex min-w-0 items-center gap-1.5">
                  <Face row={r} look={r.userId ? looks[r.userId] : undefined} me={r.userId === meId} />
                  <span className="truncate text-sm font-semibold">{r.userId === meId ? "Tu" : r.name}</span>
                </span>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Scheda «Prossima gara»: giorno, quanto manca, dove, e chi della compagnia parte da quale piazzola secondo
 * l'elenco delle piazzole pubblicato sul portale FITAST. Finché l'elenco non c'è, chi della compagnia ci va.
 * `compact`: una riga sola (sotto lo stemma della compagnia), che porta alla scheda Gare.
 */
export function NextGaraCard({ meId, looks, compact = false, onOpen }: { meId: string; looks: Record<string, AvatarLook>; compact?: boolean; onOpen?: () => void }) {
  const { data } = useLoad("gare-prossima", () => listCompetitions());
  const today = romeDayKey(new Date().toISOString());
  const comp = data ? pickNextGara(data.competitions, today) : null;
  if (!comp) return null;
  const d = new Date(`${comp.startsOn}T12:00:00Z`);
  const n = daysTo(comp.startsOn, today);
  const pz = (comp.ourPz ?? []) as PzRow[];
  const going = comp.roster.filter((r) => r.attended);
  const step = comp.fitast?.step ? `${comp.fitast.step}ª tappa` : "";
  const champ = comp.fitast?.champ ?? "";
  const myPz = pz.find((r) => r.userId === meId)?.piazzola ?? null;

  if (compact) {
    return (
      <button type="button" onClick={onOpen} className="aa-press aa-next-gara-strip -mt-1 flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left">
        <span className="grid w-11 shrink-0 justify-items-center rounded-xl bg-white/[0.07] py-1 leading-none">
          <span className="text-[0.55rem] font-bold uppercase tracking-wider text-[#f1cf8a]">{MONTHS[d.getUTCMonth()]}</span>
          <b className="font-display text-[1.35rem] tabular-nums">{d.getUTCDate()}</b>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#f1cf8a]">Prossima gara · {whenText(n)}</span>
          <b className="block truncate text-sm">{comp.name}</b>
          <span className="block truncate text-[0.7rem] text-muted">
            {pz.length ? `${pz.length} dei nostri su ${byPiazzola(pz).length} ${byPiazzola(pz).length === 1 ? "piazzola" : "piazzole"}${myPz != null ? ` · tu alla ${myPz}` : ""}` : going.length ? `${going.length} della compagnia ci ${going.length === 1 ? "va" : "vanno"} · piazzole non ancora uscite` : "Piazzole non ancora uscite"}
          </span>
        </span>
        <Glyph name="chevron" size={15} className="shrink-0 text-muted" />
      </button>
    );
  }

  const groups = byPiazzola(pz);
  return (
    <section className="aa-next-gara relative overflow-hidden rounded-[var(--radius-card)] border border-hair shadow-card">
      <div className="relative grid gap-3 p-3.5">
        <div className="flex items-start gap-3">
          {/* il giorno come un biglietto: giorno della settimana, numero e mese */}
          <div className="grid w-[3.7rem] shrink-0 justify-items-center overflow-hidden rounded-2xl bg-[#f4efe2] text-[#1b231e] shadow-[0_8px_18px_-8px_rgba(0,0,0,0.7)]">
            <span className="w-full bg-[#b8432f] py-0.5 text-center text-[0.58rem] font-bold uppercase tracking-wider text-white">{DAYS[d.getUTCDay()]}</span>
            <b className="pt-0.5 font-display text-[1.9rem] leading-none tabular-nums">{d.getUTCDate()}</b>
            <span className="pb-1 text-[0.62rem] font-bold uppercase tracking-wider">{MONTHS[d.getUTCMonth()]}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#f1cf8a]">Prossima gara · {whenText(n)}</p>
            <h2 className="font-display text-[1.35rem] leading-[1.1]">{comp.name}</h2>
            <p className="mt-0.5 truncate text-xs text-muted">{[step, champ, comp.place].filter(Boolean).join(" · ") || "Campionato FITAST"}</p>
          </div>
        </div>

        {groups.length ? (
          <div className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Chi parte da dove</h3>
              <span className="text-[0.68rem] text-muted">{pz.length} dei nostri · dal portale FITAST</span>
            </div>
            <CompanyLanes rows={pz} meId={meId} looks={looks} />
          </div>
        ) : (
          <div className="grid gap-2 rounded-2xl bg-white/[0.04] p-3">
            <p className="text-sm">
              <b>Le piazzole non sono ancora uscite.</b> Appena la FITAST pubblica l'elenco sul portale (di solito pochi giorni prima) qui compare chi della compagnia parte da quale piazzola.
            </p>
            {going.length ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-[0.68rem] text-muted">Ci {going.length === 1 ? "va" : "vanno"}:</span>
                {going.map((r) => (
                  <span key={r.userId} className="flex items-center gap-1.5">
                    <Face row={{ name: [r.givenName, r.familyName].filter(Boolean).join(" ") || r.nickname, piazzola: 0, userId: r.userId }} look={looks[r.userId]} me={r.userId === meId} />
                    <span className="text-sm font-semibold">{r.userId === meId ? "Tu" : r.nickname || r.givenName}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
