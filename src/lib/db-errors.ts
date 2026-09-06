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

/**
 * Una columna opcional todavía no se aplicó al Supabase real — estado
 * "pre-migración" transitorio (ver CLAUDE.md regla 5), no un error real de
 * la request. Postgres devuelve `42703` (undefined_column) cuando la
 * columna falta en un SELECT. Pero en un INSERT/UPDATE, PostgREST valida el
 * payload contra su propio caché de esquema *antes* de tocar Postgres, y si
 * no encuentra la columna ahí devuelve su propio error `PGRST204` ("Could
 * not find the 'x' column of 'y' in the schema cache") — nunca un 42703.
 * Sin chequear los dos códigos, ese mensaje técnico en inglés de PostgREST
 * llega directo a un toast en vez del aviso en español (mismo problema que
 * mensajeDb ya resuelve para los patrones de Postgres).
 */
export function isUndefinedColumnError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

/**
 * Una tabla nueva todavía no se aplicó al Supabase real — mismo estado
 * "pre-migración" que `isUndefinedColumnError`, pero para una tabla entera
 * en vez de una columna. `42P01` (undefined_table) es el código nativo de
 * Postgres; `PGRST205` es el que devuelve PostgREST cuando la tabla no está
 * en su caché de esquema.
 */
export function isUndefinedTableError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}
