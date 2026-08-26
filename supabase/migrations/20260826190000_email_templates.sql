-- Emails automáticos a pacientes (Tier 1-D del plan competitivo vs.
-- Dentidesk). Hasta ahora existía la infraestructura de autenticación de
-- dominio (SPF/DKIM/DMARC) y el modo sandbox, pero ninguna función de envío
-- real — el canal completo estaba sin usar. Se sigue el mismo patrón ya
-- probado de WhatsApp: mensajes en `messages` (channel ya soporta 'email'
-- desde el enum original), templates en `message_templates` sembrados por
-- `handle_new_clinic()` + backfill acá para las clínicas ya existentes.

ALTER TABLE public.message_templates ADD COLUMN subject text;

CREATE OR REPLACE FUNCTION public.handle_new_clinic()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
  VALUES
    (NEW.id, 'appointment_reminder', 'Recordatorio 48h antes', 'whatsapp', NULL,
     'Hola {paciente}, te recordamos tu cita de {tratamiento} el {fecha_larga} a las {hora}. Para confirmar respondé SÍ, o RE para reagendar. Nos vemos en {clinica}. 🦷',
     NEW.created_by),
    (NEW.id, 'appointment_checkin', 'Aviso 3h antes', 'whatsapp', NULL,
     'Hola {paciente}, en unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos! Si no podés venir, avisanos por acá.',
     NEW.created_by),
    (NEW.id, 'appointment_confirmation', 'Confirmación de cita nueva', 'whatsapp', NULL,
     'Hola {paciente}, tu cita quedó agendada: {tratamiento} el {fecha_larga} a las {hora} con {profesional}. Cualquier cambio nos avisás por acá. — {clinica}',
     NEW.created_by),
    (NEW.id, 'quote_sent', 'Envío de presupuesto', 'whatsapp', NULL,
     'Hola {paciente}, te comparto el presupuesto {numero_presupuesto} por {total}. Cualquier duda me decís y coordinamos cuando quieras arrancar. — {clinica}',
     NEW.created_by),
    (NEW.id, 'payment_receipt', 'Recibo de pago', 'whatsapp', NULL,
     'Hola {paciente}, recibimos tu pago de {monto} el {fecha}. Saldo pendiente: {saldo}. ¡Gracias! — {clinica}',
     NEW.created_by),
    (NEW.id, 'appointment_confirmation', 'Confirmación de cita (email)', 'email',
     'Tu cita en {clinica} quedó confirmada',
     '<p>Hola {paciente},</p><p>Tu cita quedó agendada:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li><li><strong>Profesional:</strong> {profesional}</li></ul><p>Cualquier cambio, respondé este correo o escribinos por WhatsApp.</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'appointment_reminder', 'Recordatorio de cita (email)', 'email',
     'Recordatorio: tu cita en {clinica} es el {fecha_larga}',
     '<p>Hola {paciente},</p><p>Te recordamos tu cita:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li></ul><p>Si necesitás reagendar, escribinos por WhatsApp o respondé este correo.</p><p>— {clinica}</p>',
     NEW.created_by)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- Backfill para clínicas ya existentes (mismo criterio que la migración de
-- appointment_checkin: sembrar lo nuevo sin duplicar lo que ya está).
INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
SELECT c.id, 'appointment_confirmation', 'Confirmación de cita (email)', 'email',
       'Tu cita en {clinica} quedó confirmada',
       '<p>Hola {paciente},</p><p>Tu cita quedó agendada:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li><li><strong>Profesional:</strong> {profesional}</li></ul><p>Cualquier cambio, respondé este correo o escribinos por WhatsApp.</p><p>— {clinica}</p>',
       c.created_by
FROM public.clinics c
ON CONFLICT DO NOTHING;

INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
SELECT c.id, 'appointment_reminder', 'Recordatorio de cita (email)', 'email',
       'Recordatorio: tu cita en {clinica} es el {fecha_larga}',
       '<p>Hola {paciente},</p><p>Te recordamos tu cita:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li></ul><p>Si necesitás reagendar, escribinos por WhatsApp o respondé este correo.</p><p>— {clinica}</p>',
       c.created_by
FROM public.clinics c
ON CONFLICT DO NOTHING;
