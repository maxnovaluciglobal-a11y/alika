import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import {
  comoUsuario,
  conectar,
  esperaError,
  esperaFallo,
  evaluarPolitica,
  sembrarEscenario,
} from "./helpers/db";

/**
 * Valida RLS y constraints de procedure_supplies + inventory_movements.treatment_item_id
 * (Tanda 1 — receta de insumos por procedimiento).
 *
 * Mismo gotcha que payments-finance-rls.test.ts: la conexión de test usa el
 * rol `postgres` del pooler (BYPASSRLS), así que los permisos se validan
 * evaluando directamente las funciones que usan las policies
 * (`is_clinic_member`, `has_clinic_role`), no por enforcement real.
 *
 * Historia: este archivo se mergeó sin haberse ejecutado nunca (en la sesión
 * que lo escribió no había Postgres disponible) y dejó el CI en rojo 4
 * corridas seguidas: el test de ON DELETE SET NULL registraba una 'salida'
 * sobre un ítem recién creado, o sea con current_stock = 0, y el CHECK
 * `inventory_items_stock_non_negative` la rechazaba con razón. Se corrigió
 * reponiendo stock antes de consumir, no tocando el constraint.
 */
describe("procedure_supplies — RLS y constraints", () => {
  let client: Client;
  let clinicId: string;
  let usuarios: Record<string, string>;
  let procedureId: string;
  let itemId: string;

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

    const proc = await client.query<{ id: string }>(
      `INSERT INTO public.procedures (clinic_id, name, created_by)
       VALUES ($1, 'Limpieza dental', $2) RETURNING id`,
      [clinicId, usuarios.owner],
    );
    procedureId = proc.rows[0].id;

    const item = await client.query<{ id: string }>(
      `INSERT INTO public.inventory_items (clinic_id, name, unit, created_by)
       VALUES ($1, 'Gasas', 'unidad', $2) RETURNING id`,
      [clinicId, usuarios.owner],
    );
    itemId = item.rows[0].id;
  });
  afterEach(async () => {
    await client.query("ROLLBACK");
  });

  it("tiene RLS activa y al menos una policy", async () => {
    const filas = await comoUsuario<{ relrowsecurity: boolean; n: string }>(
      client,
      usuarios.owner,
      `SELECT c.relrowsecurity,
              (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname) AS n
       FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
       WHERE ns.nspname='public' AND c.relname = 'procedure_supplies'`,
    );
    expect(filas).toHaveLength(1);
    expect(filas[0].relrowsecurity).toBe(true);
    expect(Number(filas[0].n)).toBeGreaterThan(0);
  });

  describe("permisos de escritura (has_clinic_role de la policy real)", () => {
    const SUPPLY_ROLES = "ARRAY['owner','admin','dentist']::public.app_role[]";

    it.each(["owner", "admin", "dentist"])("%s puede escribir la receta", async (rol) => {
      await expect(
        evaluarPolitica(client, usuarios[rol], `public.has_clinic_role($1, ${SUPPLY_ROLES})`, [
          clinicId,
        ]),
      ).resolves.toBe(true);
    });

    it.each(["assistant", "reception", "accounting"])(
      "%s NO puede escribir la receta",
      async (rol) => {
        await expect(
          evaluarPolitica(client, usuarios[rol], `public.has_clinic_role($1, ${SUPPLY_ROLES})`, [
            clinicId,
          ]),
        ).resolves.toBe(false);
      },
    );

    it("un usuario externo tampoco puede", async () => {
      await expect(
        evaluarPolitica(client, usuarios.externo, `public.has_clinic_role($1, ${SUPPLY_ROLES})`, [
          clinicId,
        ]),
      ).resolves.toBe(false);
    });
  });

  describe("permisos de lectura (is_clinic_member — todo miembro)", () => {
    it.each(["owner", "admin", "dentist", "assistant", "reception", "accounting"])(
      "%s puede leer la receta",
      async (rol) => {
        await expect(
          evaluarPolitica(client, usuarios[rol], "public.is_clinic_member($1)", [clinicId]),
        ).resolves.toBe(true);
      },
    );

    it("un usuario externo no puede leer la receta", async () => {
      await expect(
        evaluarPolitica(client, usuarios.externo, "public.is_clinic_member($1)", [clinicId]),
      ).resolves.toBe(false);
    });
  });

  describe("CHECK constraint: quantity > 0", () => {
    it("rechaza una receta con cantidad cero", async () => {
      const msg = await esperaError(client, () =>
        client.query(
          `INSERT INTO public.procedure_supplies (clinic_id, procedure_id, item_id, quantity, created_by)
           VALUES ($1, $2, $3, 0, $4)`,
          [clinicId, procedureId, itemId, usuarios.owner],
        ),
      );
      expect(msg).toMatch(/quantity/);
    });

    it("rechaza una receta con cantidad negativa", async () => {
      const msg = await esperaError(client, () =>
        client.query(
          `INSERT INTO public.procedure_supplies (clinic_id, procedure_id, item_id, quantity, created_by)
           VALUES ($1, $2, $3, -2, $4)`,
          [clinicId, procedureId, itemId, usuarios.owner],
        ),
      );
      expect(msg).toMatch(/quantity/);
    });

    it("acepta una receta con cantidad positiva", async () => {
      const res = await client.query<{ id: string }>(
        `INSERT INTO public.procedure_supplies (clinic_id, procedure_id, item_id, quantity, created_by)
         VALUES ($1, $2, $3, 2, $4) RETURNING id`,
        [clinicId, procedureId, itemId, usuarios.owner],
      );
      expect(res.rows).toHaveLength(1);
    });
  });

  it("UNIQUE(procedure_id, item_id): no deja dos líneas del mismo insumo en el mismo procedimiento", async () => {
    await client.query(
      `INSERT INTO public.procedure_supplies (clinic_id, procedure_id, item_id, quantity, created_by)
       VALUES ($1, $2, $3, 2, $4)`,
      [clinicId, procedureId, itemId, usuarios.owner],
    );
    const msg = await esperaError(client, () =>
      client.query(
        `INSERT INTO public.procedure_supplies (clinic_id, procedure_id, item_id, quantity, created_by)
         VALUES ($1, $2, $3, 5, $4)`,
        [clinicId, procedureId, itemId, usuarios.owner],
      ),
    );
    expect(msg).toMatch(/duplicate key|unique/i);
  });

  // Invariante de negocio: el stock no puede quedar negativo.
  // `consumeSuppliesForTreatmentItem` depende de que la base rechace la salida
  // y de que lo haga con SQLSTATE 23514 — con ese código omite ese insumo, con
  // cualquier otro revienta el tratamiento entero.
  //
  // El test afirmaba el nombre del constraint (`inventory_items_stock_non_negative`)
  // aunque su propio comentario decía que fijaba comportamiento y no
  // implementación. Desde que el total del ítem se deriva de la suma de las
  // bodegas, ese CHECK ya no puede dispararse en una salida: quien rechaza es
  // el trigger. El comportamiento y el código son los mismos; el mecanismo
  // cambió, y era lo único que este test miraba.
  describe("salida sin stock suficiente", () => {
    it("rechaza una salida mayor al stock disponible, con el código que espera el llamador", async () => {
      const fallo = await esperaFallo(client, () =>
        client.query(
          `INSERT INTO public.inventory_movements (clinic_id, item_id, kind, quantity, recorded_by)
           VALUES ($1, $2, 'salida', 2, $3)`,
          [clinicId, itemId, usuarios.owner],
        ),
      );
      expect(fallo.code).toBe("23514");
      expect(fallo.message).toMatch(/no puede|pide|stock|bodega/i);
    });

    it("acepta la salida cuando hay stock repuesto antes", async () => {
      await client.query(
        `INSERT INTO public.inventory_movements (clinic_id, item_id, kind, quantity, recorded_by)
         VALUES ($1, $2, 'entrada', 5, $3)`,
        [clinicId, itemId, usuarios.owner],
      );
      await client.query(
        `INSERT INTO public.inventory_movements (clinic_id, item_id, kind, quantity, recorded_by)
         VALUES ($1, $2, 'salida', 2, $3)`,
        [clinicId, itemId, usuarios.owner],
      );
      const filas = await client.query<{ current_stock: string }>(
        `SELECT current_stock FROM public.inventory_items WHERE id = $1`,
        [itemId],
      );
      // 5 - 2 = 3. Si el trigger aplicara el movimiento dos veces, sería 1.
      expect(Number(filas.rows[0].current_stock)).toBe(3);
    });
  });

  describe("inventory_movements.treatment_item_id", () => {
    it("acepta NULL — un movimiento manual sigue sin cambios", async () => {
      const res = await client.query<{ id: string }>(
        `INSERT INTO public.inventory_movements (clinic_id, item_id, kind, quantity, recorded_by)
         VALUES ($1, $2, 'entrada', 10, $3) RETURNING id`,
        [clinicId, itemId, usuarios.owner],
      );
      expect(res.rows).toHaveLength(1);
    });

    it("ON DELETE SET NULL: borrar el treatment_item no borra el movimiento histórico", async () => {
      const patient = await client.query<{ id: string }>(
        `INSERT INTO public.patients (clinic_id, full_name, created_by)
         VALUES ($1, 'Paciente Test', $2) RETURNING id`,
        [clinicId, usuarios.owner],
      );
      const plan = await client.query<{ id: string }>(
        `INSERT INTO public.treatment_plans (clinic_id, patient_id, name, created_by)
         VALUES ($1, $2, 'Plan test', $3) RETURNING id`,
        [clinicId, patient.rows[0].id, usuarios.owner],
      );
      const item = await client.query<{ id: string }>(
        `INSERT INTO public.treatment_items (clinic_id, plan_id, procedure_id, name_snapshot, price_cents)
         VALUES ($1, $2, $3, 'Ítem test', 10000) RETURNING id`,
        [clinicId, plan.rows[0].id, procedureId],
      );
      const treatmentItemId = item.rows[0].id;

      // El ítem nace con current_stock = 0 (default de inventory_items), así que
      // hay que reponer antes de consumir: una 'salida' de 2 sobre stock 0 la
      // rechaza `inventory_items_stock_non_negative`, y hace bien — no se puede
      // descontar lo que no hay. Es el mismo orden que en la clínica real
      // (compra → uso), y el invariante del que depende
      // `consumeSuppliesForTreatmentItem` para omitir insumos sin stock (23514).
      await client.query(
        `INSERT INTO public.inventory_movements (clinic_id, item_id, kind, quantity, recorded_by)
         VALUES ($1, $2, 'entrada', 5, $3)`,
        [clinicId, itemId, usuarios.owner],
      );

      const movement = await client.query<{ id: string }>(
        `INSERT INTO public.inventory_movements (clinic_id, item_id, kind, quantity, recorded_by, treatment_item_id)
         VALUES ($1, $2, 'salida', 2, $3, $4) RETURNING id`,
        [clinicId, itemId, usuarios.owner, treatmentItemId],
      );

      await client.query(`DELETE FROM public.treatment_items WHERE id = $1`, [treatmentItemId]);

      const after = await client.query<{ treatment_item_id: string | null }>(
        `SELECT treatment_item_id FROM public.inventory_movements WHERE id = $1`,
        [movement.rows[0].id],
      );
      expect(after.rows[0].treatment_item_id).toBeNull();
    });
  });
});
