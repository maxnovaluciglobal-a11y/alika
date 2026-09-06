export interface RecalibrationInput {
  /** Diferencia (contado - teórico) de los últimos conteos del insumo, en el
   * orden en que ocurrieron. Necesita al menos `MIN_SAMPLES_FOR_SUGGESTION`
   * para poder distinguir una tendencia real de un conteo aislado. */
  recentDifferences: number[];
  currentRecipeQuantity: number;
  /** Cuántas veces se completó el procedimiento entre el primer y el último
   * conteo de la muestra — sin esto no se puede prorratear la diferencia
   * total en "cuánto de más por atención". */
  completionsInWindow: number;
}

export type RecalibrationSuggestion =
  { kind: "none" } | { kind: "suggest"; suggestedQuantity: number };

const MIN_SAMPLES_FOR_SUGGESTION = 3;
/** Por debajo de este cambio relativo es ruido de conteo, no una señal real
 * — no vale la pena interrumpir al dentista por una fracción así. */
const MIN_RELATIVE_CHANGE = 0.05;

/**
 * Tanda 4 — recalibración sugerida: cuando la reconciliación física (Tanda
 * 3) muestra una diferencia sistemática y repetida en un insumo ligado a un
 * procedimiento, sugiere ajustar la receta estándar. Nunca la aplica sola —
 * devuelve la sugerencia, quien llama decide si la muestra y una persona
 * confirma.
 */
export function suggestRecipeRecalibration(input: RecalibrationInput): RecalibrationSuggestion {
  const { recentDifferences, currentRecipeQuantity, completionsInWindow } = input;
  if (recentDifferences.length < MIN_SAMPLES_FOR_SUGGESTION) return { kind: "none" };
  if (completionsInWindow <= 0) return { kind: "none" };

  const allShortages = recentDifferences.every((d) => d < 0);
  const allSurpluses = recentDifferences.every((d) => d > 0);
  if (!allShortages && !allSurpluses) return { kind: "none" };

  const totalDifference = recentDifferences.reduce((sum, d) => sum + d, 0);
  // Diferencia negativa (contado < teórico) = se consumió más de lo que la
  // receta descontó por cada atención → el insumo real por atención es
  // mayor a la receta actual. Diferencia positiva es el caso inverso.
  const extraPerCompletion = -totalDifference / completionsInWindow;
  const suggestedQuantity = currentRecipeQuantity + extraPerCompletion;
  if (suggestedQuantity <= 0) return { kind: "none" };

  const relativeChange = Math.abs(extraPerCompletion) / currentRecipeQuantity;
  if (relativeChange < MIN_RELATIVE_CHANGE) return { kind: "none" };

  return { kind: "suggest", suggestedQuantity };
}
