import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { escribirLeadEnBase } from "@/lib/marketing/leads.functions";

/**
 * Regresión de `submitMarketingLead` — Task 16, cierre del hallazgo diferido
 * "cero tests" de la revisión final de rama (ver
 * `.superpowers/sdd/2026-09-07-captacion-lead-magnets/progress.md`, Important 7:
 * "cero tests sobre submitMarketingLead (~250 líneas, 5 ramas de escritura) y
 * api.recurso.$slug.ts — ambos endpoints públicos sin auth").
 *
 * DOS estrategias en este archivo, según qué se puede invocar de verdad:
 *
 * 1. `escribirLeadEnBase` — la lógica de escritura que antes vivía dentro del
 *    `.handler(...)` de `submitMarketingLead`, extraída a una función interna
 *    exportada (ver el comentario largo en `leads.functions.ts`) que recibe
 *    `ipHash`/`userAgent` como parámetros en vez de leerlos ella misma con
 *    `getRequestHeader`. Se invoca DIRECTO acá contra Supabase real (mismo
 *    patrón que `tests/finance-reports-permission.test.ts`) — sin mocks: cada
 *    test escribe y lee filas reales, y las borra al final.
 *
 * 2. El honeypot (`if (data.company) return { ok: true }`) vive en el
 *    handler PÚBLICO (`submitMarketingLead`), no en `escribirLeadEnBase` — es
 *    la única rama que corre ANTES de calcular `ipHash`/`userAgent`. No se
 *    puede invocar para probarlo de verdad: confirmado con un script aislado
 *    que tanto `getRequestHeader(...)` como el propio `submitMarketingLead({
 *    ... })` (el objeto que devuelve `createServerFn`) explotan fuera de una
 *    request real —`getRequestHeader` con "No StartEvent found in
 *    AsyncLocalStorage", y `submitMarketingLead` con "No Start context found
 *    in AsyncLocalStorage". El segundo error confirma que el wrapper de
 *    `createServerFn` exige el contexto ANTES incluso de entrar al handler,
 *    así que ni el propio honeypot (que no toca ningún header) es alcanzable
 *    invocando la función directo — mismo límite exacto que ya documenta
 *    `tests/trial-gate-parainforme.test.ts` para `requireSupabaseAuth`. Ese
 *    comportamiento se ancla en el código fuente (ver el segundo `describe`
 *    de este archivo), no se ejecuta.
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

// Prefijo reconocible para poder limpiar por patrón como red de seguridad,
// además del borrado por id que hace cada test.
const PREFIJO_EMAIL_PRUEBA = "test-regresion-leads";

function emailDePrueba(tag: string): string {
  return `${PREFIJO_EMAIL_PRUEBA}-${tag}-${randomUUID()}@example.com`;
}

/** 9 + 8 dígitos random: local chileno válido (normalizarTelefonoPorPais lo
 *  deja en "56" + estos 9 dígitos, ver tests/marketing-leads.test.ts). */
function telefonoDePrueba(): string {
  const suffix = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join("");
  return `9${suffix}`;
}

function ipHashDePrueba(tag: string): string {
  return `test-hash-${tag}-${randomUUID()}`;
}

type DatosLeadPrueba = Parameters<typeof escribirLeadEnBase>[0];

function datosBase(overrides: Partial<DatosLeadPrueba>): DatosLeadPrueba {
  return {
    countryCode: "CL",
    source: "calculadora",
    consent: true,
    consentText: "Autorizo a Alika a usar estos datos de prueba automatizada — texto base.",
    consentWhatsapp: false,
    ...overrides,
  } as DatosLeadPrueba;
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

const idsCreados = new Set<string>();
const ipHashesUsados = new Set<string>();

function trackIpHash(hash: string): string {
  ipHashesUsados.add(hash);
  return hash;
}

afterAll(async () => {
  // Ruta principal de limpieza: por id conocido (cada test registra el id
  // real apenas lo lee de vuelta).
  if (idsCreados.size > 0) {
    const { error } = await admin.from("marketing_leads").delete().in("id", Array.from(idsCreados));
    if (error)
      console.error("[cleanup marketing-leads-submit] borrado por id falló:", error.message);
  }

  // Red de seguridad: cualquier fila que se haya escapado del tracking de
  // arriba (p.ej. un assert que cortó el test a mitad de camino, antes de
  // llegar al `idsCreados.add(...)`) se limpia igual por el patrón de email
  // reconocible.
  await admin.from("marketing_leads").delete().ilike("email", `${PREFIJO_EMAIL_PRUEBA}%`);

  for (const hash of ipHashesUsados) {
    await admin.from("marketing_events").delete().eq("props->>ip_hash", hash);
  }

  // Confirmación final: cero residuo real, no asumido.
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

describe("escribirLeadEnBase — regresión real contra Supabase", () => {
  it("alta nueva (source=calculadora): fila creada con los campos correctos, sin downloadToken en la respuesta", async () => {
    const email = emailDePrueba("nuevo-calc");
    const phone = telefonoDePrueba();
    const ipHash = trackIpHash(ipHashDePrueba("nuevo-calc"));

    const resultado = await escribirLeadEnBase(
      datosBase({
        email,
        phone,
        name: "Prueba Calculadora",
        clinicName: "Clínica de prueba",
        source: "calculadora",
      }),
      ipHash,
      "vitest-user-agent",
    );

    expect(resultado).toEqual({ ok: true });
    expect("downloadToken" in resultado).toBe(false);

    const fila = await fetchLead(email);
    expect(fila).not.toBeNull();
    idsCreados.add(fila!.id);
    expect(fila!.email).toBe(email.toLowerCase());
    expect(fila!.phone).toBe(`56${phone}`);
    expect(fila!.source).toBe("calculadora");
    expect(fila!.download_slug).toBeNull();
    expect(fila!.submissions_count).toBe(1);
    expect(fila!.ip_hash).toBe(ipHash);
    expect(fila!.user_agent).toBe("vitest-user-agent");
  });

  it("alta nueva (source=checklist): fila con download_slug='fugas-clinica-dental', respuesta trae downloadToken", async () => {
    const email = emailDePrueba("nuevo-checklist");
    const ipHash = trackIpHash(ipHashDePrueba("nuevo-checklist"));

    const resultado = await escribirLeadEnBase(
      datosBase({ email, source: "checklist" }),
      ipHash,
      "vitest-user-agent",
    );

    expect(resultado.ok).toBe(true);
    expect(typeof (resultado as { downloadToken?: string }).downloadToken).toBe("string");

    const fila = await fetchLead(email);
    expect(fila).not.toBeNull();
    idsCreados.add(fila!.id);
    expect(fila!.download_slug).toBe("fugas-clinica-dental");
    expect(fila!.download_token).toBe((resultado as { downloadToken: string }).downloadToken);
    expect(fila!.download_delivered_at).toBeNull();
  });

  it("reenvío del mismo contacto: hace UPDATE (no INSERT), incrementa submissions_count, no borra el phone si el reenvío no lo trae, y no pisa consent_at/consent_text originales", async () => {
    const email = emailDePrueba("reenvio");
    const phoneOriginal = telefonoDePrueba();
    const ipHash = trackIpHash(ipHashDePrueba("reenvio"));

    await escribirLeadEnBase(
      datosBase({
        email,
        phone: phoneOriginal,
        source: "calculadora",
        consentText: "Texto de consentimiento ORIGINAL — no debe pisarse.",
      }),
      ipHash,
      "ua-1",
    );

    const filaOriginal = await fetchLead(email);
    expect(filaOriginal).not.toBeNull();
    idsCreados.add(filaOriginal!.id);
    expect(filaOriginal!.submissions_count).toBe(1);

    // Reenvío: mismo email, SIN phone (undefined) y con un consentText
    // distinto — no debería pisar el consentimiento original ni borrar el
    // phone que el primer envío sí capturó.
    await escribirLeadEnBase(
      datosBase({
        email,
        source: "calculadora",
        consentText: "Texto de consentimiento NUEVO — no debería quedar guardado.",
      }),
      ipHash,
      "ua-2",
    );

    const filaReenviada = await fetchLead(email);
    expect(filaReenviada).not.toBeNull();
    // Sigue siendo LA MISMA fila (UPDATE, no una fila nueva).
    expect(filaReenviada!.id).toBe(filaOriginal!.id);
    expect(filaReenviada!.submissions_count).toBe(2);
    expect(filaReenviada!.phone).toBe(filaOriginal!.phone); // no se borró
    expect(filaReenviada!.consent_at).toBe(filaOriginal!.consent_at); // no se pisó
    expect(filaReenviada!.consent_text).toBe("Texto de consentimiento ORIGINAL — no debe pisarse.");

    const { count } = await admin
      .from("marketing_leads")
      .select("id", { count: "exact", head: true })
      .eq("email", email.toLowerCase());
    expect(count).toBe(1); // ninguna fila nueva
  });

  it("checklist seguido de calculadora: download_slug NO se borra, conserva su valor original (regresión commit 4eebfc4)", async () => {
    const email = emailDePrueba("checklist-luego-calc");
    const ipHash = trackIpHash(ipHashDePrueba("checklist-luego-calc"));

    const primero = await escribirLeadEnBase(
      datosBase({ email, source: "checklist" }),
      ipHash,
      "ua",
    );
    const tokenOriginal = (primero as { downloadToken: string }).downloadToken;

    const filaInicial = await fetchLead(email);
    expect(filaInicial).not.toBeNull();
    idsCreados.add(filaInicial!.id);
    expect(filaInicial!.download_slug).toBe("fugas-clinica-dental");

    await escribirLeadEnBase(datosBase({ email, source: "calculadora" }), ipHash, "ua");

    const filaFinal = await fetchLead(email);
    expect(filaFinal!.source).toBe("calculadora"); // source SÍ se pisa (comportamiento intencional de Task 3)
    expect(filaFinal!.download_slug).toBe("fugas-clinica-dental"); // pero download_slug NO
    expect(filaFinal!.download_token).toBe(tokenOriginal);
  });

  it("calculadora seguido de checklist: download_slug se completa recién en el segundo envío, que además devuelve downloadToken (regresión commit 4eebfc4)", async () => {
    const email = emailDePrueba("calc-luego-checklist");
    const ipHash = trackIpHash(ipHashDePrueba("calc-luego-checklist"));

    const primero = await escribirLeadEnBase(
      datosBase({ email, source: "calculadora" }),
      ipHash,
      "ua",
    );
    expect("downloadToken" in primero).toBe(false);

    const filaInicial = await fetchLead(email);
    expect(filaInicial).not.toBeNull();
    idsCreados.add(filaInicial!.id);
    expect(filaInicial!.download_slug).toBeNull();

    const segundo = await escribirLeadEnBase(
      datosBase({ email, source: "checklist" }),
      ipHash,
      "ua",
    );

    const filaFinal = await fetchLead(email);
    expect(filaFinal!.download_slug).toBe("fugas-clinica-dental");
    expect(typeof (segundo as { downloadToken?: string }).downloadToken).toBe("string");
    expect(filaFinal!.download_token).toBe((segundo as { downloadToken: string }).downloadToken);
  });

  it("si download_delivered_at ya no es null (el lead ya descargó su PDF), un reenvío NO trae downloadToken en la respuesta", async () => {
    const email = emailDePrueba("ya-descargado");
    const ipHash = trackIpHash(ipHashDePrueba("ya-descargado"));

    await escribirLeadEnBase(datosBase({ email, source: "checklist" }), ipHash, "ua");
    const filaInicial = await fetchLead(email);
    expect(filaInicial).not.toBeNull();
    idsCreados.add(filaInicial!.id);

    // Simulamos que el PDF ya se descargó (lo que hace api.recurso.$slug.ts
    // de verdad en producción) actualizando la fila directo con el admin.
    const { error } = await admin
      .from("marketing_leads")
      .update({ download_delivered_at: new Date().toISOString() })
      .eq("id", filaInicial!.id);
    if (error) throw new Error(`No se pudo simular la descarga: ${error.message}`);

    const reenvio = await escribirLeadEnBase(
      datosBase({ email, source: "checklist" }),
      ipHash,
      "ua",
    );
    expect(reenvio).toEqual({ ok: true });
    expect("downloadToken" in reenvio).toBe(false);
  });

  it("colisión 23505 con datos cruzados entre dos leads: el reintento no pierde el lead ni sobreescribe el campo del otro (regresión Task 3)", async () => {
    const emailA = emailDePrueba("cruce-a");
    const emailB = emailDePrueba("cruce-b");
    const phoneA = telefonoDePrueba();
    const phoneB = telefonoDePrueba();
    const ipHashA = trackIpHash(ipHashDePrueba("cruce-a"));
    const ipHashB = trackIpHash(ipHashDePrueba("cruce-b"));
    const ipHashC = trackIpHash(ipHashDePrueba("cruce-c"));

    await escribirLeadEnBase(
      datosBase({ email: emailA, phone: phoneA, source: "calculadora" }),
      ipHashA,
      "ua",
    );
    await escribirLeadEnBase(
      datosBase({ email: emailB, phone: phoneB, source: "calculadora" }),
      ipHashB,
      "ua",
    );

    const filaA0 = await fetchLead(emailA);
    const filaB0 = await fetchLead(emailB);
    expect(filaA0).not.toBeNull();
    expect(filaB0).not.toBeNull();
    idsCreados.add(filaA0!.id);
    idsCreados.add(filaB0!.id);

    // Un tercer envío llega con el email de A pero el phone de B — cruce
    // real de datos entre dos personas distintas (p.ej. un teléfono de
    // recepción compartido, ver docstring de `buscarExistente`).
    const resultado = await escribirLeadEnBase(
      datosBase({ email: emailA, phone: phoneB, source: "calculadora" }),
      ipHashC,
      "ua",
    );
    expect(resultado).toEqual({ ok: true }); // no revienta con un 23505 sin manejar

    const filaAFinal = await fetchLead(emailA);
    const filaBFinal = await fetchLead(emailB);

    // A no perdió su fila ni le "robó" el teléfono a B: se reintentó sin la
    // columna en conflicto, dejando el phone que A ya tenía.
    expect(filaAFinal!.id).toBe(filaA0!.id);
    expect(filaAFinal!.phone).toBe(filaA0!.phone);
    expect(filaAFinal!.submissions_count).toBe(2); // sí se registró el reintento

    // B queda completamente intacto — nadie le tocó el dato.
    expect(filaBFinal).toEqual(filaB0);
  });

  it("rate limit: usa marketing_events con name='lead_intento' (no 'lead_enviado'), y bloquea al superar MAX_POR_IP_POR_HORA intentos por IP", async () => {
    const email = emailDePrueba("rate-limit");
    const ipHash = trackIpHash(ipHashDePrueba("rate-limit"));

    for (let i = 0; i < 5; i++) {
      const resultado = await escribirLeadEnBase(
        datosBase({ email, source: "calculadora" }),
        ipHash,
        "ua",
      );
      expect(resultado).toEqual({ ok: true });
    }
    const fila = await fetchLead(email);
    expect(fila).not.toBeNull();
    idsCreados.add(fila!.id);

    // El 6to intento con la MISMA ip supera el máximo (5) y se bloquea.
    await expect(
      escribirLeadEnBase(datosBase({ email, source: "calculadora" }), ipHash, "ua"),
    ).rejects.toThrow("Recibimos varios envíos desde tu conexión. Probá de nuevo en un rato.");

    // El nombre correcto del evento de intento es 'lead_intento' —
    // 'lead_enviado' es sólo la conversión que dispara el cliente al tener
    // éxito (regresión commit aa594df: antes eran el MISMO nombre y ningún
    // conteo del embudo real daba un número correcto).
    const { count: intentos, error: errIntentos } = await admin
      .from("marketing_events")
      .select("id", { count: "exact", head: true })
      .eq("name", "lead_intento")
      .eq("props->>ip_hash", ipHash);
    if (errIntentos) throw new Error(errIntentos.message);
    // 6 llamadas en total (5 que pasaron + la 6ta que se bloqueó) — el
    // evento se inserta ANTES del chequeo de rate limit, así que el intento
    // bloqueado también cuenta.
    expect(intentos).toBe(6);

    const { count: enviados, error: errEnviados } = await admin
      .from("marketing_events")
      .select("id", { count: "exact", head: true })
      .eq("name", "lead_enviado")
      .eq("props->>ip_hash", ipHash);
    if (errEnviados) throw new Error(errEnviados.message);
    expect(enviados ?? 0).toBe(0); // el server nunca usa este nombre
  });
});

describe("submitMarketingLead — honeypot, anclado en código fuente (ver docstring del archivo)", () => {
  function leer(rutaRelativa: string): string {
    return readFileSync(new URL(`../${rutaRelativa}`, import.meta.url), "utf8");
  }

  it("el chequeo de honeypot es la PRIMERA línea del handler público y retorna antes de calcular ipHash/userAgent o delegar a escribirLeadEnBase", () => {
    const fuente = leer("src/lib/marketing/leads.functions.ts");
    const inicio = fuente.indexOf("export const submitMarketingLead = createServerFn(");
    expect(inicio).toBeGreaterThan(-1);
    const finBloque = fuente.indexOf("\ntype DatosLead", inicio);
    expect(finBloque).toBeGreaterThan(inicio);
    const cuerpo = fuente.slice(inicio, finBloque);

    const posHoneypot = cuerpo.indexOf("if (data.company) return { ok: true as const };");
    const posEscribir = cuerpo.indexOf("escribirLeadEnBase(");
    const posGetHeader = cuerpo.indexOf("getRequestHeader(");
    expect(posHoneypot).toBeGreaterThan(-1);
    expect(posEscribir).toBeGreaterThan(-1);
    expect(posGetHeader).toBeGreaterThan(-1);
    // El honeypot corre ANTES que cualquier lectura de headers o la
    // delegación a la lógica de escritura — es un `return` temprano, así que
    // el resto del handler nunca se alcanza cuando el honeypot está lleno.
    expect(posHoneypot).toBeLessThan(posGetHeader);
    expect(posHoneypot).toBeLessThan(posEscribir);

    // El handler público no referencia `supabaseAdmin` en ningún lado — toda
    // escritura real vive dentro de `escribirLeadEnBase` (ver ese archivo),
    // nunca en este wrapper. Combinado con el orden de arriba, esto
    // garantiza que un honeypot lleno no puede tocar la base bajo ningún
    // camino del código actual.
    expect(cuerpo).not.toMatch(/supabaseAdmin/);
  });
});
