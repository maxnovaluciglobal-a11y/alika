import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { fetchPatientBalances } from "@/lib/patients.functions";

/**
 * Regresión de la unificación 01-sep-2026: `getPatient`
 * (patients.functions.ts) y `listPendingOutreach` (messaging.functions.ts)
 * reimplementaban por separado "total facturado en treatment_items (excluye
 * planes cancelled) menos total pagado en payments". `fetchPatientBalances`
 * es ahora la única fuente — si este test se pone rojo, las dos pantallas
 * (ficha del paciente y el aviso de payment_due) se desincronizan otra vez.
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

describe("fetchPatientBalances — saldo unificado", () => {
  let admin: SupabaseClient;
  let clinicId: string;
  let ownerUserId: string;
  let patientAId: string;
  let patientBId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: ownerRes, error: ownerErr } = await admin.auth.admin.createUser({
      email: `balances-owner-${randomUUID()}@alika-test.invalid`,
      password: `Bal-${randomUUID()}`,
      email_confirm: true,
    });
    if (ownerErr || !ownerRes.user) {
      throw new Error(`No se pudo crear usuario de prueba: ${ownerErr?.message}`);
    }
    ownerUserId = ownerRes.user.id;

    const { data: clinic, error: clinicErr } = await admin
      .from("clinics")
      .insert({ name: "Clínica balances smoke", created_by: ownerUserId })
      .select("id")
      .single();
    if (clinicErr || !clinic) throw new Error(`No se pudo crear clínica: ${clinicErr?.message}`);
    clinicId = clinic.id;

    const { data: patients, error: patErr } = await admin
      .from("patients")
      .insert([
        { clinic_id: clinicId, full_name: "Paciente A", created_by: ownerUserId },
        { clinic_id: clinicId, full_name: "Paciente B", created_by: ownerUserId },
      ])
      .select("id");
    if (patErr || !patients) throw new Error(`No se pudieron crear pacientes: ${patErr?.message}`);
    patientAId = patients[0].id;
    patientBId = patients[1].id;

    // Paciente A: plan activo de $10.000 + pago de $4.000 → debe $6.000.
    const { data: planA, error: planAErr } = await admin
      .from("treatment_plans")
      .insert({
        clinic_id: clinicId,
        patient_id: patientAId,
        name: "Plan A",
        created_by: ownerUserId,
      })
      .select("id")
      .single();
    if (planAErr || !planA) throw new Error(`No se pudo crear plan A: ${planAErr?.message}`);
    await admin.from("treatment_items").insert({
      clinic_id: clinicId,
      plan_id: planA.id,
      name_snapshot: "Item A",
      price_cents: 10_000,
    });
    await admin.from("payments").insert({
      clinic_id: clinicId,
      patient_id: patientAId,
      amount_cents: 4_000,
      created_by: ownerUserId,
    });

    // Mismo paciente A: plan CANCELLED de $50.000 — no debe contar en el saldo.
    const { data: planCancelled, error: planCancelledErr } = await admin
      .from("treatment_plans")
      .insert({
        clinic_id: clinicId,
        patient_id: patientAId,
        name: "Plan cancelado",
        created_by: ownerUserId,
        status: "cancelled",
      })
      .select("id")
      .single();
    if (planCancelledErr || !planCancelled) {
      throw new Error(`No se pudo crear plan cancelado: ${planCancelledErr?.message}`);
    }
    await admin.from("treatment_items").insert({
      clinic_id: clinicId,
      plan_id: planCancelled.id,
      name_snapshot: "Item cancelado",
      price_cents: 50_000,
    });

    // Paciente B queda sin ninguna facturación ni pago a propósito.
  }, 60_000);

  afterAll(async () => {
    if (clinicId) await admin.from("clinics").delete().eq("id", clinicId);
    if (ownerUserId) await admin.auth.admin.deleteUser(ownerUserId);
  }, 60_000);

  it("calcula el saldo de un solo paciente, ignorando el plan cancelled", async () => {
    const balances = await fetchPatientBalances(admin, clinicId, patientAId);
    expect(balances.get(patientAId)).toEqual({ billedCents: 10_000, paidCents: 4_000 });
  });

  it("en modo clínica entera agrupa por paciente y omite a quien no tiene actividad", async () => {
    const balances = await fetchPatientBalances(admin, clinicId);
    expect(balances.get(patientAId)).toEqual({ billedCents: 10_000, paidCents: 4_000 });
    expect(balances.has(patientBId)).toBe(false);
  });
});
