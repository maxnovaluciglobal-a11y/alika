
CREATE TABLE public.clinical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_ref text NOT NULL,
  patient_name text,
  title text NOT NULL DEFAULT 'Nota clínica',
  content text NOT NULL DEFAULT '',
  summary text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clinical_notes_patient_idx ON public.clinical_notes (clinic_id, patient_ref, updated_at DESC);

CREATE TABLE public.clinical_note_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  summary text,
  ai_assisted boolean NOT NULL DEFAULT false,
  ai_action text,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, version)
);
CREATE INDEX clinical_note_versions_note_idx ON public.clinical_note_versions (note_id, version DESC);

CREATE TABLE public.clinical_note_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_ref text NOT NULL,
  action text NOT NULL,
  detail text,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clinical_note_audit_note_idx ON public.clinical_note_audit (clinic_id, patient_ref, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_notes TO authenticated;
GRANT ALL ON public.clinical_notes TO service_role;
GRANT SELECT, INSERT ON public.clinical_note_versions TO authenticated;
GRANT ALL ON public.clinical_note_versions TO service_role;
GRANT SELECT, INSERT ON public.clinical_note_audit TO authenticated;
GRANT ALL ON public.clinical_note_audit TO service_role;

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_note_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select_members" ON public.clinical_notes FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));
CREATE POLICY "notes_insert_clinical" ON public.clinical_notes FOR INSERT TO authenticated
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]) AND created_by = auth.uid());
CREATE POLICY "notes_update_clinical" ON public.clinical_notes FOR UPDATE TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));
CREATE POLICY "notes_delete_managers" ON public.clinical_notes FOR DELETE TO authenticated
  USING (public.can_manage_clinic(clinic_id));

CREATE POLICY "note_versions_select_members" ON public.clinical_note_versions FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));
CREATE POLICY "note_versions_insert_clinical" ON public.clinical_note_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]) AND author_id = auth.uid());

CREATE POLICY "note_audit_select_members" ON public.clinical_note_audit FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));
CREATE POLICY "note_audit_insert_members" ON public.clinical_note_audit FOR INSERT TO authenticated
  WITH CHECK (public.is_clinic_member(clinic_id) AND actor_id = auth.uid());

CREATE TRIGGER clinical_notes_updated_at BEFORE UPDATE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
