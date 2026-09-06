-- Tanda 1 · Receta de insumos por procedimiento.
--
-- Hoy, cuando un dentista completa una limpieza o una extracción, el
-- inventario no se entera: los insumos se descuentan a mano (o no se
-- descuentan nunca). Esta migración agrega la "receta" — qué insumos y en
-- qué cantidad consume típicamente cada tipo de procedimiento — para que
-- `setTreatmentItemStatus` (finance.functions.ts) pueda descontar
-- automáticamente al marcar el tratamiento como realizado, y revertir si se
-- deshace. La lógica de consumo/reversión vive en
-- procedure-supplies.functions.ts + procedure-supply-consumption.ts, no acá.

CREATE TABLE public.procedure_supplies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  -- Cantidad estándar en la unidad del insumo (inventory_items.unit) — mismo
  -- criterio que product_ingredients.quantity_used en DypOS: sin columna de
  -- unidad propia, la línea de receta no reinterpreta la unidad del insumo.
  quantity numeric NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  -- Un procedimiento no puede tener dos líneas de receta para el mismo
  -- insumo — se edita la cantidad de la existente, no se duplica.
  UNIQUE (procedure_id, item_id)
);

COMMENT ON TABLE public.procedure_supplies IS
  'Receta de insumos por procedimiento: qué y cuánto se descuenta del inventario al completar un treatment_item de ese procedimiento.';
COMMENT ON COLUMN public.procedure_supplies.quantity IS
  'Cantidad estándar consumida, en la unidad del insumo (inventory_items.unit). Editable en el momento no está en el alcance de esta tanda.';

CREATE INDEX procedure_supplies_procedure_idx ON public.procedure_supplies(procedure_id);
CREATE INDEX procedure_supplies_item_idx ON public.procedure_supplies(item_id);

ALTER TABLE public.procedure_supplies ENABLE ROW LEVEL SECURITY;

-- Lectura: mismo set que inventory_items_select_clinical — es información
-- operativa de inventario, no clínica sensible.
CREATE POLICY procedure_supplies_select_clinical ON public.procedure_supplies
  FOR SELECT
  USING (public.is_clinic_member(clinic_id));

-- Escritura: mismo criterio que procedures_write_managers. La receta es
-- configuración del procedimiento (arancel), no una operación del día a día
-- como registrar un movimiento de stock.
CREATE POLICY procedure_supplies_write_managers ON public.procedure_supplies
  FOR ALL
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist']::public.app_role[]));

-- Trazabilidad: qué treatment_item generó (o revirtió) un movimiento
-- automático de inventario. NULL = movimiento manual de siempre, sin cambio
-- de comportamiento para lo que ya existe.
ALTER TABLE public.inventory_movements
  ADD COLUMN treatment_item_id uuid REFERENCES public.treatment_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.inventory_movements.treatment_item_id IS
  'Tratamiento que generó este movimiento automático (consumo o su reversión). NULL = movimiento manual.';

CREATE INDEX inventory_movements_treatment_item_idx
  ON public.inventory_movements(treatment_item_id)
  WHERE treatment_item_id IS NOT NULL;
