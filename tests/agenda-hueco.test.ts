import { describe, expect, it } from "vitest";

import {
  etiquetaHueco,
  horaDeMinutos,
  rangoDeGrilla,
  huecosLibres,
  minutosAhoraEnZona,
  redondearACuarto,
  semillaDeHueco,
} from "@/components/agenda-hueco";

/**
 * Clic en un hueco de la grilla de día → "Nueva cita" precargada.
 * La hora es de pared (wall-clock) de la sucursal: nada de husos acá.
 */

describe("redondearACuarto", () => {
  it("baja al cuarto de hora donde cayó el clic", () => {
    expect(redondearACuarto(0)).toBe(0);
    expect(redondearACuarto(14)).toBe(0);
    expect(redondearACuarto(15)).toBe(15);
    expect(redondearACuarto(158)).toBe(150); // 10:38 → 10:30
    expect(redondearACuarto(164.9)).toBe(150);
  });

  it("antes de las 08:00 sigue redondeando, sin pasar de medianoche ni dar NaN", () => {
    expect(redondearACuarto(-7)).toBe(-15); // 07:53 → 07:45
    expect(redondearACuarto(-9999)).toBe(-480); // nunca antes de las 00:00
    expect(redondearACuarto(Number.NaN)).toBe(0);
  });
});

describe("horaDeMinutos", () => {
  it("cuenta desde HORA_INICIO (08:00)", () => {
    expect(horaDeMinutos(0)).toBe("08:00");
    expect(horaDeMinutos(150)).toBe("10:30");
    expect(horaDeMinutos(405)).toBe("14:45");
  });
});

describe("semillaDeHueco", () => {
  it("arma el valor del datetime-local sin convertir husos", () => {
    expect(
      semillaDeHueco({
        fecha: "2026-10-07",
        minutos: 158,
        profesional: { id: "p1", sucursalId: "s1" },
      }),
    ).toEqual({ startsAt: "2026-10-07T10:30", profesionalId: "p1", sucursalId: "s1" });
  });

  it("sin sucursal deja el campo vacío para que el diálogo la pida", () => {
    expect(
      semillaDeHueco({ fecha: "2026-10-07", minutos: 0, profesional: { id: "p1" } }).sucursalId,
    ).toBe("");
  });
});

describe("huecosLibres", () => {
  it("excluye toda franja que se pisa con una cita, aunque sea en parte", () => {
    // Cita 08:30-09:10 → ocupa 08:30, 08:45 y 09:00.
    const libres = huecosLibres([{ inicio: 30, duracion: 40 }], 120);
    expect(libres).toEqual([0, 15, 75, 90, 105]);
  });

  it("sin citas, todas las franjas de 15 min", () => {
    expect(huecosLibres([], 60)).toEqual([0, 15, 30, 45]);
  });
});

describe("rangoDeGrilla", () => {
  it("sin citas, la jornada base de 08:00 a 20:00", () => {
    expect(rangoDeGrilla([])).toEqual({ desde: 0, hasta: 720 });
  });

  it("se alarga hasta la hora en punto que cubre la última cita", () => {
    // 19:30 a 20:15 → la grilla llega a las 21:00.
    expect(rangoDeGrilla([{ inicio: 690, duracion: 45 }])).toEqual({ desde: 0, hasta: 780 });
  });

  it("arranca antes de las 08:00 si hay una cita temprana", () => {
    // 07:30 → la grilla arranca a las 07:00.
    expect(rangoDeGrilla([{ inicio: -30, duracion: 30 }])).toEqual({ desde: -60, hasta: 720 });
  });

  it("nunca sale del día", () => {
    expect(
      rangoDeGrilla([
        { inicio: -600, duracion: 30 },
        { inicio: 960, duracion: 120 },
      ]),
    ).toEqual({
      desde: -480,
      hasta: 960,
    });
  });
});

describe("etiquetaHueco", () => {
  it("dice con quién y a qué hora", () => {
    expect(etiquetaHueco("Dra. Pérez", 150)).toBe("Agendar con Dra. Pérez a las 10:30");
  });
});

describe("minutosAhoraEnZona", () => {
  it("lee la hora en el huso de la clínica, no del runtime", () => {
    // 13:42 UTC = 10:42 en Santiago (UTC-3 en octubre) = 07:42 en CDMX (UTC-6).
    const ahora = new Date("2026-10-07T13:42:00Z");
    expect(minutosAhoraEnZona("America/Santiago", ahora)).toBe(162);
    expect(minutosAhoraEnZona("America/Mexico_City", ahora)).toBe(-18);
  });

  it("medianoche es 00, no 24", () => {
    const ahora = new Date("2026-10-07T03:00:00Z"); // 00:00 en Santiago
    expect(minutosAhoraEnZona("America/Santiago", ahora)).toBe(-480);
  });
});
