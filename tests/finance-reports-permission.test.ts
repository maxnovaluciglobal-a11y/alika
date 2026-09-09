import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import {
  requireFinanceView,
  throwIfTrialBlocksInformes,
} from "@/lib/finance/finance-reports.functions";

/**
 * Regresión del P0 de la auditoría de código 01-sep-2026: `getFinanceSummary`/
 * `getQuoteConversionReport` no tenían ningún chequeo de rol server-side —
 * `treatment_items_select_members`/`payments_select_finance_roles` dejan leer
 * a CUALQUIER miembro de la clínica, incluida `reception` (que no tiene
 * `finance:view`, ver `access.ts`). Mismo patrón que ya tenía arreglado
 * `getCommissionReport` (comisiones), nunca replicado acá hasta este fix.
 *
 * Este test prueba `requireFinanceView` contra Supabase real (anon key +
 * login real de un usuario `reception`, mismo camino que usa la app en
 * producción) — no contra una conexión con permisos elevados. Si alguien
 * revierte el chequeo o lo reemplaza por algo que no distingue rol, este es
 * el test que se pone rojo.
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

describe("requireFinanceView — regresión del P0 de finance-reports", () => {
  let admin: SupabaseClient;
  let clinicId: string;
  let ownerUserId: string;
  let receptionUserId: string;
  let ownerClient: SupabaseClient;
  let receptionClient: SupabaseClient;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const ownerEmail = `finview-owner-${randomUUID()}@alika-test.invalid`;
    const ownerPassword = `Fv0-${randomUUID()}`;
    const { data: ownerRes, error: ownerErr } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
    });
    if (ownerErr || !ownerRes.user) {
      throw new Error(`No se pudo crear usuario owner de prueba: ${ownerErr?.message}`);
    }
    ownerUserId = ownerRes.user.id;

    const { data: clinic, error: clinicErr } = await admin
      .from("clinics")
      .insert({ name: "Clínica finance-view smoke", created_by: ownerUserId })
      .select("id")
      .single();
    if (clinicErr || !clinic) {
      throw new Error(`No se pudo crear clínica de prueba: ${clinicErr?.message}`);
    }
    clinicId = clinic.id as string;

    // El trigger on_clinic_created ya agrega al owner a clinic_members.
    await admin.from("clinic_members").upsert(
      { clinic_id: clinicId, user_id: ownerUserId, role: "owner" },
      {
        onConflict: "clinic_id,user_id",
      },
    );

    const receptionEmail = `finview-reception-${randomUUID()}@alika-test.invalid`;
    const receptionPassword = `Fv0-${randomUUID()}`;
    const { data: receptionRes, error: receptionErr } = await admin.auth.admin.createUser({
      email: receptionEmail,
      password: receptionPassword,
      email_confirm: true,
    });
    if (receptionErr || !receptionRes.user) {
      throw new Error(`No se pudo crear usuario reception de prueba: ${receptionErr?.message}`);
    }
    receptionUserId = receptionRes.user.id;

    const { error: memberErr } = await admin
      .from("clinic_members")
      .insert({ clinic_id: clinicId, user_id: receptionUserId, role: "reception" });
    if (memberErr) {
      throw new Error(`No se pudo agregar el miembro reception de prueba: ${memberErr.message}`);
    }

    ownerClient = createClient(SUPABASE_URL, ANON_KEY);
    const { error: ownerLoginErr } = await ownerClient.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword,
    });
    if (ownerLoginErr) throw new Error(`Login owner falló: ${ownerLoginErr.message}`);

    receptionClient = createClient(SUPABASE_URL, ANON_KEY);
    const { error: receptionLoginErr } = await receptionClient.auth.signInWithPassword({
      email: receptionEmail,
      password: receptionPassword,
    });
    if (receptionLoginErr) throw new Error(`Login reception falló: ${receptionLoginErr.message}`);
  }, 60_000);

  afterAll(async () => {
    // ON DELETE CASCADE de clinics se lleva clinic_members.
    if (clinicId) await admin.from("clinics").delete().eq("id", clinicId);
    for (const userId of [ownerUserId, receptionUserId].filter(Boolean)) {
      await admin.auth.admin.deleteUser(userId);
    }
  }, 60_000);

  it("niega el acceso a un miembro `reception` (sin finance:view)", async () => {
    await expect(requireFinanceView(receptionClient, clinicId, receptionUserId)).rejects.toThrow(
      "No tienes permisos para ver los reportes financieros.",
    );
  });

  it("permite el acceso a un miembro `owner` (con finance:view)", async () => {
    await expect(requireFinanceView(ownerClient, clinicId, ownerUserId)).resolves.toBeUndefined();
  });

  it("niega el acceso a un usuario autenticado que no es miembro de la clínica", async () => {
    await expect(
      requireFinanceView(receptionClient, randomUUID(), receptionUserId),
    ).rejects.toThrow("No tienes permisos para ver los reportes financieros.");
  });

  /**
   * Task 11, fix round 1 — Important #4(a): el gate de trial dentro de
   * `requireFinanceView` (agregado en el commit `be4d55c`) no tenía NINGÚN
   * test — nada en CI lo protegía. Estos dos tests van al final a propósito:
   * mutan `trial_end` de la MISMA clínica que ya usaron los tres tests de
   * arriba (con trial vigente, creada por el trigger
   * `clinics_crear_trial` — ver `20260907240000_trial_nace_con_la_clinica.sql`),
   * así que tienen que correr después de esos tres, nunca antes. La clínica
   * de todos modos se borra en `afterAll`.
   */
  it("con el trial vencido, `requireFinanceView` rechaza a un owner con finance:view", async () => {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: actualizada, error } = await admin
      .from("subscriptions")
      .update({ trial_end: desde })
      .eq("clinic_id", clinicId)
      .select("clinic_id")
      .maybeSingle();
    if (error) throw new Error(`No se pudo mover trial_end al pasado: ${error.message}`);
    // Si el trigger de la migración 20260907240000 no corrió (entorno viejo
    // sin esa migración aplicada), este update no toca ninguna fila y el
    // resto del test sería un falso positivo — falla fuerte en vez de
    // seguir con un estado ambiguo.
    if (!actualizada) {
      throw new Error(
        "No existe fila en subscriptions para esta clínica de prueba — ¿falta aplicar " +
          "la migración 20260907240000_trial_nace_con_la_clinica.sql?",
      );
    }

    // Antes del gate de trial (solo chequeo de rol) esto pasaba: el owner
    // TIENE finance:view. Con el trial vencido y sin tarjeta, ahora rechaza
    // con el MISMO mensaje genérico que el chequeo de rol — nunca uno
    // distinto que delate "trial vencido" a quien mire la Network tab.
    await expect(requireFinanceView(ownerClient, clinicId, ownerUserId)).rejects.toThrow(
      "No tienes permisos para ver los reportes financieros.",
    );
  });

  /**
   * Important #2 de la revisión: `listExpenses`, `listPaymentMethods`,
   * `listAgreements`, `listLabOrders` e `listInventoryItems` ahora llaman a
   * `throwIfTrialBlocksInformes` como primera línea de su handler — la misma
   * capa que `requireFinanceView` usa internamente, extraída para poder
   * aplicarse sin cambiar el chequeo de rol/RLS propio de cada una.
   *
   * No se puede invocar esas cinco funciones directamente en un test: son
   * `createServerFn(...)` y su middleware `requireSupabaseAuth` llama a
   * `getRequest()` de `@tanstack/react-start/server`, que exige un request
   * HTTP real — fuera de ese contexto tira "No Start context found in
   * AsyncLocalStorage" (verificado corriendo exactamente eso contra
   * `listExpenses` antes de escribir este test; es la misma razón por la que
   * el test de arriba tampoco llama a `getFinanceSummary` directo). Esta
   * prueba llama al helper compartido con el mismo cliente logueado y el
   * mismo `clinicId` que usaría cualquiera de esas cinco — prueba que el
   * rechazo llega hasta ahí.
   */
  it("`throwIfTrialBlocksInformes` (el helper de las 5 funciones del fix round 1) rechaza igual con el trial ya vencido", async () => {
    await expect(throwIfTrialBlocksInformes(ownerClient, clinicId)).rejects.toThrow(
      "No tienes permisos para ver los reportes financieros.",
    );
  });
});
