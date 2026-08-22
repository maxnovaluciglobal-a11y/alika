import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/**
 * Blind spot detectado por el contraauditor de arquitectura (2026-08-21,
 * architecture-5): TODOS los tests de `tests/*.test.ts` que validan RLS
 * (`multi-clinic-isolation.test.ts`, `payments-finance-rls.test.ts`,
 * `clinical-notes-rls.test.ts`) corren sobre una conexión `pg.Client` cuyo
 * rol tiene `BYPASSRLS` (confirmado con `SELECT rolbypassrls FROM pg_roles`
 * en el comentario de `payments-finance-rls.test.ts`). Esos tests validan
 * que las funciones `is_clinic_member`/`has_clinic_role` devuelven el valor
 * correcto — es decir, que la EXPRESIÓN de la policy es correcta — pero
 * ninguno prueba que la policy esté efectivamente ENFORCEADA en runtime.
 * Si alguien corre por error `ALTER TABLE patients DISABLE ROW LEVEL
 * SECURITY` o borra una policy, ese cambio pasaría desapercibido: todos los
 * tests existentes seguirían en verde porque bypasean la policy de todas
 * formas.
 *
 * Este archivo NO repite el test de aislamiento funcional (eso ya lo cubre
 * `multi-clinic-isolation.test.ts`). Agrega la dimensión que falta: usa
 * `@supabase/supabase-js` con la SUPABASE_PUBLISHABLE_KEY (anon) + login
 * real de dos usuarios de prueba efímeros — el mismo camino que usa la app
 * en producción (PostgREST), sin ninguna conexión con permisos elevados de
 * por medio — y confirma que un usuario autenticado de la clínica A no
 * puede leer filas de la clínica B en las 4 tablas más sensibles
 * (`clinical_notes`, `patients`, `payments`, `odontogram_marks`), aunque
 * conozca los IDs exactos. Si RLS está deshabilitada o la policy fue
 * borrada, esta prueba es la que se pone roja — las demás no.
 *
 * Setup/cleanup usa el cliente con SUPABASE_SERVICE_ROLE_KEY (bypassa RLS
 * a propósito, solo para sembrar/limpiar datos, igual que hace el resto de
 * la suite con la conexión postgres directa). No hay transacción que
 * revierta sola (PostgREST no soporta BEGIN/ROLLBACK entre requests), así
 * que el cleanup en `afterAll` es explícito.
 */

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta ${name} en el entorno. Este test necesita SUPABASE_URL, ` +
        `SUPABASE_PUBLISHABLE_KEY y SUPABASE_SERVICE_ROLE_KEY (mismos nombres ` +
        `que .env) exportados en el shell antes de correr \`npm run test\` — ` +
        `no se leen automáticamente desde .env.`,
    );
  }
  return value;
}

const SUPABASE_URL = requiredEnv("SUPABASE_URL");
const ANON_KEY = requiredEnv("SUPABASE_PUBLISHABLE_KEY");
const SERVICE_ROLE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

interface ClinicaSeed {
  clinicId: string;
  userId: string;
  email: string;
  password: string;
  patientId: string;
  noteId: string;
  paymentId: string;
  markId: string;
  client: SupabaseClient;
}

describe("RLS enforcement smoke test (usuario real, sin bypass)", () => {
  let admin: SupabaseClient;
  let clinicaA: ClinicaSeed;
  let clinicaB: ClinicaSeed;

  async function sembrarClinica(nombre: string, pacienteNombre: string): Promise<ClinicaSeed> {
    const email = `rls-smoke-${randomUUID()}@alika-test.invalid`;
    const password = `Sm0ke-${randomUUID()}`;

    const { data: userRes, error: userErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userErr || !userRes.user) {
      throw new Error(`No se pudo crear usuario de prueba: ${userErr?.message}`);
    }
    const userId = userRes.user.id;

    const { data: clinic, error: clinicErr } = await admin
      .from("clinics")
      .insert({ name: nombre, created_by: userId })
      .select("id")
      .single();
    if (clinicErr || !clinic) {
      throw new Error(`No se pudo crear clínica de prueba: ${clinicErr?.message}`);
    }
    const clinicId = clinic.id as string;

    // El trigger on_clinic_created ya agrega al owner a clinic_members;
    // ON CONFLICT DO NOTHING por si acaso, igual que sembrarEscenario().
    await admin
      .from("clinic_members")
      .upsert(
        { clinic_id: clinicId, user_id: userId, role: "owner" },
        { onConflict: "clinic_id,user_id" },
      );

    const { data: patient, error: patientErr } = await admin
      .from("patients")
      .insert({ clinic_id: clinicId, full_name: pacienteNombre, created_by: userId })
      .select("id")
      .single();
    if (patientErr || !patient) {
      throw new Error(`No se pudo crear paciente de prueba: ${patientErr?.message}`);
    }
    const patientId = patient.id as string;

    const { data: note, error: noteErr } = await admin
      .from("clinical_notes")
      .insert({
        clinic_id: clinicId,
        patient_ref: patientId,
        title: "Nota smoke test",
        content: "Contenido confidencial de prueba",
        created_by: userId,
      })
      .select("id")
      .single();
    if (noteErr || !note) {
      throw new Error(`No se pudo crear nota clínica de prueba: ${noteErr?.message}`);
    }

    const { data: payment, error: paymentErr } = await admin
      .from("payments")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        amount_cents: 12345,
        created_by: userId,
      })
      .select("id")
      .single();
    if (paymentErr || !payment) {
      throw new Error(`No se pudo crear pago de prueba: ${paymentErr?.message}`);
    }

    const { data: mark, error: markErr } = await admin
      .from("odontogram_marks")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        tooth_number: 11,
        surface: "vestibular",
        condition: "caries",
        recorded_by: userId,
      })
      .select("id")
      .single();
    if (markErr || !mark) {
      throw new Error(`No se pudo crear marca de odontograma de prueba: ${markErr?.message}`);
    }

    const client = createClient(SUPABASE_URL, ANON_KEY);
    const { error: loginErr } = await client.auth.signInWithPassword({ email, password });
    if (loginErr) {
      throw new Error(`No se pudo loguear al usuario de prueba: ${loginErr.message}`);
    }

    return {
      clinicId,
      userId,
      email,
      password,
      patientId,
      noteId: note.id as string,
      paymentId: payment.id as string,
      markId: mark.id as string,
      client,
    };
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    clinicaA = await sembrarClinica("Clínica RLS Smoke A", "Paciente Smoke A");
    clinicaB = await sembrarClinica("Clínica RLS Smoke B", "Paciente Smoke B");
  }, 60_000);

  afterAll(async () => {
    // El ON DELETE CASCADE de clinics se lleva patients/clinical_notes/
    // payments/odontogram_marks/clinic_members de cada clínica de prueba.
    for (const clinicId of [clinicaA?.clinicId, clinicaB?.clinicId].filter(Boolean)) {
      await admin.from("clinics").delete().eq("id", clinicId);
    }
    for (const userId of [clinicaA?.userId, clinicaB?.userId].filter(Boolean)) {
      await admin.auth.admin.deleteUser(userId);
    }
  }, 60_000);

  it("sanity: el usuario de la clínica A SÍ puede leer sus propios datos por la API real", async () => {
    const { data, error } = await clinicaA.client
      .from("patients")
      .select("id")
      .eq("id", clinicaA.patientId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("un usuario autenticado de la clínica A no puede leer patients de la clínica B por ID", async () => {
    const { data, error } = await clinicaA.client
      .from("patients")
      .select("id")
      .eq("id", clinicaB.patientId);
    // RLS filtra silenciosamente (0 filas), no un error explícito —
    // PostgREST no distingue "no existe" de "existe pero no autorizado".
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un usuario autenticado de la clínica A no puede leer clinical_notes de la clínica B por ID", async () => {
    const { data, error } = await clinicaA.client
      .from("clinical_notes")
      .select("id, content")
      .eq("id", clinicaB.noteId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un usuario autenticado de la clínica A no puede leer payments de la clínica B por ID", async () => {
    const { data, error } = await clinicaA.client
      .from("payments")
      .select("id, amount_cents")
      .eq("id", clinicaB.paymentId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un usuario autenticado de la clínica A no puede leer odontogram_marks de la clínica B por ID", async () => {
    const { data, error } = await clinicaA.client
      .from("odontogram_marks")
      .select("id, condition")
      .eq("id", clinicaB.markId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un SELECT sin filtro por clinic_id tampoco filtra la clínica B (RLS, no la app, hace el trabajo)", async () => {
    // Simula el peor caso: un query real que se olvidó el .eq("clinic_id", x).
    // Si RLS estuviera deshabilitada esto devolvería filas de ambas clínicas.
    const { data, error } = await clinicaA.client
      .from("patients")
      .select("id, clinic_id")
      .in("id", [clinicaA.patientId, clinicaB.patientId]);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(clinicaA.patientId);
  });

  it("simétrico: el usuario de la clínica B tampoco puede leer datos de la clínica A", async () => {
    const [patients, notes, payments, marks] = await Promise.all([
      clinicaB.client.from("patients").select("id").eq("id", clinicaA.patientId),
      clinicaB.client.from("clinical_notes").select("id").eq("id", clinicaA.noteId),
      clinicaB.client.from("payments").select("id").eq("id", clinicaA.paymentId),
      clinicaB.client.from("odontogram_marks").select("id").eq("id", clinicaA.markId),
    ]);
    for (const res of [patients, notes, payments, marks]) {
      expect(res.error).toBeNull();
      expect(res.data).toEqual([]);
    }
  });
});
