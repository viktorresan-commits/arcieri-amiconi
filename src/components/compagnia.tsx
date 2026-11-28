import { CompanyTrophies } from "./palmares";
import { refreshCrests } from "@/lib/arcieri/crest";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import type { listCompanies } from "@/lib/arcieri/compagnie.api";
import { companyWelcome, createCompany, joinCompany, updateCompany } from "@/lib/arcieri/compagnie.api";
import { findCompanyLogos, fitastTeamStats, logoImageData, logoImageSearch, syncFitastCompanies, type TeamStat } from "@/lib/arcieri/fitast-league.api";
import { useLoad } from "@/lib/arcieri/use-load";
import { teamKey } from "@/lib/arcieri/fitast-league";
import { Avatar, Button, Card, ErrorNote, Field, Segmented, TextInput } from "./kit";
import { Glyph } from "./icons";
import { Insignia } from "./insignia";
import { RankBars } from "./rank-bars";
import { CrestPodium } from "./podium";
import { HPages } from "./hpages";
import { JoinLinkSheet, TeamArchersInline, TeamArchersSheet } from "./fitast-league";
import { crestOf as drawnCrest } from "@/lib/arcieri/fitast-league";

type Board = Awaited<ReturnType<typeof listCompanies>>;
type Co = Board["companies"][number];

/* ---------------- icone dei contatti (disegni generici, non i marchi) ---------------- */

type ContactKind = "phone" | "whatsapp" | "email" | "website" | "instagram" | "facebook" | "youtube" | "tiktok" | "address" | "board";

/** il disegno a linee 24×24 di un contatto (tratti e riempimenti li decide chi lo disegna) */
function contactArt(kind: ContactKind): ReactNode {
  const dot = { fill: "currentColor", stroke: "none" };
  switch (kind) {
    case "phone":
      return <path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />;
    case "whatsapp":
      return (
        <>
          <path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.5 18.6Z" />
          <path d="M9.6 9.4c.4 2.1 2.6 4.3 4.8 4.8l.9-1.2-1.6-.8-.7.7c-.9-.4-1.8-1.3-2.2-2.2l.7-.7-.8-1.6Z" {...dot} />
        </>
      );
    case "email":
      return (
        <>
          <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
          <path d="m4.5 7 7.5 6 7.5-6" />
        </>
      );
    case "website":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17" />
        </>
      );
    case "instagram":
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="4.5" />
          <circle cx="12" cy="12" r="3.6" />
          <circle cx="16.7" cy="7.3" r="1.1" {...dot} />
        </>
      );
    case "facebook":
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <path d="M14.6 8.2h-1.4a1.9 1.9 0 0 0-1.9 1.9V20M9.6 12.6h4.6" />
        </>
      );
    case "youtube":
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="4" />
          <path d="M10.4 9.4v5.2l4.4-2.6Z" {...dot} />
        </>
      );
    case "tiktok":
      return <path d="M13.5 4v10.6a3.3 3.3 0 1 1-3.3-3.3M13.5 4c.4 2.4 2 3.9 4.6 4.1" />;
    case "address":
      return (
        <>
          <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
          <circle cx="12" cy="10" r="2.4" />
        </>
      );
    case "board":
      return (
        <>
          <path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4.5 3.5v-3.5h0a1 1 0 0 1-1-1Z" />
          <path d="M8.5 9h7M8.5 12h4.5" />
        </>
      );
    default:
      return null;
  }
}

/** il contatto come moneta coniata: bordo d'oro, smalto del suo colore e il disegno in rilievo (come le icone del Menu) */
function ContactCoin({ kind, tint, size }: { kind: ContactKind; tint: string; size: number }) {
  return <Insignia art={contactArt(kind)} metal="gold" enamel={tint} shape="round" size={size} still />;
}

const LABEL: Record<ContactKind, string> = {
  phone: "Chiama",
  whatsapp: "WhatsApp",
  email: "Email",
  website: "Sito",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  address: "Mappa",
  board: "Bacheca",
};

function hrefOf(kind: ContactKind, value: string) {
  const v = value.trim();
  if (!v) return "";
  const web = (base: string) => (/^https:\/\//i.test(v) ? v : `${base}${v.replace(/^@/, "")}`);
  switch (kind) {
    case "phone":
      return `tel:${v}`;
    case "whatsapp":
      return `https://wa.me/${v.replace(/\D/g, "")}`;
    case "email":
      return `mailto:${v}`;
    case "website":
      return /^https:\/\//i.test(v) ? v : `https://${v}`;
    case "instagram":
      return web("https://instagram.com/");
    case "facebook":
      return web("https://facebook.com/");
    case "youtube":
      return web("https://youtube.com/@");
    case "tiktok":
      return web("https://tiktok.com/@");
    case "address":
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
    default:
      return "";
  }
}

function ContactButton({ kind, href, tint, compact = false }: { kind: ContactKind; href: string; tint: string; /** solo il bottone tondo, senza scritta (nell'intestazione) */ compact?: boolean }) {
  if (compact) {
    const dot = <ContactCoin kind={kind} tint={tint} size={42} />;
    if (kind === "board") return <Link to="/bacheca" aria-label={LABEL[kind]} title={LABEL[kind]} className="aa-press">{dot}</Link>;
    const ext = /^https:/.test(href);
    return <a href={href} aria-label={LABEL[kind]} title={LABEL[kind]} target={ext ? "_blank" : undefined} rel={ext ? "noreferrer" : undefined} className="aa-press">{dot}</a>;
  }
  const inner = (
    <>
      <ContactCoin kind={kind} tint={tint} size={52} />
      <span className="text-[0.66rem] font-semibold text-muted">{LABEL[kind]}</span>
    </>
  );
  if (kind === "board") return <Link to="/bacheca" className="aa-press grid justify-items-center gap-1">{inner}</Link>;
  const external = /^https:/.test(href);
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="aa-press grid justify-items-center gap-1">
      {inner}
    </a>
  );
}

const CONTACT_TINT: Record<ContactKind, string> = {
  phone: "#2f9e5b",
  whatsapp: "#1fa855",
  email: "#3a78c9",
  website: "#4b5f8a",
  instagram: "#c1457a",
  facebook: "#3b5ea8",
  youtube: "#c8372d",
  tiktok: "#2b2f3a",
  address: "#d07a2c",
  board: "#8a5bc4",
};

/* ---------------- intestazione della compagnia ---------------- */

export function CompanyHero({ co, canEdit, onEdit }: { co: Co; canEdit: boolean; onEdit: () => void }) {
  // arcieri, gare, punti e media veri del campionato FITAST (se la compagnia c'è), non quelli dell'app
  const st = useTeamStats()(co);
  const kinds = ["phone", "whatsapp", "email", "website", "instagram", "facebook", "youtube", "tiktok", "address"] as const;
  const links = kinds.map((kind) => ({ kind, href: hrefOf(kind, co[kind]) })).filter((item) => item.href);
  return (
    <section className="aa-company relative overflow-hidden rounded-[var(--radius-card)] border border-hair shadow-card" style={{ ["--co" as string]: co.color }}>
      <div className="aa-company-bg" aria-hidden />
      <div className="relative grid gap-3 p-4">
        {/* chi è: stemma, nome, motto (e la matita per chi la può modificare) */}
        <div className="flex items-center gap-3">
          <div className="aa-company-crest relative grid h-20 w-[4.3rem] shrink-0 place-items-center">
            {co.logoUrl ? <img src={co.logoUrl} alt={`Stemma di ${co.name}`} className="h-full w-full object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,.45)]" /> : <DefaultCrest color={co.color} letter={co.name.replace(/^Compagnia (degli |dei |di )?/i, "").slice(0, 1)} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/70">{co.city ? `Compagnia · ${co.city}` : "Compagnia"}</p>
            <h2 className="font-display text-[1.5rem] leading-[1.05] text-white">{co.name}</h2>
            {co.motto ? <p className="mt-0.5 truncate font-display text-sm italic text-white/80">«{co.motto}»</p> : null}
          </div>
          {canEdit ? (
            <button type="button" onClick={onEdit} aria-label="Modifica la compagnia" title="Modifica la compagnia" className="aa-press grid h-10 w-10 shrink-0 place-items-center self-start rounded-full bg-white/15 text-white backdrop-blur">
              <Glyph name="edit" size={17} />
            </button>
          ) : null}
        </div>
        {/* i numeri: quelli del campionato FITAST se la compagnia c'è, se no quelli dell'app */}
        <div className="grid grid-cols-4 gap-1.5">
          {(st
            ? [
                ["Arcieri", st.archers.toLocaleString("it-IT")],
                ["Gare", st.gare.toLocaleString("it-IT")],
                ["Pt camp.", st.points != null ? st.points.toLocaleString("it-IT") : "—"],
                ["Media", st.avg != null ? st.avg.toFixed(1).replace(".", ",") : "—"],
              ]
            : [
                ["Arcieri", co.members.toLocaleString("it-IT")],
                ["Frecce", co.arrows.toLocaleString("it-IT")],
                ["Punti", co.points.toLocaleString("it-IT")],
                ["Gare", co.gare.toLocaleString("it-IT")],
              ]
          ).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-black/25 px-1 py-1.5 text-center backdrop-blur-sm">
              <p className="font-display text-base leading-none text-white tabular-nums">{v}</p>
              <p className="mt-1 text-[0.56rem] font-semibold uppercase tracking-wider text-white/65">{k}</p>
            </div>
          ))}
        </div>
        {co.bio ? <p className="line-clamp-2 text-xs text-white/80">{co.bio}</p> : null}
        {/* contatti: una fila di bottoni tondi (il nome compare tenendo premuto), poi il campo */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] justify-items-center gap-1">
          {links.map((item) => <ContactButton key={item.kind} kind={item.kind} href={item.href} tint={CONTACT_TINT[item.kind]} compact />)}
        </div>
        {co.address ? <a className="truncate text-xs text-white/80 underline-offset-2 hover:underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(co.address)}`} target="_blank" rel="noreferrer">Campo: {co.address}</a> : null}
        {links.length === 0 ? <p className="text-xs text-white/70">{canEdit ? "Aggiungi telefono, WhatsApp e social con la matita: compariranno qui per tutti." : "Telefono e social non sono ancora stati inseriti."}</p> : null}
      </div>
    </section>
  );
}

function DefaultCrest({ color, letter }: { color: string; letter: string }) {
  return (
    <svg viewBox="0 0 96 112" className="h-full w-full drop-shadow-[0_8px_14px_rgba(0,0,0,.45)]" aria-hidden>
      <defs>
        <linearGradient id={`cr-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor="#0d1410" />
        </linearGradient>
      </defs>
      <path d="M6 6h84v44c0 30-20 48-42 56C26 98 6 80 6 50Z" fill={`url(#cr-${color.slice(1)})`} stroke="#e8c870" strokeWidth="3" />
      <path d="M6 6h84v22H6Z" fill="rgba(255,255,255,.12)" />
      <path d="M30 70 66 34M58 34h8v8M30 70l-4 6M34 74l-8 2" stroke="#f4e7c2" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <text x="48" y="25" textAnchor="middle" fontSize="16" fontWeight="700" fill="#f4e7c2" fontFamily="var(--font-display)">{letter.toUpperCase()}</text>
    </svg>
  );
}

/* ---------------- classifica tra compagnie ---------------- */

type Metric = "fitast" | "points" | "arrows" | "members" | "gare" | "avg";

/** i numeri veri di ogni compagnia nel campionato FITAST (arcieri, gare, media, punti), per nome */
function useTeamStats() {
  const { data } = useLoad("fitast-team-stats", () => fitastTeamStats());
  const map = new Map<string, TeamStat>();
  for (const t of data?.teams ?? []) map.set(teamKey(t.team), t);
  return (co: { name: string; fitastName?: string; fitastTeam?: string }) => map.get(teamKey(co.fitastTeam || "")) ?? map.get(teamKey(co.fitastName || "")) ?? map.get(teamKey(co.name)) ?? null;
}

/**
 * Loghi veri: il server li cerca poche compagnie per volta (portale FITAST, sito, dominio dell'e-mail);
 * qui si richiama finché ne restano, una volta per sessione, e si avvisa quando ne arrivano di nuovi.
 */
function useLogoSearch(onFound?: () => void) {
  const cb = useRef(onFound);
  cb.current = onFound;
  useEffect(() => {
    let off = false;
    try {
      if (sessionStorage.getItem("aa-company-logos-v2") === "1") return;
      sessionStorage.setItem("aa-company-logos-v2", "1");
    } catch {
      /* niente memoria di sessione: si cerca lo stesso */
    }
    void (async () => {
      for (let round = 0; round < 12 && !off; round += 1) {
        const r = await findCompanyLogos({ data: {} }).catch(() => null);
        if (!r || off) return;
        if (r.found > 0) cb.current?.();
        if (!r.remaining || !r.checked) return;
      }
    })();
    return () => {
      off = true;
    };
  }, []);
}

export function CompanyLeague({ board, onJoin, busy, onSynced, part, fitastBoard, fitastMetric, fitastReady = false }: {
  board: Board;
  onJoin: (id: number) => void;
  busy: number | null;
  /** arrivate compagnie nuove dal portale FITAST */
  onSynced?: () => void;
  /** solo la classifica o solo l'elenco delle compagnie (la scheda Compagnie mette in mezzo il campionato) */
  part?: "ranking" | "directory";
  /** la classifica generale compagnie letta dal portale, mostrata alla voce FITAST */
  fitastBoard?: ReactNode;
  /** ci sono classifiche FITAST salvate: si parte da quella */
  fitastReady?: boolean;
  /** media, iscritti e gare con i numeri veri del campionato FITAST (al posto di quelli dell'app) */
  fitastMetric?: (m: "avg" | "members" | "gare") => ReactNode;
}) {
  const hasFitast = fitastReady || board.companies.some((co) => co.fitastPoints != null);
  // nella scheda Compagnie si parte dal campionato FITAST
  const [metric, setMetric] = useState<Metric>(hasFitast || fitastBoard ? "fitast" : "points");
  const [open, setOpen] = useState<number | null>(null);
  const [find, setFind] = useState("");
  const [editCo, setEditCo] = useState<number | null>(null);
  const statOf = useTeamStats();
  // gli arcieri di una compagnia nella classifica generale FITAST
  const [teamOf, setTeamOf] = useState<{ team: string; crest: { name: string; logoUrl: string | null; color: string; fitastName?: string } } | null>(null);
  const [sync, setSync] = useState<{ busy: boolean; text: string }>({ busy: false, text: "" });
  useLogoSearch(part === "ranking" ? undefined : onSynced);
  // l'elenco delle compagnie FITAST si prepara da solo (una volta alla settimana)
  useEffect(() => {
    if (part === "ranking") return;
    let off = false;
    syncFitastCompanies({ data: {} })
      .then((r) => {
        // compagnie nuove o nomi corretti: si rilegge l'elenco
        if (!off && (r.added > 0 || (r.fixed ?? 0) > 0 || (r.removed ?? 0) > 0)) onSynced?.();
      })
      .catch(() => undefined);
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // il fondatore scarica subito i loghi di tutte le compagnie senza stemma vero, e vede com'è andata
  const [logos, setLogos] = useState<{ busy: boolean; text: string; list: { name: string; found: boolean; via: string }[] }>({ busy: false, text: "", list: [] });
  // il fondatore: solo le compagnie senza stemma vero (per sceglierli uno dopo l'altro)
  const [onlyMissing, setOnlyMissing] = useState(false);
  const noCrest = (co: { logoUrl: string | null }) => !co.logoUrl || co.logoUrl.startsWith("data:image/svg");
  async function downloadLogos() {
    setLogos({ busy: true, text: "Cerco i loghi…", list: [] });
    const list: { name: string; found: boolean; via: string }[] = [];
    let found = 0;
    let summary = "";
    try {
      for (let round = 0; round < 25; round += 1) {
        const r = await findCompanyLogos({ data: { force: round === 0 } });
        found += r.found;
        list.push(...r.results);
        summary = `${r.withLogo} compagnie su ${r.total} hanno il logo vero.`;
        setLogos({ busy: true, text: `Controllate ${list.length}, trovati ${found} loghi… ${summary}`, list: [...list] });
        if (r.found > 0) onSynced?.();
        if (!r.remaining || !r.checked) break;
      }
      setLogos({ busy: false, text: `Fatto: ${found} ${found === 1 ? "logo nuovo" : "loghi nuovi"}. ${summary}`, list });
    } catch (e) {
      setLogos({ busy: false, text: e instanceof Error ? e.message : "Ricerca non riuscita", list });
    }
  }
  async function forceSync() {
    setSync({ busy: true, text: "" });
    try {
      const r = await syncFitastCompanies({ data: { force: true } });
      const fix = (r.fixed ?? 0) || (r.removed ?? 0) ? ` Nomi corretti: ${r.fixed ?? 0}, doppioni tolti: ${r.removed ?? 0}.` : "";
      setSync({ busy: false, text: r.total ? `Elenco FITAST letto: ${r.total} compagnie, ${r.added} nuove, ${r.linked} già nell'app.${fix}` : `Elenco FITAST non letto.${fix}${r.diag.length ? ` Dettagli: ${r.diag.join(" | ")}` : ""}` });
      if (r.added > 0 || (r.fixed ?? 0) > 0 || (r.removed ?? 0) > 0) onSynced?.();
    } catch (e) {
      setSync({ busy: false, text: e instanceof Error ? e.message : "Non riuscito" });
    }
  }
  const unit: Record<Metric, string> = { fitast: "pt", points: "pt", arrows: "frecce", members: "arcieri", gare: "gare", avg: "" };
  const season = board.companies.find((co) => co.fitastSeason)?.fitastSeason ?? "";
  // media: quella di tutti gli arcieri di ogni compagnia nella generale FITAST (punti campionato per arciere);
  // senza classifica FITAST, la media per freccia degli arcieri nell'app
  const fitastAvgOn = board.companies.some((co) => co.fitastAvg != null);
  const rows = board.companies.filter((co) => (metric !== "fitast" || co.fitastPoints != null) && (metric !== "avg" || !fitastAvgOn || co.fitastAvg != null)).map((co) => {
    const avgValue = fitastAvgOn ? co.fitastAvg ?? 0 : co.avg ?? 0;
    const value = metric === "avg" ? avgValue : metric === "fitast" ? co.fitastPoints ?? 0 : co[metric];
    return {
      id: String(co.id),
      name: co.name,
      value,
      label: metric === "avg" ? (fitastAvgOn ? (co.fitastAvg == null ? "—" : co.fitastAvg.toFixed(1).replace(".", ",")) : co.avg == null ? "—" : co.avg.toFixed(2).replace(".", ",")) : undefined,
      sub: (metric === "avg" && fitastAvgOn
        ? [`${co.fitastArchers} ${co.fitastArchers === 1 ? "arciere" : "arcieri"} in classifica`, co.avg != null ? `media freccia ${co.avg.toFixed(2).replace(".", ",")}` : ""]
        : [metric === "fitast" && co.fitastPlace ? `${co.fitastPlace}ª nel campionato` : "", co.city, `${co.members} arcieri`]
      ).filter(Boolean).join(" · "),
      color: co.color,
      logo: co.logoUrl,
      badge: co.logoUrl ? undefined : <DefaultCrest color={co.color} letter={co.name.replace(/^Compagnia (degli |dei |di )?/i, "").slice(0, 1)} />,
      me: co.id === board.mine,
    };
  });
  const ranking = (
      <Card className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div>
          <h2 className="font-display text-2xl">Classifica compagnie</h2>
          <p className="text-sm text-muted">{metric === "fitast" ? `Punti del campionato FITAST${season ? ` (${season})` : ""}.` : fitastMetric && metric === "avg" ? "Media dei punti campionato per arciere: tutti gli arcieri di ogni compagnia nel campionato FITAST." : fitastMetric && metric === "members" ? "Arcieri di ogni compagnia che hanno tirato nel campionato FITAST." : fitastMetric && metric === "gare" ? "Gare del campionato FITAST disputate da ogni compagnia." : metric === "avg" && fitastAvgOn ? "Media dei punti campionato per arciere: tutti gli arcieri di ogni compagnia nella classifica generale FITAST." : metric === "avg" ? "Media per freccia degli arcieri di ogni compagnia, in allenamento e in gara." : "Tutte le frecce e i punti dei loro arcieri, in allenamento e in gara."}</p>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
        <Segmented<Metric>
          value={metric}
          onChange={setMetric}
          options={[
            { id: "fitast", label: "FITAST" },
            { id: "avg", label: "Media" },
            { id: "members", label: fitastMetric ? "Arcieri" : "Iscritti" },
            { id: "gare", label: "Gare" },
            ...(fitastMetric ? [] : [{ id: "points" as Metric, label: "Punti" }]),
            { id: "arrows", label: "Frecce" },
          ]}
        />
        </div>
        {metric === "fitast" && fitastBoard ? fitastBoard : fitastMetric && (metric === "avg" || metric === "members" || metric === "gare") ? fitastMetric(metric) : (
          <>
            {(() => {
              // le prime tre compagnie sul podio, con i loro stemmi
              const top = [...rows].filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 3);
              return top.length >= 2 ? <CrestPodium rows={top.map((r) => ({ key: r.id, name: r.name, mark: r.label ? `${r.label} ${metric === "avg" && fitastAvgOn ? "pt per arciere" : "media"}` : `${Number(r.value).toLocaleString("it-IT")} ${unit[metric]}`.trim(), logo: r.logo ?? drawnCrest(r.name).logo, color: r.color }))} /> : null;
            })()}
            <RankBars rows={rows} unit={unit[metric]} limit={12} empty={metric === "fitast" ? "Ancora nessun punto FITAST: tocca Aggiorna." : "Ancora nessun dato per questa classifica."} />
          </>
        )}
      </Card>
  );
  const directory = (
      <Card className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <h2 className="font-display text-2xl">Tutte le compagnie</h2>
        {board.isAdmin ? <p className="text-xs text-muted">Sei il fondatore: tocca una compagnia per vedere contatti e iscritti.</p> : <p className="text-xs text-muted">Tocca una compagnia per vedere i contatti.</p>}
        {board.companies.length > 8 ? <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Cerca per nome o città" aria-label="Cerca una compagnia" className="min-h-11 rounded-2xl border border-line bg-white/[0.04] px-3 text-sm" /> : null}
        {board.isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={sync.busy} onClick={() => void forceSync()} className="aa-chip">{sync.busy ? "Leggo l'elenco FITAST…" : "Aggiorna l'elenco delle compagnie"}</button>
            <button type="button" disabled={logos.busy} onClick={() => void downloadLogos()} className="aa-chip">{logos.busy ? "Scarico i loghi…" : "Scarica e aggiorna i loghi"}</button>
            <button type="button" aria-pressed={onlyMissing} onClick={() => setOnlyMissing((v) => !v)} className="aa-chip">Senza stemma ({board.companies.filter(noCrest).length})</button>
            {onlyMissing ? <p className="w-full text-xs text-muted">Tocca una compagnia, poi «Modifica logo, sito e contatti» e «Cerca lo stemma in rete»: scegli l'immagine giusta e salva.</p> : null}
            {sync.text ? <p className="w-full break-words text-xs text-muted">{sync.text}</p> : null}
            {logos.text ? <p className="w-full break-words text-xs text-muted" aria-live="polite">{logos.text}</p> : null}
            {logos.list.length ? (
              <details className="w-full rounded-xl bg-white/[0.03] px-3 py-2 text-xs">
                <summary className="cursor-pointer font-semibold">Dettaglio per compagnia ({logos.list.filter((x) => x.found).length} trovati, {logos.list.filter((x) => !x.found).length} no)</summary>
                <ul className="mt-2 grid gap-1">
                  {logos.list.map((x, i) => (
                    <li key={`${x.name}-${i}`} className="flex gap-2">
                      <span className={x.found ? "text-primary" : "text-muted"}>{x.found ? "✓" : "–"}</span>
                      <span className="min-w-0 flex-1"><b className="font-semibold">{x.name}</b> · {x.via}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
        {(() => {
          const matching = board.companies.filter((co) => (!onlyMissing || noCrest(co)) && (!find.trim() || `${co.name} ${co.city}`.toLowerCase().includes(find.trim().toLowerCase())));
          // dalla compagnia più numerosa (arcieri nel campionato FITAST o iscritti all'app); ne bastano 10, le altre a richiesta
          const size = (co: (typeof matching)[number]) => Math.max(statOf(co)?.archers ?? co.fitastArchers ?? 0, co.members);
          const ordered = [...matching].sort((a, b) => size(b) - size(a) || Number(b.id === board.mine) - Number(a.id === board.mine) || a.name.localeCompare(b.name, "it"));
          // tutte, a pagine di 8 che scorrono di lato (con la ricerca resta l'elenco trovato)
          return (
            <>
              <HPages as="div" items={ordered} per={8} keyOf={(co) => String(co.id)} focus={ordered.findIndex((co) => co.id === board.mine)} focusLabel="La mia" render={(co) => {
          const expanded = open === co.id;
          const kinds = ["phone", "whatsapp", "email", "website", "instagram", "facebook", "youtube", "tiktok", "address"] as const;
          const links = kinds.map((kind) => ({ kind, href: hrefOf(kind, co[kind]) })).filter((item) => item.href);
          return (
            <div key={co.id} className={`rounded-2xl ${expanded ? "bg-white/[0.07] ring-1 ring-white/10" : "bg-white/[0.04]"}`}>
              <div className="flex items-center gap-3 p-2.5">
                <button type="button" onClick={() => setOpen(expanded ? null : co.id)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  {co.logoUrl ? <img src={co.logoUrl} alt="" className="h-12 w-11 shrink-0 object-contain" /> : <span className="h-12 w-11 shrink-0"><DefaultCrest color={co.color} letter={co.name.replace(/^Compagnia (degli |dei |di )?/i, "").slice(0, 1)} /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{co.name}</span>
                    <span className="block truncate text-xs text-muted">{(() => {
                      const st = statOf(co);
                      // gli arcieri del portale (classifiche del campionato) contano più degli iscritti all'app
                      return [
                        co.city,
                        st ? `${st.archers} arcieri FITAST · ${st.gare} ${st.gare === 1 ? "gara" : "gare"}` : "",
                        co.members ? `${co.members} nell'app` : "",
                        co.fitastPoints != null ? `${co.fitastPlace ? `${co.fitastPlace}ª · ` : ""}${co.fitastPoints.toLocaleString("it-IT")} pt` : "",
                        !st && !co.members ? "nessun arciere in classifica" : "",
                      ].filter(Boolean).join(" · ");
                    })()}</span>
                  </span>
                </button>
                {co.id === board.mine ? (
                  <span className="shrink-0 rounded-full bg-primary/20 px-2.5 py-1 text-[0.68rem] font-semibold text-primary">La tua</span>
                ) : (
                  <button type="button" disabled={busy != null} onClick={() => onJoin(co.id)} className="aa-press min-h-9 shrink-0 rounded-full border border-line px-3 text-xs font-semibold disabled:opacity-50">
                    {busy === co.id ? "Entro…" : "Entra"}
                  </button>
                )}
              </div>
              {expanded ? (
                <div className="aa-rise grid gap-3 px-3 pb-3">
                  {co.motto ? <p className="font-display text-base italic">«{co.motto}»</p> : null}
                  {co.bio ? <p className="text-sm text-muted">{co.bio}</p> : null}
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {(() => {
                      const st = statOf(co);
                      return st
                        ? ([["Arcieri", st.archers], ["Gare", st.gare], ["Pt camp.", st.points ?? 0], ["Media", Math.round((st.avg ?? 0) * 10) / 10]] as [string, number][])
                        : ([["Arcieri", co.members], ["Frecce", co.arrows], ["Punti", co.points], ["Gare", co.gare]] as [string, number][]);
                    })().map(([k, v]) => (
                      <div key={String(k)} className="rounded-xl bg-black/20 py-1.5">
                        <p className="font-display text-base tabular-nums">{Number(v).toLocaleString("it-IT")}</p>
                        <p className="text-[0.58rem] font-semibold uppercase tracking-wider text-muted">{k}</p>
                      </div>
                    ))}
                  </div>
                  {links.length ? (
                    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                      {links.map((item) => <ContactButton key={item.kind} kind={item.kind} href={item.href} tint={CONTACT_TINT[item.kind]} />)}
                    </div>
                  ) : <p className="text-xs text-muted">Nessun contatto inserito.</p>}
                  {co.crew.length ? (
                    <div className="grid gap-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Iscritti</p>
                      {co.crew.map((m) => (
                        <Link key={m.userId} to="/arciere/$id" params={{ id: String(m.memberId) }} className="flex items-center gap-2.5 rounded-xl bg-black/15 p-2">
                          <Avatar size="sm" label={[m.givenName, m.familyName].filter(Boolean).join(" ") || m.nickname} color={m.avatarColor} photo={m.photoUrl} userId={m.userId} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{m.nickname || [m.givenName, m.familyName].filter(Boolean).join(" ")}</span>
                          {m.owner ? <span className="rounded-full bg-[#d9b45a]/20 px-2 py-0.5 text-[0.62rem] font-semibold text-[#e8c870]">Fondatore</span> : null}
                          <span className="text-xs tabular-nums text-muted">{m.arrows} frecce</span>
                        </Link>
                      ))}
                    </div>
                  ) : co.members > 0 && co.id !== board.mine ? <p className="text-xs text-muted">Gli iscritti li vedono il presidente e il fondatore.</p> : null}
                  <CompanyTrophies companyId={co.id} companyName={co.name} />
                  <TeamArchersInline team={co.fitastTeam || co.fitastName || co.name} canClaim={co.id === board.mine} />
                  <button type="button" onClick={() => setTeamOf({ team: co.fitastTeam || co.fitastName || co.name, crest: { name: co.name, logoUrl: co.logoUrl, color: co.color, fitastName: co.fitastName } })} className="aa-chip justify-self-start">
                    Classifica dei suoi arcieri
                  </button>
                  {board.isAdmin ? (
                    editCo === co.id ? (
                      <CompanyForm co={co} searchable onCancel={() => setEditCo(null)} onDone={() => { setEditCo(null); onSynced?.(); }} />
                    ) : (
                      <button type="button" onClick={() => setEditCo(co.id)} className="aa-chip justify-self-start">Modifica logo, sito e contatti</button>
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
          );
              }} />
              {teamOf ? <TeamArchersSheet team={teamOf.team} crest={teamOf.crest} onClose={() => setTeamOf(null)} /> : null}
            </>
          );
        })()}
      </Card>
  );
  if (part === "ranking") return ranking;
  if (part === "directory") return directory;
  return (
    <div className="grid gap-4">
      {ranking}
      {directory}
    </div>
  );
}

/* ---------------- modulo per fondare o modificare una compagnia ---------------- */

const COLORS = ["#1f7a46", "#b5302a", "#2a6294", "#c9861f", "#6b3fa0", "#2b2f3a", "#0f7d82", "#a3496f"];

type Draft = { name: string; motto: string; city: string; bio: string; color: string; phone: string; whatsapp: string; email: string; website: string; instagram: string; facebook: string; youtube: string; tiktok: string; address: string; logoUrl?: string | null };

function draftOf(co?: Co): Draft {
  return {
    name: co?.name ?? "",
    motto: co?.motto ?? "",
    city: co?.city ?? "",
    bio: co?.bio ?? "",
    color: co?.color ?? COLORS[0],
    phone: co?.phone ?? "",
    whatsapp: co?.whatsapp ?? "",
    email: co?.email ?? "",
    website: co?.website ?? "",
    instagram: co?.instagram ?? "",
    facebook: co?.facebook ?? "",
    youtube: co?.youtube ?? "",
    tiktok: co?.tiktok ?? "",
    address: co?.address ?? "",
  };
}

export function CompanyForm({ co, onDone, onCancel, searchable = false }: { co?: Co; onDone: () => void; onCancel: () => void; /** il fondatore: cerca lo stemma tra le immagini in rete */ searchable?: boolean }) {
  const [d, setD] = useState<Draft>(() => draftOf(co));
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const emailBad = d.email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim());
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((cur) => ({ ...cur, [k]: e.target.value }));
  const logo = d.logoUrl !== undefined ? d.logoUrl : co?.logoUrl ?? null;
  async function pickLogo(file: File) {
    try {
      setD((cur) => ({ ...cur, logoUrl: "" }));
      const data = await shrink(file);
      setD((cur) => ({ ...cur, logoUrl: data }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Immagine non letta");
    }
  }
  async function save() {
    setErr("");
    if (emailBad) {
      setErr("L'email non è scritta bene: controlla la chiocciola e il dominio.");
      return;
    }
    setSaving(true);
    try {
      const clean = { ...d, email: d.email.trim(), address: d.address.trim() };
      if (co) await updateCompany({ data: { id: co.id, ...clean } });
      else await createCompany({ data: clean });
      refreshCrests();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }
  const row = (children: ReactNode) => <div className="grid grid-cols-2 gap-2">{children}</div>;
  // il modulo si apre sotto la testata: lo porto in vista, così si vede subito
  const here = useRef<HTMLDivElement>(null);
  useEffect(() => {
    here.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  return (
    <div ref={here} className="scroll-mt-28">
    <Card className="grid gap-3">
      <h2 className="font-display text-2xl">{co ? "Modifica la compagnia" : "Fonda una compagnia"}</h2>
      {!co ? <p className="text-sm text-muted">Diventi il fondatore e lasci la compagnia di adesso. Gli altri potranno entrare dalla classifica.</p> : null}
      <div className="flex items-center gap-3">
        <div className="grid h-24 w-20 shrink-0 place-items-center rounded-2xl bg-white/[0.05]">
          {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : <DefaultCrest color={d.color} letter={d.name.replace(/^Compagnia (degli |dei |di )?/i, "").slice(0, 1) || "?"} />}
        </div>
        <div className="grid gap-2">
          <label className="aa-press inline-flex min-h-10 cursor-pointer items-center rounded-full border border-line px-3 text-sm font-semibold">
            Carica lo stemma
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickLogo(f); }} />
          </label>
          {logo ? <button type="button" className="text-left text-xs text-muted underline" onClick={() => setD((cur) => ({ ...cur, logoUrl: null }))}>Togli lo stemma</button> : null}
        </div>
      </div>
      {searchable ? <LogoSearch name={d.name || co?.fitastName || ""} onPick={(dataUrl) => setD((cur) => ({ ...cur, logoUrl: dataUrl }))} /> : null}
      <Field label="Nome"><TextInput value={d.name} onChange={set("name")} placeholder="Compagnia degli Arcieri di…" maxLength={70} /></Field>
      {row(<>
        <Field label="Motto"><TextInput value={d.motto} onChange={set("motto")} placeholder="In animo iuncti" maxLength={80} /></Field>
        <Field label="Città"><TextInput value={d.city} onChange={set("city")} placeholder="Fabriano" maxLength={50} /></Field>
      </>)}
      <h3 className="mt-1 font-display text-lg">Dove trovarci</h3>
      <Field label="Indirizzo del campo di tiro">
        <TextInput value={d.address} onChange={set("address")} placeholder="Via…, numero, città" maxLength={160} autoComplete="street-address" />
      </Field>
      {d.address.trim() ? (
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address.trim())}`} target="_blank" rel="noreferrer" className="-mt-1 text-xs text-accent underline">Controlla sulla mappa</a>
      ) : null}
      <Field label="Email della compagnia">
        <TextInput type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={d.email} onChange={set("email")} placeholder="info@nomecompagnia.it" maxLength={160} autoComplete="email" />
      </Field>
      {emailBad ? <p className="-mt-1 text-xs text-[#f3a46a]">Controlla l'email: deve essere tipo nome@dominio.it</p> : null}
      <Field label="Presentazione"><TextInput value={d.bio} onChange={set("bio")} placeholder="Dove vi allenate, quando, chi può entrare" maxLength={500} /></Field>
      <div className="grid gap-1 text-sm">
        <span>Colore</span>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Colore ${c}`} aria-pressed={d.color === c} onClick={() => setD((cur) => ({ ...cur, color: c }))} className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-[var(--color-bg)] ${d.color === c ? "ring-2 ring-white" : ""}`} style={{ background: c }} />
          ))}
        </div>
      </div>
      <h3 className="mt-1 font-display text-lg">Contatti e social</h3>
      {row(<>
        <Field label="Telefono"><TextInput inputMode="tel" value={d.phone} onChange={set("phone")} placeholder="+39 …" /></Field>
        <Field label="WhatsApp"><TextInput inputMode="tel" value={d.whatsapp} onChange={set("whatsapp")} placeholder="+39 …" /></Field>
      </>)}
      <Field label="Sito"><TextInput value={d.website} onChange={set("website")} placeholder="www.…" /></Field>
      {row(<>
        <Field label="Instagram"><TextInput value={d.instagram} onChange={set("instagram")} placeholder="nome utente" /></Field>
        <Field label="Facebook"><TextInput value={d.facebook} onChange={set("facebook")} placeholder="nome pagina" /></Field>
      </>)}
      {row(<>
        <Field label="YouTube"><TextInput value={d.youtube} onChange={set("youtube")} placeholder="canale" /></Field>
        <Field label="TikTok"><TextInput value={d.tiktok} onChange={set("tiktok")} placeholder="nome utente" /></Field>
      </>)}
      {err ? <ErrorNote text={err} /> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onCancel}>Annulla</Button>
        <Button onClick={() => void save()} disabled={saving}>{saving ? "Salvo…" : co ? "Salva" : "Fonda"}</Button>
      </div>
    </Card>
    </div>
  );
}

export async function joinAndReload(id: number, reload: () => void) {
  await joinCompany({ data: { id } });
  refreshCrests();
  reload();
}

/**
 * Lo stemma dalle immagini in rete: il server cerca (Bing, altrimenti DuckDuckGo), il fondatore tocca quello giusto.
 * C'è anche Google Immagini (o Google Lens dal telefono): si salva l'immagine e la si carica con «Carica lo stemma».
 */
function LogoSearch({ name, onPick }: { name: string; onPick: (dataUrl: string) => void }) {
  const [q, setQ] = useState(`${name} logo`);
  const [st, setSt] = useState<{ busy: boolean; text: string; items: { img: string; thumb: string; page: string }[] }>({ busy: false, text: "", items: [] });
  const [taking, setTaking] = useState("");
  async function search(query: string) {
    setQ(query);
    setSt({ busy: true, text: "Cerco…", items: [] });
    try {
      const r = await logoImageSearch({ data: { q: query } });
      setSt({ busy: false, text: r.items.length ? `Tocca lo stemma giusto (${r.via}).` : "Nessuna immagine trovata: prova con altre parole o con Google Immagini.", items: r.items });
    } catch (e) {
      setSt({ busy: false, text: e instanceof Error ? e.message : "Ricerca non riuscita.", items: [] });
    }
  }
  async function take(hit: { img: string; thumb: string }) {
    setTaking(hit.img);
    try {
      // l'immagine intera; se il suo sito non la dà, la miniatura
      const r = await logoImageData({ data: { url: hit.img } }).catch(() => logoImageData({ data: { url: hit.thumb } }));
      const blob = await (await fetch(r.dataUrl)).blob();
      onPick(await shrink(new File([blob], "stemma", { type: blob.type })));
      setSt((cur) => ({ ...cur, text: "Stemma messo: tocca «Salva» in fondo." }));
    } catch (e) {
      setSt((cur) => ({ ...cur, text: e instanceof Error ? e.message : "Immagine non letta: prova un'altra." }));
    } finally {
      setTaking("");
    }
  }
  return (
    <div className="grid gap-2 rounded-2xl bg-white/[0.03] p-2.5">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={st.busy} onClick={() => void search(`${name} logo`)} className="aa-chip">{st.busy ? "Cerco…" : "Cerca lo stemma in rete"}</button>
        <button type="button" disabled={st.busy} onClick={() => void search(`${name} stemma arcieri`)} className="aa-chip">Altre immagini</button>
        <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${name} logo`)}`} target="_blank" rel="noreferrer" className="aa-chip">Google Immagini</a>
      </div>
      {st.text ? <p className="text-xs text-muted" aria-live="polite">{st.text}</p> : null}
      {st.items.length ? (
        <div className="grid grid-cols-3 gap-1.5">
          {st.items.map((hit) => (
            <button key={hit.img} type="button" disabled={Boolean(taking)} onClick={() => void take(hit)} aria-label="Usa questa immagine" className={`grid aspect-square place-items-center overflow-hidden rounded-xl bg-white p-1 ${taking === hit.img ? "opacity-50" : ""}`}>
              <img src={hit.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
            </button>
          ))}
        </div>
      ) : null}
      {st.items.length ? <p className="text-[0.68rem] text-muted">Ricerca: «{q}». Gli stemmi sono delle compagnie: usali solo per riconoscerle nell'app.</p> : null}
    </div>
  );
}

function shrink(file: File) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 320 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas non disponibile"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // png per tenere la trasparenza dello stemma, jpeg se diventa troppo pesante
      const png = canvas.toDataURL("image/png");
      resolve(png.length < 170_000 ? png : canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(new Error("Immagine non letta"));
    img.src = URL.createObjectURL(file);
  });
}

/* ---------------- primo accesso: scelta della compagnia ---------------- */

type Welcome = Awaited<ReturnType<typeof companyWelcome>>;

/**
 * Al primo accesso chiede in quale compagnia entrare: quella di Fabriano, un'altra già
 * esistente o una nuova da fondare. Compare una volta sola; poi si cambia da Compagnia.
 */
export function CompanyWelcome() {
  const [w, setW] = useState<Welcome | null>(null);
  const [mode, setMode] = useState<"scegli" | "fonda">("scegli");
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [find, setFind] = useState("");
  // appena entrato: il collegamento al nome FITAST fra gli arcieri della compagnia
  const [linkFor, setLinkFor] = useState<{ team: string; name: string } | null>(null);
  // arrivano loghi veri: si rilegge l'elenco (solo se la scelta è ancora aperta)
  const open = useRef(false);
  open.current = Boolean(w && !w.chosen);
  useLogoSearch(() => {
    if (open.current) void companyWelcome().then((again) => open.current && !again.chosen && setW(again)).catch(() => undefined);
  });
  useEffect(() => {
    let off = false;
    try {
      if (sessionStorage.getItem("aa-company-ok") === "1") return;
    } catch {
      /* niente memoria di sessione */
    }
    companyWelcome()
      .then((res) => {
        if (off) return;
        if (res.chosen) {
          try {
            sessionStorage.setItem("aa-company-ok", "1");
          } catch {
            /* niente */
          }
        } else {
          setW(res);
          // le compagnie del portale FITAST: se l'elenco è da preparare o da rinfrescare, arrivano subito dopo
          syncFitastCompanies({ data: {} })
            .then((sync) => ((sync.added > 0 || (sync.fixed ?? 0) > 0 || (sync.removed ?? 0) > 0) && !off ? companyWelcome().then((again) => !off && !again.chosen && setW(again)) : undefined))
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, []);
  if (!w || w.chosen || typeof document === "undefined") return null;
  const done = () => {
    try {
      sessionStorage.setItem("aa-company-ok", "1");
    } catch {
      /* niente */
    }
    setW(null);
  };
  if (linkFor) return <JoinLinkSheet team={linkFor.team} companyName={linkFor.name} onClose={() => { setLinkFor(null); done(); }} />;
  async function join(id: number) {
    setBusy(id);
    setErr("");
    try {
      await joinCompany({ data: { id } });
      const c = w?.companies.find((x) => x.id === id);
      if (c) setLinkFor({ team: c.fitastTeam || c.fitastName || c.name, name: c.name });
      else done();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Non riuscito");
    } finally {
      setBusy(null);
    }
  }
  const home = w.companies.find((c) => c.id === w.homeId) ?? w.companies[0];
  const needle = find.trim().toLowerCase();
  const allOthers = w.companies.filter((c) => c.id !== home?.id);
  const others = needle ? allOthers.filter((c) => `${c.name} ${c.city}`.toLowerCase().includes(needle)) : allOthers;
  return createPortal(
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#07100b]/92 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Scegli la tua compagnia">
      <div className="mx-auto grid max-w-md gap-4 px-4 pb-10 pt-[calc(env(safe-area-inset-top)+2rem)]">
        <div className="text-center">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-white/60">Benvenuto</p>
          <h2 className="font-display text-3xl text-white">Scegli la tua compagnia</h2>
          <p className="mt-1 text-sm text-white/70">Ti alleni con loro, compari nelle loro classifiche e la tua compagnia sfida le altre. Potrai cambiarla quando vuoi.</p>
        </div>
        {mode === "scegli" ? (
          <>
            {home ? (
              <button type="button" disabled={busy != null} onClick={() => void join(home.id)} className="aa-company aa-press relative overflow-hidden rounded-[var(--radius-card)] border border-white/15 text-left shadow-card" style={{ ["--co" as string]: home.color }}>
                <div className="aa-company-bg" aria-hidden />
                <div className="relative flex items-center gap-4 p-4">
                  <span className="aa-company-crest relative grid h-28 w-24 shrink-0 place-items-center">
                    {home.logoUrl ? <img src={home.logoUrl} alt="" className="h-full w-full object-contain" /> : <DefaultCrest color={home.color} letter={home.name.replace(/^Compagnia (degli |dei |di )?/i, "").slice(0, 1)} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-2xl leading-tight text-white">{home.name}</span>
                    <span className="mt-1 block text-xs text-white/75">{[home.city, `${home.members} arcieri`].filter(Boolean).join(" · ")}</span>
                    <span className="mt-3 inline-flex min-h-10 items-center rounded-full bg-white px-4 text-sm font-bold text-[#0b120e]">{busy === home.id ? "Entro…" : "Entra"}</span>
                  </span>
                </div>
              </button>
            ) : null}
            {allOthers.length ? (
              <div className="grid gap-2">
                <p className="px-1 text-xs font-semibold uppercase tracking-wider text-white/55">Altre compagnie{allOthers.length > 6 ? ` · ${allOthers.length}` : ""}</p>
                {allOthers.length > 6 ? (
                  <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Cerca per nome o città" aria-label="Cerca una compagnia" className="min-h-11 rounded-2xl border border-white/15 bg-white/[0.06] px-3 text-sm text-white placeholder:text-white/45" />
                ) : null}
                {!others.length ? <p className="px-1 text-sm text-white/60">Nessuna compagnia con «{find.trim()}».</p> : null}
                <HPages as="div" items={others} per={6} keyOf={(c) => String(c.id)} render={(c) => (
                  <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5">
                    <span className="h-12 w-11 shrink-0">{c.logoUrl ? <img src={c.logoUrl} alt="" className="h-full w-full object-contain" /> : <DefaultCrest color={c.color} letter={c.name.replace(/^Compagnia (degli |dei |di )?/i, "").slice(0, 1)} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-white">{c.name}</span>
                      <span className="block truncate text-xs text-white/60">{[c.city, c.fitastArchers ? `${c.fitastArchers} arcieri FITAST` : "", c.members ? `${c.members} nell'app` : ""].filter(Boolean).join(" · ") || "nessun arciere in classifica"}</span>
                    </span>
                    <button type="button" disabled={busy != null} onClick={() => void join(c.id)} className="aa-press min-h-9 shrink-0 rounded-full border border-white/25 px-3 text-xs font-semibold text-white">{busy === c.id ? "Entro…" : "Entra"}</button>
                  </div>
                )} />
              </div>
            ) : null}
            <button type="button" onClick={() => setMode("fonda")} className="aa-press min-h-12 rounded-2xl border border-dashed border-white/30 text-sm font-semibold text-white">Fonda una nuova compagnia</button>
            {err ? <p className="text-center text-sm text-red-300">{err}</p> : null}
          </>
        ) : (
          <CompanyForm onCancel={() => setMode("scegli")} onDone={done} />
        )}
      </div>
    </div>,
    document.body,
  );
}
