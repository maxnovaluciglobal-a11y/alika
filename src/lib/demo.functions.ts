import { createServerFn } from "@tanstack/react-start";

/**
 * Clínica demo pública (mismo id que `reset_demo_clinic()`, migración
 * 20260815190000). Fijo porque solo hay una instancia demo.
 */
const DEMO_CLINIC_ID = "20cea989-de9b-4a3e-852a-31347dc3fe83";
const DEMO_TIMEZONE = "America/Santiago";

function yyyymmddInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

/**
 * Auto-reset de la clínica demo bajo demanda: el cron diario de Vercel
 * (vercel.json) llama a `/api/demo-reset`, pero depende de que
 * CRON_SECRET esté configurado — si no lo está (o el cron falla por
 * cualquier otro motivo), la demo se queda pegada en la fecha del último
 * reset manual y las citas "de hoy" quedan vacías apenas pasa un día real.
 * Este server fn corre en el mismo click de "Entrar a la demo" (src/routes/
 * demo.tsx): compara la fecha de `clinics.created_at` (se reescribe en cada
 * reset porque la función hace DELETE+INSERT de la fila) contra "hoy" en
 * el timezone de la demo, y si no coinciden dispara el mismo RPC que el
 * cron. Así la demo se autocura en el primer visitante del día sin
 * depender de que el cron esté bien configurado.
 */
export const ensureDemoClinicFresh = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("created_at")
    .eq("id", DEMO_CLINIC_ID)
    .maybeSingle();

  const today = yyyymmddInTz(new Date(), DEMO_TIMEZONE);
  const lastReset = clinic?.created_at
    ? yyyymmddInTz(new Date(clinic.created_at), DEMO_TIMEZONE)
    : null;

  if (lastReset === today) return { reset: false };

  const { error } = await supabaseAdmin.rpc("reset_demo_clinic");
  if (error) {
    console.error("[demo-fresh] reset_demo_clinic failed", error.message);
    return { reset: false };
  }
  return { reset: true };
});
