import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MESSAGE_CHANNELS,
  MESSAGE_TEMPLATE_KINDS,
  OUTREACH_TEMPLATE_KINDS,
  buildWaMeUrl,
  renderTemplate,
  type Message,
  type MessageTemplate,
  type OutreachTemplateKind,
} from "@/lib/messaging";
import { tryMetaTemplateSend } from "@/lib/whatsapp.functions";

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
    }): Promise<{
      id: string;
      waUrl: string | null;
      body: string;
      recipient: string;
      /** true si se mandó de verdad por la Cloud API (no hay wa.me que abrir). */
      viaApi: boolean;
    }> => {
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
      // Datos de la plantilla en Meta (nombre registrado + idioma), solo si
      // se resolvió un template real (rawBody no puede ir por Cloud API:
      // fuera de la ventana de 24h, Meta exige una plantilla pre-aprobada,
      // nunca texto libre).
      let metaTemplate: { name: string; language: string } | null = null;
      if (data.rawBody) {
        body = renderTemplate(data.rawBody, {
          ...data.variables,
          paciente: patient.full_name,
        });
      } else {
        let templateQuery = supabase
          .from("message_templates")
          .select("id, kind, body, meta_template_name, meta_language, meta_status")
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
        if (template.meta_status === "approved" && template.meta_template_name) {
          metaTemplate = { name: template.meta_template_name, language: template.meta_language };
        }
      }

      // Intento de envío real por Cloud API — helper compartido con
      // generatePortalLink (portal.functions.ts). Si falta WABA conectado,
      // plantilla aprobada, o el POST a Meta falla, cae a wa.me solo.
      const attempt = templateKind
        ? await tryMetaTemplateSend({
            supabase,
            clinicId: data.clinicId,
            templateKind,
            metaTemplate,
            recipientRaw: recipient,
            variables: { ...data.variables, paciente: patient.full_name },
          })
        : { viaApi: false, externalId: null };
      const { viaApi, externalId } = attempt;

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
          external_id: externalId,
          sent_at: nowIso,
          sent_by: userId,
        })
        .select("id")
        .single();

      if (insertErr) throw new Error("No pudimos registrar el mensaje. " + insertErr.message);

      const waUrl = viaApi ? null : buildWaMeUrl(recipient, body);
      return { id: inserted.id, waUrl, body, recipient, viaApi };
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

// ─────────────────────────────────────────────────────────────────────────
// Fase 1: cola de outreach (recall de higiene / pedido de reseña / saldo
// pendiente). A diferencia de listPendingReminders (ligada 1:1 a una cita
// futura), estos candidatos se calculan sobre histórico. Por decisión de
// Walter, NUNCA se mandan solos desde un cron — se arman acá y el staff los
// despacha a mano en /recordatorios con el mismo WhatsAppButton de siempre
// (que ahora intenta la API real y cae a wa.me si no hay número conectado).
// ─────────────────────────────────────────────────────────────────────────

const HYGIENE_RECALL_AFTER_MS = 182 * 24 * 60 * 60 * 1000; // ~6 meses
const HYGIENE_RECALL_COOLDOWN_MS = 150 * 24 * 60 * 60 * 1000; // no re-sugerir antes de esto
const REVIEW_REQUEST_MIN_DELAY_MS = 2 * 60 * 60 * 1000; // 2h después de la cita
const REVIEW_REQUEST_MAX_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // no revivir visitas viejas
const PAYMENT_DUE_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const QUOTE_FOLLOW_UP_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // presupuesto enviado hace +7 días
const QUOTE_FOLLOW_UP_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // no repetir el nudge antes de esto
const BIRTHDAY_COOLDOWN_MS = 300 * 24 * 60 * 60 * 1000; // no repetir en el mismo año
const TREATMENT_FOLLOWUP_MIN_DELAY_MS = 2 * 24 * 60 * 60 * 1000; // 2 días después de completado
const TREATMENT_FOLLOWUP_MAX_WINDOW_MS = 10 * 24 * 60 * 60 * 1000; // no revivir tratamientos viejos
const REFERRAL_INVITE_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

export interface PendingOutreachItem {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  kind: OutreachTemplateKind;
  // hygiene_recall
  monthsSinceLastVisit?: number;
  // review_request (dedupe es por cita, no por paciente — cada visita puede pedir su propia reseña)
  appointmentId?: string;
  treatmentLabel?: string;
  // payment_due
  balanceCents?: number;
  currency?: string;
  // quote_follow_up (dedupe es por presupuesto, no por paciente)
  quoteId?: string;
  quoteNumber?: string;
  quoteTotalCents?: number;
  // referral_invite
  referralCode?: string;
}

/**
 * Candidatos de recall/reseña/saldo, ya filtrados por opt-in y por cooldown
 * (no repetir la misma sugerencia todos los días). Solo pacientes con
 * wa_opt_in=true y sin wa_opt_out_at — a diferencia de los recordatorios de
 * cita (transaccionales a una reserva que el paciente ya hizo), esto es
 * outreach proactivo y necesita consentimiento explícito.
 */
export const listPendingOutreach = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PendingOutreachItem[]> => {
    const { supabase } = context;
    const clinicId = data.clinicId;
    const ahora = Date.now();

    const [
      { data: optedInPatients, error: patErr },
      { data: finalizadas, error: apptErr },
      { data: futuras, error: futErr },
      { data: recentOutreach, error: msgErr },
      { data: billedRows, error: billErr },
      { data: paidRows, error: paidErr },
      { data: clinic, error: clinicErr },
      { data: sentQuotes, error: quoteErr },
      { data: completedItems, error: completedErr },
    ] = await Promise.all([
      supabase
        .from("patients")
        .select("id, full_name, phone, birth_date, referral_code")
        .eq("clinic_id", clinicId)
        .eq("wa_opt_in", true)
        .is("wa_opt_out_at", null),
      supabase
        .from("appointments")
        .select("id, patient_id, treatment_label, ends_at")
        .eq("clinic_id", clinicId)
        .eq("status", "finalizada")
        .order("ends_at", { ascending: false })
        .limit(2000),
      supabase
        .from("appointments")
        .select("patient_id")
        .eq("clinic_id", clinicId)
        .neq("status", "cancelada")
        .gt("starts_at", new Date(ahora).toISOString()),
      supabase
        .from("messages")
        .select("patient_id, appointment_id, quote_id, template_kind, created_at")
        .eq("clinic_id", clinicId)
        .in("template_kind", [...OUTREACH_TEMPLATE_KINDS])
        .order("created_at", { ascending: false })
        .limit(3000),
      supabase
        .from("treatment_items")
        .select("price_cents, treatment_plans!inner(patient_id, clinic_id, status)")
        .eq("clinic_id", clinicId)
        .neq("treatment_plans.status", "cancelled"),
      supabase.from("payments").select("patient_id, amount_cents").eq("clinic_id", clinicId),
      supabase.from("clinics").select("currency").eq("id", clinicId).single(),
      supabase
        .from("quotes")
        .select("id, patient_id, number, total_cents, currency, sent_at")
        .eq("clinic_id", clinicId)
        .eq("status", "sent")
        .not("sent_at", "is", null),
      supabase
        .from("treatment_items")
        .select("name_snapshot, completed_at, treatment_plans!inner(patient_id, clinic_id)")
        .eq("clinic_id", clinicId)
        .eq("status", "completed")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(2000),
    ]);
    if (patErr) throw new Error(patErr.message);
    if (apptErr) throw new Error(apptErr.message);
    if (futErr) throw new Error(futErr.message);
    if (msgErr) throw new Error(msgErr.message);
    if (billErr) throw new Error(billErr.message);
    if (completedErr) throw new Error(completedErr.message);
    if (paidErr) throw new Error(paidErr.message);
    if (clinicErr) throw new Error(clinicErr.message);
    if (quoteErr) throw new Error(quoteErr.message);

    const patientById = new Map((optedInPatients ?? []).map((p) => [p.id, p]));
    const patientsWithFuture = new Set((futuras ?? []).map((f) => f.patient_id));

    // Última visita finalizada por paciente (ya viene ordenado desc, nos quedamos con la primera ocurrencia).
    const lastVisitByPatient = new Map<string, string>();
    for (const a of finalizadas ?? []) {
      if (!lastVisitByPatient.has(a.patient_id)) lastVisitByPatient.set(a.patient_id, a.ends_at);
    }

    // Cooldown: último hygiene_recall/payment_due/birthday_greeting/
    // treatment_followup/referral_invite por paciente, último quote_follow_up
    // por presupuesto, review_request por cita.
    const lastHygieneRecallByPatient = new Map<string, string>();
    const lastPaymentDueByPatient = new Map<string, string>();
    const lastQuoteFollowUpByQuote = new Map<string, string>();
    const lastBirthdayByPatient = new Map<string, string>();
    const lastTreatmentFollowupByPatient = new Map<string, string>();
    const lastReferralInviteByPatient = new Map<string, string>();
    const reviewRequestedAppointments = new Set<string>();
    for (const m of recentOutreach ?? []) {
      if (m.template_kind === "hygiene_recall" && !lastHygieneRecallByPatient.has(m.patient_id)) {
        lastHygieneRecallByPatient.set(m.patient_id, m.created_at);
      }
      if (m.template_kind === "payment_due" && !lastPaymentDueByPatient.has(m.patient_id)) {
        lastPaymentDueByPatient.set(m.patient_id, m.created_at);
      }
      if (
        m.template_kind === "quote_follow_up" &&
        m.quote_id &&
        !lastQuoteFollowUpByQuote.has(m.quote_id)
      ) {
        lastQuoteFollowUpByQuote.set(m.quote_id, m.created_at);
      }
      if (m.template_kind === "birthday_greeting" && !lastBirthdayByPatient.has(m.patient_id)) {
        lastBirthdayByPatient.set(m.patient_id, m.created_at);
      }
      if (
        m.template_kind === "treatment_followup" &&
        !lastTreatmentFollowupByPatient.has(m.patient_id)
      ) {
        lastTreatmentFollowupByPatient.set(m.patient_id, m.created_at);
      }
      if (m.template_kind === "referral_invite" && !lastReferralInviteByPatient.has(m.patient_id)) {
        lastReferralInviteByPatient.set(m.patient_id, m.created_at);
      }
      if (m.template_kind === "review_request" && m.appointment_id) {
        reviewRequestedAppointments.add(m.appointment_id);
      }
    }

    const items: PendingOutreachItem[] = [];

    // ── hygiene_recall ──
    for (const [patientId, lastVisitIso] of lastVisitByPatient) {
      const patient = patientById.get(patientId);
      if (!patient) continue; // sin opt-in, o no existe
      if (patientsWithFuture.has(patientId)) continue; // ya viene de vuelta
      const sinceMs = ahora - new Date(lastVisitIso).getTime();
      if (sinceMs < HYGIENE_RECALL_AFTER_MS) continue;
      const lastSent = lastHygieneRecallByPatient.get(patientId);
      if (lastSent && ahora - new Date(lastSent).getTime() < HYGIENE_RECALL_COOLDOWN_MS) continue;
      items.push({
        patientId,
        patientName: patient.full_name,
        patientPhone: patient.phone,
        kind: "hygiene_recall",
        monthsSinceLastVisit: Math.floor(sinceMs / (30 * 24 * 60 * 60 * 1000)),
      });
    }

    // ── review_request ──
    for (const a of finalizadas ?? []) {
      const patient = patientById.get(a.patient_id);
      if (!patient) continue;
      const sinceMs = ahora - new Date(a.ends_at).getTime();
      if (sinceMs < REVIEW_REQUEST_MIN_DELAY_MS || sinceMs > REVIEW_REQUEST_MAX_WINDOW_MS) continue;
      if (reviewRequestedAppointments.has(a.id)) continue;
      items.push({
        patientId: a.patient_id,
        patientName: patient.full_name,
        patientPhone: patient.phone,
        kind: "review_request",
        appointmentId: a.id,
        treatmentLabel: a.treatment_label || "Consulta",
      });
    }

    // ── payment_due ──
    const balanceByPatient = new Map<string, number>();
    for (const r of billedRows ?? []) {
      const patientId = (r as unknown as { treatment_plans: { patient_id: string } })
        .treatment_plans.patient_id;
      const priceCents = (r as { price_cents: number }).price_cents ?? 0;
      balanceByPatient.set(patientId, (balanceByPatient.get(patientId) ?? 0) + priceCents);
    }
    for (const r of paidRows ?? []) {
      balanceByPatient.set(
        r.patient_id,
        (balanceByPatient.get(r.patient_id) ?? 0) - (r.amount_cents ?? 0),
      );
    }
    const currency = clinic?.currency ?? "CLP";
    for (const [patientId, balanceCents] of balanceByPatient) {
      if (balanceCents <= 0) continue;
      const patient = patientById.get(patientId);
      if (!patient) continue;
      const lastSent = lastPaymentDueByPatient.get(patientId);
      if (lastSent && ahora - new Date(lastSent).getTime() < PAYMENT_DUE_COOLDOWN_MS) continue;
      items.push({
        patientId,
        patientName: patient.full_name,
        patientPhone: patient.phone,
        kind: "payment_due",
        balanceCents,
        currency,
      });
    }

    // ── quote_follow_up ──
    for (const q of sentQuotes ?? []) {
      if (!q.sent_at) continue; // ya filtrado por la query, pero TS no lo sabe
      const patient = patientById.get(q.patient_id);
      if (!patient) continue;
      const sinceMs = ahora - new Date(q.sent_at).getTime();
      if (sinceMs < QUOTE_FOLLOW_UP_AFTER_MS) continue;
      const lastSent = lastQuoteFollowUpByQuote.get(q.id);
      if (lastSent && ahora - new Date(lastSent).getTime() < QUOTE_FOLLOW_UP_COOLDOWN_MS) continue;
      items.push({
        patientId: q.patient_id,
        patientName: patient.full_name,
        patientPhone: patient.phone,
        kind: "quote_follow_up",
        quoteId: q.id,
        quoteNumber: q.number,
        quoteTotalCents: q.total_cents,
        currency: q.currency,
      });
    }

    // ── birthday_greeting ── (marketing: solo pacientes opt-in, comparación
    // por mes/día en UTC — no hace falta precisión de huso horario para esto).
    const hoy = new Date(ahora);
    const mesHoy = hoy.getUTCMonth();
    const diaHoy = hoy.getUTCDate();
    for (const patient of optedInPatients ?? []) {
      if (!patient.birth_date) continue;
      const nacimiento = new Date(patient.birth_date);
      if (nacimiento.getUTCMonth() !== mesHoy || nacimiento.getUTCDate() !== diaHoy) continue;
      const lastSent = lastBirthdayByPatient.get(patient.id);
      if (lastSent && ahora - new Date(lastSent).getTime() < BIRTHDAY_COOLDOWN_MS) continue;
      items.push({
        patientId: patient.id,
        patientName: patient.full_name,
        patientPhone: patient.phone,
        kind: "birthday_greeting",
      });
    }

    // ── treatment_followup ── (utility: seguimiento genérico de una visita
    // real, no instrucciones clínicas por tipo de procedimiento — eso lo
    // debería redactar un dentista, no fabricarlo acá). Un candidato por
    // paciente, el tratamiento completado más reciente (ya viene ordenado
    // desc, nos quedamos con la primera ocurrencia).
    const lastCompletedByPatient = new Map<string, { completedAt: string; label: string }>();
    for (const item of completedItems ?? []) {
      const patientId = (item as unknown as { treatment_plans: { patient_id: string } })
        .treatment_plans.patient_id;
      if (!lastCompletedByPatient.has(patientId)) {
        lastCompletedByPatient.set(patientId, {
          completedAt: (item as { completed_at: string }).completed_at,
          label: item.name_snapshot,
        });
      }
    }
    for (const [patientId, { completedAt, label }] of lastCompletedByPatient) {
      const patient = patientById.get(patientId);
      if (!patient) continue;
      const sinceMs = ahora - new Date(completedAt).getTime();
      if (sinceMs < TREATMENT_FOLLOWUP_MIN_DELAY_MS || sinceMs > TREATMENT_FOLLOWUP_MAX_WINDOW_MS) {
        continue;
      }
      const lastSent = lastTreatmentFollowupByPatient.get(patientId);
      if (lastSent && ahora - new Date(lastSent).getTime() < TREATMENT_FOLLOWUP_MAX_WINDOW_MS) {
        continue;
      }
      items.push({
        patientId,
        patientName: patient.full_name,
        patientPhone: patient.phone,
        kind: "treatment_followup",
        treatmentLabel: label,
      });
    }

    // ── referral_invite ── (marketing: solo a quien ya vivió la clínica al
    // menos una vez — lastVisitByPatient ya filtra exactamente eso).
    for (const [patientId] of lastVisitByPatient) {
      const patient = patientById.get(patientId);
      if (!patient || !patient.referral_code) continue;
      const lastSent = lastReferralInviteByPatient.get(patientId);
      if (lastSent && ahora - new Date(lastSent).getTime() < REFERRAL_INVITE_COOLDOWN_MS) continue;
      items.push({
        patientId,
        patientName: patient.full_name,
        patientPhone: patient.phone,
        kind: "referral_invite",
        referralCode: patient.referral_code,
      });
    }

    return items;
  });

/** Prende/apaga el opt-in de WhatsApp del paciente. Lo apaga siempre puede cualquier operador; prenderlo requiere haberlo hablado con el paciente. */
export const setPatientWhatsAppOptIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ clinicId: z.string().uuid(), patientId: z.string().uuid(), optIn: z.boolean() })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<void> => {
    const nowIso = new Date().toISOString();
    const { error } = await context.supabase
      .from("patients")
      .update(
        data.optIn
          ? { wa_opt_in: true, wa_opt_in_at: nowIso, wa_opt_out_at: null }
          : { wa_opt_in: false, wa_opt_out_at: nowIso },
      )
      .eq("clinic_id", data.clinicId)
      .eq("id", data.patientId);
    if (error) throw new Error(error.message);
  });

// Re-export para consumidores que solo importan de este módulo
export { MESSAGE_CHANNELS };
