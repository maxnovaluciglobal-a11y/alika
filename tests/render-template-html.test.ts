import { describe, expect, it } from "vitest";

import { renderTemplate, renderTemplateHtml } from "@/lib/messaging";

/**
 * Regresión del P1 de la auditoría de código 01-sep-2026: renderTemplate()
 * (sin escapar) se usaba también para el HTML real de emails que manda
 * Resend — un nombre de paciente/profesional con `<`/`>`/`&` podía inyectar
 * markup arbitrario en un email oficial de la clínica. renderTemplateHtml()
 * escapa el VALOR sustituido sin tocar el resto del template (que sigue
 * siendo HTML real, `<p>`/`<br>` deben seguir funcionando).
 */
describe("renderTemplateHtml", () => {
  it("escapa HTML en el valor sustituido", () => {
    const out = renderTemplateHtml("<p>Hola {paciente}</p>", {
      paciente: '<img src=x onerror="alert(1)">',
    });
    expect(out).toBe("<p>Hola &lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>");
    expect(out).not.toContain("<img");
  });

  it("preserva el markup del template que no viene de una variable", () => {
    const out = renderTemplateHtml("<p>Hola {paciente}</p><br><strong>Saludos</strong>", {
      paciente: "María",
    });
    expect(out).toBe("<p>Hola María</p><br><strong>Saludos</strong>");
  });

  it("escapa & < > \" ' en el valor", () => {
    const out = renderTemplateHtml("{x}", { x: `&<>"'` });
    expect(out).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("deja intacta una variable desconocida (mismo criterio que renderTemplate)", () => {
    const out = renderTemplateHtml("Hola {desconocida}", {});
    expect(out).toBe("Hola {desconocida}");
  });

  it("renderTemplate (WhatsApp/SMS) sigue sin escapar — no debe romper texto plano", () => {
    const out = renderTemplate("Hola {paciente}, ¿cómo estás?", { paciente: "José & María" });
    expect(out).toBe("Hola José & María, ¿cómo estás?");
  });
});
