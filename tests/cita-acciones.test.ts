// Popover de acciones de la cita en la grilla de día. Lógica pura: no toca Postgres.
import { describe, expect, it } from "vitest";

import {
  claseEstadoBadge,
  etiquetaBloqueCita,
  puedeConfirmarCita,
  rangoHorarioCita,
} from "@/components/cita-acciones";
import { parseCobrar, validarBusquedaFicha } from "@/components/ficha-busqueda";

describe("etiquetaBloqueCita", () => {
  it("nombra paciente, hora de pared y estado", () => {
    // inicio = minutos desde HORA_INICIO (08:00)
    expect(etiquetaBloqueCita({ paciente: "Ana Pérez", inicio: 90, estado: "confirmada" })).toBe(
      "Cita de Ana Pérez a las 09:30, confirmada",
    );
  });

  it("baja a minúscula estados de dos palabras", () => {
    expect(etiquetaBloqueCita({ paciente: "Luis", inicio: 0, estado: "en-sala" })).toBe(
      "Cita de Luis a las 08:00, en sala",
    );
  });
});

describe("rangoHorarioCita", () => {
  it("suma la duración al inicio", () => {
    expect(rangoHorarioCita({ inicio: 90, duracion: 45 })).toBe("09:30–10:15");
  });
});

describe("puedeConfirmarCita", () => {
  it("owner y admin confirman cualquier cita", () => {
    expect(puedeConfirmarCita({ role: "owner", myProfessionalId: null }, "p1")).toBe(true);
    expect(puedeConfirmarCita({ role: "admin", myProfessionalId: null }, "p1")).toBe(true);
  });

  it("el dentista solo confirma las propias", () => {
    expect(puedeConfirmarCita({ role: "dentist", myProfessionalId: "p1" }, "p1")).toBe(true);
    expect(puedeConfirmarCita({ role: "dentist", myProfessionalId: "p1" }, "p2")).toBe(false);
  });

  it("recepción sin profesional propio no confirma", () => {
    expect(puedeConfirmarCita({ role: "reception", myProfessionalId: null }, "p1")).toBe(false);
  });
});

describe("claseEstadoBadge", () => {
  it("devuelve la pastilla base", () => {
    expect(claseEstadoBadge("confirmada")).toContain("rounded");
  });
});

describe("?cobrar de la ficha", () => {
  it("acepta 1, '1' y true", () => {
    expect(parseCobrar(1)).toBe(true);
    expect(parseCobrar("1")).toBe(true);
    expect(parseCobrar(true)).toBe(true);
  });

  it("rechaza lo demás", () => {
    for (const v of [undefined, null, 0, "0", "", "si", 2, {}]) expect(parseCobrar(v)).toBe(false);
  });

  it("sin parámetros no agrega claves (los links existentes siguen igual)", () => {
    expect(validarBusquedaFicha({})).toEqual({});
    expect(validarBusquedaFicha({ cobrar: "nope" })).toEqual({});
    expect(validarBusquedaFicha({ cobrar: "1" })).toEqual({ cobrar: 1 });
  });
});
