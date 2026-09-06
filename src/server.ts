import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { checkRateLimit, clientIpFromRequest } from "./lib/rate-limit.server";

// Rutas que reciben webhooks de terceros (Stripe/Meta) — no se limitan por
// IP acá: ya están protegidas por verificación de firma, y limitarlas
// arriesga descartar eventos reales si el proveedor reintenta o manda
// varios seguidos desde la misma IP.
const RATE_LIMIT_EXEMPT_PREFIXES = ["/api/stripe/webhook", "/api/whatsapp-webhook"];

// Generoso a propósito: el uso normal de la app dispara varias llamadas
// _serverFn en paralelo por navegación (ver por ejemplo /pacientes/:id, que
// carga notas + odontograma + presupuestos + pagos + mensajes a la vez).
// El objetivo es cortar scraping/loops de reintento y proteger el costo por
// invocación, no acotar el uso real del staff.
const RATE_LIMIT_RULES: Array<{ prefix: string; scope: string; windowMs: number; max: number }> = [
  { prefix: "/_serverFn/", scope: "server-fn", windowMs: 60_000, max: 180 },
  { prefix: "/api/", scope: "public-api", windowMs: 60_000, max: 60 },
];

function rateLimitRuleFor(pathname: string) {
  if (RATE_LIMIT_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return RATE_LIMIT_RULES.find((rule) => pathname.startsWith(rule.prefix)) ?? null;
}

function tooManyRequests(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: "Demasiadas solicitudes. Reintentá en un momento." }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfterSeconds),
      },
    },
  );
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      const rule = rateLimitRuleFor(url.pathname);
      if (rule) {
        const ip = clientIpFromRequest(request);
        const result = checkRateLimit(ip, rule);
        if (result.limited) return tooManyRequests(result.retryAfterSeconds);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
