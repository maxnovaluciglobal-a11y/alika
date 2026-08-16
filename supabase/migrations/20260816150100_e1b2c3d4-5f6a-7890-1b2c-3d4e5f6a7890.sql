-- Fase 2 (WhatsApp) · Parte 2 de 2: seed + backfill de las 3 plantillas
-- nuevas, y cierre del helper de envío real para el link del portal.

-- ---------------------------------------------------------------------------
-- 1) handle_new_clinic(): agregar las 3 plantillas de Fase 2 a las 8 que ya
--    sembraba (Fase 4A + cola de recordatorios + Fase 1 WhatsApp API).
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
    -- ---- Fase 2 ----
    (NEW.id, 'waitlist_opening', 'Aviso de lista de espera', 'whatsapp',
     'Hola {paciente}, se liberó un turno en {clinica} para {motivo}. Como estás en la lista de espera, te lo ofrecemos primero — respondé por acá si te sirve.',
     NEW.created_by),
    (NEW.id, 'quote_follow_up', 'Seguimiento de presupuesto', 'whatsapp',
     'Hola {paciente}, el presupuesto {numero_presupuesto} por {total} en {clinica} sigue disponible. ¿Lo retomamos? Contame cuando quieras coordinar.',
     NEW.created_by),
    (NEW.id, 'portal_invite', 'Invitación al portal', 'whatsapp',
     'Hola {paciente}, este es tu acceso al portal de {clinica}. Podés ver tus próximas citas y pedir hora acá: {link}. El link vence en {dias} días.',
     NEW.created_by)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- ---------------------------------------------------------------------------
-- 2) Backfill: sembrar las 3 plantillas nuevas en las clínicas que ya existen.
-- ---------------------------------------------------------------------------
INSERT INTO public.message_templates (clinic_id, kind, name, channel, body, created_by)
SELECT c.id, v.kind::public.message_template_kind, v.name, 'whatsapp', v.body, c.created_by
FROM public.clinics c
CROSS JOIN (VALUES
  ('waitlist_opening', 'Aviso de lista de espera',
   'Hola {paciente}, se liberó un turno en {clinica} para {motivo}. Como estás en la lista de espera, te lo ofrecemos primero — respondé por acá si te sirve.'),
  ('quote_follow_up', 'Seguimiento de presupuesto',
   'Hola {paciente}, el presupuesto {numero_presupuesto} por {total} en {clinica} sigue disponible. ¿Lo retomamos? Contame cuando quieras coordinar.'),
  ('portal_invite', 'Invitación al portal',
   'Hola {paciente}, este es tu acceso al portal de {clinica}. Podés ver tus próximas citas y pedir hora acá: {link}. El link vence en {dias} días.')
) AS v(kind, name, body)
ON CONFLICT DO NOTHING;
