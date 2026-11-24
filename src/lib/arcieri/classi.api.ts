/**
 * Classi degli allenatori: «Corso A, lunedì e mercoledì alle 18». Ogni classe ha allievi e uno o più
 * allenatori, il link del gruppo WhatsApp già esistente, un codice d'invito e le richieste alla classe
 * (segnare punteggi, una gara, un'analisi del gesto, le foto delle volée).
 *
 * Le vedono e le gestiscono gli allenatori, il presidente della compagnia e il fondatore; un allenatore
 * vede anche le classi dei colleghi e può aggiungersi. Gli allievi vedono le loro classi e le richieste.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { asBool, asNum, db, ensureMember, staffLevel } from "./access";
import { myMembership } from "./compagnie.api";

export const REQUEST_KINDS = [
  { id: "punteggi", label: "Segnare i punteggi", href: "/allenamento?avvia=rapido" },
  { id: "gara", label: "Segnare la gara", href: "/gare" },
  { id: "gesto", label: "Analisi del gesto", href: "/allenamento?avvia=gesto" },
  { id: "foto", label: "Foto delle volée", href: "/allenamento?avvia=foto" },
  { id: "altro", label: "Altro", href: "/schede" },
] as const;

export const DAYS = [
  { id: "lun", label: "Lunedì" },
  { id: "mar", label: "Martedì" },
  { id: "mer", label: "Mercoledì" },
  { id: "gio", label: "Giovedì" },
  { id: "ven", label: "Venerdì" },
  { id: "sab", label: "Sabato" },
  { id: "dom", label: "Domenica" },
] as const;

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

function day(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const m = String(value ?? "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "";
}

function nameOf(p: { given_name?: string | null; family_name?: string | null; nickname?: string | null } | undefined) {
  if (!p) return "Arciere";
  return [p.given_name, p.family_name].filter(Boolean).join(" ") || p.nickname || "Arciere";
}

function code() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += abc[Math.floor(Math.random() * abc.length)];
  return `CLS-${out.slice(0, 4)}-${out.slice(4)}`;
}

async function notify(sql: Sql, userId: string, title: string, body: string, href: string, dedupe: string) {
  try {
    await sql`insert into notifications (user_id, title, body, href, dedupe) values (${userId}, ${title}, ${body}, ${href}, ${dedupe}) on conflict (dedupe) do nothing`;
  } catch {
    /* l'avviso non è indispensabile */
  }
}

/** chi gestisce le classi: fondatore ovunque, presidente e allenatori nella loro compagnia */
async function coachOf(sql: Sql, userId: string) {
  const me = await ensureMember(sql, userId);
  const staff = staffLevel(me);
  const mine = await myMembership(sql, userId);
  const president = mine.role === "owner";
  if (!staff && !president && !asBool(me.coach)) throw new Error("Le classi le gestiscono gli allenatori e il presidente della compagnia.");
  return { me, staff, mine, president };
}

async function classRow(sql: Sql, id: number) {
  const rows = await sql<{ id: number; company_id: number | null; name: string; days: string; time: string; place: string; whatsapp_url: string; invite_code: string | null; created_by: string }>`
    select * from coach_classes where id = ${id} limit 1`;
  if (!rows[0]) throw new Error("Classe non trovata.");
  return rows[0];
}

/** può modificare la classe: i suoi allenatori, il presidente della compagnia, il fondatore */
async function canEdit(sql: Sql, userId: string, classId: number) {
  const { staff, mine, president } = await coachOf(sql, userId);
  const c = await classRow(sql, classId);
  if (staff) return c;
  if (asNum(c.company_id) !== mine.companyId) throw new Error("Questa classe è di un'altra compagnia.");
  if (president) return c;
  const own = await sql<{ n: number }>`select count(*)::int as n from class_coaches where class_id = ${classId} and user_id = ${userId}`;
  if (!asNum(own[0]?.n)) throw new Error("Prima aggiungiti come allenatore di questa classe.");
  return c;
}

/** le classi della compagnia, con allenatori, allievi e richieste aperte */
export const listClasses = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ companyId: asNum((input as { companyId?: unknown })?.companyId) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { staff, mine } = await coachOf(sql, context.userId);
    const companyId = staff && data.companyId ? data.companyId : mine.companyId;
    const classes = await sql<{ id: number; name: string; days: string; time: string; place: string; whatsapp_url: string; invite_code: string | null; created_by: string }>`
      select id, name, days, time, place, whatsapp_url, invite_code, created_by from coach_classes where company_id = ${companyId} order by name, id`;
    const ids = classes.map((c) => asNum(c.id));
    const list = ids.join(",");
    const coaches = ids.length ? await sql<{ class_id: number; user_id: string }>`select class_id, user_id from class_coaches where class_id = any(string_to_array(${list}, ',')::int[])` : [];
    const members = ids.length ? await sql<{ class_id: number; user_id: string }>`select class_id, user_id from class_members where class_id = any(string_to_array(${list}, ',')::int[])` : [];
    const requests = ids.length
      ? await sql<{ id: number; class_id: number; created_by: string; kind: string; message: string; due_on: unknown; created_at: unknown; done: number }>`
          select r.*, (select count(*)::int from class_request_done d where d.request_id = r.id) as done
          from class_requests r where r.class_id = any(string_to_array(${list}, ',')::int[]) and r.created_at > now() - interval '60 days'
          order by r.created_at desc`
      : [];
    // persone della compagnia (per scegliere gli allievi) e nomi di chi compare
    const people = await sql<{ id: number; user_id: string; given_name: string; family_name: string; nickname: string; photo_url: string | null; avatar_color: string; company_id: number | null }>`
      select m.id, m.user_id, m.given_name, m.family_name, m.nickname, m.photo_url, m.avatar_color, cm.company_id
      from members m left join company_members cm on cm.user_id = m.user_id where m.user_id is not null`;
    const byUser = new Map(people.map((p) => [p.user_id, p]));
    const person = (uid: string) => {
      const p = byUser.get(uid);
      return { userId: uid, memberId: asNum(p?.id), name: nameOf(p), photoUrl: p?.photo_url && p.photo_url.length < 200_000 ? p.photo_url : null, color: p?.avatar_color || "#1f5c38" };
    };
    const inCompany = people.filter((p) => asNum(p.company_id) === companyId).map((p) => person(p.user_id)).sort((a, b) => a.name.localeCompare(b.name));
    return {
      companyId,
      people: inCompany,
      classes: classes.map((c) => {
        const id = asNum(c.id);
        const cs = coaches.filter((x) => asNum(x.class_id) === id).map((x) => person(x.user_id));
        const ms = members.filter((x) => asNum(x.class_id) === id).map((x) => person(x.user_id)).sort((a, b) => a.name.localeCompare(b.name));
        return {
          id,
          name: c.name,
          days: c.days ? c.days.split(",").filter(Boolean) : [],
          time: c.time,
          place: c.place,
          whatsappUrl: c.whatsapp_url,
          inviteCode: c.invite_code ?? "",
          mine: cs.some((x) => x.userId === context.userId),
          coaches: cs,
          members: ms,
          requests: requests
            .filter((r) => asNum(r.class_id) === id)
            .map((r) => ({ id: asNum(r.id), kind: r.kind, message: r.message, dueOn: day(r.due_on), createdAt: iso(r.created_at), by: person(r.created_by).name, done: asNum(r.done) })),
        };
      }),
    };
  });

/** crea o modifica una classe; chi la crea ne è allenatore */
export const saveClass = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    const name = String(r.name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!name) throw new Error("Dai un nome alla classe, per esempio «Corso A».");
    const days = (Array.isArray(r.days) ? r.days : []).map(String).filter((d) => DAYS.some((x) => x.id === d));
    const time = /^\d{1,2}:\d{2}$/.test(String(r.time ?? "")) ? String(r.time) : "";
    let wa = String(r.whatsappUrl ?? "").trim();
    if (wa && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//.test(wa)) throw new Error("Il link del gruppo comincia con https://chat.whatsapp.com/ (in WhatsApp: Info gruppo › Invita tramite link).");
    wa = wa.slice(0, 200);
    return { id: r.id == null ? null : asNum(r.id), name, days, time, place: String(r.place ?? "").trim().slice(0, 80), whatsappUrl: wa };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { mine } = await coachOf(sql, context.userId);
    if (data.id) {
      await canEdit(sql, context.userId, data.id);
      await sql`update coach_classes set name = ${data.name}, days = ${data.days.join(",")}, time = ${data.time}, place = ${data.place}, whatsapp_url = ${data.whatsappUrl} where id = ${data.id}`;
      return { id: data.id };
    }
    const made = await sql<{ id: number }>`
      insert into coach_classes (company_id, name, days, time, place, whatsapp_url, created_by)
      values (${mine.companyId}, ${data.name}, ${data.days.join(",")}, ${data.time}, ${data.place}, ${data.whatsappUrl}, ${context.userId}) returning id`;
    const id = asNum(made[0]?.id);
    await sql`insert into class_coaches (class_id, user_id) values (${id}, ${context.userId}) on conflict do nothing`;
    return { id };
  });

export const deleteClass = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: unknown })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await canEdit(sql, context.userId, data.id);
    await sql`delete from coach_classes where id = ${data.id}`;
    return { ok: true as const };
  });

/** un allenatore si aggiunge (o si toglie) come allenatore di una classe della sua compagnia */
export const joinClassAsCoach = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    return { id: asNum(r.id), join: r.join !== false };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const { staff, mine } = await coachOf(sql, context.userId);
    const c = await classRow(sql, data.id);
    if (!staff && asNum(c.company_id) !== mine.companyId) throw new Error("Questa classe è di un'altra compagnia.");
    if (data.join) await sql`insert into class_coaches (class_id, user_id) values (${data.id}, ${context.userId}) on conflict do nothing`;
    else {
      const left = await sql<{ n: number }>`select count(*)::int as n from class_coaches where class_id = ${data.id} and user_id <> ${context.userId}`;
      if (!asNum(left[0]?.n)) throw new Error("Sei l'unico allenatore: prima aggiungine un altro, o elimina la classe.");
      await sql`delete from class_coaches where class_id = ${data.id} and user_id = ${context.userId}`;
    }
    return { ok: true as const };
  });

/** aggiunge o toglie un allievo della compagnia */
export const setClassMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    return { classId: asNum(r.classId), userId: String(r.userId ?? ""), add: r.add !== false };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const c = await canEdit(sql, context.userId, data.classId);
    if (data.add) {
      const theirs = await myMembership(sql, data.userId);
      if (theirs.companyId !== asNum(c.company_id)) throw new Error("Aggiungi solo persone della compagnia: gli altri li inviti su WhatsApp.");
      await sql`insert into class_members (class_id, user_id) values (${data.classId}, ${data.userId}) on conflict do nothing`;
      await notify(sql, data.userId, `Sei nella classe ${c.name}`, [c.days ? c.days.split(",").join(", ") : "", c.time].filter(Boolean).join(" · ") || "Trovi le richieste dell'allenatore in «Le mie schede».", "/schede", `class-${c.id}-${data.userId}`);
    } else {
      await sql`delete from class_members where class_id = ${data.classId} and user_id = ${data.userId}`;
    }
    return { ok: true as const };
  });

/** codice d'invito alla classe, da mandare su WhatsApp a un contatto */
export const classInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: unknown })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const c = await canEdit(sql, context.userId, data.id);
    if (c.invite_code) return { code: c.invite_code };
    for (let i = 0; i < 5; i++) {
      const k = code();
      const done = await sql<{ id: number }>`update coach_classes set invite_code = ${k} where id = ${data.id} and invite_code is null returning id`.catch(() => []);
      if (done[0]) return { code: k };
    }
    throw new Error("Invito non creato, riprova.");
  });

/** usa il codice d'invito di una classe: entra nella compagnia (se serve) e nella classe */
export async function redeemClassCode(sql: Sql, userId: string, raw: string) {
  const rows = await sql<{ id: number; company_id: number | null; name: string }>`select id, company_id, name from coach_classes where invite_code = ${raw} limit 1`;
  const c = rows[0];
  if (!c) return null;
  const mine = await myMembership(sql, userId);
  const companyId = asNum(c.company_id);
  if (companyId && mine.companyId !== companyId) {
    await sql`update company_members set company_id = ${companyId}, role = 'member', chosen = true, joined_at = now() where user_id = ${userId}`;
  }
  await sql`insert into class_members (class_id, user_id) values (${c.id}, ${userId}) on conflict do nothing`;
  return { name: c.name };
}

/** l'allenatore chiede qualcosa alla classe: ognuno riceve un avviso che porta dove farlo */
export const askClass = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    const kind = REQUEST_KINDS.find((k) => k.id === r.kind)?.id ?? "altro";
    const message = String(r.message ?? "").trim().slice(0, 400);
    if (kind === "altro" && !message) throw new Error("Scrivi cosa chiedi alla classe.");
    return { classId: asNum(r.classId), kind, message, dueOn: /^\d{4}-\d{2}-\d{2}$/.test(String(r.dueOn ?? "")) ? String(r.dueOn) : null };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const c = await canEdit(sql, context.userId, data.classId);
    const made = await sql<{ id: number }>`
      insert into class_requests (class_id, created_by, kind, message, due_on) values (${data.classId}, ${context.userId}, ${data.kind}, ${data.message}, ${data.dueOn}) returning id`;
    const id = asNum(made[0]?.id);
    const k = REQUEST_KINDS.find((x) => x.id === data.kind)!;
    const members = await sql<{ user_id: string }>`select user_id from class_members where class_id = ${data.classId}`;
    for (const m of members) await notify(sql, m.user_id, `${c.name}: ${k.label.toLowerCase()}`, data.message || "Richiesta dell'allenatore: la trovi in «Le mie schede».", k.href, `creq-${id}-${m.user_id}`);
    return { id, sent: members.length };
  });

export const deleteRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: unknown })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const r = await sql<{ class_id: number }>`select class_id from class_requests where id = ${data.id} limit 1`;
    if (!r[0]) throw new Error("Richiesta non trovata.");
    await canEdit(sql, context.userId, asNum(r[0].class_id));
    await sql`delete from class_requests where id = ${data.id}`;
    return { ok: true as const };
  });

/** le mie classi da allievo, con le richieste aperte */
export const myClasses = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<{ id: number; name: string; days: string; time: string; place: string; whatsapp_url: string }>`
      select c.id, c.name, c.days, c.time, c.place, c.whatsapp_url from coach_classes c join class_members m on m.class_id = c.id where m.user_id = ${context.userId} order by c.name`;
    if (!rows.length) return [];
    const list = rows.map((r) => asNum(r.id)).join(",");
    const reqs = await sql<{ id: number; class_id: number; kind: string; message: string; due_on: unknown; created_at: unknown; mine: boolean }>`
      select r.id, r.class_id, r.kind, r.message, r.due_on, r.created_at,
        exists (select 1 from class_request_done d where d.request_id = r.id and d.user_id = ${context.userId}) as mine
      from class_requests r where r.class_id = any(string_to_array(${list}, ',')::int[]) and r.created_at > now() - interval '60 days'
      order by r.created_at desc`;
    return rows.map((c) => ({
      id: asNum(c.id),
      name: c.name,
      days: c.days ? c.days.split(",").filter(Boolean) : [],
      time: c.time,
      place: c.place,
      whatsappUrl: c.whatsapp_url,
      requests: reqs.filter((r) => asNum(r.class_id) === asNum(c.id)).map((r) => ({ id: asNum(r.id), kind: r.kind, message: r.message, dueOn: day(r.due_on), createdAt: iso(r.created_at), done: asBool(r.mine) })),
    }));
  });

/** l'allievo segna fatta (o non fatta) una richiesta della classe */
export const doneRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    return { id: asNum(r.id), done: r.done !== false };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const ok = await sql<{ n: number }>`
      select count(*)::int as n from class_requests r join class_members m on m.class_id = r.class_id where r.id = ${data.id} and m.user_id = ${context.userId}`;
    if (!asNum(ok[0]?.n)) throw new Error("Richiesta non trovata.");
    if (data.done) await sql`insert into class_request_done (request_id, user_id) values (${data.id}, ${context.userId}) on conflict do nothing`;
    else await sql`delete from class_request_done where request_id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });
