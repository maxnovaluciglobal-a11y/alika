// src/routes/api.recurso.$slug.ts
//
// GET /api/recurso/$slug?token=… — entrega gateada del PDF de un lead magnet
// (Task 13, Fase 3, última tarea del plan de captación). El PDF NO vive en
// `public/`: eso es CDN abierto, sin rate limit, y no se puede condicionar a
// haber dejado el contacto. Vive fuera del bundle, en `assets-privados/`
// (ver scripts/build-pdf-recursos.mjs), y este endpoint es el único camino
// para leerlo.
//
// El "de un solo uso" del brief original no alcanza con un JWT firmado sin
// más — eso es válido durante todo su TTL, no de un solo uso. Acá el token
// es estado persistido en `marketing_leads.download_token` (migración
// 20260908050000) que se invalida atómicamente en el primer uso: el UPDATE
// de abajo sólo afecta la fila si `download_delivered_at` todavía es NULL,
// así que dos requests concurrentes con el mismo token nunca pueden ganar
// las dos — Postgres serializa el UPDATE por fila.
import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { captureException } from "@/lib/sentry";

const RECURSOS: Record<string, { pdfPath: string; source: string }> = {
  "fugas-clinica-dental": {
    pdfPath: "assets-privados/fugas-clinica-dental.pdf",
    source: "checklist",
  },
};

export const Route = createFileRoute("/api/recurso/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const recurso = RECURSOS[params.slug];
        if (!recurso) {
          return new Response("No encontrado", { status: 404 });
        }

        const token = new URL(request.url).searchParams.get("token");
        if (!token) {
          return new Response("Falta el token", { status: 403 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Validación + invalidación atómica: un solo UPDATE condicionado,
        // no un SELECT seguido de un UPDATE separado (eso sí tendría
        // condición de carrera entre dos requests con el mismo token).
        const { data: filasActualizadas, error } = await supabaseAdmin
          .from("marketing_leads")
          .update({ download_delivered_at: new Date().toISOString() })
          .eq("download_token", token)
          .eq("source", recurso.source)
          .is("download_delivered_at", null)
          .select("id");

        if (error) {
          console.error(`[api.recurso] update falló para slug=${params.slug}:`, error.message);
          void captureException(error, { tags: { boundary: "api_recurso_update" } });
          return new Response("Error interno", { status: 500 });
        }

        // 0 filas: token inválido, ya usado, o no corresponde a este
        // recurso (source no matchea). Mismo 403 genérico en los tres
        // casos — no le decimos al visitante cuál fue.
        if (!filasActualizadas || filasActualizadas.length !== 1) {
          return new Response("Token inválido o ya usado", { status: 403 });
        }

        try {
          const archivo = await readFile(path.resolve(process.cwd(), recurso.pdfPath));
          return new Response(archivo, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${params.slug}.pdf"`,
              // Nunca cacheable: la URL es válida una sola vez y ya se
              // invalidó arriba — un proxy/browser que la cacheara serviría
              // un 200 stale a un segundo pedido que debería dar 403.
              "Cache-Control": "private, no-store",
            },
          });
        } catch (err) {
          // El token ya se marcó usado arriba aunque el archivo no exista
          // en disco — no hay forma de "revertir" limpiamente sin abrir una
          // ventana de carrera nueva, y el caso real (alguien pegó el link
          // sin haber corrido antes scripts/build-pdf-recursos.mjs) es un
          // error de operación, no algo que un reintento del visitante vaya
          // a arreglar. Mensaje genérico al visitante, detalle real sólo en
          // los logs del server.
          console.error(
            `[api.recurso] no se pudo leer ${recurso.pdfPath} para slug=${params.slug}:`,
            err instanceof Error ? err.message : err,
          );
          void captureException(err, {
            tags: { boundary: "api_recurso_read_file" },
            extra: { slug: params.slug, pdfPath: recurso.pdfPath },
          });
          return new Response("Error interno", { status: 500 });
        }
      },
    },
  },
});
