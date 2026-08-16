-- Fase 1 (WhatsApp API) · Parte 2 de 2: tabla WABA, mapeo Meta, consent,
-- y sembrado/backfill de las plantillas nuevas.
--
-- Contexto: la Fase 4A dejó `messages` y `message_templates` orientadas al
-- envío manual por link wa.me. Esta migración prepara el envío automático por
-- Cloud API. La tabla `messages` NO se toca: ya trae external_id / delivered_at
-- / read_at / error desde 4A. Solo hace falta lo que sigue.

-- ---------------------------------------------------------------------------
-- 1) whatsapp_accounts: un WABA (número) por clínica.
--    NO se guarda ningún access token acá. El envío usa el System User token
--    a nivel de app (variable de entorno en Vercel), que como Tech Provider
--    puede mandar desde cualquier phone_number_id de los WABA compartidos con
--    la app. Menos superficie de riesgo: la DB nunca ve un secreto de Meta.
-- ---------------------------------------------------------------------------
CREATE TABLE public.whatsapp_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         uuid NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  waba_id           text NOT NULL,
  phone_number_id   text NOT NULL UNIQUE,
  display_phone     text,                              -- +56 9 ... para mostrar en UI
  status            text NOT NULL DEFAULT 'connected', -- connected | disabled | flagged
  quality_rating    text,                              -- GREEN | YELLOW | RED (reportado por Meta)
  connected_by      uuid NOT NULL DEFAULT auth.uid(),
  connected_at      timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- El webhook resuelve "a qué clínica pertenece este mensaje" por phone_number_id.
CREATE INDEX whatsapp_accounts_phone_number_idx ON public.whatsapp_accounts (phone_number_id);

CREATE TRIGGER whatsapp_accounts_updated_at BEFORE UPDATE ON public.whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_accounts TO authenticated;
GRANT ALL ON public.whatsapp_accounts TO service_role;
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;

-- Cualquier miembro puede VER el estado de conexión del número.
CREATE POLICY "wa_accounts_select_members" ON public.whatsapp_accounts
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
-- Solo owner/admin conectan o desconectan el número.
CREATE POLICY "wa_accounts_write_owners" ON public.whatsapp_accounts
  FOR ALL TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin']::public.app_role[]));

-- ---------------------------------------------------------------------------
-- 2) Mapeo a plantillas Meta sobre la tabla message_templates que ya existe.
--    Fuera de la ventana de servicio de 24h, la Cloud API exige una plantilla
--    pre-aprobada por Meta (con parámetros {{1}} {{2}}). Estas columnas guardan
--    ese vínculo; el mapeo variable->{{n}} vive en el código de envío.
-- ---------------------------------------------------------------------------
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS meta_template_name text,                  -- ej: appt_reminder_48h
  ADD COLUMN IF NOT EXISTS meta_language      text NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS meta_status        text NOT NULL DEFAULT 'not_registered', -- not_registered|pending|approved|rejected
  ADD COLUMN IF NOT EXISTS meta_category      text NOT NULL DEFAULT 'utility';

-- ---------------------------------------------------------------------------
-- 3) Consentimiento por paciente. Columnas simples sobre patients (no una
--    tabla aparte): el gate del envío proactivo solo necesita saber si hay
--    opt-in vigente. El webhook setea wa_opt_out_at al recibir "BAJA"/"STOP".
-- ---------------------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS wa_opt_in     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_opt_in_at  timestamptz,
  ADD COLUMN IF NOT EXISTS wa_opt_out_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4) handle_new_clinic(): sembrar también las 3 plantillas nuevas en cada
--    clínica nueva. Se reemplaza la función completa preservando lo que ya
--    hacía (owner + las 5 plantillas de 4A/cola) y se agregan las 3 nuevas.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_clinic()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.message_templates (clinic_id, kind, name, channel, body, created_by)
  VALUES
    (NEW.id, 'appointment_reminder', 'Recordatorio 48h antes', 'whatsapp',
     'Hola {paciente}, te recordamos tu cita de {tratamiento} el {fecha_larga} a las {hora}. Para confirmar respondé SÍ, o RE para reagendar. Nos vemos en {clinica}. 🦷',
     NEW.created_by),
    (NEW.id, 'appointment_checkin', 'Aviso 3h antes', 'whatsapp',
     'Hola {paciente}, en unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos! Si no podés venir, avisanos por acá.',
     NEW.created_by),
    (NEW.id, 'appointment_confirmation', 'Confirmación de cita nueva', 'whatsapp',
     'Hola {paciente}, tu cita quedó agendada: {tratamiento} el {fecha_larga} a las {hora} con {profesional}. Cualquier cambio nos avisás por acá. — {clinica}',
     NEW.created_by),
    (NEW.id, 'quote_sent', 'Envío de presupuesto', 'whatsapp',
     'Hola {paciente}, te comparto el presupuesto {numero_presupuesto} por {total}. Cualquier duda me decís y coordinamos cuando quieras arrancar. — {clinica}',
     NEW.created_by),
    (NEW.id, 'payment_receipt', 'Recibo de pago', 'whatsapp',
     'Hola {paciente}, recibimos tu pago de {monto} el {fecha}. Saldo pendiente: {saldo}. ¡Gracias! — {clinica}',
     NEW.created_by),
    -- ---- Fase 1: plantillas nuevas ----
    (NEW.id, 'hygiene_recall', 'Recall de higiene (6 meses)', 'whatsapp',
     'Hola {paciente}, pasaron {meses} meses de tu última visita a {clinica}. ¿Te agendamos un control y limpieza? Respondé por acá y coordinamos. 🦷',
     NEW.created_by),
    (NEW.id, 'review_request', 'Pedido de reseña', 'whatsapp',
     'Hola {paciente}, ¡gracias por tu visita a {clinica}! Si te sentiste bien atendido/a, ¿nos dejás una reseña? Nos ayuda un montón: {link_resena}',
     NEW.created_by),
    (NEW.id, 'payment_due', 'Aviso de saldo pendiente', 'whatsapp',
     'Hola {paciente}, te recordamos que tenés un saldo pendiente de {saldo} en {clinica}. Podés abonarlo cuando quieras acá: {link_pago}. ¡Gracias!',
     NEW.created_by)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- ---------------------------------------------------------------------------
-- 5) Backfill: sembrar las 3 plantillas nuevas en las clínicas que YA existen
--    (mismo criterio que el backfill de appointment_checkin). ON CONFLICT
--    DO NOTHING contra UNIQUE(clinic_id, kind, name).
-- ---------------------------------------------------------------------------
INSERT INTO public.message_templates (clinic_id, kind, name, channel, body, created_by)
SELECT c.id, v.kind::public.message_template_kind, v.name, 'whatsapp', v.body, c.created_by
FROM public.clinics c
CROSS JOIN (VALUES
  ('hygiene_recall', 'Recall de higiene (6 meses)',
   'Hola {paciente}, pasaron {meses} meses de tu última visita a {clinica}. ¿Te agendamos un control y limpieza? Respondé por acá y coordinamos. 🦷'),
  ('review_request', 'Pedido de reseña',
   'Hola {paciente}, ¡gracias por tu visita a {clinica}! Si te sentiste bien atendido/a, ¿nos dejás una reseña? Nos ayuda un montón: {link_resena}'),
  ('payment_due', 'Aviso de saldo pendiente',
   'Hola {paciente}, te recordamos que tenés un saldo pendiente de {saldo} en {clinica}. Podés abonarlo cuando quieras acá: {link_pago}. ¡Gracias!')
) AS v(kind, name, body)
ON CONFLICT DO NOTHING;
