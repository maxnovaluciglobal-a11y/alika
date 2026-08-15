import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { randomUUID } from "node:crypto";
import {
  comoUsuario,
  conectar,
  esperaError,
  evaluarPolitica,
  sembrarEscenario,
} from "./helpers/db";

/**
 * Valida las reglas de acceso de payments/quotes/treatment_plans/items y el
 * cálculo de saldo del paciente.
 *
 * Gotcha importante (documentado para la próxima persona que toque este
 * archivo): la conexión de test usa el rol `postgres` del pooler, que tiene
 * BYPASSRLS activo (confirmado con `SELECT rolbypassrls FROM pg_roles`).
 * Eso significa que un INSERT/UPDATE directo por esta conexión NUNCA es
 * bloqueado por una policy de RLS, sin importar qué identidad se setee vía
 * `set_config('request.jwt.claims', ...)` — no hay forma de observar "fila
 * invisible" con esta conexión. Por eso, igual que ya hace
 * `clinical-notes-rls.test.ts` con `evaluarPolitica`, estos tests validan
 * directamente las funciones que las policies usan en su USING/WITH CHECK
 * (`is_clinic_member`, `has_clinic_role`) — si esas funciones devuelven el
 * valor correcto, la policy (que es literalmente esa expresión) se comporta
 * igual en producción, donde sí se conecta como `authenticated`.
 *
 * Lo que SÍ se puede probar con enforcement real, sin depender de RLS:
 *  - CHECK constraints (amount_cents > 0) — se evalúan siempre.
 *  - RPCs SECURITY DEFINER con su propio chequeo de permisos explícito
 *    (`next_clinic_counter` hace RAISE EXCEPTION si no es miembro).
 *  - La lógica de agregación del saldo (replica la query real de
 *    `getPatient` en src/lib/patients.functions.ts — si esa query cambia,
 *    actualizar acá también).
 */
describe("Payments, finanzas y saldo del paciente", () => {
  let client: Client;
  let clinicId: string;
  let usuarios: Record<string, string>;
  let patientId: string;

  beforeAll(async () => {
    client = await conectar();
  });
  afterAll(async () => {
    await client.end();
  });
  beforeEach(async () => {
    await client.query("BEGIN");
    const esc = await sembrarEscenario(client);
    clinicId = esc.clinicId;
    usuarios = esc.usuarios;

    const pRes = await client.query<{ id: string }>(
      `INSERT INTO public.patients (clinic_id, full_name, created_by)
       VALUES ($1, 'Paciente Test', $2) RETURNING id`,
      [clinicId, usuarios.owner],
    );
    patientId = pRes.rows[0].id;
  });
  afterEach(async () => {
    await client.query("ROLLBACK");
  });

  describe("RLS: tablas de finanzas tienen policies activas", () => {
    const TABLAS = ["payments", "quotes", "quote_items", "treatment_plans", "treatment_items"];

    it("todas tienen RLS activa y al menos una policy", async () => {
      const filas = await comoUsuario<{ relname: string; relrowsecurity: boolean; n: string }>(
        client,
        usuarios.owner,
        `SELECT c.relname, c.relrowsecurity,
                (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname) AS n
         FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
         WHERE ns.nspname='public' AND c.relname = ANY($1)`,
        [TABLAS],
      );
      expect(filas).toHaveLength(TABLAS.length);
      for (const f of filas) {
        expect(f.relrowsecurity, `${f.relname} sin RLS`).toBe(true);
        expect(Number(f.n), `${f.relname} sin políticas`).toBeGreaterThan(0);
      }
    });
  });

  describe("permisos de escritura en payments (has_clinic_role de la policy real)", () => {
    const FINANCE_ROLES = "ARRAY['owner','admin','dentist','reception']::public.app_role[]";

    it.each(["owner", "admin", "dentist", "reception"])("%s puede escribir pagos", async (rol) => {
      await expect(
        evaluarPolitica(client, usuarios[rol], `public.has_clinic_role($1, ${FINANCE_ROLES})`, [
          clinicId,
        ]),
      ).resolves.toBe(true);
    });

    it.each(["assistant", "accounting"])("%s NO puede escribir pagos", async (rol) => {
      await expect(
        evaluarPolitica(client, usuarios[rol], `public.has_clinic_role($1, ${FINANCE_ROLES})`, [
          clinicId,
        ]),
      ).resolves.toBe(false);
    });

    it("un usuario externo tampoco puede", async () => {
      await expect(
        evaluarPolitica(client, usuarios.externo, `public.has_clinic_role($1, ${FINANCE_ROLES})`, [
          clinicId,
        ]),
      ).resolves.toBe(false);
    });
  });

  describe("permisos de lectura en payments (is_clinic_member — todo miembro, incluida contabilidad)", () => {
    it.each(["owner", "admin", "dentist", "assistant", "reception", "accounting"])(
      "%s puede leer pagos",
      async (rol) => {
        await expect(
          evaluarPolitica(client, usuarios[rol], "public.is_clinic_member($1)", [clinicId]),
        ).resolves.toBe(true);
      },
    );

    it("un usuario externo no puede leer pagos", async () => {
      await expect(
        evaluarPolitica(client, usuarios.externo, "public.is_clinic_member($1)", [clinicId]),
      ).resolves.toBe(false);
    });
  });

  describe("CHECK constraint: amount_cents > 0", () => {
    it("rechaza un pago con monto cero", async () => {
      const msg = await esperaError(client, () =>
        client.query(
          `INSERT INTO public.payments (clinic_id, patient_id, amount_cents, created_by)
           VALUES ($1, $2, 0, $3)`,
          [clinicId, patientId, usuarios.owner],
        ),
      );
      expect(msg).toMatch(/amount_cents/);
    });

    it("rechaza un pago con monto negativo", async () => {
      const msg = await esperaError(client, () =>
        client.query(
          `INSERT INTO public.payments (clinic_id, patient_id, amount_cents, created_by)
           VALUES ($1, $2, -500, $3)`,
          [clinicId, patientId, usuarios.owner],
        ),
      );
      expect(msg).toMatch(/amount_cents/);
    });

    it("acepta un pago con monto positivo", async () => {
      const res = await client.query<{ id: string }>(
        `INSERT INTO public.payments (clinic_id, patient_id, amount_cents, created_by)
         VALUES ($1, $2, 15000, $3) RETURNING id`,
        [clinicId, patientId, usuarios.owner],
      );
      expect(res.rows).toHaveLength(1);
    });
  });

  describe("next_clinic_counter: correlativo atómico (RPC con permiso propio, no depende de RLS)", () => {
    it("un usuario externo no puede pedir correlativo", async () => {
      const msg = await esperaError(client, () =>
        comoUsuario(
          client,
          usuarios.externo,
          `SELECT public.next_clinic_counter($1, 'quote', 2026)`,
          [clinicId],
        ),
      );
      expect(msg).toMatch(/permisos/);
    });

    it("incrementa de forma atómica y aislada por clínica", async () => {
      const uno = await comoUsuario<{ next_clinic_counter: number }>(
        client,
        usuarios.owner,
        `SELECT public.next_clinic_counter($1, 'quote', 2026)`,
        [clinicId],
      );
      const dos = await comoUsuario<{ next_clinic_counter: number }>(
        client,
        usuarios.reception,
        `SELECT public.next_clinic_counter($1, 'quote', 2026)`,
        [clinicId],
      );
      expect(uno[0].next_clinic_counter).toBe(1);
      expect(dos[0].next_clinic_counter).toBe(2);

      // Otra clínica arranca su propio correlativo desde 1 — sin fuga entre
      // tenants. Insert directo en vez de sembrarEscenario(): esa función
      // crea la tabla temporal notas_prueba con CREATE TEMP TABLE, que es de
      // sesión (no de transacción) — llamarla dos veces en el mismo test
      // colisiona porque nunca hacemos COMMIT (solo ROLLBACK entre tests).
      const otroOwnerId = randomUUID();
      const otraClinica = await client.query<{ id: string }>(
        `INSERT INTO public.clinics (name, created_by) VALUES ('Otra Clínica', $1) RETURNING id`,
        [otroOwnerId],
      );
      const otraClinicId = otraClinica.rows[0].id;
      const otra = await comoUsuario<{ next_clinic_counter: number }>(
        client,
        otroOwnerId,
        `SELECT public.next_clinic_counter($1, 'quote', 2026)`,
        [otraClinicId],
      );
      expect(otra[0].next_clinic_counter).toBe(1);
    });
  });

  describe("cálculo de saldo (replica la agregación de getPatient en patients.functions.ts)", () => {
    /** Misma query que getPatient: factura de planes NO cancelados menos pagos. */
    async function calcularSaldo(pid: string): Promise<number | null> {
      const [billed, paid] = await Promise.all([
        client.query<{ total: string }>(
          `SELECT COALESCE(SUM(ti.price_cents), 0) AS total
           FROM public.treatment_items ti
           JOIN public.treatment_plans tp ON tp.id = ti.plan_id
           WHERE ti.clinic_id = $1 AND tp.patient_id = $2 AND tp.status <> 'cancelled'`,
          [clinicId, pid],
        ),
        client.query<{ total: string }>(
          `SELECT COALESCE(SUM(amount_cents), 0) AS total
           FROM public.payments WHERE clinic_id = $1 AND patient_id = $2`,
          [clinicId, pid],
        ),
      ]);
      const totalBilled = Number(billed.rows[0].total);
      const totalPaid = Number(paid.rows[0].total);
      if (totalBilled === 0 && totalPaid === 0) return null;
      return totalBilled - totalPaid;
    }

    async function crearPlan(status: "active" | "cancelled", itemsCents: number[]) {
      const plan = await client.query<{ id: string }>(
        `INSERT INTO public.treatment_plans (clinic_id, patient_id, name, status, created_by)
         VALUES ($1, $2, 'Plan test', $3, $4) RETURNING id`,
        [clinicId, patientId, status, usuarios.owner],
      );
      const planId = plan.rows[0].id;
      for (const cents of itemsCents) {
        await client.query(
          `INSERT INTO public.treatment_items (clinic_id, plan_id, name_snapshot, price_cents)
           VALUES ($1, $2, 'Ítem test', $3)`,
          [clinicId, planId, cents],
        );
      }
      return planId;
    }

    async function registrarPago(cents: number) {
      await client.query(
        `INSERT INTO public.payments (clinic_id, patient_id, amount_cents, created_by)
         VALUES ($1, $2, $3, $4)`,
        [clinicId, patientId, cents, usuarios.owner],
      );
    }

    it("sin planes ni pagos, el saldo es null (sin datos, no cero)", async () => {
      await expect(calcularSaldo(patientId)).resolves.toBeNull();
    });

    it("excluye los ítems de un plan cancelado del total facturado", async () => {
      await crearPlan("active", [100_000]);
      await crearPlan("cancelled", [50_000]); // no debe sumar
      await registrarPago(30_000);

      await expect(calcularSaldo(patientId)).resolves.toBe(100_000 - 30_000);
    });

    it("un pago sin ningún plan factura deja saldo negativo (a favor del paciente)", async () => {
      await registrarPago(20_000);
      await expect(calcularSaldo(patientId)).resolves.toBe(-20_000);
    });

    it("no mezcla el saldo con datos de otro paciente de la misma clínica", async () => {
      const otroPaciente = await client.query<{ id: string }>(
        `INSERT INTO public.patients (clinic_id, full_name, created_by)
         VALUES ($1, 'Otro Paciente', $2) RETURNING id`,
        [clinicId, usuarios.owner],
      );
      await crearPlan("active", [80_000]);
      await registrarPago(10_000);

      await expect(calcularSaldo(otroPaciente.rows[0].id)).resolves.toBeNull();
      await expect(calcularSaldo(patientId)).resolves.toBe(80_000 - 10_000);
    });
  });
});
