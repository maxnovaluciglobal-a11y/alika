-- Tier 2-E (plan Dentidesk): documentos clínicos (imágenes/radiografías) +
-- consentimientos informados firmados. La brecha más grande del análisis
-- competitivo — hoy la sección de "Documentos" en la ficha del paciente es
-- un botón "Próximamente" sin nada detrás.
--
-- Storage: bucket privado, path = {clinic_id}/{patient_id}/{filename}.
-- Documentos: sin DELETE para authenticated (mismo criterio legal que
-- clinical_notes/odontogram_marks, ver security1_no_hard_delete_clinical) —
-- solo archived_at para ocultar un archivo mal subido sin perder el registro.
-- Consentimientos: patrón de snapshot inmutable (CLAUDE.md regla #10) — el
-- template se puede editar después sin alterar el texto que el paciente
-- efectivamente firmó.

-- ---------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinical-documents',
  'clinical-documents',
  false,
  20971520, -- 20 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.storage_clinic_id_of(_name text)
RETURNS uuid
LANGUAGE sql IMMUTABLE
AS $$
  SELECT NULLIF((storage.foldername(_name))[1], '')::uuid;
$$;

CREATE POLICY "clinical_documents_select" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'clinical-documents'
    AND public.has_clinic_role(
      public.storage_clinic_id_of(name),
      ARRAY['owner','admin','dentist','assistant']::public.app_role[]
    )
  );

CREATE POLICY "clinical_documents_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'clinical-documents'
    AND public.has_clinic_role(
      public.storage_clinic_id_of(name),
      ARRAY['owner','admin','dentist','assistant']::public.app_role[]
    )
  );

-- Sin UPDATE/DELETE de objetos para authenticated: un documento clínico no se
-- reemplaza in situ ni se borra, se archiva a nivel de fila (ver más abajo).

-- ---------------------------------------------------------------
-- patient_documents: imágenes y radiografías
-- ---------------------------------------------------------------
CREATE TYPE public.patient_document_kind AS ENUM ('image', 'radiograph', 'other');

CREATE TABLE public.patient_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  kind public.patient_document_kind NOT NULL DEFAULT 'other',
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  notes text,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  archived_by uuid
);

CREATE INDEX patient_documents_patient_idx
  ON public.patient_documents (clinic_id, patient_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.patient_documents TO authenticated;
GRANT ALL ON public.patient_documents TO service_role;
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_documents_select" ON public.patient_documents
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[])
  );

CREATE POLICY "patient_documents_insert" ON public.patient_documents
  FOR INSERT TO authenticated WITH CHECK (
    public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[])
    AND uploaded_by = auth.uid()
  );

-- El único UPDATE permitido es archivar (setear archived_at/archived_by);
-- todo lo demás de la fila es inmutable una vez subida.
CREATE OR REPLACE FUNCTION public.enforce_patient_document_update()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
    OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
    OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
    OR NEW.filename IS DISTINCT FROM OLD.filename
    OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
    OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes
    OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Un documento clínico solo se puede archivar, no editar.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER patient_documents_enforce_update
  BEFORE UPDATE ON public.patient_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_patient_document_update();

CREATE POLICY "patient_documents_update_archive" ON public.patient_documents
  FOR UPDATE TO authenticated USING (
    public.can_manage_clinic(clinic_id)
  ) WITH CHECK (
    public.can_manage_clinic(clinic_id)
  );

-- ---------------------------------------------------------------
-- consent_templates: catálogo editable de textos de consentimiento
-- ---------------------------------------------------------------
CREATE TABLE public.consent_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.consent_templates TO authenticated;
GRANT ALL ON public.consent_templates TO service_role;
ALTER TABLE public.consent_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consent_templates_select" ON public.consent_templates
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[])
  );

CREATE POLICY "consent_templates_write" ON public.consent_templates
  FOR ALL TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));

-- ---------------------------------------------------------------
-- patient_consents: firma capturada, versionada, con snapshot inmutable
-- del texto firmado (el template puede cambiar después sin afectar la
-- historia — mismo patrón que name_snapshot en otras tablas).
-- ---------------------------------------------------------------
CREATE TABLE public.patient_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.consent_templates(id) ON DELETE SET NULL,
  title_snapshot text NOT NULL,
  body_snapshot text NOT NULL,
  signature_storage_path text NOT NULL,
  signed_by_name text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  revoked_at timestamptz,
  revoked_by uuid
);

CREATE INDEX patient_consents_patient_idx
  ON public.patient_consents (clinic_id, patient_id, signed_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.patient_consents TO authenticated;
GRANT ALL ON public.patient_consents TO service_role;
ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_consents_select" ON public.patient_consents
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[])
  );

CREATE POLICY "patient_consents_insert" ON public.patient_consents
  FOR INSERT TO authenticated WITH CHECK (
    public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[])
    AND recorded_by = auth.uid()
  );

-- Un consentimiento firmado es inmutable: lo único editable es revocarlo
-- (ej. el paciente lo retracta, o se firmó por error).
CREATE OR REPLACE FUNCTION public.enforce_patient_consent_update()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
    OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
    OR NEW.template_id IS DISTINCT FROM OLD.template_id
    OR NEW.title_snapshot IS DISTINCT FROM OLD.title_snapshot
    OR NEW.body_snapshot IS DISTINCT FROM OLD.body_snapshot
    OR NEW.signature_storage_path IS DISTINCT FROM OLD.signature_storage_path
    OR NEW.signed_by_name IS DISTINCT FROM OLD.signed_by_name
    OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
    OR NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
  THEN
    RAISE EXCEPTION 'Un consentimiento firmado solo se puede revocar, no editar.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER patient_consents_enforce_update
  BEFORE UPDATE ON public.patient_consents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_patient_consent_update();

CREATE POLICY "patient_consents_update_revoke" ON public.patient_consents
  FOR UPDATE TO authenticated USING (
    public.can_manage_clinic(clinic_id)
  ) WITH CHECK (
    public.can_manage_clinic(clinic_id)
  );
