import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { comoUsuario, conectar, esperaFallo, sembrarEscenario } from "./helpers/db";

/**
 * Invariante de inventario multi-bodega:
 *
 *     inventory_items.current_stock == SUM(inventory_stock.current_stock)
 *
 * `apply_inventory_movement` es el único escritor de las dos vistas del stock
 * (el total de la clínica y el saldo por bodega), así que es el único lugar
 * donde el invariante se puede romper — y se rompía: el total restaba sin
 * piso mientras la bodega clampeaba con GREATEST(0, ...), así que una salida
 * desde una bodega sin saldo perdía la diferencia en silencio.
 *
 * Estos tests fijan el invariante para los tres `kind` y para los tres
 * caminos que producen salidas en la app: el diálogo de movimiento (elige
 * bodega), el consumo automático por procedimiento (nunca elige) y la
 * reconciliación por conteo físico.
 */
describe("inventario multi-bodega — total del ítem == suma de las bodegas", () => {
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

    // La general la siembra el trigger on_clinic_created_warehouse.
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

  /** Registra un movimiento con la identidad del owner (recorded_by = auth.uid()). */
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

  /** Total del ítem y saldo por bodega, tal como los dejó el trigger. */
  async function saldos() {
    const total = await client.query<{ current_stock: string }>(
      `SELECT current_stock FROM public.inventory_items WHERE id = $1`,
      [itemId],
    );
    const filas = await client.query<{ warehouse_id: string; current_stock: string }>(
      `SELECT warehouse_id, current_stock FROM public.inventory_stock WHERE item_id = $1`,
      [itemId],
    );
    const porBodega: Record<string, number> = {};
    let suma = 0;
    for (const f of filas.rows) {
      porBodega[f.warehouse_id] = Number(f.current_stock);
      suma += Number(f.current_stock);
    }
    return { total: Number(total.rows[0].current_stock), suma, porBodega };
  }

  /** El invariante mismo. Se llama al final de cada caso, sin excepción. */
  async function esperaCuadre() {
    const { total, suma } = await saldos();
    expect(total).toBe(suma);
    return { total, suma };
  }

  it("una entrada sin bodega cae en la general y cuadra", async () => {
    await movimiento("entrada", 10);
    const { total, porBodega } = await saldos();
    expect(total).toBe(10);
    expect(porBodega[general]).toBe(10);
    await esperaCuadre();
  });

  it("el caso reportado: una salida desde una bodega vacía no descuadra", async () => {
    // Reproducción exacta del bug: entrada de 10 en la general, salida de 2
    // desde Bodega B (que tiene 0). El total de la clínica alcanza, el de la
    // bodega no. Antes del fix esto dejaba total=8 y suma=10.
    await movimiento("entrada", 10);
    const fallo = await esperaFallo(client, () => movimiento("salida", 2, bodegaB));
    expect(fallo.code).toBe("23514");
    expect(fallo.message).toMatch(/Bodega B/);

    const { total, porBodega } = await saldos();
    expect(total).toBe(10);
    expect(porBodega[general]).toBe(10);
    await esperaCuadre();
  });

  it("una salida desde una bodega con saldo suficiente descuenta solo esa bodega", async () => {
    await movimiento("entrada", 10, bodegaB);
    await movimiento("entrada", 4);
    await movimiento("salida", 3, bodegaB);

    const { total, porBodega } = await saldos();
    expect(porBodega[bodegaB]).toBe(7);
    expect(porBodega[general]).toBe(4);
    expect(total).toBe(11);
    await esperaCuadre();
  });

  it("una salida sin bodega se reparte entre las bodegas con saldo", async () => {
    // Es el camino del consumo automático por procedimiento, que nunca manda
    // warehouse_id: cae en la general y, si no alcanza, sigue por las demás
    // en orden de posición. Antes agotaba la general y perdía el resto.
    await movimiento("entrada", 3);
    await movimiento("entrada", 10, bodegaB);
    await movimiento("salida", 5);

    const { total, porBodega } = await saldos();
    expect(porBodega[general]).toBe(0);
    expect(porBodega[bodegaB]).toBe(8);
    expect(total).toBe(8);
    await esperaCuadre();
  });

  it("una salida que supera el stock de toda la clínica se rechaza con 23514", async () => {
    // 23514 es el código que ya interpretan registerInventoryMovement (mensaje
    // al usuario) y consumirInsumos (saltea ese insumo y completa el
    // tratamiento igual). Cambiarlo rompería las dos.
    await movimiento("entrada", 3);
    await movimiento("entrada", 4, bodegaB);
    const fallo = await esperaFallo(client, () => movimiento("salida", 10));
    expect(fallo.code).toBe("23514");

    const { total } = await saldos();
    expect(total).toBe(7);
    await esperaCuadre();
  });

  it("un ajuste sobre una bodega puntual no pisa el saldo de las demás", async () => {
    // Antes el ajuste fijaba el total de la clínica Y la bodega al mismo
    // número: con general=10 y B=5, un ajuste de 12 sobre B dejaba total=12
    // contra una suma de 22.
    await movimiento("entrada", 10);
    await movimiento("entrada", 5, bodegaB);
    await movimiento("ajuste", 12, bodegaB);

    const { total, porBodega } = await saldos();
    expect(porBodega[general]).toBe(10);
    expect(porBodega[bodegaB]).toBe(12);
    expect(total).toBe(22);
    await esperaCuadre();
  });

  it("un ajuste sin bodega fija la general y deja el total en la suma", async () => {
    // El caso de toda clínica de una sola sede: sin bodega elegida el
    // movimiento cae en la general, igual que la entrada y la salida. Con una
    // sola bodega el resultado es idéntico al de siempre (total = contado).
    await movimiento("entrada", 10);
    await movimiento("ajuste", 4);

    const { total, porBodega } = await saldos();
    expect(porBodega[general]).toBe(4);
    expect(total).toBe(4);
    await esperaCuadre();
  });

  it("un ajuste a la baja no deja saldo colgado en la bodega", async () => {
    // El CHECK inventory_movements_quantity_positive no admite quantity = 0,
    // así que el mínimo registrable es 1 — vaciar del todo se hace con salida.
    await movimiento("entrada", 8, bodegaB);
    await movimiento("ajuste", 1, bodegaB);

    const { total, porBodega } = await saldos();
    expect(porBodega[bodegaB]).toBe(1);
    expect(total).toBe(1);
    await esperaCuadre();
  });

  it("un movimiento de otra clínica no toca este ítem", async () => {
    const otra = await client.query<{ id: string }>(
      `INSERT INTO public.clinics (name, created_by) VALUES ('Otra Clínica', $1) RETURNING id`,
      [usuarios.owner],
    );
    const fallo = await esperaFallo(client, () =>
      comoUsuario(
        client,
        usuarios.owner,
        `INSERT INTO public.inventory_movements (clinic_id, item_id, kind, quantity)
         VALUES ($1, $2, 'entrada'::public.inventory_movement_kind, 5)`,
        [otra.rows[0].id, itemId],
      ),
    );
    expect(fallo.message).toMatch(/inventory_items no encontrado/);
  });
});
