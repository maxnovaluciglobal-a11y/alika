import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Baja desde la página pública `/correos/baja` (sin sesión: la autoriza el
 * token firmado del enlace). Se aplica al confirmar con el botón y no al
 * abrir el enlace, porque algunos filtros de correo abren los enlaces solos
 * para revisarlos y darían de baja a alguien que no lo pidió.
 */
export const confirmarBajaDeCorreos = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ token: z.string().min(10).max(4000) }).parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; motivo?: "token" | "error" }> => {
    const { aplicarBajaConToken } = await import("@/lib/email/baja.server");
    return aplicarBajaConToken(data.token);
  });

/** ¿El enlace sigue siendo válido? Para mostrar el mensaje correcto antes de confirmar. */
export const revisarTokenDeBaja = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ token: z.string().max(4000) }).parse(input))
  .handler(async ({ data }): Promise<{ valido: boolean }> => {
    const { verificarTokenDeBaja } = await import("@/lib/email/baja-token.server");
    return { valido: (await verificarTokenDeBaja(data.token)) !== null };
  });
