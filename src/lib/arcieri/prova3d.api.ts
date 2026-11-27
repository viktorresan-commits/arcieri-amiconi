/**
 * Prova dell'arciere 3D: pagina nascosta che vede solo il Fondatore.
 *
 * Il server controlla chi la chiede e consegna la pagina solo al Fondatore. Corpi, abiti e three.js
 * sono liberi e stanno in /public/prova3d/. Le animazioni da arco (Kevin Iglesias, licenza Unity
 * Asset Store: niente diffusione come file a sé) non stanno nel codice: il Fondatore carica una volta
 * il file dalla pagina stessa e resta nel database, in una tabella che legge solo lui.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { db, ensureMember, staffLevel } from "./access";

const CLIPS = "prova3d-clips";
const NAMES = ["bowIdle", "load", "hold", "release", "walk", "run"];

type PageResult = { ok: true; html: string } | { ok: false; reason: "riservata" | "animazioni" };

async function isFounder(sql: Sql, userId: string) {
  return staffLevel(await ensureMember(sql, userId)) === "super";
}

export const prova3dPage = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PageResult> => {
    const sql = await db();
    if (!(await isFounder(sql, context.userId))) return { ok: false, reason: "riservata" };
    const rows = await sql<{ body: string }>`select body from founder_files where name = ${CLIPS} limit 1`;
    const clips = rows[0]?.body;
    if (!clips) return { ok: false, reason: "animazioni" };
    const { PROVA3D_PAGE } = await import("./prova3d-page");
    // dentro uno <script>: nessun "<" vero, così il testo non può chiudere lo script
    const safe = clips.replace(/</g, "\\u003c");
    return { ok: true, html: PROVA3D_PAGE.replace("__CLIPS__", () => safe) };
  });

/** il file delle animazioni (arco-clips.json): controllato e salvato, solo per il Fondatore */
export const prova3dUpload = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const text = typeof (input as { text?: unknown })?.text === "string" ? (input as { text: string }).text : "";
    if (!text || text.length > 4_000_000) throw new Error("File vuoto o troppo grande.");
    return { text };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    if (!(await isFounder(sql, context.userId))) throw new Error("Pagina non trovata.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.text);
    } catch {
      throw new Error("Questo non è il file delle animazioni.");
    }
    const sets = parsed as Record<string, unknown>;
    for (const s of ["m", "f"]) {
      const list = sets?.[s];
      const names = Array.isArray(list) ? list.map((c) => (c as { name?: unknown })?.name) : [];
      const tracksOk = Array.isArray(list) && list.every((c) => Array.isArray((c as { tracks?: unknown })?.tracks));
      if (!tracksOk || NAMES.some((n) => !names.includes(n))) throw new Error("Questo non è il file delle animazioni.");
    }
    const body = JSON.stringify(parsed);
    await sql`
      insert into founder_files (name, body, updated_at) values (${CLIPS}, ${body}, now())
      on conflict (name) do update set body = excluded.body, updated_at = now()`;
    return { ok: true };
  });
