// src/lib/marketing/leads.functions.ts
//
// Captura pública de leads. SIN requireSupabaseAuth a propósito: quien usa la
// calculadora no tiene sesión. Sigue el patrón que ya usan el portal del
// paciente y el webhook de WhatsApp — escritura con supabaseAdmin y filtros
// explícitos, sobre una tabla sin GRANT para authenticated.

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { hashIp, normalizarTelefonoPorPais } from "@/lib/marketing/leads";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_POR_IP_POR_HORA = 5;

const EsquemaLead = z
  .object({
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    name: z.string().trim().max(120).optional(),
    clinicName: z.string().trim().max(120).optional(),
    countryCode: z.enum(["CL", "MX", "CO", "PE", "AR"]),
    source: z.enum(["calculadora", "checklist", "benchmark"]),
    consent: z.literal(true),
    consentText: z.string().trim().min(10).max(500),
    consentWhatsapp: z.boolean().default(false),
    meta: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
    utm: z.record(z.string(), z.string().max(100)).optional(),
    // Honeypot: un humano nunca ve este campo, así que tiene que venir vacío.
    // SIN tope de longitud a propósito: probado contra el server real, un
    // `company: z.string().max(0)` rechaza cualquier valor no vacío en la
    // VALIDACIÓN (`too_big`, antes de que el handler corra), así que el
    // `if (data.company) return { ok: true }` de abajo quedaba código
    // muerto — el caso "honeypot lleno" del plan de pruebas nunca llegaba a
    // fingir éxito, tiraba un error de validación en su lugar. Un bot que
    // llena el campo con basura tiene que poder pasar la validación para
    // que el handler sea quien decida qué responder.
    company: z.string().optional(),
  })
  .refine((d) => !!(d.email && d.email.length) || !!(d.phone && d.phone.length), {
    message: "Dejanos un email o un WhatsApp para poder enviarte el material.",
  });

export const submitMarketingLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EsquemaLead.parse(input))
  .handler(async ({ data }) => {
    // Honeypot lleno: fingimos éxito. Devolver un error le confirma al bot
    // que detectamos la trampa y le enseña a evitarla.
    if (data.company) return { ok: true as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ipCruda =
      (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim() || "desconocida";
    const sal = process.env.PORTAL_TOKEN_SECRET ?? "sal-de-desarrollo";
    const ipHash = await hashIp(ipCruda, sal);

    // Rate limit EN LA BASE, no en memoria: la capa en memoria de
    // rate-limit.server.ts es por instancia serverless y no sirve como
    // control real. Mismo patrón que el portal (3 solicitudes/24h).
    const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("marketing_leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", desde);
    if ((count ?? 0) >= MAX_POR_IP_POR_HORA) {
      throw new Error("Recibimos varios envíos desde tu conexión. Probá de nuevo en un rato.");
    }

    const email = data.email?.trim().toLowerCase() || null;
    const phone = data.phone ? normalizarTelefonoPorPais(data.phone, data.countryCode) : null;
    if (!email && !phone) {
      throw new Error("El número no parece válido. Revisalo o dejanos tu email.");
    }

    // Numverify best-effort: nunca bloquea el alta. Mismo criterio que en
    // el alta de pacientes — un falso negativo perdiendo un lead real sería
    // peor que no validar.
    let phoneValid: boolean | null = null;
    if (phone) {
      try {
        const { validatePhoneNumber } = await import("@/lib/patients/phoneValidation");
        phoneValid = await validatePhoneNumber(phone);
      } catch {
        phoneValid = null;
      }
    }

    const fila = {
      email,
      phone,
      phone_valid: phoneValid,
      name: data.name?.trim() || null,
      clinic_name: data.clinicName?.trim() || null,
      country_code: data.countryCode,
      source: data.source,
      utm: data.utm ?? null,
      meta: data.meta ?? null,
      // Se re-escribe en cada envío, no sólo al insertar: `consent` es
      // z.literal(true) obligatorio en CADA submit, así que cada envío es un
      // consentimiento nuevo, no el mismo de la primera vez. El default de
      // la columna (now() en el insert) no alcanzaría para reflejar eso en
      // un update.
      consent_at: new Date().toISOString(),
      consent_text: data.consentText,
      consent_whatsapp: data.consentWhatsapp,
      ip_hash: ipHash,
      user_agent: (getRequestHeader("user-agent") ?? "").slice(0, 255) || null,
    };

    // Upsert por contacto: el mismo dentista que vuelve a usar la calculadora
    // actualiza su fila, no genera una nueva. DypOS no tiene dedupe y produce
    // duplicados en cada recarga.
    //
    // OJO: NO se puede resolver con `.upsert({ onConflict })` de supabase-js
    // (como proponía el borrador original). Verificado contra la base real:
    // los dos índices únicos de la migración de Task 1 son PARCIALES
    // (`WHERE email IS NOT NULL` / `WHERE phone IS NOT NULL`), y el de email
    // además es sobre una expresión (`lower(email)`, no la columna `email`).
    // PostgREST arma `ON CONFLICT (col)` a partir del nombre de columna que
    // le pasás en `onConflict` — no puede expresar el predicate parcial ni
    // una expresión — así que Postgres nunca encuentra un índice único que
    // matchee y tira 42P10 ("no unique or exclusion constraint matching").
    // Confirmado en la base real con `ON CONFLICT (email)`, `ON CONFLICT
    // (lower(email))` (sin WHERE) y `ON CONFLICT (phone)`: los tres fallan
    // igual; sólo funciona agregando el WHERE exacto del índice, algo que el
    // parámetro `onConflict` no permite construir.
    //
    // Se resuelve a mano: SELECT por el contacto, UPDATE si existe, INSERT si
    // no. Como ya normalizamos `email` a minúsculas nosotros mismos antes de
    // guardar, el `.eq("email", email)` de abajo es equivalente al índice
    // sobre `lower(email)` — no hace falta ILIKE. Ante una carrera (dos
    // requests concurrentes para el mismo contacto entre el SELECT y el
    // INSERT) el índice único de la base sí actúa como red de seguridad: el
    // segundo INSERT falla con 23505 y se reintenta como UPDATE.
    const columnaConflicto = email ? "email" : "phone";
    const valorConflicto = (email ?? phone) as string;

    const { data: existente } = await supabaseAdmin
      .from("marketing_leads")
      .select("id, submissions_count")
      .eq(columnaConflicto, valorConflicto)
      .maybeSingle();

    let dbError: { message: string } | null = null;

    if (existente) {
      const { error } = await supabaseAdmin
        .from("marketing_leads")
        .update({ ...fila, submissions_count: existente.submissions_count + 1 })
        .eq("id", existente.id);
      dbError = error;
    } else {
      const { error } = await supabaseAdmin.from("marketing_leads").insert(fila);
      if (error?.code === "23505") {
        // Carrera: otra request insertó el mismo contacto entre el SELECT y
        // el INSERT de arriba. Ya existe la fila — la actualizamos en vez de
        // fallar (perder el lead sería peor que una carrera bien resuelta).
        const { data: reciente } = await supabaseAdmin
          .from("marketing_leads")
          .select("id, submissions_count")
          .eq(columnaConflicto, valorConflicto)
          .maybeSingle();
        dbError = reciente
          ? (
              await supabaseAdmin
                .from("marketing_leads")
                .update({ ...fila, submissions_count: reciente.submissions_count + 1 })
                .eq("id", reciente.id)
            ).error
          : error;
      } else {
        dbError = error;
      }
    }

    if (dbError) throw new Error("No pudimos registrar tus datos. Probá de nuevo.");

    return { ok: true as const };
  });

/** Lectura de leads para el equipo de Alika. No existe un rol "staff de la
 *  empresa" en el schema (todos los roles son de clínica), así que el gate es
 *  una allowlist de emails por env var. */
export const listMarketingLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const permitidos = (process.env.ALIKA_STAFF_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usuario } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = usuario?.user?.email?.toLowerCase();

    if (!email || !permitidos.includes(email)) {
      throw new Error("No tienes permisos.");
    }

    const { data, error } = await supabaseAdmin
      .from("marketing_leads")
      .select(
        "id, email, phone, name, clinic_name, country_code, source, meta, submissions_count, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("No pudimos cargar los leads.");
    return data ?? [];
  });
