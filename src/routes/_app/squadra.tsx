import { useEntryState } from "@/lib/arcieri/back-restore";
import { AvatarChallenge } from "@/components/avatar-challenge";
import { removeTeamMember } from "@/lib/arcieri/account.api";
import { TargetGL } from "@/components/target-gl";
import { useMemo, useState, type ReactNode } from "react";
import { listCompanies } from "@/lib/arcieri/compagnie.api";
import { CompanyForm, CompanyHero, CompanyLeague, joinAndReload } from "@/components/compagnia";
import { CompanyTrophies } from "@/components/palmares";
import { FitastArchersCard, FitastCompanyBoard, FitastGare, FitastHeader, FitastTeamsBoard, useFitastLeague } from "@/components/fitast-league";
import { RankBars } from "@/components/rank-bars";
import { Heat } from "@/components/shot-lab";
import { useLocalState } from "@/lib/arcieri/local-store";
import { Podium } from "@/components/podium";
import { useTeamAvatars } from "@/components/avatar-hero";
import { createFileRoute, Link } from "@tanstack/react-router";
import { listClubOrders, listGadgets, saveClubOrder, setClubOrder, skillBoard, squadBoard } from "@/lib/arcieri/club.api";
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
import { SagomaLab } from "@/components/sagoma-lab";
import { faceById } from "@/lib/arcieri/scoring";

const TEAM_FACE = faceById("wa10");
import { GroupBestPosture } from "@/components/gesture-gallery";
import { Avatar, Button, Card, Empty, ErrorNote, Field, HoldDelete, Loading, PageHead, Segmented, Select, TextInput } from "@/components/kit";
import { useMember } from "@/components/shell";
import { PrizeMark, prizeTier } from "@/components/prize-mark";

/** cielo fisso e limpido per le ambientazioni nelle schede degli arcieri */
const MEMBER_SKY: Sky = { tod: "pomeriggio", weather: "sereno", clouds: 0.25, seed: 3 };

export const Route = createFileRoute("/_app/squadra")({ component: Page });

type Section = "arcieri" | "bersaglio" | "bacheca" | "compagnie" | "sfida";
/** le schede della Compagnia, una cosa per scheda: chi c'è, chi va meglio, dove tiriamo, cosa abbiamo vinto */
const SECTIONS: { id: Section; label: string; icon: IconName; lede: string }[] = [
  { id: "arcieri", label: "Arcieri", icon: "team", lede: "Chi tira con noi e i podi per divisione: tocca un nome per la scheda, confronta fino a tre arcieri." },
  { id: "bersaglio", label: "Bersaglio", icon: "target", lede: "Dove arrivano le frecce della compagnia, sul paglione e sulle sagome 3D." },
  { id: "bacheca", label: "Trofei", icon: "trophy", lede: "Il palmarès della compagnia, i premi e la spesa comune." },
  { id: "compagnie", label: "Compagnie", icon: "flag", lede: "Classifica delle compagnie e campionato FITAST letto dal portale: arcieri, gare, squadre. Qui entri in un'altra compagnia o ne fondi una." },
  { id: "sfida", label: "Sfida", icon: "duel", lede: "Sfida gli altri arcieri con il tuo avatar." },
];
/** le schede salvate dalla versione di prima */
const OLD_SECTION: Record<string, Section> = { compagnia: "arcieri", statistiche: "arcieri", classifiche: "arcieri", classifica: "compagnie", fitast: "compagnie" };

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

/** Scheda di un arciere: mezzo busto che esce dalla nicchia con la sua ambientazione, livello, divisione e numeri */
function ArcherCard({ row, look, index, me }: {
  row: { id: number; userId: string; name: string; division: string; bowType: string; xp?: number; sessions: number; arrows: number; gare: number; bestDistance: number | null; avatarColor: string; photoUrl: string | null; admin: boolean };
  look?: AvatarLook;
  index: number;
  me: boolean;
}) {
  const lv = levelOf(Math.max(0, row.xp ?? 0));
  const tint = DIVISION_TINT[row.division] ?? "#9aa39c";
  const stats: [string, string][] = [
    [row.sessions.toLocaleString("it-IT"), row.sessions === 1 ? "allenamento" : "allenamenti"],
    [row.arrows.toLocaleString("it-IT"), "frecce"],
    [String(row.gare), row.gare === 1 ? "gara" : "gare"],
  ];
  return (
    <Link to="/arciere/$id" params={{ id: String(row.id) }} className="block pt-4">
      <div className={`aa-menu-row aa-archer-card relative flex items-stretch gap-3 rounded-[1.4rem] p-2 pr-2.5 ${me ? "is-me" : ""}`} style={{ animationDelay: `${Math.min(index, 10) * 40}ms`, ["--div" as string]: tint }}>
        {/* nicchia: l'ambientazione dietro, il mezzo busto che sporge in alto */}
        <div className="relative w-[5.6rem] shrink-0 self-stretch">
          <div className="absolute inset-0 overflow-hidden rounded-[1.05rem] bg-[#16201b]">
            {look?.scene ? (
              <span className="absolute inset-x-[-60%] -bottom-[10%] top-[-60%] opacity-90">
                <SceneBackdrop sky={MEMBER_SKY} scene={look.scene} id={`mb${row.id}`} />
              </span>
            ) : null}
            <span className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_30%,transparent,rgba(0,0,0,0.45))]" />
          </div>
          {look ? (
            <div className="absolute inset-x-0 bottom-0 h-[128%] overflow-hidden rounded-b-[1.05rem]">
              <ArcherFront look={{ ...look, lefty: false }} fit crop="28 2 144 150" className="aa-bust h-full w-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)]" />
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <Avatar size="lg" label={row.name} color={row.avatarColor} photo={row.photoUrl} admin={row.admin} />
            </div>
          )}
          {/* livello: lo stemma in un angolo della nicchia */}
          <span className="absolute -bottom-1.5 -right-2 z-[2] h-9 w-8 drop-shadow-[0_3px_4px_rgba(0,0,0,0.6)]"><LevelCrest xp={row.xp ?? 0} compact className="h-full w-full" /></span>
        </div>
        <div className="min-w-0 flex-1 py-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate font-display text-[1.55rem] leading-none">{row.name}</p>
            {me ? <span className="shrink-0 rounded-full bg-primary/25 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-primary">Tu</span> : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {row.division ? <span className="rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider" style={{ background: `color-mix(in srgb, ${tint} 26%, transparent)`, color: `color-mix(in srgb, ${tint} 70%, white)` }}>{row.division}</span> : null}
            <span className="rounded-full bg-[#e0b15a]/15 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-[#f1cf8a]">Liv. {lv.level}</span>
            {row.bowType ? <span className="truncate text-[0.68rem] text-muted">{bowLabel(row.bowType)}</span> : null}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {stats.map(([v, k]) => (
              <span key={k} className="rounded-xl bg-white/[0.05] px-1.5 py-1 text-center">
                <b className="block font-display text-[1.05rem] leading-none tabular-nums">{v}</b>
                <span className="block truncate text-[0.6rem] text-muted">{k}</span>
              </span>
            ))}
          </div>
        </div>
        <span className="aa-bell grid h-8 w-8 shrink-0 self-center place-items-center rounded-full"><Glyph name="chevron" size={15} /></span>
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
  const ink = useThemeInk();
  const palette = [ink.primary, ink.accent, ink.soft];
  const { me } = useMember();
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`squad-board-${nonce}`, () => squadBoard());
  const companies = useLoad(`companies-${nonce}`, () => listCompanies());
  const [sectionRaw, setSection] = useLocalState<string>("aa-compagnia-tab", "arcieri");
  const section: Section = SECTIONS.some((x) => x.id === sectionRaw) ? (sectionRaw as Section) : OLD_SECTION[sectionRaw] ?? "arcieri";
  const [editing, setEditing] = useState<"none" | "edit" | "new">("none");
  const [busy, setBusy] = useState<number | null>(null);
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
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      {company ? (
        <CompanyHero co={company} canEdit={Boolean(companies.data?.canEdit)} onEdit={() => setEditing("edit")} />
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

      {section === "bacheca" ? (
        <>
          {company ? <CompanyTrophies companyId={company.id} companyName={company.name} /> : <Card><p className="text-sm text-muted">Entra in una compagnia (scheda Compagnie) per vedere il suo palmarès.</p></Card>}
          <GadgetShelf />
          <ClubSpend />
        </>
      ) : null}

      {section === "sfida" ? <AvatarChallenge looks={looks} /> : null}


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
          <Card>
            <h2 className="font-display text-2xl">Bersaglio della compagnia</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setBoard("padiglione")} className={`min-h-11 rounded-xl text-sm font-semibold ${board === "padiglione" ? "bg-primary text-primary-fg" : "border border-line"}`}>Padiglione</button>
              <button type="button" onClick={() => setBoard("sagoma")} className={`min-h-11 rounded-xl text-sm font-semibold ${board === "sagoma" ? "bg-primary text-primary-fg" : "border border-line"}`}>Sagome 3D</button>
            </div>
            <p className="mb-3 mt-2 text-sm text-muted">Prima i tuoi tiri, poi tutti, oppure solo chi scegli. Ci sono gli allenamenti e le gare.</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {([["io", "I miei"], ["tutti", "Tutti"], ["scelta", "Scegli"]] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setFace(key)} className={`min-h-11 rounded-full px-3 text-sm font-semibold ${face === key ? "bg-primary text-primary-fg" : "border border-line"}`}>{label}</button>
              ))}
            </div>
            {face === "scelta" ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {people.map((row) => {
                  const on = picked.includes(row.userId);
                  return (
                    <button key={row.userId} type="button" onClick={() => setPicked((current) => on ? current.filter((id) => id !== row.userId) : [...current, row.userId])} className={`min-h-11 rounded-full px-3 text-sm font-semibold ${on ? "bg-accent text-accent-fg" : "border border-line"}`}>
                      {row.userId === me.userId ? "Io" : row.name}
                      <span className="ml-1 tabular-nums opacity-70">{board === "sagoma" ? row.sagoma.length : row.shots.length}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {board === "sagoma" ? (
              sagomaShots.length ? <SagomaLab animal="sagome-3d" shots={sagomaShots} initial="tre" /> : <p className="text-sm text-muted">Nessun tiro di sagoma, per ora.</p>
            ) : dots.length ? (
              <div className="grid gap-2">
                <Segmented value={look} onChange={setLook} options={[{ id: "tre", label: "3D animato" }, { id: "calore", label: "Mappa termica" }, { id: "mappa", label: "Punti" }]} />
                {look === "tre" ? <TargetGL face={TEAM_FACE} shots={dots.slice(-180).map((d) => ({ x: d.nx, y: d.ny, color: d.color }))} bare /> : null}
                {look === "calore" ? <Heat face={TEAM_FACE} shots={dots.map((d) => ({ x: d.nx, y: d.ny }))} /> : null}
                {look === "mappa" ? (
                  <svg viewBox="-1.12 -1.12 2.24 2.24" className="mx-auto aspect-square w-full max-w-sm" role="img" aria-label="Minimappa dei tiri">
                    <circle cx="0" cy="0" r="1.08" fill="var(--elev)" />
                    {RINGS.map((ring) => <circle key={ring.r} cx="0" cy="0" r={ring.r} fill={ring.fill} />)}
                    <circle cx="0" cy="0" r="0.04" fill="#14181c" />
                    {dots.map((shot, index) => <circle key={index} cx={shot.nx} cy={shot.ny} r="0.03" fill={shot.color} stroke="#14181c" strokeWidth="0.008" />)}
                  </svg>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Nessun punto sul bersaglio, per ora.</p>
            )}
            <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {shown.map((row) => (
                <li key={row.userId} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.userId === me.userId ? "#e07a2f" : row.color }} />
                  {row.name}
                  <span className="text-muted">{board === "sagoma" ? row.sagoma.length : row.shots.length}</span>
                </li>
              ))}
            </ul>
          </Card>

          <SquadAnimals peers={people} looks={looks} meId={me.userId ?? ""} />

        </>
      ) : null}
    </div>
  );
}

/**
 * Compagnie: la classifica (prima il campionato FITAST letto dal portale, poi i numeri dell'app),
 * i primi arcieri del campionato, le sue gare, e l'elenco delle compagnie in cui entrare.
 */
function CompagnieTab({ board, onJoin, busy, onSynced }: { board: Awaited<ReturnType<typeof listCompanies>>; onJoin: (id: number) => void; busy: number | null; onSynced: () => void }) {
  const league = useFitastLeague(board.companies);
  return (
    <>
      <FitastHeader league={league} />
      <CompanyLeague part="ranking" board={board} onJoin={onJoin} busy={busy} fitastBoard={<FitastCompanyBoard league={league} />} fitastMetric={(m) => <FitastTeamsBoard league={league} metric={m} />} fitastReady={league.genSq.length > 0} />
      <FitastArchersCard league={league} />
      <FitastGare league={league} />
      <CompanyLeague part="directory" board={board} onJoin={onJoin} busy={busy} onSynced={onSynced} />
    </>
  );
}

const ORDER_LABEL: Record<string, string> = {
  penne: "Penne",
  aste: "Aste",
  punte: "Punte",
  cocche: "Cocche",
  flettenti: "Flettenti",
  altro: "Altro",
};

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
        <h2 className="font-display text-2xl">Sagome 3D</h2>
        <p className="text-sm text-muted">Media per freccia sulle sagome, tra piazzole di gara e allenamenti.</p>
      </div>
      <RankBars rows={sagoma} tint="#a3496f" empty="Nessun tiro di sagoma, per ora." />
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Chi è più bravo su un animale</span>
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
  return (
    <Card>
      <h2 className="mb-2 font-display text-2xl">Premi</h2>
      <p className="mb-3 text-sm text-muted">Solo quelli già conquistati da qualcuno della squadra.</p>
      {prizes.length === 0 ? <p className="text-sm text-muted">Nessuno sbloccato, per ora.</p> : (
        <div className="grid grid-cols-2 gap-2">
          {prizes.map((prize) => (
            <div key={prize.code} className="rounded-xl border border-accent p-2">
              <div className="flex items-center gap-2">
                <PrizeMark code={prize.code} />
                <p className="min-w-0 truncate text-sm font-semibold">{prize.title}</p>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted">{prizeTier(prize.code).label}</p>
              <p className="mt-1 truncate text-xs">{prize.holders.map((holder) => holder.nickname || holder.givenName).join(", ")}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ClubSpend() {
  const [nonce, setNonce] = useState(0);
  const orders = useLoad(`orders-${nonce}`, () => listClubOrders());
  const [item, setItem] = useState("penne");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  return (
    <Card className="grid gap-3">
      <h2 className="font-display text-2xl">Spesa comune</h2>
      <p className="text-sm text-muted">Penne, aste, punte: si scrive qui e si ordina insieme.</p>
      <div className="grid grid-cols-2 gap-2">
        <Select value={item} onChange={(e) => setItem(e.target.value)}>
          {Object.entries(ORDER_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </Select>
        <TextInput inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Quantità" />
      </div>
      <Field label="Nota"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Marca, misura, colore" /></Field>
      {err ? <ErrorNote text={err} /> : null}
      <Button onClick={() => saveClubOrder({ data: { item, qty: Number(qty) || 1, note } }).then(() => { setNote(""); setNonce((n) => n + 1); }).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"))}>Aggiungi all'ordine</Button>
      {(orders.data ?? []).length === 0 ? <Empty title="Nessun ordine" text="Quando manca qualcosa, mettilo qui." /> : null}
      {(orders.data ?? []).map((row) => (
        <div key={row.id} className="rounded-xl border border-line p-2">
          <p className="font-semibold">{ORDER_LABEL[row.item] ?? row.item} × {row.qty}</p>
          <p className="text-xs text-muted">{memberLabel(row, orders.data ?? [])} · {row.status}{row.note ? ` · ${row.note}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["aperto", "Aperto"], ["ordinato", "Ordinato"], ["arrivato", "Arrivato"]] as const).map(([status, label]) => (
              <button key={status} type="button" className="min-h-10 rounded-full border border-line px-3 text-xs" onClick={() => setClubOrder({ data: { id: row.id, status } }).then(() => setNonce((n) => n + 1))}>{label}</button>
            ))}
            {row.mine ? <button type="button" className="text-xs text-danger" onClick={() => setClubOrder({ data: { id: row.id, remove: true } }).then(() => setNonce((n) => n + 1))}>Togli</button> : null}
          </div>
        </div>
      ))}
    </Card>
  );
}
