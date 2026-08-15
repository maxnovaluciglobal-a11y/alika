-- Audit trail de acceso al portal del paciente.
--
-- El portal no tiene login: cualquiera con el link JWT ve datos de un
-- paciente. A diferencia de clinical_notes (que sí tiene
-- clinical_note_audit), hasta ahora no quedaba registro de quién abrió
-- el link ni cuándo — si un link se filtra, no había forma de investigarlo.
--
-- Se escribe desde service_role (el portal no tiene JWT de Supabase),
-- igual que appointment_requests.

CREATE TABLE public.portal_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('session_opened', 'overview_viewed')),
  ip_hint text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portal_access_log_clinic_patient_idx
  ON public.portal_access_log(clinic_id, patient_id, created_at DESC);

ALTER TABLE public.portal_access_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.portal_access_log TO authenticated;
GRANT INSERT ON public.portal_access_log TO service_role;

-- Staff clínico ve el log de acceso de su propia clínica.
CREATE POLICY "portal_access_log_select_staff" ON public.portal_access_log
  FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));

-- Los INSERTs solo desde service_role (vía el portal). Sin policy de
-- INSERT para authenticated = sin acceso de escritura desde la app.
