import { describe, expect, it } from "vitest";
import {
  nivelStock,
  ordenAtrasada,
  precioPromedioPonderado,
  type LabOrder,
} from "../src/lib/finance";

/** Semáforo de stock, atraso de laboratorio y precio promedio (Tanda C). */

describe("nivelStock", () => {
  it("sin mínimo configurado no hay semáforo, no hay alerta roja", () => {
    // `minStock` null es "la clínica no configuró alerta", no "el mínimo es
    // cero". Pintarlo en rojo llenaría la pantalla de falsas urgencias.
    expect(nivelStock(0, null)).toBe("sin-alerta");
    expect(nivelStock(500, null)).toBe("sin-alerta");
  });

  it("en el mínimo o por debajo es crítico", () => {
    expect(nivelStock(10, 10)).toBe("critico");
    expect(nivelStock(3, 10)).toBe("critico");
    expect(nivelStock(0, 10)).toBe("critico");
  });

  it("hasta 1,5x el mínimo avisa antes de que se acabe", () => {
    expect(nivelStock(12, 10)).toBe("bajo");
    expect(nivelStock(15, 10)).toBe("bajo");
  });

  it("por encima de 1,5x está ok", () => {
    expect(nivelStock(16, 10)).toBe("ok");
    expect(nivelStock(200, 10)).toBe("ok");
  });

  it("un mínimo de cero deja en crítico solo cuando no queda nada", () => {
    expect(nivelStock(0, 0)).toBe("critico");
    expect(nivelStock(1, 0)).toBe("ok");
  });
});

const orden = (over: Partial<LabOrder> = {}): LabOrder => ({
  id: "o1",
  labId: null,
  labNameSnapshot: "Lab Central",
  patientId: "p1",
  patientName: "Paciente",
  treatmentItemId: null,
  professionalId: null,
  description: "Corona metálica",
  toothNumbers: [24],
  status: "enviado",
  sentOn: "2026-09-01",
  dueOn: "2026-09-10",
  receivedOn: null,
  costCents: 80_000,
  currency: "CLP",
  notes: null,
  ...over,
});

describe("ordenAtrasada", () => {
  it("está atrasada si venció el plazo y no llegó", () => {
    expect(ordenAtrasada(orden(), "2026-09-11")).toBe(true);
  });

  it("no está atrasada el mismo día del vencimiento", () => {
    expect(ordenAtrasada(orden(), "2026-09-10")).toBe(false);
  });

  it("sin fecha comprometida no hay atraso: no se inventa un plazo", () => {
    expect(ordenAtrasada(orden({ dueOn: null }), "2026-12-31")).toBe(false);
  });

  it("una orden recibida no está atrasada aunque haya llegado tarde", () => {
    expect(ordenAtrasada(orden({ status: "recibido" }), "2026-09-30")).toBe(false);
  });

  it("una orden cancelada tampoco cuenta como atrasada", () => {
    expect(ordenAtrasada(orden({ status: "cancelado" }), "2026-09-30")).toBe(false);
  });

  it("una que volvió para reprocesar sí puede estar atrasada", () => {
    expect(ordenAtrasada(orden({ status: "reprocesar" }), "2026-09-30")).toBe(true);
  });
});

describe("precioPromedioPonderado", () => {
  it("pondera por cantidad, no promedia los precios a secas", () => {
    // 10 a $1.000 y 90 a $2.000 → 1.900, no 1.500.
    expect(
      precioPromedioPonderado([
        { quantity: 10, unitCostCents: 1_000 },
        { quantity: 90, unitCostCents: 2_000 },
      ]),
    ).toBe(1_900);
  });

  it("ignora las entradas sin costo en vez de contarlas como cero", () => {
    // Contar el null como 0 hundiría el promedio y haría creer que el insumo
    // sale más barato de lo que sale.
    expect(
      precioPromedioPonderado([
        { quantity: 10, unitCostCents: 2_000 },
        { quantity: 90, unitCostCents: null },
      ]),
    ).toBe(2_000);
  });

  it("sin ninguna entrada con costo devuelve null, no cero", () => {
    expect(precioPromedioPonderado([{ quantity: 5, unitCostCents: null }])).toBeNull();
    expect(precioPromedioPonderado([])).toBeNull();
  });

  it("redondea a cents enteros", () => {
    const r = precioPromedioPonderado([
      { quantity: 3, unitCostCents: 1_000 },
      { quantity: 4, unitCostCents: 1_500 },
    ]);
    expect(r).toBe(1_286);
    expect(Number.isInteger(r)).toBe(true);
  });
});
