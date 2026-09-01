/**
 * Convierte un error de Postgres/PostgREST en un mensaje que un miembro del
 * staff (no un desarrollador) pueda leer. Antes cada server fn hacía
 * `throw new Error(error.message)` y el texto crudo de Postgres ("duplicate
 * key value violates unique constraint...", "permission denied for table...")
 * llegaba directo a un toast (auditoría de UX, 30-ago). Los triggers de
 * reglas de negocio (ej. horario de profesional, límites de cupos) sí
 * devuelven mensajes ya en español pensados para el usuario — por eso NO se
 * pisan, solo se reemplazan los patrones reconociblemente técnicos.
 */
export function mensajeDb(
  error: { message?: string } | null | undefined,
  fallback: string,
): string {
  const m = error?.message ?? "";
  if (
    m &&
    !/permission denied|row-level security|violates|duplicate key|constraint|null value in column/i.test(
      m,
    )
  ) {
    return m;
  }
  return fallback;
}
