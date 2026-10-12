import { descifrarCredencial } from "@/lib/messaging/credenciales-whatsapp.server";

/**
 * Token para hablar con Meta en nombre de una clínica: el token de negocio
 * que entregó su Embedded Signup (cifrado en whatsapp_credentials). Si la
 * clínica se conectó antes de que existiera esa tabla, cae al token de
 * usuario del sistema de la app, si está configurado.
 */
export async function tokenWhatsAppDeClinica(clinicId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("whatsapp_credentials")
    .select("business_token_enc")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (data?.business_token_enc) return descifrarCredencial(data.business_token_enc);
  const sistema = process.env.WHATSAPP_SYSTEM_USER_TOKEN;
  if (sistema) return sistema;
  throw new Error("Esta clínica todavía no tiene credenciales de WhatsApp.");
}
