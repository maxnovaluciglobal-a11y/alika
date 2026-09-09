// src/routes/api.ev.ts
//
// Embudo mínimo propio. Existe porque la CSP prohíbe PostHog/GA/GTM
// (script-src 'self'), y sin ninguna medición no hay forma de saber si la
// calculadora convierte. Same-origin, cubierto por el rate limiter de /api/.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const NOMBRES = ["calculadora_vista", "calculadora_usada", "lead_enviado", "cta_click"] as const;

const Esquema = z.object({
  name: z.enum(NOMBRES),
  // Sólo buckets y strings cortos. Nunca cifras de la clínica.
  props: z.record(z.string().max(40), z.union([z.string().max(60), z.boolean()])).optional(),
  sessionHash: z.string().max(64).optional(),
});

export const Route = createFileRoute("/api/ev")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let cuerpo: unknown;
        try {
          cuerpo = await request.json();
        } catch {
          return new Response(null, { status: 204 });
        }
        const parsed = Esquema.safeParse(cuerpo);
        // La telemetría nunca rompe nada ni informa al cliente: 204 siempre.
        if (!parsed.success) return new Response(null, { status: 204 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("marketing_events").insert({
            name: parsed.data.name,
            props: parsed.data.props ?? null,
            session_hash: parsed.data.sessionHash ?? null,
          });
          if (error) {
            console.error("[ev] insert failed:", error.message);
          }
        } catch (err) {
          console.error("[ev] insert threw:", (err as Error).message);
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
