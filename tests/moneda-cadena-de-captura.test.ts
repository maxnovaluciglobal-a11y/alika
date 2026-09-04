import { describe, expect, it } from "vitest";

import { parsearMonto } from "../src/lib/arancel-csv";
import { formatMoney, fromCents, pasoDeMoneda, toCents } from "../src/lib/finance";

/**
 * La tanda de moneda (05-sep-2026). La auditoría del 04-sep encontró que toda
 * la cadena de escritura cableaba `"CLP"` y que dos convenciones de captura
 * convivían: unos archivos convertían con `toCents` y otros guardaban el
 * número tipeado directo como si ya fueran cents.
 *
 * En CLP el factor es 1, así que las dos convenciones daban el mismo
 * resultado y el bug era invisible. Estas pruebas corren en MXN justamente
 * porque ahí las dos convenciones difieren en 100×: si alguien vuelve a
 * guardar el número crudo, acá falla.
 */
describe("cadena de captura de dinero", () => {
  it("MXN: lo que el usuario tipea llega a cents multiplicado por 100", () => {
    expect(toCents(450, "MXN")).toBe(45_000);
    expect(toCents(45.5, "MXN")).toBe(4_550);
  });

  it("CLP: el mismo camino no multiplica, porque no tiene subunidad", () => {
    expect(toCents(45_000, "CLP")).toBe(45_000);
  });

  it("guardar el número crudo como cents es el bug: en MXN difiere 100×", () => {
    const tipeado = 450;
    const correcto = toCents(tipeado, "MXN");
    const bug = tipeado; // lo que hacían gastos, aranceles, laboratorios y el presupuesto
    expect(correcto).toBe(bug * 100);
    // Y en CLP los dos caminos coinciden, que es por lo que nadie lo vio.
    expect(toCents(tipeado, "CLP")).toBe(bug);
  });

  it("ida y vuelta: lo guardado vuelve a la pantalla sin desviarse", () => {
    for (const moneda of ["CLP", "MXN", "COP", "USD", "PYG", "BRL"]) {
      for (const visible of [0, 1, 45.5, 1234.99, 999_999]) {
        // En una moneda sin decimales el usuario no puede tipear 45.5; el
        // resto tiene que sobrevivir el viaje completo.
        const esperado = pasoDeMoneda(moneda) === 1 ? Math.round(visible) : visible;
        expect(fromCents(toCents(esperado, moneda), moneda)).toBe(esperado);
      }
    }
  });

  it("el CSV del arancel entrega unidades visibles y el llamador convierte", () => {
    // Una planilla mexicana con "1.250,75" son mil doscientos cincuenta pesos
    // con setenta y cinco centavos: 125075 cents, no 1251.
    const visible = parsearMonto("$1.250,75");
    expect(visible).toBe(1250.75);
    expect(toCents(visible!, "MXN")).toBe(125_075);
    // La misma celda leída por una clínica chilena son 1251 pesos enteros:
    // CLP no tiene dónde poner los 75 centavos.
    expect(toCents(visible!, "CLP")).toBe(1_251);
  });

  it("el paso del input deja tipear decimales solo donde existen", () => {
    expect(pasoDeMoneda("CLP")).toBe(1);
    expect(pasoDeMoneda("PYG")).toBe(1);
    expect(pasoDeMoneda("MXN")).toBe(0.01);
    expect(pasoDeMoneda("USD")).toBe(0.01);
  });

  it("formatear y capturar son inversas para la misma moneda", () => {
    const cents = toCents(1234.5, "MXN");
    expect(formatMoney(cents, "MXN")).toContain("1,234.50");
  });
});
