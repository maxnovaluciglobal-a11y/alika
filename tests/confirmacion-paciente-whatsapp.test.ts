import { describe, expect, it } from "vitest";

import {
  esConfirmacionDePaciente,
  normalizarRespuesta,
} from "@/lib/messaging/patient-confirmation";

describe("esConfirmacionDePaciente", () => {
  it("acepta las formas cortas y literales de decir que sí", () => {
    for (const t of [
      "sí",
      "SI",
      "Si!",
      "sip",
      "ok",
      "Okey",
      "dale",
      "listo",
      "confirmo",
      "Sí, confirmo",
      "ahí voy",
      "Ahí estaré.",
      "sí gracias",
      "asistiré",
      "nos vemos",
    ]) {
      expect(esConfirmacionDePaciente(t), `debería confirmar: ${t}`).toBe(true);
    }
  });

  it("NO confirma una pregunta, aunque contenga un sí", () => {
    // El caso que más importa: "si" como conjunción condicional.
    for (const t of [
      "si me confirmás la hora, voy",
      "¿sí?",
      "sí pero a qué hora?",
      "ok pero puedo llegar 15 min tarde?",
      "¿puedo llevar a mi hijo?",
    ]) {
      expect(esConfirmacionDePaciente(t), `NO debería confirmar: ${t}`).toBe(false);
    }
  });

  it("NO confirma una negación, ni una que empiece pareciendo un sí", () => {
    for (const t of ["no", "No puedo", "no voy a poder ir", "NO, sí voy", "no sé todavía"]) {
      expect(esConfirmacionDePaciente(t), `NO debería confirmar: ${t}`).toBe(false);
    }
  });

  it("NO confirma un mensaje largo: eso es una conversación, no un sí", () => {
    expect(
      esConfirmacionDePaciente(
        "sí, ahí voy, aunque capaz llegue unos minutos tarde porque salgo del trabajo",
      ),
    ).toBe(false);
  });

  it("NO confirma texto vacío ni solo signos", () => {
    expect(esConfirmacionDePaciente("")).toBe(false);
    expect(esConfirmacionDePaciente("   ")).toBe(false);
    expect(esConfirmacionDePaciente("...")).toBe(false);
  });

  it("NO confirma una frase que apenas CONTIENE una confirmación", () => {
    // La regla es igualdad del mensaje completo, no `includes`.
    expect(esConfirmacionDePaciente("mi mamá dijo que sí")).toBe(false);
    expect(esConfirmacionDePaciente("dale un aviso a la doctora")).toBe(false);
  });

  it("las palabras de baja no se confunden con una confirmación", () => {
    for (const t of ["BAJA", "STOP", "CANCELAR", "UNSUBSCRIBE"]) {
      expect(esConfirmacionDePaciente(t)).toBe(false);
    }
  });

  it("normalizarRespuesta saca tildes, signos y espacios de más", () => {
    expect(normalizarRespuesta("  Sí,   ahí   voy!! ")).toBe("SI AHI VOY");
    expect(normalizarRespuesta("Ok.")).toBe("OK");
  });
});
