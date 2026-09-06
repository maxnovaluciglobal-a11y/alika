-- Tanda 3 — reconciliación física: registra un conteo real de un insumo
-- (clínica entera, o de una bodega puntual) contra lo que el sistema cree
-- tener, y deja rastro de si hubo diferencia y qué movimiento la corrigió.
--
-- No introduce un nuevo tipo de movimiento: cuando hay diferencia, el
-- server function inserta un `entrada`/`salida` normal por la magnitud
-- exacta (ver inventory-reconciliation.ts) — reutiliza el trigger
-- `apply_inventory_movement` ya probado, que suma/resta correctamente tanto
-- el total de la clínica como el saldo de la bodega puntual. Un `ajuste`
-- sobreescribiría el total de la clínica entera, lo cual sería incorrecto
-- si el conteo fue de una sola bodega en una clínica con más de una.
CREATE TABLE public.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  -- NULL = conteo del total de la clínica (todas las bodegas juntas) — el
  -- caso normal en una clínica que no configuró bodegas propias.
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  -- Snapshot de lo que el sistema creía tener en el momento del conteo —
  -- inventory_items.current_stock o inventory_stock.current_stock según
  -- warehouse_id, leído por el server function justo antes de comparar.
  theoretical_quantity numeric NOT NULL,
  counted_quantity numeric NOT NULL CHECK (counted_quantity >= 0),
  difference numeric GENERATED ALWAYS AS (counted_quantity - theoretical_quantity) STORED,
  notes text,
  -- El movimiento de entrada/salida que este conteo generó para corregir la
  -- diferencia. NULL cuando el conteo coincidió exacto con lo teórico.
  movement_id uuid REFERENCES public.inventory_movements(id) ON DELETE SET NULL,
  counted_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  counted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_counts_item_idx
  ON public.inventory_counts (clinic_id, item_id, counted_at DESC);

GRANT SELECT, INSERT ON public.inventory_counts TO authenticated;
GRANT ALL ON public.inventory_counts TO service_role;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;

-- Mismo set que ya lee inventory_items/inventory_movements (información
-- operativa, no clínica sensible — incluye reception).
CREATE POLICY "inventory_counts_select_clinical" ON public.inventory_counts
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant','reception']::public.app_role[]
    )
  );

-- INSERT: mismo set que inventory_movements — quienes tocan insumos en el
-- día a día. Un conteo es un evento histórico, igual que un movimiento: se
-- inserta, nunca se edita ni se borra (un conteo mal hecho se corrige con
-- uno nuevo, mismo criterio que el resto del módulo de inventario).
CREATE POLICY "inventory_counts_insert_operational" ON public.inventory_counts
  FOR INSERT TO authenticated WITH CHECK (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant']::public.app_role[]
    )
    AND counted_by = auth.uid()
  );

CREATE POLICY "inventory_counts_no_manual_update" ON public.inventory_counts
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "inventory_counts_no_delete" ON public.inventory_counts
  FOR DELETE TO authenticated USING (false);
