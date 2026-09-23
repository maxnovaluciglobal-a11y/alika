import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mensajeDb } from "@/lib/db-errors";
import { LAB_ORDER_STATUSES, type LabOrderStatus } from "@/lib/finance/finance";
import {
  LAB_PORTAL_COOKIE_MAX_AGE_SECONDS,
  LAB_PORTAL_COOKIE_NAME,
  signLabToken,
  verifyLabToken,
  type LabTokenClaims,
} from "@/lib/clinic-operations/lab-portal-token.server";

/**
 * Portal externo de laboratorio (gap de la auditoría comparativa vs.
 * SuperClini, 22-sep-2026): hasta ahora `lab_orders` era gestión INTERNA —
 * el staff registraba lo que sabía del laboratorio, pero el laboratorio no
 * tenía forma de entrar y actualizar su propia orden.
 *
 * Mismo patrón que el portal del paciente (Wave C): link firmado sin login,
 * cookie de sesión HttpOnly después de abrirlo una vez. Deliberadamente sin
 * audit log dedicado (a diferencia del portal de paciente) — acá no hay PHI
 * clínica, solo descripción del trabajo y piezas.
 */

// ─── Cara clínica: generar el link ──────────────────────────────────────

export const generateLabPortalLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        labId: z.string().uuid(),
        baseUrl: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    // RLS ya cubre: el select falla si el user no es miembro de la clínica.
    const { data: lab, error } = await context.supabase
      .from("labs")
      .select("id")
      .eq("clinic_id", data.clinicId)
      .eq("id", data.labId)
      .maybeSingle();
    if (error) throw new Error(mensajeDb(error, "No pudimos verificar el laboratorio."));
    if (!lab) throw new Error("Ese laboratorio no existe.");

    const token = await signLabToken({ labId: data.labId, clinicId: data.clinicId });
    return { url: `${data.baseUrl.replace(/\/$/, "")}/portal-laboratorio/${token}` };
  });

// ─── Cara del laboratorio: sesión + órdenes ──────────────────────────────

function readLabPortalCookie(): string | null {
  const req = getRequest();
  const cookieHeader = req?.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${LAB_PORTAL_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

async function requireLabPortalSession(): Promise<LabTokenClaims> {
  const token = readLabPortalCookie();
  if (!token) throw new Error("Portal no autorizado.");
  try {
    return await verifyLabToken(token);
  } catch {
    throw new Error("Sesión del portal vencida. Pedí un enlace nuevo a la clínica.");
  }
}

export const openLabPortalSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(20) }).parse(input))
  .handler(async ({ data }) => {
    const payload = await verifyLabToken(data.token);
    const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    setResponseHeader(
      "Set-Cookie",
      `${LAB_PORTAL_COOKIE_NAME}=${encodeURIComponent(data.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${LAB_PORTAL_COOKIE_MAX_AGE_SECONDS}${secureFlag}`,
    );
    return { ok: true, labId: payload.labId };
  });

const LAB_PORTAL_ORDER_COLUMNS =
  "id, patient_id, description, tooth_numbers, status, sent_on, due_on, received_on, notes";

export interface LabPortalOrder {
  id: string;
  patientName: string;
  description: string;
  toothNumbers: number[] | null;
  status: LabOrderStatus;
  sentOn: string;
  dueOn: string | null;
  receivedOn: string | null;
  notes: string | null;
}

/** Órdenes del laboratorio autenticado — todas, no solo las pendientes: el
 * laboratorio también necesita ver su propio historial de entregadas. */
export const getMyLabPortalOrders = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ labName: string; clinicName: string; orders: LabPortalOrder[] }> => {
    const { labId, clinicId } = await requireLabPortalSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: lab }, { data: clinic }, { data: rows, error }] = await Promise.all([
      supabaseAdmin.from("labs").select("name").eq("id", labId).maybeSingle(),
      supabaseAdmin.from("clinics").select("name").eq("id", clinicId).maybeSingle(),
      supabaseAdmin
        .from("lab_orders")
        .select(LAB_PORTAL_ORDER_COLUMNS)
        .eq("clinic_id", clinicId)
        .eq("lab_id", labId)
        .order("sent_on", { ascending: false }),
    ]);
    if (error) throw new Error(mensajeDb(error, "No pudimos cargar las órdenes."));

    const patientIds = [...new Set((rows ?? []).map((r) => r.patient_id))];
    const nombres = new Map<string, string>();
    if (patientIds.length) {
      const { data: pacientes } = await supabaseAdmin
        .from("patients")
        .select("id, full_name")
        .in("id", patientIds);
      for (const p of pacientes ?? []) nombres.set(p.id, p.full_name);
    }

    return {
      labName: lab?.name ?? "Tu laboratorio",
      clinicName: clinic?.name ?? "la clínica",
      orders: (rows ?? []).map((r) => ({
        id: r.id,
        patientName: nombres.get(r.patient_id) ?? "Paciente",
        description: r.description,
        toothNumbers: r.tooth_numbers,
        status: r.status,
        sentOn: r.sent_on,
        dueOn: r.due_on,
        receivedOn: r.received_on,
        notes: r.notes,
      })),
    };
  },
);

/**
 * El laboratorio solo puede mover su propia orden a `en_proceso` o
 * `recibido` — nunca a `enviado` (eso lo decide la clínica al crearla) ni a
 * `cancelado` (decisión de la clínica, no del taller). `reprocesar` tampoco:
 * es la clínica devolviendo el trabajo, no el laboratorio marcándolo.
 */
const ESTADOS_PERMITIDOS_AL_LABORATORIO: LabOrderStatus[] = ["en_proceso", "recibido"];

export const updateLabOrderStatusFromPortal = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        status: z.enum(LAB_ORDER_STATUSES),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { labId, clinicId } = await requireLabPortalSession();
    if (!ESTADOS_PERMITIDOS_AL_LABORATORIO.includes(data.status)) {
      throw new Error("Ese cambio de estado lo hace la clínica, no el laboratorio.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("lab_orders")
      .select("id, lab_id, clinic_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (fetchError) throw new Error(mensajeDb(fetchError, "No pudimos leer la orden."));
    if (!order || order.lab_id !== labId || order.clinic_id !== clinicId) {
      throw new Error("Esa orden no pertenece a tu laboratorio.");
    }

    const { error } = await supabaseAdmin
      .from("lab_orders")
      .update({
        status: data.status,
        received_on: data.status === "recibido" ? new Date().toISOString().slice(0, 10) : null,
      })
      .eq("id", data.orderId);
    if (error) throw new Error(mensajeDb(error, "No pudimos actualizar el estado."));
    return { ok: true };
  });
