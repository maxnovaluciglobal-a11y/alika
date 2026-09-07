import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { comoUsuario, conectar, esperaFallo, sembrarEscenario } from "./helpers/db";

/**
 * Una bodega con saldo no se saca de circulación.
 *
 * Desde `20260907120000_stock_multibodega_no_descuadra` el total del ítem se
 * deriva de la suma de sus bodegas dentro de `apply_inventory_movement`. Eso
 * hace imposible el descuadre por un movimiento — pero deja dos puertas
 * abiertas FUERA del trigger:
 *
 *   1. Borrar una bodega arrastra sus filas de `inventory_stock` por el
 *      CASCADE de la FK. El total del ítem queda por encima de la suma hasta
 *      el siguiente movimiento, que lo baja de golpe: las unidades se pierden
 *      sin un movimiento que las explique.
 *   2. Desactivar una bodega la saca del selector (`listWarehouses` filtra por
 *      `is_active`), pero su saldo sigue sumando y una salida sin bodega la
 *      puede drenar igual. No se pierde nada, pero el insumo sale de un lugar
 *      que la clínica dio por cerrado.
 *
 * Decidido con el negocio: una sola regla para las dos puertas — con saldo
 * adentro, la bodega no se borra ni se desactiva. Primero se mueve el stock.
 */
describe("bodegas con saldo — no se borran ni se desactivan", () => {
  let client: Client;
  let clinicId: string;
  let usuarios: Record<string, string>;
  let itemId: string;
  let general: string;
  let bodegaB: string;

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

    const item = await client.query<{ id: string }>(
      `INSERT INTO public.inventory_items (clinic_id, name, unit, created_by)
       VALUES ($1, 'Guantes', 'caja', $2) RETURNING id`,
      [clinicId, usuarios.owner],
    );
    itemId = item.rows[0].id;

    const g = await client.query<{ id: string }>(
      `SELECT id FROM public.warehouses WHERE clinic_id = $1 AND name = 'Bodega general'`,
      [clinicId],
    );
    general = g.rows[0].id;
    const b = await client.query<{ id: string }>(
      `INSERT INTO public.warehouses (clinic_id, name, position)
       VALUES ($1, 'Bodega B', 1) RETURNING id`,
      [clinicId],
    );
    bodegaB = b.rows[0].id;
  });
  afterEach(async () => {
    await client.query("ROLLBACK");
  });

  async function movimiento(
    kind: "entrada" | "salida" | "ajuste",
    quantity: number,
    warehouseId: string | null = null,
  ) {
    await comoUsuario(
      client,
      usuarios.owner,
      `INSERT INTO public.inventory_movements (clinic_id, item_id, kind, quantity, warehouse_id)
       VALUES ($1, $2, $3::public.inventory_movement_kind, $4, $5)`,
      [clinicId, itemId, kind, quantity, warehouseId],
    );
  }

  const borrar = (id: string) =>
    comoUsuario(client, usuarios.owner, `DELETE FROM public.warehouses WHERE id = $1`, [id]);

  const desactivar = (id: string) =>
    comoUsuario(
      client,
      usuarios.owner,
      `UPDATE public.warehouses SET is_active = false WHERE id = $1`,
      [id],
    );

  /** El invariante que estas dos puertas rompían. */
  async function esperaCuadre() {
    const total = await client.query<{ current_stock: string }>(
      `SELECT current_stock FROM public.inventory_items WHERE id = $1`,
      [itemId],
    );
    const suma = await client.query<{ suma: string }>(
      `SELECT COALESCE(SUM(current_stock), 0) AS suma FROM public.inventory_stock WHERE item_id = $1`,
      [itemId],
    );
    expect(Number(total.rows[0].current_stock)).toBe(Number(suma.rows[0].suma));
  }

  it("no se puede borrar una bodega con saldo", async () => {
    await movimiento("entrada", 10, bodegaB);

    const fallo = await esperaFallo(client, () => borrar(bodegaB));
    expect(fallo.code).toBe("23514");
    expect(fallo.message).toMatch(/Bodega B/);

    const quedo = await client.query(`SELECT 1 FROM public.warehouses WHERE id = $1`, [bodegaB]);
    expect(quedo.rowCount).toBe(1);
    await esperaCuadre();
  });

  it("el mensaje dice qué hacer y sobrevive al filtro de mensajeDb", async () => {
    // `mensajeDb` descarta cualquier mensaje con "violates", "constraint",
    // "duplicate key", etc. y lo reemplaza por un genérico. Un mensaje que
    // nombra la bodega y no llega al usuario no sirve de nada.
    await movimiento("entrada", 3, bodegaB);
    const fallo = await esperaFallo(client, () => borrar(bodegaB));
    expect(fallo.message).not.toMatch(
      /permission denied|row-level security|violates|duplicate key|constraint|null value in column/i,
    );
    expect(fallo.message).toMatch(/mov/i); // "movés el stock a otra bodega primero"
  });

  it("una bodega sin saldo se borra sin problema", async () => {
    await borrar(bodegaB);
    const quedo = await client.query(`SELECT 1 FROM public.warehouses WHERE id = $1`, [bodegaB]);
    expect(quedo.rowCount).toBe(0);
  });

  it("una bodega que quedó en cero se borra sin problema", async () => {
    // Una fila de inventory_stock en 0 no es saldo: es el rastro de un movimiento.
    await movimiento("entrada", 4, bodegaB);
    await movimiento("salida", 4, bodegaB);
    await borrar(bodegaB);

    const quedo = await client.query(`SELECT 1 FROM public.warehouses WHERE id = $1`, [bodegaB]);
    expect(quedo.rowCount).toBe(0);
    await esperaCuadre();
  });

  it("no se puede desactivar una bodega con saldo", async () => {
    await movimiento("entrada", 7, bodegaB);

    const fallo = await esperaFallo(client, () => desactivar(bodegaB));
    expect(fallo.code).toBe("23514");
    expect(fallo.message).toMatch(/Bodega B/);

    const activa = await client.query<{ is_active: boolean }>(
      `SELECT is_active FROM public.warehouses WHERE id = $1`,
      [bodegaB],
    );
    expect(activa.rows[0].is_active).toBe(true);
  });

  it("una bodega sin saldo se desactiva sin problema", async () => {
    await desactivar(bodegaB);
    const activa = await client.query<{ is_active: boolean }>(
      `SELECT is_active FROM public.warehouses WHERE id = $1`,
      [bodegaB],
    );
    expect(activa.rows[0].is_active).toBe(false);
  });

  it("renombrar o reordenar una bodega con saldo sigue funcionando", async () => {
    // El bloqueo es sobre sacarla de circulación, no sobre editarla.
    await movimiento("entrada", 5, bodegaB);
    await comoUsuario(
      client,
      usuarios.owner,
      `UPDATE public.warehouses SET name = 'Bodega Norte', position = 3 WHERE id = $1`,
      [bodegaB],
    );
    const fila = await client.query<{ name: string; position: number }>(
      `SELECT name, position FROM public.warehouses WHERE id = $1`,
      [bodegaB],
    );
    expect(fila.rows[0].name).toBe("Bodega Norte");
    expect(fila.rows[0].position).toBe(3);
  });

  it("reactivar una bodega nunca se bloquea", async () => {
    // Una bodega inactiva con saldo puede existir desde antes de esta regla.
    // Volver a ponerla en circulación es justamente la salida de ese estado.
    await client.query(`UPDATE public.warehouses SET is_active = false WHERE id = $1`, [bodegaB]);
    await movimiento("entrada", 6, bodegaB);

    await comoUsuario(
      client,
      usuarios.owner,
      `UPDATE public.warehouses SET is_active = true WHERE id = $1`,
      [bodegaB],
    );
    const activa = await client.query<{ is_active: boolean }>(
      `SELECT is_active FROM public.warehouses WHERE id = $1`,
      [bodegaB],
    );
    expect(activa.rows[0].is_active).toBe(true);
  });

  it("borrar la clínica entera no se traba con el inventario adentro", async () => {
    // warehouses.clinic_id es ON DELETE CASCADE. El bloqueo protege a la
    // bodega de que la saquen de circulación con stock adentro, no impide
    // dar de baja la clínica completa — si eso fallara, una clínica con
    // inventario sería imposible de borrar.
    await movimiento("entrada", 9, bodegaB);
    await movimiento("entrada", 2, general);

    await client.query(`DELETE FROM public.clinics WHERE id = $1`, [clinicId]);
    const quedo = await client.query(`SELECT 1 FROM public.warehouses WHERE clinic_id = $1`, [
      clinicId,
    ]);
    expect(quedo.rowCount).toBe(0);
  });
});
