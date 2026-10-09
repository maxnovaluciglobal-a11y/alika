import { describe, expect, it } from "vitest";

import { avisoDeAgenda } from "@/lib/messaging/aviso-de-agenda";

describe("aviso de agenda: quién leyó el mensaje", () => {
  const lectura = { intencion: "agendar", fecha: "2026-10-15", franja: "tarde" } as const;

  it("una lectura por reglas conserva el texto de siempre", () => {
    expect(avisoDeAgenda(lectura, "reglas")).toEqual({
      titulo: "pide una hora",
      detalle: "pide una hora para el 2026-10-15 por la tarde",
    });
  });

  it("una lectura del modelo lo dice: 'Patty leyó: …'", () => {
    const aviso = avisoDeAgenda(lectura, "ia");
    expect(aviso.detalle).toBe("Patty leyó: pide una hora para el 2026-10-15 por la tarde");
    // El título no cambia: lo que decide la clínica es lo mismo.
    expect(aviso.titulo).toBe("pide una hora");
  });

  it("sin fecha lo dice en voz alta, venga de donde venga", () => {
    expect(avisoDeAgenda({ intencion: "cancelar", fecha: null, franja: null }, "ia").detalle).toBe(
      "Patty leyó: quiere cancelar su hora sin fecha indicada",
    );
    expect(
      avisoDeAgenda({ intencion: "reagendar", fecha: "2026-10-20", franja: "manana" }, "reglas")
        .detalle,
    ).toBe("quiere mover su hora para el 2026-10-20 por la mañana");
  });
});
