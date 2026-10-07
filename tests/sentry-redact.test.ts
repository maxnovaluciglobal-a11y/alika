import { describe, expect, it } from "vitest";

import { redactPostgresLiterals, redactPostgresLiteralsInString } from "@/lib/sentry-redact";

describe("redacción de PII antes de Sentry", () => {
  it("quita el valor de (columna)=(valor)", () => {
    expect(redactPostgresLiteralsInString("Key (email)=(ana@clinica.cl) already exists.")).toBe(
      "Key (email)=(redacted) already exists.",
    );
  });

  it("quita la fila entera de las violaciones de NOT NULL y CHECK", () => {
    const m =
      'null value in column "rut" violates not-null constraint. Failing row contains (3f2a, Ana Pérez, +56 9 1234 5678, ana@clinica.cl).';
    const r = redactPostgresLiteralsInString(m);
    expect(r).toContain("Failing row contains (redacted)");
    expect(r).not.toMatch(/Ana|ana@|1234/);
  });

  it("redacta mensaje y valores de excepción del evento", () => {
    const evento = {
      message: "Key (dni)=(12345678) already exists.",
      exception: { values: [{ value: "Failing row contains (x, Juan)" }] },
    };
    redactPostgresLiterals(evento);
    expect(evento.message).toBe("Key (dni)=(redacted) already exists.");
    expect(evento.exception.values[0].value).toBe("Failing row contains (redacted)");
  });
});
