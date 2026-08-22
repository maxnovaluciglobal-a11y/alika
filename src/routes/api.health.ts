import { createFileRoute } from "@tanstack/react-router";

/**
 * Healthcheck público, sin auth (para UptimeRobot u otro monitor externo,
 * ver docs/DEPLOY_PRODUCTION.md). Responde 200 siempre que el proceso esté
 * vivo, y además intenta un ping trivial a Supabase (select con limit 1
 * sobre `clinics`, sin filtrar por clínica) para detectar una DB caída —
 * si ese ping falla, responde 503 pero nunca expone datos de la query,
 * solo status/timestamp.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const timestamp = new Date().toISOString();

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("clinics").select("id").limit(1);
          if (error) {
            console.error("[health] supabase ping failed:", error.message);
            return Response.json({ status: "error", timestamp }, { status: 503 });
          }
        } catch (err) {
          console.error("[health] supabase ping threw:", (err as Error).message);
          return Response.json({ status: "error", timestamp }, { status: 503 });
        }

        return Response.json({ status: "ok", timestamp }, { status: 200 });
      },
    },
  },
});
