-- Fase 1 (WhatsApp API) · Corrección: las plantillas review_request y
-- payment_due sembradas en 20260816120100 usaban {link_resena} / {link_pago}.
-- No existe infraestructura para ninguno de los dos todavía (no hay columna
-- para el link de Google Reviews de la clínica, y el billing de Stripe es
-- solo un skeleton — no genera links de cobro a pacientes). Mandar un
-- mensaje real con un placeholder sin reemplazar es peor que no tener la
-- feature, así que se corrige el texto para no prometer un link que no
-- existe (regla del repo: placeholders nullable en vez de fabricar datos).
--
-- Regla del CLAUDE.md: una migración aplicada no se "rehace", se corrige
-- con una migración nueva. Por eso esto va en un archivo aparte, no editando
-- 20260816120100.

UPDATE public.message_templates
SET body = 'Hola {paciente}, ¡gracias por tu visita a {clinica}! Si te sentiste bien atendido/a, ¿nos dejás una reseña? Buscanos en Google como "{clinica}". ¡Nos ayuda un montón!'
WHERE kind = 'review_request'
  AND body = 'Hola {paciente}, ¡gracias por tu visita a {clinica}! Si te sentiste bien atendido/a, ¿nos dejás una reseña? Nos ayuda un montón: {link_resena}';

UPDATE public.message_templates
SET body = 'Hola {paciente}, te recordamos que tenés un saldo pendiente de {saldo} en {clinica}. Respondé por acá o pasá por la clínica para coordinar el pago. ¡Gracias!'
WHERE kind = 'payment_due'
  AND body = 'Hola {paciente}, te recordamos que tenés un saldo pendiente de {saldo} en {clinica}. Podés abonarlo cuando quieras acá: {link_pago}. ¡Gracias!';

-- Y la función que siembra clínicas nuevas, para que no vuelva a insertar
-- la versión vieja con los placeholders rotos.
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
     NEW.created_by)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;
