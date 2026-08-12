import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface EntradaEspera {
  id: string;
  nombre: string;
  motivo: string;
  espera: string;
}

function tiempoDeEspera(waitSince: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(waitSince).getTime()) / 60_000));
  if (minutos < 1) return "—";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.round(minutos / 60);
  return `${horas} h`;
}

/** Lista de espera activa de la clínica. Sin alta/baja todavía (fase 2). */
export const listWaitlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<EntradaEspera[]> => {
    const { data: rows, error } = await context.supabase
      .from("waitlist_entries")
      .select("id, full_name, reason, wait_since")
      .eq("clinic_id", data.clinicId)
      .eq("status", "waiting")
      .order("wait_since", { ascending: true })
      .limit(100);

    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => ({
      id: r.id,
      nombre: r.full_name,
      motivo: r.reason ?? "Sin motivo registrado",
      espera: tiempoDeEspera(r.wait_since),
    }));
  });
