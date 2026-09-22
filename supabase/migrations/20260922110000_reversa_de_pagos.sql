-- Reversa de pagos con trazabilidad.
--
-- Gap de la auditoría comparativa vs. SuperClini (22-sep-2026): un pago mal
-- cargado no se podía corregir salvo editando `amount_cents`/`method` a mano
-- (`payments_write_finance_roles` permite UPDATE), lo que borra la historia
-- de lo que realmente pasó. No se BORRA la fila (regla del proyecto: nunca
-- destruir historia financiera) — se marca reversada, con quién y por qué, y
-- queda excluida de saldos/caja/reportes de aquí en adelante sin desaparecer
-- del historial de pagos del paciente.

ALTER TABLE public.payments
  ADD COLUMN reversed_at timestamptz,
  ADD COLUMN reversed_by uuid,
  ADD COLUMN reversal_reason text,
  ADD CONSTRAINT payments_reversal_consistente CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR
    (reversed_at IS NOT NULL AND reversed_by IS NOT NULL AND reversal_reason IS NOT NULL)
  );

CREATE INDEX payments_reversed_idx ON public.payments (clinic_id) WHERE reversed_at IS NOT NULL;

COMMENT ON COLUMN public.payments.reversed_at IS
  'NULL = pago vigente. No-NULL = reversado; se excluye de saldos, caja y reportes pero la fila queda para auditoría.';
