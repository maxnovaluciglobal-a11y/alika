import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/** Violación de clave única/PK en Postgres. */
const UNIQUE_VIOLATION = "23505";

/** Tablas donde el cliente puede proponer el `id` (altas encolables offline). */
type TablaIdempotente = "appointments" | "payments" | "odontogram_marks" | "clinical_notes";

/**
 * Decide si un INSERT que falló es en realidad un reintento de algo que ya se
 * guardó.
 *
 * La cola offline manda el `id` que generó el equipo al capturar. Si la
 * sincronización se corta después de que Postgres escribió pero antes de que
 * llegara la respuesta, el reintento choca contra la PK con 23505 — y eso NO
 * es un error: el trabajo ya está hecho.
 *
 * Devuelve el id existente cuando corresponde tratarlo como éxito, o null
 * cuando el error es de verdad.
 *
 * El SELECT pasa por RLS y además filtra por `clinic_id`. Si ese id existiera
 * en otra clínica, la política no devuelve la fila y esto responde null: el
 * caller tira su error genérico y nunca le confirmamos a nadie que un id
 * ajeno existe.
 */
export async function filaYaCreada(
  supabase: SupabaseClient<Database>,
  tabla: TablaIdempotente,
  id: string | undefined,
  clinicId: string,
  error: { code?: string } | null,
): Promise<string | null> {
  if (!id || error?.code !== UNIQUE_VIOLATION) return null;

  const { data } = await supabase
    .from(tabla)
    .select("id")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  return data?.id ?? null;
}
