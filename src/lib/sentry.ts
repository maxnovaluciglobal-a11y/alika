import * as Sentry from "@sentry/react";

/**
 * Init de Sentry seguro y lazy. Si no hay DSN configurado (ni en Vite env
 * ni en process.env), no se inicializa nada — la app corre igual y las
 * llamadas a `captureException` de más abajo son no-ops.
 *
 * Configurar SENTRY_DSN en Vercel Env Vars antes del launch productivo.
 * En dev local: opcional (más ruido que valor).
 */

let inited = false;

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

export function initSentry() {
  if (inited) return;
  const dsn = readDsn();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: readEnv(),
    tracesSampleRate: readSampleRate(),
    // Sin session replay ni user feedback modal en v1 — se pueden agregar
    // después. Cuidar la cuota gratuita (5k events/mes).
    integrations: [Sentry.browserTracingIntegration()],
    // Redactar PII antes de enviar. Datos clínicos NO deben salir a Sentry.
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.user) event.user = { id: event.user.id }; // solo id, no email/nombre
      return event;
    },
  });

  inited = true;
}

export const { captureException, captureMessage, withScope, setUser } = Sentry;
