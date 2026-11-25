import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asNum, db, ensureMember } from "./access";

/**
 * Punti esperienza: il telefono manda i suoi, il server tiene il valore più alto e lo rimanda.
 * Così il livello si vede sul profilo e un telefono nuovo riparte dai punti già guadagnati.
 */
export const syncXp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const xp = Math.floor(asNum((input as { xp?: number })?.xp));
    return { xp: Math.max(0, Math.min(10_000_000, Number.isFinite(xp) ? xp : 0)) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const me = await ensureMember(sql, context.userId);
    const rows = await sql<{ xp: number }>`update members set xp = greatest(xp, ${data.xp}) where id = ${me.id} returning xp`;
    return { xp: asNum(rows[0]?.xp) };
  });
