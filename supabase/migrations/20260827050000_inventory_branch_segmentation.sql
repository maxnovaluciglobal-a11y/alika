-- product-2 (auditoría 360, P1): inventario por sucursal.
--
-- inventory_items no tenía branch_id — el hallazgo de auditoría asumía que
-- ya existía nullable, pero la migración original (20260822152000) nunca la
-- agregó. Clínicas con una sola sucursal (el caso común hoy) no necesitan
-- este campo para nada — por eso nullable sin default forzado: un ítem sin
-- branch_id es "compartido / sin sucursal asignada", no un error de datos.
--
-- No se segmenta current_stock por sucursal (seguiría siendo un solo
-- agregado por ítem, ver comentario de diseño en inventory_module.sql) —
-- esto es solo para que una clínica multi-sucursal pueda filtrar qué
-- ítems pertenecen a qué sede (ej. "guantes M" cargados por separado en
-- Sucursal Providencia vs Sucursal Ñuñoa), no un rediseño del ledger.
--
-- ON DELETE SET NULL: borrar una sucursal no debe arrastrar ítems de
-- inventario ni su historial de movimientos — el ítem queda "sin sucursal
-- asignada" en vez de desaparecer.

ALTER TABLE public.inventory_items
  ADD COLUMN branch_id uuid NULL REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX inventory_items_branch_idx
  ON public.inventory_items (clinic_id, branch_id)
  WHERE branch_id IS NOT NULL;
