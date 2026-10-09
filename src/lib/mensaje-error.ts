/**
 * Texto de error para mostrarle a la persona (toasts), a partir de lo que
 * sea que haya fallado.
 *
 * Antes 81 toasts hacían `toast.error(e.message)` y mostraban lo crudo:
 * "Failed to fetch" en una app que se presenta como offline-first, o
 * mensajes de Postgres/PostgREST en inglés (auditoría 07-oct-2026). Los
 * mensajes que las server functions ya escriben en español (vía
 * `mensajeDb`) pasan tal cual.
 */
const SIN_CONEXION =
  /failed to fetch|networkerror|load failed|network request failed|fetch failed|err_internet_disconnected/i;
const SESION = /jwt|refresh token|not authenticated|auth session missing|unauthorized/i;
// Límites de Supabase Auth: "email rate limit exceeded", "Request rate limit
// reached", "For security purposes, you can only request this after 42
// seconds", códigos over_email_send_rate_limit / over_request_rate_limit.
const LIMITE = /rate limit|too many requests|for security purposes, you can only request this/i;
const TECNICO =
  /permission denied|row-level security|violates|duplicate key|constraint|null value in column|pgrst|schema cache|typeerror|referenceerror|cannot read|undefined is not|unexpected token|internal server error/i;

export const MENSAJE_GENERICO = "No se pudo completar. Intenta de nuevo en un momento.";

export function mensajeDeError(e: unknown, fallback: string = MENSAJE_GENERICO): string {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (!m) return fallback;
  if (SIN_CONEXION.test(m)) {
    return "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.";
  }
  if (LIMITE.test(m)) {
    return "Hubo demasiados intentos seguidos. Espera unos minutos e intenta de nuevo.";
  }
  if (SESION.test(m)) return "Tu sesión expiró. Vuelve a ingresar.";
  // El bloqueo de la demo vive en un trigger de la base (y con voseo).
  if (/cl[ií]nica demo/i.test(m)) {
    return "Esta es la clínica demo, de solo lectura. Crea tu clínica para guardar cambios.";
  }
  if (TECNICO.test(m)) return fallback;
  return m;
}
