import { describe, expect, it } from "vitest";

import { appointmentDateRangeToUtcBounds } from "@/lib/appointments.functions";

/**
 * Regresión del hallazgo "listAppointments sin filtro de fecha" de la
 * auditoría de código 01-sep-2026 — ejecutado con cuidado y lo mínimo a
 * pedido explícito de Walter: solo dashboard.tsx (ventana siempre acotada)
 * pasa desde/hasta; agenda.tsx (con su modo "todas las fechas") queda
 * intacto. Este test cubre la parte con más riesgo de off-by-one: el
 * padding de 1 día a cada lado en UTC, necesario porque el filtro corre
 * antes de saber a qué sucursal/timezone pertenece cada fila.
 */
describe("appointmentDateRangeToUtcBounds", () => {
  it("sin desde ni hasta, no devuelve límites (mismo comportamiento que antes)", () => {
    expect(appointmentDateRangeToUtcBounds()).toEqual({});
  });

  it("desde resta 1 día completo en UTC", () => {
    const { gte } = appointmentDateRangeToUtcBounds("2026-09-15");
    expect(gte).toBe("2026-09-14T00:00:00.000Z");
  });

  it("hasta suma 2 días completos en UTC (1 de padding + 1 para que el límite sea exclusivo)", () => {
    const { lt } = appointmentDateRangeToUtcBounds(undefined, "2026-09-15");
    expect(lt).toBe("2026-09-17T00:00:00.000Z");
  });

  it("una cita a las 23:30 en un timezone -14h respecto a UTC cae dentro del padding", () => {
    // Sucursal a UTC-14 (peor caso real): "hoy 23:30" local del día `desde`
    // cae en UTC al día SIGUIENTE — el padding de -1 día en `desde` la cubre
    // igual desde el lado de atrás.
    const { gte } = appointmentDateRangeToUtcBounds("2026-09-15");
    const citaUtc = new Date("2026-09-15T23:30:00-14:00"); // = 2026-09-16T13:30:00Z
    expect(new Date(gte!).getTime()).toBeLessThanOrEqual(citaUtc.getTime());
  });

  it("una cita a las 00:15 en un timezone +14h respecto a UTC cae dentro del padding", () => {
    // Sucursal a UTC+14 (peor caso real): "hoy 00:15" local del día `hasta`
    // cae en UTC al día ANTERIOR — el padding de +2 días en `hasta` la cubre.
    const { lt } = appointmentDateRangeToUtcBounds(undefined, "2026-09-15");
    const citaUtc = new Date("2026-09-15T00:15:00+14:00"); // = 2026-09-14T10:15:00Z
    expect(citaUtc.getTime()).toBeLessThan(new Date(lt!).getTime());
  });
});
