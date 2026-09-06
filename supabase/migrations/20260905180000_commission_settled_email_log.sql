-- Progresivo #4 (plan de remediación Carlos, 05-sep-2026): el aviso de
-- comisión liquidada (notifyCommissionSettled en commissions.functions.ts)
-- es el único envío saliente de toda la app sin ningún rastro de si se
-- mandó o falló — no puede vivir en `messages` porque esa tabla exige
-- patient_id y el destinatario acá es un profesional, no un paciente.
--
-- En vez de una tabla nueva: cada aviso es 1:1 con la fila de
-- commission_settlements que ya existe para ese (clinic_id,
-- professional_id, period_from, period_to) — es el "log equivalente" más
-- simple posible, sin RLS ni tabla nueva que mantener.

ALTER TABLE public.commission_settlements
  ADD COLUMN email_notified_at timestamptz,
  ADD COLUMN email_error text;

COMMENT ON COLUMN public.commission_settlements.email_notified_at IS
  'Cuándo se confirmó el envío del aviso de comisión liquidada al profesional. NULL si nunca se intentó o si falló (ver email_error).';
COMMENT ON COLUMN public.commission_settlements.email_error IS
  'Motivo del último intento fallido de aviso (o "sin email cargado" si el profesional no tiene email). NULL si se envió con éxito.';
