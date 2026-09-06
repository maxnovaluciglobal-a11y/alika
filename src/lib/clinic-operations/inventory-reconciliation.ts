export type CountReconciliation =
  { kind: "match" } | { kind: "entrada"; quantity: number } | { kind: "salida"; quantity: number };

/**
 * Compara el stock teórico (lo que el sistema cree que hay) contra un conteo
 * físico real, y decide qué movimiento hace falta para que el sistema vuelva
 * a reflejar la realidad. Nunca devuelve `ajuste`: un `entrada`/`salida` por
 * la diferencia exacta reutiliza el mismo camino que el trigger de stock por
 * bodega ya aplica correctamente (suma/resta tanto el total de la clínica
 * como el saldo de la bodega puntual) — `ajuste` en cambio sobreescribe el
 * total de la clínica entera, lo cual sería incorrecto si el conteo fue de
 * una sola bodega y la clínica tiene más de una.
 */
export function reconcileCount(
  theoreticalQuantity: number,
  countedQuantity: number,
): CountReconciliation {
  const difference = countedQuantity - theoreticalQuantity;
  if (difference === 0) return { kind: "match" };
  return difference > 0
    ? { kind: "entrada", quantity: difference }
    : { kind: "salida", quantity: -difference };
}
