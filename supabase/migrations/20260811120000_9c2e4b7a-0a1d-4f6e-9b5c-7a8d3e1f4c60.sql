-- Fase 1: pacientes y agenda reales (reemplaza src/lib/clinic-data.ts)

CREATE TYPE public.patient_status AS ENUM ('active','new','inactive');
CREATE TYPE public.appointment_status AS ENUM ('tentativa','confirmada','en-sala','ausente','finalizada','cancelada');

-- PATIENTS
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  primary_professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  document_id text,
  birth_date date,
  phone text,
  email text,
  status public.patient_status NOT NULL DEFAULT 'new',
  tags text[] NOT NULL DEFAULT '{}',
  avatar_url text,
  -- Placeholders nullable para módulos aún no construidos (facturación / IA de fase 2-4).
  -- NULL siempre significa "sin datos todavía", nunca 0 ni un texto inventado.
  balance_cents bigint,
  no_show_risk numeric(5,2),
  ai_summary text,
  ai_summary_updated_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patients_clinic_idx ON public.patients (clinic_id, full_name);
CREATE INDEX patients_clinic_status_idx ON public.patients (clinic_id, status);
CREATE INDEX patients_clinic_professional_idx ON public.patients (clinic_id, primary_professional_id);
CREATE INDEX patients_document_idx ON public.patients (clinic_id, document_id);
CREATE TRIGGER patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Datos demográficos visibles a todo miembro de la clínica (agenda/recepción los necesitan).
-- Lo clínico (notas) sigue separado en clinical_notes con su propia policy, más estricta.
CREATE POLICY "patients_select_members" ON public.patients
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));

CREATE POLICY "patients_insert_front_desk" ON public.patients
  FOR INSERT TO authenticated WITH CHECK (
    public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[])
    AND created_by = auth.uid()
  );

CREATE POLICY "patients_update_front_desk" ON public.patients
  FOR UPDATE TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]));

CREATE POLICY "patients_delete_managers" ON public.patients
  FOR DELETE TO authenticated USING (public.can_manage_clinic(clinic_id));

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  operatory_id uuid REFERENCES public.operatories(id) ON DELETE SET NULL,
  treatment_label text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'tentativa',
  is_priority boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_time_order CHECK (ends_at > starts_at)
);
CREATE INDEX appointments_clinic_date_idx ON public.appointments (clinic_id, starts_at);
CREATE INDEX appointments_clinic_professional_idx ON public.appointments (clinic_id, professional_id, starts_at);
CREATE INDEX appointments_clinic_branch_idx ON public.appointments (clinic_id, branch_id, starts_at);
CREATE INDEX appointments_clinic_patient_idx ON public.appointments (clinic_id, patient_id, starts_at DESC);
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select_members" ON public.appointments
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));

CREATE POLICY "appointments_write_agenda_roles" ON public.appointments
  FOR ALL TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]));

-- Permite mostrar "box" en la agenda sin modelar consultorios por cita todavía.
ALTER TABLE public.professionals
  ADD COLUMN default_operatory_id uuid REFERENCES public.operatories(id) ON DELETE SET NULL;

-- WAITLIST_ENTRIES
CREATE TABLE public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  reason text,
  wait_since timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','scheduled','cancelled')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX waitlist_clinic_status_idx ON public.waitlist_entries (clinic_id, status, wait_since);
CREATE TRIGGER waitlist_updated_at BEFORE UPDATE ON public.waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist_entries TO authenticated;
GRANT ALL ON public.waitlist_entries TO service_role;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waitlist_select_members" ON public.waitlist_entries
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "waitlist_write_agenda_roles" ON public.waitlist_entries
  FOR ALL TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]));
