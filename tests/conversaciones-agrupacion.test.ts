import { describe, expect, it } from "vitest";

import {
  agruparConversaciones,
  formatVentana,
  serviceWindow,
  sinResponder,
  SERVICE_WINDOW_MS,
  type MessageDirection,
} from "@/lib/messaging/conversations";

const PACIENTES = new Map([
  ["p1", { name: "Ana Rojas", phone: "+56912345678", waOptIn: true, waOptOutAt: null }],
  ["p2", { name: "Beto Díaz", phone: null, waOptIn: false, waOptOutAt: "2026-09-01T10:00:00Z" }],
]);

function msg(patientId: string, direction: MessageDirection, createdAt: string, body = "x") {
  return { patientId, direction, body, createdAt };
}

describe("agruparConversaciones", () => {
  it("toma el mensaje más nuevo como último del hilo", () => {
    // rows llega ordenado desc, que es como lo devuelve la query.
    const out = agruparConversaciones(
      [
        msg("p1", "inbound", "2026-09-07T12:00:00Z", "¿tienen hora hoy?"),
        msg("p1", "outbound", "2026-09-05T09:00:00Z", "recordatorio"),
      ],
      PACIENTES,
    );
    expect(out).toHaveLength(1);
    expect(out[0].lastMessageBody).toBe("¿tienen hora hoy?");
    expect(out[0].lastMessageDirection).toBe("inbound");
    expect(sinResponder(out[0])).toBe(true);
  });

  it("una conversación respondida NO queda sin responder", () => {
    const out = agruparConversaciones(
      [
        msg("p1", "outbound", "2026-09-07T12:05:00Z", "sí, a las 15:00"),
        msg("p1", "inbound", "2026-09-07T12:00:00Z"),
      ],
      PACIENTES,
    );
    expect(sinResponder(out[0])).toBe(false);
    expect(out[0].inboundStreak).toBe(0);
  });

  it("cuenta la racha de entrantes solo hasta el primer saliente hacia atrás", () => {
    const out = agruparConversaciones(
      [
        msg("p1", "inbound", "2026-09-07T12:02:00Z"),
        msg("p1", "inbound", "2026-09-07T12:01:00Z"),
        msg("p1", "inbound", "2026-09-07T12:00:00Z"),
        msg("p1", "outbound", "2026-09-06T10:00:00Z"),
        // Este entrante viejo NO cuenta: está antes del saliente.
        msg("p1", "inbound", "2026-09-05T10:00:00Z"),
      ],
      PACIENTES,
    );
    expect(out[0].inboundStreak).toBe(3);
  });

  it("lastInboundAt es el entrante más reciente, no el primero del hilo", () => {
    const out = agruparConversaciones(
      [
        msg("p1", "outbound", "2026-09-07T13:00:00Z"),
        msg("p1", "inbound", "2026-09-07T12:00:00Z"),
        msg("p1", "inbound", "2026-09-01T12:00:00Z"),
      ],
      PACIENTES,
    );
    expect(out[0].lastInboundAt).toBe("2026-09-07T12:00:00Z");
  });

  it("un hilo solo de salientes no tiene lastInboundAt", () => {
    const out = agruparConversaciones([msg("p1", "outbound", "2026-09-07T12:00:00Z")], PACIENTES);
    expect(out[0].lastInboundAt).toBeNull();
    expect(serviceWindow(out[0].lastInboundAt).open).toBe(false);
  });

  it("ordena las conversaciones por el mensaje más reciente", () => {
    const out = agruparConversaciones(
      [msg("p2", "inbound", "2026-09-07T15:00:00Z"), msg("p1", "inbound", "2026-09-07T09:00:00Z")],
      PACIENTES,
    );
    expect(out.map((c) => c.patientId)).toEqual(["p2", "p1"]);
  });

  it("descarta filas de un paciente que ya no existe en vez de romper", () => {
    const out = agruparConversaciones(
      [
        msg("fantasma", "inbound", "2026-09-07T12:00:00Z"),
        msg("p1", "inbound", "2026-09-07T11:00:00Z"),
      ],
      PACIENTES,
    );
    expect(out.map((c) => c.patientId)).toEqual(["p1"]);
  });

  it("arrastra el opt-out del paciente al resumen", () => {
    const out = agruparConversaciones([msg("p2", "inbound", "2026-09-07T12:00:00Z")], PACIENTES);
    expect(out[0].waOptIn).toBe(false);
    expect(out[0].waOptOutAt).toBe("2026-09-01T10:00:00Z");
  });
});

describe("serviceWindow (ventana de 24h de Meta)", () => {
  const AHORA = new Date("2026-09-07T12:00:00Z").getTime();

  it("está abierta si el paciente escribió hace menos de 24h", () => {
    const v = serviceWindow(new Date(AHORA - 60 * 60_000).toISOString(), AHORA);
    expect(v.open).toBe(true);
    expect(v.minutesLeft).toBe(23 * 60);
  });

  it("cierra exactamente a las 24h, no un minuto después", () => {
    const justo = new Date(AHORA - SERVICE_WINDOW_MS).toISOString();
    expect(serviceWindow(justo, AHORA).open).toBe(false);

    const unMinutoAntes = new Date(AHORA - SERVICE_WINDOW_MS + 60_000).toISOString();
    expect(serviceWindow(unMinutoAntes, AHORA).open).toBe(true);
  });

  it("sin mensaje entrante nunca hubo ventana", () => {
    expect(serviceWindow(null, AHORA)).toEqual({ open: false, minutesLeft: 0 });
  });

  it("una fecha inválida no abre la ventana por accidente", () => {
    // Un NaN comparado con cualquier número da false; el riesgo real es que
    // un `restante` NaN se lea como "abierta". Se fija el comportamiento.
    expect(serviceWindow("no-es-una-fecha", AHORA).open).toBe(false);
  });

  it("formatVentana es legible en horas y minutos", () => {
    expect(formatVentana(0)).toBe("cerrada");
    expect(formatVentana(45)).toBe("45 min");
    expect(formatVentana(120)).toBe("2 h");
    expect(formatVentana(130)).toBe("2 h 10 min");
  });
});
