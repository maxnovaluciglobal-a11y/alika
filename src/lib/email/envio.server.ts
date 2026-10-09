/**
 * Envío de los correos de ciclo de vida a la CLÍNICA (dueños/administradores).
 *
 * ⚠️ Nunca a pacientes: este módulo no tiene ningún camino que lea la tabla
 * `patients` ni sus emails. Los destinatarios salen de `clinic_members`.
 *
 * Frenos, en orden (todos devuelven un resultado; nada lanza al llamador):
 *  1. Interruptor general: sin `LIFECYCLE_EMAILS_ENABLED=true` no hace nada,
 *     ni siquiera toca la base.
 *  2. Destinatario válido y fuera de dominios reservados (example.com, .test…).
 *  3. Configuración de Resend (`RESEND_API_KEY` + `EMAIL_FROM`).
 *  4. La clínica demo nunca recibe correos.
 *  5. Los no transaccionales respetan `notification_preferences`
 *     (`email_enabled = false` o `unsubscribed_at`) y llevan baja de un clic.
 *  6. Idempotencia en `lifecycle_emails`: se reclama la fila ANTES de enviar.
 *     Si la tabla todavía no existe (migración sin aplicar), se registra en
 *     el log y NO se envía: sin registro no hay garantía de no repetir.
 *  7. Modo de prueba: con `LIFECYCLE_EMAIL_REDIRECT_TO` todo va a esa
 *     dirección, con el asunto prefijado `[PRUEBA → original]`.
 */
import { Resend } from "resend";

import {
  ES_TRANSACCIONAL,
  MAX_INTENTOS,
  asuntoDePrueba,
  normalizarDestinatario,
  type LifecycleKind,
} from "./ciclo-de-vida";

type ClienteAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export interface CorreoParaClinica {
  clinicId: string;
  kind: LifecycleKind;
  periodKey: string;
  to: string;
  /** Usuario de Esmalia destinatario (obligatorio en los no transaccionales). */
  userId?: string | null;
  subject: string;
  html: string;
  text: string;
  /** Por defecto, el de `ES_TRANSACCIONAL[kind]`. */
  transactional?: boolean;
  /** Endpoint de baja de un clic (no transaccionales). */
  unsubscribeUrl?: string;
}

export type ResultadoEnvio =
  | { status: "disabled" }
  | { status: "sent"; providerId: string | null; redirectedTo: string | null }
  | { status: "duplicate" }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

export function correosHabilitados(): boolean {
  return process.env.LIFECYCLE_EMAILS_ENABLED === "true";
}

const UNIQUE_VIOLATION = "23505";

function log(msg: string, extra?: unknown) {
  console.warn(`[lifecycle-email] ${msg}`, extra ?? "");
}

export async function sendClinicEmail(
  correo: CorreoParaClinica,
  admin?: ClienteAdmin,
): Promise<ResultadoEnvio> {
  try {
    return await enviar(correo, admin);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log(`fallo inesperado (${correo.kind})`, reason);
    return { status: "error", reason };
  }
}

async function enviar(c: CorreoParaClinica, adminDado?: ClienteAdmin): Promise<ResultadoEnvio> {
  // 1. Interruptor general.
  if (!correosHabilitados()) return { status: "disabled" };

  // 2. Destinatario.
  const to = normalizarDestinatario(c.to);
  if (!to) return { status: "skipped", reason: "destinatario inválido o reservado" };

  // 3. Configuración de Resend.
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    log("falta RESEND_API_KEY o EMAIL_FROM");
    return { status: "skipped", reason: "envío de email no configurado" };
  }

  const transaccional = c.transactional ?? ES_TRANSACCIONAL[c.kind];
  if (!transaccional && (!c.userId || !c.unsubscribeUrl)) {
    return { status: "skipped", reason: "correo opcional sin enlace de baja" };
  }

  const admin = adminDado ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;

  // 4. Nunca la demo.
  const { data: clinica, error: clinicaErr } = await admin
    .from("clinics")
    .select("is_demo")
    .eq("id", c.clinicId)
    .maybeSingle();
  if (clinicaErr || !clinica) {
    log("no se pudo verificar la clínica", clinicaErr?.message);
    return { status: "skipped", reason: "clínica no verificada" };
  }
  if (clinica.is_demo) return { status: "skipped", reason: "clínica demo" };

  // 5. Preferencias (solo opcionales). Sin fila = se envía (opt-out).
  if (!transaccional && c.userId) {
    const { data: pref, error: prefErr } = await admin
      .from("notification_preferences")
      .select("email_enabled, unsubscribed_at")
      .eq("user_id", c.userId)
      .maybeSingle();
    if (prefErr) {
      log("no se pudieron leer las preferencias", prefErr.message);
      return { status: "skipped", reason: "preferencias ilegibles" };
    }
    if (pref && (!pref.email_enabled || pref.unsubscribed_at)) {
      return { status: "skipped", reason: "el destinatario se dio de baja" };
    }
  }

  // 6. Reclamar el envío.
  const redirectTo = normalizarDestinatario(process.env.LIFECYCLE_EMAIL_REDIRECT_TO);
  const fila = {
    clinic_id: c.clinicId,
    kind: c.kind,
    period_key: c.periodKey,
    recipient: to,
    user_id: c.userId ?? null,
    status: "pending",
    redirected_to: redirectTo,
  };
  const { data: insertada, error: insertErr } = await admin
    .from("lifecycle_emails")
    .insert(fila)
    .select("id")
    .maybeSingle();

  let filaId: string | null = insertada?.id ?? null;
  if (insertErr) {
    if (insertErr.code !== UNIQUE_VIOLATION) {
      log("sin registro de idempotencia; no se envía", insertErr.message);
      return { status: "skipped", reason: "tabla lifecycle_emails no disponible" };
    }
    // Ya existe: solo se reintenta un 'error' con intentos disponibles, y el
    // UPDATE condicional hace que dos corridas simultáneas no lo tomen las dos.
    const { data: previa } = await admin
      .from("lifecycle_emails")
      .select("id, status, attempts")
      .eq("clinic_id", c.clinicId)
      .eq("kind", c.kind)
      .eq("period_key", c.periodKey)
      .eq("recipient", to)
      .maybeSingle();
    if (!previa || previa.status !== "error" || previa.attempts >= MAX_INTENTOS) {
      return { status: "duplicate" };
    }
    const { data: retomada } = await admin
      .from("lifecycle_emails")
      .update({
        status: "pending",
        attempts: previa.attempts + 1,
        error: null,
        redirected_to: redirectTo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", previa.id)
      .eq("status", "error")
      .eq("attempts", previa.attempts)
      .select("id");
    if (!retomada?.length) return { status: "duplicate" };
    filaId = previa.id;
  }

  // 7. Enviar (o redirigir en modo de prueba).
  const destino = redirectTo ?? to;
  const subject = redirectTo ? asuntoDePrueba(c.subject, to) : c.subject;
  const headers: Record<string, string> = {};
  if (!transaccional && c.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${c.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const replyTo = process.env.EMAIL_REPLY_TO || undefined;

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: destino,
    subject,
    html: c.html,
    text: c.text,
    ...(replyTo ? { replyTo } : {}),
    ...(Object.keys(headers).length ? { headers } : {}),
  });

  const ahora = new Date().toISOString();
  if (error) {
    log(`Resend rechazó el envío (${c.kind})`, error.message);
    if (filaId) {
      await admin
        .from("lifecycle_emails")
        .update({ status: "error", error: error.message.slice(0, 500), updated_at: ahora })
        .eq("id", filaId);
    }
    return { status: "error", reason: error.message };
  }

  if (filaId) {
    await admin
      .from("lifecycle_emails")
      .update({ status: "sent", provider_id: data?.id ?? null, updated_at: ahora })
      .eq("id", filaId);
  }
  return { status: "sent", providerId: data?.id ?? null, redirectedTo: redirectTo };
}
