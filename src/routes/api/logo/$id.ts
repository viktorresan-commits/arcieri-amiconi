import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

/**
 * Logo vero di una compagnia (trovato dal server sul portale FITAST o sul sito della compagnia).
 * Si serve come immagine con una cache lunga: l'indirizzo cambia quando cambia il logo.
 */
export const Route = createFileRoute("/api/logo/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = Number(params.id);
        if (!Number.isInteger(id) || id <= 0) return new Response("", { status: 404 });
        const sql = await getSql();
        const rows = await sql<{ mime: string; data: string }>`select mime, data from company_logos where company_id = ${id} limit 1`;
        const row = rows[0];
        if (!row) return new Response("", { status: 404, headers: { "cache-control": "public, max-age=300" } });
        const mime = /^image\/(png|jpeg|gif|webp|svg\+xml|x-icon)$/.test(row.mime) ? row.mime : "application/octet-stream";
        return new Response(new Uint8Array(Buffer.from(row.data, "base64")), {
          headers: {
            "content-type": mime,
            "cache-control": "public, max-age=2592000, immutable",
            "x-content-type-options": "nosniff",
            // un SVG aperto da solo non può eseguire nulla
            "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          },
        });
      },
    },
  },
});
