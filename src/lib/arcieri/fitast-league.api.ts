/**
 * Compagnie e classifiche FITAST per tutti: l'elenco delle compagnie del portale diventa l'elenco da cui
 * scegliere all'ingresso (stemma disegnato, città e contatti), e le classifiche lette dal portale
 * (generale compagnie e arcieri del campionato, primi arcieri e squadre di ogni gara) restano salvate.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { asNum, clip, db, ensureMember, staffLevel } from "./access";
import { readFitastPage } from "./fitast.api";
import { COMPAGNIE_URL, crestOf, parseCompanies, teamKey, titleName, type PortalCompany, type RankRow } from "./fitast-league";
import { imageInfo, logoCandidates, siteFromEmail, usableLogo } from "./company-logo";

const DAY = 86_400_000;
export const STANDING_KINDS = ["generale-squadre", "generale-arcieri", "gara-arcieri", "gara-squadre"] as const;
export type StandingKind = (typeof STANDING_KINDS)[number];

function slugOf(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "compagnia"
  );
}

async function freeSlug(sql: Sql, name: string) {
  const base = slugOf(name);
  let slug = base;
  for (let i = 2; i < 60; i += 1) {
    const clash = await sql<{ id: number }>`select id from companies where slug = ${slug} limit 1`;
    if (!clash[0]) break;
    slug = `${base}-${i}`;
  }
  return slug;
}

/**
 * Prepara le compagnie dell'elenco FITAST (tranne Fabriano, che c'è già): una volta alla settimana, da chiunque
 * apra la scelta della compagnia; lo staff può forzarla. Le compagnie già nell'app si collegano per nome.
 */
export const syncFitastCompanies = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ force: Boolean((input as { force?: unknown } | null)?.force) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const last = await sql<{ at: string; info: { total?: number; ok?: boolean } }>`select at, info from fitast_sync where key = 'compagnie' limit 1`;
    const age = last[0] ? Date.now() - new Date(last[0].at).getTime() : Infinity;
    const ok = Boolean(last[0]?.info?.ok);
    // riuscita: si rilegge dopo una settimana; non riuscita: dopo un'ora
    if (!(data.force && staffLevel(me)) && age < (ok ? 7 * DAY : DAY / 24)) return { added: 0, linked: 0, total: asNum(last[0]?.info?.total), skipped: true, diag: [] as string[] };
    await sql`insert into fitast_sync (key, at, info) values ('compagnie', now(), '{"ok":false}'::jsonb) on conflict (key) do update set at = now()`;
    let list: ReturnType<typeof parseCompanies> = [];
    let diag: string[] = [];
    try {
      const page = await readFitastPage(COMPAGNIE_URL);
      list = parseCompanies(page);
      diag = page.diag ?? [];
    } catch (e) {
      diag = [e instanceof Error ? e.message : "Portale FITAST non raggiungibile."];
    }
    const existing = await sql<{ id: number; name: string; fitast_name: string; slug: string }>`select id, name, fitast_name, slug from companies`;
    const byKey = new Map<string, number>();
    for (const c of existing) {
      for (const k of [teamKey(c.fitast_name), teamKey(c.name)]) if (k && !byKey.has(k)) byKey.set(k, asNum(c.id));
    }
    let added = 0;
    let linked = 0;
    for (const c of list) {
      const key = teamKey(c.name);
      // Fabriano c'è già: si collega soltanto
      const found = byKey.get(key) ?? (/\bFABRIANO\b/.test(key) ? existing.find((x) => x.slug === "fabriano")?.id : undefined);
      if (found != null) {
        await sql`update companies set fitast_name = case when fitast_name = '' then ${c.name} else fitast_name end, fitast_code = case when fitast_code = '' then ${clip(c.code, 20)} else fitast_code end where id = ${asNum(found)}`;
        linked++;
        continue;
      }
      const name = clip(titleName(c.name), 70);
      if (name.length < 3) continue;
      const crest = crestOf(c.name);
      const city = clip(titleName(c.city || c.province), 50);
      const bio = clip(
        [`Compagnia iscritta alla FITAST${c.region ? ` (${titleName(c.region)})` : ""}.`, c.president ? `Presidente: ${titleName(c.president)}.` : "", c.code ? `Codice FITAST ${c.code}.` : ""].filter(Boolean).join(" "),
        500,
      );
      const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) ? c.email.toLowerCase().slice(0, 120) : "";
      const phone = c.phone.replace(/[^\d+]/g, "").slice(0, 20);
      const website = c.website ? clip(/^https?:\/\//i.test(c.website) ? c.website.replace(/^http:/i, "https:") : `https://${c.website.replace(/^\/+/, "")}`, 160) : "";
      const slug = await freeSlug(sql, name);
      const made = await sql<{ id: number }>`
        insert into companies (slug, name, city, bio, logo_url, color, phone, email, website, address, source, fitast_name, fitast_code)
        values (${slug}, ${name}, ${city}, ${bio}, ${crest.logo}, ${crest.color}, ${phone}, ${email}, ${website}, ${clip(c.address, 160)}, 'fitast', ${c.name}, ${clip(c.code, 20)})
        on conflict (slug) do nothing
        returning id`;
      if (made[0]) {
        byKey.set(key, asNum(made[0].id));
        added++;
      }
    }
    const good = list.length >= 3;
    await sql`update fitast_sync set info = ${JSON.stringify({ ok: good, total: list.length, added, linked })}::jsonb where key = 'compagnie'`;
    return { added, linked, total: list.length, skipped: false, diag: good ? [] : diag };
  });

/* ---------- loghi veri delle compagnie ---------- */

const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 ArcieriAmiconi/1.0";
const MAX_IMG = 900_000;

/** legge un indirizzo con un limite di tempo e di dimensione (null se non risponde o è troppo grande) */
async function grab(url: string, ms: number, max: number) {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(ms), headers: { "user-agent": UA, accept: "text/html,image/*;q=0.9,*/*;q=0.5", "accept-language": "it-IT,it;q=0.9" } });
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") || 0);
    if (len > max) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > max) return null;
    return { url: res.url || url, type: res.headers.get("content-type") ?? "", body: buf };
  } catch {
    return null;
  }
}

/** un'immagine che può fare da stemma: formato riconosciuto, non minuscola, non una striscia */
async function logoImage(url: string) {
  const r = await grab(url, 6000, MAX_IMG);
  if (!r) return null;
  const info = imageInfo(r.body);
  if (!usableLogo(info) || !info) return null;
  return { mime: info.mime, data: Buffer.from(r.body).toString("base64"), source: r.url };
}

type LogoHint = { logo?: string; detail?: string };

function hintOf(raw: string): LogoHint {
  try {
    const v = JSON.parse(raw || "{}") as LogoHint;
    return typeof v === "object" && v ? v : {};
  } catch {
    return {};
  }
}

/** parole che non distinguono una compagnia dall'altra (non bastano a riconoscere il suo sito) */
const COMMON_WORDS = new Set(["ARCIERI", "ARCIERE", "ARCO", "ARCHI", "TIRO", "COMPAGNIA", "STORICI", "STORICO", "STORICA", "TRADIZIONALE", "TRADIZIONALI", "ASD", "SSD", "APS", "ASSOCIAZIONE", "SPORTIVA", "DILETTANTISTICA", "GRUPPO", "CITTA", "CASTELLO", "BORGO", "SAN", "SANTA", "SANTO", "TORRE", "ROCCA", "MONTE", "NUOVA", "NUOVO", "ITALIA", "MEDIEVALE", "MEDIEVALI", "BALESTRIERI"]);

/** le parole che riconoscono una compagnia (Grottazzolina, Palumbi, Sagittas…) */
function distinctiveWords(name: string) {
  return teamKey(name)
    .split(" ")
    .filter((w) => w.length >= 5 && !COMMON_WORDS.has(w))
    .map((w) => w.toLowerCase());
}

const NOT_CLUB_SITE = /duckduckgo|wikipedia|wikimedia|fitarco|fitast|comune\.|regione\.|provincia\.|youtube|instagram|twitter|x\.com|tiktok|linkedin|tripadvisor|paginegialle|paginebianche|virgilio|google\.|bing\.|yahoo|amazon|ebay|subito\.it|ilrestodelcarlino|cronache|corriere|repubblica|ansa\.it|today\.it|news|giornale|quotidiano|gazzetta|eventi|turismo|booking|maps\./i;

/**
 * Cerca in rete il sito o la pagina Facebook della compagnia (ricerca web senza chiavi): si accetta
 * solo un indirizzo che contiene una parola che la distingue, così non si prende il logo di qualcun altro.
 */
async function searchClubPages(name: string, city: string, until: number) {
  const words = distinctiveWords(name);
  if (!words.length || Date.now() > until - 6000) return { site: "", facebook: "" };
  const q = `${titleName(name)} ${city} tiro con l'arco`.replace(/\s+/g, " ").trim();
  const r = await grab(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, 6000, 1_500_000);
  if (!r) return { site: "", facebook: "" };
  const html = new TextDecoder().decode(r.body);
  const links: string[] = [];
  for (const m of html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"/g)) {
    let href = m[1].replace(/&amp;/g, "&");
    const uddg = /[?&]uddg=([^&]+)/.exec(href)?.[1];
    if (uddg) href = decodeURIComponent(uddg);
    if (/^\/\//.test(href)) href = `https:${href}`;
    if (/^https?:\/\//i.test(href)) links.push(href);
  }
  const fits = (u: string) => {
    const low = decodeURIComponent(u).toLowerCase().replace(/[^a-z0-9/.]+/g, "");
    return words.some((w) => low.includes(w));
  };
  const facebook = links.find((u) => /facebook\.com\/(?!sharer|share|events|groups\/?$)/i.test(u) && fits(u)) ?? "";
  const parts = (u: string) => {
    try {
      const x = new URL(u);
      return { host: x.hostname, path: x.pathname, origin: x.origin };
    } catch {
      return null;
    }
  };
  const site = links.find((u) => {
    const p = parts(u);
    return Boolean(p) && !/facebook\.com|fb\.com/i.test(u) && !NOT_CLUB_SITE.test(p!.host) && fits(p!.host + p!.path);
  });
  return { site: site ? parts(site)?.origin ?? "" : "", facebook };
}

/** l'immagine del profilo di una pagina Facebook pubblica (lo stemma, per quasi tutte le compagnie) */
function facebookPicture(url: string) {
  const m = /facebook\.com\/(?:pg\/)?(?:profile\.php\?id=(\d+)|([A-Za-z0-9.\-]{3,80}))/i.exec(url);
  const id = m?.[1] ?? m?.[2] ?? "";
  if (!id || /^(people|pages|watch|login|home\.php)$/i.test(id)) return "";
  return `https://graph.facebook.com/${encodeURIComponent(id)}/picture?type=large&width=400&height=400`;
}

/** cerca il logo: immagine del portale, pagina della compagnia sul portale, sito, dominio dell'e-mail, poi in rete */
async function logoFor(c: { name: string; city: string; website: string; email: string; facebook: string; logo_hint: string }, until: number) {
  const hint = hintOf(c.logo_hint);
  if (hint.logo) {
    const img = await logoImage(hint.logo);
    if (img) return img;
  }
  const fromPages = await logoFromPages([hint.detail ?? "", c.website, siteFromEmail(c.email)], until);
  if (fromPages) return fromPages;
  // la pagina Facebook già scritta nella compagnia
  const fbKnown = c.facebook ? facebookPicture(/^https?:/i.test(c.facebook) ? c.facebook : `https://www.facebook.com/${c.facebook.replace(/^@/, "")}`) : "";
  if (fbKnown && Date.now() < until) {
    const img = await logoImage(fbKnown);
    if (img) return img;
  }
  // ricerca in rete: il sito della compagnia o la sua pagina Facebook
  const found = await searchClubPages(c.name, c.city, until);
  if (found.site) {
    const img = await logoFromPages([found.site], until);
    if (img) return { ...img, website: found.site };
  }
  if (found.facebook && Date.now() < until) {
    const pic = facebookPicture(found.facebook);
    const img = pic ? await logoImage(pic) : null;
    if (img) return { ...img, facebook: found.facebook };
  }
  return null;
}

async function logoFromPages(list: string[], until: number): Promise<Awaited<ReturnType<typeof logoImage>>> {
  const pages = list.filter((u, i, all) => /^https?:\/\//i.test(u) && all.indexOf(u) === i);
  for (const page of pages) {
    if (Date.now() > until) break;
    const r = await grab(page, 6000, 2_000_000);
    if (!r || !/html|text/i.test(r.type || "text/html")) continue;
    const html = new TextDecoder().decode(r.body);
    for (const cand of logoCandidates(html, r.url).slice(0, 4)) {
      if (Date.now() > until) break;
      const img = await logoImage(cand.url);
      if (img) return img;
    }
  }
  return null;
}

/** indizi dal portale (stemmi e pagine delle compagnie), al massimo una volta alla settimana */
async function refreshLogoHints(sql: Sql) {
  const last = await sql<{ at: string }>`select at from fitast_sync where key = 'compagnie-loghi' limit 1`;
  if (last[0] && Date.now() - new Date(last[0].at).getTime() < 7 * DAY) return;
  await sql`insert into fitast_sync (key, at, info) values ('compagnie-loghi', now(), '{}'::jsonb) on conflict (key) do update set at = now()`;
  let list: PortalCompany[] = [];
  try {
    list = parseCompanies(await readFitastPage(COMPAGNIE_URL));
  } catch {
    return;
  }
  const rows = await sql<{ id: number; name: string; fitast_name: string }>`select id, name, fitast_name from companies`;
  const byKey = new Map<string, number>();
  for (const r of rows) for (const k of [teamKey(r.fitast_name), teamKey(r.name)]) if (k && !byKey.has(k)) byKey.set(k, asNum(r.id));
  let hints = 0;
  for (const c of list) {
    const id = byKey.get(teamKey(c.name));
    if (id == null) continue;
    const website = c.website ? clip(/^https?:\/\//i.test(c.website) ? c.website : `https://${c.website.replace(/^\/+/, "")}`, 160) : "";
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) ? c.email.toLowerCase().slice(0, 120) : "";
    const hint = c.logo || c.detail ? JSON.stringify({ logo: c.logo || undefined, detail: c.detail || undefined }) : "";
    await sql`
      update companies set
        logo_hint = case when ${hint} <> '' then ${hint} else logo_hint end,
        website = case when website = '' then ${website} else website end,
        email = case when email = '' then ${email} else email end
      where id = ${id}`;
    if (hint) hints++;
  }
  await sql`update fitast_sync set info = ${JSON.stringify({ total: list.length, hints })}::jsonb where key = 'compagnie-loghi'`;
}

/**
 * Loghi veri al posto degli stemmi disegnati: poche compagnie per volta (la pagina richiama finché ne
 * restano), ognuna ricontrollata al massimo una volta al mese. Il logo trovato si serve da /api/logo/<id>.
 */
export const findCompanyLogos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const t0 = Date.now();
    await refreshLogoHints(sql);
    const until = t0 + 18_000;
    // nuova ricerca (anche in rete): le compagnie già guardate senza trovare nulla si riguardano una volta
    const v2 = await sql<{ key: string }>`select key from fitast_sync where key = 'loghi-rete-v2' limit 1`;
    if (!v2[0]) {
      await sql`insert into fitast_sync (key, at, info) values ('loghi-rete-v2', now(), '{}'::jsonb) on conflict (key) do nothing`;
      await sql`update companies set logo_checked_at = null where source = 'fitast' and (logo_url is null or logo_url = '' or logo_url like 'data:image/svg+xml%')`;
    }
    const todo = await sql<{ id: number; name: string; fitast_name: string; city: string; website: string; email: string; facebook: string; logo_hint: string }>`
      select id, name, fitast_name, city, website, email, facebook, logo_hint from companies
      where source = 'fitast' and (logo_url is null or logo_url = '' or logo_url like 'data:image/svg+xml%')
        and (logo_checked_at is null or logo_checked_at < now() - interval '30 days')
      order by (website <> '' or logo_hint <> '') desc, id
      limit 6`;
    let checked = 0;
    let found = 0;
    for (const c of todo) {
      if (Date.now() > until - 4000) break;
      await sql`update companies set logo_checked_at = now() where id = ${asNum(c.id)}`;
      checked++;
      const img = await logoFor({ ...c, name: c.fitast_name || c.name }, until);
      if (!img) continue;
      // il sito o la pagina trovati in rete restano nei contatti della compagnia (se non c'erano)
      const site = "website" in img && typeof img.website === "string" ? clip(img.website, 160) : "";
      const fb = "facebook" in img && typeof img.facebook === "string" ? clip(img.facebook, 160) : "";
      if (site || fb) await sql`update companies set website = case when website = '' then ${site} else website end, facebook = case when facebook = '' then ${fb} else facebook end where id = ${asNum(c.id)}`;
      await sql`
        insert into company_logos (company_id, mime, data, source, found_at)
        values (${asNum(c.id)}, ${img.mime}, ${img.data}, ${clip(img.source, 400)}, now())
        on conflict (company_id) do update set mime = excluded.mime, data = excluded.data, source = excluded.source, found_at = now()`;
      await sql`update companies set logo_url = ${`/api/logo/${asNum(c.id)}?v=${Date.now().toString(36)}`} where id = ${asNum(c.id)}`;
      found++;
    }
    const left = await sql<{ n: number }>`
      select count(*)::int as n from companies
      where source = 'fitast' and (logo_url is null or logo_url = '' or logo_url like 'data:image/svg+xml%')
        and (logo_checked_at is null or logo_checked_at < now() - interval '30 days')`;
    return { checked, found, remaining: asNum(left[0]?.n) };
  });

export type StandingRow = RankRow;
export type Standing = { kind: StandingKind; season: string; seasonName: string; garaId: string; garaTitle: string; day: string; category: string; rows: StandingRow[]; updatedAt: string };

/** le classifiche FITAST salvate del campionato più recente */
export const fitastStandings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const latest = await sql<{ season: string; season_name: string }>`select season, season_name from fitast_standings order by updated_at desc limit 1`;
    if (!latest[0]) return { season: "", seasonName: "", updatedAt: "", items: [] as Standing[] };
    const rows = await sql<{ kind: string; season: string; season_name: string; gara_id: string; gara_title: string; held_on: string | null; category: string; rows: StandingRow[]; updated_at: string }>`
      select kind, season, season_name, gara_id, gara_title, held_on::text as held_on, category, rows, updated_at
      from fitast_standings where season = ${latest[0].season}
      order by held_on desc nulls first, kind, category`;
    const items: Standing[] = rows.map((r) => ({
      kind: r.kind as StandingKind,
      season: r.season,
      seasonName: r.season_name,
      garaId: r.gara_id,
      garaTitle: r.gara_title,
      day: r.held_on ?? "",
      category: r.category,
      rows: Array.isArray(r.rows) ? (r.kind === "generale-arcieri" ? r.rows.slice(0, 10) : r.rows) : [],
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
    const updatedAt = items.reduce((m, x) => (x.updatedAt > m ? x.updatedAt : m), "");
    return { season: latest[0].season, seasonName: latest[0].season_name, updatedAt, items };
  });

const optNum = (v: unknown, max: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
};

/** salva per tutti le classifiche lette dal portale (dati pubblici del campionato) */
export const saveFitastStandings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { items?: unknown };
    const list = Array.isArray(raw.items) ? raw.items.slice(0, 80) : [];
    return {
      items: list
        .map((item) => {
          const r = (item ?? {}) as Record<string, unknown>;
          const day = String(r.day ?? "").slice(0, 10);
          // la generale arcieri si tiene intera (serve la media di tutti gli arcieri di ogni compagnia); le altre i primi
          const keep = String(r.kind ?? "") === "generale-arcieri" ? 600 : 40;
          const rows = (Array.isArray(r.rows) ? r.rows.slice(0, keep) : []).map((x) => {
            const o = (x ?? {}) as Record<string, unknown>;
            const place = optNum(o.place, 9999);
            return { place: place == null ? null : Math.round(place), name: clip(o.name, 90), team: clip(o.team, 110), score: optNum(o.score, 10_000_000), camp: optNum(o.camp, 10_000_000) };
          }).filter((x) => x.name);
          return {
            kind: String(r.kind ?? "") as StandingKind,
            season: clip(r.season, 24).replace(/[^\w-]/g, ""),
            seasonName: clip(r.seasonName, 90),
            garaId: clip(r.garaId, 10).replace(/\D/g, ""),
            garaTitle: clip(r.garaTitle, 140),
            day: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
            category: clip(r.category, 90),
            rows,
          };
        })
        .filter((x) => STANDING_KINDS.includes(x.kind) && x.season && x.rows.length),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    for (const x of data.items) {
      await sql`
        insert into fitast_standings (kind, season, season_name, gara_id, gara_title, held_on, category, rows, updated_by, updated_at)
        values (${x.kind}, ${x.season}, ${x.seasonName}, ${x.garaId}, ${x.garaTitle}, ${x.day}::date, ${x.category}, ${JSON.stringify(x.rows)}::jsonb, ${context.userId}, now())
        on conflict (kind, season, gara_id, category) do update set
          season_name = excluded.season_name, gara_title = case when excluded.gara_title <> '' then excluded.gara_title else fitast_standings.gara_title end,
          held_on = coalesce(excluded.held_on, fitast_standings.held_on), rows = excluded.rows, updated_by = excluded.updated_by, updated_at = now()`;
    }
    return { saved: data.items.length };
  });

/** punti FITAST delle compagnie nel campionato più recente (classifica generale squadre), per nome */
/**
 * Media dei punti campionato per arciere di ogni compagnia: tutti i suoi arcieri nella classifica generale
 * arcieri del campionato (ognuno contato una volta, anche se compare in più categorie).
 */
export async function fitastAvgBy(sql: Sql) {
  const latest = await sql<{ season: string }>`select season from fitast_standings where kind = 'generale-arcieri' order by updated_at desc limit 1`;
  const map = new Map<string, { avg: number; archers: number }>();
  if (!latest[0]) return map;
  const rows = await sql<{ rows: StandingRow[] }>`select rows from fitast_standings where kind = 'generale-arcieri' and season = ${latest[0].season}`;
  const seen = new Map<string, Map<string, number>>();
  for (const r of rows) {
    for (const x of Array.isArray(r.rows) ? r.rows : []) {
      const team = teamKey(x.team || "");
      const pts = x.camp ?? x.score;
      if (!team || pts == null) continue;
      const who = teamKey(x.name);
      const list = seen.get(team) ?? new Map<string, number>();
      list.set(who, Math.max(list.get(who) ?? 0, pts));
      seen.set(team, list);
    }
  }
  for (const [team, list] of seen) {
    const vals = [...list.values()];
    map.set(team, { avg: vals.reduce((a, b) => a + b, 0) / vals.length, archers: vals.length });
  }
  return map;
}

export async function fitastPointsBy(sql: Sql) {
  const latest = await sql<{ season: string; season_name: string }>`select season, season_name from fitast_standings where kind = 'generale-squadre' order by updated_at desc limit 1`;
  const map = new Map<string, { points: number; place: number | null; season: string }>();
  if (!latest[0]) return map;
  const rows = await sql<{ category: string; rows: StandingRow[] }>`select category, rows from fitast_standings where kind = 'generale-squadre' and season = ${latest[0].season}`;
  for (const r of rows) {
    for (const x of Array.isArray(r.rows) ? r.rows : []) {
      const k = teamKey(x.team || x.name);
      if (!k) continue;
      const cur = map.get(k) ?? { points: 0, place: null, season: latest[0].season_name };
      cur.points += x.camp ?? x.score ?? 0;
      if (x.place != null && (cur.place == null || x.place < cur.place)) cur.place = x.place;
      map.set(k, cur);
    }
  }
  return map;
}
