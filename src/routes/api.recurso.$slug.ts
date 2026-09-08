// src/routes/api.recurso.$slug.ts
//
// GET /api/recurso/$slug?token=… — entrega gateada del PDF de un lead magnet
// (Task 13, Fase 3, última tarea del plan de captación). El PDF NO vive en
// `public/`: eso es CDN abierto, sin rate limit, y no se puede condicionar a
// haber dejado el contacto. Vive fuera del bundle público, en
// `assets-privados/`, bundleado al server via `serverAssets` de Nitro (ver
// vite.config.ts) — y este endpoint es el único camino para leerlo.
//
// El "de un solo uso" del brief original no alcanza con un JWT firmado sin
// más — eso es válido durante todo su TTL, no de un solo uso. Acá el token
// es estado persistido en `marketing_leads.download_token` (migración
// 20260908050000) que se invalida atómicamente en el primer uso: el UPDATE
// de abajo sólo afecta la fila si `download_delivered_at` todavía es NULL,
// así que dos requests concurrentes con el mismo token nunca pueden ganar
// las dos — Postgres serializa el UPDATE por fila.
//
// Ronda de fix 1 sobre una revisión rigurosa (CRITICAL) — DOS intentos:
//
// 1. La primera versión leía con `path.resolve(process.cwd(), pdfPath)` — un
//    path armado en runtime a partir de un string. Ningún tracer estático
//    puede verlo y decidir incluir el PDF en el bundle de la función — y el
//    síntoma real es grave: `download_delivered_at` se quema ANTES de este
//    `readFile` (ver el UPDATE de arriba), así que si el archivo no está en
//    el bundle el lead pierde el PDF para siempre con un 500, sin poder
//    reintentar.
// 2. El primer intento de arreglo (dentro de esta misma ronda) fue
//    `readFile(fileURLToPath(new URL("../../assets-privados/…",
//    import.meta.url)))` — el patrón estándar de Vite/Rollup para que un
//    bundler trate un `new URL(literal, import.meta.url)` como referencia a
//    un asset. Se verificó ROTO por inspección directa de
//    `NITRO_PRESET=vercel npm run build:vercel`: el literal sobrevivía SIN
//    procesar en el `.mjs` de salida y el PDF no aparecía en ningún lado de
//    `.vercel/output` — Nitro no reescribe ese patrón (es una feature de
//    Vite para el bundle de CLIENTE; el `assetsPlugin` que sí trae Nitro es
//    para `import.meta.vite.assets(...)`, una cosa totalmente distinta). La
//    doc propia de Nitro lo dice explícito: "Unless using `useStorage()`,
//    assets won't be included in the server bundle."
//
// Lo de abajo es ese mecanismo: `serverAssets` (vite.config.ts) mapea
// `assets-privados/` bajo el mount `assets:recursos`, y Nitro lo bundlea
// como parte del server build en producción, embebido como lazy import con
// metadata precalculada (mime/etag/mtime) — confirmado por inspección de
// `NITRO_PRESET=vercel npm run build:vercel`: aparece
// `.vercel/output/functions/__server.func/_virtual/fugas-clinica-dental.mjs`
// (359KB, el PDF de 268KB en base64) y el manifest de assets en
// `_chunks/router-*.mjs` lo referencia por `recursos:fugas-clinica-dental.pdf`
// con `useStorage("assets:recursos").getItemRaw(...)` ya inlineado. `getItemRaw`
// (no `getItem`) porque necesitamos los bytes crudos del binario, no un
// valor parseado.
//
// ✅ Confirmado además contra un preview deploy real de Vercel (no sólo
// inspección de build): formulario enviado de verdad en
// alika-git-worktree-captacion-lead-magnets-*.vercel.app, token de descarga
// real, `GET /api/recurso/fugas-clinica-dental?token=...` devolvió 200 +
// `application/pdf` + 157.853 bytes (PDF válido de 5 páginas, magic
// `%PDF-1.4` — mismo tamaño exacto que la versión local post-fix de
// `print:hidden`), el mismo token una segunda vez dio 403 ("Token inválido o
// ya usado"). Mecanismo `serverAssets`/`useStorage` de Nitro verificado
// funcionando en el bundle serverless real de Vercel, no sólo en la
// inspección estática del build.
//
// `useStorage` SÍ funciona en dev cuando Nitro corre como dev server propio
// — no es este caso: vite.config.ts excluye el plugin de Nitro del dev
// server a propósito ("Nitro sólo participa del build, nunca del dev
// server"), así que acá `useStorage("assets:recursos")` siempre da vacío en
// `vite dev` (verificado: 500 real al bajar el PDF localmente antes de
// agregar el fallback de abajo). Sin ese fallback, TODO el flujo de
// descarga habría quedado imposible de probar en local — exactamente el
// tipo de cosa que la ronda anterior no pudo verificar. `leerRecurso` intenta
// primero el storage de Nitro (el camino real de producción) y sólo cae al
// filesystem si NODE_ENV no es "production" — mismo criterio que
// `obtenerSalIp` en leads.functions.ts. En producción, si el storage no
// tiene el asset, es un error real de build/deploy: no hay fallback
// silencioso, se loguea y se captura en Sentry como antes.
import { createFileRoute } from "@tanstack/react-router";
// Alias a propósito: `useStorage` es la función de Nitro, no un hook de
// React, pero el nombre matchea el patrón `/^use[A-Z]/` que
// `eslint-plugin-react-hooks` usa para decidir qué es un hook — sin el
// alias, el linter exige que `leerRecurso` sea un componente o un hook.
import { useStorage as obtenerStorageDeNitro } from "nitro/storage";

import { captureException } from "@/lib/sentry";

async function leerRecurso(filename: string) {
  // Sin generic en `getItemRaw` ni anotación de retorno a propósito:
  // `Uint8Array<ArrayBufferLike>` (lo que da cualquier anotación explícita
  // con la lib.dom actual) no es asignable a `BodyInit` de `Response` — sólo
  // `Uint8Array<ArrayBuffer>` lo es, y ni `unstorage` ni el genérico de acá
  // pueden expresar eso. Dejar el `any` default de `getItemRaw` evita el
  // choque de tipos sin castear nada a mano.
  const desdeStorage = await obtenerStorageDeNitro("assets:recursos").getItemRaw(filename);
  if (desdeStorage) return desdeStorage;

  if (process.env.NODE_ENV !== "production") {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    return await readFile(resolve(process.cwd(), "assets-privados", filename));
  }

  throw new Error(`asset no encontrado en el storage de Nitro: ${filename}`);
}

// Revisión final de rama (Important #2): sin `source` — la autorización ya
// no pasa por esa columna (ver el UPDATE de abajo), así que mantenerla acá
// sólo dejaba la puerta abierta a que alguien la reintrodujera en el filtro
// y repitiera el mismo bug.
const RECURSOS: Record<string, { filename: string }> = {
  "fugas-clinica-dental": {
    filename: "fugas-clinica-dental.pdf",
  },
};

export const Route = createFileRoute("/api/recurso/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        // `Object.hasOwn` en vez de `RECURSOS[params.slug]` directo: el slug
        // viene del path de la URL, así que un visitante puede pedir
        // `/api/recurso/constructor` o `/api/recurso/__proto__` — sin este
        // chequeo el lookup no da `undefined` limpio, devuelve una función o
        // el prototipo del objeto (fix 4, revisión rigurosa).
        if (!Object.hasOwn(RECURSOS, params.slug)) {
          return new Response("No encontrado", { status: 404 });
        }
        const recurso = RECURSOS[params.slug];

        const token = new URL(request.url).searchParams.get("token");
        if (!token) {
          return new Response("Falta el token", { status: 403 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Validación + invalidación atómica: un solo UPDATE condicionado,
        // no un SELECT seguido de un UPDATE separado (eso sí tendría
        // condición de carrera entre dos requests con el mismo token).
        //
        // Revisión final de rama (Important #2): filtrado por
        // `download_slug` (el slug de ESTA url), no por `source` — `source`
        // en `marketing_leads` se pisa con la última fuente que envió el
        // lead (comportamiento intencional de Task 3), así que un checklist
        // seguido de una calculadora sin descargar todavía rompía este link
        // para siempre. `download_slug` se setea una sola vez al INSERT y
        // nunca se pisa (ver `leads.functions.ts`).
        const { data: filasActualizadas, error } = await supabaseAdmin
          .from("marketing_leads")
          .update({ download_delivered_at: new Date().toISOString() })
          .eq("download_token", token)
          .eq("download_slug", params.slug)
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
          const archivo = await leerRecurso(recurso.filename);
          return new Response(archivo, {
            status: 200,
            // El `filename` viene del registro `RECURSOS`, nunca de
            // `params.slug` crudo (fix 4, revisión rigurosa) — el slug es
            // input del visitante y no debería interpolarse sin escapar en
            // una cabecera HTTP.
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${recurso.filename}"`,
              // Nunca cacheable: la URL es válida una sola vez y ya se
              // invalidó arriba — un proxy/browser que la cacheara serviría
              // un 200 stale a un segundo pedido que debería dar 403.
              "Cache-Control": "private, no-store",
            },
          });
        } catch (err) {
          // El token ya se marcó usado arriba aunque el archivo no exista
          // en el storage — no hay forma de "revertir" limpiamente sin abrir
          // una ventana de carrera nueva, y el caso real (el asset no quedó
          // incluido en el bundle serverless — ver el comentario largo de
          // arriba) es un error de operación, no algo que un reintento del
          // visitante vaya a arreglar. Mensaje genérico al visitante,
          // detalle real sólo en los logs del server.
          console.error(
            `[api.recurso] no se pudo leer el asset "${recurso.filename}" para slug=${params.slug}:`,
            err instanceof Error ? err.message : err,
          );
          void captureException(err, {
            tags: { boundary: "api_recurso_read_file" },
            extra: { slug: params.slug, filename: recurso.filename },
          });
          return new Response("Error interno", { status: 500 });
        }
      },
    },
  },
});
