import { afterEach, describe, expect, it, vi } from "vitest";

import { Route } from "@/routes/_authenticated/_clinic/agenda";
import { fechaDeAgenda } from "@/lib/clinic-operations/clinic-data";

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

  it("no pone fecha si la URL no la trae: el huso de la clínica no se conoce acá", () => {
    vi.setSystemTime(new Date("2026-09-07T15:00:00Z"));
    expect(fechaPorDefecto()).toBe("");
  });

  it("cruza la medianoche sin quedarse en ayer", () => {
    // El bug original: `const HOY = hoyISO()` se congelaba al cargar el módulo.
    vi.setSystemTime(new Date("2026-09-07T23:00:00Z")); // 20:00 en Santiago
    expect(fechaDeAgenda("", "America/Santiago")).toBe("2026-09-07");

    // Cuatro horas después ya es otro día, sin recargar el módulo.
    vi.setSystemTime(new Date("2026-09-08T03:30:00Z")); // 00:30 en Santiago
    expect(fechaDeAgenda("", "America/Santiago")).toBe("2026-09-08");
  });

  it("⭐ cada clínica abre en SU día, no en el de Chile", () => {
    // 2026-09-08T02:00:00Z: en Santiago ya es el 7 a las 23:00, pero en México
    // son las 20:00 del 7 y en UTC ya es el 8. Antes, el default salía del huso
    // de Chile para todos, así que una clínica mexicana trabajando de noche
    // abría la agenda en el día equivocado.
    vi.setSystemTime(new Date("2026-09-08T02:00:00Z"));
    expect(fechaDeAgenda("", "America/Santiago")).toBe("2026-09-07");
    expect(fechaDeAgenda("", "America/Mexico_City")).toBe("2026-09-07");
    expect(fechaDeAgenda("", "UTC")).toBe("2026-09-08");
  });

  it("un huso más al este puede estar un día adelante del de Chile", () => {
    // 2026-09-08T01:00:00Z: 22:00 del 7 en Santiago, pero ya es el 8 en Madrid.
    vi.setSystemTime(new Date("2026-09-08T01:00:00Z"));
    expect(fechaDeAgenda("", "America/Santiago")).toBe("2026-09-07");
    expect(fechaDeAgenda("", "Europe/Madrid")).toBe("2026-09-08");
  });

  it("una fecha explícita en la URL le gana al default", () => {
    vi.setSystemTime(new Date("2026-09-07T15:00:00Z"));
    const search = Route.options.validateSearch as (s: Record<string, unknown>) => {
      fecha: string;
    };
    expect(search({ fecha: "2026-12-24" }).fecha).toBe("2026-12-24");
  });
});
