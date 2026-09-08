import { describe, expect, it } from "vitest";
import { bucketDeMargen, calcularFugas, calcularPL } from "@/lib/marketing/calculadora";

// CLP es moneda de cero decimales: 1 "cent" = 1 peso. Es el caso donde un
// bug de factor 100 es INVISIBLE, por eso hay también un caso en MXN.
const baseCLP = {
  ingresosCents: 12_000_000,
  honorariosCents: 4_800_000,
  sueldosCents: 1_800_000,
  insumosCents: 1_200_000,
  laboratorioCents: 900_000,
  fijosCents: 1_500_000,
  variablesCents: 400_000,
  retencionPct: 0,
};

describe("calcularPL", () => {
  it("calcula utilidad y margen sin retención", () => {
    const r = calcularPL(baseCLP);
    // 12.000.000 − (4.800.000+1.800.000+1.200.000+900.000+1.500.000+400.000) = 1.400.000
    expect(r.utilidadCents).toBe(1_400_000);
    expect(r.margenPct).toBeCloseTo(11.67, 1);
  });

  it("descuenta la retención del medio de pago del ingreso, no de los costos", () => {
    // El paciente paga el total; la clínica recibe menos. Misma regla que
    // netAfterRetention en el producto: 2,95% de 12.000.000 = 354.000.
    const r = calcularPL({ ...baseCLP, retencionPct: 2.95 });
    expect(r.ingresoNetoCents).toBe(11_646_000);
    expect(r.retencionCents).toBe(354_000);
    expect(r.utilidadCents).toBe(1_046_000);
  });

  it("devuelve margen null cuando no hay ingresos, no cero", () => {
    // Regla de la casa: placeholder nullable, nunca un cero fabricado.
    const r = calcularPL({ ...baseCLP, ingresosCents: 0 });
    expect(r.margenPct).toBeNull();
    expect(r.puntoEquilibrioCents).toBeNull();
  });

  it("reporta utilidad negativa sin invertir el signo", () => {
    const r = calcularPL({ ...baseCLP, ingresosCents: 6_000_000 });
    expect(r.utilidadCents).toBeLessThan(0);
    expect(r.margenPct).toBeLessThan(0);
  });

  it("calcula el punto de equilibrio con fijos + sueldos como costo fijo", () => {
    const r = calcularPL(baseCLP);
    // Variables = insumos + laboratorio + honorarios + otros variables.
    // Fijos = arriendo/fijos + sueldos del equipo de apoyo.
    expect(r.puntoEquilibrioCents).toBeGreaterThan(0);
    expect(r.puntoEquilibrioCents).toBeLessThan(baseCLP.ingresosCents);
  });

  it("funciona igual en una moneda de dos decimales", () => {
    // MXN: 1 peso = 100 cents. Los mismos ratios deben salir idénticos.
    const enMXN = Object.fromEntries(
      Object.entries(baseCLP).map(([k, v]) =>
        k === "retencionPct" ? [k, v] : [k, (v as number) * 100],
      ),
    ) as typeof baseCLP;
    const r = calcularPL(enMXN);
    expect(r.margenPct).toBeCloseTo(11.67, 1);
    expect(r.utilidadCents).toBe(140_000_000);
  });
});

describe("calcularFugas", () => {
  it("cuantifica el dinero perdido por ausencias", () => {
    const r = calcularFugas({
      citasPorMes: 200,
      ausenciasPct: 15,
      ticketPromedioCents: 45_000,
      presupuestosPorMes: 40,
      aceptacionPct: 35,
      aceptacionReferenciaPct: 60,
      retencionCents: 0,
    });
    // 200 × 15% × 45.000 = 1.350.000
    expect(r.perdidaAusenciasCents).toBe(1_350_000);
  });

  it("cuantifica la oportunidad de presupuestos no cerrados", () => {
    const r = calcularFugas({
      citasPorMes: 200,
      ausenciasPct: 0,
      ticketPromedioCents: 45_000,
      presupuestosPorMes: 40,
      aceptacionPct: 35,
      aceptacionReferenciaPct: 60,
      retencionCents: 0,
    });
    // 40 × (60% − 35%) × 45.000 = 450.000
    expect(r.oportunidadPresupuestosCents).toBe(450_000);
  });

  it("no inventa oportunidad si ya se supera la referencia", () => {
    const r = calcularFugas({
      citasPorMes: 100,
      ausenciasPct: 0,
      ticketPromedioCents: 45_000,
      presupuestosPorMes: 40,
      aceptacionPct: 80,
      aceptacionReferenciaPct: 60,
      retencionCents: 0,
    });
    expect(r.oportunidadPresupuestosCents).toBe(0);
  });

  it("devuelve null en vez de cero cuando falta el ticket promedio", () => {
    const r = calcularFugas({
      citasPorMes: 200,
      ausenciasPct: 15,
      ticketPromedioCents: 0,
      presupuestosPorMes: 40,
      aceptacionPct: 35,
      aceptacionReferenciaPct: 60,
      retencionCents: 0,
    });
    expect(r.perdidaAusenciasCents).toBeNull();
  });
});

describe("bucketDeMargen", () => {
  it("clasifica sin exponer la cifra", () => {
    expect(bucketDeMargen(null)).toBe("na");
    expect(bucketDeMargen(-3)).toBe("perdida");
    expect(bucketDeMargen(4)).toBe("bajo");
    expect(bucketDeMargen(12)).toBe("medio");
    expect(bucketDeMargen(25)).toBe("alto");
  });
});
