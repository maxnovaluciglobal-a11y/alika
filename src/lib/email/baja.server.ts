/**
 * Aplicar la baja de correos opcionales a partir de un token firmado.
 *
 * Escribe en `notification_preferences` (la misma fila que muestra
 * /preferencias): `email_enabled = false` y `unsubscribed_at = now()`. La
 * pantalla de Preferencias ya lee esas dos columnas, así que la baja se ve
 * ahí y se puede revertir con "Volver a suscribirme".
 *
 * Los correos transaccionales (fin de prueba, pagos) no dependen de esta
 * preferencia: son parte del servicio.
 */
import { verificarTokenDeBaja } from "./baja-token.server";

export type ResultadoBaja = { ok: true } | { ok: false; motivo: "token" | "error" };

export async function aplicarBajaConToken(token: string): Promise<ResultadoBaja> {
  const datos = await verificarTokenDeBaja(token);
  if (!datos) return { ok: false, motivo: "token" };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("notification_preferences").upsert(
      {
        user_id: datos.userId,
        email_enabled: false,
        unsubscribed_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) {
      console.warn("[lifecycle-email] no se pudo aplicar la baja", error.message);
      return { ok: false, motivo: "error" };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[lifecycle-email] baja", err instanceof Error ? err.message : err);
    return { ok: false, motivo: "error" };
  }
}
