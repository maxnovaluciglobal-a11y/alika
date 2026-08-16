-- Fase 4 (WhatsApp — comunidad): Parte 2 de 2.
-- Código de referido por paciente + link en whatsapp_leads + seed de las
-- 3 plantillas nuevas.

-- ---------------------------------------------------------------------------
-- 1) Código de referido: 6 caracteres, único POR CLÍNICA (no global). Se
--    genera solo con un trigger BEFORE INSERT — así cualquier camino de alta
--    (createPatient, importPatients CSV, reset_demo_clinic) lo recibe sin
--    tener que acordarse de generarlo en cada uno. Reintenta hasta 5 veces
--    si hay colisión (poco probable con 36^6 combinaciones por clínica, pero
--    no imposible en clínicas con miles de pacientes).
-- ---------------------------------------------------------------------------
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS referral_code text;

CREATE OR REPLACE FUNCTION public.generate_patient_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  candidate text;
  attempts int := 0;
BEGIN
  IF NEW.referral_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    candidate := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    attempts := attempts + 1;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.patients WHERE clinic_id = NEW.clinic_id AND referral_code = candidate
    ) OR attempts > 5;
  END LOOP;
  NEW.referral_code := candidate;
  RETURN NEW;
END; $$;

CREATE TRIGGER patients_generate_referral_code BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.generate_patient_referral_code();

-- Backfill de los pacientes que ya existen (el trigger solo corre en altas nuevas).
DO $$
DECLARE
  r RECORD;
  candidate text;
  attempts int;
BEGIN
  FOR r IN SELECT id, clinic_id FROM public.patients WHERE referral_code IS NULL LOOP
    attempts := 0;
    LOOP
      candidate := upper(substr(md5(random()::text || clock_timestamp()::text || r.id::text), 1, 6));
      attempts := attempts + 1;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.patients WHERE clinic_id = r.clinic_id AND referral_code = candidate
      ) OR attempts > 5;
    END LOOP;
    UPDATE public.patients SET referral_code = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- Único por clínica, no global (dos clínicas distintas pueden compartir código).
ALTER TABLE public.patients
  ADD CONSTRAINT patients_clinic_referral_code_key UNIQUE (clinic_id, referral_code);

-- ---------------------------------------------------------------------------
-- 2) whatsapp_leads: de qué paciente vino el referido, si el webhook lo
--    detectó en el primer mensaje (Fase 4 extiende el webhook de Fase 3).
-- ---------------------------------------------------------------------------
ALTER TABLE public.whatsapp_leads
  ADD COLUMN IF NOT EXISTS referred_by_patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3) handle_new_clinic(): agregar las 3 plantillas de Fase 4 a las 11 que ya
--    sembraba.
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
    (NEW.id, 'hygiene_recall', 'Recall de higiene (6 meses)', 'whatsapp',
     'Hola {paciente}, pasaron {meses} meses de tu última visita a {clinica}. ¿Te agendamos un control y limpieza? Respondé por acá y coordinamos. 🦷',
     NEW.created_by),
    (NEW.id, 'review_request', 'Pedido de reseña', 'whatsapp',
     'Hola {paciente}, ¡gracias por tu visita a {clinica}! Si te sentiste bien atendido/a, ¿nos dejás una reseña? Buscanos en Google como "{clinica}". ¡Nos ayuda un montón!',
     NEW.created_by),
    (NEW.id, 'payment_due', 'Aviso de saldo pendiente', 'whatsapp',
     'Hola {paciente}, te recordamos que tenés un saldo pendiente de {saldo} en {clinica}. Respondé por acá o pasá por la clínica para coordinar el pago. ¡Gracias!',
     NEW.created_by),
    (NEW.id, 'waitlist_opening', 'Aviso de lista de espera', 'whatsapp',
     'Hola {paciente}, se liberó un turno en {clinica} para {motivo}. Como estás en la lista de espera, te lo ofrecemos primero — respondé por acá si te sirve.',
     NEW.created_by),
    (NEW.id, 'quote_follow_up', 'Seguimiento de presupuesto', 'whatsapp',
     'Hola {paciente}, el presupuesto {numero_presupuesto} por {total} en {clinica} sigue disponible. ¿Lo retomamos? Contame cuando quieras coordinar.',
     NEW.created_by),
    (NEW.id, 'portal_invite', 'Invitación al portal', 'whatsapp',
     'Hola {paciente}, este es tu acceso al portal de {clinica}. Podés ver tus próximas citas y pedir hora acá: {link}. El link vence en {dias} días.',
     NEW.created_by),
    -- ---- Fase 4 ----
    (NEW.id, 'birthday_greeting', 'Saludo de cumpleaños', 'whatsapp',
     '¡Feliz cumpleaños, {paciente}! Todo el equipo de {clinica} te manda un saludo. Que la pases increíble. 🎉',
     NEW.created_by),
    (NEW.id, 'treatment_followup', 'Seguimiento post-tratamiento', 'whatsapp',
     'Hola {paciente}, ¿cómo te sentís después de tu visita a {clinica}? Cualquier duda o molestia nos escribís por acá, estamos para ayudarte.',
     NEW.created_by),
    (NEW.id, 'referral_invite', 'Invitación a referir', 'whatsapp',
     'Hola {paciente}, si conocés a alguien que necesite un dentista, compartile este mensaje con tu código {codigo} y le avisamos que llegó de tu parte. — {clinica}',
     NEW.created_by)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- ---------------------------------------------------------------------------
-- 4) Backfill: sembrar las 3 plantillas nuevas en las clínicas que ya existen.
-- ---------------------------------------------------------------------------
INSERT INTO public.message_templates (clinic_id, kind, name, channel, body, created_by)
SELECT c.id, v.kind::public.message_template_kind, v.name, 'whatsapp', v.body, c.created_by
FROM public.clinics c
CROSS JOIN (VALUES
  ('birthday_greeting', 'Saludo de cumpleaños',
   '¡Feliz cumpleaños, {paciente}! Todo el equipo de {clinica} te manda un saludo. Que la pases increíble. 🎉'),
  ('treatment_followup', 'Seguimiento post-tratamiento',
   'Hola {paciente}, ¿cómo te sentís después de tu visita a {clinica}? Cualquier duda o molestia nos escribís por acá, estamos para ayudarte.'),
  ('referral_invite', 'Invitación a referir',
   'Hola {paciente}, si conocés a alguien que necesite un dentista, compartile este mensaje con tu código {codigo} y le avisamos que llegó de tu parte. — {clinica}')
) AS v(kind, name, body)
ON CONFLICT DO NOTHING;
