import type { TreatmentItemStatus } from "@/lib/finance/finance";

/**
 * fixed: uso único indivisible (guante, aguja) — la receta ya es exacta.
 * variable: fraccionable (gasas, algodón, gel) — acá vale la pena ajustar.
 * shared: no correlaciona 1:1 con un procedimiento (desinfectante de
 * sillón) — no se ofrece como opción al armar una receta.
 */
export type ConsumptionType = "fixed" | "variable" | "shared";

export interface SupplyMovementRecord {
  itemId: string;
  kind: "entrada" | "salida";
  quantity: number;
}

export interface SupplyReversalLine {
  itemId: string;
  quantity: number;
}

/**
 * Cantidad real a descontar dada la cantidad de receta y el rendimiento
 * esperado del insumo (`inventory_items.yield_pct`, 100 = sin merma). Mismo
 * principio que `realCostPerUnit` en DypOS pero aplicado a cantidad en vez
 * de costo: si de cada unidad manipulada solo el `yieldPct`% termina en el
 * paciente, hay que descontar más de lo que dice la receta para reflejar la
 * merma esperada. Con 100 no cambia nada — mismo comportamiento que la
 * Tanda 1 para insumos `fixed`.
 */
export function applyYield(recipeQuantity: number, yieldPct: number): number {
  return recipeQuantity / (yieldPct / 100);
}

/** True solo cuando la transición ENTRA a "completed" desde un estado que no lo era. */
export function shouldConsumeSupplies(
  previousStatus: TreatmentItemStatus,
  nextStatus: TreatmentItemStatus,
): boolean {
  return nextStatus === "completed" && previousStatus !== "completed";
}

/** True solo cuando la transición SALE de "completed" hacia otro estado. */
export function shouldReverseSupplies(
  previousStatus: TreatmentItemStatus,
  nextStatus: TreatmentItemStatus,
): boolean {
  return previousStatus === "completed" && nextStatus !== "completed";
}

/**
 * Neto real pendiente de revertir por insumo — mismo principio que
 * `reverseForOrder` en DypOS: una 'salida' automática pendiente de revertir
 * suma, una 'entrada' de reversión ya aplicada resta. Idempotente: pasarle
 * el historial completo (incluida una reversión ya insertada) da 0 para
 * ese insumo y no vuelve a aparecer en el resultado.
 */
export function computeReversalLines(movements: SupplyMovementRecord[]): SupplyReversalLine[] {
  const netByItem = new Map<string, number>();
  for (const m of movements) {
    const sign = m.kind === "salida" ? 1 : -1;
    netByItem.set(m.itemId, (netByItem.get(m.itemId) ?? 0) + sign * m.quantity);
  }
  return [...netByItem.entries()]
    .filter(([, quantity]) => quantity > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity }));
}
