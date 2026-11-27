import { useEntryState } from "@/lib/arcieri/back-restore";
import { haloOfXp } from "@/components/level-crest";
import { GareBody } from "@/components/gare-body";
import { removeTeamMember } from "@/lib/arcieri/account.api";
import { TargetGL } from "@/components/target-gl";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { listCompanies } from "@/lib/arcieri/compagnie.api";
import { CompanyForm, CompanyHero, CompanyLeague, joinAndReload } from "@/components/compagnia";
import { CompanyTrophies, Cup } from "@/components/palmares";
import { MarketTab } from "@/components/market";
import { FitastArchersCard, FitastCompanyBoard, FitastHeader, FitastTeamsBoard, JoinLinkSheet, useFitastLeague } from "@/components/fitast-league";
import { FitastArchiveCard } from "@/components/fitast-archive";
import { teamKey } from "@/lib/arcieri/fitast-league";
import { RankBars } from "@/components/rank-bars";
import { useLocalState } from "@/lib/arcieri/local-store";
import { Podium } from "@/components/podium";
import { useTeamAvatars } from "@/components/avatar-hero";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { listGadgets, skillBoard, squadBoard } from "@/lib/arcieri/club.api";
import { bowLabel, memberLabel, DIVISIONS } from "@/lib/arcieri/labels";
import type { AvatarLook } from "@/lib/arcieri/avatar";
import { SceneBackdrop } from "@/components/scene-2d";
import { ArcherFront } from "@/components/archer-front";
import { LevelCrest } from "@/components/level-crest";
import { levelOf } from "@/lib/arcieri/xp";
import type { Sky } from "@/lib/arcieri/sky3d";
import { Glyph, type IconName } from "@/components/icons";
import { fmtAvg } from "@/lib/arcieri/scoring";
import { useLoad } from "@/lib/arcieri/use-load";
import { ANIMALS, animalByLabel } from "@/lib/arcieri/sagome";
import { MultiBars, useThemeInk } from "@/components/charts";
import { SagomaLab, paintRingFace } from "@/components/sagoma-lab";
import { faceById } from "@/lib/arcieri/scoring";

const TEAM_FACE = faceById("wa10");
import { GroupBestPosture } from "@/components/gesture-gallery";
import { Avatar, Button, Card, Empty, ErrorNote, HoldDelete, Loading, PageHead, Segmented } from "@/components/kit";
import { useMember } from "@/components/shell";
import { PrizeMark, prizeTier } from "@/components/prize-mark";

/** cielo fisso e limpido per le ambientazioni nelle schede degli arcieri */
const MEMBER_SKY: Sky = { tod: "pomeriggio", weather: "sereno", clouds: 0.25, seed: 3 };

export const Route = createFileRoute("/_app/squadra")({ component: Page });

type Section = "arcieri" | "gare" | "bersaglio" | "mercatino" | "compagnie";
/** le schede della Compagnia, una cosa per scheda: chi c'è, chi va meglio, dove tiriamo, cosa abbiamo vinto */
const SECTIONS: { id: Section; label: string; icon: IconName; lede: string }[] = [
  { id: "arcieri", label: "Arcieri", icon: "team", lede: "Chi tira con noi, i podi per divisione e il confronto fra arcieri." },
  { id: "gare", label: "Gare", icon: "flag", lede: "Le gare della stagione: segni le tue, quelle degli altri si vedono." },
  { id: "bersaglio", label: "Bersaglio", icon: "target", lede: "Dove arrivano le frecce, tue o della compagnia." },
  { id: "mercatino", label: "Mercatino", icon: "bag", lede: "Usato in vendita: della tua compagnia o di tutte." },
  { id: "compagnie", label: "Compagnie", icon: "shield", lede: "Tutte le compagnie e il campionato FITAST." },
];
/** le schede salvate dalla versione di prima */
const OLD_SECTION: Record<string, Section> = { bacheca: "mercatino", compagnia: "arcieri", statistiche: "arcieri", classifiche: "arcieri", classifica: "compagnie", fitast: "compagnie", sfida: "arcieri" };

type Archer = Awaited<ReturnType<typeof squadBoard>>["people"][number] & { name: string; color: string; mark: string; skill: number };

const INK = ["#e07a2f", "#3d8f5f", "#9eb6c9", "#d15c56", "#e6b325", "#2a6294", "#c9a27a", "#8f6bb5"];
const RINGS = [
  { r: 1, fill: "#f4f1ea" },
  { r: 0.8, fill: "#1a1c1e" },
  { r: 0.6, fill: "#2a6294" },
  { r: 0.4, fill: "#c4473d" },
  { r: 0.2, fill: "#e6b325" },
];

function skillOf(row: { champ: number; compAvg: number | null; avg: number | null }) {
  if (row.champ > 0) return { skill: 3_000_000 + row.champ, mark: `${row.champ} pt campionato` };
  if (row.compAvg != null) return { skill: 1_000_000 + row.compAvg, mark: `media gara ${fmtAvg(row.compAvg)}` };
  if (row.avg != null) return { skill: row.avg, mark: `media tiro ${fmtAvg(row.avg)}` };
  return { skill: -1, mark: "" };
}

function bySkill(a: Archer, b: Archer) {
  return b.skill - a.skill || b.arrows - a.arrows || a.name.localeCompare(b.name, "it");
}

const DIVISION_TINT: Record<string, string> = { Madonne: "#d46a9a", Messeri: "#4f8fd9", Pueri: "#4fb07a", Juniores: "#e08a3c" };

/** linea piccola dell'andamento delle ultime gare, verde se l'ultima è sopra le precedenti, rossa se sotto */
function TrendLine({ values, pct }: { values: number[]; pct: number | null }) {
  if (values.length < 2 || pct == null) return <span className="w-[3.4rem] shrink-0" aria-hidden />;
  const up = pct >= 0;
  const color = up ? "#4fd08a" : "#ef6b6b";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const W = 54;
  const H = 20;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (W - 4) + 2).toFixed(1)},${(max === min ? H / 2 : H - 2 - ((v - min) / (max - min)) * (H - 4)).toFixed(1)}`);
  const last = pts[pts.length - 1].split(",");
  return (
    <span className="grid w-[3.4rem] shrink-0 justify-items-center gap-0.5" aria-label={`Ultima gara ${up ? "+" : ""}${pct}% rispetto alle precedenti`}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
        <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />
      </svg>
      <b className="font-display text-[0.85rem] leading-none tabular-nums" style={{ color }}>{up ? "+" : "−"}{Math.abs(pct)}%</b>
    </span>
  );
}

/** Scheda compatta di un arciere: mezzo busto nella nicchia con il livello, nome, gare, podi, allenamenti, frecce e andamento */
function ArcherCard({ row, look, index, me }: {
  row: { id: number; userId: string; name: string; division: string; bowType: string; xp?: number; sessions: number; arrows: number; gare: number; podi?: number; trend?: number[]; trendPct?: number | null; bestDistance: number | null; avatarColor: string; photoUrl: string | null; admin: boolean };
  look?: AvatarLook;
  index: number;
  me: boolean;
}) {
  const lv = levelOf(Math.max(0, row.xp ?? 0));
  const tint = DIVISION_TINT[row.division] ?? "#9aa39c";
  // senza separatori delle migliaia (su Android «4.012» non ci stava): fino a 9999 il numero intero, poi in migliaia
  const n = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));
  const stats: { icon: IconName; v: number; label: string; color: string }[] = [
    { icon: "flag", v: row.gare, label: "gare", color: "#e6b325" },
    { icon: "podium", v: row.podi ?? 0, label: "podi", color: "#f1cf8a" },
    { icon: "target", v: row.sessions, label: "allenamenti", color: "#4fd08a" },
    { icon: "arrow", v: row.arrows, label: "frecce", color: "#e07a2f" },
  ];
  return (
    <Link to="/arciere/$id" params={{ id: String(row.id) }} className="block pt-2.5">
      <div className={`aa-menu-row aa-archer-card relative flex items-center gap-2.5 rounded-[1.15rem] p-1.5 pr-2 ${me ? "is-me" : ""}`} style={{ animationDelay: `${Math.min(index, 10) * 30}ms`, ["--div" as string]: tint }}>
        {/* nicchia piccola: l'ambientazione dietro, il mezzo busto che sporge in alto, lo stemma del livello */}
        <div className="relative h-[3.9rem] w-[3.4rem] shrink-0">
          <span aria-hidden className="aa-niche-halo pointer-events-none absolute -inset-[2px] rounded-[0.95rem]" style={{ ["--halo-a" as string]: haloOfXp(row.xp ?? 0).a, ["--halo-b" as string]: haloOfXp(row.xp ?? 0).b, ["--halo-c" as string]: haloOfXp(row.xp ?? 0).c }} />
          <div className="absolute inset-0 overflow-hidden rounded-[0.8rem] bg-[#16201b]">
            {look?.scene ? (
              <span className="absolute inset-x-[-60%] -bottom-[10%] top-[-60%] opacity-90">
                <SceneBackdrop sky={MEMBER_SKY} scene={look.scene} id={`mb${row.id}`} />
              </span>
            ) : null}
            <span className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_30%,transparent,rgba(0,0,0,0.45))]" />
          </div>
          {look ? (
            <div className="absolute inset-x-0 bottom-0 h-[122%] overflow-hidden rounded-b-[0.8rem]">
              <ArcherFront look={{ ...look, lefty: false }} fit crop="38 5 124 128" className="aa-bust h-full w-full" />
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <Avatar size="md" label={row.name} color={row.avatarColor} photo={row.photoUrl} admin={row.admin} xp={row.xp ?? null} />
            </div>
          )}
          <span className="absolute -bottom-1 -right-1.5 z-[2] h-6 w-[1.35rem] drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"><LevelCrest xp={row.xp ?? 0} compact className="h-full w-full" /></span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="min-w-0 truncate font-display text-[1.2rem] leading-none">{row.name}</p>
            {me ? <span className="shrink-0 rounded-full bg-primary/25 px-1.5 py-px text-[0.55rem] font-bold uppercase tracking-wider text-primary">Tu</span> : null}
            {row.division ? <span className="shrink-0 rounded-full px-1.5 py-px text-[0.55rem] font-bold uppercase tracking-wider" style={{ background: `color-mix(in srgb, ${tint} 26%, transparent)`, color: `color-mix(in srgb, ${tint} 70%, white)` }}>{row.division}</span> : null}
            <span className="sr-only">Livello {lv.level}</span>
          </div>
          {/* gare, podi, allenamenti, frecce: solo numeri con il loro simbolo */}
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {stats.map((x) => (
              <span key={x.label} className="flex min-w-0 items-center gap-1 rounded-lg bg-white/[0.05] px-1.5 py-1" title={x.label} aria-label={`${x.v} ${x.label}`}>
                <span className="shrink-0" style={{ color: x.color }}><Glyph name={x.icon} size={12} /></span>
                <b className="min-w-0 truncate font-display text-[0.95rem] leading-none tabular-nums">{n(x.v)}</b>
              </span>
            ))}
          </div>
        </div>
        <TrendLine values={row.trend ?? []} pct={row.trendPct ?? null} />
      </div>
    </Link>
  );
}

function axisName(name: string, peers: string[]) {
  const first = name.split(" ")[0] || name;
  const shared = peers.filter((peer) => (peer.split(" ")[0] || peer) === first).length > 1;
  const second = name.split(" ")[1]?.[0];
  const base = shared && second ? `${first} ${second}.` : first;
  return base.length > 9 ? `${base.slice(0, 8)}…` : base;
}

function Page() {
  return <CompagniaPage />;
}

/** La Compagnia, con le gare dentro: una sola voce nella barra in basso. `initial` apre una scheda (da /gare: Gare). */
export function CompagniaPage({ initial }: { initial?: Section } = {}) {
  const ink = useThemeInk();
  const palette = [ink.primary, ink.accent, ink.soft];
  const { me } = useMember();
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`squad-board-${nonce}`, () => squadBoard());
  const companies = useLoad(`companies-${nonce}`, () => listCompanies());
  const [sectionRaw, setStored] = useLocalState<string>("aa-compagnia-tab", "arcieri");
  // aperta da /gare si parte da Gare; un tocco sulle schede sceglie e ricorda
  // da un avviso del mercatino in Bacheca (#mercatino-12) si apre il Mercatino con l'annuncio
  const [opened, setOpened] = useState<Section | undefined>(() => (typeof window !== "undefined" && /^#mercatino(-\d+)?$/.test(window.location.hash) ? "mercatino" : initial));
  // dal Menu (Compagnia › Mercatino) o da un avviso, anche con la pagina già aperta: si apre il Mercatino e ci si arriva
  const hash = useRouterState({ select: (st) => st.location.hash });
  const wasMarket = useRef(false);
  useEffect(() => {
    const isMarket = /^#?mercatino(-\d+)?$/.test(hash ?? "");
    if (isMarket) {
      setOpened("mercatino");
      const t = window.setTimeout(() => document.getElementById("mercatino")?.scrollIntoView({ block: "start", behavior: "smooth" }), 120);
      wasMarket.current = true;
      return () => window.clearTimeout(t);
    }
    if (wasMarket.current) setOpened(undefined);
    wasMarket.current = false;
  }, [hash]);
  const setSection = (x: Section) => {
    setOpened(undefined);
    setStored(x);
  };
  const stored: Section = SECTIONS.some((x) => x.id === sectionRaw) ? (sectionRaw as Section) : OLD_SECTION[sectionRaw] ?? "arcieri";
  const section: Section = opened ?? stored;
  const [editing, setEditing] = useState<"none" | "edit" | "new">("none");
  const [busy, setBusy] = useState<number | null>(null);
  const [linkFor, setLinkFor] = useState<{ team: string; name: string } | null>(null);
  const [showTrophies, setShowTrophies] = useState(false);
  const looks = useTeamAvatars();
  const [removed, setRemoved] = useState<number[]>([]);
  const [board, setBoard] = useEntryState<"padiglione" | "sagoma">("squadra-board", "padiglione");
  const [look, setLook] = useEntryState<"tre" | "calore" | "mappa">("squadra-look", "tre");
  const [face, setFace] = useState("io");
  // Arcieri: una divisione per podio, elenco e classifiche ("" = tutti)
  const [division, setDivision] = useState<"" | (typeof DIVISIONS)[number]>("");
  // e un tipo d'arco ("" = tutti): ogni arco ha il suo podio
  const [bow, setBow] = useState("");
  const [stat, setStat] = useState<"frecce" | "allenamenti" | "distanze" | "gare">("frecce");
  const [picked, setPicked] = useState<string[]>([]);
  const [pick, setPick] = useState<string[]>([]);
  const people = useMemo(() => {
    const rows = data?.people ?? [];
    const names = rows.map((row) => memberLabel(row, rows));
    return rows.map((row, index) => {
      const scored = skillOf(row);
      return { ...row, ...scored, name: names[index] ?? row.givenName, color: INK[index % INK.length] ?? INK[0] };
    });
  }, [data]);
  const ranked = useMemo(() => [...people].sort(bySkill), [people]);
  const chosen = pick.length ? pick : ranked.filter((row) => row.skill >= 0).slice(0, 2).map((row) => row.userId);

  // la pagina compare tutta insieme: lo stemma della compagnia arriva con l'elenco, non dopo spingendolo giù
  if (loading || (companies.loading && !companies.data)) return <Loading />;
  if (error || !data) return <ErrorNote text={error || "Errore"} />;
  if (people.length === 0) return <Empty title="Ancora nessuno" text="Il primo account apre la compagnia. Gli altri si registrano da soli." />;

  const bows: string[] = [...new Set<string>(people.map((row) => String(row.bowType ?? "")).filter(Boolean))].sort((a, b) => bowLabel(a).localeCompare(bowLabel(b), "it"));
  const bowOn = bows.includes(bow) ? bow : "";
  const fits = (row: (typeof people)[number]) => (division === "" || row.division === division) && (bowOn === "" || row.bowType === bowOn);
  const podium = () => ranked.filter((row) => row.skill >= 0 && fits(row)).slice(0, 3);
  // l'elenco va dal più bravo al meno bravo (stesso ordine del podio), senza dirlo
  const inDivision = ranked.filter(fits);

  function toggle(userId: string) {
    setPick((current) => {
      const base = current.length ? current : chosen;
      if (base.includes(userId)) return base.filter((id) => id !== userId);
      if (base.length >= 3) return base;
      return [...base, userId];
    });
  }

  const compared = people.filter((row) => chosen.includes(row.userId));
  const compareKeys = compared.map((row, index) => ({ key: row.userId, color: palette[index % palette.length] ?? ink.primary, name: axisName(row.name, compared.map((item) => item.name)) }));
  const volume = [
    { name: "Allenamenti", ...Object.fromEntries(compared.map((row) => [row.userId, row.sessions])) },
    { name: "Gare", ...Object.fromEntries(compared.map((row) => [row.userId, row.gare])) },
  ];
  const points = [{ name: "Campionato", ...Object.fromEntries(compared.map((row) => [row.userId, row.champ])) }];
  const shown = (face === "tutti" ? people : face === "scelta" ? people.filter((row) => picked.includes(row.userId)) : people.filter((row) => row.userId === me.userId))
    .filter((row) => (board === "sagoma" ? row.sagoma.length : row.shots.length))
    .sort((a, b) => (a.userId === me.userId ? -1 : b.userId === me.userId ? 1 : a.name.localeCompare(b.name, "it")));
  const paint = [...shown].sort((a, b) => (a.userId === me.userId ? 1 : b.userId === me.userId ? -1 : 0));
  const dots = paint.flatMap((row) => row.shots.map((shot) => ({ ...shot, color: row.userId === me.userId ? "#e07a2f" : row.color })));
  const sagomaShots = paint.flatMap((row) => row.sagoma).map((shot) => ({ score: shot.score, nx: shot.nx, ny: shot.ny }));


  const company = companies.data?.companies.find((co) => co.id === companies.data?.mine) ?? null;
  const names = people.map((item) => item.name);
  const rankRow = (row: (typeof people)[number], value: number, extra?: { label?: string; sub?: string }) => ({
    id: row.userId,
    name: row.userId === me.userId ? `${axisName(row.name, names)} (tu)` : row.name,
    value,
    photo: row.photoUrl,
    look: looks[row.userId],
    color: row.color,
    me: row.userId === me.userId,
    ...extra,
  });

  async function join(id: number) {
    setBusy(id);
    try {
      await joinAndReload(id, () => setNonce((n) => n + 1));
      setSection("arcieri");
      // appena entrato: «Sei uno di loro?» con gli arcieri FITAST della compagnia
      const co = companies.data?.companies.find((c) => c.id === id);
      if (co) setLinkFor({ team: co.fitastTeam || co.fitastName || co.name, name: co.name });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      {linkFor ? <JoinLinkSheet team={linkFor.team} companyName={linkFor.name} onClose={() => { setLinkFor(null); setNonce((n) => n + 1); }} /> : null}
      {company ? (
        <>
          <CompanyHero co={company} canEdit={Boolean(companies.data?.canEdit)} onEdit={() => setEditing("edit")} />
          {/* il palmarès sta nel profilo della compagnia: podi, piazzamenti di squadra e premi dell'app */}
          <button type="button" onClick={() => setShowTrophies((v) => !v)} aria-expanded={showTrophies} className="aa-press -mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-white/[0.03] px-3 text-left">
            <Cup place={null} size={34} />
            <span className="min-w-0 flex-1">
              <b className="block text-sm">Podi e premi della compagnia</b>
              <span className="block text-[0.7rem] text-muted">Bacheca, piazzamenti di squadra e premi dell'app</span>
            </span>
            <Glyph name="chevron" size={15} className={`shrink-0 text-muted transition-transform ${showTrophies ? "rotate-90" : ""}`} />
          </button>
          {showTrophies ? (
            <>
              <CompanyTrophies companyId={company.id} companyName={company.name} />
              <GadgetShelf />
            </>
          ) : null}
        </>
      ) : (
        <PageHead title="Compagnia" />
      )}
      {editing !== "none" ? (
        <CompanyForm
          co={editing === "edit" && company ? company : undefined}
          onCancel={() => setEditing("none")}
          onDone={() => {
            setEditing("none");
            setNonce((n) => n + 1);
            setSection("arcieri");
          }}
        />
      ) : null}
      <nav aria-label="Sezioni della compagnia" className="aa-club-tabs sticky top-[calc(env(safe-area-inset-top)+3.6rem)] z-20 -mx-1 px-1">
        <div className="grid grid-cols-5 gap-1 rounded-2xl p-1">
          {SECTIONS.map((x) => (
            <button key={x.id} type="button" aria-pressed={section === x.id} onClick={() => setSection(x.id)} className="aa-club-tab grid min-h-14 place-items-center gap-0.5 rounded-xl px-0 py-1 text-[0.62rem] font-semibold leading-tight tracking-tight">
              <Glyph name={x.icon} size={18} />
              <span className="max-w-full truncate">{x.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <p className="-mt-2 px-1 text-xs text-muted">{SECTIONS.find((x) => x.id === section)?.lede}</p>

      {section === "arcieri" ? (
        <>
          {/* una divisione alla volta: podio, elenco e classifiche seguono la scelta */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
            {(["", ...DIVISIONS.filter((d) => people.some((row) => row.division === d))] as ("" | (typeof DIVISIONS)[number])[]).map((d) => (
              <button key={d || "tutti"} type="button" aria-pressed={division === d} onClick={() => setDivision(d)} className={`aa-chip shrink-0 ${division === d ? "border-[#e0b15a]/60 bg-[#e0b15a]/15 text-[#f1cf8a]" : ""}`}>
                {d || "Tutti"}
              </button>
            ))}
          </div>
          {bows.length > 1 ? (
            <div className="-mx-1 -mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="group" aria-label="Tipo d'arco">
              {["", ...bows].map((b) => (
                <button key={b || "tutti"} type="button" aria-pressed={bowOn === b} onClick={() => setBow(b)} className={`aa-chip shrink-0 ${bowOn === b ? "border-[#e0b15a]/60 bg-[#e0b15a]/15 text-[#f1cf8a]" : ""}`}>
                  {b ? bowLabel(b) : "Tutti gli archi"}
                </button>
              ))}
            </div>
          ) : null}
          <Podium title={[division || (bowOn ? "" : "Generale"), bowOn ? bowLabel(bowOn) : ""].filter(Boolean).join(" · ")} rows={podium()} looks={looks} />
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="font-display text-2xl">Gli arcieri</h2>
              <span className="text-xs text-muted">{inDivision.length} {inDivision.length === 1 ? "iscritto" : "iscritti"}{division ? ` · ${division}` : ""}{bowOn ? ` · ${bowLabel(bowOn)}` : ""}</span>
            </div>
            {me.role === "admin" ? <p className="px-1 text-xs text-muted">Tieni premuto su una persona per toglierla dall'app.</p> : null}
            {inDivision.filter((row) => !removed.includes(row.id)).map((row, i) => {
              const card = <ArcherCard row={row} look={looks[row.userId]} index={i} me={row.userId === me.userId} />;
              if (me.role !== "admin" || row.userId === me.userId || (row.admin && !me.isSuper)) return <div key={row.id}>{card}</div>;
              return (
                <HoldDelete
                  key={row.id}
                  hint={false}
                  label={`Togliere ${row.name} dall'app? Il suo account e i suoi allenamenti vengono cancellati e non si possono recuperare.`}
                  onDelete={() => removeTeamMember({ data: { id: row.id } }).then(() => setRemoved((list) => [...list, row.id]))}
                >
                  {card}
                </HoldDelete>
              );
            })}
          </div>

          <Card className="grid grid-cols-[minmax(0,1fr)] gap-3">
            <div>
              <h2 className="font-display text-2xl">Classifiche{division ? ` · ${division}` : ""}</h2>
              <p className="text-sm text-muted">{stat === "frecce" ? "Frecce tirate, tra allenamenti e gare." : stat === "allenamenti" ? "Allenamenti registrati." : stat === "distanze" ? "Il tiro più lungo, tra allenamenti e piazzole di gara." : "Gare con un punteggio segnato."}</p>
            </div>
            <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
              <Segmented value={stat} onChange={setStat} options={[{ id: "frecce", label: "Frecce" }, { id: "allenamenti", label: "Allenamenti" }, { id: "distanze", label: "Distanze" }, { id: "gare", label: "Gare" }]} />
            </div>
            {stat === "frecce" ? <RankBars rows={inDivision.map((row) => rankRow(row, row.arrows, { sub: `${row.trainArrows} in allenamento · ${row.garaArrows} in gara` }))} unit="frecce" tint="#e07a2f" empty="Ancora nessuna freccia." /> : null}
            {stat === "allenamenti" ? <RankBars rows={inDivision.map((row) => ({ ...rankRow(row, row.sessions), color: "#3d8f5f" }))} unit="allenamenti" tint="#3d8f5f" empty="Ancora nessun allenamento." /> : null}
            {stat === "distanze" ? <RankBars rows={inDivision.map((row) => ({ ...rankRow(row, row.bestDistance ?? 0), color: "#4b8fd1" }))} unit="m" tint="#4b8fd1" empty="Ancora nessuna distanza segnata." /> : null}
            {stat === "gare" ? <RankBars rows={inDivision.map((row) => ({ ...rankRow(row, row.gare, { sub: row.compAvg != null ? `media gara ${fmtAvg(row.compAvg)}` : undefined }), color: "#d6a72a" }))} unit="gare" tint="#d6a72a" empty="Ancora nessuna gara segnata." /> : null}
          </Card>
          <GroupBestPosture />
          <Card>
            <h2 className="font-display text-2xl">Confronto</h2>
            <p className="mb-3 text-sm text-muted">Fino a tre alla volta. {chosen.length >= 3 ? "Togli un nome per cambiarlo." : ""}</p>
            <div className="flex flex-wrap gap-2">
              {people.map((row) => {
                const on = chosen.includes(row.userId);
                return (
                  <button key={row.userId} type="button" onClick={() => toggle(row.userId)} className={`min-h-11 rounded-full px-3 text-sm font-semibold ${on ? "bg-primary text-primary-fg" : "border border-line"}`}>
                    {row.name}
                  </button>
                );
              })}
            </div>
            {compared.length < 2 ? <p className="mt-3 text-sm text-muted">Scegli almeno due arcieri.</p> : (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[18rem] text-left text-sm">
                    <thead>
                      <tr className="text-muted">
                        <th className="py-2 pr-2 font-medium"> </th>
                        {compared.map((row) => <th key={row.userId} className="py-2 pr-2 font-semibold text-fg">{axisName(row.name, compared.map((item) => item.name))}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Allenamenti", (row: Archer) => String(row.sessions)],
                        ["Frecce", (row: Archer) => String(row.arrows)],
                        ["di cui allenamento", (row: Archer) => String(row.trainArrows)],
                        ["di cui gare", (row: Archer) => String(row.garaArrows)],
                        ["Media tiro", (row: Archer) => row.avg == null ? "—" : fmtAvg(row.avg)],
                        ["Gare", (row: Archer) => String(row.gare)],
                        ["Distanza migliore", (row: Archer) => row.bestDistance == null ? "—" : `${row.bestDistance} m`],
                        ["Punti campionato", (row: Archer) => String(row.champ)],
                        ["Media gara", (row: Archer) => row.compAvg == null ? "—" : fmtAvg(row.compAvg)],
                      ].map(([label, read]) => (
                        <tr key={String(label)} className="border-t border-line">
                          <th className="py-2 pr-2 text-left font-medium">{label as string}</th>
                          {compared.map((row) => <td key={row.userId} className="py-2 pr-2 tabular-nums">{(read as (row: Archer) => string)(row)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3 className="mb-2 mt-4 font-display text-xl">Allenamenti e gare</h3>
                <MultiBars data={volume} keys={compareKeys} />
                <h3 className="mb-2 mt-4 font-display text-xl">Punti campionato</h3>
                <MultiBars data={points} keys={compareKeys} />
              </>
            )}
          </Card>
        </>
      ) : null}

      {section === "mercatino" ? (
        <div id="mercatino" className="scroll-mt-[calc(env(safe-area-inset-top)+8.5rem)]">
          <MarketTab />
        </div>
      ) : null}


      {section === "gare" ? (
        <>
          <GareTab companies={companies.data?.companies ?? NO_COMPANIES} />
        </>
      ) : null}


      {section === "compagnie" ? (
        <>
          {companies.data ? <CompagnieTab board={companies.data} onJoin={(id) => void join(id)} busy={busy} onSynced={() => setNonce((n) => n + 1)} /> : companies.error ? <ErrorNote text={companies.error} /> : <Loading />}
          {editing === "none" ? (
            <Card className="grid gap-2">
              <h2 className="font-display text-2xl">Una nuova compagnia</h2>
              <p className="text-sm text-muted">Fondala tu: scegli nome, stemma, colore, contatti e social. Gli altri arcieri potranno entrare da questa pagina.</p>
              <Button onClick={() => setEditing("new")}>Fonda una compagnia</Button>
            </Card>
          ) : null}
        </>
      ) : null}

      {section === "bersaglio" ? (
        <>
          {/* un solo pannello: di chi, poi un solo grafico che passa da padiglione a sagome, termica e piana */}
          <Card className="grid gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {([["io", "I miei"], ["tutti", "Tutta la compagnia"], ["scelta", "Scegli"]] as const).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={face === key} onClick={() => setFace(key)} className={`aa-chip ${face === key ? "border-transparent bg-accent text-accent-fg" : ""}`}>{label}</button>
              ))}
            </div>
            {face === "scelta" ? (
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
                {people.filter((row) => (board === "sagoma" ? row.sagoma.length : row.shots.length)).map((row) => {
                  const on = picked.includes(row.userId);
                  return (
                    <button key={row.userId} type="button" aria-pressed={on} onClick={() => setPicked((current) => on ? current.filter((id) => id !== row.userId) : [...current, row.userId])} className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm ${on ? "border-transparent bg-white/15 font-semibold" : "border-line text-muted"}`}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.userId === me.userId ? "#e07a2f" : row.color }} />
                      {row.userId === me.userId ? "Io" : row.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <BoardSwitch board={board} look={look} onPick={(b, l) => { setBoard(b); setLook(l); }} />
            {look !== "tre" ? <p className="-mt-1 text-xs text-muted">{look === "calore" ? "Termica" : "Piana"} {board === "sagoma" ? "delle sagome (rosso e giallo lo spot, blu e nero il corpo)" : "del padiglione"}</p> : null}
            {board === "sagoma" ? (
              sagomaShots.length ? <SagomaLab animal="sagome-3d" shots={sagomaShots} view={look === "calore" ? "mappa" : look === "mappa" ? "piana" : "tre"} /> : <Empty title="Nessun tiro su sagoma" text="Arrivano dalle piazzole delle gare e dagli allenamenti sulle sagome." />
            ) : dots.length ? (
              <div className="grid gap-2">
                {look === "mappa" ? (
                  <svg viewBox="-1.12 -1.12 2.24 2.24" className="mx-auto aspect-square w-full max-w-sm" role="img" aria-label="I tiri sul padiglione">
                    <circle cx="0" cy="0" r="1.08" fill="var(--elev)" />
                    {RINGS.map((ring) => <circle key={ring.r} cx="0" cy="0" r={ring.r} fill={ring.fill} />)}
                    <circle cx="0" cy="0" r="0.04" fill="#14181c" />
                    {dots.map((shot, index) => <circle key={index} cx={shot.nx} cy={shot.ny} r="0.03" fill={shot.color} stroke="#14181c" strokeWidth="0.008" />)}
                  </svg>
                ) : (
                  <PadTarget dots={dots} heat={look === "calore"} />
                )}
                <FaceStats dots={dots} />
              </div>
            ) : (
              <Empty title="Nessun tiro sul padiglione" text="Arrivano dagli allenamenti con le frecce segnate sul bersaglio." />
            )}
            {face !== "io" && shown.length ? (
              <ul className="flex flex-wrap gap-x-3 gap-y-1 border-t border-white/[0.06] pt-2 text-xs">
                {shown.map((row) => (
                  <li key={row.userId} className="flex items-center gap-1.5">
                    {board === "padiglione" ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.userId === me.userId ? "#e07a2f" : row.color }} /> : null}
                    {row.userId === me.userId ? "Tu" : row.name}
                    <span className="tabular-nums text-muted">{board === "sagoma" ? row.sagoma.length : row.shots.length}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          {board === "sagoma" ? <SquadAnimals peers={people} looks={looks} meId={me.userId ?? ""} /> : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Compagnie: la classifica (prima il campionato FITAST letto dal portale, poi i numeri dell'app),
 * i primi arcieri del campionato e l'elenco delle compagnie in cui entrare. Le gare del campionato
 * stanno nella scheda Gare.
 */
function CompagnieTab({ board, onJoin, busy, onSynced }: { board: Awaited<ReturnType<typeof listCompanies>>; onJoin: (id: number) => void; busy: number | null; onSynced: () => void }) {
  const league = useFitastLeague(board.companies);
  // la nostra compagnia come la scrive il portale (anche negli anni passati): per i nostri podi nell'albo
  const mine = board.companies.find((c) => c.id === board.mine);
  const ourKeys = useMemo(() => new Set([mine?.fitastTeam, mine?.fitastName, mine?.name].map((x) => teamKey(x ?? "")).filter((k) => k.length >= 3)), [mine]);
  const isOurs = useCallback((team: string) => ourKeys.has(teamKey(team)), [ourKeys]);
  return (
    <>
      <FitastHeader league={league} />
      <CompanyLeague part="ranking" board={board} onJoin={onJoin} busy={busy} fitastBoard={<FitastCompanyBoard league={league} />} fitastMetric={(m) => <FitastTeamsBoard league={league} metric={m} />} fitastReady={league.genSq.length > 0} />
      <FitastArchersCard league={league} />
      <FitastArchiveCard crestOf={league.crestOf} isOurs={isOurs} ourName={mine?.name ?? ""} />
      <CompanyLeague part="directory" board={board} onJoin={onJoin} busy={busy} onSynced={onSynced} />
    </>
  );
}

const NO_COMPANIES: Awaited<ReturnType<typeof listCompanies>>["companies"] = [];

/** le gare: quelle dell'app e quelle del campionato FITAST insieme, una scheda per gara */
function GareTab({ companies }: { companies: Awaited<ReturnType<typeof listCompanies>>["companies"] }) {
  // le classifiche del portale: stemmi delle compagnie e aggiornamento quando sono vecchie
  const league = useFitastLeague(companies);
  return <GareBody embedded league={league} />;
}


/** i numeri del padiglione: frecce, media stimata dai cerchi e quante nell'oro (9 e 10) */
function FaceStats({ dots }: { dots: { nx: number; ny: number }[] }) {
  const scores = dots.map((d) => Math.max(0, 10 - Math.floor(Math.hypot(d.nx, d.ny) * 10)));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const gold = scores.filter((v) => v >= 9).length;
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {([["Frecce", String(dots.length)], ["Media", avg.toFixed(1).replace(".", ",")], ["Nell'oro", dots.length ? `${Math.round((gold / dots.length) * 100)}%` : "—"]] as const).map(([k, v]) => (
        <div key={k} className="aa-kpi rounded-xl border px-2 py-2">
          <p className="text-[11px] text-muted">{k}</p>
          <p className="font-display text-xl leading-none tabular-nums">{v}</p>
        </div>
      ))}
    </div>
  );
}

function SquadAnimals({ peers, looks, meId }: { peers: { userId: string; name: string; photoUrl: string | null; color: string }[]; looks: Record<string, AvatarLook>; meId: string }) {
  const board = useLoad("skill-board", () => skillBoard());
  const [animal, setAnimal] = useState(ANIMALS[13].id);
  const data = board.data;
  const face = ANIMALS.find((item) => item.id === animal) ?? ANIMALS[0];
  const inCrew = new Map(peers.map((row) => [row.userId, row]));
  const rowOf = (userId: string, value: number, label: string, sub: string) => {
    const person = inCrew.get(userId);
    return { id: userId, name: person?.name ?? "Arciere", value, label, sub, photo: person?.photoUrl, look: looks[userId], color: "#a3496f", me: userId === meId };
  };
  const sagoma = (data?.sagoma ?? [])
    .filter((row) => row.n > 0 && inCrew.has(row.userId))
    .map((row) => rowOf(row.userId, row.points / row.n, (row.points / row.n).toFixed(1).replace(".", ","), `${row.n} frecce su sagoma`));
  const onAnimal = (data?.animals ?? [])
    .filter((row) => animalByLabel(row.label).id === face.id && inCrew.has(row.userId) && row.n > 0)
    .map((row) => rowOf(row.userId, row.points / row.n, (row.points / row.n).toFixed(1).replace(".", ","), `${row.n} frecce su ${face.label.toLowerCase()}`));
  return (
    <Card className="relative grid gap-3 overflow-hidden">
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#a3496f] opacity-25 blur-2xl" />
      <div>
        <h2 className="font-display text-2xl">Chi va meglio sulle sagome</h2>
        <p className="text-sm text-muted">Media a freccia tra piazzole di gara e allenamenti; sotto, l'animale che scegli.</p>
      </div>
      <RankBars rows={sagoma} tint="#a3496f" empty="Nessun tiro di sagoma, per ora." />
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Animale</span>
        <select value={animal} onChange={(e) => setAnimal(e.target.value)} className="min-h-11 rounded-xl border border-line bg-transparent px-3">
          {ANIMALS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2">
        <img src={face.src} alt="" className="h-16 w-24 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <RankBars rows={onAnimal} tint="#a3496f" limit={3} empty={`Nessuna piazzola su ${face.label.toLowerCase()}.`} />
        </div>
      </div>
    </Card>
  );
}

function GadgetShelf() {
  const board = useLoad("gadgets", () => listGadgets());
  const prizes = (board.data?.prizes ?? []).filter((prize) => prize.holders.length > 0);
  if (!prizes.length) return null;
  return (
    <Card className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl">Premi dell'app</h2>
        <span className="text-xs text-muted">{prizes.length} sbloccati in compagnia</span>
      </div>
      {/* una vetrina che scorre: la medaglia, il premio e chi l'ha preso */}
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {prizes.map((prize) => (
          <div key={prize.code} className="grid w-[7.5rem] shrink-0 snap-start justify-items-center gap-1 rounded-2xl bg-white/[0.04] px-2 py-2.5 text-center">
            <PrizeMark code={prize.code} size="lg" />
            <p className="line-clamp-2 text-xs font-semibold leading-tight">{prize.title}</p>
            <p className="text-[0.62rem] text-muted">{prizeTier(prize.code).label}</p>
            <p className="line-clamp-2 text-[0.68rem] leading-tight">{prize.holders.map((holder) => holder.nickname || holder.givenName).join(", ")}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * Un solo grafico per il bersaglio della compagnia: padiglione e sagome in 3D sul paglione vero,
 * la termica (sullo stesso paglione) e la vista piana. Termica e piana valgono per il bersaglio scelto.
 */
function BoardSwitch({ board, look, onPick }: { board: "padiglione" | "sagoma"; look: "tre" | "calore" | "mappa"; onPick: (b: "padiglione" | "sagoma", l: "tre" | "calore" | "mappa") => void }) {
  const items: { id: string; label: string; icon: IconName; b: "padiglione" | "sagoma"; l: "tre" | "calore" | "mappa" }[] = [
    { id: "padiglione", label: "Padiglione", icon: "target", b: "padiglione", l: "tre" },
    { id: "sagoma", label: "Sagome", icon: "crosshair", b: "sagoma", l: "tre" },
    { id: "calore", label: "Termica", icon: "flame", b: board, l: "calore" },
    { id: "mappa", label: "Piana", icon: "pin", b: board, l: "mappa" },
  ];
  const on = look === "tre" ? board : look;
  return (
    <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white/[0.05] p-1" role="group" aria-label="Come vedere il bersaglio">
      {items.map((it) => (
        <button key={it.id} type="button" aria-pressed={on === it.id} onClick={() => onPick(it.b, it.l)} className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[12px] font-semibold leading-tight ${on === it.id ? "bg-primary text-primary-fg shadow" : "text-muted"}`}>
          <Glyph name={it.icon} size={16} />
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** il padiglione in 3D sul paglione vero; con la termica i colori dei tiri dipinti sulla visuale */
function PadTarget({ dots, heat }: { dots: { nx: number; ny: number; color: string }[]; heat: boolean }) {
  const key = heat ? dots.map((d) => `${d.nx.toFixed(3)},${d.ny.toFixed(3)}`).join(";") : "";
  const canvas = useMemo(() => {
    if (!key || typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    paintRingFace(c, TEAM_FACE.rings, dots.map((d) => ({ x: d.nx, y: d.ny, score: 1 })), "volume");
    return { canvas: c, key: `pad-${key.length}-${key.slice(0, 60)}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <TargetGL face={TEAM_FACE} shots={dots.slice(-120).map((d) => ({ x: d.nx, y: d.ny, color: d.color }))} faceCanvas={canvas} bare />;
}
