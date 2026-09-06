import { describe, expect, it } from "vitest";
import { resolveActiveMembership } from "../src/lib/access/access.functions";

/**
 * Prueba pura, sin DB: cubre la lógica de selección de clínica activa
 * (progresivo #7, plan Carlos 05-sep-2026) — con 2+ membresías, cuál usa
 * getMyAccess según la cookie de preferencia, y los casos donde esa cookie
 * ya no sirve (clínica de la que se sacó al usuario, cookie corrupta, etc.).
 */
describe("resolveActiveMembership", () => {
  const clinicA = { role: "owner", clinics: { id: "clinic-a" } };
  const clinicB = { role: "dentist", clinics: { id: "clinic-b" } };

  it("sin preferencia, devuelve la primera membresía", () => {
    expect(resolveActiveMembership([clinicA, clinicB], null)).toBe(clinicA);
  });

  it("con preferencia válida, devuelve esa membresía aunque no sea la primera", () => {
    expect(resolveActiveMembership([clinicA, clinicB], "clinic-b")).toBe(clinicB);
  });

  it("preferencia que no matchea ninguna membresía real: cae a la primera", () => {
    expect(resolveActiveMembership([clinicA, clinicB], "clinic-inexistente")).toBe(clinicA);
  });

  it("membresía con clinics null (clínica borrada) se ignora, incluso si es la preferida", () => {
    const borrada = { role: "admin", clinics: null };
    expect(resolveActiveMembership([borrada, clinicA], "clinic-a")).toBe(clinicA);
    expect(resolveActiveMembership([borrada, clinicA], null)).toBe(clinicA);
  });

  it("una sola membresía: la devuelve sin importar la preferencia", () => {
    expect(resolveActiveMembership([clinicA], "clinic-b")).toBe(clinicA);
  });

  it("sin ninguna membresía válida, devuelve null", () => {
    expect(resolveActiveMembership([], null)).toBeNull();
    expect(resolveActiveMembership([{ role: "admin", clinics: null }], null)).toBeNull();
  });
});
