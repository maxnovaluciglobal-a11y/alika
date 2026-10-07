/**
 * Search params de la ficha del paciente (`/pacientes/$pacienteId`).
 *
 * Todos opcionales: hay links a la ficha en una docena de pantallas y ninguno
 * tiene por qué conocer estos parámetros.
 */
export interface FichaSearch {
  /** `?cobrar=1`: abre el diálogo de pago (lo usa "Cobrar" del popover de la
   * agenda). Es un disparo de una vez: la ficha lo saca de la URL al usarlo. */
  cobrar?: 1;
}

/** Acepta `1`, `"1"` y `true` (lo que puede dejar el serializador o un link
 * escrito a mano); cualquier otra cosa es "no". */
export function parseCobrar(v: unknown): boolean {
  return v === 1 || v === "1" || v === true || v === "true";
}

export function validarBusquedaFicha(search: Record<string, unknown>): FichaSearch {
  const out: FichaSearch = {};
  if (parseCobrar(search.cobrar)) out.cobrar = 1;
  return out;
}
