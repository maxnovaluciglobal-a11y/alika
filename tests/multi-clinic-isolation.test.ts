import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { randomUUID } from "node:crypto";
import { comoUsuario, conectar, evaluarPolitica } from "./helpers/db";

/**
 * La auditoría de arquitectura 2026-08-15 marcó que el modelo multi-tenant
 * nunca se probó con datos de 2+ clínicas simultáneas cargadas a la vez
 * (hoy en producción solo existe "clinica Patricia"). Este archivo carga
 * DOS clínicas completas —con nombres, pacientes y montos parecidos a
 * propósito, para que un bug de "olvidé el .eq(clinic_id)" sea visible—
 * en la misma transacción, y verifica que ninguna se filtra a la otra.
 *
 * Mismo gotcha que el resto de la suite (ver payments-finance-rls.test.ts):
 * la conexión de test tiene BYPASSRLS, así que lo que se prueba acá es (a)
 * que las funciones de permiso (is_clinic_member/has_clinic_role) resuelven
 * bien por clínica cuando un mismo usuario podría, en teoría, pertenecer a
 * más de una, y (b) que el patrón real de query de la app (`.eq("clinic_id", x)`)
 * efectivamente no cruza datos cuando dos clínicas coexisten con datos
 * parecidos — no que RLS bloquee la fila (eso ya no es observable con esta
 * conexión).
 */
describe("Aislamiento multi-clínica con 2 clínicas reales simultáneas", () => {
  let client: Client;

  interface ClinicaSeed {
    clinicId: string;
    ownerId: string;
    patientId: string;
  }

  async function sembrarClinica(nombre: string, pacienteNombre: string): Promise<ClinicaSeed> {
    const ownerId = randomUUID();
    const clinica = await client.query<{ id: string }>(
      `INSERT INTO public.clinics (name, created_by) VALUES ($1, $2) RETURNING id`,
      [nombre, ownerId],
    );
    const clinicId = clinica.rows[0].id;
    const paciente = await client.query<{ id: string }>(
      `INSERT INTO public.patients (clinic_id, full_name, created_by)
       VALUES ($1, $2, $3) RETURNING id`,
      [clinicId, pacienteNombre, ownerId],
    );
    return { clinicId, ownerId, patientId: paciente.rows[0].id };
  }

  let clinicaA: ClinicaSeed;
  let clinicaB: ClinicaSeed;

  beforeAll(async () => {
    client = await conectar();
  });
  afterAll(async () => {
    await client.end();
  });
  beforeEach(async () => {
    await client.query("BEGIN");
    // Nombres y datos deliberadamente parecidos: si un query real se olvida
    // el filtro por clinic_id, con nombres distintos el bug pasaría
    // desapercibido en un test — así no.
    clinicaA = await sembrarClinica("Clínica Norte", "Paciente Compartido");
    clinicaB = await sembrarClinica("Clínica Norte", "Paciente Compartido");
  });
  afterEach(async () => {
    await client.query("ROLLBACK");
  });

  it("el owner de la clínica A no es miembro de la clínica B, y viceversa", async () => {
    await expect(
      evaluarPolitica(client, clinicaA.ownerId, "public.is_clinic_member($1)", [clinicaA.clinicId]),
    ).resolves.toBe(true);
    await expect(
      evaluarPolitica(client, clinicaA.ownerId, "public.is_clinic_member($1)", [clinicaB.clinicId]),
    ).resolves.toBe(false);
    await expect(
      evaluarPolitica(client, clinicaB.ownerId, "public.is_clinic_member($1)", [clinicaB.clinicId]),
    ).resolves.toBe(true);
    await expect(
      evaluarPolitica(client, clinicaB.ownerId, "public.is_clinic_member($1)", [clinicaA.clinicId]),
    ).resolves.toBe(false);
  });

  it("clinic_role_of devuelve null para quien no es miembro, aunque sea owner de otra clínica", async () => {
    const rolCruzado = await client.query<{ clinic_role_of: string | null }>(
      `SELECT public.clinic_role_of($1, $2)`,
      [clinicaB.clinicId, clinicaA.ownerId],
    );
    expect(rolCruzado.rows[0].clinic_role_of).toBeNull();
  });

  it("pacientes con el mismo nombre en ambas clínicas no se mezclan al filtrar por clinic_id", async () => {
    const enA = await client.query<{ id: string }>(
      `SELECT id FROM public.patients WHERE clinic_id = $1`,
      [clinicaA.clinicId],
    );
    const enB = await client.query<{ id: string }>(
      `SELECT id FROM public.patients WHERE clinic_id = $1`,
      [clinicaB.clinicId],
    );
    expect(enA.rows).toHaveLength(1);
    expect(enB.rows).toHaveLength(1);
    expect(enA.rows[0].id).not.toBe(enB.rows[0].id);
    expect(enA.rows[0].id).toBe(clinicaA.patientId);
    expect(enB.rows[0].id).toBe(clinicaB.patientId);
  });

  it("un pago registrado en la clínica A no aparece en el saldo de la clínica B, con el mismo nombre de paciente", async () => {
    await client.query(
      `INSERT INTO public.payments (clinic_id, patient_id, amount_cents, created_by)
       VALUES ($1, $2, 50000, $3)`,
      [clinicaA.clinicId, clinicaA.patientId, clinicaA.ownerId],
    );

    const pagosA = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM public.payments
       WHERE clinic_id = $1 AND patient_id = $2`,
      [clinicaA.clinicId, clinicaA.patientId],
    );
    const pagosB = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM public.payments
       WHERE clinic_id = $1 AND patient_id = $2`,
      [clinicaB.clinicId, clinicaB.patientId],
    );

    expect(Number(pagosA.rows[0].total)).toBe(50000);
    expect(Number(pagosB.rows[0].total)).toBe(0);
  });

  it("next_clinic_counter no comparte secuencia entre clínicas aunque pidan el mismo kind/año", async () => {
    // comoUsuario (no Promise.all): pg.Client es una única conexión, no
    // soporta queries concurrentes — y cada llamada necesita auth.uid()
    // seteado vía set_config para pasar el chequeo de permisos de la RPC.
    const unoA = await comoUsuario<{ next_clinic_counter: number }>(
      client,
      clinicaA.ownerId,
      `SELECT public.next_clinic_counter($1, 'quote', 2026)`,
      [clinicaA.clinicId],
    );
    const unoB = await comoUsuario<{ next_clinic_counter: number }>(
      client,
      clinicaB.ownerId,
      `SELECT public.next_clinic_counter($1, 'quote', 2026)`,
      [clinicaB.clinicId],
    );
    const dosA = await comoUsuario<{ next_clinic_counter: number }>(
      client,
      clinicaA.ownerId,
      `SELECT public.next_clinic_counter($1, 'quote', 2026)`,
      [clinicaA.clinicId],
    );
    expect(unoA[0].next_clinic_counter).toBe(1);
    expect(unoB[0].next_clinic_counter).toBe(1);
    expect(dosA[0].next_clinic_counter).toBe(2);
  });

  it("has_clinic_role del owner de A sobre la clínica B es false, aunque el rol exista en A", async () => {
    const FINANCE_ROLES = "ARRAY['owner','admin','dentist','reception']::public.app_role[]";
    await expect(
      evaluarPolitica(client, clinicaA.ownerId, `public.has_clinic_role($1, ${FINANCE_ROLES})`, [
        clinicaA.clinicId,
      ]),
    ).resolves.toBe(true);
    await expect(
      evaluarPolitica(client, clinicaA.ownerId, `public.has_clinic_role($1, ${FINANCE_ROLES})`, [
        clinicaB.clinicId,
      ]),
    ).resolves.toBe(false);
  });
});
