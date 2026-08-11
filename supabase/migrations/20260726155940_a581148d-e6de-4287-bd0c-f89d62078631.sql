ALTER TABLE public.clinical_notes
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS reviewer_id uuid,
  ADD COLUMN IF NOT EXISTS review_requested_by uuid,
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.clinical_notes
  ADD CONSTRAINT clinical_notes_review_status_check
  CHECK (review_status IN ('none','pending','approved','changes_requested'));

CREATE TABLE public.clinical_note_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_ref text NOT NULL,
  action text NOT NULL CHECK (action IN ('requested','approved','changes_requested','comment','cancelled')),
  comment text,
  actor_id uuid NOT NULL,
  reviewer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clinical_note_reviews_note_idx ON public.clinical_note_reviews(note_id, created_at DESC);
CREATE INDEX clinical_note_reviews_clinic_idx ON public.clinical_note_reviews(clinic_id, patient_ref);

GRANT SELECT, INSERT ON public.clinical_note_reviews TO authenticated;
GRANT ALL ON public.clinical_note_reviews TO service_role;

ALTER TABLE public.clinical_note_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros ven revisiones de su clinica"
ON public.clinical_note_reviews FOR SELECT TO authenticated
USING (public.is_clinic_member(clinic_id));

CREATE POLICY "Equipo clinico registra revisiones"
ON public.clinical_note_reviews FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[])
);