-- Fase 1 (WhatsApp API) · Parte 1 de 2: valores de enum.
--
-- Se separan de la parte 2 a propósito: en Postgres, un valor agregado con
-- `ALTER TYPE ... ADD VALUE` NO puede usarse dentro de la misma transacción
-- en que se creó. La parte 2 siembra plantillas que usan estos kinds nuevos
-- (backfill que se ejecuta en tiempo de migración), así que los kinds tienen
-- que existir y estar committeados antes. Por eso van en un archivo aparte,
-- igual que se hizo con `appointment_checkin` en la cola de recordatorios.
--
-- Los 4 mensajes de la Fase 1:
--   · confirmar/reprogramar -> appointment_reminder + appointment_checkin (YA existen)
--   · recall de higiene     -> hygiene_recall   (nuevo)
--   · reseña de Google      -> review_request   (nuevo)
--   · saldo pendiente       -> payment_due      (nuevo)

ALTER TYPE public.message_template_kind ADD VALUE IF NOT EXISTS 'hygiene_recall';
ALTER TYPE public.message_template_kind ADD VALUE IF NOT EXISTS 'review_request';
ALTER TYPE public.message_template_kind ADD VALUE IF NOT EXISTS 'payment_due';
