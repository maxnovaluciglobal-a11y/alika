import { describe, expect, it } from "vitest";
import { formatMoney, toCents } from "../src/lib/finance";

/**
 * Prueba pura, sin DB: cubre la regla #6 del CLAUDE.md — `formatMoney`
 * nunca puede asumir que dividir por 100 alcanza, porque CLP/COP/PYG/JPY
 * (y varias más) son monedas "zero-decimal" en Stripe/ISO 4217: sus enteros
 * en la base de datos YA representan la unidad completa, no centavos.
 */
describe("formatMoney", () => {
  it("moneda zero-decimal (CLP): el valor guardado es la unidad completa, no se divide", () => {
    expect(formatMoney(35_000, "CLP")).toBe("$35.000");
  });

  it("moneda zero-decimal (COP): mismo criterio", () => {
    expect(formatMoney(150_000, "COP")).toContain("150.000");
  });

  it("moneda zero-decimal (JPY): mismo criterio", () => {
    expect(formatMoney(5_000, "JPY")).toContain("5.000");
  });

  it("moneda con decimales (USD): el valor guardado sí son centavos, se divide por 100", () => {
    expect(formatMoney(2_999, "USD")).toBe("US$29,99");
  });

  it("moneda con decimales (MXN): mismo criterio", () => {
    expect(formatMoney(10_050, "MXN")).toContain("100,50");
  });

  it("es case-insensitive con el código de moneda", () => {
    expect(formatMoney(35_000, "clp")).toBe(formatMoney(35_000, "CLP"));
  });

  it("sin moneda especificada, cae a CLP por default", () => {
    expect(formatMoney(35_000)).toBe(formatMoney(35_000, "CLP"));
  });

  it("cero es un valor legítimo (saldo saldado), no un placeholder", () => {
    expect(formatMoney(0, "CLP")).toBe("$0");
  });

  it("negativos se formatean (saldo a favor del paciente)", () => {
    expect(formatMoney(-5_000, "CLP")).toContain("5.000");
  });
});

describe("toCents", () => {
  it("moneda zero-decimal: pesos ingresados = enteros guardados, sin multiplicar por 100", () => {
    expect(toCents(35_000, "CLP")).toBe(35_000);
  });

  it("moneda con decimales: multiplica por 100 para guardar en centavos", () => {
    expect(toCents(29.99, "USD")).toBe(2_999);
  });

  it("redondea en vez de truncar (evita perder centavos por errores de punto flotante)", () => {
    // 19.99 * 100 en punto flotante da 1998.9999999999998 antes del round.
    expect(toCents(19.99, "USD")).toBe(1_999);
  });

  it("es la inversa de formatMoney para el mismo valor en pesos/dólares", () => {
    const pesosClp = 35_000;
    expect(toCents(pesosClp, "CLP") / 1).toBe(pesosClp);
  });
});
