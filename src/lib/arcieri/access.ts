import { getSql, type Sql } from "@/lib/db";

export type Role = "admin" | "archer" | "viewer";

export type MemberRow = {
  id: number;
  user_id: string | null;
  given_name: string;
  family_name: string;
  nickname: string;
  slug: string;
  role: Role;
  bow_type: string;
  bio: string;
  avatar_color: string;
  photo_url: string | null;
  joined_on: unknown;
  claim_code: string;
  status: string;
  sort_order: number;
  notify_board: boolean;
  notify_challenges: boolean;
  notify_goals: boolean;
  notify_comps: boolean;
  created_at: unknown;
  /** il fondatore: nessuno lo può togliere o declassare */
  is_super?: boolean;
  /** incarico nello staff oltre al ruolo: "" oppure "editor" */
  staff?: string;
  /** percorso scelto al primo accesso: "" (da scegliere), principiante, compagnia, istruttore, esistente */
  percorso?: string;
  /** gli istruttori della compagnia vedono i suoi allenamenti */
  share_coach?: boolean;
};

export type PublicMember = {
  id: number;
  userId: string | null;
  givenName: string;
  familyName: string;
  nickname: string;
  slug: string;
  role: Role;
  bowType: string;
  bio: string;
  avatarColor: string;
  photoUrl: string | null;
  joinedOn: string;
  claimCode: string | null;
  status: string;
  email: string | null;
  notifyBoard: boolean;
  notifyChallenges: boolean;
  notifyGoals: boolean;
  notifyComps: boolean;
  isSuper: boolean;
  staff: string;
  percorso: string;
  shareCoach: boolean;
  /** solo in getMe: percorso essenziale ancora attivo (meno di 5 allenamenti) */
  essenziale?: boolean;
  /** solo in getMe: può aprire il pannello istruttori */
  canCoach?: boolean;
  /** solo in getMe: può aprire la segreteria della compagnia */
  canSegreteria?: boolean;
};

export const PRIZES: Array<{ code: string; title: string; hint: string }> = [
  { code: "first_session", title: "Primo allenamento", hint: "1 allenamento" },
  { code: "sessions_5", title: "5 allenamenti", hint: "5 allenamenti" },
  { code: "sessions_10", title: "10 allenamenti", hint: "10 allenamenti" },
  { code: "sessions_50", title: "50 allenamenti", hint: "50 allenamenti" },
  { code: "sessions_100", title: "100 allenamenti", hint: "100 allenamenti" },
  { code: "arrows_100", title: "100 frecce", hint: "100 frecce" },
  { code: "arrows_500", title: "500 frecce", hint: "500 frecce" },
  { code: "arrows_1000", title: "1000 frecce", hint: "1000 frecce" },
  { code: "arrows_5000", title: "5000 frecce", hint: "5000 frecce" },
  { code: "first_comp", title: "Prima gara", hint: "1 gara segnata" },
  { code: "gare_5", title: "5 gare", hint: "5 gare segnate" },
  { code: "gare_10", title: "10 gare", hint: "10 gare segnate" },
  { code: "champ_10", title: "10 punti", hint: "10 punti campionato" },
  { code: "champ_50", title: "50 punti", hint: "50 punti campionato" },
  { code: "champ_100", title: "100 punti", hint: "100 punti campionato" },
  { code: "streak_7", title: "7 giorni di fila", hint: "7 giorni consecutivi" },
  { code: "days_30", title: "30 giorni", hint: "30 giorni diversi" },
  { code: "first_record", title: "Primo record", hint: "Migliori la media" },
  { code: "improve_5", title: "Media in salita", hint: "+5% in 30 giorni" },
];

export const BADGE_TITLES: Record<string, string> = {
  first_session: "Primo allenamento",
  sessions_5: "5 allenamenti",
  sessions_10: "Dieci allenamenti",
  sessions_50: "50 allenamenti",
  sessions_100: "100 allenamenti",
  arrows_100: "Cento frecce",
  arrows_500: "500 frecce",
  arrows_1000: "Mille frecce",
  arrows_5000: "5000 frecce",
  first_record: "Primo record",
  first_comp: "Prima gara",
  gare_5: "5 gare",
  gare_10: "10 gare",
  champ_10: "10 punti campionato",
  champ_50: "50 punti campionato",
  champ_100: "100 punti campionato",
  improve_5: "Media in salita",
  days_30: "Trenta giorni",
  streak_7: "Sette giorni di fila",
};

const COLORS = ["#1f5c38", "#245c45", "#184833", "#3d8f5f", "#16382c"];

export async function db() {
  return getSql();
}

export function asNum(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function asNumOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const n = asNum(value, Number.NaN);
  return Number.isFinite(n) ? n : null;
}

export function asIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return value == null ? "" : String(value);
}

export function asBool(value: unknown) {
  return value === true || value === "t" || value === "true" || value === 1 || value === "1";
}

export function clip(value: unknown, max: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** livello nello staff: fondatore, amministratore, editor delle compagnie, oppure nessuno */
export function staffLevel(me: Pick<MemberRow, "role" | "is_super" | "staff">): "super" | "admin" | "editor" | null {
  if (me.role === "admin") return asBool(me.is_super) ? "super" : "admin";
  if (me.staff === "editor") return "editor";
  return null;
}

export function canScore(role: string) {
  return role === "admin" || role === "archer";
}

export function cleanPhoto(value: unknown) {
  if (value == null || value === "") return null;
  const raw = String(value);
  if (!/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(raw)) {
    throw new Error("La foto deve essere un'immagine sul telefono, non un link.");
  }
  if (raw.length > 180_000) throw new Error("Foto troppo pesante. Avvicina meno, o riprova.");
  return raw.replace(/\s/g, "");
}

function dayString(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const match = String(value ?? "").match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

export function toMember(row: MemberRow, claim: boolean, email: string | null = null): PublicMember {
  return {
    id: asNum(row.id),
    userId: row.user_id,
    givenName: row.given_name,
    familyName: row.family_name ?? "",
    nickname: row.nickname ?? "",
    slug: row.slug,
    role: row.role,
    bowType: row.bow_type ?? "",
    bio: row.bio ?? "",
    avatarColor: row.avatar_color || "#1f5c38",
    photoUrl: row.photo_url,
    joinedOn: dayString(row.joined_on),
    claimCode: claim ? row.claim_code : null,
    status: row.status,
    email,
    notifyBoard: row.notify_board !== false,
    notifyChallenges: row.notify_challenges !== false,
    notifyGoals: row.notify_goals !== false,
    notifyComps: row.notify_comps !== false,
    isSuper: asBool(row.is_super),
    staff: row.staff ?? "",
    percorso: row.percorso ?? "esistente",
    shareCoach: row.share_coach !== false,
  };
}

export async function ensureMember(sql: Sql, userId: string): Promise<MemberRow> {
  const existing = await sql<MemberRow>`select * from members where user_id = ${userId} limit 1`;
  if (existing[0]) return existing[0];
  const admins = await sql<{ n: number }>`select count(*)::int as n from members where role = 'admin' and user_id is not null`;
  const first = asNum(admins[0]?.n) === 0;
  const people = await sql<{ name: string | null }>`select name from "user" where id = ${userId} limit 1`;
  const given = clip(people[0]?.name || "Arciere", 40) || "Arciere";
  const slug = `u-${userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}-${Math.random().toString(36).slice(2, 6)}`;
  const code = `NEW${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const color = COLORS[Math.abs(given.length) % COLORS.length];
  try {
    const rows = await sql<MemberRow>`
      insert into members (user_id, given_name, slug, claim_code, avatar_color, role, status)
      values (${userId}, ${given}, ${slug}, ${code}, ${color}, ${first ? "admin" : "archer"}, 'active')
      returning *`;
    if (rows[0]) return rows[0];
  } catch {
    /* another request claimed this user id first */
  }
  const again = await sql<MemberRow>`select * from members where user_id = ${userId} limit 1`;
  if (!again[0]) throw new Error("Profilo non creato.");
  return again[0];
}

export function jsonSafe<T>(value: T): T {
  if (value instanceof Date) return value.toISOString() as T;
  if (typeof value === "bigint") return Number(value) as T;
  if (Array.isArray(value)) return value.map((item) => jsonSafe(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = jsonSafe(v);
    return out as T;
  }
  return value;
}
