/**
 * Reporte de errores del error boundary raíz.
 *
 * Antes esto reenviaba a los hooks de telemetría del editor de Lovable
 * (`window.__lovableEvents` / `window.__lovableReportRuntimeError`), que sólo
 * existían dentro del preview del editor y eran no-op en producción. Al
 * desacoplar de Lovable se reemplazó por un log de consola, que sí queda
 * registrado en el navegador y en los logs de función de Vercel.
 */
export function reportBoundaryError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  // Loaders y server fns suelen lanzar un Response crudo; String(it) da el
  // opaco "[object Response]", así que se extraen status y URL.
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);

  console.error("[error-boundary]", message, {
    route: window.location.pathname,
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  });
}
