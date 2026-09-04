import { describe, expect, it } from "vitest";
import { repartirCobertura } from "../src/lib/finance";

/**
 * Reparto entre convenio y paciente (Tanda B parte 2).
 *
 * Es la lógica más delicada del módulo financiero: `patient_cents` es lo que
 * `fetchPatientBalances` suma como deuda, y ese helper alimenta el saldo de la
 * ficha, el badge de la agenda y el aviso de `payment_due`. Un error acá le
 * cobra de más a un paciente, o de menos a la clínica.
 */
describe("repartirCobertura", () => {
  it("sin convenio devuelve null en ambos lados, no cero", () => {
    // Es la distinción de la regla 11: "sin convenio" no es "el convenio cubre
    // cero". El resto del sistema usa el null para caer a total_cents.
    expect(repartirCobertura(100_000, null)).toEqual({
      coverageCents: null,
      patientCents: null,
    });
    expect(repartirCobertura(100_000, undefined)).toEqual({
      coverageCents: null,
      patientCents: null,
    });
  });

  it("reparte por porcentaje", () => {
    expect(repartirCobertura(100_000, { coveragePct: 60, coverageFixedCents: null })).toEqual({
      coverageCents: 60_000,
      patientCents: 40_000,
    });
  });

  it("una cobertura del 100 % deja al paciente en cero, no en null", () => {
    // Cero es un valor real acá: el paciente no debe nada y el saldo tiene que
    // reflejarlo. Si esto devolviera null, `fetchPatientBalances` caería al
    // precio de lista y le cobraría todo.
    expect(repartirCobertura(80_000, { coveragePct: 100, coverageFixedCents: null })).toEqual({
      coverageCents: 80_000,
      patientCents: 0,
    });
  });

  it("una cobertura del 0 % es distinta de no tener convenio", () => {
    // El convenio existe y decidió no cubrir esta prestación: se registra el
    // cero explícito, no un null.
    expect(repartirCobertura(50_000, { coveragePct: 0, coverageFixedCents: null })).toEqual({
      coverageCents: 0,
      patientCents: 50_000,
    });
  });

  it("reparte por monto fijo (bono de valor cerrado)", () => {
    expect(repartirCobertura(50_000, { coveragePct: null, coverageFixedCents: 30_000 })).toEqual({
      coverageCents: 30_000,
      patientCents: 20_000,
    });
  });

  it("el monto fijo es POR UNIDAD: dos piezas con el mismo bono cubren el doble", () => {
    expect(
      repartirCobertura(100_000, { coveragePct: null, coverageFixedCents: 30_000 }, 2),
    ).toEqual({ coverageCents: 60_000, patientCents: 40_000 });
  });

  it("el convenio nunca cubre más que la línea", () => {
    // Un bono de $50.000 sobre una prestación de $30.000 cubre $30.000. Si
    // cubriera los 50.000, el paciente quedaría a favor por algo que no pagó.
    expect(repartirCobertura(30_000, { coveragePct: null, coverageFixedCents: 50_000 })).toEqual({
      coverageCents: 30_000,
      patientCents: 0,
    });
  });

  it("redondea a cents enteros (regla 6)", () => {
    // 33 % de 33.333 = 10.999,89 → 11.000 para el convenio, 22.333 al paciente.
    const r = repartirCobertura(33_333, { coveragePct: 33, coverageFixedCents: null });
    expect(r.coverageCents).toBe(11_000);
    expect(r.patientCents).toBe(22_333);
    expect(Number.isInteger(r.coverageCents)).toBe(true);
  });

  it("las dos partes siempre suman el total de la línea", () => {
    // Invariante del módulo: si esto se rompe, o se le cobra de más al
    // paciente o la clínica pierde plata sin darse cuenta.
    const casos = [
      { total: 100_000, cov: { coveragePct: 60, coverageFixedCents: null } },
      { total: 33_333, cov: { coveragePct: 33, coverageFixedCents: null } },
      { total: 45_678, cov: { coveragePct: 12.5, coverageFixedCents: null } },
      { total: 50_000, cov: { coveragePct: null, coverageFixedCents: 30_000 } },
      { total: 30_000, cov: { coveragePct: null, coverageFixedCents: 50_000 } },
      { total: 0, cov: { coveragePct: 50, coverageFixedCents: null } },
    ];
    for (const { total, cov } of casos) {
      const { coverageCents, patientCents } = repartirCobertura(total, cov);
      expect(coverageCents! + patientCents!).toBe(total);
    }
  });

  it("una línea de cero reparte cero por ambos lados", () => {
    expect(repartirCobertura(0, { coveragePct: 60, coverageFixedCents: null })).toEqual({
      coverageCents: 0,
      patientCents: 0,
    });
  });

  it("un porcentaje negativo no le hace deber al paciente más que la línea", () => {
    // El CHECK de la tabla lo impide, pero si llegara, cubrir "menos que cero"
    // no puede inflar la deuda.
    const { coverageCents, patientCents } = repartirCobertura(50_000, {
      coveragePct: -20,
      coverageFixedCents: null,
    });
    expect(coverageCents).toBe(0);
    expect(patientCents).toBe(50_000);
  });
});
