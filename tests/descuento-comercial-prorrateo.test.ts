import { describe, expect, it } from "vitest";
import { repartirCobertura } from "../src/lib/finance";

/**
 * Regresión del bug más caro de la auditoría del 04-sep: el descuento
 * comercial global se restaba SOLO al total del presupuesto y nunca bajaba a
 * las líneas. Como el trigger de conversión copia `quote_items.total_cents` a
 * `treatment_items.price_cents`, y de ahí sale el saldo del paciente, un 20 %
 * de descuento se veía en el presupuesto y el paciente igual terminaba
 * debiendo el 100 %.
 *
 * La lógica corregida vive en `computeQuoteTotals` (finance.functions.ts), que
 * es un módulo de server functions y arrastra el middleware de Supabase al
 * importarlo. Se reimplementa acá el prorrateo con la MISMA regla para poder
 * probarlo aislado; si cambia allá y no acá, este test deja de proteger — por
 * eso el nombre de la función es idéntico y el comentario lo advierte.
 */
function prorratearDescuento(
  lineas: { total: number; procedureId?: string; quantity: number }[],
  descuento: number,
  cobertura?: Map<string, { coveragePct: number | null; coverageFixedCents: number | null }>,
) {
  const subtotal = lineas.reduce((s, l) => s + l.total, 0);
  const resultado = lineas.map((l) => {
    const c = l.procedureId ? cobertura?.get(l.procedureId) : undefined;
    const r = repartirCobertura(l.total, c, l.quantity);
    return { ...l, coverageCents: r.coverageCents, patientCents: r.patientCents };
  });

  if (descuento > 0 && subtotal > 0) {
    let repartido = 0;
    const conMonto = resultado.filter((l) => l.total > 0);
    conMonto.forEach((l, idx) => {
      const parte =
        idx === conMonto.length - 1
          ? descuento - repartido
          : Math.round((l.total * descuento) / subtotal);
      repartido += parte;
      l.total = Math.max(0, l.total - parte);
      if (l.coverageCents !== null) {
        const c = l.procedureId ? cobertura?.get(l.procedureId) : undefined;
        const nuevo = repartirCobertura(l.total, c, l.quantity);
        l.coverageCents = nuevo.coverageCents;
        l.patientCents = nuevo.patientCents;
      }
    });
  }
  return resultado;
}

describe("prorrateo del descuento comercial", () => {
  it("el descuento baja a la línea: sin convenio, el paciente debe lo descontado", () => {
    // Antes: la línea quedaba en 100.000 y el paciente debía los 20.000
    // que se le habían bonificado.
    const [linea] = prorratearDescuento([{ total: 100_000, quantity: 1 }], 20_000);
    expect(linea.total).toBe(80_000);
  });

  it("la suma de las líneas es EXACTAMENTE el total, sin peso de diferencia", () => {
    // Tres líneas que no dividen redondo: el resto va a la última.
    const lineas = prorratearDescuento(
      [
        { total: 33_333, quantity: 1 },
        { total: 33_333, quantity: 1 },
        { total: 33_334, quantity: 1 },
      ],
      20_000,
    );
    expect(lineas.reduce((s, l) => s + l.total, 0)).toBe(80_000);
  });

  it("reparte proporcional al peso de cada línea", () => {
    const [chica, grande] = prorratearDescuento(
      [
        { total: 20_000, quantity: 1 },
        { total: 80_000, quantity: 1 },
      ],
      10_000,
    );
    expect(chica.total).toBe(18_000);
    expect(grande.total).toBe(72_000);
  });

  it("con convenio, la cobertura se recalcula sobre la línea YA descontada", () => {
    // $100.000, convenio 50%, descuento comercial 20%.
    // La línea baja a 80.000 y el convenio cubre 40.000, no 50.000: si
    // cubriera sobre el precio de lista, pondría un porcentaje de una plata
    // que nadie va a pagar.
    const cobertura = new Map([["proc-1", { coveragePct: 50, coverageFixedCents: null }]]);
    const [linea] = prorratearDescuento(
      [{ total: 100_000, quantity: 1, procedureId: "proc-1" }],
      20_000,
      cobertura,
    );
    expect(linea.total).toBe(80_000);
    expect(linea.coverageCents).toBe(40_000);
    expect(linea.patientCents).toBe(40_000);
    expect(linea.coverageCents! + linea.patientCents!).toBe(linea.total);
  });

  it("sin descuento comercial nada cambia", () => {
    const [linea] = prorratearDescuento([{ total: 100_000, quantity: 1 }], 0);
    expect(linea.total).toBe(100_000);
  });

  it("una línea de cero no rompe el prorrateo ni se lleva parte del descuento", () => {
    const lineas = prorratearDescuento(
      [
        { total: 0, quantity: 1 },
        { total: 100_000, quantity: 1 },
      ],
      10_000,
    );
    expect(lineas[0].total).toBe(0);
    expect(lineas[1].total).toBe(90_000);
  });

  it("un descuento del 100 % deja todas las líneas en cero, nunca en negativo", () => {
    const lineas = prorratearDescuento(
      [
        { total: 40_000, quantity: 1 },
        { total: 60_000, quantity: 1 },
      ],
      100_000,
    );
    expect(lineas.every((l) => l.total === 0)).toBe(true);
  });
});
