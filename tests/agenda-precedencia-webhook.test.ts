import { describe, expect, it } from "vitest";

import { interpretarMensajeDeAgenda } from "@/lib/messaging/intencion-de-agenda";
import { esConfirmacionDePaciente } from "@/lib/messaging/patient-confirmation";

/**
 * El webhook resuelve un mensaje entrante en un orden fijo, y ese orden es lo
 * que impide que F4 pise a F1 o al opt-out:
 *
 *   1. baja (BAJA/STOP/CANCELAR/UNSUBSCRIBE, mensaje completo)
 *   2. aviso del paciente ("sí", "ahí voy")  → patient_confirmed_at
 *   3. solicitud de agenda (F4)              → appointment_requests
 *   4. aviso genérico
 *
 * Estos tests fijan que las tres lecturas no se solapen. No tocan Postgres:
 * lo que se verifica es que las funciones puras no reclamen el mismo mensaje.
 */

const OPT_OUT = new Set(["BAJA", "STOP", "CANCELAR", "UNSUBSCRIBE"]);
const esBaja = (t: string) => OPT_OUT.has(t.trim().toUpperCase());
const HOY = new Date(2026, 8, 7);

describe("las tres lecturas no se pisan", () => {
  it("una baja no se lee como pedido de agenda ni como confirmación", () => {
    for (const t of ["BAJA", "stop", "Cancelar", "UNSUBSCRIBE"]) {
      expect(esBaja(t)).toBe(true);
      expect(interpretarMensajeDeAgenda(t, HOY)).toBeNull();
      expect(esConfirmacionDePaciente(t)).toBe(false);
    }
  });

  it("una confirmación no se lee como pedido de agenda", () => {
    for (const t of ["si", "SI", "ok", "dale", "confirmo"]) {
      expect(interpretarMensajeDeAgenda(t, HOY)).toBeNull();
    }
  });

  it("un pedido de hora no se lee como confirmación ni como baja", () => {
    for (const t of [
      "quiero hora para el jueves",
      "necesito cambiar mi cita",
      "quiero cancelar mi hora del viernes",
      "no voy a poder ir",
    ]) {
      expect(esBaja(t)).toBe(false);
      expect(esConfirmacionDePaciente(t)).toBe(false);
      expect(interpretarMensajeDeAgenda(t, HOY)).not.toBeNull();
    }
  });

  it("⚠️ 'CANCELAR' pelado sigue siendo una BAJA, no una cancelación de cita", () => {
    // Ambigüedad real y conocida del vocabulario de opt-out. Se deja como
    // está a propósito: leer mal una baja es un problema legal (Ley 21.719),
    // y equivocarse hacia "el paciente pidió la baja" es el error barato.
    // Con contexto, en cambio, sí se lee como cancelación de cita.
    expect(esBaja("CANCELAR")).toBe(true);
    expect(esBaja("quiero cancelar mi hora")).toBe(false);
    expect(interpretarMensajeDeAgenda("quiero cancelar mi hora", HOY)?.intencion).toBe("cancelar");
  });
});

describe("sólo 'agendar con fecha' crea una solicitud", () => {
  // Mover o cancelar tocan una cita concreta que hay que elegir; eso es
  // decisión de la clínica, no del webhook. Y `appointment_requests` exige
  // `preferred_date NOT NULL`, así que sin fecha no hay fila posible.
  const creaFila = (t: string) => {
    const l = interpretarMensajeDeAgenda(t, HOY);
    return l !== null && l.intencion === "agendar" && l.fecha !== null;
  };

  it("crea fila con intención de agendar y fecha", () => {
    expect(creaFila("quiero hora para el jueves")).toBe(true);
    expect(creaFila("¿tienen hora mañana por la tarde?")).toBe(true);
  });

  it("NO crea fila sin fecha, aunque la intención sea clara", () => {
    expect(creaFila("quiero una hora")).toBe(false);
  });

  it("NO crea fila para mover ni cancelar", () => {
    expect(creaFila("necesito cambiar mi hora del jueves")).toBe(false);
    expect(creaFila("quiero cancelar mi hora del jueves")).toBe(false);
  });
});
