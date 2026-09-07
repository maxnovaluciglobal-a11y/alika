import { afterEach, describe, expect, it, vi } from "vitest";

import { Route } from "@/routes/_authenticated/_clinic/agenda";

/**
 * La fecha por defecto de /agenda tiene que seguir al reloj.
 *
 * Antes se calculaba en una constante de módulo (`const HOY = hoyISO()`).
 * Un módulo se carga una sola vez y se queda vivo: un servidor SSR tibio o
 * una pestaña abierta toda la noche congelaban esa fecha, y después de
 * medianoche la agenda abría en ayer sin que nadie lo notara.
 */

const fechaPorDefecto = () =>
  (Route.options.validateSearch as (s: Record<string, unknown>) => { fecha: string })({}).fecha;

describe("fecha por defecto de la agenda", () => {
  afterEach(() => vi.useRealTimers());

  it("usa el día de hoy en Chile", () => {
    // 15:00 UTC del 7-sep-2026 = mediodía en Santiago, mismo día.
    vi.setSystemTime(new Date("2026-09-07T15:00:00Z"));
    expect(fechaPorDefecto()).toBe("2026-09-07");
  });

  it("cruza la medianoche sin quedarse en ayer", () => {
    vi.setSystemTime(new Date("2026-09-07T23:00:00Z")); // 20:00 en Santiago
    expect(fechaPorDefecto()).toBe("2026-09-07");

    // Cuatro horas después ya es otro día en Santiago, sin recargar el módulo.
    vi.setSystemTime(new Date("2026-09-08T03:30:00Z")); // 00:30 en Santiago
    expect(fechaPorDefecto()).toBe("2026-09-08");
  });

  it("respeta el huso de Chile, no el UTC", () => {
    // 02:00 UTC del 8-sep todavía es el 7-sep en Santiago (UTC-3).
    vi.setSystemTime(new Date("2026-09-08T02:00:00Z"));
    expect(fechaPorDefecto()).toBe("2026-09-07");
  });

  it("una fecha explícita en la URL le gana al default", () => {
    vi.setSystemTime(new Date("2026-09-07T15:00:00Z"));
    const search = Route.options.validateSearch as (s: Record<string, unknown>) => {
      fecha: string;
    };
    expect(search({ fecha: "2026-12-24" }).fecha).toBe("2026-12-24");
  });
});
