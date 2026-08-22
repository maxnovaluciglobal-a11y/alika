import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InventoryMovementKind = "entrada" | "salida" | "ajuste";

export type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  /** null = "sin alerta configurada" (placeholder, no 0 fabricado). */
  minStock: number | null;
  /** bigint cents, null = sin costo cargado. */
  costCents: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  /** Campo derivado, no columna: true si hay min_stock configurado y el
   * stock actual está en o por debajo de ese umbral. */
  belowMinStock: boolean;
};

export type InventoryMovement = {
  id: string;
  itemId: string;
  kind: InventoryMovementKind;
  quantity: number;
  reason: string | null;
  recordedBy: string;
  recordedAt: string;
};

const INVENTORY_ITEM_COLUMNS =
  "id, name, unit, current_stock, min_stock, cost_cents, notes, is_active, created_at";

type InventoryItemRow = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number | null;
  cost_cents: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

function mapInventoryItemRow(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    currentStock: row.current_stock,
    minStock: row.min_stock,
    costCents: row.cost_cents,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    belowMinStock: row.min_stock != null && row.current_stock <= row.min_stock,
  };
}

/** Listado de ítems de inventario de la clínica. RLS: todos los roles
 * clínicos con acceso operativo (incluye reception, es información
 * operativa no clínica sensible). Incluye inactivos — la UI decide si
 * los muestra u oculta. */
export const listInventoryItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ items: InventoryItem[] }> => {
    const { data: rows, error } = await context.supabase
      .from("inventory_items")
      .select(INVENTORY_ITEM_COLUMNS)
      .eq("clinic_id", data.clinicId)
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);

    return { items: (rows ?? []).map((r) => mapInventoryItemRow(r as InventoryItemRow)) };
  });

/** Crea un ítem de inventario. RLS (`inventory_items_insert_managers`) ya
 * exige owner/admin; nunca recibe current_stock (arranca en 0 por default
 * de la columna, se carga con un movimiento de 'entrada' posterior). */
export const createInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        name: z.string().trim().min(1, "Nombre obligatorio.").max(120),
        unit: z.string().trim().min(1, "Unidad obligatoria.").max(40),
        minStock: z.number().min(0).nullable().optional(),
        costCents: z.number().int().min(0).nullable().optional(),
        notes: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: row, error } = await context.supabase
      .from("inventory_items")
      .insert({
        clinic_id: data.clinicId,
        name: data.name,
        unit: data.unit,
        min_stock: data.minStock ?? null,
        cost_cents: data.costCents ?? null,
        notes: data.notes || null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/** Edita nombre/unit/min_stock/cost_cents/is_active de un ítem. Nunca
 * current_stock — eso solo lo toca el trigger de inventory_movements. RLS
 * (`inventory_items_update_managers`) ya exige owner/admin; `clinicId` en
 * el `.eq()` es cinturón de defensa en profundidad. */
export const updateInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        itemId: z.string().uuid(),
        name: z.string().trim().min(1, "Nombre obligatorio.").max(120),
        unit: z.string().trim().min(1, "Unidad obligatoria.").max(40),
        minStock: z.number().min(0).nullable().optional(),
        costCents: z.number().int().min(0).nullable().optional(),
        notes: z.string().trim().max(1000).optional(),
        isActive: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("inventory_items")
      .update({
        name: data.name,
        unit: data.unit,
        min_stock: data.minStock ?? null,
        cost_cents: data.costCents ?? null,
        notes: data.notes || null,
        is_active: data.isActive,
      })
      .eq("id", data.itemId)
      .eq("clinic_id", data.clinicId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Registra un movimiento de stock (entrada/salida/ajuste). El trigger
 * `apply_inventory_movement` aplica el efecto sobre `current_stock` — esta
 * función nunca lo toca directamente. RLS ya restringe el INSERT a los
 * roles que tocan insumos en el día a día (owner/admin/dentist/assistant).
 * Si `kind='salida'` deja el stock en negativo, el CHECK de la tabla revierte
 * todo el INSERT y este handler propaga ese error. */
export const registerInventoryMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        itemId: z.string().uuid(),
        kind: z.enum(["entrada", "salida", "ajuste"]),
        quantity: z.number().positive("La cantidad debe ser mayor a 0."),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: row, error } = await context.supabase
      .from("inventory_movements")
      .insert({
        clinic_id: data.clinicId,
        item_id: data.itemId,
        kind: data.kind,
        quantity: data.quantity,
        reason: data.reason || null,
      })
      .select("id")
      .single();

    if (error) {
      // 23514 = check_violation. El trigger que aplica el movimiento a
      // current_stock corre dentro de este INSERT — si una salida deja el
      // stock en negativo, el CHECK de inventory_items revienta acá.
      // Mismo criterio que ya usa el repo para odontogram (23505 -> mensaje
      // claro, ver CLAUDE.md) en vez de mostrar el error crudo de Postgres.
      if (error.code === "23514") {
        throw new Error(
          "Esa salida deja el stock en negativo — revisá la cantidad o registrá antes un ajuste con el conteo real.",
        );
      }
      throw new Error(error.message);
    }
    return { id: row.id };
  });

/**
 * Tope de fila del historial — misma red de seguridad que
 * PATIENTS_ROW_LIMIT/APPOINTMENTS_ROW_LIMIT, no una estrategia de paginado
 * real. `truncated` avisa a la UI que hay más movimientos de los que se
 * trajeron.
 */
const INVENTORY_MOVEMENTS_ROW_LIMIT = 2_000;

/** Historial de movimientos de un ítem, más reciente primero. RLS: mismo
 * set que inventory_items (SELECT). */
export const listInventoryMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), itemId: z.string().uuid() }).parse(input),
  )
  .handler(
    async ({ data, context }): Promise<{ items: InventoryMovement[]; truncated: boolean }> => {
      const { data: rows, error } = await context.supabase
        .from("inventory_movements")
        .select("id, item_id, kind, quantity, reason, recorded_by, recorded_at")
        .eq("clinic_id", data.clinicId)
        .eq("item_id", data.itemId)
        .order("recorded_at", { ascending: false })
        .limit(INVENTORY_MOVEMENTS_ROW_LIMIT);

      if (error) throw new Error(error.message);
      const truncated = (rows ?? []).length >= INVENTORY_MOVEMENTS_ROW_LIMIT;

      const items: InventoryMovement[] = (rows ?? []).map((r) => ({
        id: r.id,
        itemId: r.item_id,
        kind: r.kind as InventoryMovementKind,
        quantity: r.quantity,
        reason: r.reason,
        recordedBy: r.recorded_by,
        recordedAt: r.recorded_at,
      }));
      return { items, truncated };
    },
  );
