import { CompanyTrophies } from "./palmares";
import { refreshCrests } from "@/lib/arcieri/crest";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import type { listCompanies } from "@/lib/arcieri/compagnie.api";
import { companyWelcome, createCompany, joinCompany, updateCompany } from "@/lib/arcieri/compagnie.api";
import { Avatar, Button, Card, ErrorNote, Field, Segmented, TextInput } from "./kit";
import { RankBars } from "./rank-bars";

type Board = Awaited<ReturnType<typeof listCompanies>>;
type Co = Board["companies"][number];

/* ---------------- icone dei contatti (disegni generici, non i marchi) ---------------- */

type ContactKind = "phone" | "whatsapp" | "email" | "website" | "instagram" | "facebook" | "youtube" | "tiktok" | "address" | "board";

function ContactIcon({ kind }: { kind: ContactKind }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      {kind === "phone" ? <path {...p} d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" /> : null}
      {kind === "whatsapp" ? (
        <>
          <path {...p} d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.5 18.6Z" />
          <path {...p} d="M9.3 9.2c.2 2.3 2.8 4.9 5.2 5.3l1-1.3-1.8-.9-.8.8c-1-.4-2-1.4-2.4-2.4l.8-.8-.9-1.8Z" strokeWidth={1.4} />
        </>
      ) : null}
      {kind === "email" ? (
        <>
          <rect {...p} x="3.5" y="5.5" width="17" height="13" rx="2.5" />
          <path {...p} d="m4.5 7 7.5 6 7.5-6" />
        </>
      ) : null}
      {kind === "website" ? (
        <>
          <circle {...p} cx="12" cy="12" r="8.5" />
          <path {...p} d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17" />
        </>
      ) : null}
      {kind === "instagram" ? (
        <>
          <rect {...p} x="4" y="4" width="16" height="16" rx="4.5" />
          <circle {...p} cx="12" cy="12" r="3.6" />
          <circle cx="16.7" cy="7.3" r="1.1" fill="currentColor" />
        </>
      ) : null}
      {kind === "facebook" ? (
        <>
          <rect {...p} x="4" y="4" width="16" height="16" rx="4" />
          <path {...p} d="M14.6 8.2h-1.4a1.9 1.9 0 0 0-1.9 1.9V20M9.6 12.6h4.6" />
        </>
      ) : null}
      {kind === "youtube" ? (
        <>
          <rect {...p} x="3" y="6" width="18" height="12" rx="4" />
          <path d="M10.4 9.4v5.2l4.4-2.6Z" fill="currentColor" />
        </>
      ) : null}
      {kind === "tiktok" ? <path {...p} d="M13.5 4v10.6a3.3 3.3 0 1 1-3.3-3.3M13.5 4c.4 2.4 2 3.9 4.6 4.1" /> : null}
      {kind === "address" ? (
        <>
          <path {...p} d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
          <circle {...p} cx="12" cy="10" r="2.4" />
        </>
      ) : null}
      {kind === "board" ? (
        <>
          <path {...p} d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4.5 3.5v-3.5h0a1 1 0 0 1-1-1Z" />
          <path {...p} d="M8.5 9h7M8.5 12h4.5" />
        </>
      ) : null}
    </svg>
  );
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

function ContactButton({ kind, href, tint }: { kind: ContactKind; href: string; tint: string }) {
  const inner = (
    <>
      <span className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,.7)]" style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${tint} 85%, white 15%), color-mix(in srgb, ${tint} 70%, black 30%))` }}>
        <ContactIcon kind={kind} />
      </span>
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
  const kinds = ["phone", "whatsapp", "email", "website", "instagram", "facebook", "youtube", "tiktok", "address"] as const;
  const links = kinds.map((kind) => ({ kind, href: hrefOf(kind, co[kind]) })).filter((item) => item.href);
  return (
    <section className="aa-company relative overflow-hidden rounded-[var(--radius-card)] border border-hair shadow-card" style={{ ["--co" as string]: co.color }}>
      <div className="aa-company-bg" aria-hidden />
      <div className="relative grid gap-4 p-4">
        <div className="flex items-center gap-4">
          <div className="aa-company-crest relative grid h-28 w-24 shrink-0 place-items-center">
            {co.logoUrl ? <img src={co.logoUrl} alt={`Stemma di ${co.name}`} className="h-full w-full object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,.45)]" /> : <DefaultCrest color={co.color} letter={co.name.replace(/^Compagnia (degli |dei |di )?/i, "").slice(0, 1)} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/70">{co.city ? `Compagnia · ${co.city}` : "Compagnia"}</p>
            <h2 className="font-display text-[1.6rem] leading-[1.05] text-white">{co.name}</h2>
            {co.motto ? <p className="mt-1 font-display text-base italic text-white/85">«{co.motto}»</p> : null}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            ["Arcieri", co.members.toLocaleString("it-IT")],
            ["Frecce", co.arrows.toLocaleString("it-IT")],
            ["Punti", co.points.toLocaleString("it-IT")],
            ["Gare", co.gare.toLocaleString("it-IT")],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-black/25 px-1 py-2 text-center backdrop-blur-sm">
              <p className="font-display text-lg leading-none text-white tabular-nums">{v}</p>
              <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-wider text-white/65">{k}</p>
            </div>
          ))}
        </div>
        {co.bio ? <p className="text-sm text-white/85">{co.bio}</p> : null}
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {links.map((item) => <ContactButton key={item.kind} kind={item.kind} href={item.href} tint={CONTACT_TINT[item.kind]} />)}
          <ContactButton kind="board" href="" tint={CONTACT_TINT.board} />
        </div>
        {co.address || co.email ? (
          <div className="grid gap-0.5 text-xs text-white/85">
            {co.address ? <a className="truncate underline-offset-2 hover:underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(co.address)}`} target="_blank" rel="noreferrer">Campo: {co.address}</a> : null}
            {co.email ? <a className="truncate underline-offset-2 hover:underline" href={`mailto:${co.email}`}>{co.email}</a> : null}
          </div>
        ) : null}
        {links.length === 0 ? <p className="text-xs text-white/70">{canEdit ? "Aggiungi telefono, WhatsApp e social: compariranno qui per tutti." : "Telefono e social non sono ancora stati inseriti."}</p> : null}
        {canEdit ? <button type="button" onClick={onEdit} className="aa-press justify-self-start rounded-full bg-white/15 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur">Modifica la compagnia</button> : null}
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

type Metric = "points" | "arrows" | "members" | "gare" | "avg";

export function CompanyLeague({ board, onJoin, busy }: { board: Board; onJoin: (id: number) => void; busy: number | null }) {
  const [metric, setMetric] = useState<Metric>("points");
  const [open, setOpen] = useState<number | null>(null);
  const unit: Record<Metric, string> = { points: "pt", arrows: "frecce", members: "arcieri", gare: "gare", avg: "" };
  const rows = board.companies.map((co) => {
    const value = metric === "avg" ? co.avg ?? 0 : co[metric];
    return {
      id: String(co.id),
      name: co.name,
      value,
      label: metric === "avg" ? (co.avg == null ? "—" : co.avg.toFixed(2).replace(".", ",")) : undefined,
      sub: [co.city, `${co.members} arcieri`].filter(Boolean).join(" · "),
      color: co.color,
      logo: co.logoUrl,
      badge: co.logoUrl ? undefined : <DefaultCrest color={co.color} letter={co.name.replace(/^Compagnia (degli |dei |di )?/i, "").slice(0, 1)} />,
      me: co.id === board.mine,
    };
  });
  return (
    <div className="grid gap-4">
      <Card className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div>
          <h2 className="font-display text-2xl">Classifica compagnie</h2>
          <p className="text-sm text-muted">Tutte le frecce e i punti dei loro arcieri, in allenamento e in gara.</p>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
        <Segmented<Metric>
          value={metric}
          onChange={setMetric}
          options={[
            { id: "points", label: "Punti" },
            { id: "arrows", label: "Frecce" },
            { id: "members", label: "Iscritti" },
            { id: "gare", label: "Gare" },
            { id: "avg", label: "Media" },
          ]}
        />
        </div>
        <RankBars rows={rows} unit={unit[metric]} limit={12} empty="Ancora nessun dato per questa classifica." />
      </Card>
      <Card className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <h2 className="font-display text-2xl">Tutte le compagnie</h2>
        {board.isAdmin ? <p className="text-xs text-muted">Sei il fondatore: tocca una compagnia per vedere contatti e iscritti.</p> : <p className="text-xs text-muted">Tocca una compagnia per vedere i contatti.</p>}
        {board.companies.map((co) => {
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
                    <span className="block truncate text-xs text-muted">{[co.city, `${co.members} arcieri`, `${co.arrows.toLocaleString("it-IT")} frecce`].filter(Boolean).join(" · ")}</span>
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
                    {[["Arcieri", co.members], ["Frecce", co.arrows], ["Punti", co.points], ["Gare", co.gare]].map(([k, v]) => (
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
                          <Avatar size="sm" label={[m.givenName, m.familyName].filter(Boolean).join(" ") || m.nickname} color={m.avatarColor} photo={m.photoUrl} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{m.nickname || [m.givenName, m.familyName].filter(Boolean).join(" ")}</span>
                          {m.owner ? <span className="rounded-full bg-[#d9b45a]/20 px-2 py-0.5 text-[0.62rem] font-semibold text-[#e8c870]">Fondatore</span> : null}
                          <span className="text-xs tabular-nums text-muted">{m.arrows} frecce</span>
                        </Link>
                      ))}
                    </div>
                  ) : co.members > 0 && co.id !== board.mine ? <p className="text-xs text-muted">Gli iscritti li vedono il presidente e il fondatore.</p> : null}
                  <CompanyTrophies companyId={co.id} companyName={co.name} />
                </div>
              ) : null}
            </div>
          );
        })}
      </Card>
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

export function CompanyForm({ co, onDone, onCancel }: { co?: Co; onDone: () => void; onCancel: () => void }) {
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
        } else setW(res);
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
  async function join(id: number) {
    setBusy(id);
    setErr("");
    try {
      await joinCompany({ data: { id } });
      done();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Non riuscito");
    } finally {
      setBusy(null);
    }
  }
  const home = w.companies.find((c) => c.id === w.homeId) ?? w.companies[0];
  const others = w.companies.filter((c) => c.id !== home?.id);
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
            {others.length ? (
              <div className="grid gap-2">
                <p className="px-1 text-xs font-semibold uppercase tracking-wider text-white/55">Altre compagnie</p>
                {others.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5">
                    <span className="h-12 w-11 shrink-0">{c.logoUrl ? <img src={c.logoUrl} alt="" className="h-full w-full object-contain" /> : <DefaultCrest color={c.color} letter={c.name.replace(/^Compagnia (degli |dei |di )?/i, "").slice(0, 1)} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-white">{c.name}</span>
                      <span className="block truncate text-xs text-white/60">{[c.city, `${c.members} arcieri`].filter(Boolean).join(" · ")}</span>
                    </span>
                    <button type="button" disabled={busy != null} onClick={() => void join(c.id)} className="aa-press min-h-9 shrink-0 rounded-full border border-white/25 px-3 text-xs font-semibold text-white">{busy === c.id ? "Entro…" : "Entra"}</button>
                  </div>
                ))}
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
