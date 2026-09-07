-- ════════════════════════════════════════════════════════════════════════
-- El aviso del PACIENTE es un eje distinto del visto bueno del PROFESIONAL
-- ════════════════════════════════════════════════════════════════════════
--
-- `status = 'confirmada'` + `confirmed_at`/`confirmed_by` significan UNA sola
-- cosa: el odontólogo (o admin/owner en su nombre) aceptó la cita. Lo dejó
-- así la migración 20260901130000, a pedido explícito de una clienta:
-- "una vez alguien toma la agenda, el dentista debe aceptarla".
--
-- Que el paciente diga "ahí voy" es un hecho DIFERENTE, y hasta ahora Alika
-- no tenía dónde anotarlo. Por eso la confirmación por WhatsApp se removió
-- en `505eb7d`: reusaba `confirmed_at`, o sea le daba al paciente permiso de
-- escritura sobre la agenda del profesional. El problema nunca fue la
-- función, era la columna compartida.
--
-- Esta migración NO revierte aquel commit: agrega el segundo eje. Nada de lo
-- que escribe el paciente toca `status`, `confirmed_at` ni `confirmed_by`.

ALTER TABLE public.appointments
  ADD COLUMN patient_confirmed_at timestamptz,
  ADD COLUMN patient_confirmed_via text
    CHECK (patient_confirmed_via IN ('whatsapp', 'portal', 'telefono', 'presencial'));

COMMENT ON COLUMN public.appointments.patient_confirmed_at IS
  'Cuándo el PACIENTE avisó que viene. Independiente de confirmed_at, que es el visto bueno del profesional. Nunca lo escribe el paciente directo: lo estampa el webhook de WhatsApp o alguien de recepción.';
COMMENT ON COLUMN public.appointments.patient_confirmed_via IS
  'Por dónde avisó: whatsapp (webhook), portal, telefono o presencial (los dos últimos los carga recepción a mano).';

-- ── El invariante que hace que el dato no mienta ──────────────────────────
-- "El paciente dijo que viene" se refiere a UNA fecha y hora concreta. Si la
-- cita se mueve, ese aviso deja de ser cierto y arrastrarlo sería peor que
-- no tenerlo: la agenda mostraría un paciente confirmado para un horario que
-- nunca le avisaron. Lo mismo si la cita se cancela.
--
-- Va en un trigger y no en la aplicación a propósito: reagendar pasa desde
-- la agenda, desde el drag&drop, desde la ficha y desde la cola offline. Un
-- chequeo por cada camino se olvida en el cuarto.
CREATE OR REPLACE FUNCTION public.reset_patient_confirmation_on_reschedule()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Si esta misma sentencia está SETEANDO la confirmación, no la pisamos:
  -- solo limpiamos cuando el aviso venía de antes y el contexto cambió.
  IF NEW.patient_confirmed_at IS DISTINCT FROM OLD.patient_confirmed_at THEN
    RETURN NEW;
  END IF;

  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at
     OR NEW.status IN ('cancelada', 'ausente')
  THEN
    NEW.patient_confirmed_at := NULL;
    NEW.patient_confirmed_via := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_reset_patient_confirmation
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.reset_patient_confirmation_on_reschedule();

-- Índice parcial: la agenda solo pregunta por las citas futuras que YA
-- tienen aviso del paciente (para pintar el indicador). Parcial y no total
-- porque la enorme mayoría de las filas tiene la columna en NULL.
CREATE INDEX appointments_patient_confirmed_idx
  ON public.appointments (clinic_id, starts_at)
  WHERE patient_confirmed_at IS NOT NULL;
