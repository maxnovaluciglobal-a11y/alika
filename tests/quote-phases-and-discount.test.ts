import { describe, expect, it } from "vitest";
import {
  SIN_FASE_LABEL,
  groupByPhase,
  itemPaymentState,
  paidCentsByItem,
  type Payment,
} from "../src/lib/finance";

/**
 * Pruebas puras, sin DB, de la lógica que introdujo la Tanda A del análisis
 * competitivo contra Dentalink (03-sep-2026):
 *
 *  - G-2: agrupar ítems de presupuesto y de plan en fases con subtotal.
 *  - G-5: semáforo de cobro por línea a partir de `payments.treatment_item_id`.
 *
 * Lo que NO se cubre acá: la derivación de porcentaje a cents vive en
 * `resolveItemDiscount` dentro de `finance.functions.ts`, que es un módulo de
 * server functions y arrastra el middleware de Supabase al importarlo. Esa
 * regla se verifica contra la base real (ver el checklist de Tanda A).
 */

type ItemFase = { id: string; phaseLabel: string | null; phasePosition: number; position: number };

const item = (
  id: string,
  phaseLabel: string | null,
  phasePosition: number,
  position: number,
): ItemFase => ({ id, phaseLabel, phasePosition, position });

describe("groupByPhase", () => {
  it("agrupa por etiqueta y ordena los bloques por phasePosition", () => {
    const items = [
      item("b1", "Fase 2", 2, 0),
      item("a1", "Fase 1", 1, 0),
      item("a2", "Fase 1", 1, 1),
    ];
    const grupos = groupByPhase(items, () => 1000);

    expect(grupos.map((g) => g.label)).toEqual(["Fase 1", "Fase 2"]);
    expect(grupos[0].items.map((i) => i.id)).toEqual(["a1", "a2"]);
    expect(grupos[0].subtotalCents).toBe(2000);
    expect(grupos[1].subtotalCents).toBe(1000);
  });

  it("los ítems sin fase salen primero, sean cuales sean las posiciones", () => {
    const items = [item("con", "Fase 1", 0, 0), item("sin", null, 0, 0)];
    const grupos = groupByPhase(items, () => 0);

    expect(grupos[0].label).toBeNull();
    expect(grupos[0].items.map((i) => i.id)).toEqual(["sin"]);
    expect(grupos[1].label).toBe("Fase 1");
  });

  it("junta por etiqueta aunque las phasePosition se hayan desfasado al editar", () => {
    // Escenario real: se reordenan las fases y dos líneas de la misma fase
    // quedan con posiciones distintas. El usuario ve un solo nombre de fase,
    // así que tienen que caer en un solo bloque.
    const items = [item("x", "Rehabilitación", 3, 0), item("y", "Rehabilitación", 1, 1)];
    const grupos = groupByPhase(items, () => 500);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].items.map((i) => i.id)).toEqual(["x", "y"]);
    expect(grupos[0].subtotalCents).toBe(1000);
  });

  it("ordena los ítems dentro del bloque por position, no por orden de llegada", () => {
    const items = [item("segundo", "Fase 1", 1, 5), item("primero", "Fase 1", 1, 0)];
    const grupos = groupByPhase(items, () => 0);

    expect(grupos[0].items.map((i) => i.id)).toEqual(["primero", "segundo"]);
  });

  it("el subtotal usa la función de monto que se le pasa (precio vs total con descuento)", () => {
    const items = [item("a", "Fase 1", 1, 0), item("b", "Fase 1", 1, 1)];
    const porPrecio = groupByPhase(items, (i) => (i.id === "a" ? 30_000 : 20_000));

    expect(porPrecio[0].subtotalCents).toBe(50_000);
  });

  it("lista vacía devuelve cero bloques, sin inventar una fase vacía", () => {
    expect(groupByPhase([], () => 0)).toEqual([]);
  });

  it("SIN_FASE_LABEL existe para que la UI no invente su propio texto", () => {
    expect(SIN_FASE_LABEL).toBe("Sin fase");
  });
});

const pago = (treatmentItemId: string | null, amountCents: number): Payment => ({
  id: crypto.randomUUID(),
  amountCents,
  currency: "CLP",
  method: "cash",
  reference: null,
  paidAt: "2026-09-03T12:00:00.000Z",
  notes: null,
  treatmentPlanId: "plan-1",
  treatmentItemId,
  createdById: "user-1",
});

describe("paidCentsByItem", () => {
  it("suma varios pagos imputados al mismo ítem", () => {
    const mapa = paidCentsByItem([pago("it-1", 10_000), pago("it-1", 5_000)]);
    expect(mapa.get("it-1")).toBe(15_000);
  });

  it("ignora los pagos sin ítem: un cobro global NO se prorratea entre líneas", () => {
    // Prorratear inventaría una imputación que nadie hizo y el semáforo
    // mentiría. El saldo real del paciente vive en el header de la ficha.
    const mapa = paidCentsByItem([pago(null, 100_000), pago("it-1", 10_000)]);

    expect(mapa.get("it-1")).toBe(10_000);
    expect(mapa.size).toBe(1);
  });

  it("un ítem sin pagos no aparece en el mapa (ausente ≠ cero)", () => {
    const mapa = paidCentsByItem([pago("it-1", 10_000)]);
    expect(mapa.has("it-2")).toBe(false);
  });
});

describe("itemPaymentState", () => {
  it("sin pagos imputados es 'unpaid'", () => {
    expect(itemPaymentState(0, 50_000)).toBe("unpaid");
  });

  it("pago menor al precio es 'partial'", () => {
    expect(itemPaymentState(20_000, 50_000)).toBe("partial");
  });

  it("pago exacto es 'paid'", () => {
    expect(itemPaymentState(50_000, 50_000)).toBe("paid");
  });

  it("pago mayor al precio sigue siendo 'paid', no rompe ni queda parcial", () => {
    expect(itemPaymentState(60_000, 50_000)).toBe("paid");
  });

  it("un ítem de precio cero con algún pago queda 'paid', no 'partial'", () => {
    // Caso real: prestación bonificada al 100%. Sin este caso, 0 >= 0 tiene
    // que resolver a pagado o la línea queda en ámbar para siempre.
    expect(itemPaymentState(1, 0)).toBe("paid");
  });

  it("un ítem de precio cero sin pagos es 'unpaid', no 'paid'", () => {
    expect(itemPaymentState(0, 0)).toBe("unpaid");
  });
});
