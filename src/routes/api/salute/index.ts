import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

/**
 * Stato del database, senza dati personali: quanto ci mette a rispondere e quante interrogazioni
 * stanno girando da più tempo. Serve a capire se l'app è lenta per il database.
 */
export const Route = createFileRoute("/api/salute/")({
  server: {
    handlers: {
      GET: async () => {
        const t0 = Date.now();
        const out: Record<string, unknown> = {};
        try {
          const sql = await getSql();
          await sql`select 1`;
          out.select1Ms = Date.now() - t0;
          const act = await sql<{ n: number; longest: number | null; waiting: number }>`
            select count(*)::int as n,
              max(extract(epoch from (now() - query_start)))::float as longest,
              count(*) filter (where wait_event_type = 'Lock')::int as waiting
            from pg_stat_activity where state = 'active' and pid <> pg_backend_pid()`.catch(() => []);
          out.active = act[0]?.n ?? null;
          out.longestSeconds = act[0]?.longest != null ? Math.round(Number(act[0].longest)) : null;
          out.waitingOnLocks = act[0]?.waiting ?? null;
          const t1 = Date.now();
          const h = await sql<{ n: number }>`select count(*)::int as n from fitast_history`.catch(() => []);
          out.historyTables = h[0]?.n ?? null;
          const r = await sql<{ n: number }>`select count(*)::int as n from fitast_history_rows`.catch(() => []);
          out.historyRows = r[0]?.n ?? null;
          out.countMs = Date.now() - t1;
          const t2 = Date.now();
          await sql`select id from members limit 1`;
          out.membersMs = Date.now() - t2;
        } catch (e) {
          out.error = e instanceof Error ? e.message.slice(0, 200) : "errore";
        }
        out.totalMs = Date.now() - t0;
        return new Response(JSON.stringify(out), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
      },
    },
  },
});
