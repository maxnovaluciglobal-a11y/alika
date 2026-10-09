import { createFileRoute } from "@tanstack/react-router";

/**
 * Baja de un clic (RFC 8058). Es la URL del header `List-Unsubscribe` del
 * reporte semanal: Gmail y Apple Mail la llaman con POST y el cuerpo
 * `List-Unsubscribe=One-Click` cuando la persona toca "Anular suscripción".
 *
 * El enlace visible del pie del correo lleva a la página `/correos/baja`,
 * que pide confirmar antes de aplicar (un GET nunca da de baja).
 */
export const Route = createFileRoute("/api/correos/baja")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        let token = url.searchParams.get("token") ?? "";
        if (!token) {
          const form = await request.formData().catch(() => null);
          const desdeForm = form?.get("token");
          token = typeof desdeForm === "string" ? desdeForm : "";
        }
        const { aplicarBajaConToken } = await import("@/lib/email/baja.server");
        const r = await aplicarBajaConToken(token);
        if (r.ok) return new Response("ok", { status: 200 });
        return new Response(r.motivo === "token" ? "enlace inválido" : "error", {
          status: r.motivo === "token" ? 400 : 500,
        });
      },
    },
  },
});
