import { describe, expect, it } from "vitest";
import {
  applyYield,
  computeReversalLines,
  shouldConsumeSupplies,
  shouldReverseSupplies,
} from "@/lib/clinic-operations/procedure-supply-consumption";

describe("applyYield", () => {
  it("con rendimiento 100% no cambia la cantidad de la receta", () => {
    expect(applyYield(2, 100)).toBe(2);
  });

  it("con rendimiento 80% aumenta la cantidad para compensar la merma esperada", () => {
    expect(applyYield(2, 80)).toBeCloseTo(2.5);
  });

  it("con rendimiento 50% duplica la cantidad", () => {
    expect(applyYield(1, 50)).toBeCloseTo(2);
  });
});

describe("shouldConsumeSupplies", () => {
  it("true cuando pasa de pending a completed", () => {
    expect(shouldConsumeSupplies("pending", "completed")).toBe(true);
  });

  it("true cuando pasa de in_progress a completed", () => {
    expect(shouldConsumeSupplies("in_progress", "completed")).toBe(true);
  });

  it("false cuando ya estaba completed y se vuelve a marcar completed", () => {
    expect(shouldConsumeSupplies("completed", "completed")).toBe(false);
  });

  it("false cuando la transición no involucra completed", () => {
    expect(shouldConsumeSupplies("pending", "in_progress")).toBe(false);
  });
});

describe("shouldReverseSupplies", () => {
  it("true cuando estaba completed y pasa a pending", () => {
    expect(shouldReverseSupplies("completed", "pending")).toBe(true);
  });

  it("true cuando estaba completed y pasa a skipped", () => {
    expect(shouldReverseSupplies("completed", "skipped")).toBe(true);
  });

  it("false cuando no estaba completed", () => {
    expect(shouldReverseSupplies("pending", "in_progress")).toBe(false);
  });

  it("false cuando sigue completed", () => {
    expect(shouldReverseSupplies("completed", "completed")).toBe(false);
  });
});

describe("computeReversalLines", () => {
  it("revierte el consumo simple de un insumo", () => {
    const lines = computeReversalLines([{ itemId: "guante", kind: "salida", quantity: 2 }]);
    expect(lines).toEqual([{ itemId: "guante", quantity: 2 }]);
  });

  it("suma varias salidas del mismo insumo antes de revertir", () => {
    const lines = computeReversalLines([
      { itemId: "gasa", kind: "salida", quantity: 3 },
      { itemId: "gasa", kind: "salida", quantity: 1 },
    ]);
    expect(lines).toEqual([{ itemId: "gasa", quantity: 4 }]);
  });

  it("es idempotente: una reversión ya aplicada no se revierte de nuevo", () => {
    const lines = computeReversalLines([
      { itemId: "gasa", kind: "salida", quantity: 3 },
      { itemId: "gasa", kind: "entrada", quantity: 3 }, // reversión ya insertada antes
    ]);
    expect(lines).toEqual([]);
  });

  it("no incluye insumos sin nada pendiente de revertir", () => {
    const lines = computeReversalLines([
      { itemId: "gasa", kind: "salida", quantity: 2 },
      { itemId: "guante", kind: "salida", quantity: 1 },
      { itemId: "guante", kind: "entrada", quantity: 1 },
    ]);
    expect(lines).toEqual([{ itemId: "gasa", quantity: 2 }]);
  });

  it("sin movimientos, no hay nada que revertir", () => {
    expect(computeReversalLines([])).toEqual([]);
  });
});
