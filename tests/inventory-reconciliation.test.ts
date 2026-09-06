import { describe, expect, it } from "vitest";

import { reconcileCount } from "@/lib/clinic-operations/inventory-reconciliation";

describe("reconcileCount", () => {
  it("sin diferencia, no hace falta ningún movimiento", () => {
    expect(reconcileCount(10, 10)).toEqual({ kind: "match" });
  });

  it("contado por encima del teórico: entrada por la diferencia", () => {
    expect(reconcileCount(10, 14)).toEqual({ kind: "entrada", quantity: 4 });
  });

  it("contado por debajo del teórico: salida por la diferencia", () => {
    expect(reconcileCount(10, 6)).toEqual({ kind: "salida", quantity: 4 });
  });

  it("nunca devuelve 'ajuste' — reutiliza entrada/salida ya probadas por bodega", () => {
    const result = reconcileCount(5, 2);
    expect(result.kind).not.toBe("ajuste");
  });
});
