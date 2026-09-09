import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { Route } from "@/routes/api.recurso.$slug";
import { escribirLeadEnBase } from "@/lib/marketing/leads.functions";

/**
 * Regresión de `api.recurso.$slug.ts` — Task 16, cierre del hallazgo diferido
 * "cero tests" de la revisión final de rama (ver
 * `.superpowers/sdd/2026-09-07-captacion-lead-magnets/progress.md`, Important 7).
 *
 * A diferencia de `submitMarketingLead`, este endpoint SÍ se puede invocar
 * directo: su handler es una función plana `async ({ request, params }) =>
 * Response`, exportada vía `createFileRoute(...)({ server: { handlers: { GET
 * } } } })` — sin middleware de `createServerFn` de por medio y sin usar
 * `getRequest()`/`getRequestHeader()` en ningún lado (confirmado leyendo el
 * archivo entero: no hay ningún import de `@tanstack/react-start/server`).
 *
 * Forma real de `Route` (confirmada con un script de prueba antes de escribir
 * este archivo, imprimiendo `Object.keys(...)` en cada nivel): el objeto que
 * devuelve `createFileRoute(...)({...})` es un `FileRoute` de TanStack
 * Router, y el handler vive en `Route.options.server.handlers.GET` como una
 * función `async ({ request, params }) => Response` normal — invocable
 * pasándole un `Request` real y un objeto `params` real, sin ningún contexto
 * de servidor adicional. Se confirmó con una llamada real (slug inexistente
 * → 404) antes de escribir la suite completa.
 */

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta ${name} en el entorno. Este test necesita SUPABASE_URL y ` +
        `SUPABASE_SERVICE_ROLE_KEY (mismos nombres que .env) exportados en el ` +
        `shell antes de correr \`npm run test\` — no se leen automáticamente desde .env.`,
    );
  }
  return value;
}

const SUPABASE_URL = requiredEnv("SUPABASE_URL");
const SERVICE_ROLE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type HandlerGET = (args: { request: Request; params: { slug: string } }) => Promise<Response>;

type RouteConHandlers = {
  options: { server: { handlers: { GET: HandlerGET } } };
};

const handlerGET: HandlerGET = (Route as unknown as RouteConHandlers).options.server.handlers.GET;

const PREFIJO_EMAIL_PRUEBA = "test-regresion-recurso";

function emailDePrueba(tag: string): string {
  return `${PREFIJO_EMAIL_PRUEBA}-${tag}-${randomUUID()}@example.com`;
}

function ipHashDePrueba(tag: string): string {
  return `test-hash-recurso-${tag}-${randomUUID()}`;
}

const idsCreados = new Set<string>();
const ipHashesUsados = new Set<string>();

function trackIpHash(hash: string): string {
  ipHashesUsados.add(hash);
  return hash;
}

async function fetchLead(email: string) {
  const { data, error } = await admin
    .from("marketing_leads")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el lead de prueba (${email}): ${error.message}`);
  return data;
}

/** Crea un lead real vía la lógica ya probada en marketing-leads-submit.test.ts
 *  y devuelve la fila completa — atajo para no repetir el circuito de
 *  submitMarketingLead en cada test de este archivo. */
async function crearLead(source: "calculadora" | "checklist", tag: string) {
  const email = emailDePrueba(tag);
  const ipHash = trackIpHash(ipHashDePrueba(tag));
  await escribirLeadEnBase(
    {
      email,
      countryCode: "CL",
      source,
      consent: true,
      consentText: "Autorizo a Alika a usar estos datos de prueba automatizada — texto base.",
      consentWhatsapp: false,
    },
    ipHash,
    "vitest-user-agent",
  );
  const fila = await fetchLead(email);
  if (!fila) throw new Error(`No se encontró el lead recién creado (${email})`);
  idsCreados.add(fila.id as string);
  return fila as {
    id: string;
    download_token: string;
    download_slug: string | null;
    download_delivered_at: string | null;
  };
}

afterAll(async () => {
  if (idsCreados.size > 0) {
    const { error } = await admin.from("marketing_leads").delete().in("id", Array.from(idsCreados));
    if (error) console.error("[cleanup api-recurso-slug] borrado por id falló:", error.message);
  }

  // Red de seguridad, mismo criterio que marketing-leads-submit.test.ts.
  await admin.from("marketing_leads").delete().ilike("email", `${PREFIJO_EMAIL_PRUEBA}%`);

  for (const hash of ipHashesUsados) {
    await admin.from("marketing_events").delete().eq("props->>ip_hash", hash);
  }

  const { count: leadsResiduales, error: errLeads } = await admin
    .from("marketing_leads")
    .select("id", { count: "exact", head: true })
    .ilike("email", `${PREFIJO_EMAIL_PRUEBA}%`);
  if (errLeads) throw new Error(`No se pudo verificar residuo de leads: ${errLeads.message}`);
  if ((leadsResiduales ?? 0) > 0) {
    throw new Error(`Quedaron ${leadsResiduales} leads de prueba sin limpiar en marketing_leads.`);
  }

  for (const hash of ipHashesUsados) {
    const { count, error } = await admin
      .from("marketing_events")
      .select("id", { count: "exact", head: true })
      .eq("props->>ip_hash", hash);
    if (error) throw new Error(`No se pudo verificar residuo de eventos: ${error.message}`);
    if ((count ?? 0) > 0) {
      throw new Error(`Quedaron ${count} eventos de prueba sin limpiar (ip_hash=${hash}).`);
    }
  }
}, 30_000);

describe("GET /api/recurso/$slug — regresión real (handler invocado directo, DB real)", () => {
  it("slug inexistente → 404, sin tocar la base", async () => {
    const request = new Request("http://localhost/api/recurso/no-existe-esto?token=cualquiera");
    const response = await handlerGET({ request, params: { slug: "no-existe-esto" } });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("No encontrado");
  });

  it("slug válido sin token → 403", async () => {
    const request = new Request("http://localhost/api/recurso/fugas-clinica-dental");
    const response = await handlerGET({ request, params: { slug: "fugas-clinica-dental" } });
    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Falta el token");
  });

  it("token inválido (no existe en la base) → 403", async () => {
    const request = new Request(
      `http://localhost/api/recurso/fugas-clinica-dental?token=${randomUUID()}`,
    );
    const response = await handlerGET({ request, params: { slug: "fugas-clinica-dental" } });
    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Token inválido o ya usado");
  });

  it("token válido de un lead real (source=checklist) → 200, application/pdf, cuerpo con magic number %PDF; el MISMO token de nuevo → 403 (de un solo uso)", async () => {
    const lead = await crearLead("checklist", "descarga-ok");
    expect(lead.download_slug).toBe("fugas-clinica-dental");
    expect(lead.download_delivered_at).toBeNull();

    const request1 = new Request(
      `http://localhost/api/recurso/fugas-clinica-dental?token=${lead.download_token}`,
    );
    const response1 = await handlerGET({
      request: request1,
      params: { slug: "fugas-clinica-dental" },
    });

    expect(response1.status).toBe(200);
    expect(response1.headers.get("Content-Type")).toBe("application/pdf");
    const buffer = new Uint8Array(await response1.arrayBuffer());
    const magicNumber = new TextDecoder().decode(buffer.slice(0, 4));
    expect(magicNumber).toBe("%PDF");

    // La fila real quedó marcada como entregada — no es un efecto simulado.
    const { data: filaEntregada, error: errEntregada } = await admin
      .from("marketing_leads")
      .select("download_delivered_at")
      .eq("id", lead.id)
      .single();
    if (errEntregada) throw new Error(errEntregada.message);
    expect(filaEntregada!.download_delivered_at).not.toBeNull();

    // El MISMO token de nuevo: ya se quemó, de un solo uso.
    const request2 = new Request(
      `http://localhost/api/recurso/fugas-clinica-dental?token=${lead.download_token}`,
    );
    const response2 = await handlerGET({
      request: request2,
      params: { slug: "fugas-clinica-dental" },
    });
    expect(response2.status).toBe(403);
    expect(await response2.text()).toBe("Token inválido o ya usado");
  });

  it("token válido pero de un lead con OTRO download_slug (nunca fue checklist) → 403, sin quemar nada ajeno", async () => {
    const lead = await crearLead("calculadora", "sin-checklist");
    expect(lead.download_slug).toBeNull();
    // El lead calculadora igual tiene un download_token real (el DEFAULT de
    // la columna se genera siempre, independiente de source) — pero no
    // debería poder canjearlo para un recurso al que nunca se suscribió.
    expect(lead.download_token).toBeTruthy();

    const request = new Request(
      `http://localhost/api/recurso/fugas-clinica-dental?token=${lead.download_token}`,
    );
    const response = await handlerGET({ request, params: { slug: "fugas-clinica-dental" } });
    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Token inválido o ya usado");

    // Nada ajeno se quemó: la fila sigue con download_delivered_at null.
    const { data: filaTrasIntento, error } = await admin
      .from("marketing_leads")
      .select("download_delivered_at")
      .eq("id", lead.id)
      .single();
    if (error) throw new Error(error.message);
    expect(filaTrasIntento!.download_delivered_at).toBeNull();
  });
});
