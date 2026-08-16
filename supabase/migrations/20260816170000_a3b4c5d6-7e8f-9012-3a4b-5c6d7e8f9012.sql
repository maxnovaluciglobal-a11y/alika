-- Fase 4 (WhatsApp — comunidad): Parte 1 de 2, valores de enum.
-- Mismo motivo que Fases 1-2: ALTER TYPE ... ADD VALUE no puede usarse en
-- la misma transacción en que se creó.
--
-- Los 3 kinds de la Fase 4:
--   · birthday_greeting  -> gesto de cumpleaños (marketing, cooldown anual)
--   · treatment_followup -> seguimiento genérico +2 días de un tratamiento
--                           completado (utility — transaccional a una visita
--                           real, NO instrucciones clínicas específicas por
--                           tipo de procedimiento: eso lo debería redactar
--                           un dentista, no fabricarlo acá)
--   · referral_invite    -> invitación a referir amigos (marketing, cooldown)

ALTER TYPE public.message_template_kind ADD VALUE IF NOT EXISTS 'birthday_greeting';
ALTER TYPE public.message_template_kind ADD VALUE IF NOT EXISTS 'treatment_followup';
ALTER TYPE public.message_template_kind ADD VALUE IF NOT EXISTS 'referral_invite';
