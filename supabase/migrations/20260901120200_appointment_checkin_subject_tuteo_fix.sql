-- Auditoría de código 01-sep-2026 (dimensión calidad/deuda técnica) — ejemplo
-- más nítido de "una sesión arregla, otra sesión lo pisa sin darse cuenta,
-- el mismo día": la migración 20260827000000 corrigió TODO el copy de
-- voseo→tuteo (comentario propio: "usa voseo rioplatense en TODAS las
-- clínicas, incluidas México/Colombia/Perú"). Una hora después,
-- 20260827060100 volvió a copiar el bloque completo de handle_new_clinic()
-- para agregar el template de commission_settled, y en esa copia el subject
-- de 'appointment_checkin' (channel=email) quedó con el texto viejo en
-- voseo ("En unas horas tenés tu cita...") — el body sí tiene la
-- corrección. Verificado contra la DB real: las 6 clínicas existentes,
-- incluida la piloto, tienen ese subject en voseo hoy.
--
-- Redefine handle_new_clinic() copiando exactamente 20260827060100 (para no
-- perder el template de commission_settled) con esa única línea corregida,
-- + backfill de las clínicas ya existentes.

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
    -- ÚNICA LÍNEA CORREGIDA vs. 20260827060100: subject en tuteo, igual que el body.
    (NEW.id, 'appointment_checkin', 'Aviso 3h antes (email)', 'email',
     'En unas horas es tu cita en {clinica}',
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
    (NEW.id, 'commission_settled', 'Comisión liquidada (email)', 'email',
     'Tu comisión de {periodo} quedó liquidada',
     '<p>Hola {profesional},</p><p>Se cerró tu liquidación de comisiones del período <strong>{periodo}</strong>.</p><p>Monto liquidado: <strong>{monto}</strong>.</p><p>Cualquier duda sobre el cálculo, escríbenos.</p><p>— {clinica}</p>',
     NEW.created_by)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- Backfill idempotente: solo toca filas que todavía tienen el texto viejo
-- exacto, para no pisar un subject que alguna clínica ya haya personalizado.
UPDATE public.message_templates
SET subject = 'En unas horas es tu cita en {clinica}'
WHERE kind = 'appointment_checkin'
  AND channel = 'email'
  AND subject = 'En unas horas tenés tu cita en {clinica}';
