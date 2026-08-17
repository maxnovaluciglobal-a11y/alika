import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { fetchPublicHolidays, type PublicHoliday } from "@/lib/holidays";

/**
 * Feriados públicos del país de la clínica (Nager.Date), para marcar el
 * selector de fecha del turno. Sin middleware de auth a propósito: es data
 * pública (no PHI) y la necesitan tanto el staff autenticado (agenda) como
 * el portal de pacientes, que corre con su propia sesión por cookie firmada
 * y no tiene JWT de Supabase (ver requirePortalSession en portal.functions.ts).
 */
export const getPublicHolidays = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        country: z.string().trim().length(2),
        year: z.number().int().min(2020).max(2100),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<PublicHoliday[]> => {
    try {
      return await fetchPublicHolidays(data.country.toUpperCase(), data.year);
    } catch (err) {
      // Nager.Date caído no debe romper el flujo de agendamiento — mismo
      // criterio que WhatsApp: nunca bloquear por un servicio externo.
      console.error("[holidays] Nager.Date falló", err);
      return [];
    }
  });
