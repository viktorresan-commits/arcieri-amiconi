/** Record del gioco della Home: si salva a fine giro, per bersaglio e livello, con il dettaglio del giro migliore. */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asNum, db, ensureMember } from "./access";
import { GAME_LEVELS, GAME_MODES, GAME_STATIONS, maxRound, modeOf } from "./game-modes";

export const saveGameRound = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { mode?: unknown; level?: unknown; stations?: unknown; tens?: unknown; xs?: unknown; misses?: unknown };
    const mode = GAME_MODES.find((m) => m.id === raw.mode)?.id;
    const level = GAME_LEVELS.find((l) => l.id === raw.level)?.id;
    if (!mode || !level) throw new Error("Gioco non riconosciuto.");
    const top = modeOf(mode).perArrow * 3;
    const stations = Array.isArray(raw.stations) ? raw.stations.map((v) => Math.round(Number(v))) : [];
    if (stations.length !== GAME_STATIONS || stations.some((v) => !Number.isFinite(v) || v < 0 || v > top)) throw new Error("Giro non valido.");
    const arrows = GAME_STATIONS * 3;
    const clampN = (v: unknown) => Math.max(0, Math.min(arrows, Math.round(asNum(v))));
    return { mode, level, stations, tens: clampN(raw.tens), xs: clampN(raw.xs), misses: clampN(raw.misses) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId);
    const total = data.stations.reduce((a, b) => a + b, 0);
    const max = maxRound(data.mode);
    const json = JSON.stringify(data.stations);
    const before = await sql<{ best: number }>`select best from game_records where user_id = ${context.userId} and mode = ${data.mode} and level = ${data.level} limit 1`;
    const record = !before[0] || total > asNum(before[0].best);
    await sql`
      insert into game_records (user_id, mode, level, best, max_points, stations, arrows, tens, xs, misses, rounds, best_at, updated_at)
      values (${context.userId}, ${data.mode}, ${data.level}, ${total}, ${max}, ${json}, ${GAME_STATIONS * 3}, ${data.tens}, ${data.xs}, ${data.misses}, 1, now(), now())
      on conflict (user_id, mode, level) do update set
        rounds = game_records.rounds + 1,
        updated_at = now(),
        best = case when excluded.best > game_records.best then excluded.best else game_records.best end,
        max_points = excluded.max_points,
        stations = case when excluded.best > game_records.best then excluded.stations else game_records.stations end,
        arrows = case when excluded.best > game_records.best then excluded.arrows else game_records.arrows end,
        tens = case when excluded.best > game_records.best then excluded.tens else game_records.tens end,
        xs = case when excluded.best > game_records.best then excluded.xs else game_records.xs end,
        misses = case when excluded.best > game_records.best then excluded.misses else game_records.misses end,
        best_at = case when excluded.best > game_records.best then now() else game_records.best_at end`;
    // ogni giro anche nello storico, con l'ora: per le sfide di tipo minigioco
    await sql`
      insert into game_rounds (user_id, mode, level, total, max_points, tens, xs, misses)
      values (${context.userId}, ${data.mode}, ${data.level}, ${total}, ${max}, ${data.tens}, ${data.xs}, ${data.misses})`.catch(() => undefined);
    return { ok: true as const, record, total };
  });

/** i miei record, per mostrarli nel gioco anche su un telefono nuovo */
export const myGameRecords = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<{ mode: string; level: string; best: number }>`select mode, level, best from game_records where user_id = ${context.userId}`.catch(() => []);
    return rows.map((r) => ({ mode: r.mode, level: r.level, best: asNum(r.best) }));
  });
