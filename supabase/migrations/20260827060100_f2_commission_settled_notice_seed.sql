-- Auditoría 360 v2 (26-ago-2026), área Comunicaciones — F2, parte 2 de 2.
--
-- Siembra el template `commission_settled` (channel=email) usado por
-- `closeCommissionPeriod` (commissions.functions.ts) para avisar al
-- profesional cuando se cierra su liquidación. Variables: {profesional}
-- (nombre del profesional, no {paciente} — el destinatario acá nunca es un
-- paciente), {periodo} (rango de fechas legible) y {monto} (comisión
-- formateada con formatMoney, respetando la moneda de la clínica).
--
-- Solo email por ahora: `closeCommissionPeriod` manda con `sendEmail`
-- directo (no pasa por `sendWhatsAppFromTemplate`/`sendEmailFromTemplate` de
-- messaging.functions.ts, que exigen patientId) y solo a profesionales con
-- `professionals.email` cargado. Si se agrega WhatsApp a profesionales más
-- adelante, sumar acá un segundo template channel=whatsapp del mismo kind.
--
-- Mismo patrón que 20260827000000 (F1/F3/F4) y 20260826260000 (nps_survey):
-- redefine handle_new_clinic() con el set completo + el template nuevo, y
-- hace backfill para las clínicas ya existentes.

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
    (NEW.id, 'appointment_checkin', 'Aviso 3h antes (email)', 'email',
     'En unas horas tenés tu cita en {clinica}',
     '<p>Hola {paciente},</p><p>En unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos!</p><p>Si no puedes venir, escríbenos por WhatsApp o responde este correo.</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'quote_sent', 'Envío de presupuesto (email)', 'email',
     'Tu presupuesto de {clinica}',
     '<p>Hola {paciente},</p><p>Te compartimos el presupuesto <strong>{numero_presupuesto}</strong> por <strong>{total}</strong>.</p><p>Cualquier duda, responde este correo o escríbenos por WhatsApp y coordinamos cuando quieras arrancar.</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'payment_receipt', 'Recibo de pago (email)', 'email',
     'Recibimos tu pago — {clinica}',
     '<p>Hola {paciente},</p><p>Recibimos tu pago de <strong>{monto}</strong> el {fecha}.</p><p>Saldo pendiente: {saldo}.</p><p>¡Gracias!</p><p>— {clinica}</p>',
     NEW.created_by),
    -- F2 (comisiones liquidadas): aviso al profesional cuando se cierra su
    -- período. Destinatario = professionals, no patients — {profesional} en
    -- vez de {paciente}.
    (NEW.id, 'commission_settled', 'Comisión liquidada (email)', 'email',
     'Tu comisión de {periodo} quedó liquidada',
     '<p>Hola {profesional},</p><p>Se cerró tu liquidación de comisiones del período <strong>{periodo}</strong>.</p><p>Monto liquidado: <strong>{monto}</strong>.</p><p>Cualquier duda sobre el cálculo, escríbenos.</p><p>— {clinica}</p>',
     NEW.created_by)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- Backfill para clínicas ya existentes — idempotente.
INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
SELECT c.id, 'commission_settled', 'Comisión liquidada (email)', 'email',
       'Tu comisión de {periodo} quedó liquidada',
       '<p>Hola {profesional},</p><p>Se cerró tu liquidación de comisiones del período <strong>{periodo}</strong>.</p><p>Monto liquidado: <strong>{monto}</strong>.</p><p>Cualquier duda sobre el cálculo, escríbenos.</p><p>— {clinica}</p>',
       c.created_by
FROM public.clinics c
ON CONFLICT DO NOTHING;
