// src/lib/admin/clinicas.functions.ts
//
// Pantalla interna para que Walter marque "llamada hecha" después de la
// puesta en marcha con una clínica — ver `requiereLlamadaOSuscripcion` en
// billing.ts: mientras `onboarding_call_at` sea null, la clínica en trial
// tiene WhatsApp automático, portal del paciente y /efectividad bloqueados.
//
// Mismo gate que `listMarketingLeads` (leads.functions.ts): no hay rol
// "staff de la empresa" en el schema, así que la autorización real es la
// allowlist `ALIKA_STAFF_EMAILS`, ahora compartida vía
// `requireAlikaStaffEmail` (src/lib/admin/staff-gate.ts).
//
// Con `supabaseAdmin` (service_role) a propósito: RLS de `clinics` y
// `subscriptions` solo deja ver la propia clínica a sus miembros
// (`is_clinic_member`) — el staff de Alika no es miembro de ninguna.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAlikaStaffEmail } from "@/lib/admin/staff-gate";

export type ClinicaStaffRow = {
  id: string;
  name: string;
  createdAt: string;
  /** `null` = todavía no se creó fila en `subscriptions` para esta clínica
   *  (clínica piloto anterior al trigger — ver `requiereLlamadaOSuscripcion`). */
  subscriptionStatus: string | null;
  trialEnd: string | null;
  onboardingCallAt: string | null;
};

/** Clínicas + su suscripción + si ya se hizo la llamada de puesta en marcha.
 *  Dos queries + Map en vez de un embedded `select('subscriptions(...)')` —
 *  mismo criterio que el resto del repo (CLAUDE.md: "evitar embedded select
 *  cuando los tipos generados no lo pillen"). */
export const listClinicsForStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClinicaStaffRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAlikaStaffEmail(supabaseAdmin, context.userId);

    const { data: clinics, error } = await supabaseAdmin
      .from("clinics")
      .select("id, name, created_at, onboarding_call_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error("No pudimos cargar las clínicas.");

    const clinicIds = (clinics ?? []).map((c) => c.id);
    const { data: subs } = clinicIds.length
      ? await supabaseAdmin
          .from("subscriptions")
          .select("clinic_id, status, trial_end")
          .in("clinic_id", clinicIds)
      : { data: [] as { clinic_id: string; status: string; trial_end: string | null }[] };

    const subPorClinica = new Map((subs ?? []).map((s) => [s.clinic_id, s]));

    return (clinics ?? []).map((c) => {
      const sub = subPorClinica.get(c.id);
      return {
        id: c.id,
        name: c.name,
        createdAt: c.created_at,
        subscriptionStatus: sub?.status ?? null,
        trialEnd: sub?.trial_end ?? null,
        onboardingCallAt: c.onboarding_call_at,
      };
    });
  });

/**
 * Marca la llamada de puesta en marcha como hecha. Idempotente: si la
 * clínica ya tenía `onboarding_call_at` seteado, el `.is(...)` de abajo hace
 * que el UPDATE no toque ninguna fila en vez de pisar la fecha original —
 * mismo espíritu que `consent_at` en marketing_leads (evidencia de CUÁNDO
 * pasó algo, no un valor que un segundo click deba poder correr en el
 * tiempo).
 */
export const marcarLlamadaHecha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAlikaStaffEmail(supabaseAdmin, context.userId);

    const { error } = await supabaseAdmin
      .from("clinics")
      .update({ onboarding_call_at: new Date().toISOString() })
      .eq("id", data.clinicId)
      .is("onboarding_call_at", null);
    if (error) throw new Error("No pudimos marcar la llamada como hecha.");

    return { ok: true };
  });
