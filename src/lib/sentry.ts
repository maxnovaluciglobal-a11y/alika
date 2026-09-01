import type * as SentryReact from "@sentry/react";

/**
 * Init de Sentry seguro y lazy. Si no hay DSN configurado (ni en Vite env
 * ni en process.env), `@sentry/react` ni se descarga — el import es dinámico
 * y solo se dispara la primera vez que hace falta de verdad.
 *
 * Antes de este cambio (corregido 01-sep-2026, ver auditoría externa —
 * hallazgo "JS inicial ~1MB del chunk raíz") el import era estático a nivel
 * de módulo: aunque `initSentry()` era un no-op sin DSN, el bundler igual
 * empaquetaba el SDK entero en el chunk que carga hasta un visitante anónimo
 * de la landing pública. Con import dinámico, sin DSN el chunk de Sentry ni
 * se genera en el grafo de carga real del navegador.
 *
 * Configurar SENTRY_DSN en Vercel Env Vars antes del launch productivo.
 * En dev local: opcional (más ruido que valor).
 */

let sentryPromise: Promise<typeof SentryReact> | null = null;
let inited = false;

function loadSentry(): Promise<typeof SentryReact> {
  sentryPromise ??= import("@sentry/react");
  return sentryPromise;
}

function readDsn(): string | undefined {
  // Vite inyecta VITE_* en el bundle del cliente.
  const viteDsn =
    typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SENTRY_DSN;
  if (viteDsn) return viteDsn;
  // En el servidor (Node) leer del process.env.
  if (typeof process !== "undefined" && process.env?.SENTRY_DSN) return process.env.SENTRY_DSN;
  return undefined;
}

function readEnv(): string {
  if (typeof process !== "undefined" && process.env?.SENTRY_ENVIRONMENT) {
    return process.env.SENTRY_ENVIRONMENT;
  }
  return "development";
}

function readSampleRate(): number {
  const raw = typeof process !== "undefined" ? process.env?.SENTRY_TRACES_SAMPLE_RATE : undefined;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 0.1;
}

// Mensajes de error de Postgres suelen citar el valor literal que violó la
// constraint, ej.: `Key (email)=(paciente@real.com) already exists.` o
// `duplicate key value violates unique constraint "patients_dni_key"`.
// Si ese mensaje llega tal cual a Sentry, un campo de columna puede terminar
// filtrando un dato real (email, teléfono, DNI, etc.) fuera de la DB.
// Truncamos/redactamos el patrón `(columna)=(valor)` para no perder la
// causa del error (nombre de columna/constraint) pero sin el valor literal.
const POSTGRES_KEY_VALUE_PATTERN = /\(([^()=]+)\)=\(([^()]*)\)/g;

function redactPostgresLiteralsInString(message: string): string {
  return message.replace(
    POSTGRES_KEY_VALUE_PATTERN,
    (_match, column: string) => `(${column})=(redacted)`,
  );
}

function redactPostgresLiterals(event: SentryReact.Event): void {
  if (event.message) {
    event.message = redactPostgresLiteralsInString(event.message);
  }
  for (const value of event.exception?.values ?? []) {
    if (value.value) {
      value.value = redactPostgresLiteralsInString(value.value);
    }
  }
}

export async function initSentry(): Promise<void> {
  if (inited) return;
  const dsn = readDsn();
  if (!dsn) return;

  const Sentry = await loadSentry();
  if (inited) return; // otra llamada concurrente ya lo hizo mientras esperábamos el import

  Sentry.init({
    dsn,
    environment: readEnv(),
    tracesSampleRate: readSampleRate(),
    // Sin session replay ni user feedback modal en v1 — se pueden agregar
    // después. Cuidar la cuota gratuita (5k events/mes).
    integrations: [Sentry.browserTracingIntegration()],
    // Redactar PII antes de enviar. Datos clínicos NO deben salir a Sentry.
    //
    // ⚠️ CHECKLIST OBLIGATORIO antes de setear VITE_SENTRY_DSN en producción
    // (hoy no está seteado, así que este hook no tiene efecto todavía — esto
    // es preparación, ver docs/DEPLOY_PRODUCTION.md):
    //   1. Confirmar que este redactado de `error.message` cubre los mensajes
    //      reales que tira Supabase/Postgres en este proyecto (correr algunos
    //      errores conocidos — unique violation, FK violation — contra este
    //      hook antes de habilitar el DSN).
    //   2. Revisar `event.exception.values[].value` además de `event.message`
    //      si en algún momento se agregan breadcrumbs o contexto custom que
    //      puedan traer valores de columnas.
    //   3. Evaluar si hace falta filtrar también `event.extra` / `event.contexts`
    //      cuando se empiecen a adjuntar datos custom a los eventos.
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.user) event.user = { id: event.user.id }; // solo id, no email/nombre
      redactPostgresLiterals(event);
      return event;
    },
  });

  inited = true;
}

export async function captureException(
  ...args: Parameters<typeof SentryReact.captureException>
): Promise<ReturnType<typeof SentryReact.captureException> | undefined> {
  if (!readDsn()) return undefined;
  const Sentry = await loadSentry();
  return Sentry.captureException(...args);
}

export async function captureMessage(
  ...args: Parameters<typeof SentryReact.captureMessage>
): Promise<ReturnType<typeof SentryReact.captureMessage> | undefined> {
  if (!readDsn()) return undefined;
  const Sentry = await loadSentry();
  return Sentry.captureMessage(...args);
}

export async function withScope(...args: Parameters<typeof SentryReact.withScope>): Promise<void> {
  if (!readDsn()) return;
  const Sentry = await loadSentry();
  Sentry.withScope(...args);
}

export async function setUser(...args: Parameters<typeof SentryReact.setUser>): Promise<void> {
  if (!readDsn()) return;
  const Sentry = await loadSentry();
  Sentry.setUser(...args);
}
