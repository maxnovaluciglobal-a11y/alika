-- Auditoría 360 v2 (26-ago-2026) — seguridad-3 / arq-5: "anamnesis con
-- alergias mutable sin historial, inconsistente con el versionado que el
-- resto del sistema clínico exige".
--
-- Decisión de diseño (revisar con Walter si se prefiere lo contrario):
-- `patient_medical_history` fue creada A PROPÓSITO como "1 fila por
-- paciente... no versionada como clinical_notes/odontogram_marks: es un
-- perfil editable, no un evento clínico" (ver comentario original en
-- 20260826180000_patient_medical_history.sql). Convertirla al patrón
-- INSERT-nueva-versión de odontogram_marks/clinical_notes cambiaría esa
-- decisión de diseño y obligaría a reescribir todo lector de "alergias
-- vigentes" del repo (agenda, ficha de paciente, futuro banner de agenda).
--
-- En vez de eso, se agrega una AUDITORÍA (append-only, nunca se lee para
-- mostrar el dato vigente) que resuelve el riesgo real señalado por la
-- auditoría — perder sin rastro el valor anterior de una alergia — sin
-- tocar ningún código existente que lee `patient_medical_history`.

CREATE TABLE public.patient_medical_history_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- Snapshot completo de la fila ANTES del cambio (o del alta, ver trigger).
  allergies text[] NOT NULL,
  chronic_medications text[] NOT NULL,
  conditions text[] NOT NULL,
  notes text,
  changed_by uuid,
  change_kind text NOT NULL CHECK (change_kind IN ('insert', 'update')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_medical_history_audit_patient_idx
  ON public.patient_medical_history_audit (patient_id, recorded_at DESC);

GRANT SELECT, INSERT ON public.patient_medical_history_audit TO authenticated;
GRANT ALL ON public.patient_medical_history_audit TO service_role;
ALTER TABLE public.patient_medical_history_audit ENABLE ROW LEVEL SECURITY;

-- Mismo set de roles que la tabla que audita (regla #2 CLAUDE.md).
CREATE POLICY "medical_history_audit_select_clinical" ON public.patient_medical_history_audit
  FOR SELECT TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));

-- Nunca UPDATE/DELETE sobre la auditoría misma — es append-only por diseño,
-- mismo criterio que security-1 de la auditoría del 21-ago (no revocar sin
-- revisión explícita).
REVOKE UPDATE, DELETE ON public.patient_medical_history_audit FROM authenticated;

CREATE OR REPLACE FUNCTION public.log_patient_medical_history_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.patient_medical_history_audit
      (clinic_id, patient_id, allergies, chronic_medications, conditions, notes, changed_by, change_kind)
    VALUES
      (NEW.clinic_id, NEW.patient_id, NEW.allergies, NEW.chronic_medications, NEW.conditions, NEW.notes,
       NEW.updated_by, 'insert');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Guarda el estado ANTERIOR (OLD), no el nuevo — el nuevo ya queda en
    -- patient_medical_history. Esto es lo que responde "¿qué decía antes
    -- de este cambio?" ante una disputa o un error de tipeo.
    INSERT INTO public.patient_medical_history_audit
      (clinic_id, patient_id, allergies, chronic_medications, conditions, notes, changed_by, change_kind)
    VALUES
      (OLD.clinic_id, OLD.patient_id, OLD.allergies, OLD.chronic_medications, OLD.conditions, OLD.notes,
       NEW.updated_by, 'update');
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER patient_medical_history_audit_trigger
  AFTER INSERT OR UPDATE ON public.patient_medical_history
  FOR EACH ROW EXECUTE FUNCTION public.log_patient_medical_history_change();
