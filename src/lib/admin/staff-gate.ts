// src/lib/admin/staff-gate.ts
//
// Gate compartido de las pantallas internas del equipo de Alika (no hay un
// rol "staff de la empresa" en el schema — todos los roles son de clínica).
// La única autorización real es esta allowlist de emails por env var,
// resuelta contra `auth.users` con el cliente admin.
//
// Extraído de `listMarketingLeads` (src/lib/marketing/leads.functions.ts),
// que era el único caller hasta que `admin.clinicas.tsx` necesitó el mismo
// chequeo — mismo criterio que `tryMetaTemplateSend` en whatsapp.functions.ts:
// la segunda pantalla que necesita el gate lo saca del bloque que antes vivía
// duplicado, en vez de copiarlo por segunda vez.

type SupabaseAdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

/**
 * Tira `Error("No tienes permisos.")` si el usuario autenticado no está en
 * `ALIKA_STAFF_EMAILS`. Devuelve el email (en minúsculas) cuando sí está, por
 * si el caller lo necesita (ej. logging de quién hizo qué).
 */
export async function requireAlikaStaffEmail(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
): Promise<string> {
  const permitidos = (process.env.ALIKA_STAFF_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const { data: usuario } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = usuario?.user?.email?.toLowerCase();

  if (!email || !permitidos.includes(email)) {
    throw new Error("No tienes permisos.");
  }
  return email;
}
