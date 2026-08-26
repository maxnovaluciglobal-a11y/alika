-- Tier 2-H (plan Dentidesk): vencimientos y lotes en inventario. Extiende
-- inventory_movements (no rediseña el ledger) — el stock sigue siendo un
-- agregado por ítem, ver comentario original de inventory_module.sql; esto
-- solo permite registrar de qué lote/vencimiento vino cada entrada, para
-- poder avisar de vencimientos próximos. Ningún competidor confirmado en el
-- análisis lo tiene — es un diferenciador, no solo paridad.

ALTER TABLE public.inventory_movements
  ADD COLUMN lot_number text,
  ADD COLUMN expiration_date date;

CREATE INDEX inventory_movements_expiration_idx
  ON public.inventory_movements (clinic_id, expiration_date)
  WHERE expiration_date IS NOT NULL AND kind = 'entrada';
