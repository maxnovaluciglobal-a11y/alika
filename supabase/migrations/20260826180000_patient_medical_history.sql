-- Anamnesis estructurada (Tier 1-C del plan competitivo vs. Dentidesk).
-- Hasta ahora la única forma de registrar una alergia era como texto libre
-- dentro de una nota clínica, extraída "a veces" por IA — sin ningún campo
-- de seguridad clínica visible de forma confiable. Esta tabla es 1 fila por
-- paciente (no versionada como clinical_notes/odontogram_marks: es un
-- perfil editable, no un evento clínico que deba conservar su historia).
--
-- Mismo criterio de permisos que clinical_notes (regla #2 del CLAUDE.md):
-- SOLO owner/admin/dentist/assistant. reception/accounting no ven ni
-- editan antecedentes médicos.

CREATE TABLE public.patient_medical_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL UNIQUE REFERENCES public.patients(id) ON DELETE CASCADE,
  allergies text[] NOT NULL DEFAULT '{}',
  chronic_medications text[] NOT NULL DEFAULT '{}',
  conditions text[] NOT NULL DEFAULT '{}',
  notes text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_medical_history_clinic_idx ON public.patient_medical_history (clinic_id);
CREATE TRIGGER patient_medical_history_updated_at
  BEFORE UPDATE ON public.patient_medical_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_medical_history TO authenticated;
GRANT ALL ON public.patient_medical_history TO service_role;
ALTER TABLE public.patient_medical_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medical_history_select_clinical" ON public.patient_medical_history
  FOR SELECT TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));
CREATE POLICY "medical_history_insert_clinical" ON public.patient_medical_history
  FOR INSERT TO authenticated
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));
CREATE POLICY "medical_history_update_clinical" ON public.patient_medical_history
  FOR UPDATE TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));
