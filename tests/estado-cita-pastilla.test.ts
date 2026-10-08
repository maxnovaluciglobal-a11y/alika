import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EstadoCitaPastilla } from "@/components/estado-cita-pastilla";
import type { Cita } from "@/lib/clinic-operations/clinic-data";

function pastilla(cita: Pick<Cita, "estado" | "pacienteConfirmo">) {
  return renderToStaticMarkup(createElement(EstadoCitaPastilla, { cita }));
}

describe("pastilla de estado de cita", () => {
  it("el texto del estado siempre está visible y el ícono es decorativo", () => {
    const casos: [Pick<Cita, "estado" | "pacienteConfirmo">, string][] = [
      [{ estado: "tentativa" }, "Sin respuesta"],
      [{ estado: "tentativa", pacienteConfirmo: true }, "Paciente confirmó"],
      [{ estado: "confirmada" }, "Confirmada"],
      [{ estado: "en-sala" }, "En sala"],
      [{ estado: "finalizada" }, "Finalizada"],
      [{ estado: "ausente" }, "Ausente"],
    ];
    for (const [cita, texto] of casos) {
      const html = pastilla(cita);
      expect(html).toContain(texto);
      expect(html).not.toContain("sr-only");
      expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    }
  });

  it("cada estado lleva su forma", () => {
    expect(pastilla({ estado: "tentativa" })).toContain('data-forma="punteado"');
    expect(pastilla({ estado: "tentativa" })).toContain("border-dashed");
    expect(pastilla({ estado: "confirmada" })).toContain('data-forma="relleno"');
    expect(pastilla({ estado: "en-sala" })).toContain('data-forma="solido"');
    expect(pastilla({ estado: "en-sala" })).toContain("bg-info text-background");
    expect(pastilla({ estado: "finalizada" })).toContain('data-forma="texto"');
    expect(pastilla({ estado: "ausente" })).toContain('data-forma="relleno"');
  });

  it("finalizada es solo texto: sin relleno ni padding lateral", () => {
    const html = pastilla({ estado: "finalizada" });
    expect(html).toContain("bg-transparent");
    expect(html).toContain("px-0");
    expect(html).not.toContain("px-1.5");
  });
});
