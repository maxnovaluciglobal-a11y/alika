import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

import { normalizeToWaMe } from "@/lib/messaging";
import type { Database } from "@/integrations/supabase/types";

type SupabaseAdminClient = SupabaseClient<Database>;

/**
 * Webhook de la WhatsApp Cloud API (Fase 1). Meta llama esto sin auth de
 * Supabase — se valida con el handshake GET y la firma HMAC del POST, y se
 * escribe con supabaseAdmin (service_role) igual que api.demo-reset.ts.
 *
 * GET  = verificación de suscripción (una vez, al configurar el webhook en
 *        Meta Business Manager).
 * POST = eventos reales: status callbacks (delivered/read/failed) y
 *        mensajes entrantes (SÍ / BAJA, o cualquier otra cosa que el
 *        paciente escriba).
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
              for (const message of value.messages ?? []) {
                await applyInboundMessage(supabaseAdmin, account.clinic_id, message);
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
interface WhatsAppWebhookPayload {
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        statuses?: WhatsAppStatusEvent[];
        messages?: WhatsAppInboundMessage[];
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
const CONFIRM_WORDS = new Set(["SI", "SÍ", "YES", "CONFIRMO"]);

/**
 * Mensaje entrante: se guarda siempre en el historial (así el staff lo ve en
 * la ficha del paciente, incluso "RE" — que hoy no dispara ningún cambio de
 * estado automático porque appointment_status no tiene un valor de
 * "a reagendar"; queda como aviso para que alguien lo gestione a mano).
 * "SÍ" confirma la próxima cita. "BAJA/STOP" corta el opt-in.
 */
async function applyInboundMessage(
  supabaseAdmin: SupabaseAdminClient,
  clinicId: string,
  message: WhatsAppInboundMessage,
): Promise<void> {
  const fromNormalized = normalizeToWaMe(message.from);
  if (!fromNormalized) return;

  const { data: patients } = await supabaseAdmin
    .from("patients")
    .select("id, phone")
    .eq("clinic_id", clinicId)
    .not("phone", "is", null);
  const patient = (patients ?? []).find(
    (p) => p.phone && normalizeToWaMe(p.phone) === fromNormalized,
  );
  if (!patient) return; // número no atribuible a ningún paciente de la clínica

  const bodyText = message.type === "text" ? (message.text?.body ?? "") : "";
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
    return;
  }
  if (CONFIRM_WORDS.has(normalized)) {
    const { data: nextAppt } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patient.id)
      .in("status", ["tentativa", "confirmada"])
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextAppt) {
      await supabaseAdmin
        .from("appointments")
        .update({ status: "confirmada" })
        .eq("id", nextAppt.id);
    }
  }
}
