-- Periodontograma: estándar clínico (AAP y equivalentes LatAm), a nivel PACIENTE.
-- Patrón de versionado: igual criterio que odontogram_marks/clinical_notes —
-- inmutable una vez creado. A diferencia del odontograma (que versiona por
-- SUPERFICIE individual con trigger de cierre), acá cada "sondaje" es un
-- EVENTO completo: una sesión de medición de toda la boca (o de las piezas
-- medidas ese día). No hace falta trigger de cierre porque no hay una fila
-- puntual que se reemplaza — un sondaje nuevo es simplemente un chart nuevo,
-- y "vigente" = el más reciente por paciente (ORDER BY recorded_at DESC LIMIT 1).
--
-- Simplificación documentada: profundidad de sondaje (PD), sangrado al
-- sondaje (BOP) y recesión gingival se registran los TRES por punto (6 puntos
-- por pieza: mv, v, dv, ml, l, dl) — el estándar real de la AAP, no una
-- reducción. Movilidad (Miller 0-3) y furca (0-3, solo molares) son por
-- PIEZA completa (no tiene sentido clínico medirlas por punto) y viven en
-- una fila aparte con point='whole' para esa pieza dentro del mismo chart.

CREATE TYPE public.periodontal_point AS ENUM ('mv', 'v', 'dv', 'ml', 'l', 'dl', 'whole');

-- PERIODONTAL_CHARTS: una fila = una sesión de sondaje completa.
CREATE TABLE public.periodontal_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  notes text,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX periodontal_charts_patient_idx
  ON public.periodontal_charts (clinic_id, patient_id, recorded_at DESC);

GRANT SELECT, INSERT ON public.periodontal_charts TO authenticated;
GRANT ALL ON public.periodontal_charts TO service_role;
ALTER TABLE public.periodontal_charts ENABLE ROW LEVEL SECURITY;

-- Mismo set que odontogram_select_clinical: clínico completo, no recepción.
CREATE POLICY "periodontal_charts_select_clinical" ON public.periodontal_charts
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant']::public.app_role[]
    )
  );

-- Mismo set que odontogram_insert_clinical: assistant ve pero no marca.
CREATE POLICY "periodontal_charts_insert_clinical" ON public.periodontal_charts
  FOR INSERT TO authenticated WITH CHECK (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist']::public.app_role[]
    )
    AND recorded_by = auth.uid()
  );

-- Sin UPDATE ni DELETE para `authenticated` — inmutable por diseño, mismo
-- criterio que security-1 (odontogram_marks/clinical_notes): la historia
-- clínica no se borra ni se corrige en duro, se corrige con un chart nuevo.
-- service_role conserva ALL (GRANT ALL arriba) para operaciones administrativas
-- (reset de la clínica demo, migraciones futuras) — ningún usuario de la app
-- recibe ese permiso.

-- PERIODONTAL_MEASUREMENTS: los puntos medidos dentro de un chart.
-- clinic_id se denormaliza acá (igual patrón que quote_items respecto de
-- quotes) para que la policy de RLS no dependa de un JOIN.
CREATE TABLE public.periodontal_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  chart_id uuid NOT NULL REFERENCES public.periodontal_charts(id) ON DELETE CASCADE,
  -- FDI ISO 3950, mismo rango que odontogram_marks: 11-48 permanentes, 51-85 primarios.
  tooth_number smallint NOT NULL,
  point public.periodontal_point NOT NULL,
  -- Profundidad de sondaje en mm. Rango razonable 0-15 (bolsas >15mm no son clínicamente plausibles).
  pocket_depth_mm smallint CHECK (pocket_depth_mm BETWEEN 0 AND 15),
  -- Sangrado al sondaje, por punto (los mismos 6 puntos que pocket_depth_mm).
  bleeding boolean,
  -- Recesión gingival en mm. Negativo = agrandamiento gingival, positivo = recesión.
  recession_mm smallint CHECK (recession_mm BETWEEN -10 AND 15),
  -- Solo tienen sentido en point='whole' (pieza completa, no por punto).
  mobility smallint CHECK (mobility BETWEEN 0 AND 3), -- escala de Miller
  furcation smallint CHECK (furcation BETWEEN 0 AND 3), -- solo molares
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT periodontal_tooth_range CHECK (
    (tooth_number BETWEEN 11 AND 18)
    OR (tooth_number BETWEEN 21 AND 28)
    OR (tooth_number BETWEEN 31 AND 38)
    OR (tooth_number BETWEEN 41 AND 48)
    OR (tooth_number BETWEEN 51 AND 55)
    OR (tooth_number BETWEEN 61 AND 65)
    OR (tooth_number BETWEEN 71 AND 75)
    OR (tooth_number BETWEEN 81 AND 85)
  ),
  -- Un punto no puede repetirse dos veces en el mismo chart para la misma pieza.
  CONSTRAINT periodontal_measurements_unique_point UNIQUE (chart_id, tooth_number, point)
);

CREATE INDEX periodontal_measurements_chart_idx
  ON public.periodontal_measurements (chart_id);
CREATE INDEX periodontal_measurements_clinic_idx
  ON public.periodontal_measurements (clinic_id, chart_id);

GRANT SELECT, INSERT ON public.periodontal_measurements TO authenticated;
GRANT ALL ON public.periodontal_measurements TO service_role;
ALTER TABLE public.periodontal_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "periodontal_measurements_select_clinical" ON public.periodontal_measurements
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant']::public.app_role[]
    )
  );

CREATE POLICY "periodontal_measurements_insert_clinical" ON public.periodontal_measurements
  FOR INSERT TO authenticated WITH CHECK (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist']::public.app_role[]
    )
  );

-- Sin UPDATE ni DELETE para `authenticated`, mismo criterio que arriba.
