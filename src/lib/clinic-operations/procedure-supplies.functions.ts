import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { mensajeDb } from "@/lib/db-errors";
import {
  computeReversalLines,
  type SupplyMovementRecord,
} from "@/lib/clinic-operations/procedure-supply-consumption";

export type ProcedureSupply = {
  itemId: string;
  itemName: string;
  unit: string;
  quantity: number;
};

/** Receta de insumos de un procedimiento, con nombre/unidad del insumo para
 * mostrar en la UI. RLS: mismo set operativo que inventory_items (SELECT). */
export const listProcedureSupplies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), procedureId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ supplies: ProcedureSupply[] }> => {
    const { data: rows, error } = await context.supabase
      .from("procedure_supplies")
      .select("item_id, quantity")
      .eq("clinic_id", data.clinicId)
      .eq("procedure_id", data.procedureId);
    if (error) throw new Error(mensajeDb(error, "No pudimos cargar la receta del procedimiento."));
    if (!rows || rows.length === 0) return { supplies: [] };

    const itemIds = rows.map((r) => r.item_id);
    const { data: items, error: itemsError } = await context.supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("clinic_id", data.clinicId)
      .in("id", itemIds);
    if (itemsError)
      throw new Error(mensajeDb(itemsError, "No pudimos cargar la receta del procedimiento."));
    const itemById = new Map((items ?? []).map((i) => [i.id, i]));

    const supplies: ProcedureSupply[] = rows
      .map((r) => {
        const item = itemById.get(r.item_id);
        if (!item) return null;
        return { itemId: r.item_id, itemName: item.name, unit: item.unit, quantity: r.quantity };
      })
      .filter((x): x is ProcedureSupply => x !== null);
    return { supplies };
  });

/** Reemplaza la receta completa de un procedimiento (borra + inserta de
 * nuevo — son pocas líneas de configuración, no eventos históricos). RLS
 * (`procedure_supplies_write_managers`) ya exige owner/admin/dentist. */
export const setProcedureSupplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        procedureId: z.string().uuid(),
        supplies: z
          .array(
            z.object({
              itemId: z.string().uuid(),
              quantity: z.number().positive("La cantidad debe ser mayor a 0."),
            }),
          )
          .max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error: deleteError } = await context.supabase
      .from("procedure_supplies")
      .delete()
      .eq("clinic_id", data.clinicId)
      .eq("procedure_id", data.procedureId);
    if (deleteError)
      throw new Error(mensajeDb(deleteError, "No pudimos guardar la receta del procedimiento."));

    if (data.supplies.length === 0) return { ok: true };

    const { error: insertError } = await context.supabase.from("procedure_supplies").insert(
      data.supplies.map((s) => ({
        clinic_id: data.clinicId,
        procedure_id: data.procedureId,
        item_id: s.itemId,
        quantity: s.quantity,
      })),
    );
    if (insertError)
      throw new Error(mensajeDb(insertError, "No pudimos guardar la receta del procedimiento."));
    return { ok: true };
  });

/**
 * Consume los insumos de la receta del procedimiento para un treatment_item
 * que acaba de completarse. Llamada desde setTreatmentItemStatus, nunca
 * expuesta directo al cliente. Sin procedimiento vinculado, o sin receta
 * configurada para ese procedimiento, no hace nada — es el caso normal
 * (`treatment_items.procedure_id` es nullable), no un error.
 *
 * Si algún insumo queda con stock negativo, ese movimiento puntual se omite
 * en vez de abortar todo (mismo principio que el descuento de stock en
 * DypOS): completar la atención al paciente no puede depender de que el
 * inventario cuadre. `skippedCount` le avisa a quien llama para mostrar un
 * aviso, no para bloquear nada.
 */
export async function applyTreatmentItemSupplyConsumption(
  supabase: SupabaseClient<Database>,
  params: { clinicId: string; treatmentItemId: string; procedureId: string | null },
): Promise<{ skippedCount: number }> {
  if (!params.procedureId) return { skippedCount: 0 };

  const { data: supplies, error } = await supabase
    .from("procedure_supplies")
    .select("item_id, quantity")
    .eq("clinic_id", params.clinicId)
    .eq("procedure_id", params.procedureId);
  if (error)
    throw new Error(mensajeDb(error, "No pudimos leer la receta de insumos del procedimiento."));
  if (!supplies || supplies.length === 0) return { skippedCount: 0 };

  let skippedCount = 0;
  for (const supply of supplies) {
    const { error: insertError } = await supabase.from("inventory_movements").insert({
      clinic_id: params.clinicId,
      item_id: supply.item_id,
      kind: "salida",
      quantity: supply.quantity,
      reason: "Consumo automático por procedimiento",
      treatment_item_id: params.treatmentItemId,
    });
    if (insertError) {
      // 23514 = check_violation: esa salida hubiese dejado el stock en
      // negativo (inventory_items.current_stock >= 0). Se omite ese insumo
      // puntual, no todo el consumo — mismo criterio que registerInventoryMovement
      // usa para el mensaje al usuario, pero acá no hay usuario esperando en
      // un diálogo: el tratamiento se completa igual.
      if (insertError.code === "23514") {
        skippedCount += 1;
        continue;
      }
      throw new Error(
        mensajeDb(insertError, "No pudimos descontar los insumos del procedimiento."),
      );
    }
  }
  return { skippedCount };
}

/**
 * Revierte el consumo automático de insumos de un treatment_item que se
 * des-completó. Idempotente (ver computeReversalLines): si ya no queda nada
 * pendiente de revertir — por ejemplo, si se llama dos veces por error — no
 * genera movimientos nuevos.
 */
export async function reverseTreatmentItemSupplyConsumption(
  supabase: SupabaseClient<Database>,
  params: { clinicId: string; treatmentItemId: string },
): Promise<void> {
  const { data: movements, error } = await supabase
    .from("inventory_movements")
    .select("item_id, kind, quantity")
    .eq("clinic_id", params.clinicId)
    .eq("treatment_item_id", params.treatmentItemId);
  if (error)
    throw new Error(
      mensajeDb(error, "No pudimos leer los movimientos de inventario del tratamiento."),
    );
  if (!movements || movements.length === 0) return;

  const records: SupplyMovementRecord[] = movements.map((m) => ({
    itemId: m.item_id,
    kind: m.kind as "entrada" | "salida",
    quantity: m.quantity,
  }));
  const toReverse = computeReversalLines(records);
  if (toReverse.length === 0) return;

  const { error: insertError } = await supabase.from("inventory_movements").insert(
    toReverse.map((line) => ({
      clinic_id: params.clinicId,
      item_id: line.itemId,
      kind: "entrada" as const,
      quantity: line.quantity,
      reason: "Reversión de consumo automático por procedimiento",
      treatment_item_id: params.treatmentItemId,
    })),
  );
  if (insertError)
    throw new Error(mensajeDb(insertError, "No pudimos revertir el consumo de insumos."));
}
