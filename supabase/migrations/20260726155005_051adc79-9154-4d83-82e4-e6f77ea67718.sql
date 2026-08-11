CREATE TYPE public.clinical_entity_kind AS ENUM ('diagnosis','treatment','medication','allergy');

CREATE TABLE public.clinical_note_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_ref text NOT NULL,
  kind public.clinical_entity_kind NOT NULL,
  term text NOT NULL,
  code text,
  tooth text,
  quantity numeric,
  dosage text,
  severity text,
  status text,
  notes text,
  confidence numeric,
  ai_generated boolean NOT NULL DEFAULT true,
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clinical_note_entities_note_idx ON public.clinical_note_entities(note_id);
CREATE INDEX clinical_note_entities_patient_idx ON public.clinical_note_entities(clinic_id, patient_ref);
CREATE INDEX clinical_note_entities_kind_idx ON public.clinical_note_entities(clinic_id, kind);
CREATE INDEX clinical_note_entities_term_idx ON public.clinical_note_entities USING gin (to_tsvector('spanish', term));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_note_entities TO authenticated;
GRANT ALL ON public.clinical_note_entities TO service_role;

ALTER TABLE public.clinical_note_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros ven entidades de su clinica"
ON public.clinical_note_entities FOR SELECT TO authenticated
USING (public.is_clinic_member(clinic_id));

CREATE POLICY "Rol clinico crea entidades"
ON public.clinical_note_entities FOR INSERT TO authenticated
WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));

CREATE POLICY "Rol clinico edita entidades"
ON public.clinical_note_entities FOR UPDATE TO authenticated
USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]))
WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));

CREATE POLICY "Rol clinico borra entidades"
ON public.clinical_note_entities FOR DELETE TO authenticated
USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));

CREATE TRIGGER set_clinical_note_entities_updated_at
BEFORE UPDATE ON public.clinical_note_entities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();