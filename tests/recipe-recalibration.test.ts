import { describe, expect, it } from "vitest";

import { suggestRecipeRecalibration } from "@/lib/clinic-operations/recipe-recalibration";

describe("suggestRecipeRecalibration", () => {
  it("con menos de 3 conteos, no sugiere nada — falta muestra", () => {
    const result = suggestRecipeRecalibration({
      recentDifferences: [-2, -3],
      currentRecipeQuantity: 2,
      completionsInWindow: 5,
    });
    expect(result).toEqual({ kind: "none" });
  });

  it("con conteos en direcciones mixtas, no sugiere nada — no es sistemático", () => {
    const result = suggestRecipeRecalibration({
      recentDifferences: [-3, 2, -1],
      currentRecipeQuantity: 2,
      completionsInWindow: 5,
    });
    expect(result).toEqual({ kind: "none" });
  });

  it("sin procedimientos completados en la ventana, no puede prorratear — no sugiere", () => {
    const result = suggestRecipeRecalibration({
      recentDifferences: [-3, -4, -2],
      currentRecipeQuantity: 2,
      completionsInWindow: 0,
    });
    expect(result).toEqual({ kind: "none" });
  });

  it("faltante sistemático y repetido: sugiere aumentar la cantidad de receta", () => {
    // 3 conteos, siempre falta stock vs. lo teórico (total -9 en 3 completions
    // del procedimiento) => se consumieron 3 de más por atención.
    const result = suggestRecipeRecalibration({
      recentDifferences: [-3, -3, -3],
      currentRecipeQuantity: 2,
      completionsInWindow: 3,
    });
    expect(result).toEqual({ kind: "suggest", suggestedQuantity: 5 });
  });

  it("sobrante sistemático y repetido: sugiere bajar la cantidad de receta", () => {
    const result = suggestRecipeRecalibration({
      recentDifferences: [3, 3, 3],
      currentRecipeQuantity: 5,
      completionsInWindow: 3,
    });
    expect(result).toEqual({ kind: "suggest", suggestedQuantity: 2 });
  });

  it("diferencia sistemática pero por debajo del 5% de la receta: es ruido, no sugiere", () => {
    const result = suggestRecipeRecalibration({
      recentDifferences: [-0.03, -0.03, -0.03],
      currentRecipeQuantity: 2,
      completionsInWindow: 3,
    });
    expect(result).toEqual({ kind: "none" });
  });

  it("si la cantidad sugerida da cero o negativa, no sugiere — la receta no puede quedar en 0", () => {
    const result = suggestRecipeRecalibration({
      recentDifferences: [10, 10, 10],
      currentRecipeQuantity: 2,
      completionsInWindow: 1,
    });
    expect(result).toEqual({ kind: "none" });
  });
});
