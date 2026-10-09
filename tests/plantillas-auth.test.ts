import { describe, expect, it } from "vitest";

import { ENLACE_INVITACION, ENLACE_RECUPERAR, plantillasAuth } from "@/lib/email/plantillas-auth";
import { leerRetornoDeRecuperacion } from "@/lib/recuperar-clave";

/** Lo que Supabase pondría en lugar de las variables de Go. */
function resolver(plantilla: string): string {
  return plantilla
    .replaceAll("{{ .SiteURL }}", "https://esmalia.com")
    .replaceAll("{{ .TokenHash }}", "th");
}

describe("plantillas de autenticación de Supabase", () => {
  const todas = plantillasAuth();

  it("los enlaces propios llegan a /auth/nueva-clave con el tipo correcto", () => {
    const recuperar = new URL(resolver(ENLACE_RECUPERAR));
    const invitar = new URL(resolver(ENLACE_INVITACION));
    expect(recuperar.pathname).toBe("/auth/nueva-clave");
    expect(leerRetornoDeRecuperacion(recuperar.search, "")).toMatchObject({ otp: "recovery" });
    expect(leerRetornoDeRecuperacion(invitar.search, "")).toMatchObject({ otp: "invite" });
  });

  it("cada plantilla trae su variable de Supabase sin escapar", () => {
    expect(todas["recuperar-clave"].html).toContain("{{ .TokenHash }}&amp;type=recovery");
    expect(todas.invitacion.html).toContain("{{ .TokenHash }}&amp;type=invite");
    expect(todas["confirmar-cuenta"].html).toContain('href="{{ .ConfirmationURL }}"');
    expect(todas["enlace-acceso"].html).toContain('href="{{ .ConfirmationURL }}"');
    expect(todas["cambio-correo"].html).toContain("{{ .NewEmail }}");
    expect(todas["codigo-verificacion"].html).toContain("{{ .Token }}");
  });

  it("el logo sale de la Site URL y no hay enlace de baja (son transaccionales)", () => {
    for (const c of Object.values(todas)) {
      expect(c.html).toContain('src="{{ .SiteURL }}/brand/esmalia-wordmark-email.png"');
      expect(c.html).not.toContain("Darme de baja");
    }
  });
});
