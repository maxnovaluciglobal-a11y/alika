import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

import { normalizeToWaMe } from "@/lib/messaging";
import { isClinicOpenNow } from "@/lib/whatsapp";
import { sendMetaTextMessage } from "@/lib/whatsapp.functions";
import { captureException } from "@/lib/sentry";
import type { Database } from "@/integrations/supabase/types";

type SupabaseAdminClient = SupabaseClient<Database>;

/**
 * Webhook de la WhatsApp Cloud API (Fase 1 + Fase 3). Meta llama esto sin
 * auth de Supabase — se valida con el handshake GET y la firma HMAC del
 * POST, y se escribe con supabaseAdmin (service_role) igual que
 * api.demo-reset.ts.
 *
 * GET  = verificación de suscripción (una vez, al configurar el webhook en
 *        Meta Business Manager).
 * POST = eventos reales: status callbacks (delivered/read/failed) y
 *        mensajes entrantes. Si el número coincide con un paciente: SÍ
 *        confirma la próxima cita, BAJA/STOP corta el opt-in (Fase 1). Si
 *        es un desconocido: se captura como lead + auto-respuesta con texto
 *        libre, sin plantilla — válido porque el desconocido acaba de abrir
 *        la ventana de servicio de 24h al escribir primero (Fase 3).
 */
export const Route = createFileRoute("/api/whatsapp-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
        if (!expected) {
          return new Response("WHATSAPP_WEBHOOK_VERIFY_TOKEN no configurado", { status: 500 });
        }
        if (mode !== "subscribe" || token !== expected || !challenge) {
          return new Response("forbidden", { status: 403 });
        }
        return new Response(challenge, { status: 200 });
      },

      POST: async ({ request }) => {
        const appSecret = process.env.WHATSAPP_APP_SECRET;
        if (!appSecret) {
          return new Response("WHATSAPP_APP_SECRET no configurado", { status: 500 });
        }

        const rawBody = await request.text();
        const signatureHeader = request.headers.get("x-hub-signature-256") ?? "";
        if (!isValidSignature(rawBody, signatureHeader, appSecret)) {
          return new Response("invalid signature", { status: 401 });
        }

        let payload: WhatsAppWebhookPayload;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Nunca dejamos que un item roto tumbe el 200 general — Meta reintenta
        // agresivo si no confirmamos rápido, y un solo entry raro no debería
        // bloquear el resto.
        for (const entry of payload.entry ?? []) {
          for (const change of entry.changes ?? []) {
            const value = change.value;
            if (!value) continue;
            const phoneNumberId = value.metadata?.phone_number_id;
            if (!phoneNumberId) continue;

            try {
              const { data: account } = await supabaseAdmin
                .from("whatsapp_accounts")
                .select("clinic_id")
                .eq("phone_number_id", phoneNumberId)
                .maybeSingle();
              if (!account) continue; // número no reconocido, nada que hacer

              for (const status of value.statuses ?? []) {
                await applyStatusUpdate(supabaseAdmin, status);
              }
              const nameByWaId = new Map(
                (value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]),
              );
              for (const message of value.messages ?? []) {
                await applyInboundMessage(
                  supabaseAdmin,
                  account.clinic_id,
                  message,
                  nameByWaId.get(message.from),
                );
              }
            } catch (err) {
              console.error("[whatsapp-webhook] error procesando entry:", (err as Error).message);
            }
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});

function isValidSignature(rawBody: string, signatureHeader: string, appSecret: string): boolean {
  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) return false;
  const provided = signatureHeader.slice(prefix.length);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Tipo mínimo del payload de Meta — no vale la pena vendorear su SDK para esto. */
interface WhatsAppStatusEvent {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  errors?: Array<{ title?: string; message?: string }>;
}
interface WhatsAppInboundMessage {
  from: string;
  id: string;
  type: string;
  text?: { body?: string };
}
interface WhatsAppContact {
  wa_id: string;
  profile?: { name?: string };
}
interface WhatsAppWebhookPayload {
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        statuses?: WhatsAppStatusEvent[];
        messages?: WhatsAppInboundMessage[];
        contacts?: WhatsAppContact[];
      };
      field?: string;
    }>;
  }>;
}

/** Status callback: delivered/read/failed → actualiza la fila por external_id (wamid). */
async function applyStatusUpdate(
  supabaseAdmin: SupabaseAdminClient,
  status: WhatsAppStatusEvent,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const patch: Database["public"]["Tables"]["messages"]["Update"] = { status: status.status };
  if (status.status === "delivered") patch.delivered_at = nowIso;
  if (status.status === "read") patch.read_at = nowIso;
  if (status.status === "failed") {
    patch.error = status.errors?.[0]?.message ?? status.errors?.[0]?.title ?? "Falló en Meta";
  }
  await supabaseAdmin.from("messages").update(patch).eq("external_id", status.id);
}

const OPT_OUT_WORDS = new Set(["BAJA", "STOP", "CANCELAR", "UNSUBSCRIBE"]);

/**
 * Mensaje entrante: se guarda siempre en el historial (así el staff lo ve en
 * la ficha del paciente, incluso "SÍ"/"RE" — ninguno dispara un cambio de
 * estado automático). Confirmar una cita es acción exclusiva del profesional
 * asignado (o admin/owner en su nombre) desde la agenda — ver migración
 * 20260901130000_appointment_dentist_confirmation. Antes "SÍ" confirmaba la
 * próxima cita solo, sin que nadie de la clínica la validara; se sacó a
 * pedido de una clienta potencial. "BAJA/STOP" corta el opt-in.
 */
async function applyInboundMessage(
  supabaseAdmin: SupabaseAdminClient,
  clinicId: string,
  message: WhatsAppInboundMessage,
  contactName: string | undefined,
): Promise<void> {
  const fromNormalized = normalizeToWaMe(message.from);
  if (!fromNormalized) return;

  const bodyText = message.type === "text" ? (message.text?.body ?? "") : "";

  const { data: patients } = await supabaseAdmin
    .from("patients")
    .select("id, phone")
    .eq("clinic_id", clinicId)
    .not("phone", "is", null);
  const patient = (patients ?? []).find(
    (p) => p.phone && normalizeToWaMe(p.phone) === fromNormalized,
  );
  if (!patient) {
    // Fase 3: desconocido — no es un paciente con ficha, es un lead.
    await handleUnknownSender(supabaseAdmin, clinicId, fromNormalized, bodyText, contactName);
    return;
  }
  await supabaseAdmin.from("messages").insert({
    clinic_id: clinicId,
    patient_id: patient.id,
    channel: "whatsapp",
    direction: "inbound",
    status: "delivered",
    recipient: fromNormalized,
    body: bodyText || `[${message.type}]`,
    external_id: message.id,
  });

  const normalized = bodyText.trim().toUpperCase();
  if (OPT_OUT_WORDS.has(normalized)) {
    await supabaseAdmin
      .from("patients")
      .update({ wa_opt_in: false, wa_opt_out_at: new Date().toISOString() })
      .eq("id", patient.id);
  }
}

/**
 * Fase 3 — captación: un número que no coincide con ningún paciente escribe
 * por primera vez (QR, bio de Instagram, Click-to-WhatsApp ad, o simplemente
 * alguien que guardó el número). `UNIQUE(clinic_id, phone)` en whatsapp_leads
 * hace que escribir varias veces sea UN lead, no varios — solo la primera
 * vez dispara la auto-respuesta, para no ser pesados.
 *
 * La auto-respuesta es texto libre (sendMetaTextMessage, sin plantilla): es
 * válida porque el desconocido acaba de abrir la ventana de servicio de 24h
 * al escribir primero — Meta permite responder lo que sea mientras esa
 * ventana esté abierta.
 */
async function handleUnknownSender(
  supabaseAdmin: SupabaseAdminClient,
  clinicId: string,
  fromNormalized: string,
  bodyText: string,
  contactName: string | undefined,
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("whatsapp_leads")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("phone", fromNormalized)
    .maybeSingle();

  if (existing) {
    // Ya lo conocíamos — no repetimos la auto-respuesta, no pisamos el
    // primer mensaje (queda como contexto de cuándo arrancó la conversación).
    await supabaseAdmin
      .from("whatsapp_leads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return;
  }

  // Fase 4 — referidos: los códigos son 6 hex uppercase (mismo formato que
  // genera el trigger generate_patient_referral_code). Si el primer mensaje
  // trae uno como palabra suelta y coincide con un paciente real de esta
  // clínica, queda linkeado — así el link wa.me pre-armado que el paciente
  // reenvía (con el código ya en el texto) conecta solo, sin que el
  // desconocido tenga que escribir nada especial.
  const referredByPatientId = await findReferrerByCode(supabaseAdmin, clinicId, bodyText);

  const { data: inserted, error } = await supabaseAdmin
    .from("whatsapp_leads")
    .insert({
      clinic_id: clinicId,
      phone: fromNormalized,
      name: contactName ?? null,
      first_message: bodyText || "[mensaje sin texto]",
      referred_by_patient_id: referredByPatientId,
    })
    .select("id")
    .single();
  if (error || !inserted) return;

  try {
    const [{ data: account }, { data: branches }, { data: clinic }] = await Promise.all([
      supabaseAdmin
        .from("whatsapp_accounts")
        .select("phone_number_id")
        .eq("clinic_id", clinicId)
        .eq("status", "connected")
        .maybeSingle(),
      supabaseAdmin
        .from("branches")
        .select("timezone, opens_at, closes_at, is_active")
        .eq("clinic_id", clinicId),
      supabaseAdmin.from("clinics").select("name").eq("id", clinicId).maybeSingle(),
    ]);
    if (!account) return; // no debería pasar (el webhook ya resolvió a esta clínica), defensivo igual

    const abierto = isClinicOpenNow(
      (branches ?? []).map((b) => ({
        timezone: b.timezone,
        opensAt: b.opens_at,
        closesAt: b.closes_at,
        isActive: b.is_active,
      })),
    );
    const clinicaNombre = clinic?.name ?? "la clínica";
    const texto = abierto
      ? `¡Hola! Gracias por escribirnos a ${clinicaNombre}. En breve te responde alguien del equipo — cuéntanos qué necesitas mientras tanto.`
      : `¡Hola! Gracias por escribirnos a ${clinicaNombre}. Ahora mismo estamos fuera de horario de atención — déjanos tu consulta y te contactamos a primera hora.`;

    await sendMetaTextMessage({
      phoneNumberId: account.phone_number_id,
      to: fromNormalized,
      body: texto,
    });
    await supabaseAdmin
      .from("whatsapp_leads")
      .update({ auto_replied_at: new Date().toISOString() })
      .eq("id", inserted.id);
  } catch (err) {
    // El lead ya quedó guardado — si la auto-respuesta falla, el staff lo ve
    // igual en /whatsapp, solo no recibió el mensaje automático. Reportamos a
    // Sentry porque antes esto era un fallo 100% silencioso (solo
    // console.error, que nadie mira en prod) — captación real perdida sin
    // que nadie se entere. La UI de /whatsapp también marca el lead como
    // "sin auto-respuesta" si pasan varios minutos sin `auto_replied_at`.
    console.error("[whatsapp-webhook] auto-respuesta a lead falló:", (err as Error).message);
    void captureException(err, {
      tags: { boundary: "whatsapp_webhook_lead_auto_reply" },
      extra: { clinicId, leadId: inserted.id },
    });
  }
}

const REFERRAL_CODE_PATTERN = /\b[0-9A-F]{6}\b/g;

/** Busca un código de referido (palabra suelta de 6 hex) en el texto y lo valida contra patients.referral_code de esta clínica. */
async function findReferrerByCode(
  supabaseAdmin: SupabaseAdminClient,
  clinicId: string,
  bodyText: string,
): Promise<string | null> {
  const candidates = [...bodyText.toUpperCase().matchAll(REFERRAL_CODE_PATTERN)].map((m) => m[0]);
  if (candidates.length === 0) return null;

  const { data: patients } = await supabaseAdmin
    .from("patients")
    .select("id, referral_code")
    .eq("clinic_id", clinicId)
    .in("referral_code", candidates);
  return patients?.[0]?.id ?? null;
}
