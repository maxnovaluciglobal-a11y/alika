import { describe, expect, it } from "vitest";

import { wallTimeInTzToUtc } from "@/lib/appointments.functions";

/**
 * `wallTimeInTzToUtc` interpreta el string crudo de un
 * <input type="datetime-local"> ("YYYY-MM-DDTHH:mm") como wall-clock EN LA
 * TIMEZONE DE LA SUCURSAL, no en la del servidor. Bug real documentado en
 * appointments.functions.ts:~178 y commit bd88622: en Vercel el server corre
 * en UTC, así que sin este fix una cita cargada por recepción en Santiago a
 * las 10:00 quedaba guardada como si fueran las 10:00 UTC — 3-4 horas
 * corridas según la fecha (Chile no tiene DST fijo, el offset cambia según
 * la época del año).
 */
describe("wallTimeInTzToUtc — el fix del bug de 3-4hs con la clínica piloto", () => {
  it("reproduce el escenario real: 10:00 en Santiago NO debe guardarse como 10:00 UTC", () => {
    const local = "2026-08-21T10:00";
    const utc = wallTimeInTzToUtc(local, "America/Santiago");
    // Interpretado ingenuamente como UTC (el bug original), habría dado
    // "2026-08-21T10:00:00.000Z". El fix corrido tiene que dar otra hora.
    expect(utc.toISOString()).not.toBe("2026-08-21T10:00:00.000Z");
    // 21-ago-2026 Chile está en horario de invierno (UTC-4, sin DST activo
    // en esa fecha — Chile suspendió el cambio de hora en 2019 y desde
    // entonces corre casi todo el año en UTC-4/-3 fijo por temporada).
    expect(utc.toISOString()).toBe("2026-08-21T14:00:00.000Z");
  });

  it("America/Santiago: 09:00 local se guarda como 13:00Z en fecha sin DST activo", () => {
    const utc = wallTimeInTzToUtc("2026-06-15T09:00", "America/Santiago");
    expect(utc.toISOString()).toBe("2026-06-15T13:00:00.000Z");
  });

  it("America/Mexico_City: sin DST desde 2022, offset fijo UTC-6 todo el año", () => {
    const utc = wallTimeInTzToUtc("2026-08-21T09:00", "America/Mexico_City");
    expect(utc.toISOString()).toBe("2026-08-21T15:00:00.000Z");
  });

  it("America/Bogota: offset fijo UTC-5, sin DST", () => {
    const utc = wallTimeInTzToUtc("2026-08-21T09:00", "America/Bogota");
    expect(utc.toISOString()).toBe("2026-08-21T14:00:00.000Z");
  });

  it("acepta datetime-local sin segundos (16 chars) y con segundos (19 chars) igual", () => {
    const sinSegundos = wallTimeInTzToUtc("2026-08-21T09:00", "America/Bogota");
    const conSegundos = wallTimeInTzToUtc("2026-08-21T09:00:00", "America/Bogota");
    expect(sinSegundos.toISOString()).toBe(conSegundos.toISOString());
  });

  it("cambio de día por diferencia horaria: 23:30 en Santiago cae en el día siguiente en UTC", () => {
    const utc = wallTimeInTzToUtc("2026-08-21T23:30", "America/Santiago");
    // 23:30 -04:00 del 21 -> 03:30 UTC del 22.
    expect(utc.toISOString()).toBe("2026-08-22T03:30:00.000Z");
  });

  it("timezone sin offset (UTC/GMT) devuelve el mismo instante tal cual", () => {
    const utc = wallTimeInTzToUtc("2026-08-21T10:00", "UTC");
    expect(utc.toISOString()).toBe("2026-08-21T10:00:00.000Z");
  });

  it("misma hora local, distintas sucursales/tz, produce instantes UTC distintos (no confunde una tz con otra)", () => {
    const local = "2026-08-21T09:00";
    const santiago = wallTimeInTzToUtc(local, "America/Santiago").getTime();
    const mexico = wallTimeInTzToUtc(local, "America/Mexico_City").getTime();
    const bogota = wallTimeInTzToUtc(local, "America/Bogota").getTime();
    expect(santiago).not.toBe(mexico);
    expect(mexico).not.toBe(bogota);
    expect(santiago).not.toBe(bogota);
  });

  it("Chile SÍ observa DST en fechas de verano (a diferencia de México/Colombia): 10:00 en enero (UTC-3) no cae en la misma hora UTC que 10:00 en junio (UTC-4)", () => {
    // El punto de este caso es que el helper NO hardcodea un offset fijo
    // para Santiago: delega en Intl.DateTimeFormat, que sigue las reglas
    // IANA vigentes en la fecha concreta. Enero es verano en Chile
    // (horario de verano activo, UTC-3); junio es invierno (UTC-4). Misma
    // hora local, un instante UTC distinto.
    const enero = wallTimeInTzToUtc("2026-01-15T10:00", "America/Santiago");
    const junio = wallTimeInTzToUtc("2026-06-15T10:00", "America/Santiago");
    expect(enero.toISOString()).toBe("2026-01-15T13:00:00.000Z"); // UTC-3
    expect(junio.toISOString()).toBe("2026-06-15T14:00:00.000Z"); // UTC-4
    expect(enero.getTime()).not.toBe(junio.getTime());
  });
});
