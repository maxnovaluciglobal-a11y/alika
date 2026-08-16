-- Fase 2 (WhatsApp) · Parte 1 de 2: valores de enum.
--
-- Mismo motivo que la Fase 1: un valor agregado con `ALTER TYPE ... ADD
-- VALUE` no puede usarse en la misma transacción en que se creó, y la
-- parte 2 siembra plantillas que usan estos kinds.
--
-- Los 3 kinds de la Fase 2:
--   · waitlist_opening  -> avisar al primero de la lista de espera cuando se libera un turno
--   · quote_follow_up   -> seguimiento de presupuesto enviado sin respuesta (+7 días)
--   · portal_invite     -> invitación al portal de auto-agendamiento (hoy wa.me-only, sin historial)

ALTER TYPE public.message_template_kind ADD VALUE IF NOT EXISTS 'waitlist_opening';
ALTER TYPE public.message_template_kind ADD VALUE IF NOT EXISTS 'quote_follow_up';
ALTER TYPE public.message_template_kind ADD VALUE IF NOT EXISTS 'portal_invite';
