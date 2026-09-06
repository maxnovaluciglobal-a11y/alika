import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mensajeDb } from "@/lib/db-errors";

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
  /** null = sin sucursal asignada (compartido, o clínica de una sola sede,
   * o la migración `20260827050000_inventory_branch_segmentation` todavía
   * no se aplicó — ver degradación null-safe en listInventoryItems). */
  branchId: string | null;
};

export type InventoryMovement = {
  id: string;
  itemId: string;
  kind: InventoryMovementKind;
  quantity: number;
  reason: string | null;
  lotNumber: string | null;
  expirationDate: string | null;
  recordedBy: string;
  recordedAt: string;
};

export type ExpiringLot = {
  movementId: string;
  itemId: string;
  itemName: string;
  unit: string;
  quantity: number;
  lotNumber: string | null;
  expirationDate: string;
};

const INVENTORY_ITEM_COLUMNS =
  "id, name, unit, current_stock, min_stock, cost_cents, notes, is_active, created_at";

/** Postgres "undefined_column" — la migración de branch_id todavía no se
 * aplicó al Supabase real. No es un error real de la request, es el estado
 * "pre-migración" descrito en CLAUDE.md: degradar sin romper la página. */
const UNDEFINED_COLUMN = "42703";

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
  branch_id?: string | null;
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
    branchId: row.branch_id ?? null,
  };
}

/** Listado de ítems de inventario de la clínica. RLS: todos los roles
 * clínicos con acceso operativo (incluye reception, es información
 * operativa no clínica sensible). Incluye inactivos — la UI decide si
 * los muestra u oculta.
 *
 * `branchId` (product-2, auditoría 360): filtra por sucursal cuando la
 * clínica tiene más de una activa — la UI solo lo manda en ese caso, ver
 * inventario.tsx. Si la migración de branch_id todavía no corrió contra el
 * Supabase real, degrada solo (sin filtro, `branchId: null` en cada ítem)
 * en vez de romper la página. */
export const listInventoryItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), branchId: z.string().uuid().nullish() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ items: InventoryItem[] }> => {
    let query = context.supabase
      .from("inventory_items")
      .select(`${INVENTORY_ITEM_COLUMNS}, branch_id`)
      .eq("clinic_id", data.clinicId);
    if (data.branchId) query = query.eq("branch_id", data.branchId);

    const first = await query.order("name", { ascending: true });
    let rows: InventoryItemRow[] | null = first.data as InventoryItemRow[] | null;
    let error = first.error;

    if (error?.code === UNDEFINED_COLUMN) {
      // Pre-migración: reintentar sin branch_id, ignorando el filtro (no
      // hay columna que filtrar todavía).
      const fallback = await context.supabase
        .from("inventory_items")
        .select(INVENTORY_ITEM_COLUMNS)
        .eq("clinic_id", data.clinicId)
        .order("name", { ascending: true });
      rows = fallback.data as InventoryItemRow[] | null;
      error = fallback.error;
    }
    if (error) throw new Error(mensajeDb(error, "No pudimos cargar el inventario."));

    return { items: (rows ?? []).map((r) => mapInventoryItemRow(r)) };
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
        // product-2: solo lo manda la UI cuando la clínica tiene >1 sucursal
        // activa. null = sin sucursal asignada (compartido).
        branchId: z.string().uuid().nullable().optional(),
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
        branch_id: data.branchId ?? null,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === UNDEFINED_COLUMN) {
        throw new Error(
          "No pudimos guardar la sucursal del ítem: la migración de sucursales en inventario todavía no se aplicó. Avisale a Walter.",
        );
      }
      throw new Error(mensajeDb(error, "No pudimos crear el ítem de inventario."));
    }
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
        // product-2: solo lo manda la UI cuando la clínica tiene >1 sucursal
        // activa. null = sin sucursal asignada (compartido).
        branchId: z.string().uuid().nullable().optional(),
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
        ...(data.branchId !== undefined ? { branch_id: data.branchId } : {}),
      })
      .eq("id", data.itemId)
      .eq("clinic_id", data.clinicId);

    if (error) {
      if (error.code === UNDEFINED_COLUMN) {
        throw new Error(
          "No pudimos guardar la sucursal del ítem: la migración de sucursales en inventario todavía no se aplicó. Avisale a Walter.",
        );
      }
      throw new Error(mensajeDb(error, "No pudimos actualizar el ítem de inventario."));
    }
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
        // Solo tienen sentido en una entrada — un lote que llega con su
        // propio vencimiento. En salida/ajuste el cliente no los manda.
        lotNumber: z.string().trim().max(80).optional(),
        expirationDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
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
        lot_number: data.kind === "entrada" ? data.lotNumber || null : null,
        expiration_date: data.kind === "entrada" ? data.expirationDate || null : null,
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
      throw new Error(mensajeDb(error, "No pudimos registrar el movimiento de inventario."));
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
        .select(
          "id, item_id, kind, quantity, reason, lot_number, expiration_date, recorded_by, recorded_at",
        )
        .eq("clinic_id", data.clinicId)
        .eq("item_id", data.itemId)
        .order("recorded_at", { ascending: false })
        .limit(INVENTORY_MOVEMENTS_ROW_LIMIT);

      if (error)
        throw new Error(mensajeDb(error, "No pudimos cargar el historial de movimientos."));
      const truncated = (rows ?? []).length >= INVENTORY_MOVEMENTS_ROW_LIMIT;

      const items: InventoryMovement[] = (rows ?? []).map((r) => ({
        id: r.id,
        itemId: r.item_id,
        kind: r.kind as InventoryMovementKind,
        quantity: r.quantity,
        reason: r.reason,
        lotNumber: r.lot_number,
        expirationDate: r.expiration_date,
        recordedBy: r.recorded_by,
        recordedAt: r.recorded_at,
      }));
      return { items, truncated };
    },
  );

/** Lotes de entradas con vencimiento dentro de `withinDays` (default 60),
 * ordenados por fecha más próxima primero. No rastrea cuánto de ese lote
 * queda en stock (el ledger es agregado por ítem, ver comentario en la
 * migración) — es un aviso de "esto vence pronto", no un FEFO exacto. */
export const listExpiringLots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        withinDays: z.number().int().min(1).max(365).default(60),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ExpiringLot[]> => {
    const limit = new Date();
    limit.setDate(limit.getDate() + data.withinDays);
    const limitDate = limit.toISOString().slice(0, 10);

    const { data: movements, error } = await context.supabase
      .from("inventory_movements")
      .select("id, item_id, quantity, lot_number, expiration_date")
      .eq("clinic_id", data.clinicId)
      .eq("kind", "entrada")
      .not("expiration_date", "is", null)
      .lte("expiration_date", limitDate)
      .order("expiration_date", { ascending: true });
    if (error) throw new Error(mensajeDb(error, "No pudimos cargar los lotes por vencer."));
    if (!movements || movements.length === 0) return [];

    const itemIds = [...new Set(movements.map((m) => m.item_id))];
    const { data: items, error: itemsError } = await context.supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("clinic_id", data.clinicId)
      .in("id", itemIds);
    if (itemsError)
      throw new Error(mensajeDb(itemsError, "No pudimos cargar los lotes por vencer."));
    const itemById = new Map((items ?? []).map((i) => [i.id, i]));

    return movements
      .map((m) => {
        const item = itemById.get(m.item_id);
        if (!item || !m.expiration_date) return null;
        return {
          movementId: m.id,
          itemId: m.item_id,
          itemName: item.name,
          unit: item.unit,
          quantity: m.quantity,
          lotNumber: m.lot_number,
          expirationDate: m.expiration_date,
        };
      })
      .filter((x): x is ExpiringLot => x !== null);
  });
