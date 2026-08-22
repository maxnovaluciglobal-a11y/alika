-- Audit finding product-2 (continuación de 20260822130000): agrega la
-- variable opcional {link_resena} al final de la plantilla sembrada de
-- review_request para clínicas NUEVAS. El motor de templates de Alika
-- (renderTemplate en src/lib/messaging.ts) es reemplazo simple de {variable},
-- sin condicionales — por eso el "if hay link" vive en el cliente
-- (recordatorios.tsx arma el VALOR de la variable, no solo la URL: si hay
-- google_review_url arma la frase completa, si no hay, pasa "" y el
-- placeholder desaparece sin dejar rastro feo).
--
-- Deliberadamente NO se actualizan las filas de message_templates de
-- clínicas existentes: son editables por el staff (podrían tener texto
-- propio ya cargado) y el patrón de este archivo (ver backfill de abajo en
-- la migración 20260816170100) es sembrar solo lo que falta, nunca
-- sobreescribir lo que ya existe. Clínicas creadas antes de este cambio no
-- van a incluir el link en el mensaje hasta que alguien edite manualmente el
-- campo `body` de su fila `review_request` en `message_templates` para
-- agregar `{link_resena}` — no hay UI de edición de templates todavía.
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
     'Hola {paciente}, ¡gracias por tu visita a {clinica}! Si te sentiste bien atendido/a, ¿nos dejás una reseña? Buscanos en Google como "{clinica}". ¡Nos ayuda un montón!{link_resena}',
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
