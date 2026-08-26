-- Horario semanal recurrente por profesional (Tier 1-B del plan
-- competitivo vs. Dentidesk). Hasta ahora solo existía horario a nivel de
-- sucursal (branches.opens_at/closes_at); un profesional que no atiende
-- ciertos días u horarios no tenía forma de declararlo, y createAppointment
-- no podía avisar de una cita agendada fuera de su disponibilidad real.
--
-- Un profesional SIN filas acá se interpreta como "sin restricción
-- declarada" (compatibilidad hacia atrás total con las clínicas que ya
-- tienen profesionales cargados desde el onboarding, antes de esta
-- feature) — createAppointment solo bloquea cuando SÍ hay horario
-- declarado y el rango pedido cae afuera.

CREATE TABLE public.professional_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  -- 0 = domingo ... 6 = sábado, igual que Date.getDay() en JS — evita una
  -- capa de traducción día-de-semana entre DB y cliente.
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professional_schedules_range_chk CHECK (start_time < end_time)
);
CREATE INDEX professional_schedules_prof_idx
  ON public.professional_schedules (professional_id, day_of_week);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_schedules TO authenticated;
GRANT ALL ON public.professional_schedules TO service_role;
ALTER TABLE public.professional_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "professional_schedules_select" ON public.professional_schedules
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "professional_schedules_write" ON public.professional_schedules
  FOR ALL TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));
