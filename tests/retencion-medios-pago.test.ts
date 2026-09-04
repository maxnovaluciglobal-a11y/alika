import { describe, expect, it } from "vitest";
import { netAfterRetention } from "../src/lib/finance";

/**
 * Retención de los medios de pago (G-6). Es el número que separa "lo que
 * facturé" de "lo que me entró al banco", y para el dueño de una clínica esa
 * diferencia es su margen.
 *
 * `registerPayment` congela el resultado de esta función en `payments.net_cents`
 * al cobrar; no se recalcula después, porque la comisión del operador cambia
 * con el tiempo y un recibo viejo tiene que seguir diciendo lo que entró ese
 * día (regla 10).
 */
describe("netAfterRetention", () => {
  it("sin retención el neto es el bruto, sin tocar el número", () => {
    expect(netAfterRetention(100_000, 0)).toBe(100_000);
  });

  it("aplica la comisión real de una tarjeta de crédito chilena", () => {
    // 2,95 % de 100.000 = 2.950 → entran 97.050.
    expect(netAfterRetention(100_000, 2.95)).toBe(97_050);
  });

  it("aplica la comisión de débito", () => {
    // 1,49 % de 100.000 = 1.490 → entran 98.510.
    expect(netAfterRetention(100_000, 1.49)).toBe(98_510);
  });

  it("redondea a entero: el sistema trabaja en cents enteros (regla 6)", () => {
    // 2,95 % de 33.333 = 983,3… → se retiene 983, entran 32.350.
    expect(netAfterRetention(33_333, 2.95)).toBe(32_350);
    expect(Number.isInteger(netAfterRetention(33_333, 2.95))).toBe(true);
  });

  it("una retención del 100 % deja neto cero, no negativo", () => {
    expect(netAfterRetention(50_000, 100)).toBe(0);
  });

  it("un monto de cero queda en cero con cualquier retención", () => {
    expect(netAfterRetention(0, 2.95)).toBe(0);
  });

  it("una retención negativa no infla el neto por encima del bruto", () => {
    // No debería llegar (el CHECK de la tabla lo impide), pero si llegara,
    // sumar plata que nadie pagó sería peor que ignorarla.
    expect(netAfterRetention(100_000, -5)).toBe(100_000);
  });

  it("montos grandes no pierden precisión", () => {
    // 2,95 % de 12.000.000 = 354.000.
    expect(netAfterRetention(12_000_000, 2.95)).toBe(11_646_000);
  });
});
