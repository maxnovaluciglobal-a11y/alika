-- Fase 2: odontograma versionado por pieza y superficie
-- Patrón: nunca UPDATE de una marca; al insertar una nueva para el mismo
-- (patient_id, tooth_number, surface), un trigger cierra la anterior con
-- superseded_at. Estado vigente = superseded_at IS NULL. Historia = todo.

CREATE TYPE public.tooth_surface AS ENUM (
  'mesial', 'distal', 'oclusal', 'vestibular', 'lingual', 'whole'
);

CREATE TYPE public.tooth_condition AS ENUM (
  'sano',
  'caries',
  'obturacion',
  'endodoncia',
  'corona',
  'implante',
  'ausente',
  'sellante',
  'fractura',
  'protesis'
);

CREATE TABLE public.odontogram_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- FDI ISO 3950: cuadrantes 1-4 permanentes, 5-8 primarios. Rango 11-48 = adultos.
  tooth_number smallint NOT NULL,
  surface public.tooth_surface NOT NULL,
  condition public.tooth_condition NOT NULL,
  material text,
  notes text,
  superseded_at timestamptz,
  superseded_by uuid REFERENCES public.odontogram_marks(id) ON DELETE SET NULL,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT odontogram_tooth_range CHECK (
    (tooth_number BETWEEN 11 AND 18)
    OR (tooth_number BETWEEN 21 AND 28)
    OR (tooth_number BETWEEN 31 AND 38)
    OR (tooth_number BETWEEN 41 AND 48)
    OR (tooth_number BETWEEN 51 AND 55)
    OR (tooth_number BETWEEN 61 AND 65)
    OR (tooth_number BETWEEN 71 AND 75)
    OR (tooth_number BETWEEN 81 AND 85)
  )
);

CREATE INDEX odontogram_current_idx
  ON public.odontogram_marks (clinic_id, patient_id, tooth_number, surface)
  WHERE superseded_at IS NULL;
CREATE INDEX odontogram_history_idx
  ON public.odontogram_marks (clinic_id, patient_id, recorded_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.odontogram_marks TO authenticated;
GRANT ALL ON public.odontogram_marks TO service_role;
ALTER TABLE public.odontogram_marks ENABLE ROW LEVEL SECURITY;

-- Lectura: mismo set que clinical:view — clínico completo, no lo ve recepción.
-- Coincide con el patrón que usa clinical_notes.
CREATE POLICY "odontogram_select_clinical" ON public.odontogram_marks
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant']::public.app_role[]
    )
  );

-- Escritura de marcas nuevas: solo doctores y admins (assistant NO — asistente
-- puede ver pero no marcar, mismo criterio que clinical:write en access.ts).
CREATE POLICY "odontogram_insert_clinical" ON public.odontogram_marks
  FOR INSERT TO authenticated WITH CHECK (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist']::public.app_role[]
    )
    AND recorded_by = auth.uid()
  );

-- El UPDATE solo lo hace el trigger de cierre (SECURITY DEFINER) para setear
-- superseded_at/superseded_by. Ningún usuario puede modificar una marca.
CREATE POLICY "odontogram_no_manual_update" ON public.odontogram_marks
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "odontogram_delete_managers" ON public.odontogram_marks
  FOR DELETE TO authenticated USING (public.can_manage_clinic(clinic_id));

-- Trigger: al insertar una marca nueva, cierra la vigente anterior para la
-- misma (patient, tooth, surface). Reemplaza el UPDATE manual — la marca
-- vieja queda inmutable con superseded_at/superseded_by, la nueva es la vigente.
CREATE OR REPLACE FUNCTION public.close_previous_odontogram_mark()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.odontogram_marks
     SET superseded_at = NEW.recorded_at,
         superseded_by = NEW.id
   WHERE clinic_id = NEW.clinic_id
     AND patient_id = NEW.patient_id
     AND tooth_number = NEW.tooth_number
     AND surface = NEW.surface
     AND superseded_at IS NULL
     AND id <> NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER odontogram_close_previous
  AFTER INSERT ON public.odontogram_marks
  FOR EACH ROW
  EXECUTE FUNCTION public.close_previous_odontogram_mark();
