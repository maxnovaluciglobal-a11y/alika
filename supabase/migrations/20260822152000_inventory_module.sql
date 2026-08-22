-- Módulo de inventario/control de stock a nivel clínica (no por paciente).
-- MVP: tracking simple de insumos/materiales, no un ERP.
--
-- Patrón: igual que odontogram_marks, NO hay UPDATE de movimientos ya
-- registrados. Un error se corrige con un movimiento de 'ajuste' nuevo,
-- nunca editando el viejo. `current_stock` en inventory_items se mantiene
-- vía trigger SECURITY DEFINER en cada INSERT de inventory_movements — la
-- app nunca escribe current_stock directamente.
--
-- Semántica de `kind` sobre current_stock (decisión de diseño, revisar):
--   entrada -> current_stock += quantity
--   salida  -> current_stock -= quantity (el CHECK current_stock >= 0 en
--              inventory_items revierte toda la transacción si no alcanza)
--   ajuste  -> current_stock := quantity (recuento físico: fija el valor
--              absoluto contado, no lo suma/resta). quantity siempre > 0
--              porque no existe "stock negativo".

CREATE TYPE public.inventory_movement_kind AS ENUM ('entrada', 'salida', 'ajuste');

CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- Unidad libre ("unidad"/"caja"/"ml"/etc) — sin catálogo de unidades, es MVP.
  unit text NOT NULL,
  current_stock numeric NOT NULL DEFAULT 0,
  -- null = "sin alerta configurada" (placeholder nullable, no fabricar 0).
  min_stock numeric,
  -- bigint cents, mismo patrón de dinero que el resto del repo. Nullable:
  -- no todos los ítems tienen costo cargado.
  cost_cents bigint,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_items_stock_non_negative CHECK (current_stock >= 0),
  CONSTRAINT inventory_items_min_stock_non_negative CHECK (min_stock IS NULL OR min_stock >= 0)
);

CREATE INDEX inventory_items_clinic_idx ON public.inventory_items (clinic_id, is_active, name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- SELECT: información operativa, no clínica sensible — todos los roles
-- clínicos la ven (incluye reception, a diferencia de clinical_notes/odontogram).
CREATE POLICY "inventory_items_select_clinical" ON public.inventory_items
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant','reception']::public.app_role[]
    )
  );

-- INSERT/UPDATE (nombre, unit, min_stock, cost_cents, is_active — nunca
-- current_stock a mano, eso lo hace solo el trigger) restringido a
-- owner/admin.
CREATE POLICY "inventory_items_insert_managers" ON public.inventory_items
  FOR INSERT TO authenticated WITH CHECK (
    public.can_manage_clinic(clinic_id) AND created_by = auth.uid()
  );

CREATE POLICY "inventory_items_update_managers" ON public.inventory_items
  FOR UPDATE TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));

-- Sin DELETE para nadie: dar de baja un ítem es is_active=false, nunca
-- borrarlo (preserva el historial de movimientos).

CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  kind public.inventory_movement_kind NOT NULL,
  -- Siempre positivo — el signo/efecto sobre el stock lo da `kind`, ver
  -- comentario arriba.
  quantity numeric NOT NULL,
  -- ej. "compra", "uso en tratamiento", "merma", "conteo físico".
  reason text,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX inventory_movements_item_idx
  ON public.inventory_movements (clinic_id, item_id, recorded_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- SELECT: mismo set que inventory_items.
CREATE POLICY "inventory_movements_select_clinical" ON public.inventory_movements
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant','reception']::public.app_role[]
    )
  );

-- INSERT: solo roles que realmente tocan insumos en el día a día. reception
-- y accounting quedan afuera (criterio propio, revisar) — reception no
-- maneja materiales clínicos, accounting es de solo-lectura de finanzas.
CREATE POLICY "inventory_movements_insert_clinical" ON public.inventory_movements
  FOR INSERT TO authenticated WITH CHECK (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant']::public.app_role[]
    )
    AND recorded_by = auth.uid()
  );

-- Nunca UPDATE ni DELETE por nadie — mismo patrón que
-- odontogram_no_manual_update. Un error se corrige con un 'ajuste' nuevo.
CREATE POLICY "inventory_movements_no_manual_update" ON public.inventory_movements
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "inventory_movements_no_delete" ON public.inventory_movements
  FOR DELETE TO authenticated USING (false);

-- Trigger: aplica el efecto del movimiento sobre current_stock. La app
-- nunca escribe inventory_items.current_stock directamente.
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'entrada' THEN
    UPDATE public.inventory_items
       SET current_stock = current_stock + NEW.quantity
     WHERE id = NEW.item_id AND clinic_id = NEW.clinic_id;
  ELSIF NEW.kind = 'salida' THEN
    UPDATE public.inventory_items
       SET current_stock = current_stock - NEW.quantity
     WHERE id = NEW.item_id AND clinic_id = NEW.clinic_id;
  ELSIF NEW.kind = 'ajuste' THEN
    UPDATE public.inventory_items
       SET current_stock = NEW.quantity
     WHERE id = NEW.item_id AND clinic_id = NEW.clinic_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_items no encontrado para item_id=% clinic_id=%', NEW.item_id, NEW.clinic_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_movements_apply_stock
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_inventory_movement();
