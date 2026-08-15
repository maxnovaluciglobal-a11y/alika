import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MESSAGE_CHANNELS,
  MESSAGE_TEMPLATE_KINDS,
  buildWaMeUrl,
  renderTemplate,
  type Message,
  type MessageTemplate,
} from "@/lib/messaging";

const MESSAGE_COLUMNS =
  "id, appointment_id, quote_id, template_id, template_kind, channel, status, recipient, body, sent_at, created_at";
const TEMPLATE_COLUMNS = "id, kind, name, channel, body, is_active";

type MessageRow = {
  id: string;
  appointment_id: string | null;
  quote_id: string | null;
  template_id: string | null;
  template_kind: string | null;
  channel: string;
  status: string;
  recipient: string;
  body: string;
  sent_at: string | null;
  created_at: string;
};

type TemplateRow = {
  id: string;
  kind: string;
  name: string;
  channel: string;
  body: string;
  is_active: boolean;
};

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    quoteId: row.quote_id,
    templateId: row.template_id,
    templateKind: row.template_kind as Message["templateKind"],
    channel: row.channel as Message["channel"],
    status: row.status as Message["status"],
    recipient: row.recipient,
    body: row.body,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

function mapTemplate(row: TemplateRow): MessageTemplate {
  return {
    id: row.id,
    kind: row.kind as MessageTemplate["kind"],
    name: row.name,
    channel: row.channel as MessageTemplate["channel"],
    body: row.body,
    isActive: row.is_active,
  };
}

/** Templates activos de la clínica. */
export const listMessageTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<MessageTemplate[]> => {
    const { data: rows, error } = await context.supabase
      .from("message_templates")
      .select(TEMPLATE_COLUMNS)
      .eq("clinic_id", data.clinicId)
      .eq("is_active", true)
      .order("kind", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => mapTemplate(r as TemplateRow));
  });

/** Historial de mensajes del paciente (más reciente primero). */
export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), patientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Message[]> => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("clinic_id", data.clinicId)
      .eq("patient_id", data.patientId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => mapMessage(r as MessageRow));
  });

/**
 * Envío por WhatsApp usando link wa.me — sin proveedor externo, cero costo.
 * Renderiza el template con las variables provistas, guarda el mensaje en la
 * DB con status='sent' (asumimos que si el usuario abrió el link lo mandó),
 * y devuelve la URL de wa.me para que el cliente la abra en una tab nueva.
 * Cuando integremos API real (Fase 4B), cambiar el status a 'queued' acá y
 * poner el envío detrás de una cola con retries.
 */
export const sendWhatsAppFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        patientId: z.string().uuid(),
        templateId: z.string().uuid().optional(),
        templateKind: z.enum(MESSAGE_TEMPLATE_KINDS).optional(),
        variables: z.record(z.string(), z.string()).default({}),
        // Alternativa: mensaje libre, ignora template
        rawBody: z.string().trim().max(1500).optional(),
        appointmentId: z.string().uuid().optional(),
        quoteId: z.string().uuid().optional(),
        // Sobrescribe teléfono del paciente si hace falta (segunda línea, etc.)
        recipientOverride: z.string().trim().optional(),
      })
      .refine((v) => v.templateId || v.templateKind || v.rawBody, {
        message: "Necesitás pasar template o rawBody.",
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ id: string; waUrl: string | null; body: string; recipient: string }> => {
      const { supabase, userId } = context;

      // Traer paciente para número y nombre
      const { data: patient, error: patientErr } = await supabase
        .from("patients")
        .select("full_name, phone")
        .eq("clinic_id", data.clinicId)
        .eq("id", data.patientId)
        .maybeSingle();
      if (patientErr) throw new Error(patientErr.message);
      if (!patient) throw new Error("Paciente no encontrado.");

      const recipient = (data.recipientOverride ?? patient.phone ?? "").trim();
      if (!recipient) {
        throw new Error("El paciente no tiene teléfono cargado y no se pasó otro destino.");
      }

      // Resolver template
      let templateId: string | null = data.templateId ?? null;
      let templateKind: (typeof MESSAGE_TEMPLATE_KINDS)[number] | null = data.templateKind ?? null;
      let body: string;
      if (data.rawBody) {
        body = renderTemplate(data.rawBody, {
          ...data.variables,
          paciente: patient.full_name,
        });
      } else {
        let templateQuery = supabase
          .from("message_templates")
          .select("id, kind, body")
          .eq("clinic_id", data.clinicId)
          .eq("is_active", true)
          .limit(1);
        if (data.templateId) {
          templateQuery = templateQuery.eq("id", data.templateId);
        } else if (data.templateKind) {
          templateQuery = templateQuery.eq("kind", data.templateKind);
        }
        const { data: template, error: templateErr } = await templateQuery.maybeSingle();
        if (templateErr) throw new Error(templateErr.message);
        if (!template) throw new Error("Template no encontrado o inactivo.");
        templateId = template.id;
        templateKind = template.kind as (typeof MESSAGE_TEMPLATE_KINDS)[number];
        body = renderTemplate(template.body, {
          ...data.variables,
          paciente: patient.full_name,
        });
      }

      const nowIso = new Date().toISOString();
      const { data: inserted, error: insertErr } = await supabase
        .from("messages")
        .insert({
          clinic_id: data.clinicId,
          patient_id: data.patientId,
          appointment_id: data.appointmentId ?? null,
          quote_id: data.quoteId ?? null,
          template_id: templateId,
          template_kind: templateKind,
          channel: "whatsapp",
          direction: "outbound",
          status: "sent",
          recipient,
          body,
          sent_at: nowIso,
          sent_by: userId,
        })
        .select("id")
        .single();

      if (insertErr) throw new Error("No pudimos registrar el mensaje. " + insertErr.message);

      const waUrl = buildWaMeUrl(recipient, body);
      return { id: inserted.id, waUrl, body, recipient };
    },
  );

const DEFAULT_TIMEZONE = "America/Santiago";
const HORA_48H_MS = 48 * 60 * 60 * 1000;
const HORA_3H_MS = 3 * 60 * 60 * 1000;
// Ventanas alrededor de cada hito: se revisa periódicamente (no a un
// segundo exacto), así que hace falta margen para no perderse una cita
// entre dos visitas a la página.
const MARGEN_MS = 4 * 60 * 60 * 1000;

function formatFechaHoraLocal(iso: string, timeZone: string): { fechaLarga: string; hora: string } {
  const date = new Date(iso);
  const fechaLarga = new Intl.DateTimeFormat("es-CL", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  const hora = new Intl.DateTimeFormat("es-CL", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return { fechaLarga, hora };
}

export interface PendingReminder {
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  treatmentLabel: string;
  professionalName: string;
  startsAt: string;
  fechaLarga: string;
  hora: string;
  /** Cuál de los dos avisos le falta a esta cita. */
  reminderKind: "appointment_reminder" | "appointment_checkin";
}

/**
 * Cola de recordatorios: citas futuras que están entrando a la ventana de
 * 48h o de 3h y todavía no tienen un mensaje de ese tipo registrado. No hay
 * envío automático (sin Twilio, sin cron) — esto solo arma la lista para que
 * el staff la despache a mano con un click por fila, reusando
 * sendWhatsAppFromTemplate (mismo wa.me de siempre).
 */
export const listPendingReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PendingReminder[]> => {
    const { supabase } = context;
    const ahora = Date.now();
    const desde3h = new Date(ahora + HORA_3H_MS - MARGEN_MS).toISOString();
    const hasta48h = new Date(ahora + HORA_48H_MS + MARGEN_MS).toISOString();

    const { data: appts, error } = await supabase
      .from("appointments")
      .select("id, patient_id, professional_id, branch_id, treatment_label, starts_at")
      .eq("clinic_id", data.clinicId)
      .neq("status", "cancelada")
      .gte("starts_at", desde3h)
      .lte("starts_at", hasta48h)
      .order("starts_at", { ascending: true });
    if (error) throw new Error(error.message);

    const candidatas = (appts ?? [])
      .map((a) => {
        const faltaMs = new Date(a.starts_at).getTime() - ahora;
        // Más cerca de la ventana de 3h que de la de 48h → es el aviso corto.
        const reminderKind: PendingReminder["reminderKind"] =
          Math.abs(faltaMs - HORA_3H_MS) < Math.abs(faltaMs - HORA_48H_MS)
            ? "appointment_checkin"
            : "appointment_reminder";
        return { ...a, reminderKind };
      })
      .filter(
        (a) =>
          (a.reminderKind === "appointment_checkin" &&
            new Date(a.starts_at).getTime() - ahora <= HORA_3H_MS + MARGEN_MS) ||
          (a.reminderKind === "appointment_reminder" &&
            new Date(a.starts_at).getTime() - ahora >= HORA_3H_MS + MARGEN_MS),
      );
    if (candidatas.length === 0) return [];

    const appointmentIds = candidatas.map((a) => a.id);
    const { data: enviados, error: msgError } = await supabase
      .from("messages")
      .select("appointment_id, template_kind")
      .eq("clinic_id", data.clinicId)
      .in("appointment_id", appointmentIds)
      .in("template_kind", ["appointment_reminder", "appointment_checkin"]);
    if (msgError) throw new Error(msgError.message);

    const yaEnviado = new Set(
      (enviados ?? []).map((m) => `${m.appointment_id}:${m.template_kind}`),
    );
    const pendientes = candidatas.filter((a) => !yaEnviado.has(`${a.id}:${a.reminderKind}`));
    if (pendientes.length === 0) return [];

    const patientIds = [...new Set(pendientes.map((a) => a.patient_id))];
    const professionalIds = [...new Set(pendientes.map((a) => a.professional_id))];
    const branchIds = [...new Set(pendientes.map((a) => a.branch_id))];

    const [
      { data: patients, error: pErr },
      { data: professionals, error: profErr },
      { data: branches, error: branchErr },
    ] = await Promise.all([
      supabase
        .from("patients")
        .select("id, full_name, phone")
        .in("id", patientIds.length ? patientIds : [""]),
      supabase
        .from("professionals")
        .select("id, full_name")
        .in("id", professionalIds.length ? professionalIds : [""]),
      supabase
        .from("branches")
        .select("id, timezone")
        .in("id", branchIds.length ? branchIds : [""]),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (profErr) throw new Error(profErr.message);
    if (branchErr) throw new Error(branchErr.message);

    const patientById = new Map((patients ?? []).map((p) => [p.id, p]));
    const profNameById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]));
    const tzByBranch = new Map((branches ?? []).map((b) => [b.id, b.timezone]));

    return pendientes.map((a) => {
      const patient = patientById.get(a.patient_id);
      const { fechaLarga, hora } = formatFechaHoraLocal(
        a.starts_at,
        tzByBranch.get(a.branch_id) || DEFAULT_TIMEZONE,
      );
      return {
        appointmentId: a.id,
        patientId: a.patient_id,
        patientName: patient?.full_name ?? "Paciente",
        patientPhone: patient?.phone ?? null,
        treatmentLabel: a.treatment_label || "Consulta",
        professionalName: profNameById.get(a.professional_id) ?? "—",
        startsAt: a.starts_at,
        fechaLarga,
        hora,
        reminderKind: a.reminderKind,
      };
    });
  });

// Re-export para consumidores que solo importan de este módulo
export { MESSAGE_CHANNELS };
