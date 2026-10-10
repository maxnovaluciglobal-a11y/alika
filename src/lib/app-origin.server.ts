import { getRequest } from "@tanstack/react-start/server";

const ORIGEN_POR_DEFECTO = "https://esmalia.com";

/**
 * Origen público de la app para armar links que salen del servidor (portal
 * del paciente, portal de laboratorio, retorno de Stripe).
 *
 * Auditoría 10-oct-2026: antes el origen venía del cliente (`baseUrl`,
 * `successUrl`…). Quien llamara la server function directo podía firmar un
 * link del portal apuntando a un dominio propio — el token viaja en el path,
 * así que el paciente que lo abría se lo entregaba a ese dominio — o mandar
 * el retorno de Stripe a cualquier lado.
 *
 * `PUBLIC_APP_URL` manda. Sin ella, en desarrollo se usa el origen de la
 * request (localhost); en producción, `https://esmalia.com`.
 */
export function appOrigin(): string {
  const raw = process.env.PUBLIC_APP_URL;
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // valor mal configurado: cae al default de abajo
    }
  }
  if (process.env.NODE_ENV !== "production") {
    try {
      const url = getRequest()?.url;
      if (url) return new URL(url).origin;
    } catch {
      // sin request (tests, scripts)
    }
  }
  return ORIGEN_POR_DEFECTO;
}

/**
 * Une el origen del servidor con una ruta relativa de la app. Rechaza
 * cualquier cosa que no sea un path absoluto local (`//evil.com`, `https:…`,
 * `\\`), que el navegador interpretaría como otro host.
 */
export function urlDeLaApp(ruta: string): string {
  if (!/^\/(?![/\\])/.test(ruta)) throw new Error("Ruta de retorno inválida.");
  return `${appOrigin()}${ruta}`;
}
