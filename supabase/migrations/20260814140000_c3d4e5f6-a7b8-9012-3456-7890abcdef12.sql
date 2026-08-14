-- Wave C · Portal v2: solicitudes de hora desde el portal del paciente.
--
-- No reusamos waitlist_entries porque tiene semántica distinta ("paciente
-- listo para ser llamado si hay hueco") y schema con created_by NOT NULL
-- que no cierra para inserts desde el portal (sin JWT de clínica).
--
-- El portal escribe con SUPABASE_SERVICE_ROLE_KEY, filtrando siempre por
-- (clinic_id, patient_id) extraídos del token JWT validado. La policy
-- de la tabla no permite acceso desde authenticated para escritura del
-- lado paciente; solo staff de la clínica ve/actualiza.

CREATE TABLE public.appointment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  preferred_date date NOT NULL,
  reason text NOT NULL,
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baja','media','alta')),
  source text NOT NULL DEFAULT 'portal' CHECK (source IN ('portal','whatsapp','call','walk_in','other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','scheduled','declined','cancelled')),
  scheduled_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  handled_by uuid,
  handled_at timestamptz,
  clinic_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX appointment_requests_clinic_status_idx
  ON public.appointment_requests(clinic_id, status, created_at DESC);
CREATE INDEX appointment_requests_patient_idx
  ON public.appointment_requests(clinic_id, patient_id, created_at DESC);

ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.appointment_requests TO authenticated;
GRANT ALL ON public.appointment_requests TO service_role;

-- Staff clínico ve todas las solicitudes de su clínica.
CREATE POLICY "appt_requests_select_staff" ON public.appointment_requests
  FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));

-- Reception/dentist/admin/owner pueden actualizar (para agendar o rechazar).
CREATE POLICY "appt_requests_update_finance_roles" ON public.appointment_requests
  FOR UPDATE TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]));

-- Los INSERTs solo desde service_role (via el portal).

CREATE TRIGGER appointment_requests_updated_at BEFORE UPDATE ON public.appointment_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
