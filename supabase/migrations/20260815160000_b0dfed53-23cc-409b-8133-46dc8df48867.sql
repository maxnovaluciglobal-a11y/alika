-- Cola de recordatorios 48h/3h.
--
-- Bug real encontrado al construir esto: los 4 templates de mensajería que
-- existen hoy (appointment_reminder, appointment_confirmation, quote_sent,
-- payment_receipt) se insertaron A MANO para "clinica Patricia" durante la
-- verificación de Fase 4A — no hay ningún trigger ni migración que los
-- siembre para una clínica nueva. Cualquier clínica piloto real arrancaría
-- con CERO templates y todo el módulo de WhatsApp (botones manuales +
-- esta cola nueva) quedaría roto en silencio. Se corrige acá extendiendo
-- `handle_new_clinic()` para sembrar los defaults, y se hace backfill para
-- la clínica que ya existe.
--
-- Además se agrega 'appointment_checkin' al enum: appointment_reminder ya
-- se usa para el aviso de 48h, pero el aviso de 3h necesita distinguirse
-- en `messages.template_kind` para no confundir "ya se mandó el de 48h"
-- con "ya se mandó el de 3h" al chequear si una cita ya fue notificada.

ALTER TYPE public.message_template_kind ADD VALUE IF NOT EXISTS 'appointment_checkin';

-- Sembrar los 5 templates default en cada clínica nueva, igual que ya se
-- auto-agrega el owner como clinic_member. ON CONFLICT DO NOTHING porque
-- UNIQUE(clinic_id, kind, name) ya existe.
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
     NEW.created_by)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- Backfill: "clinica Patricia" ya tenía los primeros 4 (sembrados a mano en
-- Fase 4A) pero no el nuevo appointment_checkin.
INSERT INTO public.message_templates (clinic_id, kind, name, channel, body, created_by)
SELECT c.id, 'appointment_checkin', 'Aviso 3h antes', 'whatsapp',
       'Hola {paciente}, en unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos! Si no podés venir, avisanos por acá.',
       c.created_by
FROM public.clinics c
ON CONFLICT DO NOTHING;
