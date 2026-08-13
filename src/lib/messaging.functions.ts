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
          paciente: patient.full_name,
          ...data.variables,
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
          paciente: patient.full_name,
          ...data.variables,
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

// Re-export para consumidores que solo importan de este módulo
export { MESSAGE_CHANNELS };
