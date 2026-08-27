-- Auditoría 360 v2 (26-ago-2026), área Comunicaciones — F1 + F3 + F4.
--
-- F1: el botón "Email" del aviso de 3h en /recordatorios siempre fallaba
-- porque nunca se sembró el template email de appointment_checkin.
-- F3: quote_sent y payment_receipt eran WhatsApp-only, sin fallback a email.
-- F4: el copy sembrado por handle_new_clinic() usa voseo rioplatense
-- ("respondé", "avisanos", "podés") en TODAS las clínicas, incluidas las de
-- México/Colombia/Perú (target explícito de CLAUDE.md) — se neutraliza acá
-- el copy completo, no solo los templates nuevos.
--
-- Nota: F1 y F3 ya se aplicaron como dato en vivo (script puntual con
-- service_role) el 2026-08-26 para las clínicas existentes en ese momento —
-- esta migración deja lo mismo versionado en el historial, lo aplica a
-- handle_new_clinic() para clínicas NUEVAS, y agrega el fix F4 de copy que
-- el script puntual no incluía.

CREATE OR REPLACE FUNCTION public.handle_new_clinic()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
  VALUES
    (NEW.id, 'appointment_reminder', 'Recordatorio 48h antes', 'whatsapp', NULL,
     'Hola {paciente}, te recordamos tu cita de {tratamiento} el {fecha_larga} a las {hora}. Para confirmar responde SÍ, o RE para reagendar. Nos vemos en {clinica}. 🦷',
     NEW.created_by),
    (NEW.id, 'appointment_checkin', 'Aviso 3h antes', 'whatsapp', NULL,
     'Hola {paciente}, en unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos! Si no puedes venir, avísanos por acá.',
     NEW.created_by),
    (NEW.id, 'appointment_confirmation', 'Confirmación de cita nueva', 'whatsapp', NULL,
     'Hola {paciente}, tu cita quedó agendada: {tratamiento} el {fecha_larga} a las {hora} con {profesional}. Cualquier cambio, avísanos por acá. — {clinica}',
     NEW.created_by),
    (NEW.id, 'quote_sent', 'Envío de presupuesto', 'whatsapp', NULL,
     'Hola {paciente}, te compartimos el presupuesto {numero_presupuesto} por {total}. Cualquier duda, dinos y coordinamos cuando quieras arrancar. — {clinica}',
     NEW.created_by),
    (NEW.id, 'payment_receipt', 'Recibo de pago', 'whatsapp', NULL,
     'Hola {paciente}, recibimos tu pago de {monto} el {fecha}. Saldo pendiente: {saldo}. ¡Gracias! — {clinica}',
     NEW.created_by),
    (NEW.id, 'appointment_confirmation', 'Confirmación de cita (email)', 'email',
     'Tu cita en {clinica} quedó confirmada',
     '<p>Hola {paciente},</p><p>Tu cita quedó agendada:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li><li><strong>Profesional:</strong> {profesional}</li></ul><p>Cualquier cambio, responde este correo o escríbenos por WhatsApp.</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'appointment_reminder', 'Recordatorio de cita (email)', 'email',
     'Recordatorio: tu cita en {clinica} es el {fecha_larga}',
     '<p>Hola {paciente},</p><p>Te recordamos tu cita:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li></ul><p>Si necesitas reagendar, escríbenos por WhatsApp o responde este correo.</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'nps_survey', 'Encuesta de satisfacción', 'whatsapp', NULL,
     'Hola {paciente}, ¿cómo fue tu experiencia con {tratamiento} en {clinica}? Responde con una nota del 1 al 10 (10 = excelente) y cuéntanos qué mejorarías. ¡Gracias por ayudarnos a mejorar! 🙏',
     NEW.created_by),
    (NEW.id, 'nps_survey', 'Encuesta de satisfacción (email)', 'email',
     '¿Cómo fue tu experiencia en {clinica}?',
     '<p>Hola {paciente},</p><p>Queremos saber cómo fue tu experiencia con <strong>{tratamiento}</strong> en {clinica}.</p><p>Responde este correo con una nota del <strong>1 al 10</strong> (10 = excelente) y, si quieres, cuéntanos qué mejorarías.</p><p>¡Gracias por ayudarnos a mejorar!</p><p>— {clinica}</p>',
     NEW.created_by),
    -- F1: template de email para appointment_checkin, nunca sembrado hasta ahora.
    (NEW.id, 'appointment_checkin', 'Aviso 3h antes (email)', 'email',
     'En unas horas tenés tu cita en {clinica}',
     '<p>Hola {paciente},</p><p>En unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos!</p><p>Si no puedes venir, escríbenos por WhatsApp o responde este correo.</p><p>— {clinica}</p>',
     NEW.created_by),
    -- F3: fallback de email para presupuesto y recibo de pago (antes WhatsApp-only).
    (NEW.id, 'quote_sent', 'Envío de presupuesto (email)', 'email',
     'Tu presupuesto de {clinica}',
     '<p>Hola {paciente},</p><p>Te compartimos el presupuesto <strong>{numero_presupuesto}</strong> por <strong>{total}</strong>.</p><p>Cualquier duda, responde este correo o escríbenos por WhatsApp y coordinamos cuando quieras arrancar.</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'payment_receipt', 'Recibo de pago (email)', 'email',
     'Recibimos tu pago — {clinica}',
     '<p>Hola {paciente},</p><p>Recibimos tu pago de <strong>{monto}</strong> el {fecha}.</p><p>Saldo pendiente: {saldo}.</p><p>¡Gracias!</p><p>— {clinica}</p>',
     NEW.created_by)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- F1/F3 backfill para clínicas ya existentes — idempotente, ya aplicado en
-- vivo el 2026-08-26 vía script puntual con service_role; queda acá versionado.
INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
SELECT c.id, 'appointment_checkin', 'Aviso 3h antes (email)', 'email',
       'En unas horas tenés tu cita en {clinica}',
       '<p>Hola {paciente},</p><p>En unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos!</p><p>Si no puedes venir, escríbenos por WhatsApp o responde este correo.</p><p>— {clinica}</p>',
       c.created_by
FROM public.clinics c
ON CONFLICT DO NOTHING;

INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
SELECT c.id, 'quote_sent', 'Envío de presupuesto (email)', 'email',
       'Tu presupuesto de {clinica}',
       '<p>Hola {paciente},</p><p>Te compartimos el presupuesto <strong>{numero_presupuesto}</strong> por <strong>{total}</strong>.</p><p>Cualquier duda, responde este correo o escríbenos por WhatsApp y coordinamos cuando quieras arrancar.</p><p>— {clinica}</p>',
       c.created_by
FROM public.clinics c
ON CONFLICT DO NOTHING;

INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
SELECT c.id, 'payment_receipt', 'Recibo de pago (email)', 'email',
       'Recibimos tu pago — {clinica}',
       '<p>Hola {paciente},</p><p>Recibimos tu pago de <strong>{monto}</strong> el {fecha}.</p><p>Saldo pendiente: {saldo}.</p><p>¡Gracias!</p><p>— {clinica}</p>',
       c.created_by
FROM public.clinics c
ON CONFLICT DO NOTHING;

-- F4: neutralizar el copy voseante ya sembrado en clínicas existentes
-- (match exacto de body para no tocar nada editado a mano por una clínica).
UPDATE public.message_templates SET body =
  'Hola {paciente}, te recordamos tu cita de {tratamiento} el {fecha_larga} a las {hora}. Para confirmar responde SÍ, o RE para reagendar. Nos vemos en {clinica}. 🦷'
WHERE kind = 'appointment_reminder' AND channel = 'whatsapp' AND body =
  'Hola {paciente}, te recordamos tu cita de {tratamiento} el {fecha_larga} a las {hora}. Para confirmar respondé SÍ, o RE para reagendar. Nos vemos en {clinica}. 🦷';

UPDATE public.message_templates SET body =
  'Hola {paciente}, en unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos! Si no puedes venir, avísanos por acá.'
WHERE kind = 'appointment_checkin' AND channel = 'whatsapp' AND body =
  'Hola {paciente}, en unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos! Si no podés venir, avisanos por acá.';

UPDATE public.message_templates SET body =
  'Hola {paciente}, tu cita quedó agendada: {tratamiento} el {fecha_larga} a las {hora} con {profesional}. Cualquier cambio, avísanos por acá. — {clinica}'
WHERE kind = 'appointment_confirmation' AND channel = 'whatsapp' AND body =
  'Hola {paciente}, tu cita quedó agendada: {tratamiento} el {fecha_larga} a las {hora} con {profesional}. Cualquier cambio nos avisás por acá. — {clinica}';

UPDATE public.message_templates SET body =
  'Hola {paciente}, te compartimos el presupuesto {numero_presupuesto} por {total}. Cualquier duda, dinos y coordinamos cuando quieras arrancar. — {clinica}'
WHERE kind = 'quote_sent' AND channel = 'whatsapp' AND body =
  'Hola {paciente}, te comparto el presupuesto {numero_presupuesto} por {total}. Cualquier duda me decís y coordinamos cuando quieras arrancar. — {clinica}';

UPDATE public.message_templates SET body =
  '<p>Hola {paciente},</p><p>Tu cita quedó agendada:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li><li><strong>Profesional:</strong> {profesional}</li></ul><p>Cualquier cambio, responde este correo o escríbenos por WhatsApp.</p><p>— {clinica}</p>'
WHERE kind = 'appointment_confirmation' AND channel = 'email' AND body =
  '<p>Hola {paciente},</p><p>Tu cita quedó agendada:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li><li><strong>Profesional:</strong> {profesional}</li></ul><p>Cualquier cambio, respondé este correo o escribinos por WhatsApp.</p><p>— {clinica}</p>';

UPDATE public.message_templates SET body =
  '<p>Hola {paciente},</p><p>Te recordamos tu cita:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li></ul><p>Si necesitas reagendar, escríbenos por WhatsApp o responde este correo.</p><p>— {clinica}</p>'
WHERE kind = 'appointment_reminder' AND channel = 'email' AND body =
  '<p>Hola {paciente},</p><p>Te recordamos tu cita:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li></ul><p>Si necesitás reagendar, escribinos por WhatsApp o respondé este correo.</p><p>— {clinica}</p>';

UPDATE public.message_templates SET body =
  'Hola {paciente}, ¿cómo fue tu experiencia con {tratamiento} en {clinica}? Responde con una nota del 1 al 10 (10 = excelente) y cuéntanos qué mejorarías. ¡Gracias por ayudarnos a mejorar! 🙏'
WHERE kind = 'nps_survey' AND channel = 'whatsapp' AND body =
  'Hola {paciente}, ¿cómo fue tu experiencia con {tratamiento} en {clinica}? Respondé con una nota del 1 al 10 (10 = excelente) y contanos qué mejorarías. ¡Gracias por ayudarnos a mejorar! 🙏';

UPDATE public.message_templates SET body =
  '<p>Hola {paciente},</p><p>Queremos saber cómo fue tu experiencia con <strong>{tratamiento}</strong> en {clinica}.</p><p>Responde este correo con una nota del <strong>1 al 10</strong> (10 = excelente) y, si quieres, cuéntanos qué mejorarías.</p><p>¡Gracias por ayudarnos a mejorar!</p><p>— {clinica}</p>'
WHERE kind = 'nps_survey' AND channel = 'email' AND body =
  '<p>Hola {paciente},</p><p>Queremos saber cómo fue tu experiencia con <strong>{tratamiento}</strong> en {clinica}.</p><p>Respondé este correo con una nota del <strong>1 al 10</strong> (10 = excelente) y, si querés, contanos qué mejorarías.</p><p>¡Gracias por ayudarnos a mejorar!</p><p>— {clinica}</p>';

-- F4: los 3 templates de email sembrados en vivo el 2026-08-26 (F1/F3) también
-- tenían voseo en el copy original del script puntual — corregidos acá.
UPDATE public.message_templates SET body =
  '<p>Hola {paciente},</p><p>En unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos!</p><p>Si no puedes venir, escríbenos por WhatsApp o responde este correo.</p><p>— {clinica}</p>'
WHERE kind = 'appointment_checkin' AND channel = 'email' AND name = 'Aviso 3h antes (email)' AND body =
  '<p>Hola {paciente},</p><p>En unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos!</p><p>Si no podés venir, escribinos por WhatsApp o respondé este correo.</p><p>— {clinica}</p>';

UPDATE public.message_templates SET body =
  '<p>Hola {paciente},</p><p>Te compartimos el presupuesto <strong>{numero_presupuesto}</strong> por <strong>{total}</strong>.</p><p>Cualquier duda, responde este correo o escríbenos por WhatsApp y coordinamos cuando quieras arrancar.</p><p>— {clinica}</p>'
WHERE kind = 'quote_sent' AND channel = 'email' AND name = 'Envío de presupuesto (email)' AND body =
  '<p>Hola {paciente},</p><p>Te compartimos el presupuesto <strong>{numero_presupuesto}</strong> por <strong>{total}</strong>.</p><p>Cualquier duda, respondé este correo o escribinos por WhatsApp y coordinamos cuando quieras arrancar.</p><p>— {clinica}</p>';
