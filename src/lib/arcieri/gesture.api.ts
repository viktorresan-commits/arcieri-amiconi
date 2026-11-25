import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asIso, asNum, asNumOrNull, canScore, clip, db, ensureMember } from "./access";
import { writerFor } from "./acting.api";

/** Analisi del gesto salvate: numeri e miniatura, per i confronti nel tempo e nel gruppo. */

export type GestureRow = {
  id: number;
  memberId: number;
  name: string;
  title: string;
  kind: "video" | "foto";
  hand: string;
  score: number | null;
  shots: number;
  anchorS: number | null;
  drawS: number | null;
  lineDeg: number | null;
  bowDeg: number | null;
  shoulderDeg: number | null;
  jitter: number | null;
  distanceM: number | null;
  /** JSON con i dettagli (controlli, angoli in più) */
  data: string;
  thumb: string;
  createdAt: string;
};

type Raw = Record<string, unknown>;

function rowOf(r: Raw): GestureRow {
  const data = typeof r.data === "string" ? r.data : JSON.stringify(r.data ?? {});
  return {
    id: asNum(r.id),
    memberId: asNum(r.member_id),
    name: [r.given_name, r.family_name].filter(Boolean).join(" ") || String(r.nickname ?? "") || "Arciere",
    title: String(r.title ?? ""),
    kind: r.kind === "foto" ? "foto" : "video",
    hand: String(r.hand ?? "destro"),
    score: asNumOrNull(r.score),
    shots: asNum(r.shots),
    anchorS: asNumOrNull(r.anchor_s),
    drawS: asNumOrNull(r.draw_s),
    lineDeg: asNumOrNull(r.line_deg),
    bowDeg: asNumOrNull(r.bow_deg),
    shoulderDeg: asNumOrNull(r.shoulder_deg),
    jitter: asNumOrNull(r.jitter),
    distanceM: asNumOrNull(r.distance_m),
    data,
    thumb: String(r.thumb ?? ""),
    createdAt: asIso(r.created_at),
  };
}

const num = (v: unknown, lo: number, hi: number) => {
  const n = asNumOrNull(v);
  return n == null || !Number.isFinite(n) ? null : Math.max(lo, Math.min(hi, n));
};

export const saveGesture = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Raw;
    const thumb = String(raw.thumb ?? "");
    if (thumb && (!thumb.startsWith("data:image/jpeg;base64,") || thumb.length > 160_000)) throw new Error("Miniatura non valida o troppo pesante.");
    const data = JSON.stringify(raw.data ?? {});
    // la sequenza del tiro porta tutti i punti (corpo, mani, viso, in metri): fino a circa 200 kB
    if (data.length > 300_000) throw new Error("Dati dell'analisi troppo grandi.");
    return {
      title: clip(raw.title, 80),
      kind: raw.kind === "foto" ? "foto" : "video",
      hand: raw.hand === "mancino" ? "mancino" : "destro",
      score: num(raw.score, 0, 100),
      shots: Math.max(0, Math.min(50, Math.round(asNum(raw.shots)))),
      anchorS: num(raw.anchorS, 0, 60),
      drawS: num(raw.drawS, 0, 60),
      lineDeg: num(raw.lineDeg, 0, 200),
      bowDeg: num(raw.bowDeg, 0, 200),
      shoulderDeg: num(raw.shoulderDeg, -90, 90),
      jitter: num(raw.jitter, 0, 100),
      distanceM: num(raw.distanceM, 0, 100),
      data,
      thumb,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    if (!canScore(me.role)) throw new Error("Questo profilo può solo consultare.");
    const owner = await writerFor(sql, context.userId, me);
    const rows = await sql<{ id: number }>`
      insert into gestures (member_id, added_by, title, kind, hand, score, shots, anchor_s, draw_s, line_deg, bow_deg, shoulder_deg, jitter, distance_m, data, thumb)
      values (${owner.memberId}, ${owner.by}, ${data.title}, ${data.kind}, ${data.hand}, ${data.score}, ${data.shots}, ${data.anchorS}, ${data.drawS}, ${data.lineDeg},
        ${data.bowDeg}, ${data.shoulderDeg}, ${data.jitter}, ${data.distanceM}, ${data.data}::jsonb, ${data.thumb})
      returning id`;
    return { id: asNum(rows[0]?.id) };
  });

export const listGestures = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const rows = await sql<Raw>`
      select g.*, m.given_name, m.family_name, m.nickname from gestures g join members m on m.id = g.member_id
      where g.member_id = ${me.id} order by g.created_at desc limit 200`;
    return rows.map(rowOf);
  });

export const deleteGesture = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: asNum((input as { id?: number })?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    await sql`delete from gestures where id = ${data.id} and member_id = ${me.id}`;
    return { ok: true };
  });

/** La postura migliore di ognuno nel gruppo (miglior punteggio), dalla più alta. */
export const bestGestures = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const rows = await sql<Raw>`
      select distinct on (g.member_id) g.*, m.given_name, m.family_name, m.nickname
      from gestures g join members m on m.id = g.member_id
      where g.score is not null and m.status <> 'left'
      order by g.member_id, g.score desc, g.created_at desc`;
    return rows.map(rowOf).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 12);
  });
