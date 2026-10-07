/**
 * Redacción de PII compartida por el Sentry del navegador (`sentry.ts`) y el
 * del servidor (`sentry.server.ts`). Ver el checklist de PII en `sentry.ts`.
 */
type EventoConMensaje = {
  message?: string;
  exception?: { values?: { value?: string }[] };
};

// Mensajes de error de Postgres suelen citar el valor literal que violó la
// constraint, ej.: `Key (email)=(paciente@real.com) already exists.` o
// `duplicate key value violates unique constraint "patients_dni_key"`.
// Si ese mensaje llega tal cual a Sentry, un campo de columna puede terminar
// filtrando un dato real (email, teléfono, DNI, etc.) fuera de la DB.
// Truncamos/redactamos el patrón `(columna)=(valor)` para no perder la
// causa del error (nombre de columna/constraint) pero sin el valor literal.
const POSTGRES_KEY_VALUE_PATTERN = /\(([^()=]+)\)=\(([^()]*)\)/g;

// Las violaciones de NOT NULL y CHECK traen la fila entera ("Failing row
// contains (uuid, Ana Pérez, +56 9…, ana@…)"): el patrón de arriba no la
// cubre y el checklist de sentry.ts lo marcaba como hueco abierto.
const POSTGRES_FAILING_ROW_PATTERN = /Failing row contains \(.*\)/g;

export function redactPostgresLiteralsInString(message: string): string {
  return message
    .replace(POSTGRES_KEY_VALUE_PATTERN, (_match, column: string) => `(${column})=(redacted)`)
    .replace(POSTGRES_FAILING_ROW_PATTERN, "Failing row contains (redacted)");
}

export function redactPostgresLiterals(event: EventoConMensaje): void {
  if (event.message) {
    event.message = redactPostgresLiteralsInString(event.message);
  }
  for (const value of event.exception?.values ?? []) {
    if (value.value) {
      value.value = redactPostgresLiteralsInString(value.value);
    }
  }
}
