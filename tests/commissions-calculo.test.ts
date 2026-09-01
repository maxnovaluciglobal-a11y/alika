import { describe, expect, it } from "vitest";
import { calcularComision } from "../src/lib/commissions";

/**
 * Prueba pura, sin DB: cubre el cálculo de liquidación de comisiones que
 * antes vivía inline dentro del handler de `getCommissionReport`
 * (commissions.functions.ts), sin ningún test (auditoría de deuda
 * técnica, 30-ago).
 */
describe("calcularComision", () => {
  it("sin regla configurada, no calcula nada", () => {
    expect(calcularComision(null, 500_000, 3)).toEqual({
      commissionCents: null,
      ruleLabel: "Sin regla configurada",
    });
  });

  it("percent: aplica los basis points sobre la producción", () => {
    // 10% (1000 bps) sobre $500.000 = $50.000
    const r = calcularComision({ kind: "percent", percentBps: 1000, fixedCents: 0 }, 500_000, 3);
    expect(r.commissionCents).toBe(50_000);
    expect(r.ruleLabel).toBe("10.00% sobre producción");
  });

  it("percent: redondea en vez de truncar (no perder centavos en contra del profesional)", () => {
    // 33.33% (3333 bps) sobre $100 = $33.33 → redondea a $33
    const r = calcularComision({ kind: "percent", percentBps: 3333, fixedCents: 0 }, 100, 1);
    expect(r.commissionCents).toBe(33);
  });

  it("percent: producción cero da comisión cero, no null (hay regla, solo no generó nada)", () => {
    const r = calcularComision({ kind: "percent", percentBps: 1000, fixedCents: 0 }, 0, 0);
    expect(r.commissionCents).toBe(0);
  });

  it("fixed: multiplica el monto fijo por la cantidad de procedimientos, ignora la producción", () => {
    // $5.000 fijo × 4 procedimientos = $20.000, sin importar cuánto facturó
    const r = calcularComision({ kind: "fixed", percentBps: 0, fixedCents: 5_000 }, 999_999, 4);
    expect(r.commissionCents).toBe(20_000);
    expect(r.ruleLabel).toBe("Fijo por procedimiento");
  });

  it("fixed: cero procedimientos da comisión cero", () => {
    const r = calcularComision({ kind: "fixed", percentBps: 0, fixedCents: 5_000 }, 0, 0);
    expect(r.commissionCents).toBe(0);
  });
});
