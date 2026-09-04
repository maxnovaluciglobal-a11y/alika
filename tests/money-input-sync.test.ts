import { describe, expect, it } from "vitest";

import { centsATexto, textoACents, textoSincronizado } from "../src/lib/money-input-sync";

/**
 * `MoneyInput` guarda el texto crudo adentro y habla cents con el resto de la
 * app. Esta es la regla que decide cuándo puede pisar lo que el usuario está
 * escribiendo. Vive en un módulo aparte porque el repo no monta componentes
 * en los tests, y esta es la parte que puede romperse en silencio.
 */
describe("textoACents", () => {
  it("vacío es sin dato, no cero (regla 11)", () => {
    expect(textoACents("", "MXN")).toBeNull();
    expect(textoACents("   ", "MXN")).toBeNull();
  });

  it("cero es un valor real, no ausencia", () => {
    expect(textoACents("0", "MXN")).toBe(0);
  });

  it("texto a medio escribir nunca produce NaN", () => {
    expect(textoACents("-", "MXN")).toBeNull();
    expect(textoACents("abc", "MXN")).toBeNull();
    // Un punto colgando es un número válido para `Number`: 45.
    expect(textoACents("45.", "MXN")).toBe(4_500);
  });

  it("convierte con el factor de la moneda", () => {
    expect(textoACents("45.5", "MXN")).toBe(4_550);
    expect(textoACents("45", "CLP")).toBe(45);
  });
});

describe("textoSincronizado", () => {
  it("no pisa el texto cuando representa los mismos cents", () => {
    // El caso que motiva todo: sin esto, escribir el punto lo borraría.
    expect(textoSincronizado("45.", 4_500, "MXN")).toBeNull();
    expect(textoSincronizado("45", 4_500, "MXN")).toBeNull();
    expect(textoSincronizado("45.50", 4_550, "MXN")).toBeNull();
  });

  it("no pisa ceros a la derecha mientras el valor no cambie", () => {
    expect(textoSincronizado("45.00", 4_500, "MXN")).toBeNull();
    expect(textoSincronizado("045", 4_500, "MXN")).toBeNull();
  });

  it("sí reescribe cuando el valor de afuera cambió de verdad", () => {
    // Ej: el usuario elige una prestación del catálogo y el precio se precarga.
    expect(textoSincronizado("45", 9_000, "MXN")).toBe("90");
    expect(textoSincronizado("45", 9_000, "CLP")).toBe("9000");
  });

  it("limpiar el valor desde afuera vacía el input", () => {
    expect(textoSincronizado("45", null, "MXN")).toBe("");
  });

  it("cargar un valor sobre un input vacío lo llena", () => {
    expect(textoSincronizado("", 4_550, "MXN")).toBe("45.5");
    expect(textoSincronizado("", 0, "MXN")).toBe("0");
  });

  it("ida y vuelta: lo que muestra vuelve a los mismos cents", () => {
    for (const moneda of ["CLP", "MXN", "USD", "PYG"]) {
      for (const cents of [null, 0, 1, 4_550, 1_234_567]) {
        expect(textoACents(centsATexto(cents, moneda), moneda)).toBe(cents);
      }
    }
  });
});
