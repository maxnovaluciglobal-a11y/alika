import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { normalizeToWaMe } from "@/lib/messaging";
import {
  buildMetaTemplateParams,
  hasMetaTemplateMapping,
  type WhatsAppAccount,
  type WhatsAppAccountStatus,
} from "@/lib/whatsapp";

type WhatsAppAccountRow = {
  id: string;
  clinic_id: string;
  waba_id: string;
  phone_number_id: string;
  display_phone: string | null;
  status: string;
  quality_rating: string | null;
  connected_at: string;
};

const ACCOUNT_COLUMNS =
  "id, clinic_id, waba_id, phone_number_id, display_phone, status, quality_rating, connected_at";

function mapAccount(row: WhatsAppAccountRow): WhatsAppAccount {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    wabaId: row.waba_id,
    phoneNumberId: row.phone_number_id,
    displayPhone: row.display_phone,
    status: row.status as WhatsAppAccountStatus,
    qualityRating: row.quality_rating,
    connectedAt: row.connected_at,
  };
}

function metaApiVersion(): string {
  return process.env.WHATSAPP_API_VERSION || "v21.0";
}

/**
 * Config de plataforma requerida para hablar con la Cloud API. Ninguna de
 * estas es por-clínica: como Tech Provider, un solo System User token manda
 * en nombre de cualquier WABA compartido con la app (ver spec Fase 1).
 * Si falta algo, las funciones que la necesitan tiran un error legible en
 * vez de fallar con un 401 críptico de Meta.
 */
function requireMetaAppConfig() {
  const appId = process.env.WHATSAPP_APP_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const systemUserToken = process.env.WHATSAPP_SYSTEM_USER_TOKEN;
  if (!appId || !appSecret || !systemUserToken) {
    throw new Error(
      "WhatsApp no está configurado a nivel de plataforma todavía (falta enrolarse como Tech Provider en Meta). Contactá al equipo de Alika.",
    );
  }
  return { appId, appSecret, systemUserToken };
}

/** Estado de conexión de WhatsApp de la clínica. Null = nunca conectó. */
export const getWhatsAppAccountStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<WhatsAppAccount | null> => {
    const { data: row, error } = await context.supabase
      .from("whatsapp_accounts")
      .select(ACCOUNT_COLUMNS)
      .eq("clinic_id", data.clinicId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? mapAccount(row as WhatsAppAccountRow) : null;
  });

/**
 * Completa el Embedded Signup: recibe el `code` que devuelve el popup de
 * Meta (FB.login callback) más el waba_id/phone_number_id que llegan por
 * postMessage del evento WA_EMBEDDED_SIGNUP, y:
 *   1. Intercambia el code por un token de negocio (confirma que el signup
 *      es legítimo, no solo que el frontend dice que sí).
 *   2. Registra el número para Cloud API (`POST /{phone_number_id}/register`).
 *   3. Suscribe la app al WABA para recibir webhooks
 *      (`POST /{waba_id}/subscribed_apps`).
 *   4. Upsert en whatsapp_accounts.
 * Todo con el System User token — nunca se guarda un token por clínica.
 */
export const completeWhatsAppEmbeddedSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        code: z.string().min(1),
        wabaId: z.string().min(1),
        phoneNumberId: z.string().min(1),
        displayPhone: z.string().trim().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<WhatsAppAccount> => {
    const { appId, appSecret, systemUserToken } = requireMetaAppConfig();
    const version = metaApiVersion();

    // 1) Intercambio de code -> token de negocio. Solo se usa para verificar
    // que el code es válido; el envío real usa el System User token.
    const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("code", data.code);
    const tokenRes = await fetch(tokenUrl);
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(`No pudimos verificar la conexión con Meta. ${body}`);
    }

    // 2) Registrar el número para Cloud API.
    const registerRes = await fetch(
      `https://graph.facebook.com/${version}/${data.phoneNumberId}/register`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${systemUserToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", pin: "000000" }),
      },
    );
    if (!registerRes.ok) {
      const body = await registerRes.text();
      throw new Error(`No pudimos registrar el número en WhatsApp. ${body}`);
    }

    // 3) Suscribir la app al WABA para recibir estados y mensajes entrantes.
    const subscribeRes = await fetch(
      `https://graph.facebook.com/${version}/${data.wabaId}/subscribed_apps`,
      { method: "POST", headers: { Authorization: `Bearer ${systemUserToken}` } },
    );
    if (!subscribeRes.ok) {
      const body = await subscribeRes.text();
      throw new Error(`El número se registró pero no pudimos suscribir el webhook. ${body}`);
    }

    // 4) Upsert. UNIQUE(clinic_id) hace que una reconexión reemplace la fila
    // anterior en vez de duplicar.
    const { data: row, error } = await context.supabase
      .from("whatsapp_accounts")
      .upsert(
        {
          clinic_id: data.clinicId,
          waba_id: data.wabaId,
          phone_number_id: data.phoneNumberId,
          display_phone: data.displayPhone ?? null,
          status: "connected",
        },
        { onConflict: "clinic_id" },
      )
      .select(ACCOUNT_COLUMNS)
      .single();
    if (error) throw new Error("No pudimos guardar la conexión. " + error.message);

    return mapAccount(row as WhatsAppAccountRow);
  });

/** Desconecta el número (soft: status='disabled', no borra la fila — mantiene auditoría). */
export const disconnectWhatsAppAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<void> => {
    const { error } = await context.supabase
      .from("whatsapp_accounts")
      .update({ status: "disabled" })
      .eq("clinic_id", data.clinicId);
    if (error) throw new Error(error.message);
  });

export interface MetaSendResult {
  wamid: string;
}

/**
 * Envío de bajo nivel contra la Cloud API. NO es un createServerFn — es un
 * helper que llaman otras server functions (sendWhatsAppFromTemplate en
 * messaging.functions.ts) para el paso "mandar de verdad" cuando hay WABA
 * conectado y plantilla aprobada. Si cualquiera de esas condiciones falta,
 * el caller decide caer a wa.me — esta función solo sabe hablar con Meta.
 */
export async function sendMetaTemplateMessage(params: {
  phoneNumberId: string;
  to: string;
  templateName: string;
  templateLanguage: string;
  bodyParams: string[];
}): Promise<MetaSendResult> {
  const { systemUserToken } = requireMetaAppConfig();
  const version = metaApiVersion();

  const res = await fetch(
    `https://graph.facebook.com/${version}/${params.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${systemUserToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: params.to,
        type: "template",
        template: {
          name: params.templateName,
          language: { code: params.templateLanguage },
          components: [
            {
              type: "body",
              parameters: params.bodyParams.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta rechazó el envío: ${body}`);
  }

  const json = (await res.json()) as { messages?: Array<{ id: string }> };
  const wamid = json.messages?.[0]?.id;
  if (!wamid) throw new Error("Meta no devolvió un id de mensaje.");
  return { wamid };
}

export interface MetaTemplateSendAttempt {
  /** true si se mandó de verdad por la Cloud API. false = hay que caer a wa.me. */
  viaApi: boolean;
  externalId: string | null;
}

/**
 * Intento de envío real, compartido por todo caller que ya resolvió un
 * template (sendWhatsAppFromTemplate en messaging.functions.ts,
 * generatePortalLink en portal.functions.ts — Fase 2). Nunca tira: si algo
 * falla o falta (sin WABA conectado, plantilla no aprobada, kind sin mapeo
 * de parámetros), devuelve `viaApi: false` para que el caller caiga a wa.me.
 */
export async function tryMetaTemplateSend(params: {
  supabase: SupabaseClient<Database>;
  clinicId: string;
  templateKind: string;
  metaTemplate: { name: string; language: string } | null;
  recipientRaw: string;
  variables: Record<string, string>;
}): Promise<MetaTemplateSendAttempt> {
  if (!params.metaTemplate || !hasMetaTemplateMapping(params.templateKind)) {
    return { viaApi: false, externalId: null };
  }
  try {
    const { data: account } = await params.supabase
      .from("whatsapp_accounts")
      .select("phone_number_id, status")
      .eq("clinic_id", params.clinicId)
      .eq("status", "connected")
      .maybeSingle();
    const to = normalizeToWaMe(params.recipientRaw);
    if (!account || !to) return { viaApi: false, externalId: null };

    const bodyParams = buildMetaTemplateParams(params.templateKind, params.variables);
    const sent = await sendMetaTemplateMessage({
      phoneNumberId: account.phone_number_id,
      to,
      templateName: params.metaTemplate.name,
      templateLanguage: params.metaTemplate.language,
      bodyParams,
    });
    return { viaApi: true, externalId: sent.wamid };
  } catch (apiErr) {
    console.error("[whatsapp] envío por API falló, cae a wa.me:", (apiErr as Error).message);
    return { viaApi: false, externalId: null };
  }
}
