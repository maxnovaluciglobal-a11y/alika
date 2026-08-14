import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildWaMeUrl } from "@/lib/messaging";
import {
  PORTAL_COOKIE_MAX_AGE_SECONDS,
  PORTAL_COOKIE_NAME,
  signPortalToken,
  verifyPortalToken,
  type PortalTokenPayload,
} from "@/lib/portal-token.server";

// ────────────────────────────────────────────────────────────
// Cara clínica: generar link firmado + mandar por WhatsApp
// ────────────────────────────────────────────────────────────

/** Genera link firmado del portal para un paciente. Solo staff de la clínica. */
export const generatePortalLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        patientId: z.string().uuid(),
        baseUrl: z.string().url(),
        ttlDays: z.number().int().min(1).max(90).default(7),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ url: string; expiresInDays: number; waUrl: string | null }> => {
      // RLS ya cubre: el select fallará si el user no es miembro de la clínica.
      const { data: patient, error } = await context.supabase
        .from("patients")
        .select("id, full_name, phone")
        .eq("clinic_id", data.clinicId)
        .eq("id", data.patientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!patient) throw new Error("Paciente no encontrado o sin permisos.");

      const token = await signPortalToken(
        { patientId: patient.id, clinicId: data.clinicId },
        data.ttlDays,
      );
      const url = `${data.baseUrl.replace(/\/$/, "")}/portal/${token}`;

      const message =
        `Hola ${patient.full_name.split(" ")[0]}, este es tu acceso al portal de tu clínica. ` +
        `Podés ver tus próximas citas y pedir hora acá: ${url}\n\n` +
        `El link vence en ${data.ttlDays} día${data.ttlDays === 1 ? "" : "s"}.`;

      const waUrl = patient.phone ? buildWaMeUrl(patient.phone, message) : null;
      return { url, expiresInDays: data.ttlDays, waUrl };
    },
  );

// ────────────────────────────────────────────────────────────
// Cara paciente: middleware de sesión + fns del portal
// ────────────────────────────────────────────────────────────

function readPortalCookie(): string | null {
  const req = getRequest();
  const cookieHeader = req?.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${PORTAL_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

async function requirePortalSession(): Promise<PortalTokenPayload> {
  const token = readPortalCookie();
  if (!token) throw new Error("Portal no autorizado.");
  try {
    return await verifyPortalToken(token);
  } catch {
    throw new Error("Sesión del portal vencida.");
  }
}

/** Consume el token de la URL, valida, setea cookie. Se llama una vez al abrir /portal/[token]. */
export const openPortalSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(20) }).parse(input))
  .handler(async ({ data }) => {
    const payload = await verifyPortalToken(data.token);
    // Secure solo en producción — localhost sirve por http y el flag lo
    // bloquearía. Path=/ porque los server functions viven en /_serverFn/*
    // que no está bajo /portal; el cookie tiene que viajar en cualquier
    // request server-fn para que requirePortalSession() lo lea.
    const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    setResponseHeader(
      "Set-Cookie",
      `${PORTAL_COOKIE_NAME}=${encodeURIComponent(data.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${PORTAL_COOKIE_MAX_AGE_SECONDS}${secureFlag}`,
    );
    return { ok: true, patientId: payload.patientId };
  });

/** Datos del paciente en el portal (nombre + próximas citas + planes activos). */
export const getMyPortalOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { patientId, clinicId } = await requirePortalSession();

  // Cliente admin: el portal no tiene JWT de Supabase, va con service_role
  // + filtros explícitos por clinic_id + patient_id.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [
    { data: patient, error: pErr },
    { data: appts, error: aErr },
    { data: plans, error: plErr },
  ] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("id, full_name, phone, email")
      .eq("clinic_id", clinicId)
      .eq("id", patientId)
      .maybeSingle(),
    supabaseAdmin
      .from("appointments")
      .select("id, treatment_label, starts_at, ends_at, status, branch_id, professional_id")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .gte("starts_at", new Date().toISOString())
      .neq("status", "cancelada")
      .order("starts_at", { ascending: true })
      .limit(10),
    supabaseAdmin
      .from("treatment_plans")
      .select("id, name, status, currency, total_cents")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (aErr) throw new Error(aErr.message);
  if (plErr) throw new Error(plErr.message);
  if (!patient) throw new Error("Paciente no encontrado.");

  return {
    patient: { id: patient.id, name: patient.full_name },
    appointments: appts ?? [],
    plans: plans ?? [],
  };
});

/**
 * El paciente crea una solicitud de hora (entra a waitlist_entries con
 * status 'pending'). La clínica confirma manualmente asignando cita real.
 */
export const requestPortalAppointment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        preferredDate: z.string().min(1),
        reason: z.string().trim().min(1, "Contanos el motivo.").max(500),
        priority: z.enum(["baja", "media", "alta"]).default("media"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { patientId, clinicId } = await requirePortalSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inserted, error } = await supabaseAdmin
      .from("appointment_requests")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        preferred_date: data.preferredDate,
        reason: data.reason,
        priority: data.priority,
        source: "portal",
      })
      .select("id")
      .single();
    if (error) throw new Error("No pudimos registrar tu solicitud. " + error.message);
    return { id: inserted.id };
  });
