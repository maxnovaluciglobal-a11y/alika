import { describe, expect, it } from "vitest";

import {
  HORA_DEL_RESUMEN,
  TIMEZONE_POR_DEFECTO,
  VENTANA_DEDUPE_MS,
  armarResumen,
  desdeCuandoBuscarDuplicado,
  esHoraDelResumen,
  horaLocal,
} from "@/lib/messaging/digest-diario";

/**
 * F3 — resumen diario. Todo acá es lógica pura: no toca Postgres, así que
 * corre igual en el CI (que apunta a la base de producción) sin depender de
 * ninguna migración.
 */

describe("horaLocal", () => {
  it("traduce el mismo instante a la hora de cada huso", () => {
    // 12:00 UTC del 7 de septiembre de 2026.
    const momento = new Date("2026-09-07T12:00:00Z");
    expect(horaLocal(momento, "UTC")).toBe(12);
    expect(horaLocal(momento, "America/Santiago")).toBe(9); // UTC-3
    expect(horaLocal(momento, "America/Mexico_City")).toBe(6); // UTC-6
  });

  it("respeta el cambio de hora en vez de asumir un offset fijo", () => {
    // Chile adelantó el reloj el 6 de septiembre de 2026: antes UTC-4,
    // después UTC-3. El mismo 12:00 UTC cae en dos horas locales distintas,
    // así que un offset fijo mandaría el resumen a destiempo media parte del
    // año. (El sentido del salto está medido, no supuesto: asumirlo al revés
    // es el mismo error que corrompió la agenda del seed.)
    expect(horaLocal(new Date("2026-09-05T12:00:00Z"), "America/Santiago")).toBe(8);
    expect(horaLocal(new Date("2026-09-08T12:00:00Z"), "America/Santiago")).toBe(9);
  });

  it("cae al huso por defecto cuando el de la clínica es inválido", () => {
    const momento = new Date("2026-09-07T12:00:00Z");
    expect(horaLocal(momento, "No/Existe")).toBe(horaLocal(momento, TIMEZONE_POR_DEFECTO));
  });
});

describe("esHoraDelResumen", () => {
  it("es verdadero solo en la hora objetivo de ese huso", () => {
    // 11:00 UTC = 08:00 en Santiago (UTC-3).
    const momento = new Date("2026-09-07T11:00:00Z");
    expect(esHoraDelResumen(momento, "America/Santiago")).toBe(true);
    expect(esHoraDelResumen(momento, "UTC")).toBe(false);
  });

  it("dos clínicas en husos distintos reciben su resumen en corridas distintas", () => {
    const santiago = new Date("2026-09-07T11:00:00Z"); // 08:00 en Santiago
    const mexico = new Date("2026-09-07T14:00:00Z"); // 08:00 en Ciudad de México

    expect(esHoraDelResumen(santiago, "America/Santiago")).toBe(true);
    expect(esHoraDelResumen(santiago, "America/Mexico_City")).toBe(false);

    expect(esHoraDelResumen(mexico, "America/Mexico_City")).toBe(true);
    expect(esHoraDelResumen(mexico, "America/Santiago")).toBe(false);
  });

  it("la hora objetivo es configurable", () => {
    const momento = new Date("2026-09-07T12:00:00Z");
    expect(esHoraDelResumen(momento, "UTC", 12)).toBe(true);
    expect(HORA_DEL_RESUMEN).toBe(8);
  });
});

describe("desdeCuandoBuscarDuplicado", () => {
  it("mira hacia atrás la ventana completa", () => {
    const ahora = new Date("2026-09-07T12:00:00Z");
    const desde = new Date(desdeCuandoBuscarDuplicado(ahora));
    expect(ahora.getTime() - desde.getTime()).toBe(VENTANA_DEDUPE_MS);
  });

  it("la ventana cubre el día pero no alcanza al resumen anterior", () => {
    // Si cubriera 24 h o más, el resumen de ayer bloquearía el de hoy para
    // siempre. Si fuera muy corta, una corrida repetida mandaría dos.
    expect(VENTANA_DEDUPE_MS).toBeLessThan(24 * 60 * 60 * 1000);
    expect(VENTANA_DEDUPE_MS).toBeGreaterThan(2 * 60 * 60 * 1000);
  });
});

describe("armarResumen", () => {
  it("no dice nada cuando no hay nada pendiente", () => {
    expect(armarResumen({ recordatorios: 0, sinResponder: 0 })).toBeNull();
  });

  it("cuenta solo los recordatorios", () => {
    const r = armarResumen({ recordatorios: 3, sinResponder: 0 });
    expect(r?.titulo).toBe("Hay 3 recordatorios para mandar hoy");
    expect(r?.link).toBe("/recordatorios");
  });

  it("cuenta solo las conversaciones", () => {
    const r = armarResumen({ recordatorios: 0, sinResponder: 2 });
    expect(r?.titulo).toBe("Hay 2 conversaciones sin responder");
    expect(r?.link).toBe("/conversaciones");
  });

  it("junta las dos cosas y manda al lugar con más trabajo", () => {
    const r = armarResumen({ recordatorios: 4, sinResponder: 1 });
    expect(r?.titulo).toBe("Hay 4 recordatorios y 1 conversación sin responder");
    expect(r?.link).toBe("/recordatorios");
  });

  it("concuerda en singular", () => {
    expect(armarResumen({ recordatorios: 1, sinResponder: 0 })?.titulo).toBe(
      "Hay 1 recordatorio para mandar hoy",
    );
    expect(armarResumen({ recordatorios: 0, sinResponder: 1 })?.titulo).toBe(
      "Hay 1 conversación sin responder",
    );
  });

  it("ignora números negativos o rotos en vez de escribir un disparate", () => {
    expect(armarResumen({ recordatorios: -5, sinResponder: 0 })).toBeNull();
    expect(armarResumen({ recordatorios: 2.7, sinResponder: 0 })?.titulo).toBe(
      "Hay 2 recordatorios para mandar hoy",
    );
  });
});
